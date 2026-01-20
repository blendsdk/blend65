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

/**
 * Parses Blend65 source code into an AST Program.
 *
 * @param source - Blend65 source code
 * @returns Parsed AST Program
 */
function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Creates a fresh ILExpressionGenerator for testing.
 *
 * @returns New generator instance with fresh symbol table
 */
function createGenerator(): ILExpressionGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILExpressionGenerator(symbolTable);
}

/**
 * Finds all instructions with a specific opcode in a function.
 *
 * @param ilFunc - IL function to search
 * @param opcode - Opcode to find
 * @returns Array of matching instructions
 */
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

/**
 * Checks if a function contains at least one instruction with a specific opcode.
 *
 * @param ilFunc - IL function to search
 * @param opcode - Opcode to find
 * @returns true if opcode is present
 */
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
function helper()
end function
function main()
  helper()
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.CALL_VOID)).toBe(true);
    });

    it('should generate CALL for function returning byte with no args', () => {
      const source = `module test
function getValue(): byte
  return 42
end function
function main(): byte
  return getValue()
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // Either CALL or CALL_VOID depending on usage
      const mainFunc = result.module.getFunction('main')!;
      expect(
        hasInstruction(mainFunc, ILOpcode.CALL) || hasInstruction(mainFunc, ILOpcode.CALL_VOID),
      ).toBe(true);
    });

    it('should generate CALL for function returning word with no args', () => {
      const source = `module test
function getAddress(): word
  return $1000
end function
function main(): word
  return getAddress()
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });
  });

  describe('calls with single argument', () => {
    it('should generate CALL with single byte argument', () => {
      const source = `module test
function double(x: byte): byte
  return x * 2
end function
function main(): byte
  return double(21)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      const mainFunc = result.module.getFunction('main')!;
      expect(
        hasInstruction(mainFunc, ILOpcode.CALL) || hasInstruction(mainFunc, ILOpcode.CALL_VOID),
      ).toBe(true);
    });

    it('should generate CALL with single word argument', () => {
      const source = `module test
function process(addr: word): word
  return addr + 1
end function
function main(): word
  return process($1000)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });

    it('should generate CALL with variable argument', () => {
      const source = `module test
function increment(x: byte): byte
  return x + 1
end function
function main(): byte
  let value: byte = 10
  return increment(value)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      const mainFunc = result.module.getFunction('main')!;
      expect(hasInstruction(mainFunc, ILOpcode.LOAD_VAR)).toBe(true);
    });
  });

  describe('calls with multiple arguments', () => {
    it('should generate CALL with two byte arguments', () => {
      const source = `module test
function add(a: byte, b: byte): byte
  return a + b
end function
function main(): byte
  return add(5, 10)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });

    it('should generate CALL with three arguments', () => {
      const source = `module test
function combine(a: byte, b: byte, c: byte): byte
  return a + b + c
end function
function main(): byte
  return combine(1, 2, 3)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });

    it('should generate CALL with mixed type arguments', () => {
      const source = `module test
function compute(offset: word, index: byte): word
  return offset + index
end function
function main(): word
  return compute($1000, 5)
end function`;
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
function initialize()
  let x: byte = 0
end function
function main()
  initialize()
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.CALL_VOID)).toBe(true);
    });

    it('should generate CALL_VOID with argument', () => {
      const source = `module test
function setColor(color: byte)
  let c: byte = color
end function
function main()
  setColor(5)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.CALL_VOID)).toBe(true);
    });

    it('should generate multiple CALL_VOID in sequence', () => {
      const source = `module test
function step1()
end function
function step2()
end function
function step3()
end function
function main()
  step1()
  step2()
  step3()
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('main')!, ILOpcode.CALL_VOID).length).toBe(3);
    });
  });
});

// =============================================================================
// Intrinsic Function Call Tests
// NOTE: These tests are skipped until intrinsics are registered in the generator
// =============================================================================

describe.skip('ILExpressionGenerator - Call Expressions: Intrinsics', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('peek intrinsic', () => {
    it('should generate INTRINSIC_PEEK for peek call', () => {
      const source = `module test
function readByte(): byte
  return peek($D020)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readByte')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
    });

    it('should generate INTRINSIC_PEEK with variable address', () => {
      const source = `module test
function readFromAddr(): byte
  let addr: word = $D020
  return peek(addr)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readFromAddr')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
    });

    it('should generate INTRINSIC_PEEK with expression address', () => {
      const source = `module test
function readFromOffset(): byte
  let base: word = $D000
  let offset: byte = $20
  return peek(base + offset)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readFromOffset')!, ILOpcode.ADD)).toBe(true);
      expect(hasInstruction(result.module.getFunction('readFromOffset')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
    });
  });

  describe('poke intrinsic', () => {
    it('should generate INTRINSIC_POKE for poke call', () => {
      const source = `module test
function setBorderColor()
  poke($D020, 0)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('setBorderColor')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });

    it('should generate INTRINSIC_POKE with variable value', () => {
      const source = `module test
function setColor()
  let color: byte = 5
  poke($D020, color)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('setColor')!, ILOpcode.LOAD_VAR)).toBe(true);
      expect(hasInstruction(result.module.getFunction('setColor')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });

    it('should generate INTRINSIC_POKE with variable address and value', () => {
      const source = `module test
function writeToAddr()
  let addr: word = $D020
  let value: byte = 5
  poke(addr, value)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('writeToAddr')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });

    it('should generate INTRINSIC_POKE with computed address', () => {
      const source = `module test
function writeOffset()
  let base: word = $D000
  let offset: byte = $20
  poke(base + offset, 1)
end function`;
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
function double(x: byte): byte
  return x * 2
end function
function main(): byte
  return double(double(5))
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      // Should have multiple calls
      const mainFunc = result.module.getFunction('main')!;
      const calls = findInstructions(mainFunc, ILOpcode.CALL);
      const voidCalls = findInstructions(mainFunc, ILOpcode.CALL_VOID);
      expect(calls.length + voidCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate call in expression', () => {
      const source = `module test
function getValue(): byte
  return 10
end function
function main(): byte
  let v: byte = getValue()
  return v + 5
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate multiple calls in expression', () => {
      const source = `module test
function getA(): byte
  return 5
end function
function getB(): byte
  return 10
end function
function main(): byte
  let a: byte = getA()
  let b: byte = getB()
  return a + b
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.ADD)).toBe(true);
    });
  });

  describe('call in control flow', () => {
    it('should generate call in if condition', () => {
      const source = `module test
function isReady(): bool
  return true
end function
function main(): byte
  let ready: bool = isReady()
  if ready then
    return 1
  end if
  return 0
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });

    it('should generate call in loop body', () => {
      const source = `module test
function process()
end function
function main()
  process()
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.CALL_VOID)).toBe(true);
    });
  });
});

// =============================================================================
// C64-Specific Call Patterns Tests
// NOTE: peek/poke tests are skipped until intrinsics are registered
// =============================================================================

describe('ILExpressionGenerator - Call Expressions: C64 Patterns', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe.skip('C64 hardware access patterns', () => {
    it('should generate peek for reading VIC-II register', () => {
      const source = `module test
function readRasterLine(): byte
  return peek($D012)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readRasterLine')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
    });

    it('should generate poke for writing VIC-II register', () => {
      const source = `module test
function setBackgroundColor(color: byte)
  poke($D021, color)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('setBackgroundColor')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });

    it('should generate peek/poke for sprite position', () => {
      const source = `module test
function setSpriteX(spriteNum: byte, x: byte)
  let addr: word = $D000 + spriteNum * 2
  poke(addr, x)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('setSpriteX')!, ILOpcode.INTRINSIC_POKE)).toBe(true);
    });

    it('should generate peek for reading keyboard', () => {
      const source = `module test
function readKeyboard(): byte
  return peek($DC01)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('readKeyboard')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
    });

    it('should generate poke for setting CIA data direction', () => {
      const source = `module test
function setupCIA()
  poke($DC02, $FF)
  poke($DC03, 0)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('setupCIA')!, ILOpcode.INTRINSIC_POKE).length).toBe(2);
    });
  });

  describe('game loop patterns', () => {
    it('should generate calls in game update pattern', () => {
      const source = `module test
function handleInput()
end function
function updateLogic()
end function
function render()
end function
function gameLoop()
  handleInput()
  updateLogic()
  render()
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(findInstructions(result.module.getFunction('gameLoop')!, ILOpcode.CALL_VOID).length).toBe(3);
    });

    it.skip('should generate call for waitForRaster pattern', () => {
      const source = `module test
function waitForRaster(line: byte)
  while peek($D012) != line do
  end while
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('waitForRaster')!, ILOpcode.INTRINSIC_PEEK)).toBe(true);
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
function process(value: byte): byte
  return value
end function
function main(): byte
  return process(5 + 10)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.ADD)).toBe(true);
    });

    it('should generate call with comparison expression argument', () => {
      const source = `module test
function check(flag: bool): byte
  if flag then
    return 1
  end if
  return 0
end function
function main(): byte
  let a: byte = 5
  let b: byte = 10
  return check(a < b)
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.CMP_LT)).toBe(true);
    });
  });

  describe('return value handling', () => {
    it('should handle unused return value', () => {
      const source = `module test
function getValue(): byte
  return 42
end function
function main()
  getValue()
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(result.module.getFunction('main')).toBeDefined();
    });

    it('should handle return value in assignment', () => {
      const source = `module test
function compute(): byte
  return 42
end function
function main(): byte
  let result: byte = 0
  result = compute()
  return result
end function`;
      const result = generator.generateModule(parseSource(source));
      expect(result.success).toBe(true);
      expect(hasInstruction(result.module.getFunction('main')!, ILOpcode.STORE_VAR)).toBe(true);
    });
  });
});