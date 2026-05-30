# Chapter 01 — Lexical Structure

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F021

---

## 1. Overview

The lexer is the first stage of the Blend65 compiler pipeline. It reads a UTF-8 source file and produces a stream of typed tokens that the parser consumes. This chapter defines every token the lexer can produce, the rules for forming them, and the disambiguation rules that resolve ambiguous byte sequences.

Blend65 uses ASCII-range syntax exclusively. Source files are UTF-8, but all language constructs — identifiers, keywords, literals, operators, punctuation — use only the ASCII subset (U+0000–U+007F). Non-ASCII bytes may appear inside string literals (passed through as raw bytes) and comments (ignored).

---

## 2. Source Encoding and Character Set

### 2.1 UTF-8 Source Files

All Blend65 source files use the `.blend` extension and are encoded as UTF-8.

- **BOM handling**: A leading UTF-8 BOM (U+FEFF, bytes `EF BB BF`) is silently skipped if present.
- **Non-ASCII in code**: Non-ASCII characters outside string literals and comments produce **E10210**.
- **Non-ASCII in strings**: Passed through as raw bytes into the output. Encoding transformation is handled by the `encode()` system (→ Ch 08), not the lexer.
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

The for-loop range form (→ Ch 05, §7) uses four words — `until`, `to`, `downto`, and `step` — that are **contextual keywords**, not reserved words. The lexer produces ordinary `IDENTIFIER` tokens for them; the **parser** recognizes their special meaning only in the for-header position (between the loop bounds). Everywhere else they are valid identifiers.

```blend65
for (let i: byte = 0 until 10 step 2) { ... }  // 'until' and 'step' act as range keywords here
let to: byte = 5;                              // ✅ 'to' is a normal identifier
let step: word = readStep();                   // ✅ 'step' is a normal identifier
```

**Rationale:** Keeping these as contextual keywords avoids reserving four common English words across the whole language. The for-header is the only grammatical position where they carry special meaning, and the parser can resolve them there without lexer or symbol-table assistance (no context-sensitivity in the lexer — L1/C1).

### 5.2 Boolean Literals as Keywords

`true` and `false` are keywords. The lexer produces `KW_TRUE` and `KW_FALSE` tokens. The parser treats them as boolean literal expressions. They cannot be used as identifiers.

### 5.3 Reserved Built-In Identifiers

These identifiers are **not** keywords — the lexer produces `IDENTIFIER` tokens for them. The **semantic analyzer** prohibits redeclaring them (error **E10212**). They name built-in functions and the program entry point.

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

**Data intrinsics** (→ Ch 08, Ch 13):
```
encode    embed
```

**Entry point** (→ Ch 10):
```
main
```

**Total: 28 reserved built-in identifiers.**

**Design rationale:** Keeping these as identifiers (not keywords) keeps the keyword table small and the lexer simple. The semantic analyzer handles the restriction, which means these names resolve to their built-in functions when called and produce **E10212** when used in declarations.

```blend65
let peek: byte = 5;         // ❌ E10212: Cannot redeclare reserved built-in 'peek'
function lo(): byte { ... }  // ❌ E10212: Cannot redeclare reserved built-in 'lo'
let main: byte = 0;          // ❌ E10212: Cannot redeclare reserved built-in 'main'
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
const TITLE: byte[12] = "HELLO WORLD";
const EMPTY: byte[1] = "";
```

**Rules:**
- Strings are single-line. A literal newline inside a string produces **E10217**.
- The closing `"` must appear on the same line as the opening `"`.
- An unterminated string (no closing `"` before end of line or EOF) produces **E10218**.
- The empty string `""` is valid.

```ebnf
string_literal = '"' , { string_char } , '"' ;
string_char    = escape_sequence
               | ? any byte except '"', '\', CR, LF ? ;
```

### 7.2 Escape Sequences

String literals and character literals share the same escape sequences:

| Escape | Description | Byte Value |
|--------|-------------|-----------|
| `\\` | Backslash | `$5C` |
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
- `\0` inserts a literal zero byte, encoding-independent.
- `\n`, `\r`, `\t` byte values are resolved by the platform's character encoding profile (e.g., PETSCII `\n` = `$0D`, ATASCII `\n` = `$9B`). The `\xNN` escape bypasses encoding and inserts the exact byte.
- `\"` and `\'` produce the quote character in the platform's encoding.

```ebnf
escape_sequence = "\\" , escape_char ;
escape_char     = "n" | "r" | "t" | "0" | "\\" | '"' | "'"
                | "x" , hex_digit , hex_digit ;
```

---

## 8. Character Literals

Character literals are delimited by single quotes (`'`). They represent a single byte value in the platform's character encoding.

```blend65
let ch: byte = 'A';
let newline: byte = '\n';
let hex: byte = '\x41';
```

**Rules:**
- Must contain exactly one character or one escape sequence.
- Empty: `''` → **E10221**.
- Multi-character: `'AB'` → **E10222**.
- Unterminated: missing closing `'` → **E10223**.
- Uses the same escape sequences as string literals (§7.2).
- The type of a character literal is `byte`.

```ebnf
char_literal = "'" , char_content , "'" ;
char_content = escape_sequence
             | ? any single byte except "'", '\', CR, LF ? ;
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

**76 token types** total:

### Literals (4)

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

### Operators (29)

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

whitespace      = " " | "\t" | "\r" | "\n" ;
line_comment    = "//" , { ? any byte except LF ? } , ( LF | EOF ) ;
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

escape_sequence = "\\" , ( "n" | "r" | "t" | "0" | "\\" | '"' | "'"
                         | "x" , hex_digit , hex_digit ) ;
string_literal  = '"' , { escape_sequence
                        | ? any byte except '"', '\\', CR, LF ? } , '"' ;
char_literal    = "'" , ( escape_sequence
                        | ? any single byte except "'", '\\', CR, LF ? ) , "'" ;


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

source_file     = { token } , EOF ;
```

---

## 14. Error Codes

All lexer errors are compile-time errors.

| Code | Message |
|------|---------|
| E10210 | Unexpected character `<char>` (U+`<codepoint>`) — only ASCII characters are valid in Blend65 source code |
| E10211 | Unterminated block comment — expected `*/` before end of file |
| E10212 | Cannot redeclare reserved built-in `<name>` — this identifier is a built-in function/constant |
| E10213 | Invalid underscore in numeric literal — underscores must appear between digits only (no leading, trailing, or consecutive underscores) |
| E10214 | Invalid hexadecimal literal — expected hex digit (`0`–`9`, `A`–`F`) after `<prefix>` |
| E10215 | Invalid binary literal — expected binary digit (`0` or `1`) after `0b` |
| E10216 | Numeric literal value `<value>` exceeds maximum (65535) — no Blend65 type can hold values larger than 16 bits |
| E10217 | Newline in string literal — strings must be on a single line. Use `\n` for newline characters |
| E10218 | Unterminated string literal — expected closing `"` before end of line |
| E10219 | Unknown escape sequence `\<char>` — valid escapes are: `\\`, `\"`, `\'`, `\n`, `\r`, `\t`, `\0`, `\xNN` |
| E10220 | Incomplete hex escape `\x<char>` — `\x` requires exactly two hex digits (e.g., `\x41`) |
| E10221 | Empty character literal — char literals must contain exactly one character or escape sequence |
| E10222 | Multi-character literal `<literal>` — char literals must contain exactly one character. Use a string literal for multiple characters |
| E10223 | Unterminated character literal — expected closing `'` |
| E10224 | `<keyword>` is reserved for a future Blend65 version and cannot be used yet |

> **Note:** E10212 is enforced by the semantic analyzer, not the lexer. It is listed here because it governs identifiers defined in this chapter.

| Code | Message |
|------|---------|
| W10210 | Numeric literal has leading zeros: `<literal>` — Blend65 does not have octal literals; this is decimal `<value>` |
