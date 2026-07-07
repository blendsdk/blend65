# RD-18 Slice 4b — Current-State Map

Grounded by three parallel recon agents (2026-07-07). Every claim carries a `file:line` cite. The
headline: **the `switch` front-end is already built; 4b wires semantics + one lowering case.**

## 1. Parser / AST / traversal — COMPLETE (no work)

- **Tokens/keywords**: `KwSwitch`/`KwCase`/`KwDefault`/`KwFallthrough` at
  `packages/core/src/tokens/token-kind.ts:39-42`; mapped `packages/frontend/src/lexer/keyword-map.ts:32-35`.
- **AST** (`packages/core/src/ast/nodes.ts:254-294`):
  - `CaseClauseNode` (`:254`): `values: ExprNode[]` (**multi-value**), `body: StmtNode[]` (flat list, not a `BlockNode`).
  - `DefaultClauseNode` (`:261`): `body: StmtNode[]`.
  - `SwitchStmtNode` (`:267`): `discriminant: ExprNode`, `cases: CaseClauseNode[]`, `defaultClause: DefaultClauseNode` (**non-nullable**).
  - `FallthroughStmtNode` (`:291`): a bare marker (no fields).
  - All in the `StmtNode` union (`:309,313`).
- **NodeKind / visitor / walk**: `node-kind.ts:44-50`, `visitor.ts:98-104`, `walk.ts:276-306`
  (`walkChildren` recurses `SwitchStmt`→discriminant→cases→default; `FallthroughStmt` is a leaf).
- **Parser** (`packages/frontend/src/parser/parse-stmt.ts`): `parseCaseClause:220`,
  `parseDefaultClause:250`, `parseSwitch:279`, `parseFallthrough:360`; dispatched at `:422-423`,
  `:430-431`. **Missing `default` → `E10072 MissingDefaultClause`** + synthesized empty clause
  (`:303-309`) — so `defaultClause` is always present (AR-5).

## 2. Semantics — SKIPPED (build here)

- `type-check/statement-typing.ts`: dispatch is a `switch (stmt.kind)` with 4a arms (`IfStmt:99`,
  `While/DoWhile:112-113`, `For:117`, `Break:120`, `Continue:129`) and a **`default:` arm at
  `:138-141`** ("switch/const/error — out of the 4a surface; skipped, never throws"). **Add
  `case "SwitchStmt":` here** (AR-11).
- `function-collection.ts`: `collectStmtLocals` has a `default:` arm at `:165-168` ("...Switch /
  error — introduce no function-frame local"). **Add a `SwitchStmt` arm** recursing `cases[].body` +
  `defaultClause.body`, mirroring the `IfStmt`/`ForStmt` recursion at `:142-164` (AR-12).
- `break` legality is keyed on `loopDepth` (4a); switch does **not** raise it (AR-6) — no change.

## 3. Diagnostic codes (`packages/core/src/diagnostics/diagnostic-codes.ts`)

- **E10072 = `MissingDefaultClause`** (`:102`) — parser-owned (RD-03), the "collision" (AR-4/AR-5).
- **E10132 = `DuplicateCaseValue`** (`:106`), **E10133 = `NonExhaustiveSwitch`** (`:107`) —
  registered but **unemitted**. 4b **wires E10132**; E10133 stays deferred (AR-2/AR-7).
- **E10130 = `BreakOutsideLoopSwitch`** (`:104`) — already used by 4a for loops; unchanged (AR-6).
- **Free in the switch band (E10070–E10079):** E10070, E10071, E10073, E10074, E10075, E10076,
  E10077, E10078, E10079. 4b **mints E10077 `CaseValueTypeMismatch`** (AR-4) and wires the
  semantics behind E10071/E10073/E10074/E10075/E10076 (spec-numbered, added to the registry at this
  gate where absent — additive, AR-11/AR-115).
- **E10134 is taken** (`NonBooleanCondition`, 4a) — do **not** reuse for fallthrough (AR-3).

## 4. IL lowering — ICEs (add one case)

- `lower.ts` `lowerStmt` dispatch `:201-235`; **`default: iceUnsupported(...)` at `:234-235`** fires
  `E90001` for `SwitchStmt` **and** `FallthroughStmt` today.
- Pattern to follow — the 4a keystone: `lowerIf:267`, `lowerWhile:296`, `lowerFor:350`, using the
  `LoopContext` struct (`:105`) + `LowerCtx` stack (`:123`) and the `IlFunctionBuilder` API
  (`builder.ts`): `reserveLabel():77`, `terminate():97`, `isTerminated():102`, `openBlock():112`.
- **Add `lowerSwitch`** (AR-1/AR-8/AR-9): lower the discriminant once; per case value emit an `eq`
  compare + `brcond`; reserve one body block per clause + a join block; terminate bodies `br(join)`
  or `br(next body)` for `fallthrough`. `break`/`continue` inside resolve to the enclosing
  `LoopContext` (AR-6) — switch pushes nothing.

## 5. IL→Instr translate — SUFFICIENT (no work)

- `instruction.ts:156-165` — terminator set is `br`/`brcond`/`ret`/`unreachable`; **no jump-table
  terminator**, and none is needed for the compare-chain (AR-1).
- `translate.ts` `run():176` already loops all `fn.blocks` (`:181`) and dispatches terminators
  `:366-382` (`ret:368`, `br:374`, `brcond:377`, `unreachable:382`). A compare-chain switch needs
  **zero** new translate work. The `eq` comparison it emits is handled by the (now DEF-1-corrected)
  `translateComparison` — dispatch correctness depends on that 4a fix (AR-13).

## 6. Current "unsupported" fixture

`packages/codegen/src/il/test-fixtures.ts:271-277`: `unsupportedFixture` wraps a `main` whose body is
`[fallthroughStmt()]` — the designated still-unsupported statement. Once 4b lowers `switch`, a bare
top-level `fallthrough` (outside any switch) remains a parser/semantic error; the codegen "still
unsupported" fixture must be repointed to a genuinely-unsupported node (e.g. a Slice-5+ construct) —
tracked as a task in Phase 2.

## 7. Summary

| Stage | File | Status |
|---|---|---|
| Parser/AST/visitor/walk | `nodes.ts:254-294`, `parse-stmt.ts:220-431`, `walk.ts:276-306` | ✅ built |
| Semantic typing | `type-check/statement-typing.ts:138` (skipped) | ❌ add `case "SwitchStmt"` |
| Case-body locals | `function-collection.ts:165` (skipped) | ❌ add `SwitchStmt` arm |
| Codes E10132 (dup) / E10077 (type) | `diagnostic-codes.ts:106`, band free | ⚠️ wire E10132; mint E10077 |
| Codes E10133 (exhaustive) | `diagnostic-codes.ts:107` | ⏸️ defer → Slice 7 (AR-2) |
| IL lowering | `lower.ts:234` (ICE) | ❌ add `lowerSwitch` |
| IL terminators | `instruction.ts:156-165` | ✅ br/brcond suffice |
| Instr translate | `translate.ts:366-382` | ✅ no work |
| Unsupported fixture | `il/test-fixtures.ts:271-277` | 🔁 repoint off `fallthrough` |
