# Testing Strategy: RD-17 — Intrinsic Functions & Runtime-Routine ABI

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Spec tier: every RD-17 AC verifiable in this plan (all except AC-14, deferred to RD-12 per AR-P4) has ≥1 ST case.
- Impl tier: edge cases per component (below).
- E2E: AC-19 via the RD-09 golden-assemble pattern (skip-if-no-ACME).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from RD-17 (post-preflight), frozen spec Ch 12, RD-04's rule rows,
> and the Ambiguity Register. **IMMUTABLE ORACLE RULE:** if implementation disagrees with
> an ST case, the implementation is wrong. Every case carries a source reference.

### Core registry & catalog (03-01)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `createIntrinsicRegistry()`; `get('peek')` | Descriptor: T2, `(addr: word): byte`, `'inline'`, cost 4 cyc/3 bytes | RD-17 §4.3, AC-01 |
| ST-2 | `register()` a descriptor named `peek` again | Throws `Error` | AR-P9 |
| ST-3 | `isReserved('poke')` / `isReserved('__rt_mul8')` / `isReserved('myFn')` | `true` / `false` / `false` | RD-17 §4.3 internal table, R20 |
| ST-4 | `getAvailable(c64Profile)` vs `getAvailable(cx16Profile)` | `asm_wai` absent on c64 (nmos6502), present on cx16 (wdc65c02) | R24, AC-04 |
| ST-5 | Catalog name set | Exactly the 22 Ch 12 names + `asm_wai` (user-visible); exactly `__rt_mul8/__rt_mul16/__rt_div8/__rt_div16` internal | RD-17 §4.3, AC-01, AR-98 |
| ST-6 | `validateProfile()` on a profile with `zpArgBlockSize: 3` | Validation error naming the ≥4 floor | R34, AC-12 |
| ST-7 | `RESERVED_BUILTINS` / `W65C02_OPCODES` | Contains `asm_wai` (size 23) / contains `WAI` | RD-17 R2 |

### Semantic validation (03-02)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-8 | `asm_sei(5);` | E10040 (args to parameterless intrinsic) | RD-04 R59, AC-02 |
| ST-9 | `poke($D020);` | E10041 (wrong arg count) | RD-04 R59, AC-02 |
| ST-10 | `poke($D020, 300);` (byte param, literal 300) | E10171 (literal out of byte range) | AR-P6, RD-04 R59 |
| ST-11 | `asm_wai();` targeting c64 | E10043, message names required CPU and actual target (AR-P11 format) | R22/R23, AC-04 |
| ST-12 | `function peek(): void {}` | E10101 (shadows reserved intrinsic) | R20/R21, AC-03 |
| ST-13 | `offsetof(Sprite, nosuch)` (Sprite declared) | E10171 naming the missing field | Ch 12 §3.3, 03-02 V7 |
| ST-14 | Function body with `asm_sed();` and no `asm_cld();` | W10120 | R40, AR-P12 |
| ST-15 | Fixture T4 `fix_probe();` on c64, **no import** | E10046 `"'fix_probe' requires 'import { fix_probe } from c64;'"` | AR-P14, AC-05 |
| ST-16 | Fixture T4 `fix_probe();` targeting a7800 (with or without import) | E10043 (wrong platform) | AR-P14 (R25), AC-06 |
| ST-17 | The AR-43 gate program (`poke($D020, 5)` in `main`) | Zero diagnostics | AC-02 clean path |

### IL lowering & T1/T2 emission (03-03)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-18 | Each of the 13 T1 names (+`asm_wai` on cx16) through translate | Exactly ONE `Instr` with the matching opcode, Implied mode | AC-07, R2 |
| ST-19 | `poke($D020, 5)` / `peek($D021)` | Inline `store`/`load` → `STA`/`LDA abs`; NO `JSR` in output | AC-08, AR-49 |
| ST-20 | `pokew($0314, $1234)` | Two byte stores: `$34`→`$0314`, `$12`→`$0315` (little-endian) | Ch 12 §3.1 |
| ST-21 | `sizeof(Sprite)` (struct: `x: byte, y: byte, addr: word`) | Folds to `Immediate 4`; zero runtime instructions emitted for the fold | AC-09, AR-P13 |
| ST-22 | `length(arr)` for `arr: byte[300]` | Folds to 300 with result type `word` (≤255 → `byte`) | Ch 12 §3.3, PF-005 |
| ST-23 | `poke(v, 5)` where `v` is a variable | E10045 (AR-P11 message); NO ICE; compilation continues | R39, AR-P5, AR-101 |

### T3 runtime & marshalling (03-04)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-24 | `let r: word = a * b;` (bytes) | `LDA <a>` / `LDX <b>` / `JSR __rt_mul8` / result bound A(lo)/X(hi) | AC-10, AR-33 |
| ST-25 | `let q: word = a / b;` (words) | `a`→A/X; `b` bytes stored to `__rt_arg0`/`__rt_arg1`; `JSR __rt_div16` | AR-P7, AR-98 |
| ST-26 | `let m: byte = a % b;` (bytes) | `JSR __rt_div8` then remainder (X) bound as result; NO `__rt_mod8` symbol anywhere | AR-98 |
| ST-27 | Fixture T3 descriptor needing 6 ZP bytes, profile `zpArgBlockSize: 4` | E10044 (AR-P11 message), statement poisoned | R35, AC-13 |
| ST-28 | Program using `*` (bytes) → `serializeToAcme` | Output contains the `mul8.asm` body exactly once, in the runtime section; assembles | R15, AR-100 |
| ST-29 | Gate program (no `*`/`/`/`%`) → `serializeToAcme` | NO runtime section; byte-identical to pre-RD-17 golden | R16, AC-11 |
| ST-30 | Each `runtime/*.asm` file through ACME standalone (skip-if-no-ACME) | Assembles with zero errors | RD-17 §4.6, AR-P4 |

### T4 mechanism (03-05)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-31 | `createIntrinsicRegistry(fixturePlugin.intrinsics)` | `get('fix_probe')` returns the T4 descriptor | R11, AC-16, AC-15 |
| ST-32 | `import { fix_probe } from c64;` + `fix_probe();` (full pipeline) | Compiles: `JSR` to the fixture symbol + fixture `.asm` embedded | R19 (AR-97), AC-05 clean path |

### End-to-end (compiler)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-33 | Program with byte `*`, word `/`, byte `%` → full assemble via ACME (skip-if-no-ACME) | Binary produced; zero unresolved symbols | AC-19 |

> **⚠️ AUTHORING RULE:** expectations above come from RD-17/Ch 12/the register — never
> from implementation reading. Any underivable expectation = new AR-PN first.

## Test Categories

### Specification Tests (written BEFORE implementation, red-phase verified)

| Test File | ST Cases | Component |
|-----------|----------|-----------|
| `core/src/intrinsics/registry.spec.test.ts` | ST-1..ST-4 | 03-01 |
| `core/src/intrinsics/catalog.spec.test.ts` | ST-5, ST-7 | 03-01 |
| `core/src/platform/validate-profile.spec.test.ts` (extend) | ST-6 | 03-01 |
| `frontend/src/semantics/intrinsic-validation.spec.test.ts` | ST-8..ST-14, ST-17 | 03-02 |
| `frontend/src/semantics/intrinsic-validation.t4.spec.test.ts` | ST-15, ST-16 | 03-02/03-05 |
| `codegen/src/instr/translate-t1.spec.test.ts` | ST-18 | 03-03 |
| `codegen/src/il/lower-intrinsics.spec.test.ts` | ST-19..ST-23 | 03-03 |
| `codegen/src/instr/marshalling.spec.test.ts` | ST-24..ST-27 | 03-04 |
| `codegen/src/runtime/embed.spec.test.ts` | ST-28, ST-29 | 03-04 |
| `compiler/src/runtime-asm.spec.test.ts` | ST-30 | 03-04 |
| `platforms/src/t4-contribution.spec.test.ts` | ST-31, ST-32 | 03-05 |
| `compiler/src/assemble-rt.golden.spec.test.ts` | ST-33 | 03-04/06 |

### Implementation Tests (AFTER implementation)

| Test File | Description | Priority |
|-----------|-------------|----------|
| `core/src/intrinsics/registry.impl.test.ts` | `getAvailable` across all 5 real profiles; TypeRef shapes | High |
| `frontend/src/semantics/intrinsic-validation.impl.test.ts` | Multi-module imports; enum/struct table edges; no-throw fuzz | High |
| `codegen/src/il/lower-intrinsics.impl.test.ts` | Poison-statement recovery; descriptor-map completeness sweep | High |
| `codegen/src/runtime/embed.impl.test.ts` | Post-peephole symbol collection; path-traversal guard | High |
| `platforms/src/t4-contribution.impl.test.ts` | Id-stamped availability wrapper; `[]` plugins unaffected | Med |

### Integration / E2E
ST-32 (pipeline through analyze→lower→translate→serialize) and ST-33 (through ACME to
binary) are the integration/E2E tier; both build on RD-09's `assemble.golden` pattern.

## Test Data

### Fixtures
- Fixture plugin with one T4 descriptor + tiny `.asm` (03-05; test-only).
- Fixture T3 descriptor with `zpBytes: 6` for ST-27.
- Shrunken fixture profile (`zpArgBlockSize: 4`) for ST-27; invalid profile (`3`) for ST-6.
- `Sprite` struct source (`x: byte, y: byte, addr: word` → byteSize 4) for ST-13/21.

### Mocks
None — real registry, real parser/analyzer, real serializer; ACME tests skip when the
binary is absent (existing RD-09 pattern).

## Verification Checklist
- [ ] All ST cases defined with concrete input/output pairs
- [ ] Every ST traces to an RD-17 R/AC, Ch 12 section, or AR entry
- [ ] Spec tests written BEFORE implementation and verified to FAIL (red)
- [ ] All spec tests pass after implementation (green)
- [ ] Impl tests cover edges/internals per component
- [ ] Full verify passes; zero regressions (incl. RD-09 goldens — ST-29 guards this)
- [ ] AC-14 deferral to RD-12 documented (AR-P4)
