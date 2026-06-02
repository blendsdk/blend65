# Requirements: RD-03 Parser & AST

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-03](../../requirements/RD-03-parser-ast.md) · [grammar.ebnf.md](../../spec/grammar.ebnf.md) · spec Ch 02–13

## Feature Overview

Build the **recursive-descent + Pratt parser** for Blend65 and the **AST node model** it
produces. The parser consumes the RD-02 lexer's `Token[]` array and produces a typed,
span-annotated AST (`ProgramNode`) for one source file. The parser **never throws**: it
appends `Diagnostic`s to the shared `DiagnosticBag` and inserts error-sentinel nodes so the
tree is always structurally complete for downstream phases.

AST node interfaces, the visitor contract, the walk helpers, and the `RESERVED_BUILTINS` set
are defined in `@blend65/core` (shared with the language server); the parser itself lives in
`@blend65/frontend`. The grammar is transcribed fully, but the catalogue and parse functions
are grown slice-by-slice across six phases (walking-skeleton, AR-38).

## Functional Requirements

Numbered FR-* below trace to RD-03 §3 (R1–R47), adjusted by the Ambiguity Register (AR-1
removes asm; AR-2 adds the `type` behaviour; AR-3 fixes intrinsics; AR-4 fixes the span type).

### Parsing strategy

- [ ] **FR-1** Recursive descent for source structure, declarations, and statements; Pratt for
  expressions. Every grammar production maps to a parse function. *(R1)*
- [ ] **FR-2** Pratt expression parser implements **14 precedence levels** via binding powers.
  Left-associative by default; right-associative for assignment and conditional. *(R2)*
- [ ] **FR-3** Token stream consumed via a position-index cursor with `peek()`, `advance()`,
  `expect()`, `check()` helpers. The token array is never mutated. *(R3)*

### Error tolerance

- [ ] **FR-4** Parser never throws. All syntax errors appended to the shared `DiagnosticBag`.
  `parse()` always returns a `ParseResult` with a (possibly partial) AST. *(R4, AR-15)*
- [ ] **FR-5** On a syntax error, insert an error-sentinel node (`ErrorExpr`, `ErrorStmt`, or
  `ErrorType`) at the failure point and advance to the next synchronisation point. *(R5)*
- [ ] **FR-6** Synchronisation points are context-specific (§4.10 recovery table). *(R6)*
- [ ] **FR-7** **Cascade suppression**: after inserting a sentinel the parser enters a
  suppressed (`panicMode`) state and withholds further diagnostics until a sync token is
  consumed. *(R7)*

### AST model

- [ ] **FR-8** AST node interfaces are defined in `@blend65/core`; the parser in
  `@blend65/frontend` constructs them. *(R8, AR-5)*
- [ ] **FR-9** Every AST node carries `span: SourceSpan` (`{ sourceId, start, end }`, the
  as-built core type — **AR-4**). Byte offsets into the UTF-8 source. *(R9, AR-4)*
- [ ] **FR-10** AST is a pure data tree: no parent pointers, no methods, no cycles. Each node
  has a string-literal `kind` discriminant for exhaustive `switch`. *(R10)*
- [ ] **FR-11** AST evolution is additive-only: a new node kind = new `kind` value + new
  interface + new visitor case. Existing shapes never change. *(R11)*

### Source structure

- [ ] **FR-12** `ProgramNode` root: one `ModuleDeclNode` + ordered array of top-level items. *(R12)*
- [ ] **FR-13** `ModuleDeclNode`: `module dotted.name;`. **E10001** if missing; **E10002** if a
  second module declaration appears. *(R13)*
- [ ] **FR-14** `ImportStmtNode`: `import { name [, name]* } from dotted.name;`. *(R14)*
- [ ] **FR-15** Valid top-level items: ImportStmt, FunctionDecl, InterruptDecl, StructDecl,
  EnumDecl, LetDecl, ConstDecl, ZeropageBlock. Any other token → **E10310**, recovery to next
  declaration keyword or EOF. *(R15)*

### Declarations

- [ ] **FR-16** `FunctionDeclNode`: optional `export`, `function`, name, `(`params`)`, `:`
  return-type, block body. *(R16)*
- [ ] **FR-17** `ParameterNode`: `name : type`. Comma-separated; no trailing comma; empty list
  allowed. *(R17)*
- [ ] **FR-18** `InterruptDeclNode`: `interrupt function` name `()` block. No params, implicit
  void return. `export` on interrupt → **E10311**. *(R18)*
- [ ] **FR-19** `StructDeclNode`: optional `export`, `struct` Name `{`fields`}`. ≥1
  `StructFieldNode` (`name: type;`). Empty struct → **E10316**. *(R19)*
- [ ] **FR-20** `EnumDeclNode`: optional `export`, `enum` Name `{`members`}`. Comma-separated
  `EnumMemberNode` (`NAME [= constExpr]`). Trailing comma allowed. Empty enum → **E10315**. *(R20)*
- [ ] **FR-21** `LetDeclNode` / `ConstDeclNode`: optional `export`, `let`/`const`, name `:`
  type `[= expr]` `;`. `const` requires initialiser — **E10314** if missing. *(R21)*
- [ ] **FR-22** `ZeropageBlockNode`: `zeropage {`fields`}`. Fields use `name: type [= constExpr];`
  (no `let`/`const`). Stored as `ZeropageFieldNode`. *(R22)*
- [ ] **FR-23** `export` valid only on top-level FunctionDecl, StructDecl, EnumDecl, LetDecl,
  ConstDecl. **E10311** on `export interrupt`, `export zeropage`, or any local `export`. *(R23)*

### Statements

- [ ] **FR-24** `BlockNode`: `{` statement* `}`. May be empty. *(R24)*
- [ ] **FR-25** `IfStmtNode`: `if (`expr`)` block `[else (IfStmt | Block)]`. Braces mandatory.
  `else if` composed (else clause holds an `IfStmt`). *(R25)*
- [ ] **FR-26** `WhileStmtNode`: `while (`expr`)` block. *(R26)*
- [ ] **FR-27** `DoWhileStmtNode`: `do` block `while (`expr`)` `;`. Trailing `;` required —
  **E10305** if missing. *(R27)*
- [ ] **FR-28** `ForStmtNode`: `for ( let` name `:` type `=` init direction bound `[step
  stepExpr] )` block. Direction `to` | `downto`. *(R28)*
- [ ] **FR-29** Contextual keywords `to`, `downto`, `step`, `fallthrough` are lexed as
  `Identifier`; the parser recognises them positionally by text value. They remain usable as
  ordinary identifiers elsewhere. *(R29)*
- [ ] **FR-30** `SwitchStmtNode`: `switch (`expr`)` `{` caseClauses defaultClause `}`. *(R30)*
- [ ] **FR-31** `CaseClauseNode`: `case` expr `[, expr]*` `:` statements. Body runs until next
  `case`, `default`, or `}`. *(R31)*
- [ ] **FR-32** `DefaultClauseNode`: `default :` statements. Mandatory — **E10072** if absent.
  Must be the last clause. *(R32)*
- [ ] **FR-33** `FallthroughStmtNode`: `fallthrough ;` (contextual keyword). Parser accepts it
  in any statement position; restriction to switch bodies is semantic (RD-04). *(R33)*
- [ ] **FR-34** `ReturnStmtNode` (`return [expr];`), `BreakStmtNode` (`break;`),
  `ContinueStmtNode` (`continue;`). *(R34)*
- [ ] **FR-35** `ExpressionStmtNode`: expr `;`. Parser accepts any expression; semantic
  analysis restricts to assignments/calls (RD-04). *(R35)*
- [ ] **FR-36** **`type` reservation (AR-2):** when `KwType` appears where a declaration or
  statement is expected, emit **E10224** ("`type` is reserved for future use") and recover. No
  `type`-declaration syntax/semantics. *(replaces R36 asm-block — AR-1)*

### Expressions

- [ ] **FR-37** `AssignExprNode`: target `op=` expr. 11 operators. Right-associative, lowest
  precedence. Lvalue validation is semantic (RD-04). *(R37)*
- [ ] **FR-38** `ConditionalExprNode`: cond `?` then `:` else. Right-associative, one level
  above assignment. *(R38)*
- [ ] **FR-39** `BinaryExprNode`: 17 operators across 10 left-associative precedence levels. *(R39)*
- [ ] **FR-40** `UnaryExprNode`: prefix `-`, `!`, `~`, `&`. `CastExprNode`: `<type>(expr)`.
  Cast disambiguated from `<` by prefix position. *(R40)*
- [ ] **FR-41** `FieldAccessExprNode` (`.`field), `IndexExprNode` (`[`expr`]`), `CallExprNode`
  (`(`args`)`). Left-associative postfix, highest binding power. *(R41)*
- [ ] **FR-42** Primaries: `IdentExprNode`, `NumericLitExprNode`, `BoolLitExprNode`,
  `StringLitExprNode`, `CharLitExprNode`, parenthesised `(expr)` (no dedicated node — inner
  expr with extended span), `IntrinsicCallExprNode`, `EmbedExprNode`, `StructLitExprNode`. *(R42)*

### Intrinsics & data

- [ ] **FR-43** `IntrinsicCallExprNode` stores the intrinsic **name as a string** + `nameSpan`
  (**AR-3**). The parser identifies an intrinsic by membership in `RESERVED_BUILTINS` (22
  universal names: 13 CPU + 9 memory). `sizeof`/`offsetof` take a type/field argument (parser
  dispatches to type-parsing for the first arg); others take expression args. Arity/type
  validation is RD-04. *(R43, AR-3)*
- [ ] **FR-44** `EmbedExprNode`: `embed(` string-literal `[, identifier]` `)`. *(R44)*
- [ ] **FR-45** `StructLitExprNode`: `{` field `:` expr `, …` `}`. Parsed only in initialiser
  context (after `=`). Disambiguated from block by parse-context. *(R45)*

### Type expressions

- [ ] **FR-46** `PrimitiveTypeNode` (`byte sbyte word sword boolean void`), `NamedTypeNode`
  (identifier), `ArrayTypeNode` (`type[constExpr]` or `type[]`), `ErrorTypeNode`. *(R46)*

### Public API & visitor

- [ ] **FR-47** `parse(tokens, sourceId, bag): ParseResult` where
  `ParseResult = { ast: ProgramNode; hasErrors: boolean }`. Never throws. *(R47)*
- [ ] **FR-48** `@blend65/core` exports the `AstVisitor<R>` interface plus `walkNode` and
  `walkChildren` helpers covering all 50 node kinds. *(R8/§4.11, AR-5)*
- [ ] **FR-49** `@blend65/core` exports `RESERVED_BUILTINS` (22 names) and the `NodeKind` union
  (50 kinds). Both `frontend` and `language-server` consume them without importing `codegen`. *(AR-3, AR-5)*

### Won't Have (Out of Scope)

- Token production (RD-02) · type/scope/semantic checking (RD-04) · SFA (RD-05) · IL/codegen
  (RD-06/07) · diagnostic rendering (RD-11b) · incremental re-parse (RD-14).
- **Inline assembly `asm { }`** — does not exist in Blend65 v3 (spec Ch 12 §1; AR-1).

## Technical Requirements

### Performance

- Parsing a 10,000-token file completes in < 50 ms on CI hardware (AC-17).

### Compatibility

- Consumes the as-built RD-02 `lex()` output (`readonly Token[]`, `SourceId = number`).
- Reuses the frozen `SourceSpan`, `DiagnosticBag`, `DiagCode` from `@blend65/core` (RD-11a).
- Adds parser codes to the **one** core registry by addition; never refactors frozen code (AR-Q2).
- `@blend65/frontend` imports `@blend65/core` only — never `@blend65/codegen` (R15/AR-20).
- `spec/` is never modified (D3).

### Security

- N/A (offline AOT compiler component, no runtime/network/user-auth surface). Input is source
  text already read by `CompilerHost`; the parser only reads the in-memory token array.

## Scope Decisions

| Decision                          | Options Considered                      | Chosen                                  | Rationale                                          | AR Ref |
| --------------------------------- | --------------------------------------- | --------------------------------------- | -------------------------------------------------- | ------ |
| `asm { }` / `AsmBlockNode`        | Remove / amend lexer / keep             | Remove (51→50 nodes) + fix requirements | Contradicts frozen spec Ch 12 §1                   | AR-1   |
| `type` keyword                    | E10224 on use / out of scope            | Emit E10224, no semantics               | Uses reserved code as RD-02 intended               | AR-2   |
| Intrinsic node shape              | Frozen enum / name-string + set         | name string + `RESERVED_BUILTINS` (22)  | Avoids freezing an incorrect/incomplete enum       | AR-3   |
| AST span type                     | RD-03 flat `Span` / core `SourceSpan`   | core `SourceSpan`                       | Matches `Diagnostic.primarySpan`; zero re-wrapping | AR-4   |
| Visitor/walker home               | core / frontend                         | `@blend65/core`                         | Pure data+traversal, shared w/ language-server     | AR-5   |
| Parser diagnostic codes           | core registry / scatter in frontend     | core `diagnostic-codes.ts` (addition)   | One-registry rule; AR-Q2 satisfied                 | AR-6   |
| Commit mode                       | ask / no-commit / auto                  | `--no-commit`                           | User handles git (as RD-02/RD-11a)                 | AR-7   |

## Acceptance Criteria

Trace to RD-03 §6 (AC-01..AC-17), with AC-13 adjusted 51→50 by AR-1.

1. [ ] **AC-01** Grammar coverage: unit test per grammar production — valid input → correct AST node shape.
2. [ ] **AC-02** Precedence & associativity: suite covering all 14 binding-power levels with mixed operators.
3. [ ] **AC-03** Right-associativity: `a = b = c` → `Assign(a, Assign(b, c))`; `a ? b : c ? d : e` → `Cond(a, b, Cond(c, d, e))`.
4. [ ] **AC-04** Error-sentinel insertion: each of `ErrorExpr`, `ErrorStmt`, `ErrorType` has ≥1 triggering test.
5. [ ] **AC-05** Sync-point recovery: each context in §4.10 has a test verifying the resume point.
6. [ ] **AC-06** Cascade suppression: a single syntax error produces ≤1 diagnostic per erroneous region.
7. [ ] **AC-07** Golden snapshots: full source files (valid + invalid) parsed; serialised AST compared to committed `.snap`.
8. [ ] **AC-08** Diagnostic code coverage: every parser code (E10001, E10002, E10072, E10224, E10300–E10316) has ≥1 triggering test.
9. [ ] **AC-09** Contextual keywords: `to`, `downto`, `step`, `fallthrough` used as identifiers outside context parse as `IdentExpr`.
10. [ ] **AC-10** Struct-literal disambiguation: struct literal after `=` parses correctly; `{` after control-flow keyword parses as block.
11. [ ] **AC-11** Minimal program: `module Main;` alone → valid `ProgramNode` with empty items.
12. [ ] **AC-12** Export modifier: every supported decl with `export` tested; `export interrupt`/`export zeropage` → E10311.
13. [ ] **AC-13** Node-kind exhaustiveness: every `NodeKind` value (**50** kinds) produced by ≥1 test. *(AR-1: 51→50)*
14. [ ] **AC-14** No-throw guarantee: fuzz — 1,000 random token sequences to `parse()`; never throws, always returns `ParseResult`.
15. [ ] **AC-15** Span correctness: for known sources, every node's span extracts the expected text via `source.slice(span.start, span.end)`.
16. [ ] **AC-16** Determinism: parsing the same token array twice → byte-identical serialised ASTs.
17. [ ] **AC-17** Performance: parsing a 10,000-token file completes in < 50 ms on CI hardware.
18. [ ] **AC-18** `type` reservation: a program using `type` as a declaration keyword → E10224, and recovery continues. *(AR-2)*
19. [ ] **AC-19** Intrinsics: each of the 22 `RESERVED_BUILTINS` parses as `IntrinsicCallExpr`; `sizeof(T)`/`offsetof(T, f)` capture a type/field arg; a non-reserved callee parses as `CallExpr`. *(AR-3)*
20. [ ] All verification passing (`yarn build && typecheck && lint && test`).
21. [ ] `requirements/RD-03-parser-ast.md` corrected (asm removed); `git status --porcelain spec/` empty.
