# Parser Changes: Array Return Types

> **Document**: 03-parser-changes.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies the single code change required to support array return types in function declarations.

## Architecture

### Current Architecture

```
parseFunctionDecl()
    ├── Parse modifiers (export, callback)
    ├── Parse 'function' keyword
    ├── Parse function name
    ├── Parse parameter list → uses parseTypeAnnotation() ✅
    ├── Parse return type → uses simple token check ❌
    └── Parse function body
```

### Proposed Change

```
parseFunctionDecl()
    ├── Parse modifiers (export, callback)
    ├── Parse 'function' keyword
    ├── Parse function name
    ├── Parse parameter list → uses parseTypeAnnotation() ✅
    ├── Parse return type → uses parseTypeAnnotation() ✅
    └── Parse function body
```

## Implementation Details

### File: `packages/compiler/src/parser/parser.ts`

### Current Code (lines ~298-314)

```typescript
// Parse optional return type
let returnType: string | null = null;
if (this.match(TokenType.COLON)) {
  // Return type can be a keyword (void, byte, word) or identifier (custom type)
  if (
    this.check(
      TokenType.VOID,
      TokenType.BYTE,
      TokenType.WORD,
      TokenType.BOOLEAN,
      TokenType.STRING,
      TokenType.IDENTIFIER
    )
  ) {
    returnType = this.advance().value;
  } else {
    this.reportError(
      DiagnosticCode.EXPECTED_TOKEN,
      DeclarationParserErrors.expectedReturnType()
    );
  }
}
```

### New Code

```typescript
// Parse optional return type
// Uses parseTypeAnnotation() to handle full type expressions including arrays:
// - Simple types: byte, word, void, boolean, string, callback
// - Array types: byte[5], word[256]
// - Inferred arrays: byte[], word[]
// - Multidimensional: byte[2][3], byte[][]
let returnType: string | null = null;
if (this.match(TokenType.COLON)) {
  returnType = this.parseTypeAnnotation();
}
```

### Why This Works

1. `parseTypeAnnotation()` already handles all type forms:
   - Simple types: `byte`, `word`, `void`, `boolean`, `string`, `callback`, identifiers
   - Array types with explicit sizes: `byte[256]`
   - Array types with inferred sizes: `byte[]`
   - Multidimensional arrays: `byte[25][40]`

2. The method already reports appropriate errors for invalid types

3. The method returns a string representation suitable for `FunctionDecl`

## Integration Points

### FunctionDecl AST Node

No changes needed. The `returnType` parameter is already typed as `string | null`:

```typescript
// From ast/nodes.ts
constructor(
  name: string,
  parameters: Parameter[],
  returnType: string | null,  // Already accepts any type string
  body: Statement[] | null,
  ...
)
```

### Type Checker

No changes needed. The type checker already handles array types in:
- Variable declarations
- Function parameters
- Return statements

It will work identically for return types specified as arrays.

## Code Example

### Before Fix

```js
// Input
function getArray(): byte[5] {
  return [1, 2, 3, 4, 5];
}

// Result: 100+ parse errors
```

### After Fix

```js
// Input
function getArray(): byte[5] {
  return [1, 2, 3, 4, 5];
}

// Result: Clean parse
// FunctionDecl {
//   name: "getArray",
//   parameters: [],
//   returnType: "byte[5]",
//   body: [ReturnStatement { ... }]
// }
```

## Error Handling

`parseTypeAnnotation()` already handles errors appropriately:

```js
// Invalid type
function f(): 123 { }  // Error: "Expected type after ':'"

// Missing closing bracket
function f(): byte[5 { }  // Error: "Expected ']' after array size"
```

## Testing Requirements

- Unit tests for array return types in parser
- Verify existing simple return types still work
- Test edge cases (multidimensional, inferred sizes)

See [Testing Strategy](07-testing-strategy.md) for detailed test cases.