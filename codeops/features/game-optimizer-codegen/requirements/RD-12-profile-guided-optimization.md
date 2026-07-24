# RD-12: Deterministic Profile-Guided Optimization

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-03–RD-11
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Use reproducible VICE workloads to identify real hot paths in scrolling, sprite, sound and game-loop
code. Profiles guide inlining, cloning, layout, allocation and selection but never authorize an
unsafe transform; static optimization remains a complete safe fallback.

## Functional Requirements

### Must Have

- [ ] Define a closed `PgoProfile` schema binding compiler/program/workload/target, VICE/tool revision,
  memory map, completion condition and instrumentation revision. (AR-13, AR-21)
- [ ] Collect block/edge/routine counts and declared frame/IRQ timing observations under bounded
  deterministic workloads.
- [ ] Quantify and cap instrumentation perturbation; reject profiles whose perturbation exceeds the
  workload contract.
- [ ] Normalize and merge parallel/profile shards deterministically with checked counters.
- [ ] Reject stale, mismatched, partial, duplicate or unsupported profile input before optimization.
- [ ] Use profile weights only for cost/profitability/layout/allocation decisions; semantic
  preconditions remain profile-independent.
- [ ] Support fresh static fallback when a profile is missing, invalid or outside its target.
- [ ] Compare PGO against the same static baseline and reject cold-path/hard-budget regressions.
- [ ] Preserve exact profile/replay identity in every cost and assurance record.
- [ ] Provide workload coverage reports showing unexecuted routines/edges.

### Should Have

- [ ] Support profile-stable hot/cold specialization under bounded code growth.
- [ ] Allow multiple named representative workloads with explicit weighting.

### Won't Have

- Runtime JIT/adaptive optimization on the C64.
- Profiles derived from uncontrolled wall-clock sampling.
- Using absent execution counts as proof code is unreachable.

## Technical Requirements

PGO profiles use saturating/checked 64-bit counters and stable symbol/edge IDs independent of final
addresses. Collection runs in isolated emulator processes with instruction/step/output/time limits.
Merging sorts canonical identity before aggregation.

## Integration Points

- RD-04/RD-06/RD-08/RD-11 consume weights.
- RD-13 defines timing workloads.
- RD-14/RD-15 require profile-independent correctness and game acceptance.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Feedback source | Versioned VICE workloads | AR-13 |
| Authority | Profitability only, never correctness | AR-5, AR-13 |
| Missing/stale input | Safe static fallback | AR-13, AR-21 |

## Security Considerations

Profile inputs are size/depth/count bounded closed data. Paths are repository-relative and
canonical. VICE arguments are arrays, output is capped, timeouts terminate process groups, and
profiles contain no environment or arbitrary host data.

## Acceptance Criteria

1. [ ] Two fresh runs of a deterministic workload produce identical normalized counts within the
   declared instrumentation model.
2. [ ] Program, compiler, workload, target, VICE and instrumentation revision mismatches are each
   rejected distinctly.
3. [ ] Two shard merge orders produce byte-identical aggregate JSON with checked totals.
4. [ ] A hot loop guides a profitable layout/allocation choice while an unexecuted edge is not
   deleted without static reachability proof.
5. [ ] PGO output and static output agree with the same independent semantic oracle.
6. [ ] Missing/invalid profiles produce the documented static pipeline, not partial PGO.
7. [ ] Instrumentation perturbation above the workload's cycle tolerance invalidates the profile.
8. [ ] PGO cannot violate a cold-path size, stack, RAM or IRQ-latency hard budget.
9. [ ] Coverage reports enumerate every routine/edge absent from the workload.
