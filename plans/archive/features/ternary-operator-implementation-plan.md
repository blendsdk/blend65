# Ternary Operator Implementation Plan

> **Status**: Ready for Implementation
> **Created**: January 25, 2026
> **Estimated Sessions**: 2

## Overview

This plan covers implementing the ternary conditional operator (`condition ? thenExpr : elseExpr`) in the Blend65 compiler.

### Current Status

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Lexer | ✅ Done | `QUESTION` and `COLON` tokens exist |
| AST | ❌ Missing | Create `TernaryExpression` node |
| Precedence | ❌ Missing | Add `TERNARY` level |
| Parser | ❌ Missing | Add ternary parsing logic |
| Visitors | ❌ Missing | Update all AST visitors |
| Type Guards | ❌ Missing | Add `isTernaryExpression()` |
| Tests | ❌ Missing | Add comprehensive tests |

### Syntax

```js
// Simple ternary
let max = (a > b) ? a : b;

// Nested ternary (right-associative)
let grade = (score > 90) ? "A" : (score > 80) ? "B" : "C";

// Ternary in expressions
let offset = baseX + ((direction > 0) ? speed : -speed);
```

### 6502 Code Generation

Ternary compiles to the same branch code as if-else (no performance difference on 6502):

```asm
; let max = (a > b) ? a : b;
    LDA a
    CMP b
    BCC .take_b      ; if a < b (carry clear), take b
    LDA a
    JMP .done
.take_b:
    LDA b
.done:
    STA max
```

---

## Phase 1: AST Node Creation

**Session**: 1
**Estimated Lines**: ~50

### Task 1.1: Add ASTNodeType Entry

**File:** `packages/compiler/src/ast/base.ts`

Add to `ASTNodeType` enum:

```typescript
export enum ASTNodeType {
  // ... existing expression types
  UNARY_EXPR = 'UnaryExpression',
  BINARY_EXPR = 'BinaryExpression',
  TERNARY_EXPR = 'TernaryExpression',  // NEW
  // ... rest of types
}
```

### Task 1.2: Update ASTVisitor Interface

**File:** `packages/compiler/src/ast/base.ts`

Add to `ASTVisitor<R>` interface:

```typescript
export interface ASTVisitor<R> {
  // ... existing expression visitors
  visitUnaryExpression(node: UnaryExpression): R;
  visitBinaryExpression(node: BinaryExpression): R;
  visitTernaryExpression(node: TernaryExpression): R;  // NEW
  // ... rest of visitors
}
```

### Task 1.3: Create TernaryExpression AST Node

**File:** `packages/compiler/src/ast/nodes.ts`

Add new class:

```typescript
/**
 * Ternary conditional expression: condition ? thenBranch : elseBranch
 *
 * Examples:
 * - (a > b) ? a : b
 * - isValid ? process() : error()
 * - (x > 0) ? x : -x
 *
 * The ternary operator is right-associative:
 * a ? b : c ? d : e → a ? b : (c ? d : e)
 *
 * Both branches must have compatible types (validated in semantic analysis).
 */
export class TernaryExpression extends Expression {
  /**
   * Creates a new ternary conditional expression
   *
   * @param condition - The condition expression (evaluated first)
   * @param thenBranch - Expression returned if condition is true
   * @param elseBranch - Expression returned if condition is false
   * @param location - Source location spanning the entire expression
   */
  constructor(
    public readonly condition: Expression,
    public readonly thenBranch: Expression,
    public readonly elseBranch: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.TERNARY_EXPR, location);
  }

  /**
   * Accepts a visitor for the visitor pattern
   *
   * @param visitor - The visitor to accept
   * @returns Result from the visitor
   */
  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitTernaryExpression(this);
  }
}
```

### Task 1.4: Add Type Guard

**File:** `packages/compiler/src/ast/type-guards.ts`

Add type guard function:

```typescript
/**
 * Type guard for TernaryExpression nodes (condition ? then : else)
 *
 * @param node - AST node to check
 * @returns True if node is a TernaryExpression
 */
export function isTernaryExpression(
  node: ASTNode | null | undefined
): node is TernaryExpression {
  return node instanceof TernaryExpression;
}
```

### Task 1.5: Update Exports

**File:** `packages/compiler/src/ast/index.ts`

Ensure `TernaryExpression` and `isTernaryExpression` are exported.

---

## Phase 2: Parser Changes

**Session**: 1
**Estimated Lines**: ~40

### Task 2.1: Add Ternary Precedence Level

**File:** `packages/compiler/src/parser/precedence.ts`

Update precedence enum (ternary is between assignment and logical OR):

```typescript
export enum OperatorPrecedence {
  /** No precedence (not an operator) */
  NONE = 0,

  /** Assignment operators: =, +=, -=, etc. */
  ASSIGNMENT = 1,

  /** Ternary conditional: ?: (NEW) */
  TERNARY = 2,

  /** Logical OR: || */
  LOGICAL_OR = 3,

  /** Logical AND: && */
  LOGICAL_AND = 4,

  /** Bitwise OR: | */
  BITWISE_OR = 5,

  /** Bitwise XOR: ^ */
  BITWISE_XOR = 6,

  /** Bitwise AND: & */
  BITWISE_AND = 7,

  /** Equality: ==, != */
  EQUALITY = 8,

  /** Relational: <, <=, >, >= */
  RELATIONAL = 9,

  /** Shift: <<, >> */
  SHIFT = 10,

  /** Additive: +, - */
  ADDITIVE = 11,

  /** Multiplicative: *, /, % */
  MULTIPLICATIVE = 12,

  /** Unary: !, ~, unary -, unary + */
  UNARY = 13,

  /** Postfix: [], ., () */
  POSTFIX = 14,
}
```

Add to precedence table:

```typescript
// TERNARY (Precedence 2)
[TokenType.QUESTION, OperatorPrecedence.TERNARY],
```

Update `isRightAssociative()` to include ternary:

```typescript
export function isRightAssociative(tokenType: TokenType): boolean {
  const prec = getPrecedence(tokenType);
  // Assignment and ternary are right-associative
  return prec === OperatorPrecedence.ASSIGNMENT || prec === OperatorPrecedence.TERNARY;
}
```

### Task 2.2: Add Ternary Parsing Logic

**File:** `packages/compiler/src/parser/expressions.ts`

Add import:

```typescript
import { TernaryExpression } from '../ast/index.js';
```

Modify `parseExpression()` method to handle ternary after parsing the left operand:

```typescript
protected parseExpression(minPrecedence: number = OperatorPrecedence.NONE): Expression {
  // Parse left side (unary expression, which handles postfix and atomic expressions)
  let left = this.parseUnaryExpression();

  // Handle ternary operator (right-associative, special syntax with ? and :)
  if (this.check(TokenType.QUESTION) && OperatorPrecedence.TERNARY >= minPrecedence) {
    left = this.parseTernaryExpression(left);
  }

  // Parse binary operators with precedence climbing
  while (this.isBinaryOp() && this.getCurrentPrecedence() >= minPrecedence) {
    // ... existing binary operator parsing
  }

  return left;
}
```

Add new method:

```typescript
/**
 * Parses a ternary conditional expression
 *
 * Grammar: conditional_expr = logical_or_expr , [ "?" , expression , ":" , conditional_expr ] ;
 *
 * The ternary operator is right-associative:
 * a ? b : c ? d : e → a ? b : (c ? d : e)
 *
 * Examples:
 * - (a > b) ? a : b
 * - isValid ? compute() : defaultValue
 * - (score > 90) ? "A" : (score > 80) ? "B" : "C"
 *
 * @param condition - The already-parsed condition expression
 * @returns TernaryExpression AST node
 */
protected parseTernaryExpression(condition: Expression): TernaryExpression {
  // Consume '?'
  this.expect(TokenType.QUESTION, "Expected '?' in ternary expression");

  // Parse 'then' branch expression
  // Use TERNARY precedence to allow nested ternaries in else branch (right-associative)
  const thenBranch = this.parseExpression(OperatorPrecedence.TERNARY + 1);

  // Expect ':'
  if (!this.match(TokenType.COLON)) {
    this.reportError(
      DiagnosticCode.EXPECTED_TOKEN,
      "Expected ':' in ternary expression"
    );
  }

  // Parse 'else' branch expression
  // Use TERNARY precedence to allow chained ternaries (right-associative)
  const elseBranch = this.parseExpression(OperatorPrecedence.TERNARY);

  // Create location spanning from condition to else branch
  const location = this.mergeLocations(condition.getLocation(), elseBranch.getLocation());

  return new TernaryExpression(condition, thenBranch, elseBranch, location);
}
```

---

## Phase 3: Update Visitors

**Session**: 2
**Estimated Lines**: ~30

### Task 3.1: Update Base Walker

**File:** `packages/compiler/src/ast/walker/base.ts`

Add import and visitor method:

```typescript
import { TernaryExpression } from '../nodes.js';

// In class:
visitTernaryExpression(node: TernaryExpression): void {
  if (this.shouldStop) return;
  this.visit(node.condition);
  this.visit(node.thenBranch);
  this.visit(node.elseBranch);
}
```

### Task 3.2: Update Context Walker

**File:** `packages/compiler/src/ast/walker/context.ts`

Add import and visitor method:

```typescript
import { TernaryExpression } from '../nodes.js';

// In class:
visitTernaryExpression(node: TernaryExpression): void {
  if (this.shouldStop) return;
  this.walkWithContext(node.condition);
  this.walkWithContext(node.thenBranch);
  this.walkWithContext(node.elseBranch);
}
```

### Task 3.3: Update Transformer

**File:** `packages/compiler/src/ast/walker/transformer.ts`

Add import and visitor method:

```typescript
import { TernaryExpression } from '../nodes.js';

// In class:
visitTernaryExpression(node: TernaryExpression): ASTNode {
  return node;
}
```

---

## Phase 4: Tests

**Session**: 2
**Estimated Lines**: ~100

### Task 4.1: Create Parser Tests

**File:** `packages/compiler/src/__tests__/parser/expressions/ternary.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { TernaryExpression, isTernaryExpression } from '../../../ast/index.js';

describe('TernaryExpression Parsing', () => {
  function parseExpression(source: string) {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parseExpressionForTest();
  }

  describe('simple ternary expressions', () => {
    it('should parse simple ternary: a ? b : c', () => {
      const expr = parseExpression('a ? b : c');
      expect(isTernaryExpression(expr)).toBe(true);
      // ... assertions
    });

    it('should parse ternary with comparison: (x > 0) ? x : y', () => {
      const expr = parseExpression('(x > 0) ? x : y');
      expect(isTernaryExpression(expr)).toBe(true);
    });

    it('should parse ternary with literals: flag ? 1 : 0', () => {
      const expr = parseExpression('flag ? 1 : 0');
      expect(isTernaryExpression(expr)).toBe(true);
    });
  });

  describe('nested ternary expressions', () => {
    it('should parse right-associative chained ternary', () => {
      // a ? b : c ? d : e → a ? b : (c ? d : e)
      const expr = parseExpression('a ? b : c ? d : e');
      expect(isTernaryExpression(expr)).toBe(true);
    });
  });

  describe('ternary in expressions', () => {
    it('should parse ternary in assignment', () => {
      const expr = parseExpression('x = a ? b : c');
      // ... assertions
    });
  });

  describe('error cases', () => {
    it('should report error for missing colon', () => {
      // Test error reporting
    });

    it('should report error for missing else branch', () => {
      // Test error reporting
    });
  });
});
```

---

## Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `packages/compiler/src/ast/base.ts` | 1 | ASTNodeType, ASTVisitor |
| `packages/compiler/src/ast/nodes.ts` | 1 | TernaryExpression class |
| `packages/compiler/src/ast/type-guards.ts` | 1 | isTernaryExpression |
| `packages/compiler/src/ast/index.ts` | 1 | exports |
| `packages/compiler/src/parser/precedence.ts` | 2 | TERNARY level |
| `packages/compiler/src/parser/expressions.ts` | 2 | parsing logic |
| `packages/compiler/src/ast/walker/base.ts` | 3 | visitor |
| `packages/compiler/src/ast/walker/context.ts` | 3 | visitor |
| `packages/compiler/src/ast/walker/transformer.ts` | 3 | visitor |
| `packages/compiler/src/__tests__/parser/expressions/ternary.test.ts` | 4 | tests |

---

## Implementation Checklist

### Session 1: AST + Parser

- [ ] Task 1.1: Add `TERNARY_EXPR` to ASTNodeType enum
- [ ] Task 1.2: Add `visitTernaryExpression` to ASTVisitor interface
- [ ] Task 1.3: Create `TernaryExpression` class in nodes.ts
- [ ] Task 1.4: Add `isTernaryExpression` type guard
- [ ] Task 1.5: Update exports in index.ts
- [ ] Task 2.1: Add TERNARY precedence level
- [ ] Task 2.2: Add ternary parsing logic in expressions.ts
- [ ] Run tests to verify no regressions

### Session 2: Visitors + Tests

- [ ] Task 3.1: Update base walker with visitTernaryExpression
- [ ] Task 3.2: Update context walker with visitTernaryExpression
- [ ] Task 3.3: Update transformer with visitTernaryExpression
- [ ] Task 4.1: Create comprehensive ternary expression tests
- [ ] Run full test suite
- [ ] Verify build succeeds

---

## Success Criteria

1. ✅ `let max = (a > b) ? a : b;` parses correctly
2. ✅ Nested ternary `a ? b : c ? d : e` is right-associative
3. ✅ All existing tests pass
4. ✅ New ternary tests pass
5. ✅ Build succeeds with no TypeScript errors