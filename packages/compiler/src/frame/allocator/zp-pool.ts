/**
 * Zero Page Pool for Static Frame Allocation (SFA)
 *
 * Manages the allocation of Zero Page addresses for variables.
 * The ZP Pool tracks available addresses based on platform configuration
 * and handles contiguous allocation for multi-byte values.
 *
 * **Key Responsibilities:**
 * - Initialize available ZP addresses from platform config
 * - Allocate contiguous bytes for variables
 * - Track allocation statistics
 * - Handle fragmentation (first-fit allocation)
 *
 * **Design Decisions:**
 * - Uses a simple bitmap for tracking allocations (efficient for 256-byte ZP)
 * - First-fit allocation strategy (simple and deterministic)
 * - Skips reserved addresses (CPU indirect, KERNAL workspace)
 * - Skips compiler scratch region (reserved for codegen)
 *
 * @module frame/allocator/zp-pool
 */

import { PlatformConfig } from '../platform.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Statistics about ZP pool usage.
 *
 * Provides insight into ZP allocation for debugging and optimization.
 *
 * @example
 * ```typescript
 * const stats = pool.getStats();
 * console.log(`ZP usage: ${stats.bytesUsed}/${stats.bytesTotal} (${stats.utilizationPercent}%)`);
 * ```
 */
export interface ZpPoolStats {
  /** Total ZP bytes in the allocatable range (zpStart to zpEnd) */
  readonly bytesTotal: number;

  /** Number of bytes currently allocated */
  readonly bytesUsed: number;

  /** Number of bytes still available */
  readonly bytesFree: number;

  /** Utilization percentage (0-100) */
  readonly utilizationPercent: number;

  /** Number of separate free regions (indicates fragmentation) */
  readonly freeRegions: number;

  /** Size of largest contiguous free region */
  readonly largestFreeBlock: number;
}

/**
 * Result of an allocation attempt.
 *
 * Contains the allocated address or an error if allocation failed.
 */
export interface ZpAllocationResult {
  /** Whether allocation succeeded */
  readonly success: boolean;

  /** Allocated address (only valid if success is true) */
  readonly address: number;

  /** Error message if allocation failed */
  readonly error?: string;
}

// ============================================================================
// ZP Pool Class
// ============================================================================

/**
 * Zero Page address pool manager.
 *
 * Manages allocation of Zero Page addresses based on platform configuration.
 * Uses a bitmap to track which addresses are available or allocated.
 *
 * **Usage:**
 * ```typescript
 * import { ZpPool } from './zp-pool.js';
 * import { C64_PLATFORM_CONFIG } from '../platform.js';
 *
 * const pool = new ZpPool(C64_PLATFORM_CONFIG);
 *
 * // Allocate a single byte
 * const byteResult = pool.allocate(1);
 * if (byteResult.success) {
 *   console.log(`Allocated byte at $${byteResult.address.toString(16)}`);
 * }
 *
 * // Allocate a word (2 bytes)
 * const wordResult = pool.allocate(2);
 * if (wordResult.success) {
 *   console.log(`Allocated word at $${wordResult.address.toString(16)}`);
 * }
 *
 * // Check statistics
 * const stats = pool.getStats();
 * console.log(`ZP: ${stats.bytesFree} bytes remaining`);
 * ```
 *
 * **Thread Safety:**
 * This class is NOT thread-safe. Use a single instance per compilation.
 *
 * @see PlatformConfig for platform-specific ZP ranges
 */
export class ZpPool {
  // ========================================
  // Private Fields
  // ========================================

  /** Platform configuration defining ZP boundaries */
  protected readonly config: PlatformConfig;

  /**
   * Bitmap tracking allocated addresses.
   * true = allocated, false = free
   * Index corresponds to ZP address (0-255)
   */
  protected readonly allocated: boolean[];

  /** Start of allocatable range (inclusive) */
  protected readonly rangeStart: number;

  /** End of allocatable range (exclusive) */
  protected readonly rangeEnd: number;

  /** Set of addresses that cannot be allocated (reserved + scratch) */
  protected readonly unavailable: Set<number>;

  // ========================================
  // Constructor
  // ========================================

  /**
   * Create a new ZP Pool from platform configuration.
   *
   * Initializes the pool with the platform's ZP range and marks
   * reserved addresses and scratch region as unavailable.
   *
   * @param config - Platform configuration
   *
   * @example
   * ```typescript
   * const pool = new ZpPool(C64_PLATFORM_CONFIG);
   * // ZP range: $02-$90, excluding $FB-$FF (scratch)
   * ```
   */
  constructor(config: PlatformConfig) {
    this.config = config;
    this.rangeStart = config.zpStart;
    this.rangeEnd = config.zpEnd;

    // Initialize allocation bitmap (256 bytes for full ZP)
    this.allocated = new Array(256).fill(false);

    // Build set of unavailable addresses
    this.unavailable = new Set<number>();

    // Mark reserved addresses as unavailable
    for (const addr of config.zpReserved) {
      this.unavailable.add(addr);
    }

    // Mark scratch region as unavailable
    for (let addr = config.zpScratch.start; addr < config.zpScratch.end; addr++) {
      this.unavailable.add(addr);
    }

    // Mark addresses outside the allocatable range as unavailable
    // This simplifies canAllocate logic
    for (let addr = 0; addr < this.rangeStart; addr++) {
      this.unavailable.add(addr);
    }
    for (let addr = this.rangeEnd; addr < 256; addr++) {
      this.unavailable.add(addr);
    }
  }

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Check if N contiguous bytes can be allocated.
   *
   * Scans the allocatable range for a contiguous block of free addresses.
   * Does not modify pool state.
   *
   * @param size - Number of bytes needed
   * @returns true if allocation would succeed
   *
   * @example
   * ```typescript
   * if (pool.canAllocate(2)) {
   *   const result = pool.allocate(2);
   *   // guaranteed to succeed
   * }
   * ```
   */
  canAllocate(size: number): boolean {
    if (size <= 0) {
      return false;
    }

    // Find a contiguous block of free addresses
    const address = this.findContiguousFree(size);
    return address !== -1;
  }

  /**
   * Allocate N contiguous bytes from the pool.
   *
   * Uses first-fit strategy: finds the first contiguous block of
   * free addresses that satisfies the request.
   *
   * @param size - Number of bytes to allocate
   * @returns Allocation result with address or error
   *
   * @example
   * ```typescript
   * const result = pool.allocate(2);
   * if (result.success) {
   *   slot.address = result.address;
   * } else {
   *   console.error(result.error);
   * }
   * ```
   */
  allocate(size: number): ZpAllocationResult {
    // Validate size
    if (size <= 0) {
      return {
        success: false,
        address: 0,
        error: `Invalid allocation size: ${size}`,
      };
    }

    // Find contiguous free block
    const address = this.findContiguousFree(size);

    if (address === -1) {
      const stats = this.getStats();
      return {
        success: false,
        address: 0,
        error: `Cannot allocate ${size} contiguous bytes in ZP. ` +
          `Available: ${stats.bytesFree} bytes, largest block: ${stats.largestFreeBlock} bytes`,
      };
    }

    // Mark addresses as allocated
    for (let offset = 0; offset < size; offset++) {
      this.allocated[address + offset] = true;
    }

    return {
      success: true,
      address,
    };
  }

  /**
   * Allocate at a specific address.
   *
   * Used when a specific ZP location is required (e.g., hardware registers,
   * or for deterministic allocation order).
   *
   * @param address - The exact address to allocate
   * @param size - Number of bytes to allocate
   * @returns Allocation result
   *
   * @example
   * ```typescript
   * // Allocate at specific address for indirect Y pointer
   * const result = pool.allocateAt(0x50, 2);
   * ```
   */
  allocateAt(address: number, size: number): ZpAllocationResult {
    // Validate address range
    if (address < 0 || address + size > 256) {
      return {
        success: false,
        address: 0,
        error: `Address range $${address.toString(16)}-$${(address + size - 1).toString(16)} is outside ZP`,
      };
    }

    // Check all addresses in range are available
    for (let offset = 0; offset < size; offset++) {
      const addr = address + offset;

      if (this.unavailable.has(addr)) {
        return {
          success: false,
          address: 0,
          error: `Address $${addr.toString(16)} is reserved or outside allocatable range`,
        };
      }

      if (this.allocated[addr]) {
        return {
          success: false,
          address: 0,
          error: `Address $${addr.toString(16)} is already allocated`,
        };
      }
    }

    // Mark as allocated
    for (let offset = 0; offset < size; offset++) {
      this.allocated[address + offset] = true;
    }

    return {
      success: true,
      address,
    };
  }

  /**
   * Free previously allocated bytes.
   *
   * Returns the addresses to the free pool. Does not validate
   * that the addresses were actually allocated (caller's responsibility).
   *
   * @param address - Start address to free
   * @param size - Number of bytes to free
   *
   * @example
   * ```typescript
   * pool.free(result.address, 2);
   * // Addresses are now available for reallocation
   * ```
   */
  free(address: number, size: number): void {
    for (let offset = 0; offset < size; offset++) {
      const addr = address + offset;
      if (addr >= 0 && addr < 256 && !this.unavailable.has(addr)) {
        this.allocated[addr] = false;
      }
    }
  }

  /**
   * Check if a specific address is currently allocated.
   *
   * @param address - Address to check
   * @returns true if the address is allocated
   */
  isAllocated(address: number): boolean {
    if (address < 0 || address >= 256) {
      return false;
    }
    return this.allocated[address];
  }

  /**
   * Check if a specific address is available for allocation.
   *
   * An address is available if it's:
   * - Within the allocatable range
   * - Not reserved
   * - Not in scratch region
   * - Not already allocated
   *
   * @param address - Address to check
   * @returns true if the address can be allocated
   */
  isAvailable(address: number): boolean {
    if (address < 0 || address >= 256) {
      return false;
    }
    return !this.unavailable.has(address) && !this.allocated[address];
  }

  /**
   * Reset pool to initial state.
   *
   * Clears all allocations, making all addresses available again.
   * Useful for restarting allocation (e.g., for different compilation units).
   *
   * @example
   * ```typescript
   * pool.reset();
   * // All addresses available again
   * ```
   */
  reset(): void {
    this.allocated.fill(false);
  }

  /**
   * Get current pool statistics.
   *
   * Calculates usage statistics including fragmentation info.
   *
   * @returns Pool statistics
   *
   * @example
   * ```typescript
   * const stats = pool.getStats();
   * if (stats.utilizationPercent > 90) {
   *   console.warn('ZP nearly full');
   * }
   * ```
   */
  getStats(): ZpPoolStats {
    let bytesUsed = 0;
    let freeRegions = 0;
    let largestFreeBlock = 0;
    let currentFreeBlock = 0;
    let inFreeBlock = false;

    // Count allocatable addresses (within range, not unavailable)
    let bytesTotal = 0;
    for (let addr = this.rangeStart; addr < this.rangeEnd; addr++) {
      if (!this.unavailable.has(addr)) {
        bytesTotal++;
      }
    }

    // Scan through allocatable range
    for (let addr = this.rangeStart; addr < this.rangeEnd; addr++) {
      // Skip unavailable addresses
      if (this.unavailable.has(addr)) {
        // End current free block if any
        if (inFreeBlock) {
          if (currentFreeBlock > largestFreeBlock) {
            largestFreeBlock = currentFreeBlock;
          }
          inFreeBlock = false;
          currentFreeBlock = 0;
        }
        continue;
      }

      if (this.allocated[addr]) {
        bytesUsed++;
        // End current free block if any
        if (inFreeBlock) {
          if (currentFreeBlock > largestFreeBlock) {
            largestFreeBlock = currentFreeBlock;
          }
          inFreeBlock = false;
          currentFreeBlock = 0;
        }
      } else {
        // Free address
        if (!inFreeBlock) {
          // Start new free block
          freeRegions++;
          inFreeBlock = true;
        }
        currentFreeBlock++;
      }
    }

    // Handle free block at end of range
    if (inFreeBlock && currentFreeBlock > largestFreeBlock) {
      largestFreeBlock = currentFreeBlock;
    }

    const bytesFree = bytesTotal - bytesUsed;
    const utilizationPercent = bytesTotal > 0
      ? Math.round((bytesUsed / bytesTotal) * 100)
      : 0;

    return {
      bytesTotal,
      bytesUsed,
      bytesFree,
      utilizationPercent,
      freeRegions,
      largestFreeBlock,
    };
  }

  /**
   * Get the platform configuration.
   *
   * @returns Platform configuration used by this pool
   */
  getConfig(): PlatformConfig {
    return this.config;
  }

  /**
   * Get the allocatable range.
   *
   * @returns Object with start and end addresses
   */
  getRange(): { start: number; end: number } {
    return {
      start: this.rangeStart,
      end: this.rangeEnd,
    };
  }

  /**
   * Get a snapshot of allocated addresses.
   *
   * Returns an array of addresses currently allocated.
   * Useful for debugging and verification.
   *
   * @returns Array of allocated addresses
   */
  getAllocatedAddresses(): number[] {
    const addresses: number[] = [];
    for (let addr = this.rangeStart; addr < this.rangeEnd; addr++) {
      if (!this.unavailable.has(addr) && this.allocated[addr]) {
        addresses.push(addr);
      }
    }
    return addresses;
  }

  // ========================================
  // Protected Methods
  // ========================================

  /**
   * Find first contiguous block of free addresses.
   *
   * Scans from rangeStart to rangeEnd looking for N consecutive
   * free addresses. Uses first-fit strategy for determinism.
   *
   * @param size - Number of contiguous bytes needed
   * @returns Start address of free block, or -1 if not found
   */
  protected findContiguousFree(size: number): number {
    let consecutiveFree = 0;
    let blockStart = -1;

    for (let addr = this.rangeStart; addr < this.rangeEnd; addr++) {
      // Check if this address is available
      if (!this.unavailable.has(addr) && !this.allocated[addr]) {
        if (consecutiveFree === 0) {
          blockStart = addr;
        }
        consecutiveFree++;

        if (consecutiveFree >= size) {
          return blockStart;
        }
      } else {
        // Reset counter - this address is not free
        consecutiveFree = 0;
        blockStart = -1;
      }
    }

    return -1; // No suitable block found
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a ZP Pool for a platform.
 *
 * Convenience factory function.
 *
 * @param config - Platform configuration
 * @returns New ZP Pool instance
 *
 * @example
 * ```typescript
 * const pool = createZpPool(C64_PLATFORM_CONFIG);
 * ```
 */
export function createZpPool(config: PlatformConfig): ZpPool {
  return new ZpPool(config);
}