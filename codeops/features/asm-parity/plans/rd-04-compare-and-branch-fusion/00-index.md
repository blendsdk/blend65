# RD-04 Compare-and-Branch Fusion — Implementation Plan

> **Feature**: Fused compare-and-branch IL terminator (`brcmp`) + slot-free condition-position
> lowering, superseding the materialize-reload-retest condition idiom across the corpus
> **Status**: Planning Complete
> **Created**: 2026-07-19
> **Implements**: asm-parity/RD-04
> **CodeOps Skills Version**: 3.9.0

## Overview

Every condition today pays for its comparison twice: the five comparison framings materialize a
0/1 byte in A, and `brcond` reloads and retests it. This plan implements RD-04: the IL gains a
fused `brcmp` terminator (plan-AR #4) carrying `{op, left, right, type, trueTarget, falseTarget}`;
a branch-context recursion in lowering routes every `if`/`while`/`do-while`/`for`/`switch`-dispatch
condition into it — comparisons fuse, `!` swaps targets for free, `&&`/`||` become short-circuit
CFG edges with no synthetic-slot claim, boolean literals fold to `br` — and the four translator
framings gain branch-form terminals that jump straight to real block targets. Value contexts keep
today's materialization untouched.

The work lands in five phases (plan-AR #1): IL terminator infrastructure (with the new
dangling-target ICE and shared successor enumeration, plan-AR #2), translator branch-form
framings, the new `guards` acceptance fixture authored BEFORE the flip (its hand-written twin
stays blind to fused output — the parity bar, not a transcription), then the atomic flip —
condition lowering + SFA adapter + full corpus supersession in one phase — and closeout with the
measured before/after delta record. Every phase ends verify-green; the corpus is red only inside
phase 4, never at its boundary.

Expected effect: the raster-poll condition drops from 9 instructions / ~17 cycles to the exact
4-instruction fused form (RD-04 AC-1); compound guards lose their frame-slot diamonds; the
6.51× cycle baseline moves corpus-wide. The remaining gap to the 3-instruction expert idiom is
RD-05's jump threading (req-AR #20 — out of scope here).

## Document Index

| #   | Document                                       | Description                                 |
| --- | ---------------------------------------------- | ------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (7 plan items, all resolved; req-AR imports) |
| 00  | [Index](00-index.md)                           | This document — overview and navigation     |
| 01  | [Requirements](01-requirements.md)             | Thin delta view onto RD-04 (the owning RD)  |
| 02  | [Current State](02-current-state.md)           | The materialize-reload-retest pipeline today, gaps, risks |
| 03-01 | [IL Terminator & Validation](03-01-il-terminator-and-validation.md) | `brcmp` type, printer, successor helper, termination analysis, dangling-target ICE |
| 03-02 | [Translator Branch-Form Framings](03-02-translator-branch-framings.md) | The four framings' branch-form terminals; use-count plumbing |
| 03-03 | [Condition Lowering & SFA](03-03-condition-lowering-and-sfa.md) | `lowerCondition` recursion, literal fold, statement rewiring, position-dependent slot predicate |
| 03-04 | [Guards Fixture & Corpus Supersession](03-04-guards-fixture-and-corpus.md) | The `guards` fixture/twin/observables; golden regen, budgets, scoreboard mechanics |
| 07  | [Testing Strategy](07-testing-strategy.md)     | ST-cases and verification tiers             |
| 99  | [Execution Plan](99-execution-plan.md)         | Phases, sessions, and task checklist        |

## Quick Reference

### The shape this plan produces

```asm
; while (peek($D012) != 251) { }   — RD-04 AC-1 (was 9 instructions / ~17 cycles)
cond:  LDA $D012
       CMP #$FB
       BNE body        ; fused: compare flags feed the branch directly
       JMP end
```

### Key Decisions

| Decision | Outcome |
| -------- | ------- |
| Terminator name | `brcmp` (plan-AR #4) |
| Fixture name + timing | `guards`, authored before the flip (plan-AR #5, #1) |
| Dangling-target ICE | Translation-start pre-pass + shared `terminatorTargets()` (plan-AR #2) |
| Recursion home | `lower.ts`, in place (plan-AR #3) |
| Should-Haves | Both in scope (plan-AR #7) |
| Mechanism / scope bars | Owned by the RD — req-AR #20–#25 |

## Related Files

- `packages/codegen/src/il/instruction.ts`, `cfg.ts`, `print-il.ts`, `termination.ts` — `brcmp` + successors
- `packages/codegen/src/instr/translate.ts` — branch-form framings, target validation pre-pass
- `packages/codegen/src/il/lower.ts` — `lowerCondition` recursion + statement rewiring
- `packages/frontend/src/sfa/model-adapter.ts` — position-dependent slot predicate (AST-side only; R15 intact)
- `examples/guards/` + `packages/test-harness/` — new fixture pair, corpus supersession surface
