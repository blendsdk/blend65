/**
 * IL Generator - Word Function Tests
 *
 * Tests for word-typed (16-bit) function support:
 * - Word parameter prologue (STORE_WORD to param slot)
 * - Word argument passing (LOAD_WORD before CALL)
 * - Word return values (PROMOTE_BYTE_WORD when returning byte from word function)
 * - Byte→word argument promotion (PROMOTE_BYTE_WORD before CALL)
 *
 * These tests verify Phase 8 tasks 8.1.1–8.1.4 of the
 * word-arithmetic-and-addressing plan.
 *
 * @module __tests__/il/generator-word-functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILGenerator } from '../../il/generator/index.js';
import { ILOpcode } from '../../il/enums.js';
import { Frame, createFrame } from '../../frame/allocator/frame-calculator.js';
import {
  FrameSlot,
  createFrameSlot,
  createReturnSlot,
} from '../../frame/types.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import {
  LiteralExpression,
  IdentifierExpression,
  CallExpression,
} from '../../ast/expressions.js';
import { FunctionDecl, Parameter } from '../../ast/declarations.js';
import {
  ExpressionStatement,
  ReturnStatement,
} from '../../ast/statements.js';
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
 * Create a word (16-bit) local slot.
 */
function createWordSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD);
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
 * Create a word (16-bit) return slot.
 */
function createWordReturnSlot(address: number): FrameSlot {
  const slot = createReturnSlot(BUILTIN_TYPES.WORD);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Create a byte (8-bit) return slot.
 */
function createByteReturnSlot(address: number): FrameSlot {
  const slot = createReturnSlot(BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Helper: generate IL for a program with the given function declarations.
 *
 * Creates a Program with a module and the specified functions, then
 * runs the IL generator and returns the result.
 *
 * @param frameMap - Map of function name → Frame
 * @param symbolTable - Symbol table
 * @param functions - Function declarations to include in the program
 * @returns IL program result
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
// Word Parameter Prologue Tests
// ============================================================================

describe('ILGenerator - Word Parameter Prologue', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit STORE_WORD for word parameter prologue', () => {
    const loc = createTestLocation();

    // Frame: word parameter slot (2 bytes)
    const addrParam = createWordParamSlot('addr', 0x0200);
    frameMap.set('processAddr', createTestFrame('processAddr', [addrParam]));

    // Function: processAddr(addr: word): void { }
    const param: Parameter = { name: 'addr', typeAnnotation: 'word', location: loc };
    const funcDecl = new FunctionDecl('processAddr', [param], 'void', [], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [funcDecl]);
    const instructions = result.functions[0].instructions;

    // First non-meta instruction should be STORE_WORD (parameter prologue)
    // Prologue stores incoming A:X to the word param slot
    const storeWord = instructions.find(i => i.opcode === ILOpcode.STORE_WORD);
    expect(storeWord).toBeDefined();
    expect(storeWord!.comment).toContain('param addr');
    expect(storeWord!.comment).toContain('word');
  });

  it('should emit STORE_BYTE for byte parameter prologue', () => {
    const loc = createTestLocation();

    // Frame: byte parameter slot (1 byte)
    const valParam = createByteParamSlot('value', 0x0200);
    frameMap.set('processVal', createTestFrame('processVal', [valParam]));

    // Function: processVal(value: byte): void { }
    const param: Parameter = { name: 'value', typeAnnotation: 'byte', location: loc };
    const funcDecl = new FunctionDecl('processVal', [param], 'void', [], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [funcDecl]);
    const instructions = result.functions[0].instructions;

    // First non-meta instruction should be STORE_BYTE (byte parameter prologue)
    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeDefined();
    expect(storeByte!.comment).toContain('param value');
  });

  it('should NOT emit prologue for register-allocated parameters', () => {
    const loc = createTestLocation();

    // Frame: register-allocated parameter (no memory store needed)
    const regParam = createByteParamSlot('x', 0x0200);
    regParam.location = SlotLocation.Register;
    frameMap.set('regFunc', createTestFrame('regFunc', [regParam]));

    // Function: regFunc(x: byte): void { }
    const param: Parameter = { name: 'x', typeAnnotation: 'byte', location: loc };
    const funcDecl = new FunctionDecl('regFunc', [param], 'void', [], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [funcDecl]);
    const instructions = result.functions[0].instructions;

    // Should NOT have any STORE_BYTE/STORE_WORD for prologue
    // (register params are read directly via TRANSFER_*A)
    const storeOps = instructions.filter(
      i => i.opcode === ILOpcode.STORE_BYTE || i.opcode === ILOpcode.STORE_WORD
    );
    expect(storeOps.length).toBe(0);
  });

  it('should NOT emit prologue for parameterless functions', () => {
    const loc = createTestLocation();

    // Frame: no parameter slots
    frameMap.set('noParams', createTestFrame('noParams', []));

    // Function: noParams(): void { }
    const funcDecl = new FunctionDecl('noParams', [], 'void', [], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [funcDecl]);
    const instructions = result.functions[0].instructions;

    // Should only have a RETURN instruction (void implicit return)
    const storeOps = instructions.filter(
      i => i.opcode === ILOpcode.STORE_BYTE || i.opcode === ILOpcode.STORE_WORD
    );
    expect(storeOps.length).toBe(0);
  });
});

// ============================================================================
// Word Return Value Tests
// ============================================================================

describe('ILGenerator - Word Return Values', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit PROMOTE_BYTE_WORD when returning byte literal from word function', () => {
    const loc = createTestLocation();

    // Frame: word return slot (signals function returns word)
    const retSlot = createWordReturnSlot(0x0210);
    frameMap.set('getAddr', createTestFrame('getAddr', [retSlot]));

    // Function body: return 42;
    // The literal 42 is byte-typed, but function returns word → needs promotion
    const returnValue = new LiteralExpression(42, loc);
    const returnStmt = new ReturnStatement(returnValue, loc);
    const funcDecl = new FunctionDecl('getAddr', [], 'word', [returnStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [funcDecl]);
    const instructions = result.functions[0].instructions;

    // Should have PROMOTE_BYTE_WORD before RETURN
    const promoteIdx = instructions.findIndex(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    const returnIdx = instructions.findIndex(i => i.opcode === ILOpcode.RETURN);

    expect(promoteIdx).toBeGreaterThanOrEqual(0);
    expect(returnIdx).toBeGreaterThan(promoteIdx);
    expect(instructions[promoteIdx].comment).toContain('return byte→word');
  });

  it('should NOT emit PROMOTE_BYTE_WORD when returning word identifier from word function', () => {
    const loc = createTestLocation();

    // Frame: word local slot + word return slot
    const addrSlot = createWordSlot('addr', 0x0200);
    const retSlot = createWordReturnSlot(0x0210);
    frameMap.set('getAddr', createTestFrame('getAddr', [addrSlot, retSlot]));

    // Function body: return addr;
    // The identifier 'addr' is word-typed → already produces A:X, no promotion needed
    const returnValue = new IdentifierExpression('addr', loc);
    returnValue.setTypeInfo(BUILTIN_TYPES.WORD);
    const returnStmt = new ReturnStatement(returnValue, loc);
    const funcDecl = new FunctionDecl('getAddr', [], 'word', [returnStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [funcDecl]);
    const instructions = result.functions[0].instructions;

    // Should have LOAD_WORD + RETURN but NO PROMOTE_BYTE_WORD
    const loadWord = instructions.find(i => i.opcode === ILOpcode.LOAD_WORD);
    expect(loadWord).toBeDefined();

    const promote = instructions.find(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    expect(promote).toBeUndefined();

    const returnInstr = instructions.find(i => i.opcode === ILOpcode.RETURN);
    expect(returnInstr).toBeDefined();
  });

  it('should NOT emit PROMOTE_BYTE_WORD for byte return function', () => {
    const loc = createTestLocation();

    // Frame: byte return slot (function returns byte)
    const retSlot = createByteReturnSlot(0x0210);
    frameMap.set('getVal', createTestFrame('getVal', [retSlot]));

    // Function body: return 42;
    const returnValue = new LiteralExpression(42, loc);
    const returnStmt = new ReturnStatement(returnValue, loc);
    const funcDecl = new FunctionDecl('getVal', [], 'byte', [returnStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [funcDecl]);
    const instructions = result.functions[0].instructions;

    // Should have LOAD_IMM + RETURN but NO PROMOTE_BYTE_WORD
    const promote = instructions.find(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    expect(promote).toBeUndefined();

    const returnInstr = instructions.find(i => i.opcode === ILOpcode.RETURN);
    expect(returnInstr).toBeDefined();
  });

  it('should NOT emit PROMOTE_BYTE_WORD for void return', () => {
    const loc = createTestLocation();

    // Frame: no return slot (void function)
    frameMap.set('doNothing', createTestFrame('doNothing', []));

    // Function body: return; (void)
    const returnStmt = new ReturnStatement(null, loc);
    const funcDecl = new FunctionDecl('doNothing', [], 'void', [returnStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [funcDecl]);
    const instructions = result.functions[0].instructions;

    // No PROMOTE_BYTE_WORD — void return has no value
    const promote = instructions.find(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    expect(promote).toBeUndefined();
  });
});

// ============================================================================
// Word Argument Passing Tests
// ============================================================================

describe('ILGenerator - Word Argument Passing', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit CALL for function call with word argument', () => {
    const loc = createTestLocation();

    // Frame for caller: has a word local 'addr'
    const addrSlot = createWordSlot('addr', 0x0200);
    frameMap.set('caller', createTestFrame('caller', [addrSlot]));

    // Frame for callee: has a word parameter slot
    const calleeParam = createWordParamSlot('target', 0x0300);
    frameMap.set('callee', createTestFrame('callee', [calleeParam]));

    // Caller body: callee(addr);
    const addrIdent = new IdentifierExpression('addr', loc);
    addrIdent.setTypeInfo(BUILTIN_TYPES.WORD);
    const calleeIdent = new IdentifierExpression('callee', loc);
    const callExpr = new CallExpression(calleeIdent, [addrIdent], loc);
    const callStmt = new ExpressionStatement(callExpr, loc);

    // Create callee function (stub needed for frame resolution)
    const calleeDecl = new FunctionDecl(
      'callee',
      [{ name: 'target', typeAnnotation: 'word', location: loc }],
      'void', [], loc, false, false
    );

    // Create caller function
    const callerDecl = new FunctionDecl('caller', [], 'void', [callStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [calleeDecl, callerDecl]);

    // Find the caller's function IL
    const callerFunc = result.functions.find(f => f.name === 'caller');
    expect(callerFunc).toBeDefined();

    const instructions = callerFunc!.instructions;

    // Should have LOAD_WORD (loads word arg) followed by CALL
    const loadWordIdx = instructions.findIndex(i => i.opcode === ILOpcode.LOAD_WORD);
    const callIdx = instructions.findIndex(i => i.opcode === ILOpcode.CALL);

    expect(loadWordIdx).toBeGreaterThanOrEqual(0);
    expect(callIdx).toBeGreaterThan(loadWordIdx);
  });

  it('should emit PROMOTE_BYTE_WORD when passing byte arg to word param', () => {
    const loc = createTestLocation();

    // Frame for caller: has a byte local 'value'
    const valueSlot = createByteSlot('value', 0x0200);
    frameMap.set('caller', createTestFrame('caller', [valueSlot]));

    // Frame for callee: expects word parameter
    const calleeParam = createWordParamSlot('target', 0x0300);
    frameMap.set('callee', createTestFrame('callee', [calleeParam]));

    // Caller body: callee(value);
    // value is byte-typed but callee expects word → promotion needed
    const valueIdent = new IdentifierExpression('value', loc);
    // Don't set word typeInfo — this is a byte-typed expression
    const calleeIdent = new IdentifierExpression('callee', loc);
    const callExpr = new CallExpression(calleeIdent, [valueIdent], loc);
    const callStmt = new ExpressionStatement(callExpr, loc);

    // Create callee function
    const calleeDecl = new FunctionDecl(
      'callee',
      [{ name: 'target', typeAnnotation: 'word', location: loc }],
      'void', [], loc, false, false
    );

    // Create caller function
    const callerDecl = new FunctionDecl('caller', [], 'void', [callStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [calleeDecl, callerDecl]);

    // Find the caller's function IL
    const callerFunc = result.functions.find(f => f.name === 'caller');
    expect(callerFunc).toBeDefined();

    const instructions = callerFunc!.instructions;

    // Should have PROMOTE_BYTE_WORD before CALL
    // (byte arg promoted to word for word parameter)
    const promoteIdx = instructions.findIndex(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    const callIdx = instructions.findIndex(i => i.opcode === ILOpcode.CALL);

    expect(promoteIdx).toBeGreaterThanOrEqual(0);
    expect(callIdx).toBeGreaterThan(promoteIdx);
  });

  it('should NOT emit PROMOTE_BYTE_WORD when passing byte arg to byte param', () => {
    const loc = createTestLocation();

    // Frame for caller: has a byte local 'value'
    const valueSlot = createByteSlot('value', 0x0200);
    frameMap.set('caller', createTestFrame('caller', [valueSlot]));

    // Frame for callee: expects byte parameter
    const calleeParam = createByteParamSlot('x', 0x0300);
    frameMap.set('callee', createTestFrame('callee', [calleeParam]));

    // Caller body: callee(value);
    const valueIdent = new IdentifierExpression('value', loc);
    const calleeIdent = new IdentifierExpression('callee', loc);
    const callExpr = new CallExpression(calleeIdent, [valueIdent], loc);
    const callStmt = new ExpressionStatement(callExpr, loc);

    // Create callee function
    const calleeDecl = new FunctionDecl(
      'callee',
      [{ name: 'x', typeAnnotation: 'byte', location: loc }],
      'void', [], loc, false, false
    );

    // Create caller function
    const callerDecl = new FunctionDecl('caller', [], 'void', [callStmt], loc, false, false);

    const result = generateProgram(frameMap, symbolTable, [calleeDecl, callerDecl]);

    // Find the caller's function IL
    const callerFunc = result.functions.find(f => f.name === 'caller');
    expect(callerFunc).toBeDefined();

    const instructions = callerFunc!.instructions;

    // Should NOT have PROMOTE_BYTE_WORD — byte arg to byte param needs no promotion
    const promote = instructions.find(i => i.opcode === ILOpcode.PROMOTE_BYTE_WORD);
    expect(promote).toBeUndefined();

    // Should still have CALL
    const call = instructions.find(i => i.opcode === ILOpcode.CALL);
    expect(call).toBeDefined();
  });
});
