# F021 — Lexical Structure

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: None (foundational — all other features depend on this)  
> **Referenced by**: Every feature (F001–F020, F022)


---

## Description

This feature defines the complete lexical structure of Blend65 v3 — the rules by which source text is decomposed into tokens. The lexer (tokenizer) is the first stage of the compiler pipeline: it reads UTF-8 source files and produces a stream of typed tokens that the parser consumes.

Blend65 uses ASCII-range grammar and identifiers. Source files are UTF-8; keywords, identifiers,
operators, punctuation, and literal delimiters use only U+0000–U+007F. String and character literal
content may contain Unicode scalar values, which the lexer preserves for compile-time target
encoding. Comments may also contain non-ASCII content and are discarded.

```blend65
// All language tokens are ASCII
module game;

const SCREEN: word = $0400;
let score: word = 0;
let lives: byte = 3;

function addScore(points: word): void {
    score = score + points;
    if (score > 9999) {
        score = 9999;  // cap at max display
    }
}
```

---

## Part 1: Source Encoding and Character Set

### LS-1: Source files are UTF-8

All Blend65 source files (`.blend` extension) are encoded as UTF-8. The compiler reads the byte stream as UTF-8 and processes ASCII-range bytes for tokenization.

- **BOM handling**: A leading UTF-8 BOM (U+FEFF, bytes `EF BB BF`) is silently skipped if present.
- **Non-ASCII in code**: Non-ASCII characters outside string literals, character literals, and
  comments produce error E10210.
- **Non-ASCII in strings and characters**: Preserved as Unicode scalar values in the literal token.
  The lexer performs no target conversion; semantic mapping or E10249 rejection is owned by
  F014/Chapter 08.
- **Non-ASCII in comments**: Ignored (comments are discarded).

### LS-2: Case sensitivity

Blend65 is **fully case-sensitive**. `break` is a keyword; `Break`, `BREAK`, and `bReAk` are identifiers. Type names `byte` and `Byte` are different tokens (`byte` is a keyword; `Byte` is an identifier).

---

## Part 2: Whitespace and Comments

### LS-3: Whitespace

The following characters are whitespace. The lexer skips all whitespace between tokens. Whitespace is never significant (Blend65 is not indentation-sensitive).

| Character | Code Point | Name |
|-----------|-----------|------|
| Space | U+0020 | Space |
| Tab | U+0009 | Horizontal tab |
| Carriage return | U+000D | CR |
| Line feed | U+000A | LF / Newline |

The lexer tracks line and column numbers for error reporting. Line numbers increment on LF (`\n`) and CR+LF (`\r\n`) sequences. A bare CR (`\r`) without following LF also increments the line number (for classic Mac line endings).

### LS-4: Semicolons as statement terminators

Blend65 uses **semicolons (`;`)** as statement terminators. Statements may span multiple lines freely — only the semicolon marks the end.

```blend65
let result: word = longExpression
    + anotherExpression
    + yetAnotherOne;  // semicolon ends the statement
```

### LS-5: Line comments

Line comments begin with `//` and extend to the end of the line (the next LF or CR+LF). The lexer discards the entire comment including the `//` prefix.

```blend65
// This is a line comment
let x: byte = 5;  // This is also a comment
```

### LS-6: Block comments

Block comments are delimited by `/*` and `*/`. They may span multiple lines. The lexer discards the entire block including delimiters.

```blend65
/* Single-line block comment */

/*
 * Multi-line block comment.
 * Describes complex logic.
 */

let x: byte = /* inline comment */ 5;
```

**Rules:**
- Block comments do **NOT** nest. `/* outer /* inner */ rest */` — the first `*/` ends the comment, and `rest */` is parsed as code (likely producing errors).
- An unterminated block comment (no closing `*/` before EOF) produces error E10211.
- Block comments may contain any bytes, including non-ASCII and null bytes.

---

## Part 3: Identifiers

### LS-7: Identifier rules

Identifiers name variables, constants, functions, struct types, modules, and other declarations.

**Rules:**
1. Must start with a letter (`A`–`Z`, `a`–`z`) or underscore (`_`)
2. May continue with letters, digits (`0`–`9`), or underscores
3. Are case-sensitive (`myVar` ≠ `MyVar` ≠ `MYVAR`)
4. Cannot be a keyword (see LS-8)
5. Cannot be a reserved built-in identifier (see LS-9) — enforced by semantic analysis, not the lexer
6. Have no maximum length limit (compiler may impose a practical limit, e.g., 255 characters)

```ebnf
letter      = "A"…"Z" | "a"…"z" ;
digit       = "0"…"9" ;

identifier  = ( letter | "_" ) , { letter | digit | "_" } ;
```

**Valid identifiers:**
```blend65
x
score
_temp
playerX
MAX_ENEMIES
sprite2
my_long_variable_name
```

**Invalid identifiers:**
```blend65
2fast       // starts with digit
let         // keyword
my-var      // hyphen not allowed
my var      // space not allowed
```

### LS-8: Naming conventions (non-enforced)

These conventions are recommended but not enforced by the compiler:

| Kind | Convention | Example |
|------|-----------|---------|
| Variables, parameters | camelCase | `playerScore`, `enemyCount` |
| Constants | UPPER_SNAKE_CASE | `MAX_ENEMIES`, `SCREEN_WIDTH` |
| Functions | camelCase | `movePlayer`, `checkCollision` |
| Struct types | PascalCase | `Enemy`, `SpriteData` |
| Modules | lowercase | `game`, `sprites`, `sound` |

---

## Part 4: Keywords

### LS-9: Keyword table

Keywords are reserved words that cannot be used as identifiers. The lexer matches identifier-shaped tokens against the keyword table and produces keyword-specific token types.

**32 keywords in 7 categories:**

#### Module system (F001, F002, F003)

```
module    import    export    from
```

#### Functions (F018, F007)

```
function    return    interrupt
```

#### Control flow (F008, F009, F013)

```
if      else      while     do
for     switch    case      default
fallthrough       break     continue
```

#### Declarations (F019, F005, F011)

```
let     const     zeropage    struct
```

#### Type names (F016, F010)

```
byte    sbyte     word      sword
boolean void
```

#### Boolean literals

```
true    false
```

#### Enums (F022) and reserved (`type`)

```
enum    type
```

**Rules:**
- Keywords are case-sensitive: `break` is a keyword, `Break` is an identifier.
- Using a keyword as an identifier produces a syntax error at parse time (the lexer produces the keyword token, and the parser rejects it where an identifier is expected).
- `enum` is an **active** keyword used by F022 (enum declarations).
- `type` is **reserved but currently unused**. Type aliases were evaluated and **rejected** (see `future-considerations.md` → REJ-001). The keyword is retained to protect future type-related syntax; using it produces the keyword token, and the parser rejects it in the current version with a clear error message (E10224).


```ebnf
keyword = "module" | "import" | "export" | "from"
        | "function" | "return" | "interrupt"
        | "if" | "else" | "while" | "do" | "for"
        | "switch" | "case" | "default" | "fallthrough"
        | "break" | "continue"
        | "let" | "const" | "zeropage" | "struct"
        | "byte" | "sbyte" | "word" | "sword" | "boolean" | "void"
        | "true" | "false"
        | "enum" | "type" ;
```

### LS-10: Reserved built-in and entry identifiers

These identifiers are NOT keywords (the lexer produces `IDENTIFIER` tokens for them). The semantic
analyzer prohibits redeclaring intrinsic names with E10212. `main` is entry-reserved instead: the
exact `function main(): void` declaration is legal, other declaration shapes are E10022, and calls
to it are E10023.

```
// Memory intrinsics (F020)
peek    poke    peekw    pokew
lo      hi      sizeof   offsetof   length

// CPU control intrinsics (F012)
asm_sei   asm_cli   asm_pha   asm_pla
asm_php   asm_plp   asm_clc   asm_sec
asm_cld   asm_sed   asm_clv   asm_nop   asm_brk

// Data/arithmetic intrinsics (F012, F015)
embed   bcd_add   bcd_sub

// Target encoding intrinsics (F014)
petscii   screen_codes   atascii   internal_codes
```

The four encoding names remain reserved on every target. An unavailable encoding call is E10125,
not a user-function call.

**Total: 29 globally reserved built-in identifiers, plus the entry-reserved name `main`.**

**Rules:**
- The lexer does NOT distinguish these from regular identifiers — it produces `IDENTIFIER` for all of them.
- The semantic analyzer recognizes these names and:
  - Resolves calls to the corresponding built-in functions
  - Produces E10212 if an intrinsic name is used in a `let`, `const`, `function`, `struct`, or parameter declaration
  - Applies E10020–E10023, rather than E10212, to the special entry name `main`
- This design keeps the lexer simple and keyword-table small while preventing confusing code.

**Example of prohibited usage:**
```blend65
let peek: byte = 5;         // E10212: Cannot redeclare reserved built-in 'peek'
function lo(): byte { ... }  // E10212: Cannot redeclare reserved built-in 'lo'
let main: byte = 0;          // E10022: entry point must be function main(): void
```

---

## Part 5: Numeric Literals

### LS-11: Decimal literals

Decimal (base-10) literals are sequences of digits `0`–`9`, optionally separated by underscores for readability.

```blend65
let x: byte = 0;
let y: word = 1000;
let z: word = 65535;
let bigNum: word = 10_000;    // underscore separator
```

**Rules:**
- Must contain at least one digit
- Leading zeros are allowed: `007` is valid and equals `7`
- Underscores may appear between digits only (not leading, not trailing, not consecutive): `1_000` ✅, `_100` is an identifier, `100_` ❌ E10213, `1__0` ❌ E10213

### LS-12: Hexadecimal literals

Hexadecimal (base-16) literals use two prefix styles:

**Dollar-sign prefix (`$`)** — the 6502 convention:
```blend65
let screen: word = $0400;
let color: byte = $FF;
let vic: word = $D020;
```

**C-style prefix (`0x`):**
```blend65
let screen: word = 0x0400;
let color: byte = 0xFF;
let vic: word = 0xD020;
```

**Rules:**
- Hex digits are `0`–`9`, `A`–`F`, `a`–`f` (case-insensitive)
- Must have at least one hex digit after the prefix: `$` alone or `0x` alone produces error E10214
- Underscores allowed between hex digits: `$FF_FF`, `0xDE_AD`
- Both prefix styles produce identical tokens — the prefix is not preserved
- Uppercase and lowercase hex digits may be mixed: `$DeAd` is valid

```ebnf
hex_digit       = "0"…"9" | "A"…"F" | "a"…"f" ;

hex_literal     = ( "$" | "0x" | "0X" )
                , hex_digit , { [ "_" ] , hex_digit } ;
```

### LS-13: Binary literals

Binary (base-2) literals use the `0b` prefix:

```blend65
let mask: byte = 0b11110000;
let bit0: byte = 0b00000001;
let pattern: byte = 0b1010_1010;   // underscore separator
let sprites: byte = 0b1111_1111;   // all 8 sprites enabled
```

**Rules:**
- Binary digits are `0` and `1` only
- Must have at least one binary digit after `0b`: `0b` alone produces error E10215
- Underscores allowed between binary digits: `0b1111_0000`

```ebnf
bin_digit       = "0" | "1" ;

bin_literal     = ( "0b" | "0B" )
                , bin_digit , { [ "_" ] , bin_digit } ;
```

### LS-14: Underscore separators in numeric literals

All three numeric literal formats support underscore (`_`) separators for readability. Underscores have no semantic effect — they are stripped during tokenization.

**Rules:**
1. Underscores may appear **between digits** only
2. No leading underscore after the prefix: `$_FF` ❌ E10213
3. No trailing underscore before the end: `$FF_` ❌ E10213
4. No consecutive underscores: `$F__F` ❌ E10213
5. At least one digit must appear on each side of an underscore

**Valid examples:**
```blend65
1_000           // decimal: 1000
65_535          // decimal: 65535
$FF_FF          // hex: 65535
$D0_20          // hex: 53280
0xFF_FF         // hex: 65535
0b1111_0000     // binary: 240
0b10_10_10_10   // binary: 170
```

### LS-15: Numeric literal value ranges

The lexer parses numeric literals as unsigned integer values. The **semantic analyzer** (not the lexer) validates that the value fits the target type. The lexer accepts any non-negative integer value.

| Type | Range | Max Literal |
|------|-------|-------------|
| byte | 0–255 | `255`, `$FF`, `0b11111111` |
| sbyte | -128–127 | (negative via unary minus, see F017) |
| word | 0–65535 | `65535`, `$FFFF`, `0b1111111111111111` |
| sword | -32768–32767 | (negative via unary minus) |

A literal value exceeding 65535 produces error E10216 at the lexer level (no Blend65 type can hold a value larger than 16 bits).

```ebnf
number_literal  = hex_literal
                | bin_literal
                | decimal_literal ;

decimal_literal = digit , { [ "_" ] , digit } ;
```

---

## Part 6: String Literals

### LS-16: String literal syntax

String literals are delimited by **double quotes** (`"`). They produce a sequence of bytes determined by the platform's character encoding (see F014).

```blend65
const TITLE: byte[] = "HELLO WORLD";
const EMPTY: byte[] = "";
```

**Rules:**
- Strings are single-line — a literal newline (LF or CR+LF) inside a string produces error E10217
- The closing `"` must appear on the same line as the opening `"`
- An unterminated string (no closing `"` before end of line or EOF) produces error E10218
- The empty string `""` is valid

```ebnf
string_literal  = '"' , { string_char } , '"' ;

string_char     = escape_sequence
                | ? any Unicode scalar value except U+0022, U+005C, U+000D, or U+000A ? ;
```

### LS-17: Escape sequences

String literals and char literals support the following escape sequences:

| Escape | Description | Byte Value |
|--------|-------------|-----------|
| `\\` | Backslash | Encoding-dependent |
| `\"` | Double quote | Encoding-dependent |
| `\'` | Single quote | Encoding-dependent |
| `\n` | Newline / line feed | Platform-defined via encoding |
| `\r` | Carriage return | Platform-defined via encoding |
| `\t` | Horizontal tab | Platform-defined via encoding |
| `\0` | Null byte | `$00` |
| `\xNN` | Hex byte value | `$NN` (exactly 2 hex digits) |

**Rules:**
- The escape set is **closed**: any `\` followed by a character NOT in this table produces error E10219. There are no "pass-through" escapes.
- `\xNN` requires **exactly** two hex digits: `\x4` ❌ E10220, `\x41` ✅ (`$41`, which is `A` in ASCII/PETSCII).
- `\0` and `\xNN` insert exact bytes and bypass encoding.
- Every other escape is symbolic. Semantic encoding resolves it through the selected profile table;
  a missing meaningful mapping is E10249, not a lexer error.
- `\\`, `\"`, and `\'` request the corresponding source character in the selected encoding.
- Ordinary literal characters are preserved as exact Unicode scalar values for the same semantic
  mapping. Lexing performs no normalization, transliteration, replacement, or byte conversion.

```ebnf
escape_sequence = ? U+005C REVERSE SOLIDUS ? , escape_char ;

escape_char     = "n" | "r" | "t" | "0" | ? U+005C REVERSE SOLIDUS ? | '"' | "'"
                | "x" , hex_digit , hex_digit ;
```

---

## Part 7: Character Literals

### LS-18: Char literal syntax

Character literals are delimited by **single quotes** (`'`). They contain one Unicode scalar value
or one escape sequence and represent one byte determined by the selected platform encoding.

```blend65
let ch: byte = 'A';
let zero: byte = '\0';
let hex: byte = '\x41';      // same as 'A' in ASCII/PETSCII
```

**Rules:**
- A char literal must contain **exactly one Unicode scalar value** or **exactly one escape sequence**;
  a glyph written as multiple scalar values is still a multi-character literal
- Empty char literal `''` produces error E10221
- Multi-character char literal `'AB'` produces error E10222
- Char literals use the same escape sequences as string literals (LS-17)
- The type of a char literal is `byte`
- Semantic encoding must produce exactly one byte; otherwise it reports E10249. `\0` and `\xNN`
  remain exact bytes.

```ebnf
char_literal    = "'" , char_content , "'" ;

char_content    = escape_sequence
                | ? any single Unicode scalar value except U+0027, U+005C, U+000D, or U+000A ? ;
```

---

## Part 8: Operators and Punctuation

### LS-19: Operator tokens

The lexer recognizes the following operator tokens. Multi-character operators are matched by longest-match (greedy): `<<` is one token, not two `<` tokens.

#### Arithmetic operators

| Token | Lexeme | Token Type |
|-------|--------|-----------|
| `+` | Plus | `PLUS` |
| `-` | Minus | `MINUS` |
| `*` | Star | `STAR` |
| `/` | Slash | `SLASH` |
| `%` | Percent | `PERCENT` |

#### Bitwise operators

| Token | Lexeme | Token Type |
|-------|--------|-----------|
| `&` | Ampersand | `AMPERSAND` |
| `\|` | Pipe | `PIPE` |
| `^` | Caret | `CARET` |
| `~` | Tilde | `TILDE` |
| `<<` | Left shift | `SHIFT_LEFT` |
| `>>` | Right shift | `SHIFT_RIGHT` |

#### Logical operators

| Token | Lexeme | Token Type |
|-------|--------|-----------|
| `&&` | Logical AND | `LOGICAL_AND` |
| `\|\|` | Logical OR | `LOGICAL_OR` |
| `!` | Logical NOT | `BANG` |

#### Comparison operators

| Token | Lexeme | Token Type |
|-------|--------|-----------|
| `==` | Equal | `EQUAL_EQUAL` |
| `!=` | Not equal | `BANG_EQUAL` |
| `<` | Less than | `LESS` |
| `<=` | Less or equal | `LESS_EQUAL` |
| `>` | Greater than | `GREATER` |
| `>=` | Greater or equal | `GREATER_EQUAL` |

#### Assignment operators

| Token | Lexeme | Token Type |
|-------|--------|-----------|
| `=` | Assign | `EQUAL` |
| `+=` | Add-assign | `PLUS_EQUAL` |
| `-=` | Sub-assign | `MINUS_EQUAL` |
| `*=` | Mul-assign | `STAR_EQUAL` |
| `/=` | Div-assign | `SLASH_EQUAL` |
| `%=` | Mod-assign | `PERCENT_EQUAL` |
| `&=` | And-assign | `AMPERSAND_EQUAL` |
| `\|=` | Or-assign | `PIPE_EQUAL` |
| `^=` | Xor-assign | `CARET_EQUAL` |
| `<<=` | Shl-assign | `SHIFT_LEFT_EQUAL` |
| `>>=` | Shr-assign | `SHIFT_RIGHT_EQUAL` |

#### Conditional operator

| Token | Lexeme | Token Type |
|-------|--------|------------|
| `?` | Question mark | `QUESTION` |

#### Address-of operator (F006)

| Token | Lexeme | Token Type |
|-------|--------|-----------|
| `&` | Address-of | `AMPERSAND` |

Note: `&` is the same token for both bitwise AND and address-of. The parser distinguishes based on context (unary prefix = address-of, binary infix = bitwise AND).

### LS-20: Punctuation tokens

| Token | Lexeme | Token Type | Usage |
|-------|--------|-----------|-------|
| `(` | Left paren | `LPAREN` | Grouping, function calls, control flow conditions |
| `)` | Right paren | `RPAREN` | Closing parenthesis |
| `[` | Left bracket | `LBRACKET` | Array indexing, array type syntax |
| `]` | Right bracket | `RBRACKET` | Closing bracket |
| `{` | Left brace | `LBRACE` | Block start, struct literals, zeropage block |
| `}` | Right brace | `RBRACE` | Block end |
| `,` | Comma | `COMMA` | Parameter/argument separator, array elements |
| `;` | Semicolon | `SEMICOLON` | Statement terminator |
| `:` | Colon | `COLON` | Type annotations, case labels |
| `.` | Dot | `DOT` | Struct field access, module-qualified names |

### LS-21: Special tokens

| Token Type | Description |
|-----------|-------------|
| `EOF` | End of file — produced when the input is exhausted |

---

## Part 9: Lexer Rules Summary

### LS-22: Tokenization order (maximal munch)

The lexer uses the **maximal munch** (longest match) principle: at each position, it consumes the longest possible token.

**Disambiguation rules:**
1. Skip whitespace and comments first
2. If the next character starts an identifier/keyword, consume the longest `[a-zA-Z_][a-zA-Z0-9_]*` sequence, then check the keyword table
3. If the next character is `$`, consume a hex literal
4. If the next character is `0` followed by `x`/`X`, consume a hex literal
5. If the next character is `0` followed by `b`/`B`, consume a binary literal
6. If the next character is a digit `0`–`9` (not covered above), consume a decimal literal
7. If the next character is `"`, consume a string literal
8. If the next character is `'`, consume a char literal
9. If the next characters match a multi-character operator (`==`, `!=`, `<=`, `>=`, `<<`, `>>`, `&&`, `||`, `+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `|=`, `^=`, `<<=`, `>>=`), consume the longest operator
10. If the next character matches a single-character operator or punctuation, consume it
11. Otherwise, produce error E10210

**Specific disambiguation cases:**

- `$D020`: `$` followed by hex digit → hex literal `$D020`, NOT a `$` token
- `0xFF`: `0` followed by `x` → hex literal `0xFF`, NOT decimal `0` followed by identifier `xFF`
- `0b1010`: `0` followed by `b` → binary literal `0b1010`, NOT decimal `0` followed by identifier `b1010`
- `&&`: two ampersands → `LOGICAL_AND`, NOT two `AMPERSAND` tokens
- `<<=`: `<<` followed by `=` → `SHIFT_LEFT_EQUAL`, NOT `SHIFT_LEFT` + `EQUAL`
- `&x`: `&` followed by identifier → `AMPERSAND` + `IDENTIFIER` (parser decides if address-of or bitwise AND)

### LS-23: Token position tracking

Every token carries position information for error reporting:

| Field | Description |
|-------|-------------|
| `file` | Source file path |
| `line` | 1-based line number |
| `column` | 1-based column number (byte offset from line start) |
| `length` | Length of the token in bytes |

---

## Part 10: Complete Token Type Enumeration

Every token produced by the Blend65 lexer belongs to exactly one of these types:

### Literals (3 types)

```
NUMBER          // All numeric literals (decimal, hex, binary)
STRING          // String literals ("...")
CHAR            // Character literals ('.')
// Boolean literals are keywords: KW_TRUE, KW_FALSE
```

### Identifiers (1 type)

```
IDENTIFIER      // User-defined names and reserved built-in identifiers
```

### Keywords (32 types)

```
// Module system
KW_MODULE  KW_IMPORT  KW_EXPORT  KW_FROM

// Functions
KW_FUNCTION  KW_RETURN  KW_INTERRUPT

// Control flow
KW_IF  KW_ELSE  KW_WHILE  KW_DO  KW_FOR
KW_SWITCH  KW_CASE  KW_DEFAULT  KW_FALLTHROUGH
KW_BREAK  KW_CONTINUE

// Declarations
KW_LET  KW_CONST  KW_ZEROPAGE  KW_STRUCT

// Types
KW_BYTE  KW_SBYTE  KW_WORD  KW_SWORD  KW_BOOLEAN  KW_VOID

// Boolean literals
KW_TRUE  KW_FALSE

// Enums (F022, active) and reserved type keyword (REJ-001)
KW_ENUM  KW_TYPE

```

### Operators (32 types)

```
// Arithmetic
PLUS  MINUS  STAR  SLASH  PERCENT

// Bitwise (& is also address-of)
AMPERSAND  PIPE  CARET  TILDE  SHIFT_LEFT  SHIFT_RIGHT

// Logical
LOGICAL_AND  LOGICAL_OR  BANG

// Comparison
EQUAL_EQUAL  BANG_EQUAL  LESS  LESS_EQUAL  GREATER  GREATER_EQUAL

// Assignment
EQUAL
PLUS_EQUAL  MINUS_EQUAL  STAR_EQUAL  SLASH_EQUAL  PERCENT_EQUAL
AMPERSAND_EQUAL  PIPE_EQUAL  CARET_EQUAL
SHIFT_LEFT_EQUAL  SHIFT_RIGHT_EQUAL
QUESTION
```

### Punctuation (10 types)

```
LPAREN  RPAREN      // ( )
LBRACKET  RBRACKET  // [ ]
LBRACE  RBRACE      // { }
COMMA               // ,
SEMICOLON           // ;
COLON               // :
DOT                 // .
```

### Special (1 type)

```
EOF                 // End of input
```

**Total: 79 token types** (3 literal + 1 identifier + 32 keyword + 32 operator + 10 punctuation + 1 special)

---

## Part 11: Complete Lexical EBNF Grammar

```ebnf
(* ===== Character classes ===== *)

letter          = "A"…"Z" | "a"…"z" ;
digit           = "0"…"9" ;
hex_digit       = digit | "A"…"F" | "a"…"f" ;
bin_digit       = "0" | "1" ;


(* ===== Whitespace and comments ===== *)

whitespace      = " " | ? HT byte ? | ? CR byte ? | ? LF byte ? ;

line_comment    = "//" , { ? any byte except LF ? }
                , ( ? LF byte ? | ? end of file ? ) ;

block_comment   = "/*" , { ? any byte except "*/" sequence ? } , "*/" ;


(* ===== Identifiers and keywords ===== *)

identifier      = ( letter | "_" ) , { letter | digit | "_" } ;

(* Keywords are identifier-shaped tokens matched against the keyword table.
   If an identifier matches a keyword, the keyword token type is produced.
   Otherwise, IDENTIFIER is produced. *)


(* ===== Numeric literals ===== *)

underscore_sep  = "_" ;

decimal_literal = digit , { [ underscore_sep ] , digit } ;

hex_literal     = ( "$" | "0x" | "0X" )
                , hex_digit , { [ underscore_sep ] , hex_digit } ;

bin_literal     = ( "0b" | "0B" )
                , bin_digit , { [ underscore_sep ] , bin_digit } ;

number_literal  = hex_literal
                | bin_literal
                | decimal_literal ;


(* ===== String and character literals ===== *)

escape_sequence = ? U+005C REVERSE SOLIDUS ?
                , ( "n" | "r" | "t" | "0" | ? U+005C REVERSE SOLIDUS ? | '"' | "'"
                         | "x" , hex_digit , hex_digit ) ;

string_literal  = '"' , { escape_sequence
                        | ? any Unicode scalar value except U+0022, U+005C, U+000D, or U+000A ? } , '"' ;

char_literal    = "'" , ( escape_sequence
                        | ? any single Unicode scalar value except U+0027, U+005C, U+000D, or U+000A ? ) , "'" ;


(* ===== Operators (longest match) ===== *)

operator        = "<<=" | ">>="
                | "<<" | ">>" | "&&" | "||" | "==" | "!=" | "<=" | ">="
                | "+=" | "-=" | "*=" | "/=" | "%="
                | "&=" | "|=" | "^="
                | "+" | "-" | "*" | "/" | "%"
                | "&" | "|" | "^" | "~"
                | "<" | ">" | "=" | "!" | "?" ;


(* ===== Punctuation ===== *)

punctuation     = "(" | ")" | "[" | "]" | "{" | "}"
                | "," | ";" | ":" | "." ;


(* ===== Token ===== *)

token           = whitespace       (* skipped *)
                | line_comment     (* skipped *)
                | block_comment    (* skipped *)
                | string_literal
                | char_literal
                | number_literal
                | identifier       (* checked against keyword table *)
                | operator
                | punctuation ;


(* ===== Source file ===== *)

source_file     = { token } , ? end of file ? ;
```

---

## Part 12: Resolved Ambiguities

### LS-A1: `$` as hex prefix vs. standalone symbol

**Question:** Could `$` ever be used as a standalone operator or symbol (like v2's `@`)?

**Resolution:** No. In Blend65 v3, `$` is **exclusively** a hex literal prefix. It must always be followed by at least one hex digit. A bare `$` produces error E10214. This avoids any ambiguity with other uses.

### LS-A2: `0b` / `0x` vs. identifier starting with `0`

**Question:** Is `0bytes` a decimal `0` followed by identifier `bytes`, or an error?

**Resolution:** The lexer applies **maximal munch**. When it sees `0` followed by `b`, it attempts a binary literal. If no valid binary digits follow (e.g., `0bytes` — `y` is not `0` or `1`), the lexer produces error E10215. Similarly, `0xGG` produces error E10214. This means `0` followed by `b` or `x` is ALWAYS interpreted as a literal prefix, never as decimal `0` + identifier.

**Consequence:** Identifiers cannot start with a digit (LS-7 rule 1), so there is no case where `0b...` should be parsed as two separate tokens.

### LS-A3: `&` as address-of vs. bitwise AND

**Question:** How does the lexer handle `&x` — is it address-of or bitwise AND?

**Resolution:** The lexer always produces a single `AMPERSAND` token. The **parser** disambiguates based on context:
- Unary prefix position (e.g., `&myVar`, `= &func`) → address-of (F006)
- Binary infix position (e.g., `a & b`, `mask & 0xFF`) → bitwise AND (F017)

This is standard C behavior and requires no lexer-level disambiguation.

### LS-A4: `<` `<` vs. `<<`

**Question:** Could two adjacent `<` ever mean something other than left-shift?

**Resolution:** No. The lexer uses **maximal munch**: `<<` is always the left-shift operator. There is no context in Blend65 where two consecutive `<` tokens are valid (no generics, no template syntax). Same applies to `>>`, `&&`, `||`.

### LS-A5: `/` vs. `//` vs. `/*`

**Question:** How does the lexer distinguish division from comments?

**Resolution:** **Maximal munch**: `/` followed by `/` starts a line comment. `/` followed by `*` starts a block comment. `/` followed by anything else (or at end of input) is the `SLASH` operator. Comment detection takes priority over operator scanning.

### LS-A6: `true`/`false` as keywords vs. literals

**Question:** Are `true` and `false` keywords or a separate literal token type?

**Resolution:** They are **keywords**. The lexer produces `KW_TRUE` and `KW_FALSE` tokens. The parser treats them as boolean literal expressions. This is simpler than having a separate `BOOLEAN_LITERAL` token type and means they are automatically reserved (cannot be used as identifiers).

### LS-A7: Char literal `'A'` vs. future single-quote usage

**Question:** Could single quotes be needed for other purposes in the future?

**Resolution:** In Blend65 v3, single quotes **exclusively** delimit character literals. If a future version needs single-quoted syntax for something else (e.g., lifetime annotations), it would require a breaking change. This is acceptable because the current usage is clean and conventional.

### LS-A8: Numeric literal overflow at lexer level

**Question:** Should the lexer validate numeric values against type ranges?

**Resolution:** The lexer validates only the **absolute maximum**: no value may exceed 65535 (the maximum 16-bit unsigned value). Values exceeding 65535 produce error E10216 at the lexer level. Type-specific range validation (e.g., `300` doesn't fit in `byte`) is performed by the **semantic analyzer**, which has type context.

### LS-A9: Underscore-only "number" literals

**Question:** Is `_` a valid numeric literal?

**Resolution:** No. `_` by itself is an identifier (starts with underscore, matches identifier rule). The underscore separator only applies within numeric literals that start with a digit or a hex/binary prefix. There is no ambiguity.

### LS-A10: `0` as a standalone literal

**Question:** How is `0` tokenized — decimal literal, or could it be a prefix for something?

**Resolution:** The lexer checks if `0` is followed by `x`/`X` (hex) or `b`/`B` (binary). If not, `0` is a decimal literal. `01234` is also a valid decimal literal (leading zeros allowed, no octal interpretation). Blend65 does NOT have octal literals.

---

## Part 13: Error Codes

### Lexer Errors

| Code | Public presentation |
|------|---------|
| E10210 | [Chapter 14](../14-diagnostics.md) |
| E10211 | [Chapter 14](../14-diagnostics.md) |
| E10212 | [Chapter 14](../14-diagnostics.md) |
| E10213 | [Chapter 14](../14-diagnostics.md) |
| E10214 | [Chapter 14](../14-diagnostics.md) |
| E10215 | [Chapter 14](../14-diagnostics.md) |
| E10216 | [Chapter 14](../14-diagnostics.md) |
| E10217 | [Chapter 14](../14-diagnostics.md) |
| E10218 | [Chapter 14](../14-diagnostics.md) |
| E10219 | [Chapter 14](../14-diagnostics.md) |
| E10220 | [Chapter 14](../14-diagnostics.md) |
| E10221 | [Chapter 14](../14-diagnostics.md) |
| E10222 | [Chapter 14](../14-diagnostics.md) |
| E10223 | [Chapter 14](../14-diagnostics.md) |
| E10224 | [Chapter 14](../14-diagnostics.md) |

### Warning Codes

| Code | Public presentation |
|------|---------|
| W10210 | [Chapter 14](../14-diagnostics.md) |

---

## Part 14: Feature Interactions

### With F001 (Multi-file compilation)
- Each source file is independently tokenized. The lexer operates on one file at a time.
- File paths in `import` statements are string literals tokenized by this feature.

### With F002 (Module declarations)
- `module` and `from` are keywords defined here. Module name after `module` is an `IDENTIFIER` token.

### With F003 (Module contents & visibility)
- `import`, `export` are keywords. The parser uses token types from this feature.

### With F004 (Entry point)
- `main` is an entry-reserved identifier (LS-10), not a built-in or keyword. The lexer produces `IDENTIFIER` for it.

### With F005 (Memory placement)
- `zeropage` is a keyword. v2's `@zp`/`@ram`/`@data` are completely removed.

### With F006 (Address-of)
- `&` is the `AMPERSAND` token. Parser disambiguates address-of (unary) from bitwise AND (binary).

### With F008 (For loop)
- `for`, `break`, `continue` are keywords.

### With F009 (Switch statement)
- `switch`, `case`, `default`, `fallthrough` are keywords. Note: `fallthrough` is new in v3 (not in v2).

### With F010 (Signed types)
- `sbyte`, `sword` are keywords (new in v3 — v2 did not have signed types).

### With F011 (Structs)
- `struct` is a keyword.

### With F013 (Control flow)
- `if`, `else`, `while`, `do` are keywords.

### With F014 (Arrays, strings, char literals)
- String and char literal tokenization defined here. Encoding transformation happens at the semantic level (F014), not the lexer.
- Target profiles may register named compile-time encoding intrinsics; there is no generic
  `encode` built-in.

### With F015 (Data inclusion)
- `embed` is a reserved built-in identifier.

### With F016 (Type system)
- Type keywords (`byte`, `sbyte`, `word`, `sword`, `boolean`, `void`) are keywords defined here.
- `true`, `false` are keywords producing `KW_TRUE`, `KW_FALSE`.

### With F017 (Operators)
- All operator tokens are defined here. Precedence and semantics are in F017; tokenization is here.

### With F018 (Functions)
- `function`, `return` are keywords.

### With F019 (Variables & constants)
- `let`, `const` are keywords.

### With F020 (Memory intrinsics)
- `peek`, `poke`, `peekw`, `pokew`, `lo`, `hi`, `sizeof`, `offsetof`, `length` are reserved built-in identifiers.

### With F012 (CPU control intrinsics)
- All `asm_*` names are reserved built-in identifiers.
- `bcd_add` and `bcd_sub` are reserved semantic arithmetic intrinsics with explicit operands.

### With F014 (Arrays and target encodings)
- `petscii`, `screen_codes`, `atascii`, and `internal_codes` are globally reserved intrinsic names;
  target availability is decided by E10125.

---

## Part 15: Tokenization Examples

### Example 1: Variable declaration with hex literal

**Source:**
```blend65
let color: byte = $0E;
```

**Tokens:**
| # | Type | Lexeme | Value |
|---|------|--------|-------|
| 1 | `KW_LET` | `let` | — |
| 2 | `IDENTIFIER` | `color` | — |
| 3 | `COLON` | `:` | — |
| 4 | `KW_BYTE` | `byte` | — |
| 5 | `EQUAL` | `=` | — |
| 6 | `NUMBER` | `$0E` | 14 |
| 7 | `SEMICOLON` | `;` | — |

### Example 2: Function with control flow

**Source:**
```blend65
function clampScore(val: word): word {
    if (val > 9999) {
        return 9999;
    }
    return val;
}
```

**Tokens:**
| # | Type | Lexeme |
|---|------|--------|
| 1 | `KW_FUNCTION` | `function` |
| 2 | `IDENTIFIER` | `clampScore` |
| 3 | `LPAREN` | `(` |
| 4 | `IDENTIFIER` | `val` |
| 5 | `COLON` | `:` |
| 6 | `KW_WORD` | `word` |
| 7 | `RPAREN` | `)` |
| 8 | `COLON` | `:` |
| 9 | `KW_WORD` | `word` |
| 10 | `LBRACE` | `{` |
| 11 | `KW_IF` | `if` |
| 12 | `LPAREN` | `(` |
| 13 | `IDENTIFIER` | `val` |
| 14 | `GREATER` | `>` |
| 15 | `NUMBER` | `9999` |
| 16 | `RPAREN` | `)` |
| 17 | `LBRACE` | `{` |
| 18 | `KW_RETURN` | `return` |
| 19 | `NUMBER` | `9999` |
| 20 | `SEMICOLON` | `;` |
| 21 | `RBRACE` | `}` |
| 22 | `KW_RETURN` | `return` |
| 23 | `IDENTIFIER` | `val` |
| 24 | `SEMICOLON` | `;` |
| 25 | `RBRACE` | `}` |
| 26 | `EOF` | — |

### Example 3: Memory intrinsics with address-of

**Source:**
```blend65
poke($D020, 14);
let addr: word = &score;
let hi_byte: byte = hi(addr);
```

**Tokens:**
| # | Type | Lexeme |
|---|------|--------|
| 1 | `IDENTIFIER` | `poke` |
| 2 | `LPAREN` | `(` |
| 3 | `NUMBER` | `$D020` |
| 4 | `COMMA` | `,` |
| 5 | `NUMBER` | `14` |
| 6 | `RPAREN` | `)` |
| 7 | `SEMICOLON` | `;` |
| 8 | `KW_LET` | `let` |
| 9 | `IDENTIFIER` | `addr` |
| 10 | `COLON` | `:` |
| 11 | `KW_WORD` | `word` |
| 12 | `EQUAL` | `=` |
| 13 | `AMPERSAND` | `&` |
| 14 | `IDENTIFIER` | `score` |
| 15 | `SEMICOLON` | `;` |
| 16 | `KW_LET` | `let` |
| 17 | `IDENTIFIER` | `hi_byte` |
| 18 | `COLON` | `:` |
| 19 | `KW_BYTE` | `byte` |
| 20 | `EQUAL` | `=` |
| 21 | `IDENTIFIER` | `hi` |
| 22 | `LPAREN` | `(` |
| 23 | `IDENTIFIER` | `addr` |
| 24 | `RPAREN` | `)` |
| 25 | `SEMICOLON` | `;` |

### Example 4: Struct, array, and binary literal

**Source:**
```blend65
struct Sprite {
    x: byte;
    y: byte;
    color: byte;
}

const SPRITE_MASK: byte = 0b1111_0000;
let enemies: Sprite[8];
```

**Tokens:**
| # | Type | Lexeme |
|---|------|--------|
| 1 | `KW_STRUCT` | `struct` |
| 2 | `IDENTIFIER` | `Sprite` |
| 3 | `LBRACE` | `{` |
| 4 | `IDENTIFIER` | `x` |
| 5 | `COLON` | `:` |
| 6 | `KW_BYTE` | `byte` |
| 7 | `SEMICOLON` | `;` |
| 8 | `IDENTIFIER` | `y` |
| 9 | `COLON` | `:` |
| 10 | `KW_BYTE` | `byte` |
| 11 | `SEMICOLON` | `;` |
| 12 | `IDENTIFIER` | `color` |
| 13 | `COLON` | `:` |
| 14 | `KW_BYTE` | `byte` |
| 15 | `SEMICOLON` | `;` |
| 16 | `RBRACE` | `}` |
| 17 | `KW_CONST` | `const` |
| 18 | `IDENTIFIER` | `SPRITE_MASK` |
| 19 | `COLON` | `:` |
| 20 | `KW_BYTE` | `byte` |
| 21 | `EQUAL` | `=` |
| 22 | `NUMBER` | `0b1111_0000` |
| 23 | `SEMICOLON` | `;` |
| 24 | `KW_LET` | `let` |
| 25 | `IDENTIFIER` | `enemies` |
| 26 | `COLON` | `:` |
| 27 | `IDENTIFIER` | `Sprite` |
| 28 | `LBRACKET` | `[` |
| 29 | `NUMBER` | `8` |
| 30 | `RBRACKET` | `]` |
| 31 | `SEMICOLON` | `;` |

---

## Part 16: Language Guard Evaluation

### Platform Universality (P)

| Rule | Status | Notes |
|------|--------|-------|
| P1 Cross-platform compilable | ✅ | Lexical structure is platform-independent — same tokens on all platforms |
| P2 Platform-meaningful | ✅ | Tokenization is universally required — every program on every platform goes through the lexer |
| P3 No platform assumptions | ✅ | No hardware addresses, chip names, or platform names in lexical rules. Symbolic escape mappings and deliberate unavailability are delegated to the platform encoding profile |
| P4 Resource-scalable | ✅ | The lexer runs on the host (compiler) machine, not the target. No target resource impact |

### Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅ | Lexical structure does not generate target code — it defines source-level tokens |
| H2 Cost transparency | ✅ | N/A — no target code generated by the lexer |
| H3 SFA compatible | ✅ | N/A — lexer is a compiler phase, not a runtime feature |
| H4 Memory footprint documented | ✅ | N/A — no target memory impact |
| H5 Fully deterministic | ✅ | Every input byte produces either a well-defined token or a specific error code. No undefined behavior in the lexer. Closed escape sequence set (LS-17). Unknown characters produce E10210 |

### Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅ | Complete EBNF grammar provided (Part 11). All ambiguities resolved (Part 12). Maximal munch rule (LS-22) is deterministic |
| L2 Consistent with existing | ✅ | Follows C/TypeScript conventions: `//` and `/* */` comments, `"..."` strings, `{}`/`()`/`[]` blocks, `;` terminators |
| L3 Beginner-friendly | ✅ | Any C/TypeScript developer can read Blend65 source without consulting the spec. `$` hex prefix is the only non-standard syntax, and it's the universal 6502 convention |
| L4 Minimal feature | ✅ | No exotic literal formats (no octal, no template strings, no regex literals, no raw strings). Only what's needed |
| L5 No redundancy | ⚠️ | Two hex prefixes (`$` and `0x`) overlap. Justified: `$` serves 6502 developers, `0x` serves C developers. Both communities are primary targets. Minimal cost |
| L6 Error messages defined | ✅ | 15 error codes (E10210–E10224) and 1 warning (W10210) cover all lexer error conditions |
| L7 Compile-time failure preferred | ✅ | ALL lexer errors are compile-time. The lexer is entirely a compile-time construct |
| L8 Feature interaction documented | ✅ | Interactions with all 20 existing features documented (Part 14) |
| L9 Documentable with examples | ✅ | 4 complete tokenization examples with full token-by-token traces (Part 15) |

### Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅ | The lexer is a standard DFA/regex-based scanner. No context-sensitivity. Keyword detection is a simple table lookup after identifier scanning |
| C2 Semantic analysis defined | ✅ | The lexer has no semantic analysis. E10212 (reserved built-in) is enforced by the semantic analyzer, not the lexer |
| C3 Code generation strategy | ✅ | N/A — the lexer does not generate target code. It produces tokens |
| C4 Unit testable | ✅ | Every token type has deterministic input→output behavior. Test cases are enumerable: one test per token type, plus error cases for each E10xxx code |
| C5 Runtime verifiable | ✅ | N/A — lexer is a compiler phase. Correctness is verified by compiler tests, not emulator runs |

### Future-Proofing (F)

| Rule | Status | Notes |
|------|--------|-------|
| F1 Extensible | ✅ | New keywords can be added to the keyword table. New operators can be added. New literal formats (e.g., octal, if ever needed) can be added. `enum` and `type` are already reserved |
| F2 Platform-profile ready | ✅ | Symbolic escapes are resolved or rejected through the selected platform encoding. The lexer itself is platform-independent |
| F3 Optimizer-friendly | ✅ | N/A — lexer output (tokens) is consumed by the parser, not the optimizer |
| F4 Stability classification | ✅ | **Stable**. The lexical structure is the foundation — changes here would break every program. Committed to stability |

### Escape Hatches Applied

None. All 23 rules pass.

### Verdict

**✅ ACCEPTED**

F021 formalizes the complete lexical structure of Blend65 v3, consolidating all token definitions established across F001–F024 into a single rationale document. The design is conventional (C/TypeScript-like with 6502 `$` hex prefix), deterministic (closed escape set, maximal munch, no undefined behavior), and extensible (keywords and operators can be added without breaking changes). The 79 token types, 32 keywords, 29 reserved built-in identifiers, and special entry-reserved `main` name form a clean, minimal foundation for the parser.
