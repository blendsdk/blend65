# RD-18 Slice 4a — Current State

> Grounded map from four parallel recon agents (2026-07-06). Every claim carries a `file:line`.
> **CodeOps Skills Version**: 3.2.0

## 1. Parser / AST — complete (nothing stubbed)

- Kinds: `packages/core/src/ast/node-kind.ts` (single source of truth). Node interfaces:
  `packages/core/src/ast/nodes.ts`. `SourceSpan = { sourceId, start, end }`
  (`source-span.ts:30`, byte offsets, start-inclusive/end-exclusive).
- Nodes + parsers (all wired into `parseStatement`, `parse-stmt.ts:406-445`):

  | Construct | Node / kind | nodes.ts | Fields | Parser |
  |-----------|-------------|----------|--------|--------|
  | if/else | `IfStmtNode` / `"IfStmt"` | :219 | `condition:ExprNode`, `thenBlock:BlockNode`, `elseClause:IfStmtNode\|BlockNode\|null` | `parseIf` :84 |
  | while | `WhileStmtNode` / `"WhileStmt"` | :228 | `condition:ExprNode`, `body:BlockNode` | `parseWhile` :116 |
  | do-while | `DoWhileStmtNode` / `"DoWhileStmt"` | :235 | `body:BlockNode`, `condition:ExprNode` | `parseDoWhile` :132 |
  | for | `ForStmtNode` / `"ForStmt"` | :242 | `varName:string`, `varNameSpan`, `varType:TypeNode\|null`, `init:ExprNode`, `direction:"to"\|"downto"`, `bound:ExprNode`, `step:ExprNode\|null`, `body:BlockNode` | `parseFor` :160 |
  | break | `BreakStmtNode` / `"BreakStmt"` | :282 | (none) | `parseBreak` :336 |
  | continue | `ContinueStmtNode` / `"ContinueStmt"` | :287 | (none) | `parseContinue` :346 |
  | block | `BlockNode` / `"Block"` | :213 | `statements:StmtNode[]` | `parseBlock` :58 |

- **`ForStmtNode.direction` is only `"to" | "downto"`** — `until` is a parse error (E10309,
  `parse-stmt.ts:191`). The counter is stored **inline** (no child `LetDeclNode`); the `let` keyword
  is consumed and discarded (`parse-stmt.ts:164`). `varNameSpan` (`nodes.ts:245`) is available for
  a counter-specific diagnostic.
- Spans: each node's `.span` runs keyword→body-end; child exprs/blocks (`condition`, `bound`, `init`,
  `step`, `thenBlock`, `body`) carry their own spans. No dedicated `else`/`while`-keyword spans.
- `if`/`while`/`do`/`for` bodies are typed `BlockNode` (braces always present, CF-1). `else if` is a
  chained `IfStmtNode` in `elseClause` (`parse-stmt.ts:94-105`).

## 2. Semantics — nothing for control flow

- `type-check/statement-typing.ts:65-86` — `typeStmt` handles `LetDecl`/`ExpressionStmt`/`ReturnStmt`/
  `Block` (Block reuses the enclosing scope). **`IfStmt`/`WhileStmt`/`ForStmt`/`DoWhileStmt`/`BreakStmt`/
  `ContinueStmt` hit the `default` no-op** (`:81-85`) — not typed, bodies not visited, no diagnostic.
- `function-collection.ts:60-125` — builds **module** scope (per program) + **function** body scope
  only; locals are a **flat top-level scan** of `body.statements` (`:107-120`). **No nested block
  scopes, no for-counter.** `Scope` model has `kind: "global"|"module"|"function"|"block"`
  (`scope.ts:19`) — the `"block"` kind exists but is never created; `parent`/`children`/`symbols`/
  `node` all present (`scope.ts:22-32`); `createScope(kind,parent,node)` (`scope.ts:44`).
- No condition typing / boolean check anywhere. No loop-context tracking (no depth counter/stack).
- `post-check.ts:25-66` (`checkMainValidity`) does only E10020/E10021/E10022 — **no all-paths-return**.
  `typeReturn` (`statement-typing.ts:109-129`) does only E10173 (void returns value).
- **Registered but unused:** `BreakOutsideLoopSwitch:"E10130"`, `ContinueOutsideLoop:"E10131"`
  (`diagnostic-codes.ts:97-98`); grep finds only the definitions, no call sites.
- Pipeline (`analyze.ts:76-138`): `collectDeclarations → collectFunctions → collectModuleVariables →
  checkBodies → typeCheckPrograms → resolveTypes(no-op) → postCheck`. Slice-4a logic slots into
  `function-collection` (scopes/for-counter), `typeCheckPrograms` (condition/body/loop-context), and
  `postCheck` (all-paths-return).

## 3. Diagnostic-code registry — follows Ch 14

- `diagnostic-codes.ts` = `const DiagCode = { ... } as const` (`:20`); PascalCase key → `E10xxx`;
  grouped by `//` section headers; additively-minted codes carry a multi-line provenance comment
  (see `ValueOutOfRange E10084` `:123-128`, `InvalidMainSignature E10022` `:36-42`).
- Control-flow group (`:92-100`): `MissingDefaultClause:"E10072"` (parser-raised),
  `ForEndBoundOutOfRange:"E10064"`, `BreakOutsideLoopSwitch:"E10130"`, `ContinueOutsideLoop:"E10131"`,
  `DuplicateCaseValue:"E10132"`, `NonExhaustiveSwitch:"E10133"`.
- Functions group (`:85-91`): `MissingReturnValue:"E10172"` (return-without-value, **≠** all-paths),
  `VoidFunctionReturnsValue:"E10173"`, `RecursionDetected:"E10174"`.
- **Free codes** (verified 2026-07-06): **E10061**, **E10102**, **E10134** all unused (0 occurrences).
- Uniqueness guard: `diagnostic-codes.impl.test.ts:25-28` (no duplicate values) + `:19-23`
  (`/^[EW]10\d{3}$/` shape). Emit API: `bag.addError(code, span|null, message, options?)`
  (`diagnostic-bag.ts:41-46`); dedup key `(code, sourceId, start)` (`:89-93`).

## 4. Codegen — scaffolding ready, wiring absent

- **Types ready:** `br`/`brcond`/`ret`/`unreachable` terminators (`instruction.ts:156-165`);
  `BasicBlock{label,instructions,terminator}` + multi-block `ILFunction{blocks,…}` (`cfg.ts:27-56`,
  `blocks[0]` = `_entry`). No edge/pred/succ types (not needed).
- **Builder ready:** `IlFunctionBuilder.reserveLabel()` (`builder.ts:77`, mints `_L0`,`_L1`…),
  `openBlock(label)` (`:112`), `terminate(term)` (`:97`), `isTerminated()` (`:102`). **Unused by
  lowering** (grep: zero `openBlock`/`reserveLabel` in `lower.ts`).
- **Gap 1 — `lower.ts`:** `lowerStmt` switch (`:181-199`) handles `Block`/`LetDecl`/`ExpressionStmt`/
  `ReturnStmt`; **`if`/`while`/`do-while`/`for`/`break`/`continue` all fall to `default` →
  `iceUnsupported`** (`:196-197`, records an ICE + poison, does **not** throw). `lowerFunction`
  (`:146-171`) builds one block, closes with a fallback `ret` (`:170`). `lowerReturn` (`:212-219`)
  is the only terminator-setter today.
- **Gap 2 — `translate.ts`:** `run()` reads only `this.fn.blocks[0]` (`:173`) — blocks `[1..]`
  ignored. `translateTerminator` (`:304-314`) handles only `ret`; `br`/`brcond`/`unreachable` ICE at
  `:305-306`. Op dispatch default (deferred-ops marker) at `:258`.
- **Reusable branch pattern:** `translateComparison` (`:600-630`) already mints local labels
  (`` `_cmp${this.cmpCounter++}` ``, `:619`), emits `BEQ/BNE/BCC/BCS` via `emit(branch,"Relative",
  labelRef(done))` (`:613-621`), and pushes `label(done)` into the stream (`:623`). `label()`/
  `labelRef()` from `@blend65/core/platform` (`stream.ts:20`); rendering complete in
  `print-instr.ts:197-198` (label→`name:`, 0 bytes). Function-entry label via `sanitize(fn.name)`
  (`translate.ts:171`, `:942-947`).
- **Today the IL is a single linear `_entry` block per function** (`translate.ts:1-4`,
  `lower.ts:145`). Slice 4a introduces genuine multi-block functions — the keystone.

## 5. Const-eval (3b) — reusable as-is (AR-10)

- `evalConst(expr)` (`const-eval.ts:38`) → `{value:number|boolean} | {divByZero,span} | {nonConst}`;
  folds `NumericLit`/`BoolLit`/unary `±`/binary `+ - * / %`/`lo`/`hi`; bitwise/shift/comparison →
  `nonConst` (`:92`). Sufficient for for-bound + `step` integer constants; no extension needed for 4a.
