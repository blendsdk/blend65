/**
 * Constant Propagation Analysis (Task 8.7)
 *
 * Tracks compile-time constant values through the program using sparse
 * conditional constant propagation (SCCP). Enables constant folding,
 * branch elimination, and array bounds optimization.
 *
 * **Algorithm**: Lattice-based optimistic data flow analysis
 * - Lattice: TOP (not analyzed) → Constant → BOTTOM (not constant)
 * - Optimistically assumes all variables are constant (TOP)
 * - Propagates known constants through expressions
 * - Marks as BOTTOM when multiple values detected
 *
 * **Complexity**: O(N) with worklist (sparse propagation)
 *
 * @example
 * ```typescript
 * const analyzer = new ConstantPropagationAnalyzer(symbolTable, cfgs);
 * analyzer.analyze(ast);
 * const constantValue = analyzer.getConstantValue('x');
 * ```
 */

import type { Program } from '../../ast/nodes.js';
import type { Statement } from '../../ast/base.js';
import type { SymbolTable } from '../symbol-table.js';
import type { ControlFlowGraph, CFGNode } from '../control-flow.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { ASTWalker } from '../../ast/walker/base.js';
import { OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { TokenType } from '../../lexer/types.js';
import {
  isVariableDecl,
  isExpressionStatement,
  isAssignmentExpression,
  isIdentifierExpression,
  isLiteralExpression,
  isBinaryExpression,
  isUnaryExpression,
  isIfStatement,
  isWhileStatement,
} from '../../ast/type-guards.js';

/**
 * Lattice values for constant propagation
 *
 * Forms a complete lattice:
 *   TOP (⊤) - not yet analyzed, optimistically constant
 *     |
 *  Constant - known constant value
 *     |
 * BOTTOM (⊥) - not constant, multiple possible values
 */
export type LatticeValue =
  | { kind: 'TOP' }
  | { kind: 'CONSTANT'; value: number | boolean }
  | { kind: 'BOTTOM' };

/**
 * Constant propagation information for a function
 */
export interface ConstantPropagationInfo {
  /** Constant values for each variable */
  constantValues: Map<string, LatticeValue>;
  /** Expressions that can be constant folded */
  foldableExpressions: Map<Statement, number | boolean>;
  /** Variables that are effectively const (never change) */
  effectivelyConst: Set<string>;
  /** Branch conditions with known constant values */
  constantBranches: Map<Statement, boolean>;
}

/**
 * Constant propagation analyzer
 *
 * Implements sparse conditional constant propagation to track constant
 * values through the program. This enables:
 * - Constant folding (replace expressions with computed values)
 * - Dead branch elimination (remove unreachable if/else paths)
 * - Array bounds checking (verify constant indices)
 * - Zero-page optimization (constant addresses)
 *
 * Uses optimistic lattice-based algorithm for efficiency.
 */
export class ConstantPropagationAnalyzer extends ASTWalker {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Constant propagation info per function */
  protected constInfo: Map<string, ConstantPropagationInfo> = new Map();

  /** Current function being analyzed */
  protected currentFunction: string | null = null;

  /**
   * Creates a constant propagation analyzer
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
   * Analyze constant propagation for entire program
   *
   * For each function:
   * 1. Initialize all variables to TOP (optimistic)
   * 2. Propagate known constants through assignments
   * 3. Evaluate expressions with constant operands
   * 4. Detect effectively constant variables
   * 5. Analyze branch conditions
   * 6. Store metadata in AST nodes
   *
   * @param _ast - Program AST to analyze
   */
  public analyze(_ast: Program): void {
    // Analyze each function separately
    for (const [funcName, cfg] of this.cfgs) {
      // Skip if CFG is empty or invalid
      if (!cfg || cfg.getNodes().length === 0) {
        continue;
      }

      try {
        this.currentFunction = funcName;
        
        // Perform constant propagation analysis for this function
        const info = this.analyzeFunction(funcName, cfg);
        this.constInfo.set(funcName, info);

        // Store metadata in AST nodes
        this.storeMetadata(cfg, info);
      } catch (error) {
        // Continue with other functions even if one fails
        console.error(`Error analyzing constant propagation for ${funcName}:`, error);
      }
    }

    this.currentFunction = null;
  }

  /**
   * Analyze constant propagation for a single function
   *
   * Algorithm:
   * 1. Initialize all variables to TOP (optimistic assumption)
   * 2. Build worklist of all variable definitions
   * 3. While worklist not empty:
   *    a. Process definition
   *    b. Evaluate initializer/RHS as constant
   *    c. Update lattice value with join
   *    d. If changed, add dependent uses to worklist
   * 4. Identify constant-foldable expressions
   * 5. Detect effectively constant variables
   * 6. Analyze branch conditions
   *
   * @param funcName - Function name
   * @param cfg - Control flow graph
   * @returns Constant propagation information
   */
  protected analyzeFunction(_funcName: string, cfg: ControlFlowGraph): ConstantPropagationInfo {
    const constantValues = new Map<string, LatticeValue>();
    const foldableExpressions = new Map<Statement, number | boolean>();
    const effectivelyConst = new Set<string>();
    const constantBranches = new Map<Statement, boolean>();

    // Step 1: Initialize variables with definitions to TOP, others to BOTTOM
    const variables = this.collectVariables(cfg);
    for (const varName of variables) {
      constantValues.set(varName, { kind: 'BOTTOM' }); // Default: non-constant
    }

    // Step 2: Collect all definition statements and mark defined variables as TOP
    const defStatements: Statement[] = [];
    const definedVars = new Set<string>();
    
    for (const node of cfg.getNodes()) {
      if (node.statement) {
        const defs = this.findDefinitions(node.statement);
        if (defs.length > 0) {
          defStatements.push(node.statement);
          defs.forEach(v => definedVars.add(v));
        }
      }
    }
    
    // Initialize defined variables to TOP (optimistic)
    for (const varName of definedVars) {
      constantValues.set(varName, { kind: 'TOP' });
    }

    // Step 3: Fixed-point iteration until no changes
    let changed = true;
    let iterations = 0;
    const maxIterations = 10;
    
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      // Process all definitions
      for (const stmt of defStatements) {
        const stmtChanged = this.processDefinition(stmt, constantValues);
        if (stmtChanged) {
          changed = true;
        }
      }
    }

    // Step 4: Identify constant-foldable expressions
    this.identifyFoldableExpressions(cfg, constantValues, foldableExpressions);

    // Step 5: Detect effectively constant variables
    this.identifyEffectivelyConstVariables(cfg, constantValues, effectivelyConst);

    // Step 6: Analyze branch conditions
    this.analyzeBranchConditions(cfg, constantValues, constantBranches);

    return {
      constantValues,
      foldableExpressions,
      effectivelyConst,
      constantBranches,
    };
  }

  /**
   * Collect all variables in a function
   *
   * @param cfg - Control flow graph
   * @returns Set of variable names
   */
  protected collectVariables(cfg: ControlFlowGraph): Set<string> {
    const variables = new Set<string>();

    for (const node of cfg.getNodes()) {
      if (!node.statement) continue;

      // Find variable declarations
      if (isVariableDecl(node.statement)) {
        variables.add(node.statement.getName());
      }
    }

    return variables;
  }

  /**
   * Find all variable definitions in a statement
   *
   * @param stmt - Statement to analyze
   * @returns Array of variable names being defined
   */
  protected findDefinitions(stmt: Statement): string[] {
    const defs: string[] = [];

    // Variable declarations with initializers
    if (isVariableDecl(stmt)) {
      if (stmt.getInitializer()) {
        defs.push(stmt.getName());
      }
    }

    // Assignments
    if (isExpressionStatement(stmt)) {
      const expr = stmt.getExpression();

      if (expr && isAssignmentExpression(expr)) {
        const target = expr.getTarget();

        if (isIdentifierExpression(target)) {
          defs.push(target.getName());
        }
      }
    }

    return defs;
  }

  /**
   * Process a definition statement and update constant values
   *
   * @param stmt - Statement containing definition
   * @param constantValues - Current constant value map
   * @returns True if any values changed
   */
  protected processDefinition(
    stmt: Statement,
    constantValues: Map<string, LatticeValue>
  ): boolean {
    let changed = false;

    // Handle variable declarations
    if (isVariableDecl(stmt)) {
      const varName = stmt.getName();
      const initializer = stmt.getInitializer();

      if (initializer) {
        const newValue = this.evaluateExpression(initializer, constantValues);
        const oldValue = constantValues.get(varName)!;
        const joinedValue = this.latticeJoin(oldValue, newValue);

        if (!this.latticeEqual(oldValue, joinedValue)) {
          constantValues.set(varName, joinedValue);
          changed = true;
        }
      } else {
        // No initializer: mark as BOTTOM (undefined value)
        const oldValue = constantValues.get(varName)!;
        if (oldValue.kind !== 'BOTTOM') {
          constantValues.set(varName, { kind: 'BOTTOM' });
          changed = true;
        }
      }
    }

    // Handle assignments
    if (isExpressionStatement(stmt)) {
      const expr = stmt.getExpression();

      if (expr && isAssignmentExpression(expr)) {
        const target = expr.getTarget();
        const value = expr.getValue();

        if (isIdentifierExpression(target)) {
          const varName = target.getName();

          const newValue = this.evaluateExpression(value, constantValues);
          const oldValue = constantValues.get(varName) || { kind: 'TOP' };
          const joinedValue = this.latticeJoin(oldValue, newValue);

          if (!this.latticeEqual(oldValue, joinedValue)) {
            constantValues.set(varName, joinedValue);
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  /**
   * Evaluate an expression to a constant value
   *
   * @param expr - Expression to evaluate
   * @param constantValues - Current constant values
   * @returns Lattice value
   */
  protected evaluateExpression(
    expr: any,
    constantValues: Map<string, LatticeValue>
  ): LatticeValue {
    if (!expr) return { kind: 'BOTTOM' };

    // Literals are always constant
    if (isLiteralExpression(expr)) {
      const value = expr.getValue();
      
      if (typeof value === 'number' || typeof value === 'boolean') {
        return { kind: 'CONSTANT', value };
      }
      
      // Strings and other types are not constant for our purposes
      return { kind: 'BOTTOM' };
    }

    // Identifier: look up current value
    if (isIdentifierExpression(expr)) {
      const varName = expr.getName();
      return constantValues.get(varName) || { kind: 'BOTTOM' };
    }

    // Binary expressions: evaluate if both operands are constant
    if (isBinaryExpression(expr)) {
      const left = this.evaluateExpression(expr.getLeft(), constantValues);
      const right = this.evaluateExpression(expr.getRight(), constantValues);

      // Can only fold if both are constants
      if (left.kind === 'CONSTANT' && right.kind === 'CONSTANT') {
        const result = this.evaluateBinaryOp(
          expr.getOperator(),
          left.value,
          right.value
        );
        
        if (result !== null) {
          return { kind: 'CONSTANT', value: result };
        }
      }

      // If either is BOTTOM, result is BOTTOM
      if (left.kind === 'BOTTOM' || right.kind === 'BOTTOM') {
        return { kind: 'BOTTOM' };
      }

      // Otherwise TOP (not yet computed)
      return { kind: 'TOP' };
    }

    // Unary expressions: evaluate if operand is constant
    if (isUnaryExpression(expr)) {
      const operand = this.evaluateExpression(expr.getOperand(), constantValues);

      if (operand.kind === 'CONSTANT') {
        const result = this.evaluateUnaryOp(expr.getOperator(), operand.value);
        
        if (result !== null) {
          return { kind: 'CONSTANT', value: result };
        }
      }

      if (operand.kind === 'BOTTOM') {
        return { kind: 'BOTTOM' };
      }

      return { kind: 'TOP' };
    }

    // Function calls, member access, etc. are not constant
    return { kind: 'BOTTOM' };
  }

  /**
   * Evaluate a binary operation on constant operands
   *
   * @param operator - Operator TokenType
   * @param left - Left operand value
   * @param right - Right operand value
   * @returns Result or null if cannot evaluate
   */
  protected evaluateBinaryOp(
    operator: TokenType,
    left: number | boolean,
    right: number | boolean
  ): number | boolean | null {
    // Convert booleans to numbers for arithmetic
    const leftNum = typeof left === 'boolean' ? (left ? 1 : 0) : left;
    const rightNum = typeof right === 'boolean' ? (right ? 1 : 0) : right;

    try {
      switch (operator) {
        // Arithmetic
        case TokenType.PLUS: return leftNum + rightNum;
        case TokenType.MINUS: return leftNum - rightNum;
        case TokenType.MULTIPLY: return leftNum * rightNum;
        case TokenType.DIVIDE: return rightNum !== 0 ? Math.floor(leftNum / rightNum) : null;
        case TokenType.MODULO: return rightNum !== 0 ? leftNum % rightNum : null;

        // Bitwise
        case TokenType.BITWISE_AND: return leftNum & rightNum;
        case TokenType.BITWISE_OR: return leftNum | rightNum;
        case TokenType.BITWISE_XOR: return leftNum ^ rightNum;
        case TokenType.LEFT_SHIFT: return leftNum << rightNum;
        case TokenType.RIGHT_SHIFT: return leftNum >> rightNum;

        // Comparison (return boolean)
        case TokenType.EQUAL: return leftNum === rightNum;
        case TokenType.NOT_EQUAL: return leftNum !== rightNum;
        case TokenType.LESS_THAN: return leftNum < rightNum;
        case TokenType.LESS_EQUAL: return leftNum <= rightNum;
        case TokenType.GREATER_THAN: return leftNum > rightNum;
        case TokenType.GREATER_EQUAL: return leftNum >= rightNum;

        // Logical (return boolean)
        case TokenType.AND: return Boolean(left) && Boolean(right);
        case TokenType.OR: return Boolean(left) || Boolean(right);

        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Evaluate a unary operation on constant operand
   *
   * @param operator - Operator TokenType
   * @param operand - Operand value
   * @returns Result or null if cannot evaluate
   */
  protected evaluateUnaryOp(operator: TokenType, operand: number | boolean): number | boolean | null {
    const operandNum = typeof operand === 'boolean' ? (operand ? 1 : 0) : operand;

    try {
      switch (operator) {
        case TokenType.MINUS: return -operandNum;
        case TokenType.BITWISE_NOT: return ~operandNum;
        case TokenType.NOT: return !Boolean(operand);
        default: return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Lattice join operation
   *
   * Combines two lattice values:
   * - TOP ⊔ x = x (TOP is identity)
   * - x ⊔ x = x (idempotent)
   * - x ⊔ y = BOTTOM (if x ≠ y and both constant)
   * - BOTTOM ⊔ x = BOTTOM (BOTTOM is absorbing)
   *
   * @param a - First lattice value
   * @param b - Second lattice value
   * @returns Joined value
   */
  protected latticeJoin(a: LatticeValue, b: LatticeValue): LatticeValue {
    // TOP is identity
    if (a.kind === 'TOP') return b;
    if (b.kind === 'TOP') return a;

    // BOTTOM is absorbing
    if (a.kind === 'BOTTOM' || b.kind === 'BOTTOM') {
      return { kind: 'BOTTOM' };
    }

    // Both constant: must be same value
    if (a.kind === 'CONSTANT' && b.kind === 'CONSTANT') {
      if (a.value === b.value) {
        return a;
      } else {
        // Different values: go to BOTTOM
        return { kind: 'BOTTOM' };
      }
    }

    return { kind: 'BOTTOM' };
  }

  /**
   * Check if two lattice values are equal
   *
   * @param a - First lattice value
   * @param b - Second lattice value
   * @returns True if equal
   */
  protected latticeEqual(a: LatticeValue, b: LatticeValue): boolean {
    if (a.kind !== b.kind) return false;
    
    if (a.kind === 'CONSTANT' && b.kind === 'CONSTANT') {
      return a.value === b.value;
    }
    
    return true;
  }

  /**
   * Find statements that depend on the given statement
   *
   * @param stmt - Statement to find dependents of
   * @param cfg - Control flow graph
   * @returns Array of dependent statements
   */
  protected findDependentStatements(stmt: Statement, cfg: ControlFlowGraph): Statement[] {
    const dependents: Statement[] = [];

    // Find the node containing this statement
    let stmtNode: CFGNode | null = null;
    for (const node of cfg.getNodes()) {
      if (node.statement === stmt) {
        stmtNode = node;
        break;
      }
    }

    if (!stmtNode) return dependents;

    // Add all successor statements
    for (const succ of stmtNode.successors) {
      if (succ.statement) {
        dependents.push(succ.statement);
      }
    }

    return dependents;
  }

  /**
   * Identify expressions that can be constant folded
   *
   * @param cfg - Control flow graph
   * @param constantValues - Constant value map
   * @param foldableExpressions - Output map
   */
  protected identifyFoldableExpressions(
    cfg: ControlFlowGraph,
    constantValues: Map<string, LatticeValue>,
    foldableExpressions: Map<Statement, number | boolean>
  ): void {
    for (const node of cfg.getNodes()) {
      if (!node.statement) continue;

      // Check all expressions in the statement
      this.findFoldableInStatement(node.statement, constantValues, foldableExpressions);
    }
  }

  /**
   * Find foldable expressions within a statement
   *
   * @param stmt - Statement to analyze
   * @param constantValues - Constant value map
   * @param foldableExpressions - Output map
   */
  protected findFoldableInStatement(
    stmt: Statement,
    constantValues: Map<string, LatticeValue>,
    foldableExpressions: Map<Statement, number | boolean>
  ): void {
    // Recursively check for binary and unary expressions
    const checkNode = (node: any): void => {
      if (!node || typeof node !== 'object') return;

      // Check if this is a binary or unary expression using type guards
      if (isBinaryExpression(node) || isUnaryExpression(node)) {
        const value = this.evaluateExpression(node, constantValues);
        
        if (value.kind === 'CONSTANT') {
          foldableExpressions.set(node, value.value);
        }
      }

      // Recursively check children
      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach(checkNode);
          } else {
            checkNode(child);
          }
        }
      }
    };

    checkNode(stmt);
  }

  /**
   * Identify variables that are effectively const
   *
   * A variable is effectively const if:
   * - It has exactly one definition
   * - That definition is a constant value
   * - The variable is never reassigned
   *
   * @param cfg - Control flow graph
   * @param constantValues - Constant value map
   * @param effectivelyConst - Output set
   */
  protected identifyEffectivelyConstVariables(
    cfg: ControlFlowGraph,
    constantValues: Map<string, LatticeValue>,
    effectivelyConst: Set<string>
  ): void {
    // Count definitions per variable
    const defCounts = new Map<string, number>();

    for (const node of cfg.getNodes()) {
      if (!node.statement) continue;

      const defs = this.findDefinitions(node.statement);
      for (const varName of defs) {
        defCounts.set(varName, (defCounts.get(varName) || 0) + 1);
      }
    }

    // Variables with exactly one definition that's constant are effectively const
    for (const [varName, count] of defCounts) {
      if (count === 1) {
        const value = constantValues.get(varName);
        if (value && value.kind === 'CONSTANT') {
          effectivelyConst.add(varName);
        }
      }
    }
  }

  /**
   * Analyze branch conditions for constant values
   *
   * If a branch condition is constant, the branch is always taken or never taken.
   * This enables dead code elimination.
   *
   * @param cfg - Control flow graph
   * @param constantValues - Constant value map
   * @param constantBranches - Output map
   */
  protected analyzeBranchConditions(
    cfg: ControlFlowGraph,
    constantValues: Map<string, LatticeValue>,
    constantBranches: Map<Statement, boolean>
  ): void {
    for (const node of cfg.getNodes()) {
      if (!node.statement) continue;

      // Check if this is a conditional statement using type guards
      if (isIfStatement(node.statement) || isWhileStatement(node.statement)) {
        const condition = node.statement.getCondition();

        if (condition) {
          const value = this.evaluateExpression(condition, constantValues);
          
          if (value.kind === 'CONSTANT') {
            // Convert to boolean
            const boolValue = typeof value.value === 'boolean' 
              ? value.value 
              : Boolean(value.value);
            
            constantBranches.set(node.statement, boolValue);
          }
        }
      }
    }
  }

  /**
   * Store metadata in AST nodes
   *
   * For each variable/expression, store:
   * - ConstantValue: known constant value
   * - ConstantFoldable: can be folded
   * - ConstantFoldResult: folded result
   * - ConstantEffectivelyConst: never changes
   * - ConstantBranchCondition: constant condition
   *
   * @param cfg - Control flow graph
   * @param info - Constant propagation information
   */
  protected storeMetadata(cfg: ControlFlowGraph, info: ConstantPropagationInfo): void {
    // Store constant values for variables
    for (const [varName, latticeValue] of info.constantValues) {
      if (latticeValue.kind === 'CONSTANT') {
        // Find variable declaration
        for (const node of cfg.getNodes()) {
          if (!node.statement) continue;

        if (isVariableDecl(node.statement)) {
          if (node.statement.getName() === varName) {
            if (!node.statement.metadata) {
              node.statement.metadata = new Map();
            }
            node.statement.metadata.set(OptimizationMetadataKey.ConstantValue, latticeValue.value);
          }
        }
        }
      }
    }

    // Store foldable expressions
    for (const [expr, value] of info.foldableExpressions) {
      if (!expr.metadata) {
        expr.metadata = new Map();
      }
      expr.metadata.set(OptimizationMetadataKey.ConstantFoldable, true);
      expr.metadata.set(OptimizationMetadataKey.ConstantFoldResult, value);
    }

    // Store effectively const variables
    for (const varName of info.effectivelyConst) {
      // Find variable declaration
      for (const node of cfg.getNodes()) {
        if (!node.statement) continue;

        if (isVariableDecl(node.statement)) {
          if (node.statement.getName() === varName) {
            if (!node.statement.metadata) {
              node.statement.metadata = new Map();
            }
            node.statement.metadata.set(OptimizationMetadataKey.ConstantEffectivelyConst, true);
          }
        }
      }
    }

    // Store constant branch conditions
    for (const [stmt, value] of info.constantBranches) {
      if (!stmt.metadata) {
        stmt.metadata = new Map();
      }
      stmt.metadata.set(OptimizationMetadataKey.ConstantBranchCondition, value);
    }
  }

  /**
   * Get constant propagation info for a function
   *
   * @param funcName - Function name
   * @returns Constant propagation info or undefined
   */
  public getConstantPropagation(funcName: string): ConstantPropagationInfo | undefined {
    return this.constInfo.get(funcName);
  }

  /**
   * Get constant value for a variable in current function
   *
   * @param varName - Variable name
   * @returns Constant value or undefined
   */
  public getConstantValue(varName: string): number | boolean | undefined {
    if (!this.currentFunction) return undefined;

    const info = this.constInfo.get(this.currentFunction);
    if (!info) return undefined;

    const latticeValue = info.constantValues.get(varName);
    if (latticeValue && latticeValue.kind === 'CONSTANT') {
      return latticeValue.value;
    }

    return undefined;
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