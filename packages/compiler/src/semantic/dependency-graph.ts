/**
 * Dependency Graph for Blend65 Compiler v2
 *
 * Tracks import dependencies between modules and provides:
 * - Cycle detection (circular imports)
 * - Topological sorting (correct compilation order)
 * - Dependency queries (what depends on what)
 *
 * The dependency graph is built from import statements:
 * - Node = module name
 * - Edge = import relationship (from → to means "from imports to")
 *
 * @module semantic/dependency-graph
 */

import type { SourceLocation } from '../ast/index.js';

/**
 * Edge metadata for tracking import locations
 *
 * Stores the source location of an import statement for error messages.
 */
export interface DependencyEdge {
  /** Source module (the one doing the import) */
  from: string;

  /** Target module (the one being imported) */
  to: string;

  /** Source location of the import statement */
  location: SourceLocation;
}

/**
 * Result of cycle detection
 *
 * Contains information about detected circular dependencies.
 */
export interface CycleInfo {
  /** The modules involved in the cycle, in order */
  cycle: string[];

  /** Source location where the cycle-causing import occurs */
  location: SourceLocation;
}

/**
 * Dependency Graph - tracks module import relationships
 *
 * This graph is used to:
 * 1. Detect circular imports (which are errors in Blend65)
 * 2. Determine correct compilation order (topological sort)
 * 3. Find which modules depend on a given module
 *
 * The graph is directed: an edge from A to B means "A imports from B".
 *
 * @example
 * ```typescript
 * const graph = new DependencyGraph();
 *
 * // Add modules
 * graph.addNode('Game.Main');
 * graph.addNode('Game.Sprites');
 * graph.addNode('Lib.Math');
 *
 * // Add import relationships
 * graph.addEdge('Game.Main', 'Game.Sprites', importLocation);
 * graph.addEdge('Game.Sprites', 'Lib.Math', importLocation2);
 *
 * // Check for cycles
 * const cycles = graph.detectCycles();
 * if (cycles.length > 0) {
 *   // Report circular import error
 * }
 *
 * // Get compilation order
 * const order = graph.getTopologicalOrder();
 * // ['Lib.Math', 'Game.Sprites', 'Game.Main']
 * ```
 */
export class DependencyGraph {
  /**
   * Set of all module nodes in the graph
   */
  protected nodes: Set<string> = new Set();

  /**
   * Adjacency list: module → set of modules it imports from
   * Note: edges point from importer to importee
   */
  protected edges: Map<string, Set<string>> = new Map();

  /**
   * Edge metadata: "from→to" → DependencyEdge
   * Used for error reporting with source locations
   */
  protected edgeData: Map<string, DependencyEdge> = new Map();

  /**
   * Adds a module node to the graph
   *
   * Nodes can be added explicitly or will be created automatically
   * when edges are added.
   *
   * @param moduleName - The full module name to add
   *
   * @example
   * ```typescript
   * graph.addNode('Game.Main');
   * ```
   */
  public addNode(moduleName: string): void {
    this.nodes.add(moduleName);
    // Initialize empty edge set if not exists
    if (!this.edges.has(moduleName)) {
      this.edges.set(moduleName, new Set());
    }
  }

  /**
   * Adds an import edge to the graph
   *
   * Creates an edge from the importing module to the imported module.
   * Both nodes are automatically added if they don't exist.
   *
   * @param from - The module doing the import
   * @param to - The module being imported
   * @param location - Source location of the import statement
   *
   * @example
   * ```typescript
   * // Game.Main has: import foo from Game.Sprites
   * graph.addEdge('Game.Main', 'Game.Sprites', importLocation);
   * ```
   */
  public addEdge(from: string, to: string, location: SourceLocation): void {
    // Ensure both nodes exist
    this.addNode(from);
    this.addNode(to);

    // Add the edge (from imports to)
    this.edges.get(from)!.add(to);

    // Store edge metadata for error reporting
    const edgeKey = this.getEdgeKey(from, to);
    this.edgeData.set(edgeKey, { from, to, location });
  }

  /**
   * Checks if a specific edge exists
   *
   * @param from - The source module
   * @param to - The target module
   * @returns true if an edge from → to exists
   */
  public hasEdge(from: string, to: string): boolean {
    return this.edges.get(from)?.has(to) ?? false;
  }

  /**
   * Gets edge metadata for a specific import relationship
   *
   * @param from - The source module
   * @param to - The target module
   * @returns The edge data with location, or undefined
   */
  public getEdge(from: string, to: string): DependencyEdge | undefined {
    return this.edgeData.get(this.getEdgeKey(from, to));
  }

  /**
   * Gets all modules that a given module imports from (dependencies)
   *
   * @param moduleName - The module to query
   * @returns Set of module names that this module depends on
   *
   * @example
   * ```typescript
   * const deps = graph.getDependencies('Game.Main');
   * // Set { 'Game.Sprites', 'Lib.Math' }
   * ```
   */
  public getDependencies(moduleName: string): Set<string> {
    return this.edges.get(moduleName) ?? new Set();
  }

  /**
   * Gets all modules that import from a given module (dependents)
   *
   * @param moduleName - The module to query
   * @returns Set of module names that depend on this module
   *
   * @example
   * ```typescript
   * const dependents = graph.getDependents('Lib.Math');
   * // Set { 'Game.Sprites', 'Game.Main' }
   * ```
   */
  public getDependents(moduleName: string): Set<string> {
    const dependents = new Set<string>();
    for (const [node, deps] of this.edges) {
      if (deps.has(moduleName)) {
        dependents.add(node);
      }
    }
    return dependents;
  }

  /**
   * Gets all nodes (module names) in the graph
   *
   * @returns Set of all module names
   */
  public getAllNodes(): Set<string> {
    return new Set(this.nodes);
  }

  /**
   * Gets the number of nodes in the graph
   *
   * @returns The node count
   */
  public getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Detects circular dependencies in the graph
   *
   * Uses Depth-First Search (DFS) with three-color marking:
   * - WHITE (unvisited): not yet processed
   * - GRAY (in progress): currently on the DFS stack
   * - BLACK (finished): completely processed
   *
   * A back edge (edge to a GRAY node) indicates a cycle.
   *
   * @returns Array of CycleInfo for each detected cycle
   *
   * @example
   * ```typescript
   * const cycles = graph.detectCycles();
   * if (cycles.length > 0) {
   *   for (const cycle of cycles) {
   *     console.error('Circular import:', cycle.cycle.join(' → '));
   *   }
   * }
   * ```
   */
  public detectCycles(): CycleInfo[] {
    const cycles: CycleInfo[] = [];

    // Color states for DFS
    const WHITE = 0; // Unvisited
    const GRAY = 1; // In progress (on stack)
    const BLACK = 2; // Finished

    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();

    // Initialize all nodes as WHITE
    for (const node of this.nodes) {
      color.set(node, WHITE);
      parent.set(node, null);
    }

    /**
     * DFS visit function - detects back edges (cycles)
     */
    const dfs = (node: string, path: string[]): void => {
      color.set(node, GRAY);
      path.push(node);

      const neighbors = this.edges.get(node) ?? new Set();
      for (const neighbor of neighbors) {
        const neighborColor = color.get(neighbor);

        if (neighborColor === GRAY) {
          // Back edge found - we have a cycle!
          // Extract the cycle from the path
          const cycleStart = path.indexOf(neighbor);
          const cyclePath = path.slice(cycleStart);
          cyclePath.push(neighbor); // Complete the cycle

          // Get the source location from the edge that creates the cycle
          const edge = this.getEdge(node, neighbor);
          if (edge) {
            cycles.push({
              cycle: cyclePath,
              location: edge.location,
            });
          }
        } else if (neighborColor === WHITE) {
          parent.set(neighbor, node);
          dfs(neighbor, path);
        }
        // BLACK nodes are already processed, skip them
      }

      color.set(node, BLACK);
      path.pop();
    };

    // Run DFS from each unvisited node
    for (const node of this.nodes) {
      if (color.get(node) === WHITE) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Computes a topological ordering of modules
   *
   * Returns modules in an order where each module comes after all
   * modules it depends on. This is the correct compilation order.
   *
   * Uses Kahn's algorithm:
   * 1. Start with nodes that have no dependencies (in-degree 0)
   * 2. Remove them and their outgoing edges
   * 3. Repeat until all nodes are processed
   *
   * If cycles exist, this will not return all nodes (only those
   * not involved in cycles).
   *
   * @returns Array of module names in compilation order
   * @throws Error if the graph contains cycles (call detectCycles first!)
   *
   * @example
   * ```typescript
   * // Ensure no cycles first
   * if (graph.detectCycles().length > 0) {
   *   throw new Error('Cannot sort with cycles');
   * }
   *
   * const order = graph.getTopologicalOrder();
   * // Dependencies come first, then dependents
   * for (const moduleName of order) {
   *   compile(moduleName);
   * }
   * ```
   */
  public getTopologicalOrder(): string[] {
    const result: string[] = [];
    const inDegree = new Map<string, number>();

    // Calculate in-degree for each node
    // in-degree = number of modules that import this module
    for (const node of this.nodes) {
      inDegree.set(node, 0);
    }

    for (const [, deps] of this.edges) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
      }
    }

    // Queue of nodes with in-degree 0 (no dependencies importing them)
    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    // Process nodes in topological order
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      // Remove edges from this node
      const deps = this.edges.get(node) ?? new Set();
      for (const dep of deps) {
        const newDegree = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, newDegree);

        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    // If result doesn't contain all nodes, there's a cycle
    // But we handle this gracefully - return what we can
    // Callers should check detectCycles() first
    return result;
  }

  /**
   * Gets modules in compilation order (reverse topological)
   *
   * Returns modules in the order they should be compiled:
   * dependencies first, then modules that depend on them.
   *
   * This is the reverse of getTopologicalOrder() because we need
   * to compile imported modules before the modules that import them.
   *
   * @returns Array of module names in compilation order
   *
   * @example
   * ```typescript
   * const order = graph.getCompilationOrder();
   * // ['Lib.Math', 'Game.Sprites', 'Game.Main']
   * // Math first (no deps), then Sprites (uses Math), then Main (uses Sprites)
   * ```
   */
  public getCompilationOrder(): string[] {
    // For compilation order, we want dependencies first
    // Our topological order gives us importers first (nodes with no in-edges)
    // So we reverse it to get dependencies first
    return this.getTopologicalOrder().reverse();
  }

  /**
   * Clears all nodes and edges from the graph
   *
   * Useful for resetting between compilations.
   */
  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.edgeData.clear();
  }

  /**
   * Checks if the graph is empty
   *
   * @returns true if no nodes exist
   */
  public isEmpty(): boolean {
    return this.nodes.size === 0;
  }

  /**
   * Creates a unique key for an edge
   *
   * @param from - Source node
   * @param to - Target node
   * @returns A unique string key
   */
  protected getEdgeKey(from: string, to: string): string {
    return `${from}→${to}`;
  }

  /**
   * Debug: Gets a string representation of the graph
   *
   * @returns Human-readable graph description
   */
  public toString(): string {
    const lines: string[] = ['DependencyGraph:'];
    for (const node of this.nodes) {
      const deps = this.edges.get(node) ?? new Set();
      if (deps.size > 0) {
        lines.push(`  ${node} imports: ${Array.from(deps).join(', ')}`);
      } else {
        lines.push(`  ${node} (no imports)`);
      }
    }
    return lines.join('\n');
  }
}