/**
 * ASM_RAW Code Generation Tests
 *
 * Tests that ASM_RAW IL instructions generate the correct 6502
 * assembly output for all 12 addressing modes.
 *
 * @module __tests__/codegen/unit/asm-raw
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILOpcode } from '../../../il/enums.js';
import { ILInstruction } from '../../../il/instruction.js';
import { AsmRawOperand, ILOperand } from '../../../il/operands.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';
import {
  TestableIntrinsicsOpsGenerator,
} from './_intrinsics-helpers.js';

// ============================================================================
// Helper: Create ASM_RAW IL instruction
// ============================================================================

/**
 * Creates an ASM_RAW IL instruction with the given mnemonic and addressing mode.
 *
 * @param mnemonic - 6502 mnemonic (e.g., 'SEI', 'LDA')
 * @param addressingMode - Addressing mode string (e.g., 'implied', 'immediate')
 * @returns IL instruction with ASM_RAW opcode
 */
function createAsmRawInstr(mnemonic: string, addressingMode: string): ILInstruction {
  const asmOp: AsmRawOperand = {
    kind: 'asm_raw',
    mnemonic,
    addressingMode,
  };
  return {
    opcode: ILOpcode.ASM_RAW,
    operands: [asmOp] as ILOperand[],
    comment: `asm_raw: ${mnemonic}`,
  };
}

/**
 * Extracts all generated 6502 instructions from the testable generator.
 *
 * @param gen - Testable generator instance
 * @returns Array of {mnemonic, mode} objects
 */
function getGeneratedInstructions(gen: TestableIntrinsicsOpsGenerator): Array<{
  mnemonic: string;
  mode: AsmAddressingMode;
  operand?: number;
}> {
  return gen.getElements()
    .filter(isInstructionElement)
    .map(el => ({
      mnemonic: el.instruction.mnemonic,
      mode: el.instruction.mode,
      operand: el.instruction.operand,
    }));
}

// ============================================================================
// Implied Mode Tests
// ============================================================================

describe('CodeGen ASM_RAW: implied mode', () => {
  let gen: TestableIntrinsicsOpsGenerator;

  beforeEach(() => {
    gen = new TestableIntrinsicsOpsGenerator();
  });

  it('should generate SEI for implied mode', () => {
    const instr = createAsmRawInstr('SEI', 'implied');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const seiInstr = instructions.find(i => i.mnemonic === 'SEI');
    expect(seiInstr).toBeDefined();
    expect(seiInstr!.mode).toBe(AsmAddressingMode.Implied);
  });

  it('should generate NOP for implied mode', () => {
    const instr = createAsmRawInstr('NOP', 'implied');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const nopInstr = instructions.find(i => i.mnemonic === 'NOP');
    expect(nopInstr).toBeDefined();
    expect(nopInstr!.mode).toBe(AsmAddressingMode.Implied);
  });

  it('should generate TAX for implied mode', () => {
    const instr = createAsmRawInstr('TAX', 'implied');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const taxInstr = instructions.find(i => i.mnemonic === 'TAX');
    expect(taxInstr).toBeDefined();
    expect(taxInstr!.mode).toBe(AsmAddressingMode.Implied);
  });

  it('should generate PHA for implied mode', () => {
    const instr = createAsmRawInstr('PHA', 'implied');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const phaInstr = instructions.find(i => i.mnemonic === 'PHA');
    expect(phaInstr).toBeDefined();
    expect(phaInstr!.mode).toBe(AsmAddressingMode.Implied);
  });

  it('should generate RTS for implied mode', () => {
    const instr = createAsmRawInstr('RTS', 'implied');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const rtsInstr = instructions.find(i => i.mnemonic === 'RTS');
    expect(rtsInstr).toBeDefined();
    expect(rtsInstr!.mode).toBe(AsmAddressingMode.Implied);
  });

  it('should generate CLC for implied mode', () => {
    const instr = createAsmRawInstr('CLC', 'implied');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const clcInstr = instructions.find(i => i.mnemonic === 'CLC');
    expect(clcInstr).toBeDefined();
    expect(clcInstr!.mode).toBe(AsmAddressingMode.Implied);
  });

  it('should not have an operand for implied mode', () => {
    const instr = createAsmRawInstr('SEI', 'implied');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const seiInstr = instructions.find(i => i.mnemonic === 'SEI');
    expect(seiInstr).toBeDefined();
    expect(seiInstr!.operand).toBeUndefined();
  });
});

// ============================================================================
// Addressed Mode Tests
// ============================================================================

describe('CodeGen ASM_RAW: addressed modes', () => {
  let gen: TestableIntrinsicsOpsGenerator;

  beforeEach(() => {
    gen = new TestableIntrinsicsOpsGenerator();
  });

  it('should generate LDA with Immediate mode', () => {
    const instr = createAsmRawInstr('LDA', 'immediate');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const ldaInstr = instructions.find(i => i.mnemonic === 'LDA');
    expect(ldaInstr).toBeDefined();
    expect(ldaInstr!.mode).toBe(AsmAddressingMode.Immediate);
  });

  it('should generate LDA with ZeroPage mode', () => {
    const instr = createAsmRawInstr('LDA', 'zeroPage');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const ldaInstr = instructions.find(i => i.mnemonic === 'LDA');
    expect(ldaInstr).toBeDefined();
    expect(ldaInstr!.mode).toBe(AsmAddressingMode.ZeroPage);
  });

  it('should generate LDA with ZeroPageX mode', () => {
    const instr = createAsmRawInstr('LDA', 'zeroPageX');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const ldaInstr = instructions.find(i => i.mnemonic === 'LDA');
    expect(ldaInstr).toBeDefined();
    expect(ldaInstr!.mode).toBe(AsmAddressingMode.ZeroPageX);
  });

  it('should generate LDX with ZeroPageY mode', () => {
    const instr = createAsmRawInstr('LDX', 'zeroPageY');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const ldxInstr = instructions.find(i => i.mnemonic === 'LDX');
    expect(ldxInstr).toBeDefined();
    expect(ldxInstr!.mode).toBe(AsmAddressingMode.ZeroPageY);
  });

  it('should generate STA with Absolute mode', () => {
    const instr = createAsmRawInstr('STA', 'absolute');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const staInstr = instructions.find(i => i.mnemonic === 'STA');
    expect(staInstr).toBeDefined();
    expect(staInstr!.mode).toBe(AsmAddressingMode.Absolute);
  });

  it('should generate LDA with AbsoluteX mode', () => {
    const instr = createAsmRawInstr('LDA', 'absoluteX');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const ldaInstr = instructions.find(i => i.mnemonic === 'LDA');
    expect(ldaInstr).toBeDefined();
    expect(ldaInstr!.mode).toBe(AsmAddressingMode.AbsoluteX);
  });

  it('should generate LDA with AbsoluteY mode', () => {
    const instr = createAsmRawInstr('LDA', 'absoluteY');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const ldaInstr = instructions.find(i => i.mnemonic === 'LDA');
    expect(ldaInstr).toBeDefined();
    expect(ldaInstr!.mode).toBe(AsmAddressingMode.AbsoluteY);
  });

  it('should generate JMP with Indirect mode', () => {
    const instr = createAsmRawInstr('JMP', 'indirect');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const jmpInstr = instructions.find(i => i.mnemonic === 'JMP');
    expect(jmpInstr).toBeDefined();
    expect(jmpInstr!.mode).toBe(AsmAddressingMode.Indirect);
  });

  it('should generate LDA with IndexedIndirect (indirectX) mode', () => {
    const instr = createAsmRawInstr('LDA', 'indirectX');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const ldaInstr = instructions.find(i => i.mnemonic === 'LDA');
    expect(ldaInstr).toBeDefined();
    expect(ldaInstr!.mode).toBe(AsmAddressingMode.IndexedIndirect);
  });

  it('should generate LDA with IndirectIndexed (indirectY) mode', () => {
    const instr = createAsmRawInstr('LDA', 'indirectY');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const ldaInstr = instructions.find(i => i.mnemonic === 'LDA');
    expect(ldaInstr).toBeDefined();
    expect(ldaInstr!.mode).toBe(AsmAddressingMode.IndirectIndexed);
  });

  it('should generate BEQ with Relative mode', () => {
    const instr = createAsmRawInstr('BEQ', 'relative');
    gen['genAsmRaw'](instr);

    const instructions = getGeneratedInstructions(gen);
    const beqInstr = instructions.find(i => i.mnemonic === 'BEQ');
    expect(beqInstr).toBeDefined();
    expect(beqInstr!.mode).toBe(AsmAddressingMode.Relative);
  });
});

// ============================================================================
// Addressing Mode Mapper Tests
// ============================================================================

describe('CodeGen ASM_RAW: mapAsmRawAddressingMode', () => {
  let gen: TestableIntrinsicsOpsGenerator;

  beforeEach(() => {
    gen = new TestableIntrinsicsOpsGenerator();
  });

  it('should map all 12 addressing modes correctly', () => {
    // Access the protected method through bracket notation
    const mapper = (mode: string) => gen['mapAsmRawAddressingMode'](mode);

    expect(mapper('implied')).toBe(AsmAddressingMode.Implied);
    expect(mapper('immediate')).toBe(AsmAddressingMode.Immediate);
    expect(mapper('zeroPage')).toBe(AsmAddressingMode.ZeroPage);
    expect(mapper('zeroPageX')).toBe(AsmAddressingMode.ZeroPageX);
    expect(mapper('zeroPageY')).toBe(AsmAddressingMode.ZeroPageY);
    expect(mapper('absolute')).toBe(AsmAddressingMode.Absolute);
    expect(mapper('absoluteX')).toBe(AsmAddressingMode.AbsoluteX);
    expect(mapper('absoluteY')).toBe(AsmAddressingMode.AbsoluteY);
    expect(mapper('indirect')).toBe(AsmAddressingMode.Indirect);
    expect(mapper('indirectX')).toBe(AsmAddressingMode.IndexedIndirect);
    expect(mapper('indirectY')).toBe(AsmAddressingMode.IndirectIndexed);
    expect(mapper('relative')).toBe(AsmAddressingMode.Relative);
  });

  it('should default to Implied for unknown modes', () => {
    const mapper = (mode: string) => gen['mapAsmRawAddressingMode'](mode);
    expect(mapper('unknown')).toBe(AsmAddressingMode.Implied);
    expect(mapper('')).toBe(AsmAddressingMode.Implied);
  });
});

// ============================================================================
// Dispatch Tests (via generateInstruction)
// ============================================================================

describe('CodeGen ASM_RAW: dispatch through generateInstruction', () => {
  let gen: TestableIntrinsicsOpsGenerator;

  beforeEach(() => {
    gen = new TestableIntrinsicsOpsGenerator();
  });

  it('should dispatch ASM_RAW opcode to genAsmRaw handler', () => {
    const instr = createAsmRawInstr('CLI', 'implied');

    // Use the generateInstruction dispatch (protected, access via bracket)
    gen['generateInstruction'](instr);

    const instructions = getGeneratedInstructions(gen);
    const cliInstr = instructions.find(i => i.mnemonic === 'CLI');
    expect(cliInstr).toBeDefined();
    expect(cliInstr!.mode).toBe(AsmAddressingMode.Implied);
  });

  it('should still dispatch PEEK through generateInstruction', () => {
    // Ensure ASM_RAW addition didn't break existing dispatch
    const peekInstr: ILInstruction = {
      opcode: ILOpcode.PEEK,
      operands: [{
        kind: 'address',
        address: 0xD020,
        isZeroPage: false,
      }] as ILOperand[],
      comment: 'peek test',
    };

    gen['generateInstruction'](peekInstr);

    const instructions = getGeneratedInstructions(gen);
    const ldaInstr = instructions.find(i => i.mnemonic === 'LDA');
    expect(ldaInstr).toBeDefined();
  });
});

// ============================================================================
// Various Mnemonics Tests
// ============================================================================

describe('CodeGen ASM_RAW: various mnemonics', () => {
  let gen: TestableIntrinsicsOpsGenerator;

  beforeEach(() => {
    gen = new TestableIntrinsicsOpsGenerator();
  });

  it('should generate ADC with immediate mode', () => {
    gen['genAsmRaw'](createAsmRawInstr('ADC', 'immediate'));
    const instructions = getGeneratedInstructions(gen);
    expect(instructions.find(i => i.mnemonic === 'ADC')).toBeDefined();
    expect(instructions.find(i => i.mnemonic === 'ADC')!.mode).toBe(AsmAddressingMode.Immediate);
  });

  it('should generate SBC with zeroPage mode', () => {
    gen['genAsmRaw'](createAsmRawInstr('SBC', 'zeroPage'));
    const instructions = getGeneratedInstructions(gen);
    expect(instructions.find(i => i.mnemonic === 'SBC')).toBeDefined();
    expect(instructions.find(i => i.mnemonic === 'SBC')!.mode).toBe(AsmAddressingMode.ZeroPage);
  });

  it('should generate AND with absolute mode', () => {
    gen['genAsmRaw'](createAsmRawInstr('AND', 'absolute'));
    const instructions = getGeneratedInstructions(gen);
    expect(instructions.find(i => i.mnemonic === 'AND')).toBeDefined();
    expect(instructions.find(i => i.mnemonic === 'AND')!.mode).toBe(AsmAddressingMode.Absolute);
  });

  it('should generate ORA with indirectY mode', () => {
    gen['genAsmRaw'](createAsmRawInstr('ORA', 'indirectY'));
    const instructions = getGeneratedInstructions(gen);
    expect(instructions.find(i => i.mnemonic === 'ORA')).toBeDefined();
    expect(instructions.find(i => i.mnemonic === 'ORA')!.mode).toBe(AsmAddressingMode.IndirectIndexed);
  });

  it('should generate EOR with indirectX mode', () => {
    gen['genAsmRaw'](createAsmRawInstr('EOR', 'indirectX'));
    const instructions = getGeneratedInstructions(gen);
    expect(instructions.find(i => i.mnemonic === 'EOR')).toBeDefined();
    expect(instructions.find(i => i.mnemonic === 'EOR')!.mode).toBe(AsmAddressingMode.IndexedIndirect);
  });

  it('should generate CMP with absoluteX mode', () => {
    gen['genAsmRaw'](createAsmRawInstr('CMP', 'absoluteX'));
    const instructions = getGeneratedInstructions(gen);
    expect(instructions.find(i => i.mnemonic === 'CMP')).toBeDefined();
    expect(instructions.find(i => i.mnemonic === 'CMP')!.mode).toBe(AsmAddressingMode.AbsoluteX);
  });

  it('should generate INC with zeroPage mode', () => {
    gen['genAsmRaw'](createAsmRawInstr('INC', 'zeroPage'));
    const instructions = getGeneratedInstructions(gen);
    expect(instructions.find(i => i.mnemonic === 'INC')).toBeDefined();
    expect(instructions.find(i => i.mnemonic === 'INC')!.mode).toBe(AsmAddressingMode.ZeroPage);
  });

  it('should generate ASL with zeroPage mode', () => {
    gen['genAsmRaw'](createAsmRawInstr('ASL', 'zeroPage'));
    const instructions = getGeneratedInstructions(gen);
    expect(instructions.find(i => i.mnemonic === 'ASL')).toBeDefined();
    expect(instructions.find(i => i.mnemonic === 'ASL')!.mode).toBe(AsmAddressingMode.ZeroPage);
  });

  it('should generate JSR with absolute mode', () => {
    gen['genAsmRaw'](createAsmRawInstr('JSR', 'absolute'));
    const instructions = getGeneratedInstructions(gen);
    expect(instructions.find(i => i.mnemonic === 'JSR')).toBeDefined();
    expect(instructions.find(i => i.mnemonic === 'JSR')!.mode).toBe(AsmAddressingMode.Absolute);
  });

  it('should generate BNE with relative mode', () => {
    gen['genAsmRaw'](createAsmRawInstr('BNE', 'relative'));
    const instructions = getGeneratedInstructions(gen);
    expect(instructions.find(i => i.mnemonic === 'BNE')).toBeDefined();
    expect(instructions.find(i => i.mnemonic === 'BNE')!.mode).toBe(AsmAddressingMode.Relative);
  });
});
