/**
 * Dead Code Analyzer for Blend65 Compiler v2
 *
 * Detects unreachable code in functions by analyzing control flow graphs.
 * Dead code can indicate:
 * - Accidental code placement after return/break/continue
 * - Conditions that are always true/false
 * - Incomplete refactoring
 *
 * **Analysis Approach:**
 * Uses the CFG built by ControlFlowAnalyzer to identify statements that
 * cannot be reached from the function entry point.
 *
 * **Types of Dead Code Detected:**
 * - Code after return statements
 * - Code after break statements in loops
 * - Code after continue statements in loops
 * - Code in unreachable branches (e.g., after infinite loops)
 *
 * **SFA Context:**
 * Dead code doesn't affect correctness in Blend65, but it wastes
 * precious ROM space on the 6502. Detecting it helps optimize binaries.
 *
 * @module semantic/analysis/dead-code
 */

import type { SourceLocation, Statement } from '../../ast/index.js';
import type { ControlFlowGraph, CFGNode } from '../control-flow.js';
import { CFGNodeKind } from '../control-flow.js';

/**
 * Severity levels for dead code issues
 */
export enum DeadCodeSeverity {
  /** Definite dead code - should be removed */
  Warning = 'warning',
  /** Potentially dead code - needs review */
  Info = 'info',
}

/**
 * Types of dead code issues
 */
export enum DeadCodeIssueKind {
  /** Code unreachable after return statement */
  AfterReturn = 'after_return',
  /** Code unreachable after break statement */
  AfterBreak = 'after_break',
  /** Code unreachable after continue statement */
  AfterContinue = 'after_continue',
  /** Code unreachable due to control flow (general) */
  Unreachable = 'unreachable',
  /** Unreachable branch in conditional */
  UnreachableBranch = 'unreachable_branch',
}

/**
 * A dead code issue
 *
 * Represents a location in the code that cannot be reached during execution.
 */
export interface DeadCodeIssue {
  /** The kind of dead code */
  kind: DeadCodeIssueKind;

  /** The severity of this issue */
  severity: DeadCodeSeverity;

  /** The unreachable statement */
  statement: Statement;

  /** Location of the unreachable code */
  location: SourceLocation;

  /** Human-readable message */
  message: string;

  /** Suggested fix */
  suggestion: string;

  /** The function containing this dead code */
  functionName: string;

  /** If caused by a terminating statement, what kind */
  causedBy?: 'return' | 'break' | 'continue' | 'infinite_loop';
}

/**
 * Result of dead code analysis
 */
export interface DeadCodeResult {
  /** Whether any dead code was found */
  hasIssues: boolean;

  /** All dead code issues found */
  issues: DeadCodeIssue[];

  /** Statistics */
  functionsAnalyzed: number;
  totalStatements: number;
  deadStatements: number;
  deadCodePercentage: number;

  /** Issues grouped by function */
  issuesByFunction: Map<string, DeadCodeIssue[]>;
}

/**
 * Dead Code Analyzer
 *
 * Analyzes control flow graphs to detect unreachable code.
 *
 * **Usage:**
 * ```typescript
 * const analyzer = new DeadCodeAnalyzer();
 *
 * // Analyze a single function's CFG
 * analyzer.analyzeFunction(cfg, 'myFunction');
 *
 * // Get results
 * const result = analyzer.getResult();
 *
 * if (result.hasIssues) {
 *   for (const issue of result.issues) {
 *     console.warn(`${issue.severity}: ${issue.message}`);
 *   }
 * }
 * ```
 *
 * **Integration:**
 * This analyzer is typically used after CFG construction in the semantic
 * analysis pipeline. It receives CFGs from ControlFlowAnalyzer.
 *
 * **How It Works:**
 * 1. Takes a completed CFG with reachability computed
 * 2. Finds all unreachable nodes with associated statements
 * 3. Determines the cause (return, break, continue, etc.)
 * 4. Reports issues with helpful context
 */
export class DeadCodeAnalyzer {
  /** Collected issues across all functions */
  protected issues: DeadCodeIssue[];

  /** Statistics tracking */
  protected functionsAnalyzed: number;
  protected totalStatements: number;
  protected deadStatements: number;

  /** Issues grouped by function */
  protected issuesByFunction: Map<string, DeadCodeIssue[]>;

  /**
   * Create a new dead code analyzer
   */
  constructor() {
    this.issues = [];
    this.functionsAnalyzed = 0;
    this.totalStatements = 0;
    this.deadStatements = 0;
    this.issuesByFunction = new Map();
  }

  /**
   * Analyze a function's CFG for dead code
   *
   * The CFG must have reachability already computed.
   *
   * @param cfg - The control flow graph to analyze
   * @param functionName - Name of the function (for error messages)
   */
  public analyzeFunction(cfg: ControlFlowGraph, functionName: string): void {
    this.functionsAnalyzed++;

    // Get all statement nodes
    const statementNodes = cfg.getStatementNodes();
    this.totalStatements += statementNodes.length;

    // Get unreachable nodes
    const unreachableNodes = cfg.getUnreachableNodes();

    // Process each unreachable node
    for (const node of unreachableNodes) {
      if (node.statement) {
        this.deadStatements++;
        const issue = this.createIssue(node, functionName, cfg);
        this.issues.push(issue);

        // Group by function
        const functionIssues = this.issuesByFunction.get(functionName) ?? [];
        functionIssues.push(issue);
        this.issuesByFunction.set(functionName, functionIssues);
      }
    }
  }

  /**
   * Analyze multiple functions
   *
   * Convenience method for analyzing a map of CFGs.
   *
   * @param cfgs - Map of function names to their CFGs
   */
  public analyzeFunctions(cfgs: Map<string, ControlFlowGraph>): void {
    for (const [functionName, cfg] of cfgs) {
      this.analyzeFunction(cfg, functionName);
    }
  }

  /**
   * Create an issue for an unreachable node
   *
   * Determines the cause of unreachability and creates appropriate message.
   *
   * @param node - The unreachable CFG node
   * @param functionName - Name of the containing function
   * @param cfg - The control flow graph
   * @returns The dead code issue
   */
  protected createIssue(
    node: CFGNode,
    functionName: string,
    cfg: ControlFlowGraph
  ): DeadCodeIssue {
    const statement = node.statement!;
    const location = statement.getLocation();

    // Try to determine what caused this code to be unreachable
    const cause = this.findCause(node, cfg);

    // Create issue based on cause
    switch (cause.kind) {
      case 'return':
        return {
          kind: DeadCodeIssueKind.AfterReturn,
          severity: DeadCodeSeverity.Warning,
          statement,
          location,
          message: `Unreachable code after return statement in '${functionName}'`,
          suggestion: 'Remove the unreachable code or move it before the return statement',
          functionName,
          causedBy: 'return',
        };

      case 'break':
        return {
          kind: DeadCodeIssueKind.AfterBreak,
          severity: DeadCodeSeverity.Warning,
          statement,
          location,
          message: `Unreachable code after break statement in '${functionName}'`,
          suggestion: 'Remove the unreachable code or move it before the break statement',
          functionName,
          causedBy: 'break',
        };

      case 'continue':
        return {
          kind: DeadCodeIssueKind.AfterContinue,
          severity: DeadCodeSeverity.Warning,
          statement,
          location,
          message: `Unreachable code after continue statement in '${functionName}'`,
          suggestion: 'Remove the unreachable code or move it before the continue statement',
          functionName,
          causedBy: 'continue',
        };

      case 'infinite_loop':
        return {
          kind: DeadCodeIssueKind.Unreachable,
          severity: DeadCodeSeverity.Warning,
          statement,
          location,
          message: `Unreachable code after infinite loop in '${functionName}'`,
          suggestion: 'Add a break condition to the loop or remove the unreachable code',
          functionName,
          causedBy: 'infinite_loop',
        };

      default:
        return {
          kind: DeadCodeIssueKind.Unreachable,
          severity: DeadCodeSeverity.Warning,
          statement,
          location,
          message: `Unreachable code detected in '${functionName}'`,
          suggestion: 'Review the control flow and remove or restructure the unreachable code',
          functionName,
        };
    }
  }

  /**
   * Find what caused a node to be unreachable
   *
   * Looks at predecessors and the overall CFG structure to determine
   * the likely cause of unreachability.
   *
   * @param node - The unreachable node
   * @param cfg - The control flow graph
   * @returns The probable cause
   */
  protected findCause(
    node: CFGNode,
    cfg: ControlFlowGraph
  ): { kind: 'return' | 'break' | 'continue' | 'infinite_loop' | 'unknown' } {
    // Look for terminating nodes that might have caused this
    // by examining nearby reachable nodes
    for (const cfgNode of cfg.getNodes()) {
      if (!cfgNode.reachable) continue;

      // Check if this reachable node terminates control flow
      if (cfgNode.kind === CFGNodeKind.Return) {
        // Check if the unreachable node would logically follow
        if (this.wouldFollow(cfgNode, node, cfg)) {
          return { kind: 'return' };
        }
      }

      if (cfgNode.kind === CFGNodeKind.Break) {
        if (this.wouldFollow(cfgNode, node, cfg)) {
          return { kind: 'break' };
        }
      }

      if (cfgNode.kind === CFGNodeKind.Continue) {
        if (this.wouldFollow(cfgNode, node, cfg)) {
          return { kind: 'continue' };
        }
      }
    }

    // Check for infinite loops
    // (A loop node that's reachable but doesn't connect to exit)
    for (const cfgNode of cfg.getNodes()) {
      if (cfgNode.kind === CFGNodeKind.Loop && cfgNode.reachable) {
        // Check if this is an infinite loop (no path to node after it)
        const loopSuccessorsReachable = cfgNode.successors.some(
          s => s.reachable && s.kind !== CFGNodeKind.Loop
        );
        if (!loopSuccessorsReachable) {
          return { kind: 'infinite_loop' };
        }
      }
    }

    return { kind: 'unknown' };
  }

  /**
   * Check if unreachable node would logically follow a terminating node
   *
   * Heuristic based on source locations.
   *
   * @param terminatingNode - The node that terminates control flow
   * @param unreachableNode - The unreachable node
   * @param cfg - The control flow graph
   * @returns True if unreachable node likely follows terminating node
   */
  protected wouldFollow(
    terminatingNode: CFGNode,
    unreachableNode: CFGNode,
    _cfg: ControlFlowGraph
  ): boolean {
    // Use source locations as heuristic
    if (!terminatingNode.statement || !unreachableNode.statement) {
      return false;
    }

    const termLoc = terminatingNode.statement.getLocation();
    const unreachLoc = unreachableNode.statement.getLocation();

    // Unreachable code is "after" if it appears on a later line
    // or on the same line but after the terminating statement
    if (unreachLoc.start.line > termLoc.end.line) {
      return true;
    }
    if (
      unreachLoc.start.line === termLoc.end.line &&
      unreachLoc.start.column > termLoc.end.column
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get all issues found
   *
   * @returns Array of all dead code issues
   */
  public getIssues(): DeadCodeIssue[] {
    return [...this.issues];
  }

  /**
   * Get issues for a specific function
   *
   * @param functionName - Name of the function
   * @returns Array of issues in that function
   */
  public getFunctionIssues(functionName: string): DeadCodeIssue[] {
    return this.issuesByFunction.get(functionName) ?? [];
  }

  /**
   * Get analysis result
   *
   * @returns Complete analysis result
   */
  public getResult(): DeadCodeResult {
    const deadCodePercentage =
      this.totalStatements > 0 ? (this.deadStatements / this.totalStatements) * 100 : 0;

    return {
      hasIssues: this.issues.length > 0,
      issues: [...this.issues],
      functionsAnalyzed: this.functionsAnalyzed,
      totalStatements: this.totalStatements,
      deadStatements: this.deadStatements,
      deadCodePercentage,
      issuesByFunction: new Map(this.issuesByFunction),
    };
  }

  /**
   * Check if any dead code was found
   *
   * @returns True if dead code was detected
   */
  public hasDeadCode(): boolean {
    return this.issues.length > 0;
  }

  /**
   * Get count of dead code issues
   *
   * @returns Number of dead code issues found
   */
  public getDeadCodeCount(): number {
    return this.issues.length;
  }

  /**
   * Format a human-readable report
   *
   * @returns Multi-line string with all issues
   */
  public formatReport(): string {
    const result = this.getResult();

    if (!result.hasIssues) {
      return `Dead Code Analysis: No issues found (${result.functionsAnalyzed} functions, ${result.totalStatements} statements)`;
    }

    const lines: string[] = [
      '=== Dead Code Analysis Report ===',
      '',
      'Statistics:',
      `  Functions analyzed: ${result.functionsAnalyzed}`,
      `  Total statements: ${result.totalStatements}`,
      `  Dead statements: ${result.deadStatements}`,
      `  Dead code: ${result.deadCodePercentage.toFixed(1)}%`,
      '',
      'Issues:',
    ];

    for (const issue of result.issues) {
      const loc = issue.location;
      lines.push('');
      lines.push(`  ${issue.severity.toUpperCase()}: ${issue.message}`);
      lines.push(`    at line ${loc.start.line}, column ${loc.start.column}`);
      if (issue.causedBy) {
        lines.push(`    caused by: ${issue.causedBy}`);
      }
      lines.push(`    suggestion: ${issue.suggestion}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset analyzer state for reuse
   */
  public reset(): void {
    this.issues = [];
    this.functionsAnalyzed = 0;
    this.totalStatements = 0;
    this.deadStatements = 0;
    this.issuesByFunction.clear();
  }
}