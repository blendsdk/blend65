# Recursion Handling

> **Document**: god-level-sfa/05-recursion-handling.md
> **Purpose**: Complete recursion detection and handling strategy
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

Blend65's SFA uses **static-only allocation by default** to achieve maximum performance. Recursion breaks static allocation because the same function needs multiple frame instances. This document defines how Blend65 detects, reports, and handles recursion.

---

## 1. Design Philosophy

### 1.1 Core Principle: Static by Default

```
┌─────────────────────────────────────────────────────────┐
│ BLEND65 PRINCIPLE: Recursion is EXCEPTIONAL, not normal │
└─────────────────────────────────────────────────────────┘
```

**Why?**
- 6502 hardware stack is only 256 bytes
- Runtime stack allocation is expensive (50-80 cycles/call)
- Static allocation enables frame coalescing (30-60% memory savings)
- Most 6502 programs don't need recursion

### 1.2 User Explicitness Required

Recursion must be **explicitly requested** by the user. This ensures:
1. User understands the performance implications
2. Compiler can optimize non-recursive paths
3. No accidental recursion goes unnoticed

```blend
// This will ERROR - recursion not explicitly allowed
fn factorial(n: byte): word {
    if (n <= 1) return 1;
    return n * factorial(n - 1);  // ERROR!
}

// This is ALLOWED - user explicitly requests recursion
recursive fn factorial(n: byte): word {
    if (n <= 1) return 1;
    return n * factorial(n - 1);  // OK
}
```

---

## 2. Recursion Detection Algorithm

### 2.1 Algorithm Overview

```
┌─────────────────────────────────────────────────────┐
│             RECURSION DETECTION PIPELINE            │
├─────────────────────────────────────────────────────┤
│  1. Build Call Graph (all edges from all modules)   │
│                        ↓                            │
│  2. Find Strongly Connected Components (SCC)        │
│                        ↓                            │
│  3. For each SCC with >1 member OR self-edge:       │
│     → This is a recursive cycle                     │
│                        ↓                            │
│  4. Check if ALL functions in cycle are 'recursive' │
│     → YES: Allow, use stack allocation              │
│     → NO: Error with full cycle information         │
└─────────────────────────────────────────────────────┘
```

### 2.2 Self-Recursion Detection (Direct)

**Pattern:**
```
fn A() { A(); }  // A calls itself
```

**Detection:**
```typescript
interface RecursionDetector {
    /**
     * Detect self-recursive functions.
     * O(V) where V = number of functions.
     */
    detectSelfRecursion(callGraph: CallGraph): SelfRecursion[];
}

interface SelfRecursion {
    function: FunctionSymbol;
    callSites: SourceLocation[];  // Where self-calls occur
}

function detectSelfRecursion(graph: CallGraph): SelfRecursion[] {
    const results: SelfRecursion[] = [];
    
    for (const node of graph.nodes) {
        // Check if function calls itself
        const selfEdge = node.callees.find(c => c.callee === node.function);
        if (selfEdge) {
            results.push({
                function: node.function,
                callSites: selfEdge.callSites
            });
        }
    }
    
    return results;
}
```

### 2.3 Mutual Recursion Detection (Indirect)

**Pattern:**
```
fn A() { B(); }
fn B() { C(); }
fn C() { A(); }  // Cycle: A → B → C → A
```

**Detection using Tarjan's SCC Algorithm:**

```typescript
interface MutualRecursion {
    cycle: FunctionSymbol[];  // Functions forming the cycle
    edges: CallEdge[];        // Call edges forming the cycle
}

/**
 * Tarjan's algorithm for finding strongly connected components.
 * Time complexity: O(V + E)
 */
function findMutualRecursion(graph: CallGraph): MutualRecursion[] {
    const result: MutualRecursion[] = [];
    
    // Tarjan's SCC variables
    let index = 0;
    const nodeIndex = new Map<FunctionSymbol, number>();
    const lowLink = new Map<FunctionSymbol, number>();
    const onStack = new Set<FunctionSymbol>();
    const stack: FunctionSymbol[] = [];
    
    function strongConnect(node: FunctionSymbol): void {
        // Set index and lowlink
        nodeIndex.set(node, index);
        lowLink.set(node, index);
        index++;
        stack.push(node);
        onStack.add(node);
        
        // Visit all callees
        const callNode = graph.getNode(node);
        for (const edge of callNode.callees) {
            const callee = edge.callee;
            
            if (!nodeIndex.has(callee)) {
                // Not visited yet
                strongConnect(callee);
                lowLink.set(node, Math.min(
                    lowLink.get(node)!,
                    lowLink.get(callee)!
                ));
            } else if (onStack.has(callee)) {
                // Back edge to node on stack
                lowLink.set(node, Math.min(
                    lowLink.get(node)!,
                    nodeIndex.get(callee)!
                ));
            }
        }
        
        // If node is root of SCC
        if (lowLink.get(node) === nodeIndex.get(node)) {
            const scc: FunctionSymbol[] = [];
            let w: FunctionSymbol;
            do {
                w = stack.pop()!;
                onStack.delete(w);
                scc.push(w);
            } while (w !== node);
            
            // SCC with >1 node = mutual recursion
            if (scc.length > 1) {
                result.push({
                    cycle: scc,
                    edges: findCycleEdges(graph, scc)
                });
            }
        }
    }
    
    // Run on all unvisited nodes
    for (const node of graph.nodes) {
        if (!nodeIndex.has(node.function)) {
            strongConnect(node.function);
        }
    }
    
    return result;
}

/**
 * Find the call edges that form a cycle within an SCC.
 */
function findCycleEdges(
    graph: CallGraph,
    scc: FunctionSymbol[]
): CallEdge[] {
    const sccSet = new Set(scc);
    const edges: CallEdge[] = [];
    
    for (const fn of scc) {
        const node = graph.getNode(fn);
        for (const edge of node.callees) {
            if (sccSet.has(edge.callee)) {
                edges.push(edge);
            }
        }
    }
    
    return edges;
}
```

### 2.4 Cross-Module Recursion

**Pattern:**
```blend
// module_a.blend
import { bFunc } from "module_b";
export fn aFunc() { bFunc(); }

// module_b.blend
import { aFunc } from "module_a";
export fn bFunc() { aFunc(); }  // Cross-module cycle!
```

**Detection:**
- Build call graph AFTER all modules are parsed
- Include import/export edges in graph
- Same SCC detection works across modules

```typescript
/**
 * Build a program-wide call graph from all modules.
 */
function buildGlobalCallGraph(modules: Module[]): CallGraph {
    const graph = new CallGraph();
    
    // Phase 1: Add all functions
    for (const mod of modules) {
        for (const fn of mod.functions) {
            graph.addNode(fn);
        }
    }
    
    // Phase 2: Resolve cross-module references and add edges
    const resolver = new CrossModuleResolver(modules);
    
    for (const mod of modules) {
        for (const fn of mod.functions) {
            for (const call of fn.body.calls) {
                // Resolve call target (may be in another module)
                const target = resolver.resolveCall(call, mod);
                if (target) {
                    graph.addEdge(fn, target, call.location);
                }
            }
        }
    }
    
    return graph;
}
```

---

## 3. Error Messages

### 3.1 Error Message Design Principles

From anti-patterns analysis:
- ❌ **Bad:** "ERROR! Recursion not allowed! Occurs in myfunction"
- ✅ **Good:** Full cycle, call chain, suggestions

### 3.2 Self-Recursion Error

```
┌─────────────────────────────────────────────────────────────────┐
│ ERROR B6502: Direct recursion detected                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   → factorial calls itself                                      │
│                                                                 │
│   12 │ fn factorial(n: byte): word {                           │
│   13 │     if (n <= 1) return 1;                               │
│   14 │     return n * factorial(n - 1);                        │
│      │                 ^^^^^^^^^ recursive call here           │
│   15 │ }                                                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ WHY THIS IS AN ERROR:                                           │
│   Static frame allocation cannot handle recursion because each  │
│   call needs its own copy of local variables.                   │
│                                                                 │
│ SOLUTIONS:                                                      │
│                                                                 │
│   1. Mark function as recursive (uses stack, slower):           │
│                                                                 │
│      recursive fn factorial(n: byte): word { ... }              │
│                                                                 │
│   2. Convert to iterative algorithm (recommended, faster):      │
│                                                                 │
│      fn factorial(n: byte): word {                              │
│          let result: word = 1;                                  │
│          for i in 2..(n+1) {                                    │
│              result *= i;                                       │
│          }                                                      │
│          return result;                                         │
│      }                                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Mutual Recursion Error

```
┌─────────────────────────────────────────────────────────────────┐
│ ERROR B6503: Mutual recursion detected                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Call cycle detected:                                          │
│                                                                 │
│     processTree                                                 │
│         ↓ calls (line 15)                                       │
│     processNode                                                 │
│         ↓ calls (line 28)                                       │
│     handleChildren                                              │
│         ↓ calls (line 42)                                       │
│     processTree  ← cycle completes here                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ WHY THIS IS AN ERROR:                                           │
│   All 3 functions in this cycle need their own frame instances, │
│   which requires stack-based allocation.                        │
│                                                                 │
│ SOLUTIONS:                                                      │
│                                                                 │
│   1. Mark ALL functions in cycle as recursive:                  │
│                                                                 │
│      recursive fn processTree(...) { ... }                      │
│      recursive fn processNode(...) { ... }                      │
│      recursive fn handleChildren(...) { ... }                   │
│                                                                 │
│   2. Break the cycle by inlining one function:                  │
│                                                                 │
│      Move handleChildren's logic into processNode to            │
│      eliminate one link in the chain.                           │
│                                                                 │
│   3. Use explicit work stack (recommended for trees):           │
│                                                                 │
│      fn processTree(root: *Node) {                              │
│          let stack: *Node[MAX_DEPTH];                           │
│          let sp: byte = 0;                                      │
│          stack[sp] = root;                                      │
│          while (sp > 0) {                                       │
│              let node = stack[--sp];                            │
│              // Process node...                                 │
│              for child in node.children {                       │
│                  stack[sp++] = child;                           │
│              }                                                  │
│          }                                                      │
│      }                                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Cross-Module Recursion Error

```
┌─────────────────────────────────────────────────────────────────┐
│ ERROR B6504: Cross-module recursion detected                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Call cycle spans multiple modules:                            │
│                                                                 │
│     ui/renderer.blend:                                          │
│       renderWidget (line 12)                                    │
│         ↓ calls                                                 │
│     ui/layout.blend:                                            │
│       layoutChildren (line 45)                                  │
│         ↓ calls                                                 │
│     ui/renderer.blend:                                          │
│       renderWidget  ← cycle completes here                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ NOTE: Both functions must be marked 'recursive' even though     │
│       they are in different files.                              │
│                                                                 │
│ SOLUTION:                                                       │
│                                                                 │
│   // ui/renderer.blend                                          │
│   recursive fn renderWidget(...) { ... }                        │
│                                                                 │
│   // ui/layout.blend                                            │
│   recursive fn layoutChildren(...) { ... }                      │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 Partial Marking Error

```
┌─────────────────────────────────────────────────────────────────┐
│ ERROR B6505: Incomplete recursive marking                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Recursive cycle found, but only some functions are marked:    │
│                                                                 │
│     ✓ recursive fn processTree   (marked)                       │
│     ✗ fn processNode              (NOT marked)                  │
│     ✗ fn handleChildren           (NOT marked)                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ REQUIREMENT:                                                    │
│   ALL functions in a recursive cycle must be marked 'recursive' │
│   to ensure consistent stack-based allocation.                  │
│                                                                 │
│ ADD 'recursive' keyword to:                                     │
│   - processNode (line 22 in tree.blend)                         │
│   - handleChildren (line 38 in tree.blend)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Stack Allocation for Recursive Functions

### 4.1 When Recursion is Allowed

When ALL functions in a cycle are marked `recursive`:
1. Use software stack for their frames
2. Allocate/deallocate at call boundaries
3. Cannot coalesce with other functions

### 4.2 Frame Layout for Recursive Functions

```
┌─────────────────────────────────────────────────────────────────┐
│              RECURSIVE FUNCTION FRAME ON SOFTWARE STACK         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Software Stack Pointer (16-bit) in ZP: $FB-$FC                 │
│                                                                 │
│  ┌─────────────────┐ ← SP (grows downward)                      │
│  │ Return address  │ +0, +1  (from JSR, on HW stack)            │
│  ├─────────────────┤                                            │
│  │ Saved frame ptr │ +2, +3  (previous SP value)                │
│  ├─────────────────┤                                            │
│  │ Parameter 1     │ +4                                         │
│  │ Parameter 2     │ +5                                         │
│  │ ...             │                                            │
│  ├─────────────────┤                                            │
│  │ Local 1         │ +N                                         │
│  │ Local 2         │ +N+1                                       │
│  │ ...             │                                            │
│  └─────────────────┘                                            │
│                                                                 │
│  Prologue:                                                      │
│    SEC                  ; Set up for subtraction                │
│    LDA stack_ptr        ; Load low byte of SP                   │
│    SBC #frame_size      ; Subtract frame size                   │
│    STA stack_ptr                                                │
│    LDA stack_ptr+1                                              │
│    SBC #0               ; Propagate carry                       │
│    STA stack_ptr+1                                              │
│                                                                 │
│  Epilogue:                                                      │
│    CLC                  ; Set up for addition                   │
│    LDA stack_ptr        ; Load low byte of SP                   │
│    ADC #frame_size      ; Add frame size                        │
│    STA stack_ptr                                                │
│    LDA stack_ptr+1                                              │
│    ADC #0               ; Propagate carry                       │
│    STA stack_ptr+1                                              │
│    RTS                                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Performance Cost Analysis

| Operation | Static Function | Recursive Function |
|-----------|----------------|-------------------|
| Call overhead | 12 cycles (JSR) | 50-80 cycles |
| Local access | 4 cycles (LDA label) | 6+ cycles (LDA (sp),Y) |
| Return | 6 cycles (RTS) | 30-50 cycles |
| Frame size | 0 (static) | N bytes per call |
| HW stack usage | 2 bytes | 2 bytes + spill |

**Typical overhead: 5-10x slower for recursive functions**

---

## 5. Recursion Depth Limits

### 5.1 Hardware Stack Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                 6502 HARDWARE STACK LIMITS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Hardware Stack: $0100 - $01FF (256 bytes)                      │
│                                                                 │
│  Each JSR uses 2 bytes for return address.                      │
│  Each interrupt uses 3 bytes (PC + status).                     │
│                                                                 │
│  Safe limits:                                                   │
│    - Reserve 16 bytes for interrupts (NMI, IRQ)                 │
│    - Reserve 16 bytes for system/ROM calls                      │
│    - Available: ~224 bytes                                      │
│    - Max call depth: ~112 levels (224 / 2)                      │
│                                                                 │
│  Recommended limits:                                            │
│    WARNING at depth > 64 (128 bytes HW stack)                   │
│    ERROR at depth > 100 (200 bytes HW stack)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Software Stack Considerations

```typescript
interface RecursionLimits {
    /** Maximum depth before warning */
    warnDepth: number;      // Default: 32
    
    /** Maximum depth before error */
    maxDepth: number;       // Default: 64
    
    /** Software stack size in bytes */
    stackSize: number;      // Default: 512
    
    /** Minimum frame size for recursive functions */
    minFrameSize: number;   // Default: 4
}

/**
 * Calculate safe recursion depth.
 */
function calculateSafeDepth(
    limits: RecursionLimits,
    frameSize: number
): number {
    // Reserve 10% for safety margin
    const usableStack = limits.stackSize * 0.9;
    return Math.floor(usableStack / frameSize);
}
```

### 5.3 Compile-Time Depth Analysis

For non-recursive programs, analyze maximum call depth:

```typescript
/**
 * Calculate maximum call chain depth from call graph.
 * Only valid for non-recursive programs.
 */
function calculateMaxCallDepth(graph: CallGraph): DepthAnalysis {
    const depths = new Map<FunctionSymbol, number>();
    
    // Topological sort (no cycles guaranteed)
    const sorted = topologicalSort(graph);
    
    // Calculate depths bottom-up
    for (const fn of sorted.reverse()) {
        const node = graph.getNode(fn);
        const calleeDepths = node.callees.map(e => 
            depths.get(e.callee) ?? 0
        );
        depths.set(fn, 1 + Math.max(0, ...calleeDepths));
    }
    
    return {
        maxDepth: Math.max(...depths.values()),
        entryPoints: graph.entryPoints.map(e => ({
            function: e,
            depth: depths.get(e) ?? 0
        }))
    };
}
```

---

## 6. Implementation Summary

### 6.1 Detection Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│               RECURSION HANDLING PIPELINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Parse all modules                                           │
│     └─→ Extract function declarations                           │
│                                                                 │
│  2. Build global call graph                                     │
│     └─→ Include cross-module edges                              │
│                                                                 │
│  3. Detect self-recursion                                       │
│     └─→ Functions with self-edges                               │
│                                                                 │
│  4. Detect mutual recursion (Tarjan's SCC)                      │
│     └─→ SCCs with >1 member                                     │
│                                                                 │
│  5. Verify recursive marking                                    │
│     ├─→ All cycle members marked → OK (stack allocation)        │
│     ├─→ No cycle members marked → ERROR (suggest solutions)     │
│     └─→ Some marked → ERROR (incomplete marking)                │
│                                                                 │
│  6. Calculate call depths                                       │
│     └─→ Warn if depth > threshold                               │
│                                                                 │
│  7. Allocate frames                                             │
│     ├─→ Non-recursive: Static allocation + coalescing           │
│     └─→ Recursive: Software stack allocation                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 TypeScript Interfaces

```typescript
/** Result of recursion detection */
interface RecursionResult {
    /** Self-recursive functions */
    selfRecursive: SelfRecursion[];
    
    /** Mutually recursive cycles */
    mutualRecursive: MutualRecursion[];
    
    /** Functions that MUST use stack allocation */
    requiresStack: Set<FunctionSymbol>;
    
    /** Maximum call depth for non-recursive paths */
    maxDepth: number;
    
    /** Any depth warnings */
    depthWarnings: DepthWarning[];
}

/** Recursion detection errors */
interface RecursionError {
    type: 'self' | 'mutual' | 'cross-module' | 'incomplete-marking';
    cycle: FunctionSymbol[];
    callSites: SourceLocation[];
    message: string;
    suggestions: string[];
}

/** Recursion detection warnings */
interface DepthWarning {
    path: FunctionSymbol[];
    depth: number;
    message: string;
}
```

---

## 7. Conclusion

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Static default** | 6502 performance requirements |
| **Explicit recursion** | User awareness, compiler optimization |
| **Full cycle detection** | Tarjan's SCC, O(V+E) complexity |
| **Cross-module support** | Global call graph analysis |
| **Rich error messages** | Full cycle, locations, suggestions |
| **Depth warnings** | Hardware stack overflow prevention |

### What We Avoid

| Anti-Pattern | Our Approach |
|--------------|--------------|
| Silent recursion (CC65) | Explicit `recursive` keyword |
| Cryptic errors (KickC) | Full cycle + suggestions |
| Conservative marking (Oscar64) | Only marked functions pay cost |

---

**Next Document:** [06-edge-cases.md](06-edge-cases.md)