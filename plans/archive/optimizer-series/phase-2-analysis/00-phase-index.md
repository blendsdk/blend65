# Phase 2: Analysis Passes - Phase Index

> **Phase**: 2 of 7  
> **Status**: Not Started  
> **Sessions**: ~4-5  
> **Goal**: Implement Use-Def and Liveness analysis  
> **Milestone**: Can query "is this value used?" and "is this value live?"

---

## Phase Overview

Phase 2 implements the **analysis passes** needed by transformation passes. Analysis passes examine IL but do NOT modify it. Results are cached and reused until invalidated.

**After this phase**: Transforms can query:
- "Is this value ever used?"
- "How many times is this value used?"
- "Is this value live at this point?"

---

## Directory Structure

```
packages/compiler/src/optimizer/analysis/
├── index.ts                # Analysis exports
├── use-def.ts              # Use-Definition analysis
└── liveness.ts             # Liveness analysis
```

---

## Documents in This Phase

| Doc | Name | Focus | Est. Lines |
|-----|------|-------|------------|
| **01** | [Use-Def Analysis](01-use-def.md) | Track definitions and uses | ~300 |
| **02** | [Liveness Analysis](02-liveness.md) | Track live values | ~300 |
| **99** | [Tasks](99-phase-tasks.md) | Task checklist & sessions | ~150 |

---

## Key Concepts

### Use-Def Analysis

Tracks where values are **defined** (assigned) and **used** (read):

```typescript
interface UseDefInfo {
  // Get the instruction that defines this value
  getDefinition(value: ILValue): ILInstruction | null;
  
  // Get all instructions that use this value
  getUses(value: ILValue): ILInstruction[];
  
  // Get count of uses (useful for DCE)
  getUseCount(value: ILValue): number;
  
  // Check if value has no uses (dead)
  isUnused(value: ILValue): boolean;
}
```

### Liveness Analysis

Tracks which values are **live** (will be used in the future):

```typescript
interface LivenessInfo {
  // Get live values at block entry/exit
  getBlockLiveness(block: BasicBlock): {
    liveIn: Set<VirtualRegister>;
    liveOut: Set<VirtualRegister>;
  };
  
  // Check if value is live at specific instruction
  isLiveAt(reg: VirtualRegister, inst: ILInstruction): boolean;
}
```

---

## Dependencies

### From Phase 1

- `Pass`, `AnalysisPass` base classes
- `PassManager` for registration and caching
- `OptimizationLevel` for level filtering

### From IL Generator

- `ILFunction`, `BasicBlock`, `ILInstruction`
- `ILValue`, `VirtualRegister`

---

## Success Criteria

- [ ] Use-def analysis tracks all definitions
- [ ] Use-def correctly counts uses
- [ ] Liveness analysis computes liveIn/liveOut
- [ ] Analyses integrate with PassManager
- [ ] Analysis caching works correctly
- [ ] ~80 tests passing
- [ ] Ready for Phase 3 transforms

---

## Why These Analyses?

| Analysis | Used By |
|----------|---------|
| **Use-Def** | DCE (find unused values), Copy Prop, CSE |
| **Liveness** | Register allocation, Dead store elimination |

These are the **minimum required analyses** for basic transforms.

---

## Session Plan

| Session | Focus | Docs |
|---------|-------|------|
| **2.1** | Use-Def implementation | 01-use-def.md |
| **2.2** | Liveness implementation | 02-liveness.md |
| **2.3** | Integration + testing | 99-phase-tasks.md |

---

## References

### Original Detailed Plans

For deep technical details, see:
- `plans/archive/optimizer-v1/02-analysis-passes.md`

### Inspiration Sources

| Source | What We Take |
|--------|--------------|
| LLVM | Use-def chain representation |
| GCC | Liveness dataflow equations |

---

**Parent**: [OPTIMIZER-ROADMAP.md](../OPTIMIZER-ROADMAP.md)  
**Previous Phase**: [Phase 1: Foundation](../phase-1-foundation/00-phase-index.md)  
**Next Phase**: [Phase 3: O1 Transforms](../phase-3-o1-transforms/00-phase-index.md)