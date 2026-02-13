/**
 * IL Generator - Word Compound Assignment Tests
 *
 * Tests for word-typed (16-bit) compound assignment generation:
 * - word += byte_immediate (ADD_WORD_BYTE_IMM)
 * - word += word_immediate (ADD_WORD_IMM)
 * - word -= byte_immediate (SUB_WORD_BYTE_IMM)
 * - word -= word_immediate (SUB_WORD_IMM)
 * - Word variable declaration with STORE_WORD
 *
 * These tests verify Phase 7 task 7.1.3 (type-aware compound assignments).
 *
 * @module __tests__/il/generator-word-compound-assign
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILGenerator } from '../../il/generator/index.js';
import { ILOpcode } from '../../il/enums.js';
import { Frame, createFrame } from '../../frame/allocator/frame-calculator.js';
import { FrameSlot, createFrameSlot } from '../../frame/types.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import {
  LiteralExpression,
  IdentifierExpression,
  AssignmentExpression,
} from '../../ast/expressions.js';
import { FunctionDecl, VariableDecl } from '../../ast/declarations.js';
import { ExpressionStatement } from '../../ast/statements.js';
import { Program, ModuleDecl } from '../../ast/program.js';
import { SourceLocation, Statement } from '../../ast/base.js';
import { TokenType } from '../../lexer/types.js';

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
 * Create a word (16-bit) slot.
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
// Word Compound += Tests
// ============================================================================

describe('ILGenerator - Word Compound += Assignment', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should use ADD_WORD_BYTE_IMM for word += byte-range literal', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);

    // addr += 40 (byte range: 0-255)
    const target = new IdentifierExpression('addr', loc);
    const value = new LiteralExpression(40, loc);
    const assign = new AssignmentExpression(target, TokenType.PLUS_ASSIGN, value, loc);

    const stmt = new ExpressionStatement(assign, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [addrSlot]);
    const instructions = result.functions[0].instructions;

    // Should load word, add byte imm, store word
    const loadWord = instructions.find(i => i.opcode === ILOpcode.LOAD_WORD);
    expect(loadWord).toBeDefined();

    const addWordByteImm = instructions.find(i => i.opcode === ILOpcode.ADD_WORD_BYTE_IMM);
    expect(addWordByteImm).toBeDefined();

    const storeWord = instructions.find(i => i.opcode === ILOpcode.STORE_WORD);
    expect(storeWord).toBeDefined();
  });

  it('should use ADD_WORD_IMM for word += word-range literal', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);

    // addr += 1000 (exceeds byte range)
    const target = new IdentifierExpression('addr', loc);
    const value = new LiteralExpression(1000, loc);
    const assign = new AssignmentExpression(target, TokenType.PLUS_ASSIGN, value, loc);

    const stmt = new ExpressionStatement(assign, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [addrSlot]);
    const instructions = result.functions[0].instructions;

    // Should use ADD_WORD_IMM for full 16-bit add
    const addWordImm = instructions.find(i => i.opcode === ILOpcode.ADD_WORD_IMM);
    expect(addWordImm).toBeDefined();
  });

  it('should emit LOAD_WORD before ADD and STORE_WORD after', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);

    // addr += 5
    const target = new IdentifierExpression('addr', loc);
    const value = new LiteralExpression(5, loc);
    const assign = new AssignmentExpression(target, TokenType.PLUS_ASSIGN, value, loc);

    const stmt = new ExpressionStatement(assign, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [addrSlot]);
    const instructions = result.functions[0].instructions;

    // Sequence: LOAD_WORD → ADD_WORD_BYTE_IMM → STORE_WORD
    const loadIdx = instructions.findIndex(i => i.opcode === ILOpcode.LOAD_WORD);
    const addIdx = instructions.findIndex(i => i.opcode === ILOpcode.ADD_WORD_BYTE_IMM);
    const storeIdx = instructions.findIndex(i => i.opcode === ILOpcode.STORE_WORD);

    expect(loadIdx).toBeGreaterThanOrEqual(0);
    expect(addIdx).toBeGreaterThan(loadIdx);
    expect(storeIdx).toBeGreaterThan(addIdx);
  });
});

// ============================================================================
// Word Compound -= Tests
// ============================================================================

describe('ILGenerator - Word Compound -= Assignment', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should use SUB_WORD_BYTE_IMM for word -= byte-range literal', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);

    // addr -= 40
    const target = new IdentifierExpression('addr', loc);
    const value = new LiteralExpression(40, loc);
    const assign = new AssignmentExpression(target, TokenType.MINUS_ASSIGN, value, loc);

    const stmt = new ExpressionStatement(assign, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [addrSlot]);
    const instructions = result.functions[0].instructions;

    const subWordByteImm = instructions.find(i => i.opcode === ILOpcode.SUB_WORD_BYTE_IMM);
    expect(subWordByteImm).toBeDefined();
  });

  it('should use SUB_WORD_IMM for word -= word-range literal', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);

    // addr -= 1000
    const target = new IdentifierExpression('addr', loc);
    const value = new LiteralExpression(1000, loc);
    const assign = new AssignmentExpression(target, TokenType.MINUS_ASSIGN, value, loc);

    const stmt = new ExpressionStatement(assign, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [addrSlot]);
    const instructions = result.functions[0].instructions;

    const subWordImm = instructions.find(i => i.opcode === ILOpcode.SUB_WORD_IMM);
    expect(subWordImm).toBeDefined();
  });
});

// ============================================================================
// Word Simple Assignment Tests
// ============================================================================

describe('ILGenerator - Word Simple Assignment', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should use STORE_WORD for assigning literal to word variable', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);

    // addr = 0x0400
    const target = new IdentifierExpression('addr', loc);
    const value = new LiteralExpression(0x0400, loc);
    const assign = new AssignmentExpression(target, TokenType.ASSIGN, value, loc);

    const stmt = new ExpressionStatement(assign, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [addrSlot]);
    const instructions = result.functions[0].instructions;

    // Should use STORE_WORD (not STORE_BYTE) for 2-byte slot
    const storeWord = instructions.find(i => i.opcode === ILOpcode.STORE_WORD);
    expect(storeWord).toBeDefined();
  });

  it('should use STORE_WORD in variable declaration with word slot', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);

    // let addr: word = $0400
    const initializer = new LiteralExpression(0x0400, loc);
    const varDecl = new VariableDecl('addr', 'word', initializer, loc, false, null);

    const result = generateFunctionWithBody(
      frameMap, symbolTable, [varDecl], [addrSlot],
    );
    const instructions = result.functions[0].instructions;

    // Variable declaration should use STORE_WORD for word-sized slot
    const storeWord = instructions.find(i => i.opcode === ILOpcode.STORE_WORD);
    expect(storeWord).toBeDefined();
  });

  it('should not use any byte-width stores for word assignment', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);

    // addr = 0x1234
    const target = new IdentifierExpression('addr', loc);
    const value = new LiteralExpression(0x1234, loc);
    const assign = new AssignmentExpression(target, TokenType.ASSIGN, value, loc);

    const stmt = new ExpressionStatement(assign, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [addrSlot]);
    const instructions = result.functions[0].instructions;

    // Should NOT have STORE_BYTE for a word slot
    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeUndefined();
  });
});
