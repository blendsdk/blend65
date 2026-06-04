# Execution Plan: RD-04 Semantic Analysis (Skeleton)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Commit mode**: `--no-commit` — implement, verify, update this plan; the user performs all git operations (D12).
> **Progress**: 3/3 phases complete (100%) — Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅ — awaiting user commit (`--no-commit`)
> **Last Updated**: 2026-06-04



> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01/RD-02/RD-03/RD-11a)

## Overview

Implement the RD-04 **passthrough skeleton** in three phases, **spec-tests-first**. The
semantic data vocabulary (`Type` + utils, `Scope`, `Symbol`, `CallGraph`, `ConstValue`,
`PlatformProfile` stub, `SemanticModel`) is added to `@blend65/core` (`semantics/`); the
passthrough `analyze()` + four stubbed pass functions are added to `@blend65/frontend`
(`semantics/`). All additive — the frozen AST/diagnostics core is never refactored. `analyze()`
enforces **none** of R30–R117; the [Deferred Semantics Ledger](08-deferred-semantics-ledger.md)
is the authoritative map of what is not implemented. Each phase ends green against the verify
command. No git operations are performed (D12).

**Verify command (run at the end of every phase):**

```bash
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

## Pre-flight (confirmed before execution)

- **D1–D15** ([00-ambiguity-register](00-ambiguity-register.md)) confirmed with the user.
  (D13/D14 added by the preflight audit: `bitWidth`/`byteSize` contract, and the lint
  mechanism for stub seams. **D15** added during Phase 1 execution — supersedes D14 — when the
  verify gate revealed the seams fail `tsc --noUnusedParameters` before ESLint: resolved with
  `_`-prefixed params + root-ESLint `argsIgnorePattern: "^_"`.)

- No open micro-decisions. If a runtime ambiguity surfaces, STOP and log it as the next `D-N`
  (runtime), resolve with the user, back-propagate, resume.

## Implementation Phases

| Phase | Title                                                      | Sessions | Est. Time |
| ----- | ---------------------------------------------------------- | -------- | --------- |
| 1     | Core semantic vocabulary (`Type`, utils, scope/symbol/model) | 1–2    | 90 min    |
| 2     | Frontend passthrough `analyze()` + pass seams              | 1        | 60 min    |
| 3     | Deferral docs (ledger/markers/banner) + acceptance & close | 1        | 45 min    |

**Total: ~3 sessions, ~3 hours.**

---

## Phase 1 — Core semantic vocabulary

**Reference**: [03-01](03-01-type-model.md), [03-02](03-02-scope-symbol-model.md). **Goal:**
the full RD-04 §4 data vocabulary exists in `@blend65/core`'s new `semantics/` module; pure
structural type utils implemented; policy utils stubbed; barrel wired. Core stays
dependency-free.

| #   | Task | File |
| --- | ---- | ---- |
| 1.0 | **Preflight verification (F4):** confirm the core AST barrel exports `AstNode`, `ExprNode`, `StructDeclNode`, `EnumDeclNode` before authoring `semantics/` imports (e.g. `grep -nE "AstNode\|ExprNode\|StructDeclNode\|EnumDeclNode" packages/core/src/ast/index.ts`). Confirmed at preflight 2026-06-03; re-confirm here. | `packages/core/src/ast/index.ts` (read-only) |
| 1.1 | Write spec tests **first**: ST-S1–S20 (type union, utils, profile stub, scope/symbol/callgraph/model) | `packages/core/src/semantics/{type,type-utils,platform-profile,semantic-model}.spec.test.ts` |
| 1.2 | Verify 1.1 tests FAIL (red phase) | — |
| 1.3 | Create `semantics/type.ts` (`Type` union + `ERROR_TYPE`/`primitive`) and `semantics/platform-profile.ts` (stub + `DEFAULT_PROFILE`) | `packages/core/src/semantics/type.ts`, `platform-profile.ts` |
| 1.4 | Create `semantics/type-utils.ts`: implement `isInteger/isSigned/isUnsigned/bitWidth/byteSize/isError/typeName` (per D13 contract); stub `isAssignableTo`/`commonType` with `// DEFERRED(RD-04-checker)` markers + `_`-prefixed unused params (D10/D15) | `packages/core/src/semantics/type-utils.ts` |

| 1.5 | Create `semantics/scope.ts`, `symbol.ts`, `const-value.ts`, `call-graph.ts` (`emptyCallGraph`), `semantic-model.ts` (`createEmptyModel`) | `packages/core/src/semantics/*` |
| 1.6 | Create `semantics/index.ts`; wire `export * from "./semantics/index.js";` into core barrel | `packages/core/src/semantics/index.ts`, `packages/core/src/index.ts` |
| 1.7 | Verify 1.1 tests PASS (green phase); write impl tests (type-utils edge cases, scope wiring) | `packages/core/src/semantics/{type-utils,scope}.impl.test.ts` |
| 1.8 | Run verify. **Phase gate:** build+typecheck+lint green; core has no `@blend65/*` deps; R15 tier green; `git status --porcelain spec/` empty | — |

---

## Phase 2 — Frontend passthrough `analyze()` + pass seams

**Reference**: [03-03](03-03-passthrough-analyzer.md). **Goal:** `analyze(input: AnalyzeInput):
SemanticModel` exists in `@blend65/frontend`, returns the empty model, emits nothing, never
throws; four stubbed pass functions provide named seams. Imports `@blend65/core` only.

| #   | Task | File |
| --- | ---- | ---- |
| 2.1 | Write spec tests **first**: ST-S21–S26 (parse→analyze, error-laden input, empty programs, bag untouched, `AnalyzeInput` constructible, pass seams callable) | `packages/frontend/src/semantics/analyze.spec.test.ts` |
| 2.2 | Verify red | — |
| 2.3 | Create `semantics/passes.ts` (four stubbed `// DEFERRED(RD-04-checker)` pass functions) | `packages/frontend/src/semantics/passes.ts` |
| 2.4 | Create `semantics/analyze.ts` (`AnalyzeInput`, `analyze()` → `createEmptyModel()`, calls the four seams) | `packages/frontend/src/semantics/analyze.ts` |
| 2.5 | Create `semantics/index.ts`; wire `export * from "./semantics/index.js";` into frontend barrel | `packages/frontend/src/semantics/index.ts`, `packages/frontend/src/index.ts` |
| 2.6 | Verify green | — |
| 2.7 | Run verify. **Phase gate:** green; R15 tier green (frontend imports core only); spec untouched | — |

---

## Phase 3 — Deferral docs + acceptance & closeout

**Reference**: [08](08-deferred-semantics-ledger.md), [01 §AC](01-requirements.md). **Goal:**
the three-layer deferral record is complete and the requirements doc is annotated; walk the
acceptance criteria; mark plan complete.

| #   | Task | File |
| --- | ---- | ---- |
| 3.1 | Confirm every stub site carries an in-code `// DEFERRED(RD-04-checker): Rxx` marker (type-utils policy stubs + four pass seams + model query helpers); fix any missing | `packages/core/src/semantics/*`, `packages/frontend/src/semantics/*` |
| 3.2 | Confirm [08-deferred-semantics-ledger.md](08-deferred-semantics-ledger.md) covers all R1–R121 + AC-01..AC-20 (authored in planning; reconcile against as-built code) | `plans/rd-04-semantic-analysis/08-deferred-semantics-ledger.md` |
| 3.3 | Add the `SEMANTICS-DEFERRED` banner to `requirements/RD-04-semantic-analysis.md` (R30–R117 + AC-02..AC-20 deferred; R1–R29/R118–R121 + AC-01 in scope) — D9; doc not frozen | `requirements/RD-04-semantic-analysis.md` |
| 3.4 | Tick AC-S1..AC-S8 + FR-S1..FR-S20 in `01-requirements.md`; set Index status → "Implemented" | `01-requirements.md`, `00-index.md` |
| 3.5 | Confirm `git status --porcelain spec/` empty (D3) and R15 boundary green (ST-R15a/b/c) | — |
| 3.6 | Final verify run; record result here. **STOP** — hand off to the user for commit (`--no-commit`) | — |

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> 1. **After completing each task:** mark it `[x]` with a timestamp — e.g.
>    `- [x] 1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`.
> 2. **After completing each phase:** confirm every task in that phase is `[x]`.
> 3. **Update the Progress header** (`> **Progress**: X/Y …`) after every update.
> 4. **This checklist MUST exist** — reconstruct it from the phase tables if missing.
> 5. **Never batch updates** — update immediately after each task.

### Phase 1 — Core semantic vocabulary ✅
- [x] 1.0 Preflight verification (F4): AST barrel exports `AstNode`/`ExprNode`/`StructDeclNode`/`EnumDeclNode` ✅ (completed: 2026-06-04 08:27)
- [x] 1.1 Spec tests first (ST-S1–S20) ✅ (completed: 2026-06-04 08:30)
- [x] 1.2 Verify red ✅ (completed: 2026-06-04 08:31 — 20 new spec tests failed as expected)
- [x] 1.3 Create `type.ts` + `platform-profile.ts` ✅ (completed: 2026-06-04 08:31)
- [x] 1.4 Create `type-utils.ts` (pure impl + DEFERRED policy stubs, D13/D15) ✅ (completed: 2026-06-04 08:44)
- [x] 1.5 Create `scope.ts`/`symbol.ts`/`const-value.ts`/`call-graph.ts`/`semantic-model.ts` ✅ (completed: 2026-06-04 08:34)
- [x] 1.6 Create `semantics/index.ts` + wire core barrel ✅ (completed: 2026-06-04 08:35)
- [x] 1.7 Verify green + impl tests ✅ (completed: 2026-06-04 08:37 — 124 core tests pass)
- [x] 1.8 Run verify (phase gate) ✅ (completed: 2026-06-04 08:45 — full verify green across all 10 packages; D15 surfaced+resolved; `spec/` clean)


### Phase 2 — Frontend passthrough analyze ✅
- [x] 2.1 Spec tests first (ST-S21–S26) ✅ (completed: 2026-06-04 08:51)
- [x] 2.2 Verify red ✅ (completed: 2026-06-04 08:51 — 6 new spec tests failed as expected)
- [x] 2.3 Create `passes.ts` (four DEFERRED seams, `_`-prefixed params per D15) ✅ (completed: 2026-06-04 08:52)
- [x] 2.4 Create `analyze.ts` (`AnalyzeInput` + passthrough `analyze`) ✅ (completed: 2026-06-04 08:52)
- [x] 2.5 Create `semantics/index.ts` + wire frontend barrel ✅ (completed: 2026-06-04 08:53)
- [x] 2.6 Verify green ✅ (completed: 2026-06-04 08:54 — frontend spec+impl tests pass)
- [x] 2.7 Run verify (phase gate) ✅ (completed: 2026-06-04 08:54 — full verify green; R15 tier ST-R15a/b/c green; `spec/` clean)


### Phase 3 — Deferral docs + acceptance & closeout ✅
- [x] 3.1 Confirm in-code `// DEFERRED(RD-04-checker)` markers at every stub site ✅ (completed: 2026-06-04 08:55 — grep confirmed markers in call-graph/type-utils/semantic-model + 4 pass seams)
- [x] 3.2 Confirm ledger covers R1–R121 + AC-01..AC-20 ✅ (completed: 2026-06-04 08:56 — reconciled against as-built code)
- [x] 3.3 Add `SEMANTICS-DEFERRED` banner to requirements doc ✅ (completed: 2026-06-04 08:56)
- [x] 3.4 Tick AC-S/FR-S in `01-requirements.md`; Index → "Implemented" ✅ (completed: 2026-06-04 08:59)
- [x] 3.5 Confirm spec clean + R15 boundary green ✅ (completed: 2026-06-04 09:00 — `git status --porcelain spec/` empty; ST-R15a/b/c green)
- [x] 3.6 Final verify; STOP — hand off to user for commit (`--no-commit`) ✅ (completed: 2026-06-04 09:00 — canonical `install --frozen-lockfile && build && typecheck && lint && test` all green)

> **Final verify result (Phase 3.6):** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` — **ALL GREEN** (build 10/10, typecheck 17/17, lint 10/10, test 17/17 + root R15 boundary tier ST-R15a/b/c). `git status --porcelain spec/` empty. **Plan complete — awaiting user commit (`--no-commit`, D12).**


---

## Dependencies

```
Phase 1 (core semantic vocabulary)
    ↓
Phase 2 (frontend passthrough analyze)
    ↓
Phase 3 (deferral docs + acceptance)
```

## Success Criteria

**Feature is complete when:**

1. ✅ All 3 phases completed.
2. ✅ All verification passing (`yarn install --frozen-lockfile && build && typecheck && lint && test`).
3. ✅ No warnings/errors.
4. ✅ No dead code — stub params/functions carry the documented `// DEFERRED` rationale (code.md rule-4 exception for planned seams).
5. ✅ Security N/A (offline compiler component — no input/auth/network surface).
6. ✅ FR-S1..FR-S20 + AC-S1..AC-S8 ticked; `requirements/RD-04-semantic-analysis.md` carries the `SEMANTICS-DEFERRED` banner; the Deferred Semantics Ledger covers all R1–R121 + AC-01..AC-20.
7. ✅ `git status --porcelain spec/` empty (D3); R15 boundary green (ST-R15a/b/c).
8. ✅ **Post-completion:** ask the user to re-analyse the project and update `.clinerules/project.md`.

## Notes

- **Frozen baselines:** `spec/` is read-only (D3); the AST + diagnostics core are
  extended-not-refactored — only barrels are appended. `git status --porcelain spec/` must stay empty.
- **R15/AR-20 (load-bearing):** `@blend65/frontend` imports `@blend65/core` only; never
  `@blend65/codegen`. The root boundary tier guards this every phase.
- **Spec-tests-first:** each phase writes failing tests before implementation (testing.md Rule 10).
- **No git ops:** `--no-commit` — the agent stops at Phase 3.6 for the user's commit.
- **Deferral is the deliverable:** the [Deferred Semantics Ledger](08-deferred-semantics-ledger.md)
  + in-code `// DEFERRED(RD-04-checker)` markers + the requirements banner are first-class
  outputs (D8), so the real checker can be resumed from a precise map.
- **Coding standards (code.md):** no `private` (use `protected`); 2-space indent; ESM `.js`
  relative imports; kebab-case filenames; `*.impl.test.ts` for logic, `*.spec.test.ts` for
  behavioral/spec tiers. Split any file approaching 500 lines.
- **Runtime ambiguities:** if one surfaces, STOP, log it as the next `D-N` (runtime) in
  `00-ambiguity-register.md`, resolve with the user, back-propagate, resume.
