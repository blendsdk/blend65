# Code Generator: Exit Behavior

> **Document**: 05-code-generator.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies how the code generator uses the `exitBehavior` option to generate the appropriate program exit code.

## Architecture

```
CodeGenerator.generate()
    ↓
CodeGenerator.generateEntryPoint()
    ↓
CodeGenerator.generateExitCode(exitBehavior)
    ↓
Assembly output with correct JMP instruction
```

## Implementation Details

### C64 Exit Address Constants

Add to `packages/compiler/src/codegen/types.ts`:

```typescript
/**
 * C64 BASIC warm start address
 * 
 * Jumping here returns to BASIC READY prompt with
 * BASIC memory intact. User can continue programming.
 */
export const C64_BASIC_WARM_START = 0xA474;

/**
 * C64 reset vector address
 * 
 * Jumping here performs a soft reset, reinitializing
 * the entire system including BASIC and KERNAL.
 */
export const C64_RESET_VECTOR = 0xFCE2;
```

### New Method: generateExitCode

Add to `packages/compiler/src/codegen/code-generator.ts`:

```typescript
import type { ExitBehavior } from '../config/types.js';
import { C64_BASIC_WARM_START, C64_RESET_VECTOR } from './types.js';

/**
 * Generates program exit code based on configured behavior
 *
 * @param behavior - The exit behavior to generate
 *
 * **Exit Behaviors:**
 * - 'loop': Infinite loop (safest, prevents executing garbage)
 * - 'basic': Jump to BASIC warm start ($A474 on C64)
 * - 'reset': Jump to reset vector ($FCE2 on C64)
 */
protected generateExitCode(behavior: ExitBehavior): void {
  switch (behavior) {
    case 'basic':
      this.emitJmp(
        `$${C64_BASIC_WARM_START.toString(16).toUpperCase()}`,
        'Return to BASIC'
      );
      break;
      
    case 'reset':
      this.emitJmp(
        `$${C64_RESET_VECTOR.toString(16).toUpperCase()}`,
        'Soft reset'
      );
      break;
      
    case 'loop':
    default:
      // Current behavior - infinite loop
      const endLabel = this.getTempLabel('end');
      this.emitLabel(endLabel);
      this.emitJmp(endLabel, 'End: infinite loop');
      break;
  }
}
```

### Update: generateEntryPoint

Modify `generateEntryPoint()` in `packages/compiler/src/codegen/code-generator.ts`:

```typescript
protected generateEntryPoint(): void {
  this.emitSectionComment('Program Entry Point');

  // Check if module has a main function
  const entryPointName = this.currentModule.getEntryPointName();
  const mainFunc = this.currentModule.getFunction('main') || 
                   this.currentModule.getFunction(entryPointName ?? '');

  if (!mainFunc) {
    // No main function - just emit a simple infinite loop
    this.emitComment('No main function - infinite loop');
    const loopLabel = this.getTempLabel('loop');
    this.emitLabel(loopLabel);
    this.emitJmp(loopLabel, 'Infinite loop');
    return;
  }

  // Generate init code that calls main
  const initLabel = this.labelGenerator.functionLabel('_start', this.currentAddress);
  this.emitLabel(initLabel);

  // Initialize zero-page variables if any
  if (this.zpAllocations.size > 0) {
    this.generateZpInitialization();
  }

  // Call main function
  const mainLabel = `_${mainFunc.name}`;
  this.emitJsr(mainLabel, 'Call main');

  // Generate exit code based on option (CHANGED)
  const exitBehavior = this.options.exitBehavior ?? 'loop';
  this.generateExitCode(exitBehavior);
}
```

## Code Examples

### Example 1: exitBehavior = 'loop' (Default)

```asm
; ---------------------------------------------------------------------------
; Program Entry Point
; ---------------------------------------------------------------------------
__start:
  JSR _main                   ; Call main
.end_0001:
  JMP .end_0001               ; End: infinite loop
```

### Example 2: exitBehavior = 'basic'

```asm
; ---------------------------------------------------------------------------
; Program Entry Point
; ---------------------------------------------------------------------------
__start:
  JSR _main                   ; Call main
  JMP $A474                   ; Return to BASIC
```

### Example 3: exitBehavior = 'reset'

```asm
; ---------------------------------------------------------------------------
; Program Entry Point
; ---------------------------------------------------------------------------
__start:
  JSR _main                   ; Call main
  JMP $FCE2                   ; Soft reset
```

## Integration Points

### CodegenOptions Interface

The `exitBehavior` must be available in `CodegenOptions`:

```typescript
export interface CodegenOptions {
  // ... existing options ...
  exitBehavior?: ExitBehavior;
}
```

### Options Access

In `generateEntryPoint()`, access via `this.options.exitBehavior`.

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Unknown exit behavior | Default to 'loop' (safe fallback) |
| Non-C64 target | Currently only C64 addresses; future: add target-specific addresses |

## Future Considerations

### Multi-Target Support

When C128 and X16 are implemented, exit addresses will differ:

```typescript
interface ExitAddresses {
  basic: number;
  reset: number;
}

const EXIT_ADDRESSES: Record<TargetPlatform, ExitAddresses> = {
  c64: { basic: 0xA474, reset: 0xFCE2 },
  c128: { basic: 0x4000, reset: 0xFF3D }, // Example - verify actual addresses
  x16: { basic: 0x0000, reset: 0x0000 },  // TBD when X16 support added
};
```

## Testing Requirements

- Test 'loop' generates infinite loop
- Test 'basic' generates JMP $A474
- Test 'reset' generates JMP $FCE2
- Test default is 'loop'
- Test with main function present
- Test without main function (should still loop)