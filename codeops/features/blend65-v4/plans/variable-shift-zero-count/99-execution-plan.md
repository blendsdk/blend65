# Variable shift zero-count reuse — execution plan

> **Owner**: issue [#131](https://github.com/blendsdk/blend65/issues/131).
> **Scope mode**: strict. No new pass, runtime, harness or source workaround.

## Problem

For `let count: byte = seed & 7; answer = 1 << count;` the count's mask bound is not proved in a
straight-line block, so the compiler emits the full saturation tests and loads X before the
immediate:

```asm
ldx count
lda #$01
cpx #$08
bcs saturated
cpx #$00
beq continue
```

The issue's win is `lda #value; ldx count; beq` with a bounded count, plus the existing six-byte
fresh-flags shift kernel.

## Decision

- The straight-line shift consumer proves a private local's mask/conversion bound from its
  dominating store in the same block, even when no comparison edge exists. A call, escaping raw
  write, aggregate/pointer store or reassignment clears the bound.
- With the complete 0..7 bound, the saturation tests and their block disappear.
- When the count is addressable (not a live register), load the left value first and `LDX` the
  count last: X holds the count and its fresh N/Z feeds the zero gate, removing `CPX #0`.
- A live count register would need `TAX` and clobber A; it keeps the conservative order. The
  bounded but non-fresh path keeps its six-byte BEQ/shift kernel, which the issue already accepts
  as smaller than the seven-byte `DEX`/`BMI` countdown.
- Unbounded counts, word counts, an intervening escaping write and reassignment keep both
  saturation tests and the bounded fill path.

## Tasks

- [x] T-131.1 Record the current `LDX; LDA; CPX #8; BCS; CPX #0` sequence.
- [x] T-131.2 Prove a straight-line private count bound from its dominating store.
- [x] T-131.3 Load an addressable value before the count and reuse the fresh LDX zero flag.
- [x] T-131.4 Add implementation tests for the bounded, unbounded, escaping-write, reassignment
      and word-count cases.
- [x] T-131.5 Add the four-profile assembly oracle, the cost pin and the native behavior cases.
- [x] T-131.6 Compiler and host checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Bounded left | `lda #$01; ldx count; beq; asl; dex; bne`, no `cpx #$08` or `bcs`. |
| Bounded right | The same order with `lsr`, no saturation tests. |
| Unbounded | Both `cpx #$08`/`bcs` tests remain and `ldx` precedes the immediate. |
| Reassignment | Both saturation tests return. |
| Escaping raw write | Both saturation tests return. |
| Word count | The high-byte path and saturation tests remain. |
| Runtime | Counts 0, 1, 7, 8 and the word path return the expected bytes. |
| Cost | Bounded witness 124/122/110, zero-page 0, scratch 0 (from 135). |

## Residuals

| Residual | Owner |
| --- | --- |
| Seven-byte `DEX`/`BMI` countdown for a bounded non-fresh count | not needed for this witness; the six-byte fresh kernel is smaller |
| Cross-block count bounds | same-block dominating store only |
| Global count bounds | globals stay unstable; no private-locality proof |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
