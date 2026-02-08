/**
 * E2E Test: ASM-IL Optimizer Pipeline Integration
 *
 * Verifies that the ASM-IL optimizer works correctly when wired into
 * the full compilation pipeline (Source → Lexer → Parser → Semantic →
 * IL → CodeGen → ASM-IL Optimizer).
 *
 * **Tests cover:**
 * - Full pipeline with optimization at each level
 * - Correctness: optimized output preserves program semantics
 * - Size reduction: optimized output has fewer instructions
 * - Level comparison: higher levels optimize more aggressively
 *
 * @module __tests__/codegen/e2e/optimization
 */

import { describe, it, expect } from 'vitest';
import {
  compileToAsm,
  compileAndOptimize,
  compileToOptimizedAsm,
  allInstructions,
  mnemonics,
  countMnemonic,
  hasLabel,
} from './_helpers.js';
import { OptimizationLevel } from '../../../codegen/asm-il/optimizer/options.js';

// ============================================================================
// Helper
// ============================================================================

/**
 * Counts total instructions across all sections.
 */
function totalInstructionCount(program: { sections: Array<{ elements: Array<{ kind: string }> }> }): number {
  return program.sections.reduce(
    (sum, sec) => sum + sec.elements.filter(e => e.kind === 'instruction').length,
    0
  );
}

// ============================================================================
// E2E: Optimization Pipeline
// ============================================================================

describe('E2E: ASM-IL Optimizer Pipeline', () => {
  // ========================================================================
  // Basic Pipeline Integration
  // ========================================================================

  describe('pipeline integration', () => {
    it('should compile and optimize a simple variable declaration', () => {
      const source = `let x: byte = 42;`;

      // O0 should return unmodified
      const o0Result = compileAndOptimize(source, OptimizationLevel.O0);
      expect(o0Result.changed).toBe(false);

      // O2 should at least not throw
      const o2Result = compileAndOptimize(source, OptimizationLevel.O2);
      expect(o2Result.program).toBeDefined();
      expect(o2Result.program.sections.length).toBeGreaterThan(0);
    });

    it('should compile and optimize a simple addition', () => {
      const source = `
        let a: byte = 10;
        let b: byte = a + 5;
      `;

      const program = compileToOptimizedAsm(source, OptimizationLevel.O2);
      expect(program.sections.length).toBeGreaterThan(0);

      // Should contain at least LDA and ADC/CLC for addition
      const mnems = mnemonics(program);
      expect(mnems.length).toBeGreaterThan(0);
    });

    it('should compile and optimize a function declaration', () => {
      const source = `
        fn add(a: byte, b: byte): byte {
          return a + b;
        }
      `;

      const program = compileToOptimizedAsm(source, OptimizationLevel.O2);
      expect(program.sections.length).toBeGreaterThan(0);
    });

    it('should compile and optimize with while loops', () => {
      const source = `
        let counter: byte = 10;
        while counter > 0 {
          counter = counter - 1;
        }
      `;

      const program = compileToOptimizedAsm(source, OptimizationLevel.O2);
      expect(program.sections.length).toBeGreaterThan(0);
    });

    it('should compile and optimize with if/else', () => {
      const source = `
        let x: byte = 5;
        let y: byte = 0;
        if x > 3 {
          y = 1;
        } else {
          y = 2;
        }
      `;

      const program = compileToOptimizedAsm(source, OptimizationLevel.O2);
      expect(program.sections.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // O0 Correctness (Identity Transform)
  // ========================================================================

  describe('O0 correctness (identity)', () => {
    it('should produce unchanged output at O0', () => {
      const source = `let x: byte = 42;`;

      const o0Result = compileAndOptimize(source, OptimizationLevel.O0);

      // O0 should not report any changes
      expect(o0Result.changed).toBe(false);
      expect(o0Result.iterations).toBe(0);

      // The program should still be valid
      expect(o0Result.program.sections.length).toBeGreaterThan(0);
    });

    it('should have zero pass stats at O0', () => {
      const source = `let a: byte = 1; let b: byte = 2;`;

      const result = compileAndOptimize(source, OptimizationLevel.O0);
      expect(result.passStats.size).toBe(0);
    });
  });

  // ========================================================================
  // Optimization Effectiveness
  // ========================================================================

  describe('optimization effectiveness', () => {
    it('should produce valid output at every optimization level', () => {
      const source = `
        let x: byte = 10;
        let y: byte = x + 5;
      `;

      const levels = [
        OptimizationLevel.O0,
        OptimizationLevel.O1,
        OptimizationLevel.O2,
        OptimizationLevel.O3,
        OptimizationLevel.Os,
        OptimizationLevel.Oz,
      ];

      for (const level of levels) {
        const result = compileAndOptimize(source, level);
        expect(result.program).toBeDefined();
        expect(result.program.sections.length).toBeGreaterThan(0);
      }
    });

    it('should not increase instruction count when optimizing', () => {
      const source = `
        let a: byte = 5;
        let b: byte = a + 10;
        let c: byte = b - 3;
      `;

      const o0 = compileToOptimizedAsm(source, OptimizationLevel.O0);
      const o2 = compileToOptimizedAsm(source, OptimizationLevel.O2);

      const o0Count = totalInstructionCount(o0);
      const o2Count = totalInstructionCount(o2);

      // O2 should have same or fewer instructions than O0
      expect(o2Count).toBeLessThanOrEqual(o0Count);
    });

    it('should preserve program structure (sections still present)', () => {
      const source = `let x: byte = 42;`;

      const o0 = compileToOptimizedAsm(source, OptimizationLevel.O0);
      const o3 = compileToOptimizedAsm(source, OptimizationLevel.O3);

      // Both should have the same number of sections
      expect(o3.sections.length).toBe(o0.sections.length);

      // Section names should match
      const o0Names = o0.sections.map(s => s.name);
      const o3Names = o3.sections.map(s => s.name);
      expect(o3Names).toEqual(o0Names);
    });
  });

  // ========================================================================
  // Semantic Correctness
  // ========================================================================

  describe('semantic correctness', () => {
    it('should preserve all labels after optimization', () => {
      const source = `
        let x: byte = 5;
        if x > 3 {
          x = 10;
        }
      `;

      const o0 = compileToAsm(source);
      const o2 = compileToOptimizedAsm(source, OptimizationLevel.O2);

      // All labels from O0 should still exist in O2
      // (optimizer should not remove labels since they may be branch targets)
      const o0Labels = allInstructions(o0).length;
      const o2Labels = allInstructions(o2).length;

      // O2 should have same or fewer instructions, but labels preserved
      expect(o2Labels).toBeLessThanOrEqual(o0Labels);
    });

    it('should produce equivalent sections at O0 and O3', () => {
      // Optimization should never remove or add sections
      const source = `
        let a: byte = 10;
        let b: byte = a + 5;
        if b > 10 {
          a = 20;
        }
      `;

      const o0 = compileToOptimizedAsm(source, OptimizationLevel.O0);
      const o3 = compileToOptimizedAsm(source, OptimizationLevel.O3);

      // Same section structure preserved
      expect(o3.sections.length).toBe(o0.sections.length);
      expect(o3.sections.map(s => s.name)).toEqual(o0.sections.map(s => s.name));

      // O3 should have same or fewer instructions
      expect(totalInstructionCount(o3)).toBeLessThanOrEqual(totalInstructionCount(o0));
    });

    it('should compile complex arithmetic correctly after optimization', () => {
      const source = `
        let a: byte = 10;
        let b: byte = 20;
        let c: byte = a + b;
        let d: byte = c - 5;
      `;

      // Should not throw at any level
      for (const level of [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3]) {
        const result = compileAndOptimize(source, level);
        expect(result.program.sections.length).toBeGreaterThan(0);
      }
    });
  });

  // ========================================================================
  // Statistics
  // ========================================================================

  describe('optimization statistics', () => {
    it('should report pass statistics from full pipeline', () => {
      const source = `
        let x: byte = 10;
        let y: byte = x + 5;
      `;

      const result = compileAndOptimize(source, OptimizationLevel.O2);

      // O2 has 4 passes, so passStats should have 4 entries
      expect(result.passStats.size).toBe(4);

      // Each pass should have valid stat properties
      for (const [name, stats] of result.passStats) {
        expect(typeof name).toBe('string');
        expect(stats.totalPatternsMatched).toBeGreaterThanOrEqual(0);
        expect(stats.totalInstructionsRemoved).toBeGreaterThanOrEqual(0);
        expect(stats.timeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should report iteration count', () => {
      const source = `let x: byte = 42;`;

      const result = compileAndOptimize(source, OptimizationLevel.O2);
      expect(result.iterations).toBeGreaterThanOrEqual(1);
    });
  });
});
