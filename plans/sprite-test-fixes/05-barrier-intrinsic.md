# Barrier Intrinsic Fix

> **Document**: 05-barrier-intrinsic.md
> **Parent**: [Index](00-index.md)

## Overview

Make `barrier()` produce an actual IL instruction that optimizer passes must preserve.

## Implementation

### 1. Add BARRIER opcode to IL enums

**File**: `packages/compiler/src/il/enums.ts`

Add under the control flow section:
```typescript
BARRIER = 'BARRIER',
```

### 2. Emit BARRIER in generateIntrinsic

**File**: `packages/compiler/src/il/generator/expressions.ts`

Replace:
```typescript
case 'barrier':
  break;
```
With:
```typescript
case 'barrier':
  this.builder.emit(ILOpcode.BARRIER, [], 'optimization barrier');
  break;
```

### 3. Handle BARRIER in codegen

**File**: `packages/compiler/src/codegen/generator/base.ts` (or appropriate handler)

BARRIER should emit a NOP or just a comment in the assembly — it has no runtime effect but must not be removed before codegen:
```typescript
case ILOpcode.BARRIER:
  this.asm.comment('barrier');
  break;
```

### 4. Preserve BARRIER in optimizer passes

Each optimizer pass must NOT eliminate BARRIER instructions:
- **DCE**: BARRIER is not dead code — skip it
- **Loop unroll**: BARRIER prevents full unrolling or must be preserved in each unrolled iteration
- **Copy propagation**: BARRIER is a scheduling fence — do not propagate across it
- **Function inlining**: Preserve BARRIER when inlining

Add to `IL_INSTRUCTION_COSTS` in `packages/compiler/src/il/builder/base.ts`:
```typescript
[ILOpcode.BARRIER]: { cycles: 0, bytes: 0, memoryAccesses: 0 },
```
