# RD-06: Control-Flow and Loop Optimization

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-02–RD-05
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Optimize branches and loops while preserving termination, effects and 6502 branch geometry.
Commercial game loops require excellent fall-through layout, induction handling and invariant
motion without sacrificing MMIO polling, interrupt interaction or code-size budgets.

## Functional Requirements

### Must Have

- [ ] Simplify branches, jump chains, empty blocks, unreachable blocks and redundant conditions to
  a deterministic CFG fixed point.
- [ ] Canonicalize natural loops and identify irreducible regions conservatively.
- [ ] Detect induction variables, trip-count ranges, loop exits and loop-carried dependencies.
- [ ] Perform loop-invariant code motion only for pure/non-trapping operations whose operands and
  memory versions dominate every use.
- [ ] Strength-reduce induction/address calculations and compare/increment forms to target-cheaper
  idioms.
- [ ] Unroll fully or partially only when trip bounds are proven, effects remain ordered and the
  cost-vector/budget improves.
- [ ] Support loop peeling/unswitching only under deterministic growth limits and measured benefit.
- [ ] Fuse compare-and-branch and choose fall-through/inversion using final layout-aware costs.
- [ ] Preserve busy-wait MMIO loops exactly as required ordered reads; never hoist or merge them.
- [ ] Keep branch relaxation a required post-layout legalizer and prove its fixpoint/termination.

### Should Have

- [ ] Detect countdown and page-walk idioms and choose optimal NMOS 6502 loop forms.
- [ ] Use profile weights from RD-12 when available without changing correctness.

### Won't Have

- Speculative vectorization.
- Unbounded loop cloning.
- Treating a timeout in the oracle as proof a source loop is nonterminating.

## Technical Requirements

Loop transforms consume dominance, effect and range proofs. Costing includes entry/exit/body paths,
branch taken/not-taken costs, page-cross possibilities and code growth. Required source evaluation
and MMIO access order remain invariant.

## Integration Points

- RD-05 provides value/range facts.
- RD-09/RD-11 provide instruction/layout costs and branch geometry.
- RD-13 supplies IRQ/raster timing constraints.
- RD-14 validates termination/effect preservation.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Loop aggression | Proof- and budget-bounded | AR-14–AR-17 |
| MMIO loops | Ordered volatile reads | AR-14 |
| Layout | Cost-aware fall-through + legalizer | AR-11, AR-15 |

## Security Considerations

CFG/loop algorithms use bounded node/edge counts and deterministic worklists. Transform growth is
checked before allocation. Malformed cycles fail structural validation rather than exhausting the
host.

## Acceptance Criteria

1. [ ] Jump threading and unreachable removal reach identical output in two fresh runs regardless
   of map insertion order.
2. [ ] A countdown loop at 0, 1, 255 and 256 iterations preserves exact iteration count and final
   state through all profiles.
3. [ ] Loop-invariant pure arithmetic hoists once; an aliasing read, MMIO read, call or potential
   termination stays inside the loop.
4. [ ] Full/partial unrolling is rejected when it violates code-size, frame-cycle or IRQ-latency
   budgets.
5. [ ] A raster-poll loop retains one volatile read per iteration and its emitted poll body meets
   the committed expert twin.
6. [ ] An irreducible CFG remains correct and produces a classified “not transformed” reason.
7. [ ] A branch-inversion transform exchanges successors and preserves behavior for true/false
   inputs.
8. [ ] Relaxation resolves mutually displacing out-of-range branches to a stable legal program or
   emits a deterministic ICE at its iteration bound.
9. [ ] Seeded off-by-one, wrong-successor and hoisted-volatile mutations are each killed by immutable
   specification tests.
