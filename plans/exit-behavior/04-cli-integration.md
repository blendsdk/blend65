# CLI Integration: Exit Behavior

> **Document**: 04-cli-integration.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies the CLI integration for the `--exit-behavior` option in the `blend65 build` command.

## Architecture

```
User: blend65 build main.blend --exit-behavior=basic
                ↓
packages/cli/src/commands/build.ts
  → yargs option definition
  → buildConfig() creates CompilerOptions
                ↓
packages/compiler/src/compiler.ts
  → Receives Blend65Config with exitBehavior
  → Passes to code generation phase
                ↓
packages/compiler/src/codegen/code-generator.ts
  → Uses exitBehavior in generateEntryPoint()
```

## Implementation Details

### Update: BuildOptions Interface

Add to `packages/cli/src/commands/build.ts` (or types.ts):

```typescript
export interface BuildOptions extends GlobalOptions {
  // ... existing options ...

  /** Program exit behavior (loop, basic, reset) */
  exitBehavior?: string;
}
```

### Update: Yargs Builder

Add option in `buildCommand.builder`:

```typescript
builder: (yargs) => {
  return yargs
    // ... existing options ...
    .option('exit-behavior', {
      alias: 'e',
      type: 'string',
      description: 'Program exit behavior when main() returns',
      choices: ['loop', 'basic', 'reset'] as const,
      default: 'loop',
    })
    // ... examples ...
    .example('$0 build src/main.blend --exit-behavior=basic', 'Return to BASIC when done');
},
```

### Update: buildConfig Function

Modify `buildConfig()` to include `exitBehavior`:

```typescript
function buildConfig(args: ArgumentsCamelCase<BuildOptions>): Blend65Config {
  return {
    compilerOptions: {
      target: (args.target as 'c64' | 'c128' | 'x16') || 'c64',
      optimization: (args.optimization as 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz') || 'O0',
      debug: (args.debug as 'none' | 'inline' | 'vice' | 'both') || 'none',
      outDir: args.out || './build',
      outFile: args.outFile,
      outputFormat: 'both',
      verbose: args.verbose || false,
      strict: false,
      libraries: parseLibraries(args.libraries),
      exitBehavior: (args.exitBehavior as 'loop' | 'basic' | 'reset') || 'loop', // NEW
    },
  };
}
```

## Integration with blend65.json

The CLI already supports loading from `blend65.json`. The `exitBehavior` option will automatically be available through the config file since it's part of `CompilerOptions`.

**No additional code needed** - the existing config loader reads all `compilerOptions` properties.

## Code Examples

### Example 1: CLI Flag Usage

```bash
# Default: infinite loop
blend65 build main.blend

# Return to BASIC
blend65 build main.blend --exit-behavior=basic
blend65 build main.blend -e basic

# Soft reset
blend65 build main.blend --exit-behavior=reset
```

### Example 2: Help Output

```
Options:
  --exit-behavior, -e  Program exit behavior when main() returns
                       [string] [choices: "loop", "basic", "reset"] [default: "loop"]
```

### Example 3: Error Message (Invalid Value)

```
$ blend65 build main.blend --exit-behavior=invalid
Error: Invalid values:
  Argument: exit-behavior, Given: "invalid", Choices: "loop", "basic", "reset"
```

## Integration Points

### Where Option Flows

1. **CLI Parser** → `args.exitBehavior`
2. **buildConfig()** → `config.compilerOptions.exitBehavior`
3. **Compiler.compile()** → receives config
4. **CodegenPhase** → passes to CodeGenerator
5. **CodeGenerator.generate()** → uses in `generateEntryPoint()`

### Config File Override

CLI flags override blend65.json values:

```json
// blend65.json
{
  "compilerOptions": {
    "exitBehavior": "loop"
  }
}
```

```bash
# CLI overrides config file
blend65 build main.blend --exit-behavior=basic
# Result: uses "basic", not "loop"
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Invalid choice | Yargs rejects with valid choices message |
| Typo in config file | Config validator reports error |

## Testing Requirements

- Test CLI parses `--exit-behavior` correctly
- Test all three values accepted
- Test default value when flag not provided
- Test config file loading with exitBehavior
- Test CLI overrides config file