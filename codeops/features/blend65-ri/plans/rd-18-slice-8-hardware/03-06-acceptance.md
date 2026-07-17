# Acceptance Fixture & Verification: RD-18 Slice 8a

> **Document**: 03-06-acceptance.md
> **Parent**: [Index](00-index.md)
> **Governs**: the `examples/slice8/` fixture, the harness trio, the golden, the T1 coverage
> test, and the negatives suite.
> **AR**: 16 (challenger-hardened), 26; RD-18 §Acceptance Bar (three parts, all required).

## Overview

The acceptance program is a **raw-vector raster-interrupt demo**: it installs a generated
interrupt handler at the hardware IRQ vector with the KERNAL banked out, flips the border color
and bumps a saturating zeropage counter once per raster interrupt, and never returns from
`main`. It exercises every 8a surface at once: `&` (vector install), interrupt ABI, an irq-only
helper (the AR-15 witness), zeropage (the counter), T1 intrinsics (`asm_sei`/`asm_cli`), and
the non-terminating shim.

> The RD's `pokew($0314, &onIRQ)` sketch and the spec's Ch 06 §7.7 example are recorded
> deviations — hardware-verified to crash under the spec's own RTI epilogue (AR-16).

## The fixture (`examples/slice8/main.blend`, single module)

Shape (exact literals/values finalized at spec-test authoring; the SEQUENCE is normative —
every line is load-bearing per the challenger review):

```blend65
module Main;

zeropage {
  frameCount: byte = 0;          // saturating counter (primary observable)
}

let mirror: byte = 0;            // RAM mirror in the $2000 data region

interrupt function onIRQ() {
  poke($D019, $FF);              // ack VIC FIRST (unacked → IRQ storm)
  bump();                        // irq-only helper — AR-15 living witness
}

interrupt function onNMI() { }   // empty NMI hardening (raw $FFFA is RAM garbage otherwise)

function bump(): void {
  if (frameCount < 100) {        // SATURATING — both observables gated (PF-011):
    poke($D020, peek($D020) + 1);//   the border flip stops at saturation, so the
    frameCount = frameCount + 1; //   final border is (boot + 100) mod 16 — deterministic
  }
}

function main(): void {
  asm_sei();
  poke($DC0D, $7F);              // mask ALL CIA-1 interrupt sources
  mirror = peek($DC0D);          // read ICR once: clears any latched pre-SEI IRQ
  pokew($FFFE, &onIRQ);          // raw IRQ vector (writes hit RAM under any banking)
  pokew($FFFA, &onNMI);          // raw NMI vector
  poke($01, $35);                // bank KERNAL out — vector FETCH now reads RAM
  poke($D012, 100);              // raster line
  poke($D011, peek($D011) & $7F);// RMW: clear raster-line bit 8 ONLY (no mode clobber)
  poke($D01A, $01);              // enable VIC raster IRQ
  poke($D019, $FF);              // pre-ack any stale VIC latch
  asm_cli();
  while (true) {
    mirror = frameCount;         // mainline consumes the ZP counter
  }
}
```

## Harness trio (template: slice7b files)

| File | Purpose |
| ---- | ------- |
| `packages/test-harness/src/testing/slice8.ts` | inlined sources; `buildSlice8()` → real `build()` → PRG; `emitAsmSlice8()` |
| `slice8.spec.test.ts` | ACME assemble-clean (`skipIf(!hasAcme())`); VICE runtime (`skipIf(!(hasVice("c64")&&hasAcme()))`) |
| `golden-slice8.spec.test.ts` | byte-exact ASM golden (`assertGolden`, `UPDATE_GOLDEN=1` mint) + landmark `toContain` checks (`JMP _main`, the save/RTI sequence, the `__zp_` equates) |
| `slice8-negatives.spec.test.ts` | the negative matrix (below) via `compile()`/`emitIl` — diagnostics, no binary |

**VICE assertions (AR-16):** `runFrames(N)` (N sized ≫ saturation), then direct memory reads:
`frameCount`'s ZP address ≥ threshold AND `mirror` ≥ threshold (primary); `$D020 & $0F` ≠ the
boot border color (secondary — VIC unconnected bits read back 1). Never an equality wait on a
moving counter. The border flip is gated under the saturation guard (PF-011), so the final
border is (boot + 100) mod 16 — deterministic, immune to the IRQ-count-mod-16 collision an
ungated flip would carry. Emulator suites stay sequential (`fileParallelism: false`) and local-only
(AR-27 CI policy).

## T1 coverage (AR-26)

A CI-tier test proving each of the 13 `asm_*` T1 intrinsics translates to exactly its opcode
(catalog ↔ `T1_OPCODES` ↔ emitted mnemonic). Any gap discovered becomes an implementation task
(none expected — wiring shipped in RD-17).

## Negatives matrix (all through public facades)

| Case | Expected |
| ---- | -------- |
| `&constScalar` / `&param` / `&a[i]` / `&(x+1)` | E10047 / E10048 / E10042 / E10049 |
| `interrupt function f(): word` | E10050 |
| direct call to an interrupt fn | E10051 (re-pin) |
| `export interrupt` | E10311 (re-pin) |
| zeropage over-budget program | E10032 |
| zeropage field with string initializer | the loud string-init rejection (8a/8b seam pin) |
| `export` / `let` / `const` inside a `zeropage` block | loud parse errors (recorded F005 ZP-5/E10031/E10033 deviations — PF-008) |
| by-ref arg-place pins (ST-40 rewrite) | compile SUCCESSFULLY (retired-row protocol) |

## Regression & resource

- All **ten** prior slice goldens byte-exact (gate + 3a..7b) — 01-req AC-5. (A justified
  re-mint under AC-5's escape hatch updates the golden fixture via `UPDATE_GOLDEN` — never the
  assertion logic; the oracle stays immutable. PF-013.)
- Record the 8a resource delta (RD-11 `ResourceReport`): expect ZP growth = user vars + irq
  scratch twin (conditional) + irq temp pool; code growth = handler ABI + shim change.

## Testing Requirements

ST-39..ST-46 (07-testing-strategy) plus the matrix above; three-part bar per RD-18
§Acceptance Bar.
