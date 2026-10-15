# Source facts

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P1–AR-P4; frozen Chapters 02, 04, 06, 08, 11 and 15; RD-08 R8.13/R8.16/R8.17/R8.21/R8.38–R8.40

## Ownership and interfaces

Use the existing `WholeProgram`, `SemanticPlace`, `SemanticPosition`, `ValueId`,
`BindingId` and execution-context identities. Add focused internal modules:
`semantic/closed-object-facts.ts`, `semantic/local-storage-lifetimes.ts` and
`semantic/fixed-loop-facts.ts`. Reuse `aggregate-place-proof.ts`, guarded use-site
bounds and existing value lifetimes; no new IR, abstract alias framework or pass
registry. Types/queries are immutable and source-associated.

Planned internal entry points:

```ts
/** Derive finite whole-object origins and conditional observer obligations. */
deriveClosedObjectFacts(program: WholeProgram): ClosedObjectFacts;
/** Derive exact private binding lives; retain conservative lives when unproved. */
deriveLocalStorageLifetimes(program: WholeProgram): ReadonlyMap<string, ValueLifetime>;
/** Recognize the source's canonical finite induction without changing its type. */
deriveFixedLoopFacts(program: WholeProgram): readonly FixedLoopFacts[];
```

The maps use declaration/context keys, never names or physical addresses. A
`ClosedObjectFacts` entry records the call operation/parameter, unique symbolic
root and exact packed type, source read/write/escape sites, stability interval,
and outstanding final-observer obligations. No pending obligation is a valid
certificate. A `FixedLoopFacts` entry records owner/header/body/update/exit IDs,
counter binding/type, initial value/domain, invariant bound, unit stride, exact
trip domain, break/continue/return paths, and live-out/observer obligations.
Selected representations belong to 03-02, not these source facts.

## Whole objects and effects

Recognize only typed fixed whole-object actuals and their direct parameter
forwarding; every relevant caller must agree on the root and type. A returned
aggregate's selected destination must already be evaluated once and have a
unique actual identity. Derive origins through the finite direct graph, including
ordinary direct call-result/return forwarding to the same outer destination.
Early-publication proof spans the outer call's original publication point, not
just the innermost return. Unknown,
differing, escaped, address-taken callable or opaque routes keep generic ABI;
do not clone functions or add call dispatch. A readonly parameter does not prove
object stability, safe RAM or unobservable publication.

Check initialization, every reachable source write/borrow/call, recognized
handler variants and retained platform effects. Raw memory footprints use exact
literals or already proved finite unsigned ranges, include widths/wrap, and stay
symbolic until final layout. Unsupported derivation is unknown, not a guessed
address. A captured byte can be reloaded only if every possible intervening
mutation/alias/interrupt is excluded. Direct construction additionally proves
the caller destination cannot be observed before the original return/copy point.

The current consumers are fixed-object query addressing, joystick's retained
sample and acquisition's caller-owned destination. Raw `$C100..$C104` and saved
`$C110..$C11A` are ordinary source footprints, not trusted compiler constants.

## Local storage lifetimes

Run binding-level backward dataflow over reachable source CFG positions. Loads,
addresses, escaped borrows and source-visible observations generate liveness;
an exact whole-binding store kills only the previous private value after its
RHS evaluation. Joins union successor obligations; backedges reach a fixed point.
Partial/member writes and unsupported aliases do not kill the whole root.
Address-taken or asynchronously observed bindings keep conservative lifetime
unless the existing borrow/domain proof closes them.

Value liveness is not physical occupancy. Include each surviving whole/member
write at its source position, even when the assigned value has no later use;
conflict that home with every value whose contents must survive the write.
Keep root-level occupancy for partial writes; no sub-field coloring is introduced.
RHS reads/staging precede the kill/write. Extend a load's backing home through
its existing ValueId consumer window, including identity/cast forwarding when
lowering can defer the physical read. Do not stop occupancy at the semantic load.
The selected recipe may remove an access obligation only with an explicit proved
elision or materialization; otherwise use the conservative potential-access map.

Every retained incoming parameter, hidden destination and count marshal occupies
the callee's existing entry position `(fn.entry, 0)` as a conservative common
write group. Incoming values which must survive later marshal writes cannot
share a home. Keep whole-function lives where this entry/use mapping is unproved;
an unused parameter never acquires an empty life while its marshal remains.
This uses existing positions, not synthetic IR operations or a new ABI.

Call-crossing demand includes values live through the actual call and the backing/
staging values still needed by argument delivery. Preserve pre-JSR delivery
conflicts even for arguments whose last source use is that call. Later result
writes may share dead helper homes only after the helper returns. Feed these
access-complete lives into inventory and source/helper interference; validate
that every selected actual read/write is covered before allocation freezes.
An uncovered access invalidates the recipe, never silently narrows its life.
Domain/activation-root masks remain binding; a lexical loop local
does not escape its dynamic incarnation. The finite lattice is subsets of
existing binding/position pairs; termination is monotone addition, not a round
limit. Cache body definition/use indexes once per analysis, not per query.

## Canonical induction

Match the existing three-clause CFG: one initialization, one header condition,
body and designated update/backedge. First qualify unsigned unit-increment
word counters with invariant literal bound at most eight, plus nested start
`outer + 1` whose proved domain is 1..8. This is a generic source-shape rule,
not an input-name or address match. Unsupported bounds retain generic lowering.

Prove initializer/condition/body/update order, all iterations, exit value,
nonwrapping progression, side effects and counter reads. `continue` reaches the
update; `break`/return bypass it. A narrower machine representation requires
every live value reconstructible, including a visible word live-out, or selects
the original word home. An address-taken counter, unknown body write or wider
range is not narrowed. Recognition never deletes a source condition or changes
the type/signedness/check policy. Optional straight-line expansion is only the
proved exact-eight-trip body and keeps each volatile access and source range.

## Fact validity

Attach source/program identity and execution context to every fact. Origin
propagation uses finite root sets and direct graph edges; ambiguous roots become
unknown. Each rebuild/rewrite recomputes affected facts from unchanged source
identities. Late layout validation cannot repair an invalid semantic proof.
Missing applicability yields the existing correct path. Malformed/stale internal
facts are a compiler invariant failure with no artifact, not a new language error.

Tests: ST-4–ST-16 and ST-29 in [07](07-testing-strategy.md).
