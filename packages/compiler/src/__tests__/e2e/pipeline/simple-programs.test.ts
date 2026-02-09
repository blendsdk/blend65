/**
 * E2E Pipeline Tests: Simple Programs
 *
 * Tests the complete compilation pipeline (parse → semantic → frame →
 * IL → optimize → codegen → asmOpt → emit) for simple Blend65 programs.
 *
 * **Test Categories:**
 * - Variable declarations (byte, word, bool)
 * - Arithmetic expressions
 * - Multiple variables
 * - Export functions
 * - Control flow (if/else, while, for)
 * - Function calls
 * - Comparison and logical operators
 *
 * @module __tests__/e2e/pipeline/simple-programs
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  compileBlendSources,
  expectSuccess,
  expectAssemblyContains,
  getAssembly,
} from './helpers.js';

describe('E2E: Simple Programs', () => {
  // ── Variable Declarations ──────────────────────────────────────

  describe('variable declarations', () => {
    it('should compile a byte variable declaration', () => {
      const result = compileBlend('let x: byte = 42;');
      expectSuccess(result, 'byte variable');
    });

    it('should compile a word variable declaration', () => {
      const result = compileBlend('let addr: word = $0400;');
      expectSuccess(result, 'word variable');
    });

    it('should compile a bool variable declaration', () => {
      const result = compileBlend('let flag: bool = true;');
      expectSuccess(result, 'bool variable');
    });

    it('should compile multiple variable declarations', () => {
      const source = `
        let x: byte = 10;
        let y: byte = 20;
        let z: byte = 30;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple variables');
    });

    it('should compile hex literal values', () => {
      const result = compileBlend('let x: byte = $FF;');
      expectSuccess(result, 'hex literal');
    });

    it('should compile binary literal values', () => {
      const result = compileBlend('let x: byte = %10101010;');
      expectSuccess(result, 'binary literal');
    });

    it('should compile const declarations', () => {
      const result = compileBlend('const MAX_SCORE: byte = 100;');
      expectSuccess(result, 'const declaration');
    });

    it('should compile zero-initialized variables', () => {
      const result = compileBlend('let counter: byte = 0;');
      expectSuccess(result, 'zero init');
    });
  });

  // ── Arithmetic Expressions ─────────────────────────────────────

  describe('arithmetic expressions', () => {
    it('should compile addition', () => {
      const source = `
        let a: byte = 10;
        let b: byte = 20;
        let sum: byte = a + b;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'addition');
    });

    it('should compile subtraction', () => {
      const source = `
        let a: byte = 50;
        let b: byte = 20;
        let diff: byte = a - b;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'subtraction');
    });

    it('should compile multiplication', () => {
      const source = `
        let a: byte = 5;
        let b: byte = 3;
        let product: byte = a * b;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiplication');
    });

    it('should compile mixed arithmetic with precedence', () => {
      // 3-variable expression (a + b - c) works through the pipeline —
      // the codegen handles intermediate push/pop for the slot operands correctly
      const source = `
        function calc(): byte {
          let a: byte = 10;
          let b: byte = 5;
          let c: byte = 3;
          let r: byte = a + b - c;
          return r;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'mixed arithmetic with 3 variables');
      // Should contain both ADC (for +) and SBC (for -) instructions
      expectAssemblyContains(result, 'ADC');
      expectAssemblyContains(result, 'SBC');
    });

    it('should compile assignment expressions', () => {
      // Assignments are statements and must be inside function bodies
      const source = `
        function test(): void {
          let x: byte = 10;
          x = x + 5;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'assignment');
    });

    it('should compile compound assignment operators', () => {
      // Compound assignments are statements and must be inside function bodies
      const source = `
        function test(): void {
          let x: byte = 10;
          x += 5;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'compound assignment');
    });
  });

  // ── Bitwise Operations ─────────────────────────────────────────

  describe('bitwise operations', () => {
    it('should compile bitwise AND', () => {
      const source = `
        let x: byte = $FF;
        let masked: byte = x & $0F;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'bitwise AND');
      // AND generates 6502 AND instruction
      expectAssemblyContains(result, 'AND');
    });

    it('should compile bitwise OR', () => {
      const source = `
        let x: byte = $0F;
        let combined: byte = x | $F0;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'bitwise OR');
      // OR generates 6502 ORA instruction
      expectAssemblyContains(result, 'ORA');
    });

    it('should compile bitwise XOR', () => {
      const source = `
        let x: byte = $AA;
        let flipped: byte = x ^ $FF;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'bitwise XOR');
      // XOR generates 6502 EOR instruction
      expectAssemblyContains(result, 'EOR');
    });
  });

  // ── Control Flow ───────────────────────────────────────────────

  describe('control flow', () => {
    it('should compile if statement', () => {
      // Control flow statements must be inside function bodies
      const source = `
        function test(): void {
          let x: byte = 10;
          if (x > 5) {
            let y: byte = 1;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'if statement');
      // Should contain comparison and branch instructions
      const asm = getAssembly(result);
      expect(asm).toMatch(/CMP|BEQ|BNE|BCC|BCS/);
    });

    it('should compile if/else statement', () => {
      // Control flow statements must be inside function bodies
      const source = `
        function test(): void {
          let x: byte = 10;
          let y: byte = 0;
          if (x > 5) {
            y = 1;
          } else {
            y = 2;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'if/else');
      // Should contain a JMP for the else branch
      const asm = getAssembly(result);
      expect(asm).toMatch(/JMP|BEQ|BNE|BCC|BCS/);
    });

    it('should compile while loop', () => {
      // Control flow statements must be inside function bodies
      const source = `
        function test(): void {
          let i: byte = 0;
          while (i < 10) {
            i += 1;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'while loop');
      // Should contain comparison and backward branch
      const asm = getAssembly(result);
      expect(asm).toMatch(/CMP|BEQ|BNE|BCC|BCS|JMP/);
    });

    it('should compile for loop in function', () => {
      // For loops using "for (i = start to end)" syntax work through the full pipeline
      const source = `
        function test(): void {
          for (i = 0 to 10) {
            let x: byte = i;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'for loop');
      // Should contain comparison and backward branch for loop
      const asm = getAssembly(result);
      expect(asm).toMatch(/CMP|BEQ|BNE|BCC|BCS|JMP/);
    });
  });

  // ── Functions ──────────────────────────────────────────────────

  describe('functions', () => {
    it('should compile export function with body', () => {
      const source = `
        export function main(): void {
          let x: byte = 42;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'export function');
      // Should contain a label for the function
      const asm = getAssembly(result);
      expect(asm).toContain('main');
    });

    it('should compile function with parameters', () => {
      const source = `
        function add(a: byte, b: byte): byte {
          return a + b;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'function with params');
    });

    it('should compile function with return value', () => {
      const source = `
        function getMax(): byte {
          return 255;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'function with return');
      // Should contain RTS (return from subroutine)
      expectAssemblyContains(result, 'RTS');
    });

    it('should compile multiple functions', () => {
      const source = `
        function foo(): byte {
          return 1;
        }
        function bar(): byte {
          return 2;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple functions');
    });

    it('should compile function calls', () => {
      const source = `
        function helper(): byte {
          return 42;
        }
        function main(): void {
          let result: byte = helper();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'function calls');
      // Should contain JSR (jump to subroutine)
      expectAssemblyContains(result, 'JSR');
    });
  });

  // ── Assembly Output Verification ───────────────────────────────

  describe('assembly output structure', () => {
    it('should produce non-empty assembly for any valid program', () => {
      const result = compileBlend('let x: byte = 1;');
      expectSuccess(result);
      const asm = getAssembly(result);
      expect(asm.length).toBeGreaterThan(10);
    });

    it('should contain LDA for loading values', () => {
      const result = compileBlend('let x: byte = 42;');
      expectAssemblyContains(result, 'LDA');
    });

    it('should contain STA for storing values', () => {
      // Function with assignment generates STA for the store
      const source = `
        function test(): void {
          let x: byte = 10;
          x = x + 1;
        }
      `;
      const result = compileBlend(source);
      expectAssemblyContains(result, 'STA');
    });

    it('should compile all 8 phases successfully', () => {
      const result = compileBlend('let x: byte = 1;');
      expectSuccess(result);

      // All 8 phase results should be populated
      expect(result.phases.parse).toBeDefined();
      expect(result.phases.semantic).toBeDefined();
      expect(result.phases.frame).toBeDefined();
      expect(result.phases.il).toBeDefined();
      expect(result.phases.optimize).toBeDefined();
      expect(result.phases.codegen).toBeDefined();
      expect(result.phases.asmOpt).toBeDefined();
      expect(result.phases.emit).toBeDefined();
    });

    it('should have timing information for all phases', () => {
      const result = compileBlend('let x: byte = 1;');
      expectSuccess(result);

      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.phases.parse!.timeMs).toBeGreaterThanOrEqual(0);
      expect(result.phases.semantic!.timeMs).toBeGreaterThanOrEqual(0);
      expect(result.phases.emit!.timeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Multi-Source File Compilation ──────────────────────────────

  describe('multi-source files', () => {
    it('should compile multiple source files', () => {
      const sources = new Map<string, string>();
      sources.set('a.blend', 'export let x: byte = 1;');
      sources.set('b.blend', 'export let y: byte = 2;');

      const result = compileBlendSources(sources);
      expectSuccess(result, 'multiple source files');
    });

    it('should compile source with export modifier', () => {
      const result = compileBlend('export let score: byte = 0;');
      expectSuccess(result, 'export variable');
    });
  });
});
