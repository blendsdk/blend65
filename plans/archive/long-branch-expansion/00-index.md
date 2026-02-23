# Long-Branch Expansion Pass — Implementation Plan

> **Feature**: ASM-IL optimizer pass to expand conditional branches that exceed 6502's ±127 byte range
> **Status**: Planning Complete
> **Created**: 2026-02-18
> **Triggered By**: `diag_app armenian-charset` — O2/O3 ACME assembly failure ("Target out of range")

## Overview

The 6502 CPU's conditional branch instructions (BCS, BNE, BEQ, BCC, etc.) have a limited range of ±127 bytes from the branch instruction. When function inlining at O2/O3 expands loop bodies beyond this range, the ACME assembler reports "Target out of range" errors and the build fails.

This plan implements a **Long-Branch Expansion Pass** that detects potentially out-of-range branches and expands them to an inverted-branch + JMP pattern, which has no range limit.

**Transformation:**
```asm
; BEFORE (may exceed ±127 byte range):
  BCS .endfor12

; AFTER (no range limit):
  BCC .skip_long_N     ; invert condition
  JMP .endfor12        ; absolute jump (no range limit)
.skip_long_N:
```

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [Long-Branch Pass](03-long-branch-pass.md) | Technical specification |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### The Bug

The armenian-charset example has a for-loop calling `plotChar()` and `delay()`. At O2/O3, both functions get inlined, expanding the loop body to ~142 bytes. The `BCS .endfor12` exit branch can't reach the target (15 bytes too far at O2, 7 bytes too far at O3).

### Key Decision

| Decision | Outcome |
|----------|---------|
| Where to fix | New ASM-IL optimizer pass (not codegen changes) |
| When to run | LAST pass at ALL optimization levels (O1+) |
| Distance estimation | Count elements × 2 bytes (conservative average) |
| Threshold | 100 bytes (well within 127 limit, conservative) |

## Related Files

| File | Role |
|------|------|
| `packages/compiler/src/codegen/asm-il/optimizer/passes/long-branch-expansion.ts` | **NEW** — The pass implementation |
| `packages/compiler/src/codegen/asm-il/optimizer/passes/index.ts` | Export the new pass |
| `packages/compiler/src/codegen/asm-il/optimizer/pass-factory.ts` | Register the new pass (runs last) |
| `packages/compiler/src/codegen/asm-il/optimizer/passes/branch-opt.ts` | Reference — inverse transformation (Pattern 3) |
| `packages/compiler/src/__tests__/codegen/asm-il/optimizer/passes/long-branch-expansion.test.ts` | **NEW** — Unit tests |
