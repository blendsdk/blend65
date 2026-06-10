# Execution Plan: RD-07c Codegen Platform Preamble

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-06-10
> **Progress**: 12/12 tasks (100%) ✅ COMPLETE
> **CodeOps Version**: (unstamped — consistent with RD-01..RD-07b/RD-10/RD-11a)
> **Commit mode**: `--no-commit` (D7) — implement, verify, update this plan; the user performs all git operations.

## Overview

Wire the RD-10 `PlatformPlugin` into codegen: add the additive `assembleProgram(ilProgram,
plugin, bag)` wrapper that fills `InstrProgram.preamble` from `plugin.emitPreamble`, and make
the entry function's stream label `_main` (sanitizing all other function labels). Half A of
the RD-07 remainder; Half B stays deferred. Spec-tests-first.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title                                   | Sessions | Est. Time |
| ----- | --------------------------------------- | -------- | --------- |
| 1     | Entry-label `_main` + real `sanitize()` | 1        | ~60 min   |
| 2     | `assembleProgram` + preamble wiring     | 1        | ~75 min   |
| 3     | Barrel export, impl tests & closeout    | 1        | ~45 min   |

**Total: 3 sessions, ~3 hours**

---

## Phase 1: Entry-label `_main` + real `sanitize()`

> Done first because the entry relabel changes the RD-07b goldens (ST-G1/G2/G3), and Phase 2's
> end-to-end golden depends on the `_main` label being in place.

### Session 1.1: Sanitize + entry label

**Reference**: `03-01-platform-preamble-and-assemble.md` (D4); `07-testing-strategy.md` (ST-A6/A7/A8).
**Objective**: Entry function → `_main`; other function labels sanitized `.`→`_`.

**Tasks**:

| #     | Task | File |
| ----- | ---- | ---- |
| 1.1.1 | Write spec tests ST-A6 (entry label `_main`), ST-A7 (`Math.add`→`Math_add`), ST-A8 (`printInstr` first line `_main:`) | `packages/codegen/src/instr/assemble.spec.test.ts` |
| 1.1.2 | Run spec tests — verify ST-A6/A7/A8 FAIL (red) | — |
| 1.1.3 | Implement real `sanitize()` + `isEntryFunction`/`_main` mapping in `translate.ts` | `packages/codegen/src/instr/translate.ts` |
| 1.1.4 | Update RD-07b goldens for the D4 relabel (ST-G1 `Math_add:`, ST-G2 `_main:`, ST-G3 `Math_eq:`) | `packages/codegen/src/instr/generate.golden.spec.test.ts` |
| 1.1.5 | Run spec tests — verify ST-A6/A7/A8 + updated goldens PASS (green) | — |

**Deliverables**:
- [x] Entry function labelled `_main`; others sanitized
- [x] RD-07b goldens green with new labels
- [x] All verification passing (codegen suite 137/137)

**Verify**: `yarn turbo run build typecheck lint test`

---

## Phase 2: `assembleProgram` + preamble wiring

### Session 2.1: Wrapper + end-to-end golden

**Reference**: `03-01-platform-preamble-and-assemble.md` (D2/D3); `07-testing-strategy.md` (ST-A1..A5, ST-AG1).
**Objective**: The additive wrapper populates `InstrProgram.preamble` from the plugin.

**Tasks**:

| #     | Task | File |
| ----- | ---- | ---- |
| 2.1.1 | Add `@blend65/platforms` as a **devDependency** of `@blend65/codegen` (+ test-only tsconfig ref if needed) for the golden | `packages/codegen/package.json`, `packages/codegen/tsconfig.json` |
| 2.1.2 | Write spec tests ST-A1..A5 (preamble equals plugin output; streams/plan unchanged; determinism; no errors) + ST-AG1 end-to-end golden | `packages/codegen/src/instr/assemble.spec.test.ts`, `packages/codegen/src/instr/assemble.golden.spec.test.ts` |
| 2.1.3 | Run spec tests — verify ST-A1..A5 + ST-AG1 FAIL (red) | — |
| 2.1.4 | Implement `assembleProgram` + `derivePreambleOptions` in `instr-program.ts` (`generateInstr` unchanged) | `packages/codegen/src/instr/instr-program.ts` |
| 2.1.5 | Run spec tests — verify ST-A1..A5 + ST-AG1 PASS (green) | — |

**Deliverables**:
- [x] `assembleProgram` fills the preamble from `plugin.emitPreamble`
- [x] End-to-end gate golden (preamble + `_main` body) green
- [x] `generateInstr` unchanged; RD-07b tests green
- [x] All verification passing (codegen suite 143/143)

**Verify**: `yarn turbo run build typecheck lint test`

---

## Phase 3: Barrel export, impl tests & closeout

### Session 3.1: Export, edges, closeout

**Reference**: `01-requirements.md` (FR-9/FR-11, AC-06/AC-09); `07-testing-strategy.md` (impl tier).
**Objective**: Public surface + edge coverage + plan/roadmap closeout.

**Tasks**:

| #     | Task | File |
| ----- | ---- | ---- |
| 3.1.1 | Confirm `assembleProgram` is re-exported from `instr/index.ts` → `@blend65/codegen` barrel | `packages/codegen/src/instr/index.ts`, `packages/codegen/src/index.ts` |
| 3.1.2 | Write impl tests: `programByteSize` counts the populated preamble; `needsDataInit` true with `constData`; multi-function sanitization; non-`Main` module `main`→`_main` | `packages/codegen/src/instr/assemble.impl.test.ts` |
| 3.1.3 | Full verification + R15 boundary tier (`yarn vitest run test/`) + `git status --porcelain spec/` empty | — |
| 3.1.4 | Update `requirements/RD-07-codegen-instr.md` status (Half A done; tick AC-07/AC-09/AC-14 codegen-hook portion) and `plans/ROADMAP.md` (RD-07c → Done; Current Position) | `requirements/RD-07-codegen-instr.md`, `plans/ROADMAP.md` |

**Deliverables**:
- [x] `assembleProgram` exported
- [x] Impl tests green
- [x] Roadmap + RD-07 status updated
- [x] All verification passing (turbo 40/40 + R15 3/3; `spec/` clean)

**Verify**: `yarn turbo run build typecheck lint test` then `yarn vitest run test/`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> This checklist is the **single source of truth** for tracking progress across all phases.
> 1. **After completing each task:** mark it `[x]` with a timestamp — e.g. `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 2. **After completing each phase:** confirm every task in that phase is `[x]`.
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) after every update.
> 4. **This checklist MUST exist** — reconstruct from the phase tables if missing before executing.
> 5. **Never batch updates** — update immediately after each task.

### Phase 1: Entry-label `_main` + real `sanitize()`
- [x] 1.1.1 Write spec tests ST-A6/A7/A8 (`assemble.spec.test.ts`) ✅ (completed: 2026-06-10 10:56)
- [x] 1.1.2 Verify ST-A6/A7/A8 FAIL (red) ✅ (completed: 2026-06-10 10:57)
- [x] 1.1.3 Implement real `sanitize()` + entry `_main` mapping (`translate.ts`) ✅ (completed: 2026-06-10 10:57)
- [x] 1.1.4 Update RD-07b goldens for the D4 relabel (`generate.golden.spec.test.ts` + `translate.spec.test.ts`, D9) ✅ (completed: 2026-06-10 10:59)
- [x] 1.1.5 Verify ST-A6/A7/A8 + updated goldens PASS (green) ✅ (completed: 2026-06-10 10:59)

### Phase 2: `assembleProgram` + preamble wiring
- [x] 2.1.1 Add `@blend65/platforms` test-only devDependency (+ tsconfig ref) ✅ (completed: 2026-06-10 11:01)
- [x] 2.1.2 Write spec tests ST-A1..A5 + ST-AG1 golden ✅ (completed: 2026-06-10 11:01)
- [x] 2.1.3 Verify ST-A1..A5 + ST-AG1 FAIL (red) ✅ (completed: 2026-06-10 11:02)
- [x] 2.1.4 Implement `assembleProgram` + `derivePreambleOptions` (`instr-program.ts`) ✅ (completed: 2026-06-10 11:02)
- [x] 2.1.5 Verify ST-A1..A5 + ST-AG1 PASS (green) ✅ (completed: 2026-06-10 11:03)

### Phase 3: Barrel export, impl tests & closeout
- [x] 3.1.1 Confirm `assembleProgram` barrel export ✅ (completed: 2026-06-10 11:03)
- [x] 3.1.2 Write impl tests (`assemble.impl.test.ts`) ✅ (completed: 2026-06-10 11:15)
- [x] 3.1.3 Full verification + R15 boundary tier + `spec/` clean ✅ (completed: 2026-06-10 11:17) — turbo 40/40, R15 3/3, `spec/` clean; D10 resolved a build-cycle (real-plugin golden → `@blend65/compiler`)
- [x] 3.1.4 Update RD-07 status + `plans/ROADMAP.md` ✅ (completed: 2026-06-10 11:19) — RD-07 AC-14 ticked, status note updated; ROADMAP RD-07c → Done, Current Position → RD-09

---

## Session Protocol

### Ending a Session
1. Run `yarn turbo run build typecheck lint test` then `yarn vitest run test/`.
2. Commit mode is `--no-commit` — do not commit; note uncommitted changes.
3. Compact the conversation with `/compact`.

---

## Dependencies

```
Phase 1 (entry label — changes RD-07b goldens)
    ↓
Phase 2 (assembleProgram — golden depends on _main label)
    ↓
Phase 3 (export + impl + closeout)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (`yarn turbo run build typecheck lint test` + `yarn vitest run test/`)
3. ✅ No warnings/errors
4. ✅ No dead code — no unused params/functions/modules (code.md rule 4)
5. ✅ Security N/A — pure in-memory transformation (no I/O, no runtime input)
6. ✅ `spec/` unmodified (`git status --porcelain spec/` empty); R15 boundary tier green
7. ✅ `plans/ROADMAP.md` updated (RD-07c → Done; Current Position → next up RD-09)
8. ✅ **Post-completion:** ask user to re-analyze project and update `.clinerules/project.md`
