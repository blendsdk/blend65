# God-Level IL Generator Implementation Plan

> **Status**: Implementation Plan (ENHANCED)  
> **Date**: January 19, 2026  
> **Priority**: CRITICAL - Next Phase  
> **Estimated Time**: 6.5-8 weeks  
> **Prerequisites**: Semantic Analyzer IL-Readiness (COMPLETE ✅)
> **Revision**: v2.0 - Added @map struct handling, optimization barriers, enhanced metadata

---

## Executive Summary

This document provides a **detailed, granular implementation plan** for the Blend65 IL (Intermediate Language) Generator. The IL is designed to be truly "god-level" - enabling a sophisticated optimizer and code generator for the 6502 processor family.

### Why "God-Level" IL?

The 6502 is a constrained architecture with:
- **Only 3 general-purpose registers** (A, X, Y)
- **256-byte stack limit**
- **256-byte zero page** (precious fast memory)
- **Limited addressing modes**
- **No hardware multiply/divide**

A god-level IL must:
1. **Preserve all semantic analysis metadata** for optimization
2. **Use SSA form** for easy dataflow analysis
3. **Be target-agnostic** while enabling target-specific optimizations
4. **Support virtual registers** (unlimited) for proper register allocation
5. **Track type information** on every value
6. **Enable powerful optimizations** (DCE, CSE, constant folding, etc.)

---

## Current State Assessment

### What We Have (COMPLETE)

| Component | Status | Tests |
|-----------|--------|-------|
| Lexer | ✅ Complete | 150+ |
| Parser | ✅ Complete | 400+ |
| AST System | ✅ Complete | 100+ |
| Semantic Analyzer | ✅ Complete | 1,365+ |
| Type Coercion Analysis | ✅ Complete | 40 |
| Addressing Mode Hints | ✅ Complete | 26 |
| Expression Complexity | ✅ Complete | 39 |
| Hardware Analyzers | ✅ Complete | 200+ |
| Target Architecture | ✅ Complete | 50+ |
| **TOTAL** | **✅ Ready for IL** | **2,603** |

### What the IL Generator Will Consume

From semantic analysis, the IL generator receives:
- **Symbol Tables**: All variables, functions, types with resolved types
- **Type Information**: Full type info on every expression
- **Type Coercion Markers**: Where conversions are needed
- **Addressing Mode Hints**: Optimal 6502 addressing for each access
- **Expression Complexity**: Register pressure estimates
- **Constant Values**: Pre-computed constant folding results
- **Liveness Data**: Variable live ranges
- **Control Flow Graphs**: Per-function CFGs
- **6502 Hints**: Register preferences, zero-page priorities

---

## IL Design Philosophy

### Design Principle 1: SSA Form (Static Single Assignment)

Every variable is assigned exactly once. This enables:
- Clean dataflow analysis
- Easy dead code elimination
- Simple constant propagation
- Efficient register allocation

```
// Source
let x = 5;
x = x + 3;
x = x * 2;

// SSA IL
x.0 = 5
x.1 = x.0 + 3
x.2 = x.1 * 2
```

### Design Principle 2: Three-Address Code

Each instruction has at most:
- One destination (result)
- Two sources (operands)

```
// Complex expression: a = (b + c) * (d - e)
t1 = b + c
t2 = d - e
a = t1 * t2
```

### Design Principle 3: Virtual Registers

Unlimited virtual registers, let code generator allocate to A/X/Y:

```
v0 = LOAD_CONST 10
v1 = LOAD_VAR playerX
v2 = ADD v0, v1
STORE_VAR playerX, v2
```

### Design Principle 4: Rich Metadata Preservation

Every IL instruction carries:
- Source location (for debugging)
- Type information
- Semantic analysis metadata (addressing mode, complexity, etc.)

### Design Principle 5: Target-Agnostic Core

IL instructions are generic. Target-specific info is in metadata:

```
// Same IL for C64, C128, X16
v0 = HARDWARE_READ $D020, byte
  metadata: { addressingMode: Absolute, vicTiming: { ... } }
```

### Design Principle 6: Source Maps for Debugging

Every IL instruction maintains a mapping back to source code, enabling:
- Debugging with source-level breakpoints
- Error messages pointing to original source
- Multiple code gen targets with consistent source mapping

```typescript
interface SourceMapping {
  /** Original source file */
  sourceFile: string;
  
  /** Line number in source (1-based) */
  sourceLine: number;
  
  /** Column in source (0-based) */
  sourceColumn: number;
  
  /** Generated line in output */
  generatedLine: number;
  
  /** Generated column in output */
  generatedColumn: number;
  
  /** Optional: original symbol name */
  name?: string;
}
```

### Design Principle 7: Foundation for Future Phases

The IL is designed to support future phases (implemented separately):

```
IL Generator (this plan)
    ↓
IL Output (SSA form, all metadata preserved)
    ↓
God-Level Optimizer (FUTURE PLAN)
    ↓
Optimized IL
    ↓
God-Level Code Generator (FUTURE PLAN)
    ↓
PRG / ACME / KickAssembler output
```

**This IL plan does NOT include code generation.** It produces a complete, validated IL representation ready for the optimizer.

---

## IL Instruction Set Overview

### Category 1: Constants and Values

| Instruction | Description | Example |
|-------------|-------------|---------|
| `CONST` | Load constant | `v0 = CONST 42, byte` |
| `UNDEF` | Undefined value | `v0 = UNDEF byte` |

### Category 2: Memory Operations

| Instruction | Description | Example |
|-------------|-------------|---------|
| `LOAD_VAR` | Load from variable | `v0 = LOAD_VAR x` |
| `STORE_VAR` | Store to variable | `STORE_VAR x, v0` |
| `LOAD_ARRAY` | Load array element | `v0 = LOAD_ARRAY arr, v1` |
| `STORE_ARRAY` | Store array element | `STORE_ARRAY arr, v1, v0` |
| `LOAD_FIELD` | Load struct field | `v0 = LOAD_FIELD obj, .x` |
| `STORE_FIELD` | Store struct field | `STORE_FIELD obj, .x, v0` |

### Category 3: Arithmetic Operations

| Instruction | Description | Example |
|-------------|-------------|---------|
| `ADD` | Addition | `v2 = ADD v0, v1` |
| `SUB` | Subtraction | `v2 = SUB v0, v1` |
| `MUL` | Multiplication | `v2 = MUL v0, v1` |
| `DIV` | Division | `v2 = DIV v0, v1` |
| `MOD` | Modulo | `v2 = MOD v0, v1` |
| `NEG` | Negate | `v1 = NEG v0` |

### Category 4: Bitwise Operations

| Instruction | Description | Example |
|-------------|-------------|---------|
| `AND` | Bitwise AND | `v2 = AND v0, v1` |
| `OR` | Bitwise OR | `v2 = OR v0, v1` |
| `XOR` | Bitwise XOR | `v2 = XOR v0, v1` |
| `NOT` | Bitwise NOT | `v1 = NOT v0` |
| `SHL` | Shift left | `v2 = SHL v0, v1` |
| `SHR` | Shift right | `v2 = SHR v0, v1` |

### Category 5: Comparison Operations

| Instruction | Description | Example |
|-------------|-------------|---------|
| `CMP_EQ` | Equal | `v2 = CMP_EQ v0, v1` |
| `CMP_NE` | Not equal | `v2 = CMP_NE v0, v1` |
| `CMP_LT` | Less than | `v2 = CMP_LT v0, v1` |
| `CMP_LE` | Less or equal | `v2 = CMP_LE v0, v1` |
| `CMP_GT` | Greater than | `v2 = CMP_GT v0, v1` |
| `CMP_GE` | Greater or equal | `v2 = CMP_GE v0, v1` |

### Category 6: Logical Operations

| Instruction | Description | Example |
|-------------|-------------|---------|
| `LOGICAL_AND` | Short-circuit AND | `v2 = LOGICAL_AND v0, v1` |
| `LOGICAL_OR` | Short-circuit OR | `v2 = LOGICAL_OR v0, v1` |
| `LOGICAL_NOT` | Logical NOT | `v1 = LOGICAL_NOT v0` |

### Category 7: Type Conversions

| Instruction | Description | Example |
|-------------|-------------|---------|
| `ZERO_EXTEND` | byte→word | `v1 = ZERO_EXTEND v0, word` |
| `TRUNCATE` | word→byte | `v1 = TRUNCATE v0, byte` |
| `BOOL_TO_BYTE` | bool→byte | `v1 = BOOL_TO_BYTE v0` |
| `BYTE_TO_BOOL` | byte→bool | `v1 = BYTE_TO_BOOL v0` |

### Category 8: Control Flow

| Instruction | Description | Example |
|-------------|-------------|---------|
| `LABEL` | Define label | `LABEL loop_start` |
| `JUMP` | Unconditional jump | `JUMP loop_start` |
| `BRANCH` | Conditional branch | `BRANCH v0, then_label, else_label` |
| `RETURN` | Return from function | `RETURN v0` |
| `RETURN_VOID` | Return void | `RETURN_VOID` |

### Category 9: Function Calls

| Instruction | Description | Example |
|-------------|-------------|---------|
| `CALL` | Call function | `v0 = CALL func, [v1, v2]` |
| `CALL_VOID` | Call void function | `CALL_VOID func, [v1, v2]` |
| `CALL_INDIRECT` | Call via pointer | `v0 = CALL_INDIRECT v1, [v2]` |

### Category 10: Intrinsics

| Instruction | Description | Example |
|-------------|-------------|---------|
| `INTRINSIC_PEEK` | Read memory | `v0 = INTRINSIC_PEEK v1` |
| `INTRINSIC_POKE` | Write memory | `INTRINSIC_POKE v0, v1` |
| `INTRINSIC_PEEKW` | Read word | `v0 = INTRINSIC_PEEKW v1` |
| `INTRINSIC_POKEW` | Write word | `INTRINSIC_POKEW v0, v1` |
| `INTRINSIC_LENGTH` | Array/string length | `v0 = INTRINSIC_LENGTH v1` |

### Category 11: SSA-Specific

| Instruction | Description | Example |
|-------------|-------------|---------|
| `PHI` | Phi function | `v2 = PHI [v0, block1], [v1, block2]` |

### Category 12: Hardware Access (Target-Aware)

| Instruction | Description | Example |
|-------------|-------------|---------|
| `HARDWARE_READ` | Read hardware register | `v0 = HARDWARE_READ $D020, byte` |
| `HARDWARE_WRITE` | Write hardware register | `HARDWARE_WRITE $D020, v0` |

### Category 13: @map Struct Access (NEW - v2.0)

These instructions provide structure-aware access to memory-mapped hardware, enabling better optimization and code generation.

| Instruction | Description | Example |
|-------------|-------------|---------|
| `MAP_LOAD_FIELD` | Load from @map struct field | `v0 = MAP_LOAD_FIELD sidVoice1, frequencyLo` |
| `MAP_STORE_FIELD` | Store to @map struct field | `MAP_STORE_FIELD sidVoice1, waveform, v0` |
| `MAP_LOAD_RANGE` | Load from @map range (indexed) | `v0 = MAP_LOAD_RANGE spritePos, v1` |
| `MAP_STORE_RANGE` | Store to @map range (indexed) | `MAP_STORE_RANGE spritePos, v1, v0` |

**Why Specific @map Instructions?**

Without specific instructions, the optimizer sees:
```
HARDWARE_WRITE $D400, v0
HARDWARE_WRITE $D401, v1
HARDWARE_WRITE $D402, v2
```

It doesn't know these are related SID voice fields - must be conservative (no reordering).

With @map struct instructions:
```
MAP_STORE_FIELD sidVoice1, frequencyLo, v0
MAP_STORE_FIELD sidVoice1, frequencyHi, v1
MAP_STORE_FIELD sidVoice1, pulseLo, v2
```

Now optimizer KNOWS:
- Same struct → can analyze access patterns
- Field types known → type-aware optimization
- Sequential layout → can verify no aliasing
- Can batch writes when safe

### Category 14: Optimization Control (NEW - v2.0)

Critical for C64 hardware timing where instruction order matters.

| Instruction | Description | Example |
|-------------|-------------|---------|
| `OPT_BARRIER` | Prevent instruction reordering | `OPT_BARRIER` |
| `VOLATILE_READ` | Read that cannot be eliminated | `v0 = VOLATILE_READ $D012` |
| `VOLATILE_WRITE` | Write that cannot be eliminated | `VOLATILE_WRITE $D020, v0` |

**Why Optimization Barriers?**

VIC-II raster timing example:
```js
// Must execute in exact order for raster effect!
vic.borderColor = 0;    // At raster line 50
vic.backgroundColor = 6; // Still at raster line 50
// ... wait for raster line 51 ...
vic.borderColor = 1;    // At raster line 51
```

Without barrier, optimizer might reorder these - breaking the effect!

With barriers:
```
VOLATILE_WRITE $D020, v0
OPT_BARRIER
VOLATILE_WRITE $D021, v1
```

Optimizer respects the fence - guaranteed correct timing.

---

## Enhanced ILMetadata (v2.0)

The `ILMetadata` interface is extended with additional fields for optimizer and code generator:

```typescript
export interface ILMetadata {
  // === Existing fields ===
  location?: SourceLocation;
  addressingMode?: string;
  complexity?: number;
  registerPressure?: number;
  coercion?: { kind: string; sourceType: ILType; targetType: ILType };
  m6502Hints?: { preferredRegister?: 'A' | 'X' | 'Y'; zeroPagePriority?: number };
  
  // === NEW v2.0 fields ===
  
  /** For VIC-II raster-critical code - prevents reordering */
  rasterCritical?: boolean;
  
  /** Estimated cycle count for this instruction */
  estimatedCycles?: number;
  
  /** Loop nesting depth (0 = not in loop) */
  loopDepth?: number;
  
  /** Is this expression loop-invariant? */
  isLoopInvariant?: boolean;
  
  /** Should this function be inlined? */
  inlineCandidate?: boolean;
  
  /** Execution frequency hint */
  executionFrequency?: 'hot' | 'cold' | 'normal';
  
  /** Original source expression (for error messages) */
  sourceExpression?: string;
  
  /** @map struct info */
  mapInfo?: {
    structName: string;
    fieldName?: string;
    baseAddress: number;
    fieldOffset?: number;
    isRange?: boolean;
    rangeStart?: number;
    rangeEnd?: number;
  };
}
```

---

## Implementation Phases Overview

The implementation is divided into **8 phases** with **50+ granular tasks**:

| Phase | Description | Tasks | Est. Time |
|-------|-------------|-------|-----------|
| **Phase 1** | IL Type System & Infrastructure | 8 tasks | 3-4 days |
| **Phase 2** | Basic Block & CFG Infrastructure | 6 tasks | 2-3 days |
| **Phase 3** | IL Generator Core | 10 tasks | 4-5 days |
| **Phase 4** | Expression Translation | 12 tasks | 4-5 days |
| **Phase 5** | Statement Translation | 8 tasks | 3-4 days |
| **Phase 6** | Intrinsics & Special Handling | 8 tasks | 3-4 days |
| **Phase 7** | SSA Construction | 6 tasks | 3-4 days |
| **Phase 8** | IL Optimization Passes | 8 tasks | 4-5 days |
| **Phase 9** | Testing & Integration | 6 tasks | 3-4 days |

**Total: ~72 tasks over 6-8 weeks**

---

## Phase 1: IL Type System & Infrastructure (3-4 days)

### Overview

This phase creates the foundation: IL value types, instruction types, and basic infrastructure.

### Directory Structure

```
packages/compiler/src/il/
├── index.ts                    # Exports
├── types.ts                    # IL type definitions
├── values.ts                   # ILValue, VirtualRegister
├── instructions.ts             # All IL instruction types
├── basic-block.ts              # BasicBlock class
├── function.ts                 # ILFunction class
├── module.ts                   # ILModule class
├── builder.ts                  # ILBuilder helper
├── printer.ts                  # IL pretty-printer (debugging)
└── validator.ts                # IL validation
```

---

### Task 1.1: Create IL Directory Structure

**File**: `packages/compiler/src/il/index.ts`

**Deliverable**: Empty directory with index.ts exporting nothing yet

**Time**: 15 minutes

**Tests**: None (infrastructure)

---

### Task 1.2: Define IL Type System

**File**: `packages/compiler/src/il/types.ts`

**Content**:
```typescript
/**
 * IL Types - Mirrors Blend65 type system for IL
 */
export enum ILTypeKind {
  Void = 'void',
  Bool = 'bool',
  Byte = 'byte',
  Word = 'word',
  Pointer = 'pointer',
  Array = 'array',
  Function = 'function',
}

export interface ILType {
  kind: ILTypeKind;
  sizeInBytes: number;
}

export interface ILArrayType extends ILType {
  kind: ILTypeKind.Array;
  elementType: ILType;
  length: number | null; // null = dynamic
}

export interface ILPointerType extends ILType {
  kind: ILTypeKind.Pointer;
  pointeeType: ILType;
}

export interface ILFunctionType extends ILType {
  kind: ILTypeKind.Function;
  parameterTypes: ILType[];
  returnType: ILType;
}

// Singleton instances for primitive types
export const IL_VOID: ILType = { kind: ILTypeKind.Void, sizeInBytes: 0 };
export const IL_BOOL: ILType = { kind: ILTypeKind.Bool, sizeInBytes: 1 };
export const IL_BYTE: ILType = { kind: ILTypeKind.Byte, sizeInBytes: 1 };
export const IL_WORD: ILType = { kind: ILTypeKind.Word, sizeInBytes: 2 };
```

**Time**: 1 hour

**Tests**: 10 tests (type creation, size calculations, type equality)

---

### Task 1.3: Define Virtual Register & Values

**File**: `packages/compiler/src/il/values.ts`

**Content**:
```typescript
import type { ILType } from './types.js';
import type { SourceLocation } from '../ast/base.js';

/**
 * Virtual register identifier
 */
export class VirtualRegister {
  constructor(
    public readonly id: number,
    public readonly type: ILType,
    public readonly name?: string, // Original variable name for debugging
  ) {}

  toString(): string {
    return this.name ? `v${this.id}:${this.name}` : `v${this.id}`;
  }
}

/**
 * IL Value - can be register, constant, or label
 */
export type ILValue = 
  | VirtualRegister
  | ILConstant
  | ILLabel;

export interface ILConstant {
  kind: 'constant';
  value: number;
  type: ILType;
}

export interface ILLabel {
  kind: 'label';
  name: string;
  blockId: number;
}

/**
 * Factory for creating IL values
 */
export class ILValueFactory {
  protected nextRegisterId = 0;

  createRegister(type: ILType, name?: string): VirtualRegister {
    return new VirtualRegister(this.nextRegisterId++, type, name);
  }

  createConstant(value: number, type: ILType): ILConstant {
    return { kind: 'constant', value, type };
  }

  createLabel(name: string, blockId: number): ILLabel {
    return { kind: 'label', name, blockId };
  }

  reset(): void {
    this.nextRegisterId = 0;
  }
}
```

**Time**: 1.5 hours

**Tests**: 15 tests (register creation, constant creation, factory methods)

---

### Task 1.4: Define IL Instruction Opcode Enum

**File**: `packages/compiler/src/il/instructions.ts` (Part 1)

**Content**:
```typescript
/**
 * IL Instruction Opcodes
 */
export enum ILOpcode {
  // Constants
  CONST = 'CONST',
  UNDEF = 'UNDEF',
  
  // Memory
  LOAD_VAR = 'LOAD_VAR',
  STORE_VAR = 'STORE_VAR',
  LOAD_ARRAY = 'LOAD_ARRAY',
  STORE_ARRAY = 'STORE_ARRAY',
  LOAD_FIELD = 'LOAD_FIELD',
  STORE_FIELD = 'STORE_FIELD',
  
  // Arithmetic
  ADD = 'ADD',
  SUB = 'SUB',
  MUL = 'MUL',
  DIV = 'DIV',
  MOD = 'MOD',
  NEG = 'NEG',
  
  // Bitwise
  AND = 'AND',
  OR = 'OR',
  XOR = 'XOR',
  NOT = 'NOT',
  SHL = 'SHL',
  SHR = 'SHR',
  
  // Comparison
  CMP_EQ = 'CMP_EQ',
  CMP_NE = 'CMP_NE',
  CMP_LT = 'CMP_LT',
  CMP_LE = 'CMP_LE',
  CMP_GT = 'CMP_GT',
  CMP_GE = 'CMP_GE',
  
  // Logical
  LOGICAL_AND = 'LOGICAL_AND',
  LOGICAL_OR = 'LOGICAL_OR',
  LOGICAL_NOT = 'LOGICAL_NOT',
  
  // Type Conversion
  ZERO_EXTEND = 'ZERO_EXTEND',
  TRUNCATE = 'TRUNCATE',
  BOOL_TO_BYTE = 'BOOL_TO_BYTE',
  BYTE_TO_BOOL = 'BYTE_TO_BOOL',
  
  // Control Flow
  JUMP = 'JUMP',
  BRANCH = 'BRANCH',
  RETURN = 'RETURN',
  RETURN_VOID = 'RETURN_VOID',
  
  // Functions
  CALL = 'CALL',
  CALL_VOID = 'CALL_VOID',
  CALL_INDIRECT = 'CALL_INDIRECT',
  
  // Intrinsics
  INTRINSIC_PEEK = 'INTRINSIC_PEEK',
  INTRINSIC_POKE = 'INTRINSIC_POKE',
  INTRINSIC_PEEKW = 'INTRINSIC_PEEKW',
  INTRINSIC_POKEW = 'INTRINSIC_POKEW',
  INTRINSIC_LENGTH = 'INTRINSIC_LENGTH',
  
  // SSA
  PHI = 'PHI',
  
  // Hardware
  HARDWARE_READ = 'HARDWARE_READ',
  HARDWARE_WRITE = 'HARDWARE_WRITE',
}
```

**Time**: 45 minutes

**Tests**: 5 tests (enum completeness)

---

### Task 1.5: Define IL Instruction Base Classes

**File**: `packages/compiler/src/il/instructions.ts` (Part 2 - append)

**Content**:
```typescript
import type { ILType } from './types.js';
import type { VirtualRegister, ILValue, ILLabel } from './values.js';
import type { SourceLocation } from '../ast/base.js';

/**
 * Metadata attached to IL instructions
 */
export interface ILMetadata {
  /** Original source location */
  location?: SourceLocation;
  
  /** Addressing mode hint from semantic analysis */
  addressingMode?: string;
  
  /** Expression complexity score */
  complexity?: number;
  
  /** Register pressure */
  registerPressure?: number;
  
  /** Type coercion info */
  coercion?: {
    kind: string;
    sourceType: ILType;
    targetType: ILType;
  };
  
  /** 6502-specific hints */
  m6502Hints?: {
    preferredRegister?: 'A' | 'X' | 'Y';
    zeroPagePriority?: number;
  };
  
  /** Additional custom metadata */
  [key: string]: unknown;
}

/**
 * Base class for all IL instructions
 */
export abstract class ILInstruction {
  /** Unique instruction ID within function */
  public readonly id: number;
  
  /** Opcode */
  public readonly opcode: ILOpcode;
  
  /** Result register (null for void instructions) */
  public readonly result: VirtualRegister | null;
  
  /** Metadata from semantic analysis */
  public readonly metadata: ILMetadata;

  constructor(
    id: number,
    opcode: ILOpcode,
    result: VirtualRegister | null,
    metadata: ILMetadata = {},
  ) {
    this.id = id;
    this.opcode = opcode;
    this.result = result;
    this.metadata = metadata;
  }

  /** Get all operand values */
  abstract getOperands(): ILValue[];

  /** Get all registers used by this instruction */
  abstract getUsedRegisters(): VirtualRegister[];

  /** Pretty print for debugging */
  abstract toString(): string;
}
```

**Time**: 1.5 hours

**Tests**: 10 tests (instruction creation, metadata handling)

---

### Task 1.6: Define Concrete Instruction Classes (Arithmetic/Logic)

**File**: `packages/compiler/src/il/instructions.ts` (Part 3 - append)

**Content**:
```typescript
/**
 * Binary arithmetic/logic instruction
 * Result = Left op Right
 */
export class ILBinaryInstruction extends ILInstruction {
  constructor(
    id: number,
    opcode: ILOpcode,
    public readonly left: VirtualRegister,
    public readonly right: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, opcode, result, metadata);
  }

  getOperands(): ILValue[] {
    return [this.left, this.right];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [this.left, this.right];
  }

  toString(): string {
    return `${this.result} = ${this.opcode} ${this.left}, ${this.right}`;
  }
}

/**
 * Unary instruction
 * Result = op Operand
 */
export class ILUnaryInstruction extends ILInstruction {
  constructor(
    id: number,
    opcode: ILOpcode,
    public readonly operand: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, opcode, result, metadata);
  }

  getOperands(): ILValue[] {
    return [this.operand];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [this.operand];
  }

  toString(): string {
    return `${this.result} = ${this.opcode} ${this.operand}`;
  }
}

/**
 * Constant load instruction
 */
export class ILConstInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly value: number,
    public readonly type: ILType,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.CONST, result, metadata);
  }

  getOperands(): ILValue[] {
    return [];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  toString(): string {
    return `${this.result} = CONST ${this.value}`;
  }
}
```

**Time**: 2 hours

**Tests**: 20 tests (binary, unary, const instructions)

---

### Task 1.7: Define Control Flow Instructions

**File**: `packages/compiler/src/il/instructions.ts` (Part 4 - append)

**Content**:
```typescript
/**
 * Unconditional jump
 */
export class ILJumpInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly target: ILLabel,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.JUMP, null, metadata);
  }

  getOperands(): ILValue[] {
    return [this.target];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  toString(): string {
    return `JUMP ${this.target.name}`;
  }
}

/**
 * Conditional branch
 */
export class ILBranchInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly condition: VirtualRegister,
    public readonly thenTarget: ILLabel,
    public readonly elseTarget: ILLabel,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.BRANCH, null, metadata);
  }

  getOperands(): ILValue[] {
    return [this.condition, this.thenTarget, this.elseTarget];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [this.condition];
  }

  toString(): string {
    return `BRANCH ${this.condition}, ${this.thenTarget.name}, ${this.elseTarget.name}`;
  }
}

/**
 * Return with value
 */
export class ILReturnInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.RETURN, null, metadata);
  }

  getOperands(): ILValue[] {
    return [this.value];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [this.value];
  }

  toString(): string {
    return `RETURN ${this.value}`;
  }
}

/**
 * Return void
 */
export class ILReturnVoidInstruction extends ILInstruction {
  constructor(
    id: number,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.RETURN_VOID, null, metadata);
  }

  getOperands(): ILValue[] {
    return [];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  toString(): string {
    return 'RETURN_VOID';
  }
}
```

**Time**: 1.5 hours

**Tests**: 15 tests (jump, branch, return instructions)

---

### Task 1.8: Define Memory & Call Instructions

**File**: `packages/compiler/src/il/instructions.ts` (Part 5 - append)

**Content**:
```typescript
/**
 * Load from variable
 */
export class ILLoadVarInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly variableName: string,
    public readonly variableType: ILType,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.LOAD_VAR, result, metadata);
  }

  getOperands(): ILValue[] {
    return [];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  toString(): string {
    return `${this.result} = LOAD_VAR ${this.variableName}`;
  }
}

/**
 * Store to variable
 */
export class ILStoreVarInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly variableName: string,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.STORE_VAR, null, metadata);
  }

  getOperands(): ILValue[] {
    return [this.value];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [this.value];
  }

  toString(): string {
    return `STORE_VAR ${this.variableName}, ${this.value}`;
  }
}

/**
 * Function call with return value
 */
export class ILCallInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly functionName: string,
    public readonly arguments: VirtualRegister[],
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.CALL, result, metadata);
  }

  getOperands(): ILValue[] {
    return [...this.arguments];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [...this.arguments];
  }

  toString(): string {
    const args = this.arguments.map(a => a.toString()).join(', ');
    return `${this.result} = CALL ${this.functionName}(${args})`;
  }
}

/**
 * Function call without return value
 */
export class ILCallVoidInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly functionName: string,
    public readonly arguments: VirtualRegister[],
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.CALL_VOID, null, metadata);
  }

  getOperands(): ILValue[] {
    return [...this.arguments];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [...this.arguments];
  }

  toString(): string {
    const args = this.arguments.map(a => a.toString()).join(', ');
    return `CALL_VOID ${this.functionName}(${args})`;
  }
}

/**
 * PHI function for SSA
 */
export class ILPhiInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly sources: Array<{
      value: VirtualRegister;
      fromBlock: ILLabel;
    }>,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.PHI, result, metadata);
  }

  getOperands(): ILValue[] {
    return this.sources.flatMap(s => [s.value, s.fromBlock]);
  }

  getUsedRegisters(): VirtualRegister[] {
    return this.sources.map(s => s.value);
  }

  toString(): string {
    const sources = this.sources
      .map(s => `[${s.value}, ${s.fromBlock.name}]`)
      .join(', ');
    return `${this.result} = PHI ${sources}`;
  }
}
```

**Time**: 2 hours

**Tests**: 25 tests (load, store, call, phi instructions)

---

### Phase 1 Summary

| Task | Description | Time | Tests |
|------|-------------|------|-------|
| 1.1 | Create directory structure | 15 min | 0 |
| 1.2 | Define IL type system | 1 hr | 10 |
| 1.3 | Define virtual registers & values | 1.5 hr | 15 |
| 1.4 | Define IL opcode enum | 45 min | 5 |
| 1.5 | Define instruction base classes | 1.5 hr | 10 |
| 1.6 | Define arithmetic/logic instructions | 2 hr | 20 |
| 1.7 | Define control flow instructions | 1.5 hr | 15 |
| 1.8 | Define memory & call instructions | 2 hr | 25 |
| **Total** | | **10.5 hr** | **100** |

---

## Phase 2: Basic Block & CFG Infrastructure (2-3 days)

### Overview

This phase creates the basic block and control flow graph structures that organize IL instructions.

---

### Task 2.1: Define Basic Block Class

**File**: `packages/compiler/src/il/basic-block.ts`

**Content**:
```typescript
import type { ILInstruction } from './instructions.js';
import type { ILLabel } from './values.js';

/**
 * A basic block is a sequence of instructions with:
 * - Single entry point (first instruction)
 * - Single exit point (last instruction - jump/branch/return)
 * - No branches except at the end
 */
export class ILBasicBlock {
  /** Unique block ID */
  public readonly id: number;
  
  /** Block label */
  public readonly label: ILLabel;
  
  /** Instructions in this block */
  protected instructions: ILInstruction[] = [];
  
  /** Predecessor blocks (blocks that jump to this one) */
  protected predecessors: ILBasicBlock[] = [];
  
  /** Successor blocks (blocks this one jumps to) */
  protected successors: ILBasicBlock[] = [];

  constructor(id: number, name: string) {
    this.id = id;
    this.label = { kind: 'label', name, blockId: id };
  }

  // Instruction management
  addInstruction(instr: ILInstruction): void { ... }
  getInstructions(): readonly ILInstruction[] { ... }
  getTerminator(): ILInstruction | null { ... }
  
  // CFG navigation
  addPredecessor(block: ILBasicBlock): void { ... }
  addSuccessor(block: ILBasicBlock): void { ... }
  getPredecessors(): readonly ILBasicBlock[] { ... }
  getSuccessors(): readonly ILBasicBlock[] { ... }
  
  // Utilities
  isEmpty(): boolean { ... }
  isTerminated(): boolean { ... }
  toString(): string { ... }
}
```

**Time**: 1.5 hours

**Tests**: 20 tests (block creation, instruction add, CFG navigation)

---

### Task 2.2: Define IL Function Class

**File**: `packages/compiler/src/il/function.ts`

**Content**:
```typescript
import type { ILBasicBlock } from './basic-block.js';
import type { ILType } from './types.js';
import type { VirtualRegister } from './values.js';

/**
 * Represents a function in IL
 */
export class ILFunction {
  /** Function name */
  public readonly name: string;
  
  /** Return type */
  public readonly returnType: ILType;
  
  /** Parameters with their registers */
  public readonly parameters: Array<{
    name: string;
    type: ILType;
    register: VirtualRegister;
  }>;
  
  /** Basic blocks (first is entry) */
  protected blocks: ILBasicBlock[] = [];
  
  /** Entry block */
  protected entryBlock: ILBasicBlock | null = null;
  
  /** Exit blocks (blocks with return) */
  protected exitBlocks: ILBasicBlock[] = [];
  
  /** Is this a stub/intrinsic function? */
  public readonly isIntrinsic: boolean;

  constructor(
    name: string,
    returnType: ILType,
    parameters: Array<{ name: string; type: ILType; register: VirtualRegister }>,
    isIntrinsic: boolean = false,
  ) { ... }

  // Block management
  createBlock(name: string): ILBasicBlock { ... }
  getEntryBlock(): ILBasicBlock { ... }
  getBlocks(): readonly ILBasicBlock[] { ... }
  getExitBlocks(): readonly ILBasicBlock[] { ... }
  
  // Analysis helpers
  computeDominators(): Map<ILBasicBlock, Set<ILBasicBlock>> { ... }
  computePostOrder(): ILBasicBlock[] { ... }
  
  // Validation
  validate(): string[] { ... }
  
  // Debug
  toString(): string { ... }
}
```

**Time**: 2 hours

**Tests**: 25 tests (function creation, block management, CFG analysis)

---

### Task 2.3: Define IL Module Class

**File**: `packages/compiler/src/il/module.ts`

**Content**:
```typescript
import type { ILFunction } from './function.js';
import type { ILType } from './types.js';

/**
 * Global variable in IL
 */
export interface ILGlobalVariable {
  name: string;
  type: ILType;
  storageClass: 'zp' | 'ram' | 'data' | 'map';
  address?: number;  // For @map variables
  initialValue?: number | number[];
}

/**
 * Represents a complete IL module (corresponds to source module)
 */
export class ILModule {
  /** Module name */
  public readonly name: string;
  
  /** Functions in this module */
  protected functions: Map<string, ILFunction> = new Map();
  
  /** Global variables */
  protected globals: Map<string, ILGlobalVariable> = new Map();
  
  /** Imported functions (from other modules) */
  protected imports: Set<string> = new Set();
  
  /** Exported functions */
  protected exports: Set<string> = new Set();

  constructor(name: string) { ... }

  // Function management
  addFunction(func: ILFunction): void { ... }
  getFunction(name: string): ILFunction | undefined { ... }
  getFunctions(): Iterable<ILFunction> { ... }
  
  // Global variable management
  addGlobal(global: ILGlobalVariable): void { ... }
  getGlobal(name: string): ILGlobalVariable | undefined { ... }
  getGlobals(): Iterable<ILGlobalVariable> { ... }
  
  // Import/export
  addImport(name: string): void { ... }
  addExport(name: string): void { ... }
  
  // Validation
  validate(): string[] { ... }
  
  // Debug
  toString(): string { ... }
}
```

**Time**: 1.5 hours

**Tests**: 20 tests (module creation, function/global management)

---

### Task 2.4: Create IL Builder Helper

**File**: `packages/compiler/src/il/builder.ts`

**Content**:
```typescript
import type { ILBasicBlock } from './basic-block.js';
import type { ILFunction } from './function.js';
import type { ILType } from './types.js';
import type { VirtualRegister, ILLabel } from './values.js';
import { ILValueFactory } from './values.js';
import * as Instr from './instructions.js';

/**
 * Helper class for building IL instructions
 * Provides fluent API for common patterns
 */
export class ILBuilder {
  protected currentFunction: ILFunction | null = null;
  protected currentBlock: ILBasicBlock | null = null;
  protected valueFactory = new ILValueFactory();
  protected nextInstructionId = 0;

  // Setup
  setFunction(func: ILFunction): this { ... }
  setBlock(block: ILBasicBlock): this { ... }
  
  // Value creation
  createRegister(type: ILType, name?: string): VirtualRegister { ... }
  
  // Instruction emission - returns result register
  emitConst(value: number, type: ILType): VirtualRegister { ... }
  emitAdd(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitSub(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitMul(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitDiv(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitMod(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitNeg(operand: VirtualRegister): VirtualRegister { ... }
  
  emitAnd(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitOr(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitXor(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitNot(operand: VirtualRegister): VirtualRegister { ... }
  emitShl(value: VirtualRegister, amount: VirtualRegister): VirtualRegister { ... }
  emitShr(value: VirtualRegister, amount: VirtualRegister): VirtualRegister { ... }
  
  emitCmpEq(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitCmpNe(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitCmpLt(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitCmpLe(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitCmpGt(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  emitCmpGe(left: VirtualRegister, right: VirtualRegister): VirtualRegister { ... }
  
  emitLoadVar(name: string, type: ILType): VirtualRegister { ... }
  emitStoreVar(name: string, value: VirtualRegister): void { ... }
  
  emitCall(funcName: string, args: VirtualRegister[], returnType: ILType): VirtualRegister { ... }
  emitCallVoid(funcName: string, args: VirtualRegister[]): void { ... }
  
  emitJump(target: ILLabel): void { ... }
  emitBranch(cond: VirtualRegister, thenLabel: ILLabel, elseLabel: ILLabel): void { ... }
  emitReturn(value: VirtualRegister): void { ... }
  emitReturnVoid(): void { ... }
  
  // Type conversions
  emitZeroExtend(value: VirtualRegister, targetType: ILType): VirtualRegister { ... }
  emitTruncate(value: VirtualRegister, targetType: ILType): VirtualRegister { ... }
}
```

**Time**: 2.5 hours

**Tests**: 30 tests (all emit methods, builder state)

---

### Task 2.5: Create IL Printer (Debug Output)

**File**: `packages/compiler/src/il/printer.ts`

**Content**:
```typescript
import type { ILModule } from './module.js';
import type { ILFunction } from './function.js';
import type { ILBasicBlock } from './basic-block.js';

/**
 * Pretty-prints IL for debugging and testing
 */
export class ILPrinter {
  protected indentLevel = 0;
  protected output: string[] = [];

  printModule(module: ILModule): string { ... }
  printFunction(func: ILFunction): string { ... }
  printBlock(block: ILBasicBlock): string { ... }
  
  protected indent(): string { ... }
  protected emit(line: string): void { ... }
}

// Convenience function
export function printIL(module: ILModule): string {
  return new ILPrinter().printModule(module);
}
```

**Time**: 1 hour

**Tests**: 10 tests (print various IL constructs)

---

### Task 2.6: Create IL Validator

**File**: `packages/compiler/src/il/validator.ts`

**Content**:
```typescript
import type { ILModule } from './module.js';
import type { ILFunction } from './function.js';

/**
 * Validates IL for correctness
 * Catches errors before code generation
 */
export class ILValidator {
  protected errors: string[] = [];

  validate(module: ILModule): string[] {
    this.errors = [];
    this.validateModule(module);
    return this.errors;
  }

  protected validateModule(module: ILModule): void { ... }
  protected validateFunction(func: ILFunction): void { ... }
  protected validateBlock(block: ILBasicBlock): void { ... }
  protected validateInstruction(instr: ILInstruction): void { ... }
  
  // Specific validations
  protected checkTypes(): void { ... }
  protected checkCFG(): void { ... }
  protected checkSSA(): void { ... }
  protected checkTerminators(): void { ... }
}
```

**Time**: 1.5 hours

**Tests**: 20 tests (valid/invalid IL detection)

---

### Phase 2 Summary

| Task | Description | Time | Tests |
|------|-------------|------|-------|
| 2.1 | Define BasicBlock class | 1.5 hr | 20 |
| 2.2 | Define ILFunction class | 2 hr | 25 |
| 2.3 | Define ILModule class | 1.5 hr | 20 |
| 2.4 | Create ILBuilder helper | 2.5 hr | 30 |
| 2.5 | Create ILPrinter | 1 hr | 10 |
| 2.6 | Create ILValidator | 1.5 hr | 20 |
| **Total** | | **10 hr** | **125** |

---

## Phase 3: IL Generator Core (4-5 days)

### Overview

This phase creates the main IL generator that traverses the AST and produces IL.

---

### Task 3.1: Create IL Generator Base Class

**File**: `packages/compiler/src/il/generator/base.ts`

**Content**:
```typescript
import type { Program } from '../../ast/nodes.js';
import type { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';
import type { TypeSystem } from '../../semantic/type-system.js';
import type { TargetConfig } from '../../target/config.js';
import type { ILModule } from '../module.js';
import type { ILFunction } from '../function.js';
import type { ILBasicBlock } from '../basic-block.js';
import type { ILType } from '../types.js';
import type { VirtualRegister } from '../values.js';
import { ILBuilder } from '../builder.js';

/**
 * Base class for IL generation
 * Provides infrastructure and utilities
 */
export abstract class ILGeneratorBase {
  /** The AST program to compile */
  protected readonly ast: Program;
  
  /** Symbol table with all resolved symbols */
  protected readonly symbolTable: GlobalSymbolTable;
  
  /** Type system for type queries */
  protected readonly typeSystem: TypeSystem;
  
  /** Target configuration */
  protected readonly targetConfig: TargetConfig;
  
  /** IL builder for emitting instructions */
  protected readonly builder: ILBuilder;
  
  /** Current IL module being built */
  protected currentModule: ILModule | null = null;
  
  /** Current function being compiled */
  protected currentFunction: ILFunction | null = null;
  
  /** Current basic block */
  protected currentBlock: ILBasicBlock | null = null;
  
  /** Map of variable names to their current SSA register */
  protected variableRegisters: Map<string, VirtualRegister> = new Map();
  
  /** Map of labels for control flow */
  protected labelMap: Map<string, ILLabel> = new Map();

  constructor(
    ast: Program,
    symbolTable: GlobalSymbolTable,
    typeSystem: TypeSystem,
    targetConfig: TargetConfig,
  ) {
    this.ast = ast;
    this.symbolTable = symbolTable;
    this.typeSystem = typeSystem;
    this.targetConfig = targetConfig;
    this.builder = new ILBuilder();
  }

  // Utility methods
  protected convertType(astType: TypeInfo): ILType { ... }
  protected getVariableRegister(name: string): VirtualRegister { ... }
  protected setVariableRegister(name: string, reg: VirtualRegister): void { ... }
  protected createLabel(name: string): ILLabel { ... }
  protected getLabel(name: string): ILLabel { ... }
  
  // Abstract methods for subclasses
  abstract generate(): ILModule;
}
```

**Time**: 2 hours

**Tests**: 15 tests (base functionality)

---

### Task 3.2: Create Module Generation Layer

**File**: `packages/compiler/src/il/generator/modules.ts`

**Content**:
```typescript
import { ILGeneratorBase } from './base.js';
import type { Program, ModuleDecl, ImportDecl, FunctionDecl, VariableDecl } from '../../ast/nodes.js';
import type { ILModule } from '../module.js';

/**
 * Handles module-level IL generation
 */
export abstract class ILModuleGenerator extends ILGeneratorBase {
  
  /**
   * Generate IL for the entire program
   */
  generate(): ILModule {
    const moduleName = this.ast.getModuleName() || 'main';
    this.currentModule = new ILModule(moduleName);
    
    // Process imports
    this.processImports();
    
    // Process global variables
    this.processGlobalVariables();
    
    // Process functions
    this.processFunctions();
    
    // Process exports
    this.processExports();
    
    return this.currentModule;
  }

  protected processImports(): void { ... }
  protected processGlobalVariables(): void { ... }
  protected processFunctions(): void { ... }
  protected processExports(): void { ... }
  
  // Abstract: subclass handles function body generation
  protected abstract generateFunctionBody(decl: FunctionDecl): void;
}
```

**Time**: 2 hours

**Tests**: 20 tests (module generation, imports, exports)

---

### Task 3.3: Create Declaration Generation Layer

**File**: `packages/compiler/src/il/generator/declarations.ts`

**Content**:
```typescript
import { ILModuleGenerator } from './modules.js';
import type { FunctionDecl, VariableDecl, Parameter } from '../../ast/nodes.js';
import type { ILFunction } from '../function.js';

/**
 * Handles declaration-level IL generation
 */
export abstract class ILDeclarationGenerator extends ILModuleGenerator {
  
  /**
   * Generate IL for a function declaration
   */
  protected generateFunction(decl: FunctionDecl): void {
    // Check for stub/intrinsic function
    if (!decl.getBody()) {
      this.registerIntrinsic(decl);
      return;
    }
    
    // Create IL function
    const returnType = this.convertType(decl.getReturnType());
    const params = this.generateParameters(decl);
    const ilFunc = new ILFunction(decl.getName(), returnType, params);
    
    // Set up context
    this.currentFunction = ilFunc;
    this.builder.setFunction(ilFunc);
    this.variableRegisters.clear();
    
    // Create entry block
    const entryBlock = ilFunc.createBlock('entry');
    this.builder.setBlock(entryBlock);
    this.currentBlock = entryBlock;
    
    // Initialize parameter registers
    for (const param of params) {
      this.variableRegisters.set(param.name, param.register);
    }
    
    // Generate function body
    this.generateFunctionBody(decl);
    
    // Add to module
    this.currentModule!.addFunction(ilFunc);
    this.currentFunction = null;
  }

  protected generateParameters(decl: FunctionDecl): Array<...> { ... }
  protected generateLocalVariable(decl: VariableDecl): void { ... }
  protected registerIntrinsic(decl: FunctionDecl): void { ... }
  
  // Abstract: subclass handles statements
  protected abstract generateStatement(stmt: Statement): void;
}
```

**Time**: 2.5 hours

**Tests**: 25 tests (function generation, parameters, locals)

---

### Task 3.4: Create Statement Generation Layer

**File**: `packages/compiler/src/il/generator/statements.ts`

**Content**:
```typescript
import { ILDeclarationGenerator } from './declarations.js';
import type { Statement, IfStatement, WhileStatement, ForStatement, ReturnStatement, BlockStatement } from '../../ast/nodes.js';

/**
 * Handles statement-level IL generation
 */
export abstract class ILStatementGenerator extends ILDeclarationGenerator {
  
  /**
   * Generate IL for a statement
   */
  protected generateStatement(stmt: Statement): void {
    if (isVariableDecl(stmt)) {
      this.generateLocalVariable(stmt);
    } else if (isIfStatement(stmt)) {
      this.generateIfStatement(stmt);
    } else if (isWhileStatement(stmt)) {
      this.generateWhileStatement(stmt);
    } else if (isForStatement(stmt)) {
      this.generateForStatement(stmt);
    } else if (isReturnStatement(stmt)) {
      this.generateReturnStatement(stmt);
    } else if (isExpressionStatement(stmt)) {
      this.generateExpressionStatement(stmt);
    } else if (isBlockStatement(stmt)) {
      this.generateBlockStatement(stmt);
    } else if (isBreakStatement(stmt)) {
      this.generateBreakStatement(stmt);
    } else if (isContinueStatement(stmt)) {
      this.generateContinueStatement(stmt);
    }
  }

  protected generateIfStatement(stmt: IfStatement): void { ... }
  protected generateWhileStatement(stmt: WhileStatement): void { ... }
  protected generateForStatement(stmt: ForStatement): void { ... }
  protected generateReturnStatement(stmt: ReturnStatement): void { ... }
  protected generateBlockStatement(stmt: BlockStatement): void { ... }
  protected generateBreakStatement(stmt: BreakStatement): void { ... }
  protected generateContinueStatement(stmt: ContinueStatement): void { ... }
  protected generateExpressionStatement(stmt: ExpressionStatement): void { ... }
  
  // Loop context for break/continue
  protected loopStack: Array<{ breakLabel: ILLabel; continueLabel: ILLabel }> = [];
  protected pushLoop(breakLabel: ILLabel, continueLabel: ILLabel): void { ... }
  protected popLoop(): void { ... }
  
  // Abstract: subclass handles expressions
  protected abstract generateExpression(expr: Expression): VirtualRegister;
}
```

**Time**: 3 hours

**Tests**: 35 tests (all statement types)

---

### Task 3.5: Implement If Statement Generation

**File**: `packages/compiler/src/il/generator/statements.ts` (implement method)

**Details**:
```typescript
protected generateIfStatement(stmt: IfStatement): void {
  // Create labels
  const thenLabel = this.createLabel('if_then');
  const elseLabel = this.createLabel('if_else');
  const endLabel = this.createLabel('if_end');
  
  // Generate condition
  const condReg = this.generateExpression(stmt.getCondition());
  
  // Branch based on condition
  const hasElse = stmt.getElseBody() !== null;
  this.builder.emitBranch(
    condReg,
    thenLabel,
    hasElse ? elseLabel : endLabel
  );
  
  // Generate then block
  const thenBlock = this.currentFunction!.createBlock(thenLabel.name);
  this.builder.setBlock(thenBlock);
  this.currentBlock = thenBlock;
  this.generateStatement(stmt.getThenBody());
  
  if (!this.currentBlock!.isTerminated()) {
    this.builder.emitJump(endLabel);
  }
  
  // Generate else block (if present)
  if (hasElse) {
    const elseBlock = this.currentFunction!.createBlock(elseLabel.name);
    this.builder.setBlock(elseBlock);
    this.currentBlock = elseBlock;
    this.generateStatement(stmt.getElseBody()!);
    
    if (!this.currentBlock!.isTerminated()) {
      this.builder.emitJump(endLabel);
    }
  }
  
  // Create end block
  const endBlock = this.currentFunction!.createBlock(endLabel.name);
  this.builder.setBlock(endBlock);
  this.currentBlock = endBlock;
}
```

**Time**: 1.5 hours

**Tests**: 15 tests (if/else variants)

---

### Task 3.6: Implement While Statement Generation

**Implementation details for while loops with break/continue support**

**Time**: 1.5 hours

**Tests**: 15 tests (while loops, break, continue)

---

### Task 3.7: Implement For Statement Generation (ENHANCED v2.0)

**Lowering Strategy Decision: FOR → WHILE**

Blend65 `for` loops are lowered to `while` loop patterns in IL. This enables standard loop optimizations to apply automatically.

**Source Code:**
```js
for i = 0 to 9
  body
next i
```

**Lowered IL (equivalent to while):**
```
; Initialize
i.0 = CONST 0

; Loop header
LABEL for_header
t1 = CMP_LE i.0, 9
BRANCH t1, for_body, for_end

; Loop body
LABEL for_body
... body instructions ...

; Increment
i.1 = ADD i.0, 1
i.0 = PHI [i.0, entry], [i.1, for_body]  ; SSA form
JUMP for_header

; Exit
LABEL for_end
```

**Why Lower to While (Not Dedicated FOR IL)?**

1. **Optimizer Benefits**: Standard loop optimizations apply directly
   - Loop-invariant code motion
   - Strength reduction
   - Loop unrolling
   
2. **Code Generator Benefits**: Same patterns as while loops
   - No special-case handling
   - Reuse existing code
   
3. **6502 Optimization Opportunity**: If loop count < 256:
   ```asm
   ; Can use X or Y register for counter
   LDX #$00       ; i = 0
   loop:
   ; ... body ...
   INX            ; i++
   CPX #$0A       ; i <= 9?
   BCC loop       ; Branch if carry clear
   ```
   This is detected via `loopDepth` and `estimatedCycles` metadata.

**Step Values (`step` keyword):**
```js
for i = 0 to 100 step 5
  // ...
next i
```

Lowers to:
```
i.0 = CONST 0
LABEL for_header
t1 = CMP_LE i.0, 100
BRANCH t1, for_body, for_end
LABEL for_body
... body ...
i.1 = ADD i.0, 5     ; step value here
JUMP for_header
LABEL for_end
```

**Loop Metadata Added:**
```typescript
// All loop instructions get this metadata
metadata: {
  loopDepth: 1,
  isLoopHeader: true,    // for for_header block
  isLoopLatch: true,     // for increment block
  loopTripCount?: 10,    // if statically known
  loopCounterRegister?: 'X',  // 6502 hint
}
```

**Time**: 2 hours (expanded from 1.5 hours for lowering strategy)

**Tests**: 20 tests (for loops, step values, nested loops, 6502 register hints)

---

### Task 3.8: Implement Return Statement Generation

**Implementation details for return statements**

**Time**: 45 minutes

**Tests**: 10 tests (return value, return void)

---

### Task 3.9: Create Main IL Generator Class

**File**: `packages/compiler/src/il/generator/generator.ts`

**Content**:
```typescript
import { ILExpressionGenerator } from './expressions.js';

/**
 * Main IL Generator - final concrete class
 * Inherits: Base → Modules → Declarations → Statements → Expressions → Generator
 */
export class ILGenerator extends ILExpressionGenerator {
  // All functionality inherited from parent classes
  // This is the public API entry point
}

// Factory function
export function generateIL(
  ast: Program,
  symbolTable: GlobalSymbolTable,
  typeSystem: TypeSystem,
  targetConfig: TargetConfig,
): ILModule {
  const generator = new ILGenerator(ast, symbolTable, typeSystem, targetConfig);
  return generator.generate();
}
```

**Time**: 30 minutes

**Tests**: 10 tests (end-to-end generation)

---

### Task 3.10: Update IL Index Exports

**File**: `packages/compiler/src/il/index.ts`

Export all public types and classes.

**Time**: 15 minutes

**Tests**: None (infrastructure)

---

### Phase 3 Summary

| Task | Description | Time | Tests |
|------|-------------|------|-------|
| 3.1 | IL Generator base class | 2 hr | 15 |
| 3.2 | Module generation layer | 2 hr | 20 |
| 3.3 | Declaration generation layer | 2.5 hr | 25 |
| 3.4 | Statement generation layer | 3 hr | 35 |
| 3.5 | If statement generation | 1.5 hr | 15 |
| 3.6 | While statement generation | 1.5 hr | 15 |
| 3.7 | For statement generation | 1.5 hr | 15 |
| 3.8 | Return statement generation | 45 min | 10 |
| 3.9 | Main ILGenerator class | 30 min | 10 |
| 3.10 | Update exports | 15 min | 0 |
| **Total** | | **15.5 hr** | **160** |

---

## Phase 4: Expression Translation (4-5 days)

### Overview

This phase implements expression translation from AST to IL with type coercion insertion.

---

### Task 4.1: Create Expression Generation Layer

**File**: `packages/compiler/src/il/generator/expressions.ts`

**Content**:
```typescript
import { ILStatementGenerator } from './statements.js';
import type { Expression, BinaryExpression, UnaryExpression, CallExpression } from '../../ast/nodes.js';

/**
 * Handles expression-level IL generation
 */
export class ILExpressionGenerator extends ILStatementGenerator {
  
  protected generateExpression(expr: Expression): VirtualRegister {
    // Check for type coercion needed (from semantic analysis)
    const coercionKind = expr.getMetadata(TypeCoercionRequired);
    
    // Generate base expression
    const result = this.generateExpressionCore(expr);
    
    // Insert type coercion if needed
    if (coercionKind && coercionKind !== 'None') {
      return this.insertCoercion(result, coercionKind, expr);
    }
    
    return result;
  }

  protected generateExpressionCore(expr: Expression): VirtualRegister {
    if (isLiteralExpression(expr)) {
      return this.generateLiteral(expr);
    } else if (isIdentifierExpression(expr)) {
      return this.generateIdentifier(expr);
    } else if (isBinaryExpression(expr)) {
      return this.generateBinary(expr);
    } else if (isUnaryExpression(expr)) {
      return this.generateUnary(expr);
    } else if (isCallExpression(expr)) {
      return this.generateCall(expr);
    } else if (isIndexExpression(expr)) {
      return this.generateIndex(expr);
    } else if (isMemberExpression(expr)) {
      return this.generateMember(expr);
    } else if (isAssignmentExpression(expr)) {
      return this.generateAssignment(expr);
    }
    throw new Error(`Unknown expression type: ${expr.constructor.name}`);
  }
}
```

**Time**: 2 hours

**Tests**: 20 tests (expression dispatch)

---

### Task 4.2: Implement Literal Expression Generation

**Time**: 1 hour

**Tests**: 15 tests (numbers, booleans, strings)

---

### Task 4.3: Implement Identifier Expression Generation

**Time**: 45 minutes

**Tests**: 10 tests (variable reads)

---

### Task 4.4: Implement Binary Expression Generation

**Time**: 2 hours

**Tests**: 25 tests (all operators)

---

### Task 4.5: Implement Unary Expression Generation

**Time**: 1 hour

**Tests**: 15 tests (negation, not, address-of)

---

### Task 4.6: Implement Call Expression Generation

**Time**: 1.5 hours

**Tests**: 20 tests (function calls, intrinsic detection)

---

### Task 4.7: Implement Index Expression Generation (Arrays)

**Time**: 1.5 hours

**Tests**: 15 tests (array access)

---

### Task 4.8: Implement Assignment Expression Generation

**Time**: 1.5 hours

**Tests**: 15 tests (simple, compound assignments)

---

### Task 4.9: Implement Type Coercion Insertion

**Time**: 1.5 hours

**Tests**: 20 tests (all coercion types)

---

### Task 4.10: Implement Short-Circuit Logical Operators

**Time**: 1.5 hours

**Tests**: 15 tests (&&, ||)

---

### Phase 4 Summary

| Task | Description | Time | Tests |
|------|-------------|------|-------|
| 4.1 | Expression generation layer | 2 hr | 20 |
| 4.2 | Literal expressions | 1 hr | 15 |
| 4.3 | Identifier expressions | 45 min | 10 |
| 4.4 | Binary expressions | 2 hr | 25 |
| 4.5 | Unary expressions | 1 hr | 15 |
| 4.6 | Call expressions | 1.5 hr | 20 |
| 4.7 | Index expressions | 1.5 hr | 15 |
| 4.8 | Assignment expressions | 1.5 hr | 15 |
| 4.9 | Type coercion insertion | 1.5 hr | 20 |
| 4.10 | Short-circuit operators | 1.5 hr | 15 |
| **Total** | | **14.25 hr** | **170** |

---

## Phase 5: Intrinsics & Special Handling (3-4 days)

### Overview

This phase implements intrinsic function handling and @map access.

---

### Task 5.1: Create Intrinsic Registry

**File**: `packages/compiler/src/il/intrinsics/registry.ts`

**Content**:
```typescript
export interface IntrinsicInfo {
  name: string;
  intrinsicId: string;
  category: 'memory' | 'type' | 'array';
  isCompileTime: boolean;
  parameterTypes: ILType[];
  returnType: ILType;
  generator: (args: VirtualRegister[], builder: ILBuilder) => VirtualRegister | void;
}

export class IntrinsicRegistry {
  protected intrinsics = new Map<string, IntrinsicInfo>();

  constructor() {
    this.registerBuiltIns();
  }

  protected registerBuiltIns(): void {
    // peek(address: word): byte
    this.register({
      name: 'peek',
      intrinsicId: 'intrinsic_peek',
      category: 'memory',
      isCompileTime: false,
      parameterTypes: [IL_WORD],
      returnType: IL_BYTE,
      generator: (args, builder) => builder.emitIntrinsicPeek(args[0]),
    });

    // poke(address: word, value: byte): void
    this.register({
      name: 'poke',
      intrinsicId: 'intrinsic_poke',
      ...
    });

    // sizeof(type): byte - COMPILE TIME
    this.register({
      name: 'sizeof',
      intrinsicId: 'intrinsic_sizeof',
      category: 'type',
      isCompileTime: true,
      ...
    });
  }
}
```

**Time**: 2 hours

**Tests**: 15 tests (registry, lookup)

---

### Task 5.2: Implement peek/poke Intrinsics

**Time**: 1.5 hours

**Tests**: 20 tests (memory access patterns)

---

### Task 5.3: Implement peekw/pokew Intrinsics

**Time**: 1 hour

**Tests**: 10 tests (word access)

---

### Task 5.4: Implement sizeof Intrinsic (Compile-Time)

**Time**: 1.5 hours

**Tests**: 15 tests (type sizes)

---

### Task 5.5: Implement length Intrinsic

**Time**: 1 hour

**Tests**: 10 tests (arrays, strings)

---

### Task 5.6: Implement @map Variable Access

**Time**: 2 hours

**Tests**: 20 tests (hardware registers)

---

### Task 5.7: Implement Storage Class Handling (@zp, @ram, @data)

**Time**: 1.5 hours

**Tests**: 15 tests (storage classes)

---

### Task 5.8: Add Metadata Passthrough for Hardware Hints

**Time**: 1 hour

**Tests**: 10 tests (VIC-II, SID metadata)

---

### Task 5.9: Implement @map Struct IL Instructions (NEW v2.0)

**File**: `packages/compiler/src/il/instructions.ts` (Part 6 - append)

**Content**:
```typescript
/**
 * Load from @map struct field
 * Provides structure-aware hardware access
 */
export class ILMapLoadFieldInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly structName: string,
    public readonly fieldName: string,
    public readonly fieldType: ILType,
    public readonly baseAddress: number,
    public readonly fieldOffset: number,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.MAP_LOAD_FIELD, result, {
      ...metadata,
      mapInfo: {
        structName,
        fieldName,
        baseAddress,
        fieldOffset,
        isRange: false,
      },
    });
  }

  getOperands(): ILValue[] { return []; }
  getUsedRegisters(): VirtualRegister[] { return []; }

  toString(): string {
    return `${this.result} = MAP_LOAD_FIELD ${this.structName}.${this.fieldName}`;
  }
}

/**
 * Store to @map struct field
 */
export class ILMapStoreFieldInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly structName: string,
    public readonly fieldName: string,
    public readonly value: VirtualRegister,
    public readonly baseAddress: number,
    public readonly fieldOffset: number,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.MAP_STORE_FIELD, null, {
      ...metadata,
      mapInfo: { structName, fieldName, baseAddress, fieldOffset, isRange: false },
    });
  }

  getOperands(): ILValue[] { return [this.value]; }
  getUsedRegisters(): VirtualRegister[] { return [this.value]; }

  toString(): string {
    return `MAP_STORE_FIELD ${this.structName}.${this.fieldName}, ${this.value}`;
  }
}

/**
 * Load from @map range (indexed access)
 */
export class ILMapLoadRangeInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly structName: string,
    public readonly index: VirtualRegister,
    public readonly rangeStart: number,
    public readonly rangeEnd: number,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.MAP_LOAD_RANGE, result, {
      ...metadata,
      mapInfo: { structName, baseAddress: rangeStart, isRange: true, rangeStart, rangeEnd },
    });
  }

  getOperands(): ILValue[] { return [this.index]; }
  getUsedRegisters(): VirtualRegister[] { return [this.index]; }

  toString(): string {
    return `${this.result} = MAP_LOAD_RANGE ${this.structName}[${this.index}]`;
  }
}

/**
 * Store to @map range (indexed access)
 */
export class ILMapStoreRangeInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly structName: string,
    public readonly index: VirtualRegister,
    public readonly value: VirtualRegister,
    public readonly rangeStart: number,
    public readonly rangeEnd: number,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.MAP_STORE_RANGE, null, {
      ...metadata,
      mapInfo: { structName, baseAddress: rangeStart, isRange: true, rangeStart, rangeEnd },
    });
  }

  getOperands(): ILValue[] { return [this.index, this.value]; }
  getUsedRegisters(): VirtualRegister[] { return [this.index, this.value]; }

  toString(): string {
    return `MAP_STORE_RANGE ${this.structName}[${this.index}], ${this.value}`;
  }
}
```

**Why This Matters for Optimizer:**
- Optimizer can identify related hardware accesses
- Can batch sequential field accesses when safe
- Knows which accesses can/cannot be reordered
- Better alias analysis (same struct = known layout)

**Why This Matters for Code Generator:**
- Pre-computed field offsets (no runtime calculation)
- Optimal addressing mode selection
- Better debug info (struct.field rather than raw address)

**Time**: 2 hours

**Tests**: 20 tests (@map field load/store, range access, all 4 @map forms)

---

### Task 5.10: Implement Optimization Barrier Instructions (NEW v2.0)

**File**: `packages/compiler/src/il/instructions.ts` (Part 7 - append)

**Content**:
```typescript
/**
 * Optimization barrier - prevents instruction reordering
 * Critical for C64 hardware timing
 */
export class ILOptBarrierInstruction extends ILInstruction {
  constructor(
    id: number,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.OPT_BARRIER, null, {
      ...metadata,
      rasterCritical: true,
    });
  }

  getOperands(): ILValue[] { return []; }
  getUsedRegisters(): VirtualRegister[] { return []; }

  toString(): string { return 'OPT_BARRIER'; }
}

/**
 * Volatile read - cannot be eliminated or reordered
 * Use for hardware status registers
 */
export class ILVolatileReadInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly address: number,
    public readonly type: ILType,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.VOLATILE_READ, result, {
      ...metadata,
      rasterCritical: true,
    });
  }

  getOperands(): ILValue[] { return []; }
  getUsedRegisters(): VirtualRegister[] { return []; }

  toString(): string {
    return `${this.result} = VOLATILE_READ $${this.address.toString(16).toUpperCase()}`;
  }
}

/**
 * Volatile write - cannot be eliminated or reordered
 * Use for hardware control registers
 */
export class ILVolatileWriteInstruction extends ILInstruction {
  constructor(
    id: number,
    public readonly address: number,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.VOLATILE_WRITE, null, {
      ...metadata,
      rasterCritical: true,
    });
  }

  getOperands(): ILValue[] { return [this.value]; }
  getUsedRegisters(): VirtualRegister[] { return [this.value]; }

  toString(): string {
    return `VOLATILE_WRITE $${this.address.toString(16).toUpperCase()}, ${this.value}`;
  }
}
```

**Usage in IL Builder:**
```typescript
// In ILBuilder class:
emitOptBarrier(): void {
  this.emit(new ILOptBarrierInstruction(this.nextId()));
}

emitVolatileRead(address: number, type: ILType): VirtualRegister {
  const result = this.createRegister(type);
  this.emit(new ILVolatileReadInstruction(this.nextId(), address, type, result));
  return result;
}

emitVolatileWrite(address: number, value: VirtualRegister): void {
  this.emit(new ILVolatileWriteInstruction(this.nextId(), address, value));
}
```

**When to Use:**
- VIC-II raster timing code
- SID register sequences that must not be reordered
- Any hardware timing-critical code
- Reading status registers (e.g., $D012 raster line)

**Time**: 1.5 hours

**Tests**: 15 tests (barrier placement, volatile read/write, timing-critical patterns)

---

### Phase 5 Summary (UPDATED v2.0)

| Task | Description | Time | Tests |
|------|-------------|------|-------|
| 5.1 | Intrinsic registry | 2 hr | 15 |
| 5.2 | peek/poke intrinsics | 1.5 hr | 20 |
| 5.3 | peekw/pokew intrinsics | 1 hr | 10 |
| 5.4 | sizeof intrinsic | 1.5 hr | 15 |
| 5.5 | length intrinsic | 1 hr | 10 |
| 5.6 | @map variable access | 2 hr | 20 |
| 5.7 | Storage class handling | 1.5 hr | 15 |
| 5.8 | Hardware hints passthrough | 1 hr | 10 |
| **5.9** | **@map struct IL instructions (NEW)** | **2 hr** | **20** |
| **5.10** | **Optimization barriers (NEW)** | **1.5 hr** | **15** |
| **Total** | | **15 hr** | **150** |

---

## Phase 6: SSA Construction (3-4 days)

### Overview

This phase converts IL to proper SSA form with phi functions.

---

### Task 6.1: Implement Dominator Tree Computation

**File**: `packages/compiler/src/il/ssa/dominators.ts`

**Time**: 2 hours

**Tests**: 15 tests (dominator computation)

---

### Task 6.2: Implement Dominance Frontier Computation

**Time**: 1.5 hours

**Tests**: 15 tests (dominance frontiers)

---

### Task 6.3: Implement Phi Function Placement

**Time**: 2 hours

**Tests**: 20 tests (phi insertion)

---

### Task 6.4: Implement Variable Renaming

**Time**: 2.5 hours

**Tests**: 25 tests (SSA renaming)

---

### Task 6.5: Implement SSA Verification

**Time**: 1.5 hours

**Tests**: 15 tests (SSA validity)

---

### Task 6.6: Create SSA Construction Pass

**File**: `packages/compiler/src/il/ssa/constructor.ts`

**Time**: 2 hours

**Tests**: 20 tests (full SSA construction)

---

### Phase 6 Summary

| Task | Description | Time | Tests |
|------|-------------|------|-------|
| 6.1 | Dominator tree | 2 hr | 15 |
| 6.2 | Dominance frontiers | 1.5 hr | 15 |
| 6.3 | Phi function placement | 2 hr | 20 |
| 6.4 | Variable renaming | 2.5 hr | 25 |
| 6.5 | SSA verification | 1.5 hr | 15 |
| 6.6 | SSA construction pass | 2 hr | 20 |
| **Total** | | **11.5 hr** | **110** |

---

## Phase 7: IL Optimization Passes (4-5 days)

### Overview

Basic optimization passes that work on IL before code generation.

---

### Task 7.1: Dead Code Elimination (DCE)

**Time**: 2 hours

**Tests**: 20 tests

---

### Task 7.2: Constant Folding

**Time**: 1.5 hours

**Tests**: 15 tests

---

### Task 7.3: Constant Propagation

**Time**: 1.5 hours

**Tests**: 15 tests

---

### Task 7.4: Copy Propagation

**Time**: 1.5 hours

**Tests**: 15 tests

---

### Task 7.5: Common Subexpression Elimination (CSE)

**Time**: 2 hours

**Tests**: 20 tests

---

### Task 7.6: Unreachable Block Elimination

**Time**: 1 hour

**Tests**: 10 tests

---

### Task 7.7: Create Optimization Pipeline

**Time**: 1.5 hours

**Tests**: 15 tests

---

### Task 7.8: Add Optimization Level Configuration

**Time**: 1 hour

**Tests**: 10 tests

---

### Phase 7 Summary

| Task | Description | Time | Tests |
|------|-------------|------|-------|
| 7.1 | Dead code elimination | 2 hr | 20 |
| 7.2 | Constant folding | 1.5 hr | 15 |
| 7.3 | Constant propagation | 1.5 hr | 15 |
| 7.4 | Copy propagation | 1.5 hr | 15 |
| 7.5 | CSE | 2 hr | 20 |
| 7.6 | Unreachable block elimination | 1 hr | 10 |
| 7.7 | Optimization pipeline | 1.5 hr | 15 |
| 7.8 | Optimization config | 1 hr | 10 |
| **Total** | | **12 hr** | **120** |

---

## Phase 8: Testing & Integration (3-4 days)

### Task 8.1: Unit Tests for All IL Components

**Time**: 3 hours

**Tests**: 50 tests (comprehensive unit tests)

---

### Task 8.2: Integration Tests (AST → IL)

**Time**: 2 hours

**Tests**: 30 tests

---

### Task 8.3: End-to-End Tests (Source → IL)

**Time**: 2 hours

**Tests**: 25 tests

---

### Task 8.4: Real-World Pattern Tests (C64 Patterns)

**Time**: 2 hours

**Tests**: 20 tests

---

### Task 8.5: Performance Benchmarks

**Time**: 1.5 hours

**Tests**: 10 benchmark tests

---

### Task 8.6: Documentation & Examples

**Time**: 2 hours

**Tests**: None (documentation)

---

### Phase 8 Summary

| Task | Description | Time | Tests |
|------|-------------|------|-------|
| 8.1 | Unit tests | 3 hr | 50 |
| 8.2 | Integration tests | 2 hr | 30 |
| 8.3 | End-to-end tests | 2 hr | 25 |
| 8.4 | Real-world patterns | 2 hr | 20 |
| 8.5 | Benchmarks | 1.5 hr | 10 |
| 8.6 | Documentation | 2 hr | 0 |
| **Total** | | **12.5 hr** | **135** |

---

## Complete Task Checklist

| Phase | Task | Description | Status |
|-------|------|-------------|--------|
| **1** | 1.1 | Create IL directory structure | [ ] |
| **1** | 1.2 | Define IL type system | [ ] |
| **1** | 1.3 | Define virtual registers & values | [ ] |
| **1** | 1.4 | Define IL opcode enum | [ ] |
| **1** | 1.5 | Define instruction base classes | [ ] |
| **1** | 1.6 | Define arithmetic/logic instructions | [ ] |
| **1** | 1.7 | Define control flow instructions | [ ] |
| **1** | 1.8 | Define memory & call instructions | [ ] |
| **2** | 2.1 | Define BasicBlock class | [ ] |
| **2** | 2.2 | Define ILFunction class | [ ] |
| **2** | 2.3 | Define ILModule class | [ ] |
| **2** | 2.4 | Create ILBuilder helper | [ ] |
| **2** | 2.5 | Create ILPrinter | [ ] |
| **2** | 2.6 | Create ILValidator | [ ] |
| **3** | 3.1 | IL Generator base class | [ ] |
| **3** | 3.2 | Module generation layer | [ ] |
| **3** | 3.3 | Declaration generation layer | [ ] |
| **3** | 3.4 | Statement generation layer | [ ] |
| **3** | 3.5 | If statement generation | [ ] |
| **3** | 3.6 | While statement generation | [ ] |
| **3** | 3.7 | For statement generation | [ ] |
| **3** | 3.8 | Return statement generation | [ ] |
| **3** | 3.9 | Main ILGenerator class | [ ] |
| **3** | 3.10 | Update exports | [ ] |
| **4** | 4.1-4.10 | Expression translation (10 tasks) | [ ] |
| **5** | 5.1-5.8 | Intrinsics & special (8 tasks) | [ ] |
| **6** | 6.1-6.6 | SSA construction (6 tasks) | [ ] |
| **7** | 7.1-7.8 | Optimization passes (8 tasks) | [ ] |
| **8** | 8.1-8.6 | Testing & integration (6 tasks) | [ ] |

---

## Summary

### Total Effort (UPDATED v2.0)

| Phase | Description | Time | Tests |
|-------|-------------|------|-------|
| Phase 1 | IL Type System | 10.5 hr | 100 |
| Phase 2 | Basic Blocks & CFG | 10 hr | 125 |
| Phase 3 | IL Generator Core | 16 hr | 165 |
| Phase 4 | Expression Translation | 14.25 hr | 170 |
| Phase 5 | Intrinsics & Special (Enhanced) | **15 hr** | **150** |
| Phase 6 | SSA Construction | 11.5 hr | 110 |
| Phase 7 | IL Optimization | 12 hr | 120 |
| Phase 8 | Testing & Integration | 12.5 hr | 135 |
| **TOTAL** | | **~102 hr (~6.5 weeks)** | **~1,075 tests** |

### v2.0 Enhancements Summary

| Enhancement | Impact | Added Time | Added Tests |
|-------------|--------|------------|-------------|
| @map struct IL instructions | Major | +2 hr | +20 |
| Optimization barriers | Major | +1.5 hr | +15 |
| For-loop lowering detail | Minor | +0.5 hr | +5 |
| Enhanced metadata | Major | +0.5 hr | +0 |
| **Total New** | | **+4.5 hr** | **+40** |

### Success Criteria

- ✅ All Blend65 constructs translate to IL
- ✅ SSA form with proper phi functions
- ✅ Type coercion automatically inserted
- ✅ Intrinsics handled (compile-time and runtime)
- ✅ Hardware hints preserved from semantic analysis
- ✅ IL validation catches errors
- ✅ Basic optimizations working
- ✅ 1,000+ new tests
- ✅ Ready for code generator
- ✅ **NEW: @map struct-aware hardware access**
- ✅ **NEW: Optimization barriers for timing-critical code**
- ✅ **NEW: Enhanced metadata for optimizer/codegen**

---

**Document Status**: COMPLETE ✅

**Next Action**: Toggle to Act mode to begin Phase 1, Task 1.1