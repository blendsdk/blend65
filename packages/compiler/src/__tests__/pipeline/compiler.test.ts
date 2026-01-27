/**
 * Tests for the main Compiler class
 *
 * Verifies that the Compiler class correctly orchestrates
 * the complete compilation pipeline.
 *
 * @module tests/pipeline/compiler
 */

import { describe, it, expect } from 'vitest';

import { Compiler, formatDiagnostics, formatDiagnostic } from '../../compiler.js';
import { getDefaultConfig } from '../../config/defaults.js';
import type { Blend65Config } from '../../config/types.js';
import { DiagnosticCode, DiagnosticSeverity } from '../../ast/diagnostics.js';

describe('Compiler', () => {
  /**
   * Creates a minimal valid configuration
   */
  function createConfig(overrides: Partial<Blend65Config> = {}): Blend65Config {
    const base = getDefaultConfig();
    return {
      ...base,
      ...overrides,
      compilerOptions: {
        ...base.compilerOptions,
        ...(overrides.compilerOptions || {}),
      },
    };
  }

  describe('compileSource() - basic compilation', () => {
    it('should compile empty source', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', '']]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config);

      // Empty source should parse and analyze successfully
      expect(result.phases.parse?.success).toBe(true);
    });

    it('should compile simple variable declaration', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', 'let x: byte = 10;']]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config);

      expect(result.phases.parse?.success).toBe(true);
    });
  });

  describe('compileSource() - multiple files', () => {
    it('should compile multiple source files', () => {
      const compiler = new Compiler();
      const sources = new Map([
        ['main.blend', 'let a: byte = 1;'],
        ['utils.blend', 'let b: byte = 2;'],
      ]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config);

      expect(result.phases.parse?.success).toBe(true);
      // Result includes both user sources AND auto-loaded standard library files
      // So we check that there are at least 2 programs (the user's source files)
      expect(result.phases.parse?.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('compileSource() - stopAfterPhase', () => {
    it('should stop after parse phase', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', 'let x: byte = 10;']]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config, 'parse');

      expect(result.phases.parse).toBeDefined();
      expect(result.phases.semantic).toBeUndefined();
      expect(result.output).toBeUndefined();
    });

    it('should stop after semantic phase', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', 'let x: byte = 10;']]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config, 'semantic');

      expect(result.phases.parse).toBeDefined();
      expect(result.phases.semantic).toBeDefined();
      expect(result.phases.il).toBeUndefined();
    });
  });

  describe('compileSource() - error handling', () => {
    it('should report parse errors', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', 'let x: byte = ;']]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config);

      // Parse phase should have diagnostics
      expect(result.phases.parse?.diagnostics.length).toBeGreaterThan(0);
    });

    it('should not produce output on failure', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', 'let x: byte = ;']]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config);

      if (!result.success) {
        expect(result.output).toBeUndefined();
      }
    });
  });

  describe('compileSource() - target validation', () => {
    it('should accept c64 target', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', '']]);
      const config = createConfig({
        compilerOptions: { target: 'c64' },
      });

      const result = compiler.compileSource(sources, config);

      expect(result.target.architecture).toBe('c64');
    });

    it('should reject invalid target', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', '']]);
      const config = createConfig({
        compilerOptions: { target: 'invalid' as 'c64' },
      });

      const result = compiler.compileSource(sources, config);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some((d) => d.message.includes('Invalid target') || d.message.includes('target'))).toBe(
        true
      );
    });

    it('should reject unimplemented target', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', '']]);
      const config = createConfig({
        compilerOptions: { target: 'c128' },
      });

      const result = compiler.compileSource(sources, config);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some((d) => d.message.includes('not implemented'))).toBe(true);
    });
  });

  describe('compileSource() - timing', () => {
    it('should track total compilation time', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', 'let x: byte = 10;']]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config);

      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.totalTimeMs).toBe('number');
    });

    it('should track phase times', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', 'let x: byte = 10;']]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config);

      if (result.phases.parse) {
        expect(result.phases.parse.timeMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('compileSource() - @map declarations', () => {
    it('should compile @map declarations', () => {
      const compiler = new Compiler();
      const source = '@map borderColor at $D020: byte;';
      const sources = new Map([['main.blend', source]]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config);

      expect(result.phases.parse?.success).toBe(true);
    });
  });

  describe('compileSource() - result structure', () => {
    it('should return CompilationResult', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', '']]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('diagnostics');
      expect(result).toHaveProperty('phases');
      expect(result).toHaveProperty('totalTimeMs');
      expect(result).toHaveProperty('target');
    });

    it('should include target config', () => {
      const compiler = new Compiler();
      const sources = new Map([['main.blend', '']]);
      const config = createConfig();

      const result = compiler.compileSource(sources, config);

      expect(result.target).toBeDefined();
      expect(result.target.architecture).toBe('c64');
    });
  });
});

describe('formatDiagnostics', () => {
  it('should format empty diagnostics', () => {
    const formatted = formatDiagnostics([]);

    expect(formatted).toBe('No diagnostics.');
  });

  it('should format single diagnostic', () => {
    const diagnostics = [
      {
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: 'Type mismatch',
        location: {
          source: 'test.blend',
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 5, offset: 4 },
        },
      },
    ];

    const formatted = formatDiagnostics(diagnostics);

    expect(formatted).toContain('Type mismatch');
    expect(formatted).toContain('test.blend');
    expect(formatted).toContain('1:1');
  });

  it('should format multiple diagnostics', () => {
    const diagnostics = [
      {
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: 'First error',
        location: {
          source: 'test.blend',
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 5, offset: 4 },
        },
      },
      {
        code: DiagnosticCode.UNDEFINED_IDENTIFIER,
        severity: DiagnosticSeverity.ERROR,
        message: 'Second error',
        location: {
          source: 'test.blend',
          start: { line: 2, column: 1, offset: 10 },
          end: { line: 2, column: 5, offset: 14 },
        },
      },
    ];

    const formatted = formatDiagnostics(diagnostics);

    expect(formatted).toContain('First error');
    expect(formatted).toContain('Second error');
  });

  it('should sort diagnostics by file then line', () => {
    const diagnostics = [
      {
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: 'B error',
        location: {
          source: 'b.blend',
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
        },
      },
      {
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: 'A error',
        location: {
          source: 'a.blend',
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
        },
      },
    ];

    const formatted = formatDiagnostics(diagnostics);

    // 'a.blend' should come before 'b.blend'
    const aIndex = formatted.indexOf('A error');
    const bIndex = formatted.indexOf('B error');
    expect(aIndex).toBeLessThan(bIndex);
  });
});

describe('formatDiagnostic', () => {
  it('should format error diagnostic', () => {
    const diagnostic = {
      code: DiagnosticCode.TYPE_MISMATCH,
      severity: DiagnosticSeverity.ERROR,
      message: 'Type mismatch error',
      location: {
        source: 'test.blend',
        start: { line: 5, column: 10, offset: 50 },
        end: { line: 5, column: 15, offset: 55 },
      },
    };

    const formatted = formatDiagnostic(diagnostic);

    expect(formatted).toContain('error');
    expect(formatted).toContain('Type mismatch error');
    expect(formatted).toContain('test.blend');
    expect(formatted).toContain('5:10');
  });

  it('should format warning diagnostic', () => {
    const diagnostic = {
      code: DiagnosticCode.TYPE_MISMATCH,
      severity: DiagnosticSeverity.WARNING,
      message: 'A warning',
      location: {
        source: 'test.blend',
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
    };

    const formatted = formatDiagnostic(diagnostic);

    expect(formatted).toContain('warning');
    expect(formatted).toContain('A warning');
  });

  it('should include location information', () => {
    const diagnostic = {
      code: DiagnosticCode.TYPE_MISMATCH,
      severity: DiagnosticSeverity.ERROR,
      message: 'Error message',
      location: {
        source: 'myfile.blend',
        start: { line: 10, column: 5, offset: 100 },
        end: { line: 10, column: 10, offset: 105 },
      },
    };

    const formatted = formatDiagnostic(diagnostic);

    expect(formatted).toContain('myfile.blend:10:5');
  });
});