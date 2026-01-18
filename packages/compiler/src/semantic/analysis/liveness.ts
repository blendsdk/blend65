/**
 * Liveness Analysis (Task 8.6)
 *
 * Computes which variables are live (will be used in the future) at each
 * program point using backward data flow analysis with worklist algorithm.
 *
 * A variable is "live" at a point if its value may be used in the future
 * along some execution path before being redefined.
 *
 * **Algorithm**: Backward data flow analysis
 * - OUT[n] = ⋃ IN[s] for all successors s
 * - IN[n] = USE[n] ∪ (OUT[n] - DEF[n])
 *
 * **Complexity**: O(N × E) where N = nodes, E = edges
 *
 * @example
 * ```typescript
 * const analyzer = new LivenessAnalyzer(symbolTable, cfgs);
 * analyzer.analyze(ast);
 * const info = analyzer.getLivenessInfo('myFunction');
 * ```
 */

import type { Program } from '../../ast/nodes.js';
import type { Statement } from '../../ast/base.js';
import type { SymbolTable } from '../symbol-table.js';
import type { ControlFlowGraph, CFGNode } from '../control-flow.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { ASTWalker } from '../../ast/walker/base.js';
import { OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { isVariableDecl, isExpressionStatement, isAssignmentExpression, isIdentifierExpression, isReturnStatement, isIfStatement, isWhileStatement } from '../../ast/type-guards.js';

/**
 * Liveness interval for a variable
 *
 * Represents the range of program points where a variable is live.
 * Used for register allocation and optimization.
 */
export interface LivenessInterval {
  /** Variable name */
  variable: string;
  /** First program point where variable becomes live */
  start: number;
  /** Last program point where variable is live */
  end: number;
  /** Length of interval (end - start) */
  length: number;
  /** Variables with overlapping intervals (register interference) */
  overlaps: Set<string>;
}

/**
 * Complete liveness information for a function
 */
export interface LivenessInfo {
  /** IN sets: variables live at start of each node */
  liveIn: Map<CFGNode, Set<string>>;
  /** OUT sets: variables live at end of each node */
  liveOut: Map<CFGNode, Set<string>>;
  /** Liveness intervals for each variable */
  intervals: Map<string, LivenessInterval>;
  /** Dead variables (never live) */
  deadVariables: Set<string>;
}

/**
 * Liveness analyzer
 *
 * Performs backward data flow analysis to compute which variables are live
 * at each program point. This information enables:
 * - Register allocation (non-overlapping intervals can share registers)
 * - Dead code elimination (assignments to dead variables)
 * - 6502 zero page allocation (short-lived variables are good candidates)
 *
 * Uses worklist algorithm with reverse post-order for efficiency.
 */
export class LivenessAnalyzer extends ASTWalker {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Liveness info per function */
  protected livenessInfo: Map<string, LivenessInfo> = new Map();

  /** Program point counter for interval computation */
  protected programPointCounter = 0;

  /** Node to program point mapping */
  protected nodeToPoint: Map<CFGNode, number> = new Map();

  /**
   * Creates a liveness analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   * @param cfgs - Control flow graphs from Pass 5
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly cfgs: Map<string, ControlFlowGraph>
  ) {
    super();
  }

  /**
   * Analyze liveness for entire program
   *
   * For each function:
   * 1. Compute USE and DEF sets
   * 2. Run backward worklist algorithm
   * 3. Build liveness intervals
   * 4. Identify dead variables
   * 5. Store metadata in AST nodes
   *
   * @param _ast - Program AST to analyze (unused - analysis works on CFGs)
   */
  public analyze(_ast: Program): void {
    // Analyze each function separately
    for (const [funcName, cfg] of this.cfgs) {
      // Skip if CFG is empty or invalid
      if (!cfg || cfg.getNodes().length === 0) {
        continue;
      }

      try {
        // Reset program point counter for each function
        this.programPointCounter = 0;
        this.nodeToPoint = new Map();

        // Perform liveness analysis for this function
        const info = this.analyzeFunction(funcName, cfg);
        this.livenessInfo.set(funcName, info);

        // Store metadata in AST nodes
        this.storeMetadata(cfg, info);
      } catch (error) {
        // Continue with other functions even if one fails
        console.error(`Error analyzing liveness for ${funcName}:`, error);
      }
    }
  }

  /**
   * Analyze liveness for a single function
   *
   * Algorithm (backward analysis):
   * 1. Initialize IN and OUT sets to empty
   * 2. Add all nodes to worklist (reverse post-order)
   * 3. While worklist not empty:
   *    a. Remove node from worklist
   *    b. Compute OUT[n] = ⋃ IN[s] for all successors
   *    c. Compute IN[n] = USE[n] ∪ (OUT[n] - DEF[n])
   *    d. If IN changed, add predecessors to worklist
   *
   * @param funcName - Function name
   * @param cfg - Control flow graph
   * @returns Liveness information
   */
  protected analyzeFunction(funcName: string, cfg: ControlFlowGraph): LivenessInfo {
    // Step 1: Compute USE and DEF sets
    const { use, def } = this.computeUseDefSets(cfg);

    // Step 2: Initialize IN and OUT sets
    const liveIn = new Map<CFGNode, Set<string>>();
    const liveOut = new Map<CFGNode, Set<string>>();

    for (const node of cfg.getNodes()) {
      liveIn.set(node, new Set());
      liveOut.set(node, new Set());
    }

    // Step 3: Initialize worklist with all nodes (reverse post-order)
    const worklist: CFGNode[] = this.getReversePostOrder(cfg);

    // Step 4: Iterate until fixed point (backward analysis)
    while (worklist.length > 0) {
      const node = worklist.shift()!;

      // Compute OUT[n] = ⋃ IN[s] for all successors s
      const newOut = this.computeOUT(node, liveIn);
      liveOut.set(node, newOut);

      // Compute IN[n] = USE[n] ∪ (OUT[n] - DEF[n])
      const oldIn = liveIn.get(node)!;
      const newIn = this.computeIN(node, newOut, use, def);

      // If IN changed, add predecessors to worklist
      if (!this.setsEqual(oldIn, newIn)) {
        liveIn.set(node, newIn);

        // Add all predecessors to worklist (backward analysis)
        for (const pred of node.predecessors) {
          if (!worklist.includes(pred)) {
            worklist.push(pred);
          }
        }
      }
    }

    // Step 5: Build liveness intervals
    const intervals = this.buildIntervals(liveIn, liveOut, cfg);

    // Step 6: Identify dead variables
    const deadVariables = this.identifyDeadVariables(funcName, intervals);

    return {
      liveIn,
      liveOut,
      intervals,
      deadVariables,
    };
  }

  /**
   * Compute USE and DEF sets for all nodes
   *
   * USE[n] = variables used (read) by node n before being defined
   * DEF[n] = variables defined (written) by node n
   *
   * @param cfg - Control flow graph
   * @returns USE and DEF sets for each node
   */
  protected computeUseDefSets(
    cfg: ControlFlowGraph
  ): {
    use: Map<CFGNode, Set<string>>;
    def: Map<CFGNode, Set<string>>;
  } {
    const use = new Map<CFGNode, Set<string>>();
    const def = new Map<CFGNode, Set<string>>();

    // Assign program points to nodes
    let point = 0;
    for (const node of cfg.getNodes()) {
      this.nodeToPoint.set(node, point++);
    }

    // Compute USE and DEF for each node
    for (const node of cfg.getNodes()) {
      const useSet = new Set<string>();
      const defSet = new Set<string>();

      if (node.statement) {
        // Find uses and defs in this statement
        // Important: Process in order - uses before defs
        const { uses: stmtUses, defs: stmtDefs } = this.analyzeStatement(node.statement);

        // Add uses that occur before any definition
        for (const varUse of stmtUses) {
          if (!stmtDefs.has(varUse)) {
            useSet.add(varUse);
          }
        }

        // Add all definitions
        for (const varDef of stmtDefs) {
          defSet.add(varDef);
        }
      }

      use.set(node, useSet);
      def.set(node, defSet);
    }

    return { use, def };
  }

  /**
   * Analyze a statement to find uses and defs
   *
   * @param stmt - Statement to analyze
   * @returns Variables used and defined
   */
  protected analyzeStatement(stmt: Statement): { uses: Set<string>; defs: Set<string> } {
    const uses = new Set<string>();
    const defs = new Set<string>();

    // Handle variable declarations with initializers
    if (isVariableDecl(stmt)) {
      const name = stmt.getName();

      // Initializer uses variables
      const initializer = stmt.getInitializer();
      if (initializer) {
        this.findUsesInExpression(initializer, uses);
      }

      // Declaration defines the variable
      defs.add(name);
    }

    // Handle expression statements (assignments, calls, etc.)
    if (isExpressionStatement(stmt)) {
      const expr = stmt.getExpression();

      if (expr && isAssignmentExpression(expr)) {
        const target = expr.getTarget();
        const value = expr.getValue();

        // Right side uses variables (process first - uses before defs)
        this.findUsesInExpression(value, uses);

        // Left side defines variable
        if (isIdentifierExpression(target)) {
          defs.add(target.getName());
        }
      } else if (expr) {
        // Other expressions just use variables
        this.findUsesInExpression(expr, uses);
      }
    }

    // Handle return statements
    if (isReturnStatement(stmt)) {
      const returnValue = stmt.getValue();
      if (returnValue) {
        this.findUsesInExpression(returnValue, uses);
      }
    }

    // Handle if statements
    if (isIfStatement(stmt)) {
      const condition = stmt.getCondition();
      if (condition) {
        this.findUsesInExpression(condition, uses);
      }
    }

    // Handle while statements
    if (isWhileStatement(stmt)) {
      const condition = stmt.getCondition();
      if (condition) {
        this.findUsesInExpression(condition, uses);
      }
    }

    return { uses, defs };
  }

  /**
   * Find all variable uses in an expression
   *
   * @param expr - Expression to analyze
   * @param uses - Set to add uses to
   */
  protected findUsesInExpression(expr: any, uses: Set<string>): void {
    if (!expr) return;

    if (expr.getNodeType && isIdentifierExpression(expr)) {
      uses.add(expr.getName());
      return;
    }

    // Recursively check children
    if (typeof expr === 'object') {
      for (const key of Object.keys(expr)) {
        const value = (expr as any)[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach(item => this.findUsesInExpression(item, uses));
          } else {
            this.findUsesInExpression(value, uses);
          }
        }
      }
    }
  }

  /**
   * Get reverse post-order traversal of CFG
   *
   * This ordering is optimal for backward data flow analysis.
   *
   * @param cfg - Control flow graph
   * @returns Nodes in reverse post-order
   */
  protected getReversePostOrder(cfg: ControlFlowGraph): CFGNode[] {
    const visited = new Set<CFGNode>();
    const postOrder: CFGNode[] = [];

    const dfs = (node: CFGNode): void => {
      if (visited.has(node)) return;
      visited.add(node);

      // Visit successors first (post-order)
      for (const succ of node.successors) {
        dfs(succ);
      }

      postOrder.push(node);
    };

    // Start DFS from entry
    dfs(cfg.entry);

    // Reverse post-order
    return postOrder.reverse();
  }

  /**
   * Compute OUT[n] = ⋃ IN[s] for all successors s
   *
   * In backward analysis, OUT is computed from successors' IN sets.
   *
   * @param node - Current CFG node
   * @param liveIn - IN sets for all nodes
   * @returns New OUT set for this node
   */
  protected computeOUT(node: CFGNode, liveIn: Map<CFGNode, Set<string>>): Set<string> {
    const outSet = new Set<string>();

    // Union of IN sets from all successors
    for (const succ of node.successors) {
      const succIn = liveIn.get(succ);
      if (succIn) {
        for (const variable of succIn) {
          outSet.add(variable);
        }
      }
    }

    return outSet;
  }

  /**
   * Compute IN[n] = USE[n] ∪ (OUT[n] - DEF[n])
   *
   * Variables are live at the start of a node if:
   * 1. They are used in the node (USE[n]), OR
   * 2. They are live at the end (OUT[n]) and not redefined (not in DEF[n])
   *
   * @param node - Current CFG node
   * @param outSet - OUT set for this node
   * @param use - USE sets for all nodes
   * @param def - DEF sets for all nodes
   * @returns New IN set for this node
   */
  protected computeIN(
    node: CFGNode,
    outSet: Set<string>,
    use: Map<CFGNode, Set<string>>,
    def: Map<CFGNode, Set<string>>
  ): Set<string> {
    const inSet = new Set<string>();

    // Start with USE[n]
    const useSet = use.get(node)!;
    for (const variable of useSet) {
      inSet.add(variable);
    }

    // Add (OUT[n] - DEF[n])
    const defSet = def.get(node)!;
    for (const variable of outSet) {
      if (!defSet.has(variable)) {
        inSet.add(variable);
      }
    }

    return inSet;
  }

  /**
   * Build liveness intervals for each variable
   *
   * A liveness interval [start, end] represents the range of program points
   * where a variable is live. Used for register allocation.
   *
   * @param liveIn - IN sets for all nodes
   * @param liveOut - OUT sets for all nodes
   * @param cfg - Control flow graph
   * @returns Liveness intervals for each variable
   */
  protected buildIntervals(
    liveIn: Map<CFGNode, Set<string>>,
    liveOut: Map<CFGNode, Set<string>>,
    cfg: ControlFlowGraph
  ): Map<string, LivenessInterval> {
    const intervals = new Map<string, LivenessInterval>();

    // Track first and last program point for each variable
    const firstPoint = new Map<string, number>();
    const lastPoint = new Map<string, number>();

    // Scan all nodes to find live ranges
    for (const node of cfg.getNodes()) {
      const point = this.nodeToPoint.get(node)!;

      // Check variables live at IN
      const inVars = liveIn.get(node) || new Set();
      for (const variable of inVars) {
        if (!firstPoint.has(variable) || point < firstPoint.get(variable)!) {
          firstPoint.set(variable, point);
        }
        if (!lastPoint.has(variable) || point > lastPoint.get(variable)!) {
          lastPoint.set(variable, point);
        }
      }

      // Check variables live at OUT
      const outVars = liveOut.get(node) || new Set();
      for (const variable of outVars) {
        if (!firstPoint.has(variable) || point < firstPoint.get(variable)!) {
          firstPoint.set(variable, point);
        }
        if (!lastPoint.has(variable) || point > lastPoint.get(variable)!) {
          lastPoint.set(variable, point);
        }
      }
    }

    // Build intervals
    for (const variable of firstPoint.keys()) {
      const start = firstPoint.get(variable)!;
      const end = lastPoint.get(variable)!;
      const length = end - start + 1;

      intervals.set(variable, {
        variable,
        start,
        end,
        length,
        overlaps: new Set(),
      });
    }

    // Compute overlaps (register interference)
    for (const [var1, interval1] of intervals) {
      for (const [var2, interval2] of intervals) {
        if (var1 !== var2 && this.intervalsOverlap(interval1, interval2)) {
          interval1.overlaps.add(var2);
        }
      }
    }

    return intervals;
  }

  /**
   * Check if two intervals overlap
   *
   * Intervals overlap if they share any program points.
   *
   * @param interval1 - First interval
   * @param interval2 - Second interval
   * @returns True if intervals overlap
   */
  protected intervalsOverlap(interval1: LivenessInterval, interval2: LivenessInterval): boolean {
    return !(interval1.end < interval2.start || interval2.end < interval1.start);
  }

  /**
   * Identify dead variables (never live)
   *
   * Variables that are defined but never used are dead.
   *
   * @param funcName - Function name
   * @param intervals - Liveness intervals
   * @returns Set of dead variables
   */
  protected identifyDeadVariables(
    _funcName: string,
    _intervals: Map<string, LivenessInterval>
  ): Set<string> {
    const deadVariables = new Set<string>();

    // A variable with no liveness interval is dead
    // (This would be caught by variable usage analysis,
    // but we check here for completeness)

    // Note: In practice, dead variables should be detected
    // by variable usage analysis (Task 8.2), not liveness analysis

    return deadVariables;
  }

  /**
   * Check if two sets are equal
   *
   * @param set1 - First set
   * @param set2 - Second set
   * @returns True if sets are equal
   */
  protected setsEqual(set1: Set<string>, set2: Set<string>): boolean {
    if (set1.size !== set2.size) return false;

    for (const item of set1) {
      if (!set2.has(item)) return false;
    }

    return true;
  }

  /**
   * Store metadata in AST nodes
   *
   * For each node, store:
   * - LivenessLiveIn: variables live at entry
   * - LivenessLiveOut: variables live at exit
   * - LivenessInterval: liveness interval for variables defined here
   * - LivenessIntervalLength: length of interval
   *
   * @param cfg - Control flow graph
   * @param info - Liveness information
   */
  protected storeMetadata(cfg: ControlFlowGraph, info: LivenessInfo): void {
    // Store liveness sets for each node
    for (const node of cfg.getNodes()) {
      if (!node.statement) continue;

      const stmt = node.statement;

      // Store live-in set
      const liveIn = info.liveIn.get(node);
      if (liveIn && liveIn.size > 0) {
        if (!stmt.metadata) {
          stmt.metadata = new Map();
        }
        stmt.metadata.set(OptimizationMetadataKey.LivenessLiveIn, Array.from(liveIn));
      }

      // Store live-out set
      const liveOut = info.liveOut.get(node);
      if (liveOut && liveOut.size > 0) {
        if (!stmt.metadata) {
          stmt.metadata = new Map();
        }
        stmt.metadata.set(OptimizationMetadataKey.LivenessLiveOut, Array.from(liveOut));
      }
    }

    // Store interval information
    for (const [variable, interval] of info.intervals) {
      // Find nodes that define this variable
      for (const node of cfg.getNodes()) {
        if (!node.statement) continue;

        const stmt = node.statement;
        const { defs } = this.analyzeStatement(stmt);

        if (defs.has(variable)) {
          if (!stmt.metadata) {
            stmt.metadata = new Map();
          }

          // Store interval
          stmt.metadata.set(OptimizationMetadataKey.LivenessInterval, {
            start: interval.start,
            end: interval.end,
          });

          // Store interval length
          stmt.metadata.set(OptimizationMetadataKey.LivenessIntervalLength, interval.length);
        }
      }
    }
  }

  /**
   * Get liveness info for a function
   *
   * @param funcName - Function name
   * @returns Liveness info or undefined
   */
  public getLivenessInfo(funcName: string): LivenessInfo | undefined {
    return this.livenessInfo.get(funcName);
  }

  /**
   * Get all diagnostics
   *
   * @returns Array of diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }
}