# Phase 0: Configuration System

> **Status**: Planning
> **Phase**: 0
> **Priority**: HIGH
> **Dependencies**: None
> **Estimated Tasks**: 8

---

## Codebase Analysis (Validated)

**Related Infrastructure That EXISTS (can be reused/integrated):**

- ✅ `TargetConfig` - Target hardware configuration (C64, C128, X16) at `target/config.ts`
- ✅ `TargetArchitecture` - Target enum (C64, C128, X16) at `target/architecture.ts`
- ✅ `OptimizationLevel` - Optimization level enum (O0-O3, Os, Oz) at `optimizer/options.ts`
- ✅ `OptimizationOptions` - Optimizer options (level, verbose) at `optimizer/options.ts`
- ✅ `ParserConfig` - Parser-specific config at `parser/config.ts`
- ✅ C64_CONFIG, C128_CONFIG, X16_CONFIG - Target configurations

**Configuration Infrastructure DOES NOT Exist:**

- ❌ No `blend65.json` project configuration file support
- ❌ No `Blend65Config` interface (the main project config)
- ❌ No `CompilerOptions` interface (unified compiler options)
- ❌ No `ConfigLoader` class (file discovery and loading)
- ❌ No `ConfigValidator` class (validation)
- ❌ No CLI override merging
- ❌ No glob pattern resolution for source files

**Integration Points:**

- `CompilerOptions.target` → maps to existing `TargetArchitecture` enum
- `CompilerOptions.optimization` → maps to existing `OptimizationLevel` enum
- `CompilerOptions.debug` → new (inline/vice/both debug modes)
- The new config system wraps existing infrastructure, adding project-level configuration

---

## Overview

The configuration system provides a `blend65.json` project configuration file, similar to TypeScript's `tsconfig.json`. This enables:

- Project-wide compiler settings
- Multi-file compilation with include/exclude patterns
- Target platform configuration
- Debug and optimization settings
- Output path configuration

---

## Goals

1. **Familiar DX**: Developers familiar with `tsconfig.json` or `package.json` will feel at home
2. **Flexible**: Support both simple single-file and complex multi-file projects
3. **CLI Integration**: CLI flags can override config file settings
4. **Validation**: Clear error messages for invalid configurations
5. **Discoverability**: JSON Schema for IDE autocomplete

---

## Configuration Schema

### Full Schema Definition

```typescript
/**
 * Blend65 project configuration
 *
 * File: blend65.json
 */
interface Blend65Config {
  /**
   * JSON Schema reference for IDE support
   * @example "https://blend65.dev/schema/blend65.json"
   */
  $schema?: string;

  /**
   * Compiler options
   */
  compilerOptions: CompilerOptions;

  /**
   * Glob patterns for source files to include
   * @default ["**/*.blend"]
   * @example ["src/**/*.blend"]
   */
  include?: string[];

  /**
   * Glob patterns for files to exclude
   * @default ["node_modules/**", "build/**"]
   * @example ["src/**/*.test.blend", "src/**/*.spec.blend"]
   */
  exclude?: string[];

  /**
   * Explicit list of files to compile (overrides include/exclude)
   * Use for explicit control over compilation order
   * @example ["src/main.blend", "src/game.blend"]
   */
  files?: string[];

  /**
   * Root directory for source files
   * Used to calculate relative paths in output
   * @default "."
   */
  rootDir?: string;

  /**
   * Emulator configuration for `blend65 run`
   */
  emulator?: EmulatorConfig;

  /**
   * Resource file mappings (sprites, music, etc.)
   * Future: For asset pipeline integration
   */
  resources?: ResourceConfig;
}

/**
 * Compiler-specific options
 */
interface CompilerOptions {
  /**
   * Target platform
   *
   * **Note**: Currently only 'c64' is implemented. Other targets
   * ('c128', 'x16') will generate a "not implemented yet" error.
   *
   * @default "c64"
   */
  target?: 'c64' | 'c128' | 'x16';

  /**
   * Optimization level
   * @default "O0"
   */
  optimization?: 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz';

  /**
   * Debug information generation
   * - "none": No debug info
   * - "inline": Comments in assembly
   * - "vice": VICE label file
   * - "both": Inline + VICE labels
   * @default "none"
   */
  debug?: 'none' | 'inline' | 'vice' | 'both';

  /**
   * Output directory for compiled files
   * @default "./build"
   */
  outDir?: string;

  /**
   * Output filename (without path)
   * If omitted, derived from entry file name
   * @example "game.prg"
   */
  outFile?: string;

  /**
   * Output format
   * - "asm": Assembly source only
   * - "prg": C64 executable (.prg)
   * - "crt": Cartridge image (for cartridge-based programs)
   * - "both": Assembly + PRG
   * @default "prg"
   */
  outputFormat?: 'asm' | 'prg' | 'crt' | 'both';

  /**
   * Enable verbose compiler output
   * @default false
   */
  verbose?: boolean;

  /**
   * Enable strict mode (treat warnings as errors)
   * @default false
   */
  strict?: boolean;

  /**
   * Program load address (C64 default: $0801)
   * @default 2049 (0x0801)
   */
  loadAddress?: number;
}

/**
 * Emulator configuration
 */
interface EmulatorConfig {
  /**
   * Path to emulator executable
   * If omitted, will search PATH for common names
   * @example "/usr/local/bin/x64sc"
   */
  path?: string;

  /**
   * Emulator type (for argument formatting)
   * @default "vice" (auto-detected from path)
   */
  type?: 'vice' | 'x16emu';

  /**
   * Additional command-line arguments
   * @example ["-autostartprgmode", "1", "-autostart-warp"]
   */
  args?: string[];

  /**
   * Automatically run program after loading
   * @default true
   */
  autoRun?: boolean;

  /**
   * Wait for emulator to exit before returning
   * @default false
   */
  waitForExit?: boolean;
}

/**
 * Resource configuration (future)
 */
interface ResourceConfig {
  /**
   * Sprite file patterns
   * @example ["assets/sprites/*.spr"]
   */
  sprites?: string[];

  /**
   * Music file patterns
   * @example ["assets/music/*.sid"]
   */
  music?: string[];

  /**
   * Character set patterns
   * @example ["assets/charsets/*.chr"]
   */
  charsets?: string[];
}
```

---

## Example Configurations

### Minimal Configuration

```json
{
  "compilerOptions": {
    "target": "c64"
  },
  "include": ["*.blend"]
}
```

> **Note**: The compiler automatically detects the program entry point by finding the single `export function main(): void` in the compiled sources. See [Language Specification: Functions](../../docs/language-specification/11-functions.md#entry-point-main-function).

### Standard Game Project

```json
{
  "$schema": "https://blend65.dev/schema/blend65.json",

  "compilerOptions": {
    "target": "c64",
    "optimization": "O0",
    "debug": "both",
    "outDir": "./build",
    "outFile": "game.prg"
  },

  "include": ["src/**/*.blend"],
  "exclude": ["src/**/*.test.blend"],
  "rootDir": "./src",

  "emulator": {
    "path": "x64sc",
    "args": ["-autostartprgmode", "1"],
    "autoRun": true
  }
}
```

### Multi-Target Project

```json
{
  "compilerOptions": {
    "target": "c64",
    "optimization": "O2",
    "outDir": "./build/c64"
  },
  "include": ["src/**/*.blend"]
}
```

---

## File Location

### Config File Resolution

```typescript
/**
 * Config file resolution order:
 *
 * 1. Explicit path via -p/--project flag
 * 2. blend65.json in current directory
 * 3. blend65.json in parent directories (walk up)
 * 4. No config (use defaults + CLI args)
 */
function findConfigFile(explicitPath?: string): string | null {
  // 1. Explicit path
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      throw new ConfigError(`Config file not found: ${explicitPath}`);
    }
    return explicitPath;
  }

  // 2. Current directory
  const localConfig = resolve(process.cwd(), 'blend65.json');
  if (existsSync(localConfig)) {
    return localConfig;
  }

  // 3. NO walking up parent directories

  // 4. No config found
  return null;
}
```

---

## CLI Override System

### Override Priority

```
CLI flags > blend65.json > defaults
```

### Override Mapping

| CLI Flag             | Config Property              | Example              |
| -------------------- | ---------------------------- | -------------------- |
| `-p, --project`      | N/A (config path)            | `-p custom.json`     |
| `-t, --target`       | compilerOptions.target       | `-t c128`            |
| `-O, --optimization` | compilerOptions.optimization | `-O2`                |
| `-d, --debug`        | compilerOptions.debug        | `-d both`            |
| `-o, --out`          | compilerOptions.outDir       | `-o dist`            |
| `--outFile`          | compilerOptions.outFile      | `--outFile game.prg` |
| `-v, --verbose`      | compilerOptions.verbose      | `-v`                 |
| `--strict`           | compilerOptions.strict       | `--strict`           |

### Merge Strategy

```typescript
interface ConfigMergeOptions {
  /** Config from file */
  fileConfig: Partial<Blend65Config>;

  /** CLI overrides */
  cliOverrides: Partial<CompilerOptions>;

  /** Files specified on command line */
  cliFiles?: string[];
}

function mergeConfig(options: ConfigMergeOptions): Blend65Config {
  const defaults = getDefaultConfig();

  // Deep merge: defaults < fileConfig < cliOverrides
  return {
    ...defaults,
    ...options.fileConfig,
    compilerOptions: {
      ...defaults.compilerOptions,
      ...options.fileConfig.compilerOptions,
      ...options.cliOverrides,
    },
    // CLI files override config files/include
    ...(options.cliFiles?.length ? { files: options.cliFiles } : {}),
  };
}
```

---

## Validation

### Validation Rules

1. **Target validation**: Must be supported target (c64, c128, x16)
2. **Target implementation check**: Non-C64 targets generate "not implemented yet" error
3. **Path validation**: outDir must be writable
4. **Pattern validation**: include/exclude must be valid globs
5. **Type checking**: All values must match expected types
6. **Main function validation**: Performed during compilation (semantic analysis)

> **Note**: Entry point validation (`export function main(): void`) is handled by the semantic analyzer during compilation, not by config validation. The config system only validates configuration structure.

### Error Messages

```typescript
// Example validation errors
const validationErrors = [
  {
    path: 'compilerOptions.target',
    message: "Invalid target 'c65'. Valid targets: c64, c128, x16",
    value: 'c65',
  },
  {
    path: 'compilerOptions.target',
    message: "Target 'c128' is not implemented yet. Currently only 'c64' is supported.",
    value: 'c128',
  },
  {
    path: 'compilerOptions.target',
    message: "Target 'x16' is not implemented yet. Currently only 'c64' is supported.",
    value: 'x16',
  },
  {
    path: 'compilerOptions.optimization',
    message: "Invalid optimization level 'O4'. Valid levels: O0, O1, O2, O3, Os, Oz",
    value: 'O4',
  },
  {
    path: 'include',
    message: "Invalid glob pattern: '[invalid'",
    value: '[invalid',
  },
];
```

---

## Implementation

### File Structure

```
packages/compiler/src/config/
├── index.ts              # Public exports
├── types.ts              # Type definitions (interfaces above)
├── schema.ts             # JSON Schema definition
├── defaults.ts           # Default values
├── loader.ts             # Config file loading
├── validator.ts          # Config validation
├── merger.ts             # Config merging (CLI + file)
└── resolver.ts           # File path resolution
```

### Key Classes

```typescript
// config/loader.ts
export class ConfigLoader {
  /**
   * Load configuration from file
   */
  load(path: string): Blend65Config;

  /**
   * Find config file (with directory walking)
   */
  findConfigFile(explicitPath?: string): string | null;

  /**
   * Load and merge with CLI overrides
   */
  loadWithOverrides(options: ConfigLoadOptions): Blend65Config;
}

// config/validator.ts
export class ConfigValidator {
  /**
   * Validate configuration
   * @throws ConfigValidationError if invalid
   */
  validate(config: unknown): asserts config is Blend65Config;

  /**
   * Get validation errors without throwing
   */
  getErrors(config: unknown): ValidationError[];
}

// config/resolver.ts
export class FileResolver {
  /**
   * Resolve files from include/exclude patterns
   */
  resolveFiles(config: Blend65Config): string[];
}
```

---

## Task Breakdown

### Task 0.1: Type Definitions

**File**: `packages/compiler/src/config/types.ts`

Create TypeScript interfaces for configuration schema.

```typescript
// Deliverables:
// - Blend65Config interface
// - CompilerOptions interface
// - EmulatorConfig interface
// - ResourceConfig interface
// - Export all types
```

**Acceptance Criteria:**

- [ ] All interfaces defined
- [ ] JSDoc comments on all properties
- [ ] Default values documented

---

### Task 0.2: Default Values

**File**: `packages/compiler/src/config/defaults.ts`

Define default configuration values.

```typescript
// Deliverables:
// - getDefaultConfig(): Blend65Config
// - getDefaultCompilerOptions(): CompilerOptions
// - getDefaultEmulatorConfig(): EmulatorConfig
```

**Acceptance Criteria:**

- [ ] All defaults defined
- [ ] Defaults match schema documentation
- [ ] Unit tests for defaults

---

### Task 0.3: Config Validator

**File**: `packages/compiler/src/config/validator.ts`

Implement configuration validation.

```typescript
// Deliverables:
// - ConfigValidator class
// - Validation error types
// - Clear error messages
```

**Acceptance Criteria:**

- [ ] Validates all config properties
- [ ] Type coercion where sensible
- [ ] Helpful error messages
- [ ] Unit tests for all validation rules

---

### Task 0.4: Config Loader

**File**: `packages/compiler/src/config/loader.ts`

Implement config file loading.

```typescript
// Deliverables:
// - ConfigLoader class
// - JSON parsing with error handling
// - Config file discovery
```

**Acceptance Criteria:**

- [ ] Loads valid JSON files
- [ ] Handles missing files gracefully
- [ ] Walks up directories to find config
- [ ] Unit tests for loading

---

### Task 0.5: Config Merger

**File**: `packages/compiler/src/config/merger.ts`

Implement configuration merging.

```typescript
// Deliverables:
// - mergeConfig() function
// - CLI override support
// - Deep merge for nested objects
```

**Acceptance Criteria:**

- [ ] Correct merge priority
- [ ] Deep merge for compilerOptions
- [ ] CLI files override config files
- [ ] Unit tests for merge scenarios

---

### Task 0.6: File Resolver

**File**: `packages/compiler/src/config/resolver.ts`

Implement file pattern resolution.

```typescript
// Deliverables:
// - FileResolver class
// - Glob pattern expansion
// - Exclude pattern application
```

**Acceptance Criteria:**

- [ ] Resolves glob patterns
- [ ] Applies exclude patterns
- [ ] Validates file existence
- [ ] Unit tests for patterns

---

### Task 0.7: Public API

**File**: `packages/compiler/src/config/index.ts`

Export public configuration API.

```typescript
// Deliverables:
// - Export all types
// - Export ConfigLoader
// - Export ConfigValidator
// - Export FileResolver
// - Export utility functions
```

**Acceptance Criteria:**

- [ ] Clean public API
- [ ] No internal leakage
- [ ] JSDoc on exports

---

### Task 0.8: Integration Tests

**File**: `packages/compiler/src/__tests__/config/`

Comprehensive integration tests.

```typescript
// Deliverables:
// - End-to-end config loading tests
// - CLI override tests
// - Error handling tests
// - Real file system tests
```

**Acceptance Criteria:**

- [ ] All happy paths tested
- [ ] Error cases tested
- [ ] Edge cases (empty config, missing files)
- [ ] Integration with Compiler class (Phase 1)

---

## Dependencies

### npm Packages Required

```json
{
  "dependencies": {
    "glob": "^10.x", // File pattern matching
    "ajv": "^8.x" // JSON Schema validation (optional)
  }
}
```

### Internal Dependencies

- None (Phase 0 is the foundation)

---

## Test Plan

### Unit Tests

| Test Suite        | Coverage                  |
| ----------------- | ------------------------- |
| types.test.ts     | Type assertions           |
| defaults.test.ts  | Default value correctness |
| validator.test.ts | All validation rules      |
| loader.test.ts    | File loading scenarios    |
| merger.test.ts    | Merge strategies          |
| resolver.test.ts  | Pattern resolution        |

### Integration Tests

| Test Case           | Description                            |
| ------------------- | -------------------------------------- |
| Load minimal config | blend65.json with only required fields |
| Load full config    | All options specified                  |
| CLI override        | Verify CLI takes precedence            |
| Missing config      | Graceful fallback to defaults          |
| Invalid config      | Clear error messages                   |
| Pattern expansion   | include/exclude globs work             |

---

## Task Checklist

| Task | Description       | Status |
| ---- | ----------------- | ------ |
| 0.1  | Type Definitions  | [x]    |
| 0.2  | Default Values    | [x]    |
| 0.3  | Config Validator  | [x]    |
| 0.4  | Config Loader     | [x]    |
| 0.5  | Config Merger     | [x]    |
| 0.6  | File Resolver     | [x]    |
| 0.7  | Public API        | [x]    |
| 0.8  | Integration Tests | [x]    |

---

## Next Steps

After Phase 0 is complete:

1. **Phase 1**: Compiler Entry Point (uses config)
2. **Phase 4**: CLI (uses config loader)

---

**This document defines the configuration system for Blend65 projects.**