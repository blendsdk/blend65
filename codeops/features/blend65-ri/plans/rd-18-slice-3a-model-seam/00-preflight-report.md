## Preflight Report: RD-18 Slice 3a — Model-Seam Proof

> **Status**: ✅ PASSED — all 6 findings resolved (fixes applied iteration 2)
> **Iteration**: 2 (fixes applied + re-verified)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-18-slice-3a-model-seam/`
> **Codebase Grounded**: ~18 source files examined, ~40 references verified (38 clean, 1 imprecise-harmless, 1 load-bearing gap — now closed)
> **Last Updated**: 2026-07-05

Not a same-session review (plan created in a prior session). The one MAJOR finding was hardened with an independent refutation challenger (verdict: claim stands).

### Codebase Context Summary

**Tech Stack:** TypeScript ESM/NodeNext strict; Yarn workspaces + Turbo; Vitest; 10 `@blend65/*` packages.
**Architecture:** Lexer→Parser→Analyzer→SFA→IL→Codegen→ACME→PRG. "Walking skeleton at slice 2": `analyze()` returns an empty `SemanticModel`, so `modelToFunctionInfo` returns `[]` and only the constant-`poke` gate assembles. Everything below the seam is real and tested.
**Key files examined:** `core/src/semantics/{semantic-model,symbol,scope,call-graph,type}.ts`, `core/src/ast/nodes.ts`, `core/src/sfa/function-info.ts`, `frontend/src/semantics/{analyze,passes,declaration-collection,intrinsic-validation}.ts`, `frontend/src/sfa/{model-adapter,symbols,plan-allocation.spec.test}.ts`, `codegen/src/il/lower.ts`, `compiler/src/api/{run-frontend,emit}.ts`, `test-harness/src/{fixture,gate.spec.test}.ts` + `testing/gate.ts`.

**Verified clean (high-signal):** FQN sanitization matches (`symbols.ts:sanitize` ≡ `lower.ts:frameSymbol` `.` →`_`); `SymbolKind` includes `"interrupt"`; `primitive("void")` valid; `intrinsic-validation.ts:166-169` passes the non-literal `poke(…,x)`; all test-harness/API symbols the acceptance tests call exist; `emitAsm`/`EmitResult.text` exist; AC-22 seam test (`plan-allocation.spec.test.ts` ST-P6) present; `codeops/_archive/rd-04-*` & `rd-05-*` annotation targets exist.

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 1 | ✅ resolved (AR-13, module scope) |
| 🟡 MINOR | 2 | ✅ resolved |
| 🔵 OBSERVATION | 3 | ✅ resolved |

---

### PF-001: Adapter cannot recover a function's module name from a `SemanticModel` 🟠 MAJOR

**Dimension:** 4 (Completeness) + 13 (Architecture Mismatch / Stale Assumption)
**Location:** `03-02-model-adapter.md` §"FQN source (AR-7)" (lines 63-85) & `fqName(fn: Symbol)` helper (62-64); `03-01-model-population.md` §`analyze()` wiring (104-112) & function-symbol build (79-81); `99-execution-plan.md` task 1.2.1 (line 54).
**Codebase Evidence:**
- `packages/core/src/semantics/symbol.ts:40-54` — `Symbol` has no `module` field.
- `packages/core/src/ast/nodes.ts:19-24,112-120` — `AstNode` = `kind`+`span` only (no parent pointer); `FunctionDeclNode` has no module field, so `Symbol.decl` can't reach it.
- Plan builds the function `Symbol` with `scope: globalScope` (`03-01:79-81`); `globalScope` has `node:null,parent:null` (`semantic-model.ts:67`). No `"module"` scope is ever created, so the scope chain never reaches a `ModuleDeclNode`.
- `packages/core/src/semantics/semantic-model.ts:29-54` — `callGraph` carries only `functions`/`edges`/`findCycles`; `symbolMap`/`typeMap` stay empty (plan `03-01:117`).
- `packages/compiler/src/api/run-frontend.ts:156` — `modelToFunctionInfo(semanticModel)` is called with the model only (no `programs`).
- Contrast `packages/codegen/src/il/lower.ts:126` — lowering reads `program.moduleDecl.name` directly from the AST it holds; the adapter holds no `ProgramNode`.

**The Problem:** `FunctionInfo.name` must equal `"<Module>.<function>"` (`Main.main`) so the SFA-emitted `__frame_Main_main` matches lowering's reference (AR-7; a mismatch = undefined symbol at assemble time → FR-3 fails). But nothing reachable from a function `Symbol` or the `SemanticModel` carries the module name. The plan's two proposed carriers both fail: (a) a `module` field on `Symbol` is a change to **`@blend65/core`**, which `02-current-state.md:72` lists as "Read-only — pure data types, already sufficient", `99:40` states Phase 1 leaves "core untouched", and no core file appears in any Related-Files/task list; (b) a `Map<Symbol,string>` in the collector's `FunctionTables` is frontend-internal and is never threaded onto the model, so `modelToFunctionInfo(model)` cannot read it. The plan defers this to "resolve during execution" but the execution plan has no task for it, and `03-02:78-85` asserts "03-01 records the module on the function `Symbol`" while `03-01:79-81` records no such field — an internal contradiction on the load-bearing path.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A (rec) | Create a real `"module"` `Scope` (`node = ModuleDeclNode`) as RD-04 Pass-1 structure; declare each function `Symbol`/scope under its module scope (not `globalScope`); adapter derives the module via `scopeOf(fn.decl).parent.node.name` (or `fn.scope.node.name`) | Adapter stays model-only (honors AR-4); no core change; module scopes are genuine reusable Pass-1 structure (honors AR-5); also fixes the `scope: globalScope` inaccuracy | Slightly more collector work; touches the `scopeOf`/scope wiring |
| B | Widen the seam to `modelToFunctionInfo(model, programs)`; read `program.moduleDecl.name` (same source as lowering) | Minimal; no core change; `programs` already in scope at `run-frontend.ts:156` | Adapter now reads the AST for the module name — partially against AR-4's "populated model, never AST"; changes the documented RD-05 seam signature |
| C | Add a `module`/`fqName` field to core `Symbol` or `SemanticModel` | Trivial adapter | **Rejected** — modifies `@blend65/core`, contradicting the plan's "core untouched" invariant and file lists |

**Recommendation:** Option A — it is the only resolution that keeps the adapter model-only (upholding AR-4, the recorded decision that this gap actually stems from), needs no core-type change, produces reusable RD-04 Pass-1 structure per AR-5, and corrects the latent `scope: globalScope` inaccuracy (a function is declared in its module scope). Option B is a legitimate lighter fallback but erodes AR-4; Option C is out of bounds.
**Confidence:** High. **Hardening:** independent challenger ran a refutation pass over the code and confirmed no reachable path exists; it surfaced Option B, incorporated above.
**User Decision:** Resolved — user accepted the recommendation; fix applied in iteration 2.

---

### PF-002: Inconsistent invocation site for `collectFunctions` (collectDeclarations vs analyze) 🟡 MINOR

**Dimension:** 3 (Logical Contradictions) / 12 (Consistency)
**Location:** `03-01-model-population.md` §"Proposed Changes" (24-27) & AR-5 (`00-ambiguity-register.md:56-63`) say `collectDeclarations` invokes function collection; the `03-01` `analyze()` code example (99-113) calls `collectFunctions(input.programs, empty.globalScope)` directly in `analyze()`; `99:55` task 1.2.2 hedges "Wire `collectDeclarations`/`analyze()`".
**Codebase Evidence:** `packages/frontend/src/semantics/passes.ts:29-31` — `collectDeclarations` returns `DeclarationTables` (structs/enums only); `analyze.ts:71` calls it.
**The Problem:** Three doc locations disagree on where the collector is invoked. If folded into `collectDeclarations` (per AR-5 "Pass 1 owns all declaration collection"), its return type must widen beyond `DeclarationTables` and `analyze()` must destructure both — which the code example doesn't show. Low stakes but the executor needs one answer.
**Options:** A — align to AR-5 (recorded decision): `collectDeclarations` owns it; widen its return and update the `03-01` code example (recommended). B — align to the code example: `analyze()` calls `collectFunctions` directly; soften AR-5's wording.
**Recommendation:** Option A — AR-5 is the recorded decision ("Pass 1 owns all declaration collection"); make the `03-01` code example match rather than contradict it.
**User Decision:** Resolved — user accepted the recommendation; fix applied in iteration 2.

---

### PF-003: Red-phase verification is over-broad — passthrough-preserving spec tests are green from the start 🟡 MINOR

**Dimension:** 11 (Ordering & Sequencing) / 7 (Testability)
**Location:** `99-execution-plan.md` task 1.1.3 ("confirm they FAIL for the right reason"); `07-testing-strategy.md` ST-1b, ST-4, ST-4b.
**Codebase Evidence:** `packages/frontend/src/semantics/analyze.ts:80-85` already returns the empty passthrough today; `plan-allocation.spec.test.ts` ST-P6 already asserts `modelToFunctionInfo(createEmptyModel()) === []`.
**The Problem:** The red step says all new spec tests must fail first, but the passthrough-*preserving* oracles (ST-1b empty-model→`[]`, ST-4 function-free→passthrough, ST-4b body-less) codify behavior that is **already green** — they are invariant guards, not red tests. An executor following 1.1.3 literally will be confused when they don't fail. Only ST-1/ST-1c/ST-2/ST-3/ST-5/ST-6 are genuinely red.
**Options:** A (only viable) — annotate in ST table / task 1.1.3 which ST cases are expected-red vs already-green guards.
**Recommendation:** Option A. Considered and dropped: rewriting the guards to fail artificially (would corrupt the immutable oracles).
**User Decision:** Resolved — user accepted the recommendation; fix applied in iteration 2.

---

### PF-004: `FunctionTables.functionScopes` is unused by the drafted wiring/adapter 🔵 OBSERVATION

**Dimension:** 13 (Redundancy)
**Location:** `03-01-model-population.md:41` (`functionScopes: ReadonlyMap<Symbol, Scope>`).
**Codebase Evidence:** the adapter resolves scopes via `model.scopeOf(fn.decl)` → `scopeByNode` (`03-02:45`, `03-01:110`); `functionScopes` (keyed by `Symbol`) is consumed nowhere in the drafted `analyze()` wiring or adapter.
**The Problem:** Dead field vs the no-dead-code standard. Either drop it or name its consumer (3b?).
**Recommendation:** Drop `functionScopes` from `FunctionTables` unless a 3a consumer is named; `scopeByNode` already covers the adapter's need. (If PF-001 Option A is adopted, re-evaluate — module/scope structure may subsume it.)
**User Decision:** Resolved — user accepted the recommendation; fix applied in iteration 2.

---

### PF-005: `mainFunction` "entry module" selection is undefined for multi-program input 🔵 OBSERVATION

**Dimension:** 1 (Ambiguities) / 9 (Edge Cases)
**Location:** `03-01-model-population.md:89` ("if `fn.name === "main"` (and module is the entry)").
**The Problem:** "the entry" module is undefined when more than one `ProgramNode` is present. Moot for the 3a single-file fixture, but the collector is billed as "reusable, extended by 3b" (AR-5), so the ambiguity is latent. Main-signature/entry validation is a deferred Pass-4 (`postCheck`) duty.
**Recommendation:** Accept for 3a; add a one-line note that entry-module selection (multi-file) is deferred to Slice 3b's `postCheck`, so the reusable collector doesn't imply a resolved rule it hasn't got.
**User Decision:** Resolved — user accepted the recommendation; fix applied in iteration 2.

---

### PF-006: Function `Symbol.type` set to the return primitive is semantically loose for the reusable-Pass-1 claim 🔵 OBSERVATION

**Dimension:** 13 (Stale Assumption, forward-looking)
**Location:** `03-01-model-population.md:79-80` ("type: <void/return primitive>").
**Codebase Evidence:** `packages/core/src/semantics/type.ts` — `primitive("void")` is valid; nothing in the 3a path reads a function symbol's `type`.
**The Problem:** A function symbol's `type` being its *return* type (rather than a callable/function type) is harmless in 3a (unconsumed) but, since AR-5 sells this as "reusable Pass-1 extended by 3b," 3b would inherit a mis-typed function symbol.
**Recommendation:** Either set it to `ERROR_TYPE` now with a `DEFERRED(3b)` note, or state explicitly that 3b assigns the real function type — don't imply the return primitive *is* the function's type.
**User Decision:** Resolved — user accepted the recommendation; fix applied in iteration 2.

---

---

## Iteration 2 — fixes applied & re-verified

> **Previous iteration**: 6 findings (1 major, 2 minor, 3 observation) — all resolved.
> **This iteration**: 0 new findings. Applied fixes re-verified against the code; no regressions.

**Fixes applied (all per recommendation):**

- **PF-001 → AR-13 (Option A).** `03-01` now builds a per-module `Scope` (`createScope("module",
  globalScope, program.moduleDecl)`) and declares each function `Symbol` in it; `03-02`'s `fqName`
  reads `fn.scope.node.name` — model-only, no `@blend65/core` change, honors AR-4, reusable by 3b.
  New AR-13 records the decision + the two rejected carriers. Re-verified in core: `ScopeKind` has
  `"module"` (`scope.ts:19`), `ModuleDeclNode.name` exists (`nodes.ts:72-77`), `createScope(kind,
  parent, node)` accepts it (`scope.ts:44`). Because the adapter now reads the **same**
  `program.moduleDecl.name` that `lower.ts:126` uses, the FQN cannot drift.
- **PF-002.** `analyze()` orchestrates `collectFunctions` alongside `collectDeclarations` (`passes.ts`
  untouched); `03-01` prose, AR-5 note, `99` tasks 1.2.1/1.2.2, and the file lists in `00-index`/`02`
  reconciled to a single answer.
- **PF-003.** `07` gained a Red-vs-Green-Guard note (expected-red ST-1/1c/2/3/5/6 vs green-guards
  ST-1b/4/4b); `99` task 1.1.3 updated to match.
- **PF-004.** Dropped the unused `FunctionTables.functionScopes`; `scopeByNode` covers the adapter.
- **PF-005.** `03-01` step 4 documents that multi-file entry-module selection defers to 3b `postCheck`.
- **PF-006.** Function `Symbol.type` set to `ERROR_TYPE` in 3a with a `DEFERRED(3b)` note.

**Regression check:** grepped all 9 docs — no stale `functionScopes`, no "invoked by
collectDeclarations", no "12 items" remnants; AR-13 threads through all eight non-report docs.

### Pass/Fail

**✅ PREFLIGHT PASSED — all 6 findings resolved.** No critical/major open; the plan is unblocked for
`exec_plan`. The one residual execution nicety (narrowing `Scope.node` → `ModuleDeclNode` via a
`kind` guard rather than a cast) is ordinary implementation work, not a plan defect.
