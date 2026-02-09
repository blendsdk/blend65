# Phase 2: Analysis Passes - Task Checklist

> **Document**: 99-phase-tasks.md  
> **Phase**: 2 - Analysis Passes  
> **Sessions**: ~3-4  
> **Goal**: Implement Use-Def and Liveness analysis  
> **Milestone**: Can query "is this value used?" and "is this value live?"

---

## Prerequisites

Before starting Phase 2, ensure Phase 1 is complete:

- [x] `Pass` base class implemented
- [x] `AnalysisPass` base class implemented
- [x] `PassManager` implemented with caching
- [x] `OptimizationOptions` implemented
- [x] `PipelineBuilder` implemented
- [x] Phase 1 tests passing

---

## Session 2.1: Use-Def Analysis

**Reference**: [01-use-def.md](01-use-def.md)

**Objective**: Implement Use-Definition analysis that tracks where values are defined and used.

### Tasks

| # | Task | Status |
|---|------|--------|
| 2.1.1 | Create `packages/compiler/src/optimizer/analysis/` directory | [ ] |
| 2.1.2 | Create `Definition` and `Use` interfaces | [ ] |
| 2.1.3 | Create `UseDefInfo` interface | [ ] |
| 2.1.4 | Implement `UseDefAnalysis` class skeleton | [ ] |
| 2.1.5 | Implement `analyzeBlock` method | [ ] |
| 2.1.6 | Implement `recordDefinition` method | [ ] |
| 2.1.7 | Implement `recordUse` method | [ ] |
| 2.1.8 | Implement `buildResult` method | [ ] |
| 2.1.9 | Handle function parameters as definitions | [ ] |
| 2.1.10 | Handle phi functions (if applicable) | [ ] |
| 2.1.11 | Create unit tests for definitions | [ ] |
| 2.1.12 | Create unit tests for uses | [ ] |
| 2.1.13 | Create unit tests for use counting | [ ] |
| 2.1.14 | Create unit tests for dead detection | [ ] |
| 2.1.15 | Export from `analysis/index.ts` | [ ] |

### Deliverables

- [ ] `use-def.ts` implemented (~200 lines)
- [ ] `analysis/index.ts` exports
- [ ] ~30 unit tests passing
- [ ] JSDoc complete

### Verification

```bash
./compiler-test optimizer/analysis
```

---

## Session 2.2: Liveness Analysis

**Reference**: [02-liveness.md](02-liveness.md)

**Objective**: Implement Liveness analysis using backward dataflow.

### Tasks

| # | Task | Status |
|---|------|--------|
| 2.2.1 | Create `BlockLiveness` interface | [ ] |
| 2.2.2 | Create `LivenessInfo` interface | [ ] |
| 2.2.3 | Implement `LivenessAnalysis` class skeleton | [ ] |
| 2.2.4 | Implement `computeDefUse` method | [ ] |
| 2.2.5 | Implement `getReversePostOrder` method | [ ] |
| 2.2.6 | Implement `computeLiveness` fixpoint iteration | [ ] |
| 2.2.7 | Implement `buildResult` with instruction-level queries | [ ] |
| 2.2.8 | Implement `isLiveAt` query | [ ] |
| 2.2.9 | Implement `isLiveAfter` query | [ ] |
| 2.2.10 | Implement `getLiveCount` query | [ ] |
| 2.2.11 | Create unit tests for single block liveness | [ ] |
| 2.2.12 | Create unit tests for multi-block liveness | [ ] |
| 2.2.13 | Create unit tests for branch liveness | [ ] |
| 2.2.14 | Create unit tests for loop liveness | [ ] |
| 2.2.15 | Create unit tests for instruction queries | [ ] |
| 2.2.16 | Export from `analysis/index.ts` | [ ] |

### Deliverables

- [ ] `liveness.ts` implemented (~250 lines)
- [ ] ~35 unit tests passing
- [ ] JSDoc complete

### Verification

```bash
./compiler-test optimizer/analysis
```

---

## Session 2.3: Integration and Testing

**Objective**: Integrate analyses with PassManager and create comprehensive tests.

### Tasks

| # | Task | Status |
|---|------|--------|
| 2.3.1 | Register `UseDefAnalysis` with PassManager | [ ] |
| 2.3.2 | Register `LivenessAnalysis` with PassManager | [ ] |
| 2.3.3 | Verify analysis caching works | [ ] |
| 2.3.4 | Create integration tests: Use-Def → Liveness | [ ] |
| 2.3.5 | Test analysis invalidation | [ ] |
| 2.3.6 | Create end-to-end test with real IL | [ ] |
| 2.3.7 | Performance benchmark (optional) | [ ] |
| 2.3.8 | Update `optimizer/index.ts` exports | [ ] |
| 2.3.9 | Verify all Phase 2 tests pass | [ ] |

### Deliverables

- [ ] PassManager integration complete
- [ ] ~15 integration tests passing
- [ ] ~80 total Phase 2 tests passing

### Verification

```bash
./compiler-test optimizer
```

---

## File Structure After Phase 2

```
packages/compiler/src/optimizer/
├── index.ts                    # Main exports (updated)
├── passes/                     # From Phase 1
│   ├── index.ts
│   ├── pass.ts
│   ├── analysis-pass.ts
│   └── transform-pass.ts
├── pipeline/                   # From Phase 1
│   ├── index.ts
│   ├── pass-manager.ts
│   ├── options.ts
│   └── pipeline-builder.ts
└── analysis/                   # NEW in Phase 2
    ├── index.ts                # Analysis exports
    ├── use-def.ts              # Use-Definition analysis
    └── liveness.ts             # Liveness analysis
```

---

## Test File Structure

```
packages/compiler/src/__tests__/optimizer/
├── passes/                     # From Phase 1
│   ├── pass.test.ts
│   └── pass-manager.test.ts
├── pipeline/                   # From Phase 1
│   ├── options.test.ts
│   └── pipeline-builder.test.ts
└── analysis/                   # NEW in Phase 2
    ├── use-def.test.ts         # ~30 tests
    ├── liveness.test.ts        # ~35 tests
    └── integration.test.ts     # ~15 tests
```

---

## Success Criteria

### Functional

- [ ] Use-def tracks all definitions correctly
- [ ] Use-def counts uses accurately
- [ ] Use-def identifies unused values
- [ ] Liveness computes LiveIn/LiveOut correctly
- [ ] Liveness handles loops (fixpoint converges)
- [ ] Liveness provides instruction-level queries
- [ ] Analyses integrate with PassManager caching

### Quality

- [ ] ~80 tests passing
- [ ] All tests are granular and meaningful
- [ ] JSDoc on all public/protected members
- [ ] Code follows project conventions

### Integration

- [ ] Analyses can be requested via PassManager
- [ ] Caching prevents recomputation
- [ ] Invalidation works when IL changes

---

## Common Issues and Solutions

### Issue: Phi functions break Use-Def

**Solution**: Handle phi functions specially - uses come from predecessor blocks.

### Issue: Liveness doesn't converge

**Solution**: Ensure reverse post-order traversal and proper set operations.

### Issue: Analysis not cached

**Solution**: Verify `static readonly passName` is unique and matches registration.

### Issue: Instruction-level liveness is wrong

**Solution**: Process instructions backward from block exit, updating live set.

---

## Dependencies for Phase 3

Phase 3 (O1 Transforms) will use:

| Phase 3 Pass | Uses Analysis |
|--------------|---------------|
| DCE | Use-Def (`isUnused`) |
| Constant Prop | Use-Def (`getUses`) |
| Copy Prop | Use-Def (`getUses`) |
| Dead Store Elim | Liveness (`isLiveAfter`) |

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase 2, Session 2.X per plans/optimizer-series/phase-2-analysis/99-phase-tasks.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test optimizer

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Progress Tracking

| Session | Status | Tests | Notes |
|---------|--------|-------|-------|
| 2.1 Use-Def | [ ] Not Started | 0/30 | |
| 2.2 Liveness | [ ] Not Started | 0/35 | |
| 2.3 Integration | [ ] Not Started | 0/15 | |
| **Total** | **0%** | **0/80** | |

---

**Parent**: [Phase 2 Index](00-phase-index.md)  
**Previous**: [Liveness Analysis](02-liveness.md)  
**Next Phase**: [Phase 3: O1 Transforms](../phase-3-o1-transforms/00-phase-index.md)