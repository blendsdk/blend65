/**
 * ASM Function Name Parser Tests
 *
 * Tests parseAsmFunctionName() for all 12 addressing modes,
 * all implied-mode instructions, and edge cases.
 *
 * @module __tests__/il/asm-utils
 */

import { describe, it, expect } from 'vitest';
import {
  isAsmFunction,
  parseAsmFunctionName,
  addressingModeRequiresOperand,
  getExpectedArgCount,
  getValidAddressingModeSuffixes,
  getValidMnemonics,
} from '../../il/asm-utils.js';

describe('isAsmFunction', () => {
  it('should return true for asm_ prefixed names', () => {
    expect(isAsmFunction('asm_sei')).toBe(true);
    expect(isAsmFunction('asm_lda_imm')).toBe(true);
    expect(isAsmFunction('asm_nop')).toBe(true);
  });

  it('should return false for non-asm names', () => {
    expect(isAsmFunction('peek')).toBe(false);
    expect(isAsmFunction('poke')).toBe(false);
    expect(isAsmFunction('myFunction')).toBe(false);
    expect(isAsmFunction('')).toBe(false);
  });
});

describe('parseAsmFunctionName', () => {
  // ── Implied mode (no operand) ──────────────────────────────────

  describe('implied mode instructions', () => {
    const impliedInstructions = [
      'asm_tax', 'asm_tay', 'asm_txa', 'asm_tya', 'asm_tsx', 'asm_txs',
      'asm_pha', 'asm_pla', 'asm_php', 'asm_plp',
      'asm_inx', 'asm_iny', 'asm_dex', 'asm_dey',
      'asm_clc', 'asm_cld', 'asm_cli', 'asm_clv',
      'asm_sec', 'asm_sed', 'asm_sei',
      'asm_nop', 'asm_brk',
      'asm_rts', 'asm_rti',
    ];

    for (const name of impliedInstructions) {
      it(`should parse ${name} as implied`, () => {
        const result = parseAsmFunctionName(name);
        expect(result).not.toBeNull();
        expect(result!.addressingMode).toBe('implied');
        // Mnemonic is uppercase version of 3 chars after 'asm_'
        expect(result!.mnemonic).toBe(name.substring(4).toUpperCase());
      });
    }
  });

  // ── Immediate mode ─────────────────────────────────────────────

  describe('immediate mode (_imm)', () => {
    const immInstructions = [
      ['asm_lda_imm', 'LDA'],
      ['asm_ldx_imm', 'LDX'],
      ['asm_ldy_imm', 'LDY'],
      ['asm_adc_imm', 'ADC'],
      ['asm_sbc_imm', 'SBC'],
      ['asm_and_imm', 'AND'],
      ['asm_ora_imm', 'ORA'],
      ['asm_eor_imm', 'EOR'],
      ['asm_cmp_imm', 'CMP'],
      ['asm_cpx_imm', 'CPX'],
      ['asm_cpy_imm', 'CPY'],
    ];

    for (const [name, mnemonic] of immInstructions) {
      it(`should parse ${name} → ${mnemonic} immediate`, () => {
        const result = parseAsmFunctionName(name);
        expect(result).not.toBeNull();
        expect(result!.mnemonic).toBe(mnemonic);
        expect(result!.addressingMode).toBe('immediate');
      });
    }
  });

  // ── Zero page mode ─────────────────────────────────────────────

  describe('zero page mode (_zp)', () => {
    it('should parse asm_lda_zp → LDA zeroPage', () => {
      const result = parseAsmFunctionName('asm_lda_zp');
      expect(result).toEqual({ mnemonic: 'LDA', addressingMode: 'zeroPage' });
    });

    it('should parse asm_sta_zp → STA zeroPage', () => {
      const result = parseAsmFunctionName('asm_sta_zp');
      expect(result).toEqual({ mnemonic: 'STA', addressingMode: 'zeroPage' });
    });
  });

  // ── Zero page X/Y indexed ──────────────────────────────────────

  describe('zero page indexed modes (_zpx, _zpy)', () => {
    it('should parse asm_lda_zpx → LDA zeroPageX', () => {
      const result = parseAsmFunctionName('asm_lda_zpx');
      expect(result).toEqual({ mnemonic: 'LDA', addressingMode: 'zeroPageX' });
    });

    it('should parse asm_ldx_zpy → LDX zeroPageY', () => {
      const result = parseAsmFunctionName('asm_ldx_zpy');
      expect(result).toEqual({ mnemonic: 'LDX', addressingMode: 'zeroPageY' });
    });
  });

  // ── Absolute mode ──────────────────────────────────────────────

  describe('absolute mode (_abs)', () => {
    it('should parse asm_lda_abs → LDA absolute', () => {
      const result = parseAsmFunctionName('asm_lda_abs');
      expect(result).toEqual({ mnemonic: 'LDA', addressingMode: 'absolute' });
    });

    it('should parse asm_sta_abs → STA absolute', () => {
      const result = parseAsmFunctionName('asm_sta_abs');
      expect(result).toEqual({ mnemonic: 'STA', addressingMode: 'absolute' });
    });

    it('should parse asm_jsr_abs → JSR absolute', () => {
      const result = parseAsmFunctionName('asm_jsr_abs');
      expect(result).toEqual({ mnemonic: 'JSR', addressingMode: 'absolute' });
    });
  });

  // ── Absolute indexed modes ─────────────────────────────────────

  describe('absolute indexed modes (_abx, _aby)', () => {
    it('should parse asm_lda_abx → LDA absoluteX', () => {
      const result = parseAsmFunctionName('asm_lda_abx');
      expect(result).toEqual({ mnemonic: 'LDA', addressingMode: 'absoluteX' });
    });

    it('should parse asm_lda_aby → LDA absoluteY', () => {
      const result = parseAsmFunctionName('asm_lda_aby');
      expect(result).toEqual({ mnemonic: 'LDA', addressingMode: 'absoluteY' });
    });

    it('should parse asm_sta_abx → STA absoluteX', () => {
      const result = parseAsmFunctionName('asm_sta_abx');
      expect(result).toEqual({ mnemonic: 'STA', addressingMode: 'absoluteX' });
    });
  });

  // ── Indirect modes ─────────────────────────────────────────────

  describe('indirect modes (_ind, _inx, _iny)', () => {
    it('should parse asm_jmp_ind → JMP indirect', () => {
      const result = parseAsmFunctionName('asm_jmp_ind');
      expect(result).toEqual({ mnemonic: 'JMP', addressingMode: 'indirect' });
    });

    it('should parse asm_lda_inx → LDA indirectX', () => {
      const result = parseAsmFunctionName('asm_lda_inx');
      expect(result).toEqual({ mnemonic: 'LDA', addressingMode: 'indirectX' });
    });

    it('should parse asm_sta_iny → STA indirectY', () => {
      const result = parseAsmFunctionName('asm_sta_iny');
      expect(result).toEqual({ mnemonic: 'STA', addressingMode: 'indirectY' });
    });
  });

  // ── Relative mode (branches) ───────────────────────────────────

  describe('relative mode (_rel)', () => {
    it('should parse asm_beq_rel → BEQ relative', () => {
      const result = parseAsmFunctionName('asm_beq_rel');
      expect(result).toEqual({ mnemonic: 'BEQ', addressingMode: 'relative' });
    });

    it('should parse asm_bne_rel → BNE relative', () => {
      const result = parseAsmFunctionName('asm_bne_rel');
      expect(result).toEqual({ mnemonic: 'BNE', addressingMode: 'relative' });
    });

    it('should parse asm_bcc_rel → BCC relative', () => {
      const result = parseAsmFunctionName('asm_bcc_rel');
      expect(result).toEqual({ mnemonic: 'BCC', addressingMode: 'relative' });
    });
  });

  // ── Shift/rotate with accumulator (implied) ────────────────────

  describe('accumulator shifts (implied)', () => {
    it('should parse asm_asl → ASL implied', () => {
      const result = parseAsmFunctionName('asm_asl');
      expect(result).toEqual({ mnemonic: 'ASL', addressingMode: 'implied' });
    });

    it('should parse asm_lsr → LSR implied', () => {
      const result = parseAsmFunctionName('asm_lsr');
      expect(result).toEqual({ mnemonic: 'LSR', addressingMode: 'implied' });
    });

    it('should parse asm_rol → ROL implied', () => {
      const result = parseAsmFunctionName('asm_rol');
      expect(result).toEqual({ mnemonic: 'ROL', addressingMode: 'implied' });
    });

    it('should parse asm_ror → ROR implied', () => {
      const result = parseAsmFunctionName('asm_ror');
      expect(result).toEqual({ mnemonic: 'ROR', addressingMode: 'implied' });
    });

    it('should parse asm_asl_zp → ASL zeroPage', () => {
      const result = parseAsmFunctionName('asm_asl_zp');
      expect(result).toEqual({ mnemonic: 'ASL', addressingMode: 'zeroPage' });
    });
  });

  // ── Invalid names ──────────────────────────────────────────────

  describe('invalid names', () => {
    it('should return null for non-asm prefix', () => {
      expect(parseAsmFunctionName('peek')).toBeNull();
      expect(parseAsmFunctionName('not_asm')).toBeNull();
      expect(parseAsmFunctionName('myFunc')).toBeNull();
    });

    it('should return null for empty after prefix', () => {
      expect(parseAsmFunctionName('asm_')).toBeNull();
    });

    it('should return null for invalid mnemonic', () => {
      expect(parseAsmFunctionName('asm_xyz')).toBeNull();
      expect(parseAsmFunctionName('asm_abc_imm')).toBeNull();
    });

    it('should return null for invalid suffix', () => {
      expect(parseAsmFunctionName('asm_lda_xxx')).toBeNull();
      expect(parseAsmFunctionName('asm_sta_foo')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseAsmFunctionName('')).toBeNull();
    });
  });
});

describe('addressingModeRequiresOperand', () => {
  it('should return false for implied', () => {
    expect(addressingModeRequiresOperand('implied')).toBe(false);
  });

  it('should return true for all other modes', () => {
    const addressedModes = [
      'immediate', 'zeroPage', 'zeroPageX', 'zeroPageY',
      'absolute', 'absoluteX', 'absoluteY',
      'indirect', 'indirectX', 'indirectY', 'relative',
    ];
    for (const mode of addressedModes) {
      expect(addressingModeRequiresOperand(mode)).toBe(true);
    }
  });
});

describe('getExpectedArgCount', () => {
  it('should return 0 for implied', () => {
    expect(getExpectedArgCount('implied')).toBe(0);
  });

  it('should return 1 for addressed modes', () => {
    expect(getExpectedArgCount('immediate')).toBe(1);
    expect(getExpectedArgCount('absolute')).toBe(1);
    expect(getExpectedArgCount('zeroPage')).toBe(1);
  });
});

describe('getValidAddressingModeSuffixes', () => {
  it('should return all 11 suffixes', () => {
    const suffixes = getValidAddressingModeSuffixes();
    expect(suffixes).toHaveLength(11);
    expect(suffixes).toContain('imm');
    expect(suffixes).toContain('zp');
    expect(suffixes).toContain('abs');
    expect(suffixes).toContain('ind');
    expect(suffixes).toContain('inx');
    expect(suffixes).toContain('iny');
    expect(suffixes).toContain('rel');
  });
});

describe('getValidMnemonics', () => {
  it('should return all 56 official 6502 mnemonics', () => {
    const mnemonics = getValidMnemonics();
    expect(mnemonics.length).toBe(56);
  });

  it('should include key mnemonics', () => {
    const mnemonics = getValidMnemonics();
    expect(mnemonics).toContain('LDA');
    expect(mnemonics).toContain('STA');
    expect(mnemonics).toContain('SEI');
    expect(mnemonics).toContain('NOP');
    expect(mnemonics).toContain('JMP');
    expect(mnemonics).toContain('JSR');
    expect(mnemonics).toContain('RTS');
  });
});
