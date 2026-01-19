# Step 5: Statement Parsing Analysis

**Status**: In Progress
**Part of**: cap65 Comprehensive Analysis
**Date**: December 1, 2026

## What This Step Covers

Focus ONLY on statement parsing capabilities - control flow statements, block statements, expression statements, and statement infrastructure.

## Statement Parsing Architecture

The Blend65 parser provides comprehensive statement parsing with C64-optimized control flow patterns and robust error recovery.

### Statement Dispatcher System

**Central Method**: `parseStatement() -> Statement`

The statement parser uses a **dispatcher pattern** that routes to specific parsers based on the current token:

```js
// Statement routing logic
if (check(LEFT_BRACE))           -> parseBlockStatement()
if (check(LET, CONST))          -> parseLocalVariableDeclaration()
if (check(IF))                  -> parseIfStatement()
if (check(WHILE))               -> parseWhileStatement()
if (check(FOR))                 -> parseForStatement()
if (check(MATCH))               -> parseMatchStatement()
if (check(RETURN))              -> parseReturnStatement()
if (check(BREAK))               -> parseBreakStatement()
if (check(CONTINUE))            -> parseContinueStatement()
else                            -> parseExpressionStatement()
```

## Statement Types Supported

### 1. Block Statements

**Grammar**: `'{' Statement* '}'`

**Use Cases**: Function bodies, conditional branches, loop bodies, scoping

```js
// Simple block
{
  let temp: byte = x;
  x = y;
  y = temp;
}

// Function body block
function swapValues(a: byte, b: byte): void
{
  let temp: byte = a;
  a = b;
  b = temp;
}

// Nested blocks for scoping
{
  let outerVar: byte = 10;
  {
    let innerVar: byte = 20;
    outerVar = innerVar;  // Can access outer scope
  }
  // innerVar no longer accessible here
}

// Empty blocks (valid)
{
  // Empty block - sometimes useful for future expansion
}
```

**Error Recovery**:

```js
{
  let x: byte = 5;
  invalid_syntax_here;    // ERROR: Reports error, continues parsing
  let y: byte = 10;       // Continues after error
}
// Block parsing completes successfully despite internal error
```

### 2. Expression Statements

**Grammar**: `Expression ';'`

**Use Cases**: Function calls, assignments, side effects

```js
// Function calls as statements
clearScreen();
initializeGraphics();
playSound();

// Assignments as statements
playerX = 160;
vic.borderColor = RED;
spriteEnable |= 1 << PLAYER_SPRITE;

// Complex expressions as statements
screenRAM[y * 40 + x] = CHARACTER_SPACE;
sid.voice1Freq = baseFrequency + (vibrato << 2);

// Compound assignments
score += points;
lives -= 1;
health *= DAMAGE_MULTIPLIER;

// Array assignments
buffer[offset++] = data;
colorRAM[position] = WHITE;

// Member assignments
player.x += velocity.x;
game.state = GAME_RUNNING;
```

**Semicolon Requirement**:

```js
// ✅ Correct - semicolons required
clearScreen();
playSound();

// ❌ Error - missing semicolons reported but parsing continues
clearScreen(); // ERROR: Expected semicolon
playSound(); // ERROR: Expected semicolon
```

### 3. Local Variable Declarations (Function Scope)

**Grammar**: `['const'] 'let' identifier [':' type] ['=' expression] ';'`

**NEW in Phase 4**: Variables can now be declared inside function bodies

```js
function calculateDistance(x1: byte, y1: byte, x2: byte, y2: byte): word
  // Local variables inside function
  let deltaX: byte = x2 - x1;
  let deltaY: byte = y2 - y1;
  let deltaXSquared: word = deltaX * deltaX;
  let deltaYSquared: word = deltaY * deltaY;

  // Constants inside function
  const SCALE_FACTOR: byte = 10;
  let scaledResult: word = (deltaXSquared + deltaYSquared) / SCALE_FACTOR;

  return scaledResult;
end function

// Function with mixed statements and local variables
function processInput(): void
  handleKeyboard();           // Expression statement

  let currentKey: byte = getLastKey(); // Local variable

  if currentKey == SPACE_KEY then      // Control flow
    let wasJumping: boolean = player.jumping; // Local in block scope
    player.jumping = true;
  end if

  updatePlayerMovement();     // Expression statement
end function
```

**Local Variable Features**:

```js
// Type inference works in local scope
let auto1 = 42;                    // Inferred as number
let auto2 = "text";                // Inferred as string
let auto3 = player.x + offset;     // Inferred from expression

// Constants require initializers (same as module scope)
const LOCAL_MAX: byte = 100;       // ✅ Valid
const UNINITIALIZED: byte;         // ❌ ERROR: const needs initializer

// No storage classes allowed in functions (they're local to the stack)
@zp let x: byte = 0;              // ❌ ERROR: No storage classes in functions
let x: byte = 0;                  // ✅ Correct - local variable
```

### 4. Control Flow Statements

#### If Statements

**Grammar**: `'if' Expression 'then' Statement* ['else' Statement*] 'end' 'if'`

**C64-Optimized Syntax**: Uses `then` and `end if` for clarity

```js
// Simple if statement
if playerX > SCREEN_WIDTH then
  playerX = 0;
end if

// If-else statement
if lives > 0 then
  continueGame();
else
  gameOver();
end if

// Nested if statements
if gameRunning then
  if inputReady then
    if joystick & JOY_UP then
      movePlayerUp();
    else if joystick & JOY_DOWN then
      movePlayerDown();
    else if joystick & JOY_LEFT then
      movePlayerLeft();
    else if joystick & JOY_RIGHT then
      movePlayerRight();
    end if
  end if
else
  showTitleScreen();
end if

// Complex conditions
if (playerHealth > 0) && !gameOver && (lives > 0) then
  updateGameplay();
  renderFrame();
else
  handleGameEnd();
end if
```

**Error Recovery**:

```js
if playerX > 10        // ERROR: Missing 'then', continues parsing
  movePlayer();
end if                 // Completes successfully

if condition then
  doSomething();
// Missing 'end if'     // ERROR: Reports missing end, synchronizes
```

#### While Loops

**Grammar**: `'while' Expression Statement* 'end' 'while'`

**C64 Game Loop Optimized**: Perfect for frame loops and continuous processing

```js
// Main game loop
while gameRunning
  handleInput();
  updateLogic();
  renderFrame();
  waitForVBlank();
end while

// Nested loops
while level <= MAX_LEVEL
  initializeLevel(level);

  while !levelComplete && !gameOver
    processFrame();

    if playerDead then
      respawnPlayer();
    end if
  end while

  level += 1;
end while

// Complex conditions
while (lives > 0) && !quitRequested && systemRunning
  runGameFrame();

  if frameCount % 60 == 0 then
    updateSecondTimer();
  end if
end while

// Infinite loops (common in C64 programs)
while true
  handleInterrupts();
  processBackground();

  if exitCondition then
    break;
  end if
end while
```

#### For Loops (C64-Style)

**Grammar**: `'for' Identifier '=' Expression 'to' Expression Statement* 'next' Identifier`

**C64 BASIC Heritage**: Uses familiar `for i = 1 to 10` syntax

```js
// Simple counting loop
for i = 0 to 7
  sprites[i] = spriteData[i];
next i

// Countdown loop
for countdown = 10 to 0
  displayNumber(countdown);
  delay(60);  // Wait 1 second
next countdown

// Memory initialization
for address = $0400 to $07FF
  screen[address - $0400] = SPACE_CHARACTER;
next address

// Sprite positioning
for spriteIndex = 0 to MAX_SPRITES - 1
  vic.spriteX[spriteIndex] = startX + spriteIndex * SPRITE_WIDTH;
  vic.spriteY[spriteIndex] = baseY;
next spriteIndex

// Nested for loops
for row = 0 to SCREEN_HEIGHT - 1
  for col = 0 to SCREEN_WIDTH - 1
    let pixel: byte = getPixel(col, row);
    screen[row * SCREEN_WIDTH + col] = pixel;
  next col
next row

// Complex expressions in range
for i = playerLevel * 10 to (playerLevel + 1) * 10 - 1
  processLevelData(i);
next i
```

**Variable Name Validation**:

```js
for i = 0 to 10
  // loop body
next j              // ❌ ERROR: Variable name mismatch, expected 'i'

for counter = 1 to 100
  // loop body
next counter        // ✅ Correct: Variable names match
```

#### Match Statements (Pattern Matching)

**Grammar**: `'match' Expression ('case' Expression ':' Statement*)* ['default' ':' Statement*] 'end' 'match'`

**C64 State Machine Optimized**: Perfect for game state management

```js
// Game state management
match gameState
  case MENU_STATE:
    handleMenuInput();
    renderMenu();

  case PLAYING_STATE:
    handleGameInput();
    updateGame();
    renderGame();

  case PAUSED_STATE:
    handlePauseInput();
    renderPauseScreen();

  case GAME_OVER_STATE:
    handleGameOverInput();
    renderGameOver();

  default:
    resetGameState();
    gameState = MENU_STATE;
end match

// Input handling
match joystick & $0F  // Mask for direction bits
  case $01:  // Up
    movePlayerUp();

  case $02:  // Down
    movePlayerDown();

  case $04:  // Left
    movePlayerLeft();

  case $08:  // Right
    movePlayerRight();

  default:   // No movement
    stopPlayer();
end match

// Sound effect selection
match soundType
  case EXPLOSION_SOUND:
    playSoundEffect($1000, 64);

  case LASER_SOUND:
    playSoundEffect($1100, 32);

  case PICKUP_SOUND:
    playSoundEffect($1200, 16);

  case BACKGROUND_MUSIC:
    startMusic(LEVEL_1_TUNE);

  default:
    stopAllSounds();
end match

// Nested match statements
match playerState
  case NORMAL_STATE:
    match input
      case JUMP_INPUT:
        playerState = JUMPING_STATE;
      case FIRE_INPUT:
        fireBullet();
    end match

  case JUMPING_STATE:
    updateJump();
    if jumpComplete then
      playerState = NORMAL_STATE;
    end if
end match
```

### 5. Jump Statements

#### Return Statements

**Grammar**: `'return' [Expression] ';'`

```js
// Void function return
function clearScreen(): void
  fillMemory($0400, SPACE_CHARACTER, 1000);
  return;  // Optional explicit return
end function

// Value return
function getPlayerScore(): word
  return baseScore + bonusPoints;
end function

// Complex expression return
function calculateScreenOffset(x: byte, y: byte): word
  return y * SCREEN_WIDTH + x;
end function

// Early return pattern
function processInput(): boolean
  if !inputReady then
    return false;
  end if

  if handleKeyboard() then
    return true;
  end if

  return handleJoystick();
end function

// Multiple return points
function findSprite(x: byte, y: byte): byte
  for i = 0 to MAX_SPRITES - 1
    if spriteActive[i] then
      if (spriteX[i] == x) && (spriteY[i] == y) then
        return i;  // Found sprite, return index
      end if
    end if
  next i

  return 255;  // Not found, return invalid index
end function
```

#### Break and Continue Statements

**Grammar**: `'break' ';'` and `'continue' ';'`

**Loop Context Validation**: Only allowed inside loops

```js
// Break statement examples
while gameRunning
  if quitRequested then
    break;  // Exit the loop
  end if

  processFrame();
end while

for i = 0 to 1000
  if data[i] == TARGET_VALUE then
    targetIndex = i;
    break;  // Found target, exit early
  end if
next i

// Continue statement examples
for i = 0 to MAX_SPRITES - 1
  if !spriteActive[i] then
    continue;  // Skip inactive sprites
  end if

  updateSprite(i);
  renderSprite(i);
next i

while true
  let key: byte = getKey();

  if key == 0 then
    continue;  // No key pressed, check again
  end if

  if processKey(key) then
    break;  // Key processing complete
  end if
end while
```

**Context Validation**:

```js
function someFunction(): void
  break;     // ❌ ERROR: break only allowed in loops
  continue;  // ❌ ERROR: continue only allowed in loops
end function

// ✅ Valid usage
while condition
  if shouldSkip then
    continue;  // OK - inside loop
  end if

  if shouldExit then
    break;     // OK - inside loop
  end if
end while
```

## Loop Context Tracking

The parser tracks loop nesting for break/continue validation:

```js
// Loop nesting tracking
while outerCondition           // loopNestingLevel = 1
  for i = 0 to 10             // loopNestingLevel = 2
    if condition then
      break;                  // ✅ Valid - inside nested loop
      continue;               // ✅ Valid - inside nested loop
    end if
  next i                      // loopNestingLevel = 1

  if otherCondition then
    break;                    // ✅ Valid - inside outer loop
  end if
end while                     // loopNestingLevel = 0

// Outside all loops
break;                        // ❌ ERROR: Not in loop context
```

## Real-World C64 Control Flow Patterns

### Game Main Loop

```js
function main(): void
  initializeSystem();

  while systemRunning
    // Check for system events
    if checkSystemStatus() then
      continue;  // System needs attention, skip frame
    end if

    // Game state processing
    match currentState
      case TITLE_SCREEN:
        if handleTitleInput() then
          currentState = GAME_PLAYING;
        end if

      case GAME_PLAYING:
        handleGameInput();
        updateGameLogic();

        if playerDead then
          currentState = GAME_OVER;
        end if

      case GAME_OVER:
        if handleGameOverInput() then
          currentState = TITLE_SCREEN;
        end if
    end match

    renderCurrentState();
    waitForVerticalBlank();
  end while
end function
```

### Sprite Management Loop

```js
function updateAllSprites(): void
  for spriteIndex = 0 to MAX_SPRITES - 1
    if !spriteActive[spriteIndex] then
      continue;  // Skip inactive sprites
    end if

    // Update sprite position
    spriteX[spriteIndex] += spriteVelX[spriteIndex];
    spriteY[spriteIndex] += spriteVelY[spriteIndex];

    // Check screen boundaries
    if (spriteX[spriteIndex] < 0) || (spriteX[spriteIndex] > SCREEN_WIDTH) then
      spriteActive[spriteIndex] = false;
      continue;  // Sprite off-screen, deactivate
    end if

    // Check collision with other sprites
    for otherIndex = spriteIndex + 1 to MAX_SPRITES - 1
      if !spriteActive[otherIndex] then
        continue;  // Skip inactive sprites
      end if

      if checkCollision(spriteIndex, otherIndex) then
        handleSpriteCollision(spriteIndex, otherIndex);
        break;  // Handle one collision per frame
      end if
    next otherIndex
  next spriteIndex
end function
```

## Statement Error Recovery

The parser provides robust error recovery for statements:

```js
// Missing semicolon recovery
function testFunction(): void
  let x: byte = 5     // ERROR: Missing semicolon, but continues
  let y: byte = 10;   // Parses successfully

  clearScreen()       // ERROR: Missing semicolon, but continues
  playSound();        // Parses successfully
end function

// Invalid syntax recovery
if condition then
  invalid_syntax;     // ERROR: Reports error, synchronizes to next statement
  validStatement();   // Continues parsing
end if

// Missing 'end' recovery
while condition
  doSomething();
  doSomethingElse();
// Missing 'end while' - ERROR: Reports error, attempts recovery

for i = 0 to 10
  processItem(i);
// Missing 'next i' - ERROR: Reports error, attempts recovery
```

## What Statements CANNOT Be Parsed

**Advanced Control Flow (Not in Specification)**:

```js
// ❌ Switch statements (use match instead)
switch (
  value // Not supported
) {
  case 1:
    break;
}

// ❌ Do-while loops
do {
  // Not supported
  statements;
} while (condition);

// ❌ For-each loops
for (item in array) {
  // Not supported
  process(item);
}

// ❌ Try-catch statements
try {
  // Not supported - no exception handling
  risky();
} catch (e) {
  handle(e);
}
```

**Modern Language Features (Not Yet Implemented)**:

```js
// ❌ Arrow functions
let fn = () => {};    // Not supported

// ❌ Async/await
async function f() {} // Not supported

// ❌ Yield statements
yield value;          // Not supported - no generators
```

## Next Steps

This completes Step 5. The statement parser can handle ALL documented Blend65 control flow with C64-optimized syntax, robust error recovery, and proper context validation for break/continue statements.

**Ready for**: Step 6 - @map System Analysis (Deep Dive)
