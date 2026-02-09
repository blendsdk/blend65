/**
 * CGT8.3: Control Structure Integration Tests
 *
 * Tests code generation for control flow patterns using the real
 * CodeGenerator class with complete IL programs. Covers:
 * - If/else branching patterns
 * - While loop patterns
 * - For loop (counted) patterns
 * - Nested control structures
 * - Comparison-driven branching
 *
 * @module __tests__/codegen/integration/control-structures
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../../il/enums.js';
import { isInstructionElement } from '../../../codegen/asm-il/types.js';
import {
  zpSlot,
  absSlot,
  slotOp,
  immOp,
  labelOp,
  instr,
  buildProgram,
  generate,
  mnemonics,
  countMnemonic,
  hasLabel,
} from './_helpers.js';

// ============================================================================
// Test Data: Common slots used across control structure tests
// ============================================================================

const x = zpSlot('x', 0x02);
const y = zpSlot('y', 0x03);
const result = zpSlot('result', 0x04);
const counter = zpSlot('counter', 0x05);
const limit = zpSlot('limit', 0x06);
const flags = absSlot('flags', 0x0200);

describe('CGT8.3: Control Structure Integration Tests', () => {
  // ==========================================================================
  // If/Else Branching
  // ==========================================================================

  describe('If/else branching patterns', () => {
    it('generates code for simple if: if (x == 0) { result = 1 }', () => {
      // IL: LOAD x → CMP #0 → JUMP_NE skip → LOAD #1 → STORE result → LABEL skip
      const program = buildProgram(
        'simpleIf',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_IMM, [immOp(0)]),
          instr(ILOpcode.JUMP_NE, [labelOp('skip_then')]),
          // Then branch
          instr(ILOpcode.LOAD_IMM, [immOp(1)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          // Skip label
          instr(ILOpcode.LABEL, [labelOp('skip_then')]),
          instr(ILOpcode.RETURN),
        ],
        [x, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should contain: CMP, BNE (conditional branch), LDA, STA
      expect(ops).toContain('CMP');
      expect(ops).toContain('BNE');
      expect(hasLabel(output, 'skip_then')).toBe(true);
    });

    it('generates code for if-else: if (x < y) { result = x } else { result = y }', () => {
      // IL: LOAD x → CMP y → JUMP_GE else → LOAD x → STORE result → JUMP end → LABEL else → LOAD y → STORE result → LABEL end
      const program = buildProgram(
        'ifElse',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_BYTE, [slotOp(y)]),
          instr(ILOpcode.JUMP_GE, [labelOp('else_branch')]),
          // Then branch: result = x
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.JUMP, [labelOp('end_if')]),
          // Else branch: result = y
          instr(ILOpcode.LABEL, [labelOp('else_branch')]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(y)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          // End
          instr(ILOpcode.LABEL, [labelOp('end_if')]),
          instr(ILOpcode.RETURN),
        ],
        [x, y, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should have conditional branch, unconditional jump, and labels
      expect(ops).toContain('CMP');
      expect(ops).toContain('BCS'); // JUMP_GE → BCS
      expect(ops).toContain('JMP'); // unconditional jump to end
      expect(hasLabel(output, 'else_branch')).toBe(true);
      expect(hasLabel(output, 'end_if')).toBe(true);
    });

    it('generates code for equality check: if (x == 5) { ... }', () => {
      const program = buildProgram(
        'equalityCheck',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_IMM, [immOp(5)]),
          instr(ILOpcode.JUMP_NE, [labelOp('not_five')]),
          // Body: result = 1
          instr(ILOpcode.LOAD_IMM, [immOp(1)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.LABEL, [labelOp('not_five')]),
          instr(ILOpcode.RETURN),
        ],
        [x, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('CMP');
      expect(ops).toContain('BNE');
    });

    it('generates code for inequality check: if (x != 0) { ... }', () => {
      const program = buildProgram(
        'notZeroCheck',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_IMM, [immOp(0)]),
          instr(ILOpcode.JUMP_EQ, [labelOp('is_zero')]),
          // Body: result = x
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.LABEL, [labelOp('is_zero')]),
          instr(ILOpcode.RETURN),
        ],
        [x, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(ops).toContain('CMP');
      expect(ops).toContain('BEQ');
    });
  });

  // ==========================================================================
  // While Loop Patterns
  // ==========================================================================

  describe('While loop patterns', () => {
    it('generates code for while (counter > 0) { counter-- }', () => {
      // IL: LABEL header → LOAD counter → CMP #0 → JUMP_EQ exit → DEC counter → JUMP header → LABEL exit
      const program = buildProgram(
        'whileLoop',
        [
          instr(ILOpcode.LABEL, [labelOp('while_header')]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(counter)]),
          instr(ILOpcode.CMP_IMM, [immOp(0)]),
          instr(ILOpcode.JUMP_EQ, [labelOp('while_exit')]),
          // Body: counter--
          instr(ILOpcode.DEC_BYTE, [slotOp(counter)]),
          // Back to header
          instr(ILOpcode.JUMP, [labelOp('while_header')]),
          instr(ILOpcode.LABEL, [labelOp('while_exit')]),
          instr(ILOpcode.RETURN),
        ],
        [counter]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should have loop structure: labels, compare, conditional branch, DEC, unconditional jump
      expect(hasLabel(output, 'while_header')).toBe(true);
      expect(hasLabel(output, 'while_exit')).toBe(true);
      expect(ops).toContain('CMP');
      expect(ops).toContain('BEQ');
      expect(ops).toContain('DEC');
      expect(ops).toContain('JMP');
    });

    it('generates code for while with accumulation: while (x > 0) { result += x; x-- }', () => {
      const program = buildProgram(
        'accumWhile',
        [
          instr(ILOpcode.LABEL, [labelOp('w_header')]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_IMM, [immOp(0)]),
          instr(ILOpcode.JUMP_EQ, [labelOp('w_exit')]),
          // Body: result += x
          instr(ILOpcode.LOAD_BYTE, [slotOp(result)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(x)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          // x--
          instr(ILOpcode.DEC_BYTE, [slotOp(x)]),
          instr(ILOpcode.JUMP, [labelOp('w_header')]),
          instr(ILOpcode.LABEL, [labelOp('w_exit')]),
          instr(ILOpcode.RETURN),
        ],
        [x, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should contain addition, decrement, and loop control
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
      expect(ops).toContain('DEC');
      expect(ops).toContain('JMP');
      expect(ops).toContain('BEQ');
    });
  });

  // ==========================================================================
  // For Loop (Counted) Patterns
  // ==========================================================================

  describe('For loop (counted) patterns', () => {
    it('generates code for: for i = 0 to 10 { result += i }', () => {
      // IL for counted for loop:
      // LOAD_IMM 0 → STORE counter
      // LABEL header → LOAD counter → CMP limit → JUMP_GE exit
      // Body: LOAD result → ADD counter → STORE result
      // INC counter → JUMP header
      // LABEL exit
      const program = buildProgram(
        'forLoop',
        [
          // Initialize i = 0
          instr(ILOpcode.LOAD_IMM, [immOp(0)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(counter)]),
          // Loop header
          instr(ILOpcode.LABEL, [labelOp('for_header')]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(counter)]),
          instr(ILOpcode.CMP_IMM, [immOp(10)]),
          instr(ILOpcode.JUMP_GE, [labelOp('for_exit')]),
          // Body: result += counter
          instr(ILOpcode.LOAD_BYTE, [slotOp(result)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(counter)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          // Increment
          instr(ILOpcode.INC_BYTE, [slotOp(counter)]),
          instr(ILOpcode.JUMP, [labelOp('for_header')]),
          // Exit
          instr(ILOpcode.LABEL, [labelOp('for_exit')]),
          instr(ILOpcode.RETURN),
        ],
        [counter, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should have initialization, comparison, body, increment, loop back
      expect(hasLabel(output, 'for_header')).toBe(true);
      expect(hasLabel(output, 'for_exit')).toBe(true);
      expect(ops).toContain('CMP');
      expect(ops).toContain('BCS'); // JUMP_GE → BCS
      expect(ops).toContain('INC');
      expect(ops).toContain('JMP');
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
    });

    it('generates code for countdown: for i = 10 downto 0 { ... }', () => {
      // Countdown loop: start at 10, decrement, exit when < 0
      const program = buildProgram(
        'countdown',
        [
          // Initialize counter = 10
          instr(ILOpcode.LOAD_IMM, [immOp(10)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(counter)]),
          // Loop header
          instr(ILOpcode.LABEL, [labelOp('cd_header')]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(counter)]),
          instr(ILOpcode.CMP_IMM, [immOp(0)]),
          instr(ILOpcode.JUMP_LT, [labelOp('cd_exit')]),
          // Body: result = counter
          instr(ILOpcode.LOAD_BYTE, [slotOp(counter)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          // Decrement
          instr(ILOpcode.DEC_BYTE, [slotOp(counter)]),
          instr(ILOpcode.JUMP, [labelOp('cd_header')]),
          // Exit
          instr(ILOpcode.LABEL, [labelOp('cd_exit')]),
          instr(ILOpcode.RETURN),
        ],
        [counter, result]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(hasLabel(output, 'cd_header')).toBe(true);
      expect(hasLabel(output, 'cd_exit')).toBe(true);
      expect(ops).toContain('DEC');
      expect(ops).toContain('BCC'); // JUMP_LT → BCC
      expect(ops).toContain('JMP');
    });
  });

  // ==========================================================================
  // Nested Control Structures
  // ==========================================================================

  describe('Nested control structures', () => {
    it('generates code for if inside while loop', () => {
      // while (counter > 0) { if (counter == 5) { result = 1 }; counter-- }
      const program = buildProgram(
        'ifInWhile',
        [
          instr(ILOpcode.LABEL, [labelOp('loop_top')]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(counter)]),
          instr(ILOpcode.CMP_IMM, [immOp(0)]),
          instr(ILOpcode.JUMP_EQ, [labelOp('loop_end')]),
          // Inner if: counter == 5?
          instr(ILOpcode.LOAD_BYTE, [slotOp(counter)]),
          instr(ILOpcode.CMP_IMM, [immOp(5)]),
          instr(ILOpcode.JUMP_NE, [labelOp('skip_if')]),
          // Then: result = 1
          instr(ILOpcode.LOAD_IMM, [immOp(1)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.LABEL, [labelOp('skip_if')]),
          // counter--
          instr(ILOpcode.DEC_BYTE, [slotOp(counter)]),
          instr(ILOpcode.JUMP, [labelOp('loop_top')]),
          instr(ILOpcode.LABEL, [labelOp('loop_end')]),
          instr(ILOpcode.RETURN),
        ],
        [counter, result]
      );

      const output = generate(program);

      // Should have all labels
      expect(hasLabel(output, 'loop_top')).toBe(true);
      expect(hasLabel(output, 'loop_end')).toBe(true);
      expect(hasLabel(output, 'skip_if')).toBe(true);

      // Two CMP instructions (outer loop check + inner if check)
      expect(countMnemonic(output, 'CMP')).toBe(2);

      // Two conditional branches
      expect(countMnemonic(output, 'BEQ')).toBe(1); // while exit
      expect(countMnemonic(output, 'BNE')).toBe(1); // if skip
    });

    it('generates code for nested loops', () => {
      // outer: for i = 0 to 3 { inner: for j = 0 to 3 { result++ } }
      const i = zpSlot('i', 0x07);
      const j = zpSlot('j', 0x08);

      const program = buildProgram(
        'nestedLoops',
        [
          // Init outer: i = 0
          instr(ILOpcode.LOAD_IMM, [immOp(0)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(i)]),
          // Outer header
          instr(ILOpcode.LABEL, [labelOp('outer_header')]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(i)]),
          instr(ILOpcode.CMP_IMM, [immOp(3)]),
          instr(ILOpcode.JUMP_GE, [labelOp('outer_exit')]),
          // Init inner: j = 0
          instr(ILOpcode.LOAD_IMM, [immOp(0)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(j)]),
          // Inner header
          instr(ILOpcode.LABEL, [labelOp('inner_header')]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(j)]),
          instr(ILOpcode.CMP_IMM, [immOp(3)]),
          instr(ILOpcode.JUMP_GE, [labelOp('inner_exit')]),
          // Body: result++
          instr(ILOpcode.INC_BYTE, [slotOp(result)]),
          // j++
          instr(ILOpcode.INC_BYTE, [slotOp(j)]),
          instr(ILOpcode.JUMP, [labelOp('inner_header')]),
          instr(ILOpcode.LABEL, [labelOp('inner_exit')]),
          // i++
          instr(ILOpcode.INC_BYTE, [slotOp(i)]),
          instr(ILOpcode.JUMP, [labelOp('outer_header')]),
          instr(ILOpcode.LABEL, [labelOp('outer_exit')]),
          instr(ILOpcode.RETURN),
        ],
        [i, j, result]
      );

      const output = generate(program);

      // Should have all 4 labels
      expect(hasLabel(output, 'outer_header')).toBe(true);
      expect(hasLabel(output, 'outer_exit')).toBe(true);
      expect(hasLabel(output, 'inner_header')).toBe(true);
      expect(hasLabel(output, 'inner_exit')).toBe(true);

      // Two CMPs, two JMPs (loop back-jumps only — no startup JMP since
      // DESIGN-003 emits main() first), two BCS (exit branches)
      expect(countMnemonic(output, 'CMP')).toBe(2);
      expect(countMnemonic(output, 'JMP')).toBe(2);
      expect(countMnemonic(output, 'BCS')).toBe(2); // JUMP_GE → BCS

      // Three INC instructions (result++, j++, i++)
      expect(countMnemonic(output, 'INC')).toBe(3);
    });
  });

  // ==========================================================================
  // All Comparison Branch Types
  // ==========================================================================

  describe('Comparison branch types', () => {
    it('generates BEQ for JUMP_EQ', () => {
      const program = buildProgram(
        'beq',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_IMM, [immOp(0)]),
          instr(ILOpcode.JUMP_EQ, [labelOp('target')]),
          instr(ILOpcode.LABEL, [labelOp('target')]),
          instr(ILOpcode.RETURN),
        ],
        [x]
      );

      const output = generate(program);
      expect(mnemonics(output)).toContain('BEQ');
    });

    it('generates BNE for JUMP_NE', () => {
      const program = buildProgram(
        'bne',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_IMM, [immOp(0)]),
          instr(ILOpcode.JUMP_NE, [labelOp('target')]),
          instr(ILOpcode.LABEL, [labelOp('target')]),
          instr(ILOpcode.RETURN),
        ],
        [x]
      );

      const output = generate(program);
      expect(mnemonics(output)).toContain('BNE');
    });

    it('generates BCC for JUMP_LT (unsigned less than)', () => {
      const program = buildProgram(
        'bcc',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_IMM, [immOp(10)]),
          instr(ILOpcode.JUMP_LT, [labelOp('target')]),
          instr(ILOpcode.LABEL, [labelOp('target')]),
          instr(ILOpcode.RETURN),
        ],
        [x]
      );

      const output = generate(program);
      expect(mnemonics(output)).toContain('BCC');
    });

    it('generates BCS for JUMP_GE (unsigned greater or equal)', () => {
      const program = buildProgram(
        'bcs',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_IMM, [immOp(10)]),
          instr(ILOpcode.JUMP_GE, [labelOp('target')]),
          instr(ILOpcode.LABEL, [labelOp('target')]),
          instr(ILOpcode.RETURN),
        ],
        [x]
      );

      const output = generate(program);
      expect(mnemonics(output)).toContain('BCS');
    });

    it('generates combined branch for JUMP_LE (unsigned less or equal)', () => {
      // JUMP_LE = BCC || BEQ → generates two branch instructions
      const program = buildProgram(
        'jumpLE',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_IMM, [immOp(10)]),
          instr(ILOpcode.JUMP_LE, [labelOp('target')]),
          instr(ILOpcode.LABEL, [labelOp('target')]),
          instr(ILOpcode.RETURN),
        ],
        [x]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // JUMP_LE is typically BCC + BEQ
      expect(ops).toContain('BCC');
      expect(ops).toContain('BEQ');
    });

    it('generates combined branch for JUMP_GT (unsigned greater than)', () => {
      // JUMP_GT = skip if equal, then BCS
      const program = buildProgram(
        'jumpGT',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(x)]),
          instr(ILOpcode.CMP_IMM, [immOp(10)]),
          instr(ILOpcode.JUMP_GT, [labelOp('target')]),
          instr(ILOpcode.LABEL, [labelOp('target')]),
          instr(ILOpcode.RETURN),
        ],
        [x]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // JUMP_GT uses BEQ skip + BCS target pattern
      expect(ops).toContain('BEQ');
      expect(ops).toContain('BCS');
    });
  });

  // ==========================================================================
  // Program Structure
  // ==========================================================================

  describe('Program structure', () => {
    it('generates function label at start of function', () => {
      const program = buildProgram(
        'myFunction',
        [instr(ILOpcode.RETURN)],
        []
      );

      const output = generate(program);
      expect(hasLabel(output, 'myFunction')).toBe(true);
    });

    it('generates implicit RTS when function has no RETURN instruction', () => {
      const program = buildProgram(
        'noReturn',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(42)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(x)]),
          // No RETURN instruction
        ],
        [x]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      // Should still have an RTS (implicit return)
      expect(ops).toContain('RTS');
    });

    it('generates header comments with module name', () => {
      const program = buildProgram(
        'main',
        [instr(ILOpcode.RETURN)],
        [],
        { moduleName: 'game' }
      );

      const output = generate(program);

      // Module name should be in the output
      expect(output.moduleName).toBe('game');
    });
  });
});
