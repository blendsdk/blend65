# Advanced Loop Optimizations: Optimizer V2

> **Document**: 06-advanced-loops.md
> **Parent**: [Index](00-index.md)
> **Gaps Covered**: GAP-9 (Loop analysis), GAP-10 (LICM), GAP-11 (Loop unrolling), GAP-12 (Register alloc)

## Overview

Advanced optimizations targeting loops and register usage. These provide the largest performance gains for 6502 programs since loops are where most execution time is spent.

## GAP-9: Loop Analysis (Loop Tree)

### Current State

`ILFunction.loops` already contains `ILLoop[]` with `headerLabel`, `exitLabel`, `bodyLabels`, and `depth`. However, this data is not used by the optimizer — only by `il/analysis.ts` for heuristic hints.

### Required: LoopTree

```typescript
// optimizer/analysis/loop-tree.ts

/**
 * Loop tree for structured loop analysis.
 *
 * Builds a hierarchical view of loops from ILFunction.loops.
 * Supports queries needed by LICM and loop unrolling.
 */
export class LoopTree {
  /** Build from ILFunction's loops and instructions */
  static build(func: ILFunction): LoopTree;

  /** Get all loops */
  getLoops(): LoopInfo[];

  /** Get the innermost loop containing an instruction index */
  getLoopFor(instrIndex: number): LoopInfo | null;

  /** Get loop depth for an instruction index */
  getDepth(instrIndex: number): number;

  /** Get instruction indices that form the loop body */
  getBodyIndices(loop: LoopInfo): number[];

  /** Get the preheader insertion point (just before header) */
  getPreheaderIndex(loop: LoopInfo): number;
}

interface LoopInfo {
  headerLabel: string;
  exitLabel: string;
  headerIndex: number;
  exitIndex: number;
  depth: number;
  parent: LoopInfo | null;
  children: LoopInfo[];
}
```

## GAP-10: Loop Invariant Code Motion (LICM)

### Algorithm

```
For each loop (innermost first):
  1. Identify invariant instructions:
     - All operands defined outside the loop, OR
     - All operands are constants (LOAD_IMM)
     - Instruction has no side effects
  2. Move invariant instructions to preheader:
     - Insert before loop header label
     - Maintain def-use relationships
  3. Skip instructions that:
     - Define variables used by non-invariant loop instructions
     - Have side effects (STORE to memory-mapped, CALL)
     - Are control flow (JUMP, LABEL)
```

### Implementation: `LICMPass`

```typescript
// optimizer/passes/licm.ts
export class LICMPass implements OptimizationPass {
  readonly name = 'licm';
  readonly dependencies = ['dce', 'constant-prop'];

  run(func: ILFunction, options: OptimizationOptions): PassResult {
    const loopTree = LoopTree.build(func);
    const loops = loopTree.getLoops();
    // Process innermost loops first (reverse depth order)
    // For each loop, find and hoist invariant instructions
  }

  protected isInvariant(instr: ILInstruction, loopBody: Set<number>, func: ILFunction): boolean;
  protected hasSideEffects(instr: ILInstruction): boolean;
  protected hoistToPreheader(func: ILFunction, instrIndex: number, preheaderIndex: number): void;
}
```

### Enabled At: O2+

### 6502 Impact

Moving invariant loads/computations out of tight loops is one of the highest-impact optimizations for 6502 — every cycle saved is multiplied by the iteration count.

## GAP-11: Loop Unrolling

### Strategy

- Unroll small loops with known constant iteration count
- At O2: unroll by factor of 2 for loops ≤ 8 instructions
- At O3: unroll by factor of 4 for loops ≤ 16 instructions
- At Os/Oz: no unrolling (increases code size)

### Implementation: `LoopUnrollPass`

```typescript
// optimizer/passes/loop-unroll.ts
export class LoopUnrollPass implements OptimizationPass {
  readonly name = 'loop-unroll';
  readonly dependencies = ['licm'];

  run(func: ILFunction, options: OptimizationOptions): PassResult {
    const loopTree = LoopTree.build(func);
    // Find loops with constant iteration count
    // Duplicate loop body N times, adjusting counter
  }

  protected getIterationCount(loop: LoopInfo, func: ILFunction): number | null;
  protected unrollLoop(func: ILFunction, loop: LoopInfo, factor: number): boolean;
}
```

### Enabled At: O2+ (not Os/Oz)

## GAP-12: Register Allocation Improvements

### Current State

The code generator uses a simple accumulator-centric model: load into A, operate, store from A. X and Y registers are underutilized.

### Improvements

1. **Loop counter in X/Y** — Use INX/DEX/INY/DEY for loop counters instead of INC/DEC mem
2. **Index variable in X/Y** — When a variable is used as an array index, keep it in X or Y
3. **Register hints** — Add hints to IL instructions suggesting preferred register

### Implementation

This is primarily an ASM-level optimization. Extend `register-tracker.ts` in the ASM optimizer to:
- Track register availability across basic blocks
- Promote hot loop counters to X/Y registers
- Use INX/DEX patterns for loop iteration

### Enabled At: O2+

## Testing Requirements

- Loop tree: nested loops, sequential loops, empty loops
- LICM: invariant loads, invariant computations, non-invariant (side effects)
- Loop unrolling: constant-count loops, unknown-count loops (skip), nested loops
- Register alloc: loop counter promotion, index variable usage
