# Current State: Exit Behavior

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The code generator currently hardcodes an infinite loop after `main()` returns:

```typescript
// packages/compiler/src/codegen/code-generator.ts
protected generateEntryPoint(): void {
  // ... setup code ...

  // Call main function
  const mainLabel = `_${mainFunc.name}`;
  this.emitJsr(mainLabel, 'Call main');

  // After main returns, infinite loop to prevent crash
  const endLabel = this.getTempLabel('end');
  this.emitLabel(endLabel);
  this.emitJmp(endLabel, 'End: infinite loop');  // ← Hardcoded
}
```

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/compiler/src/config/types.ts` | Config type definitions | Add `ExitBehavior` type and option |
| `packages/compiler/src/codegen/types.ts` | Codegen options | Add `exitBehavior` to `CodegenOptions` |
| `packages/compiler/src/codegen/code-generator.ts` | Exit code generation | Use `exitBehavior` instead of hardcoded loop |
| `packages/cli/src/commands/build.ts` | CLI command | Add `--exit-behavior` flag |
| `packages/cli/src/commands/types.ts` | CLI types | Add `exitBehavior` to `BuildOptions` |

### Code Analysis

**Current Exit Generation:**
```typescript
// After main returns, infinite loop to prevent crash
const endLabel = this.getTempLabel('end');
this.emitLabel(endLabel);
this.emitJmp(endLabel, 'End: infinite loop');
```

**Generated Assembly (current):**
```asm
__start:
  JSR _main                   ; Call main
.end_0001:
  JMP .end_0001               ; End: infinite loop
```

**What Needs to Change:**
The `generateEntryPoint()` method needs to check `this.options.exitBehavior` and emit the appropriate exit code:

```typescript
// Proposed change
protected generateEntryPoint(): void {
  // ... existing code ...
  
  // Generate exit code based on option
  const exitBehavior = this.options.exitBehavior ?? 'loop';
  this.generateExitCode(exitBehavior);
}

protected generateExitCode(behavior: ExitBehavior): void {
  switch (behavior) {
    case 'basic':
      this.emitJmp('$A474', 'Return to BASIC');
      break;
    case 'reset':
      this.emitJmp('$FCE2', 'Soft reset');
      break;
    case 'loop':
    default:
      const endLabel = this.getTempLabel('end');
      this.emitLabel(endLabel);
      this.emitJmp(endLabel, 'End: infinite loop');
      break;
  }
}
```

## Gaps Identified

### Gap 1: No Exit Behavior Configuration

**Current Behavior:** Exit is always an infinite loop
**Required Behavior:** Exit should be configurable via CLI and config file
**Fix Required:** Add `exitBehavior` option throughout the configuration chain

### Gap 2: CLI Missing Exit Flag

**Current Behavior:** No `--exit-behavior` flag exists
**Required Behavior:** Users can specify `--exit-behavior=basic|loop|reset`
**Fix Required:** Add option to `buildCommand` builder and pass to config

### Gap 3: CodegenOptions Missing Exit Behavior

**Current Behavior:** `CodegenOptions` doesn't have `exitBehavior` property
**Required Behavior:** `exitBehavior` available in code generator
**Fix Required:** Add `exitBehavior?: ExitBehavior` to interface

## Dependencies

### Internal Dependencies

- `CompilerOptions` type (config/types.ts)
- `CodegenOptions` type (codegen/types.ts)
- `CodeGenerator` class (codegen/code-generator.ts)
- CLI build command (cli/commands/build.ts)

### External Dependencies

None - this is a self-contained feature

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing tests | Low | Medium | Run full test suite, update affected tests |
| Wrong exit address | Low | High | Verify addresses from C64 documentation |
| Option not passed through | Medium | High | Add tests for full option flow |