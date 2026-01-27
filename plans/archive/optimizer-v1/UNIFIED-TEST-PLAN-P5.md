# Unified Test Plan: Phase 5 (Loop Optimizations)

> **Document ID**: UNIFIED-TEST-PLAN-P5
> **Phases Covered**: 5 (Loop Optimizations)
> **Priority**: High
> **Test Count**: ~80 tests

---

## Overview

This document provides the comprehensive test plan for Phase 5 (Loop Optimizations) of the optimizer. Loop optimizations are critical for 6502 performance.

---

## Phase 5: Loop Optimization Tests

### 5.1 Loop Invariant Code Motion Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P5-001 | licm-simple | Simple invariant hoisting | Critical | ⏳ |
| P5-002 | licm-arithmetic | Arithmetic invariants | Critical | ⏳ |
| P5-003 | licm-memory-read | Memory read hoisting | High | ⏳ |
| P5-004 | licm-no-side-effect | No side effects check | Critical | ⏳ |
| P5-005 | licm-nested | Nested loop invariants | High | ⏳ |
| P5-006 | licm-preheader | Preheader creation | High | ⏳ |
| P5-007 | licm-conditional | Conditional invariants | Medium | ⏳ |
| P5-008 | licm-aliasing | Aliasing prevents LICM | High | ⏳ |
| P5-009 | licm-volatile | Volatile prevents LICM | High | ⏳ |
| P5-010 | licm-6502-regs | Register-based LICM | High | ⏳ |

### 5.2 Loop Unrolling Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P5-011 | unroll-complete | Complete unrolling | High | ⏳ |
| P5-012 | unroll-partial | Partial unrolling | High | ⏳ |
| P5-013 | unroll-factor-2 | Unroll by 2 | High | ⏳ |
| P5-014 | unroll-factor-4 | Unroll by 4 | High | ⏳ |
| P5-015 | unroll-factor-8 | Unroll by 8 | Medium | ⏳ |
| P5-016 | unroll-trip-count | Known trip count | High | ⏳ |
| P5-017 | unroll-unknown-trip | Unknown trip count | Medium | ⏳ |
| P5-018 | unroll-epilog | Epilog generation | High | ⏳ |
| P5-019 | unroll-size-limit | Size limit respected | High | ⏳ |
| P5-020 | unroll-nested | Nested loop unrolling | Medium | ⏳ |

### 5.3 Loop Strength Reduction Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P5-021 | lsr-induction | Induction var reduction | High | ⏳ |
| P5-022 | lsr-multiply | Multiply to add | High | ⏳ |
| P5-023 | lsr-array-index | Array index reduction | High | ⏳ |
| P5-024 | lsr-pointer | Pointer arithmetic | High | ⏳ |
| P5-025 | lsr-nested | Nested induction vars | Medium | ⏳ |
| P5-026 | lsr-derived | Derived induction vars | Medium | ⏳ |
| P5-027 | lsr-chain | Reduction chain | Medium | ⏳ |
| P5-028 | lsr-6502-indexed | 6502 indexed modes | High | ⏳ |

### 5.4 Loop Peeling Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P5-029 | peel-first | Peel first iteration | Medium | ⏳ |
| P5-030 | peel-last | Peel last iteration | Medium | ⏳ |
| P5-031 | peel-boundary | Boundary condition | Medium | ⏳ |
| P5-032 | peel-enable-opt | Enable further opts | Medium | ⏳ |
| P5-033 | peel-cost | Cost-based decision | Low | ⏳ |

### 5.5 Loop Fusion Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P5-034 | fuse-adjacent | Adjacent loops | Medium | ⏳ |
| P5-035 | fuse-same-bounds | Same iteration bounds | Medium | ⏳ |
| P5-036 | fuse-dependencies | Data dependencies | Medium | ⏳ |
| P5-037 | fuse-no-fusion | Prevent invalid fusion | High | ⏳ |
| P5-038 | fuse-nested | Nested loop fusion | Low | ⏳ |

### 5.6 Loop Distribution Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P5-039 | dist-independent | Independent statements | Low | ⏳ |
| P5-040 | dist-vectorize | Enable vectorization | Low | ⏳ |
| P5-041 | dist-memory | Memory locality | Low | ⏳ |

### 5.7 Induction Variable Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P5-042 | iv-detect | IV detection | Critical | ⏳ |
| P5-043 | iv-basic | Basic IV | Critical | ⏳ |
| P5-044 | iv-derived | Derived IV | High | ⏳ |
| P5-045 | iv-eliminate | IV elimination | High | ⏳ |
| P5-046 | iv-simplify | IV simplification | High | ⏳ |
| P5-047 | iv-widening | IV widening | Medium | ⏳ |
| P5-048 | iv-bounds | IV bounds analysis | High | ⏳ |
| P5-049 | iv-6502-x | Use X as IV | High | ⏳ |
| P5-050 | iv-6502-y | Use Y as IV | High | ⏳ |

### 5.8 Loop Exit Analysis Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P5-051 | exit-single | Single exit | High | ⏳ |
| P5-052 | exit-multiple | Multiple exits | Medium | ⏳ |
| P5-053 | exit-early | Early exit | Medium | ⏳ |
| P5-054 | exit-condition | Exit condition analysis | High | ⏳ |
| P5-055 | exit-value | Exit value computation | Medium | ⏳ |

### 5.9 Loop Rotation Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P5-056 | rotate-do-while | Convert to do-while | High | ⏳ |
| P5-057 | rotate-enable-licm | Enable LICM after | High | ⏳ |
| P5-058 | rotate-guard | Loop guard generation | High | ⏳ |
| P5-059 | rotate-nested | Nested rotation | Medium | ⏳ |

### 5.10 6502-Specific Loop Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P5-060 | 6502-dex-bne | DEX/BNE loop pattern | Critical | ⏳ |
| P5-061 | 6502-dey-bne | DEY/BNE loop pattern | Critical | ⏳ |
| P5-062 | 6502-inx-cpx | INX/CPX/BNE pattern | High | ⏳ |
| P5-063 | 6502-iny-cpy | INY/CPY/BNE pattern | High | ⏳ |
| P5-064 | 6502-page-cross | Page crossing awareness | High | ⏳ |
| P5-065 | 6502-zero-page | Zero page loop vars | High | ⏳ |
| P5-066 | 6502-256-limit | 256 iteration limit | Critical | ⏳ |
| P5-067 | 6502-count-down | Count down loops | High | ⏳ |
| P5-068 | 6502-indexed | Indexed addressing loops | High | ⏳ |

---

## Test Implementation Examples

### Loop Invariant Code Motion Test

```typescript
describe('LoopInvariantCodeMotion', () => {
  it('should hoist invariant computation', () => {
    // while (i < n) { x = a + b; arr[i] = x; i++; }
    // 'a + b' is invariant, should be hoisted
    
    const program = createProgram([
      createBlock('preheader', [
        { opcode: 'MOV', dest: 'i', operands: [{ imm: 0 }] }
      ], 'header'),
      createBlock('header', [
        { opcode: 'CMP', dest: 'cond', operands: [{ var: 'i' }, { var: 'n' }] },
        { opcode: 'BLT', operands: ['body', 'exit'] }
      ]),
      createBlock('body', [
        { opcode: 'ADD', dest: 'x', operands: [{ var: 'a' }, { var: 'b' }] }, // Invariant
        { opcode: 'STORE', operands: [{ var: 'arr' }, { var: 'i' }, { var: 'x' }] },
        { opcode: 'ADD', dest: 'i', operands: [{ var: 'i' }, { imm: 1 }] },
        { opcode: 'BR', operands: ['header'] }
      ]),
      createBlock('exit', [
        { opcode: 'RET', operands: [] }
      ])
    ]);
    
    const pass = new LICMPass();
    const optimized = pass.run(program);
    
    // x = a + b should be in preheader now
    const preheader = optimized.getBlock('preheader');
    expect(preheader.instructions.some(i => 
      i.opcode === 'ADD' && i.dest === 'x'
    )).toBe(true);
    
    // And not in body
    const body = optimized.getBlock('body');
    expect(body.instructions.some(i => 
      i.opcode === 'ADD' && i.dest === 'x'
    )).toBe(false);
  });
});
```

### Loop Unrolling Test

```typescript
describe('LoopUnrolling', () => {
  it('should completely unroll small loop', () => {
    // for (i = 0; i < 4; i++) { arr[i] = 0; }
    
    const program = createProgram([
      createBlock('entry', [
        { opcode: 'MOV', dest: 'i', operands: [{ imm: 0 }] },
        { opcode: 'BR', operands: ['header'] }
      ]),
      createBlock('header', [
        { opcode: 'CMP', dest: 'cond', operands: [{ var: 'i' }, { imm: 4 }] },
        { opcode: 'BLT', operands: ['body', 'exit'] }
      ]),
      createBlock('body', [
        { opcode: 'STORE', operands: [{ var: 'arr' }, { var: 'i' }, { imm: 0 }] },
        { opcode: 'ADD', dest: 'i', operands: [{ var: 'i' }, { imm: 1 }] },
        { opcode: 'BR', operands: ['header'] }
      ]),
      createBlock('exit', [
        { opcode: 'RET', operands: [] }
      ])
    ]);
    
    const pass = new LoopUnrollingPass({ completeThreshold: 8 });
    const optimized = pass.run(program);
    
    // Should have 4 stores in sequence, no loop
    const entry = optimized.getBlock('entry');
    const stores = entry.instructions.filter(i => i.opcode === 'STORE');
    expect(stores.length).toBe(4);
  });
  
  it('should generate 6502 DEX/BNE pattern', () => {
    // Count down loop: for (i = 255; i >= 0; i--)
    
    const program = createLoopProgram({
      start: 255,
      end: 0,
      step: -1,
      body: [{ opcode: 'STORE', operands: [{ var: 'arr' }, { var: 'i' }, { imm: 0 }] }]
    });
    
    const pass = new Loop6502PatternPass();
    const asm = pass.generateAsm(program);
    
    // Should generate: LDX #$FF / loop: STA arr,X / DEX / BNE loop
    expect(asm).toContain('DEX');
    expect(asm).toContain('BNE');
  });
});
```

---

## Test Coverage Requirements

| Component | Target Coverage | Current |
|-----------|-----------------|---------|
| LICM | 90% | 0% |
| Loop Unrolling | 90% | 0% |
| Strength Reduction | 85% | 0% |
| Loop Peeling | 80% | 0% |
| Loop Fusion | 75% | 0% |
| IV Analysis | 90% | 0% |
| Loop Rotation | 85% | 0% |
| 6502 Loop Patterns | 95% | 0% |

---

## Test Execution Order

1. **IV Analysis** - Foundation for loop opts
2. **LICM** - Simplifies loop bodies
3. **Strength Reduction** - Reduces complex ops
4. **Unrolling** - After simplification
5. **6502 Patterns** - Final code generation

---

## References

- `05-loop-optimizations.md`, `02-analysis-passes.md`, `07-6502-specific.md`