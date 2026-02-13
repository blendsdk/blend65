/**
 * IL Generator - Word Comparison Tests
 *
 * Tests for word-typed (16-bit) comparison generation:
 * - Word binary comparisons with immediate values (CMP_WORD_IMM)
 * - Word binary comparisons with slot values (CMP_WORD_SLOT)
 * - Word-typed binary expression dispatch
 *
 * These tests verify Phase 7 task 7.1.1 (type-aware comparisons)
 * in the binary expression path (generateBinaryWord).
 *
 * @module __tests__/il/generator-word-comparisons
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILGenerator } from '../../il/generator/index.js';
import { ILOpcode } from '../../il/enums.js';
import { Frame, createFrame } from '../../frame/allocator/frame-calculator.js';
import { FrameSlot, createFrameSlot } from '../../frame/types.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { BUILTIN_TYPES, TypeKind } from '../../semantic/types.js';
import {
  LiteralExpression,
  IdentifierExpression,
  BinaryExpression,
} from '../../ast/expressions.js';
import { FunctionDecl } from '../../ast/declarations.js';
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
 * Create a byte (8-bit) slot.
 */
function createByteSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE);
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
// Word Comparison with Immediate Tests
// ============================================================================

describe('ILGenerator - Word Comparison with Immediate', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit CMP_WORD_IMM for word == immediate', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);

    // Expression: addr == 0x0400
    // The binary expression has word result type (set by semantic analysis)
    const left = new IdentifierExpression('addr', loc);
    const right = new LiteralExpression(0x0400, loc);
    const cmp = new BinaryExpression(left, TokenType.EQUAL, right, loc);

    // Set word type info on the binary expression (normally done by type checker)
    cmp.setTypeInfo(BUILTIN_TYPES.WORD);

    const stmt = new ExpressionStatement(cmp, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [addrSlot]);
    const instructions = result.functions[0].instructions;

    // Should use CMP_WORD_IMM for 16-bit comparison
    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });

  it('should emit CMP_WORD_IMM for word < immediate', () => {
    const loc = createTestLocation();
    const counterSlot = createWordSlot('counter', 0x0200);

    // Expression: counter < 1000
    const left = new IdentifierExpression('counter', loc);
    const right = new LiteralExpression(1000, loc);
    const cmp = new BinaryExpression(left, TokenType.LESS_THAN, right, loc);
    cmp.setTypeInfo(BUILTIN_TYPES.WORD);

    const stmt = new ExpressionStatement(cmp, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [counterSlot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });

  it('should emit CMP_WORD_IMM for word > immediate', () => {
    const loc = createTestLocation();
    const counterSlot = createWordSlot('counter', 0x0200);

    // Expression: counter > 500
    const left = new IdentifierExpression('counter', loc);
    const right = new LiteralExpression(500, loc);
    const cmp = new BinaryExpression(left, TokenType.GREATER_THAN, right, loc);
    cmp.setTypeInfo(BUILTIN_TYPES.WORD);

    const stmt = new ExpressionStatement(cmp, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [counterSlot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });

  it('should emit LOAD_WORD before CMP_WORD_IMM', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);

    // addr == 0x0400 → LOAD_WORD addr, then CMP_WORD_IMM $0400
    const left = new IdentifierExpression('addr', loc);
    const right = new LiteralExpression(0x0400, loc);
    const cmp = new BinaryExpression(left, TokenType.EQUAL, right, loc);
    cmp.setTypeInfo(BUILTIN_TYPES.WORD);

    const stmt = new ExpressionStatement(cmp, loc);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [addrSlot]);
    const instructions = result.functions[0].instructions;

    // LOAD_WORD should come before CMP_WORD_IMM
    const loadIdx = instructions.findIndex(i => i.opcode === ILOpcode.LOAD_WORD);
    const cmpIdx = instructions.findIndex(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(loadIdx).toBeGreaterThanOrEqual(0);
    expect(cmpIdx).toBeGreaterThan(loadIdx);
  });
});

// ============================================================================
// Word Comparison with Slot Tests
// ============================================================================

describe('ILGenerator - Word Comparison with Slot', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit CMP_WORD_SLOT for word == word variable', () => {
    const loc = createTestLocation();
    const addrSlot = createWordSlot('addr', 0x0200);
    const limitSlot = createWordSlot('limit', 0x0202);

    // Expression: addr == limit
    const left = new IdentifierExpression('addr', loc);
    const right = new IdentifierExpression('limit', loc);
    const cmp = new BinaryExpression(left, TokenType.EQUAL, right, loc);
    cmp.setTypeInfo(BUILTIN_TYPES.WORD);

    const stmt = new ExpressionStatement(cmp, loc);
    const result = generateFunctionWithBody(
      frameMap, symbolTable, [stmt], [addrSlot, limitSlot],
    );
    const instructions = result.functions[0].instructions;

    // Should use CMP_WORD_SLOT for comparing two word variables
    const cmpWordSlot = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_SLOT);
    expect(cmpWordSlot).toBeDefined();
  });

  it('should emit CMP_WORD_SLOT for word < word variable', () => {
    const loc = createTestLocation();
    const counterSlot = createWordSlot('counter', 0x0200);
    const maxSlot = createWordSlot('max', 0x0202);

    // Expression: counter < max
    const left = new IdentifierExpression('counter', loc);
    const right = new IdentifierExpression('max', loc);
    const cmp = new BinaryExpression(left, TokenType.LESS_THAN, right, loc);
    cmp.setTypeInfo(BUILTIN_TYPES.WORD);

    const stmt = new ExpressionStatement(cmp, loc);
    const result = generateFunctionWithBody(
      frameMap, symbolTable, [stmt], [counterSlot, maxSlot],
    );
    const instructions = result.functions[0].instructions;

    const cmpWordSlot = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_SLOT);
    expect(cmpWordSlot).toBeDefined();
  });

  it('should promote byte left operand to word before word comparison', () => {
    const loc = createTestLocation();
    const byteVal = createByteSlot('byteVal', 0x0200);
    const wordLimit = createWordSlot('wordLimit', 0x0201);

    // Expression: byteVal == wordLimit
    // Left is byte, right is word → promote byte to word before compare
    const left = new IdentifierExpression('byteVal', loc);
    const right = new IdentifierExpression('wordLimit', loc);
    const cmp = new BinaryExpression(left, TokenType.EQUAL, right, loc);
    cmp.setTypeInfo(BUILTIN_TYPES.WORD);

    const stmt = new ExpressionStatement(cmp, loc);
    const result = generateFunctionWithBody(
      frameMap, symbolTable, [stmt], [byteVal, wordLimit],
    );
    const instructions = result.functions[0].instructions;

    // Should have PROMOTE_BYTE_WORD (LDX #0) to widen byte to A:X
    const promote = instructions.find(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    expect(promote).toBeDefined();

    // Then CMP_WORD_SLOT for the comparison
    const cmpWordSlot = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_SLOT);
    expect(cmpWordSlot).toBeDefined();
  });
});

// ============================================================================
// Word Comparison Operator Coverage Tests
// ============================================================================

describe('ILGenerator - Word Comparison Operator Coverage', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  /**
   * Helper to create a word comparison expression statement.
   */
  function createWordComparisonStmt(
    op: TokenType,
    slotName: string,
    immValue: number,
  ): { stmt: ExpressionStatement; slot: FrameSlot } {
    const loc = createTestLocation();
    const slot = createWordSlot(slotName, 0x0200);
    const left = new IdentifierExpression(slotName, loc);
    const right = new LiteralExpression(immValue, loc);
    const cmp = new BinaryExpression(left, op, right, loc);
    cmp.setTypeInfo(BUILTIN_TYPES.WORD);
    return { stmt: new ExpressionStatement(cmp, loc), slot };
  }

  it('should handle word != immediate', () => {
    const { stmt, slot } = createWordComparisonStmt(TokenType.NOT_EQUAL, 'x', 0x1000);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [slot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });

  it('should handle word <= immediate', () => {
    const { stmt, slot } = createWordComparisonStmt(TokenType.LESS_EQUAL, 'x', 0x2000);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [slot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });

  it('should handle word >= immediate', () => {
    const { stmt, slot } = createWordComparisonStmt(TokenType.GREATER_EQUAL, 'x', 0x3000);
    const result = generateFunctionWithBody(frameMap, symbolTable, [stmt], [slot]);
    const instructions = result.functions[0].instructions;

    const cmpWordImm = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
    expect(cmpWordImm).toBeDefined();
  });
});
