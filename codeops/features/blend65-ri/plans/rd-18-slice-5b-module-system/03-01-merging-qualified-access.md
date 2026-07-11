# Module Merging & Qualified Access: RD-18 Slice 5b

> **Document**: 03-01-merging-qualified-access.md
> **Parent**: [Index](00-index.md)
> Governs: `packages/frontend/src/semantics/` (function-collection,
> module-variable-collection, import-resolution, analyze, type-check/*) and the
> frontend SFA adapter parity arms. Decisions: AR-1, AR-2, AR-3, AR-9, AR-13 (+ rider).

## 1. Module merging (AR-9)

### function-collection.ts — name-keyed shared scopes

Scope creation (currently unconditional at :89) becomes name-keyed reuse:

```ts
const moduleScopeByName = new Map<string, Scope>();
// per program:
const name = program.moduleDecl?.name;
let moduleScope = name !== undefined ? moduleScopeByName.get(name) : undefined;
if (moduleScope === undefined) {
  moduleScope = createScope("module", globalScope, program.moduleDecl ?? null);
  globalScope.children.push(moduleScope);
  if (name !== undefined) moduleScopeByName.set(name, moduleScope);
}
moduleScopeByProgram.set(program, moduleScope);
```

- The FIRST file's `ModuleDeclNode` stays the scope's representative `node`
  (deterministic — program order; FQNs via `fqName` are unaffected since all merged
  files declare the same name).
- `FunctionTables` gains `moduleScopeByName: ReadonlyMap<string, Scope>` — consumed
  by import resolution and qualified resolution (§2).
- Cross-file duplicate top-level names now collide in ONE scope → the existing
  E10003 guards fire unchanged (`function-collection.ts:131`,
  `module-variable-collection.ts:49`). `mainFunction` first-wins is unchanged.

### module-variable-collection.ts — consume the map

Signature: `collectModuleVariables(programs, moduleScopeByProgram, bag)` — the
node-identity scope find (:40-42) is deleted; the scope comes from the map. Iteration
stays programs-in-order × items-in-order, so a merged module's `scope.symbols`
insertion order IS (file discovery order × declaration order) — the AR-5 base order
and the storage-layout order (`modelToModuleVars` walks insertion order, unchanged).

### import-resolution.ts — drop the guard, reuse the map

- The local `userModules` construction and the E90001 dup-module ICE (:44-64) are
  DELETED; the function takes `moduleScopeByName` (plus the existing
  `moduleScopeByProgram` for importing-side scopes).
- Everything else is unchanged: exact user-module-name match wins, self-import skip
  (`sourceScope === importingScope` — now correctly true for any file of the same
  merged module), E10012, E10003 on import collision, same-Symbol aliasing.
- Superseded test: `call-semantics.impl.test.ts:102-114` (dup-module ICE) — replaced
  by merging witnesses (ST-1/ST-2).

## 2. Qualified resolution (AR-1, AR-2, AR-3)

### `resolveQualified` — one shared resolver (name-resolution.ts)

```ts
export type QualifiedResolution =
  | { status: "not-qualified" }              // head is a value symbol, or object isn't an IdentExpr
  | { status: "resolved"; symbol: Symbol }
  | { status: "poisoned" };                  // diagnostic already emitted here

export function resolveQualified(
  expr: FieldAccessExprNode,
  scope: Scope,
  moduleScopes: ReadonlyMap<string, Scope>,
  bag: DiagnosticBag,
): QualifiedResolution
```

Resolution ladder (AR-2 value-first; AR-3 codes):

1. `expr.object` not an `IdentExpr` → `not-qualified` (nested chains like `a.b.c`
   keep today's behavior; dotted user modules don't exist — grammar takes a single
   identifier).
2. `resolveName(object.name, scope)` HIT → `not-qualified` — the value symbol wins
   (innermost-binding-wins); the caller keeps today's silent poison for that shape
   (struct field access is Slice 7).
3. Head not a value symbol and not in `moduleScopes` → **E10100** on the object span
   (the head is genuinely undeclared) → `poisoned`. This includes heads that happen
   to match platform namespace ids (`c64.x()`): qualified access is a user-module
   feature; the T4 import boundary is untouched.
4. Module found; `moduleScope.symbols.get(expr.field)` missing OR `!sym.exported` →
   **E10012** (`'<field>' is not exported from module '<name>'`) on the field span →
   `poisoned`. Exported-only holds even when `scope` belongs to the same module
   (spec letter — AR-3).
5. Otherwise → `resolved` with the member symbol (the SAME Symbol imports alias —
   FQN and downstream symbol-keyed machinery work unchanged).

`TypeCheckContext` gains `moduleScopes: ReadonlyMap<string, Scope>`; `analyze.ts`
threads `functionTables.moduleScopeByName` into it.

### typeFieldAccess (expression-typing.ts — new computeType arm)

`FieldAccessExpr` leaves the default poison arm and dispatches on `resolveQualified`:

| Resolution | Behavior |
|-----------|----------|
| `not-qualified` | `ERROR_TYPE`, silent (status quo — Slice 7 owns struct fields) |
| `poisoned` | `ERROR_TYPE` (diagnostic already out) |
| `resolved` kind `variable` / `constant` | `symbolMap.set(expr, sym)`; return `sym.type` |
| `resolved` kind `function` / `interrupt` | **AR-13 ICE** — "function references are not supported yet…" → `ERROR_TYPE` |
| `resolved` other kinds (defensive) | AR-13-style ICE (not reachable today — struct/enum symbols live in the Pass-1a tables, not module scopes) |

### typeCall — qualified callee arm

The non-IdentExpr early-poison (:236-242) is replaced: a `FieldAccessExpr` callee
goes through `resolveQualified`; `not-qualified`/`poisoned` keep the current
walk-args-and-poison contract; `resolved` records `symbolMap.set(callee, sym)` and
feeds the **existing** post-resolution ladder unchanged — E10051 interrupt-call →
E10023 main-call → E10175 non-callable kinds → E10170 count → E10171 per-arg
(strict same-type + `checkConstRange`) → `recordCallEdge` → return type. The T4
registry passthrough remains IdentExpr-only (platform intrinsics import as bare
names). Refactor so both callee shapes share one ladder body — no duplicated checks.

### typeAssign — qualified write target (expression-typing.ts)

An assignment target of shape `FieldAccessExpr` goes through `resolveQualified`:

| Resolution | Behavior |
|-----------|----------|
| `not-qualified` / `poisoned` | keep today's non-ident-target behavior / already-diagnosed |
| `resolved` kind `variable` | `symbolMap.set(target, sym)`; assignability + `checkConstRange` identical to the ident path |
| `resolved` kind `constant` | **E10191** AssignToConst (existing code, existing message shape) |
| `resolved` kind `function` / `interrupt` | **AR-13 ICE** |

## 3. Call-graph / SFA parity (AR-1 rider — correctness, not optional)

Every IdentExpr-keyed callee seam gains the symbol-keyed qualified arm. Because
typing records `symbolMap` entries for resolved qualified callees, each site reads
`model.symbolOf(callee)` and behaves identically to ident callees:

| Seam | Change |
|------|--------|
| `recordCallEdge` (expression-typing.ts:366-388) | none — takes the resolved Symbol; qualified calls flow through the shared ladder |
| `userCalleeOf` / `collectCalls` (model-adapter.ts:117-121) | FieldAccessExpr arm via `model.symbolOf(callee)` → function-kind symbols only |
| `computeArgWindows` / interference | none beyond `userCalleeOf` (consumes it) |
| `lowerUserCall` callee resolution + `collectCallExprs`/`canReach` (lower.ts) | resolve callee via `ctx.model.symbolOf(callee)` for both shapes; the AR-3(5a) same-callee-in-later-arg guard and the ICE fallback apply unchanged |
| `modelToModuleVars` (model-adapter.ts:169-186) | alias guard: `if (sym.scope !== moduleScope) continue;` — an imported module variable is the SAME Symbol aliased into the importing scope and must not project a phantom `__var_<Importer>_<name>` slot (RAM/layout/report skew; latent today, reachable via import-of-an-exported-`let`). Witnessed by the import-of-variable impl test asserting exactly ONE `ModuleVarInput` under the home module |

Witnessed by ST-9 (recursion through a qualified call → ONE E10174 with path).

## 4. Lowering read/write arms (with 03-03's const inlining)

- **Read**: new `lowerFieldAccess` — `ctx.model.symbolOf(expr)`: module `variable` →
  `load` from `loc(moduleVarSymbol(...), type)` (same helper as `lowerIdent`);
  `constant` → constant-inline immediate (03-02 §3 / AR-7); anything else → ICE
  fallback (defensive; typing already rejected).
- **Write**: `lowerAssign` gains the FieldAccessExpr-target arm → module-var store
  via the existing `loc` path.
- `lowerIdent` gains the SAME constant arm (bare const refs — closes the AR-7 hole
  for unqualified reads too; see 03-02 §3).

## Error Handling

| Error Case | Handling | AR Ref |
|------------|----------|--------|
| Same module name in N files | merge — one scope | AR-9 / I-1 |
| Cross-file duplicate top-level name | E10003 (existing guards) | AR-9 |
| Unknown qualified head | E10100 (head span) | AR-3 |
| Member missing / non-exported (incl. self-module) | E10012 (field span) | AR-3 |
| Head shadowed by a value symbol | silent poison (Slice-7 struct arm) | AR-2 |
| Qualified fn/interrupt as value or write target | unsupported ICE | AR-13 |
| Qualified write to const | E10191 | AR-1 |

## Testing Requirements

Spec: ST-1…ST-9 (07-testing-strategy). Impl: merged-scope internals (representative
`node`, insertion order), platform-id head → E10100, self-module non-exported
qualification, import-of-variable witness, superseded-ICE replacement.
