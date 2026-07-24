# RD-03: Pass Manager, Execution Profiles and Lifecycle

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-01, RD-02
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Make optimizer composition explicit, attributable and replayable. The pass manager distinguishes
analyses, legalizers, allocation/layout phases and skippable optimizations; it supports reference,
isolated, prefix and full profiles without exposing arbitrary pass order as a public language
contract.

## Functional Requirements

### Must Have

- [ ] Publish a closed content-addressed pass manifest containing stable ID, contract version,
  implementation revision, phase, kind, prerequisites, invalidations, objective compatibility,
  effect contract and skippability. (AR-8)
- [ ] Reject unknown, duplicate, cyclic, misordered or contract-incompatible pass declarations.
- [ ] Define `reference`, `isolated`, `prefix`, `full` and public optimized/unoptimized execution
  profiles under a separate content-addressed execution identity. (AR-18)
- [ ] Keep mandatory legalizers enabled in reference/unoptimized profiles and identify them
  separately from cost-improving passes.
- [ ] Trace every pass invocation, input/output digest, changed unit, application count and cost
  delta without logging full user source by default.
- [ ] Provide deterministic first-failing-prefix bisection and non-monotonic pass-set reduction.
- [ ] Enforce lifecycle `proposed → experimental → assured → default-enabled → retired`; only
  assured passes may become default-enabled. (AR-23)
- [ ] Inventory current `threadJumps`, `removeUnreachableBlocks`, peephole stage and branch
  relaxation before issuing the first feature claim.
- [ ] Publish manifests atomically; readers see either the prior complete manifest or the new one.
- [ ] Retain public `--optimize`/`--no-optimize` behavior while keeping arbitrary pass selection in
  an internal/test developer surface.

### Should Have

- [ ] Support deterministic before/after snapshots for explicitly selected failing units.
- [ ] Cache analysis results with declared invalidation rather than recomputing blindly.

### Won't Have

- User-defined pass plugins in the first C64 release.
- Public arbitrary pass ordering.
- Silent fallback from a missing pass revision to the current implementation.

## Technical Requirements

```text
ExecutionIdentity =
  CaseIdentity
  + compiler revision
  + target/CPU/tool revisions
  + manifest digest
  + profile schema/version
  + ordered pass/invocation revisions
  + optimization objectives and hard budgets
```

Reference means “candidate optimizations disabled,” not “illegal code allowed.” Prefix numbering
is stable through the last enabled invocation. Interaction reduction may search non-prefix subsets
after prefix bisection identifies the first observable failure.

## Integration Points

- RD-02 supplies effect and analysis invalidation contracts.
- RD-14 consumes profiles for semantic validation and failure reduction.
- RD-16 exposes stable reports without exposing unsupported tuning.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Pipeline source of truth | Content-addressed manifest | AR-8 |
| Failure profiles | Reference/isolated/prefix/full | AR-18 |
| Rollout | Five-state assured lifecycle | AR-23 |

## Security Considerations

Manifest/profile input is closed, byte/depth/count bounded and allowlists IDs, phases, objectives
and paths. Debug snapshots live beneath a canonical allocated root. No manifest field selects a
host module, command or arbitrary output path.

## Acceptance Criteria

1. [ ] The same manifest content produces the same digest and total order in two fresh processes.
2. [ ] Duplicate IDs, a dependency cycle, an optimizer before its required analysis and an unknown
   phase each fail validation before any pass runs.
3. [ ] Reference profiles retain branch legalization while excluding every skippable candidate.
4. [ ] An isolated profile contains exactly the named pass plus its declared minimal dependency
   closure.
5. [ ] Prefix bisection identifies the first failing invocation in a seeded ordered failure with at
   most `ceil(log2(n))+1` profile executions.
6. [ ] A seeded two-pass non-monotonic failure is reduced to the required pair after prefix
   bisection.
7. [ ] A missing exact pass or manifest revision returns `replay-incompatible`; it never loads the
   current version.
8. [ ] An experimental pass cannot appear in the production default manifest.
9. [ ] An atomic-publication crash leaves the previous manifest readable and no partial manifest
   selectable.
10. [ ] Every pre-existing transform is classified as analysis, legalizer, optimizer or
    allocator-layout before the first commercial assurance report passes.
