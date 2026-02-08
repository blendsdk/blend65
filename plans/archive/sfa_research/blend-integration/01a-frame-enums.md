# Blend Integration: Frame Enums

> **Document**: blend-integration/01a-frame-enums.md
> **Parent**: [01-frame-types.md](01-frame-types.md)
> **Target File**: `packages/compiler-v2/src/frame/enums.ts`
> **Status**: Design Complete

## Overview

This document defines all enum types used by the Frame Allocator system.

---

## 1. SlotLocation

Storage location for a frame slot.

```typescript
/**
 * Storage location for a frame slot.
 *
 * Determines where the variable's memory is allocated:
 * - ZeroPage: Fast access, limited space ($02-$8F on C64)
 * - FrameRegion: Normal frame memory ($0200-$03FF on C64)
 * - Register: Passed via CPU register (A, X, Y)
 */
export enum SlotLocation {
  /** Slot is in zero page ($00-$FF) */
  ZeroPage = 'zp',

  /** Slot is in frame region (RAM) */
  FrameRegion = 'frame',

  /** Slot is passed via register (A, Y, X) */
  Register = 'register',
}
```

**Usage Notes:**
- Most slots default to `FrameRegion`
- `ZeroPage` slots get faster 2-byte instructions
- `Register` is for optimized parameter passing

---

## 2. SlotKind

Kind of frame slot - what role it plays.

```typescript
/**
 * Kind of frame slot.
 *
 * Identifies the role of a slot within a function's frame:
 * - Parameter: Passed into the function
 * - Local: Declared within the function
 * - Return: Storage for return value
 * - Temporary: Compiler-generated for expression evaluation
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
```

**Usage Notes:**
- Parameters are allocated first in frame
- Return slot (if not void) follows parameters
- Locals are allocated after return slot
- Temporaries are for complex expressions

---

## 3. ZpDirective

Zero page directive from source code annotations.

**Key Design Principle:** All directives are **predictable** - no ambiguous "prefer" semantics.

```typescript
/**
 * Zero page directive from source code.
 *
 * Simplified mapping (no "required" modifier, no "prefer" ambiguity):
 * - `@zp` → ZpDirective.Zp (MUST be ZP, error if not)
 * - `@ram` → ZpDirective.Ram (MUST be RAM, never ZP)
 * - (no annotation) → ZpDirective.None (compiler decides, deterministic)
 *
 * Why no "prefer" option?
 * - Creates unpredictable behavior - developer won't know if variable is in ZP or RAM
 * - If you need ZP, use @zp and get a clear error if impossible
 * - If you don't care, let the compiler decide (it's deterministic)
 */
export enum ZpDirective {
  /** No directive specified - compiler decides based on scoring (deterministic) */
  None = 'none',

  /** @zp - MUST be in zero page, compile error if impossible */
  Zp = 'zp',

  /** @ram - MUST be in RAM, never allocate to ZP */
  Ram = 'ram',
}
```

**Source Code Examples:**
```js
// No directive - compiler decides (deterministic based on hotness scoring)
let counter: byte = 0;

// @zp - MUST be in ZP (error if ZP is full)
@zp let ptr: word = $1000;

// @ram - MUST be in RAM (never in ZP)
@ram let buffer: byte[256];
```

**Behavior Summary:**

| Directive | Behavior | If ZP Full? |
|-----------|----------|-------------|
| `@zp` | MUST be in ZP | **Compile error** |
| `@ram` | MUST be in RAM | N/A (never uses ZP) |
| (none) | Compiler decides | Silent fallback to RAM |

---

## 4. ThreadContext

Thread context for interrupt safety analysis.

```typescript
/**
 * Thread context for interrupt safety.
 *
 * Used to determine which functions can safely share memory (coalescing):
 * - MainOnly: Only called from main program flow
 * - IsrOnly: Only called from interrupt handlers (NMI/IRQ)
 * - Both: Called from both contexts (cannot coalesce)
 *
 * Functions with different contexts CANNOT share frame memory
 * because an ISR could interrupt main and overwrite shared data.
 */
export enum ThreadContext {
  /** Only called from main program flow */
  MainOnly = 'main',

  /** Only called from interrupt handlers */
  IsrOnly = 'isr',

  /** Called from both main and ISR (cannot coalesce) */
  Both = 'both',
}
```

**Usage Notes:**
- Default is `MainOnly` for most functions
- Functions called by interrupt handlers get `IsrOnly`
- Functions reachable from both get `Both` (safest, no coalescing)

---

## 5. DiagnosticSeverity

Severity level for allocator diagnostics.

```typescript
/**
 * Severity level for allocation diagnostics.
 */
export enum DiagnosticSeverity {
  /** Critical error - compilation stops */
  Error = 'error',

  /** Warning - compilation continues */
  Warning = 'warning',

  /** Informational - for verbose output */
  Info = 'info',
}
```

---

## 6. Export Summary

```typescript
// packages/compiler-v2/src/frame/enums.ts

export {
  SlotLocation,
  SlotKind,
  ZpDirective,
  ThreadContext,
  DiagnosticSeverity,
};
```

---

## Related Documents

| Document | Content |
|----------|---------|
| [01b-frame-slot.md](01b-frame-slot.md) | FrameSlot interface |
| [01c-frame-interface.md](01c-frame-interface.md) | Frame interface |
| [01d-frame-map.md](01d-frame-map.md) | FrameMap interface |

---

**Previous:** [00-overview.md](00-overview.md)
**Next:** [01b-frame-slot.md](01b-frame-slot.md)