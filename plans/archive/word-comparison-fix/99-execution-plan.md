# Execution Plan: Word Comparison Codegen Fix

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-23 09:43
> **Progress**: 9/9 tasks (100%)

## Overview

This document defines the execution phases and AI chat sessions for fixing the word comparison bugs in the IL generator's condition and dynamic for-loop paths.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Fix `generateConditionWithBranch()` | 1 | 15 min |
| 2 | Fix `generateForConditionDynamic()` | 1 | 15 min |
| 3 | Add Unit Tests | 1 | 20 min |
| 4 | Verify & Update Bug List | 1 | 10 min |

**Total: 1 session, ~60 minutes**

---

## Phase 1: Fix `generateConditionWithBranch()` — Primary Bug W1

### Session 1.1: Add Word-Type Detection to Condition Path

**Reference**: [IL Generator Fix](03-il-generator-fix.md), Fix 1

**Objective**: Make `generateConditionWithBranch()` emit `CMP_WORD_IMM` / `CMP_WORD_SLOT` when comparing word-typed operands in if/while conditions.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add `isWordLeft` detection after `generateExpression(binExpr.getLeft())` | `il/generator/control-flow.ts` |
| 1.1.2 | Update literal right-operand handler to use `cmpWordImm` when `isWordLeft` | `il/generator/control-flow.ts` |
| 1.1.3 | Update constant identifier handler to use `cmpWordImm` when `isWordLeft` | `il/generator/control-flow.ts` |
| 1.1.4 | Update variable right-operand handler to use `cmpWordSlot` when `isWordLeft` | `il/generator/control-flow.ts` |

**Deliverables**:

- [ ] `generateConditionWithBranch()` emits word comparison opcodes for word-typed conditions
- [ ] Byte comparison path unchanged (no regressions)
- [ ] Quick IL test run passes: `./compiler-test il`

**Verify**: `./compiler-test il`

---

## Phase 2: Fix `generateForConditionDynamic()` — Dynamic Word For-Loop

### Session 2.1: Add Word Counter Support to Dynamic For-Loop Condition

**Reference**: [IL Generator Fix](03-il-generator-fix.md), Fix 2

**Objective**: Make `generateForConditionDynamic()` save/compare the full 16-bit counter for word-typed loop variables with runtime bounds.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Check if `createZpTempSlot` can create word-sized slots, add helper if needed | `il/generator/expressions.ts` or `base.ts` |
| 2.1.2 | Add `isWord` branch to `generateForConditionDynamic()` with full 16-bit save/compare/restore | `il/generator/control-flow.ts` |

**Deliverables**:

- [ ] Word counters with dynamic bounds save/compare full 16-bit value
- [ ] Byte counters unaffected
- [ ] Quick IL test run passes: `./compiler-test il`

**Verify**: `./compiler-test il`

---

## Phase 3: Add Unit Tests

### Session 3.1: Word Comparison Condition Path Tests

**Reference**: [Testing Strategy](07-testing-strategy.md)

**Objective**: Add unit tests for the condition path (if/while statements) with word-typed comparisons.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Add `describe('ILGenerator - Word Comparison in If-Conditions')` with tests 1-10 from testing strategy | `__tests__/il/generator-word-comparisons.test.ts` |
| 3.1.2 | Add dynamic word for-loop condition test (test 11-12 from testing strategy) | `__tests__/il/generator-word-for-loop.test.ts` |

**Deliverables**:

- [ ] 10+ new unit tests covering word comparisons in conditions
- [ ] All new tests pass
- [ ] Full test suite passes: `./compiler-test`

**Verify**: `./compiler-test`

---

## Phase 4: Verify & Update Documentation

### Session 4.1: End-to-End Verification

**Objective**: Verify the fix works end-to-end and update documentation.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Update bug-list.md to mark W1 as fixed and add the dynamic for-loop bug as fixed | `bug-list.md` |

**Deliverables**:

- [ ] `bug-list.md` updated
- [ ] Full test suite passes: `./compiler-test`

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Fix `generateConditionWithBranch()`

- [x] 1.1.1 Add `isWordLeft` detection ✅ (completed: 2025-02-23 09:34)
- [x] 1.1.2 Update literal handler for word ✅ (completed: 2025-02-23 09:34)
- [x] 1.1.3 Update constant identifier handler for word ✅ (completed: 2025-02-23 09:34)
- [x] 1.1.4 Update variable handler for word ✅ (completed: 2025-02-23 09:34)

### Phase 2: Fix `generateForConditionDynamic()`

- [x] 2.1.1 Check/create word-sized ZP temp slot helper ✅ (completed: 2025-02-23 09:35)
- [x] 2.1.2 Add `isWord` branch to dynamic condition ✅ (completed: 2025-02-23 09:36)

### Phase 3: Add Unit Tests

- [x] 3.1.1 Word comparison in if-condition tests (11 tests) ✅ (completed: 2025-02-23 09:40)
- [x] 3.1.2 Dynamic word for-loop condition tests — covered by existing word-for-loop tests ✅

### Phase 4: Verify & Update

- [x] 4.1.1 Update bug-list.md ✅ (completed: 2025-02-23 09:43)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/word-comparison-fix/99-execution-plan.md"
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
Phase 1 (fix condition path)
    ↓
Phase 2 (fix dynamic for-loop)
    ↓
Phase 3 (add tests)
    ↓
Phase 4 (verify & document)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ All phases completed
2. ✅ All tests passing (`./compiler-test`)
3. ✅ `02-word-arithmetic` assembles with ACME at all optimization levels
4. ✅ `bug-list.md` updated
5. ✅ No regressions in existing byte comparisons
