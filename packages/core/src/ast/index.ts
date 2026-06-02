/**
 * Public barrel for the Blend65 AST vocabulary (RD-03).
 *
 * Re-exports the node-kind discriminant, every node interface and group union,
 * the visitor contract, the traversal helpers, and the reserved-intrinsic set.
 * Downstream packages import the AST from `@blend65/core` (which re-exports this
 * module) rather than reaching into individual files, so the internal layout can
 * evolve without breaking consumers.
 */

export type { NodeKind } from "./node-kind.js";
export { NODE_KINDS } from "./node-kind.js";

export type {
  AstNode,
  AssignOp,
  BinaryOp,
  UnaryOp,
  PrimitiveTypeName,
  // Source structure
  ProgramNode,
  ModuleDeclNode,
  ImportStmtNode,
  TopLevelItem,
  // Declarations
  ParameterNode,
  FunctionDeclNode,
  InterruptDeclNode,
  StructFieldNode,
  StructDeclNode,
  EnumMemberNode,
  EnumDeclNode,
  LetDeclNode,
  ConstDeclNode,
  ZeropageFieldNode,
  ZeropageBlockNode,
  // Statements
  BlockNode,
  IfStmtNode,
  WhileStmtNode,
  DoWhileStmtNode,
  ForStmtNode,
  CaseClauseNode,
  DefaultClauseNode,
  SwitchStmtNode,
  ReturnStmtNode,
  BreakStmtNode,
  ContinueStmtNode,
  FallthroughStmtNode,
  ExpressionStmtNode,
  StmtNode,
  // Expressions
  AssignExprNode,
  ConditionalExprNode,
  BinaryExprNode,
  UnaryExprNode,
  CastExprNode,
  FieldAccessExprNode,
  IndexExprNode,
  CallExprNode,
  IntrinsicCallExprNode,
  IdentExprNode,
  NumericLitExprNode,
  BoolLitExprNode,
  StringLitExprNode,
  CharLitExprNode,
  StructLitFieldNode,
  StructLitExprNode,
  EmbedExprNode,
  ExprNode,
  // Types
  PrimitiveTypeNode,
  NamedTypeNode,
  ArrayTypeNode,
  TypeNode,
  // Error sentinels
  ErrorExprNode,
  ErrorStmtNode,
  ErrorTypeNode,
} from "./nodes.js";

export type { AstVisitor } from "./visitor.js";

export { walkNode, walkChildren } from "./walk.js";

export { RESERVED_BUILTINS } from "./reserved-builtins.js";
