# Joint Layout and Memory: RD-07 Loadable Assets and D64 Delivery

> **Document**: 03-04-joint-layout-and-memory.md
> **Parent**: [Index](00-index.md)

## Overview

This component proves that every possible destination, the loader code and name data, the KERNAL
workspace, and the resident image can coexist. It extends the existing interval layout and
version-1 memory ledger; it does not add a second allocator or a runtime residency system.

## Architecture

### Current architecture

`layoutC64Program` performs deterministic first-fit placement over intervals with kinds
`stub`, `code`, `immutable`, `global`, `bss`, `asset`, `sfa`, `fill`
(`layout/c64-layout.ts:18-34`, `layout/c64-layout-placement.ts:57-90`). SFA homes are already closed
and are placed as `bytes: null` intervals (`layout/c64-layout-objects.ts:65-125`). Memory evidence
builds `cpu16` and `cpu16-vic` views from those intervals (`services/evidence.ts:239-403`).
Exclusive residencies and overlapping alternative intervals are already admitted by the version-1
schema (`artifacts/memory-evidence-validator.ts:117-129`, RD-03 memory contract).

### Proposed changes

No new placement solver. The destination is an existing mutable object or SFA home; its interval is
already placed. The load adds:

1. a proof that every candidate sub-range is legal;
2. loader code (inside the calling function's code interval);
3. one read-only name data interval per reachable unit;
4. a memory-state projection showing the destination's mutually exclusive contents.

## Implementation Details

### Destination intervals

For each load call, `proveLoadDestination` resolves every candidate to a physical range:

```ts
/** One proved physical destination interval. */
export interface ProvedLoadDestination {
  readonly unitId: string;
  readonly callSite: SourceSpan;
  readonly addressSpaceId: "cpu16";
  readonly start: number;
  readonly end: number;
  readonly alignmentBytes: number;
  readonly bankId?: string;
  readonly visibility: readonly ("cpu" | "vic")[];
  readonly writable: true;
  readonly residencyId: string;
}
```

The proof checks:

- the range is inside `$0801–$CFFF` for the cooperative profile, or inside an explicitly proved
  legal mapping;
- the range is not I/O `$D000–$DFFF`, not KERNAL ROM `$E000–$FFFF`, not the hardware stack, not a
  vector, not the loader code/name data, and not another simultaneously live object;
- the range satisfies the unit's RD-06 alignment/visibility/no-cross constraints;
- the range does not overlap an active screen/character-ROM window unless the unit is the active
  VIC consumer;
- the range's end is `<= $10000`. Under the selected profile, any source interval that intersects
  the visible KERNAL ROM `$E000–$FFFF` is rejected, so the largest legal source end is `$E000`. The
  `$10000` arithmetic (`returned X/Y = $0000`) is retained and tested at the lowering/unit level for
  a future legal RAM-at-top mapping; it is not accepted as a source destination under this profile.

A failed check reports every conflicting owner, the requested range, and one source/configuration
remedy. It fails before ACME and before any D64 publication.

A field, nested field, array element, or subaggregate destination is represented by partitioning
the containing object's interval at destination boundaries. The destination segment becomes its
own interval carrying the exclusive load-state residencies, so no memory view activates two
overlapping intervals. The `.assets.json` destination range matches the segment base and size, and
the containing object's remaining segments keep their ordinary ownership.

### Loader intervals

The inline loader is part of the calling function's `code` interval; no separate function is
created. The unit name is one `immutable` data interval with owner `loadUnit` and
`loadUnitId`. It is placed with the other read-only data. The KERNAL workspace is already inside the
`$0000–$0400` CPU reservation; the memory report names it explicitly in the loader reservation
record but does not double-count it.

### Exclusive memory states

A destination can hold one unit at a time. The memory ledger represents this with one exclusive
group per destination and per dynamic candidate:

- a static destination has one group with `unloaded` and one member per unit that can occupy it;
- a dynamic fixed-array destination has one group per candidate element, plus one `unloaded`
  member per element, so exactly one candidate is active in any state view;
- every candidate interval is emitted once with its complete physical range and all state residency
  ids. Each state view activates exactly one member of each group.

```text
residencies:
  { kind: "always", id: "resident" }
  { kind: "exclusive", id: "load-state:currentLevel:unloaded", group: "load-state:currentLevel" }
  { kind: "exclusive", id: "load-state:currentLevel:unit:LEVEL_2", group: "load-state:currentLevel" }
```

The destination interval's payload/padding/reserved totals remain the physical storage totals, so
no view double-counts the range. `.assets.json` records the logical unit payload per destination;
the memory ledger records the physical storage. The report never claims which state was selected at
runtime.

### Quiescence and publication point

Add one additive version-1 `loadStates` array to `.memory.json`:

```ts
interface LoadStateRecord {
  readonly callSite: SourceSiteRecord;
  readonly unitId: string;
  readonly destinationIntervalIds: readonly string[];
  readonly quiescence: {
    readonly routes: readonly string[];
    readonly status: "proved";
  };
  readonly publicationPoint: {
    readonly callSite: SourceSiteRecord;
    readonly resultEdge: "true";
  };
}
```

This is the only place R7.40's quiescence and call-site publication point are reported. It adds no
runtime state. The exact-key validator is updated to admit the array; an empty array is emitted for
PRG profiles.

### Views

Emit:

- `cpu16-resident`: `always/resident`, the complete physical ledger;
- `vic-bank-0`: the clipped VIC projection, as today;
- one `cpu16-load-<destination>-<state>` view per exclusive state when a destination is shared by
  more than one unit or has an unloaded state distinct from its loaded state;
- `color-ram`, as today.

Each view includes every `always` residency and at most one member of each exclusive group. The
validator's existing tiling and exact-byte checks apply unchanged: overlapping alternative intervals
never appear in the same view. Stack headroom is reported by `stackDomains`, not by a view field.

### Visibility and banking

The destination's CPU write mapping and later read/fetch mapping must agree. The cooperative profile
banks BASIC ROM out and keeps KERNAL ROM visible, so `$0801–$CFFF` is RAM, including `$A000–$BFFF`.
The loader rejects I/O and visible KERNAL ROM. A VIC-visible destination is legal when the VIC
bank/pointer fields are derived from the destination and the destination does not overlap an active
screen/character-ROM window. Disk addresses never drive VIC fields.

### SFA interaction

The loader adds hardware-stack depth and may clobber KERNAL workspace above `$8F`. The SFA zero-page
window `$02–$8F` is unchanged. The loader's own temporaries are ordinary compiler temporaries and
must be closed before final layout; the emitter cannot invent scratch after closure. The final SFA
certificate includes the loader call's stack peak and helper storage. The draft/final layout
stability check remains in force.

### Memory evidence records

| Record | Kind | Owner | Notes |
| ------ | ---- | ----- | ----- |
| Loader name bytes | `loader` | `loadUnit` | Immutable, `loadUnitId` set |
| Loader code | `code` | calling function | Already part of the function's code range |
| Destination storage | `loadDestination` or existing `global`/`sfa` | symbol/function | Exclusive state residencies |
| KERNAL workspace | `reservation` | `platform` | Existing `$0000–$0400` reservation, named in the loader record |
| Unit logical bytes | not a RAM interval | — | Disk-only; `.assets.json`/`.costs.json` only |

Disk-only bytes are never labelled resident RAM. The `runtimeMemorySafety` value remains `proven`
only when every bounded write is covered; an unbounded raw write keeps it `unproven` with a
source-linked effect.

## Integration Points

| Stage | Use |
| ----- | --- |
| Semantic proof | Candidate ranges and constraints |
| Storage | Loader stack peak and temporaries |
| Layout | Name data, destination legality, no-overlap |
| Evidence | `loadDestination`, `loader`, exclusive residencies, views |
| Publication | Reject any proved overlap before ACME/D64 |

## Error Handling

| Error case | Handling | Code / identity | AR Ref |
| ---------- | -------- | --------------- | ------ |
| Overlap with code/SFA/stack/vector/loader/MMIO/player | Reject before ACME with every owner | E10275 | AR-P21 |
| Illegal VIC/bank mapping | Reject with the mapping reason | E10275 | AR-P7 |
| Destination end beyond `$10000` | Reject before emission | E10275 | AR-P21 |
| Source interval intersects visible KERNAL ROM | Reject with the mapping reason; lowering still supports the `$10000` arithmetic | E10275 | AR-P21 |
| Missing alignment/visibility | Reject with the required constraint | E10275 | AR-P16 |
| Memory ledger overlap in one view | Reject before publication | E10267 | AR-P14 |
| ACME reconciliation mismatch | Reject before publication | E10267 | AR-P14 |

## Testing Requirements

- Layout tests for every legal destination form and every conflict class.
- Memory-state tests for one unit, several units, and unloaded/loaded states.
- VIC/ROM mapping tests.
- Free-space/total/largest-hole tests for the new views.
- Cross-sidecar reference tests.
