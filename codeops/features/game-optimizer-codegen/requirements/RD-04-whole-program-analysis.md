# RD-04: Whole-Program Analysis, Specialization and Internal ABI

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-02, RD-03
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Exploit Blend65's AOT, statically allocated program model across routine boundaries. Build a closed
call/effect graph, propagate constants and contexts, specialize/inine within budgets, choose
internal calling conventions and delete unreachable routines/runtime support.

## Functional Requirements

### Must Have

- [ ] Build a deterministic whole-program call graph with explicit roots for startup, exports,
  interrupts, address-taken routines, indirect targets and platform callbacks. (AR-9)
- [ ] Compute content-revisioned summaries for arguments/results, constants/ranges, side effects,
  aliases, clobbers, recursion, interrupt reachability and cost.
- [ ] Propagate constants/ranges and effect facts across direct calls to a fixed point.
- [ ] Specialize routines for profitable constant arguments, target CPU and calling context under
  deterministic code-growth budgets.
- [ ] Inline when linked whole-program cost improves and semantic/interrupt/recursion constraints
  hold; never use source-size heuristics alone.
- [ ] Select internal ABIs per call edge or compatible cluster, including register/ZP transfer,
  while preserving stable public/exported/platform ABIs.
- [ ] Eliminate unreachable routines, unused runtime helpers, unused const data and dead
  initialization without removing address-taken/indirect/interrupt roots.
- [ ] Support tail-call conversion where frame, interrupt and ABI constraints prove it safe.
- [ ] Preserve source-level diagnostic attribution through specialization/inlining.

### Should Have

- [ ] Perform bounded function cloning for hot/cold or constant contexts.
- [ ] Reuse summaries incrementally when semantic source and dependencies are unchanged.

### Won't Have

- Speculative devirtualization without a closed target set.
- Unbounded inlining or cloning.
- ABI changes visible to external assembly/platform contracts without an explicit version.

## Technical Requirements

The analysis must handle recursive strongly connected components, module initialization order and
interrupt/mainline interference. A summary is valid only for the exact callee body, effect model,
target and dependent summary revisions.

## Integration Points

- RD-02 provides effects/aliases; RD-03 provides pass identity.
- RD-08 consumes liveness/call interference for allocation.
- RD-11 consumes reachability and call weights for layout/runtime pruning.
- Indirect calls remain an external capability until their language/runtime contract ships.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Scope | Whole-program AOT | AR-9 |
| ABI | Internal specialization, stable external boundaries | AR-9 |
| Growth | Cost/budget governed | AR-15, AR-16 |

## Security Considerations

Call-graph construction accepts only validated symbols and bounded graph sizes. Summary caches are
content-addressed and reject incompatible target/compiler revisions. No external module loading is
performed.

## Acceptance Criteria

1. [ ] Direct, recursive, address-taken, exported and interrupt functions appear with the correct
   root/edge classification in a deterministic call graph.
2. [ ] A constant-argument leaf is specialized only when linked cost improves within the declared
   code-growth budget.
3. [ ] A mutually recursive SCC reaches a deterministic conservative fixed point and is not
   infinitely cloned/inlined.
4. [ ] Removing an apparently unused address-taken or interrupt routine is prevented by its root
   classification.
5. [ ] A private two-call routine may use an optimized internal ABI, while its exported twin keeps
   the stable ABI byte for byte.
6. [ ] Tail-call conversion preserves frame and interrupt-visible state and reduces the measured
   path cost.
7. [ ] Removing the final user of a runtime helper removes that helper's linked bytes.
8. [ ] Changing one callee body invalidates every dependent summary and no unrelated summary.
9. [ ] An unknown indirect call target blocks unsafe propagation without blocking unrelated direct
   call optimization.
