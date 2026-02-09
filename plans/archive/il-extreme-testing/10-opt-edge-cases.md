# IL Optimizer Edge Case Tests

> **Document**: 10-opt-edge-cases.md
> **Parent**: [Index](00-index.md)

## Overview

Edge case tests that verify the IL Optimizer handles boundary conditions and unusual inputs correctly. These tests catch bugs that only appear in specific scenarios.

## Test Files

### File 1: `optimizer/edge-cases/boundary-values.test.ts`

**Purpose**: Verify optimizer handles boundary values correctly

**Tests (10-12)**:
1. Constant fold with 0 operand
2. Constant fold with 255 operand
3. Constant fold with 65535 operand (word)
4. Constant fold result = 0
5. Constant fold result = 255
6. Constant fold overflow result
7. Constant fold underflow result
8. Boolean boundary: true (1) operations
9. Boolean boundary: false (0) operations
10. Shift by 0 (identity)
11. Shift by 7 (max for byte)
12. Comparison at boundaries (0 vs 255)

**Verification**: Boundary values handled correctly, no off-by-one

---

### File 2: `optimizer/edge-cases/degenerate-code.test.ts`

**Purpose**: Verify optimizer handles degenerate/unusual code

**Tests (8-10)**:
1. Empty function - no crash, no change
2. Single instruction function - handled correctly
3. Function with only RETURN - preserved
4. Function with all dead code - optimizes to minimal
5. Function with no optimization opportunities - no change
6. Already optimal code - no change, fast exit
7. Code with only NOPs - removed safely
8. Code with only labels - preserved correctly
9. Function with maximum instructions - doesn't crash
10. Function with zero instructions - handled

**Verification**: Degenerate inputs don't crash or corrupt

---

### File 3: `optimizer/edge-cases/pass-interactions.test.ts`

**Purpose**: Verify optimizer passes interact correctly

**Tests (10-12)**:
1. DCE enables constant fold (dead store removal reveals constant)
2. Constant fold enables DCE (fold to unused result)
3. Copy propagation enables DCE (copy reveals dead original)
4. Constant propagation enables constant fold
5. Peephole enables DCE (identity removal reveals dead load)
6. All passes in sequence - correct final state
7. Pass A + Pass B same as Pass B + Pass A (commutativity where expected)
8. Double application of same pass - idempotent
9. Cascading chain: A enables B enables C enables D
10. Maximum cascading depth handled
11. Pass interaction doesn't create new bugs
12. Statistics correct after multi-pass

**Verification**: Pass interactions produce correct results

---

### File 4: `optimizer/edge-cases/optimizer-limits.test.ts`

**Purpose**: Verify optimizer respects its limits

**Tests (8-10)**:
1. Maximum iterations limit enforced
2. Minimum improvement threshold respected
3. Function size limit handled
4. Program size limit handled
5. Memory usage stays bounded
6. Timeout protection works
7. Statistics overflow protection
8. Pass count limit respected
9. Instruction count limit handled
10. Graceful degradation at limits

**Verification**: Limits enforced, no resource exhaustion

---

### File 5: `optimizer/edge-cases/negative-cases.test.ts`

**Purpose**: Verify optimizer correctly does NOT optimize certain cases

**Tests (10-12)**:
1. Does NOT remove stores to hardware-mapped addresses
2. Does NOT remove stores to exported variables
3. Does NOT reorder hardware register writes
4. Does NOT fold volatile-like reads
5. Does NOT propagate across function calls (conservative)
6. Does NOT remove necessary loop variables
7. Does NOT remove callback function code
8. Does NOT break observable behavior
9. Does NOT optimize at O0 level
10. Does NOT exceed specified optimization level
11. Does NOT optimize disabled passes
12. Does NOT modify already-processed code incorrectly

**Verification**: Optimizer knows when NOT to optimize

---

## Implementation Pattern

```typescript
/**
 * IL Optimizer Edge Case Test: [Category]
 * Testing [category] boundary conditions
 */
import { describe, it, expect } from 'vitest';
import { ILOptimizer } from '../../../../optimizer/index.js';
import { createTestILFunction, createTestInstructions } from '../../helpers/optimizer-test-utils.js';

describe('[Category] Edge Cases', () => {
  describe('[subcategory]', () => {
    it('should handle [edge case]', () => {
      const func = createTestILFunction('test', [
        // Edge case instructions
      ]);
      
      const optimizer = new ILOptimizer({ level: 'O2' });
      
      // Should not crash
      expect(() => optimizer.optimizeFunction(func)).not.toThrow();
      
      const result = optimizer.getLastResult();
      
      // Verify edge case handled correctly
      expect(result).toBeDefined();
    });
  });
});
```

## Edge Case Categories

### Boundary Values

| Value | Why It's an Edge |
|-------|-----------------|
| 0 | Zero, identity, false |
| 1 | One, identity, true |
| 255 | Max byte, overflow boundary |
| 256 | First value > byte |
| 65535 | Max word |

### Degenerate Inputs

| Input | Why It's Degenerate |
|-------|---------------------|
| Empty function | No instructions to optimize |
| Single instruction | Minimal input |
| All dead code | Everything removed |
| No opportunities | Nothing to do |
| Already optimal | Second pass idempotent |

### Pass Interactions

| Interaction | What to Test |
|-------------|-------------|
| A enables B | Pass A reveals opportunity for B |
| A + B = B + A | Order independence |
| A + A = A | Idempotence |
| A → B → C → D | Long chains |

## Negative Test Patterns

### Hardware Registers Must NOT Be Optimized Away

```typescript
// This store is "dead" locally but MUST be preserved
@map borderColor at $D020: byte;
borderColor = 0;  // MUST NOT be removed by DCE
```

### Function Calls Are Barriers

```typescript
let x: byte = 5;
unknownFunction();  // Might read x
let y: byte = x;    // CANNOT assume x is still 5
```

### Exported Globals Must Be Preserved

```typescript
export let counter: byte = 0;
counter = counter + 1;  // MUST preserve even if no local reads
```

## Verification Strategies

| Edge Case | Verification |
|-----------|-------------|
| Boundary values | Exact values after optimization |
| Degenerate inputs | No crash, reasonable output |
| Pass interactions | Correct final state |
| Limits | Termination, no resource exhaustion |
| Negative cases | Code preserved, not optimized |

## Common Edge Case Bugs

| Bug | How to Detect |
|-----|---------------|
| Boundary off-by-one | Test 0, 255, 256 boundaries |
| Empty input crash | Test empty/single instruction |
| Pass order sensitivity | Test different orderings |
| Resource exhaustion | Test at limits |
| Over-optimization | Test negative cases |

## Test Data for Boundaries

### Byte Boundaries

```typescript
const BYTE_EDGES = [0, 1, 127, 128, 254, 255];
```

### Word Boundaries

```typescript
const WORD_EDGES = [0, 1, 255, 256, 32767, 32768, 65534, 65535];
```

### Instruction Count Boundaries

```typescript
const INSTR_EDGES = [0, 1, 10, 100, 500, 1000];
```