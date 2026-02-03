# Requirements: IL Optimizer

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

The IL Optimizer is a **god-level optimization engine** that transforms IL (Intermediate Language) to produce maximally efficient code before it reaches the Code Generator. It is the first stage of a two-stage optimization pipeline.

**Key Principle**: Optimize IL as much as possible to reduce the work needed by the ASM-IL optimizer.

## Functional Requirements

### Must Have (P0)

- [x] **Pass Manager Infrastructure**
  - Pass registration and ordering
  - Pass dependencies (analysis → transform)
  - Pass enable/disable per optimization level

- [x] **Dead Code Elimination (DCE)**
  - Remove dead stores (using existing `isDeadStore()`)
  - Remove unreachable code after unconditional jumps
  - Remove dead computations

- [x] **Constant Folding**
  - Fold `LOAD_IMM a; ADD_IMM b` → `LOAD_IMM (a+b)`
  - Fold `LOAD_IMM a; SUB_IMM b` → `LOAD_IMM (a-b)`
  - Fold `LOAD_IMM a; AND_IMM b` → `LOAD_IMM (a&b)`
  - Fold `LOAD_IMM a; OR_IMM b` → `LOAD_IMM (a|b)`
  - Fold `LOAD_IMM a; XOR_IMM b` → `LOAD_IMM (a^b)`
  - Fold `LOAD_IMM a; SHL_BYTE n` → `LOAD_IMM (a<<n)`
  - Fold `LOAD_IMM a; SHR_BYTE n` → `LOAD_IMM (a>>n)`

- [x] **Constant Propagation**
  - Track known constant values through stores/loads
  - Replace `LOAD_BYTE x` with `LOAD_IMM value` when x is known
  - Propagate across basic blocks (within function)

- [x] **Copy Propagation**
  - Track value equivalences (x = y means x equals y)
  - Replace uses of copy with original when beneficial

- [x] **IL Peephole Optimization**
  - Identity elimination: `ADD_IMM 0`, `SUB_IMM 0`, `OR_IMM 0`, `AND_IMM $FF`
  - Strength reduction: `MUL 2` → `SHL 1`, `DIV 2` → `SHR 1`
  - Load-store elimination: `LOAD x; STORE x` → (remove)
  - Redundant load elimination: `LOAD x; ...(no write to x)...; LOAD x` → remove second

### Should Have (P1)

- [ ] **Optimization Statistics**
  - Track instructions removed per pass
  - Track total optimization impact
  - Debug output mode

- [ ] **Aggressive Mode (-O3)**
  - More expensive analysis
  - Speculative optimizations
  - Inlining candidates marking

- [ ] **Size Optimization Mode (-Os, -Oz)**
  - Prefer smaller sequences over faster ones
  - Remove alignment NOPs
  - Aggressive dead code removal

### Won't Have (Out of Scope)

- ❌ **Loop Optimizations** - Deferred to advanced phase
- ❌ **Inlining** - Requires AST-level changes
- ❌ **Global Value Numbering** - Too complex for initial version
- ❌ **Alias Analysis** - Not needed for SFA architecture
- ❌ **ASM-level patterns** - Handled by ASM-IL Optimizer

## Technical Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| O0 compile time overhead | 0% (pass-through) |
| O1 compile time overhead | < 10% |
| O2 compile time overhead | < 50% |
| O3 compile time overhead | < 200% |
| Code size reduction O1 | 10-20% |
| Code size reduction O2 | 20-40% |
| Code size reduction O3 | 30-50% |

### Correctness

- **Semantic Preservation**: Optimized code MUST have identical behavior
- **No Side-Effect Changes**: Cannot reorder or remove side effects
- **Test Coverage**: Every optimization must have positive and negative tests

### Integration

- **Input**: `ILFunction` from IL Generator
- **Output**: Optimized `ILFunction` to Code Generator
- **API**: `optimize(func: ILFunction, options: OptimizationOptions): ILFunction`

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Pass ordering | Fixed vs Dynamic | Fixed with deps | Simpler, predictable |
| Analysis reuse | Fresh each time vs Cached | Cached with invalidation | Performance |
| Multi-function | Per-function vs Whole-program | Per-function | SFA already handles globals |
| Iterative | Single pass vs Fixed-point | Fixed-point optional | O3 can iterate |

## Acceptance Criteria

### Per-Pass Criteria

1. [ ] **DCE Pass**
   - Removes stores to variables not read before next store
   - Removes code after unconditional jumps (within block)
   - Does NOT remove stores with side effects

2. [ ] **Constant Folding Pass**
   - Folds all arithmetic on immediate values
   - Handles overflow correctly (byte wraps at 256, word at 65536)
   - Preserves signed behavior where specified

3. [ ] **Constant Propagation Pass**
   - Tracks constants through single assignments
   - Stops tracking at control flow merge points
   - Propagates across straight-line code

4. [ ] **Copy Propagation Pass**
   - Identifies copy instructions (LOAD then STORE)
   - Replaces uses with original where beneficial
   - Does not increase register pressure

5. [ ] **IL Peephole Pass**
   - Pattern matching on instruction sequences
   - All patterns documented
   - Easy to add new patterns

### Overall Criteria

1. [ ] All optimization levels work (-O0 through -Oz)
2. [ ] All tests pass at each optimization level
3. [ ] No semantic changes between optimization levels
4. [ ] Measurable code size reduction at O2+
5. [ ] Documentation complete
6. [ ] Integration with compiler pipeline

## Optimization Level Matrix

| Pass | O0 | O1 | O2 | O3 | Os | Oz |
|------|----|----|----|----|----|----|
| DCE | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Const Fold | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Const Prop | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Copy Prop | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| IL Peephole | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Aggressive | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Size Focus | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Iterate | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

## Dependencies

### External Dependencies

- IL Generator must produce valid IL with proper def-use annotations
- Frame Allocator must have assigned addresses to all slots

### Internal Dependencies

```
Liveness Analysis (existing)
         ↓
    DCE Pass
         ↓
Constant Analysis
         ↓
Constant Folding ←→ Constant Propagation
         ↓
  Copy Propagation
         ↓
   IL Peephole
```

## Related Documents

| Document | Description |
|----------|-------------|
| [02-current-state.md](02-current-state.md) | Existing analysis infrastructure |
| [03-infrastructure.md](03-infrastructure.md) | Pass manager design |
| [99-execution-plan.md](99-execution-plan.md) | Implementation tasks |