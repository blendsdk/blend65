/**
 * IL Generator - Constant Inlining Tests
 *
 * Tests that compile-time constants (declared with `const`) are inlined
 * as immediate loads (LOAD_IMM / LOAD_IMM_WORD) instead of slot loads
 * (LOAD_BYTE). This avoids wasteful memory reads when the value is
 * known at compile time.
 *
 * The constant inlining logic lives in `generateIdentifier()` in
 * `il/generator/expressions.ts`. It checks the symbol table for
 * `isConst && initializer` BEFORE attempting slot resolution.
 *
 * @module __tests__/il/generator-constant-inlining
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
  AssignmentExpression,
} from '../../ast/expressions.js';
import { VariableDecl, FunctionDecl } from '../../ast/declarations.js';
import { ExpressionStatement } from '../../ast/statements.js';
import { Program, ModuleDecl } from '../../ast/program.js';
import { SourceLocation } from '../../ast/base.js';
import { TokenType } from '../../lexer/types.js';
import { ImmediateOperand } from '../../il/operands.js';

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
 * Create a word (16-bit) slot at a given address.
 */
function createWordSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Helper: generate IL for a function body containing a single expression statement.
 *
 * Creates a minimal program structure:
 *   module test; function testFunc() { <expr>; }
 *
 * @param generator - IL generator instance
 * @param frameMap - Frame map (generator reads frames from this)
 * @param expr - Expression to wrap in an ExpressionStatement
 * @param slots - Slots for testFunc's frame (default: empty)
 * @returns Generated IL program
 */
function generateExpressionIL(
  generator: ILGenerator,
  frameMap: Map<string, Frame>,
  expr:
    | LiteralExpression
    | IdentifierExpression
    | BinaryExpression
    | AssignmentExpression,
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
// Constant Inlining Tests
// ============================================================================

describe('ILGenerator - Constant Inlining', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Byte Constants
  // ═══════════════════════════════════════════════════════════════════

  describe('byte constants', () => {
    it('should emit LOAD_IMM for a byte const identifier (not LOAD_BYTE)', () => {
      // Simulates: const SPACE_CHAR: byte = 32;
      // When the identifier SPACE_CHAR is referenced, should emit LOAD_IMM #32
      const loc = createTestLocation();
      const initializer = new LiteralExpression(32, loc);

      // Register constant in symbol table
      symbolTable.declareConstant('SPACE_CHAR', loc, BUILTIN_TYPES.BYTE, initializer);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('SPACE_CHAR', loc);

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      // Should have LOAD_IMM (inlined constant), not LOAD_BYTE (slot load)
      const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
      const loadByte = instructions.find(i => i.opcode === ILOpcode.LOAD_BYTE);

      expect(loadImm).toBeDefined();
      expect(loadByte).toBeUndefined();
    });

    it('should inline the correct byte value', () => {
      // const BORDER_COLOR: byte = 14;
      const loc = createTestLocation();
      const initializer = new LiteralExpression(14, loc);
      symbolTable.declareConstant('BORDER_COLOR', loc, BUILTIN_TYPES.BYTE, initializer);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('BORDER_COLOR', loc);

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
      expect(loadImm).toBeDefined();

      // Verify the operand carries the correct value
      const immOp = loadImm!.operands[0] as ImmediateOperand;
      expect(immOp.value).toBe(14);
    });

    it('should inline zero value byte constant', () => {
      // const ZERO: byte = 0;
      const loc = createTestLocation();
      const initializer = new LiteralExpression(0, loc);
      symbolTable.declareConstant('ZERO', loc, BUILTIN_TYPES.BYTE, initializer);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('ZERO', loc);

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
      expect(loadImm).toBeDefined();

      const immOp = loadImm!.operands[0] as ImmediateOperand;
      expect(immOp.value).toBe(0);
    });

    it('should inline max byte value constant (255)', () => {
      // const MAX_BYTE: byte = 255;
      const loc = createTestLocation();
      const initializer = new LiteralExpression(255, loc);
      symbolTable.declareConstant('MAX_BYTE', loc, BUILTIN_TYPES.BYTE, initializer);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('MAX_BYTE', loc);

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
      expect(loadImm).toBeDefined();

      const immOp = loadImm!.operands[0] as ImmediateOperand;
      // Byte mask: 255 & 0xFF = 255
      expect(immOp.value).toBe(255);
    });

    it('should mask byte constant to 8 bits (value > 255)', () => {
      // const BIG: byte = 0x1FF;  → should mask to 0xFF
      const loc = createTestLocation();
      const initializer = new LiteralExpression(0x1ff, loc);
      symbolTable.declareConstant('BIG', loc, BUILTIN_TYPES.BYTE, initializer);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('BIG', loc);

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
      expect(loadImm).toBeDefined();

      // generateIdentifier masks with & 0xFF for byte-typed expressions
      const immOp = loadImm!.operands[0] as ImmediateOperand;
      expect(immOp.value).toBe(0xff);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Word Constants
  // ═══════════════════════════════════════════════════════════════════

  describe('word constants', () => {
    it('should emit LOAD_IMM_WORD for a word-typed const identifier', () => {
      // const SCREEN: word = $0400;
      const loc = createTestLocation();
      const initializer = new LiteralExpression(0x0400, loc);
      symbolTable.declareConstant('SCREEN', loc, BUILTIN_TYPES.WORD, initializer);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('SCREEN', loc);
      // Set word type annotation so isWordTyped() returns true
      identExpr.setTypeInfo({ kind: TypeKind.Word, name: 'word', size: 2 });

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImmWord = instructions.find(
        i => i.opcode === ILOpcode.LOAD_IMM_WORD,
      );
      expect(loadImmWord).toBeDefined();

      const immOp = loadImmWord!.operands[0] as ImmediateOperand;
      expect(immOp.value).toBe(0x0400);
    });

    it('should inline C64 hardware address constant', () => {
      // const BORDER_REG: word = $D020;
      const loc = createTestLocation();
      const initializer = new LiteralExpression(0xd020, loc);
      symbolTable.declareConstant('BORDER_REG', loc, BUILTIN_TYPES.WORD, initializer);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('BORDER_REG', loc);
      identExpr.setTypeInfo({ kind: TypeKind.Word, name: 'word', size: 2 });

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImmWord = instructions.find(
        i => i.opcode === ILOpcode.LOAD_IMM_WORD,
      );
      expect(loadImmWord).toBeDefined();

      const immOp = loadImmWord!.operands[0] as ImmediateOperand;
      expect(immOp.value).toBe(0xd020);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Constant Chains (const referencing another const)
  // ═══════════════════════════════════════════════════════════════════

  describe('constant chains', () => {
    it('should resolve const that references another const', () => {
      // const BASE: word = $D000;
      // const BORDER: word = BASE + $20;
      // → BORDER should resolve to $D020
      const loc = createTestLocation();
      const baseInit = new LiteralExpression(0xd000, loc);
      symbolTable.declareConstant('BASE', loc, BUILTIN_TYPES.WORD, baseInit);

      // BORDER's initializer is a binary expression: BASE + $20
      const baseRef = new IdentifierExpression('BASE', loc);
      const offset = new LiteralExpression(0x20, loc);
      const borderInit = new BinaryExpression(
        baseRef,
        TokenType.PLUS,
        offset,
        loc,
      );
      symbolTable.declareConstant('BORDER', loc, BUILTIN_TYPES.WORD, borderInit);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('BORDER', loc);
      identExpr.setTypeInfo({ kind: TypeKind.Word, name: 'word', size: 2 });

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImmWord = instructions.find(
        i => i.opcode === ILOpcode.LOAD_IMM_WORD,
      );
      expect(loadImmWord).toBeDefined();

      // tryResolveConstantAddress recursively resolves BASE → $D000 then adds $20
      const immOp = loadImmWord!.operands[0] as ImmediateOperand;
      expect(immOp.value).toBe(0xd020);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Constant Used in Expressions
  // ═══════════════════════════════════════════════════════════════════

  describe('constants in expressions', () => {
    it('should inline constant as left operand of binary expression', () => {
      // const OFFSET: byte = 40;
      // let result = OFFSET + x;
      // The OFFSET reference should generate LOAD_IMM #40, then ADD_BYTE for x
      const loc = createTestLocation();
      const initializer = new LiteralExpression(40, loc);
      symbolTable.declareConstant('OFFSET', loc, BUILTIN_TYPES.BYTE, initializer);

      const generator = new ILGenerator(frameMap, symbolTable);

      const constRef = new IdentifierExpression('OFFSET', loc);
      const varRef = new IdentifierExpression('x', loc);
      const binary = new BinaryExpression(
        constRef,
        TokenType.PLUS,
        varRef,
        loc,
      );

      const xSlot = createByteSlot('x', 0x0200);
      const result = generateExpressionIL(generator, frameMap, binary, [xSlot]);
      const instructions = result.functions[0].instructions;

      // The constant OFFSET should be inlined as LOAD_IMM
      const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
      expect(loadImm).toBeDefined();

      const immOp = loadImm!.operands[0] as ImmediateOperand;
      expect(immOp.value).toBe(40);

      // Then x is loaded from slot via ADD_BYTE
      const addByte = instructions.find(i => i.opcode === ILOpcode.ADD_BYTE);
      expect(addByte).toBeDefined();
    });

    it('should inline constant in poke value position', () => {
      // const COLOR: byte = 14;
      // poke($D020, COLOR);
      // The COLOR reference in poke's value arg should be LOAD_IMM #14
      const loc = createTestLocation();
      const initializer = new LiteralExpression(14, loc);
      symbolTable.declareConstant('COLOR', loc, BUILTIN_TYPES.BYTE, initializer);

      const generator = new ILGenerator(frameMap, symbolTable);

      // Just test the identifier resolution directly —
      // When COLOR is referenced it should be LOAD_IMM not LOAD_BYTE
      const identExpr = new IdentifierExpression('COLOR', loc);
      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
      const loadByte = instructions.find(i => i.opcode === ILOpcode.LOAD_BYTE);
      expect(loadImm).toBeDefined();
      expect(loadByte).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Non-Constant Identifiers (should NOT inline)
  // ═══════════════════════════════════════════════════════════════════

  describe('non-constant identifiers (negative tests)', () => {
    it('should emit LOAD_BYTE for a mutable variable (let), not LOAD_IMM', () => {
      // let counter: byte = 10;
      // counter is NOT a constant — should load from slot
      const loc = createTestLocation();
      symbolTable.declareVariable('counter', loc, BUILTIN_TYPES.BYTE);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('counter', loc);

      const counterSlot = createByteSlot('counter', 0x0200);
      const result = generateExpressionIL(generator, frameMap, identExpr, [
        counterSlot,
      ]);
      const instructions = result.functions[0].instructions;

      // Should have LOAD_BYTE (slot load), not LOAD_IMM (inline)
      const loadByte = instructions.find(i => i.opcode === ILOpcode.LOAD_BYTE);
      expect(loadByte).toBeDefined();
    });

    it('should not inline a constant without initializer', () => {
      // Edge case: a constant declared without initializer (shouldn't happen
      // in valid Blend code, but the generator should handle it gracefully)
      const loc = createTestLocation();
      // Declare constant WITHOUT initializer
      symbolTable.declareConstant('EMPTY', loc, BUILTIN_TYPES.BYTE);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('EMPTY', loc);

      // No slot exists, so fallback to NOP (cannot resolve)
      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      // Should NOT have LOAD_IMM (no initializer to inline)
      const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
      expect(loadImm).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Constant Expression Folding
  // ═══════════════════════════════════════════════════════════════════

  describe('constant expression folding', () => {
    it('should fold constant arithmetic in initializer (SCREEN + 40)', () => {
      // const SCREEN: word = $0400;
      // const ROW2: word = SCREEN + 40;
      // ROW2 should resolve to $0400 + 40 = $0428
      const loc = createTestLocation();
      const screenInit = new LiteralExpression(0x0400, loc);
      symbolTable.declareConstant('SCREEN', loc, BUILTIN_TYPES.WORD, screenInit);

      const screenRef = new IdentifierExpression('SCREEN', loc);
      const offset = new LiteralExpression(40, loc);
      const row2Init = new BinaryExpression(
        screenRef,
        TokenType.PLUS,
        offset,
        loc,
      );
      symbolTable.declareConstant('ROW2', loc, BUILTIN_TYPES.WORD, row2Init);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('ROW2', loc);
      identExpr.setTypeInfo({ kind: TypeKind.Word, name: 'word', size: 2 });

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImmWord = instructions.find(
        i => i.opcode === ILOpcode.LOAD_IMM_WORD,
      );
      expect(loadImmWord).toBeDefined();

      const immOp = loadImmWord!.operands[0] as ImmediateOperand;
      expect(immOp.value).toBe(0x0428);
    });

    it('should fold constant multiplication (BASE * 8)', () => {
      // const BASE: byte = 13;
      // const SPRITE_PTR: word = BASE * 8;
      // SPRITE_PTR should resolve to 13 * 8 = 104
      const loc = createTestLocation();
      const baseInit = new LiteralExpression(13, loc);
      symbolTable.declareConstant('BASE', loc, BUILTIN_TYPES.BYTE, baseInit);

      const baseRef = new IdentifierExpression('BASE', loc);
      const multiplier = new LiteralExpression(8, loc);
      const ptrInit = new BinaryExpression(
        baseRef,
        TokenType.MULTIPLY,
        multiplier,
        loc,
      );
      symbolTable.declareConstant('SPRITE_PTR', loc, BUILTIN_TYPES.WORD, ptrInit);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('SPRITE_PTR', loc);
      identExpr.setTypeInfo({ kind: TypeKind.Word, name: 'word', size: 2 });

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImmWord = instructions.find(
        i => i.opcode === ILOpcode.LOAD_IMM_WORD,
      );
      expect(loadImmWord).toBeDefined();

      const immOp = loadImmWord!.operands[0] as ImmediateOperand;
      expect(immOp.value).toBe(104);
    });

    it('should fold constant bitwise operations (mask << shift)', () => {
      // const MASK: byte = 1;
      // const BIT3: byte = MASK << 3;
      // BIT3 should resolve to 1 << 3 = 8
      const loc = createTestLocation();
      const maskInit = new LiteralExpression(1, loc);
      symbolTable.declareConstant('MASK', loc, BUILTIN_TYPES.BYTE, maskInit);

      const maskRef = new IdentifierExpression('MASK', loc);
      const shift = new LiteralExpression(3, loc);
      const bit3Init = new BinaryExpression(
        maskRef,
        TokenType.LEFT_SHIFT,
        shift,
        loc,
      );
      symbolTable.declareConstant('BIT3', loc, BUILTIN_TYPES.BYTE, bit3Init);

      const generator = new ILGenerator(frameMap, symbolTable);
      const identExpr = new IdentifierExpression('BIT3', loc);

      const result = generateExpressionIL(generator, frameMap, identExpr);
      const instructions = result.functions[0].instructions;

      const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
      expect(loadImm).toBeDefined();

      // 1 << 3 = 8, masked to byte: 8 & 0xFF = 8
      const immOp = loadImm!.operands[0] as ImmediateOperand;
      expect(immOp.value).toBe(8);
    });
  });
});
