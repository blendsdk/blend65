# Predicate-proved terminal return — execution plan

> **Owner**: issue [#133](https://github.com/blendsdk/blend65/issues/133), blocked slice.
> **Scope mode**: strict. No new optimizer, runtime, source workaround or limit change.

## Problem

An inherited reachable branch repeats a comparison already proved by the incoming edge:
`seed == 0` on the true edge proves the later `seed >= 5` false, so the bridge can return 2
directly. The issue's actual artifact keeps 252 bytes and saves 11 cycles because the bridge is a
three-byte `JMP` replaced by `LDA #2; RTS`.

## Decision

A dominating-edge predicate fact is sound and was prototyped: the bridge facts include
`seed == 0`, the target comparison evaluates false, and the bridge emits `lda #2; rts`. The pass was
**not enabled** because the current layout does not reproduce the issue's three-byte bridge: the
specialized bridge replaces a fallthrough control transfer in this layout, so the artifact grows
from 261 to 264 bytes. The zero-byte claim requires a layout-level replacement of an actually
emitted `jmp` with a zero-growth check.

## Tasks

- [x] T-133.1 Prototype the dominating-edge fact and the bridge return.
- [x] T-133.2 Verify the behavior and the assembly bridge.
- [x] T-133.3 Measure the artifact delta in the current layout (261 → 264).
- [x] T-133.4 Record the layout zero-growth blocker; leave the code reverted.

## Acceptance

| Area | State |
| --- | --- |
| Behavior | The specialized bridge returns 2; the target remains for other paths. |
| Artifact bytes | **Not met**: 261 → 264 in this layout. |
| Layout zero-growth gate | **Open** — replace only an emitted `jmp`, verify no growth. |
| Current code/limits | Reverted; no limit, oracle or `none` change. |

## Residuals

| Residual | Owner |
| --- | --- |
| Layout-level proven-terminal specialization with zero artifact growth | #133 |
| Edge-fact general dataflow beyond the exact predicate | #133 |

## Constraints

- `spec/`, the ledger and all limits stay unchanged. No test or VICE journey is weakened. No push.
