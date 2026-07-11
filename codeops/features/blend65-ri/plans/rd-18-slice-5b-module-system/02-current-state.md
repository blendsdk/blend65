# Current State: RD-18 Slice 5b — Module System Completion

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> Grounded by three recon agents + one independent challenger (2026-07-10); every
> claim carries a file:line into the working tree at planning time.

## Existing Implementation

### Frontend pipeline (analyze.ts:86-168)

Pass order: `createEmptyModel` → error-delta baseline → `collectDeclarations` →
`collectFunctions(programs, globalScope, bag)` → `collectModuleVariables` →
`resolveImports(programs, moduleScopeByProgram, bag)` → `checkParameterShadowing` →
`checkBodies` (T4) → `typeCheckPrograms` → model construction → `resolveTypes` (no-op
seam) → `postCheck(input, model, callSiteSpans)` → hasErrors delta.
`SemanticModel.initOrder` and `constValues` exist and are ALWAYS empty
(`semantic-model.ts:34-36, 71-72`); `Symbol.constValue?` exists (`symbol.ts:50-51`).

### Module scopes & the dup-module ICE

- One module Scope per Program (file), created unconditionally
  (`function-collection.ts:85-91`); `moduleScopeByProgram` map returned in
  `FunctionTables` (:58-63, :91).
- The duplicate-module-name guard is in `import-resolution.ts:44-64`: E90001
  (`IceCode.Unexpected`) — "Module 'X' is declared in more than one file — merging
  module declarations is not supported yet"; imports naming a collided module are
  skipped (:72-73). Pinned by ONE test: `call-semantics.impl.test.ts:102-114`
  (superseded by this slice).
- `collectModuleVariables` finds the module scope by NODE IDENTITY
  (`module-variable-collection.ts:40-42`: `globalScope.children.find((s) => s.node
  === moduleNode)`) — misses under a shared scope; must consume
  `moduleScopeByProgram` (AR-9).
- FQN derivation reads `fn.scope.node.name` (`model-adapter.ts:204-208`); a merged
  scope keeps the first file's `ModuleDeclNode` as its representative `node` —
  FQNs unchanged (all merged files declare the same name).

### Qualified access today: the silent-poison pipeline

- `Math.add(1,2)` parses as `CallExpr{callee: FieldAccessExpr{object: IdentExpr,
  field}}` (`pratt.ts:492-508`; node `nodes.ts:361-367` — shared with future struct
  field access).
- `typeCall` poisons non-IdentExpr callees with NO diagnostic
  (`expression-typing.ts:236-242`); bare `Math.v` hits the default poison arm
  (:96-99). Downstream, poison suppression (`type-utils.ts:164-167`) means zero
  diagnostics — and lowering silently SKIPS any function containing an error node
  (`lower.ts:146-148` via `hasErrorNode`). **This is the miscompile path the AR-1
  rider closes.**
- Modules are Scopes, NOT Symbols (`SymbolKind` has no "module" — `symbol.ts:21-54`);
  name resolution is a pure innermost-first scope-chain walk
  (`name-resolution.ts:27-33`). A qualified head needs a module-name side lookup.
- Imports alias the SAME Symbol (`import-resolution.ts:99-100`) — everything
  downstream of resolution is symbol-keyed, so one shared resolver unlocks typing,
  edges, and lowering at once (AR-1 rider note in the register).
- IdentExpr-keyed seams needing a qualified arm: `recordCallEdge` consumers
  (`expression-typing.ts:366-388`), SFA `userCalleeOf`/`collectCalls`
  (`model-adapter.ts:117-121`), lowering `canReach`/`collectCallExprs` +
  `lowerUserCall` callee resolution (lower.ts).

### Module variables & initializers

- `collectModuleVariables` collects `LetDecl`→variable / `ConstDecl`→constant with
  `exported`, E10003 duplicates (:44-68) — and IGNORES `item.initialiser` entirely
  ("collected but not executed yet", :10-11). The AST carries initializers:
  `LetDeclNode.initialiser: ExprNode | null` (`nodes.ts:165-173`),
  `ConstDeclNode.initialiser: ExprNode` — required (`nodes.ts:175-183`).
- Pass 3 (`statement-typing.ts:53-67`) iterates ONLY FunctionDecl/InterruptDecl —
  top-level let/const initializers are never typed, never range-checked, silent.
- Storage: `modelToModuleVars` (`model-adapter.ts:169-186`) projects kind
  "variable" only (constants excluded :176) → `layoutModuleVariables` from
  `ramStart` `$2000` (`plan-allocation.ts:96-99`; `dataBase` :163); ACME equates
  only, NO initial values, no zero-fill (`serialize-acme.ts:20-22`,
  `needsBssZero: false` at `instr-program.ts:168`).
- `const-eval.ts` folds literals/unary/binary/lo-hi; identifiers and calls →
  `nonConst` (:38-53) — needs the identifier→constValue extension (AR-7).

### VERIFIED latent hole: module-const references mis-lower

`lowerIdent` (`lower.ts:745-756`) matches module symbols of kind "variable" only
(`moduleVarOf`, :1052-1061 — `sym.kind === "variable"` at :1057); a module-const ref
falls to the frame path where `slotIlType` (:1064-1067) silently defaults the missing
slot to byte → `LDA __frame_<fn>_<CONST>` with a symbol SFA never allocated → ACME
undefined-symbol at `build()`, and NO error at all under `emitAsm`. Closed by AR-7.

### Diagnostic registry state

`diagnostic-codes.ts`: E10191 `AssignToConst` LIVE (:164); **E10192 `ConstWithoutInit`,
E10193 `NonConstInit`, E10194 `CircularInit` minted with ZERO emit sites** (:165-167).
No unknown-module/unknown-member codes exist anywhere (full Ch 14 sweep) — AR-3
reuses E10100/E10012. E90001 `IceCode.Unexpected` (:287).

### Codegen: the dead `initCode` seam & startup

- `ILProgram.initCode: readonly BasicBlock[]` (`cfg.ts:82-91`, doc: "empty in v1");
  producer always `Object.freeze([])` (`lower.ts:155`); consumers: NONE —
  `generateInstr` loops functions only (`instr-program.ts:76-87`), `printIL` ignores
  it (:237 comment), the optimizer passes it through untouched (identity,
  `optimize-il.ts:36`), `lower.spec.test.ts:127` pins it empty (superseded).
- Startup: `c64StyleStartupShim` (`shared-hooks.ts:82-104`) shared by all five
  plugins — `__startup: LDA #$36/STA $01/JSR _main/LDA #$37/STA $01/RTS`
  (terminating), `JMP _main` (non-terminating), NOTHING (bare — AR-12).
  `PreambleOptions.needsDataInit` (`platform-plugin.ts:40`) is derived from constData
  only (`instr-program.ts:164-171`) and ignored by every plugin — NOT repurposed
  (AR-8 amendment); a new additive `hasInitCode` flag is minted instead.
- Streams serialize in array order (`serialize-acme.ts:110-117`); `sanitize`
  reserves `__` for compiler labels (`translate.ts:1121-1132`) — `__init` is
  collision-free; a `{kind:"ret"}` terminator emits RTS (:441-445); word stores via
  `translateStore` STA/STX+1 (:496-507) — all shapes an initializer needs exist.
- `translateFunction`-equivalent reuse: `FunctionTranslator.run()` (:183-214) with
  `prescanAll` + per-block reset — the consume-time wrapper (AR-8) feeds it a
  synthetic ILFunction-shaped record (needs `tempCount` → additive
  `ILProgram.initTempCount`, see 03-03 §2).

### Multi-file entry & fixture pattern

- `CompilerOptions.sourceFiles` tier-1 discovery (`options.ts:22-23`;
  `run-frontend.ts:201-235`); discovery is lexicographically sorted by contract
  (`disk-host.ts:7`) — the AR-5 determinism base. One ProgramNode per file
  (`run-frontend.ts:134-147`).
- slice5a fixture pattern to mirror: `testing/slice5a.ts` (inlined sources +
  `writeFixture` + `buildSlice5a`/`emitAsmSlice5a`), `golden-slice5a.spec.test.ts`
  (assertGolden + `UPDATE_GOLDEN=1` mint), `slice5a.spec.test.ts` (skipIf-gated
  ACME/VICE tiers, `setupEmulator`, `runUntilMemory`/`assertMemory`).

## Gaps Identified

| # | Gap | Current | Required | Owner |
|---|-----|---------|----------|-------|
| 1 | Module merging | E90001 ICE; per-file scopes | one shared scope per name; E10003 dups | 03-01 (AR-9) |
| 2 | Qualified access | silent poison → function-skip | full value surface, resolver + arms, no silence | 03-01 (AR-1/2/3/13) |
| 3 | Initializer typing | never typed | typed like local `let`; call → ICE | 03-02 (AR-4) |
| 4 | Init order | `initOrder` always empty | global per-var graph, two-level order, E10194 | 03-02 (AR-5/6) |
| 5 | Module consts | verified mis-lowering | const-eval + inlining + E10193 | 03-02 + 03-03 (AR-7) |
| 6 | Init execution | `initCode` dead, no consumer | `__init` stream + conditional `JSR __init` | 03-03 (AR-8/12) |
| 7 | Acceptance | no 5b fixture | 3-file fixture + golden + VICE + negatives | 03-04 (AR-10) |

## Dependencies

- **Internal:** 5a's shipped machinery — import resolution (same-Symbol aliasing),
  call graph + `findCallCycles` (Symbol-generic, reused for init cycles), the
  `hasErrors`→skip-`planAllocation` driver gate, `checkDataOverlap`, store-per-arg
  codegen, the slice5a test-harness pattern.
- **External:** none new. ACME + VICE 3.10 locally for the acceptance tier (CI has
  no emulator tier — AR-27 status quo).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Const-eval rabbit-hole (overflow/signedness) | Med | Med | Evaluator scoped to the call-free grammar; every out-of-scope shape → E10193 (AR-7 note); const-const cycles → E10194 via the same Tarjan |
| Init temps have no frame in the AllocationPlan | Low | High | Call-free scalar initializers use the same register/`__zp_tmp` shapes as function bodies; nothing is live across `__init`; if a spike shows spill trouble → STOP, back to the user (AR-8 note — the seam agreement is binding) |
| Golden churn across the six existing goldens | Low | Med | AR-8 conditional emission: initializer-free programs emit nothing new — regression ST pins byte-exactness |
| Shim signature change ripples through 5 plugins | Low | Low | One shared hook (`c64StyleStartupShim`); additive `hasInitCode` flag (AR-8 amendment) |
| Merged-scope node-identity assumptions elsewhere | Low | Med | Recon swept the consumers (module-variable-collection, model-adapter, lowerToIL — merge-tolerant); impl tests witness each |
