# Enums Specification

> **Document**: 10-types/11-enums.md
> **Parent**: [10-overview.md](10-overview.md)
> **Status**: Ready for Implementation

## Overview

This document specifies all enums needed for the SFA system.

---

## 1. SlotKind Enum

### Purpose
Identifies what kind of variable a frame slot represents.

### Definition

```typescript
/**
 * Kind of slot in a function's frame.
 * Each variable in a function maps to one of these slot types.
 */
export enum SlotKind {
  /**
   * Function parameter - passed by caller.
   * Allocated at fixed address, caller writes before JSR.
   */
  Parameter = 'parameter',

  /**
   * Local variable - declared within function body.
   * Includes loop variables, temporaries, etc.
   */
  Local = 'local',

  /**
   * Return value slot - for non-void functions.
   * Callee writes before RTS, caller reads after return.
   */
  Return = 'return',
}
```

### Usage Examples

```typescript
// Parameter slot
const paramSlot: FrameSlot = {
  name: 'x',
  kind: SlotKind.Parameter,
  // ...
};

// Local variable slot
const localSlot: FrameSlot = {
  name: 'counter',
  kind: SlotKind.Local,
  // ...
};

// Return value slot
const returnSlot: FrameSlot = {
  name: '$return',
  kind: SlotKind.Return,
  // ...
};
```

---

## 2. SlotLocation Enum

### Purpose
Identifies where a slot is physically allocated in memory.

### Definition

```typescript
/**
 * Physical memory location of a slot.
 * Determines which addressing modes can be used.
 */
export enum SlotLocation {
  /**
   * Zero Page ($02-$8F on C64).
   * Enables faster instructions and indirect addressing.
   * Limited: only 142 bytes available.
   */
  ZeroPage = 'zeropage',

  /**
   * Static Frame Region ($0200-$03FF on C64).
   * Function-local variables go here by default.
   * 512 bytes available, shared via coalescing.
   */
  FrameRegion = 'frame',

  /**
   * General RAM ($0800+ on C64).
   * Module globals and large arrays.
   * ~38KB available.
   */
  GeneralRAM = 'ram',
}
```

### Addressing Mode Implications

| Location | LDA/STA | Cycles | Indirect Y |
|----------|---------|--------|------------|
| ZeroPage | 3 cycles | Fastest | ✅ Yes |
| FrameRegion | 4 cycles | Normal | ❌ No |
| GeneralRAM | 4 cycles | Normal | ❌ No |

---

## 3. ZpDirective Enum

### Purpose
Represents the storage directive from source code (@zp, @ram, or none).

### Definition

```typescript
/**
 * Storage directive from source code.
 * Controls where variable can be allocated.
 */
export enum ZpDirective {
  /**
   * @zp directive - MUST be in Zero Page.
   * Error if ZP is full.
   */
  Required = 'required',

  /**
   * @ram directive - MUST NOT be in Zero Page.
   * Always goes to RAM/Frame region.
   */
  Forbidden = 'forbidden',

  /**
   * No directive - compiler decides.
   * Uses ZP scoring to determine placement.
   */
  None = 'none',
}
```

### Source Code Examples

```js
// Required → must be in ZP (error if impossible)
@zp let counter: byte = 0;

// Forbidden → never in ZP
@ram let buffer: byte[256];

// None → compiler decides based on scoring
let temp: byte = 0;
```

---

## 4. ThreadContext Enum

### Purpose
Identifies which thread context a function belongs to for coalescing decisions.

### Definition

```typescript
/**
 * Thread context for coalescing safety.
 * Functions in different contexts cannot coalesce.
 */
export enum ThreadContext {
  /**
   * Main thread - entry point and functions it calls.
   * Can coalesce with other Main context functions.
   */
  Main = 'main',

  /**
   * ISR thread - callbacks and functions they call.
   * Can coalesce with other ISR context functions.
   * NEVER coalesces with Main context.
   */
  ISR = 'isr',

  /**
   * Shared - called from both Main and ISR.
   * Cannot coalesce with anything (safety).
   * Generates warning.
   */
  Shared = 'shared',
}
```

### Context Rules

| Caller Context | Callee Context | Can Coalesce? |
|----------------|----------------|---------------|
| Main | Main | ✅ Yes |
| ISR | ISR | ✅ Yes |
| Main | ISR | ❌ No |
| Shared | Any | ❌ No |

---

## 5. Type Guards

### Purpose
Runtime checks for enum values.

### Definition

```typescript
/**
 * Check if value is a valid SlotKind
 */
export function isSlotKind(value: unknown): value is SlotKind {
  return (
    value === SlotKind.Parameter ||
    value === SlotKind.Local ||
    value === SlotKind.Return
  );
}

/**
 * Check if value is a valid SlotLocation
 */
export function isSlotLocation(value: unknown): value is SlotLocation {
  return (
    value === SlotLocation.ZeroPage ||
    value === SlotLocation.FrameRegion ||
    value === SlotLocation.GeneralRAM
  );
}

/**
 * Check if value is a valid ZpDirective
 */
export function isZpDirective(value: unknown): value is ZpDirective {
  return (
    value === ZpDirective.Required ||
    value === ZpDirective.Forbidden ||
    value === ZpDirective.None
  );
}

/**
 * Check if value is a valid ThreadContext
 */
export function isThreadContext(value: unknown): value is ThreadContext {
  return (
    value === ThreadContext.Main ||
    value === ThreadContext.ISR ||
    value === ThreadContext.Shared
  );
}
```

---

## 6. Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import {
  SlotKind,
  SlotLocation,
  ZpDirective,
  ThreadContext,
  isSlotKind,
  isSlotLocation,
  isZpDirective,
  isThreadContext,
} from '../../../frame/enums.js';

describe('SFA Enums', () => {
  describe('SlotKind', () => {
    it('should have correct values', () => {
      expect(SlotKind.Parameter).toBe('parameter');
      expect(SlotKind.Local).toBe('local');
      expect(SlotKind.Return).toBe('return');
    });

    it('should have exactly 3 values', () => {
      const values = Object.values(SlotKind);
      expect(values).toHaveLength(3);
    });
  });

  describe('SlotLocation', () => {
    it('should have correct values', () => {
      expect(SlotLocation.ZeroPage).toBe('zeropage');
      expect(SlotLocation.FrameRegion).toBe('frame');
      expect(SlotLocation.GeneralRAM).toBe('ram');
    });
  });

  describe('ZpDirective', () => {
    it('should have correct values', () => {
      expect(ZpDirective.Required).toBe('required');
      expect(ZpDirective.Forbidden).toBe('forbidden');
      expect(ZpDirective.None).toBe('none');
    });
  });

  describe('ThreadContext', () => {
    it('should have correct values', () => {
      expect(ThreadContext.Main).toBe('main');
      expect(ThreadContext.ISR).toBe('isr');
      expect(ThreadContext.Shared).toBe('shared');
    });
  });

  describe('Type Guards', () => {
    it('isSlotKind should validate correctly', () => {
      expect(isSlotKind(SlotKind.Parameter)).toBe(true);
      expect(isSlotKind('invalid')).toBe(false);
      expect(isSlotKind(null)).toBe(false);
    });

    it('isSlotLocation should validate correctly', () => {
      expect(isSlotLocation(SlotLocation.ZeroPage)).toBe(true);
      expect(isSlotLocation('invalid')).toBe(false);
    });

    it('isZpDirective should validate correctly', () => {
      expect(isZpDirective(ZpDirective.Required)).toBe(true);
      expect(isZpDirective('invalid')).toBe(false);
    });

    it('isThreadContext should validate correctly', () => {
      expect(isThreadContext(ThreadContext.Main)).toBe(true);
      expect(isThreadContext('invalid')).toBe(false);
    });
  });
});
```

---

## 7. Implementation Notes

### File Location
`packages/compiler-v2/src/frame/enums.ts`

### Dependencies
None - enums are standalone.

### Session
Implement in Session 1.1 per [../99-execution-plan.md](../99-execution-plan.md)