/**
 * Global Value Numbering Analysis (Task 8.14.2 - Phase 8 Tier 3)
 *
 * Assigns unique "value numbers" to expressions based on their structure.
 * Expressions with the same operator and operand value numbers get the same
 * result value number, enabling redundant computation detection.
 *
 * **Analysis Only**: Marks redundant computations in metadata for IL optimizer.
 * Does NOT perform transformations - that's the IL optimizer's job.
 *
 * Key concepts:
 * - Value Number: Integer ID representing a unique computed value
 * - Redundant Computation: Same value computed multiple times
 * - Expression Hash: Canonical string representation for matching
 *
 * @example
 * ```
 * let x: byte = a + b;    // a+b gets value number 1
 * let y: byte = a + b;    // Redundant - same value number 1
 * let z: byte = a - b;    // Different operator - value number 2
 * ```
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
 * Tracked value with its assignments
 */
interface ValueEntry {
  /** Value number assigned to this expression */
  valueNumber: number;
  
  /** Variable names that hold this value */
  variables: Set<string>;
  
  /** Expression hash that produces this value */
  hash: string;
}

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
 * Global Value Numbering Analyzer (Task 8.14.2)
 *
 * Performs value numbering to identify redundant computations.
 * Expressions that compute the same value get the same value number.
 *
 * Algorithm:
 * 1. Walk through program in dominance order
 * 2. Assign value numbers to expressions based on structure
 * 3. Same operator + same operand value numbers = same result
 * 4. Track which variables hold which values
 * 5. Mark redundant computations in metadata
 *
 * Results stored in AST metadata using OptimizationMetadataKey enum:
 * - GVNNumber: Value number assigned to expression
 * - GVNRedundant: Boolean indicating redundant computation
 * - GVNReplacement: Variable name that can replace this computation
 *
 * @example
 * ```typescript
 * const analyzer = new GlobalValueNumberingAnalyzer(cfgs, symbolTable);
 * analyzer.analyze(ast);
 * const diagnostics = analyzer.getDiagnostics();
 * ```
 */
export class GlobalValueNumberingAnalyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Map from expression hash to value entry */
  protected valueTable = new Map<string, ValueEntry>();

  /** Map from variable name to its current value number */
  protected variableValues = new Map<string, number>();

  /** Next available value number */
  protected nextValueNumber = 1;

  /**
   * Creates a Global Value Numbering analyzer
   *
   * @param cfgs - Control flow graphs from Pass 5
   * @param symbolTable - Symbol table from Pass 1
   */
  constructor(
    protected readonly cfgs: Map<string, ControlFlowGraph>,
    protected readonly symbolTable: SymbolTable
  ) {}

  /**
   * Run GVN analysis on program
   *
   * Analyzes all functions and global declarations.
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    try {
      // Reset state for fresh analysis
      this.resetState();

      // Process global variable declarations
      for (const decl of ast.getDeclarations()) {
        if (decl instanceof VariableDecl) {
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
        message: `Internal error during GVN analysis: ${error instanceof Error ? error.message : String(error)}`,
        location: ast.getLocation(),
      });
    }
  }

  /**
   * Reset analyzer state for fresh analysis
   */
  protected resetState(): void {
    this.valueTable.clear();
    this.variableValues.clear();
    this.nextValueNumber = 1;
    this.diagnostics = [];
  }

  /**
   * Analyze a function with GVN
   *
   * @param func - Function declaration to analyze
   */
  protected analyzeFunction(func: FunctionDecl): void {
    // Reset per-function state (keep global variable values)
    const savedVariableValues = new Map(this.variableValues);
    
    // Initialize parameters with fresh value numbers
    for (const param of func.getParameters()) {
      const valueNumber = this.getNextValueNumber();
      this.variableValues.set(param.name, valueNumber);
    }

    // Analyze function body
    const body = func.getBody();
    if (body) {
      for (const stmt of body) {
        this.analyzeStatement(stmt);
      }
    }

    // Restore global state (function-local values are discarded)
    // Keep only truly global variables
    this.variableValues = savedVariableValues;
  }

  /**
   * Analyze a statement for GVN
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
        // Analyze expression for value numbering
        this.analyzeExpression(expr);
      }
    } else if (stmt instanceof IfStatement) {
      this.analyzeIfStatement(stmt);
    } else if (stmt instanceof WhileStatement) {
      this.analyzeWhileStatement(stmt);
    } else if (stmt instanceof ForStatement) {
      this.analyzeForStatement(stmt);
    } else if (stmt instanceof BlockStatement) {
      for (const s of stmt.getStatements()) {
        this.analyzeStatement(s);
      }
    } else if (stmt instanceof MatchStatement) {
      this.analyzeMatchStatement(stmt);
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
      // Analyze initializer and get its value number
      const valueNumber = this.getOrAssignValueNumber(init);
      this.variableValues.set(name, valueNumber);

      // Check if this is a redundant computation
      const hash = this.computeExpressionHash(init);
      const entry = this.valueTable.get(hash);
      
      if (entry && entry.variables.size > 0) {
        // This expression was already computed
        const replacement = this.findBestReplacement(entry);
        if (replacement && replacement !== name) {
          this.markRedundant(init, replacement);
        }
      }

      // Add this variable to the value entry
      if (entry) {
        entry.variables.add(name);
      }

      // Attach value number metadata to declaration
      if (!decl.metadata) {
        decl.metadata = new Map();
      }
      decl.metadata.set(OptimizationMetadataKey.GVNNumber, valueNumber);
    } else {
      // Uninitialized variable gets a unique value number
      this.variableValues.set(name, this.getNextValueNumber());
    }
  }

  /**
   * Process an assignment expression
   *
   * @param assignment - Assignment expression
   */
  protected processAssignment(assignment: AssignmentExpression): void {
    const target = assignment.getTarget();
    const value = assignment.getValue();

    // Analyze the value being assigned
    const valueNumber = this.getOrAssignValueNumber(value);

    // Handle different target types
    if (target instanceof IdentifierExpression) {
      const name = target.getName();
      
      // Invalidate any values that depend on this variable
      this.invalidateVariable(name);
      
      // Check for redundant computation
      const hash = this.computeExpressionHash(value);
      const entry = this.valueTable.get(hash);
      
      if (entry && entry.variables.size > 0) {
        const replacement = this.findBestReplacement(entry);
        if (replacement && replacement !== name) {
          this.markRedundant(value, replacement);
        }
      }

      // Update variable's value number
      this.variableValues.set(name, valueNumber);
      
      // Add this variable to the value entry
      if (entry) {
        entry.variables.add(name);
      }
    } else {
      // Array/member access - just analyze for value numbering
      this.analyzeExpression(target);
    }

    // Attach metadata to the assignment
    if (!assignment.metadata) {
      assignment.metadata = new Map();
    }
    assignment.metadata.set(OptimizationMetadataKey.GVNNumber, valueNumber);
  }

  /**
   * Analyze an if statement
   *
   * @param stmt - If statement
   */
  protected analyzeIfStatement(stmt: IfStatement): void {
    // Analyze condition
    this.analyzeExpression(stmt.getCondition());

    // Save state before branches
    const savedValues = new Map(this.variableValues);
    const savedTable = new Map(this.valueTable);

    // Analyze then branch
    for (const s of stmt.getThenBranch()) {
      this.analyzeStatement(s);
    }
    const thenValues = new Map(this.variableValues);

    // Restore and analyze else branch
    this.variableValues = new Map(savedValues);
    this.valueTable = new Map(savedTable);
    
    const elseBranch = stmt.getElseBranch();
    if (elseBranch) {
      for (const s of elseBranch) {
        this.analyzeStatement(s);
      }
    }
    const elseValues = this.variableValues;

    // Merge: variables modified in either branch get fresh value numbers
    this.mergeValues(savedValues, thenValues, elseValues);
  }

  /**
   * Analyze a while statement
   *
   * @param stmt - While statement
   */
  protected analyzeWhileStatement(stmt: WhileStatement): void {
    // Analyze condition
    this.analyzeExpression(stmt.getCondition());

    // Save state before loop
    const savedValues = new Map(this.variableValues);

    // Analyze body (conservatively: variables modified in loop get fresh values)
    for (const s of stmt.getBody()) {
      this.analyzeStatement(s);
    }

    // Variables modified in loop cannot keep their pre-loop values
    for (const [name, valueNumber] of this.variableValues) {
      if (savedValues.get(name) !== valueNumber) {
        // Variable was modified in loop - give it a fresh value number
        this.variableValues.set(name, this.getNextValueNumber());
        this.invalidateVariable(name);
      }
    }
  }

  /**
   * Analyze a for statement
   *
   * @param stmt - For statement
   */
  protected analyzeForStatement(stmt: ForStatement): void {
    // Analyze start and end expressions
    this.analyzeExpression(stmt.getStart());
    this.analyzeExpression(stmt.getEnd());

    // Loop variable gets a fresh value each iteration
    const loopVar = stmt.getVariable();
    const savedValue = this.variableValues.get(loopVar);

    // Give loop variable initial value number
    this.variableValues.set(loopVar, this.getNextValueNumber());

    // Save state before loop body
    const savedValues = new Map(this.variableValues);

    // Analyze body
    for (const s of stmt.getBody()) {
      this.analyzeStatement(s);
    }

    // Variables modified in loop get fresh values (conservative)
    for (const [name, valueNumber] of this.variableValues) {
      if (savedValues.get(name) !== valueNumber) {
        this.variableValues.set(name, this.getNextValueNumber());
        this.invalidateVariable(name);
      }
    }

    // Restore loop variable if it existed before
    if (savedValue !== undefined) {
      this.variableValues.set(loopVar, savedValue);
    }
  }

  /**
   * Analyze a match statement
   *
   * @param stmt - Match statement
   */
  protected analyzeMatchStatement(stmt: MatchStatement): void {
    // Analyze match value
    this.analyzeExpression(stmt.getValue());

    // Save state before cases
    const savedValues = new Map(this.variableValues);
    const allCaseValues: Map<string, number>[] = [];

    // Analyze each case
    for (const caseClause of stmt.getCases()) {
      this.variableValues = new Map(savedValues);
      
      for (const s of caseClause.body) {
        this.analyzeStatement(s);
      }
      
      allCaseValues.push(new Map(this.variableValues));
    }

    // Analyze default case
    const defaultCase = stmt.getDefaultCase();
    if (defaultCase) {
      this.variableValues = new Map(savedValues);
      
      for (const s of defaultCase) {
        this.analyzeStatement(s);
      }
      
      allCaseValues.push(new Map(this.variableValues));
    }

    // Merge all case values
    this.mergeAllValues(savedValues, allCaseValues);
  }

  /**
   * Analyze an expression for value numbering
   *
   * @param expr - Expression to analyze
   * @returns Value number assigned to expression
   */
  protected analyzeExpression(expr: Expression): number {
    return this.getOrAssignValueNumber(expr);
  }

  /**
   * Get or assign a value number to an expression
   *
   * @param expr - Expression to number
   * @returns Value number
   */
  protected getOrAssignValueNumber(expr: Expression): number {
    const hash = this.computeExpressionHash(expr);
    
    // Check if we've seen this expression before
    const existing = this.valueTable.get(hash);
    if (existing) {
      // Attach metadata
      if (!expr.metadata) {
        expr.metadata = new Map();
      }
      expr.metadata.set(OptimizationMetadataKey.GVNNumber, existing.valueNumber);
      
      return existing.valueNumber;
    }

    // Assign new value number
    const valueNumber = this.getNextValueNumber();
    
    this.valueTable.set(hash, {
      valueNumber,
      variables: new Set(),
      hash,
    });

    // Attach metadata
    if (!expr.metadata) {
      expr.metadata = new Map();
    }
    expr.metadata.set(OptimizationMetadataKey.GVNNumber, valueNumber);

    return valueNumber;
  }

  /**
   * Compute canonical hash for an expression
   *
   * @param expr - Expression to hash
   * @returns Canonical string hash
   */
  protected computeExpressionHash(expr: Expression): string {
    if (expr instanceof LiteralExpression) {
      return this.handleLiteral(expr);
    } else if (expr instanceof IdentifierExpression) {
      return this.handleIdentifier(expr);
    } else if (expr instanceof BinaryExpression) {
      return this.handleBinaryExpression(expr);
    } else if (expr instanceof UnaryExpression) {
      return this.handleUnaryExpression(expr);
    } else if (expr instanceof CallExpression) {
      return this.handleCallExpression(expr);
    } else if (expr instanceof IndexExpression) {
      return this.handleIndexExpression(expr);
    } else if (expr instanceof MemberExpression) {
      return this.handleMemberExpression(expr);
    } else if (expr instanceof AssignmentExpression) {
      // Assignments are not pure - return unique hash
      return `assign_${this.getNextValueNumber()}`;
    }

    // Unknown expression type - unique hash
    return `unknown_${this.getNextValueNumber()}`;
  }

  /**
   * Handle literal expression hash
   *
   * @param expr - Literal expression
   * @returns Hash string
   */
  protected handleLiteral(expr: LiteralExpression): string {
    const value = expr.getValue();
    return `lit_${typeof value}_${value}`;
  }

  /**
   * Handle identifier expression hash
   *
   * @param expr - Identifier expression
   * @returns Hash string
   */
  protected handleIdentifier(expr: IdentifierExpression): string {
    const name = expr.getName();
    const valueNumber = this.variableValues.get(name);
    
    if (valueNumber !== undefined) {
      return `var_${valueNumber}`;
    }
    
    // Unknown variable - treat as fresh value
    return `var_${name}_unknown`;
  }

  /**
   * Handle binary expression hash
   *
   * @param expr - Binary expression
   * @returns Hash string
   */
  protected handleBinaryExpression(expr: BinaryExpression): string {
    const op = expr.getOperator();
    let leftHash = this.computeExpressionHash(expr.getLeft());
    let rightHash = this.computeExpressionHash(expr.getRight());

    // For commutative operators, sort operands to normalize
    if (COMMUTATIVE_OPERATORS.has(op)) {
      if (leftHash > rightHash) {
        [leftHash, rightHash] = [rightHash, leftHash];
      }
    }

    return `binary_${op}_${leftHash}_${rightHash}`;
  }

  /**
   * Handle unary expression hash
   *
   * @param expr - Unary expression
   * @returns Hash string
   */
  protected handleUnaryExpression(expr: UnaryExpression): string {
    const op = expr.getOperator();
    const operandHash = this.computeExpressionHash(expr.getOperand());
    return `unary_${op}_${operandHash}`;
  }

  /**
   * Handle call expression hash
   *
   * @param _expr - Call expression (unused - calls are not pure)
   * @returns Hash string
   */
  protected handleCallExpression(_expr: CallExpression): string {
    // Function calls are not pure by default - return unique hash
    // A purity analysis would allow caching pure function calls
    return `call_${this.getNextValueNumber()}`;
  }

  /**
   * Handle index expression hash
   *
   * @param expr - Index expression
   * @returns Hash string
   */
  protected handleIndexExpression(expr: IndexExpression): string {
    const objHash = this.computeExpressionHash(expr.getObject());
    const indexHash = this.computeExpressionHash(expr.getIndex());
    return `index_${objHash}_${indexHash}`;
  }

  /**
   * Handle member expression hash
   *
   * @param expr - Member expression
   * @returns Hash string
   */
  protected handleMemberExpression(expr: MemberExpression): string {
    const objHash = this.computeExpressionHash(expr.getObject());
    const prop = expr.getProperty();
    return `member_${objHash}_${prop}`;
  }

  /**
   * Mark an expression as redundant
   *
   * @param expr - Redundant expression
   * @param replacement - Variable that can replace it
   */
  protected markRedundant(expr: Expression, replacement: string): void {
    if (!expr.metadata) {
      expr.metadata = new Map();
    }
    expr.metadata.set(OptimizationMetadataKey.GVNRedundant, true);
    expr.metadata.set(OptimizationMetadataKey.GVNReplacement, replacement);
  }

  /**
   * Find the best replacement variable from a value entry
   *
   * @param entry - Value entry with candidate variables
   * @returns Best variable name or null
   */
  protected findBestReplacement(entry: ValueEntry): string | null {
    if (entry.variables.size === 0) {
      return null;
    }
    
    // Return first available variable (could be improved with heuristics)
    const firstValue = entry.variables.values().next().value;
    return firstValue ?? null;
  }

  /**
   * Invalidate all value table entries that depend on a variable
   *
   * @param varName - Variable being reassigned
   */
  protected invalidateVariable(varName: string): void {
    // Remove variable from all value entries
    for (const entry of this.valueTable.values()) {
      entry.variables.delete(varName);
    }
  }

  /**
   * Merge values after if-then-else
   *
   * @param before - Values before branch
   * @param thenValues - Values after then branch
   * @param elseValues - Values after else branch
   */
  protected mergeValues(
    before: Map<string, number>,
    thenValues: Map<string, number>,
    elseValues: Map<string, number>
  ): void {
    this.variableValues = new Map();

    // Collect all variable names
    const allVars = new Set<string>();
    for (const name of before.keys()) allVars.add(name);
    for (const name of thenValues.keys()) allVars.add(name);
    for (const name of elseValues.keys()) allVars.add(name);

    for (const name of allVars) {
      const beforeVal = before.get(name);
      const thenVal = thenValues.get(name);
      const elseVal = elseValues.get(name);

      if (thenVal === elseVal && thenVal !== undefined) {
        // Same value in both branches
        this.variableValues.set(name, thenVal);
      } else if (thenVal !== beforeVal || elseVal !== beforeVal) {
        // Variable was modified in at least one branch - fresh value
        this.variableValues.set(name, this.getNextValueNumber());
        this.invalidateVariable(name);
      } else if (beforeVal !== undefined) {
        // Unchanged
        this.variableValues.set(name, beforeVal);
      }
    }
  }

  /**
   * Merge values from multiple branches (for match statement)
   *
   * @param before - Values before branches
   * @param allBranchValues - Values after each branch
   */
  protected mergeAllValues(
    before: Map<string, number>,
    allBranchValues: Map<string, number>[]
  ): void {
    this.variableValues = new Map();

    // Collect all variable names
    const allVars = new Set<string>();
    for (const name of before.keys()) allVars.add(name);
    for (const branchValues of allBranchValues) {
      for (const name of branchValues.keys()) allVars.add(name);
    }

    for (const name of allVars) {
      const beforeVal = before.get(name);
      
      // Check if all branches have the same value
      let sameInAll = true;
      let commonValue: number | undefined;
      
      for (const branchValues of allBranchValues) {
        const branchVal = branchValues.get(name);
        if (commonValue === undefined) {
          commonValue = branchVal;
        } else if (branchVal !== commonValue) {
          sameInAll = false;
          break;
        }
      }

      if (sameInAll && commonValue !== undefined) {
        this.variableValues.set(name, commonValue);
      } else if (beforeVal !== undefined) {
        // Variable may have different values - fresh value
        this.variableValues.set(name, this.getNextValueNumber());
        this.invalidateVariable(name);
      }
    }
  }

  /**
   * Get next available value number
   *
   * @returns New unique value number
   */
  protected getNextValueNumber(): number {
    return this.nextValueNumber++;
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