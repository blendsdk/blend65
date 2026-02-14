/**
 * IL Generator - Array Store Tests
 *
 * Tests for array element write operations (arr[index] = value).
 * The implementation lives in `generateIndexAssignment()` in
 * `il/generator/expressions.ts`.
 *
 * Two paths are tested:
 * 1. **Static index** (compile-time constant): computes base+offset
 *    at compile time, emits STORE_BYTE to the fixed address.
 * 2. **Dynamic index** (runtime variable): generates index into A,
 *    transfers to Y (TAY), generates value into A, then emits
 *    STORE_BYTE with Y-indexed slot operand (STA base,Y).
 *
 * The builder methods `storeIndexedImm()` and `storeIndexedY()` in
 * `il/builder/memory.ts` create the appropriate slot operands.
 *
 * @module __tests__/il/generator-array-store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILGenerator } from '../../il/generator/index.js';
import { ILOpcode } from '../../il/enums.js';
import { Frame, createFrame } from '../../frame/allocator/frame-calculator.js';
import { FrameSlot, createFrameSlot } from '../../frame/types.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { BUILTIN_TYPES, TypeKind, TypeInfo } from '../../semantic/types.js';
import {
  LiteralExpression,
  IdentifierExpression,
  BinaryExpression,
  AssignmentExpression,
  IndexExpression,
} from '../../ast/expressions.js';
import { FunctionDecl } from '../../ast/declarations.js';
import { ExpressionStatement } from '../../ast/statements.js';
import { Program, ModuleDecl } from '../../ast/program.js';
import { SourceLocation, Expression } from '../../ast/base.js';
import { TokenType } from '../../lexer/types.js';
import { SlotOperand } from '../../il/operands.js';

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
 * Create a simple byte slot at a given address.
 */
function createByteSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Create a byte-array type with the given element count.
 */
function createByteArrayType(count: number): TypeInfo {
  return {
    kind: TypeKind.Array,
    name: `byte[${count}]`,
    size: count,
    elementType: BUILTIN_TYPES.BYTE,
    elementCount: count,
  };
}

/**
 * Create a byte-array slot at a given address.
 */
function createArraySlot(
  name: string,
  address: number,
  elementCount: number,
): FrameSlot {
  const arrayType = createByteArrayType(elementCount);
  const slot = createFrameSlot(name, SlotKind.Local, arrayType);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Helper: generate IL for a function body containing a single expression statement.
 *
 * @param generator - IL generator instance
 * @param frameMap - Frame map (generator reads frames from this)
 * @param expr - Expression to wrap in an ExpressionStatement
 * @param slots - Slots for testFunc's frame
 * @returns Generated IL program
 */
function generateExpressionIL(
  generator: ILGenerator,
  frameMap: Map<string, Frame>,
  expr: Expression,
  slots: FrameSlot[] = [],
) {
  const loc = createTestLocation();
  const stmt = new ExpressionStatement(expr, loc);
  const funcDecl = new FunctionDecl(
    'testFunc',
    [],
    'void',
    [stmt],
    loc,
    false,
    false,
  );
  const moduleDecl = new ModuleDecl(['test'], loc, false);
  const program = new Program(moduleDecl, [funcDecl], loc);

  frameMap.set('testFunc', createTestFrame('testFunc', slots));

  return generator.generate(program);
}

// ============================================================================
// Array Store Tests — Static Index
// ============================================================================

describe('ILGenerator - Array Store (Static Index)', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit STORE_BYTE at base+offset for static index assignment', () => {
    // arr[3] = 42;
    // Should compute address = base + 3, then STA to that address
    const loc = createTestLocation();

    const arrIdent = new IdentifierExpression('arr', loc);
    const indexExpr = new LiteralExpression(3, loc);
    const target = new IndexExpression(arrIdent, indexExpr, loc);

    const value = new LiteralExpression(42, loc);
    const assignment = new AssignmentExpression(
      target,
      TokenType.ASSIGN,
      value,
      loc,
    );

    const arrSlot = createArraySlot('arr', 0x0300, 8);
    const generator = new ILGenerator(frameMap, symbolTable);
    const result = generateExpressionIL(generator, frameMap, assignment, [
      arrSlot,
    ]);
    const instructions = result.functions[0].instructions;

    // Should have LOAD_IMM for value (42) and STORE_BYTE for arr[3]
    const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
    expect(loadImm).toBeDefined();

    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeDefined();

    // Verify the store target address is base (0x0300) + offset (3) = 0x0303
    const slotOp = storeByte!.operands[0] as SlotOperand;
    expect(slotOp.slot.address).toBe(0x0303);
  });

  it('should store to first element (offset 0)', () => {
    // arr[0] = 10;
    const loc = createTestLocation();

    const arrIdent = new IdentifierExpression('arr', loc);
    const indexExpr = new LiteralExpression(0, loc);
    const target = new IndexExpression(arrIdent, indexExpr, loc);

    const value = new LiteralExpression(10, loc);
    const assignment = new AssignmentExpression(
      target,
      TokenType.ASSIGN,
      value,
      loc,
    );

    const arrSlot = createArraySlot('arr', 0x0400, 16);
    const generator = new ILGenerator(frameMap, symbolTable);
    const result = generateExpressionIL(generator, frameMap, assignment, [
      arrSlot,
    ]);
    const instructions = result.functions[0].instructions;

    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeDefined();

    // Address = base (0x0400) + 0 = 0x0400
    const slotOp = storeByte!.operands[0] as SlotOperand;
    expect(slotOp.slot.address).toBe(0x0400);
  });

  it('should store to last element of array', () => {
    // arr[7] = 255; (for an 8-element array)
    const loc = createTestLocation();

    const arrIdent = new IdentifierExpression('arr', loc);
    const indexExpr = new LiteralExpression(7, loc);
    const target = new IndexExpression(arrIdent, indexExpr, loc);

    const value = new LiteralExpression(255, loc);
    const assignment = new AssignmentExpression(
      target,
      TokenType.ASSIGN,
      value,
      loc,
    );

    const arrSlot = createArraySlot('arr', 0x0200, 8);
    const generator = new ILGenerator(frameMap, symbolTable);
    const result = generateExpressionIL(generator, frameMap, assignment, [
      arrSlot,
    ]);
    const instructions = result.functions[0].instructions;

    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeDefined();

    // Address = base (0x0200) + 7 = 0x0207
    const slotOp = storeByte!.operands[0] as SlotOperand;
    expect(slotOp.slot.address).toBe(0x0207);
  });

  it('should mark stored element slot as isArrayElement', () => {
    // arr[2] = 0;
    const loc = createTestLocation();

    const arrIdent = new IdentifierExpression('arr', loc);
    const indexExpr = new LiteralExpression(2, loc);
    const target = new IndexExpression(arrIdent, indexExpr, loc);

    const value = new LiteralExpression(0, loc);
    const assignment = new AssignmentExpression(
      target,
      TokenType.ASSIGN,
      value,
      loc,
    );

    const arrSlot = createArraySlot('arr', 0x0300, 4);
    const generator = new ILGenerator(frameMap, symbolTable);
    const result = generateExpressionIL(generator, frameMap, assignment, [
      arrSlot,
    ]);
    const instructions = result.functions[0].instructions;

    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeDefined();

    const slotOp = storeByte!.operands[0] as SlotOperand;
    expect(slotOp.slot.isArrayElement).toBe(true);
  });
});

// ============================================================================
// Array Store Tests — Dynamic Index
// ============================================================================

describe('ILGenerator - Array Store (Dynamic Index)', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit TRANSFER_AY and Y-indexed STORE_BYTE for dynamic index', () => {
    // arr[i] = 42;
    // Should: generate i → A, TAY, generate 42 → A, STA arr,Y
    const loc = createTestLocation();

    const arrIdent = new IdentifierExpression('arr', loc);
    const indexIdent = new IdentifierExpression('i', loc);
    const target = new IndexExpression(arrIdent, indexIdent, loc);

    const value = new LiteralExpression(42, loc);
    const assignment = new AssignmentExpression(
      target,
      TokenType.ASSIGN,
      value,
      loc,
    );

    const arrSlot = createArraySlot('arr', 0x0300, 8);
    const iSlot = createByteSlot('i', 0x0200);
    const generator = new ILGenerator(frameMap, symbolTable);
    const result = generateExpressionIL(generator, frameMap, assignment, [
      arrSlot,
      iSlot,
    ]);
    const instructions = result.functions[0].instructions;

    // Should have TRANSFER_AY (TAY to move index to Y register)
    const transferAY = instructions.find(
      i => i.opcode === ILOpcode.TRANSFER_AY,
    );
    expect(transferAY).toBeDefined();

    // Should have STORE_BYTE (the Y-indexed store)
    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeDefined();

    // The store operand should be Y-indexed
    const slotOp = storeByte!.operands[0] as SlotOperand & {
      indexedByY?: boolean;
    };
    expect(slotOp.indexedByY).toBe(true);
  });

  it('should load index variable before transferring to Y', () => {
    // arr[i] = 0;
    // Step 1: LOAD_BYTE i → A
    // Step 2: TRANSFER_AY (A → Y)
    // Step 3: LOAD_IMM 0 → A
    // Step 4: STORE_BYTE arr[Y]
    const loc = createTestLocation();

    const arrIdent = new IdentifierExpression('arr', loc);
    const indexIdent = new IdentifierExpression('i', loc);
    const target = new IndexExpression(arrIdent, indexIdent, loc);

    const value = new LiteralExpression(0, loc);
    const assignment = new AssignmentExpression(
      target,
      TokenType.ASSIGN,
      value,
      loc,
    );

    const arrSlot = createArraySlot('arr', 0x0500, 16);
    const iSlot = createByteSlot('i', 0x0200);
    const generator = new ILGenerator(frameMap, symbolTable);
    const result = generateExpressionIL(generator, frameMap, assignment, [
      arrSlot,
      iSlot,
    ]);
    const instructions = result.functions[0].instructions;

    // Find opcode sequence: LOAD_BYTE (i), TRANSFER_AY, LOAD_IMM (0), STORE_BYTE
    const opcodes = instructions.map(i => i.opcode);

    const loadByteIdx = opcodes.indexOf(ILOpcode.LOAD_BYTE);
    const transferIdx = opcodes.indexOf(ILOpcode.TRANSFER_AY);
    const loadImmIdx = opcodes.indexOf(ILOpcode.LOAD_IMM);
    const storeByteIdx = opcodes.indexOf(ILOpcode.STORE_BYTE);

    // All should exist
    expect(loadByteIdx).toBeGreaterThanOrEqual(0);
    expect(transferIdx).toBeGreaterThanOrEqual(0);
    expect(loadImmIdx).toBeGreaterThanOrEqual(0);
    expect(storeByteIdx).toBeGreaterThanOrEqual(0);

    // Order: LOAD_BYTE < TRANSFER_AY < LOAD_IMM < STORE_BYTE
    expect(loadByteIdx).toBeLessThan(transferIdx);
    expect(transferIdx).toBeLessThan(loadImmIdx);
    expect(loadImmIdx).toBeLessThan(storeByteIdx);
  });

  it('should use array base address for Y-indexed store', () => {
    // arr[i] = 99; where arr is at $0600
    const loc = createTestLocation();

    const arrIdent = new IdentifierExpression('arr', loc);
    const indexIdent = new IdentifierExpression('i', loc);
    const target = new IndexExpression(arrIdent, indexIdent, loc);

    const value = new LiteralExpression(99, loc);
    const assignment = new AssignmentExpression(
      target,
      TokenType.ASSIGN,
      value,
      loc,
    );

    const arrSlot = createArraySlot('arr', 0x0600, 24);
    const iSlot = createByteSlot('i', 0x0200);
    const generator = new ILGenerator(frameMap, symbolTable);
    const result = generateExpressionIL(generator, frameMap, assignment, [
      arrSlot,
      iSlot,
    ]);
    const instructions = result.functions[0].instructions;

    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeDefined();

    // The slot operand should have the original base address (0x0600)
    // Codegen will use this base with Y-indexed addressing: STA $0600,Y
    const slotOp = storeByte!.operands[0] as SlotOperand;
    expect(slotOp.slot.address).toBe(0x0600);
  });

  it('should handle expression-based value with dynamic index', () => {
    // arr[i] = x + 1;
    // Should: gen i→A, TAY, gen (x+1)→A, STA arr,Y
    const loc = createTestLocation();

    const arrIdent = new IdentifierExpression('arr', loc);
    const indexIdent = new IdentifierExpression('i', loc);
    const target = new IndexExpression(arrIdent, indexIdent, loc);

    // Value is x + 1
    const xRef = new IdentifierExpression('x', loc);
    const one = new LiteralExpression(1, loc);
    const valueBin = new BinaryExpression(xRef, TokenType.PLUS, one, loc);

    const assignment = new AssignmentExpression(
      target,
      TokenType.ASSIGN,
      valueBin,
      loc,
    );

    const arrSlot = createArraySlot('arr', 0x0300, 8);
    const iSlot = createByteSlot('i', 0x0200);
    const xSlot = createByteSlot('x', 0x0210);
    const generator = new ILGenerator(frameMap, symbolTable);
    const result = generateExpressionIL(generator, frameMap, assignment, [
      arrSlot,
      iSlot,
      xSlot,
    ]);
    const instructions = result.functions[0].instructions;

    // Should have TRANSFER_AY (for index) and ADD_IMM (for x+1)
    const transferAY = instructions.find(
      i => i.opcode === ILOpcode.TRANSFER_AY,
    );
    expect(transferAY).toBeDefined();

    const addImm = instructions.find(i => i.opcode === ILOpcode.ADD_IMM);
    expect(addImm).toBeDefined();

    // Should have Y-indexed STORE_BYTE
    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeDefined();

    const slotOp = storeByte!.operands[0] as SlotOperand & {
      indexedByY?: boolean;
    };
    expect(slotOp.indexedByY).toBe(true);
  });
});

// ============================================================================
// Array Read Tests (complementary — ensure load paths still work)
// ============================================================================

describe('ILGenerator - Array Read (Index Expression)', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should emit LOAD_BYTE at base+offset for static index read', () => {
    // arr[2] (read)
    const loc = createTestLocation();

    const arrIdent = new IdentifierExpression('arr', loc);
    const indexExpr = new LiteralExpression(2, loc);
    const indexRead = new IndexExpression(arrIdent, indexExpr, loc);

    const arrSlot = createArraySlot('arr', 0x0300, 8);
    const generator = new ILGenerator(frameMap, symbolTable);
    const result = generateExpressionIL(generator, frameMap, indexRead, [
      arrSlot,
    ]);
    const instructions = result.functions[0].instructions;

    const loadByte = instructions.find(i => i.opcode === ILOpcode.LOAD_BYTE);
    expect(loadByte).toBeDefined();

    const slotOp = loadByte!.operands[0] as SlotOperand;
    expect(slotOp.slot.address).toBe(0x0302);
    expect(slotOp.slot.isArrayElement).toBe(true);
  });

  it('should emit TRANSFER_AY and Y-indexed LOAD_BYTE for dynamic index read', () => {
    // arr[i] (read)
    // IL sequence: LOAD_BYTE (i), TRANSFER_AY, LOAD_BYTE (arr[Y])
    // The SECOND LOAD_BYTE is the Y-indexed array read
    const loc = createTestLocation();

    const arrIdent = new IdentifierExpression('arr', loc);
    const indexIdent = new IdentifierExpression('i', loc);
    const indexRead = new IndexExpression(arrIdent, indexIdent, loc);

    const arrSlot = createArraySlot('arr', 0x0300, 8);
    const iSlot = createByteSlot('i', 0x0200);
    const generator = new ILGenerator(frameMap, symbolTable);
    const result = generateExpressionIL(generator, frameMap, indexRead, [
      arrSlot,
      iSlot,
    ]);
    const instructions = result.functions[0].instructions;

    // Should have TAY
    const transferAY = instructions.find(
      i => i.opcode === ILOpcode.TRANSFER_AY,
    );
    expect(transferAY).toBeDefined();

    // Find the Y-indexed LOAD_BYTE (the second one — after TRANSFER_AY)
    // The first LOAD_BYTE loads the index variable `i`
    const loadBytes = instructions.filter(i => i.opcode === ILOpcode.LOAD_BYTE);
    expect(loadBytes.length).toBeGreaterThanOrEqual(2);

    // The last LOAD_BYTE should be the indexed array access
    const indexedLoad = loadBytes[loadBytes.length - 1];
    const slotOp = indexedLoad.operands[0] as SlotOperand & {
      indexedByY?: boolean;
    };
    expect(slotOp.indexedByY).toBe(true);
    expect(slotOp.slot.address).toBe(0x0300);
  });
});
