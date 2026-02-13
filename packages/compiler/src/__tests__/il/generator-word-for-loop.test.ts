/**
 * IL Generator - Word For-Loop Tests
 *
 * Tests for word-typed (16-bit) for-loop generation:
 * - Word counter initialization with STORE_WORD
 * - Word condition checking with CMP_WORD_IMM
 * - Word increment/decrement with INC_WORD/DEC_WORD
 * - Word custom step with ADD_WORD_BYTE_IMM/SUB_WORD_BYTE_IMM
 *
 * These tests verify Phase 7 tasks 7.1.1, 7.1.2 (word-aware
 * for-loop condition and increment generation).
 *
 * @module __tests__/il/generator-word-for-loop
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILGenerator } from '../../il/generator/index.js';
import { ILOpcode } from '../../il/enums.js';
import { Frame, createFrame } from '../../frame/allocator/frame-calculator.js';
import { FrameSlot, createFrameSlot } from '../../frame/types.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import { LiteralExpression } from '../../ast/expressions.js';
import { FunctionDecl } from '../../ast/declarations.js';
import { ForStatement } from '../../ast/statements.js';
import { Program, ModuleDecl } from '../../ast/program.js';
import { SourceLocation, Statement } from '../../ast/base.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a test source location.
 */
function createTestLocation(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 10, offset: 9 },
    file: 'test.blend',
  };
}

/**
 * Create a test frame with given slots.
 */
function createTestFrame(name: string, slots: FrameSlot[]): Frame {
  const frame = createFrame(name);
  frame.slots = slots;
  frame.totalSize = slots.reduce((sum, s) => sum + s.size, 0);
  return frame;
}

/**
 * Create a word (16-bit) slot for testing word-typed variables.
 *
 * Uses BUILTIN_TYPES.WORD which has size=2, causing the IL generator
 * to use word-width opcodes (LOAD_WORD, STORE_WORD, INC_WORD, etc.).
 *
 * @param name - Slot name
 * @param address - Memory address
 * @returns FrameSlot configured as a 2-byte word slot
 */
function createWordSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Helper to generate IL for a function with given body statements and slots.
 */
function generateFunctionWithBody(
  frameMap: Map<string, Frame>,
  symbolTable: SymbolTable,
  body: Statement[],
  slots: FrameSlot[] = [],
): ReturnType<ILGenerator['generate']> {
  const generator = new ILGenerator(frameMap, symbolTable);
  const loc = createTestLocation();

  frameMap.set('testFunc', createTestFrame('testFunc', slots));

  const funcDecl = new FunctionDecl(
    'testFunc',
    [],
    'void',
    body,
    loc,
    false,
    false,
  );
  const moduleDecl = new ModuleDecl(['test'], loc, false);
  const program = new Program(moduleDecl, [funcDecl], loc);

  return generator.generate(program);
}

// ============================================================================
// Word For-Loop Ascending Tests
// ============================================================================

describe('ILGenerator - Word For-Loop Ascending', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should use STORE_WORD for word counter initialization', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 0 to 999) { }
    // Word counter (size=2) should use STORE_WORD for initialization
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(999, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Should use STORE_WORD (not STORE_BYTE) for word counter init
    const storeWord = instructions.find(i => i.opcode === ILOpcode.STORE_WORD);
    expect(storeWord).toBeDefined();
    expect(storeWord!.comment).toContain('start');
  });

  it('should use LOAD_WORD for word counter condition load', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 0 to 999) { }
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(999, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Should use LOAD_WORD (not LOAD_BYTE) for reading the word counter
    const loadWord = instructions.find(i => i.opcode === ILOpcode.LOAD_WORD);
    expect(loadWord).toBeDefined();
  });

  it('should use CMP_WORD_IMM for word bound check', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 0 to 999) { }
    // Ascending: exit when i >= end+1 (1000)
    // Word comparison must use CMP_WORD_IMM (not CMP_IMM)
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(999, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Should use CMP_WORD_IMM for 16-bit comparison with end+1 = 1000
    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();

    // Should NOT use byte CMP_IMM for the bound check
    // (LOAD_IMM for the literal 0 is OK, but condition should use word CMP)
    const cmpImm = instructions.find(i => i.opcode === ILOpcode.CMP_IMM);
    expect(cmpImm).toBeUndefined();
  });

  it('should use INC_WORD for default step=1 ascending word loop', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 0 to 999) { }
    // Default step = 1, word counter should use INC_WORD
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(999, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // INC_WORD for in-place 16-bit increment (not INC_BYTE)
    const incWord = instructions.find(i => i.opcode === ILOpcode.INC_WORD);
    expect(incWord).toBeDefined();

    // Should NOT have INC_BYTE (that's for byte counters)
    const incByte = instructions.find(i => i.opcode === ILOpcode.INC_BYTE);
    expect(incByte).toBeUndefined();
  });

  it('should have JUMP_GE for ascending word loop exit', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 0 to 999) { }
    // Exit when i >= 1000 → JUMP_GE to exit label
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(999, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    const jumpGe = instructions.find(i => i.opcode === ILOpcode.JUMP_GE);
    expect(jumpGe).toBeDefined();
  });

  it('should detect counted loop for constant word bounds', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 0 to 999) { } — constant bounds, counted loop
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(999, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const func = result.functions[0];

    expect(func.loops.length).toBe(1);
    expect(func.loops[0].isCountedLoop).toBe(true);
    expect(func.loops[0].boundValue).toBe(999);
    expect(func.loops[0].estimatedIterations).toBe(1000);
  });
});

// ============================================================================
// Word For-Loop Descending Tests
// ============================================================================

describe('ILGenerator - Word For-Loop Descending', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should use DEC_WORD for default step=1 descending word loop', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 999 downto 0) { }
    const start = new LiteralExpression(999, loc);
    const end = new LiteralExpression(0, loc);
    const forStmt = new ForStatement('i', null, start, end, 'downto', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // DEC_WORD for in-place 16-bit decrement
    const decWord = instructions.find(i => i.opcode === ILOpcode.DEC_WORD);
    expect(decWord).toBeDefined();

    // Should NOT have DEC_BYTE
    const decByte = instructions.find(i => i.opcode === ILOpcode.DEC_BYTE);
    expect(decByte).toBeUndefined();
  });

  it('should use JUMP_LT for descending word loop exit', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 999 downto 0) { }
    // Exit when i < 0 → JUMP_LT to exit label
    const start = new LiteralExpression(999, loc);
    const end = new LiteralExpression(0, loc);
    const forStmt = new ForStatement('i', null, start, end, 'downto', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    const jumpLt = instructions.find(i => i.opcode === ILOpcode.JUMP_LT);
    expect(jumpLt).toBeDefined();
  });

  it('should use CMP_WORD_IMM for descending word bound check', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 999 downto 100) { }
    const start = new LiteralExpression(999, loc);
    const end = new LiteralExpression(100, loc);
    const forStmt = new ForStatement('i', null, start, end, 'downto', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Should use CMP_WORD_IMM (not CMP_IMM) for 16-bit bound
    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });
});

// ============================================================================
// Word For-Loop Custom Step Tests
// ============================================================================

describe('ILGenerator - Word For-Loop Custom Step', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should use ADD_WORD_BYTE_IMM for byte-range step ascending', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 0 to 10000 step 100) { }
    // Step 100 fits in a byte (0-255) → ADD_WORD_BYTE_IMM
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(10000, loc);
    const step = new LiteralExpression(100, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', step, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Step 100 is within byte range → ADD_WORD_BYTE_IMM (faster path)
    const addWordByteImm = instructions.find(i => i.opcode === ILOpcode.ADD_WORD_BYTE_IMM);
    expect(addWordByteImm).toBeDefined();
  });

  it('should use ADD_WORD_IMM for word-range step ascending', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 0 to 50000 step 1000) { }
    // Step 1000 exceeds byte range → ADD_WORD_IMM (full 16-bit add)
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(50000, loc);
    const step = new LiteralExpression(1000, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', step, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Step 1000 exceeds byte range → ADD_WORD_IMM
    const addWordImm = instructions.find(i => i.opcode === ILOpcode.ADD_WORD_IMM);
    expect(addWordImm).toBeDefined();
  });

  it('should use SUB_WORD_BYTE_IMM for byte-range step descending', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 10000 downto 0 step 100) { }
    const start = new LiteralExpression(10000, loc);
    const end = new LiteralExpression(0, loc);
    const step = new LiteralExpression(100, loc);
    const forStmt = new ForStatement('i', null, start, end, 'downto', step, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Step 100 fits in byte → SUB_WORD_BYTE_IMM
    const subWordByteImm = instructions.find(i => i.opcode === ILOpcode.SUB_WORD_BYTE_IMM);
    expect(subWordByteImm).toBeDefined();
  });

  it('should calculate correct estimated iterations for word loop with step', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 0 to 999 step 10) { }
    // Iterations: ceil((999 - 0 + 1) / 10) = ceil(1000/10) = 100
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(999, loc);
    const step = new LiteralExpression(10, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', step, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const func = result.functions[0];

    expect(func.loops.length).toBe(1);
    expect(func.loops[0].isCountedLoop).toBe(true);
    expect(func.loops[0].estimatedIterations).toBe(100);
  });

  it('should use LOAD_WORD + STORE_WORD for custom step word loop increment', () => {
    const loc = createTestLocation();
    const iSlot = createWordSlot('i', 0x0200);

    // for (i = 0 to 10000 step 50) { }
    // Custom step requires: LOAD_WORD, ADD, STORE_WORD sequence
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(10000, loc);
    const step = new LiteralExpression(50, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', step, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Custom step for word: LOAD_WORD + ADD_WORD_BYTE_IMM + STORE_WORD
    const loadWords = instructions.filter(i => i.opcode === ILOpcode.LOAD_WORD);
    const storeWords = instructions.filter(i => i.opcode === ILOpcode.STORE_WORD);

    // At least 2 LOAD_WORD: one for condition, one for increment
    expect(loadWords.length).toBeGreaterThanOrEqual(2);

    // At least 2 STORE_WORD: one for init, one for increment store-back
    expect(storeWords.length).toBeGreaterThanOrEqual(2);
  });
});
