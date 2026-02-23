# Optimization Pass 2: Remaining Spinning-Line Diagnostic Fixes

> **Feature**: 5 compiler optimization fixes identified by enhanced diagnostic
> **Status**: Planning Complete
> **Created**: 2026-02-16
> **Source**: Enhanced `diag_app` analysis of spinning-line after compiler-wide-optimizations plan completion

## Overview

After completing the `compiler-wide-optimizations` plan (30/30 tasks), a re-run of the enhanced diagnostic on `spinning-line` revealed 5 remaining optimization deficiencies. These are deeper issues that require more sophisticated compiler techniques: IL-level shift narrowing for N<8, profitable inlining at size-optimization levels, and better post-inlining parameter handling.

## Bug Summary (from diagnostic)

| Bug | Category | Severity | Affected Levels | Description |
|-----|----------|----------|-----------------|-------------|
| #1 | REDUN | High | O0, O1 | Store/reload of word params (`STA $07/STX $08/LDA $07/LDX $08`) |
| #2 | REDUN | High | O2 | Dead param stores after inlining (`STA $07/STX $08` never read) |
| #3 | MISSOPT | High | O2 | Size regression: O2=513B vs O0=449B (inlining without addr-expr folding) |
| #4 | REDUN | High | O3 | Adding constant 0 (inlined param value=0 not propagated) |
| #5 | REDUN | High | O3 | Param slot shuffle: `LDA $06/STA $02/.../ADC $02` could be `ADC $06` |

## Proposed Fixes

| Fix | Theme | Compiler Stage | Addresses Bugs |
|-----|-------|---------------|----------------|
| **1** | SHR_WORD+LO shift-left (N=3-7) | IL Peephole + Codegen | #3 (reduces shift cost) |
| **2** | Profitable inlining at Os/Oz | Optimizer Config + Inliner | #3 (enables folding at size levels) |
| **3** | Post-inlining dead store elimination | IL Peephole | #1, #2 |
| **4** | Parameter slot forwarding in inlined code | IL Peephole / Constant Prop | #5 |
| **5** | Constant propagation through inlined params | Constant Prop | #4 |

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Fix requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current capabilities and gaps |
| 03 | [SHR_WORD+LO Shift-Left](03-shr-word-lo.md) | IL peephole + codegen for shift-left technique |
| 04 | [Profitable Inlining](04-profitable-inlining.md) | Size-profitable inlining at Os/Oz |
| 05 | [Post-Inlining Cleanup](05-post-inline-cleanup.md) | Dead stores, param forwarding, const prop |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Key Decisions

| Decision | Outcome |
|----------|---------|
| SHR_WORD+LO approach for N<8 | Shift-left technique via new IL opcode `SHR_WORD_LO` |
| Os/Oz inlining | Profitable-only mode with size-reduction check |
| Dead param store fix | Extend IL peephole store/reload patterns |
| Param forwarding | Copy propagation improvement |
| Const prop fix | Enhance const-prop to handle inlined label boundaries |

## Related Files

- `packages/compiler/src/optimizer/passes/il-peephole.ts` — IL peephole (Fix 1, 3)
- `packages/compiler/src/codegen/generator/bitwise.ts` — SHR_WORD codegen (Fix 1)
- `packages/compiler/src/optimizer/options.ts` — Optimization level config (Fix 2)
- `packages/compiler/src/optimizer/passes/function-inlining.ts` — Inliner (Fix 2)
- `packages/compiler/src/optimizer/passes/constant-prop.ts` — Constant propagation (Fix 4, 5)
- `packages/compiler/src/optimizer/passes/copy-prop.ts` — Copy propagation (Fix 4)
- `packages/compiler/src/il/enums.ts` — IL opcodes (Fix 1)
