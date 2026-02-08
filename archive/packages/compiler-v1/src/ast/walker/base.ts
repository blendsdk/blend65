/**
 * AST Walker Infrastructure for Blend65 Compiler
 *
 * Provides reusable, type-safe AST traversal with rich context management,
 * multiple traversal strategies, and comprehensive debug utilities.
 *
 * This is the foundation for all semantic analysis passes, IL generation,
 * optimization, and code generation phases.
 */

import { ASTVisitor, ASTNode } from '../base.js';
import type {
  Program,
  ModuleDecl,
  ImportDecl,
  ExportDecl,
  FunctionDecl,
  VariableDecl,
  TypeDecl,
  EnumDecl,
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
  BinaryExpression,
  UnaryExpression,
  TernaryExpression,
  LiteralExpression,
  IdentifierExpression,
  CallExpression,
  IndexExpression,
  MemberExpression,
  AssignmentExpression,
  ArrayLiteralExpression,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  DoWhileStatement,
  SwitchStatement,
  MatchStatement,
  BreakStatement,
  ContinueStatement,
  ExpressionStatement,
  BlockStatement,
} from '../nodes.js';

/**
 * Base AST walker providing default recursive traversal
 *
 * Implements the Visitor pattern with automatic recursion through the tree.
 * Subclasses override visit methods to customize behavior while benefiting
 * from automatic child node traversal.
 *
 * **Design Philosophy:**
 * - **Default recursion**: Automatically visits all children
 * - **Override as needed**: Only implement methods you care about
 * - **Context tracking**: Parent and path information always available
 * - **Control flow**: Skip subtrees or stop traversal early
 * - **Performance**: Optimized for large ASTs (1000+ nodes)
 *
 * **Features:**
 * - Parent node tracking via `getParent()`
 * - Path from root tracking via `getPath()`
 * - Subtree skipping via `skip()`
 * - Early termination via `stop()`
 * - Ancestor access via `getAncestor(n)`
 *
 * **Usage Pattern:**
 * ```typescript
 * class MyAnalyzer extends ASTWalker {
 *   visitVariableDecl(node: VariableDecl): void {
 *     console.log(`Found variable: ${node.getName()}`);
 *     super.visitVariableDecl(node); // Continue traversal
 *   }
 * }
 *
 * const analyzer = new MyAnalyzer();
 * analyzer.walk(program);
 * ```
 *
 * **When to Skip vs Stop:**
 * - Use `skip()` to avoid traversing a node's children
 * - Use `stop()` to terminate entire traversal immediately
 *
 * @example
 * ```typescript
 * // Find all function declarations but don't analyze their bodies
 * class FunctionFinder extends ASTWalker {
 *   functions: string[] = [];
 *
 *   visitFunctionDecl(node: FunctionDecl): void {
 *     this.functions.push(node.getName());
 *     this.skip(); // Don't traverse function body
 *   }
 * }
 * ```
 */
export abstract class ASTWalker implements ASTVisitor<void> {
  /**
   * Path from root to current node (breadcrumbs)
   *
   * Used for:
   * - Parent tracking (last element is current node)
   * - Ancestor access (walk backwards through path)
   * - Context awareness (where are we in the tree?)
   * - Debugging (show full path to node)
   *
   * Example: [Program, FunctionDecl, IfStatement, BinaryExpression]
   */
  protected path: ASTNode[] = [];

  /**
   * Flag to stop entire traversal
   *
   * Set by `stop()` method. When true, walker immediately
   * returns from all visit methods without processing
   * any more nodes.
   *
   * Use case: Found what you're looking for, no need to continue
   */
  protected shouldStop: boolean = false;

  /**
   * Flag to skip current subtree
   *
   * Set by `skip()` method. When true, walker doesn't
   * visit children of current node. Reset after node completes.
   *
   * Use case: Don't need to analyze inside this node
   */
  protected shouldSkip: boolean = false;

  /**
   * Main entry point for AST traversal
   *
   * Initializes walker state and begins recursive traversal
   * from the given root node. Typically called with a Program
   * node to walk the entire AST.
   *
   * **State management:**
   * - Resets path to empty
   * - Clears stop/skip flags
   * - Enables multiple walk() calls on same walker instance
   *
   * @param node - The root node to start traversal from
   *
   * @example
   * ```typescript
   * const walker = new MyWalker();
   * walker.walk(program); // Walk entire program
   * walker.walk(expr);    // Walk just an expression subtree
   * ```
   */
  public walk(node: ASTNode): void {
    this.shouldStop = false;
    this.shouldSkip = false;
    this.path = [];

    node.accept(this);
  }

  /**
   * Enter a node (called before visiting children)
   *
   * Updates traversal context by pushing current node onto path.
   * This maintains parent/ancestor information during traversal.
   *
   * **Called automatically** by every visit method.
   * Subclasses can override to add custom enter behavior.
   *
   * @param node - The node being entered
   */
  protected enterNode(node: ASTNode): void {
    this.path.push(node);
  }

  /**
   * Exit a node (called after visiting children)
   *
   * Updates traversal context by popping current node from path.
   * Restores parent context for continuing traversal.
   *
   * **Called automatically** by every visit method.
   * Subclasses can override to add custom exit behavior.
   *
   * @param _node - The node being exited (unused but kept for consistency)
   */
  protected exitNode(_node: ASTNode): void {
    this.path.pop();
  }

  /**
   * Skip traversal of current node's children
   *
   * Sets a flag that prevents visiting child nodes of the
   * current node. The flag is automatically cleared after
   * the current node completes.
   *
   * **Use cases:**
   * - Don't analyze inside function bodies
   * - Skip certain expression subtrees
   * - Avoid processing nested structures
   *
   * @example
   * ```typescript
   * visitFunctionDecl(node: FunctionDecl): void {
   *   // Record function name but don't analyze body
   *   this.functions.push(node.getName());
   *   this.skip();
   * }
   * ```
   */
  protected skip(): void {
    this.shouldSkip = true;
  }

  /**
   * Stop entire traversal immediately
   *
   * Sets a flag that causes walker to return from all
   * visit methods without processing any more nodes.
   * Provides early exit mechanism.
   *
   * **Use cases:**
   * - Found what you're looking for
   * - Encountered error condition
   * - Optimization (found enough information)
   *
   * @example
   * ```typescript
   * visitIdentifierExpression(node: IdentifierExpression): void {
   *   if (node.getName() === this.targetName) {
   *     this.found = node;
   *     this.stop(); // Done, no need to continue
   *   }
   * }
   * ```
   */
  protected stop(): void {
    this.shouldStop = true;
  }

  /**
   * Get immediate parent of current node
   *
   * Returns the node that contains the current node.
   * Returns null if current node is the root.
   *
   * **How it works:**
   * Path is like: [root, ..., parent, current]
   * Parent is second-to-last element in path.
   *
   * @returns Parent node or null if at root
   *
   * @example
   * ```typescript
   * visitIdentifierExpression(node: IdentifierExpression): void {
   *   const parent = this.getParent();
   *   if (parent?.getNodeType() === ASTNodeType.CALL_EXPR) {
   *     console.log('Identifier is being called as function');
   *   }
   * }
   * ```
   */
  protected getParent(): ASTNode | null {
    return this.path.length >= 2 ? this.path[this.path.length - 2] : null;
  }

  /**
   * Get nth ancestor (1 = parent, 2 = grandparent, etc.)
   *
   * Walks backwards through path to find ancestors.
   * Useful for checking broader context.
   *
   * @param levels - How many levels up (1=parent, 2=grandparent, etc.)
   * @returns Ancestor node or null if doesn't exist
   *
   * @example
   * ```typescript
   * visitBreakStatement(node: BreakStatement): void {
   *   // Check if inside a loop (walk up looking for loop)
   *   for (let i = 1; i < this.path.length; i++) {
   *     const ancestor = this.getAncestor(i);
   *     if (ancestor?.getNodeType() === ASTNodeType.WHILE_STMT) {
   *       return; // Valid: break inside while loop
   *     }
   *   }
   *   // Error: break not inside loop
   * }
   * ```
   */
  protected getAncestor(levels: number): ASTNode | null {
    const index = this.path.length - 1 - levels;
    return index >= 0 ? this.path[index] : null;
  }

  /**
   * Get path from root to current node
   *
   * Returns array of nodes from root to current position.
   * Useful for understanding full context.
   *
   * **Returns a copy** to prevent external modification.
   *
   * @returns Copy of path array
   *
   * @example
   * ```typescript
   * visitBinaryExpression(node: BinaryExpression): void {
   *   const path = this.getPath();
   *   console.log('Path:', path.map(n => n.getNodeType()).join(' → '));
   *   // Output: "Program → FunctionDecl → IfStatement → BinaryExpression"
   * }
   * ```
   */
  protected getPath(): ASTNode[] {
    return [...this.path];
  }

  // ============================================
  // VISITOR METHODS WITH DEFAULT RECURSION
  // ============================================
  //
  // Each visit method follows this pattern:
  // 1. Check if should stop (early termination)
  // 2. Enter node (push onto path)
  // 3. Visit children (unless skipped)
  // 4. Clear skip flag
  // 5. Exit node (pop from path)
  //
  // Subclasses can override any method to customize behavior.
  // Call super.visitXXX(node) to get default recursion.

  /**
   * Visit Program node (root of AST)
   *
   * Traverses:
   * - Module declaration
   * - All top-level declarations
   */
  visitProgram(node: Program): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Visit module declaration
    node.getModule().accept(this);

    // Visit all declarations
    if (!this.shouldSkip && !this.shouldStop) {
      for (const decl of node.getDeclarations()) {
        if (this.shouldStop) break;
        decl.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Module declaration
   *
   * Module has no children (just metadata)
   */
  visitModule(node: ModuleDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Module has no children to visit
    this.exitNode(node);
  }

  /**
   * Visit Import declaration
   *
   * Import has no children (just metadata)
   */
  visitImportDecl(node: ImportDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Import has no children to visit
    this.exitNode(node);
  }

  /**
   * Visit Export declaration
   *
   * Traverses:
   * - Wrapped declaration being exported
   */
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

  /**
   * Visit Function declaration
   *
   * Traverses:
   * - Function body statements (if present - stub functions have no body)
   */
  visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Visit function body (if present - stub functions have null body)
    if (!this.shouldSkip && !this.shouldStop) {
      const body = node.getBody();
      if (body) {
        for (const stmt of body) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Variable declaration
   *
   * Traverses:
   * - Initializer expression (if present)
   */
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

  /**
   * Visit Type declaration
   *
   * Type declaration has no children (just metadata)
   */
  visitTypeDecl(node: TypeDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Type declaration has no children to visit
    this.exitNode(node);
  }

  /**
   * Visit Enum declaration
   *
   * Enum has no children (members are data, not AST nodes)
   */
  visitEnumDecl(node: EnumDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Enum has no children to visit (members are data, not nodes)
    this.exitNode(node);
  }

  // ============================================
  // MEMORY-MAPPED DECLARATIONS (@map)
  // ============================================

  /**
   * Visit Simple @map declaration
   *
   * Example: @map borderColor at $D020: byte;
   * No children to visit (just metadata)
   */
  visitSimpleMapDecl(node: SimpleMapDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  /**
   * Visit Range @map declaration
   *
   * Example: @map spriteRegisters from $D000 to $D02E: byte;
   * No children to visit (just metadata)
   */
  visitRangeMapDecl(node: RangeMapDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  /**
   * Visit Sequential struct @map declaration
   *
   * Example: @map sid at $D400 type ... end @map
   * No children to visit (struct definition is metadata)
   */
  visitSequentialStructMapDecl(node: SequentialStructMapDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  /**
   * Visit Explicit struct @map declaration
   *
   * Example: @map vic at $D000 layout ... end @map
   * No children to visit (struct definition is metadata)
   */
  visitExplicitStructMapDecl(node: ExplicitStructMapDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  // ============================================
  // EXPRESSIONS
  // ============================================

  /**
   * Visit Binary expression
   *
   * Example: 2 + 3, x * y, a && b
   *
   * Traverses:
   * - Left operand
   * - Right operand
   */
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

  /**
   * Visit Unary expression
   *
   * Example: -x, !flag, ~mask
   *
   * Traverses:
   * - Operand expression
   */
  visitUnaryExpression(node: UnaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getOperand().accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Ternary conditional expression
   *
   * Example: condition ? thenExpr : elseExpr
   *
   * Traverses:
   * - Condition expression
   * - Then branch expression
   * - Else branch expression
   */
  visitTernaryExpression(node: TernaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit condition
      node.getCondition().accept(this);

      // Visit then branch
      if (!this.shouldStop) {
        node.getThenBranch().accept(this);
      }

      // Visit else branch
      if (!this.shouldStop) {
        node.getElseBranch().accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Literal expression
   *
   * Example: 42, "hello", true, $D000
   * No children to visit (leaf node)
   */
  visitLiteralExpression(node: LiteralExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Literals have no children
    this.exitNode(node);
  }

  /**
   * Visit Identifier expression
   *
   * Example: counter, myFunction
   * No children to visit (leaf node)
   */
  visitIdentifierExpression(node: IdentifierExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Identifiers have no children
    this.exitNode(node);
  }

  /**
   * Visit Call expression
   *
   * Example: foo(), add(1, 2)
   *
   * Traverses:
   * - Callee expression
   * - All argument expressions
   */
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

  /**
   * Visit Index expression
   *
   * Example: array[0], sprites[i]
   *
   * Traverses:
   * - Object being indexed
   * - Index expression
   */
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

  /**
   * Visit Member expression
   *
   * Example: obj.property, Game.score
   *
   * Traverses:
   * - Object expression
   */
  visitMemberExpression(node: MemberExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getObject().accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Assignment expression
   *
   * Example: x = 5, counter += 1
   *
   * Traverses:
   * - Target (left side)
   * - Value (right side)
   */
  visitAssignmentExpression(node: AssignmentExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getTarget().accept(this);
      if (!this.shouldStop) {
        node.getValue().accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Array literal expression
   *
   * Example: [1, 2, 3], [[1, 2], [3, 4]]
   *
   * Traverses:
   * - All element expressions
   */
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

  // ============================================
  // STATEMENTS
  // ============================================

  /**
   * Visit Return statement
   *
   * Example: return 42, return
   *
   * Traverses:
   * - Return value expression (if present)
   */
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

  /**
   * Visit If statement
   *
   * Example: if x > 0 then ... end if
   *
   * Traverses:
   * - Condition expression
   * - Then branch statements
   * - Else branch statements (if present)
   */
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

  /**
   * Visit While statement
   *
   * Example: while running ... end while
   *
   * Traverses:
   * - Condition expression
   * - Body statements
   */
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

  /**
   * Visit For statement
   *
   * Example: for i = 0 to 10 ... next i
   *
   * Traverses:
   * - Start expression
   * - End expression
   * - Body statements
   *
   * Note: For loops in Blend65 don't have step expressions
   */
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

  /**
   * Visit Do-While statement
   *
   * Example: do { ... } while (condition);
   *
   * Traverses:
   * - Body statements (executed at least once)
   * - Condition expression
   */
  visitDoWhileStatement(node: DoWhileStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit body
      for (const stmt of node.getBody()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }

      // Visit condition
      if (!this.shouldStop) {
        node.getCondition().accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Switch statement
   *
   * Example: switch (value) { case 1: ... break; default: ... }
   *
   * Traverses:
   * - Value expression
   * - All case clauses (value + body)
   * - Default case (if present)
   */
  visitSwitchStatement(node: SwitchStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit switch value
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

  /**
   * Visit Match statement
   *
   * Example: match value case 1: ... end match
   *
   * Traverses:
   * - Value expression
   * - All case clauses (value + body)
   * - Default case (if present)
   */
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

  /**
   * Visit Break statement
   *
   * Example: break
   * No children to visit
   */
  visitBreakStatement(node: BreakStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Break has no children
    this.exitNode(node);
  }

  /**
   * Visit Continue statement
   *
   * Example: continue
   * No children to visit
   */
  visitContinueStatement(node: ContinueStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    // Continue has no children
    this.exitNode(node);
  }

  /**
   * Visit Expression statement
   *
   * Example: doSomething(), x = 5
   *
   * Traverses:
   * - Wrapped expression
   */
  visitExpressionStatement(node: ExpressionStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getExpression().accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Block statement
   *
   * Example: Implicit blocks inside functions, if/while/for statements
   *
   * Traverses:
   * - All statements in block
   */
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