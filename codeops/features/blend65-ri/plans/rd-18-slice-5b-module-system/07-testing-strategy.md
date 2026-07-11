# Testing Strategy: RD-18 Slice 5b — Module System Completion

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

| Code type | Target |
|-----------|--------|
| Frontend semantics (merging, qualified, init order, const-eval) | 90% |
| Codegen (init lowering, `__init` stream, shim wiring) | 90% |
| Harness/fixture glue | 60% |

Conventions: `*.spec.test.ts` (immutable oracle, spec-first), `*.impl.test.ts`
(internals, after green). In-code traceability comments quote behavior in plain
language only (never ST/AR ids or plan paths).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from the frozen spec (Ch 03/10/14), RD-04/RD-18, and the
> Ambiguity Register. IMMUTABLE ORACLE: a failing spec test means the implementation
> is wrong, never the test.

### Merging & qualified access

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | Two files both `module Math;` — file 1 `export function f(): byte`, file 2 `export function g(): byte` calling bare `f()`; Main imports and calls both | NO diagnostics (no E90001); ONE Math module scope; both calls typed byte | AR-9 / spec 10-modules.md:42 |
| ST-2 | Two files both `module M;`, BOTH declare `export function f(): byte` | E10003 on the second declaration | AR-9 / R20 / spec 10-modules.md:253 |
| ST-3 | Main (no import), inside a function body: `let r: byte = Math.add(1, 2);` — Math exports `add(a,b): byte` | typed byte; call edge Main.main→Math.add + callSiteSpan recorded | AR-1 / spec 10-modules.md:135-144 |
| ST-4 | `Math.helper()` — `helper` exists, NOT exported | E10012: `'helper' is not exported from module 'Math'` | AR-3 |
| ST-5 | `Nope.fn()` — `Nope` is no value and no module | E10100 on `Nope` (head span) | AR-3 / spec 14-diagnostics.md:70 |
| ST-6 | function-local `let Math: byte = 1;` then `Math.add(1, 2)` (module Math also exists) | NO E10100/E10012/E10003; expression poisons silently; NO call edge | AR-2 |
| ST-7 | inside a function body: `let x: byte = Math.scaled;` — `scaled` an exported module `let: byte` | typed byte; `symbolMap` holds the SAME Symbol Math's scope declares | AR-1 |
| ST-8 | `Math.base = $0103;` — `base` an exported module `let: word` | accepted; strict same-type + range checks run (word literal OK) | AR-1 / I-3 |
| ST-9 | `Math.SCALE = 5;` — `SCALE` an exported `const` | E10191 AssignToConst | AR-1 |
| ST-10 | inside a function body: `let x: byte = Math.add;` — function member in value position | ICE E90001, message names function references as not supported yet | AR-13 |
| ST-11 | Main.f calls imported Math.g; Math.g calls `Main.f()` QUALIFIED | ONE E10174 with full cycle path (both edge kinds feed one graph) | AR-1 rider / 5a AR-7 precedent |

### Initializers, consts & init order

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-12 | Same module: `let a: byte = b + 1;` THEN `let b: byte = 2;` | no diagnostics; `model.initOrder` = [b, a] | AR-5 / spec 10-modules.md:199-200 |
| ST-13 | Main declared FIRST in sourceFiles, imports Math; Main.`combo` init reads `Math.scaled` (qualified) | initOrder = [Math vars…, Main.combo] — Math first via the import edge despite later discovery | AR-5 (two-level) / spec 10-modules.md:201 |
| ST-14 | `let a: byte = b + 1; let b: byte = a + 1;` | exactly ONE E10194; message = spec text anchored `'a'` + ` — cycle: a → b → a`; hasErrors true | AR-6 / spec 14-diagnostics.md:141 |
| ST-15 | `let x: byte = f();` at module level (f any function) | ICE E90001: call-bearing module initializers not supported yet | AR-4 / I-1 |
| ST-15b | `let x: byte = peek($D012);` at module level | ICE E90001, same message — builtin intrinsic calls (all `IntrinsicCallExpr` except `lo`/`hi`) are call-bearing | AR-4 (intrinsic arm; `lo`/`hi` carve-out) |
| ST-16 | `const K: byte = 3; let x: byte = K + 1;` | `constValues[K] = 3`; K contributes NO init edge; initOrder = [x] | AR-7 / spec 10-modules.md:202 |
| ST-17 | `const B: byte = v;` where `v` is a module `let` | E10193: `Initializer for const 'B' is not a compile-time constant expression` | AR-7 / spec 14-diagnostics.md:140 |
| ST-18 | `const A: byte = B; const B: byte = A;` | ONE E10194 (same one-per-cycle + path shape) | AR-6 / AR-7 |
| ST-19 | `const B: byte = A + 1; const A: byte = 2;` (reverse decl order) | no diagnostics; `constValues[B] = 3` | AR-7 / spec VAR-6 (03-variables.md:122-129) |
| ST-20 | module-level `let x: byte = true;` | E10152 (same code the identical function-local `let` emits) | AR-4 parity / I-3 / 3b code realignment |
| ST-21 | module-level `let x: byte = 300;` | E10084 (const out of range) | AR-4 parity / 5a checkConstRange |

### Init codegen

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-22 | `lowerToIL` on module `Main { let g: byte = 7; function main …poke($C000, g)… }` — and on an initializer-FREE program | initCode non-empty: `store imm 7 → __var_Main_g`, ret-terminated, `initTempCount` set; initializer-free → `initCode: []`, `initTempCount: 0` | AR-8 / 03-03 §1 |
| ST-23 | `emitAsm` text, program WITH initializers vs WITHOUT | with: `__init:` stream serialized FIRST + `JSR __init` between banking and `JSR _main`; without: NO `__init`/`JSR __init` anywhere | AR-8 / spec 10-modules.md:197-199 (before-main; the shipped `JSR _main` shim is the pre-existing deviation from §5.3's fall-through) |
| ST-24 | `let w: word = $0102;` | `__init` contains `LDA #$02` / `LDX #$01` / `STA __var_Main_w` / `STX __var_Main_w+1` | AR-8 / 03-03 §2 |
| ST-25 | module `const K: byte = 3;` + `poke($C000, K)` in main | emitAsm contains `LDA #$03`; contains NEITHER `__frame_Main_main_K` NOR `__var_Main_K` | AR-7 (closes the verified hole) |

### Acceptance (3-part bar + negatives)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-26 | slice5b fixture golden | byte-exact vs `test/golden/slice5b.asm.golden` (minted once) | AR-10 |
| ST-27 | fixture `build()` with real ACME | no errors; loadable PRG bytes; ASM contains `__init:`, `JSR __init`, `__var_Math_base`/`__var_Math_scaled`/`__var_Main_combo`, NO `__var_Math_SCALE` | AR-10 / AR-7 |
| ST-28 | fixture on real VICE 3.10 | `$C000=$05, $C001=$08, $C002=$07, $C003=$02, $C004=$01, $C005=$03, $C006=$01` (03-04 derivations) | AR-10 |
| ST-29 | all six existing goldens (gate + the five slice goldens) + both compiler assemble goldens | byte-exact, NO re-mint (existing suites stay green) | AR-8 |
| ST-30 | negatives N1–N6 through the public facade (compile-only) | E10194+path / E10012 / E10100 / ICE / E10003 / E10193 per 03-04 §2 | AR-10 |

> **⚠️ AUTHORING RULE:** expectations above come from the frozen spec + register.
> ST-20's code (E10152) is deliberately pinned to LOCAL-let parity — if the RED phase
> shows the local path emits a different assignment-family code for `byte = true`,
> that is a planning-data error to correct in THIS table before implementation
> (never after).

## Test Categories

### Specification tests (files)

| Test File | ST Cases | Component |
|-----------|----------|-----------|
| `packages/frontend/src/semantics/module-merging.spec.test.ts` | ST-1, ST-2 | 03-01 §1 |
| `packages/frontend/src/semantics/type-check/qualified-access.spec.test.ts` | ST-3…ST-11 | 03-01 §2-3 |
| `packages/frontend/src/semantics/module-init-typing.spec.test.ts` | ST-15/ST-15b…ST-17, ST-19…ST-21 | 03-02 §1-2 |
| `packages/frontend/src/semantics/init-order.spec.test.ts` | ST-12…ST-14, ST-18 | 03-02 §4 |
| `packages/codegen/src/il/lower-init.spec.test.ts` | ST-22 | 03-03 §1 |
| `packages/compiler/src/api/emit-init.spec.test.ts` | ST-23…ST-25 | 03-03 §2-3 |
| `packages/test-harness/src/golden-slice5b.spec.test.ts` | ST-26 | 03-04 |
| `packages/test-harness/src/slice5b.spec.test.ts` | ST-27, ST-28 | 03-04 |
| `packages/test-harness/src/slice5b-negatives.spec.test.ts` | ST-30 | 03-04 §2 |
| (existing golden suites, unmodified) | ST-29 | 03-03 §4 |

### Implementation tests (after green)

| Test File | Coverage | Priority |
|-----------|----------|----------|
| `module-merging.impl.test.ts` | representative scope.node, insertion-order ordinals, 3-file merge, self-import via second file | High |
| `qualified-access.impl.test.ts` | platform-id head → E10100, self-module non-exported → E10012, import-of-variable (same-Symbol aliasing AND exactly ONE `ModuleVarInput` under the home module — no phantom `__var_*` slot), `a.b.c` chain stays silent, `Math.add = 5` → ICE | High |
| `module-init.impl.test.ts` | const-of-const chains + `lo`/`hi` over consts, importEdges recording, cycle-member poison, initializer-less var = non-edge, mixed byte/word orders | High |
| `lower-init.impl.test.ts` / `instr init` additions | initTempCount propagation, printIL `__init` section, moduleInit-context ICE guard, per-plugin `hasInitCode` pass-through | Med |

### Superseded tests (removed/reframed with justification in-commit)

- `call-semantics.impl.test.ts:102-114` (dup-module ICE) → replaced by ST-1/ST-2.
- `lower.spec.test.ts:127` (`initCode` always empty) → narrowed to initializer-free.

## Test Data / Fixtures

`examples/slice5b/{main,math,math2}.blend` + inlined copies in
`testing/slice5b.ts` (03-04 owns the exact sources and expected values). No mocks —
real analyze/lower/translate/ACME/VICE throughout; VICE/ACME tiers `describe.skipIf`
gated as in slice5a.

## Verification Checklist

- [ ] All ST cases have concrete input→output pairs traced to spec/RD/AR
- [ ] Spec tests written BEFORE implementation, verified RED, then GREEN
- [ ] Impl tests after green; superseded tests removed with justification
- [ ] Full verify green: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`
- [ ] ST-29 prior-golden byte-exactness holds with NO re-mint
- [ ] `git status --porcelain spec/` empty (D3)
