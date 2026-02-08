/**
 * IL Statement Generator Tests - While Statements
 *
 * Tests for ILStatementGenerator while loop handling.
 *
 * @module __tests__/il/generator-statements-while.test
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

describe('ILStatementGenerator - while statements', () => {
  let generator: ILStatementGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  it('should generate basic while loop structure', () => {
    // While loop creates header, body, and exit blocks
    const source = `
      module test
      function testWhile() {
        while (true) {
          let x: byte = 1;
        }
      }
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
      function whileLabels() {
        while (true) {
          let a: byte = 0;
        }
      }
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
      function nestedWhile() {
        while (true) {
          while (true) {
            let x: byte = 1;
          }
        }
      }
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
      function whileTerminators() {
        while (true) {
          let x: byte = 1;
        }
      }
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
      function emptyWhile() {
        while (true) {
        }
      }
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
      function whileWithVar() {
        while (true) {
          let counter: byte = 0;
          let value: byte = 10;
        }
      }
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
      function whileThenMore() {
        while (true) {
          let x: byte = 1;
        }
        let y: byte = 2;
      }
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
      function multiWhile() {
        while (true) {
          let a: byte = 1;
        }
        while (true) {
          let b: byte = 2;
        }
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('multiWhile');

    // Two while loops create many blocks
    expect(func!.getBlockCount()).toBeGreaterThanOrEqual(6);
  });
});