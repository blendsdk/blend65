# Expressions and Statements

> **Status**: Lexer-Derived Specification
> **Last Updated**: January 25, 2026
> **Related Documents**: [Type System](05-type-system.md), [Variables](10-variables.md), [Functions](11-functions.md), [Grammar](02-grammar.md)

## Overview

Expressions compute values, and statements perform actions. This document describes both constructs and the control flow structures built upon them.

## Expressions

Expressions are the core of computation in Blend65. Every expression has a **type** and produces a **value**.

### Primary Expressions

Primary expressions are the simplest expression forms.

#### Literals

```js
// Number literals
let x = 255;
let addr = $D000;
let mask = 0b11110000;

// String literals
let msg = 'Hello';

// Boolean literals
let flag = true;
```

#### Identifiers

```js
let x: byte = 10;
let y = x;  // 'x' is an identifier expression
```

#### Parenthesized Expressions

```js
let result = (5 + 3) * 2; // Parentheses control precedence
let complex = (a + b) * (c + d);
```

### Call Expressions

Function calls with optional arguments:

```ebnf
call_expr = primary_expr , "(" , [ argument_list ] , ")" ;
argument_list = expression , { "," , expression } ;
```

**Examples:**

```js
clearScreen();
setPixel(10, 20);
calculateDistance(x1, y1, x2, y2);
```

### Index Expressions

Array element access:

```ebnf
index_expr = primary_expr , "[" , expression , "]" ;
```

**Examples:**

```js
let value = buffer[0];
buffer[i] = 255;
screenRAM[y * 40 + x] = 160;
```

### Member Access

Access members of qualified names or memory-mapped structs:

```ebnf
member_expr = primary_expr , "." , identifier ;
```

**Examples:**

```js
let state = GameState.MENU;
vic.borderColor = 0;
enemy[0].health = 100;
```

### Ternary Conditional Expression

The ternary operator provides inline conditional evaluation:

```ebnf
conditional_expr = logical_or_expr , [ "?" , expression , ":" , conditional_expr ] ;
```

**Examples:**

```js
// Simple ternary
let max = (a > b) ? a : b;

// Ternary with expressions
let status = (health > 0) ? "alive" : "dead";

// Nested ternary (use sparingly for readability)
let grade = (score > 90) ? "A" : (score > 80) ? "B" : (score > 70) ? "C" : "F";

// Ternary in expressions
let offset = (isLarge) ? 100 : 50;
let position = baseX + ((direction > 0) ? speed : -speed);
```

**Semantics:**
- The condition is evaluated first
- If true, the "then" expression (after `?`) is evaluated and returned
- If false, the "else" expression (after `:`) is evaluated and returned
- Both branches must have compatible types
- The ternary operator is right-associative

### Array Literal Expressions

Array literals provide a concise syntax for initializing arrays inline with values.

```ebnf
array_literal = "[" , [ expression_list ] , "]" ;
expression_list = expression , { "," , expression } , [ "," ] ;
```

**Basic Examples:**

```js
// Empty array
let empty: byte[0] = [];

// Single element
let single: byte[1] = [42];

// Multiple elements
let colors: byte[3] = [2, 5, 6];
let values: word[5] = [100, 200, 300, 400, 500];
```

**With Expressions:**

```js
// Variables and expressions
let positions: byte[3] = [x, y + 1, z * 2];

// Function calls
let results: byte[2] = [calculate(1), calculate(2)];

// Member access
let coords: byte[2] = [player.x, player.y];

// Address-of operator
let addresses: word[2] = [@buffer, @screen];
```

**Nested Arrays (Multidimensional):**

```js
// 2D arrays
let matrix: byte[2][2] = [[1, 2], [3, 4]];

// 3D arrays
let cube: byte[2][2][2] = [
    [[1, 2], [3, 4]],
    [[5, 6], [7, 8]]
];
```

**C64-Specific Examples:**

```js
// Sprite data (63 bytes per sprite)
@data const spriteData: byte[63] = [
    0xFF, 0x3C, 0x18, 0x18, 0x18, 0x3C, 0xFF, 0x00,
    0x18, 0x24, 0x42, 0x81, 0x42, 0x24, 0x18, 0x00,
    // ... more sprite data ...
];

// Color palette
const palette: byte[16] = [
    0,  // Black
    1,  // White
    2,  // Red
    5,  // Green
    6,  // Blue
    // ... more colors ...
];

// Sine wave lookup table
@data const sineTable: byte[256] = [/* precomputed values */];

// C64 screen layout (25 rows × 40 columns)
let tilemap: byte[25][40] = [
    [1, 1, 1, 1, /* ... */],  // Row 0
    [1, 0, 0, 0, /* ... */],  // Row 1
    // ... more rows ...
];
```

**Trailing Commas:**

Trailing commas are allowed for easier multi-line editing:

```js
let values: byte[3] = [
    1,
    2,
    3,  // Trailing comma allowed
];
```

**Implementation Notes:**

Array literals are syntactic sugar for array initialization. Multidimensional arrays like `byte[25][40]` are compiled to flat arrays with calculated offsets for 6502 efficiency:

```js
// Developer writes:
let screen: byte[25][40];
screen[row][col] = 160;

// Compiler treats as:
let screen: byte[1000];  // 25 * 40 = 1000
screen[row * 40 + col] = 160;  // Offset calculation optimized
```

**Type Compatibility:**

Array elements must be compatible with the declared array type (validated during semantic analysis phase).

## Operators

Blend65 provides a comprehensive set of operators for arithmetic, comparison, logical, and bitwise operations.

### Arithmetic Operators

| Operator | Description    | Example |
| -------- | -------------- | ------- |
| `+`      | Addition       | `a + b` |
| `-`      | Subtraction    | `a - b` |
| `*`      | Multiplication | `a * b` |
| `/`      | Division       | `a / b` |
| `%`      | Modulo         | `a % b` |

**Examples:**

```js
let sum = a + b;
let diff = x - 5;
let product = width * height;
let quotient = total / count;
let remainder = value % 10;
```

### Comparison Operators

| Operator | Description      | Example  |
| -------- | ---------------- | -------- |
| `==`     | Equal            | `a == b` |
| `!=`     | Not equal        | `a != b` |
| `<`      | Less than        | `a < b`  |
| `<=`     | Less or equal    | `a <= b` |
| `>`      | Greater than     | `a > b`  |
| `>=`     | Greater or equal | `a >= b` |

**Examples:**

```js
if (x == 10) {
    doSomething();
}
if (score != 0) {
    updateScore();
}
if (health < 50) {
    showWarning();
}
if (count >= 100) {
    finish();
}
```

### Logical Operators

| Operator | Description | Example    |
| -------- | ----------- | ---------- |
| `&&`     | Logical AND | `a && b`   |
| `\|\|`   | Logical OR  | `a \|\| b` |
| `!`      | Logical NOT | `!a`       |

**Examples:**

```js
if (running && !paused) {
    update();
}
if (x < 0 || x > 320) {
    handleOutOfBounds();
}
if (!gameOver) {
    continueGame();
}
```

### Bitwise Operators

| Operator | Description | Example  |
| -------- | ----------- | -------- |
| `&`      | Bitwise AND | `a & b`  |
| `\|`     | Bitwise OR  | `a \| b` |
| `^`      | Bitwise XOR | `a ^ b`  |
| `~`      | Bitwise NOT | `~a`     |
| `<<`     | Left shift  | `a << b` |
| `>>`     | Right shift | `a >> b` |

**Examples:**

```js
let masked = value & 0b11110000;
let combined = flags | 0b00000001;
let toggled = state ^ 0b00000100;
let inverted = ~mask;
let shifted = value << 1;
let halved = value >> 1;
```

### Address-Of Operator

The address-of operator (`@`) returns the memory address of a variable as a 16-bit word.

| Operator | Description | Example       | Returns    |
| -------- | ----------- | ------------- | ---------- |
| `@`      | Address-of  | `@myVariable` | `@address` |

**Syntax:**

```ebnf
address_of_expr = "@" , identifier ;
```

**Type:** The address-of operator returns type `@address`, which is a built-in type alias for `word`.

**Examples:**

```js
// Get address of variables
@ram let buffer: byte[256];
@zp let counter: byte = 0;
@map vicBorderColor at $D020: byte;

let bufferAddr: @address = @buffer;        // Address of array
let counterAddr: @address = @counter;      // Address of scalar
let vicAddr: @address = @vicBorderColor;   // Address of memory-mapped var

// Type compatibility: @address and word are interchangeable
let wordAddr: word = @buffer;              // ✅ Valid - same type
let addrValue: @address = 0xD020;          // ✅ Valid - can assign word to @address
```

**Usage with Generic Functions:**

```js
// Generic memory manipulation using address-of
function copyMemory(src: @address, dst: @address, len: byte): void {
    for (i = 0 to len - 1) {
        poke(dst + i, peek(src + i));
    }
}

// Usage
@data const spriteData: byte[63] = [...];
@ram let activeSprite: byte[63];

copyMemory(@spriteData, @activeSprite, 63);  // Pass addresses directly
```

**Restrictions:**

- Can only be applied to **variables** (local, global, memory-mapped)
- Cannot be applied to **literals**: `@5` ❌ (compile error)
- Cannot be applied to **expressions**: `@(x + y)` ❌ (compile error)
- Cannot be applied to **function names** (use callback syntax instead)

### @address Type

`@address` is a **built-in type alias** for `word`. It provides self-documenting code when working with memory addresses.

**Type Equivalence:**

```js
@address ≡ word  // These types are identical
```

**Usage:**

```js
// Function parameters - clearly indicates intent
function fillMemory(addr: @address, len: word, value: byte): void {
    for (i = 0 to len - 1) {
        poke(addr + i, value);
    }
}

// Variables
let screenAddr: @address = 0x0400;         // Screen RAM base address
let spriteAddr: @address = @spriteData;    // Address from address-of operator

// Arithmetic (addresses are 16-bit numbers)
let nextAddr: @address = screenAddr + 40;  // Next screen line
```

### Assignment Operators

| Operator | Description        | Equivalent To |
| -------- | ------------------ | ------------- |
| `=`      | Assignment         | N/A           |
| `+=`     | Add assign         | `a = a + b`   |
| `-=`     | Subtract assign    | `a = a - b`   |
| `*=`     | Multiply assign    | `a = a * b`   |
| `/=`     | Divide assign      | `a = a / b`   |
| `%=`     | Modulo assign      | `a = a % b`   |
| `&=`     | AND assign         | `a = a & b`   |
| `\|=`    | OR assign          | `a = a \| b`  |
| `^=`     | XOR assign         | `a = a ^ b`   |
| `<<=`    | Left shift assign  | `a = a << b`  |
| `>>=`    | Right shift assign | `a = a >> b`  |

**Examples:**

```js
x = 10;
score += 100;
health -= 10;
counter *= 2;
flags |= 0b00000001;
mask &= 0b11111110;
```

## Operator Precedence

From **highest to lowest** precedence:

| Level | Operators                       | Associativity | Description                       |
| ----- | ------------------------------- | ------------- | --------------------------------- |
| 1     | `()` `[]` `.`                   | Left-to-right | Grouping, indexing, member access |
| 2     | `!` `~` unary `+` unary `-` `@` | Right-to-left | Unary operators                   |
| 3     | `*` `/` `%`                     | Left-to-right | Multiplicative                    |
| 4     | `+` `-`                         | Left-to-right | Additive                          |
| 5     | `<<` `>>`                       | Left-to-right | Shift                             |
| 6     | `<` `<=` `>` `>=`               | Left-to-right | Relational                        |
| 7     | `==` `!=`                       | Left-to-right | Equality                          |
| 8     | `&`                             | Left-to-right | Bitwise AND                       |
| 9     | `^`                             | Left-to-right | Bitwise XOR                       |
| 10    | `\|`                            | Left-to-right | Bitwise OR                        |
| 11    | `&&`                            | Left-to-right | Logical AND                       |
| 12    | `\|\|`                          | Left-to-right | Logical OR                        |
| 13    | `?:`                            | Right-to-left | Ternary conditional               |
| 14    | `=` `+=` `-=` etc.              | Right-to-left | Assignment                        |

**Examples:**

```js
let result = a + b * c;         // Multiplication first: a + (b * c)
let mask = x & 0xFF == y;       // AND first: (x & 0xFF) == y
let flag = !a || b;             // NOT first: (!a) || b
let max = (a > b) ? a : b;      // Ternary: condition evaluated, then branch
```

## Statements

Statements perform actions and control program flow. In Blend65, **statements require semicolons** unless they are self-terminating block structures.

### Variable Declaration Statement

```ebnf
variable_decl = [ storage_class ] , ( "let" | "const" ) , identifier
              , [ ":" , type_expr ]
              , [ "=" , expression ] , ";" ;
```

**Examples:**

```js
let x: byte = 10;
let buffer: byte[256];
const MAX: byte = 100;
@zp let counter: byte = 0;
```

See [Variables](10-variables.md) for details.

### Assignment Statement

```ebnf
assignment_stmt = lvalue , assignment_op , expression , ";" ;
lvalue = identifier | index_expr | member_expr ;
```

**Examples:**

```js
x = 10;
buffer[i] = 255;
vic.borderColor = 0;
score += 100;
```

### Expression Statement

Any expression followed by a semicolon:

```ebnf
expr_stmt = expression , ";" ;
```

**Examples:**

```js
clearScreen();
updatePlayer();
x + y;   // Valid but useless (result discarded)
```

### Return Statement

```ebnf
return_stmt = "return" , [ expression ] , ";" ;
```

**Examples:**

```js
return;           // Return from void function
return value;     // Return value
return a + b;     // Return expression result
```

### Break and Continue

Used in loops:

```ebnf
break_stmt = "break" , ";" ;
continue_stmt = "continue" , ";" ;
```

**Examples:**

```js
for (i = 0 to 10) {
    if (i == 5) {
        break;      // Exit loop
    }
    if (i == 3) {
        continue;   // Skip to next iteration
    }
}
```

## Control Flow

Control flow statements alter the execution order of the program. Blend65 uses C-style syntax with curly braces `{ }` for blocks.

### If Statement

Conditional execution based on a boolean expression.

```ebnf
if_stmt = "if" , "(" , expression , ")" , "{"
        , { statement }
        , "}"
        , [ else_clause ] ;

else_clause = "else" , ( if_stmt | "{" , { statement } , "}" ) ;
```

**Basic if:**

```js
if (x > 10) {
    doSomething();
}
```

**If-else:**

```js
if (health <= 0) {
    gameOver();
} else {
    continueGame();
}
```

**If-else if-else:**

```js
if (score > 1000) {
    showGold();
} else if (score > 500) {
    showSilver();
} else if (score > 100) {
    showBronze();
} else {
    showNothing();
}
```

**Multiple else if branches:**

```js
if (gameState == 0) {
    showMenu();
} else if (gameState == 1) {
    playGame();
} else if (gameState == 2) {
    showPause();
} else {
    reset();
}
```

**Nested if-else (also valid):**

```js
if (score > 1000) {
    showGold();
} else {
    if (score > 500) {
        showSilver();
    } else {
        showBronze();
    }
}
```

### While Loop

Repeat while condition is true.

```ebnf
while_stmt = "while" , "(" , expression , ")" , "{"
           , { statement }
           , "}" ;
```

**Examples:**

```js
while (running) {
    update();
    render();
}

while (x < 100) {
    x += 1;
}
```

**Infinite loop:**

```js
while (true) {
    gameLoop();
}
```

### Do-While Loop

Execute body at least once, then repeat while condition is true.

```ebnf
do_while_stmt = "do" , "{"
              , { statement }
              , "}" , "while" , "(" , expression , ")" , ";" ;
```

**Note:** The do-while statement requires a semicolon after the closing parenthesis.

**Examples:**

```js
// Process at least once
do {
    processInput();
    x += 1;
} while (x < 10);

// Wait for input (executes at least once)
do {
    key = readKeyboard();
} while (key == 0);

// Menu loop (always shows at least once)
do {
    showMenu();
    choice = getChoice();
} while (choice != EXIT);
```

**When to use do-while vs while:**
- Use `while` when the condition might be false initially (0 or more iterations)
- Use `do-while` when you need at least one iteration (1 or more iterations)

### For Loop

Counted loop with explicit counter, supporting `to`, `downto`, and `step`.

```ebnf
for_stmt = "for" , "(" , identifier , "=" , expression
         , ( "to" | "downto" ) , expression
         , [ "step" , expression ]
         , ")" , "{"
         , { statement }
         , "}" ;
```

**Basic for loop (counting up):**

```js
for (i = 0 to 10) {
    buffer[i] = 0;
}

for (x = 1 to 100) {
    process(x);
}
```

**For loop counting down:**

```js
for (count = 10 downto 0) {
    countdown(count);
}

for (i = 255 downto 0) {
    fadeOut(i);
}
```

**For loop with step:**

```js
// Count by 2
for (i = 0 to 100 step 2) {
    processEven(i);
}

// Count by 5
for (x = 0 to 50 step 5) {
    drawMark(x);
}

// Count down by 10
for (y = 100 downto 0 step 10) {
    drawLine(y);
}
```

**Nested loops:**

```js
for (y = 0 to 24) {
    for (x = 0 to 39) {
        screenRAM[y * 40 + x] = 32;
    }
}
```

**Loop behavior:**
- `to`: Counts from start up to end (inclusive)
- `downto`: Counts from start down to end (inclusive)
- `step`: Specifies the increment/decrement amount (default is 1)

### Switch Statement

Pattern matching (similar to C switch/case).

```ebnf
switch_stmt = "switch" , "(" , expression , ")" , "{"
            , { case_clause }
            , [ default_clause ]
            , "}" ;

case_clause = "case" , expression , ":"
            , { statement } ;

default_clause = "default" , ":"
               , { statement } ;
```

**Examples:**

```js
switch (gameState) {
    case GameState.MENU:
        showMenu();
    case GameState.PLAYING:
        updateGame();
    case GameState.PAUSED:
        showPause();
    default:
        handleError();
}
```

**With multiple statements per case:**

```js
switch (direction) {
    case Direction.UP:
        playerY -= 1;
        checkBounds();
    case Direction.DOWN:
        playerY += 1;
        checkBounds();
    case Direction.LEFT:
        playerX -= 1;
        checkBounds();
    case Direction.RIGHT:
        playerX += 1;
        checkBounds();
}
```

**Using break for explicit fall-through control:**

```js
switch (key) {
    case KEY_W:
    case KEY_UP:
        moveUp();
        break;
    case KEY_S:
    case KEY_DOWN:
        moveDown();
        break;
    default:
        // Unknown key
}
```

## Statement Blocks

Statements are grouped in blocks using curly braces `{ }`:

```js
if (condition) {
    // Block of statements
    statement1();
    statement2();
    statement3();
}
```

## Complete Examples

### Expression Evaluation

```js
// Complex expression with multiple operators
let screenOffset: word = (y * 40) + x;
let colorValue: byte = (red << 4) | (green & 0x0F);
let inBounds: boolean = (x >= 0) && (x < 320) && (y >= 0) && (y < 200);

// Ternary expressions
let max: byte = (a > b) ? a : b;
let sign: byte = (value >= 0) ? 1 : -1;
```

### Control Flow Example

```js
module Game.Example;

@zp let playerX: byte = 10;
@zp let playerY: byte = 10;
@zp let health: byte = 100;
@zp let score: word = 0;

function updatePlayer(): void {
    // Check health
    if (health <= 0) {
        gameOver();
        return;
    }

    // Update position
    playerX += 1;
    if (playerX > 40) {
        playerX = 0;
    }

    // Update score
    score += 10;
}

function gameLoop(): void {
    while (true) {
        updatePlayer();

        // Check for collisions
        for (i = 0 to 9) {
            if (checkCollision(i)) {
                health -= 10;
                break;
            }
        }

        // Handle state using switch
        switch (gameState) {
            case GameState.PLAYING:
                continueGame();
            case GameState.PAUSED:
                showPauseMenu();
            default:
                reset();
        }
    }
}
```

### Loop Examples

```js
// Initialize array
for (i = 0 to 255) {
    buffer[i] = 0;
}

// Search for value
let found: boolean = false;
for (i = 0 to 99) {
    if (data[i] == target) {
        found = true;
        break;
    }
}

// Skip even numbers
for (i = 0 to 10) {
    if (i % 2 == 0) {
        continue;
    }
    processOdd(i);
}

// Count down with step
for (brightness = 255 downto 0 step 5) {
    setBrightness(brightness);
    delay(10);
}

// Process input at least once
do {
    input = readInput();
    processInput(input);
} while (input != QUIT);
```

### Ternary Expression Examples

```js
// Simple max/min
let max: byte = (a > b) ? a : b;
let min: byte = (a < b) ? a : b;

// Absolute value
let abs: byte = (value >= 0) ? value : -value;

// Clamp value
let clamped: byte = (value > MAX) ? MAX : (value < MIN) ? MIN : value;

// Direction multiplier
let dx: byte = (direction == RIGHT) ? 1 : (direction == LEFT) ? -1 : 0;

// Inline in expression
let newX: byte = x + ((movingRight) ? speed : -speed);
```

## Statement Termination Rules

### Semicolons Required

These statements **require semicolons**:

- ✅ Variable declarations: `let x: byte = 5;`
- ✅ Assignments: `x = 10;`
- ✅ Expression statements: `clearScreen();`
- ✅ Return: `return value;`
- ✅ Break: `break;`
- ✅ Continue: `continue;`
- ✅ Do-while: `do { } while (cond);`

### Semicolons Not Required

These statements are **self-terminating** with curly braces:

- ❌ If statements: `if (x) { }`
- ❌ While loops: `while (x) { }`
- ❌ For loops: `for (i = 0 to 10) { }`
- ❌ Switch statements: `switch (x) { }`
- ❌ Function declarations: `function f() { }`

## Best Practices

### 1. Use Parentheses for Clarity

```js
// ✅ GOOD: Clear intent
let result = (a + b) * (c + d);

// ❌ UNCLEAR: Relies on precedence knowledge
let result = a + b * c + d;
```

### 2. Use Ternary Sparingly

```js
// ✅ GOOD: Simple ternary
let max = (a > b) ? a : b;

// ❌ COMPLEX: Hard to read nested ternary
let result = (a > b) ? (c > d) ? (e > f) ? x : y : z : w;

// ✅ BETTER: Use if-else for complex conditions
if (a > b) {
    if (c > d) {
        result = (e > f) ? x : y;
    } else {
        result = z;
    }
} else {
    result = w;
}
```

### 3. Avoid Complex Expressions

```js
// ✅ GOOD: Break into steps
let baseAddr = y * 40;
let offset = baseAddr + x;
screenRAM[offset] = char;

// ❌ COMPLEX: Hard to read
screenRAM[y * 40 + x] = char;
```

### 4. Use Meaningful Variable Names in Loops

```js
// ✅ GOOD: Clear purpose
for (spriteIndex = 0 to 7) {
    updateSprite(spriteIndex);
}

// ❌ UNCLEAR: Generic name
for (i = 0 to 7) {
    updateSprite(i);
}
```

### 5. Early Return for Error Conditions

```js
// ✅ GOOD: Early return
function process(value: byte): byte {
    if (value == 0) {
        return 0;
    }

    // Main logic here
    return compute(value);
}
```

### 6. Use do-while for Input Validation

```js
// ✅ GOOD: Ensure at least one read
do {
    input = readInput();
} while (!isValid(input));
```

## Implementation Notes

Expression and statement parsing is implemented in:

- `packages/compiler/src/parser/` - Parser implementation
- `packages/compiler/src/parser/precedence.ts` - Operator precedence
- `packages/compiler/src/__tests__/parser/` - Parser tests

See [Grammar](02-grammar.md) for complete EBNF grammar.