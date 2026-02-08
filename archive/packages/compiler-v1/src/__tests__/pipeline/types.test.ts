/**
 * Tests for pipeline type definitions and type guards
 *
 * Verifies that the pipeline type guards correctly identify
 * phase results and compilation results.
 *
 * @module tests/pipeline/types
 */

import { describe, it, expect } from 'vitest';

import { hasPhaseData, hasOutput, type PhaseResult, type CompilationResult, type CodegenResult } from '../../pipeline/types.js';
import { getDefaultTargetConfig } from '../../target/registry.js';

describe('Pipeline Types', () => {
  describe('hasPhaseData()', () => {
    it('should return true for phase result with data', () => {
      const result: PhaseResult<string[]> = {
        data: ['item1', 'item2'],
        diagnostics: [],
        success: true,
        timeMs: 10,
      };

      expect(hasPhaseData(result)).toBe(true);
    });

    it('should return true for phase result with empty array data', () => {
      const result: PhaseResult<string[]> = {
        data: [],
        diagnostics: [],
        success: true,
        timeMs: 5,
      };

      expect(hasPhaseData(result)).toBe(true);
    });

    it('should return false for undefined result', () => {
      expect(hasPhaseData(undefined)).toBe(false);
    });

    it('should return true for phase result with failed status but data', () => {
      const result: PhaseResult<number> = {
        data: 42,
        diagnostics: [],
        success: false,
        timeMs: 15,
      };

      // Even if success is false, data is present
      expect(hasPhaseData(result)).toBe(true);
    });

    it('should return true for phase result with null data', () => {
      // null is a valid data value (not undefined)
      const result: PhaseResult<null> = {
        data: null,
        diagnostics: [],
        success: true,
        timeMs: 1,
      };

      expect(hasPhaseData(result)).toBe(true);
    });
  });

  describe('hasOutput()', () => {
    /**
     * Creates a minimal successful compilation result with output
     */
    function createSuccessfulResult(output: CompilationResult['output']): CompilationResult {
      return {
        success: true,
        diagnostics: [],
        phases: {},
        output,
        totalTimeMs: 100,
        target: getDefaultTargetConfig(),
      };
    }

    /**
     * Creates a minimal failed compilation result
     */
    function createFailedResult(): CompilationResult {
      return {
        success: false,
        diagnostics: [],
        phases: {},
        totalTimeMs: 50,
        target: getDefaultTargetConfig(),
      };
    }

    it('should return true for successful result with output', () => {
      const result = createSuccessfulResult({
        assembly: '; test assembly',
        binary: new Uint8Array([0x01, 0x08]),
      });

      expect(hasOutput(result)).toBe(true);
    });

    it('should return true for successful result with minimal output', () => {
      const result = createSuccessfulResult({
        assembly: '',
      });

      expect(hasOutput(result)).toBe(true);
    });

    it('should return false for successful result without output', () => {
      const result = createSuccessfulResult(undefined);

      expect(hasOutput(result)).toBe(false);
    });

    it('should return false for failed result', () => {
      const result = createFailedResult();

      expect(hasOutput(result)).toBe(false);
    });

    it('should return false for failed result even with output', () => {
      const result: CompilationResult = {
        success: false,
        diagnostics: [],
        phases: {},
        output: {
          assembly: '; partial output',
        },
        totalTimeMs: 75,
        target: getDefaultTargetConfig(),
      };

      // hasOutput checks success flag first
      expect(hasOutput(result)).toBe(false);
    });

    it('should narrow type correctly when returning true', () => {
      const result = createSuccessfulResult({
        assembly: '; code',
        binary: new Uint8Array([0x01, 0x08, 0xa9, 0x00]),
      });

      if (hasOutput(result)) {
        // TypeScript should narrow type - output is now NonNullable
        expect(result.output).toBeDefined();
        expect(result.output.assembly).toBe('; code');
        expect(result.output.binary).toBeInstanceOf(Uint8Array);
      } else {
        // Should not reach here
        expect.fail('hasOutput should return true');
      }
    });
  });

  describe('PhaseResult interface', () => {
    it('should support generic data types', () => {
      // String data
      const stringResult: PhaseResult<string> = {
        data: 'hello',
        diagnostics: [],
        success: true,
        timeMs: 1,
      };
      expect(stringResult.data).toBe('hello');

      // Number data
      const numberResult: PhaseResult<number> = {
        data: 42,
        diagnostics: [],
        success: true,
        timeMs: 2,
      };
      expect(numberResult.data).toBe(42);

      // Object data
      const objectResult: PhaseResult<{ name: string }> = {
        data: { name: 'test' },
        diagnostics: [],
        success: true,
        timeMs: 3,
      };
      expect(objectResult.data.name).toBe('test');

      // Array data
      const arrayResult: PhaseResult<number[]> = {
        data: [1, 2, 3],
        diagnostics: [],
        success: true,
        timeMs: 4,
      };
      expect(arrayResult.data).toHaveLength(3);
    });

    it('should track timing information', () => {
      const result: PhaseResult<string> = {
        data: 'test',
        diagnostics: [],
        success: true,
        timeMs: 123.456,
      };

      expect(result.timeMs).toBeCloseTo(123.456, 2);
    });
  });

  describe('CodegenResult interface', () => {
    it('should support all output formats', () => {
      const result: CodegenResult = {
        assembly: '; assembly code\nlda #$00',
        binary: new Uint8Array([0x01, 0x08, 0xa9, 0x00]),
        sourceMap: {
          version: 3,
          file: 'output.prg',
          sources: ['main.blend'],
          mappings: 'AAAA',
          names: [],
        },
        viceLabels: 'al C:0810 .main',
      };

      expect(result.assembly).toContain('lda #$00');
      expect(result.binary.length).toBe(4);
      expect(result.sourceMap?.version).toBe(3);
      expect(result.viceLabels).toContain('.main');
    });

    it('should support optional fields', () => {
      const minimalResult: CodegenResult = {
        assembly: '',
        binary: new Uint8Array(0),
      };

      expect(minimalResult.sourceMap).toBeUndefined();
      expect(minimalResult.viceLabels).toBeUndefined();
    });
  });

  describe('CompilationResult interface', () => {
    it('should support all phase results', () => {
      const result: CompilationResult = {
        success: true,
        diagnostics: [],
        phases: {
          parse: {
            data: [],
            diagnostics: [],
            success: true,
            timeMs: 10,
          },
          semantic: undefined, // Phase not reached
        },
        totalTimeMs: 100,
        target: getDefaultTargetConfig(),
      };

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic).toBeUndefined();
    });

    it('should track total compilation time', () => {
      const result: CompilationResult = {
        success: true,
        diagnostics: [],
        phases: {},
        totalTimeMs: 500.5,
        target: getDefaultTargetConfig(),
      };

      expect(result.totalTimeMs).toBe(500.5);
    });
  });
});