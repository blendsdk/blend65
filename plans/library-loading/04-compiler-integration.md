# Compiler Integration: Technical Specification

> **Document**: 04-compiler-integration.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies how to integrate the `LibraryLoader` into the existing `Compiler` class, including configuration type changes and CLI flag support.

## Configuration Changes

### File: `packages/compiler/src/config/types.ts`

Add `libraries` option to `CompilerOptions`:

```typescript
export interface CompilerOptions {
  // ... existing options ...

  /**
   * Optional libraries to load
   *
   * Specifies additional libraries to load beyond the common libraries.
   * Libraries are loaded from `packages/compiler/library/{target}/`.
   *
   * @example ["sid", "sprites"]
   */
  libraries?: string[];
}
```

### File: `packages/compiler/src/config/types.ts`

Add `cliLibraries` to `ConfigLoadOptions`:

```typescript
export interface ConfigLoadOptions {
  // ... existing options ...

  /**
   * Libraries specified on command line
   *
   * When provided, overrides the config file's libraries option.
   */
  cliLibraries?: string[];
}
```

## Compiler Integration

### File: `packages/compiler/src/compiler.ts`

#### Add Import

```typescript
import { LibraryLoader } from './library/index.js';
```

#### Add LibraryLoader Instance

```typescript
export class Compiler {
  protected parsePhase = new ParsePhase();
  protected semanticPhase = new SemanticPhase();
  protected ilPhase = new ILPhase();
  protected optimizePhase = new OptimizePhase();
  protected codegenPhase = new CodegenPhase();
  
  /** Library loader for standard library sources */
  protected libraryLoader = new LibraryLoader();  // NEW
```

#### Modify compile() Method

```typescript
public compile(options: CompileOptions): CompilationResult {
  const startTime = performance.now();
  const { files, config } = options;

  const result: CompilationResult = {
    success: false,
    diagnostics: [],
    phases: {},
    totalTimeMs: 0,
    target: getDefaultTargetConfig(),
  };

  try {
    // Validate target platform
    const targetValidation = this.validateTarget(config);
    if (!targetValidation.success) {
      result.diagnostics.push(...targetValidation.diagnostics);
      return this.finalize(result, startTime);
    }
    result.target = targetValidation.target;

    // Load source files
    const sources = this.loadSourceFiles(files);
    if (sources.diagnostics.length > 0) {
      result.diagnostics.push(...sources.diagnostics);
      if (!sources.success) {
        return this.finalize(result, startTime);
      }
    }

    // NEW: Load library sources
    const libraryResult = this.loadLibrarySources(config);
    if (libraryResult.diagnostics.length > 0) {
      result.diagnostics.push(...libraryResult.diagnostics);
      if (!libraryResult.success) {
        return this.finalize(result, startTime);
      }
    }

    // NEW: Merge library + user sources (library first)
    const allSources = new Map([
      ...libraryResult.sources,
      ...sources.data,
    ]);

    // Run compilation pipeline with merged sources
    return this.runPipeline(allSources, config, result, options.stopAfterPhase, startTime);
  } catch (error) {
    result.diagnostics.push(this.createInternalError(error));
    return this.finalize(result, startTime);
  }
}
```

#### Modify compileSource() Method

```typescript
public compileSource(
  sources: Map<string, string>,
  config: Blend65Config,
  stopAfterPhase?: 'parse' | 'semantic' | 'il' | 'optimize' | 'codegen'
): CompilationResult {
  const startTime = performance.now();

  const result: CompilationResult = {
    success: false,
    diagnostics: [],
    phases: {},
    totalTimeMs: 0,
    target: getDefaultTargetConfig(),
  };

  try {
    // Validate target platform
    const targetValidation = this.validateTarget(config);
    if (!targetValidation.success) {
      result.diagnostics.push(...targetValidation.diagnostics);
      return this.finalize(result, startTime);
    }
    result.target = targetValidation.target;

    // NEW: Load library sources
    const libraryResult = this.loadLibrarySources(config);
    if (libraryResult.diagnostics.length > 0) {
      result.diagnostics.push(...libraryResult.diagnostics);
      if (!libraryResult.success) {
        return this.finalize(result, startTime);
      }
    }

    // NEW: Merge library + user sources (library first)
    const allSources = new Map([
      ...libraryResult.sources,
      ...sources,
    ]);

    // Run compilation pipeline directly with merged sources
    return this.runPipeline(allSources, config, result, stopAfterPhase, startTime);
  } catch (error) {
    result.diagnostics.push(this.createInternalError(error));
    return this.finalize(result, startTime);
  }
}
```

#### Add Helper Method

```typescript
/**
 * Load standard library sources
 *
 * Loads common libraries (always) and optional libraries (from config).
 *
 * @param config - Compilation configuration
 * @returns Library load result with sources and diagnostics
 */
protected loadLibrarySources(config: Blend65Config): {
  success: boolean;
  sources: Map<string, string>;
  diagnostics: Diagnostic[];
} {
  const target = config.compilerOptions.target || 'c64';
  const libraries = config.compilerOptions.libraries || [];

  return this.libraryLoader.loadLibraries(target, libraries);
}
```

## CLI Integration

### File: `packages/cli/src/commands/compile.ts`

Add `--libraries` flag:

```typescript
import { Command } from 'commander';

export function createCompileCommand(): Command {
  return new Command('compile')
    .description('Compile Blend65 source files')
    .argument('<files...>', 'Source files to compile')
    .option('-t, --target <target>', 'Target platform (c64, x16)', 'c64')
    .option('-o, --output <file>', 'Output file name')
    .option('--libraries <libs>', 'Comma-separated list of libraries to load', parseLibraries)
    // ... other options ...
    .action(async (files, options) => {
      // Build config with CLI overrides
      const config: Blend65Config = {
        compilerOptions: {
          target: options.target,
          libraries: options.libraries,  // Array from parseLibraries
          // ... other options ...
        },
      };
      
      // ... compile ...
    });
}

/**
 * Parse comma-separated library list
 */
function parseLibraries(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}
```

## Integration Points

### Order of Sources

Library sources are added BEFORE user sources in the merged Map:

```typescript
const allSources = new Map([
  ...libraryResult.sources,  // Library sources first
  ...userSources,            // User sources second
]);
```

This ensures:
1. Library modules are registered first in ModuleRegistry
2. User imports of library modules resolve correctly
3. User modules can override library modules if needed (same module name)

### Module Registry Behavior

The existing `ModuleRegistry` handles the merged sources naturally:

1. Parse phase parses all sources → array of Program[]
2. SemanticPhase registers all modules by their `module` declaration names
3. ImportResolver validates imports against the full registry
4. User code importing `std.c64.vic` finds it because it was registered

No changes needed to the module system.

## Testing Requirements

- Integration test: compile with library
- Integration test: library not found error
- Unit test: loadLibrarySources helper
- CLI test: --libraries flag parsing