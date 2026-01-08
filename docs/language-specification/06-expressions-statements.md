# Expressions and Statements

> **Status**: Lexer-Derived Specification  
> **Last Updated**: January 8, 2026  
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
let msg = "Hello";

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
let result = (5 + 3) * 2;  // Parentheses control precedence
let complex = ((a + b) * (c + d));
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

## Operators

Blend65 provides a comprehensive set of operators for arithmetic, comparison, logical, and bitwise operations.

### Arithmetic Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `a + b` |
| `-` | Subtraction | `a - b` |
| `*` | Multiplication | `a * b` |
| `/` | Division | `a / b` |
| `%` | Modulo | `a % b` |

**Examples:**
```js
let sum = a + b;
let diff = x - 5;
let product = width * height;
let quotient = total / count;
let remainder = value % 10;
```

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equal | `a == b` |
| `!=` | Not equal | `a != b` |
| `<` | Less than | `a < b` |
| `<=` | Less or equal | `a <= b` |
| `>` | Greater than | `a > b` |
| `>=` | Greater or equal | `a >= b` |

**Examples:**
```js
if x == 10 then
if score != 0 then
if health < 50 then
if count >= 100 then
```

### Logical Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `&&` | Logical AND | `a && b` |
| `\|\|` | Logical OR | `a \|\| b` |
| `!` | Logical NOT | `!a` |

**Examples:**
```js
if running && !paused then
if x < 0 || x > 320 then
if !gameOver then
```

### Bitwise Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `&` | Bitwise AND | `a & b` |
| `\|` | Bitwise OR | `a \| b` |
| `^` | Bitwise XOR | `a ^ b` |
| `~` | Bitwise NOT | `~a` |
| `<<` | Left shift | `a << b` |
| `>>` | Right shift | `a >> b` |

**Examples:**
```js
let masked = value & 0b11110000;
let combined = flags | 0b00000001;
let toggled = state ^ 0b00000100;
let inverted = ~mask;
let shifted = value << 1;
let halved = value >> 1;
```

### Assignment Operators

| Operator | Description | Equivalent To |
|----------|-------------|---------------|
| `=` | Assignment | N/A |
| `+=` | Add assign | `a = a + b` |
| `-=` | Subtract assign | `a = a - b` |
| `*=` | Multiply assign | `a = a * b` |
| `/=` | Divide assign | `a = a / b` |
| `%=` | Modulo assign | `a = a % b` |
| `&=` | AND assign | `a = a & b` |
| `\|=` | OR assign | `a = a \| b` |
| `^=` | XOR assign | `a = a ^ b` |
| `<<=` | Left shift assign | `a = a << b` |
| `>>=` | Right shift assign | `a = a >> b` |

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

| Level | Operators | Associativity | Description |
|-------|-----------|---------------|-------------|
| 1 | `()` `[]` `.` | Left-to-right | Grouping, indexing, member access |
| 2 | `!` `~` unary `+` unary `-` | Right-to-left | Unary operators |
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
| 13 | `=` `+=` `-=` etc. | Right-to-left | Assignment |

**Examples:**
```js
let result = a + b * c;     // Multiplication first: a + (b * c)
let mask = x & 0xFF == y;   // AND first: (x & 0xFF) == y
let flag = !a || b;         // NOT first: (!a) || b
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
x + y;  // Valid but useless (result discarded)
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
for i = 0 to 10
  if i == 5 then
    break;  // Exit loop
  end if
  if i == 3 then
    continue;  // Skip to next iteration
  end if
next i
```

## Control Flow

Control flow statements alter the execution order of the program.

### If Statement

Conditional execution based on a boolean expression.

```ebnf
if_stmt = "if" , expression , "then"
        , { statement }
        , [ "else" , { statement } ]
        , "end" , "if" ;
```

**Basic if:**
```js
if x > 10 then
  doSomething();
end if
```

**If-else:**
```js
if health <= 0 then
  gameOver();
else
  continueGame();
end if
```

**If-else chain:**
```js
if score > 1000 then
  showGold();
else
  if score > 500 then
    showSilver();
  else
    showBronze();
  end if
end if
```

### While Loop

Repeat while condition is true.

```ebnf
while_stmt = "while" , expression
           , { statement }
           , "end" , "while" ;
```

**Examples:**
```js
while running
  update();
  render();
end while

while x < 100
  x += 1;
end while
```

**Infinite loop:**
```js
while true
  gameLoop();
end while
```

### For Loop

Counted loop with explicit counter.

```ebnf
for_stmt = "for" , identifier , "=" , expression , "to" , expression
         , { statement }
         , "next" , identifier ;
```

**Examples:**
```js
for i = 0 to 10
  buffer[i] = 0;
next i

for x = 1 to 100
  process(x);
next x

for count = 10 to 0  // Counts down if start > end
  countdown(count);
next count
```

**Nested loops:**
```js
for y = 0 to 24
  for x = 0 to 39
    screenRAM[y * 40 + x] = 32;
  next x
next y
```

### Match Statement

Pattern matching (similar to switch/case).

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

**Examples:**
```js
match gameState
  case GameState.MENU:
    showMenu();
  case GameState.PLAYING:
    updateGame();
  case GameState.PAUSED:
    showPause();
  default:
    handleError();
end match
```

**With multiple statements per case:**
```js
match direction
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
end match
```

## Statement Blocks

Statements can be grouped in blocks within control flow structures:

```js
if condition then
  // Block of statements
  statement1();
  statement2();
  statement3();
end if
```

## Complete Examples

### Expression Evaluation

```js
// Complex expression with multiple operators
let screenOffset: word = (y * 40) + x;
let colorValue: byte = (red << 4) | (green & 0x0F);
let inBounds: boolean = (x >= 0) && (x < 320) && (y >= 0) && (y < 200);
```

### Control Flow Example

```js
module Game.Example

@zp let playerX: byte = 10;
@zp let playerY: byte = 10;
@zp let health: byte = 100;
@zp let score: word = 0;

function updatePlayer(): void
  // Check health
  if health <= 0 then
    gameOver();
    return;
  end if
  
  // Update position
  playerX += 1;
  if playerX > 40 then
    playerX = 0;
  end if
  
  // Update score
  score += 10;
end function

function gameLoop(): void
  while true
    updatePlayer();
    
    // Check for collisions
    for i = 0 to 9
      if checkCollision(i) then
        health -= 10;
        break;
      end if
    next i
    
    // Handle state
    match gameState
      case GameState.PLAYING:
        continueGame();
      case GameState.PAUSED:
        showPauseMenu();
      default:
        reset();
    end match
  end while
end function
```

### Loop Examples

```js
// Initialize array
for i = 0 to 255
  buffer[i] = 0;
next i

// Search for value
let found: boolean = false;
for i = 0 to 99
  if data[i] == target then
    found = true;
    break;
  end if
next i

// Skip even numbers
for i = 0 to 10
  if i % 2 == 0 then
    continue;
  end if
  processOdd(i);
next i
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

### Semicolons Not Required

These statements are **self-terminating**:
- ❌ If statements: `if ... end if`
- ❌ While loops: `while ... end while`
- ❌ For loops: `for ... next`
- ❌ Match statements: `match ... end match`
- ❌ Function declarations: `function ... end function`

See [Migration Guide](30-migration-guide.md) for details on semicolon-based syntax.

## Best Practices

### 1. Use Parentheses for Clarity

```js
// ✅ GOOD: Clear intent
let result = (a + b) * (c + d);

// ❌ UNCLEAR: Relies on precedence knowledge
let result = a + b * c + d;
```

### 2. Avoid Complex Expressions

```js
// ✅ GOOD: Break into steps
let baseAddr = y * 40;
let offset = baseAddr + x;
screenRAM[offset] = char;

// ❌ COMPLEX: Hard to read
screenRAM[(y * 40) + x] = char;
```

### 3. Use Meaningful Variable Names in Loops

```js
// ✅ GOOD: Clear purpose
for spriteIndex = 0 to 7
  updateSprite(spriteIndex);
next spriteIndex

// ❌ UNCLEAR: Generic name
for i = 0 to 7
  updateSprite(i);
next i
```

### 4. Early Return for Error Conditions

```js
// ✅ GOOD: Early return
function process(value: byte): byte
  if value == 0 then
    return 0;
  end if
  
  // Main logic here
  return compute(value);
end function
```

## Implementation Notes

Expression and statement parsing is implemented in:
- `packages/compiler/src/parser/` - Parser implementation
- `packages/compiler/src/parser/precedence.ts` - Operator precedence
- `packages/compiler/src/__tests__/parser/` - Parser tests

See [Grammar](02-grammar.md) for complete EBNF grammar.
