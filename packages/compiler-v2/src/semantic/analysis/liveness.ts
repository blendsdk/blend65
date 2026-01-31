/**
 * Liveness Analyzer for Blend65 Compiler v2
 *
 * Computes variable liveness information through backward data-flow analysis.
 * A variable is "live" at a program point if its current value may be used
 * on some execution path from that point.
 *
 * **Analysis Approach:**
 * Uses backward data-flow analysis on the control flow graph:
 * - Live-out(n) = union of live-in of all successors
 * - Live-in(n) = (Live-out(n) - DEF(n)) union USE(n)
 *
 * Where:
 * - USE(n) = variables read in node n before any assignment
 * - DEF(n) = variables assigned in node n
 *
 * **Use Cases:**
 * - Dead store elimination (variable assigned but never live after)
 * - Register allocation (helps determine variable lifetimes)
 * - Optimization passes that need lifetime information
 *
 * **SFA Context:**
 * In Blend65's Static Frame Allocation model, variables have fixed memory
 * locations. Liveness analysis helps identify opportunities to:
 * - Skip unnecessary stores (dead stores)
 * - Reuse memory locations for non-overlapping lifetimes
 * - Optimize register usage in code generation
 *
 * @module semantic/analysis/liveness
 */

import type { CFGNode, ControlFlowGraph } from '../control-flow.js';
import type { Symbol } from '../index.js';

/**
 * Liveness information for a single CFG node
 *
 * Contains the sets of variables that are live at entry (live-in)
 * and exit (live-out) of this program point.
 */
export interface LivenessInfo {
  /** Variables live at entry to this node */
  liveIn: Set<string>;

  /** Variables live at exit from this node */
  liveOut: Set<string>;

  /** Variables used (read) in this node */
  use: Set<string>;

  /** Variables defined (written) in this node */
  def: Set<string>;
}

/**
 * Result of liveness analysis for a function
 */
export interface LivenessResult {
  /** Function name */
  functionName: string;

  /** Liveness info per CFG node (keyed by node ID) */
  nodeInfo: Map<string, LivenessInfo>;

  /** All variables that appear in the function */
  allVariables: Set<string>;

  /** Variables live at function entry */
  liveAtEntry: Set<string>;

  /** Variables live at function exit */
  liveAtExit: Set<string>;

  /** Number of iterations to reach fixed point */
  iterations: number;
}

/**
 * Configuration options for liveness analysis
 */
export interface LivenessOptions {
  /** Maximum iterations before giving up (prevents infinite loops) */
  maxIterations: number;

  /** Include parameters in liveness tracking */
  includeParameters: boolean;

  /** Debug mode - log iteration details */
  debug: boolean;
}

/**
 * Default liveness analysis options
 */
export const DEFAULT_LIVENESS_OPTIONS: LivenessOptions = {
  maxIterations: 1000,
  includeParameters: true,
  debug: false,
};

/**
 * Liveness Analyzer
 *
 * Computes live-in and live-out sets for each node in a control flow graph
 * using iterative backward data-flow analysis.
 *
 * **Usage:**
 * ```typescript
 * const analyzer = new LivenessAnalyzer();
 *
 * // Register variable uses and definitions
 * analyzer.recordUse(nodeId, 'x');
 * analyzer.recordDef(nodeId, 'x');
 *
 * // Compute liveness
 * const result = analyzer.analyze(cfg);
 *
 * // Query liveness
 * const liveAtNode = analyzer.getLiveIn('node_5');
 * const isLive = analyzer.isLiveAt('x', 'node_5');
 * ```
 *
 * **Algorithm:**
 * 1. Initialize all live-in and live-out sets to empty
 * 2. Iterate until fixed point:
 *    - For each node (in reverse topological order):
 *      - Live-out = union of live-in of successors
 *      - Live-in = (live-out - def) union use
 * 3. Fixed point reached when no sets change
 *
 * **Integration:**
 * This analyzer is typically used after CFG construction and type checking.
 * Variable uses and definitions should be recorded during AST traversal.
 */
export class LivenessAnalyzer {
  /** Configuration options */
  protected readonly options: LivenessOptions;

  /** USE sets per node (variables read before written) */
  protected useMap: Map<string, Set<string>>;

  /** DEF sets per node (variables written) */
  protected defMap: Map<string, Set<string>>;

  /** Computed liveness info per node */
  protected livenessMap: Map<string, LivenessInfo>;

  /** All tracked variables */
  protected allVariables: Set<string>;

  /** Variable name to Symbol mapping (optional) */
  protected symbolMap: Map<string, Symbol>;

  /**
   * Create a new liveness analyzer
   *
   * @param options - Configuration options (optional)
   */
  constructor(options?: Partial<LivenessOptions>) {
    this.options = { ...DEFAULT_LIVENESS_OPTIONS, ...options };
    this.useMap = new Map();
    this.defMap = new Map();
    this.livenessMap = new Map();
    this.allVariables = new Set();
    this.symbolMap = new Map();
  }

  /**
   * Record a variable use (read) in a node
   *
   * Should be called for each variable read in the node.
   * Order matters: uses are tracked before any def in the same node.
   *
   * @param nodeId - CFG node identifier
   * @param variable - Variable name being read
   * @param symbol - Optional symbol for the variable
   */
  public recordUse(nodeId: string, variable: string, symbol?: Symbol): void {
    let useSet = this.useMap.get(nodeId);
    if (!useSet) {
      useSet = new Set();
      this.useMap.set(nodeId, useSet);
    }

    // Only add to USE if not already in DEF for this node
    // (USE captures variables read BEFORE being written in the node)
    const defSet = this.defMap.get(nodeId);
    if (!defSet || !defSet.has(variable)) {
      useSet.add(variable);
    }

    this.allVariables.add(variable);
    if (symbol) {
      this.symbolMap.set(variable, symbol);
    }
  }

  /**
   * Record a variable definition (write/assignment) in a node
   *
   * Should be called for each variable written in the node.
   *
   * @param nodeId - CFG node identifier
   * @param variable - Variable name being written
   * @param symbol - Optional symbol for the variable
   */
  public recordDef(nodeId: string, variable: string, symbol?: Symbol): void {
    let defSet = this.defMap.get(nodeId);
    if (!defSet) {
      defSet = new Set();
      this.defMap.set(nodeId, defSet);
    }
    defSet.add(variable);

    this.allVariables.add(variable);
    if (symbol) {
      this.symbolMap.set(variable, symbol);
    }
  }

  /**
   * Analyze liveness for a control flow graph
   *
   * Computes live-in and live-out sets for all nodes using iterative
   * backward data-flow analysis.
   *
   * @param cfg - The control flow graph to analyze
   * @returns Analysis result with liveness information
   */
  public analyze(cfg: ControlFlowGraph): LivenessResult {
    const nodes = cfg.getNodes();

    // Initialize liveness info for all nodes
    this.initializeLiveness(nodes);

    // Iterate until fixed point
    let iterations = 0;
    let changed = true;

    while (changed && iterations < this.options.maxIterations) {
      changed = false;
      iterations++;

      // Process nodes in reverse order (backward analysis)
      // This helps reach fixed point faster
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const info = this.livenessMap.get(node.id)!;

        // Compute new live-out: union of live-in of all successors
        const newLiveOut = new Set<string>();
        for (const succ of node.successors) {
          const succInfo = this.livenessMap.get(succ.id);
          if (succInfo) {
            for (const v of succInfo.liveIn) {
              newLiveOut.add(v);
            }
          }
        }

        // Check if live-out changed
        if (!this.setsEqual(info.liveOut, newLiveOut)) {
          info.liveOut = newLiveOut;
          changed = true;
        }

        // Compute new live-in: (live-out - def) union use
        const newLiveIn = new Set<string>();

        // Add live-out minus def
        for (const v of info.liveOut) {
          if (!info.def.has(v)) {
            newLiveIn.add(v);
          }
        }

        // Add use
        for (const v of info.use) {
          newLiveIn.add(v);
        }

        // Check if live-in changed
        if (!this.setsEqual(info.liveIn, newLiveIn)) {
          info.liveIn = newLiveIn;
          changed = true;
        }
      }

      if (this.options.debug) {
        console.log(`Liveness iteration ${iterations}, changed: ${changed}`);
      }
    }

    // Collect results
    const entryInfo = this.livenessMap.get(cfg.entry.id);
    const exitInfo = this.livenessMap.get(cfg.exit.id);

    return {
      functionName: cfg.functionName,
      nodeInfo: new Map(this.livenessMap),
      allVariables: new Set(this.allVariables),
      liveAtEntry: entryInfo ? new Set(entryInfo.liveIn) : new Set(),
      liveAtExit: exitInfo ? new Set(exitInfo.liveOut) : new Set(),
      iterations,
    };
  }

  /**
   * Initialize liveness info for all nodes
   *
   * Sets up empty live-in/live-out and copies use/def from recorded data.
   *
   * @param nodes - All CFG nodes
   */
  protected initializeLiveness(nodes: CFGNode[]): void {
    this.livenessMap.clear();

    for (const node of nodes) {
      const useSet = this.useMap.get(node.id) ?? new Set();
      const defSet = this.defMap.get(node.id) ?? new Set();

      this.livenessMap.set(node.id, {
        liveIn: new Set(),
        liveOut: new Set(),
        use: new Set(useSet),
        def: new Set(defSet),
      });
    }
  }

  /**
   * Check if two sets are equal
   *
   * @param a - First set
   * @param b - Second set
   * @returns True if sets have same elements
   */
  protected setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const elem of a) {
      if (!b.has(elem)) return false;
    }
    return true;
  }

  /**
   * Get live-in set for a node
   *
   * @param nodeId - CFG node identifier
   * @returns Set of variables live at entry, or empty set if not found
   */
  public getLiveIn(nodeId: string): Set<string> {
    const info = this.livenessMap.get(nodeId);
    return info ? new Set(info.liveIn) : new Set();
  }

  /**
   * Get live-out set for a node
   *
   * @param nodeId - CFG node identifier
   * @returns Set of variables live at exit, or empty set if not found
   */
  public getLiveOut(nodeId: string): Set<string> {
    const info = this.livenessMap.get(nodeId);
    return info ? new Set(info.liveOut) : new Set();
  }

  /**
   * Check if a variable is live at a specific node
   *
   * @param variable - Variable name
   * @param nodeId - CFG node identifier
   * @param position - 'in' for live-in, 'out' for live-out
   * @returns True if variable is live at the specified position
   */
  public isLiveAt(variable: string, nodeId: string, position: 'in' | 'out' = 'in'): boolean {
    const info = this.livenessMap.get(nodeId);
    if (!info) return false;

    const liveSet = position === 'in' ? info.liveIn : info.liveOut;
    return liveSet.has(variable);
  }

  /**
   * Get liveness info for a node
   *
   * @param nodeId - CFG node identifier
   * @returns Liveness info, or undefined if not found
   */
  public getNodeInfo(nodeId: string): LivenessInfo | undefined {
    const info = this.livenessMap.get(nodeId);
    if (!info) return undefined;

    // Return a copy to prevent mutation
    return {
      liveIn: new Set(info.liveIn),
      liveOut: new Set(info.liveOut),
      use: new Set(info.use),
      def: new Set(info.def),
    };
  }

  /**
   * Get all tracked variables
   *
   * @returns Set of all variable names
   */
  public getAllVariables(): Set<string> {
    return new Set(this.allVariables);
  }

  /**
   * Get symbol for a variable (if recorded)
   *
   * @param variable - Variable name
   * @returns Symbol, or undefined if not recorded
   */
  public getSymbol(variable: string): Symbol | undefined {
    return this.symbolMap.get(variable);
  }

  /**
   * Find dead definitions (defs where variable is not live-out)
   *
   * A dead definition is a write to a variable where the variable
   * is not live after the write (the value is never used).
   *
   * @returns Array of { nodeId, variable } for each dead definition
   */
  public findDeadDefinitions(): Array<{ nodeId: string; variable: string }> {
    const deadDefs: Array<{ nodeId: string; variable: string }> = [];

    for (const [nodeId, info] of this.livenessMap) {
      for (const variable of info.def) {
        // If variable is defined but not live-out, it's a dead definition
        // (unless it's also used in the same node after the def)
        if (!info.liveOut.has(variable)) {
          // Check if there's another use of this variable
          // in a successor path - if not, it's dead
          deadDefs.push({ nodeId, variable });
        }
      }
    }

    return deadDefs;
  }

  /**
   * Compute variable interference
   *
   * Two variables interfere if they are live at the same program point.
   * This is useful for register allocation.
   *
   * @returns Map of variable to set of interfering variables
   */
  public computeInterference(): Map<string, Set<string>> {
    const interference = new Map<string, Set<string>>();

    // Initialize empty sets for all variables
    for (const variable of this.allVariables) {
      interference.set(variable, new Set());
    }

    // For each node, all live-in variables interfere with each other
    for (const [, info] of this.livenessMap) {
      const liveVars = Array.from(info.liveIn);

      for (let i = 0; i < liveVars.length; i++) {
        for (let j = i + 1; j < liveVars.length; j++) {
          const v1 = liveVars[i];
          const v2 = liveVars[j];

          interference.get(v1)!.add(v2);
          interference.get(v2)!.add(v1);
        }
      }

      // Also check live-out
      const liveOutVars = Array.from(info.liveOut);
      for (let i = 0; i < liveOutVars.length; i++) {
        for (let j = i + 1; j < liveOutVars.length; j++) {
          const v1 = liveOutVars[i];
          const v2 = liveOutVars[j];

          interference.get(v1)!.add(v2);
          interference.get(v2)!.add(v1);
        }
      }
    }

    return interference;
  }

  /**
   * Format a human-readable report
   *
   * @param cfg - The control flow graph (for node context)
   * @returns Multi-line string with liveness information
   */
  public formatReport(cfg: ControlFlowGraph): string {
    const lines: string[] = [
      `=== Liveness Analysis Report: ${cfg.functionName} ===`,
      '',
      `Variables tracked: ${this.allVariables.size}`,
      `Nodes analyzed: ${this.livenessMap.size}`,
      '',
    ];

    // Show liveness per node
    for (const node of cfg.getNodes()) {
      const info = this.livenessMap.get(node.id);
      if (!info) continue;

      lines.push(`Node: ${node.id} (${node.kind})`);
      lines.push(`  USE: {${Array.from(info.use).join(', ')}}`);
      lines.push(`  DEF: {${Array.from(info.def).join(', ')}}`);
      lines.push(`  Live-in: {${Array.from(info.liveIn).join(', ')}}`);
      lines.push(`  Live-out: {${Array.from(info.liveOut).join(', ')}}`);
      lines.push('');
    }

    // Show dead definitions
    const deadDefs = this.findDeadDefinitions();
    if (deadDefs.length > 0) {
      lines.push('Dead Definitions:');
      for (const { nodeId, variable } of deadDefs) {
        lines.push(`  ${variable} at ${nodeId}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset analyzer state for reuse
   */
  public reset(): void {
    this.useMap.clear();
    this.defMap.clear();
    this.livenessMap.clear();
    this.allVariables.clear();
    this.symbolMap.clear();
  }
}