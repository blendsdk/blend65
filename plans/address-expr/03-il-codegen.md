# IL and Codegen Changes: Assembly-Time Address Expressions

> **Document**: 03-il-codegen.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies the changes needed across the compiler pipeline to support assembly-time address expressions.

## Architecture

### Pipeline Flow

```
Source: @balloonData / 64
  ↓
Parser: Binary(Unary(AT, "balloonData"), DIVIDE, Literal(64))
  ↓
IL Generator: detects @var / const pattern → LOAD_ADDRESS_EXPR opcode
  ↓
Codegen: LOAD_ADDRESS_EXPR → LDA Immediate with label expression
  ↓
Emitter: LDA #(__data_BalloonSprite_balloonData / 64)
```

## 1. IL Enums (`il/enums.ts`)

Add new opcode:

```typescript
/**
 * Load an assembly-time expression derived from a variable's address.
 *
 * Used when the address-of operator is combined with division or
 * right-shift by a compile-time constant: `@variable / N` or `@variable >> N`.
 *
 * For variables with ACME data labels, the assembler computes the
 * expression at assembly time (zero runtime cost):
 *   6502: LDA #(label / N)   or   LDA #(label >> N)
 *
 * For variables with known numeric addresses, the compiler constant-folds:
 *   6502: LDA #(address / N)  →  LDA #result
 *
 * Result: byte in A register (NOT word A:X like LOAD_ADDRESS).
 *
 * Operands: [SlotOperand, ImmediateOperand]
 *   - SlotOperand: the variable whose address to use
 *   - ImmediateOperand: the constant divisor/shift amount
 *     The `isWord` field distinguishes the operator:
 *     - isWord=false: division (label / N)
 *     - isWord=true: right-shift (label >> N)
 */
LOAD_ADDRESS_EXPR = 'LOAD_ADDRESS_EXPR',
```

## 2. IL Builder (`il/builder/memory.ts`)

Add builder method:

```typescript
/**
 * Load an assembly-time address expression into A.
 *
 * Emits LOAD_ADDRESS_EXPR for `@variable / N` or `@variable >> N`.
 * The assembler resolves the expression at assembly time.
 *
 * @param slot - Variable slot (provides the label or address)
 * @param constant - The divisor or shift amount
 * @param isShift - If true, uses >> operator; if false, uses / operator
 * @param comment - Optional comment
 */
loadAddressExpr(slot: FrameSlot, constant: number, isShift: boolean, comment?: string): void {
  this.emit(
    ILOpcode.LOAD_ADDRESS_EXPR,
    [createSlotOperand(slot), createImmediateOperand(constant, isShift)],
    comment
  );
}
```

## 3. IL Generator (`il/generator/expressions.ts`)

### Pattern Detection in `generateBinary()`

The key change: before dispatching to byte or word binary paths, check if the expression matches `@variable OP constant` where OP is `/` or `>>`.

**Insert at the TOP of `generateBinary()`, before the existing word/byte dispatch:**

```typescript
// Assembly-time address expression optimization:
// Detect pattern: @variable / constant  or  @variable >> constant
// When left is address-of and right is a compile-time constant,
// emit LOAD_ADDRESS_EXPR which the assembler resolves at assembly time.
if (this.tryGenerateAddressExpr(expr)) {
  this.clearLocation();
  return;
}
```

### New Method: `tryGenerateAddressExpr()`

```typescript
/**
 * Try to generate an assembly-time address expression.
 *
 * Detects the pattern: @variable / constant  or  @variable >> constant
 * where the left operand is an address-of unary expression and the
 * right operand is a compile-time constant.
 *
 * If the pattern matches, emits LOAD_ADDRESS_EXPR (byte result in A).
 * If not, returns false so normal binary generation proceeds.
 *
 * @param expr - Binary expression to check
 * @returns True if pattern was detected and IL emitted, false otherwise
 */
protected tryGenerateAddressExpr(expr: BinaryExpression): boolean {
  const op = expr.getOperator();

  // Only / and >> are supported for address expressions
  if (op !== TokenType.DIVIDE && op !== TokenType.RIGHT_SHIFT) {
    return false;
  }

  // Left must be address-of: @variable
  const left = expr.getLeft();
  if (!isUnaryExpression(left)) return false;
  const unary = left as UnaryExpression;
  if (unary.getOperator() !== TokenType.AT) return false;
  const operand = unary.getOperand();
  if (!isIdentifierExpression(operand)) return false;

  // Right must be a compile-time constant
  const right = expr.getRight();
  const constValue = this.tryResolveConstantAddress(right);
  if (constValue === undefined || constValue === 0) return false;

  // Resolve the variable to a slot
  const varName = (operand as IdentifierExpression).getName();
  const slot = this.tryResolveVariable(varName);
  if (!slot) return false;

  // For slots with known numeric addresses (RAM/ZP), constant-fold
  if (slot.address !== undefined && !slot.dataLabel) {
    const result = op === TokenType.DIVIDE
      ? Math.floor(slot.address / constValue) & 0xFF
      : (slot.address >>> constValue) & 0xFF;
    this.builder.loadImm(result, `@${varName} ${op === TokenType.DIVIDE ? '/' : '>>'} ${constValue}`);
    return true;
  }

  // Emit LOAD_ADDRESS_EXPR for label-based slots
  const isShift = op === TokenType.RIGHT_SHIFT;
  this.builder.loadAddressExpr(
    slot,
    constValue,
    isShift,
    `@${varName} ${isShift ? '>>' : '/'} ${constValue}`
  );
  return true;
}
```

## 4. Codegen (`codegen/code-generator.ts`)

Add case for `LOAD_ADDRESS_EXPR` in the IL→ASM-IL translation:

```typescript
case ILOpcode.LOAD_ADDRESS_EXPR: {
  // Assembly-time address expression: LDA #(label / N) or LDA #(label >> N)
  const slotOp = instr.operands[0]; // SlotOperand
  const immOp = instr.operands[1];  // ImmediateOperand (constant, isWord=isShift)

  const slot = slotOp.slot;
  const constant = immOp.value;
  const isShift = immOp.isWord; // Reuse isWord flag to distinguish / vs >>
  const opSymbol = isShift ? '>>' : '/';

  if (slot.dataLabel) {
    // Label-based: emit assembly-time expression
    const labelExpr = `(${slot.dataLabel} ${opSymbol} ${constant})`;
    builder.instruction('LDA', AsmAddressingMode.Immediate, undefined, labelExpr, comment);
  } else if (slot.address !== undefined) {
    // Numeric address: constant-fold at compile time
    const result = isShift
      ? (slot.address >>> constant) & 0xFF
      : Math.floor(slot.address / constant) & 0xFF;
    builder.instruction('LDA', AsmAddressingMode.Immediate, result, undefined, comment);
  }
  break;
}
```

## 5. Optimizer Awareness

### CSE Pass (`optimizer/passes/cse/cse.ts`)

Add `LOAD_ADDRESS_EXPR` to `modifiesAccumulator()`:

```typescript
case ILOpcode.LOAD_ADDRESS_EXPR:  // @var / N → byte in A
```

### Dead Global Elimination (`optimizer/passes/dead-global-elim.ts`)

Add `LOAD_ADDRESS_EXPR` to `isValueProducingInstruction()`:

```typescript
case ILOpcode.LOAD_ADDRESS_EXPR:  // @var / N → byte in A
```

## 6. IL Builder Base (`il/builder/base.ts`)

Add cost entry for the new opcode:

```typescript
[ILOpcode.LOAD_ADDRESS_EXPR]: { cycles: 2, bytes: 2, memoryAccesses: 0 },
// LDA #imm = 2 cycles, 2 bytes — assembler resolves the expression
```

## Summary of Changes

| File | Change | Lines |
|------|--------|-------|
| `il/enums.ts` | Add `LOAD_ADDRESS_EXPR` opcode | ~15 |
| `il/builder/memory.ts` | Add `loadAddressExpr()` method | ~15 |
| `il/builder/base.ts` | Add cost entry | ~1 |
| `il/generator/expressions.ts` | Add `tryGenerateAddressExpr()` + call in `generateBinary()` | ~50 |
| `codegen/code-generator.ts` | Add `LOAD_ADDRESS_EXPR` case | ~20 |
| `optimizer/passes/cse/cse.ts` | Add to `modifiesAccumulator()` | ~1 |
| `optimizer/passes/dead-global-elim.ts` | Add to `isValueProducingInstruction()` | ~1 |
| **Total** | | **~100** |
