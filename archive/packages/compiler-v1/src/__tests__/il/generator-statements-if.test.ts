/**
 * IL Statement Generator Tests - If Statements
 *
 * Tests for ILStatementGenerator if statement handling (branching).
 *
 * @module __tests__/il/generator-statements-if.test
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

describe('ILStatementGenerator - if statements', () => {
  let generator: ILStatementGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  it('should generate basic if-then structure', () => {
    // If statement creates then block and merge block
    const source = `
      module test
      function testIf() {
        if (true) {
          let x: byte = 1;
        }
      }
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
      function testIfElse() {
        if (true) {
          let x: byte = 1;
        } else {
          let y: byte = 2;
        }
      }
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
      function blockLabels() {
        if (true) {
          let a: byte = 0;
        }
      }
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
      function nestedIf() {
        if (true) {
          if (true) {
            let x: byte = 1;
          }
        }
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('nestedIf');

    // Nested ifs create more blocks
    expect(func!.getBlockCount()).toBeGreaterThanOrEqual(4);
  });

  it('should handle if with else if chain', () => {
    const source = `
      module test
      function elseifChain() {
        if (true) {
          let a: byte = 1;
        } else if (true) {
          let b: byte = 2;
        } else {
          let c: byte = 3;
        }
      }
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
      function allPathsTerminate() {
        if (true) {
          let x: byte = 1;
        } else {
          let y: byte = 2;
        }
      }
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
      function emptyIf() {
        if (true) {
        }
      }
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
      function emptyElse() {
        if (true) {
          let x: byte = 1;
        } else {
        }
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('emptyElse');
    expect(func).toBeDefined();
  });
});