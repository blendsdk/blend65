# Blend65 Language Specification

**Version:** 0.1.0
**Date:** January 2026
**Status:** Draft

## Table of Contents

1. [Introduction](#introduction)
2. [Lexical Structure](#lexical-structure)
3. [Grammar Overview](#grammar-overview)
4. [Program Structure](#program-structure)
5. [Module System](#module-system)
6. [Type System](#type-system)
7. [Storage Classes](#storage-classes)
8. [Variable Declarations](#variable-declarations)
9. [Function Declarations](#function-declarations)
10. [Expressions](#expressions)
11. [Statements](#statements)
12. [Control Flow](#control-flow)
13. [Import/Export System](#importexport-system)
14. [Comments](#comments)
15. [Examples](#examples)
16. [Error Handling](#error-handling)
17. [6502 Specific Features](#6502-specific-features)

---

## Introduction

Blend65 is a statically-typed, multi-target programming language specifically designed for 6502 microprocessor development. It features a Pascal-like syntax with modern language constructs while maintaining the performance and memory constraints required for 6502 systems like the Commodore 64, VIC-20, and Commander X16.

### Key Features

- **6502-Optimized**: Designed specifically for 6502 architecture constraints
- **Storage Classes**: Zero page, RAM, ROM, and I/O memory management
- **Multi-Target**: Single codebase targeting multiple 6502 platforms
- **Static Typing**: Compile-time type checking with explicit type annotations
- **Module System**: Organized code with qualified imports/exports
- **Pascal-like Syntax**: Familiar, readable syntax with explicit block terminators

---

## Lexical Structure

### Keywords

```ebnf
keyword = "module" | "import" | "export" | "from" | "function" | "end" | "return"
        | "if" | "then" | "else" | "while" | "for" | "to" | "next" | "match" | "case"
        | "var" | "type" | "extends"
        | "zp" | "ram" | "data" | "const" | "io"
        | "byte" | "word" | "boolean" | "void"
        | "and" | "or" | "not"
        | "true" | "false" | "callback" ;
```

### Identifiers

```ebnf
identifier = letter { letter | digit | "_" } ;
letter = "A".."Z" | "a".."z" | "_" ;
digit = "0".."9" ;
```

**Examples:**

```js
counter;
playerX;
VIC_REGISTER;
_tempVar;
sprite0Position;
```

### Literals

#### Number Literals

```ebnf
number = decimal_number | hex_number | binary_number ;
decimal_number = digit { digit } ;
hex_number = ( "$" hex_digit { hex_digit } ) | ( "0x" hex_digit { hex_digit } ) ;
binary_number = "0b" binary_digit { binary_digit } ;
hex_digit = digit | "A".."F" | "a".."f" ;
binary_digit = "0" | "1" ;
```

**Examples:**

```js
255; // Decimal
$FF; // Hexadecimal (6502 style)
0xff; // Hexadecimal (C style)
0b11111111; // Binary
```

#### String Literals

```ebnf
string_literal = '"' { string_char } '"' | "'" { string_char } "'" ;
string_char = escape_sequence | ( any_char - ( '"' | "'" | "\\" | newline ) ) ;
escape_sequence = "\\" ( "n" | "t" | "r" | "\\" | '"' | "'" ) ;
```

**Examples:**

```js
'Hello, World!';
'Single quoted string';
'Line with\nnewline';
"Quote: \"Hello\"";
```

#### Boolean Literals

```ebnf
boolean_literal = "true" | "false" ;
```

**Examples:**

```js
true;
false;
```

### Operators

```ebnf
arithmetic_op = "+" | "-" | "*" | "/" | "%" ;
comparison_op = "==" | "!=" | "<" | "<=" | ">" | ">=" ;
logical_op = "and" | "or" | "not" ;
bitwise_op = "&" | "|" | "^" | "~" | "<<" | ">>" ;
assignment_op = "=" | "+=" | "-=" | "*=" | "/=" | "%="
               | "&=" | "|=" | "^=" | "<<=" | ">>=" ;
```

### Punctuation

```ebnf
punctuation = "(" | ")" | "[" | "]" | "{" | "}" | "," | ";" | ":" | "." ;
```

---

## Grammar Overview

### Program Structure

```ebnf
program = module_declaration
          { import_declaration }
          { export_declaration | declaration } ;
```

### Complete EBNF Grammar

```ebnf
(* Program Structure *)
program = module_declaration
          { import_declaration }
          { export_declaration | declaration } ;

module_declaration = "module" qualified_name statement_terminator ;

qualified_name = identifier { "." identifier } ;

(* Import/Export System *)
import_declaration = "import" import_specifier_list "from" qualified_name statement_terminator ;
import_specifier_list = import_specifier { "," import_specifier } ;
import_specifier = identifier [ "as" identifier ] ;

export_declaration = "export" declaration ;

(* Declarations *)
declaration = function_declaration | variable_declaration | type_declaration ;

function_declaration = ["callback"] "function" identifier "(" parameter_list ")" [ ":" type_annotation ]
                      statement_terminator
                      statement_block
                      "end" "function" statement_terminator ;

parameter_list = [ parameter { "," parameter } ] ;
parameter = identifier ":" type_annotation [ "=" expression ] ;

variable_declaration = [ storage_class ] "var" identifier ":" type_annotation
                      [ "=" expression ] statement_terminator ;

storage_class = "zp" | "ram" | "data" | "const" | "io" ;

type_declaration = "type" identifier [ "extends" type_annotation ]
                  type_body
                  "end" "type" statement_terminator ;

(* Type System *)
type_annotation = primitive_type | array_type | named_type ;
primitive_type = "byte" | "word" | "boolean" | "void" | "callback" ;
array_type = type_annotation "[" expression "]" ;
named_type = identifier ;

(* Statements *)
statement_block = { statement } ;

statement = expression_statement
          | local_variable_declaration
          | if_statement
          | while_statement
          | for_statement
          | match_statement
          | return_statement ;

local_variable_declaration = "var" identifier ":" type_annotation
                           [ "=" expression ] statement_terminator ;

expression_statement = expression statement_terminator ;

if_statement = "if" expression "then" statement_terminator
               statement_block
               [ "else" statement_terminator statement_block ]
               "end" "if" statement_terminator ;

while_statement = "while" expression statement_terminator
                  statement_block
                  "end" "while" statement_terminator ;

for_statement = "for" identifier "=" expression "to" expression
                [ "step" expression ] statement_terminator
                statement_block
                "next" [ identifier ] statement_terminator ;

match_statement = "match" expression statement_terminator
                  { match_case }
                  [ default_case ]
                  "end" "match" statement_terminator ;

match_case = "case" expression ":" statement_terminator statement_block ;
default_case = "case" ":" statement_terminator statement_block ;

return_statement = "return" [ expression ] statement_terminator ;

(* Expressions *)
expression = assignment_expression ;

assignment_expression = logical_or_expression
                       [ assignment_op assignment_expression ] ;

logical_or_expression = logical_and_expression
                       { "or" logical_and_expression } ;

logical_and_expression = bitwise_or_expression
                        { "and" bitwise_or_expression } ;

bitwise_or_expression = bitwise_xor_expression
                       { "|" bitwise_xor_expression } ;

bitwise_xor_expression = bitwise_and_expression
                        { "^" bitwise_and_expression } ;

bitwise_and_expression = equality_expression
                        { "&" equality_expression } ;

equality_expression = relational_expression
                     { ( "==" | "!=" ) relational_expression } ;

relational_expression = shift_expression
                       { ( "<" | "<=" | ">" | ">=" ) shift_expression } ;

shift_expression = additive_expression
                  { ( "<<" | ">>" ) additive_expression } ;

additive_expression = multiplicative_expression
                     { ( "+" | "-" ) multiplicative_expression } ;

multiplicative_expression = unary_expression
                           { ( "*" | "/" | "%" ) unary_expression } ;

unary_expression = [ ( "+" | "-" | "not" | "~" ) ] postfix_expression ;

postfix_expression = primary_expression
                    { ( "[" expression "]" ) | ( "(" argument_list ")" ) | ( "." identifier ) } ;

argument_list = [ expression { "," expression } ] ;

primary_expression = identifier
                   | number
                   | string_literal
                   | boolean_literal
                   | array_literal
                   | "(" expression ")" ;

array_literal = "[" [ expression { "," expression } ] "]" ;

(* Lexical Elements *)
statement_terminator = newline | ";" ;
newline = ? platform-specific newline character ? ;
```

---

## Program Structure

Every Blend65 program follows this structure:

```ebnf
program = module_declaration
          { import_declaration }
          { export_declaration | declaration } ;
```

**Semantic Rules:**

- Every file must start with exactly one module declaration
- Import declarations must come before any other declarations
- Export declarations and regular declarations can be intermixed
- The program represents a single compilation unit

**Examples:**

### Simple Program

```js
module Game.Main

function main(): void
  var x: byte = 42
end function
```

### Complex Program

```js
module Game.Player
import setSpritePosition from c64.sprites
import utils from core.helpers
export var playerScore: word

export function updatePlayer(): void
  // Implementation
end function

function internal_helper(): byte
  return 5
end function
```

---

## Module System

### Module Declaration

```ebnf
module_declaration = "module" qualified_name statement_terminator ;
qualified_name = identifier { "." identifier } ;
```

**Semantic Rules:**

- Module names are hierarchical using dot notation
- Module name should reflect the file's purpose and location
- Convention: Use PascalCase for module parts (`Game.Main`, `Engine.Graphics`)

**Examples:**

### Single Level Module

```js
module Main
```

### Hierarchical Module

```js
module Game.Player.Movement
```

### Platform-Specific Module

```js
module C64.Graphics.Sprites
```

---

## Type System

### Type Annotations

```ebnf
type_annotation = primitive_type | array_type | named_type ;
primitive_type = "byte" | "word" | "boolean" | "void" ;
array_type = type_annotation "[" expression "]" ;
named_type = identifier ;
```

**Semantic Rules:**

- All variables and function parameters must have explicit type annotations
- Array sizes must be compile-time constants
- `void` type only valid for function return types
- Type compatibility is strict (no implicit conversions)

### Primitive Types

| Type       | Size   | Range      | Usage                     |
| ---------- | ------ | ---------- | ------------------------- |
| `byte`     | 8-bit  | 0-255      | Most common 6502 type     |
| `word`     | 16-bit | 0-65535    | Addresses, larger values  |
| `boolean`  | 8-bit  | true/false | Logical operations        |
| `void`     | -      | -          | Function return type only |
| `callback` | 16-bit | Address    | Function pointer/reference|

**Examples:**

### Basic Types

```js
var counter: byte = 0
var address: word = $C000
var enabled: boolean = true
```

### Array Types

```js
var buffer: byte[256]          // Fixed-size byte array
var screenData: byte[1000]     // Large data array
var coordinates: word[100]     // Array of 16-bit values
```

### Function Return Types

```js
function getByte(): byte       // Returns a byte
  return 42
end function

function process(): void       // Returns nothing
  // Process something
end function
```

---

## Storage Classes

Storage classes are a unique feature of Blend65 that map directly to 6502 memory organization:

```ebnf
storage_class = "zp" | "ram" | "data" | "const" | "io" ;
variable_declaration = [ storage_class ] "var" identifier ":" type_annotation
                      [ "=" expression ] statement_terminator ;
```

### Storage Class Semantics

| Storage Class | Memory Location     | Initialization | Access Speed | Usage                    |
| ------------- | ------------------- | -------------- | ------------ | ------------------------ |
| `zp`          | Zero Page ($00-$FF) | Runtime        | Fastest      | Hot variables, counters  |
| `ram`         | General RAM         | Runtime        | Normal       | General variables        |
| `data`        | Initialized Data    | Compile-time   | Normal       | Pre-initialized arrays   |
| `const`       | ROM/Constant        | Compile-time   | Normal       | Constants, lookup tables |
| `io`          | Memory-mapped I/O   | None           | Variable     | Hardware registers       |
| _(default)_   | Automatic           | Runtime        | Normal       | Local variables          |

**Examples:**

### Zero Page Variables (Fastest Access)

```js
zp var counter: byte = 0           // Fast loop counter
zp var tempPtr: word              // Fast pointer arithmetic
```

### RAM Variables (General Storage)

```js
ram var gameState: byte           // General game data
ram var buffer: byte[1000]        // Large working buffer
```

### Data Variables (Pre-initialized)

```js
data var palette: byte[16] = [
  $00, $01, $02, $03, $04, $05, $06, $07,
  $08, $09, $0A, $0B, $0C, $0D, $0E, $0F
]
```

### Constant Variables (Read-only)

```js
const var SCREEN_WIDTH: byte = 40
const var SIN_TABLE: byte[256] = [/* sine values */]
```

### I/O Variables (Hardware Registers)

```js
io var VIC_BACKGROUND: byte       // $D020 - Background color
io var SID_VOLUME: byte           // $D418 - Sound volume
```

---

## Variable Declarations

```ebnf
variable_declaration = [ storage_class ] "var" identifier ":" type_annotation
                      [ "=" expression ] statement_terminator ;
```

**Semantic Rules:**

- All variables must have explicit type annotations
- **Storage classes are only allowed at global scope (module level)**
- Local variables inside functions use automatic storage only
- Initialization expressions must be compile-time constants for `data` and `const`
- I/O variables typically map to specific hardware addresses

**Scope Restrictions:**

- `zp`, `ram`, `data`, `const`, `io` storage classes: **Global scope only**
- Function parameters and local variables: **Automatic storage only**

**Examples:**

### Global Variable Declarations (Module Level)

```js
// Valid: Storage classes at global scope
zp var hotCounter: byte              // Zero page for speed
ram var enemies: byte[50]            // RAM for dynamic data
data var levelData: byte[256] = [/* data */]  // Pre-initialized
const var MAX_LIVES: byte = 3        // Constant value
io var VIC_BACKGROUND: byte          // Hardware register
var globalVar: byte = 0              // Default storage (automatic)
```

### Function Local Variables (Automatic Storage Only)

```js
function calculateDistance(): word
  var deltaX: byte                   // Local variable (automatic storage only)
  var deltaY: byte                   // Local variable (automatic storage only)
  var result: word                   // Local variable (automatic storage only)

  // Storage classes NOT ALLOWED inside functions
  // zp var illegal: byte            // ERROR: Storage class not allowed
  // io var invalid: byte            // ERROR: Storage class not allowed

  // Implementation
  return result
end function
```

### Storage Class Memory Allocation

```js
module Game.Main

// All storage class variables declared at module level
zp var playerX: byte                 // Allocated to zero page at compile time
zp var playerY: byte                 // Allocated to zero page at compile time
io var VIC_SPRITE_X: byte           // Mapped to hardware register
ram var gameBuffer: byte[1000]       // Allocated to general RAM

function updatePlayer(): void
  var deltaX: byte                   // Local automatic variable
  var deltaY: byte                   // Local automatic variable

  // Use global storage class variables
  deltaX = playerX + 1
  deltaY = playerY + 1

  if deltaX < 255 then
    playerX = deltaX
    VIC_SPRITE_X = playerX           // Update hardware register
  end if
end function
```

---

## Function Declarations

```ebnf
function_declaration = "function" identifier "(" parameter_list ")" [ ":" type_annotation ]
                      statement_terminator
                      statement_block
                      "end" "function" statement_terminator ;

parameter_list = [ parameter { "," parameter } ] ;
parameter = identifier ":" type_annotation [ "=" expression ] ;
```

**Semantic Rules:**

- Functions without explicit return type default to `void`
- All parameters must have explicit type annotations
- Function body consists of statements terminated by `end function`
- Functions can be exported to make them available to other modules
- `callback` functions can have any parameters and return types
- `callback` functions can be exported and used as function pointers
- `callback` modifier enables functions to be used in callback variables
- Both `callback` and regular functions can be called directly

**Examples:**

### Simple Function

```js
function greet(): void
  // Print greeting
end function
```

### Function with Parameters

```js
function add(a: byte, b: byte): byte
  return a + b
end function
```

### Function with Default Parameters

```js
function setSprite(id: byte, x: byte, y: byte, color: byte = 1): void
  // Set sprite properties
end function
```

### Complex Function Example

```js
export function updatePlayer(deltaTime: byte): boolean
  var newX: byte
  var newY: byte

  // Calculate new position
  newX = playerX + playerVelocityX
  newY = playerY + playerVelocityY

  // Check bounds
  if newX < SCREEN_LEFT or newX > SCREEN_RIGHT then
    return false
  end if

  if newY < SCREEN_TOP or newY > SCREEN_BOTTOM then
    return false
  end if

  // Update position
  playerX = newX
  playerY = newY

  return true
end function
```

---

## Expressions

### Expression Precedence (Highest to Lowest)

| Precedence | Operators                           | Associativity       | Description                                 |
| ---------- | ----------------------------------- | ------------------- | ------------------------------------------- | ---------- |
| 1          | `()` `[]` `.`                       | Left-to-right       | Grouping, indexing, member access           |
| 2          | `+` `-` `not` `~`                   | Right-to-left       | Unary plus, minus, logical not, bitwise not |
| 3          | `*` `/` `%`                         | Left-to-right       | Multiplication, division, modulo            |
| 4          | `+` `-`                             | Left-to-right       | Addition, subtraction                       |
| 5          | `<<` `>>`                           | Left-to-right       | Bit shifts                                  |
| 6          | `<` `<=` `>` `>=`                   | Left-to-right       | Relational comparison                       |
| 7          | `==` `!=`                           | Left-to-right       | Equality comparison                         |
| 8          | `&`                                 | Left-to-right       | Bitwise AND                                 |
| 9          | `^`                                 | Left-to-right       | Bitwise XOR                                 |
| 10         | `                                   | `                   | Left-to-right                               | Bitwise OR |
| 11         | `and`                               | Left-to-right       | Logical AND                                 |
| 12         | `or`                                | Left-to-right       | Logical OR                                  |
| 13         | `=` `+=` `-=` `*=` `/=` `%=` `&=` ` | =` `^=` `<<=` `>>=` | Right-to-left                               | Assignment |

**Examples:**

### Arithmetic Expressions

```js
var result: byte = a + b * c       // b * c first, then + a
var scaled: byte = (a + b) * 2     // Parentheses override precedence
var remainder: byte = value % 8    // Modulo operation
```

### Logical Expressions

```js
var canMove: boolean = not blocked and hasEnergy
var inRange: boolean = x >= minX and x <= maxX
var validColor: boolean = color == RED or color == BLUE
```

### Bitwise Expressions

```js
var masked: byte = value & $0F     // Keep lower 4 bits
var shifted: byte = value << 2     // Multiply by 4 (shift left)
var combined: byte = flagA | flagB // Combine flags
```

### Assignment Expressions

```js
counter += 1; // Equivalent to: counter = counter + 1
value <<= 2; // Equivalent to: value = value << 2
flags &= ~DISABLED_FLAG; // Clear specific flag
```

### Function Calls

```js
var distance: word = calculateDistance(x1, y1, x2, y2)
setSpritePosition(0, playerX, playerY)
```

### Array Access

```js
var pixel: byte = screenData[y * 40 + x]
buffer[index] = newValue
palette[colorIndex] = $0E
```

### Member Access (Future Feature)

```js
// Not yet implemented in v0.1
player.x = 100;
enemy.health -= damage;
```

---

## Statements

### Expression Statement

```ebnf
expression_statement = expression statement_terminator ;
```

Any expression followed by a statement terminator becomes a statement.

**Examples:**

```js
counter += 1; // Assignment expression as statement
setSpritePosition(0, x, y); // Function call as statement
buffer[index] = value; // Array assignment as statement
```

### Return Statement

```ebnf
return_statement = "return" [ expression ] statement_terminator ;
```

**Examples:**

```js
return; // Return void
return 42; // Return value
return x + y; // Return expression result
```

---

## Control Flow

### If Statement

```ebnf
if_statement = "if" expression "then" statement_terminator
               statement_block
               [ "else" statement_terminator statement_block ]
               "end" "if" statement_terminator ;
```

**Semantic Rules:**

- Condition expression must evaluate to a boolean
- `then` keyword is required
- `else` clause is optional
- Must be terminated with `end if`

**Examples:**

### Simple If

```js
if health <= 0 then
  gameOver = true
end if
```

### If-Else

```js
if score > highScore then
  highScore = score
  newRecord = true
else
  newRecord = false
end if
```

### Nested If Statements

```js
if playerAlive then
  if hasKey then
    if nearDoor then
      openDoor()
    end if
  else
    showMessage("Need key!")
  end if
end if
```

### If with Complex Conditions

```js
if (x >= 0 and x < SCREEN_WIDTH) and (y >= 0 and y < SCREEN_HEIGHT) then
  setPixel(x, y, color)
end if
```

### While Statement

```ebnf
while_statement = "while" expression statement_terminator
                  statement_block
                  "end" "while" statement_terminator ;
```

**Examples:**

### Simple While Loop

```js
while counter < 10
  buffer[counter] = 0
  counter += 1
end while
```

### While with Complex Condition

```js
while gameRunning and not quitPressed
  updateGame()
  renderFrame()
  checkInput()
end while
```

### Infinite Loop (Common in 6502 Games)

```js
while true
  // Main game loop
  waitForVSync()
  updateLogic()
  renderGraphics()
end while
```

### For Statement

```ebnf
for_statement = "for" identifier "=" expression "to" expression
                [ "step" expression ] statement_terminator
                statement_block
                "next" [ identifier ] statement_terminator ;
```

**Semantic Rules:**

- Loop variable is automatically declared with `byte` type
- Start and end expressions evaluated once at loop entry
- Step defaults to 1 if not specified
- Loop variable optional after `next` (for readability)

**Examples:**

### Simple For Loop

```js
for i = 0 to 255
  buffer[i] = 0
next i
```

### For Loop with Step

```js
for x = 0 to 320 step 8
  drawVerticalLine(x)
next x
```

### Nested For Loops

```js
for y = 0 to 24
  for x = 0 to 39
    screenData[y * 40 + x] = SPACE_CHAR
  next x
next y
```

### Countdown Loop

```js
for countdown = 10 to 0 step -1
  displayNumber(countdown)
  waitOneSecond()
next countdown
```

### Match Statement (Future Feature)

```ebnf
match_statement = "match" expression statement_terminator
                  { match_case }
                  [ default_case ]
                  "end" "match" statement_terminator ;

match_case = "case" expression ":" statement_terminator statement_block ;
default_case = "case" ":" statement_terminator statement_block ;
```

**Note:** Match statements are planned for future versions but not implemented in v0.1.

**Examples (Future):**

```js
match gameState
case MENU:
  handleMenuInput()
case PLAYING:
  updateGameplay()
case PAUSED:
  handlePauseInput()
case:
  // Default case
  resetToMenu()
end match
```

---

## Import/Export System

### Import Declaration

```ebnf
import_declaration = "import" import_specifier_list "from" qualified_name statement_terminator ;
import_specifier_list = import_specifier { "," import_specifier } ;
import_specifier = identifier [ "as" identifier ] ;
```

**Semantic Rules:**

- Imports must appear before any declarations in the file
- Imported names become available in the current module's scope
- Import source uses qualified name syntax (dot notation)
- Aliasing with `as` allows importing with different local names

**Examples:**

### Single Import

```js
import setSpritePosition from c64.sprites
```

### Multiple Imports

```js
import setSpritePosition, setSpriteColor, enableSprites from c64.sprites
```

### Import with Alias

```js
import setSpritePosition as setPos from c64.sprites
```

### Platform-Specific Imports

```js
import joystickLeft, joystickRight, joystickFire from c64.input
import clearScreen, setTextColor from c64.screen
import playNote, setVolume from c64.sound
```

### Core Library Imports

```js
import abs, min, max from core.math
import copyMemory, fillMemory from core.memory
import length, substring from core.string
```

### Export Declaration

```ebnf
export_declaration = "export" declaration ;
```

**Semantic Rules:**

- Only functions and variables can be exported
- Exported declarations become available to other modules
- Exported names must be unique within the module
- Export makes declarations part of the module's public interface

**Examples:**

### Export Function

```js
export function initPlayer(): void
  playerX = 100
  playerY = 100
  playerHealth = 100
end function
```

### Export Variable

```js
export var playerScore: word = 0
```

### Export with Storage Class

```js
export const var MAX_ENEMIES: byte = 10
export zp var gameRunning: boolean = true
```

### Complete Module Example

```js
module Game.Player
import setSpritePosition from c64.sprites
import random from core.math

// Exported interface
export var playerX: byte
export var playerY: byte
export var playerHealth: byte

export function initPlayer(): void
  playerX = 100
  playerY = 100
  playerHealth = 100
end function

export function updatePlayer(): void
  // Update player position
  playerX += velocityX
  playerY += velocityY

  // Update sprite
  setSpritePosition(0, playerX, playerY)
end function

// Private implementation details
var velocityX: byte = 0
var velocityY: byte = 0

function checkCollisions(): boolean
  // Internal collision detection
  return false
end function
```

---

## Comments

### Line Comments

```ebnf
line_comment = "//" { any_char - newline } newline ;
```

Line comments begin with `//` and continue to the end of the line.

**Examples:**

```js
var counter: byte = 0              // Initialize counter
// This is a full-line comment
setSpritePosition(0, x, y)         // Set player sprite position
```

### Block Comments

```ebnf
block_comment = "/*" { any_char } "*/" ;
```

Block comments begin with `/*` and end with `*/`. They can span multiple lines.

**Examples:**

```js
/*
 * This is a multi-line comment
 * describing the following function
 */
function complexCalculation(): word
  /* Inline block comment */
  return result
end function
```

### Documentation Comments (Convention)

```js
/*
 * Calculate the distance between two points
 * @param x1 First point X coordinate
 * @param y1 First point Y coordinate
 * @param x2 Second point X coordinate
 * @param y2 Second point Y coordinate
 * @returns Distance as word value
 */
function calculateDistance(x1: byte, y1: byte, x2: byte, y2: byte): word
  // Implementation
  return 0
end function
```

---

## Examples

### Hello World

```js
module HelloWorld
import printString from c64.screen

export function main(): void
  printString("Hello, World!")
end function
```

### Simple Game Loop

```js
module Game.Main
import setSpritePosition from c64.sprites
import joystickLeft, joystickRight from c64.input
import clearScreen from c64.screen

export var playerX: byte = 100
export var playerY: byte = 100

export function main(): void
  initializeGame()

  while true
    handleInput()
    updateGame()
    renderGame()
  end while
end function

function initializeGame(): void
  clearScreen()
  setSpritePosition(0, playerX, playerY)
end function

function handleInput(): void
  if joystickLeft() then
    if playerX > 0 then
      playerX -= 2
    end if
  end if

  if joystickRight() then
    if playerX < 320 then
      playerX += 2
    end if
  end if
end function

function updateGame(): void
  setSpritePosition(0, playerX, playerY)
end function

function renderGame(): void
  // Rendering logic here
end function
```

### Memory Management Example

```js
module Game.Memory
import copyMemory from core.memory

// Different storage classes for different purposes
zp var currentIndex: byte = 0          // Fast access counter
ram var workBuffer: byte[256]          // Working memory
data var spriteData: byte[64] = [      // Pre-initialized sprite data
  $00, $7E, $FF, $FF, $FF, $FF, $7E, $00,
  // ... more sprite data
]
const var SCREEN_WIDTH: byte = 40      // Compile-time constant
io var VIC_BACKGROUND: byte            // Hardware register

export function setupMemory(): void
  var i: byte

  // Clear work buffer
  for i = 0 to 255
    workBuffer[i] = 0
  next i

  // Copy sprite data to VIC memory
  copyMemory(spriteData, $2000, 64)

  // Set background color
  VIC_BACKGROUND = $0E
end function
```

### Complex Expression Example

```js
module Game.Physics
import sin, cos from core.math

export function calculateTrajectory(angle: byte, velocity: byte): word
  var vx: byte
  var vy: byte
  var distance: word

  // Calculate velocity components using lookup tables
  vx = (velocity * cos(angle)) >> 8      // Fixed-point math
  vy = (velocity * sin(angle)) >> 8      // Fixed-point math

  // Calculate range using 6502-optimized formula
  distance = (vx * vy * 2) / 9           // Simplified ballistics

  return distance
end function

export function optimizedCollisionCheck(x1: byte, y1: byte,
                                        x2: byte, y2: byte,
                                        threshold: byte): boolean
  var deltaX: byte
  var deltaY: byte
  var distanceSquared: word

  // Calculate deltas with bounds checking
  deltaX = x1 > x2 ? x1 - x2 : x2 - x1
  deltaY = y1 > y2 ? y1 - y2 : y2 - y1

  // Use fast distance approximation (Manhattan + correction)
  distanceSquared = (deltaX * deltaX) + (deltaY * deltaY)

  return distanceSquared < (threshold * threshold)
end function
```

### Advanced C64 Example

```js
module Game.C64Demo
import setSpritePosition, setSpriteColor, enableSprites from c64.sprites
import setBackground, setBorder from c64.vic
import playNote, setVolume from c64.sid
import joystickRead, keyPressed from c64.input

// Game state variables with appropriate storage classes
zp var playerX: byte = 100             // Zero page for frequent access
zp var playerY: byte = 100
zp var frameCounter: byte = 0
ram var enemies: byte[8]               // Enemy positions array
data var colorTable: byte[16] = [      // Pre-initialized color palette
  $00, $01, $02, $03, $04, $05, $06, $07,
  $08, $09, $0A, $0B, $0C, $0D, $0E, $0F
]
const var GAME_SPEED: byte = 2         // Game speed constant
io var RASTER_LINE: byte              // Raster interrupt register

export function gameMain(): void
  initializeGame()

  while true
    // Wait for vertical sync
    while RASTER_LINE != 250
      // Wait for raster line
    end while

    handleInput()
    updateGameLogic()
    renderFrame()

    frameCounter += 1
  end while
end function

function initializeGame(): void
  var i: byte

  // Setup graphics
  setBackground(colorTable[0])
  setBorder(colorTable[1])
  enableSprites($FF)                   // Enable all 8 sprites

  // Initialize enemies
  for i = 0 to 7
    enemies[i] = 50 + (i * 30)        // Spread enemies across screen
    setSpriteColor(i, colorTable[i + 2])
  next i

  // Setup sound
  setVolume(15)
end function

function handleInput(): void
  var joystick: byte = joystickRead()

  // Check joystick directions (bit-packed input)
  if (joystick & $01) != 0 then        // Up
    if playerY > 50 then
      playerY -= GAME_SPEED
    end if
  end if

  if (joystick & $02) != 0 then        // Down
    if playerY < 200 then
      playerY += GAME_SPEED
    end if
  end if

  if (joystick & $04) != 0 then        // Left
    if playerX > 24 then
      playerX -= GAME_SPEED
    end if
  end if

  if (joystick & $08) != 0 then        // Right
    if playerX < 320 then
      playerX += GAME_SPEED
    end if
  end if

  if (joystick & $10) != 0 then        // Fire
    playNote(220)                      // Play sound effect
  end if

  // Check for pause key
  if keyPressed($20) then              // Space bar
    waitForKeyRelease()
  end if
end function

function updateGameLogic(): void
  var i: byte

  // Update enemy positions
  for i = 0 to 7
    enemies[i] += 1
    if enemies[i] > 320 then
      enemies[i] = 0                   // Wrap around screen
    end if

    setSpritePosition(i + 1, enemies[i], 150)
  next i

  // Update player sprite
  setSpritePosition(0, playerX, playerY)

  // Simple collision detection
  for i = 0 to 7
    if abs(playerX - enemies[i]) < 16 and abs(playerY - 150) < 16 then
      // Collision detected
      playNote(110)                    // Lower collision sound
    end if
  next i
end function

function renderFrame(): void
  // Additional rendering logic would go here
  // For now, sprite positions are updated in updateGameLogic
end function

function waitForKeyRelease(): void
  while keyPressed($20)
    // Wait for space key to be released
  end while
end function

function abs(value: byte): byte
  return value >= 128 ? 256 - value : value
end function
```

---

## Error Handling

### Compile-Time Errors

Blend65 performs extensive compile-time checking to catch errors before code generation:

#### Type Errors

```js
var counter: byte = "hello"            // ERROR: Type mismatch
var result: word = add(x)              // ERROR: Wrong number of arguments
```

#### Scope Errors

```js
function test(): void
  var x: byte = undefinedVar           // ERROR: Undefined variable
end function
```

#### Storage Class Errors

```js
const var table: byte[256]             // ERROR: const requires initialization
io var normalVar: byte = 5             // ERROR: io variables cannot be initialized
```

#### Array Bounds Errors

```js
var buffer: byte[256]
var value: byte = buffer[300]          // ERROR: Array index out of bounds (if detectable)
```

### Runtime Error Handling

Blend65 v0.1 has minimal runtime error handling due to 6502 constraints:

#### Array Bounds (Optional Checking)

```js
// Bounds checking can be enabled for debug builds
var buffer: byte[256]
var index: byte = getUserInput()

// Safe array access pattern
if index < 256 then
  buffer[index] = value
end if
```

#### Division by Zero

```js
function safeDivide(a: byte, b: byte): byte
  if b == 0 then
    return 0                           // Or handle error appropriately
  end if
  return a / b
end function
```

### Error Recovery in Parsing

The Blend65 parser attempts to recover from syntax errors:

```js
// Missing 'then' keyword
if x == 5                              // ERROR: Expected 'then'
  y = 10
end if

// Missing 'end' keyword
function test(): void
  var x: byte = 5
// ERROR: Expected 'end function'

// Invalid expression
var result: byte = 5 + + 3             // ERROR: Unexpected operator
```

---

## 6502 Specific Features

### Memory Layout Considerations

Blend65 is designed with 6502 memory architecture in mind:

#### Zero Page Optimization

```js
// Automatic zero page allocation for frequently used variables
zp var fastCounter: byte               // Allocated to $00-$FF range
zp var tempPointer: word               // Uses 2 consecutive zero page bytes

// Manual zero page addressing (advanced feature)
io var ZERO_PAGE_TEMP: byte            // Can be mapped to specific ZP address
```

#### Bank Switching Support (Future)

```js
// Planned for future versions
bank data var largeData: byte[8192]    // Data in switchable memory bank
```

### 6502 Assembly Integration

#### Inline Assembly (Future Feature)

```js
function optimizedCopy(source: word, dest: word, count: byte): void
  // Planned inline assembly syntax
  asm {
    ldy #0
    lda (source),y
    sta (dest),y
    iny
    dec count
    bne *-7
  }
end function
```

#### Hardware Register Access

```js
// Direct hardware register mapping
io var VIC_SPRITE_ENABLE: byte         // $D015 - Sprite enable register
io var VIC_BACKGROUND: byte            // $D020 - Background color
io var SID_FREQUENCY_LO: byte          // $D400 - SID frequency low byte
io var SID_FREQUENCY_HI: byte          // $D401 - SID frequency high byte

function setSIDFrequency(frequency: word): void
  SID_FREQUENCY_LO = frequency & $FF
  SID_FREQUENCY_HI = frequency >> 8
end function
```

### Performance Optimization Features

#### Fast Multiplication and Division

```js
// Compiler recognizes power-of-2 operations
var doubled: byte = value * 2          // Optimized to: ASL
var halved: byte = value / 2           // Optimized to: LSR
var times8: byte = value * 8           // Optimized to: ASL ASL ASL
```

#### Bit Manipulation Optimization

```js
// Efficient bit operations for flags and masks
var flags: byte = 0
flags |= $01                           // Set bit 0: ORA #$01
flags &= ~$02                          // Clear bit 1: AND #$FD
var bit5: boolean = (flags & $20) != 0 // Test bit 5: AND #$20
```

#### Loop Optimization

```js
// Countdown loops are optimized for 6502
for i = 255 to 0 step -1               // Optimized to DEC/BNE loop
  buffer[i] = 0
next i

// Zero page loop counters are automatically used when possible
zp var fastLoop: byte
for fastLoop = 0 to 199                // Uses zero page for speed
  screenMemory[fastLoop] = SPACE_CHAR
next fastLoop
```

### Target-Specific Code Generation

#### C64 Optimizations

```js
// C64-specific optimizations applied automatically
import clearScreen from c64.screen

function fastClearScreen(): void
  // Compiler generates optimized C64 screen clearing code
  clearScreen()                        // Uses C64 ROM routines when available
end function
```

#### Multi-Target Support

```js
// Same source code, different optimizations per target
module Game.Universal

// Compiler selects appropriate implementation per target
import setPixel from target.graphics   // target.* resolved at compile time

function drawPixel(x: byte, y: byte, color: byte): void
  setPixel(x, y, color)                // C64: Uses VIC-II optimizations
end function                           // VIC-20: Uses VIC-I optimizations
                                       // X16: Uses VERA optimizations
```

### Memory Map Awareness

#### Automatic Memory Allocation

```js
// Compiler automatically places variables in appropriate memory regions
var gameData: byte[1000]               // Placed in available RAM
const var lookupTable: byte[256] = [/* data */]  // Placed in ROM area
io var hardware: byte                  // Mapped to hardware addresses
```

#### Memory Conflict Detection

```js
// Compiler detects and prevents memory conflicts
io var CUSTOM_REGISTER: byte           // If address conflicts with system,
                                       // compiler generates warning/error
```

### Stack Management

#### Automatic Stack Usage

```js
function recursiveFunction(depth: byte): byte
  // Compiler manages 6502 stack automatically
  var localVar: byte = depth           // Allocated on stack if needed

  if depth == 0 then
    return 1
  end if

  return depth * recursiveFunction(depth - 1)  // Stack managed automatically
end function
```

#### Stack Overflow Protection (Debug Mode)

```js
// Available in debug builds
function deepRecursion(n: word): word
  // Compiler can insert stack overflow checks
  return n > 0 ? deepRecursion(n - 1) : 0
end function
```

---

## Appendices

### A. Reserved Words Reference

All Blend65 keywords are reserved and cannot be used as identifiers:

```
module    import    export    from      function  end       return
if        then      else      while     for       to        next
match     case      var       type      extends
zp        ram       data      const     io
byte      word      boolean   void      callback
and       or        not       true      false
```

### B. Operator Reference

Complete operator precedence table with 6502 optimization notes:

| Operator         | Description             | 6502 Optimization                  |
| ---------------- | ----------------------- | ---------------------------------- | ------------------------ |
| `()`             | Grouping                | No optimization                    |
| `[]`             | Array access            | Zero page indexing when possible   |
| `*` `/` `%`      | Multiplication/Division | Shift optimization for powers of 2 |
| `+` `-`          | Addition/Subtraction    | 8-bit and 16-bit optimizations     |
| `<<` `>>`        | Bit shifts              | Direct ASL/LSR/ROL/ROR usage       |
| `&` `            | ` `^` `~`               | Bitwise operations                 | Direct AND/ORA/EOR usage |
| `and` `or` `not` | Logical operations      | Short-circuit evaluation           |

### C. Storage Class Memory Map

| Storage Class | Typical Address Range | C64 Example         | Notes             |
| ------------- | --------------------- | ------------------- | ----------------- |
| `zp`          | $00-$FF               | $02-$8F (free area) | Fastest access    |
| `ram`         | $0200-$9FFF           | $0800-$9FFF         | General RAM       |
| `data`        | Varies                | $A000-$BFFF         | Initialized data  |
| `const`       | ROM area              | $C000-$FFFF         | Read-only         |
| `io`          | Hardware registers    | $D000-$DFFF         | Memory-mapped I/O |

---

**End of Specification**

_This document serves as the authoritative reference for the Blend65 language. The parser and lexer implementations should conform to the grammar and semantics described herein._
