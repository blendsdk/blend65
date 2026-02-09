# IL Optimizer Correctness Tests

> **Document**: 09-opt-correctness.md
> **Parent**: [Index](00-index.md)

## Overview

Correctness tests that verify the IL Optimizer doesn't break program semantics. These are the most critical tests - an optimizer that produces faster but incorrect code is worse than no optimizer at all.

## Test Files

### File 1: `optimizer/e2e/correctness/dce-correctness.test.ts`

**Purpose**: Verify DCE preserves all necessary code

**Tests (10-12)**:
1. DCE preserves stores to exported globals
2. DCE preserves stores read later in same function
3. DCE preserves stores read by called function
4. DCE preserves side-effect expressions
5. DCE preserves return value computation
6. DCE preserves loop control variables
7. DCE preserves condition variables
8. DCE preserves callback function bodies
9. DCE removes ONLY truly dead stores
10. DCE handles aliasing correctly (if supported)
11. DCE preserves volatile-like access patterns
12. DCE preserves stores to mapped hardware addresses

**Verification**: All necessary code remains after DCE

---

### File 2: `optimizer/e2e/correctness/constant-fold-correctness.test.ts`

**Purpose**: Verify constant folding produces correct values

**Tests (12-15)**:
1. Addition: 5 + 3 = 8
2. Subtraction: 10 - 4 = 6
3. Multiplication: 6 * 7 = 42
4. Division: 20 / 4 = 5
5. Modulo: 17 % 5 = 2
6. AND: 0xAB & 0x0F = 0x0B
7. OR: 0x0F | 0xF0 = 0xFF
8. XOR: 0xAA ^ 0x55 = 0xFF
9. Left shift: 1 << 3 = 8
10. Right shift: 16 >> 2 = 4
11. Comparison: 5 < 10 = true (1)
12. Comparison: 10 == 10 = true (1)
13. Overflow handling: 255 + 1 wraps to 0
14. Underflow handling: 0 - 1 wraps to 255
15. Chained folding: 2 + 3 + 4 = 9

**Verification**: Folded values exactly correct

---

### File 3: `optimizer/e2e/correctness/propagation-correctness.test.ts`

**Purpose**: Verify constant/copy propagation maintains correctness

**Tests (10-12)**:
1. Constant propagation: `let x = 5; y = x` → y gets 5
2. Copy propagation: `let x = a; y = x` → y uses a
3. Propagation stops at modification: `x = 5; x = 6; y = x` → y gets 6
4. Propagation stops at function call (conservative)
5. Propagation respects scope boundaries
6. Propagation handles loop variables correctly
7. Propagation handles conditional assignments
8. Propagation doesn't propagate across aliasing
9. Propagation handles array elements correctly
10. Propagation handles function parameters
11. Chained propagation: `x = 5; y = x; z = y` → z gets 5
12. Propagation with expressions: `x = 5; y = x + 1` → y gets 6

**Verification**: Propagated values always correct

---

### File 4: `optimizer/e2e/correctness/peephole-correctness.test.ts`

**Purpose**: Verify peephole patterns are semantically correct

**Tests (10-12)**:
1. Identity removal: `x + 0` still yields x
2. Identity removal: `x * 1` still yields x
3. Identity removal: `x & 0xFF` still yields x (for byte)
4. Identity removal: `x | 0` still yields x
5. Strength reduction: `x * 2` equals `x << 1`
6. Strength reduction: `x / 2` equals `x >> 1`
7. Double negation: `!!x` still yields boolean x
8. Double NOT: `~~x` still yields x
9. Load-store elimination: value preserved
10. Algebraic: `x - x` yields 0
11. Algebraic: `x ^ x` yields 0
12. Short-circuit preserved: `a && b` doesn't evaluate b if a false

**Verification**: Each pattern transformation correct

---

### File 5: `optimizer/e2e/correctness/order-preservation.test.ts`

**Purpose**: Verify optimizer preserves necessary ordering

**Tests (8-10)**:
1. Memory write ordering preserved (write A before write B)
2. Memory read ordering preserved (read order matters)
3. Function call ordering preserved (side effects)
4. Comparison ordering preserved (a < b, not b > a issues)
5. Loop iteration ordering preserved
6. Initialization ordering preserved
7. Cleanup ordering preserved
8. Interrupt-sensitive ordering preserved
9. Hardware register access ordering preserved
10. Dependency chain ordering preserved

**Verification**: Order-sensitive operations stay in order

---

### File 6: `optimizer/e2e/correctness/semantic-equivalence.test.ts`

**Purpose**: Verify optimized code is semantically equivalent

**Tests (8-10)**:
1. Simple program: same behavior before/after optimization
2. Loop program: same iteration results
3. Conditional program: same branch taken
4. Function program: same return values
5. Array program: same element values
6. Arithmetic program: same computed results
7. Bitwise program: same bit patterns
8. State machine: same state transitions
9. Complex program: all behaviors preserved
10. Edge case program: boundary behaviors preserved

**Verification**: Observable behavior identical

---

## Implementation Pattern

```typescript
/**
 * IL Optimizer Correctness Test: [Category]
 * Verifying [category] optimization correctness
 */
import { describe, it, expect } from 'vitest';
import { 
  compileAndOptimize,
  compareILResults,
  simulateIL,
  verifySemanticEquivalence
} from '../../helpers/optimizer-test-utils.js';

describe('[Category] Correctness', () => {
  describe('[subcategory]', () => {
    it('should preserve [semantic property]', () => {
      const source = `
        module Test;
        function compute(): byte {
          // Code with specific semantic
          let x: byte = 5;
          let y: byte = x + 3;
          return y;
        }
      `;
      
      const { programBefore, programAfter } = compileAndOptimize(source, 'O2');
      
      // Verify semantic equivalence
      const resultBefore = simulateIL(programBefore);
      const resultAfter = simulateIL(programAfter);
      
      expect(resultAfter).toEqual(resultBefore);
    });
    
    it('should NOT optimize away [required element]', () => {
      // Test that necessary code is preserved
    });
  });
});
```

## Correctness Categories

| Category | What Could Go Wrong | How to Test |
|----------|---------------------|-------------|
| DCE | Removes needed code | Check all uses still work |
| Constant fold | Wrong arithmetic result | Verify exact values |
| Propagation | Stale values used | Check values at each point |
| Peephole | Pattern doesn't preserve semantics | Test each pattern |
| Ordering | Operations reordered incorrectly | Check sequence dependencies |
| Equivalence | Overall behavior changed | Compare before/after results |

## Critical Correctness Scenarios

### DCE Must NOT Remove

```typescript
// Store to hardware register - MUST preserve
borderColor = 0;

// Store read by called function - MUST preserve  
let x = 5;
useX();  // reads x

// Store to exported global - MUST preserve
export let counter = 0;
counter = counter + 1;

// Store in loop that affects condition - MUST preserve
while (x < 10) {
  x = x + 1;  // Affects loop condition
}
```

### Constant Fold Must Be Exact

```typescript
// All these must fold to exact values
let a: byte = 100 + 55;    // Must be 155, not 156
let b: byte = 255 + 1;     // Must be 0 (overflow)
let c: byte = 0 - 1;       // Must be 255 (underflow)
let d: byte = 128 + 128;   // Must be 0 (overflow)
```

### Propagation Must Respect Boundaries

```typescript
let x: byte = 5;
x = 10;           // x is now 10, not 5
let y: byte = x;  // y must be 10

// After function call, x might have changed
someFunction();
let z: byte = x;  // Must NOT assume x is still 10
```

## Verification Strategies

### Direct Value Comparison

```typescript
function verifyConstantFold(before: number, op: string, after: number, expected: number) {
  const source = `let result: byte = ${before} ${op} ${after};`;
  const { program } = compileAndOptimize(source, 'O2');
  const loadImm = findInstruction(program, ILOpcode.LOAD_IMM);
  expect(getOperandValue(loadImm)).toBe(expected);
}
```

### Semantic Simulation

```typescript
function simulateAndCompare(source: string) {
  const { before, after } = compileAndOptimize(source, 'O2');
  
  // Simple IL simulator
  const resultBefore = simulateIL(before);
  const resultAfter = simulateIL(after);
  
  expect(resultAfter.returnValue).toBe(resultBefore.returnValue);
  expect(resultAfter.sideEffects).toEqual(resultBefore.sideEffects);
}
```

## Common Optimizer Bugs to Catch

| Bug | Test |
|-----|------|
| Removes needed store | DCE correctness tests |
| Wrong arithmetic | Constant fold with edge values |
| Stale value | Propagation after modification |
| Pattern mismatch | Each peephole pattern test |
| Reordering | Order-sensitive operations |
| Lost precision | Arithmetic edge cases |