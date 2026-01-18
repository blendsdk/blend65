/**
 * VIC-II Timing Analyzer
 *
 * Analyzes C64 code for VIC-II graphics timing constraints.
 * This is part of Tier 4 (God-Level) hardware analysis.
 *
 * **VIC-II Timing Constants (PAL):**
 * - 63 CPU cycles per raster line
 * - 312 lines per frame (50 Hz)
 * - Badlines steal 40 cycles (every 8th line in text mode)
 *
 * **Analysis Capabilities:**
 * - Estimate cycle counts for statements and loops
 * - Detect badline-sensitive code sections
 * - Validate raster timing constraints
 * - Hardware penalty detection (sprite DMA, page crossing)
 *
 * **Integration:**
 * This module is called from `C64HardwareAnalyzer.analyzeGraphics()`
 * to provide detailed VIC-II timing analysis.
 *
 * @example
 * ```typescript
 * const timing = new VICIITimingAnalyzer(c64Config);
 * const cycles = timing.estimateStatementCycles(statement);
 * const isSafe = timing.isRasterSafe(loopBody, cyclesAvailable);
 * ```
 */

import type { TargetConfig } from '../../../../target/config.js';
import { ASTNodeType, type Statement, type SourceLocation, type Expression } from '../../../../ast/base.js';
import {
  type VariableDecl,
  type ExpressionStatement,
  type ReturnStatement,
  type IfStatement,
  type WhileStatement,
  type ForStatement,
  type MatchStatement,
  type BinaryExpression,
  type UnaryExpression,
  type CallExpression,
  type IndexExpression,
  type AssignmentExpression,
  type ArrayLiteralExpression,
  LiteralExpression,
} from '../../../../ast/nodes.js';
import { TokenType } from '../../../../lexer/types.js';

// ============================================
// VIC-II Timing Constants
// ============================================

/**
 * VIC-II timing constants derived from target configuration
 *
 * These constants are critical for raster timing analysis.
 * Values differ between PAL and NTSC systems.
 */
export interface VICIITimingConstants {
  /** CPU cycles per raster line (PAL: 63, NTSC: 65) */
  readonly cyclesPerLine: number;

  /** Raster lines per frame (PAL: 312, NTSC: 262) */
  readonly linesPerFrame: number;

  /** Cycles stolen by badlines (40 cycles) */
  readonly badlinePenalty: number;

  /** Total cycles per frame */
  readonly cyclesPerFrame: number;

  /** Available cycles on a non-badline (cyclesPerLine) */
  readonly normalLineCycles: number;

  /** Available cycles on a badline (cyclesPerLine - badlinePenalty) */
  readonly badlineCycles: number;
}

/**
 * Default cycle estimates for basic operations
 *
 * These are rough estimates for semantic analysis.
 * Actual cycles depend on addressing modes and operands.
 */
export const CYCLE_ESTIMATES = {
  /** Variable assignment (LDA + STA) */
  ASSIGNMENT: 5,

  /** Binary operation (LDA + OP + STA) */
  BINARY_OP: 8,

  /** Unary operation (LDA + OP + STA) */
  UNARY_OP: 6,

  /** Conditional branch (BEQ/BNE/etc) */
  BRANCH: 3,

  /** Function call (JSR + RTS) */
  FUNCTION_CALL: 12,

  /** Return statement (RTS) */
  RETURN: 6,

  /** Loop overhead per iteration (branch + increment) */
  LOOP_OVERHEAD: 5,

  /** Default for unknown statements */
  DEFAULT: 2,
} as const;

/**
 * Hardware penalty estimates for C64-specific operations
 */
export const HARDWARE_PENALTIES = {
  /** Cycles stolen per active sprite (DMA) */
  SPRITE_DMA_PER_SPRITE: 2,

  /** Additional cycle for page crossing */
  PAGE_CROSSING: 1,

  /** Additional cycles for read-modify-write operations */
  RMW_PENALTY: 2,

  /** Maximum sprites that can be active */
  MAX_SPRITES: 8,
} as const;

// ============================================
// VIC-II Timing Result Types
// ============================================

/**
 * Result of cycle estimation for a code section
 */
export interface CycleEstimate {
  /** Minimum estimated cycles */
  readonly minCycles: number;

  /** Maximum estimated cycles (worst case) */
  readonly maxCycles: number;

  /** Average estimated cycles */
  readonly avgCycles: number;

  /** Includes hardware penalties (sprite DMA, etc.) */
  readonly includesHardwarePenalties: boolean;

  /** Breakdown by operation type (optional) */
  readonly breakdown?: CycleBreakdown;
}

/**
 * Detailed breakdown of cycle estimates by operation type
 */
export interface CycleBreakdown {
  /** Cycles from assignments */
  readonly assignments: number;

  /** Cycles from binary operations */
  readonly binaryOps: number;

  /** Cycles from function calls */
  readonly functionCalls: number;

  /** Cycles from branches */
  readonly branches: number;

  /** Cycles from other operations */
  readonly other: number;
}

/**
 * Result of loop cycle estimation
 *
 * Provides detailed cycle analysis for loops including
 * iteration detection and body cycle breakdown.
 */
export interface LoopCycleEstimate {
  /** Total estimated cycles for the entire loop */
  readonly totalCycles: number;

  /** Cycles per iteration (body + overhead) */
  readonly cyclesPerIteration: number;

  /** Estimated or known iteration count */
  readonly iterations: number;

  /** Whether iteration count is known (from literals) or estimated */
  readonly iterationsKnown: boolean;

  /** Setup cycles (before loop starts) */
  readonly setupCycles: number;

  /** Body cycles (per iteration) */
  readonly bodyCycles: number;

  /** Loop overhead cycles per iteration (branch + increment) */
  readonly overheadCycles: number;

  /** Breakdown by operation type in the loop body */
  readonly bodyBreakdown?: CycleBreakdown;
}

/**
 * Default iteration estimate for loops with unknown bounds
 */
export const DEFAULT_LOOP_ITERATIONS = 10;

/**
 * Result of hardware penalty analysis
 *
 * Provides detailed breakdown of hardware penalties that
 * affect cycle timing on the C64/VIC-II.
 */
export interface HardwarePenalties {
  /** Total hardware penalty cycles */
  readonly totalPenalty: number;

  /** Cycles stolen by sprite DMA */
  readonly spriteDMAPenalty: number;

  /** Cycles added by page crossing */
  readonly pageCrossingPenalty: number;

  /** Cycles added by RMW operations */
  readonly rmwPenalty: number;

  /** Number of active sprites detected */
  readonly activeSprites: number;

  /** Number of potential page crossings detected */
  readonly pageCrossings: number;

  /** Number of RMW operations detected */
  readonly rmwOperations: number;
}

/**
 * Result of raster safety analysis
 */
export interface RasterSafetyResult {
  /** Is the code safe for raster timing? */
  readonly isSafe: boolean;

  /** Estimated cycles for the code section */
  readonly estimatedCycles: number;

  /** Available cycles in the raster context */
  readonly availableCycles: number;

  /** Margin (positive = safe, negative = overflow) */
  readonly margin: number;

  /** Warning messages for timing concerns */
  readonly warnings: string[];

  /** Is this code badline-aware? */
  readonly isBadlineAware: boolean;
}

/**
 * Badline information for a code section
 */
export interface BadlineInfo {
  /** Is the code in a badline-sensitive region? */
  readonly isBadlineSensitive: boolean;

  /** Cycles available on badlines */
  readonly badlineCyclesAvailable: number;

  /** Cycles available on normal lines */
  readonly normalCyclesAvailable: number;

  /** Recommendation for handling badlines */
  readonly recommendation: BadlineRecommendation;
}

/**
 * Recommendations for handling badline-sensitive code
 */
export enum BadlineRecommendation {
  /** Code is safe, no action needed */
  SAFE = 'safe',

  /** Consider splitting across multiple lines */
  SPLIT_ACROSS_LINES = 'split_across_lines',

  /** Use stable raster technique */
  USE_STABLE_RASTER = 'use_stable_raster',

  /** Disable badlines (set $D011 bit 3) */
  DISABLE_BADLINES = 'disable_badlines',

  /** Code is too long for raster-safe execution */
  TOO_LONG = 'too_long',
}

/**
 * VIC-II timing warning
 */
export interface VICIITimingWarning {
  /** Warning message */
  readonly message: string;

  /** Source location */
  readonly location: SourceLocation;

  /** Severity (info, warning, error) */
  readonly severity: 'info' | 'warning' | 'error';

  /** Estimated cycles that caused the warning */
  readonly estimatedCycles?: number;

  /** Available cycles for context */
  readonly availableCycles?: number;
}

/**
 * Raster safety metadata for code sections
 *
 * This metadata is used to annotate functions and loops
 * with VIC-II timing characteristics for code generation.
 *
 * **Metadata Keys:**
 * - `VICIIRasterSafe`: Code fits within raster line timing
 * - `VICIIBadlineAware`: Code accounts for badline stealing cycles
 *
 * **Usage in Code Generation:**
 * Code marked as `VICIIRasterSafe` can be placed in
 * timing-critical sections without additional checks.
 * Code marked as `VICIIBadlineAware` handles both
 * normal lines and badlines correctly.
 */
export interface RasterSafetyMetadata {
  /**
   * Is code safe for raster timing on normal lines?
   *
   * True when estimated cycles <= cyclesPerLine
   */
  readonly VICIIRasterSafe: boolean;

  /**
   * Is code safe for raster timing on badlines?
   *
   * True when estimated cycles <= badlineCycles
   * This is stricter than VICIIRasterSafe.
   */
  readonly VICIIBadlineAware: boolean;

  /**
   * Estimated cycle count for the code section
   */
  readonly estimatedCycles: number;

  /**
   * Maximum safe cycles (depends on context)
   */
  readonly maxSafeCycles: number;

  /**
   * Cycle margin (positive = safe, negative = overflow)
   */
  readonly cycleMargin: number;

  /**
   * Badline recommendation for this code
   */
  readonly recommendation: BadlineRecommendation;

  /**
   * Number of raster lines this code spans
   */
  readonly linesRequired: number;

  /**
   * Is this code suitable for stable raster routines?
   *
   * Stable raster requires very precise timing (<= 1 cycle variance)
   */
  readonly stableRasterCompatible: boolean;
}

// ============================================
// VIC-II Timing Analyzer Class
// ============================================

/**
 * VIC-II Timing Analyzer
 *
 * Provides cycle estimation and raster timing analysis
 * for C64 VIC-II graphics operations.
 *
 * **Usage:**
 * 1. Create analyzer with target config
 * 2. Use `estimateStatementCycles()` for individual statements
 * 3. Use `estimateLoopCycles()` for loop analysis
 * 4. Use `checkRasterSafety()` for timing validation
 *
 * **Integration with C64HardwareAnalyzer:**
 * This class provides the core timing logic that
 * `C64HardwareAnalyzer.analyzeGraphics()` uses for Tier 4 analysis.
 */
export class VICIITimingAnalyzer {
  /** VIC-II timing constants from target config */
  protected readonly timingConstants: VICIITimingConstants;

  /** Warnings collected during analysis */
  protected warnings: VICIITimingWarning[] = [];

  /**
   * Creates a VIC-II timing analyzer
   *
   * @param targetConfig - C64 target configuration
   * @throws Error if target has no graphics chip configuration
   */
  constructor(protected readonly targetConfig: TargetConfig) {
    // Extract timing constants from target config
    const graphics = targetConfig.graphicsChip;

    // VIC-II timing analyzer requires graphics chip configuration
    if (!graphics) {
      throw new Error(
        `VICIITimingAnalyzer requires a target with graphics chip configuration. ` +
          `Target "${targetConfig.architecture}" has no graphics chip.`
      );
    }

    this.timingConstants = {
      cyclesPerLine: graphics.cyclesPerLine,
      linesPerFrame: graphics.linesPerFrame,
      badlinePenalty: graphics.badlinePenalty,
      cyclesPerFrame: graphics.cyclesPerLine * graphics.linesPerFrame,
      normalLineCycles: graphics.cyclesPerLine,
      badlineCycles: graphics.cyclesPerLine - graphics.badlinePenalty,
    };
  }

  // ============================================
  // Public API: Timing Constants
  // ============================================

  /**
   * Get VIC-II timing constants
   *
   * @returns Timing constants for this configuration
   */
  public getTimingConstants(): VICIITimingConstants {
    return { ...this.timingConstants };
  }

  /**
   * Get cycles available per raster line (non-badline)
   *
   * @returns Cycles per normal raster line
   */
  public getCyclesPerLine(): number {
    return this.timingConstants.cyclesPerLine;
  }

  /**
   * Get cycles available on a badline
   *
   * @returns Cycles available during a badline
   */
  public getBadlineCycles(): number {
    return this.timingConstants.badlineCycles;
  }

  /**
   * Get badline penalty (cycles stolen)
   *
   * @returns Cycles stolen by VIC-II during badlines
   */
  public getBadlinePenalty(): number {
    return this.timingConstants.badlinePenalty;
  }

  /**
   * Get total cycles per frame
   *
   * @returns Total cycles in one frame
   */
  public getCyclesPerFrame(): number {
    return this.timingConstants.cyclesPerFrame;
  }

  // ============================================
  // Public API: Cycle Estimation
  // ============================================

  /**
   * Estimate cycles for a single expression
   *
   * Recursively analyzes expression complexity to provide
   * more accurate cycle estimates than simple statement-level analysis.
   *
   * **Cycle Estimates by Expression Type:**
   * - Literal/Identifier: 2-3 cycles (LDA)
   * - Unary: 6 cycles (LDA + OP + STA)
   * - Binary: 8 cycles + operands (LDA + OP + STA)
   * - Call: 12 cycles + arguments
   * - Index: 5 cycles (base array access)
   * - Assignment: 5 cycles + value expression
   *
   * @param expression - Expression to estimate
   * @returns Estimated cycles for the expression
   */
  public estimateExpressionCycles(expression: Expression): number {
    const nodeType = expression.getNodeType();

    switch (nodeType) {
      case ASTNodeType.LITERAL_EXPR:
        // Literal value: typically LDA #immediate (2 cycles)
        return 2;

      case ASTNodeType.IDENTIFIER_EXPR:
        // Variable load: LDA absolute (4 cycles) or LDA zeropage (3 cycles)
        // Use average for semantic analysis
        return 3;

      case ASTNodeType.UNARY_EXPR: {
        // Unary operation: load + operation + store
        const unaryExpr = expression as UnaryExpression;
        const operandCycles = this.estimateExpressionCycles(unaryExpr.getOperand());
        return CYCLE_ESTIMATES.UNARY_OP + operandCycles;
      }

      case ASTNodeType.BINARY_EXPR: {
        // Binary operation: load left + operation + load right + store result
        const binaryExpr = expression as BinaryExpression;
        const leftCycles = this.estimateExpressionCycles(binaryExpr.getLeft());
        const rightCycles = this.estimateExpressionCycles(binaryExpr.getRight());
        return CYCLE_ESTIMATES.BINARY_OP + leftCycles + rightCycles;
      }

      case ASTNodeType.CALL_EXPR: {
        // Function call: JSR/RTS overhead + argument setup
        const callExpr = expression as CallExpression;
        let argCycles = 0;
        for (const arg of callExpr.getArguments()) {
          argCycles += this.estimateExpressionCycles(arg);
          argCycles += 3; // Additional cycles to push argument
        }
        return CYCLE_ESTIMATES.FUNCTION_CALL + argCycles;
      }

      case ASTNodeType.INDEX_EXPR: {
        // Array indexing: calculate address + load
        const indexExpr = expression as IndexExpression;
        const indexCycles = this.estimateExpressionCycles(indexExpr.getIndex());
        // Base object access + index calculation + indexed load
        return 5 + indexCycles;
      }

      case ASTNodeType.MEMBER_EXPR:
        // Member access (struct field): similar to variable load
        return 4;

      case ASTNodeType.ASSIGNMENT_EXPR: {
        // Assignment: evaluate value + store
        const assignExpr = expression as AssignmentExpression;
        const valueCycles = this.estimateExpressionCycles(assignExpr.getValue());
        return CYCLE_ESTIMATES.ASSIGNMENT + valueCycles;
      }

      case ASTNodeType.ARRAY_LITERAL_EXPR: {
        // Array literal: initialize each element
        const arrayExpr = expression as ArrayLiteralExpression;
        let elementCycles = 0;
        for (const element of arrayExpr.getElements()) {
          elementCycles += this.estimateExpressionCycles(element);
          elementCycles += 4; // Store each element
        }
        return elementCycles;
      }

      default:
        return CYCLE_ESTIMATES.DEFAULT;
    }
  }

  /**
   * Estimate cycles for a single statement
   *
   * Provides sophisticated cycle estimation by analyzing
   * the expressions within statements.
   *
   * **Statement Cycle Breakdown:**
   * - Variable declaration: ASSIGNMENT + initializer expression
   * - Expression statement: Depends on expression type
   * - Return: RETURN + optional return value
   * - If: BRANCH + condition expression
   * - Loops: BRANCH + condition (body calculated separately)
   *
   * @param statement - Statement to estimate
   * @returns Cycle estimate with breakdown
   */
  public estimateStatementCycles(statement: Statement): CycleEstimate {
    const nodeType = statement.getNodeType();

    let minCycles: number;
    let maxCycles: number;
    let avgCycles: number;

    // Track breakdown categories
    let assignmentsCycles = 0;
    let binaryOpsCycles = 0;
    let functionCallsCycles = 0;
    let branchesCycles = 0;
    let otherCycles = 0;

    switch (nodeType) {
      case ASTNodeType.VARIABLE_DECL: {
        // Variable declaration with optional initializer
        const varDecl = statement as VariableDecl;
        const initializer = varDecl.getInitializer();
        if (initializer) {
          const initCycles = this.estimateExpressionCycles(initializer);
          minCycles = CYCLE_ESTIMATES.ASSIGNMENT + initCycles;
          assignmentsCycles = minCycles;
        } else {
          // Declaration without initializer (just reserves space)
          minCycles = 0;
        }
        maxCycles = minCycles + HARDWARE_PENALTIES.PAGE_CROSSING;
        avgCycles = minCycles;
        break;
      }

      case ASTNodeType.EXPR_STMT: {
        // Expression statement: depends on the expression type
        const exprStmt = statement as ExpressionStatement;
        const expr = exprStmt.getExpression();
        const exprCycles = this.estimateExpressionCycles(expr);

        // Categorize for breakdown
        const exprType = expr.getNodeType();
        if (exprType === ASTNodeType.ASSIGNMENT_EXPR) {
          assignmentsCycles = exprCycles;
        } else if (exprType === ASTNodeType.BINARY_EXPR) {
          binaryOpsCycles = exprCycles;
        } else if (exprType === ASTNodeType.CALL_EXPR) {
          functionCallsCycles = exprCycles;
        } else {
          otherCycles = exprCycles;
        }

        minCycles = exprCycles;
        maxCycles = exprCycles + HARDWARE_PENALTIES.PAGE_CROSSING;
        avgCycles = exprCycles;
        break;
      }

      case ASTNodeType.RETURN_STMT: {
        // Return statement with optional return value
        const returnStmt = statement as ReturnStatement;
        const returnValue = returnStmt.getValue();
        if (returnValue) {
          const valueCycles = this.estimateExpressionCycles(returnValue);
          minCycles = CYCLE_ESTIMATES.RETURN + valueCycles;
        } else {
          minCycles = CYCLE_ESTIMATES.RETURN;
        }
        maxCycles = minCycles + HARDWARE_PENALTIES.PAGE_CROSSING;
        avgCycles = minCycles;
        otherCycles = minCycles;
        break;
      }

      case ASTNodeType.IF_STMT: {
        // If statement: condition evaluation + branch
        const ifStmt = statement as IfStatement;
        const conditionCycles = this.estimateExpressionCycles(ifStmt.getCondition());
        // Note: Branch bodies are analyzed separately for more accurate timing
        minCycles = CYCLE_ESTIMATES.BRANCH + conditionCycles;
        maxCycles = minCycles + HARDWARE_PENALTIES.PAGE_CROSSING;
        avgCycles = minCycles;
        branchesCycles = minCycles;
        break;
      }

      case ASTNodeType.WHILE_STMT: {
        // While loop: condition evaluation + branch (per iteration)
        const whileStmt = statement as WhileStatement;
        const conditionCycles = this.estimateExpressionCycles(whileStmt.getCondition());
        minCycles = CYCLE_ESTIMATES.BRANCH + conditionCycles;
        maxCycles = minCycles + HARDWARE_PENALTIES.PAGE_CROSSING;
        avgCycles = minCycles;
        branchesCycles = minCycles;
        break;
      }

      case ASTNodeType.FOR_STMT: {
        // For loop: setup + per-iteration overhead
        const forStmt = statement as ForStatement;
        const startCycles = this.estimateExpressionCycles(forStmt.getStart());
        const endCycles = this.estimateExpressionCycles(forStmt.getEnd());
        // Setup cost: initialize variable + evaluate bounds
        minCycles = CYCLE_ESTIMATES.ASSIGNMENT + startCycles + endCycles + CYCLE_ESTIMATES.BRANCH;
        maxCycles = minCycles + HARDWARE_PENALTIES.PAGE_CROSSING;
        avgCycles = minCycles;
        branchesCycles = CYCLE_ESTIMATES.BRANCH;
        assignmentsCycles = CYCLE_ESTIMATES.ASSIGNMENT + startCycles;
        break;
      }

      case ASTNodeType.MATCH_STMT: {
        // Match statement: evaluate value + branch per case
        const matchStmt = statement as MatchStatement;
        const valueCycles = this.estimateExpressionCycles(matchStmt.getValue());
        const cases = matchStmt.getCases();
        // Each case requires a comparison
        const caseBranchCycles = cases.length * CYCLE_ESTIMATES.BRANCH;
        minCycles = valueCycles + caseBranchCycles;
        maxCycles = minCycles + HARDWARE_PENALTIES.PAGE_CROSSING;
        avgCycles = minCycles;
        branchesCycles = caseBranchCycles;
        break;
      }

      case ASTNodeType.BREAK_STMT:
      case ASTNodeType.CONTINUE_STMT:
        // Control flow: just a branch
        minCycles = CYCLE_ESTIMATES.BRANCH;
        maxCycles = minCycles + HARDWARE_PENALTIES.PAGE_CROSSING;
        avgCycles = minCycles;
        branchesCycles = minCycles;
        break;

      case ASTNodeType.BLOCK_STMT:
        // Block: sum of contained statements (handled by estimateBlockCycles)
        minCycles = 0;
        maxCycles = 0;
        avgCycles = 0;
        break;

      default:
        minCycles = CYCLE_ESTIMATES.DEFAULT;
        maxCycles = minCycles + HARDWARE_PENALTIES.PAGE_CROSSING;
        avgCycles = minCycles;
        otherCycles = minCycles;
    }

    return {
      minCycles,
      maxCycles,
      avgCycles,
      includesHardwarePenalties: false,
      breakdown: {
        assignments: assignmentsCycles,
        binaryOps: binaryOpsCycles,
        functionCalls: functionCallsCycles,
        branches: branchesCycles,
        other: otherCycles,
      },
    };
  }

  /**
   * Estimate cycles for a sequence of statements
   *
   * @param statements - Array of statements
   * @returns Combined cycle estimate
   */
  public estimateBlockCycles(statements: Statement[]): CycleEstimate {
    let totalMin = 0;
    let totalMax = 0;
    let totalAvg = 0;

    // Use mutable tracking for breakdown, then convert to readonly result
    let assignmentsCycles = 0;
    let binaryOpsCycles = 0;
    let functionCallsCycles = 0;
    let branchesCycles = 0;
    let otherCycles = 0;

    for (const stmt of statements) {
      const estimate = this.estimateStatementCycles(stmt);
      totalMin += estimate.minCycles;
      totalMax += estimate.maxCycles;
      totalAvg += estimate.avgCycles;

      // Update breakdown based on statement type
      const nodeType = stmt.getNodeType();
      if (nodeType === ASTNodeType.EXPR_STMT || nodeType === ASTNodeType.VARIABLE_DECL) {
        // Expression statements include assignments (x = 5)
        assignmentsCycles += estimate.avgCycles;
      } else if (nodeType === ASTNodeType.IF_STMT || nodeType === ASTNodeType.WHILE_STMT) {
        branchesCycles += estimate.avgCycles;
      } else {
        otherCycles += estimate.avgCycles;
      }
    }

    // Create readonly breakdown object
    const breakdown: CycleBreakdown = {
      assignments: assignmentsCycles,
      binaryOps: binaryOpsCycles,
      functionCalls: functionCallsCycles,
      branches: branchesCycles,
      other: otherCycles,
    };

    return {
      minCycles: totalMin,
      maxCycles: totalMax,
      avgCycles: totalAvg,
      includesHardwarePenalties: false,
      breakdown,
    };
  }

  /**
   * Estimate cycles for a loop statement (for or while)
   *
   * Provides detailed analysis of loop execution time including:
   * - Iteration count detection (known from literals or estimated)
   * - Setup cycles (initialization before loop)
   * - Body cycles (per iteration)
   * - Overhead cycles (branch + increment per iteration)
   *
   * **For Loops:**
   * - Iteration count computed from start/end if both are literals
   * - Setup includes initializing loop variable and evaluating bounds
   *
   * **While Loops:**
   * - Iteration count estimated (DEFAULT_LOOP_ITERATIONS)
   * - Setup is minimal (just condition evaluation)
   *
   * **Formula:**
   * ```
   * totalCycles = setupCycles + (iterations * (bodyCycles + overheadCycles))
   * ```
   *
   * @param loopStatement - WhileStatement or ForStatement to analyze
   * @returns Detailed loop cycle estimate
   */
  public estimateLoopCycles(loopStatement: WhileStatement | ForStatement): LoopCycleEstimate {
    const nodeType = loopStatement.getNodeType();

    let iterations: number;
    let iterationsKnown: boolean;
    let setupCycles: number;
    let conditionCycles: number;
    let body: Statement[];

    if (nodeType === ASTNodeType.FOR_STMT) {
      // For loop: can compute iterations from literal bounds
      const forStmt = loopStatement as ForStatement;
      const startExpr = forStmt.getStart();
      const endExpr = forStmt.getEnd();
      body = forStmt.getBody();

      // Check if we can determine iteration count from literals
      const startIsLiteral = startExpr instanceof LiteralExpression;
      const endIsLiteral = endExpr instanceof LiteralExpression;

      if (startIsLiteral && endIsLiteral) {
        // Both bounds are literals - compute exact iteration count
        const startValue = (startExpr as LiteralExpression).getValue();
        const endValue = (endExpr as LiteralExpression).getValue();

        // For loops iterate from start to end (exclusive)
        if (typeof startValue === 'number' && typeof endValue === 'number') {
          iterations = Math.max(0, endValue - startValue);
          iterationsKnown = true;
        } else {
          // Non-numeric literals, use default
          iterations = DEFAULT_LOOP_ITERATIONS;
          iterationsKnown = false;
        }
      } else {
        // Non-literal bounds, use estimate
        iterations = DEFAULT_LOOP_ITERATIONS;
        iterationsKnown = false;
      }

      // Setup: initialize variable + evaluate bounds
      const startCycles = this.estimateExpressionCycles(startExpr);
      const endCycles = this.estimateExpressionCycles(endExpr);
      setupCycles = CYCLE_ESTIMATES.ASSIGNMENT + startCycles + endCycles;

      // Condition: comparison (implicit in for loop)
      conditionCycles = CYCLE_ESTIMATES.BRANCH;
    } else {
      // While loop: iterations unknown, use default estimate
      const whileStmt = loopStatement as WhileStatement;
      body = whileStmt.getBody();

      iterations = DEFAULT_LOOP_ITERATIONS;
      iterationsKnown = false;

      // Setup: minimal (just first condition evaluation)
      const condition = whileStmt.getCondition();
      conditionCycles = this.estimateExpressionCycles(condition);
      setupCycles = conditionCycles;
    }

    // Calculate body cycles
    const bodyEstimate = this.estimateBlockCycles(body);
    const bodyCycles = bodyEstimate.avgCycles;

    // Loop overhead per iteration: branch back + increment (for for-loops)
    const overheadCycles = CYCLE_ESTIMATES.LOOP_OVERHEAD;

    // Cycles per iteration = body + overhead
    const cyclesPerIteration = bodyCycles + overheadCycles;

    // Total cycles = setup + (iterations * cyclesPerIteration)
    const totalCycles = setupCycles + iterations * cyclesPerIteration;

    return {
      totalCycles,
      cyclesPerIteration,
      iterations,
      iterationsKnown,
      setupCycles,
      bodyCycles,
      overheadCycles,
      bodyBreakdown: bodyEstimate.breakdown,
    };
  }

  // ============================================
  // Public API: Raster Safety Analysis
  // ============================================

  /**
   * Check if code is safe for raster timing
   *
   * Validates that a code section can execute within
   * the available cycles on a raster line.
   *
   * @param statements - Statements to check
   * @param availableCycles - Cycles available (default: normal line)
   * @param isBadline - Is this a badline context?
   * @returns Raster safety result
   */
  public checkRasterSafety(
    statements: Statement[],
    availableCycles?: number,
    isBadline: boolean = false
  ): RasterSafetyResult {
    const estimate = this.estimateBlockCycles(statements);
    const cycles = availableCycles ?? (isBadline ? this.getBadlineCycles() : this.getCyclesPerLine());

    const margin = cycles - estimate.maxCycles;
    const warnings: string[] = [];

    if (margin < 0) {
      warnings.push(
        `Code may exceed available cycles: ${estimate.maxCycles} estimated vs ${cycles} available`
      );
    } else if (margin < 10) {
      warnings.push(
        `Code is close to cycle limit: ${estimate.maxCycles} estimated, only ${margin} cycles margin`
      );
    }

    if (isBadline && estimate.maxCycles > this.getBadlineCycles()) {
      warnings.push(
        `Code exceeds badline cycle budget: ${estimate.maxCycles} cycles vs ${this.getBadlineCycles()} available`
      );
    }

    return {
      isSafe: margin >= 0,
      estimatedCycles: estimate.maxCycles,
      availableCycles: cycles,
      margin,
      warnings,
      isBadlineAware: isBadline,
    };
  }

  /**
   * Analyze badline sensitivity for a code section
   *
   * Determines how badlines affect the code's timing
   * and provides recommendations.
   *
   * @param statements - Statements to analyze
   * @returns Badline information and recommendations
   */
  public analyzeBadlineSensitivity(statements: Statement[]): BadlineInfo {
    const estimate = this.estimateBlockCycles(statements);
    const normalCycles = this.getCyclesPerLine();
    const badlineCycles = this.getBadlineCycles();

    let recommendation: BadlineRecommendation;
    let isBadlineSensitive: boolean;

    if (estimate.maxCycles <= badlineCycles) {
      // Safe even on badlines
      recommendation = BadlineRecommendation.SAFE;
      isBadlineSensitive = false;
    } else if (estimate.maxCycles <= normalCycles) {
      // Safe on normal lines, but not badlines
      recommendation = BadlineRecommendation.USE_STABLE_RASTER;
      isBadlineSensitive = true;
    } else if (estimate.maxCycles <= normalCycles * 2) {
      // Needs to span multiple lines
      recommendation = BadlineRecommendation.SPLIT_ACROSS_LINES;
      isBadlineSensitive = true;
    } else {
      // Too long for raster-safe execution
      recommendation = BadlineRecommendation.TOO_LONG;
      isBadlineSensitive = true;
    }

    return {
      isBadlineSensitive,
      badlineCyclesAvailable: badlineCycles,
      normalCyclesAvailable: normalCycles,
      recommendation,
    };
  }

  // ============================================
  // Public API: Hardware Penalties
  // ============================================

  /**
   * Calculate sprite DMA penalty
   *
   * Each active sprite steals 2 cycles per raster line.
   *
   * @param activeSprites - Number of active sprites (0-8)
   * @returns Cycles stolen by sprite DMA
   */
  public calculateSpriteDMAPenalty(activeSprites: number): number {
    const clampedSprites = Math.min(Math.max(0, activeSprites), HARDWARE_PENALTIES.MAX_SPRITES);
    return clampedSprites * HARDWARE_PENALTIES.SPRITE_DMA_PER_SPRITE;
  }

  /**
   * Get effective cycles available considering sprite DMA
   *
   * @param activeSprites - Number of active sprites
   * @param isBadline - Is this a badline?
   * @returns Effective cycles available
   */
  public getEffectiveCycles(activeSprites: number, isBadline: boolean = false): number {
    const baseCycles = isBadline ? this.getBadlineCycles() : this.getCyclesPerLine();
    const spritePenalty = this.calculateSpriteDMAPenalty(activeSprites);
    return baseCycles - spritePenalty;
  }

  /**
   * Check if a page crossing is likely between two addresses
   *
   * On the 6502, a page crossing occurs when the high byte of the
   * address changes (every 256 bytes). Page crossings add +1 cycle
   * to many instructions.
   *
   * **Page boundaries:**
   * - $0000-$00FF = Page 0 (zero page)
   * - $0100-$01FF = Page 1 (stack)
   * - $0200-$02FF = Page 2
   * - etc.
   *
   * @param address1 - First address
   * @param address2 - Second address
   * @returns True if addresses are on different pages
   */
  public isPageCrossingLikely(address1: number, address2: number): boolean {
    // Page = high byte of address (address >> 8)
    // Page crossing when high bytes differ
    const page1 = (address1 >> 8) & 0xff;
    const page2 = (address2 >> 8) & 0xff;
    return page1 !== page2;
  }

  /**
   * Detect RMW (Read-Modify-Write) operations in an expression
   *
   * RMW operations on the 6502 include:
   * - INC, DEC (increment/decrement memory)
   * - ASL, LSR, ROL, ROR (shifts/rotates on memory)
   *
   * These operations take extra cycles because they read the value,
   * modify it, and write it back in a single instruction.
   *
   * **Detection heuristics:**
   * - Compound assignment operators (+=, -=, *=, /=, etc.)
   * - Unary increment/decrement (++, --)
   * - Assignment where target is also in the value expression
   *
   * @param expression - Expression to analyze
   * @returns Number of RMW operations detected
   */
  public detectRMWOperations(expression: Expression): number {
    const nodeType = expression.getNodeType();
    let rmwCount = 0;

    switch (nodeType) {
      case ASTNodeType.ASSIGNMENT_EXPR: {
        const assignExpr = expression as AssignmentExpression;
        const target = assignExpr.getTarget();
        const value = assignExpr.getValue();
        const operator = assignExpr.getOperator();

        // Compound assignment operators are RMW operations
        // (+=, -=, *=, /=, &=, |=, ^=, <<=, >>=)
        if (this.isCompoundAssignmentOperator(operator)) {
          rmwCount++;
        } else {
          // Check if target appears in value expression (like x = x + 1)
          if (this.isTargetInValue(target, value)) {
            rmwCount++;
          }
        }

        // Recursively check the value expression
        rmwCount += this.detectRMWOperations(value);
        break;
      }

      case ASTNodeType.UNARY_EXPR: {
        const unaryExpr = expression as UnaryExpression;
        const operator = unaryExpr.getOperator();

        // Increment/decrement operators are RMW operations
        if (this.isIncrementDecrementOperator(operator)) {
          rmwCount++;
        }

        // Recursively check operand
        rmwCount += this.detectRMWOperations(unaryExpr.getOperand());
        break;
      }

      case ASTNodeType.BINARY_EXPR: {
        const binaryExpr = expression as BinaryExpression;
        rmwCount += this.detectRMWOperations(binaryExpr.getLeft());
        rmwCount += this.detectRMWOperations(binaryExpr.getRight());
        break;
      }

      case ASTNodeType.CALL_EXPR: {
        const callExpr = expression as CallExpression;
        for (const arg of callExpr.getArguments()) {
          rmwCount += this.detectRMWOperations(arg);
        }
        break;
      }

      case ASTNodeType.INDEX_EXPR: {
        const indexExpr = expression as IndexExpression;
        rmwCount += this.detectRMWOperations(indexExpr.getIndex());
        break;
      }

      // Literals, identifiers, and member expressions have no RMW
      default:
        break;
    }

    return rmwCount;
  }

  /**
   * Detect RMW operations in a statement
   *
   * @param statement - Statement to analyze
   * @returns Number of RMW operations detected
   */
  public detectStatementRMWOperations(statement: Statement): number {
    const nodeType = statement.getNodeType();
    let rmwCount = 0;

    switch (nodeType) {
      case ASTNodeType.VARIABLE_DECL: {
        const varDecl = statement as VariableDecl;
        const initializer = varDecl.getInitializer();
        if (initializer) {
          rmwCount += this.detectRMWOperations(initializer);
        }
        break;
      }

      case ASTNodeType.EXPR_STMT: {
        const exprStmt = statement as ExpressionStatement;
        rmwCount += this.detectRMWOperations(exprStmt.getExpression());
        break;
      }

      case ASTNodeType.RETURN_STMT: {
        const returnStmt = statement as ReturnStatement;
        const value = returnStmt.getValue();
        if (value) {
          rmwCount += this.detectRMWOperations(value);
        }
        break;
      }

      case ASTNodeType.IF_STMT: {
        const ifStmt = statement as IfStatement;
        rmwCount += this.detectRMWOperations(ifStmt.getCondition());
        break;
      }

      case ASTNodeType.WHILE_STMT: {
        const whileStmt = statement as WhileStatement;
        rmwCount += this.detectRMWOperations(whileStmt.getCondition());
        break;
      }

      case ASTNodeType.FOR_STMT: {
        const forStmt = statement as ForStatement;
        rmwCount += this.detectRMWOperations(forStmt.getStart());
        rmwCount += this.detectRMWOperations(forStmt.getEnd());
        // For loops implicitly have an increment operation (RMW)
        rmwCount++;
        break;
      }

      default:
        break;
    }

    return rmwCount;
  }

  /**
   * Calculate all hardware penalties for a code section
   *
   * Analyzes statements for:
   * - Sprite DMA cycles stolen
   * - Page crossing penalties
   * - RMW operation penalties
   *
   * @param statements - Statements to analyze
   * @param activeSprites - Number of active sprites (0-8)
   * @returns Detailed hardware penalties breakdown
   */
  public calculateHardwarePenalties(statements: Statement[], activeSprites: number = 0): HardwarePenalties {
    // Calculate sprite DMA penalty
    const spriteDMAPenalty = this.calculateSpriteDMAPenalty(activeSprites);

    // Count RMW operations across all statements
    let rmwOperations = 0;
    for (const stmt of statements) {
      rmwOperations += this.detectStatementRMWOperations(stmt);
    }
    const rmwPenalty = rmwOperations * HARDWARE_PENALTIES.RMW_PENALTY;

    // Estimate page crossings based on memory access patterns
    // Heuristic: assume 1 page crossing per 5 memory operations
    const estimate = this.estimateBlockCycles(statements);
    const memoryOps = Math.floor(estimate.avgCycles / 5);
    const pageCrossings = Math.max(0, Math.floor(memoryOps / 5));
    const pageCrossingPenalty = pageCrossings * HARDWARE_PENALTIES.PAGE_CROSSING;

    // Total penalty
    const totalPenalty = spriteDMAPenalty + pageCrossingPenalty + rmwPenalty;

    return {
      totalPenalty,
      spriteDMAPenalty,
      pageCrossingPenalty,
      rmwPenalty,
      activeSprites: Math.min(Math.max(0, activeSprites), HARDWARE_PENALTIES.MAX_SPRITES),
      pageCrossings,
      rmwOperations,
    };
  }

  /**
   * Estimate cycles including hardware penalties
   *
   * Combines base cycle estimation with hardware penalty analysis
   * to provide more accurate total cycle estimates.
   *
   * @param statements - Statements to analyze
   * @param activeSprites - Number of active sprites (0-8)
   * @param isBadline - Is this a badline context?
   * @returns Cycle estimate including hardware penalties
   */
  public estimateCyclesWithPenalties(
    statements: Statement[],
    activeSprites: number = 0,
    isBadline: boolean = false
  ): CycleEstimate {
    // Get base cycle estimate
    const baseEstimate = this.estimateBlockCycles(statements);

    // Calculate hardware penalties
    const penalties = this.calculateHardwarePenalties(statements, activeSprites);

    // Add badline penalty if applicable
    const badlinePenalty = isBadline ? this.getBadlinePenalty() : 0;

    // Calculate totals with penalties
    const minCycles = baseEstimate.minCycles + penalties.totalPenalty + badlinePenalty;
    const maxCycles = baseEstimate.maxCycles + penalties.totalPenalty + badlinePenalty;
    const avgCycles = baseEstimate.avgCycles + penalties.totalPenalty + badlinePenalty;

    return {
      minCycles,
      maxCycles,
      avgCycles,
      includesHardwarePenalties: true,
      breakdown: baseEstimate.breakdown,
    };
  }

  // ============================================
  // Protected Helpers: RMW Detection
  // ============================================

  /**
   * Check if token type is a compound assignment operator
   *
   * Compound assignments (+=, -=, etc.) are RMW operations
   * because they read, modify, and write in one logical operation.
   *
   * @param operator - Token type to check
   * @returns True if compound assignment operator
   */
  protected isCompoundAssignmentOperator(operator: TokenType): boolean {
    // Check for compound assignment operators
    // These are RMW operations because they read, modify, and write
    return (
      operator === TokenType.PLUS_ASSIGN ||
      operator === TokenType.MINUS_ASSIGN ||
      operator === TokenType.MULTIPLY_ASSIGN ||
      operator === TokenType.DIVIDE_ASSIGN ||
      operator === TokenType.MODULO_ASSIGN ||
      operator === TokenType.BITWISE_AND_ASSIGN ||
      operator === TokenType.BITWISE_OR_ASSIGN ||
      operator === TokenType.BITWISE_XOR_ASSIGN
    );
  }

  /**
   * Check if token type is an increment/decrement operator
   *
   * @param operator - Token type to check
   * @returns True if increment or decrement operator
   */
  protected isIncrementDecrementOperator(_operator: TokenType): boolean {
    // Blend65 does not have ++ and -- operators
    // Return false as these operators are not supported
    return false;
  }

  /**
   * Check if target identifier appears in value expression
   *
   * Detects patterns like: x = x + 1 (which is an RMW operation)
   *
   * @param target - Assignment target expression
   * @param value - Value expression to search
   * @returns True if target appears in value
   */
  protected isTargetInValue(target: Expression, value: Expression): boolean {
    // Only check if target is an identifier
    if (target.getNodeType() !== ASTNodeType.IDENTIFIER_EXPR) {
      return false;
    }

    // Get target name for comparison
    const targetIdent = target as unknown as { getName(): string };
    if (typeof targetIdent.getName !== 'function') {
      return false;
    }
    const targetName = targetIdent.getName();

    // Search value expression for matching identifier
    return this.containsIdentifier(value, targetName);
  }

  /**
   * Check if expression contains a specific identifier
   *
   * @param expression - Expression to search
   * @param identifierName - Name to look for
   * @returns True if identifier found in expression
   */
  protected containsIdentifier(expression: Expression, identifierName: string): boolean {
    const nodeType = expression.getNodeType();

    switch (nodeType) {
      case ASTNodeType.IDENTIFIER_EXPR: {
        const ident = expression as unknown as { getName(): string };
        if (typeof ident.getName === 'function') {
          return ident.getName() === identifierName;
        }
        return false;
      }

      case ASTNodeType.BINARY_EXPR: {
        const binaryExpr = expression as BinaryExpression;
        return (
          this.containsIdentifier(binaryExpr.getLeft(), identifierName) ||
          this.containsIdentifier(binaryExpr.getRight(), identifierName)
        );
      }

      case ASTNodeType.UNARY_EXPR: {
        const unaryExpr = expression as UnaryExpression;
        return this.containsIdentifier(unaryExpr.getOperand(), identifierName);
      }

      case ASTNodeType.CALL_EXPR: {
        const callExpr = expression as CallExpression;
        for (const arg of callExpr.getArguments()) {
          if (this.containsIdentifier(arg, identifierName)) {
            return true;
          }
        }
        return false;
      }

      case ASTNodeType.INDEX_EXPR: {
        const indexExpr = expression as IndexExpression;
        return this.containsIdentifier(indexExpr.getIndex(), identifierName);
      }

      case ASTNodeType.ASSIGNMENT_EXPR: {
        const assignExpr = expression as AssignmentExpression;
        return this.containsIdentifier(assignExpr.getValue(), identifierName);
      }

      default:
        return false;
    }
  }

  // ============================================
  // Public API: Warnings
  // ============================================

  /**
   * Get all warnings collected during analysis
   *
   * @returns Array of timing warnings
   */
  public getWarnings(): VICIITimingWarning[] {
    return [...this.warnings];
  }

  /**
   * Clear all warnings
   */
  public clearWarnings(): void {
    this.warnings = [];
  }

  /**
   * Add a timing warning
   *
   * @param warning - Warning to add
   */
  public addWarning(warning: VICIITimingWarning): void {
    this.warnings.push(warning);
  }

  // ============================================
  // Public API: Raster Safety Metadata (Step 8.15.5)
  // ============================================

  /**
   * Generate raster safety metadata for a code section
   *
   * Creates metadata that can be attached to functions or loops
   * to indicate their VIC-II timing characteristics.
   *
   * **Metadata Fields:**
   * - `VICIIRasterSafe`: True if code fits in one raster line
   * - `VICIIBadlineAware`: True if code fits even during badlines
   * - `stableRasterCompatible`: True if timing variance is minimal
   *
   * **Usage:**
   * ```typescript
   * const metadata = analyzer.generateRasterSafetyMetadata(statements, location);
   * if (metadata.VICIIRasterSafe) {
   *   // Safe to use in raster interrupt
   * }
   * ```
   *
   * @param statements - Statements to analyze
   * @param location - Source location for warnings
   * @param activeSprites - Number of active sprites (affects available cycles)
   * @returns Raster safety metadata
   */
  public generateRasterSafetyMetadata(
    statements: Statement[],
    location: SourceLocation,
    activeSprites: number = 0
  ): RasterSafetyMetadata {
    // Get cycle estimate with hardware penalties
    const estimate = this.estimateCyclesWithPenalties(statements, activeSprites);
    const estimatedCycles = estimate.maxCycles;

    // Get timing thresholds
    const normalCycles = this.getCyclesPerLine();
    const badlineCycles = this.getBadlineCycles();

    // Determine raster safety
    const isRasterSafe = estimatedCycles <= normalCycles;
    const isBadlineAware = estimatedCycles <= badlineCycles;

    // Calculate cycle margin (use badline cycles as the conservative limit)
    const maxSafeCycles = badlineCycles;
    const cycleMargin = maxSafeCycles - estimatedCycles;

    // Get badline recommendation
    const badlineInfo = this.analyzeBadlineSensitivity(statements);

    // Calculate lines required
    const linesRequired = Math.ceil(estimatedCycles / normalCycles);

    // Check stable raster compatibility
    // Stable raster requires very tight timing (min/max within 1 cycle)
    const cycleVariance = estimate.maxCycles - estimate.minCycles;
    const stableRasterCompatible = isBadlineAware && cycleVariance <= 1;

    // Generate warnings if appropriate
    this.generateBadlineWarnings(statements, location, estimatedCycles, activeSprites);

    return {
      VICIIRasterSafe: isRasterSafe,
      VICIIBadlineAware: isBadlineAware,
      estimatedCycles,
      maxSafeCycles,
      cycleMargin,
      recommendation: badlineInfo.recommendation,
      linesRequired,
      stableRasterCompatible,
    };
  }

  /**
   * Generate comprehensive badline warnings for a code section
   *
   * Analyzes code for potential badline timing issues and generates
   * appropriate warnings with severity levels.
   *
   * **Warning Severities:**
   * - `info`: Code is safe, informational message
   * - `warning`: Code may have timing issues on badlines
   * - `error`: Code exceeds raster line budget
   *
   * **Warning Triggers:**
   * - Code exceeds normal raster line cycles (error)
   * - Code exceeds badline cycles but fits normal line (warning)
   * - Code is close to cycle limit with <5 cycle margin (warning)
   * - Stable raster compatibility issues (info)
   *
   * @param statements - Statements to analyze
   * @param location - Source location for warnings
   * @param estimatedCycles - Pre-computed cycle estimate (optional)
   * @param activeSprites - Number of active sprites
   */
  public generateBadlineWarnings(
    statements: Statement[],
    location: SourceLocation,
    estimatedCycles?: number,
    activeSprites: number = 0
  ): void {
    // Get cycle estimate if not provided
    const cycles =
      estimatedCycles ?? this.estimateCyclesWithPenalties(statements, activeSprites).maxCycles;

    const normalCycles = this.getCyclesPerLine();
    const badlineCycles = this.getBadlineCycles();

    // Check for critical timing violations (exceeds raster line)
    if (cycles > normalCycles) {
      this.addWarning({
        message:
          `Code exceeds raster line cycle budget: ${cycles} cycles estimated ` +
          `vs ${normalCycles} cycles available. Consider splitting across multiple raster lines.`,
        location,
        severity: 'error',
        estimatedCycles: cycles,
        availableCycles: normalCycles,
      });
      return; // Don't add more warnings if we have a critical error
    }

    // Check for badline-sensitive code
    if (cycles > badlineCycles) {
      this.addWarning({
        message:
          `Code exceeds badline cycle budget: ${cycles} cycles estimated ` +
          `vs ${badlineCycles} cycles available on badlines. ` +
          `This code will cause timing glitches on every 8th raster line.`,
        location,
        severity: 'warning',
        estimatedCycles: cycles,
        availableCycles: badlineCycles,
      });
    }

    // Check for tight margin (< 5 cycles)
    const normalMargin = normalCycles - cycles;
    const badlineMargin = badlineCycles - cycles;

    if (normalMargin > 0 && normalMargin < 5) {
      this.addWarning({
        message:
          `Code has tight timing margin: only ${normalMargin} cycles remaining. ` +
          `Minor code changes may cause timing violations.`,
        location,
        severity: 'warning',
        estimatedCycles: cycles,
        availableCycles: normalCycles,
      });
    } else if (badlineMargin > 0 && badlineMargin < 5) {
      this.addWarning({
        message:
          `Code has tight badline margin: only ${badlineMargin} cycles remaining on badlines. ` +
          `Consider optimizing for more headroom.`,
        location,
        severity: 'info',
        estimatedCycles: cycles,
        availableCycles: badlineCycles,
      });
    }

    // Check sprite DMA impact
    if (activeSprites > 0) {
      const spritePenalty = this.calculateSpriteDMAPenalty(activeSprites);
      const effectiveBadlineCycles = badlineCycles - spritePenalty;

      if (cycles > effectiveBadlineCycles && cycles <= badlineCycles) {
        this.addWarning({
          message:
            `Code may exceed cycle budget with ${activeSprites} active sprites: ` +
            `${cycles} cycles estimated vs ${effectiveBadlineCycles} effective cycles ` +
            `(after ${spritePenalty} cycles sprite DMA penalty).`,
          location,
          severity: 'warning',
          estimatedCycles: cycles,
          availableCycles: effectiveBadlineCycles,
        });
      }
    }
  }

  /**
   * Check if code is badline-aware (safe on badlines)
   *
   * Quick check without generating full metadata.
   *
   * @param statements - Statements to check
   * @param activeSprites - Number of active sprites
   * @returns True if code fits within badline cycles
   */
  public isBadlineAware(statements: Statement[], activeSprites: number = 0): boolean {
    const estimate = this.estimateCyclesWithPenalties(statements, activeSprites);
    return estimate.maxCycles <= this.getBadlineCycles();
  }

  /**
   * Check if code is raster-safe (fits in one line)
   *
   * Quick check without generating full metadata.
   *
   * @param statements - Statements to check
   * @param activeSprites - Number of active sprites
   * @returns True if code fits within normal line cycles
   */
  public isRasterSafe(statements: Statement[], activeSprites: number = 0): boolean {
    const estimate = this.estimateCyclesWithPenalties(statements, activeSprites);
    return estimate.maxCycles <= this.getCyclesPerLine();
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create VIC-II timing analyzer from target config
 *
 * @param config - Target configuration
 * @returns VIC-II timing analyzer
 */
export function createVICIITimingAnalyzer(config: TargetConfig): VICIITimingAnalyzer {
  return new VICIITimingAnalyzer(config);
}

/**
 * Calculate cycles per frame for given timing
 *
 * @param cyclesPerLine - Cycles per raster line
 * @param linesPerFrame - Lines per frame
 * @returns Total cycles per frame
 */
export function calculateCyclesPerFrame(cyclesPerLine: number, linesPerFrame: number): number {
  return cyclesPerLine * linesPerFrame;
}

/**
 * Check if a cycle count fits within a raster line
 *
 * @param cycles - Cycles to check
 * @param cyclesPerLine - Available cycles per line
 * @returns True if cycles fit in one line
 */
export function fitsInRasterLine(cycles: number, cyclesPerLine: number): boolean {
  return cycles <= cyclesPerLine;
}