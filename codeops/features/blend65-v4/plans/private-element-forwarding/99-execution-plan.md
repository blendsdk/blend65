# Private element forwarding — execution plan

> **Owner**: issue [#154](https://github.com/blendsdk/blend65/issues/154), byte-element slice.
> **Scope mode**: strict. No frozen `spec/` change, no runtime, no source restriction.

## Problem

A partial private array `let a: byte[2] = [7]; poke($C000, a[0])` stores the supplied element and
then reloads it:

```asm
lda #$07
sta a[0]
lda a[0]
sta $C000
```

The expert keeps A: `lda #7; sta a[0]; sta $C000`, saving 3 bytes / 4 cycles.

## Decision

Add the exact aggregate-element adjacency fact:

- The last supplied constant element of a partial private array aggregate is left in A by the
  construction.
- A following load of that exact element, used only by an adjacent constant-address raw write or
  another safe single-use consumer, consumes A without a reload.
- Global/parameter roots, dynamic indices, a dynamic raw destination and non-adjacent consumers keep
  the ordinary reload.
- The word element case is not claimed: the word construction leaves the high byte in A, so the
  byte-forwarding rule does not apply.

## Tasks

- [x] T-154.1 Reproduce the byte witness and the global/dynamic/runtime barriers.
- [x] T-154.2 Add the aggregate-element forwarding fact and the store-load adjacency.
- [x] T-154.3 Add the four-profile assembly oracle and the cost pin.
- [x] T-154.4 Record the word-element residual.
- [x] T-154.5 Compiler and host checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Byte element | `lda #7; sta a[0]; sta $C000`; no reload. |
| Global element | The reload remains (observable storage). |
| Dynamic raw destination | The reload remains. |
| Runtime-index store | The reload remains. |
| Word element | **Open** — the word construction leaves the high byte in A. |
| Cost | Byte artifact 634/632/620, zero-page 0, scratch 0 (from 637/635/623). |

## Residuals

| Residual | Owner |
| --- | --- |
| Word element forwarding | #154; the word construction leaves the high byte in A |
| Non-constant element values | not claimed |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
