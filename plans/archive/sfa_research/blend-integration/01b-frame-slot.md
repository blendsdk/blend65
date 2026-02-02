# Blend Integration: FrameSlot Interface

> **Document**: blend-integration/01b-frame-slot.md
> **Parent**: [01-frame-types.md](01-frame-types.md)
> **Target File**: `packages/compiler-v2/src/frame/types.ts`
> **Status**: Design Complete

## Overview

The `FrameSlot` interface represents a single variable (parameter, local, or return value) within a function's frame. This is the fundamental building block of the frame system.

---

## 1. FrameSlot Interface

```typescript
import { TypeInfo } from '../semantic/types.js';
import { SlotLocation, SlotKind, ZpDirective } from './enums.js';

/**
 * A slot in a function's frame.
 *
 * Each parameter, local variable, and return value gets a slot.
 * The slot tracks:
 * - Basic info: name, kind, type, size
 * - Allocation: location, address, offset
 * - ZP analysis: directive, score, access patterns
 * - Arrays: isArrayElement, arraySize
 *
 * @example
 * ```typescript
 * // A byte parameter slot
 * const slot: FrameSlot = {
 *   name: 'x',
 *   kind: SlotKind.Parameter,
 *   type: BUILTIN_TYPES.BYTE,
 *   size: 1,
 *   zpDirective: ZpDirective.None,
 *   location: SlotLocation.FrameRegion,
 *   address: 0x0200,
 *   offset: 0,
 *   accessCount: 5,
 *   maxLoopDepth: 2,
 *   zpScore: 0,
 *   isArrayElement: false,
 * };
 * ```
 */
export interface FrameSlot {
  // ========================================
  // Basic Information
  // ========================================

  /**
   * Slot name (variable/parameter name).
   * For return slots, this is '__return'.
   * For temporaries, this is '__temp_N'.
   */
  readonly name: string;

  /**
   * Kind of slot (parameter, local, return, temporary).
   * Determines allocation order within frame.
   */
  readonly kind: SlotKind;

  /**
   * Type information from semantic analysis.
   * Used for size calculation and type checking.
   */
  readonly type: TypeInfo;

  /**
   * Size in bytes.
   * - byte/bool: 1
   * - word: 2
   * - array: elementSize * count
   */
  readonly size: number;

  // ========================================
  // Zero Page Handling
  // ========================================

  /**
   * Zero page directive from source code annotation.
   * - None: compiler decides based on scoring
   * - Required: must be in ZP, error if impossible
   * - Preferred: prefer ZP, silent fallback to RAM
   * - Forbidden: never in ZP (@ram)
   */
  readonly zpDirective: ZpDirective;

  // ========================================
  // Allocation Results (mutable)
  // ========================================

  /**
   * Assigned storage location after allocation.
   * Set by the frame allocator.
   */
  location: SlotLocation;

  /**
   * Absolute address after allocation.
   * This is the final memory address used in generated code.
   */
  address: number;

  /**
   * Offset from frame base (for frame region slots).
   * For ZP slots, this is 0 (address is absolute).
   */
  offset: number;

  /**
   * Register name for register-passed parameters.
   * Only set when location === SlotLocation.Register.
   * Values: 'A', 'X', 'Y'
   */
  register?: string;

  // ========================================
  // Analysis Data (for ZP scoring)
  // ========================================

  /**
   * Access count from variable usage analysis.
   * Higher count = more likely to benefit from ZP.
   */
  accessCount: number;

  /**
   * Maximum loop nesting depth where this slot is accessed.
   * Variables in deep loops benefit more from ZP placement.
   */
  maxLoopDepth: number;

  /**
   * Computed ZP priority score.
   * Higher score = higher priority for ZP allocation.
   * Set by the ZP scoring algorithm.
   */
  zpScore: number;

  // ========================================
  // Array Handling
  // ========================================

  /**
   * Is this slot part of an array?
   * If true, this represents the array base.
   */
  isArrayElement: boolean;

  /**
   * Array size if this is an array base slot.
   * Undefined for non-array slots.
   */
  arraySize?: number;
}
```

---

## 2. ZP Score Breakdown

Optional interface for debugging ZP score calculations.

```typescript
/**
 * Breakdown of ZP score calculation (for debugging).
 *
 * Used to understand why a slot received its ZP score.
 */
export interface ZpScoreBreakdown {
  /** Base score from type (pointers high, bytes medium, words low) */
  typeWeight: number;

  /** Bonus from access count (more accesses = higher bonus) */
  accessBonus: number;

  /** Bonus from loop depth (deeper loops = higher bonus) */
  loopBonus: number;

  /** Bonus from @zp directive (10000 for preferred) */
  directiveBonus: number;

  /** Final computed score */
  totalScore: number;
}
```

---

## 3. Factory Function

Helper function to create a FrameSlot with defaults.

```typescript
import { BUILTIN_TYPES } from '../semantic/types.js';

/**
 * Create a new frame slot with sensible defaults.
 *
 * @param name - Slot name (variable/parameter name)
 * @param kind - Kind of slot (parameter, local, return, temporary)
 * @param type - TypeInfo for the slot
 * @param options - Optional overrides for any slot property
 * @returns A new FrameSlot with defaults applied
 *
 * @example
 * ```typescript
 * // Create a parameter slot
 * const param = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE);
 *
 * // Create a ZP-required local
 * const local = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
 *   zpDirective: ZpDirective.Required,
 * });
 * ```
 */
export function createFrameSlot(
  name: string,
  kind: SlotKind,
  type: TypeInfo,
  options?: Partial<FrameSlot>
): FrameSlot {
  return {
    // Basic info
    name,
    kind,
    type,
    size: getTypeSize(type),

    // ZP handling
    zpDirective: ZpDirective.None,

    // Allocation results (to be set later)
    location: SlotLocation.FrameRegion,
    address: 0,
    offset: 0,

    // Analysis data (to be set by analysis phase)
    accessCount: 0,
    maxLoopDepth: 0,
    zpScore: 0,

    // Array handling
    isArrayElement: type.kind === TypeKind.Array,
    arraySize: type.elementCount,

    // Apply overrides
    ...options,
  };
}

/**
 * Get size of a type in bytes.
 *
 * @param type - TypeInfo to get size of
 * @returns Size in bytes
 */
export function getTypeSize(type: TypeInfo): number {
  switch (type.kind) {
    case TypeKind.Byte:
    case TypeKind.Bool:
      return 1;
    case TypeKind.Word:
      return 2;
    case TypeKind.Array:
      if (type.elementType && type.elementCount !== undefined) {
        return getTypeSize(type.elementType) * type.elementCount;
      }
      return 0; // Unsized array
    default:
      return type.size || 1;
  }
}
```

---

## 4. Type Guards

Helper functions for type narrowing.

```typescript
/**
 * Check if slot is a parameter.
 */
export function isParameterSlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Parameter;
}

/**
 * Check if slot is a local variable.
 */
export function isLocalSlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Local;
}

/**
 * Check if slot is the return value.
 */
export function isReturnSlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Return;
}

/**
 * Check if slot is a temporary.
 */
export function isTemporarySlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Temporary;
}

/**
 * Check if slot is in zero page.
 */
export function isZpSlot(slot: FrameSlot): boolean {
  return slot.location === SlotLocation.ZeroPage;
}

/**
 * Check if slot is in frame region.
 */
export function isFrameRegionSlot(slot: FrameSlot): boolean {
  return slot.location === SlotLocation.FrameRegion;
}

/**
 * Check if slot requires ZP placement.
 */
export function requiresZp(slot: FrameSlot): boolean {
  return slot.zpDirective === ZpDirective.Required;
}

/**
 * Check if slot prefers ZP placement.
 */
export function prefersZp(slot: FrameSlot): boolean {
  return slot.zpDirective === ZpDirective.Preferred;
}

/**
 * Check if slot is forbidden from ZP.
 */
export function forbiddenFromZp(slot: FrameSlot): boolean {
  return slot.zpDirective === ZpDirective.Forbidden;
}
```

---

## 5. Usage Example

```typescript
import { createFrameSlot, isZpSlot, requiresZp } from './frame/types.js';
import { SlotKind, ZpDirective } from './frame/enums.js';
import { BUILTIN_TYPES } from './semantic/types.js';

// Create parameter slots for function(a: byte, b: word)
const paramA = createFrameSlot('a', SlotKind.Parameter, BUILTIN_TYPES.BYTE);
const paramB = createFrameSlot('b', SlotKind.Parameter, BUILTIN_TYPES.WORD);

// Create ZP-required local: @zp required let ptr: word
const localPtr = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
  zpDirective: ZpDirective.Required,
});

// Create return slot for function returning byte
const returnSlot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.BYTE);

// After allocation, check results
if (requiresZp(localPtr) && !isZpSlot(localPtr)) {
  // Error: @zp required slot not in ZP!
}
```

---

## Related Documents

| Document | Content |
|----------|---------|
| [01a-frame-enums.md](01a-frame-enums.md) | Enum definitions |
| [01c-frame-interface.md](01c-frame-interface.md) | Frame interface |
| [01d-frame-map.md](01d-frame-map.md) | FrameMap interface |

---

**Previous:** [01a-frame-enums.md](01a-frame-enums.md)
**Next:** [01c-frame-interface.md](01c-frame-interface.md)