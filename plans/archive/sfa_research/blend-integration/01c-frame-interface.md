# Blend Integration: Frame Interface

> **Document**: blend-integration/01c-frame-interface.md
> **Parent**: [01-frame-types.md](01-frame-types.md)
> **Target File**: `packages/compiler-v2/src/frame/types.ts`
> **Status**: Design Complete

## Overview

The `Frame` interface represents all storage for a single function, containing all slots for parameters, locals, and return value.

---

## 1. Frame Interface

```typescript
import { FrameSlot } from './types.js';
import { SlotKind, SlotLocation, ThreadContext } from './enums.js';

/**
 * A function's static frame.
 *
 * Contains all slots for parameters, locals, and return value.
 * The frame tracks:
 * - All slots in allocation order
 * - Size information (frame region and ZP)
 * - Base addresses after allocation
 * - Coalescing and thread context info
 *
 * @example
 * ```typescript
 * // Frame for: function add(a: byte, b: byte): byte
 * const frame: Frame = {
 *   functionName: 'add',
 *   slots: [paramA, paramB, returnSlot],
 *   totalFrameSize: 3,
 *   totalZpSize: 0,
 *   frameBaseAddress: 0x0200,
 *   isRecursive: false,
 *   coalesceGroupId: 0,
 *   threadContext: ThreadContext.MainOnly,
 * };
 * ```
 */
export interface Frame {
  // ========================================
  // Identity
  // ========================================

  /**
   * Function name (fully qualified: module.function).
   * Used as key in FrameMap.
   */
  readonly functionName: string;

  // ========================================
  // Slots
  // ========================================

  /**
   * All slots in this frame.
   * Order: parameters → return → locals → temporaries
   */
  readonly slots: FrameSlot[];

  // ========================================
  // Size Information
  // ========================================

  /**
   * Total size of frame region slots (excludes ZP slots).
   * This is the space needed in the frame region.
   */
  totalFrameSize: number;

  /**
   * Total size of ZP slots.
   * This is the space needed in zero page.
   */
  totalZpSize: number;

  // ========================================
  // Allocation Results
  // ========================================

  /**
   * Base address in frame region (after allocation).
   * Frame region slots are at: frameBaseAddress + slot.offset
   */
  frameBaseAddress: number;

  // ========================================
  // Recursion & Coalescing
  // ========================================

  /**
   * Is this a recursive function?
   * If true, this function uses stack-based frames (not static).
   * Recursion is typically rejected, but this flag allows detection.
   */
  isRecursive: boolean;

  /**
   * Coalescing group ID.
   * Functions in same group share memory (non-overlapping execution).
   * -1 means no coalescing (standalone frame).
   */
  coalesceGroupId: number;

  /**
   * Thread context (main, isr, or both).
   * Functions with different contexts cannot coalesce.
   */
  threadContext: ThreadContext;

  // ========================================
  // Accessor Methods
  // ========================================

  /**
   * Get a slot by name.
   * @param name Variable/parameter name
   * @returns The slot or undefined if not found
   */
  getSlot(name: string): FrameSlot | undefined;

  /**
   * Get all parameter slots.
   * @returns Array of parameter slots in declaration order
   */
  getParameters(): FrameSlot[];

  /**
   * Get all local slots.
   * @returns Array of local slots in declaration order
   */
  getLocals(): FrameSlot[];

  /**
   * Get the return slot (if any).
   * @returns Return slot or undefined for void functions
   */
  getReturnSlot(): FrameSlot | undefined;

  /**
   * Get all ZP slots.
   * @returns Array of slots allocated to zero page
   */
  getZpSlots(): FrameSlot[];

  /**
   * Get all frame region slots.
   * @returns Array of slots allocated to frame region
   */
  getFrameSlots(): FrameSlot[];
}
```

---

## 2. Factory Function

Helper function to create a Frame with defaults.

```typescript
/**
 * Create a new frame with sensible defaults.
 *
 * @param functionName - Fully qualified function name
 * @param options - Optional overrides for any frame property
 * @returns A new Frame with defaults applied
 *
 * @example
 * ```typescript
 * // Create empty frame for 'main'
 * const mainFrame = createFrame('main');
 *
 * // Create frame with slots
 * const addFrame = createFrame('add', {
 *   slots: [paramA, paramB, returnSlot],
 * });
 * ```
 */
export function createFrame(
  functionName: string,
  options?: Partial<Omit<Frame, 'getSlot' | 'getParameters' | 'getLocals' | 'getReturnSlot' | 'getZpSlots' | 'getFrameSlots'>>
): Frame {
  const slots: FrameSlot[] = options?.slots ?? [];

  return {
    // Identity
    functionName,

    // Slots
    slots,

    // Size (to be calculated)
    totalFrameSize: 0,
    totalZpSize: 0,

    // Allocation results (to be set)
    frameBaseAddress: 0,

    // Recursion & coalescing
    isRecursive: false,
    coalesceGroupId: -1,
    threadContext: ThreadContext.MainOnly,

    // Apply overrides
    ...options,

    // Accessor methods
    getSlot(name: string): FrameSlot | undefined {
      return slots.find((s) => s.name === name);
    },

    getParameters(): FrameSlot[] {
      return slots.filter((s) => s.kind === SlotKind.Parameter);
    },

    getLocals(): FrameSlot[] {
      return slots.filter((s) => s.kind === SlotKind.Local);
    },

    getReturnSlot(): FrameSlot | undefined {
      return slots.find((s) => s.kind === SlotKind.Return);
    },

    getZpSlots(): FrameSlot[] {
      return slots.filter((s) => s.location === SlotLocation.ZeroPage);
    },

    getFrameSlots(): FrameSlot[] {
      return slots.filter((s) => s.location === SlotLocation.FrameRegion);
    },
  };
}
```

---

## 3. Frame Builder Class

Builder pattern for constructing frames.

```typescript
import { TypeInfo } from '../semantic/types.js';

/**
 * Builder for constructing Frame objects.
 *
 * Provides a fluent API for adding slots and setting properties.
 *
 * @example
 * ```typescript
 * const frame = new FrameBuilder('add')
 *   .addParameter('a', BUILTIN_TYPES.BYTE)
 *   .addParameter('b', BUILTIN_TYPES.BYTE)
 *   .setReturnType(BUILTIN_TYPES.BYTE)
 *   .addLocal('temp', BUILTIN_TYPES.BYTE)
 *   .build();
 * ```
 */
export class FrameBuilder {
  protected functionName: string;
  protected slots: FrameSlot[] = [];
  protected threadContext: ThreadContext = ThreadContext.MainOnly;

  constructor(functionName: string) {
    this.functionName = functionName;
  }

  /**
   * Add a parameter slot.
   */
  addParameter(name: string, type: TypeInfo, zpDirective?: ZpDirective): this {
    this.slots.push(createFrameSlot(name, SlotKind.Parameter, type, {
      zpDirective: zpDirective ?? ZpDirective.None,
    }));
    return this;
  }

  /**
   * Set the return type (creates return slot).
   */
  setReturnType(type: TypeInfo): this {
    // Don't add return slot for void
    if (type.kind !== TypeKind.Void) {
      this.slots.push(createFrameSlot('__return', SlotKind.Return, type));
    }
    return this;
  }

  /**
   * Add a local variable slot.
   */
  addLocal(name: string, type: TypeInfo, zpDirective?: ZpDirective): this {
    this.slots.push(createFrameSlot(name, SlotKind.Local, type, {
      zpDirective: zpDirective ?? ZpDirective.None,
    }));
    return this;
  }

  /**
   * Add a temporary slot.
   */
  addTemporary(name: string, type: TypeInfo): this {
    this.slots.push(createFrameSlot(name, SlotKind.Temporary, type));
    return this;
  }

  /**
   * Set thread context.
   */
  setThreadContext(context: ThreadContext): this {
    this.threadContext = context;
    return this;
  }

  /**
   * Build the frame.
   */
  build(): Frame {
    return createFrame(this.functionName, {
      slots: this.slots,
      threadContext: this.threadContext,
    });
  }
}
```

---

## 4. Usage Example

```typescript
import { createFrame, FrameBuilder } from './frame/types.js';
import { ThreadContext } from './frame/enums.js';
import { BUILTIN_TYPES } from './semantic/types.js';

// Method 1: Using factory function
const slots = [
  createFrameSlot('a', SlotKind.Parameter, BUILTIN_TYPES.BYTE),
  createFrameSlot('b', SlotKind.Parameter, BUILTIN_TYPES.BYTE),
  createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.BYTE),
];
const addFrame = createFrame('add', { slots });

// Method 2: Using builder
const multiplyFrame = new FrameBuilder('multiply')
  .addParameter('x', BUILTIN_TYPES.WORD)
  .addParameter('y', BUILTIN_TYPES.WORD)
  .setReturnType(BUILTIN_TYPES.WORD)
  .addLocal('temp', BUILTIN_TYPES.WORD)
  .build();

// Access frame data
console.log(addFrame.getParameters().length); // 2
console.log(addFrame.getSlot('a')?.size); // 1
console.log(multiplyFrame.getLocals().length); // 1
```

---

## Related Documents

| Document | Content |
|----------|---------|
| [01a-frame-enums.md](01a-frame-enums.md) | Enum definitions |
| [01b-frame-slot.md](01b-frame-slot.md) | FrameSlot interface |
| [01d-frame-map.md](01d-frame-map.md) | FrameMap interface |

---

**Previous:** [01b-frame-slot.md](01b-frame-slot.md)
**Next:** [01d-frame-map.md](01d-frame-map.md)