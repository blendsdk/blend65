# Cross-File Frame Allocation: 2 Skipped Tests

> **Document**: 06-cross-file-frames.md
> **Parent**: [Index](00-index.md)

## Overview

The `FramePhase` only processes the primary module's AST, so functions defined in
other files get no frame allocation. The IL generator throws "No frame for function"
when encountering calls to cross-file functions.

## Root Cause

`FramePhase.execute()` in `pipeline/frame-phase.ts`:
1. Finds primary module via `getPrimaryModuleName()` (module with `export function main()`)
2. Gets `moduleResult.ast` for that ONE module
3. Calls `allocator.allocate(moduleResult.ast, ...)` — only primary module's functions get frames
4. Functions from imported modules are never seen by the frame allocator

## Fix: Iterate All Modules

Modify `FramePhase.execute()` to:

```typescript
// Instead of just the primary module:
const allFunctions: FunctionDecl[] = [];
for (const [moduleName, moduleResult] of semanticResult.modules) {
  const functions = this.collectFunctions(moduleResult.ast);
  allFunctions.push(...functions);
}
// Then allocate frames for ALL functions
```

**Two approaches:**

### Approach A: Merge functions before allocation (Simpler)
- Collect `FunctionDecl[]` from all module ASTs
- Pass merged list to a modified `FrameAllocator` method
- Requires adding a `allocateFromFunctions(functions, callGraph, symbolTable)` method

### Approach B: Multi-allocate then merge (More modular)
- Run `allocator.allocate(moduleResult.ast, ...)` per module
- Merge resulting frame maps
- Risk: address conflicts if frame regions overlap

**Recommended: Approach A** — simpler, no address conflicts.

## Affected Files

- `packages/compiler/src/pipeline/frame-phase.ts` — iterate all modules
- `packages/compiler/src/frame/allocator/frame-allocator.ts` — possibly add new method
- `packages/compiler/src/__tests__/e2e/pipeline/multi-module.test.ts` — write test bodies

## Test Source Patterns

```js
// File 1: utils.blend
module Utils;
export function double(x: byte): byte {
  return x + x;
}

// File 2: main.blend
module Main;
import { double } from "Utils";
export function main(): void {
  let result: byte = double(5);
}
```
