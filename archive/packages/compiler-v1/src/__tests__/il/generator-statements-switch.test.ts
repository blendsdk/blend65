/**
 * IL Statement Generator Tests - Switch Statements
 *
 * Tests for ILStatementGenerator switch statement handling.
 *
 * @module __tests__/il/generator-statements-switch.test
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

describe('ILStatementGenerator - switch statements', () => {
  let generator: ILStatementGenerator;

  beforeEach(() => {
    generator = createGenerator();
  });

  it('should generate basic switch structure', () => {
    // Switch statement lowers to if-else chain comparisons
    const source = `
      module test
      function testSwitch() {
        let x: byte = 1;
        switch (x) {
          case 0:
            let a: byte = 0;
          case 1:
            let b: byte = 1;
        }
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('testSwitch');
    expect(func).toBeDefined();

    // Switch creates multiple comparison/body blocks
    expect(func!.getBlockCount()).toBeGreaterThanOrEqual(3);
  });

  it('should generate switch with default case', () => {
    const source = `
      module test
      function switchWithDefault() {
        let x: byte = 5;
        switch (x) {
          case 0:
            let a: byte = 0;
          default:
            let d: byte = 255;
        }
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('switchWithDefault');
    expect(func).toBeDefined();
  });

  it('should generate switch with multiple cases', () => {
    const source = `
      module test
      function multiSwitch() {
        let x: byte = 2;
        switch (x) {
          case 0:
            let a: byte = 0;
          case 1:
            let b: byte = 1;
          case 2:
            let c: byte = 2;
          default:
            let d: byte = 3;
        }
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('multiSwitch');

    // Multiple cases create multiple blocks
    expect(func!.getBlockCount()).toBeGreaterThanOrEqual(5);
  });

  it('should ensure all switch blocks have terminators', () => {
    const source = `
      module test
      function switchTerminators() {
        let x: byte = 1;
        switch (x) {
          case 0:
            let a: byte = 0;
          case 1:
            let b: byte = 1;
        }
      }
    `;
    const program = parseSource(source);

    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    const func = result.module.getFunction('switchTerminators');

    // All blocks should have terminators
    const blocks = func!.getBlocks();
    for (const block of blocks) {
      expect(block.hasTerminator()).toBe(true);
    }
  });
});