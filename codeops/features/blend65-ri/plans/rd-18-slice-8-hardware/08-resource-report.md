# Resource Delta: RD-18 Slice 8a — Hardware

> **Document**: 08-resource-report.md
> **Parent**: [Index](00-index.md)
> Recorded at plan completion (2026-07-17) from the minted `slice8.asm.golden` (128 lines)
> and the full-verify run.

## Fixture footprint (`examples/slice8/`)

| Region | Usage | Notes |
| ------ | ----- | ----- |
| Zero page | 11 bytes ($02–$0C) | arg-block 4 ($02–$05) + **user `frameCount` 1 ($06, 2-digit equate)** + main temps 4 ($07–$0A) + irq temps 2 ($0B–$0C). No pointer pairs, no scratch twins (the fixture performs no runtime formation — the conditional reservations correctly stayed OUT). |
| RAM data | 5 bytes ($2000–$2004) | `mirror` 1 + `main`'s frame 4 (two claimed-by-design word slots for the two `&` store-position sites; `bump`/`onIRQ`/`onNMI` frames are zero-size). |
| Code | 128-line golden | Handler ABI = 11 bytes × 2 handlers (save 5 + restore/RTI 6); startup = `LDA/STA $01` + `JSR __init` + **`JMP _main`** (the non-terminating shim — no restore/RTS tail). |

## Slice-wide deltas (vs. pre-8a)

- **ZP**: +1 byte per user `zeropage` byte declared (priority-1 category, before pointers/temps);
  +2 bytes `__zp_irq_ptr_scratch` ONLY when an interrupt-only function performs runtime pointer
  formation (conditional — zeropage-free/interrupt-free programs are byte-identical, proven by
  the ten prior goldens staying byte-exact).
- **Code**: +11 bytes per interrupt handler (unconditional save/restore ABI); the auto-selected
  non-terminating shim SAVES 4 bytes vs. the terminating shim (`JMP` vs. `JSR`+`LDA/STA`+`RTS`)
  on non-returning mains.
- **Always-live growth**: every function reachable from a handler stops sharing frame/pair
  memory — bounded by the irq subtree's frame sizes (zero for the fixture's empty frames).
