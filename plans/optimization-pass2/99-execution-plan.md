# Execution Plan: Optimization Pass 2

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-17 00:48
> **Progress**: 6/24 tasks (25%)

## Overview

This document defines the execution phases and AI chat sessions for implementing 5 optimization fixes identified by the enhanced spinning-line diagnostic.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Pre-Implementation: Fresh Diagnostic Baseline

Before ANY fixes, run a fresh diagnostic to capture the current state. This provides:
1. Accurate "before" metrics for comparison
2. Confirmation of which bugs actually exist after prior fixes
3. Baseline PRG sizes at all 10 levels

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 0 | Baseline Diagnostic | 1 | 15 min |
| 1 | Fix 3: Add IL Peephole to O1 (Config) | 1 | 20 min |
| 2 | Fix 2: Profitable Inlining at Os/Oz | 1 | 30 min |
| 3 | Fix 1: SHR_WORD_LO Shift-Left (N=3-7) | 2 | 1-2 hours |
| 4 | Fixes 4+5: Const/Copy Prop Through Inline Labels | 1-2 | 1-2 hours |
| 5 | Verification & Regression Tests | 1 | 30 min |

**Total: 6-8 sessions, ~4-6 hours**

---

## Phase 0: Baseline Diagnostic

### Session 0.1: Capture Current State

**Objective**: Run `diag_app` on spinning-line and record baseline PRG sizes.

**Tasks**:
| # | Task | File |
|---|------|------|
| 0.1.1 | Run `diag_app spinning-line` and record summary | `build/diag/spinning-line/summary.txt` |
| 0.1.2 | Record PRG sizes at all 10 levels for before/after comparison | This document |

**Deliverables**:
- [x] Baseline PRG sizes recorded ✅ (completed: 2026-02-17 00:40)
- [x] Bugs confirmed or updated based on fresh diagnostic ✅ (completed: 2026-02-17 00:40)

**Baseline PRG Sizes (2026-02-17):**

| Level | PRG Size | Delta vs O0 | Notes |
|-------|----------|-------------|-------|
| O0    | 449 B    | baseline    | |
| O1    | 449 B    | +0 B        | Same PRG but different ASM (store/reload patterns) |
| O1s   | 449 B    | +0 B        | Identical to O0 |
| O1z   | 449 B    | +0 B        | Identical to O0 |
| O2    | 513 B    | **+64 B** 🔴 | SIZE REGRESSION |
| Os    | 449 B    | +0 B        | No inlining benefit |
| Oz    | 449 B    | +0 B        | No inlining benefit |
| O3    | 385 B    | -64 B ✅    | Best |
| O3s   | 449 B    | +0 B        | No inlining benefit |
| O3z   | 449 B    | +0 B        | No inlining benefit |

**Verify**: `./scripts/diag_app.sh examples/spinning-line/main.blend`

---

## Phase 1: Fix 3 — Add IL Peephole to O1 (Config Change)

### Session 1.1: Update Optimization Level Configuration

**Reference**: [05-post-inline-cleanup.md](05-post-inline-cleanup.md) — Fix 3

**Objective**: Add `il-peephole` to O1/O1s/O1z function passes to eliminate post-inlining store/reload patterns at O1.

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Add `il-peephole` to O1 LEVEL_PASSES | `optimizer/options.ts` |
| 1.1.2 | Add `il-peephole` to O1s and O1z LEVEL_PASSES | `optimizer/options.ts` |
| 1.1.3 | Run `./compiler-test` — verify zero regressions | — |
| 1.1.4 | Verify spinning-line O1 no longer has store/reload pairs (debug script) | `scripts/` |

**Deliverables**:
- [x] IL peephole enabled at O1/O1s/O1z ✅ (completed: 2026-02-17 00:41)
- [x] Store/reload patterns eliminated at O1 ✅ (O1: 449→447 B, modulo bitmask + STA/LDA cleanup)
- [x] All tests passing ✅ (9154 tests, 0 failures)

**Verify**: `./compiler-test`

---

## Phase 2: Fix 2 — Profitable Inlining at Os/Oz

### Session 2.1: Enable Inlining at Size Levels

**Reference**: [04-profitable-inlining.md](04-profitable-inlining.md)

**Objective**: Enable function inlining at Os/Oz (and O1s/O1z/O3s/O3z) with single-call-site strategy only.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Add `function-inline` + trailing `dead-function-elim` to Os/Oz/O1s/O1z/O3s/O3z in PROGRAM_LEVEL_PASSES | `optimizer/options.ts` |
| 2.1.2 | Add `SIZE_PROFITABLE_THRESHOLD` constant and size-level strategy to `findCandidates()` | `optimizer/passes/function-inlining.ts` |
| 2.1.3 | Import `isSizeOptimization` in function-inlining.ts | `optimizer/passes/function-inlining.ts` |
| 2.1.4 | Run `./compiler-test` — verify zero regressions | — |
| 2.1.5 | Verify spinning-line Os/Oz now has LOAD_ADDRESS_EXPR in output | `scripts/` |

**Deliverables**:
- [ ] Inlining enabled at size levels with conservative strategy
- [ ] Os/Oz PRG sizes improved (≤ O1)
- [ ] All tests passing

**Verify**: `./compiler-test`

---

## Phase 3: Fix 1 — SHR_WORD_LO Shift-Left Technique

### Session 3.1: IL Infrastructure (Opcode + Peephole)

**Reference**: [03-shr-word-lo.md](03-shr-word-lo.md)

**Objective**: Add `SHR_WORD_LO` opcode and extend IL peephole to produce it.

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Add `SHR_WORD_LO` to `ILOpcode` enum and cost table | `il/enums.ts` |
| 3.1.2 | Extend `shrWordLoNarrowing()` to handle N=3-7 → emit SHR_WORD_LO(N) | `optimizer/passes/il-peephole.ts` |
| 3.1.3 | Add unit tests for peephole: SHR_WORD+LO → SHR_WORD_LO for N=3-7 | `__tests__/optimizer/` |
| 3.1.4 | Add negative tests: N=1,2 NOT replaced; standalone SHR_WORD NOT replaced | `__tests__/optimizer/` |
| 3.1.5 | Run `./compiler-test` — verify zero regressions | — |

**Deliverables**:
- [ ] New SHR_WORD_LO opcode in IL
- [ ] IL peephole produces SHR_WORD_LO for N=3-7
- [ ] Unit + negative tests pass

**Verify**: `./compiler-test`

### Session 3.2: Codegen for SHR_WORD_LO

**Reference**: [03-shr-word-lo.md](03-shr-word-lo.md)

**Objective**: Add 6502 code generation for `SHR_WORD_LO` using the shift-left technique.

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.2.1 | Investigate temp ZP location availability in codegen (check existing scratch/temp mechanisms) | `codegen/generator/base.ts` |
| 3.2.2 | Implement `genShrWordLo()` method with shift-left technique | `codegen/generator/bitwise.ts` |
| 3.2.3 | Add `SHR_WORD_LO` to dispatch in `generateInstruction()` | `codegen/generator/bitwise.ts` |
| 3.2.4 | Add codegen unit tests for SHR_WORD_LO N=3,4,5,6,7 | `__tests__/codegen/` |
| 3.2.5 | Verify assembly byte count for N=6 is ~8 bytes (not 36) | `__tests__/codegen/` |
| 3.2.6 | Run `./compiler-test` — verify zero regressions | — |

**Deliverables**:
- [ ] Codegen emits shift-left technique for SHR_WORD_LO
- [ ] Assembly output is significantly smaller than SHR_WORD for N=3-7
- [ ] All tests passing

**Verify**: `./compiler-test`

---

## Phase 4: Fixes 4+5 — Const/Copy Prop Through Inline Labels

### Session 4.1: Investigate and Fix Propagation Passes

**Reference**: [05-post-inline-cleanup.md](05-post-inline-cleanup.md) — Fixes 4 & 5

**Objective**: Make constant-prop and copy-prop transparent to inline continuation labels.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Read `constant-prop.ts` — find where labels kill state | `optimizer/passes/constant-prop.ts` |
| 4.1.2 | Read `copy-prop.ts` — find where labels kill state | `optimizer/passes/copy-prop.ts` |
| 4.1.3 | Create debug script to dump IL before/after const-prop and copy-prop at O3 for spinning-line | `scripts/` |
| 4.1.4 | Implement inline-label transparency in constant-prop (skip `_inline_*_cont` labels) | `optimizer/passes/constant-prop.ts` |
| 4.1.5 | Implement inline-label transparency in copy-prop (skip `_inline_*_cont` labels) | `optimizer/passes/copy-prop.ts` |
| 4.1.6 | Add unit tests: propagation through inline labels, kill at regular labels | `__tests__/optimizer/` |
| 4.1.7 | Run `./compiler-test` — verify zero regressions | — |

**Deliverables**:
- [ ] Const-prop propagates through inline continuation labels
- [ ] Copy-prop forwards through inline continuation labels
- [ ] Both still kill state at regular labels (safety preserved)
- [ ] All tests passing

**Verify**: `./compiler-test`

---

## Phase 5: Verification & Regression Tests

### Session 5.1: Final Verification

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Run full diagnostic, compare PRG sizes, verify all acceptance criteria.

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.1.1 | Run `diag_app spinning-line` — all 10 levels pass | — |
| 5.1.2 | Compare PRG sizes: before (Phase 0) vs after | This document |
| 5.1.3 | Verify: O2 PRG ≤ O0 PRG (size regression gone) | — |
| 5.1.4 | Verify: Os PRG ≤ O1 PRG (size levels benefit from inlining) | — |
| 5.1.5 | Run `diag_app balloon-sprite` — all 10 levels pass | — |
| 5.1.6 | Run `./compiler-test` — full suite | — |

**Deliverables**:
- [ ] All 10 spinning-line levels PASS
- [ ] No size regressions at any level
- [ ] All 9100+ tests passing
- [ ] diag_app shows 0 REDUN/MISSOPT bugs at O2+

**Verify**: `./compiler-test` + `./scripts/diag_app.sh examples/spinning-line/main.blend`

---

## Task Checklist (All Phases)

### Phase 0: Baseline
- [x] 0.1.1 Run diag_app and record baseline PRG sizes ✅ (completed: 2026-02-17 00:40)
- [x] 0.1.2 Record before/after comparison data ✅ (completed: 2026-02-17 00:40)

### Phase 1: Fix 3 — IL Peephole at O1
- [x] 1.1.1 Add il-peephole to O1 LEVEL_PASSES ✅ (completed: 2026-02-17 00:41)
- [x] 1.1.2 Add il-peephole to O1s/O1z LEVEL_PASSES ✅ (completed: 2026-02-17 00:41)
- [x] 1.1.3 Run compiler-test — zero regressions ✅ (completed: 2026-02-17 00:48)
- [x] 1.1.4 Verify spinning-line O1 store/reload eliminated ✅ (completed: 2026-02-17 00:46)

### Phase 2: Fix 2 — Profitable Inlining at Os/Oz
- [ ] 2.1.1 Add function-inline to size-level PROGRAM_LEVEL_PASSES
- [ ] 2.1.2 Add SIZE_PROFITABLE_THRESHOLD and size-level strategy
- [ ] 2.1.3 Import isSizeOptimization
- [ ] 2.1.4 Run compiler-test — zero regressions
- [ ] 2.1.5 Verify spinning-line Os/Oz has LOAD_ADDRESS_EXPR

### Phase 3: Fix 1 — SHR_WORD_LO
- [ ] 3.1.1 Add SHR_WORD_LO to ILOpcode enum + cost table
- [ ] 3.1.2 Extend shrWordLoNarrowing() for N=3-7
- [ ] 3.1.3 Add peephole unit tests (N=3-7)
- [ ] 3.1.4 Add negative tests (N=1,2; standalone SHR_WORD)
- [ ] 3.1.5 Run compiler-test — zero regressions
- [ ] 3.2.1 Investigate temp ZP for codegen
- [ ] 3.2.2 Implement genShrWordLo() shift-left technique
- [ ] 3.2.3 Add SHR_WORD_LO to dispatch
- [ ] 3.2.4 Add codegen unit tests (N=3-7)
- [ ] 3.2.5 Verify byte count reduction
- [ ] 3.2.6 Run compiler-test — zero regressions

### Phase 4: Fixes 4+5 — Const/Copy Prop
- [ ] 4.1.1 Read constant-prop.ts label handling
- [ ] 4.1.2 Read copy-prop.ts label handling
- [ ] 4.1.3 Create debug script for IL before/after at O3
- [ ] 4.1.4 Implement inline-label transparency in constant-prop
- [ ] 4.1.5 Implement inline-label transparency in copy-prop
- [ ] 4.1.6 Add unit tests (propagation + safety)
- [ ] 4.1.7 Run compiler-test — zero regressions

### Phase 5: Verification
- [ ] 5.1.1 Run diag_app spinning-line — all levels PASS
- [ ] 5.1.2 Compare PRG sizes before/after
- [ ] 5.1.3 Verify O2 ≤ O0
- [ ] 5.1.4 Verify Os ≤ O1
- [ ] 5.1.5 Run diag_app balloon-sprite — all levels PASS
- [ ] 5.1.6 Run full compiler-test

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/optimization-pass2/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with [x]
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase 0 (Baseline)
    ↓
Phase 1 (IL Peephole at O1) — independent, simple config change
    ↓
Phase 2 (Profitable Inlining) — independent, config + inliner change
    ↓
Phase 3 (SHR_WORD_LO) — independent, IL + codegen change
    ↓
Phase 4 (Const/Copy Prop) — benefits from Phases 1-3 being in place
    ↓
Phase 5 (Verification) — depends on all above
```

Phases 1, 2, and 3 are independent of each other and can be done in any order. They are ordered by complexity (simplest first) to deliver quick wins early.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 5 fixes implemented
2. ✅ spinning-line O2 PRG ≤ O0 PRG (no size regression)
3. ✅ spinning-line Os PRG ≤ O1 PRG
4. ✅ All 9100+ existing tests passing
5. ✅ New regression tests for each fix
6. ✅ `diag_app spinning-line` shows 0 REDUN/MISSOPT at O2+
7. ✅ No regressions at O0 (debug builds unchanged)
