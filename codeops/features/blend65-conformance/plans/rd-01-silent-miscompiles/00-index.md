# RD-01 Silent Miscompiles — Implementation Plan

> **Feature**: blend65-conformance — kill the four silent-miscompile classes that compile clean and run the wrong machine code
> **Status**: Planning Complete
> **Created**: 2026-07-22
> **Implements**: blend65-conformance/RD-01
> **CodeOps Skills Version**: 3.11.0

## Overview

Four defect classes let legal Blend65 source compile with zero diagnostics and emit code that
does the wrong thing on the machine — a loop that never terminates, a `poke` that clobbers the
neighbouring MMIO register, a frame slot sized to the wrong declaration, and an interrupt handler
that corrupts a mainline call's locals. On a C64 there is no debugger to catch any of them, and
the shapes are the first loop and the first hardware write anyone writes. RD-01 ships first and
alone: every downstream measurement in this feature and in the asm-parity lane assumes generated
code means what the source says.

This plan implements the RD across five phases — the loop-exit mechanism (M-01) first because its
instances are one mechanism, then the three independent codegen surfaces (M-02, M-03, M-04) in any
order, then a closeout that discharges the ledger, the scoreboard, and the deferral-expiry gate.
Every design decision is already fixed by the RD's AR-1…AR-10; this plan adds only the six
plan-level `AR-P#` decisions in the register and the phase/test structure.

## Document Index

| #   | Document                                       | Description                                 |
| --- | ---------------------------------------------- | ------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Plan-level Zero-Ambiguity decisions (AR-P#) |
| 00  | [Index](00-index.md)                           | This document — overview and navigation     |
| 01  | [Requirements](01-requirements.md)             | Delta view over RD-01 (the owning doc)      |
| 02  | [Current State](02-current-state.md)           | The six touch-points, grounded at HEAD      |
| 03-01 | [Loop exit (M-01)](03-01-loop-exit.md)       | Gated `brcmp` wrap exit + bound stamp       |
| 03-02 | [Poke width (M-02)](03-02-poke-width.md)     | `E10154` value-width diagnostic             |
| 03-03 | [Frame slot (M-03)](03-03-frame-slot.md)     | Widest-slot sizing + per-declaration types  |
| 03-04 | [IRQ warning (M-04)](03-04-irq-warning.md)   | `W10182` shared-frame warning               |
| 07  | [Testing Strategy](07-testing-strategy.md)     | ST-cases traced to RD acceptance criteria   |
| 99  | [Execution Plan](99-execution-plan.md)         | Five phases, spec-tests-first, task checklist |

## Quick Reference

### Usage Examples (the shapes this plan makes correct)

```blend65
for (let i: byte = 9 downto 0) { poke($D020, i); }   // M-01: terminates, visits 0
let w: word = 300; poke($D020, w);                    // M-02: now E10154, no second store
if (c) { let t: word = 300; pokew($D000, t); }        // M-03: wide read emits both bytes
else   { let t: byte = 7; }
```

### Key Decisions (plan-level; RD owns the rest)

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| Phase decomposition | 5 phases, M-01 first, dedicated closeout | AR-P1 |
| Verify cadence | targeted during tasks, full root verify at phase close | AR-P2 |
| Wrap-check pre-step value | reuse already-live in-block `current` temp; no scratch | AR-P3 |
| M-03 pop-3 mechanism | per-use type resolution; positional allocation untouched | AR-P4 |
| Emission gating | frontend-stamped wrap-safe bit; guard emitted only when absent | AR-P5 |
| Re-golden placement | mechanical re-goldens land in their forcing phase (P1); P5 is discharge-only | AR-P8 |

## Related Files

- `packages/codegen/src/il/lower.ts` — loop lowering (M-01), use-site width (M-03 read)
- `packages/frontend/src/semantics/type-check/statement-typing.ts` — bound stamp (M-01/AR-2)
- `packages/frontend/src/semantics/type-check/expression-typing.ts` + `intrinsic-validation.ts` — poke width (M-02)
- `packages/frontend/src/semantics/function-collection.ts` — per-declaration types (M-03)
- `packages/frontend/src/sfa/frame-computation.ts` — widest-slot sizing (M-03)
- `packages/frontend/src/sfa/model-adapter.ts` — IRQ/mainline provenance (M-04)
- `examples/slice8b/` — the one re-goldened corpus loop (AR-10)
- `packages/test-harness/test/golden/expressiveness-ledger.json` — X-07/X-08 retirement
