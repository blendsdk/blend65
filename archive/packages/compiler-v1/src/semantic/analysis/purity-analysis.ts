/**
 * Purity Analysis (Task 8.9 - Phase 8 Tier 3)
 *
 * Detects pure functions (no side effects, deterministic results).
 * A function is pure if:
 * - It has no side effects (no I/O, no global writes)
 * - Its result depends only on its arguments
 * - It always returns the same value for the same arguments
 *
 * Purity levels:
 * - Pure: No side effects, deterministic
 * - ReadOnly: Reads global/I/O state but doesn't modify it
 * - LocalEffects: Only mutates local state
 * - Impure: Has observable side effects
 *
 * **Analysis Only**: Marks purity levels in metadata for IL optimizer.
 * Does NOT perform transformations - that's the IL optimizer's job.
 */

import type { Program } from '../../ast/nodes.js';
import type { SymbolTable } from '../symbol-table.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import { PurityLevel, OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { Statement, Expression } from '../../ast/base.js';
import {
  VariableDecl,
  FunctionDecl,
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
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
 * Function purity information
 */
interface FunctionPurityInfo {
  /** Function name */
  name: string;

  /** Current purity level */
  purityLevel: PurityLevel;

  /** Memory locations written by function */
  writtenLocations: Set<string>;

  /** Memory locations read by function */
  readLocations: Set<string>;

  /** Functions called by this function */
  calledFunctions: Set<string>;

  /** Does function have side effects? */
  hasSideEffects: boolean;

  /** Function declaration node */
  declaration: FunctionDecl;
}

/**
 * Purity analyzer (Task 8.9)
 *
 * Performs function purity analysis to determine which functions:
 * - Are pure (can be memoized, reordered, eliminated if unused)
 * - Are read-only (can be reordered if not dependent on state)
 * - Have side effects (must preserve call order and execution)
 *
 * Uses bottom-up analysis with fixpoint iteration:
 * 1. Initialize all functions as Pure
 * 2. Scan function bodies for side effects
 * 3. Downgrade purity level based on operations
 * 4. Propagate impurity through call graph
 * 5. Iterate until fixpoint reached
 *
 * Results stored in AST metadata using OptimizationMetadataKey enum.
 *
 * @example
 * ```typescript
 * const analyzer = new PurityAnalyzer(symbolTable);
 * analyzer.analyze(ast);
 * const diagnostics = analyzer.getDiagnostics();
 * ```
 */
export class PurityAnalyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Function purity information */
  protected functionInfo = new Map<string, FunctionPurityInfo>();

  /** Global variables (writes to these make function impure) */
  protected globalVariables = new Set<string>();

  /** @map variables (writes to these may be side effects) */
  protected mapVariables = new Set<string>();

  /**
   * Creates a purity analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   */
  constructor(protected readonly symbolTable: SymbolTable) {}

  /**
   * Run purity analysis on program
   *
   * Steps:
   * 1. Identify global and @map variables
   * 2. Initialize function purity information
   * 3. Analyze each function body
   * 4. Propagate impurity through call graph
   * 5. Attach metadata to AST nodes
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    try {
      // Phase 1: Identify global and @map variables
      this.identifyGlobalVariables(ast);

      // Phase 2: Initialize function purity information
      this.initializeFunctionInfo(ast);

      // Phase 3: Analyze each function body
      this.analyzeFunctionBodies();

      // Phase 4: Propagate impurity through call graph (fixpoint)
      this.propagateImpurity();

      // Phase 5: Attach metadata to AST nodes
      this.attachMetadata(ast);
    } catch (error) {
      this.diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: `Internal error during purity analysis: ${error instanceof Error ? error.message : String(error)}`,
        location: ast.getLocation(),
      });
    }
  }

  /**
   * Identify global variables and @map declarations
   *
   * Variables at module level are considered global.
   * @map declarations are tracked separately.
   *
   * @param ast - Program AST
   */
  protected identifyGlobalVariables(ast: Program): void {
    for (const decl of ast.getDeclarations()) {
      if (decl instanceof VariableDecl) {
        this.globalVariables.add(decl.getName());
      } else if (
        decl instanceof SimpleMapDecl ||
        decl instanceof RangeMapDecl ||
        decl instanceof SequentialStructMapDecl ||
        decl instanceof ExplicitStructMapDecl
      ) {
        const name = (decl as any).getName();
        this.mapVariables.add(name);
      }
    }
  }

  /**
   * Initialize function purity information
   *
   * Start with all functions marked as Pure, then downgrade based on analysis.
   *
   * @param ast - Program AST
   */
  protected initializeFunctionInfo(ast: Program): void {
    for (const decl of ast.getDeclarations()) {
      if (decl instanceof FunctionDecl) {
        const name = decl.getName();
        this.functionInfo.set(name, {
          name,
          purityLevel: PurityLevel.Pure,
          writtenLocations: new Set(),
          readLocations: new Set(),
          calledFunctions: new Set(),
          hasSideEffects: false,
          declaration: decl,
        });
      }
    }
  }

  /**
   * Analyze all function bodies for side effects
   */
  protected analyzeFunctionBodies(): void {
    for (const [, info] of this.functionInfo) {
      this.analyzeFunctionBody(info);
    }
  }

  /**
   * Analyze a single function body
   *
   * @param info - Function purity information
   */
  protected analyzeFunctionBody(info: FunctionPurityInfo): void {
    const body = info.declaration.getBody();
    if (!body) return;

    for (const stmt of body) {
      this.analyzeStatement(stmt, info);
    }
  }

  /**
   * Analyze a statement for side effects
   *
   * @param stmt - Statement to analyze
   * @param info - Function purity information
   */
  protected analyzeStatement(stmt: Statement, info: FunctionPurityInfo): void {
    if (stmt instanceof VariableDecl) {
      // Local variable declaration - check initializer
      const init = stmt.getInitializer();
      if (init) {
        this.analyzeExpression(init, info);
      }
    } else if (stmt instanceof ExpressionStatement) {
      this.analyzeExpression(stmt.getExpression(), info);
    } else if (stmt instanceof ReturnStatement) {
      const value = stmt.getValue();
      if (value) {
        this.analyzeExpression(value, info);
      }
    } else if (stmt instanceof IfStatement) {
      // Analyze condition
      this.analyzeExpression(stmt.getCondition(), info);

      // Analyze branches
      for (const s of stmt.getThenBranch()) {
        this.analyzeStatement(s, info);
      }
      const elseBranch = stmt.getElseBranch();
      if (elseBranch) {
        for (const s of elseBranch) {
          this.analyzeStatement(s, info);
        }
      }
    } else if (stmt instanceof WhileStatement) {
      this.analyzeExpression(stmt.getCondition(), info);
      for (const s of stmt.getBody()) {
        this.analyzeStatement(s, info);
      }
    } else if (stmt instanceof ForStatement) {
      this.analyzeExpression(stmt.getStart(), info);
      this.analyzeExpression(stmt.getEnd(), info);
      for (const s of stmt.getBody()) {
        this.analyzeStatement(s, info);
      }
    } else if (stmt instanceof BlockStatement) {
      for (const s of stmt.getStatements()) {
        this.analyzeStatement(s, info);
      }
    } else if (stmt instanceof MatchStatement) {
      this.analyzeExpression(stmt.getValue(), info);
      for (const c of stmt.getCases()) {
        for (const s of c.body) {
          this.analyzeStatement(s, info);
        }
      }
      const defaultCase = stmt.getDefaultCase();
      if (defaultCase) {
        for (const s of defaultCase) {
          this.analyzeStatement(s, info);
        }
      }
    }
  }

  /**
   * Analyze an expression for side effects
   *
   * @param expr - Expression to analyze
   * @param info - Function purity information
   */
  protected analyzeExpression(expr: Expression, info: FunctionPurityInfo): void {
    if (expr instanceof AssignmentExpression) {
      // Assignment - check if writing to global or @map
      const target = expr.getTarget();
      if (target instanceof IdentifierExpression) {
        const name = target.getName();

        // Write to global variable?
        if (this.globalVariables.has(name)) {
          info.writtenLocations.add(name);
          this.downgradePurity(info, PurityLevel.Impure, 'writes to global variable');
        }

        // Write to @map (I/O or memory-mapped hardware)?
        if (this.mapVariables.has(name)) {
          info.writtenLocations.add(name);
          this.downgradePurity(info, PurityLevel.Impure, 'writes to @map location');
        }

        // Write to local variable is OK (LocalEffects at most)
        if (!this.globalVariables.has(name) && !this.mapVariables.has(name)) {
          // Only downgrade to LocalEffects if currently Pure
          if (info.purityLevel === PurityLevel.Pure) {
            this.downgradePurity(info, PurityLevel.LocalEffects, 'modifies local state');
          }
        }
      }

      // Analyze value expression
      this.analyzeExpression(expr.getValue(), info);
    } else if (expr instanceof IdentifierExpression) {
      // Reading a variable
      const name = expr.getName();

      // Read from global variable?
      if (this.globalVariables.has(name)) {
        info.readLocations.add(name);
        // Downgrade to ReadOnly if currently Pure
        if (info.purityLevel === PurityLevel.Pure) {
          this.downgradePurity(info, PurityLevel.ReadOnly, 'reads global variable');
        }
      }

      // Read from @map (I/O or memory-mapped hardware)?
      if (this.mapVariables.has(name)) {
        info.readLocations.add(name);
        // Downgrade to ReadOnly if currently Pure
        if (info.purityLevel === PurityLevel.Pure) {
          this.downgradePurity(info, PurityLevel.ReadOnly, 'reads @map location');
        }
      }
    } else if (expr instanceof CallExpression) {
      // Function call - track called functions
      const callee = expr.getCallee();
      if (callee instanceof IdentifierExpression) {
        const calleeName = callee.getName();
        info.calledFunctions.add(calleeName);

        // Purity will be propagated later in propagateImpurity()
      }

      // Analyze arguments
      for (const arg of expr.getArguments()) {
        this.analyzeExpression(arg, info);
      }
    } else if (expr instanceof BinaryExpression) {
      this.analyzeExpression(expr.getLeft(), info);
      this.analyzeExpression(expr.getRight(), info);
    } else if (expr instanceof UnaryExpression) {
      this.analyzeExpression(expr.getOperand(), info);
    }
    // Literal expressions have no side effects
  }

  /**
   * Downgrade function purity level
   *
   * @param info - Function purity information
   * @param newLevel - New purity level
   * @param _reason - Reason for downgrade (unused but kept for documentation)
   */
  protected downgradePurity(info: FunctionPurityInfo, newLevel: PurityLevel, _reason: string): void {
    // Only downgrade, never upgrade
    const currentRank = this.getPurityRank(info.purityLevel);
    const newRank = this.getPurityRank(newLevel);

    if (newRank > currentRank) {
      info.purityLevel = newLevel;

      // Set side effects flag if downgraded to Impure
      if (newLevel === PurityLevel.Impure) {
        info.hasSideEffects = true;
      }
    }
  }

  /**
   * Get purity level rank (higher = less pure)
   *
   * @param level - Purity level
   * @returns Numeric rank
   */
  protected getPurityRank(level: PurityLevel): number {
    switch (level) {
      case PurityLevel.Pure:
        return 0;
      case PurityLevel.ReadOnly:
        return 1;
      case PurityLevel.LocalEffects:
        return 2;
      case PurityLevel.Impure:
        return 3;
      default:
        return 3;
    }
  }

  /**
   * Propagate impurity through call graph
   *
   * If function A calls function B, and B is impure, then A is also impure.
   * Iterate until fixpoint reached.
   */
  protected propagateImpurity(): void {
    let changed = true;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const [, info] of this.functionInfo) {
        for (const calleeName of info.calledFunctions) {
          const calleeInfo = this.functionInfo.get(calleeName);
          if (!calleeInfo) continue; // External function, conservatively assume impure

          // Propagate purity level
          const currentRank = this.getPurityRank(info.purityLevel);
          const calleeRank = this.getPurityRank(calleeInfo.purityLevel);

          if (calleeRank > currentRank) {
            info.purityLevel = calleeInfo.purityLevel;
            if (calleeInfo.hasSideEffects) {
              info.hasSideEffects = true;
            }
            changed = true;
          }

          // Propagate written/read locations
          for (const loc of calleeInfo.writtenLocations) {
            if (!info.writtenLocations.has(loc)) {
              info.writtenLocations.add(loc);
              changed = true;
            }
          }
          for (const loc of calleeInfo.readLocations) {
            if (!info.readLocations.has(loc)) {
              info.readLocations.add(loc);
              changed = true;
            }
          }
        }
      }
    }

    if (iterations >= maxIterations) {
      this.diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.WARNING,
        message: 'Purity analysis fixpoint iteration limit reached. Results may be incomplete.',
        location: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 0, line: 1, column: 1 },
        },
      });
    }
  }

  /**
   * Attach purity metadata to AST nodes
   *
   * @param _ast - Program AST (unused but kept for consistency)
   */
  protected attachMetadata(_ast: Program): void {
    for (const [, info] of this.functionInfo) {
      const decl = info.declaration;

      if (!decl.metadata) {
        decl.metadata = new Map();
      }

      // Attach purity level
      decl.metadata.set(OptimizationMetadataKey.PurityLevel, info.purityLevel);

      // Attach side effects flag
      decl.metadata.set(OptimizationMetadataKey.PurityHasSideEffects, info.hasSideEffects);

      // Attach is-pure flag (convenience)
      decl.metadata.set(OptimizationMetadataKey.PurityIsPure, info.purityLevel === PurityLevel.Pure);

      // Attach written locations
      if (info.writtenLocations.size > 0) {
        decl.metadata.set(OptimizationMetadataKey.PurityWrittenLocations, info.writtenLocations);
      }

      // Attach called functions
      if (info.calledFunctions.size > 0) {
        decl.metadata.set(OptimizationMetadataKey.PurityCalledFunctions, info.calledFunctions);
      }
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