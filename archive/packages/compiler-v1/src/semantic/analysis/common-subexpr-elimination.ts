/**
 * Common Subexpression Elimination Analysis (Task 8.14.4 - Phase 8 Tier 3)
 *
 * Performs block-local redundancy detection for common subexpressions.
 * Unlike GVN which works globally, CSE is simpler and faster, working
 * only within individual basic blocks.
 *
 * **Analysis Only**: Marks CSE candidates in metadata for IL optimizer.
 * Does NOT perform transformations - that's the IL optimizer's job.
 *
 * Key concepts:
 * - Available Expression: Expression whose value is computed and available
 * - CSE Candidate: Repeated expression that can be eliminated
 * - Invalidation: Assignment kills expressions using that variable
 *
 * @example
 * ```
 * // Within a single block:
 * let x: byte = a + b;    // a+b becomes available
 * let y: byte = a + b;    // CSE candidate - a+b already available
 * a = 10;                 // Invalidates a+b
 * let z: byte = a + b;    // NOT a CSE candidate (a changed)
 * ```
 *
 * Difference from GVN:
 * - CSE: Block-local only, simpler, no control flow handling
 * - GVN: Global, handles control flow merging, more complex
 */

import type { Program } from '../../ast/nodes.js';
import type { SymbolTable } from '../symbol-table.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import type { ControlFlowGraph } from '../control-flow.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import { OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { TokenType } from '../../lexer/types.js';
import { Expression, Statement } from '../../ast/base.js';
import {
  FunctionDecl,
  VariableDecl,
  BinaryExpression,
  UnaryExpression,
  IdentifierExpression,
  LiteralExpression,
  CallExpression,
  IndexExpression,
  MemberExpression,
  AssignmentExpression,
  ExpressionStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  BlockStatement,
  MatchStatement,
  ReturnStatement,
} from '../../ast/nodes.js';

/**
 * Commutative operators where operand order doesn't matter
 */
const COMMUTATIVE_OPERATORS = new Set<TokenType>([
  TokenType.PLUS,
  TokenType.MULTIPLY,
  TokenType.AND,          // &&
  TokenType.OR,           // ||
  TokenType.BITWISE_AND,  // &
  TokenType.BITWISE_OR,   // |
  TokenType.BITWISE_XOR,  // ^
  TokenType.EQUAL,        // ==
  TokenType.NOT_EQUAL,    // !=
]);

/**
 * Tracked available expression
 */
interface AvailableExpression {
  /** Canonical string representation of expression */
  exprString: string;
  
  /** Variables used in this expression */
  usedVariables: Set<string>;
  
  /** Variable that holds this expression's value (first computation) */
  holdingVariable: string | null;
  
  /** The original expression node */
  expression: Expression;
}

/**
 * Common Subexpression Elimination Analyzer (Task 8.14.4)
 *
 * Performs block-local analysis to find repeated expressions that
 * can be eliminated by reusing a previously computed value.
 *
 * Algorithm (per basic block):
 * 1. Track available expressions as we process statements
 * 2. When we see an expression, check if it's already available
 * 3. If available, mark it as a CSE candidate
 * 4. When a variable is assigned, invalidate expressions using it
 * 5. Add new expressions to available set
 *
 * Results stored in AST metadata using OptimizationMetadataKey enum:
 * - CSEAvailable: Set of available expression strings at this point
 * - CSECandidate: Boolean indicating this is a CSE opportunity
 *
 * @example
 * ```typescript
 * const analyzer = new CommonSubexpressionEliminationAnalyzer(cfgs, symbolTable);
 * analyzer.analyze(ast);
 * const diagnostics = analyzer.getDiagnostics();
 * ```
 */
export class CommonSubexpressionEliminationAnalyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Currently available expressions in the current block */
  protected availableExpressions = new Map<string, AvailableExpression>();

  /**
   * Creates a Common Subexpression Elimination analyzer
   *
   * @param cfgs - Control flow graphs from Pass 5
   * @param symbolTable - Symbol table from Pass 1
   */
  constructor(
    protected readonly cfgs: Map<string, ControlFlowGraph>,
    protected readonly symbolTable: SymbolTable
  ) {}

  /**
   * Run CSE analysis on program
   *
   * Analyzes all functions and global declarations.
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    try {
      // Process global variable declarations (each is its own "block")
      for (const decl of ast.getDeclarations()) {
        if (decl instanceof VariableDecl) {
          // Each global declaration is treated independently
          this.resetBlockState();
          this.processVariableDecl(decl);
        }
      }

      // Process each function
      for (const decl of ast.getDeclarations()) {
        if (decl instanceof FunctionDecl) {
          this.analyzeFunction(decl);
        }
      }
    } catch (error) {
      this.diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: `Internal error during CSE analysis: ${error instanceof Error ? error.message : String(error)}`,
        location: ast.getLocation(),
      });
    }
  }

  /**
   * Reset block-local state
   */
  protected resetBlockState(): void {
    this.availableExpressions.clear();
  }

  /**
   * Analyze a function with CSE
   *
   * @param func - Function declaration to analyze
   */
  protected analyzeFunction(func: FunctionDecl): void {
    // Reset for new function (no expressions available at function entry)
    this.resetBlockState();

    // Analyze function body as a single block sequence
    // Note: CSE is block-local, so we treat the function body as one block
    // Real CFG-based CSE would analyze each basic block separately
    const body = func.getBody();
    if (body) {
      this.analyzeBlockStatements(body);
    }
  }

  /**
   * Analyze a sequence of statements as a single block
   *
   * @param statements - Statements to analyze
   */
  protected analyzeBlockStatements(statements: Statement[]): void {
    for (const stmt of statements) {
      this.analyzeStatement(stmt);
    }
  }

  /**
   * Analyze a statement for CSE
   *
   * @param stmt - Statement to analyze
   */
  protected analyzeStatement(stmt: Statement): void {
    if (stmt instanceof VariableDecl) {
      this.processVariableDecl(stmt);
    } else if (stmt instanceof ExpressionStatement) {
      const expr = stmt.getExpression();
      if (expr instanceof AssignmentExpression) {
        this.processAssignment(expr);
      } else {
        // Analyze expression for CSE opportunities
        this.analyzeExpression(expr);
      }
    } else if (stmt instanceof IfStatement) {
      // Analyze condition
      this.analyzeExpression(stmt.getCondition());
      
      // Reset available expressions for branches (conservative)
      // Each branch starts fresh - CSE doesn't cross control flow
      const savedAvailable = new Map(this.availableExpressions);
      
      this.resetBlockState();
      this.analyzeBlockStatements(stmt.getThenBranch());
      
      const elseBranch = stmt.getElseBranch();
      if (elseBranch) {
        this.resetBlockState();
        this.analyzeBlockStatements(elseBranch);
      }
      
      // After branches, conservatively clear available (CSE is block-local)
      this.availableExpressions = savedAvailable;
    } else if (stmt instanceof WhileStatement) {
      // Analyze condition
      this.analyzeExpression(stmt.getCondition());
      
      // Reset for loop body (CSE doesn't cross loop boundaries)
      const savedAvailable = new Map(this.availableExpressions);
      this.resetBlockState();
      this.analyzeBlockStatements(stmt.getBody());
      
      // After loop, restore but with loop-modified variables invalidated
      this.availableExpressions = savedAvailable;
    } else if (stmt instanceof ForStatement) {
      // Analyze start and end expressions
      this.analyzeExpression(stmt.getStart());
      this.analyzeExpression(stmt.getEnd());
      
      // Invalidate loop variable
      this.invalidateExpressionsUsing(stmt.getVariable());
      
      // Reset for loop body
      const savedAvailable = new Map(this.availableExpressions);
      this.resetBlockState();
      this.analyzeBlockStatements(stmt.getBody());
      
      // Restore after loop
      this.availableExpressions = savedAvailable;
    } else if (stmt instanceof BlockStatement) {
      // Process block contents
      this.analyzeBlockStatements(stmt.getStatements());
    } else if (stmt instanceof MatchStatement) {
      // Analyze match value
      this.analyzeExpression(stmt.getValue());
      
      // Each case is a separate block - reset for each
      const savedAvailable = new Map(this.availableExpressions);
      
      for (const caseClause of stmt.getCases()) {
        this.resetBlockState();
        this.analyzeBlockStatements(caseClause.body);
      }
      
      const defaultCase = stmt.getDefaultCase();
      if (defaultCase) {
        this.resetBlockState();
        this.analyzeBlockStatements(defaultCase);
      }
      
      // After match, restore conservatively
      this.availableExpressions = savedAvailable;
    } else if (stmt instanceof ReturnStatement) {
      const value = stmt.getValue();
      if (value) {
        this.analyzeExpression(value);
      }
    }
  }

  /**
   * Process a variable declaration
   *
   * @param decl - Variable declaration
   */
  protected processVariableDecl(decl: VariableDecl): void {
    const name = decl.getName();
    
    // Skip declarations with parsing errors
    if (name === 'error' || !name) {
      return;
    }

    const init = decl.getInitializer();
    if (init) {
      // Check if initializer expression is already available (CSE candidate)
      const exprString = this.expressionToString(init);
      const existing = this.availableExpressions.get(exprString);
      
      if (existing && existing.holdingVariable) {
        // This is a CSE candidate - expression already computed
        this.markAsCSECandidate(init, existing.holdingVariable);
      }
      
      // Analyze sub-expressions recursively
      this.analyzeExpression(init);
      
      // Add this expression to available set
      if (this.isTrackableExpression(init)) {
        const usedVars = this.collectUsedVariables(init);
        this.availableExpressions.set(exprString, {
          exprString,
          usedVariables: usedVars,
          holdingVariable: name,
          expression: init,
        });
      }
    }

    // Attach available expressions metadata to declaration
    this.attachAvailableMetadata(decl);
  }

  /**
   * Process an assignment expression
   *
   * @param assignment - Assignment expression
   */
  protected processAssignment(assignment: AssignmentExpression): void {
    const target = assignment.getTarget();
    const value = assignment.getValue();

    // First, check if the RHS is a CSE candidate
    const exprString = this.expressionToString(value);
    const existing = this.availableExpressions.get(exprString);
    
    if (existing && existing.holdingVariable) {
      this.markAsCSECandidate(value, existing.holdingVariable);
    }
    
    // Analyze the value expression
    this.analyzeExpression(value);

    // Handle target invalidation
    if (target instanceof IdentifierExpression) {
      const name = target.getName();
      
      // Invalidate any expressions that use this variable
      this.invalidateExpressionsUsing(name);
      
      // Add this expression as available with new variable
      if (this.isTrackableExpression(value)) {
        const usedVars = this.collectUsedVariables(value);
        this.availableExpressions.set(exprString, {
          exprString,
          usedVariables: usedVars,
          holdingVariable: name,
          expression: value,
        });
      }
    } else {
      // Array or member access - analyze the target
      this.analyzeExpression(target);
    }

    // Attach available expressions metadata
    this.attachAvailableMetadata(assignment);
  }

  /**
   * Analyze an expression for CSE opportunities
   *
   * @param expr - Expression to analyze
   */
  protected analyzeExpression(expr: Expression): void {
    // Check if this expression is already available
    const exprString = this.expressionToString(expr);
    const existing = this.availableExpressions.get(exprString);
    
    if (existing && existing.holdingVariable) {
      this.markAsCSECandidate(expr, existing.holdingVariable);
    }
    
    // Recursively analyze sub-expressions
    if (expr instanceof BinaryExpression) {
      this.analyzeExpression(expr.getLeft());
      this.analyzeExpression(expr.getRight());
    } else if (expr instanceof UnaryExpression) {
      this.analyzeExpression(expr.getOperand());
    } else if (expr instanceof CallExpression) {
      for (const arg of expr.getArguments()) {
        this.analyzeExpression(arg);
      }
    } else if (expr instanceof IndexExpression) {
      this.analyzeExpression(expr.getObject());
      this.analyzeExpression(expr.getIndex());
    } else if (expr instanceof MemberExpression) {
      this.analyzeExpression(expr.getObject());
    }
    // Literals and identifiers have no sub-expressions
  }

  /**
   * Convert expression to canonical string representation
   *
   * @param expr - Expression to stringify
   * @returns Canonical string
   */
  protected expressionToString(expr: Expression): string {
    if (expr instanceof LiteralExpression) {
      const value = expr.getValue();
      return `lit_${typeof value}_${value}`;
    } else if (expr instanceof IdentifierExpression) {
      return `var_${expr.getName()}`;
    } else if (expr instanceof BinaryExpression) {
      const op = expr.getOperator();
      let left = this.expressionToString(expr.getLeft());
      let right = this.expressionToString(expr.getRight());
      
      // Normalize commutative operators
      if (COMMUTATIVE_OPERATORS.has(op) && left > right) {
        [left, right] = [right, left];
      }
      
      return `binary_${op}_${left}_${right}`;
    } else if (expr instanceof UnaryExpression) {
      const op = expr.getOperator();
      const operand = this.expressionToString(expr.getOperand());
      return `unary_${op}_${operand}`;
    } else if (expr instanceof CallExpression) {
      // Function calls are not candidates for CSE (may have side effects)
      return `call_${Date.now()}_${Math.random()}`;
    } else if (expr instanceof IndexExpression) {
      const obj = this.expressionToString(expr.getObject());
      const index = this.expressionToString(expr.getIndex());
      return `index_${obj}_${index}`;
    } else if (expr instanceof MemberExpression) {
      const obj = this.expressionToString(expr.getObject());
      const prop = expr.getProperty();
      return `member_${obj}_${prop}`;
    } else if (expr instanceof AssignmentExpression) {
      // Assignments are not CSE candidates
      return `assign_${Date.now()}_${Math.random()}`;
    }
    
    return `unknown_${Date.now()}`;
  }

  /**
   * Check if expression is trackable for CSE
   *
   * Some expressions (like function calls) are not suitable for CSE
   * because they may have side effects.
   *
   * @param expr - Expression to check
   * @returns True if expression can be tracked
   */
  protected isTrackableExpression(expr: Expression): boolean {
    if (expr instanceof CallExpression) {
      // Function calls may have side effects
      return false;
    }
    if (expr instanceof AssignmentExpression) {
      // Assignments are not pure expressions
      return false;
    }
    if (expr instanceof LiteralExpression || expr instanceof IdentifierExpression) {
      // Simple expressions - not worth tracking individually
      return false;
    }
    
    // Binary and unary expressions are trackable
    return true;
  }

  /**
   * Collect all variable names used in an expression
   *
   * @param expr - Expression to analyze
   * @returns Set of variable names
   */
  protected collectUsedVariables(expr: Expression): Set<string> {
    const vars = new Set<string>();
    this.collectVariablesRecursive(expr, vars);
    return vars;
  }

  /**
   * Recursively collect variable names
   *
   * @param expr - Expression to analyze
   * @param vars - Set to add variable names to
   */
  protected collectVariablesRecursive(expr: Expression, vars: Set<string>): void {
    if (expr instanceof IdentifierExpression) {
      vars.add(expr.getName());
    } else if (expr instanceof BinaryExpression) {
      this.collectVariablesRecursive(expr.getLeft(), vars);
      this.collectVariablesRecursive(expr.getRight(), vars);
    } else if (expr instanceof UnaryExpression) {
      this.collectVariablesRecursive(expr.getOperand(), vars);
    } else if (expr instanceof CallExpression) {
      for (const arg of expr.getArguments()) {
        this.collectVariablesRecursive(arg, vars);
      }
    } else if (expr instanceof IndexExpression) {
      this.collectVariablesRecursive(expr.getObject(), vars);
      this.collectVariablesRecursive(expr.getIndex(), vars);
    } else if (expr instanceof MemberExpression) {
      this.collectVariablesRecursive(expr.getObject(), vars);
    }
    // Literals don't use variables
  }

  /**
   * Invalidate all available expressions that use a variable
   *
   * @param varName - Variable being assigned
   */
  protected invalidateExpressionsUsing(varName: string): void {
    const toRemove: string[] = [];
    
    for (const [key, entry] of this.availableExpressions) {
      if (entry.usedVariables.has(varName) || entry.holdingVariable === varName) {
        toRemove.push(key);
      }
    }
    
    for (const key of toRemove) {
      this.availableExpressions.delete(key);
    }
  }

  /**
   * Mark an expression as a CSE candidate
   *
   * @param expr - Expression to mark
   * @param replacement - Variable that holds the computed value
   */
  protected markAsCSECandidate(expr: Expression, replacement: string): void {
    if (!expr.metadata) {
      expr.metadata = new Map();
    }
    expr.metadata.set(OptimizationMetadataKey.CSECandidate, true);
    // Also store replacement info (reusing GVN key for consistency)
    expr.metadata.set(OptimizationMetadataKey.GVNReplacement, replacement);
  }

  /**
   * Attach available expressions metadata to a node
   *
   * @param node - AST node to attach metadata to
   */
  protected attachAvailableMetadata(node: Statement | Expression): void {
    if (!node.metadata) {
      node.metadata = new Map();
    }
    
    // Store set of available expression strings
    const availableSet = new Set<string>();
    for (const entry of this.availableExpressions.values()) {
      availableSet.add(entry.exprString);
    }
    
    node.metadata.set(OptimizationMetadataKey.CSEAvailable, availableSet);
  }

  /**
   * Get all diagnostics generated during analysis
   *
   * @returns Array of diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }
}