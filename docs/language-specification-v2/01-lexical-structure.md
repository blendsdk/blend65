# Lexical Structure

> **Status**: Draft  
> **Related Documents**: [Types](02-types.md), [Variables](03-variables.md)

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
- **Operators** (arithmetic, comparison, logical, bitwise, assignment, ternary)
- **Punctuation** (`()[]{},;:.?`)
- **Comments** (`//` line, `/* ... */` block) — by default skipped
- **Special tokens** (`EOF`)

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
let snakeX: byte;
let _tmp123: word;
let myVariable: byte;
let x2: word;
```

**Rules:**
- Must start with letter or underscore
- Cannot start with a digit
- Case-sensitive (`myVar` ≠ `MyVar`)
- Cannot be a reserved keyword

## Keywords (Case-Sensitive)

The lexer recognizes a fixed set of keywords. All keywords are **case-sensitive**.

### Module System Keywords

```
module    import    export    from
```

### Function Keywords

```
function    return    callback
```

### Control Flow Keywords

```
if          else
while       do
for         to       downto    step
switch      case     default
break       continue
```

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
@zp      @ram      @data
```

See [Variables](03-variables.md) for details on storage classes.

### Primitive Type Keywords

```
byte       word       void
string     boolean
```

See [Types](02-types.md) for details.

### Complete EBNF

```ebnf
keyword = "module" | "import" | "export" | "from"
        | "function" | "return" | "callback"
        | "if" | "else"
        | "while" | "do"
        | "for" | "to" | "downto" | "step"
        | "switch" | "case" | "default"
        | "break" | "continue"
        | "type" | "enum"
        | "let" | "const"
        | "@zp" | "@ram" | "@data"
        | "byte" | "word" | "void" | "string" | "boolean" ;
```

## Boolean Literals

The lexer treats `true` and `false` as boolean literals (not keywords).

EBNF:

```ebnf
boolean_literal = "true" | "false" ;
```

**Example:**

```js
let running: boolean = true;
let gameOver: boolean = false;
```

## Numeric Literals

The lexer supports three numeric literal formats:

### Decimal Literals

Standard base-10 numbers:

```js
let x: byte = 0;
let y: word = 123;
let z: word = 65535;
```

### Hexadecimal Literals

Two prefix styles are supported:

**Dollar sign prefix** (`$`):
```js
let addr: word = $D000;
let color: byte = $FF;
let zero: byte = $00;
```

**C-style prefix** (`0x`):
```js
let addr: word = 0xD000;
let color: byte = 0xFF;
let zero: byte = 0x00;
```

### Binary Literals

Binary numbers use `0b` prefix:

```js
let mask: byte = 0b11110000;
let flags: byte = 0b00000001;
let pattern: byte = 0b10101010;
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
let screenBase: word = $0400;     // Hex (C64 screen memory)
let colorRam: word = 0xD800;      // Hex (C64 color RAM)
let spriteEnable: byte = 0b11111111;  // Binary (all 8 sprites on)
let score: word = 65535;          // Decimal
```

## String Literals

Strings can be quoted using **single quotes** (`'...'`) or **double quotes** (`"..."`).

### Basic Strings

```js
let title: string = "Hello, World!";
let name: string = 'Player 1';
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
line3";
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
let path: string = 'C:\\GAMES\\SNAKE';
let message: string = "He said \"Hello\"";
let empty: string = "";
let newlines: string = "Line 1\nLine 2\nLine 3";
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

### Ternary Operator

```
?    :
```

The ternary operator uses `?` and `:` for conditional expressions: `cond ? a : b`

### Address-Of Operator

```
@
```

When `@` is used before an identifier (not as a storage class prefix), it returns the memory address of the variable.

See [Expressions](04-expressions.md) for operator precedence and usage.

## Punctuation

The lexer recognizes these punctuation tokens:

```
(    )        Parentheses (grouping, function calls, control flow conditions)
[    ]        Brackets (array indexing, type expressions)
{    }        Braces (block delimiters for functions, control flow, enums, etc.)
,             Comma (parameter/argument separator)
;             Semicolon (statement terminator, module/import terminator)
:             Colon (type annotations, case labels, ternary operator)
.             Dot (member access, qualified names)
?             Question mark (ternary operator)
```

## Special Tokens

### EOF (End of File)

Marks the end of the input stream.

## Lexer Errors

The lexer throws errors for:

1. **Unexpected characters** - Characters that don't belong to any valid token
2. **Invalid storage class** - Any `@` sequence not equal to `@zp`, `@ram`, or `@data`
3. **Invalid numeric literals** - Incomplete hex (`$`, `0x`) or binary (`0b`) prefixes with no digits
4. **Unterminated strings** - Missing closing quote
5. **Unterminated block comments** - Missing closing `*/`

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

**Source:**
```js
function add(a: byte, b: byte): byte {
  return a + b;
}
```

**Tokens:**
1. `FUNCTION` (keyword)
2. `IDENTIFIER` ("add")
3. `LPAREN`
4. `IDENTIFIER` ("a")
5. `COLON`
6. `BYTE` (type keyword)
7. `COMMA`
8. `IDENTIFIER` ("b")
9. `COLON`
10. `BYTE` (type keyword)
11. `RPAREN`
12. `COLON`
13. `BYTE` (type keyword)
14. `LBRACE`
15. `RETURN` (keyword)
16. `IDENTIFIER` ("a")
17. `PLUS`
18. `IDENTIFIER` ("b")
19. `SEMICOLON`
20. `RBRACE`

**Source:**
```js
poke($D020, 14);
```

**Tokens:**
1. `IDENTIFIER` ("poke")
2. `LPAREN`
3. `NUMBER` (53280 / 0xD020)
4. `COMMA`
5. `NUMBER` (14)
6. `RPAREN`
7. `SEMICOLON`