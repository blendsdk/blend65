/**
 * The AST node interfaces for Blend65 (RD-03 §4.2–§4.8, adjusted by AR-1/AR-3/AR-4).
 *
 * Every node extends {@link AstNode} (a `kind` discriminant + a {@link SourceSpan}).
 * Node shapes are pure data: no parser logic lives here, so the whole catalogue
 * sits in `@blend65/core` and is shared by `frontend` and `language-server`
 * without either importing `codegen` (R15/AR-20). Spans use the as-built core
 * {@link SourceSpan} (`{ sourceId, start, end }`) per AR-4.
 *
 * The four group unions — {@link TopLevelItem}, {@link StmtNode}, {@link ExprNode},
 * {@link TypeNode} — are the vocabulary the parser produces and downstream phases
 * consume. There are 50 node kinds (AR-1 removed `AsmBlock`).
 */

import type { SourceSpan } from "../diagnostics/index.js";
import type { NodeKind } from "./node-kind.js";

/** The common base every AST node shares: its discriminant kind and its span. */
export interface AstNode {
  /** Discriminant identifying the concrete node type. */
  readonly kind: NodeKind;
  /** The source byte range this node spans. */
  readonly span: SourceSpan;
}

// ───────────────────────────────────────────────────────────────────────────
// Operator literal unions
// ───────────────────────────────────────────────────────────────────────────

/** Assignment operators (`=` plus the compound forms). */
export type AssignOp = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "&=" | "|=" | "^=" | "<<=" | ">>=";

/** Binary operators, listed loosest-to-tightest binding for reference. */
export type BinaryOp =
  | "||"
  | "&&"
  | "|"
  | "^"
  | "&"
  | "=="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "<<"
  | ">>"
  | "+"
  | "-"
  | "*"
  | "/"
  | "%";

/** Prefix unary operators (`&` is address-of in prefix position). */
export type UnaryOp = "-" | "!" | "~" | "&";

/** The six primitive type names spellable as a {@link PrimitiveTypeNode}. */
export type PrimitiveTypeName = "byte" | "sbyte" | "word" | "sword" | "boolean" | "void";

// ───────────────────────────────────────────────────────────────────────────
// Source structure (3)
// ───────────────────────────────────────────────────────────────────────────

/** The root node: a single source file's module decl plus its top-level items. */
export interface ProgramNode extends AstNode {
  kind: "Program";
  moduleDecl: ModuleDeclNode;
  items: TopLevelItem[];
}

/** The mandatory leading `module Name.Sub;` declaration. */
export interface ModuleDeclNode extends AstNode {
  kind: "ModuleDecl";
  /** Dot-separated module path, e.g. `"Game.Engine"`. */
  name: string;
  nameSpan: SourceSpan;
}

/** An `import { a, b } from Mod.Path;` statement. */
export interface ImportStmtNode extends AstNode {
  kind: "ImportStmt";
  symbols: { name: string; span: SourceSpan }[];
  modulePath: string;
  modulePathSpan: SourceSpan;
}

/** Any item legal at the top level of a file. */
export type TopLevelItem =
  | ImportStmtNode
  | FunctionDeclNode
  | InterruptDeclNode
  | StructDeclNode
  | EnumDeclNode
  | LetDeclNode
  | ConstDeclNode
  | ZeropageBlockNode
  | ErrorStmtNode;

// ───────────────────────────────────────────────────────────────────────────
// Declarations (11)
// ───────────────────────────────────────────────────────────────────────────

/** A single typed function parameter (`name: type`). */
export interface ParameterNode extends AstNode {
  kind: "Parameter";
  name: string;
  nameSpan: SourceSpan;
  paramType: TypeNode;
}

/** A `function name(params): returnType { ... }` declaration. */
export interface FunctionDeclNode extends AstNode {
  kind: "FunctionDecl";
  exported: boolean;
  name: string;
  nameSpan: SourceSpan;
  params: ParameterNode[];
  returnType: TypeNode;
  body: BlockNode;
}

/** An `interrupt name() { ... }` declaration (no params, no return type). */
export interface InterruptDeclNode extends AstNode {
  kind: "InterruptDecl";
  exported: boolean;
  name: string;
  nameSpan: SourceSpan;
  body: BlockNode;
}

/** A single `name: type;` field within a struct declaration. */
export interface StructFieldNode extends AstNode {
  kind: "StructField";
  name: string;
  nameSpan: SourceSpan;
  fieldType: TypeNode;
}

/** A `struct Name { field; field; }` declaration. */
export interface StructDeclNode extends AstNode {
  kind: "StructDecl";
  exported: boolean;
  name: string;
  nameSpan: SourceSpan;
  fields: StructFieldNode[];
}

/** A single `Name` or `Name = value` member within an enum declaration. */
export interface EnumMemberNode extends AstNode {
  kind: "EnumMember";
  name: string;
  nameSpan: SourceSpan;
  value: ExprNode | null;
}

/** An `enum Name { A, B = 2, C }` declaration. */
export interface EnumDeclNode extends AstNode {
  kind: "EnumDecl";
  exported: boolean;
  name: string;
  nameSpan: SourceSpan;
  members: EnumMemberNode[];
}

/** A `let name: type = init;` declaration (top-level or local). */
export interface LetDeclNode extends AstNode {
  kind: "LetDecl";
  exported: boolean;
  name: string;
  nameSpan: SourceSpan;
  declaredType: TypeNode | null;
  initialiser: ExprNode | null;
}

/** A `const name: type = init;` declaration (initialiser required). */
export interface ConstDeclNode extends AstNode {
  kind: "ConstDecl";
  exported: boolean;
  name: string;
  nameSpan: SourceSpan;
  declaredType: TypeNode | null;
  initialiser: ExprNode;
}

/**
 * A single `name: type [= constExpr];` field inside a `zeropage` block.
 *
 * The initialiser is **optional** (spec Ch03 §2.3, FR-22): an uninitialised
 * zeropage variable (`initialiser: null`) emits no startup code — its memory
 * retains whatever was there before (spec §5.1/§6.3), leaving initialisation to
 * the developer. When present, the startup routine emits the stores (RD-07+).
 */
export interface ZeropageFieldNode extends AstNode {
  kind: "ZeropageField";
  name: string;
  nameSpan: SourceSpan;
  fieldType: TypeNode;
  initialiser: ExprNode | null;
}

/** A `zeropage { field; field; }` block reserving zero-page storage. */

export interface ZeropageBlockNode extends AstNode {
  kind: "ZeropageBlock";
  fields: ZeropageFieldNode[];
}

// ───────────────────────────────────────────────────────────────────────────
// Statements (13 — no AsmBlock, AR-1)
// ───────────────────────────────────────────────────────────────────────────

/** A `{ ... }` block of statements. */
export interface BlockNode extends AstNode {
  kind: "Block";
  statements: StmtNode[];
}

/** An `if (cond) thenBlock [else elseClause]` statement. */
export interface IfStmtNode extends AstNode {
  kind: "IfStmt";
  condition: ExprNode;
  thenBlock: BlockNode;
  /** Either a chained `else if` (an IfStmt), an `else` block, or none. */
  elseClause: IfStmtNode | BlockNode | null;
}

/** A `while (cond) body` loop. */
export interface WhileStmtNode extends AstNode {
  kind: "WhileStmt";
  condition: ExprNode;
  body: BlockNode;
}

/** A `do body while (cond);` loop. */
export interface DoWhileStmtNode extends AstNode {
  kind: "DoWhileStmt";
  body: BlockNode;
  condition: ExprNode;
}

/** A `for name: type = init to|downto bound [step s] body` loop. */
export interface ForStmtNode extends AstNode {
  kind: "ForStmt";
  varName: string;
  varNameSpan: SourceSpan;
  varType: TypeNode | null;
  init: ExprNode;
  direction: "to" | "downto";
  bound: ExprNode;
  step: ExprNode | null;
  body: BlockNode;
}

/** A single `case v1, v2: body` clause within a switch. */
export interface CaseClauseNode extends AstNode {
  kind: "CaseClause";
  values: ExprNode[];
  body: StmtNode[];
}

/** The `default: body` clause within a switch. */
export interface DefaultClauseNode extends AstNode {
  kind: "DefaultClause";
  body: StmtNode[];
}

/** A `switch (disc) { case ...; default ... }` statement. */
export interface SwitchStmtNode extends AstNode {
  kind: "SwitchStmt";
  discriminant: ExprNode;
  cases: CaseClauseNode[];
  defaultClause: DefaultClauseNode;
}

/** A `return [expr];` statement. */
export interface ReturnStmtNode extends AstNode {
  kind: "ReturnStmt";
  value: ExprNode | null;
}

/** A `break;` statement. */
export interface BreakStmtNode extends AstNode {
  kind: "BreakStmt";
}

/** A `continue;` statement. */
export interface ContinueStmtNode extends AstNode {
  kind: "ContinueStmt";
}

/** A `fallthrough;` statement (explicit switch fall-through). */
export interface FallthroughStmtNode extends AstNode {
  kind: "FallthroughStmt";
}

/** An expression used in statement position (`expr;`). */
export interface ExpressionStmtNode extends AstNode {
  kind: "ExpressionStmt";
  expression: ExprNode;
}

/** Any node legal in statement position (includes local declarations). */
export type StmtNode =
  | BlockNode
  | IfStmtNode
  | WhileStmtNode
  | DoWhileStmtNode
  | ForStmtNode
  | SwitchStmtNode
  | ReturnStmtNode
  | BreakStmtNode
  | ContinueStmtNode
  | FallthroughStmtNode
  | ExpressionStmtNode
  | LetDeclNode
  | ConstDeclNode
  | ErrorStmtNode;

// ───────────────────────────────────────────────────────────────────────────
// Expressions (17)
// ───────────────────────────────────────────────────────────────────────────

/** An assignment `target op value` (right-associative). */
export interface AssignExprNode extends AstNode {
  kind: "AssignExpr";
  op: AssignOp;
  target: ExprNode;
  value: ExprNode;
}

/** A ternary `condition ? whenTrue : whenFalse` (right-associative). */
export interface ConditionalExprNode extends AstNode {
  kind: "ConditionalExpr";
  condition: ExprNode;
  whenTrue: ExprNode;
  whenFalse: ExprNode;
}

/** A binary `left op right` expression. */
export interface BinaryExprNode extends AstNode {
  kind: "BinaryExpr";
  op: BinaryOp;
  left: ExprNode;
  right: ExprNode;
}

/** A prefix unary `op operand` expression. */
export interface UnaryExprNode extends AstNode {
  kind: "UnaryExpr";
  op: UnaryOp;
  operand: ExprNode;
}

/** A `<type>operand` cast expression. */
export interface CastExprNode extends AstNode {
  kind: "CastExpr";
  targetType: TypeNode;
  operand: ExprNode;
}

/** A `object.field` member access. */
export interface FieldAccessExprNode extends AstNode {
  kind: "FieldAccessExpr";
  object: ExprNode;
  field: string;
  fieldSpan: SourceSpan;
}

/** An `array[index]` element access. */
export interface IndexExprNode extends AstNode {
  kind: "IndexExpr";
  object: ExprNode;
  index: ExprNode;
}

/** A `callee(args)` function call. */
export interface CallExprNode extends AstNode {
  kind: "CallExpr";
  callee: ExprNode;
  args: ExprNode[];
}

/**
 * A call to a universal intrinsic (AR-3).
 *
 * The intrinsic is identified by `name` (a member of `RESERVED_BUILTINS`), not a
 * frozen enum. `sizeof`/`offsetof` accept a type as their first argument (stored
 * in `typeArg`); `offsetof` additionally takes a field name (`fieldArg`).
 */
export interface IntrinsicCallExprNode extends AstNode {
  kind: "IntrinsicCallExpr";
  name: string;
  nameSpan: SourceSpan;
  args: ExprNode[];
  typeArg: TypeNode | null;
  fieldArg: { name: string; span: SourceSpan } | null;
}

/** A bare identifier reference. */
export interface IdentExprNode extends AstNode {
  kind: "IdentExpr";
  name: string;
}

/** A numeric literal (decimal/hex/binary), with its decoded value and raw text. */
export interface NumericLitExprNode extends AstNode {
  kind: "NumericLitExpr";
  value: number;
  raw: string;
}

/** A `true` / `false` boolean literal. */
export interface BoolLitExprNode extends AstNode {
  kind: "BoolLitExpr";
  value: boolean;
}

/** A string literal (raw, unescaped source text without surrounding quotes). */
export interface StringLitExprNode extends AstNode {
  kind: "StringLitExpr";
  raw: string;
}

/** A character literal (raw source text without surrounding quotes). */
export interface CharLitExprNode extends AstNode {
  kind: "CharLitExpr";
  raw: string;
}

/** A single `name: value` field within a struct literal. */
export interface StructLitFieldNode extends AstNode {
  kind: "StructLitField";
  name: string;
  nameSpan: SourceSpan;
  value: ExprNode;
}

/** A `TypeName { field: value, ... }` struct literal. */
export interface StructLitExprNode extends AstNode {
  kind: "StructLitExpr";
  typeName: string;
  typeNameSpan: SourceSpan;
  fields: StructLitFieldNode[];
}

/** An `embed("path" [, "format"])` data-inclusion expression. */
export interface EmbedExprNode extends AstNode {
  kind: "EmbedExpr";
  path: string;
  pathSpan: SourceSpan;
  format: string | null;
  formatSpan: SourceSpan | null;
}

/** Any node legal in expression position. */
export type ExprNode =
  | AssignExprNode
  | ConditionalExprNode
  | BinaryExprNode
  | UnaryExprNode
  | CastExprNode
  | FieldAccessExprNode
  | IndexExprNode
  | CallExprNode
  | IntrinsicCallExprNode
  | IdentExprNode
  | NumericLitExprNode
  | BoolLitExprNode
  | StringLitExprNode
  | CharLitExprNode
  | StructLitExprNode
  | EmbedExprNode
  | ErrorExprNode;

// ───────────────────────────────────────────────────────────────────────────
// Types (3)
// ───────────────────────────────────────────────────────────────────────────

/** A built-in primitive type (`byte`, `word`, `boolean`, …). */
export interface PrimitiveTypeNode extends AstNode {
  kind: "PrimitiveType";
  name: PrimitiveTypeName;
}

/** A user-defined named type (struct/enum reference). */
export interface NamedTypeNode extends AstNode {
  kind: "NamedType";
  name: string;
}

/** An array type `element[size]`; `size` is null for an unsized `element[]`. */
export interface ArrayTypeNode extends AstNode {
  kind: "ArrayType";
  elementType: TypeNode;
  size: ExprNode | null;
}

/** Any node legal in type position. */
export type TypeNode = PrimitiveTypeNode | NamedTypeNode | ArrayTypeNode | ErrorTypeNode;

// ───────────────────────────────────────────────────────────────────────────
// Error sentinels (3)
// ───────────────────────────────────────────────────────────────────────────

/** Placeholder inserted where an expression was expected but not parsed. */
export interface ErrorExprNode extends AstNode {
  kind: "ErrorExpr";
}

/** Placeholder inserted where a statement / top-level item failed to parse. */
export interface ErrorStmtNode extends AstNode {
  kind: "ErrorStmt";
}

/** Placeholder inserted where a type was expected but not parsed. */
export interface ErrorTypeNode extends AstNode {
  kind: "ErrorType";
}
