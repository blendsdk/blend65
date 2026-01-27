# length() String Literal Support: Technical Specification

> **Document**: 04-length-string.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies the technical approach to extend the `length()` intrinsic to accept string literals in addition to array variables.

## Current Implementation

The `generateLengthIntrinsic` method currently only handles `IDENTIFIER_EXPR`:

```typescript
protected generateLengthIntrinsic(expr: CallExpression): VirtualRegister | null {
  const args = expr.getArguments();

  if (args.length !== 1) {
    this.addError('length() requires exactly 1 argument', ...);
    return null;
  }

  const arg = args[0];

  // Only handles identifiers
  if (arg.getNodeType() === ASTNodeType.IDENTIFIER_EXPR) {
    const varName = (arg as IdentifierExpression).getName();
    // ... lookup and return array length
  }

  // String literals fall through to error
  this.addError(
    'length() requires an array or string variable',
    ...
  );
  return null;
}
```

## Implementation Details

### Proposed Fix

Add handling for `LITERAL_EXPR` with string values:

```typescript
protected generateLengthIntrinsic(expr: CallExpression): VirtualRegister | null {
  const args = expr.getArguments();

  if (args.length !== 1) {
    this.addError('length() requires exactly 1 argument', expr.getLocation(), 'E_INTRINSIC_ARGS');
    return null;
  }

  const arg = args[0];

  // Handle string literals: length("hello") -> 5
  if (arg.getNodeType() === ASTNodeType.LITERAL_EXPR) {
    const literal = arg as LiteralExpression;
    const value = literal.getValue();
    
    if (typeof value === 'string') {
      // Return the length of the string literal as a compile-time constant
      return this.builder?.emitConstWord(value.length) ?? null;
    }
    
    // Other literal types (numbers, booleans) are not valid for length()
    this.addError(
      'length() requires a string literal or array variable',
      expr.getLocation(),
      'E_LENGTH_INVALID_ARG',
    );
    return null;
  }

  // Handle array variable identifiers (existing code)
  if (arg.getNodeType() === ASTNodeType.IDENTIFIER_EXPR) {
    const varName = (arg as IdentifierExpression).getName();
    // ... existing implementation ...
  }

  // Unsupported argument type
  this.addError(
    'length() requires a string literal or array variable',
    expr.getLocation(),
    'E_LENGTH_INVALID_ARG',
  );
  return null;
}
```

## Code Examples

### Example 1: String Literal

```js
function test(): word {
  return length("hello");  // Returns 5
}
```

Generated IL:
```
CONST_WORD 5
RETURN
```

### Example 2: Empty String

```js
function test(): word {
  return length("");  // Returns 0
}
```

Generated IL:
```
CONST_WORD 0
RETURN
```

### Example 3: Long String

```js
function test(): word {
  return length("Hello, World! This is a longer string.");  // Returns 39
}
```

Generated IL:
```
CONST_WORD 39
RETURN
```

## Integration Points

### Files to Modify

1. `packages/compiler/src/il/generator/expressions.ts`
   - Method: `generateLengthIntrinsic`
   - Add `LITERAL_EXPR` handling before `IDENTIFIER_EXPR` handling

### Files to Update (Tests)

1. `packages/compiler/src/__tests__/e2e/type-acceptance.test.ts`
   - Unskip: "should accept length() with string literal"

## Error Handling

| Argument Type | Behavior |
|---------------|----------|
| String literal | Return length as compile-time constant |
| Array variable | Return array size as compile-time constant (existing) |
| Number literal | Error: "length() requires a string literal or array variable" |
| Boolean literal | Error: "length() requires a string literal or array variable" |
| Other expression | Error: "length() requires a string literal or array variable" |

## Testing Requirements

- `length("hello")` returns 5
- `length("")` returns 0
- `length("a")` returns 1
- `length("test string with spaces")` returns correct length
- Existing array variable tests continue to pass
- Error cases produce correct error messages