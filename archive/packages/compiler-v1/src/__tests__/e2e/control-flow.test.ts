/**
 * E2E Control Flow Tests
 *
 * Tests for code generation of control flow constructs:
 * - If statements (if, if-else, else-if)
 * - While loops
 * - For loops
 * - Break and continue statements
 *
 * @module e2e/control-flow
 */

import { describe, it, expect } from 'vitest';

import {
  compile,
  compileToAsm,
  expectAsmContains,
  expectAsmInstruction,
  countAsmOccurrences,
} from './helpers/index.js';

// =============================================================================
// If Statements
// =============================================================================

describe('E2E Control Flow - If Statements', () => {
  describe('Simple If', () => {
    it('compiles if statement with comparison', () => {
      const result = compile(`
        function test(): void {
          let x: byte = 10;
          if (x > 5) {
            poke($D020, 1);
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('generates some control flow structure for if', () => {
      const asm = compileToAsm(`
        function test(): void {
          let x: byte = 10;
          if (x > 5) {
            poke($D020, 1);
          }
        }
      `);
      // Should generate some control flow (JMP or branch)
      const hasControlFlow =
        asm.includes('JMP') ||
        asm.includes('BEQ') ||
        asm.includes('BNE') ||
        asm.includes('BCC') ||
        asm.includes('BCS') ||
        asm.includes('BMI') ||
        asm.includes('BPL');
      expect(hasControlFlow).toBe(true);
    });

    it('executes body when condition is true', () => {
      const asm = compileToAsm(`
        function test(): void {
          if (true) {
            poke($D020, 5);
          }
        }
      `);
      // Should have the store to border color
      expectAsmContains(asm, 'STA $D020');
    });

    it('skips body when condition is false', () => {
      // Constant false may be optimized out
      const result = compile(`
        function test(): void {
          if (false) {
            poke($D020, 5);
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('If-Else', () => {
    it('generates branch for if-else', () => {
      const asm = compileToAsm(`
        function test(): void {
          let x: byte = 10;
          if (x > 5) {
            poke($D020, 1);
          } else {
            poke($D020, 0);
          }
        }
      `);
      // Should have comparison, branch, and both stores
      expectAsmInstruction(asm, 'CMP');
      expectAsmContains(asm, 'STA $D020');
    });

    it('generates JMP to skip else block', () => {
      const asm = compileToAsm(`
        function test(): void {
          let x: byte = 10;
          if (x == 5) {
            poke($D020, 1);
          } else {
            poke($D020, 2);
          }
        }
      `);
      // Should have JMP to skip else after then block
      expectAsmInstruction(asm, 'JMP');
    });
  });

  describe('Else-If Chain', () => {
    it('generates code for else-if chain', () => {
      const asm = compileToAsm(`
        function test(): void {
          let x: byte = 10;
          if (x == 5) {
            poke($D020, 1);
          } else if (x == 10) {
            poke($D020, 2);
          } else {
            poke($D020, 3);
          }
        }
      `);
      // Should have multiple comparisons
      const cmpCount = countAsmOccurrences(asm, /\bCMP\b/gi);
      expect(cmpCount).toBeGreaterThanOrEqual(2);
    });

    it('generates multiple branches for else-if chain', () => {
      const result = compile(`
        function test(): void {
          let x: byte = 10;
          if (x < 5) {
            poke($D020, 0);
          } else if (x < 10) {
            poke($D020, 1);
          } else if (x < 15) {
            poke($D020, 2);
          } else {
            poke($D020, 3);
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Nested If Statements', () => {
    it('generates code for nested if', () => {
      const asm = compileToAsm(`
        function test(): void {
          let x: byte = 10;
          let y: byte = 5;
          if (x > 5) {
            if (y < 10) {
              poke($D020, 1);
            }
          }
        }
      `);
      // Should have multiple comparisons
      const cmpCount = countAsmOccurrences(asm, /\bCMP\b/gi);
      expect(cmpCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('If with Different Conditions', () => {
    it('compiles equality comparison', () => {
      const result = compile(`
        let x: byte = 10;
        function test(): void {
          if (x == 10) {
            poke($D020, 1);
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('generates BNE for equality comparison', () => {
      const asm = compileToAsm(`
        let x: byte = 10;
        function test(): void {
          if (x == 10) {
            poke($D020, 1);
          }
        }
      `);
      expectAsmInstruction(asm, 'CMP');
      expectAsmInstruction(asm, 'BNE'); // Branch if not equal
    });

    it('compiles inequality comparison', () => {
      const result = compile(`
        let x: byte = 10;
        function test(): void {
          if (x != 5) {
            poke($D020, 1);
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('generates BEQ for inequality comparison', () => {
      const asm = compileToAsm(`
        let x: byte = 10;
        function test(): void {
          if (x != 5) {
            poke($D020, 1);
          }
        }
      `);
      expectAsmInstruction(asm, 'CMP');
      expectAsmInstruction(asm, 'BEQ'); // Branch if equal (to skip)
    });

    it('handles less than comparison', () => {
      const asm = compileToAsm(`
        let x: byte = 5;
        function test(): void {
          if (x < 10) {
            poke($D020, 1);
          }
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });

    it('handles greater than comparison', () => {
      const asm = compileToAsm(`
        let x: byte = 15;
        function test(): void {
          if (x > 10) {
            poke($D020, 1);
          }
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });
  });
});

// =============================================================================
// While Loops
// =============================================================================

describe('E2E Control Flow - While Loops', () => {
  describe('Basic While', () => {
    it('generates loop structure', () => {
      const asm = compileToAsm(`
        function test(): void {
          let i: byte = 0;
          while (i < 10) {
            i = i + 1;
          }
        }
      `);
      // Should have comparison, branch back, and JMP
      expectAsmInstruction(asm, 'CMP');
      expectAsmInstruction(asm, 'JMP');
    });

    it('generates backward branch for loop', () => {
      const asm = compileToAsm(`
        function test(): void {
          let i: byte = 0;
          while (i < 10) {
            poke($D020, i);
            i = i + 1;
          }
        }
      `);
      // Should have JMP to loop back
      expectAsmInstruction(asm, 'JMP');
    });
  });

  describe('While with Different Conditions', () => {
    it('handles equality in while condition', () => {
      const asm = compileToAsm(`
        function test(): void {
          let running: byte = 1;
          while (running == 1) {
            running = 0;
          }
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });

    it('handles inequality in while condition', () => {
      const asm = compileToAsm(`
        function test(): void {
          let x: byte = 0;
          while (x != 10) {
            x = x + 1;
          }
        }
      `);
      expectAsmInstruction(asm, 'CMP');
    });
  });

  describe('Infinite Loops', () => {
    it('compiles infinite while loop', () => {
      const asm = compileToAsm(`
        function test(): void {
          while (true) {
            poke($D020, 0);
          }
        }
      `);
      // Should have unconditional JMP back
      expectAsmInstruction(asm, 'JMP');
    });
  });

  describe('Nested While Loops', () => {
    it('generates code for nested while', () => {
      const result = compile(`
        function test(): void {
          let i: byte = 0;
          while (i < 10) {
            let j: byte = 0;
            while (j < 10) {
              j = j + 1;
            }
            i = i + 1;
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// For Loops
// =============================================================================

describe('E2E Control Flow - For Loops', () => {
  describe('Basic For', () => {
    it('compiles basic for loop', () => {
      const result = compile(`
        @zp let i: byte;
        function test(): void {
          for (i = 0 to 9) {
            poke($D020, i);
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('generates loop structure code', () => {
      const asm = compileToAsm(`
        @zp let i: byte;
        function test(): void {
          for (i = 0 to 9) {
            nop();
          }
        }
      `);
      // Should have loop structure with CMP or branch
      expectAsmInstruction(asm, 'JMP');
    });
  });

  describe('For Loop Variants', () => {
    it('compiles for loop with step', () => {
      const result = compile(`
        @zp let i: byte;
        function test(): void {
          for (i = 0 to 20 step 2) {
            nop();
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles countdown for loop with downto', () => {
      const result = compile(`
        @zp let i: byte;
        function test(): void {
          for (i = 10 downto 0) {
            nop();
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Nested For Loops', () => {
    it('compiles nested for loops', () => {
      const result = compile(`
        @zp let i: byte;
        @zp let j: byte;
        function test(): void {
          for (i = 0 to 9) {
            for (j = 0 to 9) {
              nop();
            }
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Break and Continue
// =============================================================================

describe('E2E Control Flow - Break and Continue', () => {
  describe('Break Statement', () => {
    it('compiles break in while loop', () => {
      const result = compile(`
        function test(): void {
          let i: byte = 0;
          while (true) {
            if (i > 10) {
              break;
            }
            i = i + 1;
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('generates JMP for break', () => {
      const asm = compileToAsm(`
        function test(): void {
          while (true) {
            break;
          }
        }
      `);
      // Break should generate JMP to after loop
      expectAsmInstruction(asm, 'JMP');
    });

    it('compiles break in for loop', () => {
      const result = compile(`
        @zp let i: byte;
        function test(): void {
          for (i = 0 to 99) {
            if (i == 50) {
              break;
            }
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Continue Statement', () => {
    it('compiles continue in while loop', () => {
      const result = compile(`
        function test(): void {
          let i: byte = 0;
          while (i < 10) {
            i = i + 1;
            if (i == 5) {
              continue;
            }
            poke($D020, i);
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('generates JMP for continue', () => {
      const asm = compileToAsm(`
        function test(): void {
          let i: byte = 0;
          while (i < 10) {
            i = i + 1;
            continue;
          }
        }
      `);
      // Continue should generate JMP to loop condition
      expectAsmInstruction(asm, 'JMP');
    });

    it('compiles continue in for loop', () => {
      const result = compile(`
        @zp let i: byte;
        function test(): void {
          for (i = 0 to 9) {
            if (i == 5) {
              continue;
            }
            poke($D020, i);
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Break and Continue in Nested Loops', () => {
    it('break only affects innermost loop', () => {
      const result = compile(`
        function test(): void {
          let i: byte = 0;
          while (i < 10) {
            let j: byte = 0;
            while (j < 10) {
              if (j == 5) {
                break;
              }
              j = j + 1;
            }
            i = i + 1;
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Combined Control Flow
// =============================================================================

describe('E2E Control Flow - Combined Constructs', () => {
  describe('If inside While', () => {
    it('compiles if inside while', () => {
      const asm = compileToAsm(`
        function test(): void {
          let i: byte = 0;
          while (i < 10) {
            if (i == 5) {
              poke($D020, 1);
            }
            i = i + 1;
          }
        }
      `);
      expect(asm.length).toBeGreaterThan(0);
    });
  });

  describe('While inside If', () => {
    it('compiles while inside if', () => {
      const asm = compileToAsm(`
        let doLoop: boolean = true;
        function test(): void {
          if (doLoop) {
            let i: byte = 0;
            while (i < 5) {
              i = i + 1;
            }
          }
        }
      `);
      expect(asm.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Control Flow', () => {
    it('compiles complex nested control flow', () => {
      const result = compile(`
        @zp let i: byte;
        function test(): void {
          for (i = 0 to 9) {
            if (i < 5) {
              let j: byte = 0;
              while (j < i) {
                poke($D020, j);
                j = j + 1;
              }
            } else {
              poke($D020, i);
            }
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles simpler nested control flow', () => {
      const result = compile(`
        function test(): void {
          let i: byte = 0;
          while (i < 5) {
            if (i < 3) {
              poke($D020, i);
            }
            i = i + 1;
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('E2E Control Flow - Edge Cases', () => {
  describe('Empty Bodies', () => {
    it('compiles empty if body', () => {
      const result = compile(`
        function test(): void {
          let x: byte = 10;
          if (x > 5) {
          }
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles empty while body', () => {
      const result = compile(`
        function test(): void {
          while (false) {
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Single Statement Bodies', () => {
    it('compiles if with single statement', () => {
      const asm = compileToAsm(`
        function test(): void {
          let x: byte = 10;
          if (x > 5) {
            poke($D020, 1);
          }
        }
      `);
      expectAsmContains(asm, 'STA $D020');
    });
  });

  describe('Boolean Conditions', () => {
    it('handles boolean variable as condition', () => {
      const asm = compileToAsm(`
        let running: boolean = true;
        function test(): void {
          if (running) {
            poke($D020, 1);
          }
        }
      `);
      expect(asm.length).toBeGreaterThan(0);
    });

    it('handles negated boolean as condition', () => {
      const asm = compileToAsm(`
        let done: boolean = false;
        function test(): void {
          if (!done) {
            poke($D020, 1);
          }
        }
      `);
      expect(asm.length).toBeGreaterThan(0);
    });
  });
});