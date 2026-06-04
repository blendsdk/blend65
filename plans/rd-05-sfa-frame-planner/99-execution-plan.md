# Execution Plan: RD-05 SFA Frame Planner & Zero-Page Allocator

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-06-04
> **Progress**: 24/24 tasks (100%) — ✅ COMPLETE
> **CodeOps Version**: (unstamped — consistent with RD-01..RD-04/RD-11a)
> **Commit mode**: `--no-commit` (D7) — agent makes NO git operations; user handles all commits.

## Overview

Implements RD-05 as **full, fixture-tested algorithms** (D1). Phase 1 builds the core `sfa/`
records + interim `PlatformProfile` budget fields. Phase 2 builds the frontend `sfa/` passes
(frame computation → interference → coloring → module/ZP layout → stack → budgets → symbols →
`planAllocation` + the deferred `modelToFunctionInfo` seam). Phase 3 wires barrels, adds the
golden snapshot, annotates the requirements doc, and closes out.

Each feature follows **spec-tests-first** ordering (write spec tests → verify red → implement →
verify green → impl tests). All decisions trace to `00-ambiguity-register.md` (D1–D9).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title                                   | Sessions | Est. Time |
| ----- | --------------------------------------- | -------- | --------- |
| 1     | Core SFA records + profile budgets      | 1        | 60 min    |
| 2     | Frontend planner passes + algorithms    | 3        | 4–5 h     |
| 3     | Wiring, golden snapshot & closeout       | 1        | 60 min    |

**Total: ~5 sessions, ~6–7 hours**

---

## Phase 1: Core SFA records + profile budgets

### Session 1.1: Core `sfa/` vocabulary (D3/D5/D6) + interim profile (D2)

**Reference**: `03-01-frame-model.md`, `03-03-zp-and-layout.md`, `03-05-allocation-plan-and-api.md`
**Objective**: Ship the core data surface the planner produces/consumes; extend `PlatformProfile`.

**Tasks**:

| #     | Task                                                                                  | File                                            |
| ----- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1.1.1 | Spec tests for core record shapes (existence/type-guard) + profile fields             | `packages/core/src/sfa/*.spec.test.ts`          |
| 1.1.2 | Verify spec tests FAIL (red)                                                          | —                                               |
| 1.1.3 | `FunctionInfo`/`FrameVar` (D3/D5)                                                      | `packages/core/src/sfa/function-info.ts`        |
| 1.1.4 | `FunctionFrame`/`FrameSlot`/`InterferenceGraph`                                        | `packages/core/src/sfa/frame.ts`                |
| 1.1.5 | `AllocationPlan` + sub-records (`FrameAllocation`/`ZpAllocation`/`ModuleVariableAllocation`/`StackAnalysis`/`SymbolDefinition`/`SfaResourceData`) | `packages/core/src/sfa/allocation-plan.ts` |
| 1.1.6 | Additive interim budget fields on `PlatformProfile` (D2)                               | `packages/core/src/semantics/platform-profile.ts` |
| 1.1.7 | `sfa/index.ts` barrel; wire into `packages/core/src/index.ts`                          | `packages/core/src/sfa/index.ts`, `core/src/index.ts` |
| 1.1.8 | Verify spec tests PASS (green); impl tests for record guards                           | `packages/core/src/sfa/*.impl.test.ts`          |

**Deliverables**: core `sfa/` exports; profile budget fields; verification passing.
**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Frontend planner passes + algorithms

### Session 2.1: Frame computation + interference + coloring

**Reference**: `03-01-frame-model.md`, `03-02-interference-and-coloring.md`

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2.1.1 | Spec tests ST-F1..F8, ST-I1..I6, ST-C1..C6 (incl. Ch 11 §3.4 AC-07)           | `frame-computation/interference/coloring.spec.test.ts`|
| 2.1.2 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 2.1.3 | `slotSize`/`computeFrame`/`computeFrames` (R1–R6)                              | `packages/frontend/src/sfa/frame-computation.ts`      |
| 2.1.4 | `buildInterferenceGraph` (R10–R17)                                            | `packages/frontend/src/sfa/interference.ts`           |
| 2.1.5 | `colorFrames` greedy chordal coloring (R12/R16/R18)                           | `packages/frontend/src/sfa/coloring.ts`               |
| 2.1.6 | Verify spec tests PASS (green); impl tests (coloring edge cases)              | `*.impl.test.ts`                                      |

**Verify**: canonical verify command (above).

### Session 2.2: Module/ZP layout + stack + budgets

**Reference**: `03-03-zp-and-layout.md`, `03-04-stack-and-budgets.md`

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2.2.1 | Spec tests ST-Z1..Z8, ST-S1..S6                                               | `zp-allocator/stack-analysis/budgets.spec.test.ts`    |
| 2.2.2 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 2.2.3 | `layoutModuleVariables` + `computePeakPointers` + `allocateZeroPage` (R24–R36)| `packages/frontend/src/sfa/zp-allocator.ts`           |
| 2.2.4 | `analyzeStack` (R37–R40)                                                       | `packages/frontend/src/sfa/stack-analysis.ts`         |
| 2.2.5 | `checkBudgets` E10033/W10030/W10033/W10180 + cascade suppression (R41–R46/R62)| `packages/frontend/src/sfa/budgets.ts`                |
| 2.2.6 | Verify spec tests PASS (green); impl tests (boundaries, multi-IRQ)            | `*.impl.test.ts`                                      |

**Verify**: canonical verify command.

### Session 2.3: Symbols + `planAllocation` + adapter seam

**Reference**: `03-05-allocation-plan-and-api.md`

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2.3.1 | Spec tests ST-A1..A4, ST-P1, ST-P3..P6                                         | `symbols/plan-allocation.spec.test.ts`                |
| 2.3.2 | Verify spec tests FAIL (red)                                                  | —                                                     |
| 2.3.3 | `generateSymbolDefinitions` (R47/R50)                                          | `packages/frontend/src/sfa/symbols.ts`                |
| 2.3.4 | `planAllocation` 9-step pipeline (R51–R59)                                     | `packages/frontend/src/sfa/plan-allocation.ts`        |
| 2.3.5 | `modelToFunctionInfo` deferred seam → `[]` (D1/D3/D5)                          | `packages/frontend/src/sfa/model-adapter.ts`          |
| 2.3.6 | Verify spec tests PASS (green); impl tests                                     | `*.impl.test.ts`                                      |

**Verify**: canonical verify command.

---

## Phase 3: Wiring, golden snapshot & closeout

### Session 3.1: Barrel wiring, golden, requirements annotation, closeout

**Reference**: `00-index.md`, `07-testing-strategy.md`

**Tasks**:

| #     | Task                                                                          | File                                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 3.1.1 | `frontend/src/sfa/index.ts` barrel; wire into `packages/frontend/src/index.ts`| `frontend/src/sfa/index.ts`, `frontend/src/index.ts`  |
| 3.1.2 | Golden snapshot for the Ch 11 §3.4 program (ST-P2 / AC-07 / AC-21)            | `plan-allocation.golden.spec.test.ts` + snapshot      |
| 3.1.3 | Confirm R15 boundary tier still green (frontend never imports codegen)        | `test/boundary.spec.test.ts`                          |
| 3.1.4 | Annotate `requirements/RD-05-sfa-frame-planner.md` (live-wiring deferral note)| `requirements/RD-05-sfa-frame-planner.md`             |
| 3.1.5 | Tick FR-*/AC-* in `01-requirements.md`; set Index status to Implemented        | plan docs                                             |
| 3.1.6 | Final full verify; confirm `spec/` clean (`git status --porcelain spec/`)      | —                                                     |

**Verify**: canonical verify command; `git status --porcelain spec/` empty.

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> 1. **After completing each task:** mark it `[x]` with a timestamp — e.g.
>    `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`.
> 2. **After completing each phase:** confirm every task in that phase is `[x]`.
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) after every update.
> 4. **This checklist MUST exist** — reconstruct from phase tables if missing before executing.
> 5. **Never batch updates** — update immediately after each task.
>
> Commit mode is `--no-commit` (D7): never run git operations; the user commits.

### Phase 1: Core SFA records + profile budgets
- [x] 1.1.1 Spec tests for core record shapes + profile fields ✅ (completed: 2026-06-04 22:28)
- [x] 1.1.2 Verify spec tests FAIL (red — via typecheck; types/fields absent) ✅ (completed: 2026-06-04 22:28)
- [x] 1.1.3 `FunctionInfo`/`FrameVar` (D3/D5) ✅ (completed: 2026-06-04 22:29)
- [x] 1.1.4 `FunctionFrame`/`FrameSlot`/`InterferenceGraph` ✅ (completed: 2026-06-04 22:29)
- [x] 1.1.5 `AllocationPlan` + sub-records ✅ (completed: 2026-06-04 22:30)
- [x] 1.1.6 Interim `PlatformProfile` budget fields (D2) ✅ (completed: 2026-06-04 22:31)
- [x] 1.1.7 `sfa/index.ts` + wire core barrel ✅ (completed: 2026-06-04 22:32)
- [x] 1.1.8 Verify green; core impl tests ✅ (completed: 2026-06-04 22:33)

### Phase 2: Frontend planner passes + algorithms
- [x] 2.1.1 Spec tests ST-F*/ST-I*/ST-C* (incl. AC-07) ✅ (completed: 2026-06-04 22:39)
- [x] 2.1.2 Verify red ✅ (completed: 2026-06-04 22:39)
- [x] 2.1.3 `frame-computation.ts` ✅ (completed: 2026-06-04 22:40)
- [x] 2.1.4 `interference.ts` ✅ (completed: 2026-06-04 22:40)
- [x] 2.1.5 `coloring.ts` ✅ (completed: 2026-06-04 22:43)
- [x] 2.1.6 Verify green; coloring impl tests ✅ (completed: 2026-06-04 22:44)
- [x] 2.2.1 Spec tests ST-Z*/ST-S* ✅ (completed: 2026-06-04 22:48)
- [x] 2.2.2 Verify red ✅ (completed: 2026-06-04 22:48)
- [x] 2.2.3 `zp-allocator.ts` (+ module layout + peak pointers) ✅ (completed: 2026-06-04 22:49)
- [x] 2.2.4 `stack-analysis.ts` ✅ (completed: 2026-06-04 22:49)
- [x] 2.2.5 `budgets.ts` (E10033/W10030/W10033/W10180 + suppression) ✅ (completed: 2026-06-04 22:50)
- [x] 2.2.6 Verify green; impl tests ✅ (completed: 2026-06-04 22:52)
- [x] 2.3.1 Spec tests ST-A*/ST-P* ✅ (completed: 2026-06-04 22:54)
- [x] 2.3.2 Verify red ✅ (completed: 2026-06-04 22:54)
- [x] 2.3.3 `symbols.ts` ✅ (completed: 2026-06-04 22:55)
- [x] 2.3.4 `plan-allocation.ts` (9-step pipeline) ✅ (completed: 2026-06-04 22:56)
- [x] 2.3.5 `model-adapter.ts` (deferred seam → `[]`) ✅ (completed: 2026-06-04 22:55)
- [x] 2.3.6 Verify green; impl tests ✅ (completed: 2026-06-04 22:57)

### Phase 3: Wiring, golden snapshot & closeout
- [x] 3.1.1 `frontend/src/sfa/index.ts` + wire frontend barrel ✅ (completed: 2026-06-04 22:57)
- [x] 3.1.2 Golden snapshot (Ch 11 §3.4, AC-07/AC-21) ✅ (completed: 2026-06-04 22:58)
- [x] 3.1.3 Confirm R15 boundary tier green ✅ (completed: 2026-06-04 22:58)
- [x] 3.1.4 Annotate requirements doc (live-wiring deferral) ✅ (completed: 2026-06-04 23:00)
- [x] 3.1.5 Tick FR-*/AC-*; Index status → Implemented ✅ (completed: 2026-06-04 23:01)
- [x] 3.1.6 Final verify; `spec/` clean ✅ (completed: 2026-06-04 23:00)

---

## Session Protocol

### Starting a Session
1. If `scripts/agent.sh` exists: `clear && sleep 3 && scripts/agent.sh start`
2. "Implement Phase X, Session X.X per `plans/rd-05-sfa-frame-planner/99-execution-plan.md`"

### Ending a Session
1. Run the canonical verify command.
2. **No commit** (D7) — leave changes for the user.
3. If `scripts/agent.sh` exists: `clear && sleep 3 && scripts/agent.sh finished`
4. `/compact`.

---

## Dependencies

```
Phase 1 (core records + profile)
    ↓
Phase 2 (frontend passes: 2.1 → 2.2 → 2.3)
    ↓
Phase 3 (wiring, golden, closeout)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (canonical verify command)
3. ✅ No warnings/errors; R15 boundary tier green; `spec/` clean
4. ✅ No dead code — `_`-prefix only the deferred `modelToFunctionInfo` param (RD-04 D15 convention)
5. ✅ Security N/A (compiler-internal passes; no external input)
6. ✅ All ST-* pass; golden snapshot committed; FR-*/AC-* ticked
7. ✅ **Post-completion:** ask the user to re-analyze the project and update `.clinerules/project.md`

---

## Completion Summary (2026-06-04)

All 24 tasks complete. Final verify green across all 10 packages (build, typecheck, lint, test) +
the root R15 boundary tier (ST-R15a/b/c). `spec/` porcelain empty (frozen baseline untouched).

**Delivered:**
- Core `@blend65/core/sfa/`: `FunctionInfo`/`FrameVar`, `FunctionFrame`/`FrameSlot`/
  `InterferenceGraph`, `AllocationPlan` + all sub-records; interim `PlatformProfile` budget
  fields (D2) with `zpArgBlockMin` default 0 (D8).
- Frontend `@blend65/frontend/sfa/`: `frame-computation`, `interference`, `coloring`,
  `zp-allocator` (+ module layout + peak pointers), `stack-analysis`, `budgets`, `symbols`,
  `plan-allocation` (9-step pipeline, `PlanInput` per D9), and the `model-adapter` deferred
  seam (`modelToFunctionInfo` → `[]`, AC-22). Barrels wired into both package indexes.
- Tests: 222 frontend (incl. ST-F/I/C/Z/S/A/P spec tiers + impl tiers + the Ch 11 §3.4 golden
  snapshot, AC-07/AC-21) and 140 core. No new diagnostic codes (D4 — reused E10032/E10033/
  W10030/W10033/W10180).

**Only deferred seam:** live `analyze()` → `planAllocation()` wiring lights up unchanged when
RD-04b populates the `SemanticModel` (D1/D3/D5).
