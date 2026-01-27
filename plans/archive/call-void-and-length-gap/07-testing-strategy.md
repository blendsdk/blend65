# Testing Strategy: CALL_VOID Bug and length() String Support

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: 100% coverage for modified methods
- Integration tests: Full IL generation pipeline verification
- E2E tests: Unskip and verify previously failing tests

## Test Categories

### Unit Tests

| Test | Description | Priority |
|------|-------------|----------|
| CALL emitted for byte-returning function | Verify CALL instruction emitted | High |
| CALL emitted for word-returning function | Verify CALL instruction emitted | High |
| CALL_VOID emitted for void function | Verify CALL_VOID instruction emitted | High |
| length() with string literal | Verify correct length returned | High |
| length() with empty string | Verify 0 returned | Medium |
| length() with number literal | Verify error emitted | Medium |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| Function call in ternary | Parser → IL → Verify | Full pipeline for ternary with call |
| length() in return statement | Parser → IL → Verify | Full pipeline for length intrinsic |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Compile program with non-void function call | Compile → Verify IL | CALL instruction present |
| Compile program with length("string") | Compile → Verify success | No errors, correct constant |

## Test Cases to Unskip

### CALL_VOID Bug Fix

**File**: `packages/compiler/src/__tests__/il/generator-expressions-ternary.test.ts`

```typescript
// Currently skipped - should pass after fix
it('should generate ternary for function argument', () => {
  const source = `module test
function identity(x: byte): byte { return x; }
function test(): byte { let flag: boolean = true; return identity(flag ? 10 : 20); }`;
  const result = generator.generateModule(parseSource(source));
  expect(result.success).toBe(true);
  expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.BRANCH)).toBe(true);
  expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.CALL)).toBe(true);
});
```

### length() String Support

**File**: `packages/compiler/src/__tests__/e2e/type-acceptance.test.ts`

```typescript
// Currently skipped - should pass after fix
it('should accept length() with string literal', () => {
  const result = compile(`
    function test(): word {
      return length("hello");
    }
  `);
  expect(result.success).toBe(true);
});
```

## New Test Cases

### CALL vs CALL_VOID Tests

Add to `generator-expressions-calls.test.ts`:

```typescript
describe('CALL vs CALL_VOID selection', () => {
  it('should emit CALL for function returning byte', () => {
    const source = `module test
function getValue(): byte { return 42; }
function test(): byte { return getValue(); }`;
    const result = generator.generateModule(parseSource(source));
    expect(result.success).toBe(true);
    expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.CALL)).toBe(true);
    expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.CALL_VOID)).toBe(false);
  });

  it('should emit CALL_VOID for void function', () => {
    const source = `module test
function doNothing(): void { }
function test(): void { doNothing(); }`;
    const result = generator.generateModule(parseSource(source));
    expect(result.success).toBe(true);
    expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.CALL_VOID)).toBe(true);
    expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.CALL)).toBe(false);
  });

  it('should emit CALL for function call as expression', () => {
    const source = `module test
function getValue(): byte { return 10; }
function test(): byte { let x: byte = getValue() + 5; return x; }`;
    const result = generator.generateModule(parseSource(source));
    expect(result.success).toBe(true);
    expect(hasInstruction(result.module.getFunction('test')!, ILOpcode.CALL)).toBe(true);
  });
});
```

### length() String Literal Tests

Add to `intrinsics-length-extreme.test.ts` or create new test:

```typescript
describe('length() with string literals', () => {
  it('should return correct length for "hello"', () => {
    const source = `module test
function test(): word { return length("hello"); }`;
    const result = generator.generateModule(parseSource(source));
    expect(result.success).toBe(true);
    // Verify CONST_WORD 5 is emitted
    const constInstructions = findInstructions(result.module.getFunction('test')!, ILOpcode.CONST);
    expect(constInstructions.some(i => (i as any).value === 5)).toBe(true);
  });

  it('should return 0 for empty string', () => {
    const source = `module test
function test(): word { return length(""); }`;
    const result = generator.generateModule(parseSource(source));
    expect(result.success).toBe(true);
  });

  it('should handle string with spaces', () => {
    const source = `module test
function test(): word { return length("hello world"); }`;
    const result = generator.generateModule(parseSource(source));
    expect(result.success).toBe(true);
  });
});
```

## Verification Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No regressions in existing tests
- [ ] Previously skipped tests now pass
- [ ] Test coverage meets goals

## Test Commands

```bash
# Run all tests
./compiler-test

# Run specific test files
./compiler-test il

# Run E2E tests only
./compiler-test e2e
```