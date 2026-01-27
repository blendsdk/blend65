# Phase 6: 6502 Specific - Task Checklist

> **Phase**: 6 of 7  
> **Total Sessions**: ~7-8  
> **Total Tests**: ~150  
> **Goal**: 6502-specific optimizations for competitive code

---

## Session Overview

| Session | Focus | Tasks | Tests |
|---------|-------|-------|-------|
| 6.1 | ZP Promotion Foundation | 5 | ~25 |
| 6.2 | ZP Promotion Complete | 5 | ~20 |
| 6.3 | Indexed Addressing | 5 | ~20 |
| 6.4 | Flag Optimization | 5 | ~25 |
| 6.5 | Strength Reduction | 5 | ~25 |
| 6.6 | Stack Optimization | 5 | ~20 |
| 6.7 | Integration & C64 Patterns | 5 | ~15 |

---

## Session 6.1: Zero-Page Promotion Foundation

**Reference**: [01-zp-promotion.md](01-zp-promotion.md)

**Goal**: Implement variable access analysis and hotness scoring.

### Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 6.1.1 | Create `VariableAccessStats` interface and collector | `zp-promotion.ts` | [ ] |
| 6.1.2 | Implement hotness calculation with loop weighting | `zp-promotion.ts` | [ ] |
| 6.1.3 | Create C64 ZP memory map constants | `zp-map.ts` | [ ] |
| 6.1.4 | Implement variable ranking by hotness | `zp-promotion.ts` | [ ] |
| 6.1.5 | Add unit tests for access statistics | `zp-promotion.test.ts` | [ ] |

**Tests to Implement** (~25):
- Variable load counting (5 tests)
- Variable store counting (5 tests)
- Loop access weighting (5 tests)
- Hotness calculation (5 tests)
- Indirect usage detection (5 tests)

**Verify**: `./compiler-test optimizer`

---

## Session 6.2: Zero-Page Promotion Complete

**Reference**: [01-zp-promotion.md](01-zp-promotion.md)

**Goal**: Complete ZP allocation and reference rewriting.

### Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 6.2.1 | Implement ZP slot allocation | `zp-promotion.ts` | [ ] |
| 6.2.2 | Implement reference rewriting (absolute → ZP) | `zp-promotion.ts` | [ ] |
| 6.2.3 | Handle addressing mode conversion | `zp-promotion.ts` | [ ] |
| 6.2.4 | Integrate with symbol table | `zp-promotion.ts` | [ ] |
| 6.2.5 | Add integration tests | `zp-promotion.test.ts` | [ ] |

**Tests to Implement** (~20):
- ZP allocation algorithm (5 tests)
- Multi-byte variable allocation (3 tests)
- Absolute → ZP conversion (5 tests)
- Indexed mode conversion (4 tests)
- Symbol table integration (3 tests)

**Verify**: `./compiler-test optimizer`

---

## Session 6.3: Indexed Addressing Optimization

**Reference**: [02-indexed-addr.md](02-indexed-addr.md)

**Goal**: Optimize index register usage and addressing modes.

### Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 6.3.1 | Create `IndexUsageInfo` interface and analyzer | `indexed-addr.ts` | [ ] |
| 6.3.2 | Implement absolute → ZP indexed conversion | `indexed-addr.ts` | [ ] |
| 6.3.3 | Implement index register transfer elimination | `indexed-addr.ts` | [ ] |
| 6.3.4 | Handle X/Y register constraints (ZP,Y limitations) | `indexed-addr.ts` | [ ] |
| 6.3.5 | Add tests for indexed addressing | `indexed-addr.test.ts` | [ ] |

**Tests to Implement** (~20):
- Index usage analysis (5 tests)
- Absolute,X → ZP,X conversion (4 tests)
- ZP,Y constraint handling (4 tests)
- Transfer elimination (4 tests)
- Index selection optimization (3 tests)

**Verify**: `./compiler-test optimizer`

---

## Session 6.4: Flag Optimization

**Reference**: [03-flag-opt.md](03-flag-opt.md)

**Goal**: Track CPU flags and eliminate redundant flag operations.

### Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 6.4.1 | Create `FlagStates` interface and updater | `flag-opt.ts` | [ ] |
| 6.4.2 | Implement redundant `CMP #0` removal | `flag-opt.ts` | [ ] |
| 6.4.3 | Implement redundant `CLC`/`SEC` removal | `flag-opt.ts` | [ ] |
| 6.4.4 | Implement branch optimization based on flags | `flag-opt.ts` | [ ] |
| 6.4.5 | Add comprehensive flag optimization tests | `flag-opt.test.ts` | [ ] |

**Tests to Implement** (~25):
- Flag state tracking (6 tests)
- CMP #0 removal after LDA/AND/etc. (6 tests)
- Redundant CLC removal (4 tests)
- Redundant SEC removal (4 tests)
- Branch flag awareness (5 tests)

**Verify**: `./compiler-test optimizer`

---

## Session 6.5: 6502 Strength Reduction

**Reference**: [04-6502-strength.md](04-6502-strength.md)

**Goal**: Replace expensive multiply/divide with shift sequences.

### Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 6.5.1 | Implement power-of-2 multiply (ASL chains) | `6502-strength.ts` | [ ] |
| 6.5.2 | Implement shift+add decomposition for small multipliers | `6502-strength.ts` | [ ] |
| 6.5.3 | Implement power-of-2 divide (LSR chains) | `6502-strength.ts` | [ ] |
| 6.5.4 | Implement modulo optimization (AND masks) | `6502-strength.ts` | [ ] |
| 6.5.5 | Add strength reduction tests | `6502-strength.test.ts` | [ ] |

**Tests to Implement** (~25):
- Multiply by power of 2 (5 tests)
- Multiply by 3, 5, 7, 9, 10 (5 tests)
- Division by power of 2 (5 tests)
- Modulo by power of 2 (5 tests)
- Cost calculation and fallback (5 tests)

**Verify**: `./compiler-test optimizer`

---

## Session 6.6: Stack Optimization

**Reference**: [05-stack-opt.md](05-stack-opt.md)

**Goal**: Eliminate unnecessary PHA/PLA pairs.

### Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 6.6.1 | Create stack state tracking | `stack-opt.ts` | [ ] |
| 6.6.2 | Implement dead push elimination | `stack-opt.ts` | [ ] |
| 6.6.3 | Implement push-pop pair elimination | `stack-opt.ts` | [ ] |
| 6.6.4 | Implement unnecessary save removal | `stack-opt.ts` | [ ] |
| 6.6.5 | Add stack optimization tests | `stack-opt.test.ts` | [ ] |

**Tests to Implement** (~20):
- Stack state tracking (4 tests)
- Dead push removal (5 tests)
- Push-pop pair elimination (5 tests)
- Unnecessary save removal (4 tests)
- Interrupt handler preservation (2 tests)

**Verify**: `./compiler-test optimizer`

---

## Session 6.7: Integration & C64 Patterns

**Reference**: All Phase 6 documents

**Goal**: Integration testing and C64-specific patterns.

### Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 6.7.1 | Create Phase 6 pass registration | `6502/index.ts` | [ ] |
| 6.7.2 | Implement screen row (×40) optimization | `c64-patterns.ts` | [ ] |
| 6.7.3 | Implement sprite block (×64) optimization | `c64-patterns.ts` | [ ] |
| 6.7.4 | Add end-to-end tests for 6502 optimizations | `6502-e2e.test.ts` | [ ] |
| 6.7.5 | Add benchmarks for optimization impact | `6502-benchmark.test.ts` | [ ] |

**Tests to Implement** (~15):
- Pass registration and ordering (3 tests)
- Screen row calculation (4 tests)
- Sprite block calculation (3 tests)
- End-to-end optimization (5 tests)

**Verify**: `./compiler-test optimizer`

---

## Directory Structure

```
packages/compiler/src/asm-il/optimizer/passes/6502/
├── index.ts                  # Pass exports and registration
├── zp-promotion.ts           # Zero-page promotion
├── zp-map.ts                 # C64 ZP memory map
├── indexed-addr.ts           # Indexed addressing optimization
├── flag-opt.ts               # Flag optimization
├── 6502-strength.ts          # Strength reduction
├── stack-opt.ts              # Stack optimization
├── c64-patterns.ts           # C64-specific patterns
└── __tests__/
    ├── zp-promotion.test.ts
    ├── indexed-addr.test.ts
    ├── flag-opt.test.ts
    ├── 6502-strength.test.ts
    ├── stack-opt.test.ts
    ├── 6502-e2e.test.ts
    └── 6502-benchmark.test.ts
```

---

## Dependencies

### Required Before Phase 6

| Dependency | Phase | Status |
|------------|-------|--------|
| PassManager | 1 | Required |
| ASM peephole infrastructure | 5 | Required |
| Use-def analysis | 2 | Required |
| Liveness analysis | 2 | Required |
| Loop analysis | 2 | Recommended |

### Provides for Phase 7

- ZP allocation for register allocator
- Flag state tracking for advanced analysis
- Strength reduction patterns

---

## Complete Task Checklist

### Session 6.1: ZP Promotion Foundation
- [ ] 6.1.1 Create `VariableAccessStats` interface and collector
- [ ] 6.1.2 Implement hotness calculation with loop weighting
- [ ] 6.1.3 Create C64 ZP memory map constants
- [ ] 6.1.4 Implement variable ranking by hotness
- [ ] 6.1.5 Add unit tests for access statistics

### Session 6.2: ZP Promotion Complete
- [ ] 6.2.1 Implement ZP slot allocation
- [ ] 6.2.2 Implement reference rewriting (absolute → ZP)
- [ ] 6.2.3 Handle addressing mode conversion
- [ ] 6.2.4 Integrate with symbol table
- [ ] 6.2.5 Add integration tests

### Session 6.3: Indexed Addressing
- [ ] 6.3.1 Create `IndexUsageInfo` interface and analyzer
- [ ] 6.3.2 Implement absolute → ZP indexed conversion
- [ ] 6.3.3 Implement index register transfer elimination
- [ ] 6.3.4 Handle X/Y register constraints
- [ ] 6.3.5 Add tests for indexed addressing

### Session 6.4: Flag Optimization
- [ ] 6.4.1 Create `FlagStates` interface and updater
- [ ] 6.4.2 Implement redundant `CMP #0` removal
- [ ] 6.4.3 Implement redundant `CLC`/`SEC` removal
- [ ] 6.4.4 Implement branch optimization based on flags
- [ ] 6.4.5 Add comprehensive flag optimization tests

### Session 6.5: Strength Reduction
- [ ] 6.5.1 Implement power-of-2 multiply (ASL chains)
- [ ] 6.5.2 Implement shift+add decomposition
- [ ] 6.5.3 Implement power-of-2 divide (LSR chains)
- [ ] 6.5.4 Implement modulo optimization (AND masks)
- [ ] 6.5.5 Add strength reduction tests

### Session 6.6: Stack Optimization
- [ ] 6.6.1 Create stack state tracking
- [ ] 6.6.2 Implement dead push elimination
- [ ] 6.6.3 Implement push-pop pair elimination
- [ ] 6.6.4 Implement unnecessary save removal
- [ ] 6.6.5 Add stack optimization tests

### Session 6.7: Integration
- [ ] 6.7.1 Create Phase 6 pass registration
- [ ] 6.7.2 Implement screen row (×40) optimization
- [ ] 6.7.3 Implement sprite block (×64) optimization
- [ ] 6.7.4 Add end-to-end tests
- [ ] 6.7.5 Add benchmarks

---

## Success Criteria

### Phase 6 Complete When:

- [ ] All 35 tasks completed
- [ ] ~150 tests implemented and passing
- [ ] ZP promotion working for hot variables
- [ ] Indexed addressing optimized
- [ ] Redundant flag operations removed
- [ ] Multiply/divide strength-reduced
- [ ] Unnecessary stack operations eliminated
- [ ] C64-specific patterns optimized
- [ ] Code competitive with hand-written assembly

---

## Session Protocol

### Starting Each Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase 6, Session 6.X per plans/optimizer-series/phase-6-6502-specific/99-phase-tasks.md"
```

### Ending Each Session

```bash
# 1. Run tests
./compiler-test optimizer

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Update this checklist with completed items

# 4. Call attempt_completion

# 5. Compact conversation
/compact
```

---

**Previous**: [Stack Optimization](05-stack-opt.md)  
**Parent**: [Phase 6 Index](00-phase-index.md)  
**Next Phase**: [Phase 7: Advanced](../phase-7-advanced/00-phase-index.md)