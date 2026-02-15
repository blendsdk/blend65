# Type-Aware Expression Generation

> **Document**: 04-type-aware-expressions.md
> **Parent**: [Index](00-index.md)

## Overview

Make the IL generator's `generateBinary()` check `expr.getTypeInfo()` to choose byte or word IL opcodes. This is the core change that fixes ALL word expressions.

## Current Problem

```typescript
// expressions.ts - generateBinaryImmediate() — ALWAYS uses 8-bit:
case TokenType.PLUS:
  this.builder.addImm(value);  // ADD_IMM — 8-bit always!
  break;
```

## Solution: Type-Checked Binary Operations

### Modified generateBinary()

```typescript
protected generateBinary(expr: BinaryExpression): void {
  const resultType = expr.getTypeInfo();
  const isWordResult = resultType?.kind === TypeKind.Word;

  if (isWordResult) {
    this.generateBinaryWord(expr);
  } else {
    this.generateBinaryByte(expr); // Current 8-bit code (unchanged)
  }
}
```

### New generateBinaryWord()

When the result is word-typed:
1. Generate left operand (may need byte→word promotion)
2. If right is immediate byte → `ADD_WORD_BYTE_IMM`
3. If right is immediate word → `ADD_WORD_IMM`
4. If right is byte slot → `ADD_WORD_BYTE_SLOT`
5. If right is word slot → `ADD_WORD_SLOT`
6. Otherwise → push A:X, generate right, operate (complex path)

### Type Promotion

When left operand is byte but result is word, promote after generating left:
```typescript
// After generateExpression(left) produces byte in A:
if (leftType is byte && resultType is word) {
  this.builder.emit(ILOpcode.PROMOTE_BYTE_WORD); // LDX #0
}
```

New IL opcode: `PROMOTE_BYTE_WORD` — simply does `LDX #0` to zero-extend A to A:X.

### Identifier Loading

`generateIdentifier()` needs to check slot size:
- byte slot → `LOAD_BYTE` (current)
- word slot → `LOAD_WORD` (loads A:X pair)

Currently always uses `LOAD_BYTE`. Fix: check `slot.size === 2`.

## Key Design Rule

**Byte expressions generate IDENTICAL code to current.** Only when `getTypeInfo()` returns word do we use the new paths. This ensures zero regression risk.

## Files to Modify

| File | Changes |
|------|---------|
| `il/generator/expressions.ts` | `generateBinary()` type dispatch, `generateBinaryWord()`, `generateIdentifier()` word load |
| `il/enums.ts` | `PROMOTE_BYTE_WORD` opcode |
| `codegen/generator/memory.ts` | Codegen for `PROMOTE_BYTE_WORD` (LDX #0) |
