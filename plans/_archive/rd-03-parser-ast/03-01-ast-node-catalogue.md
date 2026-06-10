# AST Node Catalogue (core): RD-03 Parser & AST

> **Document**: 03-01-ast-node-catalogue.md
> **Parent**: [Index](00-index.md)
> **Package**: `@blend65/core` — new `ast/` module
> **Source**: RD-03 §4.1–§4.8, §4.11 (adjusted by AR-1, AR-3, AR-4, AR-5)

## Overview

This component is the **AST vocabulary**: 50 node interfaces, the `NodeKind` discriminant
union, the `AstVisitor<R>` contract, the `walkNode`/`walkChildren` helpers, and the
`RESERVED_BUILTINS` set. It is pure data + traversal with **no parser logic**, so it lives in
`@blend65/core` and is shared by `frontend` and `language-server` without either importing
`codegen` (R15/AR-20, AR-5). Mirrors how RD-02 placed `TokenKind`/`Token` in core.

## Architecture

### File layout (`packages/core/src/ast/`)

| File                   | Contents                                                                 |
| ---------------------- | ------------------------------------------------------------------------ |
| `node-kind.ts`         | `NodeKind` string-literal union (50 kinds) + grouping comments           |
| `nodes.ts`             | All 50 node interfaces + the `TopLevelItem`/`StmtNode`/`ExprNode`/`TypeNode` unions |
| `visitor.ts`           | `AstVisitor<R>` interface (one `visit*` per kind)                        |
| `walk.ts`              | `walkNode(node, visitor)` dispatch + `walkChildren(node, visitor)`       |
| `reserved-builtins.ts` | `RESERVED_BUILTINS: ReadonlySet<string>` (22 universal intrinsic names)  |
| `index.ts`             | Barrel re-exporting the above                                            |

> If `nodes.ts` approaches the 500-line limit it is split into `nodes-decl.ts`,
> `nodes-stmt.ts`, `nodes-expr.ts`, `nodes-type.ts` re-exported from `nodes.ts`. The
> execution plan notes this as a per-phase check.

### `NodeKind` (50 kinds — AR-1 removed `AsmBlock`)

String-literal union (consistent with `TokenKind`/`DiagCode` style — readable golden snapshots):

```typescript
export type NodeKind =
  // Source structure (3)
  | "Program" | "ModuleDecl" | "ImportStmt"
  // Declarations (11)
  | "FunctionDecl" | "InterruptDecl"
  | "StructDecl"   | "StructField"
  | "EnumDecl"     | "EnumMember"
  | "LetDecl"      | "ConstDecl"
  | "ZeropageBlock" | "ZeropageField"
  | "Parameter"
  // Statements (13 — was 14; AsmBlock removed per AR-1)
  | "Block" | "IfStmt" | "WhileStmt" | "DoWhileStmt" | "ForStmt"
  | "SwitchStmt" | "CaseClause" | "DefaultClause"
  | "ReturnStmt" | "BreakStmt" | "ContinueStmt" | "FallthroughStmt"
  | "ExpressionStmt"
  // Expressions (17)
  | "AssignExpr" | "ConditionalExpr" | "BinaryExpr"
  | "UnaryExpr"  | "CastExpr"
  | "FieldAccessExpr" | "IndexExpr" | "CallExpr" | "IntrinsicCallExpr"
  | "IdentExpr"  | "NumericLitExpr" | "BoolLitExpr"
  | "StringLitExpr" | "CharLitExpr"
  | "StructLitExpr" | "StructLitField"
  | "EmbedExpr"
  // Types (3)
  | "PrimitiveType" | "NamedType" | "ArrayType"
  // Error sentinels (3)
  | "ErrorExpr" | "ErrorStmt" | "ErrorType";
```

**Count: 50** = 3 + 11 + 13 + 17 + 3 + 3. Parenthesised `(expr)` produces **no** dedicated
node — the inner expr is returned with its span extended over the parentheses (FR-42).

## Implementation Details

### Base node & span (AR-4)

```typescript
import type { SourceSpan } from "../diagnostics/index.js";

export interface AstNode {
  readonly kind: NodeKind;
  readonly span: SourceSpan;   // { sourceId, start, end } — the as-built core type (AR-4)
}
```

### Source-level nodes

```typescript
export interface ProgramNode extends AstNode {
  kind: "Program";
  moduleDecl: ModuleDeclNode;
  items: TopLevelItem[];
}
export interface ModuleDeclNode extends AstNode {
  kind: "ModuleDecl";
  name: string;          // dot-separated, e.g. "Game.Engine"
  nameSpan: SourceSpan;
}
export interface ImportStmtNode extends AstNode {
  kind: "ImportStmt";
  symbols: { name: string; span: SourceSpan }[];
  modulePath: string;
  modulePathSpan: SourceSpan;
}
export type TopLevelItem =
  | ImportStmtNode | FunctionDeclNode | InterruptDeclNode
  | StructDeclNode | EnumDeclNode | LetDeclNode | ConstDeclNode
  | ZeropageBlockNode | ErrorStmtNode;
```

### Declaration nodes

Shapes follow RD-03 §4.4 verbatim, with `Span` → `SourceSpan` (AR-4). Key nodes:
`FunctionDeclNode { exported, name, nameSpan, params: ParameterNode[], returnType: TypeNode,
body: BlockNode }`, `ParameterNode`, `InterruptDeclNode` (no params), `StructDeclNode` +
`StructFieldNode`, `EnumDeclNode` + `EnumMemberNode { value: ExprNode | null }`,
`LetDeclNode { initialiser: ExprNode | null }`, `ConstDeclNode { initialiser: ExprNode }`,
`ZeropageBlockNode` + `ZeropageFieldNode`.

### Statement nodes (13 — no `AsmBlock`)

Shapes per RD-03 §4.5 with `SourceSpan`. The `StmtNode` union **omits** `AsmBlockNode`:

```typescript
export type StmtNode =
  | BlockNode | IfStmtNode | WhileStmtNode | DoWhileStmtNode
  | ForStmtNode | SwitchStmtNode
  | ReturnStmtNode | BreakStmtNode | ContinueStmtNode | FallthroughStmtNode
  | ExpressionStmtNode
  | LetDeclNode | ConstDeclNode    // local declarations
  | ErrorStmtNode;
```
`IfStmtNode.elseClause: IfStmtNode | BlockNode | null`; `ForStmtNode { varName, varType, init,
direction: "to" | "downto", bound, step: ExprNode | null, body }`; `SwitchStmtNode { discriminant,
cases: CaseClauseNode[], defaultClause: DefaultClauseNode }`; `CaseClauseNode { values: ExprNode[],
body: StmtNode[] }`.

### Expression nodes (17)

Per RD-03 §4.6 with `SourceSpan`, **except `IntrinsicCallExprNode` (AR-3)**:

```typescript
export type AssignOp = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "&=" | "|=" | "^=" | "<<=" | ">>=";
export type BinaryOp =
  | "||" | "&&" | "|" | "^" | "&" | "==" | "!=" | "<" | ">" | "<=" | ">="
  | "<<" | ">>" | "+" | "-" | "*" | "/" | "%";
export type UnaryOp = "-" | "!" | "~" | "&";

// AR-3: intrinsic identified by name string + RESERVED_BUILTINS membership (no frozen enum).
export interface IntrinsicCallExprNode extends AstNode {
  kind: "IntrinsicCallExpr";
  name: string;                 // one of RESERVED_BUILTINS, e.g. "peek", "asm_sei", "sizeof"
  nameSpan: SourceSpan;
  args: ExprNode[];             // expression arguments
  typeArg: TypeNode | null;     // first arg of sizeof/offsetof
  fieldArg: { name: string; span: SourceSpan } | null;  // 2nd arg of offsetof
}
```
Other expression nodes: `AssignExprNode`, `ConditionalExprNode`, `BinaryExprNode`,
`UnaryExprNode`, `CastExprNode { targetType: TypeNode, operand }`, `FieldAccessExprNode`,
`IndexExprNode`, `CallExprNode { callee, args }`, `IdentExprNode { name }`,
`NumericLitExprNode { value: number, raw: string }`, `BoolLitExprNode { value: boolean }`,
`StringLitExprNode { raw }`, `CharLitExprNode { raw }`, `StructLitExprNode` + `StructLitFieldNode`,
`EmbedExprNode { path, pathSpan, format: string | null, formatSpan: SourceSpan | null }`.

```typescript
export type ExprNode =
  | AssignExprNode | ConditionalExprNode | BinaryExprNode
  | UnaryExprNode  | CastExprNode
  | FieldAccessExprNode | IndexExprNode | CallExprNode | IntrinsicCallExprNode
  | IdentExprNode  | NumericLitExprNode | BoolLitExprNode
  | StringLitExprNode | CharLitExprNode
  | StructLitExprNode | EmbedExprNode
  | ErrorExprNode;
```

### Type nodes (3) & error sentinels (3)

```typescript
export interface PrimitiveTypeNode extends AstNode {
  kind: "PrimitiveType";
  name: "byte" | "sbyte" | "word" | "sword" | "boolean" | "void";
}
export interface NamedTypeNode extends AstNode { kind: "NamedType"; name: string; }
export interface ArrayTypeNode extends AstNode {
  kind: "ArrayType"; elementType: TypeNode; size: ExprNode | null;  // null = unsized type[]
}
export type TypeNode = PrimitiveTypeNode | NamedTypeNode | ArrayTypeNode | ErrorTypeNode;

export interface ErrorExprNode extends AstNode { kind: "ErrorExpr"; }
export interface ErrorStmtNode extends AstNode { kind: "ErrorStmt"; }
export interface ErrorTypeNode extends AstNode { kind: "ErrorType"; }
```
Sentinels carry only `kind` + `span` — no semantic payload. They participate in the visitor so
downstream phases skip/report them uniformly.

### `RESERVED_BUILTINS` (AR-3) — 22 universal intrinsics from spec Ch 12

```typescript
// spec/12-intrinsics.md §2 (13 CPU control) + §3 (9 memory). Platform encoders (Ch 15)
// are NOT universal and are excluded — an unknown callee parses as a normal CallExpr.
export const RESERVED_BUILTINS: ReadonlySet<string> = new Set([
  // CPU control (13)
  "asm_sei", "asm_cli", "asm_pha", "asm_pla", "asm_php", "asm_plp", "asm_clc",
  "asm_sec", "asm_cld", "asm_sed", "asm_clv", "asm_nop", "asm_brk",
  // Memory (9)
  "peek", "poke", "peekw", "pokew", "lo", "hi", "sizeof", "offsetof", "length",
]);
```
The parser, on seeing `IdentExpr` immediately followed by `(`, checks `RESERVED_BUILTINS`: a
hit → `IntrinsicCallExpr` (with `sizeof`/`offsetof` taking a type/field first arg); a miss →
ordinary `CallExpr`. Arity/type checks belong to RD-04.

### Visitor & walkers (AR-5)

```typescript
export interface AstVisitor<R = void> {
  visitProgram(node: ProgramNode): R;
  visitModuleDecl(node: ModuleDeclNode): R;
  visitImportStmt(node: ImportStmtNode): R;
  // … one method per kind … (no visitAsmBlock — AR-1)
  visitErrorExpr(node: ErrorExprNode): R;
  visitErrorStmt(node: ErrorStmtNode): R;
  visitErrorType(node: ErrorTypeNode): R;
}

/** Dispatch to the matching visitor method on node.kind. Exhaustive switch. */
export function walkNode<R>(node: AstNode, visitor: AstVisitor<R>): R;

/** Depth-first visit of every child node of `node` (no return aggregation). */
export function walkChildren(node: AstNode, visitor: AstVisitor<void>): void;
```
`walkNode` is a single `switch (node.kind)` with a `never`-typed default arm — the compiler
proves all 50 kinds are handled (TS exhaustiveness). `walkChildren` recurses into each node's
child fields.

## Integration Points

- Consumes `SourceSpan` / `makeSpan` from `../diagnostics/index.js`.
- Re-exported through `packages/core/src/index.ts` (`export * from "./ast/index.js";`).
- The parser (`@blend65/frontend`) imports every node interface, the unions, `walkNode`, and
  `RESERVED_BUILTINS` from `@blend65/core`.

## Error Handling

| Error Case                                  | Handling Strategy                                              | AR Ref |
| ------------------------------------------- | ------------------------------------------------------------- | ------ |
| Node kind missing a visitor method          | `walkNode` `never` default arm → compile error (exhaustiveness)| —      |
| `IntrinsicCallExpr` for a non-reserved name | Not constructed — parser emits `CallExpr` instead             | AR-3   |
| Spans constructed from wrong token order    | `makeSpan` clamps `end < start` (frozen helper) — defensive   | AR-4   |

## Testing Requirements

- `node-kind.impl.test.ts`: assert the union has exactly 50 members via a representative
  enumeration guard (ST-P1).
- `reserved-builtins.impl.test.ts`: assert the set has exactly 22 members and contains each
  named intrinsic (ST-P2).
- `walk.impl.test.ts`: `walkNode` dispatches each kind to the right method; `walkChildren`
  visits all children of a hand-built tree (ST-P3).
- Visitor exhaustiveness is enforced by the type-checker (no separate runtime test needed).
