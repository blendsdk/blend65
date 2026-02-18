/**
 * Integration Test: Level Configurations
 *
 * Verifies that each optimization level (O0-Oz) is properly configured
 * with the correct passes, iteration limits, ZP slots, and behavior.
 *
 * This tests the complete level→factory→optimizer chain, ensuring
 * the high-level AsmILOptimizer properly translates levels into
 * concrete pass configurations.
 *
 * @module __tests__/codegen/asm-il/optimizer/integration/level-config
 */

import { describe, it, expect } from 'vitest';
import { AsmILOptimizer, createAsmILOptimizer } from '../../../../../codegen/asm-il/optimizer/asm-il-optimizer.js';
import { OptimizationLevel, getAllLevels } from '../../../../../codegen/asm-il/optimizer/options.js';
import { getPassCountForLevel, getPlannedPassCounts } from '../../../../../codegen/asm-il/optimizer/pass-factory.js';
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
function createTestProgram(elements: AsmILElement[]): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: 'code', elements }],
  };
}

/** Count instructions in the first section */
function countInstructions(program: AsmILProgram): number {
  if (program.sections.length === 0) return 0;
  return program.sections[0].elements.filter(isInstructionElement).length;
}

// ============================================================================
// Level Configuration Tests
// ============================================================================

describe('Integration: Level Configurations', () => {
  // ========================================================================
  // O0: No Optimization
  // ========================================================================

  describe('O0: No optimization', () => {
    it('should have no passes', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      expect(optimizer.getPasses()).toHaveLength(0);
    });

    it('should be disabled', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      expect(optimizer.isEnabled()).toBe(false);
    });

    it('should return program unchanged (identity transform)', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0), // Would be optimized at O1+
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]);

      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
      expect(result.iterations).toBe(0);
      expect(countInstructions(result.program)).toBe(3);
    });

    it('should have no ZP slots', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      expect(optimizer.getZpSlots()).toEqual([]);
    });

    it('should have maxIterations=1', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      expect(optimizer.getMaxIterations()).toBe(1);
    });
  });

  // ========================================================================
  // O1: Basic Optimization
  // ========================================================================

  describe('O1: Basic optimization', () => {
    it('should have exactly 3 passes', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      expect(optimizer.getPasses()).toHaveLength(3);
    });

    it('should include FlagPatterns and StoreLoad in order', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      const passes = optimizer.getPasses();
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
    });

    it('should be enabled', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      expect(optimizer.isEnabled()).toBe(true);
    });

    it('should have no ZP slots', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      expect(optimizer.getZpSlots()).toEqual([]);
    });

    it('should have maxIterations=1', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      expect(optimizer.getMaxIterations()).toBe(1);
    });

    it('should remove redundant CMP #0', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
      ]);

      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(true);
      expect(countInstructions(result.program)).toBe(2);
    });
  });

  // ========================================================================
  // O2: Standard Optimization
  // ========================================================================

  describe('O2: Standard optimization', () => {
    it('should have exactly 8 passes', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O2 });
      expect(optimizer.getPasses()).toHaveLength(8);
    });

    it('should include O1 passes plus BranchOpt, TransferOpt, CompareBranch, IndexedAddr, RegisterPromote', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O2 });
      const passes = optimizer.getPasses();
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('compare-branch');
      expect(passes[5].name).toBe('indexed-addr');
      expect(passes[6].name).toBe('register-promote');
    });

    it('should have no ZP slots', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O2 });
      expect(optimizer.getZpSlots()).toEqual([]);
    });

    it('should have maxIterations=1', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O2 });
      expect(optimizer.getMaxIterations()).toBe(1);
    });

    it('should be the default level', () => {
      const optimizer = new AsmILOptimizer();
      expect(optimizer.getLevel()).toBe(OptimizationLevel.O2);
    });
  });

  // ========================================================================
  // O3: Aggressive Optimization
  // ========================================================================

  describe('O3: Aggressive optimization', () => {
    it('should have exactly 11 passes', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      expect(optimizer.getPasses()).toHaveLength(11);
    });

    it('should include O2 passes plus ZPPromotion, Strength6502, StackOpt', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      const passes = optimizer.getPasses();
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('compare-branch');
      expect(passes[5].name).toBe('indexed-addr');
      expect(passes[6].name).toBe('register-promote');
      expect(passes[7].name).toBe('zp-promotion');
      expect(passes[8].name).toBe('6502-strength');
      expect(passes[9].name).toBe('stack-opt');
    });

    it('should have 8 ZP slots (0x50-0x57)', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      const slots = optimizer.getZpSlots();
      expect(slots).toHaveLength(8);
      expect(slots).toEqual([0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57]);
    });

    it('should have maxIterations=5', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      expect(optimizer.getMaxIterations()).toBe(5);
    });

    it('should NOT include size-opt pass', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      const passNames = optimizer.getPasses().map(p => p.name);
      expect(passNames).not.toContain('size-opt');
    });

    it('should NOT include strength-6502 at Os/Oz levels', () => {
      // Strength reduction is speed-focused (O3 only), not size-focused
      const osOpt = new AsmILOptimizer({ level: OptimizationLevel.Os });
      const ozOpt = new AsmILOptimizer({ level: OptimizationLevel.Oz });

      expect(osOpt.getPasses().map(p => p.name)).not.toContain('strength-6502');
      expect(ozOpt.getPasses().map(p => p.name)).not.toContain('strength-6502');
    });
  });

  // ========================================================================
  // Os: Size Optimization
  // ========================================================================

  describe('Os: Size optimization', () => {
    it('should have exactly 11 passes', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Os });
      expect(optimizer.getPasses()).toHaveLength(11);
    });

    it('should include O2 passes plus ZPPromotion, StackOpt, SizeOpt', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Os });
      const passes = optimizer.getPasses();
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('compare-branch');
      expect(passes[5].name).toBe('indexed-addr');
      expect(passes[6].name).toBe('register-promote');
      expect(passes[7].name).toBe('zp-promotion');
      expect(passes[8].name).toBe('stack-opt');
      expect(passes[9].name).toBe('size-opt');
    });

    it('should have 4 ZP slots (0x50-0x53)', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Os });
      const slots = optimizer.getZpSlots();
      expect(slots).toHaveLength(4);
      expect(slots).toEqual([0x50, 0x51, 0x52, 0x53]);
    });

    it('should have maxIterations=1', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Os });
      expect(optimizer.getMaxIterations()).toBe(1);
    });
  });

  // ========================================================================
  // Oz: Minimum Size Optimization
  // ========================================================================

  describe('Oz: Minimum size optimization', () => {
    it('should have exactly 11 passes', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Oz });
      expect(optimizer.getPasses()).toHaveLength(11);
    });

    it('should include same passes as Os', () => {
      const osOpt = new AsmILOptimizer({ level: OptimizationLevel.Os });
      const ozOpt = new AsmILOptimizer({ level: OptimizationLevel.Oz });

      const osNames = osOpt.getPasses().map(p => p.name);
      const ozNames = ozOpt.getPasses().map(p => p.name);

      expect(osNames).toEqual(ozNames);
    });

    it('should have 4 ZP slots (0x50-0x53)', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Oz });
      expect(optimizer.getZpSlots()).toEqual([0x50, 0x51, 0x52, 0x53]);
    });

    it('should have maxIterations=5 (more than Os)', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Oz });
      expect(optimizer.getMaxIterations()).toBe(5);
    });
  });

  // ========================================================================
  // Cross-Level Consistency
  // ========================================================================

  describe('cross-level consistency', () => {
    it('should match actual pass counts with planned pass counts', () => {
      const planned = getPlannedPassCounts();
      const levels = getAllLevels();

      for (const level of levels) {
        const actual = getPassCountForLevel(level);
        expect(actual).toBe(planned[level]);
      }
    });

    it('should have monotonically increasing pass counts from O0 to O2', () => {
      const o0 = getPassCountForLevel(OptimizationLevel.O0);
      const o1 = getPassCountForLevel(OptimizationLevel.O1);
      const o2 = getPassCountForLevel(OptimizationLevel.O2);

      expect(o0).toBe(0);
      expect(o1).toBeGreaterThan(o0);
      expect(o2).toBeGreaterThan(o1);
    });

    it('should ensure O3/Os/Oz all have more passes than O2', () => {
      const o2Count = getPassCountForLevel(OptimizationLevel.O2);
      const o3Count = getPassCountForLevel(OptimizationLevel.O3);
      const osCount = getPassCountForLevel(OptimizationLevel.Os);
      const ozCount = getPassCountForLevel(OptimizationLevel.Oz);

      expect(o3Count).toBeGreaterThan(o2Count);
      expect(osCount).toBeGreaterThan(o2Count);
      expect(ozCount).toBeGreaterThan(o2Count);
    });

    it('should have all O1 passes included in every higher level', () => {
      const o1 = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      const o1Names = o1.getPasses().map(p => p.name);

      const higherLevels = [
        OptimizationLevel.O2,
        OptimizationLevel.O3,
        OptimizationLevel.Os,
        OptimizationLevel.Oz,
      ];

      for (const level of higherLevels) {
        const optimizer = new AsmILOptimizer({ level });
        const passNames = optimizer.getPasses().map(p => p.name);

        for (const o1Name of o1Names) {
          expect(passNames).toContain(o1Name);
        }
      }
    });

    it('should have all O2 passes included in O3, Os, and Oz', () => {
      const o2 = new AsmILOptimizer({ level: OptimizationLevel.O2 });
      const o2Names = o2.getPasses().map(p => p.name);

      const higherLevels = [
        OptimizationLevel.O3,
        OptimizationLevel.Os,
        OptimizationLevel.Oz,
      ];

      for (const level of higherLevels) {
        const optimizer = new AsmILOptimizer({ level });
        const passNames = optimizer.getPasses().map(p => p.name);

        for (const o2Name of o2Names) {
          expect(passNames).toContain(o2Name);
        }
      }
    });

    it('should ensure 6502-strength is O3-exclusive', () => {
      const levels = getAllLevels();

      for (const level of levels) {
        const optimizer = new AsmILOptimizer({ level });
        const passNames = optimizer.getPasses().map(p => p.name);

        if (level === OptimizationLevel.O3) {
          expect(passNames).toContain('6502-strength');
        } else {
          expect(passNames).not.toContain('6502-strength');
        }
      }
    });

    it('should ensure size-opt is only in size-focused levels', () => {
      // Size-focused levels are all levels with 's' or 'z' suffix
      const sizeLevels = new Set([
        OptimizationLevel.Os, OptimizationLevel.Oz,
        OptimizationLevel.O1s, OptimizationLevel.O1z,
        OptimizationLevel.O3s, OptimizationLevel.O3z,
      ]);
      const levels = getAllLevels();

      for (const level of levels) {
        const optimizer = new AsmILOptimizer({ level });
        const passNames = optimizer.getPasses().map(p => p.name);

        if (sizeLevels.has(level)) {
          expect(passNames).toContain('size-opt');
        } else {
          expect(passNames).not.toContain('size-opt');
        }
      }
    });
  });

  // ========================================================================
  // Factory Function
  // ========================================================================

  describe('createAsmILOptimizer factory', () => {
    it('should create optimizer for each level', () => {
      const levels = getAllLevels();

      for (const level of levels) {
        const optimizer = createAsmILOptimizer(level);
        expect(optimizer.getLevel()).toBe(level);
        expect(optimizer).toBeInstanceOf(AsmILOptimizer);
      }
    });

    it('should accept overrides with level', () => {
      const optimizer = createAsmILOptimizer(OptimizationLevel.O3, {
        maxIterations: 10,
        debug: true,
        zpSlots: [0x80, 0x81],
      });

      expect(optimizer.getLevel()).toBe(OptimizationLevel.O3);
      expect(optimizer.getMaxIterations()).toBe(10);
      expect(optimizer.isDebugEnabled()).toBe(true);
      expect(optimizer.getZpSlots()).toEqual([0x80, 0x81]);
    });
  });
});
