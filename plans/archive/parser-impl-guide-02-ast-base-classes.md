# Guide 02: AST Base Classes 🏗️

**Estimated time:** 30 minutes  
**Difficulty:** Medium  
**File to edit:** `packages/compiler/src/ast/base.ts` (continue from Guide 01)

---

## What You're Building

The abstract base classes that all AST nodes inherit from:
- `SourceLocation` interface - tracks where code came from
- `ASTNode` - the ultimate base class for all nodes
- `Expression` - base for all expressions (things that produce values)
- `Statement` - base for all statements (things that do actions)
- `Declaration` - base for all declarations (things that introduce names)

**Why this matters:**
- Creates a clear type hierarchy (polymorphism)
- Enables visitor pattern (traversal/transformation)
- Enforces consistent structure (all nodes have location, type, etc.)
- Foundation used by LLVM, GCC, TypeScript, Rust compilers

---

## Prerequisites

- [x] Guide 01 completed (`ASTNodeType` enum exists)
- [x] File `packages/compiler/src/ast/base.ts` exists with enum
- [x] Understanding of abstract classes and inheritance

---

## Task 2.1: Add SourceLocation Interface

### What It Does
Tracks the exact location of code in the source file. Critical for error messages:
```
Error at line 42, column 15: Undefined variable 'foo'
                            ^^^^
```

### Implementation

Add this to `base.ts` (after the import, before the enum):

```typescript
/**
 * Source location information for god-level error reporting
 * 
 * Tracks exact position in source for:
 * - Error messages ("Error at line 5, column 12")
 * - Debug info generation (source maps for debugger)
 * - IDE features (go-to-definition, hover tooltips)
 * - Source code transformations (preserving location)
 * 
 * Design: We reuse SourcePosition from the lexer since tokens
 * already have this information. AST nodes span from one position
 * to another (start to end).
 */
export interface SourceLocation {
  /** Starting position of this AST node in source */
  start: SourcePosition;
  
  /** Ending position of this AST node in source */
  end: SourcePosition;
  
  /**
   * Optional: actual source text for this node
   * Useful for error messages showing exact code
   * Example: "You wrote 'functino' - did you mean 'function'?"
   */
  source?: string;
}
```

**Why optional source text?**  
It's expensive to store the full source for every node (memory overhead). We can always extract it later using start/end positions. But for error reporting, having it immediately available is convenient.

---

## Task 2.2: Add ASTNode Base Class

### What It Does
The ultimate base class for ALL AST nodes. Provides:
- Node type discrimination
- Source location tracking
- Visitor pattern support

### Implementation

Add after the `ASTNodeType` enum:

```typescript
/**
 * Abstract base class for all AST nodes in Blend65 compiler
 * 
 * Design philosophy:
 * - **Immutable structure**: readonly fields for tree shape (never changes)
 * - **Mutable metadata**: type info, optimization data added later
 * - **Rich source tracking**: for god-level error messages and debugging
 * - **Visitor pattern**: for traversal and transformation
 * 
 * Every concrete node class must:
 * 1. Call super() with appropriate node type
 * 2. Store its specific data (operands, names, etc.)
 * 3. Implement accept() to call the right visitor method
 * 
 * Example inheritance chain:
 * ASTNode → Expression → BinaryExpression
 * ASTNode → Statement → IfStatement  
 * ASTNode → Declaration → FunctionDecl
 * 
 * @example
 * ```typescript
 * class BinaryExpression extends Expression {
 *   constructor(
 *     left: Expression,
 *     operator: TokenType,
 *     right: Expression,
 *     location: SourceLocation
 *   ) {
 *     super(ASTNodeType.BINARY_EXPR, location);
 *     this.left = left;
 *     this.operator = operator;
 *     this.right = right;
 *   }
 *   
 *   public accept<R>(visitor: ASTVisitor<R>): R {
 *     return visitor.visitBinaryExpression(this);
 *   }
 * }
 * ```
 */
export abstract class ASTNode {
  /**
   * Discriminator for type-safe pattern matching
   * 
   * Each concrete node class sets this to its specific type.
   * Used by:
   * - Visitor pattern (routing to correct method)
   * - Switch statements (pattern matching)
   * - Type guards (is this a BinaryExpression?)
   * - Debugging (console.log shows readable type name)
   */
  protected readonly nodeType: ASTNodeType;
  
  /**
   * Source location for error reporting and debugging
   * 
   * Tracks where in the source code this node came from.
   * Used by:
   * - Error messages (showing exact line/column)
   * - IDE features (go-to-definition, hover)
   * - Source maps (debugging compiled code)
   * - Transformations (preserving location metadata)
   */
  protected readonly location: SourceLocation;
  
  /**
   * Constructs a new AST node
   * 
   * This constructor is called by all subclasses via super().
   * It initializes the two fundamental properties every node has.
   * 
   * @param nodeType - The specific type of this node (from ASTNodeType enum)
   * @param location - Source location information
   */
  constructor(nodeType: ASTNodeType, location: SourceLocation) {
    this.nodeType = nodeType;
    this.location = location;
  }
  
  /**
   * Gets the node type discriminator
   * 
   * Public accessor for the node type. Used for:
   * - Type checking (if (node.getNodeType() === ASTNodeType.BINARY_EXPR))
   * - Pattern matching in switch statements
   * - Visitor pattern routing
   * 
   * @returns The node type from ASTNodeType enum
   */
  public getNodeType(): ASTNodeType {
    return this.nodeType;
  }
  
  /**
   * Gets the source location of this node
   * 
   * Public accessor for location information. Used for:
   * - Error reporting (showing where error occurred)
   * - IDE features (highlighting, tooltips)
   * - Debugging (tracing back to source)
   * 
   * @returns The source location with start/end positions
   */
  public getLocation(): SourceLocation {
    return this.location;
  }
  
  /**
   * Accept a visitor for traversal/transformation
   * 
   * This is the core of the Visitor pattern. Each concrete node
   * implements this to call the appropriate visitor method.
   * 
   * Why visitor pattern?
   * - Separate tree structure from operations on it
   * - Easy to add new operations (just create new visitor)
   * - Type-safe dispatch (TypeScript knows which method to call)
   * - Used by all major compilers (LLVM, GCC, TypeScript, Rust)
   * 
   * How it works:
   * 1. Caller passes a visitor to accept()
   * 2. Node calls the visitor method for its type
   * 3. Visitor performs operation and returns result
   * 
   * Example operations via visitors:
   * - Type checking (returns TypeInfo)
   * - Pretty printing (returns string)
   * - Optimization (returns optimized Node)
   * - Code generation (returns Assembly)
   * 
   * @param visitor - The visitor to accept
   * @returns Result of the visit operation (type R is generic)
   */
  public abstract accept<R>(visitor: ASTVisitor<R>): R;
}
```

**Key design decisions:**
- `readonly` on structure fields → tree shape never changes after construction
- `protected` not `private` → subclasses can access (per .clinerules)
- `abstract accept()` → forces each subclass to implement it
- Generic `<R>` → visitors can return different types

---

## Task 2.3: Add Expression Base Class

### What It Does
Base class for all expressions (things that produce values).

Examples: `2 + 3`, `foo()`, `x`, `array[i]`

### Implementation

```typescript
/**
 * Abstract base class for all expression nodes
 * 
 * Expressions are AST nodes that:
 * - Produce a value (have a type: byte, word, string, etc.)
 * - Can be used in larger expressions
 * - Can appear on right side of assignment
 * - Can be passed as function arguments
 * 
 * Examples:
 * - Literals: 42, "hello", true, $D000
 * - Identifiers: counter, myFunction
 * - Binary ops: 2 + 3, x * y, a && b
 * - Function calls: doSomething(), add(1, 2)
 * - Array access: sprites[0], buffer[i]
 * 
 * Design: Expressions extend ASTNode but don't add new fields.
 * This intermediate class exists for:
 * - Type hierarchy (is this an Expression?)
 * - Future: Type information (getType() method)
 * - Semantic analysis (type checking pass)
 */
export abstract class Expression extends ASTNode {
  /**
   * Constructs an expression node
   * 
   * Simply forwards to ASTNode constructor.
   * Concrete expression classes call this via super().
   * 
   * @param nodeType - The specific expression type
   * @param location - Source location
   */
  constructor(nodeType: ASTNodeType, location: SourceLocation) {
    super(nodeType, location);
  }
  
  /**
   * Optional: Type information for this expression
   * 
   * Set during semantic analysis phase.
   * Examples: TypeInfo { kind: 'byte' }, TypeInfo { kind: 'word' }
   * 
   * Design note: Mutable metadata (not part of tree structure).
   * The parser doesn't set this - the semantic analyzer does.
   */
  protected typeInfo?: unknown; // Will be replaced with proper TypeInfo later
  
  /**
   * Gets the type of this expression (if analyzed)
   * 
   * Returns undefined until semantic analysis runs.
   * After analysis, contains the expression's type.
   * 
   * @returns Type information or undefined
   */
  public getTypeInfo(): unknown | undefined {
    return this.typeInfo;
  }
}
```

---

## Task 2.4: Add Statement Base Class

### What It Does
Base class for all statements (things that do actions).

Examples: `return 42`, `if x > 0 then...`, `while running...`

### Implementation

```typescript
/**
 * Abstract base class for all statement nodes
 * 
 * Statements are AST nodes that:
 * - Perform actions (don't produce values)
 * - Control program flow (if, while, for, return, etc.)
 * - Can appear in function bodies and blocks
 * - Execute sequentially (one after another)
 * 
 * Examples:
 * - Return: return 42, return
 * - Control flow: if..., while..., for...
 * - Jumps: break, continue
 * - Expression statements: foo(), x = 5
 * 
 * Design: Statements extend ASTNode but don't add new fields.
 * This intermediate class exists for:
 * - Type hierarchy (is this a Statement?)
 * - Future: Control flow analysis
 * - Code generation (statements → assembly blocks)
 */
export abstract class Statement extends ASTNode {
  /**
   * Constructs a statement node
   * 
   * Simply forwards to ASTNode constructor.
   * Concrete statement classes call this via super().
   * 
   * @param nodeType - The specific statement type
   * @param location - Source location
   */
  constructor(nodeType: ASTNodeType, location: SourceLocation) {
    super(nodeType, location);
  }
}
```

---

## Task 2.5: Add Declaration Base Class

### What It Does
Base class for all declarations (things that introduce names).

Examples: `let x: byte`, `function foo()`, `module Game`

### Implementation

```typescript
/**
 * Abstract base class for all declaration nodes
 * 
 * Declarations are special statements that:
 * - Introduce new names into scope (variables, functions, types, etc.)
 * - Can be exported (visible to other modules)
 * - Appear at module scope or inside functions
 * - Create symbol table entries
 * 
 * Examples:
 * - Variables: @zp let counter: byte = 0
 * - Functions: function main(): void
 * - Types: type SpriteId = byte
 * - Enums: enum Direction { UP, DOWN }
 * - Modules: module Game.Main
 * - Imports: import foo from bar
 * 
 * Design: Declarations extend Statement (they can execute).
 * Examples of executable declarations:
 * - Variable with initializer: let x = computeValue()
 * - Function declaration (defines code to execute later)
 */
export abstract class Declaration extends Statement {
  /**
   * Constructs a declaration node
   * 
   * Simply forwards to Statement constructor (which forwards to ASTNode).
   * Concrete declaration classes call this via super().
   * 
   * @param nodeType - The specific declaration type
   * @param location - Source location
   */
  constructor(nodeType: ASTNodeType, location: SourceLocation) {
    super(nodeType, location);
  }
}
```

---

## Validation Checklist

- [ ] `SourceLocation` interface exists with start, end, optional source
- [ ] `ASTNode` abstract class exists with nodeType, location fields
- [ ] `ASTNode` has getNodeType(), getLocation(), abstract accept() methods
- [ ] `Expression` abstract class extends ASTNode
- [ ] `Statement` abstract class extends ASTNode
- [ ] `Declaration` abstract class extends Statement
- [ ] All classes/interfaces have comprehensive JSDoc
- [ ] All fields are `protected readonly` (not `private`)
- [ ] File compiles: `yarn build` passes
- [ ] No TypeScript errors in IDE

---

## Common Mistakes

❌ **Using `private` instead of `protected`**
```typescript
private readonly nodeType: ASTNodeType; // Wrong!
```
✅ Per .clinerules, use `protected`

❌ **Forgetting `abstract` on accept()**
```typescript
public accept<R>(visitor: ASTVisitor<R>): R {
  return null; // This makes no sense in base class
}
```
✅ Must be abstract - subclasses implement it

❌ **Making structure fields mutable**
```typescript
protected nodeType: ASTNodeType; // Can be changed!
```
✅ Use `readonly` - tree structure is immutable

---

## Self-Review Questions

**Q: Why does Declaration extend Statement, not ASTNode?**  
A: Declarations are executable statements. `let x = foo()` executes `foo()` when initializing `x`.

**Q: Why is accept() abstract?**  
A: Each node type needs to call its specific visitor method. BinaryExpression calls `visitBinaryExpression()`, IfStatement calls `visitIfStatement()`, etc. The base class can't know which to call.

**Q: Why separate Expression, Statement, Declaration?**  
A: Type hierarchy enables type-safe operations:
- Expressions can be used where values are needed
- Statements can execute but don't produce values
- Declarations introduce names into scope

**Q: What goes in Expression vs Statement?**  
A: If it produces a value → Expression. If it does an action → Statement.
- `2 + 3` → Expression (produces value 5)
- `return 2 + 3` → Statement (returns from function)

---

## What's Next?

✅ **Guide 02 complete?** Proceed to **Guide 03: AST Visitor Pattern**

In the next guide, you'll create:
- `ASTVisitor<R>` interface with methods for all node types
- Understanding how visitor pattern enables operations on AST

**Estimated time:** 20 minutes

---

## Quick Reference

**File:** `packages/compiler/src/ast/base.ts`  
**New additions:** ~200 lines (5 types + extensive docs)  
**Total file size:** ~350 lines  
**Inheritance hierarchy:**
```
ASTNode (base for everything)
  ├─ Expression (produces values)
  ├─ Statement (does actions)
  │    └─ Declaration (introduces names)
  └─ [All concrete nodes inherit from one of these]
```

---

_Guide 02 complete! You now have a solid type hierarchy for your AST._
