# Symbolic block-index immediate fold — execution plan

> **Owner**: issue [#160](https://github.com/blendsdk/blend65/issues/160).
> **Dependency**: the #74 automatic 64-byte alignment inference.
> **Scope mode**: strict. No frozen `spec/` change, no runtime, no source restriction.

## Problem

`lo(&buffer / 64)` is correct after the #74 alignment repair, but it is computed at runtime from
the link-time address: pointer staging, six `LSR`/`ROR` pairs and a scratch copy. The witness's
`Game.main` is 66 bytes / about 112 nominal cycles. The expert form is
`LDA #<(buffer/64); STA $07F8`: 5 bytes / 6 cycles, no scratch, ZP or stack.

## Decision

- A `lo` whose operand is a `>> 6` or `/ 64` of one automatic global address, used exactly once,
  lowers to a layout-resolved block-index immediate.
- The symbolic address and the block-index result both stay as link-time labels: the address value
  emits no pointer staging, and the `lo` passes the symbolic byte to its consumer, which emits one
  `lda #<block` and the existing store.
- The layout pass resolves the label with `(placedAddress >> 6) & 0xff` after final placement.
- Explicit placement, zero-page storage, a nonzero field offset, a runtime index, a second use,
  `lo(&buffer)`, `hi(&buffer)` and non-block arithmetic keep the ordinary path.
- A misaligned address is not folded; the layout check is a fail-closed safety net.

## Tasks

- [x] T-160.1 Reproduce the witness and the unchanged controls.
- [x] T-160.2 Author the assembly/cost oracle; confirm the pre-change runtime sequence.
- [x] T-160.3 Lower the symbolic address and block result as labels; fold in the layout pass.
- [x] T-160.4 Add implementation tests for the fold and the non-fold controls.
- [x] T-160.5 Independent review for correctness, semantics and emitted output.
- [x] T-160.6 Host checkpoint; wave-level full checkpoint; closeout and issue evidence.

## Acceptance

| Area | Oracle |
| --- | --- |
| Witness | `Game.main` contains one `lda #<imm>` and `sta $07f8`, with no `lsr`/`ror` or pointer staging. |
| Cost | Accepted artifact PRG 631, program 629, code 617, zero-page 0, scratch 0. |
| `lo(&buffer)` | The ordinary pointer path is unchanged. |
| `hi(&buffer)` | Not folded. |
| Dynamic index | Not folded. |
| Non-block arithmetic | Not folded. |
| Explicit/zero-page/misaligned | The ordinary path remains; no new rejection. |

## Residuals

| Residual | Owner |
| --- | --- |
| VIC-visible asset folds | existing VIC field transform, unchanged |
| Non-`lo` block consumers | not folded by this slice |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
