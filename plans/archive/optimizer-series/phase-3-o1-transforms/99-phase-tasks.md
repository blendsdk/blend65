# Phase 3: O1 Transforms - Task Checklist

> **Document**: 99-phase-tasks.md  
> **Phase**: 3 of 7  
> **Sessions**: 5-6 estimated  
> **Total Tests**: ~125  

---

## Phase Summary

| Pass | Doc | Est. Tests | Sessions |
|------|-----|------------|----------|
| Dead Code Elimination | [01-dce.md](01-dce.md) | 30 | 1 |
| Constant Folding | [02-constant-fold.md](02-constant-fold.md) | 35 | 1-2 |
| Constant Propagation | [03-constant-prop.md](03-constant-prop.md) | 30 | 1 |
| Copy Propagation | [04-copy-prop.md](04-copy-prop.md) | 30 | 1 |

---

## Session 3.1: Dead Code Elimination

**Reference**: [01-dce.md](01-dce.md)

### Tasks

- [ ] **3.1.1** Create `packages/compiler/src/optimizer/transforms/dce.ts`
- [ ] **3.1.2** Implement `DeadCodeElimination` class extending `TransformPass`
- [ ] **3.1.3** Implement `isDead()` - check for unused results and no side effects
- [ ] **3.1.4** Implement worklist algorithm for cascading deletion
- [ ] **3.1.5** Implement `removeUnreachableBlocks()` - DFS from entry
- [ ] **3.1.6** Add statistics tracking

### Tests (~30)

- [ ] **3.1.T1** Remove single unused definition (5 tests)
- [ ] **3.1.T2** Cascading dead code removal (5 tests)
- [ ] **3.1.T3** Preserve side-effecting instructions (5 tests)
- [ ] **3.1.T4** Remove unreachable blocks (5 tests)
- [ ] **3.1.T5** Handle phi functions correctly (5 tests)
- [ ] **3.1.T6** Preserve function parameters (5 tests)

**Verify**: `./compiler-test optimizer`

---

## Session 3.2: Constant Folding

**Reference**: [02-constant-fold.md](02-constant-fold.md)

### Tasks

- [ ] **3.2.1** Create `packages/compiler/src/optimizer/transforms/constant-fold.ts`
- [ ] **3.2.2** Implement `ConstantFolding` class
- [ ] **3.2.3** Implement `evaluate()` for all foldable opcodes
- [ ] **3.2.4** Implement 8-bit wrap semantics (`wrap8`)
- [ ] **3.2.5** Implement 16-bit operations (`wrap16`)
- [ ] **3.2.6** Handle signed/unsigned comparisons correctly
- [ ] **3.2.7** Add division-by-zero protection

### Tests (~35)

- [ ] **3.2.T1** Fold arithmetic: add, sub, mul (8 tests)
- [ ] **3.2.T2** Fold division with div-by-zero check (4 tests)
- [ ] **3.2.T3** Fold bitwise: and, or, xor, not (6 tests)
- [ ] **3.2.T4** Fold shifts: shl, shr, asr (5 tests)
- [ ] **3.2.T5** Fold comparisons: eq, ne, lt, etc. (6 tests)
- [ ] **3.2.T6** 8-bit overflow wrap-around (3 tests)
- [ ] **3.2.T7** 16-bit operations (3 tests)

**Verify**: `./compiler-test optimizer`

---

## Session 3.3: Constant Propagation

**Reference**: [03-constant-prop.md](03-constant-prop.md)

### Tasks

- [ ] **3.3.1** Create `packages/compiler/src/optimizer/transforms/constant-prop.ts`
- [ ] **3.3.2** Implement `ConstantPropagation` class
- [ ] **3.3.3** Implement lattice (TOP → CONSTANT → BOTTOM)
- [ ] **3.3.4** Implement worklist-based propagation
- [ ] **3.3.5** Implement `replaceUses()` - substitute constants
- [ ] **3.3.6** Handle phi functions (all inputs same constant)

### Tests (~30)

- [ ] **3.3.T1** Propagate simple constants (6 tests)
- [ ] **3.3.T2** Multiple uses of same constant (5 tests)
- [ ] **3.3.T3** Cascading propagation (5 tests)
- [ ] **3.3.T4** Phi with constant inputs (5 tests)
- [ ] **3.3.T5** Non-constant parameters (4 tests)
- [ ] **3.3.T6** Interaction with constant folding (5 tests)

**Verify**: `./compiler-test optimizer`

---

## Session 3.4: Copy Propagation

**Reference**: [04-copy-prop.md](04-copy-prop.md)

### Tasks

- [ ] **3.4.1** Create `packages/compiler/src/optimizer/transforms/copy-prop.ts`
- [ ] **3.4.2** Implement `CopyPropagation` class
- [ ] **3.4.3** Implement `isCopy()` - detect copy/move/phi-copy
- [ ] **3.4.4** Implement `resolveCopyChains()` - transitive resolution
- [ ] **3.4.5** Implement `replaceUses()` - substitute sources

### Tests (~30)

- [ ] **3.4.T1** Simple copy replacement (6 tests)
- [ ] **3.4.T2** Copy chain resolution (6 tests)
- [ ] **3.4.T3** Multiple uses of copy (5 tests)
- [ ] **3.4.T4** Phi as copy (5 tests)
- [ ] **3.4.T5** Non-copy instructions preserved (4 tests)
- [ ] **3.4.T6** SSA correctness (4 tests)

**Verify**: `./compiler-test optimizer`

---

## Session 3.5: Integration & Pipeline

### Tasks

- [ ] **3.5.1** Register all Phase 3 passes in PassManager
- [ ] **3.5.2** Create O1 pipeline configuration
- [ ] **3.5.3** Wire `-O1` flag to enable pipeline
- [ ] **3.5.4** Run full integration tests

### Tests

- [ ] **3.5.T1** O1 pipeline reduces simple function size
- [ ] **3.5.T2** O1 pipeline handles real programs
- [ ] **3.5.T3** Pass ordering is correct (dependencies)
- [ ] **3.5.T4** Statistics reporting works
- [ ] **3.5.T5** Multiple iteration convergence

**Verify**: `./compiler-test optimizer`

---

## Phase 3 Success Criteria

- [ ] All 4 passes implemented and tested
- [ ] ~125 tests passing
- [ ] O1 pipeline wired up
- [ ] Measurable code size reduction with `-O1`
- [ ] No regressions in existing tests

---

## File Locations

```
packages/compiler/src/optimizer/
├── transforms/
│   ├── dce.ts              ← Session 3.1
│   ├── constant-fold.ts    ← Session 3.2
│   ├── constant-prop.ts    ← Session 3.3
│   └── copy-prop.ts        ← Session 3.4
└── pipelines/
    └── o1-pipeline.ts      ← Session 3.5
```

---

## Dependencies

| This Phase Needs | From |
|------------------|------|
| `TransformPass` | Phase 1 |
| `PassManager` | Phase 1 |
| `UseDefAnalysis` | Phase 2 |
| `LivenessAnalysis` | Phase 2 |

---

**Parent**: [Phase 3 Index](00-phase-index.md)  
**Previous Phase**: [Phase 2 Tasks](../phase-2-analysis/99-phase-tasks.md)  
**Next Phase**: [Phase 4: IL Peephole](../phase-4-il-peephole/00-phase-index.md)