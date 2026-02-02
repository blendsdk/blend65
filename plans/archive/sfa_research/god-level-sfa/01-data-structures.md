# God-Level SFA: Data Structures

> **Document**: god-level-sfa/01-data-structures.md
> **Purpose**: Core TypeScript interfaces and types for the SFA system
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

This document defines all TypeScript interfaces and types for the God-Level SFA system. These types form the contract between all SFA components.

---

## 1. Core Frame Types

### 1.1 FrameSlot

A slot represents a single variable (parameter, local, or return value) within a frame.

```typescript
/**
 * Storage location for a frame slot.
 */
export enum SlotLocation {
  /** Slot is in zero page */
  ZeroPage = 'zp',
  /** Slot is in frame region (RAM) */
  FrameRegion = 'frame',
  /** Slot is passed via register (A, Y, X) */
  Register = 'register',
}

/**
 * Kind of frame slot.
 */
export enum SlotKind {
  /** Function parameter */
  Parameter = 'parameter',
  /** Local variable */
  Local = 'local',
  /** Return value storage */
  Return = 'return',
  /** Compiler-generated temporary */
  Temporary = 'temporary',
}

/**
 * Zero page directive from source code.
 */
export enum ZpDirective {
  /** No directive specified - compiler decides */
  None = 'none',
  /** @zp required - must be in ZP or error */
  Required = 'required',
  /** @zp - prefer ZP, silent fallback to RAM */
  Preferred = 'preferred',
  /** @ram - never allocate to ZP */
  Forbidden = 'forbidden',
}

/**
 * A slot in a function's frame.
 * Each parameter, local variable, and return value gets a slot.
 */
export interface FrameSlot {
  /** Slot name (variable/parameter name) */
  readonly name: string;

  /** Kind of slot (parameter, local, return, temporary) */
  readonly kind: SlotKind;

  /** Type information */
  readonly type: TypeInfo;

  /** Size in bytes (1 for byte, 2 for word, etc.) */
  readonly size: number;

  /** Zero page directive from source code */
  readonly zpDirective: ZpDirective;

  /** Assigned storage location */
  location: SlotLocation;

  /** Absolute address (after allocation) */
  address: number;

  /** Offset from frame base (for frame region slots) */
  offset: number;

  /** Register name (for register slots: 'A', 'Y', 'X') */
  register?: string;

  /** Access count from analysis (for ZP scoring) */
  accessCount: number;

  /** Maximum loop nesting depth where accessed */
  maxLoopDepth: number;

  /** Computed ZP priority score */
  zpScore: number;

  /** Is this slot part of an array? */
  isArrayElement: boolean;

  /** Array size if this is an array base */
  arraySize?: number;
}
```

### 1.2 Frame

A frame represents all storage for a single function.

```typescript
/**
 * A function's static frame.
 * Contains all slots for parameters, locals, and return value.
 */
export interface Frame {
  /** Function name (fully qualified: module.function) */
  readonly functionName: string;

  /** All slots in this frame */
  readonly slots: FrameSlot[];

  /** Total size of frame region slots (excludes ZP slots) */
  totalFrameSize: number;

  /** Total size of ZP slots */
  totalZpSize: number;

  /** Base address in frame region (after allocation) */
  frameBaseAddress: number;

  /** Is this a recursive function (uses stack frames)? */
  isRecursive: boolean;

  /** Coalescing group ID (functions in same group share memory) */
  coalesceGroupId: number;

  /** Thread context (main, isr, or both) */
  threadContext: ThreadContext;

  /**
   * Get a slot by name.
   * @param name Variable/parameter name
   * @returns The slot or undefined if not found
   */
  getSlot(name: string): FrameSlot | undefined;

  /**
   * Get all parameter slots.
   */
  getParameters(): FrameSlot[];

  /**
   * Get all local slots.
   */
  getLocals(): FrameSlot[];

  /**
   * Get the return slot (if any).
   */
  getReturnSlot(): FrameSlot | undefined;

  /**
   * Get all ZP slots.
   */
  getZpSlots(): FrameSlot[];

  /**
   * Get all frame region slots.
   */
  getFrameSlots(): FrameSlot[];
}
```

### 1.3 FrameMap

The global map of all function frames.

```typescript
/**
 * Thread context for interrupt safety.
 */
export enum ThreadContext {
  /** Only called from main program flow */
  MainOnly = 'main',
  /** Only called from interrupt handlers */
  IsrOnly = 'isr',
  /** Called from both main and ISR (cannot coalesce) */
  Both = 'both',
}

/**
 * Global frame allocation map.
 * Result of the frame allocation process.
 */
export interface FrameMap {
  /** All function frames by function name */
  readonly frames: Map<string, Frame>;

  /** Coalescing groups (group ID → function names) */
  readonly coalesceGroups: Map<number, string[]>;

  /** Platform configuration used */
  readonly platform: PlatformConfig;

  /** Allocation statistics */
  readonly stats: AllocationStats;

  /**
   * Get frame for a function.
   * @param functionName Fully qualified function name
   */
  getFrame(functionName: string): Frame | undefined;

  /**
   * Get absolute address for a variable.
   * @param functionName Function containing the variable
   * @param variableName Variable/parameter name
   * @returns Absolute address or throws if not found
   */
  getAddress(functionName: string, variableName: string): number;

  /**
   * Get all functions in a coalesce group.
   * @param groupId Coalesce group ID
   */
  getCoalesceGroup(groupId: number): string[];
}

/**
 * Allocation statistics for reporting.
 */
export interface AllocationStats {
  /** Total functions processed */
  totalFunctions: number;

  /** Functions using static frames */
  staticFunctions: number;

  /** Functions using stack frames (recursive) */
  recursiveFunctions: number;

  /** Total bytes in frame region (without coalescing) */
  frameRegionUsedRaw: number;

  /** Total bytes in frame region (with coalescing) */
  frameRegionUsedCoalesced: number;

  /** Bytes saved by coalescing */
  bytesSavedByCoalescing: number;

  /** Coalescing efficiency percentage */
  coalescingEfficiency: number;

  /** Total ZP bytes used */
  zpBytesUsed: number;

  /** ZP bytes available */
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

## 2. Call Graph Types

### 2.1 CallGraphNode

Represents a function in the call graph.

```typescript
/**
 * A node in the call graph representing a function.
 */
export interface CallGraphNode {
  /** Function name (fully qualified) */
  readonly functionName: string;

  /** Functions this function calls (direct callees) */
  readonly callees: Set<string>;

  /** Functions that call this function (direct callers) */
  readonly callers: Set<string>;

  /** All functions that could be on the stack when this runs */
  readonly recursiveCallers: Set<string>;

  /** Is this function an interrupt handler entry point? */
  readonly isInterruptHandler: boolean;

  /** Thread context (main, isr, or both) */
  threadContext: ThreadContext;

  /** Call depth from entry points (main/interrupt) */
  callDepth: number;

  /** Is this function part of a recursive cycle? */
  isRecursive: boolean;

  /** If recursive, the cycle members */
  recursiveCycleMembers?: Set<string>;
}

/**
 * The complete call graph for a module.
 */
export interface CallGraph {
  /** All nodes by function name */
  readonly nodes: Map<string, CallGraphNode>;

  /** Entry point functions (main, interrupt handlers) */
  readonly entryPoints: Set<string>;

  /** Detected recursive functions */
  readonly recursiveFunctions: Set<string>;

  /** Recursive cycles (each set is a cycle) */
  readonly recursiveCycles: Set<string>[];

  /**
   * Get a node by function name.
   */
  getNode(functionName: string): CallGraphNode | undefined;

  /**
   * Check if two functions can have overlapping execution.
   * If they can overlap, their frames CANNOT be coalesced.
   */
  canOverlap(func1: string, func2: string): boolean;

  /**
   * Check if a function is reachable from an interrupt handler.
   */
  isReachableFromIsr(functionName: string): boolean;

  /**
   * Get all functions in the same thread context.
   */
  getFunctionsByContext(context: ThreadContext): string[];
}
```

### 2.2 RecursionError

Error information when recursion is detected.

```typescript
/**
 * Information about a detected recursion error.
 */
export interface RecursionError {
  /** Type of recursion */
  readonly type: 'direct' | 'mutual';

  /** The function that recurses (or first in cycle) */
  readonly functionName: string;

  /** Full call chain showing the recursion */
  readonly callChain: string[];

  /** Human-readable error message */
  readonly message: string;

  /** Source location of the recursive call */
  readonly location?: SourceLocation;
}
```

---

## 3. Zero Page Types

### 3.1 ZpAllocationRequest

A request to allocate a slot to zero page.

```typescript
/**
 * A request to allocate a variable to zero page.
 */
export interface ZpAllocationRequest {
  /** The frame slot requesting ZP */
  readonly slot: FrameSlot;

  /** Function containing this slot */
  readonly functionName: string;

  /** Directive level (required > preferred > auto) */
  readonly directive: ZpDirective;

  /** Computed priority score */
  readonly score: number;

  /** Reason for the score (for debugging) */
  readonly scoreBreakdown: ZpScoreBreakdown;
}

/**
 * Breakdown of ZP score calculation.
 */
export interface ZpScoreBreakdown {
  /** Base score from type weight */
  typeWeight: number;

  /** Bonus from access count */
  accessBonus: number;

  /** Bonus from loop depth */
  loopBonus: number;

  /** Bonus from directive (@zp) */
  directiveBonus: number;

  /** Final computed score */
  totalScore: number;
}
```

### 3.2 ZpRegion

A region of zero page memory.

```typescript
/**
 * A contiguous region of zero page memory.
 */
export interface ZpRegion {
  /** Start address (inclusive) */
  readonly start: number;

  /** End address (exclusive) */
  readonly end: number;

  /** Size in bytes */
  readonly size: number;

  /** Purpose/label for this region */
  readonly label: string;
}

/**
 * Zero page allocation result.
 */
export interface ZpAllocationResult {
  /** Successful allocations (slot → address) */
  readonly allocations: Map<FrameSlot, number>;

  /** Failed @zp required requests */
  readonly failedRequired: ZpAllocationRequest[];

  /** Slots that fell back to RAM */
  readonly fellBackToRam: ZpAllocationRequest[];

  /** Remaining ZP bytes after allocation */
  readonly remainingZpBytes: number;

  /** Warnings generated */
  readonly warnings: string[];
}
```

---

## 4. Coalescing Types

### 4.1 CoalesceGroup

A group of functions that can share memory.

```typescript
/**
 * A group of functions that can share the same frame memory.
 * Functions in the same group never have overlapping execution.
 */
export interface CoalesceGroup {
  /** Unique group ID */
  readonly groupId: number;

  /** Functions in this group */
  readonly members: Set<string>;

  /** Maximum frame size among all members */
  readonly maxFrameSize: number;

  /** Assigned base address for the group */
  baseAddress: number;

  /** Thread context (all members must have same context) */
  readonly threadContext: ThreadContext;
}

/**
 * Result of the coalescing analysis.
 */
export interface CoalesceAnalysisResult {
  /** All coalesce groups */
  readonly groups: CoalesceGroup[];

  /** Mapping from function name to group ID */
  readonly functionToGroup: Map<string, number>;

  /** Memory saved by coalescing */
  readonly bytesSaved: number;

  /** Efficiency percentage (saved / total) */
  readonly efficiency: number;
}
```

---

## 5. Platform Configuration

### 5.1 PlatformConfig

Platform-specific memory configuration.

```typescript
/**
 * Platform-specific memory configuration.
 */
export interface PlatformConfig {
  /** Platform identifier */
  readonly platform: 'c64' | 'x16' | 'nes' | 'custom';

  /** Platform display name */
  readonly displayName: string;

  // === Frame Region ===

  /** Start address of frame region (inclusive) */
  readonly frameRegionStart: number;

  /** End address of frame region (exclusive) */
  readonly frameRegionEnd: number;

  /** Frame region size in bytes */
  readonly frameRegionSize: number;

  // === Zero Page ===

  /** Start of available ZP (inclusive) */
  readonly zpStart: number;

  /** End of available ZP (exclusive) */
  readonly zpEnd: number;

  /** Available ZP size in bytes */
  readonly zpAvailable: number;

  /** Reserved ZP addresses (system use) */
  readonly zpReserved: number[];

  /** Compiler scratch ZP locations */
  readonly zpScratch: ZpRegion;

  // === Hardware Stack ===

  /** Hardware stack start ($0100) */
  readonly hwStackStart: number;

  /** Hardware stack end ($01FF) */
  readonly hwStackEnd: number;

  /** Maximum recommended call depth */
  readonly maxRecommendedCallDepth: number;

  // === Type Sizes ===

  /** Size of pointer type */
  readonly pointerSize: number;

  /** Alignment requirement (1 = none, 2 = word-aligned) */
  readonly alignment: number;
}

/**
 * Default C64 platform configuration.
 */
export const C64_PLATFORM_CONFIG: PlatformConfig = {
  platform: 'c64',
  displayName: 'Commodore 64',

  // Frame region: $0200-$03FF (512 bytes)
  frameRegionStart: 0x0200,
  frameRegionEnd: 0x0400,
  frameRegionSize: 512,

  // Zero page: $02-$8F (142 bytes usable)
  zpStart: 0x02,
  zpEnd: 0x90,
  zpAvailable: 142,
  zpReserved: [0x00, 0x01], // CPU indirect

  // Compiler scratch: $FB-$FE (4 bytes)
  zpScratch: {
    start: 0xfb,
    end: 0xff,
    size: 4,
    label: 'compiler_scratch',
  },

  // Hardware stack
  hwStackStart: 0x0100,
  hwStackEnd: 0x0200,
  maxRecommendedCallDepth: 40, // ~6 bytes per JSR/RTS

  // Types
  pointerSize: 2,
  alignment: 1,
};

/**
 * Commander X16 platform configuration.
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

## 6. Allocator Configuration

### 6.1 FrameAllocatorConfig

Configuration options for the frame allocator.

```typescript
/**
 * ZP scoring weights configuration.
 */
export interface ZpScoringWeights {
  /** Weight for pointer types (default: 0x800) */
  pointerWeight: number;

  /** Weight for byte types (default: 0x100) */
  byteWeight: number;

  /** Weight for word types (default: 0x080) */
  wordWeight: number;

  /** Multiplier per loop depth level (default: 2) */
  loopDepthMultiplier: number;

  /** Bonus for @zp directive (default: 10000) */
  zpPreferredBonus: number;
}

/**
 * Default ZP scoring weights.
 */
export const DEFAULT_ZP_WEIGHTS: ZpScoringWeights = {
  pointerWeight: 0x800,
  byteWeight: 0x100,
  wordWeight: 0x080,
  loopDepthMultiplier: 2,
  zpPreferredBonus: 10000,
};

/**
 * Configuration options for the frame allocator.
 */
export interface FrameAllocatorConfig {
  /** Platform configuration */
  platform: PlatformConfig;

  /** Enable frame coalescing (default: true) */
  enableCoalescing: boolean;

  /** Enable automatic ZP allocation (default: true) */
  enableAutoZp: boolean;

  /** ZP scoring weights */
  zpWeights: ZpScoringWeights;

  /** Treat all functions as potentially recursive (disables coalescing) */
  assumeRecursive: boolean;

  /** Maximum allowed frame size per function */
  maxFrameSize: number;

  /** Warning threshold for call depth */
  callDepthWarningThreshold: number;

  /** Emit allocation statistics */
  emitStats: boolean;

  /** Verbose logging during allocation */
  verbose: boolean;
}

/**
 * Default frame allocator configuration.
 */
export const DEFAULT_ALLOCATOR_CONFIG: FrameAllocatorConfig = {
  platform: C64_PLATFORM_CONFIG,
  enableCoalescing: true,
  enableAutoZp: true,
  zpWeights: DEFAULT_ZP_WEIGHTS,
  assumeRecursive: false,
  maxFrameSize: 256,
  callDepthWarningThreshold: 20,
  emitStats: true,
  verbose: false,
};
```

---

## 7. Diagnostic Types

### 7.1 AllocationDiagnostic

Diagnostics and warnings from allocation.

```typescript
/**
 * Severity level for diagnostics.
 */
export enum DiagnosticSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

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
  // Errors
  RECURSION_DETECTED: 'SFA001',
  ZP_REQUIRED_FAILED: 'SFA002',
  FRAME_OVERFLOW: 'SFA003',
  FRAME_TOO_LARGE: 'SFA004',

  // Warnings
  ZP_PREFERRED_FALLBACK: 'SFA101',
  DEEP_CALL_STACK: 'SFA102',
  ISR_SHARED_FUNCTION: 'SFA103',
  LARGE_FRAME: 'SFA104',

  // Info
  COALESCING_SAVED: 'SFA201',
  ZP_AUTO_ALLOCATED: 'SFA202',
  FRAME_ALLOCATED: 'SFA203',
} as const;
```

---

## 8. Type Guards

Helper functions for type narrowing.

```typescript
/**
 * Type guard: Is this slot a parameter?
 */
export function isParameterSlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Parameter;
}

/**
 * Type guard: Is this slot a local variable?
 */
export function isLocalSlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Local;
}

/**
 * Type guard: Is this slot the return value?
 */
export function isReturnSlot(slot: FrameSlot): boolean {
  return slot.kind === SlotKind.Return;
}

/**
 * Type guard: Is this slot in zero page?
 */
export function isZpSlot(slot: FrameSlot): boolean {
  return slot.location === SlotLocation.ZeroPage;
}

/**
 * Type guard: Is this slot in the frame region?
 */
export function isFrameSlot(slot: FrameSlot): boolean {
  return slot.location === SlotLocation.FrameRegion;
}

/**
 * Type guard: Is this slot a register?
 */
export function isRegisterSlot(slot: FrameSlot): boolean {
  return slot.location === SlotLocation.Register;
}

/**
 * Type guard: Does this slot require ZP?
 */
export function requiresZp(slot: FrameSlot): boolean {
  return slot.zpDirective === ZpDirective.Required;
}

/**
 * Type guard: Does this slot prefer ZP?
 */
export function prefersZp(slot: FrameSlot): boolean {
  return slot.zpDirective === ZpDirective.Preferred;
}

/**
 * Type guard: Is this slot forbidden from ZP?
 */
export function forbiddenFromZp(slot: FrameSlot): boolean {
  return slot.zpDirective === ZpDirective.Forbidden;
}
```

---

## 9. Factory Functions

Helper functions for creating instances.

```typescript
/**
 * Create a new frame slot with defaults.
 */
export function createFrameSlot(
  name: string,
  kind: SlotKind,
  type: TypeInfo,
  options?: Partial<FrameSlot>
): FrameSlot {
  return {
    name,
    kind,
    type,
    size: getTypeSize(type),
    zpDirective: ZpDirective.None,
    location: SlotLocation.FrameRegion,
    address: 0,
    offset: 0,
    accessCount: 0,
    maxLoopDepth: 0,
    zpScore: 0,
    isArrayElement: false,
    ...options,
  };
}

/**
 * Create a new frame with defaults.
 */
export function createFrame(
  functionName: string,
  options?: Partial<Frame>
): Frame {
  const slots: FrameSlot[] = [];

  return {
    functionName,
    slots,
    totalFrameSize: 0,
    totalZpSize: 0,
    frameBaseAddress: 0,
    isRecursive: false,
    coalesceGroupId: -1,
    threadContext: ThreadContext.MainOnly,

    getSlot(name: string) {
      return slots.find((s) => s.name === name);
    },

    getParameters() {
      return slots.filter((s) => s.kind === SlotKind.Parameter);
    },

    getLocals() {
      return slots.filter((s) => s.kind === SlotKind.Local);
    },

    getReturnSlot() {
      return slots.find((s) => s.kind === SlotKind.Return);
    },

    getZpSlots() {
      return slots.filter((s) => s.location === SlotLocation.ZeroPage);
    },

    getFrameSlots() {
      return slots.filter((s) => s.location === SlotLocation.FrameRegion);
    },

    ...options,
  };
}

/**
 * Get size of a type in bytes.
 */
export function getTypeSize(type: TypeInfo): number {
  switch (type.name) {
    case 'byte':
    case 'bool':
      return 1;
    case 'word':
      return 2;
    default:
      if (type.isArray && type.arraySize && type.elementType) {
        return type.arraySize * getTypeSize(type.elementType);
      }
      return 1; // Default to byte
  }
}
```

---

## 10. Summary

### Type Categories

| Category | Types |
|----------|-------|
| **Core Frame** | `FrameSlot`, `Frame`, `FrameMap` |
| **Call Graph** | `CallGraphNode`, `CallGraph`, `RecursionError` |
| **Zero Page** | `ZpAllocationRequest`, `ZpRegion`, `ZpAllocationResult` |
| **Coalescing** | `CoalesceGroup`, `CoalesceAnalysisResult` |
| **Platform** | `PlatformConfig`, `C64_PLATFORM_CONFIG`, `X16_PLATFORM_CONFIG` |
| **Configuration** | `FrameAllocatorConfig`, `ZpScoringWeights` |
| **Diagnostics** | `AllocationDiagnostic`, `DiagnosticSeverity` |
| **Enums** | `SlotLocation`, `SlotKind`, `ZpDirective`, `ThreadContext` |

### File Organization

```
packages/compiler-v2/src/frame/
├── types.ts          // All interfaces and types (this document)
├── enums.ts          // All enums
├── platform.ts       // Platform configs
├── guards.ts         // Type guards
├── factory.ts        // Factory functions
└── index.ts          // Re-exports
```

---

**Previous Document:** [00-overview.md](00-overview.md)
**Next Document:** [02-allocation-algorithm.md](02-allocation-algorithm.md)