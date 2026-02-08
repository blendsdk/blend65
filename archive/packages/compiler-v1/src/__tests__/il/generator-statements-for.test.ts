/**
 * IL Statement Generator Tests - For Statements
 *
 * Tests for ILStatementGenerator for loop handling.
 *
 * @module __tests__/il/generator-statements-for.test
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

describe('ILStatementGenerator - for statements', () => {
  let generator: ILStatementGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  it('should generate basic for loop structure', () => {
    // For loop is lowered to while: init, header, body, incr, exit
    const source = `
      module test
      function testFor() {
        for (i = 0 to 10) {
          let x: byte = 1;
        }
      }
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
      function forLabels() {
        for (i = 0 to 5) {
          let a: byte = 0;
        }
      }
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
      function nestedFor() {
        for (i = 0 to 5) {
          for (j = 0 to 5) {
            let x: byte = 1;
          }
        }
      }
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
      function forTerminators() {
        for (i = 0 to 10) {
          let x: byte = 1;
        }
      }
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
      function emptyFor() {
        for (i = 0 to 10) {
        }
      }
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
      function forThenMore() {
        for (i = 0 to 5) {
          let x: byte = 1;
        }
        let y: byte = 2;
      }
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
      function multiFor() {
        for (i = 0 to 5) {
          let a: byte = 1;
        }
        for (j = 0 to 3) {
          let b: byte = 2;
        }
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('multiFor');

    // Two for loops create many blocks
    expect(func!.getBlockCount()).toBeGreaterThanOrEqual(8);
  });
});