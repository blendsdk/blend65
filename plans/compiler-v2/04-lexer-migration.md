# Lexer Migration: Compiler v2

> **Document**: 04-lexer-migration.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Planning Complete

## Overview

The lexer is the first stage of the compiler pipeline. It converts source code into a stream of tokens. The v1 lexer is mature and well-tested, so we'll copy it with minimal changes.

## Migration Strategy

**Reuse**: 95%

**Changes Required**:
1. Remove @map-related token handling (if any separate tokens exist)
2. Ensure all v2 keywords are recognized
3. Update tests to remove @map test cases

## Source Files

### Files to Copy

| v1 File | v2 File | Changes |
|---------|---------|---------|
| `lexer/lexer.ts` | `lexer/lexer.ts` | Minor (see below) |
| `lexer/types.ts` | `lexer/types.ts` | Remove @map tokens |
| `lexer/utils.ts` | `lexer/utils.ts` | No changes |
| `lexer/index.ts` | `lexer/index.ts` | No changes |

### Test Files to Copy

| v1 Test | v2 Test | Changes |
|---------|---------|---------|
| `__tests__/lexer/*.test.ts` | `__tests__/lexer/*.test.ts` | Remove @map tests |

---

## Token Types

### Tokens to Keep (All Standard Tokens)

```typescript
enum TokenType {
  // Literals
  NUMBER,           // 123, $FF, 0xFF, %10101
  STRING,           // "hello"
  IDENTIFIER,       // myVar, main
  
  // Keywords
  MODULE,           // module
  IMPORT,           // import
  EXPORT,           // export
  FUNCTION,         // function
  LET,              // let
  CONST,            // const
  IF,               // if
  ELSE,             // else
  WHILE,            // while
  FOR,              // for
  RETURN,           // return
  BREAK,            // break
  CONTINUE,         // continue
  TRUE,             // true
  FALSE,            // false
  
  // Types
  BYTE,             // byte
  WORD,             // word
  BOOL,             // bool
  VOID,             // void
  
  // Storage classes
  AT_ZP,            // @zp
  AT_RAM,           // @ram
  AT_DATA,          // @data
  
  // Operators
  PLUS,             // +
  MINUS,            // -
  STAR,             // *
  SLASH,            // /
  PERCENT,          // %
  AMPERSAND,        // &
  PIPE,             // |
  CARET,            // ^
  TILDE,            // ~
  BANG,             // !
  LESS,             // <
  GREATER,          // >
  LESS_EQUAL,       // <=
  GREATER_EQUAL,    // >=
  EQUAL_EQUAL,      // ==
  BANG_EQUAL,       // !=
  AMPERSAND_AMPERSAND, // &&
  PIPE_PIPE,        // ||
  LESS_LESS,        // <<
  GREATER_GREATER,  // >>
  EQUAL,            // =
  PLUS_EQUAL,       // +=
  MINUS_EQUAL,      // -=
  STAR_EQUAL,       // *=
  SLASH_EQUAL,      // /=
  
  // Punctuation
  LPAREN,           // (
  RPAREN,           // )
  LBRACE,           // {
  RBRACE,           // }
  LBRACKET,         // [
  RBRACKET,         // ]
  COMMA,            // ,
  COLON,            // :
  SEMICOLON,        // ;
  DOT,              // .
  QUESTION,         // ?
  AT,               // @
  
  // Special
  EOF,              // End of file
  NEWLINE,          // Line break (if tracked)
  ERROR,            // Lexer error token
}
```

### Tokens to Remove

**Note**: v1 may not have separate @map tokens. The `@map` syntax was likely tokenized as:
- `AT` token followed by `IDENTIFIER` "map"

If there ARE separate tokens for @map, remove them:
```typescript
// Remove if present:
// AT_MAP,           // @map (if this exists as single token)
// MAP,              // map keyword (if this exists)
```

---

## Keyword List

### v2 Keywords

Ensure the keyword map includes all v2 keywords:

```typescript
const KEYWORDS: Map<string, TokenType> = new Map([
  // Module system
  ['module', TokenType.MODULE],
  ['import', TokenType.IMPORT],
  ['export', TokenType.EXPORT],
  
  // Declarations
  ['function', TokenType.FUNCTION],
  ['let', TokenType.LET],
  ['const', TokenType.CONST],
  
  // Control flow
  ['if', TokenType.IF],
  ['else', TokenType.ELSE],
  ['while', TokenType.WHILE],
  ['for', TokenType.FOR],
  ['return', TokenType.RETURN],
  ['break', TokenType.BREAK],
  ['continue', TokenType.CONTINUE],
  
  // Literals
  ['true', TokenType.TRUE],
  ['false', TokenType.FALSE],
  
  // Types
  ['byte', TokenType.BYTE],
  ['word', TokenType.WORD],
  ['bool', TokenType.BOOL],
  ['void', TokenType.VOID],
]);
```

### Storage Class Handling

Storage classes (`@zp`, `@ram`, `@data`) are tokenized as compound tokens:
- `@` + identifier → Check if storage class
- If "zp", "ram", or "data" follows `@`, emit storage class token
- Otherwise, emit `AT` token and continue

```typescript
// In lexer, when @ is encountered:
private scanAtToken(): Token {
  this.advance(); // consume @
  
  if (this.isAlpha(this.peek())) {
    const start = this.current;
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }
    const text = this.source.slice(start, this.current);
    
    switch (text) {
      case 'zp': return this.makeToken(TokenType.AT_ZP);
      case 'ram': return this.makeToken(TokenType.AT_RAM);
      case 'data': return this.makeToken(TokenType.AT_DATA);
      // NOTE: 'map' is NOT handled in v2 - it would be an error
      default:
        // Unknown @ identifier - could be error or just AT + IDENTIFIER
        this.current = start; // backtrack
        return this.makeToken(TokenType.AT);
    }
  }
  
  return this.makeToken(TokenType.AT);
}
```

---

## Number Literal Formats

The lexer must handle all number formats:

| Format | Example | Description |
|--------|---------|-------------|
| Decimal | `123` | Standard decimal |
| Hexadecimal ($) | `$FF` | 6502 style hex |
| Hexadecimal (0x) | `0xFF` | C-style hex |
| Binary | `%10101` | Binary with % prefix |

```typescript
private scanNumber(): Token {
  const start = this.start;
  
  // Check for hex ($) or binary (%)
  if (this.peek() === '$') {
    this.advance(); // consume $
    while (this.isHexDigit(this.peek())) {
      this.advance();
    }
    return this.makeToken(TokenType.NUMBER);
  }
  
  if (this.peek() === '%') {
    this.advance(); // consume %
    while (this.peek() === '0' || this.peek() === '1') {
      this.advance();
    }
    return this.makeToken(TokenType.NUMBER);
  }
  
  // Check for 0x hex
  if (this.peek() === '0' && this.peekNext() === 'x') {
    this.advance(); // consume 0
    this.advance(); // consume x
    while (this.isHexDigit(this.peek())) {
      this.advance();
    }
    return this.makeToken(TokenType.NUMBER);
  }
  
  // Regular decimal
  while (this.isDigit(this.peek())) {
    this.advance();
  }
  
  return this.makeToken(TokenType.NUMBER);
}
```

---

## Migration Tasks

### Session 2.1 Tasks

| # | Task | File | Description |
|---|------|------|-------------|
| 2.1.1 | Copy types.ts | `lexer/types.ts` | TokenType enum and interfaces |
| 2.1.2 | Review for @map | `lexer/types.ts` | Remove any @map-specific tokens |
| 2.1.3 | Copy lexer.ts | `lexer/lexer.ts` | Main lexer class |
| 2.1.4 | Review @ handling | `lexer/lexer.ts` | Ensure @map not specially handled |
| 2.1.5 | Copy utils.ts | `lexer/utils.ts` | Utility functions |
| 2.1.6 | Create index.ts | `lexer/index.ts` | Re-exports |
| 2.1.7 | Copy tests | `__tests__/lexer/` | All lexer tests |
| 2.1.8 | Remove @map tests | `__tests__/lexer/` | Delete @map test cases |
| 2.1.9 | Run tests | - | Verify all pass |

---

## Test Categories

### Tests to Keep

- Token recognition for all operators
- Keyword recognition
- Number format parsing (decimal, hex, binary)
- String literal parsing
- Comment handling (`//` and `/* */`)
- Storage class tokenization (`@zp`, `@ram`, `@data`)
- Error recovery tests
- Position tracking tests

### Tests to Remove/Update

- Any tests specifically for `@map` tokenization
- Any tests expecting `map` as a keyword

---

## Verification Checklist

After migration, verify:

- [ ] All standard tokens recognized
- [ ] All keywords tokenized correctly
- [ ] Storage classes (@zp, @ram, @data) work
- [ ] @map is NOT recognized as special (just @ + identifier "map")
- [ ] All number formats parse correctly
- [ ] String literals with escapes work
- [ ] Comments are skipped
- [ ] Position tracking is accurate
- [ ] All tests pass

---

## Example Token Streams

### Valid v2 Code

```js
module Example;

@zp let counter: byte = 0;

function increment(): void {
  counter = counter + 1;
}
```

**Tokens**:
```
MODULE "module"
IDENTIFIER "Example"
SEMICOLON ";"
AT_ZP "@zp"
LET "let"
IDENTIFIER "counter"
COLON ":"
BYTE "byte"
EQUAL "="
NUMBER "0"
SEMICOLON ";"
FUNCTION "function"
IDENTIFIER "increment"
LPAREN "("
RPAREN ")"
COLON ":"
VOID "void"
LBRACE "{"
IDENTIFIER "counter"
EQUAL "="
IDENTIFIER "counter"
PLUS "+"
NUMBER "1"
SEMICOLON ";"
RBRACE "}"
EOF
```

### Invalid v2 Code (Former @map)

```js
@map borderColor at $D020: byte;  // This is v1 syntax!
```

**Tokens** (v2 treats this as individual tokens):
```
AT "@"
IDENTIFIER "map"        // Not a keyword in v2
IDENTIFIER "borderColor"
IDENTIFIER "at"
NUMBER "$D020"          // Hex number
COLON ":"
BYTE "byte"
SEMICOLON ";"
```

The parser will fail on this, which is correct for v2.

---

## Related Documents

| Document | Description |
|----------|-------------|
| [02-salvage-analysis.md](02-salvage-analysis.md) | Overall salvage strategy |
| [03-package-setup.md](03-package-setup.md) | Package structure |
| [05-parser-migration.md](05-parser-migration.md) | Next: Parser migration |
| [99-execution-plan.md](99-execution-plan.md) | Full task list |