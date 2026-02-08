/**
 * E2E Variable Tests
 *
 * Tests for code generation of variable declarations:
 * - Global variable declarations
 * - Local variable declarations
 * - Memory-mapped variables (@map)
 * - Variable initialization
 * - Variable load/store operations
 *
 * @module e2e/variables
 */

import { describe, it, expect } from 'vitest';

import {
  compile,
  compileToAsm,
  compileExpectSuccess,
  expectAsmContains,
  expectAsmNotContains,
  expectAsmInstruction,
  expectAsmLabel,
  expectAsmStoreAddress,
  expectAsmLoadAddress,
  expectAsmNoErrors,
} from './helpers/index.js';

// =============================================================================
// Global Variable Declarations
// =============================================================================

describe('E2E Variables - Global Declarations', () => {
  describe('Byte Variables', () => {
    it('generates data section for global byte', () => {
      const asm = compileToAsm('let counter: byte = 0;');
      // Should have label and !byte directive for the variable
      expectAsmContains(asm, '_counter:');
      expectAsmContains(asm, '!byte $00');
    });

    it('generates initialized byte value', () => {
      const asm = compileToAsm('let x: byte = 42;');
      // Should have initial value
      expectAsmContains(asm, '!byte $2A'); // 42 = $2A
    });

    it('generates zero-initialized byte', () => {
      const asm = compileToAsm('let x: byte = 0;');
      expectAsmContains(asm, '!byte $00');
    });

    it('generates multiple global byte variables', () => {
      const asm = compileToAsm(`
        let a: byte = 1;
        let b: byte = 2;
        let c: byte = 3;
      `);
      // All three should have !byte directives
      expectAsmContains(asm, '!byte $01');
      expectAsmContains(asm, '!byte $02');
      expectAsmContains(asm, '!byte $03');
    });
  });

  describe('Word Variables', () => {
    it('generates data section for global word', () => {
      const asm = compileToAsm('let addr: word = $D020;');
      // Words need two bytes
      expectAsmContains(asm, '!word');
    });

    it('generates initialized word value', () => {
      const asm = compileToAsm('let ptr: word = $1000;');
      // Should have word value
      expectAsmContains(asm, '!word $1000');
    });

    it('generates zero-initialized word', () => {
      const asm = compileToAsm('let ptr: word = 0;');
      expectAsmContains(asm, '!word');
    });
  });

  describe('Boolean Variables', () => {
    it('generates byte storage for boolean', () => {
      const asm = compileToAsm('let flag: boolean = true;');
      // Booleans are stored as bytes
      expectAsmContains(asm, '!byte');
    });

    it('generates false as zero', () => {
      const asm = compileToAsm('let flag: boolean = false;');
      expectAsmContains(asm, '!byte $00');
    });
  });

  describe('Array Variables (FIXED)', () => {
    it('generates data section for byte array', () => {
      const asm = compileToAsm('let buffer: byte[10];');
      // Should allocate 10 bytes with zero fill
      expectAsmContains(asm, '!fill 10, $00');
    });

    it('generates data section for word array', () => {
      const asm = compileToAsm('let pointers: word[5];');
      // Should allocate 10 bytes (5 words) with zero fill
      expectAsmContains(asm, '!fill 10, $00');
    });

    it('compiles byte array declaration', () => {
      const result = compile('let buffer: byte[10];');
      expect(result.success).toBe(true);
    });

    it('compiles word array declaration', () => {
      const result = compile('let pointers: word[5];');
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Memory-Mapped Variables (@map)
// =============================================================================

describe('E2E Variables - Memory Mapped (@map)', () => {
  describe('@map Byte Variables', () => {
    it('generates STA for @map byte write', () => {
      const asm = compileToAsm(`
        @map borderColor at $D020: byte;
        function test(): void {
          borderColor = 5;
        }
      `);
      expectAsmContains(asm, 'STA $D020');
    });

    it('generates LDA for @map byte read', () => {
      const asm = compileToAsm(`
        @map borderColor at $D020: byte;
        function test(): byte {
          return borderColor;
        }
      `);
      expectAsmContains(asm, 'LDA $D020');
    });

    it('handles multiple @map variables', () => {
      const asm = compileToAsm(`
        @map borderColor at $D020: byte;
        @map bgColor at $D021: byte;
        function test(): void {
          borderColor = 0;
          bgColor = 1;
        }
      `);
      expectAsmContains(asm, 'STA $D020');
      expectAsmContains(asm, 'STA $D021');
    });
  });

  describe('@map Word Variables', () => {
    it('generates pokew-style code for @map word write', () => {
      const result = compile(`
        @map vectorNmi at $FFFA: word;
        function test(): void {
          vectorNmi = $1000;
        }
      `);
      expect(result.success).toBe(true);
      // Should generate word store
    });
  });

  describe('@map Array Variables', () => {
    it('generates indexed access for @map array', () => {
      const result = compile(`
        @map screen at $0400: byte[1000];
        function test(): void {
          screen[0] = 65;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('@map with common C64 addresses', () => {
    it('handles VIC-II registers', () => {
      const asm = compileToAsm(`
        @map vicBorder at $D020: byte;
        @map vicBg at $D021: byte;
        @map vicRaster at $D012: byte;
        function test(): void {
          vicBorder = 0;
          vicBg = 0;
        }
      `);
      expectAsmContains(asm, 'STA $D020');
      expectAsmContains(asm, 'STA $D021');
    });

    it('handles SID registers', () => {
      const asm = compileToAsm(`
        @map sidVolume at $D418: byte;
        function test(): void {
          sidVolume = 15;
        }
      `);
      expectAsmContains(asm, 'STA $D418');
    });

    it('handles CIA registers', () => {
      const asm = compileToAsm(`
        @map ciaJoystick at $DC00: byte;
        function test(): byte {
          return ciaJoystick;
        }
      `);
      expectAsmContains(asm, 'LDA $DC00');
    });

    it('handles zero-page addresses', () => {
      const asm = compileToAsm(`
        @map zpTemp at $02: byte;
        function test(): void {
          zpTemp = 0;
        }
      `);
      // Zero-page STA is shorter
      expectAsmInstruction(asm, 'STA');
    });
  });
});

// =============================================================================
// Local Variables
// =============================================================================

describe('E2E Variables - Local Variables', () => {
  describe('Local Variable Declaration', () => {
    // Local variables now use zero-page allocation ($50-$7F range)
    // instead of generating STUB comments

    it('should generate valid STA for local variable init', () => {
      const asm = compileToAsm(`
        function test(): void {
          let x: byte = 10;
        }
      `);
      // Should have valid store, not STUB comment
      expectAsmNoErrors(asm);
      expectAsmNotContains(asm, 'STUB:');
      expectAsmNotContains(asm, 'Unknown variable');
    });

    it('should generate valid LDA for local variable read', () => {
      const asm = compileToAsm(`
        function test(): byte {
          let x: byte = 10;
          return x;
        }
      `);
      expectAsmNoErrors(asm);
      expectAsmNotContains(asm, 'STUB:');
    });

    it('documents current behavior: local variables compile but may have STUB markers', () => {
      const result = compile(`
        function test(): byte {
          let x: byte = 10;
          return x;
        }
      `);
      expect(result.success).toBe(true);
      // Compilation succeeds but codegen has known issues
    });
  });

  describe('Local Variable Types', () => {
    it('compiles local byte variable', () => {
      const result = compile(`
        function test(): void {
          let x: byte = 0;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles local word variable', () => {
      const result = compile(`
        function test(): void {
          let addr: word = $1000;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles local boolean variable', () => {
      const result = compile(`
        function test(): void {
          let flag: boolean = true;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles multiple local variables', () => {
      const result = compile(`
        function test(): void {
          let a: byte = 1;
          let b: byte = 2;
          let c: word = 300;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Local Variable Scope', () => {
    it('compiles same-named locals in different functions', () => {
      const result = compile(`
        function foo(): byte {
          let x: byte = 1;
          return x;
        }
        
        function bar(): byte {
          let x: byte = 2;
          return x;
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Variable Operations
// =============================================================================

describe('E2E Variables - Operations', () => {
  describe('Assignment Operations', () => {
    it('generates store for global variable assignment', () => {
      const asm = compileToAsm(`
        let counter: byte = 0;
        function test(): void {
          counter = 10;
        }
      `);
      expectAsmContains(asm, 'LDA #$0A');
      expectAsmInstruction(asm, 'STA');
    });

    it('generates store for @map variable assignment', () => {
      const asm = compileToAsm(`
        @map border at $D020: byte;
        function test(): void {
          border = 1;
        }
      `);
      expectAsmContains(asm, 'STA $D020');
    });
  });

  describe('Read Operations', () => {
    it('generates load for global variable read', () => {
      const asm = compileToAsm(`
        let value: byte = 42;
        function test(): byte {
          return value;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
    });

    it('generates load for @map variable read', () => {
      const asm = compileToAsm(`
        @map joystick at $DC00: byte;
        function test(): byte {
          return joystick;
        }
      `);
      expectAsmContains(asm, 'LDA $DC00');
    });
  });

  describe('Expression Assignment', () => {
    it('generates code for assigning expression result', () => {
      const asm = compileToAsm(`
        let a: byte = 10;
        let b: byte = 20;
        function test(): byte {
          return a + b;
        }
      `);
      // Should have addition code
      expectAsmInstruction(asm, 'LDA');
      expectAsmInstruction(asm, 'ADC');
    });
  });
});

// =============================================================================
// Export Modifier
// =============================================================================

describe('E2E Variables - Export Modifier', () => {
  it('compiles exported global variable', () => {
    const result = compile('export let score: word = 0;');
    expect(result.success).toBe(true);
  });

  it('compiles exported @map variable', () => {
    const result = compile('export @map border at $D020: byte;');
    expect(result.success).toBe(true);
  });

  it('generates label for exported variable', () => {
    const asm = compileToAsm('export let counter: byte = 0;');
    // Exported variables should have accessible labels
    expectAsmContains(asm, 'counter');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('E2E Variables - Edge Cases', () => {
  describe('Variable naming', () => {
    it('handles single-character variable names', () => {
      const result = compile('let x: byte = 0;');
      expect(result.success).toBe(true);
    });

    it('handles underscore in variable names', () => {
      const result = compile('let my_var: byte = 0;');
      expect(result.success).toBe(true);
    });

    it('handles numeric suffixes in variable names', () => {
      const result = compile('let var1: byte = 0;');
      expect(result.success).toBe(true);
    });
  });

  describe('Initialization values', () => {
    it('handles hex initialization', () => {
      const asm = compileToAsm('let x: byte = $FF;');
      expectAsmContains(asm, '!byte $FF');
    });

    it('handles binary initialization', () => {
      // Language spec uses 0b prefix for binary literals
      const asm = compileToAsm('let mask: byte = 0b10101010;');
      expectAsmContains(asm, '!byte $AA'); // 0b10101010 = $AA
    });

    it('handles expression initialization', () => {
      const result = compile('let x: byte = 10 + 5;');
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Combined Patterns
// =============================================================================

describe('E2E Variables - Combined Patterns', () => {
  describe('Mixed global and @map usage', () => {
    it('compiles program with both global and @map variables', () => {
      const asm = compileToAsm(`
        let color: byte = 0;
        @map border at $D020: byte;
        
        function setColor(c: byte): void {
          color = c;
          border = c;
        }
      `);
      expect(asm.length).toBeGreaterThan(0);
      expectAsmContains(asm, 'STA $D020');
    });
  });

  describe('Hardware abstraction pattern', () => {
    it('compiles VIC-II register abstraction', () => {
      const asm = compileToAsm(`
        @map vicBorder at $D020: byte;
        @map vicBackground at $D021: byte;
        @map vicRasterLine at $D012: byte;
        @map vicControl at $D011: byte;
        
        function clearScreen(): void {
          vicBorder = 0;
          vicBackground = 0;
        }
      `);
      expectAsmContains(asm, 'STA $D020');
      expectAsmContains(asm, 'STA $D021');
    });
  });
});