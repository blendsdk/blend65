# Guide 01: AST Node Type Enum 🎯

**Estimated time:** 15 minutes  
**Difficulty:** Easy  
**File to create:** `packages/compiler/src/ast/base.ts`

---

## What You're Building

The `ASTNodeType` enum is the foundation of type discrimination in your AST. Every node will have a `nodeType` field that identifies what kind of node it is.

**Why this matters:**
- Enables type-safe pattern matching
- Used by visitor pattern to route to correct handler
- Makes debugging easier (you can see node types in logs)
- Foundation for all AST node classes

**Real-world usage:**
- LLVM uses `NodeKind` enum
- TypeScript uses `SyntaxKind` enum (300+ values!)
- Rust uses `NodeId` discriminators
- GCC uses C-style enums for node types

---

## Prerequisites

- [x] Guide 00 completed (setup done)
- [x] Directory `packages/compiler/src/ast/` exists
- [x] Understanding of TypeScript enums

---

## Task 1.1: Create ASTNodeType Enum

### Step 1: Create the file

```bash
touch packages/compiler/src/ast/base.ts
```

### Step 2: Add imports

```typescript
/**
 * AST Base Types for Blend65 Compiler
 * 
 * This module contains the foundational types and classes for the
 * Abstract Syntax Tree (AST) used throughout the compiler.
 */

import { SourcePosition } from '../lexer/types.js';
```

**Why the `.js` extension?**  
TypeScript ESM modules require `.js` extensions in imports (even though the files are `.ts`). This is per your `tsconfig.json` settings.

### Step 3: Add JSDoc and enum

```typescript
/**
 * Node type discriminator for type-safe AST traversal
 * 
 * Every concrete AST node must have a unique type from this enum.
 * This enables:
 * - Type discrimination (knowing what kind of node you have)
 * - Visitor pattern routing (calling the correct visitor method)
 * - Pattern matching in switch statements
 * - Debugging (readable node type names)
 * 
 * Design note: We use string literals instead of numeric values
 * for better debugging and serialization.
 */
export enum ASTNodeType {
  // ============================================
  // PROGRAM STRUCTURE
  // ============================================
  
  /**
   * Root node of the entire program
   * Contains module declaration and all top-level declarations
   */
  PROGRAM = 'Program',
  
  /**
   * Module declaration (e.g., "module Game.Main")
   * Can be explicit or implicitly "module global"
   */
  MODULE = 'Module',
  
  // ============================================
  // DECLARATIONS
  // ============================================
  
  /**
   * Import declaration
   * e.g., "import foo, bar from some.lib"
   */
  IMPORT_DECL = 'ImportDecl',
  
  /**
   * Export wrapper for declarations
   * e.g., "export function main(): void"
   */
  EXPORT_DECL = 'ExportDecl',
  
  /**
   * Function declaration
   * e.g., "function doSomething(): void"
   */
  FUNCTION_DECL = 'FunctionDecl',
  
  /**
   * Variable declaration
   * e.g., "@zp let counter: byte = 0"
   */
  VARIABLE_DECL = 'VariableDecl',
  
  /**
   * Type alias declaration
   * e.g., "type SpriteId = byte"
   */
  TYPE_DECL = 'TypeDecl',
  
  /**
   * Enum declaration
   * e.g., "enum Direction { UP, DOWN, LEFT, RIGHT }"
   */
  ENUM_DECL = 'EnumDecl',
  
  // ============================================
  // EXPRESSIONS
  // ============================================
  
  /**
   * Binary expression (two operands with operator)
   * e.g., "2 + 3", "x * y", "a && b"
   */
  BINARY_EXPR = 'BinaryExpression',
  
  /**
   * Unary expression (one operand with operator)
   * e.g., "-x", "!flag", "~mask"
   */
  UNARY_EXPR = 'UnaryExpression',
  
  /**
   * Literal expression (constant value)
   * e.g., 42, "hello", true, $D000
   */
  LITERAL_EXPR = 'LiteralExpression',
  
  /**
   * Identifier expression (variable/function reference)
   * e.g., "counter", "myFunction"
   */
  IDENTIFIER_EXPR = 'IdentifierExpression',
  
  /**
   * Call expression (function invocation)
   * e.g., "doSomething()", "add(1, 2)"
   */
  CALL_EXPR = 'CallExpression',
  
  /**
   * Index expression (array access)
   * e.g., "array[0]", "sprites[i]"
   */
  INDEX_EXPR = 'IndexExpression',
  
  /**
   * Member expression (property access)
   * e.g., "player.health", "Game.score"
   */
  MEMBER_EXPR = 'MemberExpression',
  
  /**
   * Assignment expression
   * e.g., "x = 5", "counter += 1"
   */
  ASSIGNMENT_EXPR = 'AssignmentExpression',
  
  // ============================================
  // STATEMENTS
  // ============================================
  
  /**
   * Return statement
   * e.g., "return 42", "return"
   */
  RETURN_STMT = 'ReturnStatement',
  
  /**
   * If statement (conditional)
   * e.g., "if x > 0 then ... end if"
   */
  IF_STMT = 'IfStatement',
  
  /**
   * While loop statement
   * e.g., "while running ... end while"
   */
  WHILE_STMT = 'WhileStatement',
  
  /**
   * For loop statement
   * e.g., "for i = 0 to 10 ... next i"
   */
  FOR_STMT = 'ForStatement',
  
  /**
   * Match statement (pattern matching)
   * e.g., "match value case 1: ... end match"
   */
  MATCH_STMT = 'MatchStatement',
  
  /**
   * Break statement (exit loop)
   * e.g., "break"
   */
  BREAK_STMT = 'BreakStatement',
  
  /**
   * Continue statement (next iteration)
   * e.g., "continue"
   */
  CONTINUE_STMT = 'ContinueStatement',
  
  /**
   * Expression statement (expression used as statement)
   * e.g., "doSomething()", "x = 5"
   */
  EXPR_STMT = 'ExpressionStatement',
  
  /**
   * Block statement (sequence of statements)
   * Used inside functions, if statements, loops, etc.
   */
  BLOCK_STMT = 'BlockStatement',
}
```

### Step 4: Verify compilation

```bash
cd /home/gevik/workdir/blend65/native
clear && yarn build
```

**Expected output:**
```
✓ Build successful
```

---

## Validation Checklist

- [ ] File `packages/compiler/src/ast/base.ts` exists
- [ ] All enum values use string literals (not numbers)
- [ ] Comprehensive JSDoc on the enum itself
- [ ] JSDoc comments on each enum member
- [ ] Import uses `.js` extension
- [ ] No TypeScript errors: `yarn build` passes
- [ ] Enum exported (has `export` keyword)

---

## Common Mistakes

❌ **Using numeric enum values**
```typescript
// DON'T DO THIS:
export enum ASTNodeType {
  PROGRAM = 0,
  MODULE = 1,
  // ...
}
```
✅ **Use string literals instead** (better for debugging and serialization)

❌ **Missing JSDoc on enum members**
```typescript
// Not enough documentation:
FUNCTION_DECL = 'FunctionDecl',
```
✅ **Add comments explaining what each represents**

❌ **Forgetting to export**
```typescript
// Won't be accessible outside this file:
enum ASTNodeType { ... }
```
✅ **Always use `export enum`**

---

## Self-Review Questions

**Q: Why use string literals instead of numbers?**  
A: String enums are self-documenting in logs/debugger. When you see `"BinaryExpression"` in a stack trace, you know exactly what it is. Number `15` means nothing without looking up the enum.

**Q: Why document every single enum member?**  
A: Per `.clinerules`, code should be understandable by junior developers. Each enum value represents a language construct that may not be obvious.

**Q: How will this enum be used?**  
A: Every AST node class will have a `nodeType` field set to one of these values. Visitor pattern uses it to route to the correct handler method.

**Q: Can we add more node types later?**  
A: Absolutely! This enum will grow as you add language features. Always add new types here first before creating the node class.

---

## What's Next?

✅ **Task 1.1 complete?** Proceed to **Guide 02: AST Base Classes**

In the next guide, you'll create:
- `SourceLocation` interface
- `ASTNode` abstract base class
- `Expression`, `Statement`, `Declaration` abstract classes

**Estimated time for Guide 02:** 30 minutes

---

## Quick Reference

**File location:** `packages/compiler/src/ast/base.ts`  
**Lines of code:** ~150 (with comments)  
**Dependencies:** `../lexer/types.js` (SourcePosition)  
**Used by:** All AST node classes (coming next)

---

_Guide 01 complete! You've laid the foundation for type-safe AST traversal._
