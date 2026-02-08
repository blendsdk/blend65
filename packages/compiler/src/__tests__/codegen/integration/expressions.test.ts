/**
 * CGT8.1: Expression Integration Tests
 *
 * Tests code generation for multi-instruction expression sequences
 * using the real CodeGenerator class with complete IL programs.
 * Verifies that arithmetic, bitwise, and comparison expressions
 * produce correct 6502 instruction sequences when combined.
 *
 * @module __tests__/codegen/integration/expressions
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../../il/enums.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';
import {
  zpSlot,
  absSlot,
  slotOp,
  immOp,
  instr,
  buildProgram,
  generate,
  mnemonics,
  allInstructions,
  countMnemonic,
  nthInstruction,
} from './_helpers.js';

// ============================================================================
// Test Data: Common slots used across expression tests
// ============================================================================

/** Zero page slot for variable 'x' at $02 */
const x = zpSlot('x', 0x02);
/** Zero page slot for variable 'y' at $03 */
const y = zpSlot('y', 0x03);
/** Zero page slot for variable 'result' at $04 */
const result = zpSlot('result', 0x04);
/** Absolute slot for variable 'counter' at $0200 */
const counter = absSlot('counter', 0x0200);
/** Absolute slot for variable 'flags' at $0201 */
const flags = absSlot('flags', 0x0201);

describe('CGT8.1: Expression Integration Tests', () => {
  // ==========================================================================
  // Arithmetic Expression Sequences
  // ==========================================================================

  describe('Arithmetic expressions', () => {
    it('generates code for add-then-store: result = x + y', () => {
      // IL: LOAD_BYTE x → ADD_BYTE y → STORE_BYTE result
      const program = buildProgram(
        'addXY',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(y)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Expect: LDA x, CLC, ADC y, STA result (no RTS since RETURN in IL)
      expect(ops).toContain('LDA');
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
      expect(ops).toContain('STA');
      expect(ops).toContain('RTS');
    });

    it('generates code for sub-then-store: result = x - y', () => {
      const program = buildProgram(
        'subXY',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.SUB_BYTE, [slotOp(y)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Expect: LDA x, SEC, SBC y, STA result, RTS
      expect(ops).toContain('LDA');
      expect(ops).toContain('SEC');
      expect(ops).toContain('SBC');
      expect(ops).toContain('STA');
    });

    it('generates code for immediate addition: result = x + 10', () => {
      const program = buildProgram(
        'addImm',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.ADD_IMM, [immOp(10)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
      expect(ops).toContain('STA');
    });

    it('generates code for chained arithmetic: result = x + y - 5', () => {
      // IL: LOAD x → ADD y → SUB_IMM 5 → STORE result
      const program = buildProgram(
        'chainedArith',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(y)]),
          instr(ILOpcode.SUB_IMM, [immOp(5)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should have both add and subtract sequences
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
      expect(ops).toContain('SEC');
      expect(ops).toContain('SBC');
    });

    it('generates multiply via runtime call: result = x * y', () => {
      const program = buildProgram(
        'mulXY',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.MUL_BYTE, [slotOp(y)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // MUL uses JSR to runtime routine
      expect(ops).toContain('LDA');
      expect(ops).toContain('JSR');
      expect(ops).toContain('STA');
    });

    it('generates increment and decrement sequences', () => {
      // IL: INC x → DEC y (in-place operations)
      const program = buildProgram(
        'incDec',
        [
          instr(ILOpcode.INC_BYTE, [slotOp(x)]),
          instr(ILOpcode.DEC_BYTE, [slotOp(y)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // INC and DEC are direct memory operations
      expect(ops).toContain('INC');
      expect(ops).toContain('DEC');
    });
  });

  // ==========================================================================
  // Bitwise Expression Sequences
  // ==========================================================================

  describe('Bitwise expressions', () => {
    it('generates code for AND masking: result = x & 0x0F', () => {
      const program = buildProgram(
        'andMask',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.AND_IMM, [immOp(0x0f)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('AND');
      expect(ops).toContain('STA');
    });

    it('generates code for OR combining: result = x | flags', () => {
      const program = buildProgram(
        'orCombine',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.OR_BYTE, [slotOp(flags)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, flags, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('ORA');
      expect(ops).toContain('STA');
    });

    it('generates code for XOR toggle: result = flags ^ 0xFF', () => {
      const program = buildProgram(
        'xorToggle',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(flags)]),
          instr(ILOpcode.XOR_IMM, [immOp(0xff)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [flags, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('EOR');
      expect(ops).toContain('STA');
    });

    it('generates code for shift left: result = x << 2', () => {
      const program = buildProgram(
        'shlTwo',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.SHL_BYTE, [immOp(2)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // SHL by 2 should produce two ASL instructions
      expect(ops).toContain('LDA');
      expect(countMnemonic(output, 'ASL')).toBe(2);
      expect(ops).toContain('STA');
    });

    it('generates code for NOT complement: result = ~x', () => {
      const program = buildProgram(
        'notX',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.NOT_BYTE),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // NOT is implemented as EOR #$FF
      expect(ops).toContain('LDA');
      expect(ops).toContain('EOR');
      expect(ops).toContain('STA');
    });

    it('generates combined bitwise: result = (x & 0xF0) | (y & 0x0F)', () => {
      // This would be a multi-step operation in IL with a temp
      // For integration test: load x, AND 0xF0, store temp, load y, AND 0x0F, OR temp, store result
      const temp = zpSlot('temp', 0x05);
      const program = buildProgram(
        'combinedBitwise',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.AND_IMM, [immOp(0xf0)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(temp)]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(y)]),
          instr(ILOpcode.AND_IMM, [immOp(0x0f)]),
          instr(ILOpcode.OR_BYTE, [slotOp(temp)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result, temp]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should see two AND instructions and one ORA
      expect(countMnemonic(output, 'AND')).toBe(2);
      expect(countMnemonic(output, 'ORA')).toBe(1);
      expect(countMnemonic(output, 'STA')).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Mixed Arithmetic + Bitwise
  // ==========================================================================

  describe('Mixed arithmetic and bitwise expressions', () => {
    it('generates code for add-then-mask: result = (x + y) & 0xFF', () => {
      const program = buildProgram(
        'addThenMask',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(y)]),
          instr(ILOpcode.AND_IMM, [immOp(0xff)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // CLC, ADC followed by AND
      expect(ops).toContain('ADC');
      expect(ops).toContain('AND');
      expect(ops).toContain('STA');
    });

    it('generates code for shift-then-add: result = (x << 1) + y', () => {
      const program = buildProgram(
        'shiftThenAdd',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.SHL_BYTE, [immOp(1)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(y)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('ASL');
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
      expect(ops).toContain('STA');
    });
  });

  // ==========================================================================
  // Immediate-Only Expressions
  // ==========================================================================

  describe('Immediate value expressions', () => {
    it('generates code for loading and storing immediate: result = 42', () => {
      const program = buildProgram(
        'loadImm',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(42)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [result]
      );

      const output = generate(program);
      const instrs = allInstructions(output);

      // First instruction should be LDA #42
      const lda = instrs.find(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'LDA'
      );
      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(lda.instruction.operand).toBe(42);
      }
    });

    it('generates immediate arithmetic: result = 10 + 20', () => {
      const program = buildProgram(
        'immArith',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(10)]),
          instr(ILOpcode.ADD_IMM, [immOp(20)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('LDA');
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
      expect(ops).toContain('STA');
    });
  });

  // ==========================================================================
  // ZP vs Absolute Addressing in Expressions
  // ==========================================================================

  describe('Addressing mode selection in expressions', () => {
    it('uses ZP addressing for ZP operands and ABS for absolute operands', () => {
      // x is ZP ($02), counter is ABS ($0200)
      const program = buildProgram(
        'mixedAddressing',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(counter)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, counter, result]
      );

      const output = generate(program);
      const instrs = allInstructions(output);

      // Find the first LDA (loading x from ZP)
      const ldaInstr = instrs.find(
        (e) =>
          isInstructionElement(e) &&
          e.instruction.mnemonic === 'LDA' &&
          e.instruction.operand === 0x02
      );
      expect(ldaInstr).toBeDefined();
      if (ldaInstr && isInstructionElement(ldaInstr)) {
        expect(ldaInstr.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }

      // Find the ADC (adding counter from absolute)
      const adcInstr = instrs.find(
        (e) =>
          isInstructionElement(e) &&
          e.instruction.mnemonic === 'ADC' &&
          e.instruction.operand === 0x0200
      );
      expect(adcInstr).toBeDefined();
      if (adcInstr && isInstructionElement(adcInstr)) {
        expect(adcInstr.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });

  // ==========================================================================
  // Accumulator Tracking Across Expressions
  // ==========================================================================

  describe('Accumulator tracking optimization', () => {
    it('preserves accumulator value across store operations', () => {
      // LOAD x, STORE result, LOAD x (may or may not be eliminated), ADD y
      // The code generator may or may not eliminate the redundant load
      // depending on accumulator tracking. Either way, the output must be correct.
      const program = buildProgram(
        'redundantLoad',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(y)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result]
      );

      const output = generate(program);

      // Must have at least 1 LDA (could be 1 if optimized, or 2 if not)
      expect(countMnemonic(output, 'LDA')).toBeGreaterThanOrEqual(1);
      expect(countMnemonic(output, 'LDA')).toBeLessThanOrEqual(2);
      // Must still produce correct ADC and STA
      expect(mnemonics(output)).toContain('ADC');
      expect(countMnemonic(output, 'STA')).toBe(2);
    });

    it('does not eliminate load after arithmetic invalidates accumulator', () => {
      // LOAD x, ADD y (invalidates A tracking), STORE result, LOAD x (needed!)
      const program = buildProgram(
        'loadAfterArith',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(y)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]), // Needed - A was modified by ADD
          instr(ILOpcode.STORE_BYTE, [slotOp(counter)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result, counter]
      );

      const output = generate(program);

      // Both LDA instructions should be present
      expect(countMnemonic(output, 'LDA')).toBe(2);
    });
  });

  // ==========================================================================
  // Complex Multi-Step Expressions
  // ==========================================================================

  describe('Complex multi-step expressions', () => {
    it('generates code for a = b + c - d + e pattern', () => {
      const b = zpSlot('b', 0x06);
      const c = zpSlot('c', 0x07);
      const d = zpSlot('d', 0x08);
      const e = zpSlot('e', 0x09);
      const a = zpSlot('a', 0x0a);

      const program = buildProgram(
        'fourTermExpr',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(b)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(c)]),
          instr(ILOpcode.SUB_BYTE, [slotOp(d)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(e)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b, c, d, e]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should have one LDA, two ADC sequences, one SBC sequence
      expect(countMnemonic(output, 'LDA')).toBe(1);
      expect(countMnemonic(output, 'ADC')).toBe(2);
      expect(countMnemonic(output, 'SBC')).toBe(1);
      expect(countMnemonic(output, 'STA')).toBe(1);
    });

    it('generates code for nested bitwise with shift: result = (x << 4) | (y >> 4)', () => {
      const temp = zpSlot('temp', 0x05);

      const program = buildProgram(
        'nestedBitShift',
        [
          // First part: x << 4
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.SHL_BYTE, [immOp(4)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(temp)]),
          // Second part: y >> 4
          instr(ILOpcode.LOAD_BYTE, [slotOp(y)]),
          instr(ILOpcode.SHR_BYTE, [immOp(4)]),
          // Combine: temp | (y >> 4)
          instr(ILOpcode.OR_BYTE, [slotOp(temp)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result, temp]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should have 4 ASL (shift left by 4) and 4 LSR (shift right by 4)
      expect(countMnemonic(output, 'ASL')).toBe(4);
      expect(countMnemonic(output, 'LSR')).toBe(4);
      expect(ops).toContain('ORA');
    });
  });
});
