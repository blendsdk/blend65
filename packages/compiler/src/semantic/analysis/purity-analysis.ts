/**
 * Purity Analyzer for Blend65 Compiler v2
 *
 * Detects function side effects to determine if functions are "pure".
 * A pure function:
 * - Always produces the same output for the same inputs
 * - Has no side effects (no writes to external state)
 * - Doesn't call impure functions
 *
 * **Why Purity Matters for 6502:**
 * - Pure functions can be safely inlined
 * - Pure expressions can be hoisted from loops
 * - Pure calls can be memoized or eliminated if result unused
 * - Helps identify opportunities for constant folding
 *
 * **Side Effects Detected:**
 * - Writes to global/module-level variables
 * - Calls to impure functions (peek, poke, etc.)
 * - Calls to functions with side effects
 * - Writes to array elements via pointer
 *
 * @module semantic/analysis/purity-analysis
 */

import type { SourceLocation } from '../../ast/index.js';
import type { Symbol } from '../symbol.js';
import type { GlobalSymbolTable } from '../global-symbol-table.js';

/**
 * Types of impurity (reasons a function is not pure)
 */
export enum ImpurityKind {
  /** Writes to a global or module-level variable */
  GlobalWrite = 'global_write',
  /** Reads from a global that could change (volatile) */
  GlobalRead = 'global_read',
  /** Calls an intrinsic with side effects (poke, peek) */
  IntrinsicSideEffect = 'intrinsic_side_effect',
  /** Calls another impure function */
  ImpureFunctionCall = 'impure_function_call',
  /** Writes to array element (potential aliasing) */
  ArrayWrite = 'array_write',
  /** Function has no body (external/unknown) */
  UnknownBody = 'unknown_body',
}

/**
 * Description of why a function is impure
 */
export interface ImpurityReason {
  /** The kind of impurity */
  kind: ImpurityKind;
  /** Location in the source where impurity occurs */
  location: SourceLocation;
  /** Human-readable description */
  description: string;
  /** The symbol involved (if applicable) */
  symbol?: Symbol;
  /** The called function (if call-related) */
  calledFunction?: string;
}

/**
 * Purity status of a function
 */
export enum PurityStatus {
  /** Function is pure (no side effects) */
  Pure = 'pure',
  /** Function has side effects */
  Impure = 'impure',
  /** Purity is unknown (not yet analyzed) */
  Unknown = 'unknown',
}

/**
 * Purity information for a single function
 */
export interface FunctionPurity {
  /** Function name */
  functionName: string;
  /** Purity status */
  status: PurityStatus;
  /** If impure, the reasons why */
  impurityReasons: ImpurityReason[];
  /** Does this function only read globals? (read-only impurity) */
  readsGlobals: boolean;
  /** Does this function write globals? */
  writesGlobals: boolean;
  /** Does this function call external/intrinsic functions? */
  callsIntrinsics: boolean;
  /** Functions this function calls */
  callees: string[];
}

/**
 * Result of purity analysis
 */
export interface PurityAnalysisResult {
  /** All function purity information */
  functions: Map<string, FunctionPurity>;
  /** Count of pure functions */
  pureCount: number;
  /** Count of impure functions */
  impureCount: number;
  /** Total functions analyzed */
  totalFunctions: number;
  /** Percentage of pure functions */
  purityPercentage: number;
}

/**
 * Configuration options for purity analysis
 */
export interface PurityAnalysisOptions {
  /** Treat global reads as impure (conservative, default: false) */
  strictGlobalReads: boolean;
  /** List of intrinsics considered pure (default: ['hi', 'lo', 'len']) */
  pureIntrinsics: string[];
  /** List of intrinsics with side effects (default: ['poke']) */
  impureIntrinsics: string[];
}

/**
 * Default purity analysis options
 */
export const DEFAULT_PURITY_OPTIONS: PurityAnalysisOptions = {
  strictGlobalReads: false,
  pureIntrinsics: ['hi', 'lo', 'len', 'sizeof'],
  impureIntrinsics: ['poke'],
};

/**
 * Purity Analyzer
 *
 * Analyzes functions to determine if they have side effects.
 * Uses an iterative algorithm to handle mutual recursion and
 * propagate impurity through the call graph.
 *
 * **Usage:**
 * ```typescript
 * const analyzer = new PurityAnalyzer(globalSymbolTable, functionSymbols);
 *
 * // Record side effects during AST traversal
 * analyzer.recordGlobalWrite('myFunc', symbol, location);
 * analyzer.recordFunctionCall('myFunc', 'callee', location);
 *
 * // Compute purity
 * const result = analyzer.analyze();
 *
 * // Check specific function
 * if (analyzer.isPure('myFunc')) {
 *   // Can safely optimize
 * }
 * ```
 */
export class PurityAnalyzer {
  /** Global symbol table for cross-module lookups */
  protected readonly globalSymbolTable: GlobalSymbolTable;

  /** Map of function name to its symbols (for call resolution) */
  protected readonly functionSymbols: Map<string, Symbol>;

  /** Configuration options */
  protected readonly options: PurityAnalysisOptions;

  /** Purity information per function */
  protected purityInfo: Map<string, FunctionPurity>;

  /** Intrinsics that are known to be pure */
  protected pureIntrinsics: Set<string>;

  /** Intrinsics that are known to have side effects */
  protected impureIntrinsics: Set<string>;

  /**
   * Create a new purity analyzer
   *
   * @param globalSymbolTable - Global symbol table for cross-module lookup
   * @param functionSymbols - Map of function names to their symbols
   * @param options - Analysis options
   */
  constructor(
    globalSymbolTable: GlobalSymbolTable,
    functionSymbols: Map<string, Symbol>,
    options?: Partial<PurityAnalysisOptions>
  ) {
    this.globalSymbolTable = globalSymbolTable;
    this.functionSymbols = functionSymbols;
    this.options = { ...DEFAULT_PURITY_OPTIONS, ...options };
    this.purityInfo = new Map();
    this.pureIntrinsics = new Set(this.options.pureIntrinsics);
    this.impureIntrinsics = new Set(this.options.impureIntrinsics);
  }

  /**
   * Initialize purity tracking for a function
   *
   * Must be called for each function before recording side effects.
   *
   * @param functionName - The function to initialize
   */
  public initializeFunction(functionName: string): void {
    if (!this.purityInfo.has(functionName)) {
      this.purityInfo.set(functionName, {
        functionName,
        status: PurityStatus.Unknown,
        impurityReasons: [],
        readsGlobals: false,
        writesGlobals: false,
        callsIntrinsics: false,
        callees: [],
      });
    }
  }

  /**
   * Record a write to a global/module-level variable
   *
   * @param functionName - The function performing the write
   * @param symbol - The global symbol being written
   * @param location - Source location of the write
   */
  public recordGlobalWrite(functionName: string, symbol: Symbol, location: SourceLocation): void {
    this.initializeFunction(functionName);
    const info = this.purityInfo.get(functionName)!;

    info.writesGlobals = true;
    info.impurityReasons.push({
      kind: ImpurityKind.GlobalWrite,
      location,
      description: `Writes to global variable '${symbol.name}'`,
      symbol,
    });
  }

  /**
   * Record a read from a global/module-level variable
   *
   * @param functionName - The function performing the read
   * @param symbol - The global symbol being read
   * @param location - Source location of the read
   */
  public recordGlobalRead(functionName: string, symbol: Symbol, location: SourceLocation): void {
    this.initializeFunction(functionName);
    const info = this.purityInfo.get(functionName)!;

    info.readsGlobals = true;

    // Only add as impurity reason if strict mode enabled
    if (this.options.strictGlobalReads) {
      info.impurityReasons.push({
        kind: ImpurityKind.GlobalRead,
        location,
        description: `Reads from global variable '${symbol.name}'`,
        symbol,
      });
    }
  }

  /**
   * Record an array write (potential aliasing)
   *
   * @param functionName - The function performing the write
   * @param location - Source location of the write
   */
  public recordArrayWrite(functionName: string, location: SourceLocation): void {
    this.initializeFunction(functionName);
    const info = this.purityInfo.get(functionName)!;

    info.impurityReasons.push({
      kind: ImpurityKind.ArrayWrite,
      location,
      description: 'Writes to array element (potential side effect through aliasing)',
    });
  }

  /**
   * Record a function call
   *
   * @param functionName - The calling function
   * @param callee - The called function name
   * @param location - Source location of the call
   */
  public recordFunctionCall(functionName: string, callee: string, _location: SourceLocation): void {
    this.initializeFunction(functionName);
    const info = this.purityInfo.get(functionName)!;

    if (!info.callees.includes(callee)) {
      info.callees.push(callee);
    }
  }

  /**
   * Record an intrinsic call
   *
   * @param functionName - The calling function
   * @param intrinsic - The intrinsic name
   * @param location - Source location of the call
   */
  public recordIntrinsicCall(
    functionName: string,
    intrinsic: string,
    location: SourceLocation
  ): void {
    this.initializeFunction(functionName);
    const info = this.purityInfo.get(functionName)!;

    info.callsIntrinsics = true;

    // Check if this intrinsic has side effects
    if (this.impureIntrinsics.has(intrinsic)) {
      info.impurityReasons.push({
        kind: ImpurityKind.IntrinsicSideEffect,
        location,
        description: `Calls intrinsic '${intrinsic}' which has side effects`,
        calledFunction: intrinsic,
      });
    }
    // Note: peek() is a read-only operation but reads from hardware
    // which could have side effects in some contexts (e.g., clearing interrupt flags)
    // For now we treat peek as pure for optimization purposes
  }

  /**
   * Mark a function as having an unknown body (external)
   *
   * @param functionName - The function with unknown body
   * @param location - Location of the declaration
   */
  public markUnknownBody(functionName: string, location: SourceLocation): void {
    this.initializeFunction(functionName);
    const info = this.purityInfo.get(functionName)!;

    info.impurityReasons.push({
      kind: ImpurityKind.UnknownBody,
      location,
      description: `Function '${functionName}' has unknown body (external or unanalyzed)`,
    });
  }

  /**
   * Analyze all functions and compute purity status
   *
   * Uses iterative algorithm to handle mutual recursion:
   * 1. Mark functions with direct impurities
   * 2. Propagate impurity through call graph until fixed point
   *
   * @returns Analysis result
   */
  public analyze(): PurityAnalysisResult {
    // Phase 1: Mark functions with direct impurities
    for (const info of this.purityInfo.values()) {
      if (info.impurityReasons.length > 0) {
        info.status = PurityStatus.Impure;
      }
    }

    // Phase 2: Propagate impurity through call graph
    let changed = true;
    while (changed) {
      changed = false;

      for (const info of this.purityInfo.values()) {
        if (info.status === PurityStatus.Impure) {
          continue; // Already known impure
        }

        // Check if any callee is impure
        for (const callee of info.callees) {
          const calleeInfo = this.purityInfo.get(callee);

          if (calleeInfo?.status === PurityStatus.Impure) {
            info.status = PurityStatus.Impure;
            info.impurityReasons.push({
              kind: ImpurityKind.ImpureFunctionCall,
              location: info.impurityReasons[0]?.location ?? {
                start: { line: 0, column: 0, offset: 0 },
                end: { line: 0, column: 0, offset: 0 },
              },
              description: `Calls impure function '${callee}'`,
              calledFunction: callee,
            });
            changed = true;
            break;
          }

          // If callee is unknown (external), assume impure
          if (!calleeInfo && !this.pureIntrinsics.has(callee)) {
            info.status = PurityStatus.Impure;
            info.impurityReasons.push({
              kind: ImpurityKind.ImpureFunctionCall,
              location: info.impurityReasons[0]?.location ?? {
                start: { line: 0, column: 0, offset: 0 },
                end: { line: 0, column: 0, offset: 0 },
              },
              description: `Calls unknown function '${callee}'`,
              calledFunction: callee,
            });
            changed = true;
            break;
          }
        }
      }
    }

    // Phase 3: Mark remaining as pure
    for (const info of this.purityInfo.values()) {
      if (info.status === PurityStatus.Unknown) {
        info.status = PurityStatus.Pure;
      }
    }

    return this.getResult();
  }

  /**
   * Check if a function is pure
   *
   * @param functionName - The function to check
   * @returns true if the function is pure
   */
  public isPure(functionName: string): boolean {
    const info = this.purityInfo.get(functionName);
    return info?.status === PurityStatus.Pure;
  }

  /**
   * Check if a function is impure
   *
   * @param functionName - The function to check
   * @returns true if the function has side effects
   */
  public isImpure(functionName: string): boolean {
    const info = this.purityInfo.get(functionName);
    return info?.status === PurityStatus.Impure;
  }

  /**
   * Get purity information for a function
   *
   * @param functionName - The function to look up
   * @returns Purity info, or undefined if not tracked
   */
  public getFunctionPurity(functionName: string): FunctionPurity | undefined {
    return this.purityInfo.get(functionName);
  }

  /**
   * Get all pure functions
   *
   * @returns Array of function names that are pure
   */
  public getPureFunctions(): string[] {
    const result: string[] = [];
    for (const [name, info] of this.purityInfo) {
      if (info.status === PurityStatus.Pure) {
        result.push(name);
      }
    }
    return result;
  }

  /**
   * Get all impure functions
   *
   * @returns Array of function names that are impure
   */
  public getImpureFunctions(): string[] {
    const result: string[] = [];
    for (const [name, info] of this.purityInfo) {
      if (info.status === PurityStatus.Impure) {
        result.push(name);
      }
    }
    return result;
  }

  /**
   * Get complete analysis result
   *
   * @returns Full analysis result with statistics
   */
  public getResult(): PurityAnalysisResult {
    let pureCount = 0;
    let impureCount = 0;

    for (const info of this.purityInfo.values()) {
      if (info.status === PurityStatus.Pure) {
        pureCount++;
      } else if (info.status === PurityStatus.Impure) {
        impureCount++;
      }
    }

    const totalFunctions = this.purityInfo.size;
    const purityPercentage = totalFunctions > 0 ? (pureCount / totalFunctions) * 100 : 0;

    return {
      functions: new Map(this.purityInfo),
      pureCount,
      impureCount,
      totalFunctions,
      purityPercentage,
    };
  }

  /**
   * Format a human-readable report
   *
   * @returns Multi-line string with analysis results
   */
  public formatReport(): string {
    const result = this.getResult();
    const lines: string[] = [];

    if (result.totalFunctions === 0) {
      return 'Purity Analysis: No functions analyzed';
    }

    lines.push('=== Purity Analysis Report ===');
    lines.push('');
    lines.push('Statistics:');
    lines.push(`  Total functions: ${result.totalFunctions}`);
    lines.push(`  Pure functions: ${result.pureCount} (${result.purityPercentage.toFixed(1)}%)`);
    lines.push(`  Impure functions: ${result.impureCount}`);
    lines.push('');

    // List pure functions
    const pureFunctions = this.getPureFunctions();
    if (pureFunctions.length > 0) {
      lines.push('Pure Functions:');
      for (const name of pureFunctions) {
        lines.push(`  ✓ ${name}`);
      }
      lines.push('');
    }

    // List impure functions with reasons
    const impureFunctions = this.getImpureFunctions();
    if (impureFunctions.length > 0) {
      lines.push('Impure Functions:');
      for (const name of impureFunctions) {
        const info = this.purityInfo.get(name)!;
        lines.push(`  ✗ ${name}`);
        for (const reason of info.impurityReasons) {
          lines.push(`      - ${reason.description}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset analyzer state
   */
  public reset(): void {
    this.purityInfo.clear();
  }
}