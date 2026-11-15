# Early raw-byte argument delivery — blocked closeout

> **Issue**: [#135](https://github.com/blendsdk/blend65/issues/135)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Status**: Blocked on the composed-call proof; no code change
> **Recorded**: 2026-11-15

## Measured opportunity

The rule is a private retained byte `t` with one store and one load, retargeted so a raw byte
argument is delivered directly to the callee parameter home. The issue's measured saved-candidate
result is **863 → 857 bytes** and `Game.main` **112 → 106** (6 bytes), with the reference carrying
the same request identity.

## Blocker

`validateComposedLowByte` (in `size-observer-low-byte-composition.ts`, consuming
`size-observer-low-byte-occurrences.ts`) requires each direct-global argument delivery to be one
contiguous four-instruction window followed by a contiguous call suffix. The early retarget moves
the candidate `sta parameter` to the argument-evaluation position, so the suffix is scattered:

- reference call items: pointer delivery, `lda t`, `sta p`, other argument deliveries, `jsr`;
- candidate call items: `sta p` (early), other argument deliveries, `jsr`.

The existing `forwardedReload` path accepts one forwarded reload after an omitted delivery, not this
early retarget. `claim`/`unchanged` compare in-place operand changes position by position, so the
pair cannot be represented by `removed`/`replacements` without a first-class early-delivery fact.
An attempted local allowance moved the first failure from the argument suffix to the main remaining
code, confirming the model change is structural.

## Disposition

No code, observer, limit or oracle was changed. The size mode remains at **863** and `none` remains
canonical. The raw/ABI/effect proof is untouched; this is a blocked optimization, not a silent
6-byte claim.

## What closes it

1. A first-class early-delivery fact: the reference's `lda t; sta p` pair maps to the candidate's
   earlier `sta p`, the rest of the call suffix stays ordered, and `unchanged` exempts exactly that
   pair and its source span.
2. Or a bounded register/argument plan that keeps the delivery at the call position while A survives
   the intervening argument evaluations, avoiding the scattered suffix.

Both must carry the reference's request identity and preserve the complete raw/ABI/effect proof.
Owner: #135; no benchmark-specific exception is permitted.
