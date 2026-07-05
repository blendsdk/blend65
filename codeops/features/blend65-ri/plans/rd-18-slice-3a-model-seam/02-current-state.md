# Current State: RD-18 Slice 3a — Model-Seam Proof

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The pipeline is a walking skeleton at slice 2: **every stage below the `modelToFunctionInfo` seam is
fully implemented and exercised**, and the seam itself is the sole stub. Verified end-to-end during
Phase 1 reconnaissance.

**Upstream — the semantic model is empty by construction.** `analyze()`
(`packages/frontend/src/semantics/analyze.ts:69-92`) runs Pass 1 (struct/enum declaration collection,
RD-17) and Pass 3 (intrinsic validation, RD-17), then assembles the model by spreading
`createEmptyModel()` and overriding only `structTypes`/`enumTypes`/`hasErrors`:

```ts
const model: SemanticModel = {
  ...createEmptyModel(),
  structTypes: tables.structTypes,
  enumTypes: tables.enumTypes,
  hasErrors: analyzerRecordedError,
};
```

`callGraph`, `symbolMap`, `typeMap`, and `mainFunction` are **never populated** (they stay at
`emptyCallGraph()` / empty maps / `null`). Pass 2 (`resolveTypes`) and Pass 4 (`postCheck`) are no-op
deferred seams (`passes.ts:42-44, 83-85`).

**The seam — returns `[]`.** `modelToFunctionInfo` (`packages/frontend/src/sfa/model-adapter.ts:34-36`)
returns `[]` unconditionally: with no function symbols in `callGraph.functions`, there is nothing to
project.

**Downstream — all real.** The compiler already calls the seam in the live pipeline
(`packages/compiler/src/api/run-frontend.ts:155-164`):

```ts
const allocationPlan = planAllocation(
  { functions: modelToFunctionInfo(semanticModel), moduleVars: [], zpUserVars: [], upstreamErrors: bag.hasErrors() },
  DEFAULT_PROFILE, bag,
);
```

`planAllocation` (`packages/frontend/src/sfa/plan-allocation.ts:83-190`) runs the full 9-step
allocation, and `generateSymbolDefinitions` (`packages/frontend/src/sfa/symbols.ts:55-89`) emits
`__frame_<fqName>` (base = `absoluteAddress`) + `__frame_<fqName>_<slot>` (base + offset). The plan is
carried on the `InstrProgram` and serialized to ACME
(`packages/codegen/src/instr/serialize-acme.ts:98-103`). `build()`
(`packages/compiler/src/api/build.ts:49-108`) drives ACME to a PRG. The RD-12 harness builds + runs on
VICE (`packages/test-harness/src/gate.spec.test.ts`).

**IL lowering is name-and-frame-keyed, not model-keyed.** `lower.ts` resolves a local via
`frameSymbol(ctx.fqName, name)` + `slotIlType(ctx.frame, name)` (`lower.ts:206, 268-273, 538-543`),
where `ctx.frame = plan.frames.get(fqName)?.frame` and `fqName = ` `` `${moduleName}.${fn.name}` ``
(`lower.ts:153-154`). It already handles `LetDecl`, `IdentExpr`→`load`, `AssignExpr`→`store`,
`BinaryExpr`, and `IntrinsicCallExpr` (`lower.ts:185, 227, 231, 229, 233`); `translate.ts` handles
`load`/`store`/`add`/`sub`/`mul`/`div`/`mod`. **Consequence:** the local-`byte` fixture lowers with no
new codegen work the moment SFA produces a frame with slot `x` — i.e. the moment the adapter returns
the right `FunctionInfo`.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/frontend/src/semantics/analyze.ts` | Builds the `SemanticModel` | Invoke `collectFunctions` alongside `collectDeclarations`; assemble the *populated* model (module scopes / functions / body scopes / mainFunction / `scopeOf`) |
| `packages/frontend/src/semantics/passes.ts` | Pass seams; `collectDeclarations` | **Untouched** — `analyze()` orchestrates the two Pass-1 collectors directly (PF-002) |
| `packages/frontend/src/semantics/declaration-collection.ts` | RD-17 struct/enum tables | **Untouched** (single responsibility, AR-5) |
| `packages/frontend/src/semantics/function-collection.ts` | — (new) | **Create**: per-module `Scope` + functions declared in it + ordered locals in body scopes (AR-13) |
| `packages/frontend/src/sfa/model-adapter.ts` | The seam | Implement `modelToFunctionInfo` for populated models |
| `packages/core/src/semantics/*` (`semantic-model`, `symbol`, `scope`, `call-graph`, `type`) | Model data types | **Read-only** — pure data types, already sufficient |
| `packages/core/src/sfa/function-info.ts` | `FunctionInfo`/`FrameVar` | **Read-only** — the adapter's return contract |
| `packages/test-harness/test/golden/gate.asm.golden` | Constant-gate ASM golden | **Re-mint** (adds `__frame_Main_main`) |
| `examples/slice3a/main.blend` | — (new) | **Create**: the local-byte fixture |
| `packages/test-harness/test/golden/slice3a.asm.golden` | — (new) | **Create** via `UPDATE_GOLDEN=1` |
| `packages/test-harness/src/slice3a.spec.test.ts` | — (new) | **Create**: assemble-clean + VICE |
| `packages/test-harness/src/golden-slice3a.spec.test.ts` | — (new) | **Create**: CI ASM golden |
| existing `analyze.spec.test.ts` / `passes.impl.test.ts` | Passthrough assertions | **Update** cases assuming empty population for programs with a `main` (AR-9) |

### Code Analysis

The model/adapter contracts (from the RD-05 archive `03-05-allocation-plan-and-api.md` + core types):

- `SemanticModel` — `packages/core/src/semantics/semantic-model.ts:29-54`: `globalScope`, `typeMap`,
  `symbolMap`, `callGraph`, `initOrder`, `constValues`, `structTypes`, `enumTypes`, `mainFunction`,
  `hasErrors`, and query helpers `typeOf`/`symbolOf`/`scopeOf`. `createEmptyModel()` at
  `semantic-model.ts:66-83`.
- `FunctionInfo` — `packages/core/src/sfa/function-info.ts:47-62`: `name`, `parameters: FrameVar[]`,
  `locals: FrameVar[]`, `isInterrupt`, `isEscaped`, `isReachable`, `callees: string[]`.
  `FrameVar` (`:29-36`): `name`, `type: Type`, `byRef`.
- `Symbol` — `packages/core/src/semantics/symbol.ts:40-54`: `name`, `kind: SymbolKind`, `type: Type`,
  `decl: AstNode`, `scope: Scope`, `exported`, `mutable`, `constValue?`, `byRef`. `SymbolKind`
  (`:21-30`) includes `"function"` / `"variable"`.
- `Scope` — `packages/core/src/semantics/scope.ts:22-32`: `kind: ScopeKind`, `parent`, `children`,
  `symbols: Map<string, Symbol>`, `node`. `createScope(kind, parent, node)` at `:44-46`.
- `CallGraph` — `packages/core/src/semantics/call-graph.ts:16-28`: `functions: ReadonlySet<Symbol>`,
  `edges`, `findCycles()`. `emptyCallGraph()` at `:36-42`.
- `primitive("byte")` — `packages/core/src/semantics/type.ts:83-85` — the local's type.

The **reference shape** the adapter must produce (from the SFA golden fixtures,
`plan-allocation.golden.spec.test.ts:53-60` + `test-fixtures.ts:125-135`):
`makeFn("main", { locals: [byteVar("x")] })` → `{ name:"main", parameters:[], locals:[{name:"x",
type:primitive("byte"), byRef:false}], isInterrupt:false, isEscaped:false, isReachable:true,
callees:[] }`. For the 3a fixture, `name` becomes the FQN `"Main.main"` (AR-7).
`plan-allocation.spec.test.ts:23-34` already proves `makeFn("main")` alone yields a `__frame_main`
symbol — the planner side is ready.

## Gaps Identified

### Gap 1: Empty populated model
**Current Behavior:** `analyze()` never populates `callGraph.functions` / `mainFunction` / function
scopes (`analyze.ts:80-85`).
**Required Behavior:** the model carries `main` + its local `byte` in declaration order (FR-1).
**Fix Required:** a `function-collection.ts` Pass-1 walk + `analyze()` assembly change (03-01).

### Gap 2: `modelToFunctionInfo` stub
**Current Behavior:** returns `[]` unconditionally (`model-adapter.ts:34-36`).
**Required Behavior:** projects a populated model into `FunctionInfo[]`; empty model still `[]` (FR-2).
**Fix Required:** implement the projection reading `callGraph.functions` + function scopes (03-02).

### Gap 3: No local-byte fixture / acceptance
**Current Behavior:** the only `.blend` is the constant-poke gate; no program exercises a local.
**Required Behavior:** a `.blend` fixture + three-part acceptance (assemble-clean, golden, VICE) (FR-3..5).
**Fix Required:** `examples/slice3a/main.blend` + golden + VICE tests; re-mint the gate golden (03-03).

## Dependencies

### Internal Dependencies
- `@blend65/core` — `SemanticModel`, `Symbol`, `Scope`, `CallGraph`, `Type`, `FunctionInfo`,
  `createEmptyModel`, `createScope`, `primitive` (all present).
- `@blend65/frontend` — SFA planner (`planAllocation`, `generateSymbolDefinitions`) — complete.
- `@blend65/compiler` — `build()`/`emitAsm()` pipeline (RD-15) — complete.
- `@blend65/codegen` — IL lowering + ACME serialization — complete (name-and-frame-keyed).
- `@blend65/test-harness` — `setupEmulator`, run strategies, `assertMemory`, `assertGolden`,
  `hasVice`/`hasAcme` (RD-12) — complete.

### External Dependencies
- ACME assembler + VICE 3.10 — installed locally; CI installs ACME (golden tier), skips VICE (AR-27).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Populating `callGraph`/`mainFunction` breaks existing passthrough tests | High | Low | Expected; audit + update those tests (AR-9); keep the AC-22 empty-model test green |
| `FunctionInfo.name` mismatch with `lower.ts` fqName → undefined `__frame_*` | Med | High | Pin `name = "<Module>.<function>"` (AR-7), module read from the function's module `Scope` `fn.scope.node.name` (AR-13) so both sides use the same source; assemble-clean test catches any mismatch |
| Gate golden diff mistaken for a regression | Med | Low | Documented intentional re-mint (AR-8); inspect diff + VICE re-verify before commit |
| Map-order assumption for locals is wrong | Low | Med | ES2015 guarantees Map insertion order; spec test asserts the exact ordered `FunctionInfo` |
| The adapter accidentally imports `@blend65/codegen` (R15) | Low | High | ESLint `no-restricted-imports` + `boundary.spec.test.ts` fail the build |
| Model population throws on a malformed AST | Low | Med | Emit-diagnostic-never-throw discipline (AR-15/AR-73); impl tests cover body-less/edge shapes |
