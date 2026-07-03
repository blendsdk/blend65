# Requirements: RD-12 — Test Harness & Emulator Verification

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-12](../../requirements/RD-12-test-harness.md)

## Feature Overview

`@blend65/test-harness` is the published package that provides **runtime verification** of
compiled Blend65 programs on real (emulated) 6502 platforms — the C5 leg of the Language
Guard. It defines the three-tier test taxonomy (unit / golden-snapshot / emulator-runtime),
an abstract `EmulatorDriver` interface, a concrete VICE `x64sc` binary-monitor driver
(`ViceDriver`), three timeout-guarded run strategies, register/memory assertion helpers, a
golden-snapshot helper, and a Vitest fixture managing the emulator lifecycle.

This plan implements the full RD (all 16 acceptance criteria, AR-H1), opening with a
Phase-0 fix (DEF-2, AR-H7) to a latent RD-09 defect that leaves the compiler's `symbolMap`
empty, and closing by discharging RD-17's inherited AC-14 (emulator verification of the
runtime math routines, AR-P4) on real VICE.

## Functional Requirements

### Must Have

- [ ] **Phase 0 — DEF-2 fix** (AR-H7): `invoke-acme.ts` emits VICE-format labels
      (`--vicelabels`) so `parseLabelFile` yields a populated `symbolMap`; regression oracle.
- [ ] **`EmulatorDriver` interface** (R6, AC-01): `launch`/`loadBinary`/`setBreakpoint`/
      `resume`/`readRegisters`/`readMemory`/`writeMemory`/`captureScreenshot`/`shutdown`.
- [ ] **`ViceDriver`** (R7, AC-02): implements `EmulatorDriver` over VICE's binary-monitor
      protocol; headless + GUI modes (R8); loopback socket (AR-H8/AR-H11).
- [ ] **VICE binary-monitor codec** (R10–R16, AR-H14): pure frame encode/decode for
      `CHECKPOINT_SET`, `REGISTERS_GET/SET`, `MEMORY_GET/SET`, `EXECUTE_UNTIL_RETURN`,
      `ADVANCE_INSTRUCTIONS`, `DISPLAY_GET`, `PALETTE_GET`, `RESET`, `EXIT`/`QUIT`,
      `REGISTERS_AVAILABLE` (AR-H15).
- [ ] **Run strategies** (R20–R24, AC-03/04/05): `runUntilLabel`, `runFrames`,
      `runUntilMemory`, each with a **mandatory** timeout guard (default 5s, per-test
      overridable) (AC-06).
- [ ] **Assertion helpers** (R17–R19, AC-07/08): `assertRegister`; `assertMemory` (numeric
      address **or** symbolic label resolved via `symbolMap`, keyed per `parseLabelFile`).
- [ ] **Screenshot on failure** (R16/R18, AC-09): `captureScreenshot()` → zero-dep PNG
      artifact (AR-H4), never golden-matched.
- [ ] **`assertGolden`** (R29–R32, AC-10): byte-exact comparison to a committed golden file
      with `UPDATE_GOLDEN` env-var update mode (AR-H10).
- [ ] **`setupEmulator` fixture** (R25–R28, AC-11): owns launch/load/shutdown; accepts a
      RD-15 `BuildResult` or a binary path (+ sibling `.lbl`); relaunch-per-binary (AR-H6).
- [ ] **Platform→emulator registry** (R7a): harness-internal table; c64→`x64sc` for the MVP.
- [ ] **Graceful skip** (R5, AC-13): emulator tests `describe.skipIf(no VICE)` — skip, never
      fail, where VICE is absent.
- [ ] **Publishable package** (R33–R35, AC-14 *own*): stable, documented public API; works
      with any binary + label file (not Blend65-specific, AC-15).
- [ ] **RD-17 inherited AC-14** (AR-P4): Tier-3 vectors verify `__rt_mul8/mul16/div8/div16`
      on real VICE (bounded subset, AR-H5).
- [ ] **Gate-program emulator test**: `examples/gate/main.blend` → c64 `.prg` → VICE asserts
      `$D020 == 5` (AR-H9), proving the MVP gate (AR-43/44).

### Should Have

- [ ] Register-name→id mapping via `REGISTERS_AVAILABLE` for version robustness (AR-H15).
- [ ] CI-verified protocol codec spec tests (no emulator needed, AR-H14).
- [ ] At least one demonstrating golden test (e.g. gate `.asm.golden`) proving `assertGolden`.

### Won't Have (Out of Scope)

- Additional emulator drivers (x16emu/Altirra/Stella) or non-c64 platform registry entries —
  the interface accommodates them (R9); populating them is future work.
- Migrating the 7 existing inline `*.golden.spec.test.ts` suites to `assertGolden` (PF-007).
- A self-hosted CI emulator tier / headless VICE in GitHub Actions (AR-27; RD Open Q #2).
- Retiring or relocating the interim `mos6502-interpreter.ts` — it stays as a
  compiler-internal test (PF-001/AR-H5).
- Screenshot golden-matching (R18 — screenshots are debug artifacts only).

## Technical Requirements

### Performance

- Run strategies must not hang: the timeout guard is mandatory and enforced on every
  strategy (R23, AC-06); default 5s, per-test overridable (R24).
- Routine-vector (AC-14) tests inject per-vector within a single VICE session (no relaunch)
  to keep the bounded suite quick (AR-H5/AR-H6).

### Compatibility

- Targets VICE 3.7+ binary-monitor protocol; validated live against the installed VICE 3.10
  (RD Open Q #1). Register ids resolved dynamically (AR-H15) rather than hardcoded.
- Node 22, ESM/NodeNext; intra-package imports carry `.js`; `import type` for type-only.
- Consumes the RD-15 facade `BuildResult` (`symbolMap`/`binaryPath`/`binary`) and RD-09's
  `parseLabelFile` from `@blend65/compiler` (R27/R28, AR-H2).

### Security

- The monitor socket binds **loopback only** (`127.0.0.1`, AR-H8) — never a routable
  interface; the port is configurable but defaults to 6502.
- VICE is spawned via `node:child_process` with an **argv array** (no shell interpolation);
  the executable path comes from the registry / `LaunchOptions`, binary/label paths are
  passed as discrete args — no command-string concatenation (injection-safe).
- `assertGolden` reads/writes only the caller-supplied golden path; `UPDATE_GOLDEN` write
  mode is an explicit, documented opt-in (R31).
- Zero non-`@blend65` runtime dependencies (AR-H11) — minimal supply-chain surface.

## Scope Decisions

| Decision                              | Options Considered                                     | Chosen                                          | Rationale                                                                 | AR Ref |
| ------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| Plan scope                            | Full RD phased; MVP core slice                         | Full RD, phased                                 | VICE + ACME present locally; nothing blocked                              | AR-H1  |
| Compiler dependency                   | Depend + reuse; stay lean + own parser                 | Depend on compiler; reuse                       | `parseLabelFile`/`BuildResult` already public; DRY; R15-clean             | AR-H2  |
| Emulator-test completion bar          | Prove locally; CI-skip only                            | Prove locally on VICE                           | VICE present → path proven, not just built                                | AR-H3  |
| Screenshot encoding                   | Hand-rolled PNG; raw buffer; PNG lib                   | Hand-rolled zero-dep PNG                        | Honors "PNG" literally; no new dep                                        | AR-H4  |
| RD-17 AC-14 vectors                   | Bounded subset; full parity                            | Bounded subset                                  | Real-silicon parity without a slow suite; interpreter keeps exhaustive    | AR-H5  |
| Whole-program isolation               | Relaunch per binary; one session + reset               | Relaunch per binary                             | Deterministic; local-only so spawn time acceptable                        | AR-H6  |
| DEF-2 disposition                     | Fix in-plan (Phase 0); standalone task first           | Fix in-plan (Phase 0)                           | RD-12 blocked without it; RD-15 DEF-1 precedent                           | AR-H7  |
| Gate sync point                       | `runUntilMemory` + `runUntilLabel('_main')`; add label | `runUntilMemory(0xD020,5)` + `runUntilLabel`    | No `__startup_done` label exists; codegen out of scope                    | AR-H9  |
| `--update-golden` surface             | env var; CLI flag; vitest config                       | `UPDATE_GOLDEN` env var                         | Idiomatic Vitest; no plumbing                                             | AR-H10 |
| Protocol testability                  | Pure codec split; monolithic                           | Pure codec split                                | Codec tests run in CI without VICE                                        | AR-H14 |

> **Traceability:** Every scope decision references its Ambiguity Register entry (AR-H#).
> See `00-ambiguity-register.md`.

## Acceptance Criteria

Mirrors RD-12 §6 (AC-01..AC-16). Traced in `07-testing-strategy.md` and the execution plan:

1. [x] AC-01 `EmulatorDriver` interface defined (launch/load/breakpoint/resume/read/write/screenshot/shutdown; +`advanceInstructions` AR-H18) — `emulator/driver.ts`, exercised via `ViceDriver` (ST-09..13).
2. [x] AC-02 `ViceDriver` implements the interface via VICE's binary-monitor protocol — ST-09..13 green on VICE 3.10.
3. [x] AC-03 `runUntilLabel()` breakpoints at a label address, returns registers on break — ST-21/ST-29 (regs.pc === `_main`).
4. [x] AC-04 `runFrames()` runs N frames (approximate, PF-004) — ST-22 (advances within the guard).
5. [x] AC-05 `runUntilMemory()` polls until a memory value matches — ST-20/ST-29 ($D020 → 0xF5).
6. [x] AC-06 All run strategies enforce a mandatory timeout guard — ST-14/ST-15 (`TimeoutError`, fake driver, CI).
7. [x] AC-07 `assertRegister()` validates register values — ST-16 (hex diff).
8. [x] AC-08 `assertMemory()` validates memory (numeric address or symbolic label) — ST-17/ST-18/ST-29.
9. [x] AC-09 Screenshots captured on failure as artifacts (not golden-matched) — ST-12 (PNG sig/IHDR) + `png.impl`.
10. [x] AC-10 `assertGolden()` compares to committed goldens with `UPDATE_GOLDEN` support — ST-24/25/26 + `golden.impl` + committed `test/golden/gate.asm.golden`.
11. [x] AC-11 The fixture manages emulator lifecycle (launch/load/shutdown) — ST-23 (`setupEmulator`).
12. [x] AC-12 Unit + golden (+ protocol codec) tests run in GitHub Actions CI — codec/assertion/registry/golden/PNG tiers are unguarded (no skipIf); run live in CI.
13. [x] AC-13 Emulator tests skip gracefully when VICE is absent — every emulator suite `describe.skipIf(!hasVice()[ || !hasAcme()])`.
14. [x] AC-14 (own) `@blend65/test-harness` is a publishable package with a stable API — ST-27 (barrel surface, no internal leak); `publishConfig.access: public`.
15. [x] AC-15 The harness works with any binary + label file (not Blend65-specific) — ST-28 (hand-authored PRG + `.lbl`).
16. [x] AC-16 All decisions trace to an `AR-NN`/`AR-H##` or a frozen spec section — traceability comments throughout; AR-H1..H19 register.
17. [x] **RD-17 inherited AC-14**: `__rt_*` routines verified on real VICE (AR-P4, AR-H5) — ST-30..33 green on VICE 3.10 (edge crosses + 25 seeded/routine).
18. [x] **DEF-2**: real `build()` yields a non-empty `symbolMap` (`_main`/`__startup`) — ST-01/ST-02 (Phase 0 oracle).
19. [x] Full workspace verify passes; emulator/RD-17 suites proven green locally on VICE 3.10 — 17/17 turbo tasks green; test-harness 71 tests (Local suites run sequentially, `fileParallelism:false`).
