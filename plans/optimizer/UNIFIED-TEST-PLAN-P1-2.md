# Unified Test Plan: Phases 1-2 (Architecture & Analysis)

> **Document ID**: UNIFIED-TEST-PLAN-P1-2
> **Phases Covered**: 1 (Architecture), 2 (Analysis Passes)
> **Priority**: Critical
> **Test Count**: ~150 tests

---

## Overview

This document provides the comprehensive test plan for Phases 1 (Architecture) and 2 (Analysis Passes) of the optimizer. Tests are categorized by component and priority level.

---

## Phase 1: Architecture Tests

### 1.1 Pass Infrastructure Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P1-001 | pass-registration | Pass registers with manager | Critical | ⏳ |
| P1-002 | pass-dependencies | Dependencies resolved correctly | Critical | ⏳ |
| P1-003 | pass-ordering | Passes execute in correct order | Critical | ⏳ |
| P1-004 | pass-config | Configuration applied to passes | High | ⏳ |
| P1-005 | pass-skip | Disabled passes skipped | Medium | ⏳ |
| P1-006 | pass-timing | Pass timing recorded | Medium | ⏳ |
| P1-007 | pass-stats | Pass statistics collected | Medium | ⏳ |
| P1-008 | pass-error-recovery | Errors handled gracefully | High | ⏳ |
| P1-009 | pass-cyclic-deps | Cyclic dependencies detected | High | ⏳ |
| P1-010 | pass-missing-dep | Missing dependencies reported | High | ⏳ |

### 1.2 IL Infrastructure Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P1-011 | il-program-create | ILProgram creation | Critical | ⏳ |
| P1-012 | il-block-create | ILBlock creation | Critical | ⏳ |
| P1-013 | il-instruction-create | ILInstruction creation | Critical | ⏳ |
| P1-014 | il-operand-types | All operand types supported | Critical | ⏳ |
| P1-015 | il-ssa-form | SSA form validation | Critical | ⏳ |
| P1-016 | il-phi-nodes | Phi node handling | High | ⏳ |
| P1-017 | il-terminator-validation | Block terminators valid | High | ⏳ |
| P1-018 | il-clone | Program cloning works | Medium | ⏳ |
| P1-019 | il-serialize | Program serialization | Medium | ⏳ |
| P1-020 | il-equals | Program equality comparison | Medium | ⏳ |

### 1.3 CFG Infrastructure Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P1-021 | cfg-build | CFG built from IL | Critical | ⏳ |
| P1-022 | cfg-successors | Successor edges correct | Critical | ⏳ |
| P1-023 | cfg-predecessors | Predecessor edges correct | Critical | ⏳ |
| P1-024 | cfg-entry-block | Entry block identified | Critical | ⏳ |
| P1-025 | cfg-exit-blocks | Exit blocks identified | Critical | ⏳ |
| P1-026 | cfg-unreachable | Unreachable blocks detected | High | ⏳ |
| P1-027 | cfg-back-edges | Back edges identified | High | ⏳ |
| P1-028 | cfg-update-insert | Block insertion updates CFG | Medium | ⏳ |
| P1-029 | cfg-update-remove | Block removal updates CFG | Medium | ⏳ |
| P1-030 | cfg-traversal-dfs | DFS traversal works | Medium | ⏳ |
| P1-031 | cfg-traversal-bfs | BFS traversal works | Medium | ⏳ |
| P1-032 | cfg-traversal-rpo | Reverse postorder works | High | ⏳ |

### 1.4 Optimization Pipeline Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P1-033 | pipeline-execute | Pipeline executes all passes | Critical | ⏳ |
| P1-034 | pipeline-fixed-point | Fixed-point iteration works | Critical | ⏳ |
| P1-035 | pipeline-convergence | Pipeline converges | Critical | ⏳ |
| P1-036 | pipeline-max-iterations | Max iterations respected | High | ⏳ |
| P1-037 | pipeline-early-exit | Early exit on no changes | Medium | ⏳ |
| P1-038 | pipeline-level-none | Level 'none' skips opts | High | ⏳ |
| P1-039 | pipeline-level-standard | Level 'standard' applies opts | High | ⏳ |
| P1-040 | pipeline-level-aggressive | Level 'aggressive' applies all | High | ⏳ |

---

## Phase 2: Analysis Passes Tests

### 2.1 Dominator Analysis Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P2-001 | dom-entry-dominates-all | Entry dominates all blocks | Critical | ⏳ |
| P2-002 | dom-immediate | Immediate dominators correct | Critical | ⏳ |
| P2-003 | dom-tree | Dominator tree built correctly | Critical | ⏳ |
| P2-004 | dom-frontier | Dominance frontiers computed | High | ⏳ |
| P2-005 | dom-linear-cfg | Linear CFG dominators | High | ⏳ |
| P2-006 | dom-diamond-cfg | Diamond CFG dominators | High | ⏳ |
| P2-007 | dom-loop-cfg | Loop CFG dominators | High | ⏳ |
| P2-008 | dom-complex-cfg | Complex CFG dominators | Medium | ⏳ |
| P2-009 | dom-incremental | Incremental update works | Medium | ⏳ |
| P2-010 | dom-postdom | Post-dominators computed | Medium | ⏳ |

### 2.2 Liveness Analysis Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P2-011 | live-def-use | Defs and uses identified | Critical | ⏳ |
| P2-012 | live-in-out | Live-in/live-out computed | Critical | ⏳ |
| P2-013 | live-propagation | Liveness propagates backward | Critical | ⏳ |
| P2-014 | live-dead-vars | Dead variables identified | High | ⏳ |
| P2-015 | live-ranges | Live ranges computed | High | ⏳ |
| P2-016 | live-interference | Interference detected | High | ⏳ |
| P2-017 | live-loop-vars | Loop variables handled | High | ⏳ |
| P2-018 | live-phi-nodes | Phi nodes handled correctly | High | ⏳ |
| P2-019 | live-incremental | Incremental update works | Medium | ⏳ |
| P2-020 | live-sparse | Sparse representation works | Medium | ⏳ |

### 2.3 Reaching Definitions Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P2-021 | reach-def-gen | Gen sets computed | Critical | ⏳ |
| P2-022 | reach-def-kill | Kill sets computed | Critical | ⏳ |
| P2-023 | reach-propagation | Definitions propagate forward | Critical | ⏳ |
| P2-024 | reach-def-use-chains | Def-use chains built | High | ⏳ |
| P2-025 | reach-use-def-chains | Use-def chains built | High | ⏳ |
| P2-026 | reach-multiple-defs | Multiple definitions handled | High | ⏳ |
| P2-027 | reach-loop-defs | Loop definitions handled | High | ⏳ |
| P2-028 | reach-killed-defs | Killed definitions excluded | High | ⏳ |
| P2-029 | reach-incremental | Incremental update works | Medium | ⏳ |
| P2-030 | reach-ssa-form | SSA-based reaching defs | Medium | ⏳ |

### 2.4 Loop Analysis Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P2-031 | loop-natural-detect | Natural loops detected | Critical | ⏳ |
| P2-032 | loop-header | Loop headers identified | Critical | ⏳ |
| P2-033 | loop-back-edges | Back edges found | Critical | ⏳ |
| P2-034 | loop-body | Loop body blocks found | High | ⏳ |
| P2-035 | loop-exits | Loop exits identified | High | ⏳ |
| P2-036 | loop-depth | Loop nesting depth computed | High | ⏳ |
| P2-037 | loop-nested | Nested loops handled | High | ⏳ |
| P2-038 | loop-induction-vars | Induction variables found | High | ⏳ |
| P2-039 | loop-invariants | Loop invariants identified | High | ⏳ |
| P2-040 | loop-trip-count | Trip count analysis | Medium | ⏳ |

### 2.5 Available Expressions Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P2-041 | avail-gen | Generated expressions | High | ⏳ |
| P2-042 | avail-kill | Killed expressions | High | ⏳ |
| P2-043 | avail-propagation | Forward propagation | High | ⏳ |
| P2-044 | avail-at-point | Availability at program point | High | ⏳ |
| P2-045 | avail-cse-enable | Enables CSE optimization | High | ⏳ |
| P2-046 | avail-loop-exprs | Loop expressions handled | Medium | ⏳ |
| P2-047 | avail-memory-deps | Memory dependencies | Medium | ⏳ |
| P2-048 | avail-aliasing | Aliasing considered | Medium | ⏳ |

### 2.6 Alias Analysis Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P2-049 | alias-must-alias | Must-alias detected | High | ⏳ |
| P2-050 | alias-may-alias | May-alias detected | High | ⏳ |
| P2-051 | alias-no-alias | No-alias proven | High | ⏳ |
| P2-052 | alias-stack-vars | Stack variables analyzed | High | ⏳ |
| P2-053 | alias-global-vars | Global variables analyzed | High | ⏳ |
| P2-054 | alias-array-elements | Array element aliasing | Medium | ⏳ |
| P2-055 | alias-field-sensitive | Field-sensitive analysis | Medium | ⏳ |
| P2-056 | alias-flow-sensitive | Flow-sensitive analysis | Medium | ⏳ |

### 2.7 Analysis Manager Tests

| Test ID | Test Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| P2-057 | mgr-run-analysis | Run single analysis | Critical | ⏳ |
| P2-058 | mgr-cache-results | Results cached | High | ⏳ |
| P2-059 | mgr-invalidate | Invalidation works | High | ⏳ |
| P2-060 | mgr-dependencies | Analysis dependencies | High | ⏳ |
| P2-061 | mgr-lazy-compute | Lazy computation | Medium | ⏳ |
| P2-062 | mgr-recompute | Recompute on invalidation | Medium | ⏳ |

---

## Test Implementation Examples

### Dominator Analysis Test

```typescript
describe('DominatorAnalysis', () => {
  it('should compute dominators for linear CFG', () => {
    // Setup: A -> B -> C -> D
    const program = createProgram([
      createBlock('A', [], 'B'),
      createBlock('B', [], 'C'),
      createBlock('C', [], 'D'),
      createBlock('D', [], null)
    ]);
    
    const analysis = new DominatorAnalysis();
    const result = analysis.analyze(program);
    
    // A dominates all
    expect(result.dominates('A', 'B')).toBe(true);
    expect(result.dominates('A', 'C')).toBe(true);
    expect(result.dominates('A', 'D')).toBe(true);
    
    // Immediate dominators
    expect(result.getImmediateDominator('B')).toBe('A');
    expect(result.getImmediateDominator('C')).toBe('B');
    expect(result.getImmediateDominator('D')).toBe('C');
  });
  
  it('should compute dominators for diamond CFG', () => {
    // Setup: A -> B, A -> C, B -> D, C -> D
    const program = createProgram([
      createBlock('A', [], ['B', 'C']),
      createBlock('B', [], 'D'),
      createBlock('C', [], 'D'),
      createBlock('D', [], null)
    ]);
    
    const analysis = new DominatorAnalysis();
    const result = analysis.analyze(program);
    
    // A dominates all
    expect(result.dominates('A', 'D')).toBe(true);
    
    // B and C don't dominate D
    expect(result.dominates('B', 'D')).toBe(false);
    expect(result.dominates('C', 'D')).toBe(false);
    
    // D's immediate dominator is A
    expect(result.getImmediateDominator('D')).toBe('A');
  });
});
```

### Liveness Analysis Test

```typescript
describe('LivenessAnalysis', () => {
  it('should compute live variables', () => {
    const program = createProgram([
      createBlock('entry', [
        { opcode: 'MOV', dest: 'x', operands: [{ imm: 1 }] },
        { opcode: 'MOV', dest: 'y', operands: [{ imm: 2 }] }
      ], 'use'),
      createBlock('use', [
        { opcode: 'ADD', dest: 'z', operands: [{ var: 'x' }, { var: 'y' }] },
        { opcode: 'RET', operands: [] }
      ], null)
    ]);
    
    const analysis = new LivenessAnalysis();
    const result = analysis.analyze(program);
    
    // At end of 'entry', x and y are live
    expect(result.getLiveOut('entry')).toContain('x');
    expect(result.getLiveOut('entry')).toContain('y');
    
    // z is not live (defined but not used after)
    expect(result.getLiveOut('use')).not.toContain('z');
  });
});
```

---

## Test Coverage Requirements

| Component | Target Coverage | Current |
|-----------|-----------------|---------|
| Pass Infrastructure | 95% | 0% |
| IL Infrastructure | 95% | 0% |
| CFG Infrastructure | 95% | 0% |
| Dominator Analysis | 90% | 0% |
| Liveness Analysis | 90% | 0% |
| Reaching Definitions | 90% | 0% |
| Loop Analysis | 90% | 0% |
| Analysis Manager | 85% | 0% |

---

## Test Execution Order

1. **P1: Architecture** - Foundation must be solid first
2. **P2: Analysis** - Analysis passes depend on infrastructure

---

## References

- `01-architecture.md`, `02-analysis-passes.md`, `11-01a1-unit-runner.md`