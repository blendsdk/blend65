# Semantic Analyzer - Phase 0: God-Level AST Walker

> **Phase**: 0 of 9
> **Focus**: AST Walker Infrastructure (Foundation)
> **Duration**: 1 week
> **Tasks**: 20
> **Tests**: 100+
> **Dependencies**: None (builds on existing AST)

---

## **Phase Overview**

This phase implements the foundational AST walker infrastructure that all semantic analysis passes will build upon. The walker provides reusable, type-safe traversal mechanisms with rich context management, multiple traversal strategies, and comprehensive debug utilities.

### **Why Build the Walker First?**

**1. Reusability**

- Every semantic analysis phase uses the walker
- IL generator will use it
- Optimizer will use it
- Code generator will use it
- Write once, benefit everywhere

**2. Consistency**

- Uniform traversal patterns across compiler
- Predictable behavior
- Easy to debug and maintain

**3. Testability**

- Walker tested independently from semantic logic
- Each analysis phase tests its logic, not traversal mechanics

**4. Performance**

- Optimized traversal in one place
- Can add memoization and caching
- Profile once, benefit everywhere

---

## **Architecture**

### **Walker Class Hierarchy**

```typescript
ASTVisitor<R>                    // Interface (existing in ast/base.ts)
  ↓
ASTWalker                        // Base recursive walker
  ├── ASTTransformer             // Returns modified AST nodes
  ├── ASTCollector<T>            // Collects information into arrays
  ├── ASTValidator               // Validation-specific functionality
  └── ContextAwareWalker         // Adds scope/context tracking

// Utility Implementations
ASTCollector<T>
  ├── NodeFinder<T>              // Find nodes matching predicate
  └── NodeCounter                // Count nodes by type

// Debug Implementations
  ├── ASTPrinter                 // Pretty-print AST
  ├── ASTGraphGenerator          // Generate DOT graphs
  └── WalkerProfiler             // Performance profiling
```

### **Key Features**

**1. Default Recursive Traversal**

- Automatically visits all child nodes
- Subclasses override only methods they care about
- Handles all 32 node types

**2. Context Management**

- Parent node tracking
- Path from root tracking (breadcrumbs)
- Scope stack management
- Custom metadata storage

**3. Control Flow**

- Skip subtrees conditionally
- Early termination
- Continue/stop semantics

**4. Multiple Traversal Orders**

- Pre-order (default)
- Post-order
- Breadth-first
- Custom order

**5. Debug & Visualization**

- Pretty printing
- DOT graph generation
- Performance profiling
- AST structure inspection

---

## **Implementation Tasks**

### **Task 0.1: Base Walker Infrastructure** (6 hours)

**Objective**: Create `ASTWalker` base class with default recursive traversal

**Files to Create**:

- `packages/compiler/src/ast/walker/base.ts`
- `packages/compiler/src/ast/walker/index.ts`

**Implementation**:

````typescript
// packages/compiler/src/ast/walker/base.ts

import { ASTVisitor, ASTNode, Expression, Statement, Declaration } from '../base.js';
import type {
  Program,
  ModuleDecl,
  ImportDecl,
  ExportDecl,
  FunctionDecl,
  VariableDecl,
  // ... all node types
} from '../nodes.js';

/**
 * Base AST walker providing default recursive traversal
 *
 * Implements the Visitor pattern with automatic recursion.
 * Subclasses override visit methods to customize behavior.
 *
 * Features:
 * - Automatic child node traversal
 * - Parent tracking
 * - Path tracking (breadcrumbs)
 * - Early termination support
 * - Subtree skipping
 *
 * @example
 * ```typescript
 * class MyAnalyzer extends ASTWalker {
 *   visitVariableDecl(node: VariableDecl): void {
 *     console.log(`Found variable: ${node.getName()}`);
 *     super.visitVariableDecl(node); // Continue traversal
 *   }
 * }
 * ```
 */
export abstract class ASTWalker implements ASTVisitor<void> {
  /**
   * Stack of parent nodes (for getParent())
   */
  protected parentStack: ASTNode[] = [];

  /**
   * Path from root to current node (breadcrumbs)
   */
  protected path: ASTNode[] = [];

  /**
   * Flag to stop entire traversal
   */
  protected shouldStop: boolean = false;

  /**
   * Flag to skip current subtree
   */
  protected shouldSkip: boolean = false;

  /**
   * Main entry point for traversal
   */
  public walk(node: ASTNode): void {
    this.shouldStop = false;
    this.shouldSkip = false;
    this.parentStack = [];
    this.path = [];

    node.accept(this);
  }

  /**
   * Enter a node (called before visiting children)
   */
  protected enterNode(node: ASTNode): void {
    this.path.push(node);
    if (this.parentStack.length > 0) {
      // Parent is the previous node in path
    }
  }

  /**
   * Exit a node (called after visiting children)
   */
  protected exitNode(node: ASTNode): void {
    this.path.pop();
  }

  /**
   * Skip traversal of current node's children
   */
  protected skip(): void {
    this.shouldSkip = true;
  }

  /**
   * Stop entire traversal
   */
  protected stop(): void {
    this.shouldStop = true;
  }

  /**
   * Get immediate parent of current node
   */
  protected getParent(): ASTNode | null {
    return this.path.length >= 2 ? this.path[this.path.length - 2] : null;
  }

  /**
   * Get nth ancestor (1 = parent, 2 = grandparent, etc.)
   */
  protected getAncestor(levels: number): ASTNode | null {
    const index = this.path.length - 1 - levels;
    return index >= 0 ? this.path[index] : null;
  }

  /**
   * Get path from root to current node
   */
  protected getPath(): ASTNode[] {
    return [...this.path];
  }

  // ============================================
  // VISITOR METHODS WITH DEFAULT RECURSION
  // ============================================

  visitProgram(node: Program): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Visit module
    node.getModule().accept(this);

    // Visit declarations
    if (!this.shouldSkip && !this.shouldStop) {
      for (const decl of node.getDeclarations()) {
        if (this.shouldStop) break;
        decl.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitModule(node: ModuleDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Module has no children to visit
    this.exitNode(node);
  }

  visitImportDecl(node: ImportDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Import has no children to visit
    this.exitNode(node);
  }

  visitExportDecl(node: ExportDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Visit exported declaration
    if (!this.shouldSkip && !this.shouldStop) {
      node.getDeclaration().accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Visit function body
    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getBody()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitVariableDecl(node: VariableDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Visit initializer if present
    if (!this.shouldSkip && !this.shouldStop) {
      const init = node.getInitializer();
      if (init) {
        init.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitTypeDecl(node: TypeDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Type declaration has no children to visit
    this.exitNode(node);
  }

  visitEnumDecl(node: EnumDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Enum has no children to visit (members are data, not nodes)
    this.exitNode(node);
  }

  // @map declarations
  visitSimpleMapDecl(node: SimpleMapDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  visitRangeMapDecl(node: RangeMapDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  visitSequentialStructMapDecl(node: SequentialStructMapDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  visitExplicitStructMapDecl(node: ExplicitStructMapDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  // Expressions
  visitBinaryExpression(node: BinaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getLeft().accept(this);
      if (!this.shouldStop) {
        node.getRight().accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitUnaryExpression(node: UnaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getOperand().accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitLiteralExpression(node: LiteralExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Literals have no children
    this.exitNode(node);
  }

  visitIdentifierExpression(node: IdentifierExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Identifiers have no children
    this.exitNode(node);
  }

  visitCallExpression(node: CallExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit callee
      node.getCallee().accept(this);

      // Visit arguments
      if (!this.shouldStop) {
        for (const arg of node.getArguments()) {
          if (this.shouldStop) break;
          arg.accept(this);
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitIndexExpression(node: IndexExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getObject().accept(this);
      if (!this.shouldStop) {
        node.getIndex().accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitMemberExpression(node: MemberExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getObject().accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitAssignmentExpression(node: AssignmentExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getLeft().accept(this);
      if (!this.shouldStop) {
        node.getRight().accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitArrayLiteralExpression(node: ArrayLiteralExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const element of node.getElements()) {
        if (this.shouldStop) break;
        element.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  // Statements
  visitReturnStatement(node: ReturnStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      const value = node.getValue();
      if (value) {
        value.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitIfStatement(node: IfStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit condition
      node.getCondition().accept(this);

      // Visit then branch
      if (!this.shouldStop) {
        for (const stmt of node.getThenBranch()) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
      }

      // Visit else branch if present
      if (!this.shouldStop) {
        const elseBranch = node.getElseBranch();
        if (elseBranch) {
          for (const stmt of elseBranch) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitWhileStatement(node: WhileStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit condition
      node.getCondition().accept(this);

      // Visit body
      if (!this.shouldStop) {
        for (const stmt of node.getBody()) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitForStatement(node: ForStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit start expression
      node.getStart().accept(this);

      // Visit end expression
      if (!this.shouldStop) {
        node.getEnd().accept(this);
      }

      // Visit step if present
      if (!this.shouldStop) {
        const step = node.getStep();
        if (step) {
          step.accept(this);
        }
      }

      // Visit body
      if (!this.shouldStop) {
        for (const stmt of node.getBody()) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitMatchStatement(node: MatchStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit value
      node.getValue().accept(this);

      // Visit cases
      if (!this.shouldStop) {
        for (const caseClause of node.getCases()) {
          if (this.shouldStop) break;

          // Visit case value
          caseClause.value.accept(this);

          // Visit case body
          if (!this.shouldStop) {
            for (const stmt of caseClause.body) {
              if (this.shouldStop) break;
              stmt.accept(this);
            }
          }
        }
      }

      // Visit default case if present
      if (!this.shouldStop) {
        const defaultCase = node.getDefaultCase();
        if (defaultCase) {
          for (const stmt of defaultCase) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitBreakStatement(node: BreakStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Break has no children
    this.exitNode(node);
  }

  visitContinueStatement(node: ContinueStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Continue has no children
    this.exitNode(node);
  }

  visitExpressionStatement(node: ExpressionStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getExpression().accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitBlockStatement(node: BlockStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getStatements()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }
}
````

**Tests to Create**:

- Test default recursive traversal
- Test parent tracking
- Test path tracking
- Test skip() functionality
- Test stop() functionality
- Test all visit methods

**Test File**: `packages/compiler/src/ast/walker/__tests__/base.test.ts`

---

### **Task 0.2: Transformer Base Class** (4 hours)

Create `ASTTransformer` for AST modifications.

**Implementation**: 50+ visitor methods returning modified nodes

**Tests**: Transformation scenarios, immutability tests

---

### **Task 0.3: Collector Base Class** (3 hours)

Create `ASTCollector<T>` for gathering information.

**Tests**: Collecting variables, functions, expressions

---

### **Task 0.4: Context Management** (6 hours)

Create context-aware walker with scope tracking.

**Tests**: Scope management, metadata storage

---

### **Task 0.5: Debug Utilities** (5 hours)

Create AST printer, graph generator, profiler.

**Tests**: Output validation, performance tests

---

## **Success Criteria**

✅ All 20 tasks complete
✅ 100+ tests passing
✅ Walker handles all 32 node types
✅ Performance acceptable (<1ms for 1000-node AST)
✅ Ready for semantic analyzer to use

---

**Next Phase**: Symbol Tables & Types (`semantic-analyzer-phase1-2-symbols-types.md`)
