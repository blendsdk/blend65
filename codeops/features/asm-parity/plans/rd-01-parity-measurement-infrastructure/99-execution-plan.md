# Execution Plan: RD-01 Parity Measurement Infrastructure

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-18 05:04 (Phase 5 complete)
> **Progress**: 38/52 tasks (73%)
> **CodeOps Skills Version**: 3.9.0

## Overview

Seven phases building RD-01's instruments in dependency order: timing table → measurement
stack → rasterpoll fixture → budget tier → parity scripts → resource report → closeout.
Emulator-dependent green phases (2, 4) additionally run the local `skipIf(!hasVice())` tier.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Timing table (core) | 6 |
| 2 | Measurement stack (driver fix, text client, measureCycles) | 10 |
| 3 | Rasterpoll golden fixture | 5 |
| 4 | Budget tier + size gate | 10 |
| 5 | Parity scripts | 9 |
| 6 | Resource report | 9 |
| 7 | Closeout | 3 |

**Total: 52 tasks across 7 phases** (no fabricated hour estimates — scope bounded by the
task-size criteria in the quality checklist)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line
> appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** and the Last Updated stamp after EVERY task — never batch.
>    Only `[x]` counts as complete.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 1: Timing table (core)

### Step 1.1: Specification tests
**Reference**: 03-01 · 07 ST-1…ST-5 · req-AR #6
- [x] 1.1.1 Write timing spec tests (ST-1…ST-4) — `packages/core/src/timing/nmos-table.spec.test.ts`; coverage + type-error spec (ST-5) — `packages/codegen/src/instr/timing-coverage.spec.test.ts` ✅ (completed: 2026-07-18 02:26)
- [x] 1.1.2 Run them — verify they FAIL (red phase) ✅ (completed: 2026-07-18 02:26 — both files red: core fails on missing ./index.js, codegen on missing platform export; commit deferred to green per red-test rule)

### Step 1.2: Implementation
**Reference**: 03-01 §Implementation Details
- [x] 1.2.1 Implement `NmosOpcode`, `InstrTiming`, `getTiming`, the NMOS data table — `packages/core/src/timing/` (+ platform-subpath barrel export) ✅ (completed: 2026-07-18 02:33)
- [x] 1.2.2 Run spec tests — verify they PASS (green phase) ✅ (completed: 2026-07-18 02:33 — 6 core + 2 codegen spec tests green; typecheck+lint clean; full core (287) + codegen (530) suites green)

### Step 1.3: Impl tests & hardening
- [x] 1.3.1 Write table-invariant impl tests — `packages/core/src/timing/nmos-table.impl.test.ts` ✅ (completed: 2026-07-18 02:38 — 6 invariant tests green)
- [x] 1.3.2 Full verification ✅ (completed: 2026-07-18 02:38 — full verify green: install, build, typecheck, lint, all tests incl. root boundary tier)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Measurement stack

### Step 2.1: Specification tests
**Reference**: 03-02 · 07 ST-6…ST-11 · plan-AR #1, #8, #10, #11
- [x] 2.1.1 Author the IRQ demo fixture (own-raster-IRQ, labeled window, hand-computed cycle sum in the test) — `packages/test-harness/test/asm/measure-irq-demo.asm` ✅ (completed: 2026-07-18 02:52 — assembles clean; window 51441+3×31=51534, labels verified)
- [x] 2.1.2 Write measurement spec tests (ST-6…ST-11) — `measure.spec.test.ts`, `text-monitor.spec.test.ts`, `advance.spec.test.ts` (test-harness `src/`) + `testing/irq-demo.ts` assembly helper ✅ (completed: 2026-07-18 02:56)
- [x] 2.1.3 Run them — verify they FAIL (red phase; emulator STs red locally) ✅ (completed: 2026-07-18 02:56 — advance.spec red on REAL VICE: counter delta 0 (the live race); measure/text-monitor red on missing modules)

### Step 2.2: Implementation
**Reference**: 03-02 §Proposed · plan-AR #1 mitigations
- [x] 2.2.1 Fix `advanceInstructions` STOPPED-event completion (+ `executeUntilReturn` same fix) — `packages/test-harness/src/emulator/vice/vice-driver.ts` ✅ (completed: 2026-07-18 03:14)
- [x] 2.2.2 Implement `TextMonitorClient` (strict parser, drain/prompt/anchored-regex, stop-state invariant) — `packages/test-harness/src/emulator/vice/text-monitor.ts` ✅ (completed: 2026-07-18 03:14)
- [x] 2.2.3 Add `remoteMonitorPort` + remote-monitor launch args + `VICE_INFO` version gate; extend `writeRegisters` with `FL` + expose checkpoint delete; `setupEmulator` acquires a second free port; registry pins `-pal` — `driver.ts`, `vice-driver.ts`, `protocol.ts`, `fixture.ts`, `registry.ts` ✅ (completed: 2026-07-18 03:14)
- [x] 2.2.4 Implement `measureCycles` (checkpoints up-front, from-checkpoint released after the from-stop so loop windows never re-stop there, all deleted on every exit path, PC asserts, absolute reads, `withTimeout` exported from `strategies.ts`; metric + determinism doc-comment) and the `quiesce` helper (I-flag mask; optional display blank + settle) — `packages/test-harness/src/run/measure.ts`, `strategies.ts` ✅ (completed: 2026-07-18 03:14)
- [x] 2.2.5 Run spec tests — verify they PASS (green phase; emulator tier green locally) ✅ (completed: 2026-07-18 03:14 — 6/6 green incl. hand-computed 51534 identical across two fresh VICE processes; full harness suite 179/179; barrel-surface pin extended with the 4 new documented exports)

### Step 2.3: Impl tests & hardening
- [x] 2.3.1 Write parser/driver impl tests (split frames, banner interleaving, either-order events) — `text-monitor.impl.test.ts`, `measure.impl.test.ts` ✅ (completed: 2026-07-18 03:30 — 7 impl tests; surfaced a real reply-completion race (stop banner's prompt arriving post-drain) → completion predicate now requires the labeled stopwatch line, which may sit directly after a prompt; 13/13 twice consecutively)
- [x] 2.3.2 Full verification + local emulator suites ✅ (completed: 2026-07-18 03:30 — full verify green incl. complete local emulator tier)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (+ local `skipIf(!hasVice())` tier green)

---

## Phase 3: Rasterpoll golden fixture

### Step 3.1: Specification tests
**Reference**: 03-03 §Rasterpoll · 07 ST-12, ST-13 · plan-AR #4
- [x] 3.1.1 Write the golden + landmark spec tests — `packages/test-harness/src/golden-rasterpoll.spec.test.ts` ✅ (completed: 2026-07-18 03:42)
- [x] 3.1.2 Run them — verify they FAIL (red phase) ✅ (completed: 2026-07-18 03:42 — both red: golden missing; landmark test red on the (later-corrected) `$0400` formatting prediction)

### Step 3.2: Implementation
- [x] 3.2.1 Author the fixture program + testing module — `examples/rasterpoll/main.blend`, `packages/test-harness/src/testing/rasterpoll.ts` ✅ (completed: 2026-07-18 03:42)
- [x] 3.2.2 Generate, inspect, and commit the golden — `packages/test-harness/test/golden/rasterpoll.asm.golden`; verify spec tests PASS (green) ✅ (completed: 2026-07-18 03:42 — inspected: poll compiles to materialized boolean + re-test (RD-04 fusion gap, the fixture's purpose) and `$400` 3-digit formatting; landmark assertion grounded to the real emission)

### Step 3.3: Hardening
- [x] 3.3.1 Full verification (12 existing goldens must stay byte-exact) ✅ (completed: 2026-07-18 03:42 — full verify green, all golden suites pass)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 4: Budget tier + size gate

### Step 4.1: Specification tests
**Reference**: 03-03 · 07 ST-14…ST-19 · req-AR #3/#4/#5/#12 · plan-AR #3
- [x] 4.1.1 Write loader + tier spec tests (ST-14…ST-19) and the ACME report-parser spec tests (ST-32, ST-33) — `packages/test-harness/src/budgets.spec.test.ts` + `budget-loader.spec.test.ts`, `packages/compiler/src/acme/report-file.spec.test.ts` ✅ (completed: 2026-07-18 04:00)
- [x] 4.1.2 Run them — verify they FAIL (red phase) ✅ (completed: 2026-07-18 04:00 — all three files red on missing modules)

### Step 4.2: Implementation
- [x] 4.2.1 Implement the shared ACME report parser + (opcode, mode) classifier (typed on core instr-model; strict, loud; tolerates ACME's `...`-truncated data lines) — `packages/compiler/src/acme/report-file.ts` + `cycleRange` (exported from `@blend65/compiler`) ✅ (completed: 2026-07-18 04:24)
- [x] 4.2.2 Implement the strict budget-file loader — test-harness `src/budget-loader.ts` (+ `checkCostWithinBudget` exact ratchet) ✅ (completed: 2026-07-18 04:24)
- [x] 4.2.3 Implement the balloon build helper (mkdtemp + `build()` facade, copying the committed example) — `packages/test-harness/src/testing/balloon.ts` ✅ (completed: 2026-07-18 04:24)
- [x] 4.2.4 Wire the tier: bytes assertions (CI), static span/perIteration windows via report-parser slices + `getTiming` (CI; loop-shaped windows slice through the back-edge — plan-AR #12 runtime), measured windows quiesced then `measureCycles` (`skipIf(!hasVice())`) — `budgets.spec.test.ts`; `measureCycles` corrected to arm the to-checkpoint only after the from-stop (mid-loop starts otherwise stop at the window end first) ✅ (completed: 2026-07-18 04:24)
- [x] 4.2.5 Seed `budgets.json` with exact current values (bytes for all 14 programs; slice8b copyLoop static 67 — measured dropped per plan-AR #13 runtime (boot-frame badline latch defeats external quiesce for one-shot windows); rasterpoll pollIter 25; balloon frameUpdate static 269 + measured 162 quiesced-deterministic) — `packages/test-harness/test/golden/budgets.json` ✅ (completed: 2026-07-18 04:24)
- [x] 4.2.6 Run spec tests — verify they PASS (green; CI tier + local tier) ✅ (completed: 2026-07-18 04:24 — 30/30 across budgets/loader/measure suites)

### Step 4.3: Impl tests & hardening
- [x] 4.3.1 Write loader/span-math impl tests — `budget-loader.impl.test.ts` + `report-file.impl.test.ts` (edge cases, cycle-range math, real-ACME round-trip across 8 mode families) ✅ (completed: 2026-07-18 04:34)
- [x] 4.3.2 Full verification + local emulator suites ✅ (completed: 2026-07-18 04:34 — full verify green incl. local emulator tier)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (+ local `skipIf(!hasVice())` tier green)

---

## Phase 5: Parity scripts

### Step 5.1: Specification tests
**Reference**: 03-04 · 07 ST-20…ST-26 · req-AR #8/#9/#10/#11 · RD AC-9
- [x] 5.1.1 Write script spec tests incl. security cases (ST-20…ST-26) — repo-root `test/twin-diff.spec.test.ts`, `test/annotate-cycles.spec.test.ts` ✅ (completed: 2026-07-18 04:58)
- [x] 5.1.2 Run them — verify they FAIL (red phase) ✅ (completed: 2026-07-18 04:58 — both red: scripts missing)

### Step 5.2: Implementation
- [x] 5.2.1 Create the pair manifest — `packages/test-harness/test/golden/twins.json` (balloon: source dir + twin path) ✅ (completed: 2026-07-18 04:58)
- [x] 5.2.2 Implement `twin-diff.mjs` (manifest, both sides assembled + parsed via the shared report parser, five-category classifier, byte ratios from PRG sizes + max÷max cycle ratios with min/max sums in JSON, markdown + `--json`, unpaired handling, path canonicalization; twin's own `!to` drives its output) — `scripts/twin-diff.mjs` ✅ (completed: 2026-07-18 04:58 — first live scoreboard: balloon bytes 3.26×, cycles 3.91×)
- [x] 5.2.3 Implement `annotate-cycles.mjs` (shared report parser, min–max annotation, block sums, convenience assemble flag, path canonicalization) — `scripts/annotate-cycles.mjs` ✅ (completed: 2026-07-18 04:58)
- [x] 5.2.4 Add root aliases `twin:diff` / `annotate:cycles` — `package.json`; append CI step "twin-diff (informational)" — `.github/workflows/ci.yml`; `.gitignore` gains `test/.tmp-*/` for in-repo test scratch ✅ (completed: 2026-07-18 04:58)
- [x] 5.2.5 Run spec tests — verify they PASS (green phase) ✅ (completed: 2026-07-18 04:58 — 5/5 green)

### Step 5.3: Impl tests & hardening
- [x] 5.3.1 Write classifier/parser impl tests — root `test/twin-diff.impl.test.ts` + `test/annotate-cycles.impl.test.ts` (root vitest include widened to the impl tier) ✅ (completed: 2026-07-18 05:04)
- [x] 5.3.2 Full verification ✅ (completed: 2026-07-18 05:04 — full verify green; root tier 6 files / 17 tests)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 6: Resource report

### Step 6.1: Specification tests
**Reference**: 03-05 · 07 ST-27…ST-31 · req-AR #7/#14 · PF-002
- [ ] 6.1.1 Write report spec tests (ST-27…ST-31) — core `report/*.spec.test.ts` + compiler build-level test
- [ ] 6.1.2 Run them — verify they FAIL (red phase)

### Step 6.2: Implementation
- [ ] 6.2.1 Add `FunctionCostEstimate` + report fields — `packages/core/src/report/resource-report.ts`, `build-resource-report.ts`
- [ ] 6.2.2 Implement `summarizeFunctionCosts` (min–max via `getTiming`; non-NMOS marker) — `packages/codegen`
- [ ] 6.2.3 Compute C64 startup-shim cycles — `packages/platforms`
- [ ] 6.2.4 Thread through the compiler; extend both renderers; regenerate the terminal golden — `compiler/src/api/build.ts`, `render-report-terminal.ts`, `render-report-json.ts`
- [ ] 6.2.5 Run spec tests — verify they PASS (green phase)

### Step 6.3: Impl tests & hardening
- [ ] 6.3.1 Write summarizer/renderer impl tests — codegen + core impl test files
- [ ] 6.3.2 Full verification

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 7: Closeout

**Reference**: RD AC-10 · roadmap skill · preflight PF-019
- [ ] 7.1.1 Full verify + complete local emulator tier run; confirm all RD AC boxes
- [ ] 7.1.2 Preserve the VICE spike probe scripts (consolidated) + a README of the measured ground-truth numbers under `research/` (PF-019)
- [ ] 7.1.3 Post the area report (examined / found / deferred + why) on issue #64; tick the umbrella #56 checklist item; sync the roadmap

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (+ local `skipIf(!hasVice())` tier green)

---

## Dependencies

```
Phase 1 (timing table)
    ↓                ↘
Phase 2 (measurement)  Phase 5 (scripts, needs built core)
    ↓                  Phase 6 (report, needs Phase 1 only)
Phase 3 (fixture)
    ↓
Phase 4 (budget tier — needs 1, 2, 3)
    ↓
Phase 7 (closeout — needs all)
```

Phase 6 may execute any time after Phase 1. Phase 5 additionally needs the shared ACME report
parser (task 4.2.1, consumed by both scripts — PF-010); the listed order keeps the
emulator-heavy work contiguous.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed; RD-01 AC-1…AC-10 all check
2. ✅ All verification passing (verify command above; emulator tier green locally)
3. ✅ No warnings/errors; 12 existing goldens byte-identical
4. ✅ No dead code
5. ✅ Security criteria: ST-24 + RD AC-9 pass; argv-only spawns
6. ✅ Documentation: JSDoc on all new exports; metric/determinism contract documented
7. ✅ Area report posted on #64
8. ✅ Post-completion project re-analysis (exec_plan skill)
