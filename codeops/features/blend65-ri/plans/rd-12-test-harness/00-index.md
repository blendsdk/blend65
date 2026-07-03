# RD-12: Test Harness & Emulator Verification — Implementation Plan

> **Feature**: The `@blend65/test-harness` published package — the three-tier testing
> taxonomy and the runtime-verification framework (`EmulatorDriver` + VICE `x64sc`
> binary-monitor driver, run strategies, register/memory assertions, golden-snapshot
> helper, and the Vitest lifecycle fixture) that makes Language-Guard C5 verification real.
> **Status**: Planning Complete
> **Created**: 2026-07-03
> **Implements**: blend65-ri/RD-12
> **Source RD**: [RD-12](../../requirements/RD-12-test-harness.md) (requirements preflight
> ✅ PASSED 2026-07-03, 8 findings applied)
> **CodeOps Skills Version**: 3.1.0

## Overview

RD-12 delivers the third leg of the Language Guard's testability mandate: **C5 runtime
verification** — compile a Blend65 program to a binary, load it in a real (emulated) 6502
platform, run it to a defined sync point, and assert register/memory truth. The vehicle is
`@blend65/test-harness`, a **published** package (AR-24) usable both by the compiler's own
test suite and by game developers testing their own compiled programs.

The framework is built around an abstract `EmulatorDriver` (AR-23) with one concrete MVP
implementation, `ViceDriver`, speaking VICE `x64sc`'s **binary-monitor protocol** over a
TCP socket. On top of the driver sit three run strategies (`runUntilLabel` / `runFrames` /
`runUntilMemory`, each with a mandatory timeout guard — AR-26), register/memory assertion
helpers (register/memory are the deterministic assertion surface; screenshots are
failure-only artifacts — AR-25), a `setupEmulator` Vitest fixture that owns the emulator
lifecycle (AR-24), a harness-internal platform→emulator registry (R7a — c64→`x64sc` for the
MVP), and an `assertGolden` helper for committed golden-snapshot tests (R29–R32).

The plan opens with a **Phase-0 prerequisite fix (DEF-2)**: a live gate build proved that
the shipped `invokeAcme` requests ACME's native symbol list (`-l`) instead of the VICE
format (`--vicelabels`), so `parseLabelFile` silently returns an **empty `symbolMap`** for
every real build. Since label-based sync and symbolic assertions are load-bearing for
RD-12, the flag is corrected and locked with a regression oracle before any harness code is
written. The plan also **discharges RD-17's inherited AC-14** (AR-P4): Tier-3 vectors verify
the `__rt_mul8/mul16/div8/div16` runtime routines on real VICE, superseding the interim
in-process interpreter (which stays in place as a fast compiler-internal test).

Every emulator/runtime test is authored behind `describe.skipIf(no VICE)` so CI (which has
no emulator tier — AR-27) stays green by skipping (AC-13), while the executor proves them
green locally against the installed VICE 3.10 (AR-H3). The pure binary-monitor **protocol
codec** is split out (AR-H14) so its framing tests run in CI with no emulator at all.

## Document Index

| #   | Document                                                        | Description                                             |
| --- | -------------------------------------------------------------- | ------------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                 | Zero-Ambiguity Gate decisions (audit trail, AR-H1..H17) |
| 00  | [Index](00-index.md)                                           | This document — overview and navigation                 |
| 01  | [Requirements](01-requirements.md)                             | Feature requirements and scope                          |
| 02  | [Current State](02-current-state.md)                           | Current implementation analysis + the DEF-2 finding     |
| 03-01 | [DEF-2 VICE Label Fix](03-01-def2-label-fix.md)              | The Phase-0 RD-09 prerequisite fix                      |
| 03-02 | [Emulator Driver & VICE Protocol](03-02-emulator-driver.md)  | `EmulatorDriver`, `ViceDriver`, binary-monitor codec, PNG |
| 03-03 | [Run Strategies, Assertions & Fixture](03-03-run-strategies-fixture.md) | Strategies, assertions, R7a registry, `setupEmulator` |
| 03-04 | [Golden, Package & Runtime Verification](03-04-golden-package-runtime.md) | `assertGolden`, publishability, gate + RD-17 AC-14 tests |
| 07  | [Testing Strategy](07-testing-strategy.md)                     | Specification test cases (ST-*) and verification        |
| 99  | [Execution Plan](99-execution-plan.md)                         | Phases, sessions, and the master task checklist         |

## Quick Reference

### Usage Examples

```typescript
import {
  setupEmulator,
  runUntilMemory,
  runUntilLabel,
  assertRegister,
  assertMemory,
} from "@blend65/test-harness";
import { build } from "@blend65/compiler";
import { describe, it, afterAll } from "vitest";

// Emulator tier (local-only; skips cleanly where VICE is absent — AC-13).
describe.skipIf(!hasVice())("gate program on c64", () => {
  it("pokes the border colour", async () => {
    const result = await build({ platform: "c64", sourceFiles: ["examples/gate/main.blend"] });
    const { driver, symbols } = await setupEmulator({ build: result, platform: "c64" });
    // Primary proof: run until the VIC-II border register holds 5 (AR-H9).
    await runUntilMemory(driver, 0xd020, 5);
    await assertMemory(driver, 0xd020, 5);
    // Symbolic path (AR-H2/AR-H9): `_main`'s first opcode is LDA #$05 = $A9.
    await assertMemory(driver, "_main", 0xa9, symbols);
    await driver.shutdown();
  });
});
```

### Key Decisions

| Decision                                   | Outcome                                                                 | AR Ref |
| ------------------------------------------ | ----------------------------------------------------------------------- | ------ |
| Plan scope                                 | Full RD (all 16 ACs), phased                                            | AR-H1  |
| Compiler dependency                        | Depend on `@blend65/compiler`; reuse `parseLabelFile` + `BuildResult`   | AR-H2  |
| Emulator-test completion bar               | Prove green locally on VICE 3.10; `skipIf` keeps CI green (AC-13)        | AR-H3  |
| Screenshot encoding                        | Hand-rolled zero-dependency PNG via Node `zlib`                         | AR-H4  |
| RD-17 AC-14 vector coverage                | Bounded subset (edge crosses + ~25 seeded-random/routine)               | AR-H5  |
| Whole-program test isolation               | Relaunch VICE per binary (`-autostart`); in-session inject for routines | AR-H6  |
| DEF-2 (empty `symbolMap`)                  | Fix `-l`→`--vicelabels` in-plan as Phase 0 + regression oracle          | AR-H7  |
| Gate sync point                            | `runUntilMemory(0xD020,5)` + `runUntilLabel('_main')`                   | AR-H9  |
| `--update-golden` surface                  | `UPDATE_GOLDEN` env var                                                 | AR-H10 |
| Protocol testability                       | Pure codec split from socket transport → codec tests run in CI          | AR-H14 |

## Related Files

**New (`@blend65/test-harness`):** `src/emulator/driver.ts`, `src/emulator/registry.ts`,
`src/emulator/vice/protocol.ts`, `src/emulator/vice/vice-driver.ts`,
`src/emulator/vice/png.ts`, `src/run/strategies.ts`, `src/run/assertions.ts`,
`src/fixture.ts`, `src/golden.ts`, and the co-located `*.spec.test.ts` / `*.impl.test.ts`
suites; rewritten `src/index.ts` barrel; updated `package.json` (adds `@blend65/compiler`
as a runtime dependency and `@blend65/codegen` as a **test-scope devDependency** for the
RD-17 routine vectors — PF-001); updated `tsconfig.json` project references (`../compiler`,
`../codegen`) per the repo's 1:1 deps↔references convention.

**Modified (Phase 0):** `packages/compiler/src/acme/invoke-acme.ts` (`-l`→`--vicelabels`),
`packages/compiler/src/acme/invoke-acme.impl.test.ts` (argv assertion), a new
`packages/compiler/src/acme/vice-label.spec.test.ts` regression oracle.

**Bookkeeping:** `CLAUDE.md` dependency table (test-harness row → `core, compiler` (+ `codegen` dev-only)),
`codeops/features/blend65-ri/00-roadmap.md` (status), the RD-17 plan/roadmap AC-14 tick.
