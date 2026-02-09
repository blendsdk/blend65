# IL Optimizer Stress Tests

> **Document**: 08-opt-stress.md
> **Parent**: [Index](00-index.md)

## Overview

Stress tests that push the IL Optimizer to its limits. These tests verify the optimizer handles scale gracefully, converges reliably, and doesn't time out or crash on large inputs.

## Test Files

### File 1: `optimizer/e2e/stress/large-function-opt.test.ts`

**Purpose**: Verify optimizer handles large functions

**Tests (8-10)**:
1. Function with 50 instructions - optimizes correctly
2. Function with 100 instructions - optimizes correctly
3. Function with 200 instructions - optimizes correctly
4. Function with 500 instructions - optimizes correctly
5. Function with many optimization opportunities (50+)
6. Function with no optimization opportunities
7. Function with sparse opportunities (1 in 20)
8. Function with dense opportunities (every instruction)
9. Optimization time scales linearly (not exponentially)
10. Memory usage stays bounded

**Verification**:
- Optimization completes
- Time within limits
- Correct results

---

### File 2: `optimizer/e2e/stress/many-passes.test.ts`

**Purpose**: Verify optimizer handles multi-pass scenarios

**Tests (8-10)**:
1. Optimization requiring 2 passes to complete
2. Optimization requiring 5 passes to complete
3. Optimization requiring 10 passes (maximum)
4. Pass iteration reaches fixed point (convergence)
5. Pass ordering doesn't affect final result
6. DCE enables constant fold (chained passes)
7. Constant fold enables DCE (reverse chain)
8. All passes in sequence work together
9. Early termination when no changes
10. Pass statistics accurate across iterations

**Verification**:
- Fixed point reached
- Iteration count reasonable
- Final result correct

---

### File 3: `optimizer/e2e/stress/many-opportunities.test.ts`

**Purpose**: Verify optimizer handles many optimization opportunities

**Tests (8-10)**:
1. 20 dead code opportunities in one function
2. 50 dead code opportunities in one function
3. 20 constant fold opportunities in one function
4. 50 constant fold opportunities in one function
5. 20 copy propagation opportunities
6. 20 peephole opportunities (identity operations)
7. Mixed opportunities (10 of each type)
8. Cascading opportunities (one enables another)
9. All opportunities found and optimized
10. No opportunities missed due to iteration limit

**Verification**:
- All opportunities optimized
- No false negatives
- Statistics accurate

---

### File 4: `optimizer/e2e/stress/pathological-cases.test.ts`

**Purpose**: Verify optimizer handles pathological inputs

**Tests (8-10)**:
1. Code that alternates optimization state (on/off/on/off)
2. Code that requires maximum iterations
3. Code that changes significantly each pass
4. Code with conflicting optimizations
5. Code that's already optimal (no changes)
6. Code with minimal redundancy
7. Code with maximum redundancy
8. Code that triggers all passes every iteration
9. Worst-case time complexity input
10. Optimizer doesn't hang or crash

**Verification**:
- Terminates within limit
- No crashes or hangs
- Reasonable final state

---

## Implementation Pattern

```typescript
/**
 * IL Optimizer Stress Test: [Category]
 * Stress testing [category] limits
 */
import { describe, it, expect } from 'vitest';
import { ILOptimizer } from '../../../../optimizer/index.js';
import { generateLargeFunction, generateManyOpportunities } from '../../helpers/optimizer-test-utils.js';

describe('[Category] Stress Tests', () => {
  describe('[subcategory]', () => {
    it('should handle [N] [things]', () => {
      // Generate large input programmatically
      const func = generateLargeFunction(/* params */);
      
      const optimizer = new ILOptimizer({ level: 'O2' });
      
      const startTime = Date.now();
      optimizer.optimizeFunction(func);
      const duration = Date.now() - startTime;
      const result = optimizer.getLastResult();
      
      // Verify success
      expect(result).toBeDefined();
      
      // Verify performance
      expect(duration).toBeLessThan(5000); // 5 second limit
      
      // Verify correctness
      expect(result?.modified).toBeDefined();
    });
  });
});
```

## IL Generation Helpers

### Generate Large Function

```typescript
function generateLargeFunction(instructionCount: number): ILFunction {
  const instructions: ILInstruction[] = [];
  
  for (let i = 0; i < instructionCount; i++) {
    // Add mix of instructions
    if (i % 3 === 0) {
      instructions.push(createLoadImmInstr(i % 256));
    } else if (i % 3 === 1) {
      instructions.push(createAddImmInstr(1));
    } else {
      instructions.push(createStoreByteInstr(`v${i % 10}`));
    }
  }
  instructions.push(createReturnInstr());
  
  return createTestILFunction('stress', instructions);
}
```

### Generate Many Opportunities

```typescript
function generateManyDeadCodeOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [];
  
  // Create many dead stores
  for (let i = 0; i < count; i++) {
    instructions.push(createLoadImmInstr(i % 256));
    instructions.push(createStoreByteInstr(`dead${i}`)); // Never read
  }
  instructions.push(createReturnInstr());
  
  return createTestILFunction('stress', instructions);
}

function generateManyConstantFoldOpportunities(count: number): ILFunction {
  const instructions: ILInstruction[] = [];
  
  for (let i = 0; i < count; i++) {
    instructions.push(createLoadImmInstr(i % 128));
    instructions.push(createAddImmInstr((i + 1) % 128)); // Constant + constant
  }
  instructions.push(createReturnInstr());
  
  return createTestILFunction('stress', instructions);
}
```

## Stress Test Limits

| Category | Target | Maximum |
|----------|--------|---------|
| Instructions per function | 200 | 500 |
| Pass iterations | 10 | 20 |
| Opportunities per function | 50 | 100 |
| Functions per program | 50 | 100 |
| Total optimization time | 2s | 5s |

## Performance Expectations

| Test Type | Expected Duration |
|-----------|-------------------|
| Large function (100 instr) | < 200ms |
| Large function (200 instr) | < 500ms |
| Large function (500 instr) | < 2000ms |
| Many passes (10 iterations) | < 1000ms |
| Many opportunities (50) | < 500ms |
| Pathological case | < 5000ms |
| Full stress suite | < 30000ms |

## Verification Strategies

| Stress Type | What to Verify |
|-------------|----------------|
| Large function | Completes, correct result |
| Many passes | Converges, fixed point reached |
| Many opportunities | All found, statistics accurate |
| Pathological | Terminates, no crash |

## Convergence Testing

The optimizer should reach a fixed point where no more optimizations are possible:

```typescript
it('should reach fixed point', () => {
  const optimizer = new ILOptimizer({ level: 'O2' });
  
  // Run twice
  optimizer.optimizeFunction(func);
  const result1 = optimizer.getLastResult();
  
  optimizer.optimizeFunction(func);
  const result2 = optimizer.getLastResult();
  
  // Second run should make no changes (already optimal)
  expect(result2?.modified).toBe(false);
});
```

## Known Pathological Patterns

| Pattern | Why Pathological | Expected Behavior |
|---------|------------------|-------------------|
| Alternating optimization | Each pass undoes previous | Terminates at limit |
| Maximum chaining | Each optimization enables another | Many iterations |
| No opportunities | Scans everything, finds nothing | Fast rejection |
| All opportunities | Massive changes each pass | Many iterations |