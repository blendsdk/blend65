# Current State: Sprite-Test Fixes

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Updated**: 2025-02-14 (after multi-level optimization analysis)

## Multi-Level Optimization Analysis

Compiled sprite-test.blend at O0, O1, O2, O3. All assemble with ACME without errors.

| Level | Lines | ACME | Notes |
|-------|-------|------|-------|
| O0 | 449 | OK | Baseline, no optimization |
| O1 | 792 | OK | Function inlining active |
| O2 | 782 | OK | + peephole, copy propagation |
| O3 | 996 | OK | + loop unrolling |

**Key Finding**: All bugs are **CORE BUGS** present at O0. The optimizer (O1-O3) makes them worse but does not introduce new bugs. Fixing the core IL generator + codegen bugs will fix all levels.

---

## Root Cause Analysis

### Bug 1: Constants Not Inlined in Value Expressions — ALL LEVELS

**File**: `packages/compiler/src/il/generator/expressions.ts` — `generateIdentifier()`

**Current Behavior**: When `SPACE_CHAR` (a `const byte = 32`) is used as a value in `poke(addr, SPACE_CHAR)`, `generateIdentifier()` calls `tryResolveVariable(name)`. If a slot exists, it emits `LOAD_BYTE` from that (uninitialized!) slot.

**Evidence at O0**: `LDA $05` instead of `LDA #$20` for SPACE_CHAR. `LDA $04` for STAR_CHAR. `LDA $06` for SCREEN_WIDTH.

**Evidence at O3**: Same pattern, `LDA $05` for SPACE_CHAR, `LDA $04` for STAR_CHAR.

**Fix**: In `generateIdentifier()`, before slot resolution, check symbol table for `isConst` + `initializer`, resolve to immediate.

---

### Bug 2: Array Element Assignment Not Implemented — ALL LEVELS

**File**: `packages/compiler/src/il/generator/expressions.ts` — `generateAssignment()`

**Current Behavior**: When target is `starX[i]` (an IndexExpression), the code says:
```typescript
if (!isIdentifierExpression(target)) {
  // Complex target (index, member) - TODO in Phase 7c
  this.generateExpression(value);
  return;
}
```
Value is generated but NEVER stored. Also, `storeIndexedImm()` and `storeIndexedY()` do not exist in the builder.

**Evidence at O0**: `initStars` calculates seedX, seedY, speed but has ZERO `STA` instructions to arrays. The loop iterates but stores nothing.

**Fix**: Add `storeIndexedImm/Y()` to builder, handle IndexExpression targets in `generateAssignment()`.

---

### 🔴 Bug 3 (NEW CRITICAL): Array READ Codegen Broken — ALL LEVELS

**File**: `packages/compiler/src/codegen/generator/memory.ts` — `genLoadByte()`

**Current Behavior**: The IL builder's `loadIndexedY()` creates a LOAD_BYTE instruction with `(operand as any).indexedByY = true`. But the codegen's `genLoadByte()` **completely ignores** this flag:

```typescript
protected genLoadByte(instr: ILInstruction): void {
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;
    const mode = this.getLoadMode(slot.slot); // Returns 'zeroPage' or 'absolute' — NEVER ',Y'
    this.asm.lda(address, mode);
}
```

**Evidence at O0**: `TAY` sets Y register with index, then `LDA $08` — a simple zero-page load that ignores Y entirely. Should be `LDA $08,Y`.

**Evidence at O3**: Even worse — copy propagation sometimes eliminates these broken loads entirely, leaving NO instruction between array access comments.

**Impact**: ALL array reads are broken. `starY[i]`, `starX[i]`, `starSpeed[i]` all load from the base address without using the index.

**Fix**: In `genLoadByte()` and `genStoreByte()`, check for `indexedByY` flag on operand and emit `'zeroPageY'`/`'absoluteY'` addressing mode.

---

### Bug 4: barrier() Generates No IL — ALL LEVELS (LOW PRIORITY)

**File**: `packages/compiler/src/il/generator/expressions.ts` — `generateIntrinsic()`

**Evidence at O0**: delay loop structure IS preserved (for-loop with INC/CMP/BCS works). Barrier is not currently needed for correctness.

**Evidence at O3**: delay loop structure ALSO preserved (inlined but structurally correct).

**Revised Priority**: LOW. The loop structure survives at all optimization levels. Still a good fix for future-proofing.

---

### Bug 5: byte×byte Multiply Not Promoted to Word — ALL LEVELS

**Expression**: `let offset: word = y * SCREEN_WIDTH + x`

**Evidence at O0**: `JSR __mul8` is 8-bit only. `LDA $06` used as multiplier (should be `#$28` = 40 due to Bug 1). Even with Bug 1 fixed, `y * 40` = 960 for y=24, which overflows 8 bits.

**Fix**: When result type is word, emit 16-bit multiply or promote.

---

## Bug Priority Matrix (Updated)

| Bug | Present At | Category | Priority | Impact |
|-----|-----------|----------|----------|--------|
| Bug 1: Constants not inlined | O0-O3 | Core IL Gen | 🔴 Critical | All constants load garbage |
| Bug 2: Array store missing | O0-O3 | Core IL Gen + Builder | 🔴 Critical | Arrays never written |
| Bug 3: Array read codegen broken | O0-O3 | Core CodeGen | 🔴 Critical | Arrays read wrong values |
| Bug 4: barrier() no IL | O0-O3 | IL Gen | 🟢 Low | Loop works anyway |
| Bug 5: byte×byte→word | O0-O3 | Core IL Gen | 🟡 High | Screen offsets overflow |

## Revised Fix Order

1. **Bug 3 (Array read codegen)** — Easiest fix, highest single impact
2. **Bug 1 (Constants inline)** — Simple fix, unlocks correct SCREEN_WIDTH usage
3. **Bug 2 (Array store)** — Enables array programs
4. **Bug 5 (Word multiply)** — Fixes screen offset calculations
5. **Bug 4 (Barrier)** — Future-proofing, lowest priority

## Key Insight: 3 Bugs Cause ALL Symptoms

The original plan identified 5 bugs + optimizer issues. After multi-level analysis, the real picture is:

- **Bugs 1-3 are CORE bugs** present at O0, not caused by the optimizer
- **Bug 4 (barrier) is cosmetic** — loop structure survives without it
- **Bug 5 (word multiply) matters** but is partially caused by Bug 1
- **Optimizer "corruption" (original Bug 4)** is a **SECONDARY EFFECT** — the optimizer is working on broken IL, so its output is also broken. Once core bugs are fixed, optimizer behavior should be re-evaluated.
