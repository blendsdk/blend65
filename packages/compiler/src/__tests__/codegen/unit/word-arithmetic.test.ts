/**
 * Word Arithmetic Operations Codegen Unit Tests
 *
 * Tests for 16-bit word arithmetic code generation:
 * - ADD_WORD_BYTE_IMM, ADD_WORD_IMM, ADD_WORD_BYTE_SLOT, ADD_WORD_SLOT
 * - SUB_WORD_BYTE_IMM, SUB_WORD_IMM, SUB_WORD_BYTE_SLOT, SUB_WORD_SLOT
 * - INC_WORD, DEC_WORD
 * - PROMOTE_BYTE_WORD
 *
 * All word operations use the A:X convention (low byte in A, high byte in X).
 *
 * @module __tests__/codegen/unit/word-arithmetic.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableArithmeticOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createZpWordSlot,
  createAbsWordSlot,
  createAddWordByteImmInstr,
  createAddWordImmInstr,
  createAddWordByteSlotInstr,
  createAddWordSlotInstr,
  createSubWordByteImmInstr,
  createSubWordImmInstr,
  createSubWordByteSlotInstr,
  createSubWordSlotInstr,
  createIncWordInstr,
  createDecWordInstr,
  countInstructions,
  findInstruction,
  findAllInstructions,
  hasCommentContaining,
} from './_arithmetic-helpers.js';
import {
  TestableMemoryOpsGenerator,
  createPromoteByteWordInstr,
} from './_test-helpers.js';
import {
  AsmAddressingMode,
  isInstructionElement,
  isLabelElement,
} from '../../../codegen/asm-il/types.js';

// ============================================================================
// ADD_WORD_BYTE_IMM — CLC / ADC #imm / BCC skip / INX
// ============================================================================

describe('ADD_WORD_BYTE_IMM Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate CLC, ADC #imm, BCC, INX sequence', () => {
    gen.testGenAddWordByteImm(createAddWordByteImmInstr(5));
    const elements = gen.getElements();

    expect(countInstructions(elements, 'CLC')).toBe(1);
    expect(countInstructions(elements, 'ADC')).toBe(1);
    expect(countInstructions(elements, 'BCC')).toBe(1);
    expect(countInstructions(elements, 'INX')).toBe(1);
  });

  it('should use immediate addressing for ADC', () => {
    gen.testGenAddWordByteImm(createAddWordByteImmInstr(42));
    const elements = gen.getElements();

    const adc = findInstruction(elements, 'ADC');
    expect(adc).toBeDefined();
    if (adc && isInstructionElement(adc)) {
      expect(adc.instruction.mode).toBe(AsmAddressingMode.Immediate);
      expect(adc.instruction.operand).toBe(42);
    }
  });

  it('should emit a label after INX for the BCC target', () => {
    gen.testGenAddWordByteImm(createAddWordByteImmInstr(10));
    const elements = gen.getElements();

    // Should have exactly one label element (the BCC target)
    const labels = elements.filter(isLabelElement);
    expect(labels.length).toBe(1);
  });

  it('should handle max byte value (255)', () => {
    gen.testGenAddWordByteImm(createAddWordByteImmInstr(255));
    const elements = gen.getElements();

    const adc = findInstruction(elements, 'ADC');
    if (adc && isInstructionElement(adc)) {
      expect(adc.instruction.operand).toBe(255);
    }
  });

  it('should invalidate accumulator state', () => {
    gen.testSetAFromImmediate(0x10);
    gen.testGenAddWordByteImm(createAddWordByteImmInstr(5));
    expect(gen.testAHasSlot(0x10)).toBe(false);
  });
});

// ============================================================================
// ADD_WORD_IMM — CLC / ADC #lo / PHA / TXA / ADC #hi / TAX / PLA
// ============================================================================

describe('ADD_WORD_IMM Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate full 16-bit add sequence (7 instructions)', () => {
    gen.testGenAddWordImm(createAddWordImmInstr(0x1234));
    const elements = gen.getElements();

    expect(countInstructions(elements, 'CLC')).toBe(1);
    expect(countInstructions(elements, 'ADC')).toBe(2); // lo and hi
    expect(countInstructions(elements, 'PHA')).toBe(1);
    expect(countInstructions(elements, 'TXA')).toBe(1);
    expect(countInstructions(elements, 'TAX')).toBe(1);
    expect(countInstructions(elements, 'PLA')).toBe(1);
  });

  it('should split word into correct lo/hi bytes', () => {
    gen.testGenAddWordImm(createAddWordImmInstr(0xABCD));
    const elements = gen.getElements();

    const adcInstrs = findAllInstructions(elements, 'ADC');
    expect(adcInstrs.length).toBe(2);

    // First ADC: low byte (0xCD)
    if (isInstructionElement(adcInstrs[0])) {
      expect(adcInstrs[0].instruction.mode).toBe(AsmAddressingMode.Immediate);
      expect(adcInstrs[0].instruction.operand).toBe(0xcd);
    }

    // Second ADC: high byte (0xAB)
    if (isInstructionElement(adcInstrs[1])) {
      expect(adcInstrs[1].instruction.mode).toBe(AsmAddressingMode.Immediate);
      expect(adcInstrs[1].instruction.operand).toBe(0xab);
    }
  });

  it('should emit correct order: CLC, ADC lo, PHA, TXA, ADC hi, TAX, PLA', () => {
    gen.testGenAddWordImm(createAddWordImmInstr(0x0100));
    const elements = gen.getElements();

    const instrs = elements.filter(isInstructionElement);
    const mnemonics = instrs.map((e) =>
      isInstructionElement(e) ? e.instruction.mnemonic : ''
    );

    expect(mnemonics).toEqual(['CLC', 'ADC', 'PHA', 'TXA', 'ADC', 'TAX', 'PLA']);
  });

  it('should handle zero value (0x0000)', () => {
    gen.testGenAddWordImm(createAddWordImmInstr(0x0000));
    const elements = gen.getElements();

    const adcInstrs = findAllInstructions(elements, 'ADC');
    if (isInstructionElement(adcInstrs[0])) {
      expect(adcInstrs[0].instruction.operand).toBe(0);
    }
    if (isInstructionElement(adcInstrs[1])) {
      expect(adcInstrs[1].instruction.operand).toBe(0);
    }
  });
});

// ============================================================================
// ADD_WORD_BYTE_SLOT — CLC / ADC slot / BCC skip / INX
// ============================================================================

describe('ADD_WORD_BYTE_SLOT Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate CLC, ADC slot, BCC, INX for zero page slot', () => {
    const slot = createZpSlot('i', 0x10);
    gen.testGenAddWordByteSlot(createAddWordByteSlotInstr(slot));
    const elements = gen.getElements();

    expect(countInstructions(elements, 'CLC')).toBe(1);
    expect(countInstructions(elements, 'ADC')).toBe(1);
    expect(countInstructions(elements, 'BCC')).toBe(1);
    expect(countInstructions(elements, 'INX')).toBe(1);
  });

  it('should use zero page addressing for ZP slot', () => {
    const slot = createZpSlot('counter', 0x20);
    gen.testGenAddWordByteSlot(createAddWordByteSlotInstr(slot));
    const elements = gen.getElements();

    const adc = findInstruction(elements, 'ADC');
    if (adc && isInstructionElement(adc)) {
      expect(adc.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      expect(adc.instruction.operand).toBe(0x20);
    }
  });

  it('should use absolute addressing for absolute slot', () => {
    const slot = createAbsSlot('data', 0x0400);
    gen.testGenAddWordByteSlot(createAddWordByteSlotInstr(slot));
    const elements = gen.getElements();

    const adc = findInstruction(elements, 'ADC');
    if (adc && isInstructionElement(adc)) {
      expect(adc.instruction.mode).toBe(AsmAddressingMode.Absolute);
      expect(adc.instruction.operand).toBe(0x0400);
    }
  });
});

// ============================================================================
// ADD_WORD_SLOT — CLC / ADC slot / PHA / TXA / ADC slot+1 / TAX / PLA
// ============================================================================

describe('ADD_WORD_SLOT Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate full 16-bit add from ZP word slot', () => {
    const slot = createZpWordSlot('addr', 0x10);
    gen.testGenAddWordSlot(createAddWordSlotInstr(slot));
    const elements = gen.getElements();

    expect(countInstructions(elements, 'CLC')).toBe(1);
    expect(countInstructions(elements, 'ADC')).toBe(2);
    expect(countInstructions(elements, 'PHA')).toBe(1);
    expect(countInstructions(elements, 'TXA')).toBe(1);
    expect(countInstructions(elements, 'TAX')).toBe(1);
    expect(countInstructions(elements, 'PLA')).toBe(1);
  });

  it('should read lo from slot and hi from slot+1', () => {
    const slot = createZpWordSlot('ptr', 0x30);
    gen.testGenAddWordSlot(createAddWordSlotInstr(slot));
    const elements = gen.getElements();

    const adcInstrs = findAllInstructions(elements, 'ADC');
    expect(adcInstrs.length).toBe(2);

    // First ADC: low byte at 0x30
    if (isInstructionElement(adcInstrs[0])) {
      expect(adcInstrs[0].instruction.operand).toBe(0x30);
      expect(adcInstrs[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
    }

    // Second ADC: high byte at 0x31
    if (isInstructionElement(adcInstrs[1])) {
      expect(adcInstrs[1].instruction.operand).toBe(0x31);
      expect(adcInstrs[1].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
    }
  });

  it('should use absolute addressing for absolute word slot', () => {
    const slot = createAbsWordSlot('buffer', 0x0800);
    gen.testGenAddWordSlot(createAddWordSlotInstr(slot));
    const elements = gen.getElements();

    const adcInstrs = findAllInstructions(elements, 'ADC');
    if (isInstructionElement(adcInstrs[0])) {
      expect(adcInstrs[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      expect(adcInstrs[0].instruction.operand).toBe(0x0800);
    }
    if (isInstructionElement(adcInstrs[1])) {
      expect(adcInstrs[1].instruction.mode).toBe(AsmAddressingMode.Absolute);
      expect(adcInstrs[1].instruction.operand).toBe(0x0801);
    }
  });
});

// ============================================================================
// SUB_WORD_BYTE_IMM — SEC / SBC #imm / BCS skip / DEX
// ============================================================================

describe('SUB_WORD_BYTE_IMM Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate SEC, SBC #imm, BCS, DEX sequence', () => {
    gen.testGenSubWordByteImm(createSubWordByteImmInstr(5));
    const elements = gen.getElements();

    expect(countInstructions(elements, 'SEC')).toBe(1);
    expect(countInstructions(elements, 'SBC')).toBe(1);
    expect(countInstructions(elements, 'BCS')).toBe(1);
    expect(countInstructions(elements, 'DEX')).toBe(1);
  });

  it('should use immediate addressing for SBC', () => {
    gen.testGenSubWordByteImm(createSubWordByteImmInstr(100));
    const elements = gen.getElements();

    const sbc = findInstruction(elements, 'SBC');
    if (sbc && isInstructionElement(sbc)) {
      expect(sbc.instruction.mode).toBe(AsmAddressingMode.Immediate);
      expect(sbc.instruction.operand).toBe(100);
    }
  });
});

// ============================================================================
// SUB_WORD_IMM — SEC / SBC #lo / PHA / TXA / SBC #hi / TAX / PLA
// ============================================================================

describe('SUB_WORD_IMM Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate full 16-bit subtract sequence', () => {
    gen.testGenSubWordImm(createSubWordImmInstr(0x1234));
    const elements = gen.getElements();

    expect(countInstructions(elements, 'SEC')).toBe(1);
    expect(countInstructions(elements, 'SBC')).toBe(2);
    expect(countInstructions(elements, 'PHA')).toBe(1);
    expect(countInstructions(elements, 'TXA')).toBe(1);
    expect(countInstructions(elements, 'TAX')).toBe(1);
    expect(countInstructions(elements, 'PLA')).toBe(1);
  });

  it('should split word into correct lo/hi for SBC', () => {
    gen.testGenSubWordImm(createSubWordImmInstr(0xBEEF));
    const elements = gen.getElements();

    const sbcInstrs = findAllInstructions(elements, 'SBC');
    // First SBC: low byte (0xEF)
    if (isInstructionElement(sbcInstrs[0])) {
      expect(sbcInstrs[0].instruction.operand).toBe(0xef);
    }
    // Second SBC: high byte (0xBE)
    if (isInstructionElement(sbcInstrs[1])) {
      expect(sbcInstrs[1].instruction.operand).toBe(0xbe);
    }
  });

  it('should emit correct order: SEC, SBC lo, PHA, TXA, SBC hi, TAX, PLA', () => {
    gen.testGenSubWordImm(createSubWordImmInstr(0x0200));
    const elements = gen.getElements();

    const instrs = elements.filter(isInstructionElement);
    const mnemonics = instrs.map((e) =>
      isInstructionElement(e) ? e.instruction.mnemonic : ''
    );

    expect(mnemonics).toEqual(['SEC', 'SBC', 'PHA', 'TXA', 'SBC', 'TAX', 'PLA']);
  });
});

// ============================================================================
// SUB_WORD_BYTE_SLOT — SEC / SBC slot / BCS skip / DEX
// ============================================================================

describe('SUB_WORD_BYTE_SLOT Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate SEC, SBC slot, BCS, DEX for ZP slot', () => {
    const slot = createZpSlot('offset', 0x10);
    gen.testGenSubWordByteSlot(createSubWordByteSlotInstr(slot));
    const elements = gen.getElements();

    expect(countInstructions(elements, 'SEC')).toBe(1);
    expect(countInstructions(elements, 'SBC')).toBe(1);
    expect(countInstructions(elements, 'BCS')).toBe(1);
    expect(countInstructions(elements, 'DEX')).toBe(1);
  });

  it('should use correct addressing mode for slot', () => {
    const zpSlot = createZpSlot('x', 0x20);
    gen.testGenSubWordByteSlot(createSubWordByteSlotInstr(zpSlot));
    const elements = gen.getElements();

    const sbc = findInstruction(elements, 'SBC');
    if (sbc && isInstructionElement(sbc)) {
      expect(sbc.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      expect(sbc.instruction.operand).toBe(0x20);
    }
  });
});

// ============================================================================
// SUB_WORD_SLOT — SEC / SBC slot / PHA / TXA / SBC slot+1 / TAX / PLA
// ============================================================================

describe('SUB_WORD_SLOT Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate full 16-bit subtract from word slot', () => {
    const slot = createZpWordSlot('delta', 0x40);
    gen.testGenSubWordSlot(createSubWordSlotInstr(slot));
    const elements = gen.getElements();

    expect(countInstructions(elements, 'SEC')).toBe(1);
    expect(countInstructions(elements, 'SBC')).toBe(2);
    expect(countInstructions(elements, 'PHA')).toBe(1);
    expect(countInstructions(elements, 'TXA')).toBe(1);
    expect(countInstructions(elements, 'TAX')).toBe(1);
    expect(countInstructions(elements, 'PLA')).toBe(1);
  });

  it('should read lo from slot and hi from slot+1', () => {
    const slot = createAbsWordSlot('src', 0x0600);
    gen.testGenSubWordSlot(createSubWordSlotInstr(slot));
    const elements = gen.getElements();

    const sbcInstrs = findAllInstructions(elements, 'SBC');
    if (isInstructionElement(sbcInstrs[0])) {
      expect(sbcInstrs[0].instruction.operand).toBe(0x0600);
    }
    if (isInstructionElement(sbcInstrs[1])) {
      expect(sbcInstrs[1].instruction.operand).toBe(0x0601);
    }
  });
});

// ============================================================================
// INC_WORD — INC slot / BNE skip / INC slot+1
// ============================================================================

describe('INC_WORD Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate INC lo, BNE, INC hi sequence for ZP slot', () => {
    const slot = createZpWordSlot('counter', 0x10);
    gen.testGenIncWord(createIncWordInstr(slot));
    const elements = gen.getElements();

    expect(countInstructions(elements, 'INC')).toBe(2);
    expect(countInstructions(elements, 'BNE')).toBe(1);
  });

  it('should increment lo at slot address and hi at slot+1', () => {
    const slot = createZpWordSlot('ptr', 0x50);
    gen.testGenIncWord(createIncWordInstr(slot));
    const elements = gen.getElements();

    const incInstrs = findAllInstructions(elements, 'INC');
    // First INC: low byte at 0x50
    if (isInstructionElement(incInstrs[0])) {
      expect(incInstrs[0].instruction.operand).toBe(0x50);
      expect(incInstrs[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
    }
    // Second INC: high byte at 0x51
    if (isInstructionElement(incInstrs[1])) {
      expect(incInstrs[1].instruction.operand).toBe(0x51);
      expect(incInstrs[1].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
    }
  });

  it('should use absolute addressing for absolute word slot', () => {
    const slot = createAbsWordSlot('timer', 0x0300);
    gen.testGenIncWord(createIncWordInstr(slot));
    const elements = gen.getElements();

    const incInstrs = findAllInstructions(elements, 'INC');
    if (isInstructionElement(incInstrs[0])) {
      expect(incInstrs[0].instruction.mode).toBe(AsmAddressingMode.Absolute);
      expect(incInstrs[0].instruction.operand).toBe(0x0300);
    }
    if (isInstructionElement(incInstrs[1])) {
      expect(incInstrs[1].instruction.mode).toBe(AsmAddressingMode.Absolute);
      expect(incInstrs[1].instruction.operand).toBe(0x0301);
    }
  });

  it('should have a BCC target label after the carry INC', () => {
    const slot = createZpWordSlot('val', 0x10);
    gen.testGenIncWord(createIncWordInstr(slot));
    const elements = gen.getElements();

    const labels = elements.filter(isLabelElement);
    expect(labels.length).toBe(1);
  });
});

// ============================================================================
// DEC_WORD — LDA slot / BNE skip / DEC slot+1 / DEC slot
// ============================================================================

describe('DEC_WORD Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate LDA, BNE, DEC hi, DEC lo sequence', () => {
    const slot = createZpWordSlot('counter', 0x10);
    gen.testGenDecWord(createDecWordInstr(slot));
    const elements = gen.getElements();

    expect(countInstructions(elements, 'LDA')).toBe(1);
    expect(countInstructions(elements, 'BNE')).toBe(1);
    expect(countInstructions(elements, 'DEC')).toBe(2);
  });

  it('should LDA from slot address to check for borrow', () => {
    const slot = createZpWordSlot('ptr', 0x20);
    gen.testGenDecWord(createDecWordInstr(slot));
    const elements = gen.getElements();

    const lda = findInstruction(elements, 'LDA');
    if (lda && isInstructionElement(lda)) {
      expect(lda.instruction.operand).toBe(0x20);
      expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
    }
  });

  it('should DEC hi at slot+1 and DEC lo at slot', () => {
    const slot = createZpWordSlot('val', 0x30);
    gen.testGenDecWord(createDecWordInstr(slot));
    const elements = gen.getElements();

    const decInstrs = findAllInstructions(elements, 'DEC');
    // First DEC: high byte (borrow) at 0x31
    if (isInstructionElement(decInstrs[0])) {
      expect(decInstrs[0].instruction.operand).toBe(0x31);
    }
    // Second DEC: low byte at 0x30
    if (isInstructionElement(decInstrs[1])) {
      expect(decInstrs[1].instruction.operand).toBe(0x30);
    }
  });

  it('should use absolute mode for absolute word slot', () => {
    const slot = createAbsWordSlot('timer', 0x0500);
    gen.testGenDecWord(createDecWordInstr(slot));
    const elements = gen.getElements();

    const lda = findInstruction(elements, 'LDA');
    if (lda && isInstructionElement(lda)) {
      expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
    }
  });

  it('should invalidate accumulator state (LDA clobbers A)', () => {
    gen.testSetAFromImmediate(42);
    const slot = createZpWordSlot('x', 0x10);
    gen.testGenDecWord(createDecWordInstr(slot));
    // A was loaded with the original low byte value, invalidated
    expect(gen.testAHasSlot(0x10)).toBe(false);
  });
});

// ============================================================================
// PROMOTE_BYTE_WORD — LDX #0
// ============================================================================

describe('PROMOTE_BYTE_WORD Code Generation', () => {
  let gen: TestableMemoryOpsGenerator;

  beforeEach(() => {
    gen = new TestableMemoryOpsGenerator();
  });

  it('should generate LDX #0', () => {
    gen.testGenPromoteByteWord(createPromoteByteWordInstr());
    const elements = gen.getElements();

    expect(countInstructions(elements, 'LDX')).toBe(1);

    const ldx = findInstruction(elements, 'LDX');
    if (ldx && isInstructionElement(ldx)) {
      expect(ldx.instruction.mode).toBe(AsmAddressingMode.Immediate);
      expect(ldx.instruction.operand).toBe(0);
    }
  });

  it('should preserve accumulator state (A unchanged)', () => {
    gen.testSetAFromImmediate(42);
    gen.testGenPromoteByteWord(createPromoteByteWordInstr());
    // A should still be tracked as holding 42
    expect(gen.testAHasImmediate(42)).toBe(true);
  });

  it('should emit comment about promotion', () => {
    gen.testGenPromoteByteWord(createPromoteByteWordInstr());
    const elements = gen.getElements();

    expect(hasCommentContaining(elements, 'promote') || hasCommentContaining(elements, 'Promote')).toBe(true);
  });
});

// ============================================================================
// Integration: Combined word arithmetic patterns
// ============================================================================

describe('Word Arithmetic Combined Patterns', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  it('should generate unique labels for multiple byte-imm additions', () => {
    // Two ADD_WORD_BYTE_IMM in a row should get different labels
    gen.testGenAddWordByteImm(createAddWordByteImmInstr(5));
    gen.testGenAddWordByteImm(createAddWordByteImmInstr(10));
    const elements = gen.getElements();

    const labels = elements.filter(isLabelElement);
    // Each operation creates one label, so 2 total
    expect(labels.length).toBe(2);

    // Labels should be unique
    if (isLabelElement(labels[0]) && isLabelElement(labels[1])) {
      expect(labels[0].label.name).not.toBe(labels[1].label.name);
    }
  });

  it('should generate correct code for add + subtract pattern', () => {
    // Simulate: A:X = A:X + 5 - 3
    gen.testGenAddWordByteImm(createAddWordByteImmInstr(5));
    gen.testGenSubWordByteImm(createSubWordByteImmInstr(3));
    const elements = gen.getElements();

    // Should have CLC + ADC + BCC + INX + SEC + SBC + BCS + DEX
    expect(countInstructions(elements, 'CLC')).toBe(1);
    expect(countInstructions(elements, 'SEC')).toBe(1);
    expect(countInstructions(elements, 'ADC')).toBe(1);
    expect(countInstructions(elements, 'SBC')).toBe(1);
  });
});
