# Phase 1: Foundation - Task Checklist

> **Document**: 99-phase-tasks.md  
> **Phase**: 1 - Foundation  
> **Total Sessions**: ~4  
> **Total Tests**: ~120

---

## Session Breakdown

| Session | Focus | Tasks | Tests | Time |
|---------|-------|-------|-------|------|
| **1.1** | Pass classes | 1.1.1 - 1.1.3 | ~30 | ~2 hr |
| **1.2** | PassManager | 1.2.1 - 1.2.3 | ~40 | ~3 hr |
| **1.3** | Options | 1.3.1 - 1.3.2 | ~25 | ~1.5 hr |
| **1.4** | Pipeline + Integration | 1.4.1 - 1.4.3 | ~25 | ~2 hr |

---

## Task Checklist

### Session 1.1: Pass Base Classes

| Task | Description | Status |
|------|-------------|--------|
| 1.1.1 | Create `optimizer/pass.ts` with PassKind enum | [ ] |
| 1.1.2 | Implement Pass, AnalysisPass, TransformPass, UtilityPass | [ ] |
| 1.1.3 | Write tests for pass classes (~30 tests) | [ ] |

**Deliverables:**
- [ ] `packages/compiler/src/optimizer/pass.ts`
- [ ] `packages/compiler/src/__tests__/optimizer/pass.test.ts`

**Verify:** `clear && ./compiler-test optimizer`

---

### Session 1.2: Pass Manager

| Task | Description | Status |
|------|-------------|--------|
| 1.2.1 | Create `optimizer/pass-manager.ts` with registration | [ ] |
| 1.2.2 | Implement analysis caching and invalidation | [ ] |
| 1.2.3 | Implement dependency resolution and run() | [ ] |

**Deliverables:**
- [ ] `packages/compiler/src/optimizer/pass-manager.ts`
- [ ] `packages/compiler/src/__tests__/optimizer/pass-manager.test.ts`

**Verify:** `clear && ./compiler-test optimizer`

---

### Session 1.3: Options

| Task | Description | Status |
|------|-------------|--------|
| 1.3.1 | Create `optimizer/options.ts` with OptimizationLevel enum | [ ] |
| 1.3.2 | Implement helper functions (createDefaultOptions, etc.) | [ ] |

**Deliverables:**
- [ ] `packages/compiler/src/optimizer/options.ts`
- [ ] `packages/compiler/src/__tests__/optimizer/options.test.ts`

**Verify:** `clear && ./compiler-test optimizer`

---

### Session 1.4: Pipeline + Integration

| Task | Description | Status |
|------|-------------|--------|
| 1.4.1 | Create `optimizer/pipeline.ts` with PipelineBuilder | [ ] |
| 1.4.2 | Create `optimizer/index.ts` with exports | [ ] |
| 1.4.3 | Integration test with existing compiler | [ ] |

**Deliverables:**
- [ ] `packages/compiler/src/optimizer/pipeline.ts`
- [ ] `packages/compiler/src/optimizer/index.ts`
- [ ] `packages/compiler/src/__tests__/optimizer/pipeline.test.ts`
- [ ] `packages/compiler/src/__tests__/optimizer/integration.test.ts`

**Verify:** `clear && ./compiler-test optimizer`

---

## Files Created This Phase

```
packages/compiler/src/optimizer/
├── index.ts              # Main exports
├── pass.ts               # Pass base classes
├── pass-manager.ts       # Pass orchestration
├── options.ts            # Optimization options
└── pipeline.ts           # Pipeline builder

packages/compiler/src/__tests__/optimizer/
├── pass.test.ts
├── pass-manager.test.ts
├── options.test.ts
├── pipeline.test.ts
└── integration.test.ts
```

---

## Success Criteria

### Functionality

- [ ] All 120 tests passing
- [ ] PassManager registers and runs passes
- [ ] Dependencies resolved automatically
- [ ] Analysis caching works correctly
- [ ] Invalidation triggers re-analysis
- [ ] OptimizationLevel presets work

### Code Quality

- [ ] 100% test coverage
- [ ] JSDoc on all public APIs
- [ ] No TypeScript errors
- [ ] No ESLint warnings

### Integration

- [ ] Compiler builds successfully
- [ ] Existing tests still pass
- [ ] -O0 mode works (pass-through)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent mode
clear && scripts/agent.sh start

# 2. Reference this document
# "Implement Session 1.X per plans/optimizer-series/phase-1-foundation/99-phase-tasks.md"
```

### Ending a Session

```bash
# 1. Run tests
clear && ./compiler-test optimizer

# 2. If all pass, run full test
clear && ./compiler-test

# 3. End agent mode
clear && scripts/agent.sh finished

# 4. Compact
/compact
```

---

## Dependencies

### From IL Generator

- `ILModule` - Module container
- `ILFunction` - Function container
- `BasicBlock` - Block container
- `ILInstruction` - Instruction base

### New Types This Phase

- `Pass` - Base pass class
- `AnalysisPass<T>` - Analysis pass
- `TransformPass` - Transform pass
- `PassManager` - Pass orchestrator
- `OptimizationLevel` - Level enum
- `OptimizationOptions` - Options interface
- `PipelineBuilder` - Pipeline builder
- `PassRegistry` - Pass registry

---

## Next Phase

After completing Phase 1, proceed to:

**[Phase 2: Analysis](../phase-2-analysis/00-phase-index.md)**

Phase 2 implements Use-Def and Liveness analysis, which are required by the transformation passes in Phase 3.

---

**Parent**: [00-phase-index.md](00-phase-index.md)  
**Next Phase**: [Phase 2: Analysis](../phase-2-analysis/00-phase-index.md)