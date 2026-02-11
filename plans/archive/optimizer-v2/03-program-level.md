# Program-Level Infrastructure: Optimizer V2

> **Document**: 03-program-level.md
> **Parent**: [Index](00-index.md)
> **Gaps Covered**: GAP-1 (Program-level pass infrastructure), GAP-2 (Call graph analysis)

## Overview

The existing optimizer only operates at the function level. This document specifies the infrastructure needed for program-level optimization: a new pass interface and call graph analysis.

## Architecture

### Current Architecture

```
ILOptimizer.optimizeProgram(program)
  → for each func in program.functions:
      → PassManager.optimize(func)  // function-scope only
```

### Proposed Architecture

```
ILOptimizer.optimizeProgram(program)
  → Run pre-function program passes (dead function elim, etc.)
  → for each func in program.functions:
      → PassManager.optimize(func)  // existing function passes
  → Run post-function program passes (if any)
```

## GAP-1: ProgramOptimizationPass Interface

### New Interface

```typescript
// In optimizer/pass.ts

/**
 * Interface for program-level optimization passes.
 *
 * Unlike OptimizationPass which operates on a single ILFunction,
 * ProgramOptimizationPass operates on the entire ILProgram and can
 * add, remove, or modify functions.
 */
export interface ProgramOptimizationPass {
  /** Unique pass name */
  readonly name: string;

  /** Pass dependencies (other program pass names) */
  readonly dependencies: string[];

  /** Run the pass on the entire program */
  run(program: ILProgram, options: OptimizationOptions): ProgramPassResult;
}

export interface ProgramPassResult {
  modified: boolean;
  functionsRemoved: number;
  functionsModified: number;
  debugInfo?: string[];
}
```

### ILOptimizer Changes

```typescript
// In il-optimizer.ts — add to ILOptimizer class

protected programPasses: ProgramOptimizationPass[] = [];

registerProgramPass(pass: ProgramOptimizationPass): void {
  this.programPasses.push(pass);
}

// Modify optimizeProgram() to run program passes first
optimizeProgram(program: ILProgram): ILProgram {
  // Phase 1: Program-level passes (dead function elim, inlining)
  for (const pass of this.programPasses) {
    pass.run(program, this.passManager.getOptions());
  }
  
  // Phase 2: Function-level passes (existing behavior)
  for (const func of program.functions) {
    this.passManager.optimize(func);
  }
  
  return program;
}
```

### Options Changes

```typescript
// In options.ts — add program passes to LEVEL_PASSES

// New: program-level pass config
const PROGRAM_LEVEL_PASSES: Record<OptimizationLevel, string[]> = {
  O0: [],
  O1: ['dead-function-elim', 'single-site-inline'],
  O2: ['dead-function-elim', 'dead-global-elim', 'function-inline'],
  O3: ['dead-function-elim', 'dead-global-elim', 'function-inline'],
  Os: ['dead-function-elim', 'dead-global-elim'],
  Oz: ['dead-function-elim', 'dead-global-elim'],
};
```

## GAP-2: Call Graph Analysis

### CallGraph Class

```typescript
// optimizer/analysis/call-graph.ts

/**
 * Call graph for inter-procedural analysis.
 *
 * Builds a directed graph where nodes are functions and edges are calls.
 * Supports reachability analysis and call counting.
 */
export class CallGraph {
  /** Map from function name to set of functions it calls */
  protected callees: Map<string, Set<string>>;
  
  /** Map from function name to set of functions that call it */
  protected callers: Map<string, Set<string>>;
  
  /** Map from function name to number of call sites */
  protected callCounts: Map<string, number>;
  
  /** Entry point function name */
  protected entryPoint: string;

  /** Build call graph from ILProgram */
  static build(program: ILProgram): CallGraph;

  /** Is this function reachable from the entry point? */
  isReachable(funcName: string): boolean;

  /** Get number of call sites for this function */
  getCallCount(funcName: string): number;

  /** Get functions that call this function */
  getCallers(funcName: string): Set<string>;

  /** Get functions called by this function */
  getCallees(funcName: string): Set<string>;

  /** Get all reachable function names (BFS from entry) */
  getReachableFunctions(): Set<string>;

  /** Rebuild after inlining modifies the program */
  rebuild(program: ILProgram): void;
}
```

### Build Algorithm

1. Iterate all `ILFunction`s in program
2. For each function, scan instructions for `CALL` opcodes
3. Extract callee name from CALL operand
4. Record caller→callee and callee→caller edges
5. Count call sites per callee
6. BFS from entry point to compute reachability

## Testing Requirements

- Unit tests for `ProgramOptimizationPass` registration and execution
- Unit tests for `CallGraph.build()` — simple, multi-function, recursive
- Unit tests for reachability queries
- Unit tests for call counting
- Integration test: program pass runs before function passes
- Edge cases: recursive functions, unused functions, single-function programs

## Error Handling

| Error Case | Handling Strategy |
|-----------|-------------------|
| No entry point function | Skip program passes, warn in debug mode |
| Recursive call graph | Mark all recursive functions as reachable |
| Empty program | Return empty results, no crash |
