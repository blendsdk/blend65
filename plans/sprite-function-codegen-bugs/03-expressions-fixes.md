# Expression Fixes: Bug #1 (Address-of Promotion) + Bug #2 (Word Division)

> **Document**: 03-expressions-fixes.md
> **Parent**: [Index](00-index.md)

## Overview

Both bugs live in `packages/compiler/src/il/generator/expressions.ts` and stem from
the same root cause: the IL generator lacks type info (since `setTypeInfo()` is never
called in production) and makes incorrect byte-vs-word decisions.

## Bug #1: Address-of Argument Promotion

### Current Architecture

```
Caller: getSpriteFrame(@lineFrames, 0)
  ↓
generateCallExpression()
  ↓
generateCallArguments(funcName, args)
  ↓
generateExpression(args[0])  →  @lineFrames  →  LOAD_ADDRESS  →  LDA #<label / LDX #>label
  ↓
Check: firstParam.size === 2 && !isWordTyped(args[0])
  → true (always, since isWordTyped returns false without type info)
  ↓
promoteByteWord()  →  LDX #$00  →  DESTROYS high byte!
```

### Proposed Fix

**Strategy**: Detect when the argument expression is a unary AT (`@variable`) and skip
the byte-to-word promotion, because `LOAD_ADDRESS` already produces a full A:X word.

**Detection method**: Check if `args[0]` is a `UnaryExpression` with operator `TokenType.AT`.

```typescript
// BEFORE (buggy):
if (firstParam && firstParam.size === 2 && !this.isWordTyped(args[0])) {
    this.builder.promoteByteWord(`arg byte→word for ${funcName}`);
}

// AFTER (fixed):
if (firstParam && firstParam.size === 2 && !this.isWordTyped(args[0])) {
    // Skip promotion for address-of expressions — LOAD_ADDRESS already produces A:X word
    if (!this.isAddressOfExpression(args[0])) {
        this.builder.promoteByteWord(`arg byte→word for ${funcName}`);
    }
}
```

**New helper method**:
```typescript
/**
 * Checks if an expression is a unary address-of (@) expression.
 * Used to skip byte→word promotion for @variable arguments,
 * since LOAD_ADDRESS already produces a full A:X word pair.
 */
protected isAddressOfExpression(expr: Expression): boolean {
    return expr instanceof UnaryExpression && expr.getOperator() === TokenType.AT;
}
```

### Edge Cases

| Case | Behavior | Test |
|------|----------|------|
| `func(@variable)` where param is word | Skip promotion (LOAD_ADDRESS = word) | ✓ Must work |
| `func(byteVar)` where param is word | Apply promotion (need LDX #$00) | ✓ Must still work |
| `func(42)` where param is word | Apply promotion (literal is byte) | ✓ Must still work |
| `func(@variable)` where param is byte | No promotion needed (size !== 2) | ✓ Unchanged |

---

## Bug #2: Word Division Falls to 8-bit

### Current Architecture

The binary expression pipeline in `generateBinary()`:

```
spriteAddr / 64
  ↓
generateBinary(op=SLASH, left=spriteAddr, right=64)
  ↓
Check: is right a constant? → yes (64)
  ↓
Check: resultType?.kind === TypeKind.Word → false (no type info!)
  ↓
Falls to byte path → divImm(64) → 8-bit __div8
```

Even if it reached the word path, `generateBinaryWordImmediate()` has no DIVIDE case.

### Proposed Fix (Two Parts)

#### Part A: Add DIVIDE case to `generateBinaryWordImmediate()`

When dividing a word by a power-of-2 constant, convert to shift-right:

```typescript
case TokenType.SLASH: {
    // Word division by power-of-2 → shift right
    // spriteAddr / 64 = spriteAddr >> 6
    const shiftCount = Math.log2(value);
    if (Number.isInteger(shiftCount) && shiftCount > 0) {
        // Emit N right-shifts on A:X word pair
        for (let i = 0; i < shiftCount; i++) {
            this.builder.lsrWord(`word >> 1 (div step ${i + 1}/${shiftCount})`);
        }
    } else {
        // Non-power-of-2: call runtime __div16
        this.builder.callDiv16(value, `word / ${value}`);
    }
    break;
}
```

**Note**: `lsrWord()` may need to be added to the builder if it doesn't exist.
The 6502 word right-shift pattern is:
```asm
LSR     ; shift high byte right (bit 0 → carry)
ROR A   ; rotate carry into low byte (effectively shift A:X right by 1)
```
Wait — the A:X convention has low in A, high in X. So:
```asm
; Right-shift A:X word by 1:
; X = high byte, A = low byte
STX temp       ; save high byte
LSR temp       ; shift high byte right, bit 0 → carry
ROR A          ; rotate low byte right with carry from high
LDX temp       ; reload shifted high byte
```

Or if there's a zero-page temp available:
```asm
PHA            ; save A (low byte)
TXA            ; high byte → A
LSR            ; shift high right, bit 0 → carry
TAX            ; shifted high → X
PLA            ; restore low byte
ROR            ; rotate low right with carry
```

This needs careful implementation — check what shift primitives the builder already supports.

#### Part B: Type Width Inference from Slot Sizes

Add a fallback in `generateBinary()` to infer word width from the left operand's slot:

```typescript
// Current: only uses expr.getTypeInfo() which is always undefined
const resultType = expr.getTypeInfo();

// Enhanced: fall back to slot-size inference
let isWordOperation = resultType?.kind === TypeKind.Word;
if (!isWordOperation && !resultType) {
    // Infer from left operand: if it's loaded from a word-sized slot, treat as word
    isWordOperation = this.inferWordWidthFromExpression(left);
}
```

**New helper**:
```typescript
/**
 * Infers whether an expression produces a word-width value by examining
 * the source slot size. Used as fallback when type info is unavailable.
 */
protected inferWordWidthFromExpression(expr: Expression): boolean {
    if (expr instanceof IdentifierExpression) {
        const slot = this.resolveSlot(expr.getName());
        return slot !== undefined && slot.size === 2;
    }
    return false;
}
```

This way, `spriteAddr / 64` where `spriteAddr` is a word parameter (slot.size === 2)
correctly enters the word division path.

### Division Optimization Summary

| Divisor | Power of 2? | Generated Code |
|---------|-------------|----------------|
| 64 | Yes (2⁶) | 6× word right-shift (LSR/ROR pattern) |
| 32 | Yes (2⁵) | 5× word right-shift |
| 128 | Yes (2⁷) | 7× word right-shift |
| 10 | No | JSR __div16 (runtime call) |

### Edge Cases

| Case | Behavior | Test |
|------|----------|------|
| `wordParam / 64` | Word shift-right ×6 | ✓ Primary fix |
| `byteParam / 64` | Byte division (existing) | ✓ Unchanged |
| `wordParam / 10` | Runtime __div16 call | ✓ Non-power-of-2 fallback |
| `wordParam / 1` | No-op (shift 0) | ✓ Edge case |
| `wordParam / 0` | Error or undefined | ⚠ Should warn |

## Integration Points

Both fixes interact with:
- `generateCallArguments()` — Bug #1 changes argument promotion logic
- `generateBinary()` — Bug #2 changes type-width dispatch
- `generateBinaryWordImmediate()` — Bug #2 adds DIVIDE case
- The IL builder — may need new `lsrWord()` primitive

## Testing Requirements

- Unit tests for `isAddressOfExpression()` helper
- Unit tests for word division shift-right generation
- Integration test: `getSpriteFrame(@data, 0)` produces correct IL
- E2E test: full spinning-line compiles at O0-O3
- Regression: all existing tests pass
