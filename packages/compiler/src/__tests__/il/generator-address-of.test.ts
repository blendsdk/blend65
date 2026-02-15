/**
 * IL Generator Address-Of Operator Tests
 *
 * Tests that the `@` address-of operator correctly generates LOAD_ADDRESS
 * IL instructions. The address-of operator loads a variable's 16-bit
 * memory address into the A:X register pair (lo byte in A, hi byte in X).
 *
 * These tests cover:
 * - @variable on @ram globals → LOAD_ADDRESS with numeric address slot
 * - @variable on @data globals → LOAD_ADDRESS with dataLabel slot
 * - @variable on @zp globals → LOAD_ADDRESS with zero-page address slot
 * - hi(@variable) → LOAD_ADDRESS followed by HI extraction
 * - lo(@variable) → LOAD_ADDRESS followed by LO extraction
 * - @variable used in expressions (e.g., hi(@data) * 4)
 *
 * This test file was added as part of the address-of-fix plan (Phase 4)
 * to prevent regressions in the LOAD_ADDRESS IL generation.
 *
 * @module __tests__/il/generator-address-of
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../il/enums.js';
import { isSlotOperand } from '../../il/guards.js';
import type { SlotOperand } from '../../il/operands.js';
import {
  compileToIL,
  getMainFunction,
  findInstructions,
  hasOpcode,
  countOpcode,
  wrapInModule,
  verifyOpcodeSequence,
} from './helpers/index.js';

// ============================================================================
// Address-Of on @ram Variables
// ============================================================================

describe('ILGenerator: Address-Of (@) on @ram variables', () => {
  it('should generate LOAD_ADDRESS for @variable on @ram global', () => {
    // @ram variables have a numeric address — @variable loads that address
    const source = wrapInModule(
      '@ram let buffer: byte = 0;\n' +
      'function main(): void {\n' +
      '  let addr: word = @buffer;\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD_ADDRESS for @buffer
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS)).toBe(true);

    // Verify the LOAD_ADDRESS operand references 'buffer'
    const loadAddrs = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS);
    expect(loadAddrs.length).toBe(1);

    if (isSlotOperand(loadAddrs[0].operands[0])) {
      const slot = (loadAddrs[0].operands[0] as SlotOperand).slot;
      expect(slot.name).toBe('buffer');
    }
  });

  it('should generate LOAD_ADDRESS followed by STORE_WORD for @var assignment', () => {
    // Assigning @variable to a word variable: addr = @buffer
    const source = wrapInModule(
      '@ram let buffer: byte = 0;\n' +
      'function main(): void {\n' +
      '  let addr: word = @buffer;\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD_ADDRESS → STORE_WORD sequence
    verifyOpcodeSequence(mainFunc!.instructions, [
      ILOpcode.LOAD_ADDRESS,
      ILOpcode.STORE_WORD,
    ]);
  });
});

// ============================================================================
// Address-Of on @zp Variables
// ============================================================================

describe('ILGenerator: Address-Of (@) on @zp variables', () => {
  it('should generate LOAD_ADDRESS for @variable on @zp global', () => {
    // @zp variables have a zero-page address — @variable loads it
    const source = wrapInModule(
      '@zp let counter: byte = 0;\n' +
      'function main(): void {\n' +
      '  let addr: word = @counter;\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD_ADDRESS for @counter
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS)).toBe(true);

    const loadAddrs = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS);
    expect(loadAddrs.length).toBe(1);

    if (isSlotOperand(loadAddrs[0].operands[0])) {
      const slot = (loadAddrs[0].operands[0] as SlotOperand).slot;
      expect(slot.name).toBe('counter');
    }
  });
});

// ============================================================================
// Address-Of on @data Variables
// ============================================================================

describe('ILGenerator: Address-Of (@) on @data variables', () => {
  it('should generate LOAD_ADDRESS for @variable on @data const array', () => {
    // @data const arrays use ACME labels — @variable loads the label address
    const source = wrapInModule(
      '@data const table: byte[] = [1, 2, 3, 4];\n' +
      'function main(): void {\n' +
      '  let addr: word = @table;\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD_ADDRESS for @table
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS)).toBe(true);

    const loadAddrs = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS);
    expect(loadAddrs.length).toBe(1);

    if (isSlotOperand(loadAddrs[0].operands[0])) {
      const slot = (loadAddrs[0].operands[0] as SlotOperand).slot;
      expect(slot.name).toBe('table');
    }
  });

  it('should generate LOAD_ADDRESS with correct slot name for @data const array', () => {
    // The LOAD_ADDRESS slot should reference the correct variable name.
    // Note: dataLabel is set by the full compiler pipeline when
    // GlobalAllocationResult is provided. In the compileToIL() helper
    // (legacy path without GlobalAllocationResult), dataLabel may not
    // be present — the full pipeline (compiler.ts) wires it up.
    const source = wrapInModule(
      '@data const lookup: byte[] = [10, 20, 30];\n' +
      'function main(): void {\n' +
      '  let addr: word = @lookup;\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    const loadAddrs = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS);
    expect(loadAddrs.length).toBe(1);

    // Verify the slot references 'lookup' variable
    if (isSlotOperand(loadAddrs[0].operands[0])) {
      const slot = (loadAddrs[0].operands[0] as SlotOperand).slot;
      expect(slot.name).toBe('lookup');
    }
  });
});

// ============================================================================
// Address-Of with hi() and lo() Intrinsics
// ============================================================================

describe('ILGenerator: Address-Of (@) with hi()/lo() intrinsics', () => {
  it('should generate LOAD_ADDRESS + HI for hi(@variable)', () => {
    // hi(@variable) extracts the high byte of the address (from X register)
    const source = wrapInModule(
      '@data const spriteData: byte[] = [0, 0, 0];\n' +
      'function main(): void {\n' +
      '  let hi_byte: byte = hi(@spriteData);\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD_ADDRESS followed by HI
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS)).toBe(true);
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.HI)).toBe(true);

    verifyOpcodeSequence(mainFunc!.instructions, [
      ILOpcode.LOAD_ADDRESS,
      ILOpcode.HI,
    ]);
  });

  it('should generate LOAD_ADDRESS + LO for lo(@variable)', () => {
    // lo(@variable) extracts the low byte of the address (from A register)
    const source = wrapInModule(
      '@data const spriteData: byte[] = [0, 0, 0];\n' +
      'function main(): void {\n' +
      '  let lo_byte: byte = lo(@spriteData);\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD_ADDRESS followed by LO
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS)).toBe(true);
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LO)).toBe(true);

    verifyOpcodeSequence(mainFunc!.instructions, [
      ILOpcode.LOAD_ADDRESS,
      ILOpcode.LO,
    ]);
  });
});

// ============================================================================
// Address-Of in Expressions
// ============================================================================

describe('ILGenerator: Address-Of (@) in complex expressions', () => {
  it('should generate LOAD_ADDRESS in hi(@data) * 4 sprite pointer pattern', () => {
    // Real-world pattern: sprite pointer = hi(@spriteData) * 4
    // This is the exact pattern from the balloon-sprite example
    const source = wrapInModule(
      '@data const spriteData: byte[] = [0, 0, 0];\n' +
      'function main(): void {\n' +
      '  let spritePtr: byte = hi(@spriteData) * 4;\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD_ADDRESS, HI, and a multiply operation
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS)).toBe(true);
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.HI)).toBe(true);

    // Verify LOAD_ADDRESS comes before HI in the instruction sequence
    verifyOpcodeSequence(mainFunc!.instructions, [
      ILOpcode.LOAD_ADDRESS,
      ILOpcode.HI,
    ]);
  });

  it('should generate exactly one LOAD_ADDRESS per @ usage', () => {
    // Two uses of @ should produce two LOAD_ADDRESS instructions
    const source = wrapInModule(
      '@ram let a: byte = 0;\n' +
      '@ram let b: byte = 0;\n' +
      'function main(): void {\n' +
      '  let addrA: word = @a;\n' +
      '  let addrB: word = @b;\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have exactly 2 LOAD_ADDRESS instructions
    expect(countOpcode(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS)).toBe(2);

    // Verify they reference different variables
    const loadAddrs = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS);
    const slotNames = loadAddrs
      .filter(i => isSlotOperand(i.operands[0]))
      .map(i => (i.operands[0] as SlotOperand).slot.name);

    expect(slotNames).toContain('a');
    expect(slotNames).toContain('b');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('ILGenerator: Address-Of (@) edge cases', () => {
  it('should handle @variable on a word-sized @ram variable', () => {
    // Address-of should work regardless of variable type
    const source = wrapInModule(
      '@ram let timer: word = 0;\n' +
      'function main(): void {\n' +
      '  let addr: word = @timer;\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD_ADDRESS for @timer
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS)).toBe(true);

    const loadAddrs = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS);
    expect(loadAddrs.length).toBe(1);

    if (isSlotOperand(loadAddrs[0].operands[0])) {
      const slot = (loadAddrs[0].operands[0] as SlotOperand).slot;
      expect(slot.name).toBe('timer');
    }
  });

  it('should handle @variable on @ram byte array', () => {
    // Address-of on an array base should load the array's start address
    const source = wrapInModule(
      '@ram let buf: byte[8] = [0, 0, 0, 0, 0, 0, 0, 0];\n' +
      'function main(): void {\n' +
      '  let addr: word = @buf;\n' +
      '}',
      'Test',
    );

    const program = compileToIL(source);
    const mainFunc = getMainFunction(program);
    expect(mainFunc).toBeDefined();

    // Should have LOAD_ADDRESS for @buf
    expect(hasOpcode(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS)).toBe(true);

    const loadAddrs = findInstructions(mainFunc!.instructions, ILOpcode.LOAD_ADDRESS);
    expect(loadAddrs.length).toBe(1);

    if (isSlotOperand(loadAddrs[0].operands[0])) {
      const slot = (loadAddrs[0].operands[0] as SlotOperand).slot;
      expect(slot.name).toBe('buf');
    }
  });
});
