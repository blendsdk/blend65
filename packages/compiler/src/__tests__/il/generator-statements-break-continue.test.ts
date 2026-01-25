/**
 * IL Statement Generator Tests - Break and Continue Statements
 *
 * Tests for ILStatementGenerator break and continue statement handling.
 *
 * @module __tests__/il/generator-statements-break-continue.test
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

describe('ILStatementGenerator - break and continue statements', () => {
  let generator: ILStatementGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  it('should generate break in while loop', () => {
    const source = `
      module test
      function testBreak() {
        while (true) {
          break;
        }
      }
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
      function testContinue() {
        while (true) {
          continue;
        }
      }
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
      function forBreak() {
        for (i = 0 to 10) {
          break;
        }
      }
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
      function forContinue() {
        for (i = 0 to 10) {
          continue;
        }
      }
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
      function nestedBreak() {
        while (true) {
          while (true) {
            break;
          }
        }
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('nestedBreak');

    // Nested loops create multiple blocks
    expect(func!.getBlockCount()).toBeGreaterThanOrEqual(6);
  });
});