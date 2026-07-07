# 07 — Testing Strategy

> Specification test cases (ST-*), spec-first ordering, verification. Expectations derive from spec
> Ch 05 + the requirements + the Ambiguity Register — never from the implementation (immutable oracle).
> **CodeOps Skills Version**: 3.2.0

## Ordering (non-negotiable, per phase)

`spec tests → verify red → implement → verify green → impl tests → full verify`. Spec tests
(`*.spec.test.ts`) encode Ch-05 behavior; impl tests (`*.impl.test.ts`) cover internals/edges.

## Specification test cases

### Phase 1 — Semantics (`packages/frontend/src/semantics/**`, via `analyze()` / `compile()`)

| ST | Input (source) | Expected | Trace |
|----|----------------|----------|-------|
| ST-1 | `if (b) {}` with `b: byte` | **E10134** (non-boolean condition); `if (b != 0) {}` → no error | FR-1 §Ch05.3 |
| ST-2 | `while (5) {}` | **E10134**; `while (n > 0) {}` (n:byte) → no error | FR-1 §Ch05.5 |
| ST-3 | `do {} while (b);` (b:byte) | **E10134**; `do {} while (b != 0);` → no error | FR-1 §Ch05.6 |
| ST-4 | top-level `break;` / `continue;` (no loop) | **E10130** / **E10131** | FR-5 §Ch05.9 |
| ST-5 | `break;`/`continue;` inside a `while`/`for` body | no loop-context error | FR-5 |
| ST-6 | `for (let i:byte = 0 to 300) {}` | **E10064** (300 ∉ 0–255); `... 0 to 200` → no error | FR-4 §Ch05.7.2.1 |
| ST-7 | `for (let i:byte = 0 to 9 step 0) {}` | **E10061**; `step 2` → no error; `step someVar` → **E10061** | FR-4 §Ch05.7.3 |
| ST-8 | non-void `f():byte { let x:byte=1; if (x>0) { return 1; } }` | **E10102**; adding a trailing `return 0;` (or an `else { return 0; }`) → no error | FR-6 §Ch05.4.2 |
| ST-9 | `for (let i:byte = 1 to 3) { sum = sum + i; }` (body reads counter `i`) | no **E10100** — the counter is in scope | FR-3 §Ch05.7.4 |
| ST-10 | a loop body containing a bad expression (e.g. `sum = sum + undof;`) | the nested error (**E10100**) is reported — bodies are typed (recursion) | FR-2 |
| ST-24 | `for (let i = 0 to 5) {}` (no counter type) **and** `for (let i:boolean = 0 to 5) {}` | **E10065** (counter type must be integer) in both; `for (let i:byte = 0 to 5) {}` → no E10065. No throw, no silent pass. | FR-3 §Ch05.7.4 / AR-15 |

### Phase 2 — IL lowering (`packages/codegen/src/il/lower.ts`, real-frontend `lowerRealSource`)

| ST | Input | Expected (printed IL) | Trace |
|----|-------|-----------------------|-------|
| ST-11 | `if (n>0) { poke($C000,1); } else { poke($C000,2); }` | ≥3 blocks; a `brcond`; two `br` to a join label | FR-7 §2.1 |
| ST-12 | `while (n>0) { n = n - 1; }` | cond block with `brcond`; body ends `br` back to cond (back-edge) | FR-7 §2.2 |
| ST-13 | `do { n = n - 1; } while (n>0);` | body block precedes the cond block; cond ends `brcond(_, body, end)` | FR-7 §2.3 |
| ST-14 | `for (let i:byte=1 to 5) { sum=sum+i; }` | init store; cond compares (`le`) via `brcond`; incr block does `add i,1`; `br` to cond (Pattern A) | FR-7 §2.4 |
| ST-15 | `while(true-ish){ if (c){break;} else {continue;} }` | `break` → `br` to loop-end; `continue` → `br` to cond/incr label | FR-8 §2.5 |

### Phase 3 — IL→Instr translate (`packages/codegen/src/il/translate.ts`, via `emitAsm`)

| ST | Input | Expected (ASM text) | Trace |
|----|-------|---------------------|-------|
| ST-16 | the ST-11 if/else program | emitted ASM has ≥2 block labels (`Main_main_L…`) + a `JMP` (br) + a conditional branch | FR-9 §1/§2 |
| ST-17 | the ST-12 while program | a back-edge `JMP` to the cond label + a conditional branch to the body/end | FR-9 §2 |
| ST-18 | a straight-line function (no control flow) | ASM is byte-identical to the pre-4a single-block output (non-regression) | FR-9 §5 / AR-13 |

### Phase 4 — Acceptance (3-part bar, `packages/test-harness/src`)

| ST | Tier | Expected | Trace |
|----|------|----------|-------|
| ST-19 | assemble-clean (CI, real ACME) | `build(slice4a)` → `hasErrors false`, loadable PRG; ASM has loop labels + branch + `__var_Main_result` | FR-10 |
| ST-20 | golden (CI) | `emitAsmSlice4a()` byte-exact vs `slice4a.asm.golden` | FR-11 |
| ST-21 | VICE (local, real 3.10) | `$C000==$15` (21) **and** `$C001==$01` | FR-12 |
| ST-22 | negative (CI, `compile()`) | missing-return fixture → **E10102**, `hasErrors`, no binary, no throw | FR-13 |
| ST-23 | regression (CI) | `golden-gate`/`golden-slice3a`/`golden-slice3b` byte-exact unchanged | AR-13 |

## Implementation tests (per phase, `*.impl.test.ts`)

- **P1:** all-paths-return edge cases (`if` without `else` → not definite; `if/else` both-return →
  definite; trailing `return` → definite; nested `if/else` chains); loop-depth nesting (nested loops,
  `break` in inner loop only affects inner); non-const vs const for-bound (E10064 skipped when
  non-const, AR-10). New-code presence in `diagnostic-codes.impl.test.ts`.
- **P2:** `lowerRealSource` edge cases — nested loops; `else if` chain nesting; a `for` with `downto`
  (compare `ge`, `sub` increment); the Pattern-B full-range guard records an ICE for `0 to 255`
  (AR-6), never throws.
- **P3:** multi-block label uniqueness across two functions (`Module_f_L0` ≠ `Module_g_L0`);
  `unreachable` terminator emits no ICE; **per-block state reset (03-03 §1a): a non-entry block that
  reads one temp twice does not mis-fold the second consumer (prescan covers all blocks), and a
  word-ALU immediately before a branch does not drop the next block's instruction via a stale
  `skipIndex` (reset at each block boundary).**

## Verification

Per-phase targeted runs, then the full workspace verify before completion:

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

`git status --porcelain spec/` must stay empty (D3). VICE (ST-21) is local-only (`skipIf`), proven on
real VICE 3.10; the golden tier (ST-20) is the CI regression guard.
