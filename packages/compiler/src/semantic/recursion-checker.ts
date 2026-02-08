/**
 * Recursion Checker for Blend65 Compiler v2
 *
 * Detects and reports recursive function calls as compile-time errors.
 *
 * **Why Recursion is Forbidden:**
 * Static Frame Allocation (SFA) allocates all function frames at compile time
 * at fixed memory addresses. This requires knowing exactly how many instances
 * of each function's frame can exist simultaneously. Recursion allows unbounded
 * instances, making static allocation impossible.
 *
 * **Detected Patterns:**
 * - Direct recursion: function calls itself
 * - Indirect recursion: A → B → C → A
 * - Mutual recursion: A → B → A
 *
 * @module semantic/recursion-checker
 */

import type { SourceLocation } from '../ast/index.js';
import { CallGraph } from './call-graph.js';

/**
 * Error codes for recursion-related errors
 */
export enum RecursionErrorCode {
  /** Function directly calls itself */
  DIRECT_RECURSION = 'DIRECT_RECURSION',

  /** Function is part of an indirect recursive cycle */
  INDIRECT_RECURSION = 'INDIRECT_RECURSION',

  /** Mutual recursion between two functions */
  MUTUAL_RECURSION = 'MUTUAL_RECURSION',
}

/**
 * Represents a recursion error
 *
 * Contains detailed information about the recursive call pattern
 * for generating helpful error messages.
 */
export interface RecursionError {
  /** Error code for categorization */
  code: RecursionErrorCode;

  /** Human-readable error message */
  message: string;

  /** The function where recursion was detected */
  functionName: string;

  /** Source location of the function declaration */
  functionLocation: SourceLocation;

  /** Source location of the recursive call */
  callLocation: SourceLocation;

  /** The complete cycle path (for indirect/mutual recursion) */
  cyclePath: string[];

  /** Detailed explanation for user */
  details: string;
}

/**
 * Result of recursion checking
 */
export interface RecursionCheckResult {
  /** Whether the code is free of recursion */
  isValid: boolean;

  /** Array of all recursion errors found */
  errors: RecursionError[];

  /** Functions involved in any recursive cycle */
  recursiveFunctions: Set<string>;

  /** Statistics about the check */
  stats: {
    /** Total functions analyzed */
    functionsAnalyzed: number;

    /** Number of directly recursive functions */
    directRecursionCount: number;

    /** Number of indirect recursion cycles */
    indirectCycleCount: number;

    /** Total recursive functions found */
    totalRecursiveFunctions: number;
  };
}

/**
 * Recursion Checker - detects and reports recursive function calls
 *
 * This is a critical component for Static Frame Allocation (SFA).
 * All recursion must be detected and reported as compile-time errors.
 *
 * @example
 * ```typescript
 * const checker = new RecursionChecker(callGraph);
 * const result = checker.check();
 *
 * if (!result.isValid) {
 *   for (const error of result.errors) {
 *     console.error(`${error.code}: ${error.message}`);
 *     console.error(`  at ${error.functionName}`);
 *     console.error(`  Cycle: ${error.cyclePath.join(' → ')}`);
 *   }
 * }
 * ```
 */
export class RecursionChecker {
  /**
   * The call graph to analyze
   */
  protected callGraph: CallGraph;

  /**
   * Creates a new RecursionChecker
   *
   * @param callGraph - The call graph to check for recursion
   */
  constructor(callGraph: CallGraph) {
    this.callGraph = callGraph;
  }

  /**
   * Performs complete recursion check on the call graph
   *
   * Detects both direct recursion (f → f) and indirect recursion
   * (f → g → ... → f). Reports all recursive patterns found.
   *
   * @returns RecursionCheckResult with all errors and statistics
   */
  public check(): RecursionCheckResult {
    const errors: RecursionError[] = [];
    const recursiveFunctions = new Set<string>();
    const processedCycles = new Set<string>(); // Track cycles to avoid duplicates

    // Statistics
    let directRecursionCount = 0;
    let indirectCycleCount = 0;

    // Check for direct recursion first
    const directRecursive = this.callGraph.detectDirectRecursion();
    for (const funcName of directRecursive) {
      const error = this.createDirectRecursionError(funcName);
      if (error) {
        errors.push(error);
        recursiveFunctions.add(funcName);
        directRecursionCount++;
      }
    }

    // Check for indirect recursion (cycles longer than 1)
    const allCycles = this.callGraph.detectAllCycles();
    for (const cycle of allCycles) {
      // Skip single-node cycles (direct recursion already handled)
      if (cycle.length <= 2) continue;

      // Create a canonical key for the cycle to detect duplicates
      const cycleKey = this.getCycleKey(cycle);
      if (processedCycles.has(cycleKey)) continue;
      processedCycles.add(cycleKey);

      // Determine if it's mutual (2 functions) or indirect (3+ functions)
      const uniqueFunctions = new Set(cycle.slice(0, -1)); // Exclude repeated end
      const isMutual = uniqueFunctions.size === 2;

      // Create error for the first function in the cycle
      const error = this.createIndirectRecursionError(cycle, isMutual);
      if (error) {
        errors.push(error);
        indirectCycleCount++;

        // Mark all functions in the cycle as recursive
        for (const func of uniqueFunctions) {
          recursiveFunctions.add(func);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      recursiveFunctions,
      stats: {
        functionsAnalyzed: this.callGraph.size(),
        directRecursionCount,
        indirectCycleCount,
        totalRecursiveFunctions: recursiveFunctions.size,
      },
    };
  }

  /**
   * Creates an error for direct recursion
   *
   * @param funcName - The directly recursive function
   * @returns RecursionError or null if function not found
   */
  protected createDirectRecursionError(funcName: string): RecursionError | null {
    const funcNode = this.callGraph.getFunction(funcName);
    if (!funcNode) return null;

    // Find the self-call site
    const callSites = this.callGraph.getCallSites(funcName, funcName);
    const callLocation = callSites.length > 0
      ? callSites[0].location
      : funcNode.location;

    return {
      code: RecursionErrorCode.DIRECT_RECURSION,
      message: `Function '${funcName}' calls itself directly. Recursion is not allowed with Static Frame Allocation.`,
      functionName: funcName,
      functionLocation: funcNode.location,
      callLocation,
      cyclePath: [funcName, funcName],
      details: this.getDirectRecursionDetails(funcName),
    };
  }

  /**
   * Creates an error for indirect or mutual recursion
   *
   * @param cycle - The cycle path (e.g., ['a', 'b', 'c', 'a'])
   * @param isMutual - Whether this is mutual recursion (2 functions)
   * @returns RecursionError or null
   */
  protected createIndirectRecursionError(cycle: string[], isMutual: boolean): RecursionError | null {
    const funcName = cycle[0];
    const funcNode = this.callGraph.getFunction(funcName);
    if (!funcNode) return null;

    // Find the call that creates the cycle (last → first)
    const cycleCloser = cycle[cycle.length - 2]; // Second to last
    const callSites = this.callGraph.getCallSites(cycleCloser, funcName);
    const callLocation = callSites.length > 0
      ? callSites[0].location
      : funcNode.location;

    const code = isMutual
      ? RecursionErrorCode.MUTUAL_RECURSION
      : RecursionErrorCode.INDIRECT_RECURSION;

    const cyclePretty = cycle.join(' → ');
    const message = isMutual
      ? `Functions '${cycle[0]}' and '${cycle[1]}' call each other (mutual recursion). Recursion is not allowed with Static Frame Allocation.`
      : `Function '${funcName}' is part of a recursive cycle: ${cyclePretty}. Recursion is not allowed with Static Frame Allocation.`;

    return {
      code,
      message,
      functionName: funcName,
      functionLocation: funcNode.location,
      callLocation,
      cyclePath: cycle,
      details: this.getIndirectRecursionDetails(cycle, isMutual),
    };
  }

  /**
   * Generates detailed explanation for direct recursion
   */
  protected getDirectRecursionDetails(funcName: string): string {
    return [
      `The function '${funcName}' contains a call to itself.`,
      '',
      'Why this is an error:',
      '  Blend65 uses Static Frame Allocation (SFA), which allocates all',
      '  function variables at fixed memory addresses at compile time.',
      '  Recursive functions can have multiple active instances at runtime,',
      '  but each instance would need its own memory space.',
      '',
      'How to fix:',
      '  1. Convert the recursive algorithm to an iterative one using loops',
      '  2. Use an explicit stack data structure if recursion depth is bounded',
      '  3. Refactor the algorithm to avoid self-reference',
    ].join('\n');
  }

  /**
   * Generates detailed explanation for indirect/mutual recursion
   */
  protected getIndirectRecursionDetails(cycle: string[], isMutual: boolean): string {
    const cyclePretty = cycle.join(' → ');

    if (isMutual) {
      return [
        `Functions '${cycle[0]}' and '${cycle[1]}' call each other.`,
        '',
        `Call chain: ${cyclePretty}`,
        '',
        'Why this is an error:',
        '  Blend65 uses Static Frame Allocation (SFA). Mutual recursion',
        '  (where A calls B and B calls A) creates the same problem as',
        '  direct recursion - potentially unbounded active function instances.',
        '',
        'How to fix:',
        '  1. Combine the functions into one with conditional logic',
        '  2. Add a flag parameter to prevent re-entry',
        '  3. Restructure the algorithm to break the circular dependency',
      ].join('\n');
    }

    return [
      `The following functions form a recursive cycle:`,
      `  ${cyclePretty}`,
      '',
      'Why this is an error:',
      '  Blend65 uses Static Frame Allocation (SFA). This indirect recursion',
      '  can lead to unbounded active function instances, which is incompatible',
      '  with static memory allocation.',
      '',
      'How to fix:',
      '  1. Analyze the cycle and identify which call can be eliminated',
      '  2. Use data structures to replace the recursive pattern',
      '  3. Restructure the algorithm to avoid the circular call chain',
    ].join('\n');
  }

  /**
   * Creates a canonical key for a cycle (for deduplication)
   *
   * Normalizes the cycle by rotating to start with the smallest element
   * and handling the direction.
   */
  protected getCycleKey(cycle: string[]): string {
    // Remove the duplicate end element
    const uniqueCycle = cycle.slice(0, -1);

    // Find the smallest element and rotate
    const minIndex = uniqueCycle.indexOf(
      uniqueCycle.reduce((min, curr) => curr < min ? curr : min)
    );
    const rotated = [
      ...uniqueCycle.slice(minIndex),
      ...uniqueCycle.slice(0, minIndex),
    ];

    return rotated.join('→');
  }

  /**
   * Quick check if any recursion exists
   *
   * @returns true if any recursion is detected
   */
  public hasRecursion(): boolean {
    // Quick check for direct recursion
    if (this.callGraph.detectDirectRecursion().length > 0) {
      return true;
    }

    // Check for any cycles
    const cycles = this.callGraph.detectAllCycles();
    return cycles.length > 0;
  }

  /**
   * Gets all functions involved in recursion
   *
   * @returns Set of function names that are part of any recursive cycle
   */
  public getRecursiveFunctions(): Set<string> {
    const result = this.check();
    return result.recursiveFunctions;
  }

  /**
   * Checks if a specific function is recursive
   *
   * @param funcName - The function name to check
   * @returns true if the function is part of any recursive cycle
   */
  public isRecursive(funcName: string): boolean {
    return this.callGraph.isRecursive(funcName);
  }

  /**
   * Formats all errors as a human-readable report
   *
   * @returns Formatted error report string
   */
  public formatReport(): string {
    const result = this.check();

    if (result.isValid) {
      return `✓ No recursion detected. ${result.stats.functionsAnalyzed} functions analyzed.`;
    }

    const lines: string[] = [
      '═══════════════════════════════════════════════════════════',
      '  RECURSION ERRORS DETECTED',
      '═══════════════════════════════════════════════════════════',
      '',
      `Found ${result.errors.length} recursion error(s) in ${result.stats.functionsAnalyzed} functions.`,
      '',
    ];

    for (let i = 0; i < result.errors.length; i++) {
      const error = result.errors[i];
      lines.push(`─── Error ${i + 1} ───`);
      lines.push(`Type: ${error.code}`);
      lines.push(`Function: ${error.functionName}`);
      lines.push(`Message: ${error.message}`);
      lines.push(`Cycle: ${error.cyclePath.join(' → ')}`);
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════════');
    lines.push(`Summary: ${result.stats.directRecursionCount} direct, ${result.stats.indirectCycleCount} indirect`);
    lines.push('═══════════════════════════════════════════════════════════');

    return lines.join('\n');
  }
}