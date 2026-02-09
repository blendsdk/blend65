# Execution Plan: Optimizer V2

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-02 12:12
> **Progress**: 19/40 tasks (48%)

## Overview

This document defines the execution phases and AI chat sessions for implementing all 14 optimizer gaps.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time | Gaps Covered |
|-------|-------|----------|-----------|--------------|
| 1 | Program-Level Infrastructure | 2-3 | 4-6 hr | GAP-1, GAP-2 |
| 2 | Inter-Procedural Optimizations | 3-4 | 6-8 hr | GAP-3, GAP-4, GAP-5, GAP-6 |
| 3 | IL & ASM Improvements | 2-3 | 3-5 hr | GAP-7, GAP-8, GAP-13, GAP-14 |
| 4 | Advanced Loop Optimizations | 3-4 | 6-8 hr | GAP-9, GAP-10, GAP-11, GAP-12 |

**Total: 10-14 sessions, ~19-27 hours**

---

## Phase 1: Program-Level Infrastructure

### Session 1.1: ProgramOptimizationPass Interface + Options

**Reference**: [03-program-level.md](03-program-level.md)

**Objective**: Add program-level pass infrastructure to existing optimizer.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add `ProgramOptimizationPass` interface and `ProgramPassResult` to `pass.ts` | `optimizer/pass.ts` |
| 1.1.2 | Add `PROGRAM_LEVEL_PASSES` config to `options.ts` | `optimizer/options.ts` |
| 1.1.3 | Add `resolveProgramPasses()` function to `options.ts` | `optimizer/options.ts` |
| 1.1.4 | Modify `ILOptimizer` to register and run program passes before function passes | `optimizer/il-optimizer.ts` |
| 1.1.5 | Write unit tests for program pass registration and execution (~15 tests) | `__tests__/optimizer/` |

**Deliverables**:
- [ ] `ProgramOptimizationPass` interface exists
- [ ] `ILOptimizer.optimizeProgram()` runs program passes first
- [ ] All existing tests still pass
- [ ] New tests passing

**Verify**: `./compiler-test optimizer` then `./compiler-test`

---

### Session 1.2: Call Graph Analysis

**Reference**: [03-program-level.md](03-program-level.md)

**Objective**: Implement call graph construction and query API.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.2.1 | Create `optimizer/analysis/` directory and `index.ts` | `optimizer/analysis/index.ts` |
| 1.2.2 | Implement `CallGraph` class with `build()` static method | `optimizer/analysis/call-graph.ts` |
| 1.2.3 | Implement reachability analysis (BFS from entry) | `optimizer/analysis/call-graph.ts` |
| 1.2.4 | Implement query methods: `isReachable`, `getCallCount`, `getCallers`, `getCallees` | `optimizer/analysis/call-graph.ts` |
| 1.2.5 | Implement `rebuild()` for post-inlining updates | `optimizer/analysis/call-graph.ts` |
| 1.2.6 | Write unit tests for call graph (~25 tests) | `__tests__/optimizer/analysis/call-graph.test.ts` |

**Deliverables**:
- [ ] `CallGraph` class fully functional
- [ ] All query methods tested
- [ ] Edge cases: recursive, mutual recursion, empty program

**Verify**: `./compiler-test optimizer`

---

## Phase 2: Inter-Procedural Optimizations

### Session 2.1: Dead Function Elimination

**Reference**: [04-inter-procedural.md](04-inter-procedural.md)

**Objective**: Remove functions unreachable from entry point.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Create `DeadFunctionElimPass` implementing `ProgramOptimizationPass` | `optimizer/passes/dead-function-elim.ts` |
| 2.1.2 | Register pass in `ILOptimizer.registerDefaultProgramPasses()` | `optimizer/il-optimizer.ts` |
| 2.1.3 | Add 'dead-function-elim' to `PROGRAM_LEVEL_PASSES` for O1+ | `optimizer/options.ts` |
| 2.1.4 | Write unit tests (~15 tests) | `__tests__/optimizer/passes/dead-function-elim.test.ts` |
| 2.1.5 | Write E2E test: border-cycle with `-O1` removes `speedy()` | `__tests__/optimizer/e2e.test.ts` |

**Deliverables**:
- [ ] `speedy()` eliminated from border-cycle output
- [ ] All tests passing

**Verify**: `./compiler-test optimizer` then `./compiler-test`

---

### Session 2.2: Dead Global Elimination

**Reference**: [04-inter-procedural.md](04-inter-procedural.md)

**Objective**: Remove unreferenced module-level variables/constants.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.2.1 | Create `DeadGlobalElimPass` implementing `ProgramOptimizationPass` | `optimizer/passes/dead-global-elim.ts` |
| 2.2.2 | Register pass and add to O2+ level config | `optimizer/il-optimizer.ts`, `optimizer/options.ts` |
| 2.2.3 | Write unit tests (~10 tests) | `__tests__/optimizer/passes/dead-global-elim.test.ts` |

**Deliverables**:
- [ ] Unused globals removed at O2
- [ ] Tests passing

**Verify**: `./compiler-test optimizer`

---

### Session 2.3: Function Inlining — Single-Call-Site (O1)

**Reference**: [04-inter-procedural.md](04-inter-procedural.md)

**Objective**: Inline functions called from exactly 1 call site.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.3.1 | Create `FunctionInliningPass` skeleton implementing `ProgramOptimizationPass` | `optimizer/passes/function-inlining.ts` |
| 2.3.2 | Implement `findCandidates()` for single-call-site detection | `optimizer/passes/function-inlining.ts` |
| 2.3.3 | Implement `cloneInstructions()` with label/slot remapping | `optimizer/passes/function-inlining.ts` |
| 2.3.4 | Implement `inlineFunction()` — replace CALL with cloned body, RETURN→JUMP | `optimizer/passes/function-inlining.ts` |
| 2.3.5 | Register pass for O1+ level | `optimizer/il-optimizer.ts`, `optimizer/options.ts` |
| 2.3.6 | Write unit tests (~20 tests) | `__tests__/optimizer/passes/function-inlining.test.ts` |
| 2.3.7 | Write E2E test: border-cycle `-O1` inlines `delay()` | `__tests__/optimizer/e2e.test.ts` |

**Deliverables**:
- [ ] `delay()` inlined into `main()` in border-cycle
- [ ] Label and slot remapping correct
- [ ] Recursive functions NOT inlined
- [ ] All tests passing

**Verify**: `./compiler-test optimizer` then `./compiler-test`

---

### Session 2.4: Function Inlining — Small Function (O2)

**Reference**: [04-inter-procedural.md](04-inter-procedural.md)

**Objective**: Extend inlining to small functions at O2+.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.4.1 | Extend `findCandidates()` with size-based threshold for O2 | `optimizer/passes/function-inlining.ts` |
| 2.4.2 | Add size budget check (max 20% code growth) | `optimizer/passes/function-inlining.ts` |
| 2.4.3 | Write additional tests for O2 inlining (~10 tests) | `__tests__/optimizer/passes/function-inlining.test.ts` |

**Deliverables**:
- [ ] Small functions inlined at O2
- [ ] Size budget respected
- [ ] Tests passing

**Verify**: `./compiler-test optimizer`

---

## Phase 3: IL & ASM Improvements

### Session 3.1: Fix MUL/DIV Strength Reduction

**Reference**: [05-il-improvements.md](05-il-improvements.md)

**Objective**: Implement the stubbed-out MUL/DIV reduction in il-peephole.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Implement `tryReduceMultiply()` — power-of-2 → SHL, 0 → LOAD_IMM 0, 1 → remove | `optimizer/passes/il-peephole.ts` |
| 3.1.2 | Implement `tryReduceDivide()` — power-of-2 → SHR, 1 → remove | `optimizer/passes/il-peephole.ts` |
| 3.1.3 | Write unit tests (~15 tests) | `__tests__/optimizer/passes/il-peephole.test.ts` |

**Deliverables**:
- [ ] MUL by 2,4,8,16,32,64,128 → SHL
- [ ] DIV by 2,4,8,16,32,64,128 → SHR
- [ ] Special cases handled (×0, ×1, ÷1)
- [ ] Tests passing

**Verify**: `./compiler-test optimizer`

---

### Session 3.2: CSE Pass

**Reference**: [05-il-improvements.md](05-il-improvements.md)

**Objective**: Implement common subexpression elimination.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.2.1 | Create `CSEPass` implementing `OptimizationPass` | `optimizer/passes/cse.ts` |
| 3.2.2 | Implement expression tracking within basic blocks | `optimizer/passes/cse.ts` |
| 3.2.3 | Implement invalidation on writes and block boundaries | `optimizer/passes/cse.ts` |
| 3.2.4 | Register pass for O2+ | `optimizer/il-optimizer.ts`, `optimizer/options.ts` |
| 3.2.5 | Write unit tests (~15 tests) | `__tests__/optimizer/passes/cse.test.ts` |

**Deliverables**:
- [ ] Duplicate computations eliminated within blocks
- [ ] Proper invalidation
- [ ] Tests passing

**Verify**: `./compiler-test optimizer`

---

### Session 3.3: ASM-Level Pattern Additions

**Reference**: [05-il-improvements.md](05-il-improvements.md)

**Objective**: Add Compare+Branch simplification and indexed addressing optimization.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.3.1 | Create `CompareBranchPass` implementing `AsmOptimizationPass` | `codegen/asm-il/optimizer/passes/compare-branch.ts` |
| 3.3.2 | Create `IndexedAddrPass` implementing `AsmOptimizationPass` | `codegen/asm-il/optimizer/passes/indexed-addr.ts` |
| 3.3.3 | Register both passes in `pass-factory.ts` for O2+ | `codegen/asm-il/optimizer/pass-factory.ts` |
| 3.3.4 | Write unit tests (~15 tests) | `__tests__/asm-il/optimizer/` |

**Deliverables**:
- [ ] CMP+BCC+BEQ → CMP+BCC pattern works
- [ ] Indexed addressing for array access patterns
- [ ] Tests passing

**Verify**: `./compiler-test asm-il` then `./compiler-test`

---

## Phase 4: Advanced Loop Optimizations

### Session 4.1: Loop Tree Analysis

**Reference**: [06-advanced-loops.md](06-advanced-loops.md)

**Objective**: Build loop tree from existing ILLoop structures.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Create `LoopTree` class with `build()` static method | `optimizer/analysis/loop-tree.ts` |
| 4.1.2 | Implement `getLoopFor()`, `getDepth()`, `getBodyIndices()` | `optimizer/analysis/loop-tree.ts` |
| 4.1.3 | Implement `getPreheaderIndex()` for LICM insertion point | `optimizer/analysis/loop-tree.ts` |
| 4.1.4 | Export from `optimizer/analysis/index.ts` | `optimizer/analysis/index.ts` |
| 4.1.5 | Write unit tests (~15 tests) | `__tests__/optimizer/analysis/loop-tree.test.ts` |

**Deliverables**:
- [ ] Loop tree builds correctly from ILFunction.loops
- [ ] All queries return correct results
- [ ] Nested loops handled properly

**Verify**: `./compiler-test optimizer`

---

### Session 4.2: LICM (Loop Invariant Code Motion)

**Reference**: [06-advanced-loops.md](06-advanced-loops.md)

**Objective**: Move invariant computations out of loops.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.2.1 | Create `LICMPass` implementing `OptimizationPass` | `optimizer/passes/licm.ts` |
| 4.2.2 | Implement `isInvariant()` and `hasSideEffects()` checks | `optimizer/passes/licm.ts` |
| 4.2.3 | Implement `hoistToPreheader()` instruction movement | `optimizer/passes/licm.ts` |
| 4.2.4 | Register pass for O2+ | `optimizer/il-optimizer.ts`, `optimizer/options.ts` |
| 4.2.5 | Write unit tests (~15 tests) | `__tests__/optimizer/passes/licm.test.ts` |

**Deliverables**:
- [ ] Invariant loads hoisted out of loops
- [ ] Side effects preserved in loop body
- [ ] Tests passing

**Verify**: `./compiler-test optimizer`

---

### Session 4.3: Loop Unrolling

**Reference**: [06-advanced-loops.md](06-advanced-loops.md)

**Objective**: Unroll small constant-count loops.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.3.1 | Create `LoopUnrollPass` implementing `OptimizationPass` | `optimizer/passes/loop-unroll.ts` |
| 4.3.2 | Implement `getIterationCount()` to detect constant-count loops | `optimizer/passes/loop-unroll.ts` |
| 4.3.3 | Implement `unrollLoop()` with body duplication | `optimizer/passes/loop-unroll.ts` |
| 4.3.4 | Register pass for O2+ (not Os/Oz) | `optimizer/il-optimizer.ts`, `optimizer/options.ts` |
| 4.3.5 | Write unit tests (~10 tests) | `__tests__/optimizer/passes/loop-unroll.test.ts` |

**Deliverables**:
- [ ] Small loops unrolled at O2/O3
- [ ] Unknown-count loops skipped
- [ ] Not enabled at Os/Oz

**Verify**: `./compiler-test optimizer`

---

### Session 4.4: Register Allocation Improvements

**Reference**: [06-advanced-loops.md](06-advanced-loops.md)

**Objective**: Better X/Y register utilization for loop counters and indices.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.4.1 | Extend `register-tracker.ts` to track X/Y availability across blocks | `codegen/asm-il/optimizer/analysis/register-tracker.ts` |
| 4.4.2 | Create loop counter promotion logic (INC/DEC mem → INX/DEX) | `codegen/asm-il/optimizer/passes/register-promote.ts` |
| 4.4.3 | Register pass in ASM optimizer for O2+ | `codegen/asm-il/optimizer/pass-factory.ts` |
| 4.4.4 | Write unit tests (~10 tests) | `__tests__/asm-il/optimizer/register-promote.test.ts` |

**Deliverables**:
- [ ] Loop counters use X/Y when available
- [ ] INX/DEX patterns for iteration
- [ ] Tests passing

**Verify**: `./compiler-test asm-il` then `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Program-Level Infrastructure

- [x] 1.1.1 Add ProgramOptimizationPass interface to pass.ts ✅ (completed: 2026-09-02 09:27)
- [x] 1.1.2 Add PROGRAM_LEVEL_PASSES to options.ts ✅ (completed: 2026-09-02 09:28)
- [x] 1.1.3 Add resolveProgramPasses() to options.ts ✅ (completed: 2026-09-02 09:28)
- [x] 1.1.4 Modify ILOptimizer for program passes ✅ (completed: 2026-09-02 09:30)
- [x] 1.1.5 Write program pass tests (~15) ✅ (completed: 2026-09-02 09:33)
- [x] 1.2.1 Create optimizer/analysis/ directory ✅ (completed: 2026-09-02 09:53)
- [x] 1.2.2 Implement CallGraph.build() ✅ (completed: 2026-09-02 09:53)
- [x] 1.2.3 Implement reachability analysis ✅ (completed: 2026-09-02 09:53)
- [x] 1.2.4 Implement query methods ✅ (completed: 2026-09-02 09:53)
- [x] 1.2.5 Implement rebuild() ✅ (completed: 2026-09-02 09:53)
- [x] 1.2.6 Write call graph tests (~25) ✅ (completed: 2026-09-02 10:00)

### Phase 2: Inter-Procedural Optimizations

- [x] 2.1.1 Create DeadFunctionElimPass ✅ (completed: 2026-09-02 10:44)
- [x] 2.1.2 Register in ILOptimizer ✅ (completed: 2026-09-02 10:45)
- [x] 2.1.3 Add to PROGRAM_LEVEL_PASSES ✅ (completed: 2026-09-02 10:45)
- [x] 2.1.4 Write dead function elim tests (~18) + fix regressions ✅ (completed: 2026-09-02 11:06)
- [x] 2.1.5 Write E2E test: border-cycle speedy() eliminated ✅ (completed: 2026-09-02 11:27)
- [x] 2.2.1 Create DeadGlobalElimPass ✅ (completed: 2026-09-02 12:05)
- [x] 2.2.2 Register and configure ✅ (completed: 2026-09-02 12:05)
- [x] 2.2.3 Write dead global tests (~12) + fix regressions ✅ (completed: 2026-09-02 12:12)
- [ ] 2.3.1 Create FunctionInliningPass skeleton
- [ ] 2.3.2 Implement findCandidates() single-site
- [ ] 2.3.3 Implement cloneInstructions() with remapping
- [ ] 2.3.4 Implement inlineFunction()
- [ ] 2.3.5 Register for O1+
- [ ] 2.3.6 Write inlining tests (~20)
- [ ] 2.3.7 Write E2E test: delay() inlined
- [ ] 2.4.1 Extend findCandidates() for O2 small-function
- [ ] 2.4.2 Add size budget check
- [ ] 2.4.3 Write O2 inlining tests (~10)

### Phase 3: IL & ASM Improvements

- [ ] 3.1.1 Implement tryReduceMultiply()
- [ ] 3.1.2 Implement tryReduceDivide()
- [ ] 3.1.3 Write MUL/DIV tests (~15)
- [ ] 3.2.1 Create CSEPass
- [ ] 3.2.2 Implement expression tracking
- [ ] 3.2.3 Implement invalidation
- [ ] 3.2.4 Register for O2+
- [ ] 3.2.5 Write CSE tests (~15)
- [ ] 3.3.1 Create CompareBranchPass
- [ ] 3.3.2 Create IndexedAddrPass
- [ ] 3.3.3 Register in pass-factory
- [ ] 3.3.4 Write ASM pattern tests (~15)

### Phase 4: Advanced Loop Optimizations

- [ ] 4.1.1 Create LoopTree class
- [ ] 4.1.2 Implement query methods
- [ ] 4.1.3 Implement getPreheaderIndex()
- [ ] 4.1.4 Export from analysis/index.ts
- [ ] 4.1.5 Write loop tree tests (~15)
- [ ] 4.2.1 Create LICMPass
- [ ] 4.2.2 Implement isInvariant() and hasSideEffects()
- [ ] 4.2.3 Implement hoistToPreheader()
- [ ] 4.2.4 Register for O2+
- [ ] 4.2.5 Write LICM tests (~15)
- [ ] 4.3.1 Create LoopUnrollPass
- [ ] 4.3.2 Implement getIterationCount()
- [ ] 4.3.3 Implement unrollLoop()
- [ ] 4.3.4 Register for O2+ (not Os/Oz)
- [ ] 4.3.5 Write loop unroll tests (~10)
- [ ] 4.4.1 Extend register-tracker for X/Y availability
- [ ] 4.4.2 Create register promotion logic
- [ ] 4.4.3 Register in ASM optimizer
- [ ] 4.4.4 Write register promote tests (~10)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/optimizer-v2/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test optimizer

# 2. Run full tests if cross-cutting
./compiler-test

# 3. End agent settings
clear && scripts/agent.sh finished

# 4. Compact conversation
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
Phase 1 (Infrastructure)
    ↓
Phase 2 (Inter-Procedural) ──── Phase 3 (IL/ASM Improvements)
    ↓                                    ↓
Phase 4 (Advanced Loops) ←──────────────┘
```

Phase 3 can run in parallel with Phase 2 since it doesn't depend on program-level passes (except CSE which is function-level, and ASM passes are independent).

---

## Success Criteria

**Feature is complete when**:

1. ✅ All 14 gaps implemented
2. ✅ All new tests passing (~200+ new tests)
3. ✅ No regressions in existing tests
4. ✅ border-cycle `-O1`: `speedy()` eliminated, `delay()` inlined
5. ✅ JSDoc on all new public/protected APIs
6. ✅ Code follows project standards (code.md)
