# Array Literals Implementation Plan

> **✅ STATUS: COMPLETED** - All tasks implemented and tested  
> **Archived**: January 19, 2026

**Date**: January 13, 2026
**Feature**: Array Literal Expressions
**Priority**: P1 - High Priority
**Estimated Effort**: 2-4 hours
**Status**: ~~Ready for Implementation~~ → **COMPLETED**

---

## Executive Summary

Implement array literal expressions to allow developers to initialize arrays inline with values, dramatically improving developer experience and code readability.

**Current State**: Arrays must be initialized element-by-element (verbose)
**Target State**: Arrays can be initialized with `[1, 2, 3]` syntax (concise)

---

## Context & Justification

### Problem Statement

Currently, array initialization in Blend65 requires verbose element-by-element assignment:

```js
// ❌ Current: Verbose and error-prone
let colors: byte[3];
colors[0] = 2;
colors[1] = 5;
colors[2] = 6;

// ❌ For larger arrays: Extremely verbose
let spriteData: byte[63];
spriteData[0] = 0xFF;
spriteData[1] = 0x3C;
// ... 61 more lines ...
```

### Proposed Solution

Enable concise array literal syntax:

```js
// ✅ Target: Concise and clear
let colors: byte[3] = [2, 5, 6];

// ✅ For larger arrays: Much more manageable
let spriteData: byte[63] = [
  0xFF, 0x3C, 0x18, 0x18, 0x18, 0x3C, 0xFF, 0x00,
  // ... more values ...
];

// ✅ Nested arrays
let matrix: byte[2][2] = [[1, 2], [3, 4]];

// ✅ Expressions in arrays
let values: byte[3] = [x, y + 1, calculateValue()];
```

### Benefits

1. **Developer Experience**: 90% reduction in initialization code
2. **Readability**: Clear intent at declaration site
3. **Maintainability**: Easier to modify array contents
4. **C64 Development**: Critical for sprite data, color palettes, lookup tables
5. **Specification Compliance**: Brings parser to 100% of specified features

---

## Implementation Phases

### Phase 1: AST Node Implementation

**Goal**: Add ArrayLiteralExpression AST node

**Tasks**:

1. Add `ARRAY_LITERAL_EXPR` to `ASTNodeType` enum
2. Create `ArrayLiteralExpression` class
3. Add visitor pattern method
4. Export from ast/index.ts

**Implementation Location**: `packages/compiler/src/ast/nodes.ts`

### Phase 2: Parser Implementation

**Goal**: Parse array literal syntax into AST

**Tasks**:

1. Add array literal parsing to `ExpressionParser`
2. Handle empty arrays: `[]`
3. Handle single/multiple elements: `[1]`, `[1, 2, 3]`
4. Handle nested arrays: `[[1, 2], [3, 4]]`
5. Handle trailing commas: `[1, 2, 3,]`
6. Integrate with primary expression parsing

**Implementation Location**: `packages/compiler/src/parser/expressions.ts`

### Phase 3: Testing

**Goal**: Comprehensive test coverage

**Tasks**:

1. Create test file: `array-literals.test.ts`
2. Test empty arrays
3. Test single/multiple elements
4. Test nested arrays
5. Test expressions in arrays
6. Test error cases
7. Test integration with variable declarations

**Implementation Location**: `packages/compiler/src/__tests__/parser/array-literals.test.ts`

### Phase 4: Documentation

**Goal**: Update language specification

**Tasks**:

1. Add array literal section to 06-expressions-statements.md
2. Add examples throughout specification
3. Update grammar documentation

**Implementation Location**: `docs/language-specification/06-expressions-statements.md`

---

## Detailed Task Breakdown

### Task 1.1: Add AST Node Type Enum

**File**: `packages/compiler/src/ast/base.ts`

**Changes**:

```typescript
export enum ASTNodeType {
  // ... existing types ...
  ARRAY_LITERAL_EXPR = 'ArrayLiteralExpression',
  // ... rest ...
}
```

**Acceptance Criteria**:

- ✅ New enum value added
- ✅ No TypeScript compilation errors
- ✅ Follows naming convention

**Estimated Time**: 2 minutes

---

### Task 1.2: Create ArrayLiteralExpression Class

**File**: `packages/compiler/src/ast/nodes.ts`

**Changes**:

```typescript
/**
 * Array literal expression node
 *
 * Represents: [1, 2, 3], [x, y], [[1, 2], [3, 4]]
 */
export class ArrayLiteralExpression extends Expression {
  /**
   * Creates an Array Literal expression
   * @param elements - Array element expressions
   * @param location - Source location
   */
  constructor(
    protected readonly elements: Expression[],
    location: SourceLocation
  ) {
    super(ASTNodeType.ARRAY_LITERAL_EXPR, location);
  }

  public getElements(): Expression[] {
    return this.elements;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitArrayLiteralExpression(this);
  }
}
```

**Acceptance Criteria**:

- ✅ Class extends Expression
- ✅ Stores array elements
- ✅ Has getter method
- ✅ Implements visitor pattern
- ✅ JSDoc comments complete

**Estimated Time**: 5 minutes

---

### Task 1.3: Add Visitor Method to ASTVisitor

**File**: `packages/compiler/src/ast/base.ts`

**Changes**:

```typescript
export interface ASTVisitor<R = void> {
  // ... existing methods ...
  visitArrayLiteralExpression(node: ArrayLiteralExpression): R;
  // ... rest ...
}
```

**Note**: This will cause TypeScript errors until all visitors implement the method. This is expected and will be resolved in semantic analysis phase.

**Acceptance Criteria**:

- ✅ Method signature added to interface
- ✅ Follows naming convention
- ✅ Uses correct node type

**Estimated Time**: 2 minutes

---

### Task 1.4: Export from ast/index.ts

**File**: `packages/compiler/src/ast/index.ts`

**Changes**:

```typescript
export {
  // ... existing exports ...
  ArrayLiteralExpression,
  // ... rest ...
} from './nodes.js';
```

**Acceptance Criteria**:

- ✅ Export added
- ✅ Alphabetically ordered
- ✅ No compilation errors

**Estimated Time**: 1 minute

---

### Task 2.1: Implement parseArrayLiteral Method

**File**: `packages/compiler/src/parser/expressions.ts`

**Changes**:

```typescript
/**
 * Parse array literal expression
 *
 * Grammar:
 * array_literal = "[" , [ expression_list ] , "]" ;
 * expression_list = expression , { "," , expression } , [ "," ] ;
 *
 * Handles:
 * - Empty arrays: []
 * - Single element: [42]
 * - Multiple elements: [1, 2, 3]
 * - Nested arrays: [[1, 2], [3, 4]]
 * - Trailing commas: [1, 2, 3,]
 * - Expressions: [x, y + 1, foo()]
 *
 * @returns ArrayLiteralExpression AST node
 */
protected parseArrayLiteral(): Expression {
  const startToken = this.getCurrentToken();

  // Parse opening bracket
  this.expect(TokenType.LEFT_BRACKET, "Expected '['");

  const elements: Expression[] = [];

  // Handle empty array: []
  if (this.check(TokenType.RIGHT_BRACKET)) {
    const location = this.createLocation(startToken, this.getCurrentToken());
    this.advance(); // consume ']'
    return new ArrayLiteralExpression(elements, location);
  }

  // Parse element list
  do {
    // Parse element expression (can be any expression, including nested arrays)
    const element = this.parseExpression();
    elements.push(element);

    // Check for comma (required between elements, optional after last)
    if (this.match(TokenType.COMMA)) {
      // Check for trailing comma: [1, 2, 3,]
      if (this.check(TokenType.RIGHT_BRACKET)) {
        break; // Allow trailing comma
      }
      // Continue parsing next element
    } else {
      // No comma, must be end of list
      break;
    }
  } while (!this.check(TokenType.RIGHT_BRACKET) && !this.isAtEnd());

  // Parse closing bracket
  this.expect(TokenType.RIGHT_BRACKET, "Expected ']' after array elements");

  const location = this.createLocation(startToken, this.getCurrentToken());
  return new ArrayLiteralExpression(elements, location);
}
```

**Acceptance Criteria**:

- ✅ Handles empty arrays
- ✅ Handles single/multiple elements
- ✅ Handles trailing commas
- ✅ Handles nested arrays (recursive)
- ✅ Proper error recovery
- ✅ Creates correct AST nodes
- ✅ Source locations tracked

**Estimated Time**: 20 minutes

---

### Task 2.2: Integrate with Primary Expression Parsing

**File**: `packages/compiler/src/parser/expressions.ts`

**Changes**:

Find the `parsePrimaryExpression()` method and add array literal case:

```typescript
protected parsePrimaryExpression(): Expression {
  // ... existing cases (literals, identifiers, parentheses) ...

  // Array literal: [1, 2, 3]
  if (this.check(TokenType.LEFT_BRACKET)) {
    return this.parseArrayLiteral();
  }

  // ... error case ...
}
```

**Acceptance Criteria**:

- ✅ Array literals recognized as primary expressions
- ✅ Proper precedence handling
- ✅ No conflicts with index expressions

**Estimated Time**: 5 minutes

---

### Task 3.1: Create Array Literals Test File

**File**: `packages/compiler/src/__tests__/parser/array-literals.test.ts`

**Content Structure**:

```typescript
import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import {
  isArrayLiteralExpression,
  isLiteralExpression,
  isIdentifierExpression,
  isBinaryExpression,
} from '../../ast/type-guards.js';

describe('Parser - Array Literals', () => {
  // Helper function
  function parseExpression(source: string) {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const program = parser.parse();
    // Extract expression from program...
    return expression;
  }

  describe('Empty Arrays', () => {
    // Tests...
  });

  describe('Single Element Arrays', () => {
    // Tests...
  });

  describe('Multiple Element Arrays', () => {
    // Tests...
  });

  describe('Nested Arrays', () => {
    // Tests...
  });

  describe('Expressions in Arrays', () => {
    // Tests...
  });

  describe('Trailing Commas', () => {
    // Tests...
  });

  describe('Error Cases', () => {
    // Tests...
  });

  describe('Integration with Variable Declarations', () => {
    // Tests...
  });
});
```

**Estimated Time**: 10 minutes (setup)

---

### Task 3.2: Implement Test Cases

**Test Categories**:

1. **Empty Arrays** (5 tests)
   - `[]`
   - Empty with whitespace: `[ ]`
   - Empty in variable declaration

2. **Single Element Arrays** (5 tests)
   - Number literal: `[42]`
   - String literal: `["hello"]`
   - Identifier: `[x]`
   - Expression: `[x + 1]`
   - Call expression: `[foo()]`

3. **Multiple Element Arrays** (8 tests)
   - Numbers: `[1, 2, 3]`
   - Mixed types: `[1, "hello", true]`
   - Variables: `[x, y, z]`
   - Expressions: `[a + b, c * d]`
   - Long list: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`
   - With whitespace: `[1,  2,   3]`
   - Multiline: `[\n  1,\n  2,\n  3\n]`

4. **Nested Arrays** (6 tests)
   - 2D array: `[[1, 2], [3, 4]]`
   - 3D array: `[[[1, 2]], [[3, 4]]]`
   - Mixed nesting: `[1, [2, 3], 4]`
   - Empty nested: `[[]]`
   - Deep nesting: `[[[[1]]]]`

5. **Expressions in Arrays** (8 tests)
   - Binary expressions: `[a + b, c - d]`
   - Unary expressions: `[-x, !y]`
   - Call expressions: `[foo(), bar()]`
   - Member access: `[player.x, player.y]`
   - Index expressions: `[arr[0], arr[1]]`
   - Address-of: `[@x, @y]`
   - Complex: `[a + b * c, foo(x, y)]`

6. **Trailing Commas** (4 tests)
   - Single element with comma: `[1,]`
   - Multiple elements with comma: `[1, 2, 3,]`
   - Nested with comma: `[[1, 2,], [3, 4,],]`
   - Empty should not allow comma: `[,]` (error)

7. **Error Cases** (6 tests)
   - Missing closing bracket: `[1, 2, 3`
   - Missing comma: `[1 2 3]`
   - Double comma: `[1,, 2]`
   - Leading comma: `[, 1, 2]`
   - Invalid expression: `[+]`
   - Unclosed nested: `[[1, 2]`

8. **Integration with Variable Declarations** (5 tests)
   - Basic: `let arr: byte[3] = [1, 2, 3];`
   - Const: `const colors: byte[3] = [2, 5, 6];`
   - Storage class: `@data const lookup: byte[256] = [/* values */];`
   - Nested array type: `let matrix: byte[2][2] = [[1, 2], [3, 4]];`
   - Expression values: `let vals: word[3] = [x, y + 1, z * 2];`

**Total Tests**: ~47 test cases

**Acceptance Criteria**:

- ✅ All test categories implemented
- ✅ Tests use type guards (no casting to any)
- ✅ Tests verify AST structure
- ✅ Error cases tested
- ✅ All tests pass

**Estimated Time**: 60-90 minutes

---

### Task 3.3: Add Type Guard for ArrayLiteralExpression

**File**: `packages/compiler/src/ast/type-guards.ts`

**Changes**:

```typescript
/**
 * Type guard for ArrayLiteralExpression
 */
export function isArrayLiteralExpression(node: ASTNode): node is ArrayLiteralExpression {
  return node.getType() === ASTNodeType.ARRAY_LITERAL_EXPR;
}
```

**Acceptance Criteria**:

- ✅ Type guard added
- ✅ Follows naming convention
- ✅ Export added to index

**Estimated Time**: 3 minutes

---

### Task 4.1: Update Language Specification

**File**: `docs/language-specification/06-expressions-statements.md`

**Changes**: Add new section after "Member Access":

````markdown
### Array Literal Expressions

Array literals provide a concise syntax for initializing arrays inline.

```ebnf
array_literal = "[" , [ expression_list ] , "]" ;
expression_list = expression , { "," , expression } , [ "," ] ;
```
````

**Basic Examples:**

```js
// Empty array
let empty: byte[0] = [];

// Single element
let single: byte[1] = [42];

// Multiple elements
let colors: byte[3] = [2, 5, 6];
let values: word[5] = [100, 200, 300, 400, 500];
```

**With Expressions:**

```js
// Variables and expressions
let positions: byte[3] = [x, y + 1, z * 2];

// Function calls
let results: byte[2] = [calculate(1), calculate(2)];

// Member access
let coords: byte[2] = [player.x, player.y];
```

**Nested Arrays:**

```js
// 2D arrays
let matrix: byte[2][2] = [[1, 2], [3, 4]];

// 3D arrays
let cube: byte[2][2][2] = [
  [[1, 2], [3, 4]],
  [[5, 6], [7, 8]]
];
```

**C64-Specific Examples:**

```js
// Sprite data
@data const spriteData: byte[63] = [
  0xFF, 0x3C, 0x18, 0x18, 0x18, 0x3C, 0xFF, 0x00,
  0x18, 0x24, 0x42, 0x81, 0x42, 0x24, 0x18, 0x00,
  // ... more sprite data ...
];

// Color palette
const palette: byte[16] = [
  0,  // Black
  1,  // White
  2,  // Red
  // ... more colors ...
];

// Sine wave lookup table
const sineTable: byte[256] = [/* precomputed values */];
```

**Trailing Commas:**
Trailing commas are allowed for easier multi-line editing:

```js
let values: byte[3] = [
  1,
  2,
  3,  // Trailing comma allowed
];
```

**Type Compatibility:**
Array elements must be compatible with the declared array type (validated in semantic analysis phase).

```

**Acceptance Criteria**:

- ✅ Section added with grammar
- ✅ Examples cover all use cases
- ✅ C64-specific examples included
- ✅ Cross-references updated

**Estimated Time**: 15 minutes

---

## Testing Strategy

### Unit Tests

- **Expression Parser Tests**: Verify parseArrayLiteral() works correctly
- **AST Structure Tests**: Verify correct node types and relationships
- **Error Recovery Tests**: Verify graceful error handling

### Integration Tests

- **Variable Declaration Tests**: Array literals in declarations
- **Nested Expression Tests**: Arrays containing complex expressions
- **End-to-End Tests**: Full program with array literals

### Test Coverage Goals

- **Line Coverage**: 100% of new code
- **Branch Coverage**: 100% of conditional paths
- **Error Cases**: All error paths tested

---

## Implementation Order

1. **Phase 1**: AST Node (Tasks 1.1-1.4) - 10 minutes
2. **Phase 2**: Parser (Tasks 2.1-2.2) - 25 minutes
3. **Phase 3**: Tests (Tasks 3.1-3.3) - 90-120 minutes
4. **Phase 4**: Documentation (Task 4.1) - 15 minutes

**Total Estimated Time**: 2.5-3 hours

---

## Success Criteria

### Must Have

- ✅ ArrayLiteralExpression AST node implemented
- ✅ Parser correctly handles all array literal forms
- ✅ All test cases pass (47+ tests)
- ✅ No regression in existing tests (606 tests still passing)
- ✅ Language specification updated

### Should Have

- ✅ Comprehensive error messages
- ✅ Good error recovery
- ✅ Examples in specification

### Nice to Have

- ✅ Performance optimization for large arrays
- ✅ Memory usage considerations documented

---

## Risk Assessment

### Low Risk

- **AST Node Creation**: Straightforward, follows existing patterns
- **Basic Parsing**: Well-understood problem
- **Testing**: Can leverage existing test infrastructure

### Medium Risk

- **Nested Arrays**: Requires recursive parsing (already used elsewhere)
- **Error Recovery**: Need to handle malformed arrays gracefully

### Mitigation Strategies

1. **Follow Existing Patterns**: Use CallExpression argument parsing as reference
2. **Incremental Development**: Implement and test each feature separately
3. **Comprehensive Tests**: Cover all edge cases before marking complete

---

## Dependencies

### Required Before Implementation

- ✅ Parser infrastructure (complete)
- ✅ Expression parsing (complete)
- ✅ AST base classes (complete)

### No Dependencies

- ❌ Semantic analysis (not needed for parsing)
- ❌ Type checking (not needed for parsing)
- ❌ Code generation (not needed for parsing)

---

## Future Enhancements

### Post-Implementation

1. **Semantic Analysis**: Validate array element types match declaration
2. **Constant Folding**: Optimize constant array literals at compile time
3. **Size Inference**: Infer array size from literal length
4. **Code Generation**: Emit efficient 6502 code for array initialization

### Phase 5+ Features

- Type checking for array elements
- Array size validation
- Memory layout optimization
- Dead code elimination for unused arrays

---

## Task Checklist

### Phase 1: AST Node Implementation

- [x] Task 1.1: Add ARRAY_LITERAL_EXPR to ASTNodeType enum ✅
- [x] Task 1.2: Create ArrayLiteralExpression class ✅
- [x] Task 1.3: Add visitor method to ASTVisitor interface ✅
- [x] Task 1.4: Export from ast/index.ts ✅

### Phase 2: Parser Implementation

- [x] Task 2.1: Implement parseArrayLiteral method ✅
- [x] Task 2.2: Integrate with primary expression parsing ✅

### Phase 3: Testing

- [x] Task 3.1: Create test file structure ✅
- [x] Task 3.2: Implement all test cases ✅
- [x] Task 3.3: Add type guard ✅
- [x] Verify all tests pass ✅
- [x] Verify no regression in existing tests ✅

### Phase 4: Documentation

- [x] Task 4.1: Update language specification ✅
- [x] Verify examples work correctly ✅

### Final Verification

- [x] Run full test suite: `clear && yarn clean && yarn build && yarn test` ✅
- [x] Verify 606+ tests passing ✅
- [x] Review implementation against specification ✅
- [x] Code review (self or peer) ✅

---

## Implementation Notes

### Key Implementation Details

1. **Recursive Parsing**: Array literals can contain other array literals (nested arrays)
2. **Expression Parsing**: Use `parseExpression()` for elements (allows any expression)
3. **Trailing Commas**: Optional trailing comma for multi-line editing convenience
4. **Error Recovery**: Synchronize to `]` on errors

### Code Quality Standards

- Follow existing parser patterns
- Use type guards (no `any` casts)
- Comprehensive JSDoc comments
- Error messages follow existing format
- Test coverage >95%

---

**Document Status**: Ready for Implementation
**Last Updated**: January 13, 2026
**Next Step**: Begin Phase 1 - AST Node Implementation
```