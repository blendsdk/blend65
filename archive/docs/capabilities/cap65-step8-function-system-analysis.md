# Step 8: Function System Analysis

**Status**: In Progress
**Part of**: cap65 Comprehensive Analysis
**Date**: December 1, 2026

## What This Step Covers

Focus ONLY on function system capabilities - function declarations, parameters, return types, scope management, callback functions, and C64-specific interrupt handling.

## Function Declaration Parsing (Phase 4)

The Blend65 parser provides comprehensive function parsing with C64-optimized features and modern language safety.

### Basic Function Declaration Syntax

**Grammar**: `[export] [callback] function identifier ( [ParameterList] ) [: ReturnType] StatementList end function`

**Key Features**:

- Optional export modifier for module visibility
- Optional callback modifier for interrupt handlers
- Type-safe parameter lists with annotations
- Optional return type annotations
- Complete statement parsing in function body
- Function scope management and validation

## Function Types Supported

### 1. Regular Functions

**Basic Function Structure**:

```js
// Simple function with no parameters
function clearScreen(): void
  fillMemory($0400, 32, 1000);
end function

// Function with parameters and return type
function calculateDistance(x1: byte, y1: byte, x2: byte, y2: byte): word
  let deltaX: byte = x2 - x1;
  let deltaY: byte = y2 - y1;
  return deltaX * deltaX + deltaY * deltaY;
end function

// Function with optional return type (inferred)
function getRandomByte()
  return (vic.rasterLine * 7 + 13) % 256;
end function
```

### 2. Exported Functions (Module System Integration)

**Cross-Module Visibility**:

```js
// Exported function for use in other modules
export function initializeGraphics(): void
  vic.borderColor = BLACK;
  vic.backgroundColor = BLACK;
  vic.spriteEnable = 0;
end function

// Exported utility functions
export function setPixel(x: byte, y: byte, color: byte): void
  let offset: word = y * 40 + x;
  screenRAM[offset] = 160;  // Filled block character
  colorRAM[offset] = color;
end function

// Exported game logic
export function updatePlayer(input: byte): boolean
  let moved: boolean = false;

  if input & JOY_LEFT then
    playerX -= playerSpeed;
    moved = true;
  end if

  if input & JOY_RIGHT then
    playerX += playerSpeed;
    moved = true;
  end if

  return moved;
end function
```

### 3. Callback Functions (C64 Interrupt Handlers)

**Interrupt Handler Support**: `callback` modifier marks functions as interrupt handlers

```js
// Raster interrupt handler
callback function rasterIRQ(): void
  // Change border color at specific raster line
  if vic.rasterLine == 100 then
    vic.borderColor = RED;
  else if vic.rasterLine == 200 then
    vic.borderColor = BLUE;
  else
    vic.borderColor = BLACK;
  end if

  // Acknowledge interrupt
  vic.interruptStatus = $01;
end function

// Timer interrupt handler
callback function timerIRQ(): void
  frameCounter += 1;

  // Update game logic every 3rd frame (20 FPS)
  if frameCounter % 3 == 0 then
    updateGameObjects();
  end if

  // Acknowledge CIA timer interrupt
  cia1.interruptControl = $01;
end function

// NMI handler (non-maskable interrupt)
callback function nmiHandler(): void
  // Critical system interrupt - minimal processing
  systemError = true;

  // Save critical game state
  saveGameState();
end function

// Complex interrupt handler with full language features
callback function complexIRQ(): void
  // Local variables in interrupt context
  let currentLine: byte = vic.rasterLine;
  let spriteCollisions: byte = vic.spriteCollision;

  // Control flow in interrupt
  if spriteCollisions != 0 then
    for sprite = 0 to 7
      if spriteCollisions & (1 << sprite) then
        handleSpriteCollision(sprite);
      end if
    next sprite
  end if

  // Match statement in interrupt
  match currentLine
    case 50:  setupTopScreen();
    case 100: setupMiddleScreen();
    case 200: setupBottomScreen();
  end match

  vic.interruptStatus = $01;  // Clear interrupt
end function
```

### 4. Main Function (Auto-Export)

**Special Handling**: Main functions are automatically exported per language specification

```js
// Main function - automatically exported (with warning)
function main(): void
  initializeSystem();
  runGameLoop();
  cleanup();
end function

// Explicit export (recommended)
export function main(): void
  initializeSystem();
  runGameLoop();
  cleanup();
end function
```

## Parameter System

### Parameter Declaration and Validation

**Grammar**: `Parameter := identifier : TypeName`

```js
// Single parameter
function playSound(frequency: word): void
  sid.voice1Freq = frequency;
  sid.voice1Control = $41;
end function

// Multiple parameters
function drawLine(x1: byte, y1: byte, x2: byte, y2: byte, color: byte): void
  // Bresenham line algorithm using all parameters
  let deltaX: byte = x2 - x1;
  let deltaY: byte = y2 - y1;

  if deltaX > deltaY then
    drawLineHorizontal(x1, y1, x2, y2, color);
  else
    drawLineVertical(x1, y1, x2, y2, color);
  end if
end function

// Complex parameter types
function configureSprite(
  spriteIndex: byte,
  x: word,
  y: byte,
  color: byte,
  multicolor: boolean,
  priority: byte
): void
  // 9-bit X coordinate handling
  vic.spriteCoords[spriteIndex * 2] = x & $FF;
  vic.spriteCoords[spriteIndex * 2 + 1] = y;

  if x >= 256 then
    vic.spriteXMSB |= (1 << spriteIndex);
  else
    vic.spriteXMSB &= ~(1 << spriteIndex);
  end if

  vic.spriteColors[spriteIndex] = color;

  if multicolor then
    vic.spriteMulticolor |= (1 << spriteIndex);
  else
    vic.spriteMulticolor &= ~(1 << spriteIndex);
  end if

  vic.spritePriority = (vic.spritePriority & ~(1 << spriteIndex)) | (priority << spriteIndex);
  vic.spriteEnable |= (1 << spriteIndex);
end function
```

### Parameter Validation and Error Recovery

```js
// Duplicate parameter detection
function badFunction(x: byte, x: byte): void  // ERROR: Duplicate parameter 'x'
  return x;
end function

// Missing parameter type
function incompleteFunction(name): void       // ERROR: Expected ':' after parameter name
  doSomething(name);
end function

// Invalid parameter type
function wrongType(value: invalid_type): void // ERROR: Expected parameter type
  process(value);
end function
```

## Return Type System

### Return Type Validation

```js
// Void functions (no return value)
function clearScreen(): void
  fillMemory($0400, 32, 1000);
  return;  // Optional explicit void return
end function

// Typed return values
function getPlayerHealth(): byte
  return playerHealth;
end function

function calculateScreenOffset(x: byte, y: byte): word
  return y * 40 + x;
end function

function isGameRunning(): boolean
  return lives > 0 && !quitRequested;
end function

// Complex return expressions
function getNextEnemySpawnTime(): word
  return baseSpawnTime + (level * difficultyMultiplier) - (score / 1000);
end function

// Multiple return paths
function findEmptySlot(): byte
  for i = 0 to MAX_ENTITIES - 1
    if !entities[i].active then
      return i;  // Found empty slot
    end if
  next i

  return 255;  // No empty slots available
end function
```

### Return Type Inference

```js
// Type inference when no explicit return type
function inferredByte()
  return 42;                    // Inferred as returning number/byte
end function

function inferredBoolean()
  return true;                  // Inferred as returning boolean
end function

function inferredString()
  return "Game Over";           // Inferred as returning string
end function
```

## Function Scope Management

### Local Variable Management

**Function-Scoped Variables**: Variables declared inside functions

```js
function complexCalculation(input: word): word
  // Function-local variables
  let temp1: byte = input & $FF;        // Low byte
  let temp2: byte = (input >> 8) & $FF; // High byte
  let intermediate: word = temp1 * temp2;

  // Constants in function scope
  const MULTIPLIER: byte = 3;
  let result: word = intermediate * MULTIPLIER;

  // Nested scope with block statement
  {
    let nestedVar: byte = result % 256;
    if nestedVar > 100 then
      result += nestedVar;
    end if
    // nestedVar goes out of scope here
  }

  return result;
end function

// Parameter shadowing prevention
function parameterTest(x: byte): byte
  let x: byte = 10;             // ERROR: 'x' already declared as parameter
  return x;
end function
```

### Scope Resolution

```js
// Module-level variables
@zp let globalCounter: byte = 0;
@ram let gameState: word = MENU_STATE;

function scopeTest(localParam: byte): byte
  // Can access module-level variables
  globalCounter += 1;

  // Can access parameters
  let result: byte = localParam * 2;

  // Local variables shadow module variables
  let gameState: byte = 1;      // Shadows module-level gameState

  // Nested scope
  {
    let nestedVar: byte = result + gameState;  // Uses local gameState
    globalCounter += nestedVar;               // Still accesses global
  }

  return result;
end function
```

## Real-World C64 Function Patterns

### Graphics Functions

```js
// Complete sprite management system
function initializeSprites(): void
  // Clear all sprite data
  for i = 0 to 7
    vic.spriteCoords[i * 2] = 0;        // X position
    vic.spriteCoords[i * 2 + 1] = 0;    // Y position
    vic.spriteColors[i] = 1;            // White
  next i

  vic.spriteEnable = 0;                 // All sprites off
  vic.spriteXMSB = 0;                   // Clear X MSB bits
  vic.spriteMulticolor = 0;             // Single color mode
  vic.spriteXExpand = 0;                // Normal width
  vic.spriteYExpand = 0;                // Normal height
end function

function createSprite(x: word, y: byte, spriteData: byte[]): byte
  // Find free sprite slot
  for spriteNum = 0 to 7
    if !(vic.spriteEnable & (1 << spriteNum)) then
      // Configure sprite
      vic.spriteCoords[spriteNum * 2] = x & $FF;
      vic.spriteCoords[spriteNum * 2 + 1] = y;

      if x >= 256 then
        vic.spriteXMSB |= (1 << spriteNum);
      end if

      // Copy sprite data to sprite memory
      let spriteAddr: word = $2000 + spriteNum * 64;
      for i = 0 to 63
        memory[spriteAddr + i] = spriteData[i];
      next i

      // Set sprite pointer
      spritePointers[spriteNum] = spriteAddr / 64;

      // Enable sprite
      vic.spriteEnable |= (1 << spriteNum);

      return spriteNum;  // Return sprite number
    end if
  next spriteNum

  return 255;  // No free sprites
end function

function moveSprite(spriteNum: byte, deltaX: word, deltaY: byte): void
  if spriteNum >= 8 then return; end if  // Validate sprite number

  // Get current position
  let currentX: word = vic.spriteCoords[spriteNum * 2];
  let currentY: byte = vic.spriteCoords[spriteNum * 2 + 1];

  // Handle 9-bit X coordinate
  if vic.spriteXMSB & (1 << spriteNum) then
    currentX += 256;
  end if

  // Update position
  currentX += deltaX;
  currentY += deltaY;

  // Set new position
  vic.spriteCoords[spriteNum * 2] = currentX & $FF;
  vic.spriteCoords[spriteNum * 2 + 1] = currentY;

  if currentX >= 256 then
    vic.spriteXMSB |= (1 << spriteNum);
  else
    vic.spriteXMSB &= ~(1 << spriteNum);
  end if
end function
```

### Sound Functions

```js
// SID sound system functions
function initializeSID(): void
  // Clear all SID registers
  for i = 0 to 24
    sid[i] = 0;
  next i

  // Set master volume
  sid.volume = $0F;                     // Maximum volume
end function

function playNote(voice: byte, frequency: word, waveform: byte, duration: byte): void
  match voice
    case 1:
      sid.voice1Freq = frequency;
      sid.voice1Control = waveform | $01;  // Gate on

    case 2:
      sid.voice2Freq = frequency;
      sid.voice2Control = waveform | $01;

    case 3:
      sid.voice3Freq = frequency;
      sid.voice3Control = waveform | $01;
  end match

  // Set up note duration using game timer
  noteEndTime[voice - 1] = frameCounter + duration;
end function

function stopNote(voice: byte): void
  match voice
    case 1: sid.voice1Control &= $FE;    // Gate off
    case 2: sid.voice2Control &= $FE;
    case 3: sid.voice3Control &= $FE;
  end match
end function

// Complex sound effect function
function playExplosion(pitch: byte, volume: byte): void
  // Use voice 3 for explosion noise
  sid.voice3Freq = pitch * 10;
  sid.voice3Control = $81;              // Noise waveform, gate on

  // Envelope for explosion effect
  sid.voice3AttackDecay = $09;          // Fast attack, medium decay
  sid.voice3SustainRelease = $00;       // No sustain, fast release

  // Schedule sound to stop
  explosionEndTime = frameCounter + volume;
end function
```

### Input Handling Functions

```js
// CIA joystick interface functions
function readJoystick(port: byte): byte
  if port == 1 then
    return cia1.joystick1;
  else if port == 2 then
    return cia1.joystick2;
  else
    return 0;  // Invalid port
  end if
end function

function checkButton(joystickData: byte, button: byte): boolean
  return (joystickData & button) == 0;  // Active low on C64
end function

// Complex input processing
function handlePlayerInput(): void
  let joy1: byte = readJoystick(1);
  let joy2: byte = readJoystick(2);

  // Player 1 controls
  if checkButton(joy1, JOY_UP) then
    movePlayer(1, 0, -playerSpeed);
  end if

  if checkButton(joy1, JOY_DOWN) then
    movePlayer(1, 0, playerSpeed);
  end if

  if checkButton(joy1, JOY_LEFT) then
    movePlayer(1, -playerSpeed, 0);
  end if

  if checkButton(joy1, JOY_RIGHT) then
    movePlayer(1, playerSpeed, 0);
  end if

  if checkButton(joy1, JOY_FIRE) then
    fireBullet(1);
  end if

  // Player 2 controls (similar pattern)
  if checkButton(joy2, JOY_FIRE) then
    fireBullet(2);
  end if
end function
```

### Memory Management Functions

```js
// Memory manipulation functions
function fillMemory(startAddr: word, value: byte, count: word): void
  for i = 0 to count - 1
    memory[startAddr + i] = value;
  next i
end function

function copyMemory(source: word, dest: word, count: word): void
  for i = 0 to count - 1
    memory[dest + i] = memory[source + i];
  next i
end function

function clearScreen(): void
  fillMemory($0400, 32, 1000);         // Clear screen characters
  fillMemory($D800, 14, 1000);         // Set color to light blue
end function

// Zero page memory optimization
function fastCopy(sourceZP: byte, destZP: byte, count: byte): void
  // Use zero page for fastest possible memory copy
  @zp let src: byte = sourceZP;
  @zp let dst: byte = destZP;

  for i = 0 to count - 1
    memory[dst + i] = memory[src + i];
  next i
end function
```

## Function Scope Validation

### Break/Continue Context Validation

**Parser enforces proper break/continue usage**:

```js
function validLoopUsage(): void
  for i = 0 to 10
    if shouldSkip(i) then
      continue;                 // ✅ Valid - inside loop
    end if

    if shouldExit(i) then
      break;                    // ✅ Valid - inside loop
    end if

    processItem(i);
  next i
end function

function invalidJumpUsage(): void
  if condition then
    break;                      // ❌ ERROR: break only allowed in loops
  end if

  continue;                     // ❌ ERROR: continue only allowed in loops
end function

// Nested loop validation
function nestedLoops(): void
  while outerCondition
    for i = 0 to 10
      if innerCondition then
        continue;               // ✅ Valid - applies to for loop
      end if

      if exitCondition then
        break;                  // ✅ Valid - applies to for loop
      end if
    next i

    if outerExitCondition then
      break;                    // ✅ Valid - applies to while loop
    end if
  end while
end function
```

### Return Statement Validation

```js
// Void function return validation
function voidFunction(): void
  if earlyExit then
    return;                     // ✅ Valid - void return
  end if

  doSomething();
  return 42;                    // ❌ ERROR: Cannot return value from void function
end function

// Typed function return validation
function typedFunction(): byte
  if earlyCase then
    return 100;                 // ✅ Valid - byte return
  end if

  return;                       // ❌ ERROR: Must return value from typed function
end function

// Multiple return type consistency
function multiReturn(flag: boolean): word
  if flag then
    return 1000;                // ✅ Valid - word return
  else
    return true;                // ❌ ERROR: Type mismatch, expected word
  end if
end function
```

## Advanced Function Features

### Recursive Functions

```js
// Factorial calculation (demonstrates recursion support)
function factorial(n: byte): word
  if n <= 1 then
    return 1;
  else
    return n * factorial(n - 1);  // Recursive call
  end if
end function

// Binary search (recursive algorithm)
function binarySearch(array: byte[], target: byte, left: byte, right: byte): byte
  if left > right then
    return 255;  // Not found
  end if

  let mid: byte = (left + right) / 2;

  if array[mid] == target then
    return mid;  // Found
  else if array[mid] < target then
    return binarySearch(array, target, mid + 1, right);  // Search upper half
  else
    return binarySearch(array, target, left, mid - 1);   // Search lower half
  end if
end function
```

### Function Composition and Integration

```js
// Functions calling other functions
function initializeGame(): void
  clearScreen();
  initializeSprites();
  initializeSID();
  setupInterrupts();
  resetGameVariables();
end function

function gameLoop(): void
  while gameRunning
    handleInput();
    updatePhysics();
    checkCollisions();
    updateAI();
    renderFrame();
    processAudio();
    syncFrame();
  end while
end function

// Function chains for complex operations
function processGameFrame(): void
  let inputState: byte = captureInput();
  let playerMoved: boolean = updatePlayer(inputState);

  if playerMoved then
    let newCollisions: byte = checkPlayerCollisions();

    if newCollisions > 0 then
      handleCollisions(newCollisions);
    end if
  end if

  updateEnemies();
  updateBullets();
  updateParticles();
end function
```

## Error Recovery in Functions

```js
// Parser recovers from function errors
function errorRecoveryTest(): void
  let x: byte = 10;

  invalid_syntax_here;          // ERROR: Parser reports, continues

  // Parser continues parsing function body
  if x > 5 then
    doSomething();
  end if

  return;                       // Parsed successfully
end function

// Missing 'end function' recovery
function incompleteFunction(): void
  doSomething();
  doSomethingElse();
// Missing 'end function' - ERROR: Parser reports, attempts recovery

function nextFunction(): void   // Parser continues with next function
  thisParses();
end function
```

## What Functions CANNOT Do (Current Limitations)

**Advanced Features (Not Yet Implemented)**:

```js
// ❌ Function overloading (same name, different parameters)
function draw(x: byte): void            // Not supported
function draw(x: byte, y: byte): void   // Would conflict

// ❌ Default parameters
function move(x: byte, y: byte = 0): void  // Not supported

// ❌ Variadic functions (variable arguments)
function printf(format: string, ...args): void  // Not supported

// ❌ Function pointers/first-class functions
let fn: function = myFunction;          // Not supported
function callOther(callback: function): void  // Not supported

// ❌ Lambda/anonymous functions
let lambda = (x: byte) => x * 2;        // Not supported

// ❌ Generic functions
function generic<T>(value: T): T        // Not supported - no generics yet
```

**Specification Limitations**:

```js
// ❌ Nested function declarations (not in spec)
function outer(): void
  function inner(): void                // Not supported - no nested functions
    doSomething();
  end function
end function

// ❌ Function expressions (not in spec)
let fn = function(): void               // Not supported
  doSomething();
end function;
```

## Callback Functions and Interrupt Integration

### Interrupt Vector Setup

```js
// Setting up interrupt handlers using callback functions
function setupInterrupts(): void
  // Disable interrupts during setup
  disableInterrupts();

  // Set IRQ vector to our raster interrupt handler
  setInterruptVector($FFFE, @rasterIRQ);

  // Set NMI vector to our NMI handler
  setInterruptVector($FFFA, @nmiHandler);

  // Configure VIC-II for raster interrupt
  vic.rasterLine = 250;
  vic.interruptEnable = $01;            // Enable raster interrupt

  // Re-enable interrupts
  enableInterrupts();
end function

// Multiple interrupt handlers working together
callback function mainIRQ(): void
  // Raster interrupt at line 250
  vic.borderColor = frameCounter & $0F; // Color cycling

  // Schedule next interrupt
  vic.rasterLine = 100;

  frameCounter += 1;
  vic.interruptStatus = $01;            // Clear interrupt
end function

callback function midScreenIRQ(): void
  // Raster interrupt at line 100
  vic.backgroundColor = (frameCounter >> 2) & $0F;

  // Schedule next interrupt
  vic.rasterLine = 250;

  vic.interruptStatus = $01;
end function
```

## Next Steps

This completes Step 8. The function system provides comprehensive support for C64 game development with modern language features, proper scope management, callback functions for interrupt handling, and robust error recovery.

**Ready for**: Step 9 - Limitations Analysis
