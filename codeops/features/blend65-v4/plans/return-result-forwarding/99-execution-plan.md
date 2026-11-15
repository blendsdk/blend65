# Return-result forwarding — execution plan

> **Owner**: issue [#124](https://github.com/blendsdk/blend65/issues/124).
> **Scope mode**: strict. No frozen `spec/` change, no runtime, no source restriction.

## Problem

A value defined by the last operation before a `return` of that exact value is still materialized
into a private staging home. The byte and helper returns emit `...; STA temp; LDA temp; RTS`
instead of returning the register directly. The word return has a separate high-byte staging
residual.

## Decision

Add the exact result/sole-return adjacency fact: a value defined by the last operation of a block
whose terminator returns that value is returned in its register without a staging home. The
`retainMachineValue` early-return path consumes the fact. No ABI, caller, stack, alias or
asynchronous contract changes.

The word-return high-byte sequence is **not** part of this slice: it needs the expert low-scratch /
X-high construction in `lower-arithmetic.ts`. The measured residual is recorded rather than
claiming the full word target.

## Tasks

- [x] T-124.1 Reproduce the byte, word and helper witnesses and measure the before/after PRGs.
- [x] T-124.2 Add the last-operation/return adjacency fact.
- [x] T-124.3 Add the public assembly/cost oracle for the byte and helper returns.
- [x] T-124.4 Record the word high-byte residual with its measured delta.
- [x] T-124.5 Compiler and host checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Byte return | `next` emits `lda param; clc; adc #1; rts`; no post-arithmetic staging. |
| Helper return | `calculate` ends the multiply call with `rts`; no post-call staging. |
| Word return | **Open** — high-byte staging remains; measured 0-byte change. |
| Cost | Byte and helper PRGs drop by 6 bytes with no resource growth. |
| Behavior | Four-profile build/assembly oracle; the full compiler/host checkpoints stay green. |

## Residuals

| Residual | Owner |
| --- | --- |
| Word full-width return high-byte staging | #124, `lower-arithmetic.ts` low-scratch/X-high construction |
| Other return-result shapes | not claimed |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
