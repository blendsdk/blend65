# Unified Test Plan: Phases 3-4 (Classical & Control Flow)

> **Document ID**: UNIFIED-TEST-PLAN-P3-4
> **Phases Covered**: 3 (Classical Optimizations), 4 (Control Flow)
> **Priority**: Critical
> **Test Count**: ~120 tests

---

## Overview

This document provides the comprehensive test plan for Phases 3 (Classical Optimizations) and 4 (Control Flow Optimizations) of the optimizer.

---

## Phase 3: Classical Optimizations Tests

### 3.1 Dead Code Elimination Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P3-001 | dce-unused-var | Unused variable removed | Critical | ⏳ |
| P3-002 | dce-unused-store | Dead store removed | Critical | ⏳ |
| P3-003 | dce-unused-computation | Dead computation removed | Critical | ⏳ |
| P3-004 | dce-side-effects | Side effects preserved | Critical | ⏳ |
| P3-005 | dce-conditional-dead | Conditional dead code | High | ⏳ |
| P3-006 | dce-loop-dead | Dead code in loops | High | ⏳ |
| P3-007 | dce-chain | Chain of dead code | High | ⏳ |
| P3-008 | dce-volatile | Volatile preserved | High | ⏳ |
| P3-009 | dce-memory-access | Memory side effects | High | ⏳ |
| P3-010 | dce-incremental | Incremental DCE | Medium | ⏳ |

### 3.2 Common Subexpression Elimination Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P3-011 | cse-simple | Simple CSE | Critical | ⏳ |
| P3-012 | cse-arithmetic | Arithmetic expressions | Critical | ⏳ |
| P3-013 | cse-memory | Memory expressions | High | ⏳ |
| P3-014 | cse-across-blocks | Cross-block CSE | High | ⏳ |
| P3-015 | cse-dominator | Dominator-based CSE | High | ⏳ |
| P3-016 | cse-loop-invariant | Loop-invariant CSE | High | ⏳ |
| P3-017 | cse-commutative | Commutative expressions | Medium | ⏳ |
| P3-018 | cse-killed-expr | Killed expressions | High | ⏳ |
| P3-019 | cse-memory-deps | Memory dependencies | Medium | ⏳ |
| P3-020 | cse-associative | Associative expressions | Medium | ⏳ |

### 3.3 Constant Propagation Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P3-021 | cp-simple | Simple constant prop | Critical | ⏳ |
| P3-022 | cp-arithmetic | Arithmetic with constants | Critical | ⏳ |
| P3-023 | cp-conditional | Conditional propagation | High | ⏳ |
| P3-024 | cp-across-blocks | Cross-block propagation | High | ⏳ |
| P3-025 | cp-loop-const | Loop constants | High | ⏳ |
| P3-026 | cp-phi-const | Phi with constants | High | ⏳ |
| P3-027 | cp-sparse | Sparse const propagation | High | ⏳ |
| P3-028 | cp-interprocedural | Interprocedural const | Medium | ⏳ |
| P3-029 | cp-conditional-const | Conditional constant | Medium | ⏳ |
| P3-030 | cp-array-const | Array constants | Medium | ⏳ |

### 3.4 Constant Folding Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P3-031 | cf-add | Addition folding | Critical | ⏳ |
| P3-032 | cf-sub | Subtraction folding | Critical | ⏳ |
| P3-033 | cf-mul | Multiplication folding | Critical | ⏳ |
| P3-034 | cf-div | Division folding | Critical | ⏳ |
| P3-035 | cf-bitwise | Bitwise folding | High | ⏳ |
| P3-036 | cf-shift | Shift folding | High | ⏳ |
| P3-037 | cf-compare | Comparison folding | High | ⏳ |
| P3-038 | cf-overflow | Overflow handling | Critical | ⏳ |
| P3-039 | cf-8bit | 8-bit arithmetic | High | ⏳ |
| P3-040 | cf-16bit | 16-bit arithmetic | High | ⏳ |

### 3.5 Copy Propagation Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P3-041 | copy-simple | Simple copy propagation | Critical | ⏳ |
| P3-042 | copy-chain | Copy chain | High | ⏳ |
| P3-043 | copy-kill | Killed copies | High | ⏳ |
| P3-044 | copy-loop | Loop copies | High | ⏳ |
| P3-045 | copy-phi | Phi node copies | Medium | ⏳ |
| P3-046 | copy-coalesce | Copy coalescing | Medium | ⏳ |

### 3.6 Strength Reduction Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P3-047 | sr-mul-to-shift | Multiply to shift | High | ⏳ |
| P3-048 | sr-div-to-shift | Divide to shift | High | ⏳ |
| P3-049 | sr-mod-to-and | Modulo to AND | High | ⏳ |
| P3-050 | sr-induction-var | Induction variable | High | ⏳ |
| P3-051 | sr-loop-strength | Loop strength reduction | High | ⏳ |
| P3-052 | sr-array-index | Array index reduction | Medium | ⏳ |

---

## Phase 4: Control Flow Tests

### 4.1 Unreachable Code Elimination Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P4-001 | unreach-after-ret | Code after return | Critical | ⏳ |
| P4-002 | unreach-false-cond | Always-false condition | Critical | ⏳ |
| P4-003 | unreach-dead-branch | Dead branch | Critical | ⏳ |
| P4-004 | unreach-orphan-block | Orphan block removal | High | ⏳ |
| P4-005 | unreach-infinite-loop | Infinite loop detection | High | ⏳ |
| P4-006 | unreach-propagate | Unreachability propagation | High | ⏳ |

### 4.2 Basic Block Merging Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P4-007 | merge-single-pred | Single predecessor merge | Critical | ⏳ |
| P4-008 | merge-single-succ | Single successor merge | Critical | ⏳ |
| P4-009 | merge-chain | Block chain merge | High | ⏳ |
| P4-010 | merge-preserve-phi | Preserve phi nodes | High | ⏳ |
| P4-011 | merge-labels | Label preservation | Medium | ⏳ |
| P4-012 | merge-empty | Empty block removal | High | ⏳ |

### 4.3 Branch Optimization Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P4-013 | branch-const-fold | Constant condition fold | Critical | ⏳ |
| P4-014 | branch-simplify | Branch simplification | Critical | ⏳ |
| P4-015 | branch-thread | Jump threading | High | ⏳ |
| P4-016 | branch-same-target | Same target removal | High | ⏳ |
| P4-017 | branch-chain | Branch chain opt | High | ⏳ |
| P4-018 | branch-complement | Complementary branches | Medium | ⏳ |

### 4.4 Jump Threading Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P4-019 | jthread-simple | Simple jump threading | High | ⏳ |
| P4-020 | jthread-conditional | Conditional threading | High | ⏳ |
| P4-021 | jthread-chain | Threading chain | High | ⏳ |
| P4-022 | jthread-phi | Phi node handling | High | ⏳ |
| P4-023 | jthread-limit | Threading limits | Medium | ⏳ |
| P4-024 | jthread-cost | Threading cost analysis | Medium | ⏳ |

### 4.5 Tail Call Optimization Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P4-025 | tailcall-simple | Simple tail call | High | ⏳ |
| P4-026 | tailcall-self | Self-recursive tail call | High | ⏳ |
| P4-027 | tailcall-mutual | Mutual tail call | Medium | ⏳ |
| P4-028 | tailcall-args | Tail call with args | Medium | ⏳ |
| P4-029 | tailcall-preserve | Preserve non-tail calls | High | ⏳ |
| P4-030 | tailcall-6502 | 6502 tail call pattern | High | ⏳ |

### 4.6 If-Conversion Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P4-031 | ifconv-simple | Simple if-conversion | Medium | ⏳ |
| P4-032 | ifconv-select | Select generation | Medium | ⏳ |
| P4-033 | ifconv-cost | Cost-based decision | Medium | ⏳ |
| P4-034 | ifconv-nested | Nested if-conversion | Low | ⏳ |
| P4-035 | ifconv-side-effect | Side effect handling | Medium | ⏳ |

---

## Test Implementation Examples

### Dead Code Elimination Test

```typescript
describe('DeadCodeElimination', () => {
  it('should remove unused variables', () => {
    const program = createProgram([
      createBlock('entry', [
        { opcode: 'MOV', dest: 'x', operands: [{ imm: 1 }] }, // Dead
        { opcode: 'MOV', dest: 'y', operands: [{ imm: 2 }] }, // Used
        { opcode: 'RET', operands: [{ var: 'y' }] }
      ], null)
    ]);
    
    const pass = new DeadCodeEliminationPass();
    const optimized = pass.run(program);
    
    // x should be removed
    const instrs = optimized.blocks[0].instructions;
    expect(instrs.some(i => i.dest === 'x')).toBe(false);
    expect(instrs.some(i => i.dest === 'y')).toBe(true);
  });
  
  it('should preserve side effects', () => {
    const program = createProgram([
      createBlock('entry', [
        { opcode: 'STORE', operands: [{ addr: 0xD020 }, { imm: 1 }] }, // VIC
        { opcode: 'RET', operands: [] }
      ], null)
    ]);
    
    const pass = new DeadCodeEliminationPass();
    const optimized = pass.run(program);
    
    // STORE should be preserved
    expect(optimized.blocks[0].instructions[0].opcode).toBe('STORE');
  });
});
```

### Jump Threading Test

```typescript
describe('JumpThreading', () => {
  it('should thread simple jump', () => {
    // A: if (x) goto B else goto C
    // B: goto D
    // C: ...
    // D: ...
    // Should become: if (x) goto D else goto C
    
    const program = createProgram([
      createBlock('A', [
        { opcode: 'BEQ', operands: [{ var: 'x' }, 'B', 'C'] }
      ]),
      createBlock('B', [
        { opcode: 'BR', operands: ['D'] }
      ]),
      createBlock('C', [
        { opcode: 'BR', operands: ['D'] }
      ]),
      createBlock('D', [
        { opcode: 'RET', operands: [] }
      ])
    ]);
    
    const pass = new JumpThreadingPass();
    const optimized = pass.run(program);
    
    // A should now jump directly to D
    const termA = optimized.getBlock('A').terminator;
    expect(termA.operands).toContain('D');
  });
});
```

---

## Test Coverage Requirements

| Component | Target Coverage | Current |
|-----------|-----------------|---------|
| Dead Code Elimination | 95% | 0% |
| CSE | 90% | 0% |
| Constant Propagation | 95% | 0% |
| Constant Folding | 95% | 0% |
| Copy Propagation | 90% | 0% |
| Strength Reduction | 85% | 0% |
| Unreachable Elimination | 95% | 0% |
| Block Merging | 90% | 0% |
| Branch Optimization | 90% | 0% |
| Jump Threading | 85% | 0% |

---

## Test Execution Order

1. **P3: Classical** - Core optimizations
2. **P4: Control Flow** - CFG optimizations

---

## References

- `03-classical-optimizations.md`, `04-control-flow.md`, `02-analysis-passes.md`