/**
 * Control Flow Graph (CFG) Infrastructure for Blend65 Compiler v2
 *
 * Provides data structures and algorithms for control flow analysis including:
 * - CFG construction from AST
 * - Reachability analysis
 * - Dead code detection
 * - Path analysis
 *
 * This is Phase 5 of the semantic analyzer implementation.
 *
 * **Design Decision: Simple CFG nodes vs BasicBlocks**
 * Unlike the IL layer which uses BasicBlocks for code generation,
 * the semantic analyzer uses simpler CFGNode structures for:
 * - Unreachable code detection
 * - Control flow validation
 * - Return path analysis
 *
 * The IL layer will build its own BasicBlock-based CFG for
 * register allocation and SSA construction.
 *
 * @module semantic/control-flow
 */

import type { Statement } from '../ast/base.js';

/**
 * Types of control flow graph nodes
 *
 * Each node type represents a different control flow construct:
 * - Entry/Exit: Function boundaries
 * - Statement: Regular executable statement
 * - Branch: Conditional branch (if statement)
 * - Loop: Loop header (while/for/do-while condition)
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
  /** Branch condition (if/else-if) */
  Branch = 'Branch',
  /** Loop condition (while/for/do-while) */
  Loop = 'Loop',
  /** Return statement */
  Return = 'Return',
  /** Break statement */
  Break = 'Break',
  /** Continue statement */
  Continue = 'Continue',
  /** Switch/Match case */
  Case = 'Case',
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
  readonly id: string;

  /** Type of control flow node */
  readonly kind: CFGNodeKind;

  /** Associated AST statement (null for entry/exit/merge nodes) */
  readonly statement: Statement | null;

  /** Nodes that flow into this node */
  readonly predecessors: CFGNode[];

  /** Nodes that this node flows to */
  readonly successors: CFGNode[];

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
 * const cfg = new ControlFlowGraph('functionName');
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
  /** Function name (for debugging and diagnostics) */
  public readonly functionName: string;

  /** Entry node (function start) */
  public readonly entry: CFGNode;

  /** Exit node (function end) */
  public readonly exit: CFGNode;

  /** All nodes in the graph (indexed by ID) */
  protected readonly nodes: Map<string, CFGNode>;

  /** Counter for generating unique node IDs */
  protected nodeCounter: number;

  /**
   * Create a new control flow graph
   *
   * Initializes with entry and exit nodes.
   *
   * @param functionName - Name of the function this CFG represents
   */
  constructor(functionName: string = 'anonymous') {
    this.functionName = functionName;
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
   * @param kind - Type of control flow node
   * @param statement - Associated AST statement (null for structural nodes)
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
      id: `${this.functionName}_node_${this.nodeCounter++}`,
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
   * @param from - Source node
   * @param to - Destination node
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
    // Note: Using 'as' to allow mutation of readonly arrays (internal use only)
    if (!from.successors.includes(to)) {
      (from.successors as CFGNode[]).push(to);
    }

    // Add to predecessors if not already present
    if (!to.predecessors.includes(from)) {
      (to.predecessors as CFGNode[]).push(from);
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
   * Get a node by ID
   *
   * @param id - Node identifier
   * @returns The node, or undefined if not found
   */
  public getNode(id: string): CFGNode | undefined {
    return this.nodes.get(id);
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
  public exitIsReachable(): boolean {
    return this.exit.reachable;
  }

  /**
   * Get all unreachable nodes (dead code)
   *
   * Returns array of nodes that cannot be reached from entry.
   * Excludes the exit node (it's okay for exit to be unreachable if all paths return).
   *
   * **Use cases:**
   * - Dead code warnings
   * - Code coverage analysis
   * - Optimization opportunities
   *
   * @returns Array of unreachable nodes with statements
   *
   * @example
   * ```typescript
   * const deadCode = cfg.getUnreachableNodes();
   * for (const node of deadCode) {
   *   if (node.statement) {
   *     console.warn('Unreachable code at', node.statement.getLocation());
   *   }
   * }
   * ```
   */
  public getUnreachableNodes(): CFGNode[] {
    return this.getNodes().filter(
      node => !node.reachable && node.kind !== CFGNodeKind.Exit && node.statement !== null
    );
  }

  /**
   * Get all nodes that have statements
   *
   * Filters to only nodes with associated AST statements.
   *
   * @returns Array of nodes with statements
   */
  public getStatementNodes(): CFGNode[] {
    return this.getNodes().filter(node => node.statement !== null);
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
   * Check if a node terminates control flow
   *
   * A terminating node is one that doesn't fall through to the next statement:
   * - Return: Exits function
   * - Break: Exits loop
   * - Continue: Jumps to loop header
   *
   * @param node - Node to check
   * @returns True if node terminates control flow
   */
  public isTerminating(node: CFGNode): boolean {
    return (
      node.kind === CFGNodeKind.Return ||
      node.kind === CFGNodeKind.Break ||
      node.kind === CFGNodeKind.Continue
    );
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
    lines.push(`digraph CFG_${this.functionName} {`);
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box];');
    lines.push('');

    // Add nodes
    for (const node of this.nodes.values()) {
      const label = this.getNodeLabel(node);
      const color = node.reachable ? 'black' : 'red';
      const style =
        node.kind === CFGNodeKind.Entry || node.kind === CFGNodeKind.Exit ? 'rounded' : 'solid';

      // Escape special characters for DOT format
      const escapedLabel = label.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      lines.push(
        `  "${node.id}" [label="${escapedLabel}", color=${color}, style="${style}"];`
      );
    }

    lines.push('');

    // Add edges
    for (const node of this.nodes.values()) {
      for (const successor of node.successors) {
        lines.push(`  "${node.id}" -> "${successor.id}";`);
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
   * @param node - The node to get label for
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

  /**
   * Get a summary string for debugging
   *
   * @returns Summary string with node and edge counts
   */
  public toString(): string {
    return `CFG(${this.functionName}): ${this.getNodeCount()} nodes, ${this.getEdgeCount()} edges`;
  }
}

/**
 * Loop context for break/continue handling during CFG construction
 *
 * Tracks the entry and exit points of a loop for connecting
 * break and continue statements.
 */
export interface LoopContext {
  /** Loop entry node (where continue jumps to) */
  readonly entry: CFGNode;
  /** Loop exit node (where break jumps to) */
  readonly exit: CFGNode;
}

/**
 * CFG Builder utility class
 *
 * Provides a higher-level API for building CFGs with automatic
 * tracking of current insertion point and loop contexts.
 *
 * @example
 * ```typescript
 * const builder = new CFGBuilder('myFunction');
 *
 * // Add statements (automatically chains them)
 * builder.addStatement(stmt1);
 * builder.addStatement(stmt2);
 *
 * // Handle branches
 * const branchNode = builder.startBranch(ifStmt);
 * // ... build then branch ...
 * const thenExit = builder.getCurrentNode();
 *
 * builder.startAlternate(branchNode);
 * // ... build else branch ...
 * const elseExit = builder.getCurrentNode();
 *
 * builder.mergeBranches([thenExit, elseExit]);
 * ```
 */
export class CFGBuilder {
  /** The CFG being built */
  public readonly cfg: ControlFlowGraph;

  /** Current insertion point (null means unreachable) */
  protected currentNode: CFGNode | null;

  /** Loop stack for break/continue (innermost loop at end) */
  protected loopStack: LoopContext[];

  /**
   * Create a new CFG builder
   *
   * @param functionName - Name of the function
   */
  constructor(functionName: string) {
    this.cfg = new ControlFlowGraph(functionName);
    this.currentNode = this.cfg.entry;
    this.loopStack = [];
  }

  /**
   * Get the current insertion point
   *
   * Returns null if code is unreachable.
   *
   * @returns Current node or null
   */
  public getCurrentNode(): CFGNode | null {
    return this.currentNode;
  }

  /**
   * Set the current insertion point
   *
   * @param node - Node to set as current (null for unreachable)
   */
  public setCurrentNode(node: CFGNode | null): void {
    this.currentNode = node;
  }

  /**
   * Check if current code is reachable
   *
   * @returns True if current code is reachable
   */
  public isReachable(): boolean {
    return this.currentNode !== null;
  }

  /**
   * Add a statement node and chain from current position
   *
   * If current position is unreachable, still creates the node
   * but doesn't connect it (the node will be detected as dead code).
   *
   * @param kind - Node kind
   * @param statement - AST statement
   * @returns The created node
   */
  public addNode(kind: CFGNodeKind, statement: Statement | null): CFGNode {
    const node = this.cfg.createNode(kind, statement);

    if (this.currentNode) {
      this.cfg.addEdge(this.currentNode, node);
    }

    this.currentNode = node;
    return node;
  }

  /**
   * Add a simple statement node
   *
   * Convenience method for adding Statement kind nodes.
   *
   * @param statement - AST statement
   * @returns The created node
   */
  public addStatement(statement: Statement): CFGNode {
    return this.addNode(CFGNodeKind.Statement, statement);
  }

  /**
   * Add a return statement and terminate control flow
   *
   * Connects to exit and sets current node to null.
   *
   * @param statement - Return statement
   * @returns The created node
   */
  public addReturn(statement: Statement): CFGNode {
    const node = this.addNode(CFGNodeKind.Return, statement);
    this.cfg.addEdge(node, this.cfg.exit);
    this.currentNode = null;
    return node;
  }

  /**
   * Start a branch (if statement)
   *
   * Creates a branch node but doesn't advance currentNode.
   * Caller should save the branch node to create alternate branches.
   *
   * @param statement - If statement
   * @returns The branch node
   */
  public startBranch(statement: Statement): CFGNode {
    const branchNode = this.addNode(CFGNodeKind.Branch, statement);
    return branchNode;
  }

  /**
   * Start an alternate branch path (else branch)
   *
   * Sets current node to the branch node to start a new path.
   *
   * @param branchNode - The original branch node
   */
  public startAlternate(branchNode: CFGNode): void {
    this.currentNode = branchNode;
  }

  /**
   * Merge multiple branch paths
   *
   * Creates a merge node and connects all non-null exits to it.
   * If all exits are null (all paths terminate), sets current to null.
   *
   * @param exits - Exit nodes from each branch (null = terminated)
   * @returns The merge node, or null if all paths terminated
   */
  public mergeBranches(exits: (CFGNode | null)[]): CFGNode | null {
    const validExits = exits.filter((e): e is CFGNode => e !== null);

    if (validExits.length === 0) {
      // All branches terminate
      this.currentNode = null;
      return null;
    }

    // Create merge node
    const mergeNode = this.cfg.createNode(CFGNodeKind.Statement, null);

    for (const exit of validExits) {
      this.cfg.addEdge(exit, mergeNode);
    }

    this.currentNode = mergeNode;
    return mergeNode;
  }

  /**
   * Start a loop (while/for)
   *
   * Creates loop entry and exit nodes, pushes loop context.
   *
   * @param statement - Loop statement
   * @returns Object with entry and exit nodes
   */
  public startLoop(statement: Statement): { entry: CFGNode; exit: CFGNode } {
    // Create loop entry (condition)
    const entry = this.addNode(CFGNodeKind.Loop, statement);

    // Create loop exit (where control goes after loop)
    const exit = this.cfg.createNode(CFGNodeKind.Statement, null);

    // Add forward edge from entry to exit (loop may not execute)
    this.cfg.addEdge(entry, exit);

    // Push loop context for break/continue
    this.loopStack.push({ entry, exit });

    return { entry, exit };
  }

  /**
   * End a loop
   *
   * Adds back edge to loop entry, pops loop context, continues from exit.
   *
   * @param loopEntry - The loop entry node
   * @param loopExit - The loop exit node
   */
  public endLoop(loopEntry: CFGNode, loopExit: CFGNode): void {
    // Add back edge to loop entry if current code is reachable
    if (this.currentNode) {
      this.cfg.addEdge(this.currentNode, loopEntry);
    }

    // Pop loop context
    this.loopStack.pop();

    // Continue from exit
    this.currentNode = loopExit;
  }

  /**
   * Add a break statement
   *
   * Connects to innermost loop exit and terminates control flow.
   *
   * @param statement - Break statement
   * @returns The created node, or null if not in a loop
   */
  public addBreak(statement: Statement): CFGNode | null {
    if (this.loopStack.length === 0) {
      // Not in a loop - still create node for error recovery
      const node = this.addNode(CFGNodeKind.Break, statement);
      this.currentNode = null;
      return node;
    }

    const node = this.addNode(CFGNodeKind.Break, statement);
    const loopContext = this.loopStack[this.loopStack.length - 1];
    this.cfg.addEdge(node, loopContext.exit);
    this.currentNode = null;
    return node;
  }

  /**
   * Add a continue statement
   *
   * Connects to innermost loop entry and terminates control flow.
   *
   * @param statement - Continue statement
   * @returns The created node, or null if not in a loop
   */
  public addContinue(statement: Statement): CFGNode | null {
    if (this.loopStack.length === 0) {
      // Not in a loop - still create node for error recovery
      const node = this.addNode(CFGNodeKind.Continue, statement);
      this.currentNode = null;
      return node;
    }

    const node = this.addNode(CFGNodeKind.Continue, statement);
    const loopContext = this.loopStack[this.loopStack.length - 1];
    this.cfg.addEdge(node, loopContext.entry);
    this.currentNode = null;
    return node;
  }

  /**
   * Check if we're inside a loop
   *
   * @returns True if inside a loop
   */
  public isInLoop(): boolean {
    return this.loopStack.length > 0;
  }

  /**
   * Get current loop nesting depth
   *
   * @returns Number of nested loops
   */
  public getLoopDepth(): number {
    return this.loopStack.length;
  }

  /**
   * Finalize the CFG
   *
   * Connects current node to exit if reachable, computes reachability.
   *
   * @returns The completed CFG
   */
  public finalize(): ControlFlowGraph {
    // Connect to exit if code is reachable
    if (this.currentNode) {
      this.cfg.addEdge(this.currentNode, this.cfg.exit);
    }

    // Compute reachability
    this.cfg.computeReachability();

    return this.cfg;
  }
}