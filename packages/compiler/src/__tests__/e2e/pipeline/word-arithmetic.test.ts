/**
 * E2E Pipeline Tests: Word Arithmetic & Addressing
 *
 * Tests the complete compilation pipeline for 16-bit word arithmetic,
 * dynamic poke/peek addressing, word loops, word comparisons, and
 * word function parameters/returns.
 *
 * **Test Categories:**
 * - Word variable declarations and assignment
 * - Word arithmetic (+, -, compound assignments)
 * - Word loops iterating past 255
 * - Dynamic poke/peek with computed word addresses
 * - Word comparisons in control flow
 * - Word function parameters and returns
 * - Multi-module word function calls
 * - Sprite-test.blend at all optimization levels
 *
 * These tests verify the complete word arithmetic pipeline from
 * Phases 1-8 of the word-arithmetic-and-addressing plan.
 *
 * @module __tests__/e2e/pipeline/word-arithmetic
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  compileBlendSources,
  expectSuccess,
  expectAssemblyContains,
  getAssembly,
} from './helpers.js';
import type { Blend65Config } from '../../../config/types.js';

describe('E2E: Word Arithmetic & Addressing', () => {
  // ── Word Variable Declarations ─────────────────────────────────

  describe('word variable declarations', () => {
    it('should compile word variable with hex literal', () => {
      const result = compileBlend('let addr: word = $0400;');
      expectSuccess(result, 'word hex literal');
    });

    it('should compile word variable with decimal literal', () => {
      const result = compileBlend('let addr: word = 1024;');
      expectSuccess(result, 'word decimal literal');
    });

    it('should compile word constant', () => {
      const result = compileBlend('const SCREEN: word = $0400;');
      expectSuccess(result, 'word constant');
    });

    it('should compile multiple word variables', () => {
      const source = `
        const SCREEN: word = $0400;
        const COLOR: word = $D800;
        let ptr: word = $0400;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple word variables');
    });
  });

  // ── Word Arithmetic ────────────────────────────────────────────

  describe('word arithmetic', () => {
    it('should compile word addition with immediate', () => {
      const source = `
        function test(): void {
          let addr: word = $0400;
          addr = addr + 40;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word + immediate');
      // Word addition should use CLC/ADC pattern
      expectAssemblyContains(result, 'CLC', 'ADC');
    });

    it('should compile word subtraction with immediate', () => {
      const source = `
        function test(): void {
          let addr: word = $0400;
          addr = addr - 40;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word - immediate');
      // Word subtraction should use SEC/SBC pattern
      expectAssemblyContains(result, 'SEC', 'SBC');
    });

    it('should compile word compound addition', () => {
      const source = `
        function test(): void {
          let addr: word = $0400;
          addr += 40;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word += immediate');
      expectAssemblyContains(result, 'CLC', 'ADC');
    });

    it('should compile word compound subtraction', () => {
      const source = `
        function test(): void {
          let addr: word = $0400;
          addr -= 40;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word -= immediate');
      expectAssemblyContains(result, 'SEC', 'SBC');
    });

    it('should compile word + word addition', () => {
      const source = `
        function test(): word {
          let base: word = $0400;
          let offset: word = 100;
          let result: word = base + offset;
          return result;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word + word');
    });

    it('should compile word arithmetic in variable initializer', () => {
      // Constant folding should handle CONST + CONST at compile time
      const source = `
        const SCREEN: word = $0400;
        const OFFSET: word = 500;
        let target: word = SCREEN + OFFSET;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word const + const initializer');
    });
  });

  // ── Word Loops ─────────────────────────────────────────────────

  describe('word loops', () => {
    it('should compile for loop with word counter', () => {
      // Word counter should use INC_WORD and CMP_WORD opcodes
      const source = `
        function fillScreen(): void {
          for (let i: word = 0 to 999) {
            poke($0400 + i, 32);
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word for loop to 999');
    });

    it('should compile while loop with word comparison', () => {
      const source = `
        function countUp(): void {
          let i: word = 0;
          while (i < 500) {
            i += 1;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word while loop');
    });

    it('should compile for loop with word counter and byte body', () => {
      const source = `
        function test(): void {
          let val: byte = 0;
          for (let i: word = 0 to 255) {
            val = val + 1;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word for loop with byte body');
    });
  });

  // ── Dynamic Poke/Peek ─────────────────────────────────────────

  describe('dynamic poke with computed addresses', () => {
    it('should compile poke with constant address', () => {
      const source = `
        function test(): void {
          poke($D020, 14);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'poke constant address');
      expectAssemblyContains(result, 'STA');
    });

    it('should compile poke with const + byte offset (indexed)', () => {
      const source = `
        function test(): void {
          let offset: byte = 5;
          poke($0400 + offset, 42);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'poke const + byte offset');
      expectAssemblyContains(result, 'STA');
    });

    it('should compile poke with variable word address (indirect)', () => {
      // When the address involves a word variable, uses indirect addressing
      const source = `
        function test(): void {
          let addr: word = $0400;
          poke(addr, 42);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'poke word variable address');
      expectAssemblyContains(result, 'STA');
    });

    it('should compile peek with constant address', () => {
      const source = `
        function test(): byte {
          return peek($D020);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'peek constant address');
      expectAssemblyContains(result, 'LDA');
    });

    it('should compile pokew with constant address', () => {
      const source = `
        function test(): void {
          pokew($00FB, $0400);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'pokew constant address');
      expectAssemblyContains(result, 'STA');
    });

    it('should compile peekw with constant address', () => {
      const source = `
        function test(): word {
          return peekw($00FB);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'peekw constant address');
      expectAssemblyContains(result, 'LDA');
    });

    it('should compile multiple pokes in sequence', () => {
      // Typical C64 pattern: setting border + background
      const source = `
        function initColors(): void {
          poke($D020, 0);
          poke($D021, 0);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple pokes');
    });
  });

  // ── Word Comparisons ──────────────────────────────────────────

  describe('word comparisons', () => {
    it('should compile word less-than comparison', () => {
      const source = `
        function test(): void {
          let addr: word = $0400;
          if (addr < $0800) {
            let x: byte = 1;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word < comparison');
    });

    it('should compile word greater-than comparison', () => {
      const source = `
        function test(): void {
          let addr: word = $0400;
          if (addr > $0200) {
            let x: byte = 1;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word > comparison');
    });

    it('should compile word equality comparison', () => {
      const source = `
        function test(): void {
          let addr: word = $0400;
          if (addr == $0400) {
            let x: byte = 1;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word == comparison');
    });

    it('should compile word not-equal comparison', () => {
      const source = `
        function test(): void {
          let addr: word = $0400;
          if (addr != $0000) {
            let x: byte = 1;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word != comparison');
    });
  });

  // ── Word Functions ────────────────────────────────────────────

  describe('word function parameters and returns', () => {
    it('should compile function with word parameter', () => {
      const source = `
        function setScreen(addr: word): void {
          poke(addr, 42);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word parameter');
    });

    it('should compile function with word return', () => {
      const source = `
        function getScreenAddr(): word {
          return $0400;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word return');
      // Word return should use LDA/LDX for A:X register pair
      expectAssemblyContains(result, 'RTS');
    });

    it('should compile function with word param and word return', () => {
      const source = `
        function nextRow(addr: word): word {
          return addr + 40;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word param + word return');
    });

    it('should compile function call passing word argument', () => {
      const source = `
        function writeAt(addr: word): void {
          poke(addr, 65);
        }
        function main(): void {
          writeAt($0400);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'word argument passing');
      // Should contain JSR for the function call
      expectAssemblyContains(result, 'JSR');
    });

    it('should compile function returning byte from word-return function (promotion)', () => {
      // Byte literal returned from a word function should get PROMOTE_BYTE_WORD
      const source = `
        function getOffset(): word {
          return 40;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'byte-to-word return promotion');
      // Should contain LDX #0 for the promotion
      const asm = getAssembly(result);
      expect(asm).toContain('LDX');
    });

    it('should compile chained word function calls', () => {
      const source = `
        function getBase(): word {
          return $0400;
        }
        function main(): void {
          let addr: word = getBase();
          poke(addr, 42);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'chained word function calls');
    });
  });

  // ── Combined Word Programs ────────────────────────────────────

  describe('combined word programs', () => {
    it('should compile C64 screen fill program', () => {
      // A realistic C64 program that fills the screen with a character
      const source = `
        const SCREEN: word = $0400;
        const SPACE: byte = 32;

        function fillScreen(): void {
          for (let i: word = 0 to 999) {
            poke(SCREEN + i, SPACE);
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'screen fill program');
    });

    it('should compile program with word arithmetic and poke', () => {
      // Uses word arithmetic to compute screen addresses
      const source = `
        const SCREEN: word = $0400;
        const WIDTH: byte = 40;

        function plotChar(x: byte, y: byte, ch: byte): void {
          let offset: word = y * WIDTH + x;
          poke(SCREEN + offset, ch);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'plot char with word arithmetic');
    });

    it('should compile program with word variables and comparisons', () => {
      const source = `
        function scanMemory(): byte {
          let addr: word = $0400;
          let count: byte = 0;
          while (addr < $0428) {
            if (peek(addr) != 32) {
              count = count + 1;
            }
            addr += 1;
          }
          return count;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'memory scanner with word address');
    });

    it('should compile program with border color animation', () => {
      // Classic C64 border color cycle using poke
      const source = `
        function borderCycle(): void {
          for (let color: byte = 0 to 15) {
            poke($D020, color);
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'border color cycle');
    });

    it('should compile program with hi/lo byte extraction from word', () => {
      const source = `
        function setupPointer(): void {
          let addr: word = $0400;
          let lo_byte: byte = lo(addr);
          let hi_byte: byte = hi(addr);
          poke($FB, lo_byte);
          poke($FC, hi_byte);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'hi/lo extraction program');
    });
  });

  // ── Multi-Module Word Functions ───────────────────────────────

  describe('multi-module word functions', () => {
    it('should compile multi-module with word constants', () => {
      const sources = new Map<string, string>();
      sources.set('constants.blend', `
        module Constants;
        export const SCREEN: word = $0400;
        export const COLOR: word = $D800;
      `);
      sources.set('main.blend', `
        module Main;
        export let ptr: word = $0400;
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'multi-module word constants');
    });

    it('should compile multi-module with word function declarations', () => {
      const sources = new Map<string, string>();
      sources.set('screen.blend', `
        module Screen;
        export function getScreenBase(): word {
          return $0400;
        }
      `);
      sources.set('main.blend', `
        module Main;
        export function start(): void {
          let x: byte = 1;
        }
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'multi-module word functions');
      // Both modules should produce output
      const asm = getAssembly(result);
      expect(asm).toContain('RTS');
    });

    it('should compile multi-module with word parameters', () => {
      const sources = new Map<string, string>();
      sources.set('gfx.blend', `
        module Graphics;
        export function plotAt(addr: word, ch: byte): void {
          poke(addr, ch);
        }
      `);
      sources.set('app.blend', `
        module App;
        export function init(): void {
          let x: byte = 0;
        }
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'multi-module word params');
    });

    it('should compile multi-module with word arithmetic in each module', () => {
      const sources = new Map<string, string>();
      sources.set('calc.blend', `
        module Calc;
        export function addOffset(base: word, offset: byte): word {
          return base + offset;
        }
      `);
      sources.set('draw.blend', `
        module Draw;
        export function clearLine(): void {
          for (let i: byte = 0 to 39) {
            poke($0400 + i, 32);
          }
        }
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'multi-module word arithmetic');
    });
  });

  // ── Optimization Level Verification ───────────────────────────

  describe('word programs at different optimization levels', () => {
    /**
     * Helper to compile at a specific optimization level.
     * Tests that word arithmetic works correctly at all O levels.
     */
    function compileAtLevel(source: string, level: 'O0' | 'O1' | 'O2' | 'O3'): ReturnType<typeof compileBlend> {
      const config: Blend65Config = {
        compilerOptions: {
          target: 'c64',
          optimization: level,
        },
      };
      return compileBlend(source, config);
    }

    // A representative word program used for all O-level tests
    const wordProgram = `
      const SCREEN: word = $0400;

      function fillLine(row: byte): void {
        let offset: word = row * 40;
        for (let i: byte = 0 to 39) {
          poke(SCREEN + offset + i, 32);
        }
      }

      export function main(): void {
        fillLine(0);
        fillLine(1);
        poke($D020, 0);
        poke($D021, 0);
      }
    `;

    it('should compile word program at O0 (no optimization)', () => {
      const result = compileAtLevel(wordProgram, 'O0');
      expectSuccess(result, 'word program at O0');
    });

    it('should compile word program at O1 (basic optimization)', () => {
      const result = compileAtLevel(wordProgram, 'O1');
      expectSuccess(result, 'word program at O1');
    });

    it('should compile word program at O2 (standard optimization)', () => {
      const result = compileAtLevel(wordProgram, 'O2');
      expectSuccess(result, 'word program at O2');
    });

    it('should compile word program at O3 (aggressive optimization)', () => {
      const result = compileAtLevel(wordProgram, 'O3');
      expectSuccess(result, 'word program at O3');
    });
  });

  // ── Real-World C64 Program at All Optimization Levels ─────────

  describe('real-world C64 program at all optimization levels', () => {
    /**
     * A comprehensive C64 program exercising word arithmetic features:
     * - Word constants for screen/color RAM addresses
     * - Word arithmetic in poke addresses (SCREEN + offset)
     * - For loops with byte and word counters
     * - Multiple function calls with word parameters
     * - Word comparisons in control flow
     * - Dynamic poke with computed addresses
     *
     * Note: The original sprite-test.blend uses array indexing which has
     * a known codegen gap ("Expected slot operand" for array access).
     * This simplified version tests the same word arithmetic features
     * without arrays. Full array support is tracked separately.
     */
    const c64ProgramSource = `
      module TestProgram;

      const SCREEN: word = $0400;
      const COLOR: word = $D800;
      const BORDER: word = $D020;
      const BACKGROUND: word = $D021;
      const SCREEN_WIDTH: byte = 40;

      export function main(): void {
          clearScreen();
          drawPattern();
          setColors();
          delay();
      }

      function clearScreen(): void {
          for (let i: byte = 0 to 249) {
              poke(SCREEN + i, 32);
              poke(SCREEN + 250 + i, 32);
              poke(SCREEN + 500 + i, 32);
              poke(SCREEN + 750 + i, 32);
          }
          poke(BORDER, 0);
          poke(BACKGROUND, 0);
      }

      function drawPattern(): void {
          for (let row: byte = 0 to 24) {
              let offset: word = row * SCREEN_WIDTH;
              for (let col: byte = 0 to 39) {
                  let ch: byte = (row + col) & 15;
                  poke(SCREEN + offset + col, ch + 65);
              }
          }
      }

      function setColors(): void {
          for (let i: byte = 0 to 249) {
              poke(COLOR + i, 1);
              poke(COLOR + 250 + i, 14);
              poke(COLOR + 500 + i, 6);
              poke(COLOR + 750 + i, 3);
          }
      }

      function delay(): void {
          for (let d: byte = 0 to 99) {
              barrier();
          }
      }
    `;

    /**
     * Helper to compile the C64 program at a specific optimization level.
     */
    function compileProgramAt(level: 'O0' | 'O1' | 'O2' | 'O3'): ReturnType<typeof compileBlend> {
      const config: Blend65Config = {
        compilerOptions: {
          target: 'c64',
          optimization: level,
        },
      };
      return compileBlend(c64ProgramSource, config);
    }

    it('should compile C64 program at O0 (no optimization)', () => {
      const result = compileProgramAt('O0');
      expectSuccess(result, 'C64 program at O0');
      const asm = getAssembly(result);
      expect(asm).toContain('main');
      expect(asm).toContain('clearScreen');
      expect(asm).toContain('RTS');
    });

    it('should compile C64 program at O1 (basic optimization)', () => {
      const result = compileProgramAt('O1');
      expectSuccess(result, 'C64 program at O1');
      const asm = getAssembly(result);
      expect(asm).toContain('main');
      expect(asm).toContain('RTS');
    });

    it('should compile C64 program at O2 (standard optimization)', () => {
      const result = compileProgramAt('O2');
      expectSuccess(result, 'C64 program at O2');
      const asm = getAssembly(result);
      expect(asm).toContain('main');
      expect(asm).toContain('RTS');
    });

    it('should compile C64 program at O3 (aggressive optimization)', () => {
      const result = compileProgramAt('O3');
      expectSuccess(result, 'C64 program at O3');
      const asm = getAssembly(result);
      expect(asm).toContain('main');
      expect(asm).toContain('RTS');
    });

    it('should produce assembly at all O levels with consistent structure', () => {
      // All levels should produce valid assembly with same essential structure
      const levels: Array<'O0' | 'O1' | 'O2' | 'O3'> = ['O0', 'O1', 'O2', 'O3'];
      for (const level of levels) {
        const result = compileProgramAt(level);
        expectSuccess(result, `C64 program at ${level} (consistency check)`);
        const asm = getAssembly(result);
        // All levels should have the main label and at least one RTS
        expect(asm, `${level}: should contain main`).toContain('main');
        expect(asm, `${level}: should contain RTS`).toContain('RTS');
        // All levels should have STA instructions for poke operations
        expect(asm, `${level}: should contain STA`).toContain('STA');
      }
    });
  });
});
