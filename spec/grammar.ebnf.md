# Blend65 v3 — Master EBNF Grammar

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: provisional  
> **Gate G4 criteria**: (1) Every language construct has a production. (2) Provably LL(k) /
> recursive-descent + Pratt parseable. (3) Dangling-else resolved via mandatory blocks.
> (4) No tokenization ambiguities.

---

## 1. Notation

This grammar uses **ISO 14977 EBNF** with minor extensions:

| Notation | Meaning |
|----------|---------|
| `=` | Production rule definition |
| `,` | Concatenation (sequential) |
| `\|` | Alternation (choice) |
| `{ X }` | Repetition — zero or more of X |
| `[ X ]` | Optional — zero or one of X |
| `( X )` | Grouping |
| `"..."` | Terminal string literal |
| `'...'` | Terminal string literal (alternate quoting) |
| `(*...*)` | Comment |
| `;` | End of production |

Character ranges use the notation `"A"…"Z"` to denote all characters from A to Z inclusive.

---

## 2. Source Structure

### 2.1 Program

```ebnf
program         = module_decl , { top_level_item } ;

top_level_item  = import_stmt
                | function_decl
                | interrupt_decl
                | struct_decl
                | enum_decl
                | let_decl
                | const_decl
                | zeropage_block ;
```

### 2.2 Module Declaration (→ Ch 10)

```ebnf
module_decl     = "module" , qualified_name , ";" ;
```

### 2.3 Import (→ Ch 10)

```ebnf
import_stmt     = "import" , "{" , import_list , "}" , "from" , qualified_name , ";" ;
import_list     = import_item , { "," , import_item } ;
import_item     = identifier , [ "as" , identifier ] ;
qualified_name  = identifier , { "." , identifier } ;
```

---

## 3. Declarations

### 3.1 Variables & Constants (→ Ch 03)

```ebnf
let_decl        = [ "export" ] , "let" , identifier , ":" , value_type
                , [ "=" , expression ] , ";" ;

const_decl      = [ "export" ] , "const" , identifier , ":" , value_type
                , "=" , const_expression , ";" ;

zeropage_block  = "zeropage" , "{" , zeropage_var , { zeropage_var } , "}" ;
zeropage_var    = [ "export" ] , identifier , ":" , value_type
                , [ "=" , expression ] , ";" ;
```

### 3.2 Functions (→ Ch 06)

```ebnf
function_decl   = [ "export" ] , "function" , identifier
                , "(" , [ param_list ] , ")"
                , ":" , return_type
                , block ;

interrupt_decl  = [ "export" ] , "interrupt" , "function" , identifier
                , "(" , ")"
                , ":" , "void" , block ;

param_list      = param , { "," , param } ;
param           = identifier , ":" , [ "const" ] , value_type ;

return_type     = "void" | value_type ;
```

### 3.3 Structs (→ Ch 07)

```ebnf
struct_decl     = [ "export" ] , "struct" , identifier , "{"
                , struct_field , { struct_field }
                , "}" ;

struct_field    = identifier , ":" , value_type , ";" ;
```

### 3.4 Enums (→ Ch 09)

```ebnf
enum_decl       = [ "export" ] , "enum" , identifier , "{"
                , enum_member , { "," , enum_member } , [ "," ]
                , "}" ;

enum_member     = identifier , [ "=" , const_expression ] ;
```

---

## 4. Types (→ Ch 02)

```ebnf
type            = "void" | value_type ;

value_type      = integer_type
                | "boolean"
                | array_type
                | qualified_name ;       (* struct or enum name *)

integer_type    = "byte" | "sbyte" | "word" | "sword" ;

array_type      = array_element_type , "[" , [ const_expression ] , "]" ;
array_element_type = integer_type | "boolean" | qualified_name ;
```

**Parsing note:** `qualified_name` in `type` is a local or module-qualified struct/enum name. The
semantic pass resolves whether the name refers to a struct, enum, or is undefined. Chapter 14 owns
the canonical unknown-type diagnostic.
This avoids context-sensitivity in the parser.

---

## 5. Statements (→ Ch 05)

### 5.1 Statement

```ebnf
statement       = var_decl_local
                | const_decl_local
                | expression_stmt
                | if_stmt
                | while_stmt
                | do_while_stmt
                | for_stmt
                | switch_stmt
                | return_stmt
                | break_stmt
                | continue_stmt
                | block ;
```

### 5.2 Local Declarations

```ebnf
var_decl_local  = "let" , identifier , ":" , value_type
                , [ "=" , expression ] , ";" ;

const_decl_local = "const" , identifier , ":" , value_type
                 , "=" , const_expression , ";" ;
```

`zeropage` is module-level only. A local declaration never carries `zeropage`; the parser rejects
that spelling before semantic analysis.

### 5.3 Expression Statement

```ebnf
expression_stmt = expression , ";" ;
```

Any expression may appear as a statement. Assignment and CPU-control intrinsic calls use this
production. Its result, if any, is discarded. W10131 remains exclusively the unreachable-code
warning and is never used merely because an expression result is discarded.

### 5.4 Block

```ebnf
block           = "{" , { statement } , "}" ;
```

### 5.5 If / Else (→ Ch 05, §4)

```ebnf
if_stmt         = "if" , "(" , expression , ")" , block
                , [ "else" , ( if_stmt | block ) ] ;
```

**Dangling-else resolution:** The body is always a `block` (mandatory braces, CF-1).
This means the parser never encounters a bare statement after `if` — the grammar is
unambiguous without any special rule.

### 5.6 While (→ Ch 05, §5)

```ebnf
while_stmt      = "while" , "(" , expression , ")" , block ;
```

### 5.7 Do-While (→ Ch 05, §6)

```ebnf
do_while_stmt   = "do" , block , "while" , "(" , expression , ")" , ";" ;
```

### 5.8 For Loop (→ Ch 05, §7)

```ebnf
for_stmt        = "for" , "(" , [ for_initializer ] , ";"
                , [ expression ] , ";" , [ for_update ] , ")" , block ;

for_initializer = for_local_decl | expression_list ;
for_local_decl  = "let" , identifier , ":" , value_type , [ "=" , expression ]
                | "const" , identifier , ":" , value_type , "=" , const_expression ;
for_update      = expression_list ;
expression_list = expression , { "," , expression } ;
```

**Parsing note:** The statement parser owns the two semicolon delimiters and closing parenthesis,
and calls the ordinary expression parser for each present expression. Commas at the top level of an
initializer/update clause delimit its left-to-right expression list; commas nested in calls or
literals remain part of that expression. No symbol-table or target knowledge is required.

### 5.9 Switch (→ Ch 05, §8)

```ebnf
switch_stmt     = "switch" , "(" , expression , ")" , "{"
                , { case_clause }
                , [ default_clause ]
                , "}" ;

case_clause     = "case" , case_value_list , ":" , case_body ;
case_value_list = const_expression , { "," , const_expression } ;
default_clause  = "default" , ":" , case_body ;
case_body       = { statement } , [ "fallthrough" , ";" ] ;
```

### 5.10 Jump Statements

```ebnf
return_stmt     = "return" , [ expression ] , ";" ;
break_stmt      = "break" , ";" ;
continue_stmt   = "continue" , ";" ;
```

---

## 6. Expressions (→ Ch 04)

### 6.1 Strategy: Recursive Descent + Pratt Parsing

Blend65 expressions use 14 precedence levels (→ Ch 04, §2). The grammar below is
structured for **Pratt parsing** (operator-precedence parsing), which avoids the deeply
nested precedence-per-production style that is verbose and harder to maintain.

**For the Pratt parser**, the key information is the **binding power** and **associativity**
of each operator. The EBNF below defines the *structure*; the precedence table in Ch 04
defines the *behavior*.

### 6.2 Expression (Entry Point)

```ebnf
expression      = assignment_expr ;

(* Assignment: level 1 (lowest), right-associative. The semantic pass requires
   the left operand to be an assignable place. *)
assignment_expr = conditional_expr , [ assign_op , assignment_expr ] ;
assign_op       = "=" | "+=" | "-=" | "*=" | "/=" | "%="
                | "&=" | "|=" | "^=" | "<<=" | ">>=" ;

(* Conditional (ternary): level 2, right-associative *)
conditional_expr = logical_or_expr , [ "?" , expression , ":" , conditional_expr ] ;

(* NOTE: The ternary is right-associative: a ? b : c ? d : e = a ? b : (c ? d : e) *)

logical_or_expr  = logical_and_expr , { "||" , logical_and_expr } ;
logical_and_expr = bitwise_or_expr , { "&&" , bitwise_or_expr } ;
bitwise_or_expr  = bitwise_xor_expr , { "|" , bitwise_xor_expr } ;
bitwise_xor_expr = bitwise_and_expr , { "^" , bitwise_and_expr } ;
bitwise_and_expr = equality_expr , { "&" , equality_expr } ;
equality_expr    = relational_expr , { ( "==" | "!=" ) , relational_expr } ;
relational_expr  = shift_expr , { ( "<" | "<=" | ">" | ">=" ) , shift_expr } ;
shift_expr       = additive_expr , { ( "<<" | ">>" ) , additive_expr } ;
additive_expr    = multiplicative_expr , { ( "+" | "-" ) , multiplicative_expr } ;
multiplicative_expr = unary_expr , { ( "*" | "/" | "%" ) , unary_expr } ;
```

### 6.3 Unary Expressions

```ebnf
unary_expr      = ( "!" | "~" | "-" | "&" ) , unary_expr
                | postfix_expr ;
```

**Note:** `&` in unary position is the address-of operator (→ Ch 04, §8). In binary
position it is bitwise AND (→ §6.2 `bitwise_and_expr`). The parser disambiguates by
position: prefix = address-of, infix = bitwise AND.

Explicit casts use call-shaped syntax: `byte(expr)`, `sbyte(expr)`, `word(expr)`,
`sword(expr)`, or `EnumName(expr)`. Primitive cast names have their own primary production;
an identifier followed by a call is parsed uniformly and semantic name resolution distinguishes an
enum cast from a function call. There is no `as` cast operator.

### 6.4 Postfix Expressions

```ebnf
postfix_expr    = primary_expr , { postfix_op } ;

postfix_op      = "(" , [ arg_list ] , ")"           (* function call *)
                | "[" , expression , "]"              (* array index *)
                | "." , identifier ;                  (* member access *)

arg_list        = expression , { "," , expression } ;
```

### 6.5 Primary Expressions

```ebnf
primary_expr    = number_literal
                | string_literal
                | char_literal
                | "true"
                | "false"
                | primitive_cast
                | identifier
                | struct_literal
                | array_literal
                | intrinsic_call
                | "(" , expression , ")" ;

primitive_cast  = integer_type , "(" , expression , ")" ;
```

### 6.6 Struct Literal (→ Ch 07)

```ebnf
struct_literal  = "{" , field_init , { "," , field_init } , [ "," ] , "}" ;
field_init      = identifier , ":" , expression ;
```

**Parsing note:** `{` begins a struct literal in expression position and a block in statement
position. The declared or expected type supplies the struct type; field names and order are checked
semantically.

### 6.7 Array Literal (→ Ch 08)

```ebnf
array_literal   = "[" , [ array_init_content ] , "]" ;
array_init_content = expression , { "," , expression }
                   | expression , { "," , expression } , ";" , expression
                   | ";" , expression ;
```

The semicolon form is the **fill syntax**: explicit values before `;` are placed first and the
single element after `;` fills the remaining declared extent. `[]` is a zero-length array literal
when its element type is supplied by context. String and encoded
string expressions use the same production, with Chapter 08 enforcing their no-concatenation and
single-element fill restrictions.

### 6.8 Constant Expression

```ebnf
const_expression = expression ;
```

A `const_expression` is syntactically identical to `expression`. The **semantic pass**
verifies that all operands are compile-time constants (literal values, `const` variables,
`sizeof`, `offsetof`, fixed-array `length`, `lo`, `hi`). An any-size parameter's `length` is a
runtime word and therefore fails this semantic check. Chapter 14 owns the canonical diagnostic when a
runtime value appears in a constant-expression context.

---

## 7. Intrinsic Calls (→ Ch 08, Ch 12, Ch 13)

### 7.1 CPU Control Intrinsics

```ebnf
intrinsic_call  = cpu_intrinsic
                | memory_intrinsic
                | query_intrinsic
                | ( "bcd_add" | "bcd_sub" ) , "(" , expression , "," , expression , ")"
                | ( "petscii" | "screen_codes" | "atascii" | "internal_codes" )
                  , "(" , ( string_literal | char_literal ) , [ "," , string_literal ] , ")"
                | embed_expr ;

cpu_intrinsic   = cpu_intrinsic_name , "(" , ")" ;

cpu_intrinsic_name = "asm_sei" | "asm_cli"
                   | "asm_pha" | "asm_pla"
                   | "asm_php" | "asm_plp"
                   | "asm_clc" | "asm_sec"
                   | "asm_cld" | "asm_sed"
                   | "asm_clv"
                   | "asm_nop" | "asm_brk" ;
```

All reserved built-ins are identifier-shaped lexer tokens rather than keywords. In primary
expression position, the parser dispatches a `reserved_builtin` spelling followed by `(` to
`intrinsic_call`; that spelling is not also eligible for the generic `identifier` alternative.
This lexeme check needs no symbol table and makes the alternatives deterministic. Semantic analysis
then owns operand types, target availability, and the canonical diagnostic for an invalid call.

### 7.2 Memory Intrinsics

```ebnf
memory_intrinsic = "peek" , "(" , expression , ")"
                 | "poke" , "(" , expression , "," , expression , ")"
                 | "peekw" , "(" , expression , ")"
                 | "pokew" , "(" , expression , "," , expression , ")"
                 | "lo" , "(" , expression , ")"
                 | "hi" , "(" , expression , ")" ;
```

### 7.3 Size and Element-Count Query Intrinsics

```ebnf
query_intrinsic = "sizeof" , "(" , type , ")"
                | "offsetof" , "(" , qualified_name , "," , identifier , ")"
                | "length" , "(" , expression , ")" ;
```

The grammar accepts an unsized array spelling in the `type` position so one shared type production
remains sufficient. Semantic analysis rejects `sizeof(T[])` with E10266 because that contextual
parameter/inference form has no standalone fixed extent.

---

## 8. Data Inclusion (→ Ch 13)

```ebnf
embed_expr      = "embed" , "(" , string_literal , [ "," , string_literal ] , ")" ;
```

The path and optional selector are string literals. The selector is an exact, case-sensitive key
interpreted only by the selected platform-profile format handler; the core grammar does not parse
the key as a member path or query language. Raw binary embedding has no selector. There are no
generic `format`, `index`, `offset`, or `size` arguments.

---

## 9. Lexical Grammar (→ Ch 01)

### 9.1 Identifiers

```ebnf
identifier      = ( letter | "_" ) , { letter | digit | "_" } ;
letter          = "A"…"Z" | "a"…"z" ;
digit           = "0"…"9" ;
```

The lexical production admits every identifier-shaped spelling. Semantic analysis rejects keywords
and reserved intrinsic names in declaration positions; the entry-reserved spelling `main` is legal
only for the exact Chapter-10 entry-function declaration (→ Ch 01, §5–§7).

### 9.2 Keywords (32 total)

```ebnf
keyword         = "module" | "import" | "export" | "from"
                | "function" | "return" | "interrupt"
                | "if" | "else" | "while" | "do" | "for"
                | "switch" | "case" | "default" | "fallthrough"
                | "break" | "continue"
                | "let" | "const" | "zeropage" | "struct"
                | "byte" | "sbyte" | "word" | "sword" | "boolean" | "void"
                | "true" | "false"
                | "enum" | "type" ;
```

### 9.3 Contextual Keywords

```ebnf
contextual_keyword = "as" ;
```

`as` is recognized only between names in an import item; it is not a cast operator and remains a
valid identifier elsewhere. The former range words `until`, `to`, `downto`, and `step` are ordinary
identifiers with no contextual role.

### 9.4 Reserved Built-in Names (29 total)

```ebnf
reserved_builtin = "peek" | "poke" | "peekw" | "pokew"
                 | "lo" | "hi" | "sizeof" | "offsetof" | "length"
                 | "embed" | "bcd_add" | "bcd_sub"
                 | "petscii" | "screen_codes" | "atascii" | "internal_codes"
                 | "asm_sei" | "asm_cli" | "asm_pha" | "asm_pla"
                 | "asm_php" | "asm_plp" | "asm_clc" | "asm_sec"
                 | "asm_cld" | "asm_sed" | "asm_clv"
                 | "asm_nop" | "asm_brk" ;
```

### 9.5 Numeric Literals

```ebnf
number_literal  = decimal_literal | hex_literal | bin_literal ;

decimal_literal = digit , { [ "_" ] , digit } ;

hex_digit       = "0"…"9" | "A"…"F" | "a"…"f" ;
hex_literal     = ( "$" | "0x" | "0X" ) , hex_digit , { [ "_" ] , hex_digit } ;

bin_digit       = "0" | "1" ;
bin_literal     = ( "0b" | "0B" ) , bin_digit , { [ "_" ] , bin_digit } ;
```

### 9.6 String and Character Literals

```ebnf
string_literal  = '"' , { string_char } , '"' ;
char_literal    = "'" , char_char , "'" ;

string_char     = escape_seq | ? any Unicode scalar value except U+0022, U+005C, U+000D, or U+000A ? ;
char_char       = escape_seq | ? any single Unicode scalar value except U+0027, U+005C, U+000D, or U+000A ? ;
escape_seq      = ? U+005C REVERSE SOLIDUS ?
                , ( "n" | "r" | "t" | "0" | ? U+005C REVERSE SOLIDUS ? | '"' | "'"
                          | "x" , hex_digit , hex_digit ) ;
```

Double quotes always delimit strings, including the valid empty string `""`. Single quotes always
delimit exactly one Unicode scalar value or escape sequence and produce one encoded byte. Quote kind, not
content length, distinguishes the tokens.

### 9.7 Comments

```ebnf
line_comment    = "//" , { ? any byte except LF ? }
                , ( ? LF byte ? | ? end of file ? ) ;
block_comment   = "/*" , { ? any character except the byte pair "*/" ? } , "*/" ;
```

Block comments do **not** nest. The first `*/` terminates the comment.

### 9.8 Operators and Punctuation

```
(* Single-character tokens *)
+ - * / % & | ^ ~ ! < > = . , : ; ? ( ) [ ] { }

(* Multi-character tokens *)
== != <= >= << >> && || += -= *= /= %= &= |= ^= <<= >>=

(* Special prefix *)
$ 0x 0X 0b 0B
```

---

## 10. Production Index

All grammar productions listed alphabetically for quick reference:

| Production | Section | Description |
|-----------|---------|-------------|
| `additive_expr` | §6.2 | `+`, `-` binary |
| `arg_list` | §6.4 | Function-call arguments |
| `array_element_type` | §4 | Non-void array element type |
| `array_init_content` | §6.7 | Values and optional fill element |
| `array_literal` | §6.7 | `[]`, `[1, 2]`, or `[1; 0]` |
| `array_type` | §4 | Sized or unsized array type |
| `assign_op` | §6.2 | Simple and compound assignment operators |
| `assignment_expr` | §6.2 | Lowest-precedence, right-associative assignment |
| `bin_digit` | §9.5 | `0` or `1` |
| `bin_literal` | §9.5 | `0b11110000` |
| `bitwise_and_expr` | §6.2 | `&` binary |
| `bitwise_or_expr` | §6.2 | `\|` binary |
| `bitwise_xor_expr` | §6.2 | `^` binary |
| `block` | §5.4 | `{ ... }` statement block |
| `block_comment` | §9.7 | `/* ... */` |
| `break_stmt` | §5.10 | `break;` |
| `case_body` | §5.9 | Statements inside a case |
| `case_clause` | §5.9 | `case V:` |
| `case_value_list` | §5.9 | Comma-separated case values |
| `char_char` | §9.6 | Character-literal content |
| `char_literal` | §9.6 | `'x'` |
| `query_intrinsic` | §7.3 | `sizeof`, `offsetof`, `length` |
| `conditional_expr` | §6.2 | Right-associative `? :` expression |
| `const_decl` | §3.1 | Top-level `const` declaration |
| `const_decl_local` | §5.2 | Local `const` declaration |
| `const_expression` | §6.8 | Compile-time evaluable expression context |
| `contextual_keyword` | §9.3 | Import-alias `as` |
| `continue_stmt` | §5.10 | `continue;` |
| `cpu_intrinsic` | §7.1 | CPU-control intrinsic call |
| `cpu_intrinsic_name` | §7.1 | Names of CPU-control intrinsics |
| `decimal_literal` | §9.5 | `255`, `1_000` |
| `default_clause` | §5.9 | `default:` |
| `digit` | §9.1 | `0`…`9` |
| `do_while_stmt` | §5.7 | `do { } while (...);` |
| `embed_expr` | §8 | Raw embed or one literal handler-owned selector key |
| `enum_decl` | §3.4 | Enum declaration |
| `enum_member` | §3.4 | Enum member and optional value |
| `equality_expr` | §6.2 | `==`, `!=` |
| `escape_seq` | §9.6 | Closed literal escape sequence |
| `expression` | §6.2 | Entry point for expressions |
| `expression_list` | §5.8 | Left-to-right initializer/update expressions in a for header |
| `expression_stmt` | §5.3 | Any expression followed by `;` |
| `field_init` | §6.6 | Struct field initializer |
| `for_initializer` | §5.8 | Declaration or expression-list initializer of a for loop |
| `for_local_decl` | §5.8 | Local declaration without its own trailing semicolon in a for header |
| `for_stmt` | §5.8 | Three-clause C/JavaScript-style loop |
| `for_update` | §5.8 | Expression-list update of a for loop |
| `function_decl` | §3.2 | Function with mandatory return annotation |
| `hex_digit` | §9.5 | `0`…`F` |
| `hex_literal` | §9.5 | `$FF`, `0xFF` |
| `identifier` | §9.1 | User-defined name |
| `if_stmt` | §5.5 | Braced `if`/`else` |
| `import_item` | §2.3 | Imported name and optional alias |
| `import_list` | §2.3 | Comma-separated import items |
| `import_stmt` | §2.3 | Module import |
| `integer_type` | §4 | Four integer primitive types |
| `interrupt_decl` | §3.2 | `interrupt function name(): void` |
| `intrinsic_call` | §7 | Any reserved language intrinsic call |
| `keyword` | §9.2 | Reserved language word |
| `let_decl` | §3.1 | Top-level mutable declaration |
| `letter` | §9.1 | ASCII letter |
| `line_comment` | §9.7 | `// ...` |
| `logical_and_expr` | §6.2 | `&&` |
| `logical_or_expr` | §6.2 | `\|\|` |
| `memory_intrinsic` | §7.2 | `peek`, `poke`, and related calls |
| `module_decl` | §2.2 | Required first module declaration |
| `multiplicative_expr` | §6.2 | `*`, `/`, `%` |
| `number_literal` | §9.5 | Decimal, hexadecimal, or binary literal |
| `param` | §3.2 | `name: [const] type` |
| `param_list` | §3.2 | Comma-separated parameters |
| `postfix_expr` | §6.4 | Primary plus calls, indices, or members |
| `postfix_op` | §6.4 | Call, index, or member suffix |
| `primary_expr` | §6.5 | Literals, names, aggregates, intrinsics, grouping |
| `primitive_cast` | §6.5 | `byte(expr)` and other integer casts |
| `program` | §2.1 | One source compilation unit |
| `qualified_name` | §2.3 | Dot-separated module identity |
| `relational_expr` | §6.2 | `<`, `<=`, `>`, `>=` |
| `reserved_builtin` | §9.4 | 29 reserved built-in identifiers; `main` is separately entry-reserved |
| `return_stmt` | §5.10 | `return [expression];` |
| `return_type` | §3.2 | Any parsed value type; semantic rules reject struct and array returns |
| `shift_expr` | §6.2 | `<<`, `>>` |
| `statement` | §5.1 | Any statement |
| `string_char` | §9.6 | String-literal content |
| `string_literal` | §9.6 | Double-quoted byte sequence |
| `struct_decl` | §3.3 | Struct declaration |
| `struct_field` | §3.3 | Struct field declaration |
| `struct_literal` | §6.6 | Context-typed `{ field: value }` |
| `switch_stmt` | §5.9 | Switch statement |
| `top_level_item` | §2.1 | Any declaration after the module header |
| `type` | §4 | Value type or `void` |
| `unary_expr` | §6.3 | Prefix or postfix-based expression |
| `value_type` | §4 | Any non-void type |
| `var_decl_local` | §5.2 | Local mutable declaration |
| `while_stmt` | §5.6 | Braced `while` loop |
| `zeropage_block` | §3.1 | Module-level zero-page declarations |
| `zeropage_var` | §3.1 | Mutable zero-page declaration |

**Total productions: 96**

---

## 11. Parser Architecture Notes

### 11.1 Parsing Strategy

The grammar is designed for a **recursive-descent parser** with **Pratt parsing** for
expressions:

- **Top-level and statements**: Standard recursive descent. Each statement type has a
  unique leading token (`let`, `const`, `if`, `while`, `do`, `for`, `switch`, `return`,
  `break`, `continue`, `{`); other statement starts are parsed as expressions.
- **Expressions**: Pratt parser using the 14-level precedence table from Ch 04, §2. The
  `expression` production in §6.2 is the EBNF representation of the precedence hierarchy;
  an implementation uses `parse_expr(min_precedence)` with a lookup table for binding powers.
- **No backtracking required**: All parse decisions can be made from the syntactic position and
  bounded lookahead. Pratt parsing handles assignment as part of the expression. Semantic name
  resolution distinguishes an identifier call from an enum cast.

### 11.2 Disambiguation Points

| Ambiguity | Resolution |
|-----------|-----------|
| `if ... else if` vs `if ... else { if }` | Parsed as `else if_stmt` (first alternative in §5.5); semantically identical to nested if inside else block |
| `&` address-of vs `&` bitwise AND | Position: unary prefix = address-of; binary infix = bitwise AND |
| `{` struct literal vs block | Syntactic position: expression position = context-typed struct literal; statement position = block |
| String vs character literal | Quote kind: double quotes = string (including empty); single quotes = exactly one character |
| `as` import alias vs identifier | Context: recognized only between imported and local names; there is no `as` cast |
| `Type(expr)` cast vs function call | Primitive type keywords are syntactic casts; identifier calls are classified as enum casts or function calls by semantic name resolution |

### 11.3 Lookahead Requirements

| Context | Lookahead | Tokens |
|---------|-----------|--------|
| Statement selection | LL(1) | Leading keyword or `{` |
| Assignment | Pratt | Lowest binding power, right-associative; semantic pass validates assignable target |
| Struct literal | LL(1) by context | `{` in expression position |
| Export + declaration | LL(2) | `export` followed by `function`/`let`/`const`/`struct`/`enum`/`interrupt` |
| For-loop header | LL(1) | `let`/`const` select a declaration initializer; semicolons delimit condition and update |

### 11.4 No Context-Sensitive Parsing

The lexer produces tokens without consulting the symbol table. All tokenization decisions
are made with fixed rules:

- `$` followed by hex digit → hex literal
- `0x`/`0b` → hex/binary literal prefix
- Keywords are recognized by string matching against the keyword table
- Import-alias `as` is tokenized as an identifier; the parser recognizes it only in its grammatical
  context

---

## 12. Gate G4 Certification

| Criterion | Status |
|---|---|
| Every language construct has a production | ✅ 96 productions covering all Ch 01–13 constructs |
| Provably LL(k) / recursive-descent + Pratt | ✅ Bounded lookahead plus Pratt expressions; no backtracking |
| Dangling-else resolved | ✅ Mandatory braces (CF-1) — no bare statements after `if`/`while`/`for` |
| No tokenization ambiguities | ✅ `&` and import `as` are disambiguated by position/context; quote kind distinguishes strings and characters |

**Gate G4: PASSED**
