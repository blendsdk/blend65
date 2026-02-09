# Blend65 Optimizer Series - Master Roadmap

> **Status**: Active Development  
> **Created**: January 27, 2026  
> **Goal**: God-level 6502 optimizer matching hand-tuned assembly  
> **Approach**: Incremental phases, never breaking the compiler

---

## Executive Summary

This roadmap guides the implementation of a **god-level optimizer** for the Blend65 compiler. The optimizer is split into **7 phases**, each with its own focused plan that fits within AI context limits.

### Why This Structure?

- **60K token AI limit** - Each document is ~200-400 lines max
- **Incremental progress** - Each phase adds measurable improvement
- **Never breaks compiler** - Working code at each milestone
- **Progressive optimization** - -O0 → -O1 → -O2 → -O3

---

## Current Problem Example

The compiler currently produces inefficient code:

```asm
; From main.asm - BEFORE optimization
LDA _data                   ; Load data     ← WASTED (overwritten next)
LDA #$05                    ; v2 = 5
STA $50                     ; Store len
LDA $50                     ; Load len      ← REDUNDANT (A already has value!)
```

After Phase 5 (ASM Peephole), this becomes:

```asm
; AFTER optimization
LDA #$05                    ; v2 = 5
STA $50                     ; Store len
; (redundant instructions eliminated!)
```

---

## Phase Overview

| Phase | Name | Focus | Optimization Level | Fix main.asm? |
|-------|------|-------|-------------------|---------------|
| **1** | [Foundation](phase-1-foundation/) | Pass Manager infrastructure | -O0 (pass-through) | ❌ |
| **2** | [Analysis](phase-2-analysis/) | Use-def, liveness analysis | -O0 (analysis only) | ❌ |
| **3** | [O1 Transforms](phase-3-o1-transforms/) | DCE, const fold/prop | -O1 | Partial |
| **4** | [IL Peephole](phase-4-il-peephole/) | IL pattern optimization | -O2 | Partial |
| **5** | [ASM Peephole](phase-5-asm-peephole/) | 6502 ASM patterns | -O2 complete | ✅ **YES** |
| **6** | [6502 Specific](phase-6-6502-specific/) | ZP promotion, strength reduce | -O2+ | ✅ Better |
| **7** | [Advanced](phase-7-advanced/) | Loops, register alloc, -O3 | -O3, Os, Oz | ✅ Best |

---

## 🚨 Known Gaps — Missing Optimization Patterns

> **Discovered**: 2026-09-02 via analysis of `examples/border-cycle/main.blend` compiled with `-O1`
> **Root Cause**: The entire optimizer only operates at the **function level**. There is no concept of program-level optimization passes.

### Architectural Gap: No Program-Level Passes

The `PassManager.optimize()` takes a single `ILFunction`. The `ILOptimizer.optimizeProgram()` iterates over each function individually. The optimizer **cannot see relationships between functions** — it can't build call graphs, determine reachability, or inline functions.

```typescript
// Current: optimizes each function in isolation
for (const func of program.functions) {
  const result = this.passManager.optimize(func);  // function-scope only!
}
```

### Missing Patterns by Level

| # | Pattern | Should Be At | Description | Impact |
|---|---------|-------------|-------------|--------|
| GAP-1 | **Program-level pass infrastructure** | Phase 1 (Foundation) | `PassManager` needs a `ProgramPass` concept alongside `FunctionPass` | Blocks all inter-procedural opts |
| GAP-2 | **Call graph analysis** | Phase 2 (Analysis) | Build who-calls-whom graph — needed for DCE, inlining, interprocedural opts | Blocks GAP-3, GAP-4, GAP-5 |
| GAP-3 | **Dead Function Elimination** | -O1 (Phase 3) | Remove `speedy()` — never called from any reachable function | HIGH — wastes bytes |
| GAP-4 | **Dead Global/Constant Elimination** | -O1 (Phase 3) | Remove module-level constants/variables that are never referenced | MEDIUM — wastes ZP/RAM |
| GAP-5 | **Single-call-site Function Inlining** | -O1 (Phase 3) | Inline `delay()` body directly into `main()` — called from exactly 1 place | HIGH — saves 12 cycles/call on 6502 |
| GAP-6 | **Small Function Inlining** | -O2 (Phase 5) | Inline small functions (≤ N instructions) to avoid JSR/RTS overhead | HIGH for 6502 |
| GAP-7 | **Compare+Branch Simplification** | -O2 (Phase 5) | `CMP #$0F; BCC .x; BEQ .x` → `CMP #$10; BCC .x` (save 1 instruction) | MEDIUM |
| GAP-8 | **Common Subexpression Elimination (CSE)** | -O2 (Phase 4) | Eliminate redundant computations — not planned in any phase | MEDIUM |

### Integration Plan

These gaps should be addressed by extending existing phases:

- **Phase 1**: Add `ProgramPass` base class alongside existing `OptimizationPass` (function-level)
- **Phase 2**: Add `CallGraphAnalysis` alongside existing use-def and liveness analysis
- **Phase 3**: Add `DeadFunctionElimination`, `DeadGlobalElimination`, `SingleCallSiteInlining` as program-level passes
- **Phase 4**: Add `CSE` as a function-level pass
- **Phase 5**: Add `CompareBranchSimplification` and `SmallFunctionInlining` patterns

---

## Phase Details

### Phase 1: Foundation (~4-6 sessions)

**Goal**: Establish pass manager infrastructure

**Deliverables**:
- Pass base classes (Pass, AnalysisPass, TransformPass)
- PassManager with dependency resolution
- OptimizationOptions and levels (-O0 to -O3, Os, Oz)
- Pipeline builder with presets

**Directory**: `phase-1-foundation/`

**Milestone**: PassManager can register and execute empty passes

---

### Phase 2: Analysis (~4-6 sessions)

**Goal**: Implement minimum analysis for transforms

**Deliverables**:
- Use-def analysis (track value definitions and uses)
- Liveness analysis (track live values at each point)
- Analysis caching and invalidation

**Directory**: `phase-2-analysis/`

**Milestone**: Can query "is this value used?" and "is this value live?"

---

### Phase 3: O1 Transforms (~5-7 sessions)

**Goal**: Basic optimization passes for -O1 level

**Deliverables**:
- Dead Code Elimination (DCE)
- Constant Folding (1+2 → 3)
- Constant Propagation (let x=5; y=x → y=5)
- Copy Propagation (x=y; use(x) → use(y))

**Directory**: `phase-3-o1-transforms/`

**Milestone**: -O1 produces smaller code than -O0

---

### Phase 4: IL Peephole (~5-7 sessions)

**Goal**: IL-level pattern optimization for -O2

**Deliverables**:
- Pattern framework and registry
- Load/store elimination patterns
- Arithmetic identity patterns (x+0 → x)
- Strength reduction (x*2 → x<<1)

**Directory**: `phase-4-il-peephole/`

**Milestone**: -O2 produces smaller code than -O1

---

### Phase 5: ASM Peephole (~5-7 sessions)

**Goal**: 6502 ASM-level patterns (FIXES main.asm!)

**Deliverables**:
- Redundant flag patterns (CLC/SEC removal)
- Zero-flag optimization (LDA + CMP #0 → LDA)
- Store-load elimination (STA $x; LDA $x → STA $x)
- Branch chain collapse

**Directory**: `phase-5-asm-peephole/`

**Milestone**: **main.asm redundant instructions eliminated!**

---

### Phase 6: 6502 Specific (~5-7 sessions)

**Goal**: 6502-specific optimizations

**Deliverables**:
- Zero-page promotion (hot variables to $00-$FF)
- Strength reduction (x*4 → ASL ASL)
- Indexed addressing optimization
- Flag optimization (carry, zero, negative)

**Directory**: `phase-6-6502-specific/`

**Milestone**: Code competitive with hand-written assembly

---

### Phase 7: Advanced (~6-8 sessions)

**Goal**: Full optimization suite (-O3, Os, Oz)

**Deliverables**:
- Loop invariant code motion (LICM)
- Loop unrolling
- Register allocation improvements
- Size optimization (-Os, -Oz)
- Optional: Self-modifying code (-Osmc)

**Directory**: `phase-7-advanced/`

**Milestone**: God-level optimization complete

---

## Optimization Levels Summary

| Level | Name | Description | Phases Needed |
|-------|------|-------------|---------------|
| **-O0** | None | Pass-through, for debugging | Phase 1 |
| **-O1** | Basic | DCE, const fold/prop | Phases 1-3 |
| **-O2** | Standard | O1 + peephole (default release) | Phases 1-5 |
| **-O3** | Aggressive | O2 + loops + advanced | Phases 1-7 |
| **-Os** | Size | O2 with size preference | Phases 1-7 |
| **-Oz** | Min Size | Aggressive size reduction | Phases 1-7 |

---

## Implementation Rules

### Never Break the Compiler

1. Each phase must produce working code
2. -O0 always works (pass-through)
3. Tests must pass before moving to next phase
4. Fallback to lower level if issues

### Multi-Session Execution

1. Each document fits in 60K token context
2. Wrap up at 80% context usage
3. `/compact` between sessions
4. Clear continuation instructions

### Testing Requirements

1. Unit tests for each pass
2. E2E tests comparing optimization levels
3. No semantic changes (same behavior at all levels)
4. Regression tests for each milestone

---

## Quick Reference

### Starting a Session

```bash
# 1. Start agent mode
clear && scripts/agent.sh start

# 2. Reference specific phase
# "Continue Phase X per plans/optimizer-series/phase-X-xxx/"
```

### Ending a Session

```bash
# 1. Verify tests pass
clear && ./compiler-test

# 2. End agent mode
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| -O1 code vs -O0 | 20-30% smaller |
| -O2 code vs -O0 | 40-50% smaller |
| -O3 code vs -O0 | 50-60% smaller |
| Compile time -O0 | < 0.1s / 1000 lines |
| Compile time -O2 | < 2s / 1000 lines |
| main.asm fixed | After Phase 5 |

---

**Next Step**: Begin with [Phase 1: Foundation](phase-1-foundation/00-phase-index.md)