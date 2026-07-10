# Call Semantics: RD-18 Slice 5a — User Functions, Parameters & Calls

> **Document**: 03-01-call-semantics.md
> **Parent**: [Index](00-index.md)
> Frontend semantic work: parameter collection, call/return typing, the call graph +
> recursion rejection, user-module import resolution, and the registry edits. Normative
> surface: `spec/06-functions.md` FN-1..FN-13 + §4; `spec/10-modules.md` §4. Decisions:
> AR-5..AR-11, AR-13, AR-14.

## Overview

Everything in this document lives in `packages/frontend/src/semantics/` and
`packages/core/src/` (registry + symbol flags). It turns the silent-poison user-call path
into full validation, and produces the model data (`parameter` symbols, call-graph edges)
that 03-02 projects into the SFA.

## 1. Registry edits (`packages/core/src/diagnostics/diagnostic-codes.ts`)

- **Rename** `TooManyParameters: "E10175"` → `NotCallable: "E10175"` (AR-9; zero emit
  sites verified — update the one name, no number changes). The in-file comment notes the
  spec-table alignment ("cannot call non-function") and that no param-count limit exists
  (FN-11). **Note (PF-004):** the spec is internally inconsistent here — the canonical
  Ch 14 registry (`spec/14`, which Ch 06 §10 itself declares canonical) still lists
  E10175 = TooManyParameters (max 8), a row FN-11 refutes; the rename follows Ch 06 §10
  and the Ch 14 divergence is recorded in the 5.1.2 deviation note for a future
  spec-errata pass.
- **Mint** `CallToInterruptFunction: "E10051"` in the intrinsic/interrupt band next to
  E10044/E10046 (AR-10) — additive, `spec/` untouched (RD-18 AR-115 pattern).
- No other codes change. E10170/E10171/E10172/E10174/E10012/E10023 are already registered
  (02-current-state §Frontend).

## 2. Parameter collection (`semantics/function-collection.ts`)

Extend Step 3 (currently body-locals only, lines 106-113):

- For each `FunctionDeclNode`, iterate `params: ParameterNode[]` **before** body locals and
  insert each as a symbol into the function body scope:
  `{ kind: "parameter", name, type: resolveTypeNode(p.paramType), decl: p, scope: bodyScope,
  exported: false, mutable: true, byRef: false }`. Scalars only in 5a — `byRef` stays false
  (struct/array params are Slice 7). `InterruptDeclNode` has no params (AST shape).
- **Duplicate param name** in the same function → `E10003 DuplicateDecl` on the second
  occurrence, first-wins insertion (matches `module-variable-collection.ts:51` precedent).
- **FN-13 shadowing** (AR-8): a param whose name already exists in the enclosing module
  scope → `E10101 NameShadows` (message names both the parameter and the module-level
  declaration). Body locals duplicating a param remain silent last-wins (block-scope R11
  stays deferred — unchanged behavior, documented).
- Function symbols keep `exported` from the decl's `exported` flag (`nodes.ts:114,125`) so
  import validation (§6) can read `Symbol.exported` (`symbol.ts:48`).
- Ordering matters downstream: 03-02's adapter reads parameters via scope-map insertion
  order — params must be inserted before locals (params-first frame layout,
  `frame-computation.ts:51-76`).

## 3. Call typing (`semantics/type-check/expression-typing.ts`)

New `typeCall(expr: CallExprNode, scope, ctx): Type`, dispatched from `computeType` for
`kind === "CallExpr"` (replacing the silent `default` poison for this kind only).

### 3.1 Signature access (no `FunctionType`)

Functions are not values (FN-12; typed function values are FUT-003), so no `Type` variant
is added. A small signature view is computed from the declaration and cached:

```ts
interface FnSignature {
  readonly params: readonly { name: string; type: Type }[];
  readonly returnType: Type; // primitive("void") for void
}
// ctx.signatures: Map<Symbol, FnSignature> — resolveTypeNode on FunctionDeclNode
// params/returnType, computed on first use.
```

### 3.2 Callee resolution + kind checks (order matters)

`expr.callee.kind === "IdentExpr"` is the 5a surface:

1. `resolveName(name, scope)` → `null` → `E10100 UndeclaredIdentifier`, poison (existing
   code + wording pattern from `typeIdent`).
2. Symbol kind `"interrupt"` → **E10051** `CallToInterruptFunction` (AR-10 — miscompile
   guard: interrupt bodies end in RTI), poison.
3. Symbol `=== model.mainFunction` → **E10023** `CallingMainDirectly` (AR-11; discharges
   the `post-check.ts:9` deferral note), poison.
4. Symbol kind not `"function"` → **E10175** `NotCallable` (AR-9), poison.
5. Otherwise: record the call edge (§5), check args (§3.3), result = signature return type.

A non-`IdentExpr` callee (e.g. `Math.add(…)` parsing as a `FieldAccessExpr` callee) keeps
the existing silent-poison `default` behavior in 5a — qualified access is 5b (AR-15); the
lowering ICE it produces today is the same still-unsupported contract every pre-5a call had.

Poison discipline: follow the established R114 cascade suppression — a poisoned callee or
argument suppresses the dependent checks (one diagnostic per root cause).

### 3.3 Argument checking (AR-5)

- Count first: `expr.args.length !== sig.params.length` → **E10170** `WrongArgCount`
  (message: name, expected N, got M — spec Ch 06 §10 wording). Args are still typed (for
  `typeMap` coverage) but per-arg type checks are skipped.
- Per-arg: `typeOfExpr(arg, scope, ctx, contextType = param.type)` (context threading reuses
  the literal-adaptation machinery that `typeReturn` and assignments already use), then
  strict same-type `isAssignableTo` — failure → **E10171** `ArgTypeMismatch` (message names
  the parameter, expected, actual). One code for all argument-position failures (AR-5);
  promotion arrives with Slice 6.
- Result type: `sig.returnType`. A `void` result in value position fails naturally at the
  consuming assignment/operator check (no special casing).

## 4. Return completion (`semantics/type-check/statement-typing.ts` — `typeReturn`)

Extend the existing `typeReturn` (lines 470-485; E10173 already wired):

- `stmt.value === null` and `returnType` is not void → **E10172** `MissingReturnValue`
  (AR-6).
- `stmt.value !== null` and non-void: after `typeOfExpr(value, …, contextType=returnType)`,
  run `checkAssignable(valueType, returnType)` — emitting the assignment family
  **E10152/E10153/E10154** with return-context wording ("return type of '<fn>'") rather
  than assignment wording (AR-6). Poisoned value → suppressed (R114).

## 5. Call graph + recursion (`analyze.ts`, `core/src/semantics/call-graph.ts`, `post-check.ts`)

- **Edges (Pass 3, R84/R87):** the type-check context carries the enclosing function symbol
  (already threaded for `returnType` — extend to the symbol). Each resolved user-function
  callee in §3.2 step 5 records `edges.get(caller).add(callee)`. `IntrinsicCallExpr` is a
  different node kind and never reaches `typeCall` → intrinsics are structurally excluded
  (R87); `__rt_*` routines are translate-level and invisible here.
- **`findCycles` (R86, AR-7):** implement Tarjan SCC over `(functions, edges)` in
  `call-graph.ts` (iterative, bounded — Security Considerations in RD-18). A cycle = an SCC
  of size > 1, or a self-loop. Deterministic order: SCCs sorted by their canonical anchor =
  the first-declared member (program order, then item order); cycle path rendered from the
  anchor (`ping → pong → ping`).
- **Emission (Pass 4):** new `checkRecursion` in `post-check.ts` — one **E10174**
  `RecursionDetected` per cycle, primary span on the anchor's recursive call site, message
  carrying the full path (spec Ch 06 FN-6 rendering; AR-7).
- **Pre-SFA poison (AR-7, load-bearing) — the gate is NEW work (PF-002):** `analyze()`
  already runs post-check before returning the model, but **no skip gate exists today**:
  `run-frontend.ts:165-174` calls `planAllocation` unconditionally, and `upstreamErrors`
  only suppresses budget diagnostics (`budgets.ts:58`). Add the gate at the DRIVER level,
  guarding the whole `planAllocation(…)` call expression on `bag.hasErrors()` — this also
  skips the inline `modelToFunctionInfo` argument evaluation, and with it the AR-3
  `reach()` DFS (a cyclic edge map must never reach it). `FrontendRun.allocationPlan` is
  already optional and both consumers guard `undefined` (`build.ts:58`, `emit.ts:91`).
  The existing plan-allocation-level spec test ("still assembles under `upstreamErrors`",
  `plan-allocation.spec.test.ts:93-104`) exercises a DIFFERENT layer and stays untouched.
  Add the ordering witness test (07 ST-24). Frame coloring on a cyclic `callees` graph is
  meaningless (`coloring.ts` precondition). Defense-in-depth: every new reachability walk
  (the adapter `reach()`, the AR-3 lowering guard) is visited-set-bounded so a cyclic
  graph can never hang it even if the gate regresses.
- Model wiring: `analyze.ts:123-127` swaps `edges: new Map()` for the real map and the stub
  `findCycles` for the Tarjan implementation.

## 6. User-module import resolution (new `semantics/import-resolution.ts`)

A new collection-phase step running after all module scopes exist (cross-program), before
type-checking — wired in `analyze()` next to `collectFunctions`/`collectModuleVariables`:

- Build `userModules: Map<string, Scope>` from each program's `moduleDecl.name` → its
  module scope. (No merging in 5a — duplicate module names across files are 5b/R20; 5a
  keeps today's per-file scopes and the fixture uses distinct names.)
  **Collision guard (PF-005):** two files declaring the same module name is spec-legal
  (Ch 10 §6.1 — they merge, which lands at 5b/R20), but a silent last-wins map entry
  could resolve an import against the wrong file's scope and emit a WRONG E10012 for
  correct source. Detect the collision while building the map and route it to an
  explicit unsupported-in-this-slice ICE-band diagnostic (same doctrine as the AR-3/AR-4
  guards: never wrong output); the guard is removed at 5b when merging lands.
- For each `ImportStmtNode` in each program:
  - **Precedence (AR-14):** if `modulePath` exactly matches a user module name → user-module
    import (below). Otherwise leave it untouched for the T4 platform-intrinsic boundary
    (`intrinsic-validation.ts` behavior unchanged, E10046 et al.).
  - For each imported `name`: look up in the source module's scope. Missing, or found with
    `exported === false` → **E10012** `ImportNonExported` (one diagnostic per bad name,
    span on the name).
  - Found + exported → insert the **same `Symbol` reference** into the importing module's
    scope under `name` (aliasing, not copying — `symbolOf`/FQN recovery keep working
    because the symbol's `scope` stays its declaring module, which is exactly how the
    adapter derives `Module.function`). Name already present in the importing scope →
    **E10003** `DuplicateDecl`.
- Aliasing (`as`) is named-deferred (AR-13) — the parser accepts only plain identifiers
  today (`parser.ts:194-242`).
- Imported non-function symbols (variables/constants) resolve through the same mechanism
  for free; their cross-module *lowering* is not exercised in 5a's fixture and is 5b's
  concern.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Callee unresolved | E10100 + poison (existing pattern) | AR-5 |
| Callee is interrupt / main / non-function | E10051 / E10023 / E10175 + poison | AR-10/11/9 |
| Arg count / arg type | E10170 / E10171; count failure skips per-arg type checks | AR-5 |
| `return;` in non-void / return-type mismatch | E10172 / E10152-53-54 with return wording | AR-6 |
| Recursion (direct or indirect) | one E10174 per SCC, full path, pre-SFA poison | AR-7 |
| Duplicate param / param shadows module name | E10003 / E10101 at collection | AR-8 |
| Import missing or non-exported / duplicate import | E10012 / E10003 | AR-1/14 |
| Duplicate module name across files | explicit unsupported-in-this-slice ICE (merging is 5b/R20) — never a wrong E10012 | PF-005 |
| Poisoned sub-expression | R114 cascade suppression (one diagnostic per root cause) | AR-5/6 |
| All checks | emit diagnostics, never throw (analyzer contract) | — |

## Testing Requirements

- Spec tests: 07-testing-strategy ST-05..ST-20 (positive typing + every negative code).
- Impl tests: signature cache behavior, Tarjan determinism (anchor ordering), import
  precedence edge (user module shadowing a platform id name), duplicate-module-name
  collision → unsupported ICE (PF-005), poison-cascade internals.
