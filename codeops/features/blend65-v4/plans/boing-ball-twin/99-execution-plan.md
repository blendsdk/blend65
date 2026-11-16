# Boing-ball expert twin — execution plan

> **Owner**: issue [#72](https://github.com/blendsdk/blend65/issues/72).
> **Scope mode**: strict. One game-shaped fixture, one hand-written twin, one behavior oracle.
> No new runtime or source restriction.

## Problem

The parity corpus has no program shaped like a game. `examples/boing-ball` exists only on
`feat/asm-parity`: four unexpanded multicolor sprites in a 2x2 ball, animated by sprite-pointer
swapping, with a colour-inversion half cycle and a 9-bit X bounce. The v4 checkout has neither the
example nor a twin, so the expert-output benchmark has no game-shaped witness.

## Decision

- Port the example into `examples/boing-ball/` with a v4 `blend65.json` and the public
  `c64.vic.vicSpriteBlock(&BALL)` selector, which both demands 64-byte sprite-block placement and
  derives the block number at link time. The v3 `lo(&BALL / 64)` expression is replaced by that
  documented primitive.
- Author the hand-written twin in `examples/boing-ball/twin.asm`: the same visible behavior, a
  compact zero-page game loop, the asset placed at `$2000` like the example.
- The behavior oracle runs both programs in VICE and compares the complete VIC state at frames 2,
  6, 10, 99 and 100: coordinates, 9-bit X, colors, sprite pointers, enable/expansion registers and
  collision flags. The 99/100 frames exercise the right-edge bounce; frame 10 exercises the
  colour swap.
- The cost oracle pins the current compiler-vs-twin output. The measured gap is tracked as
  [#168](https://github.com/blendsdk/blend65/issues/168); this slice delivers the fixture and the
  benchmark, not the optimization.

## Tasks

- [x] T-72.1 Port `main.blend` and `ball.bin` with a v4 manifest and `vicSpriteBlock`.
- [x] T-72.2 Author the hand-written twin.
- [x] T-72.3 Add the VICE behavior oracle across the bounce and colour-swap frames.
- [x] T-72.4 Add the cost oracle and record the expert gap.
- [x] T-72.5 File the parity-gap issue with the measured causes.
- [x] T-72.6 Run the affected tiers and record the closeout.

## Acceptance

| Area | Oracle |
| --- | --- |
| Build | The example builds with a 64-byte-aligned, VIC-bank-0 asset. |
| Behavior | Both programs produce identical VIC state at frames 2, 6, 10, 99 and 100. |
| Twin | ACME assembles `twin.asm`; its frame point matches the compiled program's. |
| Cost | The current output is pinned (1,599 code bytes / 7,167 payload / 0 ZP vs 402 / 7,167 / 12). |
| Gap | The measured expert gap is filed with causes and a path to beat (#168). |

## Residuals

| Residual | Owner |
| --- | --- |
| Compiler code is ~4× the twin; hot locals use no zero page | #168 |
| Steady-state frame cycles are not published for the non-returning loop | #168 |
| #70/#53/#73 corpus fixtures | separate slices |

## Constraints

- `spec/` and the expressiveness ledger stay byte-identical. No test or VICE journey is weakened.
  No push.
