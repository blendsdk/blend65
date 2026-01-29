# Error Handling

> **Status**: Lexer-Derived Specification  
> **Last Updated**: January 8, 2026  
> **Related Documents**: [Lexical Structure](01-lexical-structure.md), [Grammar](02-grammar.md)

## Overview

This document describes lexer-level errors (tokenization errors). Parser and semantic errors are separate and may be documented elsewhere.

## Lexer Errors

The lexer detects and reports errors that occur during tokenization. These are fundamental syntax errors that prevent the source code from being converted into tokens.

### Unexpected Characters

Any character that does not belong to a valid token causes an exception.

**Error:**
```
Unexpected character at line X, column Y
```

**Examples:**

```js
let `backtick`;  // Error: Backtick not valid
let x@y: byte;   // Error: @ in middle of identifier
```

**Fix:**
```js
let backtick: byte;
let x_y: byte;
```

### Invalid Storage Class Keyword

Any `@` sequence not equal to `@zp`, `@ram`, `@data`, or `@map` throws an error.

**Error:**
```
Invalid storage class keyword '@...'
```

**Examples:**

```js
@           // Error: Incomplete storage class
@invalid    // Error: Unknown storage class
@ZP         // Error: Wrong case (must be lowercase)
```

**Fix:**
```js
@zp let x: byte;
@ram let y: byte;
@data const z: byte = 10;
@map border at $D020: byte;
```

### Invalid Numeric Literals

Invalid numeric prefixes throw errors:

**Dollar Sign Prefix (`$`)**

**Error:**
```
Invalid hexadecimal literal: expected hex digits after '$'
```

**Example:**
```js
let x = $;      // Error: No hex digits
let y = $G5;    // Error: Invalid hex digit 'G'
```

**Fix:**
```js
let x = $00;
let y = $F5;
```

**0x Prefix**

**Error:**
```
Invalid hexadecimal literal: expected hex digits after '0x'
```

**Example:**
```js
let x = 0x;     // Error: No hex digits
let y = 0xZZ;   // Error: Invalid hex digits
```

**Fix:**
```js
let x = 0x00;
let y = 0xFF;
```

**0b Prefix**

**Error:**
```
Invalid binary literal: expected binary digits after '0b'
```

**Example:**
```js
let x = 0b;     // Error: No binary digits
let y = 0b22;   // Error: Invalid binary digit '2'
```

**Fix:**
```js
let x = 0b0;
let y = 0b11;
```

### Unterminated String Literals

Missing closing quote throws an error.

**Error:**
```
Unterminated string literal at line X, column Y
```

**Examples:**

```js
let s = "hello;        // Error: Missing closing quote
let t = 'world;        // Error: Missing closing quote
```

**Fix:**
```js
let s = "hello";
let t = 'world';
```

**Multi-line Strings:**

Newlines inside strings are allowed, but the closing quote is still required:

```js
let s = "line1
line2     // Error: Still missing closing quote
```

**Fix:**
```js
let s = "line1
line2";
```

### Unterminated Block Comments

Missing closing `*/` throws an error.

**Error:**
```
Unterminated block comment at line X, column Y
```

**Example:**

```js
let x = 10; /* This comment never ends
let y = 20;
```

**Fix:**
```js
let x = 10; /* This comment ends */
let y = 20;
```

**Note:** Block comments are **not nested**:

```js
/* outer /* inner */ still comment */
```

The first `*/` closes the comment, and `still comment */` becomes source code (likely causing a parse error).

## Common Error Patterns

### Wrong Case in Keywords

Keywords are case-sensitive:

```js
Let x: byte = 10;      // Error: 'Let' is not a keyword
CONST MAX: byte = 10;  // Error: 'CONST' is not a keyword
```

**Fix:**
```js
let x: byte = 10;
const MAX: byte = 10;
```

### Missing Semicolons

Statements require semicolons:

```js
let x: byte = 10
let y: byte = 20  // Error: Missing semicolon on previous line
```

**Fix:**
```js
let x: byte = 10;
let y: byte = 20;
```

### Incorrect Number Formats

```js
let x = 0xGG;   // Error: Invalid hex digits
let y = $ZZ;    // Error: Invalid hex digits
let z = 0b22;   // Error: Invalid binary digits
```

**Fix:**
```js
let x = 0xFF;
let y = $FF;
let z = 0b11;
```

### Storage Class Errors

```js
@ let x: byte;         // Error: Incomplete storage class
@ZP let y: byte;       // Error: Wrong case
@invalid let z: byte;  // Error: Unknown storage class
```

**Fix:**
```js
@zp let x: byte;
@zp let y: byte;
@ram let z: byte;
```

## Error Recovery

The lexer does **not** attempt error recovery. When a lexer error is encountered:

1. An exception is thrown
2. Compilation stops
3. The error message includes line and column information

**Example error output:**
```
Error at line 5, column 12: Unterminated string literal
  let s = "hello
          ^
```

## Debugging Tips

### Check Character Encoding

Ensure source files are UTF-8 or ASCII:
- No smart quotes (`"` `"` instead of `"`)
- No em-dashes (—) or en-dashes (–)
- Standard ASCII punctuation

### Validate Number Literals

```js
// ✅ VALID
let a = 255;
let b = $FF;
let c = 0xFF;
let d = 0b11111111;

// ❌ INVALID
let e = $;        // No digits
let f = 0x;       // No digits
let g = 0b;       // No digits
let h = $GG;      // Invalid hex
let i = 0b22;     // Invalid binary
```

### Check String Termination

```js
// ✅ VALID
let s1 = "hello";
let s2 = 'world';
let s3 = "multi
line";

// ❌ INVALID
let s4 = "unterminated;
let s5 = 'also unterminated;
```

### Verify Comment Closure

```js
// ✅ VALID
// Line comment
/* Block comment */

/* Multi-line
   block comment */

// ❌ INVALID
/* Unclosed block comment
```

## Parser vs Lexer Errors

**Lexer errors** occur during tokenization:
- Invalid characters
- Malformed literals
- Unterminated strings/comments

**Parser errors** occur during parsing (not covered in this document):
- Syntax errors
- Missing declarations
- Type mismatches
- Ordering violations

**Example:**

```js
let x = $ZZ;  // Lexer error: Invalid hex digit
let x = ;     // Parser error: Expected expression
```

## Error Message Format

Lexer errors typically include:

1. **Error type** - What went wrong
2. **Location** - Line and column number
3. **Context** - Surrounding code (if available)

**Example:**
```
Error: Unterminated string literal
Location: line 10, column 15
  let message = "Hello
                ^
```

## Best Practices

### 1. Use Syntax Highlighting

A good editor with Blend65 syntax highlighting will help catch:
- Invalid keywords
- Unclosed strings
- Mismatched quotes

### 2. Validate Numbers

Double-check hexadecimal and binary literals:
```js
// Easy to mistype
let x = $D00;   // Missing a zero?
let y = $D000;  // Correct
```

### 3. Close Comments

Always close block comments:
```js
/* Start
   ...
   End */
```

### 4. Use Consistent Quotes

Pick a quote style and stick to it:
```js
// ✅ GOOD: Consistent
let s1 = "hello";
let s2 = "world";

// ⚠️ ACCEPTABLE: Mixed but intentional
let s3 = "hello";
let s4 = 'it\'s okay';
```

### 5. Check Storage Classes

Use correct storage class syntax:
```js
// ✅ CORRECT
@zp let counter: byte;
@ram let buffer: byte[256];
@data const table: byte[256];

// ❌ WRONG
@ZP let counter: byte;      // Wrong case
@ zp let counter: byte;     // Space
@invalid let x: byte;       // Unknown
```

## Implementation References

Lexer error handling is implemented in:
- `packages/compiler/src/lexer/lexer.ts` - Main lexer with error throwing
- `packages/compiler/src/lexer/types.ts` - Token definitions
- `packages/compiler/src/__tests__/lexer/` - Error test cases

See [Lexical Structure](01-lexical-structure.md) for valid token syntax.
