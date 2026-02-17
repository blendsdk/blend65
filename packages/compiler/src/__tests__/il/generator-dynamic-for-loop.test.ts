/**
 * IL Generator - Dynamic For-Loop Stack Balance Tests
 *
 * Tests that dynamic-bound for-loops (where the end value is a variable,
 * not a compile-time constant) produce balanced PHA/PLA pairs in the
 * loop condition. This verifies the fix for Item B — Double PLA Stack Fix.
 *
 * Previously, the dynamic ascending path had 2 POP_A but only 1 PUSH_A,
 * causing stack corruption on every loop iteration. The fix stores the
 * end expression to a ZP temp slot and uses CMP_BYTE for comparison.
 *
 * @module __tests__/il/generator-dynamic-for-loop
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../il/enums.js';
import {
  compileToIL,
  getMainFunction,
  countOpcode,
  hasOpcode,
  wrapInModule,
} from './helpers/index.js';

// ============================================================================
// Dynamic Ascending For-Loop Tests
// ============================================================================

describe('IL Generator: Dynamic ascending for-loop stack balance', () => {
  /**
   * A dynamic ascending for-loop should have exactly balanced PHA/PLA.
   * The condition path: PHA counter → generate end → STA temp → PLA counter → CMP temp
   */
  it('should emit balanced PUSH_A and POP_A for dynamic ascending bound', () => {
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

    // Count PUSH_A and POP_A in the entire function.
    // The dynamic-bound path should have exactly 1 PHA and 1 PLA per condition.
    const pushCount = countOpcode(instructions, ILOpcode.PUSH_A);
    const popCount = countOpcode(instructions, ILOpcode.POP_A);

    // Stack must be balanced: equal number of pushes and pops
    expect(pushCount).toBe(popCount);

    // There should be exactly 1 PUSH_A (from the dynamic condition)
    expect(pushCount).toBe(1);
  });

  /**
   * The dynamic ascending path should use CMP_BYTE (slot comparison) to
   * compare the counter with the stored end value, not the broken
   * CMP_IMM 255 fallback.
   */
  it('should use CMP_BYTE (slot) instead of CMP_IMM 255 fallback', () => {
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

    // The dynamic condition should use CMP_BYTE (comparing counter with ZP temp slot)
    expect(hasOpcode(instructions, ILOpcode.CMP_BYTE)).toBe(true);
  });

  /**
   * The dynamic ascending path should use JUMP_GT to exit (counter > end),
   * ensuring all values from start through end are iterated.
   */
  it('should emit JUMP_GT for ascending dynamic bound exit', () => {
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

    // Ascending exits when counter > end
    expect(hasOpcode(instructions, ILOpcode.JUMP_GT)).toBe(true);
  });
});

// ============================================================================
// Dynamic Descending For-Loop Tests
// ============================================================================

describe('IL Generator: Dynamic descending for-loop stack balance', () => {
  /**
   * A dynamic descending for-loop should also have balanced PHA/PLA.
   */
  it('should emit balanced PUSH_A and POP_A for dynamic descending bound', () => {
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

    const pushCount = countOpcode(instructions, ILOpcode.PUSH_A);
    const popCount = countOpcode(instructions, ILOpcode.POP_A);

    // Stack must be balanced
    expect(pushCount).toBe(popCount);
    expect(pushCount).toBe(1);
  });

  /**
   * The dynamic descending path should use JUMP_LT to exit (counter < end).
   */
  it('should emit JUMP_LT for descending dynamic bound exit', () => {
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

    // Descending exits when counter < end
    expect(hasOpcode(instructions, ILOpcode.JUMP_LT)).toBe(true);
  });
});

// ============================================================================
// Constant-Bound Comparison (No Stack Ops)
// ============================================================================

describe('IL Generator: Constant-bound for-loop (no stack ops)', () => {
  /**
   * Constant-bound for-loops should NOT use PHA/PLA because the bound is
   * known at compile time — CMP_IMM is used directly.
   */
  it('should have zero PUSH_A and POP_A for constant ascending bound', () => {
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

    // Constant bounds don't need stack operations
    const pushCount = countOpcode(instructions, ILOpcode.PUSH_A);
    const popCount = countOpcode(instructions, ILOpcode.POP_A);

    expect(pushCount).toBe(0);
    expect(popCount).toBe(0);
  });

  /**
   * Constant-bound for-loops should use CMP_IMM (immediate comparison).
   */
  it('should use CMP_IMM for constant bound (not CMP_BYTE slot)', () => {
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

    // Constant bounds use immediate comparison
    expect(hasOpcode(instructions, ILOpcode.CMP_IMM)).toBe(true);
  });
});
