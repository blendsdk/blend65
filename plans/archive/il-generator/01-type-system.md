# Phase 1: IL Type System & Infrastructure

> **Phase**: 1 of 8  
> **Est. Time**: ~10.5 hours  
> **Tasks**: 8  
> **Tests**: ~100  
> **Prerequisites**: None (foundation phase)

---

## Overview

This phase creates the foundation: IL value types, instruction types, and basic infrastructure.

## Directory Structure Created

```
packages/compiler/src/il/
├── index.ts                    # Exports
├── types.ts                    # IL type definitions
├── values.ts                   # ILValue, VirtualRegister
└── instructions.ts             # All IL instruction types
```

---

## Task 1.1: Create IL Directory Structure

**File**: `packages/compiler/src/il/index.ts`

**Deliverable**: Empty directory with index.ts exporting nothing yet

**Time**: 15 minutes

**Tests**: None (infrastructure)

**Implementation**:
```typescript
// packages/compiler/src/il/index.ts
// IL Generator exports - to be populated as modules are created
export {};
```

---

## Task 1.2: Define IL Type System

**File**: `packages/compiler/src/il/types.ts`

**Time**: 1 hour

**Tests**: 10 tests (type creation, size calculations, type equality)

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

// Type utilities
export function createArrayType(elementType: ILType, length: number | null): ILArrayType {
  return {
    kind: ILTypeKind.Array,
    elementType,
    length,
    sizeInBytes: length !== null ? elementType.sizeInBytes * length : 2, // pointer if dynamic
  };
}

export function createPointerType(pointeeType: ILType): ILPointerType {
  return {
    kind: ILTypeKind.Pointer,
    pointeeType,
    sizeInBytes: 2, // 16-bit addresses
  };
}

export function createFunctionType(params: ILType[], returnType: ILType): ILFunctionType {
  return {
    kind: ILTypeKind.Function,
    parameterTypes: params,
    returnType,
    sizeInBytes: 2, // function pointer
  };
}

export function typesEqual(a: ILType, b: ILType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === ILTypeKind.Array && b.kind === ILTypeKind.Array) {
    return typesEqual(a.elementType, b.elementType) && a.length === b.length;
  }
  if (a.kind === ILTypeKind.Pointer && b.kind === ILTypeKind.Pointer) {
    return typesEqual(a.pointeeType, b.pointeeType);
  }
  return true;
}
```

---

## Task 1.3: Define Virtual Register & Values

**File**: `packages/compiler/src/il/values.ts`

**Time**: 1.5 hours

**Tests**: 15 tests (register creation, constant creation, factory methods)

**Content**:
```typescript
import type { ILType } from './types.js';

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
 * IL Constant value
 */
export interface ILConstant {
  kind: 'constant';
  value: number;
  type: ILType;
}

/**
 * IL Label for control flow
 */
export interface ILLabel {
  kind: 'label';
  name: string;
  blockId: number;
}

/**
 * IL Value - can be register, constant, or label
 */
export type ILValue = VirtualRegister | ILConstant | ILLabel;

/**
 * Type guard for VirtualRegister
 */
export function isVirtualRegister(value: ILValue): value is VirtualRegister {
  return value instanceof VirtualRegister;
}

/**
 * Type guard for ILConstant
 */
export function isILConstant(value: ILValue): value is ILConstant {
  return (value as ILConstant).kind === 'constant';
}

/**
 * Type guard for ILLabel
 */
export function isILLabel(value: ILValue): value is ILLabel {
  return (value as ILLabel).kind === 'label';
}

/**
 * Factory for creating IL values
 */
export class ILValueFactory {
  protected nextRegisterId = 0;
  protected nextLabelId = 0;

  createRegister(type: ILType, name?: string): VirtualRegister {
    return new VirtualRegister(this.nextRegisterId++, type, name);
  }

  createConstant(value: number, type: ILType): ILConstant {
    return { kind: 'constant', value, type };
  }

  createLabel(name: string): ILLabel {
    return { kind: 'label', name, blockId: this.nextLabelId++ };
  }

  createUniqueLabel(prefix: string): ILLabel {
    return this.createLabel(`${prefix}_${this.nextLabelId}`);
  }

  reset(): void {
    this.nextRegisterId = 0;
    this.nextLabelId = 0;
  }

  getNextRegisterId(): number {
    return this.nextRegisterId;
  }

  getNextLabelId(): number {
    return this.nextLabelId;
  }
}
```

---

## Task 1.4: Define IL Instruction Opcode Enum

**File**: `packages/compiler/src/il/instructions.ts` (Part 1)

**Time**: 45 minutes

**Tests**: 5 tests (enum completeness)

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
  
  // @map struct access (v2.0)
  MAP_LOAD_FIELD = 'MAP_LOAD_FIELD',
  MAP_STORE_FIELD = 'MAP_STORE_FIELD',
  MAP_LOAD_RANGE = 'MAP_LOAD_RANGE',
  MAP_STORE_RANGE = 'MAP_STORE_RANGE',
  
  // Optimization control (v2.0)
  OPT_BARRIER = 'OPT_BARRIER',
  VOLATILE_READ = 'VOLATILE_READ',
  VOLATILE_WRITE = 'VOLATILE_WRITE',
  
  // CPU instructions (v2.0) - see 05a-intrinsics-library.md
  CPU_SEI = 'CPU_SEI',
  CPU_CLI = 'CPU_CLI',
  CPU_NOP = 'CPU_NOP',
  CPU_BRK = 'CPU_BRK',
  CPU_PHA = 'CPU_PHA',
  CPU_PLA = 'CPU_PLA',
  CPU_PHP = 'CPU_PHP',
  CPU_PLP = 'CPU_PLP',
  
  // Utility intrinsics (v2.0)
  INTRINSIC_LO = 'INTRINSIC_LO',
  INTRINSIC_HI = 'INTRINSIC_HI',
}
```

---

## Task 1.5: Define IL Instruction Base Classes

**File**: `packages/compiler/src/il/instructions.ts` (Part 2 - append)

**Time**: 1.5 hours

**Tests**: 10 tests (instruction creation, metadata handling)

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
  
  /** For VIC-II raster-critical code (v2.0) */
  rasterCritical?: boolean;
  
  /** Estimated cycle count (v2.0) */
  estimatedCycles?: number;
  
  /** Loop nesting depth (v2.0) */
  loopDepth?: number;
  
  /** Is loop-invariant? (v2.0) */
  isLoopInvariant?: boolean;
  
  /** Inline candidate? (v2.0) */
  inlineCandidate?: boolean;
  
  /** Execution frequency (v2.0) */
  executionFrequency?: 'hot' | 'cold' | 'normal';
  
  /** Original source expression (v2.0) */
  sourceExpression?: string;
  
  /** @map struct info (v2.0) */
  mapInfo?: {
    structName: string;
    fieldName?: string;
    baseAddress: number;
    fieldOffset?: number;
    isRange?: boolean;
    rangeStart?: number;
    rangeEnd?: number;
  };
  
  /** Live range start - instruction ID where value becomes live (v2.0) */
  liveRangeStart?: number;
  
  /** Live range end - instruction ID where value is last used (v2.0) */
  liveRangeEnd?: number;
  
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

  /** Check if this instruction has side effects */
  hasSideEffects(): boolean {
    return [
      ILOpcode.STORE_VAR,
      ILOpcode.STORE_ARRAY,
      ILOpcode.STORE_FIELD,
      ILOpcode.CALL,
      ILOpcode.CALL_VOID,
      ILOpcode.CALL_INDIRECT,
      ILOpcode.INTRINSIC_POKE,
      ILOpcode.INTRINSIC_POKEW,
      ILOpcode.HARDWARE_WRITE,
      ILOpcode.MAP_STORE_FIELD,
      ILOpcode.MAP_STORE_RANGE,
      ILOpcode.VOLATILE_WRITE,
      ILOpcode.OPT_BARRIER,
    ].includes(this.opcode);
  }

  /** Check if this is a terminator instruction */
  isTerminator(): boolean {
    return [
      ILOpcode.JUMP,
      ILOpcode.BRANCH,
      ILOpcode.RETURN,
      ILOpcode.RETURN_VOID,
    ].includes(this.opcode);
  }

  /** Pretty print for debugging */
  abstract toString(): string;
}
```

---

## Task 1.6: Define Concrete Instruction Classes (Arithmetic/Logic)

**File**: `packages/compiler/src/il/instructions.ts` (Part 3 - append)

**Time**: 2 hours

**Tests**: 20 tests (binary, unary, const instructions)

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

/**
 * Type conversion instruction
 */
export class ILConvertInstruction extends ILInstruction {
  constructor(
    id: number,
    opcode: ILOpcode,
    public readonly source: VirtualRegister,
    public readonly targetType: ILType,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, opcode, result, metadata);
  }

  getOperands(): ILValue[] {
    return [this.source];
  }

  getUsedRegisters(): VirtualRegister[] {
    return [this.source];
  }

  toString(): string {
    return `${this.result} = ${this.opcode} ${this.source}`;
  }
}
```

---

## Task 1.7: Define Control Flow Instructions

**File**: `packages/compiler/src/il/instructions.ts` (Part 4 - append)

**Time**: 1.5 hours

**Tests**: 15 tests (jump, branch, return instructions)

See [instructions-control-flow.md](./code-snippets/instructions-control-flow.md) for detailed implementation.

---

## Task 1.8: Define Memory & Call Instructions

**File**: `packages/compiler/src/il/instructions.ts` (Part 5 - append)

**Time**: 2 hours

**Tests**: 25 tests (load, store, call, phi instructions)

See [instructions-memory-call.md](./code-snippets/instructions-memory-call.md) for detailed implementation.

---

## Phase 1 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 1.1 | Create directory structure | 15 min | 0 | [ ] |
| 1.2 | Define IL type system | 1 hr | 10 | [ ] |
| 1.3 | Define virtual registers & values | 1.5 hr | 15 | [ ] |
| 1.4 | Define IL opcode enum | 45 min | 5 | [ ] |
| 1.5 | Define instruction base classes | 1.5 hr | 10 | [ ] |
| 1.6 | Define arithmetic/logic instructions | 2 hr | 20 | [ ] |
| 1.7 | Define control flow instructions | 1.5 hr | 15 | [ ] |
| 1.8 | Define memory & call instructions | 2 hr | 25 | [ ] |
| **Total** | | **10.5 hr** | **100** | |

---

## Success Criteria

- [ ] All IL types can be created and compared
- [ ] Virtual registers can be allocated and tracked
- [ ] All opcodes are defined
- [ ] Instruction base class properly tracks metadata
- [ ] All concrete instruction classes implement required methods
- [ ] 100 tests passing
- [ ] index.ts exports all public types

---

## Dependencies for Next Phase

Phase 2 (CFG Infrastructure) depends on:
- `ILInstruction` base class
- `VirtualRegister` class
- `ILLabel` type
- All concrete instruction classes

---

**Next**: [02-cfg-infrastructure.md](02-cfg-infrastructure.md)