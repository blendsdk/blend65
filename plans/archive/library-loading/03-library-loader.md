# Library Loader: Technical Specification

> **Document**: 03-library-loader.md
> **Parent**: [Index](00-index.md)

## Overview

The `LibraryLoader` class is responsible for loading standard library source files from disk and returning them as a `Map<string, string>` that can be merged with user sources before compilation.

## Architecture

### Current Architecture

No library loading exists. User sources are passed directly to the pipeline.

### Proposed Changes

```
┌─────────────────────────────────────────────────────────────┐
│                    Compiler.compile()                        │
├─────────────────────────────────────────────────────────────┤
│  1. Validate target                                          │
│  2. Load user source files                                   │
│  3. NEW: Load library sources via LibraryLoader             │
│  4. NEW: Merge library + user sources                       │
│  5. Run pipeline with merged sources                        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### File: `packages/compiler/src/library/loader.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { Diagnostic } from '../ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from '../ast/diagnostics.js';

/**
 * Result of loading libraries
 */
export interface LibraryLoadResult {
  /** Map of filepath → source content */
  sources: Map<string, string>;
  
  /** Any errors or warnings during loading */
  diagnostics: Diagnostic[];
  
  /** Whether loading was successful */
  success: boolean;
}

/**
 * LibraryLoader loads standard library sources from disk
 * 
 * **Loading Order:**
 * 1. `common/` - Always loaded for all targets
 * 2. `{target}/common/` - Always loaded for specific target
 * 3. `{target}/{library}` - Opt-in libraries
 * 
 * **Library Resolution:**
 * - If `{library}.blend` exists → load single file
 * - If `{library}/` exists → load all .blend files in folder
 * - Otherwise → error
 */
export class LibraryLoader {
  /** Base path to library directory */
  protected readonly libraryPath: string;

  /**
   * Creates a LibraryLoader
   * 
   * @param libraryPath - Path to library directory (defaults to relative to this file)
   */
  constructor(libraryPath?: string) {
    // Default: relative to compiled JS location
    // In dev: packages/compiler/src/library/ → packages/compiler/library/
    // In dist: packages/compiler/dist/library/ → packages/compiler/library/
    this.libraryPath = libraryPath ?? path.resolve(__dirname, '..', '..', 'library');
  }

  /**
   * Load all libraries for a compilation
   * 
   * @param target - Target platform (e.g., 'c64', 'x16')
   * @param optionalLibraries - Array of opt-in library names
   * @returns LibraryLoadResult with sources and diagnostics
   */
  public loadLibraries(target: string, optionalLibraries: string[] = []): LibraryLoadResult {
    const sources = new Map<string, string>();
    const diagnostics: Diagnostic[] = [];

    // 1. Load common/ (always)
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
      success: !diagnostics.some(d => d.severity === DiagnosticSeverity.ERROR),
    };
  }

  /**
   * Load all .blend files from a directory
   * 
   * @param dirPath - Directory path
   * @param sources - Map to add sources to
   * @param diagnostics - Array to add errors to
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
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        if (file.endsWith('.blend')) {
          const filePath = path.join(dirPath, file);
          this.loadFile(filePath, sources, diagnostics);
        }
      }
    } catch (error) {
      diagnostics.push(this.createError(
        `Failed to read library directory '${dirPath}': ${this.getErrorMessage(error)}`,
        dirPath
      ));
    }
  }

  /**
   * Load a single library (file or folder)
   * 
   * @param target - Target platform
   * @param library - Library name
   * @param sources - Map to add sources to
   * @param diagnostics - Array to add errors to
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

    // Library not found
    diagnostics.push(this.createError(
      `Library '${library}' not found for target '${target}'. ` +
      `Searched: ${filePath}, ${folderPath}/`,
      basePath
    ));
  }

  /**
   * Load a single .blend file
   * 
   * @param filePath - Absolute path to file
   * @param sources - Map to add source to
   * @param diagnostics - Array to add errors to
   */
  protected loadFile(
    filePath: string,
    sources: Map<string, string>,
    diagnostics: Diagnostic[]
  ): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Use relative path from library root as key
      const relativePath = path.relative(this.libraryPath, filePath);
      sources.set(`@stdlib/${relativePath}`, content);
    } catch (error) {
      diagnostics.push(this.createError(
        `Failed to read library file '${filePath}': ${this.getErrorMessage(error)}`,
        filePath
      ));
    }
  }

  /**
   * List available libraries for a target
   * 
   * @param target - Target platform
   * @returns Array of available library names
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
        // Skip common/ directory
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
      // Ignore errors
    }

    return libraries.sort();
  }

  /**
   * Create an error diagnostic
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
   */
  protected getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
```

### File: `packages/compiler/src/library/index.ts`

```typescript
export { LibraryLoader, type LibraryLoadResult } from './loader.js';
```

## Code Examples

### Example 1: Basic Usage

```typescript
import { LibraryLoader } from './library/index.js';

const loader = new LibraryLoader();

// Load libraries for C64 target with optional 'sid' library
const result = loader.loadLibraries('c64', ['sid']);

if (result.success) {
  console.log('Loaded libraries:', result.sources.size);
  for (const [file, _] of result.sources) {
    console.log(' -', file);
  }
} else {
  console.error('Errors:', result.diagnostics);
}
```

### Example 2: List Available Libraries

```typescript
const loader = new LibraryLoader();
const available = loader.listAvailableLibraries('c64');
console.log('Available C64 libraries:', available);
// Output: ['sid', 'sprites', 'vic', ...]
```

## Error Handling

| Error Case | Handling Strategy |
|------------|------------------|
| Library not found | Error diagnostic with search paths |
| File read error | Error diagnostic with file path and error message |
| Directory read error | Error diagnostic (non-fatal for common/) |
| Empty library folder | Warning (no .blend files found) |

## Testing Requirements

- Unit tests for `loadLibraries()` with various scenarios
- Unit tests for `loadLibrary()` file vs folder detection
- Unit tests for `listAvailableLibraries()`
- Integration tests with mock library files
- Error case tests (missing library, read errors)