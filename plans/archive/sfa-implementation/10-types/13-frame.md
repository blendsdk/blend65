# Frame Interface Specification

> **Document**: 10-types/13-frame.md
> **Parent**: [10-overview.md](10-overview.md)

## Overview

A Frame represents a function's complete memory allocation including all parameters, locals, and return value.

---

## Interface Definition

```typescript
import type { SourceLocation } from '../ast/index.js';
import { ThreadContext } from './enums.js';
import type { FrameSlot } from './frame-slot.js';

/**
 * A function's complete frame - all its allocated memory.
 */
export interface Frame {
  /** Function name (fully qualified) */
  functionName: string;

  /** All slots (parameters + locals + return) */
  slots: FrameSlot[];

  /** Base address in frame region */
  baseAddress: number;

  /** Total size in bytes */
  totalSize: number;

  /** Coalesce group ID (functions sharing memory have same ID) */
  coalesceGroup: number;

  /** Thread context (Main, ISR, Shared) */
  threadContext: ThreadContext;

  /** Source location */
  sourceLocation: SourceLocation;
}
```

---

## Factory and Helper Functions

```typescript
/**
 * Create empty frame for function
 */
export function createFrame(
  functionName: string,
  threadContext: ThreadContext,
  sourceLocation: SourceLocation
): Frame {
  return {
    functionName,
    slots: [],
    baseAddress: 0,
    totalSize: 0,
    coalesceGroup: -1,  // Unassigned
    threadContext,
    sourceLocation,
  };
}

/**
 * Add slot to frame and update size
 */
export function addSlotToFrame(frame: Frame, slot: FrameSlot): void {
  slot.offset = frame.totalSize;
  frame.slots.push(slot);
  frame.totalSize += slot.size;
}

/**
 * Get slot by name
 */
export function getSlotByName(frame: Frame, name: string): FrameSlot | undefined {
  return frame.slots.find(s => s.name === name);
}

/**
 * Get all parameter slots
 */
export function getParameters(frame: Frame): FrameSlot[] {
  return frame.slots.filter(s => s.kind === SlotKind.Parameter);
}

/**
 * Get all local slots
 */
export function getLocals(frame: Frame): FrameSlot[] {
  return frame.slots.filter(s => s.kind === SlotKind.Local);
}

/**
 * Assign addresses to all slots
 */
export function assignSlotAddresses(frame: Frame): void {
  for (const slot of frame.slots) {
    if (slot.location === SlotLocation.FrameRegion) {
      slot.address = frame.baseAddress + slot.offset;
    }
    // ZP slots have addresses assigned separately
  }
}
```

---

## Unit Tests

```typescript
describe('Frame', () => {
  it('should track total size correctly', () => {
    const frame = createFrame('test', ThreadContext.Main, mockLocation);
    addSlotToFrame(frame, createLocalSlot('a', 1, 'byte', ZpDirective.None, mockLocation));
    addSlotToFrame(frame, createLocalSlot('b', 2, 'word', ZpDirective.None, mockLocation));
    
    expect(frame.totalSize).toBe(3);
    expect(frame.slots[0].offset).toBe(0);
    expect(frame.slots[1].offset).toBe(1);
  });

  it('should assign addresses from base', () => {
    const frame = createFrame('test', ThreadContext.Main, mockLocation);
    addSlotToFrame(frame, createLocalSlot('a', 1, 'byte', ZpDirective.None, mockLocation));
    addSlotToFrame(frame, createLocalSlot('b', 2, 'word', ZpDirective.None, mockLocation));
    
    frame.baseAddress = 0x0200;
    assignSlotAddresses(frame);
    
    expect(frame.slots[0].address).toBe(0x0200);
    expect(frame.slots[1].address).toBe(0x0201);
  });
});
```

---

## Session
Implement in Session 1.2 per [../99-execution-plan.md](../99-execution-plan.md)