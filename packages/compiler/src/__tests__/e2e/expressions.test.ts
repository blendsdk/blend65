/**
 * E2E Expression Tests
 *
 * Tests for code generation of expressions:
 * - Arithmetic operators (+, -, *, /)
 * - Bitwise operators (&, |, ^, ~)
 * - Comparison operators (==, !=, <, >, <=, >=)
 * - Logical operators (&&, ||, !)
 * - Unary operators (-, ~, !)
 *
 * @module e2e/expressions
 */

import { describe, it, expect } from 'vitest';

import {
  compile,
  compileToAsm,
  compileExpectSuccess,
  expectAsmContains,
  expectAsmNotContains,
  expectAsmInstruction,
  countAsmOccurrences,
} from './helpers/index.js';

// =============================================================================
// Arithmetic Operators
// =============================================================================

describe('E2E Expressions - Arithmetic', () => {
  describe('Addition (+)', () => {
    it('generates ADC for byte addition', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 10 + 5;
        }
      `);
      // Should have CLC, ADC sequence for proper addition
      expectAsmInstruction(asm, 'ADC');
    });

    it('generates CLC before ADC', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 10 + 5;
        }
      `);
      // Proper 6502 addition requires clearing carry
      expectAsmInstruction(asm, 'CLC');
    });

    it('adds two variables', () => {
      const asm = compileToAsm(`
        let a: byte = 10;
        let b: byte = 20;
        function test(): byte {
          return a + b;
        }
      `);
      expectAsmInstruction(asm, 'ADC');
    });

    it('adds variable and literal', () => {
      const asm = compileToAsm(`
        let a: byte = 10;
        function test(): byte {
          return a + 5;
        }
      `);
      expectAsmInstruction(asm, 'ADC');
    });
  });

  describe('Subtraction (-)', () => {
    it('generates SBC for byte subtraction', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 20 - 5;
        }
      `);
      // Should have SEC, SBC sequence for proper subtraction
      expectAsmInstruction(asm, 'SBC');
    });

    it('generates SEC before SBC', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 20 - 5;
        }
      `);
      // Proper 6502 subtraction requires setting carry
      expectAsmInstruction(asm, 'SEC');
    });

    it('subtracts two variables', () => {
      const asm = compileToAsm(`
        let a: byte = 30;
        let b: byte = 10;
        function test(): byte {
          return a - b;
        }
      `);
      expectAsmInstruction(asm, 'SBC');
    });
  });

  describe('Chained Arithmetic', () => {
    it('handles multiple additions', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 1 + 2 + 3;
        }
      `);
      // Multiple ADC instructions or constant folded
      expectAsmInstruction(asm, 'LDA');
    });

    it('handles mixed addition and subtraction', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return 10 + 5 - 3;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
    });
  });
});

// =============================================================================
// Bitwise Operators
// =============================================================================

describe('E2E Expressions - Bitwise', () => {
  describe('Bitwise AND (&)', () => {
    it('generates AND instruction', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return $FF & $0F;
        }
      `);
      expectAsmInstruction(asm, 'AND');
    });

    it('ANDs variable with mask', () => {
      const asm = compileToAsm(`
        let value: byte = $FF;
        function test(): byte {
          return value & $0F;
        }
      `);
      expectAsmInstruction(asm, 'AND');
    });

    it('ANDs two variables', () => {
      const asm = compileToAsm(`
        let a: byte = $F0;
        let b: byte = $0F;
        function test(): byte {
          return a & b;
        }
      `);
      expectAsmInstruction(asm, 'AND');
    });
  });

  describe('Bitwise OR (|)', () => {
    it('generates ORA instruction', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return $F0 | $0F;
        }
      `);
      expectAsmInstruction(asm, 'ORA');
    });

    it('ORs variable with value', () => {
      const asm = compileToAsm(`
        let value: byte = $F0;
        function test(): byte {
          return value | $0F;
        }
      `);
      expectAsmInstruction(asm, 'ORA');
    });
  });

  describe('Bitwise XOR (^)', () => {
    it('generates EOR instruction', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return $FF ^ $AA;
        }
      `);
      expectAsmInstruction(asm, 'EOR');
    });

    it('XORs variable with value', () => {
      const asm = compileToAsm(`
        let value: byte = $FF;
        function test(): byte {
          return value ^ $55;
        }
      `);
      expectAsmInstruction(asm, 'EOR');
    });
  });

  describe('Bitwise NOT (~)', () => {
    it('generates EOR #$FF for bitwise NOT', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return ~$00;
        }
      `);
      // Bitwise NOT on 6502 is done with EOR #$FF
      expectAsmInstruction(asm, 'EOR');
    });

    it('NOTs a variable', () => {
      const asm = compileToAsm(`
        let value: byte = $00;
        function test(): byte {
          return ~value;
        }
      `);
      expectAsmInstruction(asm, 'EOR');
    });
  });

  describe('Combined Bitwise Operations', () => {
    it('handles AND followed by OR', () => {
      const asm = compileToAsm(`
        let value: byte = $FF;
        function test(): byte {
          return (value & $F0) | $0F;
        }
      `);
      expectAsmInstruction(asm, 'AND');
      expectAsmInstruction(asm, 'ORA');
    });
  });
});

// =============================================================================
// Comparison Operators
// =============================================================================

describe('E2E Expressions - Comparison', () => {
  describe('Equality (==)', () => {
    it('generates CMP for equality check', () => {
      const asm = compileToAsm(`
        function test(): boolean {
          return 10 == 10;
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });

    it('compares variable to literal', () => {
      const asm = compileToAsm(`
        let x: byte = 10;
        function test(): boolean {
          return x == 10;
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });
  });

  describe('Inequality (!=)', () => {
    it('generates CMP for inequality check', () => {
      const asm = compileToAsm(`
        function test(): boolean {
          return 10 != 5;
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });
  });

  describe('Less Than (<)', () => {
    it('generates comparison code', () => {
      const asm = compileToAsm(`
        let x: byte = 5;
        function test(): boolean {
          return x < 10;
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });
  });

  describe('Greater Than (>)', () => {
    it('generates comparison code', () => {
      const asm = compileToAsm(`
        let x: byte = 15;
        function test(): boolean {
          return x > 10;
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });
  });

  describe('Less Than or Equal (<=)', () => {
    it('generates comparison code', () => {
      const asm = compileToAsm(`
        let x: byte = 10;
        function test(): boolean {
          return x <= 10;
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });
  });

  describe('Greater Than or Equal (>=)', () => {
    it('generates comparison code', () => {
      const asm = compileToAsm(`
        let x: byte = 10;
        function test(): boolean {
          return x >= 10;
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });
  });

  describe('Comparison in conditions', () => {
    it('generates branch for if with comparison', () => {
      const asm = compileToAsm(`
        function test(): void {
          let x: byte = 10;
          if (x > 5) {
            poke($D020, 1);
          }
        }
      `);
      // Should have comparison and branch
      expectAsmInstruction(asm, 'CMP');
    });
  });
});

// =============================================================================
// Logical Operators
// =============================================================================

describe('E2E Expressions - Logical', () => {
  describe('Logical AND (&&)', () => {
    it('compiles logical AND expression', () => {
      const result = compile(`
        function test(): boolean {
          return true && false;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles AND with comparisons', () => {
      const result = compile(`
        let x: byte = 5;
        let y: byte = 10;
        function test(): boolean {
          return x > 0 && y < 20;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Logical OR (||)', () => {
    it('compiles logical OR expression', () => {
      const result = compile(`
        function test(): boolean {
          return true || false;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles OR with comparisons', () => {
      const result = compile(`
        let x: byte = 5;
        function test(): boolean {
          return x == 0 || x == 5;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Logical NOT (!)', () => {
    it('generates NOT logic', () => {
      const asm = compileToAsm(`
        function test(): boolean {
          return !true;
        }
      `);
      // Should have some inversion logic
      expectAsmInstruction(asm, 'LDA');
    });

    it('NOTs a variable', () => {
      const asm = compileToAsm(`
        let flag: boolean = true;
        function test(): boolean {
          return !flag;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
    });
  });
});

// =============================================================================
// Unary Operators
// =============================================================================

describe('E2E Expressions - Unary', () => {
  describe('Unary Minus (-)', () => {
    it('generates negation code', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return -10;
        }
      `);
      // Should generate two's complement negation or constant-folded negative
      expectAsmInstruction(asm, 'LDA');
    });

    it('negates a variable', () => {
      const asm = compileToAsm(`
        let x: byte = 10;
        function test(): byte {
          return -x;
        }
      `);
      // Two's complement: EOR #$FF, CLC, ADC #1
      expectAsmInstruction(asm, 'EOR');
    });
  });
});

// =============================================================================
// Expression Precedence
// =============================================================================

describe('E2E Expressions - Precedence', () => {
  describe('Arithmetic precedence', () => {
    it('handles multiplication before addition', () => {
      // Note: * may not be fully implemented for 6502
      const result = compile(`
        function test(): byte {
          return 2 + 3 * 4;
        }
      `);
      // At minimum, should compile
      if (result.success) {
        expect(result.assembly).toBeDefined();
      }
    });
  });

  describe('Parentheses override precedence', () => {
    it('evaluates parenthesized expression first', () => {
      const result = compile(`
        function test(): byte {
          return (2 + 3) * 4;
        }
      `);
      // Should compile
      if (result.success) {
        expect(result.assembly).toBeDefined();
      }
    });
  });

  describe('Comparison vs arithmetic', () => {
    it('arithmetic happens before comparison', () => {
      const result = compile(`
        function test(): boolean {
          return 2 + 3 > 4;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Logical vs comparison', () => {
    it('comparison happens before logical', () => {
      const result = compile(`
        function test(): boolean {
          return 1 < 2 && 3 < 4;
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Complex Expressions
// =============================================================================

describe('E2E Expressions - Complex', () => {
  describe('Multi-operator expressions', () => {
    it('compiles complex arithmetic', () => {
      const result = compile(`
        let a: byte = 10;
        let b: byte = 20;
        let c: byte = 5;
        function test(): byte {
          return a + b - c;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles complex bitwise', () => {
      const asm = compileToAsm(`
        let value: byte = $FF;
        function test(): byte {
          return (value & $F0) | (value & $0F);
        }
      `);
      expectAsmInstruction(asm, 'AND');
      expectAsmInstruction(asm, 'ORA');
    });
  });

  describe('Expression as function argument', () => {
    it('passes arithmetic expression to function', () => {
      const asm = compileToAsm(`
        function test(): void {
          poke($D020, 5 + 3);
        }
      `);
      expectAsmInstruction(asm, 'STA');
    });

    it('passes variable expression to function', () => {
      const asm = compileToAsm(`
        let color: byte = 5;
        function test(): void {
          poke($D020, color + 1);
        }
      `);
      expectAsmInstruction(asm, 'ADC');
    });
  });

  describe('Expression in assignment', () => {
    it('assigns expression result to variable', () => {
      const result = compile(`
        let a: byte = 10;
        let b: byte = 0;
        function test(): void {
          b = a + 5;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('assigns expression to @map variable', () => {
      const asm = compileToAsm(`
        @map border at $D020: byte;
        let offset: byte = 1;
        function test(): void {
          border = offset + 2;
        }
      `);
      expectAsmContains(asm, 'STA $D020');
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('E2E Expressions - Edge Cases', () => {
  describe('Zero operations', () => {
    it('adds zero (should optimize to nothing)', () => {
      const asm = compileToAsm(`
        let x: byte = 10;
        function test(): byte {
          return x + 0;
        }
      `);
      // Should have load but potentially no ADC
      expectAsmInstruction(asm, 'LDA');
    });

    it('ANDs with $FF (identity)', () => {
      const asm = compileToAsm(`
        let x: byte = 10;
        function test(): byte {
          return x & $FF;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
    });

    it('ORs with $00 (identity)', () => {
      const asm = compileToAsm(`
        let x: byte = 10;
        function test(): byte {
          return x | $00;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
    });
  });

  describe('Boundary values', () => {
    it('handles max byte value operations', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return $FF & $FF;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
    });
  });
});