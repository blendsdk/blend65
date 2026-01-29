# Label Generation Fixes

> **Document**: 06-label-generation.md
> **Parent**: [Index](00-index.md)

## Overview

Fix two label-related issues:
1. **Undefined labels** - Labels like `_main`, `_data` are referenced but never defined
2. **Double-dot labels** - Block labels get `..` prefix which may break ACME

## Issue 1: Undefined Labels

### The Problem

```
ACME assembly failed: Value not defined (_main).
ACME assembly failed: Value not defined (_data).
```

Labels are being referenced (e.g., `JSR _main`) but the label definition (`_main:`) is missing.

### Analysis

Looking at `main.blend` output:
- Entry point calls `JSR _main` 
- But the main function might be named differently or not emitted

**Possible causes:**
1. Function not found in IL module
2. Label naming mismatch (function uses different prefix)
3. Data labels referenced but not emitted

### Solution

```typescript
// code-generator.ts

protected generateEntryPoint(): void {
  const mainFunc = this.currentModule.getFunction('main');
  
  if (!mainFunc) {
    // No main function - just return to BASIC
    this.emitComment('No main function');
    this.emitRts('Return to BASIC');
    return;
  }
  
  // Use consistent label format
  const mainLabel = this.getFunctionLabel(mainFunc.name);  // Should return '_main'
  this.emitJsr(mainLabel, 'Call main');
  this.emitRts('Return to BASIC');
}

protected getFunctionLabel(name: string): string {
  // Ensure consistent prefix
  return `_${name}`;
}

protected generateFunction(func: ILFunction): void {
  // Must emit the label BEFORE function body
  const label = this.getFunctionLabel(func.name);
  this.emitLabel(label);  // This creates '_main:' etc.
  
  // ... generate function body ...
}
```

### Data Label Fix

```typescript
protected generateGlobals(): void {
  // For each data variable, emit label AND data
  for (const global of this.dataAllocations) {
    const label = `_${global.name}`;
    this.emitLabel(label);  // Must emit label!
    this.asmBuilder.byte(global.initialValues, global.name);
  }
}
```

## Issue 2: Double-Dot Labels

### The Problem

Block labels are being emitted as `..block_if_then_0:` which may not be valid ACME syntax.

### Analysis

In `acme-emitter.ts`:
```typescript
protected emitLabel(label: AsmLabel): void {
  const prefix = label.exported ? '+' : (label.type === LabelType.Block ? '.' : '');
  const labelText = `${prefix}${label.name}:`;
}
```

If `label.name` is already `.block_if_then_0`, adding prefix `.` creates `..block_if_then_0`.

### Solution 1: Fix in ACME Emitter

```typescript
protected emitLabel(label: AsmLabel): void {
  let prefix = '';
  
  if (label.exported) {
    prefix = '+';
  } else if (label.type === LabelType.Block || label.type === LabelType.Temp) {
    // Only add prefix if name doesn't already start with '.'
    if (!label.name.startsWith('.')) {
      prefix = '.';
    }
  }
  
  const labelText = `${prefix}${label.name}:`;
  this.addLine(labelText, label.sourceLocation);
}
```

### Solution 2: Fix in Label Generator

Better approach - ensure block labels are created without the dot:

```typescript
// In code-generator.ts or label-generator.ts

protected getBlockLabel(blockName: string): string {
  // Remove any existing prefix, add single dot
  const cleanName = blockName.replace(/^\.+/, '');
  return `.${cleanName}`;
}
```

## Testing Requirements

### For Undefined Labels:
- Test that compiling `main.blend` produces no "undefined" errors
- Test that all function labels are emitted before reference
- Test that data labels are emitted

### For Double-Dot Labels:
- Test that block labels have single dot prefix
- Test that ACME accepts all generated labels
- Test if/else, while, for control flow labels

## Files to Modify

| File | Changes |
|------|---------|
| `codegen/code-generator.ts` | Ensure function/data labels emitted |
| `codegen/label-generator.ts` | Consistent label naming |
| `asm-il/emitters/acme-emitter.ts` | Fix double-dot prefix |

## Verification

After fix, these commands should succeed without label errors:

```bash
./packages/cli/bin/blend65.js build ./examples/simple/main.blend
# Should produce working .prg with no "undefined" errors

./packages/cli/bin/blend65.js build ./examples/simple/print-demo.blend  
# Should have no double-dot label errors
```