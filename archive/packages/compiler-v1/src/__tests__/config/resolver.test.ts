/**
 * Tests for file resolution
 *
 * Tests glob pattern expansion, exclude filtering, and explicit file lists.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

import { FileResolver, FileResolutionException, resolveConfigFiles } from '../../config/index.js';

describe('FileResolver', () => {
  let testDir: string;

  // Create a temporary test directory before each test
  beforeEach(() => {
    testDir = resolve(tmpdir(), `blend65-resolver-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  // Clean up test directory after each test
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a file in the test directory
   */
  function createFile(relativePath: string, content: string = '// test'): string {
    const fullPath = join(testDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dir && dir !== testDir) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
    return fullPath;
  }

  describe('Constructor', () => {
    it('should create resolver with base directory', () => {
      const resolver = new FileResolver({ baseDir: testDir });
      expect(resolver).toBeDefined();
    });

    it('should resolve relative base directory', () => {
      const resolver = new FileResolver({ baseDir: '.' });
      expect(resolver).toBeDefined();
    });
  });

  describe('resolveFiles() with explicit files', () => {
    it('should resolve explicit file list', () => {
      const file1 = createFile('main.blend');
      const file2 = createFile('game.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        files: ['main.blend', 'game.blend'],
      });

      expect(files).toHaveLength(2);
      expect(files).toContain(file1);
      expect(files).toContain(file2);
    });

    it('should throw for missing explicit files', () => {
      const resolver = new FileResolver({ baseDir: testDir });

      expect(() =>
        resolver.resolveFiles({
          files: ['missing.blend'],
        })
      ).toThrow(FileResolutionException);
    });

    it('should throw for empty explicit file list', () => {
      const resolver = new FileResolver({ baseDir: testDir, failOnEmpty: true });

      expect(() =>
        resolver.resolveFiles({
          files: [],
        })
      ).toThrow(FileResolutionException);
    });

    it('should allow empty results when failOnEmpty is false', () => {
      const resolver = new FileResolver({ baseDir: testDir, failOnEmpty: false });

      const files = resolver.resolveFiles({
        files: [],
      });

      expect(files).toEqual([]);
    });
  });

  describe('resolveFiles() with patterns', () => {
    it('should resolve simple glob pattern', () => {
      createFile('main.blend');
      createFile('game.blend');
      createFile('readme.txt'); // Should not match

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        include: ['*.blend'],
      });

      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith('.blend'))).toBe(true);
    });

    it('should resolve recursive glob pattern', () => {
      createFile('main.blend');
      createFile('src/game.blend');
      createFile('src/lib/utils.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        include: ['**/*.blend'],
      });

      expect(files).toHaveLength(3);
    });

    it('should apply exclude patterns', () => {
      createFile('src/main.blend');
      createFile('src/game.blend');
      createFile('src/test.test.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        include: ['src/**/*.blend'],
        exclude: ['**/*.test.blend'],
      });

      expect(files).toHaveLength(2);
      expect(files.every((f) => !f.includes('.test.'))).toBe(true);
    });

    it('should throw when no files match include patterns', () => {
      const resolver = new FileResolver({ baseDir: testDir, failOnEmpty: true });

      expect(() =>
        resolver.resolveFiles({
          include: ['*.blend'],
        })
      ).toThrow(FileResolutionException);
    });

    it('should throw when no include patterns specified', () => {
      const resolver = new FileResolver({ baseDir: testDir, failOnEmpty: true });

      expect(() => resolver.resolveFiles({})).toThrow(FileResolutionException);
    });
  });

  describe('resolveFilesDetailed()', () => {
    it('should return detailed resolution results', () => {
      createFile('main.blend');
      createFile('game.blend');
      createFile('test.test.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const result = resolver.resolveFilesDetailed({
        include: ['*.blend'],
        exclude: ['*.test.blend'],
      });

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.excluded).toHaveLength(1);
      expect(result.excluded[0]).toContain('test.test.blend');
    });

    it('should report unmatched patterns', () => {
      createFile('main.blend');

      const resolver = new FileResolver({ baseDir: testDir, failOnEmpty: false });
      const result = resolver.resolveFilesDetailed({
        include: ['*.blend', 'nonexistent/**/*.blend'],
      });

      expect(result.files).toHaveLength(1);
      expect(result.unmatchedPatterns).toContain('nonexistent/**/*.blend');
    });
  });

  describe('File validation', () => {
    it('should validate file existence by default', () => {
      const resolver = new FileResolver({ baseDir: testDir });

      expect(() =>
        resolver.resolveFiles({
          files: ['missing.blend'],
        })
      ).toThrow(/not found/i);
    });

    it('should skip validation when validateExistence is false', () => {
      const resolver = new FileResolver({
        baseDir: testDir,
        validateExistence: false,
        failOnEmpty: false,
      });

      const files = resolver.resolveFiles({
        files: ['missing.blend'],
      });

      expect(files).toHaveLength(1);
    });

    it('should reject directories in explicit file list', () => {
      mkdirSync(join(testDir, 'subdir'), { recursive: true });

      const resolver = new FileResolver({ baseDir: testDir });

      expect(() =>
        resolver.resolveFiles({
          files: ['subdir'],
        })
      ).toThrow(FileResolutionException);
    });
  });

  describe('Path resolution', () => {
    it('should resolve relative paths to base directory', () => {
      createFile('src/main.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        files: ['src/main.blend'],
      });

      expect(files[0]).toBe(resolve(testDir, 'src/main.blend'));
    });

    it('should handle absolute paths', () => {
      const absolutePath = createFile('main.blend');

      const resolver = new FileResolver({
        baseDir: testDir,
        validateExistence: true,
      });
      const files = resolver.resolveFiles({
        files: [absolutePath],
      });

      expect(files[0]).toBe(absolutePath);
    });

    it('should return sorted file list', () => {
      createFile('z-file.blend');
      createFile('a-file.blend');
      createFile('m-file.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        include: ['*.blend'],
      });

      // Files should be sorted
      const sorted = [...files].sort();
      expect(files).toEqual(sorted);
    });
  });

  describe('getRelativePath()', () => {
    it('should return path relative to base directory', () => {
      const resolver = new FileResolver({ baseDir: testDir });

      const relativePath = resolver.getRelativePath(join(testDir, 'src/main.blend'));

      expect(relativePath).toBe('src/main.blend');
    });
  });

  describe('fromConfigDir()', () => {
    it('should create resolver from config directory', () => {
      createFile('main.blend');

      const resolver = FileResolver.fromConfigDir(testDir);
      const files = resolver.resolveFiles({
        include: ['*.blend'],
      });

      expect(files).toHaveLength(1);
    });
  });

  describe('resolveConfigFiles() helper', () => {
    it('should resolve files in one call', () => {
      createFile('main.blend');
      createFile('game.blend');

      const files = resolveConfigFiles(
        {
          include: ['*.blend'],
        },
        testDir
      );

      expect(files).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple include patterns', () => {
      createFile('main.blend');
      createFile('lib/utils.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        include: ['main.blend', 'lib/*.blend'],
      });

      expect(files).toHaveLength(2);
    });

    it('should deduplicate files matched by multiple patterns', () => {
      createFile('main.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        include: ['*.blend', 'main.blend', '**/*.blend'],
      });

      // Same file should only appear once
      expect(files).toHaveLength(1);
    });

    it('should not match hidden files by default', () => {
      createFile('.hidden.blend');
      createFile('visible.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        include: ['*.blend'],
      });

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('visible.blend');
    });

    it('should handle empty exclude patterns', () => {
      createFile('main.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        include: ['*.blend'],
        exclude: [],
      });

      expect(files).toHaveLength(1);
    });

    it('should handle exclude patterns that match nothing', () => {
      createFile('main.blend');

      const resolver = new FileResolver({ baseDir: testDir });
      const files = resolver.resolveFiles({
        include: ['*.blend'],
        exclude: ['*.test.blend'], // No test files exist
      });

      expect(files).toHaveLength(1);
    });
  });

  describe('FileResolutionException', () => {
    it('should include list of missing files', () => {
      const resolver = new FileResolver({ baseDir: testDir });

      try {
        resolver.resolveFiles({
          files: ['missing1.blend', 'missing2.blend'],
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(FileResolutionException);
        const exception = e as FileResolutionException;
        expect(exception.files).toHaveLength(2);
      }
    });
  });
});