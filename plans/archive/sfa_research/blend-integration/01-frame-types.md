# Blend Integration: Frame Types Index

> **Document**: blend-integration/01-frame-types.md
> **Parent**: [00-overview.md](00-overview.md)
> **Status**: Design Complete
> **Target Directory**: `packages/compiler-v2/src/frame/`

## Overview

This document serves as the index for all frame type definitions. The types are split into multiple documents for maintainability and to prevent AI context limitations.

---

## Document Index

| # | Document | Target File | Description |
|---|----------|-------------|-------------|
| 01a | [Frame Enums](01a-frame-enums.md) | `enums.ts` | SlotLocation, SlotKind, ZpDirective, ThreadContext |
| 01b | [FrameSlot](01b-frame-slot.md) | `types.ts` | FrameSlot interface and factory |
| 01c | [Frame](01c-frame-interface.md) | `types.ts` | Frame interface and builder |
| 01d | [FrameMap](01d-frame-map.md) | `types.ts` | FrameMap, AllocationStats |
| 01e | [CallGraph](01e-call-graph-types.md) | `call-graph.ts` | CallGraphNode, CallGraph, RecursionError |
| 01f | [Platform](01f-platform-config.md) | `platform.ts` | PlatformConfig, C64/X16 configs |
| 01g | [Config](01g-allocator-config.md) | `config.ts` | FrameAllocatorConfig, ZP weights |

---

## Implementation File Structure

```
packages/compiler-v2/src/frame/
├── index.ts          # Re-exports all public types
├── enums.ts          # All enums (01a)
├── types.ts          # FrameSlot, Frame, FrameMap (01b, 01c, 01d)
├── call-graph.ts     # CallGraph types (01e)
├── platform.ts       # Platform configs (01f)
├── config.ts         # Allocator config (01g)
└── guards.ts         # Type guards (from 01b)
```

---

## Type Summary

### Core Frame Types (01a-01d)

| Type | Purpose | File |
|------|---------|------|
| `SlotLocation` | Where a slot is allocated (ZP, frame, register) | `enums.ts` |
| `SlotKind` | What kind of slot (param, local, return, temp) | `enums.ts` |
| `ZpDirective` | ZP annotation (@zp, @zp required, @ram) | `enums.ts` |
| `ThreadContext` | Execution context (main, ISR, both) | `enums.ts` |
| `FrameSlot` | A single variable in a frame | `types.ts` |
| `Frame` | All slots for a function | `types.ts` |
| `FrameMap` | All frames for a program | `types.ts` |
| `AllocationStats` | Memory usage statistics | `types.ts` |

### Call Graph Types (01e)

| Type | Purpose | File |
|------|---------|------|
| `CallGraphNode` | A function in the call graph | `call-graph.ts` |
| `CallGraph` | Complete call graph for a program | `call-graph.ts` |
| `RecursionError` | Information about detected recursion | `call-graph.ts` |

### Configuration Types (01f-01g)

| Type | Purpose | File |
|------|---------|------|
| `ZpRegion` | A contiguous ZP memory region | `platform.ts` |
| `PlatformConfig` | Platform memory configuration | `platform.ts` |
| `ZpScoringWeights` | Weights for ZP priority scoring | `config.ts` |
| `FrameAllocatorConfig` | Allocator configuration options | `config.ts` |
| `AllocationDiagnostic` | Diagnostic messages | `config.ts` |

---

## Index File Template

```typescript
/**
 * Frame Allocator module for Blend65 Compiler v2
 *
 * Implements Static Frame Allocation (SFA) - the core architectural
 * feature of v2. Assigns fixed memory addresses to function frames
 * at compile time.
 *
 * @module frame
 */

// Enums
export {
  SlotLocation,
  SlotKind,
  ZpDirective,
  ThreadContext,
  DiagnosticSeverity,
} from './enums.js';

// Core types
export type {
  FrameSlot,
  ZpScoreBreakdown,
  Frame,
  FrameMap,
  AllocationStats,
} from './types.js';

// Factory functions
export {
  createFrameSlot,
  createFrame,
  createFrameMap,
  createDefaultStats,
  getTypeSize,
  FrameBuilder,
  formatAllocationStats,
} from './types.js';

// Type guards
export {
  isParameterSlot,
  isLocalSlot,
  isReturnSlot,
  isTemporarySlot,
  isZpSlot,
  isFrameRegionSlot,
  requiresZp,
  prefersZp,
  forbiddenFromZp,
} from './guards.js';

// Call graph
export type {
  CallGraphNode,
  CallGraph,
  RecursionError,
} from './call-graph.js';

export {
  createCallGraphNode,
  createDirectRecursionError,
  createMutualRecursionError,
} from './call-graph.js';

// Platform configuration
export type {
  ZpRegion,
  PlatformConfig,
} from './platform.js';

export {
  C64_PLATFORM_CONFIG,
  X16_PLATFORM_CONFIG,
  createCustomPlatform,
  getPlatformConfig,
  getAvailablePlatforms,
} from './platform.js';

// Allocator configuration
export type {
  ZpScoringWeights,
  FrameAllocatorConfig,
  AllocationDiagnostic,
} from './config.js';

export {
  DEFAULT_ZP_WEIGHTS,
  DEFAULT_ALLOCATOR_CONFIG,
  AllocatorConfigBuilder,
  DiagnosticCodes,
  createDiagnostic,
} from './config.js';
```

---

## Integration with Existing Blend Types

The frame types integrate with existing Blend compiler v2 types:

| Blend Type | From | Used In |
|------------|------|---------|
| `TypeInfo` | `semantic/types.ts` | `FrameSlot.type` |
| `TypeKind` | `semantic/types.ts` | `getTypeSize()` |
| `SourceLocation` | `ast/base.ts` | `RecursionError.location` |
| `Program` | `ast/program.ts` | `buildCallGraph()` input |

---

## Session 7.1 Completion Status

All type definition documents are complete:

- [x] 01a - Frame Enums ✅
- [x] 01b - FrameSlot Interface ✅
- [x] 01c - Frame Interface ✅
- [x] 01d - FrameMap Interface ✅
- [x] 01e - CallGraph Types ✅
- [x] 01f - Platform Configuration ✅
- [x] 01g - Allocator Configuration ✅
- [x] 01 - Index Document (this file) ✅

---

## Next Steps

**Session 7.2: Allocator Implementation**
- Design the `FrameAllocator` class
- Plan allocation methods
- Design ZP scoring algorithm
- Design call graph analysis

**Document**: [02-allocator-impl.md](02-allocator-impl.md)

---

## Related Documents

| Document | Content |
|----------|---------|
| [00-overview.md](00-overview.md) | Integration overview |
| [02-allocator-impl.md](02-allocator-impl.md) | Allocator implementation (next) |
| [../god-level-sfa/01-data-structures.md](../god-level-sfa/01-data-structures.md) | Original SFA research |