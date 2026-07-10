# Execution Plan: RD-18 Slice 5a — User Functions, Parameters & Calls

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-10 11:15
> **Progress**: 6/46 tasks (13%)
> **CodeOps Skills Version**: 3.3.1

## Overview

Build user functions end-to-end: Phase 0 retires the 13-byte data ceiling (AR-2), Phase 1
ships the call/return/recursion/import semantics (AR-5..AR-11, AR-14), Phase 2 feeds the
already-complete SFA (params, callees, argument-window interference — AR-3), Phase 3 adds
the two codegen cases (`lowerCall` store-per-arg + translate `call`; AR-3/AR-4 guards),
Phase 4 proves the three-part bar on the two-module fixture (AR-16), Phase 5 does rollout
bookkeeping. Owning specs: 03-01..03-04; oracles: 07-testing-strategy ST-01..ST-34.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
|-------|-------|-------|
| 0 | Data-region relocation + overlap guard | 6 |
| 1 | Call semantics (frontend) | 15 |
| 2 | SFA wiring | 7 |
| 3 | Call codegen | 8 |
| 4 | Acceptance (three-part bar) | 5 |
| 5 | Rollout bookkeeping | 5 |

**Total: 46 tasks across 6 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task
> line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** and Last Updated stamp after EVERY task — never batch.
>    Only `[x]` counts as complete.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 0: Data-region relocation + overlap guard

### Step 0.1: Move the data base to $2000 and guard the code/data boundary

**Reference**: 03-02 §4 · AR-2 · ST-01..ST-04
**Objective**: retire the 13-byte ceiling before any address-bearing feature work; one
golden re-mint for the whole slice (challenger H5).

- [x] 0.1.1 Write overlap-check spec tests (ST-02 boundary-accept, ST-03 reject) against the
      `checkBinaryBudget`/E10034 seam — `packages/core/src/report/` spec suite ✅ (completed: 2026-07-10 10:57)
- [x] 0.1.2 Run them — verify RED (check does not exist). Golden re-mint (ST-01) has no red
      phase: re-minting is the oracle update for an intentional address change (documented
      justification, spec-first §compressed form) ✅ (completed: 2026-07-10 10:57 — 2/2 RED)
- [x] 0.1.3 Implement: `DEFAULT_PROFILE.ramStart` `0x0800`→`0x2000`
      (`packages/core/src/semantics/platform-profile.ts:72`); expose the plan's data base
      off `AllocationPlan`; derive the PRG load address from the binary's first two bytes
      (NOT read back today — PF-003; size = the existing header-excluded `binarySize`);
      mandatory post-ACME overlap check keyed off the plan, wired
      unconditionally into `build()` (03-02 §4.2) ✅ (completed: 2026-07-10 11:08 —
      `dataBase` field on `AllocationPlan` + 33 test-literal fix-ups; `checkDataOverlap`
      in `core/report/build-resource-report.ts`, barrel-exported; load address from PRG
      header bytes in `build()`; workspace build+typecheck green)
- [x] 0.1.4 GREEN: ST-02/ST-03 pass; re-mint all five goldens (`UPDATE_GOLDEN=1`) and
      assert ST-01 (only equate values changed; all ≥ `$2000`) ✅ (completed: 2026-07-10
      11:08 — 2/2 overlap STs green; 22 equate lines `$08xx`→`$20xx`, zero other changes)
- [x] 0.1.5 Local VICE re-verify all five fixtures (ST-04: gate `$D020==0xF5`, slice3a,
      slice3b, slice4a, slice4b memory cells unchanged) ✅ (completed: 2026-07-10 11:08 —
      all five runtime suites green on real VICE in the full-workspace run)
- [x] 0.1.6 Impl tests (exact-boundary `==` case, plan-keyed dataBase) + full verify
      ✅ (completed: 2026-07-10 11:15 — two `build()`-level impl tests in
      `compiler/src/api/build.impl.test.ts`; full verify green)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 1: Call semantics (frontend)

### Step 1.1: Specification tests (BEFORE implementation)

**Reference**: 03-01 · 07 ST-05..ST-20 · AR-5..AR-11, AR-14
**Objective**: immutable oracles for every validator this slice ships.

- [ ] 1.1.1 Param-collection spec tests (ST-16 duplicate→E10003, ST-17 FN-13→E10101) +
      registry expectations (E10051 registered; E10175 named `NotCallable`) —
      `packages/frontend/src/semantics/` spec suites
- [ ] 1.1.2 Call-typing spec tests (ST-05 happy, ST-06 E10170, ST-07 E10171, ST-08 E10175,
      ST-09 E10100+no-cascade, ST-10 E10051, ST-11 E10023, ST-20 FN-7 order independence)
- [ ] 1.1.3 Return-completion spec tests (ST-12 E10172, ST-13 E10154-with-return-wording)
- [ ] 1.1.4 Recursion spec tests (ST-14 direct one-diagnostic, ST-15 indirect
      one-per-cycle + path)
- [ ] 1.1.5 Import-resolution spec tests (ST-18 E10012, ST-19 resolve + edge recorded)
- [ ] 1.1.6 Run all Phase-1 spec tests — verify RED

### Step 1.2: Implementation

**Reference**: 03-01 §1..§6
**Objective**: the silent-poison user-call path becomes full validation.

- [ ] 1.2.1 Registry edits: rename `TooManyParameters`→`NotCallable` (E10175, AR-9); mint
      `CallToInterruptFunction: "E10051"` (AR-10) —
      `packages/core/src/diagnostics/diagnostic-codes.ts`
- [ ] 1.2.2 Parameter collection: `parameter` symbols (types via `resolveTypeNode`,
      params before locals), duplicate→E10003, FN-13→E10101, function symbols carry the
      decl's `exported` flag — `packages/frontend/src/semantics/function-collection.ts`
      (03-01 §2)
- [ ] 1.2.3 Signature cache + `typeCall`: callee resolution ladder (E10100 → E10051 →
      E10023 → E10175), arg count E10170, per-arg strict-assignable E10171 with
      context-typed literals, result = return type, R114 cascade discipline —
      `packages/frontend/src/semantics/type-check/expression-typing.ts` (03-01 §3)
- [ ] 1.2.4 Return completion: E10172 for bare `return` in non-void; `checkAssignable`
      (E10152/53/54) with return-context wording —
      `packages/frontend/src/semantics/type-check/statement-typing.ts` (03-01 §4)
- [ ] 1.2.5 Call graph: Pass-3 edge recording (enclosing-function symbol threaded);
      Tarjan `findCycles` (canonical anchor ordering) in
      `packages/core/src/semantics/call-graph.ts`; `checkRecursion` → one E10174 per
      cycle with full path in `packages/frontend/src/semantics/post-check.ts`; real
      graph wired in `analyze.ts` (03-01 §5)
- [ ] 1.2.6 Import resolution: new `packages/frontend/src/semantics/import-resolution.ts`
      (user-module map, AR-14 precedence, E10012, alias-insert same Symbol, duplicate
      E10003, duplicate-module-name collision → explicit unsupported ICE — PF-005),
      wired into `analyze()`; T4 boundary untouched (03-01 §6)
- [ ] 1.2.7 Run all Phase-1 spec tests — verify GREEN (fix implementation, never tests)

### Step 1.3: Implementation tests & hardening

- [ ] 1.3.1 Impl tests: signature-cache reuse, Tarjan determinism (anchor =
      first-declared; diamond graphs), poison-cascade internals, import-precedence edge
      (user module named like a platform id), duplicate-module-name collision →
      unsupported ICE (PF-005)
- [ ] 1.3.2 Full verify

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: SFA wiring

### Step 2.1: Specification tests (BEFORE implementation)

**Reference**: 03-02 §1..§3 · 07 ST-21..ST-24 · AR-3, AR-7
**Objective**: oracles for the adapter feed + interference soundness + pass ordering.

- [ ] 2.1.1 Spec tests: ST-21 params-first projection, ST-22 callees + ancestor-descendant
      disjointness, ST-23 argument-window interference (`f`/`h` sibling shape), ST-24
      recursion poisons before `planAllocation` — adapter/model-adapter + run-frontend
      spec suites
- [ ] 2.1.2 Run them — verify RED

### Step 2.2: Implementation

- [ ] 2.2.1 Adapter: project `parameters` (scope `parameter` symbols, insertion order) and
      `callees` (edge FQNs, sorted) — `packages/frontend/src/sfa/model-adapter.ts`
      (03-02 §1/§2)
- [ ] 2.2.2 Argument-window interference: `FunctionInfo.argWindowInterferes` field
      (`packages/core/src/sfa/function-info.ts`), frontend computation (nested calls in
      args after the first, reach() over edges), union into
      `packages/frontend/src/sfa/interference.ts` (03-02 §3)
- [ ] 2.2.3 ADD the `hasErrors`→skip-`planAllocation` driver gate in
      `packages/compiler/src/api/run-frontend.ts` — no gate exists today (PF-002); guard
      the whole call expression so the inline `modelToFunctionInfo` argument is skipped
      too; leave the plan-allocation-level "still assembles under upstreamErrors" spec
      test untouched (different layer) (ST-24) — GREEN all Phase-2 STs

### Step 2.3: Implementation tests & hardening

- [ ] 2.3.1 Impl tests: FrameVar ordering, `argWindowInterferes` dedup/sort determinism,
      reach() on diamonds AND on a cyclic graph (visited-set bound — must terminate;
      PF-002), self-pair skipped
- [ ] 2.3.2 Full verify

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 3: Call codegen

### Step 3.1: Specification tests (BEFORE implementation)

**Reference**: 03-03 · 07 ST-25..ST-30 · AR-3, AR-4
**Objective**: IL/ASM shape oracles + both never-miscompile guards.

- [ ] 3.1.1 Lowering spec tests: ST-25 IL store-per-arg + bare `call` shape (IL printer),
      ST-28 same-callee-in-later-arg → lowering ICE, ST-30 first-arg nested call compiles
      — `packages/codegen/src/il/` spec suite
- [ ] 3.1.2 Translate spec tests: ST-26 caller ASM sequence (stores → `JSR Math_add` →
      A-result store), ST-27 word param/return round-trip (A:X), ST-29 live-temp-across-
      call → translate ICE — `packages/codegen/src/instr/` spec suite
- [ ] 3.1.3 Run them — verify RED

### Step 3.2: Implementation

- [ ] 3.2.1 `lowerCall` user branch: callee FQN + param-slot resolution with an
      `iceUnsupported` fallback for unresolvable/non-IdentExpr callees (PF-006), AR-3
      residual guard (reach-includes-callee → `iceUnsupported`, visited-set-bounded
      DFS), store-per-arg lowering, `call`
      emission with dest temp — `packages/codegen/src/il/lower.ts` (03-03 §2)
- [ ] 3.2.2 Translate `case "call"`: AR-4 live-temp guard via a NEW separate
      remaining-use map (copy of the prescan totals, decremented once per consumed
      operand occurrence — never mutate `useCount`, the fold decisions read it;
      03-03 §3.1 / PF-001) → `iceUnsupported`; `JSR sanitize(target)`; result bind
      (byte→A, word→A:X, void→none); clear all other mirrors —
      `packages/codegen/src/instr/translate.ts` (03-03 §3)
- [ ] 3.2.3 Run all Phase-3 spec tests — verify GREEN

### Step 3.3: Implementation tests & hardening

- [ ] 3.3.1 Impl tests: register mirror cleared after user JSR, multi-module `sanitize`
      labels, void-call statement path
- [ ] 3.3.2 Full verify

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 4: Acceptance (three-part bar)

### Step 4.1: Fixture, golden, VICE

**Reference**: 03-04 · 07 ST-31..ST-34 · AR-16
**Objective**: the first multi-function, two-module program proven on real silicon.

- [ ] 4.1.1 Fixture: `examples/slice5a/main.blend` + `examples/slice5a/math.blend`
      (03-04 §1 verbatim) + `packages/test-harness/src/testing/slice5a.ts`
      (`buildSlice5a`/`emitAsmSlice5a`, two `sourceFiles`)
- [ ] 4.1.2 Write acceptance spec tests before minting: `golden-slice5a.spec.test.ts`
      (ST-32) + `slice5a.spec.test.ts` assemble-clean (ST-31) and VICE runtime (ST-33,
      `skipIf(!(hasVice("c64") && hasAcme()))`) — RED (golden absent)
- [ ] 4.1.3 Mint `test/golden/slice5a.asm.golden`; assemble-clean + golden GREEN (ST-31/32)
- [ ] 4.1.4 Local VICE GREEN: `$C000==$11`, `$C001==$84`, `$C002==$03`, `$C003==$10`
      (ST-33); prior goldens byte-exact (ST-34)
- [ ] 4.1.5 Full verify

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 5: Rollout bookkeeping

### Step 5.1: Ledger, RD, roadmap

**Reference**: 01-requirements §Acceptance · RD-18 AC-4 · AR-1..AR-16
**Objective**: parent artifacts reflect what shipped; deviations recorded once.

- [ ] 5.1.1 Advance the RD-04 deferred-semantics ledger: R58, R65 (partial — no count
      limit), R80/R81 (return completion), R84–R87 (call graph + E10174), R13/R22
      (function-export/import subset), R10 (FN-13 only) + AC-07/AC-15 ticks + a Slice-5a
      advancement banner — `codeops/_archive/rd-04-semantic-analysis/08-deferred-semantics-ledger.md`
- [ ] 5.1.2 Record deviations/deferrals in the ledger + register cross-refs: E10175
      rename rationale INCLUDING the spec-internal inconsistency (Ch 06 §10 table =
      NotCallable vs canonical Ch 14 registry = TooManyParameters, itself refuted by
      FN-11; the code registry now follows Ch 06 §10 and diverges from Ch 14 until a
      spec-errata pass — PF-004), FN-11 no-param-limit (RD-04 R65 spec-refuted), E1017x
      chapter-table drift note, JSR-startup scoped deviation (AR-12), AR-3/AR-4/AR-13
      named deferrals, duplicate-module-name-across-files unsupported-ICE until 5b
      merging (PF-005)
- [ ] 5.1.3 Tick RD-18 AC-4 as "5a partial ✅ (functions/params/calls/recursion/imports);
      closes at 5b (merging + qualified access + init order)" —
      `codeops/features/blend65-ri/requirements/RD-18-codegen-language-completion.md`
- [ ] 5.1.4 Record the SR-2 resource delta (footprint at the `$2000` base; frame/ZP/stack
      figures from the ResourceReport) + SR-3 closeout for the retired 13-byte ceiling
- [ ] 5.1.5 Roadmap sync (`codeops/features/blend65-ri/00-roadmap.md` + portfolio):
      Slice 5a ✅, next = Slice 5b `make_plan`; final full verify;
      `git status --porcelain spec/` empty

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Dependencies

```
Phase 0 (addresses frozen)
    ↓
Phase 1 (semantics: params/calls/returns/recursion/imports)
    ↓
Phase 2 (SFA feed — consumes Phase-1 model)
    ↓
Phase 3 (codegen — consumes Phase-2 plan symbols)
    ↓
Phase 4 (three-part bar)
    ↓
Phase 5 (bookkeeping)
```

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed (46/46 tasks)
2. ✅ Full verify green at every phase boundary; CI green
3. ✅ The three-part bar: assemble-clean + byte-exact golden + real-VICE
   `$C000..$C003 == $11/$84/$03/$10`
4. ✅ Every negative/guard ST rejects with exactly the gated code; the AR-3/AR-4 shapes
   ICE, never miscompile
5. ✅ No dead code; security posture upheld (diagnostics-not-crashes on malformed input;
   bounded Tarjan/DFS)
6. ✅ Rollout bookkeeping done (ledger, RD-18 AC-4 annotation, roadmap, deviations)
7. ✅ `git status --porcelain spec/` empty throughout (D3)
8. ✅ Post-completion project re-analysis (exec_plan skill)
