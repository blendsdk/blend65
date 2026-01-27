/**
 * E2E Intrinsics CodeGen Tests
 *
 * Tests for code generation of intrinsic functions:
 * - Memory intrinsics generate correct LDA/STA
 * - CPU intrinsics generate correct instructions
 * - Stack intrinsics generate correct PHA/PLA/PHP/PLP
 * - Byte extraction generates correct code
 * - Compile-time intrinsics generate constants
 *
 * @module e2e/intrinsics-codegen
 */

import { describe, it, expect } from 'vitest';

import {
  compile,
  compileToAsm,
  expectAsmContains,
  expectAsmNotContains,
  expectAsmInstruction,
  countAsmOccurrences,
} from './helpers/index.js';

// =============================================================================
// Memory Intrinsics CodeGen
// =============================================================================

describe('E2E Intrinsics CodeGen - Memory', () => {
  describe('peek() generates LDA', () => {
    it('generates LDA absolute for constant address', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return peek($D020);
        }
      `);
      // Should generate LDA $D020 (absolute addressing)
      expectAsmContains(asm, 'LDA $D020');
    });

    it('generates LDA for VIC-II register read', () => {
      const asm = compileToAsm(`
        function getRaster(): byte {
          return peek($D012);
        }
      `);
      expectAsmContains(asm, 'LDA $D012');
    });

    it('generates LDA for CIA register read', () => {
      const asm = compileToAsm(`
        function getJoystick(): byte {
          return peek($DC00);
        }
      `);
      expectAsmContains(asm, 'LDA $DC00');
    });

    it('generates LDA for SID register read', () => {
      const asm = compileToAsm(`
        function getPotX(): byte {
          return peek($D419);
        }
      `);
      expectAsmContains(asm, 'LDA $D419');
    });
  });

  describe('poke() generates STA', () => {
    it('generates STA absolute for constant address', () => {
      const asm = compileToAsm(`
        function test(): void {
          poke($D020, 0);
        }
      `);
      // Should generate STA $D020 (absolute addressing)
      expectAsmContains(asm, 'STA $D020');
    });

    it('generates LDA then STA for poke with value', () => {
      const asm = compileToAsm(`
        function test(): void {
          poke($D020, 5);
        }
      `);
      expectAsmContains(asm, 'LDA #$05');
      expectAsmContains(asm, 'STA $D020');
    });

    it('generates STA for multiple pokes', () => {
      const asm = compileToAsm(`
        function test(): void {
          poke($D020, 0);
          poke($D021, 0);
        }
      `);
      expectAsmContains(asm, 'STA $D020');
      expectAsmContains(asm, 'STA $D021');
    });
  });

  describe('peekw() generates word read', () => {
    it('generates two LDA instructions for word read', () => {
      const asm = compileToAsm(`
        function test(): word {
          return peekw($FFFA);
        }
      `);
      // Should have LDA instructions for low and high bytes
      const ldaCount = countAsmOccurrences(asm, /\bLDA\b/gi);
      expect(ldaCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('pokew() generates word write', () => {
    it('generates two STA instructions for word write', () => {
      const asm = compileToAsm(`
        function test(): void {
          pokew($FFFA, $1000);
        }
      `);
      // Should have STA instructions for low and high bytes
      const staCount = countAsmOccurrences(asm, /\bSTA\b/gi);
      expect(staCount).toBeGreaterThanOrEqual(2);
    });
  });
});

// =============================================================================
// CPU Control Intrinsics CodeGen
// =============================================================================

describe('E2E Intrinsics CodeGen - CPU Control', () => {
  describe('sei() generates SEI', () => {
    it('generates SEI instruction', () => {
      const asm = compileToAsm(`
        function test(): void {
          sei();
        }
      `);
      expectAsmInstruction(asm, 'SEI');
    });
  });

  describe('cli() generates CLI', () => {
    it('generates CLI instruction', () => {
      const asm = compileToAsm(`
        function test(): void {
          cli();
        }
      `);
      expectAsmInstruction(asm, 'CLI');
    });
  });

  describe('nop() generates NOP', () => {
    it('generates NOP instruction', () => {
      const asm = compileToAsm(`
        function test(): void {
          nop();
        }
      `);
      expectAsmInstruction(asm, 'NOP');
    });

    it('generates multiple NOPs', () => {
      const asm = compileToAsm(`
        function delay(): void {
          nop();
          nop();
          nop();
          nop();
        }
      `);
      const nopCount = countAsmOccurrences(asm, /\bNOP\b/gi);
      expect(nopCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('brk() generates BRK', () => {
    it('generates BRK instruction', () => {
      const asm = compileToAsm(`
        function test(): void {
          brk();
        }
      `);
      expectAsmInstruction(asm, 'BRK');
    });
  });

  describe('sei/cli pattern', () => {
    it('generates correct interrupt disable/enable sequence', () => {
      const asm = compileToAsm(`
        function criticalSection(): void {
          sei();
          poke($D020, 1);
          cli();
        }
      `);
      expectAsmInstruction(asm, 'SEI');
      expectAsmInstruction(asm, 'CLI');
      expectAsmContains(asm, 'STA $D020');
    });
  });
});

// =============================================================================
// Stack Operation Intrinsics CodeGen
// =============================================================================

describe('E2E Intrinsics CodeGen - Stack Operations', () => {
  describe('pha() generates PHA', () => {
    it('generates PHA instruction', () => {
      const asm = compileToAsm(`
        function test(): void {
          pha();
        }
      `);
      expectAsmInstruction(asm, 'PHA');
    });
  });

  describe('pla() generates PLA', () => {
    it('generates PLA instruction', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return pla();
        }
      `);
      expectAsmInstruction(asm, 'PLA');
    });
  });

  describe('php() generates PHP', () => {
    it('generates PHP instruction', () => {
      const asm = compileToAsm(`
        function test(): void {
          php();
        }
      `);
      expectAsmInstruction(asm, 'PHP');
    });
  });

  describe('plp() generates PLP', () => {
    it('generates PLP instruction', () => {
      const asm = compileToAsm(`
        function test(): void {
          plp();
        }
      `);
      expectAsmInstruction(asm, 'PLP');
    });
  });

  describe('pha/pla pattern', () => {
    it('generates correct accumulator save/restore', () => {
      const asm = compileToAsm(`
        function test(): void {
          pha();
          poke($D020, 1);
          pla();
        }
      `);
      expectAsmInstruction(asm, 'PHA');
      expectAsmInstruction(asm, 'PLA');
    });
  });

  describe('php/plp pattern', () => {
    it('generates correct flags save/restore', () => {
      const asm = compileToAsm(`
        function test(): void {
          php();
          sei();
          poke($D020, 1);
          plp();
        }
      `);
      expectAsmInstruction(asm, 'PHP');
      expectAsmInstruction(asm, 'PLP');
      expectAsmInstruction(asm, 'SEI');
    });
  });
});

// =============================================================================
// Byte Extraction Intrinsics CodeGen
// =============================================================================

describe('E2E Intrinsics CodeGen - Byte Extraction', () => {
  describe('lo() extracts low byte', () => {
    it('generates low byte extraction for constant', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return lo($1234);
        }
      `);
      // lo($1234) = $34
      expectAsmContains(asm, 'LDA #$34');
    });

    it('generates low byte extraction for variable', () => {
      const result = compile(`
        let addr: word = $1234;
        function test(): byte {
          return lo(addr);
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('hi() extracts high byte', () => {
    it('generates high byte extraction for constant', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return hi($1234);
        }
      `);
      // hi($1234) = $12
      expectAsmContains(asm, 'LDA #$12');
    });

    it('generates high byte extraction for variable', () => {
      const result = compile(`
        let addr: word = $1234;
        function test(): byte {
          return hi(addr);
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('lo/hi together', () => {
    it('extracts both bytes from word', () => {
      const asm = compileToAsm(`
        function getLo(): byte {
          return lo($ABCD);
        }
        
        function getHi(): byte {
          return hi($ABCD);
        }
      `);
      // lo($ABCD) = $CD, hi($ABCD) = $AB
      expectAsmContains(asm, 'LDA #$CD');
      expectAsmContains(asm, 'LDA #$AB');
    });
  });
});

// =============================================================================
// Optimization Control Intrinsics CodeGen
// =============================================================================

describe('E2E Intrinsics CodeGen - Optimization Control', () => {
  describe('barrier()', () => {
    it('compiles barrier between operations', () => {
      const result = compile(`
        function test(): void {
          poke($D020, 0);
          barrier();
          poke($D021, 1);
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('volatile_read() generates LDA', () => {
    it('generates LDA for volatile read', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return volatile_read($D012);
        }
      `);
      expectAsmContains(asm, 'LDA $D012');
    });
  });

  describe('volatile_write() generates STA', () => {
    it('generates STA for volatile write', () => {
      const asm = compileToAsm(`
        function test(): void {
          volatile_write($D020, 0);
        }
      `);
      expectAsmContains(asm, 'STA $D020');
    });
  });
});

// =============================================================================
// Compile-Time Intrinsics CodeGen
// =============================================================================

describe('E2E Intrinsics CodeGen - Compile-Time', () => {
  describe('sizeof() generates constant', () => {
    it('generates LDA #$01 for sizeof(byte)', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return sizeof(byte);
        }
      `);
      // sizeof(byte) = 1
      expectAsmContains(asm, 'LDA #$01');
    });

    it('generates LDA #$02 for sizeof(word)', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return sizeof(word);
        }
      `);
      // sizeof(word) = 2
      expectAsmContains(asm, 'LDA #$02');
    });

    it('generates constant for sizeof(boolean)', () => {
      const asm = compileToAsm(`
        function test(): byte {
          return sizeof(boolean);
        }
      `);
      // sizeof(boolean) = 1
      expectAsmContains(asm, 'LDA #$01');
    });
  });

  describe('length() generates constant', () => {
    it('generates constant for byte array length', () => {
      const asm = compileToAsm(`
        let data: byte[10];
        function test(): word {
          return length(data);
        }
      `);
      // length = 10 = $0A
      expectAsmContains(asm, 'LDA #$0A');
    });

    it('generates constant for word array length', () => {
      const asm = compileToAsm(`
        let values: word[5];
        function test(): word {
          return length(values);
        }
      `);
      // length = 5 = $05
      expectAsmContains(asm, 'LDA #$05');
    });
  });
});

// =============================================================================
// Real-World Intrinsic Patterns
// =============================================================================

describe('E2E Intrinsics CodeGen - Real-World Patterns', () => {
  describe('Raster Wait Pattern', () => {
    it('generates raster polling code', () => {
      const asm = compileToAsm(`
        function waitRaster(line: byte): void {
          while (peek($D012) != line) {
            nop();
          }
        }
      `);
      expectAsmContains(asm, 'LDA $D012');
      expectAsmInstruction(asm, 'NOP');
      expectAsmInstruction(asm, 'CMP');
    });
  });

  describe('Interrupt Handler Setup', () => {
    it('generates interrupt setup code', () => {
      const asm = compileToAsm(`
        function setupIrq(handler: word): void {
          sei();
          pokew($FFFE, handler);
          cli();
        }
      `);
      expectAsmInstruction(asm, 'SEI');
      expectAsmInstruction(asm, 'CLI');
    });
  });

  describe('Hardware Register Access', () => {
    it('generates VIC-II color change', () => {
      const asm = compileToAsm(`
        function flashBorder(): void {
          let color: byte = peek($D020);
          poke($D020, color + 1);
        }
      `);
      expectAsmContains(asm, 'LDA $D020');
      expectAsmContains(asm, 'STA $D020');
    });

    it('generates joystick read', () => {
      const asm = compileToAsm(`
        function readJoystick(): byte {
          return peek($DC00) ^ $FF;
        }
      `);
      expectAsmContains(asm, 'LDA $DC00');
      expectAsmInstruction(asm, 'EOR');
    });
  });

  describe('Timing-Critical Code', () => {
    it('generates stable raster code', () => {
      const asm = compileToAsm(`
        function stableRaster(): void {
          sei();
          while (volatile_read($D012) != 50) {
            nop();
          }
          barrier();
          poke($D020, 1);
          poke($D020, 0);
          cli();
        }
      `);
      expectAsmInstruction(asm, 'SEI');
      expectAsmInstruction(asm, 'CLI');
      expectAsmInstruction(asm, 'NOP');
      expectAsmContains(asm, 'STA $D020');
    });
  });

  describe('Memory Copy Pattern', () => {
    it('generates byte copy code', () => {
      const asm = compileToAsm(`
        function copyByte(src: word, dst: word): void {
          poke(dst, peek(src));
        }
      `);
      // Should have both LDA and STA
      expectAsmInstruction(asm, 'LDA');
      expectAsmInstruction(asm, 'STA');
    });
  });
});

// =============================================================================
// Combined Intrinsic Usage
// =============================================================================

describe('E2E Intrinsics CodeGen - Combined Usage', () => {
  describe('Multiple Intrinsics Together', () => {
    it('generates code for screen initialization', () => {
      const asm = compileToAsm(`
        function initScreen(): void {
          sei();
          poke($D020, 0);
          poke($D021, 0);
          cli();
        }
      `);
      expectAsmInstruction(asm, 'SEI');
      expectAsmContains(asm, 'STA $D020');
      expectAsmContains(asm, 'STA $D021');
      expectAsmInstruction(asm, 'CLI');
    });

    it('generates code for interrupt handler', () => {
      const asm = compileToAsm(`
        function irqHandler(): void {
          pha();
          poke($D020, peek($D020) + 1);
          pla();
        }
      `);
      expectAsmInstruction(asm, 'PHA');
      expectAsmInstruction(asm, 'PLA');
      expectAsmContains(asm, 'LDA $D020');
      expectAsmContains(asm, 'STA $D020');
    });
  });
});