/**
 * Control Flow Graph (CFG) Infrastructure for Blend65 Compiler
 *
 * Provides data structures and algorithms for control flow analysis including:
 * - CFG construction from AST
 * - Reachability analysis
 * - Dead code detection
 * - Path analysis
 *
 * This is Phase 5 of the semantic analyzer implementation.
 */

import type { Statement } from '../ast/base.js';

/**
 * Types of control flow graph nodes
 *
 * Each node type represents a different control flow construct:
 * - Entry/Exit: Function boundaries
 * - Statement: Regular executable statement
 * - Branch: Conditional branch (if statement)
 * - Loop: Loop header (while/for condition)
 * - Return: Function return point
 * - Break: Loop exit via break
 * - Continue: Loop restart via continue
 */
export enum CFGNodeKind {
  /** Function entry point */
  Entry = 'Entry',
  /** Function exit point */
  Exit = 'Exit',
  /** Regular statement */
  Statement = 'Statement',
  /** Branch condition (if) */
  Branch = 'Branch',
  /** Loop condition (while/for) */
  Loop = 'Loop',
  /** Return statement */
  Return = 'Return',
  /** Break statement */
  Break = 'Break',
  /** Continue statement */
  Continue = 'Continue',
}

/**
 * Control flow graph node
 *
 * Represents a single point in the control flow with edges to
 * predecessor and successor nodes.
 *
 * **Reachability:**
 * A node is reachable if there exists a path from the entry node to it.
 * The reachability flag is computed by `ControlFlowGraph.computeReachability()`.
 *
 * **Edges:**
 * - Predecessors: Nodes that can flow into this node
 * - Successors: Nodes that this node can flow to
 *
 * @example
 * ```typescript
 * // Simple sequence: node1 → node2
 * cfg.addEdge(node1, node2);
 * // node1.successors = [node2]
 * // node2.predecessors = [node1]
 *
 * // Branch: branch → [thenNode, elseNode]
 * cfg.addEdge(branchNode, thenNode);
 * cfg.addEdge(branchNode, elseNode);
 * ```
 */
export interface CFGNode {
  /** Unique node identifier */
  id: string;

  /** Type of control flow node */
  kind: CFGNodeKind;

  /** Associated AST statement (null for entry/exit/merge nodes) */
  statement: Statement | null;

  /** Nodes that flow into this node */
  predecessors: CFGNode[];

  /** Nodes that this node flows to */
  successors: CFGNode[];

  /** Is this node reachable from entry? (computed by reachability analysis) */
  reachable: boolean;

  /** Optional metadata for analysis passes */
  metadata?: Map<string, unknown>;
}

/**
 * Control Flow Graph for a function
 *
 * Represents the control flow structure of a function with:
 * - Entry and exit nodes
 * - All statement nodes
 * - Control flow edges
 * - Reachability information
 *
 * **Construction Pattern:**
 * ```typescript
 * const cfg = new ControlFlowGraph();
 *
 * // Create nodes for statements
 * const stmt1 = cfg.createNode(CFGNodeKind.Statement, statement1);
 * const stmt2 = cfg.createNode(CFGNodeKind.Statement, statement2);
 *
 * // Connect nodes
 * cfg.addEdge(cfg.entry, stmt1);
 * cfg.addEdge(stmt1, stmt2);
 * cfg.addEdge(stmt2, cfg.exit);
 *
 * // Compute reachability
 * cfg.computeReachability();
 *
 * // Check for unreachable code
 * const unreachable = cfg.getUnreachableNodes();
 * ```
 *
 * **Entry and Exit Nodes:**
 * - Entry: Always the first node, represents function start
 * - Exit: Always the last node, represents function end
 * - All return statements connect to exit node
 * - Functions without explicit return connect last statement to exit
 */
export class ControlFlowGraph {
  /** Entry node (function start) */
  public entry: CFGNode;

  /** Exit node (function end) */
  public exit: CFGNode;

  /** All nodes in the graph (indexed by ID) */
  protected nodes: Map<string, CFGNode>;

  /** Counter for generating unique node IDs */
  protected nodeCounter: number;

  /**
   * Create a new control flow graph
   *
   * Initializes with entry and exit nodes.
   */
  constructor() {
    this.nodeCounter = 0;
    this.nodes = new Map();

    // Create entry and exit nodes
    this.entry = this.createNode(CFGNodeKind.Entry, null);
    this.exit = this.createNode(CFGNodeKind.Exit, null);
  }

  /**
   * Create a new CFG node
   *
   * Creates a node with unique ID and adds it to the graph.
   * The node starts as unreachable; reachability is computed later.
   *
   * @param kind Type of control flow node
   * @param statement Associated AST statement (null for structural nodes)
   * @returns The created node
   *
   * @example
   * ```typescript
   * const returnNode = cfg.createNode(CFGNodeKind.Return, returnStmt);
   * const mergeNode = cfg.createNode(CFGNodeKind.Statement, null);
   * ```
   */
  public createNode(kind: CFGNodeKind, statement: Statement | null): CFGNode {
    const node: CFGNode = {
      id: `node_${this.nodeCounter++}`,
      kind,
      statement,
      predecessors: [],
      successors: [],
      reachable: false,
      metadata: new Map<string, unknown>(),
    };

    this.nodes.set(node.id, node);
    return node;
  }

  /**
   * Add a control flow edge from one node to another
   *
   * Updates both predecessors and successors lists.
   * Automatically prevents duplicate edges.
   *
   * @param from Source node
   * @param to Destination node
   *
   * @example
   * ```typescript
   * // Sequential flow
   * cfg.addEdge(node1, node2);
   *
   * // Branch (two edges from same source)
   * cfg.addEdge(branchNode, thenNode);
   * cfg.addEdge(branchNode, elseNode);
   *
   * // Merge (two edges to same destination)
   * cfg.addEdge(thenNode, mergeNode);
   * cfg.addEdge(elseNode, mergeNode);
   * ```
   */
  public addEdge(from: CFGNode, to: CFGNode): void {
    // Add to successors if not already present
    if (!from.successors.includes(to)) {
      from.successors.push(to);
    }

    // Add to predecessors if not already present
    if (!to.predecessors.includes(from)) {
      to.predecessors.push(from);
    }
  }

  /**
   * Get all nodes in the graph
   *
   * Returns array of all nodes including entry, exit, and all statement nodes.
   *
   * @returns Array of all CFG nodes
   */
  public getNodes(): CFGNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Compute reachability for all nodes
   *
   * Performs depth-first search from entry node to mark all reachable nodes.
   * After this runs:
   * - All reachable nodes have `reachable = true`
   * - All unreachable nodes have `reachable = false`
   *
   * **Algorithm:**
   * 1. Mark all nodes as unreachable
   * 2. Mark entry as reachable
   * 3. DFS from entry following successor edges
   * 4. Mark each visited node as reachable
   *
   * **Note:** Exit node may be unreachable if all paths return early
   * or have infinite loops.
   *
   * @example
   * ```typescript
   * cfg.computeReachability();
   *
   * // Check if all paths reach exit
   * if (!cfg.exit.reachable) {
   *   console.log('Not all paths reach function end');
   * }
   *
   * // Find dead code
   * const deadCode = cfg.getUnreachableNodes();
   * ```
   */
  public computeReachability(): void {
    // Reset all nodes to unreachable
    for (const node of this.nodes.values()) {
      node.reachable = false;
    }

    // Entry is always reachable
    this.entry.reachable = true;

    // DFS from entry to mark reachable nodes
    const visited = new Set<string>();
    const stack: CFGNode[] = [this.entry];

    while (stack.length > 0) {
      const node = stack.pop()!;

      // Skip if already visited
      if (visited.has(node.id)) {
        continue;
      }

      visited.add(node.id);
      node.reachable = true;

      // Add successors to stack
      for (const successor of node.successors) {
        if (!visited.has(successor.id)) {
          stack.push(successor);
        }
      }
    }
  }

  /**
   * Check if all paths from entry reach exit
   *
   * Returns true if the exit node is reachable from entry.
   * This indicates that at least one execution path reaches the end of the function.
   *
   * **Note:** This does NOT mean all paths reach exit (some may return early).
   * It means SOME path reaches exit.
   *
   * @returns True if exit is reachable
   *
   * @example
   * ```typescript
   * if (cfg.allPathsReachExit() && functionHasReturnType) {
   *   // At least one path doesn't return - might be an error
   * }
   * ```
   */
  public allPathsReachExit(): boolean {
    return this.exit.reachable;
  }

  /**
   * Get all unreachable nodes (dead code)
   *
   * Returns array of nodes that cannot be reached from entry.
   * Excludes the exit node (it's okay for exit to be unreachable).
   *
   * **Use cases:**
   * - Dead code warnings
   * - Code coverage analysis
   * - Optimization opportunities
   *
   * @returns Array of unreachable nodes
   *
   * @example
   * ```typescript
   * const deadCode = cfg.getUnreachableNodes();
   * for (const node of deadCode) {
   *   if (node.statement) {
   *     console.warn('Unreachable code at', node.statement.location);
   *   }
   * }
   * ```
   */
  public getUnreachableNodes(): CFGNode[] {
    return this.getNodes().filter(node => !node.reachable && node.kind !== CFGNodeKind.Exit);
  }

  /**
   * Get the number of nodes in the graph
   *
   * @returns Total node count including entry and exit
   */
  public getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Get the number of edges in the graph
   *
   * Counts all control flow edges.
   *
   * @returns Total edge count
   */
  public getEdgeCount(): number {
    let count = 0;
    for (const node of this.nodes.values()) {
      count += node.successors.length;
    }
    return count;
  }

  /**
   * Generate DOT format representation for visualization
   *
   * Creates a GraphViz DOT format string for visualizing the CFG.
   * Useful for debugging and documentation.
   *
   * @returns DOT format string
   *
   * @example
   * ```typescript
   * const dot = cfg.toDot();
   * // Save to file and run: dot -Tpng cfg.dot -o cfg.png
   * ```
   */
  public toDot(): string {
    const lines: string[] = [];
    lines.push('digraph CFG {');
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box];');
    lines.push('');

    // Add nodes
    for (const node of this.nodes.values()) {
      const label = this.getNodeLabel(node);
      const color = node.reachable ? 'black' : 'red';
      const style =
        node.kind === CFGNodeKind.Entry || node.kind === CFGNodeKind.Exit ? 'rounded' : 'solid';

      lines.push(`  ${node.id} [label="${label}", color=${color}, style=${style}];`);
    }

    lines.push('');

    // Add edges
    for (const node of this.nodes.values()) {
      for (const successor of node.successors) {
        lines.push(`  ${node.id} -> ${successor.id};`);
      }
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Get display label for a node
   *
   * Helper for DOT visualization.
   *
   * @param node The node to get label for
   * @returns Human-readable label
   */
  protected getNodeLabel(node: CFGNode): string {
    if (node.kind === CFGNodeKind.Entry) return 'ENTRY';
    if (node.kind === CFGNodeKind.Exit) return 'EXIT';

    if (node.statement) {
      const type = node.statement.getNodeType();
      return `${node.kind}\\n${type}`;
    }

    return node.kind;
  }
}
