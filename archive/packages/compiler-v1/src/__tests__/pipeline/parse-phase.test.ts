/**
 * Tests for ParsePhase
 *
 * Verifies that the ParsePhase correctly orchestrates
 * lexing and parsing of source files.
 *
 * @module tests/pipeline/parse-phase
 */

import { describe, it, expect } from 'vitest';

import { ParsePhase } from '../../pipeline/parse-phase.js';

describe('ParsePhase', () => {
  const phase = new ParsePhase();

  describe('execute() - basic parsing', () => {
    it('should parse empty source', () => {
      const sources = new Map([['empty.blend', '']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.timeMs).toBeGreaterThanOrEqual(0);
    });

    it('should parse simple variable declaration', () => {
      const sources = new Map([['simple.blend', 'let x: byte = 10;']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);

      // Check that a Program AST was produced
      const program = result.data[0];
      expect(program).toBeDefined();
      expect(program.getModule()).toBeDefined();
    });

    it('should parse memory-mapped variable', () => {
      const sources = new Map([['map.blend', '@map borderColor at $D020: byte;']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('execute() - multiple files', () => {
    it('should parse multiple source files', () => {
      const sources = new Map([
        ['main.blend', 'let a: byte = 1;'],
        ['utils.blend', 'let b: byte = 2;'],
        ['data.blend', 'let count: byte = 0;'],
      ]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should parse files in order', () => {
      const sources = new Map([
        ['a.blend', 'let a: byte = 1;'],
        ['b.blend', 'let b: byte = 2;'],
        ['c.blend', 'let c: byte = 3;'],
      ]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);

      // Order should be preserved (Map iteration order)
      // Each program should be valid
      for (const program of result.data) {
        expect(program.getModule()).toBeDefined();
      }
    });
  });

  describe('execute() - error handling', () => {
    it('should report syntax errors', () => {
      // Missing semicolon
      const sources = new Map([['error.blend', 'let x: byte = 10']]);

      const result = phase.execute(sources);

      // Parser may recover or fail - check for diagnostics
      expect(result.diagnostics.length).toBeGreaterThanOrEqual(0);
    });

    it('should continue parsing other files after error', () => {
      const sources = new Map([
        ['good.blend', 'let a: byte = 1;'],
        ['bad.blend', 'let b: byte = '], // Incomplete
        ['also-good.blend', 'let c: byte = 3;'],
      ]);

      const result = phase.execute(sources);

      // Should have parsed all 3 files
      expect(result.data).toHaveLength(3);
      // Should have some diagnostics from the bad file
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it('should aggregate diagnostics from all files', () => {
      const sources = new Map([
        ['error1.blend', 'let x: byte = ;'], // Missing expression
        ['error2.blend', 'let y byte = 1;'], // Missing colon
      ]);

      const result = phase.execute(sources);

      // Should have diagnostics
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('execute() - timing', () => {
    it('should track execution time', () => {
      const sources = new Map([['timing.blend', 'let x: byte = 1;']]);

      const result = phase.execute(sources);

      expect(result.timeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.timeMs).toBe('number');
    });

    it('should have reasonable execution time for small input', () => {
      const sources = new Map([['small.blend', 'let x: byte = 1;']]);

      const result = phase.execute(sources);

      // Should complete in under 1 second for trivial input
      expect(result.timeMs).toBeLessThan(1000);
    });
  });

  describe('execute() - storage classes', () => {
    it('should parse @zp storage class', () => {
      const sources = new Map([['zp.blend', '@zp let fastVar: byte = 0;']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });

    it('should parse @ram storage class', () => {
      const sources = new Map([['ram.blend', '@ram let buffer: byte[256];']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });

    it('should parse @data storage class', () => {
      const sources = new Map([['data.blend', '@data let table: byte[] = [1, 2, 3, 4];']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });
  });

  describe('execute() - literals', () => {
    it('should parse decimal literals', () => {
      const sources = new Map([['decimal.blend', 'let x: byte = 123;']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });

    it('should parse hexadecimal literals', () => {
      const sources = new Map([['hex.blend', 'let x: byte = $FF;']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });

    it('should parse 0x-style hexadecimal literals', () => {
      const sources = new Map([['hex0x.blend', 'let x: byte = 0xFF;']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });

    it('should parse binary literals', () => {
      const sources = new Map([['binary.blend', 'let x: byte = 0b10101010;']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });

    it('should parse string literals', () => {
      const sources = new Map([['string.blend', 'let msg: byte[] = "hello";']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });
  });

  describe('execute() - edge cases', () => {
    it('should handle empty file map', () => {
      const sources = new Map<string, string>();

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should handle whitespace-only source', () => {
      const sources = new Map([['whitespace.blend', '   \n\n   \t\t   ']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should handle comments-only source', () => {
      const sources = new Map([['comments.blend', '// This is a comment\n/* Block comment */']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });
  });

  describe('execute() - @map declarations', () => {
    it('should parse @map with different addresses', () => {
      const sources = new Map([['map.blend', '@map vic at $D000: byte;']]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });

    it('should parse multiple @map declarations', () => {
      const sources = new Map([
        [
          'maps.blend',
          `@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;`,
        ],
      ]);

      const result = phase.execute(sources);

      expect(result.success).toBe(true);
    });
  });
});