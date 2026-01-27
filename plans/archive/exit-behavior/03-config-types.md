# Config Types: Exit Behavior

> **Document**: 03-config-types.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies the type definitions needed for the `exitBehavior` option across the configuration system.

## Architecture

```
packages/compiler/src/config/types.ts     ← ExitBehavior type + CompilerOptions
packages/compiler/src/codegen/types.ts    ← CodegenOptions.exitBehavior
packages/cli/src/commands/types.ts        ← BuildOptions.exitBehavior (optional)
```

## Implementation Details

### New Type: ExitBehavior

Add to `packages/compiler/src/config/types.ts`:

```typescript
/**
 * Program exit behavior mode
 *
 * Controls what happens when the main function returns.
 *
 * - 'loop': Infinite loop (safest, prevents crash)
 * - 'basic': Return to BASIC READY prompt (JMP $A474)
 * - 'reset': Soft system reset (JMP $FCE2)
 *
 * @default "loop"
 */
export type ExitBehavior = 'loop' | 'basic' | 'reset';
```

### Update: CompilerOptions

Add to `packages/compiler/src/config/types.ts` in `CompilerOptions` interface:

```typescript
export interface CompilerOptions {
  // ... existing options ...

  /**
   * Program exit behavior
   *
   * Controls what the program does when main() returns:
   *
   * - 'loop': Infinite loop (safe default, prevents crash)
   * - 'basic': Return to BASIC READY prompt (JMP $A474 on C64)
   * - 'reset': Soft system reset (JMP $FCE2 on C64)
   *
   * **Note:** Exit addresses are target-specific. Currently only
   * C64 addresses are implemented. Other targets use 'loop'.
   *
   * @default "loop"
   */
  exitBehavior?: ExitBehavior;
}
```

### Update: CodegenOptions

Add to `packages/compiler/src/codegen/types.ts`:

```typescript
import type { ExitBehavior } from '../config/types.js';

export interface CodegenOptions {
  // ... existing options ...

  /**
   * Program exit behavior
   *
   * Controls what code is generated after main() returns.
   *
   * @default "loop"
   */
  exitBehavior?: ExitBehavior;
}
```

### Update: Export in index.ts

Ensure `ExitBehavior` is exported from `packages/compiler/src/config/index.ts`:

```typescript
export type {
  // ... existing exports ...
  ExitBehavior,
} from './types.js';
```

## Code Examples

### Example 1: Using ExitBehavior in blend65.json

```json
{
  "$schema": "https://blend65.dev/schema/blend65.json",
  "compilerOptions": {
    "target": "c64",
    "optimization": "O0",
    "exitBehavior": "basic"
  },
  "include": ["src/**/*.blend"]
}
```

### Example 2: Programmatic Usage

```typescript
import { Compiler, type Blend65Config } from '@blend65/compiler';

const config: Blend65Config = {
  compilerOptions: {
    target: 'c64',
    exitBehavior: 'basic', // Return to BASIC after main()
  },
};

const compiler = new Compiler();
const result = compiler.compile({ files: ['main.blend'], config });
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Invalid exitBehavior value | Yargs validates against choices; reject with error |
| Missing option | Use default 'loop' |
| Non-C64 target with basic/reset | Fall back to 'loop', emit warning |

## Testing Requirements

- Unit tests for type validation
- Integration tests for config loading
- Tests for default value application