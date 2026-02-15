/**
 * IL Generator - Byte 255 For-Loop Overflow Tests
 *
 * Tests for the post-body exit pattern when a byte counter ascends to 255.
 * The normal pattern uses CMP #(end+1), but CMP #256 overflows an 8-bit
 * immediate operand. The fix uses a post-body exit check instead.
 *
 * @module __tests__/il/generator-byte255-for-loop
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILGenerator } from '../../il/generator/index.js';
import { ILOpcode } from '../../il/enums.js';
import { Frame, createFrame } from '../../frame/allocator/frame-calculator.js';
import { FrameSlot, createFrameSlot } from '../../frame/types.js';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import { LiteralExpression } from '../../ast/expressions.js';
import { FunctionDecl } from '../../ast/declarations.js';
import { ForStatement } from '../../ast/statements.js';
import { Program, ModuleDecl } from '../../ast/program.js';
import { SourceLocation, Statement } from '../../ast/base.js';
import { ILInstruction } from '../../il/instruction.js';

// ============================================================================
// Test Utilities
// ============================================================================

function createTestLocation(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 10, offset: 9 },
    file: 'test.blend',
  };
}

function createTestFrame(name: string, slots: FrameSlot[]): Frame {
  const frame = createFrame(name);
  frame.slots = slots;
  frame.totalSize = slots.reduce((sum, s) => sum + s.size, 0);
  return frame;
}

function createByteSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

function createWordSlot(name: string, address: number): FrameSlot {
  const slot = createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD);
  slot.location = SlotLocation.FrameRegion;
  slot.address = address;
  return slot;
}

/**
 * Helper to get immediate value from an ILInstruction's first operand.
 * Returns undefined if no immediate operand exists.
 */
function getImmediateValue(instr: ILInstruction): number | undefined {
  const op = instr.operands[0];
  if (op && op.kind === 'immediate') {
    return op.value;
  }
  return undefined;
}

/**
 * Helper to get label name from an ILInstruction's first operand.
 */
function getLabelName(instr: ILInstruction): string | undefined {
  const op = instr.operands[0];
  if (op && op.kind === 'label') {
    return op.name;
  }
  return undefined;
}

function generateFunctionWithBody(
  frameMap: Map<string, Frame>,
  symbolTable: SymbolTable,
  body: Statement[],
  slots: FrameSlot[] = []
): ReturnType<ILGenerator['generate']> {
  const generator = new ILGenerator(frameMap, symbolTable);
  const loc = createTestLocation();
  frameMap.set('testFunc', createTestFrame('testFunc', slots));
  const funcDecl = new FunctionDecl('testFunc', [], 'void', body, loc, false, false);
  const moduleDecl = new ModuleDecl(['test'], loc, false);
  const program = new Program(moduleDecl, [funcDecl], loc);
  return generator.generate(program);
}

// ============================================================================
// Byte 255 For-Loop Overflow Tests
// ============================================================================

describe('ILGenerator - Byte 255 For-Loop Overflow Fix', () => {
  let frameMap: Map<string, Frame>;
  let symbolTable: SymbolTable;

  beforeEach(() => {
    frameMap = new Map();
    symbolTable = new SymbolTable();
  });

  // ════════════════════════════════════════════════════════════════════
  // Post-body exit pattern: byte counter to 255
  // ════════════════════════════════════════════════════════════════════

  describe('byte counter ascending to 255 (post-body exit)', () => {
    it('should NOT emit CMP #0 (truncated 256) for end=255', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(255, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      // No CMP_IMM should have value 0 with 'end+1' comment (that would be truncated 256)
      const hasBadCmp = instructions.some(
        i => i.opcode === ILOpcode.CMP_IMM &&
          getImmediateValue(i) === 0 &&
          i.comment?.includes('end+1')
      );
      expect(hasBadCmp).toBe(false);
    });

    it('should use post-body exit with CMP and JUMP_GE for step=1', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(255, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      // Should have 'exit threshold' comment on CMP
      const exitCmp = instructions.find(
        i => i.opcode === ILOpcode.CMP_IMM && i.comment?.includes('exit threshold')
      );
      expect(exitCmp).toBeDefined();

      // Exit threshold value should be 255 (= 256 - step 1)
      expect(getImmediateValue(exitCmp!)).toBe(255);

      // Should have JUMP_GE with 'overflow' comment
      const jumpGe = instructions.find(
        i => i.opcode === ILOpcode.JUMP_GE && i.comment?.includes('overflow')
      );
      expect(jumpGe).toBeDefined();
    });

    it('should have INC_BYTE after the exit check', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(255, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      const incByte = instructions.find(i => i.opcode === ILOpcode.INC_BYTE);
      expect(incByte).toBeDefined();

      // INC_BYTE index should be > CMP_IMM exit threshold index
      const cmpIdx = instructions.findIndex(
        i => i.opcode === ILOpcode.CMP_IMM && i.comment?.includes('exit threshold')
      );
      const incIdx = instructions.findIndex(i => i.opcode === ILOpcode.INC_BYTE);
      expect(incIdx).toBeGreaterThan(cmpIdx);
    });

    it('should work for start=100 to 255', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(100, loc);
      const end = new LiteralExpression(255, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      // Should use post-body exit pattern
      const exitCmp = instructions.find(
        i => i.opcode === ILOpcode.CMP_IMM && i.comment?.includes('exit threshold')
      );
      expect(exitCmp).toBeDefined();
      expect(getImmediateValue(exitCmp!)).toBe(255);
    });

    it('should emit correct sequence: LOAD → CMP → JUMP_GE → INC → JUMP', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(255, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      // Find the LOAD_BYTE that is part of the exit check (comment: 'check i before increment')
      const loadIdx = instructions.findIndex(
        i => i.opcode === ILOpcode.LOAD_BYTE && i.comment?.includes('check')
      );
      expect(loadIdx).toBeGreaterThan(-1);

      // After LOAD: CMP_IMM → JUMP_GE → INC_BYTE → JUMP
      const seq = instructions.slice(loadIdx);
      expect(seq[0].opcode).toBe(ILOpcode.LOAD_BYTE);
      expect(seq[1].opcode).toBe(ILOpcode.CMP_IMM);
      expect(seq[2].opcode).toBe(ILOpcode.JUMP_GE);
      expect(seq[3].opcode).toBe(ILOpcode.INC_BYTE);
      expect(seq[4].opcode).toBe(ILOpcode.JUMP);
    });

    it('should detect counted loop with 256 iterations', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(255, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const func = result.functions[0];

      expect(func.loops.length).toBe(1);
      expect(func.loops[0].isCountedLoop).toBe(true);
      expect(func.loops[0].boundValue).toBe(255);
      expect(func.loops[0].estimatedIterations).toBe(256);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Regression: normal for-loop patterns unchanged
  // ════════════════════════════════════════════════════════════════════

  describe('byte counter to < 255 (normal pattern, regression)', () => {
    it('should use normal CMP #(end+1) for end=254', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(254, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      // Should have CMP_IMM with value 255 (end+1)
      const cmpImm = instructions.find(i => i.opcode === ILOpcode.CMP_IMM);
      expect(cmpImm).toBeDefined();
      expect(getImmediateValue(cmpImm!)).toBe(255);
    });

    it('should use normal CMP #10 for end=9', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(9, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      const cmpImm = instructions.find(i => i.opcode === ILOpcode.CMP_IMM);
      expect(cmpImm).toBeDefined();
      expect(getImmediateValue(cmpImm!)).toBe(10);
    });

    it('should handle edge case end=0 (single iteration)', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(0, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      const cmpImm = instructions.find(i => i.opcode === ILOpcode.CMP_IMM);
      expect(cmpImm).toBeDefined();
      expect(getImmediateValue(cmpImm!)).toBe(1);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Word counter: no overflow
  // ════════════════════════════════════════════════════════════════════

  describe('word counter to 255 (no overflow)', () => {
    it('should use CMP_WORD_IMM #256 for word counter', () => {
      const loc = createTestLocation();
      const iSlot = createWordSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(255, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      // Word counter can safely use CMP_WORD_IMM #256
      const cmpWord = instructions.find(i => i.opcode === ILOpcode.CMP_WORD_IMM);
      expect(cmpWord).toBeDefined();
      expect(getImmediateValue(cmpWord!)).toBe(256);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Custom step with end=255
  // ════════════════════════════════════════════════════════════════════

  describe('byte counter to 255 with custom step', () => {
    it('should use exit threshold 254 (256-2) for step=2', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(255, loc);
      const step = new LiteralExpression(2, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', step, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      const exitCmp = instructions.find(
        i => i.opcode === ILOpcode.CMP_IMM && i.comment?.includes('exit threshold')
      );
      expect(exitCmp).toBeDefined();
      expect(getImmediateValue(exitCmp!)).toBe(254);
    });

    it('should use exit threshold 246 (256-10) for step=10', () => {
      const loc = createTestLocation();
      const iSlot = createByteSlot('i', 0x0200);

      const start = new LiteralExpression(0, loc);
      const end = new LiteralExpression(255, loc);
      const step = new LiteralExpression(10, loc);
      const forStmt = new ForStatement('i', null, start, end, 'to', step, [], loc);

      const result = generateFunctionWithBody(frameMap, symbolTable, [forStmt], [iSlot]);
      const instructions = result.functions[0].instructions;

      const exitCmp = instructions.find(
        i => i.opcode === ILOpcode.CMP_IMM && i.comment?.includes('exit threshold')
      );
      expect(exitCmp).toBeDefined();
      expect(getImmediateValue(exitCmp!)).toBe(246);
    });
  });
});
