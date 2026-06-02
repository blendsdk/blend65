/**
 * AST traversal helpers for Blend65 (RD-03 §4.11, FR-48).
 *
 * {@link walkNode} dispatches a single node to the matching `visit*` method on an
 * {@link AstVisitor}. Its `switch (node.kind)` is exhaustive: the `never`-typed
 * default arm makes the type-checker prove all 50 kinds are handled, so adding a
 * node kind without a visitor method is a compile error.
 *
 * {@link walkChildren} performs a shallow, left-to-right visit of every direct
 * child node of a given node (it does not recurse into grandchildren — callers
 * compose recursion by re-invoking `walkChildren` from their visitor methods).
 * Both helpers live in `@blend65/core` so every consumer traverses the AST the
 * same way without depending on `codegen` (R15/AR-20).
 */

import type { AstNode, ExprNode, StmtNode, TypeNode } from "./nodes.js";
import type { AstVisitor } from "./visitor.js";

/**
 * Dispatch `node` to the matching `visit*` method on `visitor`.
 *
 * @typeParam R The visitor's return type.
 * @param node The node to dispatch.
 * @param visitor The visitor whose method is invoked.
 * @returns Whatever the invoked `visit*` method returns.
 */
export function walkNode<R>(node: AstNode, visitor: AstVisitor<R>): R {
  // The casts below are safe: each `kind` uniquely determines the concrete node
  // type, but TypeScript cannot narrow a structural `AstNode` to its subtype by
  // the string discriminant alone without a per-kind interface map. The switch
  // is exhaustive (the `never` default proves it), so the casts never lie.
  switch (node.kind) {
    case "Program":
      return visitor.visitProgram(node as never);
    case "ModuleDecl":
      return visitor.visitModuleDecl(node as never);
    case "ImportStmt":
      return visitor.visitImportStmt(node as never);
    case "FunctionDecl":
      return visitor.visitFunctionDecl(node as never);
    case "InterruptDecl":
      return visitor.visitInterruptDecl(node as never);
    case "StructDecl":
      return visitor.visitStructDecl(node as never);
    case "StructField":
      return visitor.visitStructField(node as never);
    case "EnumDecl":
      return visitor.visitEnumDecl(node as never);
    case "EnumMember":
      return visitor.visitEnumMember(node as never);
    case "LetDecl":
      return visitor.visitLetDecl(node as never);
    case "ConstDecl":
      return visitor.visitConstDecl(node as never);
    case "ZeropageBlock":
      return visitor.visitZeropageBlock(node as never);
    case "ZeropageField":
      return visitor.visitZeropageField(node as never);
    case "Parameter":
      return visitor.visitParameter(node as never);
    case "Block":
      return visitor.visitBlock(node as never);
    case "IfStmt":
      return visitor.visitIfStmt(node as never);
    case "WhileStmt":
      return visitor.visitWhileStmt(node as never);
    case "DoWhileStmt":
      return visitor.visitDoWhileStmt(node as never);
    case "ForStmt":
      return visitor.visitForStmt(node as never);
    case "SwitchStmt":
      return visitor.visitSwitchStmt(node as never);
    case "CaseClause":
      return visitor.visitCaseClause(node as never);
    case "DefaultClause":
      return visitor.visitDefaultClause(node as never);
    case "ReturnStmt":
      return visitor.visitReturnStmt(node as never);
    case "BreakStmt":
      return visitor.visitBreakStmt(node as never);
    case "ContinueStmt":
      return visitor.visitContinueStmt(node as never);
    case "FallthroughStmt":
      return visitor.visitFallthroughStmt(node as never);
    case "ExpressionStmt":
      return visitor.visitExpressionStmt(node as never);
    case "AssignExpr":
      return visitor.visitAssignExpr(node as never);
    case "ConditionalExpr":
      return visitor.visitConditionalExpr(node as never);
    case "BinaryExpr":
      return visitor.visitBinaryExpr(node as never);
    case "UnaryExpr":
      return visitor.visitUnaryExpr(node as never);
    case "CastExpr":
      return visitor.visitCastExpr(node as never);
    case "FieldAccessExpr":
      return visitor.visitFieldAccessExpr(node as never);
    case "IndexExpr":
      return visitor.visitIndexExpr(node as never);
    case "CallExpr":
      return visitor.visitCallExpr(node as never);
    case "IntrinsicCallExpr":
      return visitor.visitIntrinsicCallExpr(node as never);
    case "IdentExpr":
      return visitor.visitIdentExpr(node as never);
    case "NumericLitExpr":
      return visitor.visitNumericLitExpr(node as never);
    case "BoolLitExpr":
      return visitor.visitBoolLitExpr(node as never);
    case "StringLitExpr":
      return visitor.visitStringLitExpr(node as never);
    case "CharLitExpr":
      return visitor.visitCharLitExpr(node as never);
    case "StructLitExpr":
      return visitor.visitStructLitExpr(node as never);
    case "StructLitField":
      return visitor.visitStructLitField(node as never);
    case "EmbedExpr":
      return visitor.visitEmbedExpr(node as never);
    case "PrimitiveType":
      return visitor.visitPrimitiveType(node as never);
    case "NamedType":
      return visitor.visitNamedType(node as never);
    case "ArrayType":
      return visitor.visitArrayType(node as never);
    case "ErrorExpr":
      return visitor.visitErrorExpr(node as never);
    case "ErrorStmt":
      return visitor.visitErrorStmt(node as never);
    case "ErrorType":
      return visitor.visitErrorType(node as never);
    default: {
      // Exhaustiveness guard: if a NodeKind is added without a case above, this
      // assignment fails to type-check.
      const unreachable: never = node.kind;
      throw new Error(`walkNode: unhandled node kind ${String(unreachable)}`);
    }
  }
}

/** Visit `child` if present (a no-op for `null`/`undefined`). */
function visitOptional(child: AstNode | null | undefined, visitor: AstVisitor<void>): void {
  if (child) {
    walkNode(child, visitor);
  }
}

/** Visit each node in `children` left-to-right. */
function visitEach(children: readonly AstNode[], visitor: AstVisitor<void>): void {
  for (const child of children) {
    walkNode(child, visitor);
  }
}

/**
 * Visit every direct child node of `node`, left-to-right, depth-first.
 *
 * Only structural child *nodes* are visited — scalar fields (names, operators,
 * spans) are ignored. Leaf nodes (identifiers, literals, jump statements, error
 * sentinels) have no children and produce no visits.
 *
 * @param node The parent whose children are visited.
 * @param visitor The visitor invoked on each child.
 */
export function walkChildren(node: AstNode, visitor: AstVisitor<void>): void {
  switch (node.kind) {
    // Source structure
    case "Program": {
      const n = node as import("./nodes.js").ProgramNode;
      walkNode(n.moduleDecl, visitor);
      visitEach(n.items, visitor);
      return;
    }
    case "ImportStmt":
    case "ModuleDecl":
      return; // scalar-only

    // Declarations
    case "FunctionDecl": {
      const n = node as import("./nodes.js").FunctionDeclNode;
      visitEach(n.params, visitor);
      walkNode(n.returnType, visitor);
      walkNode(n.body, visitor);
      return;
    }
    case "InterruptDecl": {
      const n = node as import("./nodes.js").InterruptDeclNode;
      walkNode(n.body, visitor);
      return;
    }
    case "StructDecl": {
      const n = node as import("./nodes.js").StructDeclNode;
      visitEach(n.fields, visitor);
      return;
    }
    case "StructField": {
      const n = node as import("./nodes.js").StructFieldNode;
      walkNode(n.fieldType, visitor);
      return;
    }
    case "EnumDecl": {
      const n = node as import("./nodes.js").EnumDeclNode;
      visitEach(n.members, visitor);
      return;
    }
    case "EnumMember": {
      const n = node as import("./nodes.js").EnumMemberNode;
      visitOptional(n.value, visitor);
      return;
    }
    case "LetDecl": {
      const n = node as import("./nodes.js").LetDeclNode;
      visitOptional(n.declaredType, visitor);
      visitOptional(n.initialiser, visitor);
      return;
    }
    case "ConstDecl": {
      const n = node as import("./nodes.js").ConstDeclNode;
      visitOptional(n.declaredType, visitor);
      walkNode(n.initialiser, visitor);
      return;
    }
    case "ZeropageBlock": {
      const n = node as import("./nodes.js").ZeropageBlockNode;
      visitEach(n.fields, visitor);
      return;
    }
    case "ZeropageField": {
      const n = node as import("./nodes.js").ZeropageFieldNode;
      walkNode(n.fieldType, visitor);
      visitOptional(n.initialiser, visitor);
      return;
    }

    case "Parameter": {
      const n = node as import("./nodes.js").ParameterNode;
      walkNode(n.paramType, visitor);
      return;
    }

    // Statements
    case "Block": {
      const n = node as import("./nodes.js").BlockNode;
      visitEach(n.statements, visitor);
      return;
    }
    case "IfStmt": {
      const n = node as import("./nodes.js").IfStmtNode;
      walkNode(n.condition, visitor);
      walkNode(n.thenBlock, visitor);
      visitOptional(n.elseClause, visitor);
      return;
    }
    case "WhileStmt": {
      const n = node as import("./nodes.js").WhileStmtNode;
      walkNode(n.condition, visitor);
      walkNode(n.body, visitor);
      return;
    }
    case "DoWhileStmt": {
      const n = node as import("./nodes.js").DoWhileStmtNode;
      walkNode(n.body, visitor);
      walkNode(n.condition, visitor);
      return;
    }
    case "ForStmt": {
      const n = node as import("./nodes.js").ForStmtNode;
      visitOptional(n.varType, visitor);
      walkNode(n.init, visitor);
      walkNode(n.bound, visitor);
      visitOptional(n.step, visitor);
      walkNode(n.body, visitor);
      return;
    }
    case "SwitchStmt": {
      const n = node as import("./nodes.js").SwitchStmtNode;
      walkNode(n.discriminant, visitor);
      visitEach(n.cases, visitor);
      walkNode(n.defaultClause, visitor);
      return;
    }
    case "CaseClause": {
      const n = node as import("./nodes.js").CaseClauseNode;
      visitEach(n.values, visitor);
      visitEach(n.body, visitor);
      return;
    }
    case "DefaultClause": {
      const n = node as import("./nodes.js").DefaultClauseNode;
      visitEach(n.body, visitor);
      return;
    }
    case "ReturnStmt": {
      const n = node as import("./nodes.js").ReturnStmtNode;
      visitOptional(n.value, visitor);
      return;
    }
    case "ExpressionStmt": {
      const n = node as import("./nodes.js").ExpressionStmtNode;
      walkNode(n.expression, visitor);
      return;
    }
    case "BreakStmt":
    case "ContinueStmt":
    case "FallthroughStmt":
      return; // leaf jump statements

    // Expressions
    case "AssignExpr": {
      const n = node as import("./nodes.js").AssignExprNode;
      walkNode(n.target, visitor);
      walkNode(n.value, visitor);
      return;
    }
    case "ConditionalExpr": {
      const n = node as import("./nodes.js").ConditionalExprNode;
      walkNode(n.condition, visitor);
      walkNode(n.whenTrue, visitor);
      walkNode(n.whenFalse, visitor);
      return;
    }
    case "BinaryExpr": {
      const n = node as import("./nodes.js").BinaryExprNode;
      walkNode(n.left, visitor);
      walkNode(n.right, visitor);
      return;
    }
    case "UnaryExpr": {
      const n = node as import("./nodes.js").UnaryExprNode;
      walkNode(n.operand, visitor);
      return;
    }
    case "CastExpr": {
      const n = node as import("./nodes.js").CastExprNode;
      walkNode(n.targetType, visitor);
      walkNode(n.operand, visitor);
      return;
    }
    case "FieldAccessExpr": {
      const n = node as import("./nodes.js").FieldAccessExprNode;
      walkNode(n.object, visitor);
      return;
    }
    case "IndexExpr": {
      const n = node as import("./nodes.js").IndexExprNode;
      walkNode(n.object, visitor);
      walkNode(n.index, visitor);
      return;
    }
    case "CallExpr": {
      const n = node as import("./nodes.js").CallExprNode;
      walkNode(n.callee, visitor);
      visitEach(n.args, visitor);
      return;
    }
    case "IntrinsicCallExpr": {
      const n = node as import("./nodes.js").IntrinsicCallExprNode;
      visitOptional(n.typeArg, visitor);
      visitEach(n.args, visitor);
      return;
    }
    case "StructLitExpr": {
      const n = node as import("./nodes.js").StructLitExprNode;
      visitEach(n.fields, visitor);
      return;
    }
    case "StructLitField": {
      const n = node as import("./nodes.js").StructLitFieldNode;
      walkNode(n.value, visitor);
      return;
    }
    case "IdentExpr":
    case "NumericLitExpr":
    case "BoolLitExpr":
    case "StringLitExpr":
    case "CharLitExpr":
    case "EmbedExpr":
      return; // leaf expressions

    // Types
    case "ArrayType": {
      const n = node as import("./nodes.js").ArrayTypeNode;
      walkNode(n.elementType, visitor);
      visitOptional(n.size, visitor);
      return;
    }
    case "PrimitiveType":
    case "NamedType":
      return; // leaf types

    // Error sentinels (leaves)
    case "ErrorExpr":
    case "ErrorStmt":
    case "ErrorType":
      return;

    default: {
      const unreachable: never = node.kind;
      throw new Error(`walkChildren: unhandled node kind ${String(unreachable)}`);
    }
  }
}

// Re-export the group unions purely so this module's public contract documents
// the node families it traverses. (Type-only; erased at runtime.)
export type { ExprNode, StmtNode, TypeNode };
