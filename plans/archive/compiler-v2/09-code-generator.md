# Code Generator: Compiler v2

> **Document**: 09-code-generator.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Planning Complete

## Overview

The Code Generator transforms IL instructions into 6502 assembly code. Unlike v1's complex SSA/PHI-handling codegen, v2's code generator is straightforward:
- Direct IL-to-ASM mapping (1-3 instructions per IL opcode)
- No register allocation (variables have static addresses)
- No PHI resolution needed
- Simple accumulator tracking for minor optimizations

## Design Principles

### 1. Direct Mapping

Each IL opcode maps directly to a known pattern of 6502 instructions:

| IL Opcode | 6502 Pattern |
|-----------|--------------|
| LOAD_BYTE addr | `LDA addr` |
| STORE_BYTE addr | `STA addr` |
| ADD_BYTE addr | `CLC` + `ADC addr` |
| JUMP label | `JMP label` |
| CALL func | `JSR func` |
| RETURN | `RTS` |

### 2. Accumulator Tracking

Track what's in A to avoid redundant loads:

```asm
; Without tracking:
LDA value
STA temp
LDA value    ; redundant!
STA other

; With tracking:
LDA value
STA temp
STA other    ; A still has value
```

### 3. Output to ASM-IL

Generate to ASM-IL intermediate format (same as v1), then emit to ACME assembler syntax.

---

## Code Generator Implementation

```typescript
// codegen/generator.ts

/**
 * Generate 6502 assembly from IL.
 */
export class CodeGenerator {
  /** ASM-IL builder for output */
  protected asm: AsmILBuilder;
  /** Track what's currently in A */
  protected aRegister: AccumulatorState;
  /** Current function being generated */
  protected currentFunction: string | null = null;

  constructor() {
    this.asm = new AsmILBuilder();
    this.aRegister = { known: false };
  }

  /**
   * Generate assembly for entire IL program.
   */
  generate(program: ILProgram): AsmILProgram {
    // Emit program header
    this.emitHeader(program);

    // Emit global variable initialization
    this.emitGlobals(program.globals);

    // Emit each function
    for (const func of program.functions) {
      this.generateFunction(func);
    }

    // Emit runtime support routines
    this.emitRuntime();

    return this.asm.getProgram();
  }

  /**
   * Emit program header (BASIC stub, entry point).
   */
  protected emitHeader(program: ILProgram): void {
    this.asm.comment('Blend65 v2 Generated Code');
    this.asm.comment(`Module: ${program.moduleName}`);
    this.asm.blank();

    // BASIC stub
    this.asm.directive('*=$0801');
    this.emitBasicStub();

    // Entry point
    this.asm.label('_start');
    
    // Initialize globals
    this.asm.instruction('JSR', '_init_globals');
    
    // Call main
    this.asm.instruction('JSR', 'main');
    
    // Return to BASIC
    this.asm.instruction('RTS');
  }

  /**
   * Generate code for a function.
   */
  protected generateFunction(func: ILFunction): void {
    this.currentFunction = func.name;
    this.aRegister = { known: false };

    this.asm.blank();
    this.asm.comment(`Function: ${func.name}`);
    this.asm.comment(`Frame: $${func.frame.baseAddress.toString(16)}`);
    this.asm.label(func.name);

    // Generate each IL instruction
    for (const instr of func.instructions) {
      this.generateInstruction(instr);
    }
  }

  /**
   * Generate code for a single IL instruction.
   */
  protected generateInstruction(instr: ILInstruction): void {
    // Add comment for debugging
    if (instr.comment) {
      this.asm.comment(instr.comment);
    }

    switch (instr.opcode) {
      // === Memory Operations ===
      case ILOpcode.LOAD_BYTE:
        this.genLoadByte(instr);
        break;
      case ILOpcode.STORE_BYTE:
        this.genStoreByte(instr);
        break;
      case ILOpcode.LOAD_WORD:
        this.genLoadWord(instr);
        break;
      case ILOpcode.STORE_WORD:
        this.genStoreWord(instr);
        break;
      case ILOpcode.LOAD_IMM:
        this.genLoadImm(instr);
        break;
      case ILOpcode.LOAD_IMM_WORD:
        this.genLoadImmWord(instr);
        break;

      // === Arithmetic ===
      case ILOpcode.ADD_BYTE:
        this.genAddByte(instr);
        break;
      case ILOpcode.SUB_BYTE:
        this.genSubByte(instr);
        break;
      case ILOpcode.ADD_IMM:
        this.genAddImm(instr);
        break;
      case ILOpcode.SUB_IMM:
        this.genSubImm(instr);
        break;
      case ILOpcode.MUL_BYTE:
        this.genMulByte(instr);
        break;
      case ILOpcode.DIV_BYTE:
        this.genDivByte(instr);
        break;
      case ILOpcode.MOD_BYTE:
        this.genModByte(instr);
        break;

      // === Bitwise ===
      case ILOpcode.AND_BYTE:
        this.genAndByte(instr);
        break;
      case ILOpcode.OR_BYTE:
        this.genOrByte(instr);
        break;
      case ILOpcode.XOR_BYTE:
        this.genXorByte(instr);
        break;
      case ILOpcode.NOT_BYTE:
        this.genNotByte(instr);
        break;
      case ILOpcode.SHL_BYTE:
        this.genShlByte(instr);
        break;
      case ILOpcode.SHR_BYTE:
        this.genShrByte(instr);
        break;

      // === Comparison ===
      case ILOpcode.CMP_BYTE:
        this.genCmpByte(instr);
        break;
      case ILOpcode.CMP_IMM:
        this.genCmpImm(instr);
        break;

      // === Control Flow ===
      case ILOpcode.LABEL:
        this.genLabel(instr);
        break;
      case ILOpcode.JUMP:
        this.genJump(instr);
        break;
      case ILOpcode.JUMP_EQ:
        this.genJumpEq(instr);
        break;
      case ILOpcode.JUMP_NE:
        this.genJumpNe(instr);
        break;
      case ILOpcode.JUMP_LT:
        this.genJumpLt(instr);
        break;
      case ILOpcode.JUMP_GE:
        this.genJumpGe(instr);
        break;
      case ILOpcode.JUMP_LE:
        this.genJumpLe(instr);
        break;
      case ILOpcode.JUMP_GT:
        this.genJumpGt(instr);
        break;

      // === Functions ===
      case ILOpcode.CALL:
        this.genCall(instr);
        break;
      case ILOpcode.RETURN:
        this.genReturn(instr);
        break;

      // === Intrinsics ===
      case ILOpcode.PEEK:
        this.genPeek(instr);
        break;
      case ILOpcode.POKE:
        this.genPoke(instr);
        break;
      case ILOpcode.PEEKW:
        this.genPeekw(instr);
        break;
      case ILOpcode.POKEW:
        this.genPokew(instr);
        break;
      case ILOpcode.HI:
        this.genHi(instr);
        break;
      case ILOpcode.LO:
        this.genLo(instr);
        break;

      default:
        throw new Error(`Unknown IL opcode: ${instr.opcode}`);
    }
  }

  // === Memory Operations ===

  protected genLoadByte(instr: ILInstruction): void {
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    
    // Skip if A already has this value
    if (this.aRegister.known && this.aRegister.address === addr) {
      return;
    }

    this.asm.instruction('LDA', this.formatAddress(addr));
    this.aRegister = { known: true, address: addr };
  }

  protected genStoreByte(instr: ILInstruction): void {
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('STA', this.formatAddress(addr));
    this.aRegister = { known: true, address: addr };
  }

  protected genLoadWord(instr: ILInstruction): void {
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('LDA', this.formatAddress(addr));
    this.asm.instruction('LDX', this.formatAddress(addr + 1));
    this.aRegister = { known: false };
  }

  protected genStoreWord(instr: ILInstruction): void {
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('STA', this.formatAddress(addr));
    this.asm.instruction('STX', this.formatAddress(addr + 1));
    this.aRegister = { known: false };
  }

  protected genLoadImm(instr: ILInstruction): void {
    const value = (instr.operands[0] as { kind: 'immediate'; value: number }).value;
    
    // Skip if A already has this immediate
    if (this.aRegister.known && this.aRegister.immediate === value) {
      return;
    }

    this.asm.instruction('LDA', `#${value}`);
    this.aRegister = { known: true, immediate: value };
  }

  protected genLoadImmWord(instr: ILInstruction): void {
    const value = (instr.operands[0] as { kind: 'immediate'; value: number }).value;
    const lo = value & 0xFF;
    const hi = (value >> 8) & 0xFF;
    this.asm.instruction('LDA', `#${lo}`);
    this.asm.instruction('LDX', `#${hi}`);
    this.aRegister = { known: false };
  }

  // === Arithmetic ===

  protected genAddByte(instr: ILInstruction): void {
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('CLC');
    this.asm.instruction('ADC', this.formatAddress(addr));
    this.aRegister = { known: false };
  }

  protected genSubByte(instr: ILInstruction): void {
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('SEC');
    this.asm.instruction('SBC', this.formatAddress(addr));
    this.aRegister = { known: false };
  }

  protected genAddImm(instr: ILInstruction): void {
    const value = (instr.operands[0] as { kind: 'immediate'; value: number }).value;
    this.asm.instruction('CLC');
    this.asm.instruction('ADC', `#${value}`);
    this.aRegister = { known: false };
  }

  protected genSubImm(instr: ILInstruction): void {
    const value = (instr.operands[0] as { kind: 'immediate'; value: number }).value;
    this.asm.instruction('SEC');
    this.asm.instruction('SBC', `#${value}`);
    this.aRegister = { known: false };
  }

  protected genMulByte(instr: ILInstruction): void {
    // Software multiply - call runtime routine
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('STA', '_mul_a');
    this.asm.instruction('LDA', this.formatAddress(addr));
    this.asm.instruction('STA', '_mul_b');
    this.asm.instruction('JSR', '_mul_byte');
    this.aRegister = { known: false };
  }

  protected genDivByte(instr: ILInstruction): void {
    // Software divide - call runtime routine
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('STA', '_div_a');
    this.asm.instruction('LDA', this.formatAddress(addr));
    this.asm.instruction('STA', '_div_b');
    this.asm.instruction('JSR', '_div_byte');
    this.aRegister = { known: false };
  }

  protected genModByte(instr: ILInstruction): void {
    // Software modulo - call runtime routine
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('STA', '_mod_a');
    this.asm.instruction('LDA', this.formatAddress(addr));
    this.asm.instruction('STA', '_mod_b');
    this.asm.instruction('JSR', '_mod_byte');
    this.aRegister = { known: false };
  }

  // === Bitwise ===

  protected genAndByte(instr: ILInstruction): void {
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('AND', this.formatAddress(addr));
    this.aRegister = { known: false };
  }

  protected genOrByte(instr: ILInstruction): void {
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('ORA', this.formatAddress(addr));
    this.aRegister = { known: false };
  }

  protected genXorByte(instr: ILInstruction): void {
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('EOR', this.formatAddress(addr));
    this.aRegister = { known: false };
  }

  protected genNotByte(instr: ILInstruction): void {
    this.asm.instruction('EOR', '#$FF');
    this.aRegister = { known: false };
  }

  protected genShlByte(instr: ILInstruction): void {
    const count = (instr.operands[0] as { kind: 'immediate'; value: number }).value;
    for (let i = 0; i < count; i++) {
      this.asm.instruction('ASL', 'A');
    }
    this.aRegister = { known: false };
  }

  protected genShrByte(instr: ILInstruction): void {
    const count = (instr.operands[0] as { kind: 'immediate'; value: number }).value;
    for (let i = 0; i < count; i++) {
      this.asm.instruction('LSR', 'A');
    }
    this.aRegister = { known: false };
  }

  // === Comparison ===

  protected genCmpByte(instr: ILInstruction): void {
    const addr = (instr.operands[0] as { kind: 'address'; address: number }).address;
    this.asm.instruction('CMP', this.formatAddress(addr));
  }

  protected genCmpImm(instr: ILInstruction): void {
    const value = (instr.operands[0] as { kind: 'immediate'; value: number }).value;
    this.asm.instruction('CMP', `#${value}`);
  }

  // === Control Flow ===

  protected genLabel(instr: ILInstruction): void {
    const name = (instr.operands[0] as { kind: 'label'; name: string }).name;
    this.asm.label(`.${name}`);
    this.aRegister = { known: false }; // Unknown after label
  }

  protected genJump(instr: ILInstruction): void {
    const name = (instr.operands[0] as { kind: 'label'; name: string }).name;
    this.asm.instruction('JMP', `.${name}`);
  }

  protected genJumpEq(instr: ILInstruction): void {
    const name = (instr.operands[0] as { kind: 'label'; name: string }).name;
    this.asm.instruction('BEQ', `.${name}`);
  }

  protected genJumpNe(instr: ILInstruction): void {
    const name = (instr.operands[0] as { kind: 'label'; name: string }).name;
    this.asm.instruction('BNE', `.${name}`);
  }

  protected genJumpLt(instr: ILInstruction): void {
    const name = (instr.operands[0] as { kind: 'label'; name: string }).name;
    this.asm.instruction('BCC', `.${name}`);
  }

  protected genJumpGe(instr: ILInstruction): void {
    const name = (instr.operands[0] as { kind: 'label'; name: string }).name;
    this.asm.instruction('BCS', `.${name}`);
  }

  protected genJumpLe(instr: ILInstruction): void {
    // A <= B: BCC or BEQ (carry clear or zero set)
    const name = (instr.operands[0] as { kind: 'label'; name: string }).name;
    this.asm.instruction('BCC', `.${name}`);
    this.asm.instruction('BEQ', `.${name}`);
  }

  protected genJumpGt(instr: ILInstruction): void {
    // A > B: BCS and BNE (carry set and zero clear)
    const name = (instr.operands[0] as { kind: 'label'; name: string }).name;
    this.asm.instruction('BEQ', `.skip_${name}`);
    this.asm.instruction('BCS', `.${name}`);
    this.asm.label(`.skip_${name}`);
  }

  // === Functions ===

  protected genCall(instr: ILInstruction): void {
    const name = (instr.operands[0] as { kind: 'function'; name: string }).name;
    this.asm.instruction('JSR', name);
    this.aRegister = { known: false }; // Clobbered by call
  }

  protected genReturn(instr: ILInstruction): void {
    this.asm.instruction('RTS');
  }

  // === Intrinsics ===

  protected genPeek(instr: ILInstruction): void {
    // A contains the low byte of address, X contains high byte
    // Use zero-page indirect: store to $FB/$FC, then LDA ($FB),Y
    this.asm.instruction('STA', '$FB');
    this.asm.instruction('STX', '$FC');
    this.asm.instruction('LDY', '#0');
    this.asm.instruction('LDA', '($FB),Y');
    this.aRegister = { known: false };
  }

  protected genPoke(instr: ILInstruction): void {
    // Value in A, address needs to be set up
    // Store value, set up address, then STA ($FB),Y
    this.asm.instruction('STA', '$FD');  // Save value
    // Address setup depends on how arguments are passed
    this.asm.instruction('LDY', '#0');
    this.asm.instruction('LDA', '$FD');
    this.asm.instruction('STA', '($FB),Y');
    this.aRegister = { known: false };
  }

  protected genPeekw(instr: ILInstruction): void {
    // Similar to peek but load two bytes
    this.asm.instruction('STA', '$FB');
    this.asm.instruction('STX', '$FC');
    this.asm.instruction('LDY', '#0');
    this.asm.instruction('LDA', '($FB),Y');
    this.asm.instruction('PHA');
    this.asm.instruction('INY');
    this.asm.instruction('LDA', '($FB),Y');
    this.asm.instruction('TAX');
    this.asm.instruction('PLA');
    this.aRegister = { known: false };
  }

  protected genPokew(instr: ILInstruction): void {
    // Store word (two bytes)
    this.asm.instruction('LDY', '#0');
    this.asm.instruction('STA', '($FB),Y');
    this.asm.instruction('INY');
    this.asm.instruction('TXA');
    this.asm.instruction('STA', '($FB),Y');
    this.aRegister = { known: false };
  }

  protected genHi(instr: ILInstruction): void {
    // Word is in A/X, move X (high byte) to A
    this.asm.instruction('TXA');
    this.aRegister = { known: false };
  }

  protected genLo(instr: ILInstruction): void {
    // A already has low byte, nothing to do
  }

  // === Helpers ===

  protected formatAddress(addr: number): string {
    return `$${addr.toString(16).toUpperCase().padStart(4, '0')}`;
  }

  protected emitBasicStub(): void {
    // Standard C64 BASIC stub: 10 SYS 2061
    this.asm.data([0x0C, 0x08, 0x0A, 0x00, 0x9E, 0x20, 0x32, 
                   0x30, 0x36, 0x31, 0x00, 0x00, 0x00]);
  }

  protected emitRuntime(): void {
    this.asm.blank();
    this.asm.comment('Runtime Support Routines');
    
    // Multiply routine
    this.asm.label('_mul_byte');
    // ... multiply implementation
    this.asm.instruction('RTS');

    // Divide routine
    this.asm.label('_div_byte');
    // ... divide implementation
    this.asm.instruction('RTS');

    // Modulo routine
    this.asm.label('_mod_byte');
    // ... modulo implementation
    this.asm.instruction('RTS');
  }

  protected emitGlobals(globals: ILInstruction[]): void {
    this.asm.label('_init_globals');
    for (const instr of globals) {
      this.generateInstruction(instr);
    }
    this.asm.instruction('RTS');
  }
}

// Accumulator state tracking
interface AccumulatorState {
  known: boolean;
  address?: number;
  immediate?: number;
}
```

---

## Migration Tasks

### Session 8.1: CodeGen Base

| # | Task | File | Description |
|---|------|------|-------------|
| 8.1.1 | Create types.ts | `codegen/types.ts` | CodeGen types |
| 8.1.2 | Create generator.ts | `codegen/generator.ts` | CodeGenerator class |
| 8.1.3 | Implement memory ops | `codegen/generator.ts` | Load/store |
| 8.1.4 | Add base tests | `__tests__/codegen/base.test.ts` | Memory op tests |

### Session 8.2: Arithmetic & Bitwise

| # | Task | File | Description |
|---|------|------|-------------|
| 8.2.1 | Implement add/sub | `codegen/generator.ts` | Addition, subtraction |
| 8.2.2 | Implement mul/div/mod | `codegen/generator.ts` | Software routines |
| 8.2.3 | Implement bitwise | `codegen/generator.ts` | AND/OR/XOR/NOT |
| 8.2.4 | Implement shifts | `codegen/generator.ts` | SHL/SHR |
| 8.2.5 | Add arithmetic tests | `__tests__/codegen/` | Arithmetic tests |

### Session 8.3: Control Flow

| # | Task | File | Description |
|---|------|------|-------------|
| 8.3.1 | Implement compare | `codegen/generator.ts` | CMP ops |
| 8.3.2 | Implement jumps | `codegen/generator.ts` | All jump variants |
| 8.3.3 | Implement labels | `codegen/generator.ts` | Label emission |
| 8.3.4 | Add control flow tests | `__tests__/codegen/` | Branch tests |

### Session 8.4: Functions & Intrinsics

| # | Task | File | Description |
|---|------|------|-------------|
| 8.4.1 | Implement call/return | `codegen/generator.ts` | JSR/RTS |
| 8.4.2 | Implement peek/poke | `codegen/generator.ts` | Memory intrinsics |
| 8.4.3 | Implement hi/lo | `codegen/generator.ts` | Byte extraction |
| 8.4.4 | Create intrinsics.ts | `codegen/intrinsics.ts` | asm_* handlers |
| 8.4.5 | Add function tests | `__tests__/codegen/` | Function tests |

### Session 8.5: Integration

| # | Task | File | Description |
|---|------|------|-------------|
| 8.5.1 | Implement header | `codegen/generator.ts` | BASIC stub, entry |
| 8.5.2 | Implement runtime | `codegen/generator.ts` | Support routines |
| 8.5.3 | Create emitter.ts | `codegen/emitter.ts` | ACME output |
| 8.5.4 | Create index.ts | `codegen/index.ts` | Exports |
| 8.5.5 | Add E2E tests | `__tests__/codegen/` | Full pipeline tests |
| 8.5.6 | Run all tests | - | Verify |

---

## Verification Checklist

- [ ] All IL opcodes handled
- [ ] Memory operations generate correct ASM
- [ ] Arithmetic generates correct ASM
- [ ] Bitwise operations work
- [ ] Comparisons set flags correctly
- [ ] All jump types work
- [ ] Function calls pass parameters
- [ ] Return values retrieved correctly
- [ ] Intrinsics generate correct code
- [ ] Runtime routines included
- [ ] BASIC stub correct
- [ ] All tests pass

---

## Related Documents

| Document | Description |
|----------|-------------|
| [08-il-generator.md](08-il-generator.md) | IL generator (input) |
| [10-asm-optimizer.md](10-asm-optimizer.md) | Next: ASM optimization |
| [99-execution-plan.md](99-execution-plan.md) | Full task list |