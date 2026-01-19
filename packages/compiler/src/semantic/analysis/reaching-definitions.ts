/**
 * Reaching Definitions Analysis (Task 8.5)
 *
 * Computes which definitions of variables reach each program point using
 * forward data flow analysis with worklist algorithm.
 *
 * A definition "reaches" a point if there exists a path from the definition
 * to that point along which the variable is not redefined.
 *
 * **Algorithm**: Forward data flow analysis
 * - IN[n] = ⋃ OUT[p] for all predecessors p
 * - OUT[n] = GEN[n] ∪ (IN[n] - KILL[n])
 *
 * **Complexity**: O(N × E) where N = nodes, E = edges
 *
 * @example
 * ```typescript
 * const analyzer = new ReachingDefinitionsAnalyzer(symbolTable, cfgs);
 * analyzer.analyze(ast);
 * const info = analyzer.getReachingDefinitions('myFunction');
 * ```
 */

import type { Program } from '../../ast/nodes.js';
import type { Statement } from '../../ast/base.js';
import type { SymbolTable } from '../symbol-table.js';
import type { ControlFlowGraph, CFGNode } from '../control-flow.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { ASTWalker } from '../../ast/walker/base.js';
import { OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { isVariableDecl, isExpressionStatement, isAssignmentExpression, isIdentifierExpression } from '../../ast/type-guards.js';

/**
 * Represents a variable definition in the program
 */
export interface Definition {
  /** Variable name being defined */
  variable: string;
  /** CFG node where definition occurs */
  node: CFGNode;
  /** Statement containing the definition */
  statement: Statement;
  /** Unique identifier for this definition */
  id: number;
}

/**
 * Def-use chain: maps a definition to all uses it reaches
 */
export interface DefUseChain {
  /** The definition */
  definition: Definition;
  /** All uses this definition reaches */
  uses: Set<Statement>;
}

/**
 * Use-def chain: maps a use to all definitions that reach it
 */
export interface UseDefChain {
  /** The use (statement that reads the variable) */
  use: Statement;
  /** All definitions that reach this use */
  definitions: Set<Definition>;
}

/**
 * Complete reaching definitions information for a function
 */
export interface ReachingDefinitionsInfo {
  /** IN sets: definitions reaching the start of each node */
  reachingIn: Map<CFGNode, Set<Definition>>;
  /** OUT sets: definitions reaching the end of each node */
  reachingOut: Map<CFGNode, Set<Definition>>;
  /** Def-use chains for optimization */
  defUseChains: Map<Definition, Set<Statement>>;
  /** Use-def chains for optimization */
  useDefChains: Map<Statement, Set<Definition>>;
}

/**
 * Reaching definitions analyzer
 *
 * Performs forward data flow analysis to compute which variable definitions
 * reach each program point. This information enables:
 * - Constant propagation (track constant values through definitions)
 * - Dead store elimination (definitions that reach no uses)
 * - Common subexpression elimination (same definition reaches multiple uses)
 *
 * Uses worklist algorithm for efficiency.
 */
export class ReachingDefinitionsAnalyzer extends ASTWalker {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** All definitions in the program */
  protected allDefinitions: Map<string, Map<number, Definition>> = new Map();

  /** Next definition ID */
  protected nextDefId = 0;

  /** Reaching definitions info per function */
  protected reachingInfo: Map<string, ReachingDefinitionsInfo> = new Map();

  /**
   * Creates a reaching definitions analyzer
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
   * Analyze reaching definitions for entire program
   *
   * For each function:
   * 1. Collect all definitions (GEN sets)
   * 2. Compute KILL sets
   * 3. Run worklist algorithm
   * 4. Build def-use and use-def chains
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
        // Perform reaching definitions analysis for this function
        const info = this.analyzeFunction(funcName, cfg);
        this.reachingInfo.set(funcName, info);

        // Store metadata in AST nodes
        this.storeMetadata(cfg, info);
      } catch (error) {
        // Continue with other functions even if one fails
        console.error(`Error analyzing reaching definitions for ${funcName}:`, error);
      }
    }
  }

  /**
   * Analyze reaching definitions for a single function
   *
   * Algorithm:
   * 1. Initialize IN and OUT sets to empty
   * 2. Add all nodes to worklist
   * 3. While worklist not empty:
   *    a. Remove node from worklist
   *    b. Compute IN[n] = ⋃ OUT[p] for all predecessors
   *    c. Compute OUT[n] = GEN[n] ∪ (IN[n] - KILL[n])
   *    d. If OUT changed, add successors to worklist
   *
   * @param funcName - Function name
   * @param cfg - Control flow graph
   * @returns Reaching definitions information
   */
  protected analyzeFunction(funcName: string, cfg: ControlFlowGraph): ReachingDefinitionsInfo {
    // Step 1: Collect all definitions and compute GEN/KILL sets
    const { gen, kill } = this.computeGenKillSets(funcName, cfg);

    // Step 2: Initialize IN and OUT sets
    const reachingIn = new Map<CFGNode, Set<Definition>>();
    const reachingOut = new Map<CFGNode, Set<Definition>>();

    for (const node of cfg.getNodes()) {
      reachingIn.set(node, new Set());
      reachingOut.set(node, new Set());
    }

    // Step 3: Initialize worklist with all nodes
    const worklist: CFGNode[] = Array.from(cfg.getNodes());

    // Step 4: Iterate until fixed point
    while (worklist.length > 0) {
      const node = worklist.shift()!;

      // Compute IN[n] = ⋃ OUT[p] for all predecessors p
      const newIn = this.computeIN(node, reachingOut);
      reachingIn.set(node, newIn);

      // Compute OUT[n] = GEN[n] ∪ (IN[n] - KILL[n])
      const oldOut = reachingOut.get(node)!;
      const newOut = this.computeOUT(node, newIn, gen, kill);

      // If OUT changed, add successors to worklist
      if (!this.setsEqual(oldOut, newOut)) {
        reachingOut.set(node, newOut);

        // Add all successors to worklist
        for (const succ of node.successors) {
          if (!worklist.includes(succ)) {
            worklist.push(succ);
          }
        }
      }
    }

    // Step 5: Build def-use and use-def chains
    const { defUseChains, useDefChains } = this.buildChains(cfg, reachingIn, reachingOut);

    return {
      reachingIn,
      reachingOut,
      defUseChains,
      useDefChains,
    };
  }

  /**
   * Compute GEN and KILL sets for all nodes
   *
   * GEN[n] = definitions generated by node n
   * KILL[n] = definitions killed by node n (redefinitions of same variable)
   *
   * @param funcName - Function name
   * @param cfg - Control flow graph
   * @returns GEN and KILL sets for each node
   */
  protected computeGenKillSets(
    funcName: string,
    cfg: ControlFlowGraph
  ): {
    gen: Map<CFGNode, Set<Definition>>;
    kill: Map<CFGNode, Set<Definition>>;
  } {
    const gen = new Map<CFGNode, Set<Definition>>();
    const kill = new Map<CFGNode, Set<Definition>>();

    // Track all definitions per variable
    const defsByVariable = new Map<string, Definition[]>();

    // Pass 1: Collect all definitions
    for (const node of cfg.getNodes()) {
      const genSet = new Set<Definition>();

      if (node.statement) {
        // Find definitions in this statement
        const defs = this.findDefinitions(node.statement, node);

        for (const def of defs) {
          genSet.add(def);

          // Track for KILL set computation
          if (!defsByVariable.has(def.variable)) {
            defsByVariable.set(def.variable, []);
          }
          defsByVariable.get(def.variable)!.push(def);

          // Store in all definitions map
          if (!this.allDefinitions.has(funcName)) {
            this.allDefinitions.set(funcName, new Map());
          }
          this.allDefinitions.get(funcName)!.set(def.id, def);
        }
      }

      gen.set(node, genSet);
    }

    // Pass 2: Compute KILL sets
    for (const node of cfg.getNodes()) {
      const killSet = new Set<Definition>();
      const genSet = gen.get(node)!;

      // For each definition generated by this node
      for (const def of genSet) {
        // Kill all other definitions of the same variable
        const allDefs = defsByVariable.get(def.variable) || [];
        for (const otherDef of allDefs) {
          if (otherDef.id !== def.id) {
            killSet.add(otherDef);
          }
        }
      }

      kill.set(node, killSet);
    }

    return { gen, kill };
  }

  /**
   * Find all definitions in a statement
   *
   * Looks for:
   * - Variable declarations with initializers
   * - Assignments to variables
   *
   * @param stmt - Statement to analyze
   * @param node - CFG node containing the statement
   * @returns Array of definitions found
   */
  protected findDefinitions(stmt: Statement, node: CFGNode): Definition[] {
    const defs: Definition[] = [];

    // Handle variable declarations with initializers
    if (isVariableDecl(stmt)) {
      const name = stmt.getName();
      if (stmt.getInitializer()) {
        defs.push({
          variable: name,
          node,
          statement: stmt,
          id: this.nextDefId++,
        });
      }
    }

    // Handle assignments
    if (isExpressionStatement(stmt)) {
      const expr = stmt.getExpression();

      if (expr && isAssignmentExpression(expr)) {
        const target = expr.getTarget();

        if (isIdentifierExpression(target)) {
          defs.push({
            variable: target.getName(),
            node,
            statement: stmt,
            id: this.nextDefId++,
          });
        }
      }
    }

    return defs;
  }

  /**
   * Compute IN[n] = ⋃ OUT[p] for all predecessors p
   *
   * @param node - Current CFG node
   * @param reachingOut - OUT sets for all nodes
   * @returns New IN set for this node
   */
  protected computeIN(node: CFGNode, reachingOut: Map<CFGNode, Set<Definition>>): Set<Definition> {
    const inSet = new Set<Definition>();

    // Union of OUT sets from all predecessors
    for (const pred of node.predecessors) {
      const predOut = reachingOut.get(pred);
      if (predOut) {
        for (const def of predOut) {
          inSet.add(def);
        }
      }
    }

    return inSet;
  }

  /**
   * Compute OUT[n] = GEN[n] ∪ (IN[n] - KILL[n])
   *
   * @param node - Current CFG node
   * @param inSet - IN set for this node
   * @param gen - GEN sets for all nodes
   * @param kill - KILL sets for all nodes
   * @returns New OUT set for this node
   */
  protected computeOUT(
    node: CFGNode,
    inSet: Set<Definition>,
    gen: Map<CFGNode, Set<Definition>>,
    kill: Map<CFGNode, Set<Definition>>
  ): Set<Definition> {
    const outSet = new Set<Definition>();

    // Start with GEN[n]
    const genSet = gen.get(node)!;
    for (const def of genSet) {
      outSet.add(def);
    }

    // Add (IN[n] - KILL[n])
    const killSet = kill.get(node)!;
    for (const def of inSet) {
      if (!killSet.has(def)) {
        outSet.add(def);
      }
    }

    return outSet;
  }

  /**
   * Build def-use and use-def chains
   *
   * For each definition, find all uses it reaches.
   * For each use, find all definitions that reach it.
   *
   * @param cfg - Control flow graph
   * @param reachingIn - IN sets
   * @param reachingOut - OUT sets
   * @returns Def-use and use-def chains
   */
  protected buildChains(
    cfg: ControlFlowGraph,
    reachingIn: Map<CFGNode, Set<Definition>>,
    _reachingOut: Map<CFGNode, Set<Definition>>
  ): {
    defUseChains: Map<Definition, Set<Statement>>;
    useDefChains: Map<Statement, Set<Definition>>;
  } {
    const defUseChains = new Map<Definition, Set<Statement>>();
    const useDefChains = new Map<Statement, Set<Definition>>();

    // For each node, find uses and match with reaching definitions
    for (const node of cfg.getNodes()) {
      if (!node.statement) continue;

      // Get definitions reaching this node
      const reachingDefs = reachingIn.get(node)!;

      // Find all variable uses in this statement
      const uses = this.findUses(node.statement);

      for (const [varName, useStmt] of uses) {
        // Find all definitions of this variable that reach here
        const reachingDefsForVar = Array.from(reachingDefs).filter(d => d.variable === varName);

        if (reachingDefsForVar.length > 0) {
          // Build use-def chain
          if (!useDefChains.has(useStmt)) {
            useDefChains.set(useStmt, new Set());
          }
          for (const def of reachingDefsForVar) {
            useDefChains.get(useStmt)!.add(def);

            // Build def-use chain
            if (!defUseChains.has(def)) {
              defUseChains.set(def, new Set());
            }
            defUseChains.get(def)!.add(useStmt);
          }
        }
      }
    }

    return { defUseChains, useDefChains };
  }

  /**
   * Find all variable uses in a statement
   *
   * Returns map of variable name to statement containing the use.
   *
   * @param stmt - Statement to analyze
   * @returns Map of variable names to statements
   */
  protected findUses(stmt: Statement): Map<string, Statement> {
    const uses = new Map<string, Statement>();

    // Use a simple walker to find identifier expressions
    const findIdentifiers = (node: any): void => {
      if (!node) return;

      if (node.getNodeType && isIdentifierExpression(node)) {
        uses.set(node.getName(), stmt);
        return;
      }

      // Recursively check children
      if (typeof node === 'object') {
        for (const key of Object.keys(node)) {
          const value = (node as any)[key];
          if (value && typeof value === 'object') {
            if (Array.isArray(value)) {
              value.forEach(findIdentifiers);
            } else {
              findIdentifiers(value);
            }
          }
        }
      }
    };

    findIdentifiers(stmt);
    return uses;
  }

  /**
   * Check if two sets are equal
   *
   * @param set1 - First set
   * @param set2 - Second set
   * @returns True if sets are equal
   */
  protected setsEqual(set1: Set<Definition>, set2: Set<Definition>): boolean {
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
   * - ReachingDefinitionsSet: definitions reaching this point
   * - DefUseChain: uses this definition reaches
   * - UseDefChain: definitions reaching this use
   *
   * @param cfg - Control flow graph
   * @param info - Reaching definitions information
   */
  protected storeMetadata(cfg: ControlFlowGraph, info: ReachingDefinitionsInfo): void {
    // Store reaching definitions for each node
    for (const node of cfg.getNodes()) {
      if (!node.statement) continue;

      const stmt = node.statement;

      // Store reaching IN set
      const reachingIn = info.reachingIn.get(node);
      if (reachingIn) {
        if (!stmt.metadata) {
          stmt.metadata = new Map();
        }
        stmt.metadata.set(
          OptimizationMetadataKey.ReachingDefinitionsSet,
          Array.from(reachingIn).map(d => d.id)
        );
      }

      // Store def-use chain if this is a definition
      for (const [def, uses] of info.defUseChains) {
        if (def.statement === stmt) {
          if (!stmt.metadata) {
            stmt.metadata = new Map();
          }
          stmt.metadata.set(OptimizationMetadataKey.DefUseChain, Array.from(uses));
        }
      }

      // Store use-def chain if this is a use
      const useDefChain = info.useDefChains.get(stmt);
      if (useDefChain) {
        if (!stmt.metadata) {
          stmt.metadata = new Map();
        }
        stmt.metadata.set(
          OptimizationMetadataKey.UseDefChain,
          Array.from(useDefChain).map(d => d.id)
        );
      }
    }
  }

  /**
   * Get reaching definitions info for a function
   *
   * @param funcName - Function name
   * @returns Reaching definitions info or undefined
   */
  public getReachingDefinitions(funcName: string): ReachingDefinitionsInfo | undefined {
    return this.reachingInfo.get(funcName);
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