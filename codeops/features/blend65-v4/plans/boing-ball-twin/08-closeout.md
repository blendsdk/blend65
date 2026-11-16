# Boing-ball expert twin — closeout

> **Issue**: [#72](https://github.com/blendsdk/blend65/issues/72)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (fixture and benchmark); expert gap tracked as [#168](https://github.com/blendsdk/blend65/issues/168)
> **Recorded**: 2026-11-16

## Delivered

`examples/boing-ball/` now lives in v4 with:

- `src/main.blend` — the four-sprite pointer-swap ball, ported to the v4
  `c64.vic.vicSpriteBlock(&BALL)` selector (which demands the 64-byte placement and derives the
  block number).
- `assets/ball.bin` — the 1,024-byte four-frame sprite sheet.
- `twin.asm` — the hand-written expert twin: 402 code bytes, 12 zero-page bytes, same behavior.
- `blend65.json` — the v4 project manifest.

The behavior oracle samples both programs at the instruction after the raster-251 wait and compares
the complete VIC state at frames 2, 6, 10, 99 and 100. Frame 10 exercises the colour inversion;
frames 99/100 exercise the right-edge 9-bit X bounce. All sampled states are identical, including
the sprite pointers and collision flags.

## Measured cost

| Artifact | Compiled example | Hand-written twin |
| --- | ---: | ---: |
| Code bytes | **1,599** | **402** |
| PRG payload (same asset at `$2000`) | 7,167 | 7,167 |
| Zero page | **0** | **12** |

The compiler output is 3.98× the expert code. The measured causes are recorded in #168: the
volatile raster `peek` is spooled and reloaded, hot locals have no zero-page homes, and the
block/edge lowering leaves repeated loads and jumps. The gap is filed with a path to beat; this
slice does not silently accept it.

## Implementation

| File | Change |
| --- | --- |
| `examples/boing-ball/blend65.json`, `src/main.blend`, `assets/ball.bin` | Ported fixture |
| `examples/boing-ball/twin.asm` | Hand-written expert twin |
| `test/rd05/boing-ball-fixture.ts` | Shared twin assembly and label helpers |
| `test/rd05/boing-ball-parity.spec.test.ts` | VICE frame-state equality oracle |
| `test/rd05/boing-ball-parity-cost.impl.test.ts` | Code/payload/zero-page cost pins |

## Verification

| Tier | Result |
| --- | --- |
| Build | Example builds; asset 64-byte aligned in VIC bank 0 |
| VICE behavior | Identical VIC state at frames 2, 6, 10, 99, 100 |
| Twin assembly | ACME 0.97; 402 code bytes |
| Cost pins | 1,599 / 7,167 / 0 vs 402 / 7,167 / 12 |
| Compiler package | 236 files / 3,939 passed / 2 skipped (unchanged; root-only additions) |
| Host checkpoint | 244 files / 5,112 passed (the new cost oracle included) |
| Complete `yarn test:full` | Host/compiler green; `boing-ball-parity` VICE passed (1/1) and the cost oracle passed (1/1). The only failures were the known host-load `vic-collision-vice` timing case (2/16), unrelated to this slice; that file passed 16/16 on an isolated serialized rerun in the preceding checkpoint. |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| 3.98× code size and zero-page 0 | #168 |
| Steady-state frame cycles unpublished for a non-returning loop | #168 |
| #70/#53/#73 other corpus fixtures | separate slices |

## Deferral-expiry check

No deferral's reason is invalidated. The corpus port was scoped by the user to the boing-ball
fixture; the remaining fixtures and the optimization work keep their named owners. The parity
benchmark now exists, so future optimization slices have a game-shaped scoreboard rather than only
synthetic probes.
