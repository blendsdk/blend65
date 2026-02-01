# Blend Integration: Call Graph Analysis

> **Document**: blend-integration/02d-call-graph-analysis.md
> **Parent**: [02-allocator-impl.md](02-allocator-impl.md)
> **Status**: Design Complete
> **Target File**: `packages/compiler-v2/src/frame/allocator/call-graph-builder.ts`

## Overview

The call graph is the foundation of frame coalescing and recursion detection. This document details:

1. **Call Graph Construction** - Building the graph from AST
2. **Recursion Detection** - Finding recursive cycles
3. **Thread Context Analysis** - Separating main/ISR execution
4. **Overlap Detection** - Determining which functions can coalesce

---

## 1. Call Graph Data Structures

### 1.1 CallGraphNode (from 01e)

```typescript
interface CallGraphNode {
  /** Function name (module-qualified) */
  readonly functionName: string;
  
  /** Functions this function directly calls */
  readonly callees: Set<string>;
  
  /** Functions that directly call this function */
  readonly callers: Set<string>;
  
  /** All functions that could be on stack when this runs */
  readonly recursiveCallers: Set<string>;
  
  /** Is this an interrupt handler? */
  readonly isInterruptHandler: boolean;
  
  /** Thread context (main, isr, both) */
  threadContext: ThreadContext;
  
  /** Maximum call depth from any entry point */
  callDepth: number;
  
  /** Is this function part of a recursive cycle? */
  isRecursive: boolean;
}
```

### 1.2 CallGraph (from 01e)

```typescript
interface CallGraph {
  /** All function nodes */
  readonly nodes: Map<string, CallGraphNode>;
  
  /** Entry points (main, interrupt handlers) */
  readonly entryPoints: Set<string>;
  
  /** Detected recursive functions */
  readonly recursiveFunctions: Set<string>;
  
  /** Recursive cycles (each set is one cycle) */
  readonly recursiveCycles: Set<string>[];
}
```

---

## 2. Call Graph Construction

### 2.1 Algorithm Overview

```
Phase 1: Create nodes for all functions
Phase 2: Walk function bodies to find calls
Phase 3: Build reverse relationships (callers)
Phase 4: Identify entry points
```

### 2.2 Implementation

```typescript
/**
 * Build call graph from a program AST.
 */
buildCallGraph(program: Program): void {
  const nodes = new Map<string, CallGraphNode>();
  
  // === Phase 1: Create nodes for all functions ===
  for (const module of program.modules) {
    for (const decl of module.declarations) {
      if (isFunctionDeclaration(decl)) {
        const node = this.createCallGraphNode(decl);
        nodes.set(decl.name.value, node);
      }
    }
  }
  
  // === Phase 2: Find calls in each function ===
  for (const module of program.modules) {
    for (const decl of module.declarations) {
      if (isFunctionDeclaration(decl)) {
        const callerNode = nodes.get(decl.name.value)!;
        const callees = this.findCallsInBody(decl.body);
        
        for (const callee of callees) {
          // Only track calls to known functions
          if (nodes.has(callee)) {
            callerNode.callees.add(callee);
          }
          // Intrinsics and external functions are ignored
        }
      }
    }
  }
  
  // === Phase 3: Build reverse relationships ===
  for (const [name, node] of nodes) {
    for (const callee of node.callees) {
      const calleeNode = nodes.get(callee);
      if (calleeNode) {
        calleeNode.callers.add(name);
      }
    }
  }
  
  // === Phase 4: Identify entry points ===
  const entryPoints = new Set<string>();
  
  // 'main' is always an entry point
  if (nodes.has('main')) {
    entryPoints.add('main');
  }
  
  // Interrupt handlers are entry points
  for (const [name, node] of nodes) {
    if (node.isInterruptHandler) {
      entryPoints.add(name);
    }
  }
  
  // Warn if no entry points found
  if (entryPoints.size === 0) {
    this.addWarning(
      DiagnosticCodes.NO_ENTRY_POINT,
      'No entry points found (no main function or interrupt handlers).'
    );
  }
  
  // Store the call graph
  this.callGraph = {
    nodes,
    entryPoints,
    recursiveFunctions: new Set(),
    recursiveCycles: [],
  };
}

/**
 * Create a call graph node for a function declaration.
 */
protected createCallGraphNode(func: FunctionDeclaration): CallGraphNode {
  return {
    functionName: func.name.value,
    callees: new Set(),
    callers: new Set(),
    recursiveCallers: new Set(),
    isInterruptHandler: this.isInterruptHandler(func),
    threadContext: this.getInitialThreadContext(func),
    callDepth: Infinity,  // Will be calculated later
    isRecursive: false,
  };
}

/**
 * Check if a function is an interrupt handler.
 */
protected isInterruptHandler(func: FunctionDeclaration): boolean {
  // Check for 'interrupt' keyword
  if (func.isInterrupt) {
    return true;
  }
  
  // Check for @interrupt attribute
  if (func.attributes) {
    for (const attr of func.attributes) {
      if (attr.name === 'interrupt' || attr.name === 'irq' || attr.name === 'nmi') {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get initial thread context for a function.
 */
protected getInitialThreadContext(func: FunctionDeclaration): ThreadContext {
  if (this.isInterruptHandler(func)) {
    return ThreadContext.IsrOnly;
  }
  if (func.name.value === 'main') {
    return ThreadContext.MainOnly;
  }
  // Will be determined during context propagation
  return ThreadContext.MainOnly;
}
```

### 2.3 Finding Calls in Function Body

```typescript
/**
 * Walk a function body and find all call expressions.
 */
protected findCallsInBody(body: BlockStatement): Set<string> {
  const calls = new Set<string>();
  
  const walk = (node: ASTNode): void => {
    if (isCallExpression(node)) {
      // Direct function call: functionName()
      if (isIdentifier(node.callee)) {
        calls.add(node.callee.name);
      }
      // Member call: module.functionName() (future)
      else if (isMemberExpression(node.callee)) {
        // TODO: Handle qualified calls
      }
    }
    
    // Walk children
    for (const child of node.getChildren()) {
      walk(child);
    }
  };
  
  walk(body);
  return calls;
}
```

---

## 3. Recursion Detection

### 3.1 Algorithm Overview

Use DFS with three-color marking to detect back edges (cycles):

```
Colors:
  WHITE = Not visited yet
  GRAY  = Currently visiting (on DFS stack)
  BLACK = Finished visiting

Back Edge Detection:
  If we encounter a GRAY node, we found a cycle!
```

### 3.2 Implementation

```typescript
/**
 * Detect recursion in the call graph.
 * Returns array of recursive cycles found.
 */
detectRecursion(): Set<string>[] {
  if (!this.callGraph) {
    throw new Error('Call graph not built. Call buildCallGraph() first.');
  }
  
  const WHITE = 0;  // Not visited
  const GRAY = 1;   // Currently visiting (on stack)
  const BLACK = 2;  // Finished visiting
  
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const cycles: Set<string>[] = [];
  
  // Initialize all nodes as WHITE
  for (const name of this.callGraph.nodes.keys()) {
    color.set(name, WHITE);
    parent.set(name, null);
  }
  
  /**
   * DFS visit function.
   */
  const dfsVisit = (u: string): void => {
    color.set(u, GRAY);  // Mark as visiting
    
    const node = this.callGraph!.nodes.get(u)!;
    
    for (const v of node.callees) {
      if (!this.callGraph!.nodes.has(v)) continue;  // External call
      
      const vColor = color.get(v);
      
      if (vColor === WHITE) {
        // Tree edge - continue DFS
        parent.set(v, u);
        dfsVisit(v);
      } else if (vColor === GRAY) {
        // *** BACK EDGE - RECURSION DETECTED! ***
        const cycle = this.extractCycle(u, v, parent);
        cycles.push(cycle);
        
        // Mark all functions in cycle as recursive
        for (const fn of cycle) {
          this.callGraph!.recursiveFunctions.add(fn);
          this.callGraph!.nodes.get(fn)!.isRecursive = true;
        }
      }
      // BLACK = cross edge, ignore (already fully explored)
    }
    
    color.set(u, BLACK);  // Done visiting
  };
  
  // Run DFS from each entry point
  for (const entry of this.callGraph.entryPoints) {
    if (color.get(entry) === WHITE) {
      dfsVisit(entry);
    }
  }
  
  // Also check any unreachable functions
  for (const name of this.callGraph.nodes.keys()) {
    if (color.get(name) === WHITE) {
      dfsVisit(name);
    }
  }
  
  // Store cycles in call graph
  (this.callGraph as any).recursiveCycles = cycles;
  
  // Report recursion errors
  this.reportRecursionErrors(cycles);
  
  return cycles;
}

/**
 * Extract a cycle from the DFS parent chain.
 */
protected extractCycle(
  u: string,
  v: string,
  parent: Map<string, string | null>
): Set<string> {
  const cycle = new Set<string>();
  cycle.add(v);  // v is where the cycle closes
  
  // Walk back from u to v
  let current: string | null = u;
  while (current !== null && current !== v) {
    cycle.add(current);
    current = parent.get(current) ?? null;
  }
  
  return cycle;
}

/**
 * Report recursion errors with helpful messages.
 */
protected reportRecursionErrors(cycles: Set<string>[]): void {
  for (const cycle of cycles) {
    const members = Array.from(cycle);
    
    if (members.length === 1) {
      // Direct recursion: f() → f()
      this.addError(
        DiagnosticCodes.RECURSION_DETECTED,
        `Recursive call detected: '${members[0]}' calls itself.`,
        {
          functionName: members[0],
          suggestion: 'Blend65 does not support recursion. ' +
                     'Refactor to use iteration or separate functions.',
        }
      );
    } else {
      // Mutual recursion: f() → g() → f()
      const chain = [...members, members[0]].join(' → ');
      this.addError(
        DiagnosticCodes.MUTUAL_RECURSION_DETECTED,
        `Mutual recursion detected: ${chain}`,
        {
          functionName: members[0],
          suggestion: 'Blend65 does not support recursion. ' +
                     'Break the cycle by inlining or restructuring.',
        }
      );
    }
  }
}
```

---

## 4. Thread Context Propagation

### 4.1 Algorithm Overview

Thread context flows from entry points to callees:

```
main() [MainOnly] → update() → helper()
  → update() becomes MainOnly
  → helper() becomes MainOnly

irq_handler() [IsrOnly] → helper()
  → helper() becomes BOTH (called from main AND isr!)
```

### 4.2 Implementation

```typescript
/**
 * Propagate thread contexts through the call graph.
 */
protected propagateThreadContexts(): void {
  if (!this.callGraph) return;
  
  // BFS from entry points
  const queue: string[] = [...this.callGraph.entryPoints];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    
    const node = this.callGraph.nodes.get(current)!;
    
    for (const callee of node.callees) {
      const calleeNode = this.callGraph.nodes.get(callee);
      if (!calleeNode) continue;
      
      // Merge contexts
      const merged = this.mergeThreadContexts(
        calleeNode.threadContext,
        node.threadContext
      );
      
      if (merged !== calleeNode.threadContext) {
        calleeNode.threadContext = merged;
        // Re-process if context changed
        queue.push(callee);
        visited.delete(callee);
      }
    }
  }
}

/**
 * Merge two thread contexts.
 */
protected mergeThreadContexts(
  existing: ThreadContext,
  incoming: ThreadContext
): ThreadContext {
  if (existing === incoming) {
    return existing;
  }
  
  // MainOnly + IsrOnly = Both
  if ((existing === ThreadContext.MainOnly && incoming === ThreadContext.IsrOnly) ||
      (existing === ThreadContext.IsrOnly && incoming === ThreadContext.MainOnly)) {
    return ThreadContext.Both;
  }
  
  // Both + anything = Both
  return ThreadContext.Both;
}
```

---

## 5. Recursive Callers Computation

### 5.1 Algorithm Overview

For each function, compute all functions that could be on the call stack when it executes:

```
main() → game_loop() → update() → move_player()

For move_player():
  recursiveCallers = {update, game_loop, main}
```

This is used for coalescing: two functions can share memory only if neither is in the other's recursive caller set.

### 5.2 Implementation

```typescript
/**
 * Compute recursive callers for all functions.
 */
protected computeRecursiveCallers(): void {
  if (!this.callGraph) return;
  
  for (const [name, node] of this.callGraph.nodes) {
    const recursiveCallers = new Set<string>();
    
    // BFS up the caller chain
    const queue = [...node.callers];
    
    while (queue.length > 0) {
      const caller = queue.shift()!;
      if (recursiveCallers.has(caller)) continue;
      
      recursiveCallers.add(caller);
      
      // Add the caller's callers
      const callerNode = this.callGraph.nodes.get(caller);
      if (callerNode) {
        for (const grandCaller of callerNode.callers) {
          queue.push(grandCaller);
        }
      }
    }
    
    // Store result (need to cast since interface has readonly)
    (node as any).recursiveCallers = recursiveCallers;
  }
}
```

---

## 6. Call Depth Computation

### 6.1 Algorithm Overview

BFS from entry points to compute minimum call depth:

```
main() [depth=0]
  └── game_loop() [depth=1]
        ├── update() [depth=2]
        └── draw() [depth=2]
```

### 6.2 Implementation

```typescript
/**
 * Compute call depths from entry points.
 */
protected computeCallDepths(): void {
  if (!this.callGraph) return;
  
  // Initialize all depths as Infinity
  for (const node of this.callGraph.nodes.values()) {
    node.callDepth = Infinity;
  }
  
  // BFS from entry points
  const queue: Array<{ name: string; depth: number }> = [];
  
  for (const entry of this.callGraph.entryPoints) {
    const node = this.callGraph.nodes.get(entry)!;
    node.callDepth = 0;
    queue.push({ name: entry, depth: 0 });
  }
  
  while (queue.length > 0) {
    const { name, depth } = queue.shift()!;
    const node = this.callGraph.nodes.get(name)!;
    
    for (const callee of node.callees) {
      const calleeNode = this.callGraph.nodes.get(callee);
      if (!calleeNode) continue;
      
      const newDepth = depth + 1;
      if (newDepth < calleeNode.callDepth) {
        calleeNode.callDepth = newDepth;
        queue.push({ name: callee, depth: newDepth });
      }
    }
  }
  
  // Warn about deep call stacks
  this.checkCallDepthWarnings();
}

/**
 * Check for deep call stacks that might overflow hardware stack.
 */
protected checkCallDepthWarnings(): void {
  const WARNING_THRESHOLD = 16;  // 16 levels deep
  
  for (const [name, node] of this.callGraph!.nodes) {
    if (node.callDepth > WARNING_THRESHOLD) {
      this.addWarning(
        DiagnosticCodes.DEEP_CALL_STACK,
        `Function '${name}' has call depth ${node.callDepth}, ` +
        `which may risk hardware stack overflow.`,
        {
          functionName: name,
          suggestion: 'Consider flattening the call hierarchy.',
        }
      );
    }
  }
}
```

---

## 7. Overlap Detection

### 7.1 Algorithm

Two functions can overlap (execute simultaneously) if:
- One calls the other (directly or indirectly)
- Both are on the same call path from an entry point

```typescript
/**
 * Check if two functions can have overlapping execution.
 * Used for coalescing decisions.
 */
protected canOverlap(func1: string, func2: string): boolean {
  const node1 = this.callGraph?.nodes.get(func1);
  const node2 = this.callGraph?.nodes.get(func2);
  
  if (!node1 || !node2) {
    return true;  // Unknown = assume overlap for safety
  }
  
  // Check if func1 is in func2's recursive caller set
  if (node2.recursiveCallers.has(func1)) {
    return true;
  }
  
  // Check if func2 is in func1's recursive caller set
  if (node1.recursiveCallers.has(func2)) {
    return true;
  }
  
  // Check direct call relationship
  if (node1.callees.has(func2) || node2.callees.has(func1)) {
    return true;
  }
  
  return false;
}
```

---

## 8. Complete Pipeline

### 8.1 Full Build Process

```typescript
/**
 * Complete call graph building pipeline.
 * Called from FrameAllocator before frame allocation.
 */
buildCallGraph(program: Program): void {
  // Phase 1: Build direct relationships
  this.buildDirectRelationships(program);
  
  // Phase 2: Detect recursion (error if found)
  this.detectRecursion();
  
  // Phase 3: Propagate thread contexts
  this.propagateThreadContexts();
  
  // Phase 4: Compute recursive callers (for coalescing)
  this.computeRecursiveCallers();
  
  // Phase 5: Compute call depths
  this.computeCallDepths();
  
  // Report summary
  this.reportCallGraphSummary();
}

/**
 * Report call graph summary.
 */
protected reportCallGraphSummary(): void {
  if (!this.callGraph) return;
  
  const totalFunctions = this.callGraph.nodes.size;
  const entryPoints = this.callGraph.entryPoints.size;
  const recursiveFunctions = this.callGraph.recursiveFunctions.size;
  
  let mainOnlyCount = 0;
  let isrOnlyCount = 0;
  let bothCount = 0;
  
  for (const node of this.callGraph.nodes.values()) {
    switch (node.threadContext) {
      case ThreadContext.MainOnly: mainOnlyCount++; break;
      case ThreadContext.IsrOnly: isrOnlyCount++; break;
      case ThreadContext.Both: bothCount++; break;
    }
  }
  
  this.addInfo(
    DiagnosticCodes.CALL_GRAPH_SUMMARY,
    `Call graph: ${totalFunctions} functions, ${entryPoints} entry points. ` +
    `Thread contexts: ${mainOnlyCount} main, ${isrOnlyCount} ISR, ${bothCount} both.`
  );
}
```

---

## 9. Example Call Graph

```typescript
// Given program:
fn main(): void {
  game_loop();
}

fn game_loop(): void {
  update();
  draw();
}

fn update(): void {
  move_player();
}

fn draw(): void {
  draw_player();
  draw_enemies();
}

interrupt fn irq_handler(): void {
  update_timer();
  play_sound();
}

// Resulting call graph:
//
// main (entry, depth=0, MainOnly)
//   └── game_loop (depth=1, MainOnly)
//         ├── update (depth=2, MainOnly)
//         │     └── move_player (depth=3, MainOnly)
//         └── draw (depth=2, MainOnly)
//               ├── draw_player (depth=3, MainOnly)
//               └── draw_enemies (depth=3, MainOnly)
//
// irq_handler (entry, depth=0, IsrOnly)
//   ├── update_timer (depth=1, IsrOnly)
//   └── play_sound (depth=1, IsrOnly)

// Coalescing implications:
// update ↔ draw: CAN coalesce (same thread, don't call each other)
// move_player ↔ draw_player: CAN coalesce (same thread, don't call each other)
// update ↔ irq_handler: CANNOT coalesce (different threads)
```

---

## Summary

| Phase | Purpose | Output |
|-------|---------|--------|
| **Build** | Create nodes and edges | CallGraph structure |
| **Recursion** | Find cycles | Error if recursive |
| **Context** | Main vs ISR | ThreadContext per node |
| **Callers** | Transitive callers | recursiveCallers set |
| **Depth** | Call stack depth | callDepth per node |
| **Overlap** | Coalescing check | canOverlap() function |

---

**Previous Document:** [02c-zp-scoring.md](02c-zp-scoring.md)  
**Next Document:** [02-allocator-impl.md](02-allocator-impl.md)