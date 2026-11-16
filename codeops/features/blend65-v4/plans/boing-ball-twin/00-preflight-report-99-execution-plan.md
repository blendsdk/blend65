# Preflight report — boing-ball expert twin

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 2 majors resolved, 3 residuals accepted
> **Mode**: strict; the machine-code and semantics specialist lenses apply

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-72-001 | 🟠 MAJOR | A twin placed at a different asset address would compare different pointer values, not different code. | Both programs place `ball.bin` at `$2000`; the behavior oracle compares complete VIC state, including pointers. |
| PF-72-002 | 🟠 MAJOR | Sampling at an arbitrary PC could catch the programs in different phases. | Both are sampled at the instruction after the raster-251 wait, so each stop is one frame boundary; frames 2/6/10/99/100 select the same phase. |
| PF-72-003 | 🟡 MINOR | The compiled example's steady-state cycles are `Unknown` because the loop never returns. | Accepted: the cost oracle pins bytes and zero page; #168 carries the missing steady-state cycle measurement. |
| PF-72-004 | 🟡 MINOR | The port changes the v3 `lo(&BALL / 64)` expression to `vicSpriteBlock`. | Accepted: the public selector is the v4 placement proof; it also fixes the asset alignment. |
| PF-72-005 | 🟡 MINOR | The generated twin PRG could be committed accidentally. | The test assembles in a scratch directory and copies only `twin.asm` and `ball.bin`. |

## Boundary

The behavior oracle is VICE-verified / hardware-unverified. The cost gap is filed as
[#168](https://github.com/blendsdk/blend65/issues/168) with the measured assembly evidence. No
`spec/` or ledger file changes.
