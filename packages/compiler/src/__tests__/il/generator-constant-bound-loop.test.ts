/**
 * IL Generator - Constant-Bound Loop Template Tests
 *
 * Tests for Item C — Constant-Bound Loop Template Specialization.
 *
 * Verifies that `generateForCondition()` correctly routes to
 * `generateForConditionConstant()` for compile-time constant bounds
 * and `generateForConditionDynamic()` for runtime expressions.
 *
 * The constant-bound path produces a simpler IL pattern:
 *   LOAD counter / CMP_IMM / JUMP (no PHA/PLA, no ZP temp slots)
 *
 * The dynamic-bound path uses PHA/PLA + ZP temp:
 *   LOAD counter / PHA / [eval end] / STA temp / PLA / CMP temp / JUMP
 *
 * @module __tests__/il/generator-constant-bound-loop
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../il/enums.js';
import type { ImmediateOperand } from '../../il/operands.js';
import {
  compileToIL,
  getMainFunction,
  countOpcode,
  hasOpcode,
  wrapInModule,
} from './helpers/index.js';

// ============================================================================
// Constant-Bound Ascending: Detailed IL Pattern Tests
// ============================================================================

describe('IL Generator: Constant-bound ascending for-loop template', () => {
  /**
   * Constant ascending `for i = 0 to 9` should emit CMP_IMM with end+1 (10),
   * not end (9), so that all values 0..9 are iterated.
   */
  it('should emit CMP_IMM with end+1 for ascending constant bound', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        for (i = 0 to 9) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // Find the CMP_IMM instruction — it should compare with 10 (end+1)
    const cmpInstr = instructions.find(
      instr => instr.opcode === ILOpcode.CMP_IMM
    );
    expect(cmpInstr).toBeDefined();
    // The immediate operand should be end+1 = 10
    expect((cmpInstr!.operands[0] as ImmediateOperand).value).toBe(10);
  });

  /**
   * Constant ascending should emit JUMP_GE to exit when i >= end+1.
   */
  it('should emit JUMP_GE for ascending constant exit', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        for (i = 0 to 9) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // Ascending constant uses JUMP_GE (exit if i >= end+1)
    expect(hasOpcode(instructions, ILOpcode.JUMP_GE)).toBe(true);
  });

  /**
   * Constant ascending should NOT use any stack operations (PHA/PLA).
   * The bound is known at compile time — no need to save/restore counter.
   */
  it('should have zero stack operations for constant ascending', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        for (i = 0 to 62) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    expect(countOpcode(instructions, ILOpcode.PUSH_A)).toBe(0);
    expect(countOpcode(instructions, ILOpcode.POP_A)).toBe(0);
  });

  /**
   * Constant ascending should NOT use CMP_BYTE (slot comparison).
   * Slot comparison is only needed for dynamic bounds stored in ZP temp.
   */
  it('should NOT use CMP_BYTE for constant bound', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        for (i = 0 to 9) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // Constant bounds should NOT use slot comparison
    expect(hasOpcode(instructions, ILOpcode.CMP_BYTE)).toBe(false);
  });
});

// ============================================================================
// Constant-Bound Descending: Detailed IL Pattern Tests
// ============================================================================

describe('IL Generator: Constant-bound descending for-loop template', () => {
  /**
   * Constant descending `for i = 9 downto 0` should emit CMP_IMM with
   * end value directly (0), and JUMP_LT to exit when i < end.
   */
  it('should emit CMP_IMM with end value for descending constant bound', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        for (i = 9 downto 0) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // For descending, CMP_IMM compares with end (0)
    const cmpInstr = instructions.find(
      instr => instr.opcode === ILOpcode.CMP_IMM
    );
    expect(cmpInstr).toBeDefined();
    expect((cmpInstr!.operands[0] as ImmediateOperand).value).toBe(0);
  });

  /**
   * Constant descending should emit JUMP_LT to exit when i < end.
   */
  it('should emit JUMP_LT for descending constant exit', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        for (i = 9 downto 0) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // Descending constant uses JUMP_LT (exit if i < end)
    expect(hasOpcode(instructions, ILOpcode.JUMP_LT)).toBe(true);
  });

  /**
   * Constant descending with non-zero end should also work correctly.
   */
  it('should emit correct CMP_IMM for descending with non-zero end', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        for (i = 20 downto 5) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // For descending to 5, CMP_IMM should compare with 5
    const cmpInstr = instructions.find(
      instr => instr.opcode === ILOpcode.CMP_IMM
    );
    expect(cmpInstr).toBeDefined();
    expect((cmpInstr!.operands[0] as ImmediateOperand).value).toBe(5);
  });

  /**
   * Constant descending should have zero stack operations.
   */
  it('should have zero stack operations for constant descending', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        for (i = 9 downto 0) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    expect(countOpcode(instructions, ILOpcode.PUSH_A)).toBe(0);
    expect(countOpcode(instructions, ILOpcode.POP_A)).toBe(0);
  });
});

// ============================================================================
// Byte 255 Special Case: Post-Body Exit Pattern
// ============================================================================

describe('IL Generator: Constant-bound byte 255 post-body exit', () => {
  /**
   * Ascending to 255 (byte max) cannot use CMP #256 (overflow).
   * The condition should return early (no pre-body exit check),
   * and generateByte255ExitCheck handles exit after the body.
   */
  it('should have no CMP_IMM 256 for byte ascending to 255', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        for (i = 0 to 255) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // There should be NO CMP_IMM with value 256 (would overflow to 0)
    const cmpInstructions = instructions.filter(
      instr => instr.opcode === ILOpcode.CMP_IMM
    );
    for (const cmp of cmpInstructions) {
      const cmpValue = (cmp.operands[0] as ImmediateOperand).value;
      expect(cmpValue).not.toBe(256);
      expect(cmpValue).not.toBe(0); // 256 mod 256 = 0, which is also wrong
    }
  });

  /**
   * The byte 255 post-body exit uses CMP_IMM 255 + JUMP_GE to
   * prevent overflow before incrementing.
   */
  it('should emit CMP_IMM 255 + JUMP_GE for post-body exit check', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        for (i = 0 to 255) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // The post-body exit should use CMP_IMM 255
    const cmp255 = instructions.find(
      instr => instr.opcode === ILOpcode.CMP_IMM &&
        (instr.operands[0] as ImmediateOperand).value === 255
    );
    expect(cmp255).toBeDefined();

    // And JUMP_GE to exit when counter >= 255 (overflow would occur)
    expect(hasOpcode(instructions, ILOpcode.JUMP_GE)).toBe(true);
  });
});

// ============================================================================
// Dynamic-Bound: Architectural Isolation Tests
// ============================================================================

describe('IL Generator: Dynamic-bound for-loop uses correct template', () => {
  /**
   * Dynamic ascending should use STORE_BYTE to save end to ZP temp slot.
   * This is the hallmark of the dynamic template — constant template
   * never uses STORE_BYTE for the end value.
   */
  it('should use STORE_BYTE to save dynamic end to ZP temp', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        let bound: byte = 10;
        for (i = 0 to bound) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // Dynamic template stores end to ZP temp — STORE_BYTE appears
    // (beyond the initial counter store and poke body store)
    const storeCount = countOpcode(instructions, ILOpcode.STORE_BYTE);

    // At minimum: 1 for counter init + 1 for ZP temp end = 2
    // (plus any stores in the loop body)
    expect(storeCount).toBeGreaterThanOrEqual(2);
  });

  /**
   * Dynamic ascending should use CMP_BYTE (slot), NOT CMP_IMM.
   * The CMP_BYTE compares counter with the stored ZP temp end value.
   */
  it('should use CMP_BYTE for dynamic bound comparison', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        let bound: byte = 10;
        for (i = 0 to bound) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // Dynamic bounds use slot comparison
    expect(hasOpcode(instructions, ILOpcode.CMP_BYTE)).toBe(true);
  });

  /**
   * Dynamic descending should also use STORE_BYTE + CMP_BYTE pattern.
   */
  it('should use STORE_BYTE + CMP_BYTE for dynamic descending', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        let bound: byte = 0;
        for (i = 10 downto bound) {
          poke(53280, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // Dynamic descending also uses slot comparison
    expect(hasOpcode(instructions, ILOpcode.CMP_BYTE)).toBe(true);

    // And balanced stack operations
    const pushCount = countOpcode(instructions, ILOpcode.PUSH_A);
    const popCount = countOpcode(instructions, ILOpcode.POP_A);
    expect(pushCount).toBe(popCount);
  });
});

// ============================================================================
// Mixed Loops: Multiple loops with different bound types
// ============================================================================

describe('IL Generator: Mixed constant and dynamic bound loops', () => {
  /**
   * A function with both constant-bound and dynamic-bound loops
   * should use the appropriate template for each.
   */
  it('should use different templates for constant vs dynamic in same function', () => {
    const source = wrapInModule(`
      export function main(): void {
        let i: byte = 0;
        let bound: byte = 5;

        for (i = 0 to 9) {
          poke(53280, i);
        }

        for (i = 0 to bound) {
          poke(53281, i);
        }
      }
    `);

    const program = compileToIL(source);
    const mainFn = getMainFunction(program);
    expect(mainFn).toBeDefined();

    const instructions = mainFn!.instructions;

    // Should have CMP_IMM from the constant-bound loop (CMP #10)
    expect(hasOpcode(instructions, ILOpcode.CMP_IMM)).toBe(true);

    // Should have CMP_BYTE from the dynamic-bound loop
    expect(hasOpcode(instructions, ILOpcode.CMP_BYTE)).toBe(true);

    // Should have exactly 1 PUSH_A / POP_A pair (from the dynamic loop only)
    const pushCount = countOpcode(instructions, ILOpcode.PUSH_A);
    const popCount = countOpcode(instructions, ILOpcode.POP_A);
    expect(pushCount).toBe(1);
    expect(popCount).toBe(1);
  });
});
