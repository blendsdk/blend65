# FrameSlot Interface Specification

> **Document**: 10-types/12-frame-slot.md
> **Parent**: [10-overview.md](10-overview.md)
> **Status**: Ready for Implementation

## Overview

A FrameSlot represents a single variable (parameter, local, or return value) within a function's frame.

---

## 1. Interface Definition

```typescript
import type { SourceLocation } from '../ast/index.js';
import { SlotKind, SlotLocation, ZpDirective } from './enums.js';

/**
 * A slot in a function's frame.
 * Each parameter, local variable, and return value gets a slot.
 */
export interface FrameSlot {
  /** Variable name (e.g., 'counter', 'x', '$return') */
  name: string;

  /** Kind: parameter, local, or return */
  kind: SlotKind;

  /** Memory location: ZeroPage, FrameRegion, or GeneralRAM */
  location: SlotLocation;

  /** Absolute address assigned by allocator (e.g., 0x0200) */
  address: number;

  /** Size in bytes (1 for byte, 2 for word/pointer, N for byte[N]) */
  size: number;

  /** Offset within frame base address (for frame-region slots) */
  offset: number;

  /** Storage directive from source (@zp, @ram, or none) */
  directive: ZpDirective;

  /** ZP priority score (higher = more likely to get ZP) */
  zpScore: number;

  /** Type name for debugging ('byte', 'word', 'byte[16]', etc.) */
  typeName: string;

  /** Source location for error reporting */
  sourceLocation: SourceLocation;
}
```

---

## 2. Property Details

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Variable name from source code |
| `kind` | SlotKind | Parameter, Local, or Return |
| `location` | SlotLocation | ZeroPage, FrameRegion, or GeneralRAM |
| `address` | number | Absolute memory address (assigned by allocator) |
| `size` | number | Size in bytes |
| `offset` | number | Offset from frame base (for non-ZP slots) |
| `directive` | ZpDirective | @zp, @ram, or none |
| `zpScore` | number | Priority for ZP allocation |
| `typeName` | string | Type name for debugging |
| `sourceLocation` | SourceLocation | For error messages |

---

## 3. Factory Functions

```typescript
/**
 * Create a parameter slot
 */
export function createParameterSlot(
  name: string,
  size: number,
  typeName: string,
  directive: ZpDirective,
  sourceLocation: SourceLocation
): FrameSlot {
  return {
    name,
    kind: SlotKind.Parameter,
    location: SlotLocation.FrameRegion, // Default, may change
    address: 0,  // Assigned later
    size,
    offset: 0,   // Assigned later
    directive,
    zpScore: 0,  // Calculated later
    typeName,
    sourceLocation,
  };
}

/**
 * Create a local variable slot
 */
export function createLocalSlot(
  name: string,
  size: number,
  typeName: string,
  directive: ZpDirective,
  sourceLocation: SourceLocation
): FrameSlot {
  return {
    name,
    kind: SlotKind.Local,
    location: SlotLocation.FrameRegion,
    address: 0,
    size,
    offset: 0,
    directive,
    zpScore: 0,
    typeName,
    sourceLocation,
  };
}

/**
 * Create a return value slot
 */
export function createReturnSlot(
  size: number,
  typeName: string,
  sourceLocation: SourceLocation
): FrameSlot {
  return {
    name: '$return',
    kind: SlotKind.Return,
    location: SlotLocation.FrameRegion,
    address: 0,
    size,
    offset: 0,
    directive: ZpDirective.None,
    zpScore: 0,
    typeName,
    sourceLocation,
  };
}
```

---

## 4. Helper Functions

```typescript
/**
 * Check if slot is in Zero Page
 */
export function isZeroPageSlot(slot: FrameSlot): boolean {
  return slot.location === SlotLocation.ZeroPage;
}

/**
 * Check if slot requires Zero Page (@zp directive)
 */
export function requiresZeroPage(slot: FrameSlot): boolean {
  return slot.directive === ZpDirective.Required;
}

/**
 * Check if slot is forbidden from Zero Page (@ram directive)
 */
export function forbiddenFromZeroPage(slot: FrameSlot): boolean {
  return slot.directive === ZpDirective.Forbidden;
}

/**
 * Get slot's effective address as hex string
 */
export function getAddressHex(slot: FrameSlot): string {
  if (slot.location === SlotLocation.ZeroPage) {
    return `$${slot.address.toString(16).padStart(2, '0').toUpperCase()}`;
  }
  return `$${slot.address.toString(16).padStart(4, '0').toUpperCase()}`;
}
```

---

## 5. Unit Tests

```typescript
describe('FrameSlot', () => {
  describe('createParameterSlot', () => {
    it('should create parameter slot with correct properties', () => {
      const slot = createParameterSlot(
        'x',
        1,
        'byte',
        ZpDirective.None,
        mockLocation
      );

      expect(slot.name).toBe('x');
      expect(slot.kind).toBe(SlotKind.Parameter);
      expect(slot.size).toBe(1);
      expect(slot.directive).toBe(ZpDirective.None);
    });
  });

  describe('createLocalSlot', () => {
    it('should create local slot', () => {
      const slot = createLocalSlot(
        'counter',
        1,
        'byte',
        ZpDirective.Required,
        mockLocation
      );

      expect(slot.kind).toBe(SlotKind.Local);
      expect(slot.directive).toBe(ZpDirective.Required);
    });
  });

  describe('isZeroPageSlot', () => {
    it('should return true for ZP slots', () => {
      const slot = createLocalSlot('x', 1, 'byte', ZpDirective.None, mockLocation);
      slot.location = SlotLocation.ZeroPage;
      
      expect(isZeroPageSlot(slot)).toBe(true);
    });
  });

  describe('getAddressHex', () => {
    it('should format ZP address as 2 digits', () => {
      const slot = createLocalSlot('x', 1, 'byte', ZpDirective.None, mockLocation);
      slot.location = SlotLocation.ZeroPage;
      slot.address = 0x02;
      
      expect(getAddressHex(slot)).toBe('$02');
    });

    it('should format RAM address as 4 digits', () => {
      const slot = createLocalSlot('x', 1, 'byte', ZpDirective.None, mockLocation);
      slot.address = 0x0200;
      
      expect(getAddressHex(slot)).toBe('$0200');
    });
  });
});
```

---

## 6. Implementation Notes

### File Location
`packages/compiler-v2/src/frame/types.ts`

### Session
Implement in Session 1.2 per [../99-execution-plan.md](../99-execution-plan.md)