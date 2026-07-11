# Execution Plan: RD-18 Slice 5b — Module System Completion

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-11 12:20
> **Progress**: 38/42 tasks (90%)
> **CodeOps Skills Version**: 3.3.1

## Overview

Module merging, the full qualified-access value surface, call-free module-variable
initializers with per-variable topological init order (E10194), scalar const
completion (E10193 + inlining), and the `__init` startup stream through the
`ILProgram.initCode` seam — closing RD-18 AC-4. Design owned by 03-01…03-04;
expectations owned by 07-testing-strategy (ST-1…ST-30 + ST-15b); decisions owned by
00-ambiguity-register (AR-1…AR-13, I-1…I-3) with the 2026-07-11 preflight
corrections (`00-preflight-report.md`).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
|-------|-------|-------|
| 1 | Module merging + qualified access (frontend) | 12 |
| 2 | Initializer typing, consts & init order (frontend) | 10 |
| 3 | Init codegen + lowering arms (codegen/platforms) | 10 |
| 4 | Acceptance — fixture, golden, ACME, VICE | 6 |
| 5 | Rollout bookkeeping | 4 |

**Total: 42 tasks across 5 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth**
> for progress. Every task line appears exactly once in this document. The executing
> agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) and the Last
>    Updated stamp after EVERY task — never batch updates. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

> **Standing constraints:** `spec/` frozen (`git status --porcelain spec/` empty —
> D3). No plan-artifact references (AR/ST/PF ids, plan paths) in shipped code or
> doc comments — restate rationale in plain language. Immutable oracle: never edit a
> spec test to match the implementation.

---

## Phase 1: Module merging + qualified access (frontend)

### Step 1.1: Specification tests

**Reference**: 07-testing-strategy ST-1…ST-11 · 03-01 · AR-1/2/3/9/13
**Objective**: pin merging and the full qualified value surface before any code.

- [x] 1.1.1 Write merging spec tests (ST-1, ST-2) — `packages/frontend/src/semantics/module-merging.spec.test.ts` ✅ (completed: 2026-07-11 11:08)
- [x] 1.1.2 Write qualified-access spec tests (ST-3…ST-11) — `packages/frontend/src/semantics/type-check/qualified-access.spec.test.ts` ✅ (completed: 2026-07-11 11:11)
- [x] 1.1.3 RED phase: run both files, verify every ST fails (document any pre-passer with justification) ✅ (completed: 2026-07-11 11:12 — 10/11 red; pre-passer: ST-6 value-shadowed head, pins today's silent-poison status quo that the AR-2 value-first ladder must preserve)

### Step 1.2: Implementation

**Reference**: 03-01 §1-3 · AR-9, AR-2, AR-1 rider, AR-13
**Objective**: merged scopes + `resolveQualified` + typing arms + graph/SFA parity.

- [x] 1.2.1 Name-keyed shared module scopes + `moduleScopeByName` in `FunctionTables`; `collectModuleVariables` consumes `moduleScopeByProgram` — `packages/frontend/src/semantics/function-collection.ts`, `module-variable-collection.ts`, `analyze.ts` ✅ (completed: 2026-07-11 11:15 — 397 existing frontend tests green, typecheck clean; note: the plan's "existing E10003 guard" for duplicate FUNCTION names did not exist — collectFunctions set names unconditionally; added the module-scope duplicate guard there, first-wins, mirroring module-variable-collection)
- [x] 1.2.2 Drop the E90001 dup-module guard; consume `moduleScopeByName`; record the `importEdges` output map — `packages/frontend/src/semantics/import-resolution.ts` ✅ (completed: 2026-07-11 11:18 — ST-1/ST-2 GREEN, 399 tests pass, typecheck clean; the superseded dup-module-ICE impl test was replaced HERE (not at 1.2.6) — it pins E90001, which this task removes; replaced with a merged-scope import witness)
- [x] 1.2.3 `resolveQualified` ladder + `TypeCheckContext.moduleScopes` + analyze threading — `packages/frontend/src/semantics/type-check/name-resolution.ts`, `context.ts`, `analyze.ts` ✅ (completed: 2026-07-11 11:20 — typecheck clean, 399 tests green, 8 qualified reds remain by design)
- [x] 1.2.4 `typeFieldAccess` arm + `typeCall` qualified-callee arm (shared post-resolution ladder refactor) + function-as-value ICE — `packages/frontend/src/semantics/type-check/expression-typing.ts` ✅ (completed: 2026-07-11 11:23 — 7 of 8 qualified reds now green; only the E10191 const-write red remains, owned by 1.2.5)
- [x] 1.2.5 `typeAssign` qualified-target arm (module let / E10191 const / ICE function) — `packages/frontend/src/semantics/type-check/expression-typing.ts` (typeAssign + its IdentExpr-only const guard live there, not in statement-typing) ✅ (completed: 2026-07-11 11:24 — full frontend suite green: all 11 new spec tests + 397 existing)
- [x] 1.2.6 SFA callee parity: `userCalleeOf`/`collectCalls` FieldAccessExpr arms + `modelToModuleVars` alias guard (skip symbols whose `sym.scope` isn't the iterated scope — no phantom `__var_*` for imported variables, 03-01 §3); supersede the dup-module-ICE impl test — `packages/frontend/src/sfa/model-adapter.ts`, `packages/frontend/src/semantics/call-semantics.impl.test.ts` ✅ (completed: 2026-07-11 11:26 — suite green; the impl-test supersession happened at 1.2.2 where the E90001 guard was removed; `collectCalls` needed no change — it collects CallExpr nodes regardless of callee shape)
- [x] 1.2.7 GREEN phase: ST-1…ST-11 pass (fix implementation only) ✅ (completed: 2026-07-11 11:27 — 11/11 green, no spec test edited)

### Step 1.3: Implementation tests & hardening

- [x] 1.3.1 Impl tests: merged-scope internals + qualified edge shapes — `module-merging.impl.test.ts`, `qualified-access.impl.test.ts` (07 impl table) ✅ (completed: 2026-07-11 11:28 — 9 impl tests, frontend suite 416 green)
- [x] 1.3.2 Full verify ✅ (completed: 2026-07-11 11:30 — full workspace verify green: install + build + typecheck + lint + test, all 10 packages + root tier; `spec/` clean)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Initializer typing, consts & init order (frontend)

### Step 2.1: Specification tests

**Reference**: 07-testing-strategy ST-12…ST-21 · 03-02 · AR-4/5/6/7
**Objective**: pin initializer semantics, const evaluation, and ordering.

- [x] 2.1.1 Write init-typing spec tests (ST-15/ST-15b…ST-17, ST-19…ST-21) — `packages/frontend/src/semantics/module-init-typing.spec.test.ts` ✅ (completed: 2026-07-11 11:37 — typecheck clean)
- [x] 2.1.2 Write init-order spec tests (ST-12…ST-14, ST-18) — `packages/frontend/src/semantics/init-order.spec.test.ts` ✅ (completed: 2026-07-11 11:37 — typecheck clean)
- [x] 2.1.3 RED phase: verify every ST fails ✅ (completed: 2026-07-11 11:39 — 11/11 red, no pre-passers)

### Step 2.2: Implementation

**Reference**: 03-02 §1-4 · AR-4, AR-7, AR-5, AR-6
**Objective**: Pass-3 arms + const machinery + `computeInitOrder` + model wiring.

- [x] 2.2.1 `typeModuleLet`: call-rejection ICE, local-`let` parity checks, decl-node `symbolMap` entry; driver dispatch for top-level items — `packages/frontend/src/semantics/type-check/statement-typing.ts` ✅ (completed: 2026-07-11 11:48)
- [x] 2.2.2 Const machinery: `evalConst` resolver callback, const→const edges + Tarjan E10194, dependency-first evaluation, E10193, `constValues` — `packages/frontend/src/semantics/const-eval.ts`, `statement-typing.ts` ✅ (completed: 2026-07-11 11:48 — `checkConstRange` gained the optional resolver + boolean return so const values range-check through the one shared E10084/E10082 path; type-mismatched const initializers get checkAssignable parity and evaluate no value)
- [x] 2.2.3 `collectModuleVariables` records the `initializers` map (symbol → initialiser expr) — `packages/frontend/src/semantics/module-variable-collection.ts` ✅ (completed: 2026-07-11 11:48)
- [x] 2.2.4 `computeInitOrder` (edges → Tarjan E10194 with path → two-level Kahn) + `analyze.ts` wiring of `initOrder`/`constValues` into the model — NEW `packages/frontend/src/semantics/init-order.ts`, `analyze.ts` ✅ (completed: 2026-07-11 11:48 — init-order.ts also exports the shared `collectNameRefs` walker the const phase reuses)
- [x] 2.2.5 GREEN phase: ST-12…ST-21 pass ✅ (completed: 2026-07-11 11:48 — 11/11 green first run, no spec test edited; frontend suite 427 green)

### Step 2.3: Implementation tests & hardening

- [x] 2.3.1 Impl tests: const chains, importEdges, poison behavior, non-edges — `module-init.impl.test.ts` (07 impl table) ✅ (completed: 2026-07-11 11:50 — 6 impl tests, frontend suite 433 green)
- [x] 2.3.2 Full verify ✅ (completed: 2026-07-11 11:50 — full workspace verify green; `spec/` clean; doc-standard self-check clean)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 3: Init codegen + lowering arms (codegen/platforms)

### Step 3.1: Specification tests

**Reference**: 07-testing-strategy ST-22…ST-25 · 03-03 · AR-7/8
**Objective**: pin the IL shape, the `__init` stream, and const inlining.

- [x] 3.1.1 Write IL lowering spec tests (ST-22) — `packages/codegen/src/il/lower-init.spec.test.ts` ✅ (completed: 2026-07-11 12:00)
- [x] 3.1.2 Write emit-level spec tests (ST-23…ST-25) — `packages/compiler/src/api/emit-init.spec.test.ts` ✅ (completed: 2026-07-11 12:00)
- [x] 3.1.3 RED phase: verify every ST fails ✅ (completed: 2026-07-11 12:00 — 5 red (+ the new `initTempCount` field also reds the codegen typecheck until 3.2.2); pre-passer: the ST-23 without-initializer half, pins today's no-`__init` output that conditional emission must preserve)

### Step 3.2: Implementation

**Reference**: 03-03 §1-3, 03-01 §4 · AR-8 amendments, AR-12, AR-7
**Objective**: qualified/const lowering arms, `initCode` production, `__init` consumption, shim wiring.

- [x] 3.2.1 Lowering arms: `lowerFieldAccess` read, `lowerAssign` qualified target, `lowerUserCall` symbol-keyed callee (both shapes) + `collectCallExprs`/`canReach` parity, const→immediate inlining (ident + qualified) — `packages/codegen/src/il/lower.ts` ✅ (completed: 2026-07-11 12:05 — `moduleVarOf` refactored to the symbol-keyed `moduleVarLocOfSymbol` shared by ident/qualified/assign/init paths)
- [x] 3.2.2 `ILProgram.initCode` production: `__init` builder over `model.initOrder`, `moduleInit` ICE guard, NEW `initTempCount` field + test-literal sweep, `printIL` `__init` section — `packages/codegen/src/il/lower.ts`, `cfg.ts`, `print-il.ts` (+ test literals) ✅ (completed: 2026-07-11 12:07 — sweep hit 11 codegen + 2 compiler golden-test literals; the lower.spec.test.ts empty pin needed no narrowing, its fixture is an empty program)
- [x] 3.2.3 `generateInstr` `__init` wrapper stream (unshift FIRST) + `derivePreambleOptions.hasInitCode` + runtime-routine collection includes the init stream — `packages/codegen/src/instr/instr-program.ts` (+ the embed-scan input if needed) ✅ (completed: 2026-07-11 12:08 — init stream pushed before the function loop; embed scan reads streams, so no scan change needed; sanitize doc comment refreshed)
- [x] 3.2.4 `PreambleOptions.hasInitCode` (additive) + `c64StyleStartupShim`/`c64StylePreamble` conditional `JSR __init` + five plugin pass-throughs (`emitPreamble` AND the optional-param `emitStartupShim` delegations, 03-03 §3) + bare-variant user-owned doc comments — `packages/core/src/platform/platform-plugin.ts`, `packages/platforms/src/shared-hooks.ts`, `c64.ts`, `c64u.ts`, `cx16.ts`, `a800xl.ts`, `a7800.ts` ✅ (completed: 2026-07-11 12:10 — bare-variant note also added to the build API's startup option doc)
- [x] 3.2.5 GREEN phase: ST-22…ST-25 pass ✅ (completed: 2026-07-11 12:11 — 6/6 green, no spec test edited; codegen 375 + compiler 90 + harness 91 all green)

### Step 3.3: Implementation tests & hardening

- [x] 3.3.1 Impl tests: initTempCount propagation, printIL section, moduleInit guard, plugin pass-through, word-store shape — `lower-init.impl.test.ts` + instr additions (07 impl table) ✅ (completed: 2026-07-11 12:12 — 5 codegen impl tests (incl. the instr-layer conditional-stream witness) + 15 platform pass-through tests in NEW `packages/platforms/src/init-shim.impl.test.ts`)
- [x] 3.3.2 Full verify — MUST include ST-29: all prior goldens byte-exact, no re-mint ✅ (completed: 2026-07-11 12:13 — full workspace verify green; all six goldens + both compiler assemble goldens byte-exact, no re-mint; `spec/` clean)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 4: Acceptance — fixture, golden, ACME, VICE

### Step 4.1: The 3-part bar

**Reference**: 03-04 · 07-testing-strategy ST-26…ST-30 · AR-10
**Objective**: the three-file fixture proves the slice end-to-end on real VICE.

- [x] 4.1.1 Fixture sources (exact 03-04 §1 text) — `examples/slice5b/{main,math,math2}.blend` + `packages/test-harness/src/testing/slice5b.ts` ✅ (completed: 2026-07-11 12:16)
- [x] 4.1.2 Negatives through the facade (ST-30, N1–N6; expected to pass immediately — codes shipped in Phases 1-2; document that no RED applies) — `packages/test-harness/src/slice5b-negatives.spec.test.ts` ✅ (completed: 2026-07-11 12:17 — 6/6 pass immediately as planned, no RED applies)
- [x] 4.1.3 Golden test + mint + content asserts (ST-26) — `packages/test-harness/src/golden-slice5b.spec.test.ts`, `test/golden/slice5b.asm.golden` ✅ (completed: 2026-07-11 12:19 — minted 94 lines; `__init` first, `JSR __init` after banking, init order base→scaled→combo, NO `__var_Math_SCALE`; note: `SCALE * 2` const-folds to `LDA #$06` at translate (imm×imm fold), so no `__rt_mul8` lands in `__init` — correct code; the embed-scan-includes-init-stream property stays witnessed by the instr impl test)
- [x] 4.1.4 Assemble-clean tier with real ACME (ST-27) — `packages/test-harness/src/slice5b.spec.test.ts` ✅ (completed: 2026-07-11 12:20 — loadable PRG, zero errors)
- [x] 4.1.5 VICE tier: sentinel + seven memory asserts on real VICE 3.10 (ST-28) — `slice5b.spec.test.ts` ✅ (completed: 2026-07-11 12:20 — GREEN on real VICE: $C000..$C006 = 05/08/07/02/01/03/01)
- [x] 4.1.6 Full verify (all tiers green locally; CI tiers skip-gated as in slice5a) ✅ (completed: 2026-07-11 12:20 — full workspace verify green; `spec/` clean)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 5: Rollout bookkeeping

### Step 5.1: Parent artifacts

**Reference**: 01-requirements delta · AR-5/6/12/13 deviations/deferrals
**Objective**: parent RDs, ledger, and roadmaps reflect what shipped.

- [ ] 5.1.1 RD-04 deferred-semantics ledger: R17/R20/R21/R23 + AC-16 + AC-09(scalar) advanced; E10192 recorded parser-owned; deviations recorded once (E10194 path appendix; intra-import-cycle order fallback; the §5.3 fall-through-vs-`JSR _main` startup deviation — pre-existing, RD-07c-shipped, record if absent; named deferrals: call-bearing initializers, qualified function references, bare-startup `__init`, W10190) — `codeops/_archive/rd-04-semantic-analysis/08-deferred-semantics-ledger.md`
- [ ] 5.1.2 RD-18: tick **AC-4 CLOSED** with shipped summary — `codeops/features/blend65-ri/requirements/RD-18-codegen-language-completion.md`
- [ ] 5.1.3 Roadmaps: feature row → ✅ COMPLETE + portfolio cascade — `codeops/features/blend65-ri/00-roadmap.md`, `codeops/00-roadmap.md`
- [ ] 5.1.4 SR-2 resource delta (init-code bytes, `__var_*` layout, ZP unchanged) + final register/plan sweep — this plan folder

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Dependencies

```
Phase 1 (merged scopes, qualified resolution, symbolMap coverage)
    ↓
Phase 2 (initializer typing reads qualified refs; init graph needs symbolMap)
    ↓
Phase 3 (lowering consumes initOrder/constValues + qualified symbol entries)
    ↓
Phase 4 (fixture exercises everything end-to-end)
    ↓
Phase 5 (bookkeeping)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 42 tasks `[x]`; all phases verified
2. ✅ Full verify green (command above); no warnings/errors
3. ✅ The 3-part bar: assemble-clean (real ACME) + byte-exact golden + real-VICE
   memory asserts (03-04 values)
4. ✅ All six existing goldens (gate + five slice goldens) byte-exact with NO re-mint
5. ✅ No dead code; no plan-artifact references in shipped code/comments
6. ✅ RD-18 AC-4 CLOSED; ledger + roadmaps cascaded
7. ✅ `git status --porcelain spec/` empty throughout
8. ✅ Post-completion re-analysis offered (exec_plan skill)
