/**
 * 65C02 Memory Operations Tests
 *
 * Verifies that the memory operations layer uses STZ (65C02 native)
 * instead of the 6502 multi-instruction LDA #0 + STA sequence when
 * the CPU target is set to '65c02'.
 *
 * Tests focus on the `storeZeroToAddress()` CPU-aware helper method
 * added in Phase 4 of the 65C02 multi-CPU support plan.
 *
 * @module __tests__/codegen/unit/memory-ops-65c02
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryOpsGenerator } from '../../../codegen/generator/memory.js';
import { AsmILElement, AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';
import { ILProgram } from '../../../il/index.js';
import type { CpuTarget } from '../../../codegen/cpu/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Testable subclass exposing the protected storeZeroToAddress method.
 *
 * Constructor accepts cpuTarget to test both 6502 and 65C02 behavior.
 */
class TestableMemoryOps65C02 extends MemoryOpsGenerator {
  /**
   * Exposes storeZeroToAddress for direct testing.
   *
   * @param address - Memory address to store zero at
   * @param isZp - Whether the address is in zero page
   * @param comment - Optional comment
   */
  public testStoreZeroToAddress(address: number, isZp: boolean, comment?: string): void {
    this.storeZeroToAddress(address, isZp, comment);
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
  public generate(_program: ILProgram): never {
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
 * @returns TestableMemoryOps65C02 instance
 */
function createGenerator(cpuTarget: CpuTarget): TestableMemoryOps65C02 {
  return new TestableMemoryOps65C02('test', cpuTarget);
}

// ============================================================================
// 65C02 Memory Operations Tests
// ============================================================================

describe('Memory Operations — 65C02 (STZ)', () => {
  let gen65c02: TestableMemoryOps65C02;
  let gen6502: TestableMemoryOps65C02;

  beforeEach(() => {
    gen65c02 = createGenerator('65c02');
    gen6502 = createGenerator('6502');
  });

  // --------------------------------------------------------------------------
  // STZ Zero Page
  // --------------------------------------------------------------------------

  describe('storeZeroToAddress — zero page', () => {
    it('65C02 emits single STZ instruction for zero page', () => {
      gen65c02.testStoreZeroToAddress(0x10, true);

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('STZ');
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPage);
      expect(instrs[0].operand).toBe(0x10);
    });

    it('6502 emits LDA #0 + STA for zero page', () => {
      gen6502.testStoreZeroToAddress(0x10, true);

      const instrs = getInstructions(gen6502.getElements());
      expect(instrs).toHaveLength(2);
      expect(instrs[0].mnemonic).toBe('LDA');
      expect(instrs[1].mnemonic).toBe('STA');
    });

    it('65C02 produces fewer instructions than 6502 for zero page', () => {
      gen65c02.testStoreZeroToAddress(0x10, true);
      gen6502.testStoreZeroToAddress(0x10, true);

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      expect(count65c02).toBeLessThan(count6502);
    });
  });

  // --------------------------------------------------------------------------
  // STZ Absolute
  // --------------------------------------------------------------------------

  describe('storeZeroToAddress — absolute', () => {
    it('65C02 emits single STZ instruction for absolute address', () => {
      gen65c02.testStoreZeroToAddress(0xD020, false);

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('STZ');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Absolute);
      expect(instrs[0].operand).toBe(0xD020);
    });

    it('6502 emits LDA #0 + STA for absolute address', () => {
      gen6502.testStoreZeroToAddress(0xD020, false);

      const instrs = getInstructions(gen6502.getElements());
      expect(instrs).toHaveLength(2);
      expect(instrs[0].mnemonic).toBe('LDA');
      expect(instrs[1].mnemonic).toBe('STA');
    });

    it('65C02 produces fewer instructions than 6502 for absolute', () => {
      gen65c02.testStoreZeroToAddress(0xD020, false);
      gen6502.testStoreZeroToAddress(0xD020, false);

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      expect(count65c02).toBeLessThan(count6502);
    });
  });

  // --------------------------------------------------------------------------
  // STZ does NOT use LDA (preserves accumulator)
  // --------------------------------------------------------------------------

  describe('STZ preserves accumulator (no LDA emitted)', () => {
    it('65C02 does NOT emit LDA for zero page store', () => {
      gen65c02.testStoreZeroToAddress(0x10, true);

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).not.toContain('LDA');
    });

    it('65C02 does NOT emit LDA for absolute store', () => {
      gen65c02.testStoreZeroToAddress(0xD020, false);

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).not.toContain('LDA');
    });

    it('65C02 does NOT emit STA (uses STZ directly)', () => {
      gen65c02.testStoreZeroToAddress(0x10, true);

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).not.toContain('STA');
    });
  });

  // --------------------------------------------------------------------------
  // Comment passthrough
  // --------------------------------------------------------------------------

  describe('comment passthrough', () => {
    it('65C02 passes comment to STZ instruction', () => {
      gen65c02.testStoreZeroToAddress(0x10, true, 'clear sprite counter');

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs[0].comment).toBe('clear sprite counter');
    });
  });

  // --------------------------------------------------------------------------
  // Accumulator state tracking
  // --------------------------------------------------------------------------

  describe('accumulator state after storeZeroToAddress', () => {
    it('tracks A as immediate 0 after store (conservative for 6502 compat)', () => {
      gen65c02.testStoreZeroToAddress(0x10, true);

      // The helper conservatively sets A = immediate 0
      // (on 6502, LDA #0 loads zero into A; on 65C02, STZ preserves A
      // but we're conservative to support the common 6502 case)
      expect(gen65c02.testAHasImmediate(0)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Various zero page addresses
  // --------------------------------------------------------------------------

  describe('various zero page addresses', () => {
    it('stores zero to address 0x00', () => {
      gen65c02.testStoreZeroToAddress(0x00, true);

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs[0].mnemonic).toBe('STZ');
      expect(instrs[0].operand).toBe(0x00);
    });

    it('stores zero to address 0xFF (max zero page)', () => {
      gen65c02.testStoreZeroToAddress(0xFF, true);

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs[0].mnemonic).toBe('STZ');
      expect(instrs[0].operand).toBe(0xFF);
    });

    it('stores zero to C64 border color register $D020', () => {
      gen65c02.testStoreZeroToAddress(0xD020, false);

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs[0].mnemonic).toBe('STZ');
      expect(instrs[0].operand).toBe(0xD020);
    });

    it('stores zero to C64 background color register $D021', () => {
      gen65c02.testStoreZeroToAddress(0xD021, false);

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs[0].mnemonic).toBe('STZ');
      expect(instrs[0].operand).toBe(0xD021);
    });
  });
});
