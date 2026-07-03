# Testing Strategy: RD-12 — Test Harness & Emulator Verification

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- **Unit / codec / assertion / golden tests:** run in CI with **no** emulator (AR-H14) —
  the protocol codec, assertion logic, timeout guard (against a fake driver), registry,
  golden helper, and PNG encoder.
- **Emulator integration tests:** run **locally** against VICE 3.10 behind
  `describe.skipIf(!hasVice())` (AR-H3/AC-13) — driver round-trips, the three strategies, the
  fixture, the gate program, and the RD-17 routine vectors. Skipped cleanly in CI (AR-27). The
  **compile-bearing** suites (gate `build()`, RD-17 `loadRuntimeModule`→ACME) additionally gate
  on `!hasAcme()` so a VICE-without-ACME environment skips rather than errors (PF-002).
- **DEF-2 regression:** a real gate build yields a non-empty `symbolMap` (skipIf-ACME, CI).

Tiers: **CI** = runs in GitHub Actions; **Local** = skipIf-VICE, proven green on VICE 3.10.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from RD-12 (§3–§6), the component specs (`03-XX-*.md`), and the
> Ambiguity Register (`00-ambiguity-register.md`). Immutable oracles: if one fails after
> implementation, the **implementation** is wrong. Emulator-tier expectations were pinned
> against **real ACME/VICE output** this session (PF-004), never imagined.

### Phase 0 — DEF-2 label fix

| #     | Input / Scenario                                                        | Expected Output / Behavior                                                                 | Source          | Tier |
|-------|-------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|-----------------|------|
| ST-01 | Real `build({platform:'c64',sourceFiles:['examples/gate/main.blend']})` | `symbolMap.size > 0`; contains `_main` and `__startup`                                      | AR-H7 / R28     | CI (skipIf-ACME) |
| ST-02 | Same build; inspect resolved addresses                                  | `_main` and `__startup` both resolve to defined addresses in the c64 load region (≥ `$0801`). **The exact live-pinned values (`_main`=$0819, `__startup`=$080d this build) move to a build-sensitive *impl* smoke check — NOT an immutable oracle, since any RD-07c/allocator change legitimately shifts `_main` (PF-003).** ST-01 carries the immutable DEF-2 regression contract | AR-H7 (live)    | CI (skipIf-ACME) |

### VICE protocol codec (`protocol.ts`)

| #     | Input / Scenario                                                    | Expected Output / Behavior                                                                            | Source        | Tier |
|-------|---------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|---------------|------|
| ST-03 | `encodeCommand(MEMORY_GET, 7, body)`                                | Bytes: `0x02 0x02`, `len` (u32 LE = body length), `0x07000000` (req id LE), `0x01`, then body        | RD §4.5 / AR-H14 | CI |
| ST-04 | `decodeResponses` on a full response frame                          | One `ResponseFrame` with correct `type`/`errorCode`/`requestId`/`body`; `consumed === frame length`  | AR-H14        | CI |
| ST-05 | `decodeResponses` on a **partial** frame (header only, body split)  | `frames === []`, `consumed === 0`; a second call with the remainder yields the frame                 | AR-H14        | CI |
| ST-06 | `decodeResponses` on **two** concatenated frames                    | Two frames returned; `consumed` = both frame lengths                                                  | AR-H14        | CI |
| ST-07 | `parseRegistersAvailable` on a fixture body                         | `Map` name→id including `A`/`X`/`Y`/`SP`/`PC` (names uppercase per VICE)                              | AR-H15        | CI |
| ST-08 | `parseMemoryGet` on a fixture body (`len` prefix + N data bytes)    | Returns exactly the N data bytes (length prefix stripped)                                             | RD §4.5       | CI |

### `ViceDriver` (`vice-driver.ts`)

| #     | Input / Scenario                                              | Expected Output / Behavior                                                        | Source      | Tier  |
|-------|--------------------------------------------------------------|-----------------------------------------------------------------------------------|-------------|-------|
| ST-09 | `launch()` headless on a free port, then `shutdown()`        | Resolves; a socket connects to `127.0.0.1:<port>`; process exits on shutdown       | R7/R8/AR-H8 | Local |
| ST-10 | `writeMemory(0xC000,[0x2A])` then `readMemory(0xC000,1)`     | Reads back `[0x2A]` (MEMORY_SET/GET round-trip)                                    | R14/R15     | Local |
| ST-11 | `setBreakpoint(_main)`, `resume()`, `readRegisters()`        | `resume()` → `"breakpoint"`; registers read (A/X/Y/SP/PC/flags populated)          | R12/R13/R15 | Local |
| ST-12 | `captureScreenshot()` after launch                           | Returns a `Buffer` whose first 8 bytes are the PNG signature; IHDR decodes         | R16/AR-H4   | Local |
| ST-13 | `readRegisters()` maps ids via `REGISTERS_AVAILABLE`         | `Registers` fields (`a`,`x`,`y`,`sp`,`pc`,`flags.*`) all present and numeric/bool  | AR-H15      | Local |

### Run strategies & assertions (`strategies.ts`, `assertions.ts`)

| #     | Input / Scenario                                                          | Expected Output / Behavior                                                    | Source        | Tier  |
|-------|---------------------------------------------------------------------------|-------------------------------------------------------------------------------|---------------|-------|
| ST-14 | `runUntilLabel` on a **fake driver** that never breaks, `timeout=50`      | Rejects with a `TimeoutError` naming the strategy, within ~50ms                | R23/AC-06     | CI    |
| ST-15 | `runUntilMemory`/`runFrames` on a fake driver that never satisfies        | Each rejects with a `TimeoutError` within the budget                          | R23/AC-06     | CI    |
| ST-16 | `assertRegister({a:42,…},'a',42)` / `('a',7)`                             | Pass on match; `AssertionError` (expected vs actual, hex) on mismatch          | R17/AC-07     | CI    |
| ST-17 | `assertMemory(driver, 0xD020, 5)` (numeric) via a fake driver             | Pass when the byte is 5; `AssertionError` otherwise                            | R17/AC-08     | CI    |
| ST-18 | `assertMemory(driver,'_main',0xA9,symbols)` (symbolic); unknown label     | Resolves via `symbols`; unknown label → throws listing available keys          | R19/AC-08     | CI    |
| ST-19 | `emulatorFor('c64')` / `emulatorFor('zx')`                                | `c64` → entry (`x64sc`); unknown → throws "no emulator registered…"            | R7a           | CI    |
| ST-20 | `runUntilMemory(driver, 0xD020, 5)` on the gate program (real VICE)       | Resolves once `$D020 === 5`                                                    | R22/AC-05     | Local |
| ST-21 | `runUntilLabel(driver, symbols, '_main')` on the gate program            | Resolves with `Registers` at the `_main` breakpoint                            | R20/AC-03     | Local |
| ST-22 | `runFrames(driver, 2)` on the gate program                                | Resolves without timeout. **AC-04 is verified at the "completes N batches within the guard" level; exact N-frame accuracy is approximate for the MVP (instructions-per-frame estimate — PF-004, see 03-03). If a cheap frame-linked observable exists (VIC-II raster / `DISPLAY_GET` delta), assert a frame advanced.** | R21/AC-04     | Local |

### Fixture, golden, package & runtime verification

| #     | Input / Scenario                                                              | Expected Output / Behavior                                                              | Source          | Tier  |
|-------|-------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|-----------------|-------|
| ST-23 | `setupEmulator({build,platform:'c64'})` (real VICE)                           | Returns `{driver, symbols}`; `symbols` from `build.symbolMap`; driver launched          | R25–R28/AC-11   | Local |
| ST-24 | `assertGolden(actual, path)` where the file equals `actual`                   | Passes                                                                                   | R30/AC-10       | CI    |
| ST-25 | `assertGolden(differing, path)`                                               | `AssertionError` with a diff excerpt (first divergence)                                  | R30/AC-10       | CI    |
| ST-26 | `assertGolden(actual, newPath)` with `UPDATE_GOLDEN=1`                        | Writes `actual` to `newPath` and passes; re-run without the env compares clean          | R31/AC-10/AR-H10| CI    |
| ST-27 | Import the package barrel                                                      | Exports exactly the documented public API; no internal `protocol`/socket symbols leak    | R34/AC-14       | CI    |
| ST-28 | `setupEmulator` given a bare `{binary,labelFile}` (no `BuildResult`)          | Parses the label file via `parseLabelFile`; works with a non-Blend65 PRG (AC-15)         | R28/R35/AC-15   | Local |
| ST-29 | **Gate**: gate `.prg` on VICE → `assertMemory(0xD020,5)` + symbolic `_main`   | `$D020 === 5`; `assertMemory('_main',0xA9,symbols)` passes (first opcode `LDA #$05`)     | AR-H9/AR-43     | Local |
| ST-30 | **RD-17** `__rt_mul8` edge + ~25 seeded vectors on VICE                       | product lo→A, hi→X match reference for every vector (Y preserved)                        | AR-P4/AR-H5     | Local |
| ST-31 | **RD-17** `__rt_div8` bounded vectors on VICE                                 | quotient→A, remainder→X match reference                                                  | AR-P4/AR-H5     | Local |
| ST-32 | **RD-17** `__rt_mul16` bounded vectors on VICE                                | product lo→A, hi→X match reference                                                       | AR-P4/AR-H5     | Local |
| ST-33 | **RD-17** `__rt_div16` bounded vectors on VICE                                | quotient→A/X, remainder→zp[2..3] match reference                                         | AR-P4/AR-H5     | Local |

> **⚠️ AUTHORING RULE:** Expectations are derived from RD-12, the VICE 3.7+ protocol spec,
> the runtime ABI in `runtime-asm.impl.test.ts`, and **live** ACME/VICE output pinned this
> session. Do NOT infer expectations from implementation code. Any newly-surfaced gap →
> Ambiguity Register, resolve with the user, then define the case.

## Test Categories

### Specification Tests (from ST-cases above)

| Test File                                                    | ST Cases Covered      | Component                | Tier |
|--------------------------------------------------------------|-----------------------|--------------------------|------|
| `packages/compiler/src/acme/vice-label.spec.test.ts`         | ST-01, ST-02          | DEF-2 fix                | CI (skipIf-ACME) |
| `packages/test-harness/src/emulator/vice/protocol.spec.test.ts` | ST-03..ST-08       | Protocol codec           | CI   |
| `packages/test-harness/src/emulator/vice/vice-driver.spec.test.ts` | ST-09..ST-13     | `ViceDriver`             | Local |
| `packages/test-harness/src/run/strategies.spec.test.ts`      | ST-14, ST-15, ST-20..22 | Run strategies         | Mixed |
| `packages/test-harness/src/run/assertions.spec.test.ts`      | ST-16, ST-17, ST-18   | Assertions               | CI   |
| `packages/test-harness/src/emulator/registry.spec.test.ts`   | ST-19                 | Registry (R7a)           | CI   |
| `packages/test-harness/src/fixture.spec.test.ts`             | ST-23, ST-28          | `setupEmulator`          | Mixed |
| `packages/test-harness/src/golden.spec.test.ts`              | ST-24, ST-25, ST-26   | `assertGolden`           | CI   |
| `packages/test-harness/src/index.spec.test.ts`               | ST-27                 | Public barrel            | CI   |
| `packages/test-harness/src/gate.spec.test.ts`                | ST-29                 | Gate program             | Local (VICE+ACME, PF-002) |
| `packages/test-harness/src/runtime-routines.spec.test.ts`    | ST-30..ST-33          | RD-17 AC-14 discharge     | Local (VICE+ACME, PF-002) |

### Implementation Tests (edge cases, internals)

| Test File                                                    | Description                                                             | Priority |
|--------------------------------------------------------------|-------------------------------------------------------------------------|----------|
| `packages/compiler/src/acme/invoke-acme.impl.test.ts` (edit) | argv now contains `--vicelabels`, not `-l`                              | High     |
| `packages/compiler/src/acme/vice-label.impl.test.ts` (new)   | Build-sensitive smoke: `_main`=$0819 / `__startup`=$080d for the current gate build (mutable — updated when codegen shifts; PF-003) | Low |
| `src/emulator/vice/protocol.impl.test.ts`                    | Body-layout edge cases, error-code frames, malformed-frame rejection    | High     |
| `src/emulator/vice/png.impl.test.ts`                         | Encode a synthetic indexed frame; verify signature/IHDR/IEND + CRCs      | Medium   |
| `src/run/strategies.impl.test.ts`                            | Timeout halts the emulator; custom per-call timeout (R24)                | High     |
| `src/golden.impl.test.ts`                                    | Diff-excerpt formatting; missing-file message; parent-dir creation       | Medium   |

### Integration Tests

| Test                         | Components                                | Description                                            |
|------------------------------|-------------------------------------------|-------------------------------------------------------|
| Gate build → VICE assert     | compiler `build` + fixture + strategies   | Full C5 loop on the MVP gate (ST-29)                  |
| RD-17 routine vectors        | codegen + ACME + driver + assertions      | Real-silicon math parity, bounded subset (ST-30..33)  |
| Golden `.asm` snapshot       | compiler `emitAsm` + `assertGolden`       | CI-only golden proof of the helper                    |

### End-to-End Tests

| Scenario            | Steps                                                                 | Expected Result                          |
|---------------------|-----------------------------------------------------------------------|------------------------------------------|
| MVP gate on c64     | compile gate → autostart in VICE → run until `$D020==5` → assert       | Passes locally on VICE 3.10 (AR-43/44)   |

## Test Data

### Fixtures Needed

- `examples/gate/main.blend` (exists) — the gate program.
- A committed `test/golden/gate.asm.golden` (created via `UPDATE_GOLDEN=1`) for the golden demo.
- A hand-authored minimal `.prg` + `.lbl` pair for the AC-15 any-binary test (ST-28).
- Byte fixtures for protocol codec tests (captured from live VICE, checked in as arrays).
- The RD-17 ABI/vector tables mirrored from `runtime-asm.impl.test.ts` (edge + seeded LCG).

### Mock Requirements

- A **fake `EmulatorDriver`** (in-memory) for the CI-tier strategy/assertion tests — a real
  object implementing the interface, not a mock framework (prefer real objects). VICE itself
  is the only true external and is exercised by the Local tier, never mocked.

## Verification Checklist

- [ ] All ST-* cases defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement / component spec / AR entry
- [ ] Spec tests written BEFORE implementation (per phase)
- [ ] Spec tests verified to FAIL before implementation (red phase)
- [ ] All spec tests pass after implementation (green phase) — CI tier in CI, Local tier on VICE
- [ ] Implementation tests written for edge cases and internals
- [ ] Emulator/RD-17 suites proven green locally on VICE 3.10 (AR-H3)
- [ ] No regressions in existing tests (esp. RD-09/RD-15 after the DEF-2 fix)
- [ ] Full workspace verify green
