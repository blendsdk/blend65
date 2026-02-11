# Constant Folding for Address Expressions

> **Document**: 03-constant-folding.md
> **Parent**: [Index](00-index.md)

## Overview

The `tryResolveConstantAddress()` method in the IL generator needs to be extended to handle `BinaryExpression` nodes where both operands resolve to compile-time constants. This enables patterns like `poke(SCREEN_BASE + 250 + i, value)` where the AST structure is `(SCREEN_BASE + 250) + i` — the left sub-expression `SCREEN_BASE + 250` must be folded to a single constant.

## Architecture

### Current Architecture

```
tryResolveConstantAddress(expr)
  ├── isLiteralExpression → return literal value
  ├── isIdentifierExpression → lookup const → recurse on initializer
  └── return undefined (EVERYTHING ELSE FAILS)
```

### Proposed Changes

```
tryResolveConstantAddress(expr)
  ├── isLiteralExpression → return literal value
  ├── isIdentifierExpression → lookup const → recurse on initializer
  ├── isBinaryExpression with PLUS → recurse both sides → add    ← NEW
  ├── isBinaryExpression with MINUS → recurse both sides → subtract ← NEW
  └── return undefined
```

## Implementation Details

### Modified Method: `tryResolveConstantAddress()`

**File:** `packages/compiler/src/il/generator/expressions.ts` (line ~855)

```typescript
protected tryResolveConstantAddress(expr: Expression): number | undefined {
    // Case 1: Numeric literal (e.g., $D020, 53280, 0xD020)
    if (isLiteralExpression(expr)) {
      const value = expr.getValue();
      if (typeof value === 'number') {
        return value;
      }
    }

    // Case 2: Constant identifier reference (e.g., BORDER where const BORDER = $D020)
    if (isIdentifierExpression(expr)) {
      const name = expr.getName();
      const symbol = this.symbolTable.lookupGlobal(name);
      if (symbol && symbol.isConst && symbol.initializer) {
        return this.tryResolveConstantAddress(symbol.initializer);
      }
    }

    // Case 3: Binary expression with constant operands (e.g., SCREEN_BASE + 250)
    // Supports addition and subtraction — the two operators used in address arithmetic.
    // Both sides must resolve to compile-time constants for folding to occur.
    if (isBinaryExpression(expr)) {
      const binExpr = expr as BinaryExpression;
      const op = binExpr.getOperator();

      if (op === TokenType.PLUS || op === TokenType.MINUS) {
        const leftVal = this.tryResolveConstantAddress(binExpr.getLeft());
        const rightVal = this.tryResolveConstantAddress(binExpr.getRight());

        if (leftVal !== undefined && rightVal !== undefined) {
          // Perform the arithmetic and mask to 16-bit range (valid 6502 address space)
          const result = op === TokenType.PLUS
            ? leftVal + rightVal
            : leftVal - rightVal;
          return result & 0xFFFF;
        }
      }
    }

    // Cannot resolve to a constant address
    return undefined;
  }
```

### How It Solves the Problem

For `poke(SCREEN_BASE + 250 + i, SPACE_CHAR)`:

1. AST structure: `BinaryExpr(BinaryExpr(SCREEN_BASE, +, 250), +, i)`
2. `tryResolveConstantAddress` is called on the whole expression by `generatePokeIntrinsic` — fails (contains variable `i`)
3. `tryDecomposeIndexedAddress` is called:
   - Top-level: `+` with left=`(SCREEN_BASE + 250)`, right=`i`
   - Calls `tryResolveConstantAddress(SCREEN_BASE + 250)`:
     - **NEW** Case 3 fires: it's a BinaryExpression with `+`
     - Left: `tryResolveConstantAddress(SCREEN_BASE)` → 0x0400 ✅
     - Right: `tryResolveConstantAddress(250)` → 250 ✅
     - Returns `0x0400 + 250 = 0x04FA` ✅
   - Returns `{ base: 0x04FA, offsetExpr: i }`
4. IL generator emits: `TAX` + `POKE $04FA,X` — correct!

### Deeply Nested Constants

For `poke(BASE + HEADER_SIZE + ROW_OFFSET + i, value)` where all but `i` are constants:

AST: `((BASE + HEADER_SIZE) + ROW_OFFSET) + i`

1. `tryDecomposeIndexedAddress` gets `+` with left=`((BASE + HEADER_SIZE) + ROW_OFFSET)`, right=`i`
2. `tryResolveConstantAddress((BASE + HEADER_SIZE) + ROW_OFFSET)`:
   - Case 3: `+` → recurse left and right
   - Left: `tryResolveConstantAddress((BASE + HEADER_SIZE))`:
     - Case 3: `+` → recurse left and right
     - Left: `tryResolveConstantAddress(BASE)` → resolved via Case 2
     - Right: `tryResolveConstantAddress(HEADER_SIZE)` → resolved via Case 2
     - Returns: BASE + HEADER_SIZE ✅
   - Right: `tryResolveConstantAddress(ROW_OFFSET)` → resolved via Case 2
   - Returns: BASE + HEADER_SIZE + ROW_OFFSET ✅
3. Returns `{ base: folded_constant, offsetExpr: i }` ✅

## Code Examples

### Before Fix (FAILS)

```js
const SCREEN_BASE: word = $0400;
const SCREEN_WIDTH: byte = 40;

function clearScreen(): void {
    for (let i: byte = 0 to 249) {
        poke(SCREEN_BASE + i, 32);           // ✅ Works (CONST + var)
        poke(SCREEN_BASE + 250 + i, 32);     // ❌ FAILS (compound constant)
        poke(SCREEN_BASE + 500 + i, 32);     // ❌ FAILS
        poke(SCREEN_BASE + 750 + i, 32);     // ❌ FAILS
    }
}
```

### After Fix (WORKS)

```js
const SCREEN_BASE: word = $0400;

function clearScreen(): void {
    for (let i: byte = 0 to 249) {
        poke(SCREEN_BASE + i, 32);           // ✅ STA $0400,X
        poke(SCREEN_BASE + 250 + i, 32);     // ✅ STA $04FA,X (folded)
        poke(SCREEN_BASE + 500 + i, 32);     // ✅ STA $05F4,X (folded)
        poke(SCREEN_BASE + 750 + i, 32);     // ✅ STA $06EE,X (folded)
    }
}
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Overflow past $FFFF | Mask with `& 0xFFFF` (wrap around) |
| Underflow below $0000 | Mask with `& 0xFFFF` (wrap to high addresses) |
| Non-numeric constants | `tryResolveConstantAddress` returns `undefined` — no folding |
| Multiplication/division in address | Not folded — returns `undefined` (fallback to error) |

## Testing Requirements

- Unit tests for `tryResolveConstantAddress` with binary expressions
- Integration tests for `poke(CONST + CONST + var)` pattern through full pipeline
- Edge cases: $FFFF overflow, subtraction, deeply nested constants
- Regression: all existing poke/peek tests must pass unchanged
