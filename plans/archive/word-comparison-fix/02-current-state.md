# Current State: Word Comparison Codegen Fix

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### Comparison Pipeline Architecture

The compiler has **three distinct paths** where comparisons are generated:

| Path | Location | Word-Aware? | Used By |
|------|----------|-------------|---------|
| **Expression path** | `expressions.ts` → `generateBinaryWord()` | ✅ Yes | `let x = a == b;` |
| **Condition path** | `control-flow.ts` → `generateConditionWithBranch()` | ❌ **NO** | `if (a == b)`, `while (a < b)` |
| **For-loop constant** | `control-flow.ts` → `generateForConditionConstant()` | ✅ Yes | `for (i = 0 to 999)` |
| **For-loop dynamic** | `control-flow.ts` → `generateForConditionDynamic()` | ❌ **NO** | `for (i = 0 to someVar)` |

### What Exists (Correct)

**IL Builder** (`il/builder/control.ts`):
- `cmpWordImm(value)` — emits `CMP_WORD_IMM` opcode ✅
- `cmpWordSlot(slot)` — emits `CMP_WORD_SLOT` opcode ✅

**Codegen** (`codegen/generator/comparison.ts`):
- `genCmpWordImm()` — generates `CPX #>val / BNE .done / CMP #<val / .done:` ✅
- `genCmpWordSlot()` — generates `CPX slot+1 / BNE .done / CMP slot / .done:` ✅

**Expression path** (`il/generator/expressions.ts`):
- `generateBinaryWord()` → dispatches to `generateBinaryWordImmediate()` or `generateBinaryWordSlot()` ✅
- These correctly call `cmpWordImm()` and `cmpWordSlot()` ✅

**For-loop constant** (`il/generator/control-flow.ts`):
- `generateForConditionConstant()` checks `isWord` and uses `cmpWordImm()` ✅

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/compiler/src/il/generator/control-flow.ts` | Condition/loop IL generation | **Fix both bugs here** |
| `packages/compiler/src/il/builder/control.ts` | IL builder methods | None (already has word methods) |
| `packages/compiler/src/codegen/generator/comparison.ts` | 6502 codegen for comparisons | None (already correct) |
| `packages/compiler/src/__tests__/il/generator-word-comparisons.test.ts` | Word comparison tests | **Add condition-path tests** |
| `bug-list.md` | Bug catalog | **Update W1 status** |

## Gaps Identified

### Gap 1: `generateConditionWithBranch()` is type-unaware

**Current Behavior:** Always emits byte-width comparisons:
```typescript
// Line ~190 — literal right operand:
this.builder.cmpImm(rightVal, 'compare');  // ← always byte!

// Line ~200 — constant identifier right:
this.builder.cmpImm(constValue, 'compare with const');  // ← always byte!

// Line ~207 — variable right:
this.builder.cmpSlot(slot, 'compare');  // ← always byte!
```

**Required Behavior:** Check left operand type and use word opcodes when word-typed:
```typescript
// When isWordLeft is true:
this.builder.cmpWordImm(rightVal, 'compare');    // for literals
this.builder.cmpWordImm(constValue, 'compare');  // for constants
this.builder.cmpWordSlot(slot, 'compare');        // for word variables
```

**Fix Required:** Add `isWordTyped()` / `inferWordWidthFromExpression()` check on left operand, then branch to word comparison methods.

### Gap 2: `generateForConditionDynamic()` only handles bytes

**Current Behavior:** For word counters with dynamic bounds:
```typescript
// 1. Loads word: loadSlotWord (correct — A:X loaded)
// 2. pushA — only saves A (low byte)! X is lost!
// 3. generateExpression(endExpr) — clobbers A:X
// 4. storeSlot(zpTemp) — byte store only!
// 5. popA — restores only A (low byte)
// 6. cmpSlot(zpTemp) — byte comparison only!
```

**Required Behavior:** For word counters:
```typescript
// 1. loadSlotWord (correct)
// 2. pushA + transferXA + pushA — save both bytes
// 3. generateExpression(endExpr) — evaluate end
// 4. storeSlotWord(zpTempWord) — word store
// 5. popA + transferAX + popA — restore both bytes
// 6. cmpWordSlot(zpTempWord) — word comparison
```

**Fix Required:** Add `isWord` branch in `generateForConditionDynamic()` for full 16-bit save/compare/restore cycle.

## Dependencies

### Internal Dependencies

- `isWordTyped()` method — inherited from `ILGeneratorExpressions`, already available ✅
- `inferWordWidthFromExpression()` — inherited, already available ✅
- `cmpWordImm()` / `cmpWordSlot()` on builder — already exist ✅
- `createZpTempSlot()` — already exists, may need word variant

### External Dependencies

- None

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Byte comparison regression | Low | High | Run full test suite before/after |
| Mixed type edge case (byte left, word right) | Medium | Medium | Test mixed types explicitly |
| Dynamic for-loop word path untested | Medium | Low | Add targeted test |
