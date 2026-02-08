/**
 * Address Analyzer Tests
 *
 * Verifies that AddressAnalyzer correctly determines memory address
 * aliasing for safe optimization on the 6502.
 *
 * Tests cover:
 * - couldAlias: concrete numbers, symbolic labels, mixed types
 * - couldModify: store instructions vs non-store, aliasing checks
 * - couldRead: memory-reading instructions, immediate mode exclusion
 * - getInstructionAddress: label/numeric operand extraction
 * - isIndexedAccess: all indexed addressing modes
 */

import { describe, it, expect } from 'vitest';
import { AddressAnalyzer } from '../../../../../codegen/asm-il/optimizer/analysis/address-analyzer.js';
import { AsmAddressingMode } from '../../../../../codegen/asm-il/types.js';
import type { AsmInstruction } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Helpers
// ============================================================================

/** Create an implied-mode instruction */
function implied(mnemonic: string): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.Implied };
}

/** Create an immediate-mode instruction */
function immediate(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.Immediate, operand };
}

/** Create an absolute-mode instruction */
function absolute(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.Absolute, operand };
}

/** Create a zero-page instruction */
function zeroPage(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.ZeroPage, operand };
}

/** Create an absolute,X instruction */
function absoluteX(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.AbsoluteX, operand };
}

/** Create an absolute,Y instruction */
function absoluteY(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.AbsoluteY, operand };
}

/** Create a zero-page,X instruction */
function zeroPageX(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.ZeroPageX, operand };
}

/** Create a zero-page,Y instruction */
function zeroPageY(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.ZeroPageY, operand };
}

/** Create an instruction with label operand */
function withLabel(mnemonic: string, mode: AsmAddressingMode, label: string): AsmInstruction {
  return { mnemonic, mode, labelOperand: label };
}

/** Create an indexed indirect (e.g., LDA ($00,X)) */
function indexedIndirect(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.IndexedIndirect, operand };
}

/** Create an indirect indexed (e.g., LDA ($00),Y) */
function indirectIndexed(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.IndirectIndexed, operand };
}

// ============================================================================
// Tests
// ============================================================================

describe('AddressAnalyzer', () => {
  const analyzer = new AddressAnalyzer();

  // ==========================================================================
  // couldAlias
  // ==========================================================================

  describe('couldAlias', () => {
    describe('concrete numbers', () => {
      it('same address should alias', () => {
        expect(analyzer.couldAlias(0xD020, 0xD020)).toBe(true);
      });

      it('different addresses should not alias', () => {
        expect(analyzer.couldAlias(0xD020, 0xD021)).toBe(false);
      });

      it('zero-page addresses: same should alias', () => {
        expect(analyzer.couldAlias(0x50, 0x50)).toBe(true);
      });

      it('zero-page addresses: different should not alias', () => {
        expect(analyzer.couldAlias(0x50, 0x51)).toBe(false);
      });

      it('adjacent addresses should not alias', () => {
        expect(analyzer.couldAlias(0x1000, 0x1001)).toBe(false);
      });
    });

    describe('symbolic labels', () => {
      it('same label should alias', () => {
        expect(analyzer.couldAlias('counter', 'counter')).toBe(true);
      });

      it('different labels should conservatively alias', () => {
        // Conservative: we don't know what addresses labels resolve to
        expect(analyzer.couldAlias('counter', 'player_x')).toBe(true);
      });

      it('different labels should return true (conservative)', () => {
        expect(analyzer.couldAlias('foo', 'bar')).toBe(true);
      });
    });

    describe('mixed types (number + string)', () => {
      it('number vs string should conservatively alias', () => {
        expect(analyzer.couldAlias(0xD020, 'borderColor')).toBe(true);
      });

      it('string vs number should conservatively alias', () => {
        expect(analyzer.couldAlias('counter', 0x50)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // couldModify
  // ==========================================================================

  describe('couldModify', () => {
    describe('store instructions', () => {
      it('STA to same address should return true', () => {
        expect(analyzer.couldModify(absolute('STA', 0x1000), 0x1000)).toBe(true);
      });

      it('STA to different address should return false', () => {
        expect(analyzer.couldModify(absolute('STA', 0x1000), 0x2000)).toBe(false);
      });

      it('STX to same address should return true', () => {
        expect(analyzer.couldModify(absolute('STX', 0x50), 0x50)).toBe(true);
      });

      it('STY to different address should return false', () => {
        expect(analyzer.couldModify(absolute('STY', 0x50), 0x51)).toBe(false);
      });
    });

    describe('memory-modify instructions', () => {
      it('INC at same address should return true', () => {
        expect(analyzer.couldModify(absolute('INC', 0x50), 0x50)).toBe(true);
      });

      it('DEC at different address should return false', () => {
        expect(analyzer.couldModify(absolute('DEC', 0x50), 0x51)).toBe(false);
      });

      it('ASL at same address should return true', () => {
        expect(analyzer.couldModify(absolute('ASL', 0x1000), 0x1000)).toBe(true);
      });

      it('LSR at different address should return false', () => {
        expect(analyzer.couldModify(absolute('LSR', 0x1000), 0x2000)).toBe(false);
      });

      it('ROL at same address should return true', () => {
        expect(analyzer.couldModify(absolute('ROL', 0x50), 0x50)).toBe(true);
      });

      it('ROR at different address should return false', () => {
        expect(analyzer.couldModify(absolute('ROR', 0x50), 0x51)).toBe(false);
      });
    });

    describe('non-writing instructions', () => {
      it('LDA should not modify any address', () => {
        expect(analyzer.couldModify(absolute('LDA', 0x1000), 0x1000)).toBe(false);
      });

      it('CMP should not modify any address', () => {
        expect(analyzer.couldModify(immediate('CMP', 5), 0x1000)).toBe(false);
      });

      it('NOP should not modify any address', () => {
        expect(analyzer.couldModify(implied('NOP'), 0x1000)).toBe(false);
      });

      it('ADC should not modify any address', () => {
        expect(analyzer.couldModify(immediate('ADC', 1), 0x50)).toBe(false);
      });

      it('BIT should not modify any address', () => {
        expect(analyzer.couldModify(absolute('BIT', 0x2000), 0x2000)).toBe(false);
      });
    });

    describe('label operands (conservative)', () => {
      it('STA with label should conservatively alias with any address', () => {
        const sta = withLabel('STA', AsmAddressingMode.Absolute, 'counter');
        expect(analyzer.couldModify(sta, 0x50)).toBe(true);
        expect(analyzer.couldModify(sta, 'other')).toBe(true);
      });
    });

    describe('no operand (conservative)', () => {
      it('STA with no operand should conservatively return true', () => {
        // Edge case: STA with implied mode (shouldn't happen but be safe)
        const sta: AsmInstruction = { mnemonic: 'STA', mode: AsmAddressingMode.Implied };
        expect(analyzer.couldModify(sta, 0x1000)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // couldRead
  // ==========================================================================

  describe('couldRead', () => {
    describe('memory-reading instructions', () => {
      it('LDA absolute should read from its address', () => {
        expect(analyzer.couldRead(absolute('LDA', 0x1000), 0x1000)).toBe(true);
      });

      it('LDA from different address should not read', () => {
        expect(analyzer.couldRead(absolute('LDA', 0x1000), 0x2000)).toBe(false);
      });

      it('CMP absolute should read from its address', () => {
        expect(analyzer.couldRead(absolute('CMP', 0x50), 0x50)).toBe(true);
      });

      it('ADC absolute should read from its address', () => {
        expect(analyzer.couldRead(absolute('ADC', 0x50), 0x50)).toBe(true);
      });

      it('BIT absolute should read from its address', () => {
        expect(analyzer.couldRead(absolute('BIT', 0x2000), 0x2000)).toBe(true);
      });
    });

    describe('immediate mode exclusion', () => {
      it('LDA immediate should not read from memory', () => {
        // Immediate mode doesn't access memory — operand IS the value
        expect(analyzer.couldRead(immediate('LDA', 0x42), 0x42)).toBe(false);
      });

      it('CMP immediate should not read from memory', () => {
        expect(analyzer.couldRead(immediate('CMP', 5), 5)).toBe(false);
      });

      it('ADC immediate should not read from memory', () => {
        expect(analyzer.couldRead(immediate('ADC', 1), 1)).toBe(false);
      });
    });

    describe('non-reading instructions', () => {
      it('STA should not be a reader', () => {
        expect(analyzer.couldRead(absolute('STA', 0x1000), 0x1000)).toBe(false);
      });

      it('NOP should not be a reader', () => {
        expect(analyzer.couldRead(implied('NOP'), 0x1000)).toBe(false);
      });

      it('JMP should not be a reader', () => {
        expect(analyzer.couldRead(absolute('JMP', 0x2000), 0x2000)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // getInstructionAddress
  // ==========================================================================

  describe('getInstructionAddress', () => {
    it('should return numeric operand for absolute mode', () => {
      expect(analyzer.getInstructionAddress(absolute('LDA', 0x1000))).toBe(0x1000);
    });

    it('should return numeric operand for zero-page mode', () => {
      expect(analyzer.getInstructionAddress(zeroPage('LDA', 0x50))).toBe(0x50);
    });

    it('should return label operand when present', () => {
      const instr = withLabel('LDA', AsmAddressingMode.Absolute, 'counter');
      expect(analyzer.getInstructionAddress(instr)).toBe('counter');
    });

    it('should prefer label operand over numeric', () => {
      // Edge case: if both are set, label takes priority
      const instr: AsmInstruction = {
        mnemonic: 'LDA',
        mode: AsmAddressingMode.Absolute,
        operand: 0x1000,
        labelOperand: 'counter',
      };
      expect(analyzer.getInstructionAddress(instr)).toBe('counter');
    });

    it('should return undefined for implied mode (no operand)', () => {
      expect(analyzer.getInstructionAddress(implied('NOP'))).toBeUndefined();
    });

    it('should return operand for immediate mode', () => {
      // Note: immediate mode returns the numeric value, but callers
      // check for immediate mode separately before using this
      expect(analyzer.getInstructionAddress(immediate('LDA', 0x42))).toBe(0x42);
    });
  });

  // ==========================================================================
  // isIndexedAccess
  // ==========================================================================

  describe('isIndexedAccess', () => {
    it('ZeroPageX should be indexed', () => {
      expect(analyzer.isIndexedAccess(zeroPageX('LDA', 0x50))).toBe(true);
    });

    it('ZeroPageY should be indexed', () => {
      expect(analyzer.isIndexedAccess(zeroPageY('LDX', 0x50))).toBe(true);
    });

    it('AbsoluteX should be indexed', () => {
      expect(analyzer.isIndexedAccess(absoluteX('LDA', 0x1000))).toBe(true);
    });

    it('AbsoluteY should be indexed', () => {
      expect(analyzer.isIndexedAccess(absoluteY('LDA', 0x1000))).toBe(true);
    });

    it('IndexedIndirect should be indexed', () => {
      expect(analyzer.isIndexedAccess(indexedIndirect('LDA', 0x50))).toBe(true);
    });

    it('IndirectIndexed should be indexed', () => {
      expect(analyzer.isIndexedAccess(indirectIndexed('LDA', 0x50))).toBe(true);
    });

    it('Absolute should not be indexed', () => {
      expect(analyzer.isIndexedAccess(absolute('LDA', 0x1000))).toBe(false);
    });

    it('ZeroPage should not be indexed', () => {
      expect(analyzer.isIndexedAccess(zeroPage('LDA', 0x50))).toBe(false);
    });

    it('Immediate should not be indexed', () => {
      expect(analyzer.isIndexedAccess(immediate('LDA', 0x42))).toBe(false);
    });

    it('Implied should not be indexed', () => {
      expect(analyzer.isIndexedAccess(implied('NOP'))).toBe(false);
    });
  });

  // ==========================================================================
  // Real-world C64 patterns
  // ==========================================================================

  describe('real-world C64 patterns', () => {
    it('VIC register writes: STA $D020 / STA $D021 should not alias', () => {
      expect(analyzer.couldModify(absolute('STA', 0xD020), 0xD021)).toBe(false);
    });

    it('STA $D020 / LDA $D020 should alias (same register)', () => {
      expect(analyzer.couldModify(absolute('STA', 0xD020), 0xD020)).toBe(true);
    });

    it('ZP variable pair should not alias if different', () => {
      // $50 and $51 are different ZP locations
      expect(analyzer.couldModify(zeroPage('STA', 0x50), 0x51)).toBe(false);
    });
  });
});
