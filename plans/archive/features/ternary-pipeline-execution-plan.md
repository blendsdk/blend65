# Ternary Operator Pipeline Execution Plan

> **Status**: Implementation Plan  
> **Date**: January 26, 2026  
> **Priority**: HIGH - Complete pipeline for ternary operator  
> **Estimated Time**: ~8 hours across 4 sessions  
> **Prerequisites**: Parser/AST complete ✅

---

## Executive Summary

This plan implements full ternary operator (`condition ? then : else`) support through the complete compiler pipeline, excluding the optimizer (which is a stub).

### Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Lexer | ✅ COMPLETE | QUESTION token exists |
| Parser | ✅ COMPLETE | TernaryExpression AST node |
| AST Visitor | ✅ COMPLETE | visitTernaryExpression pattern |
| AST Transformer | ✅ COMPLETE | visitTernaryExpression |
| **Semantic Analyzer** | ❌ MISSING | No type checking |
| **IL Generator** | ❌ MISSING | No code generation |
| Optimizer | ⏸️ STUB | Pass-through only (O0) |
| ASM-IL/ACME | ⏳ BLOCKED | Requires IL |

### Pipeline Flow

```
Source Code with Ternary
         │
         ▼
    ┌─────────┐
    │  Lexer  │  ✅ COMPLETE - Tokenizes ? and :
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │ Parser  │  ✅ COMPLETE - Creates TernaryExpression AST
    └────┬────┘
         │
         ▼
    ┌─────────────────┐
    │ Semantic        │  🔧 SESSION 1 - Type checking
    │ Analyzer        │     - Condition must be boolean
    └────┬────────────┘     - Branches must be compatible
         │
         ▼
    ┌─────────────────┐
    │ IL Generator    │  🔧 SESSION 2 - IL code generation
    │                 │     - BRANCH + PHI pattern
    └────┬────────────┘
         │
         ▼
    ┌─────────────────┐
    │ Optimizer       │  ⏸️ SKIP - Stub (pass-through)
    └────┬────────────┘
         │
         ▼
    ┌─────────────────┐
    │ ASM-IL → ACME   │  ✅ Should work (existing infrastructure)
    └────┬────────────┘
         │
         ▼
    6502 Assembly Output
```

---

## Phase 1: Semantic Analyzer Support

### Session 1: Type Checker Implementation

**Files to Modify:**
- `packages/compiler/src/semantic/visitors/type-checker/expressions.ts`

**Dependencies:** Parser TernaryExpression (complete)

---

#### Task 1.1: Add visitTernaryExpression Method

**File:** `packages/compiler/src/semantic/visitors/type-checker/expressions.ts`

**Implementation Pattern (follows existing visitBinaryExpression/visitUnaryExpression):**

```typescript
/**
 * Visit TernaryExpression - type check condition and branches
 *
 * Type rules for ternary operator:
 * - Condition must be boolean (or boolean-compatible)
 * - Then and else branches must have compatible types
 * - Result type is the common type of both branches
 */
public visitTernaryExpression(node: TernaryExpression): void {
  // 1. Type-check condition
  const conditionType = this.typeCheckExpression(node.getCondition());
  
  // 2. Verify condition is boolean-compatible
  if (conditionType.kind !== TypeKind.Boolean) {
    // For 6502, numeric types can be treated as boolean (0 = false, non-zero = true)
    if (!this.isNumericType(conditionType)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Ternary condition must be boolean or numeric, got '${conditionType.name}'`,
        location: node.getCondition().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }
  }
  
  // 3. Type-check then branch
  const thenType = this.typeCheckExpression(node.getThenBranch());
  
  // 4. Type-check else branch
  const elseType = this.typeCheckExpression(node.getElseBranch());
  
  // 5. Determine result type (unify both branch types)
  let resultType: TypeInfo;
  
  if (this.typeSystem.canAssign(thenType, elseType)) {
    resultType = thenType;
  } else if (this.typeSystem.canAssign(elseType, thenType)) {
    resultType = elseType;
  } else if (this.isNumericType(thenType) && this.isNumericType(elseType)) {
    // Both numeric - use larger type
    resultType = this.getLargerNumericType(thenType, elseType);
  } else {
    // Incompatible types
    this.reportDiagnostic({
      severity: DiagnosticSeverity.ERROR,
      message: `Ternary branches have incompatible types: '${thenType.name}' and '${elseType.name}'`,
      location: node.getLocation(),
      code: DiagnosticCode.TYPE_MISMATCH,
    });
    resultType = thenType; // Use then branch type as fallback
  }
  
  // 6. Annotate node with result type
  (node as any).typeInfo = resultType;
}
```

**Required Imports:**
```typescript
import type { TernaryExpression } from '../../../ast/nodes.js';
```

---

#### Task 1.2: Create Unit Tests for Type Checker

**File:** `packages/compiler/src/__tests__/semantic/type-checker/ternary-expression.test.ts`

**Test Cases (15-20 tests):**

```typescript
describe('TypeChecker - TernaryExpression', () => {
  describe('condition type checking', () => {
    test('accepts boolean condition');
    test('accepts numeric condition (implicit boolean)');
    test('rejects string condition');
    test('rejects array condition');
  });
  
  describe('branch type checking', () => {
    test('accepts same-type branches (byte ? byte : byte)');
    test('accepts compatible numeric branches (byte ? byte : word)');
    test('uses larger numeric type as result');
    test('rejects incompatible branch types');
  });
  
  describe('result type inference', () => {
    test('infers byte result from byte branches');
    test('infers word result from word branches');
    test('infers word result from mixed byte/word branches');
    test('infers boolean result from boolean branches');
  });
  
  describe('nested ternary', () => {
    test('type checks nested ternary in else branch');
    test('type checks nested ternary in then branch');
    test('propagates type through multiple nesting levels');
  });
  
  describe('error messages', () => {
    test('reports condition type error with correct location');
    test('reports branch type mismatch with correct location');
  });
});
```

---

#### Task 1.3: Verify Tests Pass

**Command:**
```bash
clear && yarn clean && yarn build && yarn test
```

**Expected:** All new ternary type checker tests pass + existing tests unchanged

---

## Phase 2: IL Generator Support

### Session 2: IL Code Generation

**Files to Modify:**
- `packages/compiler/src/il/generator/expressions.ts`

**Dependencies:** Type Checker (Phase 1)

---

#### Task 2.1: Add TernaryExpression Case to generateExpression

**File:** `packages/compiler/src/il/generator/expressions.ts`

**Add to switch statement in generateExpression method:**

```typescript
case ASTNodeType.TERNARY_EXPR:
  return this.generateTernaryExpression(expr as TernaryExpression, ilFunc);
```

**Required Import:**
```typescript
import { TernaryExpression } from '../../ast/nodes.js';
```

---

#### Task 2.2: Implement generateTernaryExpression Method

**IL Pattern for `condition ? thenExpr : elseExpr`:**

```
     evaluate condition
           │
           ▼
    ┌─────────────┐
    │   BRANCH    │──────────────────┐
    │  condition  │                  │
    └──────┬──────┘                  │
           │ true                    │ false
           ▼                         ▼
    ┌─────────────┐           ┌─────────────┐
    │ thenBlock   │           │ elseBlock   │
    │ thenResult  │           │ elseResult  │
    └──────┬──────┘           └──────┬──────┘
           │                         │
           │      ┌──────────────────┘
           ▼      ▼
    ┌─────────────────┐
    │    endBlock     │
    │ PHI(then, else) │
    └─────────────────┘
```

**Implementation:**

```typescript
/**
 * Generates IL for a ternary expression (condition ? then : else).
 *
 * Creates conditional branch structure with PHI node for result:
 * 1. Evaluate condition
 * 2. Branch to then/else blocks based on condition
 * 3. Evaluate then expression in then block
 * 4. Evaluate else expression in else block
 * 5. Join with PHI node to select result
 *
 * @param expr - Ternary expression
 * @param ilFunc - Current IL function
 * @returns Virtual register containing the result
 */
protected generateTernaryExpression(
  expr: TernaryExpression,
  ilFunc: ILFunction,
): VirtualRegister | null {
  // Create labels for control flow
  const thenLabel = this.createUniqueLabel('ternary_then');
  const elseLabel = this.createUniqueLabel('ternary_else');
  const endLabel = this.createUniqueLabel('ternary_end');
  
  // 1. Evaluate condition
  const condReg = this.generateExpression(expr.getCondition(), ilFunc);
  if (!condReg) {
    return null;
  }
  
  // 2. Emit conditional branch
  this.builder?.emitBranch(condReg, thenLabel, elseLabel);
  
  // 3. Then block
  this.builder?.emitLabel(thenLabel);
  const thenReg = this.generateExpression(expr.getThenBranch(), ilFunc);
  if (!thenReg) {
    return null;
  }
  const thenBlockId = this.builder?.getCurrentBlockId() ?? 0;
  this.builder?.emitJump(endLabel);
  
  // 4. Else block  
  this.builder?.emitLabel(elseLabel);
  const elseReg = this.generateExpression(expr.getElseBranch(), ilFunc);
  if (!elseReg) {
    return null;
  }
  const elseBlockId = this.builder?.getCurrentBlockId() ?? 0;
  
  // 5. End block with PHI node
  this.builder?.emitLabel(endLabel);
  const resultReg = this.builder?.emitPhi([
    { value: thenReg, blockId: thenBlockId },
    { value: elseReg, blockId: elseBlockId },
  ], thenReg.type);
  
  return resultReg ?? null;
}
```

**Note:** May need to check if `ILBuilder` has these methods. If not, they may need to be added or alternatives used.

---

#### Task 2.3: Check ILBuilder API Availability

**Files to Check:**
- `packages/compiler/src/il/builder.ts`

**Required Methods:**
- `emitBranch(condition, thenLabel, elseLabel)` - Conditional branch
- `emitLabel(label)` - Label definition
- `emitJump(label)` - Unconditional jump
- `emitPhi(sources, type)` - PHI node for SSA
- `getCurrentBlockId()` - Get current basic block ID

If any methods are missing, either:
1. Add them to ILBuilder
2. Use existing infrastructure differently

---

#### Task 2.4: Create Unit Tests for IL Generator

**File:** `packages/compiler/src/__tests__/il/generator/ternary-expression.test.ts`

**Test Cases (15-20 tests):**

```typescript
describe('ILGenerator - TernaryExpression', () => {
  describe('basic ternary', () => {
    test('generates BRANCH instruction for condition');
    test('generates then block with expression');
    test('generates else block with expression');
    test('generates JUMP from then block to end');
    test('generates PHI at join point');
  });
  
  describe('nested ternary', () => {
    test('handles nested ternary in else branch');
    test('handles nested ternary in then branch');
    test('handles deeply nested ternary');
  });
  
  describe('branch types', () => {
    test('handles literal expressions in branches');
    test('handles identifier expressions in branches');
    test('handles binary expressions in branches');
    test('handles function calls in branches');
  });
  
  describe('SSA correctness', () => {
    test('PHI sources reference correct blocks');
    test('PHI type matches branch types');
    test('result register has correct type');
  });
});
```

---

#### Task 2.5: Verify Tests Pass

**Command:**
```bash
clear && yarn clean && yarn build && yarn test
```

**Expected:** All new IL generator tests pass + existing tests unchanged

---

## Phase 3: End-to-End Tests

### Session 3: E2E Validation

**Files to Create:**
- `packages/compiler/src/__tests__/e2e/fixtures/ternary/basic.blend`
- `packages/compiler/src/__tests__/e2e/fixtures/ternary/nested.blend`
- `packages/compiler/src/__tests__/e2e/fixtures/ternary/idioms.blend`
- `packages/compiler/src/__tests__/e2e/ternary-e2e.test.ts`

---

#### Task 3.1: Create Basic Ternary Test Fixture

**File:** `packages/compiler/src/__tests__/e2e/fixtures/ternary/basic.blend`

```js
// Basic ternary expression test
// Tests simple condition ? then : else pattern

let flag: bool = true;
let result: byte = flag ? 1 : 0;

let a: byte = 10;
let b: byte = 5;
let max: byte = (a > b) ? a : b;
let min: byte = (a < b) ? a : b;
```

---

#### Task 3.2: Create Nested Ternary Test Fixture

**File:** `packages/compiler/src/__tests__/e2e/fixtures/ternary/nested.blend`

```js
// Nested ternary expression test
// Tests right-associativity: a ? b : c ? d : e = a ? b : (c ? d : e)

let x: byte = 5;

// Nested in else branch (right-associative)
let result1: byte = (x > 10) ? 20 : (x > 5) ? 10 : 0;

// Nested in then branch (explicit parens)
let result2: byte = (x > 0) ? ((x > 5) ? 10 : 5) : 0;
```

---

#### Task 3.3: Create C64 Idioms Test Fixture

**File:** `packages/compiler/src/__tests__/e2e/fixtures/ternary/idioms.blend`

```js
// C64-specific ternary idioms
// Common patterns used in 6502/C64 programming

let x: byte = 42;
let y: byte = 30;
let max_val: byte = 100;

// Maximum value
let maximum: byte = (x > y) ? x : y;

// Minimum value  
let minimum: byte = (x < y) ? x : y;

// Clamp to range
let clamped: byte = (x > max_val) ? max_val : x;

// Direction indicator
let moving_right: bool = true;
let direction: byte = moving_right ? 1 : $FF;

// Sprite enable mask
let enabled: bool = true;
let mask: byte = enabled ? $FF : $00;
```

---

#### Task 3.4: Create E2E Test File

**File:** `packages/compiler/src/__tests__/e2e/ternary-e2e.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import { compileFixture, E2ETestOptions } from './e2e-test-utils.js';

describe('E2E - Ternary Expression', () => {
  const options: E2ETestOptions = {
    level: 0, // O0 - no optimization (stub)
    target: 'c64',
  };

  describe('basic ternary', () => {
    test('compiles without errors', async () => {
      const result = await compileFixture('ternary/basic.blend', options);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('generates valid IL', async () => {
      const result = await compileFixture('ternary/basic.blend', options);
      expect(result.il).toBeDefined();
      // IL should contain BRANCH and PHI instructions
    });
  });

  describe('nested ternary', () => {
    test('compiles without errors', async () => {
      const result = await compileFixture('ternary/nested.blend', options);
      expect(result.success).toBe(true);
    });
  });

  describe('C64 idioms', () => {
    test('compiles without errors', async () => {
      const result = await compileFixture('ternary/idioms.blend', options);
      expect(result.success).toBe(true);
    });
  });
});
```

---

#### Task 3.5: Verify E2E Tests Pass

**Command:**
```bash
clear && yarn clean && yarn build && yarn test
```

**Expected:** All new E2E tests pass

---

## Phase 4: Documentation & Cleanup

### Session 4: Final Verification

---

#### Task 4.1: Update Optimizer Plans (Optional)

**File:** `plans/optimizer/04-control-flow.md`

Add note about ternary operator patterns for future optimization:

```markdown
## Ternary Expression Optimization Notes

When implementing control flow optimizations, consider ternary expressions:

1. **Constant Condition Folding**: If ternary condition is constant, eliminate branch
2. **Conditional Move**: For simple ternary, may convert to CMOV pattern on supported targets
3. **Branch Elimination**: If both branches produce same value, eliminate branch
4. **Common Subexpression**: If condition appears elsewhere, reuse result
```

---

#### Task 4.2: Run Full Test Suite

**Command:**
```bash
clear && yarn clean && yarn build && yarn test
```

**Expected:** 6,450+ tests pass (including ~50 new ternary tests)

---

#### Task 4.3: Mark Plan Complete

Update this file to mark all tasks complete.

---

## Task Implementation Checklist

| Session | Task | Description | Dependencies | Status |
|---------|------|-------------|--------------|--------|
| **1** | 1.1 | Add visitTernaryExpression to type checker | Parser ✅ | [ ] |
| **1** | 1.2 | Create type checker unit tests | 1.1 | [ ] |
| **1** | 1.3 | Verify tests pass | 1.2 | [ ] |
| **2** | 2.1 | Add TERNARY_EXPR case to generateExpression | Phase 1 | [ ] |
| **2** | 2.2 | Implement generateTernaryExpression method | 2.1 | [ ] |
| **2** | 2.3 | Check ILBuilder API availability | 2.2 | [ ] |
| **2** | 2.4 | Create IL generator unit tests | 2.3 | [ ] |
| **2** | 2.5 | Verify tests pass | 2.4 | [ ] |
| **3** | 3.1 | Create basic ternary test fixture | Phase 2 | [ ] |
| **3** | 3.2 | Create nested ternary test fixture | 3.1 | [ ] |
| **3** | 3.3 | Create C64 idioms test fixture | 3.2 | [ ] |
| **3** | 3.4 | Create E2E test file | 3.3 | [ ] |
| **3** | 3.5 | Verify E2E tests pass | 3.4 | [ ] |
| **4** | 4.1 | Update optimizer plans (optional) | Phase 3 | [ ] |
| **4** | 4.2 | Run full test suite | 4.1 | [ ] |
| **4** | 4.3 | Mark plan complete | 4.2 | [ ] |

---

## Session Guidelines

### Session 1 (~2 hours)
- Focus: Semantic Analyzer only
- Complete: Tasks 1.1 - 1.3
- Deliverable: Type checking works for ternary expressions

### Session 2 (~3 hours)
- Focus: IL Generator only  
- Complete: Tasks 2.1 - 2.5
- Deliverable: IL code generation works for ternary expressions

### Session 3 (~2 hours)
- Focus: E2E Testing only
- Complete: Tasks 3.1 - 3.5
- Deliverable: Full pipeline validates with test fixtures

### Session 4 (~1 hour)
- Focus: Documentation & final verification
- Complete: Tasks 4.1 - 4.3
- Deliverable: Complete, documented, tested feature

---

## Success Criteria

- [ ] All 6,450+ tests passing
- [ ] Ternary expressions compile through full pipeline
- [ ] Type checking validates condition and branch types
- [ ] IL generation creates correct BRANCH/PHI pattern
- [ ] E2E tests validate real-world usage patterns
- [ ] No regressions in existing functionality

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ILBuilder missing methods | Medium | High | Check API first, add if needed |
| PHI node complexity | Low | Medium | SSA infrastructure exists |
| Type inference edge cases | Medium | Low | Comprehensive tests |
| ASM-IL translation issues | Low | High | Should work with existing BRANCH support |

---

## References

- Parser TernaryExpression: `packages/compiler/src/parser/expressions.ts`
- AST TernaryExpression: `packages/compiler/src/ast/nodes.ts`
- Type Checker pattern: `packages/compiler/src/semantic/visitors/type-checker/expressions.ts`
- IL Generator pattern: `packages/compiler/src/il/generator/expressions.ts`
- IL PHI instruction: `packages/compiler/src/il/instructions.ts`
- Language spec: `docs/language-specification/06-expressions-statements.md`