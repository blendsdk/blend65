/**
 * Variable Usage Analyzer for Blend65 Compiler v2
 *
 * Detects unused variables and parameters to help keep code clean and catch
 * potential bugs. Unused variables often indicate:
 * - Incomplete implementation (forgot to use a computed value)
 * - Dead code (result of refactoring)
 * - Typos in variable names
 *
 * **Analysis Types:**
 * - Unused variables: Declared but never read
 * - Unused parameters: Function parameters that are never used
 * - Write-only variables: Assigned but never read (different from unused)
 *
 * **Exclusions:**
 * - Exported variables (may be used by other modules)
 * - Variables prefixed with underscore (conventional "intentionally unused" marker)
 * - Loop counters in for loops (often intentionally unused)
 *
 * @module semantic/analysis/variable-usage
 */

import type { SourceLocation } from '../../ast/index.js';
import type { Symbol, SymbolTable } from '../index.js';
import { SymbolKind } from '../symbol.js';

/**
 * Types of variable usage issues
 */
export enum VariableUsageIssueKind {
  /** Variable declared but never used */
  UnusedVariable = 'unused_variable',
  /** Parameter declared but never used */
  UnusedParameter = 'unused_parameter',
  /** Variable assigned but never read */
  WriteOnlyVariable = 'write_only_variable',
  /** Variable read but never assigned (covered by definite assignment) */
  ReadOnlyVariable = 'read_only_variable',
}

/**
 * Severity of variable usage issues
 */
export enum VariableUsageSeverity {
  /** Potential bug - should be addressed */
  Warning = 'warning',
  /** Informational - may be intentional */
  Info = 'info',
}

/**
 * A variable usage issue
 */
export interface VariableUsageIssue {
  /** The kind of issue */
  kind: VariableUsageIssueKind;

  /** The severity of this issue */
  severity: VariableUsageSeverity;

  /** The symbol with the issue */
  symbol: Symbol;

  /** Location of the symbol declaration */
  location: SourceLocation;

  /** Human-readable message */
  message: string;

  /** Suggested fix */
  suggestion: string;
}

/**
 * Result of variable usage analysis
 */
export interface VariableUsageResult {
  /** Whether any issues were found */
  hasIssues: boolean;

  /** All issues found */
  issues: VariableUsageIssue[];

  /** Count by type */
  unusedVariableCount: number;
  unusedParameterCount: number;
  writeOnlyCount: number;

  /** Statistics */
  totalVariables: number;
  totalParameters: number;
  usedVariables: number;
  usedParameters: number;
}

/**
 * Tracks usage of a single symbol
 */
interface UsageInfo {
  /** The symbol being tracked */
  symbol: Symbol;

  /** Number of times the symbol is read */
  readCount: number;

  /** Number of times the symbol is written (assigned) */
  writeCount: number;

  /** Locations where the symbol is read */
  readLocations: SourceLocation[];

  /** Locations where the symbol is written */
  writeLocations: SourceLocation[];

  /** Is this an intentionally unused symbol (prefixed with _)? */
  isIntentionallyUnused: boolean;

  /** Is this symbol exported? */
  isExported: boolean;
}

/**
 * Configuration options for variable usage analysis
 */
export interface VariableUsageOptions {
  /** Report unused variables (default: true) */
  reportUnusedVariables: boolean;

  /** Report unused parameters (default: true) */
  reportUnusedParameters: boolean;

  /** Report write-only variables (default: true) */
  reportWriteOnly: boolean;

  /** Ignore underscore-prefixed variables (default: true) */
  ignoreUnderscorePrefixed: boolean;

  /** Ignore exported symbols (default: true) */
  ignoreExported: boolean;

  /** Ignore loop counter variables (default: false) */
  ignoreLoopCounters: boolean;
}

/**
 * Default configuration options
 */
export const DEFAULT_VARIABLE_USAGE_OPTIONS: VariableUsageOptions = {
  reportUnusedVariables: true,
  reportUnusedParameters: true,
  reportWriteOnly: true,
  ignoreUnderscorePrefixed: true,
  ignoreExported: true,
  ignoreLoopCounters: false,
};

/**
 * Variable Usage Analyzer
 *
 * Tracks variable and parameter usage to detect unused declarations.
 *
 * **Usage:**
 * ```typescript
 * const analyzer = new VariableUsageAnalyzer(symbolTable);
 *
 * // Record reads and writes during AST traversal
 * analyzer.recordRead(symbol, location);
 * analyzer.recordWrite(symbol, location);
 *
 * // Get analysis results
 * const result = analyzer.analyze();
 *
 * if (result.hasIssues) {
 *   for (const issue of result.issues) {
 *     console.warn(`${issue.severity}: ${issue.message}`);
 *   }
 * }
 * ```
 *
 * **Integration:**
 * This analyzer is typically used as part of the semantic analysis pipeline,
 * with reads/writes recorded during the type checking pass.
 */
export class VariableUsageAnalyzer {
  /** Symbol table for looking up all symbols */
  protected readonly symbolTable: SymbolTable;

  /** Configuration options */
  protected readonly options: VariableUsageOptions;

  /** Usage tracking per symbol (keyed by symbol key) */
  protected usageMap: Map<string, UsageInfo>;

  /** Set of loop counter variable keys */
  protected loopCounters: Set<string>;

  /**
   * Create a new variable usage analyzer
   *
   * @param symbolTable - The symbol table to analyze
   * @param options - Configuration options (optional)
   */
  constructor(symbolTable: SymbolTable, options?: Partial<VariableUsageOptions>) {
    this.symbolTable = symbolTable;
    this.options = { ...DEFAULT_VARIABLE_USAGE_OPTIONS, ...options };
    this.usageMap = new Map();
    this.loopCounters = new Set();
  }

  /**
   * Initialize usage tracking from symbol table
   *
   * Must be called before recording reads/writes.
   */
  public initialize(): void {
    this.usageMap.clear();
    this.loopCounters.clear();

    const allScopes = this.symbolTable.getAllScopes();

    for (const [, scope] of allScopes) {
      for (const [, symbol] of scope.symbols) {
        // Track variables and parameters
        if (symbol.kind === SymbolKind.Variable || symbol.kind === SymbolKind.Parameter) {
          const key = this.getSymbolKey(symbol);
          const isIntentionallyUnused = symbol.name.startsWith('_');

          this.usageMap.set(key, {
            symbol,
            readCount: 0,
            writeCount: symbol.initializer !== undefined ? 1 : 0, // Initializer counts as write
            readLocations: [],
            writeLocations: symbol.initializer !== undefined ? [symbol.location] : [],
            isIntentionallyUnused,
            isExported: symbol.isExported,
          });
        }
      }
    }
  }

  /**
   * Record a variable read
   *
   * @param symbol - The symbol being read
   * @param location - Location of the read
   */
  public recordRead(symbol: Symbol, location: SourceLocation): void {
    const key = this.getSymbolKey(symbol);
    const usage = this.usageMap.get(key);

    if (usage) {
      usage.readCount++;
      usage.readLocations.push(location);
    }
  }

  /**
   * Record a variable write (assignment)
   *
   * @param symbol - The symbol being written
   * @param location - Location of the write
   */
  public recordWrite(symbol: Symbol, location: SourceLocation): void {
    const key = this.getSymbolKey(symbol);
    const usage = this.usageMap.get(key);

    if (usage) {
      usage.writeCount++;
      usage.writeLocations.push(location);
    }
  }

  /**
   * Mark a variable as a loop counter
   *
   * Loop counters may be intentionally unused in some cases.
   *
   * @param symbol - The loop counter symbol
   */
  public markAsLoopCounter(symbol: Symbol): void {
    const key = this.getSymbolKey(symbol);
    this.loopCounters.add(key);
  }

  /**
   * Analyze usage and generate report
   *
   * @returns Analysis results with all issues found
   */
  public analyze(): VariableUsageResult {
    const issues: VariableUsageIssue[] = [];
    let unusedVariableCount = 0;
    let unusedParameterCount = 0;
    let writeOnlyCount = 0;
    let totalVariables = 0;
    let totalParameters = 0;
    let usedVariables = 0;
    let usedParameters = 0;

    for (const [key, usage] of this.usageMap) {
      const symbol = usage.symbol;
      const isParameter = symbol.kind === SymbolKind.Parameter;

      // Update statistics
      if (isParameter) {
        totalParameters++;
      } else {
        totalVariables++;
      }

      // Check if we should skip this symbol
      if (this.shouldSkip(usage, key)) {
        // Count as used if skipped for valid reasons
        if (isParameter) {
          usedParameters++;
        } else {
          usedVariables++;
        }
        continue;
      }

      // Check for unused variable/parameter (never read)
      if (usage.readCount === 0) {
        if (usage.writeCount === 0) {
          // Never used at all
          if (isParameter && this.options.reportUnusedParameters) {
            unusedParameterCount++;
            issues.push(this.createUnusedParameterIssue(symbol));
          } else if (!isParameter && this.options.reportUnusedVariables) {
            unusedVariableCount++;
            issues.push(this.createUnusedVariableIssue(symbol));
          }
        } else if (this.options.reportWriteOnly) {
          // Written but never read
          writeOnlyCount++;
          issues.push(this.createWriteOnlyIssue(symbol, usage.writeCount));
        }
      } else {
        // Read at least once - count as used
        if (isParameter) {
          usedParameters++;
        } else {
          usedVariables++;
        }
      }
    }

    return {
      hasIssues: issues.length > 0,
      issues,
      unusedVariableCount,
      unusedParameterCount,
      writeOnlyCount,
      totalVariables,
      totalParameters,
      usedVariables,
      usedParameters,
    };
  }

  /**
   * Check if a symbol should be skipped from analysis
   */
  protected shouldSkip(usage: UsageInfo, key: string): boolean {
    // Skip intentionally unused (underscore-prefixed)
    if (this.options.ignoreUnderscorePrefixed && usage.isIntentionallyUnused) {
      return true;
    }

    // Skip exported symbols
    if (this.options.ignoreExported && usage.isExported) {
      return true;
    }

    // Skip loop counters if configured
    if (this.options.ignoreLoopCounters && this.loopCounters.has(key)) {
      return true;
    }

    return false;
  }

  /**
   * Create an unused variable issue
   */
  protected createUnusedVariableIssue(symbol: Symbol): VariableUsageIssue {
    return {
      kind: VariableUsageIssueKind.UnusedVariable,
      severity: VariableUsageSeverity.Warning,
      symbol,
      location: symbol.location,
      message: `Variable '${symbol.name}' is declared but never used`,
      suggestion: `Remove the unused variable or prefix with underscore (_${symbol.name}) if intentional`,
    };
  }

  /**
   * Create an unused parameter issue
   */
  protected createUnusedParameterIssue(symbol: Symbol): VariableUsageIssue {
    return {
      kind: VariableUsageIssueKind.UnusedParameter,
      severity: VariableUsageSeverity.Warning,
      symbol,
      location: symbol.location,
      message: `Parameter '${symbol.name}' is never used`,
      suggestion: `Remove the parameter or prefix with underscore (_${symbol.name}) if required by interface`,
    };
  }

  /**
   * Create a write-only variable issue
   */
  protected createWriteOnlyIssue(symbol: Symbol, writeCount: number): VariableUsageIssue {
    return {
      kind: VariableUsageIssueKind.WriteOnlyVariable,
      severity: VariableUsageSeverity.Warning,
      symbol,
      location: symbol.location,
      message: `Variable '${symbol.name}' is assigned ${writeCount} time(s) but never read`,
      suggestion: `Use the variable or remove it if the computation is unnecessary`,
    };
  }

  /**
   * Get usage information for a symbol
   *
   * @param symbol - The symbol to look up
   * @returns Usage info, or undefined if not tracked
   */
  public getUsage(symbol: Symbol): UsageInfo | undefined {
    const key = this.getSymbolKey(symbol);
    return this.usageMap.get(key);
  }

  /**
   * Check if a symbol has been used (read at least once)
   *
   * @param symbol - The symbol to check
   * @returns True if the symbol has been read
   */
  public isUsed(symbol: Symbol): boolean {
    const usage = this.getUsage(symbol);
    return usage ? usage.readCount > 0 : true; // Assume used if not tracked
  }

  /**
   * Get all unused symbols
   *
   * @returns Array of symbols that are declared but never read
   */
  public getUnusedSymbols(): Symbol[] {
    const unused: Symbol[] = [];

    for (const [key, usage] of this.usageMap) {
      if (usage.readCount === 0 && !this.shouldSkip(usage, key)) {
        unused.push(usage.symbol);
      }
    }

    return unused;
  }

  /**
   * Get unique key for a symbol (name + scope)
   */
  protected getSymbolKey(symbol: Symbol): string {
    return `${symbol.scope.id}::${symbol.name}`;
  }

  /**
   * Format a human-readable report
   *
   * @returns Multi-line string with all issues
   */
  public formatReport(): string {
    const result = this.analyze();

    if (!result.hasIssues) {
      const stats = `(${result.usedVariables}/${result.totalVariables} variables, ${result.usedParameters}/${result.totalParameters} parameters used)`;
      return `Variable Usage Analysis: No issues found ${stats}`;
    }

    const lines: string[] = [
      '=== Variable Usage Analysis Report ===',
      '',
      'Statistics:',
      `  Variables: ${result.usedVariables}/${result.totalVariables} used`,
      `  Parameters: ${result.usedParameters}/${result.totalParameters} used`,
      '',
      'Issues found:',
      `  Unused variables: ${result.unusedVariableCount}`,
      `  Unused parameters: ${result.unusedParameterCount}`,
      `  Write-only variables: ${result.writeOnlyCount}`,
      '',
      'Details:',
    ];

    for (const issue of result.issues) {
      const loc = issue.location;
      lines.push('');
      lines.push(`  ${issue.severity.toUpperCase()}: ${issue.message}`);
      lines.push(`    at line ${loc.start.line}, column ${loc.start.column}`);
      lines.push(`    suggestion: ${issue.suggestion}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset analyzer state for reuse
   */
  public reset(): void {
    this.usageMap.clear();
    this.loopCounters.clear();
  }
}