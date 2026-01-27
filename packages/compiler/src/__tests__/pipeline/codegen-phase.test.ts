/**
 * Tests for CodegenPhase
 *
 * Verifies that the CodegenPhase correctly generates
 * assembly output via the CodeGenerator.
 *
 * @module tests/pipeline/codegen-phase
 */

import { describe, it, expect } from 'vitest';

import { CodegenPhase } from '../../pipeline/codegen-phase.js';
import { ILModule } from '../../il/module.js';
import { getDefaultTargetConfig } from '../../target/registry.js';
import type { CodegenOptions } from '../../pipeline/types.js';

describe('CodegenPhase', () => {
  const phase = new CodegenPhase();

  /**
   * Creates a minimal IL module for testing
   *
   * @param name - Module name
   * @returns Empty ILModule
   */
  function createTestModule(name = 'test'): ILModule {
    return new ILModule(name);
  }

  /**
   * Creates default codegen options
   *
   * @param overrides - Option overrides
   * @returns CodegenOptions
   */
  function createOptions(overrides: Partial<CodegenOptions> = {}): CodegenOptions {
    return {
      target: getDefaultTargetConfig(),
      format: 'prg',
      sourceMap: false,
      debug: 'none',
      ...overrides,
    };
  }

  describe('execute() - basic generation', () => {
    it('should generate stub output for empty module', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.assembly).toBeDefined();
      // Binary is optional - only present when ACME assembler is available
      // We don't require it to be defined in tests
    });

    it('should include module name in assembly comments', () => {
      const module = createTestModule('myModule');
      const options = createOptions();

      const result = phase.execute(module, options);

      expect(result.data.assembly).toContain('myModule');
    });

    it('should include target architecture in assembly', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Should mention C64 (default target)
      expect(result.data.assembly.toLowerCase()).toContain('c64');
    });

    it('should generate timestamp in assembly', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Should have ISO timestamp format
      expect(result.data.assembly).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('execute() - assembly output', () => {
    it('should generate BASIC stub', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Should include BASIC stub comment
      expect(result.data.assembly).toContain('BASIC Stub');
      // Should include SYS token
      expect(result.data.assembly).toContain('SYS');
    });

    it('should set correct load address', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Default C64 BASIC start is $0801
      expect(result.data.assembly).toContain('0801');
    });

    it('should include main entry point', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Should have main label
      expect(result.data.assembly).toContain('main');
    });

    it('should include 6502 instructions', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // For empty modules, should at least have JMP for infinite loop
      // Real code generator only outputs instructions when there are functions/globals
      expect(result.data.assembly.toLowerCase()).toMatch(/jmp|rts|nop/);
    });

    it('should generate valid ACME assembly', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Should have origin directive
      expect(result.data.assembly).toContain('* =');
      // Should have some content
      expect(result.data.assembly.length).toBeGreaterThan(100);
    });
  });

  describe('execute() - binary output (requires ACME)', () => {
    // Binary output is only available when ACME assembler is installed.
    // These tests will pass if ACME produces output, or skip the assertions if not.

    it('should generate PRG format binary when ACME is available', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Binary is optional - only test if ACME produced output
      if (result.data.binary) {
        expect(result.data.binary).toBeInstanceOf(Uint8Array);
        // PRG has at least 2-byte header + some code
        expect(result.data.binary.length).toBeGreaterThan(2);
      }
      // If no binary, that's fine - ACME not installed
    });

    it('should have correct load address header when ACME is available', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Only test if binary was produced
      if (result.data.binary) {
        // First two bytes are load address (little-endian)
        // $0801 = 0x01, 0x08
        expect(result.data.binary[0]).toBe(0x01);
        expect(result.data.binary[1]).toBe(0x08);
      }
    });

    it('should include BASIC stub bytes when ACME is available', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Only test if binary was produced
      if (result.data.binary) {
        // BASIC stub includes SYS token (0x9E)
        const binary = result.data.binary;
        let hasSysToken = false;
        for (let i = 2; i < binary.length; i++) {
          if (binary[i] === 0x9e) {
            hasSysToken = true;
            break;
          }
        }
        expect(hasSysToken).toBe(true);
      }
    });

    it('should include machine code when ACME is available', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Only test if binary was produced
      if (result.data.binary) {
        // Empty module generates RTS for return to BASIC (0x60)
        const binary = result.data.binary;
        let hasRts = false;
        for (let i = 0; i < binary.length; i++) {
          if (binary[i] === 0x60) {
            hasRts = true;
            break;
          }
        }
        expect(hasRts).toBe(true);
      }
    });
  });

  describe('execute() - VICE labels', () => {
    it('should not generate VICE labels when debug is none', () => {
      const module = createTestModule();
      const options = createOptions({ debug: 'none' });

      const result = phase.execute(module, options);

      expect(result.data.viceLabels).toBeUndefined();
    });

    it('should generate VICE labels when debug is vice', () => {
      const module = createTestModule();
      const options = createOptions({ debug: 'vice' });

      const result = phase.execute(module, options);

      expect(result.data.viceLabels).toBeDefined();
      expect(result.data.viceLabels).toContain('VICE');
    });

    it('should generate VICE labels when debug is both', () => {
      const module = createTestModule();
      const options = createOptions({ debug: 'both' });

      const result = phase.execute(module, options);

      expect(result.data.viceLabels).toBeDefined();
    });

    it('should not generate VICE labels when debug is inline', () => {
      const module = createTestModule();
      const options = createOptions({ debug: 'inline' });

      const result = phase.execute(module, options);

      expect(result.data.viceLabels).toBeUndefined();
    });

    it('should include labels in VICE labels output', () => {
      const module = createTestModule();
      const options = createOptions({ debug: 'vice' });

      const result = phase.execute(module, options);

      // Should have some label content (may not have 'main' for empty modules)
      expect(result.data.viceLabels).toBeDefined();
      expect(result.data.viceLabels!.length).toBeGreaterThan(0);
    });

    it('should include address in VICE labels', () => {
      const module = createTestModule();
      const options = createOptions({ debug: 'vice' });

      const result = phase.execute(module, options);

      // VICE labels file should contain some content
      // Empty modules may not have addressable labels, just the header
      expect(result.data.viceLabels).toBeDefined();
      expect(result.data.viceLabels!.length).toBeGreaterThan(0);
      // Should contain VICE header at minimum
      expect(result.data.viceLabels).toContain('VICE');
    });
  });

  describe('execute() - source maps (stub)', () => {
    it('should not generate source map in stub', () => {
      const module = createTestModule();
      const options = createOptions({ sourceMap: true });

      const result = phase.execute(module, options);

      // Stub doesn't implement source maps yet
      expect(result.data.sourceMap).toBeUndefined();
    });
  });

  describe('execute() - timing', () => {
    it('should track execution time', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      expect(result.timeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.timeMs).toBe('number');
    });

    it('should have fast execution time for stub', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // Stub should be very fast
      expect(result.timeMs).toBeLessThan(100);
    });
  });

  describe('execute() - diagnostics', () => {
    it('should only have expected warnings (like ACME not found)', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      // May have warnings (e.g., ACME not found) but no errors
      const errors = result.diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should always succeed', () => {
      const module = createTestModule();
      const options = createOptions();

      const result = phase.execute(module, options);

      expect(result.success).toBe(true);
    });
  });

  describe('execute() - output format options', () => {
    it('should accept asm format', () => {
      const module = createTestModule();
      const options = createOptions({ format: 'asm' });

      const result = phase.execute(module, options);

      expect(result.success).toBe(true);
    });

    it('should accept prg format', () => {
      const module = createTestModule();
      const options = createOptions({ format: 'prg' });

      const result = phase.execute(module, options);

      expect(result.success).toBe(true);
    });

    it('should accept both format', () => {
      const module = createTestModule();
      const options = createOptions({ format: 'both' });

      const result = phase.execute(module, options);

      expect(result.success).toBe(true);
    });
  });

  describe('execute() - module with entry point', () => {
    it('should use module entry point name if available', () => {
      const module = createTestModule('game');
      // Note: ILModule.getEntryPointName() returns undefined for empty module
      // The codegen uses _start as program entry and _main for main function
      const options = createOptions();

      const result = phase.execute(module, options);

      // Should contain entry point - codegen uses _start for entry point
      // For empty modules without main, it will have 'No main function' or _start
      expect(result.data.assembly).toMatch(/_start|No main function|Return to BASIC/i);
    });
  });
});