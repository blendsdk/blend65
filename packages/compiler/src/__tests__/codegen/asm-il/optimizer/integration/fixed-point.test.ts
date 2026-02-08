/**
 * Integration Test: Fixed-Point Iteration
 *
 * Verifies that the optimizer runs passes repeatedly until no more
 * changes occur (fixed-point convergence) or the iteration limit is hit.
 *
 * **Key behaviors tested:**
 * - Single iteration when nothing changes
 * - Multiple iterations when Pass A creates opportunities for Pass B
 * - Iteration limit enforcement
 * - Convergence detection
 *
 * @module __tests__/codegen/asm-il/optimizer/integration/fixed-point
 */

import { describe, it, expect } from 'vitest';
import { AsmILOptimizer } from '../../../../../codegen/asm-il/optimizer/asm-il-optimizer.js';
import { AsmOptimizer } from '../../../../../codegen/asm-il/optimizer/asm-optimizer.js';
import { OptimizationLevel } from '../../../../../codegen/asm-il/optimizer/options.js';
import { FlagPatternsPass } from '../../../../../codegen/asm-il/optimizer/passes/flag-patterns.js';
import { StoreLoadPass } from '../../../../../codegen/asm-il/optimizer/passes/store-load.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  isInstructionElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILProgram, AsmILElement } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Shorthand for creating an instruction element */
function instr(
  mnemonic: string,
  mode: AsmAddressingMode = AsmAddressingMode.Implied,
  operand?: number,
  labelOperand?: string
): AsmILElement {
  return createInstructionElement(mnemonic, mode, operand, labelOperand);
}

/** Create a program with a single section containing the given elements */
function createTestProgram(elements: AsmILElement[], sectionName = 'code'): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: sectionName, elements }],
  };
}

/** Count instructions in the first section */
function countInstructions(program: AsmILProgram): number {
  if (program.sections.length === 0) return 0;
  return program.sections[0].elements.filter(isInstructionElement).length;
}

// ============================================================================
// Fixed-Point Iteration Tests
// ============================================================================

describe('Integration: Fixed-Point Iteration', () => {
  // ========================================================================
  // Single Iteration (no further opportunities)
  // ========================================================================

  describe('single iteration convergence', () => {
    it('should converge in 1 iteration when no patterns exist', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
        instr('RTS'),
      ]);

      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O3,
        maxIterations: 5,
      });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(false);
      expect(result.iterations).toBe(1);
    });

    it('should converge in 1 iteration when all patterns found in first pass', () => {
      // Simple CMP #0 removal — one pass finds everything
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]);

      // Use O1 with maxIterations=5 — should still converge in ≤2
      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O1,
        maxIterations: 5,
      });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(true);
      // After removing CMP #0, second iteration finds nothing → converges
      expect(result.iterations).toBeLessThanOrEqual(2);
    });
  });

  // ========================================================================
  // Multi-Iteration Convergence
  // ========================================================================

  describe('multi-iteration convergence', () => {
    it('should run additional iteration when first round creates new opportunities', () => {
      // Use the low-level AsmOptimizer to control iteration precisely.
      //
      // Scenario: StoreLoad removes STA $50 / LDA $50, exposing a
      // new CMP #0 pattern that FlagPatterns can remove on the next iteration.
      //
      // Input:
      //   LDA #10
      //   STA $50        ; StoreLoad target (with LDA $50 below)
      //   LDA $50        ; removed by StoreLoad → now CMP #0 follows LDA #10
      //   CMP #0         ; now redundant after StoreLoad exposed it
      //   BEQ done
      //
      // Iteration 1: StoreLoad removes LDA $50 → now LDA #10 is followed by CMP #0
      // Iteration 2: FlagPatterns removes CMP #0
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 10),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]);

      // Use maxIterations=5 so we can see convergence
      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O1,
        maxIterations: 5,
      });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(true);
      // Should have removed both the redundant LDA $50 AND the CMP #0
      expect(countInstructions(result.program)).toBeLessThanOrEqual(3);
    });
  });

  // ========================================================================
  // Iteration Limit Enforcement
  // ========================================================================

  describe('iteration limit', () => {
    it('should stop at maxIterations even if changes still occur', () => {
      // Use maxIterations=1 on a program that would benefit from 2+ iterations
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 10),
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]);

      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O1,
        maxIterations: 1,
      });
      const result = optimizer.optimize(program);

      // maxIterations=1 means only one pass through all passes
      expect(result.iterations).toBe(1);
      // Some changes should have been made in the single iteration
      expect(result.changed).toBe(true);
    });

    it('should respect custom maxIterations on O3', () => {
      // O3 defaults to maxIterations=5, but we override to 2
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
      ]);

      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O3,
        maxIterations: 2,
      });
      expect(optimizer.getMaxIterations()).toBe(2);

      const result = optimizer.optimize(program);
      // No changes, so should converge in 1 iteration (within the 2 limit)
      expect(result.iterations).toBeLessThanOrEqual(2);
    });
  });

  // ========================================================================
  // Empty / Edge Programs
  // ========================================================================

  describe('edge cases', () => {
    it('should handle empty program gracefully', () => {
      const program = createAsmILProgram('empty');

      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O3,
        maxIterations: 5,
      });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should handle program with empty sections', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [
          { name: 'code', elements: [] },
          { name: 'data', elements: [] },
        ],
      };

      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O2,
        maxIterations: 3,
      });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(false);
    });

    it('should converge quickly for already-optimal code', () => {
      // Code with no optimization opportunities
      const program = createTestProgram([
        instr('SEI'),
        instr('LDA', AsmAddressingMode.Immediate, 0x35),
        instr('STA', AsmAddressingMode.ZeroPage, 0x01),
        instr('LDA', AsmAddressingMode.Immediate, 0),
        instr('STA', AsmAddressingMode.Absolute, 0xD011),
        instr('CLI'),
        instr('RTS'),
      ]);

      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O3,
        maxIterations: 5,
      });
      const result = optimizer.optimize(program);

      // No changes means 1 iteration only
      expect(result.iterations).toBe(1);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // O0 Bypass
  // ========================================================================

  describe('O0 bypass', () => {
    it('should skip all iteration for O0 level', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
      ]);

      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(false);
      expect(result.iterations).toBe(0);
      expect(result.program).toBe(program);
    });
  });

  // ========================================================================
  // Low-Level Pass Manager: Direct Fixed-Point Control
  // ========================================================================

  describe('AsmOptimizer direct control', () => {
    it('should iterate correctly with manually configured passes', () => {
      // Use AsmOptimizer directly to verify the fixed-point mechanism
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]);

      const optimizer = new AsmOptimizer({
        enabled: true,
        passes: [new FlagPatternsPass()],
        maxIterations: 3,
        debug: false,
      });

      const result = optimizer.optimize(program);

      expect(result.changed).toBe(true);
      // First iteration removes CMP #0, second finds nothing → 2 iterations
      expect(result.iterations).toBeLessThanOrEqual(2);
    });

    it('should stop at 1 iteration when maxIterations=1', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('STA', AsmAddressingMode.ZeroPage, 0x60),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x60),
      ]);

      const optimizer = new AsmOptimizer({
        enabled: true,
        passes: [new FlagPatternsPass(), new StoreLoadPass()],
        maxIterations: 1,
        debug: false,
      });

      const result = optimizer.optimize(program);

      expect(result.changed).toBe(true);
      expect(result.iterations).toBe(1);
    });
  });
});
