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
import { SlotLocation, ZpDirective } from '../enums.js';
import { FrameSlot, ZpScoreBreakdown } from '../types.js';
import { ZpPool, ZpPoolStats } from './zp-pool.js';
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

/**
 * Error information for a failed @zp allocation.
 *
 * Contains details about why a required ZP slot could not be allocated.
 */
export interface ZpAllocationError {
  /** The slot that failed to allocate */
  readonly slot: FrameSlot;

  /** Error message describing the failure */
  readonly message: string;

  /** Requested size that could not be satisfied */
  readonly requestedSize: number;

  /** Available ZP bytes at time of failure */
  readonly availableBytes: number;

  /** Largest contiguous block available */
  readonly largestBlock: number;
}

/**
 * Summary of ZP allocation results.
 *
 * Provides detailed information about the allocation outcome.
 */
export interface ZpAllocationSummary {
  /** Whether all allocations succeeded */
  readonly success: boolean;

  /** Errors for failed @zp allocations (empty if success is true) */
  readonly errors: readonly ZpAllocationError[];

  /** Number of slots allocated to ZP */
  readonly zpAllocatedCount: number;

  /** Number of slots assigned to frame region */
  readonly frameAllocatedCount: number;

  /** Number of slots with @zp directive */
  readonly requiredCount: number;

  /** Number of slots with @ram directive */
  readonly forbiddenCount: number;

  /** Number of automatic slots */
  readonly automaticCount: number;

  /** Total ZP bytes used */
  readonly zpBytesUsed: number;

  /** ZP pool statistics after allocation */
  readonly poolStats: ZpPoolStats;
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
  // Allocation Methods
  // ========================================

  /**
   * Allocate ZP addresses for frame slots.
   *
   * Performs the complete ZP allocation process:
   * 1. Score all slots
   * 2. Categorize by directive (@zp, @ram, none)
   * 3. Allocate @zp required slots first (error if impossible)
   * 4. Skip @ram forbidden slots (set to FrameRegion)
   * 5. Allocate automatic slots by score until ZP is full
   *
   * **Slot Mutation:**
   * This method mutates the input slots, setting:
   * - `zpScore`: Calculated priority score
   * - `location`: SlotLocation.ZeroPage or SlotLocation.FrameRegion
   * - `address`: ZP address (only for ZP-allocated slots)
   *
   * @param slots - Slots to allocate (mutated)
   * @returns Allocation summary with success status and statistics
   *
   * @example
   * ```typescript
   * const allocator = new ZpAllocator(C64_PLATFORM_CONFIG);
   * const slots = frame.slots;
   *
   * const result = allocator.allocate(slots);
   *
   * if (!result.success) {
   *   for (const error of result.errors) {
   *     console.error(`@zp overflow: ${error.slot.name} - ${error.message}`);
   *   }
   * }
   *
   * console.log(`ZP: ${result.zpAllocatedCount} slots, ${result.zpBytesUsed} bytes`);
   * console.log(`Frame: ${result.frameAllocatedCount} slots`);
   * ```
   */
  allocate(slots: FrameSlot[]): ZpAllocationSummary {
    // Track allocation results
    const errors: ZpAllocationError[] = [];
    let zpAllocatedCount = 0;
    let frameAllocatedCount = 0;
    let zpBytesUsed = 0;

    // Step 1: Score all slots
    this.scoreSlots(slots);

    // Step 2: Categorize by directive
    const { required, forbidden, automatic } = this.categorizeSlots(slots);

    // Step 3: Allocate @zp required slots first (error if impossible)
    for (const slot of required) {
      const stats = this.pool.getStats();

      if (!this.pool.canAllocate(slot.size)) {
        // @zp slot cannot be allocated - this is an error
        errors.push({
          slot,
          message: `@zp variable "${slot.name}" cannot be allocated to zero page: ` +
            `need ${slot.size} contiguous bytes, ` +
            `available: ${stats.bytesFree} bytes, largest block: ${stats.largestFreeBlock} bytes`,
          requestedSize: slot.size,
          availableBytes: stats.bytesFree,
          largestBlock: stats.largestFreeBlock,
        });

        // Mark as frame region (fallback, but will report error)
        slot.location = SlotLocation.FrameRegion;
        frameAllocatedCount++;
      } else {
        // Allocate to ZP
        const result = this.pool.allocate(slot.size);
        if (result.success) {
          slot.address = result.address;
          slot.location = SlotLocation.ZeroPage;
          zpAllocatedCount++;
          zpBytesUsed += slot.size;
        } else {
          // Should not happen after canAllocate check, but handle gracefully
          errors.push({
            slot,
            message: `@zp variable "${slot.name}" allocation failed: ${result.error}`,
            requestedSize: slot.size,
            availableBytes: stats.bytesFree,
            largestBlock: stats.largestFreeBlock,
          });
          slot.location = SlotLocation.FrameRegion;
          frameAllocatedCount++;
        }
      }
    }

    // Step 4: Mark @ram forbidden slots as FrameRegion
    for (const slot of forbidden) {
      slot.location = SlotLocation.FrameRegion;
      frameAllocatedCount++;
    }

    // Step 5: Allocate automatic slots by score
    // Sort by score (highest first)
    const sortedAutomatic = [...automatic].sort((a, b) => b.zpScore - a.zpScore);

    for (const slot of sortedAutomatic) {
      // Skip arrays (they don't go in ZP)
      if (slot.type.kind === TypeKind.Array) {
        slot.location = SlotLocation.FrameRegion;
        frameAllocatedCount++;
        continue;
      }

      // Try to allocate to ZP
      if (this.pool.canAllocate(slot.size)) {
        const result = this.pool.allocate(slot.size);
        if (result.success) {
          slot.address = result.address;
          slot.location = SlotLocation.ZeroPage;
          zpAllocatedCount++;
          zpBytesUsed += slot.size;
        } else {
          // Allocation failed (shouldn't happen after canAllocate)
          slot.location = SlotLocation.FrameRegion;
          frameAllocatedCount++;
        }
      } else {
        // ZP is full - fallback to frame region
        slot.location = SlotLocation.FrameRegion;
        frameAllocatedCount++;
      }
    }

    // Build summary
    const poolStats = this.pool.getStats();

    return {
      success: errors.length === 0,
      errors,
      zpAllocatedCount,
      frameAllocatedCount,
      requiredCount: required.length,
      forbiddenCount: forbidden.length,
      automaticCount: automatic.length,
      zpBytesUsed,
      poolStats,
    };
  }

  /**
   * Try to allocate a single slot to ZP.
   *
   * Attempts to allocate the slot to Zero Page if possible.
   * Does not consider directives - caller is responsible for
   * directive enforcement.
   *
   * @param slot - Slot to try allocating (mutated if successful)
   * @returns true if allocated to ZP, false otherwise
   *
   * @example
   * ```typescript
   * if (allocator.tryAllocateSlot(slot)) {
   *   console.log(`${slot.name} allocated to ZP at $${slot.address.toString(16)}`);
   * } else {
   *   console.log(`${slot.name} will use frame region`);
   * }
   * ```
   */
  tryAllocateSlot(slot: FrameSlot): boolean {
    // Arrays don't go in ZP
    if (slot.type.kind === TypeKind.Array) {
      return false;
    }

    // Check if we can allocate
    if (!this.pool.canAllocate(slot.size)) {
      return false;
    }

    // Allocate
    const result = this.pool.allocate(slot.size);
    if (result.success) {
      slot.address = result.address;
      slot.location = SlotLocation.ZeroPage;
      return true;
    }

    return false;
  }

  /**
   * Check if a slot can be allocated to ZP.
   *
   * Checks both the slot properties and current pool state.
   * Does not modify any state.
   *
   * @param slot - Slot to check
   * @returns true if the slot could be allocated to ZP
   */
  canAllocateSlot(slot: FrameSlot): boolean {
    // @ram directive: never in ZP
    if (slot.zpDirective === ZpDirective.Ram) {
      return false;
    }

    // Arrays don't go in ZP
    if (slot.type.kind === TypeKind.Array) {
      return false;
    }

    // Check pool capacity
    return this.pool.canAllocate(slot.size);
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