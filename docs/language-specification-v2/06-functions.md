# Functions

> **Status**: Draft
> **Related Documents**: [Types](02-types.md), [Modules](07-modules.md), [Statements](05-statements.md)

## Overview

Functions are reusable blocks of code that perform specific tasks. Blend65 functions support parameters, return values, and special features for 6502 interrupt handling.

**Important Restriction**: Due to Static Frame Allocation, **recursion is not allowed**. See [Recursion Prohibition](#recursion-prohibition) section.

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

## Recursion Prohibition

**⚠️ IMPORTANT: Blend65 does NOT support recursion.**

Due to the **Static Frame Allocation (SFA)** architecture, recursion (both direct and indirect) is **forbidden** and will result in a compile-time error.

### Why No Recursion?

Blend65 uses SFA where each function has a **single, static memory frame** allocated at compile time. Recursive calls would overwrite this frame, corrupting data.

```js
// ❌ COMPILE ERROR: Direct recursion not allowed
function factorial(n: byte): word {
  if (n <= 1) return 1;
  return n * factorial(n - 1);  // ERROR: Recursion detected
}

// ❌ COMPILE ERROR: Indirect recursion not allowed
function funcA(): void {
  funcB();
}

function funcB(): void {
  funcA();  // ERROR: Cycle detected (funcA → funcB → funcA)
}
```

### Use Iteration Instead

All recursive algorithms can be rewritten using iteration:

```js
// ✅ CORRECT: Use iteration
function factorial(n: byte): word {
  let result: word = 1;
  for (let i: byte = 2; i <= n; i += 1) {
    result = result * i;
  }
  return result;
}

// ✅ CORRECT: Fibonacci with iteration
function fibonacci(n: byte): word {
  if (n <= 1) return n;
  
  let prev: word = 0;
  let curr: word = 1;
  for (let i: byte = 2; i <= n; i += 1) {
    let next: word = prev + curr;
    prev = curr;
    curr = next;
  }
  return curr;
}
```

### Error Message

When recursion is detected, the compiler produces an error:

```
error[E0100]: Recursion not allowed
  --> main.blend:5:3
   |
 5 |   return n * factorial(n - 1);
   |              ^^^^^^^^^ function 'factorial' calls itself recursively
   |
   = note: Blend65 uses static frame allocation which doesn't support recursion
   = help: Use iteration instead of recursion
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

If `main` is declared without `export`, the parser automatically exports it with a warning.

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
  poke($D020, 1);
}
```

### Callback Properties

- **No parameters** - Callback functions typically have no parameters
- **6502-specific** - Used for IRQ, NMI, and other interrupt vectors
- **Function pointers** - Can be assigned to variables

### Using Callbacks

```js
// Declare callback function
callback function myIRQ(): void {
  frameCounter += 1;
}

// Use as function pointer
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
  poke($D020, 0);
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

export function clamp(value: byte, minVal: byte, maxVal: byte): byte {
  if (value < minVal) {
    return minVal;
  }
  if (value > maxVal) {
    return maxVal;
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

## Function Best Practices

### 1. Use Descriptive Names

```js
// ✅ GOOD: Clear purpose
function calculateDistance(x1: byte, y1: byte, x2: byte, y2: byte): byte {
  // ...
}

// ❌ BAD: Unclear names
function calc(a: byte, b: byte, c: byte, d: byte): byte {
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

### 4. Remember: No Recursion!

```js
// ✅ GOOD: Iterative approach
function power(base: byte, exp: byte): word {
  let result: word = 1;
  for (let i: byte = 0; i < exp; i += 1) {
    result = result * base;
  }
  return result;
}

// ❌ BAD: Recursive approach (compile error!)
// function power(base: byte, exp: byte): word {
//   if (exp == 0) return 1;
//   return base * power(base, exp - 1);  // ERROR!
// }
```

## Function Limitations

Current limitations:

- **No recursion** - Direct or indirect recursion is forbidden (SFA)
- **No nested functions** - Functions cannot be declared inside other functions
- **No variadic parameters** - Fixed parameter count only
- **No default parameters** - All parameters must be provided
- **No function overloading** - One function per name
- **Pass by value only** - No pass by reference