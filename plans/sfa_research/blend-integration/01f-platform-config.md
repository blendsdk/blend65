# Blend Integration: Platform Configuration

> **Document**: blend-integration/01f-platform-config.md
> **Parent**: [01-frame-types.md](01-frame-types.md)
> **Target File**: `packages/compiler-v2/src/frame/platform.ts`
> **Status**: Design Complete

## Overview

Platform configuration defines memory layout and constraints for each target platform (C64, Commander X16, etc.).

---

## 1. ZpRegion Interface

A contiguous region of zero page memory.

```typescript
/**
 * A contiguous region of zero page memory.
 *
 * Used to describe available ZP areas and special regions
 * like compiler scratch space.
 */
export interface ZpRegion {
  /** Start address (inclusive) */
  readonly start: number;

  /** End address (exclusive) */
  readonly end: number;

  /** Size in bytes (end - start) */
  readonly size: number;

  /** Purpose/label for this region */
  readonly label: string;
}
```

---

## 2. PlatformConfig Interface

```typescript
/**
 * Platform-specific memory configuration.
 *
 * Defines memory layout, limits, and constraints for a target platform.
 * Each platform has different available memory regions.
 */
export interface PlatformConfig {
  // ========================================
  // Identity
  // ========================================

  /** Platform identifier */
  readonly platform: 'c64' | 'x16' | 'nes' | 'custom';

  /** Platform display name */
  readonly displayName: string;

  // ========================================
  // Frame Region
  // ========================================

  /** Start address of frame region (inclusive) */
  readonly frameRegionStart: number;

  /** End address of frame region (exclusive) */
  readonly frameRegionEnd: number;

  /** Frame region size in bytes */
  readonly frameRegionSize: number;

  // ========================================
  // Zero Page
  // ========================================

  /** Start of available ZP (inclusive) */
  readonly zpStart: number;

  /** End of available ZP (exclusive) */
  readonly zpEnd: number;

  /** Available ZP size in bytes */
  readonly zpAvailable: number;

  /** Reserved ZP addresses (system use, cannot allocate) */
  readonly zpReserved: number[];

  /** Compiler scratch ZP locations (for code generation) */
  readonly zpScratch: ZpRegion;

  // ========================================
  // Hardware Stack
  // ========================================

  /** Hardware stack start ($0100 on 6502) */
  readonly hwStackStart: number;

  /** Hardware stack end ($01FF on 6502) */
  readonly hwStackEnd: number;

  /** Maximum recommended call depth */
  readonly maxRecommendedCallDepth: number;

  // ========================================
  // Type Information
  // ========================================

  /** Size of pointer type (2 on 6502) */
  readonly pointerSize: number;

  /** Alignment requirement (1 = none, 2 = word-aligned) */
  readonly alignment: number;
}
```

---

## 3. C64 Platform Configuration

Default configuration for Commodore 64.

```typescript
/**
 * Commodore 64 platform configuration.
 *
 * Memory Map:
 * - $0000-$00FF: Zero Page
 *   - $00-$01: CPU indirect pointers (reserved)
 *   - $02-$8F: Available for variables (142 bytes)
 *   - $90-$FA: KERNAL workspace (avoid unless KERNAL disabled)
 *   - $FB-$FE: Compiler scratch (4 bytes)
 *   - $FF: Reserved
 * - $0100-$01FF: Hardware stack (256 bytes)
 * - $0200-$033B: OS input buffer (avoid)
 * - $033C-$03FF: Tape buffer (164 bytes, usable if no tape)
 *
 * Frame region: $0200-$0400 (512 bytes)
 * Can be adjusted based on program requirements.
 */
export const C64_PLATFORM_CONFIG: PlatformConfig = {
  platform: 'c64',
  displayName: 'Commodore 64',

  // Frame region: $0200-$03FF (512 bytes)
  // This is the input buffer area - safe if not using BASIC input
  frameRegionStart: 0x0200,
  frameRegionEnd: 0x0400,
  frameRegionSize: 512,

  // Zero page: $02-$8F (142 bytes usable)
  // Avoids KERNAL workspace and system locations
  zpStart: 0x02,
  zpEnd: 0x90,
  zpAvailable: 142,
  zpReserved: [0x00, 0x01], // CPU indirect ($00/$01 must be valid pointers)

  // Compiler scratch: $FB-$FE (4 bytes)
  // Used by code generator for temporary operations
  zpScratch: {
    start: 0xfb,
    end: 0xff,
    size: 4,
    label: 'compiler_scratch',
  },

  // Hardware stack
  hwStackStart: 0x0100,
  hwStackEnd: 0x0200,
  maxRecommendedCallDepth: 40, // ~6 bytes per JSR/RTS + registers

  // Types
  pointerSize: 2,
  alignment: 1, // No alignment required on 6502
};
```

---

## 4. Commander X16 Platform Configuration

Configuration for Commander X16.

```typescript
/**
 * Commander X16 platform configuration.
 *
 * Memory Map:
 * - $0000-$00FF: Zero Page
 *   - $00-$21: System use (reserved)
 *   - $22-$7F: Available for variables (94 bytes)
 *   - $80-$FF: KERNAL/BASIC workspace
 * - $0100-$01FF: Hardware stack
 * - $0400-$0800: Safe frame region (1KB)
 *
 * Frame region: $0400-$0800 (1KB)
 * X16 has more RAM, can use larger frame region.
 */
export const X16_PLATFORM_CONFIG: PlatformConfig = {
  platform: 'x16',
  displayName: 'Commander X16',

  // Frame region: $0400-$0800 (1KB)
  frameRegionStart: 0x0400,
  frameRegionEnd: 0x0800,
  frameRegionSize: 1024,

  // Zero page: $22-$7F (94 bytes usable)
  zpStart: 0x22,
  zpEnd: 0x80,
  zpAvailable: 94,
  zpReserved: Array.from({ length: 0x22 }, (_, i) => i), // $00-$21

  // Compiler scratch: $7C-$7F (4 bytes)
  zpScratch: {
    start: 0x7c,
    end: 0x80,
    size: 4,
    label: 'compiler_scratch',
  },

  // Hardware stack
  hwStackStart: 0x0100,
  hwStackEnd: 0x0200,
  maxRecommendedCallDepth: 40,

  // Types
  pointerSize: 2,
  alignment: 1,
};
```

---

## 5. Custom Platform Helper

Factory function for creating custom platform configurations.

```typescript
/**
 * Create a custom platform configuration.
 *
 * @param options - Platform configuration options
 * @returns A valid PlatformConfig
 *
 * @example
 * ```typescript
 * const myPlatform = createCustomPlatform({
 *   displayName: 'My 6502 System',
 *   frameRegionStart: 0x0300,
 *   frameRegionEnd: 0x0500,
 *   zpStart: 0x10,
 *   zpEnd: 0x80,
 * });
 * ```
 */
export function createCustomPlatform(
  options: Partial<PlatformConfig> & {
    displayName: string;
    frameRegionStart: number;
    frameRegionEnd: number;
    zpStart: number;
    zpEnd: number;
  }
): PlatformConfig {
  const frameRegionSize = options.frameRegionEnd - options.frameRegionStart;
  const zpAvailable = options.zpEnd - options.zpStart;

  return {
    platform: 'custom',
    displayName: options.displayName,

    // Frame region
    frameRegionStart: options.frameRegionStart,
    frameRegionEnd: options.frameRegionEnd,
    frameRegionSize,

    // Zero page
    zpStart: options.zpStart,
    zpEnd: options.zpEnd,
    zpAvailable,
    zpReserved: options.zpReserved ?? [],

    // Compiler scratch (default to last 4 bytes of ZP region)
    zpScratch: options.zpScratch ?? {
      start: options.zpEnd - 4,
      end: options.zpEnd,
      size: 4,
      label: 'compiler_scratch',
    },

    // Hardware stack (standard 6502)
    hwStackStart: options.hwStackStart ?? 0x0100,
    hwStackEnd: options.hwStackEnd ?? 0x0200,
    maxRecommendedCallDepth: options.maxRecommendedCallDepth ?? 40,

    // Types
    pointerSize: options.pointerSize ?? 2,
    alignment: options.alignment ?? 1,
  };
}
```

---

## 6. Platform Registry

Get platform configuration by name.

```typescript
/** Map of known platform configurations */
const PLATFORM_CONFIGS: Map<string, PlatformConfig> = new Map([
  ['c64', C64_PLATFORM_CONFIG],
  ['x16', X16_PLATFORM_CONFIG],
]);

/**
 * Get platform configuration by name.
 *
 * @param platform - Platform name ('c64', 'x16')
 * @returns Platform configuration
 * @throws Error if platform not found
 */
export function getPlatformConfig(platform: string): PlatformConfig {
  const config = PLATFORM_CONFIGS.get(platform.toLowerCase());
  if (!config) {
    throw new Error(
      `Unknown platform: ${platform}. Available: ${Array.from(PLATFORM_CONFIGS.keys()).join(', ')}`
    );
  }
  return config;
}

/**
 * Get list of available platform names.
 */
export function getAvailablePlatforms(): string[] {
  return Array.from(PLATFORM_CONFIGS.keys());
}
```

---

## 7. Exports

```typescript
// packages/compiler-v2/src/frame/platform.ts

export {
  ZpRegion,
  PlatformConfig,
  C64_PLATFORM_CONFIG,
  X16_PLATFORM_CONFIG,
  createCustomPlatform,
  getPlatformConfig,
  getAvailablePlatforms,
};
```

---

## Related Documents

| Document | Content |
|----------|---------|
| [01a-frame-enums.md](01a-frame-enums.md) | Enum definitions |
| [01d-frame-map.md](01d-frame-map.md) | FrameMap interface |
| [01g-allocator-config.md](01g-allocator-config.md) | Allocator configuration |

---

**Previous:** [01e-call-graph-types.md](01e-call-graph-types.md)
**Next:** [01g-allocator-config.md](01g-allocator-config.md)