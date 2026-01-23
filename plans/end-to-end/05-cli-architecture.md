# Phase 4a: CLI Architecture

> **Status**: Planning  
> **Phase**: 4a  
> **Priority**: HIGH  
> **Dependencies**: Phases 0-3  
> **Estimated Tasks**: 6

---

## Codebase Analysis (Validated)

**CLI Package Status: DOES NOT EXIST**

The `packages/cli/` directory does **not exist yet**. This is a **new package** to be created.

**What Exists in Compiler Package to Integrate:**

1. **Compiler Exports (`compiler/src/index.ts`)**:
   - Lexer, Parser, Semantic Analyzer, IL Generator already exported
   - Need unified `Compiler` class (see Phase 1 - 02-compiler-entry.md)

2. **Configuration Infrastructure (`target/config.ts`)**:
   - `TargetConfig`, `TargetArchitecture` (C64, C128, X16)
   - `OptimizationLevel` (O0-O3, Os, Oz)
   - Target-specific configs: `C64_CONFIG`, `C64_NTSC_CONFIG`

3. **Diagnostics System (`ast/diagnostics.ts`)**:
   - `Diagnostic` interface with severity, code, message, location
   - `DiagnosticCollector` for aggregating errors/warnings
   - Already has structured error data for CLI formatting

**CLI Package Creation Requirements:**

1. **New monorepo package**: `packages/cli/`
2. **Workspace dependency**: `"@blend65/compiler": "workspace:*"`
3. **Entry point**: `bin/blend65.js` → `src/index.ts`
4. **Key dependencies**: yargs, chalk, chokidar, ora, glob

**Integration Points:**

| Compiler Component | CLI Usage |
|--------------------|-----------|
| `Compiler.compile()` | Build command invokes this |
| `DiagnosticCollector` | Format errors for terminal |
| `TargetConfig` | Load from blend65.json |
| `OptimizationLevel` | Map from CLI `-O` flag |

---

## Overview

The CLI (Command-Line Interface) package provides a professional command-line tool for Blend65 compilation. Built with yargs, it offers:

1. Intuitive command structure
2. Configuration file integration
3. Cross-platform support
4. Clear error reporting
5. Watch mode for development

---

## Package Structure

### Separate Package

```
packages/
├── compiler/                 # Core compiler (existing)
│   └── src/
│       └── index.ts          # Exports Compiler class
│
└── cli/                      # NEW: CLI package
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts          # Entry point (#!/usr/bin/env node)
    │   ├── cli.ts            # Main CLI class
    │   ├── commands/
    │   │   ├── index.ts      # Command registry
    │   │   ├── init.ts       # blend65 init
    │   │   ├── build.ts      # blend65 build
    │   │   ├── run.ts        # blend65 run
    │   │   ├── watch.ts      # blend65 watch
    │   │   └── check.ts      # blend65 check
    │   ├── config/
    │   │   ├── index.ts      # Config exports
    │   │   ├── loader.ts     # Load blend65.json
    │   │   └── finder.ts     # Find config file
    │   ├── runners/
    │   │   ├── index.ts      # Runner exports
    │   │   ├── types.ts      # Runner interface
    │   │   └── vice.ts       # VICE emulator runner
    │   ├── output/
    │   │   ├── index.ts      # Output exports
    │   │   ├── formatter.ts  # Error/warning formatting
    │   │   ├── colors.ts     # Terminal colors (chalk)
    │   │   └── progress.ts   # Progress indicators
    │   └── utils/
    │       ├── index.ts      # Utility exports
    │       ├── files.ts      # File operations
    │       └── spawn.ts      # Process spawning
    └── bin/
        └── blend65.js        # Executable entry point
```

### package.json

```json
{
  "name": "@blend65/cli",
  "version": "0.1.0",
  "description": "Command-line interface for Blend65 compiler",
  "type": "module",
  "bin": {
    "blend65": "./bin/blend65.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "test": "vitest run"
  },
  "dependencies": {
    "@blend65/compiler": "workspace:*",
    "yargs": "^17.x",
    "chalk": "^5.x",
    "chokidar": "^3.x",
    "glob": "^10.x",
    "ora": "^7.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "@types/yargs": "^17.x",
    "typescript": "^5.x",
    "vitest": "^1.x"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## Command Structure

### Top-Level Commands

```bash
blend65 <command> [options] [files...]

Commands:
  blend65 init [name]         Initialize a new Blend65 project
  blend65 build [files...]    Build/compile the project
  blend65 run [files...]      Build and run in emulator
  blend65 watch [files...]    Watch files and rebuild on change
  blend65 check [files...]    Check syntax without building

Options:
  -p, --project <path>  Path to blend65.json config file [default: "blend65.json"]
  -v, --verbose         Enable verbose output
  -h, --help           Show help
  --version            Show version number
```

### Global Options

All commands support these options:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--project` | `-p` | Config file path | `blend65.json` |
| `--verbose` | `-v` | Verbose output | `false` |
| `--help` | `-h` | Show help | - |
| `--version` | - | Show version | - |

---

## Entry Point

### bin/blend65.js

```javascript
#!/usr/bin/env node
import { main } from '../dist/index.js';
main(process.argv.slice(2));
```

### src/index.ts

```typescript
// src/index.ts

import { Blend65CLI } from './cli.js';

/**
 * Main entry point for CLI
 */
export async function main(args: string[]): Promise<void> {
  const cli = new Blend65CLI();
  const exitCode = await cli.run(args);
  process.exit(exitCode);
}

// Re-export for programmatic use
export { Blend65CLI } from './cli.js';
export * from './commands/index.js';
export * from './config/index.js';
```

### src/cli.ts

```typescript
// src/cli.ts

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';

import { initCommand } from './commands/init.js';
import { buildCommand } from './commands/build.js';
import { runCommand } from './commands/run.js';
import { watchCommand } from './commands/watch.js';
import { checkCommand } from './commands/check.js';

/**
 * Main CLI class
 * 
 * Orchestrates command parsing and execution using yargs.
 */
export class Blend65CLI {
  /**
   * Run the CLI with given arguments
   * 
   * @param args - Command-line arguments (without node/script)
   * @returns Exit code (0 = success)
   */
  async run(args: string[]): Promise<number> {
    try {
      await yargs(args)
        .scriptName('blend65')
        .usage('$0 <command> [options]')
        
        // Global options
        .option('project', {
          alias: 'p',
          type: 'string',
          description: 'Path to blend65.json config file',
          default: 'blend65.json',
        })
        .option('verbose', {
          alias: 'v',
          type: 'boolean',
          description: 'Enable verbose output',
          default: false,
        })
        
        // Commands
        .command(initCommand)
        .command(buildCommand)
        .command(runCommand)
        .command(watchCommand)
        .command(checkCommand)
        
        // Help and version
        .help('help')
        .alias('help', 'h')
        .version()
        
        // Require a command
        .demandCommand(1, 'You must specify a command')
        
        // Show help on error
        .showHelpOnFail(true)
        
        // Handle errors
        .fail((msg, err, yargs) => {
          if (err) {
            console.error(chalk.red('Error:'), err.message);
            if (process.env.DEBUG) {
              console.error(err.stack);
            }
          } else {
            console.error(chalk.red('Error:'), msg);
            console.log();
            yargs.showHelp();
          }
          process.exit(1);
        })
        
        .parse();
      
      return 0;
    } catch (error) {
      console.error(chalk.red('Unexpected error:'), error);
      return 1;
    }
  }
}
```

---

## Command Interface

### Command Structure

```typescript
// commands/types.ts

import type { CommandModule } from 'yargs';

/**
 * Base options available to all commands
 */
export interface GlobalOptions {
  project: string;
  verbose: boolean;
}

/**
 * Command context passed to handlers
 */
export interface CommandContext {
  /** Resolved config file path (or null if not found) */
  configPath: string | null;
  
  /** Loaded configuration */
  config: Blend65Config | null;
  
  /** Verbose mode enabled */
  verbose: boolean;
}

/**
 * Command handler function
 */
export type CommandHandler<T> = (args: T & GlobalOptions) => Promise<void>;
```

### Example Command (build)

```typescript
// commands/build.ts

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { Compiler } from '@blend65/compiler';
import { loadConfig } from '../config/loader.js';
import { formatDiagnostics } from '../output/formatter.js';
import type { GlobalOptions } from './types.js';

interface BuildOptions extends GlobalOptions {
  target?: string;
  optimization?: string;
  debug?: string;
  out?: string;
  outFile?: string;
}

export const buildCommand: CommandModule<GlobalOptions, BuildOptions> = {
  command: 'build [files...]',
  describe: 'Build/compile the project',
  
  builder: (yargs) => {
    return yargs
      .positional('files', {
        describe: 'Source files to compile (overrides config)',
        type: 'string',
        array: true,
      })
      .option('target', {
        alias: 't',
        type: 'string',
        description: 'Target platform (c64, c128, x16)',
        choices: ['c64', 'c128', 'x16'],
      })
      .option('optimization', {
        alias: 'O',
        type: 'string',
        description: 'Optimization level',
        choices: ['O0', 'O1', 'O2', 'O3', 'Os', 'Oz'],
      })
      .option('debug', {
        alias: 'd',
        type: 'string',
        description: 'Debug information',
        choices: ['none', 'inline', 'vice', 'both'],
      })
      .option('out', {
        alias: 'o',
        type: 'string',
        description: 'Output directory',
      })
      .option('outFile', {
        type: 'string',
        description: 'Output filename',
      })
      .example('$0 build', 'Build using blend65.json')
      .example('$0 build -t c64 -O2', 'Build with overrides')
      .example('$0 build game.blend', 'Build single file');
  },
  
  handler: async (args) => {
    const startTime = Date.now();
    
    // Load configuration
    const config = await loadConfig(args.project, {
      target: args.target,
      optimization: args.optimization,
      debug: args.debug,
      outDir: args.out,
      outFile: args.outFile,
    });
    
    if (args.verbose) {
      console.log(chalk.gray('Config:'), config);
    }
    
    // Resolve files
    const files = args.files?.length > 0 
      ? args.files 
      : await resolveFilesFromConfig(config);
    
    console.log(chalk.blue('Compiling'), files.length, 'file(s)...');
    
    // Compile
    const compiler = new Compiler();
    const result = compiler.compile({ files, config });
    
    // Report results
    if (result.diagnostics.length > 0) {
      console.log(formatDiagnostics(result.diagnostics));
    }
    
    if (result.success) {
      const elapsed = Date.now() - startTime;
      console.log(chalk.green('✓'), 'Build succeeded in', elapsed, 'ms');
      
      // Write output files
      await writeOutputFiles(result, config);
    } else {
      const errors = result.diagnostics.filter(d => d.severity === 'error').length;
      console.log(chalk.red('✗'), 'Build failed with', errors, 'error(s)');
      process.exit(1);
    }
  },
};
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Compilation error (syntax, type, etc.) |
| 2 | Configuration error |
| 3 | File not found |
| 4 | Emulator error |
| 5 | Internal error |

```typescript
// utils/exit-codes.ts

export const ExitCode = {
  SUCCESS: 0,
  COMPILATION_ERROR: 1,
  CONFIG_ERROR: 2,
  FILE_NOT_FOUND: 3,
  EMULATOR_ERROR: 4,
  INTERNAL_ERROR: 5,
} as const;

export type ExitCode = typeof ExitCode[keyof typeof ExitCode];
```

---

## Output Formatting

### Error Formatting

```typescript
// output/formatter.ts

import chalk from 'chalk';
import type { Diagnostic } from '@blend65/compiler';

export function formatDiagnostic(d: Diagnostic): string {
  const loc = d.location;
  const severityColor = d.severity === 'error' ? chalk.red : chalk.yellow;
  const prefix = severityColor(d.severity + ':');
  
  return `${prefix} ${d.message}
  ${chalk.gray('-->')} ${loc.source}:${loc.start.line}:${loc.start.column}`;
}

export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics.map(formatDiagnostic).join('\n\n');
}
```

### Progress Indicators

```typescript
// output/progress.ts

import ora from 'ora';

export function createSpinner(text: string) {
  return ora({
    text,
    color: 'cyan',
  });
}

// Usage:
// const spinner = createSpinner('Compiling...');
// spinner.start();
// ... do work ...
// spinner.succeed('Compiled successfully');
```

---

## Task Breakdown

### Task 4a.1: Package Setup
**Files**: `packages/cli/package.json`, `tsconfig.json`

Create CLI package structure.

```typescript
// Deliverables:
// - package.json with dependencies
// - tsconfig.json
// - Directory structure
// - Workspace integration
```

**Acceptance Criteria:**
- [ ] Package builds successfully
- [ ] Dependencies installed
- [ ] TypeScript configured
- [ ] Workspace linked to compiler

---

### Task 4a.2: CLI Entry Point
**Files**: `packages/cli/src/index.ts`, `packages/cli/src/cli.ts`, `packages/cli/bin/blend65.js`

Create main CLI entry and yargs setup.

```typescript
// Deliverables:
// - Executable entry point
// - Blend65CLI class
// - yargs configuration
// - Global options
```

**Acceptance Criteria:**
- [ ] `blend65 --help` works
- [ ] `blend65 --version` works
- [ ] Global options parsed
- [ ] Commands routed correctly

---

### Task 4a.3: Config Loader
**Files**: `packages/cli/src/config/`

Implement config file loading and merging.

```typescript
// Deliverables:
// - ConfigLoader class
// - Config file finder
// - CLI override merging
// - Validation errors
```

**Acceptance Criteria:**
- [ ] Loads blend65.json
- [ ] Merges CLI overrides
- [ ] Reports validation errors
- [ ] Unit tests pass

---

### Task 4a.4: Output Formatting
**Files**: `packages/cli/src/output/`

Implement terminal output formatting.

```typescript
// Deliverables:
// - Error/warning formatter
// - Color support
// - Progress spinners
// - Verbose output
```

**Acceptance Criteria:**
- [ ] Errors formatted correctly
- [ ] Colors work in terminals
- [ ] Spinners work
- [ ] Verbose mode works

---

### Task 4a.5: Utility Functions
**Files**: `packages/cli/src/utils/`

Implement utility functions.

```typescript
// Deliverables:
// - File operations
// - Process spawning
// - Exit codes
// - Path utilities
```

**Acceptance Criteria:**
- [ ] File operations work
- [ ] Spawning works cross-platform
- [ ] Exit codes defined
- [ ] Unit tests pass

---

### Task 4a.6: Integration & Tests
**Files**: `packages/cli/src/__tests__/`

Integration tests for CLI.

```typescript
// Deliverables:
// - CLI integration tests
// - Command tests
// - Config loading tests
// - Error handling tests
```

**Acceptance Criteria:**
- [ ] All commands testable
- [ ] Error cases handled
- [ ] Integration tests pass
- [ ] Cross-platform tested

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 4a.1 | Package Setup | [ ] |
| 4a.2 | CLI Entry Point | [ ] |
| 4a.3 | Config Loader | [ ] |
| 4a.4 | Output Formatting | [ ] |
| 4a.5 | Utility Functions | [ ] |
| 4a.6 | Integration & Tests | [ ] |

---

## Dependencies

### npm Packages

```json
{
  "dependencies": {
    "@blend65/compiler": "workspace:*",
    "yargs": "^17.x",         // CLI argument parsing
    "chalk": "^5.x",          // Terminal colors
    "chokidar": "^3.x",       // File watching
    "glob": "^10.x",          // File pattern matching
    "ora": "^7.x"             // Spinners
  }
}
```

---

**This document defines the CLI architecture for Blend65.**