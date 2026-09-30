# Ambiguity Register: RD-05 CIA1 Return to BASIC

> **Status**: ✅ GATE PASSED — all 10 items resolved
> **Last Updated**: 2026-09-30 12:02

| Planning boundary | Scope |
|---|---|
| Target | DEF-14, the RD-05 cooperative-profile return to BASIC after CIA1 timer/mask takeover. The user confirmed this named next task on 2026-09-29. |
| Context artifacts | Frozen Specification 4, RD-05, completed CIA and IRQ plans, qualified expert baseline, MOS 6526 data sheet, pinned 901227-03 KERNAL source, and current compiler startup/ownership/lowering code. |
| Modification set while planning | This plan's documents and the feature roadmap when its stage changes. The user authorized a later controlled correction limited to `spec/appendix-c64.md`, matching RD-05 R5.4/AC-04 text, and the dependent expert-baseline release/qualification surface before compiler implementation. No compiler or frozen-authority edit is part of plan creation. |

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Which work is the next named task? | Narrow DEF-14 CIA1 return-to-BASIC plan on cooperative profiles; NMI/DEF-7, raw takeover, and unrelated RD-05 work remain separate. | User confirmed the named next task and xhigh effort on 2026-09-29. | ✅ Resolved |
| AR-P2 | Behavioral / frozen-spec conflict (complex) | Specification 4 requires exact captured device state, but the CIA1 interrupt mask and timer reload latch are write-only. An arbitrary BASIC-entry value cannot be captured by reading the chip. What may normal return promise? | Recommended: expressly authorize a narrow Specification 4 correction to a stock-compatible KERNAL/BASIC CIA1 handback, with custom pre-entry CIA1 state not bit-exactly restored. Alternative: preserve exact-state wording and admit normal return only where prior state has independent, proved provenance; typical game takeover remains nonreturning. | User: “Go with the best option” on 2026-09-29, approving the expressly named narrow spec-contract correction. | ✅ Resolved |
| AR-P3 | Integration / ownership (complex) | Where should the reverse handoff occur relative to `restoreIRQ()` and returning `main`, and what happens to nested exclusive routes or unproved prior owners? | Recommended: emit a direct stock CIA1 Timer A handback within the existing IRQ-masked outermost-exclusive `restoreIRQ()` transaction; quiesce and clear game sources, restore the exact saved predecessor CINV, then enable the stock Timer A source before restoring CPU status. Nested vector-only pops remain legal when that nested epoch did not change CIA1; otherwise diagnose E10278. A returning `main` still needs empty ownership stacks. The stock BASIC/KERNAL entry precondition excludes custom resident IRQ/CIA1 state. Alternative: add a separate source-visible CIA1 release call, imposing extra ordering on the user. No runtime manager. | User: “i do” on 2026-09-29, approving the combined narrow boundary presented immediately before the reply. | ✅ Resolved |
| AR-P4 | Verification | Which commands and machine checks close the plan's implementation phases? | Recommended: the existing `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test` checkpoint rule; directed source/assembly tests and sequential VICE cases for the four cooperative profiles, with physical CIA-edge QA deferred to RD-10. | User: “i do” on 2026-09-29, approving the verification rule in that same combined request. | ✅ Resolved |
| AR-P5 | Authority / modification set | The approved normative correction changes the frozen Specification 4 identity and the expert baseline qualified against it. Which controlled files and gate are authorized before compiler implementation? | Recommended: correct only the CIA1 cooperative-return wording in `spec/appendix-c64.md` and matching RD-05 R5.4/AC-04 wording; apply the existing Language Guard and dependent-only expert-baseline requalification/version/activation procedure before compiler code. Do not modify unrelated spec chapters or create a second authority layer. | User: “i do” on 2026-09-29, approving that exact edit and qualification boundary in the combined request. | ✅ Resolved |
| AR-P6 | Test-oracle correction (runtime) | The frozen new VICE test calls the existing cleanup helper with two arguments, but the helper takes one object. Cleanup throws in all four profiles and can hide an earlier assertion failure. May its wiring be corrected without changing behavior expectations? | Recommended: change only `stopVice(started.child, monitor)` to `stopVice({ child: started.child, monitor })` in `test/rd05/cia-basic-return-vice.spec.test.ts`; preserve every fixture and assertion, record old/new hashes, rerun the four profiles, then the affected regressions. No helper, compiler or frozen-authority change for this correction. | User: “Please do” on 2026-09-30, explicitly approving the one-line cleanup correction and continuation. | ✅ Resolved |
| AR-P7 | Runtime-oracle observation boundary (runtime) | The corrected cleanup exposes a test assertion forbidding all CIA2 writes even through the later startup epilogue. That contradicts the unchanged captured-state/VIC-bank exit obligation. May this overly broad assertion be corrected? | Recommended: in the new VICE test only, retain checkpoint-to-address identities and require exactly `$DD00`, then `$DD02` after handback through caller return, with no other CIA2 or SID write. Retain zero CIA2/SID writes inside handback and exact final unrelated-state equality. Preserve source fixtures and all other expectations; record the new hash and rerun sequentially. No compiler, startup, helper, spec or expert edit. | User: “please do, and continue” on 2026-09-30, explicitly approving the narrow ordered-write assertion correction. | ✅ Resolved |
| AR-P8 | Frozen-identity oracle correction (runtime) | The full checkpoint's foundation test still requires expert 2.0.0 and the previous specification identity; it rejects the user-approved, committed 2.0.1 authority release. May this one identity expectation follow the approved release? | **Best option:** update only the foundation test's frozen specification/expert expectations and exact clean-authority comparison to the activated release checkpoint `e063ef575d13c02c076c94e24616dd27ae4a75e2`; retain historical ancestry and every per-key tamper-detection fixture. Record old/new test hashes. Add this exact file to this plan's modification set/testing strategy, then rerun the directed foundation cases and full checkpoint. No compiler, frozen-authority, other test or harness change. | User: “I approve” on 2026-09-30, explicitly approving the narrow identity-test update and continuation. | ✅ Resolved |
| AR-P9 | Published authority identity (runtime) | The final artifact probe finds that the compiler's public `BUILD_INFO` still names the old spec and expert release. New build/debug reports therefore claim the wrong authority despite a correct handback and green tests. May the bounded modification set include correcting that metadata? | **Best option:** update only `specificationId`, `expertVersion` and `expertContentCommit` in `packages/compiler/src/build-info.ts` to the already-approved immutable authority. Add a focused independent regression in the existing foundation test for these public fields before the metadata correction; retain all current checks. Rebuild, rerun the full checkpoint and regenerate the four-profile evidence before review/closeout. No new schema, hashing method, API, runtime behavior, spec/skill change or rewrite of historical RD-04 evidence. | User: “I approve” on 2026-09-30, expressly approving the three metadata fields and regression check. | ✅ Resolved |
| AR-P10 | Ownership-proof correction (runtime / major review finding) | Known raw CIA1 timer/control/ICR writes before exclusive installation are forgotten, so the new final release accepts an unproved stock predecessor. May the review fix preserve this fact outside an exclusive lease? | **Best option:** invalidate the existing compile-time stock-predecessor qualification when a known unsupported raw CIA1 mutation occurs outside an exclusive lease; retain existing call/join propagation and source-linked E10278 at unproved final release. Independently author focused regressions in one new specification file before the correction; leave every frozen oracle unchanged. Verify red → green, affected tests and the full checkpoint, then one fix-only independent review. No new API, runtime storage, generated sequence, general raw-address proof, opaque-address restriction, spec or expert change. | User: “approved, proceed” on 2026-09-30, explicitly approving the presented narrow correction and continuation. | ✅ Resolved |

## Resolution Notes

**AR-P10 resolution:** The user approved the existing-fact correction and focused
test-first regression. The modification set adds only
`test/rd05/cia-basic-return-provenance.spec.test.ts`; existing production targets
already own the qualification fact and its documentation. Existing oracles,
opaque runtime-address behavior, emitted handback and frozen authorities remain
unchanged. One fix-only review follows directed and full verification.

**AR-P10 evidence (2026-09-30 11:36):** Independent semantics review finds
`packages/compiler/src/semantic/cia-ownership.ts:332–342` classifies known raw
device writes but updates facts only while an exclusive route exists. A masked
`main` with `poke($dc0e, $80)` before `setIRQExclusive(&onIRQ)` and balanced
`restoreIRQ()` completes ownership with one proved handback; the same write
after installation correctly rejects with E10278. A pre-install literal ICR
write also escapes. The stock machine-entry precondition does not prove later
source effects. This contradicts `spec/appendix-c64.md:257–261` and the design's
known-raw boundary. Existing stock-predecessor facts already persist through
calls and joins, so no new state mechanism is needed. Implementation and
closeout pause for the user's ruling.

**AR-P9 resolution:** The user expressly approved the three fixed metadata values
and independent regression. The permitted correction is only `build-info.ts`
and the existing foundation test's public-field assertion. No current authority,
historical capture, schema or machine behavior is rewritten. Verification and
regenerated sidecars must follow the test-first correction before closeout.

**AR-P9 evidence (2026-09-30 09:42):**
`packages/compiler/src/build-info.ts:6–11` still pins the prior specification
identity, expert `2.0.0`, and content `c9e70fab…`. The existing public evidence
writer (`packages/compiler/src/services/evidence.ts:142–148`) hashes these fields
unchanged into both published build/debug records. The real four-profile
`cia-return-ledger` generations in `/tmp/blend65-cia-return-artifact-ledger.jsonl`
therefore report that obsolete release. Only three metadata values need to follow
the approved specification digest, expert 2.0.1 and content `1ce48520…`; their
meaning and existing hash construction stay unchanged. No machine bytes should
change. The suggested foundation assertions consume the existing public
`BUILD_INFO` export, not an internal implementation import. Test-first failure
must demonstrate the stale public metadata, then pass after correction.
Historical RD-04 captures keep their actual capture identities, not rewritten
claims. No metadata implementation or test change has occurred.
Confidence: High; observed generated reports and the three fixed metadata values
agree with each other but disagree with the approved active release. Hardening:
reusing the existing fixed build metadata is sufficient; live filesystem reads,
a new version service or a new evidence framework are unnecessary.

**Final checkpoint before AR-P9:** `yarn install --frozen-lockfile`, `yarn build`,
`yarn typecheck` and `yarn test` all pass: compiler 1,592, root 1,056, CLI 62,
language server 14, VS Code 6 (2,730 total). Logs:
`/tmp/blend65-cia-return-final-{install,build,typecheck,tests}.log`.
The successful root suite ran sequentially to completion (326.25 seconds);
the earlier interrupted run is not reused as complete evidence. AR-P8's approved
identity test and all seven negative controls pass. The four-profile handback
is behavior/output verified, but published authority metadata remains incorrect,
so review/closeout and the green implementation commit remain pending AR-P9.
No push occurred. Local handback parity debt is tracked by the standing project
authorization in [issue #93](https://github.com/blendsdk/blend65/issues/93),
with current 61-byte/86-cycle parity and a bounded ZP-allocation path; no optimizer
or allocation implementation was added.

**AR-P8 resolution:** The user approved the named update with “I approve”. Only
the foundation identity constants/readback and exact frozen-authority diff gate
now follow the activated 2.0.1 release. Historical ancestry checks, all seven
per-key negative fixtures and all unrelated foundation cases remain intact.
The exact release-tree comparison replaces the old diagnostic-era exceptions:
no spec/skill file is excluded. Current corrected SHA-256 is
`887916a344dc5f788e903c69007cb2837cb7b96b4de7eccad7f868f4a9d82391`.
This supersedes only the historical test identity recorded below; authority
content is unchanged. Directed and full verification follow before completion.

**AR-P8 evidence (2026-09-30 09:00):** The full checkpoint reaches
`test/foundation.spec.test.ts:112` and rejects the specification, expert-version,
router and release identities because its constants at lines 15 and 37–44 and
readback at lines 141–152 still describe 2.0.0. Its later initial-authority diff
expectation also predates the separately approved CIA1 appendix/skill correction.
The actual frozen authorities remain unchanged from the approved content commit
`1ce4852016e2a883cf1f733c6014c45e176bfc69` and release binding
`e063ef575d13c02c076c94e24616dd27ae4a75e2`.
Current specification digest is
`1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`;
router SHA-256 is
`8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68`;
release SHA-256 is
`8a681fdefa7ef524ec4f21193521fde7d6d82760158f759d9836a9d4def9227b`.
The existing seven per-key mismatch cases must still reject exactly their changed
key. Compare the entire current spec/skill tree to the approved release checkpoint,
not a broad exclusion of skill or appendix edits. This is a narrowly stale
identity oracle, not authority to weaken compiler behavior checks. The test has
not been edited. Full-run log: `/tmp/blend65-cia-return-phase-tests.log`.
Its unchanged SHA-256 is
`a268e292c5198d2e5857ebe653ee132e7d5181fa4e42f40d18059c2024628d8b`.
Install/build/typecheck and all workspace tests pass (compiler 1,592, CLI 62,
language server 14, VS Code 6). The root run was interrupted with exit 143 before
its summary; it already reports this identity failure, so no complete-suite pass
or final root count is claimed. One orphaned bounds-test VICE process was stopped
after exact executable and temporary-PRG identity checks; no other process was
touched. Targeted formatting/whitespace and the entire frozen spec/skill diff
against the approved release checkpoint pass.
Confidence: High; the activated immutable release and the hardcoded old oracle
directly disagree. Hardening: reverting the approved authority or allowing
arbitrary skill differences would be incorrect; pinning the approved release
keeps the immutable-authority guard effective.

**AR-P7 resolution:** The user approved the narrow correction with “please do,
and continue”. Only the new VICE test's whole-exit write assertion and its
checkpoint-to-address bookkeeping change. The handback still requires zero
CIA2/SID writes; the later ordinary exit requires exactly `$DD00`, then `$DD02`,
with all final state, status, stack, clock and keyboard assertions retained.
Corrected hash: `e847cccfccaa1082e7893372ac5469b5177cd659b5085179f805efc426ce118a`.
The AR-P6-only hash and original hash remain recorded below and in the execution
plan. Runtime qualification still depends on the rerun; earlier failure evidence
below is historical, not a current blocker.

**AR-P6 resolution:** The user approved the named correction with “Please do”.
Only the existing cleanup call changed to the helper's object argument. The
corrected test hash is `63187f592bff20716aed33c415bab1fb71c8ca76c6690e4d3a69d0bf9e0dd0a7`;
reversing that one replacement reproduces the original frozen hash exactly.
All assertions and fixtures remain unchanged. The rerun correctly cleans up all
four emulator processes, but exposes AR-P7; runtime qualification is not complete.

**AR-P7 evidence:** All four profiles pass the pending-event setup, exact ordered
handback trace, zero CIA2/SID writes within handback, saved CINV restoration,
caller status/stack at release and stock CIA1 control checks. They then reach the
real BASIC caller address and fail at `test/rd05/cia-basic-return-vice.spec.test.ts:267`
with two write checkpoint hits (`18`, `20`). The source's tracepoint construction
identifies these as CIA2 port A and its direction register. The existing
`packages/compiler/src/layout/startup.ts:359`–`:360` restores those two captured
bank-selection registers in that order. Frozen `spec/appendix-c64.md:211` and
`:237`–`:259` require CIA2 VIC-bank ownership and unchanged captured-state
restoration; ST-8 prohibits CIA2/SID access within handback, while ST-10 requires
unrelated device state to match the entry contract after normal return. The later
whole-exit zero-write assertion confuses these boundaries. Log:
`/tmp/blend65-cia-return-cleanup-rerun.log` (four collected/four failed; no cleanup
failure). No VICE processes remain. The proposal retains a strict ordered/count
oracle, rather than deleting the assertion or filtering out arbitrary CIA2 writes.
Confidence: High; the frozen contract and unchanged startup agree. Hardening:
changing startup or adding bank-use analysis would expand this CIA1 slice and is
unnecessary; final state equality and all handback checks remain required. All
tests still have their AR-P6-approved hashes; no AR-P7 test edit has occurred.

**AR-P2:** The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) distinguishes a write-only ICR mask from read-to-clear pending data, and a write-only timer latch from the readable counter. The pinned [901227-03 KERNAL initialization](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/init) supplies a stock Timer A setup, but its full `IOINIT` also changes unrelated devices and is not an exit routine. Current compiler code rejects `restoreIRQ()` and BASIC return after CIA1 mutation. An independent design challenger favored the narrow contract correction, while stressing that custom resident software may require exact old state. Confidence: High that the current exact arbitrary-state promise is unimplementable from CIA reads; Medium on the exact handback sequence until qualified. Hardening: the challenger converged on the contract direction and rejected wholesale `IOINIT` reuse.

**AR-P3:** The existing `restoreIRQ()` lowering already masks IRQs, updates the saved two-byte CINV predecessor, then restores caller status. The startup epilogue runs only after `main` and would leave a bad window if the predecessor vector were restored before CIA1. An independent challenger favored the integrated outermost restore; a separate source operation adds an ordering obligation, while an epilogue-only repair misses mid-program release. Its strongest objection is nonstock predecessor compatibility, so the contract must name stock entry and retain exact LIFO vector restoration. Confidence: Medium until the four-profile execution and route proof close. Hardening: challenger converged on the integrated route with the explicit predecessor qualification.

**AR-P5:** The active expert-skill release record binds the exact Specification 4 identity. A substantive spec correction cannot coexist silently with that old qualified identity. The existing targeted requalification process is reused; no new framework or second spec authority is proposed. The user explicitly approved this bounded modification set.

**Original planning confirmation:** The user confirmed the original named task and AR-P2, then explicitly approved the remaining AR-P3–AR-P5 recommendation batch. The 12-category scan found no new persistence, web UI, external service, data migration, security, or naming surface. The compiler/language and hardware-interrupt lenses apply. The original planning gate permitted plan documents, not compiler implementation or an unqualified frozen-authority edit.

**AR-P6 evidence:** `test/rd05/cia-basic-return-vice.spec.test.ts:294` passes two positional arguments; `test/m1/vice-runtime.ts:326` requires one `{ child, monitor }` object, as the unchanged CIA and profile runtime tests already use. The directed run collects 433 tests: 429 pass, four fail during cleanup with `Cannot read properties of undefined (reading 'exitCode')`. A cleanup failure may conceal a preceding assertion failure, so this is not proof that the handback runtime behavior passes. Log: `/tmp/blend65-cia-return-directed-green.log`. Four precisely identified leaked test-owned VICE process groups were terminated after executable/PRG ownership checks; no other processes were touched. The frozen test hash remains `e2bd48d763db13a5d4a205847a8a162917ad5b1260b89a839b2107bef50606be`. Task 2.2.4 and subsequent qualification remain blocked. Confidence: High on the one-line signature mismatch; runtime semantics remain unqualified. Hardening: checked the real helper signature and both prior runtime callers; no compiler accommodation or weaker expectation is proposed.
