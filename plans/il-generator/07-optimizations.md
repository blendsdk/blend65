# Phase 7: IL Optimization Passes

> **Phase**: 7 of 8  
> **Est. Time**: ~20 hours  
> **Tasks**: 14  
> **Tests**: ~195  
> **Prerequisites**: Phase 6 (SSA Construction)

---

## Overview

This phase implements basic optimization passes that work on IL before code generation, including 6502-specific optimizations for god-level performance.

## Directory Structure Created

```
packages/compiler/src/il/optimization/
├── index.ts                    # Optimization exports
├── dce.ts                      # Dead code elimination
├── constant-fold.ts            # Constant folding
├── constant-prop.ts            # Constant propagation
├── copy-prop.ts                # Copy propagation
├── cse.ts                      # Common subexpression elimination
├── unreachable.ts              # Unreachable block elimination
└── pipeline.ts                 # OptimizationPipeline
```

---

## Task 7.1: Dead Code Elimination (DCE)

**File**: `packages/compiler/src/il/optimization/dce.ts`

**Time**: 2 hours

**Tests**: 20 tests

**Key Concepts**:
- Remove instructions whose results are never used
- Must preserve side-effect instructions
- Iterative until no changes

---

## Task 7.2: Constant Folding

**File**: `packages/compiler/src/il/optimization/constant-fold.ts`

**Time**: 1.5 hours

**Tests**: 15 tests

**Key Concepts**:
- Evaluate constant expressions at compile time
- 1 + 2 → 3
- Handle overflow correctly for 6502

---

## Task 7.3: Constant Propagation

**File**: `packages/compiler/src/il/optimization/constant-prop.ts`

**Time**: 1.5 hours

**Tests**: 15 tests

**Key Concepts**:
- Replace variable with constant value when known
- SSA form makes this straightforward
- Works with sparse conditional constant propagation

---

## Task 7.4: Copy Propagation

**File**: `packages/compiler/src/il/optimization/copy-prop.ts`

**Time**: 1.5 hours

**Tests**: 15 tests

**Key Concepts**:
- Replace x = y; use(x) → use(y)
- Reduces register pressure
- Enables further DCE

---

## Task 7.5: Common Subexpression Elimination (CSE)

**File**: `packages/compiler/src/il/optimization/cse.ts`

**Time**: 2 hours

**Tests**: 20 tests

**Key Concepts**:
- a + b computed twice → reuse first result
- Hash-based value numbering
- Must respect side effects

---

## Task 7.6: Unreachable Block Elimination

**File**: `packages/compiler/src/il/optimization/unreachable.ts`

**Time**: 1 hour

**Tests**: 10 tests

**Key Concepts**:
- Remove blocks not reachable from entry
- Fix CFG predecessors/successors
- Common after branch folding

---

## Task 7.7: Create Optimization Pipeline

**File**: `packages/compiler/src/il/optimization/pipeline.ts`

**Time**: 1.5 hours

**Tests**: 15 tests

**Key Concepts**:
- Orchestrates optimization passes
- Runs in optimal order
- Iterates until fixed point

---

## Task 7.8: Add Optimization Level Configuration

**Time**: 1 hour

**Tests**: 10 tests

**Key Concepts**:
- -O0: No optimization
- -O1: Basic optimizations
- -O2: Aggressive optimizations
- -Os: Size optimization

---

## Task 7.9: Loop Metadata Instructions (v2.0)

**File**: `packages/compiler/src/il/optimization/loop-metadata.ts`

**Time**: 2 hours

**Tests**: 15 tests

**Key Concepts**:
- LOOP_START / LOOP_END markers
- Trip count hints for unrolling
- Loop-invariant variable identification
- Enables loop-aware optimizations

---

## Task 7.10: 6502 Strength Reduction (v2.0)

**File**: `packages/compiler/src/il/optimization/strength-reduction.ts`

**Time**: 1.5 hours

**Tests**: 15 tests

**Key Concepts**:
- `x * 2` → `x << 1` (SHL)
- `x / 2` → `x >> 1` (LSR)
- `x * 256` → word high-byte shift
- 6502-aware transformations

---

## Task 7.11: Zero-Page Promotion (v2.0)

**File**: `packages/compiler/src/il/optimization/zp-promotion.ts`

**Time**: 1.5 hours

**Tests**: 10 tests

**Key Concepts**:
- Identify frequently accessed variables
- Promote to zero page allocation
- Use semantic analysis ZP priority hints

---

## Task 7.12: Indexed Addressing Optimization (v2.0)

**File**: `packages/compiler/src/il/optimization/indexed-addressing.ts`

**Time**: 1 hour

**Tests**: 10 tests

**Key Concepts**:
- Prefer X/Y indexed modes for arrays
- Optimize loop counter to use index register
- Recognize arr[i] patterns

---

## Task 7.13: Array Bounds Elimination (v2.0)

**File**: `packages/compiler/src/il/optimization/bounds-elimination.ts`

**Time**: 1.5 hours

**Tests**: 15 tests

**Key Concepts**:
- Eliminate bounds checks in loops with known bounds
- `for i = 0 to 255: arr[i]` → no bounds check
- Uses loop induction variable analysis

---

## Task 7.14: Barrier-Aware Optimization (v2.0)

**Time**: 0.5 hours

**Tests**: 5 tests

**Key Concepts**:
- Optimizer respects OPT_BARRIER
- No instruction movement across barriers
- VOLATILE_READ/WRITE never eliminated

---

## Phase 7 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 7.1 | Dead code elimination | 2 hr | 20 | [ ] |
| 7.2 | Constant folding | 1.5 hr | 15 | [ ] |
| 7.3 | Constant propagation | 1.5 hr | 15 | [ ] |
| 7.4 | Copy propagation | 1.5 hr | 15 | [ ] |
| 7.5 | CSE | 2 hr | 20 | [ ] |
| 7.6 | Unreachable block elimination | 1 hr | 10 | [ ] |
| 7.7 | Optimization pipeline | 1.5 hr | 15 | [ ] |
| 7.8 | Optimization config | 1 hr | 10 | [ ] |
| 7.9 | Loop metadata instructions | 2 hr | 15 | [ ] |
| 7.10 | 6502 strength reduction | 1.5 hr | 15 | [ ] |
| 7.11 | Zero-page promotion | 1.5 hr | 10 | [ ] |
| 7.12 | Indexed addressing opt | 1 hr | 10 | [ ] |
| 7.13 | Array bounds elimination | 1.5 hr | 15 | [ ] |
| 7.14 | Barrier-aware optimization | 0.5 hr | 5 | [ ] |
| **Total** | | **20 hr** | **190** | |

---

## Success Criteria

- [ ] DCE removes unused instructions
- [ ] Constant folding evaluates at compile time
- [ ] Constants propagate through code
- [ ] Copy propagation reduces copies
- [ ] CSE eliminates redundant computation
- [ ] Unreachable blocks removed
- [ ] Pipeline runs all passes correctly
- [ ] Loop metadata enables loop optimizations
- [ ] 6502-specific strength reduction works
- [ ] Barriers are respected by optimizer
- [ ] 190 tests passing

---

**Previous**: [06-ssa-construction.md](06-ssa-construction.md)  
**Next**: [08-testing.md](08-testing.md)