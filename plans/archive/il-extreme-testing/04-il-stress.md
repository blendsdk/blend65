# IL Generator Stress Tests

> **Document**: 04-il-stress.md
> **Parent**: [Index](00-index.md)

## Overview

Stress tests that push the IL Generator to its limits. These tests verify the compiler handles scale gracefully and doesn't fail on larger programs.

## Test Files

### File 1: `il/e2e/stress/deep-nesting.test.ts`

**Purpose**: Verify IL generation handles deeply nested structures

**Tests (8-10)**:
1. 5 levels of if-else nesting
2. 10 levels of if-else nesting
3. 5 levels of while loop nesting
4. 10 levels of for loop nesting
5. Mixed if/while nesting (10 levels)
6. 15 levels of expression nesting: `((((a + b) * c) - d) / e)...`
7. Nested ternary expressions (5 levels)
8. Nested scope variable shadowing (10 levels, same var name)
9. Nested function calls (a calling b calling c... 10 deep)
10. Break/continue in 5-level nested loops

**Verification**: 
- Correct JUMP targets at all nesting levels
- Proper scope handling (variable disambiguation)
- No stack overflow or hang

---

### File 2: `il/e2e/stress/many-functions.test.ts`

**Purpose**: Verify IL generation handles programs with many functions

**Tests (8-10)**:
1. 20 functions in one module
2. 50 functions in one module
3. 100 functions in one module (if feasible)
4. Function calling 10 other functions (fan-out)
5. 10 functions calling same helper (fan-in)
6. Long call chain: a → b → c → ... → j (10 functions)
7. Mutual recursion pattern: a ↔ b
8. Cycle: a → b → c → a
9. Functions with varying parameter counts (0 to 5 params each)
10. Mix of void and returning functions (50/50)

**Verification**:
- All functions appear in IL program
- CALL instructions have correct targets
- Parameter passing works at scale

---

### File 3: `il/e2e/stress/many-variables.test.ts`

**Purpose**: Verify IL generation handles functions with many variables

**Tests (8-10)**:
1. Function with 10 local variables
2. Function with 25 local variables
3. Function with 50 local variables
4. Function with complex variable interdependencies
5. Module with 50 global variables
6. Module with 100 global variables
7. Function using all 50 variables in expression
8. Variables with complex initialization expressions
9. Sparse variable usage (50 defined, 5 used)
10. All variables participate in computation

**Verification**:
- All variables get frame slots
- No slot collision
- Correct LOAD/STORE for each variable

---

### File 4: `il/e2e/stress/large-programs.test.ts`

**Purpose**: Verify IL generation handles large complete programs

**Tests (6-8)**:
1. 200 IL instruction program (10 functions × 20 instructions avg)
2. 500 IL instruction program (20 functions × 25 instructions avg)
3. 1000 IL instruction program (if feasible)
4. Balanced program: 50 small functions (10 instructions each)
5. Unbalanced program: 5 large functions (100 instructions each)
6. Real game simulation: init + game loop + cleanup structure
7. Multi-system program: input + logic + render subsystems
8. Performance benchmark: timing large compilation

**Verification**:
- Program compiles successfully
- IL count matches expectations
- No timeout or memory issues

---

## Implementation Pattern

```typescript
/**
 * IL Generator Stress Test: [Category]
 * Stress testing [category] limits
 */
import { describe, it, expect } from 'vitest';
import { compileToIL } from '../../helpers/il-test-utils.js';

describe('[Category] Stress Tests', () => {
  describe('[subcategory]', () => {
    it('should handle [N] [things]', () => {
      // Generate large source programmatically
      const source = generateLargeProgram(/* params */);
      
      const startTime = Date.now();
      const program = compileToIL(source);
      const duration = Date.now() - startTime;
      
      // Verify success
      expect(program).toBeDefined();
      expect(program.functions.length).toBe(expectedCount);
      
      // Verify performance (should complete quickly)
      expect(duration).toBeLessThan(5000); // 5 second limit
    });
  });
});

// Helper to generate large programs
function generateLargeProgram(/* params */): string {
  // Build source programmatically
}
```

## Source Generation Helpers

### Generate Deep Nesting

```typescript
function generateDeepIf(depth: number): string {
  let code = '';
  let indent = '  ';
  for (let i = 0; i < depth; i++) {
    code += `${indent}if (x > ${i}) {\n`;
    indent += '  ';
  }
  code += `${indent}x = 1;\n`;
  for (let i = 0; i < depth; i++) {
    indent = indent.slice(2);
    code += `${indent}}\n`;
  }
  return code;
}
```

### Generate Many Functions

```typescript
function generateManyFunctions(count: number): string {
  let code = 'module Stress;\n';
  for (let i = 0; i < count; i++) {
    code += `function fn${i}(): void {\n`;
    code += `  let x: byte = ${i % 256};\n`;
    code += `}\n`;
  }
  return code;
}
```

### Generate Many Variables

```typescript
function generateManyVariables(count: number): string {
  let code = 'module Stress;\nfunction test(): void {\n';
  for (let i = 0; i < count; i++) {
    code += `  let v${i}: byte = ${i % 256};\n`;
  }
  code += '}\n';
  return code;
}
```

## Stress Test Limits

| Category | Conservative | Aggressive | Maximum |
|----------|--------------|------------|---------|
| Nesting depth | 5 | 10 | 20 |
| Functions | 20 | 50 | 100 |
| Variables | 25 | 50 | 100 |
| IL instructions | 200 | 500 | 1000 |

## Performance Expectations

| Test Type | Expected Duration |
|-----------|-------------------|
| Deep nesting (10 levels) | < 500ms |
| Many functions (50) | < 1000ms |
| Many variables (50) | < 500ms |
| Large program (500 IL) | < 2000ms |
| Full stress suite | < 10000ms |

## Verification Strategies

| Stress Type | What to Verify |
|-------------|----------------|
| Deep nesting | Correct JUMP targets, no stack overflow |
| Many functions | All functions in output, correct call targets |
| Many variables | All variables allocated, no collisions |
| Large programs | Compiles without error, reasonable time |