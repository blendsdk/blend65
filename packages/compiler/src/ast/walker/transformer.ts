/**
 * AST Transformer Infrastructure for Blend65 Compiler v2
 *
 * Provides reusable, type-safe AST transformation with immutable node replacement.
 *
 * NOTE: v2 does NOT include @map declarations (removed for Static Frame Allocation)
 */

import { ASTVisitor, ASTNode, Declaration, Expression, Statement } from '../base.js';
import {
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
 * Base AST transformer for immutable tree transformations
 */
export abstract class ASTTransformer implements ASTVisitor<ASTNode> {
  /**
   * Transform entire AST starting from root node
   */
  public transform(node: ASTNode): ASTNode {
    return node.accept(this);
  }

  visitProgram(node: Program): ASTNode {
    const module = node.getModule().accept(this);
    const declarations = node.getDeclarations().map(decl => decl.accept(this));

    const moduleChanged = module !== node.getModule();
    const declsChanged = declarations.some((decl, i) => decl !== node.getDeclarations()[i]);

    if (!moduleChanged && !declsChanged) {
      return node;
    }

    return new Program(module as ModuleDecl, declarations as Declaration[], node.getLocation());
  }

  visitModule(node: ModuleDecl): ASTNode {
    return node;
  }

  visitImportDecl(node: ImportDecl): ASTNode {
    return node;
  }

  visitExportDecl(node: ExportDecl): ASTNode {
    return node;
  }

  visitVariableDecl(node: VariableDecl): ASTNode {
    const initializer = node.getInitializer();
    if (!initializer) {
      return node;
    }

    const transformedInit = initializer.accept(this) as Expression;

    if (transformedInit === initializer) {
      return node;
    }

    return new VariableDecl(
      node.getName(),
      node.getTypeAnnotation(),
      transformedInit,
      node.getLocation(),
      node.getStorageClass(),
      node.isConst(),
      node.isExportedVariable()
    );
  }

  visitTypeDecl(node: TypeDecl): ASTNode {
    return node;
  }

  visitEnumDecl(node: EnumDecl): ASTNode {
    return node;
  }

  // NOTE: v2 does NOT have @map declarations - removed for Static Frame Allocation

  // ============================================
  // EXPRESSIONS
  // ============================================

  visitBinaryExpression(node: BinaryExpression): ASTNode {
    const left = node.getLeft().accept(this) as Expression;
    const right = node.getRight().accept(this) as Expression;

    if (left === node.getLeft() && right === node.getRight()) {
      return node;
    }

    return new BinaryExpression(left, node.getOperator(), right, node.getLocation());
  }

  visitUnaryExpression(node: UnaryExpression): ASTNode {
    return node;
  }

  visitTernaryExpression(node: TernaryExpression): ASTNode {
    const condition = node.getCondition().accept(this) as Expression;
    const thenBranch = node.getThenBranch().accept(this) as Expression;
    const elseBranch = node.getElseBranch().accept(this) as Expression;

    if (
      condition === node.getCondition() &&
      thenBranch === node.getThenBranch() &&
      elseBranch === node.getElseBranch()
    ) {
      return node;
    }

    return new TernaryExpression(condition, thenBranch, elseBranch, node.getLocation());
  }

  visitLiteralExpression(node: LiteralExpression): ASTNode {
    return node;
  }

  visitIdentifierExpression(node: IdentifierExpression): ASTNode {
    return node;
  }

  visitCallExpression(node: CallExpression): ASTNode {
    return node;
  }

  visitIndexExpression(node: IndexExpression): ASTNode {
    return node;
  }

  visitMemberExpression(node: MemberExpression): ASTNode {
    return node;
  }

  visitAssignmentExpression(node: AssignmentExpression): ASTNode {
    return node;
  }

  visitArrayLiteralExpression(node: ArrayLiteralExpression): ASTNode {
    return node;
  }

  visitFunctionDecl(node: FunctionDecl): ASTNode {
    const originalBody = node.getBody();
    if (!originalBody) {
      return node;
    }

    const body = originalBody.map(stmt => stmt.accept(this));

    const bodyChanged = body.some((stmt, i) => stmt !== originalBody[i]);

    if (!bodyChanged) {
      return node;
    }

    return new FunctionDecl(
      node.getName(),
      node.getParameters(),
      node.getReturnType(),
      body as Statement[],
      node.getLocation(),
      node.isExportedFunction(),
      node.isCallbackFunction(),
      node.isStubFunction()
    );
  }

  // ============================================
  // STATEMENTS
  // ============================================

  visitReturnStatement(node: ReturnStatement): ASTNode {
    const value = node.getValue();
    if (!value) {
      return node;
    }

    const transformedValue = value.accept(this) as Expression;

    if (transformedValue === value) {
      return node;
    }

    return new ReturnStatement(transformedValue, node.getLocation());
  }

  visitIfStatement(node: IfStatement): ASTNode {
    return node;
  }

  visitWhileStatement(node: WhileStatement): ASTNode {
    return node;
  }

  visitForStatement(node: ForStatement): ASTNode {
    return node;
  }

  visitDoWhileStatement(node: DoWhileStatement): ASTNode {
    return node;
  }

  visitSwitchStatement(node: SwitchStatement): ASTNode {
    return node;
  }

  visitMatchStatement(node: MatchStatement): ASTNode {
    return node;
  }

  visitBreakStatement(node: BreakStatement): ASTNode {
    return node;
  }

  visitContinueStatement(node: ContinueStatement): ASTNode {
    return node;
  }

  visitExpressionStatement(node: ExpressionStatement): ASTNode {
    return node;
  }

  visitBlockStatement(node: BlockStatement): ASTNode {
    return node;
  }
}