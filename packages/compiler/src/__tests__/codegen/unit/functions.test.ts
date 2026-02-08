/**
 * Function Operations Tests
 *
 * Tests for function operation code generation:
 * - CALL: Call a function (JSR instruction)
 * - RETURN: Return from function (RTS instruction)
 *
 * @module __tests__/codegen/unit/functions.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableFunctionOpsGenerator,
  createCallInstr,
  createReturnInstr,
  findInstruction,
  findAllInstructions,
  countInstructions,
  getInstructions,
  hasCommentContaining,
} from './_functions-helpers.js';
import { isInstructionElement, AsmAddressingMode } from '../../../codegen/asm-il/types.js';

describe('Function Operations', () => {
  let gen: TestableFunctionOpsGenerator;

  beforeEach(() => {
    gen = new TestableFunctionOpsGenerator('test');
  });

  // ==========================================================================
  // CALL Tests
  // ==========================================================================

  describe('CALL', () => {
    it('generates JSR instruction', () => {
      const instr = createCallInstr('myFunction');

      gen.testGenCall(instr);

      const elements = gen.getElements();
      const jsr = findInstruction(elements, 'JSR');

      expect(jsr).toBeDefined();
      expect(isInstructionElement(jsr)).toBe(true);
    });

    it('generates JSR with correct function name', () => {
      const instr = createCallInstr('calculateSum');

      gen.testGenCall(instr);

      const elements = gen.getElements();
      const jsr = findInstruction(elements, 'JSR');

      expect(jsr).toBeDefined();
      if (isInstructionElement(jsr)) {
        expect(jsr.instruction.labelOperand).toBe('calculateSum');
      }
    });

    it('generates exactly one JSR instruction', () => {
      const instr = createCallInstr('func');

      gen.testGenCall(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'JSR')).toBe(1);
    });

    it('invalidates accumulator state after call', () => {
      // Set A to a known state
      gen.testSetAFromSlot(0x10);
      expect(gen.testAHasSlot(0x10)).toBe(true);

      // Call a function
      gen.testGenCall(createCallInstr('myFunc'));

      // A should be invalidated (function may clobber A)
      expect(gen.testAHasSlot(0x10)).toBe(false);
    });

    it('generates comment for CALL instruction', () => {
      const instr = createCallInstr('myFunc');

      gen.testGenCall(instr);

      const elements = gen.getElements();
      expect(hasCommentContaining(elements, 'Call')).toBe(true);
    });

    it('handles various function names', () => {
      const funcNames = ['init', 'update', 'render', 'handleInput', 'saveState'];

      for (const name of funcNames) {
        const newGen = new TestableFunctionOpsGenerator('test');
        newGen.testGenCall(createCallInstr(name));

        const elements = newGen.getElements();
        const jsr = findInstruction(elements, 'JSR');

        expect(jsr).toBeDefined();
        if (isInstructionElement(jsr)) {
          expect(jsr.instruction.labelOperand).toBe(name);
        }
      }
    });

    it('handles callback functions', () => {
      const instr = createCallInstr('interruptHandler', true, 0);

      gen.testGenCall(instr);

      const elements = gen.getElements();
      const jsr = findInstruction(elements, 'JSR');

      expect(jsr).toBeDefined();
      if (isInstructionElement(jsr)) {
        expect(jsr.instruction.labelOperand).toBe('interruptHandler');
      }
    });

    it('handles functions with coalesce group', () => {
      const instr = createCallInstr('groupedFunc', false, 2);

      gen.testGenCall(instr);

      const elements = gen.getElements();
      const jsr = findInstruction(elements, 'JSR');

      expect(jsr).toBeDefined();
      if (isInstructionElement(jsr)) {
        expect(jsr.instruction.labelOperand).toBe('groupedFunc');
      }
    });

    it('can generate multiple consecutive calls', () => {
      gen.testGenCall(createCallInstr('func1'));
      gen.testGenCall(createCallInstr('func2'));
      gen.testGenCall(createCallInstr('func3'));

      const elements = gen.getElements();
      const jsrs = findAllInstructions(elements, 'JSR');

      expect(jsrs.length).toBe(3);

      // Verify function names
      if (isInstructionElement(jsrs[0])) {
        expect(jsrs[0].instruction.labelOperand).toBe('func1');
      }
      if (isInstructionElement(jsrs[1])) {
        expect(jsrs[1].instruction.labelOperand).toBe('func2');
      }
      if (isInstructionElement(jsrs[2])) {
        expect(jsrs[2].instruction.labelOperand).toBe('func3');
      }
    });

    it('invalidates A on each call', () => {
      // Set A state
      gen.testSetAFromImmediate(42);
      expect(gen.testAHasImmediate(42)).toBe(true);

      // First call
      gen.testGenCall(createCallInstr('func1'));
      expect(gen.testAHasImmediate(42)).toBe(false);

      // Set A again
      gen.testSetAFromSlot(0x20);
      expect(gen.testAHasSlot(0x20)).toBe(true);

      // Second call
      gen.testGenCall(createCallInstr('func2'));
      expect(gen.testAHasSlot(0x20)).toBe(false);
    });

    it('handles special function names', () => {
      const specialNames = [
        'main',
        '_init',
        '__start',
        'kernal_chrout',
        'c64_setcol',
      ];

      for (const name of specialNames) {
        const newGen = new TestableFunctionOpsGenerator('test');
        newGen.testGenCall(createCallInstr(name));

        const elements = newGen.getElements();
        const jsr = findInstruction(elements, 'JSR');

        expect(jsr).toBeDefined();
        if (isInstructionElement(jsr)) {
          expect(jsr.instruction.labelOperand).toBe(name);
        }
      }
    });
  });

  // ==========================================================================
  // RETURN Tests
  // ==========================================================================

  describe('RETURN', () => {
    it('generates RTS instruction', () => {
      const instr = createReturnInstr();

      gen.testGenReturn(instr);

      const elements = gen.getElements();
      const rts = findInstruction(elements, 'RTS');

      expect(rts).toBeDefined();
      expect(isInstructionElement(rts)).toBe(true);
    });

    it('generates exactly one RTS instruction', () => {
      const instr = createReturnInstr();

      gen.testGenReturn(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'RTS')).toBe(1);
    });

    it('generates comment for RETURN instruction', () => {
      const instr = createReturnInstr();

      gen.testGenReturn(instr);

      const elements = gen.getElements();
      expect(hasCommentContaining(elements, 'Return')).toBe(true);
    });

    it('does not affect accumulator state', () => {
      // Set A to known state
      gen.testSetAFromSlot(0x10);
      expect(gen.testAHasSlot(0x10)).toBe(true);

      // Generate return
      gen.testGenReturn(createReturnInstr());

      // A state should remain unchanged (RTS doesn't modify A)
      // Note: In practice, caller's A state is unknown, but within
      // the generator, we don't modify it
      expect(gen.testAHasSlot(0x10)).toBe(true);
    });

    it('can generate multiple returns', () => {
      gen.testGenReturn(createReturnInstr());
      gen.testGenReturn(createReturnInstr());
      gen.testGenReturn(createReturnInstr());

      const elements = gen.getElements();
      expect(countInstructions(elements, 'RTS')).toBe(3);
    });

    it('RTS has implied addressing mode', () => {
      gen.testGenReturn(createReturnInstr());

      const elements = gen.getElements();
      const rts = findInstruction(elements, 'RTS');

      if (isInstructionElement(rts)) {
        expect(rts.instruction.mode).toBe(AsmAddressingMode.Implied);
      }
    });
  });

  // ==========================================================================
  // Combined Call and Return Tests
  // ==========================================================================

  describe('Combined Call and Return', () => {
    it('can generate call followed by return', () => {
      gen.testGenCall(createCallInstr('helper'));
      gen.testGenReturn(createReturnInstr());

      const elements = gen.getElements();
      expect(countInstructions(elements, 'JSR')).toBe(1);
      expect(countInstructions(elements, 'RTS')).toBe(1);
    });

    it('generates instructions in correct order', () => {
      gen.testGenCall(createCallInstr('setup'));
      gen.testGenCall(createCallInstr('process'));
      gen.testGenReturn(createReturnInstr());

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      // Filter to just JSR and RTS
      const jsrRts = instructions.filter(
        (e) =>
          isInstructionElement(e) &&
          (e.instruction.mnemonic === 'JSR' || e.instruction.mnemonic === 'RTS')
      );

      expect(jsrRts.length).toBe(3);

      // Verify order: JSR setup, JSR process, RTS
      if (isInstructionElement(jsrRts[0])) {
        expect(jsrRts[0].instruction.mnemonic).toBe('JSR');
        expect(jsrRts[0].instruction.labelOperand).toBe('setup');
      }
      if (isInstructionElement(jsrRts[1])) {
        expect(jsrRts[1].instruction.mnemonic).toBe('JSR');
        expect(jsrRts[1].instruction.labelOperand).toBe('process');
      }
      if (isInstructionElement(jsrRts[2])) {
        expect(jsrRts[2].instruction.mnemonic).toBe('RTS');
      }
    });

    it('simulates simple function body with calls', () => {
      // Simulate: function foo() { bar(); baz(); return; }
      gen.testGenCall(createCallInstr('bar'));
      gen.testGenCall(createCallInstr('baz'));
      gen.testGenReturn(createReturnInstr());

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      expect(countInstructions(elements, 'JSR')).toBe(2);
      expect(countInstructions(elements, 'RTS')).toBe(1);
    });

    it('handles recursive call pattern', () => {
      // Simulate: function recurse() { recurse(); }
      gen.testGenCall(createCallInstr('recurse'));
      gen.testGenReturn(createReturnInstr());

      const elements = gen.getElements();
      const jsr = findInstruction(elements, 'JSR');

      if (isInstructionElement(jsr)) {
        expect(jsr.instruction.labelOperand).toBe('recurse');
      }
    });

    it('accumulator state is unknown after call but before return', () => {
      gen.testSetAFromImmediate(100);

      // Call invalidates A
      gen.testGenCall(createCallInstr('someFunc'));
      expect(gen.testAHasImmediate(100)).toBe(false);

      // A state stays unknown through return
      gen.testGenReturn(createReturnInstr());
      expect(gen.testAHasImmediate(100)).toBe(false);
    });
  });

  // ==========================================================================
  // Instruction Count Verification
  // ==========================================================================

  describe('Instruction Count Verification', () => {
    it('CALL generates single instruction', () => {
      gen.testGenCall(createCallInstr('func'));

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      expect(instructions.length).toBe(1);
    });

    it('RETURN generates single instruction', () => {
      gen.testGenReturn(createReturnInstr());

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      expect(instructions.length).toBe(1);
    });

    it('multiple operations generate expected instruction count', () => {
      gen.testGenCall(createCallInstr('a'));
      gen.testGenCall(createCallInstr('b'));
      gen.testGenReturn(createReturnInstr());
      gen.testGenCall(createCallInstr('c'));
      gen.testGenReturn(createReturnInstr());

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      expect(instructions.length).toBe(5);
    });
  });
});