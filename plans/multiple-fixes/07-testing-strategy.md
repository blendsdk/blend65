# Testing Strategy: Skipped Tests Fixes

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- **Unit tests**: Cover new helper functions (array extraction, local allocation)
- **E2E tests**: Enable all 13 skipped tests and ensure they pass
- **Regression**: Maintain all 6963 existing tests passing

## Test Categories

### Skipped Tests to Enable (13 total)

#### Array Initializers (3 tests)

| File | Test Name | Expectation |
|------|-----------|-------------|
| `smoke.test.ts` | `array literal should generate correct byte values` | `!byte $01, $02, $03` |
| `literals.test.ts` | `should generate correct values for byte array initializer` | `expectAsmByteData(asm, [0x01, 0x02, 0x03])` |
| `literals.test.ts` | `should generate correct values for hex array initializer` | `expectAsmByteData(asm, [0x10, 0x20, 0x30])` |

#### Local Variables (3-4 tests)

| File | Test Name | Expectation |
|------|-----------|-------------|
| `smoke.test.ts` | `local variable should generate valid load/store` | No `STUB:` or `Unknown variable` |
| `variables.test.ts` | `should generate valid STA for local variable init` | `expectAsmNotContains(asm, 'STUB:')` |
| `variables.test.ts` | `should generate valid LDA for local variable read` | `expectAsmNotContains(asm, 'STUB:')` |

#### Data Directives (4 tests)

| File | Test Name | Expectation |
|------|-----------|-------------|
| `variables.test.ts` | `generates data section for global byte` | `!byte` directive |
| `variables.test.ts` | `generates data section for byte array` | `!fill 10` directive |
| `variables.test.ts` | `generates data section for word array` | `!fill 10` (5*2 bytes) |
| `literals.test.ts` | `generates data section for word array` | `*` origin directive |

#### Branch Selection (2 tests)

| File | Test Name | Expectation |
|------|-----------|-------------|
| `control-flow.test.ts` | `generates BNE for equality comparison` | `BNE` instruction |
| `control-flow.test.ts` | `generates BEQ for inequality comparison` | `BEQ` instruction |

#### Not In Scope (5 tests - remain skipped)

| File | Test Name | Reason |
|------|-----------|--------|
| `type-acceptance.test.ts` | `should accept length() with string literal` | Type system change |
| `type-checker-assignments-complex.test.ts` | `should type check chained function calls` | Array return types |
| `generator-expressions-ternary.test.ts` | `should generate ternary for function argument` | IL generator complexity |
| `optimizer-metrics.test.ts` | `should apply strength reduction` | Future optimizer |
| `performance.test.ts` | `should maintain consistent performance` | Inherently flaky |

## Test Implementation

### Array Initializer Tests

Verify IL generator extracts values:

```typescript
describe('Array Literal IL Generation', () => {
  it('extracts byte array initializer values', () => {
    const source = 'let data: byte[3] = [1, 2, 3];';
    const result = compileToIL(source);
    const global = result.ilModule.getGlobal('data');
    expect(global.initialValue).toEqual([1, 2, 3]);
  });

  it('extracts hex array initializer values', () => {
    const source = 'let data: byte[3] = [$10, $20, $30];';
    const result = compileToIL(source);
    const global = result.ilModule.getGlobal('data');
    expect(global.initialValue).toEqual([16, 32, 48]);
  });
});
```

### Local Variable Tests

Verify code generator allocates locals:

```typescript
describe('Local Variable Code Generation', () => {
  it('allocates zero-page for local byte', () => {
    const asm = compileToAsm(`
      function test(): byte {
        let x: byte = 10;
        return x;
      }
    `);
    expectAsmNotContains(asm, 'STUB:');
    expectAsmNotContains(asm, 'Unknown variable');
    // Should have ZP store and load
    expect(asm).toMatch(/STA \$[0-9A-F]{2}/);  // ZP store
    expect(asm).toMatch(/LDA \$[0-9A-F]{2}/);  // ZP load
  });
});
```

### Branch Selection Tests

Verify correct branch instructions:

```typescript
describe('Branch Instruction Selection', () => {
  it('generates BNE for equality comparison', () => {
    const asm = compileToAsm(`
      let x: byte = 10;
      function test(): void {
        if (x == 10) {
          poke($D020, 1);
        }
      }
    `);
    expectAsmInstruction(asm, 'CMP');
    expectAsmInstruction(asm, 'BNE');
  });

  it('generates BEQ for inequality comparison', () => {
    const asm = compileToAsm(`
      let x: byte = 10;
      function test(): void {
        if (x != 5) {
          poke($D020, 1);
        }
      }
    `);
    expectAsmInstruction(asm, 'CMP');
    expectAsmInstruction(asm, 'BEQ');
  });
});
```

## Verification Checklist

### Before Each Fix Session

- [ ] Run `./compiler-test` to verify baseline (6963 pass)
- [ ] Read the specific skipped test code
- [ ] Understand exact expectation

### After Each Fix

- [ ] Enable the specific test(s)
- [ ] Run targeted tests: `./compiler-test <component>`
- [ ] Verify test passes
- [ ] Run full suite: `./compiler-test`
- [ ] Verify no regressions

### Final Verification

- [ ] All 13 targeted tests enabled and passing
- [ ] All 6963 original tests still passing
- [ ] No new warnings or errors in test output
- [ ] 5 out-of-scope tests remain appropriately skipped

## Test Data

### Fixtures Needed

No new fixtures needed - tests use inline source code.

### Mock Requirements

No mocks needed - use real compiler pipeline.

## Test Commands

```bash
# Run specific test file
./compiler-test e2e/smoke
./compiler-test e2e/literals
./compiler-test e2e/variables
./compiler-test e2e/control-flow

# Run all E2E tests
./compiler-test e2e

# Run full test suite
./compiler-test

# Run with verbose output for debugging
cd packages/compiler && yarn vitest run --reporter=verbose "test-name-pattern"
```

## Success Criteria

- [ ] 13 tests enabled (`.skip` removed)
- [ ] 13 tests passing
- [ ] 6963 original tests still passing
- [ ] Total tests: 6976 (6963 + 13)
- [ ] Skipped tests: 5 (down from 18)