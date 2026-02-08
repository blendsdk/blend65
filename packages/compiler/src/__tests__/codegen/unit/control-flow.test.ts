/**
 * Control Flow Operations Tests
 *
 * Tests for control flow operation code generation:
 * - LABEL: Define labels for jump targets
 * - JUMP: Unconditional jump
 * - JUMP_EQ/NE/LT/LE/GE/GT: Conditional branches
 * - NOP: No operation
 * - PUSH_A/POP_A: Stack operations
 * - TRANSFER_*: Register transfers
 *
 * @module __tests__/codegen/unit/control-flow.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableControlFlowOpsGenerator,
  createLabelInstr,
  createJumpInstr,
  createJumpEqInstr,
  createJumpNeInstr,
  createJumpLtInstr,
  createJumpLeInstr,
  createJumpGeInstr,
  createJumpGtInstr,
  createNopInstr,
  createPushAInstr,
  createPopAInstr,
  createTransferAXInstr,
  createTransferAYInstr,
  createTransferXAInstr,
  createTransferYAInstr,
  findInstruction,
  findAllInstructions,
  countInstructions,
  getInstructions,
  hasCommentContaining,
  findLabel,
  countLabels,
} from './_control-flow-helpers.js';
import { isInstructionElement, isLabelElement } from '../../../codegen/asm-il/types.js';

describe('Control Flow Operations', () => {
  let gen: TestableControlFlowOpsGenerator;

  beforeEach(() => {
    gen = new TestableControlFlowOpsGenerator('test');
  });

  // ==========================================================================
  // LABEL Tests
  // ==========================================================================

  describe('LABEL', () => {
    it('generates label element', () => {
      const instr = createLabelInstr('loop_start');

      gen.testGenLabel(instr);

      const elements = gen.getElements();
      const label = findLabel(elements, 'loop_start');

      expect(label).toBeDefined();
    });

    it('generates label with local prefix (.)', () => {
      const instr = createLabelInstr('my_label');

      gen.testGenLabel(instr);

      const elements = gen.getElements();
      const labelElement = elements.find(isLabelElement);

      expect(labelElement).toBeDefined();
      if (isLabelElement(labelElement)) {
        expect(labelElement.label.name).toBe('.my_label');
      }
    });

    it('can generate multiple labels', () => {
      gen.testGenLabel(createLabelInstr('start'));
      gen.testGenLabel(createLabelInstr('middle'));
      gen.testGenLabel(createLabelInstr('end'));

      const elements = gen.getElements();
      expect(countLabels(elements)).toBe(3);
    });

    it('invalidates accumulator state at labels', () => {
      // Set A to known state
      gen.testSetAFromSlot(0x10);
      expect(gen.testAHasSlot(0x10)).toBe(true);

      // Generate a label
      gen.testGenLabel(createLabelInstr('label'));

      // A should be invalidated (unknown control flow)
      expect(gen.testAHasSlot(0x10)).toBe(false);
    });

    it('generates various label names', () => {
      const labelNames = ['loop', 'if_true', 'else_branch', 'while_cond', 'exit'];

      for (const name of labelNames) {
        const newGen = new TestableControlFlowOpsGenerator('test');
        newGen.testGenLabel(createLabelInstr(name));

        const elements = newGen.getElements();
        const label = findLabel(elements, name);
        expect(label).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // JUMP Tests
  // ==========================================================================

  describe('JUMP', () => {
    it('generates JMP instruction', () => {
      const instr = createJumpInstr('target');

      gen.testGenJump(instr);

      const elements = gen.getElements();
      const jmp = findInstruction(elements, 'JMP');

      expect(jmp).toBeDefined();
      expect(isInstructionElement(jmp)).toBe(true);
    });

    it('generates JMP with local label target', () => {
      const instr = createJumpInstr('loop_start');

      gen.testGenJump(instr);

      const elements = gen.getElements();
      const jmp = findInstruction(elements, 'JMP');

      expect(jmp).toBeDefined();
      if (isInstructionElement(jmp)) {
        expect(jmp.instruction.labelOperand).toBe('.loop_start');
      }
    });

    it('generates comment for JUMP instruction', () => {
      const instr = createJumpInstr('target');

      gen.testGenJump(instr);

      const elements = gen.getElements();
      expect(hasCommentContaining(elements, 'Jump')).toBe(true);
    });

    it('generates exactly one JMP instruction', () => {
      const instr = createJumpInstr('target');

      gen.testGenJump(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'JMP')).toBe(1);
    });
  });

  // ==========================================================================
  // JUMP_EQ Tests (BEQ)
  // ==========================================================================

  describe('JUMP_EQ', () => {
    it('generates BEQ instruction', () => {
      const instr = createJumpEqInstr('equal_branch');

      gen.testGenJumpEq(instr);

      const elements = gen.getElements();
      const beq = findInstruction(elements, 'BEQ');

      expect(beq).toBeDefined();
      expect(isInstructionElement(beq)).toBe(true);
    });

    it('generates BEQ with correct target', () => {
      const instr = createJumpEqInstr('is_zero');

      gen.testGenJumpEq(instr);

      const elements = gen.getElements();
      const beq = findInstruction(elements, 'BEQ');

      if (isInstructionElement(beq)) {
        expect(beq.instruction.labelOperand).toBe('.is_zero');
      }
    });

    it('generates exactly one BEQ instruction', () => {
      const instr = createJumpEqInstr('target');

      gen.testGenJumpEq(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'BEQ')).toBe(1);
    });
  });

  // ==========================================================================
  // JUMP_NE Tests (BNE)
  // ==========================================================================

  describe('JUMP_NE', () => {
    it('generates BNE instruction', () => {
      const instr = createJumpNeInstr('not_equal_branch');

      gen.testGenJumpNe(instr);

      const elements = gen.getElements();
      const bne = findInstruction(elements, 'BNE');

      expect(bne).toBeDefined();
      expect(isInstructionElement(bne)).toBe(true);
    });

    it('generates BNE with correct target', () => {
      const instr = createJumpNeInstr('not_zero');

      gen.testGenJumpNe(instr);

      const elements = gen.getElements();
      const bne = findInstruction(elements, 'BNE');

      if (isInstructionElement(bne)) {
        expect(bne.instruction.labelOperand).toBe('.not_zero');
      }
    });

    it('generates exactly one BNE instruction', () => {
      const instr = createJumpNeInstr('target');

      gen.testGenJumpNe(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'BNE')).toBe(1);
    });
  });

  // ==========================================================================
  // JUMP_LT Tests (BCC - unsigned less than)
  // ==========================================================================

  describe('JUMP_LT', () => {
    it('generates BCC instruction for unsigned less than', () => {
      const instr = createJumpLtInstr('less_than');

      gen.testGenJumpLt(instr);

      const elements = gen.getElements();
      const bcc = findInstruction(elements, 'BCC');

      expect(bcc).toBeDefined();
      expect(isInstructionElement(bcc)).toBe(true);
    });

    it('generates BCC with correct target', () => {
      const instr = createJumpLtInstr('is_smaller');

      gen.testGenJumpLt(instr);

      const elements = gen.getElements();
      const bcc = findInstruction(elements, 'BCC');

      if (isInstructionElement(bcc)) {
        expect(bcc.instruction.labelOperand).toBe('.is_smaller');
      }
    });

    it('generates exactly one BCC instruction', () => {
      const instr = createJumpLtInstr('target');

      gen.testGenJumpLt(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'BCC')).toBe(1);
    });
  });

  // ==========================================================================
  // JUMP_GE Tests (BCS - unsigned greater or equal)
  // ==========================================================================

  describe('JUMP_GE', () => {
    it('generates BCS instruction for unsigned greater or equal', () => {
      const instr = createJumpGeInstr('greater_equal');

      gen.testGenJumpGe(instr);

      const elements = gen.getElements();
      const bcs = findInstruction(elements, 'BCS');

      expect(bcs).toBeDefined();
      expect(isInstructionElement(bcs)).toBe(true);
    });

    it('generates BCS with correct target', () => {
      const instr = createJumpGeInstr('not_smaller');

      gen.testGenJumpGe(instr);

      const elements = gen.getElements();
      const bcs = findInstruction(elements, 'BCS');

      if (isInstructionElement(bcs)) {
        expect(bcs.instruction.labelOperand).toBe('.not_smaller');
      }
    });

    it('generates exactly one BCS instruction', () => {
      const instr = createJumpGeInstr('target');

      gen.testGenJumpGe(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'BCS')).toBe(1);
    });
  });

  // ==========================================================================
  // JUMP_LE Tests (BCC or BEQ)
  // ==========================================================================

  describe('JUMP_LE', () => {
    it('generates BCC and BEQ for less or equal', () => {
      const instr = createJumpLeInstr('less_or_equal');

      gen.testGenJumpLe(instr);

      const elements = gen.getElements();

      // JUMP_LE uses two branches: BCC (less) or BEQ (equal)
      expect(countInstructions(elements, 'BCC')).toBe(1);
      expect(countInstructions(elements, 'BEQ')).toBe(1);
    });

    it('both branches target the same label', () => {
      const instr = createJumpLeInstr('target');

      gen.testGenJumpLe(instr);

      const elements = gen.getElements();
      const bcc = findInstruction(elements, 'BCC');
      const beq = findInstruction(elements, 'BEQ');

      if (isInstructionElement(bcc) && isInstructionElement(beq)) {
        expect(bcc.instruction.labelOperand).toBe('.target');
        expect(beq.instruction.labelOperand).toBe('.target');
      }
    });
  });

  // ==========================================================================
  // JUMP_GT Tests (BEQ skip / BCS label / skip:)
  // ==========================================================================

  describe('JUMP_GT', () => {
    it('generates complex branch sequence for greater than', () => {
      const instr = createJumpGtInstr('greater');

      gen.testGenJumpGt(instr);

      const elements = gen.getElements();

      // JUMP_GT uses: BEQ skip / BCS label / skip:
      expect(countInstructions(elements, 'BEQ')).toBe(1);
      expect(countInstructions(elements, 'BCS')).toBe(1);
    });

    it('generates skip label for JUMP_GT', () => {
      const instr = createJumpGtInstr('target');

      gen.testGenJumpGt(instr);

      const elements = gen.getElements();

      // Should have a skip label generated
      expect(countLabels(elements)).toBeGreaterThanOrEqual(1);
    });

    it('BCS targets the user label', () => {
      const instr = createJumpGtInstr('is_greater');

      gen.testGenJumpGt(instr);

      const elements = gen.getElements();
      const bcs = findInstruction(elements, 'BCS');

      if (isInstructionElement(bcs)) {
        expect(bcs.instruction.labelOperand).toBe('.is_greater');
      }
    });
  });

  // ==========================================================================
  // NOP Tests
  // ==========================================================================

  describe('NOP', () => {
    it('generates NOP instruction', () => {
      const instr = createNopInstr();

      gen.testGenNop(instr);

      const elements = gen.getElements();
      const nop = findInstruction(elements, 'NOP');

      expect(nop).toBeDefined();
      expect(isInstructionElement(nop)).toBe(true);
    });

    it('generates exactly one NOP instruction', () => {
      const instr = createNopInstr();

      gen.testGenNop(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'NOP')).toBe(1);
    });

    it('can generate multiple NOPs', () => {
      gen.testGenNop(createNopInstr());
      gen.testGenNop(createNopInstr());
      gen.testGenNop(createNopInstr());

      const elements = gen.getElements();
      expect(countInstructions(elements, 'NOP')).toBe(3);
    });
  });

  // ==========================================================================
  // PUSH_A Tests
  // ==========================================================================

  describe('PUSH_A', () => {
    it('generates PHA instruction', () => {
      const instr = createPushAInstr();

      gen.testGenPushA(instr);

      const elements = gen.getElements();
      const pha = findInstruction(elements, 'PHA');

      expect(pha).toBeDefined();
      expect(isInstructionElement(pha)).toBe(true);
    });

    it('generates exactly one PHA instruction', () => {
      const instr = createPushAInstr();

      gen.testGenPushA(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'PHA')).toBe(1);
    });

    it('does not change accumulator state after push', () => {
      gen.testSetAFromSlot(0x10);

      gen.testGenPushA(createPushAInstr());

      // A still contains the value (push doesn't change A)
      expect(gen.testAHasSlot(0x10)).toBe(true);
    });
  });

  // ==========================================================================
  // POP_A Tests
  // ==========================================================================

  describe('POP_A', () => {
    it('generates PLA instruction', () => {
      const instr = createPopAInstr();

      gen.testGenPopA(instr);

      const elements = gen.getElements();
      const pla = findInstruction(elements, 'PLA');

      expect(pla).toBeDefined();
      expect(isInstructionElement(pla)).toBe(true);
    });

    it('generates exactly one PLA instruction', () => {
      const instr = createPopAInstr();

      gen.testGenPopA(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'PLA')).toBe(1);
    });

    it('invalidates accumulator state after pop', () => {
      gen.testSetAFromSlot(0x10);

      gen.testGenPopA(createPopAInstr());

      // A is unknown after PLA (value from stack)
      expect(gen.testAHasSlot(0x10)).toBe(false);
    });
  });

  // ==========================================================================
  // TRANSFER_AX Tests
  // ==========================================================================

  describe('TRANSFER_AX', () => {
    it('generates TAX instruction', () => {
      const instr = createTransferAXInstr();

      gen.testGenTransferAX(instr);

      const elements = gen.getElements();
      const tax = findInstruction(elements, 'TAX');

      expect(tax).toBeDefined();
      expect(isInstructionElement(tax)).toBe(true);
    });

    it('generates exactly one TAX instruction', () => {
      const instr = createTransferAXInstr();

      gen.testGenTransferAX(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'TAX')).toBe(1);
    });

    it('does not change accumulator state after TAX', () => {
      gen.testSetAFromSlot(0x10);

      gen.testGenTransferAX(createTransferAXInstr());

      // A is unchanged by TAX
      expect(gen.testAHasSlot(0x10)).toBe(true);
    });
  });

  // ==========================================================================
  // TRANSFER_AY Tests
  // ==========================================================================

  describe('TRANSFER_AY', () => {
    it('generates TAY instruction', () => {
      const instr = createTransferAYInstr();

      gen.testGenTransferAY(instr);

      const elements = gen.getElements();
      const tay = findInstruction(elements, 'TAY');

      expect(tay).toBeDefined();
      expect(isInstructionElement(tay)).toBe(true);
    });

    it('generates exactly one TAY instruction', () => {
      const instr = createTransferAYInstr();

      gen.testGenTransferAY(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'TAY')).toBe(1);
    });

    it('does not change accumulator state after TAY', () => {
      gen.testSetAFromSlot(0x10);

      gen.testGenTransferAY(createTransferAYInstr());

      // A is unchanged by TAY
      expect(gen.testAHasSlot(0x10)).toBe(true);
    });
  });

  // ==========================================================================
  // TRANSFER_XA Tests
  // ==========================================================================

  describe('TRANSFER_XA', () => {
    it('generates TXA instruction', () => {
      const instr = createTransferXAInstr();

      gen.testGenTransferXA(instr);

      const elements = gen.getElements();
      const txa = findInstruction(elements, 'TXA');

      expect(txa).toBeDefined();
      expect(isInstructionElement(txa)).toBe(true);
    });

    it('generates exactly one TXA instruction', () => {
      const instr = createTransferXAInstr();

      gen.testGenTransferXA(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'TXA')).toBe(1);
    });

    it('invalidates accumulator state after TXA', () => {
      gen.testSetAFromSlot(0x10);

      gen.testGenTransferXA(createTransferXAInstr());

      // A is unknown after TXA (value from X)
      expect(gen.testAHasSlot(0x10)).toBe(false);
    });
  });

  // ==========================================================================
  // TRANSFER_YA Tests
  // ==========================================================================

  describe('TRANSFER_YA', () => {
    it('generates TYA instruction', () => {
      const instr = createTransferYAInstr();

      gen.testGenTransferYA(instr);

      const elements = gen.getElements();
      const tya = findInstruction(elements, 'TYA');

      expect(tya).toBeDefined();
      expect(isInstructionElement(tya)).toBe(true);
    });

    it('generates exactly one TYA instruction', () => {
      const instr = createTransferYAInstr();

      gen.testGenTransferYA(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'TYA')).toBe(1);
    });

    it('invalidates accumulator state after TYA', () => {
      gen.testSetAFromSlot(0x10);

      gen.testGenTransferYA(createTransferYAInstr());

      // A is unknown after TYA (value from Y)
      expect(gen.testAHasSlot(0x10)).toBe(false);
    });
  });

  // ==========================================================================
  // Mixed Control Flow Tests
  // ==========================================================================

  describe('Mixed Control Flow', () => {
    it('can combine label and jump', () => {
      gen.testGenLabel(createLabelInstr('loop'));
      gen.testGenJump(createJumpInstr('loop'));

      const elements = gen.getElements();
      expect(countLabels(elements)).toBe(1);
      expect(countInstructions(elements, 'JMP')).toBe(1);
    });

    it('can build complete if-else structure', () => {
      // if (cond) { ... } else { ... }
      // CMP + BNE else_branch + ... + JMP end + else_branch: + ... + end:
      gen.testGenJumpNe(createJumpNeInstr('else_branch')); // BNE else_branch
      gen.testGenJump(createJumpInstr('end')); // JMP end
      gen.testGenLabel(createLabelInstr('else_branch')); // else_branch:
      gen.testGenLabel(createLabelInstr('end')); // end:

      const elements = gen.getElements();
      expect(countInstructions(elements, 'BNE')).toBe(1);
      expect(countInstructions(elements, 'JMP')).toBe(1);
      expect(countLabels(elements)).toBe(2);
    });

    it('can build complete while loop structure', () => {
      // while_start: CMP + BNE end + ... + JMP while_start + end:
      gen.testGenLabel(createLabelInstr('while_start')); // while_start:
      gen.testGenJumpNe(createJumpNeInstr('while_end')); // BNE while_end
      gen.testGenJump(createJumpInstr('while_start')); // JMP while_start
      gen.testGenLabel(createLabelInstr('while_end')); // while_end:

      const elements = gen.getElements();
      expect(countLabels(elements)).toBe(2);
      expect(countInstructions(elements, 'BNE')).toBe(1);
      expect(countInstructions(elements, 'JMP')).toBe(1);
    });

    it('can use push/pop around function call', () => {
      gen.testGenPushA(createPushAInstr()); // Save A
      // ... function call would go here ...
      gen.testGenPopA(createPopAInstr()); // Restore A

      const elements = gen.getElements();
      expect(countInstructions(elements, 'PHA')).toBe(1);
      expect(countInstructions(elements, 'PLA')).toBe(1);
    });

    it('can use all transfer instructions', () => {
      gen.testGenTransferAX(createTransferAXInstr());
      gen.testGenTransferAY(createTransferAYInstr());
      gen.testGenTransferXA(createTransferXAInstr());
      gen.testGenTransferYA(createTransferYAInstr());

      const elements = gen.getElements();
      expect(countInstructions(elements, 'TAX')).toBe(1);
      expect(countInstructions(elements, 'TAY')).toBe(1);
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'TYA')).toBe(1);
    });
  });

  // ==========================================================================
  // Conditional Branch Target Tests
  // ==========================================================================

  describe('Conditional Branch Targets', () => {
    it('all conditional jumps use local labels', () => {
      const testCases = [
        { mnemonic: 'BEQ', genFn: (g: TestableControlFlowOpsGenerator) => g.testGenJumpEq(createJumpEqInstr('target')) },
        { mnemonic: 'BNE', genFn: (g: TestableControlFlowOpsGenerator) => g.testGenJumpNe(createJumpNeInstr('target')) },
        { mnemonic: 'BCC', genFn: (g: TestableControlFlowOpsGenerator) => g.testGenJumpLt(createJumpLtInstr('target')) },
        { mnemonic: 'BCS', genFn: (g: TestableControlFlowOpsGenerator) => g.testGenJumpGe(createJumpGeInstr('target')) },
      ];

      for (const { mnemonic, genFn } of testCases) {
        const newGen = new TestableControlFlowOpsGenerator('test');
        genFn(newGen);

        const elements = newGen.getElements();
        const branch = findInstruction(elements, mnemonic);

        expect(branch).toBeDefined();
        if (isInstructionElement(branch)) {
          expect(branch.instruction.labelOperand).toBe('.target');
        }
      }
    });
  });

  // ==========================================================================
  // Instruction Count Verification
  // ==========================================================================

  describe('Instruction Count Verification', () => {
    it('simple operations generate single instruction', () => {
      const simpleOps = [
        { genFn: (g: TestableControlFlowOpsGenerator) => g.testGenNop(createNopInstr()), expected: 1 },
        { genFn: (g: TestableControlFlowOpsGenerator) => g.testGenPushA(createPushAInstr()), expected: 1 },
        { genFn: (g: TestableControlFlowOpsGenerator) => g.testGenPopA(createPopAInstr()), expected: 1 },
        { genFn: (g: TestableControlFlowOpsGenerator) => g.testGenTransferAX(createTransferAXInstr()), expected: 1 },
      ];

      for (const { genFn, expected } of simpleOps) {
        const newGen = new TestableControlFlowOpsGenerator('test');
        genFn(newGen);

        const elements = newGen.getElements();
        const instructions = getInstructions(elements);
        expect(instructions.length).toBe(expected);
      }
    });

    it('JUMP_LE generates two branch instructions', () => {
      gen.testGenJumpLe(createJumpLeInstr('target'));

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      // BCC + BEQ = 2 instructions
      expect(instructions.length).toBe(2);
    });

    it('JUMP_GT generates two branch instructions plus skip label', () => {
      gen.testGenJumpGt(createJumpGtInstr('target'));

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      // BEQ + BCS = 2 instructions
      expect(instructions.length).toBe(2);
      // Plus one skip label
      expect(countLabels(elements)).toBe(1);
    });
  });
});