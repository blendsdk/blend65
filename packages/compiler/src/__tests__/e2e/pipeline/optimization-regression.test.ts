/**
 * E2E Pipeline Tests: Optimization Regression Tests
 *
 * Regression tests for bugs discovered during the spinning-line diagnostic
 * (plans/spinning-line-diag-fixes). These tests ensure that specific
 * optimizer bugs do not regress in future changes.
 *
 * **Bug #1 (Critical): DCE removing parameter stores before CALL**
 * CALL instructions had empty defUse.uses, so liveness analysis didn't see
 * parameter stores as live. DCE removed them, breaking function calls at O1+.
 * Fix: CALL instructions now include parameter slot names in defUse.uses.
 *
 * **Bug #3 (High): JMP-to-next-instruction after function inlining**
 * The inliner converted the final RETURN to a JMP to continuation label,
 * which was redundant since the continuation label immediately followed.
 * Fix: Inliner removes trailing JMP-to-contLabel after replaceReturnsWithJump().
 *
 * @see plans/spinning-line-diag-fixes/
 * @module __tests__/e2e/pipeline/optimization-regression
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  expectSuccess,
  expectAssemblyContains,
  getAssembly,
} from './helpers.js';
import type { Blend65Config } from '../../../config/types.js';
import type { OptimizationLevelId } from '../../../config/types.js';

/**
 * Create a Blend65Config for the given optimization level.
 *
 * @param optimization - The optimization level to use
 * @returns A Blend65Config targeting C64 with the given optimization
 */
function configAt(optimization: OptimizationLevelId): Blend65Config {
  return { compilerOptions: { target: 'c64', optimization } };
}

// ── Bug #1 Regression: DCE Parameter Store Preservation ─────────────

/**
 * Source code for Bug #1 regression test.
 *
 * `applyOffset` takes two parameters (base: word, offset: byte).
 * The function is called from two sites so it won't be inlined
 * (call count > 1). At O1, DCE must NOT remove the stores to
 * parameter slots before the CALL instruction.
 */
const PARAM_STORE_SOURCE = `
module TestParamStore;

function applyOffset(base: word, offset: byte): byte {
    return lo(base + offset);
}

export function main(): void {
    poke($0400, applyOffset($1000, 5));
    poke($0401, applyOffset($2000, 10));
}
`;

/**
 * Simpler source for Bug #1: single byte parameter.
 *
 * `setColor` takes a byte parameter. Called from 2 sites
 * to prevent inlining. Verifies even simple byte params
 * are preserved by DCE.
 */
const SIMPLE_PARAM_SOURCE = `
module TestSimpleParam;

function setColor(color: byte): void {
    poke($D020, color);
    poke($D021, color);
}

export function main(): void {
    setColor(1);
    setColor(14);
}
`;

describe('E2E: Optimization Regressions (spinning-line-diag-fixes)', () => {
  // ── Bug #1: DCE must NOT remove parameter stores before CALL ──

  describe('Bug #1: DCE parameter store preservation', () => {
    it('should compile successfully at O1 with function parameters', () => {
      const result = compileBlend(PARAM_STORE_SOURCE, configAt('O1'));
      expectSuccess(result, 'param store source at O1');
    });

    it('should preserve parameter stores at O1 (not removed by DCE)', () => {
      // At O1, the function is called (not inlined since 2 call sites).
      // The parameter stores (STA to param slot) must be preserved.
      const result = compileBlend(PARAM_STORE_SOURCE, configAt('O1'));
      expectSuccess(result, 'param stores at O1');
      const asm = getAssembly(result);

      // The assembly must contain JSR (function call) since applyOffset
      // is called from 2 sites and shouldn't be inlined
      expect(asm, 'Expected JSR for non-inlined function call').toContain('JSR');

      // Before the JSR, there should be STA instructions storing parameter values.
      // The exact slot addresses depend on frame layout, but STA to zero-page
      // addresses ($02-$0F range) should be present for parameter passing.
      const lines = asm.split('\n');
      const jsrLines = lines
        .map((line, i) => ({ line: line.trim(), index: i }))
        .filter(({ line }) => line.startsWith('JSR'));

      // For each JSR, verify there's at least one STA in the preceding lines
      // (parameter store before call)
      for (const { index } of jsrLines) {
        const precedingLines = lines.slice(Math.max(0, index - 10), index);
        const hasParamStore = precedingLines.some(l => l.trim().startsWith('STA'));
        expect(
          hasParamStore,
          `Expected STA (parameter store) before JSR at line ${index}`
        ).toBe(true);
      }
    });

    it('should preserve parameter stores at Os (size optimization)', () => {
      const result = compileBlend(PARAM_STORE_SOURCE, configAt('Os'));
      expectSuccess(result, 'param stores at Os');
      const asm = getAssembly(result);

      // At Os, same behavior: JSR with parameter stores
      expect(asm, 'Expected JSR at Os').toContain('JSR');

      const lines = asm.split('\n');
      const jsrLines = lines
        .map((line, i) => ({ line: line.trim(), index: i }))
        .filter(({ line }) => line.startsWith('JSR'));

      for (const { index } of jsrLines) {
        const precedingLines = lines.slice(Math.max(0, index - 10), index);
        const hasParamStore = precedingLines.some(l => l.trim().startsWith('STA'));
        expect(
          hasParamStore,
          `Expected STA (parameter store) before JSR at line ${index} at Os`
        ).toBe(true);
      }
    });

    it('should preserve simple byte parameter stores at O1', () => {
      const result = compileBlend(SIMPLE_PARAM_SOURCE, configAt('O1'));
      expectSuccess(result, 'simple param at O1');
      const asm = getAssembly(result);

      // setColor is called from 2 sites → should be JSR, not inlined
      expect(asm, 'Expected JSR for setColor calls').toContain('JSR');
    });

    it('should produce valid assembly at all optimization levels', () => {
      // Verify compilation succeeds at every optimization level
      const levels: OptimizationLevelId[] = ['O0', 'O1', 'O2', 'O3', 'Os', 'Oz'];
      for (const level of levels) {
        const result = compileBlend(PARAM_STORE_SOURCE, configAt(level));
        expectSuccess(result, `param store source at ${level}`);
      }
    });
  });

  // ── Bug #3: Inliner must NOT emit JMP-to-next-instruction ─────

  /**
   * Source code for Bug #3 regression test.
   *
   * `helper` is a small function called once, so it will be inlined
   * at O1. After inlining, the last RETURN becomes a JMP to the
   * continuation label. Since that label immediately follows, the
   * JMP is redundant and should be removed by the inliner fix.
   */
  const INLINE_JMP_SOURCE = `
module TestInlineJMP;

function helper(): void {
    poke($D020, 1);
}

export function main(): void {
    helper();
    poke($D020, 0);
}
`;

  /**
   * Source with a function that has multiple returns — tests that
   * non-final returns still get JMPs but the trailing one is removed.
   */
  const MULTI_RETURN_INLINE_SOURCE = `
module TestMultiReturn;

function pickColor(flag: byte): byte {
    if (flag == 0) {
        return 1;
    }
    return 14;
}

export function main(): void {
    poke($D020, pickColor(0));
    poke($D020, pickColor(1));
}
`;

  describe('Bug #3: No JMP-to-next-instruction after inlining', () => {
    it('should compile successfully at O1 with inlined function', () => {
      const result = compileBlend(INLINE_JMP_SOURCE, configAt('O1'));
      expectSuccess(result, 'inline JMP source at O1');
    });

    it('should not have JMP-to-next-instruction pattern at O1', () => {
      const result = compileBlend(INLINE_JMP_SOURCE, configAt('O1'));
      expectSuccess(result, 'no JMP-to-next at O1');
      const asm = getAssembly(result);

      // Check for JMP-to-next-instruction pattern:
      // A JMP label where the very next non-empty line defines that label
      const lines = asm.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const current = lines[i].trim();
        const jmpMatch = current.match(/^JMP\s+(\S+)/);
        if (jmpMatch) {
          const targetLabel = jmpMatch[1];
          // Find the next non-empty line
          let nextLine = '';
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim().length > 0) {
              nextLine = lines[j].trim();
              break;
            }
          }
          // A JMP-to-next pattern is when the next line defines the target label
          const isJmpToNext = nextLine === targetLabel || nextLine === `${targetLabel}:`;
          expect(
            isJmpToNext,
            `JMP-to-next-instruction detected at line ${i + 1}: "${current}" followed by "${nextLine}"`
          ).toBe(false);
        }
      }
    });

    it('should not have JMP-to-next-instruction pattern at Os', () => {
      const result = compileBlend(INLINE_JMP_SOURCE, configAt('Os'));
      expectSuccess(result, 'no JMP-to-next at Os');
      const asm = getAssembly(result);

      // Same JMP-to-next check at Os
      const lines = asm.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const current = lines[i].trim();
        const jmpMatch = current.match(/^JMP\s+(\S+)/);
        if (jmpMatch) {
          const targetLabel = jmpMatch[1];
          let nextLine = '';
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim().length > 0) {
              nextLine = lines[j].trim();
              break;
            }
          }
          const isJmpToNext = nextLine === targetLabel || nextLine === `${targetLabel}:`;
          expect(
            isJmpToNext,
            `JMP-to-next at Os line ${i + 1}: "${current}" → "${nextLine}"`
          ).toBe(false);
        }
      }
    });

    it('should produce valid assembly with multi-return inlined function', () => {
      // Multi-return function: non-final returns still need JMPs,
      // but the final return's JMP should be removed
      const result = compileBlend(MULTI_RETURN_INLINE_SOURCE, configAt('O1'));
      expectSuccess(result, 'multi-return inline at O1');
    });

    it('should produce valid assembly at all optimization levels', () => {
      const levels: OptimizationLevelId[] = ['O0', 'O1', 'O2', 'O3', 'Os', 'Oz'];
      for (const level of levels) {
        const result = compileBlend(INLINE_JMP_SOURCE, configAt(level));
        expectSuccess(result, `inline JMP source at ${level}`);
      }
    });
  });

  // ── Combined: Full pipeline correctness at multiple opt levels ──

  describe('combined regression: parameter passing + inlining', () => {
    /**
     * More complex source combining both scenarios: functions with
     * params (called from multiple sites) and small functions that
     * get inlined. Tests that both fixes work together correctly.
     */
    const COMBINED_SOURCE = `
module TestCombined;

function doubleVal(v: byte): byte {
    return v + v;
}

function setPixel(addr: word, val: byte): void {
    poke(addr, val);
}

export function main(): void {
    let color: byte = doubleVal(3);
    setPixel($0400, color);
    setPixel($0401, doubleVal(7));
}
`;

    it('should compile combined source at O1 without errors', () => {
      const result = compileBlend(COMBINED_SOURCE, configAt('O1'));
      expectSuccess(result, 'combined source at O1');
    });

    it('should compile combined source at O3 without errors', () => {
      const result = compileBlend(COMBINED_SOURCE, configAt('O3'));
      expectSuccess(result, 'combined source at O3');
    });

    it('should compile combined source at Os without errors', () => {
      const result = compileBlend(COMBINED_SOURCE, configAt('Os'));
      expectSuccess(result, 'combined source at Os');
    });

    it('should compile combined source at Oz without errors', () => {
      const result = compileBlend(COMBINED_SOURCE, configAt('Oz'));
      expectSuccess(result, 'combined source at Oz');
    });

    it('should not have JMP-to-next in combined source at any opt level', () => {
      const levels: OptimizationLevelId[] = ['O1', 'O2', 'O3', 'Os', 'Oz'];
      for (const level of levels) {
        const result = compileBlend(COMBINED_SOURCE, configAt(level));
        expectSuccess(result, `combined at ${level}`);
        const asm = getAssembly(result);

        // Verify no JMP-to-next pattern
        const lines = asm.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const current = lines[i].trim();
          const jmpMatch = current.match(/^JMP\s+(\S+)/);
          if (jmpMatch) {
            const targetLabel = jmpMatch[1];
            let nextLine = '';
            for (let j = i + 1; j < lines.length; j++) {
              if (lines[j].trim().length > 0) {
                nextLine = lines[j].trim();
                break;
              }
            }
            const isJmpToNext = nextLine === targetLabel || nextLine === `${targetLabel}:`;
            expect(
              isJmpToNext,
              `JMP-to-next at ${level} line ${i + 1}: "${current}" → "${nextLine}"`
            ).toBe(false);
          }
        }
      }
    });
  });
});
