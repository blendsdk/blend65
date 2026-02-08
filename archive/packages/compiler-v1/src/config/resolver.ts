/**
 * File Resolver
 *
 * Resolves source files from configuration patterns.
 * Handles glob pattern expansion and exclude filtering.
 *
 * **Resolution Strategy:**
 * 1. If `files` is specified, use those exact files
 * 2. Otherwise, expand `include` patterns
 * 3. Apply `exclude` patterns to filter results
 * 4. Validate all files exist
 *
 * @module config/resolver
 */

import { existsSync, statSync } from 'node:fs';
import { resolve, relative, normalize, isAbsolute } from 'node:path';
import { globSync } from 'glob';

import type { Blend65Config } from './types.js';

/**
 * File resolution exception
 *
 * Thrown when file resolution fails.
 */
export class FileResolutionException extends Error {
  /**
   * Files that caused the error (if applicable)
   */
  public readonly files: string[];

  /**
   * Creates a new FileResolutionException
   *
   * @param message - Error message
   * @param files - Files that caused the error
   */
  constructor(message: string, files: string[] = []) {
    super(message);
    this.name = 'FileResolutionException';
    this.files = files;
  }
}

/**
 * File resolver options
 */
export interface FileResolverOptions {
  /**
   * Base directory for resolving relative paths
   *
   * Usually the directory containing blend65.json.
   */
  baseDir: string;

  /**
   * Whether to validate that files exist
   *
   * @default true
   */
  validateExistence?: boolean;

  /**
   * Whether to fail on no files found
   *
   * @default true
   */
  failOnEmpty?: boolean;
}

/**
 * File resolver result
 */
export interface FileResolverResult {
  /**
   * Resolved file paths (absolute)
   */
  files: string[];

  /**
   * Files that were excluded
   */
  excluded: string[];

  /**
   * Patterns that matched no files
   */
  unmatchedPatterns: string[];
}

/**
 * File resolver
 *
 * Resolves source files from configuration include/exclude patterns.
 * Uses glob for pattern matching.
 *
 * @example
 * ```typescript
 * const resolver = new FileResolver({
 *   baseDir: '/project',
 * });
 *
 * const files = resolver.resolveFiles({
 *   include: ['src/**\/*.blend'],
 *   exclude: ['src/**\/*.test.blend'],
 * });
 * ```
 */
export class FileResolver {
  /**
   * Base directory for resolving paths
   */
  protected readonly baseDir: string;

  /**
   * Whether to validate file existence
   */
  protected readonly validateExistence: boolean;

  /**
   * Whether to fail on empty results
   */
  protected readonly failOnEmpty: boolean;

  /**
   * Creates a new FileResolver
   *
   * @param options - Resolver options
   */
  constructor(options: FileResolverOptions) {
    this.baseDir = resolve(options.baseDir);
    this.validateExistence = options.validateExistence ?? true;
    this.failOnEmpty = options.failOnEmpty ?? true;
  }

  /**
   * Resolve files from configuration
   *
   * @param config - Configuration with include/exclude/files
   * @returns Resolved file paths
   * @throws FileResolutionException if resolution fails
   *
   * @example
   * ```typescript
   * const files = resolver.resolveFiles(config);
   * console.log(`Found ${files.length} files`);
   * ```
   */
  public resolveFiles(config: Partial<Blend65Config>): string[] {
    const result = this.resolveFilesDetailed(config);
    return result.files;
  }

  /**
   * Resolve files with detailed results
   *
   * Returns information about excluded files and unmatched patterns
   * in addition to the resolved files.
   *
   * @param config - Configuration with include/exclude/files
   * @returns Detailed resolution result
   * @throws FileResolutionException if resolution fails
   */
  public resolveFilesDetailed(config: Partial<Blend65Config>): FileResolverResult {
    // Strategy 1: Use explicit files if provided
    if (config.files && config.files.length > 0) {
      return this.resolveExplicitFiles(config.files);
    }

    // Strategy 2: Use include/exclude patterns
    return this.resolvePatterns(config.include ?? [], config.exclude ?? []);
  }

  /**
   * Resolve explicit file list
   *
   * @param files - Explicit file paths
   * @returns Resolution result
   */
  protected resolveExplicitFiles(files: string[]): FileResolverResult {
    const resolved: string[] = [];
    const missing: string[] = [];

    for (const file of files) {
      const absolutePath = this.resolvePath(file);

      if (this.validateExistence) {
        if (!existsSync(absolutePath)) {
          missing.push(absolutePath);
        } else if (!this.isFile(absolutePath)) {
          missing.push(absolutePath);
        } else {
          resolved.push(absolutePath);
        }
      } else {
        resolved.push(absolutePath);
      }
    }

    if (missing.length > 0) {
      throw new FileResolutionException(`Source files not found:\n  ${missing.join('\n  ')}`, missing);
    }

    if (this.failOnEmpty && resolved.length === 0) {
      throw new FileResolutionException('No source files specified');
    }

    return {
      files: resolved,
      excluded: [],
      unmatchedPatterns: [],
    };
  }

  /**
   * Resolve files from glob patterns
   *
   * @param includePatterns - Patterns to include
   * @param excludePatterns - Patterns to exclude
   * @returns Resolution result
   */
  protected resolvePatterns(includePatterns: string[], excludePatterns: string[]): FileResolverResult {
    const allFiles = new Set<string>();
    const excludedFiles = new Set<string>();
    const unmatchedPatterns: string[] = [];

    // Expand include patterns
    for (const pattern of includePatterns) {
      const matches = this.expandPattern(pattern);

      if (matches.length === 0) {
        unmatchedPatterns.push(pattern);
      }

      for (const file of matches) {
        allFiles.add(file);
      }
    }

    // Apply exclude patterns
    for (const pattern of excludePatterns) {
      const excludeMatches = this.expandPattern(pattern);

      for (const file of excludeMatches) {
        if (allFiles.has(file)) {
          allFiles.delete(file);
          excludedFiles.add(file);
        }
      }
    }

    const files = Array.from(allFiles).sort();

    if (this.failOnEmpty && files.length === 0) {
      if (includePatterns.length === 0) {
        throw new FileResolutionException('No include patterns specified and no files found');
      }
      throw new FileResolutionException(
        `No source files found matching patterns:\n  ${includePatterns.join('\n  ')}`
      );
    }

    return {
      files,
      excluded: Array.from(excludedFiles).sort(),
      unmatchedPatterns,
    };
  }

  /**
   * Expand a glob pattern to matching files
   *
   * @param pattern - Glob pattern
   * @returns Matching absolute file paths
   */
  protected expandPattern(pattern: string): string[] {
    try {
      const matches = globSync(pattern, {
        cwd: this.baseDir,
        absolute: true,
        nodir: true, // Only files, not directories
        dot: false, // Don't match hidden files by default
      });

      // Filter to only existing files
      return matches.filter((file) => this.isFile(file));
    } catch (error) {
      // Invalid pattern - return empty array
      return [];
    }
  }

  /**
   * Resolve a path relative to base directory
   *
   * @param path - Relative or absolute path
   * @returns Absolute path
   */
  protected resolvePath(path: string): string {
    if (isAbsolute(path)) {
      return normalize(path);
    }
    return resolve(this.baseDir, path);
  }

  /**
   * Check if path is a file (not directory)
   *
   * @param path - Path to check
   * @returns True if path is a file
   */
  protected isFile(path: string): boolean {
    try {
      const stats = statSync(path);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Get relative path from base directory
   *
   * @param absolutePath - Absolute file path
   * @returns Relative path from base directory
   */
  public getRelativePath(absolutePath: string): string {
    return relative(this.baseDir, absolutePath);
  }

  /**
   * Create file resolver from config directory
   *
   * Convenience factory that creates a resolver using the
   * directory containing the config file as the base.
   *
   * @param configDir - Directory containing blend65.json
   * @returns Configured file resolver
   */
  public static fromConfigDir(configDir: string): FileResolver {
    return new FileResolver({
      baseDir: configDir,
    });
  }
}

/**
 * Resolve files from configuration
 *
 * Convenience function that creates a resolver and resolves files
 * in a single call.
 *
 * @param config - Configuration with include/exclude/files
 * @param baseDir - Base directory for resolution
 * @returns Resolved file paths
 *
 * @example
 * ```typescript
 * const files = resolveConfigFiles(config, '/project');
 * ```
 */
export function resolveConfigFiles(config: Partial<Blend65Config>, baseDir: string): string[] {
  const resolver = new FileResolver({ baseDir });
  return resolver.resolveFiles(config);
}