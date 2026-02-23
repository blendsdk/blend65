/**
 * IL Generator - Word Comparison in If/While Conditions Tests
 *
 * Tests that generateConditionWithBranch() emits CMP_WORD_IMM and
 * CMP_WORD_SLOT when the left operand of a comparison in an if/while
 * condition is word-typed. This fixes the bug where byte-width CMP_IMM
 * was used for word comparisons in conditions, truncating the high byte.
 *
 * Also tests byte comparison regression — byte conditions must still
 * use CMP_IMM / CMP_SLOT.
 *
 * @module __tests__/il/generator-word-condition
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
  BinaryExpression,
} from '../../ast/expressions.js';
import { FunctionDecl } from '../../ast/declarations.js';
import { IfStatement, WhileStatement } from '../../ast/statements.js';
import { Program, ModuleDecl } from '../../ast/program.js';
import { SourceLocation, Statement } from '../../ast/base.js';
import { TokenType } from '../../lexer/types.js';

// ============================================================================
// Test Utilities
// ============================================================================

/** Create a test source location. */
function loc(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 10, offset: 9 },
    file: 'test.blend',
  };
}

/** Create a test frame with given slots. */
function createTestFrame(name: string, slots: FrameSlot[]): Frame {
  const frame = createFrame(name);
  frame.slots = slots;
  frame.totalSize = slots.reduce((sum, s) => sum + s.size, 0);
  return frame;
}

/** Create a word (16-bit) slot. */
function createWordSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/** Create a byte (8-bit) slot. */
function createByteSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/** Generate IL for a function with given body statements and slots. */
function generateFunctionWithBody(
  frameMap: Map<string, Frame>,
  symbolTable: SymbolTable,
  body: Statement[],
  slots: FrameSlot[] = [],
): ReturnType<ILGenerator['generate']> {
  const generator = new ILGenerator(frameMap, symbolTable);
  const l = loc();
  frameMap.set('testFunc', createTestFrame('testFunc', slots));
  const funcDecl = new FunctionDecl('testFunc', [], 'void', body, l, false, false);
  const moduleDecl = new ModuleDecl(['test'], l, false);
  const program = new Program(moduleDecl, [funcDecl], l);
  return generator.generate(program);
}

/**
 * Helper: create an IfStatement with a comparison condition.
 * The then-body contains a single BARRIER (harmless, non-empty body).
 */
function createIfWithComparison(
  leftExpr: IdentifierExpression,
  op: TokenType,
  rightExpr: LiteralExpression | IdentifierExpression,
): IfStatement {
  const l = loc();
  const cmp = new BinaryExpression(leftExpr, op, rightExpr, l);
  // Create a minimal then-body (empty body might be optimized away)
  // Use a literal expression statement as a no-op body marker
  const bodyStmt = new LiteralExpression(0, l);
  // IfStatement: condition, then, else, location
  return new IfStatement(cmp, [], null, l);
}

// ============================================================================
// Word Comparison in If-Conditions (CMP_WORD_IMM)
// ============================================================================

describe('ILGenerator - Word Comparison in If-Conditions', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit CMP_WORD_IMM for if (wordVar == literal)', () => {
    const l = loc();
    const wSlot = createWordSlot('wresult', 0x0200);
    const left = new IdentifierExpression('wresult', l);
    const right = new LiteralExpression(3000, l);
    const cmp = new BinaryExpression(left, TokenType.EQUAL, right, l);
    const ifStmt = new IfStatement(cmp, [], null, l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [wSlot]);
    const instructions = result.functions[0].instructions;

    // Should use CMP_WORD_IMM (not byte CMP_IMM) for word condition
    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
    // Should NOT have byte CMP_IMM for this comparison
    const byteCmp = instructions.find(i => i.opcode === ILOpcode.CMP_IMM);
    expect(byteCmp).toBeUndefined();
  });

  it('should emit CMP_WORD_IMM for if (wordVar < literal)', () => {
    const l = loc();
    const wSlot = createWordSlot('counter', 0x0200);
    const left = new IdentifierExpression('counter', l);
    const right = new LiteralExpression(1000, l);
    const cmp = new BinaryExpression(left, TokenType.LESS_THAN, right, l);
    const ifStmt = new IfStatement(cmp, [], null, l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [wSlot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });

  it('should emit CMP_WORD_IMM for if (wordVar > literal)', () => {
    const l = loc();
    const wSlot = createWordSlot('addr', 0x0200);
    const left = new IdentifierExpression('addr', l);
    const right = new LiteralExpression(0x0400, l);
    const cmp = new BinaryExpression(left, TokenType.GREATER_THAN, right, l);
    const ifStmt = new IfStatement(cmp, [], null, l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [wSlot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });

  it('should emit CMP_WORD_IMM for if (wordVar != literal)', () => {
    const l = loc();
    const wSlot = createWordSlot('x', 0x0200);
    const left = new IdentifierExpression('x', l);
    const right = new LiteralExpression(500, l);
    const cmp = new BinaryExpression(left, TokenType.NOT_EQUAL, right, l);
    const ifStmt = new IfStatement(cmp, [], null, l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [wSlot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });

  it('should emit CMP_WORD_IMM for if (wordVar <= literal)', () => {
    const l = loc();
    const wSlot = createWordSlot('x', 0x0200);
    const left = new IdentifierExpression('x', l);
    const right = new LiteralExpression(2000, l);
    const cmp = new BinaryExpression(left, TokenType.LESS_EQUAL, right, l);
    const ifStmt = new IfStatement(cmp, [], null, l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [wSlot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });

  it('should emit CMP_WORD_IMM for if (wordVar >= literal)', () => {
    const l = loc();
    const wSlot = createWordSlot('x', 0x0200);
    const left = new IdentifierExpression('x', l);
    const right = new LiteralExpression(100, l);
    const cmp = new BinaryExpression(left, TokenType.GREATER_EQUAL, right, l);
    const ifStmt = new IfStatement(cmp, [], null, l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [wSlot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });
});

// ============================================================================
// Word Comparison with Slot in If-Conditions (CMP_WORD_SLOT)
// ============================================================================

describe('ILGenerator - Word Slot Comparison in If-Conditions', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit CMP_WORD_SLOT for if (wordVar == wordVar2)', () => {
    const l = loc();
    const wa = createWordSlot('wa', 0x0200);
    const wb = createWordSlot('wb', 0x0202);
    const left = new IdentifierExpression('wa', l);
    const right = new IdentifierExpression('wb', l);
    const cmp = new BinaryExpression(left, TokenType.EQUAL, right, l);
    const ifStmt = new IfStatement(cmp, [], null, l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [wa, wb]);
    const instructions = result.functions[0].instructions;

    const cmpWordSlot = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_SLOT);
    expect(cmpWordSlot).toBeDefined();
  });

  it('should emit CMP_WORD_SLOT for if (wordVar > wordVar2)', () => {
    const l = loc();
    const wa = createWordSlot('counter', 0x0200);
    const wb = createWordSlot('limit', 0x0202);
    const left = new IdentifierExpression('counter', l);
    const right = new IdentifierExpression('limit', l);
    const cmp = new BinaryExpression(left, TokenType.GREATER_THAN, right, l);
    const ifStmt = new IfStatement(cmp, [], null, l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [wa, wb]);
    const instructions = result.functions[0].instructions;

    const cmpWordSlot = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_SLOT);
    expect(cmpWordSlot).toBeDefined();
  });
});

// ============================================================================
// Byte Comparison Regression Tests
// ============================================================================

describe('ILGenerator - Byte Comparison Regression in If-Conditions', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should still emit CMP_IMM for if (byteVar == literal)', () => {
    const l = loc();
    const bSlot = createByteSlot('color', 0x0200);
    const left = new IdentifierExpression('color', l);
    const right = new LiteralExpression(15, l);
    const cmp = new BinaryExpression(left, TokenType.EQUAL, right, l);
    const ifStmt = new IfStatement(cmp, [], null, l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [bSlot]);
    const instructions = result.functions[0].instructions;

    // Should use byte CMP_IMM, NOT CMP_WORD_IMM
    const byteCmp = instructions.find(i => i.opcode === ILOpcode.CMP_IMM);
    expect(byteCmp).toBeDefined();
    const wordCmp = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(wordCmp).toBeUndefined();
  });

  it('should still emit CMP_BYTE for if (byteVar > byteVar2)', () => {
    const l = loc();
    const a = createByteSlot('a', 0x0200);
    const b = createByteSlot('b', 0x0201);
    const left = new IdentifierExpression('a', l);
    const right = new IdentifierExpression('b', l);
    const cmp = new BinaryExpression(left, TokenType.GREATER_THAN, right, l);
    const ifStmt = new IfStatement(cmp, [], null, l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [a, b]);
    const instructions = result.functions[0].instructions;

    const byteCmp = instructions.find(i => i.opcode === ILOpcode.CMP_BYTE);
    expect(byteCmp).toBeDefined();
    const wordCmp = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_SLOT);
    expect(wordCmp).toBeUndefined();
  });
});

// ============================================================================
// Word Comparison in While-Conditions
// ============================================================================

describe('ILGenerator - Word Comparison in While-Conditions', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit CMP_WORD_IMM for while (wordVar < literal)', () => {
    const l = loc();
    const wSlot = createWordSlot('counter', 0x0200);
    const left = new IdentifierExpression('counter', l);
    const right = new LiteralExpression(5000, l);
    const cmp = new BinaryExpression(left, TokenType.LESS_THAN, right, l);
    const whileStmt = new WhileStatement(cmp, [], l);

    const result = generateFunctionWithBody(frameMap, symbolTable, [whileStmt], [wSlot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });
});
