# Resource-report delta: the Slice 7b fixture (RD-18 Should-Have)

> **Document**: 08-resource-report.md
> **Parent**: [Index](00-index.md)
> **Source**: `build()` on `examples/slice7b/` (c64), recorded at Phase 6 (2026-07-12)

## Pointer ZP cost (the new category in action)

| Figure | Value | Notes |
| ------ | ----- | ----- |
| ZP used | 20 / 46 bytes | vs 10 for a pointer-free program (4 arg + 4 tmp + 2 irq) |
| Pointer pool | **10 bytes** (5 pairs) | peak 4 colored pairs + 1 scratch |
| Colored pairs | `resetEnemy_e`=$06, `sum_data`=$06, `copyPoint_dst`=$06, `copyPoint_src`=$08 | sequential callees SHARE $06 — 3 functions, one address |
| Scratch | `__zp_ptr_scratch`=$0E | reserved (by-ref params + the 300-byte tier-2 array) |
| Pass-through | `relay_e` — NO pair | the AR-2 refinement in production |

## Frames / RAM / binary

| Figure | Value | Notes |
| ------ | ----- | ----- |
| Frame region | 7 bytes (peak 7, sharing saved 8) | by-ref params cost 2 frame bytes each (the FN-3 home) |
| RAM used | 314 / 32768 bytes | dominated by `big: byte[300]` |
| Binary | 367 bytes vs budget 26623 | 212-line golden |
| Stack worst case | 6 / 230 | `main → relay → resetEnemy` = 3 JSR levels |

The per-call by-ref cost (frame home + prologue copy — the accepted AR-2
cost-table drift) is visible as the prologue's 8 instructions per
pair-accessed param; the Phase-B C→A peephole remains the recorded mitigation.
