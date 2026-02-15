# IL Generator Expression Fixes

> **Document**: 03-il-generator-fixes.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies fixes for the IL generator's `expressions.ts` file and supporting
IL infrastructure (enums, builder, codegen). These fixes address Gaps 1-3 from the
current state analysis.

## Fix A: Add DIV_IMM and MOD_IMM Opcodes

### New IL Opcodes

Add to `il/enums.ts`:

```typescript
DIV_IMM = 'DIV_IMM',   // Divide A by immediate value
MOD_IMM = 'MOD_IMM',   // Modulo A by immediate value
```

### New IL Builder Methods

Add to `il/builder/arithmetic.ts`:

```typescript
/**
 * Divide accumulator by immediate value.
 * @param value - Byte value (0-255)
 * @param comment - Optional comment
 */
divImm(value: number, comment?: string): void {
  this.emit(ILOpcode.DIV_IMM, [createImmediateOperand(value)], comment);
}

/**
 * Modulo accumulator by immediate value.
 * @param value - Byte value (0-255)
 * @param comment - Optional comment
 */
modImm(value: number, comment?: string): void {
  this.emit(ILOpcode.MOD_IMM, [createImmediateOperand(value)], comment);
}
```

### New Codegen Handlers

Add to `codegen/generator/arithmetic.ts` (following the existing `genMulImm` pattern):

```typescript
/**
 * Generates code for DIV_IMM.
 *
 * IL: DIV_IMM value
 * 6502: STA $FE / LDA #value / STA $FF / LDA $FE / JSR __div8
 */
protected genDivImm(instr: ILInstruction): void {
  this.emitComment(instr);
  const imm = this.getImmediateOperand(instr.operands);

  // Save A (dividend) to temp
  this.asm.sta(0xfe, 'zeroPage', 'dividend');
  // Load divisor immediate
  this.asm.lda(imm.value, 'immediate', 'divisor');
  this.asm.sta(0xff, 'zeroPage');
  // Restore dividend
  this.asm.lda(0xfe, 'zeroPage');
  // Call divide routine
  this.asm.jsr('__div8');
  this.invalidateA();
}

/**
 * Generates code for MOD_IMM.
 *
 * IL: MOD_IMM value
 * 6502: STA $FE / LDA #value / STA $FF / LDA $FE / JSR __mod8
 */
protected genModImm(instr: ILInstruction): void {
  this.emitComment(instr);
  const imm = this.getImmediateOperand(instr.operands);

  // Save A (dividend) to temp
  this.asm.sta(0xfe, 'zeroPage', 'dividend');
  // Load divisor immediate
  this.asm.lda(imm.value, 'immediate', 'divisor');
  this.asm.sta(0xff, 'zeroPage');
  // Restore dividend
  this.asm.lda(0xfe, 'zeroPage');
  // Call modulo routine
  this.asm.jsr('__mod8');
  this.invalidateA();
}
```

### IL Generator Changes

In `generateBinaryImmediate()`, add cases before the `default`:

```typescript
case TokenType.DIVIDE:
  this.builder.divImm(value);
  break;
case TokenType.MODULO:
  this.builder.modImm(value);
  break;
```

## Fix B: Add Shift Operator Cases

### In `generateBinaryImmediate()`

```typescript
case TokenType.LEFT_SHIFT:
  this.builder.shl(value, `<< ${value}`);
  break;
case TokenType.RIGHT_SHIFT:
  this.builder.shr(value, `>> ${value}`);
  break;
```

### In `generateBinarySlot()`

Shift by a variable amount requires a runtime loop. For the slot path, we need
to generate a loop that shifts A by the count stored in the slot. This requires
new IL or inline code generation.

**Strategy**: For now, emit a shift-by-slot using a counter loop pattern:

```typescript
case TokenType.LEFT_SHIFT:
case TokenType.RIGHT_SHIFT: {
  // Save A (value to shift) to ZP temp
  // Load shift count from slot into Y
  // Loop: shift A, DEY, BNE loop
  // This is a TODO for variable-count shifts
  // For now, fall through to complex path
  this.builder.emit(ILOpcode.PUSH_A, []);
  this.builder.loadSlot(slot);
  this.generateBinaryComplexOp(op);
  break;
}
```

**Note**: Variable-count shifts are rare in C64 code. The immediate case (constant count)
is the critical fix. Variable counts can be deferred to a later session.

### In `generateBinaryComplexOp()`

Add shift cases:

```typescript
case TokenType.LEFT_SHIFT:
case TokenType.RIGHT_SHIFT:
  // Complex shift — not yet supported (would need runtime loop)
  // For now, just pop and emit NOP as placeholder
  this.builder.emit(ILOpcode.POP_A, [], 'shift (complex, unsupported)');
  break;
```

## Fix C: Fix Complex Binary Path

### The Problem

`generateBinaryComplexOp()` emits `_BYTE` opcodes with `[]` operands. The codegen
expects slot operands for all `_BYTE` opcodes.

### The Solution

Instead of emitting naked `_BYTE` opcodes, the complex path should:

1. Store the right operand value (currently in A) to ZP temp ($FE)
2. Pop the left operand from stack back into A
3. Emit the `_BYTE` opcode with a synthetic ZP temp slot operand

**Implementation**:

Create a helper method for the ZP temp slot:

```typescript
/**
 * Create a synthetic FrameSlot pointing to ZP temp ($FE).
 * Used by the complex binary path to store intermediate values.
 */
protected createZpTempSlot(): FrameSlot {
  return {
    name: '__zp_temp',
    kind: SlotKind.Local,
    location: SlotLocation.ZeroPage,
    address: 0xFE,
    size: 1,
    index: -1,
  };
}
```

Then rewrite `generateBinaryComplexOp()`:

```typescript
protected generateBinaryComplexOp(op: TokenType): void {
  // At entry: stack has left value, A has right value
  // Strategy: store right to ZP temp, pop left to A, operate with ZP temp

  const zpTemp = this.createZpTempSlot();

  // Store right operand to ZP temp
  this.builder.storeSlot(zpTemp, 'save right to temp');

  // Pop left operand back to A
  this.builder.emit(ILOpcode.POP_A, [], 'restore left');

  // Now: A = left, $FE = right — use slot-based operations
  switch (op) {
    case TokenType.PLUS:
      this.builder.addSlot(zpTemp, 'left + right');
      break;
    case TokenType.MINUS:
      this.builder.subSlot(zpTemp, 'left - right');
      break;
    case TokenType.MULTIPLY:
      this.builder.mulSlot(zpTemp, 'left * right');
      break;
    case TokenType.DIVIDE:
      this.builder.divSlot(zpTemp, 'left / right');
      break;
    case TokenType.MODULO:
      this.builder.modSlot(zpTemp, 'left % right');
      break;
    case TokenType.BITWISE_AND:
      this.builder.andSlot(zpTemp, 'left & right');
      break;
    case TokenType.BITWISE_OR:
      this.builder.orSlot(zpTemp, 'left | right');
      break;
    case TokenType.BITWISE_XOR:
      this.builder.xorSlot(zpTemp, 'left ^ right');
      break;
    case TokenType.EQUAL:
    case TokenType.NOT_EQUAL:
    case TokenType.LESS_THAN:
    case TokenType.LESS_EQUAL:
    case TokenType.GREATER_THAN:
    case TokenType.GREATER_EQUAL:
      this.builder.cmpSlot(zpTemp, 'left cmp right');
      break;
    default:
      // Unsupported operator — at least A has the left value
      break;
  }
}
```

This ensures all `_BYTE` opcodes are emitted WITH proper slot operands,
using the existing codegen handlers without any codegen changes.

## Integration Points

All fixes are contained within:
- `il/enums.ts` — 2 new enum values
- `il/builder/arithmetic.ts` — 2 new methods
- `il/generator/expressions.ts` — 3 switch statement additions + 1 method rewrite
- `codegen/generator/arithmetic.ts` — 2 new handler methods + dispatch cases

No other files need changes.

## Error Handling

| Error Case | Handling Strategy |
|---|---|
| Divide by zero (literal 0) | Could add compile-time warning, but defer — runtime behavior matches 6502 |
| Shift count > 7 | Clamp to 7 — shifting byte by 8+ always yields 0 |
| Unknown operator in complex path | Fall through to default — emit NOP (no crash) |
