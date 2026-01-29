# Statements

> **Status**: Draft
> **Related Documents**: [Expressions](04-expressions.md), [Variables](03-variables.md), [Functions](06-functions.md)

## Overview

Statements perform actions and control program flow. In Blend65, **statements require semicolons** unless they are self-terminating block structures.

## Variable Declaration Statement

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

See [Variables](03-variables.md) for details.

## Assignment Statement

```ebnf
assignment_stmt = lvalue , assignment_op , expression , ";" ;
lvalue = identifier | index_expr | member_expr ;
```

**Examples:**

```js
x = 10;
buffer[i] = 255;
score += 100;
```

## Expression Statement

Any expression followed by a semicolon:

```ebnf
expr_stmt = expression , ";" ;
```

**Examples:**

```js
clearScreen();
updatePlayer();
poke($D020, 14);
```

## Return Statement

```ebnf
return_stmt = "return" , [ expression ] , ";" ;
```

**Examples:**

```js
return;           // Return from void function
return value;     // Return value
return a + b;     // Return expression result
```

## Break and Continue

Used in loops:

```ebnf
break_stmt = "break" , ";" ;
continue_stmt = "continue" , ";" ;
```

**Examples:**

```js
for (let i: byte = 0; i < 10; i += 1) {
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
for_stmt = "for" , "(" , [ "let" ] , identifier , [ ":" , type ] , "=" , expression
         , ( "to" | "downto" ) , expression
         , [ "step" , expression ]
         , ")" , "{"
         , { statement }
         , "}" ;
```

**Basic for loop (counting up):**

```js
for (let i: byte = 0; i < 10; i += 1) {
    buffer[i] = 0;
}

for (let x: byte = 1; x < 100; x += 1) {
    process(x);
}
```

**For loop with to keyword:**

```js
for (i = 0 to 10) {
    buffer[i] = 0;
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
for (let y: byte = 0; y < 25; y += 1) {
    for (let x: byte = 0; x < 40; x += 1) {
        poke(SCREEN_BASE + y * 40 + x, 32);
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

## Complete Examples

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
        for (let i: byte = 0; i < 10; i += 1) {
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
for (let i: byte = 0; i < 255; i += 1) {
    buffer[i] = 0;
}

// Search for value
let found: boolean = false;
for (let i: byte = 0; i < 100; i += 1) {
    if (data[i] == target) {
        found = true;
        break;
    }
}

// Skip even numbers
for (let i: byte = 0; i < 10; i += 1) {
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

## Best Practices

### 1. Early Return for Error Conditions

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

### 2. Use do-while for Input Validation

```js
// ✅ GOOD: Ensure at least one read
do {
    input = readInput();
} while (!isValid(input));
```

### 3. Use Meaningful Variable Names in Loops

```js
// ✅ GOOD: Clear purpose
for (let spriteIndex: byte = 0; spriteIndex < 8; spriteIndex += 1) {
    updateSprite(spriteIndex);
}

// ❌ UNCLEAR: Generic name
for (let i: byte = 0; i < 8; i += 1) {
    updateSprite(i);
}
```

### 4. Use switch for State Machines

```js
// ✅ GOOD: Clear state handling
switch (currentState) {
    case State.IDLE:
        handleIdle();
    case State.RUNNING:
        handleRunning();
    case State.STOPPED:
        handleStopped();
}
```