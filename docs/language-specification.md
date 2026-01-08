# Blend65 Language Specification (Lexer-Derived)

> **Status**: This document is derived _strictly_ from the current lexer implementation and its tests.
> It describes what the language frontend can **tokenize** today, and uses EBNF to express the
> expected surface syntax. Some higher-level semantics (type checking rules, code generation rules)
> may evolve as the compiler backend is implemented.

## Table of Contents

1. [Introduction](#introduction)
2. [Lexical Structure](#lexical-structure)
3. [Grammar Overview](#grammar-overview)
4. [Program Structure](#program-structure)
5. [Top-Level Ordering Rules](#top-level-ordering-rules)
6. [Module System](#module-system)
7. [Type System](#type-system)
8. [Storage Classes](#storage-classes)
9. [Variable Declarations](#variable-declarations)
10. [Function Declarations](#function-declarations)
11. [Expressions](#expressions)
12. [Statements](#statements)
13. [Control Flow](#control-flow)
14. [Import/Export System](#importexport-system)
15. [Comments](#comments)
16. [Examples](#examples)
17. [Error Handling](#error-handling)
18. [6502 Specific Features](#6502-specific-features)

---

## Introduction

Blend65 is a modern language designed to compile to 6502-family systems (C64, VIC-20, Commander X16, and more).
It aims to provide structured programming, modularity, and a practical type system while still enabling
fine-grained memory placement and low-level control.

This specification is **lexer-derived**. That means:

- If a construct is not tokenizable by the lexer, it is not specified here.
- Some constructs are shown as “expected syntax” (EBNF) based on token streams and tests.

The lexer is implemented in:

- `packages/compiler/src/lexer/lexer.ts`
- `packages/compiler/src/lexer/types.ts`
- tests under `packages/compiler/src/__tests__/lexer/`

---

## Lexical Structure

### Character Set

The lexer operates over Unicode strings, but the language tokenization rules assume ASCII-like syntax:

- Identifiers use letters `A-Z`, `a-z`, digits `0-9`, and underscore `_`.
- Keywords are **case-sensitive** (`break` is a keyword; `Break` is an identifier).

### Whitespace and Newlines

Whitespace characters (all treated as insignificant):

- Space (`' '`)
- Tab (`'\t'`)
- Carriage return (`'\r'`)
- Newline (`'\n'`)

All whitespace is skipped by the lexer and treated as trivial.

**Statement Separation**: Blend65 uses **semicolons (`;`)** as statement separators, not newlines.
This allows expressions and statements to span multiple lines naturally.

EBNF (lexical):

```ebnf
whitespace     = " " | "\t" | "\r" | "\n" ;
separator      = ";" ;
```

> Note: The lexer treats all whitespace uniformly. Semicolons are emitted as `SEMICOLON` tokens and are required for statement termination.

### Tokens

The lexer produces the following token categories:

- Identifiers and keywords
- Numeric literals (decimal, hex, binary)
- String literals (single or double quoted)
- Boolean literals (`true`, `false`)
- Operators (arithmetic, comparison, logical, bitwise, assignment)
- Punctuation (`()[]{},;:.`)
- Comments (`//` line, `/* ... */` block) — by default skipped
- `NEWLINE` and `EOF`

### Identifiers

Identifiers start with a letter or underscore, and continue with letters, digits, or underscore.

EBNF:

```ebnf
alpha          = "A"…"Z" | "a"…"z" | "_" ;
digit          = "0"…"9" ;
alnum          = alpha | digit ;

identifier     = alpha , { alnum } ;
```

Examples:

<!-- prettier-ignore -->
```js
let snakeX: byte
let _tmp123: word
```

### Keywords (Case-Sensitive)

The lexer recognizes a fixed set of keywords (from `KEYWORDS` in `types.ts`).

#### Module system keywords

- `module`
- `import`
- `export`
- `from`

#### Function keywords

- `function`
- `return`

#### Control flow keywords

- `if` `then` `else`
- `while`
- `for` `to` `next`
- `match` `case` `default`
- `break` `continue`
- `end` (used to terminate blocks like `end if`, `end function`, `end while`, `end match`, `end enum`)

#### Type/declaration keywords

- `type`
- `enum`

#### Mutability modifiers

- `let`
- `const`

#### Storage class keywords (prefixed)

- `@zp`
- `@ram`
- `@data`

#### Primitive type keywords

- `byte`
- `word`
- `void`
- `callback`
- `string`
- `boolean`

EBNF (keyword terminal names are shown as literal strings):

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
        | "@zp" | "@ram" | "@data"
        | "byte" | "word" | "void" | "callback" | "string" | "boolean" ;
```

### Boolean literals

The lexer treats `true` and `false` as boolean literals.

EBNF:

```ebnf
boolean_literal = "true" | "false" ;
```

<!-- prettier-ignore -->
```js
let running: boolean = true
```

### Numeric literals

The lexer supports:

- Decimal: `0`, `123`, `65536`
- Hexadecimal:
  - `$` prefix: `$FF`, `$D000`, `$0000`
  - `0x` prefix: `0xFF`, `0xD000`
- Binary: `0b1010`, `0b0001`

EBNF:

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

Examples:

<!-- prettier-ignore -->
```js
let addr: word = $D000
let mask: byte = 0b11110000
let score: word = 65535
```

### String literals

Strings can be quoted using single quotes (`'...'`) or double quotes (`"..."`).

Escape handling (lexer behavior):

- `\n` → newline
- `\t` → tab
- `\r` → carriage return
- `\\` → backslash
- `\"` → double quote
- `\'` → single quote
- Any other escape `\X` is tokenized by including `X` as-is (no error).

> Important: Newlines **inside** string literals are permitted by the lexer; it updates its internal line/column tracking.

EBNF (simplified, because EBNF is not ideal for expressing escape-processing logic):

```ebnf
string_literal = "\"" , { string_char } , "\""
              | "'"  , { string_char } , "'" ;

string_char = ? any char except unescaped matching quote ?
            | "\\" , ? escape char ? ;
```

Examples:

<!-- prettier-ignore -->
```js
let title: string = "Hello, World!"
let path: string = 'C:\\GAMES\\SNAKE'
let multiline: string = "line1\nline2\n"
```

### Comments

Two comment styles exist:

- Line comments: `//` to end of line
- Block comments: `/* ... */` (not nested)

By default, the lexer **skips** comments and does not emit tokens for them. When configured
with `skipComments: false`, it emits `LINE_COMMENT` or `BLOCK_COMMENT` tokens.

EBNF:

```ebnf
line_comment  = "//" , { ? any char except newline ? } ;
block_comment = "/*" , { ? any char ? } , "*/" ;
```

---

## Grammar Overview

This section provides a **token-level** grammar sketch, derived from tokens the lexer emits.
It is intentionally conservative: it only references symbols visible in the lexer.

### Tokens as Terminals

For grammar readability, terminals are shown as literal strings (e.g., `"module"`) or punctuation (e.g., `"("`).

EBNF meta-notation:

- `{ X }` means “zero or more”.
- `[ X ]` means “optional”.
- `|` means “alternation”.

### Common building blocks

```ebnf
EOF       = ? end of input ? ;

name      = identifier , { "." , identifier } ;

type_name = "byte" | "word" | "void" | "string" | "boolean" | "callback" | identifier ;

integer   = number_literal ;
literal   = number_literal | string_literal | boolean_literal ;
```

---

## Program Structure

At a high level, Blend65 source is a sequence of top-level declarations.

**Statements require semicolons** for termination. **Declarations are self-terminating** (no semicolon needed).

EBNF (top level):

```ebnf
program = { top_level_item } , EOF ;

top_level_item = module_decl
               | import_decl
               | export_decl
               | function_decl
               | type_decl
               | enum_decl
               | variable_decl , ";"
               | statement , ";" ;
```

> Note: The parser may enforce a stricter structure (e.g. `module` must be first), but the lexer alone does not.
>
> The mandatory parser-enforced ordering is detailed in [Top-Level Ordering Rules](#top-level-ordering-rules); consult that section whenever introducing new top-level constructs to keep the spec consistent.

---

## Top-Level Ordering Rules

Blend65 source files follow deterministic top-level ordering semantics so that downstream passes can assume a predictable module layout. The parser introduced in Phase 2 enforces these rules even though the lexer would otherwise accept more permissive token streams. These rules supersede the historical `plans/ordering.md` document, which will be removed once this specification is canonical.

### 1. Single module per file
- The first non-trivia token in a file must be `module`. Comments and blank lines may precede it, but any other construct before the module header is rejected.
- When the token stream lacks an explicit module, the parser synthesizes `module global` so the AST always has a module root.
- After an implicit module has been inserted, encountering a real `module` declaration raises `DuplicateModuleDeclaration`. The implicit module is not replaced; diagnostics instruct the author to declare the module explicitly at the top of the file.

### 2. Globals-only body
- After the module header, only global declarations are allowed: storage-class-prefixed `let`/`const` variables, function declarations (optionally `callback`), type aliases, enums, imports, and export wrappers around those declarations.
- Any other token at module scope (e.g., expression statements, stray keywords) produces an `UnexpectedTopLevelToken` diagnostic and the parser synchronizes at the next newline or declaration keyword.

### 3. Exports and entry point
- Variables and functions may be explicitly exported via the `export` keyword; future analyzer stages will also honor exported type aliases and enums.
- Exactly one exported `main` function may appear per file. If `main` is declared without `export`, the parser marks it as exported and emits an `ImplicitMainExport` warning to encourage explicit intent.
- Declaring additional exported `main` functions results in `DuplicateExportedMain` errors so that the generated assembly has a single entry point.

### 4. Constant initialization
- `const` declarations must include an initializer expression even though the surface grammar allows otherwise. Missing initializers trigger `MissingConstInitializer` so that analyzer/codegen never encounter uninitialized constants.

### 5. No executable global statements
- Executable statements (e.g., `init()`, `if` chains, assignments) are not permitted at module scope. The parser rejects them so that global code remains pure declarations and zero-overhead initialization happens via generated assembly routines instead of eager execution.

---

## Module System

> Ordering reminder: The module declaration rules in [Top-Level Ordering Rules](#top-level-ordering-rules) govern placement, implicit `module global`, and duplicate module diagnostics.

### Module declaration

Tested example:

<!-- prettier-ignore -->
```js
module Game.Main
```

EBNF:

```ebnf
module_decl = "module" , name ;
```

Where:

```ebnf
name = identifier , { "." , identifier } ;
```

### Qualified names

Blend65 uses dot-separated names for module paths and member access.

```js
module Game.Snake
import setSpritePosition from c64.sprites
```

---

## Type System

### Primitive types

Primitive type keywords tokenized by the lexer:

- `byte` (8-bit)
- `word` (16-bit)
- `void` (no value)
- `boolean`
- `string`
- `callback` (function pointer / callback marker)

EBNF:

```ebnf
primitive_type = "byte" | "word" | "void" | "boolean" | "string" | "callback" ;
```

### Type aliases

The lexer includes a `type` keyword, so the surface syntax is expected to support type aliases.

EBNF (expected):

```ebnf
type_decl = "type" , identifier , "=" , type_expr ;

type_expr = type_name
          | type_name , "[" , integer , "]" ;
```

Example (illustrative):

<!-- prettier-ignore -->
```js
type SpriteId = byte
type TileMap = byte[256]
```

> The `=` token is lexed as `ASSIGN`.

### Enums

Enum tokens are present and there are lexer tests that tokenize enum declarations.

Tested example:

<!-- prettier-ignore -->
```js
enum Direction
  UP = 0,
  DOWN = 1,
  LEFT,
  RIGHT
end enum
```

EBNF (expected):

```ebnf
enum_decl = "enum" , identifier , { NEWLINE }
          , { enum_member , [ "," ] , { NEWLINE } }
          , "end" , "enum" ;

enum_member = identifier , [ "=" , integer ] ;
```

---

## Storage Classes

Storage classes are **6502 memory placement specifiers** and are written as `@`-prefixed keywords.

Recognized tokens:

- `@zp` → `ZP`
- `@ram` → `RAM`
- `@data` → `DATA`

The lexer will throw on unknown `@` sequences:

```js
// Throws: Invalid storage class keyword '@'
@
```

EBNF:

```ebnf
storage_class = "@zp" | "@ram" | "@data" ;
```

### Default Storage Class

**When no storage class is explicitly specified, variables are allocated in `@ram` (general-purpose RAM) by default.**

These declarations are equivalent:

<!-- prettier-ignore -->
```js
@ram let counter: byte = 0;
let counter: byte = 0;  // Defaults to @ram
```

**Rationale:**
- `@zp` (zero page) is a precious 256-byte resource and should be explicitly requested
- `@data` is for pre-initialized constants and should be explicit
- `@ram` is the general-purpose choice suitable for most variables

Storage classes typically prefix variable declarations:

<!-- prettier-ignore -->
```js
// Explicit storage classes
@zp let counter: byte;          // Zero page (fast access)
@data const initialized: word = 1000;  // Initialized data section

// Default @ram (can be omitted)
let buffer: byte[256];          // Defaults to @ram
let temp: byte;                 // Defaults to @ram

// Equivalent explicit form
@ram let buffer: byte[256];     // Explicit @ram
```

---

## Memory-Mapped Variables

Memory-mapped variables (`@map`) provide **direct access to hardware registers** at fixed memory addresses without runtime overhead. This is a critical feature for 6502 development, enabling type-safe access to VIC-II, SID, CIA, and other hardware registers.

### Concept

Traditional 6502 programming uses `PEEK` and `POKE` for hardware register access:
```basic
POKE 53280, 5     REM Set border color
X = PEEK(53280)   REM Read border color
```

Blend65's `@map` feature provides a **zero-overhead, type-safe alternative**:
```js
@map vicBorderColor at $D020: byte;
vicBorderColor = 5;       // Compiles to: STA $D020
let x = vicBorderColor;   // Compiles to: LDA $D020
```

### Four Declaration Forms

Blend65 provides four forms of memory-mapped declarations to handle different hardware layout patterns:

1. **Simple** - Single register at fixed address
2. **Range** - Contiguous array of registers
3. **Sequential Struct** - Auto-laid-out fields (packed, no gaps)
4. **Explicit Struct** - Manually specified field addresses (allows gaps)

### Form 1: Simple Memory-Mapped Variable

Maps a single variable to a specific memory address.

**Syntax:**
```ebnf
simple_map_decl = "@map" , identifier , "at" , address , ":" , type_name , ";" ;
```

**Examples:**
```js
// VIC-II border color register
@map vicBorderColor at $D020: byte;

// VIC-II background color register
@map vicBackgroundColor at $D021: byte;

// IRQ vector (word = 2 bytes at $FFFE-$FFFF)
@map irqVector at $FFFE: word;

// SID volume register
@map soundVolume at $D418: byte;
```

**Usage:**
```js
// Write to hardware register
vicBorderColor = 0;           // Set border to black

// Read from hardware register
let currentColor = vicBorderColor;

// Compound assignment
vicBorderColor += 1;          // Cycle through colors
```

**Generated Assembly (example):**
```asm
; vicBorderColor = 0
LDA #$00
STA $D020         ; Direct write to register
```

---

### Form 2: Range Memory-Mapped Array

Maps a contiguous memory range to an array-like accessor.

**Syntax:**
```ebnf
range_map_decl = "@map" , identifier , "from" , address , "to" , address , ":" , type_name , ";" ;
```

**Examples:**
```js
// VIC-II sprite position registers ($D000-$D02E = 47 bytes)
@map spriteRegisters from $D000 to $D02E: byte;

// Color RAM (1000 bytes)
@map colorRAM from $D800 to $DBE7: byte;

// Screen memory (1000 bytes)
@map screenRAM from $0400 to $07E7: byte;

// SID chip registers
@map sidRegisters from $D400 to $D41C: byte;
```

**Usage:**
```js
// Constant index (address computed at compile time)
spriteRegisters[0] = 100;     // Sprite 0 X position ($D000)
spriteRegisters[1] = 50;      // Sprite 0 Y position ($D001)
spriteRegisters[2] = 200;     // Sprite 1 X position ($D002)

// Dynamic index (uses indexed addressing mode)
for i = 0 to 39
  colorRAM[i] = 14;           // Light blue
next i

// Read access
let sprite0X = spriteRegisters[0];
```

**Generated Assembly (examples):**
```asm
; spriteRegisters[0] = 100 (constant index)
LDA #$64
STA $D000         ; Compile-time address: $D000 + 0

; colorRAM[i] = 14 (dynamic index)
LDX ZP_I          ; Index in X register
LDA #$0E
STA $D800,X       ; Indexed addressing: $D800 + X
```

---

### Form 3: Sequential Struct Memory Mapping

Maps fields sequentially from a base address, like a C struct. Fields are automatically laid out with no gaps.

**Syntax:**
```ebnf
sequential_struct_map_decl = "@map" , identifier , "at" , address , "type"
                           , { NEWLINE }
                           , field_list
                           , "end" , "@map" ;

field_list = field_decl , { [ "," ] , { NEWLINE } , field_decl } ;
field_decl = identifier , ":" , type_expr ;
type_expr  = type_name | type_name , "[" , integer , "]" ;
```

**Example:**
```js
// SID voice 1 registers (tightly packed)
@map sidVoice1 at $D400 type
  frequencyLo: byte,      // $D400 (computed)
  frequencyHi: byte,      // $D401 (computed)
  pulseLo: byte,          // $D402 (computed)
  pulseHi: byte,          // $D403 (computed)
  waveform: byte,         // $D404 (computed)
  attackDecay: byte,      // $D405 (computed)
  sustainRelease: byte    // $D406 (computed)
end @map
```

**Usage:**
```js
// Set frequency to 440 Hz (triangle wave)
sidVoice1.frequencyLo = 0x5C;
sidVoice1.frequencyHi = 0x11;

// Triangle wave + gate on
sidVoice1.waveform = 0x11;

// Full ADSR envelope
sidVoice1.attackDecay = 0x00;
sidVoice1.sustainRelease = 0xF0;
```

**Generated Assembly:**
```asm
; sidVoice1.waveform = 0x11
LDA #$11
STA $D404         ; Address computed: $D400 + 4 bytes
```

**Note:** Compiler automatically computes each field's address based on sequential layout and field sizes.

---

### Form 4: Explicit Struct Memory Mapping

Maps fields with explicitly specified addresses. Allows gaps and non-sequential layouts.

**Syntax:**
```ebnf
explicit_struct_map_decl = "@map" , identifier , "at" , address , "layout"
                         , { NEWLINE }
                         , explicit_field_list
                         , "end" , "@map" ;

explicit_field_list = explicit_field , { [ "," ] , { NEWLINE } , explicit_field } ;
explicit_field = identifier , ":" , field_address_spec , ":" , type_name ;

field_address_spec = "at" , address                      (* single address *)
                   | "from" , address , "to" , address ; (* range *)
```

**Example:**
```js
// VIC-II registers (many gaps and reserved registers)
@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,
  spriteXMSB: at $D010: byte,
  control1: at $D011: byte,
  raster: at $D012: byte,
  spriteEnable: at $D015: byte,
  control2: at $D016: byte,
  interruptStatus: at $D019: byte,
  interruptEnable: at $D01A: byte,
  borderColor: at $D020: byte,
  backgroundColor0: at $D021: byte,
  backgroundColor1: at $D022: byte,
  backgroundColor2: at $D023: byte,
  backgroundColor3: at $D024: byte,
  spriteColors: from $D027 to $D02E: byte
end @map
```

**Usage:**
```js
// Set border and background
vic.borderColor = 0;              // Black border
vic.backgroundColor0 = 6;         // Blue background

// Enable sprites 0-2
vic.spriteEnable = 0b00000111;    // Bits 0, 1, 2 = sprites 0, 1, 2

// Set sprite positions
vic.sprites[0] = 100;             // Sprite 0 X position
vic.sprites[1] = 50;              // Sprite 0 Y position

// Raster interrupt setup
vic.raster = 250;                 // Trigger at raster line 250
vic.interruptEnable = 0x01;       // Enable raster interrupt
```

**Generated Assembly:**
```asm
; vic.borderColor = 0
LDA #$00
STA $D020         ; Explicitly specified field address

; vic.sprites[0] = 100
LDA #$64
STA $D000         ; Field range base + index 0
```

**Note:** Explicit layout allows documenting hardware with gaps (e.g., skipping $D013-$D014, $D01B-$D01F, etc.)

---

### Complete Grammar

```ebnf
(* @map declarations - module scope only *)
map_declaration = simple_map_decl 
                | range_map_decl 
                | sequential_struct_map_decl 
                | explicit_struct_map_decl ;

(* 1. Simple: single address mapping *)
simple_map_decl = "@map" , identifier , "at" , address , ":" , type_name , ";" ;

(* 2. Range: contiguous memory array *)
range_map_decl = "@map" , identifier , "from" , address , "to" , address , ":" , type_name , ";" ;

(* 3. Sequential struct: fields auto-laid-out sequentially *)
sequential_struct_map_decl = "@map" , identifier , "at" , address , "type"
                           , { NEWLINE }
                           , field_list
                           , "end" , "@map" ;

field_list = field_decl , { [ "," ] , { NEWLINE } , field_decl } ;
field_decl = identifier , ":" , type_expr ;

(* 4. Explicit struct: fields with explicit addresses *)
explicit_struct_map_decl = "@map" , identifier , "at" , address , "layout"
                         , { NEWLINE }
                         , explicit_field_list
                         , "end" , "@map" ;

explicit_field_list = explicit_field , { [ "," ] , { NEWLINE } , explicit_field } ;
explicit_field = identifier , ":" , field_address_spec , ":" , type_name ;

field_address_spec = "at" , address                      (* single address *)
                   | "from" , address , "to" , address ; (* range *)

(* Common definitions *)
type_expr  = type_name | type_name , "[" , integer , "]" ;
type_name  = "byte" | "word" ;
address    = hex_literal | decimal_literal ;
```

---

### Scope Rules

**`@map` declarations are module-scope only.**

```js
// ✅ ALLOWED: Module scope
module Hardware.VIC

@map vicBorderColor at $D020: byte;

@map vic at $D000 type
  borderColor: byte
end @map

function main(): void
  vic.borderColor = 5;    // USE the mapped memory
end function

// ❌ FORBIDDEN: Inside function
function foo(): void
  @map illegal at $D020: byte;    // Compile error!
end function
```

**Error:**
```
Memory-mapped declarations (@map) must be at module scope.
Cannot declare @map inside functions.
```

**Rationale:**
- Hardware registers have global scope (not local to functions)
- Prevents shadowing and scope confusion
- Simpler symbol table implementation
- Clearer semantic intent

---

### Semicolon Rules

Following Blend65's semicolon rules:

| Form | Syntax | Semicolon Required? |
|------|--------|-------------------|
| Simple | `@map x at $D020: byte` | **YES** (single-line) |
| Range | `@map x from $D000 to $D02E: byte` | **YES** (single-line) |
| Sequential struct | `@map x at $D type ... end @map` | **NO** (block construct) |
| Explicit struct | `@map x at $D layout ... end @map` | **NO** (block construct) |

**Examples:**
```js
// Simple and range require semicolons
@map borderColor at $D020: byte;
@map sprites from $D000 to $D02E: byte;

// Struct forms are self-terminating (no semicolon)
@map vic at $D000 type
  field: byte
end @map

@map vic at $D000 layout
  field: at $D020: byte
end @map
```

---

### Use Cases

#### Individual Hardware Registers
```js
@map vicBorderColor at $D020: byte;
@map vicBackgroundColor at $D021: byte;
@map sidVolume at $D418: byte;
@map cia1DataPortA at $DC00: byte;
```

#### Sprite Positions (Contiguous)
```js
@map spritePositions from $D000 to $D00F: byte;

// Set sprite 0 position
spritePositions[0] = 100;  // X position
spritePositions[1] = 50;   // Y position
```

#### Screen and Color Memory
```js
@map screenRAM from $0400 to $07E7: byte;
@map colorRAM from $D800 to $DBE7: byte;

// Clear screen
for i = 0 to 999
  screenRAM[i] = 32;   // Space character
  colorRAM[i] = 14;    // Light blue
next i
```

#### Complete VIC-II Mapping
```js
@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,
  spriteXMSB: at $D010: byte,
  control1: at $D011: byte,
  raster: at $D012: byte,
  spriteEnable: at $D015: byte,
  interruptStatus: at $D019: byte,
  interruptEnable: at $D01A: byte,
  borderColor: at $D020: byte,
  backgroundColor: at $D021: byte
end @map

// Usage: Clean, type-safe hardware access
vic.borderColor = 0;
vic.spriteEnable = 0xFF;  // Enable all 8 sprites
let currentRaster = vic.raster;
```

---

### Type Safety and Validation

**Compile-time checks:**
- Address overlap detection
- Field existence validation  
- Array bounds checking (constant indices)
- Type compatibility verification

**Examples:**
```js
// ❌ Error: Overlapping memory ranges
@map region1 from $D000 to $D0FF: byte;
@map region2 from $D080 to $D100: byte;  // Overlaps with region1!

// ❌ Error: Invalid field access
@map vic at $D000 layout
  borderColor: at $D020: byte
end @map

vic.invalidField = 5;  // Error: Field 'invalidField' does not exist

// ❌ Error: Type mismatch
@map byteReg at $D020: byte;
let x: word = byteReg;  // Warning: Assigning byte to word
```

---

### Code Generation

Memory-mapped variables compile to **direct memory access** with zero runtime overhead:

**Source:**
```js
@map vic at $D000 layout
  borderColor: at $D020: byte,
  sprites: from $D000 to $D00F: byte
end @map

vic.borderColor = 0;
vic.sprites[0] = 100;
let x = vic.sprites[i];
```

**Generated Assembly:**
```asm
; vic.borderColor = 0
LDA #$00
STA $D020         ; Direct absolute addressing

; vic.sprites[0] = 100
LDA #$64
STA $D000         ; Constant index: compile-time address

; let x = vic.sprites[i]
LDX ZP_I          ; Load index into X
LDA $D000,X       ; Indexed addressing mode
STA ZP_X
```

**No peek/poke function calls!** Direct hardware access at assembly level.

---

### Best Practices

#### Choose the Right Form

**Use Simple** when mapping individual registers:
```js
@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;
```

**Use Range** for contiguous register blocks:
```js
@map colorRAM from $D800 to $DBE7: byte;
```

**Use Sequential Struct** for tightly-packed hardware (no gaps):
```js
@map sidVoice1 at $D400 type
  frequencyLo: byte,
  frequencyHi: byte,
  pulseLo: byte,
  pulseHi: byte
end @map
```

**Use Explicit Struct** for sparse hardware with gaps:
```js
@map vic at $D000 layout
  raster: at $D012: byte,
  borderColor: at $D020: byte  // Gap from $D013-$D01F
end @map
```

#### Naming Conventions

```js
// ✅ GOOD: Descriptive names
@map vicBorderColor at $D020: byte;
@map sidVoice1Frequency at $D400: word;

// ❌ AVOID: Cryptic abbreviations
@map vbc at $D020: byte;
@map s1f at $D400: word;
```

#### Documentation

```js
// Document register purpose and bit meanings
@map vic at $D000 layout
  // Bits: 7=RST8, 6=ECM, 5=BMM, 4=DEN, 3=RSEL, 2-0=YSCROLL
  control1: at $D011: byte,
  
  // Current raster line (read) or target line (write)
  raster: at $D012: byte,
  
  // Bits 7-0: sprites 7-0 enable
  spriteEnable: at $D015: byte
end @map
```

---

### Comparison with Other Languages

**C (volatile pointers):**
```c
#define VIC_BORDER (*((volatile uint8_t*)0xD020))
VIC_BORDER = 5;
```

**Rust (unsafe):**
```rust
unsafe {
    let ptr = 0xD020 as *mut u8;
    *ptr = 5;
}
```

**Blend65:**
```js
@map vicBorderColor at $D020: byte;
vicBorderColor = 5;
```

**Blend65 advantages:**
- More elegant and readable
- Type-safe without `unsafe` blocks
- Integrated with language type system
- Zero overhead (same generated code)

---

## Variable Declarations

The lexer tokens imply a declaration style that includes:

- Optional storage class (defaults to `@ram` when omitted)
- Mutability modifier: `let` or `const`
- Name: identifier
- Optional type annotation: `:` followed by a type
- Optional initializer: `=` expression

Tested examples:

<!-- prettier-ignore -->
```js
// With explicit storage classes
@zp let counter: byte;
@data const initialized: word = 1000;

// Without storage class (defaults to @ram)
let buffer: byte[256];
let score: word = 0;
```

EBNF (expected):

```ebnf
variable_decl = [ storage_class ] , ( "let" | "const" ) , identifier
              , [ ":" , type_expr ]
              , [ "=" , expression ] ;

type_expr = type_name
          | type_name , "[" , integer , "]" ;
```

> **Note**: Storage class is optional. When omitted, `@ram` is used by default.
> 
> **Note**: Variable declarations require semicolons when used as statements.

Array type shapes are suggested by the presence of `[` `]` tokens and test cases like `byte[256]`.

---

## Function Declarations

Blend65 function definitions are block-structured and terminated with an `end` marker.

There is direct evidence for:

- `function name(): void ... end function`
- `export function ...`
- `callback function ...` (interrupt handler style)

Examples:

<!-- prettier-ignore -->
```js
export function main(): void
end function
```

<!-- prettier-ignore -->
```js
callback function rasterIRQ(): void
  // ...
end function
```

EBNF (expected):

```ebnf
function_decl = [ "export" ] , [ "callback" ]
              , "function" , identifier
              , "(" , [ parameter_list ] , ")"
              , [ ":" , type_name ]
              , { NEWLINE }
              , { statement , { NEWLINE } }
              , "end" , "function" ;

parameter_list = parameter , { "," , parameter } ;
parameter      = identifier , ":" , type_expr ;
```

> The lexer does not enforce parameter syntax; it only provides tokens needed to express it.

### Return

The `return` keyword is tokenized.

<!-- prettier-ignore -->
```js
return
return score
```

EBNF (expected):

```ebnf
return_stmt = "return" , [ expression ] ;
```

---

## Expressions

The lexer defines a rich set of operators. This section specifies the expression surface syntax and
operator tokens, but does not claim a final precedence table unless explicitly implemented in the parser.

### Primary expressions

EBNF:

```ebnf
primary_expr = literal
             | identifier
             | qualified_identifier
             | call_expr
             | index_expr
             | "(" , expression , ")" ;

qualified_identifier = identifier , { "." , identifier } ;
```

Examples:

<!-- prettier-ignore -->
```js
score
GameState.MENU
(snakeX + 2)
```

### Calls and indexing

Tokens exist for `(` `)` `[` `]` `,` and `.`.

EBNF (expected):

```ebnf
call_expr  = primary_expr , "(" , [ argument_list ] , ")" ;
index_expr = primary_expr , "[" , expression , "]" ;

argument_list = expression , { "," , expression } ;
```

Examples:

<!-- prettier-ignore -->
```js
setRasterInterrupt(250, callback)
enemies[i].health
snakeX[3]
```

### Operators

#### Arithmetic

- `+` `-` `*` `/` `%`

#### Comparison

- `==` `!=` `<` `<=` `>` `>=`

#### Logical

- `&&` `||` `!`

#### Bitwise

- `&` `|` `^` `~` `<<` `>>`

#### Assignment

- `=`
- `+=` `-=` `*=` `/=` `%=`
- `&=` `|=` `^=`
- `<<=` `>>=`

EBNF (expression skeleton):

```ebnf
expression = assignment_expr ;

assignment_expr = logical_or_expr
               , [ assignment_op , assignment_expr ] ;

assignment_op = "=" | "+=" | "-=" | "*=" | "/=" | "%="
              | "&=" | "|=" | "^=" | "<<=" | ">>=" ;

logical_or_expr  = logical_and_expr , { "||" , logical_and_expr } ;
logical_and_expr = bitwise_or_expr  , { "&&" , bitwise_or_expr  } ;

bitwise_or_expr  = bitwise_xor_expr , { "|"  , bitwise_xor_expr } ;
bitwise_xor_expr = bitwise_and_expr , { "^"  , bitwise_and_expr } ;
bitwise_and_expr = equality_expr    , { "&"  , equality_expr    } ;

equality_expr = relational_expr , { ( "==" | "!=" ) , relational_expr } ;
relational_expr = shift_expr , { ( "<" | "<=" | ">" | ">=" ) , shift_expr } ;
shift_expr = additive_expr , { ( "<<" | ">>" ) , additive_expr } ;

additive_expr = multiplicative_expr , { ( "+" | "-" ) , multiplicative_expr } ;
multiplicative_expr = unary_expr , { ( "*" | "/" | "%" ) , unary_expr } ;

unary_expr = [ "!" | "~" | "+" | "-" ] , unary_expr
           | primary_expr ;
```

> This precedence ladder matches the operator set the lexer provides. If the parser uses a different precedence,
> the grammar should be updated to match parser rules.

---

## Statements

**Statements are separated by semicolons (`;`)**. This allows statements and expressions to span multiple lines.

The lexer provides `SEMICOLON` tokens, and the parser requires them for all statements.

EBNF (expected):

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

assignment_stmt = lvalue , assignment_op , expression ;
lvalue          = qualified_identifier | index_expr ;

expr_stmt       = expression ;

break_stmt      = "break" ;
continue_stmt   = "continue" ;
```

> Note: Control flow constructs (`if`, `while`, `for`, `match`) are self-terminating with `end` keywords and do not require semicolons.

Examples:

<!-- prettier-ignore -->
```js
snakeX = snakeX - 2;
score += 10;
break;
continue;
```

---

## Control Flow

### If

Tests show the `if ... then ... end if` style.

<!-- prettier-ignore -->
```js
if i == 5 then
  break;
end if
```

EBNF (expected):

```ebnf
if_stmt = "if" , expression , "then"
        , { statement }
        , [ "else" , { statement } ]
        , "end" , "if" ;
```

### While

```js
while true
  updateGame();
end while
```

EBNF (expected):

```ebnf
while_stmt = "while" , expression
           , { statement }
           , "end" , "while" ;
```

### For

Tests show `for i = 0 to 10 ... next i`.

```js
for i = 0 to 10
  // ...
next i
```

EBNF (expected):

```ebnf
for_stmt = "for" , identifier , "=" , expression , "to" , expression
        , { statement }
        , "next" , identifier ;
```

### Match / Case / Default

Tests show `match expr ... case X: ... default: ... end match`.

```js
match gameState
  case MENU:
    showMenu();
  default:
    handleError();
end match
```

EBNF (expected):

```ebnf
match_stmt = "match" , expression
           , { case_clause }
           , [ default_clause ]
           , "end" , "match" ;

case_clause = "case" , expression , ":"
            , { statement } ;

default_clause = "default" , ":"
               , { statement } ;
```

---

## Import/Export System

### Imports

Imports are tokenized with `import` and `from`. Tests show importing one identifier:

<!-- prettier-ignore -->
```js
import setSpritePosition from target.sprites
```

Other tests show comma-separated imports:

<!-- prettier-ignore -->
```js
import clearScreen, setPixel from c64.graphics.screen
```

EBNF (expected):

```ebnf
import_decl = "import" , import_list , "from" , name ;

import_list = identifier , { "," , identifier } ;
```

### Exports

Exports are expressed with the `export` keyword.

```js
export function main(): void
end function
```

Re-exports where a previously imported identifier is exported without an inline declaration are **not** supported yet:

```js
import foo from some.lib
export foo    // ❌ ReExportNotSupported
```

EBNF (expected):

```ebnf
export_decl = "export" , ( function_decl | variable_decl | type_decl | enum_decl ) ;
```

---

## Comments

### Line comments

```js
// Initialize game state
let x: byte
```

### Block comments

```js
let x /* comment */ let y
```

### Nesting

Block comments are **not** truly nested. A sequence like `/* outer /* inner */ still comment */` is tokenized
by searching for the first closing `*/`. Tests note this behavior.

---

## Examples

### Minimal module with import and export

<!-- prettier-ignore -->
```js
module Game.Main
import setSpritePosition from target.sprites
export function main(): void
end function
```

### Storage classes and declarations

<!-- prettier-ignore -->
```js
@zp let counter: byte;
@ram let buffer: byte[256];
@data const initialized: word = 1000;
```

### Loop with break/continue

<!-- prettier-ignore -->
```js
for i = 0 to 10
  if i == 5 then
    break;
  end if
  if i == 3 then
    continue;
  end if
next i
```

### Match with default

<!-- prettier-ignore -->
```js
match gameState
  case MENU:
    showMenu();
  case PLAYING:
    updateGame();
  default:
    handleError();
end match
```

### Enum + state machine style

<!-- prettier-ignore -->
```js
enum GameState
  MENU, PLAYING, PAUSED, GAME_OVER
end enum

function gameLoop(): void
  while true
    match currentState
      case GameState.MENU:
        handleMenu();
      default:
        currentState = GameState.MENU;
    end match
  end while
end function
```

### Multi-line expressions

Semicolons allow expressions to span multiple lines naturally:

<!-- prettier-ignore -->
```js
@zp let screenAddr: word = 
  $D000 + 
  (row * 40) + 
  column;

let result: byte =
  calculateBase() +
  applyOffset() +
  getFinalValue();
```

---

## Error Handling

This section describes lexer-level errors (tokenization errors). Parser/semantic errors are separate.

### Unexpected characters

Any character not belonging to a valid token causes an exception.

Example:

<!-- prettier-ignore -->
```js
let `backtick`
```

### Invalid storage class keyword

Any `@` sequence not equal to `@zp`, `@ram`, or `@data` throws.

```js
@ $0000
```

### Invalid numeric literal

Invalid numeric prefixes throw:

- `$` with no hex digits
- `0x` with no hex digits
- `0b` with no binary digits

Examples:

<!-- prettier-ignore -->
```js
$
0x
0b
```

### Unterminated strings

Missing closing quote throws:

<!-- prettier-ignore -->
```js
"hello
'world
```

### Unterminated block comments

Missing closing `*/` throws.

<!-- prettier-ignore -->
```js
let x /* unterminated
```

---

## 6502 Specific Features

### Memory placement via storage classes

The storage class system is a first-class 6502 feature:

- `@zp` indicates zero-page allocation (fast addressing modes).
- `@ram` indicates general RAM allocation (default).
- `@data` indicates an initialized data region.

```js
@zp let fastCounter: byte = 0;
@ram let screenBuffer: byte[1000];
@data const fontData: byte[2048] = [0, 1, 2];
```

### Storage Class Selection Guidelines

Choose the appropriate storage class based on your variable's characteristics:

**Use `@zp` (zero page) when:**
- Variable is accessed frequently in performance-critical code
- Variable is a byte or word (8 or 16 bits)
- You need fast zero-page addressing modes (saves cycles and bytes)
- ⚠️ **Warning**: Zero page is limited to 256 bytes total and shared with system/runtime

**Use `@ram` (or omit storage class) when:**
- General-purpose variables
- Large arrays or buffers
- No special performance requirements
- This is the **default** and most common choice
- Suitable for 99% of variables

**Use `@data` when:**
- Constant data that must be pre-initialized at compile time
- ROM-able constant tables (lookup tables, tile data, etc.)
- Data that should not consume RAM
- Usually combined with `const` declarations

**Example:**
```js
// Performance-critical loop counter in zero page
@zp let frameCount: byte = 0;

// Large buffer uses default @ram (no annotation needed)
let screenBuffer: byte[1000];

// Constant lookup table in data section
@data const sinTable: byte[256] = [...];
```

### Callback keyword

The lexer provides a `callback` keyword used in two major ways:

1. Marking a function as callback-capable:

<!-- prettier-ignore -->
```js
callback function rasterIRQ(): void
  // interrupt handler
end function
```

2. Using `callback` as a type annotation (function pointer style):

<!-- prettier-ignore -->
```js
let handler: callback = myFunction;
```

> Note: The lexer treats the exact string `callback` as a keyword token. Identifiers like `callbackCount`
> remain normal identifiers.

---

## Migration Guide: Newline-Based to Semicolon-Based Syntax

### Breaking Change

**Blend65 now requires semicolons** (`;`) to separate statements, replacing the previous newline-based approach.

### Why This Change?

1. **Familiarity**: Semicolons align with C/C++/Java/JavaScript syntax, familiar to most programmers
2. **Multi-line flexibility**: Expressions and statements can naturally span multiple lines without special handling
3. **Simplicity**: Removes parser complexity around optional vs. required newlines
4. **Clarity**: Explicit statement boundaries are clearer than implicit newline rules

### Migration Steps

**Simple find-and-replace approach:**

1. Add `;` after every statement (variable declarations, assignments, `return`, `break`, `continue`, etc.)
2. Do NOT add `;` after declarations (`module`, `import`, `export function`, `enum`, `type`)
3. Do NOT add `;` after control flow blocks (`end if`, `end while`, `end for`, `end match`, `end function`, `end enum`)

### Before and After Examples

#### Variable Declarations

**Before:**
```js
@zp let x: byte = 5
@ram let y: word = 10
const MAX: byte = 255
```

**After:**
```js
@zp let x: byte = 5;
@ram let y: word = 10;
const MAX: byte = 255;
```

#### Statements in Functions

**Before:**
```js
function update(): void
  snakeX = snakeX + 1
  snakeY = snakeY - 1
  if snakeX > 320 then
    snakeX = 0
  end if
end function
```

**After:**
```js
function update(): void
  snakeX = snakeX + 1;
  snakeY = snakeY - 1;
  if snakeX > 320 then
    snakeX = 0;
  end if
end function
```

#### Module and Import Declarations (NO SEMICOLONS)

**Before:**
```js
module Game.Main
import clearScreen from c64.graphics
```

**After (unchanged):**
```js
module Game.Main
import clearScreen from c64.graphics
```

### What Requires Semicolons

✅ **Statements (require `;`):**
- Variable declarations: `let x: byte = 5;`
- Assignments: `x = 10;`
- Function calls: `clearScreen();`
- `return` statements: `return value;`
- `break` and `continue`: `break;` `continue;`

❌ **Declarations (NO `;`):**
- Module: `module Game.Main`
- Import: `import foo from bar`
- Export + function: `export function main(): void`
- Function: `function name(): void` ... `end function`
- Enum: `enum State` ... `end enum`
- Type: `type Alias = byte`
- Control flow: `if ... end if`, `while ... end while`, `for ... next`, `match ... end match`

### Error Messages

Missing semicolons will produce clear error messages:

```
Parse error at line 5, column 20: Expected semicolon
```

### Benefits of New Syntax

**Multi-line expressions work naturally:**
```js
let result: word =
  calculateBaseAddress() +
  getOffset() +
  getFinalValue();
```

**No ambiguity about statement boundaries:**
```js
x = 5; y = 10; z = 15;  // Multiple statements on one line (if needed)
```

**Cleaner separation of concerns:**
- Lexer: Tokenize everything, skip whitespace (including newlines)
- Parser: Use semicolons for statement separation

---
