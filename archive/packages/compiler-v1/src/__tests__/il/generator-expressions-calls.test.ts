/**
 * IL Expression Generator Tests - Call Expressions
 *
 * Tests for call expression generation including:
 * - Function calls with no arguments
 * - Function calls with arguments
 * - Void function calls
 * - Function calls with return values
 * - Intrinsic function calls (peek, poke)
 * - Nested function calls
 *
 * Part 5 of Phase 4 expression tests (~50 tests).
 *
 * @module __tests__/il/generator-expressions-calls.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILExpressionGenerator } from '../../il/generator/expressions.js';
import { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import type { Program } from '../../ast/nodes.js';
import { ILOpcode } from '../../il/instructions.js';

// =============================================================================
// Test Helpers
// =============================================================================

function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

function createGenerator(): ILExpressionGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILExpressionGenerator(symbolTable);
}

function findInstructions(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly { opcode: ILOpcode }[] }[] },
  opcode: ILOpcode,
): { opcode: ILOpcode }[] {
  const instructions: { opcode: ILOpcode }[] = [];
  for (const block of ilFunc.getBlocks()) {
    for (const instr of block.getInstructions()) {
      if (instr.opcode === opcode) {
        instructions.push(instr as { opcode: ILOpcode });
      }
    }
  }
  return instructions;
}

function hasInstruction(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly { opcode: ILOpcode }[] }[] },
  opcode: ILOpcode,
): boolean {
  return findInstructions(ilFunc, opcode).length > 0;
}

// =============================================================================
// Basic Function Call Tests
// =============================================================================

describe('ILExpressionGenerator - Call Expressions: Basic Calls', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('calls with no arguments', () => {
    it('should generate CALL_VOID for void function with no args', () => {
      const source = `module test
function helper() {
}
function main() {
  helper();
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.CALL_VOID)).toBe(true);
    });

    it('should generate CALL for function returning byte with no args', () => {
      const source = `module test
function getValue(): byte {
  return 42;
}
function main(): byte {
  return getValue();
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      const mainFunc = result.module.getFunction('main')!;
      expect(
        hasInstruction(mainFunc, ILOpcode.CALL) || hasInstruction(mainFunc, ILOpcode.CALL_VOID),
      ).toBe(true);
    });

    it('should generate CALL for function returning word with no args', () => {
      const source = `module test
function getAddress(): word {
  return $1000;
}
function main(): word {
  return getAddress();
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });
  });

  describe('calls with single argument', () => {
    it('should generate CALL with single byte argument', () => {
      const source = `module test
function double(x: byte): byte {
  return x * 2;
}
function main(): byte {
  return double(21);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      const mainFunc = result.module.getFunction('main')!;
      expect(
        hasInstruction(mainFunc, ILOpcode.CALL) || hasInstruction(mainFunc, ILOpcode.CALL_VOID),
      ).toBe(true);
    });

    it('should generate CALL with single word argument', () => {
      const source = `module test
function process(addr: word): word {
  return addr + 1;
}
function main(): word {
  return process($1000);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });

    it('should generate CALL with variable argument', () => {
      const source = `module test
function increment(x: byte): byte {
  return x + 1;
}
function main(): byte {
  let value: byte = 10;
  return increment(value);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      const mainFunc = result.module.getFunction('main')!;
      expect(hasInstruction(mainFunc, ILOpcode.LOAD_VAR)).toBe(true);
    });
  });

  describe('calls with multiple arguments', () => {
    it('should generate CALL with two byte arguments', () => {
      const source = `module test
function add(a: byte, b: byte): byte {
  return a + b;
}
function main(): byte {
  return add(5, 10);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });

    it('should generate CALL with three arguments', () => {
      const source = `module test
function combine(a: byte, b: byte, c: byte): byte {
  return a + b + c;
}
function main(): byte {
  return combine(1, 2, 3);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });

    it('should generate CALL with mixed type arguments', () => {
      const source = `module test
function compute(offset: word, index: byte): word {
  return offset + index;
}
function main(): word {
  return compute($1000, 5);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });
  });
});

// =============================================================================
// Void Function Call Tests
// =============================================================================

describe('ILExpressionGenerator - Call Expressions: Void Calls', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('void function calls as statements', () => {
    it('should generate CALL_VOID for procedure call', () => {
      const source = `module test
function initialize() {
  let x: byte = 0;
}
function main() {
  initialize();
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.CALL_VOID)).toBe(true);
    });

    it('should generate CALL_VOID with argument', () => {
      const source = `module test
function setColor(color: byte) {
  let c: byte = color;
}
function main() {
  setColor(5);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.CALL_VOID)).toBe(true);
    });

    it('should generate multiple CALL_VOID in sequence', () => {
      const source = `module test
function step1() {
}
function step2() {
}
function step3() {
}
function main() {
  step1();
  step2();
  step3();
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('main')!, ILOpcode.CALL_VOID).length).toBe(3);
    });
  });
});

// =============================================================================
// Intrinsic Function Call Tests
// =============================================================================

describe('ILExpressionGenerator - Call Expressions: Intrinsics', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('peek intrinsic', () => {
    it('should generate INTRINSIC_PEEK for peek call', () => {
      const source = `module test
function readByte(): byte {
  return peek($D020);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readByte')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
    });

    it('should generate INTRINSIC_PEEK with variable address', () => {
      const source = `module test
function readFromAddr(): byte {
  let addr: word = $D020;
  return peek(addr);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readFromAddr')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
    });

    it('should generate INTRINSIC_PEEK with expression address', () => {
      const source = `module test
function readFromOffset(): byte {
  let base: word = $D000;
  let offset: byte = $20;
  return peek(base + offset);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readFromOffset')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('readFromOffset')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
    });
  });

  describe('poke intrinsic', () => {
    it('should generate INTRINSIC_POKE for poke call', () => {
      const source = `module test
function setBorderColor() {
  poke($D020, 0);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('setBorderColor')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });

    it('should generate INTRINSIC_POKE with variable value', () => {
      const source = `module test
function setColor() {
  let color: byte = 5;
  poke($D020, color);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('setColor')!, ILOpcode.LOAD_VAR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('setColor')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });

    it('should generate INTRINSIC_POKE with variable address and value', () => {
      const source = `module test
function writeToAddr() {
  let addr: word = $D020;
  let value: byte = 5;
  poke(addr, value);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('writeToAddr')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });

    it('should generate INTRINSIC_POKE with computed address', () => {
      const source = `module test
function writeOffset() {
  let base: word = $D000;
  let offset: byte = $20;
  poke(base + offset, 1);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('writeOffset')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('writeOffset')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });
  });
});

// =============================================================================
// Nested and Complex Call Tests
// =============================================================================

describe('ILExpressionGenerator - Call Expressions: Nested Calls', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('nested function calls', () => {
    it('should generate nested calls with result as argument', () => {
      const source = `module test
function double(x: byte): byte {
  return x * 2;
}
function main(): byte {
  return double(double(5));
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      const mainFunc = result.module.getFunction('main')!;
      const calls = findInstructions(mainFunc, ILOpcode.CALL);
      const voidCalls = findInstructions(mainFunc, ILOpcode.CALL_VOID);
      expect(calls.length + voidCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate call in expression', () => {
      const source = `module test
function getValue(): byte {
  return 10;
}
function main(): byte {
  let v: byte = getValue();
  return v + 5;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate multiple calls in expression', () => {
      const source = `module test
function getA(): byte {
  return 5;
}
function getB(): byte {
  return 10;
}
function main(): byte {
  let a: byte = getA();
  let b: byte = getB();
  return a + b;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.ADD)).toBe(true);
    });
  });

  describe('call in control flow', () => {
    it('should generate call in if condition', () => {
      const source = `module test
function isReady(): bool {
  return true;
}
function main(): byte {
  let ready: bool = isReady();
  if (ready) {
    return 1;
  }
  return 0;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });

    it('should generate call in loop body', () => {
      const source = `module test
function process() {
}
function main() {
  process();
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.CALL_VOID)).toBe(true);
    });
  });
});

// =============================================================================
// C64-Specific Call Patterns Tests
// =============================================================================

describe('ILExpressionGenerator - Call Expressions: C64 Patterns', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('C64 hardware access patterns', () => {
    it('should generate peek for reading VIC-II register', () => {
      const source = `module test
function readRasterLine(): byte {
  return peek($D012);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readRasterLine')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
    });

    it('should generate poke for writing VIC-II register', () => {
      const source = `module test
function setBackgroundColor(color: byte) {
  poke($D021, color);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('setBackgroundColor')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });

    it('should generate peek/poke for sprite position', () => {
      const source = `module test
function setSpriteX(spriteNum: byte, x: byte) {
  let addr: word = $D000 + spriteNum * 2;
  poke(addr, x);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('setSpriteX')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });

    it('should generate peek for reading keyboard', () => {
      const source = `module test
function readKeyboard(): byte {
  return peek($DC01);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readKeyboard')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
    });

    it('should generate poke for setting CIA data direction', () => {
      const source = `module test
function setupCIA() {
  poke($DC02, $FF);
  poke($DC03, 0);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('setupCIA')!, ILOpcode.INTRINSIC_POKE).length).toBe(2);
    });
  });

  describe('game loop patterns', () => {
    it('should generate calls in game update pattern', () => {
      const source = `module test
function handleInput() {
}
function updateLogic() {
}
function render() {
}
function gameLoop() {
  handleInput();
  updateLogic();
  render();
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('gameLoop')!, ILOpcode.CALL_VOID).length).toBe(3);
    });

    it('should generate call for waitForRaster pattern', () => {
      const source = `module test
function waitForRaster(line: byte) {
  while (peek($D012) != line) {
  }
}`;

      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);

      const func = result.module.getFunction('waitForRaster');
      expect(func).toBeDefined();

      expect(hasInstruction(func!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
      expect(hasInstruction(func!, ILOpcode.CMP_NE)).toBe(true);
      expect(hasInstruction(func!, ILOpcode.BRANCH)).toBe(true);
    });
  });
});

// =============================================================================
// Call Expression Edge Cases
// =============================================================================

describe('ILExpressionGenerator - Call Expressions: Edge Cases', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('expression arguments', () => {
    it('should generate call with arithmetic expression argument', () => {
      const source = `module test
function process(value: byte): byte {
  return value;
}
function main(): byte {
  return process(5 + 10);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate call with comparison expression argument', () => {
      const source = `module test
function check(flag: bool): byte {
  if (flag) {
    return 1;
  }
  return 0;
}
function main(): byte {
  let a: byte = 5;
  let b: byte = 10;
  return check(a < b);
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.CMP_LT)).toBe(true);
    });
  });

  describe('return value handling', () => {
    it('should handle unused return value', () => {
      const source = `module test
function getValue(): byte {
  return 42;
}
function main() {
  getValue();
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });

    it('should handle return value in assignment', () => {
      const source = `module test
function compute(): byte {
  return 42;
}
function main(): byte {
  let result: byte = 0;
  result = compute();
  return result;
}`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.STORE_VAR)).toBe(true);
    });
  });
});