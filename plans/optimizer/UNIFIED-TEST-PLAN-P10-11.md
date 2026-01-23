# Unified Test Plan: Phases 10-11 (Validation & Testing)

> **Document ID**: UNIFIED-TEST-PLAN-P10-11
> **Phases Covered**: 10 (Validation), 11 (Testing Framework)
> **Priority**: Critical
> **Test Count**: ~100 tests

---

## Overview

This document provides the comprehensive test plan for Phases 10 (Validation & Correctness) and 11 (Testing Framework). These phases ensure the optimizer produces correct, validated output.

---

## Phase 10: Validation Tests

### 10.1 IL Validation Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P10-001 | il-valid-program | Valid program structure | Critical | ⏳ |
| P10-002 | il-valid-blocks | Valid block structure | Critical | ⏳ |
| P10-003 | il-valid-instrs | Valid instructions | Critical | ⏳ |
| P10-004 | il-ssa-valid | SSA form validation | Critical | ⏳ |
| P10-005 | il-phi-valid | Phi node validation | High | ⏳ |
| P10-006 | il-terminator | Terminator validation | Critical | ⏳ |
| P10-007 | il-cfg-valid | CFG validity | Critical | ⏳ |
| P10-008 | il-types-valid | Type validation | High | ⏳ |

### 10.2 Transformation Validation Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P10-009 | xform-semantic | Semantic preservation | Critical | ⏳ |
| P10-010 | xform-side-effect | Side effect preservation | Critical | ⏳ |
| P10-011 | xform-memory | Memory semantics | Critical | ⏳ |
| P10-012 | xform-control | Control flow preservation | Critical | ⏳ |
| P10-013 | xform-volatile | Volatile handling | Critical | ⏳ |
| P10-014 | xform-ordering | Memory ordering | High | ⏳ |

### 10.3 Output Validation Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P10-015 | out-6502-valid | Valid 6502 code | Critical | ⏳ |
| P10-016 | out-opcode-valid | Valid opcodes | Critical | ⏳ |
| P10-017 | out-addr-mode | Valid addressing modes | Critical | ⏳ |
| P10-018 | out-operand | Valid operands | Critical | ⏳ |
| P10-019 | out-encoding | Correct encoding | Critical | ⏳ |
| P10-020 | out-size | Correct sizes | High | ⏳ |

### 10.4 Equivalence Checking Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P10-021 | equiv-semantic | Semantic equivalence | Critical | ⏳ |
| P10-022 | equiv-observable | Observable equivalence | Critical | ⏳ |
| P10-023 | equiv-register | Register equivalence | High | ⏳ |
| P10-024 | equiv-memory | Memory equivalence | High | ⏳ |
| P10-025 | equiv-flags | Flag equivalence | High | ⏳ |

---

## Phase 11: Testing Framework Tests

### 11.1 Unit Testing Infrastructure Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P11-001 | unit-runner | Unit test runner | Critical | ⏳ |
| P11-002 | unit-fixtures | Test fixtures | High | ⏳ |
| P11-003 | unit-assertions | Custom assertions | High | ⏳ |
| P11-004 | unit-mocking | IL mocking | High | ⏳ |
| P11-005 | unit-snapshot | Snapshot testing | Medium | ⏳ |

### 11.2 Integration Testing Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P11-006 | int-pass-combo | Pass combinations | Critical | ⏳ |
| P11-007 | int-pipeline | Pipeline integration | Critical | ⏳ |
| P11-008 | int-analysis | Analysis integration | High | ⏳ |
| P11-009 | int-codegen | Codegen integration | High | ⏳ |

### 11.3 End-to-End Testing Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P11-010 | e2e-simple | Simple program E2E | Critical | ⏳ |
| P11-011 | e2e-complex | Complex program E2E | High | ⏳ |
| P11-012 | e2e-full-pipe | Full pipeline E2E | Critical | ⏳ |
| P11-013 | e2e-execution | Execution verification | High | ⏳ |

### 11.4 Fuzzing Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P11-014 | fuzz-il | IL fuzzer | High | ⏳ |
| P11-015 | fuzz-pattern | Pattern fuzzer | High | ⏳ |
| P11-016 | fuzz-crash | Crash detection | High | ⏳ |
| P11-017 | fuzz-coverage | Fuzzing coverage | Medium | ⏳ |

### 11.5 Benchmarking Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P11-018 | bench-micro | Micro benchmarks | High | ⏳ |
| P11-019 | bench-macro | Macro benchmarks | High | ⏳ |
| P11-020 | bench-baseline | Baseline comparison | High | ⏳ |
| P11-021 | bench-report | Report generation | Medium | ⏳ |

### 11.6 Regression Testing Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P11-022 | regress-detect | Regression detection | Critical | ⏳ |
| P11-023 | regress-ci | CI integration | High | ⏳ |
| P11-024 | regress-notify | Notification system | Medium | ⏳ |
| P11-025 | regress-baseline | Baseline management | High | ⏳ |

---

## Test Implementation Examples

### Semantic Equivalence Test

```typescript
describe('SemanticEquivalence', () => {
  it('should verify optimized code produces same result', () => {
    const original = createProgram([
      createBlock('entry', [
        { opcode: 'MOV', dest: 'x', operands: [{ imm: 5 }] },
        { opcode: 'MOV', dest: 'y', operands: [{ imm: 3 }] },
        { opcode: 'ADD', dest: 'z', operands: [{ var: 'x' }, { var: 'y' }] },
        { opcode: 'RET', operands: [{ var: 'z' }] }
      ], null)
    ]);
    
    const optimizer = new OptimizerPipeline();
    const optimized = optimizer.run(original);
    
    // Verify equivalence
    const checker = new EquivalenceChecker();
    const result = checker.check(original, optimized);
    
    expect(result.equivalent).toBe(true);
    expect(result.returnValue).toBe(8);
  });
  
  it('should preserve memory side effects', () => {
    const program = createProgram([
      createBlock('entry', [
        { opcode: 'STORE', operands: [{ addr: 0xD020 }, { imm: 5 }] },
        { opcode: 'RET', operands: [] }
      ], null)
    ]);
    
    const optimizer = new OptimizerPipeline();
    const optimized = optimizer.run(program);
    
    // Memory store should be preserved
    const checker = new EquivalenceChecker();
    const result = checker.checkMemory(program, optimized);
    
    expect(result.memoryWrites).toContainEqual({ addr: 0xD020, value: 5 });
  });
});
```

### Fuzzer Test

```typescript
describe('ILFuzzer', () => {
  it('should not crash on random IL', () => {
    const fuzzer = new ILFuzzer({ seed: 12345, maxInstructions: 50 });
    const optimizer = new OptimizerPipeline();
    
    // Run 1000 random programs
    for (let i = 0; i < 1000; i++) {
      const program = fuzzer.generate();
      
      // Should not throw
      expect(() => {
        optimizer.run(program);
      }).not.toThrow();
    }
  });
  
  it('should maintain semantic equivalence after optimization', () => {
    const fuzzer = new ILFuzzer({ seed: 54321, maxInstructions: 20 });
    const optimizer = new OptimizerPipeline();
    const checker = new EquivalenceChecker();
    
    for (let i = 0; i < 100; i++) {
      const program = fuzzer.generate();
      const optimized = optimizer.run(program);
      
      const result = checker.check(program, optimized);
      expect(result.equivalent).toBe(true);
    }
  });
});
```

### Regression Detection Test

```typescript
describe('RegressionDetector', () => {
  it('should detect performance regression', () => {
    const baseline = new Map([
      ['test_add', { mean: 100, stdDev: 5 }],
      ['test_loop', { mean: 500, stdDev: 20 }]
    ]);
    
    const current = new Map([
      ['test_add', { value: 120 }],  // 20% regression
      ['test_loop', { value: 490 }]  // Within tolerance
    ]);
    
    const detector = new RegressionDetector({
      performanceThreshold: 10
    });
    detector.loadBaseline({ results: baseline });
    
    const result = detector.detect(current, 'cycles');
    
    expect(result.status).toBe('fail');
    expect(result.regressions.length).toBe(1);
    expect(result.regressions[0].id).toBe('test_add');
  });
});
```

---

## Test Coverage Requirements

| Component | Target Coverage | Current |
|-----------|-----------------|---------|
| IL Validation | 95% | 0% |
| Transformation Validation | 95% | 0% |
| Output Validation | 95% | 0% |
| Equivalence Checking | 90% | 0% |
| Unit Testing Framework | 90% | 0% |
| Integration Testing | 85% | 0% |
| E2E Testing | 85% | 0% |
| Fuzzing | 80% | 0% |
| Benchmarking | 85% | 0% |
| Regression Detection | 90% | 0% |

---

## Test Summary: All Phases

| Phase | Test Count | Priority Distribution |
|-------|------------|----------------------|
| P1-2: Architecture & Analysis | ~150 | 60% Critical, 30% High |
| P3-4: Classical & Control Flow | ~120 | 50% Critical, 40% High |
| P5: Loop Optimizations | ~80 | 40% Critical, 45% High |
| P6-7: Register & 6502 | ~100 | 55% Critical, 35% High |
| P8-9: Peephole Patterns | ~200 | 45% Critical, 40% High |
| P10-11: Validation & Testing | ~100 | 60% Critical, 30% High |
| **Total** | **~750** | **50% Critical, 38% High** |

---

## References

- `11-01a1-unit-runner.md` through `11-06b-regression-ci.md`