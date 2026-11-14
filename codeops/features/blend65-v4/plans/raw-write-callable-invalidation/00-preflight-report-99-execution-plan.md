# Preflight: #156 direct raw-write callable invalidation

> **Status**: ✅ PREFLIGHT PASSED — bounded direct slice; interprocedural remainder owned by #161
> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Scope mode**: strict
> **Last Updated**: 2026-11-14

Two independent read-only auditors covered soundness (ambiguities, contradictions, consistency,
edge cases) and delivery/testability (completeness, dependencies, feasibility, testability,
ordering, codebase alignment). The plan was rewritten twice after the first audits found that a
path-only kill and a global alias union were unsound or over-broad.

## Findings and resolution

| ID | Severity | Cluster | Finding | Resolution |
| --- | --- | --- | --- | --- |
| PA-001 | Major | Soundness | Path-only kills cannot see packed-field byte overlap, and clearing an ancestor kill can restore still-corrupt children. | Kills are byte intervals; a typed store subtracts only the interval it writes. A crossing word write kills the covered callable; a disjoint byte write does not. |
| PA-002 | Major | Soundness | Raw writes inside callees, borrowed parameters, indirect calls and forwarded actuals could still leave stale proofs. | These routes need interprocedural, call-site-sensitive alias translation. They are explicitly excluded from this bounded slice and owned by [#161](https://github.com/blendsdk/blend65/issues/161); #156 stays open. |
| PA-003 | Major | Soundness | A corrupted value copied and stored back can leave a conservative `UNKNOWN_TARGET` after a later reassignment. | Recovery is limited to a direct reassignment with no intervening corrupted read. The corrupted-copy false rejection is precision debt, not claimed recovery. |
| PA-004 | Major | Soundness | A global alias union across call sites would merge distinct actual objects and falsely reject unrelated writes. | The union-find design was removed. The bounded slice has no cross-call alias merging; the distinct-actual control protects the future slice. |
| PA-005 | Minor | Delivery | The cross-call/startup producers and consumers were not named. | Deferred with PA-002 to #161; the bounded slice names only same-body killed facts. |
| PA-006 | Minor | Delivery | The new oracle's file and tier were not named. | The oracle is a new root integration-tier build-only file; E10277 needs no emulator. |

## Soundness obligations

- Kill the exact written byte interval; restore only the bytes a typed store writes.
- Merge killed-union and assigned-intersection.
- A disjoint field write leaves its sibling callable accepted.
- A branch-only kill rejects the post-join read.
- A raw write before the assignment and a direct reassignment recover.
- No interprocedural, borrowed-alias, indirect-call or runtime-destination claim is made.

## Evidence checked by the auditors

| Area | Evidence |
| --- | --- |
| Assignment flow | `packages/compiler/src/semantic/assignment-facts.ts` `assignmentFlow`, `assignmentFacts`, `definiteExit`. |
| Target proof | `packages/compiler/src/semantic/function-targets.ts` `resolveTargetSets`, unknown reads, final indirect mapping. |
| Raw write IR | `packages/compiler/src/semantic/operations.ts` `memory-write`, `place-address`, `store`, `load`. |
| Diagnostic endpoint | `packages/compiler/src/semantic/whole-program.ts` E10277 emission. |
| Frozen authority | `spec/06-functions.md` §4.3; `spec/evaluations/F018-functions.md`; `spec/07-structs.md` packed layout; `spec/11-memory-model.md`; `spec/03-variables.md`. |
| Test policy | `AGENTS.md` tier policy; `test/test-tiers.ts`; `vitest.integration.config.ts`. |

## Evidence limits

Planning readiness only. No compiler behavior, rejection count, emitted-cost claim or regression
result is asserted before the tasks run. `spec/` and the expressiveness ledger remain untouched.
The interprocedural remainder is not solved by this packet.
