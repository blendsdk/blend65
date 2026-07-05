# Component: Module-Level Scalars (Pass 1 collection + SFA seam)

> **Document**: 03-02-module-scalars.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-4; AR-2, AR-9

## Overview

Widen the working surface from function-local scalars (Slice 3a) to **module-level** scalars. Per
AR-2 these are declared **without initializers** (spec VAR-2) and read/written from function bodies;
no `initCode` is built. The SFA module-var infrastructure already exists and is unit-tested — the
work is **collection + projection + one wire**.

## Part 1 — Pass-1 module-var collection (frontend)

Extend the Slice-3a collector so top-level `let name: T;` declarations become `variable` `Symbol`s in
the **module** scope (the discriminator local-vs-module is the owning scope kind — both use
`SymbolKind "variable"`).

**File:** `packages/frontend/src/semantics/function-collection.ts` (**edit**) — or a sibling
`module-variable-collection.ts` if `function-collection.ts` approaches the 500-line ceiling
(decide during implementation; prefer the sibling for separation of concern).

For each `program.items` entry with `kind === "LetDecl"` (top-level):
```ts
const sym: Symbol = {
  name: item.name, kind: "variable",
  type: primitiveFromTypeNode(item.declaredType),   // reuse the Slice-3a helper
  decl: item, scope: moduleScope,
  exported: item.exported, mutable: true, byRef: false,
};
// duplicate name in module scope → E10003 (R9/R20)
if (moduleScope.symbols.has(item.name)) emit(bag, E10003, item.nameSpan, …);
else moduleScope.symbols.set(item.name, sym);
```
`ConstDecl` top-level: collected as `kind:"constant"` (mutable:false) with `constValue` from const-eval
(minimal — supports the fixture's needs; assignment to it → E10191). Module `let` **with** an
initializer is out-of-surface (AR-2) — the initializer is not executed; document it (a follow-up slice
adds `initCode`). The fixture uses initializer-less module vars, so no ambiguity arises in tests.

Name resolution (03-01) must find module-scope symbols from a function body: lookup order is
function-body scope → enclosing module scope → global (innermost-first, R15).

## Part 2 — `modelToModuleVars` projection (SFA adapter, AR-9)

**File:** `packages/frontend/src/sfa/model-adapter.ts` (**edit**) — add alongside `modelToFunctionInfo`:

```ts
/** Project module-scope scalar `variable` symbols → SFA ModuleVarInput[] (Slice 3b). */
export function modelToModuleVars(model: SemanticModel): ModuleVarInput[] {
  const out: ModuleVarInput[] = [];
  for (const moduleScope of model.globalScope.children) {
    if (moduleScope.kind !== "module") continue;
    const moduleName = isModuleDecl(moduleScope.node) ? moduleScope.node.name : "";
    for (const sym of moduleScope.symbols.values()) {
      if (sym.kind !== "variable") continue;               // functions/consts excluded here
      out.push({ moduleName, variableName: sym.name, type: sym.type, size: byteSize(sym.type) });
    }
  }
  return out;
}
```
`byteSize` already covers all five scalar types (`type-utils.ts:91`). `isModuleDecl` is the Slice-3a
guard. Deterministic order = module order × Map-insertion (declaration) order.

## Part 3 — Wire the feed (compiler)

**File:** `packages/compiler/src/api/run-frontend.ts` (**edit**, `:155–164`) — replace the hardcoded
empty list:
```ts
const allocationPlan = planAllocation(
  {
    functions: modelToFunctionInfo(semanticModel),
    moduleVars: modelToModuleVars(semanticModel),   // ← was: []
    zpUserVars: [],
    upstreamErrors: bag.hasErrors(),
  },
  DEFAULT_PROFILE, bag,
);
```

SFA then lays module vars at `ramStart` (`layoutModuleVariables`), places the frame region after
(`plan-allocation.ts:99`), and emits `__var_<Module>_<name>` symbol definitions (`symbols.ts:74–80`).

## Layout & the AR-1 shadow

With the fixture's `accB:byte` (1) + `accW:word` (2) module vars = 3 bytes at `$0800–$0802`, and
`main`'s locals `a,b,c:byte` (3) + `x,y:word` (4) = 7 bytes in the frame region at `$0803–$0809`,
the total (≈10 bytes) stays within the `$0800–$080C` dead-BASIC-stub shadow (AR-1) — no live-code
collision. `__startup` remains at `$080D`.

## No core-type change

`ModuleVariableAllocation`, `ModuleVarInput`, `AllocationPlan.moduleVariables/moduleVariablesSize`,
`layoutModuleVariables`, and `__var_*` emission all ship today (`02-current-state.md §2`). Slice 3b
is pure population — no `@blend65/core` SFA type edits.

## Tests to extend (existing oracles)

- `model-adapter.spec.test.ts` — add a fixture model with a **module-scope** `variable` symbol and
  assert `modelToModuleVars` projects it (the current fixtures only put functions in module scope).
- `symbols.spec.test.ts` / `plan-allocation.*` — already fixture module vars; the new end-to-end path
  is covered by the acceptance golden (03-04).
