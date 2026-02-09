# IL-Level Improvements: Optimizer V2

> **Document**: 05-il-improvements.md
> **Parent**: [Index](00-index.md)
> **Gaps Covered**: GAP-7 (MUL/DIV fix), GAP-8 (CSE), GAP-13 (Compare+Branch), GAP-14 (Indexed addressing)

## Overview

This document covers improvements to existing IL-level passes and new function-level passes, plus two ASM-level pattern additions.

## GAP-7: Fix MUL/DIV Strength Reduction Stubs

### Current State

In `il-peephole.ts`, both `tryReduceMultiply()` and `tryReduceDivide()` are **completely stubbed out** — they return `null` always:

```typescript
// CURRENT — does nothing!
protected tryReduceMultiply(instr, value): StrengthReductionResult | null {
  return null;
}
protected tryReduceDivide(instr, value): StrengthReductionResult | null {
  return null;
}
```

### Required Implementation

The IL peephole pass needs to detect `MUL_BYTE`/`DIV_BYTE` with power-of-2 operands and replace with shifts. The challenge is that MUL/DIV operate on slots, not immediates. We need to look at the preceding `LOAD_IMM` to find known constant values.

**Pattern:** `LOAD_IMM n; MUL_BYTE slot` where `n` is power-of-2 → replace MUL with `SHL_BYTE log2(n)`

**Pattern:** `LOAD_IMM n; DIV_BYTE slot` where `n` is power-of-2 → replace DIV with `SHR_BYTE log2(n)`

**Special cases:**
- `MUL_BYTE 0` → `LOAD_IMM 0`
- `MUL_BYTE 1` → no-op (remove)
- `DIV_BYTE 1` → no-op (remove)

### Files Modified

- `packages/compiler/src/optimizer/passes/il-peephole.ts` — implement the two stub methods

## GAP-8: Common Subexpression Elimination (CSE)

### Algorithm

Simple local CSE within basic blocks (between labels/jumps):

```
1. For each basic block:
   a. Track available expressions: (opcode, operands) → result slot
   b. When same expression seen again, replace with load from result slot
   c. Invalidate when operands are modified
```

### Implementation: `CSEPass`

```typescript
// optimizer/passes/cse.ts
export class CSEPass implements OptimizationPass {
  readonly name = 'cse';
  readonly dependencies = ['constant-prop'];

  run(func: ILFunction, options: OptimizationOptions): PassResult {
    // Track expressions within each basic block
    // Expression key: `${opcode}:${operand1}:${operand2}`
    // When duplicate found, replace with load from first computation's target
  }
}
```

### Enabled At: O2+

### Scope Limitation

- Local CSE only (within basic blocks, not across control flow)
- Does not handle commutative equivalence (a+b vs b+a) in first version
- Does not CSE memory operations (only register/slot operations)

## GAP-13: Compare+Branch Simplification (ASM-Level)

### Pattern

```asm
; Before:
CMP #$0F
BCC .target    ; branch if < $0F
BEQ .target    ; branch if = $0F

; After:
CMP #$10
BCC .target    ; branch if < $10 (equivalent to <= $0F)
```

### Implementation

New pass in `codegen/asm-il/optimizer/passes/compare-branch.ts` implementing `AsmOptimizationPass`.

### Enabled At: O2+

## GAP-14: Indexed Addressing Optimization (ASM-Level)

### Pattern

When array access patterns are detected, use 6502 indexed addressing modes:

```asm
; Before (computed address):
LDA base
CLC
ADC index
STA temp
LDA (temp)

; After (indexed addressing):
LDX index
LDA base,X
```

### Implementation

New pass in `codegen/asm-il/optimizer/passes/indexed-addr.ts`. Requires `address-analyzer.ts` to identify array access patterns.

### Enabled At: O2+

## Testing Requirements

- GAP-7: MUL by 2,4,8,16,32,64,128 → SHL; DIV by same → SHR; MUL by 0, MUL by 1
- GAP-8: CSE with simple expressions, invalidation on write, block boundaries
- GAP-13: CMP+BCC+BEQ patterns, edge cases with different branch targets
- GAP-14: Simple indexed access patterns, non-applicable patterns preserved
