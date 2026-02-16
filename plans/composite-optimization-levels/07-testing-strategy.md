# Testing Strategy: Composite Optimization Levels

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests for all new types, helpers, and config entries
- Integration tests for pass selection at each new level
- E2E tests compiling real programs at all 10 levels

## Test Categories

### Unit Tests — Config Types

| Test | Description | Priority |
|------|-------------|----------|
| `normalizeOptimizationLevel('O1s')` | Returns 'O1s' | High |
| `normalizeOptimizationLevel('O2s')` | Returns 'Os' (alias) | High |
| `normalizeOptimizationLevel('O2z')` | Returns 'Oz' (alias) | High |
| `normalizeOptimizationLevel('O0s')` | Throws error | High |
| `normalizeOptimizationLevel('O0z')` | Throws error | High |
| `normalizeOptimizationLevel('O99')` | Throws error | Medium |
| `ALL_OPTIMIZATION_LEVELS` length | Equals 10 | High |
| `isSizeLevel()` for all 10 | Correct boolean per level | High |
| `isMinSizeLevel()` for all 10 | Correct boolean per level | High |
| `getBaseLevel()` for all 10 | Correct base per level | High |

### Unit Tests — IL Optimizer Options

| Test | Description | Priority |
|------|-------------|----------|
| `getPassesForLevel('O1s')` | Returns `['dce', 'constant-fold']` | High |
| `getPassesForLevel('O1z')` | Returns `['dce', 'constant-fold']` | High |
| `getPassesForLevel('O3s')` | Returns O3 passes minus loop-unroll | High |
| `getPassesForLevel('O3z')` | Returns O3 passes minus loop-unroll | High |
| `getProgramPassesForLevel('O1s')` | No function-inline, has dead-global-elim | High |
| `getProgramPassesForLevel('O3s')` | No function-inline, has dead-global-elim | High |
| `shouldIterate('O1z')` | Returns true | High |
| `shouldIterate('O3z')` | Returns true | High |
| `shouldIterate('O1s')` | Returns false | High |
| `shouldIterate('O3s')` | Returns false | High |
| `isSizeOptimization('O1s')` | Returns true | High |
| `isSizeOptimization('O3z')` | Returns true | High |

### Unit Tests — AsmIL Optimizer Options

| Test | Description | Priority |
|------|-------------|----------|
| `OptimizationLevel` enum | Has all 10 values | High |
| `DEFAULT_OPTIONS[O1s]` | zpSlots=[4], maxIter=1 | High |
| `DEFAULT_OPTIONS[O1z]` | zpSlots=[4], maxIter=5 | High |
| `DEFAULT_OPTIONS[O3s]` | zpSlots=[4], maxIter=1 | High |
| `DEFAULT_OPTIONS[O3z]` | zpSlots=[4], maxIter=5 | High |
| `getAllLevels()` | Returns 10 levels | High |

### Unit Tests — AsmIL Pass Factory

| Test | Description | Priority |
|------|-------------|----------|
| Pass count for O1s | 5 passes | High |
| Pass count for O1z | 5 passes | High |
| Pass count for O3s | 10 passes | High |
| Pass count for O3z | 10 passes | High |
| O1s includes SizeOpt | SizeOpt(false) present | High |
| O1z includes SizeOpt | SizeOpt(true/aggressive) present | High |
| O3s excludes Strength6502 | Not in pass list | High |
| O3s includes SizeOpt | SizeOpt(false) present | High |
| O1s includes ZPPromotion | Present | High |
| O1s excludes BranchOpt | Not in pass list (O1 base) | High |

### Integration Tests — AsmIL Level Config

| Test | Components | Description |
|------|------------|-------------|
| O1s full config | AsmILOptimizer | Correct passes, slots, iterations |
| O1z full config | AsmILOptimizer | Correct passes, slots, iterations=5 |
| O3s full config | AsmILOptimizer | 10 passes, no Strength6502, has SizeOpt |
| O3z full config | AsmILOptimizer | 10 passes, iterations=5, aggressive SizeOpt |
| Cross-level inclusion | AsmILOptimizer | O1 passes ⊂ O1s passes |

### E2E Tests — Pipeline

| Scenario | Steps | Expected |
|----------|-------|----------|
| Compile at O1s | Compile simple program | Success, assembly generated |
| Compile at O1z | Compile simple program | Success, assembly generated |
| Compile at O3s | Compile simple program | Success, assembly generated |
| Compile at O3z | Compile simple program | Success, assembly generated |
| All 10 levels | Compile at each level | All succeed |

### CLI Tests

| Test | Description | Priority |
|------|-------------|----------|
| `-O 1s` accepted | No error | High |
| `-O 3z` accepted | No error | High |
| `-O 0s` rejected | Error message shown | High |
| `-O 2s` normalized | Becomes Os internally | Medium |

## Verification Checklist

- [ ] All existing tests pass unchanged
- [ ] New config type tests pass
- [ ] New IL optimizer tests pass
- [ ] New AsmIL optimizer tests pass
- [ ] New E2E pipeline tests pass
- [ ] CLI tests updated and passing
- [ ] diag_app works with all 10 levels
