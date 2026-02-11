# Global Allocator: Address Allocation for Module-Level Variables

> **Document**: 03-global-allocator.md
> **Parent**: [Index](00-index.md)

## Overview

A new `GlobalAllocator` class that assigns memory addresses to module-level variables based on their storage class. Runs as part of the Frame Phase, BEFORE the existing function-local SFA allocation.

## Architecture

### New Class: `GlobalAllocator`

**File**: `packages/compiler/src/frame/allocator/global-allocator.ts`

The GlobalAllocator collects all module-level `VariableDecl` nodes from ALL modules and assigns addresses:

1. **`@zp` globals** → ZP pool addresses ($02-$8F) — allocated FIRST
2. **`@ram` globals** → Global RAM region (after code segment)
3. **`@data const` globals** → Data segment (after global RAM)
4. **Default globals** → Global RAM region

### Allocation Order (Critical)

```
Step 1: Collect all module-level VariableDecls from ALL programs
Step 2: Separate by storage class (@zp, @ram, @data, default)
Step 3: Validate @data has const + initializer
Step 4: Allocate @zp globals to ZP pool (error if overflow)
Step 5: Allocate @ram + default globals to global RAM region
Step 6: Allocate @data globals to data segment
Step 7: Return GlobalAllocationResult with address map
Step 8: Pass remaining ZP pool to function-local SFA allocator
```

### Key Design: ZP Pool Sharing

The ZP pool is shared between globals and locals:
```
ZP Pool ($02-$8F, ~142 bytes)
├── @zp globals (allocated first by GlobalAllocator)
└── auto-scored locals (allocated from remaining by ZpAllocator)
```

The `GlobalAllocator` uses the SAME `ZpPool` instance that the `ZpAllocator` later uses. This ensures no address conflicts.

### Integration with Frame Phase

```typescript
// In pipeline/frame-phase.ts execute():

// 1. NEW: Allocate global variables first
const globalAllocator = new GlobalAllocator(platformConfig);
const globalResult = globalAllocator.allocate(allPrograms);

// 2. EXISTING: Allocate function frames (with remaining ZP pool)
const frameAllocator = new FrameAllocator(platformConfig);
// Pass the ZP pool from global allocation so locals don't conflict
const frameResult = frameAllocator.allocateWithPool(allPrograms, callGraph, symbolTable, globalResult.zpPool);
```

### New Types

```typescript
interface GlobalSlot {
  name: string;
  moduleName: string;
  storageClass: 'zp' | 'ram' | 'data' | 'default';
  type: TypeInfo;
  size: number;
  address: number;        // Assigned address
  isExported: boolean;
  isConst: boolean;
  initializer?: Expression; // For @data and initialized globals
}

interface GlobalAllocationResult {
  success: boolean;
  globals: Map<string, GlobalSlot>;  // qualifiedName → slot
  zpPool: ZpPool;                     // Pool with globals already allocated
  dataSegmentSize: number;
  ramRegionSize: number;
  diagnostics: Diagnostic[];
}
```

### Semantic Metadata Extension

The `symbol-table-builder.ts` must store ALL storage class metadata:

```typescript
// Current (only @zp):
if (result.symbol && node.getStorageClass() === TokenType.ZP) {
  result.symbol.metadata?.set('zpDirective', true);
}

// New (all storage classes):
if (result.symbol && node.getStorageClass()) {
  result.symbol.metadata?.set('storageClass', node.getStorageClass());
}
```

### Frame Enum Extension

```typescript
// In frame/enums.ts
export enum ZpDirective {
  None = 'none',
  Zp = 'zp',
  Ram = 'ram',
  Data = 'data',   // NEW
}
```

### Cross-Module Support

The `GlobalSymbolTable` must carry allocated addresses:

```typescript
// In global-symbol-table.ts, ExportedSymbol extension
interface ExportedSymbol {
  // ... existing fields
  allocatedAddress?: number;      // NEW: Address assigned by GlobalAllocator
  storageClass?: 'zp' | 'ram' | 'data' | 'default';  // NEW
}
```

When module B imports `@zp score` from module A, it gets the pre-allocated ZP address.

## Error Handling

| Error | Cause | Message |
|-------|-------|---------|
| ZP overflow | Too many `@zp` globals | `@zp variable "score" cannot fit in zero page: need 2 bytes, 0 available (142/142 bytes used)` |
| `@data` without const | `@data let x = 5` | `@data variables must be declared with 'const'. Use '@data const' instead.` |
| `@data` without init | `@data const x: byte` | `@data variables must have an initializer.` |
| Storage class in function | `@zp let x = 0` inside func | `Storage class '@zp' is not allowed inside functions. The compiler automatically optimizes local variable placement.` |

## Testing Requirements

- Unit tests for GlobalAllocator (~25 tests)
- ZP pool sharing between globals and locals
- Cross-module ZP address consistency
- Overflow error conditions
- Validation rules (@data + const + initializer)
