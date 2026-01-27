# Phase 4: IL Peephole - Task Checklist

> **Document**: 99-phase-tasks.md  
> **Phase**: 4 - IL Peephole  
> **Goal**: IL-level pattern optimization for -O2  
> **Milestone**: -O2 produces smaller code than -O1

---

## Phase Overview

| Metric | Target |
|--------|--------|
| Sessions | 5-7 |
| Total Tests | ~150 |
| Files Created | ~10 |
| Est. Total Lines | ~1500 |

---

## Session 4.1: Pattern Framework Foundation

**Focus**: Base pattern interface, matching engine, test utilities

### Tasks

| # | Task | File(s) | Tests | Status |
|---|------|---------|-------|--------|
| 4.1.1 | Create Pattern interface and MatchResult type | `patterns/pattern.ts` | 5 | [ ] |
| 4.1.2 | Create PatternContext interface | `patterns/pattern.ts` | 3 | [ ] |
| 4.1.3 | Create OptimizationStats tracking | `patterns/pattern.ts` | 5 | [ ] |
| 4.1.4 | Implement BasePattern abstract class | `patterns/pattern.ts` | 8 | [ ] |
| 4.1.5 | Create PeepholeEngine class | `patterns/engine.ts` | 10 | [ ] |
| 4.1.6 | Implement fixed-point iteration | `patterns/engine.ts` | 5 | [ ] |
| 4.1.7 | Create PatternTestUtils | `patterns/test-utils.ts` | 5 | [ ] |

**Session Tests**: ~41  
**Verify**: `./compiler-test optimizer/patterns`

---

## Session 4.2: Pattern Registry & ILPattern Base

**Focus**: Registry system, IL-specific pattern utilities

### Tasks

| # | Task | File(s) | Tests | Status |
|---|------|---------|-------|--------|
| 4.2.1 | Create PatternCategory enum | `patterns/registry.ts` | 2 | [ ] |
| 4.2.2 | Create PatternConfig interface | `patterns/registry.ts` | 2 | [ ] |
| 4.2.3 | Implement PatternRegistry class | `patterns/registry.ts` | 12 | [ ] |
| 4.2.4 | Add enable/disable by category | `patterns/registry.ts` | 4 | [ ] |
| 4.2.5 | Add priority management | `patterns/registry.ts` | 4 | [ ] |
| 4.2.6 | Create OptimizationLevel presets | `patterns/registry.ts` | 5 | [ ] |
| 4.2.7 | Create ILPattern base class | `patterns/il-pattern.ts` | 8 | [ ] |
| 4.2.8 | Add IL-specific helper methods | `patterns/il-pattern.ts` | 6 | [ ] |

**Session Tests**: ~43  
**Verify**: `./compiler-test optimizer/patterns optimizer/registry`

---

## Session 4.3: Load-Store Patterns

**Focus**: IL-level memory operation patterns

### Tasks

| # | Task | File(s) | Tests | Status |
|---|------|---------|-------|--------|
| 4.3.1 | Create MemoryLocation interface | `patterns/load-store.ts` | 3 | [ ] |
| 4.3.2 | Implement StoreLoadEliminationPattern | `patterns/load-store.ts` | 8 | [ ] |
| 4.3.3 | Implement LoadLoadEliminationPattern | `patterns/load-store.ts` | 6 | [ ] |
| 4.3.4 | Implement StoreForwardingPattern | `patterns/load-store.ts` | 8 | [ ] |
| 4.3.5 | Add mayAlias helper | `patterns/load-store.ts` | 5 | [ ] |
| 4.3.6 | Implement DeadStorePattern (with liveness) | `patterns/load-store.ts` | 6 | [ ] |
| 4.3.7 | Integration test: chained store-load | `__tests__/` | 4 | [ ] |

**Session Tests**: ~40  
**Verify**: `./compiler-test optimizer/patterns/load-store`

---

## Session 4.4: Arithmetic Identity Patterns

**Focus**: Trivial arithmetic simplifications

### Tasks

| # | Task | File(s) | Tests | Status |
|---|------|---------|-------|--------|
| 4.4.1 | Implement AddZeroPattern | `patterns/arithmetic.ts` | 4 | [ ] |
| 4.4.2 | Implement SubtractZeroPattern | `patterns/arithmetic.ts` | 4 | [ ] |
| 4.4.3 | Implement MultiplyOnePattern | `patterns/arithmetic.ts` | 4 | [ ] |
| 4.4.4 | Implement DivideOnePattern | `patterns/arithmetic.ts` | 4 | [ ] |
| 4.4.5 | Implement MultiplyZeroPattern | `patterns/arithmetic.ts` | 4 | [ ] |
| 4.4.6 | Implement AndZeroPattern | `patterns/arithmetic.ts` | 3 | [ ] |
| 4.4.7 | Implement SubtractSelfPattern | `patterns/arithmetic.ts` | 3 | [ ] |
| 4.4.8 | Implement DivideSelfPattern | `patterns/arithmetic.ts` | 3 | [ ] |
| 4.4.9 | Implement XorSelfPattern | `patterns/arithmetic.ts` | 3 | [ ] |
| 4.4.10 | Implement OrSelfPattern | `patterns/arithmetic.ts` | 3 | [ ] |
| 4.4.11 | Implement AndSelfPattern | `patterns/arithmetic.ts` | 3 | [ ] |
| 4.4.12 | Implement OrZeroPattern | `patterns/arithmetic.ts` | 3 | [ ] |
| 4.4.13 | Implement XorZeroPattern | `patterns/arithmetic.ts` | 3 | [ ] |

**Session Tests**: ~44  
**Verify**: `./compiler-test optimizer/patterns/arithmetic`

---

## Session 4.5: Strength Reduction Patterns

**Focus**: Expensive operations → cheaper equivalents

### Tasks

| # | Task | File(s) | Tests | Status |
|---|------|---------|-------|--------|
| 4.5.1 | Create isPowerOf2 and log2 utilities | `patterns/strength.ts` | 6 | [ ] |
| 4.5.2 | Implement MultiplyPowerOfTwoPattern | `patterns/strength.ts` | 8 | [ ] |
| 4.5.3 | Implement DividePowerOfTwoPattern | `patterns/strength.ts` | 8 | [ ] |
| 4.5.4 | Implement ModuloPowerOfTwoPattern | `patterns/strength.ts` | 8 | [ ] |
| 4.5.5 | Create Decomposition system | `patterns/strength.ts` | 3 | [ ] |
| 4.5.6 | Implement MultiplySmallConstantPattern | `patterns/strength.ts` | 10 | [ ] |
| 4.5.7 | Test shift overflow protection | `__tests__/` | 4 | [ ] |

**Session Tests**: ~47  
**Verify**: `./compiler-test optimizer/patterns/strength`

---

## Session 4.6: PeepholeOptimizer Pass Integration

**Focus**: Integrate patterns into optimizer pass

### Tasks

| # | Task | File(s) | Tests | Status |
|---|------|---------|-------|--------|
| 4.6.1 | Create PeepholeOptimizer pass class | `passes/peephole.ts` | 5 | [ ] |
| 4.6.2 | Integrate with PassManager | `passes/peephole.ts` | 3 | [ ] |
| 4.6.3 | Create createDefaultILRegistry | `patterns/registry.ts` | 4 | [ ] |
| 4.6.4 | Add optimization level handling | `passes/peephole.ts` | 5 | [ ] |
| 4.6.5 | Add metrics/statistics reporting | `passes/peephole.ts` | 4 | [ ] |
| 4.6.6 | Integration: O1 → O2 comparison | `__tests__/` | 5 | [ ] |
| 4.6.7 | Integration: full program optimization | `__tests__/` | 5 | [ ] |

**Session Tests**: ~31  
**Verify**: `./compiler-test optimizer/peephole`

---

## Session 4.7: Pattern Combinators & Polish

**Focus**: SequencePattern, PredicatePattern, final polish

### Tasks

| # | Task | File(s) | Tests | Status |
|---|------|---------|-------|--------|
| 4.7.1 | Implement SequencePattern combinator | `patterns/combinators.ts` | 8 | [ ] |
| 4.7.2 | Implement PredicatePattern combinator | `patterns/combinators.ts` | 6 | [ ] |
| 4.7.3 | Implement RegistryBuilder fluent API | `patterns/registry.ts` | 5 | [ ] |
| 4.7.4 | Add generateReport to registry | `patterns/registry.ts` | 3 | [ ] |
| 4.7.5 | Integration: complex pattern sequences | `__tests__/` | 5 | [ ] |
| 4.7.6 | E2E: real Blend program optimization | `__tests__/e2e/` | 4 | [ ] |
| 4.7.7 | Documentation and exports | `index.ts` | 0 | [ ] |

**Session Tests**: ~31  
**Verify**: `./compiler-test optimizer`

---

## Test Summary by Category

| Category | Tests | Session(s) |
|----------|-------|------------|
| Pattern Framework | 41 | 4.1 |
| Registry & ILPattern | 43 | 4.2 |
| Load-Store Patterns | 40 | 4.3 |
| Arithmetic Identity | 44 | 4.4 |
| Strength Reduction | 47 | 4.5 |
| Pass Integration | 31 | 4.6 |
| Combinators & Polish | 31 | 4.7 |
| **Total** | **~277** | 7 sessions |

---

## File Structure

```
packages/compiler/src/il/optimizer/
├── index.ts                    # Module exports
├── passes/
│   └── peephole.ts            # PeepholeOptimizer pass
└── patterns/
    ├── index.ts               # Pattern exports
    ├── pattern.ts             # Base interfaces, BasePattern
    ├── engine.ts              # PeepholeEngine
    ├── registry.ts            # PatternRegistry, presets
    ├── il-pattern.ts          # ILPattern base class
    ├── load-store.ts          # Memory patterns
    ├── arithmetic.ts          # Identity patterns
    ├── strength.ts            # Strength reduction
    ├── combinators.ts         # Sequence, Predicate patterns
    └── test-utils.ts          # PatternTestUtils
```

---

## Dependencies

### From Phase 1-3

| Dependency | Used By |
|------------|---------|
| PassManager | PeepholeOptimizer registration |
| TransformPass | PeepholeOptimizer base class |
| UseDefAnalysis | Store forwarding safety |
| LivenessAnalysis | Dead store elimination |
| ConstantFolding | Constant evaluation |

---

## Success Criteria

Phase 4 is complete when:

- [ ] Pattern framework fully operational
- [ ] All 5 pattern categories implemented
- [ ] Registry supports O0-O3 presets
- [ ] PeepholeOptimizer integrates with PassManager
- [ ] -O2 produces measurably smaller code than -O1
- [ ] ~277 tests passing
- [ ] Full documentation complete

---

## Phase Completion Checklist

### Sessions

- [ ] Session 4.1: Pattern Framework Foundation (~41 tests)
- [ ] Session 4.2: Pattern Registry & ILPattern Base (~43 tests)
- [ ] Session 4.3: Load-Store Patterns (~40 tests)
- [ ] Session 4.4: Arithmetic Identity Patterns (~44 tests)
- [ ] Session 4.5: Strength Reduction Patterns (~47 tests)
- [ ] Session 4.6: PeepholeOptimizer Pass Integration (~31 tests)
- [ ] Session 4.7: Pattern Combinators & Polish (~31 tests)

### Verification

```bash
# After each session
./compiler-test optimizer

# Final phase verification
./compiler-test optimizer il
```

---

## Notes

1. **Pattern priority matters** - Higher priority patterns tried first
2. **Fixed-point iteration** - Run until no more changes
3. **Load-store at IL level** - Prepares for ASM-level patterns in Phase 5
4. **Strength reduction is critical** - 6502 has no MUL/DIV
5. **Test with real programs** - Ensure optimizations are safe

---

**Previous**: [05-strength-reduce.md](05-strength-reduce.md)  
**Phase Index**: [00-phase-index.md](00-phase-index.md)  
**Next Phase**: [Phase 5: ASM Peephole](../phase-5-asm-peephole/00-phase-index.md)