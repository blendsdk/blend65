/**
 * Definite Assignment Analysis (Task 8.1)
 *
 * Analyzes variable initialization to detect:
 * - Variables that are always initialized before use
 * - Variables used before initialization
 * - Variables with compile-time constant initialization
 *
 * **Algorithm:**
 * 1. For each function's CFG, perform forward flow analysis
 * 2. Track "definitely assigned" set at each CFG node
 * 3. At branches, compute intersection of paths (must be initialized on ALL paths)
 * 4. At loop headers, iterate to fixed point
 * 5. Flag errors for uses before initialization
 * 6. Set metadata for optimization hints
 *
 * **Metadata Generated:**
 * - `DefiniteAssignmentAlwaysInitialized`: Variable is always initialized before any use
 * - `DefiniteAssignmentInitValue`: Initial constant value (if compile-time constant)
 * - `DefiniteAssignmentUninitializedUse`: Identifier node represents uninitialized use
 */

import type { Program, VariableDecl, IdentifierExpression } from '../../ast/nodes.js';
import { Statement, Expression } from '../../ast/base.js';
import type { SymbolTable } from '../symbol-table.js';
import type { ControlFlowGraph, CFGNode } from '../control-flow.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import { OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { SymbolKind } from '../symbol.js';
import { ASTWalker } from '../../ast/walker/base.js';
import {
  isVariableDecl,
  isAssignmentExpression,
  isIdentifierExpression,
  isExpressionStatement,
  isFunctionDecl,
  isLiteralExpression,
  isIfStatement,
  isWhileStatement,
  isForStatement,
  isReturnStatement,
} from '../../ast/type-guards.js';

/**
 * Set of definitely assigned variables at a program point
 *
 * Maps variable symbol name to whether it's definitely assigned.
 */
type AssignmentSet = Set<string>;

/**
 * Definite Assignment Analyzer
 *
 * Performs forward dataflow analysis to track variable initialization.
 * Uses control flow graphs to compute definitely assigned sets.
 *
 * @example
 * ```typescript
 * const analyzer = new DefiniteAssignmentAnalyzer(symbolTable, cfgs);
 * analyzer.analyze(ast);
 * const diagnostics = analyzer.getDiagnostics();
 * ```
 */
export class DefiniteAssignmentAnalyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Variables that are always initialized (set during analysis) */
  protected alwaysInitialized: Set<string> = new Set();

  /**
   * Create definite assignment analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   * @param cfgs - Control flow graphs from Pass 5
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly cfgs: Map<string, ControlFlowGraph>
  ) {}

  /**
   * Run definite assignment analysis on entire program
   *
   * Analyzes each function's CFG to detect uninitialized variable uses.
   * Sets metadata on variable declarations and identifier nodes.
   *
   * @param ast - Program AST
   */
  public analyze(ast: Program): void {
    // Build function parameter map
    const functionInfo = this.buildFunctionParameterMap(ast);

    // Analyze each function's CFG
    for (const [functionName, cfg] of this.cfgs) {
      const info = functionInfo.get(functionName);
      if (info) {
        // Find the function's body scope by looking at the function node's child scopes
        const funcNode = info.node;
        const funcSymbol = this.symbolTable.lookup(functionName);

        if (funcSymbol && funcSymbol.scope) {
          // The function is declared in module scope
          // Find the child scope that corresponds to this function's body
          const functionBodyScope = funcSymbol.scope.children.find(
            scope => scope.node === funcNode
          );

          if (functionBodyScope) {
            this.symbolTable.enterScope(functionBodyScope);
            this.analyzeCFG(cfg, info.params);
            this.symbolTable.exitScope();
          }
        }
      }
    }

    // Walk AST to find all variable declarations and set metadata
    const walker = new DefiniteAssignmentWalker(this.alwaysInitialized);
    walker.walk(ast);
  }

  /**
   * Build map of function names to their parameter names and nodes
   *
   * Skips stub functions (functions without bodies) as they have no CFG to analyze.
   *
   * @param ast - Program AST
   * @returns Map of function name to {params, node}
   */
  protected buildFunctionParameterMap(ast: Program): Map<string, { params: string[]; node: any }> {
    const map = new Map<string, { params: string[]; node: any }>();

    for (const decl of ast.getDeclarations()) {
      if (isFunctionDecl(decl)) {

        // Skip stub functions - they have no body and no CFG to analyze
        if (!decl.getBody()) {
          continue;
        }

        const funcName = decl.getName();
        const parameters = decl.getParameters();

        // Extract parameter names - parameters may be objects with 'name' property or have getName() method
        const params = parameters.map((p: any) => {
          if (typeof p === 'string') {
            return p;
          } else if (p && typeof p.getName === 'function') {
            return p.getName();
          } else if (p && p.name) {
            return p.name;
          } else {
            // Fallback - should not happen but prevents crashes
            return 'unknown';
          }
        });

        map.set(funcName, { params, node: decl });
      }
    }

    return map;
  }

  /**
   * Analyze a single function's CFG
   *
   * Performs forward dataflow analysis to compute definitely assigned
   * sets at each CFG node.
   *
   * **Algorithm:**
   * 1. Run worklist algorithm to compute assignment sets for all nodes
   * 2. After convergence, check each node for uninitialized uses
   *
   * This two-phase approach ensures we check nodes with complete information
   * after the dataflow analysis has converged.
   *
   * @param cfg - Control flow graph to analyze
   * @param parameters - Function parameter names (always initialized)
   */
  protected analyzeCFG(cfg: ControlFlowGraph, parameters: string[] = []): void {
    // Collect module-level variables with initializers
    // These are always initialized before any function runs
    const moduleInitialized = this.getModuleLevelInitializedVariables();

    // Combine parameters with module-level initialized variables
    const initiallyAssigned = [...parameters, ...moduleInitialized];

    // Phase 1: Compute assignment sets using worklist algorithm
    const assignmentSets = this.computeAssignmentSets(cfg, initiallyAssigned);

    // Phase 2: Check for uninitialized uses with complete assignment information
    this.checkUninitializedUses(cfg, assignmentSets);

    // Phase 3: Mark variables that are always initialized
    this.markAlwaysInitialized(cfg, assignmentSets);
  }

  /**
   * Get module-level variables that have initializers
   *
   * These variables are initialized before any function runs,
   * so they should be considered definitely assigned at function entry.
   *
   * @returns Array of variable names that are initialized at module level
   */
  protected getModuleLevelInitializedVariables(): string[] {
    const initialized: string[] = [];
    const rootScope = this.symbolTable.getRootScope();

    // Check all symbols in root (module) scope
    for (const symbol of rootScope.symbols.values()) {
      if (symbol.kind === SymbolKind.Variable) {
        // Check if the variable has an initializer
        // We need to find the VariableDecl node associated with this symbol
        if (symbol.declaration && isVariableDecl(symbol.declaration)) {
          const varDecl = symbol.declaration as VariableDecl;
          if (varDecl.getInitializer()) {
            initialized.push(symbol.name);
          }
        }
      }
    }

    return initialized;
  }

  /**
   * Compute assignment sets for all nodes in the CFG
   *
   * Uses worklist algorithm to compute the definitely assigned set
   * at each program point. This runs to fixed point before any error checking.
   *
   * @param cfg - Control flow graph
   * @param parameters - Function parameter names (always initialized)
   * @returns Map of node ID to assignment set
   */
  protected computeAssignmentSets(
    cfg: ControlFlowGraph,
    parameters: string[] = []
  ): Map<string, AssignmentSet> {
    // Initialize: parameters are assigned at entry
    const initialSet = new Set<string>(parameters);
    const assignmentSets = new Map<string, AssignmentSet>();
    assignmentSets.set(cfg.entry.id, initialSet);

    // Worklist algorithm for dataflow analysis
    const worklist: CFGNode[] = [cfg.entry];
    const inWorklist = new Set<string>([cfg.entry.id]);

    while (worklist.length > 0) {
      const node = worklist.shift()!;
      inWorklist.delete(node.id);

      // Get current assignment set (before this node)
      const currentSet = assignmentSets.get(node.id) || new Set();

      // Compute new assignment set (after this node)
      const newSet = this.computeAssignmentSet(node, currentSet);

      // Propagate to successors
      for (const successor of node.successors) {
        const successorSet = assignmentSets.get(successor.id);

        if (!successorSet) {
          // First time visiting successor
          assignmentSets.set(successor.id, new Set(newSet));
          if (!inWorklist.has(successor.id)) {
            worklist.push(successor);
            inWorklist.add(successor.id);
          }
        } else {
          // Merge with existing set (intersection for branches)
          const mergedSet = this.mergeAssignmentSets(successorSet, newSet, successor);

          // If set changed, reprocess successors
          if (!this.setsEqual(successorSet, mergedSet)) {
            assignmentSets.set(successor.id, mergedSet);
            if (!inWorklist.has(successor.id)) {
              worklist.push(successor);
              inWorklist.add(successor.id);
            }
          }
        }
      }
    }

    return assignmentSets;
  }

  /**
   * Check all nodes for uninitialized uses
   *
   * After dataflow analysis has converged, check each node's statement
   * for uses of variables that haven't been definitely assigned.
   *
   * @param cfg - Control flow graph
   * @param assignmentSets - Computed assignment sets for each node
   */
  protected checkUninitializedUses(
    cfg: ControlFlowGraph,
    assignmentSets: Map<string, AssignmentSet>
  ): void {
    // Visit each node in the CFG
    for (const node of cfg.getNodes()) {
      // Get the assignment set at entry to this node
      const assignedVars = assignmentSets.get(node.id) || new Set();

      // Check the statement for uninitialized uses
      if (node.statement) {
        this.checkStatement(node.statement, assignedVars);
      }
    }
  }

  /**
   * Compute assignment set after executing a CFG node
   *
   * Adds any variables that are assigned in this node's statement.
   * Handles nested assignment expressions (e.g., y = (x = 10)).
   *
   * @param node - CFG node
   * @param inputSet - Assignment set before the node
   * @returns Assignment set after the node
   */
  protected computeAssignmentSet(node: CFGNode, inputSet: AssignmentSet): AssignmentSet {
    const outputSet = new Set(inputSet);

    if (!node.statement) {
      return outputSet;
    }

    // Check for variable assignments
    const statement = node.statement;

    // Variable declaration with initializer
    if (isVariableDecl(statement)) {
      const varDecl = statement as VariableDecl;
      if (varDecl.getInitializer()) {
        const symbol = this.symbolTable.lookup(varDecl.getName());
        if (symbol && symbol.kind === SymbolKind.Variable) {
          outputSet.add(symbol.name);
        }

        // Also check for nested assignments in the initializer
        // e.g., let z: byte = (x = 10);
        this.collectAssignments(varDecl.getInitializer()!, outputSet);
      }
    }

    // Assignment expression (including nested assignments)
    if (isExpressionStatement(statement)) {
      const exprStmt = statement as any;
      const expr = exprStmt.getExpression();

      // Collect ALL assignments in the expression tree (handles nested assignments)
      this.collectAssignments(expr, outputSet);
    }

    return outputSet;
  }

  /**
   * Collect all assignment expressions in an expression tree
   *
   * Recursively walks the expression to find ALL assignment expressions,
   * including nested ones like y = (x = 10).
   *
   * @param expr - Expression to search
   * @param outputSet - Set to add assigned variable names to
   */
  protected collectAssignments(expr: Expression, outputSet: AssignmentSet): void {
    if (isAssignmentExpression(expr)) {
      const assignExpr = expr as any;
      const target = assignExpr.getTarget();

      // Add the target variable to the assignment set
      if (isIdentifierExpression(target)) {
        const idExpr = target as IdentifierExpression;
        const symbol = this.symbolTable.lookup(idExpr.getName());
        if (symbol && symbol.kind === SymbolKind.Variable) {
          outputSet.add(symbol.name);
        }
      }

      // Recursively check the value for nested assignments
      // e.g., y = (x = 10) has an assignment to x inside the value
      const value = assignExpr.getValue();
      if (value) {
        this.collectAssignments(value, outputSet);
      }
    } else {
      // For non-assignment expressions, check if they have sub-expressions
      // This handles cases like: let z = x + (y = 10);
      const walker = new AssignmentCollector(this.symbolTable, outputSet);
      walker.walk(expr);
    }
  }

  /**
   * Merge assignment sets at control flow merge points
   *
   * For merge nodes (where multiple paths converge), we use INTERSECTION:
   * A variable is definitely assigned only if it's assigned on ALL incoming paths.
   *
   * This is called during dataflow analysis when we visit a successor node
   * that already has an assignment set (meaning we've seen it before from
   * another predecessor).
   *
   * @param existingSet - Existing assignment set at merge point
   * @param newSet - New assignment set from incoming edge
   * @param node - The merge node (unused but kept for potential future use)
   * @returns Merged assignment set
   */
  protected mergeAssignmentSets(
    existingSet: AssignmentSet,
    newSet: AssignmentSet,
    _node: CFGNode
  ): AssignmentSet {
    // At merge points, use intersection (must be assigned on ALL paths)
    // A variable is only definitely assigned if it's in BOTH sets
    const intersection = new Set<string>();
    for (const varName of existingSet) {
      if (newSet.has(varName)) {
        intersection.add(varName);
      }
    }

    return intersection;
  }

  /**
   * Check if two assignment sets are equal
   *
   * @param set1 - First set
   * @param set2 - Second set
   * @returns True if sets contain same elements
   */
  protected setsEqual(set1: AssignmentSet, set2: AssignmentSet): boolean {
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
   * Check a statement for uninitialized variable uses
   *
   * Walks the statement looking for identifier references.
   * Reports errors for variables used before initialization.
   *
   * **Important:** Must check BEFORE computing assignment (uses read before write)
   *
   * **Special Cases:**
   * - Variable declarations: Only check initializer (not the variable name itself)
   * - Assignments: Only check the value/right side (not the target/left side)
   * - Control flow statements (if/while/for): Only check condition, NOT body
   *   (bodies are represented as separate CFG nodes)
   *
   * @param statement - Statement to check
   * @param assignedVars - Variables definitely assigned at this point
   */
  protected checkStatement(statement: Statement, assignedVars: AssignmentSet): void {
    // For variable declarations, only check the initializer
    if (isVariableDecl(statement)) {
      const varDecl = statement as VariableDecl;
      const initializer = varDecl.getInitializer();
      if (initializer) {
        const checker = new UninitializedUseChecker(
          this.symbolTable,
          assignedVars,
          this.diagnostics
        );
        checker.walk(initializer);
      }
      return;
    }

    // For assignment expressions, only check the right-hand side
    if (isExpressionStatement(statement)) {
      const exprStmt = statement as any;
      const expr = exprStmt.getExpression();
      if (isAssignmentExpression(expr)) {
        const assignExpr = expr as any;
        const value = assignExpr.getValue();

        const checker = new UninitializedUseChecker(
          this.symbolTable,
          assignedVars,
          this.diagnostics
        );
        checker.walk(value);
        return;
      }
    }

    // For control flow statements, only check the condition, NOT the body
    // The body statements are represented as separate nodes in the CFG
    if (isIfStatement(statement)) {
      const condition = statement.getCondition();
      if (condition) {
        const checker = new UninitializedUseChecker(
          this.symbolTable,
          assignedVars,
          this.diagnostics
        );
        checker.walk(condition);
      }
      return;
    }

    if (isWhileStatement(statement)) {
      const condition = statement.getCondition();
      if (condition) {
        const checker = new UninitializedUseChecker(
          this.symbolTable,
          assignedVars,
          this.diagnostics
        );
        checker.walk(condition);
      }
      return;
    }

    if (isForStatement(statement)) {
      // For loops have a variable, start, and end expression
      // Check start and end, but not the body
      const start = statement.getStart();
      const end = statement.getEnd();
      const checker = new UninitializedUseChecker(this.symbolTable, assignedVars, this.diagnostics);
      if (start) checker.walk(start);
      if (end) checker.walk(end);
      return;
    }

    // For return statements, check the return value
    if (isReturnStatement(statement)) {
      const value = statement.getValue();
      if (value) {
        const checker = new UninitializedUseChecker(
          this.symbolTable,
          assignedVars,
          this.diagnostics
        );
        checker.walk(value);
      }
      return;
    }

    // For other statements (break, continue, etc.), walk the entire statement
    const checker = new UninitializedUseChecker(this.symbolTable, assignedVars, this.diagnostics);
    checker.walk(statement);
  }

  /**
   * Mark variables that are always initialized before use
   *
   * After dataflow analysis, determine which variables are always
   * initialized on all execution paths.
   *
   * @param cfg - Control flow graph
   * @param assignmentSets - Assignment sets computed for each node
   */
  protected markAlwaysInitialized(
    cfg: ControlFlowGraph,
    assignmentSets: Map<string, AssignmentSet>
  ): void {
    // A variable is always initialized if it's in the assignment set
    // at the exit node (meaning it was initialized on all paths to exit)
    const exitSet = assignmentSets.get(cfg.exit.id);
    if (exitSet) {
      for (const varName of exitSet) {
        this.alwaysInitialized.add(varName);
      }
    }
  }

  /**
   * Get all diagnostics from analysis
   *
   * @returns Array of diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }
}

/**
 * Walker to check for uninitialized variable uses
 *
 * Walks expressions looking for identifier references to variables
 * that haven't been definitely assigned yet.
 *
 * Skips checking assignment targets (left-hand side of assignments).
 */
class UninitializedUseChecker extends ASTWalker {
  /**
   * Create uninitialized use checker
   *
   * @param symbolTable - Symbol table
   * @param assignedVars - Variables definitely assigned at this point
   * @param diagnostics - Diagnostics array to append to
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly assignedVars: AssignmentSet,
    protected readonly diagnostics: Diagnostic[]
  ) {
    super();
  }

  /**
   * Visit assignment expression
   *
   * For assignment expressions, we need to check the value (right side)
   * but NOT the target (left side), since the target is being assigned to.
   */
  public visitAssignmentExpression(node: any): void {
    // Don't use default behavior - we need custom traversal
    // to skip the target

    // Only check the value (right side)
    const value = node.getValue();
    if (value) {
      this.walk(value);
    }

    // Do NOT check the target - it's being assigned to, not read
  }

  /**
   * Visit identifier expression
   *
   * Check if this identifier is a variable reference and if it's been initialized.
   * This is called automatically by the walker when traversing the AST.
   */
  public visitIdentifierExpression(node: IdentifierExpression): void {
    // First do the default behavior (enter/exit node)
    super.visitIdentifierExpression(node);

    // Then check for uninitialized use
    const symbol = this.symbolTable.lookup(node.getName());

    // Only check variable references (not function calls, etc.)
    if (symbol && symbol.kind === SymbolKind.Variable) {
      // Check if definitely assigned
      if (!this.assignedVars.has(symbol.name)) {
        // Variable used before initialization
        this.diagnostics.push({
          code: DiagnosticCode.TYPE_MISMATCH, // Generic semantic error
          severity: DiagnosticSeverity.ERROR,
          message: `Variable '${symbol.name}' is used before being initialized`,
          location: node.getLocation(),
        });

        // Mark metadata on node
        if (!node.metadata) {
          node.metadata = new Map();
        }
        node.metadata.set(OptimizationMetadataKey.DefiniteAssignmentUninitializedUse, true);
      }
    }
  }
}

/**
 * Walker to set metadata on variable declarations
 *
 * After analysis, walks AST to set metadata on variable declarations
 * indicating which variables are always initialized.
 */
class DefiniteAssignmentWalker extends ASTWalker {
  /**
   * Create metadata setter walker
   *
   * @param alwaysInitialized - Set of variables always initialized
   */
  constructor(protected readonly alwaysInitialized: Set<string>) {
    super();
  }

  /**
   * Visit variable declaration
   *
   * Set metadata indicating if this variable is always initialized.
   * This is called automatically by the walker when traversing the AST.
   */
  public visitVariableDecl(node: VariableDecl): void {
    // First do the default behavior (enter node, visit children, exit node)
    super.visitVariableDecl(node);

    // Then set metadata
    if (this.alwaysInitialized.has(node.getName())) {
      // Mark as always initialized
      if (!node.metadata) {
        node.metadata = new Map();
      }
      node.metadata.set(OptimizationMetadataKey.DefiniteAssignmentAlwaysInitialized, true);

      // If has constant initializer, store the value
      const initializer = node.getInitializer();
      if (initializer && this.isConstantExpression(initializer)) {
        const value = this.evaluateConstant(initializer);
        if (value !== undefined) {
          node.metadata.set(OptimizationMetadataKey.DefiniteAssignmentInitValue, value);
        }
      }
    }
  }

  /**
   * Check if expression is a compile-time constant
   *
   * @param node - Expression to check
   * @returns True if constant
   */
  protected isConstantExpression(node: Expression): boolean {
    // Simple constant detection (literals only for now)
    return isLiteralExpression(node);
  }

  /**
   * Evaluate constant expression value
   *
   * @param node - Constant expression
   * @returns Evaluated value
   */
  protected evaluateConstant(node: Expression): number | string | boolean | undefined {
    if (isLiteralExpression(node)) {
      return node.getValue();
    }

    return undefined;
  }
}

/**
 * Walker to collect all assignments in an expression tree
 *
 * Used to find nested assignment expressions anywhere in the expression tree.
 * For example, in "x + (y = 10)", this finds the assignment to y.
 */
class AssignmentCollector extends ASTWalker {
  /**
   * Create assignment collector
   *
   * @param symbolTable - Symbol table
   * @param outputSet - Set to add assigned variable names to
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly outputSet: AssignmentSet
  ) {
    super();
  }

  /**
   * Visit assignment expression
   *
   * Extract the target variable and add it to the output set.
   */
  public visitAssignmentExpression(node: any): void {
    // First do the default behavior (traverse children)
    super.visitAssignmentExpression(node);

    // Then collect this assignment
    const target = node.getTarget();
    if (isIdentifierExpression(target)) {
      const idExpr = target as IdentifierExpression;
      const symbol = this.symbolTable.lookup(idExpr.getName());
      if (symbol && symbol.kind === SymbolKind.Variable) {
        this.outputSet.add(symbol.name);
      }
    }
  }
}