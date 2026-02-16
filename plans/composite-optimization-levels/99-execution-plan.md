# Execution Plan: Composite Optimization Levels

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-16 15:03
> **Progress**: 14/14 tasks (100%)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Config Types & Helpers | 1 | 20 min |
| 2 | IL Optimizer Expansion | 1 | 20 min |
| 3 | AsmIL Optimizer Expansion | 1 | 30 min |
| 4 | CLI & Compiler Pipeline | 1 | 20 min |
| 5 | Diagnostic Tool & E2E Tests | 1 | 20 min |

**Total: 5 sessions, ~2 hours**

---

## Phase 1: Config Types & Helpers

### Session 1.1: Expand OptimizationLevelId + Add Helpers + Tests

**Reference**: [03-config-types.md](03-config-types.md)

**Objective**: Expand the type system and add normalization/validation helpers.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Expand `OptimizationLevelId` type to 10 levels | `packages/compiler/src/config/types.ts` |
| 1.1.2 | Add `ALL_OPTIMIZATION_LEVELS`, `normalizeOptimizationLevel()`, `isSizeLevel()`, `isMinSizeLevel()`, `getBaseLevel()` | `packages/compiler/src/config/types.ts` |
| 1.1.3 | Export new functions from config index | `packages/compiler/src/config/index.ts` |
| 1.1.4 | Write unit tests for all config helpers | `packages/compiler/src/__tests__/config/optimization-levels.test.ts` |

**Deliverables**:
- [ ] Type expanded to 10 levels
- [ ] All helper functions implemented with JSDoc
- [ ] Tests for normalization, aliases, invalid combos, helpers
- [ ] All existing tests still pass

**Verify**: `./compiler-test config`

---

## Phase 2: IL Optimizer Expansion

### Session 2.1: Expand IL Pass Maps + Tests

**Reference**: [04-il-optimizer.md](04-il-optimizer.md)

**Objective**: Add 4 new entries to IL function and program pass maps.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Expand `OptimizationLevel` type in IL optimizer | `packages/compiler/src/optimizer/options.ts` |
| 2.1.2 | Add O1s, O1z, O3s, O3z to `LEVEL_PASSES` map | `packages/compiler/src/optimizer/options.ts` |
| 2.1.3 | Add O1s, O1z, O3s, O3z to `PROGRAM_LEVEL_PASSES` map | `packages/compiler/src/optimizer/options.ts` |
| 2.1.4 | Update `shouldIterate()` and `isSizeOptimization()` | `packages/compiler/src/optimizer/options.ts` |
| 2.1.5 | Write unit tests for new level pass configurations | `packages/compiler/src/__tests__/optimizer/options.test.ts` |

**Deliverables**:
- [ ] IL optimizer type matches config type
- [ ] 4 new pass map entries with correct passes
- [ ] Helper functions updated for new levels
- [ ] Tests pass for all 10 levels

**Verify**: `./compiler-test optimizer`

---

## Phase 3: AsmIL Optimizer Expansion

### Session 3.1: Expand AsmIL Enum + Defaults + Pass Factory + Tests

**Reference**: [05-asm-optimizer.md](05-asm-optimizer.md)

**Objective**: Add 4 new levels to AsmIL optimizer with correct pass selection.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Add 4 enum values to `OptimizationLevel` | `packages/compiler/src/codegen/asm-il/optimizer/options.ts` |
| 3.1.2 | Add 4 `DEFAULT_OPTIONS` entries | `packages/compiler/src/codegen/asm-il/optimizer/options.ts` |
| 3.1.3 | Update `getAllLevels()` to return 10 levels | `packages/compiler/src/codegen/asm-il/optimizer/options.ts` |
| 3.1.4 | Update pass factory for new levels | `packages/compiler/src/codegen/asm-il/optimizer/pass-factory.ts` |
| 3.1.5 | Update existing AsmIL tests for 10 levels | `packages/compiler/src/__tests__/codegen/asm-il/optimizer/` |

**Deliverables**:
- [ ] AsmIL enum has 10 values
- [ ] Pass factory creates correct passes for O1s, O1z, O3s, O3z
- [ ] Pass count tests updated
- [ ] Level config integration tests pass

**Verify**: `./compiler-test codegen`

---

## Phase 4: CLI & Compiler Pipeline

### Session 4.1: Update CLI + Compiler Level Resolution

**Reference**: [06-cli-diag.md](06-cli-diag.md)

**Objective**: CLI accepts new levels, compiler normalizes them correctly.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Update CLI choices and help text | `packages/cli/src/commands/build.ts` |
| 4.1.2 | Update `resolveOptimizationLevel()` to use `normalizeOptimizationLevel()` | `packages/cli/src/commands/build.ts` |
| 4.1.3 | Update compiler.ts level resolution | `packages/compiler/src/compiler.ts` |

**Deliverables**:
- [ ] CLI accepts all 10 level values
- [ ] Help text shows two-dimensional model
- [ ] Compiler normalizes aliases and rejects invalid combos
- [ ] All tests pass

**Verify**: `./compiler-test`

---

## Phase 5: Diagnostic Tool & E2E Tests

### Session 5.1: Update diag_app + E2E Pipeline Tests

**Reference**: [06-cli-diag.md](06-cli-diag.md), [07-testing-strategy.md](07-testing-strategy.md)

**Objective**: Diagnostic tool tests all 10 levels, E2E tests verify compilation.

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.1.1 | Update LEVELS array in diag_app.sh | `scripts/diag_app.sh` |
| 5.1.2 | Add E2E pipeline tests for new levels | `packages/compiler/src/__tests__/codegen/e2e/` or `__tests__/pipeline/` |

**Deliverables**:
- [ ] diag_app.sh tests all 10 levels
- [ ] E2E tests compile programs at O1s, O1z, O3s, O3z
- [ ] Full test suite passes

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Config Types & Helpers
- [x] 1.1.1 Expand OptimizationLevelId type ✅ (completed: 2026-02-16)
- [x] 1.1.2 Add normalization + helper functions ✅ (completed: 2026-02-16)
- [x] 1.1.3 Export from config index ✅ (completed: 2026-02-16)
- [x] 1.1.4 Write config type unit tests ✅ (completed: 2026-02-16)

### Phase 2: IL Optimizer Expansion
- [x] 2.1.1 Expand IL OptimizationLevel type ✅ (completed: 2026-02-16)
- [x] 2.1.2 Add function pass entries ✅ (completed: 2026-02-16)
- [x] 2.1.3 Add program pass entries ✅ (completed: 2026-02-16)
- [x] 2.1.4 Update shouldIterate/isSizeOptimization ✅ (completed: 2026-02-16)
- [x] 2.1.5 Write IL optimizer tests ✅ (completed: 2026-02-16)

### Phase 3: AsmIL Optimizer Expansion
- [x] 3.1.1 Add enum values ✅ (completed: 2026-02-16)
- [x] 3.1.2 Add default options ✅ (completed: 2026-02-16)
- [x] 3.1.3 Update getAllLevels ✅ (completed: 2026-02-16)
- [x] 3.1.4 Update pass factory ✅ (completed: 2026-02-16)
- [x] 3.1.5 Update AsmIL tests ✅ (completed: 2026-02-16)

### Phase 4: CLI & Compiler Pipeline
- [x] 4.1.1 Update CLI choices + help ✅ (completed: 2026-02-16)
- [x] 4.1.2 Update resolveOptimizationLevel ✅ (completed: 2026-02-16)
- [x] 4.1.3 Update compiler.ts ✅ (completed: 2026-02-16)

### Phase 5: Diagnostic Tool & E2E
- [x] 5.1.1 Update diag_app.sh ✅ (completed: 2026-02-16)
- [x] 5.1.2 Update existing tests for 10 levels ✅ (completed: 2026-02-16)

---

## Session Protocol

### Starting a Session

```bash
clear && scripts/agent.sh start
# Reference: "Implement Phase X per plans/composite-optimization-levels/99-execution-plan.md"
```

### Ending a Session

```bash
./compiler-test
clear && scripts/agent.sh finished
# Call attempt_completion
# User runs /compact
```

---

## Dependencies

```
Phase 1 (config types)
    ↓
Phase 2 (IL optimizer)  ←── depends on Phase 1 type
    ↓
Phase 3 (AsmIL optimizer)  ←── independent of Phase 2
    ↓
Phase 4 (CLI + compiler)  ←── depends on Phase 1 helpers
    ↓
Phase 5 (diag + E2E)  ←── depends on all above
```

## Success Criteria

**Feature is complete when**:

1. ✅ All 10 levels accepted by CLI
2. ✅ IL optimizer correctly configured for all 10 levels
3. ✅ AsmIL optimizer correctly configured for all 10 levels
4. ✅ Invalid combos rejected with clear errors
5. ✅ diag_app.sh tests all 10 levels
6. ✅ All tests passing
7. ✅ Documentation updated (CLI help)
