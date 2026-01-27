# Phase 7: Advanced Optimizations - Task Checklist

> **Phase**: 7 of 7  
> **Status**: Not Started  
> **Sessions**: ~8  
> **Tests**: ~185

---

## Overview

This document contains the complete task breakdown for implementing Phase 7: Advanced Optimizations, which completes the optimizer suite with loop optimizations, improved register allocation, size optimization, and optional self-modifying code.

---

## Session Overview

| Session | Focus | Tasks | Tests |
|---------|-------|-------|-------|
| 7.1 | Loop Analysis | 7 | ~40 |
| 7.2 | LICM | 6 | ~35 |
| 7.3 | Loop Unrolling | 6 | ~30 |
| 7.4 | Register Allocation | 7 | ~40 |
| 7.5 | Size Optimization | 5 | ~25 |
| 7.6 | SMC (Optional) | 4 | ~15 |
| 7.7 | Integration | 4 | - |
| 7.8 | Final Testing | 3 | - |

**Total**: 42 tasks, ~185 tests, ~8 sessions

---

## Session 7.1: Loop Analysis

**Reference**: [01-loop-analysis.md](01-loop-analysis.md)

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 7.1.1 | Create NaturalLoop class with body, header, latch | `analysis/loop.ts` | 8 |
| 7.1.2 | Implement back edge detection using dominators | `analysis/loop-detector.ts` | 6 |
| 7.1.3 | Implement loop body computation (reverse DFS) | `analysis/loop-detector.ts` | 5 |
| 7.1.4 | Build loop nesting tree (LoopNest class) | `analysis/loop-nest.ts` | 6 |
| 7.1.5 | Implement induction variable detection | `analysis/iv-analysis.ts` | 7 |
| 7.1.6 | Implement trip count computation | `analysis/trip-count.ts` | 5 |
| 7.1.7 | Add 6502-specific loop pattern recognition | `analysis/m6502-loops.ts` | 3 |

**Session Deliverables**:
- [ ] NaturalLoop class complete
- [ ] LoopDetector with back edge detection
- [ ] LoopNest for nested loop handling
- [ ] Induction variable analysis
- [ ] Trip count computation
- [ ] ~40 tests passing

**Verify**: `./compiler-test il`

---

## Session 7.2: Loop Invariant Code Motion (LICM)

**Reference**: [02-licm.md](02-licm.md)

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 7.2.1 | Implement invariant instruction detection | `passes/licm.ts` | 8 |
| 7.2.2 | Create preheader block management | `passes/licm.ts` | 6 |
| 7.2.3 | Implement safety checks (dominance, aliasing) | `passes/licm.ts` | 7 |
| 7.2.4 | Implement hoisting mechanism with dependency order | `passes/licm.ts` | 6 |
| 7.2.5 | Add nested loop support (innermost first) | `passes/licm.ts` | 5 |
| 7.2.6 | Add LICM statistics and debugging | `passes/licm.ts` | 3 |

**Session Deliverables**:
- [ ] Loop invariant detection
- [ ] Preheader creation and management
- [ ] Safe hoisting with all checks
- [ ] Nested loop handling
- [ ] ~35 tests passing

**Verify**: `./compiler-test il`

---

## Session 7.3: Loop Unrolling

**Reference**: [03-loop-unroll.md](03-loop-unroll.md)

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 7.3.1 | Implement full unrolling for small loops | `passes/loop-unroll.ts` | 6 |
| 7.3.2 | Implement partial unrolling with factor selection | `passes/loop-unroll.ts` | 6 |
| 7.3.3 | Add remainder handling (epilogue generation) | `passes/loop-unroll.ts` | 5 |
| 7.3.4 | Implement IV substitution with constants | `passes/loop-unroll.ts` | 5 |
| 7.3.5 | Add profitability analysis and cost model | `passes/loop-unroll.ts` | 4 |
| 7.3.6 | Configure unrolling by optimization level | `passes/loop-unroll.ts` | 4 |

**Session Deliverables**:
- [ ] Full unrolling for trip count ≤ 8
- [ ] Partial unrolling with 2×/4×/8× factors
- [ ] Correct remainder handling
- [ ] IV substitution
- [ ] ~30 tests passing

**Verify**: `./compiler-test il`

---

## Session 7.4: Register Allocation Improvements

**Reference**: [04-register-alloc.md](04-register-alloc.md)

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 7.4.1 | Implement live range computation | `alloc/live-range.ts` | 6 |
| 7.4.2 | Build interference graph | `alloc/interference.ts` | 5 |
| 7.4.3 | Implement graph coloring with constraints | `alloc/coloring.ts` | 8 |
| 7.4.4 | Add spill handling with ZP allocation | `alloc/spill.ts` | 6 |
| 7.4.5 | Implement accumulator chain optimization | `alloc/acc-chain.ts` | 5 |
| 7.4.6 | Add index register (X/Y) assignment | `alloc/index-reg.ts` | 5 |
| 7.4.7 | Implement transfer instruction minimization | `alloc/transfer-opt.ts` | 5 |

**Session Deliverables**:
- [ ] Live range analysis
- [ ] Interference graph construction
- [ ] Graph coloring with A/X/Y
- [ ] Spill code generation
- [ ] Accumulator chain optimization
- [ ] ~40 tests passing

**Verify**: `./compiler-test asm-il codegen`

---

## Session 7.5: Size Optimization (-Os, -Oz)

**Reference**: [05-size-opt.md](05-size-opt.md)

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 7.5.1 | Implement code factoring (JSR extraction) | `passes/code-factor.ts` | 6 |
| 7.5.2 | Add tail call optimization (JSR+RTS → JMP) | `passes/tail-call.ts` | 5 |
| 7.5.3 | Implement constant/string deduplication | `passes/const-dedup.ts` | 5 |
| 7.5.4 | Add branch distance optimization | `passes/branch-opt.ts` | 5 |
| 7.5.5 | Implement -Os/-Oz configuration and pass ordering | `config/size-opt.ts` | 4 |

**Session Deliverables**:
- [ ] Code factoring pass
- [ ] Tail call optimization
- [ ] Constant deduplication
- [ ] Branch optimization
- [ ] -Os and -Oz working
- [ ] ~25 tests passing

**Verify**: `./compiler-test asm-il codegen`

---

## Session 7.6: Self-Modifying Code (Optional)

**Reference**: [06-smc.md](06-smc.md)

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 7.6.1 | Implement SMC candidate detection | `passes/smc.ts` | 4 |
| 7.6.2 | Add SMC safety checks (ROM, interrupts) | `passes/smc.ts` | 4 |
| 7.6.3 | Implement address modification transformation | `passes/smc.ts` | 4 |
| 7.6.4 | Add -Osmc flag and SMC listing output | `passes/smc.ts` | 3 |

**Session Deliverables**:
- [ ] SMC detection for hot loops
- [ ] Safety verification
- [ ] SMC transformation
- [ ] -Osmc flag working
- [ ] ~15 tests passing

**Verify**: `./compiler-test asm-il codegen`

---

## Session 7.7: Integration and Pass Ordering

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 7.7.1 | Integrate loop passes with PassManager | `pass-manager.ts` | - |
| 7.7.2 | Configure pass ordering for -O3 | `config/o3-passes.ts` | - |
| 7.7.3 | Add optimization level presets | `config/opt-levels.ts` | - |
| 7.7.4 | Implement optimization statistics reporting | `stats/opt-stats.ts` | - |

**Session Deliverables**:
- [ ] All passes integrated
- [ ] -O1/-O2/-O3/-Os/-Oz configured
- [ ] Statistics reporting working
- [ ] Pass ordering verified

**Verify**: `./compiler-test`

---

## Session 7.8: Final Testing and Verification

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 7.8.1 | End-to-end optimization tests | `__tests__/e2e/` | - |
| 7.8.2 | Performance benchmarks | `benchmarks/` | - |
| 7.8.3 | Documentation and examples | `docs/` | - |

**Session Deliverables**:
- [ ] All E2E tests passing
- [ ] Benchmarks showing improvement
- [ ] Documentation complete
- [ ] main.asm producing clean output

**Verify**: `./compiler-test`

---

## Complete Task Checklist

### Session 7.1: Loop Analysis
- [ ] 7.1.1 Create NaturalLoop class
- [ ] 7.1.2 Implement back edge detection
- [ ] 7.1.3 Implement loop body computation
- [ ] 7.1.4 Build loop nesting tree
- [ ] 7.1.5 Implement induction variable detection
- [ ] 7.1.6 Implement trip count computation
- [ ] 7.1.7 Add 6502 loop pattern recognition

### Session 7.2: LICM
- [ ] 7.2.1 Implement invariant instruction detection
- [ ] 7.2.2 Create preheader block management
- [ ] 7.2.3 Implement safety checks
- [ ] 7.2.4 Implement hoisting mechanism
- [ ] 7.2.5 Add nested loop support
- [ ] 7.2.6 Add LICM statistics

### Session 7.3: Loop Unrolling
- [ ] 7.3.1 Implement full unrolling
- [ ] 7.3.2 Implement partial unrolling
- [ ] 7.3.3 Add remainder handling
- [ ] 7.3.4 Implement IV substitution
- [ ] 7.3.5 Add profitability analysis
- [ ] 7.3.6 Configure by optimization level

### Session 7.4: Register Allocation
- [ ] 7.4.1 Implement live range computation
- [ ] 7.4.2 Build interference graph
- [ ] 7.4.3 Implement graph coloring
- [ ] 7.4.4 Add spill handling
- [ ] 7.4.5 Implement accumulator chain optimization
- [ ] 7.4.6 Add index register assignment
- [ ] 7.4.7 Implement transfer minimization

### Session 7.5: Size Optimization
- [ ] 7.5.1 Implement code factoring
- [ ] 7.5.2 Add tail call optimization
- [ ] 7.5.3 Implement constant deduplication
- [ ] 7.5.4 Add branch distance optimization
- [ ] 7.5.5 Implement -Os/-Oz configuration

### Session 7.6: SMC (Optional)
- [ ] 7.6.1 Implement SMC detection
- [ ] 7.6.2 Add SMC safety checks
- [ ] 7.6.3 Implement SMC transformation
- [ ] 7.6.4 Add -Osmc flag

### Session 7.7: Integration
- [ ] 7.7.1 Integrate with PassManager
- [ ] 7.7.2 Configure -O3 pass ordering
- [ ] 7.7.3 Add optimization level presets
- [ ] 7.7.4 Implement statistics reporting

### Session 7.8: Final Testing
- [ ] 7.8.1 E2E optimization tests
- [ ] 7.8.2 Performance benchmarks
- [ ] 7.8.3 Documentation and examples

---

## Directory Structure After Phase 7

```
packages/compiler/src/il/optimizer/
├── analysis/
│   ├── loop.ts              # NaturalLoop, LoopNest
│   ├── loop-detector.ts     # Back edge detection
│   ├── iv-analysis.ts       # Induction variables
│   ├── trip-count.ts        # Trip count computation
│   └── m6502-loops.ts       # 6502 loop patterns
├── alloc/
│   ├── live-range.ts        # Live range analysis
│   ├── interference.ts      # Interference graph
│   ├── coloring.ts          # Graph coloring
│   ├── spill.ts             # Spill handling
│   ├── acc-chain.ts         # Accumulator chains
│   ├── index-reg.ts         # X/Y assignment
│   └── transfer-opt.ts      # Transfer minimization
├── passes/
│   ├── licm.ts              # Loop Invariant Code Motion
│   ├── loop-unroll.ts       # Loop unrolling
│   ├── code-factor.ts       # Code factoring
│   ├── tail-call.ts         # Tail call optimization
│   ├── const-dedup.ts       # Constant deduplication
│   ├── branch-opt.ts        # Branch optimization
│   └── smc.ts               # Self-modifying code
├── config/
│   ├── opt-levels.ts        # -O0 through -O3, -Os, -Oz
│   ├── size-opt.ts          # Size optimization config
│   └── o3-passes.ts         # -O3 pass ordering
└── stats/
    └── opt-stats.ts         # Statistics reporting
```

---

## Success Criteria

**Phase 7 is complete when**:

1. ✅ Loop analysis detects all loop structures
2. ✅ LICM correctly hoists invariant code
3. ✅ Loop unrolling with full/partial support
4. ✅ Register allocation minimizes spills
5. ✅ Size optimization produces smaller code
6. ✅ All optimization levels working (-O0 to -O3, -Os, -Oz)
7. ✅ ~185 tests passing
8. ✅ main.asm produces clean, optimized output
9. ✅ Performance competitive with hand-written assembly

---

## 🎉 Optimizer Complete!

After Phase 7:

- **-O0**: Debug mode, no optimization
- **-O1**: Basic (DCE, constant propagation)
- **-O2**: Standard (peephole optimizations)
- **-O3**: Aggressive (loops, register allocation)
- **-Os**: Size preference
- **-Oz**: Minimum size
- **-Osmc**: Self-modifying code (opt-in)

**The Blend65 compiler produces god-level optimized 6502 code!** 🚀

---

**Previous Document**: [06-smc.md](06-smc.md)  
**Parent**: [00-phase-index.md](00-phase-index.md)  
**Roadmap**: [OPTIMIZER-ROADMAP.md](../OPTIMIZER-ROADMAP.md)