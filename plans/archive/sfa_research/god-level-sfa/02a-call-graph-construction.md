# God-Level SFA: Call Graph Construction

> **Document**: god-level-sfa/02a-call-graph-construction.md
> **Purpose**: Algorithm for building the call graph (Phase 1 of allocation)
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

The call graph is the foundation of the God-Level SFA system. It tracks which functions call which other functions, enabling:

1. **Recursion detection** - Find functions that call themselves (directly or indirectly)
2. **Frame coalescing** - Identify functions that can share memory
3. **Thread context tracking** - Separate main thread from ISR contexts

---

## 1. Call Graph Data Structures

### 1.1 CallGraphNode

Each function gets a node in the call graph:

```typescript
interface CallGraphNode {
  /** Function name (fully qualified: module.function) */
  readonly functionName: string;

  /** Direct callees - functions this function calls */
  readonly callees: Set<string>;

  /** Direct callers - functions that call this function */
  readonly callers: Set<string>;

  /** All functions that could be on the stack when this runs */
  readonly recursiveCallers: Set<string>;

  /** Is this an interrupt handler entry point? */
  readonly isInterruptHandler: boolean;

  /** Thread context (main, isr, or both) */
  threadContext: ThreadContext;

  /** Call depth from entry points */
  callDepth: number;

  /** Is this function part of a recursive cycle? */
  isRecursive: boolean;
}
```

### 1.2 CallGraph

The complete graph structure:

```typescript
interface CallGraph {
  /** All nodes by function name */
  readonly nodes: Map<string, CallGraphNode>;

  /** Entry points (main, interrupt handlers) */
  readonly entryPoints: Set<string>;

  /** Detected recursive functions */
  readonly recursiveFunctions: Set<string>;

  /** Recursive cycles (each set is a cycle) */
  readonly recursiveCycles: Set<string>[];
}
```

---

## 2. Construction Algorithm

### 2.1 Phase 1: Build Direct Relationships

**Input:** Typed AST with all function declarations

**Output:** Call graph with direct caller/callee relationships

```typescript
function buildDirectRelationships(module: ModuleDeclaration): CallGraph {
  const nodes = new Map<string, CallGraphNode>();

  // Step 1: Create nodes for all functions
  for (const decl of module.declarations) {
    if (isFunctionDeclaration(decl)) {
      nodes.set(decl.name, createCallGraphNode(decl.name, {
        isInterruptHandler: hasInterruptAttribute(decl),
      }));
    }
  }

  // Step 2: Walk each function body to find calls
  for (const decl of module.declarations) {
    if (isFunctionDeclaration(decl)) {
      const node = nodes.get(decl.name)!;
      const callees = findCallsInBody(decl.body);

      for (const callee of callees) {
        if (nodes.has(callee)) {
          // Add to callees set
          node.callees.add(callee);
          // Add reverse relationship
          nodes.get(callee)!.callers.add(decl.name);
        }
        // External/intrinsic calls are ignored
      }
    }
  }

  // Step 3: Identify entry points
  const entryPoints = new Set<string>();
  entryPoints.add('main'); // Main is always an entry point

  for (const [name, node] of nodes) {
    if (node.isInterruptHandler) {
      entryPoints.add(name);
    }
  }

  return {
    nodes,
    entryPoints,
    recursiveFunctions: new Set(),
    recursiveCycles: [],
  };
}
```

### 2.2 Finding Calls in Function Body

```typescript
function findCallsInBody(body: BlockStatement): Set<string> {
  const calls = new Set<string>();

  function walk(node: ASTNode): void {
    if (isCallExpression(node)) {
      // Direct function call
      if (isIdentifier(node.callee)) {
        calls.add(node.callee.name);
      }
      // Method call (future: obj.method())
      // Indirect call (future: fnPtr())
    }

    // Recursively walk children
    for (const child of node.getChildren()) {
      walk(child);
    }
  }

  walk(body);
  return calls;
}
```

---

## 3. Recursion Detection

### 3.1 The Algorithm (DFS with Cycle Detection)

```typescript
function detectRecursion(graph: CallGraph): void {
  const WHITE = 0; // Not visited
  const GRAY = 1;  // Currently visiting (on stack)
  const BLACK = 2; // Finished visiting

  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  // Initialize all nodes as WHITE
  for (const name of graph.nodes.keys()) {
    color.set(name, WHITE);
    parent.set(name, null);
  }

  // DFS from each entry point
  for (const entry of graph.entryPoints) {
    if (color.get(entry) === WHITE) {
      dfsVisit(entry);
    }
  }

  function dfsVisit(u: string): void {
    color.set(u, GRAY); // Mark as being visited
    const node = graph.nodes.get(u)!;

    for (const v of node.callees) {
      if (!graph.nodes.has(v)) continue; // External call

      if (color.get(v) === WHITE) {
        // Tree edge - continue DFS
        parent.set(v, u);
        dfsVisit(v);
      } else if (color.get(v) === GRAY) {
        // BACK EDGE - RECURSION DETECTED!
        const cycle = extractCycle(u, v, parent);
        graph.recursiveCycles.push(cycle);

        // Mark all functions in cycle as recursive
        for (const fn of cycle) {
          graph.recursiveFunctions.add(fn);
          graph.nodes.get(fn)!.isRecursive = true;
        }
      }
      // BLACK = cross edge, ignore
    }

    color.set(u, BLACK); // Done visiting
  }
}

function extractCycle(u: string, v: string, parent: Map<string, string | null>): Set<string> {
  const cycle = new Set<string>();
  cycle.add(v);

  let current: string | null = u;
  while (current !== null && current !== v) {
    cycle.add(current);
    current = parent.get(current) ?? null;
  }

  return cycle;
}
```

### 3.2 Direct vs Mutual Recursion

```
Direct Recursion:
  fn factorial(n) → factorial(n-1)
  Cycle: {factorial}

Mutual Recursion:
  fn isEven(n) → isOdd(n-1)
  fn isOdd(n) → isEven(n-1)
  Cycle: {isEven, isOdd}

Triple Cycle:
  fn a() → b()
  fn b() → c()
  fn c() → a()
  Cycle: {a, b, c}
```

### 3.3 Error Reporting

```typescript
function reportRecursionErrors(graph: CallGraph): RecursionError[] {
  const errors: RecursionError[] = [];

  for (const cycle of graph.recursiveCycles) {
    const members = Array.from(cycle);

    if (members.length === 1) {
      // Direct recursion
      errors.push({
        type: 'direct',
        functionName: members[0],
        callChain: [members[0], members[0]],
        message: `Recursive call detected: '${members[0]}' calls itself.\n` +
                 `Use 'recursive fn ${members[0]}' if recursion is intended.`,
      });
    } else {
      // Mutual recursion
      const chain = [...members, members[0]]; // Close the cycle
      errors.push({
        type: 'mutual',
        functionName: members[0],
        callChain: chain,
        message: `Mutual recursion detected: ${chain.join(' → ')}\n` +
                 `Use 'recursive fn' for all functions in the cycle.`,
      });
    }
  }

  return errors;
}
```

---

## 4. Thread Context Analysis

### 4.1 Why Thread Context Matters

```
Main Thread:              ISR Thread:
  main()                    irq_handler()
    ↓                          ↓
  update()                  update_timer()
    ↓                          ↓
  draw()                    play_sound()

If update() is called ONLY from main:
  → Its frame CAN be coalesced with ISR functions

If update() is called from BOTH:
  → Its frame CANNOT be coalesced (could corrupt!)
```

### 4.2 Propagation Algorithm

```typescript
function analyzeThreadContexts(graph: CallGraph): void {
  // Step 1: Mark entry points
  for (const entry of graph.entryPoints) {
    const node = graph.nodes.get(entry)!;

    if (node.isInterruptHandler) {
      node.threadContext = ThreadContext.IsrOnly;
    } else if (entry === 'main') {
      node.threadContext = ThreadContext.MainOnly;
    }
  }

  // Step 2: Propagate contexts to callees (BFS)
  const queue: string[] = [...graph.entryPoints];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = graph.nodes.get(current)!;

    for (const callee of node.callees) {
      const calleeNode = graph.nodes.get(callee);
      if (!calleeNode) continue;

      // Merge contexts
      const merged = mergeContexts(calleeNode.threadContext, node.threadContext);
      if (merged !== calleeNode.threadContext) {
        calleeNode.threadContext = merged;
        queue.push(callee); // Re-process if context changed
      }
    }
  }
}

function mergeContexts(existing: ThreadContext, incoming: ThreadContext): ThreadContext {
  if (existing === incoming) return existing;

  if (existing === ThreadContext.MainOnly && incoming === ThreadContext.IsrOnly) {
    return ThreadContext.Both;
  }
  if (existing === ThreadContext.IsrOnly && incoming === ThreadContext.MainOnly) {
    return ThreadContext.Both;
  }

  // Both + anything = Both
  return ThreadContext.Both;
}
```

---

## 5. Computing Recursive Callers

### 5.1 Why Needed

The recursive callers set tells us: "Which functions could be on the call stack when this function runs?"

This is essential for coalescing: **Two functions can share memory only if neither is in the other's recursive caller set.**

### 5.2 Algorithm

```typescript
function computeRecursiveCallers(graph: CallGraph): void {
  // For each function, compute all possible callers (transitive closure)
  for (const [name, node] of graph.nodes) {
    const recursiveCallers = new Set<string>();

    // BFS/DFS up the caller chain
    const queue = [...node.callers];
    while (queue.length > 0) {
      const caller = queue.shift()!;
      if (recursiveCallers.has(caller)) continue;

      recursiveCallers.add(caller);

      // Add the caller's callers
      const callerNode = graph.nodes.get(caller);
      if (callerNode) {
        for (const grandCaller of callerNode.callers) {
          queue.push(grandCaller);
        }
      }
    }

    // Store result
    (node as any).recursiveCallers = recursiveCallers;
  }
}
```

---

## 6. Call Depth Calculation

### 6.1 Purpose

Call depth helps prioritize allocation order and detect deep call stacks that might overflow the hardware stack.

### 6.2 Algorithm

```typescript
function computeCallDepths(graph: CallGraph): void {
  // BFS from entry points
  for (const [name, node] of graph.nodes) {
    node.callDepth = Infinity; // Initialize as unreachable
  }

  const queue: Array<{ name: string; depth: number }> = [];

  // Entry points are at depth 0
  for (const entry of graph.entryPoints) {
    graph.nodes.get(entry)!.callDepth = 0;
    queue.push({ name: entry, depth: 0 });
  }

  while (queue.length > 0) {
    const { name, depth } = queue.shift()!;
    const node = graph.nodes.get(name)!;

    for (const callee of node.callees) {
      const calleeNode = graph.nodes.get(callee);
      if (!calleeNode) continue;

      const newDepth = depth + 1;
      if (newDepth < calleeNode.callDepth) {
        calleeNode.callDepth = newDepth;
        queue.push({ name: callee, depth: newDepth });
      }
    }
  }
}
```

### 6.3 Depth Warnings

```typescript
function checkCallDepth(graph: CallGraph, config: FrameAllocatorConfig): AllocationDiagnostic[] {
  const diagnostics: AllocationDiagnostic[] = [];

  for (const [name, node] of graph.nodes) {
    if (node.callDepth > config.callDepthWarningThreshold) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        code: DiagnosticCodes.DEEP_CALL_STACK,
        message: `Function '${name}' has call depth ${node.callDepth}, ` +
                 `which may risk hardware stack overflow.`,
        functionName: name,
        suggestion: `Consider flattening the call hierarchy or using tail-call optimization.`,
      });
    }
  }

  return diagnostics;
}
```

---

## 7. Complete Construction Pipeline

```typescript
function buildCallGraph(module: ModuleDeclaration, config: FrameAllocatorConfig): CallGraphResult {
  // Phase 1: Build direct relationships
  const graph = buildDirectRelationships(module);

  // Phase 2: Detect recursion
  detectRecursion(graph);

  // Phase 3: Compute thread contexts
  analyzeThreadContexts(graph);

  // Phase 4: Compute recursive callers (for coalescing)
  computeRecursiveCallers(graph);

  // Phase 5: Compute call depths
  computeCallDepths(graph);

  // Phase 6: Generate diagnostics
  const diagnostics: AllocationDiagnostic[] = [];

  // Report recursion errors (unless recursive fn keyword used)
  const recursionErrors = reportRecursionErrors(graph);
  for (const error of recursionErrors) {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      code: DiagnosticCodes.RECURSION_DETECTED,
      message: error.message,
      functionName: error.functionName,
    });
  }

  // Report deep call stacks
  diagnostics.push(...checkCallDepth(graph, config));

  return {
    graph,
    diagnostics,
    hasErrors: diagnostics.some(d => d.severity === DiagnosticSeverity.Error),
  };
}
```

---

## 8. Example

### Input Program

```
fn main() {
    game_loop();
}

fn game_loop() {
    update();
    draw();
}

fn update() {
    move_player();
}

fn draw() {
    draw_player();
    draw_enemies();
}

interrupt fn irq_handler() {
    update_timer();
    play_sound();
}
```

### Resulting Call Graph

```
main (entry, depth=0, main-only)
  └── game_loop (depth=1, main-only)
        ├── update (depth=2, main-only)
        │     └── move_player (depth=3, main-only)
        └── draw (depth=2, main-only)
              ├── draw_player (depth=3, main-only)
              └── draw_enemies (depth=3, main-only)

irq_handler (entry, depth=0, isr-only)
  ├── update_timer (depth=1, isr-only)
  └── play_sound (depth=1, isr-only)
```

### Coalescing Implications

| Function A | Function B | Can Coalesce? | Reason |
|------------|------------|---------------|--------|
| update | draw | ✅ Yes | Same thread, don't call each other |
| move_player | draw_player | ✅ Yes | Same thread, don't call each other |
| update | irq_handler | ❌ No | Different threads |
| play_sound | move_player | ❌ No | Different threads |

---

## Summary

| Phase | Purpose | Output |
|-------|---------|--------|
| 1. Direct relationships | Build caller/callee edges | `callees`, `callers` sets |
| 2. Recursion detection | Find cycles | `isRecursive`, `recursiveCycles` |
| 3. Thread contexts | Separate main/ISR | `threadContext` |
| 4. Recursive callers | Enable coalescing | `recursiveCallers` set |
| 5. Call depths | Detect deep stacks | `callDepth` |
| 6. Diagnostics | Report errors/warnings | Error/warning list |

---

**Previous Document:** [01-data-structures.md](01-data-structures.md)  
**Next Document:** [02b-frame-size-calculation.md](02b-frame-size-calculation.md)