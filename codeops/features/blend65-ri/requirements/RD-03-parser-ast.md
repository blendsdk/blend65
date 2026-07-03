# RD-03: Parser & AST

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: RD-02
> **Implements**: `spec-v3.0` Ch 02–13, `grammar.ebnf.md`; evaluations F001–F006, F008–F009, F011–F019, F022, F024
> **Owning package(s)**: `@blend65/core` (AST node types), `@blend65/frontend` (parser)
> **Created**: 2026-05-31
> **Last Updated**: 2026-05-31

---

## 1. Purpose

This document specifies the **recursive-descent + Pratt parser** for Blend65 and the
**AST node model** it produces. The parser consumes a `Token[]` array from the lexer
(RD-02) and produces a typed, span-annotated abstract syntax tree representing one
source file. Following the error-tolerant frontend mandate (AR-15), the parser **never
throws** — it accumulates diagnostics in a `DiagnosticBag` (AR-73) and inserts
error-sentinel nodes (AR-74) so that downstream phases always receive a structurally
complete tree.

AST node types are defined in `@blend65/core` (shared by compiler and language server)
while the parser itself lives in `@blend65/frontend`. Per the walking-skeleton
methodology (AR-38), the grammar is transcribed fully up front, but the AST node
catalogue and semantic visitors are grown slice-by-slice. This RD defines the **complete
target catalogue** — the implementation plan will add nodes incrementally.

## 2. Scope

**In scope:**

- Recursive-descent parser for source structure, declarations, and statements.
- Pratt expression parser with 14 precedence levels.
- Complete AST node type catalogue (50 node kinds matching the 85 grammar productions).
- Error-sentinel nodes (`ErrorExpr`, `ErrorStmt`, `ErrorType`) and context-specific
  sync-point recovery.
- Cascade-suppression logic for error-tolerant parsing.
- Visitor / walker contract for AST traversal.
- Public `parse()` API and its types.
- All parser-emitted diagnostic codes (E103xx band + spec-defined codes).

**Out of scope (and where it lives instead):**

- Token production → RD-02.
- Type checking, scope resolution, semantic validation → RD-04.
- SFA frame planning, call-graph extraction → RD-05.
- IL lowering, code generation → RD-06, RD-07.
- Diagnostic rendering and formatting → RD-11.
- Language-server incremental re-parse strategy → RD-14.
- Runtime cost of parsed constructs → RD-07.

> **Traceability rule:** Every decision below cites the Ambiguity Register entry
> (`AR-NN`) that resolved it, or the frozen spec section it implements.

---

## 3. Decisions & Requirements

| ID | Requirement | Spec / AR ref |
|----|-------------|---------------|
| | **Parsing strategy** | |
| R1 | Parser uses recursive descent for source structure, declarations, and statements; Pratt parsing for expressions. Every grammar production (`grammar.ebnf.md` §10, 85 productions) maps to a parse function. | grammar §11, AR-38 |
| R2 | Expression parser implements 14 precedence levels via Pratt binding powers (§4.9). Left-associative by default; right-associative for assignment and conditional operators. | grammar §6, Ch 04 §3 |
| R3 | Token stream is consumed via a position-index cursor with `peek()`, `advance()`, `expect()`, and `check()` helpers. The token array is never mutated. | Implementation |
| | **Error tolerance** | |
| R4 | Parser never throws. All syntax errors are appended to the shared `DiagnosticBag`. The parser always returns a `ParseResult` containing a (possibly partial) AST. | AR-15, AR-73 |
| R5 | When a syntax error is encountered, the parser inserts an **error-sentinel node** (`ErrorExpr`, `ErrorStmt`, or `ErrorType`) at the point of failure and advances to the next synchronisation point. | AR-74 |
| R6 | Synchronisation points are context-specific (§4.10): top-level → declaration keywords / EOF; statement-level → `;`, `}`, statement keywords; expression-level → `;`, `)`, `]`, `}`, `,`. | AR-74 |
| R7 | **Cascade suppression**: after inserting an error sentinel, the parser enters a suppressed state and withholds further diagnostics until a sync point is consumed. This prevents chains of misleading secondary errors. | AR-74 |
| | **AST model** | |
| R8 | AST node interfaces are defined in `@blend65/core` so they are shared by compiler and language server. The parser in `@blend65/frontend` constructs them. | AR-38, RD-01 (R2, R5) |
| R9 | Every AST node carries a `span: Span` where `Span = { start: number; end: number; source: SourceId }`. Byte offsets are into the original UTF-8 source text. | AR-72, RD-02 (R8) |
| R10 | AST is a **pure data tree**: no parent pointers, no methods, no circular references. Each node has a string-literal `kind` discriminant for exhaustive `switch`-matching in TypeScript. | AR-38 |
| R11 | AST evolution is **additive-only**: a new node kind = new `kind` value + new interface + new visitor case. Existing node shapes never change. | AR-38 |
| | **Source structure** | |
| R12 | `ProgramNode` is the root: one `ModuleDeclNode` + ordered array of top-level items. | grammar §2.1, F002 |
| R13 | `ModuleDeclNode`: `module dotted.name;`. Error E10001 if missing; E10002 if duplicated. | F002, Ch 10 §1 |
| R14 | `ImportStmtNode`: `import { name [, name]* } from dotted.name;`. Symbol list and module path are stored. | F002, Ch 10 §2 |
| R15 | Valid top-level items: ImportStmt, FunctionDecl, InterruptDecl, StructDecl, EnumDecl, LetDecl, ConstDecl, ZeropageBlock. Any other token triggers E10310 with recovery to next declaration keyword or EOF. | F003, grammar §2.1 |
| | **Declarations** | |
| R16 | `FunctionDeclNode`: optional `export`, `function`, name, `(` params `)`, `:` return-type, block body. | F018, Ch 06 |
| R17 | `ParameterNode`: `name : type`. Comma-separated list; no trailing comma. Empty parameter list allowed. | F018, Ch 06 §2 |
| R18 | `InterruptDeclNode`: `interrupt function` name `()` block. No parameters, implicit void return. `export` on interrupt → E10311. | F007, Ch 06 §4 |
| R19 | `StructDeclNode`: optional `export`, `struct` Name `{` fields `}`. One or more `StructFieldNode` (`name: type;`). Empty struct → E10316. | F011, Ch 07 |
| R20 | `EnumDeclNode`: optional `export`, `enum` Name `{` members `}`. Comma-separated `EnumMemberNode` (`NAME [= constExpr]`). Trailing comma allowed. Empty enum → E10315. | F022, Ch 09 |
| R21 | `LetDeclNode` / `ConstDeclNode`: optional `export`, `let`/`const`, name `:` type `[= expr]` `;`. `const` requires initialiser — E10314 if missing. | F019, Ch 03 |
| R22 | `ZeropageBlockNode`: `zeropage {` fields `}`. Fields use `name: type [= constExpr];` syntax — no `let`/`const` keyword inside. Stored as `ZeropageFieldNode` array. | F005, Ch 11 §2 |
| R23 | `export` is valid only on top-level FunctionDecl, StructDecl, EnumDecl, LetDecl, ConstDecl. Parser error E10311 on `export interrupt`, `export zeropage`, or any local `export`. | F003, Ch 10 §3 |
| | **Statements** | |
| R24 | `BlockNode`: `{` statement\* `}`. May be empty. | F013, Ch 05 §1 |
| R25 | `IfStmtNode`: `if (` expr `)` block `[else` (IfStmt \| Block) `]`. Braces mandatory — dangling-else eliminated. `else if` is composed: the else clause contains an IfStmt. | F013, Ch 05 §2 |
| R26 | `WhileStmtNode`: `while (` expr `)` block. | F013, Ch 05 §3 |
| R27 | `DoWhileStmtNode`: `do` block `while (` expr `)` `;`. Trailing semicolon required — E10305 if missing. | F013, Ch 05 §4 |
| R28 | `ForStmtNode`: `for ( let` name `:` type `=` init direction bound `[step` stepExpr `] )` block. Direction is `to` or `downto`. | F008, Ch 05 §5 |
| R29 | Contextual keywords `to`, `downto`, `step`, `fallthrough` are lexed as `IDENT`; the parser recognises them by checking the identifier's text value in the expected syntactic position. They remain usable as ordinary identifiers elsewhere. | grammar §9.3, F008, F009 |
| R30 | `SwitchStmtNode`: `switch (` expr `)` `{` caseClauses defaultClause `}`. Zero or more case clauses followed by one mandatory default clause. | F009, Ch 05 §6 |
| R31 | `CaseClauseNode`: `case` expr `[, expr]*` `:` statements. Multi-value is comma-separated. Body runs until next `case`, `default`, or `}`. | F009, Ch 05 §6 |
| R32 | `DefaultClauseNode`: `default :` statements. Mandatory — E10072 if absent. Must be the last clause (grammar §5). | F009, Ch 05 §6 |
| R33 | `FallthroughStmtNode`: `fallthrough ;`. Contextual keyword (R29). Parser accepts it in any statement position; restriction to switch case bodies is a semantic check (RD-04). | F009, Ch 05 §6 |
| R34 | `ReturnStmtNode` (`return [expr];`), `BreakStmtNode` (`break;`), `ContinueStmtNode` (`continue;`). | Ch 05 §7–§9 |
| R35 | `ExpressionStmtNode`: expr `;`. Parser accepts any expression; semantic analysis restricts to assignments and calls (RD-04). | Ch 05 §10 |
| | **Expressions** | |
| R37 | `AssignExprNode`: target `=` expr, target `op=` expr. 11 operators (`= += -= *= /= %= &= \|= ^= <<= >>=`). Right-associative, lowest expression precedence. Lvalue validation is semantic (RD-04). | Ch 04, F017 |
| R38 | `ConditionalExprNode`: condition `?` thenExpr `:` elseExpr. Right-associative, one level above assignment. | F024, Ch 04 |
| R39 | `BinaryExprNode`: left operator right. 17 operators across 10 precedence levels (`\|\| && \| ^ & == != < > <= >= << >> + - * / %`). All left-associative. Operator stored as enum value. | F017, Ch 04 §3 |
| R40 | `UnaryExprNode`: prefix `-`, `!`, `~`, `&` (address-of). `CastExprNode`: `<type>(expr)`. Cast disambiguated from `<` (less-than) by prefix position in Pratt parser. | F017, F006, Ch 04 §4 |
| R41 | `FieldAccessExprNode` (`.`field), `IndexExprNode` (`[`expr`]`), `CallExprNode` (`(`args`)`). Left-associative postfix, highest binding power. | Ch 04 §5 |
| R42 | Primary expressions: `IdentExprNode`, `NumericLitExprNode`, `BoolLitExprNode`, `StringLitExprNode`, `CharLitExprNode`, parenthesised `(expr)` (no dedicated node — inner expression returned with extended span), `IntrinsicCallExprNode`, `EmbedExprNode`, `StructLitExprNode`. | Ch 04 §6 |
| | **Intrinsics & data** | |
| R43 | `IntrinsicCallExprNode`: reserved built-in name + `(` args `)`. Memory: `peek`, `poke`, `lo`, `hi`. Compile-time: `sizeof`, `offsetof`, `length`, `encode`. CPU: `asm_sei`, `asm_cli`, `asm_nop`, `asm_brk`. Parser identifies intrinsics by matching the identifier against the 28 reserved built-in names (grammar §9.4). `sizeof` and `offsetof` accept a type argument (not an expression); the parser dispatches to type-parsing for these (§4.6). | Ch 12, F012 |
| R44 | `EmbedExprNode`: `embed(` string-literal `[,` identifier `]` `)`. | Ch 13, F015 |
| R45 | `StructLitExprNode`: `{` field `:` expr `,` … `}`. Parsed **only** in initialiser context (after `=` in let/const/assignment). Disambiguated from block because blocks follow control-flow keywords while struct literals follow `=` (§4.6). | F011, Ch 07 §4 |
| | **Type expressions** | |
| R46 | `PrimitiveTypeNode`: `byte`, `sbyte`, `word`, `sword`, `boolean`, `void`. `NamedTypeNode`: identifier (struct/enum name). `ArrayTypeNode`: type`[`constExpr`]` (fixed-size) or type`[]` (unsized, restricted contexts). `ErrorTypeNode` for unrecoverable type syntax. | grammar §4, Ch 02, F014 |
| | **Public API** | |
| R47 | `parse(tokens: Token[], sourceId: SourceId, bag: DiagnosticBag): ParseResult` where `ParseResult = { ast: ProgramNode; hasErrors: boolean }`. | AR-15, AR-73 |

---

## 4. Design Detail

### 4.1  AST Node Base & Span

Every AST node implements a common shape:

```typescript
/** Byte-offset range into a source file. */
interface Span {
  start: number;     // inclusive byte offset
  end: number;       // exclusive byte offset
  source: SourceId;  // interned source identifier (from RD-02)
}

/** Discriminated-union base — every node carries kind + span. */
interface AstNode {
  readonly kind: NodeKind;
  readonly span: Span;
}
```

`Span` reuses the same `SourceId` interning as the lexer (RD-02 R8). Start and end are
byte offsets into the UTF-8 source text; line/column is derived on demand via
`LineMap.getLineAndColumn()` (RD-02 §4.8).

### 4.2  Node Kind Catalogue

The `NodeKind` type is a string-literal union enabling exhaustive `switch` in TypeScript:

```typescript
type NodeKind =
  // Source structure (3)
  | "Program" | "ModuleDecl" | "ImportStmt"
  // Declarations (11)
  | "FunctionDecl" | "InterruptDecl"
  | "StructDecl"   | "StructField"
  | "EnumDecl"     | "EnumMember"
  | "LetDecl"      | "ConstDecl"
  | "ZeropageBlock" | "ZeropageField"
  | "Parameter"
  // Statements (13)
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

**Total: 50 node kinds** (3 source + 11 declaration + 13 statement + 17 expression +
3 type + 3 error sentinel). Parenthesised expressions `(expr)` do not produce a
dedicated node — the parser returns the inner expression with its span extended to
include the parentheses.

### 4.3  Source-Level Nodes

```typescript
interface ProgramNode extends AstNode {
  kind: "Program";
  moduleDecl: ModuleDeclNode;
  items: TopLevelItem[];        // ordered as in source
}

interface ModuleDeclNode extends AstNode {
  kind: "ModuleDecl";
  name: string;                 // dot-separated, e.g. "Game.Engine"
  nameSpan: Span;               // span of the name tokens only
}

interface ImportStmtNode extends AstNode {
  kind: "ImportStmt";
  symbols: { name: string; span: Span }[];
  modulePath: string;           // dot-separated
  modulePathSpan: Span;
}

type TopLevelItem =
  | ImportStmtNode | FunctionDeclNode | InterruptDeclNode
  | StructDeclNode | EnumDeclNode
  | LetDeclNode    | ConstDeclNode
  | ZeropageBlockNode
  | ErrorStmtNode;
```

### 4.4  Declaration Nodes

```typescript
interface FunctionDeclNode extends AstNode {
  kind: "FunctionDecl";
  exported: boolean;
  name: string;
  nameSpan: Span;
  params: ParameterNode[];
  returnType: TypeNode;
  body: BlockNode;
}

interface ParameterNode extends AstNode {
  kind: "Parameter";
  name: string;
  nameSpan: Span;
  typeAnnotation: TypeNode;
}

interface InterruptDeclNode extends AstNode {
  kind: "InterruptDecl";
  name: string;
  nameSpan: Span;
  body: BlockNode;
}

interface StructDeclNode extends AstNode {
  kind: "StructDecl";
  exported: boolean;
  name: string;
  nameSpan: Span;
  fields: StructFieldNode[];    // at least one (R19)
}

interface StructFieldNode extends AstNode {
  kind: "StructField";
  name: string;
  nameSpan: Span;
  typeAnnotation: TypeNode;
}

interface EnumDeclNode extends AstNode {
  kind: "EnumDecl";
  exported: boolean;
  name: string;
  nameSpan: Span;
  members: EnumMemberNode[];    // at least one (R20)
}

interface EnumMemberNode extends AstNode {
  kind: "EnumMember";
  name: string;
  nameSpan: Span;
  value: ExprNode | null;       // null = auto-assigned
}

interface LetDeclNode extends AstNode {
  kind: "LetDecl";
  exported: boolean;
  name: string;
  nameSpan: Span;
  typeAnnotation: TypeNode;
  initialiser: ExprNode | null; // optional for let
}

interface ConstDeclNode extends AstNode {
  kind: "ConstDecl";
  exported: boolean;
  name: string;
  nameSpan: Span;
  typeAnnotation: TypeNode;
  initialiser: ExprNode;        // always present (R21)
}

interface ZeropageBlockNode extends AstNode {
  kind: "ZeropageBlock";
  fields: ZeropageFieldNode[];
}

interface ZeropageFieldNode extends AstNode {
  kind: "ZeropageField";
  name: string;
  nameSpan: Span;
  typeAnnotation: TypeNode;
  initialiser: ExprNode | null;
}
```

### 4.5  Statement Nodes

```typescript
interface BlockNode extends AstNode {
  kind: "Block";
  statements: StmtNode[];
}

interface IfStmtNode extends AstNode {
  kind: "IfStmt";
  condition: ExprNode;
  thenBlock: BlockNode;
  elseClause: IfStmtNode | BlockNode | null;
}

interface WhileStmtNode extends AstNode {
  kind: "WhileStmt";
  condition: ExprNode;
  body: BlockNode;
}

interface DoWhileStmtNode extends AstNode {
  kind: "DoWhileStmt";
  body: BlockNode;
  condition: ExprNode;
}

interface ForStmtNode extends AstNode {
  kind: "ForStmt";
  varName: string;
  varNameSpan: Span;
  varType: TypeNode;
  init: ExprNode;
  direction: "to" | "downto";
  bound: ExprNode;
  step: ExprNode | null;        // null = default step 1
  body: BlockNode;
}

interface SwitchStmtNode extends AstNode {
  kind: "SwitchStmt";
  discriminant: ExprNode;
  cases: CaseClauseNode[];      // zero or more
  defaultClause: DefaultClauseNode;
}

interface CaseClauseNode extends AstNode {
  kind: "CaseClause";
  values: ExprNode[];           // one or more (comma-separated)
  body: StmtNode[];
}

interface DefaultClauseNode extends AstNode {
  kind: "DefaultClause";
  body: StmtNode[];
}

interface ReturnStmtNode extends AstNode {
  kind: "ReturnStmt";
  value: ExprNode | null;
}

interface BreakStmtNode extends AstNode {
  kind: "BreakStmt";
}

interface ContinueStmtNode extends AstNode {
  kind: "ContinueStmt";
}

interface FallthroughStmtNode extends AstNode {
  kind: "FallthroughStmt";
}

interface ExpressionStmtNode extends AstNode {
  kind: "ExpressionStmt";
  expression: ExprNode;
}

type StmtNode =
  | BlockNode | IfStmtNode | WhileStmtNode | DoWhileStmtNode
  | ForStmtNode | SwitchStmtNode
  | ReturnStmtNode | BreakStmtNode | ContinueStmtNode | FallthroughStmtNode
  | ExpressionStmtNode
  | LetDeclNode | ConstDeclNode   // local declarations
  | ErrorStmtNode;
```

### 4.6  Expression Nodes

```typescript
/** Assignment operators */
type AssignOp =
  | "=" | "+=" | "-=" | "*=" | "/=" | "%="
  | "&=" | "|=" | "^=" | "<<=" | ">>=";

/** Binary operators */
type BinaryOp =
  | "||" | "&&"
  | "|"  | "^"  | "&"
  | "==" | "!="
  | "<"  | ">"  | "<=" | ">="
  | "<<" | ">>"
  | "+"  | "-"  | "*"  | "/"  | "%";

/** Unary prefix operators */
type UnaryOp = "-" | "!" | "~" | "&";

interface AssignExprNode extends AstNode {
  kind: "AssignExpr";
  operator: AssignOp;
  target: ExprNode;
  value: ExprNode;
}

interface ConditionalExprNode extends AstNode {
  kind: "ConditionalExpr";
  condition: ExprNode;
  thenExpr: ExprNode;
  elseExpr: ExprNode;
}

interface BinaryExprNode extends AstNode {
  kind: "BinaryExpr";
  operator: BinaryOp;
  left: ExprNode;
  right: ExprNode;
}

interface UnaryExprNode extends AstNode {
  kind: "UnaryExpr";
  operator: UnaryOp;            // includes & (address-of)
  operand: ExprNode;
}

interface CastExprNode extends AstNode {
  kind: "CastExpr";
  targetType: TypeNode;
  operand: ExprNode;
}

interface FieldAccessExprNode extends AstNode {
  kind: "FieldAccessExpr";
  object: ExprNode;
  field: string;
  fieldSpan: Span;
}

interface IndexExprNode extends AstNode {
  kind: "IndexExpr";
  object: ExprNode;
  index: ExprNode;
}

interface CallExprNode extends AstNode {
  kind: "CallExpr";
  callee: ExprNode;
  args: ExprNode[];
}

/** Intrinsic function call kinds */
type IntrinsicKind =
  | "peek" | "poke" | "lo" | "hi"
  | "sizeof" | "offsetof" | "length" | "encode"
  | "asm_sei" | "asm_cli" | "asm_nop" | "asm_brk";

interface IntrinsicCallExprNode extends AstNode {
  kind: "IntrinsicCallExpr";
  intrinsic: IntrinsicKind;
  nameSpan: Span;
  args: ExprNode[];             // expression arguments
  typeArg: TypeNode | null;     // type argument (sizeof, offsetof)
  fieldArg: { name: string; span: Span } | null;  // field argument (offsetof)
}

interface IdentExprNode extends AstNode {
  kind: "IdentExpr";
  name: string;
}

interface NumericLitExprNode extends AstNode {
  kind: "NumericLitExpr";
  value: number;
  raw: string;                  // original source text, e.g. "$FF", "0b1010", "255"
}

interface BoolLitExprNode extends AstNode {
  kind: "BoolLitExpr";
  value: boolean;
}

interface StringLitExprNode extends AstNode {
  kind: "StringLitExpr";
  raw: string;                  // source text with escapes NOT resolved (RD-02 §4.7)
}

interface CharLitExprNode extends AstNode {
  kind: "CharLitExpr";
  raw: string;                  // source text with escapes NOT resolved
}

interface StructLitExprNode extends AstNode {
  kind: "StructLitExpr";
  fields: StructLitFieldNode[];
}

interface StructLitFieldNode extends AstNode {
  kind: "StructLitField";
  name: string;
  nameSpan: Span;
  value: ExprNode;
}

interface EmbedExprNode extends AstNode {
  kind: "EmbedExpr";
  path: string;
  pathSpan: Span;
  format: string | null;        // optional format identifier
  formatSpan: Span | null;
}

type ExprNode =
  | AssignExprNode | ConditionalExprNode | BinaryExprNode
  | UnaryExprNode  | CastExprNode
  | FieldAccessExprNode | IndexExprNode | CallExprNode | IntrinsicCallExprNode
  | IdentExprNode  | NumericLitExprNode | BoolLitExprNode
  | StringLitExprNode | CharLitExprNode
  | StructLitExprNode | EmbedExprNode
  | ErrorExprNode;
```

**Struct-literal disambiguation (R45):** A `{` token is parsed as a struct literal only
when the parser is in an expression context that follows an `=` sign (let/const
initialiser, assignment right-hand side). In all other contexts (after `if (expr)`,
`while (expr)`, `else`, `do`, etc.), `{` begins a block. This is unambiguous in a
recursive-descent parser because the parser always knows which parse function it is in.

### 4.7  Type Nodes

```typescript
interface PrimitiveTypeNode extends AstNode {
  kind: "PrimitiveType";
  name: "byte" | "sbyte" | "word" | "sword" | "boolean" | "void";
}

interface NamedTypeNode extends AstNode {
  kind: "NamedType";
  name: string;                 // struct or enum name
}

interface ArrayTypeNode extends AstNode {
  kind: "ArrayType";
  elementType: TypeNode;
  size: ExprNode | null;        // null = unsized (type[])
}

type TypeNode =
  | PrimitiveTypeNode | NamedTypeNode | ArrayTypeNode
  | ErrorTypeNode;
```

### 4.8  Error-Sentinel Nodes

```typescript
interface ErrorExprNode extends AstNode {
  kind: "ErrorExpr";
  // span covers the erroneous token range
}

interface ErrorStmtNode extends AstNode {
  kind: "ErrorStmt";
  // span covers the skipped token range
}

interface ErrorTypeNode extends AstNode {
  kind: "ErrorType";
  // span covers the position where a type was expected
}
```

Error sentinels carry no semantic data — only the `span` indicating where the error
occurred. They participate in the visitor protocol so downstream phases can skip or
report them uniformly.

### 4.9  Pratt Expression Parser

The expression parser uses a Pratt (top-down operator precedence) algorithm. Each
operator has a **left binding power** (LBP) and **right binding power** (RBP):

| Level | Operators | Assoc. | LBP | RBP |
|-------|-----------|--------|-----|-----|
| 1 (lowest) | `= += -= *= /= %= &= \|= ^= <<= >>=` | Right | 2 | 1 |
| 2 | `? :` (ternary) | Right | 4 | 3 |
| 3 | `\|\|` | Left | 5 | 6 |
| 4 | `&&` | Left | 7 | 8 |
| 5 | `\|` | Left | 9 | 10 |
| 6 | `^` | Left | 11 | 12 |
| 7 | `&` (binary) | Left | 13 | 14 |
| 8 | `== !=` | Left | 15 | 16 |
| 9 | `< > <= >=` | Left | 17 | 18 |
| 10 | `<< >>` | Left | 19 | 20 |
| 11 | `+ -` | Left | 21 | 22 |
| 12 | `* / %` | Left | 23 | 24 |
| 13 | prefix: `- ! ~ & <T>()` | — | — | 25 |
| 14 (highest) | postfix: `. [] ()` | Left | 27 | — |

**Algorithm sketch:**

```
parseExpression(minBP = 0):
  lhs = parsePrefix()
  while peek() has infix/postfix LBP > minBP:
    if postfix operator:
      lhs = parsePostfix(lhs)
    else:
      op = advance()
      rhs = parseExpression(op.RBP)
      lhs = BinaryExpr(op, lhs, rhs)
  return lhs
```

**Prefix disambiguation:** `<` in prefix position triggers a cast parse
(`<type>(expr)`); in infix position it is less-than. `&` in prefix position is
address-of (unary); in infix position it is bitwise AND. The Pratt algorithm naturally
handles this because prefix and infix are separate code paths invoked from different
positions in the loop.

### 4.10  Error Recovery Strategy

| Context | Sync tokens | Action |
|---------|-------------|--------|
| Top-level | `function`, `interrupt`, `struct`, `enum`, `let`, `const`, `zeropage`, `import`, `export`, `EOF` | Skip tokens; insert `ErrorStmt` spanning skipped region |
| Statement list | `;`, `}`, `if`, `while`, `do`, `for`, `switch`, `return`, `break`, `continue`, `let`, `const` | Skip to sync; if `;`, consume it; insert `ErrorStmt` |
| Expression | `;`, `)`, `]`, `}`, `,` | Insert `ErrorExpr`; stop sub-expression parse |
| Parameter list | `,`, `)` | Insert error parameter with `ErrorType`; skip to sync |
| Struct fields | `;`, `}` | Skip to sync; resume field parsing |
| Enum members | `,`, `}` | Skip to sync; resume member parsing |
| Switch body | `case`, `default`, `}` | Skip to next case/default/end |
| Type position | any non-type token | Insert `ErrorType`; do not consume the unexpected token |

**Cascade suppression:** When the parser inserts an error sentinel, it sets an internal
`panicMode` flag. While this flag is true, diagnostics are recorded internally but
**not added** to the `DiagnosticBag`. The flag is cleared when the parser successfully
consumes a sync-point token, at which point normal diagnostic reporting resumes.

### 4.11  Visitor Pattern

```typescript
interface AstVisitor<R = void> {
  // Source structure
  visitProgram(node: ProgramNode): R;
  visitModuleDecl(node: ModuleDeclNode): R;
  visitImportStmt(node: ImportStmtNode): R;
  // Declarations
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
  // Statements
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
  // Expressions
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
  // Types
  visitPrimitiveType(node: PrimitiveTypeNode): R;
  visitNamedType(node: NamedTypeNode): R;
  visitArrayType(node: ArrayTypeNode): R;
  // Error sentinels
  visitErrorExpr(node: ErrorExprNode): R;
  visitErrorStmt(node: ErrorStmtNode): R;
  visitErrorType(node: ErrorTypeNode): R;
}
```

A default **`walkNode(node, visitor)`** function dispatches on `node.kind`. A
**`walkChildren(node, visitor)`** helper traverses all child nodes of a given node,
enabling simple depth-first walks without manually recursing in every visitor method.

### 4.12  Parser Diagnostic Codes

**Spec-defined codes (parser-relevant):**

| Code | Message | Source |
|------|---------|--------|
| E10001 | Missing `module` declaration | F002 |
| E10002 | Multiple `module` declarations in same file | F002 |
| E10072 | Missing `default` clause in `switch` statement | F009 |

**Parser-defined codes (E103xx band):**

| Code | Message |
|------|---------|
| E10300 | Unexpected token: expected `{expected}`, found `{found}` |
| E10301 | Expected expression |
| E10302 | Expected statement |
| E10303 | Expected type annotation |
| E10304 | Expected identifier |
| E10305 | Missing `;` after `{context}` |
| E10306 | Missing `}` to close `{context}` |
| E10307 | Missing `)` to close `{context}` |
| E10308 | Missing `]` to close `{context}` |
| E10309 | Expected `to` or `downto` in for-loop |
| E10310 | Invalid top-level declaration |
| E10311 | `export` is not allowed on `{context}` |
| E10312 | Expected block `{ ... }` |
| E10313 | Expected `:` after `{context}` |
| E10314 | Missing `=` in const declaration (initialiser required) |
| E10315 | Empty `enum` declaration (at least one member required) |
| E10316 | Empty `struct` declaration (at least one field required) |

### 4.13  Public API

```typescript
/**
 * Parse a token stream into an AST.
 *
 * @param tokens   Token array from lex() (RD-02).
 * @param sourceId Interned source identifier.
 * @param bag      DiagnosticBag for error accumulation.
 * @returns ParseResult — always succeeds; check hasErrors for error state.
 */
function parse(
  tokens: Token[],
  sourceId: SourceId,
  bag: DiagnosticBag,
): ParseResult;

interface ParseResult {
  /** Root AST node — always present, possibly containing error sentinels. */
  ast: ProgramNode;
  /** True if one or more error diagnostics were emitted during parsing. */
  hasErrors: boolean;
}
```

The `parse()` function:

1. Creates a cursor over the token array.
2. Parses the module declaration (R13).
3. Parses top-level items until EOF (R15).
4. Returns `{ ast, hasErrors }` — never throws (R4).

---

## 5. Interactions With Other RDs

| RD | Interface point | Direction |
|----|----------------|-----------|
| RD-01 | Package layout: AST types in `@blend65/core`; parser in `@blend65/frontend`. | Upstream |
| RD-02 | Consumes `Token[]` + `SourceId` from `lex()`. Reuses `Span` and `SourceId` types. | Upstream |
| RD-04 | Produces `ProgramNode` consumed by semantic analysis. Semantic layer traverses AST via the visitor contract. | Downstream |
| RD-05 | SFA reads `FunctionDeclNode`, `CallExprNode`, `LetDeclNode` from AST to build call graph and allocate frames. | Downstream |
| RD-07 | Codegen walks AST (or IL derived from it) using the visitor contract. | Downstream |
| RD-11 | Parser emits diagnostics into `DiagnosticBag` (shared type from `@blend65/core`). Diagnostic codes follow the E103xx band. | Shared |
| RD-14 | Language server re-parses on every edit; the `parse()` API is stateless and reentrant by design. Incremental re-parse is a future optimisation (not in this RD). | Downstream |

---

## 6. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01 | **Grammar coverage**: unit test per grammar production — valid input produces correct AST node shape. |
| AC-02 | **Precedence & associativity**: test suite covering all 14 binding-power levels with mixed operators, verifying correct tree structure. |
| AC-03 | **Right-associativity**: `a = b = c` → `Assign(a, Assign(b, c))`; `a ? b : c ? d : e` → `Cond(a, b, Cond(c, d, e))`. |
| AC-04 | **Error-sentinel insertion**: each error sentinel kind (`ErrorExpr`, `ErrorStmt`, `ErrorType`) has at least one test triggering it. |
| AC-05 | **Sync-point recovery**: for each context in the recovery table (§4.10), a test verifies the parser resumes at the correct token. |
| AC-06 | **Cascade suppression**: test that a single syntax error does not produce more than one diagnostic per erroneous region. |
| AC-07 | **Golden snapshots**: full source files (valid and invalid) are parsed and the serialised AST is compared against committed `.snap` files. |
| AC-08 | **Diagnostic code coverage**: every parser error code (E10001, E10002, E10072, E10300–E10316) has at least one test triggering it. |
| AC-09 | **Contextual keywords**: `to`, `downto`, `step`, `fallthrough` used as identifiers outside their grammatical context parse correctly as `IdentExpr`. |
| AC-10 | **Struct literal disambiguation**: struct literal after `=` parses correctly; `{` after control-flow keyword parses as block. |
| AC-11 | **Minimal program**: `module Main;` alone produces a valid `ProgramNode` with an empty items array. |
| AC-12 | **Export modifier**: all supported declaration types with `export` are tested; `export interrupt` and `export zeropage` produce E10311. |
| AC-13 | **Node kind exhaustiveness**: every `NodeKind` value (50 kinds) is produced by at least one test. |
| AC-14 | **No-throw guarantee**: fuzz test — feed 1,000 random token sequences to `parse()`; it never throws and always returns a `ParseResult`. |
| AC-15 | **Span correctness**: for a set of known source files, every AST node's span extracts the expected source text via `source.slice(span.start, span.end)`. |
| AC-16 | **Determinism**: parsing the same token array twice produces byte-identical serialised ASTs. |
| AC-17 | **Performance**: parsing a 10,000-token file completes in < 250 ms on CI hardware (a super-linear-regression guard, ST-P35). <!-- Amended 2026-07-03: the original 50 ms budget was optimistic for shared GitHub runners (observed 54–58 ms under CPU contention → intermittent CI failures); the parser is ~10–20 ms locally. Raised to 250 ms — >4× headroom over observed CI noise while still tripping on a genuine quadratic blow-up (seconds for 10k tokens). --> |

---

## 7. Open Questions (Surface-During-Authoring Guard)

> **Note (AR-1):** Inline `asm { }` blocks do **not** exist in Blend65 v3 (spec Ch 12 §1).
> The former `AsmBlockNode` / `ASM_BODY` open question has been removed; the `asm_*`
> identifiers are CPU-control *intrinsics* (`IntrinsicCallExprNode`), not asm blocks.

1. **Unsized array `type[]` contexts**: The spec allows unsized array types in restricted
   positions (e.g., parameter types for arrays passed by reference). The exact set of
   valid positions needs confirmation against Ch 02 and Ch 08 to determine whether the
   parser rejects unsized arrays in illegal positions or defers that check to semantic
   analysis (RD-04).
