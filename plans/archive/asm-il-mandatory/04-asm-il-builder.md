# ASM-IL Builder Enhancements

> **Document**: 04-asm-il-builder.md
> **Parent**: [Index](00-index.md)

## Overview

The `AsmModuleBuilder` needs enhancements to support all operations currently in the CodeGenerator. This document details the required additions.

## Current Builder Methods

The `AsmModuleBuilder` (in `asm-il/builder/module-builder.ts`) already has:

### Load/Store Operations
- `ldaImm(value, comment?)` - LDA #immediate
- `ldaAbs(address, comment?)` - LDA absolute
- `ldaZp(address, comment?)` - LDA zero-page
- `ldxImm(value, comment?)` - LDX #immediate
- `ldyImm(value, comment?)` - LDY #immediate
- `staAbs(address, comment?)` - STA absolute
- `staZp(address, comment?)` - STA zero-page
- `stxAbs(address, comment?)` - STX absolute
- `styAbs(address, comment?)` - STY absolute

### Branch/Jump Operations
- `jmp(label, comment?)` - JMP label
- `jsr(label, comment?)` - JSR label
- `rts(comment?)` - RTS
- `beq(label, comment?)` - BEQ label
- `bne(label, comment?)` - BNE label
- `bcc(label, comment?)` - BCC label
- `bcs(label, comment?)` - BCS label

### Other Operations
- `nop(comment?)` - NOP
- `comment(text)` - Add comment
- `section(title)` - Section header
- `blank()` - Blank line

### Labels
- `functionLabel(name, comment?)` - Function label
- `globalLabel(name, comment?)` - Global label
- `blockLabel(name, comment?)` - Block label
- `dataLabel(name, comment?)` - Data label
- `tempLabel(name, comment?)` - Temp label

## Required Enhancements

### 1. Add Source Location to All Methods

**Current signature:**
```typescript
ldaImm(value: number, comment?: string): this
```

**New signature:**
```typescript
ldaImm(value: number, comment?: string, sourceLocation?: SourceLocation): this
```

All instruction methods need this parameter added.

### 2. Missing Instruction Methods

Add these methods to match all 6502 instructions used by CodeGenerator:

```typescript
// Transfer instructions
txa(comment?: string, location?: SourceLocation): this;
tya(comment?: string, location?: SourceLocation): this;
tax(comment?: string, location?: SourceLocation): this;
tay(comment?: string, location?: SourceLocation): this;
tsx(comment?: string, location?: SourceLocation): this;
txs(comment?: string, location?: SourceLocation): this;

// Arithmetic
clc(comment?: string, location?: SourceLocation): this;
sec(comment?: string, location?: SourceLocation): this;
adcImm(value: number, comment?: string, location?: SourceLocation): this;
adcZp(address: number, comment?: string, location?: SourceLocation): this;
adcAbs(address: number, comment?: string, location?: SourceLocation): this;
sbcImm(value: number, comment?: string, location?: SourceLocation): this;
sbcZp(address: number, comment?: string, location?: SourceLocation): this;
sbcAbs(address: number, comment?: string, location?: SourceLocation): this;

// Increment/Decrement
incZp(address: number, comment?: string, location?: SourceLocation): this;
incAbs(address: number, comment?: string, location?: SourceLocation): this;
decZp(address: number, comment?: string, location?: SourceLocation): this;
decAbs(address: number, comment?: string, location?: SourceLocation): this;
inx(comment?: string, location?: SourceLocation): this;
iny(comment?: string, location?: SourceLocation): this;
dex(comment?: string, location?: SourceLocation): this;
dey(comment?: string, location?: SourceLocation): this;

// Logical
andImm(value: number, comment?: string, location?: SourceLocation): this;
andZp(address: number, comment?: string, location?: SourceLocation): this;
oraImm(value: number, comment?: string, location?: SourceLocation): this;
oraZp(address: number, comment?: string, location?: SourceLocation): this;
eorImm(value: number, comment?: string, location?: SourceLocation): this;
eorZp(address: number, comment?: string, location?: SourceLocation): this;

// Compare
cmpImm(value: number, comment?: string, location?: SourceLocation): this;
cmpZp(address: number, comment?: string, location?: SourceLocation): this;
cmpAbs(address: number, comment?: string, location?: SourceLocation): this;
cpxImm(value: number, comment?: string, location?: SourceLocation): this;
cpyImm(value: number, comment?: string, location?: SourceLocation): this;

// Shift/Rotate
aslAcc(comment?: string, location?: SourceLocation): this;
aslZp(address: number, comment?: string, location?: SourceLocation): this;
lsrAcc(comment?: string, location?: SourceLocation): this;
lsrZp(address: number, comment?: string, location?: SourceLocation): this;
rolAcc(comment?: string, location?: SourceLocation): this;
rorAcc(comment?: string, location?: SourceLocation): this;

// Stack
pha(comment?: string, location?: SourceLocation): this;
pla(comment?: string, location?: SourceLocation): this;
php(comment?: string, location?: SourceLocation): this;
plp(comment?: string, location?: SourceLocation): this;

// Flags
sei(comment?: string, location?: SourceLocation): this;
cli(comment?: string, location?: SourceLocation): this;
cld(comment?: string, location?: SourceLocation): this;
sed(comment?: string, location?: SourceLocation): this;
clv(comment?: string, location?: SourceLocation): this;

// Other branches
bmi(label: string, comment?: string, location?: SourceLocation): this;
bpl(label: string, comment?: string, location?: SourceLocation): this;
bvc(label: string, comment?: string, location?: SourceLocation): this;
bvs(label: string, comment?: string, location?: SourceLocation): this;

// Special
brk(comment?: string, location?: SourceLocation): this;
rti(comment?: string, location?: SourceLocation): this;
bit(address: number, comment?: string, location?: SourceLocation): this;
```

### 3. Indexed Addressing Modes

```typescript
// Zero-page indexed
ldaZpX(address: number, comment?: string, location?: SourceLocation): this;
ldaZpY(address: number, comment?: string, location?: SourceLocation): this;
staZpX(address: number, comment?: string, location?: SourceLocation): this;
ldxZpY(address: number, comment?: string, location?: SourceLocation): this;
ldyZpX(address: number, comment?: string, location?: SourceLocation): this;

// Absolute indexed
ldaAbsX(address: number, comment?: string, location?: SourceLocation): this;
ldaAbsY(address: number, comment?: string, location?: SourceLocation): this;
staAbsX(address: number, comment?: string, location?: SourceLocation): this;
staAbsY(address: number, comment?: string, location?: SourceLocation): this;

// Indirect
ldaIndX(address: number, comment?: string, location?: SourceLocation): this;
ldaIndY(address: number, comment?: string, location?: SourceLocation): this;
staIndX(address: number, comment?: string, location?: SourceLocation): this;
staIndY(address: number, comment?: string, location?: SourceLocation): this;
```

### 4. Data Directives with Location

```typescript
bytes(values: number[], comment?: string, location?: SourceLocation): this;
word(value: number, comment?: string, location?: SourceLocation): this;
words(values: number[], comment?: string, location?: SourceLocation): this;
text(str: string, comment?: string, location?: SourceLocation): this;
fill(count: number, value: number, comment?: string, location?: SourceLocation): this;
```

### 5. Generic Instruction Method

For flexibility, add a generic method:

```typescript
instruction(
  mnemonic: Mnemonic,
  mode: AddressingMode,
  operand?: number | string,
  comment?: string,
  location?: SourceLocation
): this;
```

## Implementation Example

```typescript
// asm-il/builder/module-builder.ts

import type { SourceLocation } from '../../ast/base.js';
import type { AsmInstruction, AddressingMode, Mnemonic } from '../types.js';

export class AsmModuleBuilder {
  // ... existing code ...

  /**
   * Emit LDA immediate instruction
   */
  ldaImm(value: number, comment?: string, sourceLocation?: SourceLocation): this {
    return this.addInstruction({
      kind: 'instruction',
      mnemonic: 'LDA',
      mode: AddressingMode.Immediate,
      operand: value & 0xFF,
      cycles: 2,
      bytes: 2,
      comment,
      sourceLocation,
    });
  }

  /**
   * Generic instruction emission
   */
  instruction(
    mnemonic: Mnemonic,
    mode: AddressingMode,
    operand?: number | string,
    comment?: string,
    sourceLocation?: SourceLocation
  ): this {
    const cycles = getInstructionCycles(mnemonic, mode);
    const bytes = getInstructionBytes(mode);
    
    return this.addInstruction({
      kind: 'instruction',
      mnemonic,
      mode,
      operand,
      cycles,
      bytes,
      comment,
      sourceLocation,
    });
  }

  protected addInstruction(instr: AsmInstruction): this {
    this.items.push(instr);
    this.estimatedCodeSize += instr.bytes;
    return this;
  }
}
```

## Testing Requirements

- Unit tests for each new method
- Verify all addressing modes emit correct node types
- Verify source locations are preserved
- Integration tests with CodeGenerator using new methods