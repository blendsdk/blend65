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
validators admit the base D64 package, loadable asset placement, loader/loadDestination kinds, and
debug load units. The two additive fields in this plan (`loaderStrategyId` and `loadStates`) need a
version-1 type/validator update in Phases 5 and 8 before they can be emitted; they are not silently
accepted by the current exact-key validators.

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
  loaderStrategyId: "kernal-sequential-uncompressed";
  freeBlocks: number;
  bootComponentId: string;
  components: readonly D64ComponentEvidence[]; // directory order, boot first
}

interface D64ComponentEvidence {
  id: string;
  logicalSha256: string;
  source: ComponentSource;       // admitted {kind:"generated", identity, sha256}
  outputSha256: string;          // exact on-disk file bytes, including the 2-byte header
  directoryNamePetsciiHex: string; // 16-byte $A0-padded directory form
  fileType: "PRG";
  loadAddress: number;           // $0801 boot, $0000 unit
  startTrack: number;
  startSector: number;
  endTrack: number;
  endSector: number;
  blocks: number;
  bytes: number;                 // 2-byte header + body
  destinationCalls: readonly SourceSiteRecord[];
  aliases: readonly string[];
}

type ComponentSource =
  | { readonly kind: "input"; readonly path: string; readonly sha256: string }
  | { readonly kind: "generated"; readonly identity: string; readonly sha256: string };
```

The boot component's `logicalSha256` is the boot PRG body hash and its `source` is
`{kind:"generated", identity:<project name>, sha256:<body hash>}`. A unit component's
`logicalSha256` is the exact unit bytes hash and its `source` is
`{kind:"generated", identity:<qualified declaration>, sha256:<logical hash>}`. `outputSha256`
includes the `$0000` header. `bytes` is the on-disk file length (`2 + body.length`).

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
`aliases` include `asset::<semantic id>`; the loadable placement already carries `loadUnitId`, so
no separate `loadUnit::` alias is added (every alias must resolve to a debug symbol). The
`loadUnitId` resolves to exactly one `.build.json` component.

### `.memory.json`

| Record | Producer |
| ------ | -------- |
| Loader name data | `kind:"loader"`, owner `loadUnit`, immutable, `loadUnitId` |
| Loader code | Inside the calling function's `code` interval |
| Destination storage | `loadDestination` or existing `global`/`sfa`, exclusive state residencies |
| KERNAL workspace | Existing `$0000–$0400` reservation, named in the loader record |
| Unit logical bytes | Never a RAM interval |
| Load states | Additive `loadStates` array with call site, unit id, destination intervals, proved quiescence, and the true-edge publication point |

The exclusive state views from 03-04 are emitted only for destinations with more than one possible
unit or an unloaded state distinct from the loaded state. The base resident view remains the source
of the standard resource totals. Disk-only bytes never appear as RAM intervals. `loadStates` is the
only home for R7.40's quiescence and call-site publication point; it adds no runtime state.

### `.costs.json`

| Category | Entry |
| -------- | ----- |
| Boot-resident code/data | Existing `bytes` entries with `accounting:"program"` |
| Loader code/data | `loader` = the SETLFS/SETNAM/LOAD setup sequence (the 27-byte expert floor); split from the function's `code` interval |
| Per-unit filename bytes | `bytes` with `component:"loader"`, `accounting:"program"` |
| Call-site bytes | `callSite` = destination evaluation, end-address check, and boolean materialization; split from the function's `code` interval; each byte is attributed once |
| SFA/temp/ZP/stack | Existing `residentRam`, `zeroPage`, `sfa`, `hardwareStack`, `scratch` totals |
| KERNAL ROM | `bytes` with `component:"existingRom"`, `accounting:"existingRom"`, zero output bytes |
| Logical unit bytes | `bytes` with `component:"diskFile"`, `accounting:"diskFile"` |
| Disk container/sector overhead | `bytes` with `accounting:"diskContainer"`, and `blocks` entries |
| Destination residency | `bytes` with `accounting:"residentRam"` or `sfa` |
| Load time | `cycles` with `{kind:"unknown"}` unless a measured range is available |
| Post-load access | Existing ordinary code/data costs; no synthetic copy |

`totals.programBytes` remains the boot PRG body length, not the image length. The `code`,
`loader`, and `callSite` subsets must sum exactly to the function code interval bytes. Disk
allocation and filesystem overhead never enter optimizer `B`, `R`, or candidate selection.
Unknown timing is the measured-value `{kind:"unknown"}` record, never zero. The literal `"Unknown"`
string remains confined to `.build.json` host provenance.

### `.debug.json`

`loadUnits` is populated:

- boot: `{name: <boot component id>, kind:"resident", publication:"primary", artifact: <d64>, residence: []}`;
- each unit: `{name: <unit component id>, kind:"loadable", publication:"contained", artifact: <d64>, residence: []}`.

The boot's resident ranges are already covered by the normal `.debug.json` `ranges`; giving it a
load-unit residence would require every boot interval to carry `loadUnitId`, which is unnecessary.
The `name` is the `.build.json` component id, and the component id equals the unit id; the existing
cross-check resolves it. The source declaration stays in the component `source` and the symbol
records. `loadUnits` is ordered by name. Machine ranges that belong to a contained unit carry
`loadUnitIndex`. The primary artifact is the `.d64`. The existing `ranges`, `locations`, `symbols`,
and `addressSpaces` families remain the debug contract; no separate loader format is added.

### Build-only loadable view

After final layout and ACME reconciliation, expose a build-only `LoadableBuildView` to RD-09:

```ts
interface LoadableBuildView {
  readonly units: readonly {
    readonly id: string;
    readonly declaration: string;
    readonly directoryNamePetsciiHex: string;
    readonly startTrack: number;
    readonly startSector: number;
    readonly endTrack: number;
    readonly endSector: number;
    readonly loadAddress: number;
    readonly logicalBytes: number;
    readonly destinations: readonly string[];
    readonly strategyId: "kernal-sequential-uncompressed";
    readonly quiescence: "proved";
    readonly memoryProof: string;
    readonly costEntryIds: readonly string[];
  }[];
}
```

It is a pure shape derived from the published `.build.json`, `.debug.json`, `.memory.json`, and
`.costs.json`. RD-09 reads it from those sidecars; the language server does not import
`services/handoff.ts` or the compiler root. The shape is not a new public package. The handoff
satisfies R7.48 without widening the frontend boundary.

### Cross-sidecar reconciliation

Publication rejects the generation unless:

- every `.assets.json` loadable `loadUnitId` resolves to exactly one `.build.json` component;
- every loadable destination range is matched by the extended `assetPlacementsMatchMemory` to a
  `.memory.json` interval with the same address space, base, and size, regardless of whether the
  destination's owner is a symbol, global, function, or loadDestination;
- every `.build.json` component has one `.debug.json` load unit and the boot component is the
  `primaryArtifact`;
- every `.costs.json` disk/loader entry resolves to a component or the boot, and the `code`,
  `loader`, and `callSite` subsets sum to the code interval bytes;
- `.memory.json.loadStates` names the same call sites and units as the load operations;
- `.debug.json.primaryArtifact` is the `.d64`;
- `.build.json.package.artifactPath` is the primary artifact;
- the image hash in `.build.json` matches the published file.

A missing, duplicate, or mismatched reference is E10267 and no generation is published. An image
structure failure is `D64_STRUCTURE`; sidecar/component mismatches stay E10267.

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
| Unknown timing reported as zero | Reject; use `{kind:"unknown"}` | AR-P18 |
| Disk bytes counted as RAM | Reject | AR-P14 |

## Testing Requirements

- Exact `.build.json` D64 package and component fields.
- `.assets.json` loadable placement and aliases.
- `.memory.json` loader/destination/exclusive views.
- `.costs.json` category separation and unknown timing.
- `.debug.json` load units and machine-range indexes.
- Cross-sidecar rejection cases.
