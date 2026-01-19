# Lexical Structure

> **Status**: Lexer-Derived Specification  
> **Last Updated**: January 8, 2026  
> **Related Documents**: [Grammar](02-grammar.md), [Variables](10-variables.md), [Error Handling](20-error-handling.md)

## Character Set

The lexer operates over Unicode strings, but the language tokenization rules assume ASCII-like syntax:

- Identifiers use letters `A-Z`, `a-z`, digits `0-9`, and underscore `_`
- Keywords are **case-sensitive** (`break` is a keyword; `Break` is an identifier)

## Whitespace and Newlines

Whitespace characters (all treated as insignificant):
- Space (`' '`)
- Tab (`'\t'`)
- Carriage return (`'\r'`)
- Newline (`'\n'`)

All whitespace is skipped by the lexer and treated as trivial.

### Statement Separation

Blend65 uses **semicolons (`;`)** as statement separators, not newlines. This allows expressions and statements to span multiple lines naturally.

EBNF (lexical):

```ebnf
whitespace     = " " | "\t" | "\r" | "\n" ;
separator      = ";" ;
```

> **Note**: The lexer treats all whitespace uniformly. Semicolons are emitted as `SEMICOLON` tokens and are required for statement termination.

## Tokens

The lexer produces the following token categories:

- **Identifiers and keywords**
- **Numeric literals** (decimal, hex, binary)
- **String literals** (single or double quoted)
- **Boolean literals** (`true`, `false`)
- **Operators** (arithmetic, comparison, logical, bitwise, assignment)
- **Punctuation** (`()[]{},;:.`)
- **Comments** (`//` line, `/* ... */` block) — by default skipped
- **Special tokens** (`NEWLINE`, `EOF`)

## Identifiers

Identifiers start with a letter or underscore, and continue with letters, digits, or underscore.

EBNF:

```ebnf
alpha          = "A"…"Z" | "a"…"z" | "_" ;
digit          = "0"…"9" ;
alnum          = alpha | digit ;

identifier     = alpha , { alnum } ;
```

**Examples:**

```js
let snakeX: byte
let _tmp123: word
let myVariable: byte
let x2: word
```

**Rules:**
- Must start with letter or underscore
- Cannot start with a digit
- Case-sensitive (`myVar` ≠ `MyVar`)
- Cannot be a reserved keyword

## Keywords (Case-Sensitive)

The lexer recognizes a fixed set of keywords (from `KEYWORDS` in `types.ts`). All keywords are **case-sensitive**.

### Module System Keywords

```
module    import    export    from
```

### Function Keywords

```
function    return
```

### Control Flow Keywords

```
if          then        else
while
for         to          next
match       case        default
break       continue
end
```

**Note**: `end` is used to terminate blocks: `end if`, `end function`, `end while`, `end match`, `end enum`

### Type/Declaration Keywords

```
type    enum
```

### Mutability Modifiers

```
let    const
```

### Storage Class Keywords (Prefixed)

```
@zp      @ram      @data      @map
```

See [Variables](10-variables.md) and [Memory-Mapped](12-memory-mapped.md) for details.

### Primitive Type Keywords

```
byte       word       void
callback   string     boolean
```

See [Type System](05-type-system.md) for details.

### Complete EBNF

```ebnf
keyword = "module" | "import" | "export" | "from"
        | "function" | "return"
        | "if" | "then" | "else"
        | "while" | "for" | "to" | "next"
        | "match" | "case" | "default"
        | "break" | "continue"
        | "type" | "enum"
        | "let" | "const"
        | "end"
        | "@zp" | "@ram" | "@data" | "@map"
        | "byte" | "word" | "void" | "callback" | "string" | "boolean" ;
```

## Boolean Literals

The lexer treats `true` and `false` as boolean literals (not keywords).

EBNF:

```ebnf
boolean_literal = "true" | "false" ;
```

**Example:**

```js
let running: boolean = true
let gameOver: boolean = false
```

## Numeric Literals

The lexer supports three numeric literal formats:

### Decimal Literals

Standard base-10 numbers:

```js
let x: byte = 0
let y: word = 123
let z: word = 65535
```

### Hexadecimal Literals

Two prefix styles are supported:

**Dollar sign prefix** (`$`):
```js
let addr: word = $D000
let color: byte = $FF
let zero: byte = $00
```

**C-style prefix** (`0x`):
```js
let addr: word = 0xD000
let color: byte = 0xFF
let zero: byte = 0x00
```

### Binary Literals

Binary numbers use `0b` prefix:

```js
let mask: byte = 0b11110000
let flags: byte = 0b00000001
let pattern: byte = 0b10101010
```

### EBNF Grammar

```ebnf
decimal_literal = digit , { digit } ;
hex_digit       = digit | "A"…"F" | "a"…"f" ;
bin_digit       = "0" | "1" ;

hex_literal_dollar = "$" , hex_digit , { hex_digit } ;
hex_literal_0x     = "0x" , hex_digit , { hex_digit } ;
bin_literal_0b     = "0b" , bin_digit , { bin_digit } ;

number_literal  = hex_literal_dollar
                | hex_literal_0x
                | bin_literal_0b
                | decimal_literal ;
```

### Examples

```js
// Mixing formats is allowed
let screenBase: word = $0400     // Hex (C64 screen memory)
let colorRam: word = 0xD800      // Hex (C64 color RAM)
let spriteEnable: byte = 0b11111111  // Binary (all 8 sprites on)
let score: word = 65535          // Decimal
```

## String Literals

Strings can be quoted using **single quotes** (`'...'`) or **double quotes** (`"..."`).

### Basic Strings

```js
let title: string = "Hello, World!"
let name: string = 'Player 1'
```

### Escape Sequences

The lexer recognizes these escape sequences:

| Escape | Result | Description |
|--------|--------|-------------|
| `\n` | newline | Line feed |
| `\t` | tab | Horizontal tab |
| `\r` | carriage return | CR |
| `\\` | backslash | Literal backslash |
| `\"` | double quote | Literal `"` |
| `\'` | single quote | Literal `'` |

**Any other escape** `\X` is tokenized by including `X` as-is (no error).

### Multi-line Strings

Newlines **inside** string literals are permitted by the lexer. It updates its internal line/column tracking:

```js
let multiline: string = "line1
line2
line3"
```

### EBNF (Simplified)

```ebnf
string_literal = "\"" , { string_char } , "\""
               | "'"  , { string_char } , "'" ;

string_char = ? any char except unescaped matching quote ?
            | "\\" , ? escape char ? ;
```

### Examples

```js
let path: string = 'C:\\GAMES\\SNAKE'
let message: string = "He said \"Hello\""
let empty: string = ""
let newlines: string = "Line 1\nLine 2\nLine 3"
```

## Comments

Blend65 supports two comment styles:

### Line Comments

Line comments start with `//` and continue to the end of the line:

```js
// This is a line comment
let x: byte = 5;  // Comment after code
```

### Block Comments

Block comments are delimited by `/* ... */`:

```js
let x: byte = 5; /* inline comment */ let y: byte = 10;

/*
 * Multi-line block comment
 * describing complex logic
 */
```

### Comment Behavior

- By default, the lexer **skips** comments and does not emit tokens for them
- When configured with `skipComments: false`, it emits `LINE_COMMENT` or `BLOCK_COMMENT` tokens
- Block comments are **not nested**. A sequence like `/* outer /* inner */ still comment */` is tokenized by searching for the first closing `*/`

### EBNF

```ebnf
line_comment  = "//" , { ? any char except newline ? } ;
block_comment = "/*" , { ? any char ? } , "*/" ;
```

## Operators

The lexer tokenizes the following operators:

### Arithmetic Operators

```
+    -    *    /    %
```

### Comparison Operators

```
==    !=    <    <=    >    >=
```

### Logical Operators

```
&&    ||    !
```

### Bitwise Operators

```
&    |    ^    ~    <<    >>
```

### Assignment Operators

```
=     +=    -=    *=    /=    %=
&=    |=    ^=    <<=   >>=
```

See [Expressions & Statements](06-expressions-statements.md) for operator precedence and usage.

## Punctuation

The lexer recognizes these punctuation tokens:

```
(    )        Parentheses (grouping, function calls)
[    ]        Brackets (array indexing, type expressions)
{    }        Braces (future use)
,             Comma (parameter/argument separator)
;             Semicolon (statement terminator)
:             Colon (type annotations, case labels)
.             Dot (member access, qualified names)
```

## Special Tokens

### EOF (End of File)

Marks the end of the input stream.

### NEWLINE

While newlines are generally treated as whitespace, the lexer can optionally emit `NEWLINE` tokens when configured to do so. By default, newlines are skipped.

## Lexer Errors

The lexer throws errors for:

1. **Unexpected characters** - Characters that don't belong to any valid token
2. **Invalid storage class** - Any `@` sequence not equal to `@zp`, `@ram`, `@data`, or `@map`
3. **Invalid numeric literals** - Incomplete hex (`$`, `0x`) or binary (`0b`) prefixes with no digits
4. **Unterminated strings** - Missing closing quote
5. **Unterminated block comments** - Missing closing `*/`

See [Error Handling](20-error-handling.md) for detailed error descriptions and examples.

## Token Examples

Here's how a complete line is tokenized:

**Source:**
```js
@zp let counter: byte = $FF;
```

**Tokens:**
1. `ZP` (storage class)
2. `LET` (keyword)
3. `IDENTIFIER` ("counter")
4. `COLON`
5. `BYTE` (type keyword)
6. `ASSIGN`
7. `NUMBER` (255 / 0xFF)
8. `SEMICOLON`

## Implementation References

The lexer implementation can be found in:
- `packages/compiler/src/lexer/lexer.ts` - Main lexer logic
- `packages/compiler/src/lexer/types.ts` - Token type definitions and keyword list
- `packages/compiler/src/lexer/utils.ts` - Lexer utility functions
- `packages/compiler/src/__tests__/lexer/` - Comprehensive lexer tests
