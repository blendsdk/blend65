# Resource Delta: RD-18 Slice 8b — Strings & Embed

> **Document**: 08-resource-report.md
> **Parent**: [Index](00-index.md)
> Recorded at plan completion (2026-07-17) from the minted `slice8b.asm.golden` (205 lines)
> and the full-verify run.

## Fixture footprint (`examples/slice8b/`)

| Region | Usage | Notes |
| ------ | ----- | ----- |
| Zero page | 16 bytes ($02–$11) | arg-block 4 ($02–$05) + pointer pairs 6 ($06–$0B: `copyBytes` src + dst by-ref pairs, `__zp_ptr_scratch`) + main temps 4 ($0C–$0F) + irq temps 2 ($10–$11). Both by-ref params of `copyBytes` are pair-accessed, so each binds a ZP pair. |
| RAM data | 33 bytes ($2000–$2020) | `banner` 8 + `title2` 10 + `table2` 8 (staging arrays) + `copyBytes`' 7-byte frame ($201A–$2020, shared base with `main`'s empty frame by coloring). |
| Const data | 18 bytes | `__data_Main_TITLE` 10 (PETSCII `48 45 4C 4C 4F 20 43 36 34 21`) + `__data_Main_TABLE` 8 (the embedded file, byte-verbatim `01 02 04 08 10 20 40 80`) — `!byte` rows in the `data` segment, no `!bin`. |
| Code | 205-line golden | Terminating shim (`JSR __init` → `JSR _main` → restore/RTS); the banner's expanded string+fill initialises through the init stream; the 27 const-address pokes relay the staged bytes to the observable ranges. |

## Slice-wide deltas (vs. pre-8b)

- **Const data**: a string const costs exactly its encoded byte count; an embed costs exactly
  the file's byte count (≤65536, stat-enforced before read). Both ride the shipped
  `__data_<Module>_<name>` path — programs without strings/embeds are byte-identical (proven
  by the eleven prior goldens staying byte-exact).
- **Code**: string/char literals add no code of their own — they desugar into the same
  numeric-literal shapes the array machinery always lowered. A generated-label fix rode this
  slice: `_cmpN`/`_shN` labels now draw from one program-wide sequence (previously each
  function restarted at 0 — any program with two comparison-bearing functions failed at
  assembly; no prior golden changed).
- **Zero page**: unchanged rules — by-ref array params bind pairs exactly as 7b shipped them.
- **Analysis**: `embed()` reads happen once at analysis time and are cached in the const
  value; `SemanticModel.embeddedAssets` records FQN → canonical path for future watch hosts.
