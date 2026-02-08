/**
 * Dependency Graph - Module dependency tracking with cycle detection
 *
 * This module provides infrastructure for tracking module dependencies,
 * detecting circular imports, and determining compilation order through
 * topological sorting.
 *
 * @module semantic/dependency-graph
 */

import type { SourceLocation } from '../ast/base.js';

/**
 * Represents a dependency edge between two modules
 */
export interface DependencyEdge {
  /** Source module name */
  from: string;

  /** Target module name */
  to: string;

  /** Location of the import declaration (for error reporting) */
  importLocation: SourceLocation;
}

/**
 * Module dependency graph
 *
 * Tracks which modules import which other modules.
 * Provides cycle detection and topological sorting for determining
 * compilation order (dependencies must be compiled before dependents).
 *
 * **Algorithm Details:**
 * - **Cycle Detection**: Depth-first search with recursion stack
 * - **Topological Sort**: Post-order DFS (reversed)
 *
 * **Example:**
 * ```typescript
 * const graph = new DependencyGraph();
 * graph.addEdge('A', 'B', location);
 * graph.addEdge('B', 'C', location);
 *
 * // Get compilation order: ['C', 'B', 'A']
 * const order = graph.getTopologicalOrder();
 * ```
 */
export class DependencyGraph {
  /**
   * All dependency edges in the graph
   */
  protected edges: DependencyEdge[] = [];

  /**
   * Adjacency list representation: module -> list of modules it imports
   */
  protected adjacencyList: Map<string, string[]> = new Map();

  /**
   * Register a module in the graph without adding dependencies
   *
   * Ensures the module is included in topological sort even if it has no imports.
   * This is important for standalone modules that don't import anything.
   *
   * @param moduleName - Module name to register
   *
   * @example
   * ```typescript
   * // Register standalone module
   * graph.addNode('standalone');
   * const order = graph.getTopologicalOrder();
   * // Returns: ['standalone']
   * ```
   */
  public addNode(moduleName: string): void {
    // Create empty adjacency list if not exists
    if (!this.adjacencyList.has(moduleName)) {
      this.adjacencyList.set(moduleName, []);
    }
  }

  /**
   * Add a dependency edge to the graph
   *
   * Records that module `from` imports module `to`.
   *
   * @param from - Source module name
   * @param to - Target module name (the imported module)
   * @param location - Location of the import declaration
   *
   * @example
   * ```typescript
   * // Module 'game' imports from 'c64.screen'
   * graph.addEdge('game', 'c64.screen', importLocation);
   * ```
   */
  public addEdge(from: string, to: string, location: SourceLocation): void {
    // Store the edge with location for error reporting
    this.edges.push({ from, to, importLocation: location });

    // Update adjacency list for graph algorithms
    if (!this.adjacencyList.has(from)) {
      this.adjacencyList.set(from, []);
    }
    this.adjacencyList.get(from)!.push(to);
  }

  /**
   * Detect circular dependencies in the module graph
   *
   * Uses depth-first search with a recursion stack to identify back edges,
   * which indicate cycles.
   *
   * @returns Array of cycles, where each cycle is an array of module names
   *          forming a circular import chain
   *
   * @example
   * ```typescript
   * const cycles = graph.detectCycles();
   * // Returns: [['A', 'B', 'C', 'A'], ['X', 'Y', 'X']]
   * ```
   */
  public detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Check each connected component
    for (const node of this.adjacencyList.keys()) {
      if (!visited.has(node)) {
        this.detectCyclesHelper(node, visited, recursionStack, [], cycles);
      }
    }

    return cycles;
  }

  /**
   * Helper method for cycle detection using DFS
   *
   * @param node - Current node being visited
   * @param visited - Set of all visited nodes (across all DFS trees)
   * @param recursionStack - Set of nodes in current DFS path (detects back edges)
   * @param path - Current path from root to node
   * @param cycles - Accumulator for detected cycles
   */
  protected detectCyclesHelper(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: string[][]
  ): void {
    // Mark node as visited and add to recursion stack
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    // Explore all neighbors
    const neighbors = this.adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        // Tree edge - continue DFS
        this.detectCyclesHelper(neighbor, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(neighbor)) {
        // Back edge - found a cycle!
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycle.push(neighbor); // Close the cycle
        cycles.push(cycle);
      }
      // Cross edge - ignore (already processed)
    }

    // Backtrack: remove from recursion stack and path
    path.pop();
    recursionStack.delete(node);
  }

  /**
   * Check if the graph contains any cycles
   *
   * @returns true if circular dependencies exist, false otherwise
   *
   * @example
   * ```typescript
   * if (graph.hasCycles()) {
   *   const cycles = graph.detectCycles();
   *   console.error('Circular imports:', cycles);
   * }
   * ```
   */
  public hasCycles(): boolean {
    return this.detectCycles().length > 0;
  }

  /**
   * Get topological order for compilation
   *
   * Returns modules in dependency order: dependencies appear before dependents.
   * This ensures modules are compiled after their dependencies.
   *
   * Uses post-order DFS traversal (reversed).
   *
   * @returns Module names in compilation order (leaves first, roots last)
   * @throws Error if the graph contains cycles
   *
   * @example
   * ```typescript
   * // Graph: A → B → C
   * const order = graph.getTopologicalOrder();
   * // Returns: ['C', 'B', 'A']
   * ```
   */
  public getTopologicalOrder(): string[] {
    // Cannot compute topological order if cycles exist
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      const cycleStrings = cycles.map(cycle => cycle.join(' → ')).join(', ');
      throw new Error(
        `Cannot compute topological order: circular dependencies exist (${cycleStrings})`
      );
    }

    const visited = new Set<string>();
    const stack: string[] = [];

    // Visit all nodes (handles disconnected components)
    const allNodes = new Set([
      ...this.adjacencyList.keys(),
      ...Array.from(this.adjacencyList.values()).flat(),
    ]);

    for (const node of allNodes) {
      if (!visited.has(node)) {
        this.topologicalSortHelper(node, visited, stack);
      }
    }

    // Post-order DFS already gives correct dependency order (leaves first)
    return stack;
  }

  /**
   * Helper method for topological sort using post-order DFS
   *
   * @param node - Current node being visited
   * @param visited - Set of visited nodes
   * @param stack - Stack for post-order traversal
   */
  protected topologicalSortHelper(node: string, visited: Set<string>, stack: string[]): void {
    visited.add(node);

    // Visit all neighbors first (post-order)
    const neighbors = this.adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.topologicalSortHelper(neighbor, visited, stack);
      }
    }

    // Add node after visiting all dependencies
    stack.push(node);
  }

  /**
   * Get direct dependencies of a module
   *
   * Returns the list of modules that the specified module imports directly.
   *
   * @param moduleName - The module to get dependencies for
   * @returns Array of module names that are direct dependencies
   *
   * @example
   * ```typescript
   * const deps = graph.getModuleDependencies('game');
   * // Returns: ['c64.screen', 'c64.sprites', 'utils']
   * ```
   */
  public getModuleDependencies(moduleName: string): string[] {
    return [...(this.adjacencyList.get(moduleName) || [])];
  }

  /**
   * Get all dependency edges in the graph
   *
   * Returns a copy of all edges to prevent external modification.
   *
   * @returns Array of dependency edges
   */
  public getEdges(): DependencyEdge[] {
    return [...this.edges];
  }

  /**
   * Get all modules in the graph
   *
   * Includes both modules that import others and modules that are imported.
   *
   * @returns Array of all module names in the graph
   */
  public getAllModules(): string[] {
    const modules = new Set<string>();

    // Add all source modules
    for (const node of this.adjacencyList.keys()) {
      modules.add(node);
    }

    // Add all target modules
    for (const targets of this.adjacencyList.values()) {
      for (const target of targets) {
        modules.add(target);
      }
    }

    return Array.from(modules);
  }

  /**
   * Get the number of edges in the graph
   *
   * @returns Total number of dependency edges
   */
  public getEdgeCount(): number {
    return this.edges.length;
  }

  /**
   * Check if a module exists in the graph
   *
   * @param moduleName - Module name to check
   * @returns true if the module is in the graph (as source or target)
   */
  public hasModule(moduleName: string): boolean {
    return this.getAllModules().includes(moduleName);
  }

  /**
   * Clear all edges and reset the graph
   */
  public clear(): void {
    this.edges = [];
    this.adjacencyList.clear();
  }
}
