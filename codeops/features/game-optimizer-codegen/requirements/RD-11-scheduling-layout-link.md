# RD-11: Scheduling, Code Layout and Link-Time Optimization

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-03–RD-10
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Order instructions, blocks, routines, data and runtime sections using exact dependencies, hotness
and resolved geometry. Remove avoidable transfers, keep hot paths contiguous, satisfy branch
ranges, reduce page-cross costs and prune the linked program to what is reachable.

## Functional Requirements

### Must Have

- [ ] Build instruction dependency graphs including data, flags, memory/effects, volatile order and
  target-specific hazards.
- [ ] Schedule within basic blocks to reduce transfers/reloads and improve hot-path cycles without
  increasing the active cost objective.
- [ ] Choose block order/fall-through/branch inversion using edge weights and final branch costs.
- [ ] Thread jump chains, remove unreachable blocks and elide trailing jumps at a deterministic
  fixed point.
- [ ] Place routines and const data using call/access weights, alignment, page-cross penalties,
  branch geometry and memory-region constraints.
- [ ] Run branch relaxation as a required legalizer after every geometry-changing stage until a
  stable legal layout exists.
- [ ] Prune unused routines, runtime helpers, platform intrinsics, data and sections from the final
  link.
- [ ] Re-evaluate layout-dependent selector/allocation alternatives when page/ZP/address facts
  change the winner.
- [ ] Preserve exported labels, VICE symbols, source mappings, directives and relocation identity.
- [ ] Report unavoidable padding, long branches and cold/hot conflicts.

### Should Have

- [ ] Partition hot/cold blocks/routines where memory-map and debugging contracts permit.
- [ ] Co-locate frequently interacting code/data while respecting hardware regions.

### Won't Have

- Non-deterministic profile-order layout.
- Removing externally/address-taken reachable symbols.
- Treating assembler success as proof of semantic correctness.

## Technical Requirements

Layout search uses deterministic tie-breaking and bounded iterations. Every candidate is assembled
or geometrically validated before acceptance. Relaxation insertions carry explicit generated-label
identity so later corpus invariants can distinguish required branch-over-jump forms.

## Integration Points

- RD-04/RD-12 provide reachability and weights.
- RD-07/RD-08/RD-09 provide placement/allocation/selection alternatives.
- RD-13 imposes frame/IRQ timing constraints.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Geometry | Post-selection iterative layout/legalization | AR-8, AR-15 |
| Scheduling | Dependency/effect safe | AR-7, AR-14 |
| Link pruning | Whole-program reachability | AR-9 |

## Security Considerations

Layout/address arithmetic is checked and region constrained. Generated labels use collision-proof
names. Iteration and candidate counts are bounded; failure emits no partial binary.

## Acceptance Criteria

1. [ ] A hot true/false branch orders the selected path as fall-through when it lowers exact path
   cost and exchanges the branch condition/targets correctly.
2. [ ] Every avoidable trailing jump/jump-only trampoline is removed; required relaxation
   branch-over-jump shapes remain.
3. [ ] Mutually displacing branches converge to a legal stable layout within the declared bound.
4. [ ] Hot layout reduces or preserves page-cross penalties and active objective cost; a worse
   candidate is rejected.
5. [ ] Removing the last call to a runtime helper removes its code/data from the linked image.
6. [ ] Exported, address-taken, interrupt and platform-entry symbols survive pruning.
7. [ ] VICE/source-map labels still resolve to the correct final addresses after reordering.
8. [ ] Two identical weighted inputs produce byte-identical assembly, symbol map and binary.
9. [ ] Every final linked section respects C64 memory regions and no overlap/overflow is possible.
