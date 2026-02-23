# IL Generation Fixes: Items A, B, C

> **Document**: 03-il-generation-fixes.md
> **Parent**: [Index](00-index.md)
> **Scope**: Three correctness bugs in the IL generator layer
> **Files**: `packages/compiler/src/il/generator/expressions.ts`, `packages/compiler/src/il/generator/control-flow.ts`

## Overview

These three items are the highest-priority correctness fixes. They produce **wrong code** — not suboptimal code, but semantically incorrect assembly. Items A and B were discovered via the armenian-charset diagnostic; Item C is the architectural root cause of Item B.

All three fixes are confined to the IL generator layer and require no changes to the lexer, parser, semantic analyzer, or codegen.

---

## Item A: Address-Of Word Path in `inferWordWidthFromExpression()`

### Root Cause

`inferWordWidthFromExpression()` in `expressions.ts` (line ~157) only checks `isIdentifierExpression()`:

```typescript
protected inferWordWidthFromExpression(expr: Expression): boolean {
  if (isIdentifierExpression(expr)) {
    const slot = this.tryResolveVariable((expr as IdentifierExpression).getName());
    return slot !== undefined && slot.size === 2;
  }
  return false;  // ← @variable (UnaryExpression) falls here
}
```

When `@armenianFont` (a `UnaryExpression` with AT operator) is the left operand of `@armenianFont + i`, this function returns `false`. The dispatch chain in `generateBinary()` then falls to the **byte path** instead of the word path.

### Failure Chain

1. `generateBinary(@armenianFont + i)` is called
2. `expr.getTypeInfo()` returns `null` (type info not propagated — Item D)
3. `inferWordWidthFromExpression(@armenianFont)` returns `false` (UnaryExpression, not IdentifierExpression)
4. Falls to byte path: `generateExpression(@armenianFont)` → `LOAD_ADDRESS` (correct A:X pair)
5. Byte `ADC i` adds only to A, ignoring X (high byte)
6. `generateTier3Address()` sees byte result, emits `PROMOTE_BYTE_WORD` → `LDX #$00` (destroys high byte!)
7. Result: address becomes `$00xx` (zero page) instead of `$10xx` → VIC reads garbage

### Fix Strategy

Extend `inferWordWidthFromExpression()` to recognize address-of expressions:

```typescript
protected inferWordWidthFromExpression(expr: Expression): boolean {
  // Case 1: Identifier that resolves to a word-sized slot
  if (isIdentifierExpression(expr)) {
    const slot = this.tryResolveVariable((expr as IdentifierExpression).getName());
    return slot !== undefined && slot.size === 2;
  }

  // Case 2: Address-of expression (@variable) — always produces a 16-bit address
  // LOAD_ADDRESS emits LDA #<label / LDX #>label, which is inherently word-width.
  if (this.isAddressOfExpression(expr)) {
    return true;
  }

  return false;
}
```

### Secondary Fix: `generateTier3Address()` Guard

The general path in `generateTier3Address()` (line ~1923) blindly emits `PROMOTE_BYTE_WORD` when `isWordTyped()` returns false. This must also check `inferWordWidthFromExpression()`:

```typescript
// In generateTier3Address(), general fallback path:
this.generateExpression(addrExpr);
// Guard: don't promote if already word-width
if (!this.isWordTyped(addrExpr) && !this.inferWordWidthFromExpression(addrExpr)) {
  this.builder.promoteByteWord('addr → word');
}
```

**Note**: For binary expressions like `@armenianFont + i`, the expression itself isn't an address-of — it's a `BinaryExpression`. But once the word path is correctly triggered (via `inferWordWidthFromExpression(left)`), `generateBinaryWord()` produces a proper A:X result, and the `!this.isWordTyped(addrExpr)` check won't trigger the promotion. The secondary fix is a safety net for edge cases where the general path is reached with a word-producing expression.

### Files Changed

| File | Change |
|------|--------|
| `expressions.ts` | Extend `inferWordWidthFromExpression()` to handle `isAddressOfExpression()` |
| `expressions.ts` | Guard `generateTier3Address()` general path against double-promotion |

### Regression Risk

**Low.** The change adds a new `true` return path to `inferWordWidthFromExpression()`. The only consumers are:
1. `generateBinary()` — routes to `generateBinaryWord()` (correct for address-of)
2. `generateBinaryWord()` — skips `promoteByteWord` for already-word left operands

Both paths produce correct behavior when the left operand is word-width.

---

## Item B: Double PLA Stack Corruption in For-Loops

### Root Cause

The dynamic-bound for-loop template in `generateForCondition()` emits PHA/PLA for counter save/restore during bound comparison. But the constant-bound path also uses this template, and the PHA/PLA accounting is wrong.

Examining `generateForCondition()` in `control-flow.ts`:

```typescript
// Dynamic bound path (lines ~432-478):
this.builder.pushA('save counter');        // PHA #1
this.generateExpression(endExpr);           // generate end value
// ... complex swap logic ...
this.builder.transferAX('save end to X');   // TAX
this.builder.popA('restore counter');       // PLA #1 (matches PHA #1)
// ... then later ...
this.builder.popA('restore counter');       // PLA #2 (NO MATCHING PHA!)
```

The dynamic-bound fallback path has two `popA` calls but only one `pushA`. This pops an extra byte from the stack every iteration, corrupting the stack pointer.

### Impact

For the armenian-charset program, the for-loops are constant-bound (`for i = 0 to 62`, `for i = 0 to 999`). The constant-bound path returns early from `generateForCondition()` before reaching the dynamic-bound code. However, this doesn't mean Item B doesn't affect the program — the dynamic-bound fallback (`CMP #255`) is still reachable in certain code paths.

The program survives because `main()` never returns (infinite `while(true)` loop), so the corrupted stack is never unwound by an RTS instruction.

### Fix Strategy

The dynamic-bound fallback in `generateForCondition()` needs to be rewritten with balanced stack operations. The fundamental issue is the complex "swap A and stack" logic that tries to compare counter (on stack) with end (in A):

**Option 1: Store end to temp slot, reload counter, compare**
```typescript
// Dynamic ascending bound:
// 1. Load counter (already in A from loadSlot above)
// 2. Push counter
this.builder.pushA('save counter');
// 3. Generate end expression (result in A)
this.generateExpression(endExpr);
// 4. Store end to ZP temp
const zpTemp = this.createZpTempSlot();
this.builder.storeSlot(zpTemp, 'save end');
// 5. Pop counter back to A
this.builder.popA('restore counter');
// 6. Compare counter with stored end
this.builder.cmpSlot(zpTemp, 'counter cmp end');
// 7. Branch
this.builder.jumpGt(exitLabel, 'exit if counter > end');
```

**Option 2: Since dynamic bounds are rare, simplify to re-evaluate end each iteration**
```typescript
// Load counter into A
this.builder.loadSlot(counterSlot, 'load counter');
// For ascending: compare counter with end+1
// Re-evaluate end each iteration (acceptable for dynamic bounds)
// Store counter, generate end, compare
```

### Files Changed

| File | Change |
|------|--------|
| `control-flow.ts` | Rewrite dynamic-bound path in `generateForCondition()` with balanced PHA/PLA |

### Regression Risk

**Medium.** The dynamic-bound for-loop path is currently broken (stack corruption), so fixing it can only improve correctness. However, any change to `generateForCondition()` must be tested against all constant-bound and dynamic-bound for-loop patterns. The constant-bound path (early return) must remain unchanged.

---

## Item C: Constant-Bound Loop Template Specialization

### Root Cause

All for-loops currently share the same template structure. Constant-bound loops (`for i = 0 to 62`) use the same infrastructure as dynamic-bound loops, including:

1. **No PHA/PLA needed**: Constant bounds are known at compile time — no need to save/restore counter for comparison
2. **No CMP #$FF fallback**: The dynamic-bound fallback `cmpImm(255)` is never needed for constant bounds
3. **Bounds recomputed?**: The constant-bound path correctly uses `cmpImm(constEnd + 1)` — but the dynamic fallback still exists as dead code risk

### Current Constant-Bound Path (Already Mostly Correct)

Looking at `generateForCondition()`, the constant-bound path is:

```typescript
if (constEnd !== undefined) {
  if (isAscending) {
    this.builder.cmpImm(constEnd + 1, `cmp with end+1`);
    this.builder.jumpGe(exitLabel, 'exit if i > end');
  }
  // ... downto cases
}
```

This is already clean — load counter, CMP immediate, branch. No PHA/PLA.

### What Item C Actually Needs

The real improvement is ensuring:

1. **The dynamic fallback is unreachable for constant bounds** — currently guaranteed by the `if (constEnd !== undefined)` early return, but should be made architecturally clearer
2. **Constant-bound loops skip unnecessary IL instructions** — the loop structure should be recognizably different in IL output so the optimizer can treat them differently
3. **The `CMP #$FF` dynamic fallback is removed** — the existing code at the bottom of `generateForCondition()` emits `cmpImm(255)` as a fallback for dynamic bounds. This should be clearly isolated to the dynamic path only.

### Fix Strategy

Refactor `generateForCondition()` into two distinct methods:

```typescript
protected generateForCondition(stmt, counterSlot, exitLabel, isAscending): void {
  const constEnd = this.tryGetConstantValue(stmt.getEnd());
  const isWord = counterSlot.size === 2;

  // Route to specialized generators
  if (constEnd !== undefined) {
    this.generateForConditionConstant(counterSlot, exitLabel, isAscending, constEnd, isWord, stmt);
  } else {
    this.generateForConditionDynamic(stmt, counterSlot, exitLabel, isAscending, isWord);
  }
}
```

This makes the two paths architecturally separate, preventing any dynamic-path code from leaking into constant-bound loops.

### Files Changed

| File | Change |
|------|--------|
| `control-flow.ts` | Split `generateForCondition()` into `generateForConditionConstant()` and `generateForConditionDynamic()` |

### Regression Risk

**Low.** This is a refactoring of existing logic into separate methods. The constant-bound path already works correctly. The dynamic-bound path needs Item B's fix regardless. Splitting them ensures neither can interfere with the other.

---

## Implementation Order

These three items should be implemented in this order:

1. **Item A** (address-of word path) — standalone fix, no dependencies
2. **Item C** (split constant/dynamic condition) — refactoring that clarifies the code
3. **Item B** (fix dynamic PHA/PLA) — depends on Item C's split to isolate the fix

### Testing Strategy

See [09-testing-strategy.md](09-testing-strategy.md) for comprehensive test cases. Key tests:

| Item | Test | Description |
|------|------|-------------|
| A | `@data_var + word_index` routes to word path | Verify `inferWordWidthFromExpression` returns true for address-of |
| A | armenian-charset `copyCharset()` correct address | Full pipeline: peek(@armenianFont + i) generates correct address |
| B | Stack pointer preserved across for-loop | Check SP before and after loop matches |
| B | Dynamic-bound for-loop PHA/PLA balanced | IL output inspection: count PHA vs PLA |
| C | Constant-bound loop has no PHA/PLA | IL output: `for i = 0 to 9` has zero stack ops |
| C | Dynamic-bound loop still works | Runtime test with variable bounds |
