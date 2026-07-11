# Parser & AST — Array Literals: RD-18 Slice 7a

> **Document**: 03-01-parser-array-literals.md
> **Parent**: [Index](00-index.md)

## Overview

Adds the ONE missing aggregate parse surface: array-literal expressions (AR-2), with the Ch-08
fill form (AR-3), in initialiser AND assignment-RHS contexts (AR-18). Everything else (struct
decls, enum decls, array types, `a[i]`, `s.f`, struct literals, intrinsic calls) already parses.

## Architecture

### Current
`parsePrimary` (`pratt.ts:255-313`) has no `[` arm → `ExpectedExpression` (`:305`). Struct
literals are gated by the `allowStructLiteral` flag threaded through the Pratt parser, set
`true` only at `parse-decl.ts:316` — **`parseLetDecl` alone**. `parseConstDecl`
(`parse-decl.ts:355`) parses its initialiser via `parsePrimaryExpr` — flag **false** — so const
initialisers cannot take aggregate literals today (verified at preflight, PF-001; the frozen
grammar's `const_expression = expression` says they must). `parseExpressionStmt`
(`parse-stmt.ts:374-386`) parses with the flag `false`.

### Proposed changes
1. **AST**: new node kind `"ArrayLitExpr"` appended to `NODE_KINDS` (`node-kind.ts` — the
   expression group grows 17→18, total 50→51); node shape in `nodes.ts`:

   ```ts
   /** An array literal `[e1, e2, …]` or `[e1, …; fill]` (fill value per Ch 08). */
   export interface ArrayLitExprNode extends AstNode {
     kind: "ArrayLitExpr";
     elements: ExprNode[];
     /** The `; fill` element — fills remaining declared slots. Null when absent. */
     fill: ExprNode | null;
     span: SourceSpan;
   }
   ```

   Wire into `ExprNode` union, the visitor (`visitArrayLitExpr`), and `walkChildren`.
2. **Flag rename**: `allowStructLiteral` → `allowAggregateLit` (internal-only; it now gates both
   literal kinds; doc comments updated — FR-45 disambiguation reasoning unchanged). *(Zero
   semantic impact — exempt from AR back-reference.)*
3. **`parsePrimary` `[` arm** (gated on `allowAggregateLit`): `parseArrayLiteral` —
   `[` → elements: comma-separated `parseExpression(state, 0, true)` (nested aggregate literals
   legal, AR-11 compositionality), optional trailing comma (grammar §6.7 + enum-member
   precedent), optional `; fillExpr` (AR-3 Ch-08 semantics: fill VALUE, count from the declared
   size), `]` closed via `cursor.expect(RBracket, MissingCloseBracket)` (E10308 exists). Empty
   `[]` and pure-fill `[; 0]` both parse (elements=[]) — semantic validation owns rejection.
   Un-gated `[` keeps today's `ExpectedExpression`.
4. **Assignment-RHS contexts** (AR-18): `parseExpressionStmt` parses with `allowAggregateLit:
   true`. A statement-head `Ident { … }` / `[ … ]` then reaches semantics and is rejected there
   with E10157 (AR-26; grammar §5.4 — only calls are valid expression statements) — no parser
   ambiguity (blocks only follow control-flow keywords, R45 reasoning).
5. **`const` initialisers enabled** (PF-001): `parseConstDecl` (`parse-decl.ts:355`) switches
   from `parsePrimaryExpr` to full expression parsing with `allowAggregateLit: true` — same as
   `let` — so `const TABLE: byte[N] = [10, 20, 30; 5];` and const struct literals parse (the
   fixture centerpiece and AC-2 depend on this).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| `[` outside aggregate-literal context | `ExpectedExpression` (unchanged behavior) | AR-2 |
| Unclosed `[1, 2` | E10308 MissingCloseBracket + ErrorExpr recovery | AR-2 |
| `[1; 2; 3]` (second `;`) | E10300 UnexpectedToken at the second `;` | AR-3 |
| Empty `[]` / `[; f]` / count-vs-size problems | parse OK; semantic ownership (03-04) | AR-3, AR-11 |

## Testing Requirements
- Spec tests: ST-1..ST-6b (07-testing-strategy; ST-6a/6b are the const-initialiser forms).
- Impl tests: cursor recovery on malformed literals; golden AST snapshots for the new node;
  50→51 kind-count assertions updated.
