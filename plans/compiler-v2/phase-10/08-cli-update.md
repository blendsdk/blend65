# CLI Update

> **Document**: 08-cli-update.md
> **Parent**: [Index](00-index.md)

## Overview

Update the `packages/cli/` package to import from `@blend65/compiler-v2` instead of `@blend65/compiler`.

## Current CLI Imports

The CLI imports from v1 in 3 files:

**`packages/cli/src/commands/build.ts`:**
```typescript
import { Compiler, type Blend65Config } from '@blend65/compiler';
```

**`packages/cli/src/commands/check.ts`:**
```typescript
import { Compiler, type Blend65Config } from '@blend65/compiler';
```

**`packages/cli/src/output/formatter.ts`:**
```typescript
import type { Diagnostic } from '@blend65/compiler/dist/ast/diagnostics.js';
import { SourceRegistry } from '@blend65/compiler';
```

## Changes Required

### Step 1: Update package.json dependency

File: `packages/cli/package.json`

Change `@blend65/compiler` dependency to `@blend65/compiler-v2` (or update after v2 rename — see 09-v1-removal.md).

### Step 2: Update import paths

Replace all `@blend65/compiler` imports with `@blend65/compiler-v2` across:
- `commands/build.ts`
- `commands/check.ts`
- `output/formatter.ts`

### Step 3: Verify API compatibility

The v2 `Compiler` class must expose the same public API:
- `compile(options: CompileOptions): CompilationResult` ✅
- `check(files: string[], config: Blend65Config): CompilationResult` ✅
- `compileSource(sources, config): CompilationResult` ✅

The v2 must export the same types:
- `Compiler` class ✅
- `Blend65Config` type ✅
- `Diagnostic` type ✅
- `formatDiagnostics` function ✅

### Step 4: Handle SourceRegistry

V2 does **not** currently have `SourceRegistry`. It must be copied from v1:
- **Source**: `packages/compiler/src/utils/source-registry.ts`
- **Target**: `packages/compiler-v2/src/utils/source-registry.ts`
- Update import paths to use v2 diagnostics module
- The CLI formatter.ts actively uses SourceRegistry, so it **must** be ported (not removed)
- This should already be done in Phase 10D (see 06-pipeline-compiler.md)

## Testing Requirements

- CLI `build` command works with v2 compiler
- CLI `check` command works with v2 compiler
- Error formatting works with v2 diagnostics
- `blend65 build examples/simple/main.blend` produces output

## Dependencies

- Compiler class with public API (06-pipeline-compiler.md)
- v2 must export all types CLI needs
