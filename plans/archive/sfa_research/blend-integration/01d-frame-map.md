# Blend Integration: FrameMap Interface

> **Document**: blend-integration/01d-frame-map.md
> **Parent**: [01-frame-types.md](01-frame-types.md)
> **Target File**: `packages/compiler-v2/src/frame/types.ts`
> **Status**: Design Complete

## Overview

The `FrameMap` interface represents the global allocation result containing all function frames and allocation statistics.

---

## 1. FrameMap Interface

```typescript
import { Frame } from './types.js';
import { PlatformConfig } from './platform.js';

/**
 * Global frame allocation map.
 *
 * Result of the frame allocation process, containing:
 * - All function frames by name
 * - Coalescing groups
 * - Platform configuration used
 * - Allocation statistics
 *
 * @example
 * ```typescript
 * // After allocation
 * const frameMap: FrameMap = allocator.allocate(program);
 *
 * // Get frame for a function
 * const addFrame = frameMap.getFrame('add');
 *
 * // Get address for a variable
 * const xAddr = frameMap.getAddress('main', 'x');
 * ```
 */
export interface FrameMap {
  // ========================================
  // Frame Storage
  // ========================================

  /**
   * All function frames by function name.
   * Key is fully qualified name (module.function).
   */
  readonly frames: Map<string, Frame>;

  /**
   * Coalescing groups (group ID → function names).
   * Functions in same group share memory.
   */
  readonly coalesceGroups: Map<number, string[]>;

  // ========================================
  // Configuration
  // ========================================

  /**
   * Platform configuration used for allocation.
   */
  readonly platform: PlatformConfig;

  // ========================================
  // Statistics
  // ========================================

  /**
   * Allocation statistics for reporting.
   */
  readonly stats: AllocationStats;

  // ========================================
  // Accessor Methods
  // ========================================

  /**
   * Get frame for a function.
   * @param functionName Fully qualified function name
   * @returns Frame or undefined if not found
   */
  getFrame(functionName: string): Frame | undefined;

  /**
   * Get absolute address for a variable.
   * @param functionName Function containing the variable
   * @param variableName Variable/parameter name
   * @returns Absolute address
   * @throws Error if function or variable not found
   */
  getAddress(functionName: string, variableName: string): number;

  /**
   * Get all functions in a coalesce group.
   * @param groupId Coalesce group ID
   * @returns Array of function names in the group
   */
  getCoalesceGroup(groupId: number): string[];

  /**
   * Check if a function exists in the frame map.
   * @param functionName Fully qualified function name
   */
  hasFrame(functionName: string): boolean;

  /**
   * Get all function names in the frame map.
   */
  getFunctionNames(): string[];
}
```

---

## 2. AllocationStats Interface

Statistics about the allocation process.

```typescript
/**
 * Allocation statistics for reporting.
 *
 * Provides detailed information about the allocation results,
 * useful for optimization feedback and debugging.
 */
export interface AllocationStats {
  // ========================================
  // Function Counts
  // ========================================

  /** Total functions processed */
  totalFunctions: number;

  /** Functions using static frames */
  staticFunctions: number;

  /** Functions detected as recursive (error case) */
  recursiveFunctions: number;

  // ========================================
  // Memory Usage
  // ========================================

  /** Total bytes in frame region (without coalescing) */
  frameRegionUsedRaw: number;

  /** Total bytes in frame region (with coalescing) */
  frameRegionUsedCoalesced: number;

  /** Bytes saved by coalescing */
  bytesSavedByCoalescing: number;

  /** Coalescing efficiency percentage (0-100) */
  coalescingEfficiency: number;

  // ========================================
  // Zero Page Usage
  // ========================================

  /** Total ZP bytes used */
  zpBytesUsed: number;

  /** ZP bytes available (platform limit) */
  zpBytesAvailable: number;

  /** Number of @zp required that succeeded */
  zpRequiredSucceeded: number;

  /** Number of @zp preferred that got ZP */
  zpPreferredInZp: number;

  /** Number of @zp preferred that fell back to RAM */
  zpPreferredInRam: number;

  /** Number of automatic ZP allocations */
  zpAutoAllocated: number;
}
```

---

## 3. Factory Function

Helper function to create a FrameMap with defaults.

```typescript
import { C64_PLATFORM_CONFIG } from './platform.js';

/**
 * Create a new frame map with sensible defaults.
 *
 * @param frames - Map of function frames
 * @param platform - Platform configuration (default: C64)
 * @param options - Optional overrides
 * @returns A new FrameMap with defaults applied
 */
export function createFrameMap(
  frames: Map<string, Frame>,
  platform: PlatformConfig = C64_PLATFORM_CONFIG,
  options?: Partial<Omit<FrameMap, 'getFrame' | 'getAddress' | 'getCoalesceGroup' | 'hasFrame' | 'getFunctionNames'>>
): FrameMap {
  const coalesceGroups = options?.coalesceGroups ?? new Map<number, string[]>();

  return {
    // Frame storage
    frames,
    coalesceGroups,

    // Configuration
    platform,

    // Statistics (to be calculated)
    stats: options?.stats ?? createDefaultStats(),

    // Accessor methods
    getFrame(functionName: string): Frame | undefined {
      return frames.get(functionName);
    },

    getAddress(functionName: string, variableName: string): number {
      const frame = frames.get(functionName);
      if (!frame) {
        throw new Error(`Unknown function: ${functionName}`);
      }

      const slot = frame.getSlot(variableName);
      if (!slot) {
        throw new Error(`Unknown variable: ${variableName} in ${functionName}`);
      }

      return slot.address;
    },

    getCoalesceGroup(groupId: number): string[] {
      return coalesceGroups.get(groupId) ?? [];
    },

    hasFrame(functionName: string): boolean {
      return frames.has(functionName);
    },

    getFunctionNames(): string[] {
      return Array.from(frames.keys());
    },
  };
}

/**
 * Create default (empty) allocation stats.
 */
export function createDefaultStats(): AllocationStats {
  return {
    totalFunctions: 0,
    staticFunctions: 0,
    recursiveFunctions: 0,
    frameRegionUsedRaw: 0,
    frameRegionUsedCoalesced: 0,
    bytesSavedByCoalescing: 0,
    coalescingEfficiency: 0,
    zpBytesUsed: 0,
    zpBytesAvailable: 0,
    zpRequiredSucceeded: 0,
    zpPreferredInZp: 0,
    zpPreferredInRam: 0,
    zpAutoAllocated: 0,
  };
}
```

---

## 4. Stats Formatter

Helper for formatting statistics for output.

```typescript
/**
 * Format allocation stats for console output.
 *
 * @param stats - Allocation statistics
 * @returns Formatted string
 */
export function formatAllocationStats(stats: AllocationStats): string {
  const lines: string[] = [
    '=== Frame Allocation Statistics ===',
    '',
    `Functions: ${stats.totalFunctions} total`,
    `  Static frames: ${stats.staticFunctions}`,
    `  Recursive (error): ${stats.recursiveFunctions}`,
    '',
    'Frame Region:',
    `  Raw usage: ${stats.frameRegionUsedRaw} bytes`,
    `  Coalesced: ${stats.frameRegionUsedCoalesced} bytes`,
    `  Saved: ${stats.bytesSavedByCoalescing} bytes (${stats.coalescingEfficiency.toFixed(1)}%)`,
    '',
    'Zero Page:',
    `  Used: ${stats.zpBytesUsed}/${stats.zpBytesAvailable} bytes`,
    `  @zp required: ${stats.zpRequiredSucceeded} succeeded`,
    `  @zp preferred: ${stats.zpPreferredInZp} in ZP, ${stats.zpPreferredInRam} in RAM`,
    `  Auto-allocated: ${stats.zpAutoAllocated}`,
    '',
  ];

  return lines.join('\n');
}
```

---

## 5. Usage Example

```typescript
import { createFrameMap, formatAllocationStats } from './frame/types.js';
import { C64_PLATFORM_CONFIG } from './frame/platform.js';

// After allocating frames
const frames = new Map<string, Frame>();
frames.set('main', mainFrame);
frames.set('add', addFrame);
frames.set('multiply', multiplyFrame);

// Create frame map
const frameMap = createFrameMap(frames, C64_PLATFORM_CONFIG, {
  coalesceGroups: new Map([
    [0, ['add', 'multiply']], // These functions share memory
  ]),
  stats: {
    totalFunctions: 3,
    staticFunctions: 3,
    recursiveFunctions: 0,
    frameRegionUsedRaw: 24,
    frameRegionUsedCoalesced: 16,
    bytesSavedByCoalescing: 8,
    coalescingEfficiency: 33.3,
    zpBytesUsed: 4,
    zpBytesAvailable: 142,
    zpRequiredSucceeded: 1,
    zpPreferredInZp: 2,
    zpPreferredInRam: 0,
    zpAutoAllocated: 1,
  },
});

// Access frame data
const mainFrame = frameMap.getFrame('main');
const counterAddr = frameMap.getAddress('main', 'counter');

// Print statistics
console.log(formatAllocationStats(frameMap.stats));
```

---

## Related Documents

| Document | Content |
|----------|---------|
| [01a-frame-enums.md](01a-frame-enums.md) | Enum definitions |
| [01b-frame-slot.md](01b-frame-slot.md) | FrameSlot interface |
| [01c-frame-interface.md](01c-frame-interface.md) | Frame interface |
| [01e-call-graph-types.md](01e-call-graph-types.md) | CallGraph types |

---

**Previous:** [01c-frame-interface.md](01c-frame-interface.md)
**Next:** [01e-call-graph-types.md](01e-call-graph-types.md)