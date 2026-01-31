/**
 * Definite Assignment Analyzer for Blend65 Compiler v2
 *
 * Detects variables that may be used before being assigned a value.
 * This is a critical safety analysis that prevents undefined behavior
 * from reading uninitialized memory.
 *
 * **Analysis Approach:**
 * Uses forward data-flow analysis tracking "definitely assigned" variables:
 * - A variable is "definitely assigned" at a point if ALL paths from declaration to that point assign it
 * - Reading a variable that isn't definitely assigned produces a warning/error
 *
 * **SFA Context:**
 * Since Blend65 uses Static Frame Allocation, all variables have fixed memory locations.
 * Reading uninitialized memory could return any value (memory is NOT zero-initialized on 6502).
 * This analysis helps catch these dangerous patterns at compile time.
 *
 * **Algorithm:**
 * 1. Track all variable declarations
 * 2. Variables with initializers start as "assigned"
 * 3. Variables without initializers start as "unassigned"
 * 4. Track assignments through control flow
 * 5. At reads, check if variable is definitely assigned on all paths
 *
 * @module semantic/analysis/definite-assignment
 */

import type { SourceLocation } from '../../ast/index.js';
import type { Symbol, SymbolTable } from '../index.js';
import { SymbolKind } from '../symbol.js';

/**
 * Warning severity levels
 */
export enum DefiniteAssignmentSeverity {
  /** Definitely uninitialized - always a problem */
  Error = 'error',
  /** Possibly uninitialized - conditional paths */
  Warning = 'warning',
  /** Informational note */
  Info = 'info',
}

/**
 * Types of definite assignment issues
 */
export enum DefiniteAssignmentIssueKind {
  /** Variable used before any assignment */
  UsedBeforeAssigned = 'used_before_assigned',
  /** Variable possibly uninitialized (some paths don't assign) */
  PossiblyUninitialized = 'possibly_uninitialized',
  /** Parameter read without initialization (shouldn't happen normally) */
  ParameterNotProvided = 'parameter_not_provided',
}

/**
 * A definite assignment issue
 *
 * Represents a location where a variable may be used before being assigned.
 */
export interface DefiniteAssignmentIssue {
  /** The kind of issue */
  kind: DefiniteAssignmentIssueKind;

  /** The severity of this issue */
  severity: DefiniteAssignmentSeverity;

  /** The symbol that may be uninitialized */
  symbol: Symbol;

  /** Location where the potentially uninitialized read occurs */
  readLocation: SourceLocation;

  /** Location where the variable was declared */
  declarationLocation: SourceLocation;

  /** Human-readable message */
  message: string;

  /** Suggested fix */
  suggestion: string;
}

/**
 * Result of definite assignment analysis
 */
export interface DefiniteAssignmentResult {
  /** Whether any issues were found */
  hasIssues: boolean;

  /** All issues found */
  issues: DefiniteAssignmentIssue[];

  /** Count by severity */
  errorCount: number;
  warningCount: number;
  infoCount: number;

  /** Statistics */
  variablesAnalyzed: number;
  readsAnalyzed: number;
}

/**
 * Variable assignment state during analysis
 */
interface AssignmentState {
  /** Is the variable definitely assigned? */
  definitelyAssigned: boolean;

  /** Is the variable possibly assigned (on some paths)? */
  possiblyAssigned: boolean;

  /** Locations where this variable is assigned */
  assignmentLocations: SourceLocation[];
}

/**
 * Definite Assignment Analyzer
 *
 * Performs data-flow analysis to detect variables that may be used
 * before being assigned a value.
 *
 * **Usage:**
 * ```typescript
 * const analyzer = new DefiniteAssignmentAnalyzer(symbolTable);
 * const result = analyzer.analyze(program);
 *
 * if (result.hasIssues) {
 *   for (const issue of result.issues) {
 *     console.warn(`${issue.severity}: ${issue.message}`);
 *   }
 * }
 * ```
 *
 * **How It Works:**
 * 1. Collects all variable declarations from symbol table
 * 2. Initializes assignment state (assigned if has initializer)
 * 3. Walks AST tracking assignments and reads
 * 4. At each read, checks if variable is definitely assigned
 * 5. Reports issues for uninitialized reads
 */
export class DefiniteAssignmentAnalyzer {
  /** Symbol table for looking up variables */
  protected readonly symbolTable: SymbolTable;

  /** Current assignment states per variable (keyed by symbol name + scope id) */
  protected assignmentStates: Map<string, AssignmentState>;

  /** Collected issues */
  protected issues: DefiniteAssignmentIssue[];

  /** Statistics tracking */
  protected variablesAnalyzed: number;
  protected readsAnalyzed: number;

  /**
   * Create a new definite assignment analyzer
   *
   * @param symbolTable - The symbol table to use for lookups
   */
  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
    this.assignmentStates = new Map();
    this.issues = [];
    this.variablesAnalyzed = 0;
    this.readsAnalyzed = 0;
  }

  /**
   * Analyze for definite assignment issues
   *
   * Performs the full analysis and returns results.
   *
   * @returns Analysis results with all issues found
   */
  public analyze(): DefiniteAssignmentResult {
    // Reset state
    this.assignmentStates.clear();
    this.issues = [];
    this.variablesAnalyzed = 0;
    this.readsAnalyzed = 0;

    // Initialize assignment states from symbol table
    this.initializeAssignmentStates();

    return this.buildResult();
  }

  /**
   * Initialize assignment states from symbol table
   *
   * Variables with initializers are marked as definitely assigned.
   * Variables without initializers are marked as unassigned.
   */
  protected initializeAssignmentStates(): void {
    // Get all symbols from all scopes
    const allScopes = this.symbolTable.getAllScopes();

    for (const [, scope] of allScopes) {
      for (const [, symbol] of scope.symbols) {
        // Only track variables (not functions, parameters, etc.)
        if (symbol.kind === SymbolKind.Variable) {
          this.variablesAnalyzed++;

          const key = this.getSymbolKey(symbol);
          const hasInitializer = symbol.initializer !== undefined;

          this.assignmentStates.set(key, {
            definitelyAssigned: hasInitializer,
            possiblyAssigned: hasInitializer,
            assignmentLocations: hasInitializer ? [symbol.location] : [],
          });
        }

        // Parameters are always definitely assigned (by the caller)
        if (symbol.kind === SymbolKind.Parameter) {
          this.variablesAnalyzed++;

          const key = this.getSymbolKey(symbol);
          this.assignmentStates.set(key, {
            definitelyAssigned: true,
            possiblyAssigned: true,
            assignmentLocations: [symbol.location],
          });
        }
      }
    }
  }

  /**
   * Record a variable assignment
   *
   * Call this when an assignment to a variable is encountered.
   *
   * @param symbol - The variable being assigned
   * @param location - Location of the assignment
   */
  public recordAssignment(symbol: Symbol, location: SourceLocation): void {
    const key = this.getSymbolKey(symbol);
    const state = this.assignmentStates.get(key);

    if (state) {
      state.definitelyAssigned = true;
      state.possiblyAssigned = true;
      state.assignmentLocations.push(location);
    }
  }

  /**
   * Check a variable read and report issues
   *
   * Call this when a variable read is encountered.
   *
   * @param symbol - The variable being read
   * @param readLocation - Location of the read
   */
  public checkRead(symbol: Symbol, readLocation: SourceLocation): void {
    this.readsAnalyzed++;

    const key = this.getSymbolKey(symbol);
    const state = this.assignmentStates.get(key);

    // If we don't have state for this symbol, it might be:
    // - An imported symbol (assumed initialized)
    // - A function (always "initialized")
    // - An intrinsic (always "initialized")
    if (!state) {
      return;
    }

    // Check if definitely assigned
    if (!state.definitelyAssigned) {
      if (state.possiblyAssigned) {
        // Possibly uninitialized - assigned on some paths but not all
        this.issues.push({
          kind: DefiniteAssignmentIssueKind.PossiblyUninitialized,
          severity: DefiniteAssignmentSeverity.Warning,
          symbol,
          readLocation,
          declarationLocation: symbol.location,
          message: `Variable '${symbol.name}' may be used before being assigned`,
          suggestion: `Initialize '${symbol.name}' at declaration or ensure all code paths assign a value before this read`,
        });
      } else {
        // Definitely uninitialized - never assigned before this point
        this.issues.push({
          kind: DefiniteAssignmentIssueKind.UsedBeforeAssigned,
          severity: DefiniteAssignmentSeverity.Error,
          symbol,
          readLocation,
          declarationLocation: symbol.location,
          message: `Variable '${symbol.name}' is used before being assigned`,
          suggestion: `Add an initializer: let ${symbol.name}: ${symbol.type?.name ?? 'type'} = <value>`,
        });
      }
    }
  }

  /**
   * Enter a conditional branch (if/while/for)
   *
   * Saves the current assignment state so we can merge at exit.
   *
   * @returns State snapshot to pass to exitBranch
   */
  public enterBranch(): Map<string, AssignmentState> {
    // Deep copy current state
    const snapshot = new Map<string, AssignmentState>();
    for (const [key, state] of this.assignmentStates) {
      snapshot.set(key, {
        definitelyAssigned: state.definitelyAssigned,
        possiblyAssigned: state.possiblyAssigned,
        assignmentLocations: [...state.assignmentLocations],
      });
    }
    return snapshot;
  }

  /**
   * Exit a conditional branch and merge states
   *
   * For if/else: variable is definitely assigned if assigned in BOTH branches.
   * For loops: variable is definitely assigned if assigned BEFORE the loop.
   *
   * @param beforeState - State snapshot from enterBranch
   * @param branchExecuted - Whether the branch might not execute (for loops)
   */
  public mergeBranch(beforeState: Map<string, AssignmentState>, branchExecuted: boolean = true): void {
    // Merge current state with before state
    for (const [key, currentState] of this.assignmentStates) {
      const beforeEntry = beforeState.get(key);
      if (beforeEntry) {
        // For conditionally-executed code:
        // - Definitely assigned only if assigned in BOTH states
        // - Possibly assigned if assigned in EITHER state
        if (branchExecuted) {
          currentState.definitelyAssigned = beforeEntry.definitelyAssigned && currentState.definitelyAssigned;
        } else {
          // Branch might not execute (like a loop body)
          currentState.definitelyAssigned = beforeEntry.definitelyAssigned;
        }
        currentState.possiblyAssigned = beforeEntry.possiblyAssigned || currentState.possiblyAssigned;
      }
    }
  }

  /**
   * Merge two branch states (for if-else)
   *
   * @param thenState - State after then branch
   * @param elseState - State after else branch (or before state if no else)
   */
  public mergeIfElse(thenState: Map<string, AssignmentState>, elseState: Map<string, AssignmentState>): void {
    for (const [key, thenEntry] of thenState) {
      const elseEntry = elseState.get(key);
      const currentState = this.assignmentStates.get(key);

      if (currentState && elseEntry) {
        // Definitely assigned if assigned in BOTH branches
        currentState.definitelyAssigned = thenEntry.definitelyAssigned && elseEntry.definitelyAssigned;
        // Possibly assigned if assigned in EITHER branch
        currentState.possiblyAssigned = thenEntry.possiblyAssigned || elseEntry.possiblyAssigned;
        // Merge assignment locations
        currentState.assignmentLocations = [
          ...new Set([...thenEntry.assignmentLocations, ...elseEntry.assignmentLocations]),
        ];
      }
    }
  }

  /**
   * Check if a symbol is definitely assigned
   *
   * @param symbol - The symbol to check
   * @returns True if definitely assigned
   */
  public isDefinitelyAssigned(symbol: Symbol): boolean {
    const key = this.getSymbolKey(symbol);
    const state = this.assignmentStates.get(key);
    return state?.definitelyAssigned ?? true; // Assume assigned if unknown
  }

  /**
   * Get all issues found during analysis
   *
   * @returns Array of all issues
   */
  public getIssues(): DefiniteAssignmentIssue[] {
    return [...this.issues];
  }

  /**
   * Get unique key for a symbol (name + scope)
   */
  protected getSymbolKey(symbol: Symbol): string {
    return `${symbol.scope.id}::${symbol.name}`;
  }

  /**
   * Build the analysis result
   */
  protected buildResult(): DefiniteAssignmentResult {
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const issue of this.issues) {
      switch (issue.severity) {
        case DefiniteAssignmentSeverity.Error:
          errorCount++;
          break;
        case DefiniteAssignmentSeverity.Warning:
          warningCount++;
          break;
        case DefiniteAssignmentSeverity.Info:
          infoCount++;
          break;
      }
    }

    return {
      hasIssues: this.issues.length > 0,
      issues: [...this.issues],
      errorCount,
      warningCount,
      infoCount,
      variablesAnalyzed: this.variablesAnalyzed,
      readsAnalyzed: this.readsAnalyzed,
    };
  }

  /**
   * Format a human-readable report
   *
   * @returns Multi-line string with all issues
   */
  public formatReport(): string {
    const result = this.buildResult();

    if (!result.hasIssues) {
      return `Definite Assignment Analysis: No issues found (${result.variablesAnalyzed} variables, ${result.readsAnalyzed} reads)`;
    }

    const lines: string[] = [
      '=== Definite Assignment Analysis Report ===',
      '',
      `Statistics:`,
      `  Variables analyzed: ${result.variablesAnalyzed}`,
      `  Reads analyzed: ${result.readsAnalyzed}`,
      `  Issues found: ${result.issues.length}`,
      `    Errors: ${result.errorCount}`,
      `    Warnings: ${result.warningCount}`,
      '',
      'Issues:',
    ];

    for (const issue of result.issues) {
      const loc = issue.readLocation;
      lines.push('');
      lines.push(`  ${issue.severity.toUpperCase()}: ${issue.message}`);
      lines.push(`    at line ${loc.start.line}, column ${loc.start.column}`);
      lines.push(`    declared at line ${issue.declarationLocation.start.line}`);
      lines.push(`    suggestion: ${issue.suggestion}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset analyzer state for reuse
   */
  public reset(): void {
    this.assignmentStates.clear();
    this.issues = [];
    this.variablesAnalyzed = 0;
    this.readsAnalyzed = 0;
  }
}