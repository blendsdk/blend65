# Functions

> **Status**: Lexer-Derived Specification
> **Last Updated**: January 8, 2026
> **Related Documents**: [Type System](05-type-system.md), [Module System](04-module-system.md), [Expressions & Statements](06-expressions-statements.md)

## Overview

Functions are reusable blocks of code that perform specific tasks. Blend65 functions support parameters, return values, and special features for 6502 interrupt handling.

## Function Declaration Syntax

```ebnf
function_decl = [ "export" ] , [ "callback" ]
              , "function" , identifier
              , "(" , [ parameter_list ] , ")"
              , [ ":" , type_name ]
              , ( ";" | function_body ) ;

function_body = { NEWLINE }
              , { statement , { NEWLINE } }
              , "end" , "function" ;

parameter_list = parameter , { "," , parameter } ;
parameter = identifier , ":" , type_expr ;
```

### Stub Functions

Functions can be declared **without a body** (stub functions) by terminating the signature with a semicolon:

```js
function peek(address: word): byte;
function poke(address: word, value: byte): void;
```

**Stub functions**:

- Have no implementation body
- End with a semicolon (`;`) instead of `end function`
- Declare an interface that must be implemented externally
- Are used for built-in functions, external functions, or forward declarations

**Regular functions** have a body:

```js
function add(a: byte, b: byte): byte
  return a + b;
end function
```

## Basic Function Declaration

### Function with No Parameters

```js
function init(): void
  // Initialize game
end function
```

### Function with Parameters

```js
function add(a: byte, b: byte): byte
  return a + b;
end function
```

### Function with No Return Value

```js
function clearScreen(): void
  // No return statement needed
end function
```

## Parameters

### Parameter Syntax

Parameters must include type annotations:

```js
function setPosition(x: byte, y: byte): void
  playerX = x;
  playerY = y;
end function
```

### Multiple Parameters

```js
function calculate(a: byte, b: byte, c: byte): word
  return (a + b) * c;
end function
```

### Array Parameters

Future feature (not yet fully implemented):

```js
// Future syntax
function processBuffer(data: byte[], size: byte): void
  // ...
end function
```

## Return Statements

### Return with Value

```js
function getScore(): word
  return score;
end function

function calculate(): byte
  let result: byte = a + b;
  return result;
end function
```

### Return Without Value

```js
function update(): void
  playerX += 1;
  return;  // Early return
end function
```

### Multiple Return Paths

```js
function validate(value: byte): boolean
  if value > 100 then
    return false;
  end if

  if value < 0 then
    return false;
  end if

  return true;
end function
```

## Return Type Annotations

### void Return Type

Functions that don't return a value use `void`:

```js
function reset(): void
  score = 0;
  health = 100;
end function
```

### Primitive Return Types

```js
function getByte(): byte
  return 255;
end function

function getWord(): word
  return 65535;
end function

function isValid(): boolean
  return true;
end function
```

## Function Calls

### Calling Functions

```js
// Call function with no parameters
init();

// Call function with parameters
let sum = add(5, 10);
setPosition(100, 50);

// Call function and discard result
calculate(); // Result not used
```

### Nested Calls

```js
let result = add(multiply(2, 3), divide(10, 2));
```

### As Expressions

```js
let total = getScore() + getBonus();
if isValid(value) then
  process();
end if
```

## Exported Functions

### Export Keyword

Functions marked with `export` are visible to other modules:

```js
export function clearScreen(): void
  // Public API
end function
```

### Entry Point: main Function

The **entry point** of a program must be an exported `main` function:

```js
export function main(): void
  // Program starts here
  init();
  gameLoop();
end function
```

If `main` is declared without `export`, the parser automatically exports it with a warning:

```js
function main(): void  // Warning: ImplicitMainExport
  // ...
end function
```

### Module-Level Exports

```js
module Game.Utils

export function abs(x: byte): byte
  if x > 127 then
    return 256 - x;
  end if
  return x;
end function

export function min(a: byte, b: byte): byte
  if a < b then
    return a;
  end if
  return b;
end function
```

## Callback Functions

The `callback` keyword marks functions that can be used as **interrupt handlers** or **function pointers**.

### Callback Declaration

```js
callback function rasterIRQ(): void
  // Interrupt handler
  vicBorderColor = 1;
end function
```

### Callback Properties

- **No parameters** - Callback functions typically have no parameters
- **6502-specific** - Used for IRQ, NMI, and other interrupt vectors
- **Function pointers** - Can be assigned to variables or passed to functions

### Using Callbacks

```js
// Declare callback function
callback function myIRQ(): void
  frameCounter += 1;
end function

// Use as function pointer (future feature)
let handler: callback = myIRQ;
```

### Interrupt Handlers

```js
callback function vblankIRQ(): void
  // Vertical blank interrupt
  updateSprites();
end function

callback function rasterIRQ(): void
  // Raster interrupt at specific scanline
  vicBorderColor = 0;
end function
```

## Function Scope

### Local Variables

Variables declared inside functions are **local** to that function:

```js
function calculate(): byte
  let temp: byte = 10;  // Local variable
  let result: byte = temp * 2;
  return result;
end function

// temp and result are not accessible here
```

### Accessing Module-Level Variables

Functions can access module-level (global) variables:

```js
module Game.Main

@zp let playerX: byte = 10;
@zp let score: word = 0;

function updateScore(): void
  score += 10;  // Access global variable
end function

function movePlayer(): void
  playerX += 1;  // Access global variable
end function
```

### No Nested Functions

Blend65 does **not support nested functions**:

```js
function outer(): void
  // ❌ ERROR: Nested functions not allowed
  function inner(): void
  end function
end function
```

## Complete Examples

### Simple Utility Functions

```js
module Utils.Math

export function min(a: byte, b: byte): byte
  if a < b then
    return a;
  end if
  return b;
end function

export function max(a: byte, b: byte): byte
  if a > b then
    return a;
  end if
  return b;
end function

export function clamp(value: byte, min: byte, max: byte): byte
  if value < min then
    return min;
  end if
  if value > max then
    return max;
  end if
  return value;
end function
```

### Game Logic Functions

```js
module Game.Logic

@zp let playerX: byte = 10;
@zp let playerY: byte = 10;
let enemies: byte[10];

function initPlayer(): void
  playerX = 10;
  playerY = 10;
end function

function movePlayer(dx: byte, dy: byte): void
  playerX += dx;
  playerY += dy;
  checkBounds();
end function

function checkBounds(): void
  if playerX > 40 then
    playerX = 0;
  end if
  if playerY > 25 then
    playerY = 0;
  end if
end function

export function main(): void
  initPlayer();
  while true
    updateGame();
  end while
end function
```

### Callback Functions for Interrupts

```js
module Hardware.IRQ

@zp let frameCount: byte = 0;

callback function vblankIRQ(): void
  // Called every vertical blank
  frameCount += 1;

  if frameCount >= 60 then
    frameCount = 0;
  end if
end function

callback function rasterIRQ(): void
  // Called at specific raster line
  vicBorderColor = frameCount;
end function

export function setupInterrupts(): void
  // Setup interrupt vectors (implementation details)
end function
```

## Function Best Practices

### 1. Use Descriptive Names

```js
// ✅ GOOD: Clear purpose
function calculateDistance(x1: byte, y1: byte, x2: byte, y2: byte): byte
function isColliding(sprite1: byte, sprite2: byte): boolean

// ❌ BAD: Unclear names
function calc(a: byte, b: byte, c: byte, d: byte): byte
function check(s1: byte, s2: byte): boolean
```

### 2. Keep Functions Focused

```js
// ✅ GOOD: Single responsibility
function clearScreen(): void
  // Only clears screen
end function

function initGame(): void
  // Only initializes game state
end function

// ❌ BAD: Multiple responsibilities
function clearScreenAndInitGameAndStartMusic(): void
  // Too many things!
end function
```

### 3. Use Early Returns

```js
// ✅ GOOD: Early return for error cases
function process(value: byte): byte
  if value == 0 then
    return 0;  // Early return
  end if

  // Main logic here
  return compute(value);
end function
```

### 4. Document Complex Functions

```js
// Calculate screen offset for given coordinates
// Parameters:
//   x: Column (0-39)
//   y: Row (0-24)
// Returns: Screen memory offset (0-999)
function getScreenOffset(x: byte, y: byte): word
  return y * 40 + x;
end function
```

### 5. Minimize Parameter Count

```js
// ✅ GOOD: Reasonable parameters
function setPosition(x: byte, y: byte): void

// ⚠️ ACCEPTABLE: Many parameters
function createEnemy(x: byte, y: byte, health: byte, speed: byte, type: byte): void

// ❌ BAD: Too many parameters (consider struct or multiple calls)
function setup(a: byte, b: byte, c: byte, d: byte, e: byte, f: byte, g: byte): void
```

## Function Calling Conventions

### Parameter Passing

Parameters are passed **by value**:

```js
function modify(x: byte): void
  x = 100;  // Modifies local copy, not original
end function

let value: byte = 5;
modify(value);
// value is still 5 (not modified)
```

### Return Value Handling

Return values are typically passed via registers or memory:

```js
let result: byte = calculate();  // Result in accumulator (A register)
let address: word = getAddress();  // Result in ZP or register pair
```

## Function Limitations

Current limitations:

- **No nested functions** - Functions cannot be declared inside other functions
- **No function pointers** (except callback) - Limited function pointer support
- **No variadic parameters** - Fixed parameter count only
- **No default parameters** - All parameters must be provided
- **No function overloading** - One function per name
- **Pass by value only** - No pass by reference

## Implementation Notes

Function parsing and calling is implemented in:

- `packages/compiler/src/parser/` - Parser implementation
- `packages/compiler/src/ast/nodes.ts` - Function AST nodes
- `packages/compiler/src/__tests__/parser/` - Function tests

See [Type System](05-type-system.md) for parameter and return types, and [Module System](04-module-system.md) for export rules.
