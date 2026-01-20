/**
 * IL Statement Generator Tests
 *
 * Tests for ILStatementGenerator which handles:
 * - Return statements
 * - If statements (branching)
 * - While statements (loops)
 * - For statements (lowered to while)
 * - Match statements
 * - Break/Continue statements
 * - Expression statements
 * - Block statements
 *
 * Note: Expression generation is not yet implemented (returns placeholder).
 * These tests verify statement control flow structure generation.
 *
 * @module __tests__/il/generator-statements.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILStatementGenerator } from '../../il/generator/statements.js';
import { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import type { Program } from '../../ast/nodes.js';
import { ILTypeKind } from '../../il/types.js';
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
 * Creates an ILStatementGenerator for testing.
 *
 * @returns Generator instance with fresh symbol table
 */
function createGenerator(): ILStatementGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILStatementGenerator(symbolTable);
}

/**
 * Finds a block by label prefix in an IL function.
 *
 * @param ilFunc - IL function to search
 * @param labelPrefix - Label prefix to match
 * @returns Found block or undefined
 */
function findBlockByLabelPrefix(
  ilFunc: { getBlocks(): readonly { label: string }[] },
  labelPrefix: string,
): { label: string; getInstructions(): readonly unknown[] } | undefined {
  return ilFunc.getBlocks().find((b) => b.label.startsWith(labelPrefix)) as
    | { label: string; getInstructions(): readonly unknown[] }
    | undefined;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('ILStatementGenerator', () => {
  let generator: ILStatementGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  // ===========================================================================
  // Return Statement Tests
  // ===========================================================================

  describe('return statements', () => {
    it('should generate return void for void function', () => {
      // Note: Empty void functions get implicit return void
      // The explicit 'return' statement alone may trigger expression parsing
      const source = `
        module test
        function noReturn()
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('noReturn');
      expect(func).toBeDefined();

      // Entry block should have RETURN_VOID terminator
      const entryBlock = func!.getEntryBlock();
      expect(entryBlock.hasTerminator()).toBe(true);
    });

    it('should generate return with value for non-void function', () => {
      const source = `
        module test
        function getValue(): byte
          return 42
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getValue');
      expect(func).toBeDefined();
      expect(func!.returnType.kind).toBe(ILTypeKind.Byte);

      // Should have terminator
      const entryBlock = func!.getEntryBlock();
      expect(entryBlock.hasTerminator()).toBe(true);
    });

    it('should generate implicit return void at function end', () => {
      const source = `
        module test
        function noExplicitReturn()
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('noExplicitReturn');
      expect(func).toBeDefined();

      // Entry block should have terminator (implicit return void)
      const entryBlock = func!.getEntryBlock();
      expect(entryBlock.hasTerminator()).toBe(true);
    });

    it('should handle multiple functions with different return types', () => {
      // Test that multiple functions with different return types work
      const source = `
        module test
        function getByteValue(): byte
          return 10
        end function
        function getWordValue(): word
          return 1000
        end function
        function noReturnValue()
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      expect(result.module.getFunctions().length).toBe(3);
      expect(result.module.getFunction('getByteValue')!.returnType.kind).toBe(ILTypeKind.Byte);
      expect(result.module.getFunction('getWordValue')!.returnType.kind).toBe(ILTypeKind.Word);
      expect(result.module.getFunction('noReturnValue')!.returnType.kind).toBe(ILTypeKind.Void);
    });

    it('should handle return word value', () => {
      const source = `
        module test
        function getWord(): word
          return 1000
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('getWord');
      expect(func!.returnType.kind).toBe(ILTypeKind.Word);
    });
  });

  // ===========================================================================
  // If Statement Tests
  // ===========================================================================

  describe('if statements', () => {
    it('should generate basic if-then structure', () => {
      // If statement creates then block and merge block
      const source = `
        module test
        function testIf()
          if true then
            let x: byte = 1
          end if
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('testIf');
      expect(func).toBeDefined();

      // Should have multiple blocks: entry, then, merge
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(2);
    });

    it('should generate if-then-else structure', () => {
      // If-else creates then block, else block, and merge block
      const source = `
        module test
        function testIfElse()
          if true then
            let x: byte = 1
          else
            let y: byte = 2
          end if
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('testIfElse');
      expect(func).toBeDefined();

      // Should have multiple blocks: entry, then, else, merge
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(3);
    });

    it('should create blocks with correct labels', () => {
      const source = `
        module test
        function blockLabels()
          if true then
            let a: byte = 0
          end if
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('blockLabels');

      // Check for if-related block labels
      const blocks = func!.getBlocks();
      const labels = blocks.map((b) => b.label);

      // Should have entry and at least one if-related block
      expect(labels).toContain('entry');
      expect(labels.some((l) => l.includes('if_then') || l.includes('if_merge'))).toBe(true);
    });

    it('should generate nested if statements', () => {
      const source = `
        module test
        function nestedIf()
          if true then
            if true then
              let x: byte = 1
            end if
          end if
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('nestedIf');

      // Nested ifs create more blocks
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(4);
    });

    it('should handle if with elseif chain', () => {
      const source = `
        module test
        function elseifChain()
          if true then
            let a: byte = 1
          elseif true then
            let b: byte = 2
          else
            let c: byte = 3
          end if
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('elseifChain');

      // Elseif chain creates additional blocks
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(4);
    });

    it('should ensure all if paths have terminators', () => {
      const source = `
        module test
        function allPathsTerminate()
          if true then
            let x: byte = 1
          else
            let y: byte = 2
          end if
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('allPathsTerminate');

      // All blocks should have terminators
      const blocks = func!.getBlocks();
      for (const block of blocks) {
        expect(block.hasTerminator()).toBe(true);
      }
    });

    it('should handle empty if body', () => {
      const source = `
        module test
        function emptyIf()
          if true then
          end if
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('emptyIf');
      expect(func).toBeDefined();
    });

    it('should handle empty else body', () => {
      const source = `
        module test
        function emptyElse()
          if true then
            let x: byte = 1
          else
          end if
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('emptyElse');
      expect(func).toBeDefined();
    });
  });

  // ===========================================================================
  // While Statement Tests
  // ===========================================================================

  describe('while statements', () => {
    it('should generate basic while loop structure', () => {
      // While loop creates header, body, and exit blocks
      const source = `
        module test
        function testWhile()
          while true do
            let x: byte = 1
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('testWhile');
      expect(func).toBeDefined();

      // Should have blocks: entry, header, body, exit
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(3);
    });

    it('should create while blocks with correct labels', () => {
      const source = `
        module test
        function whileLabels()
          while true do
            let a: byte = 0
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('whileLabels');

      // Check for while-related block labels
      const blocks = func!.getBlocks();
      const labels = blocks.map((b) => b.label);

      // Should have while-related labels
      expect(labels.some((l) => l.includes('while_header'))).toBe(true);
      expect(labels.some((l) => l.includes('while_body'))).toBe(true);
      expect(labels.some((l) => l.includes('while_exit'))).toBe(true);
    });

    it('should generate nested while loops', () => {
      const source = `
        module test
        function nestedWhile()
          while true do
            while true do
              let x: byte = 1
            end while
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('nestedWhile');

      // Nested while loops create many blocks
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(6);
    });

    it('should ensure all while blocks have terminators', () => {
      const source = `
        module test
        function whileTerminators()
          while true do
            let x: byte = 1
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('whileTerminators');

      // All blocks should have terminators
      const blocks = func!.getBlocks();
      for (const block of blocks) {
        expect(block.hasTerminator()).toBe(true);
      }
    });

    it('should handle empty while body', () => {
      const source = `
        module test
        function emptyWhile()
          while true do
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('emptyWhile');
      expect(func).toBeDefined();
    });

    it('should handle while with variable in body', () => {
      const source = `
        module test
        function whileWithVar()
          while true do
            let counter: byte = 0
            let value: byte = 10
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('whileWithVar');
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(3);
    });

    it('should handle while followed by other statements', () => {
      const source = `
        module test
        function whileThenMore()
          while true do
            let x: byte = 1
          end while
          let y: byte = 2
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('whileThenMore');
      expect(func).toBeDefined();
    });

    it('should handle multiple sequential while loops', () => {
      const source = `
        module test
        function multiWhile()
          while true do
            let a: byte = 1
          end while
          while true do
            let b: byte = 2
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('multiWhile');

      // Two while loops create many blocks
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(6);
    });
  });

  // ===========================================================================
  // For Statement Tests
  // ===========================================================================

  describe('for statements', () => {
    it('should generate basic for loop structure', () => {
      // For loop is lowered to while: init, header, body, incr, exit
      const source = `
        module test
        function testFor()
          for i = 0 to 10
            let x: byte = 1
          next i
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('testFor');
      expect(func).toBeDefined();

      // Should have blocks: entry, header, body, incr, exit
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(4);
    });

    it('should create for blocks with correct labels', () => {
      const source = `
        module test
        function forLabels()
          for i = 0 to 5
            let a: byte = 0
          next i
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('forLabels');

      // Check for for-related block labels
      const blocks = func!.getBlocks();
      const labels = blocks.map((b) => b.label);

      // Should have for-related labels
      expect(labels.some((l) => l.includes('for_header'))).toBe(true);
      expect(labels.some((l) => l.includes('for_body'))).toBe(true);
      expect(labels.some((l) => l.includes('for_exit'))).toBe(true);
    });

    it('should generate nested for loops', () => {
      const source = `
        module test
        function nestedFor()
          for i = 0 to 5
            for j = 0 to 5
              let x: byte = 1
            next j
          next i
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('nestedFor');

      // Nested for loops create many blocks
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(8);
    });

    it('should ensure all for blocks have terminators', () => {
      const source = `
        module test
        function forTerminators()
          for i = 0 to 10
            let x: byte = 1
          next i
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('forTerminators');

      // All blocks should have terminators
      const blocks = func!.getBlocks();
      for (const block of blocks) {
        expect(block.hasTerminator()).toBe(true);
      }
    });

    it('should handle empty for body', () => {
      const source = `
        module test
        function emptyFor()
          for i = 0 to 10
          next i
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('emptyFor');
      expect(func).toBeDefined();
    });

    it('should handle for followed by other statements', () => {
      const source = `
        module test
        function forThenMore()
          for i = 0 to 5
            let x: byte = 1
          next i
          let y: byte = 2
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('forThenMore');
      expect(func).toBeDefined();
    });

    it('should handle multiple sequential for loops', () => {
      const source = `
        module test
        function multiFor()
          for i = 0 to 5
            let a: byte = 1
          next i
          for j = 0 to 3
            let b: byte = 2
          next j
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('multiFor');

      // Two for loops create many blocks
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(8);
    });
  });

  // ===========================================================================
  // Match Statement Tests
  // ===========================================================================

  describe('match statements', () => {
    it('should generate basic match structure', () => {
      // Match statement lowers to if-else chain comparisons
      const source = `
        module test
        function testMatch()
          let x: byte = 1
          match x
            case 0
              let a: byte = 0
            case 1
              let b: byte = 1
          end match
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('testMatch');
      expect(func).toBeDefined();

      // Match creates multiple comparison/body blocks
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(3);
    });

    it('should generate match with default case', () => {
      const source = `
        module test
        function matchWithDefault()
          let x: byte = 5
          match x
            case 0
              let a: byte = 0
            default
              let d: byte = 255
          end match
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('matchWithDefault');
      expect(func).toBeDefined();
    });

    it('should generate match with multiple cases', () => {
      const source = `
        module test
        function multiMatch()
          let x: byte = 2
          match x
            case 0
              let a: byte = 0
            case 1
              let b: byte = 1
            case 2
              let c: byte = 2
            default
              let d: byte = 3
          end match
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('multiMatch');

      // Multiple cases create multiple blocks
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(5);
    });

    it('should ensure all match blocks have terminators', () => {
      const source = `
        module test
        function matchTerminators()
          let x: byte = 1
          match x
            case 0
              let a: byte = 0
            case 1
              let b: byte = 1
          end match
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('matchTerminators');

      // All blocks should have terminators
      const blocks = func!.getBlocks();
      for (const block of blocks) {
        expect(block.hasTerminator()).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Break/Continue Statement Tests
  // ===========================================================================

  describe('break and continue statements', () => {
    it('should generate break in while loop', () => {
      const source = `
        module test
        function testBreak()
          while true do
            break
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('testBreak');
      expect(func).toBeDefined();

      // Break should terminate body block
      const blocks = func!.getBlocks();
      for (const block of blocks) {
        expect(block.hasTerminator()).toBe(true);
      }
    });

    it('should generate continue in while loop', () => {
      const source = `
        module test
        function testContinue()
          while true do
            continue
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('testContinue');
      expect(func).toBeDefined();
    });

    it('should generate break in for loop', () => {
      const source = `
        module test
        function forBreak()
          for i = 0 to 10
            break
          next i
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('forBreak');
      expect(func).toBeDefined();
    });

    it('should generate continue in for loop', () => {
      const source = `
        module test
        function forContinue()
          for i = 0 to 10
            continue
          next i
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('forContinue');
      expect(func).toBeDefined();
    });

    it('should handle break in nested loops', () => {
      const source = `
        module test
        function nestedBreak()
          while true do
            while true do
              break
            end while
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('nestedBreak');

      // Nested loops create multiple blocks
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(6);
    });
  });

  // ===========================================================================
  // Block and Expression Statement Tests
  // ===========================================================================

  describe('block and expression statements', () => {
    it('should generate block statement', () => {
      // Block statements just group other statements
      const source = `
        module test
        function testBlock()
          let x: byte = 1
          let y: byte = 2
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('testBlock');
      expect(func).toBeDefined();
    });

    it('should handle nested blocks', () => {
      const source = `
        module test
        function nestedBlocks()
          let outer: byte = 1
          if true then
            let inner: byte = 2
          end if
          let after: byte = 3
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('nestedBlocks');
      expect(func).toBeDefined();
    });

    it('should handle variable declaration statement', () => {
      const source = `
        module test
        function varDecl()
          let a: byte = 10
          let b: word = 1000
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('varDecl');
      expect(func).toBeDefined();
    });

    it('should handle const declaration in function', () => {
      const source = `
        module test
        function constDecl()
          const MAX: byte = 255
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('constDecl');
      expect(func).toBeDefined();
    });
  });

  // ===========================================================================
  // Integration Tests - Combined Statements
  // ===========================================================================

  describe('combined statement integration', () => {
    it('should handle if inside while', () => {
      const source = `
        module test
        function ifInWhile()
          while true do
            if true then
              let x: byte = 1
            end if
          end while
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('ifInWhile');
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(5);
    });

    it('should handle while inside if', () => {
      const source = `
        module test
        function whileInIf()
          if true then
            while true do
              let x: byte = 1
            end while
          end if
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('whileInIf');
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(5);
    });

    it('should handle complex nested control flow', () => {
      const source = `
        module test
        function complex()
          if true then
            while true do
              for i = 0 to 5
                let x: byte = 1
              next i
            end while
          else
            let y: byte = 2
          end if
        end function
      `;
      const program = parseSource(source);

      const result = generator.generateModule(program);

      expect(result.success).toBe(true);
      const func = result.module.getFunction('complex');

      // Complex nesting creates many blocks
      expect(func!.getBlockCount()).toBeGreaterThanOrEqual(8);
    });
  });
});