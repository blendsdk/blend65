# Functions

> **Status**: C-Style Syntax Specification
> **Last Updated**: January 25, 2026
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

function_body = "{" , { statement } , "}" ;

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
- End with a semicolon (`;`) instead of a body block
- Declare an interface that must be implemented externally
- Are used for built-in functions, external functions, or forward declarations

**Regular functions** have a body with curly braces:

```js
function add(a: byte, b: byte): byte {
  return a + b;
}
```

## Basic Function Declaration

### Function with No Parameters

```js
function init(): void {
  // Initialize game
}
```

### Function with Parameters

```js
function add(a: byte, b: byte): byte {
  return a + b;
}
```

### Function with No Return Value

```js
function clearScreen(): void {
  // No return statement needed
}
```

## Parameters

### Parameter Syntax

Parameters must include type annotations:

```js
function setPosition(x: byte, y: byte): void {
  playerX = x;
  playerY = y;
}
```

### Multiple Parameters

```js
function calculate(a: byte, b: byte, c: byte): word {
  return (a + b) * c;
}
```

### Array Parameters

Future feature (not yet fully implemented):

```js
// Future syntax
function processBuffer(data: byte[], size: byte): void {
  // ...
}
```

## Return Statements

### Return with Value

```js
function getScore(): word {
  return score;
}

function calculate(): byte {
  let result: byte = a + b;
  return result;
}
```

### Return Without Value

```js
function update(): void {
  playerX += 1;
  return;  // Early return
}
```

### Multiple Return Paths

```js
function validate(value: byte): boolean {
  if (value > 100) {
    return false;
  }

  if (value < 0) {
    return false;
  }

  return true;
}
```

## Return Type Annotations

### void Return Type

Functions that don't return a value use `void`:

```js
function reset(): void {
  score = 0;
  health = 100;
}
```

### Primitive Return Types

```js
function getByte(): byte {
  return 255;
}

function getWord(): word {
  return 65535;
}

function isValid(): boolean {
  return true;
}
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
if (isValid(value)) {
  process();
}
```

## Exported Functions

### Export Keyword

Functions marked with `export` are visible to other modules:

```js
export function clearScreen(): void {
  // Public API
}
```

### Entry Point: main Function

The **entry point** of a program must be an exported `main` function:

```js
export function main(): void {
  // Program starts here
  init();
  gameLoop();
}
```

If `main` is declared without `export`, the parser automatically exports it with a warning:

```js
function main(): void {  // Warning: ImplicitMainExport
  // ...
}
```

### Module-Level Exports

```js
module Game.Utils;

export function abs(x: byte): byte {
  if (x > 127) {
    return 256 - x;
  }
  return x;
}

export function min(a: byte, b: byte): byte {
  if (a < b) {
    return a;
  }
  return b;
}
```

## Callback Functions

The `callback` keyword marks functions that can be used as **interrupt handlers** or **function pointers**.

### Callback Declaration

```js
callback function rasterIRQ(): void {
  // Interrupt handler
  vicBorderColor = 1;
}
```

### Callback Properties

- **No parameters** - Callback functions typically have no parameters
- **6502-specific** - Used for IRQ, NMI, and other interrupt vectors
- **Function pointers** - Can be assigned to variables or passed to functions

### Using Callbacks

```js
// Declare callback function
callback function myIRQ(): void {
  frameCounter += 1;
}

// Use as function pointer (future feature)
let handler: callback = myIRQ;
```

### Interrupt Handlers

```js
callback function vblankIRQ(): void {
  // Vertical blank interrupt
  updateSprites();
}

callback function rasterIRQ(): void {
  // Raster interrupt at specific scanline
  vicBorderColor = 0;
}
```

## Function Scope

### Local Variables

Variables declared inside functions are **local** to that function:

```js
function calculate(): byte {
  let temp: byte = 10;  // Local variable
  let result: byte = temp * 2;
  return result;
}

// temp and result are not accessible here
```

### Accessing Module-Level Variables

Functions can access module-level (global) variables:

```js
module Game.Main;

@zp let playerX: byte = 10;
@zp let score: word = 0;

function updateScore(): void {
  score += 10;  // Access global variable
}

function movePlayer(): void {
  playerX += 1;  // Access global variable
}
```

### No Nested Functions

Blend65 does **not support nested functions**:

```js
function outer(): void {
  // ❌ ERROR: Nested functions not allowed
  function inner(): void {
  }
}
```

## Complete Examples

### Simple Utility Functions

```js
module Utils.Math;

export function min(a: byte, b: byte): byte {
  if (a < b) {
    return a;
  }
  return b;
}

export function max(a: byte, b: byte): byte {
  if (a > b) {
    return a;
  }
  return b;
}

export function clamp(value: byte, min: byte, max: byte): byte {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
```

### Game Logic Functions

```js
module Game.Logic;

@zp let playerX: byte = 10;
@zp let playerY: byte = 10;
let enemies: byte[10];

function initPlayer(): void {
  playerX = 10;
  playerY = 10;
}

function movePlayer(dx: byte, dy: byte): void {
  playerX += dx;
  playerY += dy;
  checkBounds();
}

function checkBounds(): void {
  if (playerX > 40) {
    playerX = 0;
  }
  if (playerY > 25) {
    playerY = 0;
  }
}

export function main(): void {
  initPlayer();
  while (true) {
    updateGame();
  }
}
```

### Callback Functions for Interrupts

```js
module Hardware.IRQ;

@zp let frameCount: byte = 0;

callback function vblankIRQ(): void {
  // Called every vertical blank
  frameCount += 1;

  if (frameCount >= 60) {
    frameCount = 0;
  }
}

callback function rasterIRQ(): void {
  // Called at specific raster line
  vicBorderColor = frameCount;
}

export function setupInterrupts(): void {
  // Setup interrupt vectors (implementation details)
}
```

## Function Best Practices

### 1. Use Descriptive Names

```js
// ✅ GOOD: Clear purpose
function calculateDistance(x1: byte, y1: byte, x2: byte, y2: byte): byte {
  // ...
}

function isColliding(sprite1: byte, sprite2: byte): boolean {
  // ...
}

// ❌ BAD: Unclear names
function calc(a: byte, b: byte, c: byte, d: byte): byte {
  // ...
}

function check(s1: byte, s2: byte): boolean {
  // ...
}
```

### 2. Keep Functions Focused

```js
// ✅ GOOD: Single responsibility
function clearScreen(): void {
  // Only clears screen
}

function initGame(): void {
  // Only initializes game state
}

// ❌ BAD: Multiple responsibilities
function clearScreenAndInitGameAndStartMusic(): void {
  // Too many things!
}
```

### 3. Use Early Returns

```js
// ✅ GOOD: Early return for error cases
function process(value: byte): byte {
  if (value == 0) {
    return 0;  // Early return
  }

  // Main logic here
  return compute(value);
}
```

### 4. Document Complex Functions

```js
// Calculate screen offset for given coordinates
// Parameters:
//   x: Column (0-39)
//   y: Row (0-24)
// Returns: Screen memory offset (0-999)
function getScreenOffset(x: byte, y: byte): word {
  return y * 40 + x;
}
```

### 5. Minimize Parameter Count

```js
// ✅ GOOD: Reasonable parameters
function setPosition(x: byte, y: byte): void {
  // ...
}

// ⚠️ ACCEPTABLE: Many parameters
function createEnemy(x: byte, y: byte, health: byte, speed: byte, type: byte): void {
  // ...
}

// ❌ BAD: Too many parameters (consider struct or multiple calls)
function setup(a: byte, b: byte, c: byte, d: byte, e: byte, f: byte, g: byte): void {
  // ...
}
```

## Function Calling Conventions

### Parameter Passing

Parameters are passed **by value**:

```js
function modify(x: byte): void {
  x = 100;  // Modifies local copy, not original
}

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