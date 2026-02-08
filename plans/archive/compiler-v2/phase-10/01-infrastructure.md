# Infrastructure Migration

> **Document**: 01-infrastructure.md
> **Parent**: [Index](00-index.md)

## Overview

Migrate Config types, Target system, and Library loader from v1 to v2. These are supporting infrastructure that the Compiler class needs to orchestrate the pipeline.

## Components to Migrate

### 1. Config Types (`config/types.ts`)

**Source**: `packages/compiler/src/config/types.ts`
**Target**: `packages/compiler-v2/src/config/types.ts`

**What to copy (as-is):**
- `TargetPlatform` type (`'c64' | 'c128' | 'x16'`)
- `OptimizationLevelId` type (`'O0' | 'O1' | ... | 'Oz'`)
- `DebugMode` type (`'none' | 'inline' | 'vice' | 'both'`)
- `OutputFormat` type (`'asm' | 'prg' | 'crt' | 'both'`)
- `EmulatorType` type
- `CompilerOptions` interface
- `EmulatorConfig` interface
- `ResourceConfig` interface
- `Blend65Config` interface
- `ConfigValidationError` interface
- `ConfigLoadOptions` interface

**Changes needed**: None — these are pure type definitions with no imports from v1-specific modules.

### 2. Target System (`target/`)

**Source**: `packages/compiler/src/target/`
**Target**: `packages/compiler-v2/src/target/`

**Files to copy:**

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `architecture.ts` | `TargetArchitecture` enum, `parseTargetArchitecture()`, `isTargetImplemented()` | None |
| `config.ts` | `TargetConfig` interface (memory layout, ZP ranges, hardware registers) | None |
| `registry.ts` | `getTargetConfig()`, `getDefaultTargetConfig()` | None |
| `index.ts` | Re-exports | None |
| `configs/` | Target-specific config files (c64.ts, etc.) | None |

**Why no changes**: The target system is pure data definitions and helper functions. It has no dependencies on v1-specific compiler code.

### 3. Library Loader (`library/loader.ts`)

**Source**: `packages/compiler/src/library/loader.ts`
**Target**: `packages/compiler-v2/src/library/loader.ts`

**Changes needed:**
- Update import paths: `from '../ast/diagnostics.js'` → use v2 diagnostics
- Update `import.meta.url` resolution to point to `packages/compiler-v2/library/`
- Everything else (loading logic, `@stdlib/` prefix, auto-loading behavior) stays the same

**Key behavior (must preserve):**
1. `common/` — always loaded for all targets
2. `{target}/common/` — always loaded for specific target
3. `{target}/{library}` — opt-in libraries
4. Single file: `{library}.blend` → load that file
5. Folder: `{library}/` → load all `.blend` files recursively

### 4. Config Index (`config/index.ts`)

**Create**: `packages/compiler-v2/src/config/index.ts`
**Content**: Re-export types from `types.ts`

### 5. SourceRegistry (`utils/source-registry.ts`)

**Source**: `packages/compiler/src/utils/source-registry.ts`
**Target**: `packages/compiler-v2/src/utils/source-registry.ts`

**Changes needed:**
- Update import path: `from '../ast/diagnostics.js'` → use v2 diagnostics

**Why needed**: The CLI's `formatter.ts` imports `SourceRegistry` to format error output with source context. Without this, the CLI cannot display proper error messages.

## Architecture

```
packages/compiler-v2/src/
├── config/
│   ├── types.ts          ← Copy from v1 (no changes)
│   └── index.ts          ← New: re-exports
├── target/
│   ├── architecture.ts   ← Copy from v1 (no changes)
│   ├── config.ts         ← Copy from v1 (no changes)
│   ├── registry.ts       ← Copy from v1 (no changes)
│   ├── index.ts          ← Copy from v1 (no changes)
│   └── configs/
│       └── c64.ts        ← Copy from v1 (no changes)
├── library/
│   ├── loader.ts         ← Copy from v1, update import paths
│   └── index.ts          ← New: re-exports
└── utils/
    └── source-registry.ts ← Copy from v1, update import paths
```

## Testing Requirements

- Unit tests for `LibraryLoader` (loading common/, target/common/, optional libraries)
- Unit tests for `TargetConfig` resolution
- Integration test: LibraryLoader loads real library files from `packages/compiler-v2/library/`

## Error Handling

The library loader creates `Diagnostic` objects for errors. Ensure the v2 `Diagnostic` type is compatible with what the loader produces.

## Dependencies

- v2 AST diagnostics module (`ast/diagnostics.ts`) — already exists in v2
- No other v2 module dependencies
