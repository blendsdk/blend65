# Evidence and Costs: RD-07 Loadable Assets and D64 Delivery

> **Document**: 03-07-evidence-and-costs.md
> **Parent**: [Index](00-index.md)

## Overview

This component populates the existing version-1 sidecars with D64, loader, destination, and load-
unit facts and adds the cross-sidecar reconciliation that makes the generation trustworthy. It does
not introduce a new schema version or a separate loader debug format.

## Architecture

### Current architecture

`prepareEvidence` writes `.assets.json`, `.memory.json`, `.costs.json`, `.debug.json`, and
`.build.json` from the verified layout and ACME output (`services/evidence.ts:951-1111`). The
validators already admit the D64 package, loadable asset placement, loader/loadDestination kinds,
and debug load units, but the producers emit only resident PRG facts
(`services/evidence.ts:947`, `1085-1090`).

### Proposed changes

Branch on the selected profile's packager:

- PRG profiles keep the current records.
- D64 profiles add the boot/unit/disk/loader/destination records and adjust the primary artifact.

## Implementation Details

### `.build.json`

The D64 package record uses the admitted shape:

```ts
interface D64PackageEvidence {
  kind: "d64";
  artifactPath: string;          // <name>.d64
  imageBytes: 174_848;
  dosType: "2A";
  diskLabelPetsciiHex: string;
  diskIdPetsciiHex: string;
  bamSha256: string;
  directorySha256: string;
  allocationPolicyId: "cbm-dos-1541-interleave-v1";
  freeBlocks: number;
  bootComponentId: string;
  components: readonly D64ComponentEvidence[];
}

interface D64ComponentEvidence {
  id: string;
  logicalSha256: string;
  source: SourceSiteRecord;
  outputSha256: string;          // exact file bytes, including a unit's 2-byte header
  directoryNamePetsciiHex: string;
  fileType: "PRG";
  loadAddress: number;           // $0801 boot, $0000 unit
  startTrack: number;
  startSector: number;
  endTrack: number;
  endSector: number;
  blocks: number;
  bytes: number;                 // exact file payload length
  destinationCalls: readonly SourceSiteRecord[];
  aliases: readonly string[];
}
```

The boot component's `logicalSha256` is the boot PRG body hash. A unit component's
`logicalSha256` is the exact unit bytes hash and `outputSha256` includes the `$0000` header. The
component `source` is the project name for the boot and the loadable declaration for a unit.

### `.assets.json`

A loadable asset uses the admitted placement:

```ts
placement: {
  kind: "loadable",
  loadUnitId: string,
  artifactPath: string,          // <name>.d64
  destinations: PlacedRangeRecord[],
}
```

`payloadBytes` and `emittedBytes` are the logical unit size; the destinations are the proved
candidate ranges. The record's `constraints` are the unit's RD-06 handler constraints. The
`aliases` include `asset::<semantic id>` and `loadUnit::<unit id>`. The `loadUnitId` resolves to
exactly one `.build.json` component.

### `.memory.json`

| Record | Producer |
| ------ | -------- |
| Loader name data | `kind:"loader"`, owner `loadUnit`, immutable, `loadUnitId` |
| Loader code | Inside the calling function's `code` interval |
| Destination storage | `loadDestination` or existing `global`/`sfa`, exclusive state residencies |
| KERNAL workspace | Existing `$0000–$0400` reservation, named in the loader record |
| Unit logical bytes | Never a RAM interval |

The exclusive state views from 03-04 are emitted only for destinations with more than one possible
unit or an unloaded state distinct from the loaded state. The base resident view remains the source
of the standard resource totals. Disk-only bytes never appear as RAM intervals.

### `.costs.json`

| Category | Entry |
| -------- | ----- |
| Boot-resident code/data | Existing `bytes` entries with `accounting:"program"` |
| Loader code/data | `bytes` with `component:"loader"`, `accounting:"program"` |
| Per-unit filename bytes | `bytes` with `component:"loader"`, `accounting:"program"` |
| Call-site bytes | `bytes` with `component:"callSite"`, `accounting:"program"` |
| SFA/temp/ZP/stack | Existing `residentRam`, `zeroPage`, `sfa`, `hardwareStack`, `scratch` totals |
| KERNAL ROM | `bytes` with `component:"existingRom"`, `accounting:"existingRom"`, zero output bytes |
| Logical unit bytes | `bytes` with `component:"diskFile"`, `accounting:"diskFile"` |
| Disk container/sector overhead | `bytes` with `accounting:"diskContainer"`, and `blocks` entries |
| Destination residency | `bytes` with `accounting:"residentRam"` or `sfa` |
| Load time | `cycles` with `kind:"unknown"` unless measured |
| Post-load access | Existing ordinary code/data costs; no synthetic copy |

`totals.programBytes` remains the boot PRG body length, not the image length. Disk allocation and
filesystem overhead never enter optimizer `B`, `R`, or candidate selection. Unknown timing is the
literal `"Unknown"`, never zero.

### `.debug.json`

`loadUnits` is populated:

- boot: `{name: <project name>, kind:"resident", publication:"primary", artifact: <d64>, residence: [boot ranges]}`;
- each unit: `{name: <qualified declaration>, kind:"loadable", publication:"contained", artifact: <d64>, residence: []}`.

Machine ranges that belong to a contained unit carry `loadUnitIndex`. The primary artifact is the
`.d64`. The existing `ranges`, `locations`, `symbols`, and `addressSpaces` families remain the
debug contract; no separate loader format is added.

### Cross-sidecar reconciliation

Publication rejects the generation unless:

- every `.assets.json` loadable `loadUnitId` resolves to exactly one `.build.json` component;
- every loadable destination range is a `.memory.json` interval with the same address space, base,
  and size;
- every `.build.json` component has one `.debug.json` load unit and the boot component is the
  `primaryArtifact`;
- every `.costs.json` disk/loader entry resolves to a component or the boot;
- `.debug.json.primaryArtifact` is the `.d64`;
- `.build.json.package.artifactPath` is the primary artifact;
- the image hash in `.build.json` matches the published file.

A missing, duplicate, or mismatched reference is E10267 and no generation is published.

## Integration Points

| Stage | Use |
| ----- | --- |
| Packager | Component chains, BAM/directory hashes, free blocks |
| Layout | Destination intervals and loader placement |
| Evidence | Sidecar producers |
| Publication | Cross-sidecar agreement |
| Tests | Independent decoding and exact field assertions |

## Error Handling

| Error case | Handling | AR Ref |
| ---------- | -------- | ------ |
| Missing component/load unit | E10267 before publication | AR-P14 |
| Destination range mismatch | E10267 | AR-P14 |
| Cost/accounting mismatch | E10267 | AR-P14 |
| Unknown timing reported as zero | Reject; use `"Unknown"` | AR-P18 |
| Disk bytes counted as RAM | Reject | AR-P14 |

## Testing Requirements

- Exact `.build.json` D64 package and component fields.
- `.assets.json` loadable placement and aliases.
- `.memory.json` loader/destination/exclusive views.
- `.costs.json` category separation and unknown timing.
- `.debug.json` load units and machine-range indexes.
- Cross-sidecar rejection cases.
