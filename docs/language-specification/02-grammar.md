# Grammar Overview

> **Status**: Lexer-Derived Specification
> **Last Updated**: January 25, 2026
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
- **Keywords**: `"module"`, `"function"`, `"if"`, `"let"`, `"switch"`, `"do"`
- **Operators**: `"+"`, `"=="`, `"&&"`, `"?"`
- **Punctuation**: `"("`, `")"`, `"{"`, `"}"`, `";"`, `":"`

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
               | variable_decl
               | statement ;
```

See [Program Structure](03-program-structure.md) for ordering rules and semantics.

## Expressions

Expressions are the core of computation. The grammar follows standard precedence levels:

```ebnf
expression = assignment_expr ;

assignment_expr = conditional_expr
                , [ assignment_op , assignment_expr ] ;

(* Ternary conditional expression *)
conditional_expr = logical_or_expr
                 , [ "?" , expression , ":" , conditional_expr ] ;

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
             | array_literal
             | "(" , expression , ")" ;

argument_list = expression , { "," , expression } ;

array_literal = "[" , [ expression_list ] , "]" ;
expression_list = expression , { "," , expression } , [ "," ] ;
```

See [Expressions & Statements](06-expressions-statements.md) for detailed semantics.

## Statements

Statements are the building blocks of functions and control flow:

```ebnf
statement = variable_decl
          | assignment_stmt
          | return_stmt
          | if_stmt
          | while_stmt
          | do_while_stmt
          | for_stmt
          | switch_stmt
          | break_stmt
          | continue_stmt
          | expr_stmt ;
```

**Key Rule**: All single-line statements require semicolons. Block-structured statements (if, while, for, switch, function) use curly braces `{ }` and do not require trailing semicolons.

## Declarations

Declarations introduce new names into the program:

```ebnf
(* Variables *)
variable_decl = [ storage_class ] , ( "let" | "const" ) , identifier
              , [ ":" , type_expr ]
              , [ "=" , expression ] , ";" ;

storage_class = "@zp" | "@ram" | "@data" ;

(* Functions *)
function_decl = [ "export" ] , [ "callback" ]
              , "function" , identifier
              , "(" , [ parameter_list ] , ")"
              , [ ":" , type_name ]
              , ( function_body | ";" ) ;

function_body = "{" , { statement } , "}" ;

parameter_list = parameter , { "," , parameter } ;
parameter      = identifier , ":" , type_expr ;

(* Types *)
type_decl = "type" , identifier , "=" , type_expr , ";" ;

(* Enums *)
enum_decl = "enum" , identifier , "{"
          , [ enum_member_list ]
          , "}" ;

enum_member_list = enum_member , { "," , enum_member } , [ "," ] ;
enum_member = identifier , [ "=" , integer ] ;
```

See [Variables](10-variables.md), [Functions](11-functions.md), and [Type System](05-type-system.md) for details.

## Module System

```ebnf
(* Module declaration *)
module_decl = "module" , name , ";" ;

(* Import declaration *)
import_decl = "import" , "{" , import_list , "}" , "from" , name , ";" ;
import_list = identifier , { "," , identifier } ;

(* Export declaration - inline with declarations *)
export_decl = "export" , ( function_decl | variable_decl | type_decl | enum_decl ) ;
```

See [Module System](04-module-system.md) for semantics.

## Control Flow

```ebnf
(* If statement - C-style with curly braces *)
if_stmt = "if" , "(" , expression , ")" , "{"
        , { statement }
        , "}"
        , [ else_clause ] ;

else_clause = "else" , ( if_stmt | "{" , { statement } , "}" ) ;

(* While loop - C-style *)
while_stmt = "while" , "(" , expression , ")" , "{"
           , { statement }
           , "}" ;

(* Do-while loop - C-style (body executes at least once) *)
do_while_stmt = "do" , "{"
              , { statement }
              , "}" , "while" , "(" , expression , ")" , ";" ;

(* For loop - with to/downto and optional step *)
for_stmt = "for" , "(" , [ "let" , identifier , [ ":" , type_expr ] , "=" ]
         , identifier , "=" , expression
         , ( "to" | "downto" ) , expression
         , [ "step" , expression ]
         , ")" , "{"
         , { statement }
         , "}" ;

(* Switch statement - C-style pattern matching *)
switch_stmt = "switch" , "(" , expression , ")" , "{"
            , { case_clause }
            , [ default_clause ]
            , "}" ;

case_clause = "case" , expression , ":"
            , { statement } ;

default_clause = "default" , ":"
               , { statement } ;

(* Break/Continue *)
break_stmt    = "break" , ";" ;
continue_stmt = "continue" , ";" ;

(* Return *)
return_stmt = "return" , [ expression ] , ";" ;
```

See [Expressions & Statements](06-expressions-statements.md) for control flow semantics.

## Memory-Mapped Declarations

```ebnf
map_decl = simple_map_decl
         | range_map_decl
         | type_map_decl
         | layout_map_decl ;

(* Form 1: Simple single-address mapping *)
simple_map_decl = "@map" , identifier , "at" , address , ":" , type_name , ";" ;

(* Form 2: Range mapping for arrays *)
range_map_decl = "@map" , identifier , "from" , address , "to" , address , ":" , type_name , ";" ;

(* Form 3: Type-based struct mapping *)
type_map_decl = "@map" , identifier , "at" , address , "type" , identifier , "{"
              , { field_decl }
              , "}" ;

(* Form 4: Explicit layout struct mapping *)
layout_map_decl = "@map" , identifier , "at" , address , "layout" , "{"
                , { explicit_field_decl }
                , "}" ;

field_decl = identifier , ":" , type_expr , ";" ;
explicit_field_decl = identifier , ":" , "at" , offset , ":" , type_expr , ";" ;

address = hex_literal | decimal_literal ;
offset = hex_literal | decimal_literal ;
```

See [Memory-Mapped](12-memory-mapped.md) for complete details on all four forms.

## Operator Precedence

From highest to lowest precedence:

| Level | Operators | Associativity | Description |
|-------|-----------|---------------|-------------|
| 1 | `()` `[]` `.` | Left-to-right | Grouping, indexing, member access |
| 2 | `!` `~` unary `+` unary `-` `@` | Right-to-left | Unary operators |
| 3 | `*` `/` `%` | Left-to-right | Multiplicative |
| 4 | `+` `-` | Left-to-right | Additive |
| 5 | `<<` `>>` | Left-to-right | Shift |
| 6 | `<` `<=` `>` `>=` | Left-to-right | Relational |
| 7 | `==` `!=` | Left-to-right | Equality |
| 8 | `&` | Left-to-right | Bitwise AND |
| 9 | `^` | Left-to-right | Bitwise XOR |
| 10 | `\|` | Left-to-right | Bitwise OR |
| 11 | `&&` | Left-to-right | Logical AND |
| 12 | `\|\|` | Left-to-right | Logical OR |
| 13 | `?:` | Right-to-left | Ternary conditional |
| 14 | `=` `+=` `-=` `*=` `/=` `%=` `&=` `\|=` `^=` `<<=` `>>=` | Right-to-left | Assignment |

## Grammar Conventions

### Whitespace

The grammar does not explicitly show whitespace. All whitespace between tokens is skipped by the lexer.

### Newlines

The lexer treats newlines as whitespace. They are optional between tokens.

### Semicolons

Semicolons are **required** for:
- Variable declarations: `let x: byte = 5;`
- Assignments: `x = 10;`
- Expression statements: `clearScreen();`
- Return: `return value;`
- Break/Continue: `break;` / `continue;`
- Module declaration: `module MyGame;`
- Import declaration: `import { A } from B;`
- Do-while termination: `do { } while (cond);`

Semicolons are **not required** after:
- If statements: `if (x) { }`
- While loops: `while (x) { }`
- For loops: `for (i = 0 to 10) { }`
- Switch statements: `switch (x) { }`
- Function declarations: `function foo() { }`
- Enum declarations: `enum State { }`

## Ambiguity Resolution

The grammar is designed to be unambiguous:

1. **Operator precedence** resolves expression ambiguity
2. **Curly braces** `{ }` clearly delimit blocks
3. **Semicolons** resolve statement boundaries
4. **Type annotations** (`:`) distinguish declarations from assignments
5. **Ternary operator** uses `?` and `:` which don't conflict with other uses

## Quick Syntax Reference

### Control Flow Comparison (C-style)

```js
// If statement
if (condition) {
    doSomething();
} else if (otherCondition) {
    doOther();
} else {
    doDefault();
}

// While loop
while (running) {
    update();
}

// Do-while loop (body executes at least once)
do {
    process();
} while (hasMore);

// For loop (counting up)
for (i = 0 to 10) {
    buffer[i] = 0;
}

// For loop (counting down)
for (i = 10 downto 0) {
    countdown(i);
}

// For loop (with step)
for (i = 0 to 100 step 5) {
    processEveryFifth(i);
}

// Switch statement
switch (state) {
    case State.MENU:
        showMenu();
    case State.PLAYING:
        playGame();
    default:
        reset();
}
```

### Declarations (C-style)

```js
// Module
module MyGame.Engine;

// Import
import { Player, Enemy } from Game.Entities;

// Function
function updateGame(): void {
    // function body
}

// Stub function (declaration only)
function externalCall(): void;

// Enum
enum GameState {
    MENU,
    PLAYING,
    PAUSED,
    GAME_OVER
}

// Memory-mapped with layout
@map vic at $D000 layout {
    spriteX: at $00: byte[8];
    borderColor: at $20: byte;
}
```

### Expressions (with ternary)

```js
// Ternary conditional
let max = (a > b) ? a : b;

// Nested ternary
let grade = (score > 90) ? "A" : (score > 80) ? "B" : "C";
```

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