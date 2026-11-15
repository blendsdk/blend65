# Partial-initializer startup inlining — measured non-win

> **Issue**: [#155](https://github.com/blendsdk/blend65/issues/155)
> **Status**: Documented non-win; the issue remains the tracked startup-selection debt
> **Recorded**: 2026-11-15

## Measurement

`let values: byte[3] = [9];` currently emits:

```asm
jsr b65_Game_values_init
; ...
b65_Game_values_init:
  lda #$09
  sta values
  rts
```

| Form | Bytes | Nominal cycles |
| --- | ---: | ---: |
| Current call wrapper | 9 | 18 |
| Inline store sequence | 5 | 6 |
| Gap | **4** | **12** |

The witness artifact is 639 payload bytes. The supplied element is stored correctly; the omitted
tail is untouched.

## Attempted slice and blocker

A bounded inline selection was implemented: when the runtime initializer lowers to one block of
`lda #imm` / `sta` instructions with no discovered storage or helper demand, the body is emitted
inline at the startup site and the routine call is dropped. The witness reached the inline form, but
the public build failed `ARTIFACT_EVIDENCE`: the initializer's source spans no longer map to an
emitted machine function, so evidence preparation rejects the program. Keeping the routine for
evidence restores the bytes, so the inline win and the evidence mapping are coupled.

The change was reverted. Delivering it needs an explicit evidence mapping for inlined initializer
sites (or a reference-only initializer function), which is a separate evidence change rather than a
startup-selection tweak.

## Acceptance disposition

| Acceptance | State |
| --- | --- |
| Independent assembly/cost expectation | Current 9 / 18 and expert 5 / 6 recorded. |
| 4-byte / 12-cycle reduction or a measured documented non-win | **Measured non-win**: 4 bytes / 12 cycles. |
| Initializer order, effects and startup oracles | Unchanged; no code change. |
| Effectful initializers | Unchanged. |

## Next unit

Couple the inline initializer instructions to an evidence mapping (reference-only function or an
explicit inlined-site record), then select the inline form. Keep the indeterminate tail, order and
effects unchanged. Owner: #155.
