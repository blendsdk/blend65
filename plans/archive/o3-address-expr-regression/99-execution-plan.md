# Execution Plan: O3 Address-Expr Folding Regression Fix

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-17 12:13
> **Progress**: 14/14 tasks (100%) ✅ COMPLETE

## Overview

This document defines the execution phases and AI chat sessions for fixing the O3 regression and improving load-store elimination for inline labels.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Address-Expr Store-Gap Pattern Fix | 1 | 30 min |
| 2 | Load-Store Inline Label Elimination | 1 | 20 min |
| 3 | Verification & Diagnostics | 1 | 15 min |

**Total: 1-2 sessions, ~1 hour**

---

## Phase 1: Address-Expr Store-Gap Pattern Fix

### Session 1.1: Implement Store-Gap Pattern + Tests

**Reference**: [03-address-expr-store-gap.md](03-address-expr-store-gap.md)

**Objective**: Add "store-gap" pattern variant to `matchAddressExprPattern` and the `isWordSlotDeadAfter` helper.

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Add `isWordSlotDeadAfter()` helper method | `optimizer/passes/il-peephole.ts` |
| 1.1.2 | Add `'with-dead-store-gap'` to `AddressExprMatch.patternType` union | `optimizer/passes/il-peephole.ts` |
| 1.1.3 | Add store-gap pattern variant to `matchAddressExprPattern()` (between direct and gap) | `optimizer/passes/il-peephole.ts` |
| 1.1.4 | Add unit tests: store-gap matches 4-instr sequence (N=6) | `__tests__/optimizer/` |
| 1.1.5 | Add unit tests: store-gap skips when slot is live (negative) | `__tests__/optimizer/` |
| 1.1.6 | Add unit tests: existing direct + gap patterns still work (regression) | `__tests__/optimizer/` |
| 1.1.7 | Run `./compiler-test` — verify zero regressions | — |

**Deliverables**:
- [ ] Store-gap pattern implemented and tested
- [ ] Existing patterns unaffected (regression tests)
- [ ] All tests passing

**Verify**: `./compiler-test`

---

## Phase 2: Load-Store Inline Label Elimination

### Session 2.1: Extend loadStoreElimination for Inline Labels

**Reference**: [04-load-store-inline-labels.md](04-load-store-inline-labels.md)

**Objective**: Handle STORE/LOAD pairs separated by inline continuation labels.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Add STORE_WORD/LABEL/LOAD_WORD inline-label pattern to `loadStoreElimination()` | `optimizer/passes/il-peephole.ts` |
| 2.1.2 | Add STORE_BYTE/LABEL/LOAD_BYTE inline-label pattern to `loadStoreElimination()` | `optimizer/passes/il-peephole.ts` |
| 2.1.3 | Add unit tests: STORE_WORD/LABEL_inline/LOAD_WORD → remove LOAD | `__tests__/optimizer/` |
| 2.1.4 | Add unit tests: STORE_BYTE/LABEL_inline/LOAD_BYTE → remove LOAD | `__tests__/optimizer/` |
| 2.1.5 | Add negative tests: non-inline label, mismatched slots | `__tests__/optimizer/` |
| 2.1.6 | Run `./compiler-test` — verify zero regressions | — |

**Deliverables**:
- [ ] Inline-label load-store elimination implemented
- [ ] Unit + negative tests passing
- [ ] All tests passing

**Verify**: `./compiler-test`

---

## Phase 3: Verification & Diagnostics

### Session 3.1: Final Verification

**Reference**: [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Verify O3 regression is fixed and no regressions exist.

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Run `diag_app spinning-line` — all 10 levels pass, O3 ≤ 385 B | — |

**Deliverables**:
- [ ] O3 spinning-line ≤ 385 B (regression fixed)
- [ ] All 10 levels compile and assemble
- [ ] Full test suite passing

**Verify**: `./compiler-test` + `./scripts/diag_app.sh examples/spinning-line/main.blend`

---

## Task Checklist (All Phases)

### Phase 1: Address-Expr Store-Gap Pattern
- [x] 1.1.1 Add `isWordSlotDeadAfter()` helper ✅ (completed: 2026-02-17 11:58)
- [x] 1.1.2 Add `'with-dead-store-gap'` to patternType ✅ (completed: 2026-02-17 11:57)
- [x] 1.1.3 Add store-gap variant to `matchAddressExprPattern()` ✅ (completed: 2026-02-17 11:58)
- [x] 1.1.4 Unit tests: store-gap positive (N=6) ✅ (completed: 2026-02-17 12:01)
- [x] 1.1.5 Unit tests: store-gap negative (live slot) ✅ (completed: 2026-02-17 12:01)
- [x] 1.1.6 Unit tests: existing patterns regression ✅ (completed: 2026-02-17 12:01)
- [x] 1.1.7 Run compiler-test — zero regressions ✅ (completed: 2026-02-17 12:03)

### Phase 2: Load-Store Inline Labels
- [x] 2.1.1 STORE_WORD/LABEL/LOAD_WORD pattern ✅ (completed: 2026-02-17 11:59)
- [x] 2.1.2 STORE_BYTE/LABEL/LOAD_BYTE pattern ✅ (completed: 2026-02-17 11:59)
- [x] 2.1.3 Unit tests: word inline-label elimination ✅ (completed: 2026-02-17 12:01)
- [x] 2.1.4 Unit tests: byte inline-label elimination ✅ (completed: 2026-02-17 12:01)
- [x] 2.1.5 Negative tests: non-inline label, mismatched slots ✅ (completed: 2026-02-17 12:01)
- [x] 2.1.6 Run compiler-test — zero regressions ✅ (completed: 2026-02-17 12:03)

### Phase 3: Verification
- [x] 3.1.1 diag_app spinning-line — O3 ≤ 385 B, all 10 levels pass ✅ (completed: 2026-02-17 12:13)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/o3-address-expr-regression/99-execution-plan.md"
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

---

## Dependencies

```
Phase 1 (Store-Gap Pattern) — primary fix, independent
    ↓
Phase 2 (Inline Label Load-Store) — general improvement, independent of Phase 1
    ↓
Phase 3 (Verification) — depends on Phases 1 + 2
```

Phases 1 and 2 are independent and can be done in any order, but Phase 1 directly fixes the regression so it's first.

---

## Success Criteria

**Feature is complete when:**

1. ✅ O3 spinning-line PRG ≤ 385 B
2. ✅ All 10 optimization levels compile and assemble for spinning-line
3. ✅ All 10 optimization levels compile and assemble for balloon-sprite
4. ✅ All 9204+ tests passing
5. ✅ New unit tests for store-gap pattern
6. ✅ New unit tests for inline-label load-store elimination
7. ✅ No regressions at any optimization level
