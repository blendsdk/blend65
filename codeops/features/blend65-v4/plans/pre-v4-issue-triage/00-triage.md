# Pre-v4 issue triage

> **Scope**: issues filed against the v3 compiler and audit program: `#49`, `#51`–`#64`,
> `#67`, `#69`–`#73`.
> **Method**: each item was re-probed against the current v4 build (`ac5689ab`) with real public
> CLI projects and emitted assembly. A v3 report is not scheduled merely because it is open.
> **Date**: 2026-11-14

## Result

| Issue | Class | Evidence |
| --- | --- | --- |
| #49 Epic: memory and hardware access | Live epic, partly delivered | v4 has `place(at/align/noCross/region)`, typed platform capabilities and resident assets. The epic's remaining `copy()` and ergonomic rows need a fresh gap list before scheduling. |
| #51 Block layout: fall-through JMPs | Fixed | A real `if/else` lowers with the false arm and join contiguous; no `JMP` targets the next instruction and there are no jump-only blocks. The remaining true-arm jump to the join is a real transfer, not fall-through. |
| #52 Seed the RD-08 peephole catalog | Superseded | v4 RD-08 optimizes structured machine IR and explicitly excludes ACME-text peepholes; RD-08 is closed. The v3 text-peephole catalog has no v4 owner. |
| #53 Register-resident loop counters | Live | A ten-iteration byte loop keeps `i` at `$0ad8` and reloads/stores it on every update and test; no register residency. |
| #54 Expression/intrinsic completeness | Needs re-probe | The v4 intrinsic surface is larger than v3's, but no single current gap list exists. Keep as an umbrella until each intrinsic shape is re-probed. |
| #56 Prime Directive audit program | Tracking epic | Still the correct umbrella for the sweep method; not an implementation unit. |
| #57–#64 Sweeps A–H | v3-era audit method | The v4 redesign replaced the audited pipeline and the RD-08 optimizer is structured-IR based. Keep for historical traceability, not scheduled; live defects are tracked separately. |
| #67 Build-summary segment sizes | Stale | v4 `build` and `evidence` print no segment-size summary with all-zero ranges; resource reporting is generation/artifact based. The reported lines no longer exist. |
| #69 Const data page alignment | Stale | v4 places a 64-byte const image at `$0abd` with `alignmentBytes: 1`, not a 256-byte boundary; the reported 193 bytes of padding do not exist. |
| #70 Local constant propagation and DSE | Live | Loop/multiply witnesses still stage results through scratch (`sta $0ad6; lda $0ad6; sta sum`) and reload known values. |
| #71 Non-power-of-2 multiply shift-and-add | Fixed | `value * 10` lowers to `ASL/ADC` with `W10172`; `value * 8` lowers to three `ASL` with no warning. The missing path and the inverted warning are both gone. |
| #72 Boing-ball parity twin | Live | No `examples/boing-ball` or equivalent fixture exists in the v4 tree. |
| #73 `lo`/`hi` scratch slot | Live, reframed | v4 still stages `lo(&buffer)` through `$02/$03` and a word scratch home (`$0b29`), so the exact "never touched" wording is stale but the output is still not the expert `LDA #<label`. |

## Not scheduled from this list

The v3 sweep epics and `#49`/`#56` remain traceability anchors. The delivery order starts from
re-probed, currently reproducible defects; it does not schedule every open v3 issue.
