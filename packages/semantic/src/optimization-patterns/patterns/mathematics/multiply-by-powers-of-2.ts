/**
 * Multiply by Powers of 2 Pattern - Smart Pattern Implementation
 * Smart Modular Architecture - Single pattern (~80 lines)
 *
 * This demonstrates how individual patterns are implemented as small,
 * focused modules that can be loaded on demand.
 */

import type { ASTNode, BinaryExpr, Literal, Expression } from '@blend65/ast';
import type {
  OptimizationPattern,
  PatternMatch,
  TransformationResult,
} from '../../core/pattern-types';
import { PatternCategory, PatternPriority, TargetPlatform } from '../../core/pattern-types';

// ============================================================================
// MULTIPLY BY POWERS OF 2 PATTERN
// ============================================================================

/**
 * Optimizes multiplication by powers of 2 using left shift operations.
 *
 * Transforms: x * 4 → x << 2
 * Performance: ~15 cycles saved, ~8 bytes saved
 */
export const multiplyByPowersOf2Pattern: OptimizationPattern = {
  id: 'multiply_by_powers_of_2',
  name: 'Multiply by Powers of 2',
  category: PatternCategory.MATHEMATICS,
  description: 'Replace multiplication by powers of 2 with left shift operations',
  priority: PatternPriority.HIGH,
  platforms: [TargetPlatform.C64, TargetPlatform.VIC20, TargetPlatform.GENERIC_6502],

  matches: (node: ASTNode): PatternMatch | null => {
    if (node.type !== 'BinaryExpr') return null;

    const binExpr = node as BinaryExpr;
    if (binExpr.operator !== '*') return null;

    // Check if right operand is a number literal
    if (binExpr.right.type !== 'Literal') return null;

    const rightLiteral = binExpr.right as Literal;
    const value = rightLiteral.value;

    // Check if value is a number and is a power of 2 (and > 1)
    if (typeof value !== 'number' || !isPowerOfTwo(value) || value <= 1) return null;

    const captures = new Map<string, any>();
    captures.set('multiplicand', binExpr.left);
    captures.set('multiplier', value);
    captures.set('shiftAmount', Math.log2(value));

    return {
      patternId: 'multiply_by_powers_of_2',
      node,
      confidence: 1.0, // Perfect match
      captures,
      location: {
        line: binExpr.metadata?.start?.line || 0,
        column: binExpr.metadata?.start?.column || 0,
      },
    };
  },

  transform: (match: PatternMatch): TransformationResult => {
    const startTime = Date.now();

    try {
      const multiplicand = match.captures.get('multiplicand') as Expression;
      const shiftAmount = match.captures.get('shiftAmount') as number;

      // Create shift left expression (x << n)
      const shiftExpression: BinaryExpr = {
        type: 'BinaryExpr',
        operator: '<<',
        left: multiplicand,
        right: {
          type: 'Literal',
          value: shiftAmount,
          raw: shiftAmount.toString(),
          metadata: match.node.metadata,
        },
        metadata: match.node.metadata,
      };

      const transformTime = Date.now() - startTime;

      return {
        success: true,
        transformedNode: shiftExpression,
        metrics: {
          transformationTime: transformTime,
          memoryUsed: 256, // Estimated bytes
          success: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Transformation failed: ${error}`,
        metrics: {
          transformationTime: Date.now() - startTime,
          memoryUsed: 0,
          success: false,
        },
      };
    }
  },

  expectedImprovement: {
    cyclesSaved: 15, // 6502 shift vs multiply routine
    bytesSaved: 8, // Inline shift vs JSR to multiply
    improvementPercentage: 85,
    reliability: 'guaranteed',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a number is a power of 2.
 */
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Export pattern for pattern registry.
 */
export function getMathematicsPatterns(): OptimizationPattern[] {
  return [multiplyByPowersOf2Pattern];
}

/**
 * Pattern metadata for lazy loading.
 */
export const patternInfo = {
  category: PatternCategory.MATHEMATICS,
  patterns: ['multiply_by_powers_of_2'],
  platforms: [TargetPlatform.C64, TargetPlatform.VIC20, TargetPlatform.GENERIC_6502],
  priority: PatternPriority.HIGH,
  fileSize: '~80 lines',
  memoryFootprint: '~2KB',
};
