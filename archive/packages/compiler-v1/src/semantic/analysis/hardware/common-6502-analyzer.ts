/**
 * Common 6502 Analyzer
 *
 * Provides CPU-level analysis that is common to all 6502-based targets.
 * This is Level 2 (6502-Common) in the analysis hierarchy.
 *
 * **Analysis Levels:**
 * - Level 1: Universal (language-level, always runs)
 * - Level 2: 6502-Common (CPU-level, all 6502 targets) ← THIS
 * - Level 3: Target-Specific (hardware-level, per-machine)
 *
 * **Common 6502 Concerns:**
 * These apply to ALL 6502 targets (C64, C128, X16, etc.):
 * - 256-byte stack limit
 * - Branch distance limits (±127 bytes)
 * - Zero-page priority scoring (concept, not specific ranges)
 * - Register preference hints (A, X, Y)
 * - Carry/Decimal flag dataflow
 *
 * **Not Included Here:**
 * These are target-specific (Level 3):
 * - Reserved zero-page ranges (varies by KERNAL)
 * - Hardware register addresses (VIC-II, SID, VERA)
 * - Timing characteristics (badlines, clock speed)
 *
 * @example
 * ```typescript
 * const analyzer = new Common6502Analyzer(symbolTable, cfgs);
 * analyzer.analyzeStackUsage(ast);
 * const stackWarnings = analyzer.getDiagnostics();
 * ```
 */

import type { Program, FunctionDecl } from '../../../ast/nodes.js';
import type { SymbolTable } from '../../symbol-table.js';
import type { ControlFlowGraph } from '../../control-flow.js';
import type { Diagnostic } from '../../../ast/diagnostics.js';
import type { SourceLocation } from '../../../ast/base.js';
import { DiagnosticCode, DiagnosticSeverity } from '../../../ast/diagnostics.js';
import { isFunctionDecl } from '../../../ast/type-guards.js';

/**
 * 6502 CPU Constants
 *
 * These are universal to all 6502 variants (6502, 65C02, 65816 in emulation mode).
 */
export const CPU_6502_CONSTANTS = {
  /** Maximum stack size in bytes */
  STACK_SIZE: 256,

  /** Maximum branch distance (forward) */
  MAX_BRANCH_FORWARD: 127,

  /** Maximum branch distance (backward) */
  MAX_BRANCH_BACKWARD: -128,

  /** Zero-page size in bytes */
  ZERO_PAGE_SIZE: 256,

  /** Number of general-purpose registers */
  REGISTER_COUNT: 3, // A, X, Y
} as const;

/**
 * Stack usage analysis result
 */
export interface StackUsageResult {
  /** Function name */
  functionName: string;

  /** Estimated stack depth (bytes) */
  estimatedDepth: number;

  /** Maximum observed depth in call chain */
  maxChainDepth: number;

  /** Is there a potential overflow risk? */
  overflowRisk: boolean;

  /** Source location */
  location: SourceLocation;
}

/**
 * Branch distance analysis result
 */
export interface BranchDistanceResult {
  /** Branch location */
  location: SourceLocation;

  /** Estimated distance in bytes */
  estimatedDistance: number;

  /** Is distance potentially out of range? */
  outOfRange: boolean;
}

/**
 * Common 6502 CPU Analyzer
 *
 * Provides analysis common to all 6502-family CPUs.
 * This class can be used standalone or as a helper by
 * target-specific hardware analyzers.
 *
 * **Usage Patterns:**
 * 1. Standalone: Create instance and call analyze methods
 * 2. Helper: Used by C64HardwareAnalyzer, X16HardwareAnalyzer, etc.
 */
export class Common6502Analyzer {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Stack usage results by function */
  protected stackUsage = new Map<string, StackUsageResult>();

  /**
   * Creates a common 6502 analyzer
   *
   * @param symbolTable - Symbol table from semantic analysis
   * @param cfgs - Control flow graphs
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    protected readonly cfgs: Map<string, ControlFlowGraph>
  ) {}

  // ============================================
  // Public Analysis Methods
  // ============================================

  /**
   * Run all 6502-common analyses
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    this.diagnostics = [];
    this.stackUsage.clear();

    // Analyze stack usage
    this.analyzeStackUsage(ast);

    // Note: Branch distance analysis would require code generation context
    // which is not available at this analysis stage. It will be done
    // during code generation phase.
  }

  /**
   * Analyze stack usage across all functions
   *
   * Detects potential stack overflow situations in the 256-byte
   * 6502 stack. This is critical because 6502 has no hardware
   * stack protection.
   *
   * @param ast - Program AST
   */
  public analyzeStackUsage(ast: Program): void {
    const declarations = ast.getDeclarations();

    // First pass: calculate stack usage per function
    for (const decl of declarations) {
      if (isFunctionDecl(decl)) {
        const result = this.calculateFunctionStackUsage(decl);
        this.stackUsage.set(decl.getName(), result);
      }
    }

    // Second pass: analyze call chains
    this.analyzeCallChains();

    // Generate warnings for risky stack usage
    this.generateStackWarnings();
  }

  /**
   * Get stack usage for a specific function
   *
   * @param functionName - Name of function
   * @returns Stack usage result, or undefined if not analyzed
   */
  public getStackUsage(functionName: string): StackUsageResult | undefined {
    return this.stackUsage.get(functionName);
  }

  /**
   * Get all stack usage results
   *
   * @returns Map of function name to stack usage
   */
  public getAllStackUsage(): Map<string, StackUsageResult> {
    return new Map(this.stackUsage);
  }

  /**
   * Get all diagnostics
   *
   * @returns Array of diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Check if any errors occurred
   *
   * @returns True if errors exist
   */
  public hasErrors(): boolean {
    return this.diagnostics.some((d) => d.severity === DiagnosticSeverity.ERROR);
  }

  // ============================================
  // Stack Analysis Implementation
  // ============================================

  /**
   * Calculate stack usage for a single function
   *
   * Estimates include:
   * - Return address (2 bytes per call level)
   * - Local variables (if stack-allocated)
   * - Register saves (if required)
   *
   * @param func - Function declaration
   * @returns Stack usage result
   */
  protected calculateFunctionStackUsage(func: FunctionDecl): StackUsageResult {
    let estimatedDepth = 0;

    // Return address pushed on call (2 bytes)
    estimatedDepth += 2;

    // Parameters passed via stack (estimate based on param count)
    const params = func.getParameters();
    // For now, assume params are passed in ZP or registers, not stack
    // Add complexity factor for many parameters
    if (params.length > 3) {
      estimatedDepth += (params.length - 3) * 2; // Extra params might use stack
    }

    // Local variables in function body
    // This would require deeper analysis of the function body
    // For now, use a heuristic based on function complexity
    const bodyComplexity = this.estimateFunctionComplexity(func);
    estimatedDepth += bodyComplexity * 2; // Assume some locals per complexity unit

    return {
      functionName: func.getName(),
      estimatedDepth,
      maxChainDepth: estimatedDepth, // Will be updated in call chain analysis
      overflowRisk: false, // Will be updated after call chain analysis
      location: func.getLocation(),
    };
  }

  /**
   * Estimate function complexity for stack usage
   *
   * Simple heuristic based on function structure.
   *
   * @param func - Function declaration
   * @returns Complexity score
   */
  protected estimateFunctionComplexity(func: FunctionDecl): number {
    let complexity = 1; // Base complexity

    const body = func.getBody();
    if (body && Array.isArray(body)) {
      // Body is an array of statements
      complexity += Math.min(body.length / 5, 5);
    }

    return Math.floor(complexity);
  }

  /**
   * Analyze call chains to find maximum stack depth
   *
   * Traces through call graph to find the deepest call chain
   * and update max chain depth values.
   */
  protected analyzeCallChains(): void {
    // For each function, trace its call chain depth
    for (const [funcName, usage] of this.stackUsage) {
      const maxDepth = this.traceCallChainDepth(funcName, new Set());
      usage.maxChainDepth = maxDepth;

      // Check for overflow risk
      if (maxDepth > CPU_6502_CONSTANTS.STACK_SIZE * 0.75) {
        // 75% threshold
        usage.overflowRisk = true;
      }
    }
  }

  /**
   * Trace call chain depth recursively
   *
   * @param funcName - Function to trace from
   * @param visited - Set of already visited functions (for cycle detection)
   * @returns Maximum depth in bytes
   */
  protected traceCallChainDepth(funcName: string, visited: Set<string>): number {
    // Cycle detection
    if (visited.has(funcName)) {
      return 0; // Recursive call - don't count again
    }

    const usage = this.stackUsage.get(funcName);
    if (!usage) {
      return 0; // Unknown function
    }

    visited.add(funcName);

    // For now, return the estimated depth
    // Full call graph tracing would require more infrastructure
    // that's already in call-graph.ts

    return usage.estimatedDepth;
  }

  /**
   * Generate warnings for risky stack usage
   */
  protected generateStackWarnings(): void {
    for (const [funcName, usage] of this.stackUsage) {
      if (usage.overflowRisk) {
        this.diagnostics.push({
          code: DiagnosticCode.TYPE_MISMATCH, // Will add proper code later
          severity: DiagnosticSeverity.WARNING,
          message:
            `Function '${funcName}' may cause stack overflow. ` +
            `Estimated max stack depth: ${usage.maxChainDepth} bytes ` +
            `(6502 stack limit: ${CPU_6502_CONSTANTS.STACK_SIZE} bytes).`,
          location: usage.location,
        });
      }
    }
  }

  // ============================================
  // Register Hint Utilities
  // ============================================

  /**
   * Suggest register for a variable based on usage pattern
   *
   * Guidelines:
   * - A (Accumulator): Arithmetic operations, data transfer
   * - X: Array indexing, loop counters (outer loops)
   * - Y: Indirect addressing (zp),Y, loop counters (inner loops)
   *
   * @param isLoopCounter - Is this a loop counter?
   * @param isArrayIndex - Is this used for array indexing?
   * @param isIndirectAccess - Is this used for indirect addressing?
   * @param loopDepth - Loop nesting depth (0 = not in loop)
   * @returns Suggested register ('A', 'X', 'Y', or 'any')
   */
  public suggestRegister(
    isLoopCounter: boolean,
    isArrayIndex: boolean,
    isIndirectAccess: boolean,
    loopDepth: number
  ): 'A' | 'X' | 'Y' | 'any' {
    // Indirect addressing requires Y for (zp),Y mode
    if (isIndirectAccess) {
      return 'Y';
    }

    // Array indexing prefers X for zp,X and abs,X modes
    if (isArrayIndex) {
      return 'X';
    }

    // Loop counters
    if (isLoopCounter) {
      // Inner loops use Y (if X is used by outer loop)
      if (loopDepth > 1) {
        return 'Y';
      }
      // Outer loops use X
      return 'X';
    }

    // Default: accumulator for general operations
    return 'A';
  }

  // ============================================
  // Zero-Page Utilities
  // ============================================

  /**
   * Calculate zero-page priority score for a variable
   *
   * Higher scores indicate variables that benefit more from
   * zero-page placement (faster access, smaller code).
   *
   * This provides the CONCEPT of priority scoring that all
   * targets use, but the actual reserved ranges are target-specific.
   *
   * @param accessCount - Total read + write accesses
   * @param loopDepth - Maximum loop nesting depth
   * @param hotPathAccesses - Accesses in critical paths
   * @param isByte - Is variable a single byte?
   * @param isLoopCounter - Is this a loop counter?
   * @returns Priority score (0-100)
   */
  public calculateZeroPagePriority(
    accessCount: number,
    loopDepth: number,
    hotPathAccesses: number,
    isByte: boolean,
    isLoopCounter: boolean
  ): number {
    let score = 0;

    // Access frequency (0-30 points)
    // More accesses = more cycles saved by ZP
    score += Math.min(30, accessCount * 1.5);

    // Loop depth bonus (0-25 points)
    // Deep loop variables benefit most
    score += Math.min(25, loopDepth * 8);

    // Hot path bonus (0-20 points)
    // Critical path variables get priority
    score += Math.min(20, hotPathAccesses * 2);

    // Size bonus (0-10 points)
    // Bytes benefit more than words
    if (isByte) {
      score += 10;
    }

    // Loop counter bonus (0-15 points)
    // Loop counters are accessed very frequently
    if (isLoopCounter) {
      score += 15;
    }

    // Clamp to 0-100
    return Math.min(100, Math.max(0, Math.round(score)));
  }
}