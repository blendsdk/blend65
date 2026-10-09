# Execution: source-library reachability prerequisite

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-09 12:34 CEST
> **Progress**: 9/10 tasks (90%)
> **CodeOps Artifact Schema**: 1
> **Scope mode**: strict

## Implementation phases

| Phase | Title                                  | Tasks |
| ----- | -------------------------------------- | ----- |
| 1     | Existing executable closure correction | 10    |

The remaining-RD-05 effort waiver applies. State recommended effort for each task; no repeated
effort pause. Use coherent green local commits through the git-commit skill; never push without
an explicit new request. Prior keyboard AR-P7 approval covers only this bounded support surface.

**Execution rule:** These task marks are the sole progress authority. Mark `[~]` on implementation
with the actual timestamp, promote `[x]` only after its verify passes, update Progress/Last Updated
immediately. Resume first `[~]`, otherwise first `[ ]`. Use `[!]` and `Blocked: reason` for a
real blocker. Each task occurs once. No broken/red checkpoint is committed.

## Phase 1: closure correction

> **Phase baseline tree**: `0ed834a7ce1021214ca5066e80b4912f66015f76`
> **Lenses**: compiler/language; concurrency (selected callback roots); data/compatibility.
> **Expected modification set**: named semantic producers/closure helper and implementation tests;
> AR-8's exact fixed-address selections in `machine/lower-memory.ts`, complete physical ZP
> classification in `services/memory-evidence-records.ts` and focused implementation tests;
> new `test/rd05/source-library-*.spec.test.ts` and only a small shared fixture if ordinary test
> size requires it; this plan's progress/review/closeout, keyboard register and feature roadmap.
> **Scope**: strict; current executable closure only, no runtime, library mode or old spec-test edit.

Execution entry: all required documents and six closed decisions directly checked; final
preflight digest `1134c17e20496311f4bf28ce356bdc630f63dced9ce0a736ad51a5d6facbae02`
passed with no unresolved critical/major finding. Baseline captured after green planning commit
`a02114dc`; later progress/evidence bookkeeping is not a change to the reviewed technical contract.

### Step 1.1: specification tests

- [x] 1.1.1 [spec-author] Write root specs ST-1–5 — `test/rd05/source-library-reachability.spec.test.ts`, ordinary-size split `source-library-roots.spec.test.ts` and small `source-library-fixture.ts`; source: [test strategy](07-testing-strategy.md). ✅ (completed: 2026-10-08 21:25; blind author recovery verified 12 intended RED / 16 prepasses, no syntax/tool error)
- [x] 1.1.2 [spec-author] Write data/output specs ST-6–16 — `test/rd05/source-library-observability.spec.test.ts`, `test/rd05/source-library-output.spec.test.ts` and ordinary-size identity/indexed/raw-footprint splits; source: [test strategy](07-testing-strategy.md). ✅ (completed: 2026-10-08 21:53; 296 independently authored cases, qualified RED report and documentation/formatting hygiene checked)
- [x] 1.1.3 Run new directed specs and record each red/pass justification before implementation. ✅ (completed: 2026-10-08 21:56; final combined 324 cases verify 168 intended failures / 156 preservation prepasses, no syntax/tool/metadata-guard error)

**Verify:** Directed new cases; implementation-blind authorship and unchanged old oracles.

### Step 1.2: implementation

- [x] 1.2.1 Correct executable/assignment entry classification — `semantic/whole-program.ts`, `semantic/function-targets.ts`; [closure §Executable roots](03-01-reachability.md#executable-roots-ar-24), AR-2/4. ✅ (completed: 2026-10-08 21:59; build/typecheck, all 28 root VICE/spec cases and ten finite-target implementation cases pass; formatting/documentation checks clear)
- [x] 1.2.2 Retain real global visibility metadata — `semantic/operations.ts`, `semantic/lower.ts`; [closure §Private data](03-01-reachability.md#private-data-ar-34), AR-3/4. ✅ (completed: 2026-10-08 22:01; build/typecheck, 20 semantic/finite-target cases and formatting/documentation checks pass; all three producer branches inspected)
- [x] 1.2.3 Select proved cold data before consumers — focused semantic helper and `semantic/whole-program.ts`; [closure](03-01-reachability.md), AR-3–5. ✅ (completed: 2026-10-09 11:57; build/typecheck, prior directed 20 semantic/target and 56 storage cases, and all 324 final-byte public consumer cases pass)
- [x] 1.2.4 Run all new specification cases green; fix implementation only, including the exact approved AR-8 output/evidence corrections. ✅ (completed: 2026-10-09 11:57; all 324 final-byte cases pass, no skips; original source/effect/cost expectations preserved)

**Verify:** Typecheck and directed root/data/target/storage tests for each implementation task;
all new specs after the complete correction. Preserve immutable oracles.

### Step 1.3: implementation tests and hardening

- [x] 1.3.1 Add internal boundary/scaling tests and correct export-only implementation expectation — `semantic/whole-program.impl.test.ts` and focused `*.impl.test.ts`; AR-3–6 and approved AR-8. ✅ (completed: 2026-10-09 12:06 CEST; internal build and all 55 directed cases pass, including 31 new cases; deterministic identity/conversion-work bounds avoid load-sensitive deadlines)
- [x] 1.3.2 Run full checkpoint, actual artifact/resource controls and sequential runtime witnesses — existing verification commands from [test strategy](07-testing-strategy.md). ✅ (completed: 2026-10-09 12:34 CEST; install/build/typecheck and all 5,556 owned tests pass; only two existing package skips; formatting/link/freeze checks pass; VICE sequential)
- [ ] 1.3.3 Complete applicable independent phase reviews, fix-only verification and bounded closeout — this plan, keyboard register and feature roadmap; AR-1/6.

**Verify:** Frozen install/build/typecheck/full Linux tests; targeted formatting/links and frozen
authority checks. Independent reviews consume the complete phase diff and exact evidence.

## Dependencies and completion

One phase; tasks execute in listed order, with all spec authoring/red complete before code changes.
Complete when all ten marks verify, the accepted artifact/resource bounds and retained effects are
proved, reviews have no unresolved critical/major findings, and downstream keyboard planning
names the finished prerequisite. This does not close RD-05 or qualify keyboard acquisition.

## Execution evidence

Server restart recovered three authored root-test files; no implementation existed. A fresh
implementation-blind author inspected only those drafts, public test helpers/conventions,
standards and the supplied contracts. No forbidden compiler/implementation-test/qualification
file was read. The new ST-1 draft's unintended module global was removed before RED to match
the specified private-local witness; an overlapping raw RAM output intentionally forbids cold
global removal. The initializer trace starts at its first helper entry, excluding prior host
startup activity while preserving both exact source writes. Neither correction matches an
implementation or weakens an old oracle.

Root RED: 2026-10-08 21:23:42 CEST; 64.24 seconds; 28 cases, 12 intended failures / 16 prepasses.
Git-private log: `source-reachability-planning.X4uAlv/spec-roots-red.log`. All four profiles:

| Case                    | Result | Independent expectation / prepass reason                                       |
| ----------------------- | ------ | ------------------------------------------------------------------------------ |
| ST-1                    | RED    | Unused routine is emitted; private-local and complete-artifact bound violated. |
| ST-2                    | PASS   | Direct/helper values 12/20 and exact writes 7/11 already preserved in VICE.    |
| ST-3 assigned callback  | RED    | Ordinary caller assignment is rejected with E10277.                            |
| ST-3 cold-owner address | RED    | Addressed target remains, but cold owner is emitted.                           |
| ST-3 unassigned guard   | PASS   | Check/build reject E10277; no generation.                                      |
| ST-4                    | PASS   | Explicit initializers write 17 then34 exactly once before main.                |
| ST-5                    | PASS   | Selected IRQ/helper/global/link execute and the vector restores.               |

New tests remain uncommitted until a coherent green implementation checkpoint. Specification
authorship completion is not runtime qualification of the still-failing correction.

Data/output RED: 2026-10-08 21:49:58 CEST; 48.90 seconds; 296 cases, 156 failures / 140 prepasses.
Git-private raw log: `source-reachability-planning.X4uAlv/spec-data-red.log`. The earlier 160/136
run's log was overwritten by the blind author; only its reported fixture-error summary survives,
not an independently preserved raw log. Exact AR-7 new-fixture corrections explain that difference.
All old tests and production code remain unchanged. The small new helper's final strict metadata
guards prevent vacuous omission assertions; combined task 1.1.3 verifies their final bytes.

| Cases                                                                    | Result   | Independent expectation / prepass reason                                                                                                                      |
| ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ST-6,10 cold owner,12,14,15; ST-13 disjoint; ST-16 in-bounds controls    | 144 RED  | Cold exported routines/storage are still charged; literal/conversion and fully in-object proofs must not charge unrelated private data.                       |
| ST-9 requested ZP                                                        | 4 RED    | Retained source home is physically in ZP but published resourceClass is general; AR-8 owns exact scope decision.                                              |
| ST-13 word at $0001                                                      | 8 RED    | Absolute instructions violate independent cheaper ZP read/write expectations; AR-8 owns exact scope decision.                                                 |
| ST-7/8, reached ST-10, ST-11, remaining overlapping ST-13; unknown ST-16 | 140 PASS | Actual values/aggregates/aliases, unknown or overlapping byte footprints and unchecked indexed observers already retain data; complete accounting reconciles. |

Authored data cases: observability ST-7/8/9/10 20; output ST-6/14 12; raw ST-11/12/13 100;
identity ST-15 12; indexed ST-16 152 (19 consumer forms × unknown/in-bounds × four profiles).
Indexed forms cover global/local/borrowed scalar accesses, compound/nested field/index places,
literal aggregate destinations and direct/indirect/local/borrowed nested return destinations.
Installed input loading uses the real bundled source and ordinary merged user contributions,
not a new installer fixture. No compiler source/dist, implementation tests or qualification
answer files were read by the author. Formatting and code-comment documentation checks pass.

Combined final-guard RED: 2026-10-08 21:54:01 CEST; 106.09 seconds; 324 cases, 168 failures /
156 passes. Git-private `spec-all-red.log` verifies the final authored fixture/oracle bytes and
the recorded root/data classifications together. No production file was changed before this
qualified run finished. Frozen spec/expert worktree guards and whitespace checks remain clean.

Root correction GREEN: `roots-build.log`, `roots-typecheck.log`, `roots-green.log` (28 cases,
117.31 seconds) and `roots-targets.log` (ten package cases) pass. The root Vitest config excludes
package sources; package tests were therefore run separately through the actual workspace script.
No claim is made that the combined data suite or the old export-only internal assertion is green;
the latter's precise authorized correction remains task 1.3.1. No red checkpoint is committed.

Visibility metadata GREEN: `metadata-build.log`, `metadata-typecheck.log`, `metadata-tests.log`
(20 package cases) and `metadata-format.log` pass. Optional provenance adds no private default;
the retention policy is implemented only in the following task.

Private-data selection is implemented in one focused semantic helper, before ownership, global
reservation, SFA and layout consumers. It retains complete binding identities, explicit
initializers, escaped addresses and conservative raw/indexed/platform observers. Unknown proof
retains data; it does not reject ordinary source. Actual selected profile facts bound the fixed
platform effects. No runtime, dependency, new public API or late storage producer is added.

Directed implementation evidence: `globals-build.log` and `globals-typecheck.log` pass after
explicit recursive type annotations corrected the initial build error. `globals-package.log`
passes 20 semantic/finite-target cases. The initial nonexistent storage filename selected no
storage tests and is not proof; the actual eight storage files in `globals-storage.log` pass all
56 cases (5.81 seconds). Touched-source formatting and whitespace checks pass.

First post-selection run: 2026-10-08 22:05:18 CEST, 203.60 seconds; `globals-first-green.log`
records 324 cases, 296 passes and 28 failures. Retention/omission assertions reached in the run
pass. Four failures are requested source-global zero-page resource classification; sixteen are
fixed-word zero-page instructions, including the newly reached `$FFFF` high byte at `$0000`.
Both defects remain outside the authorized modification set pending AR-8. Eight failures are
new joystick trace-observation timing, resolved separately under AR-9 without changing source,
expected generated bytes, cost bounds or the exact one-read assertion.

Immutable joystick-order controls: `joystick-trace-control.log`, eight passes on all four
profiles, 36.51 seconds; 212 cases were unselected, not qualification skips. New ST-14 trace
qualification: `joystick-trace-nop.log`, eight passes, 11.60 seconds; four cases unselected.
No old test was edited. This directed result does not claim that a combined 324-case rerun or
the full project checkpoint passes. No red checkpoint is committed or pushed.

Resume after the exact AR-8 scope ruling: record authority and update the affected modification
set first, then implement only the accepted small corrections, run all new cases green, add
internal tests, run the full checkpoint and obtain independent phase reviews. The existing named
effort waiver continues; keyboard implementation and RD-05 closeout remain downstream.

Handoff validation: `foundation-implementation-handoff.log` passes all 12 foundation cases
(2026-10-08 22:21:21 CEST, 5.99 seconds). Targeted formatting of every touched source/test/document,
local plan/feature-roadmap link targets, whitespace and frozen spec/expert worktree guards pass.
The link utility checks file targets, not anchors. These checks preserve the recorded blocked
state; they do not qualify the remaining twenty output/reporting failures or replace full review.

2026-10-09 resume: the user approved the self-contained exact AR-8 two-file extension. Authority
and modification-set documents were updated before production edits. The original recorded RED
cases remain the behavior/output oracles; only existing mode selection and physical classification
are corrected. Full qualification and independent reviews remain required before phase closeout.

Approved correction verification: `ar8-build.log` and `ar8-typecheck.log` pass. The first combined
rerun (`ar8-spec-green.log`, 2026-10-09 11:47:17 CEST, 218.22 seconds) passes 320/324 cases;
all twenty AR-8 instruction/resource failures are corrected. Four newly reached initializer
trace assertions need the bounded observation correction recorded in AR-10, not a compiler or
expected-value change. `ar10-initializer-trace.log` then passes those four cases (6.75 seconds;
sixteen unselected). A combined final-byte rerun remains required before task promotion.

Combined final-byte GREEN: `spec-final-green.log`, 2026-10-09 11:52:49 CEST, 243.63 seconds;
seven files and all 324 cases pass, no skips. This includes exact retention/omission, selected
callbacks/initializers/aggregate destinations, fixed addressing and resource classes, both raw
joystick reads and AR-9/AR-10 observation boundaries. Independent review and the complete existing
Linux checkpoint remain due; old specification tests are untouched.

Internal hardening: `internal-build.log` passes. The first directed run reports two new internal
fixture errors (an initializer entry without a block and a byte-only `$0001` footprint outside
the allocatable window); both fixtures were corrected without production or specification edits.
`internal-directed-final.log` passes seven files and all 55 cases (3.80 seconds). Thirty-one
are new policy/scaling, fixed-mode/cost and physical-ledger cases; the existing export-only
implementation expectation is corrected exactly as planned while retaining address-taken roots.
An 8,000-conversion chain with 2,000 repeated observers and 2,000 globals checks bounded actual
definition/identity work and avoids recursive host traversal. No new harness or runtime is added.

Full Linux checkpoint: `checkpoint-install.log`, `checkpoint-build.log`,
`checkpoint-typecheck.log` and `checkpoint-test.log` pass. Compiler: 1,845 passes and two
existing skips; CLI: 62 passes; language server: 21 passes; editor: six passes; root: 3,622
passes in 173 files (1,143.69 seconds, started 2026-10-09 12:07:48 CEST). Total: 5,556 passes,
two existing skips. Root VICE cases run sequentially. Targeted formatting, local link targets,
whitespace and frozen spec/expert worktree guards pass. No native Windows/macOS or physical
silicon qualification is claimed.

Actual ACME assembly, labels, PRGs and public sidecars are retained in the Git-private
`audit-artifacts/` evidence directory. Constant-control and cold-library PRGs are byte-identical:
631 container bytes / 629 payload bytes, zero ZP and scratch, 678 resident RAM bytes and one
reported stack byte. The fixed-word probe records exact cheaper addressing; it is not a safe
hardware-write or BASIC-runtime claim. Public entry-to-return timing remains Unknown. These
bounded controls do not establish a universal whole-program expert win. Independent reviews
and closeout remain task 1.3.3.
