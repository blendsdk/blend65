# Package Setup: Compiler v2

> **Document**: 03-package-setup.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Planning Complete

## Overview

This document describes how to set up the new `packages/compiler-v2/` package. The v2 compiler will be a separate package to ensure a clean start while maintaining compatibility with the existing monorepo structure.

## Directory Structure

### Final Structure

```
packages/compiler-v2/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public exports
│   ├── compiler.ts           # Main Compiler class
│   │
│   ├── lexer/                # Tokenization (copied from v1)
│   │   ├── index.ts
│   │   ├── lexer.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   │
│   ├── parser/               # Parsing (copied from v1)
│   │   ├── index.ts
│   │   ├── base.ts
│   │   ├── expressions.ts
│   │   ├── statements.ts
│   │   ├── declarations.ts
│   │   ├── modules.ts
│   │   └── parser.ts
│   │
│   ├── ast/                  # AST definitions (copied from v1)
│   │   ├── index.ts
│   │   ├── base.ts
│   │   ├── nodes.ts
│   │   ├── type-guards.ts
│   │   ├── diagnostics.ts
│   │   └── walker/
│   │
│   ├── semantic/             # Semantic analysis
│   │   ├── index.ts
│   │   ├── analyzer.ts
│   │   ├── type-system.ts
│   │   ├── types.ts
│   │   ├── symbol.ts
│   │   ├── symbol-table.ts
│   │   ├── scope.ts
│   │   ├── call-graph.ts     # NEW: Call graph builder
│   │   └── recursion-check.ts # NEW: Recursion detection
│   │
│   ├── frame/                # NEW: Static Frame Allocation
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── allocator.ts
│   │   └── layout.ts
│   │
│   ├── il/                   # NEW: Simple Linear IL
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── builder.ts
│   │   ├── generator.ts
│   │   └── printer.ts
│   │
│   ├── codegen/              # NEW: SFA Code Generator
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── generator.ts
│   │   ├── intrinsics.ts
│   │   └── emitter.ts
│   │
│   ├── optimizer/            # ASM Optimization
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── optimizer.ts
│   │   └── passes/
│   │       ├── redundant-load.ts
│   │       └── dead-store.ts
│   │
│   ├── asm-il/               # Assembly IL (copied from v1)
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── builder/
│   │   └── emitters/
│   │
│   ├── config/               # Configuration (copied from v1)
│   │   └── ...
│   │
│   ├── library/              # Library loader (copied from v1)
│   │   └── ...
│   │
│   ├── target/               # Target configs (copied from v1)
│   │   └── ...
│   │
│   ├── utils/                # Utilities (copied from v1)
│   │   └── ...
│   │
│   └── __tests__/            # Test files
│       ├── lexer/
│       ├── parser/
│       ├── ast/
│       ├── semantic/
│       ├── frame/
│       ├── il/
│       ├── codegen/
│       ├── optimizer/
│       ├── integration/
│       └── e2e/
```

---

## Package Configuration

### package.json

```json
{
  "name": "@blend65/compiler-v2",
  "version": "2.0.0-alpha.0",
  "description": "Blend65 Compiler v2 with Static Frame Allocation",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "keywords": [
    "6502",
    "compiler",
    "c64",
    "commodore",
    "blend65"
  ],
  "author": "Blend65 Team",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/blendsdk/blend65.git",
    "directory": "packages/compiler-v2"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

---

## Monorepo Integration

### Update Root turbo.json

Add the new package to the build pipeline:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "@blend65/compiler-v2#build": {
      "dependsOn": [],
      "outputs": ["dist/**"]
    }
  }
}
```

### Update Root package.json

If using yarn workspaces, the new package will be automatically detected in `packages/`.

---

## Initial Files

### src/index.ts

```typescript
/**
 * Blend65 Compiler v2
 * 
 * Static Frame Allocation (SFA) based compiler for 6502.
 */

// Core compiler
export { Compiler } from './compiler.js';
export type { CompilerOptions, CompilationResult } from './compiler.js';

// Lexer
export { Lexer } from './lexer/index.js';
export type { Token, TokenType } from './lexer/index.js';

// Parser
export { Parser } from './parser/index.js';

// AST
export * from './ast/index.js';

// Semantic
export { SemanticAnalyzer } from './semantic/index.js';

// Frame Allocator
export { FrameAllocator } from './frame/index.js';
export type { Frame, FrameSlot } from './frame/index.js';

// IL
export { ILGenerator } from './il/index.js';
export type { ILFunction, ILInstruction } from './il/index.js';

// Code Generator
export { CodeGenerator } from './codegen/index.js';

// Version info
export const VERSION = '2.0.0-alpha.0';
```

### src/compiler.ts (Skeleton)

```typescript
/**
 * Main Compiler class for Blend65 v2.
 * 
 * Pipeline:
 * Source → Lexer → Parser → Semantic → Frame → IL → CodeGen → ASM
 */

import { Lexer } from './lexer/index.js';
import { Parser } from './parser/index.js';
import { SemanticAnalyzer } from './semantic/index.js';
import { FrameAllocator } from './frame/index.js';
import { ILGenerator } from './il/index.js';
import { CodeGenerator } from './codegen/index.js';

export interface CompilerOptions {
  /** Optimization level: 0 (none), 1 (basic), 2 (full) */
  optimizationLevel: 0 | 1 | 2;
  /** Target platform */
  target: 'c64' | 'x16';
  /** Generate source maps */
  sourceMaps: boolean;
}

export interface CompilationResult {
  /** Success flag */
  success: boolean;
  /** Generated assembly code */
  assembly?: string;
  /** Compilation errors */
  errors: CompilationError[];
  /** Compilation warnings */
  warnings: CompilationWarning[];
}

export interface CompilationError {
  message: string;
  line: number;
  column: number;
  file?: string;
}

export interface CompilationWarning {
  message: string;
  line: number;
  column: number;
  file?: string;
}

export class Compiler {
  protected options: CompilerOptions;

  constructor(options: Partial<CompilerOptions> = {}) {
    this.options = {
      optimizationLevel: 1,
      target: 'c64',
      sourceMaps: false,
      ...options,
    };
  }

  /**
   * Compile source code to assembly.
   */
  compile(source: string, filename?: string): CompilationResult {
    // TODO: Implement in Phase 10
    throw new Error('Not implemented');
  }
}
```

---

## Setup Steps

### Session 1.1 Tasks

| # | Task | Description |
|---|------|-------------|
| 1.1.1 | Create directory | `mkdir -p packages/compiler-v2/src` |
| 1.1.2 | Create package.json | With content above |
| 1.1.3 | Create tsconfig.json | With content above |
| 1.1.4 | Create src/index.ts | Initial exports |
| 1.1.5 | Create src/compiler.ts | Skeleton class |
| 1.1.6 | Update turbo.json | Add v2 package |
| 1.1.7 | Run yarn install | Register new package |
| 1.1.8 | Verify build | `yarn build` succeeds |

### Verification Commands

```bash
# Create package
mkdir -p packages/compiler-v2/src

# Install dependencies
yarn install

# Build to verify setup
yarn build

# Verify package is recognized
yarn workspace @blend65/compiler-v2 build
```

---

## Subdirectory Setup

Create empty index.ts files for all subdirectories:

```bash
# Create directories
mkdir -p packages/compiler-v2/src/{lexer,parser,ast,semantic,frame,il,codegen,optimizer,asm-il,config,library,target,utils}
mkdir -p packages/compiler-v2/src/__tests__/{lexer,parser,ast,semantic,frame,il,codegen,optimizer,integration,e2e}

# Create placeholder index files
for dir in lexer parser ast semantic frame il codegen optimizer asm-il config library target utils; do
  echo "// TODO: Implement in Phase 2+" > packages/compiler-v2/src/$dir/index.ts
done
```

---

## Dependencies

### No External Dependencies

The v2 compiler will have **zero external runtime dependencies**, just like v1:
- All code generation is built-in
- ACME assembler invocation is optional (can output .asm files)

### Dev Dependencies Only

- TypeScript (build)
- Vitest (testing)
- ESLint (linting, optional)

---

## CLI Integration (Later)

After v2 is complete, update the CLI package to use it:

```typescript
// packages/cli/src/commands/compile.ts

// Change from:
import { Compiler } from '@blend65/compiler';

// To:
import { Compiler } from '@blend65/compiler-v2';
```

This happens in Phase 10 (Integration).

---

## Related Documents

| Document | Description |
|----------|-------------|
| [01-requirements.md](01-requirements.md) | What we're building |
| [02-salvage-analysis.md](02-salvage-analysis.md) | What to copy from v1 |
| [04-lexer-migration.md](04-lexer-migration.md) | Next: Lexer setup |
| [99-execution-plan.md](99-execution-plan.md) | Full task list |