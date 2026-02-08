/**
 * IL Statement Generator Tests - Return Statements
 *
 * Tests for ILStatementGenerator return statement handling.
 *
 * @module __tests__/il/generator-statements-return.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILStatementGenerator } from '../../il/generator/statements.js';
import { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import type { Program } from '../../ast/nodes.js';
import { ILTypeKind } from '../../il/types.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Parses Blend65 source code into an AST Program.
 */
function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Creates an ILStatementGenerator for testing.
 */
function createGenerator(): ILStatementGenerator {
  const symbolTable = new GlobalSymbolTable();
  return new ILStatementGenerator(symbolTable);
}

// =============================================================================
// Test Suite
// =============================================================================

describe('ILStatementGenerator - return statements', () => {
  let generator: ILStatementGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  it('should generate return void for void function', () => {
    // Note: Empty void functions get implicit return void
    const source = `
      module test
      function noReturn() {
      }
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
      function getValue(): byte {
        return 42;
      }
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
      function noExplicitReturn() {
      }
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
      function getByteValue(): byte {
        return 10;
      }
      function getWordValue(): word {
        return 1000;
      }
      function noReturnValue() {
      }
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
      function getWord(): word {
        return 1000;
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('getWord');
    expect(func!.returnType.kind).toBe(ILTypeKind.Word);
  });
});