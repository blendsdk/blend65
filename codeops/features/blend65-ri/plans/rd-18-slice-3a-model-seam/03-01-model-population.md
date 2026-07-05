# Model Population: RD-18 Slice 3a

> **Document**: 03-01-model-population.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-1; AR-4, AR-5, AR-6, AR-9

## Overview

Populate the `SemanticModel` with just enough to describe every function and its local scalars — the
leading edge of RD-04 Pass 1. This is what turns the empty-model passthrough into a *real* model the
adapter can project. It is a **reusable** Pass-1 slice: Slice 3b extends it with the full
scope/symbol table + typing rather than replacing it (AR-5).

## Architecture

### Current Architecture

`analyze()` (`analyze.ts:69-92`) assembles the model from `createEmptyModel()` + struct/enum tables
only. `collectDeclarations` (`passes.ts:29-31`) delegates to `collectDeclarationTables` (structs/enums).
Functions, scopes, locals, and `mainFunction` are never populated.

### Proposed Changes

Add `packages/frontend/src/semantics/function-collection.ts` — a focused collector that walks the
parsed programs and produces the function-level model data, **including a per-module `Scope`** so a
function's module (needed for the FQN) is recoverable from the model alone (AR-13). Invoke it from
`analyze()` **alongside** `collectDeclarations` (each Pass-1 collector stays single-responsibility;
PF-002) and thread its output into the model `analyze()` assembles. RD-17's `declaration-collection.ts`
(struct/enum) is untouched.

## Implementation Details

### New Types/Interfaces (`function-collection.ts`)

```ts
import type { ProgramNode, Symbol, Scope, AstNode } from "@blend65/core";

/** The function-level model data collected in Pass 1 (Slice 3a surface). */
export interface FunctionTables {
  /** Every function/interrupt declaration as a resolved function `Symbol`. Each carries
   *  `scope` = its declaring **module** `Scope`, so the adapter recovers the module for the
   *  FQN from the model alone (AR-13). */
  readonly functions: ReadonlySet<Symbol>;
  /** The resolved `main` function symbol, or `null` if absent. */
  readonly mainFunction: Symbol | null;
  /** decl AstNode → its **body** scope (holding ordered locals), backing the model's
   *  `scopeOf` query helper (AR-10). */
  readonly scopeByNode: ReadonlyMap<AstNode, Scope>;
}
```

> **Note on `callGraph`:** for the 3a surface there are no calls (user calls ICE, deferred to Slice
> 5), so `analyze()` builds the model's `callGraph` from `FunctionTables.functions` with `edges`
> empty. `callGraph.functions` is the set the adapter iterates (AR-10).

### New Functions/Methods

```ts
/**
 * Pass-1 function + local collection (Slice 3a; RD-04 R2 leading edge).
 *
 * For each program, creates the program's **module** `Scope` (`createScope("module", globalScope,
 * program.moduleDecl)`) under the global scope, then walks the program's top-level
 * `FunctionDecl`/`InterruptDecl` items, creating a function `Symbol` per declaration (declared **in
 * that module scope**, so `fn.scope.node` is the `ModuleDeclNode` the adapter reads for the FQN —
 * AR-13) and a function-kind body `Scope` whose `symbols` map holds the function's local variables
 * (from body `LetDecl`s) as `kind: "variable"` symbols, inserted in **declaration order** (AR-6).
 * Sets `mainFunction` to the `main` function symbol if present.
 *
 * Never throws (AR-15/AR-73): a malformed/body-less declaration is skipped, not crashed on. No
 * typing, name resolution, or duplicate-decl checks yet — those are Slice 3b.
 *
 * @param programs The parsed ASTs.
 * @param globalScope The model's global scope (root; parent of the per-module scopes).
 * @returns The collected {@link FunctionTables}.
 */
export function collectFunctions(
  programs: readonly ProgramNode[],
  globalScope: Scope,
): FunctionTables;
```

Behavior, per program `p` (module `p.moduleDecl.name`), then per function declaration `fn` in it:

0. Create the **module** `Scope`: `const moduleScope = createScope("module", globalScope,
   p.moduleDecl)`; push it to `globalScope.children`. Its `node` is the `ModuleDeclNode`, whose
   `.name` is the module the adapter needs for the FQN (AR-13). This is genuine RD-04 §4.2 Pass-1
   structure that Slice 3b extends (module registration / export visibility), **not** a 3a shim.
1. Build the function `Symbol`: `{ name: fn.name, kind: fn.kind === "InterruptDecl" ? "interrupt" :
   "function", type: ERROR_TYPE, decl: fn, scope: moduleScope, exported: fn.exported,
   mutable: false, byRef: false }`. The symbol is declared in `moduleScope` (RD-04 §4.2 — functions
   live in their module scope, not the global scope). `type` is left `ERROR_TYPE` in 3a — nothing in
   the 3a path reads a function symbol's type, and Slice 3b (Pass 3 typing) assigns the real function
   type; 3a must not imply the return type *is* the function's type (PF-006). Also insert the function
   symbol into `moduleScope.symbols` (declared-name key).
2. Create the function **body** `Scope`: `createScope("function", moduleScope, fn)`; push it to
   `moduleScope.children`; record `scopeByNode.set(fn, funcScope)`.
3. Walk `fn.body.statements` for `LetDeclNode`s (the 3a local surface). For each, create a variable
   `Symbol`: `{ name: decl.name, kind: "variable", type: primitiveFromTypeNode(decl.declaredType),
   decl, scope: funcScope, exported: decl.exported, mutable: true, byRef: false }` and insert it into
   `funcScope.symbols` in source order. (Field names per `nodes.ts:166-173`: `name`, `declaredType:
   TypeNode | null`, `initialiser`, `exported`.)
4. Add the function symbol to `functions`; if `fn.name === "main"`, set `mainFunction` to it. **Entry
   selection (PF-005):** the 3a surface is a single source file, so the first (only) `main` wins;
   canonical entry-module selection across multiple files is a Slice-3b Pass-4 (`postCheck`) duty —
   documented here, not silently assumed. A duplicate `main` last-writer-wins (checked in 3b).

`primitiveFromTypeNode` maps a primitive `TypeNode` (`byte`/`sbyte`/`word`/`sword`/`boolean`) to
`primitive(name)`. For the 3a surface only primitives appear. If `declaredType` is `null` (inferred)
or non-primitive (Slice 7 aggregates), it is left as `ERROR_TYPE` (the SFA planner sizes it
defensively; no crash) — but the 3a fixture always writes an explicit `byte`.

### `analyze()` wiring (`analyze.ts`)

```ts
const empty = createEmptyModel();
const tables = collectDeclarations(input);                       // structs/enums (RD-17, unchanged)
const fns = collectFunctions(input.programs, empty.globalScope); // NEW (Slice 3a)
// ... Pass 3 intrinsic validation (unchanged) ...
const model: SemanticModel = {
  ...empty,
  structTypes: tables.structTypes,
  enumTypes: tables.enumTypes,
  callGraph: { functions: fns.functions, edges: new Map(), findCycles: () => [] },
  mainFunction: fns.mainFunction,
  scopeOf: (node) => fns.scopeByNode.get(node) ?? empty.globalScope,
  hasErrors: analyzerRecordedError,
};
```

> The `scopeOf` override lets the adapter resolve a function symbol's `decl` → its body scope
> (AR-10) without re-walking the AST. The **module** for the FQN is read from `fn.scope.node` (the
> module `Scope`'s `ModuleDeclNode`), so the adapter stays model-only — no `programs`/AST argument
> and no `@blend65/core` type change (AR-13; honors AR-4). `symbolMap`/`typeMap` stay empty — scalar
> lowering does not consult them (D5); Slice 3b populates them. (`ERROR_TYPE` is imported from
> `@blend65/core` for the function symbol's placeholder type.)

### Integration Points

- **Downstream:** the adapter (03-02) reads `callGraph.functions` + `scopeOf(fn.decl)`.
- **Passthrough:** a program with no functions collects an empty `functions` set → `callGraph`
  stays empty → adapter returns `[]` → identical to today's behavior for function-free input (AR-9).

## Code Examples

For `module Main; function main(): void { let x: byte = 5; poke(0xD020, x); }`:
- module scope = `Scope(module, node: ModuleDecl("Main"), parent: globalScope)`
- `functions` = `{ Symbol(main, kind:function, scope: moduleScope) }` — so `main.scope.node.name === "Main"`
- `scopeByNode` = `{ FunctionDecl(main) → Scope(function, symbols:{ x → Symbol(x, kind:variable,
  type:byte) }) }`
- `mainFunction` = `Symbol(main)`

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Program with no functions | Empty `functions` set; empty-model-equivalent passthrough | AR-9 |
| Function with a `null`/absent body | Skip local collection; still register the function symbol; never throw | AR-15/AR-73 |
| Non-primitive local type node (out of 3a surface) | Leave `ERROR_TYPE`; no crash; not exercised by the 3a fixture | AR-12 |
| Duplicate function/local name | **Not checked in 3a** (deferred to Slice 3b Pass 1) — last-writer-wins in the Map; documented | AR-5 |

> **Traceability:** every strategy above maps to an AR entry. Duplicate-detection is explicitly a
> Slice-3b responsibility (AR-5) — not silently skipped, but scoped out with a named owner.

## Testing Requirements

- Unit (`function-collection.impl.test.ts`): a `main` with two locals collects both in declaration
  order; a body-less function registers the symbol without throwing; a function-free program yields
  an empty set.
- Spec (`function-collection.spec.test.ts`): the 3a fixture yields exactly the `FunctionTables`
  shape above (ST-2 in 07).
- Integration: `analyze()` on the 3a fixture returns a model with `main` in `callGraph.functions` +
  `mainFunction` set (ST-3); a function-free program keeps the passthrough (ST-4).
