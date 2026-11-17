# Captured startup mapping — actual ACME byte evidence

This is a bounded primary-generated verification handoff, not a new oracle or compiler source.
It comes from fresh public builds after the host pass, not from reading or relaying the auditor's
denied retained-log paths. Native denials remain binding; reviewers need no external-path access.
No emulator or new harness is introduced. Source/test/production bytes remain unchanged.

## Provenance and exact final ranges

The primary copied known boing inputs into an owned temporary project, built canonical `none`
through the public compiler/real ACME, and extracted bytes only within CPU16 entry/restore ranges.
It also used the existing public source fixture for the returning program
`module Game; function main(): void { poke($D015, 1); }`. Temporary projects are cleaned.
Profile is `c64-pal-prg-kernal-6581`, NMOS6510, ACME0.97; no runtime/hardware claim follows.

| Artifact                     | PRG SHA-256                                                        | Actual ranges, exclusive ends                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unchanged nonreturning boing | `a078f81092528beff9388204690ff67a207a6082a3b3c84f791385a5cd41ec58` | Entry `$080D–$0953` =326B; main `$0953`; snapshot `$2400–$2431` =49B. No restore interval, as independently proved nonreturning. Matches the earlier measured PRG identity. |
| Returning display witness    | `204f87236e77e7181f2ab4f6765ccaf276120177d60292791d5ed86887f4c6b0` | Entry `$080D–$0953` =326B; main `$0953`; restore `$095B–$0A74` =281B including RTS; snapshot `$0A74–$0AA5` =49B.                                                            |

Actual `.labels` identities include:

| Symbol                                                                    | Boing   | Returning witness |
| ------------------------------------------------------------------------- | ------- | ----------------- |
| `b65_startup_73746172747570`                                              | `$080D` | `$080D`           |
| `b65_startup_block_0_737461727475702e656e747279`                          | `$080D` | `$080D`           |
| `b65_platform_startup_state_706c6174666f726d2e737461727475702d7374617465` | `$2400` | `$0A74`           |
| `b65_startup_block_1_737461727475702e726573746f7265`                      | Absent  | `$095B`           |

## Actual capture and mapping forms

Both artifacts capture at `$0820` and consume at `$0920`. The probe requires each complete byte
pattern to occur exactly once within the final entry interval. It validates the snapshot address
operands from that artifact's own memory interval, rather than assuming a common fixed home.

| Segment               | Boing bytes                           | Returning bytes                 |
| --------------------- | ------------------------------------- | ------------------------------- |
| Capture10B at `$0820` | `A6 00 8E 05 24 A4 01 8C 06 24`       | `A6 00 8E 79 0A A4 01 8C 7A 0A` |
| Mapping12B at `$0920` | `98 29 F8 09 06 85 01 8A 09 07 85 00` | Identical                       |

The actual public assembly spells explicit ACME operand widths:

```asm
  ldx+1 $00
  stx+2 b65_platform_startup_state_706c6174666f726d2e737461727475702d7374617465 + $0005
  ldy+1 $01
  sty+2 b65_platform_startup_state_706c6174666f726d2e737461727475702d7374617465 + $0006
; Existing A-only snapshots intervene.
  tya
  and #$f8
  ora #$06
  sta+1 $01
  txa
  ora #$07
  sta+1 $00
```

The intervening-snapshot comment above is explanatory; the eleven instruction lines are copied
from the published assembly. Actual opcodes confirm zero-page CPU accesses, absolute snapshot
stores and one-byte transfers after final placement. No instruction is inferred from size alone.

## Complete bounded entry and restore byte excerpts

Boing's complete326-byte startup entry:

```text
8d00248e01248c022408688d0324ba8e0424d8a6008e0524a4018c0624ad18d08d0824ad15d08d0924ad10d08d0a24ad17d08d0b24ad1bd08d0c24ad1cd08d0d24ad1dd08d0e24ad20d08d0f24ad21d08d1024ad00d08d1124ad01d08d1224ad02d08d1324ad03d08d1424ad04d08d1524ad05d08d1624ad06d08d1724ad07d08d1824ad08d08d1924ad09d08d1a24ad0ad08d1b24ad0bd08d1c24ad0cd08d1d24ad0dd08d1e24ad0ed08d1f24ad0fd08d2024ad27d08d2124ad28d08d2224ad29d08d2324ad2ad08d2424ad2bd08d2524ad2cd08d2624ad2dd08d2724ad2ed08d2824adf8078d2924adf9078d2a24adfa078d2b24adfb078d2c24adfc078d2d24adfd078d2e24adfe078d2f24adff078d30249829f8090685018a09078500ad02dd8d072429fc8d02dda9148d18d0a9008d15d08d17d08d1bd08d1cd08d1dd08d20d08d21d0
```

Returning witness's complete281-byte restoration interval, including final RTS:

```text
ad7c0a8d18d0ad7d0a8d15d0ad7e0a8d10d0ad7f0a8d17d0ad800a8d1bd0ad810a8d1cd0ad820a8d1dd0ad830a8d20d0ad840a8d21d0ad850a8d00d0ad860a8d01d0ad870a8d02d0ad880a8d03d0ad890a8d04d0ad8a0a8d05d0ad8b0a8d06d0ad8c0a8d07d0ad8d0a8d08d0ad8e0a8d09d0ad8f0a8d0ad0ad900a8d0bd0ad910a8d0cd0ad920a8d0dd0ad930a8d0ed0ad940a8d0fd0ad950a8d27d0ad960a8d28d0ad970a8d29d0ad980a8d2ad0ad990a8d2bd0ad9a0a8d2cd0ad9b0a8d2dd0ad9c0a8d2ed0ad9d0a8df807ad9e0a8df907ad9f0a8dfa07ada00a8dfb07ada10a8dfc07ada20a8dfd07ada30a8dfe07ada40a8dff07ad7b0a8d02ddad7a0a8501ad790a8500ae780a9aad770a48ad740aae750aac760a2860
```

Its final CPU/caller restoration decodes to captured port `$0A7A` then direction `$0A79`, saved
SP `$0A78`/TXS, saved status `$0A77`/PHA, caller A/X/Y `$0A74/$0A75/$0A76`, PLP and RTS. This
does not reconstruct any hidden input latch or promise arbitrary firmware state remains immutable.

The private evidence script initially missed ACME's `+1` suffix in its assembly-text adapter.
That temporary regex alone was corrected; raw byte-pattern checks had succeeded. No production
or frozen-test change follows that diagnostic. The validated public extraction passes, with both
PRG identities/ranges above. Full checkpoint, physical behavior, whole-frame cycles and external
interrupt/firmware completion bounds remain separate/unproved.
