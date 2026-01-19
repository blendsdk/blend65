/**
 * AST Collector Infrastructure for Blend65 Compiler
 *
 * Provides reusable collectors that gather information from AST during traversal.
 * Built on top of ASTWalker for automatic recursion and context tracking.
 *
 * Collectors accumulate data (nodes, strings, statistics) while walking the tree,
 * then return the collected results. Perfect for analysis passes that need to
 * gather information without modifying the AST.
 */

import { ASTWalker } from './base.js';
import { ASTNode } from '../base.js';

/**
 * Base class for collectors that gather information from AST
 *
 * Generic collector that maintains a collection of items of type T.
 * Subclasses override visit methods to add items to the collection
 * during traversal.
 *
 * **Design Philosophy:**
 * - **Accumulation**: Build up results during traversal
 * - **Type-safe**: Generic type T ensures type safety
 * - **Reusable**: Common pattern for many analysis passes
 * - **Composable**: Can use multiple collectors in sequence
 *
 * **Key Features:**
 * - Generic collection of type T[]
 * - Automatic result accumulation
 * - Clear distinction between collection and traversal
 * - Inherits all walker features (skip, stop, parent tracking)
 *
 * **Common Use Cases:**
 * - Collect all variables used in a function
 * - Find all function calls
 * - Gather all @map declarations
 * - Count nodes by type
 * - Build dependency graphs
 *
 * **Usage Pattern:**
 * ```typescript
 * class VariableCollector extends ASTCollector<string> {
 *   visitVariableDecl(node: VariableDecl): void {
 *     this.collect(node.getName());
 *     super.visitVariableDecl(node); // Continue traversal
 *   }
 * }
 *
 * const collector = new VariableCollector();
 * const variables = collector.run(program);
 * console.log('Found variables:', variables);
 * ```
 *
 * **Advanced Usage:**
 * ```typescript
 * // Collect with context
 * class FunctionBodyCollector extends ASTCollector<ASTNode> {
 *   visitFunctionDecl(node: FunctionDecl): void {
 *     // Collect all statements in function bodies
 *     for (const stmt of node.getBody()) {
 *       this.collect(stmt);
 *     }
 *     // Don't recurse into function bodies
 *     this.skip();
 *   }
 * }
 * ```
 *
 * @template T - The type of items being collected
 */
export abstract class ASTCollector<T> extends ASTWalker {
  /**
   * Collection of gathered items
   *
   * Accumulated during traversal via `collect()` method.
   * Reset at start of each `run()` call.
   *
   * Protected to allow subclasses to manipulate if needed,
   * but typically only accessed via `collect()` and `getResults()`.
   */
  protected items: T[] = [];

  /**
   * Run collector on AST and return results
   *
   * Main entry point that combines traversal and result extraction.
   * Automatically:
   * - Clears previous results
   * - Walks the AST
   * - Returns collected items
   *
   * **This is the method users should call**, not `walk()`.
   *
   * @param node - Root node to start collection from
   * @returns Array of collected items
   *
   * @example
   * ```typescript
   * const collector = new MyCollector();
   * const results = collector.run(program);
   * // results is now T[]
   * ```
   */
  public run(node: ASTNode): T[] {
    this.items = []; // Clear previous results
    this.walk(node); // Perform traversal
    return this.getResults(); // Return collected items
  }

  /**
   * Collect an item during traversal
   *
   * Called by subclasses to add items to the collection.
   * Can be called multiple times per node if needed.
   *
   * @param item - The item to collect
   *
   * @example
   * ```typescript
   * visitBinaryExpression(node: BinaryExpression): void {
   *   if (node.getOperator() === '+') {
   *     this.collect(node);
   *   }
   *   super.visitBinaryExpression(node);
   * }
   * ```
   */
  protected collect(item: T): void {
    this.items.push(item);
  }

  /**
   * Get current collection results
   *
   * Returns a **copy** of the items array to prevent external modification.
   * Called automatically by `run()`, but can be used during traversal
   * if needed (e.g., for debugging).
   *
   * @returns Copy of collected items
   *
   * @example
   * ```typescript
   * visitFunctionDecl(node: FunctionDecl): void {
   *   super.visitFunctionDecl(node);
   *   // Check intermediate results
   *   console.log('So far:', this.getResults().length);
   * }
   * ```
   */
  protected getResults(): T[] {
    return [...this.items];
  }

  /**
   * Get count of collected items
   *
   * Convenience method for checking collection size without
   * creating a copy of the array.
   *
   * @returns Number of items collected so far
   *
   * @example
   * ```typescript
   * visitIdentifierExpression(node: IdentifierExpression): void {
   *   this.collect(node.getName());
   *   if (this.getCount() >= this.maxItems) {
   *     this.stop(); // Found enough
   *   }
   *   super.visitIdentifierExpression(node);
   * }
   * ```
   */
  protected getCount(): number {
    return this.items.length;
  }

  /**
   * Clear collected items
   *
   * Can be called during traversal to reset collection
   * (e.g., when entering a new scope).
   *
   * Note: Usually not needed as `run()` clears automatically.
   *
   * @example
   * ```typescript
   * visitFunctionDecl(node: FunctionDecl): void {
   *   // Collect separately for each function
   *   const previousItems = this.getResults();
   *   this.clear();
   *   super.visitFunctionDecl(node);
   *   const functionItems = this.getResults();
   *   // Process function-specific items...
   *   this.items = previousItems; // Restore
   * }
   * ```
   */
  protected clear(): void {
    this.items = [];
  }
}

/**
 * Specialized collector for finding nodes matching a predicate
 *
 * Generic node finder that collects all AST nodes matching a
 * predicate function. More flexible than type-specific collectors.
 *
 * **Use Cases:**
 * - Find all nodes of specific type
 * - Find nodes matching complex criteria
 * - Locate nodes with specific properties
 * - Debug/analysis tools
 *
 * @example
 * ```typescript
 * // Find all binary additions
 * const additions = NodeFinder.find(program, (node) => {
 *   return node.getNodeType() === ASTNodeType.BINARY_EXPR &&
 *          (node as BinaryExpression).getOperator() === '+';
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Find all variables named "counter"
 * const counters = NodeFinder.find(program, (node) => {
 *   return node.getNodeType() === ASTNodeType.VARIABLE_DECL &&
 *          (node as VariableDecl).getName() === 'counter';
 * });
 * ```
 */
export class NodeFinder extends ASTCollector<ASTNode> {
  /**
   * Predicate function to test nodes
   */
  protected predicate: (node: ASTNode) => boolean;

  /**
   * Create node finder with predicate
   *
   * @param predicate - Function that returns true for nodes to collect
   */
  constructor(predicate: (node: ASTNode) => boolean) {
    super();
    this.predicate = predicate;
  }

  /**
   * Override enterNode to test every node
   *
   * Tests each node against predicate before visiting children.
   * This ensures we check every node in the tree.
   */
  protected enterNode(node: ASTNode): void {
    super.enterNode(node);

    // Test node against predicate
    if (this.predicate(node)) {
      this.collect(node);
    }
  }

  /**
   * Static helper for one-off searches
   *
   * Convenience method that creates finder, runs it, and returns results
   * in a single call. Perfect for quick searches.
   *
   * @param root - AST node to search from
   * @param predicate - Function that returns true for nodes to find
   * @returns Array of matching nodes
   *
   * @example
   * ```typescript
   * const identifiers = NodeFinder.find(program, (node) =>
   *   node.getNodeType() === ASTNodeType.IDENTIFIER_EXPR
   * );
   * ```
   */
  public static find(root: ASTNode, predicate: (node: ASTNode) => boolean): ASTNode[] {
    const finder = new NodeFinder(predicate);
    return finder.run(root);
  }
}

/**
 * Specialized collector for counting nodes by type
 *
 * Counts how many nodes of each type appear in the AST.
 * Useful for statistics, profiling, and analysis.
 *
 * Note: Extends ASTWalker directly (not ASTCollector) because
 * it accumulates into a single Map, not an array of items.
 *
 * **Use Cases:**
 * - AST statistics and metrics
 * - Complexity analysis
 * - Test coverage validation
 * - Performance profiling
 *
 * @example
 * ```typescript
 * const counter = new NodeCounter();
 * const counts = counter.run(program);
 * console.log('Node counts:', counts);
 * // { BINARY_EXPR: 42, IF_STMT: 7, ... }
 * ```
 */
export class NodeCounter extends ASTWalker {
  /**
   * Map of node type to count
   */
  protected counts: Map<string, number> = new Map();

  /**
   * Run counter on AST and return count map
   *
   * @param node - Root node to count from
   * @returns Map of node type to count
   */
  public run(node: ASTNode): Map<string, number> {
    this.counts = new Map();
    this.walk(node);
    return this.getCounts();
  }

  /**
   * Override enterNode to count every node
   */
  protected enterNode(node: ASTNode): void {
    super.enterNode(node);

    // Increment count for this node type
    const nodeType = node.getNodeType();
    const currentCount = this.counts.get(nodeType) || 0;
    this.counts.set(nodeType, currentCount + 1);
  }

  /**
   * Get current count map
   *
   * @returns Copy of count map
   */
  public getCounts(): Map<string, number> {
    return new Map(this.counts);
  }

  /**
   * Get count for specific node type
   *
   * @param nodeType - The node type to get count for
   * @returns Count of nodes of that type (0 if none)
   */
  public getCountForType(nodeType: string): number {
    return this.counts.get(nodeType) || 0;
  }

  /**
   * Get total node count
   *
   * @returns Total number of nodes visited
   */
  public getTotalCount(): number {
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Static helper for one-off counts
   *
   * @param root - AST node to count from
   * @returns Map of node type to count
   */
  public static count(root: ASTNode): Map<string, number> {
    const counter = new NodeCounter();
    return counter.run(root);
  }
}
