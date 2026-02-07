# Execution Plan: ASM-IL Optimizer

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-02 16:05
> **Progress**: 24/32 tasks (75%)

## Overview

This document defines the execution phases and AI chat sessions for implementing the ASM-IL Optimizer.

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Infrastructure Migration | 2 | 2-3 hours |
| 2 | Analysis Utilities | 1-2 | 1-2 hours |
| 3 | Core Passes (O1) | 2 | 2-3 hours |
| 4 | Standard Passes (O2) | 2 | 2-3 hours |
| 5 | Advanced Passes (O3) | 3 | 3-4 hours |
| 6 | Size Passes (Os/Oz) | 1 | 1-2 hours |
| 7 | Integration & Testing | 2 | 2-3 hours |

**Total: ~13-20 hours across ~13 sessions**

---

## Phase 1: Infrastructure Migration

### Session 1.1: Types and Base Infrastructure

**Reference**: [02-current-state.md](02-current-state.md), [03-infrastructure.md](03-infrastructure.md)

**Objective**: Migrate ASM-IL types and optimizer infrastructure to compiler-v2

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Migrate ASM-IL types | `asm-il/types.ts` |
| 1.1.2 | Migrate optimizer types | `asm-il/optimizer/types.ts` |
| 1.1.3 | Migrate base optimizer | `asm-il/optimizer/base-optimizer.ts` |
| 1.1.4 | Migrate pass manager | `asm-il/optimizer/asm-optimizer.ts` |

**Verify**: `./compiler-test asm-il`

---

### Session 1.2: Optimization Level System

**Reference**: [03-infrastructure.md](03-infrastructure.md)

**Objective**: Add optimization level handling and pass factory

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.2.1 | Create OptimizationLevel enum | `asm-il/optimizer/options.ts` |
| 1.2.2 | Create DEFAULT_OPTIONS | `asm-il/optimizer/options.ts` |
| 1.2.3 | Create createPassesForLevel() | `asm-il/optimizer/pass-factory.ts` |
| 1.2.4 | Create AsmILOptimizer class | `asm-il/optimizer/asm-il-optimizer.ts` |
| 1.2.5 | Add unit tests | `__tests__/asm-il/optimizer/options.test.ts` |

**Verify**: `./compiler-test asm-il/optimizer`

---

## Phase 2: Analysis Utilities

### Session 2.1: CPU State Analysis

**Reference**: [03-infrastructure.md](03-infrastructure.md)

**Objective**: Implement analysis utilities for safe optimization

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Implement FlagStateAnalyzer | `asm-il/optimizer/analysis/flag-state.ts` |
| 2.1.2 | Implement RegisterTracker | `asm-il/optimizer/analysis/register-tracker.ts` |
| 2.1.3 | Implement AddressAnalyzer | `asm-il/optimizer/analysis/address-analyzer.ts` |
| 2.1.4 | Add analysis unit tests | `__tests__/asm-il/optimizer/analysis/` |

**Verify**: `./compiler-test asm-il/optimizer/analysis`

---

## Phase 3: Core Passes (O1)

### Session 3.1: Flag Patterns Pass

**Reference**: [04-flag-patterns.md](04-flag-patterns.md)

**Objective**: Implement flag optimization patterns

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Implement FlagPatternsPass | `asm-il/optimizer/passes/flag-patterns.ts` |
| 3.1.2 | Add redundant CMP #0 removal | `passes/flag-patterns.ts` |
| 3.1.3 | Add dead CLC/SEC removal | `passes/flag-patterns.ts` |
| 3.1.4 | Add unit tests | `__tests__/asm-il/optimizer/passes/flag-patterns.test.ts` |

**Verify**: `./compiler-test asm-il/optimizer/passes/flag-patterns`

---

### Session 3.2: Store-Load Pass

**Reference**: [05-store-load.md](05-store-load.md)

**Objective**: Implement store-load elimination

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.2.1 | Implement StoreLoadPass | `asm-il/optimizer/passes/store-load.ts` |
| 3.2.2 | Add STA/LDA elimination | `passes/store-load.ts` |
| 3.2.3 | Add STX/LDX, STY/LDY | `passes/store-load.ts` |
| 3.2.4 | Add unit tests | `__tests__/asm-il/optimizer/passes/store-load.test.ts` |

**Verify**: `./compiler-test asm-il/optimizer/passes/store-load`

---

## Phase 4: Standard Passes (O2)

### Session 4.1: Branch Optimization

**Reference**: [06-branch-opt.md](06-branch-opt.md)

**Objective**: Implement branch chain collapse and dead code removal

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Implement BranchOptPass | `asm-il/optimizer/passes/branch-opt.ts` |
| 4.1.2 | Add JMP chain collapse | `passes/branch-opt.ts` |
| 4.1.3 | Add unreachable code removal | `passes/branch-opt.ts` |
| 4.1.4 | Add unit tests | `__tests__/asm-il/optimizer/passes/branch-opt.test.ts` |

**Verify**: `./compiler-test asm-il/optimizer/passes/branch-opt`

---

### Session 4.2: Transfer Optimization

**Reference**: [07-transfer-patterns.md](07-transfer-patterns.md)

**Objective**: Implement transfer register optimization

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.2.1 | Implement TransferOptPass | `asm-il/optimizer/passes/transfer-opt.ts` |
| 4.2.2 | Add reverse transfer removal | `passes/transfer-opt.ts` |
| 4.2.3 | Add unit tests | `__tests__/asm-il/optimizer/passes/transfer-opt.test.ts` |

**Verify**: `./compiler-test asm-il/optimizer/passes/transfer-opt`

---

## Phase 5: Advanced Passes (O3)

### Session 5.1: Zero-Page Promotion

**Reference**: [08-zp-promotion.md](08-zp-promotion.md)

**Objective**: Implement ZP promotion for hot variables

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.1.1 | Implement ZPPromotionPass | `asm-il/optimizer/passes/zp-promotion.ts` |
| 5.1.2 | Add frequency counting | `passes/zp-promotion.ts` |
| 5.1.3 | Add hotness ranking | `passes/zp-promotion.ts` |
| 5.1.4 | Add reference transformation | `passes/zp-promotion.ts` |
| 5.1.5 | Add unit tests | `__tests__/asm-il/optimizer/passes/zp-promotion.test.ts` |

**Verify**: `./compiler-test asm-il/optimizer/passes/zp-promotion`

---

### Session 5.2: 6502 Strength Reduction

**Reference**: [09-6502-strength.md](09-6502-strength.md)

**Objective**: Implement 6502-specific strength reduction

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.2.1 | Implement Strength6502Pass | `asm-il/optimizer/passes/strength-6502.ts` |
| 5.2.2 | Add multiply patterns | `passes/strength-6502.ts` |
| 5.2.3 | Add divide/modulo patterns | `passes/strength-6502.ts` |
| 5.2.4 | Add unit tests | `__tests__/asm-il/optimizer/passes/strength-6502.test.ts` |

**Verify**: `./compiler-test asm-il/optimizer/passes/strength-6502`

---

### Session 5.3: Stack Optimization

**Reference**: [10-stack-opt.md](10-stack-opt.md)

**Objective**: Implement PHA/PLA elimination

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.3.1 | Implement StackOptPass | `asm-il/optimizer/passes/stack-opt.ts` |
| 5.3.2 | Add redundant pair detection | `passes/stack-opt.ts` |
| 5.3.3 | Add unit tests | `__tests__/asm-il/optimizer/passes/stack-opt.test.ts` |

**Verify**: `./compiler-test asm-il/optimizer/passes/stack-opt`

---

## Phase 6: Size Passes (Os/Oz)

### Session 6.1: Size Optimization

**Reference**: [11-size-opt.md](11-size-opt.md)

**Objective**: Implement size-focused optimizations

**Tasks**:
| # | Task | File |
|---|------|------|
| 6.1.1 | Implement SizeOptPass | `asm-il/optimizer/passes/size-opt.ts` |
| 6.1.2 | Add tail call optimization | `passes/size-opt.ts` |
| 6.1.3 | Add sequence factoring (Oz) | `passes/size-opt.ts` |
| 6.1.4 | Add unit tests | `__tests__/asm-il/optimizer/passes/size-opt.test.ts` |

**Verify**: `./compiler-test asm-il/optimizer/passes/size-opt`

---

## Phase 7: Integration & Testing

### Session 7.1: Integration Tests

**Reference**: [12-testing-strategy.md](12-testing-strategy.md)

**Objective**: Integration testing and pass combinations

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.1.1 | Create integration test suite | `__tests__/asm-il/optimizer/integration/` |
| 7.1.2 | Test pass ordering | `integration/pass-order.test.ts` |
| 7.1.3 | Test fixed-point iteration | `integration/fixed-point.test.ts` |
| 7.1.4 | Test level configurations | `integration/level-config.test.ts` |

**Verify**: `./compiler-test asm-il/optimizer/integration`

---

### Session 7.2: E2E Testing & Pipeline Integration

**Reference**: [12-testing-strategy.md](12-testing-strategy.md)

**Objective**: Wire into compilation pipeline and E2E tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.2.1 | Wire optimizer into pipeline | `pipeline/compiler.ts` (or equivalent) |
| 7.2.2 | Add E2E compilation tests | `__tests__/e2e/optimization.test.ts` |
| 7.2.3 | Add correctness verification | `__tests__/e2e/correctness.test.ts` |
| 7.2.4 | Final verification | All tests |

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Infrastructure Migration
- [x] 1.1.1 Migrate ASM-IL types ✅ (completed: 2026-07-02 00:34 — v2 types already existed in codegen/asm-il/types.ts)
- [x] 1.1.2 Migrate optimizer types ✅ (completed: 2026-07-02 00:34 — adapted for v2 AsmILProgram)
- [x] 1.1.3 Migrate base optimizer ✅ (completed: 2026-07-02 00:36 — with passes array clone fix)
- [x] 1.1.4 Migrate pass manager ✅ (completed: 2026-07-02 00:39 — with fixed-point iteration + stats)
- [x] 1.2.1 Create OptimizationLevel enum ✅ (completed: 2026-07-02 02:24)
- [x] 1.2.2 Create DEFAULT_OPTIONS ✅ (completed: 2026-07-02 02:24)
- [x] 1.2.3 Create createPassesForLevel() ✅ (completed: 2026-07-02 02:29)
- [x] 1.2.4 Create AsmILOptimizer class ✅ (completed: 2026-07-02 02:33)
- [x] 1.2.5 Add unit tests ✅ (completed: 2026-07-02 04:08 — 3 test files, 78 new tests)

### Phase 2: Analysis Utilities
- [x] 2.1.1 Implement FlagStateAnalyzer ✅ (completed: 2026-07-02 08:15)
- [x] 2.1.2 Implement RegisterTracker ✅ (completed: 2026-07-02 08:20)
- [x] 2.1.3 Implement AddressAnalyzer ✅ (completed: 2026-07-02 08:27)
- [x] 2.1.4 Add analysis unit tests ✅ (completed: 2026-07-02 09:13 — 3 test files, 194 new tests)

### Phase 3: Core Passes (O1)
- [x] 3.1.1 Implement FlagPatternsPass ✅ (completed: 2026-07-02 11:10 — with 3 pattern types)
- [x] 3.1.2 Add redundant CMP #0 removal ✅ (completed: 2026-07-02 11:10 — with Immediate mode check)
- [x] 3.1.3 Add dead CLC/SEC removal ✅ (completed: 2026-07-02 11:10 — duplicate/opposite/dead patterns)
- [x] 3.1.4 Add flag patterns unit tests ✅ (completed: 2026-07-02 12:15 — 4 test files, ~65 tests)
- [x] 3.2.1 Implement StoreLoadPass ✅ (completed: 2026-07-02 14:16)
- [x] 3.2.2 Add STA/LDA elimination ✅ (completed: 2026-07-02 14:16)
- [x] 3.2.3 Add STX/LDX, STY/LDY ✅ (completed: 2026-07-02 14:16)
- [x] 3.2.4 Add store-load unit tests ✅ (completed: 2026-07-02 14:55 — 3 test files: basics, patterns, edge-cases)

### Phase 4: Standard Passes (O2)
- [x] 4.1.1 Implement BranchOptPass ✅ (completed: 2026-07-02 15:57 — JMP chain, unreachable code, branch-over-JMP)
- [x] 4.1.2 Add JMP chain collapse ✅ (completed: 2026-07-02 15:57)
- [x] 4.1.3 Add unreachable code removal ✅ (completed: 2026-07-02 15:57)
- [ ] 4.1.4 Add branch-opt unit tests
- [ ] 4.2.1 Implement TransferOptPass
- [ ] 4.2.2 Add reverse transfer removal
- [ ] 4.2.3 Add transfer-opt unit tests

### Phase 5: Advanced Passes (O3)
- [ ] 5.1.1 Implement ZPPromotionPass
- [ ] 5.1.2 Add frequency counting
- [ ] 5.1.3 Add hotness ranking
- [ ] 5.1.4 Add reference transformation
- [ ] 5.1.5 Add ZP promotion unit tests
- [ ] 5.2.1 Implement Strength6502Pass
- [ ] 5.2.2 Add multiply patterns
- [ ] 5.2.3 Add divide/modulo patterns
- [ ] 5.2.4 Add strength-6502 unit tests
- [ ] 5.3.1 Implement StackOptPass
- [ ] 5.3.2 Add redundant pair detection
- [ ] 5.3.3 Add stack-opt unit tests

### Phase 6: Size Passes (Os/Oz)
- [ ] 6.1.1 Implement SizeOptPass
- [ ] 6.1.2 Add tail call optimization
- [ ] 6.1.3 Add sequence factoring (Oz)
- [ ] 6.1.4 Add size-opt unit tests

### Phase 7: Integration & Testing
- [ ] 7.1.1 Create integration test suite
- [ ] 7.1.2 Test pass ordering
- [ ] 7.1.3 Test fixed-point iteration
- [ ] 7.1.4 Test level configurations
- [ ] 7.2.1 Wire optimizer into pipeline
- [ ] 7.2.2 Add E2E compilation tests
- [ ] 7.2.3 Add correctness verification
- [ ] 7.2.4 Final verification

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/compiler-v2/asm-il-optimizer/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test asm-il

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Dependencies

```
Phase 1 (Infrastructure)
    ↓
Phase 2 (Analysis)
    ↓
Phase 3 (Core O1)
    ↓
Phase 4 (Standard O2)
    ↓
Phase 5 (Advanced O3)
    ↓
Phase 6 (Size Os/Oz)
    ↓
Phase 7 (Integration)
```

---

## Success Criteria

**ASM-IL Optimizer is complete when**:

1. ✅ All 8 optimization passes implemented
2. ✅ All optimization levels (O0-Oz) working
3. ✅ All tests passing (~130+ tests)
4. ✅ Integrated into compilation pipeline
5. ✅ Documentation complete
6. ✅ Measurable code quality improvement

---

## Performance Targets

| Level | Code Size Reduction | Cycle Reduction |
|-------|--------------------|-----------------| 
| O1 | 10-15% | 10-20% |
| O2 | 20-30% | 25-35% |
| O3 | 30-40% | 40-50% |
| Os | 35-45% | 20-30% |
| Oz | 40-50% | 15-25% |