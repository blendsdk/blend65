# Codegen Globals: 6502 Code Generation for Global Access

> **Document**: 06-codegen-globals.md
> **Parent**: [Index](00-index.md)

## Overview

Generate correct 6502 machine code for global variable loads, stores, and data segment embedding.

## Addressing Modes

### `@zp` Globals → Zero Page Addressing (2 bytes, fast)
```asm
; Load @zp byte at $02
LDA $02           ; 2 bytes, 3 cycles

; Store @zp byte at $02
STA $02           ; 2 bytes, 3 cycles

; Load @zp word at $04 (low/high)
LDA $04           ; low byte
LDX $05           ; high byte (or use Y)
```

### `@ram` / Default Globals → Absolute Addressing (3 bytes)
```asm
; Load @ram byte at $0400
LDA $0400         ; 3 bytes, 4 cycles

; Store @ram byte at $0400
STA $0400         ; 3 bytes, 4 cycles

; Load @ram word at $0400
LDA $0400         ; low byte
LDX $0401         ; high byte
```

### `@data` References → Absolute + Indexed
```asm
; Access @data array element: spriteData[i]
LDX i             ; Load index
LDA $yyyy,X       ; Indexed absolute: base + X

; Load @data base address (for pointer operations)
LDA #<$yyyy       ; Low byte of data address
LDX #>$yyyy       ; High byte of data address
```

## Codegen Base Changes

### `getAddressOperand()` Fix

The current crash point. Must handle global operands:

```typescript
// In codegen/generator/base.ts
protected resolveOperandAddress(operand: ILOperand): { address: number; isZp: boolean } {
  if (operand.kind === 'slot') {
    // Local slot - existing logic
    return { address: slot.address, isZp: slot.location === SlotLocation.ZeroPage };
  }
  if (operand.kind === 'address') {
    // Global address - NEW
    return { address: operand.address, isZp: operand.address < 0x100 };
  }
  throw new Error(`Unknown operand kind: ${operand.kind}`);
}
```

### Data Segment Binary Embedding

The binary emitter must append data segment bytes after code:

```typescript
// In codegen output
const output = new Uint8Array(codeSize + dataSegmentSize);
output.set(codeBytes, 0);              // Code segment
output.set(dataSegmentBytes, codeSize); // Data segment appended
```

## Testing Requirements

- ZP-mode instructions for @zp globals (~10 tests)
- Absolute-mode instructions for @ram globals (~10 tests)
- Indexed addressing for @data arrays (~5 tests)
- Data segment binary embedding (~5 tests)
- Mixed globals in one function (~5 tests)
