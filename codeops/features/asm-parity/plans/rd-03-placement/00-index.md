# Implementation Plan: Placement — Align Const Data and Read It In Place

> **Implements**: asm-parity/RD-03
> **Source**: [RD-03](../../requirements/RD-03-placement.md)
> **Issue**: [#49](https://github.com/blendsdk/blend65/issues/49) (placement slice)
> **Status**: Plan Created
> **Created**: 2026-07-20
> **Routing tag**: complex (Phase 2: sensitive)
> **CodeOps Skills Version**: 3.11.0

---

## What this delivers

A `const` array whose address is taken with `&` is emitted at a 256-byte boundary, so hardware can
read it where it already lies instead of being handed a copy. `examples/balloon` stops copying its
sprite 63 bytes at a time into `$0340` and points the VIC at the embedded data itself.

| # | Change | Seam | File |
|---|--------|------|------|
| 1 | **`align` directive** — a new `AcmeDirective` variant, plus its three exhaustive-switch arms | instruction model | `core/src/instr-model/stream.ts`, `codegen/src/instr/print-instr.ts` |
| 2 | **Address-taken marking** — a symbol set filled at the `&` site, surfacing as `ConstDataEntry.aligned` | IL lowering | `codegen/src/il/lower.ts`, `codegen/src/il/cfg.ts` |
| 3 | **Emission** — the directive prepended to its own stream's entries | stream construction | `codegen/src/instr/instr-program.ts` |
| 4 | **Balloon rewrite** — 63 staging pokes deleted; pointer from `hi(&BALLOON) * 4` | example | `examples/balloon/main.blend` |
| 5 | **Observable split** — the shared twin contract shrinks to source-mandated rows | test harness | `test-harness/src/testing/balloon.ts`, `src/balloon.spec.test.ts` |
| 6 | **Corpus supersession** — ratchets, scoreboard, twins routing prose | — | — |

### Measured outcome, verified at planning time

| Build | Bytes | `__data_Main_BALLOON` |
|---|---|---|
| balloon today | 677 | `$0A67` |
| pokes removed, pointer computed | 312 | `$08FA` |
| **+ page alignment** | **318** | **`$0900`** → sprite block 36 |

**677 → 318 bytes, 2.70× → 1.27×** against the twin's 251, with the runtime copy gone entirely.
The compiler beats the twin at **runtime** — the twin still copies 63 bytes at startup — and
remains behind it on bytes. Both statements belong in the closeout; neither survives alone.

## Document map

| Document | What it owns |
|---|---|
| [00-ambiguity-register.md](00-ambiguity-register.md) | The 7 plan-stage decisions (AR #69–#75) — **gate passed** |
| [01-requirements.md](01-requirements.md) | Scope, M1–M7 ↔ AC mapping, what is explicitly out |
| [02-current-state.md](02-current-state.md) | What exists today, measured; the traps the preflight found |
| [03-01-directive-and-marking.md](03-01-directive-and-marking.md) | The directive, the exhaustive switches, the marking rule |
| [03-02-balloon-and-corpus.md](03-02-balloon-and-corpus.md) | The rewrite, the observable split, corpus supersession |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-C1…ST-C18 specification tests, per tier |
| [99-execution-plan.md](99-execution-plan.md) | 5 phases, 41 tasks |

## The load-bearing decision

**The mechanism lands before the balloon rewrite, and its acceptance is that nothing moves**
(AR #73). No fixture takes a const array's address today, so a correct implementation is a
provable no-op: all 14 goldens must come out byte-identical.

That is not ceremony. The preflight's most dangerous finding (PF-001) was that `&X` and an
ordinary **by-reference array argument** emit the *same* IL `addrOf` operand — an implementation
that scanned IL rather than the `&` site would align `slice7b` and `slice8b` (+435 bytes) and try
to page-align `slice8`'s function labels. Phasing it this way means a wrong rule is caught by a
byte-exact oracle in the phase whose whole assertion is that the oracle does not move, rather than
being discovered tangled up in balloon's own 359-byte delta.

## Prime Directive check

The emitted result is the idiom a 6502 developer writes: data placed where the VIC reads it, a
sprite pointer computed from the data's own address, and no copy loop. One divergence is knowingly
carried and attributed rather than hidden — `hi(&X) * 4` materializes the full address into a
frame-slot pair before taking its high byte (8 instructions against a hand-coder's 4) and emits a
`W10172` warning about a shift-and-add sequence it does not actually generate. That is a
constant-materialization defect, routed to #58/#60 (AR #67), not a placement one.
