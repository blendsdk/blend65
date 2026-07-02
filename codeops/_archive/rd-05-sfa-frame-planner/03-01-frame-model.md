# Frame Model & Computation: RD-05 SFA Frame Planner

> **Document**: 03-01-frame-model.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-05 R1–R6, §4.2; spec Ch 11 §3.1/§3.3, Ch 06 §5.2/§5.3

## Overview

Defines the planner's **input record** (`FunctionInfo`, D3/D5), the **frame records**
(`FunctionFrame`/`FrameSlot`), and the **frame-computation pass** that turns a `FunctionInfo`
into a `FunctionFrame` by applying the Ch 11 §3.3 type-size table. These live in
`@blend65/core/sfa/` (records) and `@blend65/frontend/sfa/` (the pass).

## Architecture

### New Types/Interfaces (core `sfa/`)

```typescript
// packages/core/src/sfa/function-info.ts

import type { Type } from "../semantics/type.js";

/** One parameter or local in a function's frame input (RD-05 §4.2). */
export interface FrameVar {
  readonly name: string;
  readonly type: Type;
  /** true for struct/array params passed by reference (2-byte pointer slot). */
  readonly byRef: boolean;
}

/**
 * The SFA-owned, flat view of one function — the planner's input unit (D3/D5).
 * Decoupled from the semantic `Symbol`; built by fixtures now, by
 * `modelToFunctionInfo` (DEFERRED) when the RD-04b checker populates the model.
 */
export interface FunctionInfo {
  /** Fully-qualified `module.function`. */
  readonly name: string;
  readonly parameters: readonly FrameVar[];   // declaration order
  readonly locals: readonly FrameVar[];        // declaration order
  readonly isInterrupt: boolean;               // R14 always-live
  readonly isEscaped: boolean;                 // R15 address-taken (&fn)
  readonly isReachable: boolean;               // R17 called/exported/address-taken
  /** Outgoing call edges, by callee fully-qualified name (call graph projection). */
  readonly callees: readonly string[];
}
```

```typescript
// packages/core/src/sfa/frame.ts

import type { Type } from "../semantics/type.js";

export interface FrameSlot {
  readonly name: string;
  readonly kind: "parameter" | "local";
  readonly type: Type;
  readonly size: number;     // bytes (R2 table)
  readonly offset: number;   // bytes from frame base (params first, then locals)
}

export interface FunctionFrame {
  readonly functionName: string;
  readonly slots: readonly FrameSlot[];  // parameters first, then locals, decl order (R6)
  readonly totalSize: number;            // Σ slot sizes, no padding (R3)
  readonly isInterrupt: boolean;
  readonly isEscaped: boolean;
  readonly isReachable: boolean;
}
```

### New Functions (frontend `sfa/frame-computation.ts`)

```typescript
import type { FunctionInfo, FrameVar } from "@blend65/core";
import { type FunctionFrame, type FrameSlot, byteSize } from "@blend65/core";

/** Slot size per Ch 11 §3.3 (R2). Parameters of struct/array type are 2-byte pointers. */
export function slotSize(v: FrameVar, kind: "parameter" | "local"): number;

/** Compute the frame for one function: ordered slots + total size (R1/R3/R6). */
export function computeFrame(fn: FunctionInfo): FunctionFrame;

/** Compute frames for all functions (skips nothing here; reachability handled in coloring). */
export function computeFrames(fns: readonly FunctionInfo[]): Map<string, FunctionFrame>;
```

## Implementation Details

### Size computation per type (Ch 11 §3.3, R2)

| Type                        | As Parameter        | As Local                 |
| --------------------------- | ------------------- | ------------------------ |
| `byte` / `sbyte` / `boolean`| 1                   | 1                        |
| `word` / `sword`            | 2                   | 2                        |
| enum                        | 1                   | 1                        |
| struct `T`                  | **2** (pointer)     | `sizeof(T)` = `byteSize` |
| array `T[N]`                | **2** (pointer)     | `byteSize(elem) × N`     |

`slotSize` logic:
- If `kind === "parameter"` **and** `v.type.kind` is `"struct"` or `"array"` → `2` (by-ref ptr).
- Otherwise → `byteSize(v.type)` (the existing RD-04 util: word/sword→2, struct→`byteSize`,
  array→recursive `elem×N`, byte/sbyte/boolean/enum→1).
- `error`/`void` → `byteSize` returns 0; such slots contribute nothing (error tolerance, R60).

> Note: enum types resolve to `byteSize` 1 only once the checker fills `EnumType`; under the
> passthrough no enum frames are exercised. Fixtures provide concrete primitive/struct/array
> types, which is sufficient for full algorithm coverage.

### `computeFrame` algorithm (R1/R3/R6)

```
offset = 0
slots = []
for v in fn.parameters:           // parameters first (R6)
  size = slotSize(v, "parameter")
  slots.push({ name: v.name, kind: "parameter", type: v.type, size, offset })
  offset += size
for v in fn.locals:               // then locals (R6)
  size = slotSize(v, "local")
  slots.push({ name: v.name, kind: "local", type: v.type, size, offset })
  offset += size
return { functionName: fn.name, slots, totalSize: offset,
         isInterrupt: fn.isInterrupt, isEscaped: fn.isEscaped, isReachable: fn.isReachable }
```

- **R4:** a function with no params/locals → `slots: []`, `totalSize: 0`. Still produced (it
  exists in the graph; coloring may still need it as an always-live node if interrupt/escaped).
- **R5:** `main()` is computed identically — no special case.
- **No alignment/padding (R3):** offsets are a running byte sum.

## Code Examples

### Example 1: a function with mixed slots

```typescript
const fn: FunctionInfo = {
  name: "Game.update",
  parameters: [{ name: "dx", type: primitive("sword"), byRef: false }],   // 2 bytes
  locals: [{ name: "i", type: primitive("byte"), byRef: false }],          // 1 byte
  isInterrupt: false, isEscaped: false, isReachable: true, callees: [],
};
computeFrame(fn);
// → slots: [ {dx, parameter, sword, size 2, offset 0}, {i, local, byte, size 1, offset 2} ]
//   totalSize: 3
```

### Example 2: struct param is a 2-byte pointer, struct local is full size

```typescript
// struct Point { x: byte; y: byte } → byteSize 2
computeFrame({ name: "M.f",
  parameters: [{ name: "p", type: pointStruct, byRef: true }],   // 2 (pointer)
  locals: [{ name: "q", type: pointStruct, byRef: false }],       // 2 (sizeof)
  isInterrupt: false, isEscaped: false, isReachable: true, callees: [] });
// → totalSize 4
```

## Error Handling

| Error Case                            | Handling Strategy                                       | AR Ref |
| ------------------------------------- | ------------------------------------------------------- | ------ |
| Slot type is `error`/`void`           | `byteSize` returns 0; slot contributes 0 (never throws) | R60    |
| Duplicate slot names within a frame   | Not validated here (checker concern); offsets still assigned deterministically | RD-04 |
| `FunctionInfo` with empty lists       | `totalSize 0`, valid empty frame (R4)                   | R4     |

> **Traceability:** every record/field above maps to RD-05 §4.2 and Ch 11 §3.1/§3.3.

## Testing Requirements

- Unit: `slotSize` for each row of the §3.3 table (param vs local; struct/array pointer vs full).
- Unit: `computeFrame` slot ordering (params before locals), offsets, `totalSize`.
- Edge: empty frame → size 0; struct/array param = 2; error/void slot = 0.
- See `07-testing-strategy.md` ST-F1..ST-F8.
