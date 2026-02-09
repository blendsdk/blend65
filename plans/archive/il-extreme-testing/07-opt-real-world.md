# IL Optimizer Real-World Tests

> **Document**: 07-opt-real-world.md
> **Parent**: [Index](00-index.md)

## Overview

Real-world optimization scenarios that the IL Optimizer must handle correctly. These tests verify that actual game code patterns optimize as expected without breaking correctness.

## Test Files

### File 1: `optimizer/e2e/real-world/game-loop-opt.test.ts`

**Purpose**: Verify game loop patterns optimize correctly

**Tests (8-10)**:
1. Frame counter increment optimization (constant fold `counter + 1`)
2. Loop-invariant state checks hoisted
3. Dead flag assignments removed
4. Redundant flag loads eliminated
5. Exit condition constant propagation
6. State variable copy propagation
7. Unused game state removal
8. Frame timing constant folding
9. Subsystem call ordering preserved
10. Main loop structure preserved (no breaking changes)

**Verification**: Optimizations happen, game loop still works correctly

---

### File 2: `optimizer/e2e/real-world/sprite-opt.test.ts`

**Purpose**: Verify sprite manipulation code optimizes correctly

**Tests (8-10)**:
1. Sprite position constant calculation folding
2. Redundant sprite enable loads removed
3. Sprite coordinate copy propagation
4. Dead sprite assignments removed
5. MSB calculation optimization (x > 255 check)
6. Sprite index calculation folding
7. Animation frame modulo constant folding
8. Collision check optimization
9. Sprite pool enable/disable optimization
10. Multiple sprite updates coalesced where safe

**Verification**: Sprite code faster, still correct behavior

---

### File 3: `optimizer/e2e/real-world/memory-access-opt.test.ts`

**Purpose**: Verify memory operation optimizations

**Tests (8-10)**:
1. Redundant load after store eliminated (store-load forwarding)
2. Dead stores to local variables removed
3. Loop-invariant loads hoisted (conceptually)
4. Address calculation constant folding
5. Sequential access pattern optimization
6. Constant address resolution
7. Zero-initialization optimization
8. Memory fill loop optimization
9. Copy loop optimization
10. Screen clear loop optimization

**Verification**: Memory operations faster, still correct

---

### File 4: `optimizer/e2e/real-world/input-handling-opt.test.ts`

**Purpose**: Verify input handling code optimizes correctly

**Tests (8-10)**:
1. Joystick bit extraction constant folding (`& 0x1F`)
2. Direction flag constant propagation
3. Input comparison optimization
4. Dead input variable removal
5. Debounce comparison optimization
6. Input buffer index folding
7. Keyboard matrix constant folding
8. Diagonal detection optimization
9. Fire button check optimization
10. Input state copy propagation

**Verification**: Input handling faster, still responsive

---

### File 5: `optimizer/e2e/real-world/arithmetic-opt.test.ts`

**Purpose**: Verify C64-relevant arithmetic optimizes correctly

**Tests (8-10)**:
1. Screen coordinate calculation folding (`y * 40 + x`)
2. Tile map index calculation folding
3. Color value manipulation optimization
4. Sprite position wrapping optimization
5. Fixed-point arithmetic folding
6. Multiplication strength reduction (× 2 → << 1)
7. Division strength reduction (÷ 2 → >> 1)
8. Modulo optimization (% power of 2 → &)
9. Combined arithmetic chain folding
10. Address offset calculation folding

**Verification**: Arithmetic faster, results still correct

---

### File 6: `optimizer/e2e/real-world/loop-opt.test.ts`

**Purpose**: Verify loop optimization patterns

**Tests (8-10)**:
1. Loop counter constant propagation
2. Loop bound constant folding
3. Loop increment optimization
4. Dead loop variable removal
5. Loop with invariant condition
6. Nested loop counter optimization
7. Loop exit condition optimization
8. Loop body dead code removal
9. Loop iteration count folding
10. For-loop initialization optimization

**Verification**: Loops faster, correct iteration count

---

### File 7: `optimizer/e2e/real-world/function-opt.test.ts`

**Purpose**: Verify function-related optimization patterns

**Tests (8-10)**:
1. Constant argument propagation into function call
2. Return value propagation to caller
3. Dead function call removal (if pure and unused)
4. Parameter copy propagation
5. Local variable constant propagation
6. Return expression folding
7. Multiple return value uses optimization
8. Function call with all-constant args folding
9. Void function dead call removal
10. Unused return value handling

**Verification**: Function calls faster, behavior preserved

---

## Implementation Pattern

```typescript
/**
 * IL Optimizer Real-World Test: [Category] Optimization
 * Testing [category] optimization patterns
 */
import { describe, it, expect } from 'vitest';
import { 
  compileAndOptimize, 
  countOpcode, 
  verifyNoOpcode,
  getOptimizationStats 
} from '../../helpers/optimizer-test-utils.js';
import { ILOpcode } from '../../../../il/enums.js';

describe('[Category] Optimization', () => {
  describe('[subcategory]', () => {
    it('should optimize [pattern]', () => {
      const source = `
        module Test;
        function main(): void {
          // C64-realistic code with optimization opportunity
        }
      `;
      
      const { program, stats } = compileAndOptimize(source, 'O2');
      
      // Verify optimization happened
      expect(stats.modified).toBe(true);
      expect(stats.instructionsRemoved).toBeGreaterThan(0);
      
      // Verify specific optimization
      const main = program.functions.find(f => f.name === 'main');
      expect(countOpcode(main!.instructions, ILOpcode.DEAD_OP)).toBe(0);
    });
    
    it('should preserve correctness of [pattern]', () => {
      // Verify the optimization doesn't break semantics
    });
  });
});
```

## Optimization Verification Strategies

| Pattern Type | Optimization Expected | Correctness Check |
|--------------|----------------------|-------------------|
| Game loop | Dead code removal | Loop structure preserved |
| Sprite | Constant folding | Positions correct |
| Memory | Store-load forwarding | Values correct |
| Input | Bit extraction folding | Input still works |
| Arithmetic | Strength reduction | Results correct |
| Loops | Counter optimization | Iteration count correct |
| Functions | Constant propagation | Return values correct |

## Real-World Optimization Opportunities

### Game Loop

```typescript
// Before optimization
let frame: word = 0;
frame = frame + 1;  // ADD_IMM 1 → can be optimized

// After: Direct increment, or constant if provable
```

### Sprite Position

```typescript
// Before optimization
let x: byte = 100;
let screenX: byte = x * 2;  // MUL_IMM 2 → SHL_IMM 1

// After: Strength reduction to shift
```

### Memory Fill

```typescript
// Before optimization
let i: byte = 0;
while (i < 40) {
  screen[i] = 32;  // Constant in loop
  i = i + 1;
}

// After: Store constant folded, loop optimized
```

## Expected Optimization Rates

| Pattern Category | Typical Reduction |
|-----------------|-------------------|
| Game loop | 10-20% |
| Sprite handling | 15-25% |
| Memory operations | 20-30% |
| Input handling | 10-15% |
| Arithmetic | 25-35% |
| Loops | 15-25% |
| Functions | 10-20% |