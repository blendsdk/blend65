# Acceptance fixtures: examples/slice7b/, byte contract, goldens

> **Document**: 03-06-acceptance-fixtures.md
> **Parent**: [Index](00-index.md)

## Overview

The AR-13 fixture: two files, six runtime observables in the `$C000..` band, proven on real
VICE 3.10 under the RD-18 three-part bar. Warnings are witnessed by CI spec suites, not the
fixture (the fixture must compile warning-clean where possible; W10142 on the tier-2 array is
expected and asserted as compile-WITH-warning in the suite, not suppressed).

## Fixture files

### `examples/slice7b/game.blend`

```blend65
module Game;

export struct Point { x: byte; y: byte; }
export struct Enemy { pos: Point; hp: byte; }

export const TABLE: byte[] = [3, 5, 7];        // unsized const — witnesses the AR-15 inference

/** By-ref mutation: the caller's struct really changes (FN-3). */
export function resetEnemy(e: Enemy): void {
  e.hp = 0;
  e.pos.y = 42;                                 // nested chain through the pair
}

/** Const + unsized: read-only sum with explicit length (CP-1, §8.2). */
export function sum(data: const byte[], len: byte): byte {
  let total: byte = 0;
  let i: byte = 0;
  while (i < len) {                              // `to` is inclusive (Ch 05) — while is exact
    total += data[i];
    i += 1;
  }
  return total;
}

/** Pass-through chain: forwards its by-ref param whole (no pair of its own). */
export function relay(e: Enemy): void {
  resetEnemy(e);
}
```

### `examples/slice7b/main.blend`

```blend65
module Main;
import { Enemy, Point, TABLE, resetEnemy, sum, relay } from Game;

let boss: Enemy;
let big: byte[300];                              // tier-2 (W10142 expected)
let a: Point;
let b: Point;

function copyPoint(dst: Point, src: const Point): void {
  dst = src;                                     // whole-struct copy through two pairs
}

function main(): void {
  boss.hp = 99;
  relay(boss);                                   // pass-through → by-ref mutation
  poke($C000, boss.hp);                          // 00 — mutated through two hops
  poke($C001, boss.pos.y);                       // 2A — nested write through pair

  poke($C002, sum(TABLE, length(TABLE)));        // 0F — const→const unsized sum (3+5+7)

  big[4] = 17;                                   // const index — folds to absolute (coexistence)
  let idx: word = 260;                           // RUNTIME word index (PF-001 — literal indexes
  big[idx] = 29;                                 //   const-fold to absolute and would skip the
  poke($C003, big[idx]);                         //   (zp),Y formation path entirely)
                                                 // 1D — formation write AND read at 260
  poke($C004, big[4]);                           // 11 — low range intact (no aliasing)

  a.x = 11; a.y = 22;
  copyPoint(b, a);
  a.x = 99;                                      // copy is unaffected afterwards
  poke($C005, b.x);                              // 0B — copy semantics through params
  poke($C006, b.y);                              // 16
}
```

## Byte contract (pinned; the VICE suite asserts every row)

| Addr | Value | Witnesses |
| ---- | ----- | --------- |
| $C000 | $00 | by-ref mutation through a pass-through chain (relay → resetEnemy) |
| $C001 | $2A | nested member write through a pair (`e.pos.y = 42`) |
| $C002 | $0F | const unsized param sum + `length()` at the call site |
| $C003 | $1D | tier-2 write/read at RUNTIME word index 260 — the §5 formation path (scratch seed + word add) executes on hardware; the index high byte is load-bearing in the formation |
| $C004 | $11 | tier-2 low-range integrity via a CONST index (fold-to-absolute coexistence; index 4 not aliased by 260 mod 256) |
| $C005 | $0B | whole-struct copy through two by-ref params, source mutated after |
| $C006 | $16 | second field of the copy |

The $C003/$C004 pair is the "suppression proof" analogue — corrected per PF-001: with a
LITERAL index, lowering folds to absolute addressing and translate never sees an index at all
(nothing to "drop"). With the runtime `idx`, the effective address is computed by the §5
formation word-add; if the formation loses the index HIGH byte (uses only the low byte 4),
`big[idx]` aliases `big[4]` and BOTH rows go wrong (29/29 or 17/17), never coincidentally
right. Exact-value discipline per the 7a fixture.

> The final byte contract is re-verified at execution time (the values above are computed
> from the source by hand; any drift found while building the fixture is a plan-doc fix, not
> a test fix — the VICE run is the oracle).

## Test surfaces

| Suite | Runs | Content |
| ----- | ---- | ------- |
| `slice7b.spec.test.ts` | local (skipIf no ACME/VICE) | assemble-clean (loadable PRG, zero undefined symbols incl. `__zp_ptr_*`) + the VICE byte contract |
| `golden-slice7b.spec.test.ts` | CI | `emitAsm` vs `test/golden/slice7b.asm.golden` byte-exact + landmarks: `__zp_ptr_` symbol defs, `(`…`),Y` accesses, `#<`/`#>` address marshalling, the prologue copy, **the §5 formation sequence (scratch seed + word add — PF-001)**, NO `__zp_ptr_scratch`-less staging |
| `slice7b-negatives.spec.test.ts` | CI | the [07](07-testing-strategy.md) negative/advisory rows via `compile()`/`emitIl` |
| prior goldens (gate + slice3a..slice7 — nine committed) | CI | byte-exact, unchanged — the AR-4 golden-safety proof |

Golden minted only after the VICE contract passes (`UPDATE_GOLDEN=1`), per repo convention.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| fixture accidentally tripping W10143 | keep `big` at 300 B (<25% of c64 RAM) — W10142 only | AR-11/AR-13 |
| VICE flake (slice3b known) | re-run in isolation before diagnosing | — |

## Testing Requirements

Owned by [07-testing-strategy.md](07-testing-strategy.md) (ST-59..ST-66 band).
