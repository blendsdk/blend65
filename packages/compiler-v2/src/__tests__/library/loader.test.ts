/**
 * Library Loader Unit Tests
 *
 * Tests for the LibraryLoader class that loads standard library files.
 * Uses the real library directory from the v2 compiler package.
 *
 * @module __tests__/library/loader
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LibraryLoader } from '../../library/loader.js';

/**
 * Get the absolute path to the v2 library directory.
 * This test file lives in: src/__tests__/library/
 * Library lives in: library/
 */
function getLibraryPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '..', '..', '..', 'library');
}

describe('LibraryLoader', () => {
  describe('constructor', () => {
    it('should accept custom library path', () => {
      const customPath = '/tmp/test-library';
      const loader = new LibraryLoader(customPath);
      expect(loader.getLibraryPath()).toBe(customPath);
    });

    it('should use default path when none specified', () => {
      const loader = new LibraryLoader();
      const libraryPath = loader.getLibraryPath();
      expect(libraryPath).toContain('library');
    });
  });

  describe('loadLibraries() with real library', () => {
    const loader = new LibraryLoader(getLibraryPath());

    it('should load libraries for c64 target', () => {
      const result = loader.loadLibraries('c64');
      expect(result.success).toBe(true);
      expect(result.sources.size).toBeGreaterThan(0);
    });

    it('should load common/system.blend', () => {
      const result = loader.loadLibraries('c64');
      const systemKey = '@stdlib/common/system.blend';
      expect(result.sources.has(systemKey)).toBe(true);
      const content = result.sources.get(systemKey)!;
      expect(content).toContain('peek');
      expect(content).toContain('poke');
    });

    it('should load common/asm.blend', () => {
      const result = loader.loadLibraries('c64');
      const asmKey = '@stdlib/common/asm.blend';
      expect(result.sources.has(asmKey)).toBe(true);
      const content = result.sources.get(asmKey)!;
      expect(content).toContain('asm_lda');
      expect(content).toContain('asm_sta');
      expect(content).toContain('asm_rts');
    });

    it('should load c64/common/hardware.blend', () => {
      const result = loader.loadLibraries('c64');
      const hwKey = '@stdlib/c64/common/hardware.blend';
      expect(result.sources.has(hwKey)).toBe(true);
      const content = result.sources.get(hwKey)!;
      expect(content).toContain('BORDER_COLOR');
    });

    it('should prefix all sources with @stdlib/', () => {
      const result = loader.loadLibraries('c64');
      for (const key of result.sources.keys()) {
        expect(key.startsWith('@stdlib/')).toBe(true);
      }
    });

    it('should have no error diagnostics for valid load', () => {
      const result = loader.loadLibraries('c64');
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('loadLibraries() with unknown target', () => {
    const loader = new LibraryLoader(getLibraryPath());

    it('should still load common/ files for unknown target', () => {
      const result = loader.loadLibraries('unknown_target');
      // common/ is always loaded
      const systemKey = '@stdlib/common/system.blend';
      expect(result.sources.has(systemKey)).toBe(true);
    });

    it('should succeed even when target-specific dir is missing', () => {
      const result = loader.loadLibraries('unknown_target');
      // No errors because missing target dir is silently ignored
      expect(result.success).toBe(true);
    });
  });

  describe('loadLibraries() with nonexistent path', () => {
    it('should succeed with empty sources for nonexistent library path', () => {
      const loader = new LibraryLoader('/tmp/nonexistent-blend65-lib');
      const result = loader.loadLibraries('c64');
      // No errors because loadDirectory silently skips missing dirs
      expect(result.success).toBe(true);
      expect(result.sources.size).toBe(0);
    });
  });

  describe('loadLibraries() with optional libraries', () => {
    const loader = new LibraryLoader(getLibraryPath());

    it('should report error for missing optional library', () => {
      const result = loader.loadLibraries('c64', ['nonexistent-lib']);
      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('nonexistent-lib');
    });
  });

  describe('listAvailableLibraries()', () => {
    const loader = new LibraryLoader(getLibraryPath());

    it('should return array for c64', () => {
      const libs = loader.listAvailableLibraries('c64');
      expect(Array.isArray(libs)).toBe(true);
    });

    it('should not include "common" in the list', () => {
      const libs = loader.listAvailableLibraries('c64');
      expect(libs).not.toContain('common');
    });

    it('should return empty array for nonexistent target', () => {
      const libs = loader.listAvailableLibraries('nonexistent');
      expect(libs).toEqual([]);
    });
  });

  describe('getLibraryPath()', () => {
    it('should return the configured library path', () => {
      const customPath = '/my/custom/path';
      const loader = new LibraryLoader(customPath);
      expect(loader.getLibraryPath()).toBe(customPath);
    });
  });
});
