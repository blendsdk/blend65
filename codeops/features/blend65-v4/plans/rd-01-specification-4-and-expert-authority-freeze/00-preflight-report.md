# Preflight Report: RD-01 Specification 4.0 and Expert Authority Freeze

> **Status**: PASS — PF-001–PF-011 resolved; no unresolved findings
> **Iteration**: 2 — bounded rescan after the user-directed proportionality correction
> **Artifact**: RD-01 requirements update and implementation plan
> **Plan Digest**: `88aa8176a53910a5bf1811168cb61ebefba6013e405394318e4024f7bdb2353a`
> **Requirements-Update Digest**: `5b343fb87125c566d557ed86d5a172e3d8c64d249b6e71c8683642be7d197657`
> **Digest Method**: SHA-256 of byte-sorted `sha256sum` records; reports and working notes excluded
> **Codebase Grounded**: active P3 corpus, Language Guard, expert router/references/casebooks/release,
> project quality policy, CodeOps specification-first protocol, and repository scripts inspected
> **Expert Lineage**: `blend65-domain-expert` 1.0.0, content commit
> `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa`
> **Last Updated**: 2026-09-13

> **SAME-SESSION REVIEW:** The simplified plan was authored and reviewed in the same logical
> session. Five independent dimension clusters and one independent findings challenger were used.
> A fresh-session or human compiler/C64 review remains useful before execution.

## Context

The accepted AR-049/AR-P7 reset reduced the plan from 108 tasks/eight phases to 31 tasks/five
phases and removed passive Markdown tests, per-file identity stamps, a full 107-case model rerun,
hunk-level ledgers, arbitrary batching, and duplicate reviews. The current plan parses as `Ready`,
all local links resolve, and `spec/` plus the live expert skill remain unchanged.

The scan found no reason to restore the rejected machinery. Its accepted corrections use direct
checks, missing authority inputs/owners, and narrow isolation and activation safeguards. AR-P10
explicitly rejects the unused test-pair proposal.

## Summary by Dimension

| Dimension | Findings | Highest severity |
|---|---:|---|
| Ambiguities / assumptions | 1 | 🟡 MINOR |
| Contradictions / consistency | 3 | 🟠 MAJOR |
| Completeness / dependencies | 3 | 🟠 MAJOR |
| Feasibility / testability | 2 | 🔴 CRITICAL |
| Security / edge cases | 1 | 🟠 MAJOR |
| Scope / proportionality | 0 | — |
| Ordering / delivery | 1 | 🟠 MAJOR |
| Codebase alignment | 0 | — |

## Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 CRITICAL | 1 | Resolved |
| 🟠 MAJOR | 8 | Resolved |
| 🟡 MINOR | 2 | Resolved |
| 🔵 OBSERVATION | 0 | — |

## Findings

### PF-001: The plan cannot enter `exec-plan` without executable specification tests 🔴 CRITICAL

**Dimension:** Testability / CodeOps policy alignment

**Location:** `00-index.md:22-27`; `07-testing-strategy.md:8-11`; `99-execution-plan.md:8-13`

**Codebase Evidence:** CodeOps `_shared/spec-first-ordering.md:5-79` and
`skills/make-plan/quality-checklist.md:37-45` require concrete ST cases, separate executable
`*.spec.test.*` and `*.impl.test.*` files, a RED or justified pre-pass, implementation, and GREEN.
Root `package.json:17,35` already provides Vitest.

**The Problem:** The accepted lean plan correctly rejects passive Markdown tests, but it also
removed every executable spec-first task. `exec-plan` must stop before implementation. This is a
workflow contradiction, not a request to restore the earlier 16 passive test documents.

**Only viable resolution:** Add one bounded RD-specific pair, for example
`test/rd01-authority.spec.test.ts` and `test/rd01-authority.impl.test.ts`, using existing Vitest/Node.
Give each implementation phase phase-tagged concrete cases and RED/justified-pre-pass → GREEN
ordering. Keep the files declarative and RD-specific; add no generalized validator. Amend AC-27's
allowed boundary accordingly.

**Recommendation:** Accept the bounded pair. Manual execution outside `exec-plan` is possible only
through an explicit workflow override and provides less assurance.

**Confidence:** High. **Hardening:** Independent challenger confirmed this is minimum-sufficient
and does not contradict AR-049, which rejects passive Markdown tests and generalized machinery.

**User Decision:** Superseded — the user initially accepted the bounded pair, then explicitly
rejected process-only test machinery and directed the lean correction to proceed. AR-P10 records
the RD-01-only direct-check exception; no test file was created.

**Resolution:** Corrected. The plan keeps requirements as the immutable oracle, direct checks and
independent review as evidence, and no executable or passive test support surface.

### PF-002: AC-06 depends on a grammar validator that does not exist 🟠 MAJOR

**Dimension:** Feasibility / testability

**Location:** `requirements/RD-01-specification-4-and-expert-authority-freeze.md:522-525`;
`07-testing-strategy.md:21`

**Codebase Evidence:** No Specification EBNF validator exists in root scripts, packages, tests, or
the expert skill. The existing compiler parser is P3 implementation evidence and is excluded here.

**The Problem:** AC-06 cannot pass as written.

**Only viable resolution:** Replace the nonexistent validator with an exhaustive,
implementation-independent record mapping every normative positive/invalid example to its grammar
start production and successful derivation or precise rejection point; require independent review.
Do not add a grammar engine.

**Recommendation:** Accept the direct derivation record.

**Confidence:** High. **Hardening:** Independent challenger rejected a new grammar engine as larger
than this one-time authority transition needs.

**User Decision:** Resolved — user authorized the smallest direct correction on 2026-09-13.

**Resolution:** Corrected. AC-06 now requires independent grammar/example consistency review and
explicit rejection points; it does not claim a validator exists.

### PF-003: Direct checks and expert dependency projection are underspecified 🟠 MAJOR

**Dimension:** Completeness / testability

**Location:** `requirements/00-ambiguity-register.md:57`; `07-testing-strategy.md:15-50`;
`99-execution-plan.md:44,98-100`

**Codebase Evidence:** Current case files mix prompt, oracle, source, and historical evidence fields;
the coverage matrix defines fields but no byte projection. Existing source governance demonstrates
that exact direct recipes are feasible.

**The Problem:** Most V checks state outcomes but not exact inputs, projections, failure predicates,
or evidence fields. V-11 therefore permits post-hoc choices about which case inputs changed and
which evidence may be inherited.

**Only viable resolution:** Add one compact V-recipe table with exact inputs, command or review
procedure, projection, expected set/value, failure predicate, and closeout evidence location.
Define case dependencies at named file/heading/field granularity and take transitive closure over
explicit router, reference, source, and oracle edges. Put deterministic parts in PF-001's bounded
suite; keep review-only judgments explicit. Add no reusable schema or harness.

**Recommendation:** Accept the compact recipes and exact closure rule.

**Confidence:** High. **Hardening:** Independent challenger merged this with PF-001's implementation
surface but retained the separate reproducibility defect.

**User Decision:** Resolved — user authorized the smallest direct correction on 2026-09-13.

**Resolution:** Corrected. The existing V table retains concrete inputs/results; compact evidence
rules now define mechanical, semantic, dependency, inheritance, and model-run records without a
schema or harness.

### PF-004: Candidate equality, containment, and release bookkeeping disagree 🟠 MAJOR

**Dimension:** Logical consistency / activation safety

**Location:** `03-03-expert-candidate-and-activation.md:43-63`; `07-testing-strategy.md:30`;
`99-execution-plan.md:112-114,141`

**Codebase Evidence:** The active release distinguishes runtime-payload and full-tree digests at
`.agents/skills/blend65-domain-expert/qualification/release.md:20-22`. `quick_validate.py:19-24`
follows normal paths and is not a symlink/non-regular containment check.

**The Problem:** The final live tree cannot equal the approved full candidate after the release
record is deliberately changed. The pre-bookkeeping check covers only runtime payload, while
candidate copying also lacks an exact regular-file/type/mode boundary.

**Only viable resolution:** Record the prior-live, candidate-full-tree, runtime-payload,
copied-tree, and final-release digests. Reject candidate symlinks, non-regular entries, traversal,
control-character paths, and out-of-tree resolution; compare regular-file bytes and modes in fresh
staging. Before bookkeeping compare the complete copied tree. Afterwards require equality for every
file except `qualification/release.md`, whose only allowed change is one preapproved binding delta
with a recorded final hash. Retain the candidate and prior-live backup until the release tail passes.

**Recommendation:** Accept this closed two-checkpoint invariant.

**Confidence:** High. **Hardening:** Independent challenger merged the candidate-filesystem issue
into this activation boundary and confirmed the exact release-only exception is narrower than a
literal but impossible full-tree equality claim.

**User Decision:** Resolved — user authorized the smallest direct correction on 2026-09-13.

**Resolution:** Corrected proportionally. The plan rejects symlink/non-regular entries, compares
the complete tree before binding, and permits only the release-record binding change afterward.

### PF-005: New language forms omit their primary specification owners 🟠 MAJOR

**Dimension:** Completeness / authority alignment

**Location:** `03-01-specification-reconciliation.md:28-36`; `99-execution-plan.md:57-64`

**Codebase Evidence:** `spec/01-lexical-structure.md:10-12,131-135,216-255` claims tokens and
reserved names; `spec/02-type-system.md:10-14,43-51` claims the complete type system; F019 owns
declaration forms; F021 owns reserved intrinsic identifiers.

**The Problem:** Function values, `comptime`, `loadable const`, placement, and intrinsic names can
reach freeze while primary lexical/type/declaration owners remain stale.

**Only viable resolution:** Add Chapter 01/F021 to identifier-shaped syntax and intrinsic tasks,
Chapter 02/F016 to function-value typing, and Chapter 03/F019 to `loadable const` declaration work.
Keep the final whole-tree pass for derived copies.

**Recommendation:** Accept the missing-owner additions to existing tasks.

**Confidence:** High. **Hardening:** Independent challenger confirmed these are owner corrections,
not extra phases or machinery.

**User Decision:** Resolved — user authorized the smallest direct correction on 2026-09-13.

**Resolution:** Corrected. The omitted lexical, type, and declaration owners were added to the
existing semantic tasks; no new task or phase was added.

### PF-006: The P3 authority-role baseline is not frozen before edits 🟠 MAJOR

**Dimension:** Dependency / transition integrity

**Location:** `03-01-specification-reconciliation.md:7-11`; `07-testing-strategy.md:20`;
`99-execution-plan.md:41-45,80-82`

**Codebase Evidence:** P3 has no central normative inventory. Its feature index is navigation;
expert qualification contains a useful 50-path table but cannot itself define language authority.

**The Problem:** Raw Git bytes preserve the 50 files but not their authority-role classification.
Classifying them only after edits permits retrospective omissions or reclassification.

**Only viable resolution:** Before any `spec/` edit, freeze the exact 50 P3 paths with raw hashes,
authority role, and normative flag in the closeout, grounded in the raw P3 documents and authority
hierarchy. V-04 uses that baseline.

**Recommendation:** Accept the one baseline table; do not add per-file stamps or a hunk ledger.

**Confidence:** Medium-high. **Hardening:** Independent challenger confirmed post-edit
reconstruction is the precise integrity risk this transition must avoid.

**User Decision:** Resolved — user authorized the smallest direct correction on 2026-09-13.

**Resolution:** Corrected. Phase 1 freezes the current 50 paths, raw hashes, and simple authority
roles before `spec/` changes; no per-file stamp or hunk ledger was added.

### PF-007: D64/KERNAL facts freeze before their primary evidence exists 🟠 MAJOR

**Dimension:** Ordering / source authority

**Location:** `07-testing-strategy.md:25`; `99-execution-plan.md:76-82,96`;
`requirements/RD-01-specification-4-and-expert-authority-freeze.md:219-233`

**Codebase Evidence:** The active source manifest has no D64/1541 geometry record and its KERNAL
key covers interrupts/NMI/BRK, not `SETLFS`, `SETNAM`, `LOAD`, or disk geometry.

**The Problem:** Phase 3 cannot source-check and freeze these hardware/ROM/disk facts when their
records are not captured until Phase 4.

**Only viable resolution:** Capture and hash-pin the required primary D64/1541/KERNAL/Koala records
before Phase 3 freeze, then copy those exact records into the isolated candidate's source manifest.

**Recommendation:** Accept the earlier evidence capture.

**Confidence:** High. **Hardening:** Independent challenger confirmed product decisions do not
replace primary evidence for hardware, ROM, and disk-format facts.

**User Decision:** Resolved — user authorized the smallest direct correction on 2026-09-13.

**Resolution:** Corrected. Phase 1 captures the pinned primary records before Phase 3 freezes the
facts, and Phase 4 carries those same records into expert source governance.

### PF-008: Evaluator isolation is asserted but not enforced 🟠 MAJOR

**Dimension:** Security / evidence integrity

**Location:** `03-03-expert-candidate-and-activation.md:23-39`; `07-testing-strategy.md:28`;
`99-execution-plan.md:98-100`

**Codebase Evidence:** The configured read-only agent can still read the repository. The active
release and prior expert plan distinguish advisory instructions from the definitive filesystem-
isolated run and document a proven `bwrap` method.

**The Problem:** An evaluator can inspect case oracles and prior outputs, invalidating blind
qualification while still appearing read-only.

**Only viable resolution:** Reuse the concise proven contract: fresh one-shot process; `bwrap` or
an evidenced equivalent; only allowlisted read-only candidate, prompt, raw inputs, and required
system mounts; repository/workspace/history absent; positive packet-read and negative repository-
read controls; separate oracle-bearing grader; exact mounts/hashes/results recorded; fail closed if
the boundary is unavailable.

**Recommendation:** Accept the direct isolation contract without adding a runner.

**Confidence:** High. **Hardening:** Independent challenger confirmed this is an existing proven
procedure, not new infrastructure.

**User Decision:** Resolved — user authorized the smallest direct correction on 2026-09-13.

**Resolution:** Corrected. The plan reuses the prior filesystem-isolated evaluator procedure with
packet-read/repository-read controls and a separate grader; it adds no runner.

### PF-009: Current authority summaries still say 48 decisions 🟡 MINOR

**Dimension:** Consistency

**Location:** `requirements/_draft/discovery-notes.md:7-8`;
`requirements/RD-01-specification-4-and-expert-authority-freeze.md:33-34`

**The Problem:** The discovery summary says 48 while its body says 50; RD-01's Decisions summary
omits AR-049/AR-050 despite using both.

**Only viable resolution:** Change the discovery summary to 50 and add AR-049/AR-050 to the RD-01
summary.

**Recommendation:** Accept the synchronization.

**User Decision:** Resolved — user authorized the direct synchronization on 2026-09-13.

**Resolution:** Corrected. Both summaries now name 50 decisions and RD-01 cites AR-049/AR-050.

### PF-010: Requirements README duplicates stale roadmap state 🟡 MINOR

**Dimension:** Consistency / lifecycle ownership

**Location:** `requirements/README.md:161`; `codeops/features/blend65-v4/00-roadmap.md:20-29`

**The Problem:** The README says all ten rows are `RD Drafted`; the living roadmap has RD-01 at
`Plan Created` and RD-02–RD-10 at `RD Preflighted`.

**Only viable resolution:** Replace the copied stage claim with a link stating that current
lifecycle state is owned by the feature roadmap.

**Recommendation:** Accept the single-owner wording.

**User Decision:** Resolved — user authorized the single-owner wording on 2026-09-13.

**Resolution:** Corrected. The requirements README now links to the feature roadmap instead of
copying its changing stage values.

### PF-011: The pre-approval activation check was not safely executable 🟠 MAJOR

**Dimension:** Activation safety / consistency

**Location:** `07-testing-strategy.md:31`; `99-execution-plan.md:113-115`

**The Problem:** V-14 asked for an actual activation attempt before approval, but the plan uses
procedural ordering rather than an executable activation lock. A literal attempt could mutate the
live skill.

**Only viable resolution:** Replace the mutation attempt with a read-only check that approval
precedes every activation command and that the live-tree digest remains unchanged through the
approval checkpoint.

**Recommendation:** Accept the read-only ordering and digest check.

**User Decision:** Resolved under the user's instruction to apply direct, minimum-sufficient
corrections without adding machinery.

**Resolution:** Corrected. V-14 and task 5.1.1 now use the read-only check; the post-approval tree
and release-only-delta comparisons remain unchanged.

## Scan Notes

- One auditor reported Phase 3 incorrectly required final V-15. The current artifact already limits
  Phase 3 to V-02–V-09 and V-16, so this was a stale concurrent-read result, not a finding.
- The bounded iteration-2 rescan found no unresolved critical, major, or material minor finding
  after PF-011's direct wording correction.
- No compiler, assembler, emulator, readiness, or feasibility command was run.
- No `spec/` or live expert-skill file changed during planning or preflight.
