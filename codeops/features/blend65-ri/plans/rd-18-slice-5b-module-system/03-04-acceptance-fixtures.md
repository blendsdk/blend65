# Acceptance Fixtures — 3-Part Bar: RD-18 Slice 5b

> **Document**: 03-04-acceptance-fixtures.md
> **Parent**: [Index](00-index.md)
> Governs: `examples/slice5b/`, `packages/test-harness/src/testing/slice5b.ts`,
> `golden-slice5b.spec.test.ts`, `slice5b.spec.test.ts`, negatives.
> Decisions: AR-10 (+ AR-5 order witness, AR-1 surface witness, AR-9 merging witness).

## 1. The fixture (`examples/slice5b/` — three files)

`main.blend` (module Main):

```blend65
module Main;

import { add } from Math;

let combo: byte = Math.scaled + 1;

function main(): void {
  poke($C000, add(2, 3));
  poke($C001, Math.twice(4));
  poke($C002, combo);
  pokew($C003, Math.base);
  Math.base = Math.base + 1;
  pokew($C005, Math.base);
}
```

`math.blend` (module Math — file 1):

```blend65
module Math;

export const SCALE: byte = 3;
export let base: word = $0102;

export function add(a: byte, b: byte): byte {
  return a + b;
}
```

`math2.blend` (module Math — file 2, SAME module):

```blend65
module Math;

export let scaled: byte = SCALE * 2;

export function twice(v: byte): byte {
  return add(v, v);
}
```

### What each line witnesses

| Element | Witnesses |
|---------|-----------|
| `math.blend` + `math2.blend` both `module Math` | merging (AR-9) — one scope, no E90001 |
| `add(v, v)` in math2 (declared in math.blend, no import) | cross-file same-module visibility |
| `SCALE * 2` in math2 (const declared in math.blend) | merged-scope const resolution + const folding + runtime `__rt_mul8` inside `__init` (03-03 §1 runtime-collection note) |
| `Math.twice(4)` in main (NO import for `twice`) | qualified call (AR-1) + call-graph parity rider |
| `Math.scaled + 1` in `combo`'s initializer | qualified read inside an initializer → cross-module init edge (AR-5 Step 1) |
| `pokew($C003, Math.base)` / `Math.base = Math.base + 1` | qualified word read + qualified write (AR-1) |
| Main discovered FIRST (sourceFiles order) but Math inits first | the AR-5 import-edge module ordering is LOAD-BEARING, not vacuous |
| `let combo`/`let scaled`/`let base` byte+word | per-variable topo + byte/word `__init` stores |

### Init-order derivation (AR-5)

- Module base order: Main imports Math → Math first (despite Main's earlier
  discovery). Variables: Math.`base` (file 1), Math.`scaled` (file 2), Main.`combo`.
- Edges: `combo → scaled` (qualified ref); `scaled → SCALE` is a const → NON-edge.
- **initOrder = [Math.base, Math.scaled, Main.combo]**; values: base=$0102,
  scaled=3×2=6, combo=6+1=7.

### Expected memory (VICE, after run)

| Address | Value | From |
|---------|-------|------|
| `$C000` | `$05` | `add(2,3)` |
| `$C001` | `$08` | `Math.twice(4)` = add(4,4) |
| `$C002` | `$07` | `combo` (init-order witness) |
| `$C003/$C004` | `$02/$01` | `Math.base` = $0102 (lo/hi) |
| `$C005/$C006` | `$03/$01` | `Math.base` after `+ 1` = $0103 |

Completion sentinel: `runUntilMemory(driver, 0xC005, 0x03)`, then `assertMemory`
over all seven addresses. AR-4(5a) shapes avoided (no value live across a user call
in one expression; `poke(addr, add(2,3))` is the 5a-proven pattern).

## 2. Harness artifacts (mirror slice5a exactly)

- `packages/test-harness/src/testing/slice5b.ts`: `SLICE5B_MAIN_SRC` /
  `SLICE5B_MATH_SRC` / `SLICE5B_MATH2_SRC` (byte-identical to `examples/slice5b/`),
  `writeFixture(cwd)`, `buildSlice5b()` (`build({ platform: "c64", cwd,
  sourceFiles: ["main.blend", "math.blend", "math2.blend"], outDir })`),
  `emitAsmSlice5b()` (CI tier, no ACME). `outName` derives to `main` (lexicographic
  rule — `main.blend` first).
- `golden-slice5b.spec.test.ts` + `test/golden/slice5b.asm.golden` — `assertGolden`;
  mint via `UPDATE_GOLDEN=1 yarn workspace @blend65/test-harness test golden-slice5b`.
  Golden content asserts (spot): `__init:` stream FIRST, `JSR __init` in the shim,
  `__var_Math_base`/`__var_Math_scaled`/`__var_Main_combo` equates at `$2000+`,
  NO `__var_Math_SCALE` (const inlined — AR-7), `Math_twice`/`Math_add` labels.
- `slice5b.spec.test.ts` — `describe.skipIf(!hasAcme())` assemble-clean tier
  (build → no errors → PRG bytes) and `describe.skipIf(!(hasVice("c64") &&
  hasAcme()))` VICE tier (`setupEmulator`, sentinel, the seven asserts).
- Negatives (compile-only via `compile()`/`emitAsm`, 4b-negatives pattern):

| # | Source shape | Expected |
|---|--------------|----------|
| N1 | one file, `let a: byte = b + 1; let b: byte = a + 1;` | ONE E10194, path `a → b → a` |
| N2 | `Math.helper()` where `helper` is not exported | E10012 |
| N3 | `Nope.fn()` — no such module or value | E10100 |
| N4 | `let x: byte = f();` at module level | ICE E90001 (AR-4 message) |
| N5 | two files, same module, both `export function f(): byte` | E10003 |
| N6 | `const B: byte = v;` where `v` is a `let` | E10193 |

All six also exist as frontend spec tests (07-testing-strategy); the harness copies
prove them through the public facade with no binary produced.

## 3. Prior-golden regression (AR-8)

The six existing goldens (gate, slice3a, slice3b, slice4a, slice4b, slice5a) and
the compiler assemble goldens must remain byte-exact WITHOUT re-mint — conditional
`__init` emission is the whole point. Any diff is a defect in the shim/stream wiring.
