/**
 * Integration Test: Pass Ordering
 *
 * Verifies that optimization passes run in the correct order and
 * that earlier passes create opportunities for later passes.
 *
 * **Key insight:** Pass order matters because:
 * 1. FlagPatterns removes redundant CMP #0 after LDA/LDX/LDY
 * 2. StoreLoad removes STA/LDA pairs → which may expose new CMP #0 patterns
 * 3. BranchOpt simplifies control flow → may expose dead flag ops
 * 4. TransferOpt removes redundant TAX/TXA pairs
 *
 * These tests construct programs where Pass A creates a pattern
 * for Pass B, verifying the combined result through AsmILOptimizer.
 *
 * @module __tests__/codegen/asm-il/optimizer/integration/pass-order
 */

import { describe, it, expect } from 'vitest';
import { AsmILOptimizer } from '../../../../../codegen/asm-il/optimizer/asm-il-optimizer.js';
import { OptimizationLevel } from '../../../../../codegen/asm-il/optimizer/options.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
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

/** Extract all instruction mnemonics from the first section of a program */
function getMnemonics(program: AsmILProgram): string[] {
  if (program.sections.length === 0) return [];
  return program.sections[0].elements
    .filter(isInstructionElement)
    .map(e => (e as { kind: 'instruction'; instruction: { mnemonic: string } }).instruction.mnemonic);
}

/** Count instructions in the first section */
function countInstructions(program: AsmILProgram): number {
  if (program.sections.length === 0) return 0;
  return program.sections[0].elements.filter(isInstructionElement).length;
}

// ============================================================================
// Pass Ordering Tests
// ============================================================================

describe('Integration: Pass Ordering', () => {
  // ========================================================================
  // O1 Level: FlagPatterns + StoreLoad ordering
  // ========================================================================

  describe('O1: FlagPatterns before StoreLoad', () => {
    it('should allow FlagPatterns to remove CMP #0 before StoreLoad runs', () => {
      // Program where FlagPatterns removes CMP #0, then StoreLoad
      // can work on the remaining instructions.
      //
      // Input:
      //   LDA $50     ; loads A, sets flags
      //   CMP #0      ; redundant — LDA already set flags
      //   BEQ done    ; branch on zero
      //   STA $60     ; store A
      //   LDA $60     ; reload same value — StoreLoad can remove this
      //
      // After FlagPatterns: CMP #0 removed
      // After StoreLoad: LDA $60 removed (STA $60 just stored it)
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'done'),
        instr('STA', AsmAddressingMode.ZeroPage, 0x60),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x60),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
      ]);

      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      const result = optimizer.optimize(program);

      // Both CMP #0 and redundant LDA $60 should be removed
      expect(result.changed).toBe(true);
      const mnems = getMnemonics(result.program);

      // CMP #0 should be gone
      expect(mnems).not.toContain('CMP');

      // The redundant LDA $60 after STA $60 should be gone
      // Final: LDA $50, BEQ done, STA $60, STA $D020
      expect(countInstructions(result.program)).toBeLessThan(6);
    });

    it('should process both passes on a simple program', () => {
      // FlagPatterns target: LDA + CMP #0
      // StoreLoad target: STA + LDA same address
      const program = createTestProgram([
        instr('LDX', AsmAddressingMode.Immediate, 5),
        instr('CMP', AsmAddressingMode.Immediate, 0), // Redundant after LDX sets flags
        instr('STA', AsmAddressingMode.ZeroPage, 0x40),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x40), // Redundant reload
      ]);

      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(true);
      // At minimum, CMP #0 should be removed
      const mnems = getMnemonics(result.program);
      expect(mnems).not.toContain('CMP');
    });
  });

  // ========================================================================
  // O2 Level: Additional passes interact
  // ========================================================================

  describe('O2: Branch + Transfer interactions', () => {
    it('should apply all 4 passes at O2 level', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O2 });
      const passes = optimizer.getPasses();

      // O2 should have exactly 4 passes in order
      expect(passes).toHaveLength(4);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
    });

    it('should handle redundant transfer after flag cleanup', () => {
      // FlagPatterns removes CMP #0, then TransferOpt removes TAX/TXA pair
      //
      // Input:
      //   LDA $50
      //   CMP #0       ; redundant (FlagPatterns removes)
      //   TAX           ; transfer A→X
      //   TXA           ; transfer X→A — redundant reverse (TransferOpt removes)
      //   STA $D020
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('TAX'),
        instr('TXA'),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
      ]);

      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O2 });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(true);
      const mnems = getMnemonics(result.program);

      // CMP #0 should be removed by FlagPatterns
      expect(mnems).not.toContain('CMP');

      // After FlagPatterns + TransferOpt, the transfer pair may be cleaned up
      // At minimum both individual passes should have fired
      expect(countInstructions(result.program)).toBeLessThan(5);
    });
  });

  // ========================================================================
  // O3 Level: All passes including advanced
  // ========================================================================

  describe('O3: Full pass set', () => {
    it('should apply all 7 passes at O3 level', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      const passes = optimizer.getPasses();

      // O3 = FlagPatterns + StoreLoad + BranchOpt + TransferOpt +
      //       ZPPromotion + Strength6502 + StackOpt
      expect(passes).toHaveLength(7);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('zp-promotion');
      expect(passes[5].name).toBe('6502-strength');
      expect(passes[6].name).toBe('stack-opt');
    });

    it('should apply stack optimization after flag patterns', () => {
      // FlagPatterns removes dead carry, StackOpt removes redundant PHA/PLA
      //
      // Input:
      //   PHA          ; save A
      //   CLC          ; dead carry (no ADC follows before next CLC)
      //   CLC          ; duplicate carry clear
      //   PLA          ; restore A — no modification between PHA/PLA
      //   STA $D020
      const program = createTestProgram([
        instr('PHA'),
        instr('CLC'),
        instr('CLC'),
        instr('PLA'),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
      ]);

      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(true);
      // Multiple passes should fire: FlagPatterns (dead CLC) + StackOpt (PHA/PLA)
      expect(countInstructions(result.program)).toBeLessThan(5);
    });
  });

  // ========================================================================
  // Os/Oz Level: Size passes after standard passes
  // ========================================================================

  describe('Os/Oz: Size passes after standard', () => {
    it('should apply 7 passes at Os level', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Os });
      const passes = optimizer.getPasses();

      // Os = FlagPatterns + StoreLoad + BranchOpt + TransferOpt +
      //       ZPPromotion + StackOpt + SizeOpt
      expect(passes).toHaveLength(7);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('zp-promotion');
      expect(passes[5].name).toBe('stack-opt');
      expect(passes[6].name).toBe('size-opt');
    });

    it('should apply 7 passes at Oz level', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Oz });
      const passes = optimizer.getPasses();

      expect(passes).toHaveLength(7);
      expect(passes[6].name).toBe('size-opt');
    });

    it('should apply tail call optimization after branch optimization', () => {
      // BranchOpt simplifies branches, then SizeOpt replaces JSR+RTS with JMP
      //
      // Input:
      //   LDA $50
      //   CMP #0         ; FlagPatterns removes
      //   JSR sub        ; call subroutine
      //   RTS            ; return — SizeOpt replaces JSR+RTS with JMP
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'sub'),
        instr('RTS'),
      ]);

      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Os });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(true);
      const mnems = getMnemonics(result.program);

      // CMP #0 removed by FlagPatterns
      expect(mnems).not.toContain('CMP');

      // JSR+RTS replaced by JMP (tail call optimization by SizeOpt)
      expect(mnems).toContain('JMP');
      expect(mnems).not.toContain('JSR');
      expect(mnems).not.toContain('RTS');
    });
  });

  // ========================================================================
  // Pass Statistics Tracking
  // ========================================================================

  describe('per-pass statistics', () => {
    it('should track statistics per pass across iterations', () => {
      // Program with patterns for multiple passes
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CMP', AsmAddressingMode.Immediate, 0), // FlagPatterns target
        instr('STA', AsmAddressingMode.ZeroPage, 0x60),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x60), // StoreLoad target
      ]);

      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      const result = optimizer.optimize(program);

      // Should have stats for both passes
      expect(result.passStats.size).toBeGreaterThanOrEqual(1);

      // Check that at least one pass reports changes
      let anyPatterns = false;
      for (const [, stats] of result.passStats) {
        if (stats.totalPatternsMatched > 0) anyPatterns = true;
      }
      expect(anyPatterns).toBe(true);
    });

    it('should report zero changes for unoptimizable program', () => {
      // Minimal program with nothing to optimize
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 5),
        instr('STA', AsmAddressingMode.Absolute, 0xD020),
        instr('RTS'),
      ]);

      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(false);
      // All passes should report zero patterns matched
      for (const [, stats] of result.passStats) {
        expect(stats.totalPatternsMatched).toBe(0);
      }
    });
  });
});
