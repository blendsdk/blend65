# Preflight Report: RD-05 CIA Timer and Interrupt Slice

> **Status:** ✅ PREFLIGHT PASSED — all 5 findings resolved
> **Iteration:** 3 (bounded final check after iteration-2 corrections)
> **Audit target:** Full seven-document plan in `codeops/features/blend65-v4/plans/rd-05-cia-interrupts/`, excluding this report; starting git tree `727f9e1ec56457490e317bcad014be0937719e62` at HEAD `895eda1c`; final ordered plan-file SHA-256 digest `a84603f4eecb6b6f36c85b5cb3543dd905f7f7887c1edc0aa254e3959e405ee1`
> **Context only:** `AGENTS.md`, feature roadmap, RD-05, frozen Specification 4, qualified expert baseline, MOS 6526 data sheet, pinned KERNAL sources, and current compiler/tests
> **Codebase grounded:** at least 19 source/test/config files examined; at least 14 plan-to-code or primary-source references checked
> **Last updated:** 2026-09-29

## Codebase context

The project uses TypeScript 7, Node 22, Yarn 1, Vitest, ACME 0.97 and VICE 3.10. Selected C64 calls are declared in `packages/compiler/src/frontend/profile.ts`, bound by `profile-bindings.ts`, checked through `semantic/interrupt-ownership.ts`, and emitted by direct C64 lowering. The compiler has vector ownership but no CIA source/mask proof. Existing RD-05 fixtures compile real programs and run VICE sequentially. No new runtime, framework, harness or dependency is needed for this slice.

The main files checked were `profile.ts`, `profile-bindings.ts`, both exact-inventory frontend specification tests, `profile-constants.impl.test.ts`, `operations.ts`, `whole-program.ts`, `interrupt-ownership.ts`, `target/profile.ts`, `target/c64-kernal.ts`, `lower-c64.ts`, `lower-c64-interrupt.ts`, `lower-platform.ts`, `lower-control.ts`, `lower-state.ts`, `layout/startup.ts`, `test/rd05/profile-fixture.ts`, `test/rd05/handler-irq-vice.spec.test.ts`, and `test/m1/vice-monitor.ts`. The 17 plan tasks are specification-first and follow existing module seams.

## Summary by dimension

| # | Dimension | Findings | Highest severity |
|---|---|---:|---|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 | 🟡 Minor |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 0 | — |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 1 | 🟠 Major |
| 7 | Testability | 1 | 🟡 Minor |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 | 🟠 Major |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 0 | — |
| 13 | Codebase Alignment | 1 | 🟠 Major |

| Severity | Count | Status |
|---|---:|---|
| Critical | 0 | — |
| Major | 3 | Resolved |
| Minor | 2 | Resolved |
| Observation | 0 | — |

## Findings

### PF-001: Initial IRQ handoff has an interrupt window 🟠 MAJOR

**Dimension:** 9 — Edge Cases
**Location:** `03-cia-operations.md:50–52`; `07-testing-strategy.md:26` (ST-9)
**Codebase evidence:** `packages/compiler/src/machine/lower-c64-interrupt.ts:263–265` restores the caller's interrupt flag before the separate mask-clear call. The [pinned KERNAL IRQ source](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/irqfile) enables CIA1 Timer A. `spec/appendix-c64.md:769–771` requires the exclusive handler to own every enabled source.

**Problem:** An IRQ can reach the new exclusive handler between `setIRQExclusive()` and `disableInterruptSources(sourceAll)`. The plan treats all five CIA1 sources as possibly enabled, but its setup tests do not demonstrate a safe transition. This does not reopen AR-P3's decision against an arbitrary branch-service checker.

| Option | Description | Benefit | Cost |
|---|---|---|---|
| A | Qualify a balanced, source-visible IRQ-masked install, mask-clear and pending-read transaction using existing intrinsics; test a pending Timer A event at the boundary. | Closes the window without a new API or hidden masking. | Source setup owns a brief critical section and handles the consumed status. |
| B | Qualify an initial handler that acknowledges every possibly enabled source before the mask changes; test the same boundary. | Allows interrupts during installation. | More demanding handler obligation; no general branch proof is available. |

**Recommended: Option A (best).** It uses existing operations and is smaller than requiring a fully prepared initial handler. Option B remains possible for a deliberately qualified advanced setup.
**Confidence:** High — a different setter interrupt-state contract would change this.
**Hardening:** Independent challenge retained the finding and rejected a general branch-service checker.
**Challenger:** converged.
**User Decision:** Resolved — user accepted Option A and requested the recommended plan correction on 2026-09-29.
**Verification:** The source-visible `asm_php()`/`asm_sei()` → exclusive install → full mask clear → one pending read → `asm_plp()` handoff is in `03-cia-operations.md` §Ownership; ST-9/ST-14 test the pending-IRQ boundary. The focused final recheck found no remaining installer window in this qualified sequence.

### PF-002: CIA1 takeover has no safe return-to-BASIC rule 🟠 MAJOR

**Dimension:** 6 — Feasibility Concerns
**Location:** `03-cia-operations.md:52`; `07-testing-strategy.md:29` (ST-12)
**Codebase evidence:** `restoreIRQ()` changes only CINV in `packages/compiler/src/machine/lower-c64-interrupt.ts:166–171,185–265`; `packages/compiler/src/layout/startup.ts:168–199,354–370` restores no CIA1 timer or mask state. `spec/appendix-c64.md:233–239` requires a returning program to release exclusive resources and restore captured device state. The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) makes the ICR mask write-only.

**Problem:** A program can disable all CIA1 interrupt sources, restore the KERNAL vector and return to BASIC. The plan's source-mask rule permits the vector restore because no enabled source crosses to an unowned route, but the KERNAL Timer A service can remain disabled or reprogrammed. ICR cannot reveal the prior mask.

**Recommended correction (only viable within this slice):** Reject `restoreIRQ()`/normal-return paths after CIA1 mask or timer-state mutation unless exact restoration is separately proved. Record the nonreturning-program limitation plainly. A hard-coded stock KERNAL reinitialization was considered and dropped because it cannot restore an arbitrary prior write-only mask.
**Confidence:** High — a bounded exact prior-state capture/restore mechanism would change this.
**Hardening:** Independent challenge confirmed that assumed stock-state reinitialization is not exact restoration.
**Challenger:** converged.
**User Decision:** Resolved — user accepted the temporary nonreturning guard on 2026-09-29, with a required RD-05 follow-on for a proved safe return to BASIC before RD-05 closeout. This is not a permanent game-language restriction.
**Iteration 2 evidence:** The first correction omitted CIA1 writes in selected IRQ handlers/helpers from the mainline dirty-state fact; current `interrupt-ownership.ts` summarizes handler roots separately. It also needed to distinguish statically identified raw CIA writes from legal runtime-address `poke()`; frozen `spec/12-intrinsics.md` permits runtime addresses and `spec/appendix-c64.md` treats truly opaque vector writes as unsafe boundaries. These are direct consequences of the accepted guard, not a new capability.
**Verification:** `03-cia-operations.md` now carries selected handler/helper and nested-install mutations into the active epoch, keeps handler return distinct from BASIC return, and states the caller-owned raw-address boundary. ST-12 independently checks restore, direct `main()` return, handler-side mutation, counter-only control, literal CIA write and ordinary runtime-address game write. Tasks 1.1.2 and 1.2.2–1.2.3 own the proof. DEF-14 is tracked in the feature roadmap before RD-05 closeout. A targeted final recheck found no residual PF-002 gap; no compiler code or frozen spec changed.

### PF-003: Existing exact-inventory tests are absent from the task list 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Test Impact)
**Location:** `99-execution-plan.md:28,47`; `07-testing-strategy.md:44`
**Codebase evidence:** `packages/compiler/src/frontend/profile.spec.test.ts:73–79` asserts the complete capability array. `packages/compiler/src/frontend/profile-constants.spec.test.ts:23–40,48–55` asserts complete constant and capability arrays. The plan adds names to both inventories.

**Problem:** Approved CIA declarations will fail these existing tests, but neither file is in the modification set or assigned task. The generic exception for obsolete expectations does not make the update executable.

**Recommended correction (only viable):** Name both exact-inventory tests in the modification set and assign precise expectation updates to the specification-test session. Preserve all existing entries and report the exact changes before editing. Weakening either test to a subset check was considered and dropped because it would lose existing contract coverage.
**Confidence:** High — the arrays are exact by inspection.
**Hardening:** Independent challenge found no narrower way to keep the full checkpoint green.
**Challenger:** converged.
**User Decision:** Resolved — user accepted the exact-inventory test correction on 2026-09-29.
**Iteration 2 evidence:** `packages/compiler/src/frontend/profile-constants.impl.test.ts:85–102` also hard-codes the current 31 bindings and 17-function boundary. This is the same test-impact root cause; no other exact profile count or inventory assumption was found.
**Verification:** The third test is named in `02-current-state.md`, `07-testing-strategy.md`, and the expected modification set. Task 1.2.7 updates only its stale numeric assertions before the existing profile-regression green gate; task 1.1.1 still owns the two specification inventories. All other assertions remain. A targeted final check confirmed the order and scope.

### PF-004: Timer A's shared consumers need an explicit precondition 🟡 MINOR

**Dimension:** 2 — Implicit Assumptions
**Location:** `03-cia-operations.md:38,46,50`; `07-testing-strategy.md:22` (ST-5)
**Codebase evidence:** The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) states that Timer A clocks serial output. The planned CRA read/modify/write preserves the serial-direction bit but changes the timer period or mode. The pinned KERNAL IRQ path also uses Timer A.

**Problem:** Preserving CRA's serial bit does not preserve an active serial-output rate. The one-writer statement reads like a proved source restriction although the planned check proves only IRQ route and mask. This is a contract/qualification gap, not a reason for a shared-device manager.

**Recommended correction (only viable in scope):** State that timer reprogramming requires other Timer A consumers to be quiescent or explicitly owned, and that “one writer” is a qualification precondition, not a compiler-enforced guarantee. Keep ST-5's bit-preservation test, but explicitly state that active serial-output timing is *not* preserved. A runtime serial manager was dropped as unapproved extra machinery.
**Confidence:** Medium — proof that selected profiles cannot have an active CIA1 serial-output consumer would reduce this to wording alone.
**Hardening:** Independent challenge reduced this from a proposed major safety gap to a minor explicit-contract gap.
**User Decision:** Resolved — user accepted the explicit Timer A consumer precondition on 2026-09-29.
**Verification:** `03-cia-operations.md` §Device Effects says Timer A reprogramming may change active serial timing and that one-writer/quiescent-consumer conditions are qualification preconditions, not a new compiler-enforced manager. ST-5 asserts preserved register bits without promising active serial timing continuity.

### PF-005: Test matrix misses parts of the public contract 🟡 MINOR

**Dimension:** 7 — Testability
**Location:** `07-testing-strategy.md:8,18–27,35–40`; `99-execution-plan.md:35–38`
**Codebase evidence:** `03-cia-operations.md:13–17,40–41` defines both counter reads on both CIAs plus ownership and invalid-mask behavior. Existing `test/rd05/profile-fixture.ts:9–35,111–118` and `test/m1/vice-monitor.ts:65–96` support the omitted cases without a new harness.

**Problem:** ST-1/ST-2 name only CIA1 A and CIA2 B counter reads; ST-8 omits no-owner latch and mask-write calls; ST-10 omits invalid constant disable masks. ST-3 requires a decrement during a read but is mapped only to a compile-time test, without a deterministic runtime observation or an explicit two-read oracle.

**Recommended correction (only viable within the planned test scope):** Expand the existing ST rows/files to cover all four counter reads and omitted negative calls. Narrow ST-3 to the exact low-then-high two-read instruction oracle, which proves the stated non-atomic contract without timing a decrement in VICE. Add no harness.
**User Decision:** Resolved — user accepted the narrow test-matrix correction on 2026-09-29.
**Verification:** ST-1/ST-2 cover all four counter reads; ST-8 covers no-owner latch/mask calls; ST-10 covers invalid disable masks; ST-3 is an exact low/high output oracle. ST-12 also distinguishes known raw CIA1 writes from legal, volatile runtime-address game writes without requiring alias analysis. All cases map to named files and tasks.

## Verdict

The seven-document plan **passes preflight**. Iteration 2 rechecked all 13 dimensions and reopened only PF-002/PF-003 consequences plus PF-005's raw-address test boundary; no independent new root cause remained. Iteration 3 checked those corrections and their direct dependency surface. Two small sequencing/test-input omissions found there were corrected and directly verified. Five findings are resolved; no critical, major or minor finding remains open.

The selected design remains a direct API plus one focused ownership check and existing lowering/tests. It does not add a scheduler, runtime manager, alias-analysis framework, new harness or dependency. The temporary nonreturning CIA1-takeover guard is explicit and DEF-14 owns safe return to BASIC before RD-05 closeout. This audit changed the plan/report and feature roadmap only; compiler code, tests, frozen `spec/`, and the expert skill remain untouched. Independent clustered auditors reviewed iteration 2 and two targeted auditors reviewed iteration 3; a separate challenger checked the raw-address decision. This is same-session correction review, so later execution should compare the plan digest above before using the pass.
