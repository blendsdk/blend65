/**
 * 65C02 Function Operations Tests
 *
 * Verifies that the function operations layer uses PHX/PLX/PHY/PLY
 * (65C02 native instructions) instead of the 6502 multi-instruction
 * sequences (TXA+PHA / PLA+TAX / TYA+PHA / PLA+TAY) when the
 * CPU target is set to '65c02'.
 *
 * On the 65C02:
 * - **PHX** (1 byte) replaces TXA + PHA (2 bytes) — preserves A
 * - **PLX** (1 byte) replaces PLA + TAX (2 bytes) — preserves A
 * - **PHY** (1 byte) replaces TYA + PHA (2 bytes) — preserves A
 * - **PLY** (1 byte) replaces PLA + TAY (2 bytes) — preserves A
 *
 * Tests focus on the `saveX()`, `restoreX()`, `saveY()`, `restoreY()`
 * helper methods added in Phase 4 which delegate to the CPU strategy.
 *
 * @module __tests__/codegen/unit/functions-65c02
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionOpsGenerator } from '../../../codegen/generator/functions.js';
import { AsmILElement, AsmILProgram, isInstructionElement } from '../../../codegen/asm-il/types.js';
import { ILProgram } from '../../../il/index.js';
import type { CpuTarget } from '../../../codegen/cpu/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Testable subclass exposing the protected saveX/restoreX/saveY/restoreY methods.
 *
 * Constructor accepts cpuTarget to test both 6502 and 65C02 behavior.
 */
class TestableFunctions65C02 extends FunctionOpsGenerator {
  /**
   * Exposes saveX for direct testing.
   */
  public testSaveX(comment?: string): void {
    this.saveX(comment);
  }

  /**
   * Exposes restoreX for direct testing.
   */
  public testRestoreX(comment?: string): void {
    this.restoreX(comment);
  }

  /**
   * Exposes saveY for direct testing.
   */
  public testSaveY(comment?: string): void {
    this.saveY(comment);
  }

  /**
   * Exposes restoreY for direct testing.
   */
  public testRestoreY(comment?: string): void {
    this.restoreY(comment);
  }

  /**
   * Gets the generated ASM-IL elements for inspection.
   */
  public getElements(): AsmILElement[] {
    return this.asm.getAllElements();
  }

  /**
   * Checks if A has the specified immediate value.
   */
  public testAHasImmediate(value: number): boolean {
    return this.aHasImmediate(value);
  }

  /** Override to not throw on unhandled opcodes during testing. */
  public generate(_program: ILProgram): AsmILProgram {
    throw new Error('Not implemented for testing');
  }
}

/**
 * Extracts instruction mnemonics from generated output.
 */
function getMnemonics(elements: AsmILElement[]): string[] {
  return elements
    .filter(isInstructionElement)
    .map(e => e.instruction.mnemonic);
}

/**
 * Extracts full instruction details from generated output.
 */
function getInstructions(elements: AsmILElement[]) {
  return elements
    .filter(isInstructionElement)
    .map(e => e.instruction);
}

/**
 * Creates a testable generator for the given CPU target.
 *
 * @param cpuTarget - Target CPU ('6502' or '65c02')
 * @returns TestableFunctions65C02 instance
 */
function createGenerator(cpuTarget: CpuTarget): TestableFunctions65C02 {
  return new TestableFunctions65C02('test', cpuTarget);
}

// ============================================================================
// 65C02 Function Operations Tests
// ============================================================================

describe('Function Operations — 65C02 (PHX/PLX/PHY/PLY)', () => {
  let gen65c02: TestableFunctions65C02;
  let gen6502: TestableFunctions65C02;

  beforeEach(() => {
    gen65c02 = createGenerator('65c02');
    gen6502 = createGenerator('6502');
  });

  // --------------------------------------------------------------------------
  // saveX → PHX on 65C02
  // --------------------------------------------------------------------------

  describe('saveX — PHX on 65C02', () => {
    it('65C02 emits single PHX instruction', () => {
      gen65c02.testSaveX();

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('PHX');
    });

    it('6502 emits TXA + PHA (2 instructions)', () => {
      gen6502.testSaveX();

      const mnemonics = getMnemonics(gen6502.getElements());
      expect(mnemonics).toContain('TXA');
      expect(mnemonics).toContain('PHA');
    });

    it('65C02 does NOT emit TXA or PHA', () => {
      gen65c02.testSaveX();

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).not.toContain('TXA');
      expect(mnemonics).not.toContain('PHA');
    });

    it('65C02 produces fewer instructions than 6502', () => {
      gen65c02.testSaveX();
      gen6502.testSaveX();

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      expect(count65c02).toBeLessThan(count6502);
    });

    it('passes comment to PHX instruction', () => {
      gen65c02.testSaveX('preserve X for loop');

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs[0].comment).toBe('preserve X for loop');
    });
  });

  // --------------------------------------------------------------------------
  // restoreX → PLX on 65C02
  // --------------------------------------------------------------------------

  describe('restoreX — PLX on 65C02', () => {
    it('65C02 emits single PLX instruction', () => {
      gen65c02.testRestoreX();

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('PLX');
    });

    it('6502 emits PLA + TAX (2 instructions)', () => {
      gen6502.testRestoreX();

      const mnemonics = getMnemonics(gen6502.getElements());
      expect(mnemonics).toContain('PLA');
      expect(mnemonics).toContain('TAX');
    });

    it('65C02 does NOT emit PLA or TAX', () => {
      gen65c02.testRestoreX();

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).not.toContain('PLA');
      expect(mnemonics).not.toContain('TAX');
    });

    it('65C02 produces fewer instructions than 6502', () => {
      gen65c02.testRestoreX();
      gen6502.testRestoreX();

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      expect(count65c02).toBeLessThan(count6502);
    });

    it('passes comment to PLX instruction', () => {
      gen65c02.testRestoreX('restore X after call');

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs[0].comment).toBe('restore X after call');
    });
  });

  // --------------------------------------------------------------------------
  // saveY → PHY on 65C02
  // --------------------------------------------------------------------------

  describe('saveY — PHY on 65C02', () => {
    it('65C02 emits single PHY instruction', () => {
      gen65c02.testSaveY();

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('PHY');
    });

    it('6502 emits TYA + PHA (2 instructions)', () => {
      gen6502.testSaveY();

      const mnemonics = getMnemonics(gen6502.getElements());
      expect(mnemonics).toContain('TYA');
      expect(mnemonics).toContain('PHA');
    });

    it('65C02 does NOT emit TYA or PHA', () => {
      gen65c02.testSaveY();

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).not.toContain('TYA');
      expect(mnemonics).not.toContain('PHA');
    });

    it('65C02 produces fewer instructions than 6502', () => {
      gen65c02.testSaveY();
      gen6502.testSaveY();

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      expect(count65c02).toBeLessThan(count6502);
    });

    it('passes comment to PHY instruction', () => {
      gen65c02.testSaveY('preserve Y for index');

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs[0].comment).toBe('preserve Y for index');
    });
  });

  // --------------------------------------------------------------------------
  // restoreY → PLY on 65C02
  // --------------------------------------------------------------------------

  describe('restoreY — PLY on 65C02', () => {
    it('65C02 emits single PLY instruction', () => {
      gen65c02.testRestoreY();

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('PLY');
    });

    it('6502 emits PLA + TAY (2 instructions)', () => {
      gen6502.testRestoreY();

      const mnemonics = getMnemonics(gen6502.getElements());
      expect(mnemonics).toContain('PLA');
      expect(mnemonics).toContain('TAY');
    });

    it('65C02 does NOT emit PLA or TAY', () => {
      gen65c02.testRestoreY();

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).not.toContain('PLA');
      expect(mnemonics).not.toContain('TAY');
    });

    it('65C02 produces fewer instructions than 6502', () => {
      gen65c02.testRestoreY();
      gen6502.testRestoreY();

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      expect(count65c02).toBeLessThan(count6502);
    });

    it('passes comment to PLY instruction', () => {
      gen65c02.testRestoreY('restore Y after call');

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs[0].comment).toBe('restore Y after call');
    });
  });

  // --------------------------------------------------------------------------
  // Save/restore pairs produce balanced stack operations
  // --------------------------------------------------------------------------

  describe('save/restore pairs', () => {
    it('65C02 saveX + restoreX produces PHX + PLX', () => {
      gen65c02.testSaveX();
      gen65c02.testRestoreX();

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).toEqual(['PHX', 'PLX']);
    });

    it('65C02 saveY + restoreY produces PHY + PLY', () => {
      gen65c02.testSaveY();
      gen65c02.testRestoreY();

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).toEqual(['PHY', 'PLY']);
    });

    it('6502 saveX + restoreX produces TXA + PHA + PLA + TAX', () => {
      gen6502.testSaveX();
      gen6502.testRestoreX();

      const mnemonics = getMnemonics(gen6502.getElements());
      expect(mnemonics).toEqual(['TXA', 'PHA', 'PLA', 'TAX']);
    });

    it('6502 saveY + restoreY produces TYA + PHA + PLA + TAY', () => {
      gen6502.testSaveY();
      gen6502.testRestoreY();

      const mnemonics = getMnemonics(gen6502.getElements());
      expect(mnemonics).toEqual(['TYA', 'PHA', 'PLA', 'TAY']);
    });

    it('65C02 save/restore pair is half the instructions of 6502', () => {
      gen65c02.testSaveX();
      gen65c02.testRestoreX();
      gen6502.testSaveX();
      gen6502.testRestoreX();

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      // 65C02: 2 instructions (PHX + PLX)
      // 6502: 4 instructions (TXA + PHA + PLA + TAX)
      expect(count65c02).toBe(2);
      expect(count6502).toBe(4);
    });
  });

  // --------------------------------------------------------------------------
  // Multiple register saves
  // --------------------------------------------------------------------------

  describe('multiple register saves', () => {
    it('65C02 can save both X and Y in 2 instructions', () => {
      gen65c02.testSaveX();
      gen65c02.testSaveY();

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).toEqual(['PHX', 'PHY']);
    });

    it('6502 needs 4 instructions to save both X and Y', () => {
      gen6502.testSaveX();
      gen6502.testSaveY();

      const mnemonics = getMnemonics(gen6502.getElements());
      expect(mnemonics).toEqual(['TXA', 'PHA', 'TYA', 'PHA']);
    });

    it('65C02 full save/restore of X and Y is 4 instructions', () => {
      gen65c02.testSaveX();
      gen65c02.testSaveY();
      gen65c02.testRestoreY();
      gen65c02.testRestoreX();

      const mnemonics = getMnemonics(gen65c02.getElements());
      // LIFO order: save X, save Y, restore Y, restore X
      expect(mnemonics).toEqual(['PHX', 'PHY', 'PLY', 'PLX']);
    });

    it('6502 full save/restore of X and Y is 8 instructions', () => {
      gen6502.testSaveX();
      gen6502.testSaveY();
      gen6502.testRestoreY();
      gen6502.testRestoreX();

      const instrs = getInstructions(gen6502.getElements());
      expect(instrs).toHaveLength(8);
    });
  });
});
