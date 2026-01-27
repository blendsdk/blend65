# Data Directives: Technical Specification

> **Document**: 06-data-directives.md
> **Parent**: [Index](00-index.md)

## Overview

Tests expect specific ACME assembler directives for data section generation:
- `!byte` for initialized byte values
- `!fill N, $00` for uninitialized arrays
- `!word` for word values

Some tests are failing because the format doesn't match expectations or certain directives aren't being generated correctly.

## Current Implementation Analysis

### globals-generator.ts Implementation

The current implementation in `emitZeroFill` and `emitInitialValue` appears to handle most cases:

```typescript
protected emitZeroFill(size: number, name: string): void {
  if (size === 1) {
    this.assemblyWriter.emitBytes([0], name);  // !byte $00
  } else if (size === 2) {
    this.assemblyWriter.emitWords([0], name);  // !word $0000
  } else {
    this.assemblyWriter.emitFill(size, 0, name);  // !fill size, $00
  }
}
```

### Test Expectations

The skipped tests expect:
1. `!fill 10` for `let buffer: byte[10];`
2. `!fill 10` for `let pointers: word[5];` (5 words = 10 bytes)
3. `!byte` directive present for `let counter: byte = 0;`

### Potential Issues

1. **Array size calculation**: Word arrays need `N * 2` bytes
2. **Test expectation mismatch**: Tests might expect exact format
3. **Output format differences**: `!fill 10, $00` vs `!fill 10`

## Implementation Details

### Verify emitFill Format

Check `assembly-writer.ts` to ensure `emitFill` produces expected format:

```typescript
// Expected output: !fill 10, $00
emitFill(count: number, value: number, comment?: string): void {
  const hexValue = '$' + value.toString(16).toUpperCase().padStart(2, '0');
  this.emit(`  !fill ${count}, ${hexValue}`, comment);
}
```

### Word Array Size Calculation

Ensure `getTypeSize` correctly calculates word array sizes:

```typescript
protected getTypeSize(type: { kind: string; size?: number }): number {
  // Use explicit size if available (arrays have this)
  if (type.size !== undefined) {
    return type.size;
  }
  // ... rest
}
```

For `word[5]`, the type should have `size: 10` (5 * 2 bytes).

### Test Expectation Updates

Some tests may need their expectations updated to match actual (correct) output format:

```typescript
// Test might expect:
expectAsmContains(asm, '!fill 10');

// Actual correct output might be:
// !fill 10, $00

// Fix: Update test expectation
expectAsmContains(asm, '!fill 10, $00');
```

## Investigation Required

Before implementation, we need to verify:

1. **What `emitFill` actually produces**
2. **What tests actually expect**
3. **Whether the issue is code or test expectations**

### Quick Debug Script

```typescript
const asm = compileToAsm('let buffer: byte[10];');
console.log(asm);
// Check if !fill is present and in what format
```

## Likely Fixes Needed

### Option A: Test Expectations Wrong

If code generator produces correct `!fill 10, $00` but tests expect `!fill 10`:

```typescript
// Update test expectation
it('generates data section for byte array', () => {
  const asm = compileToAsm('let buffer: byte[10];');
  expectAsmContains(asm, '!fill 10, $00');  // Add value param
});
```

### Option B: Missing Array Handling

If arrays with no initializer don't trigger `emitZeroFill`:

```typescript
protected generateDataVariable(global: ILGlobalVariable): void {
  // ...
  if (global.initialValue !== undefined) {
    this.emitInitialValue(global);
  } else {
    // Ensure this path is taken for arrays
    const size = this.getTypeSize(global.type);  // Must work for arrays
    this.emitZeroFill(size, global.name);
  }
}
```

### Option C: Type Size Incorrect

If `getTypeSize` doesn't use the array's explicit size:

```typescript
protected getTypeSize(type: { kind: string; size?: number }): number {
  // MUST check explicit size first (arrays set this)
  if (type.size !== undefined && type.size > 0) {
    return type.size;
  }
  // ... fallback by kind
}
```

## Code Examples

### Expected Output: Byte Array

```js
// Input
let buffer: byte[10];

// Expected Assembly
_buffer:
  !fill 10, $00  ; buffer
```

### Expected Output: Word Array

```js
// Input
let pointers: word[5];

// Expected Assembly
_pointers:
  !fill 10, $00  ; pointers (5 words = 10 bytes)
```

### Expected Output: Initialized Byte

```js
// Input
let counter: byte = 0;

// Expected Assembly
_counter:
  !byte $00  ; counter
```

## Testing Requirements

1. **E2E test**: Enable `generates data section for global byte`
2. **E2E test**: Enable `generates data section for byte array`
3. **E2E test**: Enable `generates data section for word array`
4. **Verify**: Correct size calculation for word arrays

## Files to Modify

1. `packages/compiler/src/codegen/globals-generator.ts` - If code fix needed
2. `packages/compiler/src/codegen/assembly-writer.ts` - If format fix needed
3. `packages/compiler/src/__tests__/e2e/variables.test.ts` - Enable 3 tests
4. `packages/compiler/src/__tests__/e2e/literals.test.ts` - Enable 1 test (word array)

## Complexity Assessment

This fix is **low-medium complexity** because:
- May be just test expectation updates
- Or may need minor code changes
- Requires investigation first

## Estimated Effort

- Investigation: 15-20 minutes
- Implementation/Test Updates: 15-30 minutes
- Total: ~45 minutes