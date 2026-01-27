# Phase 1: Foundation - Phase Index

> **Phase**: 1 of 7  
> **Status**: Not Started  
> **Sessions**: ~4-6  
> **Goal**: Establish pass manager infrastructure  
> **Milestone**: PassManager can register and execute passes

---

## Phase Overview

Phase 1 establishes the **foundation** for the entire optimizer. We create a modular Pass Manager architecture (inspired by LLVM) that allows optimization passes to be:

- Added/removed independently
- Executed in dependency order
- Filtered by optimization level
- Analyzed for statistics

**After this phase**: The compiler has an optimizer infrastructure but no actual optimizations yet (-O0 pass-through).

---

## Directory Structure

```
packages/compiler/src/optimizer/
├── index.ts                    # Main exports
├── pass.ts                     # Pass base classes
├── pass-manager.ts             # Pass orchestration
├── options.ts                  # Optimization options
├── statistics.ts               # Statistics tracking
└── pipeline.ts                 # Pipeline builder
```

---

## Documents in This Phase

| Doc | Name | Focus | Est. Lines |
|-----|------|-------|------------|
| **01** | [Pass Classes](01-pass-classes.md) | Pass, AnalysisPass, TransformPass | ~300 |
| **02** | [Pass Manager](02-pass-manager.md) | PassManager implementation | ~300 |
| **03** | [Options](03-options.md) | OptimizationOptions, levels | ~250 |
| **04** | [Pipeline](04-pipeline.md) | Pipeline builder, presets | ~250 |
| **99** | [Tasks](99-phase-tasks.md) | Task checklist & sessions | ~150 |

---

## Key Concepts

### Pass Hierarchy

```
Pass (abstract)
├── AnalysisPass<T>    - Read-only, returns analysis result
└── TransformPass      - Modifies IL, returns boolean (changed?)
```

### Pass Manager Responsibilities

1. **Registration** - Store passes by name
2. **Dependency Resolution** - Run prerequisites first
3. **Analysis Caching** - Cache analysis results until invalidated
4. **Level Filtering** - Only run passes enabled for current -O level
5. **Statistics** - Track what each pass did

### Optimization Levels

| Level | Value | Description |
|-------|-------|-------------|
| O0 | 0 | No optimization (pass-through) |
| O1 | 1 | Basic (DCE, const fold/prop) |
| O2 | 2 | Standard (O1 + peephole) |
| O3 | 3 | Aggressive (O2 + loops) |
| Os | 10 | Size optimization |
| Oz | 11 | Minimum size |

---

## Dependencies

### From Existing Codebase

- `ILModule`, `ILFunction`, `BasicBlock` from IL generator
- `ILInstruction`, `ILOpcode` from IL types
- Existing optimizer stub (if any)

### External Dependencies

None - pure TypeScript implementation.

---

## Success Criteria

- [ ] Pass base classes defined with JSDoc
- [ ] PassManager can register passes
- [ ] PassManager resolves dependencies automatically
- [ ] Analysis caching works correctly
- [ ] OptimizationLevel enum with all levels
- [ ] Pipeline builder creates level-specific pipelines
- [ ] ~100 tests passing
- [ ] Integration with existing compiler (no-op mode)

---

## Integration Points

### How Optimizer Fits in Compiler

```
Blend Source
    ↓
Lexer → Parser → AST → Semantic Analyzer
    ↓
IL Generator (creates ILModule)
    ↓
🔥 OPTIMIZER (this phase creates infrastructure) 🔥
    ↓
Code Generator (ACME emitter)
    ↓
.asm output
```

### API Usage

```typescript
// Create optimizer with options
const optimizer = new Optimizer({
  level: OptimizationLevel.O2,
  verbose: true,
});

// Optimize IL module
const optimized = optimizer.optimize(module);

// Get statistics
const stats = optimized.getStatistics();
```

---

## Session Plan

| Session | Focus | Docs Created |
|---------|-------|--------------|
| **1.1** | Pass classes + tests | 01-pass-classes.md |
| **1.2** | PassManager core | 02-pass-manager.md |
| **1.3** | Options + Pipeline | 03-options.md, 04-pipeline.md |
| **1.4** | Integration + tasks | 99-phase-tasks.md + integration |

---

## Quick Reference

### Starting This Phase

```bash
# Review roadmap
cat plans/optimizer-series/OPTIMIZER-ROADMAP.md

# Start session
clear && scripts/agent.sh start
```

### Creating Documents

Each document follows `make_plan` structure:
- Technical specification
- Code examples
- Test requirements
- Implementation notes

---

## References

### Original Detailed Plans

For deep technical details, see archived documents:
- `plans/archive/optimizer-v1/01-architecture.md`
- `plans/archive/optimizer-v1/OPTIMIZER-EXECUTION-PLAN.md`

### Inspiration Sources

| Source | What We Take |
|--------|--------------|
| LLVM | Pass manager architecture |
| GCC | Analysis invalidation |
| Rust/MIR | Clean pass interfaces |

---

**Parent**: [OPTIMIZER-ROADMAP.md](../OPTIMIZER-ROADMAP.md)  
**Next Phase**: [Phase 2: Analysis](../phase-2-analysis/00-phase-index.md)