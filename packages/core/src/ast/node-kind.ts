/**
 * The AST node-kind vocabulary for Blend65.
 *
 * Every AST node carries a `kind` discriminant drawn from this closed set. The
 * names mirror the `TokenKind`/`DiagCode` string-literal convention so golden AST
 * snapshots stay human-readable and a rename is caught immediately. There are
 * exactly **51** kinds; Blend65 v3 has no `asm { }` blocks (spec Ch 12 §1).
 *
 * The runtime tuple {@link NODE_KINDS} is the single source of truth; the
 * {@link NodeKind} union type is derived from it so the type and the runtime list
 * can never drift apart.
 */

/**
 * The canonical, ordered list of every AST node kind (51 total).
 *
 * Grouped as: 3 source structure + 11 declaration + 13 statement +
 * 18 expression + 3 type + 3 error sentinel.
 */
export const NODE_KINDS = [
  // Source structure (3)
  "Program",
  "ModuleDecl",
  "ImportStmt",
  // Declarations (11)
  "FunctionDecl",
  "InterruptDecl",
  "StructDecl",
  "StructField",
  "EnumDecl",
  "EnumMember",
  "LetDecl",
  "ConstDecl",
  "ZeropageBlock",
  "ZeropageField",
  "Parameter",
  // Statements (13)
  "Block",
  "IfStmt",
  "WhileStmt",
  "DoWhileStmt",
  "ForStmt",
  "SwitchStmt",
  "CaseClause",
  "DefaultClause",
  "ReturnStmt",
  "BreakStmt",
  "ContinueStmt",
  "FallthroughStmt",
  "ExpressionStmt",
  // Expressions (17)
  "AssignExpr",
  "ConditionalExpr",
  "BinaryExpr",
  "UnaryExpr",
  "CastExpr",
  "FieldAccessExpr",
  "IndexExpr",
  "CallExpr",
  "IntrinsicCallExpr",
  "IdentExpr",
  "NumericLitExpr",
  "BoolLitExpr",
  "StringLitExpr",
  "CharLitExpr",
  "StructLitExpr",
  "StructLitField",
  "ArrayLitExpr",
  "EmbedExpr",
  // Types (3)
  "PrimitiveType",
  "NamedType",
  "ArrayType",
  // Error sentinels (3)
  "ErrorExpr",
  "ErrorStmt",
  "ErrorType",
] as const;

/**
 * The discriminant union of every AST node kind.
 *
 * Derived from {@link NODE_KINDS} so the runtime list and the static type stay
 * in lock-step. Used as the `kind` field on {@link AstNode} and as the switch
 * discriminant in {@link walkNode}.
 */
export type NodeKind = (typeof NODE_KINDS)[number];
