/**
 * Loop Analyzer for Blend65 Compiler v2
 *
 * Analyzes loops to detect optimization opportunities:
 * - Loop invariants (expressions that don't change during iteration)
 * - Induction variables (variables that change in predictable patterns)
 * - Loop bounds (for unrolling decisions)
 * - Nested loop characteristics
 *
 * **Why Loop Analysis Matters for 6502:**
 * - Moving invariants out of loops saves cycles per iteration
 * - Identifying induction variables enables strength reduction
 * - Loop bounds help decide unrolling strategies
 * - Critical for performance since 6502 has no hardware loop support
 *
 * **Analysis Outputs:**
 * - List of loop-invariant expressions to hoist
 * - Induction variable characteristics
 * - Estimated iteration counts where possible
 * - Loop nesting depth information
 *
 * @module semantic/analysis/loop-analysis
 */

import type { SourceLocation, Expression } from '../../ast/index.js';
import type { Symbol } from '../symbol.js';
import type { CFGNode } from '../control-flow.js';

/**
 * Types of loop constructs
 */
export enum LoopKind {
  /** while (condition) { body } */
  While = 'while',
  /** for (init; condition; update) { body } */
  For = 'for',
  /** do { body } while (condition) */
  DoWhile = 'do_while',
  /** Infinite loop (while true) */
  Infinite = 'infinite',
}

/**
 * Induction variable type
 */
export enum InductionVariableKind {
  /** Basic induction: i = i + c (constant increment) */
  Basic = 'basic',
  /** Derived induction: j = b * i + c */
  Derived = 'derived',
  /** Non-linear: i = i * 2 or similar */
  NonLinear = 'non_linear',
}

/**
 * Information about an induction variable
 */
export interface InductionVariable {
  /** The variable symbol */
  symbol: Symbol;
  /** Kind of induction */
  kind: InductionVariableKind;
  /** Initial value (if known) */
  initialValue?: number;
  /** Increment per iteration (for basic induction) */
  increment?: number;
  /** For derived: the base induction variable */
  baseVariable?: Symbol;
  /** For derived: multiplier coefficient */
  multiplier?: number;
  /** For derived: additive constant */
  constant?: number;
  /** Is this the primary loop counter? */
  isPrimary: boolean;
}

/**
 * Loop invariant expression
 */
export interface LoopInvariant {
  /** The invariant expression (can be hoisted) */
  expression: Expression;
  /** Location in source */
  location: SourceLocation;
  /** Variables read by this expression */
  usedVariables: Symbol[];
  /** Description of why it's invariant */
  reason: string;
  /** Estimated benefit of hoisting (cycles saved per iteration) */
  estimatedBenefit: number;
}

/**
 * Information about a single loop
 */
export interface LoopInfo {
  /** Unique identifier for this loop */
  id: string;
  /** Loop kind */
  kind: LoopKind;
  /** Source location of the loop statement */
  location: SourceLocation;
  /** Function containing this loop */
  functionName: string;
  /** Nesting depth (0 = not nested, 1 = one level nested, etc.) */
  nestingDepth: number;
  /** Parent loop ID (if nested) */
  parentLoopId?: string;
  /** Child loop IDs (if this contains inner loops) */
  childLoopIds: string[];
  /** Induction variables for this loop */
  inductionVariables: InductionVariable[];
  /** Loop invariant expressions */
  invariants: LoopInvariant[];
  /** Variables modified in the loop */
  modifiedVariables: Symbol[];
  /** Variables read in the loop */
  readVariables: Symbol[];
  /** Estimated iteration count (if determinable) */
  estimatedIterations?: number;
  /** Is the iteration count known at compile time? */
  isCountable: boolean;
  /** CFG node for the loop header */
  headerNode?: CFGNode;
}

/**
 * Result of loop analysis
 */
export interface LoopAnalysisResult {
  /** All loop information indexed by loop ID */
  loops: Map<string, LoopInfo>;
  /** Total number of loops */
  totalLoops: number;
  /** Maximum nesting depth */
  maxNestingDepth: number;
  /** Total loop invariants found */
  totalInvariants: number;
  /** Total induction variables found */
  totalInductionVariables: number;
  /** Loops that can potentially be unrolled */
  unrollCandidates: string[];
}

/**
 * Configuration options for loop analysis
 */
export interface LoopAnalysisOptions {
  /** Analyze for loop invariant motion (default: true) */
  detectInvariants: boolean;
  /** Analyze induction variables (default: true) */
  detectInductionVariables: boolean;
  /** Minimum estimated benefit to report invariant (default: 1) */
  minInvariantBenefit: number;
  /** Maximum iterations for unroll candidate (default: 8) */
  maxUnrollIterations: number;
}

/**
 * Default loop analysis options
 */
export const DEFAULT_LOOP_OPTIONS: LoopAnalysisOptions = {
  detectInvariants: true,
  detectInductionVariables: true,
  minInvariantBenefit: 1,
  maxUnrollIterations: 8,
};

/**
 * Loop Analyzer
 *
 * Analyzes loops for optimization opportunities. Works with CFG to
 * identify loop structures and track variable modifications.
 *
 * **Usage:**
 * ```typescript
 * const analyzer = new LoopAnalyzer();
 *
 * // Register a loop during AST/CFG traversal
 * const loopId = analyzer.registerLoop('function', LoopKind.For, location);
 *
 * // Record variable accesses in the loop
 * analyzer.recordModifiedVariable(loopId, symbol);
 * analyzer.recordReadVariable(loopId, symbol);
 *
 * // Record induction variable
 * analyzer.recordInductionVariable(loopId, {
 *   symbol,
 *   kind: InductionVariableKind.Basic,
 *   increment: 1,
 *   isPrimary: true
 * });
 *
 * // Analyze and get results
 * const result = analyzer.analyze();
 * ```
 */
export class LoopAnalyzer {
  /** Configuration options */
  protected readonly options: LoopAnalysisOptions;

  /** All registered loops */
  protected loops: Map<string, LoopInfo>;

  /** Counter for generating unique loop IDs */
  protected loopCounter: number;

  /** Current nesting stack during registration */
  protected nestingStack: string[];

  /**
   * Create a new loop analyzer
   *
   * @param options - Analysis options
   */
  constructor(options?: Partial<LoopAnalysisOptions>) {
    this.options = { ...DEFAULT_LOOP_OPTIONS, ...options };
    this.loops = new Map();
    this.loopCounter = 0;
    this.nestingStack = [];
  }

  /**
   * Register a new loop
   *
   * @param functionName - The function containing the loop
   * @param kind - The kind of loop
   * @param location - Source location
   * @returns Unique loop ID
   */
  public registerLoop(functionName: string, kind: LoopKind, location: SourceLocation): string {
    const id = `loop_${this.loopCounter++}`;
    const nestingDepth = this.nestingStack.length;
    const parentLoopId = nestingDepth > 0 ? this.nestingStack[nestingDepth - 1] : undefined;

    const loopInfo: LoopInfo = {
      id,
      kind,
      location,
      functionName,
      nestingDepth,
      parentLoopId,
      childLoopIds: [],
      inductionVariables: [],
      invariants: [],
      modifiedVariables: [],
      readVariables: [],
      isCountable: false,
    };

    this.loops.set(id, loopInfo);

    // Register as child of parent loop
    if (parentLoopId) {
      const parent = this.loops.get(parentLoopId);
      if (parent) {
        parent.childLoopIds.push(id);
      }
    }

    return id;
  }

  /**
   * Enter a loop (for tracking nesting)
   *
   * Call this when entering a loop during traversal.
   *
   * @param loopId - The loop ID to enter
   */
  public enterLoop(loopId: string): void {
    this.nestingStack.push(loopId);
  }

  /**
   * Exit a loop (for tracking nesting)
   *
   * Call this when exiting a loop during traversal.
   *
   * @param loopId - The loop ID to exit
   */
  public exitLoop(loopId: string): void {
    const topId = this.nestingStack.pop();
    if (topId !== loopId) {
      // Mismatch - log warning but continue
      console.warn(`Loop nesting mismatch: expected ${loopId}, got ${topId}`);
    }
  }

  /**
   * Get the current innermost loop ID
   *
   * @returns Current loop ID, or undefined if not in a loop
   */
  public getCurrentLoop(): string | undefined {
    return this.nestingStack.length > 0 ? this.nestingStack[this.nestingStack.length - 1] : undefined;
  }

  /**
   * Record a variable modified in a loop
   *
   * @param loopId - The loop ID
   * @param symbol - The modified variable
   */
  public recordModifiedVariable(loopId: string, symbol: Symbol): void {
    const loop = this.loops.get(loopId);
    if (loop && !loop.modifiedVariables.includes(symbol)) {
      loop.modifiedVariables.push(symbol);
    }
  }

  /**
   * Record a variable read in a loop
   *
   * @param loopId - The loop ID
   * @param symbol - The read variable
   */
  public recordReadVariable(loopId: string, symbol: Symbol): void {
    const loop = this.loops.get(loopId);
    if (loop && !loop.readVariables.includes(symbol)) {
      loop.readVariables.push(symbol);
    }
  }

  /**
   * Record an induction variable
   *
   * @param loopId - The loop ID
   * @param inductionVar - Induction variable information
   */
  public recordInductionVariable(loopId: string, inductionVar: InductionVariable): void {
    const loop = this.loops.get(loopId);
    if (loop) {
      loop.inductionVariables.push(inductionVar);
    }
  }

  /**
   * Record a loop invariant expression
   *
   * @param loopId - The loop ID
   * @param invariant - Loop invariant information
   */
  public recordInvariant(loopId: string, invariant: LoopInvariant): void {
    const loop = this.loops.get(loopId);
    if (loop && invariant.estimatedBenefit >= this.options.minInvariantBenefit) {
      loop.invariants.push(invariant);
    }
  }

  /**
   * Set estimated iteration count for a loop
   *
   * @param loopId - The loop ID
   * @param iterations - Estimated number of iterations
   * @param isCountable - Whether the count is compile-time known
   */
  public setIterationCount(loopId: string, iterations: number, isCountable: boolean): void {
    const loop = this.loops.get(loopId);
    if (loop) {
      loop.estimatedIterations = iterations;
      loop.isCountable = isCountable;
    }
  }

  /**
   * Set the CFG header node for a loop
   *
   * @param loopId - The loop ID
   * @param headerNode - The CFG node for the loop header
   */
  public setHeaderNode(loopId: string, headerNode: CFGNode): void {
    const loop = this.loops.get(loopId);
    if (loop) {
      loop.headerNode = headerNode;
    }
  }

  /**
   * Analyze all loops and compute derived information
   *
   * Performs:
   * 1. Loop invariant detection (if enabled)
   * 2. Identifies unroll candidates
   * 3. Computes statistics
   *
   * @returns Analysis result
   */
  public analyze(): LoopAnalysisResult {
    if (this.options.detectInvariants) {
      this.detectLoopInvariants();
    }

    return this.getResult();
  }

  /**
   * Detect loop-invariant expressions
   *
   * An expression is loop-invariant if all its operands are:
   * - Constants
   * - Variables not modified in the loop
   * - Results of other loop-invariant expressions
   */
  protected detectLoopInvariants(): void {
    for (const loop of this.loops.values()) {
      // Find variables that are read but not modified in the loop
      // These reads form potential invariant expressions
      const modifiedSet = new Set(loop.modifiedVariables.map(s => s.name));

      for (const readVar of loop.readVariables) {
        if (!modifiedSet.has(readVar.name)) {
          // This variable is invariant - it's read but not modified
          // The actual expression detection would require AST traversal
          // For now, we mark it as a potential invariant
          // The actual invariant will be recorded during AST analysis
        }
      }
    }
  }

  /**
   * Get all loop information
   *
   * @returns Map of loop ID to LoopInfo
   */
  public getLoops(): Map<string, LoopInfo> {
    return new Map(this.loops);
  }

  /**
   * Get information for a specific loop
   *
   * @param loopId - The loop ID
   * @returns Loop info, or undefined if not found
   */
  public getLoop(loopId: string): LoopInfo | undefined {
    return this.loops.get(loopId);
  }

  /**
   * Get loops in a specific function
   *
   * @param functionName - The function name
   * @returns Array of loops in that function
   */
  public getLoopsInFunction(functionName: string): LoopInfo[] {
    const result: LoopInfo[] = [];
    for (const loop of this.loops.values()) {
      if (loop.functionName === functionName) {
        result.push(loop);
      }
    }
    return result;
  }

  /**
   * Get nested loops (inner loops)
   *
   * @param loopId - The parent loop ID
   * @returns Array of child loops
   */
  public getNestedLoops(loopId: string): LoopInfo[] {
    const loop = this.loops.get(loopId);
    if (!loop) return [];

    return loop.childLoopIds
      .map(id => this.loops.get(id))
      .filter((l): l is LoopInfo => l !== undefined);
  }

  /**
   * Check if a loop is a candidate for unrolling
   *
   * @param loopId - The loop ID
   * @returns true if the loop can potentially be unrolled
   */
  public isUnrollCandidate(loopId: string): boolean {
    const loop = this.loops.get(loopId);
    if (!loop) return false;

    // Must have known iteration count
    if (!loop.isCountable || loop.estimatedIterations === undefined) return false;

    // Must not exceed max unroll threshold
    if (loop.estimatedIterations > this.options.maxUnrollIterations) return false;

    // Must have at least one iteration
    if (loop.estimatedIterations < 1) return false;

    // Should not contain nested loops (for now)
    if (loop.childLoopIds.length > 0) return false;

    return true;
  }

  /**
   * Get complete analysis result
   *
   * @returns Full analysis result with statistics
   */
  public getResult(): LoopAnalysisResult {
    let maxNestingDepth = 0;
    let totalInvariants = 0;
    let totalInductionVariables = 0;
    const unrollCandidates: string[] = [];

    for (const [id, loop] of this.loops) {
      maxNestingDepth = Math.max(maxNestingDepth, loop.nestingDepth);
      totalInvariants += loop.invariants.length;
      totalInductionVariables += loop.inductionVariables.length;

      if (this.isUnrollCandidate(id)) {
        unrollCandidates.push(id);
      }
    }

    return {
      loops: new Map(this.loops),
      totalLoops: this.loops.size,
      maxNestingDepth,
      totalInvariants,
      totalInductionVariables,
      unrollCandidates,
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

    if (result.totalLoops === 0) {
      return 'Loop Analysis: No loops found';
    }

    lines.push('=== Loop Analysis Report ===');
    lines.push('');
    lines.push('Statistics:');
    lines.push(`  Total loops: ${result.totalLoops}`);
    lines.push(`  Max nesting depth: ${result.maxNestingDepth}`);
    lines.push(`  Loop invariants: ${result.totalInvariants}`);
    lines.push(`  Induction variables: ${result.totalInductionVariables}`);
    lines.push(`  Unroll candidates: ${result.unrollCandidates.length}`);
    lines.push('');

    // Group by function
    const byFunction = new Map<string, LoopInfo[]>();
    for (const loop of this.loops.values()) {
      const existing = byFunction.get(loop.functionName) ?? [];
      existing.push(loop);
      byFunction.set(loop.functionName, existing);
    }

    for (const [funcName, loops] of byFunction) {
      lines.push(`Function: ${funcName}`);
      for (const loop of loops) {
        const indent = '  '.repeat(loop.nestingDepth + 1);
        const countInfo = loop.isCountable ? `${loop.estimatedIterations} iterations` : 'unknown count';
        lines.push(`${indent}${loop.kind} loop (${loop.id}) - ${countInfo}`);

        if (loop.inductionVariables.length > 0) {
          lines.push(`${indent}  Induction vars: ${loop.inductionVariables.map(v => v.symbol.name).join(', ')}`);
        }

        if (loop.invariants.length > 0) {
          lines.push(`${indent}  Invariants: ${loop.invariants.length} expressions`);
        }

        if (result.unrollCandidates.includes(loop.id)) {
          lines.push(`${indent}  ★ Unroll candidate`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Reset analyzer state
   */
  public reset(): void {
    this.loops.clear();
    this.loopCounter = 0;
    this.nestingStack = [];
  }
}