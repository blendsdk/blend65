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
 * **Library Resolution:**
 * - If `{library}.blend` exists → load single file
 * - If `{library}/` exists → load all .blend files in folder
 * - Otherwise → error
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
 *
 * Contains the loaded source files, any diagnostics generated during loading,
 * and a success flag indicating whether loading completed without errors.
 */
export interface LibraryLoadResult {
  /**
   * Map of filepath → source content
   *
   * Keys are prefixed with `@stdlib/` to distinguish library sources from user sources.
   * Example: `@stdlib/common/types.blend`, `@stdlib/c64/sid.blend`
   */
  sources: Map<string, string>;

  /**
   * Any errors or warnings generated during loading
   *
   * Errors indicate library load failures (e.g., missing library).
   * Warnings indicate non-fatal issues (e.g., empty directory).
   */
  diagnostics: Diagnostic[];

  /**
   * Whether loading was successful
   *
   * True if no ERROR severity diagnostics were generated.
   */
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
 * 2. `{target}/common/` - Always loaded for specific target (target-specific utilities)
 * 3. `{target}/{library}` - Opt-in libraries specified in config or CLI
 *
 * **Library Resolution:**
 * - Single file: `{target}/{library}.blend` → load that file
 * - Folder: `{target}/{library}/` → load all .blend files recursively
 *
 * @example Basic usage
 * ```typescript
 * const loader = new LibraryLoader();
 * const result = loader.loadLibraries('c64', ['sid']);
 *
 * if (result.success) {
 *   // Merge with user sources
 *   for (const [file, content] of result.sources) {
 *     allSources.set(file, content);
 *   }
 * }
 * ```
 *
 * @example List available libraries
 * ```typescript
 * const loader = new LibraryLoader();
 * const available = loader.listAvailableLibraries('c64');
 * console.log('Available:', available); // ['sid', 'sprites', ...]
 * ```
 */
export class LibraryLoader {
  /**
   * Base path to library directory
   *
   * Resolved relative to this module's location.
   * In development: `packages/compiler/library/`
   * In production: `packages/compiler/library/` (same, included in npm package)
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
      // In ESM, we need to use import.meta.url
      // This file: packages/compiler/src/library/loader.ts (or dist/library/loader.js)
      // Library dir: packages/compiler/library/
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      // Go up from src/library or dist/library to compiler package root, then into library/
      this.libraryPath = path.resolve(currentDir, '..', '..', 'library');
    }
  }

  /**
   * Load all libraries for a compilation
   *
   * Loads common libraries (auto-loaded) and any specified optional libraries.
   * The loading order ensures that common utilities are available to all other libraries.
   *
   * @param target - Target platform (e.g., 'c64', 'x16')
   * @param optionalLibraries - Array of opt-in library names (e.g., ['sid', 'sprites'])
   * @returns LibraryLoadResult with sources map and any diagnostics
   *
   * @example Load with optional libraries
   * ```typescript
   * const result = loader.loadLibraries('c64', ['sid', 'sprites']);
   * console.log('Loaded files:', result.sources.size);
   * ```
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
   * If the directory doesn't exist, this is silently ignored (not an error).
   *
   * @param dirPath - Absolute path to directory
   * @param sources - Map to add loaded sources to
   * @param diagnostics - Array to add any errors to
   */
  protected loadDirectory(
    dirPath: string,
    sources: Map<string, string>,
    diagnostics: Diagnostic[]
  ): void {
    // Skip if directory doesn't exist (not an error for common/)
    if (!fs.existsSync(dirPath)) {
      return;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively load subdirectories
          this.loadDirectory(fullPath, sources, diagnostics);
        } else if (entry.isFile() && entry.name.endsWith('.blend')) {
          // Load .blend files
          this.loadFile(fullPath, sources, diagnostics);
        }
      }
    } catch (error) {
      diagnostics.push(
        this.createError(
          `Failed to read library directory '${dirPath}': ${this.getErrorMessage(error)}`,
          dirPath
        )
      );
    }
  }

  /**
   * Load a single library (file or folder)
   *
   * Resolves the library name to either a single file (`{library}.blend`)
   * or a folder (`{library}/`), and loads accordingly.
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
    diagnostics: Diagnostic[]
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

    // Library not found - add error diagnostic
    diagnostics.push(
      this.createError(
        `Library '${library}' not found for target '${target}'. ` +
          `Searched: ${filePath}, ${folderPath}/`,
        basePath
      )
    );
  }

  /**
   * Load a single .blend file
   *
   * Reads the file content and adds it to the sources map.
   * The key is prefixed with `@stdlib/` to distinguish from user sources.
   *
   * @param filePath - Absolute path to .blend file
   * @param sources - Map to add source to
   * @param diagnostics - Array to add any errors to
   */
  protected loadFile(
    filePath: string,
    sources: Map<string, string>,
    diagnostics: Diagnostic[]
  ): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Use relative path from library root as key, prefixed with @stdlib/
      const relativePath = path.relative(this.libraryPath, filePath);
      sources.set(`@stdlib/${relativePath}`, content);
    } catch (error) {
      diagnostics.push(
        this.createError(
          `Failed to read library file '${filePath}': ${this.getErrorMessage(error)}`,
          filePath
        )
      );
    }
  }

  /**
   * List available libraries for a target
   *
   * Returns an array of library names that can be passed to `loadLibraries()`.
   * This does not include auto-loaded libraries (common/).
   *
   * @param target - Target platform (e.g., 'c64')
   * @returns Array of available library names (sorted alphabetically)
   *
   * @example
   * ```typescript
   * const libs = loader.listAvailableLibraries('c64');
   * // Returns: ['math', 'sid', 'sprites', ...]
   * ```
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
        // Skip common/ directory (it's auto-loaded, not opt-in)
        if (entry.name === 'common') continue;

        if (entry.isDirectory()) {
          // Folder library
          libraries.push(entry.name);
        } else if (entry.isFile() && entry.name.endsWith('.blend')) {
          // File library (remove .blend extension)
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
   * Useful for debugging or testing.
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