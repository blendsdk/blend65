# God-Level SFA: Frame Size Calculation

> **Document**: god-level-sfa/02b-frame-size-calculation.md
> **Purpose**: Algorithm for calculating frame sizes (Phase 2 of allocation)
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

Frame size calculation determines how many bytes each function needs for its parameters, locals, and return value. This happens **before** address assignment.

---

## 1. Frame Size Components

### 1.1 What Goes in a Frame

```
┌─────────────────────────────────────┐
│ Function Frame                      │
├─────────────────────────────────────┤
│ Parameters (in declaration order)   │
│   param1: byte     → 1 byte         │
│   param2: word     → 2 bytes        │
├─────────────────────────────────────┤
│ Return Value (if not void)          │
│   __return: word   → 2 bytes        │
├─────────────────────────────────────┤
│ Local Variables (in order found)    │
│   local1: byte     → 1 byte         │
│   buffer: byte[10] → 10 bytes       │
│   local2: word     → 2 bytes        │
├─────────────────────────────────────┤
│ Padding (optional, for alignment)   │
│   (if needed)      → 0-1 bytes      │
└─────────────────────────────────────┘
```

### 1.2 Type Sizes

| Type | Size (bytes) | Notes |
|------|-------------|-------|
| `byte` | 1 | Unsigned 8-bit |
| `bool` | 1 | Stored as byte |
| `word` | 2 | Unsigned 16-bit |
| `byte[N]` | N | Array of N bytes |
| `word[N]` | 2*N | Array of N words |
| `pointer` | 2 | Always 16-bit address |

---

## 2. Size Calculation Algorithm

### 2.1 Main Algorithm

```typescript
interface FrameSizeInfo {
  /** Total frame size in bytes */
  totalSize: number;
  /** Size of parameter section */
  parameterSize: number;
  /** Size of return value (0 if void) */
  returnSize: number;
  /** Size of local variables */
  localsSize: number;
  /** Padding added for alignment */
  paddingSize: number;
  /** Individual slot sizes */
  slots: Array<{ name: string; kind: SlotKind; size: number }>;
}

function calculateFrameSize(func: FunctionDeclaration): FrameSizeInfo {
  const slots: Array<{ name: string; kind: SlotKind; size: number }> = [];
  let parameterSize = 0;
  let returnSize = 0;
  let localsSize = 0;

  // Step 1: Calculate parameter sizes
  for (const param of func.parameters) {
    const size = getTypeSize(param.type);
    parameterSize += size;
    slots.push({
      name: param.name,
      kind: SlotKind.Parameter,
      size,
    });
  }

  // Step 2: Calculate return value size
  if (func.returnType.name !== 'void') {
    returnSize = getTypeSize(func.returnType);
    slots.push({
      name: '__return',
      kind: SlotKind.Return,
      size: returnSize,
    });
  }

  // Step 3: Calculate local variable sizes
  localsSize = calculateLocalsSize(func.body, slots);

  // Step 4: Calculate padding for alignment
  const rawSize = parameterSize + returnSize + localsSize;
  const paddingSize = rawSize % 2 === 0 ? 0 : 1; // Word alignment

  return {
    totalSize: rawSize + paddingSize,
    parameterSize,
    returnSize,
    localsSize,
    paddingSize,
    slots,
  };
}
```

### 2.2 Calculating Locals Size

```typescript
function calculateLocalsSize(
  body: BlockStatement,
  slots: Array<{ name: string; kind: SlotKind; size: number }>
): number {
  let totalSize = 0;

  function walkNode(node: ASTNode): void {
    if (isVariableDeclaration(node)) {
      const size = getTypeSize(node.type);
      totalSize += size;
      slots.push({
        name: node.name,
        kind: SlotKind.Local,
        size,
      });
    }

    // Walk children to find nested declarations
    for (const child of node.getChildren()) {
      walkNode(child);
    }
  }

  walkNode(body);
  return totalSize;
}
```

### 2.3 Type Size Resolution

```typescript
function getTypeSize(type: TypeInfo): number {
  // Base types
  switch (type.name) {
    case 'byte':
    case 'bool':
      return 1;
    case 'word':
      return 2;
    case 'void':
      return 0;
  }

  // Array types
  if (type.isArray) {
    if (!type.arraySize || !type.elementType) {
      throw new Error(`Invalid array type: ${type.name}`);
    }
    const elementSize = getTypeSize(type.elementType);
    return type.arraySize * elementSize;
  }

  // Pointer types (future)
  if (type.isPointer) {
    return 2; // Always 16-bit on 6502
  }

  // Unknown type - default to byte
  console.warn(`Unknown type: ${type.name}, defaulting to 1 byte`);
  return 1;
}
```

---

## 3. ZP Directive Processing

### 3.1 Extracting ZP Directives

During size calculation, we also extract ZP directives for later:

```typescript
interface SlotInfo {
  name: string;
  kind: SlotKind;
  size: number;
  type: TypeInfo;
  zpDirective: ZpDirective;
}

function extractZpDirective(decl: VariableDeclaration): ZpDirective {
  // Check for storage class annotations
  if (decl.storageClass === '@zp required') {
    return ZpDirective.Required;
  }
  if (decl.storageClass === '@zp') {
    return ZpDirective.Preferred;
  }
  if (decl.storageClass === '@ram') {
    return ZpDirective.Forbidden;
  }
  return ZpDirective.None; // Compiler decides
}
```

### 3.2 Updated Locals Calculation

```typescript
function calculateLocalsWithDirectives(
  body: BlockStatement
): { totalSize: number; slots: SlotInfo[] } {
  const slots: SlotInfo[] = [];
  let totalSize = 0;

  function walkNode(node: ASTNode): void {
    if (isVariableDeclaration(node)) {
      const size = getTypeSize(node.type);
      totalSize += size;

      slots.push({
        name: node.name,
        kind: SlotKind.Local,
        size,
        type: node.type,
        zpDirective: extractZpDirective(node),
      });
    }

    for (const child of node.getChildren()) {
      walkNode(child);
    }
  }

  walkNode(body);
  return { totalSize, slots };
}
```

---

## 4. Handling Special Cases

### 4.1 Empty Functions

```typescript
// Function with no params, no return, no locals
fn noop(): void { }
// Frame size: 0 bytes (no frame needed)
```

### 4.2 Large Frames

```typescript
function validateFrameSize(
  funcName: string,
  sizeInfo: FrameSizeInfo,
  config: FrameAllocatorConfig
): AllocationDiagnostic | null {
  if (sizeInfo.totalSize > config.maxFrameSize) {
    return {
      severity: DiagnosticSeverity.Error,
      code: DiagnosticCodes.FRAME_TOO_LARGE,
      message: `Frame for '${funcName}' is ${sizeInfo.totalSize} bytes, ` +
               `exceeding maximum of ${config.maxFrameSize} bytes.`,
      functionName: funcName,
      suggestion: `Split into multiple functions or reduce local variable sizes.`,
    };
  }

  if (sizeInfo.totalSize > 128) {
    return {
      severity: DiagnosticSeverity.Warning,
      code: DiagnosticCodes.LARGE_FRAME,
      message: `Frame for '${funcName}' is ${sizeInfo.totalSize} bytes, ` +
               `which is relatively large for 6502.`,
      functionName: funcName,
      suggestion: `Consider if all locals are necessary.`,
    };
  }

  return null;
}
```

### 4.3 Array Size Validation

```typescript
function validateArraySize(
  decl: VariableDeclaration,
  funcName: string
): AllocationDiagnostic | null {
  if (decl.type.isArray) {
    const size = getTypeSize(decl.type);

    if (size > 256) {
      return {
        severity: DiagnosticSeverity.Warning,
        code: DiagnosticCodes.LARGE_FRAME,
        message: `Array '${decl.name}' in '${funcName}' is ${size} bytes.`,
        functionName: funcName,
        variableName: decl.name,
        suggestion: `Consider using @ram directive for large arrays.`,
      };
    }
  }

  return null;
}
```

---

## 5. Building Frame Shells

### 5.1 Frame Shell Structure

Before address assignment, we create "frame shells" with sizes but no addresses:

```typescript
interface FrameShell {
  /** Function name */
  functionName: string;
  /** Total frame size */
  totalSize: number;
  /** Slot information (without addresses) */
  slots: SlotInfo[];
  /** From call graph */
  isRecursive: boolean;
  /** From call graph */
  threadContext: ThreadContext;
}
```

### 5.2 Building All Frame Shells

```typescript
function buildFrameShells(
  module: ModuleDeclaration,
  callGraph: CallGraph,
  config: FrameAllocatorConfig
): FrameShellResult {
  const shells = new Map<string, FrameShell>();
  const diagnostics: AllocationDiagnostic[] = [];

  for (const decl of module.declarations) {
    if (!isFunctionDeclaration(decl)) continue;

    // Calculate size
    const sizeInfo = calculateFrameSize(decl);

    // Validate size
    const sizeError = validateFrameSize(decl.name, sizeInfo, config);
    if (sizeError) {
      diagnostics.push(sizeError);
    }

    // Get call graph info
    const cgNode = callGraph.nodes.get(decl.name);

    // Create shell
    const shell: FrameShell = {
      functionName: decl.name,
      totalSize: sizeInfo.totalSize,
      slots: sizeInfo.slots.map(s => ({
        ...s,
        type: getSlotType(decl, s.name, s.kind),
        zpDirective: getSlotDirective(decl, s.name, s.kind),
      })),
      isRecursive: cgNode?.isRecursive ?? false,
      threadContext: cgNode?.threadContext ?? ThreadContext.MainOnly,
    };

    shells.set(decl.name, shell);
  }

  return {
    shells,
    diagnostics,
    hasErrors: diagnostics.some(d => d.severity === DiagnosticSeverity.Error),
  };
}
```

---

## 6. Size Statistics

### 6.1 Computing Statistics

```typescript
interface FrameSizeStats {
  /** Total functions */
  totalFunctions: number;
  /** Functions with empty frames (size 0) */
  emptyFrames: number;
  /** Sum of all frame sizes */
  totalFrameBytes: number;
  /** Largest frame size */
  maxFrameSize: number;
  /** Function with largest frame */
  largestFrameFunction: string;
  /** Average frame size */
  averageFrameSize: number;
  /** Total ZP required bytes (from @zp required) */
  zpRequiredBytes: number;
  /** Total ZP preferred bytes (from @zp) */
  zpPreferredBytes: number;
}

function computeSizeStats(shells: Map<string, FrameShell>): FrameSizeStats {
  let totalFunctions = 0;
  let emptyFrames = 0;
  let totalFrameBytes = 0;
  let maxFrameSize = 0;
  let largestFrameFunction = '';
  let zpRequiredBytes = 0;
  let zpPreferredBytes = 0;

  for (const [name, shell] of shells) {
    totalFunctions++;
    totalFrameBytes += shell.totalSize;

    if (shell.totalSize === 0) {
      emptyFrames++;
    }

    if (shell.totalSize > maxFrameSize) {
      maxFrameSize = shell.totalSize;
      largestFrameFunction = name;
    }

    // Count ZP requirements
    for (const slot of shell.slots) {
      if (slot.zpDirective === ZpDirective.Required) {
        zpRequiredBytes += slot.size;
      } else if (slot.zpDirective === ZpDirective.Preferred) {
        zpPreferredBytes += slot.size;
      }
    }
  }

  return {
    totalFunctions,
    emptyFrames,
    totalFrameBytes,
    maxFrameSize,
    largestFrameFunction,
    averageFrameSize: totalFunctions > 0 ? totalFrameBytes / totalFunctions : 0,
    zpRequiredBytes,
    zpPreferredBytes,
  };
}
```

---

## 7. Example

### Input Program

```
fn calculate(x: byte, y: byte): word {
    let temp: byte = x + y;
    let result: word = temp * 2;
    return result;
}

fn process_data(@zp buffer: byte[16], size: byte): void {
    let i: byte = 0;
    let sum: word = 0;
    // ... processing ...
}

fn main(): void {
    let data: byte[16] = [0; 16];
    let answer: word = calculate(10, 20);
    process_data(data, 16);
}
```

### Frame Size Results

```
┌─────────────────────────────────────────────┐
│ calculate                                   │
├─────────────────────────────────────────────┤
│ param x: byte       1 byte                  │
│ param y: byte       1 byte                  │
│ __return: word      2 bytes                 │
│ local temp: byte    1 byte                  │
│ local result: word  2 bytes                 │
│ padding             1 byte                  │
├─────────────────────────────────────────────┤
│ TOTAL: 8 bytes                              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ process_data                                │
├─────────────────────────────────────────────┤
│ param buffer: byte[16]  16 bytes (@zp)      │
│ param size: byte        1 byte              │
│ local i: byte           1 byte              │
│ local sum: word         2 bytes             │
├─────────────────────────────────────────────┤
│ TOTAL: 20 bytes                             │
│ (16 bytes @zp preferred)                    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ main                                        │
├─────────────────────────────────────────────┤
│ local data: byte[16]    16 bytes            │
│ local answer: word      2 bytes             │
├─────────────────────────────────────────────┤
│ TOTAL: 18 bytes                             │
└─────────────────────────────────────────────┘

Statistics:
  Total functions: 3
  Total frame bytes: 46 (raw, before coalescing)
  Largest frame: process_data (20 bytes)
  ZP required: 0 bytes
  ZP preferred: 16 bytes
```

---

## 8. Output to Next Phase

### 8.1 What We Pass Forward

The frame size calculation phase produces:

1. **FrameShell map** - Function name → shell with sizes and slots
2. **Diagnostics** - Errors/warnings about frame sizes
3. **Statistics** - Summary of frame sizes for reporting

### 8.2 Interface

```typescript
interface FrameSizeResult {
  /** All frame shells */
  shells: Map<string, FrameShell>;

  /** Diagnostics generated */
  diagnostics: AllocationDiagnostic[];

  /** Statistics */
  stats: FrameSizeStats;

  /** Any errors? */
  hasErrors: boolean;
}
```

---

## Summary

| Step | Input | Output |
|------|-------|--------|
| 1. Calculate sizes | FunctionDeclaration | Slot sizes |
| 2. Extract directives | Variable annotations | ZpDirective per slot |
| 3. Validate sizes | Size info + config | Diagnostics |
| 4. Build shells | All info | FrameShell map |
| 5. Compute stats | All shells | FrameSizeStats |

---

**Previous Document:** [02a-call-graph-construction.md](02a-call-graph-construction.md)  
**Next Document:** [02c-address-assignment.md](02c-address-assignment.md)