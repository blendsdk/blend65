# Proof and consumer design

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-2–AR-9. Requirements: R-1–R-7.

## Ownership and signatures

One focused helper `packages/compiler/src/machine/sprite-publication-proof.ts` owns the bounded
counter/provenance/publication queries and anonymous selector. Its internal APIs are not compiler
package exports. The existing observer module owns this additional internal record:

```typescript
interface ByteCapturePublicationProof {
  readonly program: WholeProgram;
  readonly source: SemanticFunction;
  readonly writes: ReadonlySet<MemoryWriteOperation>;
}
```

Planned helper signatures:

```typescript
boundedCounterLoads(
  source: SemanticFunction,
  counter: BindingId,
  limit: bigint,
  mayAliasLocals: (operation: SemanticOperation) => boolean,
): ReadonlySet<LoadOperation>;

proveSpritePublications(
  input: MachineLoweringInput,
  source: SemanticFunction,
): ByteCapturePublicationProof | null;

selectAnonymousComparisonValues(
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
  materializedValues: ReadonlySet<string>,
): ReadonlySet<string>;
```

Extend `hasUnobservedByteCapture` with an optional `ByteCapturePublicationProof`. An absent proof
preserves the exact existing result. A proved publication is exempt only when program, source,
body and operation identities match, and the body is exclusively mainline, not asynchronous.
All other raw/typed/platform/escape checks execute unchanged. The named-source reload adapter does
not receive this proof. A stale record cannot exempt a write in a replacement source or program.

## Bounded counter property and feasibility

For one nonescaping private unsigned byte root and one positive source comparison limit `L <= 255`,
track only `Unknown`, `Below` (`0 <= value < L`) and `PositiveBelow` (`0 < value < L`). An absent
edge is unreachable, **not Unknown**. No general interval, concrete value enumeration, loop-trip
count or multidimensional path-state combination is introduced.

Start only the actual function entry at Unknown. Visit newly reachable successors and requeue an
edge only when its joined fact changes. The ordering is unreachable < PositiveBelow < Below <
Unknown, with a fixed entry seed. Every transfer is monotone, so finite CFG edges and this finite
height prove termination without an iteration cap. Record facts for actual load-operation objects
only after convergence; do not accumulate transient first-iteration observations.

| Operation / fresh outgoing condition                        | Transfer                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| Constant store `c`, `0 <= c < L`                            | Below for zero, PositiveBelow otherwise                     |
| Store `root + 1`                                            | Unknown until a subsequent real guard establishes a bound   |
| Store `root - 1`                                            | Below only from PositiveBelow, otherwise Unknown            |
| Other root store or possible aliasing effect                | Unknown                                                     |
| Fresh `root >= L` false edge (or exact reversed comparison) | Below                                                       |
| Fresh `root == 0` true edge                                 | Below                                                       |
| Fresh `root == 0` false edge                                | PositiveBelow from Below/PositiveBelow, otherwise Unknown   |
| Join                                                        | Least upper fact covering every **reachable** incoming edge |

Use actual semantic definitions, byte widths, literal conversion semantics and operation order.
The comparison must read the current root: a stale captured load or any intervening write/alias
cannot refine current storage. Unsupported comparisons retain facts without inventing a bound.

For the actual checked workload, entry writes zero. The unchanged-tick arm preserves Below. The
forward arm temporarily becomes Unknown, then its false `<4` continuation is Below and its true
arm stores zero. The reverse zero arm stores three; the nonzero arm is PositiveBelow before
subtracting one. Every path into publication and the loop backedge is therefore Below. The guard
load after increment is not certified. This is a direct inductive proof of the actual scalar
property, not a promise that the old maxima query already infers it.

## Asset-relative values

Index definitions and root stores once. Resolve only constants, width-preserving conversions,
actual certified counter loads, nonnegative bounded scalar addition/multiplication and a sprite
block selected from the whole exact immutable resident asset. Preserve an asset anchor separately
from an offset; an upper bound is never an address. Reject two-anchor arithmetic, negative or
unproved wrapped offsets, unsupported operations and ambiguous asset identity.

A mutable helper root may use the join of all its supported stores only when one real supported
store dominates every load and the root is private/nonescaping. Prove this by intra-block ordering
or existing CFG reachability with the initializer block removed; no source-position or naming
heuristic. All store dependencies must resolve; cycles fail closed except the separately certified
counter loads. Memoize per actual value/root, with a visiting set for cycles.

For each pointer, require `(maximumOffset + 1) * 64 <= asset.bytes.length`, complete 64-byte extent,
and the existing sprite-block asset construction/whole-bank placement contract. This also proves
the final pointer does not wrap a bank. Source-selected data is that immutable asset, whose
conflict-checked interval cannot overlap a function temporary. Do not substitute raw numeric
pointers for asset provenance or cancel a layout obligation against an unproved address.

## Publication closure

Admit only the four cooperative PRG profiles and one actual reachable, call-free exclusively-main
source owner, with no executable initializer or generated interrupt writer. Source blocks and
operations must belong to that exact program; transformed/stale replacements do not inherit proof.
Private roots cannot be parameters, globals, indexed places or exposed by addresses/borrows.

Reuse the selected startup's bank-zero/default-screen contract. Reject source bank, screen, mode,
CPU-port or opaque platform changes, including register mirrors. For a publication exemption,
allow only fixed default-screen sprite-pointer stores proved asset-relative and fixed sprite-enable
stores with a literal mask. Other publication effects retain the veto.

Every pointer store must be proved, even before a sprite is enabled. Track a must-initialized
eight-bit slot mask through the actual reachable CFG: OR the slot after each proved pointer store,
join with AND, start at zero. At every enable write, its literal mask must be contained in the
incoming initialized mask. An unreachable predecessor is not an uninitialized reachable path.
This finite mask query is solely initialization checking, not a general hardware-state engine.

All explicit raw reads and ordinary raw writes must have fixed footprints disjoint from the full
admitted SFA windows; dynamic/indexed/aliasing routes retain ordinary lowering. This stronger bounded
condition makes the existing whole-program observer query capture-independent: call it once for
the first candidate, then reuse that result only for other candidates independently proved to have
the same fixed/disjoint byte-read contract. Do not add per-read repeated whole-program scans.
Unknown typed global/parameter writes or opaque effects cannot hide a pointer/configuration change.

Direct SFA disjointness does not exclude firmware-mediated aliases. Under AR-P11, decline source
writes below `$0800` except the exact eight default sprite-pointer bytes, and decline raw CIA writes
across `$DC00–$DDFF`. Check every written byte, including mirrors, word crossings and wraps. These
are conservative eligibility barriers, not claims that every such write is harmful. Reads remain
unchanged. The new selector always requires the complete certificate, even with an empty publication
set, so helpers or executable initializers cannot bypass these barriers through the default observer.

## Anonymous consumer

Index operation and terminator uses once, including branch conditions omitted by the old
single-use helper. The exact raw byte result must have one use: the immediately following machine
operation is byte equality/inequality with a literal byte on the right. Skip only proven code-free
constants/conversions. The comparison result has one terminal branch use in that block and no
materialized use. No store, call, address setup, extra load, wider/signed/runtime operand or CFG
edge may intervene.

Return only the producer value IDs. `lower-function.ts` unions them with existing forwarding before
constructing lowering state. The existing memory-read lowerer emits the original access and retains
the byte only when not proved current. Existing comparison lowering keeps EOR; the store/reload pair
alone disappears. The original flags, X/Y, D/I, ABI and volatile access remain unchanged.

## Failure, scale and completion boundary

Every unsupported or incomplete case returns an empty set/null and the original correct lowering,
not a source rejection. Derive facts once per actual source, index definitions/uses/stores once,
cache bound/provenance queries and keep both finite dataflows monotone. Avoid repeated prefix scans
or recursion proportional to source chain depth; use an explicit stack when walking long chains.

AR-P12 groups initializer candidates by block and checks earliest store/load order once. A block's
reachability traversal is shared by its candidates and discarded afterwards; retain only root
outcomes, never one reachable-block set per initializer. Both worklists join incrementally and
requeue only when the joined input changes, bounding replays by the finite property/mask height.

Before implementation, preflight must independently validate the counter induction, initialization
join, whole-asset layout guarantee and complete observer handoff. If any needs a general interval,
interprocedural, full hardware-state or broader path engine, stop under AR-1 rather than add it.
No new source restriction, hidden state byte, function home, runtime, pass, dependency or `none`
policy change is permitted. ST cases are owned by the testing strategy, not duplicated here.
