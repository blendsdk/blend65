/**
 * AST Walker Infrastructure for Blend65 Compiler v2
 *
 * Provides reusable, type-safe AST traversal with rich context management,
 * multiple traversal strategies, and comprehensive debug utilities.
 *
 * This is the foundation for all semantic analysis passes, IL generation,
 * optimization, and code generation phases.
 *
 * NOTE: v2 does NOT include @map declarations (removed for Static Frame Allocation)
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
} from '../index.js';

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
 * @example
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
 */
export abstract class ASTWalker implements ASTVisitor<void> {
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
   * Main entry point for AST traversal
   *
   * @param node - The root node to start traversal from
   */
  public walk(node: ASTNode): void {
    this.shouldStop = false;
    this.shouldSkip = false;
    this.path = [];
    node.accept(this);
  }

  /**
   * Enter a node (called before visiting children)
   */
  protected enterNode(node: ASTNode): void {
    this.path.push(node);
  }

  /**
   * Exit a node (called after visiting children)
   */
  protected exitNode(_node: ASTNode): void {
    this.path.pop();
  }

  /**
   * Skip traversal of current node's children
   */
  protected skip(): void {
    this.shouldSkip = true;
  }

  /**
   * Stop entire traversal immediately
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

  /**
   * Visit Program node (root of AST)
   */
  visitProgram(node: Program): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    node.getModule().accept(this);

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
   */
  visitModule(node: ModuleDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  /**
   * Visit Import declaration
   */
  visitImportDecl(node: ImportDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  /**
   * Visit Export declaration
   */
  visitExportDecl(node: ExportDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getDeclaration().accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Function declaration
   */
  visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

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
   */
  visitVariableDecl(node: VariableDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);

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
   */
  visitTypeDecl(node: TypeDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  /**
   * Visit Enum declaration
   */
  visitEnumDecl(node: EnumDecl): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  // NOTE: v2 does NOT have @map declarations - removed for Static Frame Allocation

  // ============================================
  // EXPRESSIONS
  // ============================================

  /**
   * Visit Binary expression
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
   */
  visitTernaryExpression(node: TernaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getCondition().accept(this);
      if (!this.shouldStop) {
        node.getThenBranch().accept(this);
      }
      if (!this.shouldStop) {
        node.getElseBranch().accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Literal expression
   */
  visitLiteralExpression(node: LiteralExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  /**
   * Visit Identifier expression
   */
  visitIdentifierExpression(node: IdentifierExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  /**
   * Visit Call expression
   */
  visitCallExpression(node: CallExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getCallee().accept(this);
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
   */
  visitIfStatement(node: IfStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getCondition().accept(this);

      if (!this.shouldStop) {
        for (const stmt of node.getThenBranch()) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
      }

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
   */
  visitWhileStatement(node: WhileStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getCondition().accept(this);
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
   */
  visitForStatement(node: ForStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getStart().accept(this);
      if (!this.shouldStop) {
        node.getEnd().accept(this);
      }
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
   */
  visitDoWhileStatement(node: DoWhileStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getBody()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
      if (!this.shouldStop) {
        node.getCondition().accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Switch statement
   */
  visitSwitchStatement(node: SwitchStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getValue().accept(this);

      if (!this.shouldStop) {
        for (const caseClause of node.getCases()) {
          if (this.shouldStop) break;
          caseClause.value.accept(this);
          if (!this.shouldStop) {
            for (const stmt of caseClause.body) {
              if (this.shouldStop) break;
              stmt.accept(this);
            }
          }
        }
      }

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
   */
  visitMatchStatement(node: MatchStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      node.getValue().accept(this);

      if (!this.shouldStop) {
        for (const caseClause of node.getCases()) {
          if (this.shouldStop) break;
          caseClause.value.accept(this);
          if (!this.shouldStop) {
            for (const stmt of caseClause.body) {
              if (this.shouldStop) break;
              stmt.accept(this);
            }
          }
        }
      }

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
   */
  visitBreakStatement(node: BreakStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  /**
   * Visit Continue statement
   */
  visitContinueStatement(node: ContinueStatement): void {
    if (this.shouldStop) return;
    this.enterNode(node);
    this.exitNode(node);
  }

  /**
   * Visit Expression statement
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