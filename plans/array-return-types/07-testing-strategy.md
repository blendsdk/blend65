# Testing Strategy: Array Return Types

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Parser tests: 100% coverage for array return type parsing
- Regression tests: Verify existing return types still work
- Integration tests: End-to-end parsing with array return types

## Test Categories

### Unit Tests (Parser)

| Test | Description | Priority |
|------|-------------|----------|
| `parses explicit array return type` | `function f(): byte[5]` | High |
| `parses inferred array return type` | `function f(): byte[]` | High |
| `parses multidimensional array return` | `function f(): byte[2][3]` | High |
| `parses word array return type` | `function f(): word[10]` | High |
| `parses simple return types (regression)` | `byte`, `word`, `void`, etc. | High |
| `parses custom type return` | `function f(): SpriteId` | Medium |
| `reports error for invalid return type` | `function f(): 123` | Medium |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| `full function with array return` | Parser + AST | Parse complete function, verify AST structure |
| `function with array params and return` | Parser + AST | Both parameters and return are arrays |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Compile function returning byte array | Parse → Analyze | No errors, valid AST |
| Type check array return | Parse → Type Check | Return type matches body |

## Test Data

### Test Cases

```typescript
// Test 1: Explicit size array return
const explicitArrayReturn = `
module test
function getColors(): byte[3] {
  return [1, 2, 3];
}
`;

// Test 2: Inferred size array return
const inferredArrayReturn = `
module test
function getData(): byte[] {
  return [10, 20, 30];
}
`;

// Test 3: Multidimensional array return
const multidimArrayReturn = `
module test
function getMatrix(): byte[2][3] {
  return [[1, 2, 3], [4, 5, 6]];
}
`;

// Test 4: Word array return
const wordArrayReturn = `
module test
function getAddresses(): word[5] {
  return [$0400, $0800, $0C00, $1000, $1400];
}
`;

// Test 5: Regression - simple return type
const simpleReturn = `
module test
function getValue(): byte {
  return 42;
}
`;

// Test 6: Regression - void return type
const voidReturn = `
module test
function doNothing(): void {
  return;
}
`;

// Test 7: Array params AND array return
const arrayParamsAndReturn = `
module test
function processArray(input: byte[3]): byte[3] {
  return input;
}
`;
```

## Mock Requirements

None - use real parser components:
- Real `Lexer` for tokenization
- Real `Parser` for parsing
- Real AST node inspection

## Verification Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No regressions in existing function tests
- [ ] Test coverage meets goals (100% for array return types)
- [ ] Error cases properly handled

## Test File Location

New tests should be added to:
`packages/compiler/src/__tests__/parser/function-declarations.test.ts`

Or create a new focused test file:
`packages/compiler/src/__tests__/parser/function-return-types.test.ts`

## Example Test Implementation

```typescript
import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { FunctionDecl } from '../../ast/index.js';

describe('Parser - Array Return Types', () => {
  function parseFunction(source: string): FunctionDecl {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, source);
    const program = parser.parse();
    
    expect(parser.hasErrors()).toBe(false);
    
    const func = program.getDeclarations()[0];
    expect(func).toBeInstanceOf(FunctionDecl);
    return func as FunctionDecl;
  }

  it('parses function with explicit array return type', () => {
    const source = `module test
function getColors(): byte[3] {
  return [1, 2, 3];
}`;
    
    const func = parseFunction(source);
    expect(func.getName()).toBe('getColors');
    expect(func.getReturnType()).toBe('byte[3]');
  });

  it('parses function with inferred array return type', () => {
    const source = `module test
function getData(): byte[] {
  return [10, 20, 30];
}`;
    
    const func = parseFunction(source);
    expect(func.getName()).toBe('getData');
    expect(func.getReturnType()).toBe('byte[]');
  });

  it('parses function with multidimensional array return', () => {
    const source = `module test
function getMatrix(): byte[2][3] {
  return [[1, 2, 3], [4, 5, 6]];
}`;
    
    const func = parseFunction(source);
    expect(func.getName()).toBe('getMatrix');
    expect(func.getReturnType()).toBe('byte[2][3]');
  });

  // Regression tests
  it('still parses simple byte return type', () => {
    const source = `module test
function getValue(): byte {
  return 42;
}`;
    
    const func = parseFunction(source);
    expect(func.getReturnType()).toBe('byte');
  });

  it('still parses void return type', () => {
    const source = `module test
function doNothing(): void {
}`;
    
    const func = parseFunction(source);
    expect(func.getReturnType()).toBe('void');
  });
});
```