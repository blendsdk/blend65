# God-Level SFA: Frame Coalescing Algorithm

> **Document**: god-level-sfa/04b-coalescing-algorithm.md
> **Purpose**: Implementation of the frame coalescing algorithm
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

This document provides the complete **implementation** of the frame coalescing algorithm, building on the theory from [04a-coalescing-theory.md](04a-coalescing-theory.md).

---

## 1. Algorithm Phases

```
Phase 1: Build Call Graph
         ↓
Phase 2: Compute Recursive Callers
         ↓
Phase 3: Determine Thread Contexts
         ↓
Phase 4: Build Coalesce Groups
         ↓
Phase 5: Assign Group Addresses
         ↓
Phase 6: Map Functions to Groups
```

---

## 2. Phase 1: Build Call Graph

### 2.1 Call Graph Structure

```typescript
interface CallGraphNode {
  /** Function name (fully qualified) */
  functionName: string;
  
  /** Functions this function calls directly */
  callees: Set<string>;
  
  /** Functions that call this function directly */
  callers: Set<string>;
  
  /** Is this an entry point (main, interrupt)? */
  isEntryPoint: boolean;
  
  /** Is this an interrupt handler? */
  isInterruptHandler: boolean;
}

interface CallGraph {
  nodes: Map<string, CallGraphNode>;
  entryPoints: Set<string>;
}
```

### 2.2 Building the Graph

```typescript
function buildCallGraph(module: ModuleDeclaration): CallGraph {
  const nodes = new Map<string, CallGraphNode>();
  const entryPoints = new Set<string>();

  // Phase 1a: Create nodes for all functions
  for (const decl of module.declarations) {
    if (isFunctionDeclaration(decl)) {
      const node: CallGraphNode = {
        functionName: decl.name,
        callees: new Set(),
        callers: new Set(),
        isEntryPoint: decl.name === 'main' || decl.isInterrupt,
        isInterruptHandler: decl.isInterrupt ?? false,
      };
      nodes.set(decl.name, node);

      if (node.isEntryPoint) {
        entryPoints.add(decl.name);
      }
    }
  }

  // Phase 1b: Populate callees by walking function bodies
  for (const decl of module.declarations) {
    if (isFunctionDeclaration(decl)) {
      const caller = nodes.get(decl.name)!;
      
      // Walk the function body to find all call expressions
      walkCalls(decl.body, (calleeName) => {
        if (nodes.has(calleeName)) {
          caller.callees.add(calleeName);
          nodes.get(calleeName)!.callers.add(decl.name);
        }
      });
    }
  }

  return { nodes, entryPoints };
}

/**
 * Walk an AST node and invoke callback for each call expression.
 */
function walkCalls(
  node: ASTNode,
  onCall: (functionName: string) => void
): void {
  if (isCallExpression(node)) {
    // Extract function name from call target
    if (isIdentifier(node.callee)) {
      onCall(node.callee.name);
    }
  }

  // Recurse into children
  for (const child of getChildren(node)) {
    walkCalls(child, onCall);
  }
}
```

---

## 3. Phase 2: Compute Recursive Callers

### 3.1 Definition Reminder

`recursiveCallers(F)` = All functions that could be active when F executes

### 3.2 Algorithm

```typescript
/**
 * Compute recursive callers for all functions.
 * Uses a fixed-point iteration approach.
 */
function computeRecursiveCallers(
  graph: CallGraph
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  // Initialize with direct callers
  for (const [name, node] of graph.nodes) {
    result.set(name, new Set(node.callers));
  }

  // Fixed-point iteration
  let changed = true;
  while (changed) {
    changed = false;

    for (const [funcName, callers] of result) {
      const node = graph.nodes.get(funcName)!;
      
      // For each direct caller, add their recursive callers too
      for (const directCaller of node.callers) {
        const callersOfCaller = result.get(directCaller)!;
        
        for (const transitiveCaller of callersOfCaller) {
          if (!callers.has(transitiveCaller)) {
            callers.add(transitiveCaller);
            changed = true;
          }
        }
      }
    }
  }

  return result;
}
```

### 3.3 Example

```
Call graph:
  main → A → C
  main → B → C

Computing recursiveCallers:

Initial (direct callers):
  main: {}
  A: {main}
  B: {main}
  C: {A, B}

After iteration 1:
  main: {}
  A: {main}
  B: {main}
  C: {A, B, main}  ← main added (caller of A and B)

Converged!

Result:
  When C runs, main, A, or B could be on the stack.
```

---

## 4. Phase 3: Determine Thread Contexts

### 4.1 Algorithm

```typescript
/**
 * Determine thread context for all functions.
 */
function computeThreadContexts(
  graph: CallGraph
): Map<string, ThreadContext> {
  const contexts = new Map<string, ThreadContext>();

  // Initialize: unknown context
  for (const name of graph.nodes.keys()) {
    contexts.set(name, undefined as any); // Will be computed
  }

  // Compute reachability from main
  const reachableFromMain = computeReachable(graph, 'main');

  // Compute reachability from each interrupt handler
  const reachableFromIsr = new Set<string>();
  for (const entry of graph.entryPoints) {
    const node = graph.nodes.get(entry)!;
    if (node.isInterruptHandler) {
      for (const fn of computeReachable(graph, entry)) {
        reachableFromIsr.add(fn);
      }
    }
  }

  // Assign contexts
  for (const name of graph.nodes.keys()) {
    const fromMain = reachableFromMain.has(name) || name === 'main';
    const fromIsr = reachableFromIsr.has(name);

    if (fromMain && fromIsr) {
      contexts.set(name, ThreadContext.Both);
    } else if (fromIsr) {
      contexts.set(name, ThreadContext.IsrOnly);
    } else {
      contexts.set(name, ThreadContext.MainOnly);
    }
  }

  return contexts;
}

/**
 * Compute all functions reachable from a starting function.
 */
function computeReachable(
  graph: CallGraph,
  start: string
): Set<string> {
  const reachable = new Set<string>();
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop()!;
    
    if (reachable.has(current)) continue;
    reachable.add(current);

    const node = graph.nodes.get(current);
    if (node) {
      for (const callee of node.callees) {
        if (!reachable.has(callee)) {
          stack.push(callee);
        }
      }
    }
  }

  return reachable;
}
```

---

## 5. Phase 4: Build Coalesce Groups

### 5.1 Group Building Algorithm

```typescript
interface CoalesceGroup {
  groupId: number;
  members: Set<string>;
  maxFrameSize: number;
  threadContext: ThreadContext;
  baseAddress: number;
}

/**
 * Build coalesce groups using greedy assignment.
 */
function buildCoalesceGroups(
  graph: CallGraph,
  recursiveCallers: Map<string, Set<string>>,
  threadContexts: Map<string, ThreadContext>,
  frameSizes: Map<string, number>,
  recursiveFunctions: Set<string>
): CoalesceGroup[] {
  const groups: CoalesceGroup[] = [];
  const assigned = new Set<string>();
  let nextGroupId = 0;

  // Sort functions by frame size (largest first for better packing)
  const sortedFuncs = Array.from(frameSizes.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  for (const funcName of sortedFuncs) {
    if (assigned.has(funcName)) continue;

    const frameSize = frameSizes.get(funcName)!;
    const context = threadContexts.get(funcName)!;
    const isRecursive = recursiveFunctions.has(funcName);

    // Recursive functions get their own singleton group
    if (isRecursive) {
      groups.push({
        groupId: nextGroupId++,
        members: new Set([funcName]),
        maxFrameSize: frameSize,
        threadContext: context,
        baseAddress: 0,
      });
      assigned.add(funcName);
      continue;
    }

    // Try to find an existing group to join
    let foundGroup: CoalesceGroup | null = null;

    for (const group of groups) {
      if (canJoinGroup(
        funcName, context, group, 
        recursiveCallers, threadContexts, recursiveFunctions
      )) {
        foundGroup = group;
        break;
      }
    }

    if (foundGroup) {
      // Join existing group
      foundGroup.members.add(funcName);
      foundGroup.maxFrameSize = Math.max(foundGroup.maxFrameSize, frameSize);
    } else {
      // Create new group
      groups.push({
        groupId: nextGroupId++,
        members: new Set([funcName]),
        maxFrameSize: frameSize,
        threadContext: context,
        baseAddress: 0,
      });
    }

    assigned.add(funcName);
  }

  return groups;
}
```

### 5.2 Can Join Group Check

```typescript
/**
 * Check if a function can join an existing coalesce group.
 */
function canJoinGroup(
  funcName: string,
  funcContext: ThreadContext,
  group: CoalesceGroup,
  recursiveCallers: Map<string, Set<string>>,
  threadContexts: Map<string, ThreadContext>,
  recursiveFunctions: Set<string>
): boolean {
  // Rule 1: Same thread context
  if (funcContext !== group.threadContext) {
    return false;
  }

  // Rule 2: Functions with Both context cannot coalesce
  if (funcContext === ThreadContext.Both) {
    return false;
  }

  // Rule 3: Not recursive
  if (recursiveFunctions.has(funcName)) {
    return false;
  }

  // Rule 4: No overlap with any existing group member
  const funcCallers = recursiveCallers.get(funcName) ?? new Set();

  for (const existingMember of group.members) {
    // Check if funcName could be on stack when existingMember runs
    const memberCallers = recursiveCallers.get(existingMember) ?? new Set();
    
    if (memberCallers.has(funcName) || funcCallers.has(existingMember)) {
      return false; // They overlap
    }

    // Also check direct call relationship (belt and suspenders)
    // This should be covered by recursive callers, but be safe
  }

  return true;
}
```

---

## 6. Phase 5: Assign Group Addresses

### 6.1 Linear Assignment

```typescript
interface AddressAssignmentResult {
  groups: CoalesceGroup[];
  totalUsed: number;
  hasOverflow: boolean;
}

/**
 * Assign base addresses to each coalesce group.
 */
function assignGroupAddresses(
  groups: CoalesceGroup[],
  config: FrameAllocatorConfig
): AddressAssignmentResult {
  let currentAddress = config.platform.frameRegionStart;
  let hasOverflow = false;

  // Sort by size (largest first) for potential future optimizations
  // (In practice, order doesn't matter for linear assignment)
  const sortedGroups = [...groups].sort((a, b) => 
    b.maxFrameSize - a.maxFrameSize
  );

  for (const group of sortedGroups) {
    // Check for overflow
    if (currentAddress + group.maxFrameSize > config.platform.frameRegionEnd) {
      hasOverflow = true;
      // Continue assigning anyway for diagnostic purposes
    }

    group.baseAddress = currentAddress;
    currentAddress += group.maxFrameSize;

    // Apply alignment if needed
    if (config.platform.alignment > 1) {
      const misalignment = currentAddress % config.platform.alignment;
      if (misalignment !== 0) {
        currentAddress += config.platform.alignment - misalignment;
      }
    }
  }

  return {
    groups: sortedGroups,
    totalUsed: currentAddress - config.platform.frameRegionStart,
    hasOverflow,
  };
}
```

---

## 7. Phase 6: Map Functions to Groups

### 7.1 Final Frame Map Construction

```typescript
interface FunctionFrameInfo {
  functionName: string;
  coalesceGroupId: number;
  frameBaseAddress: number;
  frameSize: number;
  threadContext: ThreadContext;
}

/**
 * Create final mapping from functions to their frame info.
 */
function buildFunctionFrameMap(
  groups: CoalesceGroup[],
  frameSizes: Map<string, number>
): Map<string, FunctionFrameInfo> {
  const result = new Map<string, FunctionFrameInfo>();

  for (const group of groups) {
    for (const funcName of group.members) {
      result.set(funcName, {
        functionName: funcName,
        coalesceGroupId: group.groupId,
        frameBaseAddress: group.baseAddress,
        frameSize: frameSizes.get(funcName)!,
        threadContext: group.threadContext,
      });
    }
  }

  return result;
}
```

---

## 8. Complete Pipeline

```typescript
/**
 * Main entry point for frame coalescing.
 */
function performFrameCoalescing(
  module: ModuleDeclaration,
  frameSizes: Map<string, number>,
  recursiveFunctions: Set<string>,
  config: FrameAllocatorConfig
): CoalesceResult {
  const diagnostics: AllocationDiagnostic[] = [];

  // Phase 1: Build call graph
  const callGraph = buildCallGraph(module);

  // Phase 2: Compute recursive callers
  const recursiveCallers = computeRecursiveCallers(callGraph);

  // Phase 3: Determine thread contexts
  const threadContexts = computeThreadContexts(callGraph);

  // Phase 4: Build coalesce groups
  const groups = buildCoalesceGroups(
    callGraph,
    recursiveCallers,
    threadContexts,
    frameSizes,
    recursiveFunctions
  );

  // Phase 5: Assign addresses
  const addressResult = assignGroupAddresses(groups, config);

  if (addressResult.hasOverflow) {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      code: DiagnosticCodes.FRAME_OVERFLOW,
      message: `Frame region overflow: needed ${addressResult.totalUsed} bytes, ` +
               `available ${config.platform.frameRegionSize} bytes.`,
      suggestion: 'Reduce local variable usage or enable more aggressive coalescing.',
    });
  }

  // Phase 6: Build frame map
  const frameMap = buildFunctionFrameMap(groups, frameSizes);

  // Calculate savings
  const rawSize = Array.from(frameSizes.values()).reduce((a, b) => a + b, 0);
  const coalescedSize = addressResult.totalUsed;
  const savings = rawSize - coalescedSize;
  const efficiency = rawSize > 0 ? (savings / rawSize) * 100 : 0;

  if (savings > 0) {
    diagnostics.push({
      severity: DiagnosticSeverity.Info,
      code: DiagnosticCodes.COALESCING_SAVED,
      message: `Frame coalescing saved ${savings} bytes (${efficiency.toFixed(1)}% reduction).`,
    });
  }

  return {
    groups: addressResult.groups,
    frameMap,
    stats: {
      rawSize,
      coalescedSize,
      savings,
      efficiency,
      groupCount: groups.length,
      functionCount: frameSizes.size,
    },
    diagnostics,
    hasErrors: addressResult.hasOverflow,
  };
}
```

---

## 9. Optimization: Better Group Packing

### 9.1 First-Fit vs Best-Fit

The basic algorithm uses **first-fit**: each function joins the first compatible group.

For better packing, use **best-fit**: find the group where adding this function wastes the least space.

```typescript
function findBestGroup(
  funcName: string,
  frameSize: number,
  groups: CoalesceGroup[],
  /* other params */
): CoalesceGroup | null {
  let bestGroup: CoalesceGroup | null = null;
  let bestWaste = Infinity;

  for (const group of groups) {
    if (!canJoinGroup(funcName, /* ... */)) continue;

    // Calculate waste: how much bigger would the group get?
    const currentMax = group.maxFrameSize;
    const newMax = Math.max(currentMax, frameSize);
    const waste = newMax - currentMax;

    if (waste < bestWaste) {
      bestWaste = waste;
      bestGroup = group;
    }
  }

  return bestGroup;
}
```

### 9.2 When to Use

- **First-fit:** Faster, good enough for most programs
- **Best-fit:** Slightly better packing, useful for tight memory constraints

---

## 10. Summary

### Algorithm Complexity

| Phase | Complexity | Notes |
|-------|------------|-------|
| Build call graph | O(F × B) | F = functions, B = body size |
| Recursive callers | O(F² × E) | E = edges, fixed-point |
| Thread contexts | O(F + E) | Simple DFS |
| Build groups | O(F² × G) | G = max group size |
| Assign addresses | O(G) | Linear |
| Build frame map | O(F) | Linear |

**Overall:** O(F² × E) dominated by recursive caller computation.

### Key Implementation Points

1. **Fixed-point iteration** for recursive callers
2. **Greedy group assignment** (first-fit or best-fit)
3. **Thread context propagation** via DFS reachability
4. **Singleton groups** for recursive functions
5. **Linear address assignment** after grouping

---

**Previous Document:** [04a-coalescing-theory.md](04a-coalescing-theory.md)  
**Next Document:** [04c-coalescing-examples.md](04c-coalescing-examples.md)