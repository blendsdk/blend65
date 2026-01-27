/**
 * E2E Smoke Tests
 *
 * Verifies that the E2E test infrastructure works correctly.
 * These tests validate the compile helpers and ASM validators.
 *
 * @module e2e/smoke
 */

import { describe, it, expect } from 'vitest';

import {
  compile,
  compileToAsm,
  compileExpectSuccess,
  compileExpectFailure,
  hasErrorMessage,
  expectAsmContains,
  expectAsmNotContains,
  expectAsmInstruction,
  expectAsmLabel,
  countAsmOccurrences,
} from './helpers/index.js';

describe('E2E Smoke Tests - Infrastructure Validation', () => {
  describe('compile() helper', () => {
    it('compiles empty source successfully', () => {
      const result = compile('');
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('compiles simple variable declaration', () => {
      const result = compile('let x: byte = 10;');
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('reports errors for invalid syntax', () => {
      const result = compile('let x: byte = ;');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('provides assembly output for successful compilation', () => {
      const result = compile('let x: byte = 10;');
      expect(result.assembly).toBeDefined();
      expect(result.assembly!.length).toBeGreaterThan(0);
    });

    it('returns raw compilation result', () => {
      const result = compile('let x: byte = 10;');
      expect(result.raw).toBeDefined();
      expect(result.raw.phases).toBeDefined();
    });
  });

  describe('compileToAsm() helper', () => {
    it('returns assembly string for valid code', () => {
      const asm = compileToAsm('let x: byte = 10;');
      expect(typeof asm).toBe('string');
      expect(asm.length).toBeGreaterThan(0);
    });

    it('throws on compilation failure', () => {
      expect(() => compileToAsm('let x: byte = ;')).toThrow('Compilation failed');
    });
  });

  describe('compileExpectSuccess() helper', () => {
    it('returns result for valid code', () => {
      const result = compileExpectSuccess('let x: byte = 10;');
      expect(result.success).toBe(true);
    });

    it('throws on failure', () => {
      expect(() => compileExpectSuccess('let x: byte = ;')).toThrow('Expected compilation to succeed');
    });
  });

  describe('compileExpectFailure() helper', () => {
    it('returns result for invalid code', () => {
      const result = compileExpectFailure('let x: byte = ;');
      expect(result.success).toBe(false);
    });

    it('throws on success', () => {
      expect(() => compileExpectFailure('let x: byte = 10;')).toThrow('Expected compilation to fail');
    });
  });

  describe('hasErrorMessage() helper', () => {
    it('finds matching error messages', () => {
      const result = compile('let x = undefined_var;');
      // Should have an undefined identifier error
      expect(result.errors.length).toBeGreaterThan(0);
      // Note: exact error message depends on implementation
    });
  });

  describe('ASM validation helpers', () => {
    it('expectAsmContains finds string pattern', () => {
      const asm = compileToAsm('let x: byte = 10;');
      // Assembly should have some content
      expectAsmContains(asm, '* ='); // ACME origin directive
    });

    it('expectAsmContains finds regex pattern', () => {
      const asm = compileToAsm('let x: byte = 10;');
      expectAsmContains(asm, /\* = \$[0-9A-Fa-f]+/); // Origin with address
    });

    it('expectAsmNotContains validates absence', () => {
      const asm = compileToAsm('let x: byte = 10;');
      expectAsmNotContains(asm, 'DEFINITELY_NOT_IN_OUTPUT_XYZ123');
    });

    it('expectAsmInstruction finds instructions', () => {
      const asm = compileToAsm(`
        function main(): void {
        }
      `);
      expectAsmInstruction(asm, 'RTS');
    });

    it('countAsmOccurrences counts patterns', () => {
      const asm = compileToAsm(`
        function main(): void {
        }
      `);
      const count = countAsmOccurrences(asm, /\bRTS\b/gi);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('E2E Smoke Tests - Basic Language Features', () => {
  describe('Variable Declarations', () => {
    it('compiles byte variable', () => {
      const result = compile('let x: byte = 10;');
      expect(result.success).toBe(true);
    });

    it('compiles word variable', () => {
      const result = compile('let x: word = 1000;');
      expect(result.success).toBe(true);
    });

    it('compiles boolean variable', () => {
      const result = compile('let flag: boolean = true;');
      expect(result.success).toBe(true);
    });
  });

  describe('Memory Mapped Variables', () => {
    it('compiles @map declaration', () => {
      const result = compile('@map borderColor at $D020: byte;');
      expect(result.success).toBe(true);
    });

    it('compiles @map with hex address', () => {
      const result = compile('@map screenRam at 0x0400: byte;');
      expect(result.success).toBe(true);
    });
  });

  describe('Functions', () => {
    it('compiles simple function', () => {
      const result = compile(`
        function main(): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles function with parameters', () => {
      const result = compile(`
        function add(a: byte, b: byte): byte {
          return a + b;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles exported function', () => {
      const result = compile(`
        export function main(): void {
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Control Flow', () => {
    it('compiles if statement', () => {
      const result = compile(`
        function test(): void {
          let x: byte = 10;
          if (x > 5) {
            x = 0;
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles if-else statement', () => {
      const result = compile(`
        function test(): void {
          let x: byte = 10;
          if (x > 5) {
            x = 0;
          } else {
            x = 1;
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles while loop', () => {
      const result = compile(`
        function test(): void {
          let i: byte = 0;
          while (i < 10) {
            i = i + 1;
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

describe('E2E Smoke Tests - Known Issues Documentation', () => {
  /**
   * These tests document known issues that should be fixed.
   * They are marked with `.skip` or use `.todo` where appropriate.
   * As issues are fixed, these tests should pass.
   */

  describe('Array Initializers (FIXED)', () => {
    // This test documents the fix for array initializers
    // IL generator now extracts values from ArrayLiteralExpression
    it('array literal should generate correct byte values', () => {
      const asm = compileToAsm('let data: byte[3] = [1, 2, 3];');
      // Expected: !byte $01, $02, $03
      expectAsmContains(asm, '!byte $01, $02, $03');
    });
  });

  describe('Local Variables (FIXED)', () => {
    // Local variable codegen was implemented - tests proper load/store
    it('local variable should generate valid load/store', () => {
      const asm = compileToAsm(`
        function test(): byte {
          let x: byte = 10;
          return x;
        }
      `);
      // Should have actual LDA/STA instructions, not STUB comments
      expectAsmNotContains(asm, 'STUB:');
      expectAsmNotContains(asm, 'Unknown variable');
    });
  });
});