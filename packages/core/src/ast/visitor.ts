/**
 * The AST visitor contract for Blend65 (RD-03 §4.11, AR-5).
 *
 * {@link AstVisitor} declares exactly one `visit*` method per node kind (50 in
 * total — AR-1 removed `visitAsmBlock`). Implementations choose the return type
 * via the `R` type parameter (defaulting to `void`). The companion
 * {@link walkNode} helper dispatches a node to the matching method; its
 * exhaustive `switch` guarantees — at compile time — that every kind is handled.
 *
 * The visitor lives in `@blend65/core` alongside the node interfaces so both
 * `frontend` and `language-server` can traverse the AST without depending on
 * `codegen` (R15/AR-20).
 */

import type {
  ArrayTypeNode,
  AssignExprNode,
  BinaryExprNode,
  BlockNode,
  BoolLitExprNode,
  BreakStmtNode,
  CallExprNode,
  CaseClauseNode,
  CastExprNode,
  CharLitExprNode,
  ConditionalExprNode,
  ConstDeclNode,
  ContinueStmtNode,
  DefaultClauseNode,
  DoWhileStmtNode,
  EmbedExprNode,
  EnumDeclNode,
  EnumMemberNode,
  ErrorExprNode,
  ErrorStmtNode,
  ErrorTypeNode,
  ExpressionStmtNode,
  FallthroughStmtNode,
  FieldAccessExprNode,
  ForStmtNode,
  FunctionDeclNode,
  IdentExprNode,
  IfStmtNode,
  ImportStmtNode,
  IndexExprNode,
  InterruptDeclNode,
  IntrinsicCallExprNode,
  LetDeclNode,
  ModuleDeclNode,
  NamedTypeNode,
  NumericLitExprNode,
  ParameterNode,
  PrimitiveTypeNode,
  ProgramNode,
  ReturnStmtNode,
  StringLitExprNode,
  StructDeclNode,
  StructFieldNode,
  StructLitExprNode,
  StructLitFieldNode,
  SwitchStmtNode,
  UnaryExprNode,
  WhileStmtNode,
  ZeropageBlockNode,
  ZeropageFieldNode,
} from "./nodes.js";

/**
 * A visitor over the AST, with one method per node kind.
 *
 * @typeParam R The value each `visit*` method returns (defaults to `void`).
 */
export interface AstVisitor<R = void> {
  // Source structure (3)
  visitProgram(node: ProgramNode): R;
  visitModuleDecl(node: ModuleDeclNode): R;
  visitImportStmt(node: ImportStmtNode): R;

  // Declarations (11)
  visitFunctionDecl(node: FunctionDeclNode): R;
  visitInterruptDecl(node: InterruptDeclNode): R;
  visitStructDecl(node: StructDeclNode): R;
  visitStructField(node: StructFieldNode): R;
  visitEnumDecl(node: EnumDeclNode): R;
  visitEnumMember(node: EnumMemberNode): R;
  visitLetDecl(node: LetDeclNode): R;
  visitConstDecl(node: ConstDeclNode): R;
  visitZeropageBlock(node: ZeropageBlockNode): R;
  visitZeropageField(node: ZeropageFieldNode): R;
  visitParameter(node: ParameterNode): R;

  // Statements (13 — no visitAsmBlock, AR-1)
  visitBlock(node: BlockNode): R;
  visitIfStmt(node: IfStmtNode): R;
  visitWhileStmt(node: WhileStmtNode): R;
  visitDoWhileStmt(node: DoWhileStmtNode): R;
  visitForStmt(node: ForStmtNode): R;
  visitSwitchStmt(node: SwitchStmtNode): R;
  visitCaseClause(node: CaseClauseNode): R;
  visitDefaultClause(node: DefaultClauseNode): R;
  visitReturnStmt(node: ReturnStmtNode): R;
  visitBreakStmt(node: BreakStmtNode): R;
  visitContinueStmt(node: ContinueStmtNode): R;
  visitFallthroughStmt(node: FallthroughStmtNode): R;
  visitExpressionStmt(node: ExpressionStmtNode): R;

  // Expressions (17)
  visitAssignExpr(node: AssignExprNode): R;
  visitConditionalExpr(node: ConditionalExprNode): R;
  visitBinaryExpr(node: BinaryExprNode): R;
  visitUnaryExpr(node: UnaryExprNode): R;
  visitCastExpr(node: CastExprNode): R;
  visitFieldAccessExpr(node: FieldAccessExprNode): R;
  visitIndexExpr(node: IndexExprNode): R;
  visitCallExpr(node: CallExprNode): R;
  visitIntrinsicCallExpr(node: IntrinsicCallExprNode): R;
  visitIdentExpr(node: IdentExprNode): R;
  visitNumericLitExpr(node: NumericLitExprNode): R;
  visitBoolLitExpr(node: BoolLitExprNode): R;
  visitStringLitExpr(node: StringLitExprNode): R;
  visitCharLitExpr(node: CharLitExprNode): R;
  visitStructLitExpr(node: StructLitExprNode): R;
  visitStructLitField(node: StructLitFieldNode): R;
  visitEmbedExpr(node: EmbedExprNode): R;

  // Types (3)
  visitPrimitiveType(node: PrimitiveTypeNode): R;
  visitNamedType(node: NamedTypeNode): R;
  visitArrayType(node: ArrayTypeNode): R;

  // Error sentinels (3)
  visitErrorExpr(node: ErrorExprNode): R;
  visitErrorStmt(node: ErrorStmtNode): R;
  visitErrorType(node: ErrorTypeNode): R;
}
