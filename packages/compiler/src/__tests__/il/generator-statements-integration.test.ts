/**
 * IL Statement Generator Tests - Combined Statement Integration
 *
 * Integration tests for ILStatementGenerator with combined statements.
 *
 * @module __tests__/il/generator-statements-integration.test
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

describe('ILStatementGenerator - combined statement integration', () => {
  let generator: ILStatementGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  it('should handle if inside while', () => {
    const source = `
      module test
      function ifInWhile() {
        while (true) {
          if (true) {
            let x: byte = 1;
          }
        }
      }
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
      function whileInIf() {
        if (true) {
          while (true) {
            let x: byte = 1;
          }
        }
      }
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
      function complex() {
        if (true) {
          while (true) {
            for (i = 0 to 5) {
              let x: byte = 1;
            }
          }
        } else {
          let y: byte = 2;
        }
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('complex');

    // Complex nesting creates many blocks
    expect(func!.getBlockCount()).toBeGreaterThanOrEqual(8);
  });
});