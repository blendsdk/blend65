# Grammar Overview

> **Status**: Lexer-Derived Specification
> **Last Updated**: January 8, 2026
> **Related Documents**: [Lexical Structure](01-lexical-structure.md), [Program Structure](03-program-structure.md)

## Introduction

This document provides a **token-level** grammar sketch derived from tokens the lexer emits. It uses Extended Backus-Naur Form (EBNF) notation to express the expected surface syntax.

This grammar is intentionally conservative: it only references symbols visible in the lexer and proven by tests.

## EBNF Notation

Blend65 specification uses standard EBNF meta-notation:

| Symbol | Meaning | Example |
|--------|---------|---------|
| `=` | Definition | `rule = expression ;` |
| `;` | Rule terminator | `identifier = alpha , { alnum } ;` |
| `\|` | Alternation (OR) | `"let" \| "const"` |
| `,` | Sequence (AND) | `"let" , identifier` |
| `{ X }` | Zero or more repetitions | `{ statement }` |
| `[ X ]` | Optional (zero or one) | `[ "export" ]` |
| `( X )` | Grouping | `( "+" \| "-" )` |
| `"..."` | Terminal symbol (literal) | `"function"` |
| `? ... ?` | Special sequence (prose) | `? any character ?` |

## Terminals vs Non-Terminals

### Terminals

Terminals are literal tokens produced by the lexer, shown as:
- **Keywords**: `"module"`, `"function"`, `"if"`, `"let"`
- **Operators**: `"+"`, `"=="`, `"&&"`
- **Punctuation**: `"("`, `")"`, `";"`, `":"`

### Non-Terminals

Non-terminals are grammar rules that expand into terminals and other non-terminals:
- `identifier` - An identifier token
- `expression` - An expression construct
- `statement` - A statement construct
- `type_name` - A type name

## Common Building Blocks

These fundamental rules are used throughout the grammar:

```ebnf
(* End of input *)
EOF = ? end of input ? ;

(* Identifiers and qualified names *)
identifier = ? IDENTIFIER token ? ;
name = identifier , { "." , identifier } ;

(* Type references *)
type_name = "byte" | "word" | "@address" | "void" | "string" | "boolean" | "callback" | identifier ;

type_expr = type_name
          | type_name , "[" , integer , "]" ;

(* Literals *)
integer = ? NUMBER token ? ;
literal = integer | string_literal | boolean_literal ;

string_literal = ? STRING token ? ;
boolean_literal = "true" | "false" ;
```

## Grammar Structure

The Blend65 grammar is hierarchical:

```
Program
  ├─ Module Declaration
  ├─ Import Declarations
  ├─ Export Declarations
  ├─ Type Declarations
  ├─ Variable Declarations
  ├─ Function Declarations
  └─ Statements
```

### Top-Level Structure

```ebnf
program = { top_level_item } , EOF ;

top_level_item = module_decl
               | import_decl
               | export_decl
               | function_decl
               | type_decl
               | enum_decl
               | map_decl
               | variable_decl , ";"
               | statement , ";" ;
```

See [Program Structure](03-program-structure.md) for ordering rules and semantics.

## Expressions

Expressions are the core of computation. The grammar follows standard precedence levels:

```ebnf
expression = assignment_expr ;

assignment_expr = logical_or_expr
                , [ assignment_op , assignment_expr ] ;

logical_or_expr  = logical_and_expr , { "||" , logical_and_expr } ;
logical_and_expr = bitwise_or_expr  , { "&&" , bitwise_or_expr  } ;

bitwise_or_expr  = bitwise_xor_expr , { "|"  , bitwise_xor_expr } ;
bitwise_xor_expr = bitwise_and_expr , { "^"  , bitwise_and_expr } ;
bitwise_and_expr = equality_expr    , { "&"  , equality_expr    } ;

equality_expr    = relational_expr , { ( "==" | "!=" ) , relational_expr } ;
relational_expr  = shift_expr , { ( "<" | "<=" | ">" | ">=" ) , shift_expr } ;
shift_expr       = additive_expr , { ( "<<" | ">>" ) , additive_expr } ;

additive_expr         = multiplicative_expr , { ( "+" | "-" ) , multiplicative_expr } ;
multiplicative_expr   = unary_expr , { ( "*" | "/" | "%" ) , unary_expr } ;

unary_expr = [ unary_op ] , unary_expr
           | postfix_expr ;

unary_op = "!" | "~" | "+" | "-" | "@" ;

postfix_expr = primary_expr , { postfix_suffix } ;

postfix_suffix = call_suffix
               | index_suffix
               | member_suffix ;

call_suffix   = "(" , [ argument_list ] , ")" ;
index_suffix  = "[" , expression , "]" ;
member_suffix = "." , identifier ;

primary_expr = literal
             | identifier
             | "(" , expression , ")" ;

argument_list = expression , { "," , expression } ;
```

See [Expressions & Statements](06-expressions-statements.md) for detailed semantics.

## Statements

Statements are the building blocks of functions and control flow:

```ebnf
statement = variable_decl , ";"
          | assignment_stmt , ";"
          | return_stmt , ";"
          | if_stmt
          | while_stmt
          | for_stmt
          | match_stmt
          | break_stmt , ";"
          | continue_stmt , ";"
          | expr_stmt , ";" ;
```

**Key Rule**: Statements that are not self-terminating (single-line statements) require semicolons. Block-structured statements (if, while, for, match, function) use `end` terminators and do not require semicolons.

## Declarations

Declarations introduce new names into the program:

```ebnf
(* Variables *)
variable_decl = [ storage_class ] , ( "let" | "const" ) , identifier
              , [ ":" , type_expr ]
              , [ "=" , expression ] ;

storage_class = "@zp" | "@ram" | "@data" ;

(* Functions *)
function_decl = [ "export" ] , [ "callback" ]
              , "function" , identifier
              , "(" , [ parameter_list ] , ")"
              , [ ":" , type_name ]
              , { NEWLINE }
              , { statement , { NEWLINE } }
              , "end" , "function" ;

parameter_list = parameter , { "," , parameter } ;
parameter      = identifier , ":" , type_expr ;

(* Types *)
type_decl = "type" , identifier , "=" , type_expr ;

(* Enums *)
enum_decl = "enum" , identifier , { NEWLINE }
          , { enum_member , [ "," ] , { NEWLINE } }
          , "end" , "enum" ;

enum_member = identifier , [ "=" , integer ] ;
```

See [Variables](10-variables.md), [Functions](11-functions.md), and [Type System](05-type-system.md) for details.

## Module System

```ebnf
(* Module declaration *)
module_decl = "module" , name ;

(* Import declaration *)
import_decl = "import" , import_list , "from" , name ;
import_list = identifier , { "," , identifier } ;

(* Export declaration *)
export_decl = "export" , ( function_decl | variable_decl | type_decl | enum_decl ) ;
```

See [Module System](04-module-system.md) for semantics.

## Control Flow

```ebnf
(* If statement *)
if_stmt = "if" , expression , "then"
        , { statement }
        , [ "else" , { statement } ]
        , "end" , "if" ;

(* While loop *)
while_stmt = "while" , expression
           , { statement }
           , "end" , "while" ;

(* For loop *)
for_stmt = "for" , identifier , "=" , expression , "to" , expression
         , { statement }
         , "next" , identifier ;

(* Match statement *)
match_stmt = "match" , expression
           , { case_clause }
           , [ default_clause ]
           , "end" , "match" ;

case_clause = "case" , expression , ":"
            , { statement } ;

default_clause = "default" , ":"
               , { statement } ;

(* Break/Continue *)
break_stmt    = "break" ;
continue_stmt = "continue" ;

(* Return *)
return_stmt = "return" , [ expression ] ;
```

See [Expressions & Statements](06-expressions-statements.md) for control flow semantics.

## Memory-Mapped Declarations

```ebnf
map_decl = simple_map_decl
         | range_map_decl
         | sequential_struct_map_decl
         | explicit_struct_map_decl ;

simple_map_decl = "@map" , identifier , "at" , address , ":" , type_name , ";" ;

range_map_decl = "@map" , identifier , "from" , address , "to" , address , ":" , type_name , ";" ;

sequential_struct_map_decl = "@map" , identifier , "at" , address , "type"
                           , { NEWLINE }
                           , field_list
                           , "end" , "@map" ;

explicit_struct_map_decl = "@map" , identifier , "at" , address , "layout"
                         , { NEWLINE }
                         , explicit_field_list
                         , "end" , "@map" ;

address = hex_literal | decimal_literal ;
```

See [Memory-Mapped](12-memory-mapped.md) for complete details on all four forms.

## Operator Precedence

From highest to lowest precedence:

| Level | Operators | Associativity |
|-------|-----------|---------------|
| 1 | `()` `[]` `.` | Left-to-right |
| 2 | `!` `~` unary `+` unary `-` | Right-to-left |
| 3 | `*` `/` `%` | Left-to-right |
| 4 | `+` `-` | Left-to-right |
| 5 | `<<` `>>` | Left-to-right |
| 6 | `<` `<=` `>` `>=` | Left-to-right |
| 7 | `==` `!=` | Left-to-right |
| 8 | `&` | Left-to-right |
| 9 | `^` | Left-to-right |
| 10 | `\|` | Left-to-right |
| 11 | `&&` | Left-to-right |
| 12 | `\|\|` | Left-to-right |
| 13 | `=` `+=` `-=` `*=` `/=` `%=` `&=` `\|=` `^=` `<<=` `>>=` | Right-to-left |

## Grammar Conventions

### Whitespace

The grammar does not explicitly show whitespace. All whitespace between tokens is skipped by the lexer.

### Newlines

The lexer treats newlines as whitespace. The grammar shows `{ NEWLINE }` in places where newlines are commonly used for readability, but they are optional.

### Semicolons

Semicolons are **required** for statement termination, except for:
- Block-structured statements (if, while, for, match)
- Declarations (module, function, type, enum)

## Ambiguity Resolution

The grammar is designed to be unambiguous:

1. **Operator precedence** resolves expression ambiguity
2. **Explicit end markers** (`end if`, `end function`) resolve block nesting
3. **Semicolons** resolve statement boundaries
4. **Type annotations** (`:`) distinguish declarations from assignments

## Implementation Notes

The parser implementation may use different techniques than suggested by the grammar:

- **Recursive descent** for most constructs
- **Pratt parsing** for expressions (precedence climbing)
- **Look-ahead** for disambiguation

See `packages/compiler/src/parser/` for implementation details.

## Grammar Completeness

This grammar covers all constructs currently tokenizable by the lexer. If a construct is not listed here, it is either:

1. Not yet implemented in the lexer
2. Planned for future versions
3. Not part of the language design

See [Overview](00-overview.md) for specification status.
