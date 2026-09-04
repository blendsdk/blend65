# Preflight Report: Blend65 Expert Skillset Plan

> **Status**: ✅ PREFLIGHT PASSED — all 23 findings resolved (22 corrected, 1 dismissed)
> **Iteration**: 4 (accepted game-technique realization amendment and focused convergence)
> **Artifact**: full implementation plan at `codeops/features/blend65-expert-skillset/plans/blend65-expert-skillset/`
> **Iteration-1 Artifact Tree**: `7bf4a4531a775e07d20fa3efbf9a69a17ea2c445`
> **Passed Target Digest**: `adb861f486dcfcd5a4ebbc0938a5a34a923cda2864a48c59b521c96ea6e2898d` (SHA-256 over the sorted thirteen target-document SHA-256 records; report and temporary notes excluded)
> **Repository Base Commit**: `36bcf4682ebe7d9de693178bf0f6771ed9e6398e`
> **Codebase Grounded**: all 13 plan documents reviewed through convergence; 50 specification files, 12 workspaces, 100 unique case definitions, 60 substeps, tool versions, legacy references, and relevant compiler/SFA/platform evidence verified
> **Review Independence**: Iteration 4 used three independent clustered auditors and one independent recommendation challenge; earlier iterations used clustered/domain auditors and recommendation challenges
> **Last Updated**: 2026-09-04

> **SAME-SESSION REVIEW:** This artifact was created earlier in the current conversation. Same-agent
> bias risk is elevated. Independent audit agents reduced but cannot eliminate that risk. Because
> this baseline will govern later compiler architecture, a human compiler/6502 review remains
> advisable before release.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM monorepo on Node 22, Yarn classic workspaces, Turborepo, Vitest,
ESLint 9, Prettier, ACME 0.97, and VICE 3.10.

**Architecture:** The live compiler follows lex/parse → semantic analysis → SFA → IL/optimization →
machine instruction stream → ACME/artifact production. Platform profiles/plugins, SFA planning,
parity evidence, an expressiveness ledger, and a 100-game feasibility matrix already exist. The
audited plan replaces the current four-reference domain skill with a frozen C64-first v1.0.0 router,
thirteen runtime references, and Markdown qualification evidence.

**Key Files Examined:** `AGENTS.md`, `package.json`, RD-01, both roadmaps, all current
`blend65-domain-expert` files, `spec/06-functions.md`, `spec/14-diagnostics.md`, representative type,
expression, struct, and module specification chapters, compiler frontend/emission entry points, SFA
model/interference sources, IL lowering and optimizer contracts, platform plugin sources, parity and
expressiveness evidence, and `docs/game-feasibility-matrix.json`.

## Iteration-1 Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---:|---|---:|---|
| 1 | Ambiguities | 1 | 🟠 MAJOR |
| 2 | Implicit Assumptions | 1 | 🟠 MAJOR |
| 3 | Logical Contradictions | 2 | 🔴 CRITICAL |
| 4 | Completeness Gaps | 2 | 🟠 MAJOR |
| 5 | Dependency Issues | 1 | 🟠 MAJOR |
| 6 | Feasibility Concerns | 1 | 🟠 MAJOR |
| 7 | Testability | 3 | 🟠 MAJOR |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 | 🟠 MAJOR |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 | 🟠 MAJOR |
| 12 | Consistency | 4 | 🟠 MAJOR |
| 13 | Codebase Alignment | 2 | 🟠 MAJOR |

## Iteration-1 Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 CRITICAL | 1 | Decision recorded; correction not yet applied |
| 🟠 MAJOR | 16 | All decisions recorded (1 dismissed) |
| 🟡 MINOR | 2 | All decisions recorded |
| 🔵 OBSERVATION | 0 | — |

## Iteration-2 Summary

| Result | Count | State |
|---|---:|---|
| Prior corrections applied and verified | 18 | PF-001..PF-010 and PF-012..PF-019 |
| Prior finding dismissed by product clarification | 1 | PF-011 |
| Residuals found and corrected during re-scan | 5 | PF-003, PF-004, PF-005/PF-008, PF-007, PF-009 |
| New findings | 1 major | PF-020 — decision required at the end of Iteration 2 |

## Overall Result

**PASSED.** The original twenty findings and the three Iteration-4 amendment findings are resolved.
The accepted game-technique realization design now has deterministic compiler/API dispositions,
independent proof duties, complete representative family cases, pre-freeze source/oracle review,
and consistent future-target case ordering. Focused convergence found no remaining material issue.
The plan may advance to `Plan Preflighted`.

---

## Findings

### PF-001: Frozen semantic authorities contradict each other 🔴 CRITICAL

**Dimension:** Logical Contradictions

**Location:** `03-02-blend65-compiler-knowledge.md:26-29`;
`03-06-evidence-and-source-governance.md:97-110`;
`03-07-qualification-and-release.md:168-180`; `00-index.md:106-116`

**Codebase Evidence:** `spec/06-functions.md:75-82,181-210,260-275,676-684` assigns E10170 to
missing return type, E10174 to missing return value, E10175 to not-callable, E10180/E10181 to
recursion, and permits unlimited parameters. `spec/14-diagnostics.md:104-113` instead assigns
E10170 to wrong argument count, E10174 to recursion, and E10175 to an eight-parameter limit.
`packages/core/src/diagnostics/diagnostic-codes.ts:180-192` records this as unresolved spec drift.

**The Problem:** The plan requires every semantic conclusion to follow the frozen spec, blocks a
release with any material source conflict, and forbids correcting `spec/`. It therefore cannot
freeze a trustworthy semantic oracle or complete its crosswalk. Choosing silently would embed an
arbitrary language/diagnostic contract in the supposedly immutable skill.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Continue all unaffected skillset work under an explicit implementation-independence firewall. Before final semantic qualification, run a bounded spec consistency/errata prerequisite: audit duplicate diagnostic assignments and direct cross-chapter contradictions, obtain explicit product rulings, publish the reconciled baseline, and then freeze the affected semantic cases. Existing compiler behavior is never an authority and becomes later compiler-audit/GitHub-issue input only. | Preserves momentum, produces one authoritative language contract, and prevents the existing compiler from contaminating the skill. | Final v1.0.0 certification still waits for the independent spec reconciliation. This is a necessary correction outside the current modification set; accepting this finding alone does not authorize editing `spec/`. |
| B | Amend RD-01 and the plan so conflicting semantics remain explicit `Unknown` entries and only unaffected behavior qualifies. | Keeps skill work moving without editing `spec/`. | Deliberately ships an incomplete expert baseline and cannot satisfy the present all-cells/depth contract. |

**Recommendation:** **Option A — best option.** Use a strict one-way dependency: specification,
approved product decisions, SFA doctrine, and primary hardware/tool sources → frozen skill →
compiler audit → issues/redesign. Continue unaffected skill modules now, but do not certify the
conflicted semantics until the independent spec prerequisite resolves them. The prerequisite must
audit the class of contradiction, not merely the five codes already found.

**Confidence:** High — this would change only if an already-authoritative precedence/errata source
is found. **Hardening:** expanded the remedy from the known examples to a bounded consistency audit.
**Challenger:** converged.

**User Decision:** Resolved — User accepted refined Option A on 2026-09-04. Existing compiler code
and tests are audit subjects only and must not determine skill doctrine, qualification expectations,
or redesign direction. Compiler discrepancies are recorded outside the skill for the later audit;
the internal specification conflict must be resolved independently before final semantic
qualification.

---

### PF-002: External-fact oracles freeze before their evidence exists 🟠 MAJOR

**Dimension:** Dependency Issues

**Location:** `07-testing-strategy.md:81-99,106-132`; `99-execution-plan.md:76-88,115-123`

**Codebase Evidence:** The current unsafe signed-comparison guidance demonstrates why expert-looking
rules need primary evidence before becoming oracles:
`.agents/skills/blend65-domain-expert/references/mos-6502-codegen.md:52-55`.

**The Problem:** Phase 1 authors and freezes hardware/tool cases before Phase 2 researches and pins
their primary sources. This reverses the authority dependency and can turn recalled or inherited
mistakes into immutable hidden expectations.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Verify every external invariant and citation during Phase 1, then normalize the same evidence into the Phase-2 manifest. | Keeps one global Phase-1 freeze. | Duplicates evidence work and creates two places that can drift. |
| B | Freeze only spec/project-derived cases in Phase 1. Mark external-fact cases draft, research and pin their evidence at the start of Phase 2, then freeze them before dependent knowledge is authored. | Preserves oracle independence and performs each evidence task once. | The initial red baseline is explicitly partial until the Phase-2 freeze. |

**Recommendation:** **Option B — best option.** It preserves the source-before-oracle dependency
without duplicating work.

**Confidence:** High. **Hardening:** changed the phase-placement choice after challenge; the
external-fact freeze moves to Phase 2. **Challenger:** diverged on timing; the challenger option was
adopted.

**User Decision:** Resolved — User accepted Option B on 2026-09-04. Freeze spec/project-derived
oracles in Phase 1; keep external-fact oracles explicitly draft until Phase-2 primary-source
research and pinning establishes their expectations.

---

### PF-003: Blind evaluation is not isolated from its hidden oracle 🟠 MAJOR

**Dimension:** Testability

**Location:** `03-07-qualification-and-release.md:71-84,119-130`;
`99-execution-plan.md:298-304`

**Codebase Evidence:** `skill-creator/SKILL.md`, section “Independent Forward-Testing,” requires the
minimum permitted artifacts and an isolated temporary workspace. In the planned repository layout,
the evaluator can read `qualification/`, plans, prior results, and hidden invariants.

**The Problem:** A fresh model context is not blind when the answer key is readable in the same
tree. Results could prove oracle discovery rather than domain expertise, and selective-loading
claims would not have auditable input packets.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Build an ephemeral evaluation copy containing only the candidate router/runtime references and each case's permitted raw artifacts. Give evaluators prompts without oracle/history; give graders the oracle and output; retain only packet lists, outputs, and grading evidence. | Enforces blindness and records exactly what was available without adding a permanent runner. | Manual allowlists must be checked so required evidence is not omitted. |

Same-repository “do not read” instructions were considered and rejected because they do not enforce
the hidden-oracle boundary.

**Recommendation:** **Option A — the only viable option.** It is the smallest mechanism that makes
the qualification claim testable.

**Confidence:** High. **Hardening:** added explicit copied-path evidence and separated evaluator
from grader inputs. **Challenger:** converged.

**User Decision:** Resolved — User accepted Option A on 2026-09-04. Blind qualification will use
an ephemeral allowlisted evaluation copy; evaluators receive neither hidden oracles nor author
history, while separate graders receive the oracle and captured output. No permanent runner or
framework is authorized.

---

### PF-004: Early checkpoints require a router that is not installed yet 🟠 MAJOR

**Dimension:** Implicit Assumptions

**Location:** `07-testing-strategy.md:43-54`; `99-execution-plan.md:130-132,166-167,200-202,268-269,288-291`

**Codebase Evidence:** `.agents/skills/blend65-domain-expert/SKILL.md:30-37` routes only four legacy
references. The plan itself records the missing thirteen-module routing, freeze, and errata
behavior at `02-current-state.md:25`.

**The Problem:** Phase-2 through Phase-6 runs cannot honestly pass router, selective-loading, or
freeze cases when that behavior lands only in Phase 7. Manually supplying references can test
knowledge content, but it cannot prove router selection.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | In early focused runs, grade knowledge accuracy, depth, evidence use, and consistency only. Leave router activation, selective loading, response shape, and freeze facets pending until the integrated Phase-7 router exists. | Keeps one authoritative router and makes each checkpoint honest. | Router defects surface later. |
| B | Progressively assemble a second, isolated candidate router for early runs while the public router remains unchanged. | Finds router problems sooner. | Creates split, changing authority and more process surface. |

**Recommendation:** **Option A — best option.** Focused manual module selection is sufficient for
content review; duplicating the router is unnecessary.

**Confidence:** High. **Hardening:** rejected the isolated progressive-router option because it
creates two changing baselines. **Challenger:** converged.

**User Decision:** Resolved — User accepted Option A on 2026-09-04. Phase-2 through Phase-6 focused
runs will grade completed knowledge content only. Router activation, selective loading, response
shape, and freeze behavior remain pending until the integrated Phase-7 router exists.

---

### PF-005: The definitive blind run occurs before review and fixes 🟠 MAJOR

**Dimension:** Ordering & Sequencing

**Location:** `99-execution-plan.md:298-312`; `03-07-qualification-and-release.md:156-180`

**Codebase Evidence:** The plan's release contract requires all reviewer material findings to be
resolved and rerun, but task 7.9 requires only affected cases plus one regression case rather than
the complete suite against the final candidate.

**The Problem:** The only complete blind result can describe content that independent review later
changes. Targeted reruns do not prove that fixes left unrelated routing, cross-module behavior, and
all previously passing cases intact.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Keep focused preliminary runs, perform independent review and fixes, then run the complete blind suite once against the exact no-further-content-change candidate. | One authoritative full run; least duplicated work. | Reviewers initially see only focused-run evidence. |
| B | Keep the current early full run and mandate a second complete run after every review/fix cycle. | Gives reviewers an early complete result too. | Runs the expensive suite twice and adds no stronger final invariant. |

**Recommendation:** **Option A — best option.** Review must shape the candidate before its definitive
qualification, with any later runtime-content change invalidating that run.

**Confidence:** High. **Hardening:** retained focused evidence for reviewers while removing the
redundant early full run. **Challenger:** converged.

**User Decision:** Resolved — User accepted Option A on 2026-09-04. Focused evidence may be
reviewed during authoring, but independent review and all corrections must precede the definitive
complete blind run against the exact no-further-content-change candidate. Any later runtime-content
change invalidates that run.

---

### PF-006: VICE is allowed to settle physical-silicon truth 🟠 MAJOR

**Dimension:** Logical Contradictions

**Location:** `03-06-evidence-and-source-governance.md:14-25`;
`03-05-toolchain-portability-and-recovery.md:128-135`

**Codebase Evidence:** The plan correctly treats local VICE 3.10 probes as emulator evidence and
elsewhere states that they cannot prove behavior across physical revisions.

**The Problem:** The evidence hierarchy nevertheless allows revision-specific VICE measurements to
resolve ambiguity between physical-hardware documents. Bounding an emulator configuration does not
turn its observation into silicon evidence.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Make VICE 3.10 the primary development, regression, and automated runtime oracle. It establishes its configured observable behaviour. Primary documentation governs stated hardware semantics; revision-identified physical measurement or stronger silicon evidence settles disputed/revision-sensitive hardware truth. Record uncompleted targeted release QA as `VICE-verified / hardware-unverified`. | Matches modern C64 cross-development while preserving sound physical-evidence boundaries. | Hardware-sensitive claims remain provisional until targeted real-hardware QA. |

Treating VICE as physical evidence was rejected because it changes the claim rather than the
measurement's confidence.

**Recommendation:** **Option A — the only viable option.** Use VICE for continuous automated
validation and reserve targeted physical QA for raster/badline, CIA, SID, undocumented or
revision-dependent, cartridge/expansion, unusual banking, and source-versus-emulator conflicts. A
bounded provisional status is safer than either rejecting VICE or treating it as universal silicon
proof.

**Confidence:** High. **Hardening:** clarified the valid fallback when physical evidence is absent.
**Challenger:** converged.

**User Decision:** Resolved — User accepted refined Option A on 2026-09-04. VICE 3.10 is the primary
development/regression/runtime environment; disputed or revision-sensitive physical claims receive
targeted real-hardware QA near release and remain `VICE-verified / hardware-unverified` until then.

---

### PF-007: Known-unsafe legacy guidance remains authoritative and unpinned 🟠 MAJOR

**Dimension:** Consistency

**Location:** `00-index.md:18-23`; `02-current-state.md:9-15`;
`99-execution-plan.md:72-88,285-297`

**Codebase Evidence:** `.agents/skills/blend65-domain-expert/SKILL.md:28-37` continues to route the
four legacy references; `references/mos-6502-codegen.md:52-55` contains the known unsafe rule.

**The Problem:** For six phases, an auto-discoverable skill is called authoritative despite a known
semantic hazard. The migration ledger also has no pinned commit/tree for the four source files and
does not forbid them from changing, so the exact migrated baseline is implicit.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | After recording the red baseline, pin the legacy tree identity, make the four files read-only migration evidence, and add a minimal interim router warning that revokes their decision authority; frozen spec and primary evidence govern authoring until v1.0.0 passes. | Preserves migration input and bounded discoverability with a very small change. | Unsafe prose remains physically readable; the warning must be explicit. |
| B | Pin the files and temporarily disable/remove the public skill until replacement. | Eliminates accidental activation. | Removes even bounded domain routing throughout construction and is unnecessarily disruptive. |

**Recommendation:** **Option A — best option.** It quarantines authority without creating an
availability gap and makes migration reproducible.

**Confidence:** Medium — if the runtime cannot reliably surface the warning before legacy routing,
Option B becomes safer. **Hardening:** merged the unpinned-input defect into the quarantine remedy.
**Challenger:** converged, with lower operational urgency because compiler recovery is paused.

**User Decision:** Resolved — User accepted Option A on 2026-09-04. Pin the legacy skill tree,
retain the four old references as read-only migration evidence, explicitly revoke their authority
during replacement authoring, and migrate an old statement only after independent verification.

---

### PF-008: “Qualification gate” makes pre-delete ordering circular 🟠 MAJOR

**Dimension:** Ambiguities

**Location:** `03-01-router-and-baseline-governance.md:128-130`;
`03-07-qualification-and-release.md:9-28`; `99-execution-plan.md:295-297`

**Codebase Evidence:** RD-01 R15 at
`requirements/RD-01-c64-first-domain-expert-baseline.md:83-86` requires replacement and
qualification gates before deletion, while formal structural Gate 1 requires the old files absent.

**The Problem:** The undefined pre-delete gate cannot mean all three formal release gates because
one of those gates requires the post-delete tree. Execution has no unambiguous safe transition from
candidate to live skill.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Define an exact Candidate Pre-delete Gate over the isolated candidate tree. After it passes, migrate the live router and delete the old files atomically, then run formal Release Gates 1-3. | Satisfies both required states and gives each gate one meaning. | Adds one named temporary transition check. |

A single live-tree gate was rejected because no tree can simultaneously contain and not contain the
legacy files.

**Recommendation:** **Option A — the only viable option.** This is a bounded transition check, not a
new framework.

**Confidence:** High. **Hardening:** tied the gate to the same isolated candidate used for blind
evaluation. **Challenger:** converged.

**User Decision:** Resolved — User accepted Option A on 2026-09-04. Define and run an exact Candidate
Pre-delete Gate against the isolated complete candidate tree, then replace the live router/delete
the legacy references as one coherent change and run formal Release Gates 1-3 on the live tree.

---

### PF-009: The immutable qualification payload has no coherent boundary 🟠 MAJOR

**Dimension:** Consistency

**Location:** `03-01-router-and-baseline-governance.md:137-140`;
`03-07-qualification-and-release.md:69-80,149-152`; `99-execution-plan.md:315-322`

**Codebase Evidence:** The case files own final result fields, but Q-A15 reruns after the checkpoint;
the later release commit also edits one of the seven artifacts previously described as complete and
immutable.

**The Problem:** Whole case files are called immutable while result sections are written later, and
the supposedly complete qualification checkpoint is followed by qualification changes. A content
hash therefore does not identify one auditable final payload.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Freeze oracle fields after their authoring gate and make result fields append-only until final review. Complete Q-A15 and all result writes before the content checkpoint. Define the checkpoint as router, metadata, 13 refs, coverage/migration matrix, five finalized case files, and evaluation/review evidence; exclude only the draft release record. Then allow only the release record and roadmaps to change and verify that exact allowlist. | Gives each freeze point and hash a precise meaning without new tooling. | The immutable content checkpoint includes all final evaluation evidence. |

Separating result evidence into another subsystem was rejected because the existing case files
already own it and another store would add machinery.

**Recommendation:** **Option A — the only viable option.** It preserves the non-self-referential
release record while making all protected content exact.

**Confidence:** High. **Hardening:** moved the post-checkpoint Q-A15 drill before the checkpoint and
made the allowed second-commit delta explicit. **Challenger:** converged.

**User Decision:** Resolved — User accepted Option A on 2026-09-04. Freeze oracle fields after
authoring, keep result fields append-only through final review/evaluation, complete all case results
before the exact content checkpoint, and allow only the release record and roadmaps to change after
that checkpoint.

---

### PF-010: Sixty executable tasks multiply full verification work 🟠 MAJOR

**Dimension:** Feasibility Concerns

**Location:** `99-execution-plan.md:59-61,72-320`

**Codebase Evidence:** CodeOps `exec-plan/execution-protocol.md:81-118` verifies every checkbox task
before completion. `AGENTS.md` defines repository-wide verification, and `package.json:14-24` shows
that `yarn test` includes package tests, both readiness smoke tiers, and root boundary tests.

**The Problem:** The plan exposes 60 checkboxes but describes seven phase verification/commit
checkpoints. Literal execution would run broad verification about 60 times; running it only seven
times would violate the governing task loop. This is the exact process overengineering the project
is trying to stop.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Keep all 60 detailed work actions as non-checkbox substeps under the seven logical phases. After each step, run only checks relevant to the touched surface. At completion, run the complete skill qualification and structural/source/path/freeze checks. Do not run the compiler's 3,000+ tests for a skill/Markdown-only change. In later compiler work, use directed tests during development and broader tests only at the affected major integration boundary. Record TypeScript 7 plus removal of ESLint as a separate toolchain decision; add no replacement linter, while retaining essential architecture boundaries as small direct tests. | Preserves every work item, removes irrelevant verification cost, and makes testing follow risk and dependencies rather than task count. | The plan and project guidance must state the touched-surface policy clearly; the later TypeScript 7/no-ESLint migration remains separate work. |

**Recommendation:** **Option A — the only viable option.** Run relevant tests during development
and complete relevant tests at the major completion point; never run the entire repository suite by
default. Seven phases organize the work but do not dictate seven full test runs.

**Confidence:** High. **Hardening:** the original seven-full-phase-verifies recommendation was
rejected after the user supplied the repository's 3,000+ test history. A second challenger further
removed the irrelevant final compiler-suite run from this skill-only plan. **Challenger:** converged
on the revised impact-based policy.

**User Decision:** Resolved — User accepted the revised Option A on 2026-09-04. Keep all 60 work
steps, select checks by touched surface, run the complete skill qualification at skillset completion,
and do not run compiler tests for skill/Markdown-only changes. TypeScript 7 plus removal of ESLint
is a separate accepted toolchain direction; no replacement linter is authorized.

---

### PF-011: Feasibility-matrix authority was misclassified 🟠 MAJOR — DISMISSED

**Dimension:** Codebase Alignment

**Location:** `AGENTS.md:132-166`; omission from the audited skillset plan

**Codebase Evidence:** `AGENTS.md:132-166` currently makes the matrix a non-negotiable compiler
benchmark. The user clarified that `docs/game-feasibility-matrix.json` is only the input source for
its generated page: a naive, time-stamped estimate of whether selected games might theoretically be
possible with perceived compiler capabilities. It is not an authority and may be deleted.

**The Problem:** The initial finding treated stale project guidance as product intent. The plan is
correct to omit the matrix from skill authority. Adding it would contaminate the one-way dependency
from independent expert knowledge to compiler audit and make the skill depend on an optional,
disposable report.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Dismiss PF-011. Keep the matrix out of skill doctrine, qualification, compiler requirements, architecture, and acceptance gates. Correct `AGENTS.md` separately so deleting the matrix has no downstream effect; Git history is sufficient if the old snapshot is ever needed. | Preserves the intended independent expert baseline and permits future matrix removal without migration work. | The stale `AGENTS.md` wording must be corrected before later agents perform the redesign. |

Retaining the matrix as an audit checklist was also rejected after clarification: even that would
give an optional snapshot influence over audit scope that the user did not intend.

**Recommendation:** **Option A — the only viable option.** The matrix is a removable presentation
artifact, not a compiler or skill dependency.

**Confidence:** High. **Hardening:** reversed the original recommendation after authoritative
product-intent clarification. **Challenger:** the earlier verdict was superseded by new user-owned
scope evidence; the preflight challenger budget was exhausted after PF-010's late revision.

**User Decision:** Dismissed on 2026-09-04 — User confirmed that the matrix is a naive,
non-authoritative checkpoint snapshot that may be removed. It must not influence or become a
dependency of the expert skillset or compiler redesign. Correcting stale `AGENTS.md` guidance is a
separate accepted follow-up, not a skill-plan addition.

---

### PF-012: Fixed qualification topology cannot represent point releases 🟠 MAJOR

**Dimension:** Consistency

**Location:** `03-07-qualification-and-release.md:9-28,132-152`;
`03-01-router-and-baseline-governance.md:137-146`

**Codebase Evidence:** The structural gate requires exactly seven qualification artifacts and names
only `releases/v1.0.0.md`, while critical errata require a new point-version content commit.

**The Problem:** `v1.0.1` cannot receive a durable record without violating the gate. Reusing
`v1.0.0.md` would erase the original baseline's immutable history.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Keep exactly one active skill and one `qualification/release.md` in the working tree. Any substantive router, knowledge, source-governance, or qualification-oracle change increments the version by at least a patch and must qualify before atomic activation. All later work uses the latest qualified version. Git commits/tags preserve older versions; audits record the version and content commit they used. Updating `release.md` to bind an already-qualified content commit is bookkeeping and does not recursively trigger another bump. | Matches the single-active-version intent, keeps topology fixed, and preserves reproducible history without parallel skill copies or accumulating release files. | A later version change requires dependency-targeted revalidation of conclusions made with the previous version. |

Keeping multiple active versions or accumulating versioned release files was rejected after user
clarification. Git already preserves historical content and records without expanding the live
skill tree.

**Recommendation:** **Option A — the only viable option.** One active skill always uses the latest
qualified version; every substantive modification bumps that version, and Git preserves the past.

**Confidence:** High. **Hardening:** replaced the earlier append-only multi-record proposal with the
simpler single-active-version model after authoritative product clarification. **Challenger:** the
earlier topology verdict was superseded by user-owned version policy; the challenger budget was
already exhausted.

**User Decision:** Resolved — User accepted the refined Option A on 2026-09-04. Maintain exactly one
active, latest-qualified skill; bump the version for every substantive skill change, qualify before
activation, store only the current `release.md`, and use Git plus recorded content commits for
historical reconstruction.

---

### PF-013: Errata impact audits have no downstream lineage 🟠 MAJOR

**Dimension:** Completeness Gaps

**Location:** `03-01-router-and-baseline-governance.md:140-146`;
`03-05-toolchain-portability-and-recovery.md:167-176`;
`03-06-evidence-and-source-governance.md:27-38`

**Codebase Evidence:** The planned recovery record stores neither active skill identity nor the
knowledge rule that informed a compiler conclusion. Source-manifest dependencies stop at knowledge
sections rather than continuing to downstream decisions.

**The Problem:** After correcting a synthesized rule, there is no deterministic way to find which
compiler audit, architecture, or implementation decisions consumed it. “Targeted impact audit” is
therefore not executable and can leave mixed-version conclusions in place.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add `{skillVersion, contentCommit, referencePath#heading, sourceKeys}` to each material recovery conclusion. Use a claim key only when one heading contains multiple independent rules. Each point release lists the superseded version, corrected rules, affected downstream records, and one disposition per record: `unaffected`, `revalidated`, `corrected`, or `invalidated/reopened`. | Makes targeted revalidation deterministic using existing records and Git. | Requires disciplined citations when recording recovery decisions. |

A global claim registry was considered and rejected because commit-anchored headings provide the
needed lineage with much less machinery.

**Recommendation:** **Option A — the only viable option.** It turns the existing errata promise into
an auditable procedure without a service or framework.

**Confidence:** High. **Hardening:** made claim IDs conditional rather than creating a mandatory
registry. **Challenger:** converged.

**User Decision:** Resolved — User accepted Option A on 2026-09-04. Every material compiler-audit
finding or redesign decision will cite the active skill version/content commit, relevant knowledge
heading, and primary source keys. A later version change revalidates only conclusions dependent on
changed knowledge, using the stated four dispositions and no separate registry/framework.

---

### PF-014: SFA storage ownership has no final closure point 🟠 MAJOR

**Dimension:** Completeness Gaps

**Location:** `03-02-blend65-compiler-knowledge.md:76-86,111-150`;
`03-01-router-and-baseline-governance.md:69-72`

**Codebase Evidence:** `packages/compiler/src/api/run-frontend.ts:185-203` performs allocation before
`packages/compiler/src/api/emit.ts:102-125` lowers and optimizes IL. Later legalization/resource
binding can create the spills and scratch that the plan says SFA must own.

**The Problem:** The skill correctly makes SFA the sole general function-frame model, but never
states how function-lifetime storage created after an initial allocation returns to planning or
reaches a final closed allocation. The wording must also prevent SFA from expanding into a universal
memory manager: global data, sprites, charsets, images, SID data, hardware-visible alignment,
banking, segments, and loaders belong to platform layout/packaging.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Define SFA as the final function-execution-storage invariant, not a fixed pass position or whole-machine allocator. Before emission, it must close over parameters, returns, locals, temporaries, spills, and function/helper scratch, followed by a “no new function storage after closure” gate. Platform layout/packaging separately owns global data, hardware assets, target alignment, banking, and artifact placement. Add contrasting cases for a later spill (SFA) and VIC-compatible charset placement (C64 platform layout). | Preserves architectural freedom and the proven SFA model while keeping target-specific asset placement modular. | Later architecture work must choose how staged function-storage planning converges. |
| B | Mandate final SFA only after resource binding, with earlier planning explicitly provisional. | Gives one obvious closure point. | Prematurely fixes pass order before the recovery audit and may lose useful target-neutral planning. |

**Recommendation:** **Option A — best option.** Freeze SFA as the sole general function-frame model
and its closure obligation, while keeping machine assets and placement in platform layout and
packaging. Do not freeze an unreviewed pass order or turn SFA into a universal memory manager.

**Confidence:** High. **Hardening:** added an explicit no-new-function-storage closure gate and,
after user clarification, narrowed ownership to function execution storage with a strict platform
layout/asset boundary. **Challenger:** converged on the closure invariant; the user supplied the
authoritative ownership refinement.

**User Decision:** Resolved — User accepted refined Option A on 2026-09-04. SFA is the sole general
function-frame model and owns all function-lifetime storage, including later spills/helper scratch,
but does not own global data, sprites, charsets, images, SID data, platform alignment/banking, or
artifact placement.

---

### PF-015: SFA cases omit argument-marshalling lifetime interference 🟠 MAJOR

**Dimension:** Edge Cases

**Location:** `03-02-blend65-compiler-knowledge.md:123-150`;
`07-testing-strategy.md:56-75`

**Codebase Evidence:** `spec/06-functions.md:260-271` guarantees left-to-right arguments.
`packages/frontend/src/sfa/model-adapter.ts:237-266` and
`packages/frontend/src/sfa/interference.ts:14-17` model later-argument call interference.
`packages/codegen/src/il/lower.ts:1032-1042,1061-1077` still ICEs when a nested later argument can
reach the same callee, such as `f(1, f(2, 3))`.

**The Problem:** Generic caller/callee and parameter-homing language does not state that already
stored argument homes must remain live across functions invoked by later arguments. A same-callee
nested argument is not recursion because the outer call has not begun. Without a discriminating
oracle, the skill could approve unsafe overlays or defend a compiler ICE as a language restriction.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Apply the modern-language prime directive: both call forms are ordinary legal source and must compile through an SFA-compatible staging/allocation solution while preserving left-to-right effects. Add compact doctrine plus two cases: `f(1, g())` with transitive callees, and `f(1, f(2,3))`. More generally, never convert a missing lowering or compiler-convenience limitation into an alien source restriction; only explicit, approved limitations genuinely forced by the target/resource model may restrict the language. | Covers both lifetime classes, protects normal modern syntax, and establishes the correct burden of proof for every similar compiler limitation. | The compiler may need more sophisticated compile-time analysis/lowering, which is the compiler's responsibility rather than the user's. |

Turning the current ICE into a source restriction was rejected because the frozen language permits
the call shape and project policy forbids compiler-convenience restrictions.

**Recommendation:** **Option A — the only viable option.** Modern ergonomics in, expert assembly
out. If an expert can implement the semantics on the selected machine, the compiler must provide
the lowering or a zero/appropriate-cost platform abstraction. A restriction is admissible only when
the platform/resource constraint is proven and the limitation is explicitly approved—not because
the current compiler lacks an implementation.

**Confidence:** High. **Hardening:** reduced several possible probes to two composite cases; the
user then elevated the source-ergonomics rule into a prime directive applying to all comparable
language restrictions. **Challenger:** converged on the cases; the user supplied the authoritative
product rule.

**User Decision:** Resolved — User issued and accepted the modern-language prime directive on
2026-09-04. Blend65 must behave like a normal modern language except for deliberate, explicit, and
approved limitations genuinely forced by the platform/resource model. SFA, lowering gaps, or
compiler convenience may never force alien source forms. Legal nested calls require an
SFA-compatible implementation; current failure becomes a later compiler issue. Dynamic forms such
as `POKE(variableAddress, value)` likewise require valid lowering rather than a constant-only user
restriction.

---

### PF-016: Path-complete language coverage is not semantically closed 🟠 MAJOR

**Dimension:** Testability

**Location:** `03-02-blend65-compiler-knowledge.md:31-59`; `07-testing-strategy.md:56-75`

**Codebase Evidence:** Independent normative behaviors lacking discriminating cases include narrow
intermediate overflow and constant/runtime wrapping (`spec/02-type-system.md:257-296,406-464`),
short-circuit side effects (`spec/04-expressions-operators.md:153-190`), by-reference aliasing
(`spec/07-structs.md:272-281`), module initialization order (`spec/10-modules.md:193-217`), and
diagnostic/no-binary policy (`spec/14-diagnostics.md:24-31,201-208`).

**The Problem:** Exact 50-path equality and Q-L01's generic “find the documents” behavior can pass
while the agent still makes wrong semantic decisions. Most remaining Q-L cases test architecture
and SFA rather than the listed language-semantic families.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Expand the existing language case file with a small interaction-driven suite covering width/overflow, constant-versus-runtime wrapping, short-circuit order, by-reference aliasing, initialization order, and diagnostic/no-binary behavior. Let the total case count follow risk coverage. | Tests the real semantic seams and preserves all existing cases. | Increases the suite beyond 81 cases. |
| B | Preserve 81 by replacing or consolidating broad cases while retaining every existing risk owner. | Holds evaluation count flat. | Optimizes for an arbitrary historical number and risks losing coverage. |

**Recommendation:** **Option A — best option.** Knowledge depth and discriminating coverage, not a
fixed count, are the release invariant.

**Confidence:** High. **Hardening:** kept the expansion interaction-driven rather than creating a
case per spec section. **Challenger:** converged.

**User Decision:** Resolved — User accepted Option A on 2026-09-04. Expand the existing language
qualification with a small interaction-driven semantic suite, independent of current compiler
behavior, and let the case total follow the required depth rather than preserving 81.

---

### PF-017: Optimization guidance lacks a semantic-equivalence proof method 🟠 MAJOR

**Dimension:** Testability

**Location:** `03-02-blend65-compiler-knowledge.md:176-195`;
`07-testing-strategy.md:77-100`

**Codebase Evidence:** `packages/codegen/src/il/optimizer/pass.ts:10-14` asserts semantic
preservation, while representative tests such as
`packages/codegen/src/il/optimizer/remove-unreachable-blocks.spec.test.ts:8-17` can prove output
shape without providing a general semantic oracle.

**The Problem:** Preconditions, one counterexample, and a plausible before/after sequence are not a
correctness proof. They can miss width boundaries, flag states, aliases, volatile traces,
pass-order interactions, and helper/ABI effects.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Require two expectations for every optimization: an optimization expectation for the intended assembly/cost and an independent behavioural expectation derived from language/CPU/platform semantics. Execute or otherwise evaluate optimized output against both. Unoptimized-versus-optimized differential execution is supporting evidence, never the sole oracle because both paths may share a lowering bug. Observable behaviour includes results, memory, MMIO access count/order, live ABI/flag/interrupt state, and timing where timing is explicitly observable. Select exhaustive, boundary, direct-oracle, or VICE methods proportionally. | Proves both that the intended optimization occurred and that the changed machine program still implements the required program, without requiring one universal harness. | Each rule must state its observable contract and choose a decisive test method; goldens alone are insufficient. |

Shape-only goldens were rejected as sole proof because they preserve expected text, not program
meaning.

**Recommendation:** **Option A — the only viable option.** Every optimization must satisfy both the
correctness expectation and the assembly/cost expectation. Comparing optimized and unoptimized
output is useful, but cannot replace an independent correctness oracle.

**Confidence:** High. **Hardening:** added explicit proportionality and, after user clarification,
separated behavioural correctness from optimized shape/cost while preventing a shared lowering bug
from validating itself. **Challenger:** converged on semantic proof; the user supplied the final
two-expectation formulation.

**User Decision:** Resolved — User accepted refined Option A on 2026-09-04. Every optimization must
meet an independent behavioural expectation and its intended optimized assembly/cost expectation;
differential comparison with unoptimized output is supporting evidence rather than the sole oracle.

---

### PF-018: Red-baseline case list omits its selective-loading discriminator 🟡 MINOR

**Dimension:** Consistency

**Location:** `03-07-qualification-and-release.md:98-107`; `07-testing-strategy.md:43-54,145-150`

**The Problem:** The prose says the red baseline includes selective-loading behavior, but the
authoritative ID subset omits Q-R12. Q-R04 requires a broad module union and does not reject loading
unrelated modules, so it cannot prove the narrow negative behavior.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add Q-R12 to the red-baseline subset. | Makes the executable list match the stated purpose. | One additional baseline evaluation. |

**Recommendation:** **Option A — the only viable option.** Removing the prose claim would weaken the
baseline rather than correct it.

**User Decision:** Resolved — User accepted Option A on 2026-09-04. Add Q-R12 to the initial
red-baseline subset as the single directed check that the legacy skill fails narrow selective
loading; do not add compiler tests or a runner.

---

### PF-019: `quick_validate.py` is credited with checks it does not perform 🟡 MINOR

**Dimension:** Codebase Alignment

**Location:** `02-current-state.md:34-37`

**Codebase Evidence:** `/home/gevik/.codex/skills/.system/skill-creator/scripts/quick_validate.py:19-117`
checks `SKILL.md` presence, frontmatter/name/description rules, and unfinished TODO markers. It does
not traverse references, parse links, validate `agents/openai.yaml`, or check tree topology.

**The Problem:** Release evidence could overstate what the validator proves, although the plan does
schedule separate link and tree checks.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Describe `quick_validate.py` narrowly as a `SKILL.md` frontmatter/basic-content validator and retain separate topology, link, metadata, and reference checks. | Makes evidence claims exact without changing execution. | None material. |

**Recommendation:** **Option A — the only viable option.** The existing separate checks already
cover the missing concerns.

**User Decision:** Resolved — User accepted Option A on 2026-09-04. Describe `quick_validate.py`
narrowly as a basic `SKILL.md` validator and retain separate, touched-surface checks for topology,
links, metadata, sources, and qualification files; add no framework or compiler tests.

## Iteration-2 Verification of Prior Findings

| Finding | State | Re-scan evidence |
|---|---|---|
| PF-001 | Corrected; external prerequisite remains explicit | `03-02-blend65-compiler-knowledge.md:31-35`, `03-07-qualification-and-release.md:74-89`, and `99-execution-plan.md:312-315` keep conflicted semantics blocked, record the exact ruling/reconciled-commit evidence, and exclude compiler behavior from authority. |
| PF-002 | Corrected | `03-07-qualification-and-release.md:74-82` and `99-execution-plan.md:130-138` freeze external-fact oracles only after Phase-2 evidence pinning and before dependent knowledge. |
| PF-003 | Corrected after one residual fix | `03-07-qualification-and-release.md:158-179`, `07-testing-strategy.md:42-52`, and `99-execution-plan.md:330-336` now require a fresh one-shot evaluator in an operating-system filesystem sandbox, an allowlisted packet, no repository/workspace mount, positive/negative access controls, mount/hash evidence, and a separate grader. `/usr/bin/bwrap` 0.9.0 is available locally. |
| PF-004 | Corrected after one residual fix | `07-testing-strategy.md:210-228` and `99-execution-plan.md:145-149,320-323` allocate exact content-only subsets to Phases 2–6 and reserve router/response/version/freeze/release/errata cases for the integrated Phase-7 candidate. |
| PF-005 | Corrected after one residual fix | `03-07-qualification-and-release.md:181-203` and `99-execution-plan.md:324-350` order independent review/correction before the definitive isolated suite and migration. |
| PF-006 | Corrected | `03-04-c64-platform-and-game-knowledge.md:151-159`, `03-06-evidence-and-source-governance.md:18-22,97-110`, and `AGENTS.md:252-258` separate configured VICE evidence from targeted physical-hardware evidence. |
| PF-007 | Corrected after one residual fix | `03-01-router-and-baseline-governance.md:124-143`, `03-07-qualification-and-release.md:124-144`, and `99-execution-plan.md:107-114` pin the untouched legacy identity first, run the red baseline against that exact isolated copy, and only then install the unqualified quarantine router. |
| PF-008 | Corrected after one residual fix | `03-01-router-and-baseline-governance.md:145-152`, `03-07-qualification-and-release.md:181-203`, and `99-execution-plan.md:340-350` use a qualified isolated Candidate Pre-delete Gate followed by atomic migration and byte-identity live gates. |
| PF-009 | Corrected after one residual fix | `03-07-qualification-and-release.md:91-94,187-228` and `99-execution-plan.md:330-364` finish all evidence writes before the Candidate Pre-delete Gate, forbid later evidence finalization, define the exact content checkpoint, and isolate the two-step release tail. |
| PF-010 | Corrected | `99-execution-plan.md:9-42` has seven executable phase checkboxes and 60 non-checkbox substeps; `AGENTS.md:39-50` and `07-testing-strategy.md:230-241` apply impact-based verification and exclude the unrelated compiler suite from this Markdown-only feature. |
| PF-011 | Dismissed by accepted product clarification | `AGENTS.md:63-69`, `00-index.md:89`, and `03-04-c64-platform-and-game-knowledge.md:133-149` make the feasibility snapshot optional, removable, and non-authoritative. |
| PF-012 | Corrected | `03-01-router-and-baseline-governance.md:154-189`, `03-07-qualification-and-release.md:230-253`, and `AGENTS.md:243-251` define one latest-qualified active version, one working-tree `release.md`, semantic-version bumps for substantive changes, and Git history for older releases. |
| PF-013 | Corrected | `03-05-toolchain-portability-and-recovery.md:167-185` and `03-06-evidence-and-source-governance.md:125-136` record skill version, content commit, knowledge heading, source keys, and targeted downstream impact dispositions without a registry. |
| PF-014 | Corrected | `03-02-blend65-compiler-knowledge.md:124-152` and `AGENTS.md:114-124` make SFA the final function-storage closure while keeping global/asset/platform placement outside SFA. |
| PF-015 | Corrected | `03-02-blend65-compiler-knowledge.md:154-173` and Q-L17/Q-L18 in `07-testing-strategy.md:91-92` cover transitive and same-callee nested-argument staging without inventing recursion or alien source restrictions. |
| PF-016 | Corrected | Q-L19..Q-L24 in `07-testing-strategy.md:93-98` cover semantic interactions for widths, constant/runtime rules, short-circuit effects, aliasing, initialization, and diagnostic/no-binary behavior. The suite now has 92 derived cases rather than a fixed quota. |
| PF-017 | Corrected | `03-02-blend65-compiler-knowledge.md:220-233`, Q-C21 in `07-testing-strategy.md:126`, and `AGENTS.md:177-182` require independent behavior and assembly/cost expectations; differential execution is supporting evidence only. |
| PF-018 | Corrected | `07-testing-strategy.md:171-177` and `99-execution-plan.md:107-110` include Q-R12 in the red baseline. |
| PF-019 | Corrected | `03-07-qualification-and-release.md:13-29` and `07-testing-strategy.md:179-208` state the narrow validator scope and keep topology, links, metadata, source, qualification, and path checks separate. |

## Iteration-2 Dimension Result

| Cluster | Dimensions/lenses | Result |
|---|---|---|
| Document soundness | 1 Ambiguities, 3 Logical Contradictions, 12 Consistency; compiler/language lens | Five residuals survived refutation and were corrected under their already accepted PF decisions. One new contradiction survived as PF-020. |
| Grounding | 2 Implicit Assumptions, 13 Codebase Alignment; data/migration integrity | One PF-003 residual survived and was corrected with enforced filesystem confinement. All other grounding claims passed. |
| Delivery logic | 4 Completeness, 5 Dependencies, 11 Ordering | No additional finding after the residual ordering, evidence-finalization, case-allocation, and legacy-pin corrections. |
| Risk and operations | 6 Feasibility, 8 Security, 9 Edge Cases | No additional finding. External content is untrusted; fixed probes are repository-owned; sandbox access is allowlisted and must pass a negative control; no new service, dependency, or permanent runner is added. |
| Fit and verification | 7 Testability, 10 Scope Creep | No additional finding. Exact case IDs, gates, expected invariants, path boundaries, and impact-based checks are executable without expanding into compiler implementation or a second support product. |

Deterministic re-scan checks found 13 target plan documents, 7 phase checkboxes, 60 retained
substeps, 92 uniquely defined cases (`R12 + L26 + C21 + P16 + A17`), 50 specification Markdown
files, 24 valid relative links, and no `spec/` change. The current skill passes
`quick_validate.py`; `agents/openai.yaml` parses; touched Markdown passes Prettier; and
`git diff --check` is clean. Compiler/package/readiness tests were intentionally not run because
this change touches only planning, skill-governance, and repository-guidance Markdown.

---

### PF-020: Data-duplication doctrine contradicts the project prime directive 🟠 MAJOR

**Dimension:** Logical Contradictions

**Location:** `03-04-c64-platform-and-game-knowledge.md:43,128-135`; `AGENTS.md:173-179`

**The Problem:** The plan's memory-coverage table and project directive categorically prohibit
duplicate RAM assets, while the plan's detailed doctrine allows byte duplication when a measured
timing/access benefit justifies its memory cost. These rules cannot govern the future skill
together. This is not merely wording: the absolute rule and the measured-tradeoff rule can produce
opposite compiler/platform-layout decisions and can conflict with the higher-level expert parity
requirement.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Refine `AGENTS.md` and the plan's absolute coverage-table wording to forbid unaccounted/default duplication while permitting deliberate compile-time duplication only when hardware visibility or measured timing makes it the best expert result. Require proof that placement/banking/pointer changes cannot meet the same need, identify the consumer and visibility constraint, account bytes and timing, keep runtime hot-path copying disfavored, and distinguish identical-data duplication from buffers holding different evolving states. | Preserves placement-first discipline without banning valid C64 memory-for-cycles or cross-bank choices. Keeps the skill able to judge each case from hardware visibility and measured total cost. | Replaces a simple absolute with a bounded exception that must be evidenced. |
| B | Keep the absolute `AGENTS.md` ban and remove the plan's duplication exception. | Maintains the strictest possible RAM-discipline rule. | Can reject an expert result even when deliberate duplication is the only or best way to satisfy VIC-visible placement or a measured timing budget. |

**Recommendation:** **Option A — best option.** The important invariant is placement before copying
and no duplication for compiler convenience. The C64 VIC-II sees one 16 KiB bank at a time, so
hardware visibility and switching constraints can make a measured duplication tradeoff legitimate.
That technical constraint is documented in the Commodore 64 Programmer's Reference Guide; the
recommendation that the compiler sometimes permit duplication is an inference from that constraint
plus the project's expert-output objective, not a verbatim rule from the manual.

**Confidence:** High. **Hardening:** an independent document-soundness auditor found the conflict;
the main review second-guessed the auditor's proposed absolute-ban remedy against the expert C64
objective, and an independent recommendation challenger converged on Option A with the stricter
necessity, consumer, visibility, byte-cost, and timing-evidence threshold.

**User Decision:** Resolved — User accepted Option A on 2026-09-04.

**Iteration-3 Evidence:** `AGENTS.md:173-179` now makes placement the default and bounds static
replication by necessity and measured cost. The coverage, doctrine, and failure conditions use the
same rule at `03-04-c64-platform-and-game-knowledge.md:43,128-135,187-190`.
`07-testing-strategy.md:100,134,143` guards SFA separation, convenience-copy rejection, necessary
replication, measured cost, and distinct evolving buffers. An independent focused reviewer found
no residual contradiction, ambiguity, scope creep, or untestable exception.

## Iteration-4 Game-Technique Amendment

The user accepted AR-33: the skill is development-time expertise, while the finished compiler must
encode game techniques as deterministic algorithms, cost models, target facts, zero-cost APIs,
local contracts, or diagnostics. The amendment reused the existing thirteen-reference, five-case-
file, seven-phase topology and increased the risk-derived case inventory from 92 to 100 without
adding a framework, dependency, runner, compiler implementation, or runtime AI requirement.

| Cluster | Dimensions/lenses | Result |
|---|---|---|
| Document soundness | 1 Ambiguities, 3 Logical Contradictions, 12 Consistency | PF-021 survived independent refutation; corrected and rechecked. |
| Grounding | 2 Implicit Assumptions, 13 Codebase Alignment | PF-023 survived independent refutation; corrected and rechecked. All 100 IDs are unique and the skill has no compiler-runtime dependency. |
| Delivery logic | 4 Completeness, 5 Dependencies, 11 Ordering | PF-021 independently confirmed; PF-022 survived refutation; both corrected and rechecked. |
| Risk and operations | 6 Feasibility, 8 Security, 9 Edge Cases | No finding. Writable-code, IRQ, timing, silicon-risk, emulator, and physical-hardware boundaries are explicit. |
| Fit and verification | 7 Testability, 10 Scope Creep | No finding. Existing files/cases/phases carry the amendment; no new support product appears. |

### PF-021: Three technique families lacked deterministic realization cases 🟠 MAJOR

**Dimensions:** Completeness and Consistency

**Location:** `03-04-c64-platform-and-game-knowledge.md` Game Technique Casebook;
`07-testing-strategy.md` Q-P11/Q-P15/Q-P16

**Problem:** Audio, loader/assets, and engine structures were mandatory families, but their cases
tested only partial domain facts. The suite could pass while those families remained descriptive
lore rather than implementable compiler/API decisions.

**Recommendation:** Strengthen the three existing representative cases; add no cases or artifacts.

**User Decision:** Accepted on 2026-09-04.

**Correction Evidence:** Q-P11 now requires SID cadence/IRQ/voice/table/revision facts, disposition,
complete cost, and independent proof. Q-P15 does the same for loading/decompression/asset
transformation and artifact/runtime behavior. Q-P16 covers fixed pools, data layout, collision,
dispatch, function-pointer/SFA consequences, deterministic disposition, and proof. Independent
focused review found no residual.

### PF-022: External oracles froze before independent source review 🟠 MAJOR

**Dimension:** Ordering and Sequencing

**Location:** `03-06-evidence-and-source-governance.md` Research and Distillation Procedure;
`03-07-qualification-and-release.md` Qualification Oracle Lifecycle; `99-execution-plan.md` 2.3

**Problem:** Phase 2 made externally sourced oracle fields immutable before the only explicitly
independent source/oracle-integrity review. A mistaken interpretation could shape dependent content
without a defined correction path.

**Recommendation:** Require bounded independent source-to-oracle review before freeze. If stronger
evidence later proves a factual defect, reopen only that authority gate and invalidate its dependent
content/results before correction and refreeze; never weaken an oracle to fit authored guidance.

**User Decision:** Accepted on 2026-09-04.

**Correction Evidence:** Evidence governance, oracle lifecycle, Phase 2.3, and validation now encode
the pre-freeze review and bounded reopen path. An independent focused reviewer found no residual
and confirmed compatibility with active-release versioning and impact audit.

### PF-023: Q-A17 had contradictory phase ownership 🟡 MINOR

**Dimensions:** Implicit Assumptions, Consistency, and Ordering

**Location:** `07-testing-strategy.md` Q-A17 and Focused Evaluation Order;
`99-execution-plan.md` 2.6, 6.6, and 7.3

**Problem:** Phase 6 assigned Q-A17 while other plan text reserved the whole case for Phase 7.

**Recommendation:** An independent challenge found the strongest correction: keep one case with an
explicit Phase-6 portability-content facet and Phase-7 version/release integration facet; grade the
union once in the definitive suite.

**User Decision:** Accepted on 2026-09-04.

**Correction Evidence:** The case definition, focused-run table, reservation prose, and execution
steps use the same facet split. A first focused review found one stale summary sentence; it was
corrected under the accepted ruling, and the second review found no remaining contradiction.

Deterministic Iteration-4 checks found 13 target plan documents, 7 phase checkboxes, 60 retained
substeps, and 100 unique cases (`R12 + L26 + C24 + P21 + A17`). The target digest above excludes
this report and temporary notes.

## Decision and Rescan State

- PF-001..PF-023 are closed: twenty-two accepted corrections are applied and verified; PF-011
  remains dismissed.
- PF-001's specification-consistency work remains an explicit execution prerequisite. This plan
  records and enforces it but does not authorize a `spec/` edit.
- Iteration 4 completed the accepted amendment and converged after one bounded residual correction.
- The full plan is `Plan Preflighted`; execution may start with Phase 1 when requested.
