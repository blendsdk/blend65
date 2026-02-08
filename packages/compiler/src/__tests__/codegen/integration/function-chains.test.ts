/**
 * CGT8.4: Function Chain Integration Tests
 *
 * Tests code generation for multi-function programs using the real
 * CodeGenerator class. Covers:
 * - Single function programs
 * - Multi-function programs with CALL/RETURN
 * - Function calling other functions
 * - Functions with parameters (via slots)
 * - Functions with intrinsic calls
 * - Complete program structure (header, code, init sections)
 *
 * @module __tests__/codegen/integration/function-chains
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../../il/enums.js';
import { isInstructionElement } from '../../../codegen/asm-il/types.js';
import {
  zpSlot,
  absSlot,
  paramSlot,
  slotOp,
  immOp,
  labelOp,
  funcOp,
  addrOp,
  instr,
  buildProgram,
  buildMultiFuncProgram,
  generate,
  mnemonics,
  countMnemonic,
  hasLabel,
  hasComment,
  allInstructions,
  getSections,
} from './_helpers.js';

// ============================================================================
// Test Data
// ============================================================================

const x = zpSlot('x', 0x02);
const y = zpSlot('y', 0x03);
const result = zpSlot('result', 0x04);
const temp = zpSlot('temp', 0x05);

describe('CGT8.4: Function Chain Integration Tests', () => {
  // ==========================================================================
  // Single Function Programs
  // ==========================================================================

  describe('Single function programs', () => {
    it('generates a minimal function with just RETURN', () => {
      const program = buildProgram('main', [instr(ILOpcode.RETURN)], []);

      const output = generate(program);

      // Should have the function label and RTS
      expect(hasLabel(output, 'main')).toBe(true);
      expect(mnemonics(output)).toContain('RTS');
    });

    it('generates a function that returns a value', () => {
      // function getFortyTwo(): byte { return 42 }
      const program = buildProgram(
        'getFortyTwo',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(42)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
          instr(ILOpcode.RETURN),
        ],
        [result]
      );

      const output = generate(program);

      expect(hasLabel(output, 'getFortyTwo')).toBe(true);
      expect(mnemonics(output)).toContain('LDA');
      expect(mnemonics(output)).toContain('STA');
      expect(mnemonics(output)).toContain('RTS');
    });

    it('generates a function with local variable computations', () => {
      // function compute(): byte { let a = 10; let b = 20; return a + b; }
      const a = zpSlot('a', 0x02);
      const b = zpSlot('b', 0x03);
      const ret = zpSlot('__return', 0x04);

      const program = buildProgram(
        'compute',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(10)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(a)]),
          instr(ILOpcode.LOAD_IMM, [immOp(20)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(b)]),
          instr(ILOpcode.LOAD_BYTE, [slotOp(a)]),
          instr(ILOpcode.ADD_BYTE, [slotOp(b)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(ret)]),
          instr(ILOpcode.RETURN),
        ],
        [a, b, ret]
      );

      const output = generate(program);
      const ops = mnemonics(output);

      expect(hasLabel(output, 'compute')).toBe(true);
      // Two immediate loads (10, 20) plus one slot load (a)
      expect(countMnemonic(output, 'LDA')).toBe(3);
      // Two stores for init + one for result
      expect(countMnemonic(output, 'STA')).toBe(3);
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
    });
  });

  // ==========================================================================
  // Multi-Function Programs
  // ==========================================================================

  describe('Multi-function programs', () => {
    it('generates multiple functions with separate labels', () => {
      const program = buildMultiFuncProgram([
        {
          name: 'funcA',
          instructions: [
            instr(ILOpcode.LOAD_IMM, [immOp(1)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(x)]),
            instr(ILOpcode.RETURN),
          ],
          slots: [x],
        },
        {
          name: 'funcB',
          instructions: [
            instr(ILOpcode.LOAD_IMM, [immOp(2)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(y)]),
            instr(ILOpcode.RETURN),
          ],
          slots: [y],
        },
      ]);

      const output = generate(program);

      // Both function labels should exist
      expect(hasLabel(output, 'funcA')).toBe(true);
      expect(hasLabel(output, 'funcB')).toBe(true);

      // Each function should have its own RTS, plus startup RTS
      expect(countMnemonic(output, 'RTS')).toBe(3);
    });

    it('generates function that calls another function', () => {
      // main calls helper
      const program = buildMultiFuncProgram([
        {
          name: 'main',
          instructions: [
            instr(ILOpcode.CALL, [funcOp('helper')]),
            instr(ILOpcode.RETURN),
          ],
          slots: [],
        },
        {
          name: 'helper',
          instructions: [
            instr(ILOpcode.LOAD_IMM, [immOp(42)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
            instr(ILOpcode.RETURN),
          ],
          slots: [result],
        },
      ]);

      const output = generate(program);
      const ops = mnemonics(output);

      // main should have JSR to helper
      expect(ops).toContain('JSR');
      expect(hasLabel(output, 'main')).toBe(true);
      expect(hasLabel(output, 'helper')).toBe(true);

      // Check that a JSR instruction references 'helper'
      const instrs = allInstructions(output);
      const jsrToHelper = instrs.find(
        (e) =>
          isInstructionElement(e) &&
          e.instruction.mnemonic === 'JSR' &&
          e.instruction.labelOperand === 'helper'
      );
      expect(jsrToHelper).toBeDefined();
    });

    it('generates chain of function calls: main → funcA → funcB', () => {
      const program = buildMultiFuncProgram([
        {
          name: 'main',
          instructions: [
            instr(ILOpcode.CALL, [funcOp('funcA')]),
            instr(ILOpcode.RETURN),
          ],
          slots: [],
        },
        {
          name: 'funcA',
          instructions: [
            instr(ILOpcode.LOAD_IMM, [immOp(10)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(x)]),
            instr(ILOpcode.CALL, [funcOp('funcB')]),
            instr(ILOpcode.RETURN),
          ],
          slots: [x],
        },
        {
          name: 'funcB',
          instructions: [
            instr(ILOpcode.LOAD_IMM, [immOp(20)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(y)]),
            instr(ILOpcode.RETURN),
          ],
          slots: [y],
        },
      ]);

      const output = generate(program);

      // All three functions
      expect(hasLabel(output, 'main')).toBe(true);
      expect(hasLabel(output, 'funcA')).toBe(true);
      expect(hasLabel(output, 'funcB')).toBe(true);

      // Three JSR calls: startup→main, main→funcA, funcA→funcB
      expect(countMnemonic(output, 'JSR')).toBe(3);

      // Four RTS: startup + one per function
      expect(countMnemonic(output, 'RTS')).toBe(4);
    });

    it('generates function that calls multiple functions', () => {
      const program = buildMultiFuncProgram([
        {
          name: 'main',
          instructions: [
            instr(ILOpcode.CALL, [funcOp('initGame')]),
            instr(ILOpcode.CALL, [funcOp('runGame')]),
            instr(ILOpcode.CALL, [funcOp('endGame')]),
            instr(ILOpcode.RETURN),
          ],
          slots: [],
        },
        {
          name: 'initGame',
          instructions: [instr(ILOpcode.RETURN)],
          slots: [],
        },
        {
          name: 'runGame',
          instructions: [instr(ILOpcode.RETURN)],
          slots: [],
        },
        {
          name: 'endGame',
          instructions: [instr(ILOpcode.RETURN)],
          slots: [],
        },
      ]);

      const output = generate(program);

      // main calls three functions + startup JSR
      expect(countMnemonic(output, 'JSR')).toBe(4);

      // Four functions + startup = five RTS
      expect(countMnemonic(output, 'RTS')).toBe(5);

      // All labels present
      expect(hasLabel(output, 'main')).toBe(true);
      expect(hasLabel(output, 'initGame')).toBe(true);
      expect(hasLabel(output, 'runGame')).toBe(true);
      expect(hasLabel(output, 'endGame')).toBe(true);
    });
  });

  // ==========================================================================
  // Functions with Parameter Passing (via Slots)
  // ==========================================================================

  describe('Functions with parameter passing via slots', () => {
    it('generates code for setting up parameter slots before call', () => {
      // Caller stores args to parameter slots, then calls function
      const argX = zpSlot('argX', 0x10);
      const argY = zpSlot('argY', 0x11);

      const program = buildMultiFuncProgram([
        {
          name: 'main',
          instructions: [
            // Set up parameters
            instr(ILOpcode.LOAD_IMM, [immOp(10)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(argX)]),
            instr(ILOpcode.LOAD_IMM, [immOp(20)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(argY)]),
            // Call function
            instr(ILOpcode.CALL, [funcOp('add')]),
            instr(ILOpcode.RETURN),
          ],
          slots: [argX, argY],
        },
        {
          name: 'add',
          instructions: [
            instr(ILOpcode.LOAD_BYTE, [slotOp(argX)]),
            instr(ILOpcode.ADD_BYTE, [slotOp(argY)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(result)]),
            instr(ILOpcode.RETURN),
          ],
          slots: [argX, argY, result],
        },
      ]);

      const output = generate(program);
      const ops = mnemonics(output);

      // Should see parameter setup: LDA #10, STA argX, LDA #20, STA argY
      expect(ops).toContain('JSR');
      expect(ops).toContain('CLC');
      expect(ops).toContain('ADC');
    });

    it('generates code for reading result slot after function call', () => {
      const retSlot = zpSlot('__return', 0x10);

      const program = buildMultiFuncProgram([
        {
          name: 'main',
          instructions: [
            instr(ILOpcode.CALL, [funcOp('getValue')]),
            // Read the return value
            instr(ILOpcode.LOAD_BYTE, [slotOp(retSlot)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(x)]),
            instr(ILOpcode.RETURN),
          ],
          slots: [retSlot, x],
        },
        {
          name: 'getValue',
          instructions: [
            instr(ILOpcode.LOAD_IMM, [immOp(42)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(retSlot)]),
            instr(ILOpcode.RETURN),
          ],
          slots: [retSlot],
        },
      ]);

      const output = generate(program);

      expect(hasLabel(output, 'main')).toBe(true);
      expect(hasLabel(output, 'getValue')).toBe(true);
      expect(mnemonics(output)).toContain('JSR');
    });
  });

  // ==========================================================================
  // Functions with Intrinsics
  // ==========================================================================

  describe('Functions with intrinsic calls', () => {
    it('generates code for function with PEEK and POKE (hardware access)', () => {
      // function setBorderColor(color: byte) { poke($D020, color) }
      const color = zpSlot('color', 0x10);

      const program = buildProgram(
        'setBorderColor',
        [
          instr(ILOpcode.LOAD_BYTE, [slotOp(color)]),
          instr(ILOpcode.POKE, [addrOp(0xd020)]),
          instr(ILOpcode.RETURN),
        ],
        [color]
      );

      const output = generate(program);

      expect(hasLabel(output, 'setBorderColor')).toBe(true);
      expect(mnemonics(output)).toContain('LDA');
      expect(mnemonics(output)).toContain('STA');
      expect(mnemonics(output)).toContain('RTS');
    });

    it('generates code for function with HI/LO byte extraction', () => {
      // function getHighByte(): byte { let w: word = 0x1234; return hi(w); }
      const w = absSlot('w_lo', 0x0200);
      const ret = zpSlot('__return', 0x10);

      const program = buildProgram(
        'getHighByte',
        [
          instr(ILOpcode.LOAD_IMM_WORD, [immOp(0x1234)]),
          instr(ILOpcode.HI),
          instr(ILOpcode.STORE_BYTE, [slotOp(ret)]),
          instr(ILOpcode.RETURN),
        ],
        [ret]
      );

      const output = generate(program);

      expect(hasLabel(output, 'getHighByte')).toBe(true);
      // HI extracts X register via TXA
      expect(mnemonics(output)).toContain('TXA');
    });

    it('generates code for multi-function program with intrinsics', () => {
      const program = buildMultiFuncProgram([
        {
          name: 'main',
          instructions: [
            instr(ILOpcode.CALL, [funcOp('initScreen')]),
            instr(ILOpcode.RETURN),
          ],
          slots: [],
        },
        {
          name: 'initScreen',
          instructions: [
            // Set border color to black (0)
            instr(ILOpcode.LOAD_IMM, [immOp(0)]),
            instr(ILOpcode.POKE, [addrOp(0xd020)]),
            // Set background color to black (0)
            instr(ILOpcode.LOAD_IMM, [immOp(0)]),
            instr(ILOpcode.POKE, [addrOp(0xd021)]),
            instr(ILOpcode.RETURN),
          ],
          slots: [],
        },
      ]);

      const output = generate(program);

      expect(hasLabel(output, 'main')).toBe(true);
      expect(hasLabel(output, 'initScreen')).toBe(true);
      expect(mnemonics(output)).toContain('JSR');

      // Two POKE operations = two STA instructions to hardware
      const instrs = allInstructions(output);
      const staInstrs = instrs.filter(
        (e) =>
          isInstructionElement(e) &&
          e.instruction.mnemonic === 'STA' &&
          e.instruction.operand !== undefined &&
          e.instruction.operand >= 0xd000
      );
      expect(staInstrs.length).toBe(2);
    });
  });

  // ==========================================================================
  // Complete Program Structure
  // ==========================================================================

  describe('Complete program structure', () => {
    it('generates program with header, code, and init sections', () => {
      const program = buildProgram(
        'main',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(0)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(x)]),
          instr(ILOpcode.RETURN),
        ],
        [x],
        {
          moduleName: 'testModule',
          globalInit: [
            instr(ILOpcode.LOAD_IMM, [immOp(100)]),
            instr(ILOpcode.STORE_BYTE, [slotOp(y)]),
          ],
        }
      );

      const output = generate(program);
      const sections = getSections(output);

      // Should have at least header, code, and init sections
      const sectionNames = sections.map((s) => s.name);
      expect(sectionNames).toContain('header');
      expect(sectionNames).toContain('code');
      expect(sectionNames).toContain('init');

      // Module name should be set
      expect(output.moduleName).toBe('testModule');
    });

    it('generates program with stats', () => {
      const program = buildProgram(
        'main',
        [
          instr(ILOpcode.LOAD_IMM, [immOp(42)]),
          instr(ILOpcode.STORE_BYTE, [slotOp(x)]),
          instr(ILOpcode.RETURN),
        ],
        [x]
      );

      const output = generate(program);

      // Stats should be populated
      expect(output.stats).toBeDefined();
      expect(output.stats.instructionCount).toBeGreaterThan(0);
    });

    it('generates correct output for a realistic small program', () => {
      // A small but realistic C64 program:
      // - main initializes variables
      // - calls updateBorder with color
      // - updateBorder writes to hardware
      const color = zpSlot('color', 0x10);

      const program = buildMultiFuncProgram(
        [
          {
            name: 'main',
            instructions: [
              // color = 6 (blue)
              instr(ILOpcode.LOAD_IMM, [immOp(6)]),
              instr(ILOpcode.STORE_BYTE, [slotOp(color)]),
              // call updateBorder
              instr(ILOpcode.CALL, [funcOp('updateBorder')]),
              instr(ILOpcode.RETURN),
            ],
            slots: [color],
          },
          {
            name: 'updateBorder',
            instructions: [
              // poke($D020, color)
              instr(ILOpcode.LOAD_BYTE, [slotOp(color)]),
              instr(ILOpcode.POKE, [addrOp(0xd020)]),
              // poke($D021, color)
              instr(ILOpcode.LOAD_BYTE, [slotOp(color)]),
              instr(ILOpcode.POKE, [addrOp(0xd021)]),
              instr(ILOpcode.RETURN),
            ],
            slots: [color],
          },
        ],
        { moduleName: 'borderDemo' }
      );

      const output = generate(program);

      // Verify program structure
      expect(output.moduleName).toBe('borderDemo');
      expect(hasLabel(output, 'main')).toBe(true);
      expect(hasLabel(output, 'updateBorder')).toBe(true);

      // startup: JSR main, RTS
      // main: LDA #6, STA color, JSR updateBorder, RTS
      // updateBorder: LDA color, STA $D020, LDA color, STA $D021, RTS
      expect(countMnemonic(output, 'JSR')).toBe(2);
      expect(countMnemonic(output, 'RTS')).toBe(3);

      // Hardware writes (STA to $D020 and $D021)
      const instrs = allInstructions(output);
      const hardwareWrites = instrs.filter(
        (e) =>
          isInstructionElement(e) &&
          e.instruction.mnemonic === 'STA' &&
          e.instruction.operand !== undefined &&
          e.instruction.operand >= 0xd000
      );
      expect(hardwareWrites.length).toBe(2);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge cases', () => {
    it('handles empty function with implicit RTS', () => {
      const program = buildProgram('emptyFunc', [], []);

      const output = generate(program);

      // Should still have a label and implicit RTS
      expect(hasLabel(output, 'emptyFunc')).toBe(true);
      expect(mnemonics(output)).toContain('RTS');
    });

    it('handles function with only NOP instructions', () => {
      const program = buildProgram(
        'nopFunc',
        [
          instr(ILOpcode.NOP),
          instr(ILOpcode.NOP),
          instr(ILOpcode.RETURN),
        ],
        []
      );

      const output = generate(program);

      expect(hasLabel(output, 'nopFunc')).toBe(true);
      expect(countMnemonic(output, 'NOP')).toBe(2);
      expect(mnemonics(output)).toContain('RTS');
    });

    it('handles program with no functions gracefully', () => {
      // Edge case: empty program
      const program = buildProgram('empty', [instr(ILOpcode.RETURN)], []);
      const output = generate(program);

      // Should still produce valid output
      expect(output).toBeDefined();
      expect(output.sections.length).toBeGreaterThan(0);
    });
  });
});
