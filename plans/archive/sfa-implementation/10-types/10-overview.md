# Phase 1: Type Definitions

> **Document**: 10-types/10-overview.md
> **Parent**: [../00-index.md](../00-index.md)
> **Status**: Ready

## Overview

This phase defines all TypeScript types, enums, and interfaces needed for SFA implementation. Types are created first to enable test-driven development.

---

## 1. Files to Create

| File | Purpose | Lines |
|------|---------|-------|
| `frame/enums.ts` | SlotKind, SlotLocation, ZpDirective | ~50 |
| `frame/types.ts` | FrameSlot, Frame, FrameMap interfaces | ~100 |
| `frame/platform.ts` | PlatformConfig, C64/X16 configs | ~80 |
| `frame/config.ts` | FrameAllocatorConfig | ~40 |
| `frame/guards.ts` | Type guard functions | ~50 |
| `frame/index.ts` | Module exports | ~20 |

---

## 2. Enums (enums.ts)

```typescript
/**
 * Kind of slot in a frame
 */
export enum SlotKind {
  /** Function parameter */
  Parameter = 'parameter',
  /** Local variable */
  Local = 'local',
  /** Return value slot */
  Return = 'return',
}

/**
 * Memory location of a slot
 */
export enum SlotLocation {
  /** Zero Page ($02-$8F) */
  ZeroPage = 'zeropage',
  /** Frame Region ($0200-$03FF) */
  FrameRegion = 'frame',
  /** General RAM ($0800+) */
  GeneralRAM = 'ram',
}

/**
 * Storage directive from source code
 */
export enum ZpDirective {
  /** @zp - must be in Zero Page */
  Required = 'required',
  /** @ram - must NOT be in Zero Page */
  Forbidden = 'forbidden',
  /** No directive - compiler decides */
  None = 'none',
}

/**
 * Thread context for coalescing
 */
export enum ThreadContext {
  /** Main thread (main and what it calls) */
  Main = 'main',
  /** ISR thread (callback and what it calls) */
  ISR = 'isr',
  /** Called from both threads */
  Shared = 'shared',
}
```

---

## 3. Core Types (types.ts)

```typescript
import type { SourceLocation } from '../ast/index.js';
import { SlotKind, SlotLocation, ZpDirective, ThreadContext } from './enums.js';

/**
 * A slot in a function frame (parameter, local, or return)
 */
export interface FrameSlot {
  /** Slot name (variable name) */
  name: string;
  /** Kind: parameter, local, or return */
  kind: SlotKind;
  /** Memory location: ZP, frame, or RAM */
  location: SlotLocation;
  /** Absolute address (assigned by allocator) */
  address: number;
  /** Size in bytes */
  size: number;
  /** Offset within frame (for frame-region slots) */
  offset: number;
  /** Original storage directive from source */
  directive: ZpDirective;
  /** ZP priority score (for auto-allocation) */
  zpScore: number;
  /** Source location for error reporting */
  sourceLocation: SourceLocation;
}

/**
 * A function's frame (all its slots)
 */
export interface Frame {
  /** Function name */
  functionName: string;
  /** All slots in this frame */
  slots: FrameSlot[];
  /** Base address of frame in frame region */
  baseAddress: number;
  /** Total size of frame in bytes */
  totalSize: number;
  /** Coalesce group ID (functions in same group share memory) */
  coalesceGroup: number;
  /** Thread context (main, ISR, or shared) */
  threadContext: ThreadContext;
  /** Source location for error reporting */
  sourceLocation: SourceLocation;
}

/**
 * Map of function name to frame
 */
export interface FrameMap {
  /** Get frame by function name */
  get(functionName: string): Frame | undefined;
  /** Set frame for function */
  set(functionName: string, frame: Frame): void;
  /** Check if function has frame */
  has(functionName: string): boolean;
  /** Get all function names */
  keys(): IterableIterator<string>;
  /** Get all frames */
  values(): IterableIterator<Frame>;
  /** Number of frames */
  size: number;
}

/**
 * Result of frame allocation
 */
export interface FrameAllocationResult {
  /** Map of function name to frame */
  frameMap: FrameMap;
  /** Allocation statistics */
  stats: FrameAllocationStats;
  /** Diagnostics (errors, warnings) */
  diagnostics: FrameDiagnostic[];
  /** Did allocation succeed? */
  success: boolean;
}

/**
 * Statistics from frame allocation
 */
export interface FrameAllocationStats {
  /** Total functions allocated */
  totalFunctions: number;
  /** Number of coalesce groups */
  coalesceGroups: number;
  /** Bytes used in frame region */
  frameRegionBytesUsed: number;
  /** Bytes used in zero page */
  zpBytesUsed: number;
  /** Bytes saved by coalescing */
  coalescingBytesSaved: number;
  /** Percentage saved by coalescing */
  coalescingSavingsPercent: number;
}

/**
 * Diagnostic from frame allocation
 */
export interface FrameDiagnostic {
  /** Error code */
  code: string;
  /** Severity */
  severity: 'error' | 'warning' | 'info';
  /** Message */
  message: string;
  /** Source location */
  location?: SourceLocation;
}
```

---

## 4. Platform Config (platform.ts)

```typescript
/**
 * Platform memory configuration
 */
export interface PlatformConfig {
  /** Platform name */
  name: string;
  /** Zero page configuration */
  zeroPage: ZeroPageConfig;
  /** Frame region configuration */
  frameRegion: MemoryRegion;
  /** General RAM configuration */
  generalRam: MemoryRegion;
}

export interface ZeroPageConfig {
  /** Start address */
  start: number;
  /** End address (exclusive) */
  end: number;
  /** Reserved addresses (CPU, KERNAL, etc.) */
  reserved: number[];
  /** Compiler scratch area start */
  scratchStart: number;
  /** Compiler scratch area end */
  scratchEnd: number;
}

export interface MemoryRegion {
  /** Start address */
  start: number;
  /** End address (exclusive) */
  end: number;
}

/**
 * C64 platform configuration
 */
export const C64_PLATFORM: PlatformConfig = {
  name: 'c64',
  zeroPage: {
    start: 0x02,
    end: 0x90,
    reserved: [0x00, 0x01],
    scratchStart: 0xfb,
    scratchEnd: 0xff,
  },
  frameRegion: {
    start: 0x0200,
    end: 0x0400,
  },
  generalRam: {
    start: 0x0800,
    end: 0xd000,
  },
};

/**
 * Commander X16 platform configuration
 */
export const X16_PLATFORM: PlatformConfig = {
  name: 'x16',
  zeroPage: {
    start: 0x22,
    end: 0x80,
    reserved: [0x00, 0x21],
    scratchStart: 0x7c,
    scratchEnd: 0x80,
  },
  frameRegion: {
    start: 0x0400,
    end: 0x0800,
  },
  generalRam: {
    start: 0x0800,
    end: 0x9f00,
  },
};
```

---

## 5. Unit Tests

### 5.1 Enum Tests

```typescript
describe('SFA Enums', () => {
  describe('SlotKind', () => {
    it('should have Parameter, Local, Return values', () => {
      expect(SlotKind.Parameter).toBe('parameter');
      expect(SlotKind.Local).toBe('local');
      expect(SlotKind.Return).toBe('return');
    });
  });

  describe('SlotLocation', () => {
    it('should have ZeroPage, FrameRegion, GeneralRAM values', () => {
      expect(SlotLocation.ZeroPage).toBe('zeropage');
      expect(SlotLocation.FrameRegion).toBe('frame');
      expect(SlotLocation.GeneralRAM).toBe('ram');
    });
  });
});
```

### 5.2 Platform Config Tests

```typescript
describe('Platform Configs', () => {
  describe('C64_PLATFORM', () => {
    it('should have correct ZP range', () => {
      expect(C64_PLATFORM.zeroPage.start).toBe(0x02);
      expect(C64_PLATFORM.zeroPage.end).toBe(0x90);
    });

    it('should have correct frame region', () => {
      expect(C64_PLATFORM.frameRegion.start).toBe(0x0200);
      expect(C64_PLATFORM.frameRegion.end).toBe(0x0400);
    });

    it('should have 142 bytes of usable ZP', () => {
      const usable = C64_PLATFORM.zeroPage.end - C64_PLATFORM.zeroPage.start;
      expect(usable).toBe(142);
    });

    it('should have 512 bytes of frame region', () => {
      const size = C64_PLATFORM.frameRegion.end - C64_PLATFORM.frameRegion.start;
      expect(size).toBe(512);
    });
  });
});
```

---

## 6. Sessions

| Session | Tasks | Est. Time |
|---------|-------|-----------|
| **1.1** | Create enums.ts + tests | 15 min |
| **1.2** | Create types.ts + tests | 15 min |
| **1.3** | Create platform.ts + tests | 15 min |
| **1.4** | Create guards.ts + index.ts | 15 min |

**Total: ~1 hour**

---

## 7. Success Criteria

Phase 1 is complete when:

- [ ] All enums defined with tests
- [ ] All interfaces defined with tests
- [ ] Platform configs defined with tests
- [ ] Type guards working
- [ ] Module exports working
- [ ] All tests pass

---

**Next Phase**: [../20-allocator/20-overview.md](../20-allocator/20-overview.md)