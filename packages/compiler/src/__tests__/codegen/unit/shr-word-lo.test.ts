/**
 * SHR_WORD_LO (Optimized lo(word >> N)) Codegen Unit Tests
 *
 * Tests for the shift-left technique code generation that replaces the
 * expensive SHR_WORD(N) + LO pattern for N=3-7.
 *
 * The shift-left technique exploits: lo(word >> N) = hi(word << (8-N))
 *
 * Expected 6502 output: STA $FB / TXA / [ASL $FB / ROL A] × (8-N)
 *
 * @module __tests__/codegen/unit/shr-word-lo.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableBitwiseOpsGenerator,
  createShrWordLoInstr,
  createShrWordInstr,
  findInstruction,
  findAllInstructions,
  countInstructions,
  hasCommentContaining,
  getInstructions,
} from './_bitwise-helpers.js';
import { isInstructionElement, AsmAddressingMode } from '../../../codegen/asm-il/types.js';

/** Compiler scratch ZP address used by SHR_WORD_LO */
const SCRATCH_ZP = 0xfb;

describe('SHR_WORD_LO (shift-left technique codegen)', () => {
  let generator: TestableBitwiseOpsGenerator;

  beforeEach(() => {
    generator = new TestableBitwiseOpsGenerator();
  });

  // ==========================================================================
  // Instruction Pattern: STA $FB / TXA / [ASL $FB / ROL A] × (8-N)
  // ==========================================================================

  describe('instruction pattern for each shift count', () => {
    it('should generate STA/TXA + 5 rounds of ASL/ROL for N=3', () => {
      const instr = createShrWordLoInstr(3);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      // STA $FB + TXA + 5 × (ASL $FB + ROL A) = 2 + 10 = 12 instructions
      expect(countInstructions(elements, 'STA')).toBe(1);
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'ASL')).toBe(5); // 8 - 3 = 5 rounds
      expect(countInstructions(elements, 'ROL')).toBe(5);
    });

    it('should generate STA/TXA + 4 rounds of ASL/ROL for N=4', () => {
      const instr = createShrWordLoInstr(4);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'STA')).toBe(1);
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'ASL')).toBe(4); // 8 - 4 = 4 rounds
      expect(countInstructions(elements, 'ROL')).toBe(4);
    });

    it('should generate STA/TXA + 3 rounds of ASL/ROL for N=5', () => {
      const instr = createShrWordLoInstr(5);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'STA')).toBe(1);
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'ASL')).toBe(3); // 8 - 5 = 3 rounds
      expect(countInstructions(elements, 'ROL')).toBe(3);
    });

    it('should generate STA/TXA + 2 rounds of ASL/ROL for N=6 (sprite /64)', () => {
      // This is the critical sprite pointer calculation: lo(addr / 64)
      const instr = createShrWordLoInstr(6);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'STA')).toBe(1);
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'ASL')).toBe(2); // 8 - 6 = 2 rounds
      expect(countInstructions(elements, 'ROL')).toBe(2);
    });

    it('should generate STA/TXA + 1 round of ASL/ROL for N=7', () => {
      const instr = createShrWordLoInstr(7);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'STA')).toBe(1);
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'ASL')).toBe(1); // 8 - 7 = 1 round
      expect(countInstructions(elements, 'ROL')).toBe(1);
    });
  });

  // ==========================================================================
  // Instruction Order
  // ==========================================================================

  describe('instruction order', () => {
    it('should emit STA, TXA, then alternating ASL/ROL for N=6', () => {
      const instr = createShrWordLoInstr(6);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements);
      const mnemonics = instructions
        .filter(isInstructionElement)
        .map((e) => e.instruction.mnemonic);

      // Expected: STA, TXA, ASL, ROL, ASL, ROL (2 rounds)
      expect(mnemonics).toEqual(['STA', 'TXA', 'ASL', 'ROL', 'ASL', 'ROL']);
    });

    it('should emit correct order for N=7 (1 round)', () => {
      const instr = createShrWordLoInstr(7);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements);
      const mnemonics = instructions
        .filter(isInstructionElement)
        .map((e) => e.instruction.mnemonic);

      // Expected: STA, TXA, ASL, ROL (1 round)
      expect(mnemonics).toEqual(['STA', 'TXA', 'ASL', 'ROL']);
    });

    it('should emit correct order for N=3 (5 rounds)', () => {
      const instr = createShrWordLoInstr(3);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements);
      const mnemonics = instructions
        .filter(isInstructionElement)
        .map((e) => e.instruction.mnemonic);

      // Expected: STA, TXA, [ASL, ROL] × 5
      expect(mnemonics).toEqual([
        'STA', 'TXA',
        'ASL', 'ROL', 'ASL', 'ROL', 'ASL', 'ROL', 'ASL', 'ROL', 'ASL', 'ROL',
      ]);
    });
  });

  // ==========================================================================
  // Addressing Modes
  // ==========================================================================

  describe('addressing modes', () => {
    it('should use zeroPage mode for STA to scratch address', () => {
      const instr = createShrWordLoInstr(6);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const staInstr = findInstruction(elements, 'STA');
      expect(isInstructionElement(staInstr)).toBe(true);
      if (isInstructionElement(staInstr)) {
        expect(staInstr.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(staInstr.instruction.operand).toBe(SCRATCH_ZP);
      }
    });

    it('should use zeroPage mode for all ASL instructions', () => {
      const instr = createShrWordLoInstr(5);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const aslInstrs = findAllInstructions(elements, 'ASL');
      expect(aslInstrs.length).toBe(3);
      for (const asl of aslInstrs) {
        if (isInstructionElement(asl)) {
          expect(asl.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(asl.instruction.operand).toBe(SCRATCH_ZP);
        }
      }
    });

    it('should use accumulator mode for all ROL instructions', () => {
      const instr = createShrWordLoInstr(5);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const rolInstrs = findAllInstructions(elements, 'ROL');
      expect(rolInstrs.length).toBe(3);
      for (const rol of rolInstrs) {
        if (isInstructionElement(rol)) {
          expect(rol.instruction.mode).toBe(AsmAddressingMode.Accumulator);
        }
      }
    });

    it('should target scratch ZP address $FB for all memory operations', () => {
      const instr = createShrWordLoInstr(4);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);

      // All memory-addressing instructions (STA, ASL) should target $FB
      for (const elem of instructions) {
        if (elem.instruction.mnemonic === 'STA' || elem.instruction.mnemonic === 'ASL') {
          expect(elem.instruction.operand).toBe(SCRATCH_ZP);
        }
      }
    });
  });

  // ==========================================================================
  // Instruction Count / Byte Count Comparison
  // ==========================================================================

  describe('instruction count improvements vs SHR_WORD', () => {
    it('N=3: 12 instructions (was 18 with SHR_WORD)', () => {
      const instr = createShrWordLoInstr(3);
      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);
      // STA + TXA + 5 × (ASL + ROL) = 2 + 10 = 12
      expect(instructions.length).toBe(12);
    });

    it('N=4: 10 instructions (was 24 with SHR_WORD)', () => {
      const instr = createShrWordLoInstr(4);
      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);
      // STA + TXA + 4 × (ASL + ROL) = 2 + 8 = 10
      expect(instructions.length).toBe(10);
    });

    it('N=5: 8 instructions (was 30 with SHR_WORD)', () => {
      const instr = createShrWordLoInstr(5);
      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);
      // STA + TXA + 3 × (ASL + ROL) = 2 + 6 = 8
      expect(instructions.length).toBe(8);
    });

    it('N=6: 6 instructions (was 36 with SHR_WORD) — 83% reduction', () => {
      const instr = createShrWordLoInstr(6);
      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);
      // STA + TXA + 2 × (ASL + ROL) = 2 + 4 = 6
      expect(instructions.length).toBe(6);
    });

    it('N=7: 4 instructions (was 42 with SHR_WORD) — 90% reduction', () => {
      const instr = createShrWordLoInstr(7);
      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);
      // STA + TXA + 1 × (ASL + ROL) = 2 + 2 = 4
      expect(instructions.length).toBe(4);
    });

    it('N=6 byte count: ~9 bytes vs ~36 bytes for SHR_WORD(6)', () => {
      // SHR_WORD_LO(6) generates:
      //   STA $FB  = 2 bytes (ZP mode)
      //   TXA      = 1 byte (implied)
      //   ASL $FB  = 2 bytes (ZP mode) × 2 = 4 bytes
      //   ROL A    = 1 byte (accumulator) × 2 = 2 bytes
      //   Total: 2 + 1 + 4 + 2 = 9 bytes

      // SHR_WORD(6) generates:
      //   [PHA/TXA/LSR/TAX/PLA/ROR] × 6 = 6 × 6 = 36 bytes (all 1-byte implied)
      //   Total: 36 bytes

      // Verify SHR_WORD_LO generates fewer instructions
      const loGen = new TestableBitwiseOpsGenerator();
      const loInstr = createShrWordLoInstr(6);
      loGen.testGenShrWordLo(loInstr);
      const loCount = getInstructions(loGen.getElements()).filter(isInstructionElement).length;

      const wordGen = new TestableBitwiseOpsGenerator();
      const wordInstr = createShrWordInstr(6);
      wordGen.testGenShrWord(wordInstr);
      const wordCount = getInstructions(wordGen.getElements()).filter(isInstructionElement).length;

      // SHR_WORD_LO: 6 instructions, SHR_WORD: 36 instructions
      expect(loCount).toBe(6);
      expect(wordCount).toBe(36);
      expect(loCount).toBeLessThan(wordCount);
    });
  });

  // ==========================================================================
  // No PHA/PLA/TAX (not using standard SHR_WORD pattern)
  // ==========================================================================

  describe('does NOT use standard SHR_WORD pattern', () => {
    it('should not emit PHA (no stack usage)', () => {
      for (let n = 3; n <= 7; n++) {
        const gen = new TestableBitwiseOpsGenerator();
        gen.testGenShrWordLo(createShrWordLoInstr(n));
        expect(countInstructions(gen.getElements(), 'PHA')).toBe(0);
      }
    });

    it('should not emit PLA (no stack usage)', () => {
      for (let n = 3; n <= 7; n++) {
        const gen = new TestableBitwiseOpsGenerator();
        gen.testGenShrWordLo(createShrWordLoInstr(n));
        expect(countInstructions(gen.getElements(), 'PLA')).toBe(0);
      }
    });

    it('should not emit TAX (not saving back to X)', () => {
      for (let n = 3; n <= 7; n++) {
        const gen = new TestableBitwiseOpsGenerator();
        gen.testGenShrWordLo(createShrWordLoInstr(n));
        expect(countInstructions(gen.getElements(), 'TAX')).toBe(0);
      }
    });

    it('should not emit LSR (uses ASL/ROL shift-left, not LSR shift-right)', () => {
      for (let n = 3; n <= 7; n++) {
        const gen = new TestableBitwiseOpsGenerator();
        gen.testGenShrWordLo(createShrWordLoInstr(n));
        expect(countInstructions(gen.getElements(), 'LSR')).toBe(0);
      }
    });
  });

  // ==========================================================================
  // Accumulator State
  // ==========================================================================

  describe('accumulator state', () => {
    it('should invalidate accumulator state after SHR_WORD_LO', () => {
      const instr = createShrWordLoInstr(6);

      generator.testSetAFromImmediate(0xff);
      generator.testGenShrWordLo(instr);

      // A state should be unknown after the operation
      expect(generator.testAHasSlot(0x10)).toBe(false);
    });

    it('should invalidate for all shift counts 3-7', () => {
      for (let n = 3; n <= 7; n++) {
        const gen = new TestableBitwiseOpsGenerator();
        gen.testSetAFromImmediate(0x42);
        gen.testGenShrWordLo(createShrWordLoInstr(n));
        expect(gen.testAHasSlot(0x10)).toBe(false);
      }
    });
  });

  // ==========================================================================
  // Comments
  // ==========================================================================

  describe('instruction comments', () => {
    it('should preserve IL comment', () => {
      const instr = createShrWordLoInstr(6);

      generator.testGenShrWordLo(instr);

      const elements = generator.getElements();
      expect(hasCommentContaining(elements, 'SHR_WORD_LO')).toBe(true);
    });
  });
});
