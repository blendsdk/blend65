/**
 * IL Statement Generator Tests - Block and Expression Statements
 *
 * Tests for ILStatementGenerator block and expression statement handling.
 *
 * @module __tests__/il/generator-statements-block.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILStatementGenerator } from '../../il/generator/statements.js';
import { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import type { Program } from '../../ast/nodes.js';

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

describe('ILStatementGenerator - block and expression statements', () => {
  let generator: ILStatementGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  it('should generate block statement', () => {
    // Block statements just group other statements
    const source = `
      module test
      function testBlock() {
        let x: byte = 1;
        let y: byte = 2;
      }
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
      function nestedBlocks() {
        let outer: byte = 1;
        if (true) {
          let inner: byte = 2;
        }
        let after: byte = 3;
      }
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
      function varDecl() {
        let a: byte = 10;
        let b: word = 1000;
      }
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
      function constDecl() {
        const MAX: byte = 255;
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('constDecl');
    expect(func).toBeDefined();
  });
});