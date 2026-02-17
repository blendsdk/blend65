# Type Info Propagation: Item D

> **Document**: 04-type-propagation.md
> **Parent**: [Index](00-index.md)
> **Scope**: Architectural fix — semantic analyzer propagates type info to AST expression nodes
> **Files**: `packages/compiler/src/semantic/analyzer.ts`, `packages/compiler/src/semantic/visitors/`, `packages/compiler/src/ast/base.ts`

## Overview

Item D addresses the root architectural weakness that causes Items A, E, and many future "wrong width" bugs. Currently, `expr.getTypeInfo()` returns `null` for virtually all expressions because the semantic analyzer never calls `expr.setTypeInfo()` during compilation. The IL generator is forced to rely on `inferWordWidthFromExpression()` — a fragile, incomplete heuristic that only recognizes identifier expressions with word-sized slots.

Fixing this properly makes `getTypeInfo()` the authoritative type oracle for the entire IL generation layer, eliminating entire classes of byte/word dispatch bugs.

---

## Problem: `getTypeInfo()` Always Returns Null

### Current State

The AST `Expression` base class has `getTypeInfo()` and `setTypeInfo()` methods:

```typescript
// In ast/base.ts (Expression class)
getTypeInfo(): TypeInfo | undefined { return this.typeInfo; }
setTypeInfo(typeInfo: TypeInfo): void { this.typeInfo = typeInfo; }
```

These are never called by the semantic analyzer during the normal compilation pipeline. The only call to `setTypeInfo()` is in certain test setups.

### Impact on IL Generator

In `generateBinary()` (expressions.ts, line ~470):

```typescript
const resultType = expr.getTypeInfo();
if (resultType?.kind === TypeKind.Word) {
  this.generateBinaryWord(expr);  // ← NEVER REACHED in production
  return;
}
```

This check always falls through because `resultType` is `undefined`. The IL generator then falls back to `inferWordWidthFromExpression()`, which is incomplete (see Item A).

---

## Fix Strategy: Semantic Analyzer Type Annotation Pass

### Phase 1: Identify Where Types Are Resolved

The semantic analyzer already resolves types for:
- Variable declarations (`let x: byte = ...` → byte type known)
- Function parameters (`function f(x: word)` → word type known)
- Function return types (`function f(): word` → word return known)
- Constant declarations (`const N: byte = 5` → byte type known)

These type resolutions happen in the semantic visitors (`packages/compiler/src/semantic/visitors/`). The missing step is **propagating** these resolved types onto the AST expression nodes.

### Phase 2: What Needs Type Annotation

| Expression Type | How to Determine Type |
|----------------|----------------------|
| `LiteralExpression` (number) | Context-dependent: byte unless assigned to word variable or used in word context |
| `LiteralExpression` (boolean) | Always byte (0 or 1) |
| `IdentifierExpression` | Look up variable in symbol table → use declared type |
| `BinaryExpression` | Result type = wider of left/right operand types |
| `UnaryExpression` (`@`) | Always word (16-bit address) |
| `UnaryExpression` (`-`, `!`, `~`) | Same type as operand |
| `CallExpression` | Function's declared return type |
| `AssignmentExpression` | Target variable's declared type |
| `IndexExpression` | Array element type (currently always byte) |
| `TernaryExpression` | Wider of then/else branch types |

### Phase 3: Implementation Approach

**Option A: Add a dedicated type annotation visitor pass** (Recommended)

Create a new visitor that runs after the existing semantic analysis but before IL generation. This visitor walks all expression nodes and calls `setTypeInfo()` with the resolved type.

```typescript
// packages/compiler/src/semantic/visitors/type-annotator.ts
export class TypeAnnotatorVisitor extends BaseVisitor {
  /**
   * Annotate all expression nodes with their resolved types.
   * Runs after symbol resolution and type checking.
   */
  visitIdentifierExpression(expr: IdentifierExpression): void {
    const symbol = this.symbolTable.lookup(expr.getName());
    if (symbol?.type) {
      expr.setTypeInfo(symbol.type);
    }
  }

  visitUnaryExpression(expr: UnaryExpression): void {
    // Visit operand first
    this.visit(expr.getOperand());

    if (expr.getOperator() === TokenType.AT) {
      // Address-of always produces word
      expr.setTypeInfo(BUILTIN_TYPES.WORD);
    } else {
      // Inherit operand type
      const operandType = expr.getOperand().getTypeInfo();
      if (operandType) expr.setTypeInfo(operandType);
    }
  }

  visitBinaryExpression(expr: BinaryExpression): void {
    // Visit children first
    this.visit(expr.getLeft());
    this.visit(expr.getRight());

    // Result type = wider of left/right
    const leftType = expr.getLeft().getTypeInfo();
    const rightType = expr.getRight().getTypeInfo();
    const resultType = this.widerType(leftType, rightType);
    if (resultType) expr.setTypeInfo(resultType);
  }

  // ... other expression types
}
```

**Option B: Inline type annotation into existing semantic visitors**

Add `setTypeInfo()` calls directly into the existing semantic analysis code wherever types are resolved. This avoids a separate pass but scatters the logic.

**Recommendation: Option A** — cleaner separation of concerns, easier to test, doesn't risk regression in existing semantic analysis.

### Phase 4: Integration Point

The type annotation pass should run:
1. After semantic analysis (symbols resolved, types checked)
2. Before IL generation (so `getTypeInfo()` returns valid data)

```typescript
// In the compilation pipeline:
semanticAnalyzer.analyze(ast);      // existing
typeAnnotator.annotate(ast);        // NEW — sets typeInfo on all expressions
ilGenerator.generate(ast);          // existing — now getTypeInfo() works
```

---

## What This Enables

Once `getTypeInfo()` works, the IL generator's type dispatch becomes reliable:

```typescript
// In generateBinary():
const resultType = expr.getTypeInfo();
if (resultType?.kind === TypeKind.Word) {
  this.generateBinaryWord(expr);  // ← NOW WORKS in production
  return;
}
```

This eliminates the need for `inferWordWidthFromExpression()` as the primary dispatch mechanism. The heuristic can remain as a fallback safety net, but the authoritative path goes through `getTypeInfo()`.

### Bugs This Prevents

- **Item A**: `@variable + i` would have `getTypeInfo() → Word` because `@` is annotated as word
- **Item E**: Word index variables would be correctly typed, preventing byte truncation
- **Future**: Any expression involving word operands is correctly dispatched

---

## Files Changed

| File | Change |
|------|--------|
| `semantic/visitors/type-annotator.ts` | **NEW** — Type annotation visitor |
| `semantic/analyzer.ts` | Integrate type annotator pass after semantic analysis |
| `semantic/types.ts` | Possibly add `widerType()` utility if not exists |
| `ast/base.ts` | No changes needed (getTypeInfo/setTypeInfo already exist) |

## Dependencies

- No dependencies on Items A, B, C (can be implemented in parallel)
- However, Item D is the most impactful fix — once type info propagates, Items A and E become less critical (though still worth fixing as safety nets)

## Regression Risk

**Low-Medium.** The type annotator is a new pass that only calls `setTypeInfo()`. Since `getTypeInfo()` currently returns `undefined` everywhere, setting it to a valid value can only improve dispatch decisions. The only risk is setting a **wrong** type, which would route expressions to the wrong byte/word path. Comprehensive testing is essential.

## Testing Strategy

See [09-testing-strategy.md](09-testing-strategy.md). Key tests:

| Test | Description |
|------|-------------|
| Literal byte type annotation | `5` in byte context → TypeKind.Byte |
| Literal word type annotation | `1000` in word context → TypeKind.Word |
| Identifier type annotation | `let x: word = 0` → x reference has TypeKind.Word |
| Address-of type annotation | `@myData` → TypeKind.Word |
| Binary type widening | `byteVar + wordVar` → TypeKind.Word result |
| Function return type | `myFunc()` where returns word → TypeKind.Word |
| No regression in existing tests | All 6500+ tests still pass |
