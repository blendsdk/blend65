# Compound Assignment Fixes

> **Document**: 04-compound-assignment-fixes.md
> **Parent**: [Index](00-index.md)

## Overview

Compound assignments (`*=`, `/=`, `%=`, `<<=`, `>>=`) currently generate incorrect code.
The `generateCompoundAssignment()` literal switch and `generateCompoundOperation()` method
need fixes to actually perform the operations.

## Current State

### `generateCompoundAssignment()` Literal Path

The switch statement handles:
- ✅ `PLUS_ASSIGN` → `addImm`
- ✅ `MINUS_ASSIGN` → `subImm`
- ✅ `BITWISE_AND_ASSIGN` → `andImm`
- ✅ `BITWISE_OR_ASSIGN` → `orImm`
- ✅ `BITWISE_XOR_ASSIGN` → `xorImm`
- ❌ `MULTIPLY_ASSIGN` → falls to default (no-op)
- ❌ `DIVIDE_ASSIGN` → falls to default (no-op)
- ❌ `MODULO_ASSIGN` → falls to default (no-op)
- ❌ `LEFT_SHIFT_ASSIGN` → falls to default (no-op)
- ❌ `RIGHT_SHIFT_ASSIGN` → falls to default (no-op)

### `generateCompoundOperation()` (Non-Literal Path)

This method is called when the compound assignment value is a complex expression.
It currently just does `POP_A` for ALL operators — losing the operation entirely.

## Fix D: Add Missing Compound Assignment Literal Cases

In `generateCompoundAssignment()`, add to the literal switch:

```typescript
case TokenType.MULTIPLY_ASSIGN:
  this.builder.mulImm(literalValue);
  break;
case TokenType.DIVIDE_ASSIGN:
  this.builder.divImm(literalValue);
  break;
case TokenType.MODULO_ASSIGN:
  this.builder.modImm(literalValue);
  break;
case TokenType.LEFT_SHIFT_ASSIGN:
  this.builder.shl(literalValue, `<<= ${literalValue}`);
  break;
case TokenType.RIGHT_SHIFT_ASSIGN:
  this.builder.shr(literalValue, `>>= ${literalValue}`);
  break;
```

**Note**: `divImm` and `modImm` are the new builder methods from Fix A (doc 03).

## Fix E: Fix `generateCompoundOperation()` for Non-Literal Values

The non-literal compound path has the same problem as the complex binary path:
it needs to store the right value to ZP temp, pop the left, and operate.

Rewrite `generateCompoundOperation()` to reuse the ZP temp slot pattern:

```typescript
protected generateCompoundOperation(op: TokenType): void {
  // At entry: stack has current value, A has new value (right operand)
  // Strategy: store right to ZP temp, pop current to A, operate with ZP temp

  const zpTemp = this.createZpTempSlot();

  // Store right operand (new value) to ZP temp
  this.builder.storeSlot(zpTemp, 'save compound value to temp');

  // Pop current variable value back to A
  this.builder.emit(ILOpcode.POP_A, [], 'restore current value');

  // Apply the compound operation: A = current OP temp
  switch (op) {
    case TokenType.PLUS_ASSIGN:
      this.builder.addSlot(zpTemp, 'compound +=');
      break;
    case TokenType.MINUS_ASSIGN:
      this.builder.subSlot(zpTemp, 'compound -=');
      break;
    case TokenType.MULTIPLY_ASSIGN:
      this.builder.mulSlot(zpTemp, 'compound *=');
      break;
    case TokenType.DIVIDE_ASSIGN:
      this.builder.divSlot(zpTemp, 'compound /=');
      break;
    case TokenType.MODULO_ASSIGN:
      this.builder.modSlot(zpTemp, 'compound %=');
      break;
    case TokenType.BITWISE_AND_ASSIGN:
      this.builder.andSlot(zpTemp, 'compound &=');
      break;
    case TokenType.BITWISE_OR_ASSIGN:
      this.builder.orSlot(zpTemp, 'compound |=');
      break;
    case TokenType.BITWISE_XOR_ASSIGN:
      this.builder.xorSlot(zpTemp, 'compound ^=');
      break;
    default:
      // Shift compound assigns and unknown — just keep current value
      break;
  }
}
```

## Testing Requirements

- Unit tests for each new compound assignment case with literal values
- Unit tests for compound assignment with variable (non-literal) values
- E2E test showing `x *= 2` produces correct assembly
- E2E test showing `x %= 3` produces correct assembly
