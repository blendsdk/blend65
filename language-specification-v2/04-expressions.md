# Expressions

> **Status**: Draft
> **Related Documents**: [Statements](05-statements.md), [Types](02-types.md), [Variables](03-variables.md)

## Overview

Expressions are the core of computation in Blend65. Every expression has a **type** and produces a **value**.

## Primary Expressions

Primary expressions are the simplest expression forms.

### Literals

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

### Identifiers

```js
let x: byte = 10;
let y = x;  // 'x' is an identifier expression
```

### Parenthesized Expressions

```js
let result = (5 + 3) * 2; // Parentheses control precedence
let complex = (a + b) * (c + d);
```

## Call Expressions

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

// Intrinsic calls
poke($D020, 14);
let color = peek($D020);
```

## Index Expressions

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

## Member Access

Access members of qualified names or enums:

```ebnf
member_expr = primary_expr , "." , identifier ;
```

**Examples:**

```js
let state = GameState.MENU;
let color = C64Color.BLUE;
```

## Ternary Conditional Expression

The ternary operator provides inline conditional evaluation:

```ebnf
conditional_expr = logical_or_expr , [ "?" , expression , ":" , conditional_expr ] ;
```

**Examples:**

```js
// Simple ternary
let max = (a > b) ? a : b;

// Ternary with expressions
let status = (health > 0) ? 1 : 0;

// Nested ternary (use sparingly for readability)
let grade = (score > 90) ? 1 : (score > 80) ? 2 : (score > 70) ? 3 : 4;

// Ternary in expressions
let offset = (isLarge) ? 100 : 50;
let position = baseX + ((direction > 0) ? speed : 0 - speed);
```

**Semantics:**
- The condition is evaluated first
- If true, the "then" expression (after `?`) is evaluated and returned
- If false, the "else" expression (after `:`) is evaluated and returned
- Both branches must have compatible types
- The ternary operator is right-associative

## Array Literal Expressions

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

let bufferAddr: @address = @buffer;        // Address of array
let counterAddr: @address = @counter;      // Address of scalar

// Type compatibility: @address and word are interchangeable
let wordAddr: word = @buffer;              // ✅ Valid - same type
let addrValue: @address = 0xD020;          // ✅ Valid - can assign word to @address
```

**Usage with Generic Functions:**

```js
// Generic memory manipulation using address-of
function copyMemory(src: @address, dst: @address, len: byte): void {
    for (let i: byte = 0; i < len; i += 1) {
        poke(dst + i, peek(src + i));
    }
}

// Usage
@data const spriteData: byte[63] = [/* ... */];
@ram let activeSprite: byte[63];

copyMemory(@spriteData, @activeSprite, 63);  // Pass addresses directly
```

**Restrictions:**

- Can only be applied to **variables** (local, global)
- Cannot be applied to **literals**: `@5` ❌ (compile error)
- Cannot be applied to **expressions**: `@(x + y)` ❌ (compile error)
- Cannot be applied to **function names** (use callback syntax instead)

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

## Expression Examples

### Complex Expression Evaluation

```js
// Complex expression with multiple operators
let screenOffset: word = (y * 40) + x;
let colorValue: byte = (red << 4) | (green & 0x0F);
let inBounds: boolean = (x >= 0) && (x < 320) && (y >= 0) && (y < 200);

// Ternary expressions
let max: byte = (a > b) ? a : b;
let sign: byte = (value >= 0) ? 1 : 0;
```

### Ternary Expression Patterns

```js
// Simple max/min
let max: byte = (a > b) ? a : b;
let min: byte = (a < b) ? a : b;

// Absolute value
let abs: byte = (value >= 0) ? value : 0 - value;

// Clamp value
let clamped: byte = (value > MAX) ? MAX : (value < MIN) ? MIN : value;

// Direction multiplier
let dx: byte = (direction == RIGHT) ? 1 : (direction == LEFT) ? 255 : 0;

// Inline in expression
let newX: byte = x + ((movingRight) ? speed : 0 - speed);
```

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
```

### 3. Avoid Complex Expressions

```js
// ✅ GOOD: Break into steps
let baseAddr = y * 40;
let offset = baseAddr + x;
poke(SCREEN_BASE + offset, char);

// ❌ COMPLEX: Hard to read
poke(SCREEN_BASE + y * 40 + x, char);
```