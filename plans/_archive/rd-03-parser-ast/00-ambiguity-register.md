# RD-03 Parser & AST — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED — all 9 items resolved (7 planning + AR-8, AR-9 runtime)
> **Last Updated**: 2026-06-02

> **Purpose**: Plan-level Zero-Ambiguity Gate. Every decision in the RD-03 plan that is
> *not* already fixed by the frozen `spec/` or by `requirements/RD-03-parser-ast.md` is
> recorded here, with its resolution, before any document or code depends on it.

## Scope of this register

`requirements/RD-03-parser-ast.md` was authored **2026-05-31**, *before* the RD-11a
diagnostics core and RD-02 lexer were actually built and frozen (2026-06-02). Several
illustrative type signatures in RD-03 therefore predate — and do not match — the as-built
`@blend65/core` / `@blend65/frontend` API, and one feature (`asm { }` blocks) directly
**contradicts** the frozen spec. The entries below (`AR-1`..`AR-7`) reconcile RD-03's
intent with the **frozen** spec and the as-built code, so that:

- the frozen `spec/` is never touched (decision D3), and
- the frozen RD-11a / RD-02 code is **extended, never refactored** (AR-Q2).

All seven were reviewed with the user and confirmed before authoring.

---

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| AR-1 | Feature gap | RD-03 R36/§4.5 define an `AsmBlockNode` for `asm { … }`, but the frozen spec says inline asm does not exist. | A: remove `AsmBlockNode` + fix requirements doc · B: amend lexer to add `ASM_BODY` · C: other | **A** — remove the node *and* edit `requirements/RD-03-parser-ast.md` | ✅ Resolved |
| AR-2 | Behavioral | `type` is reserved; RD-03 §4.12 omits E10224. What does the parser do with `type`? | A: parser emits E10224 on `KwType` in decl/stmt position, no semantics · B: out of scope | **A** | ✅ Resolved |
| AR-3 | Technical / Data | RD-03 R43 `IntrinsicKind` union is wrong-count (says 28, lists 12; spec has 22 universal). | A: store intrinsic name as string + span, RD-04 validates · B: hard-enumerate corrected union | **B-as-A hybrid** — "fix the kind and make it complete" → store the name as a string **and** ship a complete, spec-derived name set/guard | ✅ Resolved |
| AR-4 | Integration | RD-03 illustrates `Span = { start, end, source }`; frozen core ships `SourceSpan = { sourceId, start, end }`. | A: embed as-built `SourceSpan` as `node.span` · B: keep RD-03's flat shape | **A** — "check with the diagnostics implementation and handle accordingly" → use core `SourceSpan` | ✅ Resolved |
| AR-5 | Technical | Where do the `AstVisitor` interface and `walkNode`/`walkChildren` helpers live? | A: in `@blend65/core` with the node types · B: in `@blend65/frontend` | **A** | ✅ Resolved |
| AR-6 | Technical | Where are parser diagnostic codes declared? | A: add to core `diagnostic-codes.ts` by addition · B: scatter in frontend | **A** (consistent with RD-02 AR-L5) | ✅ Resolved |
| AR-7 | Process | Commit mode for execution. | ask / no-commit / auto-commit | **no-commit** | ✅ Resolved |
| AR-8 (runtime) | Integration | The parser must populate string fields (`ModuleDecl.name`, `ImportStmt.symbols[].name`, `IdentExpr.name`, …), but the frozen RD-02 `Token` stores **no lexeme text** (only `span`; identifier/keyword `value` is `undefined`) and the documented `parse(tokens, sourceId, bag)` signature passes **no source text**. How does the parser recover identifier lexemes? | A: add a `source: string` parameter — `parse(tokens, source, sourceId, bag)` — and slice lexemes via `source.slice(span.start, span.end)` (matches the Token design note; caller already holds the source) · B: pass a context object `{ tokens, source, sourceId, bag }` · C: have the lexer store identifier text in `Token.value` (refactors frozen RD-02 — **violates AR-Q2/D-freeze**) · D: a `getLexeme(span)` callback | **B (refined)** — `parse(input: ParseInput)` where `ParseInput = { tokens, source, sourceId, bag }`; lexeme resolution **encapsulated in one `cursor.lexeme(token)` site**. Lexer stays frozen (C rejected). | ✅ Resolved |
| AR-9 (runtime) | Data / AST gap | Spec Ch03 §2.3 + FR-22 + ST-P19 give a `zeropage` field an **optional** initialiser (`name: type [= constExpr];`), and RD-03 §4.4's reference `ZeropageFieldNode` includes `initialiser: ExprNode \| null`. But the as-built Phase-1 core `ZeropageFieldNode` **omitted** the `initialiser` slot, so the parser could not store `q: byte = 0`. | A: add `initialiser: ExprNode \| null` to `ZeropageFieldNode` (additive, FR-11; matches spec/FR-22/RD-03 §4.4/ST-P19; uninitialised = `null` = zero startup code per §5.1/§6.3) · B: drop zeropage-initialiser syntax (contradicts the frozen spec grammar) | **A** — additive core fix. User confirmed the *uninitialised* case (`tempPtr: word;`) emits no startup code (developer's responsibility); the optional `= value` is still spec-legal and, when present, is captured by the parser and lowered by RD-07+. | ✅ Resolved |



---


## Resolution Notes

### AR-1 — `asm { }` / `AsmBlockNode` does not exist in Blend65 v3

**Frozen-spec evidence (authoritative, D3):**

- `spec/12-intrinsics.md` §1, verbatim: *"There are **no `asm { }` blocks** in Blend65 v3.
  The curated intrinsic set covers all game development needs without the compiler
  complexity of embedded assembly (→ F012 design rationale)."*
- `spec/01-lexical-structure.md` §5.3: the `asm_sei … asm_brk` names are reserved built-in
  **identifiers** (CPU intrinsics), *"not keywords — the lexer produces `IDENTIFIER` tokens
  for them."* There is no `asm` keyword.
- `spec/grammar.ebnf.md`: no asm-block production exists (85 productions, none for asm).
- As-built RD-02 lexer (`token-kind.ts`): no `AsmBody`/`ASM_BODY` token kind, no `KwAsm`.

**Decision:** `AsmBlockNode` is an error in the RD-03 *requirements* document (it leaked in
from a generic systems-language template). It is **removed** from the RD-03 implemented
catalogue:

- `NodeKind` count: **51 → 50**. Statement-node count: **14 → 13**.
- Remove R36, the `"AsmBlock"` `NodeKind` member, the `AsmBlockNode` interface (§4.5), its
  entry in the `StmtNode` union, `visitAsmBlock` from the visitor, and the `asm` sync-token
  row from the §4.10 statement-recovery table.
- AC-13 ("every `NodeKind` produced") updates 51 → 50.

**No functionality is lost:** the real feature — parameterless CPU intrinsics `asm_sei()` …
`asm_brk()` — are ordinary `IntrinsicCallExpr` nodes (AR-3), tokenized as `Identifier`.

**Requirements-doc edit (per user "do both"):** `requirements/RD-03-parser-ast.md` is **not
frozen** (only `spec/` is, D3). It is corrected to delete every asm-block reference (R36,
§4.2 catalogue, §4.5 interface + `StmtNode` union, §4.11 `visitAsmBlock`, §4.10 `asm`
recovery row, and §7 Open-Question #1), keeping the requirement consistent with the spec.

### AR-2 — `type` keyword → E10224 (Option A)

`type` is **already a keyword** in the frozen RD-02 lexer: `KEYWORD_MAP` maps `"type" →
TokenKind.KwType`, and `keyword-map.ts` states verbatim: *"`type` maps to `KwType`; the
lexer emits the token and the **parser** later raises E10224 — the lexer never does."*

**Decision:** When the parser encounters a `KwType` token where a declaration or statement
is expected, it emits **E10224** (message: *"`type` is reserved for future use"*) and
recovers to the next sync point. No `type`-declaration syntax or semantics is implemented —
this *is* the reservation. E10224 already exists in the core registry (added by RD-02), so
**no new registry entry** is needed for it.

### AR-3 — Intrinsic representation: name-as-string + complete spec-derived guard

User instruction: *"fix the kind and make it complete."* RD-03's frozen `IntrinsicKind`
union is both wrong-count and incomplete. The complete **universal** built-in set from
`spec/12-intrinsics.md` is:

- **CPU control (13):** `asm_sei asm_cli asm_pha asm_pla asm_php asm_plp asm_clc asm_sec
  asm_cld asm_sed asm_clv asm_nop asm_brk`
- **Memory (9):** `peek poke peekw pokew lo hi sizeof offsetof length`

= **22 universal reserved built-ins**. (Platform encoders like `petscii()` are *not*
universal — they live in platform profiles, Ch 15 — so they are out of the core parser's
fixed set; an unknown callee name simply parses as a normal `CallExpr` and RD-04 resolves
it.)

**Decision:** `IntrinsicCallExprNode` stores the intrinsic **name as a `string`** plus
`nameSpan` (not a brittle frozen enum literal on the node). The parser recognises an
intrinsic by membership in a **complete, spec-derived** reserved-built-in name set
(`RESERVED_BUILTINS`, 22 names) exported from `@blend65/core`. `sizeof` and `offsetof`
take a type/field argument (the parser dispatches to type-parsing for the first argument);
all others take expression arguments. Arity and type validation is RD-04's job. This
satisfies "complete" (all 22 names) without freezing an incorrect union, and stays additive.

### AR-4 — AST node span is the as-built core `SourceSpan`

Verified against `packages/core/src/diagnostics/diagnostic.ts`: `Diagnostic.primarySpan:
SourceSpan | null`, and the bag's `add*` methods take a `SourceSpan = { readonly sourceId:
SourceId; readonly start: number; readonly end: number }` with `SourceId = number`.

**Decision:** Every AST node embeds the core `SourceSpan` as `node.span`; all sub-spans
(`nameSpan`, `fieldSpan`, `modulePathSpan`, …) are also `SourceSpan`. A node drops directly
into `bag.addError(code, node.span, …)` with zero re-wrapping — consistent with the one
span model the whole compiler shares (mirrors RD-02 AR-L3). RD-03's illustrative
`Span = { start, end, source }` is treated as superseded illustration, not contract.

### AR-5 — Visitor/walker home is `@blend65/core`

The AST node interfaces, the `AstVisitor<R>` interface, and the `walkNode(node, visitor)` /
`walkChildren(node, visitor)` helpers all live in `@blend65/core` (a new `ast/` module).
They are pure data + traversal, shared by `frontend` and `language-server` (which must
never import `codegen`, R15/AR-20). The parser *logic* (`parse()`, the token cursor, the
Pratt engine, all parse functions) lives in `@blend65/frontend`. Mirrors RD-02 AR-L4's
data-vs-logic split.

### AR-6 — Parser diagnostic codes added to the one core registry

The parser-band codes are added by **addition** to
`packages/core/src/diagnostics/diagnostic-codes.ts`:

- **Spec-defined:** `E10001` (missing module decl), `E10002` (multiple module decls),
  `E10072` (missing `default` clause).
- **Parser band E103xx:** `E10300`–`E10316` (17 codes, per RD-03 §4.12).
- `E10224` already exists (RD-02 AR-L5) — reused, not re-added.

Adding members is **extending**, not refactoring (AR-Q2 satisfied). The existing RD-11a /
RD-02 entries are unchanged. If any of E10001/E10002/E10072 already exist in the registry,
they are reused as-is (verified during Phase 1).

### AR-7 — Commit mode: `--no-commit`

The agent implements, verifies, and updates the execution plan, but performs **no** git
operations. The user handles all commits. Identical to RD-02 / RD-11a.

### AR-8 (runtime) — Parser input is a `ParseInput` object; lexemes resolved once in the cursor

**Surfaced during Phase 2** (parser skeleton). The frozen RD-02 `Token`
(`packages/core/src/tokens/token.ts`) stores **no lexeme text** — only `kind`, `span`, and a
`value` that is `undefined` for identifiers and keywords. Its doc states the lexeme is
*"recovered lazily from the source via `text.slice(token.span.start, token.span.end)`."* But
the RD-03-illustrated `parse(tokens, sourceId, bag)` signature threads **no source text**, so
the parser could not populate `ModuleDecl.name`, `ImportStmt.symbols[].name`, `IdentExpr.name`,
`NamedType.name`, struct/enum/field/parameter names, etc.

**Options weighed (no shortcuts):**

- **C — store identifier text in `Token.value`:** rejected. It refactors the **frozen** RD-02
  lexer (violates AR-Q2/D3), churns the committed golden token snapshots, and regresses the
  deliberate allocation-free token design (RD-02 AR-L3, spec Ch 01 §11.4) by allocating a
  string per identifier *and* per keyword. It helps only the parser — every later phase
  (RD-04 semantic, RD-05 SFA, RD-06 optimiser, RD-07 codegen, RD-14 LSP) consumes the **AST**
  (which already carries resolved name strings), never the token stream.
- **A — bare positional `source` param:** works and keeps the lexer frozen, but places
  `source: string` next to `sourceId: number` (mis-order risk) and scatters raw
  `source.slice(...)` across ~30 parse functions (no single source of truth), and forces a
  breaking signature change the moment a later phase needs to thread more in.
- **D — `getLexeme` callback:** indirection with no benefit over owning the source directly.

**Decision (B, refined):** `parse(input: ParseInput)` where
`ParseInput = { tokens: readonly Token[]; source: string; sourceId: SourceId; bag: DiagnosticBag }`.
Lexeme resolution is **encapsulated in exactly one site** — `cursor.lexeme(token): string`
(the only place that calls `source.slice(span.start, span.end)`) — and every AST string field
is filled through it.

**Why this is the best, future-proof choice:**

- **Lexer stays frozen** (D3/AR-Q2 honoured); golden token snapshots untouched.
- **Zero current breakage:** `parse()` has no callers yet (verified by grep across `packages`),
  so adopting the object signature costs nothing now; the Phase-2 tests are authored fresh
  against it.
- **Future phases protected (F1-Extensible):** RD-15 (programmatic CLI `compile()`) and RD-14
  (language-server: incremental re-parse, `lineMap`, parse options, cancellation) extend
  `ParseInput` with **optional** fields — no breaking signature change ever.
- **One tested slicing site:** future changes (interning, encoding) touch `cursor.lexeme()`
  only. If global identifier interning is ever wanted, it belongs in the **RD-04 symbol
  table** (keyed off AST names), not the lexer.

**Back-propagated into:** `03-02-parser-algorithm.md` (`parse()` signature + `ParseInput` +
cursor `lexeme()`), `07-testing-strategy.md` (ST-P4/P5 construct a `ParseInput`), and this
register.

### AR-9 (runtime) — `ZeropageFieldNode` gains the spec-mandated optional initialiser

**Surfaced during Phase 3** (declarations). The frozen spec is unambiguous that a zeropage
variable's initialiser is **optional**:

- `spec/03-variables.md` §2.3 grammar: `zeropage_var = identifier , ":" , type_expr ,
  [ "=" , expression ] , ";"` — the example mixes `playerX: byte = 160;` with `tempPtr: word;`.
- §5.1/§5.2/§6.3: an **uninitialised** variable (`let x: byte;` / `tempPtr: word;`) generates
  **no startup code** (0 bytes, 0 cycles) — its memory keeps whatever was there. Initialisation
  of an uninitialised ZP var is therefore the developer's responsibility (user-confirmed).
- `FR-22`, `requirements/RD-03-parser-ast.md` §4.4 (`initialiser: ExprNode | null`), and
  `ST-P19` (`zeropage { p: word; q: byte = 0; }`) all require the parser to capture it.

But the Phase-1 core `ZeropageFieldNode` (`packages/core/src/ast/nodes.ts`) omitted the slot,
carrying only `name`, `nameSpan`, `fieldType`.

**Decision (A — additive core fix):** add `initialiser: ExprNode | null` to
`ZeropageFieldNode`. This is FR-11-compliant additive evolution (a new optional field; no
existing shape changes) with **zero consumers** to break — only the node-kind *name* test
referenced the kind, never its shape. `walkChildren` now visits the optional initialiser.
"Uninitialised" is represented as `initialiser: null`, which RD-07+ lowers to **no** startup
store — exactly the zero-cost behaviour the spec and the user describe. Rejected B (dropping
the syntax) as a direct contradiction of the frozen grammar.

**Back-propagated into:** `packages/core/src/ast/nodes.ts` (field added), `…/ast/walk.ts`
(initialiser traversal), and this register. (RD-03 §4.4 and FR-22 already specified it.)

---


## Surface-during-authoring rule

If authoring or implementation surfaces a *new* ambiguity, **STOP**, add it here as the
next `AR-N` (tagged `(runtime)` if found during execution), resolve it with the user,
back-propagate the resolution into the affected plan documents, then resume. Do not fill
gaps by guessing.
