/**
 * IL Generator Tests
 *
 * Tests for the ILGenerator class that converts AST to IL instructions.
 *
 * @module __tests__/il/generator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILGenerator } from '../../il/generator/index.js';
import { ILOpcode } from '../../il/enums.js';
import { ILBuilder } from '../../il/builder/index.js';
import { Frame, createFrame } from '../../frame/allocator/frame-calculator.js';
import { FrameSlot, createFrameSlot } from '../../frame/types.js';
import { SlotKind, SlotLocation, ZpDirective } from '../../frame/enums.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import {
  LiteralExpression,
  IdentifierExpression,
  BinaryExpression,
  UnaryExpression,
  AssignmentExpression,
} from '../../ast/expressions.js';
import { VariableDecl, FunctionDecl, FunctionParameter } from '../../ast/declarations.js';
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
 * Create a simple byte slot.
 */
function createByteSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Create a register slot (for register parameters).
 */
function createRegisterSlot(name: string, register: string): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Parameter, BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.Register;
  slot.register = register;
  return slot;
}

// ============================================================================
// ILGeneratorBase Tests
// ============================================================================

describe('ILGeneratorBase', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;
  let generator: ILGenerator;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
    generator = new ILGenerator(frameMap, symbolTable);
  });

  describe('constructor', () => {
    it('should create generator with frame map and symbol table', () => {
      expect(generator).toBeDefined();
    });
  });
});

// ============================================================================
// Literal Expression Tests
// ============================================================================

describe('ILGenerator - Literal Expressions', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  /**
   * Helper to generate IL for a function body with a single expression.
   */
  function generateExpressionTest(
    generator: ILGenerator,
    expr: LiteralExpression | IdentifierExpression | BinaryExpression | UnaryExpression
  ): ReturnType<typeof generator['generate']> {
    const loc = createTestLocation();
    const stmt = new ExpressionStatement(expr, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    // Set up frame for testFunc
    frameMap.set('testFunc', createTestFrame('testFunc', []));

    return generator.generate(program);
  }

  it('should generate LOAD_IMM for numeric literals', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const literal = new LiteralExpression(42, loc);

    const result = generateExpressionTest(generator, literal);

    expect(result.functions.length).toBe(1);
    const instructions = result.functions[0].instructions;
    // Should have LOAD_IMM for 42 and RETURN
    const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
    expect(loadImm).toBeDefined();
  });

  it('should generate LOAD_IMM 1 for true literal', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const literal = new LiteralExpression(true, loc);

    const result = generateExpressionTest(generator, literal);
    const instructions = result.functions[0].instructions;
    const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
    expect(loadImm).toBeDefined();
  });

  it('should generate LOAD_IMM 0 for false literal', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const literal = new LiteralExpression(false, loc);

    const result = generateExpressionTest(generator, literal);
    const instructions = result.functions[0].instructions;
    const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
    expect(loadImm).toBeDefined();
  });
});

// ============================================================================
// Identifier Expression Tests
// ============================================================================

describe('ILGenerator - Identifier Expressions', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate LOAD_BYTE for memory slot identifier', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const ident = new IdentifierExpression('counter', loc);

    // Create frame with counter slot
    const counterSlot = createByteSlot('counter', 0x0200);
    frameMap.set('testFunc', createTestFrame('testFunc', [counterSlot]));

    const stmt = new ExpressionStatement(ident, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const loadByte = instructions.find(i => i.opcode === ILOpcode.LOAD_BYTE);
    expect(loadByte).toBeDefined();
  });

  it('should generate TRANSFER_XA for register X parameter', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const ident = new IdentifierExpression('x', loc);

    // Create frame with register parameter
    const xSlot = createRegisterSlot('x', 'X');
    frameMap.set('testFunc', createTestFrame('testFunc', [xSlot]));

    const stmt = new ExpressionStatement(ident, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const transferXA = instructions.find(i => i.opcode === ILOpcode.TRANSFER_XA);
    expect(transferXA).toBeDefined();
  });

  it('should generate TRANSFER_YA for register Y parameter', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const ident = new IdentifierExpression('y', loc);

    // Create frame with register parameter
    const ySlot = createRegisterSlot('y', 'Y');
    frameMap.set('testFunc', createTestFrame('testFunc', [ySlot]));

    const stmt = new ExpressionStatement(ident, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const transferYA = instructions.find(i => i.opcode === ILOpcode.TRANSFER_YA);
    expect(transferYA).toBeDefined();
  });
});

// ============================================================================
// Binary Expression Tests
// ============================================================================

describe('ILGenerator - Binary Expressions', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate ADD_IMM for addition with immediate', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const left = new LiteralExpression(10, loc);
    const right = new LiteralExpression(5, loc);
    const binary = new BinaryExpression(left, TokenType.PLUS, right, loc);

    // Create frame
    frameMap.set('testFunc', createTestFrame('testFunc', []));

    const stmt = new ExpressionStatement(binary, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const addImm = instructions.find(i => i.opcode === ILOpcode.ADD_IMM);
    expect(addImm).toBeDefined();
  });

  it('should generate SUB_IMM for subtraction with immediate', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const left = new LiteralExpression(10, loc);
    const right = new LiteralExpression(3, loc);
    const binary = new BinaryExpression(left, TokenType.MINUS, right, loc);

    frameMap.set('testFunc', createTestFrame('testFunc', []));

    const stmt = new ExpressionStatement(binary, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const subImm = instructions.find(i => i.opcode === ILOpcode.SUB_IMM);
    expect(subImm).toBeDefined();
  });

  it('should generate ADD_BYTE for addition with slot', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const left = new LiteralExpression(10, loc);
    const right = new IdentifierExpression('y', loc);
    const binary = new BinaryExpression(left, TokenType.PLUS, right, loc);

    const ySlot = createByteSlot('y', 0x0200);
    frameMap.set('testFunc', createTestFrame('testFunc', [ySlot]));

    const stmt = new ExpressionStatement(binary, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const addByte = instructions.find(i => i.opcode === ILOpcode.ADD_BYTE);
    expect(addByte).toBeDefined();
  });

  it('should generate CMP_IMM for comparison with immediate', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const left = new LiteralExpression(10, loc);
    const right = new LiteralExpression(5, loc);
    const binary = new BinaryExpression(left, TokenType.EQUAL, right, loc);

    frameMap.set('testFunc', createTestFrame('testFunc', []));

    const stmt = new ExpressionStatement(binary, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const cmpImm = instructions.find(i => i.opcode === ILOpcode.CMP_IMM);
    expect(cmpImm).toBeDefined();
  });

  it('should generate AND_IMM for bitwise AND with immediate', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const left = new LiteralExpression(0xff, loc);
    const right = new LiteralExpression(0x0f, loc);
    const binary = new BinaryExpression(left, TokenType.BITWISE_AND, right, loc);

    frameMap.set('testFunc', createTestFrame('testFunc', []));

    const stmt = new ExpressionStatement(binary, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const andImm = instructions.find(i => i.opcode === ILOpcode.AND_IMM);
    expect(andImm).toBeDefined();
  });
});

// ============================================================================
// Unary Expression Tests
// ============================================================================

describe('ILGenerator - Unary Expressions', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate XOR_IMM and ADD_IMM for negation', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const operand = new LiteralExpression(42, loc);
    const unary = new UnaryExpression(TokenType.MINUS, operand, loc);

    frameMap.set('testFunc', createTestFrame('testFunc', []));

    const stmt = new ExpressionStatement(unary, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const xorImm = instructions.find(i => i.opcode === ILOpcode.XOR_IMM);
    const addImm = instructions.find(i => i.opcode === ILOpcode.ADD_IMM);
    expect(xorImm).toBeDefined();
    expect(addImm).toBeDefined();
  });

  it('should generate NOT_BYTE for bitwise NOT', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const operand = new LiteralExpression(0xff, loc);
    const unary = new UnaryExpression(TokenType.BITWISE_NOT, operand, loc);

    frameMap.set('testFunc', createTestFrame('testFunc', []));

    const stmt = new ExpressionStatement(unary, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const notByte = instructions.find(i => i.opcode === ILOpcode.NOT_BYTE);
    expect(notByte).toBeDefined();
  });
});

// ============================================================================
// Variable Declaration Tests
// ============================================================================

describe('ILGenerator - Variable Declarations', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate LOAD_IMM and STORE_BYTE for variable with initializer', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const initializer = new LiteralExpression(10, loc);
    const varDecl = new VariableDecl(
      'counter',
      'byte',
      initializer,
      loc,
      false,
      null
    );

    const counterSlot = createByteSlot('counter', 0x0200);
    frameMap.set('testFunc', createTestFrame('testFunc', [counterSlot]));

    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [varDecl],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    
    const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(loadImm).toBeDefined();
    expect(storeByte).toBeDefined();
  });

  it('should not generate store for variable without initializer', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();
    const varDecl = new VariableDecl(
      'counter',
      'byte',
      null,
      loc,
      false,
      null
    );

    const counterSlot = createByteSlot('counter', 0x0200);
    frameMap.set('testFunc', createTestFrame('testFunc', [counterSlot]));

    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [varDecl],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    
    // Should only have RETURN, no STORE_BYTE
    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeUndefined();
  });
});

// ============================================================================
// Program Generation Tests
// ============================================================================

describe('ILGenerator - Program Generation', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate ILProgram with module name', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    frameMap.set('main', createTestFrame('main', []));

    const funcDecl = new FunctionDecl(
      'main',
      [],
      'void',
      [],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['Game', 'Main'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    expect(result.moduleName).toBe('Game.Main');
  });

  it('should identify main as entry point', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    frameMap.set('main', createTestFrame('main', []));
    frameMap.set('helper', createTestFrame('helper', []));

    const mainDecl = new FunctionDecl('main', [], 'void', [], loc, false, false);
    const helperDecl = new FunctionDecl('helper', [], 'void', [], loc, false, false);
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [helperDecl, mainDecl], loc);

    const result = generator.generate(program);
    expect(result.entryPoint).toBe('main');
  });

  it('should count total instructions', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    frameMap.set('main', createTestFrame('main', []));

    const mainDecl = new FunctionDecl('main', [], 'void', [], loc, false, false);
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [mainDecl], loc);

    const result = generator.generate(program);
    // At minimum should have RETURN instruction
    expect(result.instructionCount).toBeGreaterThanOrEqual(1);
  });

  it('should generate multiple functions', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    // Add frames for both functions
    frameMap.set('main', createTestFrame('main', []));
    frameMap.set('helper', createTestFrame('helper', []));
    
    // Two regular functions with bodies
    const helperDecl = new FunctionDecl('helper', [], 'void', [], loc, false, false);
    const mainDecl = new FunctionDecl('main', [], 'void', [], loc, false, false);
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [helperDecl, mainDecl], loc);

    const result = generator.generate(program);
    // Should have both functions
    expect(result.functions.length).toBe(2);
    expect(result.functions.map(f => f.name)).toContain('main');
    expect(result.functions.map(f => f.name)).toContain('helper');
  });
});