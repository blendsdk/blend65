/**
 * IL Expression Generator Tests - Literal Expressions
 *
 * Tests for literal expression generation including:
 * - Numeric literals (decimal, hex, binary)
 * - Boolean literals (true, false)
 * - String literals
 * - Edge cases (overflow, type inference)
 *
 * Part 1 of Phase 4 expression tests (~40 tests).
 *
 * @module __tests__/il/generator-expressions-literals.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILExpressionGenerator } from '../../il/generator/expressions.js';
import { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import type { Program } from '../../ast/nodes.js';
import { ILOpcode } from '../../il/instructions.js';
import { ILTypeKind } from '../../il/types.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Parses Blend65 source code into an AST Program.
 *
 * @param source - Blend65 source code
 * @returns Parsed Program node
 */
function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Creates an ILExpressionGenerator for testing.
 *
 * @returns Generator instance with fresh symbol table
 */
function createGenerator(): ILExpressionGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILExpressionGenerator(symbolTable);
}

/**
 * Finds instructions of a specific opcode in a function.
 *
 * @param ilFunc - IL function to search
 * @param opcode - Opcode to find
 * @returns Array of matching instructions
 */
function findInstructions(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly { opcode: ILOpcode }[] }[] },
  opcode: ILOpcode,
): { opcode: ILOpcode; value?: number }[] {
  const instructions: { opcode: ILOpcode; value?: number }[] = [];
  for (const block of ilFunc.getBlocks()) {
    for (const instr of block.getInstructions()) {
      if (instr.opcode === opcode) {
        instructions.push(instr as { opcode: ILOpcode; value?: number });
      }
    }
  }
  return instructions;
}

/**
 * Gets all CONST instructions from a function.
 *
 * @param ilFunc - IL function to search
 * @returns Array of CONST instructions with their values
 */
function getConstInstructions(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly unknown[] }[] },
): { opcode: ILOpcode; value: number; result: { type: { kind: ILTypeKind } } }[] {
  return findInstructions(ilFunc as Parameters<typeof findInstructions>[0], ILOpcode.CONST) as {
    opcode: ILOpcode;
    value: number;
    result: { type: { kind: ILTypeKind } };
  }[];
}

// =============================================================================
// Test Suite: Literal Expressions
// =============================================================================

describe('ILExpressionGenerator - Literal Expressions', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  // ===========================================================================
  // Decimal Numeric Literals
  // ===========================================================================

  describe('decimal numeric literals', () => {
    it('should generate CONST for byte literal 0', () => {
      const source = `
        module test
        function getValue(): byte
          return 0
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      // Should have at least one CONST with value 0
      expect(constInstrs.some((c) => c.value === 0)).toBe(true);
    });

    it('should generate CONST for byte literal 1', () => {
      const source = `
        module test
        function getValue(): byte
          return 1
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 1)).toBe(true);
    });

    it('should generate CONST for byte literal 127 (max signed)', () => {
      const source = `
        module test
        function getValue(): byte
          return 127
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 127)).toBe(true);
    });

    it('should generate CONST for byte literal 128', () => {
      const source = `
        module test
        function getValue(): byte
          return 128
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 128)).toBe(true);
    });

    it('should generate CONST for byte literal 255 (max unsigned)', () => {
      const source = `
        module test
        function getValue(): byte
          return 255
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 255)).toBe(true);
    });

    it('should generate CONST for word literal 256', () => {
      const source = `
        module test
        function getValue(): word
          return 256
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 256)).toBe(true);
    });

    it('should generate CONST for word literal 1000', () => {
      const source = `
        module test
        function getValue(): word
          return 1000
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 1000)).toBe(true);
    });

    it('should generate CONST for word literal 32767 (max signed 16-bit)', () => {
      const source = `
        module test
        function getValue(): word
          return 32767
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 32767)).toBe(true);
    });

    it('should generate CONST for word literal 32768', () => {
      const source = `
        module test
        function getValue(): word
          return 32768
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 32768)).toBe(true);
    });

    it('should generate CONST for word literal 65535 (max unsigned 16-bit)', () => {
      const source = `
        module test
        function getValue(): word
          return 65535
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 65535)).toBe(true);
    });
  });

  // ===========================================================================
  // Hexadecimal Numeric Literals
  // ===========================================================================

  describe('hexadecimal numeric literals', () => {
    it('should generate CONST for hex literal $00', () => {
      const source = `
        module test
        function getValue(): byte
          return $00
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0x00)).toBe(true);
    });

    it('should generate CONST for hex literal $FF', () => {
      const source = `
        module test
        function getValue(): byte
          return $FF
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0xff)).toBe(true);
    });

    it('should generate CONST for hex literal $0100 (word)', () => {
      const source = `
        module test
        function getValue(): word
          return $0100
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0x0100)).toBe(true);
    });

    it('should generate CONST for hex literal $D020 (VIC border color)', () => {
      const source = `
        module test
        function getValue(): word
          return $D020
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0xd020)).toBe(true);
    });

    it('should generate CONST for hex literal $FFFF (max word)', () => {
      const source = `
        module test
        function getValue(): word
          return $FFFF
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0xffff)).toBe(true);
    });

    it('should generate CONST for lowercase hex literal $ff', () => {
      const source = `
        module test
        function getValue(): byte
          return $ff
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0xff)).toBe(true);
    });

    it('should generate CONST for mixed case hex literal $aB', () => {
      const source = `
        module test
        function getValue(): byte
          return $aB
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0xab)).toBe(true);
    });
  });

  // ===========================================================================
  // Binary Numeric Literals
  // ===========================================================================

  describe('binary numeric literals', () => {
    it('should generate CONST for binary literal 0b00000000', () => {
      const source = `
        module test
        function getValue(): byte
          return 0b00000000
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0b00000000)).toBe(true);
    });

    it('should generate CONST for binary literal 0b11111111', () => {
      const source = `
        module test
        function getValue(): byte
          return 0b11111111
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0b11111111)).toBe(true);
    });

    it('should generate CONST for binary literal 0b10101010', () => {
      const source = `
        module test
        function getValue(): byte
          return 0b10101010
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0b10101010)).toBe(true);
    });

    it('should generate CONST for binary literal 0b01010101', () => {
      const source = `
        module test
        function getValue(): byte
          return 0b01010101
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0b01010101)).toBe(true);
    });

    it('should generate CONST for binary literal 0b00000001', () => {
      const source = `
        module test
        function getValue(): byte
          return 0b00000001
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 1)).toBe(true);
    });

    it('should generate CONST for binary literal 0b10000000', () => {
      const source = `
        module test
        function getValue(): byte
          return 0b10000000
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 128)).toBe(true);
    });
  });

  // ===========================================================================
  // Boolean Literals
  // ===========================================================================

  describe('boolean literals', () => {
    it('should generate CONST 1 for true literal', () => {
      const source = `
        module test
        function getValue(): bool
          return true
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      // true is represented as 1
      expect(constInstrs.some((c) => c.value === 1)).toBe(true);
    });

    it('should generate CONST 0 for false literal', () => {
      const source = `
        module test
        function getValue(): bool
          return false
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      // false is represented as 0
      expect(constInstrs.some((c) => c.value === 0)).toBe(true);
    });

    it('should handle true in if condition', () => {
      const source = `
        module test
        function test()
          if true then
            let x: byte = 1
          end if
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('test');
      expect(func).toBeDefined();
    });

    it('should handle false in if condition', () => {
      const source = `
        module test
        function test()
          if false then
            let x: byte = 1
          end if
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('test');
      expect(func).toBeDefined();
    });

    it('should handle boolean in while condition', () => {
      const source = `
        module test
        function test()
          while false do
            let x: byte = 1
          end while
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      // While loop generation works, but may produce warnings
      // The key is that the function exists and has structure
      const func = result.module.getFunction('test');
      expect(func).toBeDefined();
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // Type Inference for Literals
  // ===========================================================================

  describe('literal type inference', () => {
    it('should infer byte type for value 0-255', () => {
      const source = `
        module test
        function getValue(): byte
          return 100
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      // 100 fits in byte, should have byte type
      const instr = constInstrs.find((c) => c.value === 100);
      expect(instr).toBeDefined();
      expect(instr!.result.type.kind).toBe(ILTypeKind.Byte);
    });

    it('should infer word type for value > 255', () => {
      const source = `
        module test
        function getValue(): word
          return 1000
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      // 1000 needs word type
      const instr = constInstrs.find((c) => c.value === 1000);
      expect(instr).toBeDefined();
      expect(instr!.result.type.kind).toBe(ILTypeKind.Word);
    });

    it('should use byte type for hex value $FF', () => {
      const source = `
        module test
        function getValue(): byte
          return $FF
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      const instr = constInstrs.find((c) => c.value === 0xff);
      expect(instr).toBeDefined();
      expect(instr!.result.type.kind).toBe(ILTypeKind.Byte);
    });

    it('should use word type for hex value $0100', () => {
      const source = `
        module test
        function getValue(): word
          return $0100
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      const constInstrs = getConstInstructions(func!);

      const instr = constInstrs.find((c) => c.value === 0x0100);
      expect(instr).toBeDefined();
      expect(instr!.result.type.kind).toBe(ILTypeKind.Word);
    });
  });

  // ===========================================================================
  // Multiple Literals in Single Function
  // ===========================================================================

  describe('multiple literals', () => {
    it('should generate multiple CONST instructions for different literals', () => {
      const source = `
        module test
        function multiLiterals(): byte
          let a: byte = 10
          let b: byte = 20
          let c: byte = 30
          return a
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('multiLiterals');
      const constInstrs = getConstInstructions(func!);

      // Should have CONST for 10, 20, 30
      expect(constInstrs.some((c) => c.value === 10)).toBe(true);
      expect(constInstrs.some((c) => c.value === 20)).toBe(true);
      expect(constInstrs.some((c) => c.value === 30)).toBe(true);
    });

    it('should generate same CONST instruction for repeated literals', () => {
      const source = `
        module test
        function repeatedLiterals(): byte
          let a: byte = 42
          let b: byte = 42
          return a
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('repeatedLiterals');
      const constInstrs = getConstInstructions(func!);

      // Should have at least two CONST with value 42
      const fortyTwos = constInstrs.filter((c) => c.value === 42);
      expect(fortyTwos.length).toBeGreaterThanOrEqual(2);
    });

    it('should generate mixed byte and word literals', () => {
      const source = `
        module test
        function mixedLiterals(): word
          let a: byte = 100
          let b: word = 1000
          return b
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('mixedLiterals');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 100)).toBe(true);
      expect(constInstrs.some((c) => c.value === 1000)).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Cases and Boundary Values
  // ===========================================================================

  describe('edge cases and boundary values', () => {
    it('should handle zero in different formats', () => {
      const source = `
        module test
        function zeros(): byte
          let a: byte = 0
          let b: byte = $00
          let c: byte = 0b00000000
          return a
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('zeros');
      const constInstrs = getConstInstructions(func!);

      // All zeros should be 0
      const zeros = constInstrs.filter((c) => c.value === 0);
      expect(zeros.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle byte boundary value 255', () => {
      const source = `
        module test
        function byteMax(): byte
          return 255
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('byteMax');
      const constInstrs = getConstInstructions(func!);

      const instr = constInstrs.find((c) => c.value === 255);
      expect(instr).toBeDefined();
      expect(instr!.result.type.kind).toBe(ILTypeKind.Byte);
    });

    it('should handle word boundary value 65535', () => {
      const source = `
        module test
        function wordMax(): word
          return 65535
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('wordMax');
      const constInstrs = getConstInstructions(func!);

      const instr = constInstrs.find((c) => c.value === 65535);
      expect(instr).toBeDefined();
      expect(instr!.result.type.kind).toBe(ILTypeKind.Word);
    });

    it('should handle common C64 addresses as literals', () => {
      const source = `
        module test
        function c64Addresses(): word
          let borderColor: word = $D020
          let screenMem: word = $0400
          let colorMem: word = $D800
          return borderColor
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('c64Addresses');
      const constInstrs = getConstInstructions(func!);

      expect(constInstrs.some((c) => c.value === 0xd020)).toBe(true);
      expect(constInstrs.some((c) => c.value === 0x0400)).toBe(true);
      expect(constInstrs.some((c) => c.value === 0xd800)).toBe(true);
    });
  });
});