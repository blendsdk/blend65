# Impossible masked comparison fold — execution plan

> **Owner**: issue [#151](https://github.com/blendsdk/blend65/issues/151).
> **Scope mode**: strict. No new pass, runtime or source workaround.

## Problem

A masked comparison whose constant needs a bit the mask clears is statically impossible. The
compiler still emits the mask, the `EOR #C` and the expert Boolean branch:

```asm
lda $dd0d
and #$0e
eor #$03
beq true
lda #$01
eor #$01
sta flag
```

For `(read & 14) == 3`, the expert emits only the single read and the constant Boolean:

```asm
lda $dd0d
lda #$00        ; #$01 for !=
sta flag
```

## Decision

- When the selected byte-mask test has a compile-time mask and
  `(constant & ~mask & 0xff) != 0`, the comparison is impossible.
- The already-emitted operand read stays as the single read; the `AND` is suppressed and the
  comparison materializes the constant Boolean: `0` for `==`, `1` for `!=`.
- A reachable constant, a runtime mask, a zero mask or a non-materialized comparison keeps the
  ordinary mask/`EOR`/branch sequence.
- The fold is a local byte-mask fact; word-mask impossibility is not claimed in this slice.

## Tasks

- [x] T-151.1 Record the current mask/`EOR`/branch sequence.
- [x] T-151.2 Add the impossible byte-mask branch in the mask lowering.
- [x] T-151.3 Materialize the constant Boolean after the preserved single read.
- [x] T-151.4 Add implementation tests for `==`, `!=`, the reachable control and a runtime mask.
- [x] T-151.5 Add the four-profile assembly oracle, the cost pin and the native behavior cases.
- [x] T-151.6 Compiler and host checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Impossible `==` | One ICR read, then `lda #$00`; no `and #$0e`, no `eor #$03`. |
| Impossible `!=` | One ICR read, then `lda #$01`; no mask or `EOR`. |
| Reachable | `and #$0e` and `eor #$02` remain. |
| Runtime mask | The fold does not trigger. |
| Runtime | The stored branch value is 0 for `==` and 1 for `!=` on four profiles. |
| Cost | The folded witness is 655/653/641, zero-page 0, scratch 0. |

## Residuals

| Residual | Owner |
| --- | --- |
| Impossible word-mask comparisons | not folded by this slice |
| Volatile read count/order | preserved by the existing single read; assembly oracle pins it |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
