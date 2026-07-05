# Execution Plan: RD-18 Slice 3a — Model-Seam Proof

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-05 20:03
> **Progress**: 10/21 tasks (48%) — Phase 1 complete & green; gate golden re-mint (2.2.2) pulled forward (AR-8)
> **CodeOps Skills Version**: 3.2.0

## Overview

Close the `modelToFunctionInfo` seam so a *populated* `SemanticModel` (one `main` + one local `byte`)
flows model→SFA→symbol→ACME→PRG→VICE. Two feature phases (the frontend seam, then the three-part
acceptance) follow the specification-first ordering; a short bookkeeping phase closes the parent ACs.

**🚨 Update this document after EACH completed task!**

Specification-first ordering (per [../../../../../_shared/spec-first-ordering.md] equivalent): each
feature phase runs **spec tests → red verification → implement → green → impl tests → verify**. Spec
tests are immutable oracles derived from `07-testing-strategy.md`.

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | The seam — model population + adapter (frontend) | 9 |
| 2 | Acceptance — assemble-clean + golden + VICE | 8 |
| 3 | Rollout bookkeeping | 4 |

**Total: 21 tasks across 3 phases.**

---

## Phase 1: The seam — model population + adapter

**Reference**: [03-01-model-population.md](03-01-model-population.md),
[03-02-model-adapter.md](03-02-model-adapter.md)
**Objective**: `analyze()` returns a populated model and `modelToFunctionInfo` projects it to real
`FunctionInfo[]`, all in `@blend65/frontend` (core untouched).

### Step 1.1: Spec tests (red)

| # | Task | File |
| - | ---- | ---- |
| 1.1.1 | Write adapter spec tests ST-1/1b/1c (populated model → FunctionInfo; empty → `[]`; two-local order) using a fixture-built `SemanticModel` | `packages/frontend/src/sfa/model-adapter.spec.test.ts` |
| 1.1.2 | Write population spec tests ST-2/4b (`collectFunctions`) + ST-3/4 (`analyze` wiring) | `packages/frontend/src/semantics/function-collection.spec.test.ts`, `.../analyze.spec.test.ts` |
| 1.1.3 | **Red verification** — run the new spec tests; confirm the **expected-red** set (ST-1/1c/2/3/5/6) FAILS for the right reason (seam returns `[]`, model unpopulated) and the **green-guards** (ST-1b/4/4b — preserved passthrough) stay GREEN (07 §Red-vs-Green-Guard, PF-003) | — |

### Step 1.2: Implement

| # | Task | File |
| - | ---- | ---- |
| 1.2.1 | Create `function-collection.ts`: `collectFunctions` — a per-program **module** `Scope` (`node = ModuleDeclNode`) under the global scope; each function `Symbol` declared **in its module scope** (so `fn.scope.node.name` yields the FQN module, AR-13); function **body** scopes with ordered locals; `mainFunction`; `scopeByNode` (decl → body scope). Function symbol `type = ERROR_TYPE` (3b assigns the real type) | `packages/frontend/src/semantics/function-collection.ts` |
| 1.2.2 | Wire `analyze()` to invoke `collectFunctions` **alongside** `collectDeclarations` (each Pass-1 collector stays single-responsibility; `passes.ts` untouched — PF-002) and assemble the populated model (`callGraph` from `functions`, `mainFunction`, `scopeOf` override); leave `symbolMap`/`typeMap` empty | `packages/frontend/src/semantics/analyze.ts` |
| 1.2.3 | Implement `modelToFunctionInfo` (populated projection; `name="Module.function"`; ordered locals; empty params/callees; flags) | `packages/frontend/src/sfa/model-adapter.ts` |

### Step 1.3: Green, impl tests & hardening

| # | Task | File |
| - | ---- | ---- |
| 1.3.1 | **Green** — all Phase-1 spec tests pass; reconcile existing passthrough tests that assumed empty population (AR-9); keep the RD-05 AC-22 empty-model test green | `packages/frontend/src/semantics/*.test.ts`, `packages/frontend/src/sfa/plan-allocation.spec.test.ts` (verify unchanged) |
| 1.3.2 | Impl tests: body-less fn, two-local order, function-free program, interrupt decl (`isInterrupt`), `scopeOf` miss (ST-10 diagnostic-not-crash) | `.../function-collection.impl.test.ts`, `.../model-adapter.impl.test.ts` |
| 1.3.3 | Boundary check ST-9: confirm no `@blend65/codegen` import (ESLint + `test/boundary.spec.test.ts`) | — |

**Deliverables**:
- [x] Populated model + implemented adapter; all Phase-1 spec + impl tests green
- [x] Existing passthrough tests reconciled; AC-22 test still green; R15 boundary intact

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Acceptance — assemble-clean + golden + VICE

**Reference**: [03-03-acceptance-fixtures.md](03-03-acceptance-fixtures.md)
**Objective**: the local-byte fixture assembles clean, has a CI golden, and VICE-verifies on real
hardware; the existing gate golden is re-minted without regression.

### Step 2.1: Spec tests (red)

| # | Task | File |
| - | ---- | ---- |
| 2.1.1 | Create the fixture program `examples/slice3a/main.blend` (`let x: byte = 5; poke(0xD020, x)`) | `examples/slice3a/main.blend` |
| 2.1.2 | Write the assemble-clean + VICE spec tests (ST-5, ST-7) with `buildSlice3a`/`emitAsm3a` helpers (mirror `testing/gate.ts`) | `packages/test-harness/src/slice3a.spec.test.ts`, `.../testing/*` |
| 2.1.3 | Write the golden spec test (ST-6) referencing a not-yet-existing golden | `packages/test-harness/src/golden-slice3a.spec.test.ts` |
| 2.1.4 | **Red verification** — run them; assemble-clean/golden FAIL (no golden yet; frame symbols must appear) | — |

### Step 2.2: Mint & re-mint

| # | Task | File |
| - | ---- | ---- |
| 2.2.1 | Mint `test/golden/slice3a.asm.golden` via `UPDATE_GOLDEN=1`; inspect that it contains `__frame_Main_main` + `__frame_Main_main_x` | `packages/test-harness/test/golden/slice3a.asm.golden` |
| 2.2.2 | Re-mint the gate golden (AR-8): run gate golden → fail → `UPDATE_GOLDEN=1` → **inspect diff is only the added `__frame_Main_main` line** | `packages/test-harness/test/golden/gate.asm.golden` |

### Step 2.3: Green & hardening

| # | Task | File |
| - | ---- | ---- |
| 2.3.1 | **Green (CI tiers)** — assemble-clean + both goldens pass (golden runs without VICE) | — |
| 2.3.2 | **VICE (local)** — ST-7 asserts `$D020 == 0xF5`; re-run `gate.spec.test.ts` for non-regression (ST-8) on real VICE 3.10 | — |

**Deliverables**:
- [ ] Fixture assembles to a loadable PRG with `__frame_*` symbols; CI golden committed; VICE green
- [ ] Gate golden re-minted (diff = one line) with gate VICE non-regression

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (VICE tiers proven locally; `skipIf` in CI)

---

## Phase 3: Rollout bookkeeping

**Reference**: [01-requirements.md](01-requirements.md) FR-6/FR-7
**Objective**: close the parent ACs this slice advances and reconcile the roadmap.

| # | Task | File |
| - | ---- | ---- |
| 3.1.1 | Tick RD-05 AC-22 supersession (seam implemented for populated models) + the RD-04 scope AC 3a advances; note in the parent RD headers | `codeops/_archive/rd-05-*`, `codeops/_archive/rd-04-*` (annotations only) |
| 3.1.2 | Tick RD-18 AC-1 (Slice 3a) in `RD-18-codegen-language-completion.md`; annotate roadmap RD-04/RD-05 rows ("slice-scoped; full scope driven by RD-18") | `requirements/RD-18-*.md`, `00-roadmap.md` |
| 3.1.3 | Record the SR-2 `ResourceReport` delta (bytes/ZP the local adds vs the constant gate) in this plan's closeout | this doc (closeout note) |
| 3.1.4 | Confirm `git status --porcelain spec/` is empty (FR-7/D3); final full verify | — |

**Deliverables**:
- [ ] Parent ACs ticked; roadmap annotated; `spec/` clean; resource delta recorded

**Verify**: `git status --porcelain spec/` empty **and** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE:** single source of truth for progress. After each task: mark `[x]` with a
> timestamp (`✅ completed: YYYY-MM-DD HH:MM`), update the Progress header, never batch. Reconstruct
> this list from the phase details if missing.

### Phase 1: The seam
- [x] 1.1.1 Adapter spec tests ST-1/1b/1c — ✅ completed: 2026-07-05 20:03
- [x] 1.1.2 Population + `analyze` spec tests ST-2/3/4/4b — ✅ completed: 2026-07-05 20:03
- [x] 1.1.3 Red verification — ✅ completed: 2026-07-05 19:55 (expected-red ST-1/1c/2/3 fail for the right reason; green-guards ST-1b/4 stay green; ST-4b via missing-module import — see red-vs-green-guard note)
- [x] 1.2.1 Create `function-collection.ts` (module scope + function/body scopes; AR-13) — ✅ completed: 2026-07-05 20:03
- [x] 1.2.2 Wire `analyze()` (alongside `collectDeclarations`) → populated model — ✅ completed: 2026-07-05 20:03
- [x] 1.2.3 Implement `modelToFunctionInfo` — ✅ completed: 2026-07-05 20:03
- [x] 1.3.1 Green + reconcile passthrough tests (AR-9 — ST-S21 `mainFunction`); AC-22 still green — ✅ completed: 2026-07-05 20:03
- [x] 1.3.2 Impl tests (population + adapter edges) — ✅ completed: 2026-07-05 20:03
- [x] 1.3.3 R15 boundary check (ST-9) — ✅ completed: 2026-07-05 20:03 (ESLint clean; boundary tier green — core-only imports)

### Phase 2: Acceptance
- [ ] 2.1.1 Fixture `examples/slice3a/main.blend`
- [ ] 2.1.2 Assemble-clean + VICE spec tests (ST-5/7)
- [ ] 2.1.3 Golden spec test (ST-6)
- [ ] 2.1.4 Red verification (assemble/golden fail)
- [ ] 2.2.1 Mint `slice3a.asm.golden`
- [x] 2.2.2 Re-mint gate golden (diff = one line, AR-8) — ✅ completed: 2026-07-05 20:03 (pulled forward: the Phase-1 seam adds `__frame_Main_main = $0800`; `git diff` = exactly one inserted line, no code drift; gate VICE non-regression ST-8 discharged in Phase 2's VICE tier)
- [ ] 2.3.1 Green — CI tiers (assemble + goldens)
- [ ] 2.3.2 VICE green (ST-7) + gate non-regression (ST-8)

### Phase 3: Bookkeeping
- [ ] 3.1.1 Tick RD-05 AC-22 + RD-04 scope AC
- [ ] 3.1.2 Tick RD-18 AC-1; annotate roadmap rows
- [ ] 3.1.3 Record ResourceReport delta (SR-2)
- [ ] 3.1.4 `spec/` clean + final full verify

---

## Dependencies

```
Phase 1 (seam: population + adapter)
    ↓   (real FunctionInfo now flows to SFA)
Phase 2 (acceptance: assemble-clean + golden + VICE; gate re-mint)
    ↓
Phase 3 (bookkeeping: parent ACs + roadmap + spec/ clean)
```

No external prerequisites: all dependency packages (core, frontend SFA, codegen, compiler, test-harness)
are complete; ACME + VICE 3.10 are installed locally.

---

## Success Criteria

**Slice 3a is complete when:**

1. ✅ All 21 tasks completed across 3 phases
2. ✅ Full workspace verify passing (build + typecheck + lint + all tests, incl. R15 boundary tier)
3. ✅ No warnings/errors; no ICE on any 3a path
4. ✅ No dead code — the population is a reusable Pass-1 slice (extended by 3b), not a throwaway
5. ✅ Security: population/adapter emit-diagnostic-never-throw; no new user file/shell surface
6. ✅ The three-part acceptance bar passes: CI assemble-clean + CI golden + local VICE (`$D020==0xF5`)
7. ✅ `git status --porcelain spec/` empty (D3); parent ACs ticked; roadmap annotated
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
