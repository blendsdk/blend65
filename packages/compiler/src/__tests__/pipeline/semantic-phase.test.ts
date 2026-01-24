/**
 * Tests for SemanticPhase
 *
 * Verifies that the SemanticPhase correctly orchestrates
 * semantic analysis including type checking and symbol resolution.
 *
 * @module tests/pipeline/semantic-phase
 */

import { describe, it, expect } from 'vitest';

import { ParsePhase } from '../../pipeline/parse-phase.js';
import { SemanticPhase } from '../../pipeline/semantic-phase.js';

describe('SemanticPhase', () => {
  const parsePhase = new ParsePhase();
  const semanticPhase = new SemanticPhase();

  /**
   * Helper to parse source and run semantic analysis
   *
   * @param source - Blend source code
   * @returns Semantic analysis result
   */
  function analyze(source: string) {
    const sources = new Map([['test.blend', source]]);
    const parseResult = parsePhase.execute(sources);
    return semanticPhase.execute(parseResult.data);
  }

  describe('execute() - basic analysis', () => {
    it('should analyze empty program', () => {
      const result = analyze('');

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.timeMs).toBeGreaterThanOrEqual(0);
    });

    it('should analyze simple variable declaration', () => {
      const result = analyze('let x: byte = 10;');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should analyze memory-mapped variable', () => {
      const result = analyze('@map borderColor at $D020: byte;');

      expect(result.success).toBe(true);
    });
  });

  describe('execute() - type checking', () => {
    it('should validate numeric assignment', () => {
      const result = analyze('let x: byte = 10;');

      expect(result.success).toBe(true);
    });

    it('should validate word assignment', () => {
      const result = analyze('let y: word = 1000;');

      expect(result.success).toBe(true);
    });
  });

  describe('execute() - symbol resolution', () => {
    it('should resolve global variables', () => {
      const result = analyze('let globalCounter: byte = 0;');

      expect(result.success).toBe(true);
    });
  });

  describe('executeSingle() - convenience method', () => {
    it('should analyze single program', () => {
      const sources = new Map([['single.blend', 'let x: byte = 10;']]);
      const parseResult = parsePhase.execute(sources);
      const program = parseResult.data[0];

      const result = semanticPhase.executeSingle(program);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('execute() - storage classes', () => {
    it('should analyze @zp variables', () => {
      const result = analyze('@zp let fastCounter: byte = 0;');

      expect(result.success).toBe(true);
    });

    it('should analyze @ram variables', () => {
      const result = analyze('@ram let buffer: byte[256];');

      expect(result.success).toBe(true);
    });

    it('should analyze @data variables', () => {
      const result = analyze('@data let lookup: byte[] = [0, 1, 2, 3];');

      expect(result.success).toBe(true);
    });

    it('should analyze @map declarations', () => {
      const result = analyze('@map borderColor at $D020: byte;');

      expect(result.success).toBe(true);
    });
  });

  describe('execute() - timing', () => {
    it('should track execution time', () => {
      const result = analyze('let x: byte = 10;');

      expect(result.timeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.timeMs).toBe('number');
    });
  });

  describe('execute() - result structure', () => {
    it('should return MultiModuleAnalysisResult', () => {
      const result = analyze('let x: byte = 10;');

      expect(result.data).toBeDefined();
      expect(result.data.success).toBeDefined();
      expect(result.data.diagnostics).toBeDefined();
      expect(result.data.modules).toBeDefined();
      expect(result.data.globalSymbolTable).toBeDefined();
    });

    it('should have consistent success flag', () => {
      const result = analyze('let x: byte = 10;');

      // Phase result success should match inner result success
      expect(result.success).toBe(result.data.success);
    });

    it('should have consistent diagnostics', () => {
      const result = analyze('let x: byte = 10;');

      // Phase result diagnostics should match inner result
      expect(result.diagnostics).toEqual(result.data.diagnostics);
    });
  });
});