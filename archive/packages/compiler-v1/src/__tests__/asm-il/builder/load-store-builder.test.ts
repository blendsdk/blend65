/**
 * Load/Store Builder Tests
 *
 * Tests for LoadStoreBuilder: LDA, LDX, LDY, STA, STX, STY instructions.
 *
 * @module __tests__/asm-il/builder/load-store-builder.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AsmModuleBuilder } from '../../../asm-il/builder/module-builder.js';
import { AddressingMode, isAsmInstruction } from '../../../asm-il/types.js';
import type { AsmInstruction } from '../../../asm-il/types.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Get the last instruction from builder
 */
function getLastInstruction(builder: AsmModuleBuilder): AsmInstruction | undefined {
  const items = builder.getItems();
  const last = items[items.length - 1];
  return isAsmInstruction(last) ? last : undefined;
}

// ============================================================================
// LDA INSTRUCTION TESTS
// ============================================================================

describe('LDA instructions', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('ldaImm', () => {
    it('should emit LDA immediate', () => {
      builder.ldaImm(0x05);

      const instr = getLastInstruction(builder);
      expect(instr).toBeDefined();
      expect(instr?.mnemonic).toBe('LDA');
      expect(instr?.mode).toBe(AddressingMode.Immediate);
      expect(instr?.operand).toBe(0x05);
    });

    it('should have correct byte count', () => {
      builder.ldaImm(0xFF);

      const instr = getLastInstruction(builder);
      expect(instr?.bytes).toBe(2);
    });

    it('should have correct cycle count', () => {
      builder.ldaImm(0x00);

      const instr = getLastInstruction(builder);
      expect(instr?.cycles).toBe(2);
    });

    it('should support comment', () => {
      builder.ldaImm(0x00, 'Load zero');

      const instr = getLastInstruction(builder);
      expect(instr?.comment).toBe('Load zero');
    });
  });

  describe('ldaZp', () => {
    it('should emit LDA zero page', () => {
      builder.ldaZp(0x10);

      const instr = getLastInstruction(builder);
      expect(instr?.mnemonic).toBe('LDA');
      expect(instr?.mode).toBe(AddressingMode.ZeroPage);
      expect(instr?.operand).toBe(0x10);
      expect(instr?.bytes).toBe(2);
      expect(instr?.cycles).toBe(3);
    });
  });

  describe('ldaZpX', () => {
    it('should emit LDA zero page,X', () => {
      builder.ldaZpX(0x20);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.ZeroPageX);
      expect(instr?.cycles).toBe(4);
    });
  });

  describe('ldaAbs', () => {
    it('should emit LDA absolute with number', () => {
      builder.ldaAbs(0x1234);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.Absolute);
      expect(instr?.operand).toBe(0x1234);
      expect(instr?.bytes).toBe(3);
      expect(instr?.cycles).toBe(4);
    });

    it('should emit LDA absolute with label', () => {
      builder.ldaAbs('_counter');

      const instr = getLastInstruction(builder);
      expect(instr?.operand).toBe('_counter');
    });
  });

  describe('ldaAbsX', () => {
    it('should emit LDA absolute,X', () => {
      builder.ldaAbsX(0x1000);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.AbsoluteX);
      expect(instr?.cycles).toBe(4);
    });
  });

  describe('ldaAbsY', () => {
    it('should emit LDA absolute,Y', () => {
      builder.ldaAbsY(0x1000);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.AbsoluteY);
      expect(instr?.cycles).toBe(4);
    });
  });

  describe('ldaIndX', () => {
    it('should emit LDA indirect,X', () => {
      builder.ldaIndX(0x80);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.IndirectX);
      expect(instr?.bytes).toBe(2);
      expect(instr?.cycles).toBe(6);
    });
  });

  describe('ldaIndY', () => {
    it('should emit LDA indirect,Y', () => {
      builder.ldaIndY(0x80);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.IndirectY);
      expect(instr?.cycles).toBe(5);
    });
  });
});

// ============================================================================
// LDX INSTRUCTION TESTS
// ============================================================================

describe('LDX instructions', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('ldxImm', () => {
    it('should emit LDX immediate', () => {
      builder.ldxImm(0x10);

      const instr = getLastInstruction(builder);
      expect(instr?.mnemonic).toBe('LDX');
      expect(instr?.mode).toBe(AddressingMode.Immediate);
      expect(instr?.operand).toBe(0x10);
      expect(instr?.cycles).toBe(2);
    });
  });

  describe('ldxZp', () => {
    it('should emit LDX zero page', () => {
      builder.ldxZp(0x20);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.ZeroPage);
      expect(instr?.cycles).toBe(3);
    });
  });

  describe('ldxZpY', () => {
    it('should emit LDX zero page,Y', () => {
      builder.ldxZpY(0x30);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.ZeroPageY);
      expect(instr?.cycles).toBe(4);
    });
  });

  describe('ldxAbs', () => {
    it('should emit LDX absolute', () => {
      builder.ldxAbs(0x2000);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.Absolute);
      expect(instr?.cycles).toBe(4);
    });
  });

  describe('ldxAbsY', () => {
    it('should emit LDX absolute,Y', () => {
      builder.ldxAbsY(0x2000);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.AbsoluteY);
      expect(instr?.cycles).toBe(4);
    });
  });
});

// ============================================================================
// LDY INSTRUCTION TESTS
// ============================================================================

describe('LDY instructions', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('ldyImm', () => {
    it('should emit LDY immediate', () => {
      builder.ldyImm(0x10);

      const instr = getLastInstruction(builder);
      expect(instr?.mnemonic).toBe('LDY');
      expect(instr?.mode).toBe(AddressingMode.Immediate);
      expect(instr?.cycles).toBe(2);
    });
  });

  describe('ldyZp', () => {
    it('should emit LDY zero page', () => {
      builder.ldyZp(0x20);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.ZeroPage);
      expect(instr?.cycles).toBe(3);
    });
  });

  describe('ldyZpX', () => {
    it('should emit LDY zero page,X', () => {
      builder.ldyZpX(0x30);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.ZeroPageX);
      expect(instr?.cycles).toBe(4);
    });
  });

  describe('ldyAbs', () => {
    it('should emit LDY absolute', () => {
      builder.ldyAbs(0x2000);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.Absolute);
      expect(instr?.cycles).toBe(4);
    });
  });

  describe('ldyAbsX', () => {
    it('should emit LDY absolute,X', () => {
      builder.ldyAbsX(0x2000);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.AbsoluteX);
      expect(instr?.cycles).toBe(4);
    });
  });
});

// ============================================================================
// STA INSTRUCTION TESTS
// ============================================================================

describe('STA instructions', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('staZp', () => {
    it('should emit STA zero page', () => {
      builder.staZp(0x10);

      const instr = getLastInstruction(builder);
      expect(instr?.mnemonic).toBe('STA');
      expect(instr?.mode).toBe(AddressingMode.ZeroPage);
      expect(instr?.bytes).toBe(2);
      expect(instr?.cycles).toBe(3);
    });
  });

  describe('staZpX', () => {
    it('should emit STA zero page,X', () => {
      builder.staZpX(0x20);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.ZeroPageX);
      expect(instr?.cycles).toBe(4);
    });
  });

  describe('staAbs', () => {
    it('should emit STA absolute with number', () => {
      builder.staAbs(0xD020);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.Absolute);
      expect(instr?.operand).toBe(0xD020);
      expect(instr?.bytes).toBe(3);
      expect(instr?.cycles).toBe(4);
    });

    it('should emit STA absolute with label', () => {
      builder.staAbs('_counter');

      const instr = getLastInstruction(builder);
      expect(instr?.operand).toBe('_counter');
    });
  });

  describe('staAbsX', () => {
    it('should emit STA absolute,X', () => {
      builder.staAbsX(0x1000);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.AbsoluteX);
      expect(instr?.cycles).toBe(5);
    });
  });

  describe('staAbsY', () => {
    it('should emit STA absolute,Y', () => {
      builder.staAbsY(0x1000);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.AbsoluteY);
      expect(instr?.cycles).toBe(5);
    });
  });

  describe('staIndX', () => {
    it('should emit STA indirect,X', () => {
      builder.staIndX(0x80);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.IndirectX);
      expect(instr?.cycles).toBe(6);
    });
  });

  describe('staIndY', () => {
    it('should emit STA indirect,Y', () => {
      builder.staIndY(0x80);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.IndirectY);
      expect(instr?.cycles).toBe(6);
    });
  });
});

// ============================================================================
// STX INSTRUCTION TESTS
// ============================================================================

describe('STX instructions', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('stxZp', () => {
    it('should emit STX zero page', () => {
      builder.stxZp(0x10);

      const instr = getLastInstruction(builder);
      expect(instr?.mnemonic).toBe('STX');
      expect(instr?.mode).toBe(AddressingMode.ZeroPage);
      expect(instr?.cycles).toBe(3);
    });
  });

  describe('stxZpY', () => {
    it('should emit STX zero page,Y', () => {
      builder.stxZpY(0x20);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.ZeroPageY);
      expect(instr?.cycles).toBe(4);
    });
  });

  describe('stxAbs', () => {
    it('should emit STX absolute', () => {
      builder.stxAbs(0x2000);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.Absolute);
      expect(instr?.cycles).toBe(4);
    });
  });
});

// ============================================================================
// STY INSTRUCTION TESTS
// ============================================================================

describe('STY instructions', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend');
  });

  describe('styZp', () => {
    it('should emit STY zero page', () => {
      builder.styZp(0x10);

      const instr = getLastInstruction(builder);
      expect(instr?.mnemonic).toBe('STY');
      expect(instr?.mode).toBe(AddressingMode.ZeroPage);
      expect(instr?.cycles).toBe(3);
    });
  });

  describe('styZpX', () => {
    it('should emit STY zero page,X', () => {
      builder.styZpX(0x20);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.ZeroPageX);
      expect(instr?.cycles).toBe(4);
    });
  });

  describe('styAbs', () => {
    it('should emit STY absolute', () => {
      builder.styAbs(0x2000);

      const instr = getLastInstruction(builder);
      expect(instr?.mode).toBe(AddressingMode.Absolute);
      expect(instr?.cycles).toBe(4);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Load/Store integration', () => {
  it('should track code bytes correctly', () => {
    const builder = new AsmModuleBuilder('test.blend')
      .ldaImm(0x05) // 2 bytes
      .staZp(0x10) // 2 bytes
      .ldxImm(0x00) // 2 bytes
      .stxAbs(0x1234); // 3 bytes

    const stats = builder.getStats();
    expect(stats.codeBytes).toBe(9);
  });

  it('should update current address', () => {
    const builder = new AsmModuleBuilder('test.blend', 0x0801)
      .ldaImm(0x05) // 2 bytes
      .staAbs(0xD020); // 3 bytes

    expect(builder.getCurrentAddress()).toBe(0x0801 + 5);
  });
});