/**
 * Tests for InstructionGenerator - CPU Instructions and Placeholders
 *
 * Tests the CPU instructions that map directly to 6502:
 * - CPU_SEI → SEI
 * - CPU_CLI → CLI
 * - CPU_NOP → NOP
 * - CPU_PHA → PHA
 * - CPU_PLA → PLA
 * - CPU_PHP → PHP
 * - CPU_PLP → PLP
 *
 * Also tests placeholder generation for unsupported instructions.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/instruction-generator-cpu.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InstructionGenerator } from '../../codegen/instruction-generator.js';
import { ILModule } from '../../il/module.js';
import { IL_BYTE, IL_VOID } from '../../il/types.js';
import {
  ILInstruction,
  ILOpcode,
  ILCpuInstruction,
  ILPhiInstruction,
  ILLoadArrayInstruction,
  ILStoreArrayInstruction,
} from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { C64_CONFIG } from '../../target/index.js';
import type { CodegenOptions } from '../../codegen/types.js';

/**
 * Concrete test implementation of InstructionGenerator
 */
class TestInstructionGenerator extends InstructionGenerator {
  public exposeGenerateInstruction(instr: ILInstruction): void {
    this.generateInstruction(instr);
  }

  public exposeGenerateCpuInstruction(instr: ILCpuInstruction): void {
    this.generateCpuInstruction(instr);
  }

  public exposeGeneratePlaceholder(instr: ILInstruction): void {
    this.generatePlaceholder(instr);
  }

  public exposeAssemblyWriter() {
    return this.assemblyWriter;
  }

  public exposeGetStats() {
    return this.getStats();
  }

  public exposeGetWarnings(): string[] {
    return this.getWarnings();
  }

  public setModule(module: ILModule): void {
    this.currentModule = module;
  }

  public setOptions(options: CodegenOptions): void {
    this.options = options;
  }

  public exposeResetState(): void {
    this.resetState();
  }
}

/**
 * Creates standard test options
 */
function createTestOptions(): CodegenOptions {
  return {
    target: C64_CONFIG,
    format: 'prg',
    sourceMap: false,
    debug: 'none',
    loadAddress: 0x0801,
  };
}

/**
 * Creates a virtual register for testing
 */
function createRegister(id: number, name?: string): VirtualRegister {
  return new VirtualRegister(id, IL_BYTE, name);
}

describe('InstructionGenerator - CPU Instructions and Placeholders', () => {
  let generator: TestInstructionGenerator;
  let module: ILModule;

  beforeEach(() => {
    generator = new TestInstructionGenerator();
    module = new ILModule('test.bl65');
    generator.setModule(module);
    generator.setOptions(createTestOptions());
  });

  // ===========================================================================
  // CPU_SEI Instruction Tests
  // ===========================================================================

  describe('generateCpuInstruction() - SEI', () => {
    it('should emit SEI instruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_SEI);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('SEI');
    });

    it('should include comment for SEI', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_SEI);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('Disable interrupts');
    });

    it('should track 1 byte for SEI', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_SEI);

      generator.exposeGenerateCpuInstruction(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(1);
    });
  });

  // ===========================================================================
  // CPU_CLI Instruction Tests
  // ===========================================================================

  describe('generateCpuInstruction() - CLI', () => {
    it('should emit CLI instruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_CLI);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('CLI');
    });

    it('should include comment for CLI', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_CLI);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('Enable interrupts');
    });

    it('should track 1 byte for CLI', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_CLI);

      generator.exposeGenerateCpuInstruction(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(1);
    });
  });

  // ===========================================================================
  // CPU_NOP Instruction Tests
  // ===========================================================================

  describe('generateCpuInstruction() - NOP', () => {
    it('should emit NOP instruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_NOP);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('NOP');
    });

    it('should include comment for NOP', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_NOP);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('No operation');
    });
  });

  // ===========================================================================
  // CPU_PHA Instruction Tests
  // ===========================================================================

  describe('generateCpuInstruction() - PHA', () => {
    it('should emit PHA instruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PHA);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('PHA');
    });

    it('should include comment for PHA', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PHA);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('Push A');
    });

    it('should track 1 byte for PHA', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PHA);

      generator.exposeGenerateCpuInstruction(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(1);
    });
  });

  // ===========================================================================
  // CPU_PLA Instruction Tests
  // ===========================================================================

  describe('generateCpuInstruction() - PLA', () => {
    it('should emit PLA instruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PLA);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('PLA');
    });

    it('should include comment for PLA', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PLA);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('Pull A');
    });

    it('should track 1 byte for PLA', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PLA);

      generator.exposeGenerateCpuInstruction(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(1);
    });
  });

  // ===========================================================================
  // CPU_PHP Instruction Tests
  // ===========================================================================

  describe('generateCpuInstruction() - PHP', () => {
    it('should emit PHP instruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PHP);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('PHP');
    });

    it('should include comment for PHP', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PHP);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('Push status');
    });

    it('should track 1 byte for PHP', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PHP);

      generator.exposeGenerateCpuInstruction(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(1);
    });
  });

  // ===========================================================================
  // CPU_PLP Instruction Tests
  // ===========================================================================

  describe('generateCpuInstruction() - PLP', () => {
    it('should emit PLP instruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PLP);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('PLP');
    });

    it('should include comment for PLP', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PLP);

      generator.exposeGenerateCpuInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('Pull status');
    });

    it('should track 1 byte for PLP', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PLP);

      generator.exposeGenerateCpuInstruction(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(1);
    });
  });

  // ===========================================================================
  // Instruction Dispatch Tests - CPU Instructions
  // ===========================================================================

  describe('generateInstruction() dispatch - CPU', () => {
    it('should dispatch CPU_SEI to generateCpuInstruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_SEI);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('SEI');
    });

    it('should dispatch CPU_CLI to generateCpuInstruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_CLI);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('CLI');
    });

    it('should dispatch CPU_NOP to generateCpuInstruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_NOP);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('NOP');
    });

    it('should dispatch CPU_PHA to generateCpuInstruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PHA);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('PHA');
    });

    it('should dispatch CPU_PLA to generateCpuInstruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PLA);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('PLA');
    });

    it('should dispatch CPU_PHP to generateCpuInstruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PHP);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('PHP');
    });

    it('should dispatch CPU_PLP to generateCpuInstruction', () => {
      const instr = new ILCpuInstruction(0, ILOpcode.CPU_PLP);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('PLP');
    });
  });

  // ===========================================================================
  // Placeholder Generation Tests
  // ===========================================================================

  describe('generatePlaceholder()', () => {
    it('should emit STUB comment for unsupported instruction', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const instr = new ILPhiInstruction(0, [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ], v0);

      generator.exposeGeneratePlaceholder(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STUB');
    });

    it('should emit NOP as placeholder', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const instr = new ILPhiInstruction(0, [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ], v0);

      generator.exposeGeneratePlaceholder(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('NOP');
    });

    it('should add warning for unsupported instruction', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const instr = new ILPhiInstruction(0, [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ], v0);

      generator.exposeGeneratePlaceholder(instr);
      const warnings = generator.exposeGetWarnings();

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.includes('Unsupported'))).toBe(true);
    });
  });

  // ===========================================================================
  // Unsupported Instruction Dispatch Tests
  // ===========================================================================

  describe('generateInstruction() - unsupported', () => {
    it('should dispatch PHI to generatePlaceholder', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const v2 = createRegister(2);
      const instr = new ILPhiInstruction(0, [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ], v2);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STUB');
      expect(output).toContain('NOP');
    });

    it('should dispatch LOAD_ARRAY to generatePlaceholder', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const instr = new ILLoadArrayInstruction(0, 'buffer', v0, v1);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STUB');
    });

    it('should dispatch STORE_ARRAY to generatePlaceholder', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const instr = new ILStoreArrayInstruction(0, 'buffer', v0, v1);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STUB');
    });
  });

  // ===========================================================================
  // Stack Operation Sequence Tests
  // ===========================================================================

  describe('stack operation sequences', () => {
    it('should emit correct PHA/PLA pair', () => {
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(0, ILOpcode.CPU_PHA));
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(1, ILOpcode.CPU_PLA));

      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('PHA');
      expect(output).toContain('PLA');
      // PHA should come before PLA
      expect(output.indexOf('PHA')).toBeLessThan(output.indexOf('PLA'));
    });

    it('should emit correct PHP/PLP pair', () => {
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(0, ILOpcode.CPU_PHP));
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(1, ILOpcode.CPU_PLP));

      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('PHP');
      expect(output).toContain('PLP');
      // PHP should come before PLP
      expect(output.indexOf('PHP')).toBeLessThan(output.indexOf('PLP'));
    });

    it('should accumulate bytes for stack operations', () => {
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(0, ILOpcode.CPU_PHA));
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(1, ILOpcode.CPU_PLA));

      const stats = generator.exposeGetStats();
      expect(stats.codeSize).toBe(2); // 1 + 1
    });
  });

  // ===========================================================================
  // Interrupt Control Sequence Tests
  // ===========================================================================

  describe('interrupt control sequences', () => {
    it('should emit SEI/CLI pair for interrupt-safe section', () => {
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(0, ILOpcode.CPU_SEI));
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(1, ILOpcode.CPU_CLI));

      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('SEI');
      expect(output).toContain('CLI');
      // SEI should come before CLI
      expect(output.indexOf('SEI')).toBeLessThan(output.indexOf('CLI'));
    });

    it('should accumulate bytes for interrupt control', () => {
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(0, ILOpcode.CPU_SEI));
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(1, ILOpcode.CPU_CLI));

      const stats = generator.exposeGetStats();
      expect(stats.codeSize).toBe(2); // 1 + 1
    });
  });

  // ===========================================================================
  // Multiple NOP Sequence Tests
  // ===========================================================================

  describe('NOP sequences', () => {
    it('should emit multiple NOPs for timing', () => {
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(0, ILOpcode.CPU_NOP));
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(1, ILOpcode.CPU_NOP));
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(2, ILOpcode.CPU_NOP));

      const output = generator.exposeAssemblyWriter().toString();
      const nopCount = (output.match(/NOP/g) || []).length;

      expect(nopCount).toBe(3);
    });

    it('should track bytes for multiple NOPs', () => {
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(0, ILOpcode.CPU_NOP));
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(1, ILOpcode.CPU_NOP));
      generator.exposeGenerateCpuInstruction(new ILCpuInstruction(2, ILOpcode.CPU_NOP));

      const stats = generator.exposeGetStats();
      expect(stats.codeSize).toBe(3); // 1 + 1 + 1
    });
  });
});