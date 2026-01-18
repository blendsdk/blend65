/**
 * Escape Analysis (Task 8.10 - Phase 8 Tier 3)
 *
 * Determines if variables "escape" their local scope, enabling optimizations:
 * - Non-escaping variables can use zero-page allocation
 * - Non-escaping variables can be optimized aggressively
 * - Stack overflow detection for deep call chains (6502 stack = 256 bytes!)
 *
 * A variable escapes when:
 * - Passed to a function
 * - Returned from a function
 * - Stored in global memory
 * - Address is taken (@variable operator)
 *
 * **6502 Stack Limitation**: The 6502 has only 256 bytes of stack ($0100-$01FF).
 * Deep call chains cause stack overflow! We track cumulative stack depth.
 *
 * **Analysis Only**: Marks escape information in metadata for IL optimizer.
 * Does NOT perform transformations - that's the IL optimizer's job.
 */

import type { Program } from '../../ast/nodes.js';
import type { SymbolTable } from '../symbol-table.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import { EscapeReason, OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { Statement, Expression } from '../../ast/base.js';
import { TokenType } from '../../lexer/types.js';
import {
  VariableDecl,
  FunctionDecl,
  AssignmentExpression,
  UnaryExpression,
  IdentifierExpression,
  BinaryExpression,
  CallExpression,
  ExpressionStatement,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  BlockStatement,
  MatchStatement,
} from '../../ast/nodes.js';

/**
 * Variable escape information
 */
interface VariableEscapeInfo {
  /** Variable name */
  name: string;

  /** Does variable escape? */
  escapes: boolean;

  /** Escape reason */
  reason: EscapeReason;

  /** Can be stack-allocated? */
  stackAllocatable: boolean;

  /** Local to function only? */
  localOnly: boolean;

  /** Variable declaration node */
  declaration: VariableDecl;

  /** Function scope (for local variables) */
  functionScope?: string;
}

/**
 * Function stack usage information
 */
interface FunctionStackInfo {
  /** Function name */
  name: string;

  /** Return address (2 bytes for JSR) */
  returnAddress: number;

  /** Parameters passed on stack */
  parameterBytes: number;

  /** Local variables on stack */
  localBytes: number;

  /** Called functions */
  calledFunctions: Set<string>;

  /** Total stack depth (includes callees) */
  totalDepth: number;

  /** Function declaration */
  declaration: FunctionDecl;
}

/**
 * Escape analyzer (Task 8.10)
 *
 * Performs escape analysis to determine which variables escape their local scope.
 * Also tracks 6502 stack usage to detect overflow risk.
 *
 * Analysis phases:
 * 1. Identify all variables (global and local)
 * 2. Initialize escape information (assume no escape)
 * 3. Scan for escape scenarios (address-of, returns, parameters, globals)
 * 4. Calculate stack usage per function
 * 5. Propagate stack depth through call graph
 * 6. Attach metadata to AST nodes
 *
 * Results stored in AST metadata using OptimizationMetadataKey enum.
 *
 * @example
 * ```typescript
 * const analyzer = new EscapeAnalyzer(symbolTable);
 * analyzer.analyze(ast);
 * const diagnostics = analyzer.getDiagnostics();
 * ```
 */
export class EscapeAnalyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Variable escape information */
  protected variableInfo = new Map<string, VariableEscapeInfo>();

  /** Function stack usage information */
  protected functionInfo = new Map<string, FunctionStackInfo>();

  /** Global variables (automatically escape) */
  protected globalVariables = new Set<string>();

  /** 6502 stack size limit */
  protected readonly STACK_SIZE_LIMIT = 256;

  /** Warning threshold (80% of limit) */
  protected readonly STACK_WARNING_THRESHOLD = 200;

  /**
   * Creates an escape analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   */
  constructor(protected readonly symbolTable: SymbolTable) {}

  /**
   * Run escape analysis on program
   *
   * Steps:
   * 1. Identify global and local variables
   * 2. Initialize escape information
   * 3. Scan for escape scenarios
   * 4. Calculate function stack usage
   * 5. Propagate stack depth
   * 6. Attach metadata to AST nodes
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    try {
      // Phase 1: Identify global variables
      this.identifyGlobalVariables(ast);

      // Phase 2: Initialize variable escape information
      this.initializeVariableInfo(ast);

      // Phase 3: Initialize function stack information
      this.initializeFunctionInfo(ast);

      // Phase 4: Scan for escape scenarios
      this.scanForEscapeScenarios(ast);

      // Phase 5: Calculate stack usage
      this.calculateStackUsage();

      // Phase 6: Propagate stack depth through call graph
      this.propagateStackDepth();

      // Phase 7: Attach metadata to AST nodes
      this.attachMetadata(ast);
    } catch (error) {
      this.diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: `Internal error during escape analysis: ${error instanceof Error ? error.message : String(error)}`,
        location: ast.getLocation(),
      });
    }
  }

  /**
   * Identify global variables
   *
   * @param ast - Program AST
   */
  protected identifyGlobalVariables(ast: Program): void {
    for (const decl of ast.getDeclarations()) {
      if (decl instanceof VariableDecl) {
        this.globalVariables.add(decl.getName());
      }
    }
  }

  /**
   * Initialize variable escape information
   *
   * Start with all variables marked as non-escaping, then identify escapes.
   *
   * @param ast - Program AST
   */
  protected initializeVariableInfo(ast: Program): void {
    // Global variables automatically escape
    for (const decl of ast.getDeclarations()) {
      if (decl instanceof VariableDecl) {
        const name = decl.getName();
        this.variableInfo.set(name, {
          name,
          escapes: true, // Globals always escape
          reason: EscapeReason.StoredGlobally,
          stackAllocatable: false,
          localOnly: false,
          declaration: decl,
        });
      }
    }

    // Scan functions for local variables
    for (const decl of ast.getDeclarations()) {
      if (decl instanceof FunctionDecl) {
        this.initializeLocalVariables(decl);
      }
    }
  }

  /**
   * Initialize local variables in function
   *
   * @param func - Function declaration
   */
  protected initializeLocalVariables(func: FunctionDecl): void {
    const funcName = func.getName();
    const body = func.getBody();
    if (!body) return;

    // Walk function body recursively to find ALL local variable declarations
    for (const stmt of body) {
      this.walkStatementForVariables(stmt, funcName);
    }

    // Parameters are also local variables
    for (const param of func.getParameters()) {
      this.variableInfo.set(param.name, {
        name: param.name,
        escapes: false, // Initially assume doesn't escape
        reason: EscapeReason.NoEscape,
        stackAllocatable: true,
        localOnly: true,
        declaration: null as any, // Parameters don't have VariableDecl nodes
        functionScope: funcName,
      });
    }
  }

  /**
   * Walk statement recursively to find variable declarations
   *
   * @param stmt - Statement to walk
   * @param funcName - Function name
   */
  protected walkStatementForVariables(stmt: Statement, funcName: string): void {
    if (stmt instanceof VariableDecl) {
      const varName = stmt.getName();
      this.variableInfo.set(varName, {
        name: varName,
        escapes: false, // Initially assume doesn't escape
        reason: EscapeReason.NoEscape,
        stackAllocatable: true,
        localOnly: true,
        declaration: stmt,
        functionScope: funcName,
      });
    } else if (stmt instanceof IfStatement) {
      for (const s of stmt.getThenBranch()) {
        this.walkStatementForVariables(s, funcName);
      }
      const elseBranch = stmt.getElseBranch();
      if (elseBranch) {
        for (const s of elseBranch) {
          this.walkStatementForVariables(s, funcName);
        }
      }
    } else if (stmt instanceof WhileStatement) {
      for (const s of stmt.getBody()) {
        this.walkStatementForVariables(s, funcName);
      }
    } else if (stmt instanceof ForStatement) {
      for (const s of stmt.getBody()) {
        this.walkStatementForVariables(s, funcName);
      }
    } else if (stmt instanceof BlockStatement) {
      for (const s of stmt.getStatements()) {
        this.walkStatementForVariables(s, funcName);
      }
    } else if (stmt instanceof MatchStatement) {
      for (const c of stmt.getCases()) {
        for (const s of c.body) {
          this.walkStatementForVariables(s, funcName);
        }
      }
      const defaultCase = stmt.getDefaultCase();
      if (defaultCase) {
        for (const s of defaultCase) {
          this.walkStatementForVariables(s, funcName);
        }
      }
    }
  }

  /**
   * Initialize function stack information
   *
   * @param ast - Program AST
   */
  protected initializeFunctionInfo(ast: Program): void {
    for (const decl of ast.getDeclarations()) {
      if (decl instanceof FunctionDecl) {
        const name = decl.getName();
        this.functionInfo.set(name, {
          name,
          returnAddress: 2, // JSR pushes 2-byte return address
          parameterBytes: this.calculateParameterBytes(decl),
          localBytes: this.calculateLocalBytes(decl),
          calledFunctions: new Set(),
          totalDepth: 0,
          declaration: decl,
        });
      }
    }
  }

  /**
   * Calculate bytes used by function parameters
   *
   * @param func - Function declaration
   * @returns Number of bytes
   */
  protected calculateParameterBytes(func: FunctionDecl): number {
    let bytes = 0;
    for (const param of func.getParameters()) {
      // Check parameter type (typeAnnotation is a string)
      const typeName = param.typeAnnotation;
      if (typeName === 'word' || typeName === 'addr') {
        bytes += 2; // word types are 2 bytes
      } else {
        bytes += 1; // byte, boolean, etc. are 1 byte
      }
    }
    return bytes;
  }

  /**
   * Calculate bytes used by local variables
   *
   * @param func - Function declaration
   * @returns Number of bytes
   */
  protected calculateLocalBytes(func: FunctionDecl): number {
    let bytes = 0;
    
    // Count all local variables in this function
    for (const [, info] of this.variableInfo) {
      if (info.functionScope === func.getName() && info.declaration) {
        // Get type size from declaration (typeAnnotation is a string)
        const typeName = info.declaration.getTypeAnnotation();
        if (typeName === 'word' || typeName === 'addr') {
          bytes += 2; // word types are 2 bytes
        } else {
          bytes += 1; // byte, boolean, etc. are 1 byte
        }
      }
    }
    
    return bytes;
  }

  /**
   * Scan for escape scenarios
   *
   * @param ast - Program AST
   */
  protected scanForEscapeScenarios(ast: Program): void {
    for (const decl of ast.getDeclarations()) {
      if (decl instanceof FunctionDecl) {
        this.scanFunction(decl);
      }
    }
  }

  /**
   * Scan function for escape scenarios
   *
   * @param func - Function declaration
   */
  protected scanFunction(func: FunctionDecl): void {
    const funcName = func.getName();
    const body = func.getBody();
    if (!body) return;

    for (const stmt of body) {
      this.scanStatement(stmt, funcName);
    }
  }

  /**
   * Scan statement for escape scenarios
   *
   * @param stmt - Statement to scan
   * @param funcName - Current function name
   */
  protected scanStatement(stmt: Statement, funcName: string): void {
    if (stmt instanceof VariableDecl) {
      // Scan variable initializer for both function calls and escape scenarios
      const initializer = stmt.getInitializer();
      if (initializer) {
        this.scanExpressionForCalls(initializer, funcName);
        // Also scan for address-of operator in initializer
        this.scanInitializerForAddressOf(initializer, funcName);
      }
    } else if (stmt instanceof ReturnStatement) {
      // Returned value escapes
      const value = stmt.getValue();
      if (value) {
        this.scanExpressionForEscape(value, funcName, EscapeReason.ReturnedFromFunction);
      }
    } else if (stmt instanceof ExpressionStatement) {
      const expr = stmt.getExpression();
      
      // Check for assignments to globals
      if (expr instanceof AssignmentExpression) {
        const target = expr.getTarget();
        const value = expr.getValue();
        
        if (target instanceof IdentifierExpression) {
          const targetName = target.getName();
          
          // Assignment to global?
          if (this.globalVariables.has(targetName)) {
            // Value escapes (stored globally)
            this.scanExpressionForEscape(value, funcName, EscapeReason.StoredGlobally);
          }
        }
      } else if (expr instanceof CallExpression) {
        // Track function calls
        const callee = expr.getCallee();
        if (callee instanceof IdentifierExpression) {
          const calleeName = callee.getName();
          const funcInfo = this.functionInfo.get(funcName);
          if (funcInfo) {
            funcInfo.calledFunctions.add(calleeName);
          }
        }
        
        // Arguments passed to function escape
        for (const arg of expr.getArguments()) {
          this.scanExpressionForEscape(arg, funcName, EscapeReason.PassedToFunction);
        }
      }
    } else if (stmt instanceof IfStatement) {
      // Scan branches
      for (const s of stmt.getThenBranch()) {
        this.scanStatement(s, funcName);
      }
      const elseBranch = stmt.getElseBranch();
      if (elseBranch) {
        for (const s of elseBranch) {
          this.scanStatement(s, funcName);
        }
      }
    } else if (stmt instanceof WhileStatement) {
      for (const s of stmt.getBody()) {
        this.scanStatement(s, funcName);
      }
    } else if (stmt instanceof ForStatement) {
      for (const s of stmt.getBody()) {
        this.scanStatement(s, funcName);
      }
    } else if (stmt instanceof BlockStatement) {
      for (const s of stmt.getStatements()) {
        this.scanStatement(s, funcName);
      }
    } else if (stmt instanceof MatchStatement) {
      for (const c of stmt.getCases()) {
        for (const s of c.body) {
          this.scanStatement(s, funcName);
        }
      }
      const defaultCase = stmt.getDefaultCase();
      if (defaultCase) {
        for (const s of defaultCase) {
          this.scanStatement(s, funcName);
        }
      }
    }
  }

  /**
   * Scan initializer for address-of operator
   * 
   * Checks if an initializer contains the address-of operator (@) which causes escape.
   * 
   * @param expr - Expression to scan
   * @param funcName - Current function name
   */
  protected scanInitializerForAddressOf(expr: Expression, funcName: string): void {
    if (expr instanceof UnaryExpression && expr.getOperator() === TokenType.AT) {
      // Address-of operator found - mark operand as escaping
      const operand = expr.getOperand();
      if (operand instanceof IdentifierExpression) {
        this.markEscape(operand.getName(), funcName, EscapeReason.AddressTaken);
      }
    } else if (expr instanceof BinaryExpression) {
      // Recursively scan operands
      this.scanInitializerForAddressOf(expr.getLeft(), funcName);
      this.scanInitializerForAddressOf(expr.getRight(), funcName);
    } else if (expr instanceof UnaryExpression) {
      // Recursively scan operand
      this.scanInitializerForAddressOf(expr.getOperand(), funcName);
    }
  }

  /**
   * Scan expression for function calls (without marking variables as escaping)
   *
   * Used for variable initializers to track call graph.
   *
   * @param expr - Expression to scan
   * @param funcName - Current function name
   */
  protected scanExpressionForCalls(expr: Expression, funcName: string): void {
    if (expr instanceof CallExpression) {
      // Track function call
      const callee = expr.getCallee();
      if (callee instanceof IdentifierExpression) {
        const calleeName = callee.getName();
        const funcInfo = this.functionInfo.get(funcName);
        if (funcInfo) {
          funcInfo.calledFunctions.add(calleeName);
        }
      }
      
      // Arguments passed to function escape
      for (const arg of expr.getArguments()) {
        this.scanExpressionForEscape(arg, funcName, EscapeReason.PassedToFunction);
      }
    } else if (expr instanceof BinaryExpression) {
      // Recursively scan operands for calls
      this.scanExpressionForCalls(expr.getLeft(), funcName);
      this.scanExpressionForCalls(expr.getRight(), funcName);
    } else if (expr instanceof UnaryExpression) {
      // Recursively scan operand for calls
      this.scanExpressionForCalls(expr.getOperand(), funcName);
    }
  }

  /**
   * Scan expression for variables that escape
   *
   * Marks variables as escaping based on context:
   * - Variables returned from functions escape (even in expressions)
   * - Variables passed to functions escape
   * - Variables stored globally escape
   * - Address-of operator causes escape
   *
   * @param expr - Expression to scan
   * @param funcName - Current function name
   * @param reason - Escape reason
   */
  protected scanExpressionForEscape(expr: Expression, funcName: string, reason: EscapeReason): void {
    if (expr instanceof IdentifierExpression) {
      // Mark variable as escaping for this reason
      this.markEscape(expr.getName(), funcName, reason);
    } else if (expr instanceof UnaryExpression && expr.getOperator() === TokenType.AT) {
      // Address-of operator - variable always escapes
      const operand = expr.getOperand();
      if (operand instanceof IdentifierExpression) {
        this.markEscape(operand.getName(), funcName, EscapeReason.AddressTaken);
      }
    } else if (expr instanceof BinaryExpression) {
      // Recursively scan operands
      this.scanExpressionForEscape(expr.getLeft(), funcName, reason);
      this.scanExpressionForEscape(expr.getRight(), funcName, reason);
    } else if (expr instanceof CallExpression) {
      // Arguments escape
      for (const arg of expr.getArguments()) {
        this.scanExpressionForEscape(arg, funcName, EscapeReason.PassedToFunction);
      }
    }
  }

  /**
   * Mark a variable as escaping
   *
   * @param varName - Variable name
   * @param funcName - Current function name
   * @param reason - Escape reason
   */
  protected markEscape(varName: string, funcName: string, reason: EscapeReason): void {
    const info = this.variableInfo.get(varName);
    if (!info) return;

    // Only mark as escaped if it's a local variable in this function
    if (info.functionScope === funcName && !info.escapes) {
      info.escapes = true;
      info.reason = reason;
      info.stackAllocatable = false;
      info.localOnly = false;
    }
  }

  /**
   * Calculate stack usage for each function
   */
  protected calculateStackUsage(): void {
    for (const [, info] of this.functionInfo) {
      // Base stack usage = return address + parameters + locals
      info.totalDepth = info.returnAddress + info.parameterBytes + info.localBytes;
    }
  }

  /**
   * Propagate stack depth through call graph
   *
   * If function A calls B, A's stack depth includes B's depth.
   * Iterate until fixpoint reached.
   */
  protected propagateStackDepth(): void {
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const [, info] of this.functionInfo) {
        const oldDepth = info.totalDepth;
        let maxCalleeDepth = 0;

        // Find maximum callee depth
        for (const calleeName of info.calledFunctions) {
          const calleeInfo = this.functionInfo.get(calleeName);
          if (calleeInfo) {
            maxCalleeDepth = Math.max(maxCalleeDepth, calleeInfo.totalDepth);
          }
        }

        // Update total depth
        const baseDepth = info.returnAddress + info.parameterBytes + info.localBytes;
        info.totalDepth = baseDepth + maxCalleeDepth;

        if (info.totalDepth !== oldDepth) {
          changed = true;
        }

        // Check for stack overflow
        if (info.totalDepth > this.STACK_SIZE_LIMIT) {
          this.diagnostics.push({
            code: DiagnosticCode.TYPE_MISMATCH,
            severity: DiagnosticSeverity.ERROR,
            message: `Stack overflow risk! Function '${info.name}' uses ${info.totalDepth} bytes (limit: ${this.STACK_SIZE_LIMIT} bytes). Reduce call depth or local variable usage.`,
            location: info.declaration.getLocation(),
          });
        } else if (info.totalDepth > this.STACK_WARNING_THRESHOLD) {
          this.diagnostics.push({
            code: DiagnosticCode.TYPE_MISMATCH,
            severity: DiagnosticSeverity.WARNING,
            message: `High stack usage: Function '${info.name}' uses ${info.totalDepth} bytes. Close to ${this.STACK_SIZE_LIMIT} byte limit.`,
            location: info.declaration.getLocation(),
          });
        }
      }
    }

    if (iterations >= maxIterations) {
      this.diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.WARNING,
        message: 'Stack depth analysis fixpoint iteration limit reached. Results may be incomplete.',
        location: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 0, line: 1, column: 1 },
        },
      });
    }
  }

  /**
   * Attach escape metadata to AST nodes
   *
   * @param _ast - Program AST (unused but kept for consistency)
   */
  protected attachMetadata(_ast: Program): void {
    // Attach to variable declarations
    for (const [, info] of this.variableInfo) {
      if (info.declaration) {
        if (!info.declaration.metadata) {
          info.declaration.metadata = new Map();
        }

        info.declaration.metadata.set(OptimizationMetadataKey.EscapeEscapes, info.escapes);
        info.declaration.metadata.set(OptimizationMetadataKey.EscapeReason, info.reason);
        info.declaration.metadata.set(OptimizationMetadataKey.EscapeStackAllocatable, info.stackAllocatable);
        info.declaration.metadata.set(OptimizationMetadataKey.EscapeLocalOnly, info.localOnly);
      }
    }

    // Attach to function declarations
    for (const [, info] of this.functionInfo) {
      if (!info.declaration.metadata) {
        info.declaration.metadata = new Map();
      }

      info.declaration.metadata.set(OptimizationMetadataKey.StackDepth, info.totalDepth);
      info.declaration.metadata.set(OptimizationMetadataKey.StackOverflowRisk, info.totalDepth > this.STACK_SIZE_LIMIT);
    }
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