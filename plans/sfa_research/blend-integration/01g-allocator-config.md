# Blend Integration: Allocator Configuration

> **Document**: blend-integration/01g-allocator-config.md
> **Parent**: [01-frame-types.md](01-frame-types.md)
> **Target File**: `packages/compiler-v2/src/frame/config.ts`
> **Status**: Design Complete

## Overview

Allocator configuration defines options for the frame allocator including ZP scoring weights, coalescing settings, and diagnostic options.

---

## 1. ZpScoringWeights Interface

Weights for the ZP priority scoring algorithm.

```typescript
/**
 * ZP scoring weights configuration.
 *
 * These weights determine how variables are prioritized for zero page allocation.
 * Higher weights = higher priority.
 *
 * Score formula:
 * score = typeWeight + (accessCount * accessMultiplier) + (loopDepth * loopMultiplier) + directiveBonus
 */
export interface ZpScoringWeights {
  /**
   * Weight for pointer types (highest priority).
   * Pointers in ZP enable efficient indirect addressing.
   * Default: 0x800 (2048)
   */
  pointerWeight: number;

  /**
   * Weight for byte types.
   * Single byte accesses are common and benefit from ZP.
   * Default: 0x100 (256)
   */
  byteWeight: number;

  /**
   * Weight for word types.
   * 16-bit accesses require 2 bytes, lower priority than bytes.
   * Default: 0x080 (128)
   */
  wordWeight: number;

  /**
   * Multiplier per access count.
   * More accesses = more benefit from ZP.
   * Default: 10
   */
  accessMultiplier: number;

  /**
   * Multiplier per loop nesting level.
   * Variables in nested loops benefit significantly from ZP.
   * Default: 50 (exponentially weighted internally)
   */
  loopDepthMultiplier: number;

  /**
   * Bonus for @zp directive.
   * Ensures user-requested ZP allocation has high priority.
   * Default: 10000
   */
  zpPreferredBonus: number;
}
```

---

## 2. Default ZP Weights

```typescript
/**
 * Default ZP scoring weights.
 *
 * These values are tuned for typical C64 programs.
 * Pointers get highest priority (indirect addressing).
 * Loop-nested variables get significant bonus.
 */
export const DEFAULT_ZP_WEIGHTS: ZpScoringWeights = {
  pointerWeight: 0x800,      // 2048 - pointers are most valuable in ZP
  byteWeight: 0x100,         // 256 - single bytes are common
  wordWeight: 0x080,         // 128 - words need 2 bytes
  accessMultiplier: 10,      // Each access adds 10 points
  loopDepthMultiplier: 50,   // Each loop level adds 50 points (exponential)
  zpPreferredBonus: 10000,   // @zp directive guarantees high priority
};
```

---

## 3. FrameAllocatorConfig Interface

Main configuration for the frame allocator.

```typescript
import { PlatformConfig, C64_PLATFORM_CONFIG } from './platform.js';

/**
 * Configuration options for the frame allocator.
 *
 * Controls all aspects of frame allocation including:
 * - Platform memory configuration
 * - Coalescing (frame sharing)
 * - Zero page allocation
 * - Diagnostics and warnings
 */
export interface FrameAllocatorConfig {
  // ========================================
  // Platform
  // ========================================

  /** Platform configuration (memory layout) */
  platform: PlatformConfig;

  // ========================================
  // Coalescing
  // ========================================

  /**
   * Enable frame coalescing (sharing memory between non-overlapping functions).
   * Reduces total memory usage but requires call graph analysis.
   * Default: true
   */
  enableCoalescing: boolean;

  /**
   * Treat all functions as potentially recursive (disables coalescing).
   * Use when call graph analysis is unavailable or unreliable.
   * Default: false
   */
  assumeRecursive: boolean;

  // ========================================
  // Zero Page
  // ========================================

  /**
   * Enable automatic ZP allocation for high-priority variables.
   * Variables in loops and pointers get ZP automatically.
   * Default: true
   */
  enableAutoZp: boolean;

  /** ZP scoring weights for priority calculation */
  zpWeights: ZpScoringWeights;

  // ========================================
  // Limits
  // ========================================

  /**
   * Maximum allowed frame size per function (bytes).
   * Functions exceeding this generate an error.
   * Default: 256
   */
  maxFrameSize: number;

  /**
   * Warning threshold for call depth.
   * Emit warning if call depth exceeds this value.
   * Default: 20
   */
  callDepthWarningThreshold: number;

  // ========================================
  // Diagnostics
  // ========================================

  /**
   * Emit allocation statistics after allocation.
   * Shows memory usage, coalescing savings, ZP allocation.
   * Default: true
   */
  emitStats: boolean;

  /**
   * Verbose logging during allocation.
   * Useful for debugging allocation decisions.
   * Default: false
   */
  verbose: boolean;
}
```

---

## 4. Default Configuration

```typescript
/**
 * Default frame allocator configuration.
 *
 * Suitable for most C64 programs.
 */
export const DEFAULT_ALLOCATOR_CONFIG: FrameAllocatorConfig = {
  // Platform
  platform: C64_PLATFORM_CONFIG,

  // Coalescing
  enableCoalescing: true,
  assumeRecursive: false,

  // Zero page
  enableAutoZp: true,
  zpWeights: DEFAULT_ZP_WEIGHTS,

  // Limits
  maxFrameSize: 256,
  callDepthWarningThreshold: 20,

  // Diagnostics
  emitStats: true,
  verbose: false,
};
```

---

## 5. Configuration Builder

Fluent API for building allocator configuration.

```typescript
/**
 * Builder for creating allocator configuration.
 *
 * Provides a fluent API for customizing configuration.
 *
 * @example
 * ```typescript
 * const config = new AllocatorConfigBuilder()
 *   .platform(X16_PLATFORM_CONFIG)
 *   .disableCoalescing()
 *   .verbose(true)
 *   .build();
 * ```
 */
export class AllocatorConfigBuilder {
  protected config: FrameAllocatorConfig;

  constructor(base?: Partial<FrameAllocatorConfig>) {
    this.config = { ...DEFAULT_ALLOCATOR_CONFIG, ...base };
  }

  /**
   * Set the target platform.
   */
  platform(platform: PlatformConfig): this {
    this.config.platform = platform;
    return this;
  }

  /**
   * Enable frame coalescing.
   */
  enableCoalescing(): this {
    this.config.enableCoalescing = true;
    return this;
  }

  /**
   * Disable frame coalescing.
   */
  disableCoalescing(): this {
    this.config.enableCoalescing = false;
    return this;
  }

  /**
   * Assume all functions are recursive (safe mode).
   */
  safeMode(): this {
    this.config.assumeRecursive = true;
    this.config.enableCoalescing = false;
    return this;
  }

  /**
   * Enable automatic ZP allocation.
   */
  enableAutoZp(): this {
    this.config.enableAutoZp = true;
    return this;
  }

  /**
   * Disable automatic ZP allocation.
   */
  disableAutoZp(): this {
    this.config.enableAutoZp = false;
    return this;
  }

  /**
   * Set ZP scoring weights.
   */
  zpWeights(weights: Partial<ZpScoringWeights>): this {
    this.config.zpWeights = { ...this.config.zpWeights, ...weights };
    return this;
  }

  /**
   * Set maximum frame size.
   */
  maxFrameSize(size: number): this {
    this.config.maxFrameSize = size;
    return this;
  }

  /**
   * Set call depth warning threshold.
   */
  callDepthWarning(threshold: number): this {
    this.config.callDepthWarningThreshold = threshold;
    return this;
  }

  /**
   * Enable/disable statistics output.
   */
  emitStats(emit: boolean): this {
    this.config.emitStats = emit;
    return this;
  }

  /**
   * Enable/disable verbose logging.
   */
  verbose(verbose: boolean): this {
    this.config.verbose = verbose;
    return this;
  }

  /**
   * Build the configuration.
   */
  build(): FrameAllocatorConfig {
    return { ...this.config };
  }
}
```

---

## 6. Diagnostic Types

Types for allocator diagnostics.

```typescript
import { DiagnosticSeverity } from './enums.js';
import { SourceLocation } from '../ast/base.js';

/**
 * A diagnostic message from the allocator.
 */
export interface AllocationDiagnostic {
  /** Severity level */
  readonly severity: DiagnosticSeverity;

  /** Diagnostic code (for categorization) */
  readonly code: string;

  /** Human-readable message */
  readonly message: string;

  /** Function name (if applicable) */
  readonly functionName?: string;

  /** Variable name (if applicable) */
  readonly variableName?: string;

  /** Source location (if available) */
  readonly location?: SourceLocation;

  /** Suggestion for fixing the issue */
  readonly suggestion?: string;
}

/**
 * Common diagnostic codes.
 */
export const DiagnosticCodes = {
  // Errors (B65xx)
  RECURSION_DETECTED: 'B6502',
  ZP_REQUIRED_FAILED: 'B6510',
  FRAME_OVERFLOW: 'B6520',
  FRAME_TOO_LARGE: 'B6521',

  // Warnings (B65xx)
  ZP_PREFERRED_FALLBACK: 'B6530',
  DEEP_CALL_STACK: 'B6531',
  ISR_SHARED_FUNCTION: 'B6532',
  LARGE_FRAME: 'B6533',

  // Info (B65xx)
  COALESCING_SAVED: 'B6540',
  ZP_AUTO_ALLOCATED: 'B6541',
  FRAME_ALLOCATED: 'B6542',
} as const;

/**
 * Create a diagnostic message.
 */
export function createDiagnostic(
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  options?: Partial<AllocationDiagnostic>
): AllocationDiagnostic {
  return {
    severity,
    code,
    message,
    ...options,
  };
}
```

---

## 7. Exports

```typescript
// packages/compiler-v2/src/frame/config.ts

export {
  ZpScoringWeights,
  DEFAULT_ZP_WEIGHTS,
  FrameAllocatorConfig,
  DEFAULT_ALLOCATOR_CONFIG,
  AllocatorConfigBuilder,
  AllocationDiagnostic,
  DiagnosticCodes,
  createDiagnostic,
};
```

---

## 8. Usage Example

```typescript
import { AllocatorConfigBuilder } from './frame/config.js';
import { X16_PLATFORM_CONFIG } from './frame/platform.js';

// Default C64 configuration
const defaultConfig = DEFAULT_ALLOCATOR_CONFIG;

// Custom configuration for X16
const x16Config = new AllocatorConfigBuilder()
  .platform(X16_PLATFORM_CONFIG)
  .maxFrameSize(512) // X16 has more RAM
  .verbose(true)
  .build();

// Safe mode (no coalescing, no auto-ZP)
const safeConfig = new AllocatorConfigBuilder()
  .safeMode()
  .disableAutoZp()
  .build();

// Aggressive ZP allocation
const aggressiveZp = new AllocatorConfigBuilder()
  .enableAutoZp()
  .zpWeights({
    pointerWeight: 0x1000, // Even higher pointer priority
    accessMultiplier: 20,  // More weight per access
  })
  .build();
```

---

## Related Documents

| Document | Content |
|----------|---------|
| [01a-frame-enums.md](01a-frame-enums.md) | Enum definitions |
| [01f-platform-config.md](01f-platform-config.md) | Platform configuration |
| [01-frame-types.md](01-frame-types.md) | Index document |

---

**Previous:** [01f-platform-config.md](01f-platform-config.md)
**Next:** [01-frame-types.md](01-frame-types.md) (Index)