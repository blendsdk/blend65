# Codegen Implementation: Go-Intrinsics

> **Document**: 03-codegen-implementation.md
> **Parent**: [Index](00-index.md)

## Overview

This document provides the technical specification for implementing the 6 missing intrinsics in the code generator.

**File to modify**: `packages/compiler/src/codegen/instruction-generator.ts`

## Architecture

### Current Architecture

The `InstructionGenerator` class uses a dispatch pattern:

1. `generateInstruction(instr)` - Main dispatch method
2. Switch on `instr.opcode` to specific handlers
3. Each handler generates appropriate 6502 assembly

### Proposed Changes

Add 6 new switch cases and 4 new handler methods:
- `CPU_BRK` → Add to existing `generateCpuInstruction()`
- `OPT_BARRIER` → Inline case (comment only)
- `INTRINSIC_LO` → New `generateLo()` method
- `INTRINSIC_HI` → New `generateHi()` method
- `VOLATILE_READ` → New `generateVolatileRead()` method
- `VOLATILE_WRITE` → New `generateVolatileWrite()` method

## Implementation Details

### 1. Add CPU_BRK to generateCpuInstruction()

**Location**: Inside `generateCpuInstruction()` switch (~line 397)

```typescript
case ILOpcode.CPU_BRK:
  this.emitInstruction('BRK', undefined, 'Software interrupt', 1);
  break;
```

**6502 Output**:
```asm
BRK         ; Software interrupt
```

### 2. Add OPT_BARRIER Case

**Location**: Add to `generateInstruction()` switch (~line 200)

```typescript
case ILOpcode.OPT_BARRIER:
  // Optimization barrier - no code generated, just a marker for optimizer
  this.emitComment('=== OPTIMIZATION BARRIER ===');
  break;
```

**6502 Output**:
```asm
; === OPTIMIZATION BARRIER ===
```

### 3. New Method: generateLo()

**Location**: After `generatePokew()` method (~line 540)

```typescript
/**
 * Generates code for INTRINSIC_LO instruction.
 *
 * Extracts the low byte of a 16-bit word value.
 * For little-endian storage, the low byte is at the base address.
 *
 * In most cases, the low byte is already in the accumulator from
 * previous 16-bit operations. This method handles the case where
 * the value is in a zero-page location.
 *
 * @param instr - Lo instruction
 */
protected generateLo(instr: ILLoInstruction): void {
  this.emitComment(`lo(${instr.operand}) -> ${instr.result}`);

  // For runtime values, we assume the 16-bit value computation left
  // the result in a known location. The low byte is the first byte.
  // In the current stub architecture, we assume the value is accessible.
  
  // For zero-page stored values, load the low byte directly
  // For register values, the low byte is already in A (from 16-bit ops)
  
  // Simplified stub: assume value computed and low byte in A
  // Full implementation would track value locations
  this.emitComment('Low byte extraction (value assumed in A)');
}
```

**6502 Output**:
```asm
; lo(v0) -> v1
; Low byte extraction (value assumed in A)
```

### 4. New Method: generateHi()

**Location**: After `generateLo()` method

```typescript
/**
 * Generates code for INTRINSIC_HI instruction.
 *
 * Extracts the high byte of a 16-bit word value.
 * For little-endian storage, the high byte is at address+1.
 *
 * For runtime values stored in zero page, this loads from zp+1.
 * For values in A/X register pair, this uses X (high byte).
 *
 * @param instr - Hi instruction
 */
protected generateHi(instr: ILHiInstruction): void {
  this.emitComment(`hi(${instr.operand}) -> ${instr.result}`);

  // For runtime values, we need to access the high byte
  // If the 16-bit value is in zero page at $FB/$FC:
  //   LDA $FC loads the high byte
  // If the value is in A(lo)/X(hi) register pair:
  //   TXA transfers high byte to A
  
  // Simplified stub: assume high byte in X, transfer to A
  this.emitInstruction('TXA', undefined, 'High byte to A', 1);
}
```

**6502 Output**:
```asm
; hi(v0) -> v1
TXA         ; High byte to A
```

### 5. New Method: generateVolatileRead()

**Location**: After `generateHi()` method

```typescript
/**
 * Generates code for VOLATILE_READ instruction.
 *
 * Performs a memory read that cannot be optimized away.
 * Functionally identical to peek(), but marked as volatile
 * so the optimizer will not eliminate or reorder this read.
 *
 * Essential for reading hardware registers where the read
 * itself has side effects (e.g., clearing interrupt flags).
 *
 * @param instr - Volatile read instruction
 */
protected generateVolatileRead(instr: ILVolatileReadInstruction): void {
  this.emitComment(`volatile_read(${instr.address}) -> ${instr.result} [VOLATILE]`);

  // Same as peek but with volatile marker for optimizer
  // Uses indirect addressing through ZP pointer
  this.emitInstruction('LDY', '#$00', 'Y = 0 for indirect indexed', 2);
  this.emitInstruction(
    'LDA',
    `(${this.formatZeroPage(InstructionGenerator.ZP_PTR)}),Y`,
    'Volatile load from address',
    2
  );
}
```

**6502 Output**:
```asm
; volatile_read($DC0D) -> v0 [VOLATILE]
LDY #$00    ; Y = 0 for indirect indexed
LDA ($FB),Y ; Volatile load from address
```

### 6. New Method: generateVolatileWrite()

**Location**: After `generateVolatileRead()` method

```typescript
/**
 * Generates code for VOLATILE_WRITE instruction.
 *
 * Performs a memory write that cannot be optimized away.
 * Functionally identical to poke(), but marked as volatile
 * so the optimizer will not eliminate or reorder this write.
 *
 * Essential for writing to hardware registers where the write
 * must actually occur (even if the value appears unchanged).
 *
 * @param instr - Volatile write instruction
 */
protected generateVolatileWrite(instr: ILVolatileWriteInstruction): void {
  this.emitComment(`volatile_write(${instr.address}, ${instr.value}) [VOLATILE]`);

  // Same as poke but with volatile marker for optimizer
  // Uses indirect addressing through ZP pointer
  this.emitInstruction('LDY', '#$00', 'Y = 0 for indirect indexed', 2);
  this.emitInstruction(
    'STA',
    `(${this.formatZeroPage(InstructionGenerator.ZP_PTR)}),Y`,
    'Volatile store to address',
    2
  );
}
```

**6502 Output**:
```asm
; volatile_write($D020, 14) [VOLATILE]
LDY #$00    ; Y = 0 for indirect indexed
STA ($FB),Y ; Volatile store to address
```

## Required Imports

Add to imports section if not already present:

```typescript
import {
  // ... existing imports ...
  ILLoInstruction,
  ILHiInstruction,
  ILVolatileReadInstruction,
  ILVolatileWriteInstruction,
} from '../il/instructions.js';
```

## Switch Statement Updates

Add these cases to `generateInstruction()` switch statement:

```typescript
// ====== Optimization Control ======
case ILOpcode.OPT_BARRIER:
  // Optimization barrier - no code generated, just a marker
  this.emitComment('=== OPTIMIZATION BARRIER ===');
  break;

// ====== Byte Extraction Intrinsics ======
case ILOpcode.INTRINSIC_LO:
  this.generateLo(instr as ILLoInstruction);
  break;

case ILOpcode.INTRINSIC_HI:
  this.generateHi(instr as ILHiInstruction);
  break;

// ====== Volatile Memory Operations ======
case ILOpcode.VOLATILE_READ:
  this.generateVolatileRead(instr as ILVolatileReadInstruction);
  break;

case ILOpcode.VOLATILE_WRITE:
  this.generateVolatileWrite(instr as ILVolatileWriteInstruction);
  break;
```

And add `CPU_BRK` to the existing CPU instruction case list:

```typescript
case ILOpcode.CPU_SEI:
case ILOpcode.CPU_CLI:
case ILOpcode.CPU_NOP:
case ILOpcode.CPU_BRK:  // <-- ADD THIS
case ILOpcode.CPU_PHA:
case ILOpcode.CPU_PLA:
case ILOpcode.CPU_PHP:
case ILOpcode.CPU_PLP:
  this.generateCpuInstruction(instr as ILCpuInstruction);
  break;
```

## Code Examples

### Example: Using brk() for debugging

**Blend65 Source**:
```js
export function debugPoint(): void
  brk();
end function
```

**Generated Assembly**:
```asm
_debugPoint:
  BRK         ; Software interrupt
  RTS         ; Return void
```

### Example: Using barrier() for timing

**Blend65 Source**:
```js
export function timedWrite(): void
  poke($D020, 14);
  barrier();
  poke($D021, 6);
end function
```

**Generated Assembly**:
```asm
_timedWrite:
  LDA #14
  STA $D020   ; Write to $D020
  ; === OPTIMIZATION BARRIER ===
  LDA #6
  STA $D021   ; Write to $D021
  RTS
```

### Example: Using volatile_read() for hardware polling

**Blend65 Source**:
```js
let status: byte = volatile_read($DC0D);
```

**Generated Assembly**:
```asm
; volatile_read($DC0D) -> v0 [VOLATILE]
LDY #$00    ; Y = 0 for indirect indexed
LDA ($FB),Y ; Volatile load from address
```

## Error Handling

No new error conditions need to be added. These intrinsics always generate valid code.

## Testing Requirements

See [Testing Strategy](07-testing-strategy.md) for detailed test cases.

- Unit tests for each new method
- Integration tests for end-to-end compilation
- Verify no regressions in existing tests