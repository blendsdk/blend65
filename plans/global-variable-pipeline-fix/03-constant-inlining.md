# Constant Inlining in Binary Expressions

> **Document**: 03-constant-inlining.md
> **Parent**: [Index](00-index.md)

## Overview

When a compile-time constant (e.g., `const SCREEN_WIDTH: byte = 40`) is used as an operand in a binary expression (e.g., `y * SCREEN_WIDTH`), the IL generator should emit an immediate instruction rather than a memory load. Currently, `generateIdentifier()` handles this correctly for standalone references, but `generateBinary()` does not.

## Architecture

### Current Flow (Broken)

```
y * SCREEN_WIDTH
  ↓ generateBinary()
  ↓ generateExpression(left=y)  →  LOAD_BYTE slot(y)
  ↓ isLiteralExpression(right)? → NO (it's an identifier)
  ↓ isIdentifierExpression(right)? → YES
  ↓ tryResolveVariable("SCREEN_WIDTH") → slot at address $06
  ↓ generateBinarySlot(MULTIPLY, slot) → MUL_BYTE slot($06)
  ↓ codegen: LDA $06 / STA $FF / JSR __mul8  ← WRONG
```

### Proposed Flow (Fixed)

```
y * SCREEN_WIDTH
  ↓ generateBinary()
  ↓ generateExpression(left=y)  →  LOAD_BYTE slot(y)
  ↓ isLiteralExpression(right)? → NO
  ↓ isIdentifierExpression(right)? → YES
  ↓ tryResolveConstantValue(right)? → 40  ← NEW CHECK
  ↓ generateBinaryImmediate(MULTIPLY, 40) → MUL_IMM #40
  ↓ codegen: LDA #$28 / STA $FF / JSR __mul8  ← CORRECT
```

## Implementation Details

### Change 1: Add constant resolution helper

In `expressions.ts`, add a helper that checks if an identifier expression resolves to a compile-time constant value:

```typescript
/**
 * Try to resolve an identifier expression to a compile-time constant value.
 * Returns the numeric value if the identifier is a const with a resolvable initializer.
 */
protected tryResolveConstantIdentifier(expr: Expression): number | undefined {
  if (!isIdentifierExpression(expr)) return undefined;
  const name = (expr as IdentifierExpression).getName();
  const symbol = this.symbolTable.lookupGlobal(name);
  if (symbol && symbol.isConst && symbol.initializer) {
    return this.tryResolveConstantAddress(symbol.initializer);
  }
  return undefined;
}
```

### Change 2: Modify `generateBinary()` byte path

In the byte binary path, after the literal check and before the slot check, add a constant identifier check:

```typescript
// Optimization: Check for constant identifier right operand
if (isIdentifierExpression(right)) {
  const constValue = this.tryResolveConstantIdentifier(right);
  if (constValue !== undefined) {
    this.generateBinaryImmediate(op, constValue);
    this.clearLocation();
    return;
  }
}
```

### Change 3: Modify `generateBinaryWord()` word path

Same pattern — check constant identifier before slot resolution:

```typescript
if (isIdentifierExpression(right)) {
  const constValue = this.tryResolveConstantIdentifier(right);
  if (constValue !== undefined) {
    this.generateBinaryWordImmediate(op, constValue);
    return;
  }
}
```

### Change 4: Modify compound assignment paths (optional but correct)

In `generateCompoundAssignment()`, when checking `isLiteralExpression(value)`, also handle constant identifiers with the same immediate path.

## Integration Points

- **No changes to codegen** — existing immediate opcode handling is correct
- **No changes to IL builder** — existing `mulImm()`, `addImm()` etc. work
- **No changes to frame allocator** — constant inlining happens at IL generation

## Error Handling

No new error cases — `tryResolveConstantAddress()` already handles all failure modes by returning `undefined`.

## Testing Requirements

- Unit: Binary expression with const right operand emits MUL_IMM not MUL_BYTE
- Unit: Const used in word binary expression emits ADD_WORD_BYTE_IMM
- Unit: Non-const identifiers still use slot path (regression)
- Unit: Compound assignment with const value uses immediate (optional)
- E2E: sprite-test `y * SCREEN_WIDTH` produces `LDA #$28` in assembly
