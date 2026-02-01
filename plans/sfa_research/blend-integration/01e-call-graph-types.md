# Blend Integration: CallGraph Types

> **Document**: blend-integration/01e-call-graph-types.md
> **Parent**: [01-frame-types.md](01-frame-types.md)
> **Target File**: `packages/compiler-v2/src/frame/call-graph.ts`
> **Status**: Design Complete

## Overview

The call graph types support recursion detection and frame coalescing analysis. These types track function call relationships to determine which functions can safely share memory.

---

## 1. CallGraphNode Interface

Represents a function in the call graph.

```typescript
import { ThreadContext } from './enums.js';
import { SourceLocation } from '../ast/base.js';

/**
 * A node in the call graph representing a function.
 *
 * Tracks call relationships for:
 * - Recursion detection (direct and indirect)
 * - Frame coalescing (which functions can share memory)
 * - Thread context analysis (main vs ISR)
 *
 * @example
 * ```typescript
 * const node: CallGraphNode = {
 *   functionName: 'helper',
 *   callees: new Set(['util', 'calc']),
 *   callers: new Set(['main', 'process']),
 *   isInterruptHandler: false,
 *   threadContext: ThreadContext.MainOnly,
 *   callDepth: 2,
 *   isRecursive: false,
 * };
 * ```
 */
export interface CallGraphNode {
  // ========================================
  // Identity
  // ========================================

  /**
   * Function name (fully qualified: module.function).
   */
  readonly functionName: string;

  // ========================================
  // Call Relationships
  // ========================================

  /**
   * Functions this function calls (direct callees).
   * Used for detecting call chains and recursion.
   */
  readonly callees: Set<string>;

  /**
   * Functions that call this function (direct callers).
   * Used for detecting reachability from entry points.
   */
  readonly callers: Set<string>;

  // ========================================
  // Interrupt Handling
  // ========================================

  /**
   * Is this function an interrupt handler entry point?
   * Detected by `interrupt` keyword or known entry points.
   */
  readonly isInterruptHandler: boolean;

  /**
   * Thread context (main, isr, or both).
   * Computed from reachability analysis.
   */
  threadContext: ThreadContext;

  // ========================================
  // Analysis Results
  // ========================================

  /**
   * Call depth from entry points (main/interrupt).
   * Used for stack depth warnings.
   */
  callDepth: number;

  /**
   * Is this function part of a recursive cycle?
   * If true, static frame allocation is not possible.
   */
  isRecursive: boolean;

  /**
   * If recursive, the members of the recursive cycle.
   * For direct recursion, this contains just this function.
   * For mutual recursion, contains all functions in the cycle.
   */
  recursiveCycleMembers?: Set<string>;
}
```

---

## 2. CallGraph Interface

The complete call graph for a module/program.

```typescript
/**
 * The complete call graph for a program.
 *
 * Provides:
 * - Nodes for all functions
 * - Entry point tracking
 * - Recursion detection results
 * - Queries for coalescing analysis
 *
 * @example
 * ```typescript
 * // Build call graph from AST
 * const callGraph = buildCallGraph(program);
 *
 * // Check for recursion
 * if (callGraph.recursiveFunctions.size > 0) {
 *   // Report error
 * }
 *
 * // Check if two functions can share memory
 * const canShare = !callGraph.canOverlap('add', 'multiply');
 * ```
 */
export interface CallGraph {
  // ========================================
  // Graph Structure
  // ========================================

  /**
   * All nodes by function name.
   */
  readonly nodes: Map<string, CallGraphNode>;

  /**
   * Entry point functions (main, interrupt handlers).
   * These have no callers (except external invocation).
   */
  readonly entryPoints: Set<string>;

  // ========================================
  // Recursion Detection Results
  // ========================================

  /**
   * All functions detected as recursive.
   * Includes both direct and mutual recursion.
   */
  readonly recursiveFunctions: Set<string>;

  /**
   * Recursive cycles (each set is a cycle).
   * Single-element sets are direct recursion.
   * Multi-element sets are mutual recursion.
   */
  readonly recursiveCycles: Set<string>[];

  // ========================================
  // Query Methods
  // ========================================

  /**
   * Get a node by function name.
   * @param functionName Fully qualified function name
   * @returns Node or undefined if not found
   */
  getNode(functionName: string): CallGraphNode | undefined;

  /**
   * Check if two functions can have overlapping execution.
   *
   * Functions can overlap if:
   * - One calls the other (directly or indirectly)
   * - They can be active at the same time (e.g., one in main, one in ISR)
   *
   * If they can overlap, their frames CANNOT be coalesced.
   *
   * @param func1 First function name
   * @param func2 Second function name
   * @returns True if execution can overlap
   */
  canOverlap(func1: string, func2: string): boolean;

  /**
   * Check if a function is reachable from an interrupt handler.
   * @param functionName Function to check
   * @returns True if reachable from ISR
   */
  isReachableFromIsr(functionName: string): boolean;

  /**
   * Get all functions in the same thread context.
   * @param context Thread context to filter by
   * @returns Array of function names
   */
  getFunctionsByContext(context: ThreadContext): string[];

  /**
   * Check if a function is an entry point.
   * @param functionName Function to check
   */
  isEntryPoint(functionName: string): boolean;

  /**
   * Get all functions called by a function (transitively).
   * @param functionName Starting function
   * @returns Set of all reachable functions
   */
  getTransitiveCallees(functionName: string): Set<string>;

  /**
   * Get all functions that call a function (transitively).
   * @param functionName Target function
   * @returns Set of all functions that can reach this one
   */
  getTransitiveCallers(functionName: string): Set<string>;
}
```

---

## 3. RecursionError Interface

Error information when recursion is detected.

```typescript
/**
 * Information about a detected recursion error.
 *
 * Blend65 does not support recursion (static frame allocation).
 * This error provides detailed information for the error message.
 */
export interface RecursionError {
  /**
   * Type of recursion detected.
   * - 'direct': Function calls itself
   * - 'mutual': Functions call each other in a cycle
   */
  readonly type: 'direct' | 'mutual';

  /**
   * The function that recurses (or first function in cycle).
   */
  readonly functionName: string;

  /**
   * Full call chain showing the recursion.
   * For direct: ['a', 'a']
   * For mutual: ['a', 'b', 'c', 'a']
   */
  readonly callChain: string[];

  /**
   * Human-readable error message.
   */
  readonly message: string;

  /**
   * Source location of the recursive call (if available).
   */
  readonly location?: SourceLocation;
}
```

---

## 4. Factory Functions

Helper functions for creating call graph structures.

```typescript
/**
 * Create a new call graph node with defaults.
 *
 * @param functionName - Fully qualified function name
 * @param options - Optional overrides
 * @returns A new CallGraphNode with defaults applied
 */
export function createCallGraphNode(
  functionName: string,
  options?: Partial<CallGraphNode>
): CallGraphNode {
  return {
    functionName,
    callees: new Set(),
    callers: new Set(),
    isInterruptHandler: false,
    threadContext: ThreadContext.MainOnly,
    callDepth: 0,
    isRecursive: false,
    ...options,
  };
}

/**
 * Create a recursion error for direct recursion.
 *
 * @param functionName - The recursive function
 * @param location - Source location of the recursive call
 */
export function createDirectRecursionError(
  functionName: string,
  location?: SourceLocation
): RecursionError {
  return {
    type: 'direct',
    functionName,
    callChain: [functionName, functionName],
    message: `Function '${functionName}' calls itself. Recursion is not supported.`,
    location,
  };
}

/**
 * Create a recursion error for mutual recursion.
 *
 * @param callChain - The call chain showing the cycle
 * @param location - Source location of one of the recursive calls
 */
export function createMutualRecursionError(
  callChain: string[],
  location?: SourceLocation
): RecursionError {
  const functionName = callChain[0];
  const chainStr = callChain.join(' → ');
  return {
    type: 'mutual',
    functionName,
    callChain,
    message: `Mutual recursion detected: ${chainStr}. Recursion is not supported.`,
    location,
  };
}
```

---

## 5. Call Graph Builder (Interface Preview)

The builder will be implemented in a separate file.

```typescript
import { Program } from '../ast/program.js';

/**
 * Build a call graph from a parsed program.
 *
 * This function:
 * 1. Walks the AST to find all function declarations
 * 2. Analyzes function bodies to find call expressions
 * 3. Builds the call graph with callee/caller relationships
 * 4. Detects entry points (main, interrupt handlers)
 * 5. Detects recursion using Tarjan's SCC algorithm
 * 6. Computes thread contexts for all functions
 *
 * @param program - The parsed and type-checked program
 * @returns Complete call graph with all analysis results
 */
export function buildCallGraph(program: Program): CallGraph;
```

---

## 6. Usage Example

```typescript
import { buildCallGraph, createDirectRecursionError } from './frame/call-graph.js';
import { ThreadContext } from './frame/enums.js';

// Build call graph from AST
const callGraph = buildCallGraph(program);

// Check for recursion
if (callGraph.recursiveFunctions.size > 0) {
  for (const cycle of callGraph.recursiveCycles) {
    const funcs = Array.from(cycle);
    if (funcs.length === 1) {
      const error = createDirectRecursionError(funcs[0]);
      diagnostics.push(error);
    } else {
      const error = createMutualRecursionError([...funcs, funcs[0]]);
      diagnostics.push(error);
    }
  }
}

// Check coalescing eligibility
const addNode = callGraph.getNode('add');
const mulNode = callGraph.getNode('multiply');

if (addNode && mulNode) {
  // Can these share memory?
  if (!callGraph.canOverlap('add', 'multiply')) {
    // Yes, they never execute together
    console.log('add and multiply can share frame memory');
  }
}

// Check ISR reachability
if (callGraph.isReachableFromIsr('helper')) {
  console.log('helper is called from interrupt context');
}
```

---

## Related Documents

| Document | Content |
|----------|---------|
| [01a-frame-enums.md](01a-frame-enums.md) | Enum definitions (ThreadContext) |
| [01d-frame-map.md](01d-frame-map.md) | FrameMap interface |
| [01f-platform-config.md](01f-platform-config.md) | Platform configuration |

---

**Previous:** [01d-frame-map.md](01d-frame-map.md)
**Next:** [01f-platform-config.md](01f-platform-config.md)