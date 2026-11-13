# Current State — Bounded NMI Retention

> **Baseline**: `40f8fc66`; clean tree
> **Updated**: 2026-11-13

| Form | Baseline |
|---|---|
| `let m = read() & 3; a = m != 0; b = m == 0` | `E10245`: local home plus comparison results |
| five `peek` samples retained across five `poke`s | `E10245`: five local homes |
| `let w: word = read(); (w & 2) != 0` | `E10245`: word local plus conversion-input staging |

All three now build with zero private requests in the working tree. The shared handler reports
`hardwareStack = 6`; the five-sample handler `10`; the runtime word local `4`. The wrapper saves X
when the body uses `TSX`.
