# Program Structure

> **Status**: Lexer-Derived Specification  
> **Last Updated**: January 8, 2026  
> **Related Documents**: [Module System](04-module-system.md), [Variables](10-variables.md), [Functions](11-functions.md)

## Overview

At a high level, Blend65 source is a sequence of top-level declarations. This document describes how programs are structured and the ordering rules enforced by the parser.

## Top-Level Structure

**Statements require semicolons** for termination. **Declarations are self-terminating** (no semicolon needed).

EBNF:

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

> **Note**: The lexer alone does not enforce strict ordering, but the parser does. See [Top-Level Ordering Rules](#top-level-ordering-rules) below.

## Top-Level Ordering Rules

Blend65 source files follow **deterministic top-level ordering semantics** so that downstream passes can assume a predictable module layout. The parser enforces these rules even though the lexer would accept more permissive token streams.

These rules supersede the historical `plans/ordering.md` document.

### 1. Single Module Per File

- **The first non-trivia token** in a file must be `module`
- Comments and blank lines may precede it, but any other construct before the module header is rejected
- When the token stream lacks an explicit module, the parser synthesizes `module global` so the AST always has a module root
- After an implicit module has been inserted, encountering a real `module` declaration raises `DuplicateModuleDeclaration`

**Example (valid):**

```js
// Comments are allowed before module
module Game.Main

import clearScreen from c64.graphics

export function main(): void
end function
```

**Example (invalid - no explicit module):**

```js
// Missing module declaration
import clearScreen from c64.graphics  // Error before implicit module

export function main(): void
end function
```

**Example (invalid - duplicate module):**

```js
module Game.Main
module Game.Other  // Error: DuplicateModuleDeclaration
```

### 2. Globals-Only Body

After the module header, only **global declarations** are allowed:
- Storage-class-prefixed `let`/`const` variables
- Function declarations (optionally `callback`)
- Type aliases
- Enums
- Memory-mapped declarations (`@map`)
- Imports
- Export wrappers around those declarations

**Any other token** at module scope (e.g., expression statements, stray keywords) produces an `UnexpectedTopLevelToken` diagnostic and the parser synchronizes at the next newline or declaration keyword.

**Example (valid):**

```js
module Game.Main

@zp let score: word = 0;
@ram let buffer: byte[256];

function update(): void
  score += 1;
end function
```

**Example (invalid - executable statement at module scope):**

```js
module Game.Main

@zp let score: word = 0;
score = 100;  // Error: UnexpectedTopLevelToken

function update(): void
  score += 1;
end function
```

### 3. Exports and Entry Point

- Variables and functions may be explicitly exported via the `export` keyword
- Future analyzer stages will also honor exported type aliases and enums
- **Exactly one exported `main` function** may appear per file
- If `main` is declared without `export`, the parser marks it as exported and emits an `ImplicitMainExport` warning

**Example (valid - explicit export):**

```js
module Game.Main

export function main(): void
  // Entry point
end function
```

**Example (valid - implicit export warning):**

```js
module Game.Main

function main(): void  // Warning: ImplicitMainExport
  // Entry point
end function
```

**Example (invalid - duplicate main):**

```js
module Game.Main

export function main(): void
end function

export function main(): void  // Error: DuplicateExportedMain
end function
```

### 4. Constant Initialization

- `const` declarations **must** include an initializer expression
- Missing initializers trigger `MissingConstInitializer`

**Example (valid):**

```js
const MAX_SPRITES: byte = 8;
const SCREEN_BASE: word = $0400;
```

**Example (invalid):**

```js
const MAX_SPRITES: byte;  // Error: MissingConstInitializer
```

### 5. No Executable Global Statements

- Executable statements (e.g., function calls, `if` chains, assignments) are **not permitted** at module scope
- The parser rejects them so that global code remains pure declarations
- Zero-overhead initialization happens via generated assembly routines instead of eager execution

**Example (valid):**

```js
module Game.Main

@zp let initialized: boolean = false;

function init(): void
  initialized = true;
end function
```

**Example (invalid):**

```js
module Game.Main

@zp let initialized: boolean = false;
initialized = true;  // Error: No executable statements at module scope

function init(): void
end function
```

## Module Scope vs Function Scope

### Module Scope

At module scope, you can declare:
- ✅ Module declaration
- ✅ Imports
- ✅ Exports
- ✅ Variables (with storage classes)
- ✅ Functions
- ✅ Types
- ✅ Enums
- ✅ Memory-mapped declarations (`@map`)
- ❌ Executable statements

### Function Scope

Inside functions, you can:
- ✅ Declare local variables
- ✅ Execute statements
- ✅ Use control flow (if, while, for, match)
- ✅ Call functions
- ✅ Return values
- ❌ Declare functions (no nested functions)
- ❌ Declare memory-mapped variables (`@map` is module-scope only)

## Statement Termination

Blend65 uses **semicolons** to separate statements:

```js
let x: byte = 5;
let y: byte = 10;
x = x + 1;
```

**Block-structured constructs** do not require semicolons:

```js
if x > 5 then
  doSomething();
end if

while running
  update();
end while

function main(): void
  // ...
end function
```

## Example Program Structure

Here's a complete, well-structured Blend65 program:

```js
// File: game.b65
// This is a comment

// 1. Module declaration (required, must be first)
module Game.Snake

// 2. Imports
import clearScreen, setPixel from c64.graphics
import setSpritePosition from c64.sprites

// 3. Memory-mapped hardware registers
@map vicBorderColor at $D020: byte;
@map vicBackgroundColor at $D021: byte;

// 4. Global constants and variables
@data const MAX_SNAKE_LENGTH: byte = 100;
@zp let snakeX: byte = 10;
@zp let snakeY: byte = 10;
@ram let buffer: byte[256];

// 5. Type declarations
type Position = word;

// 6. Enum declarations
enum Direction
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3
end enum

// 7. Functions
function init(): void
  vicBorderColor = 0;
  vicBackgroundColor = 6;
  snakeX = 10;
  snakeY = 10;
end function

function update(): void
  snakeX += 1;
  if snakeX > 40 then
    snakeX = 0;
  end if
end function

// 8. Exported entry point
export function main(): void
  init();
  while true
    update();
  end while
end function
```

## Ordering Best Practices

For maintainable code, follow this ordering:

1. **File header comment** (optional, but recommended)
2. **Module declaration** (required)
3. **Imports** (group related imports)
4. **Memory-mapped declarations** (hardware registers)
5. **Constants** (`const` declarations)
6. **Global variables** (`let` declarations)
7. **Type aliases** (`type` declarations)
8. **Enums** (`enum` declarations)
9. **Helper functions** (internal functions)
10. **Exported functions** (public API)
11. **Main function** (`export function main`)

## Common Ordering Errors

### Error: Missing Module Declaration

```js
// Error: No module declaration
import foo from bar  // UnexpectedTopLevelToken
```

**Fix:**
```js
module Game.Main
import foo from bar
```

### Error: Module Declaration After Code

```js
import foo from bar
module Game.Main  // Error: Module must be first
```

**Fix:**
```js
module Game.Main
import foo from bar
```

### Error: Executable Code at Module Scope

```js
module Game.Main

@zp let x: byte = 0;
x = 5;  // Error: No executable statements at module scope
```

**Fix:**
```js
module Game.Main

@zp let x: byte = 0;

function init(): void
  x = 5;  // Move to function
end function
```

## Implementation Notes

The parser enforces these rules in `packages/compiler/src/parser/`. Tests demonstrating ordering rules can be found in `packages/compiler/src/__tests__/parser/`.

For the complete list of parser-enforced rules, see the implementation files.
