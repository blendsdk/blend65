# Preflight: keyboard and combined-input plan

> **Status**: PASSED — five MINOR drafting findings corrected and directly verified; none unresolved
> **Iteration**: 1, with direct correction rechecks
> **Artifact**: the nine plan documents listed below; reports and continuity notes excluded
> **Baseline**: `2a2eda75`
> **Last Updated**: 2026-10-10 09:40 CEST
> **CodeOps Artifact Schema**: 1

SAME-SESSION REVIEW: This artifact was created in the current session.
Same-agent bias risk is elevated. Fresh independent contexts reduce, but do not
erase, that risk. A later fresh-session or human domain review may increase
confidence; this audit does not claim independent runtime qualification.

## Scope and codebase context

Strict scope, normal authority; no auto-design or optional scope exploration.
The target is this plan's register, index, requirements, current-state document,
three component documents, testing strategy and execution plan. Context includes
AGENTS/routing/configuration, R5.24/R5.25 and AC-19/AC-20, the feature roadmap,
selected frozen language/CPU/platform clauses and actual producer/consumer paths.
Only target-local drafting corrections, this report and derived feature-roadmap
bookkeeping are modified. Context, compiler, tests, portfolio and frozen authority
are not amended.

Original goal: named keyboard and both-port joystick queries over one saved
acquisition. Smallest design: extend the existing ordinary-source `c64.input`
module, pure saved queries and the existing scoped acquisition/NMI mechanism.
AR-P12 authorizes exactly three bounded existing-consumer correction families.
AR-P6 is the sole old-specification-test exception. No new pass, IR kind, solver,
runtime, owner-admission mechanism, API, dependency or harness is introduced.

Observed stack: TypeScript 7.0.2, Node 22+, Yarn classic 1.22.22, real Turbo
workspace builds and Vitest. Existing installed-source preparation feeds the
frontend and current scalar/index/aggregate/call consumers; storage requests close
before emission. The public fixture and VICE interfaces already exist. Native
matrix/RESTORE qualification reuses the existing GDB/VICE device procedure, not a
new binary-monitor API. The present library still exports only six masks.

Key reconstruction paths are recorded in [02-current-state.md](02-current-state.md#production-facts):
the installed module, bundled loader, profile declarations, lowering/value
owners, two ownership-fact owners and the existing export inventory. Additional
checks examined storage closure, public fixture interfaces, source-generation
identity and selected implementation tests. This is bounded reconstruction, not
an exhaustive repository audit.

## Scan coverage

| #   | Dimension               | Findings | Result                                                            |
| --- | ----------------------- | -------- | ----------------------------------------------------------------- |
| 1   | Ambiguities             | 0        | Clear at the approved conditional contract                        |
| 2   | Implicit assumptions    | 0        | Actual source/fixture/ownership boundaries checked                |
| 3   | Logical contradictions  | PF-002   | Corrected specification-versus-implementation wording             |
| 4   | Completeness gaps       | 0        | Complete surface, fallback and qualification obligations present  |
| 5   | Dependency issues       | PF-001   | Corrected three heading targets                                   |
| 6   | Feasibility concerns    | 0        | Existing consumer and native-input routes grounded                |
| 7   | Testability             | PF-004   | Corrected ordinary-call authority pointers                        |
| 8   | Security blind spots    | 0        | No new host boundary; existing input/path guards retained         |
| 9   | Edge cases              | 0        | Conditional owner, PBON, nested NMI and saved uncertainty covered |
| 10  | Scope creep indicators  | 0        | No unapproved support mechanism or output waiver                  |
| 11  | Ordering and sequencing | PF-003   | Uncommitted construction distinguished from publication           |
| 12  | Consistency             | 0        | Current decisions, source names and task vocabulary aligned       |
| 13  | Codebase alignment      | PF-005   | Compatibility claim bounded to noncolliding contributions         |

| Severity    | Count | Disposition                                                  |
| ----------- | ----- | ------------------------------------------------------------ |
| CRITICAL    | 0     | None                                                         |
| MAJOR       | 0     | None                                                         |
| MINOR       | 5     | Exact target-local corrections applied and directly verified |
| OBSERVATION | 0     | None                                                         |

## Findings and correction authority

These are plan-owned clerical/clarity choices under AGENTS workflow prime
directive #4 and the standing scoped correction authority. They are not new
user-attributed PF approvals, complexity approvals or test-oracle exceptions.
The single best remedy in each case is to correct the draft to the existing
approved contract. Keeping known false pointers or contradictory wording is not
a viable alternative; adding machinery would not solve the drafting defect.

### PF-001: three heading links 🟡 MINOR

**Dimension:** Dependency issues. **Location:** the testing links in
[03-01](03-01-output-corrections.md) and [03-03](03-03-acquisition.md), plus
03-03's scoped-ingress authority link.

**Problem:** file targets existed, but three fragments omitted the actual emoji
or em-dash-derived slug. File-only validation could not detect this.
**Recommendation:** correct only the three fragments.
**Decision:** root made the plan-owned mechanical correction.
**Verification:** the base reviewer directly resolved all 18 intra-target
heading links; no new target or scope was added.

### PF-002: old-test wording 🟡 MINOR

**Dimension:** Logical contradictions. **Location:**
[execution preamble](99-execution-plan.md#implementation-phases).

**Problem:** “no old test changes” contradicted the explicitly planned focused
extensions to existing implementation tests.
**Recommendation:** state that existing specification tests remain unchanged
except AR-P6; preserve valid negative/effect guards in named implementation tests.
**Decision:** root corrected the distinction, not the oracle authority.
**Verification:** base and grounding checks found no remaining inconsistency.

### PF-003: worktree construction versus publication 🟡 MINOR

**Dimension:** Ordering and sequencing. **Location:**
[acquisition publication paragraph](03-03-acquisition.md#activation-and-qualification)
and [Session 2.2](99-execution-plan.md#session-22--ordinary-source-implementation).
**Codebase evidence:** `packages/compiler/src/frontend/bundled-sources.ts:13,32,95`
loads the actual installed source; ordinary fixtures need that worktree candidate.

**Problem:** the draft said to qualify fixture modules before adding installed
source, while tasks correctly build that source before qualification. The
complete-checkpoint rule already prevented partial shipping, so this was not a
demonstrated publication defect.
**Recommendation:** construct the exact installed-source candidate uncommitted;
publish only the complete coherent phase after native qualification, full checks
and independent review.
**Decision:** root applied this wording only; no duplicate fixture or new task.
**Verification:** delivery reviewer directly rechecked both paragraphs and their
2.3.2/2.3.4 dependencies; PA-001 resolved.

### PF-004: ordinary-call authority pointers 🟡 MINOR

**Dimension:** Testability. **Location:** ST-7/ST-8 in
[07-testing-strategy.md](07-testing-strategy.md#-specification-test-cases).
**Codebase/spec evidence:** frozen `spec/06-functions.md:111,160,286,479`.

**Problem:** Chapter 06 §7 governs interrupt functions, not ordinary aggregate
borrows, caller-owned returns or nested argument order. A blind test author
could receive the wrong clauses despite correct component prose.
**Recommendation:** cite FN-3/FN-4 and §5.4 for ST-7, FN-3/FN-10 and §5.4 for ST-8.
**Decision:** root corrected only those two authority cells.
**Verification:** independent semantics reviewer checked the new pointers
against the frozen clauses; SM-001 resolved.

### PF-005: overbroad unchanged-source promise 🟡 MINOR

**Dimension:** Codebase alignment, compatibility/data-migration domain.
**Location:** [index compatibility paragraph](00-index.md#documents).
**Codebase/spec evidence:** frozen `spec/10-modules.md:47`, protected merged-user
contribution `test/rd05/bundled-input-library.spec.test.ts:278` and ordinary
duplicate-declaration detection `packages/compiler/src/frontend/modules.ts:536`.

**Problem:** an old user contribution named `Key` in `c64.input` is legal against
the mask-only module but collides with the approved new enum. Thus the blanket
claim that all old source recompiles unchanged was false. This does not challenge
the approved nine names or require a namespace/loader redesign.
**Recommendation:** preserve legacy APIs and noncolliding contributions; explain
normal E10003 and renaming/moving a conflicting user declaration on upgrade.
**Decision:** root corrected that sentence only, retaining ordinary module rules
and accepted API/old-oracle scope. The counterexample was statically established,
not executed.
**Verification:** compatibility reviewer directly checked the corrected index
paragraph; PA-001 resolved. Actual loader/binder/package/test/source paths remain
unchanged.

## Independent review boundaries

| Fresh context                             | Assigned boundary                                                                    | Outcome                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `keyboard_plan_soundness` / correctness   | Dimensions 1/3/12; base correctness, maintainability, standards and oracle integrity | No findings; PF-001/PF-002 rechecked                    |
| `keyboard_plan_grounding` / preflight     | Dimensions 2/13, including all ten alignment subchecks                               | No findings                                             |
| `keyboard_plan_delivery` / preflight      | Dimensions 4/5/11                                                                    | PF-003 only; direct recheck resolved                    |
| `keyboard_plan_risk` / platform           | Dimensions 6/8/9                                                                     | No surviving findings                                   |
| `keyboard_plan_fit` / emitted output      | Dimensions 7/10                                                                      | No findings; equal-contract local targets reconstructed |
| `keyboard_plan_semantics` / semantics-DX  | Compiler/language domain                                                             | PF-004 only; direct recheck resolved; no DX finding     |
| `keyboard_plan_concurrency` / SFA-ABI     | Asynchronous concurrency domain                                                      | No findings at the conditional planning boundary        |
| `keyboard_plan_compatibility` / preflight | Source compatibility/data-migration domain                                           | PF-005 only; direct recheck resolved                    |

Reviewers attempted refutation against current contracts, actual source or raw
retained artifacts. No second full review team was added. Docs-only execution
audits for host performance/security are skipped; the applicable preflight risk,
source compatibility and base lenses still run. No new service/auth boundary is
introduced.

Incidental historical routing setup summaries and, for some reviewers, prior
register/T-05 or release summaries were visible. They were disclosed and excluded
from decisive checks. No grader, qualification-case body or manifest oracle map
was used. This is not claimed to be fresh blind runtime qualification.

Expert lineage: active qualified/frozen **2.0.4**, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; router SHA-256
`0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8`;
Specification `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Selected normative headings cover semantic/const/index/evaluation preservation,
ABI/final closure, interrupt routes, emitted flags/address/call/volatile effects,
CIA ports and stock NMI handback, and equivalent-work evidence. Governing keys:
`BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `MOS-HW-1976`, `MOS-6510-1982`,
`MOS-6526-1981`, `CBM-C64-PRG-1982`, `CBM-C64-KERNAL-03`,
`VICE-310-SOURCE`, `ACME-097-R266`.

## Verification and limits

The final fresh foundation check passed 12/12, zero skips, on 2026-10-10 at
09:42 CEST. Final targeted formatting, file and heading links, nine content hashes,
29 unique tasks (13/16), 24 specification cases, 64 distinct key names, normative
source keys, whitespace and protected-path checks pass.
Raw log retained outside `/tmp` at
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-plan-check.hzunZt/foundation-final.log`.
The feature count remains 4/10 RDs Done; the
pre-existing portfolio count mismatch is integration bookkeeping, not silently
rewritten by this feature-branch plan.

Plan acceptance is not acquisition, decoder, emitted-byte, whole-program parity,
VICE or silicon acceptance. The four cooperative PRG profiles use NMOS 6510,
stock 901227-03, cooperative `$06`, ACME 0.97 and VICE 3.10. Complete costs,
private-home closure and actual saved-input/native matrix/RESTORE behavior remain
Unknown until the planned tests and sequential executions run. External nesting,
aggregate stack, retained-ROM completion and finite deadlines remain unproved.
Physical revision/settling/edge behavior stays RD-10 hardware-unverified.

## Passed revision identities

These are the corrected, directly checked SHA-256 identities. The report is not
part of its own target identity set.

| Target document               | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `00-ambiguity-register.md`    | `ba574b5dfba2a636ddd15ce3c1a02e9f74a49cd5e03fa730a1e90d272e60dc86` |
| `00-index.md`                 | `ef823732898c9e99213dee7f9fafb1b835e8dd15c520007c3ba0a072428ce542` |
| `01-requirements.md`          | `8e298b8527b9f6f33a5b3aea4e68b7f87d89ad5c22f65a5e6e0ece9a1a8f8cbd` |
| `02-current-state.md`         | `b92e5aec475f9de177e08404b62872f39eb12b687a6de393296dc8336a9d33b5` |
| `03-01-output-corrections.md` | `e32630dc96187760ee1a07aabe464b498569cef2c2294ce69676bc188573e356` |
| `03-02-saved-input.md`        | `b54469960003c654e5c69dba8bf46e6f77e99096893ee2f66e53d687bc3db4ba` |
| `03-03-acquisition.md`        | `deb73b4f4432dcc001f7e5e424caf9237a6819f3b48d2670b3e25f2dde813cdc` |
| `07-testing-strategy.md`      | `a2444e9b3c05b2e34afda1d6805494aff9a51c3f81019041427539d6f96527ab` |
| `99-execution-plan.md`        | `c9a4c9dea7b3553fe52e360d64684e553d6fe317a18f79e0fe6b01ea16ccbe53` |

Future consumption must compare these identities and directly recheck changed
sections; metadata/progress changes do not silently inherit a stale pass.
