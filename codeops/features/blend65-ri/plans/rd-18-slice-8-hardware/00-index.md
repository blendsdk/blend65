# RD-18 Slice 8a — Hardware Implementation Plan

> **Feature**: `&` address-of, `interrupt` functions, `zeropage {}` blocks, non-terminating
> `main`, T1 CPU-control intrinsics end-to-end, and retirement of the 7b by-ref
> argument-place ICEs — the hardware half of RD-18 Slice 8.
> **Status**: Planning Complete
> **Created**: 2026-07-17
> **Implements**: blend65-ri/RD-18
> **CodeOps Skills Version**: 3.8.0

## Overview

Slice 8 is the last codegen slice of the RD-18 rollout. Per AR-1 it is split: **this plan (8a)**
delivers the hardware surface — the `&` address-of operator (the vector-install path), spec-ABI
`interrupt` functions, user `zeropage {}` blocks, automatic non-terminating-`main` startup
selection, and end-to-end proof of the 13 T1 `asm_*` intrinsics — plus the internal address
materialization that retires 7b's two by-ref argument-place ICEs (AR-29). A later **8b** plan
(`rd-18-slice-8b-strings-embed`) owns strings/encoding and `embed()`, and carries the RD-18
rollout-closure phase (AR-3).

The lexer, AST, and parser already cover this entire surface; the work is uniformly in the
analyzer → SFA → IL lowering → translate stages, much of it lighting up pre-plumbed dormant
assets (the user-ZP allocator category, the `"non-terminating"` startup shim, the `addr` IL
operand, the `__zp_irq_tmp` pool). Two miscompile-class holes found during discovery are fixed
here: irq-only helper frames overlapping mainline frames, and IRQ-corruptible mainline spill
temps (AR-15). The acceptance program is a hardened raw-vector raster-interrupt fixture (AR-16)
proven on real VICE 3.10 under the standard three-part bar.

## Document Index

| #   | Document                                         | Description                                    |
| --- | ------------------------------------------------ | ---------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)   | Zero-Ambiguity Gate decisions (29 rows)        |
| 00  | [Index](00-index.md)                             | This document — overview and navigation        |
| 01  | [Requirements](01-requirements.md)               | Scope delta view over RD-18                    |
| 02  | [Current State](02-current-state.md)             | Pipeline-stage analysis per feature            |
| 03-01 | [Address-of](03-01-address-of.md)              | `&` typing, codes, lowering, `isEscaped`       |
| 03-02 | [Interrupt Functions](03-02-interrupts.md)     | Syntax completion, E10050, save/RTI ABI        |
| 03-03 | [SFA Interrupt Path](03-03-sfa-interrupt-path.md) | Irq-reachability, always-live, temp pools, scratch twin |
| 03-04 | [Zeropage Blocks](03-04-zeropage.md)           | Collection, merging, allocator wiring, emission |
| 03-05 | [Startup Termination](03-05-startup-termination.md) | `auto` termination analysis + shim selection |
| 03-06 | [Acceptance Fixture](03-06-acceptance.md)      | Raw-vector raster fixture, golden, VICE, T1 coverage |
| 07  | [Testing Strategy](07-testing-strategy.md)       | ST-cases and verification                      |
| 99  | [Execution Plan](99-execution-plan.md)           | Phases, sessions, task checklist               |

## Quick Reference

### Usage Examples

```blend65
module Main;

zeropage {
  frameCount: byte = 0;      // lands in ZP via the user category (AR-18)
}

interrupt function onIRQ() {   // optional `: void` also accepted (AR-12)
  poke($D019, $FF);            // ack VIC
  bump();                      // irq-only helper — frame kept disjoint (AR-15)
}

function main(): void {
  asm_sei();
  pokew($FFFE, &onIRQ);        // & yields word (AR-10/AR-11); raw vector (AR-16)
  poke($01, $35);
  asm_cli();
  while (true) { }             // auto-selects the JMP _main shim (AR-25)
}
```

### Key Decisions

| Decision | Outcome |
| -------- | ------- |
| Slice split | 8a hardware (this plan) + 8b data; closure rides 8b (AR-1/AR-3) |
| Fixture ABI | Hardened raw-vector install — the RD's `$0314` sketch crashes (AR-16) |
| `&` rejection codes | Mint E10047/E10048/E10049; wire reserved E10042 (AR-10) |
| Interrupt syntax | Optional `: void` accepted; non-void → E10050 (AR-12); `export interrupt` stays E10311 (AR-13) |
| SFA rule | One irq-reachability classification, three consumers (AR-15) |
| Zeropage | Full surface; blocks merge per module; module-var parity; no zero-fill (AR-17/AR-18) |
| Startup | `auto` gains conservative termination analysis (AR-25) |
| By-ref arg places | Runtime-indexed + pair-relative places compile in 8a (AR-29) |
| Out of scope | Six unassigned deferrals stay loud ICEs (AR-4..9); strings/encoding/embed → 8b (AR-19..24/28) |

## Related Files

- `packages/frontend/src/semantics/type-check/expression-typing.ts` — `&` typing arm
- `packages/frontend/src/parser/parse-decl.ts` — interrupt `: void` acceptance
- `packages/frontend/src/semantics/module-variable-collection.ts` — zeropage collection
- `packages/frontend/src/sfa/{interference,model-adapter,zp-allocator,pointer-pairs}.ts` — SFA work
- `packages/codegen/src/il/lower.ts` — `&` lowering, by-ref arg places
- `packages/codegen/src/instr/{translate,register-binding,instr-program}.ts` — ABI, temp pools, shim selection
- `packages/core/src/diagnostics/diagnostic-codes.ts` — E10047/E10048/E10049/E10050 (additive)
- `packages/compiler/src/api/run-frontend.ts` — `zpUserVars` wiring
- `examples/slice8/` + `packages/test-harness/src/testing/slice8*` — acceptance tier
