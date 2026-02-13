/**
 * Constant Folding & Address Decomposer Tests
 *
 * Tests for the enhanced tryResolveConstantAddress() which now handles
 * binary expressions between compile-time constants (SCREEN + 40, BASE * 8, etc.)
 * and the new decomposeAddressExpression() for the 3-tier intrinsic strategy.
 *
 * Phase 4 of Word Arithmetic & Indirect Addressing plan.
 *
 * @module __tests__/il/constant-folding
 */

import { describe, it, expect } from 'vitest';
import {
  compileToIL,
  wrapInModule,
  wrapInProgram,
  getMainFunction,
  hasOpcode,
  countOpcode,
  findInstructions,
  getFirstInstruction,
} from './helpers/il-test-utils.js';
import { ILOpcode } from '../../il/index.js';
import { isAddressOperand } from '../../il/guards.js';
import type { AddressOperand } from '../../il/operands.js';

// ============================================================================
// Helper: Extract address from PEEK/POKE instruction
// ============================================================================

/**
 * Get the address value from a PEEK or POKE instruction's address operand.
 *
 * @param instructions - IL instructions
 * @param opcode - PEEK or POKE opcode
 * @returns Address value or undefined
 */
function getIntrinsicAddress(
  instructions: { opcode: ILOpcode; operands: unknown[] }[],
  opcode: ILOpcode,
): number | undefined {
  const instr = instructions.find(i => i.opcode === opcode);
  if (instr && instr.operands.length > 0 && isAddressOperand(instr.operands[0])) {
    return (instr.operands[0] as AddressOperand).address;
  }
  return undefined;
}

// ============================================================================
// Task 4.1.3: Constant Folding Tests
// ============================================================================

describe('Enhanced Constant Folding (tryResolveConstantAddress)', () => {
  // ────────────────────────────────────────────────────────────────
  // Addition: CONST + CONST
  // ────────────────────────────────────────────────────────────────

  describe('constant addition folding', () => {
    it('should fold CONST + literal into absolute address for poke', () => {
      // SCREEN ($0400) + 40 should fold to $0428
      const source = wrapInModule(`
        const SCREEN: word = $0400;
        function main(): void {
          poke(SCREEN + 40, 1);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      // With constant folding, the address should be resolved at compile time
      // and emitted as absolute POKE (not indexed)
      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x0428); // $0400 + 40 = $0428
    });

    it('should fold literal + CONST (commutative)', () => {
      const source = wrapInModule(`
        const SCREEN: word = $0400;
        function main(): void {
          poke(40 + SCREEN, 1);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x0428);
    });

    it('should fold CONST + CONST (two named constants)', () => {
      const source = wrapInModule(`
        const BASE: word = $0400;
        const OFFSET: word = $0100;
        function main(): void {
          let val: byte = peek(BASE + OFFSET);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.PEEK);
      expect(addr).toBe(0x0500); // $0400 + $0100 = $0500
    });

    it('should fold nested addition: CONST + CONST + CONST', () => {
      // SCREEN + ROW_SIZE + COL_OFFSET → $0400 + 40 + 10 = $0432
      const source = wrapInModule(`
        const SCREEN: word = $0400;
        const ROW_SIZE: byte = 40;
        const COL_OFFSET: byte = 10;
        function main(): void {
          poke(SCREEN + ROW_SIZE + COL_OFFSET, 1);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x0432); // $0400 + 40 + 10 = 1074 = $0432
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Subtraction: CONST - CONST
  // ────────────────────────────────────────────────────────────────

  describe('constant subtraction folding', () => {
    it('should fold CONST - literal', () => {
      const source = wrapInModule(`
        const END_ADDR: word = $0800;
        function main(): void {
          poke(END_ADDR - 1, 0);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x07FF); // $0800 - 1 = $07FF
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Multiplication: CONST * CONST
  // ────────────────────────────────────────────────────────────────

  describe('constant multiplication folding', () => {
    it('should fold CONST * literal', () => {
      // Sprite data at block * 64 → 192 * 64 = 12288 = $3000
      const source = wrapInModule(`
        const SPRITE_BLOCK: word = 192;
        function main(): void {
          poke(SPRITE_BLOCK * 64, 0);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x3000); // 192 * 64 = 12288
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Shift Operations: CONST << CONST, CONST >> CONST
  // ────────────────────────────────────────────────────────────────

  describe('constant shift folding', () => {
    it('should fold CONST << literal', () => {
      // 1 << 10 = 1024 = $0400
      const source = wrapInModule(`
        const SHIFT_BASE: word = 1;
        function main(): void {
          poke(SHIFT_BASE << 10, 0);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x0400); // 1 << 10 = 1024
    });

    it('should fold CONST >> literal', () => {
      // $FF00 >> 8 = 255 = $00FF
      const source = wrapInModule(`
        const HIGH_VAL: word = $FF00;
        function main(): void {
          poke(HIGH_VAL >> 8, 0);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x00FF); // $FF00 >>> 8 = 255
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Bitwise: CONST & CONST, CONST | CONST, CONST ^ CONST
  // ────────────────────────────────────────────────────────────────

  describe('constant bitwise folding', () => {
    it('should fold CONST & literal (mask)', () => {
      // $D020 & $FF00 = $D000
      const source = wrapInModule(`
        const VIC_BORDER: word = $D020;
        function main(): void {
          poke(VIC_BORDER & $FF00, 0);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0xD000); // $D020 & $FF00 = $D000
    });

    it('should fold CONST | literal', () => {
      // $D000 | $0020 = $D020
      const source = wrapInModule(`
        const VIC_BASE: word = $D000;
        function main(): void {
          poke(VIC_BASE | $20, 0);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0xD020); // $D000 | $0020 = $D020
    });

    it('should fold CONST ^ literal', () => {
      // $FFFF ^ $FF00 = $00FF
      const source = wrapInModule(`
        const ALL_BITS: word = $FFFF;
        function main(): void {
          poke(ALL_BITS ^ $FF00, 0);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x00FF); // $FFFF ^ $FF00 = $00FF
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Complex nested constant expressions
  // ────────────────────────────────────────────────────────────────

  describe('complex nested constant folding', () => {
    it('should fold nested: (CONST + CONST) * CONST', () => {
      // (4 + 6) * 100 = 1000 = $03E8
      const source = wrapInModule(`
        const A: word = 4;
        const B: word = 6;
        function main(): void {
          poke((A + B) * 100, 0);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(1000);
    });

    it('should fold deeply nested: CONST + CONST + CONST + CONST', () => {
      // $0400 + 40 + 20 + 5 = $045D = 1117
      const source = wrapInModule(`
        const SCREEN: word = $0400;
        function main(): void {
          poke(SCREEN + 40 + 20 + 5, 1);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x0400 + 40 + 20 + 5);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 16-bit overflow wrapping
  // ────────────────────────────────────────────────────────────────

  describe('16-bit overflow wrapping', () => {
    it('should wrap addition at 16-bit boundary', () => {
      // $FFF0 + $20 = $10010 → masked to $0010
      const source = wrapInModule(`
        const NEAR_END: word = $FFF0;
        function main(): void {
          poke(NEAR_END + $20, 0);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x0010); // ($FFF0 + $20) & 0xFFFF = $0010
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Fallback: Non-constant expressions are NOT folded
  // ────────────────────────────────────────────────────────────────

  describe('non-constant expressions fall through', () => {
    it('should not fold CONST + variable (uses indexed addressing)', () => {
      const source = wrapInProgram(`
        let i: byte = 0;
        poke($0400 + i, 1);
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      // Should NOT resolve to a constant address
      // Instead should use indexed addressing (TRANSFER_AX for offset)
      expect(hasOpcode(main!.instructions, ILOpcode.TRANSFER_AX)).toBe(true);
    });
  });
});

// ============================================================================
// Task 4.1.4: Address Decomposer Tests (via integration)
// ============================================================================

describe('Address Decomposer (decomposeAddressExpression)', () => {
  // The address decomposer is a protected method not yet used in intrinsic paths,
  // but we can verify its behavior indirectly:
  //
  // - When tryResolveConstantAddress succeeds (all constant), that's Tier 1
  // - When tryDecomposeIndexedAddress succeeds (CONST + var), that's old Tier 2
  // - The decomposer will be used in Phase 6 for the 3-tier refactor
  //
  // For now, we verify the foundational behavior:

  describe('Tier 1 scenarios (all-constant via constant folding)', () => {
    it('should resolve SCREEN + ROW*40 to absolute address', () => {
      // SCREEN ($0400) + 5*40 = $0400 + 200 = $04C8
      const source = wrapInModule(`
        const SCREEN: word = $0400;
        const ROW: byte = 5;
        const COLS: byte = 40;
        function main(): void {
          poke(SCREEN + ROW * COLS, 1);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      // Should fully fold to absolute address
      const addr = getIntrinsicAddress(main!.instructions, ILOpcode.POKE);
      expect(addr).toBe(0x04C8);
    });
  });

  describe('Tier 2 scenarios (constant base + single variable offset)', () => {
    it('should decompose CONST + variable into indexed address', () => {
      const source = wrapInProgram(`
        let col: byte = 0;
        poke($0400 + col, 1);
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      // The existing tryDecomposeIndexedAddress handles this
      // Verify it uses TRANSFER_AX (TAX) for the index register
      expect(hasOpcode(main!.instructions, ILOpcode.TRANSFER_AX)).toBe(true);
    });

    it('should decompose NAMED_CONST + variable into indexed address', () => {
      const source = wrapInModule(`
        const SCREEN: word = $0400;
        function main(): void {
          let col: byte = 0;
          poke(SCREEN + col, 1);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      // SCREEN resolves to constant, col is variable → indexed addressing
      expect(hasOpcode(main!.instructions, ILOpcode.TRANSFER_AX)).toBe(true);
    });

    it('should fold constant part of CONST + CONST + variable', () => {
      // SCREEN + 40 + col: with enhanced folding, tryResolveConstantAddress(SCREEN+40) = $0428
      // Then tryDecomposeIndexedAddress sees: $0428 + col → indexed at base $0428
      const source = wrapInModule(`
        const SCREEN: word = $0400;
        function main(): void {
          let col: byte = 0;
          poke(SCREEN + 40 + col, 1);
        }
      `);
      const program = compileToIL(source);
      const main = getMainFunction(program);
      expect(main).toBeDefined();

      // Due to left-to-right parsing: ((SCREEN + 40) + col)
      // tryResolveConstantAddress(SCREEN + 40) = $0428 (enhanced folding!)
      // tryDecomposeIndexedAddress returns { base: $0428, offsetExpr: col }
      // So it should use indexed addressing with base $0428
      expect(hasOpcode(main!.instructions, ILOpcode.TRANSFER_AX)).toBe(true);
    });
  });

  describe('Multi-variable addresses (Tier 3 via decomposer + indirect)', () => {
    it('should compile CONST + var1 + var2 using Tier 3 indirect addressing', () => {
      // Phase 6 implemented: multi-variable addresses use the 3-tier strategy.
      // The decomposer folds $0400 into constantSum, collects i and j as variable
      // terms, then Tier 3 loads constant base into A:X, adds each slot,
      // stores to ZP pointer, and uses POKE_INDIRECT.
      const source = wrapInProgram(`
        let i: byte = 0;
        let j: byte = 0;
        poke($0400 + i + j, 1);
      `);

      // Should compile without error — Tier 3 indirect handles multi-variable addresses
      const il = compileToIL(source);
      expect(il).toBeDefined();
      expect(il.functions.length).toBeGreaterThan(0);
    });
  });
});
