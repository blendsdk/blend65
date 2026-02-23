# IL Generator Fix: Word Comparison in Conditions

> **Document**: 03-il-generator-fix.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies the exact changes needed in `packages/compiler/src/il/generator/control-flow.ts` to make `generateConditionWithBranch()` and `generateForConditionDynamic()` word-type-aware.

## Fix 1: `generateConditionWithBranch()` — Word-Aware Conditions

### Current Architecture

The method detects comparison expressions in conditions and generates direct `CMP + branch` IL. It has three right-operand handlers:

1. **Literal right** (e.g., `wresult == 3000`): `cmpImm(rightVal)` — always byte
2. **Constant identifier right** (e.g., `x == NUM_FRAMES`): `cmpImm(constValue)` — always byte
3. **Variable right** (e.g., `wa > wb`): `cmpSlot(slot)` — always byte

### Proposed Changes

**Step 1**: After generating the left operand, detect if the comparison is word-width:

```typescript
// After: this.generateExpression(binExpr.getLeft());
const left = binExpr.getLeft();
const isWordLeft = this.isWordTyped(left) || this.inferWordWidthFromExpression(left);
```

This mirrors the pattern already used in `generateBinary()` in `expressions.ts`.

**Step 2**: For each right-operand handler, branch on `isWordLeft`:

#### Literal right operand:

```typescript
if (isLiteralExpression(right)) {
  const rightVal = (right as LiteralExpression).getValue();
  if (typeof rightVal === 'number') {
    if (isWordLeft) {
      this.builder.cmpWordImm(rightVal, 'compare word');
    } else {
      this.builder.cmpImm(rightVal, 'compare');
    }
  }
  // ... non-numeric fallback unchanged
}
```

#### Constant identifier right operand:

```typescript
const constValue = this.tryResolveConstantIdentifier(right);
if (constValue !== undefined) {
  if (isWordLeft) {
    this.builder.cmpWordImm(constValue, 'compare word with const');
  } else {
    this.builder.cmpImm(constValue, 'compare with const');
  }
}
```

#### Variable right operand:

```typescript
const slot = this.tryResolveVariable(identRight.getName());
if (slot) {
  if (isWordLeft) {
    // Word-typed left — need word comparison
    if (slot.size === 2) {
      // Both word — use CMP_WORD_SLOT
      this.builder.cmpWordSlot(slot, 'compare word');
    } else {
      // Left is word, right is byte — complex fallback
      // Generate the full comparison via expression path
      this.generateExpression(condition);
      this.builder.cmpImm(0, 'condition (word/byte fallback)');
      this.builder.jumpEq(skipLabel, 'skip if false');
      return true;
    }
  } else {
    this.builder.cmpSlot(slot, 'compare');
  }
}
```

### Edge Case: Left is byte, right is word

When the left operand is byte-typed but the right is word-typed (e.g., `if (byteVar == wordVar)`), the binary expression's type info should be `word` (set by semantic analysis). However, `isWordTyped(left)` checks the left operand's own type, not the expression's result type.

For this edge case, the fallback to the generic expression path (`generateExpression(condition)` + `cmpImm(0)`) handles it correctly — the expression path's `generateBinaryWord()` does proper promotion. This is acceptable for the rare mixed-type condition case.

## Fix 2: `generateForConditionDynamic()` — Word Counter Support

### Current Architecture

The method saves the counter to the stack with PHA, evaluates the end expression, stores to a byte temp slot, restores counter with PLA, and does a byte comparison. For word counters, only the low byte survives.

### Proposed Changes

Add an `isWord` branch that handles full 16-bit save/restore/compare:

```typescript
protected generateForConditionDynamic(
  stmt: ForStatement,
  counterSlot: FrameSlot,
  exitLabel: string,
  isAscending: boolean,
  isWord: boolean
): void {
  const endExpr = stmt.getEnd();

  if (isWord) {
    // === WORD PATH ===
    // Load word counter into A:X
    this.builder.loadSlotWord(counterSlot, `load ${stmt.getVariable()} (word)`);

    // Save both bytes: A (low) and X (high) to stack
    // Stack order: push A first, then X → pop X first, then A
    this.builder.pushA('save counter low');
    this.builder.transferXA('X→A for push');
    this.builder.pushA('save counter high');

    // Evaluate dynamic end expression (clobbers A:X)
    this.generateExpression(endExpr);

    // If end expression is byte-typed, promote to word
    if (!this.isWordTyped(endExpr)) {
      this.builder.promoteByteWord('end bound byte→word');
    }

    // Store end to a word-sized ZP temp slot
    const zpTemp = this.createZpTempSlot();
    // Need word-sized temp — create second slot for high byte
    const zpTempHi = this.createZpTempSlot();
    this.builder.storeSlot(zpTemp, 'save end bound low');
    this.builder.transferXA('end high→A');
    this.builder.storeSlot(zpTempHi, 'save end bound high');

    // Restore counter from stack (reverse order)
    this.builder.popA('restore counter high');
    this.builder.transferAX('A→X restore high');
    this.builder.popA('restore counter low');

    // Compare: high bytes first (X vs zpTempHi), then low (A vs zpTemp)
    // Use the same pattern as CMP_WORD_SLOT but with explicit temp slots
    this.builder.cmpWordImm(0, 'placeholder');
    // Actually, since we have two separate byte slots, we can't use cmpWordSlot
    // directly (it expects a contiguous word slot). Instead, use explicit CPX/CMP:
    // ... (see Implementation Notes below)
  } else {
    // === BYTE PATH (existing, unchanged) ===
    // ... existing code ...
  }
}
```

### Implementation Notes for Dynamic Word Path

The dynamic word for-loop path is more complex because `createZpTempSlot()` creates individual byte slots, not contiguous word slots. Two approaches:

**Option A (Simpler)**: Create a word-sized temp slot directly:
- Modify `createZpTempSlot()` to accept a size parameter, or
- Create a helper `createZpTempWordSlot()` that returns a size=2 slot
- Then use `storeSlotWord()` and `cmpWordSlot()` normally

**Option B (No new infrastructure)**: Store end value to two byte slots, then reconstruct for comparison:
- More instructions but no builder changes needed

**Recommendation**: Option A is cleaner and more maintainable. Check if `createZpTempSlot` can be easily extended.

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Left word, right non-numeric literal | Fall through to generic expression path |
| Left word, right byte variable | Fall through to generic expression path |
| Unknown right operand type | Fall through to generic expression path (existing fallback) |
| Dynamic end expression type unknown | Assume byte, promote if needed |

## Testing Requirements

- Unit tests for `generateConditionWithBranch()` with word operands (new)
- Unit tests for `generateForConditionDynamic()` with word counter (new)
- E2E test verifying ACME assembly succeeds for word if-conditions
- Regression tests ensuring byte comparisons still work
- See [Testing Strategy](07-testing-strategy.md) for full test plan
