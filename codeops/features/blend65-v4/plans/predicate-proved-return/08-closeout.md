# Predicate-proved terminal return — blocked closeout

> **Issue**: [#133](https://github.com/blendsdk/blend65/issues/133)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Status**: Blocked on the layout zero-growth gate; code reverted
> **Recorded**: 2026-11-15

## Prototype result

A dominating-edge predicate fact was implemented and verified:

- The `seed == 0` true edge gives the bridge `seed ∈ [0,0]`; the later `seed >= 5` evaluates false.
- The bridge block returns the selected constant directly: `lda #$02; rts`.
- The target comparison remains for the `seed >= 5` and wide-range paths.
- Behavior is unchanged: the witness returns 2 on the default `seed=0, other=4`.

## Blocker

The issue's zero-byte claim depends on replacing a three-byte `JMP` bridge. In the current layout
the bridge's control transfer is a fallthrough (zero bytes), so emitting the three-byte return grows
the artifact **261 → 264 bytes**. A size-first compiler cannot accept a three-byte regression for an
11-cycle win. The specialization must be selected at the layout seam, where an actually emitted
`jmp` can be replaced and the complete artifact size can be checked for zero growth.

The prototype was reverted; no code, limit, oracle, `spec/` or ledger change remains. The issue
stays open.

## What closes it

1. A layout-level pass that finds the emitted `jmp` to the proved terminal branch, replaces only
   that instruction with the constant return, and rejects the specialization if any branch
   displacement, fallthrough or padding grows the artifact.
2. Reuse the semantic edge fact as a layout annotation; do not re-derive it from machine text.

Both keep the independent behavior and assembly/cost oracles, the existing 963/725 and behavior/
resource limits, and the `none` canonical output.
