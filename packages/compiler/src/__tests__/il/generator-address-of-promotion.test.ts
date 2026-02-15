/**
 * IL Generator - Address-of Argument Promotion Tests
 *
 * Tests that the `@variable` (address-of) argument correctly skips
 * PROMOTE_BYTE_WORD when passed to a word-typed function parameter.
 *
 * Bug #1 (sprite-function-codegen-bugs plan):
 * When `@variable` is passed as an argument to a function expecting a word
 * parameter, the IL generator was incorrectly emitting PROMOTE_BYTE_WORD
 * (LDX #$00), which destroys the high byte already loaded by LOAD_ADDRESS.
 * The fix detects address-of expressions and skips the promotion.
 *
 * These tests cover:
 * - @variable arg → word param: NO PROMOTE_BYTE_WORD (LOAD_ADDRESS already word)
 * - byte literal arg → word param: still emits PROMOTE_BYTE_WORD (regression)
 * - byte variable arg → word param: still emits PROMOTE_BYTE_WORD (regression)
 * - @variable arg → byte param: no promotion needed (size !== 2)
 *
 * @module __tests__/il/generator-address-of-promotion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILGenerator } from '../../il/generator/index.js';
import { ILOpcode } from '../../il/enums.js';
import { Frame, createFrame } from '../../frame/allocator/frame-calculator.js';
import {
  FrameSlot,
  createFrameSlot,
} from '../../frame/types.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import {
  LiteralExpression,
  IdentifierExpression,
  CallExpression,
  UnaryExpression,
} from '../../ast/expressions.js';
import { FunctionDecl, Parameter } from '../../ast/declarations.js';
import { ExpressionStatement } from '../../ast/statements.js';
import { Program, ModuleDecl } from '../../ast/program.js';
import { SourceLocation } from '../../ast/base.js';
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
 * Create a word (16-bit) parameter slot.
 */
function createWordParamSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Parameter, BUILTIN_TYPES.WORD);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Create a byte (8-bit) parameter slot.
 */
function createByteParamSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Parameter, BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Create a byte (8-bit) local slot.
 */
function createByteSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Create a @data slot (for address-of tests — has dataLabel).
 */
function createDataSlot(name: string, dataLabel: string): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Global, BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.DataSegment;
  slot.dataLabel = dataLabel;
  return slot;
}

/**
 * Create a @ram slot (for address-of tests — has numeric address).
 */
function createRamSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Global, BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.Absolute;
  slot.address = address;
  return slot;
}

/**
 * Helper: generate IL for a program with the given function declarations.
 */
function generateProgram(
  frameMap: Map<string, Frame>,
  symbolTable: SymbolTable,
  functions: FunctionDecl[],
): ReturnType<ILGenerator['generate']> {
  const generator = new ILGenerator(frameMap, symbolTable);
  const loc = createTestLocation();
  const moduleDecl = new ModuleDecl(['test'], loc, false);
  const program = new Program(moduleDecl, functions, loc);
  return generator.generate(program);
}

// ============================================================================
// Bug #1: Address-of Argument Promotion Fix
// ============================================================================

describe('ILGenerator - Address-of Argument Promotion (Bug #1 Fix)', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  // ────────────────────────────────────────────────────────────────────
  // Core fix: @variable arg to word param should NOT promote
  // ────────────────────────────────────────────────────────────────────

  it('should NOT emit PROMOTE_BYTE_WORD when passing @variable to word param', () => {
    // This is the core bug fix test.
    // @variable produces LOAD_ADDRESS (full A:X word pair).
    // PROMOTE_BYTE_WORD after LOAD_ADDRESS would do LDX #$00,
    // destroying the high byte of the address.
    const loc = createTestLocation();

    // Frame for caller: has a @data slot 'spriteData'
    const dataSlot = createDataSlot('spriteData', 'test_spriteData');
    frameMap.set('caller', createTestFrame('caller', [dataSlot]));

    // Frame for callee: expects word parameter
    const calleeParam = createWordParamSlot('addr', 0x0300);
    frameMap.set('processAddr', createTestFrame('processAddr', [calleeParam]));

    // Caller body: processAddr(@spriteData);
    // @spriteData is a unary AT expression → LOAD_ADDRESS → already A:X word
    const spriteIdent = new IdentifierExpression('spriteData', loc);
    const addressOfExpr = new UnaryExpression(TokenType.AT, spriteIdent, loc);
    const calleeIdent = new IdentifierExpression('processAddr', loc);
    const callExpr = new CallExpression(calleeIdent, [addressOfExpr], loc);
    const callStmt = new ExpressionStatement(callExpr, loc);

    // Create callee function declaration
    const calleeDecl = new FunctionDecl(
      'processAddr',
      [{ name: 'addr', typeAnnotation: 'word', location: loc }],
      'void', [], loc, false, false,
    );

    // Create caller function
    const callerDecl = new FunctionDecl('caller', [], 'void', [callStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [calleeDecl, callerDecl]);

    // Find the caller's function IL
    const callerFunc = result.functions.find(f => f.name === 'caller');
    expect(callerFunc).toBeDefined();

    const instructions = callerFunc!.instructions;

    // Should have LOAD_ADDRESS (for @spriteData) and CALL
    const hasLoadAddr = instructions.some(i => i.opcode === ILOpcode.LOAD_ADDRESS);
    expect(hasLoadAddr).toBe(true);

    const hasCall = instructions.some(i => i.opcode === ILOpcode.CALL);
    expect(hasCall).toBe(true);

    // Should NOT have PROMOTE_BYTE_WORD — LOAD_ADDRESS already produces A:X word
    const promote = instructions.find(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    expect(promote).toBeUndefined();
  });

  it('should NOT emit PROMOTE_BYTE_WORD for @ram_variable to word param', () => {
    // Same fix applies to @ram variables (numeric address)
    const loc = createTestLocation();

    // Frame for caller: has a @ram slot 'buffer'
    const ramSlot = createRamSlot('buffer', 0x3000);
    frameMap.set('caller', createTestFrame('caller', [ramSlot]));

    // Frame for callee: expects word parameter
    const calleeParam = createWordParamSlot('ptr', 0x0300);
    frameMap.set('usePtr', createTestFrame('usePtr', [calleeParam]));

    // Caller body: usePtr(@buffer);
    const bufIdent = new IdentifierExpression('buffer', loc);
    const addressOfExpr = new UnaryExpression(TokenType.AT, bufIdent, loc);
    const calleeIdent = new IdentifierExpression('usePtr', loc);
    const callExpr = new CallExpression(calleeIdent, [addressOfExpr], loc);
    const callStmt = new ExpressionStatement(callExpr, loc);

    const calleeDecl = new FunctionDecl(
      'usePtr',
      [{ name: 'ptr', typeAnnotation: 'word', location: loc }],
      'void', [], loc, false, false,
    );
    const callerDecl = new FunctionDecl('caller', [], 'void', [callStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [calleeDecl, callerDecl]);
    const callerFunc = result.functions.find(f => f.name === 'caller');
    expect(callerFunc).toBeDefined();

    // Should NOT have PROMOTE_BYTE_WORD
    const promote = callerFunc!.instructions.find(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    expect(promote).toBeUndefined();

    // Should have CALL
    const hasCall = callerFunc!.instructions.some(i => i.opcode === ILOpcode.CALL);
    expect(hasCall).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────
  // Regression: byte literal arg to word param MUST still promote
  // ────────────────────────────────────────────────────────────────────

  it('should STILL emit PROMOTE_BYTE_WORD when passing byte literal to word param', () => {
    // Byte literal (e.g., 42) needs promotion to word (LDX #$00).
    // This is the existing behavior that must NOT break.
    const loc = createTestLocation();

    // Frame for caller: empty
    frameMap.set('caller', createTestFrame('caller', []));

    // Frame for callee: expects word parameter
    const calleeParam = createWordParamSlot('addr', 0x0300);
    frameMap.set('callee', createTestFrame('callee', [calleeParam]));

    // Caller body: callee(42);
    const literal = new LiteralExpression(42, loc);
    const calleeIdent = new IdentifierExpression('callee', loc);
    const callExpr = new CallExpression(calleeIdent, [literal], loc);
    const callStmt = new ExpressionStatement(callExpr, loc);

    const calleeDecl = new FunctionDecl(
      'callee',
      [{ name: 'addr', typeAnnotation: 'word', location: loc }],
      'void', [], loc, false, false,
    );
    const callerDecl = new FunctionDecl('caller', [], 'void', [callStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [calleeDecl, callerDecl]);
    const callerFunc = result.functions.find(f => f.name === 'caller');
    expect(callerFunc).toBeDefined();

    // Should HAVE PROMOTE_BYTE_WORD — byte literal needs promotion
    const promoteIdx = callerFunc!.instructions.findIndex(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    const callIdx = callerFunc!.instructions.findIndex(i => i.opcode === ILOpcode.CALL);

    expect(promoteIdx).toBeGreaterThanOrEqual(0);
    expect(callIdx).toBeGreaterThan(promoteIdx);
  });

  it('should STILL emit PROMOTE_BYTE_WORD when passing byte variable to word param', () => {
    // Byte variable (e.g., myByte) needs promotion to word (LDX #$00).
    // This is the existing behavior that must NOT break.
    const loc = createTestLocation();

    // Frame for caller: has a byte local
    const byteSlot = createByteSlot('value', 0x0200);
    frameMap.set('caller', createTestFrame('caller', [byteSlot]));

    // Frame for callee: expects word parameter
    const calleeParam = createWordParamSlot('target', 0x0300);
    frameMap.set('callee', createTestFrame('callee', [calleeParam]));

    // Caller body: callee(value);
    const valueIdent = new IdentifierExpression('value', loc);
    // Don't set word typeInfo — this is a byte-typed expression
    const calleeIdent = new IdentifierExpression('callee', loc);
    const callExpr = new CallExpression(calleeIdent, [valueIdent], loc);
    const callStmt = new ExpressionStatement(callExpr, loc);

    const calleeDecl = new FunctionDecl(
      'callee',
      [{ name: 'target', typeAnnotation: 'word', location: loc }],
      'void', [], loc, false, false,
    );
    const callerDecl = new FunctionDecl('caller', [], 'void', [callStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [calleeDecl, callerDecl]);
    const callerFunc = result.functions.find(f => f.name === 'caller');
    expect(callerFunc).toBeDefined();

    // Should HAVE PROMOTE_BYTE_WORD — byte variable needs promotion
    const promote = callerFunc!.instructions.find(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    expect(promote).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────────
  // Edge case: @variable arg to byte param — no promotion needed
  // ────────────────────────────────────────────────────────────────────

  it('should NOT emit PROMOTE_BYTE_WORD when param is byte (size !== 2)', () => {
    // When the callee's param is byte-sized, no promotion is needed
    // regardless of argument type. The size === 2 guard prevents it.
    const loc = createTestLocation();

    // Frame for caller: has a @data slot
    const dataSlot = createDataSlot('spriteData', 'test_spriteData');
    frameMap.set('caller', createTestFrame('caller', [dataSlot]));

    // Frame for callee: expects byte parameter (NOT word)
    const calleeParam = createByteParamSlot('val', 0x0300);
    frameMap.set('byteFunc', createTestFrame('byteFunc', [calleeParam]));

    // Caller body: byteFunc(@spriteData);
    const spriteIdent = new IdentifierExpression('spriteData', loc);
    const addressOfExpr = new UnaryExpression(TokenType.AT, spriteIdent, loc);
    const calleeIdent = new IdentifierExpression('byteFunc', loc);
    const callExpr = new CallExpression(calleeIdent, [addressOfExpr], loc);
    const callStmt = new ExpressionStatement(callExpr, loc);

    const calleeDecl = new FunctionDecl(
      'byteFunc',
      [{ name: 'val', typeAnnotation: 'byte', location: loc }],
      'void', [], loc, false, false,
    );
    const callerDecl = new FunctionDecl('caller', [], 'void', [callStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [calleeDecl, callerDecl]);
    const callerFunc = result.functions.find(f => f.name === 'caller');
    expect(callerFunc).toBeDefined();

    // No promotion — param is byte, size guard prevents it
    const promote = callerFunc!.instructions.find(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    expect(promote).toBeUndefined();
  });

  // ────────────────────────────────────────────────────────────────────
  // Instruction sequence verification
  // ────────────────────────────────────────────────────────────────────

  it('should produce LOAD_ADDRESS → CALL sequence for @variable arg (no promote between)', () => {
    // Verifies the exact instruction sequence: LOAD_ADDRESS directly before CALL,
    // with no PROMOTE_BYTE_WORD inserted between them.
    const loc = createTestLocation();

    const dataSlot = createDataSlot('data', 'test_data');
    frameMap.set('caller', createTestFrame('caller', [dataSlot]));

    const calleeParam = createWordParamSlot('ptr', 0x0300);
    frameMap.set('target', createTestFrame('target', [calleeParam]));

    const dataIdent = new IdentifierExpression('data', loc);
    const atExpr = new UnaryExpression(TokenType.AT, dataIdent, loc);
    const targetIdent = new IdentifierExpression('target', loc);
    const callExpr = new CallExpression(targetIdent, [atExpr], loc);
    const callStmt = new ExpressionStatement(callExpr, loc);

    const targetDecl = new FunctionDecl(
      'target',
      [{ name: 'ptr', typeAnnotation: 'word', location: loc }],
      'void', [], loc, false, false,
    );
    const callerDecl = new FunctionDecl('caller', [], 'void', [callStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [targetDecl, callerDecl]);
    const callerFunc = result.functions.find(f => f.name === 'caller');
    expect(callerFunc).toBeDefined();

    const instructions = callerFunc!.instructions;

    // Find LOAD_ADDRESS and CALL positions
    const loadAddrIdx = instructions.findIndex(i => i.opcode === ILOpcode.LOAD_ADDRESS);
    const callIdx = instructions.findIndex(i => i.opcode === ILOpcode.CALL);

    expect(loadAddrIdx).toBeGreaterThanOrEqual(0);
    expect(callIdx).toBeGreaterThan(loadAddrIdx);

    // Verify no PROMOTE_BYTE_WORD exists between LOAD_ADDRESS and CALL
    const betweenInstructions = instructions.slice(loadAddrIdx + 1, callIdx);
    const promoteBetween = betweenInstructions.find(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    expect(promoteBetween).toBeUndefined();
  });
});
