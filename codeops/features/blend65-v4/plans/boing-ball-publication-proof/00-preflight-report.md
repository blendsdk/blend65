# Preflight: bounded sprite-publication proof

> **Status**: PASSED — one minor finding resolved; no unresolved findings.
> **Iteration**: 2, bounded sequencing fix and direct-consequence verification.
> **Audit target**: the seven planning documents listed by `00-index.md`, not this report.
> **Initial target content hash**: `33d66d05a2c4b1013cc9c4c605e6c367749082f4b4295c11f6f5787a112b1289`.
> **Date**: 2026-11-16

The primary authored this plan in the current session. Five independent reviewers supplied the
complete dimension partition below. The primary merged findings, checked the sole correction and
its consequences across all dimensions, and obtained an independent fix check from the delivery
reviewer. The final metadata/status changes are derived bookkeeping, not new behavior or scope.

## Context and feasible boundary

TypeScript compiler with semantic CFGs, existing source/domain/raw observer checks, immutable
resident assets, pre-emission register selection and conflict-checked C64 layout. No new public
API, host invocation, parser, IR, pass, runtime, general analyzer or observation waiver is added.
Context sources are evidence only and receive no separate audit verdict.

The reviewers checked the proposed finite counter induction against the actual workload and
existing unknown-seeded query; the proposed proof explicitly distinguishes unreachable edges and
does not certify the transient incremented four. Whole-asset visibility and asset/SFA disjointness
have existing producers in `lower-data.ts:150–193` and `c64-layout.ts:672–734,522–525`.
Startup assumptions have existing producers in `layout/startup.ts:378–411` and
`machine/lower-startup.ts:186–192`. The optional observer handoff preserves the default named-source
query and exact source/program/operation identities. Actual implementation remains unverified.

## Complete dimension coverage

| Cluster   | Dimensions                                                       | Result                  |
| --------- | ---------------------------------------------------------------- | ----------------------- |
| Soundness | 1 Ambiguities; 3 Logical contradictions; 12 Consistency          | No findings             |
| Grounding | 2 Implicit assumptions; 13 Codebase alignment, all ten subchecks | No findings             |
| Delivery  | 4 Completeness; 5 Dependencies; 11 Ordering                      | PF-001, minor, resolved |
| Risk      | 8 Security; 9 Edge cases; 6 Feasibility                          | No findings             |
| Fit       | 7 Testability; 10 Scope creep                                    | No findings             |

## PF-001 — task-local verification depends on later consumer — MINOR — resolved

**Original location:** `99-execution-plan.md:27–29`; `07-testing-strategy.md:19,33`.

**Finding:** the first two implementation tasks cited complete ST-6 acceptance, including the
public seven-byte poll, before the third task implemented its selector. Retention suppression
actually depends on that consumer (`lower-function.ts:333`, `lower-state.ts:680–687`). The
pending-task rule therefore made the directed verification order circular. Interface testing was
mentioned but not separated in the checklist.

**Correction:** task 1.2.1 verifies only the finite-counter interface. Task 1.2.2 verifies only
proof/publication/observer interfaces. Task 1.2.3 owns complete public byte-shape and parent
behavior acceptance. The test table now separates counter, eligibility and public specification
files. Three focused new spec files remain inside the approved two-to-three-file planning estimate.

**Authority:** compiler-owned technical sequencing correction under the project's workflow
directive. No reserved scope, observation semantics or old-oracle authority changed.

**Independent fix check:** fixed; no direct-consequence findings. Current task lines and test-file
roles distinguish the gates and no longer deadlock on a pending task. The primary's bounded
all-dimension re-scan found no new contradiction, dependency, scope or test-authority change.

This child PF-001 is the sequencing finding, not the parent parity task's missing-observer-proof
PF-001. The latter remains open until implementation and qualification complete.

## Adversarial closure and limits

Freshness must apply to decrement operands as well as branch comparisons: a new value of the root
does not prove an older captured RHS. Initialization must cover every reachable incoming path;
facts are recorded after convergence. These are binding component requirements, not extra scope.
Unsupported aliases, raw/indexed observers, numeric pointers, wraps, mirrors, bank/mode changes,
generated interrupt effects and stale facts keep ordinary lowering.

Counter/property and initialization lattices are finite; actual scan/allocation cost still needs
implementation evidence and performance review. No broad path-state, recurrence or hardware engine
is approved. If the bounded design fails during execution, the approved abandonment gate applies.

Parent runtime evidence is contextual, not rerun by preflight. No support implementation, test
GREEN, assembled compiler poll, complete checkpoint, whole-program parity or physical-hardware
claim follows from this plan pass. Missing-module RED is setup evidence only.

Expert lineage: supplied qualified `2.0.4`, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; frozen Chapter 12 §3.1, Appendix A §5.1,
the selected lowering/CPU/SFA/observer references, and source keys `BLEND65-SPEC-4-038b70e9`,
`MOS-PGM-1976`, `CBM-C64-PRG-1982`. No qualification cases, grader answers or oracle maps used.
