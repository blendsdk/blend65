/**
 * Zero Page Allocator for Static Frame Allocation (SFA)
 *
 * Implements the ZP scoring algorithm that determines which variables
 * should be placed in Zero Page for optimal 6502 code generation.
 *
 * **Scoring Algorithm:**
 * The score is computed multiplicatively:
 * 1. Base type weight (pointers > bytes > words > arrays)
 * 2. Multiplied by access count (reads + writes)
 * 3. Multiplied by 2^loopDepth (exponential loop bonus)
 * 4. @zp directive sets score to MAX_SAFE_INTEGER
 *
 * This approach ensures:
 * - Pointers get ZP (enables indirect Y addressing)
 * - Hot variables in loops get priority
 * - @zp directive always wins
 * - Deterministic, predictable allocation
 *
 * @module frame/allocator/zp-allocator
 */

import { TypeKind } from '../../semantic/types.js';
import { ZpDirective } from '../enums.js';
import { FrameSlot, ZpScoreBreakdown } from '../types.js';
import { ZpPool } from './zp-pool.js';
import { PlatformConfig } from '../platform.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Type weights for ZP scoring.
 *
 * These weights prioritize types that benefit most from Zero Page:
 * - Pointers: 0x800 (highest) - enables indirect Y addressing mode
 * - Bytes: 0x100 - good savings from shorter instructions
 * - Words: 0x080 - moderate savings, but 2 bytes
 * - Arrays: 0x000 - no ZP benefit (too large, use pointer instead)
 *
 * The hex values create distinct score bands that prevent overlap
 * even with large access counts.
 */
export const ZP_TYPE_WEIGHTS: Readonly<Record<string, number>> = {
  pointer: 0x800, // 2048 - Highest priority for indirect Y
  byte: 0x100, // 256 - Good benefit from ZP instructions
  word: 0x080, // 128 - Less benefit, but still useful
  bool: 0x100, // 256 - Same as byte (1-byte type)
  array: 0x000, // 0 - Arrays don't go in ZP (use pointer instead)
  void: 0x000, // 0 - No ZP benefit
  string: 0x800, // 2048 - Strings are pointers
};

/**
 * Minimum access count for ZP consideration.
 *
 * Variables accessed fewer than this many times don't benefit
 * enough from ZP placement to justify the limited space.
 */
export const ZP_MIN_ACCESS_COUNT = 1;

/**
 * Score threshold for automatic ZP placement.
 *
 * Variables with scores above this are strong candidates for ZP.
 * Used for informational purposes (actual allocation is by rank).
 */
export const ZP_SCORE_HIGH_THRESHOLD = 1000;

// ============================================================================
// Scoring Types
// ============================================================================

/**
 * Extended score breakdown with multiplicative components.
 *
 * Unlike the additive breakdown in types.ts, this tracks the
 * multiplicative factors used in the actual scoring algorithm.
 */
export interface ZpScoreDetails extends ZpScoreBreakdown {
  /** Base type weight before multiplication */
  readonly baseTypeWeight: number;

  /** Access count (reads + writes) */
  readonly accessCount: number;

  /** Loop depth multiplier (2^depth) */
  readonly loopMultiplier: number;

  /** Whether @zp directive was applied */
  readonly hasZpDirective: boolean;

  /** Whether @ram directive was applied (score = 0) */
  readonly hasRamDirective: boolean;

  /** The type kind used for weight lookup */
  readonly typeKind: TypeKind;
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Get the ZP type weight for a TypeKind.
 *
 * Maps TypeKind enum values to ZP weights. Pointers and pointer-like
 * types (strings) get highest weight because they enable indirect Y
 * addressing which saves significant cycles.
 *
 * @param typeKind - The TypeKind to get weight for
 * @returns Type weight for ZP scoring
 *
 * @example
 * ```typescript
 * getTypeWeight(TypeKind.Word)    // 0x080 (128)
 * getTypeWeight(TypeKind.Byte)    // 0x100 (256)
 * getTypeWeight(TypeKind.String)  // 0x800 (2048) - pointer-like
 * ```
 */
export function getTypeWeight(typeKind: TypeKind): number {
  switch (typeKind) {
    case TypeKind.Byte:
      return ZP_TYPE_WEIGHTS.byte;
    case TypeKind.Bool:
      return ZP_TYPE_WEIGHTS.bool;
    case TypeKind.Word:
      return ZP_TYPE_WEIGHTS.word;
    case TypeKind.String:
      return ZP_TYPE_WEIGHTS.string;
    case TypeKind.Array:
      return ZP_TYPE_WEIGHTS.array;
    case TypeKind.Void:
      return ZP_TYPE_WEIGHTS.void;
    default:
      // Unknown types get byte weight as fallback
      return ZP_TYPE_WEIGHTS.byte;
  }
}

/**
 * Calculate ZP priority score for a frame slot.
 *
 * This is the main scoring function used by the ZP allocator.
 * Uses multiplicative formula for better discrimination:
 *
 * ```
 * score = typeWeight × accessCount × 2^loopDepth
 * ```
 *
 * Special cases:
 * - @zp directive: score = MAX_SAFE_INTEGER (always allocated)
 * - @ram directive: score = 0 (never in ZP)
 * - Arrays: score = 0 (too large for ZP)
 * - Zero access count: score = typeWeight (baseline)
 *
 * @param slot - Frame slot to score
 * @returns ZP priority score (higher = more priority)
 *
 * @example
 * ```typescript
 * // A byte accessed 10 times in a loop depth 2
 * // score = 256 × 10 × 4 = 10,240
 *
 * // A pointer accessed 5 times outside loops
 * // score = 2048 × 5 × 1 = 10,240
 *
 * // Both get similar scores - pointers naturally prioritized
 * ```
 */
export function calculateZPScore(slot: FrameSlot): number {
  // @ram directive: never in ZP
  if (slot.zpDirective === ZpDirective.Ram) {
    return 0;
  }

  // @zp directive: highest priority
  if (slot.zpDirective === ZpDirective.Zp) {
    return Number.MAX_SAFE_INTEGER;
  }

  // Arrays don't go in ZP (too large)
  if (slot.type.kind === TypeKind.Array) {
    return 0;
  }

  // Get base type weight
  const typeWeight = getTypeWeight(slot.type.kind);

  // If zero weight, score is zero
  if (typeWeight === 0) {
    return 0;
  }

  // Calculate access factor (at least 1 to preserve type weight)
  const accessCount = Math.max(slot.accessCount, 1);

  // Calculate loop multiplier (2^depth, minimum 1)
  const loopMultiplier = Math.pow(2, Math.max(slot.maxLoopDepth, 0));

  // Multiplicative score
  return typeWeight * accessCount * loopMultiplier;
}

/**
 * Calculate ZP score with detailed breakdown.
 *
 * Same as calculateZPScore but returns full breakdown for debugging
 * and analysis. Useful for understanding allocation decisions.
 *
 * @param slot - Frame slot to score
 * @returns Detailed score breakdown
 *
 * @example
 * ```typescript
 * const details = calculateZPScoreWithDetails(slot);
 * console.log(`Score: ${details.totalScore}`);
 * console.log(`  Type: ${details.baseTypeWeight} (${TypeKind[details.typeKind]})`);
 * console.log(`  Access: ×${details.accessCount}`);
 * console.log(`  Loop: ×${details.loopMultiplier} (depth ${slot.maxLoopDepth})`);
 * ```
 */
export function calculateZPScoreWithDetails(slot: FrameSlot): ZpScoreDetails {
  const hasZpDirective = slot.zpDirective === ZpDirective.Zp;
  const hasRamDirective = slot.zpDirective === ZpDirective.Ram;
  const typeKind = slot.type.kind;
  const baseTypeWeight = getTypeWeight(typeKind);
  const accessCount = Math.max(slot.accessCount, 1);
  const loopMultiplier = Math.pow(2, Math.max(slot.maxLoopDepth, 0));

  // Calculate total score
  let totalScore: number;

  if (hasRamDirective) {
    totalScore = 0;
  } else if (hasZpDirective) {
    totalScore = Number.MAX_SAFE_INTEGER;
  } else if (typeKind === TypeKind.Array) {
    totalScore = 0;
  } else {
    totalScore = baseTypeWeight * accessCount * loopMultiplier;
  }

  // Build breakdown (using the additive format for compatibility)
  // The multiplicative approach means these aren't directly additive,
  // but we report the individual factors for analysis
  const typeWeight = baseTypeWeight;
  const accessBonus = hasZpDirective || hasRamDirective ? 0 : (accessCount - 1) * baseTypeWeight;
  const loopBonus = hasZpDirective || hasRamDirective ? 0 : (loopMultiplier - 1) * baseTypeWeight * accessCount;
  const directiveBonus = hasZpDirective ? Number.MAX_SAFE_INTEGER : 0;

  return {
    // ZpScoreBreakdown fields (for compatibility)
    typeWeight,
    accessBonus,
    loopBonus,
    directiveBonus,
    totalScore,

    // Extended fields
    baseTypeWeight,
    accessCount,
    loopMultiplier,
    hasZpDirective,
    hasRamDirective,
    typeKind,
  };
}

/**
 * Update slot's zpScore field with calculated score.
 *
 * Convenience function that calculates score and updates the slot.
 * Returns the slot for chaining.
 *
 * @param slot - Slot to update (mutated)
 * @returns The same slot with zpScore updated
 *
 * @example
 * ```typescript
 * const slots = frame.slots.map(slot => updateSlotZpScore(slot));
 * // All slots now have zpScore set
 * ```
 */
export function updateSlotZpScore(slot: FrameSlot): FrameSlot {
  slot.zpScore = calculateZPScore(slot);
  return slot;
}

/**
 * Score all slots in a frame.
 *
 * Calculates and updates zpScore for all slots.
 * Returns slots sorted by score (highest first).
 *
 * @param slots - Slots to score (mutated)
 * @returns Slots sorted by zpScore descending
 *
 * @example
 * ```typescript
 * const scoredSlots = scoreAllSlots(frame.slots);
 * // First slot has highest ZP priority
 * ```
 */
export function scoreAllSlots(slots: FrameSlot[]): FrameSlot[] {
  // Calculate scores for all slots
  for (const slot of slots) {
    updateSlotZpScore(slot);
  }

  // Sort by score (highest first)
  return [...slots].sort((a, b) => b.zpScore - a.zpScore);
}

/**
 * Get slots that should be considered for ZP allocation.
 *
 * Filters out:
 * - Slots with @ram directive
 * - Arrays (too large)
 * - Slots with zero score
 *
 * Returns sorted by score (highest priority first).
 *
 * @param slots - All frame slots
 * @returns Filtered and sorted candidates for ZP
 *
 * @example
 * ```typescript
 * const candidates = getZpCandidates(frame.slots);
 * for (const slot of candidates) {
 *   if (pool.canAllocate(slot.size)) {
 *     // Allocate in ZP
 *   }
 * }
 * ```
 */
export function getZpCandidates(slots: FrameSlot[]): FrameSlot[] {
  // Score all slots first
  const scored = scoreAllSlots(slots);

  // Filter to valid candidates
  return scored.filter(slot => {
    // Exclude @ram directive
    if (slot.zpDirective === ZpDirective.Ram) {
      return false;
    }

    // Exclude arrays
    if (slot.type.kind === TypeKind.Array) {
      return false;
    }

    // Include everything else (even zero scores, for @zp directive handling)
    return true;
  });
}

/**
 * Separate slots by ZP directive.
 *
 * Categorizes slots into:
 * - required: @zp directive (MUST be in ZP)
 * - forbidden: @ram directive (MUST NOT be in ZP)
 * - automatic: No directive (compiler decides)
 *
 * @param slots - Slots to categorize
 * @returns Object with required, forbidden, and automatic arrays
 *
 * @example
 * ```typescript
 * const { required, forbidden, automatic } = categorizeSlots(frame.slots);
 *
 * // Allocate required first (error if impossible)
 * for (const slot of required) { ... }
 *
 * // Skip forbidden
 *
 * // Allocate automatic by score
 * for (const slot of automatic.sort((a, b) => b.zpScore - a.zpScore)) { ... }
 * ```
 */
export function categorizeSlots(slots: FrameSlot[]): {
  required: FrameSlot[];
  forbidden: FrameSlot[];
  automatic: FrameSlot[];
} {
  const required: FrameSlot[] = [];
  const forbidden: FrameSlot[] = [];
  const automatic: FrameSlot[] = [];

  for (const slot of slots) {
    switch (slot.zpDirective) {
      case ZpDirective.Zp:
        required.push(slot);
        break;
      case ZpDirective.Ram:
        forbidden.push(slot);
        break;
      case ZpDirective.None:
      default:
        automatic.push(slot);
        break;
    }
  }

  return { required, forbidden, automatic };
}

// ============================================================================
// ZP Allocator Class
// ============================================================================

/**
 * Zero Page Allocator.
 *
 * Manages ZP allocation for frame slots using scoring-based prioritization.
 * Works with ZpPool to track available addresses.
 *
 * **Allocation Strategy:**
 * 1. Score all slots using calculateZPScore
 * 2. Allocate @zp required slots first (error if impossible)
 * 3. Skip @ram forbidden slots
 * 4. Allocate automatic slots by score until ZP is full
 *
 * **Usage:**
 * ```typescript
 * const allocator = new ZpAllocator(C64_PLATFORM_CONFIG);
 *
 * // Score all slots
 * allocator.scoreSlots(frame.slots);
 *
 * // Get allocation order
 * const order = allocator.getAllocationOrder(frame.slots);
 *
 * // Actual allocation happens in Session 2.4
 * ```
 */
export class ZpAllocator {
  // ========================================
  // Private Fields
  // ========================================

  /** ZP address pool */
  protected readonly pool: ZpPool;

  /** Platform configuration */
  protected readonly config: PlatformConfig;

  // ========================================
  // Constructor
  // ========================================

  /**
   * Create a new ZP Allocator.
   *
   * @param config - Platform configuration
   *
   * @example
   * ```typescript
   * const allocator = new ZpAllocator(C64_PLATFORM_CONFIG);
   * ```
   */
  constructor(config: PlatformConfig);

  /**
   * Create a new ZP Allocator with existing pool.
   *
   * @param pool - Existing ZP pool to use
   *
   * @example
   * ```typescript
   * const pool = new ZpPool(C64_PLATFORM_CONFIG);
   * const allocator = new ZpAllocator(pool);
   * ```
   */
  constructor(pool: ZpPool);

  /**
   * Create a new ZP Allocator.
   *
   * @param configOrPool - Platform configuration or existing ZpPool
   */
  constructor(configOrPool: PlatformConfig | ZpPool) {
    if (configOrPool instanceof ZpPool) {
      this.pool = configOrPool;
      this.config = configOrPool.getConfig();
    } else {
      this.config = configOrPool;
      this.pool = new ZpPool(configOrPool);
    }
  }

  // ========================================
  // Scoring Methods
  // ========================================

  /**
   * Calculate ZP score for a single slot.
   *
   * @param slot - Slot to score
   * @returns ZP priority score
   */
  calculateScore(slot: FrameSlot): number {
    return calculateZPScore(slot);
  }

  /**
   * Calculate ZP score with detailed breakdown.
   *
   * @param slot - Slot to score
   * @returns Detailed score breakdown
   */
  calculateScoreWithDetails(slot: FrameSlot): ZpScoreDetails {
    return calculateZPScoreWithDetails(slot);
  }

  /**
   * Score all slots and update their zpScore fields.
   *
   * @param slots - Slots to score (mutated)
   * @returns Slots sorted by score descending
   */
  scoreSlots(slots: FrameSlot[]): FrameSlot[] {
    return scoreAllSlots(slots);
  }

  /**
   * Get ZP candidates in allocation order.
   *
   * Returns slots that should be considered for ZP allocation,
   * sorted by priority (highest first).
   *
   * @param slots - All frame slots
   * @returns Candidates sorted by score
   */
  getZpCandidates(slots: FrameSlot[]): FrameSlot[] {
    return getZpCandidates(slots);
  }

  /**
   * Categorize slots by ZP directive.
   *
   * @param slots - Slots to categorize
   * @returns Categorized slots
   */
  categorizeSlots(slots: FrameSlot[]): {
    required: FrameSlot[];
    forbidden: FrameSlot[];
    automatic: FrameSlot[];
  } {
    return categorizeSlots(slots);
  }

  /**
   * Get the allocation order for slots.
   *
   * Returns slots in the order they should be allocated to ZP:
   * 1. Required slots (@zp directive) first
   * 2. Automatic slots by score (highest first)
   *
   * Forbidden slots (@ram) are excluded.
   *
   * @param slots - All frame slots
   * @returns Slots in allocation order
   *
   * @example
   * ```typescript
   * const order = allocator.getAllocationOrder(frame.slots);
   * for (const slot of order) {
   *   if (pool.canAllocate(slot.size)) {
   *     const result = pool.allocate(slot.size);
   *     slot.address = result.address;
   *     slot.location = SlotLocation.ZeroPage;
   *   }
   * }
   * ```
   */
  getAllocationOrder(slots: FrameSlot[]): FrameSlot[] {
    // Score all slots first
    this.scoreSlots(slots);

    // Categorize
    const { required, automatic } = this.categorizeSlots(slots);

    // Sort automatic by score
    const sortedAutomatic = [...automatic].sort((a, b) => b.zpScore - a.zpScore);

    // Required first, then automatic by score
    return [...required, ...sortedAutomatic];
  }

  // ========================================
  // Pool Access
  // ========================================

  /**
   * Get the underlying ZP pool.
   *
   * @returns ZP pool instance
   */
  getPool(): ZpPool {
    return this.pool;
  }

  /**
   * Get the platform configuration.
   *
   * @returns Platform configuration
   */
  getConfig(): PlatformConfig {
    return this.config;
  }

  /**
   * Reset the allocator (clears pool).
   *
   * Resets the ZP pool to initial state, making all addresses available.
   */
  reset(): void {
    this.pool.reset();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a ZP Allocator for a platform.
 *
 * @param config - Platform configuration
 * @returns New ZP Allocator instance
 *
 * @example
 * ```typescript
 * const allocator = createZpAllocator(C64_PLATFORM_CONFIG);
 * ```
 */
export function createZpAllocator(config: PlatformConfig): ZpAllocator {
  return new ZpAllocator(config);
}