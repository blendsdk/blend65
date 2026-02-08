/**
 * IL Generator Control Flow Tests
 *
 * Tests for control flow generation in the ILGenerator:
 * - If/else statements
 * - While loops
 * - For loops
 * - Return statements
 * - Break/continue
 *
 * @module __tests__/il/generator-control-flow
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
import { VariableDecl, FunctionDecl } from '../../ast/declarations.js';
import {
  IfStatement,
  WhileStatement,
  ForStatement,
  ReturnStatement,
  ExpressionStatement,
  BreakStatement,
  ContinueStatement,
} from '../../ast/statements.js';
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
 * Create a simple byte slot.
 */
function createByteSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Helper to generate IL for a function with given body statements.
 */
function generateFunctionWithBody(
  frameMap: Map<string, Frame>,
  symbolTable: SymbolTable,
  body: Statement[],
  slots: FrameSlot[] = []
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
    false
  );
  const moduleDecl = new ModuleDecl(['test'], loc, false);
  const program = new Program(moduleDecl, [funcDecl], loc);

  return generator.generate(program);
}

// ============================================================================
// If/Else Statement Tests
// ============================================================================

describe('ILGenerator - If/Else Statements', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate CMP_IMM and JUMP_EQ for simple if', () => {
    const loc = createTestLocation();

    // if (true) { }
    const condition = new LiteralExpression(true, loc);
    const ifStmt = new IfStatement(condition, [], null, loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt]);
    const instructions = result.functions[0].instructions;

    // Should have: LOAD_IMM 1, CMP_IMM 0, JUMP_EQ else_label, LABEL else
    const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
    const cmpImm = instructions.find(i => i.opcode === ILOpcode.CMP_IMM);
    const jumpEq = instructions.find(i => i.opcode === ILOpcode.JUMP_EQ);
    const label = instructions.find(i => i.opcode === ILOpcode.LABEL);

    expect(loadImm).toBeDefined();
    expect(cmpImm).toBeDefined();
    expect(jumpEq).toBeDefined();
    expect(label).toBeDefined();
  });

  it('should generate JUMP to skip else branch', () => {
    const loc = createTestLocation();
    const xSlot = createByteSlot('x', 0x0200);

    // if (true) { x = 1; } else { x = 2; }
    const condition = new LiteralExpression(true, loc);
    const thenAssign = new ExpressionStatement(
      new LiteralExpression(1, loc),
      loc
    );
    const elseAssign = new ExpressionStatement(
      new LiteralExpression(2, loc),
      loc
    );
    const ifStmt = new IfStatement(condition, [thenAssign], [elseAssign], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [xSlot]);
    const instructions = result.functions[0].instructions;

    // Should have JUMP to skip else after then branch
    const jumps = instructions.filter(i => i.opcode === ILOpcode.JUMP);
    expect(jumps.length).toBeGreaterThanOrEqual(1);

    // Should have two labels (else and endif)
    const labels = instructions.filter(i => i.opcode === ILOpcode.LABEL);
    expect(labels.length).toBe(2);
  });

  it('should generate condition expression correctly', () => {
    const loc = createTestLocation();
    const xSlot = createByteSlot('x', 0x0200);

    // if (x == 5) { }
    const xIdent = new IdentifierExpression('x', loc);
    const five = new LiteralExpression(5, loc);
    const condition = new BinaryExpression(xIdent, TokenType.EQUAL, five, loc);
    const ifStmt = new IfStatement(condition, [], null, loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [ifStmt], [xSlot]);
    const instructions = result.functions[0].instructions;

    // Should have LOAD_BYTE for x
    const loadByte = instructions.find(i => i.opcode === ILOpcode.LOAD_BYTE);
    expect(loadByte).toBeDefined();
  });

  it('should generate nested if correctly', () => {
    const loc = createTestLocation();

    // if (true) { if (false) { } }
    const innerIf = new IfStatement(
      new LiteralExpression(false, loc),
      [],
      null,
      loc
    );
    const outerIf = new IfStatement(
      new LiteralExpression(true, loc),
      [innerIf],
      null,
      loc
    );

    const result = generateFunctionWithBody(frameMap, symbolTable, [outerIf]);
    const instructions = result.functions[0].instructions;

    // Should have 4 labels (else for each if)
    const labels = instructions.filter(i => i.opcode === ILOpcode.LABEL);
    expect(labels.length).toBe(2);

    // Should have 2 JUMP_EQ (one for each if)
    const jumpEqs = instructions.filter(i => i.opcode === ILOpcode.JUMP_EQ);
    expect(jumpEqs.length).toBe(2);
  });
});

// ============================================================================
// While Loop Tests
// ============================================================================

describe('ILGenerator - While Loops', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate while loop structure', () => {
    const loc = createTestLocation();

    // while (true) { }
    const condition = new LiteralExpression(true, loc);
    const whileStmt = new WhileStatement(condition, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [whileStmt]);
    const instructions = result.functions[0].instructions;

    // Should have: LABEL header, [condition], CMP_IMM 0, JUMP_EQ exit, JUMP header, LABEL exit
    const labels = instructions.filter(i => i.opcode === ILOpcode.LABEL);
    expect(labels.length).toBe(2); // header and exit

    const jumpEq = instructions.find(i => i.opcode === ILOpcode.JUMP_EQ);
    expect(jumpEq).toBeDefined();

    const jumpUnconditional = instructions.find(
      i => i.opcode === ILOpcode.JUMP && i.comment?.includes('loop back')
    );
    expect(jumpUnconditional).toBeDefined();
  });

  it('should record loop info for while loop', () => {
    const loc = createTestLocation();

    const condition = new LiteralExpression(true, loc);
    const whileStmt = new WhileStatement(condition, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [whileStmt]);
    const func = result.functions[0];

    // Should have recorded loop
    expect(func.loops.length).toBe(1);
    expect(func.loops[0].isCountedLoop).toBe(false);
    expect(func.loops[0].depth).toBe(1);
  });

  it('should track nested loop depth', () => {
    const loc = createTestLocation();

    // while (true) { while (true) { } }
    const innerWhile = new WhileStatement(
      new LiteralExpression(true, loc),
      [],
      loc
    );
    const outerWhile = new WhileStatement(
      new LiteralExpression(true, loc),
      [innerWhile],
      loc
    );

    const result = generateFunctionWithBody(frameMap, symbolTable, [outerWhile]);
    const func = result.functions[0];

    // Should have 2 loops
    expect(func.loops.length).toBe(2);

    // Max depth should be 2
    expect(func.maxLoopDepth).toBe(2);
  });
});

// ============================================================================
// For Loop Tests
// ============================================================================

describe('ILGenerator - For Loops', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate for loop with ascending iteration', () => {
    const loc = createTestLocation();
    const iSlot = createByteSlot('i', 0x0200);

    // for (i = 0 to 9) { }
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(9, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Should have STORE_BYTE for initialization
    const storeByte = instructions.find(i => i.opcode === ILOpcode.STORE_BYTE);
    expect(storeByte).toBeDefined();

    // Should have INC_BYTE for increment
    const incByte = instructions.find(i => i.opcode === ILOpcode.INC_BYTE);
    expect(incByte).toBeDefined();

    // Should have CMP_IMM for bound check (end+1 = 10)
    const cmpImm = instructions.find(i => i.opcode === ILOpcode.CMP_IMM);
    expect(cmpImm).toBeDefined();

    // Should have JUMP_GE for exit condition
    const jumpGe = instructions.find(i => i.opcode === ILOpcode.JUMP_GE);
    expect(jumpGe).toBeDefined();
  });

  it('should generate for loop with descending iteration', () => {
    const loc = createTestLocation();
    const iSlot = createByteSlot('i', 0x0200);

    // for (i = 9 downto 0) { }
    const start = new LiteralExpression(9, loc);
    const end = new LiteralExpression(0, loc);
    const forStmt = new ForStatement('i', null, start, end, 'downto', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Should have DEC_BYTE for decrement
    const decByte = instructions.find(i => i.opcode === ILOpcode.DEC_BYTE);
    expect(decByte).toBeDefined();

    // Should have JUMP_LT for exit condition
    const jumpLt = instructions.find(i => i.opcode === ILOpcode.JUMP_LT);
    expect(jumpLt).toBeDefined();
  });

  it('should detect counted loop pattern', () => {
    const loc = createTestLocation();
    const iSlot = createByteSlot('i', 0x0200);

    // for (i = 0 to 9) { } - this is a counted loop
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(9, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const func = result.functions[0];

    expect(func.loops.length).toBe(1);
    expect(func.loops[0].isCountedLoop).toBe(true);
    expect(func.loops[0].boundValue).toBe(9);
    expect(func.loops[0].estimatedIterations).toBe(10); // 0 to 9 = 10 iterations
  });

  it('should generate for loop with custom step', () => {
    const loc = createTestLocation();
    const iSlot = createByteSlot('i', 0x0200);

    // for (i = 0 to 100 step 10) { }
    const start = new LiteralExpression(0, loc);
    const end = new LiteralExpression(100, loc);
    const step = new LiteralExpression(10, loc);
    const forStmt = new ForStatement('i', null, start, end, 'to', step, [], loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Should have ADD_IMM for step (not INC)
    const addImm = instructions.find(i =>
      i.opcode === ILOpcode.ADD_IMM && i.comment?.includes('step')
    );
    expect(addImm).toBeDefined();

    // Estimated iterations should be 11 (0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100)
    const func = result.functions[0];
    expect(func.loops[0].estimatedIterations).toBe(11);
  });
});

// ============================================================================
// Return Statement Tests
// ============================================================================

describe('ILGenerator - Return Statements', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate RETURN for void return', () => {
    const loc = createTestLocation();

    const returnStmt = new ReturnStatement(null, loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [returnStmt]);
    const instructions = result.functions[0].instructions;

    // Should have RETURN instruction
    const returnInstr = instructions.find(i => i.opcode === ILOpcode.RETURN);
    expect(returnInstr).toBeDefined();
  });

  it('should generate expression then RETURN for return with value', () => {
    const loc = createTestLocation();

    // return 42;
    const value = new LiteralExpression(42, loc);
    const returnStmt = new ReturnStatement(value, loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [returnStmt]);
    const instructions = result.functions[0].instructions;

    // Should have LOAD_IMM for 42
    const loadImm = instructions.find(i => i.opcode === ILOpcode.LOAD_IMM);
    expect(loadImm).toBeDefined();

    // Should have RETURN
    const returnInstr = instructions.find(i => i.opcode === ILOpcode.RETURN);
    expect(returnInstr).toBeDefined();

    // LOAD_IMM should come before RETURN
    const loadIndex = instructions.findIndex(i => i.opcode === ILOpcode.LOAD_IMM);
    const returnIndex = instructions.findIndex(i => i.opcode === ILOpcode.RETURN);
    expect(loadIndex).toBeLessThan(returnIndex);
  });

  it('should generate RETURN with variable value', () => {
    const loc = createTestLocation();
    const xSlot = createByteSlot('x', 0x0200);

    // return x;
    const xIdent = new IdentifierExpression('x', loc);
    const returnStmt = new ReturnStatement(xIdent, loc);

    const result = generateFunctionWithBody(frameMap, symbolTable, [returnStmt], [xSlot]);
    const instructions = result.functions[0].instructions;

    // Should have LOAD_BYTE for x
    const loadByte = instructions.find(i => i.opcode === ILOpcode.LOAD_BYTE);
    expect(loadByte).toBeDefined();

    // Should have RETURN
    const returnInstr = instructions.find(i => i.opcode === ILOpcode.RETURN);
    expect(returnInstr).toBeDefined();
  });
});

// ============================================================================
// Break/Continue Tests
// ============================================================================

describe('ILGenerator - Break/Continue', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should generate JUMP to exit label for break in while', () => {
    const loc = createTestLocation();

    // while (true) { break; }
    const breakStmt = new BreakStatement(loc);
    const whileStmt = new WhileStatement(
      new LiteralExpression(true, loc),
      [breakStmt],
      loc
    );

    const result = generateFunctionWithBody(frameMap, symbolTable, [whileStmt]);
    const instructions = result.functions[0].instructions;

    // Should have JUMP with 'break' comment
    const breakJump = instructions.find(
      i => i.opcode === ILOpcode.JUMP && i.comment?.includes('break')
    );
    expect(breakJump).toBeDefined();
  });

  it('should generate JUMP to header label for continue in while', () => {
    const loc = createTestLocation();

    // while (true) { continue; }
    const continueStmt = new ContinueStatement(loc);
    const whileStmt = new WhileStatement(
      new LiteralExpression(true, loc),
      [continueStmt],
      loc
    );

    const result = generateFunctionWithBody(frameMap, symbolTable, [whileStmt]);
    const instructions = result.functions[0].instructions;

    // Should have JUMP with 'continue' comment
    const continueJump = instructions.find(
      i => i.opcode === ILOpcode.JUMP && i.comment?.includes('continue')
    );
    expect(continueJump).toBeDefined();
  });

  it('should generate correct break for nested loops', () => {
    const loc = createTestLocation();
    const iSlot = createByteSlot('i', 0x0200);

    // while (true) { for (i = 0 to 9) { break; } }
    const breakStmt = new BreakStatement(loc);
    const forStmt = new ForStatement(
      'i',
      null,
      new LiteralExpression(0, loc),
      new LiteralExpression(9, loc),
      'to',
      null,
      [breakStmt],
      loc
    );
    const whileStmt = new WhileStatement(
      new LiteralExpression(true, loc),
      [forStmt],
      loc
    );

    const result = generateFunctionWithBody(frameMap, symbolTable, [whileStmt], [iSlot]);
    const instructions = result.functions[0].instructions;

    // Break should jump to for loop's exit, not while loop's exit
    const breakJumps = instructions.filter(
      i => i.opcode === ILOpcode.JUMP && i.comment?.includes('break')
    );
    expect(breakJumps.length).toBe(1);

    // Should have 4 labels: while header, while exit, for header, for exit
    const labels = instructions.filter(i => i.opcode === ILOpcode.LABEL);
    expect(labels.length).toBe(4);

    // The function should record 2 loops
    const func = result.functions[0];
    expect(func.loops.length).toBe(2);
  });
});

// ============================================================================
// Combined Control Flow Tests
// ============================================================================

describe('ILGenerator - Combined Control Flow', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  it('should handle if inside while correctly', () => {
    const loc = createTestLocation();
    const xSlot = createByteSlot('x', 0x0200);

    // while (true) { if (x == 0) { break; } }
    const breakStmt = new BreakStatement(loc);
    const condition = new BinaryExpression(
      new IdentifierExpression('x', loc),
      TokenType.EQUAL,
      new LiteralExpression(0, loc),
      loc
    );
    const ifStmt = new IfStatement(condition, [breakStmt], null, loc);
    const whileStmt = new WhileStatement(
      new LiteralExpression(true, loc),
      [ifStmt],
      loc
    );

    const result = generateFunctionWithBody(frameMap, symbolTable, [whileStmt], [xSlot]);
    const instructions = result.functions[0].instructions;

    // Should have labels for while and if
    const labels = instructions.filter(i => i.opcode === ILOpcode.LABEL);
    expect(labels.length).toBeGreaterThanOrEqual(3); // while_header, while_exit, if_else

    // Should have break jump
    const breakJump = instructions.find(
      i => i.opcode === ILOpcode.JUMP && i.comment?.includes('break')
    );
    expect(breakJump).toBeDefined();
  });

  it('should handle early return in loop', () => {
    const loc = createTestLocation();
    const xSlot = createByteSlot('x', 0x0200);

    // while (true) { if (x == 0) { return; } }
    const returnStmt = new ReturnStatement(null, loc);
    const condition = new BinaryExpression(
      new IdentifierExpression('x', loc),
      TokenType.EQUAL,
      new LiteralExpression(0, loc),
      loc
    );
    const ifStmt = new IfStatement(condition, [returnStmt], null, loc);
    const whileStmt = new WhileStatement(
      new LiteralExpression(true, loc),
      [ifStmt],
      loc
    );

    const result = generateFunctionWithBody(frameMap, symbolTable, [whileStmt], [xSlot]);
    const instructions = result.functions[0].instructions;

    // Should have RETURN instruction inside the if
    const returnInstr = instructions.find(i => i.opcode === ILOpcode.RETURN);
    expect(returnInstr).toBeDefined();
  });

  it('should handle for inside for correctly', () => {
    const loc = createTestLocation();
    const iSlot = createByteSlot('i', 0x0200);
    const jSlot = createByteSlot('j', 0x0201);

    // for (i = 0 to 3) { for (j = 0 to 3) { } }
    const innerFor = new ForStatement(
      'j',
      null,
      new LiteralExpression(0, loc),
      new LiteralExpression(3, loc),
      'to',
      null,
      [],
      loc
    );
    const outerFor = new ForStatement(
      'i',
      null,
      new LiteralExpression(0, loc),
      new LiteralExpression(3, loc),
      'to',
      null,
      [innerFor],
      loc
    );

    const result = generateFunctionWithBody(
      frameMap,
      symbolTable,
      [outerFor],
      [iSlot, jSlot]
    );
    const func = result.functions[0];

    // Should have 2 loops
    expect(func.loops.length).toBe(2);

    // Both should be counted loops
    expect(func.loops[0].isCountedLoop).toBe(true);
    expect(func.loops[1].isCountedLoop).toBe(true);

    // Max depth should be 2
    expect(func.maxLoopDepth).toBe(2);
  });
});