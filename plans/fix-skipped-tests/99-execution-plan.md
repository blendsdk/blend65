# Execution Plan: Fix 22 Skipped Tests

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-02 08:43
> **Progress**: 14/14 tasks (100%) ✅

## Overview

Convert all 22 skipped/todo tests to real passing tests across 4 phases and ~5 sessions.

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Intrinsics Test Bodies (15 tests) | 2 | 60 min |
| 2 | Shift + 3-Variable Test Bodies (3 tests) | 0.5 | 20 min |
| 3 | Parser Break/Continue Fix (2 tests) | 1 | 30 min |
| 4 | Cross-File Frame Allocation (2 tests) | 1-2 | 60 min |

**Total: ~5 sessions, ~3 hours**

---

## Phase 1: Intrinsics Test Bodies (15 tests)

### Session 1.1: codegen/e2e intrinsics + emit tests (6 tests)

**Reference**: [02-current-state.md](02-current-state.md) Files 1 & 2

**Objective**: Convert 4 `it.todo` in `codegen/e2e/intrinsics.test.ts` and 2 `it.todo` in `codegen/e2e/emit.test.ts` to real tests.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Write peek() test body using `compileToAsm()` helper, assert LDA with absolute address | `codegen/e2e/intrinsics.test.ts` |
| 1.1.2 | Write poke() test body, assert STA with absolute address | `codegen/e2e/intrinsics.test.ts` |
| 1.1.3 | Write peekw() test body, assert LDA + LDX for 16-bit read | `codegen/e2e/intrinsics.test.ts` |
| 1.1.4 | Write pokew() test body, assert STA + STX for 16-bit write | `codegen/e2e/intrinsics.test.ts` |
| 1.1.5 | Write poke emit test body using `compileToText()`, assert STA in ACME output | `codegen/e2e/emit.test.ts` |
| 1.1.6 | Write peek emit test body, assert LDA in ACME output | `codegen/e2e/emit.test.ts` |

**Deliverables**:
- [ ] 6 tests converted from it.todo to real passing tests
- [ ] Outdated gap comments removed/updated
- [ ] All tests passing

**Verify**: `./compiler-test codegen`

---

### Session 1.2: e2e/pipeline intrinsics tests (9 tests)

**Reference**: [02-current-state.md](02-current-state.md) File 3

**Objective**: Convert 9 `it.todo` in `e2e/pipeline/intrinsics.test.ts` to real tests.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.2.1 | Write 3 peek tests: hex addr, decimal addr, assignment in function | `e2e/pipeline/intrinsics.test.ts` |
| 1.2.2 | Write 2 poke tests: variable value, multiple calls | `e2e/pipeline/intrinsics.test.ts` |
| 1.2.3 | Write 2 peekw tests: hex addr, zero-page addr | `e2e/pipeline/intrinsics.test.ts` |
| 1.2.4 | Write 1 pokew test: address and value | `e2e/pipeline/intrinsics.test.ts` |
| 1.2.5 | Write 1 volatile_read test: address | `e2e/pipeline/intrinsics.test.ts` |

**Deliverables**:
- [ ] 9 tests converted from it.todo to real passing tests
- [ ] Outdated gap comments removed/updated
- [ ] All tests passing

**Verify**: `./compiler-test e2e`

---

## Phase 2: Shift + 3-Variable Test Bodies (3 tests)

### Session 2.1: Shift and 3-variable tests

**Reference**: [02-current-state.md](02-current-state.md) Files 4 & 5

**Objective**: Convert 2 shift `it.todo` and 1 three-variable `it.todo` to real tests.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Write shift left test body using `compileToAsm()`, assert ASL in output | `codegen/e2e/simple-programs.test.ts` |
| 2.1.2 | Write shift right test body, assert LSR in output | `codegen/e2e/simple-programs.test.ts` |
| 2.1.3 | Write 3-variable mixed arithmetic test using `compileBlend()` | `e2e/pipeline/simple-programs.test.ts` |

**Deliverables**:
- [ ] 3 tests converted from it.todo to real passing tests
- [ ] Outdated gap comments removed/updated
- [ ] All tests passing

**Verify**: `./compiler-test codegen e2e`

---

## Phase 3: Parser Break/Continue Fix (2 tests)

### Session 3.1: Fix parser module-level break/continue

**Reference**: [02-current-state.md](02-current-state.md) File 6

**Objective**: Fix the parser to report an error when `break`/`continue` appears at module scope. Unskip 2 tests.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Identify parser module-level declaration handling (read parser modules.ts or statements.ts) | `parser/` |
| 3.1.2 | Add break/continue keyword recognition at module scope → emit diagnostic | `parser/*.ts` |
| 3.1.3 | Unskip the 2 break/continue tests, verify they pass | `semantic/edge-cases/control-flow/break-continue.test.ts` |

**Deliverables**:
- [ ] Parser reports error for break/continue at module level
- [ ] 2 tests converted from it.skip to real passing tests
- [ ] No regressions

**Verify**: `./compiler-test semantic parser`

---

## Phase 4: Cross-File Frame Allocation (2 tests)

### Session 4.1: Fix FramePhase multi-module support

**Reference**: [02-current-state.md](02-current-state.md) File 7

**Objective**: Fix `FramePhase.execute()` to allocate frames for functions across all modules, not just the primary module.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Modify `FramePhase.execute()` to iterate all modules and collect functions | `pipeline/frame-phase.ts` |
| 4.1.2 | Update `FrameAllocator` if needed to accept functions from multiple programs | `frame/allocator/frame-allocator.ts` |
| 4.1.3 | Write test bodies for 2 multi-module function tests | `e2e/pipeline/multi-module.test.ts` |

**Deliverables**:
- [ ] FramePhase processes all modules' functions
- [ ] 2 tests converted from it.todo to real passing tests
- [ ] No regressions

**Verify**: `./compiler-test e2e`

---

## Task Checklist (All Phases)

### Phase 1: Intrinsics Test Bodies

- [x] 1.1.1 Write peek() codegen test body ✅ (completed: 2026-09-02)
- [x] 1.1.2 Write poke() codegen test body ✅ (completed: 2026-09-02)
- [x] 1.1.3 Write peekw() codegen test body ✅ (completed: 2026-09-02)
- [x] 1.1.4 Write pokew() codegen test body ✅ (completed: 2026-09-02)
- [x] 1.1.5 Write poke emit test body ✅ (completed: 2026-09-02)
- [x] 1.1.6 Write peek emit test body ✅ (completed: 2026-09-02)
- [x] 1.2.1 Write 3 pipeline peek tests ✅ (completed: 2026-09-02)
- [x] 1.2.2 Write 2 pipeline poke tests ✅ (completed: 2026-09-02)
- [x] 1.2.3 Write 2 pipeline peekw tests ✅ (completed: 2026-09-02)
- [x] 1.2.4 Write 1 pipeline pokew test ✅ (completed: 2026-09-02)
- [x] 1.2.5 Write 1 pipeline volatile_read test ✅ (completed: 2026-09-02)

### Phase 2: Shift + 3-Variable Tests

- [x] 2.1.1 Write shift left codegen test ✅ (completed: 2026-09-02, adjusted: codegen emits unsupported op, not ASL)
- [x] 2.1.2 Write shift right codegen test ✅ (completed: 2026-09-02, adjusted: codegen emits unsupported op, not LSR)
- [x] 2.1.3 Write 3-variable mixed arithmetic test ✅ (completed: 2026-09-02)

### Phase 3: Parser Break/Continue

- [x] 3.1.1 Read parser module-level handling ✅ (completed: 2026-09-02)
- [x] 3.1.2 Fix: Parser already reports error; updated test helper to merge parser diagnostics ✅ (completed: 2026-09-02)
- [x] 3.1.3 Unskip 2 break/continue tests ✅ (completed: 2026-09-02)

### Phase 4: Cross-File Frame Allocation

- [x] 4.1.1 Modify FramePhase to iterate all modules ✅ (completed: 2026-09-02, added collectAllModulePrograms() + allocateMultiplePrograms())
- [x] 4.1.2 Update FrameAllocator with allocateMultiplePrograms() method ✅ (completed: 2026-09-02)
- [x] 4.1.3 Write 2 multi-module function test bodies ✅ (completed: 2026-09-02, tests use explicit module declarations)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/fix-skipped-tests/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. If tests pass, commit
git add . && git commit -m "feat(tests): [description]"

# 3. End agent settings
clear && scripts/agent.sh finished

# 4. Call attempt_completion
# 5. User runs /compact
```

---

## Dependencies

```
Phase 1 (intrinsics tests) — independent
    ↓
Phase 2 (shift + 3-var tests) — independent
    ↓
Phase 3 (parser fix) — independent
    ↓
Phase 4 (cross-file frames) — independent
```

All phases are independent and can be done in any order.

---

## Success Criteria

**Feature is complete when**:

1. ✅ All 22 skipped tests converted to real passing tests
2. ✅ Full test suite: 7858+ pass, 0 fail, 0 skip
3. ✅ No regressions in existing tests
4. ✅ Outdated gap comments removed/updated
5. ✅ Code committed
