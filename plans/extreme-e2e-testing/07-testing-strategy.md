# Testing Strategy: Extreme E2E Testing Infrastructure

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- **Fixture count**: 350+ diverse fixtures
- **Category coverage**: All compiler phases tested
- **Feature coverage**: Every language feature exercised
- **Edge case coverage**: Boundary conditions and unusual combinations
- **Error coverage**: All error types validated

## Test Categories

### Success Fixtures

| Category | Count | Description |
|----------|-------|-------------|
| Lexer | ~30 | Token recognition, number formats, strings |
| Parser Expressions | ~50 | All operator combinations, precedence, nesting |
| Parser Statements | ~40 | Control flow, loops, nested structures |
| Semantic | ~25 | Type checking, scopes, symbol resolution |
| IL Generator | ~35 | CFG construction, intrinsics, memory ops |
| Optimizer | ~40 | Dead code, folding, peephole patterns |
| Codegen | ~30 | Addressing modes, instruction selection |
| Integration | ~35 | Real programs, multi-module, standard library |
| Edge Cases | ~25 | Boundary values, deep nesting, large files |

### Error Fixtures

| Category | Count | Description |
|----------|-------|-------------|
| Lexer Errors | ~10 | Invalid tokens, unterminated strings |
| Parse Errors | ~20 | Invalid syntax, missing elements |
| Type Errors | ~15 | Type mismatches, invalid operations |
| Semantic Errors | ~15 | Undefined identifiers, scope violations |

### Regression Fixtures

- One fixture per reported bug
- Named by issue number: `issue-001-description.blend`
- Growing collection as bugs are found and fixed

## Test Validation

### Success Validation

For `@expect: success` fixtures:

1. **Compilation succeeds** - No errors returned
2. **No warnings** (unless @expect: warning)
3. **Output check** (if specified) - Pattern found in assembly

### Error Validation

For `@expect: error` fixtures:

1. **Compilation fails** - Error returned
2. **Correct error code** - Matches @error-code
3. **Meaningful message** - Error message is helpful

### Output Verification

When `@output-check` is specified:

```js
// @output-check: Contains "LDA #$05"
// Verify the assembly output contains this instruction
```

Patterns:
- `Contains "pattern"` - Output includes pattern
- `NotContains "pattern"` - Output excludes pattern
- `Regex /pattern/` - Output matches regex

## Test Data

### Fixtures

All test data is in `.blend` fixture files with metadata comments.

### Mock Requirements

**NONE** - We use the real compiler, no mocks.

Per `.clinerules/code.md` Rule 25:
> MUST NOT Mock Real Objects That Exist

## Verification Checklist

- [ ] All fixtures load without errors
- [ ] All fixtures have valid metadata
- [ ] All success fixtures compile successfully
- [ ] All error fixtures produce expected errors
- [ ] Output checks pass where specified
- [ ] No regression fixtures fail
- [ ] Statistics report is accurate
- [ ] CI pipeline passes

## Test Runner Implementation

### Vitest Integration

```typescript
// src/__tests__/e2e/fixture-runner.test.ts
describe('E2E Fixture Tests', () => {
  const fixtures = discoverFixtures('fixtures/');
  
  for (const fixture of fixtures) {
    describe(fixture.category, () => {
      it(fixture.name, () => {
        const result = compileFixture(fixture);
        validateResult(result, fixture.metadata);
      });
    });
  }
});
```

### Parallel Execution

- Fixtures are independent - can run in parallel
- Vitest handles parallel test execution
- No shared state between fixture tests

### Reporting

Clear output on failure:
```
✗ FAIL fixtures/02-parser/expressions/deeply-nested.blend
  Expected: success
  Got: error
  Message: Maximum expression depth exceeded
  
  Fixture metadata:
    @category: parser
    @description: Tests deeply nested arithmetic expressions
```