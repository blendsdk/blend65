# Intrinsics Tests: Fix 15 Skipped Tests

> **Document**: 03-intrinsics-tests.md
> **Parent**: [Index](00-index.md)

## Overview

15 `it.todo` tests for peek/poke/peekw/pokew/volatile_read intrinsics need test bodies.
The IL generator's `tryResolveConstantAddress()` already emits proper address operands
for constant addresses. Pipeline validation confirmed all pass.

## Implementation Details

### codegen/e2e/intrinsics.test.ts (4 tests)

Each test should: wrap source in `module Test; function main(): void { ... }`,
call `compileToAsm(source)`, and assert expected 6502 mnemonics.

**Test patterns:**
```typescript
// peek — assert LDA absolute
it('should compile peek() reading from hardware register', () => {
  const source = `module Test; function main(): void { let v: byte = peek($D020); }`;
  const result = compileToAsm(source);
  expect(countMnemonic(result, 'LDA')).toBeGreaterThanOrEqual(1);
});

// poke — assert STA absolute
// peekw — assert LDA + LDX (16-bit)
// pokew — assert STA + STX (16-bit)
```

### codegen/e2e/emit.test.ts (2 tests)

Each test should: use `compileToText(wrapMain(...))` and assert text contains expected assembly.

### e2e/pipeline/intrinsics.test.ts (9 tests)

Each test should: use `compileBlend(source)` and call `expectSuccess(result)`.
For hex/decimal address tests, also check `expectAssemblyContains(result, 'LDA')` or 'STA'.

## Key Technical Details

- `tryResolveConstantAddress()` in `il/generator/expressions.ts` resolves:
  - Numeric literals: `peek($D020)` → AddressOperand(0xD020)
  - Const identifiers: `const BORDER = $D020; peek(BORDER)` → follows const chain
- `getAddressOperand()` in `codegen/generator/base.ts` throws if no address operand
- All tests use constant addresses, so the pipeline always provides address operands
- Intrinsics in function bodies: `poke($D020, 14)` is an expression statement
- Intrinsics in variable initializers: `let v: byte = peek($D020)` works at module scope
