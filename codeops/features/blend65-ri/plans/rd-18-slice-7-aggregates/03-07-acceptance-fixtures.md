# Acceptance Fixtures: RD-18 Slice 7a

> **Document**: 03-07-acceptance-fixtures.md
> **Parent**: [Index](00-index.md)

## Overview

The two-file fixture (AR-19), its golden, the VICE assertions, and the negative catalog —
mirroring the slice6 harness wiring (`testing/slice6.ts` + three spec files).

## Fixture: `examples/slice7/`

Two files (AR-19): `main.blend` (module Main) + `gfx.blend` (module Gfx). Gfx exports:
`struct Point { x: byte; y: byte; }`, `enum Direction { UP, DOWN = 3, LEFT, RIGHT }`
(auto+explicit+auto: 0,3,4,5), `const DIM: byte = 4;`, and
`const TABLE: byte[DIM + sizeof(Point)] = [10, 20, 30; 5];` — a const-expression size (= 6)
witnessing the engine, with fill. Main imports `{ Point, Direction, TABLE }`, declares a local
`let pts: Point[2]`, a nested struct, a `let` array with literal init, and drives:

| Address | Value proves |
|---------|--------------|
| `$C000` | indexed read/write loop sum over a `let byte[5] = [1,2,3;4]` (list+fill; = 1+2+3+4+4 = 14 = `$0E`) |
| `$C001` | nested member write/read (`player.pos.y` style) |
| `$C002` | struct-in-array element access (`pts[1].x`) via runtime index (scaled) |
| `$C003` | enum-dispatch: `switch` on a `Direction` value with `case Direction.DOWN` multi-arm → distinct byte |
| `$C004` | `length(TABLE)` fold (= 6) |
| `$C005` | `sizeof(Point)` fold (= 2) |
| `$C006` | `offsetof(Point, y)` fold (= 1) |
| `$C007` | cross-module const-table read `Gfx.TABLE[i]` with runtime `i` (tier-1 indexed into the data section) |
| `$C008` | whole-struct copy witness (`b = a;` then mutate `a`, poke `b.x` — copy semantics, not aliasing) |
| `$C009` | `<word>(dir)` single-step enum cast used in a word context (lo byte poked) |

Exact program text + expected byte values are pinned when the fixture is authored (Phase 7
spec-test task); values above define the shape, the ST rows define the contract.

## Harness wiring (slice6 pattern)

- `packages/test-harness/src/testing/slice7.ts` — inlined sources (BOTH files), `buildSlice7()`
  (real ACME → PRG), `emitAsmSlice7()` (CI-safe)
- `slice7.spec.test.ts` — `skipIf(!hasAcme())` assemble-clean (zero undefined symbols, loadable
  PRG); `skipIf(!(hasVice("c64") && hasAcme()))` VICE run + `assertMemory` per row above
- `golden-slice7.spec.test.ts` — `emitAsmSlice7()` vs
  `packages/test-harness/test/golden/slice7.asm.golden` (the goldens live in the test-harness
  package, NOT repo-root `test/` — PF-010)
  (`assertGolden`, `UPDATE_GOLDEN=1` mint) + landmark `toContain`s: a `__data_Gfx_TABLE` label
  with `!byte` rows, an `LDA …,X` indexed access, the seven prior goldens byte-exact (NO
  re-mint — separate sweep assertion)
- `slice7-negatives.spec.test.ts` — via `compile()`/`emitIl` scratch-dir helpers

## Negative catalog (codes per AR-13/21/22)

E10165+path (struct cycle), E10194+path (const↔sizeof cycle), E10161/E10162/E10097 (struct
literal, field order per AR-9 as amended), E10119 (array assign), E10121 (array compare),
E10117 (word index on tier-1),
E10115 (const index OOB), E10110/E10111 (sizes), E10152 (byte→enum implicit), E10080
(cross-enum compare), E10093/E10120 (aggregate returns), aggregate-param loud rejection,
E10230 (non-const member), E10143 (range), E10077 (case-type mismatch), E10113 (partial const),
E10126 (fill w/o size), E10156 (void field), E10157 (aggregate literal as a statement, AR-26),
string array-initialiser loud Slice-8 rejection (AR-26), E10003 (type/value collision), tier-2
(>256 B) loud rejection; W10140/W10141 compile-with-warning. Cross-module regression: two modules each
declaring `struct Point`, both usable (the AR-7 defect witness).

## Testing Requirements
- These fixtures ARE the E2E tier; ST-59..ST-66 pin the observable contract.
