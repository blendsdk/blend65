/**
 * IL Generator - Function Calls and Intrinsics Tests
 *
 * Tests for Phase 7c: Advanced Features
 * - Function calls with parameters
 * - Register parameter passing
 * - Return value handling
 * - Intrinsics (peek, poke, hi, lo)
 *
 * @module __tests__/il/generator-functions
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
  CallExpression,
} from '../../ast/expressions.js';
import { FunctionDecl, VariableDecl, Parameter } from '../../ast/declarations.js';
import { ExpressionStatement, ReturnStatement } from '../../ast/statements.js';
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
// Function Call Tests
// ============================================================================

describe('ILGenerator - Function Calls', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate CALL for simple function call', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    // Create call expression: helper()
    const callee = new IdentifierExpression('helper', loc);
    const callExpr = new CallExpression(callee, [], loc);

    frameMap.set('testFunc', createTestFrame('testFunc', []));
    frameMap.set('helper', createTestFrame('helper', []));

    const stmt = new ExpressionStatement(callExpr, loc);
    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const helperDecl = new FunctionDecl(
      'helper',
      [],
      'void',
      [],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl, helperDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const callInstr = instructions.find(i => i.opcode === ILOpcode.CALL);
    expect(callInstr).toBeDefined();
  });

  it('should generate instructions for call with literal arguments', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    // Create call expression: helper(42)
    const callee = new IdentifierExpression('helper', loc);
    const arg = new LiteralExpression(42, loc);
    const callExpr = new CallExpression(callee, [arg], loc);

    frameMap.set('testFunc', createTestFrame('testFunc', []));
    frameMap.set('helper', createTestFrame('helper', []));

    const stmt = new ExpressionStatement(callExpr, loc);
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
    
    // Should have CALL instruction
    const callInstr = instructions.find(i => i.opcode === ILOpcode.CALL);
    expect(callInstr).toBeDefined();
  });

  it('should generate RETURN for void function', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    frameMap.set('testFunc', createTestFrame('testFunc', []));

    const funcDecl = new FunctionDecl(
      'testFunc',
      [],
      'void',
      [],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    const returnInstr = instructions.find(i => i.opcode === ILOpcode.RETURN);
    expect(returnInstr).toBeDefined();
  });

  it('should generate RETURN with value for non-void function', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    const returnValue = new LiteralExpression(42, loc);
    const returnStmt = new ReturnStatement(returnValue, loc);

    frameMap.set('getValue', createTestFrame('getValue', []));

    const funcDecl = new FunctionDecl(
      'getValue',
      [],
      'byte',
      [returnStmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    
    // Should have LOAD_IMM for return value
    const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
    expect(loadImm).toBeDefined();
    
    // Should have RETURN instruction
    const returnInstr = instructions.find(i => i.opcode === ILOpcode.RETURN);
    expect(returnInstr).toBeDefined();
  });

  it('should generate IL for function with register parameters', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    // Function body: just return the parameter
    const xIdent = new IdentifierExpression('x', loc);
    const returnStmt = new ReturnStatement(xIdent, loc);

    // Create frame with register parameter
    const xSlot = createRegisterSlot('x', 'X');
    frameMap.set('getValue', createTestFrame('getValue', [xSlot]));

    // Parameter is just an interface (object literal)
    const param: Parameter = { name: 'x', typeAnnotation: 'byte', location: loc };
    const funcDecl = new FunctionDecl(
      'getValue',
      [param],
      'byte',
      [returnStmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    
    // Should have TRANSFER_XA for register X parameter
    const transferXA = instructions.find(i => i.opcode === ILOpcode.TRANSFER_XA);
    expect(transferXA).toBeDefined();
  });

  it('should generate IL for function with Y register parameter', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    // Function body: return the Y parameter
    const yIdent = new IdentifierExpression('y', loc);
    const returnStmt = new ReturnStatement(yIdent, loc);

    // Create frame with Y register parameter
    const ySlot = createRegisterSlot('y', 'Y');
    frameMap.set('getValue', createTestFrame('getValue', [ySlot]));

    // Parameter is just an interface (object literal)
    const param: Parameter = { name: 'y', typeAnnotation: 'byte', location: loc };
    const funcDecl = new FunctionDecl(
      'getValue',
      [param],
      'byte',
      [returnStmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [funcDecl], loc);

    const result = generator.generate(program);
    const instructions = result.functions[0].instructions;
    
    // Should have TRANSFER_YA for register Y parameter
    const transferYA = instructions.find(i => i.opcode === ILOpcode.TRANSFER_YA);
    expect(transferYA).toBeDefined();
  });

  it('should skip stub functions (no body)', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    frameMap.set('main', createTestFrame('main', []));

    // Create a stub function - constructor params: (name, params, returnType, body, loc, isExported, isCallback, isStub)
    const stubDecl = new FunctionDecl(
      'kernalCall',
      [],
      'void',
      null,  // No body - stub
      loc,
      false,  // isExported
      false,  // isCallback
      true    // isStub = true
    );
    const mainDecl = new FunctionDecl(
      'main',
      [],
      'void',
      [],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [stubDecl, mainDecl], loc);

    const result = generator.generate(program);
    
    // Should only have main function, not the stub
    expect(result.functions.length).toBe(1);
    expect(result.functions[0].name).toBe('main');
  });
});

// ============================================================================
// Intrinsic Tests
// ============================================================================

describe('ILGenerator - Intrinsics', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  describe('peek intrinsic', () => {
    it('should generate PEEK for peek(address)', () => {
      const generator = new ILGenerator(frameMap, symbolTable);
      const loc = createTestLocation();

      // Create call: peek($D020)
      const callee = new IdentifierExpression('peek', loc);
      const addr = new LiteralExpression(0xd020, loc);
      const callExpr = new CallExpression(callee, [addr], loc);

      frameMap.set('testFunc', createTestFrame('testFunc', []));

      const stmt = new ExpressionStatement(callExpr, loc);
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
      
      // With constant address resolution, PEEK should have an address operand
      // and no separate LOAD_IMM for the address
      const peek = instructions.find(i => i.opcode === ILOpcode.PEEK);
      expect(peek).toBeDefined();
      // Address should be directly in the PEEK operand
      expect(peek!.operands.length).toBeGreaterThan(0);
      expect(peek!.operands[0].kind).toBe('address');
    });

    it('should generate PEEK with indexed address (CONST + variable)', () => {
      const generator = new ILGenerator(frameMap, symbolTable);
      const loc = createTestLocation();

      // Register a constant BASE_ADDR = $D000 in the symbol table
      const initExpr = new LiteralExpression(0xD000, loc);
      symbolTable.declareConstant('BASE_ADDR', loc, null, initExpr);

      // Create call: peek(BASE_ADDR + offset) — indexed address pattern
      const callee = new IdentifierExpression('peek', loc);
      const baseIdent = new IdentifierExpression('BASE_ADDR', loc);
      const offsetVar = new IdentifierExpression('offset', loc);
      const addrExpr = new BinaryExpression(baseIdent, TokenType.PLUS, offsetVar, loc);
      const callExpr = new CallExpression(callee, [addrExpr], loc);

      const offsetSlot = createByteSlot('offset', 0x0200);
      frameMap.set('testFunc', createTestFrame('testFunc', [offsetSlot]));

      const stmt = new ExpressionStatement(callExpr, loc);
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

      // Should have: LOAD_BYTE (offset), TRANSFER_AX (TAX), PEEK with indexed address
      const loadByte = instructions.find(i => i.opcode === ILOpcode.LOAD_BYTE);
      const transferAX = instructions.find(i => i.opcode === ILOpcode.TRANSFER_AX);
      const peek = instructions.find(i => i.opcode === ILOpcode.PEEK);
      expect(loadByte).toBeDefined();
      expect(transferAX).toBeDefined();
      expect(peek).toBeDefined();

      // The PEEK should have an indexed address operand with base $D000
      if (peek) {
        const addrOp = peek.operands[0];
        expect(addrOp.kind).toBe('address');
        if (addrOp.kind === 'address') {
          expect(addrOp.address).toBe(0xD000);
          expect(addrOp.indexRegister).toBe('X');
        }
      }
    });
  });

  describe('poke intrinsic', () => {
    it('should generate POKE for poke(address, value)', () => {
      const generator = new ILGenerator(frameMap, symbolTable);
      const loc = createTestLocation();

      // Create call: poke($D020, 1)
      const callee = new IdentifierExpression('poke', loc);
      const addr = new LiteralExpression(0xd020, loc);
      const value = new LiteralExpression(1, loc);
      const callExpr = new CallExpression(callee, [addr, value], loc);

      frameMap.set('testFunc', createTestFrame('testFunc', []));

      const stmt = new ExpressionStatement(callExpr, loc);
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
      
      // Should have POKE instruction
      const poke = instructions.find(i => i.opcode === ILOpcode.POKE);
      expect(poke).toBeDefined();
    });

    it('should include address operand on POKE for constant address', () => {
      const generator = new ILGenerator(frameMap, symbolTable);
      const loc = createTestLocation();

      // Create call: poke($D020, 5)
      const callee = new IdentifierExpression('poke', loc);
      const addr = new LiteralExpression(0xd020, loc);
      const value = new LiteralExpression(5, loc);
      const callExpr = new CallExpression(callee, [addr, value], loc);

      frameMap.set('testFunc', createTestFrame('testFunc', []));

      const stmt = new ExpressionStatement(callExpr, loc);
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

      // With constant address resolution, POKE has the address as operand
      // No PUSH_A needed for constant addresses
      const poke = instructions.find(i => i.opcode === ILOpcode.POKE);
      expect(poke).toBeDefined();
      expect(poke!.operands.length).toBeGreaterThan(0);
      expect(poke!.operands[0].kind).toBe('address');
    });
  });

  describe('peekw intrinsic', () => {
    it('should generate PEEKW for peekw(address)', () => {
      const generator = new ILGenerator(frameMap, symbolTable);
      const loc = createTestLocation();

      // Create call: peekw($00FB)
      const callee = new IdentifierExpression('peekw', loc);
      const addr = new LiteralExpression(0x00fb, loc);
      const callExpr = new CallExpression(callee, [addr], loc);

      frameMap.set('testFunc', createTestFrame('testFunc', []));

      const stmt = new ExpressionStatement(callExpr, loc);
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
      
      const peekw = instructions.find(i => i.opcode === ILOpcode.PEEKW);
      expect(peekw).toBeDefined();
    });
  });

  describe('pokew intrinsic', () => {
    it('should generate POKEW for pokew(address, value)', () => {
      const generator = new ILGenerator(frameMap, symbolTable);
      const loc = createTestLocation();

      // Create call: pokew($00FB, $0400)
      const callee = new IdentifierExpression('pokew', loc);
      const addr = new LiteralExpression(0x00fb, loc);
      const value = new LiteralExpression(0x0400, loc);
      const callExpr = new CallExpression(callee, [addr, value], loc);

      frameMap.set('testFunc', createTestFrame('testFunc', []));

      const stmt = new ExpressionStatement(callExpr, loc);
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
      
      const pokew = instructions.find(i => i.opcode === ILOpcode.POKEW);
      expect(pokew).toBeDefined();
    });
  });

  describe('hi intrinsic', () => {
    it('should generate HI for hi(value)', () => {
      const generator = new ILGenerator(frameMap, symbolTable);
      const loc = createTestLocation();

      // Create call: hi($1234)
      const callee = new IdentifierExpression('hi', loc);
      const value = new LiteralExpression(0x1234, loc);
      const callExpr = new CallExpression(callee, [value], loc);

      frameMap.set('testFunc', createTestFrame('testFunc', []));

      const stmt = new ExpressionStatement(callExpr, loc);
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
      
      const hi = instructions.find(i => i.opcode === ILOpcode.HI);
      expect(hi).toBeDefined();
    });
  });

  describe('lo intrinsic', () => {
    it('should generate LO for lo(value)', () => {
      const generator = new ILGenerator(frameMap, symbolTable);
      const loc = createTestLocation();

      // Create call: lo($1234)
      const callee = new IdentifierExpression('lo', loc);
      const value = new LiteralExpression(0x1234, loc);
      const callExpr = new CallExpression(callee, [value], loc);

      frameMap.set('testFunc', createTestFrame('testFunc', []));

      const stmt = new ExpressionStatement(callExpr, loc);
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
      
      const lo = instructions.find(i => i.opcode === ILOpcode.LO);
      expect(lo).toBeDefined();
    });

    it('should generate LO with variable argument', () => {
      const generator = new ILGenerator(frameMap, symbolTable);
      const loc = createTestLocation();

      // Create call: lo(address)
      const callee = new IdentifierExpression('lo', loc);
      const addrVar = new IdentifierExpression('address', loc);
      const callExpr = new CallExpression(callee, [addrVar], loc);

      const addrSlot = createByteSlot('address', 0x0200);
      frameMap.set('testFunc', createTestFrame('testFunc', [addrSlot]));

      const stmt = new ExpressionStatement(callExpr, loc);
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
      
      // Should load variable first, then apply LO
      const loadByte = instructions.find(i => i.opcode === ILOpcode.LOAD_BYTE);
      const lo = instructions.find(i => i.opcode === ILOpcode.LO);
      expect(loadByte).toBeDefined();
      expect(lo).toBeDefined();
    });
  });
});

// ============================================================================
// Global Variable Initialization Tests
// ============================================================================

describe('ILGenerator - Global Variables', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should collect global variable initialization separately', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    // Create a global variable with initializer
    const initializer = new LiteralExpression(42, loc);
    const globalVar = new VariableDecl(
      'counter',
      'byte',
      initializer,
      loc,
      false,
      null
    );

    frameMap.set('main', createTestFrame('main', []));

    const mainDecl = new FunctionDecl(
      'main',
      [],
      'void',
      [],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [globalVar, mainDecl], loc);

    const result = generator.generate(program);
    
    // Global init should have instructions
    expect(result.globalInit.length).toBeGreaterThan(0);
  });

  it('should not generate global init for variables without initializer', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    // Create a global variable without initializer
    const globalVar = new VariableDecl(
      'counter',
      'byte',
      null,  // No initializer
      loc,
      false,
      null
    );

    frameMap.set('main', createTestFrame('main', []));

    const mainDecl = new FunctionDecl(
      'main',
      [],
      'void',
      [],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [globalVar, mainDecl], loc);

    const result = generator.generate(program);
    
    // Global init should be empty
    expect(result.globalInit.length).toBe(0);
  });
});

// ============================================================================
// ILProgram Statistics Tests
// ============================================================================

describe('ILGenerator - Program Statistics', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should calculate total instruction count', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    // Create a simple function with some instructions
    const literal = new LiteralExpression(42, loc);
    const stmt = new ExpressionStatement(literal, loc);

    frameMap.set('main', createTestFrame('main', []));

    const mainDecl = new FunctionDecl(
      'main',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [mainDecl], loc);

    const result = generator.generate(program);
    
    // Should have accurate instruction count
    expect(result.instructionCount).toBeGreaterThan(0);
    expect(result.instructionCount).toBe(result.functions[0].instructions.length);
  });

  it('should calculate total estimated cycles', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    const literal = new LiteralExpression(42, loc);
    const stmt = new ExpressionStatement(literal, loc);

    frameMap.set('main', createTestFrame('main', []));

    const mainDecl = new FunctionDecl(
      'main',
      [],
      'void',
      [stmt],
      loc,
      false,
      false
    );
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [mainDecl], loc);

    const result = generator.generate(program);
    
    // Should have cycle estimate
    expect(result.totalEstimatedCycles).toBeGreaterThanOrEqual(0);
  });

  it('should set entry point to main', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    frameMap.set('main', createTestFrame('main', []));
    frameMap.set('helper', createTestFrame('helper', []));

    const helperDecl = new FunctionDecl('helper', [], 'void', [], loc, false, false);
    const mainDecl = new FunctionDecl('main', [], 'void', [], loc, false, false);
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [helperDecl, mainDecl], loc);

    const result = generator.generate(program);
    
    expect(result.entryPoint).toBe('main');
  });

  it('should use first function as entry point if no main', () => {
    const generator = new ILGenerator(frameMap, symbolTable);
    const loc = createTestLocation();

    frameMap.set('start', createTestFrame('start', []));

    const startDecl = new FunctionDecl('start', [], 'void', [], loc, false, false);
    const moduleDecl = new ModuleDecl(['test'], loc, false);
    const program = new Program(moduleDecl, [startDecl], loc);

    const result = generator.generate(program);
    
    expect(result.entryPoint).toBe('start');
  });
});