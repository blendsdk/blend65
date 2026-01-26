# CodeGen Layer Changes

> **Document**: 06-codegen-layer.md  
> **Parent**: [Index](00-index.md)

## Overview

This document describes the changes needed in the code generation layer to produce actual 6502 assembly for address loading.

## Directory Structure

```
packages/compiler/src/codegen/
├── code-generator.ts      # Main code generator
├── instruction-generator.ts # Individual instruction generation
├── register-allocator.ts  # Register allocation
└── index.ts               # Public exports
```

## Files to Modify

| File | Purpose |
|------|---------|
| `codegen/instruction-generator.ts` | Generate 6502 assembly for address ops |

## 6502 Address Loading

### ACME Assembler Syntax

ACME assembler uses `<` and `>` operators for address bytes:

```asm
; Load low byte of address
LDA #<symbol    ; Immediate mode with low byte

; Load high byte of address  
LDA #>symbol    ; Immediate mode with high byte
```

### Target Assembly Output

For loading an address into memory (16-bit result):

```asm
; Load address of "myVar" into result location
LDA #<myVar
STA result_lo
LDA #>myVar
STA result_hi
```

## Implementation

### Handle LOAD_ADDR_LO ASM-IL

```typescript
/**
 * Generates 6502 assembly for loading low byte of address.
 * 
 * Input ASM-IL: r1_lo = #<symbol
 * Output 6502:  LDA #<symbol
 */
protected generateLoadAddressLow(instr: AsmILLoadAddressLow): void {
  const symbol = instr.getSymbolLabel();
  
  // LDA #<symbol - Load accumulator with low byte of address
  this.emit(`LDA #<${symbol}`);
  
  // Store to result location (register allocation handles this)
  const resultLoc = this.getResultLocation(instr.getResult());
  if (resultLoc.isAccumulator()) {
    // Already in A, nothing to do
  } else {
    this.emit(`STA ${resultLoc.getAddress()}`);
  }
}
```

### Handle LOAD_ADDR_HI ASM-IL

```typescript
/**
 * Generates 6502 assembly for loading high byte of address.
 * 
 * Input ASM-IL: r1_hi = #>symbol
 * Output 6502:  LDA #>symbol
 */
protected generateLoadAddressHigh(instr: AsmILLoadAddressHigh): void {
  const symbol = instr.getSymbolLabel();
  
  // LDA #>symbol - Load accumulator with high byte of address
  this.emit(`LDA #>${symbol}`);
  
  // Store to result location
  const resultLoc = this.getResultLocation(instr.getResult());
  if (resultLoc.isAccumulator()) {
    // Already in A, nothing to do
  } else {
    this.emit(`STA ${resultLoc.getAddress()}`);
  }
}
```

## Complete Code Generation Examples

### Example 1: Variable Address to Variable

Blend source:
```js
let counter: byte = 0;
let addr: word = @counter;
```

Generated 6502:
```asm
; counter storage (in BSS or data segment)
_var_counter:
    !byte 0

; addr storage (16-bit)
_var_addr:
    !word 0

; Code to load address
    LDA #<_var_counter    ; Low byte of counter's address
    STA _var_addr         ; Store to addr low byte
    LDA #>_var_counter    ; High byte of counter's address
    STA _var_addr+1       ; Store to addr high byte
```

### Example 2: Function Address to Variable

Blend source:
```js
callback function rasterIRQ(): void { }
let funcAddr: word = @rasterIRQ;
```

Generated 6502:
```asm
; Function definition
_fn_rasterIRQ:
    ; function body
    RTS

; funcAddr storage
_var_funcAddr:
    !word 0

; Code to load function address
    LDA #<_fn_rasterIRQ   ; Low byte of function address
    STA _var_funcAddr     ; Store to funcAddr low byte
    LDA #>_fn_rasterIRQ   ; High byte of function address
    STA _var_funcAddr+1   ; Store to funcAddr high byte
```

### Example 3: Callback Parameter

Blend source:
```js
function setIRQ(handler: callback): void {
    // Store handler to IRQ vector at $0314/$0315
}

setIRQ(rasterIRQ);
```

Generated 6502 (simplified):
```asm
; Call setup - load function address as argument
    LDA #<_fn_rasterIRQ   ; handler argument low byte
    STA _param_handler
    LDA #>_fn_rasterIRQ   ; handler argument high byte
    STA _param_handler+1
    JSR _fn_setIRQ        ; Call function
```

### Example 4: Store to Hardware Vector

Blend source:
```js
@map irqVector at $0314: word;

callback function myIRQ(): void { }

irqVector = @myIRQ;
```

Generated 6502:
```asm
; Store function address to hardware IRQ vector
    SEI                   ; Disable interrupts during vector change
    LDA #<_fn_myIRQ
    STA $0314             ; IRQ vector low byte
    LDA #>_fn_myIRQ  
    STA $0315             ; IRQ vector high byte
    CLI                   ; Re-enable interrupts
```

## Register Allocation Considerations

### 16-bit Results

Address values are 16-bit, requiring handling as word type:

```typescript
/**
 * Allocates storage for 16-bit address result.
 */
protected allocateWordResult(): WordLocation {
  // Options:
  // 1. Two consecutive zero-page locations
  // 2. A/X register pair (A=low, X=high)
  // 3. Two consecutive RAM locations
  
  if (this.canUseZeroPage()) {
    return this.allocateZeroPageWord();
  } else {
    return this.allocateRamWord();
  }
}
```

### Accumulator Usage

For immediate use (not stored), can leave in A register:

```asm
; If immediately storing to memory, don't need intermediate storage
LDA #<symbol
STA target_lo
LDA #>symbol
STA target_hi
```

## Optimization Opportunities

### Direct Assignment Optimization

When assigning address directly to variable, skip intermediate:

```typescript
// Instead of:
//   LOAD_ADDRESS -> r1
//   STORE_VAR "dest", r1

// Generate directly:
//   LDA #<source
//   STA dest
//   LDA #>source
//   STA dest+1
```

### Constant Folding for @map Variables

Memory-mapped variables have known addresses at compile time:

```typescript
// For @map borderColor at $D020: byte
// @borderColor can be folded to constant $D020

if (isMemoryMappedVariable(symbol)) {
  const address = symbol.getMappedAddress();
  this.emit(`LDA #<$${address.toString(16)}`);
  this.emit(`STA ${resultLo}`);
  this.emit(`LDA #>$${address.toString(16)}`);
  this.emit(`STA ${resultHi}`);
}
```

## Testing Requirements

| Test Case | Description |
|-----------|-------------|
| Variable address | Verify `LDA #<var` / `LDA #>var` generation |
| Function address | Verify function label used correctly |
| Zero-page variable | Verify ZP addresses handled correctly |
| Memory-mapped address | Verify literal address output |
| 16-bit storage | Verify correct low/high byte placement |
| Direct assignment | Verify optimized direct store pattern |