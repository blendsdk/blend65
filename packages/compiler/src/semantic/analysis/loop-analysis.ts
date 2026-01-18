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
import {
  isFunctionDecl,
  isLiteralExpression,
  isIdentifierExpression,
  isBinaryExpression,
  isUnaryExpression,
  isCallExpression,
  isExpressionStatement,
  isAssignmentExpression,
  isVariableDecl,
  isIfStatement,
  isLoopStatement,
} from '../../ast/type-guards.js';

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

  /** Dominators per function (node ID → Set of dominator IDs) */
  private dominators: Map<string, Map<string, Set<string>>> = new Map();

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
      if (isFunctionDecl(decl)) {
        const funcName = decl.getName();
        const cfg = this.cfgs.get(funcName);

        if (cfg) {
          this.analyzeFunction(decl, cfg);
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
   * @returns Map of node ID → Set of all dominator IDs
   */
  protected computeDominators(cfg: ControlFlowGraph): Map<string, Set<string>> {
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

    return dominators;
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
   * @param dominators - Dominator map (node ID → Set of all dominator IDs)
   * @returns Array of detected loops
   */
  protected findNaturalLoops(
    cfg: ControlFlowGraph,
    dominators: Map<string, Set<string>>
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
    if (isLiteralExpression(expr)) {
      return true;
    }

    // Case 2: Variable references - check if defined outside loop
    if (isIdentifierExpression(expr)) {
      return this.isDefinedOutsideLoop(expr, loop);
    }

    // Case 3: Binary expressions - check if all operands are invariant
    if (isBinaryExpression(expr)) {
      const leftInvariant = this.isLoopInvariant((expr as any).left, loop);
      const rightInvariant = this.isLoopInvariant((expr as any).right, loop);
      return leftInvariant && rightInvariant;
    }

    // Case 4: Unary expressions - check if operand is invariant
    if (isUnaryExpression(expr)) {
      return this.isLoopInvariant((expr as any).operand, loop);
    }

    // Case 5: Function calls are NOT invariant (may have side effects)
    // Unless we have purity analysis proving they're pure
    if (isCallExpression(expr)) {
      return false;
    }

    // Default: Conservative - assume not invariant
    return false;
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
    if (!node.statement) {
      return false;
    }

    // Check if this is a variable declaration
    if (isVariableDecl(node.statement)) {
      const declName = node.statement.getName();
      return declName === variableName;
    }

    // Check if this is an assignment expression (either standalone or in expression statement)
    let assignmentExpr: any = null;
    
    if (isAssignmentExpression(node.statement)) {
      assignmentExpr = node.statement;
    } else if (isExpressionStatement(node.statement)) {
      const expr = node.statement.getExpression();
      if (expr && isAssignmentExpression(expr)) {
        assignmentExpr = expr;
      }
    }

    if (assignmentExpr) {
      const target = assignmentExpr.getTarget();
      if (target && isIdentifierExpression(target)) {
        const targetName = target.getName();
        return targetName === variableName;
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
   * This is a critical optimization for 6502 code generation.
   * Basic induction variables enable:
   * - Strength reduction (multiply → add)
   * - Loop unrolling decisions
   * - Array index optimization
   *
   * @param loop - Loop information
   * @param funcDecl - Function declaration
   */
  protected recognizeInductionVariables(loop: LoopInfo, funcDecl: FunctionDecl): void {
    // Phase 1: Find basic induction variables
    this.findBasicInductionVariables(loop, funcDecl);

    // Phase 2: Find derived induction variables (Task 8.11.5)
    this.findDerivedInductionVariables(loop, funcDecl);
  }

  /**
   * Find basic induction variables in a loop
   *
   * A basic induction variable is a variable that is updated
   * by a constant amount on each iteration:
   * - i = i + c  (increment by constant)
   * - i = i - c  (decrement by constant)
   * - i = c + i  (commutative addition)
   *
   * **Algorithm:**
   * 1. Scan all assignments in the loop body
   * 2. Find patterns: var = var ± constant
   * 3. Extract stride (constant change per iteration)
   * 4. Find initial value from pre-loop assignments
   *
   * @param loop - Loop information
   * @param funcDecl - Function declaration for initial value search
   */
  protected findBasicInductionVariables(loop: LoopInfo, funcDecl: FunctionDecl): void {
    // Map to track potential IVs and their update patterns
    const ivCandidates = new Map<string, { stride: number; updateCount: number }>();

    // Scan all CFG nodes in loop body for assignments
    for (const node of loop.body) {
      if (!node.statement) continue;

      // Check for assignment patterns in the statement
      this.scanForIVAssignments(node.statement, ivCandidates);
    }

    // Filter to only variables with exactly one linear update
    for (const [varName, info] of ivCandidates) {
      if (info.updateCount === 1) {
        // This is a basic induction variable
        const initialValue = this.findInitialValue(varName, funcDecl, loop);

        loop.basicInductionVars.set(varName, {
          name: varName,
          stride: info.stride,
          initialValue,
        });
      }
      // Variables with multiple updates or non-linear updates are not basic IVs
    }
  }

  /**
   * Scan a statement for induction variable assignment patterns
   *
   * Looks for patterns like:
   * - i = i + 1
   * - i = i - 2
   * - i = 1 + i (commutative)
   *
   * @param statement - Statement to scan
   * @param ivCandidates - Map to accumulate IV candidates
   */
  protected scanForIVAssignments(
    statement: any,
    ivCandidates: Map<string, { stride: number; updateCount: number }>
  ): void {
    // Handle ExpressionStatement wrapping an AssignmentExpression
    if (isExpressionStatement(statement)) {
      const expr = statement.getExpression?.() || (statement as any).expression;
      if (expr && isAssignmentExpression(expr)) {
        this.checkAssignmentForIV(expr, ivCandidates);
      }
    }

    // Handle direct AssignmentExpression
    if (isAssignmentExpression(statement)) {
      this.checkAssignmentForIV(statement, ivCandidates);
    }

    // Handle VariableDecl with initializer (for loop counters declared in body)
    if (isVariableDecl(statement)) {
      // Variable declarations don't update existing variables,
      // so they're not IV updates (they might be initial values)
    }

    // Recursively check if/while bodies
    if (isIfStatement(statement)) {
      const thenBranch = statement.getThenBranch?.() || [];
      const elseBranch = statement.getElseBranch?.() || [];
      for (const stmt of thenBranch) {
        this.scanForIVAssignments(stmt, ivCandidates);
      }
      for (const stmt of elseBranch) {
        this.scanForIVAssignments(stmt, ivCandidates);
      }
    }
  }

  /**
   * Check if an assignment expression is a basic IV update
   *
   * Pattern: target = target ± constant
   *
   * @param assignExpr - Assignment expression to check
   * @param ivCandidates - Map to accumulate IV candidates
   */
  protected checkAssignmentForIV(
    assignExpr: any,
    ivCandidates: Map<string, { stride: number; updateCount: number }>
  ): void {
    // Get target of assignment
    const target = assignExpr.getTarget();
    if (!target || !isIdentifierExpression(target)) {
      return; // Only simple variable assignments can be IVs
    }

    const targetName = target.getName();
    if (!targetName) return;

    // Get the value being assigned
    const value = assignExpr.getValue();
    if (!value) return;

    // Check for compound assignment operators (+=, -=)
    const operator = assignExpr.getOperator();
    if (this.isCompoundAssignment(operator)) {
      const stride = this.getCompoundAssignmentStride(value, operator);
      if (stride !== null) {
        this.recordIVCandidate(ivCandidates, targetName, stride);
      }
      return;
    }

    // Check for simple assignment with binary expression: i = i + c
    if (isBinaryExpression(value)) {
      const stride = this.extractBasicIVStride(targetName, value);
      if (stride !== null) {
        this.recordIVCandidate(ivCandidates, targetName, stride);
      }
    }
  }

  /**
   * Check if operator is a compound assignment (+=, -=)
   *
   * @param operator - Token type
   * @returns True if compound assignment
   */
  protected isCompoundAssignment(operator: any): boolean {
    // Check for common compound assignment operators
    const opName = typeof operator === 'string' ? operator : operator?.toString?.() || '';
    return opName.includes('PLUS_ASSIGN') || opName.includes('MINUS_ASSIGN');
  }

  /**
   * Get stride from compound assignment value
   *
   * For i += c, the value is just c
   *
   * @param value - The value expression
   * @param operator - The compound operator
   * @returns Stride value or null if not constant
   */
  protected getCompoundAssignmentStride(value: any, operator: any): number | null {
    // Value should be a constant for basic IV
    if (isLiteralExpression(value)) {
      const litValue = value.getValue();
      if (typeof litValue === 'number') {
        const opName = typeof operator === 'string' ? operator : operator?.toString?.() || '';
        if (opName.includes('MINUS_ASSIGN')) {
          return -litValue;
        }
        return litValue;
      }
    }
    return null;
  }

  /**
   * Extract basic IV stride from binary expression
   *
   * Handles patterns:
   * - i + c → stride = c
   * - i - c → stride = -c
   * - c + i → stride = c
   *
   * @param targetName - Name of the variable being assigned to
   * @param binaryExpr - Binary expression to analyze
   * @returns Stride value or null if not a valid IV pattern
   */
  protected extractBasicIVStride(targetName: string, binaryExpr: any): number | null {
    const left = binaryExpr.getLeft();
    const right = binaryExpr.getRight();
    const operator = binaryExpr.getOperator();

    // Determine if this is + or - operation
    const opName = typeof operator === 'string' ? operator : operator?.toString?.() || '';
    const isAddition = opName.includes('PLUS') && !opName.includes('ASSIGN');
    const isSubtraction = opName.includes('MINUS') && !opName.includes('ASSIGN');

    if (!isAddition && !isSubtraction) {
      return null; // Only + and - create basic IVs
    }

    // Pattern 1: i = i + c or i = i - c
    if (isIdentifierExpression(left)) {
      const leftName = left.getName();
      if (leftName === targetName && isLiteralExpression(right)) {
        const rightValue = right.getValue();
        if (typeof rightValue === 'number') {
          return isSubtraction ? -rightValue : rightValue;
        }
      }
    }

    // Pattern 2: i = c + i (commutative for addition only)
    if (isAddition && isIdentifierExpression(right)) {
      const rightName = right.getName();
      if (rightName === targetName && isLiteralExpression(left)) {
        const leftValue = left.getValue();
        if (typeof leftValue === 'number') {
          return leftValue;
        }
      }
    }

    return null;
  }

  /**
   * Record an IV candidate, tracking multiple updates
   *
   * @param ivCandidates - Map of candidates
   * @param varName - Variable name
   * @param stride - Stride value
   */
  protected recordIVCandidate(
    ivCandidates: Map<string, { stride: number; updateCount: number }>,
    varName: string,
    stride: number
  ): void {
    const existing = ivCandidates.get(varName);
    if (existing) {
      // Multiple updates - check if consistent stride
      if (existing.stride === stride) {
        existing.updateCount++;
      } else {
        // Different strides - not a basic IV
        existing.updateCount = 999; // Mark as invalid
      }
    } else {
      ivCandidates.set(varName, { stride, updateCount: 1 });
    }
  }

  /**
   * Find initial value of a variable before the loop
   *
   * Searches for variable declaration or assignment before the loop.
   *
   * @param varName - Variable name
   * @param funcDecl - Function declaration
   * @param _loop - Loop being analyzed (reserved for future location matching)
   * @returns Initial value or null if not determinable
   */
  protected findInitialValue(
    varName: string,
    funcDecl: FunctionDecl,
    _loop: LoopInfo
  ): number | null {
    const body = funcDecl.getBody?.() || [];
    if (!body) return null;

    // Find the loop header's position in the CFG to determine "before loop"
    // For simplicity, we scan function body statements sequentially

    for (const stmt of body) {
      // Stop when we reach the loop (simplified: check for while statements)
      if (isLoopStatement(stmt)) {
        break;
      }

      // Check variable declarations
      if (isVariableDecl(stmt)) {
        const declName = stmt.getName?.() || (stmt as any).name;
        if (declName === varName) {
          const initializer = stmt.getInitializer?.() || (stmt as any).initializer;
          if (initializer && isLiteralExpression(initializer)) {
            const value = initializer.getValue?.() || (initializer as any).value;
            if (typeof value === 'number') {
              return value;
            }
          }
        }
      }

      // Check assignments
      if (isExpressionStatement(stmt)) {
        const expr = stmt.getExpression?.() || (stmt as any).expression;
        if (expr && isAssignmentExpression(expr)) {
          const target = expr.getTarget?.() || (expr as any).target;
          if (target && isIdentifierExpression(target)) {
            const assignName = target.getName?.() || (target as any).name;
            if (assignName === varName) {
              const value = expr.getValue?.() || (expr as any).value;
              if (value && isLiteralExpression(value)) {
                const litValue = value.getValue?.() || (value as any).value;
                if (typeof litValue === 'number') {
                  return litValue;
                }
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if a statement is a loop statement
   *
   * @param stmt - Statement to check
   * @returns True if statement is a loop
   */
  protected isLoopStatement(stmt: any): boolean {
    // Check if this statement is a loop
    return isLoopStatement(stmt);
  }

  /**
   * Find derived induction variables in a loop (Task 8.11.5)
   *
   * A derived induction variable is a variable that is computed
   * from a basic induction variable using a linear transformation:
   * - j = i * c          (multiplication by constant)
   * - j = i * c + k      (multiplication plus constant offset)
   * - j = k + i * c      (commutative form)
   * - j = i + k          (simple offset from basic IV)
   *
   * **Why Derived IVs Matter for 6502:**
   * Recognizing derived IVs enables strength reduction optimization.
   * Instead of computing i * 4 each iteration (expensive multiply),
   * we can use j = j + 4 (cheap addition).
   *
   * **Algorithm:**
   * 1. For each assignment in loop body (not self-referential)
   * 2. Check if RHS uses a basic IV in a linear pattern
   * 3. Extract: base IV, multiplier (stride), and offset
   * 4. Verify the target is not the base IV itself
   *
   * @param loop - Loop information (with basicInductionVars populated)
   * @param _funcDecl - Function declaration (reserved for future use)
   */
  protected findDerivedInductionVariables(loop: LoopInfo, _funcDecl: FunctionDecl): void {
    // No basic IVs means no derived IVs possible
    if (loop.basicInductionVars.size === 0) {
      return;
    }

    // Scan all CFG nodes in loop body for assignments
    for (const node of loop.body) {
      if (!node.statement) continue;

      // Check for derived IV patterns in the statement
      this.scanForDerivedIVAssignments(node.statement, loop);
    }
  }

  /**
   * Scan a statement for derived induction variable patterns
   *
   * Looks for patterns like:
   * - j = i * 4       (stride = 4, offset = 0)
   * - j = i * 2 + 10  (stride = 2, offset = 10)
   * - j = 10 + i * 2  (commutative)
   * - j = i + 5       (stride = 1, offset = 5)
   *
   * @param statement - Statement to scan
   * @param loop - Loop context with basic IVs
   */
  protected scanForDerivedIVAssignments(statement: any, loop: LoopInfo): void {
    // Handle ExpressionStatement wrapping an AssignmentExpression
    if (isExpressionStatement(statement)) {
      const expr = statement.getExpression?.() || (statement as any).expression;
      if (expr && isAssignmentExpression(expr)) {
        this.checkAssignmentForDerivedIV(expr, loop);
      }
    }

    // Handle direct AssignmentExpression
    if (isAssignmentExpression(statement)) {
      this.checkAssignmentForDerivedIV(statement, loop);
    }

    // Handle VariableDecl with initializer (e.g., let j: byte = i * 4)
    if (isVariableDecl(statement)) {
      this.checkVariableDeclForDerivedIV(statement, loop);
    }

    // Recursively check if/while bodies
    if (isIfStatement(statement)) {
      const thenBranch = statement.getThenBranch?.() || [];
      const elseBranch = statement.getElseBranch?.() || [];
      for (const stmt of thenBranch) {
        this.scanForDerivedIVAssignments(stmt, loop);
      }
      for (const stmt of elseBranch) {
        this.scanForDerivedIVAssignments(stmt, loop);
      }
    }
  }

  /**
   * Check if an assignment creates a derived induction variable
   *
   * @param assignExpr - Assignment expression to check
   * @param loop - Loop context with basic IVs
   */
  protected checkAssignmentForDerivedIV(assignExpr: any, loop: LoopInfo): void {
    // Get target of assignment
    const target = assignExpr.getTarget();
    if (!target || !isIdentifierExpression(target)) {
      return; // Only simple variable assignments
    }

    const targetName = target.getName();
    if (!targetName) return;

    // Skip if target is itself a basic IV (that's a basic IV update, not derived)
    if (loop.basicInductionVars.has(targetName)) {
      return;
    }

    // Skip if already identified as derived IV
    if (loop.derivedInductionVars.has(targetName)) {
      return;
    }

    // Get the value being assigned
    const value = assignExpr.getValue();
    if (!value) return;

    // Try to extract derived IV pattern
    const derivedInfo = this.extractDerivedIVPattern(targetName, value, loop);
    if (derivedInfo) {
      loop.derivedInductionVars.set(targetName, derivedInfo);
    }
  }

  /**
   * Check if a variable declaration creates a derived induction variable
   *
   * Handles: let j: byte = i * 4
   *
   * @param varDecl - Variable declaration to check
   * @param loop - Loop context with basic IVs
   */
  protected checkVariableDeclForDerivedIV(varDecl: any, loop: LoopInfo): void {
    const varName = varDecl.getName?.() || varDecl.name;
    if (!varName) return;

    // Skip if target is a basic IV
    if (loop.basicInductionVars.has(varName)) {
      return;
    }

    // Get initializer
    const initializer = varDecl.getInitializer?.() || varDecl.initializer;
    if (!initializer) return;

    // Try to extract derived IV pattern
    const derivedInfo = this.extractDerivedIVPattern(varName, initializer, loop);
    if (derivedInfo) {
      loop.derivedInductionVars.set(varName, derivedInfo);
    }
  }

  /**
   * Extract derived IV pattern from an expression
   *
   * Recognizes these patterns:
   * 1. basicIV * constant           → stride=constant, offset=0
   * 2. constant * basicIV           → stride=constant, offset=0
   * 3. basicIV * constant + offset  → stride=constant, offset=offset
   * 4. offset + basicIV * constant  → stride=constant, offset=offset
   * 5. basicIV + offset             → stride=1, offset=offset
   * 6. offset + basicIV             → stride=1, offset=offset
   *
   * @param targetName - Name of the variable being assigned
   * @param expr - Expression to analyze
   * @param loop - Loop context with basic IVs
   * @returns Derived IV info or null if not a derived IV pattern
   */
  protected extractDerivedIVPattern(
    targetName: string,
    expr: any,
    loop: LoopInfo
  ): DerivedInductionVariableInfo | null {
    // Case 1: Direct reference to basic IV (stride=1, offset=0)
    // This is actually just copying the IV, which is a trivial derived IV
    if (isIdentifierExpression(expr)) {
      const varName = expr.getName();
      if (varName && loop.basicInductionVars.has(varName)) {
        return {
          name: targetName,
          baseVar: varName,
          stride: 1,
          offset: 0,
        };
      }
      return null;
    }

    // Case 2: Binary expression - the main case
    if (isBinaryExpression(expr)) {
      return this.extractDerivedIVFromBinary(targetName, expr, loop);
    }

    return null;
  }

  /**
   * Extract derived IV from a binary expression
   *
   * @param targetName - Name of the variable being assigned
   * @param binaryExpr - Binary expression to analyze
   * @param loop - Loop context with basic IVs
   * @returns Derived IV info or null
   */
  protected extractDerivedIVFromBinary(
    targetName: string,
    binaryExpr: any,
    loop: LoopInfo
  ): DerivedInductionVariableInfo | null {
    const left = binaryExpr.getLeft();
    const right = binaryExpr.getRight();
    const operator = binaryExpr.getOperator();

    const opName = typeof operator === 'string' ? operator : operator?.toString?.() || '';
    const isMultiply = opName.includes('STAR') || opName.includes('MULTIPLY');
    const isAddition = opName.includes('PLUS') && !opName.includes('ASSIGN');
    const isSubtraction = opName.includes('MINUS') && !opName.includes('ASSIGN');

    // Pattern: basicIV * constant or constant * basicIV
    if (isMultiply) {
      return this.extractMultiplyPattern(targetName, left, right, loop);
    }

    // Pattern: (something) + offset or offset + (something)
    // where (something) might be basicIV or basicIV * constant
    if (isAddition || isSubtraction) {
      return this.extractAdditionPattern(targetName, left, right, isSubtraction, loop);
    }

    return null;
  }

  /**
   * Extract derived IV from multiplication pattern
   *
   * Handles: i * c or c * i
   *
   * @param targetName - Variable being assigned
   * @param left - Left operand
   * @param right - Right operand
   * @param loop - Loop context
   * @returns Derived IV info or null
   */
  protected extractMultiplyPattern(
    targetName: string,
    left: any,
    right: any,
    loop: LoopInfo
  ): DerivedInductionVariableInfo | null {
    // Pattern 1: basicIV * constant
    if (isIdentifierExpression(left)) {
      const leftName = left.getName();
      if (leftName && loop.basicInductionVars.has(leftName)) {
        const constant = this.extractConstant(right);
        if (constant !== null) {
          return {
            name: targetName,
            baseVar: leftName,
            stride: constant,
            offset: 0,
          };
        }
      }
    }

    // Pattern 2: constant * basicIV (commutative)
    if (isIdentifierExpression(right)) {
      const rightName = right.getName();
      if (rightName && loop.basicInductionVars.has(rightName)) {
        const constant = this.extractConstant(left);
        if (constant !== null) {
          return {
            name: targetName,
            baseVar: rightName,
            stride: constant,
            offset: 0,
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract derived IV from addition/subtraction pattern
   *
   * Handles:
   * - basicIV + offset
   * - offset + basicIV
   * - (basicIV * c) + offset
   * - offset + (basicIV * c)
   *
   * @param targetName - Variable being assigned
   * @param left - Left operand
   * @param right - Right operand
   * @param isSubtraction - True if this is subtraction
   * @param loop - Loop context
   * @returns Derived IV info or null
   */
  protected extractAdditionPattern(
    targetName: string,
    left: any,
    right: any,
    isSubtraction: boolean,
    loop: LoopInfo
  ): DerivedInductionVariableInfo | null {
    // Try to match left as the IV-related part and right as offset
    const leftResult = this.extractIVComponent(left, loop);
    if (leftResult) {
      const offset = this.extractConstant(right);
      if (offset !== null) {
        return {
          name: targetName,
          baseVar: leftResult.baseVar,
          stride: leftResult.stride,
          offset: isSubtraction ? -offset : offset,
        };
      }
    }

    // Try to match right as the IV-related part and left as offset (only for addition)
    if (!isSubtraction) {
      const rightResult = this.extractIVComponent(right, loop);
      if (rightResult) {
        const offset = this.extractConstant(left);
        if (offset !== null) {
          return {
            name: targetName,
            baseVar: rightResult.baseVar,
            stride: rightResult.stride,
            offset: offset,
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract the IV component from an expression
   *
   * This handles both direct IV references and IV * constant patterns.
   *
   * @param expr - Expression to analyze
   * @param loop - Loop context
   * @returns Object with baseVar and stride, or null
   */
  protected extractIVComponent(
    expr: any,
    loop: LoopInfo
  ): { baseVar: string; stride: number } | null {
    // Direct IV reference: stride = 1
    if (isIdentifierExpression(expr)) {
      const varName = expr.getName();
      if (varName && loop.basicInductionVars.has(varName)) {
        return { baseVar: varName, stride: 1 };
      }
      return null;
    }

    // IV * constant or constant * IV
    if (isBinaryExpression(expr)) {
      const left = expr.getLeft();
      const right = expr.getRight();
      const operator = expr.getOperator();

      const opName = typeof operator === 'string' ? operator : (operator as any)?.toString?.() || '';
      const isMultiply = opName.includes('STAR') || opName.includes('MULTIPLY');

      if (isMultiply) {
        // IV * constant
        if (isIdentifierExpression(left)) {
          const leftName = left.getName();
          if (leftName && loop.basicInductionVars.has(leftName)) {
            const constant = this.extractConstant(right);
            if (constant !== null) {
              return { baseVar: leftName, stride: constant };
            }
          }
        }

        // constant * IV
        if (isIdentifierExpression(right)) {
          const rightName = right.getName();
          if (rightName && loop.basicInductionVars.has(rightName)) {
            const constant = this.extractConstant(left);
            if (constant !== null) {
              return { baseVar: rightName, stride: constant };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract a constant number from an expression
   *
   * @param expr - Expression to analyze
   * @returns Number value or null if not a constant
   */
  protected extractConstant(expr: any): number | null {
    if (isLiteralExpression(expr)) {
      const value = expr.getValue();
      if (typeof value === 'number') {
        return value;
      }
    }
    return null;
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
   * @param dominators - Dominator map (node ID → Set of all dominator IDs)
   * @param domId - Potential dominator node ID
   * @param nodeId - Node being checked
   * @returns True if domId dominates nodeId
   */
  protected dominates(
    dominators: Map<string, Set<string>>,
    domId: string,
    nodeId: string
  ): boolean {
    // Get the set of all dominators for nodeId
    const nodeDoms = dominators.get(nodeId);
    if (!nodeDoms) {
      return false;
    }

    // Check if domId is in the dominator set
    return nodeDoms.has(domId);
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

  /**
   * Get detected loops for a function
   *
   * Used for testing and debugging loop analysis results.
   *
   * @param funcName - Function name
   * @returns Array of loop information or undefined if function not found
   */
  public getLoopsForFunction(funcName: string): LoopInfo[] | undefined {
    return this.loops.get(funcName);
  }

  /**
   * Get all detected loops across all functions
   *
   * @returns Map of function name to loops
   */
  public getAllLoops(): Map<string, LoopInfo[]> {
    return new Map(this.loops);
  }
}

// Export interfaces for testing
export type { LoopInfo, InductionVariableInfo, DerivedInductionVariableInfo };