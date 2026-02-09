# Phase 7: Advanced - Phase Index

> **Phase**: 7 of 7  
> **Status**: Not Started  
> **Sessions**: ~6-8  
> **Goal**: Full optimization suite (-O3, -Os, -Oz)  
> **Milestone**: God-level optimization complete 🎉

---

## Phase Overview

Phase 7 implements **advanced optimizations** that complete the optimizer suite. This phase enables -O3 (aggressive performance), -Os (size preference), and -Oz (minimum size).

**After this phase**: The Blend65 compiler produces god-level optimized code matching hand-tuned assembly.

---

## Documents in This Phase

| Doc | Name | Focus | Est. Lines |
|-----|------|-------|------------|
| **01** | [Loop Analysis](01-loop-analysis.md) | Loop detection, structure analysis | ~350 |
| **02** | [LICM](02-licm.md) | Loop Invariant Code Motion | ~350 |
| **03** | [Loop Unrolling](03-loop-unroll.md) | Full/partial unroll strategies | ~350 |
| **04** | [Register Alloc](04-register-alloc.md) | Improved A/X/Y allocation | ~400 |
| **05** | [Size Optimization](05-size-opt.md) | -Os and -Oz strategies | ~300 |
| **06** | [SMC](06-smc.md) | Self-modifying code (optional) | ~250 |
| **99** | [Tasks](99-phase-tasks.md) | Task checklist | ~150 |

---

## Key Optimizations

### Loop Analysis

Detect and analyze loop structures for optimization:

```js
// Loop detection identifies:
for (let i = 0; i < 10; i++) {
    // - Loop header (entry point)
    // - Loop body (iterated code)
    // - Loop latch (back edge)
    // - Loop exit (continuation)
    // - Induction variable (i)
    // - Trip count (10)
}
```

**Analysis Outputs**:
- Loop nesting tree
- Induction variables
- Trip counts (if constant)
- Loop-carried dependencies

### Loop Invariant Code Motion (LICM)

Move invariant computations out of loops:

```js
// Before
for (let i = 0; i < 100; i++) {
    let offset = baseAddr + 40;     // Invariant! Computed 100 times
    buffer[i] = offset + i;
}

// After LICM
let offset = baseAddr + 40;         // Moved out! Computed once
for (let i = 0; i < 100; i++) {
    buffer[i] = offset + i;
}
```

**Savings**: ~100 cycles × loop iterations

### Loop Unrolling

Reduce loop overhead by replicating body:

```asm
; Before (10 iterations, 7 cycles overhead each)
    LDX #9
loop:
    LDA data,X
    STA buffer,X
    DEX
    BPL loop              ; 70 cycles of overhead

; After (unrolled × 2)
    LDX #8
loop:
    LDA data+1,X
    STA buffer+1,X
    LDA data,X
    STA buffer,X
    DEX
    DEX
    BPL loop              ; 35 cycles of overhead (50% saved)
```

**Unroll Strategies**:
- **Full unroll**: Trip count ≤ 8, eliminates all overhead
- **Partial unroll**: 2× or 4×, balance size vs speed
- **Trip count aware**: Only when count is constant

### Register Allocation Improvements

Better use of scarce 6502 registers:

```asm
; Before (poor allocation)
LDA value1
STA temp              ; Spill to memory
LDA value2
CLC
ADC temp              ; Reload from memory

; After (improved allocation)
LDA value2            ; Reorder to avoid spill
STA temp
LDA value1
CLC
ADC temp              ; Same result, better register use
```

**Improvements**:
- Live range analysis for A/X/Y
- Spill/reload minimization
- Instruction reordering for better allocation

### Size Optimization (-Os, -Oz)

Trade speed for size when requested:

| Strategy | -Os | -Oz | Savings |
|----------|-----|-----|---------|
| Prefer JSR over inline | ✓ | ✓ | 3+ bytes per call site |
| Short branches when possible | ✓ | ✓ | 1 byte per branch |
| Combine constants | ✓ | ✓ | 1-3 bytes per constant |
| Aggressive tail call | ✓ | ✓ | 3 bytes per call |
| Factored code blocks | - | ✓ | Variable |
| Overlapping sequences | - | ✓ | 1-5 bytes |

### Self-Modifying Code (Optional -Osmc)

**Warning**: Breaks on some modern platforms. Opt-in only.

```asm
; Before (indexed addressing)
    LDA data,X          ; 4 cycles, 3 bytes
    
; After (self-modifying)
    LDA data            ; 3 cycles, 2 bytes (modified at runtime)
    ; ... code that modifies the address operand ...
```

**Use Cases**:
- Ultra-tight inner loops
- When -Oz isn't small enough
- Pure C64/retro target only

---

## Optimization Levels Finalized

After Phase 7, all levels are complete:

| Level | Description | Phases | Speed | Size |
|-------|-------------|--------|-------|------|
| **-O0** | Debug, no optimization | 1 | Baseline | Largest |
| **-O1** | Basic (DCE, const fold) | 1-3 | +15% | -20% |
| **-O2** | Standard (peephole) | 1-5 | +40% | -45% |
| **-O3** | Aggressive (loops) | 1-7 | +60% | -50% |
| **-Os** | Prefer size over speed | 1-7 | +35% | -55% |
| **-Oz** | Minimum size | 1-7 | +25% | -60% |
| **-Osmc** | Self-modifying (opt-in) | 1-7 | +70% | -65% |

---

## Directory Structure

```
packages/compiler/src/il/optimizer/
├── analysis/
│   └── loop-analysis.ts      # Loop detection/analysis
├── passes/
│   ├── licm.ts               # Loop Invariant Code Motion
│   ├── loop-unroll.ts        # Loop unrolling
│   └── register-improve.ts   # Register allocation improvements
└── index.ts

packages/compiler/src/asm-il/optimizer/
├── passes/
│   ├── size-opt.ts           # Size optimization strategies
│   └── smc.ts                # Self-modifying code (optional)
└── index.ts
```

---

## Dependencies

### From Phase 2

- Use-def analysis (for LICM safety)
- Liveness analysis (for register allocation)

### From Phases 4-6

- All previous optimizations
- Pattern framework

---

## Loop Optimization Safety

**LICM Safety Rules**:
1. ✅ Only move if no side effects in loop
2. ✅ Only move if value not modified in loop
3. ✅ Check for aliasing (store could affect load)
4. ✅ Preserve exception semantics

**Unroll Safety Rules**:
1. ✅ Must know trip count (or have upper bound)
2. ✅ Check code size expansion
3. ✅ Handle remainder iterations
4. ✅ Preserve induction variable semantics

---

## Success Criteria

- [ ] Loop analysis detects all loop structures
- [ ] LICM moves invariant code correctly
- [ ] Loop unrolling with correct remainder handling
- [ ] Register allocation improvements measurable
- [ ] -Os produces smaller code than -O2
- [ ] -Oz produces smallest possible code
- [ ] ~150 tests passing
- [ ] All optimization levels working correctly

---

## Performance Targets (Final)

| Metric | Target | Achieved |
|--------|--------|----------|
| -O0 → -O1 | 20-30% smaller | Phase 3 |
| -O0 → -O2 | 40-50% smaller | Phase 5 |
| -O0 → -O3 | 50-60% smaller | Phase 7 ✓ |
| main.asm fixed | Clean output | Phase 5 |
| Hand-written competitive | ~90% quality | Phase 7 ✓ |

---

## 🎉 Completion Celebration

After Phase 7, the Blend65 compiler will have:

✅ **Full optimization pipeline** (-O0 to -O3, -Os, -Oz)  
✅ **God-level 6502 code** rivaling hand-written assembly  
✅ **Clean architecture** with modular pass system  
✅ **Comprehensive testing** for correctness  
✅ **main.asm** producing efficient, clean output  

**The compiler journey is complete!**

---

**Parent**: [OPTIMIZER-ROADMAP.md](../OPTIMIZER-ROADMAP.md)  
**Previous Phase**: [Phase 6: 6502 Specific](../phase-6-6502-specific/00-phase-index.md)  
**Next Phase**: None - Optimizer Complete! 🎉