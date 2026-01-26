# ASM-IL Layer Changes

> **Document**: 05-asm-il-layer.md  
> **Parent**: [Index](00-index.md)

## Overview

This document describes the changes needed in the ASM-IL layer to convert `LOAD_ADDRESS` IL instructions to low-level assembly-like IL.

## Directory Structure

```
packages/compiler/src/asm-il/
├── builder/           # ASM-IL instruction builders
├── emitters/          # IL to ASM-IL conversion
├── optimizer/         # ASM-IL optimization passes
├── compile-to-acme.ts # Final ACME assembly output
└── index.ts           # Public exports
```

## Files to Modify

| File | Purpose |
|------|---------|
| `asm-il/emitters/instruction-emitter.ts` | Add LOAD_ADDRESS case |
| `asm-il/builder/` | May need new ASM-IL instruction types |

## LOAD_ADDRESS Conversion

### Conversion Strategy

The `LOAD_ADDRESS` IL instruction must be converted to ASM-IL instructions that:
1. Load the low byte of the symbol address
2. Load the high byte of the symbol address
3. Store to the result register (16-bit)

### ASM-IL Output Pattern

For `LOAD_ADDRESS "symbol", "variable" -> r1`:

```
; Load address of symbol into 16-bit register
; r1 is a virtual 16-bit register (r1_lo, r1_hi)
ASM_LOAD_IMMEDIATE r1_lo, #<symbol
ASM_LOAD_IMMEDIATE r1_hi, #>symbol
```

Or if using existing ASM-IL patterns:

```
; May use existing CONST pattern with address resolution
ASM_CONST_ADDR symbol, r1
```

## Implementation

### Add Case in Instruction Emitter

**File**: `asm-il/emitters/instruction-emitter.ts`

```typescript
import { 
  isLoadAddressInstruction, 
  LoadAddressInstruction 
} from '../../il/instructions.js';

// In the instruction emit switch/case:

case ILOpcode.LOAD_ADDRESS: {
  this.emitLoadAddress(instr as LoadAddressInstruction);
  break;
}

/**
 * Emits ASM-IL instructions for loading a symbol's address.
 * 
 * Converts LOAD_ADDRESS "symbol", "kind" -> r1
 * To low-level instructions that load the 16-bit address.
 * 
 * @param instr - The LOAD_ADDRESS instruction
 */
protected emitLoadAddress(instr: LoadAddressInstruction): void {
  const symbolName = instr.getSymbolName();
  const symbolKind = instr.getSymbolKind();
  const result = instr.getResult();
  
  // Resolve the actual symbol to get its assembly label
  const label = this.resolveSymbolLabel(symbolName, symbolKind);
  
  // Emit ASM-IL to load the 16-bit address
  // This creates two separate loads for low and high bytes
  this.emitLoadImmediateLow(result, label);
  this.emitLoadImmediateHigh(result, label);
}

/**
 * Resolves a symbol name to its assembly label.
 * 
 * @param name - Symbol name
 * @param kind - 'variable' or 'function'
 * @returns The assembly label for the symbol
 */
protected resolveSymbolLabel(name: string, kind: 'variable' | 'function'): string {
  if (kind === 'function') {
    // Functions use their name as label (with possible prefix)
    return this.getFunctionLabel(name);
  } else {
    // Variables use their allocated storage label
    return this.getVariableLabel(name);
  }
}
```

### New ASM-IL Instructions (if needed)

If the ASM-IL layer doesn't have address-loading primitives, we may need:

```typescript
/**
 * ASM-IL instruction that loads the low byte of an address.
 */
export class AsmILLoadAddressLow extends AsmILInstruction {
  constructor(
    protected readonly symbolLabel: string,
    protected readonly result: AsmILRegister,
  ) {
    super(AsmILOpcode.LOAD_ADDR_LO);
  }
  
  getSymbolLabel(): string {
    return this.symbolLabel;
  }
  
  toString(): string {
    return `${this.result} = #<${this.symbolLabel}`;
  }
}

/**
 * ASM-IL instruction that loads the high byte of an address.
 */
export class AsmILLoadAddressHigh extends AsmILInstruction {
  constructor(
    protected readonly symbolLabel: string,
    protected readonly result: AsmILRegister,
  ) {
    super(AsmILOpcode.LOAD_ADDR_HI);
  }
  
  getSymbolLabel(): string {
    return this.symbolLabel;
  }
  
  toString(): string {
    return `${this.result} = #>${this.symbolLabel}`;
  }
}
```

## ASM-IL Output Examples

### Example 1: Variable Address

Input IL:
```
LOAD_ADDRESS "counter", "variable" -> r1
```

Output ASM-IL:
```
r1_lo = #<_var_counter
r1_hi = #>_var_counter
```

### Example 2: Function Address

Input IL:
```
LOAD_ADDRESS "rasterIRQ", "function" -> r2
```

Output ASM-IL:
```
r2_lo = #<_fn_rasterIRQ
r2_hi = #>_fn_rasterIRQ
```

## Symbol Label Resolution

### Label Conventions

| Symbol Type | Label Pattern | Example |
|-------------|---------------|---------|
| Global variable | `_var_{name}` | `_var_counter` |
| Local variable | `_local_{func}_{name}` | `_local_main_temp` |
| Function | `_fn_{name}` | `_fn_rasterIRQ` |
| Parameter | Passed via registers/stack | N/A |

### Getting Variable Labels

```typescript
/**
 * Gets the assembly label for a variable.
 */
protected getVariableLabel(name: string): string {
  const symbol = this.symbolTable.lookup(name);
  
  if (symbol?.storageClass === StorageClass.ZeroPage) {
    return `_zp_${name}`;
  } else if (symbol?.storageClass === StorageClass.Mapped) {
    // Memory-mapped variables use their address directly
    return `$${symbol.address.toString(16)}`;
  } else {
    return `_var_${name}`;
  }
}

/**
 * Gets the assembly label for a function.
 */
protected getFunctionLabel(name: string): string {
  return `_fn_${name}`;
}
```

## Testing Requirements

| Test Case | Description |
|-----------|-------------|
| Variable address ASM-IL | Verify correct low/high byte instructions |
| Function address ASM-IL | Verify function label resolution |
| Zero-page variable | Verify ZP label prefix |
| Memory-mapped variable | Verify address literal output |
| Global vs local vars | Verify correct label prefixes |