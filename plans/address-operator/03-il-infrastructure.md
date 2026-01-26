# IL Infrastructure Changes

> **Document**: 03-il-infrastructure.md  
> **Parent**: [Index](00-index.md)

## Overview

This document describes the new IL opcode and instruction class needed to support the address-of operator.

## New IL Opcode

### LOAD_ADDRESS

**Purpose**: Load the 16-bit memory address of a symbol (variable or function).

**Opcode Definition** (add to `ILOpcode` enum):

```typescript
// In packages/compiler/src/il/instructions.ts

export enum ILOpcode {
  // ... existing opcodes ...
  
  /**
   * Load the address of a symbol (variable or function).
   * Result is a 16-bit word containing the memory address.
   * 
   * Operands:
   * - symbolName: string - Name of the symbol
   * - symbolKind: 'variable' | 'function' - Type of symbol
   * 
   * Result: word (16-bit address)
   */
  LOAD_ADDRESS = 'LOAD_ADDRESS',
}
```

## New Instruction Class

### LoadAddressInstruction

**File**: `packages/compiler/src/il/instructions.ts`

```typescript
/**
 * IL instruction that loads the address of a symbol.
 * 
 * @example
 * // For: let addr = @myVar
 * LOAD_ADDRESS "myVar", "variable" -> r1
 * 
 * // For: let funcAddr = @myFunc  
 * LOAD_ADDRESS "myFunc", "function" -> r2
 */
export class LoadAddressInstruction extends ILInstruction {
  /**
   * Creates a LOAD_ADDRESS instruction.
   * 
   * @param symbolName - The name of the symbol whose address to load
   * @param symbolKind - Whether this is a 'variable' or 'function'
   * @param result - The register to store the 16-bit address
   * @param location - Source location for diagnostics
   */
  constructor(
    protected readonly symbolName: string,
    protected readonly symbolKind: 'variable' | 'function',
    result: ILRegister,
    location?: SourceLocation,
  ) {
    super(ILOpcode.LOAD_ADDRESS, result, location);
  }

  /**
   * Gets the symbol name whose address is being loaded.
   */
  getSymbolName(): string {
    return this.symbolName;
  }

  /**
   * Gets the kind of symbol (variable or function).
   */
  getSymbolKind(): 'variable' | 'function' {
    return this.symbolKind;
  }

  /**
   * Returns string representation for debugging.
   */
  toString(): string {
    return `LOAD_ADDRESS "${this.symbolName}", "${this.symbolKind}" -> ${this.result}`;
  }

  /**
   * Creates a copy of this instruction with a new result register.
   */
  withResult(result: ILRegister): LoadAddressInstruction {
    return new LoadAddressInstruction(
      this.symbolName,
      this.symbolKind,
      result,
      this.location,
    );
  }
}
```

## IL Builder Method

**File**: `packages/compiler/src/il/builder.ts`

Add method to emit LOAD_ADDRESS instruction:

```typescript
/**
 * Emits a LOAD_ADDRESS instruction to get the address of a symbol.
 * 
 * @param symbolName - Name of the variable or function
 * @param symbolKind - Whether it's a 'variable' or 'function'
 * @param location - Source location for diagnostics
 * @returns The register containing the 16-bit address
 * 
 * @example
 * // For: @myVariable
 * const addrReg = builder.emitLoadAddress('myVariable', 'variable', loc);
 * 
 * // For: @myFunction  
 * const funcAddrReg = builder.emitLoadAddress('myFunction', 'function', loc);
 */
emitLoadAddress(
  symbolName: string,
  symbolKind: 'variable' | 'function',
  location?: SourceLocation,
): ILRegister {
  const result = this.createRegister();
  const instr = new LoadAddressInstruction(symbolName, symbolKind, result, location);
  this.emit(instr);
  return result;
}
```

## Type Guard Function

Add type guard for the new instruction class:

```typescript
/**
 * Type guard to check if instruction is LoadAddressInstruction.
 */
export function isLoadAddressInstruction(
  instr: ILInstruction,
): instr is LoadAddressInstruction {
  return instr.getOpcode() === ILOpcode.LOAD_ADDRESS;
}
```

## IL Printer Update

Update the IL printer to display LOAD_ADDRESS instructions:

```typescript
// In the instruction printing logic
case ILOpcode.LOAD_ADDRESS: {
  const loadAddr = instr as LoadAddressInstruction;
  return `${loadAddr.getResult()} = LOAD_ADDRESS "${loadAddr.getSymbolName()}" (${loadAddr.getSymbolKind()})`;
}
```

## Expected IL Output

For source code:
```js
let counter: byte = 0;
let addr: word = @counter;

callback function rasterIRQ(): void { }
let funcAddr: word = @rasterIRQ;
```

Generated IL:
```
; Variable address
LOAD_ADDRESS "counter", "variable" -> r1
STORE_VAR "addr", r1

; Function address  
LOAD_ADDRESS "rasterIRQ", "function" -> r2
STORE_VAR "funcAddr", r2
```

## Testing Requirements

| Test Case | Description |
|-----------|-------------|
| Instruction creation | Verify LoadAddressInstruction stores correct data |
| Symbol name getter | Verify getSymbolName() returns correct value |
| Symbol kind getter | Verify getSymbolKind() returns 'variable' or 'function' |
| toString format | Verify string representation matches expected format |
| withResult clone | Verify cloning with new register works correctly |
| Type guard | Verify isLoadAddressInstruction() works correctly |
| Builder emit | Verify emitLoadAddress() creates correct instruction |