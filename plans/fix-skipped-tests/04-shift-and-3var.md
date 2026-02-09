# Shift & 3-Variable Tests: Fix 3 Skipped Tests

> **Document**: 04-shift-and-3var.md
> **Parent**: [Index](00-index.md)

## Overview

3 `it.todo` tests need test bodies. Pipeline validation confirmed all pass.

## Shift Operations (2 tests in codegen/e2e/simple-programs.test.ts)

The IL generator doesn't emit `SHL_BYTE`/`SHR_BYTE` directly for `<<`/`>>`, but the
complex operand fallback path handles shifts correctly. The codegen produces proper
ASL/LSR instructions.

**Test pattern:**
```typescript
it('should compile shift left operation', () => {
  const source = `module Test; function main(): void { let x: byte = 1; let y: byte = x << 3; }`;
  const result = compileToAsm(source);
  expect(countMnemonic(result, 'ASL')).toBeGreaterThanOrEqual(1);
});
```

## 3-Variable Expression (1 test in e2e/pipeline/simple-programs.test.ts)

Expression `a + b - c` with 3 separate variables works through the pipeline.
The codegen handles the intermediate push/pop correctly.

**Test pattern:**
```typescript
it('should compile mixed arithmetic with precedence', () => {
  const source = `module Test; function main(): void {
    let a: byte = 10; let b: byte = 5; let c: byte = 3;
    let r: byte = a + b - c;
  }`;
  const result = compileBlend(source);
  expectSuccess(result);
});
```
