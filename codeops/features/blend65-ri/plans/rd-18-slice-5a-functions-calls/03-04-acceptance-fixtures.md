# Acceptance Fixtures: RD-18 Slice 5a — User Functions, Parameters & Calls

> **Document**: 03-04-acceptance-fixtures.md
> **Parent**: [Index](00-index.md)
> The three-part acceptance bar (RD-18: CI assemble-clean + CI golden + local VICE) for the
> first multi-function, multi-module program, plus the negative fixtures. Shape blessed at
> AR-16; harness pattern per `testing/slice4b.ts` / `golden-slice4a.spec.test.ts`
> (02-current-state §Codegen).

## 1. Positive fixture — `examples/slice5a/` (TWO files)

### `math.blend`

```blend65
module Math;

export function add(a: byte, b: byte): byte {
    return a + b;
}

export function triple(v: word): word {
    return v * 3;
}
```

### `main.blend`

```blend65
module Main;

import { add, triple } from Math;

let r1: byte;
let r2: word;
let r3: byte;

function main(): void {
    let x: byte = 10;
    r1 = add(x, 7);
    poke(0xC000, r1);

    r2 = triple(300);
    pokew(0xC001, r2);

    r3 = combo(5);
    poke(0xC003, r3);
}

function combo(n: byte): byte {
    let t: byte = add(n, 3);
    return t + t;
}
```

### What it witnesses (and why each line is there)

| Element | Witness |
|---------|---------|
| `add(x, 7)` from `main` | cross-module imported call; byte params (variable + literal arg); byte return in A |
| `triple(300)` | word param (two-byte arg store); word literal adaptation; `word * 3` → `__rt_mul16` inside a callee; word return in A:X |
| `combo(5)` after its use, defined below `main` | FN-7 declaration-order independence; same-module call |
| `combo` → `add` | a non-`main` caller (call-graph depth 2: `main → combo → add`); nested cross-module call |
| `t + t` on a local | AR-4-safe reuse of a call result (memory-homed local, no value live across a call) |
| module vars `r1/r2/r3` | `__var_Main_*` at the new `$2000` base (AR-2) |

Call graph: `main → {add, triple, combo}`, `combo → add`. Interference: `main` ↔ all
(always-live); `combo` ↔ `add` (ancestor-descendant). No argument of any call contains a
nested call → no argument-window edges, no AR-3/AR-4 guard fires. Frames: `add`(2) and
`triple`(2) and `combo`(2+1) may share bytes where lifetimes permit — addresses come from
the real plan; the golden owns them.

### Expected values (derivation)

| Address | Value | Derivation |
|---------|-------|------------|
| `$C000` | `$11` | `add(10, 7)` = 17 |
| `$C001` | `$84` | `triple(300)` = 900 = `$0384`, `pokew` lo byte |
| `$C002` | `$03` | `$0384` hi byte (contiguous `pokew`, slice3b precedent) |
| `$C003` | `$10` | `combo(5)`: `t = add(5,3)` = 8; `t + t` = 16 |

### Harness artifacts

- `packages/test-harness/src/testing/slice5a.ts` — `SLICE5A_MAIN_SRC` + `SLICE5A_MATH_SRC`
  inlined verbatim; `buildSlice5a()` writes BOTH files and passes
  `sourceFiles: ["main.blend", "math.blend"]`; `emitAsmSlice5a()` mirrors it (the `build`/
  `emitAsm` facades already take file arrays — `testing/slice4b.ts:69-90` pattern).
- `packages/test-harness/test/golden/slice5a.asm.golden` — byte-exact ASM golden (CI tier).
- `packages/test-harness/src/golden-slice5a.spec.test.ts` — `assertGolden` (CI).
- `packages/test-harness/src/slice5a.spec.test.ts` — assemble-clean suite
  (`describe.skipIf(!hasAcme())`) + runtime suite
  (`describe.skipIf(!(hasVice("c64") && hasAcme()))`) asserting the four memory cells.

## 2. Negative fixtures (compile-only, via `compile()` — no binary)

Small inline sources in `packages/frontend`/`test-harness` spec tests (07 owns the exact
ST expectations). Each asserts the exact code and that compilation produces no artifact:

| # | Shape | Code |
|---|-------|------|
| N1 | `function f(n: byte): byte { return f(n); }` | E10174 (direct; path `f → f`) |
| N2 | `ping()` ↔ `pong()` mutual calls | E10174, ONE diagnostic, path `ping → pong → ping` (AR-7) |
| N3 | `add(1)` against 2-param `add` | E10170 |
| N4 | `add(w, 1)` with `w: word` | E10171 (strict same-type, AR-5) |
| N5 | import of a non-`export` function | E10012 |
| N6 | `main()` called from another function | E10023 |
| N7 | calling an `interrupt function` directly | E10051 (AR-10) |
| N8 | `let x: byte = 1; x();` | E10175 `NotCallable` (AR-9) |
| N9 | `return;` inside a non-void function | E10172 (AR-6) |
| N10 | duplicate parameter name | E10003 (AR-8) |
| N11 | param name shadowing a module-level `let` | E10101 (FN-13, AR-8) |
| N12 | return-type mismatch (`return w` in a byte fn, `w: word`) | E10154 via checkAssignable, return wording (AR-6) |

## 3. Guard fixtures (ICE — never a wrong binary)

| # | Shape | Expectation |
|---|-------|-------------|
| G1 | `f(1, g())` where `g` (transitively) calls `f` | lowering ICE, AR-3 residual message |
| G2 | `f() + g()` (value live across a user call) | translate ICE, AR-4 message |
| G3 | `f(g(1), 2)` — nested call in the FIRST argument | **compiles and runs correctly** (allowed by AR-3; positive witness that the guards are not over-broad) |

G3 lives in an impl/spec test (not the main fixture) with a VICE-tier assertion where
practical; G1/G2 assert the ICE diagnostic band + no output.

## 4. Phase-0 re-mint set (AR-2)

All five existing goldens re-mint (equate values only) at the `$2000` base and re-verify on
local VICE before any Slice-5a feature work: gate (`$D020`), slice3a, slice3b, slice4a,
slice4b. The overlap check gets its own synthetic-input spec tests (07 ST-21/22) since no
real fixture can exceed `$2000` today.
