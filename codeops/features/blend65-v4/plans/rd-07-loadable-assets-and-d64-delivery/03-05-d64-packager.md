# D64 Packager: RD-07 Loadable Assets and D64 Delivery

> **Document**: 03-05-d64-packager.md
> **Parent**: [Index](00-index.md)

## Overview

The packager turns the verified boot PRG and every reachable load unit into one standard 35-track
D64 image. It is a pure in-memory serializer: it reads no host files, runs no shell command, and
uses no third-party image builder. A test-only decoder independently parses the result.

## Architecture

### Format facts

| Item | Value |
| ---- | ----- |
| Image | 174,848 bytes, 35 tracks, no error-information table |
| Geometry | 1–17: 21 sectors; 18–24: 19; 25–30: 18; 31–35: 17; 683 sectors total |
| Sector | 256 bytes, raw track/sector order |
| BAM | 18/0; bytes 0–1 point to 18/1; byte 2 `$41`; bytes 4–143 BAM |
| Directory | 18/1 through 18/18 in interleave-3 chain; 8 entries per sector; 144 maximum |
| File data | Track 18 excluded; 664 data blocks |
| File interleave | 10 within each track, standard 1541 order |
| Directory interleave | 3: 1, 4, 7, 10, 13, 16, 2, 5, 8, 11, 14, 17, 3, 6, 9, 12, 15, 18 |
| Entry type | Closed PRG `$82` |
| Name | 16-byte PETSCII, `$A0`-padded; SETNAM uses the unpadded bytes |
| Fill | `$00` for unused tail, directory-slot, BAM-tail, and sector bytes |

### Policy

`cbm-dos-1541-interleave-v1` is a versioned constant:

- allocate the boot file first, then units in canonical unit order;
- start at track 1, sector 0; skip track 18; advance by the interleave-10 sequence within each
  track; on wrap, continue with the first unallocated sector;
- never allocate a sector twice, never allocate track 18, never leave an orphan;
- record the policy id in `.build.json`.

The policy is measured once with a representative multi-block KERNAL load under VICE 3.10 before
the serializer is accepted. The measurement record names the fixture, the image hash, the VICE
version, and the observed duration. Changing the policy is an observable format change and requires
dependent requalification.

## Implementation Details

### New module

```
packages/compiler/src/packaging/d64/
├── geometry.ts      # track/sector tables and offsets
├── bam.ts           # free counts and bit maps
├── directory.ts     # header, chain, entries
├── allocator.ts     # interleave-10 allocation
├── names.ts         # PETSCII encoding and collision checks
├── image.ts         # file components -> 174,848-byte image
└── evidence.ts      # component chain and hash projections
```

### Types

```ts
/** One contained PRG file. */
export interface D64File {
  readonly id: string;
  readonly name: string;          // unpadded PETSCII bytes as a string of code points
  readonly directoryName: readonly number[]; // exactly 16 bytes, $A0 padded
  readonly loadAddress: number;   // $0801 for boot, $0000 for units
  readonly bytes: readonly number[]; // exact file payload after the 2-byte header
  readonly aliases: readonly string[];
  readonly destinationCalls: readonly SourceSpan[];
}

/** The complete image plus its structural facts. */
export interface D64Image {
  readonly bytes: Uint8Array;     // exactly 174848
  readonly label: readonly number[];
  readonly diskId: readonly number[];
  readonly files: readonly D64PlacedFile[];
  readonly freeBlocks: number;
  readonly bamSha256: string;
  readonly directorySha256: string;
  readonly allocationPolicyId: "cbm-dos-1541-interleave-v1";
}
```

### BAM

For each track 1–35, four bytes:

- byte 0: number of free sectors;
- bytes 1–3: 24-bit map, bit set = free, bit 0 of byte 1 = sector 0;
- unused bits are 0;
- track 18 has zero free sectors and an all-zero map;
- `freeBlocks` is the sum of the track free counts and must equal `664 - usedDataBlocks`.

### Directory

The BAM header uses:

```text
0-1   18,1
2     $41
3     0
4-143 BAM
144-163 disk name (16 bytes, $A0 padded)
164-165 $A0 $A0
166-167 disk ID
168   $A0
169-170 $32 $41 ("2A")
171-255 0
```

Each directory sector uses the interleave-3 chain. The first two bytes of each sector point to the
next directory sector; the last sector points to `$00 $FF`. The first entry in a sector carries the
link; every other entry uses `$00 $00`. Each 32-byte entry is:

```text
0-1   link (first entry only)
2     $82
3-4   first data track/sector
5-20  name (16 bytes, $A0 padded)
21-22 0
23    0
24-29 0
30-31 block count, little-endian
```

Entries are written in canonical order: boot first, then units by stable unit identity. Unused
slots are all zero.

### File data

Each file's payload is split into 254-byte chunks. Each chunk occupies one data sector:

- bytes 0–1: next track/sector, or `$00 $00` in the final sector;
- bytes 2–255: up to 254 payload bytes;
- final sector: byte 0 = 0, byte 1 = last used byte index (2..255), remaining bytes zero.

The boot file's payload is the complete PRG body (the PRG header is not repeated). The unit file's
payload is the unit's exact logical bytes. The directory's first data sector points at the first
chunk; the chain is acyclic and in range.

### Names

`encodeDirectoryName(text)` accepts uppercase A–Z, 0–9, and maps to PETSCII `$41–$5A`, `$30–$39`.
Boot names derive from the project name; unit names are `L` plus 12 uppercase hex characters of the
unit identity hash. Names are 1–16 bytes. A collision, an empty name, or a character outside the
policy is `D64_NAME` and no image is produced. The directory stores the `$A0`-padded form; SETNAM
receives the unpadded bytes.

### Capacity

Before serialization, compute:

- `usedDataBlocks` = sum of each file's sector count;
- `directoryEntries` = 1 boot + reachable units;
- `freeBlocks = 664 - usedDataBlocks`.

Exactly 664 used blocks and exactly 144 entries succeed. One block or entry beyond either limit is
`D64_CAPACITY` with the largest contributors and a grouping remedy. Truncation, an extended image,
and a nonstandard track are never produced.

### Determinism

The image is a pure function of the boot PRG, the ordered unit records, the project name, and the
canonical semantic-input hash. There is no host path, timestamp, locale, enumeration order, or
random value. Identical inputs produce byte-identical images and hashes.

## Independent decoder

`test/rd07/d64-decoder.ts` parses the image without importing `packaging/d64`:

- verify length, track/sector geometry, and offsets;
- verify BAM link, DOS version, label, ID, DOS type, free counts, and bit maps;
- verify the directory chain, every entry, names, types, block counts, and first data links;
- walk every file chain, verify acyclic/in-range/no-shared/no-orphan sectors, final-sector length,
  and exact payload bytes;
- verify fill bytes and component hashes;
- verify the image hash against the packager's claim.

The decoder is the codec oracle. Round-tripping through the production serializer is not accepted.

## Error Handling

| Error case | Handling | AR Ref |
| ---------- | -------- | ------ |
| Invalid geometry/offset | Internal invariant failure; no image | AR-P13 |
| Directory/name collision | `D64_NAME` | AR-P10 |
| Unrepresentable boot name | `D64_NAME` | AR-P10 |
| One block/entry over capacity | `D64_CAPACITY` | AR-P21 |
| Shared/orphan/cyclic sector | Internal invariant failure; no image | AR-P13 |
| Non-deterministic input | `D64_STRUCTURE` | AR-P11 |
| Sidecar/component mismatch | `D64_STRUCTURE` | AR-P14 |

## Testing Requirements

- Independent decoder tests for geometry, BAM, directory, chains, names, fill, and hashes.
- Exact-fit and one-over capacity cases.
- Determinism across checkout paths and enumeration orders.
- Boot-first and unit-header tests.
- Allocation-policy measurement record.
