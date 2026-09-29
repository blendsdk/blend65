# Preflight Report: RD-05 CIA Timer and Interrupt Slice

> **Status:** ❌ PREFLIGHT BLOCKED — 3 major and 2 minor findings pending
> **Iteration:** 1 (first scan)
> **Audit target:** Full seven-document plan in `codeops/features/blend65-v4/plans/rd-05-cia-interrupts/`; starting git tree `727f9e1ec56457490e317bcad014be0937719e62` at HEAD `895eda1c`
> **Context only:** `AGENTS.md`, feature roadmap, RD-05, frozen Specification 4, qualified expert baseline, MOS 6526 data sheet, pinned KERNAL sources, and current compiler/tests
> **Codebase grounded:** 18 source/test/config files examined; 14 plan-to-code or primary-source references checked
> **Last updated:** 2026-09-29

## Codebase context

The project uses TypeScript 7, Node 22, Yarn 1, Vitest, ACME 0.97 and VICE 3.10. Selected C64 calls are declared in `packages/compiler/src/frontend/profile.ts`, bound by `profile-bindings.ts`, checked through `semantic/interrupt-ownership.ts`, and emitted by direct C64 lowering. The compiler has vector ownership but no CIA source/mask proof. Existing RD-05 fixtures compile real programs and run VICE sequentially. No new runtime, framework, harness or dependency is needed for this slice.

The main files checked were `profile.ts`, `profile-bindings.ts`, both exact-inventory frontend specification tests, `operations.ts`, `whole-program.ts`, `interrupt-ownership.ts`, `target/profile.ts`, `target/c64-kernal.ts`, `lower-c64.ts`, `lower-c64-interrupt.ts`, `lower-platform.ts`, `lower-control.ts`, `lower-state.ts`, `layout/startup.ts`, `test/rd05/profile-fixture.ts`, `test/rd05/handler-irq-vice.spec.test.ts`, and `test/m1/vice-monitor.ts`. The 17 plan tasks are specification-first and follow existing module seams.

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
| Major | 3 | Pending |
| Minor | 2 | Pending |
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
**User Decision:** Pending.

### PF-002: CIA1 takeover has no safe return-to-BASIC rule 🟠 MAJOR

**Dimension:** 6 — Feasibility Concerns
**Location:** `03-cia-operations.md:52`; `07-testing-strategy.md:29` (ST-12)
**Codebase evidence:** `restoreIRQ()` changes only CINV in `packages/compiler/src/machine/lower-c64-interrupt.ts:166–171,185–265`; `packages/compiler/src/layout/startup.ts:168–199,354–370` restores no CIA1 timer or mask state. `spec/appendix-c64.md:233–239` requires a returning program to release exclusive resources and restore captured device state. The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) makes the ICR mask write-only.

**Problem:** A program can disable all CIA1 interrupt sources, restore the KERNAL vector and return to BASIC. The plan's source-mask rule permits the vector restore because no enabled source crosses to an unowned route, but the KERNAL Timer A service can remain disabled or reprogrammed. ICR cannot reveal the prior mask.

**Recommended correction (only viable within this slice):** Reject `restoreIRQ()`/normal-return paths after CIA1 mask or timer-state mutation unless exact restoration is separately proved. Record the nonreturning-program limitation plainly. A hard-coded stock KERNAL reinitialization was considered and dropped because it cannot restore an arbitrary prior write-only mask.
**Confidence:** High — a bounded exact prior-state capture/restore mechanism would change this.
**Hardening:** Independent challenge confirmed that assumed stock-state reinitialization is not exact restoration.
**Challenger:** converged.
**User Decision:** Pending.

### PF-003: Existing exact-inventory tests are absent from the task list 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Test Impact)
**Location:** `99-execution-plan.md:28,47`; `07-testing-strategy.md:44`
**Codebase evidence:** `packages/compiler/src/frontend/profile.spec.test.ts:73–79` asserts the complete capability array. `packages/compiler/src/frontend/profile-constants.spec.test.ts:23–40,48–55` asserts complete constant and capability arrays. The plan adds names to both inventories.

**Problem:** Approved CIA declarations will fail these existing tests, but neither file is in the modification set or assigned task. The generic exception for obsolete expectations does not make the update executable.

**Recommended correction (only viable):** Name both exact-inventory tests in the modification set and assign precise expectation updates to the specification-test session. Preserve all existing entries and report the exact changes before editing. Weakening either test to a subset check was considered and dropped because it would lose existing contract coverage.
**Confidence:** High — the arrays are exact by inspection.
**Hardening:** Independent challenge found no narrower way to keep the full checkpoint green.
**Challenger:** converged.
**User Decision:** Pending.

### PF-004: Timer A's shared consumers need an explicit precondition 🟡 MINOR

**Dimension:** 2 — Implicit Assumptions
**Location:** `03-cia-operations.md:38,46,50`; `07-testing-strategy.md:22` (ST-5)
**Codebase evidence:** The [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf) states that Timer A clocks serial output. The planned CRA read/modify/write preserves the serial-direction bit but changes the timer period or mode. The pinned KERNAL IRQ path also uses Timer A.

**Problem:** Preserving CRA's serial bit does not preserve an active serial-output rate. The one-writer statement reads like a proved source restriction although the planned check proves only IRQ route and mask. This is a contract/qualification gap, not a reason for a shared-device manager.

**Recommended correction (only viable in scope):** State that timer reprogramming requires other Timer A consumers to be quiescent or explicitly owned, and that “one writer” is a qualification precondition, not a compiler-enforced guarantee. Keep ST-5's bit-preservation test, but explicitly state that active serial-output timing is *not* preserved. A runtime serial manager was dropped as unapproved extra machinery.
**Confidence:** Medium — proof that selected profiles cannot have an active CIA1 serial-output consumer would reduce this to wording alone.
**Hardening:** Independent challenge reduced this from a proposed major safety gap to a minor explicit-contract gap.
**User Decision:** Pending.

### PF-005: Test matrix misses parts of the public contract 🟡 MINOR

**Dimension:** 7 — Testability
**Location:** `07-testing-strategy.md:8,18–27,35–40`; `99-execution-plan.md:35–38`
**Codebase evidence:** `03-cia-operations.md:13–17,40–41` defines both counter reads on both CIAs plus ownership and invalid-mask behavior. Existing `test/rd05/profile-fixture.ts:9–35,111–118` and `test/m1/vice-monitor.ts:65–96` support the omitted cases without a new harness.

**Problem:** ST-1/ST-2 name only CIA1 A and CIA2 B counter reads; ST-8 omits no-owner latch and mask-write calls; ST-10 omits invalid constant disable masks. ST-3 requires a decrement during a read but is mapped only to a compile-time test, without a deterministic runtime observation or an explicit two-read oracle.

**Recommended correction (only viable within the planned test scope):** Expand the existing ST rows/files to cover all four counter reads and omitted negative calls. Narrow ST-3 to the exact low-then-high two-read instruction oracle, which proves the stated non-atomic contract without timing a decrement in VICE. Add no harness.
**User Decision:** Pending.

## Verdict

The plan is **blocked pending user decisions and narrow plan corrections**. Its main architecture, task order, direct lowering and test infrastructure are sound. No compiler code, frozen specification, expert skill, requirement or roadmap status was changed by this audit. A passing re-scan is required before implementation begins.
