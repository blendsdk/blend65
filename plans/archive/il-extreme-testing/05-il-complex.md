# IL Generator Complex Combination Tests

> **Document**: 05-il-complex.md
> **Parent**: [Index](00-index.md)

## Overview

Tests that verify the IL Generator handles complex combinations of features working together. These tests catch interaction bugs that simple unit tests miss.

## Test Files

### File 1: `il/e2e/complex/nested-loops-calls.test.ts`

**Purpose**: Verify loops combined with function calls work correctly

**Tests (8-10)**:
1. Loop calling function each iteration
2. Function containing loop (loop inside function)
3. Loop calling function that contains loop
4. Nested loop with function call in inner loop
5. Function call in loop condition expression
6. Function call in loop increment expression
7. Accumulator pattern: loop with function adding to sum
8. Loop with multiple function calls per iteration
9. Recursive function called from loop
10. Two loops in sequence, both calling functions

**Verification**:
- CALL appears inside loop body
- Loop variables correct across calls
- Return values captured properly

---

### File 2: `il/e2e/complex/expression-trees.test.ts`

**Purpose**: Verify complex expression compositions generate correct IL

**Tests (8-10)**:
1. Binary tree: `a + b + c + d + e + f + g + h` (left-associative chain)
2. Mixed precedence: `a + b * c - d / e`
3. Comparison chain: `a < b && b < c && c < d`
4. Bitwise chain: `a & b | c ^ d`
5. Array index expression: `arr[x + y * width]`
6. Complex boolean: `(a > 0 && b < 10) || (c == 5 && d != 0)`
7. Nested ternary: `a ? (b ? c : d) : (e ? f : g)`
8. Function call in expression: `a + getOffset() * stride`
9. Multi-term arithmetic: `a * b + c * d - e * f`
10. Bitwise with arithmetic: `(value << 4) | (value >> 4)`

**Verification**:
- Correct operator precedence in IL
- Correct operand order
- Temporary values handled properly

---

### File 3: `il/e2e/complex/control-flow-matrix.test.ts`

**Purpose**: Verify all control flow combinations

**Tests (8-10)**:
1. if inside while
2. while inside if
3. for inside for inside for (3-level)
4. if-elseif-elseif-else chain (4+ branches)
5. Early return from inside loop
6. Early return from inside nested if
7. Loop with multiple break points
8. Loop with multiple continue points
9. Switch-like pattern (if-else chain matching value)
10. Guard clause pattern (multiple early returns)

**Verification**:
- JUMP targets correct for all branches
- Early returns don't break enclosing structures
- Break/continue target correct loops

---

### File 4: `il/e2e/complex/array-operations.test.ts`

**Purpose**: Verify array-heavy patterns generate correct IL

**Tests (8-10)**:
1. Array iteration forward: `for i in 0..length`
2. Array iteration backward: `for i in length-1..0 step -1`
3. Array linear search (find first match)
4. Array accumulation (sum all elements)
5. Array min/max finding
6. Two-array compare (element by element)
7. Two-array copy
8. 2D array access: `arr[y * width + x]`
9. Array with computed index: `arr[getIndex()]`
10. Array element assignment in loop

**Verification**:
- LOAD_BYTE from array addresses
- STORE_BYTE to array addresses
- Index calculations correct

---

### File 5: `il/e2e/complex/state-machines.test.ts`

**Purpose**: Verify state machine patterns common in games

**Tests (8-10)**:
1. Simple 3-state machine (idle → active → done)
2. State machine with 5 states
3. State machine with 10 states
4. State transitions with conditions
5. State with entry action (code on state enter)
6. State with exit action (code on state leave)
7. State machine in main loop
8. State machine with data (state + associated value)
9. Parallel state machines (two state vars)
10. State machine with sub-states

**Verification**:
- State variable LOAD/STORE correct
- COMPARE for state checking
- JUMP for state transitions

---

### File 6: `il/e2e/complex/multi-module.test.ts`

**Purpose**: Verify multi-module scenarios (if supported)

**Tests (6-8)**:
1. Two modules with export/import
2. Three modules in chain: A imports B imports C
3. Module with all functions exported
4. Module with mix of exported/private functions
5. Cross-module function calls
6. Cross-module variable access (globals)
7. Module with only declarations, no implementation
8. Diamond dependency: A imports B and C, both import D

**Verification**:
- Cross-module CALL targets correct
- Exported functions accessible
- Private functions not leaked

---

## Implementation Pattern

```typescript
/**
 * IL Generator Complex Test: [Category]
 * Testing [category] feature combinations
 */
import { describe, it, expect } from 'vitest';
import { compileToIL, countOpcode, findInstructions } from '../../helpers/il-test-utils.js';
import { ILOpcode } from '../../../../il/enums.js';

describe('[Category] Combinations', () => {
  describe('[subcategory]', () => {
    it('should generate correct IL for [combination]', () => {
      const source = `
        module Test;
        // Complex combination code
      `;
      
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main');
      
      // Verify combination works
      expect(main).toBeDefined();
      
      // Check specific opcode patterns
      const calls = findInstructions(main!.instructions, ILOpcode.CALL);
      const jumps = findInstructions(main!.instructions, ILOpcode.JUMP);
      
      // Verify interaction is correct
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
```

## Feature Interaction Matrix

| Feature A | Feature B | Test File |
|-----------|-----------|-----------|
| Loops | Function calls | nested-loops-calls.test.ts |
| Expressions | Operators | expression-trees.test.ts |
| if | while/for | control-flow-matrix.test.ts |
| Arrays | Loops | array-operations.test.ts |
| Variables | Conditionals | state-machines.test.ts |
| Modules | Functions | multi-module.test.ts |

## Verification Strategies

| Combination | Key Verification |
|-------------|------------------|
| Loop + Call | CALL inside loop IL range |
| Expression tree | Correct precedence, correct temps |
| Control flow | All JUMP targets valid |
| Array + Loop | Index calculation correct |
| State machine | State compare and branch correct |
| Multi-module | Cross-module references resolved |

## Complex Pattern Examples

### Loop Calling Function
```typescript
function update(): void {
  let sum: byte = 0;
  for (let i: byte = 0; i < 10; i = i + 1) {
    sum = sum + getValue(i);
  }
}
```

### Expression Tree
```typescript
let result: byte = (a + b) * (c - d) / (e & f | g);
```

### State Machine
```typescript
function tick(): void {
  if (state == STATE_IDLE) {
    if (input > 0) {
      state = STATE_ACTIVE;
    }
  } else if (state == STATE_ACTIVE) {
    if (timer == 0) {
      state = STATE_DONE;
    }
  }
}
```