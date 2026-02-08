/**
 * Call Graph for Blend65 Compiler v2
 *
 * Tracks function call relationships for:
 * - Recursion detection (direct and indirect)
 * - Call depth analysis for stack estimation
 * - Dead code detection (unreachable functions)
 *
 * The call graph is critical for Static Frame Allocation (SFA):
 * - SFA requires NO recursion (frames are statically allocated)
 * - Recursive functions must be detected as compile-time errors
 *
 * @module semantic/call-graph
 */

import type { SourceLocation, FunctionDecl, Program, CallExpression } from '../ast/index.js';
import { isIdentifierExpression } from '../ast/index.js';
import { ASTWalker } from '../ast/walker/index.js';
import type { SymbolTable, Symbol } from './index.js';
import { SymbolKind, isFunctionSymbol } from './symbol.js';

/**
 * Represents a node in the call graph (a function)
 *
 * Each node tracks:
 * - The function it represents
 * - All functions it calls (callees)
 * - All functions that call it (callers)
 */
export interface CallGraphNode {
  /** Function name (unique identifier) */
  name: string;

  /** Source location of the function declaration */
  location: SourceLocation;

  /** Functions called by this function (callee names) */
  callees: Set<string>;

  /** Functions that call this function (caller names) */
  callers: Set<string>;

  /** The function symbol (if resolved) */
  symbol?: Symbol;

  /** The function declaration AST node (if available) */
  declaration?: FunctionDecl;
}

/**
 * Represents a call site in the code
 *
 * Stores information about where a function call occurs.
 */
export interface CallSite {
  /** The function containing this call */
  caller: string;

  /** The function being called */
  callee: string;

  /** Source location of the call */
  location: SourceLocation;
}

/**
 * Call Graph - tracks function call relationships
 *
 * This graph is used to:
 * 1. Detect recursion (which is an error for SFA)
 * 2. Compute call depth for stack estimation
 * 3. Find unreachable functions (dead code)
 * 4. Analyze function dependencies
 *
 * The graph is directed: an edge from A to B means "A calls B".
 *
 * @example
 * ```typescript
 * const callGraph = new CallGraph();
 *
 * // Build graph from AST
 * const builder = new CallGraphBuilder(symbolTable);
 * builder.build(program, callGraph);
 *
 * // Check for recursion
 * const directRecursion = callGraph.detectDirectRecursion();
 * const allRecursion = callGraph.detectAllRecursion();
 * ```
 */
export class CallGraph {
  /**
   * Map of function name to call graph node
   */
  protected nodes: Map<string, CallGraphNode> = new Map();

  /**
   * All call sites (caller → callee with locations)
   */
  protected callSites: CallSite[] = [];

  /**
   * Adds a function node to the graph
   *
   * @param name - The function name
   * @param location - Source location of the declaration
   * @param symbol - Optional symbol reference
   * @param declaration - Optional AST node reference
   */
  public addFunction(
    name: string,
    location: SourceLocation,
    symbol?: Symbol,
    declaration?: FunctionDecl
  ): void {
    if (!this.nodes.has(name)) {
      this.nodes.set(name, {
        name,
        location,
        callees: new Set(),
        callers: new Set(),
        symbol,
        declaration,
      });
    }
  }

  /**
   * Records a function call relationship
   *
   * @param caller - The function making the call
   * @param callee - The function being called
   * @param location - Source location of the call expression
   */
  public addCall(caller: string, callee: string, location: SourceLocation): void {
    // Ensure both functions exist in the graph
    if (!this.nodes.has(caller)) {
      this.addFunction(caller, location);
    }
    if (!this.nodes.has(callee)) {
      this.addFunction(callee, location);
    }

    // Add the call relationship
    this.nodes.get(caller)!.callees.add(callee);
    this.nodes.get(callee)!.callers.add(caller);

    // Record the call site
    this.callSites.push({ caller, callee, location });
  }

  /**
   * Gets a function node by name
   *
   * @param name - The function name
   * @returns The call graph node, or undefined
   */
  public getFunction(name: string): CallGraphNode | undefined {
    return this.nodes.get(name);
  }

  /**
   * Gets all function names in the graph
   *
   * @returns Set of function names
   */
  public getAllFunctions(): Set<string> {
    return new Set(this.nodes.keys());
  }

  /**
   * Gets functions called by a given function
   *
   * @param name - The caller function name
   * @returns Set of callee function names
   */
  public getCallees(name: string): Set<string> {
    return this.nodes.get(name)?.callees ?? new Set();
  }

  /**
   * Gets functions that call a given function
   *
   * @param name - The callee function name
   * @returns Set of caller function names
   */
  public getCallers(name: string): Set<string> {
    return this.nodes.get(name)?.callers ?? new Set();
  }

  /**
   * Gets all call sites for a specific call relationship
   *
   * @param caller - The caller function name
   * @param callee - The callee function name
   * @returns Array of call sites
   */
  public getCallSites(caller: string, callee: string): CallSite[] {
    return this.callSites.filter(site => site.caller === caller && site.callee === callee);
  }

  /**
   * Gets all call sites in the graph
   *
   * @returns Array of all call sites
   */
  public getAllCallSites(): CallSite[] {
    return [...this.callSites];
  }

  /**
   * Checks if a function directly calls itself
   *
   * @param name - The function name
   * @returns true if function calls itself
   */
  public isDirectlyRecursive(name: string): boolean {
    const node = this.nodes.get(name);
    return node?.callees.has(name) ?? false;
  }

  /**
   * Detects all directly recursive functions
   *
   * Direct recursion: f() calls f()
   *
   * @returns Array of function names that are directly recursive
   */
  public detectDirectRecursion(): string[] {
    const recursive: string[] = [];
    for (const [name, node] of this.nodes) {
      if (node.callees.has(name)) {
        recursive.push(name);
      }
    }
    return recursive;
  }

  /**
   * Checks if a function is part of any recursive cycle
   *
   * This includes both direct recursion (f calls f) and
   * indirect recursion (f calls g calls h calls f).
   *
   * @param name - The function name
   * @returns true if function is in a recursive cycle
   */
  public isRecursive(name: string): boolean {
    return this.findCycleFrom(name) !== null;
  }

  /**
   * Finds a recursive cycle starting from a given function
   *
   * Uses DFS to find any path from the function back to itself.
   *
   * @param startName - The function to start from
   * @returns The cycle path, or null if no cycle exists
   */
  public findCycleFrom(startName: string): string[] | null {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const path: string[] = [];

    const dfs = (name: string): string[] | null => {
      if (stack.has(name)) {
        // Found a cycle - extract cycle from path
        const cycleStart = path.indexOf(name);
        return [...path.slice(cycleStart), name];
      }

      if (visited.has(name)) {
        return null;
      }

      visited.add(name);
      stack.add(name);
      path.push(name);

      const node = this.nodes.get(name);
      if (node) {
        for (const callee of node.callees) {
          const cycle = dfs(callee);
          if (cycle) {
            return cycle;
          }
        }
      }

      path.pop();
      stack.delete(name);
      return null;
    };

    return dfs(startName);
  }

  /**
   * Detects all recursive cycles in the call graph
   *
   * Returns all cycles (direct and indirect recursion).
   *
   * @returns Array of cycle paths (each cycle is an array of function names)
   */
  public detectAllCycles(): string[][] {
    const cycles: string[][] = [];
    const globalVisited = new Set<string>();

    for (const name of this.nodes.keys()) {
      if (!globalVisited.has(name)) {
        const cycle = this.findCycleFrom(name);
        if (cycle) {
          // Check if this cycle is already detected
          const cycleKey = cycle.sort().join(',');
          const isDuplicate = cycles.some(c => c.sort().join(',') === cycleKey);
          if (!isDuplicate) {
            cycles.push(cycle);
          }
        }
        globalVisited.add(name);
      }
    }

    return cycles;
  }

  /**
   * Computes the maximum call depth from a given entry point
   *
   * This is useful for stack size estimation (though SFA doesn't use a runtime stack).
   * Returns Infinity if there's a recursive cycle.
   *
   * @param entryPoint - The function to start from (usually 'main')
   * @returns The maximum call depth, or Infinity if recursive
   */
  public getMaxCallDepth(entryPoint: string): number {
    const visited = new Set<string>();

    const dfs = (name: string): number => {
      if (visited.has(name)) {
        // Cycle detected
        return Infinity;
      }

      visited.add(name);

      const node = this.nodes.get(name);
      if (!node || node.callees.size === 0) {
        visited.delete(name);
        return 0;
      }

      let maxDepth = 0;
      for (const callee of node.callees) {
        const depth = dfs(callee);
        if (depth === Infinity) {
          return Infinity;
        }
        maxDepth = Math.max(maxDepth, depth);
      }

      visited.delete(name);
      return maxDepth + 1;
    };

    return dfs(entryPoint);
  }

  /**
   * Finds entry points (functions with no callers)
   *
   * These are potential main/start functions.
   *
   * @returns Array of function names with no callers
   */
  public findEntryPoints(): string[] {
    const entryPoints: string[] = [];
    for (const [name, node] of this.nodes) {
      if (node.callers.size === 0) {
        entryPoints.push(name);
      }
    }
    return entryPoints;
  }

  /**
   * Finds leaf functions (functions that don't call any other functions)
   *
   * @returns Array of leaf function names
   */
  public findLeafFunctions(): string[] {
    const leaves: string[] = [];
    for (const [name, node] of this.nodes) {
      if (node.callees.size === 0) {
        leaves.push(name);
      }
    }
    return leaves;
  }

  /**
   * Finds unreachable functions from a given entry point
   *
   * @param entryPoint - The entry point function name
   * @returns Set of function names not reachable from entry point
   */
  public findUnreachableFunctions(entryPoint: string): Set<string> {
    const reachable = new Set<string>();
    const stack = [entryPoint];

    while (stack.length > 0) {
      const name = stack.pop()!;
      if (reachable.has(name)) continue;

      reachable.add(name);
      const node = this.nodes.get(name);
      if (node) {
        for (const callee of node.callees) {
          if (!reachable.has(callee)) {
            stack.push(callee);
          }
        }
      }
    }

    // All functions not in reachable set are unreachable
    const unreachable = new Set<string>();
    for (const name of this.nodes.keys()) {
      if (!reachable.has(name)) {
        unreachable.add(name);
      }
    }

    return unreachable;
  }

  /**
   * Gets the number of functions in the graph
   */
  public size(): number {
    return this.nodes.size;
  }

  /**
   * Checks if the graph is empty
   */
  public isEmpty(): boolean {
    return this.nodes.size === 0;
  }

  /**
   * Clears all data from the graph
   */
  public clear(): void {
    this.nodes.clear();
    this.callSites = [];
  }

  /**
   * Debug: Returns a string representation of the call graph
   */
  public toString(): string {
    const lines: string[] = ['CallGraph:'];
    for (const [name, node] of this.nodes) {
      if (node.callees.size > 0) {
        lines.push(`  ${name} calls: ${Array.from(node.callees).join(', ')}`);
      } else {
        lines.push(`  ${name} (no calls)`);
      }
    }
    return lines.join('\n');
  }
}

/**
 * Call Graph Builder - constructs a call graph from AST
 *
 * Walks the AST to find all function declarations and call expressions,
 * building the call graph as it goes.
 *
 * @example
 * ```typescript
 * const builder = new CallGraphBuilder(symbolTable);
 * const callGraph = builder.build(program);
 *
 * // Use the call graph
 * const recursiveFuncs = callGraph.detectDirectRecursion();
 * ```
 */
export class CallGraphBuilder extends ASTWalker {
  /**
   * The call graph being built
   */
  protected callGraph: CallGraph;

  /**
   * Symbol table for resolving function references
   */
  protected symbolTable: SymbolTable;

  /**
   * Current function being analyzed (null at module level)
   */
  protected currentFunction: string | null = null;

  /**
   * Current function's source location
   */
  protected currentFunctionLocation: SourceLocation | null = null;

  /**
   * Creates a new CallGraphBuilder
   *
   * @param symbolTable - The symbol table for resolving identifiers
   */
  constructor(symbolTable: SymbolTable) {
    super();
    this.callGraph = new CallGraph();
    this.symbolTable = symbolTable;
  }

  /**
   * Builds a call graph from a program AST
   *
   * @param program - The program to analyze
   * @param existingGraph - Optional existing graph to add to
   * @returns The constructed call graph
   */
  public build(program: Program, existingGraph?: CallGraph): CallGraph {
    if (existingGraph) {
      this.callGraph = existingGraph;
    } else {
      this.callGraph = new CallGraph();
    }

    this.currentFunction = null;
    this.currentFunctionLocation = null;

    this.walk(program);

    return this.callGraph;
  }

  /**
   * Gets the built call graph
   */
  public getCallGraph(): CallGraph {
    return this.callGraph;
  }

  /**
   * Visit function declaration - register function and set as current context
   */
  public override visitFunctionDecl(node: FunctionDecl): void {
    const funcName = node.getName();
    const location = node.getLocation();

    // Register function in call graph
    const symbol = this.symbolTable.lookup(funcName);
    this.callGraph.addFunction(funcName, location, symbol ?? undefined, node);

    // Set current function context for call resolution
    const previousFunction = this.currentFunction;
    const previousLocation = this.currentFunctionLocation;

    this.currentFunction = funcName;
    this.currentFunctionLocation = location;

    // Visit function body
    super.visitFunctionDecl(node);

    // Restore previous context (for nested functions if ever supported)
    this.currentFunction = previousFunction;
    this.currentFunctionLocation = previousLocation;
  }

  /**
   * Visit call expression - record call relationship
   */
  public override visitCallExpression(node: CallExpression): void {
    // Only record calls within functions (not at module level)
    if (this.currentFunction !== null) {
      const callee = node.getCallee();

      // Get the function name being called
      let calleeName: string | null = null;

      if (isIdentifierExpression(callee)) {
        calleeName = callee.getName();
      }
      // TODO: Handle member expressions for method calls (e.g., module.func())

      if (calleeName !== null) {
        // Check if this is a user-defined function (not an intrinsic)
        const symbol = this.symbolTable.lookup(calleeName);
        if (symbol && isFunctionSymbol(symbol)) {
          this.callGraph.addCall(
            this.currentFunction,
            calleeName,
            node.getLocation()
          );
        } else if (!symbol || symbol.kind !== SymbolKind.Intrinsic) {
          // If symbol not found or not an intrinsic, still record the call
          // (might be defined elsewhere or an error that will be caught later)
          this.callGraph.addCall(
            this.currentFunction,
            calleeName,
            node.getLocation()
          );
        }
        // Skip intrinsics - they don't participate in the call graph
      }
    }

    // Continue traversal to find nested calls in arguments
    super.visitCallExpression(node);
  }
}