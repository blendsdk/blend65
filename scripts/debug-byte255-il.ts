/**
 * Debug script: Inspect IL output for byte 255 for-loop
 */
import { ILGenerator } from '../packages/compiler/src/il/generator/index.js';
import { ILOpcode } from '../packages/compiler/src/il/enums.js';
import { createFrame } from '../packages/compiler/src/frame/allocator/frame-calculator.js';
import { createFrameSlot } from '../packages/compiler/src/frame/types.js';
import { SlotKind, SlotLocation } from '../packages/compiler/src/frame/enums.js';
import { SymbolTable } from '../packages/compiler/src/semantic/symbol-table.js';
import { BUILTIN_TYPES } from '../packages/compiler/src/semantic/types.js';
import { LiteralExpression } from '../packages/compiler/src/ast/expressions.js';
import { FunctionDecl } from '../packages/compiler/src/ast/declarations.js';
import { ForStatement } from '../packages/compiler/src/ast/statements.js';
import { Program, ModuleDecl } from '../packages/compiler/src/ast/program.js';

const loc = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 10, offset: 9 },
  file: 'test.blend',
};

const iSlot = createFrameSlot('i', SlotKind.Local, BUILTIN_TYPES.BYTE);
iSlot.location = SlotLocation.FrameRegion;
iSlot.address = 0x0200;

const frame = createFrame('testFunc');
frame.slots = [iSlot];
frame.totalSize = 1;

const frameMap = new Map();
frameMap.set('testFunc', frame);

const symbolTable = new SymbolTable();
const generator = new ILGenerator(frameMap, symbolTable);

// for (i = 0 to 255) { }
const start = new LiteralExpression(0, loc);
const end = new LiteralExpression(255, loc);
const forStmt = new ForStatement('i', null, start, end, 'to', null, [], loc);

const funcDecl = new FunctionDecl('testFunc', [], 'void', [forStmt], loc, false, false);
const moduleDecl = new ModuleDecl(['test'], loc, false);
const program = new Program(moduleDecl, [funcDecl], loc);

const result = generator.generate(program);
const instructions = result.functions[0].instructions;

console.log('=== IL Instructions for: for (i = 0 to 255) ===');
instructions.forEach((instr, idx) => {
  console.log(`[${idx}] ${instr.opcode} | operand: ${JSON.stringify(instr.operand)} | comment: ${instr.comment}`);
});
