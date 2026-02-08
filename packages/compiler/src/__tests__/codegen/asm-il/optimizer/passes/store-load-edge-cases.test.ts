/**
 * StoreLoadPass — Edge Cases & Control Flow Tests
 *
 * Tests control flow boundaries, label handling, idempotency,
 * and real-world C64 patterns.
 */

import { describe, it, expect } from 'vitest';
import { StoreLoadPass } from '../../../../../codegen/asm-il/optimizer/passes/store-load.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createLabelElement,
  createCommentElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILProgram } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function instr(
  mnemonic: string,
  mode: AsmAddressingMode = AsmAddressingMode.Implied,
  operand?: number,
  labelOperand?: string
) {
  return createInstructionElement(mnemonic, mode, operand, labelOperand);
}

function createTestProgram(
  elements: ReturnType<typeof createInstructionElement>[],
  sectionName = 'code'
): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: sectionName, elements }],
  };
}

describe('StoreLoadPass — Edge Cases', () => {
  const pass = new StoreLoadPass();

  // ========================================================================
  // Control Flow Boundaries
  // ========================================================================

  describe('control flow boundaries', () => {
    it('should keep LDA after JSR (subroutine might modify memory)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'some_fn'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA after JMP (unreachable context)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('JMP', AsmAddressingMode.Absolute, undefined, 'elsewhere'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA after RTS', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('RTS'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA after conditional branch (BEQ)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('BEQ', AsmAddressingMode.Relative, undefined, 'skip'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA after conditional branch (BNE)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('BNE', AsmAddressingMode.Relative, undefined, 'loop'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA after BCC', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('BCC', AsmAddressingMode.Relative, undefined, 'no_carry'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Label Boundaries
  // ========================================================================

  describe('label boundaries', () => {
    it('should keep LDA when a label appears between store and load', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('STA', AsmAddressingMode.ZeroPage, 0x50),
            createLabelElement('branch_target'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
          ],
        }],
      };

      const result = pass.run(program);

      // Label could be a branch target — register state unknown
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when local label appears between store and load', () => {
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('STA', AsmAddressingMode.ZeroPage, 0x50),
            createLabelElement('.local', true),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
          ],
        }],
      };

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Idempotency
  // ========================================================================

  describe('idempotency', () => {
    it('should produce same result on second run', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('STX', AsmAddressingMode.ZeroPage, 0x60),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x60),
      ]);

      const result1 = pass.run(program);
      expect(result1.changed).toBe(true);

      const result2 = pass.run(result1.program);
      expect(result2.changed).toBe(false);
      expect(result2.program).toBe(result1.program); // Same reference
    });

    it('should be stable after optimization (no further changes)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('INX'),
        instr('INY'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result1 = pass.run(program);
      const result2 = pass.run(result1.program);
      const result3 = pass.run(result2.program);

      expect(result2.changed).toBe(false);
      expect(result3.changed).toBe(false);
    });
  });

  // ========================================================================
  // No Matching Store Found
  // ========================================================================

  describe('no matching store found', () => {
    it('should keep LDA when there is no preceding STA', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should keep LDA when section starts with load', () => {
      const program = createTestProgram([
        instr('INX'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Single Instruction Section
  // ========================================================================

  describe('single instruction section', () => {
    it('should not crash on section with only a store', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should not crash on section with only a load', () => {
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Real-World C64 Patterns
  // ========================================================================

  describe('real-world C64 patterns', () => {
    it('should optimize VIC register write-back pattern', () => {
      // Common pattern: store to VIC register, then reload
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Immediate, 14),
        instr('STA', AsmAddressingMode.Absolute, 0xD020), // border color
        instr('LDA', AsmAddressingMode.Absolute, 0xD020), // redundant reload
        instr('STA', AsmAddressingMode.Absolute, 0xD021), // background color
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // LDA #14, STA $D020, STA $D021 (LDA $D020 removed)
      expect(result.program.sections[0].elements).toHaveLength(3);
    });

    it('should optimize zero-page variable update pattern', () => {
      // Common: store to variable, index something, reload variable
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x02), // player_x
        instr('INY'),  // next sprite index
        instr('LDA', AsmAddressingMode.ZeroPage, 0x02), // redundant
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2);
    });

    it('should keep LDA after hardware read (SID, VIC I/O)', () => {
      // Hardware I/O registers can change value between reads
      // But since we're matching STA/LDA, and there's no STA before, kept
      const program = createTestProgram([
        instr('LDA', AsmAddressingMode.Absolute, 0xDC01), // CIA keyboard
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(false);
    });

    it('should optimize typical compiler-generated variable assignment', () => {
      // Compiler generates: store var, compute something else, reload var
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x10), // score_lo
        instr('STX', AsmAddressingMode.ZeroPage, 0x11), // score_hi (different addr)
        instr('LDA', AsmAddressingMode.ZeroPage, 0x10), // redundant
      ]);

      const result = pass.run(program);

      // STX $11 doesn't alias STA $10, so LDA $10 is redundant
      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2);
    });

    it('should keep load in loop body with label', () => {
      // Loop pattern where label prevents optimization
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('STA', AsmAddressingMode.ZeroPage, 0x50),
            createLabelElement('.loop'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
            instr('BNE', AsmAddressingMode.Relative, undefined, '.loop'),
          ],
        }],
      };

      const result = pass.run(program);

      // Label breaks backward scan — LDA must be kept
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Multiple Eliminations in Sequence
  // ========================================================================

  describe('multiple eliminations', () => {
    it('should remove multiple redundant loads in same section', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50), // redundant
        instr('STX', AsmAddressingMode.ZeroPage, 0x60),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x60), // redundant
        instr('STY', AsmAddressingMode.Absolute, 0x0400),
        instr('LDY', AsmAddressingMode.Absolute, 0x0400), // redundant
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(3);
      expect(result.program.sections[0].elements).toHaveLength(3);
    });

    it('should handle chained store-load pairs correctly', () => {
      // STA $50; LDA $50(rem); STA $60; LDA $60(rem)
      // After removing first LDA, STA $60 follows STA $50
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
        instr('STA', AsmAddressingMode.ZeroPage, 0x60),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x60),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Both LDAs should be removed
      expect(result.program.sections[0].elements).toHaveLength(2);
    });
  });

  // ========================================================================
  // NOP Transparency
  // ========================================================================

  describe('NOP transparency', () => {
    it('should look past NOP instructions', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('NOP'),
        instr('NOP'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);

      // NOP doesn't modify A or memory — LDA is still redundant
      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(3);
    });
  });

  // ========================================================================
  // CLC/SEC Transparency
  // ========================================================================

  describe('flag instructions transparency', () => {
    it('should look past CLC (does not modify registers or memory)', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x50),
        instr('CLC'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x50),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2);
    });

    it('should look past SEC (does not modify registers or memory)', () => {
      const program = createTestProgram([
        instr('STX', AsmAddressingMode.ZeroPage, 0x60),
        instr('SEC'),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x60),
      ]);

      const result = pass.run(program);
      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2);
    });
  });
});
