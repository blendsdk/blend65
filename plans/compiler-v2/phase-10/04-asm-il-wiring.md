# ASM Function IL Wiring

> **Document**: 04-asm-il-wiring.md
> **Parent**: [Index](00-index.md)

## Overview

Wire all 151 `asm_*()` functions into the IL generator so that when the compiler encounters a call to an `asm_*` function, it emits the appropriate IL instruction instead of a normal function call.

## Current State

The v2 IL generator (`packages/compiler-v2/src/il/generator/expressions.ts`) already handles 8 intrinsics:
- `peek`, `poke`, `peekw`, `pokew` → `ILOpcode.PEEK/POKE/PEEKW/POKEW`
- `volatile_read`, `volatile_write` → same as PEEK/POKE with volatile flag
- `hi`, `lo` → `ILOpcode.HI/LO`

The v2 IL opcode enum (`il/enums.ts`) already has some relevant opcodes:
- `NOP` — for `asm_nop()`
- `PUSH_A` — for `asm_pha()`
- `POP_A` — for `asm_pla()`

## Design: ASM_RAW IL Opcode

### Approach: Single `ASM_RAW` Opcode

Rather than creating 143 individual IL opcodes, use a **single `ASM_RAW` opcode** with metadata specifying the 6502 mnemonic and addressing mode:

```typescript
// New IL opcode
ASM_RAW = 'ASM_RAW'

// Operand carries the 6502 instruction details
interface AsmRawOperand {
  mnemonic: string;         // e.g., 'LDA', 'STA', 'SEI'
  addressingMode: string;   // e.g., 'implied', 'immediate', 'zeroPage', 'absolute', etc.
}
```

### Why This Design

1. **Minimal IL changes** — only 1 new opcode instead of 143
2. **Clean separation** — IL stays abstract, codegen maps to concrete instructions
3. **Easy to extend** — adding 65C02 opcodes later just adds more mnemonic strings
4. **Code generator already has addressing mode support** via `AddressingModeHint` enum

### Addressing Mode Mapping

| `asm_*` suffix | `addressingMode` value | 6502 syntax |
|----------------|----------------------|-------------|
| (none) | `'implied'` | `SEI` |
| `_imm` | `'immediate'` | `LDA #$00` |
| `_zp` | `'zeroPage'` | `LDA $00` |
| `_zpx` | `'zeroPageX'` | `LDA $00,X` |
| `_zpy` | `'zeroPageY'` | `LDX $00,Y` |
| `_abs` | `'absolute'` | `LDA $1234` |
| `_abx` | `'absoluteX'` | `LDA $1234,X` |
| `_aby` | `'absoluteY'` | `LDA $1234,Y` |
| `_ind` | `'indirect'` | `JMP ($1234)` |
| `_inx` | `'indirectX'` | `LDA ($00,X)` |
| `_iny` | `'indirectY'` | `LDA ($00),Y` |
| `_rel` | `'relative'` | `BEQ offset` |

## Implementation Steps

### Step 1: Add ASM_RAW to ILOpcode enum

File: `packages/compiler-v2/src/il/enums.ts`

```typescript
/**
 * Raw 6502 assembly instruction.
 * Operands: [AsmRawOperand] + optional [ImmediateOrAddressOperand]
 * Maps to exactly one 6502 instruction.
 * Used by asm_*() functions.
 */
ASM_RAW = 'ASM_RAW',
```

### Step 2: Add AsmRawOperand type

File: `packages/compiler-v2/src/il/operands.ts`

```typescript
export interface AsmRawOperand {
  kind: 'asm_raw';
  mnemonic: string;       // 6502 mnemonic: 'LDA', 'STA', 'SEI', etc.
  addressingMode: string; // 'implied', 'immediate', 'zeroPage', etc.
}
```

### Step 3: Add asm_* detection in IL generator

File: `packages/compiler-v2/src/il/generator/expressions.ts`

In the function call handling logic, add detection for `asm_*` prefix:

```typescript
// Pseudocode
if (functionName.startsWith('asm_')) {
  const { mnemonic, addressingMode } = parseAsmFunctionName(functionName);
  // Evaluate argument (if any) into accumulator or as immediate
  // Emit ASM_RAW instruction
  this.emit(ILOpcode.ASM_RAW, asmRawOperand(mnemonic, addressingMode), argOperand?);
  return;
}
```

### Step 4: Create asm function name parser utility

```typescript
/**
 * Parse an asm_* function name into mnemonic and addressing mode.
 * e.g., 'asm_lda_imm' → { mnemonic: 'LDA', addressingMode: 'immediate' }
 * e.g., 'asm_sei' → { mnemonic: 'SEI', addressingMode: 'implied' }
 */
function parseAsmFunctionName(name: string): { mnemonic: string; addressingMode: string }
```

## Testing Requirements

- Unit test: `parseAsmFunctionName()` for all naming patterns
- Unit test: IL generator emits `ASM_RAW` for implied-mode functions (asm_sei, asm_nop, etc.)
- Unit test: IL generator emits `ASM_RAW` with argument for addressed functions (asm_lda_imm, asm_sta_abs, etc.)
- Integration test: Full pipeline from source with asm_* calls → correct IL output
- Test all 12 addressing mode suffixes

## Dependencies

- IL enum and operand types (already exist, need extension)
- IL generator expression handling (already exists, need extension)
- asm.blend must be parseable (03-asm-blend-declarations.md)
