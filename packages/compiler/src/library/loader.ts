/**
 * Library Loader
 *
 * Loads standard library source files from disk and returns them as a
 * `Map<string, string>` that can be merged with user sources before compilation.
 *
 * **Library Loading Order:**
 * 1. `common/` - Always loaded for all targets
 * 2. `{target}/common/` - Always loaded for specific target
 * 3. `{target}/{library}` - Opt-in libraries
 *
 * @module library/loader
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Diagnostic } from '../ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from '../ast/diagnostics.js';

/**
 * Result of loading libraries
 */
export interface LibraryLoadResult {
  /**
   * Map of filepath → source content
   *
   * Keys are prefixed with `@stdlib/` to distinguish library sources from user sources.
   */
  sources: Map<string, string>;

  /** Any errors or warnings generated during loading */
  diagnostics: Diagnostic[];

  /** Whether loading was successful (no ERROR severity diagnostics) */
  success: boolean;
}

/**
 * LibraryLoader loads standard library sources from disk
 *
 * The loader handles both auto-loaded common libraries and opt-in libraries.
 * All loaded sources are prefixed with `@stdlib/` in the source map keys.
 *
 * **Loading Order:**
 * 1. `common/` - Always loaded for all targets (cross-platform utilities)
 * 2. `{target}/common/` - Always loaded for specific target
 * 3. `{target}/{library}` - Opt-in libraries specified in config or CLI
 */
export class LibraryLoader {
  /**
   * Base path to library directory
   *
   * Resolved relative to this module's location.
   * In v2: `packages/compiler/library/`
   */
  protected readonly libraryPath: string;

  /**
   * Creates a LibraryLoader
   *
   * @param libraryPath - Optional override path to library directory.
   *                      Defaults to `../../library` relative to this file.
   */
  constructor(libraryPath?: string) {
    if (libraryPath) {
      this.libraryPath = libraryPath;
    } else {
      // Resolve relative to this module's location
      // This file: packages/compiler/src/library/loader.ts (or dist/library/loader.js)
      // Library dir: packages/compiler/library/
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      this.libraryPath = path.resolve(currentDir, '..', '..', 'library');
    }
  }

  /**
   * Load all libraries for a compilation
   *
   * @param target - Target platform (e.g., 'c64', 'x16')
   * @param optionalLibraries - Array of opt-in library names
   * @returns LibraryLoadResult with sources map and any diagnostics
   */
  public loadLibraries(target: string, optionalLibraries: string[] = []): LibraryLoadResult {
    const sources = new Map<string, string>();
    const diagnostics: Diagnostic[] = [];

    // 1. Load common/ (always, for all targets)
    this.loadDirectory(path.join(this.libraryPath, 'common'), sources, diagnostics);

    // 2. Load {target}/common/ (always for this target)
    const targetCommonPath = path.join(this.libraryPath, target, 'common');
    this.loadDirectory(targetCommonPath, sources, diagnostics);

    // 3. Load optional libraries
    for (const library of optionalLibraries) {
      this.loadLibrary(target, library, sources, diagnostics);
    }

    return {
      sources,
      diagnostics,
      success: !diagnostics.some((d) => d.severity === DiagnosticSeverity.ERROR),
    };
  }

  /**
   * Load all .blend files from a directory
   *
   * Recursively loads all `.blend` files from the specified directory.
   * If the directory doesn't exist, this is silently ignored.
   *
   * @param dirPath - Absolute path to directory
   * @param sources - Map to add loaded sources to
   * @param diagnostics - Array to add any errors to
   */
  protected loadDirectory(
    dirPath: string,
    sources: Map<string, string>,
    diagnostics: Diagnostic[],
  ): void {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          this.loadDirectory(fullPath, sources, diagnostics);
        } else if (entry.isFile() && entry.name.endsWith('.blend')) {
          this.loadFile(fullPath, sources, diagnostics);
        }
      }
    } catch (error) {
      diagnostics.push(
        this.createError(
          `Failed to read library directory '${dirPath}': ${this.getErrorMessage(error)}`,
          dirPath,
        ),
      );
    }
  }

  /**
   * Load a single library (file or folder)
   *
   * @param target - Target platform
   * @param library - Library name (e.g., 'sid', 'sprites')
   * @param sources - Map to add loaded sources to
   * @param diagnostics - Array to add any errors to
   */
  protected loadLibrary(
    target: string,
    library: string,
    sources: Map<string, string>,
    diagnostics: Diagnostic[],
  ): void {
    const basePath = path.join(this.libraryPath, target);

    // Check for single file: {target}/{library}.blend
    const filePath = path.join(basePath, `${library}.blend`);
    if (fs.existsSync(filePath)) {
      this.loadFile(filePath, sources, diagnostics);
      return;
    }

    // Check for folder: {target}/{library}/
    const folderPath = path.join(basePath, library);
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      this.loadDirectory(folderPath, sources, diagnostics);
      return;
    }

    // Library not found
    diagnostics.push(
      this.createError(
        `Library '${library}' not found for target '${target}'. ` +
          `Searched: ${filePath}, ${folderPath}/`,
        basePath,
      ),
    );
  }

  /**
   * Load a single .blend file
   *
   * @param filePath - Absolute path to .blend file
   * @param sources - Map to add source to
   * @param diagnostics - Array to add any errors to
   */
  protected loadFile(
    filePath: string,
    sources: Map<string, string>,
    diagnostics: Diagnostic[],
  ): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(this.libraryPath, filePath);
      sources.set(`@stdlib/${relativePath}`, content);
    } catch (error) {
      diagnostics.push(
        this.createError(
          `Failed to read library file '${filePath}': ${this.getErrorMessage(error)}`,
          filePath,
        ),
      );
    }
  }

  /**
   * List available libraries for a target
   *
   * @param target - Target platform (e.g., 'c64')
   * @returns Array of available library names (sorted)
   */
  public listAvailableLibraries(target: string): string[] {
    const libraries: string[] = [];
    const targetPath = path.join(this.libraryPath, target);

    if (!fs.existsSync(targetPath)) {
      return libraries;
    }

    try {
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === 'common') continue;

        if (entry.isDirectory()) {
          libraries.push(entry.name);
        } else if (entry.isFile() && entry.name.endsWith('.blend')) {
          libraries.push(entry.name.replace('.blend', ''));
        }
      }
    } catch {
      // Ignore errors - return empty array
    }

    return libraries.sort();
  }

  /**
   * Get the path to the library directory
   *
   * @returns Absolute path to library directory
   */
  public getLibraryPath(): string {
    return this.libraryPath;
  }

  /**
   * Create an error diagnostic
   *
   * @param message - Error message
   * @param source - Source path for the error
   * @returns Diagnostic object
   */
  protected createError(message: string, source: string): Diagnostic {
    return {
      code: DiagnosticCode.MODULE_NOT_FOUND,
      severity: DiagnosticSeverity.ERROR,
      message,
      location: {
        source,
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
    };
  }

  /**
   * Get error message from unknown error
   *
   * @param error - Unknown error object
   * @returns Error message string
   */
  protected getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
