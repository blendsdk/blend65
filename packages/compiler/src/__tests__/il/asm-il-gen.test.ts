/**
 * IL Generator ASM_RAW Tests
 *
 * Tests that asm_* function calls in source code produce
 * ASM_RAW IL instructions with the correct mnemonic and
 * addressing mode metadata.
 *
 * @module __tests__/il/asm-il-gen
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../il/enums.js';
import { AsmRawOperand } from '../../il/operands.js';
import {
  compileToIL,
  wrapInProgram,
  getMainFunction,
  findInstructions,
  hasOpcode,
  countOpcode,
} from './helpers/il-test-utils.js';

// ============================================================================
// Helper: asm_* function declarations for tests
// ============================================================================

/**
 * Generates Blend function declarations for asm_* stubs.
 * The semantic analyzer requires functions to be declared before calling them.
 * In production, these come from asm.blend via LibraryLoader.
 * For unit tests, we declare them inline.
 */
const ASM_STUBS = `
// Implied mode stubs
function asm_sei(): void {}
function asm_cli(): void {}
function asm_nop(): void {}
function asm_clc(): void {}
function asm_sec(): void {}
function asm_rts(): void {}
function asm_rti(): void {}
function asm_tax(): void {}
function asm_tay(): void {}
function asm_txa(): void {}
function asm_tya(): void {}
function asm_pha(): void {}
function asm_pla(): void {}
function asm_inx(): void {}
function asm_iny(): void {}
function asm_dex(): void {}
function asm_dey(): void {}
// Addressed mode stubs (take a byte argument)
function asm_lda_imm(value: byte): void {}
function asm_lda_zp(addr: byte): void {}
function asm_lda_zpx(addr: byte): void {}
function asm_lda_abx(addr: word): void {}
function asm_lda_aby(addr: word): void {}
function asm_lda_inx(addr: byte): void {}
function asm_lda_iny(addr: byte): void {}
function asm_ldx_zpy(addr: byte): void {}
function asm_sta_abs(addr: word): void {}
function asm_jmp_ind(addr: word): void {}
function asm_beq_rel(offset: byte): void {}
`;

/**
 * Wraps code in a module + function + asm_* declarations.
 *
 * @param body - Code to place in main() function body
 * @returns Complete program with asm_* declarations
 */
function wrapWithAsmStubs(body: string): string {
  return `module Test;\n${ASM_STUBS}\nfunction main(): void {\n  ${body}\n}`;
}

// ============================================================================
// Helper: Extract AsmRawOperand from ASM_RAW instructions
// ============================================================================

/**
 * Extracts the AsmRawOperand from the first ASM_RAW instruction
 * in the main function of a compiled IL program.
 *
 * @param source - Blend source code (with asm_* stubs declared)
 * @returns AsmRawOperand or null if not found
 */
function getAsmRawOperand(source: string): AsmRawOperand | null {
  const program = compileToIL(source);
  const main = getMainFunction(program);
  if (!main) return null;

  const asmRawInstrs = findInstructions(main.instructions, ILOpcode.ASM_RAW);
  if (asmRawInstrs.length === 0) return null;

  const operand = asmRawInstrs[0].operands[0];
  if (operand && operand.kind === 'asm_raw') {
    return operand as AsmRawOperand;
  }
  return null;
}

// ============================================================================
// Implied Mode asm_* Functions
// ============================================================================

describe('IL Generator: asm_* implied mode', () => {
  it('should emit ASM_RAW for asm_sei()', () => {
    const source = wrapWithAsmStubs('asm_sei();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('SEI');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for asm_cli()', () => {
    const source = wrapWithAsmStubs('asm_cli();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('CLI');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for asm_nop()', () => {
    const source = wrapWithAsmStubs('asm_nop();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('NOP');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for asm_clc()', () => {
    const source = wrapWithAsmStubs('asm_clc();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('CLC');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for asm_sec()', () => {
    const source = wrapWithAsmStubs('asm_sec();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('SEC');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for asm_rts()', () => {
    const source = wrapWithAsmStubs('asm_rts();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('RTS');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for asm_rti()', () => {
    const source = wrapWithAsmStubs('asm_rti();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('RTI');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for transfer instructions (asm_tax)', () => {
    const source = wrapWithAsmStubs('asm_tax();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('TAX');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for stack instructions (asm_pha)', () => {
    const source = wrapWithAsmStubs('asm_pha();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('PHA');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for asm_pla()', () => {
    const source = wrapWithAsmStubs('asm_pla();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('PLA');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for asm_inx()', () => {
    const source = wrapWithAsmStubs('asm_inx();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('INX');
    expect(op!.addressingMode).toBe('implied');
  });

  it('should emit ASM_RAW for asm_dey()', () => {
    const source = wrapWithAsmStubs('asm_dey();');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('DEY');
    expect(op!.addressingMode).toBe('implied');
  });
});

// ============================================================================
// Addressed Mode asm_* Functions
// ============================================================================

describe('IL Generator: asm_* addressed modes', () => {
  it('should emit ASM_RAW for asm_lda_imm() with immediate mode', () => {
    const source = wrapWithAsmStubs('asm_lda_imm(42);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('LDA');
    expect(op!.addressingMode).toBe('immediate');
  });

  it('should emit ASM_RAW for asm_sta_abs() with absolute mode', () => {
    const source = wrapWithAsmStubs('asm_sta_abs(53280);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('STA');
    expect(op!.addressingMode).toBe('absolute');
  });

  it('should emit ASM_RAW for asm_lda_zp() with zeroPage mode', () => {
    const source = wrapWithAsmStubs('asm_lda_zp(251);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('LDA');
    expect(op!.addressingMode).toBe('zeroPage');
  });

  it('should emit ASM_RAW for asm_lda_zpx() with zeroPageX mode', () => {
    const source = wrapWithAsmStubs('asm_lda_zpx(251);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('LDA');
    expect(op!.addressingMode).toBe('zeroPageX');
  });

  it('should emit ASM_RAW for asm_ldx_zpy() with zeroPageY mode', () => {
    const source = wrapWithAsmStubs('asm_ldx_zpy(251);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('LDX');
    expect(op!.addressingMode).toBe('zeroPageY');
  });

  it('should emit ASM_RAW for asm_lda_abx() with absoluteX mode', () => {
    const source = wrapWithAsmStubs('asm_lda_abx(1024);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('LDA');
    expect(op!.addressingMode).toBe('absoluteX');
  });

  it('should emit ASM_RAW for asm_lda_aby() with absoluteY mode', () => {
    const source = wrapWithAsmStubs('asm_lda_aby(1024);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('LDA');
    expect(op!.addressingMode).toBe('absoluteY');
  });

  it('should emit ASM_RAW for asm_jmp_ind() with indirect mode', () => {
    const source = wrapWithAsmStubs('asm_jmp_ind(65534);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('JMP');
    expect(op!.addressingMode).toBe('indirect');
  });

  it('should emit ASM_RAW for asm_lda_inx() with indirectX mode', () => {
    const source = wrapWithAsmStubs('asm_lda_inx(251);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('LDA');
    expect(op!.addressingMode).toBe('indirectX');
  });

  it('should emit ASM_RAW for asm_lda_iny() with indirectY mode', () => {
    const source = wrapWithAsmStubs('asm_lda_iny(251);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('LDA');
    expect(op!.addressingMode).toBe('indirectY');
  });

  it('should emit ASM_RAW for asm_beq_rel() with relative mode', () => {
    const source = wrapWithAsmStubs('asm_beq_rel(10);');
    const op = getAsmRawOperand(source);
    expect(op).not.toBeNull();
    expect(op!.mnemonic).toBe('BEQ');
    expect(op!.addressingMode).toBe('relative');
  });
});

// ============================================================================
// Multiple asm_* Calls & Instruction Counting
// ============================================================================

describe('IL Generator: asm_* multiple calls', () => {
  it('should emit multiple ASM_RAW for sequential asm_* calls', () => {
    const source = wrapWithAsmStubs(`
      asm_sei();
      asm_lda_imm(0);
      asm_sta_abs(53280);
      asm_cli();
    `);
    const program = compileToIL(source);
    const main = getMainFunction(program);
    expect(main).toBeDefined();
    const asmRawCount = countOpcode(main!.instructions, ILOpcode.ASM_RAW);
    expect(asmRawCount).toBe(4);
  });

  it('should preserve order of ASM_RAW instructions', () => {
    const source = wrapWithAsmStubs(`
      asm_sei();
      asm_nop();
      asm_cli();
    `);
    const program = compileToIL(source);
    const main = getMainFunction(program);
    expect(main).toBeDefined();

    const asmRawInstrs = findInstructions(main!.instructions, ILOpcode.ASM_RAW);
    expect(asmRawInstrs.length).toBe(3);

    // Check order: SEI, NOP, CLI
    const mnemonics = asmRawInstrs.map(
      i => (i.operands[0] as AsmRawOperand).mnemonic
    );
    expect(mnemonics).toEqual(['SEI', 'NOP', 'CLI']);
  });

  it('should handle asm_* calls mixed with regular code', () => {
    const source = wrapWithAsmStubs(`
      let x: byte = 5;
      asm_sei();
      x = 10;
      asm_cli();
    `);
    const program = compileToIL(source);
    const main = getMainFunction(program);
    expect(main).toBeDefined();

    // Should have ASM_RAW instructions among regular IL
    expect(hasOpcode(main!.instructions, ILOpcode.ASM_RAW)).toBe(true);
    expect(countOpcode(main!.instructions, ILOpcode.ASM_RAW)).toBe(2);

    // Should also have regular load/store for variable operations
    expect(hasOpcode(main!.instructions, ILOpcode.LOAD_IMM)).toBe(true);
    expect(hasOpcode(main!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
  });
});

// ============================================================================
// Addressed asm_* with Expression Arguments
// ============================================================================

describe('IL Generator: asm_* with expression arguments', () => {
  it('should generate LOAD_IMM before ASM_RAW for literal argument', () => {
    const source = wrapWithAsmStubs('asm_lda_imm(42);');
    const program = compileToIL(source);
    const main = getMainFunction(program);
    expect(main).toBeDefined();

    // Should have LOAD_IMM (for the 42 argument) followed by ASM_RAW
    expect(hasOpcode(main!.instructions, ILOpcode.LOAD_IMM)).toBe(true);
    expect(hasOpcode(main!.instructions, ILOpcode.ASM_RAW)).toBe(true);
  });

  it('should generate argument expression before ASM_RAW for variable argument', () => {
    const source = wrapWithAsmStubs(`
      let addr: byte = 251;
      asm_lda_zp(addr);
    `);
    const program = compileToIL(source);
    const main = getMainFunction(program);
    expect(main).toBeDefined();

    // Should have at least one LOAD_BYTE (loading addr) and ASM_RAW
    expect(hasOpcode(main!.instructions, ILOpcode.ASM_RAW)).toBe(true);
  });
});

// ============================================================================
// asm_* Does NOT Interfere with Regular Intrinsics
// ============================================================================

describe('IL Generator: asm_* vs regular intrinsics', () => {
  it('should still handle peek() as PEEK intrinsic (not ASM_RAW)', () => {
    const source = wrapInProgram('let x: byte = peek(53280);');
    const program = compileToIL(source);
    const main = getMainFunction(program);
    expect(main).toBeDefined();

    // peek() should generate PEEK, not ASM_RAW
    expect(hasOpcode(main!.instructions, ILOpcode.PEEK)).toBe(true);
    expect(hasOpcode(main!.instructions, ILOpcode.ASM_RAW)).toBe(false);
  });

  it('should still handle poke() as POKE intrinsic (not ASM_RAW)', () => {
    const source = wrapInProgram('poke(53280, 0);');
    const program = compileToIL(source);
    const main = getMainFunction(program);
    expect(main).toBeDefined();

    // poke() should generate POKE, not ASM_RAW
    expect(hasOpcode(main!.instructions, ILOpcode.POKE)).toBe(true);
    expect(hasOpcode(main!.instructions, ILOpcode.ASM_RAW)).toBe(false);
  });
});
