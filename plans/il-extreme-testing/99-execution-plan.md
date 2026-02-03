# Execution Plan: IL & IL-Optimizer Extreme Testing

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-03-02 21:47
> **Progress**: 9/46 tasks (20%)

## Overview

This document defines the execution phases and AI chat sessions for implementing the god-level testing suite for IL Generator and IL Optimizer.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases Summary

| Phase | Title | Files | Sessions | Est. Time |
|-------|-------|-------|----------|-----------|
| 0 | Shared Helpers | 2 | 1 | 30 min |
| 1 | IL Real-World Tests | 7 | 3-4 | 2-3 hrs |
| 2 | IL Stress Tests | 4 | 2 | 1-2 hrs |
| 3 | IL Complex Tests | 6 | 3 | 2 hrs |
| 4 | IL Edge Cases | 5 | 2 | 1-2 hrs |
| 5 | Optimizer Real-World | 7 | 3-4 | 2-3 hrs |
| 6 | Optimizer Stress | 4 | 2 | 1-2 hrs |
| 7 | Optimizer Correctness | 6 | 3 | 2 hrs |
| 8 | Optimizer Edge Cases | 5 | 2 | 1-2 hrs |

**Total: ~21-24 sessions, ~14-19 hours**

---

## Phase 0: Shared Helpers

> **Reference**: [11-shared-helpers.md](11-shared-helpers.md)

### Session 0.1: Create IL and Optimizer Test Helpers

**Objective**: Create shared helper utilities for all test files

**Tasks**:
| # | Task | File |
|---|------|------|
| 0.1.1 | Create IL test helpers | `il/helpers/il-test-utils.ts` |
| 0.1.2 | Create optimizer test helpers | `optimizer/helpers/optimizer-test-utils.ts` |

**Deliverables**:
- [ ] IL helpers file created with compileToIL, countOpcode, etc.
- [ ] Optimizer helpers file created with compileAndOptimize, generators, etc.
- [ ] Both helpers export correctly
- [ ] Tests pass: `./compiler-test`

**Verify**: `clear && ./compiler-test optimizer il`

---

## Phase 1: IL Generator Real-World Tests

> **Reference**: [03-il-real-world.md](03-il-real-world.md)

### Session 1.1: Game Loop + Sprite Tests

**Objective**: Create game loop and sprite handling real-world tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Create game loop tests | `il/e2e/real-world/game-loop.test.ts` |
| 1.1.2 | Create sprite handling tests | `il/e2e/real-world/sprite-handling.test.ts` |

**Deliverables**:
- [ ] 8-10 game loop pattern tests
- [ ] 8-10 sprite handling pattern tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test il`

### Session 1.2: Hardware + Memory Tests

**Objective**: Create hardware register and memory operation tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.2.1 | Create hardware register tests | `il/e2e/real-world/hardware-registers.test.ts` |
| 1.2.2 | Create memory operation tests | `il/e2e/real-world/memory-operations.test.ts` |

**Deliverables**:
- [ ] 8-10 hardware register tests
- [ ] 8-10 memory operation tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test il`

### Session 1.3: Input + Raster + Sound Tests

**Objective**: Create remaining real-world tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.3.1 | Create joystick/keyboard tests | `il/e2e/real-world/joystick-keyboard.test.ts` |
| 1.3.2 | Create raster timing tests | `il/e2e/real-world/raster-timing.test.ts` |
| 1.3.3 | Create sound/music tests | `il/e2e/real-world/sound-music.test.ts` |

**Deliverables**:
- [ ] 8-10 input handling tests
- [ ] 8-10 raster timing tests
- [ ] 8-10 sound/music tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test il`

---

## Phase 2: IL Generator Stress Tests

> **Reference**: [04-il-stress.md](04-il-stress.md)

### Session 2.1: Deep Nesting + Many Functions

**Objective**: Create stress tests for nesting and function counts

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Create deep nesting tests | `il/e2e/stress/deep-nesting.test.ts` |
| 2.1.2 | Create many functions tests | `il/e2e/stress/many-functions.test.ts` |

**Deliverables**:
- [ ] 8-10 deep nesting tests (5-20 levels)
- [ ] 8-10 many functions tests (20-100 functions)
- [ ] All tests passing

**Verify**: `clear && ./compiler-test il`

### Session 2.2: Many Variables + Large Programs

**Objective**: Create stress tests for variables and program size

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.2.1 | Create many variables tests | `il/e2e/stress/many-variables.test.ts` |
| 2.2.2 | Create large programs tests | `il/e2e/stress/large-programs.test.ts` |

**Deliverables**:
- [ ] 8-10 many variables tests (10-100 variables)
- [ ] 6-8 large programs tests (200-1000 IL instructions)
- [ ] All tests passing

**Verify**: `clear && ./compiler-test il`

---

## Phase 3: IL Generator Complex Tests

> **Reference**: [05-il-complex.md](05-il-complex.md)

### Session 3.1: Loops+Calls + Expressions

**Objective**: Create complex combination tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Create nested loops with calls tests | `il/e2e/complex/nested-loops-calls.test.ts` |
| 3.1.2 | Create expression trees tests | `il/e2e/complex/expression-trees.test.ts` |

**Deliverables**:
- [ ] 8-10 nested loops with calls tests
- [ ] 8-10 expression tree tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test il`

### Session 3.2: Control Flow + Arrays

**Objective**: Create control flow and array tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.2.1 | Create control flow matrix tests | `il/e2e/complex/control-flow-matrix.test.ts` |
| 3.2.2 | Create array operations tests | `il/e2e/complex/array-operations.test.ts` |

**Deliverables**:
- [ ] 8-10 control flow matrix tests
- [ ] 8-10 array operations tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test il`

### Session 3.3: State Machines + Multi-Module

**Objective**: Create state machine and multi-module tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.3.1 | Create state machines tests | `il/e2e/complex/state-machines.test.ts` |
| 3.3.2 | Create multi-module tests | `il/e2e/complex/multi-module.test.ts` |

**Deliverables**:
- [ ] 8-10 state machine tests
- [ ] 6-8 multi-module tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test il`

---

## Phase 4: IL Generator Edge Cases

> **Reference**: [06-il-edge-cases.md](06-il-edge-cases.md)

### Session 4.1: Byte + Word Boundaries

**Objective**: Create numeric boundary edge case tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Create byte boundaries tests | `il/edge-cases/byte-boundaries.test.ts` |
| 4.1.2 | Create word boundaries tests | `il/edge-cases/word-boundaries.test.ts` |

**Deliverables**:
- [ ] 10-12 byte boundary tests
- [ ] 10-12 word boundary tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test il`

### Session 4.2: Array + Break/Continue + Operators

**Objective**: Create remaining edge case tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.2.1 | Create array boundaries tests | `il/edge-cases/array-boundaries.test.ts` |
| 4.2.2 | Create break/continue tests | `il/edge-cases/break-continue.test.ts` |
| 4.2.3 | Create operator edge cases tests | `il/edge-cases/operator-edge-cases.test.ts` |

**Deliverables**:
- [ ] 8-10 array boundary tests
- [ ] 8-10 break/continue tests
- [ ] 12-15 operator edge case tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test il`

---

## Phase 5: Optimizer Real-World Tests

> **Reference**: [07-opt-real-world.md](07-opt-real-world.md)

### Session 5.1: Game Loop + Sprite Optimization

**Objective**: Create game loop and sprite optimization tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.1.1 | Create game loop optimization tests | `optimizer/e2e/real-world/game-loop-opt.test.ts` |
| 5.1.2 | Create sprite optimization tests | `optimizer/e2e/real-world/sprite-opt.test.ts` |

**Deliverables**:
- [ ] 8-10 game loop optimization tests
- [ ] 8-10 sprite optimization tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test optimizer`

### Session 5.2: Memory + Input Optimization

**Objective**: Create memory and input optimization tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.2.1 | Create memory access optimization tests | `optimizer/e2e/real-world/memory-access-opt.test.ts` |
| 5.2.2 | Create input handling optimization tests | `optimizer/e2e/real-world/input-handling-opt.test.ts` |

**Deliverables**:
- [ ] 8-10 memory optimization tests
- [ ] 8-10 input optimization tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test optimizer`

### Session 5.3: Arithmetic + Loop + Function Optimization

**Objective**: Create remaining optimization tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.3.1 | Create arithmetic optimization tests | `optimizer/e2e/real-world/arithmetic-opt.test.ts` |
| 5.3.2 | Create loop optimization tests | `optimizer/e2e/real-world/loop-opt.test.ts` |
| 5.3.3 | Create function optimization tests | `optimizer/e2e/real-world/function-opt.test.ts` |

**Deliverables**:
- [ ] 8-10 arithmetic optimization tests
- [ ] 8-10 loop optimization tests
- [ ] 8-10 function optimization tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test optimizer`

---

## Phase 6: Optimizer Stress Tests

> **Reference**: [08-opt-stress.md](08-opt-stress.md)

### Session 6.1: Large Functions + Many Passes

**Objective**: Create optimizer stress tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 6.1.1 | Create large function optimization tests | `optimizer/e2e/stress/large-function-opt.test.ts` |
| 6.1.2 | Create many passes tests | `optimizer/e2e/stress/many-passes.test.ts` |

**Deliverables**:
- [ ] 8-10 large function tests (50-500 instructions)
- [ ] 8-10 many passes tests (2-10 iterations)
- [ ] All tests passing

**Verify**: `clear && ./compiler-test optimizer`

### Session 6.2: Many Opportunities + Pathological

**Objective**: Create remaining optimizer stress tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 6.2.1 | Create many opportunities tests | `optimizer/e2e/stress/many-opportunities.test.ts` |
| 6.2.2 | Create pathological cases tests | `optimizer/e2e/stress/pathological-cases.test.ts` |

**Deliverables**:
- [ ] 8-10 many opportunities tests (20-50 opportunities)
- [ ] 8-10 pathological case tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test optimizer`

---

## Phase 7: Optimizer Correctness Tests

> **Reference**: [09-opt-correctness.md](09-opt-correctness.md)

### Session 7.1: DCE + Constant Fold Correctness

**Objective**: Create DCE and constant fold correctness tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.1.1 | Create DCE correctness tests | `optimizer/e2e/correctness/dce-correctness.test.ts` |
| 7.1.2 | Create constant fold correctness tests | `optimizer/e2e/correctness/constant-fold-correctness.test.ts` |

**Deliverables**:
- [ ] 10-12 DCE correctness tests
- [ ] 12-15 constant fold correctness tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test optimizer`

### Session 7.2: Propagation + Peephole Correctness

**Objective**: Create propagation and peephole correctness tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.2.1 | Create propagation correctness tests | `optimizer/e2e/correctness/propagation-correctness.test.ts` |
| 7.2.2 | Create peephole correctness tests | `optimizer/e2e/correctness/peephole-correctness.test.ts` |

**Deliverables**:
- [ ] 10-12 propagation correctness tests
- [ ] 10-12 peephole correctness tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test optimizer`

### Session 7.3: Order + Semantic Equivalence

**Objective**: Create ordering and equivalence tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.3.1 | Create order preservation tests | `optimizer/e2e/correctness/order-preservation.test.ts` |
| 7.3.2 | Create semantic equivalence tests | `optimizer/e2e/correctness/semantic-equivalence.test.ts` |

**Deliverables**:
- [ ] 8-10 order preservation tests
- [ ] 8-10 semantic equivalence tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test optimizer`

---

## Phase 8: Optimizer Edge Cases

> **Reference**: [10-opt-edge-cases.md](10-opt-edge-cases.md)

### Session 8.1: Boundary Values + Degenerate Code

**Objective**: Create boundary and degenerate edge case tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 8.1.1 | Create boundary values tests | `optimizer/edge-cases/boundary-values.test.ts` |
| 8.1.2 | Create degenerate code tests | `optimizer/edge-cases/degenerate-code.test.ts` |

**Deliverables**:
- [ ] 10-12 boundary value tests
- [ ] 8-10 degenerate code tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test optimizer`

### Session 8.2: Pass Interactions + Limits + Negative

**Objective**: Create remaining optimizer edge case tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 8.2.1 | Create pass interactions tests | `optimizer/edge-cases/pass-interactions.test.ts` |
| 8.2.2 | Create optimizer limits tests | `optimizer/edge-cases/optimizer-limits.test.ts` |
| 8.2.3 | Create negative cases tests | `optimizer/edge-cases/negative-cases.test.ts` |

**Deliverables**:
- [ ] 10-12 pass interaction tests
- [ ] 8-10 optimizer limits tests
- [ ] 10-12 negative case tests
- [ ] All tests passing

**Verify**: `clear && ./compiler-test optimizer`

---

## Task Checklist (All Phases)

### Phase 0: Shared Helpers ✅ COMPLETE
- [x] 0.1.1 Create IL test helpers ✅ (completed: 2026-03-02 18:30)
- [x] 0.1.2 Create optimizer test helpers ✅ (completed: 2026-03-02 18:30)

**📝 Important Note:** All test helpers use **REAL compiler components** - NO mocks!
- `compileToIL()` uses real Lexer → Parser → SemanticAnalyzer → ILGenerator
- `createTestSlot()` uses real `createFrameSlot()` factory
- `createTestFrame()` uses real `createFrame()` factory (renamed from misleading `createMockFrame`)
- `compileAndOptimize()` uses real ILOptimizer

### Phase 1: IL Real-World ⚠️ TEST FILES CREATED (reveal compiler gaps)
- [x] 1.1.1 Create game loop tests ✅ (2026-03-02 21:33)
- [x] 1.1.2 Create sprite handling tests ✅ (2026-03-02 21:35)
- [x] 1.2.1 Create hardware register tests ✅ (2026-03-02 21:36)
- [x] 1.2.2 Create memory operation tests ✅ (2026-03-02 21:38)
- [x] 1.3.1 Create joystick/keyboard tests ✅ (2026-03-02 21:39)
- [x] 1.3.2 Create raster timing tests ✅ (2026-03-02 21:41)
- [x] 1.3.3 Create sound/music tests ✅ (2026-03-02 21:43)

**⚠️ DISCOVERED COMPILER LIMITATIONS (104 tests failing):**
These tests revealed important gaps in the Blend65 semantic analyzer:
1. **@map declarations not visible in functions** - Module-level @map vars can't be accessed inside functions
2. **Global `let` variables not visible in functions** - Module-level variables aren't in function scope
3. **Empty array type inference** - `byte[N] = []` not supported (need explicit initialization)

**These are REAL compiler gaps to be fixed, not test bugs. The tests are correct.**

### Phase 2: IL Stress
- [ ] 2.1.1 Create deep nesting tests
- [ ] 2.1.2 Create many functions tests
- [ ] 2.2.1 Create many variables tests
- [ ] 2.2.2 Create large programs tests

### Phase 3: IL Complex
- [ ] 3.1.1 Create nested loops with calls tests
- [ ] 3.1.2 Create expression trees tests
- [ ] 3.2.1 Create control flow matrix tests
- [ ] 3.2.2 Create array operations tests
- [ ] 3.3.1 Create state machines tests
- [ ] 3.3.2 Create multi-module tests

### Phase 4: IL Edge Cases
- [ ] 4.1.1 Create byte boundaries tests
- [ ] 4.1.2 Create word boundaries tests
- [ ] 4.2.1 Create array boundaries tests
- [ ] 4.2.2 Create break/continue tests
- [ ] 4.2.3 Create operator edge cases tests

### Phase 5: Optimizer Real-World
- [ ] 5.1.1 Create game loop optimization tests
- [ ] 5.1.2 Create sprite optimization tests
- [ ] 5.2.1 Create memory access optimization tests
- [ ] 5.2.2 Create input handling optimization tests
- [ ] 5.3.1 Create arithmetic optimization tests
- [ ] 5.3.2 Create loop optimization tests
- [ ] 5.3.3 Create function optimization tests

### Phase 6: Optimizer Stress
- [ ] 6.1.1 Create large function optimization tests
- [ ] 6.1.2 Create many passes tests
- [ ] 6.2.1 Create many opportunities tests
- [ ] 6.2.2 Create pathological cases tests

### Phase 7: Optimizer Correctness
- [ ] 7.1.1 Create DCE correctness tests
- [ ] 7.1.2 Create constant fold correctness tests
- [ ] 7.2.1 Create propagation correctness tests
- [ ] 7.2.2 Create peephole correctness tests
- [ ] 7.3.1 Create order preservation tests
- [ ] 7.3.2 Create semantic equivalence tests

### Phase 8: Optimizer Edge Cases
- [ ] 8.1.1 Create boundary values tests
- [ ] 8.1.2 Create degenerate code tests
- [ ] 8.2.1 Create pass interactions tests
- [ ] 8.2.2 Create optimizer limits tests
- [ ] 8.2.3 Create negative cases tests

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/il-extreme-testing/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
clear && ./compiler-test

# 2. If tests pass, commit
git add .
git commit -m "test(il|optimizer): add [category] tests

- [Specific tests added]
- Tests: X passing

Ref: plans/il-extreme-testing/99-execution-plan.md
Task: X.X.X"

# 3. End agent settings
clear && scripts/agent.sh finished

# 4. Compact
/compact
```

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with `[x]`
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase 0: Shared Helpers
    ↓
Phase 1-4: IL Generator Tests (can be done in parallel)
    ↓
Phase 5-8: Optimizer Tests (can be done in parallel)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ All 46 test files created
2. ✅ All ~650 tests passing
3. ✅ No regressions in existing 5000+ tests
4. ✅ Each test file follows established patterns
5. ✅ Shared helpers working correctly
6. ✅ Test run time < 60 seconds total

---

## Quick Reference

| To Start Session | Command |
|------------------|---------|
| Begin | `exec_plan il-extreme-testing` |
| Test IL | `./compiler-test il` |
| Test Optimizer | `./compiler-test optimizer` |
| Test All | `./compiler-test` |