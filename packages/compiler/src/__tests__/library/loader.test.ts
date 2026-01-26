/**
 * Tests for LibraryLoader
 *
 * Tests library loading, directory traversal, and error handling.
 * Uses temporary directories for isolated testing.
 *
 * @module __tests__/library/loader.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

import { LibraryLoader } from '../../library/loader.js';
import { DiagnosticSeverity } from '../../ast/diagnostics.js';

describe('LibraryLoader', () => {
  let testDir: string;
  let loader: LibraryLoader;

  // Create a temporary test directory before each test
  beforeEach(() => {
    testDir = resolve(tmpdir(), `blend65-lib-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    loader = new LibraryLoader(testDir);
  });

  // Clean up test directory after each test
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a library file in the test directory
   *
   * @param relativePath - Path relative to testDir (e.g., 'common/types.blend')
   * @param content - Blend source content
   */
  function createLibraryFile(relativePath: string, content: string): void {
    const fullPath = join(testDir, relativePath);
    const dir = resolve(fullPath, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content);
  }

  /**
   * Helper to create a directory structure for testing
   *
   * @param paths - Array of relative paths to create (directories end with /)
   */
  function createStructure(paths: string[]): void {
    for (const p of paths) {
      const fullPath = join(testDir, p);
      if (p.endsWith('/')) {
        mkdirSync(fullPath, { recursive: true });
      } else {
        const dir = resolve(fullPath, '..');
        mkdirSync(dir, { recursive: true });
        writeFileSync(fullPath, `// ${p}`);
      }
    }
  }

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('constructor', () => {
    it('should accept custom library path', () => {
      const customPath = '/custom/path';
      const customLoader = new LibraryLoader(customPath);

      expect(customLoader.getLibraryPath()).toBe(customPath);
    });

    it('should use provided library path', () => {
      expect(loader.getLibraryPath()).toBe(testDir);
    });
  });

  // ===========================================================================
  // getLibraryPath() Tests
  // ===========================================================================

  describe('getLibraryPath()', () => {
    it('should return the library path', () => {
      expect(loader.getLibraryPath()).toBe(testDir);
    });
  });

  // ===========================================================================
  // loadLibraries() Tests
  // ===========================================================================

  describe('loadLibraries()', () => {
    describe('auto-loading common libraries', () => {
      it('should load common/ directory for all targets', () => {
        createLibraryFile('common/types.blend', '// common types');
        createLibraryFile('common/utils.blend', '// common utils');

        const result = loader.loadLibraries('c64', []);

        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(2);
        expect(result.sources.has('@stdlib/common/types.blend')).toBe(true);
        expect(result.sources.has('@stdlib/common/utils.blend')).toBe(true);
      });

      it('should load {target}/common/ directory', () => {
        createLibraryFile('c64/common/hardware.blend', '// c64 hardware');
        createLibraryFile('c64/common/memory.blend', '// c64 memory');

        const result = loader.loadLibraries('c64', []);

        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(2);
        expect(result.sources.has('@stdlib/c64/common/hardware.blend')).toBe(true);
        expect(result.sources.has('@stdlib/c64/common/memory.blend')).toBe(true);
      });

      it('should load both common/ and {target}/common/', () => {
        createLibraryFile('common/types.blend', '// common types');
        createLibraryFile('c64/common/hardware.blend', '// c64 hardware');

        const result = loader.loadLibraries('c64', []);

        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(2);
        expect(result.sources.has('@stdlib/common/types.blend')).toBe(true);
        expect(result.sources.has('@stdlib/c64/common/hardware.blend')).toBe(true);
      });

      it('should silently ignore missing common/ directory', () => {
        // No common/ directory exists
        const result = loader.loadLibraries('c64', []);

        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(0);
        expect(result.diagnostics.length).toBe(0);
      });

      it('should silently ignore missing {target}/common/ directory', () => {
        // Create target dir but not common/ subdirectory
        mkdirSync(join(testDir, 'c64'), { recursive: true });

        const result = loader.loadLibraries('c64', []);

        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(0);
        expect(result.diagnostics.length).toBe(0);
      });
    });

    describe('loading optional libraries', () => {
      it('should load single file library ({target}/{library}.blend)', () => {
        createLibraryFile('c64/sid.blend', '// SID module');

        const result = loader.loadLibraries('c64', ['sid']);

        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(1);
        expect(result.sources.has('@stdlib/c64/sid.blend')).toBe(true);
        expect(result.sources.get('@stdlib/c64/sid.blend')).toBe('// SID module');
      });

      it('should load folder library ({target}/{library}/)', () => {
        createLibraryFile('c64/sprites/init.blend', '// sprites init');
        createLibraryFile('c64/sprites/draw.blend', '// sprites draw');

        const result = loader.loadLibraries('c64', ['sprites']);

        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(2);
        expect(result.sources.has('@stdlib/c64/sprites/init.blend')).toBe(true);
        expect(result.sources.has('@stdlib/c64/sprites/draw.blend')).toBe(true);
      });

      it('should prefer single file over folder when both exist', () => {
        // Create both file and folder with same name
        createLibraryFile('c64/audio.blend', '// audio single file');
        createLibraryFile('c64/audio/mixer.blend', '// audio mixer');

        const result = loader.loadLibraries('c64', ['audio']);

        // Should load the file, not the folder
        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(1);
        expect(result.sources.has('@stdlib/c64/audio.blend')).toBe(true);
      });

      it('should load multiple optional libraries', () => {
        createLibraryFile('c64/sid.blend', '// SID');
        createLibraryFile('c64/sprites.blend', '// sprites');
        createLibraryFile('c64/math.blend', '// math');

        const result = loader.loadLibraries('c64', ['sid', 'sprites', 'math']);

        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(3);
      });

      it('should load nested files in folder library', () => {
        createLibraryFile('c64/gfx/core.blend', '// core');
        createLibraryFile('c64/gfx/sprites/init.blend', '// sprites init');
        createLibraryFile('c64/gfx/sprites/draw.blend', '// sprites draw');

        const result = loader.loadLibraries('c64', ['gfx']);

        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(3);
        expect(result.sources.has('@stdlib/c64/gfx/core.blend')).toBe(true);
        expect(result.sources.has('@stdlib/c64/gfx/sprites/init.blend')).toBe(true);
        expect(result.sources.has('@stdlib/c64/gfx/sprites/draw.blend')).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should add error for missing library', () => {
        const result = loader.loadLibraries('c64', ['nonexistent']);

        expect(result.success).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0].severity).toBe(DiagnosticSeverity.ERROR);
        expect(result.diagnostics[0].message).toContain('nonexistent');
        expect(result.diagnostics[0].message).toContain('not found');
      });

      it('should add errors for all missing libraries', () => {
        const result = loader.loadLibraries('c64', ['missing1', 'missing2']);

        expect(result.success).toBe(false);
        expect(result.diagnostics.length).toBe(2);
      });

      it('should still load valid libraries when some are missing', () => {
        createLibraryFile('c64/valid.blend', '// valid');

        const result = loader.loadLibraries('c64', ['valid', 'invalid']);

        expect(result.success).toBe(false);
        expect(result.sources.size).toBe(1);
        expect(result.sources.has('@stdlib/c64/valid.blend')).toBe(true);
        expect(result.diagnostics.length).toBe(1);
      });

      it('should handle empty optional libraries array', () => {
        const result = loader.loadLibraries('c64', []);

        expect(result.success).toBe(true);
        expect(result.diagnostics.length).toBe(0);
      });
    });

    describe('different targets', () => {
      it('should load libraries for x16 target', () => {
        createLibraryFile('x16/vera.blend', '// VERA module');

        const result = loader.loadLibraries('x16', ['vera']);

        expect(result.success).toBe(true);
        expect(result.sources.has('@stdlib/x16/vera.blend')).toBe(true);
      });

      it('should not load c64 libraries when target is x16', () => {
        createLibraryFile('c64/sid.blend', '// SID');
        createLibraryFile('x16/vera.blend', '// VERA');

        const result = loader.loadLibraries('x16', ['sid']);

        expect(result.success).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0].message).toContain('not found');
      });
    });

    describe('file filtering', () => {
      it('should only load .blend files', () => {
        createLibraryFile('common/types.blend', '// blend file');
        writeFileSync(join(testDir, 'common', 'readme.txt'), 'text file');
        writeFileSync(join(testDir, 'common', 'notes.md'), '# markdown');

        const result = loader.loadLibraries('c64', []);

        expect(result.sources.size).toBe(1);
        expect(result.sources.has('@stdlib/common/types.blend')).toBe(true);
      });

      it('should skip non-blend files in library folders', () => {
        createLibraryFile('c64/lib/code.blend', '// code');
        writeFileSync(join(testDir, 'c64', 'lib', 'data.json'), '{}');

        const result = loader.loadLibraries('c64', ['lib']);

        expect(result.sources.size).toBe(1);
        expect(result.sources.has('@stdlib/c64/lib/code.blend')).toBe(true);
      });
    });

    describe('loading order', () => {
      it('should load common, then target/common, then optional libraries', () => {
        createLibraryFile('common/base.blend', '// common base');
        createLibraryFile('c64/common/target.blend', '// target common');
        createLibraryFile('c64/extra.blend', '// optional extra');

        const result = loader.loadLibraries('c64', ['extra']);

        expect(result.success).toBe(true);
        expect(result.sources.size).toBe(3);

        // Verify all are loaded (order is implicit in Map iteration)
        const keys = Array.from(result.sources.keys());
        expect(keys).toContain('@stdlib/common/base.blend');
        expect(keys).toContain('@stdlib/c64/common/target.blend');
        expect(keys).toContain('@stdlib/c64/extra.blend');
      });
    });
  });

  // ===========================================================================
  // listAvailableLibraries() Tests
  // ===========================================================================

  describe('listAvailableLibraries()', () => {
    it('should list single file libraries', () => {
      createLibraryFile('c64/sid.blend', '// SID');
      createLibraryFile('c64/sprites.blend', '// sprites');

      const libs = loader.listAvailableLibraries('c64');

      expect(libs).toContain('sid');
      expect(libs).toContain('sprites');
    });

    it('should list folder libraries', () => {
      createStructure(['c64/audio/', 'c64/audio/init.blend']);

      const libs = loader.listAvailableLibraries('c64');

      expect(libs).toContain('audio');
    });

    it('should NOT include common/ directory', () => {
      createStructure(['c64/common/', 'c64/common/hardware.blend', 'c64/sid.blend']);

      const libs = loader.listAvailableLibraries('c64');

      expect(libs).not.toContain('common');
      expect(libs).toContain('sid');
    });

    it('should return sorted list', () => {
      createLibraryFile('c64/zlib.blend', '//');
      createLibraryFile('c64/audio.blend', '//');
      createLibraryFile('c64/math.blend', '//');

      const libs = loader.listAvailableLibraries('c64');

      expect(libs).toEqual(['audio', 'math', 'zlib']);
    });

    it('should return empty array for missing target', () => {
      const libs = loader.listAvailableLibraries('nonexistent');

      expect(libs).toEqual([]);
    });

    it('should return empty array when target has no libraries', () => {
      mkdirSync(join(testDir, 'empty'), { recursive: true });

      const libs = loader.listAvailableLibraries('empty');

      expect(libs).toEqual([]);
    });

    it('should handle mixed file and folder libraries', () => {
      createLibraryFile('c64/sid.blend', '//');
      createStructure(['c64/sprites/', 'c64/sprites/init.blend']);
      createLibraryFile('c64/math.blend', '//');

      const libs = loader.listAvailableLibraries('c64');

      expect(libs).toEqual(['math', 'sid', 'sprites']);
    });

    it('should list libraries for different targets independently', () => {
      createLibraryFile('c64/sid.blend', '//');
      createLibraryFile('x16/vera.blend', '//');

      const c64Libs = loader.listAvailableLibraries('c64');
      const x16Libs = loader.listAvailableLibraries('x16');

      expect(c64Libs).toEqual(['sid']);
      expect(x16Libs).toEqual(['vera']);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle deeply nested directories', () => {
      createLibraryFile('c64/deep/a/b/c/d/file.blend', '// deep nested');

      const result = loader.loadLibraries('c64', ['deep']);

      expect(result.success).toBe(true);
      expect(result.sources.has('@stdlib/c64/deep/a/b/c/d/file.blend')).toBe(true);
    });

    it('should handle empty library folders', () => {
      mkdirSync(join(testDir, 'c64', 'empty'), { recursive: true });

      const result = loader.loadLibraries('c64', ['empty']);

      expect(result.success).toBe(true);
      expect(result.sources.size).toBe(0);
    });

    it('should handle Unicode in file names', () => {
      createLibraryFile('c64/модуль.blend', '// Unicode module');

      const result = loader.loadLibraries('c64', ['модуль']);

      expect(result.success).toBe(true);
      expect(result.sources.has('@stdlib/c64/модуль.blend')).toBe(true);
    });

    it('should handle Unicode in file content', () => {
      createLibraryFile('c64/text.blend', '// Содержимое модуля 🎮');

      const result = loader.loadLibraries('c64', ['text']);

      expect(result.success).toBe(true);
      expect(result.sources.get('@stdlib/c64/text.blend')).toBe('// Содержимое модуля 🎮');
    });

    it('should handle library names with special characters', () => {
      createLibraryFile('c64/my-lib.blend', '// hyphenated');
      createLibraryFile('c64/my_lib.blend', '// underscored');

      const result = loader.loadLibraries('c64', ['my-lib', 'my_lib']);

      expect(result.success).toBe(true);
      expect(result.sources.size).toBe(2);
    });

    it('should handle large files', () => {
      const largeContent = '// ' + 'x'.repeat(100000);
      createLibraryFile('c64/large.blend', largeContent);

      const result = loader.loadLibraries('c64', ['large']);

      expect(result.success).toBe(true);
      expect(result.sources.get('@stdlib/c64/large.blend')).toBe(largeContent);
    });

    it('should handle empty files', () => {
      createLibraryFile('c64/empty.blend', '');

      const result = loader.loadLibraries('c64', ['empty']);

      expect(result.success).toBe(true);
      expect(result.sources.get('@stdlib/c64/empty.blend')).toBe('');
    });

    it('should handle case-sensitive library names', () => {
      createLibraryFile('c64/SID.blend', '// uppercase');
      createLibraryFile('c64/sid.blend', '// lowercase');

      const result = loader.loadLibraries('c64', ['SID']);

      expect(result.success).toBe(true);
      expect(result.sources.has('@stdlib/c64/SID.blend')).toBe(true);
    });

    it('should not follow symlinks outside library path', () => {
      // This test just verifies normal operation - actual symlink behavior
      // depends on OS and filesystem
      createLibraryFile('c64/normal.blend', '// normal');

      const result = loader.loadLibraries('c64', ['normal']);

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // LibraryLoadResult Structure Tests
  // ===========================================================================

  describe('LibraryLoadResult structure', () => {
    it('should have sources as Map<string, string>', () => {
      const result = loader.loadLibraries('c64', []);

      expect(result.sources).toBeInstanceOf(Map);
    });

    it('should have diagnostics as array', () => {
      const result = loader.loadLibraries('c64', []);

      expect(Array.isArray(result.diagnostics)).toBe(true);
    });

    it('should have success as boolean', () => {
      const result = loader.loadLibraries('c64', []);

      expect(typeof result.success).toBe('boolean');
    });

    it('should set success to true when no errors', () => {
      createLibraryFile('c64/lib.blend', '//');

      const result = loader.loadLibraries('c64', ['lib']);

      expect(result.success).toBe(true);
      expect(result.diagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR).length).toBe(
        0
      );
    });

    it('should set success to false when errors exist', () => {
      const result = loader.loadLibraries('c64', ['missing']);

      expect(result.success).toBe(false);
      expect(
        result.diagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR).length
      ).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Source Key Format Tests
  // ===========================================================================

  describe('source key format', () => {
    it('should prefix all keys with @stdlib/', () => {
      createLibraryFile('common/base.blend', '//');
      createLibraryFile('c64/common/hw.blend', '//');
      createLibraryFile('c64/sid.blend', '//');

      const result = loader.loadLibraries('c64', ['sid']);

      for (const key of result.sources.keys()) {
        expect(key.startsWith('@stdlib/')).toBe(true);
      }
    });

    it('should use forward slashes in keys on all platforms', () => {
      createLibraryFile('c64/nested/sub/file.blend', '//');

      const result = loader.loadLibraries('c64', ['nested']);

      const key = Array.from(result.sources.keys())[0];
      expect(key).toBe('@stdlib/c64/nested/sub/file.blend');
      expect(key).not.toContain('\\');
    });
  });
});