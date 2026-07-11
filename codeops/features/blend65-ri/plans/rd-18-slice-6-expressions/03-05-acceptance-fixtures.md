# Acceptance Fixtures & 3-Part Bar: RD-18 Slice 6

> **Document**: 03-05-acceptance-fixtures.md
> **Parent**: [Index](00-index.md)

## Overview

The RD-18 AC-5 bar: an expression-heavy program VICE-verifies exact arithmetic
results with **observable short-circuit suppression**, plus the CI golden and
assemble-clean tiers. Fixture per AR-12 (single file, single module).

## The fixture — `examples/slice6/main.blend`

```blend65
module Main;

let witness: byte = 0;

function bump(): boolean {
  witness = witness + 1;
  return true;
}

function main(): void {
  // Mixed-width promotion + compound assignment
  let a: byte = 200;
  let base: word = 1000;
  let r: word = base + a;                      // byte zero-extends: 1200
  r += 55;                                     // word += byte literal: 1255 = $04E7
  pokew($C000, r);                             // $C000=$E7 $C001=$04

  // Cast (trunc), shift, bitwise, unary ~
  let w: word = $0304;
  let low: byte = <byte>(w);                   // truncate: $04
  let m: byte = (low << 3) | 5;                // 32|5 = 37
  poke($C002, ~m);                             // ~37 = 218 = $DA

  // Unary minus (signed), cross-sign cast
  let s: sbyte = -5;
  let t: sbyte = -s;                           // 5
  poke($C003, <byte>(t));                      // $05

  // Comparisons: mixed-width unsigned + signed; ternary
  let cond: boolean = (a < base) && (s < 0);   // true && true
  let pick: byte = cond ? 7 : 9;               // 7
  poke($C004, pick);                           // $07

  // Short-circuit suppression (the AC-5 observable)
  let dead: boolean = (a > base) && bump();    // false && — bump SUPPRESSED
  let live: boolean = (a < base) || bump();    // true  || — bump SUPPRESSED
  poke($C005, witness);                        // $00 — proof neither ran
  let ran: boolean = dead || (a > base) || bump(); // all false — bump RUNS
  poke($C006, ran && live ? witness : $FF);    // true && true → witness = $01

  // Variable-count word shift
  let sh: byte = 2;
  let wide: word = $0011;
  let shifted: word = wide << sh;              // $0044
  pokew($C007, shifted);                       // $C007=$44 $C008=$00
}
```

**Expected memory** (the VICE assertion set; sentinel = `$C007 == $44`):

| Addr | Value | Witnesses |
|------|-------|-----------|
| $C000/$C001 | $E7/$04 | promotion + compound assign (1255) |
| $C002 | $DA | cast-trunc, const-count shift, bitwise or, `~` |
| $C003 | $05 | signed unary minus, cross-sign cast |
| $C004 | $07 | mixed-width + signed comparisons, `&&`, ternary |
| $C005 | $00 | **short-circuit suppression** (both forms) |
| $C006 | $01 | short-circuit RHS execution + ternary-with-logical condition |
| $C007/$C008 | $44/$00 | variable-count word shift |

## The three tiers (RD-12 constructs, 5b file pattern)

| Tier | File (new, `packages/test-harness/src/`) | Runs in CI |
|------|------------------------------------------|------------|
| Assemble-clean | `slice6.spec.test.ts` (`skipIf(!hasAcme())`) — `build()` → loadable PRG, zero errors | when ACME present (CI installs it) |
| Golden | `golden-slice6.spec.test.ts` + `test/golden/slice6.asm.golden` — byte-exact `emitAsm` + landmark checks | yes |
| VICE runtime | `slice6.spec.test.ts` VICE suite (`skipIf(!(hasVice&&hasAcme))`) — the table above | no (local, AR-27) |

Shared builder `testing/slice6.ts` (`buildSlice6`/`emitAsmSlice6`) mirroring
`testing/slice5b.ts`.

**Golden landmark assertions** (beyond byte-exactness): a `__frame_Main_main_0sc`
equate exists (synthetic slots are real); short-circuit block labels present;
`JSR Main_bump` present; NO `__rt_` calls (nothing in the fixture multiplies/divides).

**Prior-golden protection (plan-local AC-1)**: before minting `slice6.asm.golden`,
the full suite must show gate/3b/4a/4b/5a/5b + compiler assemble goldens green
WITHOUT re-mint.

## Negative fixtures — `slice6-negatives.spec.test.ts` (via `compile()`, no binary)

| # | Source shape | Expected |
|---|--------------|----------|
| N1 | `byte < sbyte` comparison | E10081 |
| N2 | `boolean < boolean` | E10080 |
| N3 | `-byteVar` | E10087 |
| N4 | `<boolean>(5)` | E10086 |
| N5 | `flag ? byteVar : sbyteVar` | E10088 |
| N6 | `x << sbyteVar` | E10083 |
| N7 | `sbyte / sbyte` | E90001 ICE (via `emitIl`/`build` path — lowering-stage) |
| N8 | `let r: word = byteA + byteB;` | compiles + **W10160** present |
| N9 | `byteVar << 9` | compiles + **W10174** present |

(Frontend-tier ST cases in 07 cover the same codes at the unit level; these
negatives prove them through the public `compile()` seam like 5b's.)

## Integration Points

- `examples/` growth satisfies the RD-18 Should-Have (per-slice runnable program).
- The resource-report delta (RD-18 Should-Have) is recorded in the rollout phase
  from the build's `ResourceReport`.

## Error Handling

Covered by the negative table — every failure is a diagnostic, never a crash
(RD-18 Security Considerations: malformed input → clean diagnostic).

## Testing Requirements

ST-31…ST-36 (07) own the exact expectations for the three tiers + negatives.
