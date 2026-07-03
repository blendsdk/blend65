# Execution Plan: RD-12 — Test Harness & Emulator Verification

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-03 18:52
> **Progress**: 6/44 tasks (14%)
> **CodeOps Skills Version**: 3.1.0

## Overview

Builds `@blend65/test-harness` — the three-tier testing framework and VICE emulator driver —
in four phases, opening with the Phase-0 DEF-2 fix so a populated `symbolMap` underpins every
later phase. Specification-first ordering per phase (spec tests → red → implement → green →
impl tests → verify). Emulator/RD-17 suites are `describe.skipIf(!hasVice())`: they skip in
CI (AR-27) and must be **run green locally on VICE 3.10** before the covered ACs are ticked
(AR-H3).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title                                              | Sessions | Est. Time  |
| ----- | -------------------------------------------------- | -------- | ---------- |
| 0     | DEF-2 VICE label fix (prerequisite)                | 1        | 30–45 min  |
| 1     | Emulator driver & VICE binary-monitor protocol     | 3        | 3–4 h      |
| 2     | Run strategies, assertions, registry & fixture     | 3        | 2.5–3.5 h  |
| 3     | Golden, publishable package & runtime verification | 3        | 2.5–3.5 h  |

**Total: 10 sessions, ~8.5–11.5 hours**

---

## Phase 0: DEF-2 VICE Label Fix (prerequisite)

### Session 0.1: Fix the empty-`symbolMap` defect

**Reference**: [03-01-def2-label-fix.md](03-01-def2-label-fix.md)
**Objective**: Real builds emit VICE-format labels so `parseLabelFile` populates `symbolMap`.

| #     | Task                                                                                             | File                                                        |
| ----- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 0.1.1 | Write the DEF-2 spec oracle (ST-01, ST-02): real gate build → non-empty `symbolMap` containing `_main`/`__startup` at defined load-region addresses (immutable oracle, skipIf-ACME). Exact live-pinned values (`_main`=$0819, `__startup`=$080d) go to a **build-sensitive impl smoke test** (`vice-label.impl.test.ts`), not the oracle (PF-003) | `packages/compiler/src/acme/vice-label.spec.test.ts` (new), `vice-label.impl.test.ts` (new) |
| 0.1.2 | Run the oracle — verify it FAILS (red: current build yields empty map)                            | —                                                          |
| 0.1.3 | Fix `acmeArgv`: `-l` → `--vicelabels`; correct the `labelPath` JSDoc + `label-file.ts` header comment | `packages/compiler/src/acme/invoke-acme.ts`, `label-file.ts` |
| 0.1.4 | Run the oracle — verify it PASSES (green)                                                          | —                                                          |
| 0.1.5 | Update the argv assertion (`-l` → `--vicelabels`, not `-l`)                                        | `packages/compiler/src/acme/invoke-acme.impl.test.ts`      |
| 0.1.6 | Full workspace verify — no RD-09/RD-15 regression (DEF-1 header + goldens intact)                  | —                                                          |

**Deliverables**:
- [x] `symbolMap` populated for real builds; DEF-2 regression oracle green
- [x] Full verification passing

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 1: Emulator Driver & VICE Binary-Monitor Protocol

### Session 1.1: Specification tests (BEFORE implementation)

**Reference**: [03-02-emulator-driver.md](03-02-emulator-driver.md)

| #     | Task                                                                                              | File                                                           |
| ----- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1.1.1 | Scaffold: add `@blend65/compiler` dep (runtime) + `@blend65/codegen` devDep (RD-17 vectors, PF-001); add `../compiler`+`../codegen` to `tsconfig.json` references (PF-001); create module dirs; declare the `EmulatorDriver` interface + `LaunchOptions`/`Registers`/`BreakReason` (RD §4.1 contract, incl. `break_`) | `packages/test-harness/package.json`, `packages/test-harness/tsconfig.json`, `src/emulator/driver.ts` |
| 1.1.2 | Write protocol-codec spec tests (ST-03..ST-08): frame encode/decode, partial/multi frames, body parsers | `src/emulator/vice/protocol.spec.test.ts` (new)               |
| 1.1.3 | Write `ViceDriver` integration spec tests (ST-09..ST-13), `describe.skipIf(!hasVice())`            | `src/emulator/vice/vice-driver.spec.test.ts` (new)            |
| 1.1.4 | Run — verify FAIL (red): codec tests fail in CI; driver tests fail locally (no impl yet)          | —                                                             |

### Session 1.2: Implementation

| #     | Task                                                                                              | File                                       |
| ----- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1.2.1 | Implement the pure protocol codec (`encodeCommand`/`decodeResponses` + body builders/parsers), validating body layouts live against VICE 3.10 | `src/emulator/vice/protocol.ts` (new)      |
| 1.2.2 | Implement `ViceDriver` (spawn `x64sc`, loopback socket, request/response correlation, `REGISTERS_AVAILABLE` id map, all `EmulatorDriver` methods) | `src/emulator/vice/vice-driver.ts` (new)   |
| 1.2.3 | Implement the zero-dep PNG encoder (`DISPLAY_GET`+`PALETTE_GET` → truecolor PNG via `zlib`)        | `src/emulator/vice/png.ts` (new)           |
| 1.2.4 | Run — verify PASS (green): codec in CI; driver + screenshot green **locally on VICE**              | —                                          |

### Session 1.3: Implementation tests & hardening

| #     | Task                                                                                              | File                                          |
| ----- | ------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1.3.1 | Impl tests: codec body-layout edges, error-code frames, malformed-frame rejection                 | `src/emulator/vice/protocol.impl.test.ts` (new) |
| 1.3.2 | Impl tests: PNG signature/IHDR/IEND + CRC verification on a synthetic frame                        | `src/emulator/vice/png.impl.test.ts` (new)    |
| 1.3.3 | Full verify (CI tiers) + local VICE run of the driver suite green                                 | —                                             |

**Deliverables**:
- [ ] `EmulatorDriver` + `ViceDriver` + codec + PNG complete; ST-03..ST-13 green
- [ ] Codec tests green in CI; driver tests green locally on VICE 3.10
- [ ] All verification passing

**Verify**: full workspace verify (above) + `yarn workspace @blend65/test-harness test` locally with VICE on PATH.

---

## Phase 2: Run Strategies, Assertions, Registry & Fixture

### Session 2.1: Specification tests (BEFORE implementation)

**Reference**: [03-03-run-strategies-fixture.md](03-03-run-strategies-fixture.md)

| #     | Task                                                                                              | File                                          |
| ----- | ------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 2.1.1 | Write strategy spec tests: timeout guard vs a **fake driver** (ST-14/15, CI) + integration (ST-20..22, skipIf-VICE) | `src/run/strategies.spec.test.ts` (new)       |
| 2.1.2 | Write assertion spec tests (ST-16/17/18): register, numeric + symbolic memory, unknown-label throw | `src/run/assertions.spec.test.ts` (new)       |
| 2.1.3 | Write registry spec test (ST-19): `emulatorFor('c64')` / unknown platform                          | `src/emulator/registry.spec.test.ts` (new)    |
| 2.1.4 | Write fixture spec tests (ST-23 local, ST-28 any-binary)                                           | `src/fixture.spec.test.ts` (new)              |
| 2.1.5 | Run — verify FAIL (red)                                                                            | —                                             |

### Session 2.2: Implementation

| #     | Task                                                                                              | File                                    |
| ----- | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 2.2.1 | Implement the three strategies + the shared mandatory `withTimeout` guard (R23/AC-06)              | `src/run/strategies.ts` (new)           |
| 2.2.2 | Implement `assertRegister` / `assertMemory` (numeric + symbolic via `symbolMap` keys)             | `src/run/assertions.ts` (new)           |
| 2.2.3 | Implement the R7a platform→emulator registry (c64→`x64sc`) + `emulatorFor`                         | `src/emulator/registry.ts` (new)        |
| 2.2.4 | Implement `setupEmulator` (BuildResult/binary paths, `parseLabelFile` fallback, relaunch-per-binary, `hasVice`) | `src/fixture.ts` (new)                  |
| 2.2.5 | Run — verify PASS (green): CI-tier green; integration + fixture green **locally on VICE**          | —                                       |

### Session 2.3: Implementation tests & hardening

| #     | Task                                                                                              | File                                   |
| ----- | ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 2.3.1 | Impl tests: timeout halts the emulator; per-call custom timeout (R24); assertion diff formatting   | `src/run/strategies.impl.test.ts` (new) |
| 2.3.2 | Full verify (CI tiers) + local VICE run of the integration suites green                            | —                                      |

**Deliverables**:
- [ ] Strategies (timeout-guarded), assertions, registry, fixture complete; ST-14..ST-23/28 green
- [ ] All verification passing (CI) + local VICE green

**Verify**: full workspace verify + local `@blend65/test-harness` run with VICE.

---

## Phase 3: Golden, Publishable Package & Runtime Verification

### Session 3.1: Specification tests (BEFORE implementation)

**Reference**: [03-04-golden-package-runtime.md](03-04-golden-package-runtime.md)

| #     | Task                                                                                              | File                                          |
| ----- | ------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 3.1.1 | Write `assertGolden` spec tests (ST-24/25/26): compare-pass, mismatch-diff, `UPDATE_GOLDEN` write | `src/golden.spec.test.ts` (new)               |
| 3.1.2 | Write public-barrel spec test (ST-27): exact public API, no internal leak (rewrite the stub test) | `src/index.spec.test.ts` (rewrite)            |
| 3.1.3 | Write the gate emulator spec test (ST-29, `skipIf(!hasVice() \|\| !hasAcme())` — build compiles via ACME, PF-002) | `src/gate.spec.test.ts` (new)                 |
| 3.1.4 | Write the RD-17 routine-vector spec tests (ST-30..ST-33, bounded subset, `skipIf(!hasVice() \|\| !hasAcme())` — routines assemble via ACME, PF-002) | `src/runtime-routines.spec.test.ts` (new)     |
| 3.1.5 | Run — verify FAIL (red)                                                                            | —                                             |

### Session 3.2: Implementation

| #     | Task                                                                                              | File                                    |
| ----- | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 3.2.1 | Implement `assertGolden` (byte-exact compare, diff excerpt, `UPDATE_GOLDEN` write mode)           | `src/golden.ts` (new)                   |
| 3.2.2 | Write the public barrel (stable API only; JSDoc on exports; no `protocol`/socket leak)            | `src/index.ts` (rewrite)                |
| 3.2.3 | Wire the gate emulator test + commit `test/golden/gate.asm.golden` (via `UPDATE_GOLDEN`)          | `src/gate.spec.test.ts`, `test/golden/` |
| 3.2.4 | Wire the RD-17 vectors (assemble `__rt_*`, in-session inject per vector, assert vs reference math) | `src/runtime-routines.spec.test.ts`     |
| 3.2.5 | Run — verify PASS (green): CI tiers green; gate + RD-17 vectors green **locally on VICE**          | —                                       |

### Session 3.3: Implementation tests, hardening, acceptance & bookkeeping

| #     | Task                                                                                              | File                                             |
| ----- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 3.3.1 | Impl tests: golden diff/missing-file/parent-dir edges                                              | `src/golden.impl.test.ts` (new)                  |
| 3.3.2 | Update the CLAUDE.md package dependency table (test-harness → `core, compiler`, + `codegen` dev-only) (AR-H17/PF-001) | `CLAUDE.md`                                       |
| 3.3.3 | Acceptance audit: tick AC-01..16 with ST evidence; tick RD-17 inherited AC-14 in the RD-17 plan/roadmap | RD-12/RD-17 docs, this plan                  |
| 3.3.4 | Update the feature roadmap (RD-12 → COMPLETE) + portfolio rollup                                   | `codeops/features/blend65-ri/00-roadmap.md`, `codeops/00-roadmap.md` |
| 3.3.5 | Full workspace verify + local VICE run of ALL emulator/RD-17 suites green                          | —                                                |

**Deliverables**:
- [ ] `assertGolden` + publishable barrel + gate test + RD-17 vectors complete; ST-24..ST-33 green
- [ ] CLAUDE.md dep table + roadmap updated; RD-17 AC-14 ticked
- [ ] Full verification passing; emulator suites proven green locally on VICE 3.10

**Verify**: full workspace verify + local `@blend65/test-harness` run with VICE (all suites).

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** update immediately after EACH task — mark `[x]` with a timestamp,
> bump the Progress header, never batch. Reconstruct this list from the phase tables if missing.

### Phase 0: DEF-2 VICE Label Fix
- [x] 0.1.1 Write DEF-2 spec oracle (ST-01/ST-02) — 2026-07-03 18:48
- [x] 0.1.2 Run — verify FAIL (red: empty map) — 2026-07-03 18:48
- [x] 0.1.3 Fix `-l` → `--vicelabels` + correct JSDoc/comments — 2026-07-03 18:49
- [x] 0.1.4 Run — verify PASS (green) — 2026-07-03 18:50
- [x] 0.1.5 Update `invoke-acme.impl.test.ts` argv assertion — 2026-07-03 18:50
- [x] 0.1.6 Full workspace verify (no RD-09/RD-15 regression) — 2026-07-03 18:52

### Phase 1: Emulator Driver & VICE Protocol
- [ ] 1.1.1 Scaffold (compiler dep + codegen devDep + tsconfig refs, PF-001) + `EmulatorDriver` interface & types
- [ ] 1.1.2 Protocol-codec spec tests (ST-03..08)
- [ ] 1.1.3 `ViceDriver` integration spec tests (ST-09..13, skipIf-VICE)
- [ ] 1.1.4 Run — verify FAIL (red)
- [ ] 1.2.1 Implement protocol codec
- [ ] 1.2.2 Implement `ViceDriver`
- [ ] 1.2.3 Implement zero-dep PNG encoder
- [ ] 1.2.4 Run — verify PASS (green; driver green locally on VICE)
- [ ] 1.3.1 Codec impl tests
- [ ] 1.3.2 PNG impl tests
- [ ] 1.3.3 Full verify + local VICE driver suite green

### Phase 2: Run Strategies, Assertions, Registry & Fixture
- [ ] 2.1.1 Strategy spec tests (timeout guard CI + integration skipIf-VICE)
- [ ] 2.1.2 Assertion spec tests (ST-16/17/18)
- [ ] 2.1.3 Registry spec test (ST-19)
- [ ] 2.1.4 Fixture spec tests (ST-23/28)
- [ ] 2.1.5 Run — verify FAIL (red)
- [ ] 2.2.1 Implement strategies + mandatory timeout guard
- [ ] 2.2.2 Implement assertions (numeric + symbolic)
- [ ] 2.2.3 Implement R7a registry
- [ ] 2.2.4 Implement `setupEmulator` + `hasVice`
- [ ] 2.2.5 Run — verify PASS (green; integration green locally)
- [ ] 2.3.1 Strategy/assertion impl tests
- [ ] 2.3.2 Full verify + local VICE integration green

### Phase 3: Golden, Package & Runtime Verification
- [ ] 3.1.1 `assertGolden` spec tests (ST-24/25/26)
- [ ] 3.1.2 Public-barrel spec test (ST-27)
- [ ] 3.1.3 Gate emulator spec test (ST-29, skipIf VICE+ACME, PF-002)
- [ ] 3.1.4 RD-17 routine-vector spec tests (ST-30..33, skipIf VICE+ACME, PF-002)
- [ ] 3.1.5 Run — verify FAIL (red)
- [ ] 3.2.1 Implement `assertGolden`
- [ ] 3.2.2 Public barrel (stable API, no leak)
- [ ] 3.2.3 Wire gate test + commit `gate.asm.golden`
- [ ] 3.2.4 Wire RD-17 vectors (in-session injection)
- [ ] 3.2.5 Run — verify PASS (green; gate + RD-17 green locally)
- [ ] 3.3.1 Golden impl tests
- [ ] 3.3.2 Update CLAUDE.md dep table (AR-H17)
- [ ] 3.3.3 Acceptance audit + tick RD-17 inherited AC-14
- [ ] 3.3.4 Update feature + portfolio roadmap
- [ ] 3.3.5 Full verify + local VICE ALL suites green

---

## Dependencies

```
Phase 0 (DEF-2 fix — populated symbolMap)
    ↓
Phase 1 (driver + codec + PNG)
    ↓
Phase 2 (strategies + assertions + registry + fixture)
    ↓
Phase 3 (golden + package + gate + RD-17 vectors + acceptance)
```

Phase 0 is a hard prerequisite: Phases 2–3 depend on a populated `symbolMap`. Within a
phase, the three sessions are strictly ordered (spec → implement → impl tests).

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed (44/44 tasks)
2. ✅ All verification passing (full workspace verify)
3. ✅ No warnings/errors; CI green (codec/assertion/golden tiers run for real)
4. ✅ Emulator + RD-17 suites proven **green locally on VICE 3.10** (AR-H3); skip cleanly in CI (AC-13)
5. ✅ No dead code — no unused params/functions/modules
6. ✅ Security hardened — loopback-only monitor bind, argv-array spawn, opt-in golden writes (`01-requirements.md`)
7. ✅ Documentation updated — JSDoc on all exports; CLAUDE.md dep table; roadmap
8. ✅ AC-01..16 ticked with ST evidence; RD-17 inherited AC-14 discharged; DEF-2 closed
9. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
