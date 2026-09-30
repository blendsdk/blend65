# Execution Plan: RD-05 CIA1 Return to BASIC

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-30 12:28
> **Progress**: 18/19 tasks (95%)
> **CodeOps Artifact Schema**: 1

## Overview

Close DEF-14 under AR-P1–AR-P5. The corrected frozen authority and qualified expert baseline must complete the existing two-commit release sequence before any compiler change: first the qualified immutable content commit, then the release-record commit binding that content ID. Together they form the green authority checkpoint (PF-004). Then follow specification tests → red → implementation → green → implementation tests → full verification, using [the design](03-cia-basic-return.md) and [ST cases](07-testing-strategy.md). Phase 1 is a non-compiler authority correction; Phase 2 is the implementation phase. RD-05 and DEF-7 remain open afterward.

The user confirmed effort for this named CIA1 work and waived repeated effort pauses while that effort remains adequate. State the recommendation before each task; renew the handoff only if the task needs a different effort level. Use the git-commit skill at coherent green checkpoints; never push without a new explicit user request. A release record may remain a draft during the qualified content commit, but cannot claim active qualification until it binds that immutable content ID under the existing release procedure.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Controlled contract and expert-authority correction | 7 |
| 2 | Compiler handback and qualification | 12 |

**Total: 19 tasks across 2 phases.**

> **Execution rule:** The task checkboxes below are the single source of progress. After implementation mark the task `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its stated check passes mark `[x]` with `(completed: YYYY-MM-DD HH:MM)`. Update Progress and Last Updated after every task. Resume the first `[~]`, otherwise the first `[ ]`. Mark a blocked task `[!]` and append `Blocked: <reason>`. Use the host clock, not an invented timestamp. An expected-red test is not a green commit.

## Phase 1: Controlled Authority Correction

> **Phase baseline tree**: `d82c1cc98191b87376f60619e837fc7e1a78a70a`
> **Scope mode**: Strict; AR-P1–AR-P5 and accepted PF-001–PF-004.
> **Expected modification set**: `spec/appendix-c64.md` and its required non-normative digest bookkeeping in `spec/00-normative-inventory.md`; matching RD-05 R5.4/AC-04 text; the dependent candidate expert skill router/knowledge/qualification/release files required by the existing version-and-activation procedure; this plan and feature roadmap. No other normative `spec/` chapter, compiler file, new qualification harness, or second active skill tree (AR-P5). Authority changes are prepared in non-active copies and migrate byte-identically only after task 1.3.1's final approval.
> **Lenses**: compiler/platform semantics, source authority, expert assembly, simplicity

### Session 1.1: Independent Authority Oracle

**Reference:** [07-testing-strategy.md](07-testing-strategy.md#authority-qualification-before-compiler-tests); AR-P2, AR-P5.

- [x] 1.1.1 Add one discriminating CIA1 BASIC-handback qualification case to a non-active candidate of `.agents/skills/blend65-domain-expert/qualification/cases/c64-platform-and-games.md`, with its existing coverage-matrix entry; distinguish stock-compatible return from impossible arbitrary mask/latch restoration. (completed: 2026-09-29 22:05) Candidate: `/tmp/blend65-cia-return-candidate.usrAwL`; Q-P23 and CASE-Q-P23 identities/structure pass; live authorities remain unchanged. Source-to-invariant review precedes freezing the draft oracle.
- [x] 1.1.2 Evaluate that case against the old qualified contract and record the expected red result without editing the live skill, frozen spec, or compiler. (completed: 2026-09-29 22:23) Fresh isolated old-baseline output and independent grade confirm Fail: missing exact reloads, wrong stop/read order and unsupported nested-state reconstruction. Live authorities and compiler are unchanged; see authority evidence.

**Verify:** Candidate case/coverage identity and expected-red evaluation; no live authority activation.

### Session 1.2: Correct and Qualify the Authority

**Reference:** [07-testing-strategy.md](07-testing-strategy.md#authority-qualification-before-compiler-tests); AR-P2, AR-P5.

- [x] 1.2.1 Correct only the approved cooperative CIA1-return contract in `spec/appendix-c64.md` and RD-05 R5.4/AC-04; record the 27-rule Language Guard applicability/result, exact changed text, and new specification identity. (completed: 2026-09-29 22:29) Candidate-only correction passes exact 45-path/18-member/diff/digest checks; all 27 guard rows recorded. New digest `1c2a2d75…`; only approved appendix and non-normative identity bookkeeping differ. Migration remains task 1.3.1.
- [x] 1.2.2 Update only dependent candidate expert knowledge/router identity and required semantic version/release preparation under the existing one-baseline procedure — `.agents/skills/blend65-domain-expert/` candidate; preserve all unchanged doctrine and case identities. (completed: 2026-09-29 22:41) Candidate 2.0.1 packaging, 22-file topology, thirteen references, 112 case identities and runtime/router hashes checked. Release remains a non-active draft; interim independent semantics/optimization/simplicity review has no findings. See authority evidence for exact identities and unchanged-doctrine check.
- [x] 1.2.3 Run the changed/dependent qualification cases plus fixed unchanged controls against the candidate; reconcile source keys, exact hashes, and any failed case before activation. (completed: 2026-09-29 23:57) Twelve selected cases Pass; 100 unchanged-input cases are independently dependency-reviewed. All 19 preserved capture/grade texts and 381 packet-file hashes reproduce. Both final exact-identity reviews have no findings; structural/source/link/digest checks pass. Candidate remains non-active; see authority evidence for the frozen identities and corrective dispositions.

**Verify:** Corrected contract is internally consistent; candidate qualification and unchanged controls green; no compiler implementation or second active baseline.

### Session 1.3: Independent Review and Green Authority Checkpoint

**Reference:** AR-P5; existing expert release/qualification procedure.

- [x] 1.3.1 Obtain independent review of the exact spec/RD/skill diff, changed-case dependency closure and Language Guard result; present the complete candidate/evidence for the required explicit final user approval. Migrate only the approved byte-identical candidate atomically as the sole expert baseline, validate qualified content, and make its immutable content commit through the git-commit skill; the release record remains a draft until task 1.3.2 binds that ID (PF-004). (completed: 2026-09-30 00:26) User approved the exact candidate with “I do” on 2026-09-30. All 22 skill files and three spec/RD files match the approved bytes; runtime, qualification, full-tree and specification identities validate. Both independent reviews are clear; authored whitespace is clean with only the recorded exact-capture/EOF exceptions. The immediately following content commit is bound in task 1.3.2; no compiler implementation has occurred.
- [x] 1.3.2 Bind the preceding immutable content commit in the release record, validate exact specification and expert identity, links, source keys, targeted Prettier and qualification controls, then make the following release-record binding commit through the git-commit skill. Record both commits as the green authority checkpoint before Phase 2. Confirm `spec/` is clean at Phase 2 start (PF-004). (completed: 2026-09-30 00:35) Release-only bookkeeping binds content `1ce4852016e2a883cf1f733c6014c45e176bfc69`. Exact spec/runtime/router/qualification/content hashes, all unchanged payload and capture bytes, 112 unique cases, packaging and 84 runtime links pass. Targeted formatting and default whitespace checks pass; `spec/` is clean. This checkpoint's following release-binding commit completes activation; mandatory post-phase review precedes Phase 2.

**Verify:** Phase 1 authority checks green. Do not run the compiler suite for documentation/skill-only work. A missing final activation approval blocks task 1.3.1; it is not inferred from AR-P5's design approval.

**Post-phase review:** `/root/cia_return_phase1_review` returned no findings on
2026-09-30. It reproduces the exact committed phase diff, all bound payload/content
identities, unchanged captured evidence, 112 unique cases and approved scope; no
`*.spec.test.*` file changed. Docs-only auditor skips are recorded in authority
evidence. Content `1ce4852016e2a883cf1f733c6014c45e176bfc69` and release binding
`e063ef575d13c02c076c94e24616dd27ae4a75e2` form the green authority checkpoint.
Phase 2 may now begin; `spec/` and expert content stay frozen.

## Phase 2: Compiler Handback and Qualification

> **Phase baseline tree**: `07933e91be7c66723f357ebe55f780ae2d668156`
> **Scope mode**: Strict; existing direct handback only, no additional support surface.
> **Expected modification set**: three new `test/rd05/cia-basic-return*.spec.test.ts` files; only the three superseded final-exclusive-restore expectations and matching obsolete names/comments in `test/rd05/cia-ownership.spec.test.ts` (PF-001); focused `packages/compiler/src/profile/c64-kernal.ts`, `semantic/cia-ownership*.ts`, `semantic/interrupt-ownership.ts`, `machine/lower-platform.ts`, `machine/lower-c64.ts`, and `machine/lower-c64-interrupt.ts`; two focused `*.impl.test.ts` files; this plan, its closeout, and the feature roadmap. No further `spec/` or expert-skill edits (AR-P3–AR-P5).
> **Lenses**: compiler semantics, IRQ re-entry/ownership, volatile effects, output bytes/cycles, simplicity

**Approved modification-set extension (AR-P8):** Only the stale frozen-identity
expectation in `test/foundation.spec.test.ts` follows the activated release;
historical ancestry and seven per-key negative fixtures remain. Corrected oracle
SHA-256: `887916a344dc5f788e903c69007cb2837cb7b96b4de7eccad7f868f4a9d82391`.
No further spec/skill changes or broader test edits are authorized.

**Approved modification-set extension (AR-P9):** Correct only the three fixed
authority fields in `packages/compiler/src/build-info.ts`; add the independent
public-field regression to the existing foundation test before implementation.
The user approved this exact metadata-only correction. Fresh published evidence
must name the new identity, while PRG bytes and historical captures stay intact.
Implementation-blind `/root/cia_metadata_spec` added one public-field case to the
existing foundation oracle. Directed red: 1 new failure and 10 unchanged passing
controls; `/tmp/blend65-cia-return-metadata-red.log`. New foundation SHA-256:
`976826233d08174d43dc27582e848142903b6fdf140a367d64eb37151ae9b6e5`.
Only the new import/test differs from AR-P8's already-approved test content.
Inverse removal of that import and test reproduces AR-P8's SHA-256 exactly;
every existing expectation and fixture is unchanged. After the three metadata
constants changed, all 11 foundation cases pass. Fresh four-profile build/debug
sidecars bind expert 2.0.1 and the approved spec identity, using the existing
hash-of-identity-string schema. All PRG hashes/resources/costs remain identical.
Logs: `/tmp/blend65-cia-return-metadata-green.log`,
`/tmp/blend65-cia-return-artifact-ledger-final.jsonl`,
`/tmp/blend65-cia-return-path-ledger-final.jsonl`.

### Session 2.1: Implementation-Blind Specification Tests

**Reference:** [07-testing-strategy.md](07-testing-strategy.md#specification-test-cases), ST-1–ST-11 and the PF-001 supersession boundary in its test-file section; AR-P2–AR-P4. The spec-test author receives the corrected authority, ST rows including ST-1's complete valid entry setup, public signatures, and the three old test fixtures; not implementation logic.

- [x] 2.1.1 [spec-author] Write independent ownership and BASIC-return specification cases — `test/rd05/cia-basic-return.spec.test.ts`; ST-1–ST-7, ST-11. Supersede only the three final-exclusive-restore rejection expectations in `test/rd05/cia-ownership.spec.test.ts` identified in PF-001, preserving source fixtures and every other safety expectation; record the corrected authority in the spec-author evidence. (completed: 2026-09-30 00:51) Implementation-blind `/root/cia_return_spec` used corrected specification digest `1c2a2d75…` and qualified expert 2.0.1/content `1ce48520…`; no production logic read. Directed baseline collects 96 tests: 14 expected failures, 82 passing controls (new file 11 red/17 green; old file exactly three superseded expectations red/65 unchanged green). All four complete entry controls pass; ST-1 check/build E10278 points exactly to final restore bytes 666–689. All 56 old fixture tokens are byte-identical; formatting, documentation and frozen-authority checks pass. Log: `/tmp/blend65-cia-return-ownership-red.log`. Expected red is not a commit checkpoint.
- [x] 2.1.2 [spec-author] Write selected assembly/volatile/cost specification cases — `test/rd05/cia-basic-return-output.spec.test.ts`; ST-2–ST-3, ST-8–ST-9. (completed: 2026-09-30 01:01) Same implementation-blind author and frozen lineage: 16 tests collect, 14 expected failures and two passing no-handback controls. All eight no-write/counter-only programs build with ACME but fail the independent device trace because CIA1 handback is missing; typed programs fail at final restore. Two saved-vector sentinel pairs and all 256 CRA states check the protocol; independent absolute-link expert bound is 61 bytes/86 cycles. Permanent-resource comparisons exclude code residency and changing addresses. Formatting/documentation/whitespace/frozen-authority checks pass. Log: `/tmp/blend65-cia-return-output-red.log`; actual handback costs/resources remain unqualified until implementation.
- [x] 2.1.3 [spec-author] Write four-profile runtime specification cases using existing sequential ACME/VICE helpers — `test/rd05/cia-basic-return-vice.spec.test.ts`; ST-10. (completed: 2026-09-30 01:16) Same blind author/frozen lineage: four cases collect and fail at final restore bytes 861–884; no collection/unhandled errors or skips. Oracle uses existing sequential helpers, pending one-shot event, exact CINV/volatile trace, caller status/stack, unrelated-device zero writes and stock-ROM keyboard scanning with continuing jiffy ticks. Pre-freeze review corrected address-versus-checkpoint-ID wiring and excluded dynamic SID readback from stable-state comparison; zero SID writes remain required. Formatting/documentation/whitespace checks pass. Log: `/tmp/blend65-cia-return-vice-red.log`; VICE has not launched because current build admission is correctly red.
- [x] 2.1.4 Run all three new directed specification files and the existing CIA ownership specification file. Record expected red for the missing handback and the three superseded expectations; ST-1 must fail at final restore after valid entry setup. Distinguish already-green controls; never weaken an ST expectation to match code. (completed: 2026-09-30 01:17) Combined four-file run collects 116 cases: 32 expected failures/84 passing controls, no collection or unhandled errors. Failures match the independently recorded source/output/runtime cases; ST-1 entry controls pass and returning diagnostics locate final restore. No compiler/CLI/frozen-authority diff exists. Log: `/tmp/blend65-cia-return-combined-red.log`. The following oracle hashes freeze before implementation; expected red is not a green commit.

**Verify:** Directed Vitest red for the new capability; compilation/test collection and unchanged controls remain healthy. VICE cases run sequentially.

**Independent oracle freeze:** `/root/cia_return_spec` authored all three new
files without production logic and converted only PF-001's three old
expectations. Subsequent implementation must preserve these exact bytes except
the explicitly authorized cleanup-call correction in AR-P6 and the narrow
whole-exit assertion correction in AR-P7. Source fixtures, handback zero-write
checks, final unrelated-state equality and all other assertions remain frozen.

| File under `test/rd05/` | SHA-256 |
|---|---|
| `cia-basic-return.spec.test.ts` | `4e19945da6207e120e19a62d9749d5e1fe616db50b7d461f4134c3a2351fb842` |
| `cia-basic-return-output.spec.test.ts` | `af04bb8f87f1bbe30dfcec55e3638ad60a9208b08086fa730674601fc7d49b94` |
| `cia-basic-return-vice.spec.test.ts` | `e847cccfccaa1082e7893372ac5469b5177cd659b5085179f805efc426ce118a` |
| `cia-ownership.spec.test.ts` | `7e899097930593869e45f181da3828f014bc4a6e677bf07c72233c341087e161` |

AR-P6 preserves the original VICE oracle hash
`e2bd48d763db13a5d4a205847a8a162917ad5b1260b89a839b2107bef50606be`:
reversing only the approved cleanup-call replacement reproduces it exactly.
The AR-P6-only corrected hash was
`63187f592bff20716aed33c415bab1fb71c8ca76c6690e4d3a69d0bf9e0dd0a7`.
AR-P7 changes only the later exit write observation and its checkpoint-to-address
wiring; reversing those replacements reproduces that hash. The table binds both
approved corrections. Source fixtures and all other assertions remain unchanged.

### Session 2.2: Direct Ownership and Machine Lowering

**Reference:** [03-cia-basic-return.md](03-cia-basic-return.md), AR-P2–AR-P3; ST-1–ST-9.

- [x] 2.2.1 Add the pinned PAL/NTSC Timer A reload fact and focused per-route CIA1 mutation/outermost-release proof — `packages/compiler/src/profile/c64-kernal.ts`, `packages/compiler/src/semantic/cia-ownership-facts.ts`, `packages/compiler/src/semantic/cia-ownership.ts`. (completed: 2026-09-30 01:29) Per-route clean/typed/raw facts, stock-predecessor provenance and consistent source-release classification replace the global dirty flag. Existing diagnostic-array API retains a documented optional compile-time handback collection, preserving current callers until task 2.2.2. Build passes; 96 public ownership/source cases and 52 internal ownership/profile cases pass. Formatting, documentation/whitespace and exact oracle hashes pass. Logs: `/tmp/blend65-cia-return-ownership-{build,green,internals}.log`. Machine handback remains unimplemented and its output/runtime tests remain expected-red; no commit checkpoint yet.
- [x] 2.2.2 Carry only the proved source-operation handback set through the existing interrupt-ownership result and C64 lowering support — `packages/compiler/src/semantic/interrupt-ownership.ts`, `packages/compiler/src/machine/lower-platform.ts`, `packages/compiler/src/machine/lower-c64.ts`. (completed: 2026-09-30 01:37) Existing ownership result carries the readonly source-operation set; the existing static-link binding projects a compile-time boolean. All failed-proof returns expose empty facts. No new pass, source API, request or storage. Build and 26 current ownership/handler/lowering regressions pass; formatting, whitespace, frozen authorities and oracle hashes pass. Logs: `/tmp/blend65-cia-return-propagation-{build,tests,contexts}.log`.
- [x] 2.2.3 Emit the direct CIA1 mask/stop/pending/reload/CINV/enable/start sequence inside the existing final `restoreIRQ()` transaction — `packages/compiler/src/machine/lower-c64-interrupt.ts`; preserve exact volatile order, CPU status and existing SFA closure. (completed: 2026-09-30 01:39) Inline selected-profile sequence within the existing save/mask/restore transaction; saved CINV remains exact and all device effects have ordered volatile records. No new storage or helper. Build and all 16 independent output cases pass, including all CRA bytes, both vector sentinels, four profiles, inner/chain boundaries, equal-contract cost bound and unchanged function resources. Logs: `/tmp/blend65-cia-return-machine-{build,output}.log`.
- [x] 2.2.4 Run all three new specification files and affected prior CIA/IRQ/profile tests to green; fix compiler behavior, never the independent specification oracle. (completed: 2026-09-30 08:45) All 433 affected cases across 23 files pass, including four-profile return/status/stack/state, continuing clock/keyboard service and prior CIA/IRQ/profile controls; VICE sequential. AR-P6/AR-P7 change only approved wiring/observation, verified by inverse replacement hashes. Source fixtures and all other assertions remain unchanged. Formatting, documentation/whitespace, exact oracle hashes and frozen authorities pass. Logs: `/tmp/blend65-cia-return-bank-rerun.log`, `/tmp/blend65-cia-return-directed-final.log`. Full phase checkpoint and independent review remain.

**Verify:** All ST-1–ST-11 green; no handback on unrelated routes, no new source API or runtime state, and no late function storage.

### Session 2.3: Hardening and Phase Checkpoint

**Reference:** [07-testing-strategy.md](07-testing-strategy.md), ST-1–ST-11; AR-P3–AR-P4.

- [x] 2.3.1 Add focused internal route-depth/join/raw-write and direct-instruction tests — `packages/compiler/src/semantic/cia-return.impl.test.ts`, `packages/compiler/src/machine/cia-return.impl.test.ts`. (completed: 2026-09-30 08:56) Build and all 31 focused internal cases pass. Route joins, raw address effects, exact source-operation proof identity, ordered device/link effects, CPU-state envelope and four-profile instruction costs covered. Targeted formatting, whitespace and unchanged frozen oracle/authority checks pass. Logs: `/tmp/blend65-cia-return-internal-{build,tests,check}.log`.
- [x] 2.3.2 Run `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, and `yarn test`, with VICE sequential; check selected output and equal-contract expert byte/cycle delta, resource/route ledger, targeted formatting, source keys and clean frozen authorities. (completed: 2026-09-30 11:15) All commands pass: compiler 1,592; root 1,057; CLI 62; language server 14; VS Code 6 (2,731 total). Four CIA1 VICE cases run sequentially; independent source/output/cost and all affected prior controls green. Logs: `/tmp/blend65-cia-return-release-{install,build,typecheck,tests,format}.log`. AR-P9's 11 foundation cases pass; inverse import/test removal reproduces AR-P8's exact oracle. Fresh four-profile build/debug identity checks and unchanged PRG hashes pass; `/tmp/blend65-cia-return-artifact-ledger-final.jsonl`. Resource/cost ledger: 860 PRG bytes, 916 resident bytes, 0 ZP/scratch, 28 stack bytes; startup entry 345/463, main 146/210, startup restore 287/393 bytes/cycles. Full IRQ paths 121/128/128/135 cycles for pending 0/$81/$82/$83 exclude instruction completion/bus stalls; `/tmp/blend65-cia-return-path-ledger-final.jsonl`. Local handback is 61 bytes/86 cycles at equal-contract absolute-link parity; issue #93 tracks the potential 59/84 ZP-link path, with no allocation/optimizer addition. Formatting, whitespace, source-key checks and exact frozen authority diff pass. Independent review/closeout remain; no implementation commit or push yet.
- [x] 2.3.3 Perform the configured independent post-phase review; resolve authorized material findings and rerun affected tests plus the full phase checkpoint before a green implementation commit. (completed: 2026-09-30 12:28) All three initial reviews complete; SR-001 fixed under explicit AR-P10 approval. Blind regression: 40 expected-red/16 controls → all 56 green; affected source 152 and internal 33 cases pass. Full install/build/typecheck/test checkpoint passes all 2,789 tests, VICE sequential. Fresh four-profile PRG/resource/cost sidecars remain identical. Both permitted fix-only reviewers return no findings and resolve SR-001; PE-001 remains report-only and owned. Exact oracle hashes, formatting, documentation, local links and frozen authorities pass. Fix baseline tree `f9428414205b1ea2a0cc19ff6dd3f954d2c66fa3`; closeout remains.
- [ ] 2.3.4 Write `08-closeout.md` with four-profile bounded VICE status, complete IRQ/exit costs and expert delta, remaining DEF-7/RD-05 ownership, and a deferral-expiry check; mark DEF-14 Done while keeping RD-05 Executing.

**Verify:** All 19 tasks complete, independent review clear, phase commands green, local parity floor met, no frozen-file diff after Phase 1, and roadmap current.

### Phase 2 independent review record

The read-only reviewers use the exact phase snapshot and activated expert 2.0.1
content `1ce4852016e2a883cf1f733c6014c45e176bfc69`. Correctness uses a bounded
generic reviewer because the stock role's blanket spec-file prohibition cannot
represent the user's exact PF-001/AR-P6–AR-P9 approvals. This fallback retains
correctness, maintainability, standards, API-surface and all approved-oracle
fixture/hash checks; it does not waive test integrity. Independent semantics and
performance reviewers retain the hardware/IRQ and output-cost gates. A dedicated
security auditor is not activated: no security-profile or web/auth/data surface
changes; source/operation ownership remains in the correctness review.

| Finding | Severity / lens | Evidence and disposition |
|---|---|---|
| RV-001 | Minor / written standards | Correctness review found the decision-register header still counted seven resolved items rather than nine. Corrected that count only; all nine approved entries are unchanged. |
| SR-001 | Major / ownership semantics | `cia-ownership.ts:335` forgot known raw CIA1 writes outside an exclusive route, admitting an unproved final stock handback. Fixed under approved AR-P10 using the existing qualification fact; independent red/green regression, full checkpoint and both fix-only reviews pass. Resolved; no new API, runtime state or lowering sequence. |
| PE-001 | Minor / compile-time performance | `cia-ownership.ts:184` memoizes the full mutation vector, duplicating contexts through mutation-bearing nested helper diamonds. Independent valid depth-16/19-function/2.7 KB probe: baseline 34 memo keys/~1 ms versus current 131,072/~1.28 s, approximately 133 MB heap in the full check. Report-only; no output-cost defect or fix in this slice. RD-05 compiler-analysis hardening retains ownership of measured context sharing; any remedy must preserve caller-prefix mutations rather than discard proof facts. |

All three independent reviews are complete on 2026-09-30. Correctness
(`/root/cia_return_correctness`) has no surviving critical/major findings;
semantics (`/root/cia_return_semantics`, original reviewer finding RV-001,
merged here as SR-001) has exactly the one major ownership gap; performance
(`/root/cia_return_performance`) has only PE-001 and no emitted-output findings.
Performance independently reproduces all four PRG hashes and resource totals.
The user approved AR-P10 with “approved, proceed” on 2026-09-30. The expected
modification set now includes one new independent provenance specification file,
`test/rd05/cia-basic-return-provenance.spec.test.ts`. Task 2.3.3 resumes; closeout
and green implementation commit wait for correction, verification and the one
permitted fix-only review. No previously frozen oracle may change.
The minor host-analysis observation does not authorize a generalized memoization
or transfer framework, and is not silently folded into the ownership fix.

**AR-P10 independent oracle freeze:** `/root/cia_provenance_spec` authored the
123-line new file without implementation access. Ten negative scenarios on four
profiles are independently red at both public check/build boundaries; sixteen
clean/RAM/port/opaque-address controls already pass. An optional invalid
oversized-literal fixture was removed before freeze, not adapted to the compiler.
Frozen SHA-256: `10b0d778c195fa4ec6094659ed02d8f613fdc4e6339cc68d4cb666d4a5523b8c`.
Every previous oracle stays byte-identical. The correction changes only the
existing qualification update and its field documentation. Directed build and
152 source cases pass, `/tmp/blend65-cia-provenance-{build,green}.log`. Two
internal cases additionally prove that a rejected first or subsequent lease
clears every provisional handback, including an earlier valid release; all 33
route/machine internal cases pass, `/tmp/blend65-cia-provenance-internal.log`.
Full install/build/typecheck/test checkpoint passes: compiler 1,594; root 1,113;
CLI 62; language server 14; VS Code 6 (2,789 total), with VICE sequential.
Logs: `/tmp/blend65-cia-provenance-checkpoint-{install,build,typecheck,test}.log`.
Four fresh artifact builds reproduce exact PRG bytes, authority identity,
resource and cost sidecars: `/tmp/blend65-cia-provenance-artifact-ledger.jsonl`.
All sixteen touched TypeScript files pass targeted formatting; whitespace,
frozen-authority diff and every previously frozen oracle hash remain clean.
The one permitted fix-only review cycle is complete: both
`/root/cia_return_correctness` and `/root/cia_return_semantics` report no findings
and explicitly resolve SR-001. Semantics additionally probes repeated helpers,
loop joins, failed-proof clearing, opaque writes and nonreturning raw code without
a requested handback. No third review cycle is performed. Performance is not
redispatched: the correction adds no emitted change, storage or memo dimension;
PE-001 remains unchanged, report-only and owned by RD-05.

The roadmap engine validates the feature's existing 2/10 RD count. Its global
check reports the intentionally deferred portfolio cascade (portfolio still
1/10); this non-integration `feature/v4-rebuild` work leaves the portfolio
untouched under the roadmap branch rule. Reconcile it at integration, not here.

## Dependencies and success criteria

Phase 1's corrected, activated authority must be green and committed before Phase 2's compiler specification tests or code. Within Phase 2, specification tests precede red verification; red precedes implementation; green precedes implementation tests and full verification. The plan is complete only when every checklist task is `[x]`; DEF-7 and unrelated RD-05 work remain separately owned. Every compiler output optimization keeps an independent behavior oracle and an assembly/cost expectation.
