# Codegen Improvements: Items E, F

> **Document**: 05-codegen-improvements.md
> **Parent**: [Index](00-index.md)
> **Scope**: Two correctness bugs in code generation for word-width index and register preservation
> **Files**: `packages/compiler/src/il/generator/expressions.ts`, `packages/compiler/src/codegen/`

## Overview

Items E and F address code generation correctness issues that produce wrong addresses when:
- **Item E**: A word-width index variable (>255) is used for indexed addressing (only low byte used, high byte lost)
- **Item F**: Complex `poke(dest+i, peek(src+i))` expressions clobber the X register between destination and source computation

Both bugs affect the armenian-charset program: `clearScreen()` only clears 256 of 1000 positions (Item E), and `copyCharset()` writes to wrong destinations (Item F).

---

## Item E: Word Index >256 for Indexed Addressing

### Root Cause

The Tier 2 indexed addressing path in `generatePokeIntrinsic()` and `generatePeekIntrinsic()` uses the X register for the offset variable:

```typescript
// Tier 2: Single byte-typed variable offset → X-indexed
if (decomp.isAdditionOnly && decomp.variableTerms.length === 1
    && !this.isWordTyped(decomp.variableTerms[0])) {
  this.generateExpression(decomp.variableTerms[0]);
  this.builder.emit(ILOpcode.TRANSFER_AX, [], 'index → X');
  // ... STA base,X or LDA base,X
}
```

The guard `!this.isWordTyped(decomp.variableTerms[0])` checks whether the offset variable is byte-typed. If the offset is a word variable (e.g., `i: word` iterating 0 to 999), the Tier 2 path is correctly skipped and Tier 3 (indirect) is used.

**However**, the problem occurs when:
1. The loop counter `i` is declared as `word` (to reach 999)
2. But `isWordTyped()` returns `false` (because `getTypeInfo()` returns null — Item D)
3. Tier 2 is incorrectly selected, truncating the word index to its low byte via `TRANSFER_AX`

### Failure Chain

1. `poke($0400 + i, 32)` where `i: word` ranges 0-999
2. `decomposeAddressExpression` decomposes to `{ constantSum: 0x0400, variableTerms: [i] }`
3. `isWordTyped(i)` returns `false` (no type info)
4. Tier 2 selected: `TRANSFER_AX` only transfers low byte of A to X
5. For `i = 256`: X = 0 (low byte of 256), writes to $0400+0 = $0400 (wrong!)
6. Result: only first 256 screen positions cleared

### Fix Strategy

**Approach 1: Extend `isWordTyped` guard with slot-size check** (Quick fix)

The Tier 2 guard can also check `inferWordWidthFromExpression()`:

```typescript
// Tier 2: Single byte-typed variable offset → X-indexed
// Guard: must be byte-typed (X register is 8-bit)
const offsetExpr = decomp.variableTerms[0];
const isOffsetWord = this.isWordTyped(offsetExpr) || this.inferWordWidthFromExpression(offsetExpr);
if (decomp.isAdditionOnly && decomp.variableTerms.length === 1 && !isOffsetWord) {
  // Safe to use X-indexed: offset fits in one byte
  // ...
}
```

**Approach 2: Page-based loop unrolling** (Optimization — Item J territory)

For `clearScreen()` (1000 iterations), the compiler could emit a page-based loop:
```asm
LDX #0
.page: LDA #32 / STA $0400,X / STA $0500,X / STA $0600,X / STA $0700,X
       INX / BNE .page
; Handle remainder (1000 - 256*3 = 232 remaining)
```

This is an optimization, not a correctness fix. Item E's fix ensures Tier 3 (indirect) is used when the index is word-width, producing correct (if slower) code.

### Files Changed

| File | Change |
|------|--------|
| `expressions.ts` | Extend Tier 2 guard in `generatePeekIntrinsic()` and `generatePokeIntrinsic()` to check `inferWordWidthFromExpression()` |

### Regression Risk

**Low.** The change makes the Tier 2 guard stricter — some expressions that previously (incorrectly) used Tier 2 will now fall to Tier 3. Tier 3 is always correct but slower. No existing correct behavior is changed.

---

## Item F: Register X Clobbering in Complex Expressions

### Root Cause

In `poke(dest + i, peek(src + i))`, the IL generator processes:
1. **Address computation** (dest + i): generates the destination address, involving A:X
2. **Value computation** (peek(src + i)): generates the source peek, which also needs A:X
3. Step 2 clobbers A:X from step 1

The specific sequence for Tier 2 poke with Tier 3 peek source:

```
; Step 1: compute dest index
LOAD i          → A = i
TRANSFER_AX     → X = i (dest index ready)

; Step 2: compute peek(src + i) - THIS CLOBBERS X
LOAD_IMM_WORD src_base → A:X = src address  ← X overwritten!
ADD_WORD_BYTE_SLOT i   → A:X = src + i
STORE_ZP_PTR           → $FB/$FC = src+i
PEEK_INDIRECT          → A = peek(src+i)

; Step 3: poke using X-indexed (X is now wrong!)
POKE $0400,X   → STA $0400,X  (X has garbage from step 2)
```

### Impact

The destination X register computed in step 1 is destroyed by the source address computation in step 2. The poke writes to a wrong screen/memory location.

### Fix Strategy

**Approach 1: Reorder — compute value before address** 

For poke intrinsics, generate the value expression first, save it, then compute the address:

```typescript
// In generatePokeIntrinsic(), Tier 2 path:
// 1. Generate value first (into A)
this.generateExpression(valueExpr);
this.builder.pushA('save value');
// 2. Generate offset into A, transfer to X
this.generateExpression(decomp.variableTerms[0]);
this.builder.emit(ILOpcode.TRANSFER_AX, [], 'index → X');
// 3. Pop value back to A
this.builder.popA('restore value');
// 4. Poke with X-indexed
this.builder.emit(ILOpcode.POKE, [...], 'poke indexed');
```

**Problem**: If the value expression also needs X (e.g., it's a peek with indexed addressing), this still clobbers.

**Approach 2: Force Tier 3 for complex value expressions**

When the value expression is complex (contains function calls, peek, or other expressions that use A:X), force the poke to use Tier 3 (indirect) instead of Tier 2 (indexed):

```typescript
// In generatePokeIntrinsic(), before Tier 2 check:
const valueIsComplex = isCallExpression(valueExpr) || /* other checks */;
if (valueIsComplex) {
  // Skip Tier 2, use Tier 3 (safe for all register usage patterns)
  goto tier3;
}
```

**Approach 3: Temporary slot for destination index** (Most robust)

Save the computed destination index to a temporary slot before generating the value:

```typescript
// Tier 2 with complex value:
// 1. Compute offset → A
this.generateExpression(decomp.variableTerms[0]);
// 2. Save to temp slot
this.builder.storeSlot(tempSlot, 'save dest index');
// 3. Generate value (may clobber A, X, Y)
this.generateExpression(valueExpr);
// 4. Save value to another temp
this.builder.pushA('save value');
// 5. Reload dest index into X
this.builder.loadSlot(tempSlot, 'reload dest index');
this.builder.emit(ILOpcode.TRANSFER_AX, [], 'index → X');
// 6. Pop value to A
this.builder.popA('restore value');
// 7. Poke indexed
this.builder.emit(ILOpcode.POKE, [...], 'poke indexed');
```

**Recommendation**: Approach 2 (force Tier 3 for complex values) is simplest and safest. Approach 3 is more optimal but more complex to implement. Both can be done — Approach 2 first as a correctness fix, Approach 3 later as an optimization.

### Files Changed

| File | Change |
|------|--------|
| `expressions.ts` | Detect complex value expressions in `generatePokeIntrinsic()` and force Tier 3 |
| `expressions.ts` | Alternatively: reorder Tier 2 to compute value before address |

### Regression Risk

**Low-Medium.** Forcing Tier 3 for complex values is conservative — it produces correct but potentially slower code. The risk is over-classifying expressions as "complex" and unnecessarily using Tier 3. The guard should be precise: only force Tier 3 when the value expression demonstrably needs A:X.

---

## Implementation Order

1. **Item E** — Quick fix: extend Tier 2 guard with `inferWordWidthFromExpression()`
2. **Item F** — Force Tier 3 for complex value expressions in poke intrinsics

Both items benefit from Item D (type propagation) — once `getTypeInfo()` works, the word-width detection in Item E becomes authoritative, and the "complex expression" detection in Item F can check whether the value expression uses word-width operations.

## Testing Strategy

See [09-testing-strategy.md](09-testing-strategy.md). Key tests:

| Item | Test | Description |
|------|------|-------------|
| E | Word index >255 falls to Tier 3 | `poke($0400 + wordVar, 32)` where wordVar > 255 uses indirect |
| E | clearScreen pattern: 1000 positions | Full pipeline test: all 1000 screen bytes written correctly |
| E | Byte index ≤255 still uses Tier 2 | No regression: `poke($D800 + byteVar, 1)` still uses indexed |
| F | poke(dest+i, peek(src+i)) correct | Both source and destination addresses computed correctly |
| F | Complex value doesn't clobber X | Verify X register preserved across value generation |
| F | Simple value still uses Tier 2 | `poke($0400+i, 32)` (literal value) still uses efficient indexed |
