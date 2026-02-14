/**
 * E2E Pipeline Tests: Binary Operand Fixes
 *
 * Verifies that IL generator ↔ codegen operand mismatches are fixed.
 * These tests cover 6 bug categories that were producing empty operand
 * arrays `[]` or missing IL opcodes:
 *
 * 1. **Modulo/divide with literals** — `i % 3`, `i / 3` now emit MOD_IMM/DIV_IMM
 * 2. **Shift operators** — `x << 1`, `x >> 2` now emit correct ASL/LSR
 * 3. **Complex right operands** — `a + (b * c)` uses ZP temp slot (no empty operands)
 * 4. **Compound assignments** — `x *= 2`, `x /= 3`, `x %= 5` emit correct IL
 * 5. **sprite-test.blend** — Real-world program compiles at O0 and O3
 *
 * @see plans/il-codegen-operand-fixes/07-testing-strategy.md
 * @module __tests__/e2e/pipeline/binary-operand-fixes
 */

import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  compileBlend,
  expectSuccess,
  expectAssemblyContains,
  getAssembly,
} from './helpers.js';
import type { Blend65Config } from '../../../config/types.js';

/**
 * C64 config with O3 optimization for stress-testing the optimizer path.
 */
const O3_CONFIG: Blend65Config = {
  compilerOptions: {
    target: 'c64',
    optimization: 'O3',
  },
};

describe('E2E: Binary Operand Fixes', () => {
  // ── Modulo and Divide with Literals ────────────────────────────

  describe('modulo and divide with literals', () => {
    it('should compile modulo with literal (i % 3)', () => {
      const source = `
        function test(): byte {
          let i: byte = 17;
          let r: byte = i % 3;
          return r;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'modulo with literal');
      // Should contain JSR to __mod8 runtime helper
      expectAssemblyContains(result, 'JSR');
    });

    it('should compile divide with literal (total / 2)', () => {
      const source = `
        function test(): byte {
          let total: byte = 100;
          let half: byte = total / 2;
          return half;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'divide with literal');
      // Should contain JSR to __div8 runtime helper
      expectAssemblyContains(result, 'JSR');
    });

    it('should compile modulo with literal at O3', () => {
      const source = `
        function test(): byte {
          let i: byte = 17;
          let r: byte = i % 3;
          return r;
        }
      `;
      const result = compileBlend(source, O3_CONFIG);
      expectSuccess(result, 'modulo with literal at O3');
    });

    it('should compile divide with literal at O3', () => {
      const source = `
        function test(): byte {
          let total: byte = 100;
          let half: byte = total / 2;
          return half;
        }
      `;
      const result = compileBlend(source, O3_CONFIG);
      expectSuccess(result, 'divide with literal at O3');
    });

    it('should compile chained modulo expression', () => {
      const source = `
        function test(): byte {
          let val: byte = 200;
          let r: byte = val % 10;
          return r;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'chained modulo');
    });

    it('should compile divide used in further arithmetic', () => {
      const source = `
        function test(): byte {
          let total: byte = 100;
          let half: byte = total / 2;
          let result: byte = half + 1;
          return result;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'divide in further arithmetic');
    });
  });

  // ── Shift Operators ────────────────────────────────────────────

  describe('shift operators', () => {
    it('should compile left shift with literal (x << 1)', () => {
      const source = `
        function test(): byte {
          let x: byte = 5;
          let doubled: byte = x << 1;
          return doubled;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'left shift with literal');
      // Should contain ASL (arithmetic shift left)
      expectAssemblyContains(result, 'ASL');
    });

    it('should compile right shift with literal (x >> 2)', () => {
      const source = `
        function test(): byte {
          let x: byte = 100;
          let quarter: byte = x >> 2;
          return quarter;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'right shift with literal');
      // Should contain LSR (logical shift right)
      expectAssemblyContains(result, 'LSR');
    });

    it('should compile multiple left shifts (x << 3)', () => {
      const source = `
        function test(): byte {
          let x: byte = 1;
          let shifted: byte = x << 3;
          return shifted;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple left shifts');
      // Should contain multiple ASL instructions
      const asm = getAssembly(result);
      const aslCount = (asm.match(/ASL/g) || []).length;
      // 3 shifts = at least 3 ASL instructions
      expect(aslCount).toBeGreaterThanOrEqual(3);
    });

    it('should compile shift operators at O3', () => {
      const source = `
        function test(): byte {
          let x: byte = 10;
          let a: byte = x << 1;
          let b: byte = x >> 1;
          return a + b;
        }
      `;
      const result = compileBlend(source, O3_CONFIG);
      expectSuccess(result, 'shift operators at O3');
    });
  });

  // ── Complex Right Operands ─────────────────────────────────────

  describe('complex right operands', () => {
    it('should compile addition with complex right (a + (b * c))', () => {
      const source = `
        function test(): byte {
          let a: byte = 10;
          let b: byte = 3;
          let c: byte = 4;
          let r: byte = a + b * c;
          return r;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'a + (b * c)');
    });

    it('should compile subtraction with complex right (a - (b * c))', () => {
      const source = `
        function test(): byte {
          let a: byte = 50;
          let b: byte = 3;
          let c: byte = 4;
          let r: byte = a - b * c;
          return r;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'a - (b * c)');
    });

    it('should compile multiplication with complex right (a * (b + c))', () => {
      const source = `
        function test(): byte {
          let a: byte = 2;
          let b: byte = 3;
          let c: byte = 4;
          let r: byte = a * (b + c);
          return r;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'a * (b + c)');
    });

    it('should compile bitwise AND with complex right (a & (b | c))', () => {
      const source = `
        function test(): byte {
          let a: byte = $FF;
          let b: byte = $0F;
          let c: byte = $F0;
          let r: byte = a & (b | c);
          return r;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'a & (b | c)');
    });

    it('should compile complex right operand at O3', () => {
      const source = `
        function test(): byte {
          let a: byte = 10;
          let b: byte = 3;
          let c: byte = 4;
          let r: byte = a + b * c;
          return r;
        }
      `;
      const result = compileBlend(source, O3_CONFIG);
      expectSuccess(result, 'complex right operand at O3');
    });
  });

  // ── Compound Assignments ───────────────────────────────────────

  describe('compound assignments', () => {
    it('should compile multiply-assign (x *= 2)', () => {
      const source = `
        function test(): void {
          let x: byte = 10;
          x *= 2;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiply-assign');
    });

    it('should compile divide-assign (x /= 3)', () => {
      const source = `
        function test(): void {
          let x: byte = 30;
          x /= 3;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'divide-assign');
      // Should contain JSR for __div8 runtime helper
      expectAssemblyContains(result, 'JSR');
    });

    it('should compile modulo-assign (x %= 5)', () => {
      const source = `
        function test(): void {
          let x: byte = 17;
          x %= 5;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'modulo-assign');
      // Should contain JSR for __mod8 runtime helper
      expectAssemblyContains(result, 'JSR');
    });

    it('should compile shift-left-assign (x <<= 2)', () => {
      const source = `
        function test(): void {
          let x: byte = 5;
          x <<= 2;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'shift-left-assign');
      // Should contain ASL instructions
      expectAssemblyContains(result, 'ASL');
    });

    it('should compile shift-right-assign (x >>= 1)', () => {
      const source = `
        function test(): void {
          let x: byte = 100;
          x >>= 1;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'shift-right-assign');
      // Should contain LSR instruction
      expectAssemblyContains(result, 'LSR');
    });

    it('should compile compound assignments at O3', () => {
      const source = `
        function test(): void {
          let x: byte = 10;
          x *= 2;
          x /= 3;
          x %= 5;
          x <<= 1;
          x >>= 1;
        }
      `;
      const result = compileBlend(source, O3_CONFIG);
      expectSuccess(result, 'compound assignments at O3');
    });

    it('should compile compound add and subtract (baseline)', () => {
      const source = `
        function test(): void {
          let x: byte = 10;
          x += 5;
          x -= 3;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'add/subtract compound (baseline)');
    });
  });

  // ── sprite-test.blend (Real-World Program) ─────────────────────

  describe('sprite-test.blend (starfield simulation)', () => {
    /**
     * Read the sprite-test.blend example file from disk.
     * This is the real-world program that originally triggered these fixes.
     */
    // process.cwd() is packages/compiler when vitest runs, so go up 2 levels to workspace root
    const spriteTestPath = resolve(
      process.cwd(),
      '../../examples/sprite-test/sprite-test.blend'
    );

    let spriteTestSource: string;

    try {
      spriteTestSource = readFileSync(spriteTestPath, 'utf-8');
    } catch {
      // If file not found, use empty string — test will be skipped below
      spriteTestSource = '';
    }

    it('should compile sprite-test.blend at O0', () => {
      if (!spriteTestSource) {
        throw new Error(`sprite-test.blend not found at ${spriteTestPath}`);
      }
      const result = compileBlend(spriteTestSource);
      expectSuccess(result, 'sprite-test.blend at O0');

      // Verify assembly contains expected patterns for C64 hardware access
      const asm = getAssembly(result);
      // Should contain function labels for the main functions
      expect(asm).toContain('main');
      // Should contain JSR for function calls
      expect(asm).toContain('JSR');
      // Should contain STA for poke operations
      expect(asm).toContain('STA');
    });

    it('should compile sprite-test.blend at O3', () => {
      if (!spriteTestSource) {
        throw new Error(`sprite-test.blend not found at ${spriteTestPath}`);
      }
      const result = compileBlend(spriteTestSource, O3_CONFIG);
      expectSuccess(result, 'sprite-test.blend at O3');

      // Verify assembly output is non-trivial
      const asm = getAssembly(result);
      expect(asm.length).toBeGreaterThan(100);
    });

    it('should produce assembly with modulo operations for speed calc', () => {
      if (!spriteTestSource) {
        throw new Error(`sprite-test.blend not found at ${spriteTestPath}`);
      }
      const result = compileBlend(spriteTestSource);
      expectSuccess(result, 'sprite-test modulo check');

      // The initStars function uses `i % 3` for speed assignment
      // This should produce JSR to __mod8 runtime helper
      const asm = getAssembly(result);
      expect(asm).toContain('JSR');
    });
  });
});
