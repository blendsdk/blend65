/**
 * CGT8.2: Assignment Integration Tests
 *
 * Tests code generation for variable assignment patterns using the
 * real CodeGenerator class with complete IL programs. Covers:
 * - Simple assignments (byte and word)
 * - Compound assignments (add-assign, sub-assign, etc.)
 * - Multi-variable assignments
 * - Memory-mapped I/O assignments (POKE/POKEW)
 * - Global init assignments
 *
 * @module __tests__/codegen/integration/assignments
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../../il/enums.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';
import {
  zpSlot,
  absSlot,
  zpWordSlot,
  absWordSlot,
  slotOp,
  immOp,
  immWordOp,
  addrOp,
  instr,
  buildProgram,
  generate,
  mnemonics,
  allInstructions,
  countMnemonic,
  hasLabel,
  hasComment,
} from './_helpers.js';

// ============================================================================
// Test Data: Common slots used across assignment tests
// ============================================================================

/** Zero page byte slots */
const a = zpSlot('a', 0x02);
const b = zpSlot('b', 0x03);
const c = zpSlot('c', 0x04);

/** Absolute byte slots */
const score = absSlot('score', 0x0200);
const level = absSlot('level', 0x0201);

/** Zero page word slots */
const ptr = zpWordSlot('ptr', 0x10);
const addr = zpWordSlot('addr', 0x12);

/** Absolute word slots */
const screenPtr = absWordSlot('screenPtr', 0x0300);

describe('CGT8.2: Assignment Integration Tests', () => {
  // ==========================================================================
  // Simple Byte Assignments
  // ==========================================================================

  describe('Simple byte assignments', () => {
    it('generates code for immediate byte assignment: a = 42', () => {
      const program = buildProgram(
        'assignImm',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(42)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should be: LDA #42, STA a
      expect(ops).toContain('LDA');
      expect(ops).toContain('STA');

      // Verify LDA uses immediate mode
      const instrs = allInstructions(output);
      const lda = instrs.find(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'LDA'
      );
      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(lda.instruction.operand).toBe(42);
      }
    });

    it('generates code for variable-to-variable assignment: a = b', () => {
      const program = buildProgram(
        'assignVar',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(b)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should be: LDA b, STA a
      expect(ops).toContain('LDA');
      expect(ops).toContain('STA');
      expect(countMnemonic(output, 'LDA')).toBe(1);
      expect(countMnemonic(output, 'STA')).toBe(1);
    });

    it('generates code for zero assignment: a = 0', () => {
      const program = buildProgram(
        'assignZero',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(0)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a]
      );

      const output = generate(program);
      const instrs = allInstructions(output);

      // Should load #0
      const lda = instrs.find(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'LDA'
      );
      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0);
      }
    });

    it('generates code for max byte assignment: a = 255', () => {
      const program = buildProgram(
        'assignMax',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(255)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a]
      );

      const output = generate(program);
      const instrs = allInstructions(output);

      const lda = instrs.find(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'LDA'
      );
      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(255);
      }
    });
  });

  // ==========================================================================
  // Simple Word Assignments
  // ==========================================================================

  describe('Simple word assignments', () => {
    it('generates code for immediate word assignment: ptr = 0x0400', () => {
      const program = buildProgram(
        'assignWordImm',
        [
          instr(ILOpcode.LOAD_IMM_WORD, [immWordOp(0x0400)]),
          instr(ILOpcode.STORE_WORD, [slotOp(ptr)]),
          instr(ILOpcode.RETURN),
        ],
        [ptr]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Word load: LDA #lo, LDX #hi
      // Word store: STA addr, STX addr+1
      expect(ops).toContain('LDA');
      expect(ops).toContain('LDX');
      expect(ops).toContain('STA');
      expect(ops).toContain('STX');
    });

    it('generates code for word-to-word assignment: ptr = addr', () => {
      const program = buildProgram(
        'assignWordVar',
        [
          instr(ILOpcode.LOAD_WORD, [slotOp(addr)]),
          instr(ILOpcode.STORE_WORD, [slotOp(ptr)]),
          instr(ILOpcode.RETURN),
        ],
        [ptr, addr]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should load and store both bytes
      expect(ops).toContain('LDA');
      expect(ops).toContain('LDX');
      expect(ops).toContain('STA');
      expect(ops).toContain('STX');
    });
  });

  // ==========================================================================
  // Compound Assignments
  // ==========================================================================

  describe('Compound assignments', () => {
    it('generates code for add-assign: a += b', () => {
      // IL for a += b: LOAD a → ADD b → STORE a
      const program = buildProgram(
        'addAssign',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(a)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(b)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
      expect(ops).toContain('STA');
    });

    it('generates code for sub-assign: score -= 10', () => {
      const program = buildProgram(
        'subAssign',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(score)]),
          instr(ILOpcode.SUB_IMM, [immOp(10)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(score)]),
          instr(ILOpcode.RETURN),
        ],
        [score]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('SEC');
      expect(ops).toContain('SBC');
      expect(ops).toContain('STA');
    });

    it('generates code for and-assign: a &= 0x0F', () => {
      const program = buildProgram(
        'andAssign',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(a)]),
          instr(ILOpcode.AND_IMM, [immOp(0x0f)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('AND');
      expect(ops).toContain('STA');
    });

    it('generates code for or-assign: a |= 0x80', () => {
      const program = buildProgram(
        'orAssign',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(a)]),
          instr(ILOpcode.OR_IMM, [immOp(0x80)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('ORA');
      expect(ops).toContain('STA');
    });

    it('generates code for xor-assign: a ^= b', () => {
      const program = buildProgram(
        'xorAssign',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(a)]),
          instr(ILOpcode.XOR_BYTE, [slotOp(b)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('EOR');
      expect(ops).toContain('STA');
    });

    it('generates code for shift-left-assign: a <<= 3', () => {
      const program = buildProgram(
        'shlAssign',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(a)]),
          instr(ILOpcode.SHL_BYTE, [immOp(3)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a]
      );

      const output = generate(program);

      // Three ASL instructions for shifting left by 3
      expect(countMnemonic(output, 'ASL')).toBe(3);
      expect(mnemonics(output)).toContain('STA');
    });
  });

  // ==========================================================================
  // Multi-Variable Assignments
  // ==========================================================================

  describe('Multi-variable assignments', () => {
    it('generates code for initializing multiple variables', () => {
      // a = 0, b = 1, c = 2
      const program = buildProgram(
        'multiInit',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(0)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.LOAD_IMM, [immOp(1)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(b)]),
          instr(ILOpcode.LOAD_IMM, [immOp(2)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(c)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b, c]
      );

      const output = generate(program);

      // Should have 3 LDA and 3 STA pairs
      expect(countMnemonic(output, 'LDA')).toBe(3);
      expect(countMnemonic(output, 'STA')).toBe(3);
    });

    it('generates code for chained assignment: a = b = c = 5', () => {
      // IL: LOAD_IMM 5, STORE c, STORE b, STORE a (accumulator preserved across stores)
      const program = buildProgram(
        'chainedAssign',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(5)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(c)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(b)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b, c]
      );

      const output = generate(program);

      // Only 1 LDA but 3 STA instructions (A preserved across stores)
      expect(countMnemonic(output, 'LDA')).toBe(1);
      expect(countMnemonic(output, 'STA')).toBe(3);
    });

    it('generates code for swap pattern: temp = a, a = b, b = temp', () => {
      const temp = zpSlot('temp', 0x05);

      const program = buildProgram(
        'swap',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(a)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(temp)]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(b)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(temp)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(b)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b, temp]
      );

      const output = generate(program);

      // Three load-store pairs
      expect(countMnemonic(output, 'LDA')).toBe(3);
      expect(countMnemonic(output, 'STA')).toBe(3);
    });
  });

  // ==========================================================================
  // Memory-Mapped I/O Assignments
  // ==========================================================================

  describe('Memory-mapped I/O assignments (POKE)', () => {
    it('generates code for POKE to C64 border color', () => {
      // poke($D020, 1) → border = blue
      const program = buildProgram(
        'pokeBorder',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(1)]),
          instr(ILOpcode.POKE, [addrOp(0xd020)]),
          instr(ILOpcode.RETURN),
        ],
        []
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('STA');
    });

    it('generates code for POKE with variable value', () => {
      // poke($D020, a) → border = a
      const program = buildProgram(
        'pokeVar',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(a)]),
          instr(ILOpcode.POKE, [addrOp(0xd020)]),
          instr(ILOpcode.RETURN),
        ],
        [a]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('STA');
    });

    it('generates code for PEEK from C64 hardware', () => {
      // a = peek($D012) → read raster line
      const program = buildProgram(
        'peekRaster',
        [
          instr(ILOpcode.PEEK, [addrOp(0xd012)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('STA');
    });

    it('generates code for peek-modify-poke pattern', () => {
      // Read border, mask to low nibble, write back
      // a = peek($D020); a &= 0x0F; poke($D020, a)
      const program = buildProgram(
        'peekModifyPoke',
        [
          instr(ILOpcode.PEEK, [addrOp(0xd020)]),
          instr(ILOpcode.AND_IMM, [immOp(0x0f)]),
          instr(ILOpcode.POKE, [addrOp(0xd020)]),
          instr(ILOpcode.RETURN),
        ],
        []
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Load from hardware, AND, Store back
      expect(countMnemonic(output, 'LDA')).toBeGreaterThanOrEqual(1);
      expect(ops).toContain('AND');
      expect(countMnemonic(output, 'STA')).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Global Init Assignments
  // ==========================================================================

  describe('Global init assignments', () => {
    it('generates global init section for variable initialization', () => {
      const program = buildProgram(
        'main',
        [instr(ILOpcode.RETURN)],
        [a, b],
        {
          globalInit: [
            instr(ILOpcode.LOAD_IMM, [immOp(0)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
            instr(ILOpcode.LOAD_IMM, [immOp(100)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(b)]),
          ],
        }
      );

      const output = generate(program);

      // Should have a __global_init label
      expect(hasLabel(output, '__global_init')).toBe(true);

      // Should have initialization code
      expect(countMnemonic(output, 'LDA')).toBeGreaterThanOrEqual(2);
      expect(countMnemonic(output, 'STA')).toBeGreaterThanOrEqual(2);
    });

    it('does not generate global init section when empty', () => {
      const program = buildProgram(
        'main',
        [instr(ILOpcode.RETURN)],
        [a],
        { globalInit: [] }
      );

      const output = generate(program);

      // Should NOT have __global_init label
      expect(hasLabel(output, '__global_init')).toBe(false);
    });
  });

  // ==========================================================================
  // Assignment with Computed Values
  // ==========================================================================

  describe('Assignments with computed values', () => {
    it('generates code for assignment with addition: a = b + c', () => {
      const program = buildProgram(
        'assignAdd',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(b)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(c)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b, c]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
      expect(ops).toContain('STA');
    });

    it('generates code for assignment with multiply: a = b * c', () => {
      const program = buildProgram(
        'assignMul',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(b)]),
          instr(ILOpcode.MUL_BYTE, [slotOp(c)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b, c]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('JSR');
      expect(ops).toContain('STA');
    });

    it('generates code for assignment with negation: a = -b (via SUB)', () => {
      // Negate: LOAD 0, SUB b → result is -b (two's complement)
      const program = buildProgram(
        'assignNeg',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(0)]),
          instr(ILOpcode.SUB_BYTE, [slotOp(b)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('SEC');
      expect(ops).toContain('SBC');
      expect(ops).toContain('STA');
    });
  });
});
