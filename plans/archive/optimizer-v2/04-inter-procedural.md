# Inter-Procedural Optimizations: Optimizer V2

> **Document**: 04-inter-procedural.md
> **Parent**: [Index](00-index.md)
> **Gaps Covered**: GAP-3 (Dead function elim), GAP-4 (Dead global elim), GAP-5 (Single-call-site inlining), GAP-6 (Small function inlining)

## Overview

With program-level infrastructure (GAP-1) and call graph (GAP-2) in place, this phase implements the inter-procedural optimizations that operate across function boundaries.

## GAP-3: Dead Function Elimination

### Algorithm

```
1. Build call graph from ILProgram
2. BFS from entry point ("main") to find reachable set
3. Remove all functions NOT in reachable set from program.functions
4. Report removed function names in debug output
```

### Implementation: `DeadFunctionElimPass`

```typescript
// optimizer/passes/dead-function-elim.ts
export class DeadFunctionElimPass implements ProgramOptimizationPass {
  readonly name = 'dead-function-elim';
  readonly dependencies: string[] = [];

  run(program: ILProgram, options: OptimizationOptions): ProgramPassResult {
    const callGraph = CallGraph.build(program);
    const reachable = callGraph.getReachableFunctions();
    
    const before = program.functions.length;
    program.functions = program.functions.filter(f => reachable.has(f.name));
    const removed = before - program.functions.length;
    
    return { modified: removed > 0, functionsRemoved: removed, functionsModified: 0 };
  }
}
```

### Enabled At: O1+

## GAP-4: Dead Global/Constant Elimination

### Algorithm

```
1. Collect all module-level variable/constant declarations
2. Scan all reachable functions for references to these globals
3. Remove unreferenced globals from program data
```

### Implementation: `DeadGlobalElimPass`

- Scans `program.globals` (or equivalent) for unreferenced entries
- Depends on `dead-function-elim` running first (so unreachable function refs don't count)

### Enabled At: O2+

## GAP-5 + GAP-6: Function Inlining

### Strategy

| Level | Strategy | Criteria |
|-------|----------|----------|
| O1 | Single-call-site | `callGraph.getCallCount(func) === 1` — always profitable |
| O2 | Small function | `func.instructions.length <= threshold` (e.g., 20) |
| Os/Oz | No inlining | Size optimization — avoid code duplication |

### Inlining Algorithm

```
1. Build call graph
2. Find inlining candidates based on strategy
3. For each candidate (bottom-up order — leaf functions first):
   a. Find the CALL instruction(s) in the caller
   b. Replace CALL with callee's instruction body:
      - Copy callee instructions (clone, remap labels)
      - Replace RETURN with JUMP to continuation label
      - Remap slot names to avoid conflicts (prefix with callee name)
   c. Update call graph (remove inlined function if no remaining callers)
4. Run dead function elimination to clean up fully-inlined functions
```

### Implementation: `FunctionInliningPass`

```typescript
// optimizer/passes/function-inlining.ts
export class FunctionInliningPass implements ProgramOptimizationPass {
  readonly name = 'function-inline';
  readonly dependencies = ['dead-function-elim'];

  run(program: ILProgram, options: OptimizationOptions): ProgramPassResult {
    const callGraph = CallGraph.build(program);
    const candidates = this.findCandidates(program, callGraph, options);
    
    let modified = 0;
    for (const candidate of candidates) {
      if (this.inlineFunction(program, candidate, callGraph)) {
        modified++;
      }
    }
    
    return { modified: modified > 0, functionsRemoved: 0, functionsModified: modified };
  }
  
  protected findCandidates(program, callGraph, options): InlineCandidate[];
  protected inlineFunction(program, candidate, callGraph): boolean;
  protected cloneInstructions(callee: ILFunction, labelPrefix: string): ILInstruction[];
  protected remapLabels(instructions: ILInstruction[], prefix: string): void;
  protected remapSlots(instructions: ILInstruction[], prefix: string): void;
}
```

### Safety Checks

- **No recursive inlining** — skip functions that call themselves (directly or indirectly)
- **No intrinsic inlining** — skip asm functions and intrinsics
- **Size budget** — at O2, don't inline if total size increase > 20%
- **Label uniqueness** — all cloned labels get unique prefix to avoid conflicts

### 6502 Impact

- JSR = 6 cycles, 3 bytes; RTS = 6 cycles, 1 byte
- Inlining a single-call-site function saves 12 cycles and 4 bytes (net savings after removing JSR+RTS)
- Always profitable for single-call-site on 6502

## Testing Requirements

- Dead function elim: programs with 1-5 functions, varying reachability
- Dead global elim: programs with unused constants/variables
- Single-call-site inlining: `main()` → `delay()` pattern (border-cycle example)
- Small function inlining: functions of varying sizes
- Recursive function protection: ensure recursive functions are NOT inlined
- Label/slot remapping correctness after inlining
- E2E: border-cycle compiles with `-O1`, `speedy()` eliminated, `delay()` inlined
