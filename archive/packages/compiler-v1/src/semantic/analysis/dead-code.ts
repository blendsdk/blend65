/**
 * Dead Code Detection (Task 8.4)
 *
 * Analyzes code to detect:
 * - Unreachable statements (after return, in unreachable branches)
 * - Unreachable branches (constant if conditions)
 * - Dead stores (variable writes that are never read)
 * - Unused results (expression results that are discarded)
 *
 * **Algorithm:**
 * 1. Use Control Flow Graph (CFG) to detect unreachable statements
 * 2. Analyze constant branch conditions to find unreachable branches
 * 3. Track variable usage to find dead stores
 * 4. Find expression statements with unused results
 * 5. Set metadata for optimizer hints
 * 6. Emit warnings for removable dead code
 *
 * **Metadata Generated:**
 * - `DeadCodeUnreachable`: Statement is unreachable (boolean)
 * - `DeadCodeKind`: Type of dead code (DeadCodeKind enum)
 * - `DeadCodeReason`: Why this code is dead (string)
 * - `DeadCodeRemovable`: Can this code be safely removed? (boolean)
 */

import type { Program, IfStatement, FunctionDecl } from '../../ast/nodes.js';
import type { Statement } from '../../ast/base.js';
import type { SymbolTable } from '../symbol-table.js';
import type { ControlFlowGraph, CFGNode } from '../control-flow.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import { ASTWalker } from '../../ast/walker/base.js';
import { OptimizationMetadataKey, DeadCodeKind } from './optimization-metadata-keys.js';
import { isReturnStatement, isBreakStatement, isContinueStatement, isLiteralExpression } from '../../ast/type-guards.js';

/**
 * Dead code information
 *
 * Tracks details about detected dead code.
 */
interface DeadCodeInfo {
  /** Type of dead code */
  kind: DeadCodeKind;

  /** Reason why this code is dead */
  reason: string;

  /** Can this code be safely removed? */
  removable: boolean;

  /** Associated statement node */
  statement: Statement;
}

/**
 * Dead Code Analyzer
 *
 * Detects various forms of dead code:
 * 1. Unreachable statements (via CFG analysis)
 * 2. Unreachable branches (constant conditions)
 * 3. Dead stores (write-only variables)
 * 4. Unused expression results
 *
 * Sets metadata on AST nodes for optimizer consumption.
 *
 * @example
 * ```typescript
 * const analyzer = new DeadCodeAnalyzer(symbolTable, cfgs, typeSystem);
 * analyzer.analyze(ast);
 * const diagnostics = analyzer.getDiagnostics();
 * ```
 */
export class DeadCodeAnalyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Detected dead code entries */
  protected deadCode: DeadCodeInfo[] = [];

  /**
   * Create dead code analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   * @param cfgs - Control flow graphs from Pass 5
   * @param typeSystem - Type system (for future constant evaluation)
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly cfgs: Map<string, ControlFlowGraph>,
    protected readonly typeSystem: any
  ) {}

  /**
   * Run dead code analysis on entire program
   *
   * Detects all forms of dead code:
   * - Unreachable statements
   * - Unreachable branches
   * - Dead stores
   * - Unused results
   *
   * Sets metadata on statements for optimizer.
   *
   * @param ast - Program AST
   */
  public analyze(ast: Program): void {
    // Step 1: Detect unreachable statements using CFG
    this.detectUnreachableStatements();

    // Step 2: Detect unreachable branches (constant conditions)
    this.detectUnreachableBranches(ast);

    // Step 3: Detect dead stores (write-only variables)
    this.detectDeadStores(ast);

    // Step 4: Set metadata on all detected dead code
    this.setDeadCodeMetadata();

    // Step 5: Generate warnings
    this.generateDiagnostics();
  }

  /**
   * Detect unreachable statements using CFG
   *
   * Uses control flow graph reachability analysis to find
   * statements that can never be executed.
   *
   * **Strategy:**
   * The CFG only tracks control flow statements (return, if, while, etc.),
   * not variable declarations or expression statements. So we can't rely
   * on CFG node.statement references to find ALL unreachable statements.
   *
   * Instead, we:
   * 1. Walk function bodies to find control flow terminators (return, break, continue)
   * 2. Mark ALL statements after terminators as unreachable
   * 3. Use CFG to detect unreachable branches
   *
   * **Examples:**
   * - Code after return statement
   * - Code in unreachable branches
   * - Disconnected code blocks
   */
  protected detectUnreachableStatements(): void {
    for (const [funcName, cfg] of this.cfgs) {
      // Ensure reachability is computed
      cfg.computeReachability();

      // Find the function declaration in the symbol table
      const funcSymbol = this.symbolTable.lookup(funcName);
      if (funcSymbol && funcSymbol.declaration) {
        const funcDecl = funcSymbol.declaration as FunctionDecl;
        const body = funcDecl.getBody();

        if (body) {
          // Walk through function body statements
          let foundUnreachable = false;

          for (const stmt of body) {
            // If we've already found an unreachable point, this statement is unreachable
            if (foundUnreachable) {
              this.deadCode.push({
                kind: DeadCodeKind.UnreachableStatement,
                reason: 'Control flow never reaches this statement',
                removable: true,
                statement: stmt,
              });
            }

            // Check if this statement makes subsequent code unreachable
            // Return statements always make subsequent code unreachable
            if (isReturnStatement(stmt)) {
              foundUnreachable = true;
            }
            // Break/continue also make subsequent code unreachable (in loop context)
            else if (isBreakStatement(stmt) || isContinueStatement(stmt)) {
              foundUnreachable = true;
            }
          }
        }
      }
    }
  }

  /**
   * Get reason why a CFG node is unreachable
   *
   * Analyzes predecessors to determine why this node cannot be reached.
   *
   * @param node - Unreachable CFG node
   * @returns Human-readable reason
   */
  protected getUnreachabilityReason(node: CFGNode): string {
    // Check if there are no predecessors (disconnected code)
    if (node.predecessors.length === 0) {
      return 'Code is disconnected from function entry';
    }

    // Check if all predecessors are returns
    const allPredecessorsReturn = node.predecessors.every(pred => pred.kind === 'Return');
    if (allPredecessorsReturn) {
      return 'Code follows return statement';
    }

    // Check if all predecessors are breaks
    const allPredecessorsBreak = node.predecessors.every(pred => pred.kind === 'Break');
    if (allPredecessorsBreak) {
      return 'Code follows break statement';
    }

    // Generic unreachable
    return 'Control flow never reaches this statement';
  }

  /**
   * Detect unreachable branches in if statements
   *
   * Analyzes if statement conditions to find branches that
   * can never execute due to constant conditions.
   *
   * **Example:**
   * ```blend
   * if false then
   *   // This branch is unreachable
   * end if
   * ```
   *
   * **Note:** This is a placeholder for future constant evaluation.
   * Full implementation requires Tier 2 constant propagation analysis.
   */
  protected detectUnreachableBranches(ast: Program): void {
    // Walk AST to find if statements
    const detector = new UnreachableBranchDetector(this.deadCode);
    detector.walk(ast);
  }

  /**
   * Detect dead stores (write-only variables)
   *
   * Finds variable assignments where the written value is
   * never read before being overwritten or going out of scope.
   *
   * **Example:**
   * ```blend
   * let x: byte = 5;
   * x = 10;  // Dead store if x is never read
   * x = 20;
   * ```
   *
   * **Note:** This uses metadata from Task 8.2 (Variable Usage Analysis).
   * A write-only variable indicates all its stores are dead.
   *
   * **Current Status:** Dead store detection is not yet implemented.
   * This will be completed in future enhancements when parent node
   * traversal is available in the AST walker.
   */
  protected detectDeadStores(_ast: Program): void {
    // TODO: Implement dead store detection
    // Requires parent node tracking to find containing ExpressionStatement
    // for AssignmentExpression nodes
  }

  /**
   * Set metadata on all detected dead code
   *
   * For each dead code entry, sets:
   * - DeadCodeUnreachable flag
   * - DeadCodeKind classification
   * - DeadCodeReason explanation
   * - DeadCodeRemovable safety flag
   */
  protected setDeadCodeMetadata(): void {
    for (const info of this.deadCode) {
      const stmt = info.statement;

      // Ensure metadata map exists
      if (!stmt.metadata) {
        stmt.metadata = new Map();
      }

      // Set dead code metadata
      stmt.metadata.set(OptimizationMetadataKey.DeadCodeUnreachable, true);
      stmt.metadata.set(OptimizationMetadataKey.DeadCodeKind, info.kind);
      stmt.metadata.set(OptimizationMetadataKey.DeadCodeReason, info.reason);
      stmt.metadata.set(OptimizationMetadataKey.DeadCodeRemovable, info.removable);
    }
  }

  /**
   * Generate diagnostics for dead code
   *
   * Emits WARNING diagnostics for:
   * - Unreachable statements
   * - Unreachable branches
   * - Dead stores (optional, may be intentional)
   *
   * **Note:** Dead stores are currently not warned about
   * as they may be intentional (e.g., clearing sensitive data).
   */
  protected generateDiagnostics(): void {
    for (const info of this.deadCode) {
      // Only warn about unreachable statements and branches
      // Dead stores may be intentional, so we skip warnings for now
      if (
        info.kind === DeadCodeKind.UnreachableStatement ||
        info.kind === DeadCodeKind.UnreachableBranch
      ) {
        this.diagnostics.push({
          code: DiagnosticCode.TYPE_MISMATCH, // Generic semantic warning
          severity: DiagnosticSeverity.WARNING,
          message: `Unreachable code detected: ${info.reason}`,
          location: info.statement.getLocation(),
        });
      }
    }
  }

  /**
   * Get all diagnostics from analysis
   *
   * @returns Array of diagnostics (warnings for dead code)
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }
}

/**
 * Walker to detect unreachable branches
 *
 * Finds if statements with constant conditions where one branch
 * can never be reached.
 *
 * **Future Enhancement:** This currently only handles literal
 * boolean conditions. Full implementation requires constant
 * propagation from Tier 2.
 */
class UnreachableBranchDetector extends ASTWalker {
  /**
   * Create unreachable branch detector
   *
   * @param deadCode - Array to populate with dead code entries
   */
  constructor(protected readonly deadCode: DeadCodeInfo[]) {
    super();
  }

  /**
   * Visit if statement
   *
   * Check if condition is a constant boolean literal.
   * If so, one branch is unreachable.
   */
  public visitIfStatement(node: IfStatement): void {
    // First traverse children (to mark nested dead code)
    super.visitIfStatement(node);

    // Check if condition is a constant boolean literal
    const condition = node.getCondition();

    // Handle literal boolean
    if (isLiteralExpression(condition)) {
      const value = condition.getValue();

      // Check if the value is a boolean
      if (typeof value === 'boolean' && value === false) {
        // Then branch is unreachable - mark each statement
        const thenBranch = node.getThenBranch();
        for (const stmt of thenBranch) {
          this.deadCode.push({
            kind: DeadCodeKind.UnreachableBranch,
            reason: 'If condition is always false',
            removable: true,
            statement: stmt,
          });
        }
      } else if (typeof value === 'boolean' && value === true) {
        // Else branch is unreachable (if it exists) - mark each statement
        const elseBranch = node.getElseBranch();
        if (elseBranch) {
          for (const stmt of elseBranch) {
            this.deadCode.push({
              kind: DeadCodeKind.UnreachableBranch,
              reason: 'If condition is always true',
              removable: true,
              statement: stmt,
            });
          }
        }
      }
    }
  }
}