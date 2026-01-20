/**
 * IL Expression Generator Tests - Identifier Expressions
 *
 * Tests for identifier expression generation including:
 * - Local variable references
 * - Function parameter references
 * - Global variable references
 * - Variable scope resolution
 *
 * Part 2 of Phase 4 expression tests (~30 tests).
 *
 * @module __tests__/il/generator-expressions-identifiers.test
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
): { opcode: ILOpcode; variableName?: string }[] {
  const instructions: { opcode: ILOpcode; variableName?: string }[] = [];
  for (const block of ilFunc.getBlocks()) {
    for (const instr of block.getInstructions()) {
      if (instr.opcode === opcode) {
        instructions.push(instr as { opcode: ILOpcode; variableName?: string });
      }
    }
  }
  return instructions;
}

/**
 * Gets all LOAD_VAR instructions from a function.
 *
 * @param ilFunc - IL function to search
 * @returns Array of LOAD_VAR instructions
 */
function getLoadVarInstructions(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly unknown[] }[] },
): { opcode: ILOpcode; variableName: string }[] {
  return findInstructions(
    ilFunc as Parameters<typeof findInstructions>[0],
    ILOpcode.LOAD_VAR,
  ) as { opcode: ILOpcode; variableName: string }[];
}

// =============================================================================
// Test Suite: Identifier Expressions
// =============================================================================

describe('ILExpressionGenerator - Identifier Expressions', () => {
  let generator: ILExpressionGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  // ===========================================================================
  // Local Variable References
  // ===========================================================================

  describe('local variable references', () => {
    it('should generate LOAD_VAR for local byte variable', () => {
      const source = `
        module test
        function useLocal(): byte
          let x: byte = 10
          return x
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('useLocal');
      const loadInstrs = getLoadVarInstructions(func!);

      // Should have LOAD_VAR for x
      expect(loadInstrs.some((l) => l.variableName === 'x')).toBe(true);
    });

    it('should generate LOAD_VAR for local word variable', () => {
      const source = `
        module test
        function useLocal(): word
          let counter: word = 1000
          return counter
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('useLocal');
      const loadInstrs = getLoadVarInstructions(func!);

      expect(loadInstrs.some((l) => l.variableName === 'counter')).toBe(true);
    });

    it('should generate multiple LOAD_VAR for multiple local variables', () => {
      const source = `
        module test
        function useMultiple(): byte
          let a: byte = 1
          let b: byte = 2
          let c: byte = a
          return b
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('useMultiple');
      const loadInstrs = getLoadVarInstructions(func!);

      // Should have LOAD_VAR for a (when assigned to c) and b (returned)
      expect(loadInstrs.some((l) => l.variableName === 'a')).toBe(true);
      expect(loadInstrs.some((l) => l.variableName === 'b')).toBe(true);
    });

    it('should handle local variable in expression', () => {
      const source = `
        module test
        function compute(): byte
          let value: byte = 5
          let result: byte = value + 1
          return result
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('compute');
      const loadInstrs = getLoadVarInstructions(func!);

      expect(loadInstrs.some((l) => l.variableName === 'value')).toBe(true);
    });

    it('should handle local variable in conditional', () => {
      const source = `
        module test
        function conditional(): byte
          let flag: byte = 1
          if flag then
            return 10
          end if
          return 0
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('conditional');
      expect(func).toBeDefined();
    });
  });

  // ===========================================================================
  // Function Parameter References
  // ===========================================================================

  describe('function parameter references', () => {
    it('should handle single byte parameter', () => {
      const source = `
        module test
        function identity(x: byte): byte
          return x
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('identity');
      expect(func).toBeDefined();

      // Function should have parameter
      expect(func!.parameters.length).toBe(1);
    });

    it('should handle single word parameter', () => {
      const source = `
        module test
        function identity(addr: word): word
          return addr
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('identity');
      expect(func!.parameters.length).toBe(1);
    });

    it('should handle multiple parameters', () => {
      const source = `
        module test
        function add(a: byte, b: byte): byte
          return a
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('add');
      expect(func!.parameters.length).toBe(2);
    });

    it('should handle mixed type parameters', () => {
      const source = `
        module test
        function mixed(value: byte, address: word): byte
          return value
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('mixed');
      expect(func!.parameters.length).toBe(2);
    });

    it('should handle parameter in expression', () => {
      const source = `
        module test
        function increment(x: byte): byte
          return x + 1
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('increment');
      expect(func).toBeDefined();
    });

    it('should handle multiple parameters in expression', () => {
      const source = `
        module test
        function sum(a: byte, b: byte, c: byte): byte
          let result: byte = a + b
          return result
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('sum');
      expect(func!.parameters.length).toBe(3);
    });
  });

  // ===========================================================================
  // Variable Scope Resolution
  // ===========================================================================

  describe('variable scope resolution', () => {
    it('should handle variable in inner block', () => {
      const source = `
        module test
        function scopeTest(): byte
          let outer: byte = 10
          if true then
            let inner: byte = 20
            return inner
          end if
          return outer
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('scopeTest');
      expect(func).toBeDefined();
    });

    it('should handle variable in loop body', () => {
      const source = `
        module test
        function loopScope(): byte
          let sum: byte = 0
          for i = 0 to 5
            let temp: byte = 1
          next i
          return sum
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('loopScope');
      expect(func).toBeDefined();
    });

    it('should handle variable shadowing (outer variable)', () => {
      const source = `
        module test
        function shadow(): byte
          let x: byte = 10
          return x
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('shadow');
      const loadInstrs = getLoadVarInstructions(func!);

      expect(loadInstrs.some((l) => l.variableName === 'x')).toBe(true);
    });
  });

  // ===========================================================================
  // Identifier in Different Contexts
  // ===========================================================================

  describe('identifier in different contexts', () => {
    it('should handle identifier in binary expression', () => {
      const source = `
        module test
        function compute(a: byte, b: byte): byte
          return a + b
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('compute');
      expect(func).toBeDefined();
    });

    it('should handle identifier in comparison', () => {
      const source = `
        module test
        function compare(x: byte): bool
          return x > 10
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('compare');
      expect(func).toBeDefined();
    });

    it('should handle identifier as array index', () => {
      const source = `
        module test
        function indexTest(): byte
          let i: byte = 0
          let arr: byte[10]
          return arr[i]
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('indexTest');
      expect(func).toBeDefined();
    });

    it('should handle identifier in assignment target', () => {
      const source = `
        module test
        function assign(): byte
          let x: byte = 0
          x = 10
          return x
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('assign');
      expect(func).toBeDefined();
    });

    it('should handle identifier in compound assignment', () => {
      const source = `
        module test
        function compound(): byte
          let x: byte = 5
          x += 3
          return x
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('compound');
      expect(func).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle single-letter variable names', () => {
      const source = `
        module test
        function singleLetter(): byte
          let a: byte = 1
          let b: byte = 2
          return a
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('singleLetter');
      expect(func).toBeDefined();
    });

    it('should handle long variable names', () => {
      const source = `
        module test
        function longNames(): byte
          let myVeryLongVariableName: byte = 100
          return myVeryLongVariableName
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('longNames');
      const loadInstrs = getLoadVarInstructions(func!);

      expect(loadInstrs.some((l) => l.variableName === 'myVeryLongVariableName')).toBe(true);
    });

    it('should handle variable names with underscores', () => {
      const source = `
        module test
        function underscores(): byte
          let my_var: byte = 42
          return my_var
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('underscores');
      const loadInstrs = getLoadVarInstructions(func!);

      expect(loadInstrs.some((l) => l.variableName === 'my_var')).toBe(true);
    });

    it('should handle variable names with numbers', () => {
      const source = `
        module test
        function withNumbers(): byte
          let var1: byte = 1
          let var2: byte = 2
          return var1
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('withNumbers');
      const loadInstrs = getLoadVarInstructions(func!);

      expect(loadInstrs.some((l) => l.variableName === 'var1')).toBe(true);
    });

    it('should handle multiple uses of same variable', () => {
      const source = `
        module test
        function multiUse(): byte
          let x: byte = 10
          let a: byte = x
          let b: byte = x
          return x
        end function
      `;
      const program = parseSource(source);
      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('multiUse');
      const loadInstrs = getLoadVarInstructions(func!);

      // Should have multiple LOAD_VAR for x
      const xLoads = loadInstrs.filter((l) => l.variableName === 'x');
      expect(xLoads.length).toBeGreaterThanOrEqual(2);
    });
  });
});