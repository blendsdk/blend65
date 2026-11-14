# Preflight: T-15 partial array construction and T-10 helper callable proof

> **Status**: ✅ PREFLIGHT PASSED — one Major and one Minor finding resolved before execution
> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Scope mode**: strict
> **Last Updated**: 2026-11-13

Three independent read-only auditors covered the thirteen canonical dimensions in disjoint
clusters: soundness (ambiguities, contradictions, consistency), grounding and completeness
(implicit assumptions, gaps, dependencies, codebase alignment), and delivery and risk
(feasibility, testability, security, edge cases, scope creep, ordering). The plan owner merged
their evidence and amended the plan. This is plan readiness, not implementation qualification.

## Findings

| ID | Severity | Cluster | Finding | Resolution |
| --- | --- | --- | --- | --- |
| PA-001 | Major | Soundness, completeness, testability | The two repairs interact. After partial construction is enabled, `let callbacks: (fn(): void)[2] = [&chosen];` followed by `callbacks[1]();` would inherit element 0's target because array indices merge to `index:*` and a whole-object initializer marks the root assigned. Removing the lowering rejection could therefore expose a false singleton call to indeterminate bytes. | The plan now requires aggregate target propagation to mark the merged index path unknown when a partial array omits any callable leaf, and adds specification and implementation cases for the omitted element, dynamic selection, and a fully supplied callable-array contrast. No general solver or per-index proof redesign. |
| PA-002 | Minor | Dependency, ordering | Public compiler imports resolve `dist`, and the build cache identifies compiled output, not edited source. Early reproduction or RED evidence could run against stale output. | The plan now requires a fresh workspace build before baseline reproduction and after every compiler edit before public reruns. |

Both auditors statically traced the counterexample and did not execute it; the task suite must
confirm it. Every other dimension reported no finding.

## Evidence checked by the auditors

| Area | Evidence |
| --- | --- |
| Omitted-element semantics | `spec/08-arrays-strings.md` W10140; `spec/evaluations/F014-arrays.md` Group A and the `[values; fill]` model; `spec/06-functions.md` §4.3; `spec/evaluations/F018-functions.md` target-set boundary. |
| Current rejection | `packages/compiler/src/machine/lower-aggregate-members.ts` `memberWrites`; consumers in `lower-aggregate-build.ts`, `size-observer-captures.ts`, `storage/selection.ts`, `returned-local-destination.ts`, `lower-aggregate-fill.ts`. No consumer requires complete coverage. |
| Call proof | `packages/compiler/src/semantic/function-targets.ts` `assignmentFacts`, `entryAssigned`, `unknownReads`, `UNKNOWN_TARGET`; `packages/compiler/src/semantic/whole-program.ts` E10277 path; `packages/compiler/src/machine/lower-indirect.ts` direct-call selection. |
| Existing negative contract | `packages/compiler/src/semantic/function-targets.impl.test.ts` conditional and multi-caller cases; `packages/compiler/src/frontend/aggregates.spec.test.ts` W10140. |
| Test policy | `AGENTS.md` mandatory tier policy; `test/test-tiers.ts` classification; `vitest.vice.config.ts` serialization; `test/rd05/profile-fixture.ts` and `test/rd05/startup-zero-initializer.spec.test.ts` native observation pattern. |

## Soundness obligations the plan must honour

- Reject an omitted callable element, a dynamic selection that can reach one, a conditional
  assignment, an early return before the write, a write after the call, and two call sites where
  only one assigns.
- Accept a fully supplied callable array and assignment on both branches.
- Keep the `E10277` path unchanged for an erased raw boundary.
- Produce no store for an omitted element and no new ZP, stack or scratch charge.

## Evidence limits

Planning readiness only. No compiler behavior, VICE execution, savings or regression result is
claimed before the tasks run. `spec/` and the expressiveness ledger remain untouched.
