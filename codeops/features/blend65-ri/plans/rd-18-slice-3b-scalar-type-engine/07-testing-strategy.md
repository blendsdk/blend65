# Testing Strategy: RD-18 Slice 3b — Scalar Type Engine

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Principles

- **Specification-first / immutable oracle.** Every ST-* expectation derives from the **frozen spec**
  (Ch 02 type system, Ch 03 variables, Ch 06 functions) or a resolved AR — never from reading the
  implementation. A failing spec test after implementation means the **implementation** is wrong.
- **Spec vs impl files.** `*.spec.test.ts` = spec tier (below); `*.impl.test.ts` = internals/edge cases.
- **Never-throw / diagnostic tests are security tests** (malformed input → clean diagnostic, no crash,
  no wrong binary).
- **Verify command:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`.

## Specification Test Cases

### Tier A — Type engine (frontend, Phase 1)

| ST | Input (`.blend` fragment) | Expected | Oracle |
|----|---------------------------|----------|--------|
| **ST-1** | `let a: byte = 5;` / `let w: word = 300;` / `let s: sbyte = -1;` | `typeMap`/symbol types: `byte`, `word`, `sbyte` per TS-2 default+adaptation | spec 02 TS-2 |
| **ST-2** | `let b: byte = 256;` | **E10084** (out of range for byte) | spec 02:96 |
| **ST-3** | `let r: byte = a + b;` (a,b:byte); `let rw: word = x + y;` (x,y:word) | `typeMap[a+b]==byte`, `[x+y]==word` (same-type TS-3) | spec 02 TS-3 |
| **ST-4** | `let r: byte = a + s;` (a:byte, s:sbyte) | **E10081** (mixed signedness) + poison; **no throw** | spec 02 TS-5, §5.1 · **AC-2/AC-4** |
| **ST-5** | `let r: byte = a + f;` (a:byte, f:boolean) | **E10080** (boolean not numeric — InvalidOperandType; ledger R34, AR-11. *NOT* E10151 = `UnknownType`) | Ch 14 / ledger R34 |
| **ST-6** | `accB = undefinedName;` | **E10100** (undeclared) + poison | RD-04 R16/R61 |
| **ST-7** | `let x = 5;` (no annotation) | **E10150** (type annotation required) | spec 02 TS-1 |
| **ST-8** | `let b: byte = w;` (w:word) → **E10154** (narrowing); `let b: byte = s;` (s:sbyte) → **E10153** (cross-sign) | assignment-compat codes (Ch 14 / ledger R32/R33 — AR-11; stale spec §5.3 said E10082/E10080) | Ch 14 §14 |
| **ST-9** | `let r: byte = undef + b;` | **exactly one** diagnostic (E10100), no cascade from the poisoned `+` | RD-04 R114 / AC-13 |
| **ST-10** | program with **no** `main` → **E10020**; program with **two** `main` → **E10021** | Pass-4 checks | RD-04 R66 |

### Tier B — Module-level scalars (frontend + SFA, Phase 2)

| ST | Input | Expected | Oracle |
|----|-------|----------|--------|
| **ST-11** | `module Main; let g: byte; function main():void{ g = 1; }` | `g` is a `variable` symbol in the **module** scope; `modelToModuleVars(model)` returns `[{moduleName:"Main", variableName:"g", type:byte, size:1}]` | FR-4/AR-9 |
| **ST-12** | duplicate top-level `let g: byte; let g: word;` | **E10003** (duplicate decl) | RD-04 R9/R20 |

### Tier C — Width-aware lowering (codegen, Phase 3)

| ST | Input | Expected | Oracle |
|----|-------|----------|--------|
| **ST-13** | word literal `300` in a typed model | `lowerNumericLit` → `imm(300, IL_WORD)` (not `IL_BYTE`) | FR-7/AR-8 |
| **ST-14** | `accW = x * y;` (word) | binary result IL type = `IL_WORD` → translate emits `JSR __rt_mul16` | FR-7 |
| **ST-15** | module-var read/write `g = 1; poke($C000, g)` | `store … __var_Main_g` / `load __var_Main_g` | FR-7 |

### Tier D — Acceptance (test-harness, Phase 4)

| ST | Tier | Expected | Oracle |
|----|------|----------|--------|
| **ST-16** | Assemble-clean (CI, `skipIf(!hasAcme)`) | `examples/slice3b/main.blend` → loadable PRG, zero undefined symbols; ASM contains `__var_Main_accB`, `__var_Main_accW` | FR-8/AC-1 |
| **ST-17** | Golden (CI) | `--emit-asm` matches `test/golden/slice3b.asm.golden` (has `__rt_mul8`, `__rt_mul16`) | FR-8/AC-2 |
| **ST-18** | VICE (local, `skipIf(!(hasVice&&hasAcme))`) | `$C000==$11` (17), `$C001==$58`, `$C002==$02` (600) | FR-8/AC-3 |
| **ST-19** | Mixed-sign negative (CI, frontend) | `byte + sbyte` program → **E10081**, `hasErrors`, no binary, no throw | FR-2/AC-4 |
| **ST-20** | Gate/Slice-3a golden re-check | unchanged (or re-minted only if width-threading re-proves byte output on VICE) | AR-8 pattern |

## Red/green expectations

- **Phase 1 red:** ST-1..ST-10 fail (no typing / stubs / no-op Pass 4). **Green** after the type engine.
- **Phase 2 red:** ST-11/ST-12 fail (no module-var collection/projection). **Green** after collection+projection.
- **Phase 3 red:** ST-13..ST-15 fail (literals byte-locked, no module-var lowering). **Green** after threading.
- **Phase 4 red:** ST-16 fails first on the *missing golden* (ST-17) and, until Phases 1–3 land, on
  assemble; **green** once the fixture compiles + golden minted; ST-18 proven on VICE; ST-19 green as
  soon as Phase 1's E10081 lands.

## Security / robustness tests (mandatory)

- **Never-throw:** ST-4/ST-5/ST-6/ST-7/ST-8/ST-19 each assert the analyzer **returns** with a
  diagnostic and does **not** throw; no `E9xxxx` ICE for user input.
- **Bounded const-eval:** a const `x / 0` → **E10082** (not a JS divide/throw).
- **No wrong binary:** an errored program (`hasErrors`) never reaches ACME / never emits a PRG.
