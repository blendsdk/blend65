/**
 * StoreLoadPass — Word Parameter Store/Load Elimination Tests
 *
 * Tests the interleaved STA/STX → LDA/LDX pattern produced by the compiler
 * when inlining functions with word parameters. The backward scan should
 * correctly look past non-aliasing instructions to find matching stores.
 *
 * **Key insight:** When storing/loading a 16-bit word, the compiler generates:
 *   STA $lo  ; store low byte (A register)
 *   STX $hi  ; store high byte (X register)
 *   LDA $lo  ; reload low byte ← redundant (A still has value)
 *   LDX $hi  ; reload high byte ← redundant (X still has value)
 *
 * The StoreLoadPass handles this because:
 * - For LDA $lo: STX $hi doesn't modify A and doesn't alias $lo → scan finds STA $lo
 * - For LDX $hi: LDA $lo doesn't modify X and doesn't write memory → scan finds STX $hi
 *
 * This pattern is critical for inlined function performance on the C64.
 */

import { describe, it, expect } from 'vitest';
import { StoreLoadPass } from '../../../../../codegen/asm-il/optimizer/passes/store-load.js';
import {
  AsmAddressingMode,
  createAsmILProgram,
  createInstructionElement,
  createCommentElement,
  createLabelElement,
} from '../../../../../codegen/asm-il/types.js';
import type { AsmILProgram, AsmILElement } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates an instruction element for testing.
 *
 * @param mnemonic - 6502 instruction mnemonic
 * @param mode - Addressing mode (defaults to Implied)
 * @param operand - Numeric operand (optional)
 * @param labelOperand - Label operand (optional)
 * @returns AsmILElement with kind 'instruction'
 */
function instr(
  mnemonic: string,
  mode: AsmAddressingMode = AsmAddressingMode.Implied,
  operand?: number,
  labelOperand?: string
): AsmILElement {
  return createInstructionElement(mnemonic, mode, operand, labelOperand);
}

/**
 * Creates a test program from a list of elements.
 *
 * @param elements - Array of ASM-IL elements
 * @param sectionName - Section name (defaults to 'code')
 * @returns AsmILProgram with a single section containing the elements
 */
function createTestProgram(
  elements: AsmILElement[],
  sectionName = 'code'
): AsmILProgram {
  return {
    ...createAsmILProgram('test'),
    sections: [{ name: sectionName, elements }],
  };
}

/**
 * Get the instruction mnemonic at a given index in the first section.
 *
 * @param program - The ASM-IL program
 * @param index - Element index
 * @returns The mnemonic string
 * @throws Error if element is not an instruction
 */
function getMnemonic(program: AsmILProgram, index: number): string {
  const el = program.sections[0].elements[index];
  if (el.kind !== 'instruction') throw new Error(`Element ${index} is not an instruction`);
  return el.instruction.mnemonic;
}

/**
 * Get the numeric operand at a given index in the first section.
 *
 * @param program - The ASM-IL program
 * @param index - Element index
 * @returns The operand number
 * @throws Error if element is not an instruction
 */
function getOperand(program: AsmILProgram, index: number): number | undefined {
  const el = program.sections[0].elements[index];
  if (el.kind !== 'instruction') throw new Error(`Element ${index} is not an instruction`);
  return el.instruction.operand;
}

describe('StoreLoadPass — Word Parameter Patterns', () => {
  const pass = new StoreLoadPass();

  // ========================================================================
  // Core Word Parameter Pattern: STA/STX → LDA/LDX (inlined param)
  // ========================================================================

  describe('interleaved word param store/load (STA+STX → LDA+LDX)', () => {
    it('should remove both LDA and LDX in full word-param pattern', () => {
      // This is the exact pattern produced by function inlining for word params:
      //   STA $07  ; store low byte of param
      //   STX $08  ; store high byte of param
      //   LDA $07  ; reload low byte ← REDUNDANT (A still has value)
      //   LDX $08  ; reload high byte ← REDUNDANT (X still has value)
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x08),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x08),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Both LDA and LDX should be removed, leaving only STA + STX
      expect(result.program.sections[0].elements).toHaveLength(2);
      expect(getMnemonic(result.program, 0)).toBe('STA');
      expect(getOperand(result.program, 0)).toBe(0x07);
      expect(getMnemonic(result.program, 1)).toBe('STX');
      expect(getOperand(result.program, 1)).toBe(0x08);
    });

    it('should remove both loads with higher zero-page addresses', () => {
      // Different ZP slot pair — same pattern at $20/$21
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x20),
        instr('STX', AsmAddressingMode.ZeroPage, 0x21),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x20),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x21),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2);
      expect(getMnemonic(result.program, 0)).toBe('STA');
      expect(getMnemonic(result.program, 1)).toBe('STX');
    });

    it('should remove both loads with non-adjacent zero-page addresses', () => {
      // Word stored at non-adjacent slots ($10, $15) — still works
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x10),
        instr('STX', AsmAddressingMode.ZeroPage, 0x15),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x10),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x15),
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.program.sections[0].elements).toHaveLength(2);
    });

    it('should report correct stats for word-param elimination', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x08),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x08),
      ]);

      const result = pass.run(program);

      // Two redundant loads eliminated
      expect(result.stats.patternsMatched).toBe(2);
      expect(result.stats.instructionsRemoved).toBe(2);
      // ZP loads: 2 bytes, 3 cycles each → 4 bytes, 6 cycles saved
      expect(result.stats.estimatedBytesSaved).toBe(4);
      expect(result.stats.estimatedCyclesSaved).toBe(6);
    });
  });

  // ========================================================================
  // Word Pattern with Inline Comments (inliner metadata)
  // ========================================================================

  describe('word param pattern with inline comments between', () => {
    it('should eliminate loads with comments between store and load pairs', () => {
      // The inliner inserts metadata comments between store and load pairs:
      //   STA $07         ; caller side
      //   STX $08         ; caller side
      //   ; [inlined] load spriteAddr
      //   LDA $07         ← REDUNDANT
      //   LDX $08         ← REDUNDANT
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('STA', AsmAddressingMode.ZeroPage, 0x07),
            instr('STX', AsmAddressingMode.ZeroPage, 0x08),
            createCommentElement('[inlined] load spriteAddr (word)'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x07),
            instr('LDX', AsmAddressingMode.ZeroPage, 0x08),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // STA, STX, comment remain — both loads removed
      const remaining = result.program.sections[0].elements;
      expect(remaining).toHaveLength(3);
      expect(remaining[0].kind).toBe('instruction');
      expect(remaining[1].kind).toBe('instruction');
      expect(remaining[2].kind).toBe('comment');
    });

    it('should eliminate loads with multiple comments between', () => {
      // Multiple comment lines between store and load
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('STA', AsmAddressingMode.ZeroPage, 0x07),
            instr('STX', AsmAddressingMode.ZeroPage, 0x08),
            createCommentElement('[inlined] function: updateSprite'),
            createCommentElement('param spriteAddr (word)'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x07),
            instr('LDX', AsmAddressingMode.ZeroPage, 0x08),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // STA, STX, 2 comments remain — both loads removed
      expect(result.program.sections[0].elements).toHaveLength(4);
    });
  });

  // ========================================================================
  // Multiple Word Parameters (common in inlined functions)
  // ========================================================================

  describe('multiple word params from same inlined call', () => {
    it('should eliminate all redundant loads for two word params', () => {
      // Two word params: spriteAddr ($07/$08) and destAddr ($09/$0A)
      const program = createTestProgram([
        // Param 1: spriteAddr
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x08),
        // Param 2: destAddr
        instr('STA', AsmAddressingMode.ZeroPage, 0x09),
        instr('STX', AsmAddressingMode.ZeroPage, 0x0A),
        // Inlined body reloads both
        instr('LDA', AsmAddressingMode.ZeroPage, 0x09), // reload destAddr lo
        instr('LDX', AsmAddressingMode.ZeroPage, 0x0A), // reload destAddr hi
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // LDA $09 and LDX $0A are redundant (STA $09 / STX $0A are above)
      // Note: LDA $07 / LDX $08 would NOT be found because:
      //   - STA $09 is between STA $07 and any hypothetical LDA $07
      //   - But STA $09 writes to $09, not $07 → no alias conflict
      // However there's no LDA $07 / LDX $08 in this test
      expect(result.program.sections[0].elements).toHaveLength(4);
    });

    it('should handle mixed byte and word param reload patterns', () => {
      // Byte param in $06, word param in $07/$08
      // Note: The backward scan uses the ORIGINAL elements array, so
      // LDA $06 at index 3 blocks the scan for LDA $07 at index 4
      // (LDA modifies A, breaking the STA→LDA chain). This is correct
      // conservative behavior — the pass doesn't know LDA $06 will be removed.
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x06), // byte param
        instr('STA', AsmAddressingMode.ZeroPage, 0x07), // word param lo
        instr('STX', AsmAddressingMode.ZeroPage, 0x08), // word param hi
        // Inlined body reloads
        instr('LDA', AsmAddressingMode.ZeroPage, 0x06), // reload byte ← REDUNDANT (finds STA $06)
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // reload word lo ← KEPT (LDA $06 modifies A)
        instr('LDX', AsmAddressingMode.ZeroPage, 0x08), // reload word hi ← REDUNDANT (finds STX $08)
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // 2 of 3 loads eliminated: LDA $06 (byte) + LDX $08 (word hi)
      // LDA $07 (word lo) kept because LDA $06 in original stream modifies A
      // A second iteration of the optimizer would remove LDA $07 after LDA $06 is gone
      expect(result.stats.patternsMatched).toBe(2);
      expect(result.program.sections[0].elements).toHaveLength(4);
    });
  });

  // ========================================================================
  // Word Pattern with Register Modification Between
  // ========================================================================

  describe('word param pattern broken by register modification', () => {
    it('should keep LDA when A is modified between STA and LDA', () => {
      // If the inlined body modifies A between the stores and loads,
      // LDA must be kept but LDX can still be eliminated
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x08),
        instr('TXA'), // modifies A — breaks STA→LDA chain
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // NEEDED (A was modified)
        instr('LDX', AsmAddressingMode.ZeroPage, 0x08), // REDUNDANT (X unchanged)
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Only LDX $08 is removed; LDA $07 must stay
      expect(result.program.sections[0].elements).toHaveLength(4);
      expect(getMnemonic(result.program, 0)).toBe('STA');
      expect(getMnemonic(result.program, 1)).toBe('STX');
      expect(getMnemonic(result.program, 2)).toBe('TXA');
      expect(getMnemonic(result.program, 3)).toBe('LDA');
    });

    it('should keep LDX when X is modified between STX and LDX', () => {
      // If X is modified, LDX must stay but LDA can be eliminated
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x08),
        instr('INX'), // modifies X — breaks STX→LDX chain
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // REDUNDANT (A unchanged)
        instr('LDX', AsmAddressingMode.ZeroPage, 0x08), // NEEDED (X was modified)
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Only LDA $07 is removed; LDX $08 must stay
      expect(result.program.sections[0].elements).toHaveLength(4);
      expect(getMnemonic(result.program, 0)).toBe('STA');
      expect(getMnemonic(result.program, 1)).toBe('STX');
      expect(getMnemonic(result.program, 2)).toBe('INX');
      expect(getMnemonic(result.program, 3)).toBe('LDX');
    });

    it('should keep both loads when both registers are modified', () => {
      // Both A and X are modified — no elimination possible
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x08),
        instr('LDA', AsmAddressingMode.Immediate, 0xFF), // modifies A
        instr('TAX'), // modifies X
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // NEEDED
        instr('LDX', AsmAddressingMode.ZeroPage, 0x08), // NEEDED
      ]);

      const result = pass.run(program);

      // Neither load can be eliminated (both registers were modified)
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Word Pattern with Memory Aliasing Between
  // ========================================================================

  describe('word param pattern broken by memory aliasing', () => {
    it('should keep LDA when another store overwrites the low byte', () => {
      // STX writes to $07 (same address as STA $07) — aliases!
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x07), // overwrites $07!
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // NEEDED (memory changed)
      ]);

      const result = pass.run(program);

      // LDA $07 cannot be eliminated — STX $07 overwrote the value
      expect(result.changed).toBe(false);
    });

    it('should keep LDX when INC modifies the high byte between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x08),
        instr('INC', AsmAddressingMode.ZeroPage, 0x08), // modifies $08
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // REDUNDANT ($07 untouched)
        instr('LDX', AsmAddressingMode.ZeroPage, 0x08), // NEEDED ($08 was INC'd)
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      // Only LDA $07 can be removed; LDX $08 must stay
      expect(result.program.sections[0].elements).toHaveLength(4);
      expect(getMnemonic(result.program, 3)).toBe('LDX');
    });
  });

  // ========================================================================
  // Word Pattern with Label Between (blocks optimization)
  // ========================================================================

  describe('word param pattern blocked by label', () => {
    it('should keep both loads when a label appears between stores and loads', () => {
      // A label between the stores and loads means the loads could
      // be reached from a branch with unknown register state
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('STA', AsmAddressingMode.ZeroPage, 0x07),
            instr('STX', AsmAddressingMode.ZeroPage, 0x08),
            createLabelElement('.inlined_body'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // NEEDED (label breaks scan)
            instr('LDX', AsmAddressingMode.ZeroPage, 0x08), // NEEDED (label breaks scan)
          ],
        }],
      };

      const result = pass.run(program);

      // Labels break backward analysis — both loads must be kept
      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Word Pattern with Control Flow Between (blocks optimization)
  // ========================================================================

  describe('word param pattern blocked by control flow', () => {
    it('should keep loads when a conditional branch appears between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x08),
        instr('BEQ', AsmAddressingMode.Relative, undefined, '.skip'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // NEEDED (branch breaks scan)
        instr('LDX', AsmAddressingMode.ZeroPage, 0x08), // NEEDED (branch breaks scan)
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });

    it('should keep loads when JSR appears between', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x08),
        instr('JSR', AsmAddressingMode.Absolute, undefined, 'helper_fn'),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // NEEDED (JSR breaks scan)
        instr('LDX', AsmAddressingMode.ZeroPage, 0x08), // NEEDED (JSR breaks scan)
      ]);

      const result = pass.run(program);

      expect(result.changed).toBe(false);
    });
  });

  // ========================================================================
  // Real-World Inlined Function Patterns
  // ========================================================================

  describe('real-world inlined function patterns', () => {
    it('should optimize sprite address parameter passing (spinning-line pattern)', () => {
      // Real pattern from spinning-line: @lineFrames address passed to updateSprite
      //   LDA #<__data_lineFrames   ; load address low byte
      //   LDX #>__data_lineFrames   ; load address high byte
      //   STA $07                    ; store to param slot lo
      //   STX $08                    ; store to param slot hi
      //   ; [inlined updateSprite]
      //   LDA $07                    ; reload ← REDUNDANT
      //   LDX $08                    ; reload ← REDUNDANT
      //   STA $FB                    ; use as indirect pointer
      //   STX $FC
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            instr('LDA', AsmAddressingMode.Immediate, 0x00, '__data_lineFrames'),
            instr('LDX', AsmAddressingMode.Immediate, 0x20, '__data_lineFrames'),
            instr('STA', AsmAddressingMode.ZeroPage, 0x07),
            instr('STX', AsmAddressingMode.ZeroPage, 0x08),
            createCommentElement('[inlined] updateSprite — param spriteAddr'),
            instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // REDUNDANT
            instr('LDX', AsmAddressingMode.ZeroPage, 0x08), // REDUNDANT
            instr('STA', AsmAddressingMode.ZeroPage, 0xFB),
            instr('STX', AsmAddressingMode.ZeroPage, 0xFC),
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);
      // Remaining: LDA #imm, LDX #imm, STA $07, STX $08, comment, STA $FB, STX $FC
      expect(result.program.sections[0].elements).toHaveLength(7);
    });

    it('should optimize byte param followed by word param', () => {
      // Common pattern: byte frameIndex ($06) + word spriteAddr ($07/$08)
      const program: AsmILProgram = {
        ...createAsmILProgram('test'),
        sections: [{
          name: 'code',
          elements: [
            // Byte param: frameIndex
            instr('LDA', AsmAddressingMode.Immediate, 3),
            instr('STA', AsmAddressingMode.ZeroPage, 0x06),
            // Word param: spriteAddr
            instr('LDA', AsmAddressingMode.Immediate, 0x00),
            instr('LDX', AsmAddressingMode.Immediate, 0x20),
            instr('STA', AsmAddressingMode.ZeroPage, 0x07),
            instr('STX', AsmAddressingMode.ZeroPage, 0x08),
            createCommentElement('[inlined] function body'),
            // Inlined body reloads word param
            instr('LDA', AsmAddressingMode.ZeroPage, 0x07), // REDUNDANT
            instr('LDX', AsmAddressingMode.ZeroPage, 0x08), // REDUNDANT
          ],
        }],
      };

      const result = pass.run(program);

      expect(result.changed).toBe(true);
      expect(result.stats.patternsMatched).toBe(2);
      // 9 elements - 2 redundant loads = 7
      expect(result.program.sections[0].elements).toHaveLength(7);
    });
  });

  // ========================================================================
  // Idempotency for Word Patterns
  // ========================================================================

  describe('idempotency', () => {
    it('should be stable after first pass on word-param pattern', () => {
      const program = createTestProgram([
        instr('STA', AsmAddressingMode.ZeroPage, 0x07),
        instr('STX', AsmAddressingMode.ZeroPage, 0x08),
        instr('LDA', AsmAddressingMode.ZeroPage, 0x07),
        instr('LDX', AsmAddressingMode.ZeroPage, 0x08),
      ]);

      const result1 = pass.run(program);
      expect(result1.changed).toBe(true);

      const result2 = pass.run(result1.program);
      expect(result2.changed).toBe(false);
      // Same reference returned when nothing changed
      expect(result2.program).toBe(result1.program);
    });
  });
});
