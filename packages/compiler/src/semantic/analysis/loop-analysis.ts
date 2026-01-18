/**
 * Loop Analysis (Phase 8 - Task 8.11)
 *
 * Detects and analyzes loops for optimization opportunities:
 * - Natural loop detection
 * - Dominance computation
 * - Loop-invariant code detection
 * - Induction variable recognition
 * - Loop unrolling candidates
 *
 * This analysis enables critical 6502 loop optimizations.
 */

import type { Program, FunctionDecl } from '../../ast/nodes.js';
import type { ControlFlowGraph, CFGNode } from '../control-flow.js';
import type { SymbolTable } from '../symbol-table.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import type { Expression } from '../../ast/base.js';

/**
 * Loop information structure
 *
 * Represents a natural loop with its header, body, and analysis results.
 */
interface LoopInfo {
  /** Loop header node (where condition is tested) */
  header: CFGNode;

  /** All nodes in the loop body (including header) */
  body: Set<CFGNode>;

  /** Back edge that defines this loop */
  backEdge: { from: CFGNode; to: CFGNode };

  /** Parent loop (null for top-level loops) */
  parent: LoopInfo | null;

  /** Nested child loops */
  children: LoopInfo[];

  /** Loop nesting depth (0 for top-level) */
  depth: number;

  /** Loop-invariant expressions */
  invariants: Set<Expression>;

  /** Basic induction variables */
  basicInductionVars: Map<string, InductionVariableInfo>;

  /** Derived induction variables */
  derivedInductionVars: Map<string, DerivedInductionVariableInfo>;
}

/**
 * Basic induction variable information
 *
 * A variable that changes by a fixed amount each iteration.
 * Example: i = i + 1
 */
interface InductionVariableInfo {
  /** Variable name */
  name: string;

  /** Increment per iteration */
  stride: number;

  /** Initial value (if known) */
  initialValue: number | null;
}

/**
 * Derived induction variable information
 *
 * A variable computed from a basic IV.
 * Example: j = i * 4
 */
interface DerivedInductionVariableInfo {
  /** Variable name */
  name: string;

  /** Base induction variable */
  baseVar: string;

  /** Multiplier applied to base */
  stride: number;

  /** Constant offset */
  offset: number;
}

/**
 * Loop analyzer
 *
 * Performs comprehensive loop analysis including:
 * - Natural loop detection using back edges
 * - Dominance tree computation
 * - Loop-invariant code detection
 * - Induction variable recognition (basic and derived)
 * - Loop unrolling candidate detection
 *
 * **Algorithm Overview:**
 *
 * 1. **Natural Loop Detection**:
 *    - Find back edges (edges to dominators)
 *    - For each back edge, compute loop body
 *    - Build loop tree structure
 *
 * 2. **Dominance Computation**:
 *    - Calculate dominators using iterative algorithm
 *    - Node A dominates B if all paths to B go through A
 *
 * 3. **Loop-Invariant Detection**:
 *    - Expression is invariant if all operands are:
 *      - Constant, or
 *      - Defined outside loop, or
 *      - Loop-invariant themselves
 *
 * 4. **Induction Variable Recognition**:
 *    - Basic IVs: Linear updates (i = i + c)
 *    - Derived IVs: Computed from basic IVs (j = i * c)
 *
 * @example
 * ```typescript
 * const analyzer = new LoopAnalyzer(cfgs, symbolTable);
 * analyzer.analyze(ast);
 *
 * // Check if expression is loop-invariant
 * const isInvariant = expr.metadata?.get(
 *   OptimizationMetadataKey.LoopInvariant
 * );
 *
 * // Get induction variable info
 * const isIV = variable.metadata?.get(
 *   OptimizationMetadataKey.InductionVariable
 * );
 * ```
 */
export class LoopAnalyzer {
  private diagnostics: Diagnostic[] = [];

  /** CFGs for all functions */
  private cfgs: Map<string, ControlFlowGraph>;

  /** Symbol table for type and scope information (reserved for future tasks) */
  protected symbolTable: SymbolTable;

  /** Detected loops per function */
  private loops: Map<string, LoopInfo[]> = new Map();

  /** Dominators per function (node ID → dominator node ID) */
  private dominators: Map<string, Map<string, string>> = new Map();

  /**
   * Creates a Loop Analyzer
   *
   * @param cfgs - Control flow graphs for all functions
   * @param symbolTable - Symbol table for variable information
   */
  constructor(cfgs: Map<string, ControlFlowGraph>, symbolTable: SymbolTable) {
    this.cfgs = cfgs;
    this.symbolTable = symbolTable;
  }

  /**
   * Analyze loops in the program
   *
   * Performs complete loop analysis for all functions.
   * Attaches optimization metadata to AST nodes.
   *
   * @param ast - The program AST
   */
  public analyze(ast: Program): void {
    const declarations = ast.getDeclarations();

    // Process each function
    for (const decl of declarations) {
      if (decl.constructor.name === 'FunctionDecl') {
        const funcDecl = decl as FunctionDecl;
        const funcName = funcDecl.getName();
        const cfg = this.cfgs.get(funcName);

        if (cfg) {
          this.analyzeFunction(funcDecl, cfg);
        }
      }
    }
  }

  /**
   * Analyze loops in a single function
   *
   * Steps:
   * 1. Compute dominance tree
   * 2. Find natural loops
   * 3. Detect loop-invariant code
   * 4. Recognize induction variables
   * 5. Mark unrollable loops
   *
   * @param funcDecl - Function declaration
   * @param cfg - Control flow graph for function
   */
  protected analyzeFunction(funcDecl: FunctionDecl, cfg: ControlFlowGraph): void {
    const funcName = funcDecl.getName();

    // Step 1: Compute dominators
    const doms = this.computeDominators(cfg);
    this.dominators.set(funcName, doms);

    // Step 2: Find natural loops
    const loops = this.findNaturalLoops(cfg, doms);
    this.loops.set(funcName, loops);

    // Step 3: Detect loop-invariant expressions
    for (const loop of loops) {
      this.detectLoopInvariants(loop, funcDecl);
    }

    // Step 4: Recognize induction variables
    for (const loop of loops) {
      this.recognizeInductionVariables(loop, funcDecl);
    }

    // Step 5: Mark unrollable loops
    for (const loop of loops) {
      this.markUnrollableLoops(loop, funcDecl);
    }
  }

  /**
   * Compute dominance tree using iterative algorithm
   *
   * A node D dominates node N if every path from entry to N goes through D.
   *
   * **Algorithm**:
   * 1. Initialize: entry dominates itself, all others dominated by all nodes
   * 2. Iterate until fixpoint:
   *    - dom(N) = {N} ∪ (∩ dom(P) for all predecessors P of N)
   *
   * @param cfg - Control flow graph
   * @returns Map of node ID → immediate dominator ID
   */
  protected computeDominators(cfg: ControlFlowGraph): Map<string, string> {
    const nodes = cfg.getNodes();
    const dominators = new Map<string, Set<string>>();

    // Initialize: entry dominates itself
    const entry = cfg.entry;
    dominators.set(entry.id, new Set([entry.id]));

    // Initialize: all other nodes dominated by all nodes
    const allNodeIds = new Set(nodes.map(n => n.id));
    for (const node of nodes) {
      if (node.id !== entry.id) {
        dominators.set(node.id, new Set(allNodeIds));
      }
    }

    // Iterate until fixpoint
    let changed = true;
    while (changed) {
      changed = false;

      for (const node of nodes) {
        if (node.id === entry.id) {
          continue; // Entry already computed
        }

        // dom(N) = {N} ∪ (∩ dom(P) for all predecessors P)
        let newDom: Set<string> | null = null;

        for (const pred of node.predecessors) {
          const predDom = dominators.get(pred.id);
          if (!predDom) continue;

          if (newDom === null) {
            newDom = new Set(predDom);
          } else {
            // Intersection
            const intersection = new Set<string>();
            for (const id of newDom) {
              if (predDom.has(id)) {
                intersection.add(id);
              }
            }
            newDom = intersection;
          }
        }

        if (newDom) {
          newDom.add(node.id); // N always dominates itself

          const oldDom = dominators.get(node.id)!;
          if (!this.setsEqual(oldDom, newDom)) {
            dominators.set(node.id, newDom);
            changed = true;
          }
        }
      }
    }

    // Convert to immediate dominators (map each node to its single dominator)
    const idom = new Map<string, string>();
    for (const [nodeId, doms] of dominators) {
      // Find immediate dominator (closest dominator that isn't self)
      const otherDoms = [...doms].filter(id => id !== nodeId);
      if (otherDoms.length > 0) {
        // For now, pick the first one (proper idom requires more work)
        // TODO: Compute true immediate dominator tree
        idom.set(nodeId, otherDoms[0]);
      }
    }

    return idom;
  }

  /**
   * Find all natural loops in CFG
   *
   * A natural loop is defined by a back edge (tail → head)
   * where head dominates tail.
   *
   * **Algorithm**:
   * 1. Find all back edges
   * 2. For each back edge, compute loop body
   * 3. Build loop tree structure
   *
   * @param cfg - Control flow graph
   * @param dominators - Dominator map
   * @returns Array of detected loops
   */
  protected findNaturalLoops(
    cfg: ControlFlowGraph,
    dominators: Map<string, string>
  ): LoopInfo[] {
    const loops: LoopInfo[] = [];
    const nodes = cfg.getNodes();

    // Find all back edges
    const backEdges: { from: CFGNode; to: CFGNode }[] = [];

    for (const node of nodes) {
      for (const successor of node.successors) {
        // Back edge if successor dominates node
        if (this.dominates(dominators, successor.id, node.id)) {
          backEdges.push({ from: node, to: successor });
        }
      }
    }

    // Build loops from back edges
    for (const backEdge of backEdges) {
      const loop = this.buildLoopFromBackEdge(backEdge);
      loops.push(loop);
    }

    // Build loop tree (detect nesting)
    this.buildLoopTree(loops);

    return loops;
  }

  /**
   * Build a loop from a back edge
   *
   * The loop consists of:
   * - Header: the target of the back edge
   * - Body: all nodes that can reach the back edge source
   *         without going through the header
   *
   * @param backEdge - The back edge defining the loop
   * @returns Loop information
   */
  protected buildLoopFromBackEdge(
    backEdge: { from: CFGNode; to: CFGNode }
  ): LoopInfo {
    const header = backEdge.to;
    const body = new Set<CFGNode>();

    // Header is always in the body
    body.add(header);

    // Work backwards from back edge source to header
    const worklist: CFGNode[] = [backEdge.from];
    const visited = new Set<string>([header.id]);

    while (worklist.length > 0) {
      const node = worklist.pop()!;

      if (!visited.has(node.id)) {
        visited.add(node.id);
        body.add(node);

        // Add predecessors to worklist
        for (const pred of node.predecessors) {
          if (!visited.has(pred.id)) {
            worklist.push(pred);
          }
        }
      }
    }

    return {
      header,
      body,
      backEdge,
      parent: null,
      children: [],
      depth: 0,
      invariants: new Set(),
      basicInductionVars: new Map(),
      derivedInductionVars: new Map(),
    };
  }

  /**
   * Build loop tree structure (detect nesting)
   *
   * Loop A is nested in loop B if all nodes of A are in B's body.
   *
   * @param loops - Array of detected loops
   */
  protected buildLoopTree(loops: LoopInfo[]): void {
    // Sort loops by body size (smaller loops first)
    loops.sort((a, b) => a.body.size - b.body.size);

    // Assign parent/child relationships
    for (let i = 0; i < loops.length; i++) {
      const inner = loops[i];

      for (let j = i + 1; j < loops.length; j++) {
        const outer = loops[j];

        // Check if inner is nested in outer
        const allInnerNodesInOuter = [...inner.body].every(node => outer.body.has(node));

        if (allInnerNodesInOuter) {
          inner.parent = outer;
          outer.children.push(inner);
          inner.depth = outer.depth + 1;
          break; // Found immediate parent
        }
      }
    }
  }

  /**
   * Detect loop-invariant expressions
   *
   * An expression is loop-invariant if all its operands are either:
   * - Constants
   * - Defined outside the loop
   * - Loop-invariant themselves
   *
   * **Why this analysis matters:**
   * Loop-invariant expressions can be hoisted out of loops,
   * reducing redundant computation in hot code paths.
   * Critical for 6502 performance optimization.
   *
   * **Algorithm:**
   * 1. Scan all expressions in loop body
   * 2. Recursively check if operands are invariant
   * 3. Mark invariant expressions with metadata
   *
   * @param loop - Loop information
   * @param _funcDecl - Function declaration (reserved for future use)
   */
  protected detectLoopInvariants(loop: LoopInfo, _funcDecl: FunctionDecl): void {
    // Process all statements in loop body
    for (const node of loop.body) {
      if (node.statement) {
        this.analyzeStatementForInvariants(node.statement, loop);
      }
    }
  }

  /**
   * Analyze a statement for loop-invariant expressions
   *
   * Recursively walks the statement AST to find and mark
   * loop-invariant subexpressions.
   *
   * @param _statement - Statement to analyze (reserved for future AST walking)
   * @param loop - Loop context
   */
  protected analyzeStatementForInvariants(_statement: any, loop: LoopInfo): void {
    // For now, we'll analyze the statement structure
    // This is a simplified implementation that can be expanded
    // when we have more statement types to handle
    
    // TODO: Full AST walking implementation will be added
    // when we integrate with the AST walker infrastructure
    
    // Placeholder: Mark the loop as processed
    loop.invariants = loop.invariants || new Set();
  }

  /**
   * Check if an expression is loop-invariant
   *
   * An expression is invariant if:
   * 1. It's a constant literal
   * 2. It references a variable defined outside the loop
   * 3. All its subexpressions are invariant (recursive check)
   *
   * **Why recursive checking:**
   * Complex expressions like (a + b) * c are invariant
   * if a, b, and c are all invariant.
   *
   * @param expr - Expression to check
   * @param loop - Loop context
   * @returns True if expression is loop-invariant
   */
  protected isLoopInvariant(expr: Expression, loop: LoopInfo): boolean {
    // Case 1: Constant literals are always invariant
    if (this.isConstantLiteral(expr)) {
      return true;
    }

    // Case 2: Variable references - check if defined outside loop
    if (this.isVariableReference(expr)) {
      return this.isDefinedOutsideLoop(expr, loop);
    }

    // Case 3: Binary expressions - check if all operands are invariant
    if (this.isBinaryExpression(expr)) {
      const leftInvariant = this.isLoopInvariant((expr as any).left, loop);
      const rightInvariant = this.isLoopInvariant((expr as any).right, loop);
      return leftInvariant && rightInvariant;
    }

    // Case 4: Unary expressions - check if operand is invariant
    if (this.isUnaryExpression(expr)) {
      return this.isLoopInvariant((expr as any).operand, loop);
    }

    // Case 5: Function calls are NOT invariant (may have side effects)
    // Unless we have purity analysis proving they're pure
    if (this.isFunctionCall(expr)) {
      return false;
    }

    // Default: Conservative - assume not invariant
    return false;
  }

  /**
   * Check if expression is a constant literal
   *
   * @param expr - Expression to check
   * @returns True if constant literal
   */
  protected isConstantLiteral(expr: Expression): boolean {
    const className = expr.constructor.name;
    return (
      className === 'NumberLiteral' ||
      className === 'BooleanLiteral' ||
      className === 'StringLiteral'
    );
  }

  /**
   * Check if expression is a variable reference
   *
   * @param expr - Expression to check
   * @returns True if variable reference
   */
  protected isVariableReference(expr: Expression): boolean {
    return expr.constructor.name === 'IdentifierExpression';
  }

  /**
   * Check if expression is a binary expression
   *
   * @param expr - Expression to check
   * @returns True if binary expression
   */
  protected isBinaryExpression(expr: Expression): boolean {
    return expr.constructor.name === 'BinaryExpression';
  }

  /**
   * Check if expression is a unary expression
   *
   * @param expr - Expression to check
   * @returns True if unary expression
   */
  protected isUnaryExpression(expr: Expression): boolean {
    return expr.constructor.name === 'UnaryExpression';
  }

  /**
   * Check if expression is a function call
   *
   * @param expr - Expression to check
   * @returns True if function call
   */
  protected isFunctionCall(expr: Expression): boolean {
    return expr.constructor.name === 'CallExpression';
  }

  /**
   * Check if variable is defined outside the loop
   *
   * A variable is defined outside the loop if:
   * - Its definition doesn't occur in any loop body node
   * - It's a function parameter
   * - It's a global/module-level variable
   *
   * **Why this check is critical:**
   * Only variables defined outside can be considered invariant.
   * Variables modified inside the loop are variant.
   *
   * @param expr - Variable reference expression
   * @param loop - Loop context
   * @returns True if defined outside loop
   */
  protected isDefinedOutsideLoop(expr: Expression, loop: LoopInfo): boolean {
    // Get variable name
    const variableName = (expr as any).name || (expr as any).getName?.();
    if (!variableName) {
      return false;
    }

    // Check if variable is assigned/modified in loop body
    for (const node of loop.body) {
      if (this.nodeModifiesVariable(node, variableName)) {
        return false; // Variable is modified in loop - not invariant
      }
    }

    // Variable is not modified in loop - it's invariant
    return true;
  }

  /**
   * Check if a CFG node modifies a variable
   *
   * Checks assignments and other mutation operations.
   *
   * @param node - CFG node to check
   * @param variableName - Variable name
   * @returns True if node modifies the variable
   */
  protected nodeModifiesVariable(node: CFGNode, variableName: string): boolean {
    // Simple check: look for assignments in the statement
    // This is conservative - may need refinement with full AST walking
    if (node.statement) {
      const stmtStr = node.statement.constructor.name;
      
      // Assignment statement
      if (stmtStr === 'VariableDeclaration' || stmtStr === 'Assignment') {
        // Check if this statement assigns to our variable
        // This is a simplified check - proper implementation needs AST walking
        const target = (node.statement as any).target || (node.statement as any).name;
        if (target === variableName) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Recognize induction variables (basic and derived)
   *
   * **Basic IV**: Variable with linear update (i = i + c)
   * **Derived IV**: Variable computed from basic IV (j = i * c)
   *
   * @param _loop - Loop information
   * @param _funcDecl - Function declaration
   */
  protected recognizeInductionVariables(_loop: LoopInfo, _funcDecl: FunctionDecl): void {
    // TODO: Implement in Tasks 8.11.4 and 8.11.5
    // For now, this is a placeholder
  }

  /**
   * Mark loops as unrollable
   *
   * A loop is unrollable if:
   * - Small iteration count (< 10)
   * - Simple control flow (no breaks/continues)
   * - Fixed iteration count (known at compile time)
   *
   * @param _loop - Loop information
   * @param _funcDecl - Function declaration
   */
  protected markUnrollableLoops(_loop: LoopInfo, _funcDecl: FunctionDecl): void {
    // TODO: Enhance in future tasks
    // For now, this is a placeholder
  }

  /**
   * Check if node A dominates node B
   *
   * @param dominators - Dominator map
   * @param domId - Potential dominator node ID
   * @param nodeId - Node being checked
   * @returns True if domId dominates nodeId
   */
  protected dominates(dominators: Map<string, string>, domId: string, nodeId: string): boolean {
    let current: string | undefined = nodeId;

    while (current) {
      if (current === domId) {
        return true;
      }
      current = dominators.get(current);
    }

    return false;
  }

  /**
   * Check if two sets are equal
   *
   * @param set1 - First set
   * @param set2 - Second set
   * @returns True if sets have same elements
   */
  protected setsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    if (set1.size !== set2.size) {
      return false;
    }

    for (const item of set1) {
      if (!set2.has(item)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get diagnostics generated during analysis
   *
   * @returns Array of diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }
}