# Load Operation and Publication: RD-07 Loadable Assets and D64 Delivery

> **Document**: 03-02-load-operation-and-publication.md
> **Parent**: [Index](00-index.md)

## Overview

This component defines the only source-level load operation, the proof that a destination is a
complete mutable fixed place, the compiler-only capture/result identity, and the definite-
initialization facts that make a later read legal. It also defines the quiescence proof at the call.

## Architecture

### Current architecture

`c64.loader.load` has no capability. The only handling is a rejection special-case for the four PRG
profiles (`frontend/scalar-expressions.ts:192-212`) and a service-level missing-module fallback
(`frontend/service.ts:341-370`). The flow model already has `ScalarConditionalEffect` with a result
id, destination state, and captured range (`frontend/semantic-types.ts:543-551`), and
`creditConditionalSuccess`/`mergeScalarFacts` implement the edge and join mechanics
(`frontend/flow-facts.ts:66-117`). No production producer exists.

### Proposed changes

Add one profile capability for the D64 profile, one semantic operation, one destination proof, and
one capture fact consumed by the existing flow analysis.

## Implementation Details

### Source capability

`c64.loader.load` is a compiler-recognized special form in the D64 profile, not a generic
`capability()` signature. The existing capability signature accepts only `SemanticType` parameters
and the four `ProfileEffect` values; adding synthetic `load-unit`/`place` types and a new effect
would widen the public type model for one operation. Instead:

- the frontend recognizes the exact qualified name before generic capability binding;
- it validates the first argument as a loadable declaration and the second as a mutable place;
- it builds the `LoadUnitOperation` directly and carries its own `"blocking-write"` effect;
- the operation is ordered as a volatile write for liveness and cannot be removed, duplicated, or
  moved across an observable write.

The existing E10275 guard at `frontend/scalar-expressions.ts:192-212` is narrowed to profiles whose
packager id is `cbm-prg` (or the four PRG ids). Without that change, adding the D64 row to
`C64_KERNAL_PROFILES` would make the guard reject the new D64 capability.

The call form is exactly `c64.loader.load(unit, destination)`. The first argument must resolve to a
loadable declaration. The second argument must be a mutable fixed place. Both are evaluated exactly
once; the unit is compile-time-only and the destination is evaluated into a symbolic physical range.

### Semantic operation

```ts
/** One synchronous transfer into a proved destination. */
export interface LoadUnitOperation {
  readonly kind: "load-unit";
  /** Boolean result identity. */
  readonly result: ValueId;
  /** Exact load unit identity. */
  readonly unit: string;
  /** Already-evaluated destination address value. */
  readonly destination: ValueId;
  /** Source place that produced the destination. */
  readonly destinationPlace: SemanticPlace;
  /** Exact unit logical type. */
  readonly unitType: SemanticType;
  /** Finite candidate intervals; one for a static place. */
  readonly candidates: readonly LoadDestinationCandidate[];
  /** Selected profile and strategy identity. */
  readonly profileId: string;
  readonly strategy: "kernal-sequential-uncompressed";
  /** Blocking write plus KERNAL/IO effect. Retained until lowering. */
  readonly effect: "blocking-write";
  /** Complete call span. */
  readonly span: SourceSpan;
}

/** One possible complete destination interval. */
export interface LoadDestinationCandidate {
  /** Root binding and place path. */
  readonly place: SemanticPlace;
  /** Root binding identity. */
  readonly binding: BindingId;
  /** Byte offset within the root binding. */
  readonly offset: number;
  /** Exact unit byte count. */
  readonly size: number;
  /** Constraints inherited from the unit's RD-06 origin. */
  readonly constraints: readonly AssetConstraint[];
}
```

The operation is a value operation producing a boolean. It is effectful and cannot be removed,
duplicated, reordered across an observable write, or treated as a pure call.

### Destination proof

`resolveLoadDestination` runs in two stages.

**Stage 1 — source place.** Resolve the second argument as a mutable place:

- module object, local, or parameter place;
- a field or nested field of one of those;
- a fixed-array element or subaggregate;
- a composition of the above with constant indices.

Reject with E10275 and a specific reason:

| Rejected form | Reason text |
| ------------- | ----------- |
| constant | `a constant has no mutable storage` |
| MMIO / volatile address | `the destination would write an I/O or volatile location` |
| loadable value | `a loadable value has no resident address` |
| temporary | `a temporary has no stable storage` |
| unsized/incompatible nominal type | `the destination type '<type>' is not exactly '<unit type>'` |
| size mismatch | `the destination is <N> bytes, the unit is <M> bytes` |
| expired lifetime | `the destination lifetime ends before the load result is used` |
| unproved complete interval | `the compiler cannot prove every byte of the destination` |

**Stage 2 — candidate set.** If the place contains a runtime index into a fixed array of exact-type
elements, every element is a candidate. Each candidate must pass the same type, size, alignment,
visibility, lifetime, overlap, and end-address proof. A dynamic place with an unprovable or
non-finite candidate set is rejected. The expression is lowered once to X/Y; the candidate set is
not a runtime branch.

A field is never rejected merely because it belongs to a larger object. No root-only restriction
exists.

### Capture and result identity

Each evaluated call creates a fresh `LoadCapture`:

```ts
/** Compiler-only publication fact for one load. */
export interface LoadCapture {
  /** Fresh result identity for this call. */
  readonly resultId: string;
  /** Exact unit identity. */
  readonly unitId: string;
  /** Destination root state. */
  readonly destination: ScalarValueState;
  /** Half-open logical ranges within the destination root. */
  readonly ranges: readonly InitializedRange[];
  /** Proved must-alias states that observe the same update. */
  readonly mustAliases: readonly ScalarValueState[];
}
```

The result boolean state carries the capture. The capture is not a runtime value and emits no flag,
token, bitmap, validity byte, descriptor, or read check.

### Publication rules

| Program point | Fact |
| ------------- | ---- |
| Before the call | Destination state unchanged; an uninitialized path cannot read it |
| At call entry | Only the captured ranges become indeterminate; must-not-alias names keep their state |
| `true` edge | Captured ranges become definitely initialized with the unit's logical value |
| `false` edge | Captured ranges become indeterminate; unselected candidates keep their state |
| Join | Ranges are intersected; a capture survives only when every alternative agrees |
| Loop | Normal monotone fixed point; a back edge without the success fact loses credit |
| Retry | A later successful call creates a fresh identity and may re-establish the ranges |
| Stored result | The capture follows the stored boolean through branches and joins |

A later read is legal only when its complete range is definitely initialized on every reaching
path. It may rely on the loaded logical value only when dominated by the successful result and
proved must-alias with the capture on every reaching path.

The flow-fact snapshot/restore helpers (`snapshotScalarFacts`, `restoreScalarFacts`,
`captureBranchFacts`) must copy the new capture field exactly as they copy `conditionalEffect`.
Missing one of those copies loses the capture across an alternative branch or a loop back edge.

### `$10000` arithmetic

The lowering and success check support an interval ending exactly at `$10000` (returned X/Y
`$0000`). The selected profile keeps KERNAL ROM visible at `$E000–$FFFF`, so a source destination
that intersects that window is rejected by the layout proof; the `$10000` arithmetic is exercised
by a lowering-level unit case for a future legal RAM-at-top mapping.

### Alias model

The existing address-provenance facts (`addressOrigins`, `addressPlaces`) define the alias sets:

- **Must-alias:** the name's proved place set is exactly the capture's destination place set. It
  receives the strong update on the true edge and the invalidation on the false edge.
- **May-alias or partial overlap:** the name's place set intersects the capture. It receives no
  definite-initialization credit; a read through it is E10276 until fully reassigned or a later
  successful load.
- **Must-not-alias:** disjoint place sets. The name keeps its incoming state.

A raw address whose provenance is unknown is may-alias. Equal source spelling alone is not identity
when an index or base is volatile or may have changed.

### Quiescence

At the load call, query the existing ownership dataflow in
`semantic/interrupt-ownership.ts` (`relativeDepths`, `mainEntryDepth`, `initializerEntryDepths`,
`checkInterruptOwnership`):

- Every recognized user IRQ/NMI sink must have been restored before the call.
- The stock KERNAL service route is not a user route and remains active.
- An externally installed, conditional, unknown, or unproved route rejects with E10275 and names the
  route, the call, and the remedy (`restoreIRQ` or `restoreNMI`).

Audio and player routes are either recognized IRQ/NMI sinks, covered by the same ownership proof,
or mainline `c64.audio.*` ticks. A mainline tick cannot run during the blocking call, so it is
quiescent by construction; no `c64.audio.stop` API is added in this slice. A user-authored player
that installs its own asynchronous route is covered by the IRQ/NMI proof; an external or unknown
route rejects.

The proof reuses the existing semantic ownership model; it does not create a second ownership
model. C64U DMA is not part of this profile.

### Diagnostics

| Condition | Identity | Detail |
| --------- | -------- | ------ |
| Resident use of a loadable value | E10274 | Existing message and declaration relation |
| Destination/profile/quiescence failure | E10275 | Unit, destination, exact failed rule, one remedy |
| Unsafe read after failure/mutation/join/alias | E10276 | Read span plus load and blocking fact spans |
| Unknown/partial profile | E10279 | Existing profile list |

The E10275 reason must name the loadable declaration, logical type/size, destination interval,
active route or conflicting owner, selected profile, and one direct remedy. The E10276 message must
identify the read, the governing load, and the mutation/join/failure/alias edge that blocks proof.

## Integration Points

| Stage | Use |
| ----- | --- |
| Frontend analysis | Accept the capability only on the D64 profile; resolve unit and destination |
| Flow analysis | Produce `LoadCapture`; credit true edges; invalidate false edges |
| Whole-program | Add the operation's unit and effect to reachability |
| Machine lowering | Consume the evaluated destination and unit identity |
| Storage | Prove no interrupt route is active; prove loader temporaries do not overlap |
| Layout | Map every candidate to a physical interval and check constraints |
| Evidence | Record destination calls, publication points, and aliases |

## Error Handling

| Error case | Handling | AR Ref |
| ---------- | -------- | ------ |
| Unit argument is not loadable | E10275 naming the supplied value | AR-P2 |
| Destination is not mutable/fixed | E10275 with the exact form | AR-P3 |
| Destination set is not finite/provable | E10275 with the failed candidate | AR-P3 |
| Load on a PRG profile | E10275 with the selected profile | AR-P2 |
| Active/unproved user route | E10275 with the route and remedy | AR-P5 |
| Read after false/mutation/join | E10276 with related spans | AR-P4 |
| Destination end beyond `$10000` | E10275 before emission | AR-P21 |

## Testing Requirements

- Specification tests for every accepted and rejected destination form.
- Flow tests for success, failure, joins, loops, retries, stored results, and all alias classes.
- Quiescence tests for each recognized IRQ/NMI/audio route.
- Exact diagnostic message/span/related tests for E10275 and E10276.
- One-evaluation tests for the destination expression.
