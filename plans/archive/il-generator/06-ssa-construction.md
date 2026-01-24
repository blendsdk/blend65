# Phase 6: SSA Construction

> **Phase**: 6 of 8  
> **Est. Time**: ~11.5 hours  
> **Tasks**: 6  
> **Tests**: ~110  
> **Prerequisites**: Phase 5 (Intrinsics)

---

## Overview

This phase converts IL to proper SSA form with phi functions.

## Directory Structure Created

```
packages/compiler/src/il/ssa/
├── index.ts                    # SSA exports
├── dominators.ts               # Dominator tree
├── frontiers.ts                # Dominance frontiers
├── phi.ts                      # Phi placement
├── renaming.ts                 # Variable renaming
├── verification.ts             # SSA verification
└── constructor.ts              # SSAConstructor
```

---

## Task 6.1: Implement Dominator Tree Computation

**File**: `packages/compiler/src/il/ssa/dominators.ts`

**Time**: 2 hours

**Tests**: 15 tests (dominator computation)

**Key Concepts**:
- Block A dominates B if all paths to B go through A
- Entry block dominates all blocks
- Used for phi function placement

---

## Task 6.2: Implement Dominance Frontier Computation

**File**: `packages/compiler/src/il/ssa/frontiers.ts`

**Time**: 1.5 hours

**Tests**: 15 tests (dominance frontiers)

**Key Concepts**:
- Frontier = first blocks where dominance ends
- Used to determine where phi functions are needed

---

## Task 6.3: Implement Phi Function Placement

**File**: `packages/compiler/src/il/ssa/phi.ts`

**Time**: 2 hours

**Tests**: 20 tests (phi insertion)

**Key Concepts**:
- Insert phi at dominance frontiers
- For each variable assigned in multiple blocks
- Iterative algorithm

---

## Task 6.4: Implement Variable Renaming

**File**: `packages/compiler/src/il/ssa/renaming.ts`

**Time**: 2.5 hours

**Tests**: 25 tests (SSA renaming)

**Key Concepts**:
- Each assignment creates new version (x → x.0, x.1, x.2)
- Walk CFG in dominator tree order
- Update phi operands

---

## Task 6.5: Implement SSA Verification

**File**: `packages/compiler/src/il/ssa/verification.ts`

**Time**: 1.5 hours

**Tests**: 15 tests (SSA validity)

**Key Concepts**:
- Each register assigned exactly once
- All uses dominated by definition
- Phi operands from correct predecessors

---

## Task 6.6: Create SSA Construction Pass

**File**: `packages/compiler/src/il/ssa/constructor.ts`

**Time**: 2 hours

**Tests**: 20 tests (full SSA construction)

**Key Concepts**:
- Orchestrates all SSA steps
- Computes dominators → frontiers → phi → rename
- Validates result

---

## Phase 6 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 6.1 | Dominator tree | 2 hr | 15 | [ ] |
| 6.2 | Dominance frontiers | 1.5 hr | 15 | [ ] |
| 6.3 | Phi function placement | 2 hr | 20 | [ ] |
| 6.4 | Variable renaming | 2.5 hr | 25 | [ ] |
| 6.5 | SSA verification | 1.5 hr | 15 | [ ] |
| 6.6 | SSA construction pass | 2 hr | 20 | [ ] |
| **Total** | | **11.5 hr** | **110** | |

---

## Success Criteria

- [ ] Dominator tree computed correctly
- [ ] Dominance frontiers computed correctly
- [ ] Phi functions placed at correct locations
- [ ] Variables properly renamed to SSA form
- [ ] SSA verification catches errors
- [ ] 110 tests passing

---

**Previous**: [05-intrinsics.md](05-intrinsics.md)  
**Next**: [07-optimizations.md](07-optimizations.md)