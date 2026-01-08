# Guide 03: AST Visitor Pattern 🔄

**Estimated time:** 20 minutes  
**Difficulty:** Medium  
**File to edit:** `packages/compiler/src/ast/base.ts` (continue building)

---

## What You're Building

The `ASTVisitor<R>` interface - the contract that all AST visitors must implement. This enables operations like:
- Type checking
- Pretty printing
- Optimization
- Code generation
- Any tree traversal

**Why this matters:**
- Separates tree structure from operations on it
- Easy to add new operations (just create new visitor)
- Type-safe (TypeScript enforces all methods exist)
- Used by every major compiler (LLVM, GCC, TypeScript, Rust)

---

## Prerequisites

- [x] Guide 02 completed (base classes exist)
- [x] `ASTNode` has abstract `accept<R>()` method
- [x] Understanding of visitor pattern concept

---

## The Visitor Pattern Explained

### **Traditional Approach (Without Visitor):**
```typescript
// Every node has its own methods for operations
class BinaryExpression {
  prettyPrint(): string { return `(${this.op} ${this.left} ${this.right})`; }
  typeCheck(): TypeInfo { /* type checking logic */ }
  optimize(): Node { /* optimization logic */ }
  codegen(): Assembly { /* code generation */ }
  // 10+ more methods for different operations...
}
```

**Problems:**
- ❌ Node classes become huge (dozens of methods)
- ❌ Hard to add new operations (edit all node classes)
- ❌ Mixes concerns (structure + operations)

### **Visitor Pattern Approach:**
```typescript
// Node only knows how to accept visitors
class BinaryExpression {
  accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitBinaryExpression(this);
  }
}

// Operations are separate visitors
class PrettyPrinter implements ASTVisitor<string> {
  visitBinaryExpression(node: BinaryExpression): string {
    return `(${node.op} ${node.left} ${node.right})`;
  }
}

class TypeChecker implements ASTVisitor<TypeInfo> {
  visitBinaryExpression(node: BinaryExpression): TypeInfo {
    // type checking logic
  }
}
```

**Benefits:**
- ✅ Node classes stay small (just structure)
- ✅ Easy to add operations (create new visitor)
- ✅ Clear separation of concerns
- ✅ Operations can maintain state in visitor

---

## Task 3.1: Create ASTVisitor Interface

### Implementation

Add this to `base.ts` (at the end, after all classes):

```typescript
/**
 * Visitor interface for AST traversal and transformation
 * 
 * The Visitor pattern enables operations on AST without modifying node classes.
 * Each visitor method corresponds to a concrete node type and defines what
 * operation to perform on that type of node.
 * 
 * How to use:
 * 1. Create a class that implements ASTVisitor<R>
 * 2. Implement a visit method for each node type
 * 3. Call node.accept(yourVisitor) to perform the operation
 * 4. The node calls back to the appropriate visit method
 * 5. Your visitor method returns result of type R
 * 
 * Example visitors:
 * - ASTVisitor<string> for pretty printing
 * - ASTVisitor<TypeInfo> for type checking
 * - ASTVisitor<ASTNode> for transformations (optimization)
 * - ASTVisitor<Assembly> for code generation
 * - ASTVisitor<void> for analysis (no return value needed)
 * 
 * Generic type R:
 * - The return type of all visit methods
 * - Varies by operation (string, TypeInfo, Node, void, etc.)
 * - Enforced by TypeScript (type safety!)
 * 
 * @template R The return type of all visit methods
 * 
 * @example
 * ```typescript
 * class PrettyPrinter implements ASTVisitor<string> {
 *   visitBinaryExpression(node: BinaryExpression): string {
 *     const left = node.getLeft().accept(this);
 *     const right = node.getRight().accept(this);
 *     return `(${node.getOperator()} ${left} ${right})`;
 *   }
 *   // ... implement all other visit methods
 * }
 * 
 * const ast: Expression = parser.parse("2 + 3");
 * const printer = new PrettyPrinter();
 * const output = ast.accept(printer); // Returns "(+ 2 3)"
 * ```
 */
export interface ASTVisitor<R> {
  // ============================================
  // PROGRAM STRUCTURE
  // ============================================
  
  /**
   * Visit a Program node (root of AST)
   * @param node - The program node to visit
   * @returns Result of visiting this node
   */
  visitProgram(node: Program): R;
  
  /**
   * Visit a Module declaration
   * @param node - The module node to visit
   * @returns Result of visiting this node
   */
  visitModule(node: ModuleDecl): R;
  
  // ============================================
  // IMPORT/EXPORT
  // ============================================
  
  /**
   * Visit an Import declaration
   * @param node - The import node to visit
   * @returns Result of visiting this node
   */
  visitImportDecl(node: ImportDecl): R;
  
  /**
   * Visit an Export declaration
   * @param node - The export node to visit
   * @returns Result of visiting this node
   */
  visitExportDecl(node: ExportDecl): R;
  
  // ============================================
  // DECLARATIONS
  // ============================================
  
  /**
   * Visit a Function declaration
   * @param node - The function declaration to visit
   * @returns Result of visiting this node
   */
  visitFunctionDecl(node: FunctionDecl): R;
  
  /**
   * Visit a Variable declaration
   * @param node - The variable declaration to visit
   * @returns Result of visiting this node
   */
  visitVariableDecl(node: VariableDecl): R;
  
  /**
   * Visit a Type alias declaration
   * @param node - The type declaration to visit
   * @returns Result of visiting this node
   */
  visitTypeDecl(node: TypeDecl): R;
  
  /**
   * Visit an Enum declaration
   * @param node - The enum declaration to visit
   * @returns Result of visiting this node
   */
  visitEnumDecl(node: EnumDecl): R;
  
  // ============================================
  // EXPRESSIONS
  // ============================================
  
  /**
   * Visit a Binary expression (e.g., 2 + 3, x * y)
   * @param node - The binary expression to visit
   * @returns Result of visiting this node
   */
  visitBinaryExpression(node: BinaryExpression): R;
  
  /**
   * Visit a Unary expression (e.g., -x, !flag)
   * @param node - The unary expression to visit
   * @returns Result of visiting this node
   */
  visitUnaryExpression(node: UnaryExpression): R;
  
  /**
   * Visit a Literal expression (e.g., 42, "hello", true)
   * @param node - The literal expression to visit
   * @returns Result of visiting this node
   */
  visitLiteralExpression(node: LiteralExpression): R;
  
  /**
   * Visit an Identifier expression (e.g., counter, myFunc)
   * @param node - The identifier expression to visit
   * @returns Result of visiting this node
   */
  visitIdentifierExpression(node: IdentifierExpression): R;
  
  /**
   * Visit a Call expression (e.g., foo(), add(1, 2))
   * @param node - The call expression to visit
   * @returns Result of visiting this node
   */
  visitCallExpression(node: CallExpression): R;
  
  /**
   * Visit an Index expression (e.g., array[0], sprites[i])
   * @param node - The index expression to visit
   * @returns Result of visiting this node
   */
  visitIndexExpression(node: IndexExpression): R;
  
  /**
   * Visit a Member expression (e.g., obj.property)
   * @param node - The member expression to visit
   * @returns Result of visiting this node
   */
  visitMemberExpression(node: MemberExpression): R;
  
  /**
   * Visit an Assignment expression (e.g., x = 5, counter += 1)
   * @param node - The assignment expression to visit
   * @returns Result of visiting this node
   */
  visitAssignmentExpression(node: AssignmentExpression): R;
  
  // ============================================
  // STATEMENTS
  // ============================================
  
  /**
   * Visit a Return statement
   * @param node - The return statement to visit
   * @returns Result of visiting this node
   */
  visitReturnStatement(node: ReturnStatement): R;
  
  /**
   * Visit an If statement
   * @param node - The if statement to visit
   * @returns Result of visiting this node
   */
  visitIfStatement(node: IfStatement): R;
  
  /**
   * Visit a While statement
   * @param node - The while statement to visit
   * @returns Result of visiting this node
   */
  visitWhileStatement(node: WhileStatement): R;
  
  /**
   * Visit a For statement
   * @param node - The for statement to visit
   * @returns Result of visiting this node
   */
  visitForStatement(node: ForStatement): R;
  
  /**
   * Visit a Match statement
   * @param node - The match statement to visit
   * @returns Result of visiting this node
   */
  visitMatchStatement(node: MatchStatement): R;
  
  /**
   * Visit a Break statement
   * @param node - The break statement to visit
   * @returns Result of visiting this node
   */
  visitBreakStatement(node: BreakStatement): R;
  
  /**
   * Visit a Continue statement
   * @param node - The continue statement to visit
   * @returns Result of visiting this node
   */
  visitContinueStatement(node: ContinueStatement): R;
  
  /**
   * Visit an Expression statement
   * @param node - The expression statement to visit
   * @returns Result of visiting this node
   */
  visitExpressionStatement(node: ExpressionStatement): R;
  
  /**
   * Visit a Block statement
   * @param node - The block statement to visit
   * @returns Result of visiting this node
   */
  visitBlockStatement(node: BlockStatement): R;
}
```

---

## Forward Declarations

Since the visitor interface references concrete node types that don't exist yet, add these forward declarations at the top of the file (after imports, before SourceLocation):

```typescript
// ============================================
// FORWARD DECLARATIONS
// ============================================
// These classes will be defined in nodes.ts
// We declare them here so ASTVisitor can reference them

/** Program node (root of AST) */
export declare class Program extends ASTNode {}

/** Module declaration node */
export declare class ModuleDecl extends Declaration {}

/** Import declaration node */
export declare class ImportDecl extends Declaration {}

/** Export declaration node */
export declare class ExportDecl extends Declaration {}

/** Function declaration node */
export declare class FunctionDecl extends Declaration {}

/** Variable declaration node */
export declare class VariableDecl extends Declaration {}

/** Type alias declaration node */
export declare class TypeDecl extends Declaration {}

/** Enum declaration node */
export declare class EnumDecl extends Declaration {}

/** Binary expression node */
export declare class BinaryExpression extends Expression {}

/** Unary expression node */
export declare class UnaryExpression extends Expression {}

/** Literal expression node */
export declare class LiteralExpression extends Expression {}

/** Identifier expression node */
export declare class IdentifierExpression extends Expression {}

/** Call expression node */
export declare class CallExpression extends Expression {}

/** Index expression node */
export declare class IndexExpression extends Expression {}

/** Member expression node */
export declare class MemberExpression extends Expression {}

/** Assignment expression node */
export declare class AssignmentExpression extends Expression {}

/** Return statement node */
export declare class ReturnStatement extends Statement {}

/** If statement node */
export declare class IfStatement extends Statement {}

/** While statement node */
export declare class WhileStatement extends Statement {}

/** For statement node */
export declare class ForStatement extends Statement {}

/** Match statement node */
export declare class MatchStatement extends Statement {}

/** Break statement node */
export declare class BreakStatement extends Statement {}

/** Continue statement node */
export declare class ContinueStatement extends Statement {}

/** Expression statement node */
export declare class ExpressionStatement extends Statement {}

/** Block statement node */
export declare class BlockStatement extends Statement {}
```

---

## Validation Checklist

- [ ] `ASTVisitor<R>` interface exists
- [ ] Interface has visit method for each node type (26 methods)
- [ ] All methods return type `R` (generic)
- [ ] All methods take one parameter (the node)
- [ ] Comprehensive JSDoc on interface and each method
- [ ] Forward declarations exist for all concrete node types
- [ ] File compiles: `yarn build` passes

---

## Common Mistakes

❌ **Forgetting generic type `<R>`**
```typescript
export interface ASTVisitor { // Missing <R>!
  visitBinaryExpression(node: BinaryExpression): string; // Hardcoded return type
}
```
✅ Use generic so visitors can return different types

❌ **Inconsistent return types**
```typescript
visitBinaryExpression(node: BinaryExpression): string; // Returns string
visitLiteralExpression(node: LiteralExpression): void; // Returns void!
```
✅ All methods must return type `R`

❌ **Missing visit methods**
If you add a new node type, you MUST add its visit method to this interface. TypeScript will error if you don't implement it.

---

## Self-Review Questions

**Q: Why does every node type need a visit method?**  
A: So visitors can handle all possible nodes. If you forget one, TypeScript will error when implementing the visitor.

**Q: Why use generic `<R>` instead of concrete return types?**  
A: Different visitors need different return types:
- Pretty printer → string
- Type checker → TypeInfo  
- Optimizer → ASTNode
- Analyzer → void (no return needed)

**Q: What are forward declarations for?**  
A: They tell TypeScript "these classes exist, trust me" so we can reference them before they're defined. The actual classes will be in `nodes.ts`.

**Q: Do I have to implement ALL visit methods?**  
A: Yes! TypeScript enforces it. If your visitor doesn't need some nodes, return a default value or throw an error.

---

## What's Next?

✅ **Guide 03 complete?** Proceed to **Guide 04: Diagnostic System**

In the next guide, you'll create:
- Diagnostic severity levels
- Diagnostic codes
- Diagnostic collector class
- Professional error handling

**Estimated time:** 25 minutes

---

## Quick Reference

**File:** `packages/compiler/src/ast/base.ts`  
**New additions:** ~200 lines (interface + forward declarations)  
**Total file size:** ~550 lines  
**Methods in visitor:** 26 (one per concrete node type)

---

_Guide 03 complete! Your AST now supports the visitor pattern for all operations._
