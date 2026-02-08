/**
 * Tests for Code Generation Types
 *
 * Tests for type definitions, default options, and constants
 * in the codegen/types module.
 *
 * @module __tests__/codegen/types.test
 */

import { describe, it, expect } from 'vitest';
import {
  getDefaultCodegenOptions,
  C64_BASIC_START,
  C64_CODE_START,
} from '../../codegen/types.js';
import type { CodegenOptions, CodegenResult, SourceMapEntry, CodegenStats } from '../../codegen/types.js';
import { C64_CONFIG } from '../../target/index.js';

describe('codegen/types', () => {
  // ===========================================================================
  // Constants
  // ===========================================================================

  describe('constants', () => {
    it('should define C64_BASIC_START as $0801', () => {
      expect(C64_BASIC_START).toBe(0x0801);
    });

    it('should define C64_CODE_START as $0810', () => {
      expect(C64_CODE_START).toBe(0x0810);
    });
  });

  // ===========================================================================
  // getDefaultCodegenOptions
  // ===========================================================================

  describe('getDefaultCodegenOptions', () => {
    it('should return options with target', () => {
      const options = getDefaultCodegenOptions(C64_CONFIG);
      expect(options.target).toBe(C64_CONFIG);
    });

    it('should default format to prg', () => {
      const options = getDefaultCodegenOptions(C64_CONFIG);
      expect(options.format).toBe('prg');
    });

    it('should default sourceMap to false', () => {
      const options = getDefaultCodegenOptions(C64_CONFIG);
      expect(options.sourceMap).toBe(false);
    });

    it('should default debug to none', () => {
      const options = getDefaultCodegenOptions(C64_CONFIG);
      expect(options.debug).toBe('none');
    });

    it('should default loadAddress to $0801', () => {
      const options = getDefaultCodegenOptions(C64_CONFIG);
      expect(options.loadAddress).toBe(0x0801);
    });

    it('should default basicStub to true', () => {
      const options = getDefaultCodegenOptions(C64_CONFIG);
      expect(options.basicStub).toBe(true);
    });

    it('should not include acmePath by default', () => {
      const options = getDefaultCodegenOptions(C64_CONFIG);
      expect(options.acmePath).toBeUndefined();
    });
  });

  // ===========================================================================
  // Type Compatibility
  // ===========================================================================

  describe('type compatibility', () => {
    it('should accept valid CodegenOptions', () => {
      const options: CodegenOptions = {
        target: C64_CONFIG,
        format: 'both',
        sourceMap: true,
        debug: 'inline',
        loadAddress: 0x0900,
        basicStub: false,
        acmePath: '/usr/bin/acme',
      };

      expect(options.format).toBe('both');
      expect(options.debug).toBe('inline');
      expect(options.loadAddress).toBe(0x0900);
    });

    it('should accept all output formats', () => {
      const formats: CodegenOptions['format'][] = ['asm', 'prg', 'crt', 'both'];
      formats.forEach((format) => {
        const options: CodegenOptions = {
          target: C64_CONFIG,
          format,
          sourceMap: false,
          debug: 'none',
        };
        expect(options.format).toBe(format);
      });
    });

    it('should accept all debug modes', () => {
      const modes: CodegenOptions['debug'][] = ['none', 'inline', 'vice', 'both'];
      modes.forEach((debug) => {
        const options: CodegenOptions = {
          target: C64_CONFIG,
          format: 'prg',
          sourceMap: false,
          debug,
        };
        expect(options.debug).toBe(debug);
      });
    });

    it('should accept valid SourceMapEntry', () => {
      const entry: SourceMapEntry = {
        address: 0x0810,
        source: {
          start: { line: 10, column: 1 },
          end: { line: 10, column: 20 },
        },
        label: '_main',
      };

      expect(entry.address).toBe(0x0810);
      expect(entry.source.start.line).toBe(10);
      expect(entry.label).toBe('_main');
    });

    it('should accept SourceMapEntry without optional label', () => {
      const entry: SourceMapEntry = {
        address: 0x0815,
        source: {
          start: { line: 15, column: 5 },
          end: { line: 15, column: 15 },
        },
      };

      expect(entry.address).toBe(0x0815);
      expect(entry.label).toBeUndefined();
    });

    it('should accept valid CodegenStats', () => {
      const stats: CodegenStats = {
        codeSize: 256,
        dataSize: 128,
        zpBytesUsed: 10,
        functionCount: 5,
        globalCount: 8,
        totalSize: 400,
      };

      expect(stats.codeSize).toBe(256);
      expect(stats.dataSize).toBe(128);
      expect(stats.totalSize).toBe(400);
    });

    it('should accept valid CodegenResult', () => {
      const result: CodegenResult = {
        assembly: '; test\nRTS',
        binary: new Uint8Array([0x01, 0x08, 0x60]),
        sourceMap: [
          {
            address: 0x0810,
            source: { start: { line: 1, column: 1 }, end: { line: 1, column: 3 } },
          },
        ],
        viceLabels: 'al C:0810 .main',
        warnings: ['Test warning'],
        stats: {
          codeSize: 1,
          dataSize: 0,
          zpBytesUsed: 0,
          functionCount: 1,
          globalCount: 0,
          totalSize: 3,
        },
      };

      expect(result.assembly).toContain('RTS');
      expect(result.binary).toBeInstanceOf(Uint8Array);
      expect(result.warnings).toHaveLength(1);
    });

    it('should accept CodegenResult without optional fields', () => {
      const result: CodegenResult = {
        assembly: '; minimal',
        warnings: [],
        stats: {
          codeSize: 0,
          dataSize: 0,
          zpBytesUsed: 0,
          functionCount: 0,
          globalCount: 0,
          totalSize: 0,
        },
      };

      expect(result.binary).toBeUndefined();
      expect(result.sourceMap).toBeUndefined();
      expect(result.viceLabels).toBeUndefined();
    });
  });
});