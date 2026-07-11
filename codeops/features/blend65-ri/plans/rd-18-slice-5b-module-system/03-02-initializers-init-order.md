# Initializers, Const Completion & Init Order: RD-18 Slice 5b

> **Document**: 03-02-initializers-init-order.md
> **Parent**: [Index](00-index.md)
> Governs: `packages/frontend/src/semantics/` (statement-typing driver arms,
> const-eval extension, the new `init-order.ts`), `packages/core` const/model seams.
> Decisions: AR-4, AR-5, AR-6, AR-7 (+ I-1, I-3).

## 1. Initializer typing — Pass-3 arms (AR-4, I-3)

`typeCheckPrograms` (statement-typing.ts) currently dispatches only
FunctionDecl/InterruptDecl items; it gains top-level arms, resolved against the
item's MODULE scope (`moduleScopeByProgram` threaded from `FunctionTables`):

### `typeModuleLet(item, moduleScope, ctx)`

1. `initialiser === null` → nothing (indeterminate per spec VAR-2; W10190 stays
   deferred — AR-5 note).
2. **Call rejection (AR-4):** walk the initializer for ANY `CallExpr` OR any
   `IntrinsicCallExpr` whose name is not `lo`/`hi` (user, builtin-intrinsic, or
   unresolved alike — calls hide reads; the 23 reserved builtins parse as their
   own `IntrinsicCallExpr` node kind, so a `CallExpr`-only walk would let
   `peek`/`peekw` type and lower clean, silently widening the call-free surface —
   platform-contributed intrinsics DO parse as plain `CallExpr` and are caught).
   `lo`/`hi` arguments are still recursed into — a call nested inside `lo(...)`
   is rejected. First hit → ONE `IceCode.Unexpected` on the call's span:
   *"call-bearing module initializers are not supported yet — assign in main()
   instead"* → poison, skip 3–4. (Note: `lo`/`hi` over a const ref currently
   ICEs at `emitLo`/`emitHi` — they fold literal arguments only; loud,
   function-body parity.)
3. `typeOfExpr(initialiser, moduleScope, ctx)` — populates `typeMap`/`symbolMap`
   (qualified refs resolve per 03-01 §2; imported names are already aliased into the
   module scope).
4. Parity checks with the local-`let` path (same helpers, same codes): strict
   same-type assignability vs the declared type (E10152/E10153/E10154 family — I-3)
   + `checkConstRange` (E10084).

### `typeModuleConst(item, moduleScope, ctx)` (AR-7)

1. `typeOfExpr` first (types, `symbolMap`, E10100s — same as lets).
2. Const evaluation via the §3 machinery; non-const shape → **E10193** with the spec
   message (*"Initializer for const '<name>' is not a compile-time constant
   expression"*). Successful value → range-check vs the declared type (E10084) →
   `ctx.constValues.set(sym, value)`.
3. **E10192** (const without initializer) is parser-owned — `ConstDeclNode.
   initialiser` is non-null by AST type (nodes.ts:175-183); recorded in the ledger
   as parser-owned (E10150/E10076 precedent), no emission site.

## 2. Const evaluation & const-const cycles (AR-7, AR-6)

`const-eval.ts`'s `evalConst` folds literals/unary/binary/`lo`/`hi` and yields
`nonConst` for identifiers (:38-53). Extension: an optional resolver callback
`(expr: IdentExpr | FieldAccessExpr) => ConstValue | "nonconst" | undefined` — the
Pass-3 const phase closes it over `ctx.symbolMap` + `ctx.constValues` (a reference to
a `constant`-kind symbol with a known value folds; a reference to a `variable` → the
callback returns `"nonconst"` → E10193; unresolved → already-poisoned).

**Evaluation order & cycles:** declaration-order independence (spec VAR-6) means
`const B = A + 1;` may precede `const A = 2;`. The const phase therefore runs as:

1. Extract const→const reference edges (syntactic walk over each const initializer,
   resolving via `symbolMap`).
2. `findCallCycles(constSymbols, edges)` — reuse of the Symbol-generic Tarjan; each
   cycle → **one E10194** in the AR-6 shape (§4); cycle members poison (no value).
3. Evaluate the acyclic remainder in reverse-topological (dependency-first) order,
   filling `constValues`.

`SemanticModel.constValues` (currently frozen-empty, semantic-model.ts:36/:72) is
built from the Pass-3 map; `Symbol.constValue` stays untouched (the map is the
single source — symbols remain immutable after collection).

## 3. Const use-site inlining (AR-7 — closes the verified hole)

Lowering (03-01 §4 arms): a resolved `constant`-kind module symbol in an expression
(bare `SCALE` or qualified `Math.SCALE`) lowers to
`imm(value, ilTypeOfType(sym.type))` from `ctx.model.constValues.get(sym)`; a
missing value (poisoned const) never reaches lowering (the `hasErrors` driver gate).
Defensive ICE fallback if the map misses. Constants stay excluded from
`modelToModuleVars` (no `__var_*`, zero RAM — spec §4.2), and are **never** init-graph
runtime edges (§4) — spec Ch 10 §5.4's const row, witnessed by ST-13/ST-23.

## 4. The init-order pass — `semantics/init-order.ts` (AR-5, AR-6, AR-11)

Runs in `analyze.ts` after `typeCheckPrograms` (needs `symbolMap`) and before model
construction (its output is the model's `initOrder`); a Pass-4 sibling of
`checkRecursion` in spirit.

```ts
export function computeInitOrder(input: {
  modules: ReadonlyArray<{ name: string; scope: Scope }>; // discovery order
  importEdges: ReadonlyMap<string, ReadonlySet<string>>;  // importer -> imported (user modules only)
  initializers: ReadonlyMap<Symbol, ExprNode>;            // module lets WITH initializers
  symbolMap: ReadonlyMap<AstNode, Symbol>;
  bag: DiagnosticBag;
}): readonly Symbol[]
```

`importEdges` is recorded by `resolveImports` (one new output map — module name →
set of imported user-module names); `initializers` is recorded by
`collectModuleVariables` (symbol → initialiser expr for `let`s that have one).

**Step 1 — variable edges (ONE global graph, AR-5 grounded span):** for each
`(sym, init)`, walk for `IdentExpr`/`FieldAccessExpr`, resolve via `symbolMap`, keep
targets that are module-scope `variable` symbols **with initializers** (imports alias
the same Symbol so cross-module refs land automatically; consts fold — no edge;
initializer-less vars have no init position — no edge). Edge `sym → target` means
*target initializes first*.

**Step 2 — cycles:** `findCallCycles(varsWithInit, edges)` → per cycle ONE
**E10194** (AR-6): anchored at the first-declared member (lowest base-priority),
message = the spec's exact text with the anchor's name, plus the E10174-style path:

```
Circular initializer detected — 'a' depends on itself (directly or indirectly)
through module-level initialization order — cycle: a → b → a
```

Span: the anchor's initializer expression. Cycle members drop from the order (the
bag error gates SFA/codegen downstream — 5a's `hasErrors` driver gate).

**Step 3 — module base order (AR-5 two-level):** Kahn over `importEdges` (imported
module first), priority queue by discovery order; cycle-tolerant — when no
zero-indegree module remains, pull the lowest-discovery remaining one (circular
imports are legal per R21; the intra-cycle fallback is the slice's recorded spec
gap — AR-5).

**Step 4 — global per-variable stable topo:** Kahn over the Step-1 edges with
min-priority `(moduleOrderIdx, declIdx)`; `declIdx` = the merged scope's
`symbols` insertion order (= file discovery order × item order, 03-01 §1) —
taken from the symbol's **declaring** scope (`sym.scope`); import-aliased
entries (the same Symbol present in another scope's map) are skipped during
ordinal derivation, so an imported variable never receives a second
(importer-side) ordinal. With no edges this yields exactly the spec's
declaration-order-within-module, import-ordered-across-modules baseline.

Output → `SemanticModel.initOrder` (exists, currently always `[]`).

## Error Handling

| Error Case | Handling | AR Ref |
|------------|----------|--------|
| Call anywhere in a `let` initializer | unsupported ICE (loud deferral) | AR-4 / I-1 |
| Non-const shape in a `const` initializer (var ref, call, cast…) | E10193, spec message | AR-7 |
| `let`-initializer cycle (incl. cross-module) | ONE E10194 per cycle + path | AR-5 / AR-6 |
| `const`-`const` cycle | ONE E10194 per cycle + path (same machinery) | AR-6 / AR-7 |
| Type mismatch / out-of-range initializer | E10152/53/54 + E10084 (local-`let` parity) | AR-4 / I-3 |
| Const without initializer | parser-owned (E10192 recorded, unwired) | AR-7 |
| Initializer-less `let` read by an initializer | legal, no edge, indeterminate (W10190 deferred) | AR-5 |

## Testing Requirements

Spec: ST-10…ST-18 (07-testing-strategy). Impl: resolver-callback const-eval internals
(const-of-const chains, `lo`/`hi` over consts), import-edge recording, decl-ordinal
derivation under merging, cycle-member poison behavior, initializer-less-var non-edge.
