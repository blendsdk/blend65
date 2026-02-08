# ASM Function Code Generation

> **Document**: 05-asm-codegen.md
> **Parent**: [Index](00-index.md)

## Overview

Implement code generation for `ASM_RAW` IL instructions, translating each into the corresponding 6502 assembly instruction in the ASM-IL output.

## Current State

The v2 code generator uses an inheritance chain:
`CodeGeneratorBase → MemoryOps → ArithmeticOps → BitwiseOps → ComparisonOps → ControlFlowOps → FunctionOps → IntrinsicsOps → CodeGenerator`

The `IntrinsicsOps` layer (`codegen/generator/intrinsics.ts`) already handles:
- `PEEK/POKE/PEEKW/POKEW` → `LDA/STA` instructions
- `HI/LO` → byte extraction
- `NOP` → `NOP` instruction
- `PUSH_A/POP_A` → `PHA/PLA`

## Design

### Add ASM_RAW handler to IntrinsicsOps layer

The `IntrinsicsOps` layer is the natural place for `ASM_RAW` handling since asm_* functions are a form of compiler intrinsic.

### Code Generation Logic

```typescript
// Pseudocode for ASM_RAW code generation
case ILOpcode.ASM_RAW: {
  const asmOp = instruction.operands[0] as AsmRawOperand;
  const { mnemonic, addressingMode } = asmOp;

  switch (addressingMode) {
    case 'implied':
      // e.g., SEI, CLI, NOP, TAX, PHA
      this.emit(mnemonic);
      break;

    case 'immediate':
      // e.g., LDA #value
      const immValue = instruction.operands[1];
      this.emit(`${mnemonic} #${formatOperand(immValue)}`);
      break;

    case 'zeroPage':
      // e.g., LDA $nn
      this.emit(`${mnemonic} ${formatAddress(instruction.operands[1])}`);
      break;

    case 'zeroPageX':
      // e.g., LDA $nn,X
      this.emit(`${mnemonic} ${formatAddress(instruction.operands[1])},X`);
      break;

    // ... etc for all 12 addressing modes
  }
}
```

### ASM-IL Output Format

Each `ASM_RAW` instruction generates **exactly one** ASM-IL instruction:

| Addressing Mode | ASM-IL Output Example |
|-----------------|----------------------|
| implied | `SEI` |
| immediate | `LDA #$00` |
| zeroPage | `LDA $FB` |
| zeroPageX | `LDA $FB,X` |
| zeroPageY | `LDX $FB,Y` |
| absolute | `LDA $D020` |
| absoluteX | `LDA $D020,X` |
| absoluteY | `LDA $D020,Y` |
| indirect | `JMP ($FFFE)` |
| indirectX | `LDA ($FB,X)` |
| indirectY | `LDA ($FB),Y` |
| relative | `BEQ *+offset` |

## Implementation Steps

### Step 1: Add ASM_RAW case to IntrinsicsOps

File: `packages/compiler-v2/src/codegen/generator/intrinsics.ts`

Add handling for `ILOpcode.ASM_RAW` in the instruction dispatch.

### Step 2: Implement addressing mode formatter

Create a helper that formats the operand with the correct 6502 addressing mode syntax.

### Step 3: Handle argument evaluation

For asm_* functions with arguments (immediate, address), the IL generator will have already evaluated the argument. The code generator needs to:
- For immediate: use the value directly as `#value`
- For address (zp/abs): use the value as an address

## Testing Requirements

- Unit test: Each addressing mode generates correct ASM-IL
- Unit test: Implied mode generates single mnemonic
- Unit test: Immediate mode generates `MNEMONIC #value`
- Unit test: All 12 addressing modes produce correct syntax
- Integration test: asm_* call → IL → ASM-IL → correct output

## Dependencies

- ASM_RAW IL opcode (04-asm-il-wiring.md)
- Existing codegen intrinsics layer
