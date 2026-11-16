# Preflight: boing-ball unreachable teardown

> **Status**: ✅ PREFLIGHT PASSED — one minor finding resolved
> **Iteration**: 2 — bounded handoff correction and consequence check
> **Audit target**: `99-execution-plan.md` only
> **Audited SHA-256**: `6e904ad235e77d8fec4e09b998e8832f96df9723ae046594df6afd42eb79db34`
> **Codebase baseline**: `c0201e86` plus the uncommitted, independently reviewed publication-proof unit
> **Last Updated**: 2026-11-16

SAME-SESSION REVIEW: the primary authored this plan in this session. Five fresh independent Astra
review contexts assessed the dimension clusters; the primary merged them. Independent review
reduces but does not eliminate framing bias. No implementation, test execution or sibling-artifact
pass follows from this report.

## Scope and codebase context

The target is a valid single-file task mini-plan. Context documents are the parent parity and
publication-proof plans, active roadmap, routing, and the frozen startup/optimization contracts.
Reading them gives no authority to modify their oracles or qualify their remaining work.

The proposed unit specializes the existing cooperative constructor using closed nonreturnability,
the existing bounded observation certificate and actual machine reachability. It removes only dead
restoration and its dead main-return reference. Executed entry instructions, snapshots, storage
size, canonical `none` and all existing behavior expectations remain unchanged.

| Actual seam                             | Evidence / consequence                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Closed returnability                    | `semantic/interrupt-ownership.ts:59–60,714`; no new solver is needed.                                                                                                                       |
| Machine successors and main-return edge | `machine/lower-control.ts:180–185,458–473`; the existing unreachable terminator can replace only dead references.                                                                           |
| Source identity and observer closure    | `machine/sprite-publication-proof.ts:253–339,568–574`; source blocks must remain original through poll selection. Calls, initializers and unproved raw/firmware observers keep restoration. |
| Code/layout observation window          | `target/profile.ts:228–232`; the resident RAM window is included in the raw-access veto, not merely current SFA addresses.                                                                  |
| Existing configuration handoff          | `machine/lower.ts:566–602`, `machine/machine-types.ts:660`; the optional fact uses this route, not another API.                                                                             |
| Startup reconstruction                  | `layout/startup.ts:143–213`; valid metadata regenerates startup, while malformed snapshot data fails. A prebinding block mutation is not automatically a layout rejection.                  |
| Partition and placement                 | `layout/c64-layout.ts:226–260,454–475`; absent restoration requires an explicit conditional partition and must not create a negative interval.                                              |
| Binding/evidence closure                | `machine/bind.ts:176–234,585–586`, `services/shared-storage.ts:217–270`; no dangling target or mismatched selected structure may reach packaging.                                           |
| Existing optional-mode consumers        | `services/size-observer-register-counter.ts:434–457`, `size-observer-low-byte-composition.ts:258–275,397–410`; inspected consumers conservatively reject missing restoration.               |

The primary measured the current restore at `$0D2D…$0E46`, 281 bytes, with one cold main-return
jump at `$0D2A`. This is a current-artifact measurement, not a promised future saving. Reviewers
did not independently rerun that probe.

## Dimension coverage

| #   | Dimension              | Result                                                                                     |
| --- | ---------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Ambiguities            | No findings; unsupported/default/returning cases are conservative.                         |
| 2   | Implicit assumptions   | No findings; existing facts and all consumers grounded.                                    |
| 3   | Logical contradictions | No findings; selected-machine proof supplements semantic returnability.                    |
| 4   | Completeness           | No findings; constructor, rebind, layout, packaging and evidence are owned.                |
| 5   | Dependencies           | No findings; predecessor green local commit is a hard gate.                                |
| 6   | Feasibility            | No findings; existing constructor specialization, not a new family or solver.              |
| 7   | Testability            | PF-001 fixed; exact interfaces, files and mutation stages supplied.                        |
| 8   | Security               | No findings; raw/code/firmware observation barriers and no new host-input surface.         |
| 9   | Edge cases             | No findings; malformed snapshots, dangling targets and absent partitions distinguished.    |
| 10  | Scope creep            | No findings; startup capture removal, allocation changes and general analysis excluded.    |
| 11  | Ordering               | No findings; independent RED precedes production, staged verification precedes checkpoint. |
| 12  | Consistency            | No findings; entry/snapshot obligations preserved across all paths.                        |
| 13  | Codebase alignment     | All ten subchecks clear; existing signatures and direct consumers verified.                |

| Cluster           | Independent result                                                               |
| ----------------- | -------------------------------------------------------------------------------- |
| Soundness: 1/3/12 | No findings.                                                                     |
| Grounding: 2/13   | No findings after parent-authorized workflow excerpts; all ten alignment checks. |
| Delivery: 4/5/11  | No findings.                                                                     |
| Risk: 6/8/9       | No findings, including compiler/SFA/platform consequences.                       |
| Fit: 7/10         | One minor handoff finding; bounded correction independently rechecked clear.     |

Compiler/language lens: the scan covers optimization preconditions, machine-IR invariants,
phase ordering, effects, ABI, resource closure and independent behavior/cost oracles. Grammar,
types, source syntax, diagnostics and editor APIs do not change. This internal optional field adds
no persisted schema or mixed-version migration. Primary consequence checks of the handoff edit
revisited the other dimensions; no new finding arose.

## PF-001 — incomplete independent-author handoff — MINOR — resolved

**Target location:** original lines 75–86,99–103. The plan promised signatures but omitted exact
file ownership and injection stages for malformed/stale inputs.

**Evidence:** `layout/startup.ts:195–205` reconstructs startup;
`layout/c64-layout.ts:226–245` performs that rebinding before partition inspection. Deleting a
supplied restore block can therefore be repaired rather than exercising the intended rejection.

**Refutation:** the invariant was specified and existing APIs suffice, but an implementation-blind
author would still have had to guess the stage. No new harness or API is needed.

**Recommendation and technical ruling:** supply a compact signature-only handoff, four owned new
specification paths, precise mutation points and typed fallback/error expectations. The primary
applied this compiler-owned clarification under the repository decision directive. It changes no
product scope, existing oracle or reserved user choice.

**Iteration 2 evidence:** target lines 78–127 now distinguish constructor defaults, producer
missing/mismatched facts, canonical regeneration, malformed-snapshot `null`, direct malformed-layout
errors and dangling function references after false configuration. The independent fit reviewer
confirms PF-001 fixed, with no related testability/scope findings. No findings remain.

## Authority and limits

Frozen `spec/appendix-c64.md:211–239` requires live entry state and restoration on normal return.
The plan preserves all entry work and removes only a path proved unreachable and unobserved.
`requirements/00-ambiguity-register.md:1161–1175` keeps `none` free of optional candidate search;
this unit adds no such search. Two independent expectations remain mandatory: source-derived
behavior and intended assembly/cost shape.

Lineage: expert `2.0.4`, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; startup contracts, final-storage closure and
transformation-proof headings; source keys `BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`,
`CBM-C64-PRG-1982`. Reviewers used authorized normative excerpts. No denied access was retried.

Adversarial checks challenged semantic-only nonreturnability, implicit source pruning, accidental
snapshot removal, regeneration hiding malformed tests, observer bypass and negative restore
intervals. The target now assigns each boundary. It adds no general dead-code pass, constructor
family, observation waiver or source workaround.

**Remaining execution gate:** publication proof must finish its actual complete green checkpoint
and local commit before D1 creates any RED file. Record that predecessor commit and recheck the
resulting metadata-only plan change before execution. No new tests or implementation exist yet.
Future byte savings, whole-program parity, steady-state timing and physical hardware remain
unverified. External firmware stack/reentrancy/deadline limits are not qualified by this pass.
