# Frame Allocator: Compiler v2

> **Document**: 07-frame-allocator.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Planning Complete

## Overview

The Frame Allocator is the **core NEW component** of the v2 compiler. It implements Static Frame Allocation (SFA), which allocates a fixed memory region for each function's parameters and local variables at compile time.

## Why Static Frame Allocation?

### The Problem with Dynamic Stacks on 6502

Traditional compilers use a runtime stack for function locals:
- Push parameters on call
- Allocate locals on entry
- Pop on return

**But the 6502 has a 256-byte hardware stack** that's used for:
- Return addresses (JSR/RTS)
- Interrupt handling
- Register saves

This leaves little room for local variables, and dynamic stack frames are complex to manage.

### The SFA Solution

Each function gets a **static memory region** allocated at compile time:
- Parameters at fixed addresses
- Locals at fixed addresses
- No runtime stack manipulation for variables
- Simple, predictable, fast

**Trade-off**: Recursion is impossible (detected and rejected at compile time).

---

## Core Concepts

### Frame Structure

```typescript
// frame/types.ts

/**
 * A slot in a function's frame.
 * Each parameter and local variable gets a slot.
 */
export interface FrameSlot {
  /** Slot name (variable/parameter name) */
  name: string;
  /** Offset from frame base address */
  offset: number;
  /** Size in bytes (1 for byte, 2 for word, etc.) */
  size: number;
  /** Type of the slot */
  type: TypeInfo;
  /** Is this a parameter or local? */
  kind: 'parameter' | 'local' | 'return';
}

/**
 * A function's static frame.
 */
export interface Frame {
  /** Function name */
  functionName: string;
  /** Base address of the frame */
  baseAddress: number;
  /** Total size of the frame in bytes */
  totalSize: number;
  /** All slots in the frame */
  slots: FrameSlot[];
  /** Lookup slot by name */
  getSlot(name: string): FrameSlot | undefined;
}

/**
 * Global frame allocation map.
 */
export interface FrameMap {
  /** All function frames */
  frames: Map<string, Frame>;
  /** Start of frame region */
  regionStart: number;
  /** End of frame region */
  regionEnd: number;
  /** Total bytes used */
  totalUsed: number;
}
```

### Memory Layout

```
┌─────────────────────────────────────────┐
│ C64 Memory Map                          │
├─────────────────────────────────────────┤
│ $0000-$00FF  Zero Page                  │
│   $02-$8F    @zp variables (143 bytes)  │
│   $90-$FA    KERNAL workspace           │
│   $FB-$FE    Compiler temporaries (4)   │
├─────────────────────────────────────────┤
│ $0100-$01FF  Hardware Stack             │
├─────────────────────────────────────────┤
│ $0200-$03FF  SFA FRAME REGION (512 bytes)│
│   $0200      main_frame                 │
│   $0210      func1_frame                │
│   $0230      func2_frame                │
│   ...                                   │
├─────────────────────────────────────────┤
│ $0400-$07FF  Screen RAM                 │
├─────────────────────────────────────────┤
│ $0800+       Program Code & Data        │
│              @ram variables             │
│              @data constants            │
└─────────────────────────────────────────┘
```

---

## Frame Allocator Implementation

### FrameAllocator Class

```typescript
// frame/allocator.ts

export class FrameAllocator {
  /** Configuration */
  protected config: FrameAllocatorConfig;
  /** Built frames */
  protected frames: Map<string, Frame> = new Map();
  /** Current allocation address */
  protected currentAddress: number;

  constructor(config: FrameAllocatorConfig) {
    this.config = config;
    this.currentAddress = config.frameRegionStart;
  }

  /**
   * Allocate frames for all functions in the module.
   */
  allocate(module: ModuleDeclaration, callGraph: CallGraph): FrameMap {
    // Step 1: Calculate frame sizes for all functions
    const frameSizes = this.calculateFrameSizes(module);

    // Step 2: Allocate addresses for each frame
    for (const [funcName, size] of frameSizes) {
      this.allocateFrame(funcName, size, module);
    }

    // Step 3: Build and return the frame map
    return {
      frames: this.frames,
      regionStart: this.config.frameRegionStart,
      regionEnd: this.currentAddress,
      totalUsed: this.currentAddress - this.config.frameRegionStart,
    };
  }

  /**
   * Calculate the size needed for each function's frame.
   */
  protected calculateFrameSizes(module: ModuleDeclaration): Map<string, number> {
    const sizes = new Map<string, number>();

    for (const decl of module.declarations) {
      if (isFunctionDeclaration(decl)) {
        const size = this.calculateFunctionFrameSize(decl);
        sizes.set(decl.name, size);
      }
    }

    return sizes;
  }

  /**
   * Calculate frame size for a single function.
   */
  protected calculateFunctionFrameSize(func: FunctionDeclaration): number {
    let size = 0;

    // Parameters
    for (const param of func.parameters) {
      size += this.getTypeSize(param.type);
    }

    // Return value (if not void)
    if (func.returnType.name !== 'void') {
      size += this.getTypeSize(func.returnType);
    }

    // Local variables (walk the body)
    size += this.calculateLocalsSize(func.body);

    // Align to even address (optional, for word alignment)
    if (size % 2 !== 0) {
      size += 1;
    }

    return size;
  }

  /**
   * Calculate total size of local variables in a block.
   */
  protected calculateLocalsSize(body: BlockStatement): number {
    let size = 0;

    const walk = (node: ASTNode): void => {
      if (isVariableDeclaration(node)) {
        size += this.getTypeSize(node.type);
        if (node.type.isArray) {
          size += node.type.arraySize! * this.getTypeSize(node.type.elementType!);
        }
      }

      // Walk children (including nested blocks)
      for (const child of node.getChildren()) {
        walk(child);
      }
    };

    walk(body);
    return size;
  }

  /**
   * Allocate a frame at the current address.
   */
  protected allocateFrame(
    funcName: string, 
    size: number, 
    module: ModuleDeclaration
  ): void {
    const func = this.findFunction(module, funcName);
    if (!func) return;

    const baseAddress = this.currentAddress;
    const slots: FrameSlot[] = [];
    let offset = 0;

    // Allocate parameter slots
    for (const param of func.parameters) {
      const paramSize = this.getTypeSize(param.type);
      slots.push({
        name: param.name,
        offset,
        size: paramSize,
        type: param.type,
        kind: 'parameter',
      });
      offset += paramSize;
    }

    // Allocate return value slot (if not void)
    if (func.returnType.name !== 'void') {
      const returnSize = this.getTypeSize(func.returnType);
      slots.push({
        name: '__return',
        offset,
        size: returnSize,
        type: func.returnType,
        kind: 'return',
      });
      offset += returnSize;
    }

    // Allocate local variable slots
    this.allocateLocalSlots(func.body, slots, offset);

    // Create the frame
    const frame: Frame = {
      functionName: funcName,
      baseAddress,
      totalSize: size,
      slots,
      getSlot: (name: string) => slots.find(s => s.name === name),
    };

    this.frames.set(funcName, frame);
    this.currentAddress += size;

    // Check for overflow
    if (this.currentAddress > this.config.frameRegionEnd) {
      throw new Error(
        `Frame region overflow: ${this.currentAddress} > ${this.config.frameRegionEnd}. ` +
        `Too many functions or too large locals.`
      );
    }
  }

  /**
   * Allocate slots for local variables.
   */
  protected allocateLocalSlots(
    body: BlockStatement, 
    slots: FrameSlot[], 
    startOffset: number
  ): number {
    let offset = startOffset;

    const walk = (node: ASTNode): void => {
      if (isVariableDeclaration(node)) {
        const varSize = this.getTypeSize(node.type);
        slots.push({
          name: node.name,
          offset,
          size: varSize,
          type: node.type,
          kind: 'local',
        });
        offset += varSize;

        // Handle arrays
        if (node.type.isArray && node.type.arraySize) {
          // Array storage is contiguous after the pointer/first element
          const elementSize = this.getTypeSize(node.type.elementType!);
          offset += (node.type.arraySize - 1) * elementSize;
        }
      }

      for (const child of node.getChildren()) {
        walk(child);
      }
    };

    walk(body);
    return offset;
  }

  /**
   * Get size of a type in bytes.
   */
  protected getTypeSize(type: TypeInfo): number {
    switch (type.name) {
      case 'byte':
      case 'bool':
        return 1;
      case 'word':
        return 2;
      default:
        if (type.isArray) {
          // Return size of array (count * element size)
          const elemSize = this.getTypeSize(type.elementType!);
          return type.arraySize! * elemSize;
        }
        return 1; // Default to byte
    }
  }

  protected findFunction(
    module: ModuleDeclaration, 
    name: string
  ): FunctionDeclaration | undefined {
    for (const decl of module.declarations) {
      if (isFunctionDeclaration(decl) && decl.name === name) {
        return decl;
      }
    }
    return undefined;
  }
}
```

### Configuration

```typescript
// frame/types.ts

export interface FrameAllocatorConfig {
  /** Start address of frame region */
  frameRegionStart: number;
  /** End address of frame region (exclusive) */
  frameRegionEnd: number;
  /** Alignment requirement (1 = none, 2 = word-aligned) */
  alignment: number;
}

// Default C64 configuration
export const C64_FRAME_CONFIG: FrameAllocatorConfig = {
  frameRegionStart: 0x0200,
  frameRegionEnd: 0x0400,
  alignment: 1,
};
```

---

## Example Frame Allocation

### Source Code

```js
module Example;

function add(a: byte, b: byte): byte {
  return a + b;
}

function calculate(): word {
  let x: byte = 10;
  let y: byte = 20;
  let result: word = 0;
  result = add(x, y) + add(y, x);
  return result;
}

function main(): void {
  let answer: word = calculate();
  poke($0400, lo(answer));
  poke($0401, hi(answer));
}
```

### Frame Allocation Result

```
Frame Region: $0200-$03FF

add_frame at $0200 (4 bytes):
  $0200: param a (byte, 1)
  $0201: param b (byte, 1)
  $0202: return value (byte, 1)
  $0203: padding (alignment)

calculate_frame at $0204 (8 bytes):
  $0204: local x (byte, 1)
  $0205: local y (byte, 1)
  $0206: local result (word, 2)
  $0208: return value (word, 2)
  $020A: padding (alignment, 2)

main_frame at $020C (4 bytes):
  $020C: local answer (word, 2)
  $020E: padding (alignment, 2)

Total used: 16 bytes ($0200-$020F)
```

---

## Address Resolution

### Getting Variable Addresses

```typescript
// In IL generator or codegen:

function getVariableAddress(
  funcName: string, 
  varName: string, 
  frameMap: FrameMap
): number {
  const frame = frameMap.frames.get(funcName);
  if (!frame) {
    throw new Error(`Unknown function: ${funcName}`);
  }

  const slot = frame.getSlot(varName);
  if (!slot) {
    throw new Error(`Unknown variable: ${varName} in ${funcName}`);
  }

  return frame.baseAddress + slot.offset;
}

// Example:
// getVariableAddress('add', 'a', frameMap) → $0200
// getVariableAddress('add', 'b', frameMap) → $0201
// getVariableAddress('calculate', 'result', frameMap) → $0206
```

---

## Migration Tasks

### Session 6.1: Frame Types

| # | Task | File | Description |
|---|------|------|-------------|
| 6.1.1 | Create types.ts | `frame/types.ts` | Frame, FrameSlot, FrameMap types |
| 6.1.2 | Create config | `frame/types.ts` | FrameAllocatorConfig |
| 6.1.3 | Create test file | `__tests__/frame/types.test.ts` | Type tests |

### Session 6.2: Frame Allocator Core

| # | Task | File | Description |
|---|------|------|-------------|
| 6.2.1 | Create allocator.ts | `frame/allocator.ts` | FrameAllocator class |
| 6.2.2 | Implement calculateFrameSizes | `frame/allocator.ts` | Size calculation |
| 6.2.3 | Implement allocateFrame | `frame/allocator.ts` | Address allocation |
| 6.2.4 | Add allocator tests | `__tests__/frame/allocator.test.ts` | Unit tests |

### Session 6.3: Frame Layout

| # | Task | File | Description |
|---|------|------|-------------|
| 6.3.1 | Create layout.ts | `frame/layout.ts` | Memory layout utilities |
| 6.3.2 | Add slot allocation | `frame/allocator.ts` | Parameter/local slots |
| 6.3.3 | Add array handling | `frame/allocator.ts` | Array slot sizes |
| 6.3.4 | Add layout tests | `__tests__/frame/layout.test.ts` | Layout tests |

### Session 6.4: Integration

| # | Task | File | Description |
|---|------|------|-------------|
| 6.4.1 | Create index.ts | `frame/index.ts` | Exports |
| 6.4.2 | Integrate with semantic | `semantic/analyzer.ts` | Wire up allocator |
| 6.4.3 | Add integration tests | `__tests__/frame/integration.test.ts` | Full pipeline |
| 6.4.4 | Run all tests | - | Verify |

---

## Verification Checklist

After implementation, verify:

- [ ] Frame types are correctly defined
- [ ] Frame sizes calculated correctly
- [ ] Parameters get slots
- [ ] Locals get slots
- [ ] Return values get slots
- [ ] Arrays allocated correctly
- [ ] Frame addresses don't overlap
- [ ] Region overflow detected
- [ ] Integration with semantic works
- [ ] All tests pass

---

## Related Documents

| Document | Description |
|----------|-------------|
| [06-semantic-migration.md](06-semantic-migration.md) | Semantic analyzer (provides AST) |
| [08-il-generator.md](08-il-generator.md) | Next: IL generation |
| [99-execution-plan.md](99-execution-plan.md) | Full task list |
| [Language Spec: 10-compiler.md](../../docs/language-specification-v2/10-compiler.md) | SFA specification |