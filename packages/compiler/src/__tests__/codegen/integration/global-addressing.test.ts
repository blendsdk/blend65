/**
 * Integration Tests: Global Variable Addressing in Code Generator
 *
 * Verifies that the code generator produces correct 6502 instructions
 * for global variable access with different storage classes:
 * - @zp globals → zero page addressing (2-byte instructions, fast)
 * - @ram/default globals → absolute addressing (3-byte instructions)
 * - Word-sized globals → proper low/high byte handling
 * - Global init section → correct initialization code
 *
 * These tests build IL programs directly with FrameSlots configured
 * as globals (using the same SlotLocation/ZpDirective the IL generator
 * produces after GlobalSlot → FrameSlot conversion).
 *
 * @module __tests__/codegen/integration/global-addressing
 */

import { describe, it, expect } from 'vitest';
import { ILOpcode } from '../../../il/enums.js';
import { SlotKind, SlotLocation, ZpDirective } from '../../../frame/enums.js';
import { createFrameSlot, FrameSlot } from '../../../frame/types.js';
import { BUILTIN_TYPES } from '../../../semantic/types.js';
import {
  buildProgram,
  generate,
  slotOp,
  immOp,
  immWordOp,
  instr,
  allInstructions,
  allElements,
  hasLabel,
  hasComment,
} from './_helpers.js';
import { isInstructionElement } from '../../../codegen/asm-il/types.js';

// ============================================================================
// Global Slot Factories
// ============================================================================

/**
 * Creates a @zp global byte slot.
 * Mirrors what the IL generator produces after GlobalSlot → FrameSlot conversion
 * for a @zp storage class variable.
 *
 * @param name - Variable name
 * @param address - Zero page address (0x02-0x8F)
 * @returns FrameSlot configured for ZP global
 */
function zpGlobalSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.ZeroPage,
    address,
    zpDirective: ZpDirective.Zp,
  });
}

/**
 * Creates a @ram global byte slot.
 * Mirrors what the IL generator produces after GlobalSlot → FrameSlot conversion
 * for a @ram storage class variable.
 *
 * @param name - Variable name
 * @param address - Absolute RAM address (e.g., 0x0400+)
 * @returns FrameSlot configured for absolute global
 */
function ramGlobalSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.FrameRegion,
    address,
    zpDirective: ZpDirective.Ram,
  });
}

/**
 * Creates a default storage class global byte slot.
 * Default globals are treated like @ram (absolute addressing).
 *
 * @param name - Variable name
 * @param address - Absolute RAM address
 * @returns FrameSlot configured for absolute global
 */
function defaultGlobalSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.FrameRegion,
    address,
    zpDirective: ZpDirective.None,
  });
}

/**
 * Creates a @zp global word slot.
 *
 * @param name - Variable name
 * @param address - Zero page address (occupies address and address+1)
 * @returns FrameSlot configured for ZP word global
 */
function zpGlobalWordSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD, {
    location: SlotLocation.ZeroPage,
    address,
    zpDirective: ZpDirective.Zp,
  });
}

/**
 * Creates a @ram global word slot.
 *
 * @param name - Variable name
 * @param address - Absolute address (occupies address and address+1)
 * @returns FrameSlot configured for absolute word global
 */
function ramGlobalWordSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD, {
    location: SlotLocation.FrameRegion,
    address,
    zpDirective: ZpDirective.Ram,
  });
}

// ============================================================================
// Helper: Extract instructions with details
// ============================================================================

/**
 * Extracts instruction details (mnemonic, mode, operand) from ASM-IL output.
 * Useful for detailed assertions about addressing modes.
 */
function getInstructionDetails(program: ReturnType<typeof generate>) {
  return allInstructions(program)
    .filter(isInstructionElement)
    .map(e => ({
      mnemonic: e.instruction.mnemonic,
      mode: e.instruction.mode,
      operand: e.instruction.operand,
      comment: e.instruction.comment,
    }));
}

// ============================================================================
// Tests: @zp Global Addressing (Zero Page Mode)
// ============================================================================

describe('Global Addressing: @zp (Zero Page)', () => {
  it('should use zero page LDA for @zp global byte load', () => {
    // @zp let score: byte = 0  → allocated at $02
    const scoreSlot = zpGlobalSlot('score', 0x02);

    const program = buildProgram('main', [
      instr(ILOpcode.LOAD_BYTE, [slotOp(scoreSlot)], 'Load @zp score'),
      instr(ILOpcode.RETURN, []),
    ], [scoreSlot]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Should produce: LDA $02 (zero page, 2 bytes)
    const lda = instrs.find(i => i.mnemonic === 'LDA' && i.operand === 0x02);
    expect(lda).toBeDefined();
    expect(lda!.mode).toBe('ZeroPage');
  });

  it('should use zero page STA for @zp global byte store', () => {
    const scoreSlot = zpGlobalSlot('score', 0x02);

    const program = buildProgram('main', [
      instr(ILOpcode.LOAD_IMM, [immOp(42)], 'Load value'),
      instr(ILOpcode.STORE_BYTE, [slotOp(scoreSlot)], 'Store to @zp score'),
      instr(ILOpcode.RETURN, []),
    ], [scoreSlot]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Should produce: LDA #42 → STA $02 (zero page store)
    const sta = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x02);
    expect(sta).toBeDefined();
    expect(sta!.mode).toBe('ZeroPage');
  });

  it('should use zero page LDA/LDX for @zp global word load', () => {
    // @zp let ptr: word = 0  → allocated at $04 (occupies $04-$05)
    const ptrSlot = zpGlobalWordSlot('ptr', 0x04);

    const program = buildProgram('main', [
      instr(ILOpcode.LOAD_WORD, [slotOp(ptrSlot)], 'Load @zp ptr word'),
      instr(ILOpcode.RETURN, []),
    ], [ptrSlot]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Should produce: LDA $04 (low byte) + LDX $05 (high byte) — both zero page
    const ldaLow = instrs.find(i => i.mnemonic === 'LDA' && i.operand === 0x04);
    const ldxHigh = instrs.find(i => i.mnemonic === 'LDX' && i.operand === 0x05);
    expect(ldaLow).toBeDefined();
    expect(ldaLow!.mode).toBe('ZeroPage');
    expect(ldxHigh).toBeDefined();
    expect(ldxHigh!.mode).toBe('ZeroPage');
  });

  it('should use zero page STA/STX for @zp global word store', () => {
    const ptrSlot = zpGlobalWordSlot('ptr', 0x04);

    const program = buildProgram('main', [
      instr(ILOpcode.LOAD_IMM_WORD, [immWordOp(0x1234)], 'Load word value'),
      instr(ILOpcode.STORE_WORD, [slotOp(ptrSlot)], 'Store to @zp ptr'),
      instr(ILOpcode.RETURN, []),
    ], [ptrSlot]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Should produce: STA $04 (low) + STX $05 (high) — both zero page
    const staLow = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x04);
    const stxHigh = instrs.find(i => i.mnemonic === 'STX' && i.operand === 0x05);
    expect(staLow).toBeDefined();
    expect(staLow!.mode).toBe('ZeroPage');
    expect(stxHigh).toBeDefined();
    expect(stxHigh!.mode).toBe('ZeroPage');
  });
});

// ============================================================================
// Tests: @ram Global Addressing (Absolute Mode)
// ============================================================================

describe('Global Addressing: @ram (Absolute)', () => {
  it('should use absolute LDA for @ram global byte load', () => {
    // @ram let counter: byte = 0  → allocated at $0400
    const counterSlot = ramGlobalSlot('counter', 0x0400);

    const program = buildProgram('main', [
      instr(ILOpcode.LOAD_BYTE, [slotOp(counterSlot)], 'Load @ram counter'),
      instr(ILOpcode.RETURN, []),
    ], [counterSlot]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Should produce: LDA $0400 (absolute, 3 bytes)
    const lda = instrs.find(i => i.mnemonic === 'LDA' && i.operand === 0x0400);
    expect(lda).toBeDefined();
    expect(lda!.mode).toBe('Absolute');
  });

  it('should use absolute STA for @ram global byte store', () => {
    const counterSlot = ramGlobalSlot('counter', 0x0400);

    const program = buildProgram('main', [
      instr(ILOpcode.LOAD_IMM, [immOp(10)], 'Load value'),
      instr(ILOpcode.STORE_BYTE, [slotOp(counterSlot)], 'Store to @ram counter'),
      instr(ILOpcode.RETURN, []),
    ], [counterSlot]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Should produce: STA $0400 (absolute store)
    const sta = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x0400);
    expect(sta).toBeDefined();
    expect(sta!.mode).toBe('Absolute');
  });

  it('should use absolute LDA/LDX for @ram global word load', () => {
    // @ram let total: word = 0  → allocated at $0400 (occupies $0400-$0401)
    const totalSlot = ramGlobalWordSlot('total', 0x0400);

    const program = buildProgram('main', [
      instr(ILOpcode.LOAD_WORD, [slotOp(totalSlot)], 'Load @ram total word'),
      instr(ILOpcode.RETURN, []),
    ], [totalSlot]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Should produce: LDA $0400 (low) + LDX $0401 (high) — both absolute
    const ldaLow = instrs.find(i => i.mnemonic === 'LDA' && i.operand === 0x0400);
    const ldxHigh = instrs.find(i => i.mnemonic === 'LDX' && i.operand === 0x0401);
    expect(ldaLow).toBeDefined();
    expect(ldaLow!.mode).toBe('Absolute');
    expect(ldxHigh).toBeDefined();
    expect(ldxHigh!.mode).toBe('Absolute');
  });

  it('should use absolute STA/STX for @ram global word store', () => {
    const totalSlot = ramGlobalWordSlot('total', 0x0400);

    const program = buildProgram('main', [
      instr(ILOpcode.LOAD_IMM_WORD, [immWordOp(0xBEEF)], 'Load word value'),
      instr(ILOpcode.STORE_WORD, [slotOp(totalSlot)], 'Store to @ram total'),
      instr(ILOpcode.RETURN, []),
    ], [totalSlot]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Should produce: STA $0400 (low) + STX $0401 (high) — both absolute
    const staLow = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x0400);
    const stxHigh = instrs.find(i => i.mnemonic === 'STX' && i.operand === 0x0401);
    expect(staLow).toBeDefined();
    expect(staLow!.mode).toBe('Absolute');
    expect(stxHigh).toBeDefined();
    expect(stxHigh!.mode).toBe('Absolute');
  });
});

// ============================================================================
// Tests: Default Storage Class (Absolute Mode)
// ============================================================================

describe('Global Addressing: default (Absolute)', () => {
  it('should use absolute mode for default storage class globals', () => {
    // let counter: byte = 0  (no storage annotation → default → absolute)
    const counterSlot = defaultGlobalSlot('counter', 0x0500);

    const program = buildProgram('main', [
      instr(ILOpcode.LOAD_BYTE, [slotOp(counterSlot)], 'Load default global'),
      instr(ILOpcode.STORE_BYTE, [slotOp(counterSlot)], 'Store default global'),
      instr(ILOpcode.RETURN, []),
    ], [counterSlot]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Both LDA and STA should use absolute addressing
    const lda = instrs.find(i => i.mnemonic === 'LDA' && i.operand === 0x0500);
    const sta = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x0500);
    expect(lda).toBeDefined();
    expect(lda!.mode).toBe('Absolute');
    expect(sta).toBeDefined();
    expect(sta!.mode).toBe('Absolute');
  });
});

// ============================================================================
// Tests: Global Init Section
// ============================================================================

describe('Global Init Section', () => {
  it('should generate __global_init label for global initialization', () => {
    const scoreSlot = zpGlobalSlot('score', 0x02);

    // Global init: LOAD_IMM 0, STORE_BYTE score
    const globalInit = [
      instr(ILOpcode.LOAD_IMM, [immOp(0)], 'Init score = 0'),
      instr(ILOpcode.STORE_BYTE, [slotOp(scoreSlot)], 'Store init value'),
    ];

    const program = buildProgram('main', [
      instr(ILOpcode.RETURN, []),
    ], [scoreSlot], { globalInit });

    const output = generate(program);

    // Should have __global_init label
    expect(hasLabel(output, '__global_init')).toBe(true);
    // Should have JSR to __global_init before main
    expect(hasComment(output, 'Initialize global variables')).toBe(true);
  });

  it('should generate ZP stores in global init for @zp variables', () => {
    const scoreSlot = zpGlobalSlot('score', 0x02);

    const globalInit = [
      instr(ILOpcode.LOAD_IMM, [immOp(100)], 'Init score = 100'),
      instr(ILOpcode.STORE_BYTE, [slotOp(scoreSlot)], 'Store to @zp score'),
    ];

    const program = buildProgram('main', [
      instr(ILOpcode.RETURN, []),
    ], [scoreSlot], { globalInit });

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Global init section should store to ZP address
    const sta = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x02);
    expect(sta).toBeDefined();
    expect(sta!.mode).toBe('ZeroPage');
  });

  it('should generate absolute stores in global init for @ram variables', () => {
    const counterSlot = ramGlobalSlot('counter', 0x0400);

    const globalInit = [
      instr(ILOpcode.LOAD_IMM, [immOp(0)], 'Init counter = 0'),
      instr(ILOpcode.STORE_BYTE, [slotOp(counterSlot)], 'Store to @ram counter'),
    ];

    const program = buildProgram('main', [
      instr(ILOpcode.RETURN, []),
    ], [counterSlot], { globalInit });

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Global init section should store to absolute address
    const sta = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x0400);
    expect(sta).toBeDefined();
    expect(sta!.mode).toBe('Absolute');
  });
});

// ============================================================================
// Tests: Mixed Globals (ZP + Absolute in same function)
// ============================================================================

describe('Mixed Global Storage Classes', () => {
  it('should handle @zp and @ram globals in the same function', () => {
    // @zp let fast: byte at $02
    // @ram let slow: byte at $0400
    const fastSlot = zpGlobalSlot('fast', 0x02);
    const slowSlot = ramGlobalSlot('slow', 0x0400);

    // Use separate load/store pairs with different immediates to avoid
    // accumulator tracking optimization skipping redundant loads.
    const program = buildProgram('main', [
      // Store immediate to @zp (ZP addressing)
      instr(ILOpcode.LOAD_IMM, [immOp(42)], 'Load value for @zp'),
      instr(ILOpcode.STORE_BYTE, [slotOp(fastSlot)], 'Store to @zp fast'),
      // Store different immediate to @ram (absolute addressing)
      instr(ILOpcode.LOAD_IMM, [immOp(99)], 'Load value for @ram'),
      instr(ILOpcode.STORE_BYTE, [slotOp(slowSlot)], 'Store to @ram slow'),
      // Load from @zp (ZP addressing)
      instr(ILOpcode.LOAD_BYTE, [slotOp(fastSlot)], 'Load @zp fast'),
      // Load from @ram (absolute addressing) — different slot, forces real load
      instr(ILOpcode.LOAD_BYTE, [slotOp(slowSlot)], 'Load @ram slow'),
      instr(ILOpcode.RETURN, []),
    ], [fastSlot, slowSlot]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // STA $02 (ZP store) and STA $0400 (absolute store)
    const staZp = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x02);
    const staAbs = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x0400);
    expect(staZp).toBeDefined();
    expect(staZp!.mode).toBe('ZeroPage');
    expect(staAbs).toBeDefined();
    expect(staAbs!.mode).toBe('Absolute');

    // LDA $02 (ZP load) and LDA $0400 (absolute load)
    const ldaZp = instrs.find(i => i.mnemonic === 'LDA' && i.operand === 0x02);
    const ldaAbs = instrs.find(i => i.mnemonic === 'LDA' && i.operand === 0x0400);
    expect(ldaZp).toBeDefined();
    expect(ldaZp!.mode).toBe('ZeroPage');
    expect(ldaAbs).toBeDefined();
    expect(ldaAbs!.mode).toBe('Absolute');
  });

  it('should handle mixed global init with ZP and absolute stores', () => {
    const zpScore = zpGlobalSlot('score', 0x02);
    const ramLevel = ramGlobalSlot('level', 0x0400);

    const globalInit = [
      instr(ILOpcode.LOAD_IMM, [immOp(0)], 'Init score = 0'),
      instr(ILOpcode.STORE_BYTE, [slotOp(zpScore)], 'Store @zp score'),
      instr(ILOpcode.LOAD_IMM, [immOp(1)], 'Init level = 1'),
      instr(ILOpcode.STORE_BYTE, [slotOp(ramLevel)], 'Store @ram level'),
    ];

    const program = buildProgram('main', [
      instr(ILOpcode.RETURN, []),
    ], [zpScore, ramLevel], { globalInit });

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // Should have both ZP and absolute stores in global init
    const staZp = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x02);
    const staAbs = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x0400);
    expect(staZp).toBeDefined();
    expect(staZp!.mode).toBe('ZeroPage');
    expect(staAbs).toBeDefined();
    expect(staAbs!.mode).toBe('Absolute');
  });

  it('should handle word globals with mixed storage classes', () => {
    const zpPtr = zpGlobalWordSlot('ptr', 0x04);
    const ramTotal = ramGlobalWordSlot('total', 0x0400);

    const program = buildProgram('main', [
      // Load ZP word, store to RAM word
      instr(ILOpcode.LOAD_WORD, [slotOp(zpPtr)], 'Load @zp ptr'),
      instr(ILOpcode.STORE_WORD, [slotOp(ramTotal)], 'Store to @ram total'),
      instr(ILOpcode.RETURN, []),
    ], [zpPtr, ramTotal]);

    const output = generate(program);
    const instrs = getInstructionDetails(output);

    // ZP word load: LDA $04, LDX $05 (both ZP)
    const ldaLow = instrs.find(i => i.mnemonic === 'LDA' && i.operand === 0x04);
    expect(ldaLow).toBeDefined();
    expect(ldaLow!.mode).toBe('ZeroPage');

    // RAM word store: STA $0400, STX $0401 (both absolute)
    const staLow = instrs.find(i => i.mnemonic === 'STA' && i.operand === 0x0400);
    const stxHigh = instrs.find(i => i.mnemonic === 'STX' && i.operand === 0x0401);
    expect(staLow).toBeDefined();
    expect(staLow!.mode).toBe('Absolute');
    expect(stxHigh).toBeDefined();
    expect(stxHigh!.mode).toBe('Absolute');
  });
});
