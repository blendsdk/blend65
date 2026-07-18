# Current State: RD-01 Parity Measurement Infrastructure

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

All facts below were verified against the working tree during RD-01's preflight
(`../../requirements/00-preflight-report.md`, 27 references) and this plan's Phase-1 recon +
live protocol spike. Spike probe scripts are session artifacts (not repo inputs); their numeric
results are recorded in plan-AR #1/#2/#8/#10.

## Existing Implementation

### What Exists

- **VICE driver** — `packages/test-harness/src/emulator/vice/vice-driver.ts`: binary-monitor
  socket driver; register ids resolved dynamically from `REGISTERS_AVAILABLE` at connect
  (`launch`, :117-127); argv-array spawn (`buildArgs`, :83); checkpoints, resume/STOPPED event
  handling, `advanceInstructions` (:211). Codec in `protocol.ts` (CMD table :27-42 — no cycle
  counter command exists).
- **Run strategies** — `packages/test-harness/src/run/strategies.ts`: `runUntilLabel(driver,
  symbols, label, timeout)` (:61-81), `withTimeout` (:40), `INSTRUCTIONS_PER_FRAME = 6000`
  (:21), `runFrames`. `fixture.ts`: `hasVice(platform = "c64")` (:55), `hasAcme` (:64),
  `setupEmulator` → `{driver, symbols}`.
- **Golden corpus** — 12 goldens in `packages/test-harness/test/golden/*.asm.golden`; each has a
  `src/testing/<fixture>.ts` module embedding `examples/<fixture>/main.blend` verbatim and
  building via the compiler `build()`/`emitAsm` facade (slice8b: mkdtemp + real ACME), plus a
  `golden-<fixture>.spec.test.ts`.
- **Instruction model & legality** — core `instr-model/` (`Opcode`, `AddressingMode`);
  codegen `instr/cpu-table.ts` (NMOS legality rows; W65C02 table selected at :181);
  `instr-program.ts` — `InstrProgram.streams`: one `InstrStream` per function, deterministic
  order, `__init` first. No timing data anywhere in the repo.
- **Resource report** — core `report/resource-report.ts` (optional `startupSize`/`startupCycles`
  :86-88, `peepholeStats` :92); owner-grouped `BuildResourceReportInputs`
  (`build-resource-report.ts:20-49`); terminal renderer prints the startup line (:111-112); JSON
  renderer mirrors optional fields; compiler threads inputs at `compiler/src/api/build.ts:86`.
- **ACME artifacts** — every real build already emits `--vicelabels` AND `--report`
  (`compiler/src/acme/invoke-acme.ts` `acmeArgv`; `reportPath` is a required invocation field);
  `parseLabelFile` is exported from `@blend65/compiler` and consumed by the harness fixture
  (`fixture.ts:17,105`). The window-acquisition path (PF-010) builds on these existing outputs.
- **Scripts & CI** — `scripts/gen-capability-matrix.mjs` (fail-loudly pattern; root alias
  `gen:matrix`); root scripts: build/typecheck/lint/test only; `.github/workflows/ci.yml`
  installs ACME (:39-40), no emulator (AR-27); test-harness `vitest.config.ts` sets
  `fileParallelism: false` (:18).
- **Balloon example** — `examples/balloon/main.blend` (raster poll `peek($D012) != 251`,
  unrolled pokes, `embed`); hand-written twin `examples/balloon/balloon.asm` (poll :52-55) —
  the only golden↔twin pair today.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/core/src/timing/` (new) | NMOS timing table | Create (03-01) |
| `packages/test-harness/src/emulator/vice/vice-driver.ts` | Binary-monitor driver | Race fix; remote-monitor launch args; VICE_INFO gate; `FL` register writes + checkpoint delete (03-02) |
| `packages/test-harness/src/emulator/vice/text-monitor.ts` (new) | Stopwatch text client | Create (03-02) |
| `packages/test-harness/src/run/measure.ts` (new) | `measureCycles` + `quiesce` | Create (03-02; PF-009) |
| `packages/test-harness/src/run/strategies.ts` | Run strategies | Export `withTimeout` + doc-comment update (03-02; PF-014) |
| `packages/test-harness/src/fixture.ts` | `setupEmulator` | Acquire a second free port for the remote monitor (03-02; PF-013) |
| `packages/compiler/src/acme/report-file.ts` (new) | Shared ACME report parser + (opcode, mode) classifier | Create (03-04; PF-010) |
| `packages/core/src/platform/platform-plugin.ts` | Platform plugin contract | Optional `startupCost` member (03-05; PF-012) |
| `packages/test-harness/src/budgets.spec.test.ts` (new) + `test/golden/budgets.json` (new) | Budget tier | Create (03-03) |
| `examples/rasterpoll/` + `testing/rasterpoll.ts` + golden (new) | Raster-poll fixture | Create (03-03) |
| `scripts/twin-diff.mjs`, `scripts/annotate-cycles.mjs` (new) + `test/golden/twins.json` (new) | Parity scripts | Create (03-04) |
| `packages/codegen` (summaries), `packages/platforms` (startup cycles), `core/src/report/*`, `compiler/src/api/build.ts` | Report integration | Extend (03-05) |
| root `package.json`, `.github/workflows/ci.yml` | Aliases + informational CI step | Extend (03-04) |

## Gaps Identified

### Gap 1: No cycle measurement
**Current:** the driver asserts memory states only; no cycle source exists (live-verified: the
binary monitor's full register set is PC A X Y SP 00 01 FL LIN CYC — no cumulative counter).
**Required:** exact measured cycles between labels (RD-01 F2).
**Fix:** 03-02 (mechanism per plan-AR #1).

### Gap 2: No timing data
**Current:** legality only (`cpu-table.ts`); no cycles/bytes table anywhere.
**Required:** RD-01 F1. **Fix:** 03-01.

### Gap 3: No cost gates
**Current:** goldens assert text equality; nothing asserts bytes or cycles; CI has no size gate.
**Required:** RD-01 F3/F4. **Fix:** 03-03.

### Gap 4: No parity tooling
**Current:** the balloon twin exists but nothing diffs or scores it.
**Required:** RD-01 F5/F6. **Fix:** 03-04.

### Gap 5: Report stops at segments
**Current:** no per-function data reaches `buildResourceReport`; `startupCycles` never
populated. **Required:** RD-01 F7/F8. **Fix:** 03-05.

### Gap 6 (spike discovery): `advanceInstructions` async race
**Current:** the ADVANCE_INSTRUCTIONS response frame arrives before stepping completes; any
follow-up command aborts stepping mid-flight — `runFrames`/`runUntilMemory` under-run
(live-verified, plan-AR #8). **Required:** completion = STOPPED event. **Fix:** 03-02.

## Dependencies

### Internal
- R15 boundary: `timing/` lives in core precisely so codegen, platforms, compiler, test-harness,
  and scripts can all consume it (req-AR #6); `frontend`/`language-server` never import codegen.
- Budget tier depends on: timing table (static), measureCycles + quiesce (measured), the shared
  ACME report parser (window slicing — PF-010), rasterpoll fixture, balloon build helper.

### External
- VICE 3.10 x64sc (local tiers only; `VICE_INFO` version-gated per plan-AR #1 mitigations),
  ACME 0.97 (`-r, --report FILE`; present in CI).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| VICE text-output format drifts in a future version | Low | Med | Strict anchored parser + loud failure + VICE_INFO gate (plan-AR #1) |
| Unlocked-window measurements read as flaky | Med | Med | Phase-locking contract documented; budget windows quiesced by the harness (plan-AR #10; PF-009) |
| ACME `--report` format drifts in a future ACME | Low | Med | One strict, loudly-failing parser module concentrates the risk (PF-010); format already load-bearing for the annotator (req-AR #8) |
| Ratchet seeding captures a wrong baseline | Low | High | Seed values from the same verified run that lands the tier; AC-4's lower-the-budget failure check proves the gate bites |
| Text/binary monitor interleaving corrupts driver state | Low | High | Text I/O only while stopped, serialized with driver ops (plan-AR #1 mitigations); challenger verified zero cross-socket pollution when honored |
| Terminal-render golden churn from F7 section | High | Low | Golden updated in the same change (RD F7); diff reviewed |
