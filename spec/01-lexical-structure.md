# Chapter 01 — Lexical Structure

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F021

---

## 1. Overview

The lexer is the first stage of the Blend65 compiler pipeline. It reads a UTF-8 source file and produces a stream of typed tokens that the parser consumes. This chapter defines every token the lexer can produce, the rules for forming them, and the disambiguation rules that resolve ambiguous byte sequences.

Blend65 uses ASCII-range grammar and identifiers. Source files are UTF-8; keywords, identifiers,
operators, punctuation, and literal delimiters use only U+0000–U+007F. String and character literal
content may contain Unicode scalar values, which the lexer preserves for compile-time target
encoding (→ Ch 08). Comments may also contain non-ASCII content and are discarded.

---

## 2. Source Encoding and Character Set

### 2.1 UTF-8 Source Files

All Blend65 source files use the `.blend` extension and are encoded as UTF-8.

- **BOM handling**: A leading UTF-8 BOM (U+FEFF, bytes `EF BB BF`) is silently skipped if present.
- **Non-ASCII in code**: Non-ASCII characters outside string literals, character literals, and
  comments produce **E10210**.
- **Non-ASCII in strings and characters**: Preserved as Unicode scalar values in the literal
  token. The selected encoding table determines semantic conversion or E10249 rejection (→ Ch 08);
  the lexer does not choose a target encoding.
- **Non-ASCII in comments**: Ignored — comments are discarded.

### 2.2 Case Sensitivity

Blend65 is **fully case-sensitive**. `break` is a keyword; `Break`, `BREAK`, and `bReAk` are identifiers. `byte` is a type keyword; `Byte` is a user identifier.

---

## 3. Whitespace and Comments

### 3.1 Whitespace

The lexer skips all whitespace between tokens. Whitespace is never significant — Blend65 is not indentation-sensitive.

| Character | Code Point | Name |
|-----------|-----------|------|
| Space | U+0020 | Space |
| Tab | U+0009 | Horizontal tab |
| Carriage return | U+000D | CR |
| Line feed | U+000A | LF / Newline |

Line numbers increment on LF (`\n`), CR+LF (`\r\n`), and bare CR (`\r`). Column numbers are 1-based byte offsets from the start of the line.

### 3.2 Semicolons

Blend65 uses **semicolons (`;`)** as statement terminators. There is no automatic semicolon insertion. Statements may span multiple lines — only the semicolon marks the end.

```blend65
let result: word = longExpression
    + anotherExpression
    + yetAnotherOne;  // semicolon ends the statement
```

### 3.3 Line Comments

Line comments begin with `//` and extend to the end of the line (the next LF or CR+LF). The lexer discards the entire comment including the `//` prefix.

```blend65
// This is a line comment
let x: byte = 5;  // This is also a comment
```

### 3.4 Block Comments

Block comments are delimited by `/*` and `*/`. They may span multiple lines.

```blend65
/* Single-line block comment */

/*
 * Multi-line block comment.
 * Describes complex logic.
 */

let x: byte = /* inline comment */ 5;
```

**Rules:**
- Block comments do **not** nest. In `/* outer /* inner */ rest */`, the first `*/` ends the comment; `rest */` is parsed as code.
- An unterminated block comment (no closing `*/` before EOF) produces **E10211**.
- Block comments may contain any bytes, including non-ASCII and null bytes.

---

## 4. Identifiers

### 4.1 Identifier Rules

Identifiers name variables, constants, functions, struct types, enum types, modules, and other declarations.

1. Must start with a letter (`A`–`Z`, `a`–`z`) or underscore (`_`).
2. May continue with letters, digits (`0`–`9`), or underscores.
3. Are case-sensitive (`myVar` ≠ `MyVar` ≠ `MYVAR`).
4. Cannot be a keyword (§5).
5. Cannot be a reserved built-in identifier (§5.3) — enforced by the semantic analyzer, not the lexer.
6. There is no maximum identifier length. Identifiers of any length are valid (Blend65 is developed on modern host machines; identifier length is not a target-platform constraint).

```ebnf
identifier  = ( letter | "_" ) , { letter | digit | "_" } ;
letter      = "A"…"Z" | "a"…"z" ;
digit       = "0"…"9" ;
```

### 4.2 Naming Conventions (Non-Enforced)

These conventions are recommended but not enforced by the compiler:

| Kind | Convention | Example |
|------|-----------|---------|
| Variables, parameters | camelCase | `playerScore`, `enemyCount` |
| Constants | UPPER_SNAKE_CASE | `MAX_ENEMIES`, `SCREEN_WIDTH` |
| Functions | camelCase | `movePlayer`, `checkCollision` |
| Struct types | PascalCase | `Enemy`, `SpriteData` |
| Enum types | PascalCase | `Direction`, `Color` |
| Modules | lowercase | `game`, `sprites`, `sound` |

---

## 5. Keywords and Reserved Identifiers

### 5.1 Keywords

Keywords are reserved words that cannot be used as identifiers. The lexer matches identifier-shaped tokens against the keyword table and produces keyword-specific token types.

**32 keywords in 7 categories:**

**Module system** (→ Ch 10):
```
module    import    export    from
```

**Functions** (→ Ch 06):
```
function    return    interrupt
```

**Control flow** (→ Ch 05):
```
if      else      while     do
for     switch    case      default
fallthrough       break     continue
```

**Declarations** (→ Ch 03, Ch 07):
```
let     const     zeropage    struct
```

**Type names** (→ Ch 02):
```
byte    sbyte     word      sword
boolean void
```

**Boolean literals**:
```
true    false
```

**Enums and reserved** (→ Ch 09):
```
enum    type
```

**Rules:**
- Keywords are case-sensitive: `break` is a keyword; `Break` is an identifier.
- `enum` is an active keyword used for enum declarations (→ Ch 09).
- `type` is **reserved but currently unused**. Type aliases were rejected (REJ-001 in `future-considerations.md`). Using `type` produces **E10224** with a clear message that the keyword is reserved for a future version.

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

### 5.1.1 Contextual Keywords

Import aliases use the contextual keyword `as`. The lexer produces an ordinary `IDENTIFIER` token
for it; the parser recognizes it only between names in an import item. `as` is not a cast operator;
casts use `Type(expr)` syntax. Everywhere else `as` is a valid identifier.

```blend65
import { Counter as TimerCounter } from timing; // contextual use
let as: byte = 5;                               // ✅ ordinary identifier here
```

The former range-loop words `until`, `to`, `downto`, and `step` have no language role and are
ordinary identifiers.

**Rationale:** Contextual recognition avoids reserving `as` across the whole language. The import
item is an unambiguous grammatical position, so the parser needs no lexer or symbol-table assistance
(L1/C1).

### 5.2 Boolean Literals as Keywords

`true` and `false` are keywords. The lexer produces `KW_TRUE` and `KW_FALSE` tokens. The parser treats them as boolean literal expressions. They cannot be used as identifiers.

### 5.3 Reserved Built-In and Entry Identifiers

These identifiers are **not** keywords—the lexer produces `IDENTIFIER` tokens for them. The
semantic analyzer reserves the intrinsic names globally and rejects their use in declarations with
**E10212**. The entry name `main` is different: it is permitted only for the exact entry-function
declaration governed by Chapter 10. A non-function declaration named `main`, or a `main` function
with the wrong signature, is **E10022**; calling it is **E10023**.

**Memory intrinsics** (→ Ch 04):
```
peek    poke    peekw    pokew
lo      hi      sizeof   offsetof   length
```

**CPU control intrinsics** (→ Ch 12):
```
asm_sei   asm_cli   asm_pha   asm_pla
asm_php   asm_plp   asm_clc   asm_sec
asm_cld   asm_sed   asm_clv   asm_nop   asm_brk
```

**Data-inclusion intrinsic** (→ Ch 13):
```
embed
```

**Packed-decimal arithmetic intrinsics** (→ Ch 12, §2.5):
```
bcd_add   bcd_sub
```

**Target encoding intrinsics** (→ Ch 08, Ch 15):
```
petscii   screen_codes   atascii   internal_codes
```

All four encoding names are reserved on every target so declaration meaning does not change with
the selected platform. Calling a name unavailable in the selected profile is E10125.

**Total: 29 globally reserved built-in identifiers, plus the entry-reserved name `main`.**

**Design rationale:** Keeping these as identifiers (not keywords) keeps the keyword table small and
the lexer simple. The semantic analyzer resolves intrinsic calls, produces **E10212** for intrinsic
redeclarations, and handles `main` through the dedicated entry-point rules.

```blend65
let peek: byte = 5;         // ❌ E10212: Cannot redeclare reserved built-in 'peek'
function lo(): byte { ... }  // ❌ E10212: Cannot redeclare reserved built-in 'lo'
let main: byte = 0;          // ❌ E10022: entry point must be function main(): void
```

---

## 6. Numeric Literals

### 6.1 Decimal Literals

Decimal (base-10) literals are sequences of digits `0`–`9`, optionally separated by underscores.

```blend65
let x: byte = 0;
let y: word = 1000;
let z: word = 65535;
let bigNum: word = 10_000;
```

**Rules:**
- Must contain at least one digit.
- Leading zeros are allowed: `007` is valid and equals `7`. Blend65 has no octal literals — leading zeros are always decimal. The compiler emits **W10210** for literals with leading zeros to prevent confusion.
- Underscores: see §6.4.

```ebnf
decimal_literal = digit , { [ "_" ] , digit } ;
```

### 6.2 Hexadecimal Literals

Two prefix styles are supported:

**Dollar-sign prefix (`$`)** — the universal 6502 convention:
```blend65
let screen: word = $0400;
let color: byte = $FF;
```

**C-style prefix (`0x` / `0X`)**:
```blend65
let screen: word = 0x0400;
let color: byte = 0xFF;
```

**Rules:**
- Hex digits are `0`–`9`, `A`–`F`, `a`–`f` (case-insensitive).
- At least one hex digit must follow the prefix. `$` alone or `0x` alone produces **E10214**.
- Both prefix styles produce identical tokens — the prefix is not preserved.

```ebnf
hex_digit   = "0"…"9" | "A"…"F" | "a"…"f" ;
hex_literal = ( "$" | "0x" | "0X" ) , hex_digit , { [ "_" ] , hex_digit } ;
```

### 6.3 Binary Literals

Binary (base-2) literals use the `0b` / `0B` prefix:

```blend65
let mask: byte = 0b11110000;
let bit0: byte = 0b00000001;
let pattern: byte = 0b1010_1010;
```

**Rules:**
- Binary digits are `0` and `1` only.
- At least one binary digit must follow `0b`. `0b` alone produces **E10215**.

```ebnf
bin_digit   = "0" | "1" ;
bin_literal = ( "0b" | "0B" ) , bin_digit , { [ "_" ] , bin_digit } ;
```

### 6.4 Underscore Separators

All three numeric literal formats support underscore (`_`) separators for readability. Underscores have no semantic effect — they are stripped during tokenization.

1. Underscores may appear **between digits** only.
2. No leading underscore after the prefix: `$_FF` → **E10213**.
3. No trailing underscore: `$FF_` → **E10213**.
4. No consecutive underscores: `$F__F` → **E10213**.

```blend65
1_000           // decimal: 1000
$FF_FF          // hex: 65535
0b1111_0000     // binary: 240
```

### 6.5 Value Range

The lexer parses numeric literals as unsigned integer values. A literal exceeding 65535 produces **E10216** at the lexer level — no Blend65 type can hold a value larger than 16 bits. Type-specific range validation (e.g., `300` does not fit in `byte`) is performed by the semantic analyzer (→ Ch 02, rule TS-2).

```ebnf
number_literal = hex_literal | bin_literal | decimal_literal ;
```

---

## 7. String Literals

### 7.1 Syntax

String literals are delimited by double quotes (`"`). They produce a sequence of bytes determined by the platform's character encoding (→ Ch 08).

```blend65
const TITLE: byte[] = "HELLO WORLD";
const EMPTY: byte[] = "";
```

**Rules:**
- Strings are single-line. A literal newline inside a string produces **E10217**.
- The closing `"` must appear on the same line as the opening `"`.
- An unterminated string (no closing `"` before end of line or EOF) produces **E10218**.
- The empty string `""` is valid.

```ebnf
string_literal = '"' , { string_char } , '"' ;
string_char    = escape_sequence
               | ? any Unicode scalar value except U+0022, U+005C, U+000D, or U+000A ? ;
```

### 7.2 Escape Sequences

String literals and character literals share the same escape sequences:

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
- The escape set is **closed**: any `\` followed by a character not in this table produces **E10219**.
- `\xNN` requires exactly two hex digits: `\x4` → **E10220**.
- `\0` and `\xNN` insert exact bytes and bypass encoding.
- Every other escape is symbolic. The semantic encoder resolves it through the selected platform
  encoding. When that encoding has no meaningful mapping, semantic analysis reports **E10249**;
  the lexer has still recognized a valid escape token.
- `\\`, `\"`, and `\'` request the corresponding source character in the selected encoding.
- Ordinary literal characters follow the same later mapping rule. The lexer preserves their exact
  Unicode scalar values without normalization, transliteration, replacement, or byte conversion.

```ebnf
escape_sequence = ? U+005C REVERSE SOLIDUS ? , escape_char ;
escape_char     = "n" | "r" | "t" | "0" | ? U+005C REVERSE SOLIDUS ? | '"' | "'"
                | "x" , hex_digit , hex_digit ;
```

---

## 8. Character Literals

Character literals are delimited by single quotes (`'`). They contain one Unicode scalar value or
one escape sequence and represent one byte in the selected platform encoding.

```blend65
let ch: byte = 'A';
let nul: byte = '\0';
let hex: byte = '\x41';
```

**Rules:**
- Must contain exactly one Unicode scalar value or one escape sequence. A user-perceived glyph made
  from multiple scalar values is a multi-character literal; no normalization or composition occurs.
- Empty: `''` → **E10221**.
- Multi-character: `'AB'` → **E10222**.
- Unterminated: missing closing `'` → **E10223**.
- Uses the same escape sequences as string literals (§7.2).
- The type of a character literal is `byte`.
- Semantic encoding must map the scalar value or symbolic escape to exactly one byte. No mapping, or
  a mapping that is not exactly one byte, is **E10249**. `\0` and `\xNN` remain exact bytes.

```ebnf
char_literal = "'" , char_content , "'" ;
char_content = escape_sequence
             | ? any single Unicode scalar value except U+0027, U+005C, U+000D, or U+000A ? ;
```

---

## 9. Operators

The lexer recognizes the following operator tokens. Multi-character operators are matched by **longest match** (maximal munch): `<<` is one token, not two `<` tokens.

### 9.1 Arithmetic

| Lexeme | Token Type |
|--------|-----------|
| `+` | `PLUS` |
| `-` | `MINUS` |
| `*` | `STAR` |
| `/` | `SLASH` |
| `%` | `PERCENT` |

### 9.2 Bitwise

| Lexeme | Token Type |
|--------|-----------|
| `&` | `AMPERSAND` |
| `\|` | `PIPE` |
| `^` | `CARET` |
| `~` | `TILDE` |
| `<<` | `SHIFT_LEFT` |
| `>>` | `SHIFT_RIGHT` |

### 9.3 Logical

| Lexeme | Token Type |
|--------|-----------|
| `&&` | `LOGICAL_AND` |
| `\|\|` | `LOGICAL_OR` |
| `!` | `BANG` |

### 9.4 Comparison

| Lexeme | Token Type |
|--------|-----------|
| `==` | `EQUAL_EQUAL` |
| `!=` | `BANG_EQUAL` |
| `<` | `LESS` |
| `<=` | `LESS_EQUAL` |
| `>` | `GREATER` |
| `>=` | `GREATER_EQUAL` |

### 9.5 Assignment

| Lexeme | Token Type |
|--------|-----------|
| `=` | `EQUAL` |
| `+=` | `PLUS_EQUAL` |
| `-=` | `MINUS_EQUAL` |
| `*=` | `STAR_EQUAL` |
| `/=` | `SLASH_EQUAL` |
| `%=` | `PERCENT_EQUAL` |
| `&=` | `AMPERSAND_EQUAL` |
| `\|=` | `PIPE_EQUAL` |
| `^=` | `CARET_EQUAL` |
| `<<=` | `SHIFT_LEFT_EQUAL` |
| `>>=` | `SHIFT_RIGHT_EQUAL` |

### 9.6 Conditional

| Lexeme | Token Type |
|--------|-----------|
| `?` | `QUESTION` |
| `:` | `COLON` |

The `?` and `:` tokens are used by the conditional (ternary) operator (→ Ch 04). The `:` token is shared with type annotations and case labels; the parser disambiguates by context.

### 9.7 Address-Of

The `&` token (`AMPERSAND`) serves dual purposes — bitwise AND (binary infix) and address-of (unary prefix). The lexer always produces a single `AMPERSAND` token; the **parser** disambiguates by position (→ Ch 04).

```ebnf
operator = "<<=" | ">>="
         | "<<" | ">>" | "&&" | "||" | "==" | "!=" | "<=" | ">="
         | "+=" | "-=" | "*=" | "/=" | "%="
         | "&=" | "|=" | "^="
         | "+" | "-" | "*" | "/" | "%"
         | "&" | "|" | "^" | "~"
         | "<" | ">" | "=" | "!" | "?" ;
```

---

## 10. Punctuation

| Lexeme | Token Type | Usage |
|--------|-----------|-------|
| `(` | `LPAREN` | Grouping, function calls, control-flow conditions, cast syntax |
| `)` | `RPAREN` | Closing parenthesis |
| `[` | `LBRACKET` | Array indexing, array type syntax |
| `]` | `RBRACKET` | Closing bracket |
| `{` | `LBRACE` | Block start, struct literals, zeropage block |
| `}` | `RBRACE` | Block end |
| `,` | `COMMA` | Parameter/argument/element separator |
| `;` | `SEMICOLON` | Statement terminator |
| `:` | `COLON` | Type annotations, case labels, ternary operator |
| `.` | `DOT` | Struct field access, module-qualified names |

```ebnf
punctuation = "(" | ")" | "[" | "]" | "{" | "}"
            | "," | ";" | ":" | "." ;
```

---

## 11. Tokenization Rules

### 11.1 Maximal Munch

The lexer uses the **maximal munch** (longest match) principle: at each position, it consumes the longest possible token.

### 11.2 Disambiguation Order

At each position after skipping whitespace and comments:

1. If `"` → string literal.
2. If `'` → character literal.
3. If `$` followed by hex digit → hex literal.
4. If `0` followed by `x`/`X` → hex literal.
5. If `0` followed by `b`/`B` → binary literal.
6. If digit `0`–`9` (not covered above) → decimal literal.
7. If letter or `_` → identifier; check keyword table; produce keyword token or `IDENTIFIER`.
8. If next characters match a multi-character operator → longest operator match.
9. If next character matches a single-character operator or punctuation → produce that token.
10. Otherwise → **E10210**.

### 11.3 Specific Disambiguation Cases

| Input | Resolution |
|-------|-----------|
| `$D020` | `$` + hex digit → hex literal `$D020` |
| `0xFF` | `0` + `x` → hex literal `0xFF` |
| `0b1010` | `0` + `b` → binary literal `0b1010` |
| `&&` | Two `&` → `LOGICAL_AND`, not two `AMPERSAND` |
| `<<=` | `<<` + `=` → `SHIFT_LEFT_EQUAL`, not `SHIFT_LEFT` + `EQUAL` |
| `&x` | `&` → `AMPERSAND`; `x` → `IDENTIFIER` (parser decides meaning) |
| `/` + `/` | `//` → line comment (comment detection precedes operator scanning) |
| `/` + `*` | `/*` → block comment |
| `0bytes` | `0` + `b` → binary literal attempt → `y` is not `0`/`1` → **E10215** |

### 11.4 Token Position Tracking

Every token carries position information for error reporting:

| Field | Description |
|-------|-------------|
| `file` | Source file path |
| `line` | 1-based line number |
| `column` | 1-based column number (byte offset from line start) |
| `length` | Length of the token in bytes |

---

## 12. Complete Token Type Enumeration

**79 token types** total:

### Literals (3)

| Token Type | Description |
|-----------|-------------|
| `NUMBER` | All numeric literals (decimal, hex, binary) |
| `STRING` | String literals (`"..."`) |
| `CHAR` | Character literals (`'.'`) |

Boolean literals are keywords (`KW_TRUE`, `KW_FALSE`), not a separate literal type.

### Identifiers (1)

| Token Type | Description |
|-----------|-------------|
| `IDENTIFIER` | User-defined names and reserved built-in identifiers |

### Keywords (32)

```
KW_MODULE    KW_IMPORT    KW_EXPORT    KW_FROM
KW_FUNCTION  KW_RETURN    KW_INTERRUPT
KW_IF        KW_ELSE      KW_WHILE     KW_DO       KW_FOR
KW_SWITCH    KW_CASE      KW_DEFAULT   KW_FALLTHROUGH
KW_BREAK     KW_CONTINUE
KW_LET       KW_CONST     KW_ZEROPAGE  KW_STRUCT
KW_BYTE      KW_SBYTE     KW_WORD      KW_SWORD    KW_BOOLEAN  KW_VOID
KW_TRUE      KW_FALSE
KW_ENUM      KW_TYPE
```

### Operators (32)

```
PLUS  MINUS  STAR  SLASH  PERCENT
AMPERSAND  PIPE  CARET  TILDE  SHIFT_LEFT  SHIFT_RIGHT
LOGICAL_AND  LOGICAL_OR  BANG
EQUAL_EQUAL  BANG_EQUAL  LESS  LESS_EQUAL  GREATER  GREATER_EQUAL
EQUAL
PLUS_EQUAL  MINUS_EQUAL  STAR_EQUAL  SLASH_EQUAL  PERCENT_EQUAL
AMPERSAND_EQUAL  PIPE_EQUAL  CARET_EQUAL
SHIFT_LEFT_EQUAL  SHIFT_RIGHT_EQUAL
QUESTION
```

### Punctuation (10)

```
LPAREN  RPAREN  LBRACKET  RBRACKET  LBRACE  RBRACE
COMMA  SEMICOLON  COLON  DOT
```

### Special (1)

| Token Type | Description |
|-----------|-------------|
| `EOF` | End of input |

---

## 13. Lexical EBNF Grammar

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


(* ===== Numeric literals ===== *)

decimal_literal = digit , { [ "_" ] , digit } ;
hex_literal     = ( "$" | "0x" | "0X" )
                , hex_digit , { [ "_" ] , hex_digit } ;
bin_literal     = ( "0b" | "0B" )
                , bin_digit , { [ "_" ] , bin_digit } ;
number_literal  = hex_literal | bin_literal | decimal_literal ;


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

## 14. Diagnostic Conditions

This chapter owns lexical and reserved-identifier predicates. Chapter 14 alone owns public
severities, templates, spans, suppression, and history.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10210 | A non-ASCII character occurs outside a string literal, character literal, or comment. | The character cannot form a language token. |
| E10211 | End of file occurs before a block comment's closing `*/`. | The unterminated comment is rejected. |
| E10212 | A declaration reuses a reserved built-in identifier. | Semantic analysis rejects the declaration; lexing still emits an ordinary identifier token. |
| E10213 | A numeric separator is leading, trailing, or consecutive rather than between digits. | The numeric literal is rejected. |
| E10214 | A hexadecimal prefix is not followed by a valid hexadecimal digit sequence. | The literal is rejected. |
| E10215 | A binary prefix is not followed by a valid binary digit sequence. | The literal is rejected. |
| E10216 | A numeric literal's mathematical value exceeds 65535. | The literal is rejected before type conversion. |
| E10217 | A raw newline occurs before a string literal closes. | The string is rejected. |
| E10218 | A source line ends before a string literal's closing quote. | The string is rejected. |
| E10219 | A string or character literal contains an escape outside the closed supported set. | The literal is rejected. |
| E10220 | A `\x` escape does not contain exactly two hexadecimal digits. | The literal is rejected. |
| E10221 | A character literal contains no character or escape. | The literal is rejected. |
| E10222 | A character literal contains more than one character/escape unit. | The literal is rejected. |
| E10223 | A character literal has no closing quote. | The literal is rejected. |
| E10224 | Source uses a word reserved for a future language version. | The token is rejected in the current language version. |

### Warning Conditions

| Code | Trigger | Consequence |
|------|---------|-------------|
| W10210 | A decimal literal has leading zeros. | It retains its decimal value; no octal interpretation occurs. |
