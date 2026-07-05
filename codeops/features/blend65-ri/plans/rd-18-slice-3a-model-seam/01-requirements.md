# Requirements: RD-18 Slice 3a — Model-Seam Proof

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) (Slice 3a row of the Slice Map)

## Feature Overview

Slice 3a is the keystone plumbing slice of the RD-18 vertical rollout. It closes the single
`modelToFunctionInfo` seam that starves the SFA planner, and proves — end-to-end on real 6502
hardware — that a *populated* `SemanticModel` flows all the way to a loadable PRG with real
`__frame_*` symbols. It deliberately carries the **minimum** real payload: one function (`main`)
with one local `byte`.

Concretely, three things change:

1. **Model population** — `analyze()` returns a model that carries `main` as a function `Symbol` in
   `callGraph.functions`, its local `byte` as a variable `Symbol` (declaration order) in a function
   `Scope`, and `mainFunction` set. This is a reusable slice of RD-04 Pass 1 that Slice 3b extends
   (AR-5).
2. **Adapter** — `modelToFunctionInfo` projects that model into `FunctionInfo[]`
   (`name = "Main.main"`, ordered `locals`, empty params/callees for the 3a surface).
3. **Acceptance** — a `.blend` fixture (`let x: byte = 5; poke(0xD020, x)`) with the RD-18 three-part
   bar: CI assemble-clean, CI ASM golden, local VICE runtime.

Everything downstream of the adapter (SFA passes, symbol generation, ACME, PRG, VICE harness) already
works and is exercised today against `FunctionInfo` fixtures; Slice 3a supplies the first *real*
`FunctionInfo`.

## Functional Requirements

### Must Have

- [ ] **FR-1 — Populate a minimal real `SemanticModel`.** `analyze()` creates a per-module `Scope`,
      registers each function declaration as a function `Symbol` **declared in its module scope** (so
      `fn.scope.node.name` yields the module, AR-13) in `callGraph.functions`, sets `mainFunction` to
      the resolved `main` symbol, and registers each function's local `LetDecl`s as `kind: "variable"`
      symbols (with their declared primitive type) in a function-kind **body** `Scope`, in declaration
      order. Intrinsic-free programs with **no** functions keep the empty-model passthrough (no
      diagnostics, never throws). *(AR-4, AR-5, AR-9, AR-13)*
- [ ] **FR-2 — Implement `modelToFunctionInfo`.** Project the populated model into `FunctionInfo[]`:
      one entry per function, `name = "<Module>.<function>"` (module read from `fn.scope.node.name`,
      the declaring module scope — AR-13), `parameters = []` (3a surface has no
      user params), `locals` = the function scope's variable symbols as `FrameVar[]` in insertion
      order, `isInterrupt`/`isEscaped` = false, `isReachable` = true for `main`, `callees = []`.
      `modelToFunctionInfo(createEmptyModel())` still returns `[]` (RD-05 AC-22 preserved). *(AR-6,
      AR-7, AR-10)*
- [ ] **FR-3 — Assemble-clean through the real model path.** The Slice 3a fixture compiles via the
      RD-15 `build()` pipeline through ACME to a **loadable c64 PRG with zero undefined symbols**;
      the emitted symbol-definitions block contains `__frame_Main_main` (base) and
      `__frame_Main_main_x` (slot). This is the real populated-model path, not the empty-model stub.
      *(RD-18 AC-1; AR-8, AR-11)*
- [ ] **FR-4 — CI ASM golden.** A committed `--emit-asm` golden of the Slice 3a fixture
      (`assertGolden`), running in the CI golden tier (no VICE), that now contains the `__frame_*`
      lines — the regression guard. The existing constant-gate golden is re-minted to add its
      `__frame_Main_main` base symbol. *(RD-18 AC-2; AR-8)*
- [ ] **FR-5 — Local VICE runtime.** An RD-12 emulator test (`skipIf(!(hasVice("c64") && hasAcme()))`)
      builds the fixture, runs it on real VICE 3.10, and asserts `$D020 == 0xF5` — proving the frame
      slot resolves in a real `load`. *(RD-18 AC-3; AR-2, AR-11)*
- [ ] **FR-6 — Close the seam's parent ACs.** Tick RD-05 AC-22's supersession (the deferred
      `modelToFunctionInfo` seam is now implemented for populated models) and the RD-04 scope AC that
      3a advances; annotate the roadmap RD-04/RD-05 rows accordingly. *(RD-18 AC-8 partial — 3a's
      share only)*
- [ ] **FR-7 — Keep `spec/` untouched.** `git status --porcelain spec/` stays empty across the
      slice. *(Decision D3; AR-12)*

### Should Have

- [ ] **SR-1 — `examples/` growth.** The `examples/slice3a/main.blend` fixture doubles as the VICE
      acceptance program and living documentation of the newly-working local-`byte` surface.
- [ ] **SR-2 — Resource-report note.** Record the code/binary/ZP delta the local `byte` adds over the
      constant gate (RD-11 `ResourceReport`), so unoptimized-size growth is visible.

### Won't Have (Out of Scope)

- **The scalar type engine (Slice 3b).** Real `isAssignableTo`/`commonType`, RD-04 Pass 1 full
  scope/symbol table, Pass 3 expression typing, Pass 4 `main` signature validation, module-level
  scalars, const-eval of `lo`/`hi`, mixed-signedness `E10081` — all Slice 3b. Slice 3a populates
  only enough of the model to carry functions + locals for the SFA seam. *(AR-1)*
- **Any control flow, user calls, `&&`/`||`, compound assignment, aggregates, interrupts** — later
  slices (4–8). 3a's surface is one `main` + one local `byte` + a `poke`.
- **New diagnostic codes / parked questions / Language-Guard work** — none in 3a (Q3/Q4→S4, Q1→S7,
  Q2→S8). *(AR-12)*
- **Optimizers** — RD-06 IL passes and RD-08 peephole stay passthrough (RD-18 Phase B).

## Technical Requirements

### Performance
- No runtime-performance target (AOT compiler). The population walk is O(functions + locals) over
  the parsed AST; negligible.

### Compatibility
- The empty-model passthrough contract is preserved for function-free / intrinsic-free programs
  (AR-9). RD-05 AC-22 (`modelToFunctionInfo(emptyModel) === []`) remains green.
- R15 / AR-20 boundary held: the new `function-collection.ts` and the adapter import `@blend65/core`
  only — **never** `@blend65/codegen`. Enforced by ESLint `no-restricted-imports` +
  `test/boundary.spec.test.ts`.

### Security
- The population and adapter **emit diagnostics, never throw** (AR-15/AR-73); malformed input that
  reaches them (e.g. a function with no body node) must degrade to the passthrough or a diagnostic,
  never an unhandled crash. No ICE (`E9xxxx`) for user input — ICEs are for compiler bugs only.
- 3a introduces no new user-controlled file/shell surface (that is Slice 8's `embed()`); the only
  external process is the already-hardened ACME invocation (RD-09).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Plan scope | 3a only / 3a+3b / whole RD-18 | **3a only** | RD-18 mandates one plan per slice; prove the seam before the type engine (AR-112) | AR-1 |
| Acceptance fixture | use-the-local / declare-only | **use-the-local** | Proves the slot resolves in a real `load`, not just appears in the header; no extra lowering work | AR-2 |
| Verify command | full workspace / targeted | **full workspace verify** | CLAUDE.md pre-commit gate; catches R15 boundary + cross-package regressions | AR-3 |
| Adapter source | populated model / AST walk | **populated model** | RD-05 seam contract + RD-18 AC-1; AST walk breaks the seam and forces 3b rework | AR-4 |
| Population home | new `function-collection.ts` / fold into `declaration-collection.ts` / throwaway shim | **new module, reusable Pass-1 slice** | Single responsibility; 3b extends it; no dead code | AR-5 |
| Local ordering | Map insertion order / explicit list | **Map insertion order** | ES2015-guaranteed; codebase already relies on Map order for goldens | AR-6 |
| `FunctionInfo.name` | `Main.main` / `main` | **`Main.main`** | Matches `lower.ts:153` fqName; else undefined `__frame_*` | AR-7 |
| FQN module carrier | core `Symbol` field / widen seam to `(model, programs)` / module `Scope` | **module `Scope`; `fn.scope.node.name`** | Model-only (no core change); reusable RD-04 Pass-1 structure | AR-13 |

> **Traceability:** every decision references `00-ambiguity-register.md` (AR-1..AR-13). No language
> rule is restated here — Slice 3a's surface traces to RD-18's Slice-Map 3a row + RD-05's adapter
> contract; the language semantics live in RD-04/06/07 + frozen `spec/`.

## Acceptance Criteria

1. [ ] `modelToFunctionInfo(populatedModel)` returns `[{ name: "Main.main", parameters: [], locals:
       [{ name: "x", type: primitive("byte"), byRef: false }], isInterrupt: false, isEscaped: false,
       isReachable: true, callees: [] }]` for the 3a fixture; `modelToFunctionInfo(createEmptyModel())`
       still returns `[]`. *(FR-2)*
2. [ ] `analyze()` on the 3a fixture returns a model with `main` in `callGraph.functions`,
       `mainFunction` set, `main.scope.node.name === "Main"` (declaring module scope, AR-13), and the
       local `x` discoverable as a `variable` symbol in `main`'s function body scope; a function-free
       intrinsic-free program still returns the empty-model passthrough. *(FR-1)*
3. [ ] The 3a fixture assembles via `build()` to a loadable c64 PRG with zero undefined symbols; its
       symbol block contains `__frame_Main_main` and `__frame_Main_main_x`. *(FR-3)*
4. [ ] The `--emit-asm` golden of the 3a fixture is committed and passes in CI; the re-minted
       constant-gate golden (now with `__frame_Main_main`) passes in CI. *(FR-4)*
5. [ ] On real VICE 3.10, the 3a fixture drives `$D020 == 0xF5`; the existing gate VICE test still
       passes. *(FR-5)*
6. [ ] RD-05 AC-22 supersession + the RD-04 scope AC that 3a advances are ticked; roadmap RD-04/RD-05
       rows annotated. *(FR-6)*
7. [ ] `git status --porcelain spec/` is empty. *(FR-7)*
8. [ ] Full workspace verify is green (build + typecheck + lint + all tests, incl. R15 boundary tier);
       no ICE on any 3a path; R15 boundary intact.
