# Current State: Extreme E2E Testing Infrastructure

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Test Infrastructure

### What Exists

The Blend65 compiler currently has ~6996 tests covering:

| Component | Test Count | Type |
|-----------|-----------|------|
| Lexer | ~500 | Unit tests |
| Parser | ~1500 | Unit tests |
| AST | ~200 | Unit tests |
| Semantic | ~1000 | Unit + integration |
| IL Generator | ~1500 | Unit + integration |
| ASM-IL | ~500 | Unit + integration |
| Code Generation | ~800 | Unit + integration |
| Pipeline | ~50 | Integration |
| E2E | ~30 | End-to-end |

### Current E2E Test Location

```
packages/compiler/src/__tests__/e2e/
├── codegen-e2e.test.ts
├── compiler-e2e.test.ts
└── pipeline-e2e.test.ts
```

### Current Approach: Inline Source Strings

Current E2E tests use inline source code:

```typescript
it('should compile a simple program', () => {
  const source = `
    let x: byte = 10;
    export function main(): void {}
  `;
  const result = compiler.compileSource(new Map([['main.blend', source]]), config);
  expect(result.success).toBe(true);
});
```

**Problems:**
- Tests are simple one-liners
- Not representative of real programs
- Hard to create complex multi-feature tests inline
- No systematic coverage of language features

## Gaps Identified

### Gap 1: No Complex Multi-Feature Tests

**Current Behavior:** Tests only check one feature at a time
**Required Behavior:** Tests should combine multiple features (arrays + loops + functions + @map)
**Fix Required:** Create fixture files with realistic complexity

### Gap 2: No Systematic Feature Coverage

**Current Behavior:** Tests are added ad-hoc
**Required Behavior:** Systematic coverage of every language feature
**Fix Required:** Categorized fixture structure ensuring complete coverage

### Gap 3: No Regression Test Collection

**Current Behavior:** Bug fixes are tested but not systematically collected
**Required Behavior:** Each fixed bug becomes a permanent regression test
**Fix Required:** `fixtures/99-regressions/` directory with one file per issue

### Gap 4: No Error Case Coverage

**Current Behavior:** Error handling tests are scattered
**Required Behavior:** Comprehensive error case fixtures
**Fix Required:** `fixtures/30-error-cases/` with expected error validation

## Current Example Programs

### Existing Examples

```
examples/
├── simple/
│   └── main.blend          # Very simple, uses length/poke
└── snake-game/
    ├── game-state.blend    # Complex game logic
    ├── hardware.blend      # Hardware abstractions
    └── lib/               # Library modules
```

The snake-game example is good but:
- Not integrated into test suite
- No automated verification
- Single complex example isn't enough

## Dependencies

### Internal Dependencies

- Compiler class (`src/compiler.ts`)
- Test configuration (`vitest.config.ts`)
- Existing test utilities

### External Dependencies

- Vitest test framework
- glob for file discovery
- Node.js fs module for fixture loading

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Fixture creation time | High | Medium | Create fixtures incrementally, prioritize categories |
| Test runner complexity | Medium | Medium | Start simple, iterate |
| False negatives | Low | High | Clear metadata format, careful validation |
| Maintenance burden | Medium | Medium | Good organization, documentation |