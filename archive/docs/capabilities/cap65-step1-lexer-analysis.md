# Step 1: Lexer Capabilities Analysis

**Status**: In Progress
**Part of**: cap65 Comprehensive Analysis
**Date**: December 1, 2026

## What This Step Covers

Focus ONLY on lexer capabilities - what tokens can be recognized and produced.

## Lexer Token Analysis

### Storage Class Tokens (@-prefixed)

- ✅ `@zp` → TokenType.ZP
- ✅ `@ram` → TokenType.RAM
- ✅ `@data` → TokenType.DATA
- ✅ `@map` → TokenType.MAP
- ✅ `@address` → TokenType.ADDRESS
- ✅ Unknown `@xxx` → TokenType.AT + TokenType.IDENTIFIER

### Number Formats

- ✅ Decimal: `42`, `255`, `65535`
- ✅ Hex ($): `$D000`, `$FF`, `$D020`
- ✅ Hex (0x): `0xD000`, `0xFF`, `0xD020`
- ✅ Binary (0b): `0b1010`, `0b11110000`

### String Literals

- ✅ Double quotes: `"hello world"`
- ✅ Single quotes: `'hello world'`
- ✅ Escape sequences: `\n`, `\t`, `\r`, `\\`, `\"`, `\'`
- ✅ Multi-line strings (with tracking)

### Keywords - All Categories

**Module System:**

```js
module Test.Game     // module keyword
import clearScreen   // import keyword
export function     // export keyword
from c64.graphics   // from keyword
```

**Function Keywords:**

```js
function main(): void    // function keyword
callback function irq   // callback keyword
return result;          // return keyword
end function           // end keyword
```

**Control Flow:**

```js
if condition then      // if, then keywords
else                  // else keyword
while running         // while keyword
for i = 1 to 10      // for, to keywords
next i               // next keyword
match value          // match keyword
case 1:             // case keyword
break;              // break keyword
continue;           // continue keyword
default:            // default keyword
```

**Variable Declaration:**

```js
let counter: byte = 0    // let keyword
const MAX_SIZE: word     // const keyword
type GameState = byte    // type keyword
enum Color              // enum keyword
```

**Primitive Types:**

```js
let x: byte = 5         // byte keyword
let y: word = 1000      // word keyword
function test(): void   // void keyword
let flag: boolean       // boolean keyword
let text: string        // string keyword
let handler: callback   // callback as type
```

**Memory Keywords:**

```js
@map vic at $D000: byte     // at keyword
@map data layout field: at  // layout keyword
```

### Operators - Complete Coverage

**Arithmetic:**

```js
x + y; // PLUS
x - y; // MINUS
x * y; // MULTIPLY
x / y; // DIVIDE
x % y; // MODULO
```

**Assignment:**

```js
x = 5; // ASSIGN
x += 1; // PLUS_ASSIGN
x -= 1; // MINUS_ASSIGN
x *= 2; // MULTIPLY_ASSIGN
x /= 2; // DIVIDE_ASSIGN
x %= 3; // MODULO_ASSIGN
```

**Comparison:**

```js
x == y; // EQUAL
x != y; // NOT_EQUAL
x < y; // LESS_THAN
x <= y; // LESS_EQUAL
x > y; // GREATER_THAN
x >= y; // GREATER_EQUAL
```

**Logical:**

```js
flag && other; // AND (&&)
flag || other; // OR (||)
!flag; // NOT (!)
```

**Bitwise:**

```js
x & y; // BITWISE_AND
x | y; // BITWISE_OR
x ^ y; // BITWISE_XOR
~x; // BITWISE_NOT
x << 2; // LEFT_SHIFT
x >> 2; // RIGHT_SHIFT
x &= y; // BITWISE_AND_ASSIGN
x |= y; // BITWISE_OR_ASSIGN
x ^= y; // BITWISE_XOR_ASSIGN
x <<= 2; // LEFT_SHIFT_ASSIGN
x >>= 2; // RIGHT_SHIFT_ASSIGN
```

### Punctuation

```js
( )       // LEFT_PAREN, RIGHT_PAREN
[ ]       // LEFT_BRACKET, RIGHT_BRACKET
{ }       // LEFT_BRACE, RIGHT_BRACE
,         // COMMA
;         // SEMICOLON
:         // COLON
.         // DOT
```

### Comments

```js
// Line comment
/* Block comment */
/* Multi-line
   block comment */
```

### Boolean Literals

```js
true; // BOOLEAN_LITERAL
false; // BOOLEAN_LITERAL
```

## Real C64 Programming Examples

```js
// VIC-II register access
@map vic at $D000: byte;
let borderColor: byte = vic.borderColor;

// SID sound programming
@map sid at $D400 type
  voice1Freq: word,
  voice1Control: byte
end @map

// Zero page optimization
@zp let fastCounter: byte = 0;

// Sprite positioning
@map sprites from $D000 to $D00F: byte;
sprites[0] = playerX;

// Hex addressing for hardware
let colorRAM: byte = screen[$D800 + offset];

// Binary flags for sprite control
let spriteEnable: byte = 0b11111111;
```

## What CANNOT Be Tokenized

- ❌ Hash comments: `# comment`
- ❌ Triple quotes: `"""string"""`
- ❌ Raw strings: `r"path\to\file"`
- ❌ Unicode identifiers: `σcore`
- ❌ Octal numbers: `0755`
- ❌ Float literals: `3.14`, `1.0`
- ❌ Exponent notation: `1e10`, `2.5e-3`

## Next Steps

This completes Step 1. The lexer can tokenize all documented Blend65 syntax and produces comprehensive token information with source positions for excellent error reporting.

**Ready for**: Step 2 - Parser Architecture Analysis
