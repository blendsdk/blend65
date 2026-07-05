# Ambiguity Register: RD-18 Slice 3a — Model-Seam Proof

> **Status**: ✅ GATE PASSED — all 13 items resolved
> **Last Updated**: 2026-07-05 (AR-13 added by preflight PF-001)
> **Plan**: `rd-18-slice-3a-model-seam` (implements `blend65-ri/RD-18`, Slice 3a)

Scope of this gate: **Slice 3a only** — the keystone plumbing slice that wires a *populated*
`SemanticModel` through `modelToFunctionInfo` so the SFA planner emits real `__frame_*` symbols and
the existing gate + one local `byte` assemble → PRG → VICE through the real model path. RD-18 mandates
one `make_plan` per slice; the type engine (Slice 3b) and all later surfaces are out of scope here.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | What scope does this plan cover? | 3a only / 3a+3b combined / whole RD-18 | **Slice 3a only** | ✅ Resolved |
| 2 | Scope / Technical | What should the 3a acceptance fixture prove on VICE? | Use-the-local (`let x:byte=5; poke($D020,x)`) / declare-only local + constant poke | **Use-the-local** | ✅ Resolved |
| 3 | Technical / Process | Which command fills the plan's Verify lines? | Full workspace verify / targeted workspace test | **Full workspace verify** | ✅ Resolved |
| 4 | Technical / Integration | Does the adapter read the *populated model* or walk the AST directly? | Populated model (per RD-05 seam) / AST shortcut | **Populated model** (single viable path — RD-05 contract + RD-18 AC-1) | ✅ Resolved |
| 5 | Technical / Naming | Where does the 3a model population live, and how much does it build? | Reusable Pass-1 slice in a new `function-collection.ts` (extended by 3b) / fold into `declaration-collection.ts` / throwaway 3a-only shim | **Reusable Pass-1 slice, new `function-collection.ts`** (dominant path — no-dead-code standard; 3b extends it) | ✅ Resolved |
| 6 | Data & state | Where does the declaration order of `FunctionInfo.locals` come from? | `Scope.symbols` Map insertion order / an explicit ordered list type | **Map insertion order** (dominant path — ES2015-guaranteed; codebase already relies on Map order for goldens) | ✅ Resolved |
| 7 | Naming | What is `FunctionInfo.name` for `module Main; function main`? | `"Main.main"` / `"main"` | **`"<Module>.<function>"` → `"Main.main"`** (constraint — matches `lower.ts:153` fqName) | ✅ Resolved |
| 8 | Behavioral / Testing | The existing constant-gate ASM golden changes once `main` is a real `FunctionInfo`. How handled? | Re-mint via `UPDATE_GOLDEN=1` + re-verify on VICE / block the change | **Re-mint + VICE re-verify** (consequence — intentional oracle re-mint per RD-18 acceptance bar #3) | ✅ Resolved |
| 9 | Integration / Testing | Existing analyze/passes tests assume an empty populated model. What happens to them? | Update to reflect intentional 3a population; keep AC-22 empty-model→[] test / leave broken | **Update; AC-22 stays valid** (dictated — empty model still yields `[]`) | ✅ Resolved |
| 10 | Technical | How does the adapter map a function symbol → its ordered locals? | Function `Scope` via `model.scopeOf(decl)` / re-walk AST | **Function `Scope` from the populated model** (single path — honors the seam) | ✅ Resolved |
| 11 | Scope | VICE target platform + expected observable? | c64 (`DEFAULT_PROFILE`); `$D020` reads back `0xF5` | **c64; `$D020 == 0xF5`** (constraint — VIC-II unused nibble, AR-H19) | ✅ Resolved |
| 12 | Scope / Security | New diagnostic codes / parked questions / Language-Guard items / `spec/` edits in 3a? | None (pure plumbing) | **None** (constraint — Q1→S7, Q2→S8, Q3/Q4→S4; `spec/` frozen per D3) | ✅ Resolved |
| 13 | Technical / Integration | How does the adapter recover a function's **module** (for the FQN) given only a `SemanticModel`? | Add `module` to core `Symbol` / widen seam to `(model, programs)` / **build a module `Scope`** and read `fn.scope.node.name` | **Build a per-module `Scope`; declare functions in it; adapter reads `fn.scope.node.name`** (preflight PF-001 — model-only, no core change, honors AR-4, reusable by 3b) | ✅ Resolved |

### Resolution Notes

**AR-1 (Scope — Slice 3a only).** User selected "Slice 3a only". RD-18 Functional Requirements:
"Each slice = one `make_plan` derived from RD-18"; roadmap `00-roadmap.md:170` names Slice 3a the
keystone. 3a+3b was rejected as it contradicts the keystone-split rationale (RD-18 AR-112 — prove
the seam before piling on ~20 RD-04 requirements); whole-RD was rejected as violating the per-slice
mandate.

**AR-2 (Fixture — use-the-local).** User selected `let x: byte = 5; poke(0xD020, x)`. This reads
the frame slot back into `poke`, proving `__frame_Main_main_x` **resolves in a real `load`**
(store→load path via `lower.ts:201-208,268-273`), not merely appears in the symbol header. VICE
asserts `$D020 == 0xF5`. No new lowering work: `LetDecl`, `IdentExpr`→`load`, and the `poke`
intrinsic are already handled (`lower.ts:185,227,233`), and non-literal `poke` value args pass
intrinsic validation (`intrinsic-validation.ts:166-169`). Strictly exceeds RD-18 AC-1's minimum
(symbol present + poked value asserted).

**AR-3 (Verify command).** User selected the full workspace verify from CLAUDE.md:
`yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`.
This fills phase-completion Verify lines; it catches the R15 boundary
(`frontend`/`language-server` must not import `codegen`) and cross-package regressions the seam
could trip. Targeted `yarn workspace @blend65/<pkg> test` is used for the inner loop but the plan's
gate is the full verify.

**AR-4 (Adapter reads the populated model).** Single viable path: `modelToFunctionInfo(model)`
receives only a `SemanticModel` (RD-05 `03-05-allocation-plan-and-api.md:145-161`), and RD-18 AC-1
requires assembling "through the **real** populated-model path (not the empty-model stub)". An
AST-walking adapter would break the seam contract (the whole point is that when RD-04 populates the
model, *only* the adapter fills in) and would force Slice 3b to rework it. Rejected.

**AR-5 (Population home — reusable Pass-1 slice).** The population registers function symbols +
ordered locals + function scopes + `mainFunction` into the model. This is the leading edge of
RD-04 Pass 1 (declaration/scope collection), which Slice 3b then *extends* with the full
scope/symbol table + typing. It lives in a new `packages/frontend/src/semantics/function-collection.ts`
invoked by `analyze()` **alongside** `collectDeclarations` (each Pass-1 collector stays
single-responsibility; `passes.ts` untouched — refined by preflight PF-002), leaving RD-17's
struct/enum `declaration-collection.ts` untouched (single responsibility). A throwaway 3a-only shim was rejected
(violates the no-dead-code standard; 3b would discard it). File placement (new module vs same file)
is the only cosmetic degree of freedom; a dedicated module is chosen for single responsibility.

**AR-6 (Local order — Map insertion order).** `FunctionInfo.locals` must be in declaration order
(SFA R6). `Scope.symbols` is a `Map<string, Symbol>` (`scope.ts:29`); ES2015 guarantees Map
iteration in insertion order, and the codebase already depends on Map order for deterministic golden
output (`symbols.ts` deterministic ordering). Populating in source order and iterating
`scope.symbols.values()` yields declaration order with zero new types. Adding an explicit ordered
list was rejected as redundant.

**AR-7 (`FunctionInfo.name` = `Module.function`).** `lower.ts:153` computes
`fqName = ` `` `${moduleName}.${fn.name}` `` and fetches the frame via `plan.frames.get(fqName)`;
`frameSymbol` (`lower.ts:538`) renders `__frame_${fqName.replaceAll(".","_")}_${varName}`. The
adapter MUST set `FunctionInfo.name = "Main.main"` so `plan.frames` is keyed identically — otherwise
the emitted `__frame_*` reference is undefined at assemble time. Single interpretation for
consistency.

**AR-8 (Gate golden re-mint).** Once `main` is a real `FunctionInfo`, even with zero locals it gets
a `__frame_Main_main` base symbol (RD-05 `03-05-...md:177-179`). The committed
`packages/test-harness/test/golden/gate.asm.golden` (today: only ZP symbols, no `__frame_*`) will
gain that line. This is an **intentional** oracle change: regenerate with `UPDATE_GOLDEN=1`, inspect
the diff, and re-verify on real VICE per the RD-18 acceptance bar part 3 (a golden is only re-minted
when runtime behavior is re-proven). Documented so the change is not mistaken for a regression.

**AR-9 (Existing-test regression management).** Tests asserting the empty-population passthrough for
programs that contain a `main` (e.g. `analyze.spec.test.ts` / `passes.impl.test.ts` cases checking
an empty `callGraph`/`mainFunction`) must be updated to reflect 3a's intentional population. The
RD-05 seam test `plan-allocation.spec.test.ts:109-114` (`modelToFunctionInfo(createEmptyModel()) === []`,
AC-22) stays **valid and unchanged** — the *empty* model still yields `[]`; only a *populated*
model now yields functions. Intrinsic-free programs with no functions keep the passthrough contract.

**AR-10 (Adapter → locals mapping).** The adapter iterates `model.callGraph.functions`; for each
function `Symbol` it resolves the function `Scope` from the populated model (via `model.scopeOf(decl)`
wired during population, or the scope tree) and reads that scope's `kind: "variable"` symbols in
insertion order into `FrameVar[]`. It re-uses `primitive("byte")` types already on each local's
`Symbol.type`. No AST re-walk (honors the seam per AR-4/AR-10).

**AR-11 (Platform + observable).** c64 via `DEFAULT_PROFILE` (the profile `run-frontend.ts:144,162`
already passes). The observable is the VIC-II border register `$D020`; per RD-12 AR-H19 it reads
back `0xF5` (only the low nibble is writable), so the VICE assertion is `$D020 == 0xF5` for
`poke(0xD020, 5)` — consistent with the existing gate test (`gate.spec.test.ts:44-47`).

**AR-12 (No new codes / parked questions / spec edits).** Slice 3a is pure plumbing: it introduces
no diagnostics, owns none of the four parked ledger questions (Q3/Q4 → Slice 4, Q1 → Slice 7,
Q2 → Slice 8), and touches no Language-Guard surface. `git status --porcelain spec/` must stay empty
throughout (decision D3).

**AR-13 (Module carrier for the FQN — build a module `Scope`).** Added by preflight (PF-001). The
adapter must emit `FunctionInfo.name = "Main.main"` to match `lower.ts:126,153`
(`${program.moduleDecl.name}.${fn.name}`), but it receives **only** a `SemanticModel` — and neither
core `Symbol` (`symbol.ts:40-54`, no module field), `AstNode` (`nodes.ts:19-24`, no parent pointer),
nor `callGraph`/`symbolMap` carries a function's module. Two carriers were considered and rejected:
adding `module: string` to core `Symbol` (**rejected** — modifies `@blend65/core`, which
`02-current-state.md` pins read-only and no file list includes), and a `Map<Symbol,string>` in the
frontend-internal `FunctionTables` (**rejected** — never reaches the model the adapter is called
with). **Resolution:** 03-01 creates a real per-module `Scope` (`kind:"module"`, `node =
ModuleDeclNode`) and declares each function `Symbol` in it (RD-04 §4.2 — functions live in their
module scope), so `fn.scope.node.name` yields the module. Model-only (honors AR-4), no core-type
change, and genuine reusable RD-04 Pass-1 structure that Slice 3b extends (honors AR-5, no dead
code). The assemble-clean test (03-03) remains the runtime backstop against any FQN mismatch.
