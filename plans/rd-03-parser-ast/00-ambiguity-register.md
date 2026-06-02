# RD-03 Parser & AST — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED — all 7 items resolved (planning)
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

---

## Surface-during-authoring rule

If authoring or implementation surfaces a *new* ambiguity, **STOP**, add it here as the
next `AR-N` (tagged `(runtime)` if found during execution), resolve it with the user,
back-propagate the resolution into the affected plan documents, then resume. Do not fill
gaps by guessing.
