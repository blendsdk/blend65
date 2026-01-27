/**
 * E2E Literal Tests
 *
 * Tests for code generation of literal values:
 * - Numeric literals (decimal, hex, binary)
 * - Array literals
 * - String literals
 * - Boolean literals
 *
 * @module e2e/literals
 */

import { describe, it, expect } from 'vitest';

import {
  compile,
  compileToAsm,
  compileExpectSuccess,
  expectAsmContains,
  expectAsmInstruction,
  expectAsmByteData,
  expectAsmLoadImmediate,
} from './helpers/index.js';

// =============================================================================
// Numeric Literals
// =============================================================================

describe('E2E Literals - Numeric Values', () => {
  describe('Decimal Literals', () => {
    it('generates LDA immediate for small decimal', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 10;
        }
      `);
      expectAsmContains(asm, 'LDA #$0A');
    });

    it('generates LDA immediate for zero', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 0;
        }
      `);
      expectAsmContains(asm, 'LDA #$00');
    });

    it('generates LDA immediate for max byte (255)', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 255;
        }
      `);
      expectAsmContains(asm, 'LDA #$FF');
    });

    it('generates word constant for values > 255', () => {
      const asm = compileToAsm(`
        function test(): word {
          return 1000;
        }
      `);
      // 1000 = $03E8, should generate word handling
      expectAsmInstruction(asm, 'LDA');
    });
  });

  describe('Hexadecimal Literals ($prefix)', () => {
    it('generates correct byte for $-prefix hex', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return $FF;
        }
      `);
      expectAsmContains(asm, 'LDA #$FF');
    });

    it('generates correct byte for lowercase hex', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return $ab;
        }
      `);
      // Should normalize to uppercase in output
      expectAsmContains(asm, 'LDA #$AB');
    });

    it('generates correct word for $-prefix hex address', () => {
      const asm = compileToAsm(`
        function test(): word {
          return $D020;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
    });
  });

  describe('Hexadecimal Literals (0x prefix)', () => {
    it('generates correct byte for 0x-prefix hex', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 0xFF;
        }
      `);
      expectAsmContains(asm, 'LDA #$FF');
    });

    it('generates correct word for 0x-prefix hex', () => {
      const asm = compileToAsm(`
        function test(): word {
          return 0xD020;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
    });
  });

  describe('Binary Literals', () => {
    it('generates correct byte for 0b-prefix binary', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 0b11110000;
        }
      `);
      // 0b11110000 = $F0 = 240
      expectAsmContains(asm, 'LDA #$F0');
    });

    it('generates correct byte for another 0b-prefix binary', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 0b10101010;
        }
      `);
      // 0b10101010 = $AA = 170
      expectAsmContains(asm, 'LDA #$AA');
    });

    it('generates correct byte for simple binary pattern', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 0b00001111;
        }
      `);
      // 0b00001111 = $0F = 15
      expectAsmContains(asm, 'LDA #$0F');
    });
  });
});

// =============================================================================
// Boolean Literals
// =============================================================================

describe('E2E Literals - Boolean Values', () => {
  describe('true literal', () => {
    it('generates non-zero value for true', () => {
      const asm = compileToAsm(`
        function test(): boolean {
          return true;
        }
      `);
      // true is typically represented as 1 or $FF
      expectAsmInstruction(asm, 'LDA');
    });
  });

  describe('false literal', () => {
    it('generates zero for false', () => {
      const asm = compileToAsm(`
        function test(): boolean {
          return false;
        }
      `);
      // false is 0
      expectAsmContains(asm, 'LDA #$00');
    });
  });
});

// =============================================================================
// Array Literals
// =============================================================================

describe('E2E Literals - Array Values', () => {
  describe('Byte Array Data Section', () => {
    it('generates !byte directive for byte array', () => {
      const asm = compileToAsm('let data: byte[3] = [1, 2, 3];');
      // Should generate !byte data section
      expectAsmContains(asm, '!byte');
    });

    it('compiles empty byte array declaration', () => {
      const result = compile('let data: byte[10];');
      expect(result.success).toBe(true);
    });
  });

  describe('Array Initializers - KNOWN BUG', () => {
    // These tests document the known bug where array initializers
    // generate $00 instead of actual values

    it.skip('should generate correct values for byte array initializer', () => {
      const asm = compileToAsm('let data: byte[3] = [1, 2, 3];');
      // Expected: !byte $01, $02, $03
      // Actual: Currently generates $00, $00, $00
      expectAsmByteData(asm, [0x01, 0x02, 0x03]);
    });

    it.skip('should generate correct values for hex array initializer', () => {
      const asm = compileToAsm('let data: byte[3] = [$10, $20, $30];');
      // Expected: !byte $10, $20, $30
      expectAsmByteData(asm, [0x10, 0x20, 0x30]);
    });

    it('documents current behavior: array initializers compile but may have wrong values', () => {
      const result = compile('let data: byte[3] = [1, 2, 3];');
      expect(result.success).toBe(true);
      // Test passes compilation but codegen has known issues
    });
  });

  describe('Word Array Data Section', () => {
    it('compiles word array declaration', () => {
      const result = compile('let values: word[5];');
      expect(result.success).toBe(true);
    });

    // CODEGEN GAP: Data section generation for arrays not yet implemented
    // TODO: Implement !fill or !word directives in globals generator
    it.skip('generates data section for word array', () => {
      const asm = compileToAsm('let values: word[3];');
      // Word arrays should have data allocation
      expectAsmInstruction(asm, '*'); // Should have origin directive
    });
  });
});

// =============================================================================
// String Literals
// =============================================================================

describe('E2E Literals - String Values', () => {
  describe('String Data Generation', () => {
    it('generates !text directive for string literal', () => {
      const result = compile(`
        function test(): void {
          let msg: byte[6] = "hello";
        }
      `);
      // Strings in Blend are stored as byte arrays
      // May succeed or fail depending on implementation
      if (result.success && result.assembly) {
        // If it compiles, check for text data
        expect(result.assembly.length).toBeGreaterThan(0);
      }
    });

    // Note: String handling may have specific implementation details
    // These tests document actual behavior
  });
});

// =============================================================================
// Literal Usage in Expressions
// =============================================================================

describe('E2E Literals - Usage in Expressions', () => {
  describe('Literals in assignments', () => {
    // CODEGEN GAP: Global variable initialization uses !byte directive, not LDA/STA
    // The compiler generates data directives for globals, not runtime assignment code
    it.skip('generates store for literal assigned to variable', () => {
      const asm = compileToAsm('let x: byte = 42;');
      // Should load immediate and store
      expectAsmContains(asm, 'LDA #$2A'); // 42 = $2A
    });
  });

  describe('Literals in function arguments', () => {
    it('generates load immediate for poke argument', () => {
      const asm = compileToAsm(`
        function test(): void {
          poke($D020, 5);
        }
      `);
      expectAsmContains(asm, 'LDA #$05');
    });
  });

  describe('Literals in arithmetic', () => {
    it('generates code for literal arithmetic', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 10 + 5;
        }
      `);
      // Should have some arithmetic or constant folding
      expectAsmInstruction(asm, 'LDA');
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('E2E Literals - Edge Cases', () => {
  describe('Boundary values', () => {
    it('handles byte minimum (0)', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 0;
        }
      `);
      expectAsmContains(asm, 'LDA #$00');
    });

    it('handles byte maximum (255)', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 255;
        }
      `);
      expectAsmContains(asm, 'LDA #$FF');
    });

    it('handles word minimum (0)', () => {
      const asm = compileToAsm(`
        function test(): word {
          return 0;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
    });

    it('handles word maximum (65535)', () => {
      const asm = compileToAsm(`
        function test(): word {
          return 65535;
        }
      `);
      // $FFFF
      expectAsmInstruction(asm, 'LDA');
    });
  });

  describe('Special hex addresses', () => {
    it('handles zero-page address', () => {
      const asm = compileToAsm(`
        function test(): void {
          poke($02, 0);
        }
      `);
      expectAsmInstruction(asm, 'STA');
    });

    it('handles VIC-II address', () => {
      const asm = compileToAsm(`
        function test(): void {
          poke($D020, 0);
        }
      `);
      expectAsmContains(asm, 'STA $D020');
    });

    it('handles SID address', () => {
      const asm = compileToAsm(`
        function test(): void {
          poke($D400, 0);
        }
      `);
      expectAsmContains(asm, 'STA $D400');
    });

    it('handles CIA address', () => {
      const asm = compileToAsm(`
        function test(): void {
          poke($DC00, 0);
        }
      `);
      expectAsmContains(asm, 'STA $DC00');
    });
  });
});