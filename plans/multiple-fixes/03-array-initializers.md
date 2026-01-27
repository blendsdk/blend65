# Array Initializers: Technical Specification

> **Document**: 03-array-initializers.md
> **Parent**: [Index](00-index.md)

## Overview

Array literals like `[1, 2, 3]` must generate correct byte values in the output assembly. Currently, the IL generator does not extract the values from `ArrayLiteralExpression` AST nodes, resulting in `initialValue: undefined` in the IL module.

## Architecture

### Current Architecture

```
VariableDecl (AST)
    └── initializer: ArrayLiteralExpression
            └── elements: [NumericLiteral(1), NumericLiteral(2), NumericLiteral(3)]

                    ↓ IL Generator (BUG HERE)

ILGlobalVariable
    └── initialValue: undefined  ← Should be [1, 2, 3]

                    ↓ Code Generator

Assembly
    └── !byte $00  ← Should be !byte $01, $02, $03
```

### Proposed Changes

```
VariableDecl (AST)
    └── initializer: ArrayLiteralExpression
            └── elements: [NumericLiteral(1), NumericLiteral(2), NumericLiteral(3)]

                    ↓ IL Generator (FIXED)

ILGlobalVariable
    └── initialValue: [1, 2, 3]  ← Extracted values

                    ↓ Code Generator (already works)

Assembly
    └── !byte $01, $02, $03  ← Correct output
```

## Implementation Details

### Location

File: `packages/compiler/src/il/generator.ts`

Find where `VariableDecl` is processed and add array literal value extraction.

### New Helper Function

```typescript
/**
 * Extracts numeric values from an ArrayLiteralExpression
 * 
 * @param arrayLiteral - The array literal AST node
 * @returns Array of numeric values, or undefined if extraction fails
 */
protected extractArrayLiteralValues(
  arrayLiteral: ArrayLiteralExpression
): number[] | undefined {
  const values: number[] = [];
  
  for (const element of arrayLiteral.getElements()) {
    if (element instanceof NumericLiteral) {
      values.push(element.getValue());
    } else if (element instanceof UnaryExpression) {
      // Handle negative numbers: -1
      const operand = element.getOperand();
      if (operand instanceof NumericLiteral && element.getOperator() === '-') {
        values.push(-operand.getValue());
      } else {
        // Non-constant expression - cannot extract at compile time
        return undefined;
      }
    } else {
      // Non-constant element - cannot extract at compile time
      return undefined;
    }
  }
  
  return values;
}
```

### Integration Point

Find the method that creates `ILGlobalVariable` from `VariableDecl` and add:

```typescript
// When processing VariableDecl initializer:
if (initializer instanceof ArrayLiteralExpression) {
  const values = this.extractArrayLiteralValues(initializer);
  if (values !== undefined) {
    ilVariable.initialValue = values;
  }
  // If values is undefined, fall through to existing zero-fill behavior
}
```

## Code Examples

### Example 1: Basic Array Initializer

```js
// Input
let data: byte[3] = [1, 2, 3];

// Expected IL
{
  name: "data",
  type: { kind: "array", elementType: { kind: "byte" }, length: 3 },
  initialValue: [1, 2, 3],
  storageClass: "ram"
}

// Expected Assembly
_data:
  !byte $01, $02, $03  ; data
```

### Example 2: Hex Array Initializer

```js
// Input
let colors: byte[4] = [$10, $20, $30, $40];

// Expected IL
{
  name: "colors",
  initialValue: [16, 32, 48, 64]  // Numeric values
}

// Expected Assembly
_colors:
  !byte $10, $20, $30, $40  ; colors
```

### Example 3: Mixed Literals

```js
// Input
let mixed: byte[4] = [255, $FF, 0b11111111, 0xFF];

// Expected IL
{
  initialValue: [255, 255, 255, 255]  // All same value
}

// Expected Assembly
_mixed:
  !byte $FF, $FF, $FF, $FF  ; mixed
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Non-numeric element | Leave `initialValue` undefined, generate zero-fill |
| Variable reference in array | Leave `initialValue` undefined, emit warning |
| Function call in array | Leave `initialValue` undefined, emit warning |
| Type mismatch (word values in byte array) | Semantic analyzer should catch this |

## Testing Requirements

1. **Unit test**: IL generator extracts values from simple array literal
2. **Unit test**: IL generator extracts values from hex literals
3. **Unit test**: IL generator extracts values from binary literals
4. **Unit test**: IL generator returns undefined for non-constant elements
5. **E2E test**: Enable skipped test `should generate correct values for byte array initializer`
6. **E2E test**: Enable skipped test `should generate correct values for hex array initializer`
7. **E2E test**: Enable skipped test `array literal should generate correct byte values`

## Files to Modify

1. `packages/compiler/src/il/generator.ts` - Add value extraction
2. `packages/compiler/src/__tests__/e2e/smoke.test.ts` - Enable test
3. `packages/compiler/src/__tests__/e2e/literals.test.ts` - Enable 2 tests

## Estimated Effort

- Implementation: 30-45 minutes
- Testing: 15-20 minutes
- Total: ~1 hour