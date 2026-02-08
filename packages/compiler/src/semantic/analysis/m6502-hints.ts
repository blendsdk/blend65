/**
 * M6502 Hints Analyzer for Blend65 Compiler v2
 *
 * Generates 6502-specific optimization hints based on semantic analysis.
 * These hints guide code generation to produce better 6502 assembly.
 *
 * **Key Optimizations Identified:**
 * - Zero-page candidates (frequently accessed variables)
 * - Hot variables (candidates for register allocation)
 * - Memory access patterns (for bank/page optimization)
 * - Function characteristics (inline candidates, tail calls)
 *
 * **Why M6502 Hints Matter:**
 * - Zero-page access is faster and uses shorter instructions
 * - Only 256 bytes of zero-page, must allocate wisely
 * - No hardware stack for locals, frame allocation critical
 * - Branch instructions have limited range
 * - Identifying hot code paths enables better optimization
 *
 * @module semantic/analysis/m6502-hints
 */

import type { SourceLocation } from '../../ast/index.js';
import type { Symbol } from '../symbol.js';
import type { GlobalSymbolTable } from '../global-symbol-table.js';

/**
 * Types of 6502-specific hints
 */
export enum M6502HintKind {
  /** Variable should be in zero-page */
  ZeroPageCandidate = 'zero_page_candidate',
  /** Variable is frequently accessed (hot) */
  HotVariable = 'hot_variable',
  /** Function is small and should be inlined */
  InlineCandidate = 'inline_candidate',
  /** Function can use tail call optimization */
  TailCallCandidate = 'tail_call_candidate',
  /** Loop is tight and critical for performance */
  CriticalLoop = 'critical_loop',
  /** Variable can be kept in X or Y register */
  RegisterCandidate = 'register_candidate',
  /** Memory region is frequently accessed */
  HotMemoryRegion = 'hot_memory_region',
}

/**
 * Priority levels for hints
 */
export enum HintPriority {
  /** Critical for performance */
  Critical = 'critical',
  /** High impact optimization */
  High = 'high',
  /** Moderate impact */
  Medium = 'medium',
  /** Low impact (nice to have) */
  Low = 'low',
}

/**
 * A single optimization hint
 */
export interface M6502Hint {
  /** Kind of hint */
  kind: M6502HintKind;
  /** Priority level */
  priority: HintPriority;
  /** Associated symbol (if applicable) */
  symbol?: Symbol;
  /** Function name (if applicable) */
  functionName?: string;
  /** Source location */
  location: SourceLocation;
  /** Human-readable description */
  description: string;
  /** Estimated cycle savings (if quantifiable) */
  estimatedCycleSavings?: number;
  /** Estimated byte savings (if quantifiable) */
  estimatedByteSavings?: number;
  /** Additional metadata */
  metadata?: Map<string, unknown>;
}

/**
 * Zero-page allocation recommendation
 */
export interface ZeroPageRecommendation {
  /** The variable symbol */
  symbol: Symbol;
  /** Priority score (higher = more important) */
  score: number;
  /** Number of accesses to this variable */
  accessCount: number;
  /** Is this accessed in a loop? */
  inLoop: boolean;
  /** Approximate bytes needed */
  bytesNeeded: number;
  /** Reason for recommendation */
  reason: string;
}

/**
 * Information about variable access patterns
 */
export interface VariableAccessInfo {
  /** The variable symbol */
  symbol: Symbol;
  /** Total read count */
  readCount: number;
  /** Total write count */
  writeCount: number;
  /** Is this variable accessed in any loop? */
  accessedInLoop: boolean;
  /** Loop nesting depth where accessed (0 if not in loop) */
  maxLoopDepth: number;
  /** Functions that access this variable */
  accessingFunctions: string[];
}

/**
 * Function size and complexity metrics
 */
export interface FunctionMetrics {
  /** Function name */
  functionName: string;
  /** Estimated instruction count */
  instructionCount: number;
  /** Number of parameters */
  parameterCount: number;
  /** Number of local variables */
  localCount: number;
  /** Does this function call other functions? */
  makesCalls: boolean;
  /** Is the last statement a call (potential tail call)? */
  hasTailCall: boolean;
  /** Does this function contain loops? */
  hasLoops: boolean;
}

/**
 * Result of M6502 hints analysis
 */
export interface M6502HintResult {
  /** All generated hints */
  hints: M6502Hint[];
  /** Zero-page recommendations sorted by priority */
  zeroPageRecommendations: ZeroPageRecommendation[];
  /** Total estimated zero-page bytes needed */
  estimatedZeroPageNeeds: number;
  /** Functions that are inline candidates */
  inlineCandidates: string[];
  /** Functions that are tail-call candidates */
  tailCallCandidates: string[];
  /** Hot variables (frequently accessed) */
  hotVariables: Symbol[];
}

/**
 * Configuration options for M6502 hints analysis
 */
export interface M6502HintOptions {
  /** Minimum access count to consider for zero-page (default: 3) */
  minZeroPageAccessCount: number;
  /** Maximum instruction count for inline candidate (default: 20) */
  maxInlineInstructions: number;
  /** Minimum loop multiplier for hot variable (default: 10) */
  loopAccessMultiplier: number;
  /** Maximum zero-page bytes to recommend (default: 128) */
  maxZeroPageRecommendations: number;
  /** Consider loop variables as high priority (default: true) */
  prioritizeLoopVariables: boolean;
}

/**
 * Default M6502 hints options
 */
export const DEFAULT_M6502_OPTIONS: M6502HintOptions = {
  minZeroPageAccessCount: 3,
  maxInlineInstructions: 20,
  loopAccessMultiplier: 10,
  maxZeroPageRecommendations: 128,
  prioritizeLoopVariables: true,
};

/**
 * M6502 Hints Analyzer
 *
 * Analyzes semantic information to generate 6502-specific optimization hints.
 *
 * **Usage:**
 * ```typescript
 * const analyzer = new M6502HintAnalyzer(globalSymbolTable, functionSymbols);
 *
 * // Record variable access patterns during analysis
 * analyzer.recordVariableAccess(symbol, 'read', 'functionName', loopDepth);
 *
 * // Record function metrics
 * analyzer.recordFunctionMetrics({
 *   functionName: 'myFunc',
 *   instructionCount: 15,
 *   parameterCount: 2,
 *   ...
 * });
 *
 * // Generate hints
 * const result = analyzer.analyze();
 *
 * // Use zero-page recommendations
 * for (const rec of result.zeroPageRecommendations) {
 *   allocateToZeroPage(rec.symbol, rec.bytesNeeded);
 * }
 * ```
 */
export class M6502HintAnalyzer {
  /** Global symbol table */
  protected readonly globalSymbolTable: GlobalSymbolTable;

  /** Map of function name to its symbols */
  protected readonly functionSymbols: Map<string, Symbol>;

  /** Configuration options */
  protected readonly options: M6502HintOptions;

  /** Variable access tracking */
  protected variableAccess: Map<string, VariableAccessInfo>;

  /** Function metrics */
  protected functionMetrics: Map<string, FunctionMetrics>;

  /** Generated hints */
  protected hints: M6502Hint[];

  /**
   * Create a new M6502 hints analyzer
   *
   * @param globalSymbolTable - Global symbol table
   * @param functionSymbols - Map of function names to symbols
   * @param options - Analysis options
   */
  constructor(
    globalSymbolTable: GlobalSymbolTable,
    functionSymbols: Map<string, Symbol>,
    options?: Partial<M6502HintOptions>
  ) {
    this.globalSymbolTable = globalSymbolTable;
    this.functionSymbols = functionSymbols;
    this.options = { ...DEFAULT_M6502_OPTIONS, ...options };
    this.variableAccess = new Map();
    this.functionMetrics = new Map();
    this.hints = [];
  }

  /**
   * Record a variable access
   *
   * @param symbol - The variable symbol
   * @param accessType - 'read' or 'write'
   * @param functionName - Function where access occurs
   * @param loopDepth - Current loop nesting depth (0 = not in loop)
   */
  public recordVariableAccess(
    symbol: Symbol,
    accessType: 'read' | 'write',
    functionName: string,
    loopDepth: number = 0
  ): void {
    const key = this.getSymbolKey(symbol);
    let info = this.variableAccess.get(key);

    if (!info) {
      info = {
        symbol,
        readCount: 0,
        writeCount: 0,
        accessedInLoop: false,
        maxLoopDepth: 0,
        accessingFunctions: [],
      };
      this.variableAccess.set(key, info);
    }

    // Update counts
    if (accessType === 'read') {
      info.readCount++;
    } else {
      info.writeCount++;
    }

    // Track loop access
    if (loopDepth > 0) {
      info.accessedInLoop = true;
      info.maxLoopDepth = Math.max(info.maxLoopDepth, loopDepth);
    }

    // Track accessing functions
    if (!info.accessingFunctions.includes(functionName)) {
      info.accessingFunctions.push(functionName);
    }
  }

  /**
   * Record function metrics
   *
   * @param metrics - Function metrics data
   */
  public recordFunctionMetrics(metrics: FunctionMetrics): void {
    this.functionMetrics.set(metrics.functionName, metrics);
  }

  /**
   * Analyze and generate M6502-specific hints
   *
   * @returns Analysis result with hints and recommendations
   */
  public analyze(): M6502HintResult {
    this.hints = [];

    // Generate zero-page recommendations
    const zeroPageRecs = this.generateZeroPageRecommendations();

    // Identify inline candidates
    const inlineCandidates = this.identifyInlineCandidates();

    // Identify tail-call candidates
    const tailCallCandidates = this.identifyTailCallCandidates();

    // Identify hot variables
    const hotVariables = this.identifyHotVariables();

    // Calculate total zero-page needs
    let estimatedZeroPageNeeds = 0;
    for (const rec of zeroPageRecs) {
      estimatedZeroPageNeeds += rec.bytesNeeded;
    }

    return {
      hints: [...this.hints],
      zeroPageRecommendations: zeroPageRecs,
      estimatedZeroPageNeeds,
      inlineCandidates,
      tailCallCandidates,
      hotVariables,
    };
  }

  /**
   * Generate zero-page allocation recommendations
   *
   * Scores variables based on:
   * - Access frequency
   * - Loop multiplier
   * - Variable size
   */
  protected generateZeroPageRecommendations(): ZeroPageRecommendation[] {
    const recommendations: ZeroPageRecommendation[] = [];

    for (const info of this.variableAccess.values()) {
      const totalAccess = info.readCount + info.writeCount;

      // Skip if below threshold
      if (totalAccess < this.options.minZeroPageAccessCount) {
        continue;
      }

      // Calculate score
      let score = totalAccess;

      // Apply loop multiplier
      if (info.accessedInLoop && this.options.prioritizeLoopVariables) {
        score *= this.options.loopAccessMultiplier * (info.maxLoopDepth + 1);
      }

      // Estimate bytes needed
      const bytesNeeded = this.estimateVariableSize(info.symbol);

      // Generate recommendation
      const reason = info.accessedInLoop
        ? `Accessed ${totalAccess} times (in loop depth ${info.maxLoopDepth})`
        : `Accessed ${totalAccess} times`;

      recommendations.push({
        symbol: info.symbol,
        score,
        accessCount: totalAccess,
        inLoop: info.accessedInLoop,
        bytesNeeded,
        reason,
      });

      // Add hint
      this.hints.push({
        kind: M6502HintKind.ZeroPageCandidate,
        priority: this.scoreToPriority(score),
        symbol: info.symbol,
        location: info.symbol.location,
        description: `Variable '${info.symbol.name}' is a zero-page candidate: ${reason}`,
        estimatedCycleSavings: this.estimateCycleSavings(info),
        estimatedByteSavings: this.estimateByteSavings(info),
      });
    }

    // Sort by score (descending) and limit
    recommendations.sort((a, b) => b.score - a.score);

    // Limit to max recommendations while respecting byte limit
    const limited: ZeroPageRecommendation[] = [];
    let totalBytes = 0;

    for (const rec of recommendations) {
      if (totalBytes + rec.bytesNeeded <= this.options.maxZeroPageRecommendations) {
        limited.push(rec);
        totalBytes += rec.bytesNeeded;
      }
    }

    return limited;
  }

  /**
   * Identify functions that are candidates for inlining
   */
  protected identifyInlineCandidates(): string[] {
    const candidates: string[] = [];

    for (const [name, metrics] of this.functionMetrics) {
      if (this.isInlineCandidate(metrics)) {
        candidates.push(name);

        this.hints.push({
          kind: M6502HintKind.InlineCandidate,
          priority: HintPriority.Medium,
          functionName: name,
          location: this.getFunctionLocation(name),
          description: `Function '${name}' is an inline candidate (${metrics.instructionCount} instructions, ${metrics.parameterCount} params)`,
        });
      }
    }

    return candidates;
  }

  /**
   * Check if a function is a candidate for inlining
   */
  protected isInlineCandidate(metrics: FunctionMetrics): boolean {
    // Must be small
    if (metrics.instructionCount > this.options.maxInlineInstructions) {
      return false;
    }

    // Should not have complex control flow (loops)
    // Small functions with loops might still be inline candidates
    // but require more analysis

    // Should have few parameters (easier to inline)
    if (metrics.parameterCount > 4) {
      return false;
    }

    return true;
  }

  /**
   * Identify functions that are candidates for tail-call optimization
   */
  protected identifyTailCallCandidates(): string[] {
    const candidates: string[] = [];

    for (const [name, metrics] of this.functionMetrics) {
      if (metrics.hasTailCall) {
        candidates.push(name);

        this.hints.push({
          kind: M6502HintKind.TailCallCandidate,
          priority: HintPriority.Low,
          functionName: name,
          location: this.getFunctionLocation(name),
          description: `Function '${name}' has a potential tail call`,
        });
      }
    }

    return candidates;
  }

  /**
   * Identify hot (frequently accessed) variables
   */
  protected identifyHotVariables(): Symbol[] {
    const hot: Symbol[] = [];
    const threshold = this.options.minZeroPageAccessCount * 2;

    for (const info of this.variableAccess.values()) {
      const totalAccess = info.readCount + info.writeCount;
      let effectiveAccess = totalAccess;

      if (info.accessedInLoop) {
        effectiveAccess *= this.options.loopAccessMultiplier;
      }

      if (effectiveAccess >= threshold) {
        hot.push(info.symbol);

        if (info.accessedInLoop) {
          this.hints.push({
            kind: M6502HintKind.HotVariable,
            priority: HintPriority.High,
            symbol: info.symbol,
            location: info.symbol.location,
            description: `Variable '${info.symbol.name}' is hot (${totalAccess} accesses, in loop)`,
          });
        }
      }
    }

    return hot;
  }

  /**
   * Get a specific hint for a function
   *
   * @param functionName - The function name
   * @returns Hints for that function
   */
  public getHintsForFunction(functionName: string): M6502Hint[] {
    return this.hints.filter((h) => h.functionName === functionName);
  }

  /**
   * Get a specific hint for a variable
   *
   * @param symbol - The variable symbol
   * @returns Hints for that variable
   */
  public getHintsForVariable(symbol: Symbol): M6502Hint[] {
    return this.hints.filter(
      (h) => h.symbol && this.getSymbolKey(h.symbol) === this.getSymbolKey(symbol)
    );
  }

  /**
   * Check if a variable is a zero-page candidate
   *
   * @param symbol - The variable to check
   * @returns true if recommended for zero-page
   */
  public isZeroPageCandidate(symbol: Symbol): boolean {
    const result = this.analyze();
    return result.zeroPageRecommendations.some(
      (r) => this.getSymbolKey(r.symbol) === this.getSymbolKey(symbol)
    );
  }

  /**
   * Get unique key for a symbol
   */
  protected getSymbolKey(symbol: Symbol): string {
    return `${symbol.scope.id}::${symbol.name}`;
  }

  /**
   * Estimate variable size in bytes
   */
  protected estimateVariableSize(symbol: Symbol): number {
    const type = symbol.type;
    if (!type) return 1; // Default to 1 byte

    return type.size ?? 1;
  }

  /**
   * Convert score to priority level
   */
  protected scoreToPriority(score: number): HintPriority {
    if (score >= 100) return HintPriority.Critical;
    if (score >= 50) return HintPriority.High;
    if (score >= 20) return HintPriority.Medium;
    return HintPriority.Low;
  }

  /**
   * Estimate cycle savings from zero-page allocation
   */
  protected estimateCycleSavings(info: VariableAccessInfo): number {
    // Zero-page saves ~1 cycle per access vs absolute addressing
    let savings = info.readCount + info.writeCount;

    // Loop accesses are multiplied (assume 10 iterations average)
    if (info.accessedInLoop) {
      savings *= 10;
    }

    return savings;
  }

  /**
   * Estimate byte savings from zero-page allocation
   */
  protected estimateByteSavings(info: VariableAccessInfo): number {
    // Zero-page saves 1 byte per access (2-byte vs 3-byte instruction)
    let savings = info.readCount + info.writeCount;

    // Note: loop multiplier doesn't apply to code size
    return savings;
  }

  /**
   * Get function location (fallback to zero location)
   */
  protected getFunctionLocation(functionName: string): SourceLocation {
    const symbol = this.functionSymbols.get(functionName);
    return (
      symbol?.location ?? {
        start: { line: 0, column: 0, offset: 0 },
        end: { line: 0, column: 0, offset: 0 },
      }
    );
  }

  /**
   * Format a human-readable report
   *
   * @returns Multi-line string with analysis results
   */
  public formatReport(): string {
    const result = this.analyze();
    const lines: string[] = [];

    lines.push('=== M6502 Optimization Hints Report ===');
    lines.push('');

    // Zero-page recommendations
    if (result.zeroPageRecommendations.length > 0) {
      lines.push('Zero-Page Recommendations:');
      lines.push(`  Estimated total: ${result.estimatedZeroPageNeeds} bytes`);
      lines.push('');

      for (const rec of result.zeroPageRecommendations.slice(0, 10)) {
        const loopTag = rec.inLoop ? ' [LOOP]' : '';
        lines.push(`  ${rec.symbol.name}: score ${rec.score.toFixed(0)}, ${rec.bytesNeeded}B${loopTag}`);
        lines.push(`    ${rec.reason}`);
      }

      if (result.zeroPageRecommendations.length > 10) {
        lines.push(`  ... and ${result.zeroPageRecommendations.length - 10} more`);
      }
      lines.push('');
    }

    // Inline candidates
    if (result.inlineCandidates.length > 0) {
      lines.push('Inline Candidates:');
      for (const name of result.inlineCandidates) {
        const metrics = this.functionMetrics.get(name);
        if (metrics) {
          lines.push(`  ${name}: ${metrics.instructionCount} instructions, ${metrics.parameterCount} params`);
        }
      }
      lines.push('');
    }

    // Tail-call candidates
    if (result.tailCallCandidates.length > 0) {
      lines.push('Tail-Call Candidates:');
      for (const name of result.tailCallCandidates) {
        lines.push(`  ${name}`);
      }
      lines.push('');
    }

    // Hot variables
    if (result.hotVariables.length > 0) {
      lines.push('Hot Variables:');
      for (const symbol of result.hotVariables.slice(0, 10)) {
        const info = this.variableAccess.get(this.getSymbolKey(symbol));
        if (info) {
          const loopTag = info.accessedInLoop ? ' [LOOP]' : '';
          lines.push(`  ${symbol.name}: ${info.readCount}R/${info.writeCount}W${loopTag}`);
        }
      }
      lines.push('');
    }

    // Summary
    lines.push('Summary:');
    lines.push(`  Total hints: ${result.hints.length}`);
    lines.push(`  Zero-page candidates: ${result.zeroPageRecommendations.length}`);
    lines.push(`  Inline candidates: ${result.inlineCandidates.length}`);
    lines.push(`  Hot variables: ${result.hotVariables.length}`);

    return lines.join('\n');
  }

  /**
   * Reset analyzer state
   */
  public reset(): void {
    this.variableAccess.clear();
    this.functionMetrics.clear();
    this.hints = [];
  }
}