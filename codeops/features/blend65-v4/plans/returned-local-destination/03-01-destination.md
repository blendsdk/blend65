# Destination proof and binding

> **Parent**: [Index](00-index.md)
> **Decision**: [AR-1](00-ambiguity-register.md)

## Whole-function eligibility

The correction is an optional proved binding in existing stages, not a new
optimization pass. Failure of any condition returns no certificate and leaves
every operation, home and copy on the current path. It adds no source error.

1. Select one exact fixed aggregate local. Every reachable return must deliver
   that same complete root, without aggregate merges, alternative returned
   objects or caller-result forwarding.
2. Require one fully covering effect-free constant initializer in the entry
   block before its first control split and before any use of that local.
   Recursively count explicit fields/elements and legal fill coverage. Purity
   alone is insufficient; a partial array keeps the fallback. Later scalar
   reads/writes and contained field/index updates remain ordinary operations.
3. Inventory all uses of the root, including construction/call destinations and
   value-use chains. Only the initializer's completed same-root store, contained
   loads/stores, and addresses consumed solely by complete terminal returns
   qualify. A borrow/aggregate argument, raw address, address fragment, capture,
   merge or unknown consumer disqualifies the whole function. Non-retention
   alone does not prove address identity unobservable.
4. Prove each complete accessed interval within the packed root. Reuse bounded
   exact-literal and nonnegative constant-mask facts; include field offsets,
   nested strides and the final byte/word width. `column & 7` may prove an
   eight-byte row index. A declared array extent never proves a runtime index.
   No range, branch or interprocedural solver is introduced.
5. Inventory all actual reachable call sites, including initializer contexts.
   Require stable direct calls and a whole fresh private local declaration
   destination selected before entry. An origin marker is evidence of the new
   local lifetime, not the full proof. Reject existing-object assignment,
   borrowed/global/subobject/forwarded results, self-aliasing argument sources,
   absent origin, canonical/address-taken entries and indirect entry. If one
   call is unproved, retain the entire callee; do not specialize its other calls.
6. Prove no relevant observer can see either object identity or intermediate
   construction. Check the function's reachable ordinary callees/helpers and
   feasible generated asynchronous paths using existing call/domain facts.
   Known ordered MMIO can remain eligible only with its exact device footprint
   disjoint from SFA and no hardware-RAM publication. Unknown raw addresses,
   unproved calls/platform effects and possible hardware-RAM observers cause
   fallback. Do not treat `opaque` as synonymous with harmless fixed MMIO, or
   claim that I excludes NMI. No new external stack or firmware guarantee follows.

These conditions are intentionally conservative. Calls that use the completed
result later, including ordinary borrowed queries after return, are not early
observers merely because they use its address later. They must not be made
illegal. During-call alias/lifetime and existing SFA interference still hold.

## Small retained facts

In the existing place destination, add an optional `freshLocal?: true` origin
attribute for a fixed aggregate declaration initializer. It must not change
`freshConstant` or its existing consumers. Propagate it through the current call
destination; it grants no elision on its own.

Retain the successful proof as an optional list in `WholeProgram`, keyed by
source function and returned local binding. Suggested internal shape:

```typescript
interface ReturnedLocalDestination {
  readonly function: BindingId;
  readonly local: BindingId;
}
```

The list is produced only after actual roots/calls/contexts are closed and before
SFA inventory. No public service, evidence schema, operation kind or runtime
record changes. Missing proof means the existing path. Machine consumers receive
the same immutable fact through their existing whole-program input. Any existing
domain variant may reuse it only with its certified destination/home mapping;
no destination-specific variant is created.

During implementation, prepare proof and consumers without publishing the
production certificate. Publish it and omit the matching local only after all
root, construction, store and terminal-return consumers are ready. This is task
ordering, not a new runtime or activation mechanism; every intermediate green
checkpoint retains the existing path.

Use one focused `semantic/returned-local-destination.ts` helper for the bounded
eligibility walk. Extract only the literal/mask/footprint/observer routines that
both it and `reachable-globals.ts` need into a small
`semantic/aggregate-place-proof.ts`; preserve their existing behavior and callers.
This is shared code, not a generalized proof framework. Memoize per-body facts
and traverse definitions/call sets iteratively; do not clone instruction
prefixes or repeatedly walk the whole program per operation.

## Root and construction consumers

SFA inventory omits only the proved redundant complete local request. Keep the
caller's final object, hidden destination pointer, necessary live scalars and
all nested-call/helper interference. Other local inventory is unchanged.

Root lookup must explicitly recognize the certified root before its existing
direct-home/global fallback. Resolve its base through the existing hidden return
pointer and classify it as indirect. Every member/index load/store and complete
initializer construction uses that base. Never write packed result bytes into
the pointer's two-byte home or form a global label for the removed local.

Preserve nested constant construction directly in that destination, with exact
child offsets and full coverage. Extend the existing completed-child proof only
for this certified same root; do not fall back to a new child object/copy merely
because the destination is indirect. Page-crossing construction must restore
the base before subsequent field accesses or terminal use. Any scratch required
by existing address selection returns through normal SFA closure.

Recognize the initializer's completed same-root store as already delivered. Each
proved terminal root value is already in the caller result; omit its source
pointer materialization and both straight-line/loop copy delivery. This must not
elide source-visible address uses or unrelated returns. Leave all noncertified
functions and their current safe copy paths unchanged.

## Verification and stop boundaries

The two independent oracles in [07](07-testing-strategy.md) are mandatory.
Actual code, pointer/address setup, spills, padding and resident totals may
change; measure them, including caller, startup and restore, rather than
subtracting eleven bytes from an assumed total. Observe volatile accesses on
their source paths and relevant ABI/status/interrupt state. No selected timing
contract is weakened, no new masking or retry is inserted.

The ordinary witness must show net byte/cycle improvement with no hidden storage
growth. The selected PA-only acquisition source needs its own eligibility and
net-cost assessment. If indirect access replaces the copy with worse work, or
if the selected source needs per-call variants/extra proof machinery, stop under
AR-1. Do not add a general profitability framework or enlarge the correction.
The analytical full-body target in upstream discovery includes separate debts
and is not this task's promised result.

Normative lineage: `sfa-and-abi.md#abi-contract` and `#final-storage-closure`,
`blend65-semantics.md#semantic-preservation-checklist`,
`il-and-optimization.md#memory-effects-and-volatility`,
`6502-lowering-casebook.md#aggregates-copies-and-layout` and
`evidence-parity-and-recovery.md#transformation-proof`; expert `2.0.4`/content
`0e2a6280`; BLEND65-SPEC-4-038b70e9, MOS-PGM-1976 and ACME-097-R266.
