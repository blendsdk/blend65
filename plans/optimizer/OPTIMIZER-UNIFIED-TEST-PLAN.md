# Optimizer Unified Test Plan

> **Status**: Active Test Plan  
> **Created**: January 25, 2026  
> **Last Updated**: January 25, 2026  
> **Related**: OPTIMIZER-EXECUTION-PLAN.md

---

## Overview

This document defines the unified testing strategy for the Blend65 optimizer. All tests follow the principles in `.clinerules/code.md` (Rules 4-8) and are designed to validate optimization correctness and effectiveness.

---

## Test Categories

| Category | Description | Location |
|----------|-------------|----------|
| **Unit Tests** | Individual pass testing | `__tests__/optimizer/` |
| **Integration Tests** | Pass pipeline testing | `__tests__/optimizer/integration/` |
| **E2E Tests** | Full compilation with metrics | `__tests__/e2e/` |
| **Regression Tests** | Previously found bugs | `__tests__/optimizer/regression/` |

---

## Test Count Summary

| Wave | Component | Unit Tests | Integration | E2E | Total |
|------|-----------|------------|-------------|-----|-------|
| **1** | Pass Manager | 75 | 25 | 0 | 100 |
| **2** | Analysis Passes | 50 | 20 | 0 | 70 |
| **3** | O1 Transforms | 100 | 15 | 10 | 125 |
| **4** | IL Peephole | 100 | 15 | 10 | 125 |
| **5** | ASM-IL Peephole | 100 | 15 | 10 | 125 |
| **TOTAL** | | **425** | **90** | **30** | **545** |

---

## Unit Test Standards

### Naming Convention

```typescript
describe('PassName', () => {
  describe('method/feature', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test implementation
    });
  });
});
```

### Test Structure

```typescript
// Each test should follow AAA pattern:
it('should eliminate dead store', () => {
  // Arrange - Set up test data
  const func = createTestFunction([
    store('x', 10),
    store('x', 20),  // This should be removed
    ret(),
  ]);
  
  // Act - Run the optimization
  const dce = new DCEPass();
  const changed = dce.transform(func);
  
  // Assert - Verify results
  expect(changed).toBe(true);
  expect(func.getInstructions()).toHaveLength(2);
  expect(func.getInstruction(0).getValue()).toBe(20);
});
```

---

## Wave 1: Pass Manager Tests (~100 tests)

### Session 1.1: Pass Base Classes (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 1.1.1 | PassKind enum values are distinct | HIGH |
| 1.1.2 | Pass abstract class enforces name property | HIGH |
| 1.1.3 | Pass abstract class enforces requires array | HIGH |
| 1.1.4 | Pass abstract class enforces invalidates array | HIGH |
| 1.1.5 | AnalysisPass.analyze() returns result | HIGH |
| 1.1.6 | TransformPass.transform() returns boolean | HIGH |
| 1.1.7 | Pass.getRequires() returns dependencies | MEDIUM |
| 1.1.8 | Pass.getInvalidates() returns invalidation list | MEDIUM |
| 1.1.9 | Pass.getLevels() returns enabled levels | MEDIUM |
| 1.1.10 | Concrete pass can extend AnalysisPass | HIGH |
| 1.1.11 | Concrete pass can extend TransformPass | HIGH |
| 1.1.12-25 | Additional edge cases and error conditions | LOW-MEDIUM |

### Session 1.2: PassManager Core (~30 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 1.2.1 | registerPass() adds pass to registry | HIGH |
| 1.2.2 | registerPass() rejects duplicate names | HIGH |
| 1.2.3 | getPass() retrieves by name | HIGH |
| 1.2.4 | getPass() returns undefined for unknown | MEDIUM |
| 1.2.5 | run() executes passes in order | HIGH |
| 1.2.6 | run() returns OptimizationResult | HIGH |
| 1.2.7 | run() tracks changed status | HIGH |
| 1.2.8 | getAnalysis() runs analysis pass | HIGH |
| 1.2.9 | getAnalysis() caches results | HIGH |
| 1.2.10 | invalidateAnalysis() clears cache | HIGH |
| 1.2.11 | Transform invalidates dependent analyses | HIGH |
| 1.2.12 | Dependencies are resolved correctly | HIGH |
| 1.2.13-30 | Additional scenarios and error handling | MEDIUM |

### Session 1.3: OptimizationOptions (~20 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 1.3.1 | Default level is O0 | HIGH |
| 1.3.2 | getPassesForLevel(O0) returns empty | HIGH |
| 1.3.3 | getPassesForLevel(O1) returns basic passes | HIGH |
| 1.3.4 | getPassesForLevel(O2) includes peephole | HIGH |
| 1.3.5 | Per-pass enable/disable works | HIGH |
| 1.3.6 | Disabled pass is skipped | HIGH |
| 1.3.7 | Os prefers size over speed | MEDIUM |
| 1.3.8-20 | Level combinations and options | MEDIUM |

### Session 1.4: Pipeline Builder (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 1.4.1 | PipelineBuilder creates empty pipeline | HIGH |
| 1.4.2 | addPass() adds to pipeline | HIGH |
| 1.4.3 | build() returns configured PassManager | HIGH |
| 1.4.4 | Preset O0 creates pass-through | HIGH |
| 1.4.5 | Preset O1 includes DCE, ConstFold, etc. | HIGH |
| 1.4.6 | Preset O2 includes peephole | HIGH |
| 1.4.7 | Pipeline respects dependencies | HIGH |
| 1.4.8-25 | Pipeline configurations and edge cases | MEDIUM |

---

## Wave 2: Analysis Pass Tests (~70 tests)

### Session 2.1: Use-Def Analysis (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 2.1.1 | Tracks definition for assignment | HIGH |
| 2.1.2 | Tracks multiple uses | HIGH |
| 2.1.3 | getUseCount() returns correct count | HIGH |
| 2.1.4 | isUnused() returns true for dead value | HIGH |
| 2.1.5 | hasOneUse() returns true for single use | HIGH |
| 2.1.6 | getDefinition() returns instruction | HIGH |
| 2.1.7 | Handles phi nodes correctly | HIGH |
| 2.1.8 | Handles function parameters | MEDIUM |
| 2.1.9-25 | Cross-block analysis, edge cases | MEDIUM |

### Session 2.2: Liveness Analysis (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 2.2.1 | Computes liveIn for basic block | HIGH |
| 2.2.2 | Computes liveOut for basic block | HIGH |
| 2.2.3 | isLiveAt() returns true for live value | HIGH |
| 2.2.4 | isLiveAt() returns false for dead value | HIGH |
| 2.2.5 | Handles control flow merge points | HIGH |
| 2.2.6 | Handles loops correctly | HIGH |
| 2.2.7-25 | Complex CFG scenarios | MEDIUM |

### Session 2.3: Analysis Infrastructure (~20 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 2.3.1 | Analysis passes register with manager | HIGH |
| 2.3.2 | Analysis results are cached | HIGH |
| 2.3.3 | Invalidation clears correct analyses | HIGH |
| 2.3.4-20 | Integration scenarios | MEDIUM |

---

## Wave 3: O1 Transform Tests (~125 tests)

### Session 3.1: DCE Tests (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 3.1.1 | Removes unused arithmetic | HIGH |
| 3.1.2 | Removes unused load | HIGH |
| 3.1.3 | Preserves store (side effect) | HIGH |
| 3.1.4 | Preserves call (side effect) | HIGH |
| 3.1.5 | Preserves volatile read | HIGH |
| 3.1.6 | Removes chained dead code | HIGH |
| 3.1.7 | Handles phi nodes | MEDIUM |
| 3.1.8 | Iterates to fixed point | HIGH |
| 3.1.9-25 | Edge cases and complex scenarios | MEDIUM |

### Session 3.2: Constant Folding Tests (~30 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 3.2.1 | Folds `1 + 2` → `3` | HIGH |
| 3.2.2 | Folds `10 - 3` → `7` | HIGH |
| 3.2.3 | Folds `5 * 4` → `20` | HIGH |
| 3.2.4 | Folds `20 / 4` → `5` | HIGH |
| 3.2.5 | Folds `255 + 1` → `0` (byte overflow) | HIGH |
| 3.2.6 | Folds `$FFFF + 1` → `0` (word overflow) | HIGH |
| 3.2.7 | Folds `$F0 & $0F` → `0` | HIGH |
| 3.2.8 | Folds `$F0 | $0F` → `$FF` | HIGH |
| 3.2.9 | Folds `$FF ^ $FF` → `0` | HIGH |
| 3.2.10 | Folds `~$00` → `$FF` | HIGH |
| 3.2.11 | Folds `4 << 2` → `16` | HIGH |
| 3.2.12 | Folds `16 >> 2` → `4` | HIGH |
| 3.2.13 | Folds `1 < 2` → `true` | HIGH |
| 3.2.14 | Folds `2 == 2` → `true` | HIGH |
| 3.2.15 | Does not fold non-constants | HIGH |
| 3.2.16-30 | Signed operations, edge cases | MEDIUM |

### Session 3.3: Constant Propagation Tests (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 3.3.1 | Propagates simple constant | HIGH |
| 3.3.2 | Propagates through multiple blocks | HIGH |
| 3.3.3 | Does not propagate non-constants | HIGH |
| 3.3.4 | Handles phi with constant inputs | MEDIUM |
| 3.3.5-25 | Complex scenarios | MEDIUM |

### Session 3.4: Copy Propagation Tests (~20 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 3.4.1 | Propagates simple copy | HIGH |
| 3.4.2 | Propagates copy chain | HIGH |
| 3.4.3 | Does not propagate modified value | HIGH |
| 3.4.4 | Cross-block propagation | MEDIUM |
| 3.4.5-20 | Edge cases | MEDIUM |

### Session 3.5: O1 Integration + E2E (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 3.5.1 | O1 pipeline runs all passes | HIGH |
| 3.5.2 | E2E: O1 reduces instruction count | HIGH |
| 3.5.3 | E2E: O1 preserves semantics | HIGH |
| 3.5.4-25 | Integration scenarios | MEDIUM |

---

## Wave 4: IL Peephole Tests (~125 tests)

### Session 4.1: Pattern Framework (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 4.1.1 | Pattern interface enforced | HIGH |
| 4.1.2 | BasePattern helpers work | HIGH |
| 4.1.3 | Pattern categories defined | MEDIUM |
| 4.1.4-25 | Framework functionality | MEDIUM |

### Session 4.2: Pattern Registry & Matcher (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 4.2.1 | Registry registers patterns | HIGH |
| 4.2.2 | Registry filters by category | HIGH |
| 4.2.3 | Registry filters by level | HIGH |
| 4.2.4 | Matcher finds matches | HIGH |
| 4.2.5 | Matcher applies replacements | HIGH |
| 4.2.6-25 | Matching scenarios | MEDIUM |

### Session 4.3: Load/Store Patterns (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 4.3.1 | Store-Load elimination | HIGH |
| 4.3.2 | Load-Load elimination | HIGH |
| 4.3.3 | Dead store elimination | HIGH |
| 4.3.4 | No elimination for different addresses | HIGH |
| 4.3.5-25 | Edge cases | MEDIUM |

### Session 4.4: Arithmetic Patterns (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 4.4.1 | `x + 0` → `x` | HIGH |
| 4.4.2 | `x * 1` → `x` | HIGH |
| 4.4.3 | `x * 2` → `x << 1` | HIGH |
| 4.4.4 | `x * 4` → `x << 2` | HIGH |
| 4.4.5 | `x - x` → `0` | HIGH |
| 4.4.6 | `x | x` → `x` | HIGH |
| 4.4.7-25 | Additional patterns | MEDIUM |

### Session 4.5: O2 Integration + E2E (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 4.5.1 | O2 includes peephole | HIGH |
| 4.5.2 | E2E: O2 ≥ O1 improvement | HIGH |
| 4.5.3 | E2E: Strength reduction applied | HIGH |
| 4.5.4-25 | Integration scenarios | MEDIUM |

---

## Wave 5: ASM-IL Peephole Tests (~125 tests)

### Session 5.1: Redundant Flag Patterns (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 5.1.1 | Remove CLC after ADC | HIGH |
| 5.1.2 | Remove duplicate CLC | HIGH |
| 5.1.3 | Preserve CLC across branch | HIGH |
| 5.1.4 | Remove SEC before SBC (if set) | HIGH |
| 5.1.5-25 | Flag state tracking | MEDIUM |

### Session 5.2: Zero-Flag Optimization (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 5.2.1 | Remove `CMP #0` after LDA | HIGH |
| 5.2.2 | Remove `CMP #0` after AND | HIGH |
| 5.2.3 | Preserve non-zero comparison | HIGH |
| 5.2.4-25 | Flag patterns | MEDIUM |

### Session 5.3: Load-Store Elimination (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 5.3.1 | Remove `LDA` after `STA` to same addr | HIGH |
| 5.3.2 | Preserve `LDA` with intervening modify | HIGH |
| 5.3.3 | Track register contents | HIGH |
| 5.3.4-25 | Complex scenarios | MEDIUM |

### Session 5.4: Branch & Transfer Patterns (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 5.4.1 | Collapse JMP chain | HIGH |
| 5.4.2 | Remove dead code after JMP | HIGH |
| 5.4.3 | Remove TAX; TXA pair | HIGH |
| 5.4.4-25 | Transfer patterns | MEDIUM |

### Session 5.5: ASM-IL Integration + E2E (~25 tests)

| Test ID | Description | Priority |
|---------|-------------|----------|
| 5.5.1 | ASM-IL optimizer runs all passes | HIGH |
| 5.5.2 | E2E: ASM output is smaller | HIGH |
| 5.5.3 | E2E: CLC/SEC count reduced | HIGH |
| 5.5.4-25 | Full pipeline tests | MEDIUM |

---

## E2E Test Fixtures

### Directory: `__tests__/e2e/fixtures/`

```
fixtures/
├── dead-code/
│   ├── unused-variable.blend      # Variable declared but never used
│   ├── unused-function.blend      # Function defined but never called
│   └── unreachable-code.blend     # Code after return statement
├── const-fold/
│   ├── arithmetic.blend           # Basic arithmetic folding
│   ├── comparison.blend           # Comparison folding
│   ├── overflow.blend             # 6502 overflow handling
│   └── bitwise.blend              # Bitwise operation folding
├── const-prop/
│   ├── simple.blend               # Simple constant propagation
│   ├── cross-block.blend          # Cross-block propagation
│   └── loop.blend                 # Loop constant detection
├── copy-prop/
│   ├── simple.blend               # Simple copy propagation
│   └── chain.blend                # Copy chain propagation
└── peephole/
    ├── load-store.blend           # Load/store patterns
    ├── strength.blend             # Strength reduction
    └── asm-flags.blend            # 6502 flag optimizations
```

### Example Fixture: `dead-code/unused-variable.blend`

```js
// Test fixture for DCE - unused variable
// Expected: O1 should eliminate the unused variable

function main(): void {
  let used: byte = 10;
  let unused: byte = 20;  // This should be eliminated
  
  @map borderColor at $D020: byte;
  borderColor = used;
}
```

---

## E2E Test Implementation

### Metrics Test Pattern

```typescript
// File: __tests__/e2e/optimizer-metrics.test.ts

import { compile } from '../test-utils.js';

describe('Optimizer Metrics', () => {
  describe('O1 vs O0', () => {
    it('should reduce instruction count for dead-code fixture', () => {
      const o0 = compile('fixtures/dead-code/unused-variable.blend', { level: 'O0' });
      const o1 = compile('fixtures/dead-code/unused-variable.blend', { level: 'O1' });
      
      expect(o1.instructionCount).toBeLessThan(o0.instructionCount);
      expect(o1.cycleCount).toBeLessThanOrEqual(o0.cycleCount);
    });
    
    it('should fold constant arithmetic', () => {
      const o0 = compile('fixtures/const-fold/arithmetic.blend', { level: 'O0' });
      const o1 = compile('fixtures/const-fold/arithmetic.blend', { level: 'O1' });
      
      expect(o1.instructionCount).toBeLessThan(o0.instructionCount);
    });
  });
  
  describe('O2 vs O1', () => {
    it('should apply strength reduction', () => {
      const o1 = compile('fixtures/peephole/strength.blend', { level: 'O1' });
      const o2 = compile('fixtures/peephole/strength.blend', { level: 'O2' });
      
      // O2 should use shifts instead of multiply
      expect(o2.asm).toContain('ASL');
      expect(o2.asm).not.toContain('JSR _multiply');
    });
  });
});
```

### Correctness Test Pattern

```typescript
// File: __tests__/e2e/semantic-correctness.test.ts

describe('Semantic Correctness', () => {
  it('should preserve program behavior across optimization levels', () => {
    const source = loadFixture('fixtures/const-fold/arithmetic.blend');
    
    const o0Result = compile(source, { level: 'O0' });
    const o1Result = compile(source, { level: 'O1' });
    const o2Result = compile(source, { level: 'O2' });
    
    // All should produce same output when executed
    // (This requires VICE emulator integration)
    expect(execute(o1Result)).toEqual(execute(o0Result));
    expect(execute(o2Result)).toEqual(execute(o0Result));
  });
});
```

---

## Test Helper Functions

```typescript
// File: __tests__/optimizer/test-utils.ts

import { ILFunction, ILInstruction, ILBuilder } from '../../il/index.js';

/**
 * Create a test function with given instructions.
 */
export function createTestFunction(instructions: ILInstruction[]): ILFunction {
  const builder = new ILBuilder();
  const func = builder.createFunction('test');
  const entry = func.getEntryBlock();
  
  for (const inst of instructions) {
    entry.addInstruction(inst);
  }
  
  return func;
}

/**
 * Assert that a function contains exactly the expected instructions.
 */
export function assertInstructions(
  func: ILFunction, 
  expected: string[]
): void {
  const actual = func.getBlocks()
    .flatMap(b => b.getInstructions())
    .map(i => i.toString());
  
  expect(actual).toEqual(expected);
}

/**
 * Count instructions of a specific opcode.
 */
export function countOpcode(func: ILFunction, opcode: string): number {
  return func.getBlocks()
    .flatMap(b => b.getInstructions())
    .filter(i => i.getOpcode() === opcode)
    .length;
}
```

---

## Test Coverage Requirements

Per `.clinerules/code.md` Rule 6:

| Component | Target Coverage | Priority |
|-----------|-----------------|----------|
| Pass Base Classes | 100% | HIGH |
| PassManager | 100% | HIGH |
| Analysis Passes | 95%+ | HIGH |
| Transform Passes | 95%+ | HIGH |
| Peephole Patterns | 90%+ | HIGH |
| Pipeline Builder | 95%+ | MEDIUM |
| ASM-IL Passes | 90%+ | HIGH |

---

## Running Tests

```bash
# Run all optimizer tests
clear && yarn test --reporter=dot optimizer

# Run specific wave tests
clear && yarn test --reporter=dot pass-manager
clear && yarn test --reporter=dot analysis
clear && yarn test --reporter=dot transforms

# Run E2E tests
clear && yarn test --reporter=dot e2e

# Run with coverage
clear && yarn test --coverage optimizer
```

---

## Cross-References

- **Execution Plan**: `OPTIMIZER-EXECUTION-PLAN.md`
- **Code Standards**: `.clinerules/code.md` (Rules 4-8)
- **Session Rules**: `.clinerules/agents.md` (Multi-session testing)

---

## Revision History

| Date | Change | By |
|------|--------|-----|
| 2026-01-25 | Initial creation | AI Session 0.2 |