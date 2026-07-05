# Model Adapter: RD-18 Slice 3a

> **Document**: 03-02-model-adapter.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-2; AR-4, AR-6, AR-7, AR-10

## Overview

Implement `modelToFunctionInfo` — the single deferred wiring seam between RD-04's `SemanticModel`
and RD-05's SFA planner. It projects the populated model (03-01) into the flat `FunctionInfo[]` the
planner consumes. This is the *only* place the "checker not yet wired" deferral lived; filling it in
touches **no** SFA pass (the planner already works against `FunctionInfo` fixtures).

## Architecture

### Current Architecture

`modelToFunctionInfo(_model)` returns `[]` unconditionally (`model-adapter.ts:34-36`). It imports
`@blend65/core` only (R15/AR-20).

### Proposed Changes

Read the populated model and build one `FunctionInfo` per function symbol. Keep the empty-model
behavior identical (`createEmptyModel()` → `[]`), since an empty `callGraph.functions` yields an
empty array naturally.

## Implementation Details

### New Functions/Methods (`model-adapter.ts`)

```ts
import type { SemanticModel, FunctionInfo, FrameVar, Symbol, Scope } from "@blend65/core";

/**
 * Projects a populated {@link SemanticModel} into the planner's {@link FunctionInfo}[] (RD-05 seam).
 *
 * Slice 3a surface: one entry per function in `model.callGraph.functions`; the module-qualified FQN
 * for `name` (AR-7); parameters empty (no user params in 3a); locals = the function scope's variable
 * symbols as `FrameVar[]` in declaration order (AR-6); flags fixed for the scalar surface; no callees
 * (calls arrive in Slice 5). Returns `[]` for the empty passthrough model (RD-05 AC-22 preserved).
 */
export function modelToFunctionInfo(model: SemanticModel): FunctionInfo[] {
  const result: FunctionInfo[] = [];
  for (const fn of model.callGraph.functions) {
    const scope = model.scopeOf(fn.decl);            // function body scope (AR-10)
    result.push({
      name: fqName(fn),                              // "<Module>.<function>" (AR-7)
      parameters: [],                                // 3a: no user params
      locals: collectLocals(scope),                  // ordered FrameVar[] (AR-6)
      isInterrupt: fn.kind === "interrupt",
      isEscaped: false,                              // &fn arrives in Slice 8
      isReachable: true,                             // main is reachable; call-graph reachability = Slice 5
      callees: [],                                   // no calls in 3a
    });
  }
  return result;
}
```

### Supporting helpers

```ts
/** Module-qualified FQN matching `lower.ts:126,153` (`${moduleName}.${fn.name}`), AR-7/AR-13.
 *  The module is read from the function symbol's declaring **module** `Scope` (`fn.scope.node`, a
 *  `ModuleDeclNode`), populated by 03-01 — model-only, no AST re-walk, no core-type change. */
function fqName(fn: Symbol): string {
  const modNode = fn.scope.node;                       // the declaring ModuleDeclNode (03-01, AR-13)
  const moduleName = modNode?.kind === "ModuleDecl" ? modNode.name : "";
  return `${moduleName}.${fn.name}`;                    // e.g. "Main" + "main" → "Main.main"
}

/** The scope's `kind:"variable"` symbols as ordered FrameVar[] (Map insertion order, AR-6). */
function collectLocals(scope: Scope): FrameVar[] {
  const locals: FrameVar[] = [];
  for (const sym of scope.symbols.values()) {        // insertion order == declaration order (AR-6)
    if (sym.kind === "variable") {
      locals.push({ name: sym.name, type: sym.type, byRef: false }); // byRef scalars = false
    }
  }
  return locals;
}
```

> **FQN source (AR-7 / AR-13).** `FunctionInfo.name` must equal `lower.ts`'s `fqName` so
> `plan.frames` is keyed identically — `Main.main`. `lower.ts:126` derives the module from
> `program.moduleDecl.name`; the adapter, which receives **only** a `SemanticModel`, recovers the
> same module from the model: 03-01 declares each function `Symbol` in its **module** `Scope`, so
> `fn.scope.node` is the `ModuleDeclNode` and `fn.scope.node.name` is the module. No `programs`/AST
> argument, no `@blend65/core` type change (the seam signature stays `modelToFunctionInfo(model)`,
> honoring AR-4). This closes the carrier gap that would otherwise emit an undefined `__frame_*` at
> assemble time (AR-13); the assemble-clean test (03-03) is the runtime backstop if the module scope
> is ever mis-wired.

### Integration Points

- **Upstream:** reads `model.callGraph.functions` + `model.scopeOf(fn.decl)` from 03-01.
- **Downstream:** the returned array feeds `planAllocation({ functions, ... })` unchanged
  (`run-frontend.ts:157`). The planner produces `__frame_Main_main` + `__frame_Main_main_x` symbols.
- **Boundary:** imports `@blend65/core` only — never `@blend65/codegen` (R15/AR-20).

## Code Examples

For the 3a fixture's populated model:

```ts
modelToFunctionInfo(model)
// => [{ name: "Main.main", parameters: [], locals: [{ name: "x", type: primitive("byte"), byRef: false }],
//       isInterrupt: false, isEscaped: false, isReachable: true, callees: [] }]

modelToFunctionInfo(createEmptyModel())
// => []   (RD-05 AC-22 preserved — empty callGraph.functions)
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Empty model (`createEmptyModel()`) | Empty `callGraph.functions` → `[]`; identical to today | AR-9 |
| Function symbol whose `scopeOf(decl)` misses | `scopeOf` falls back to `globalScope` (03-01) → no locals; never throws | AR-10 |
| Non-variable symbols in the scope (none in 3a) | Filtered by `kind === "variable"` | AR-6 |
| A local with `ERROR_TYPE` (out-of-surface type) | Passed through as-is; the planner sizes defensively | AR-12 |

> **Traceability:** every strategy references an AR entry. The seam never throws (AR-15/AR-73): a
> malformed populated model degrades to fewer/empty locals, not a crash.

## Testing Requirements

- Spec (`model-adapter.spec.test.ts`): the populated 3a model projects to exactly the `FunctionInfo`
  above (ST-1); `createEmptyModel()` → `[]` (ST-1b, re-asserts AC-22 from the adapter's own suite).
- Impl (`model-adapter.impl.test.ts`): two locals project in declaration order; an interrupt
  declaration projects `isInterrupt: true`; a function with no locals projects `locals: []` but still
  appears (so its `__frame_*` base is emitted).
- Integration: covered by the assemble-clean + golden + VICE acceptance in 03-03.
