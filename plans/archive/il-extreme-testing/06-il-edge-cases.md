# IL Generator Edge Case Tests

> **Document**: 06-il-edge-cases.md
> **Parent**: [Index](00-index.md)

## Overview

Edge case tests that verify the IL Generator handles boundary conditions correctly. These tests catch bugs that only appear with extreme or unusual values.

## Test Files

### File 1: `il/edge-cases/byte-boundaries.test.ts`

**Purpose**: Verify byte value boundaries are handled correctly

**Tests (10-12)**:
1. Byte literal 0
2. Byte literal 255
3. Byte literal 128 (sign bit boundary)
4. Byte literal 127 (max signed positive)
5. Byte arithmetic: 255 + 1 (overflow)
6. Byte arithmetic: 0 - 1 (underflow)
7. Byte arithmetic: 128 + 128 (overflow to 0)
8. Byte comparison: 0 vs 255
9. Byte comparison: 255 vs 0
10. Byte bitwise NOT of 0 (yields 255)
11. Byte bitwise NOT of 255 (yields 0)
12. Byte shift: 1 << 7 (yields 128)

**Verification**:
- LOAD_IMM has correct boundary values
- Arithmetic opcodes generated correctly
- No special case bugs

---

### File 2: `il/edge-cases/word-boundaries.test.ts`

**Purpose**: Verify word (16-bit) value boundaries are handled correctly

**Tests (10-12)**:
1. Word literal 0
2. Word literal 65535
3. Word literal 32768 (sign bit boundary)
4. Word literal 256 (just beyond byte)
5. Word arithmetic: 65535 + 1 (overflow)
6. Word arithmetic: 0 - 1 (underflow)
7. Word high byte extraction: value >> 8
8. Word low byte extraction: value & 0xFF
9. Word from bytes: (hi << 8) | lo
10. Word comparison: 0 vs 65535
11. Address pointer value: $C000
12. Word addition: $FF00 + $00FF = $FFFF

**Verification**:
- LOAD_IMM_WORD has correct values
- 16-bit operations generated
- Byte extraction correct

---

### File 3: `il/edge-cases/array-boundaries.test.ts`

**Purpose**: Verify array index boundaries are handled correctly

**Tests (8-10)**:
1. Array access at index 0 (first element)
2. Array access at last valid index
3. Array length 1 (single element)
4. Array length 255 (maximum byte index)
5. Array index from variable (dynamic)
6. Array index from expression
7. Array access in loop at boundaries
8. Two-dimensional array boundary: arr[0][0]
9. Two-dimensional array boundary: arr[max][max]
10. Array of arrays boundary access

**Verification**:
- Index calculations correct at boundaries
- No off-by-one in address calculation
- Dynamic index handled correctly

---

### File 4: `il/edge-cases/break-continue.test.ts`

**Purpose**: Verify break/continue in complex scenarios

**Tests (8-10)**:
1. Break in simple while loop
2. Break in simple for loop
3. Continue in simple while loop
4. Continue in simple for loop
5. Break in nested loops (breaks inner only)
6. Continue in nested loops (continues inner only)
7. Break after complex condition
8. Continue after complex condition
9. Multiple breaks in same loop (different conditions)
10. Break immediately (first iteration)

**Verification**:
- JUMP targets correct loop exit
- JUMP targets correct loop continue point
- Nested loop targets correct

---

### File 5: `il/edge-cases/operator-edge-cases.test.ts`

**Purpose**: Verify operator edge cases

**Tests (12-15)**:
1. Division by 1 (identity)
2. Multiplication by 1 (identity)
3. Multiplication by 0 (always 0)
4. Addition of 0 (identity)
5. Subtraction of 0 (identity)
6. AND with 0xFF (identity for byte)
7. AND with 0x00 (always 0)
8. OR with 0x00 (identity)
9. OR with 0xFF (always 0xFF)
10. XOR with same value (always 0)
11. XOR with 0 (identity)
12. Left shift by 0 (identity)
13. Right shift by 0 (identity)
14. Left shift by 8 (yields 0 for byte)
15. Logical NOT of true/false

**Verification**:
- Correct opcodes for all edge cases
- Identity operations not incorrectly optimized at IL level
- Zero results correct

---

## Implementation Pattern

```typescript
/**
 * IL Generator Edge Case Test: [Category]
 * Testing [category] boundary conditions
 */
import { describe, it, expect } from 'vitest';
import { compileToIL, getFirstInstruction, getOperandValue } from '../../helpers/il-test-utils.js';
import { ILOpcode } from '../../../../il/enums.js';

describe('[Category] Edge Cases', () => {
  describe('[subcategory]', () => {
    it('should handle [edge case]', () => {
      const source = `
        module Test;
        function test(): byte {
          let x: byte = 255;  // Edge value
          return x + 1;       // Edge operation
        }
      `;
      
      const program = compileToIL(source);
      const test = program.functions.find(f => f.name === 'test');
      
      // Verify edge case handled
      expect(test).toBeDefined();
      
      // Check specific instruction
      const loadImm = getFirstInstruction(test!.instructions, ILOpcode.LOAD_IMM);
      expect(loadImm).toBeDefined();
      expect(getOperandValue(loadImm!)).toBe(255);
    });
  });
});
```

## Edge Case Value Tables

### Byte Values

| Value | Significance |
|-------|--------------|
| 0 | Zero, false, minimum unsigned |
| 1 | One, true, minimum positive |
| 127 | Maximum signed positive |
| 128 | Minimum signed negative, sign bit |
| 255 | Maximum unsigned |

### Word Values

| Value | Significance |
|-------|--------------|
| 0 | Zero |
| 255 | Maximum byte |
| 256 | First value requiring word |
| 32767 | Maximum signed positive |
| 32768 | Minimum signed negative |
| 65535 | Maximum unsigned |

### Common C64 Addresses

| Address | Significance |
|---------|--------------|
| $0000 | Start of zero page |
| $00FF | End of zero page |
| $0100 | Start of stack |
| $01FF | End of stack |
| $0800 | Default BASIC start |
| $D000 | Start of I/O |
| $DFFF | End of I/O |
| $FFFF | Maximum address |

## Verification Strategies

| Edge Case | What to Verify |
|-----------|----------------|
| Byte boundaries | Correct immediate values |
| Word boundaries | Correct 16-bit handling |
| Array boundaries | No off-by-one errors |
| Break/continue | Correct jump targets |
| Operators | Correct opcodes, correct results |

## Common Edge Case Bugs

| Bug Type | How to Detect |
|----------|---------------|
| Off-by-one | Test index 0 and last index |
| Sign confusion | Test 127, 128 boundary |
| Overflow wrap | Test 255+1, 0-1 |
| Shift overflow | Test shift by 8 |
| Identity elision | Ensure +0, *1 still generate IL |