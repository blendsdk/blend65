# Step 7: Control Flow Integration Analysis

**Status**: In Progress
**Part of**: cap65 Comprehensive Analysis
**Date**: December 1, 2026

## What This Step Covers

Focus ONLY on control flow integration - how expressions, statements, declarations, and @map systems work together in complete, real-world C64 game development scenarios.

## Integration Architecture

The Blend65 parser demonstrates its true power when all components work together seamlessly:

**Integration Flow**:

```
Lexer → Tokens → Parser Inheritance Chain → Complete Programs
  ↓         ↓           ↓                      ↓
Tokens → BaseParser → ExpressionParser → Real C64 Games
                         ↓
                    DeclarationParser → @map Hardware Access
                         ↓
                    ModuleParser → Program Organization
                         ↓
                    StatementParser → Control Flow
                         ↓
                    Parser → Functions & Main Entry
```

## Complete C64 Game Examples

### Example 1: Snake Game (Complete Integration)

**Demonstrates**: All parser components working together

```js
module Game.Snake

// Storage class declarations with @map integration
@zp let snakeX: byte[32] = [160, 159, 158, 157];  // Zero page for speed
@zp let snakeY: byte[32] = [100, 100, 100, 100];  // Fast snake coordinates
@zp let snakeLength: byte = 4;                     // Current length
@zp let direction: byte = 1;                       // 0=up, 1=right, 2=down, 3=left

@ram let foodX: byte = 200;                        // Food position
@ram let foodY: byte = 150;
@ram let score: word = 0;                          // Player score
@ram let gameRunning: boolean = true;              // Game state

// Hardware @map declarations integrated with game logic
@map vic at $D000 layout
  spriteCoords: from $D000 to $D00F: byte,        // Snake head sprite
  spriteEnable: at $D015: byte,                    // Enable sprites
  borderColor: at $D020: byte,                     // Visual feedback
  backgroundColor: at $D021: byte,                 // Game background
  spriteColors: from $D027 to $D02E: byte         // Snake colors
end @map

@map cia1 at $DC00 layout
  joystick2: at $DC01: byte,                       // Player input
  dataDirectionB: at $DC03: byte                   // Input configuration
end @map

@map screenRAM from $0400 to $07FF: byte;         // Direct screen access
@map colorRAM from $D800 to $DBE7: byte;          // Color control

// Main game function - orchestrates everything
export function main(): void
  initializeGame();

  // Main game loop - control flow integration
  while gameRunning
    // Input processing with @map integration
    handleInput();

    // Game logic with complex expressions and statements
    if shouldMoveSnake() then
      moveSnake();

      // Collision detection with array access and conditionals
      if checkSelfCollision() then
        gameOver();
        break;  // Jump statement in loop context
      end if

      // Food collision with member access and arithmetic
      if (snakeX[0] == foodX) && (snakeY[0] == foodY) then
        eatFood();
        spawnNewFood();
      end if
    end if

    // Rendering with @map and array integration
    renderGame();

    // Frame timing with hardware integration
    waitForVerticalBlank();
  end while

  showGameOverScreen();
end function

// Input handling - @map integration with control flow
function handleInput(): void
  let joy: byte = cia1.joystick2;

  // Complex expression parsing with bitwise operations
  if (joy & $01) && (direction != 2) then      // Up and not moving down
    direction = 0;
  else if (joy & $02) && (direction != 0) then // Down and not moving up
    direction = 2;
  else if (joy & $04) && (direction != 1) then // Left and not moving right
    direction = 3;
  else if (joy & $08) && (direction != 3) then // Right and not moving left
    direction = 1;
  end if
end function

// Snake movement - array manipulation with control flow
function moveSnake(): void
  // Shift snake body (from tail to head)
  for i = snakeLength - 1 to 1
    snakeX[i] = snakeX[i - 1];
    snakeY[i] = snakeY[i - 1];
  next i

  // Move head based on direction
  match direction
    case 0: snakeY[0] -= 8;      // Up
    case 1: snakeX[0] += 8;      // Right
    case 2: snakeY[0] += 8;      // Down
    case 3: snakeX[0] -= 8;      // Left
  end match

  // Screen wrapping with complex expressions
  if snakeX[0] >= 320 then snakeX[0] = 0; end if
  if snakeX[0] < 0 then snakeX[0] = 312; end if
  if snakeY[0] >= 200 then snakeY[0] = 0; end if
  if snakeY[0] < 0 then snakeY[0] = 192; end if
end function

// Collision detection - nested loops with early exit
function checkSelfCollision(): boolean
  for i = 1 to snakeLength - 1
    if (snakeX[0] == snakeX[i]) && (snakeY[0] == snakeY[i]) then
      return true;  // Return statement with value
    end if
  next i

  return false;
end function

// Game rendering - @map integration with loops and expressions
function renderGame(): void
  // Clear previous snake position on screen
  for i = 0 to snakeLength - 1
    let screenPos: word = (snakeY[i] / 8) * 40 + (snakeX[i] / 8);
    screenRAM[screenPos] = 32;    // Space character
    colorRAM[screenPos] = 0;      // Black
  next i

  // Draw new snake position
  for i = 0 to snakeLength - 1
    let screenPos: word = (snakeY[i] / 8) * 40 + (snakeX[i] / 8);

    if i == 0 then
      screenRAM[screenPos] = 81;  // Snake head character
      colorRAM[screenPos] = 1;    // White
    else
      screenRAM[screenPos] = 113; // Snake body character
      colorRAM[screenPos] = 5;    // Green
    end if
  next i

  // Draw food
  let foodScreenPos: word = (foodY / 8) * 40 + (foodX / 8);
  screenRAM[foodScreenPos] = 83;  // Food character
  colorRAM[foodScreenPos] = 2;    // Red

  // Update hardware sprite for smooth snake head
  vic.spriteCoords[0] = snakeX[0];
  vic.spriteCoords[1] = snakeY[0];
  vic.spriteEnable = $01;           // Enable sprite 0
  vic.spriteColors[0] = 1;          // White sprite
end function

// Food system with random generation
function spawnNewFood(): void
  // Simple random number generation using hardware
  let rasterSeed: byte = vic.rasterLine;

  foodX = (rasterSeed * 7 + 13) % 312;  // Pseudo-random X
  foodY = (rasterSeed * 11 + 7) % 192;  // Pseudo-random Y

  // Align to 8-pixel grid
  foodX = (foodX / 8) * 8;
  foodY = (foodY / 8) * 8;
end function

// Game state management
function eatFood(): void
  snakeLength += 1;                     // Grow snake
  score += 10;                         // Increase score

  // Visual feedback with hardware
  vic.borderColor = 2;                 // Flash red

  // Sound effect integration (if SID @map was defined)
  // sid.voice1Freq = 1000;
  // sid.voice1Control = $41;
end function

function gameOver(): void
  gameRunning = false;                  // Stop main loop
  vic.borderColor = 1;                  // White border for game over
  vic.backgroundColor = 0;              // Black background
end function

// Timing integration with hardware
function waitForVerticalBlank(): void
  // Wait for raster line 250+ (bottom of screen)
  while vic.rasterLine < 250
    // Do nothing - busy wait
  end while
end function

// Game initialization - all systems integration
function initializeGame(): void
  // Hardware setup
  vic.borderColor = 0;                  // Black border
  vic.backgroundColor = 0;              // Black background
  vic.spriteEnable = 0;                 // Sprites off initially

  // CIA setup for joystick
  cia1.dataDirectionB = $00;            // All input

  // Clear screen memory
  for i = 0 to 999
    screenRAM[i] = 32;                  // Space
    colorRAM[i] = 0;                    // Black
  next i

  // Initialize game variables
  snakeLength = 4;
  direction = 1;                        // Start moving right
  score = 0;
  gameRunning = true;

  spawnNewFood();
end function
```

### Example 2: Sprite-Based Shoot 'Em Up

**Demonstrates**: Advanced integration with multiple systems

```js
module Game.ShootEmUp

// Complex data structures with storage classes
@zp let playerX: word = 160;                    // 16-bit for precise movement
@zp let playerY: word = 180;
@zp let playerSpeed: byte = 3;

@ram let bullets: byte[20];                     // Bullet pool (x1,y1,x2,y2,...)
@ram let enemies: byte[40];                     // Enemy pool
@ram let activeBullets: byte = 0;
@ram let activeEnemies: byte = 0;
@ram let lives: byte = 3;
@ram let level: byte = 1;

// Complete hardware integration
@map vic at $D000 layout
  spriteCoords: from $D000 to $D00F: byte,     // All 8 sprites
  spriteXMSB: at $D010: byte,                   // 9-bit X coordinates
  spriteEnable: at $D015: byte,                 // Which sprites active
  spriteColors: from $D027 to $D02E: byte,     // Individual colors
  borderColor: at $D020: byte,
  backgroundColor: at $D021: byte
end @map

@map sid at $D400 type
  voice1Freq: word,                             // Sound effects
  voice1Control: byte,
  voice2Freq: word,                             // Background music
  voice2Control: byte,
  voice3Freq: word,                             // Explosions
  voice3Control: byte,
  volume: byte
end @map

@map cia1 at $DC00 layout
  joystick2: at $DC01: byte,
  timerA: at $DC04: word,                       // For precise timing
  controlA: at $DC0E: byte
end @map

// Main game loop with comprehensive integration
export function main(): void
  initializeShootEmUp();

  while lives > 0
    // Nested control flow with complex expressions
    handlePlayerInput();
    updateBullets();
    updateEnemies();

    // Collision detection with nested loops and early exits
    if checkCollisions() then
      lives -= 1;

      if lives == 0 then
        break;  // Game over - exit main loop
      end if

      resetPlayerPosition();
      playExplosionSound();
    end if

    // Level progression logic
    if activeEnemies == 0 then
      level += 1;
      spawnEnemyWave(level);

      if level % 5 == 0 then          // Boss every 5 levels
        spawnBoss();
      end if
    end if

    renderFrame();
    syncToFrame();
  end while

  gameOverSequence();
end function

// Input with hardware integration and complex conditionals
function handlePlayerInput(): void
  let joy: byte = cia1.joystick2;

  // Movement with boundary checking
  if (joy & $04) && (playerX > 24) then         // Left
    playerX -= playerSpeed;
  else if (joy & $08) && (playerX < 296) then   // Right
    playerX += playerSpeed;
  end if

  if (joy & $01) && (playerY > 50) then         // Up
    playerY -= playerSpeed;
  else if (joy & $02) && (playerY < 230) then   // Down
    playerY += playerSpeed;
  end if

  // Shooting with rate limiting
  if (joy & $10) && canShoot() then             // Fire button
    fireBullet();
  end if

  // Update player sprite with 9-bit X coordinate handling
  vic.spriteCoords[0] = playerX & $FF;          // X low byte
  vic.spriteCoords[1] = playerY & $FF;          // Y coordinate

  if playerX >= 256 then
    vic.spriteXMSB |= $01;                      // Set X MSB bit 0
  else
    vic.spriteXMSB &= $FE;                      // Clear X MSB bit 0
  end if
end function

// Bullet management with array manipulation
function updateBullets(): void
  let bulletIndex: byte = 0;

  // Process all active bullets
  while bulletIndex < activeBullets
    let bulletX: byte = bullets[bulletIndex * 2];
    let bulletY: byte = bullets[bulletIndex * 2 + 1];

    // Move bullet up
    bulletY -= 4;

    // Remove bullets that leave screen
    if bulletY < 10 then
      removeBullet(bulletIndex);
      continue;  // Skip to next bullet without incrementing index
    end if

    bullets[bulletIndex * 2 + 1] = bulletY;     // Update Y position

    // Update corresponding sprite
    if bulletIndex < 7 then  // We have 8 sprites total (0-7), player uses 0
      vic.spriteCoords[(bulletIndex + 1) * 2] = bulletX;
      vic.spriteCoords[(bulletIndex + 1) * 2 + 1] = bulletY;
    end if

    bulletIndex += 1;
  end while
end function

// Enemy AI with state machine integration
function updateEnemies(): void
  for enemyIndex = 0 to activeEnemies - 1
    let enemyX: byte = enemies[enemyIndex * 4];      // X position
    let enemyY: byte = enemies[enemyIndex * 4 + 1];  // Y position
    let enemyType: byte = enemies[enemyIndex * 4 + 2]; // Type/behavior
    let enemyState: byte = enemies[enemyIndex * 4 + 3]; // AI state

    // Enemy AI state machine
    match enemyType
      case 1:  // Straight down movement
        enemyY += 2;

      case 2:  // Zigzag pattern
        enemyY += 1;

        if enemyState % 30 < 15 then
          enemyX += 1;
        else
          enemyX -= 1;
        end if

      case 3:  // Homing behavior (advanced AI)
        if enemyX < playerX then
          enemyX += 1;
        else if enemyX > playerX then
          enemyX -= 1;
        end if

        enemyY += 1;
    end match

    enemyState += 1;  // Increment state counter

    // Update enemy data
    enemies[enemyIndex * 4] = enemyX;
    enemies[enemyIndex * 4 + 1] = enemyY;
    enemies[enemyIndex * 4 + 3] = enemyState;

    // Remove enemies that leave screen
    if enemyY > 220 then
      removeEnemy(enemyIndex);
    end if
  next enemyIndex
end function

// Collision detection with nested loops and complex expressions
function checkCollisions(): boolean
  // Bullet vs Enemy collisions
  for bulletIndex = 0 to activeBullets - 1
    let bulletX: byte = bullets[bulletIndex * 2];
    let bulletY: byte = bullets[bulletIndex * 2 + 1];

    for enemyIndex = 0 to activeEnemies - 1
      let enemyX: byte = enemies[enemyIndex * 4];
      let enemyY: byte = enemies[enemyIndex * 4 + 1];

      // Collision detection with sprite bounds
      if (bulletX >= enemyX - 12) && (bulletX <= enemyX + 12) &&
         (bulletY >= enemyY - 10) && (bulletY <= enemyY + 10) then

        // Hit! Remove both bullet and enemy
        removeBullet(bulletIndex);
        removeEnemy(enemyIndex);

        playHitSound();
        return false;  // Continue game
      end if
    next enemyIndex
  next bulletIndex

  // Player vs Enemy collisions
  for enemyIndex = 0 to activeEnemies - 1
    let enemyX: byte = enemies[enemyIndex * 4];
    let enemyY: byte = enemies[enemyIndex * 4 + 1];

    if (playerX >= enemyX - 16) && (playerX <= enemyX + 16) &&
       (playerY >= enemyY - 12) && (playerY <= enemyY + 12) then
      return true;  // Player hit - lose life
    end if
  next enemyIndex

  return false;  // No collisions
end function

// Sound system integration with multiple voices
function playHitSound(): void
  sid.voice1Freq = 800;
  sid.voice1Control = $21;              // Sawtooth wave, gate on
end function

function playExplosionSound(): void
  sid.voice3Freq = 200;
  sid.voice3Control = $81;              // Noise wave, gate on
end function

// Game initialization with complete system setup
function initializeShootEmUp(): void
  // Hardware initialization
  vic.spriteEnable = $01;               // Enable player sprite
  vic.spriteColors[0] = 1;              // White player
  vic.borderColor = 0;                  // Black border
  vic.backgroundColor = 0;              // Black background

  // SID initialization
  sid.volume = $0F;                     // Maximum volume

  // CIA initialization for timing
  cia1.timerA = 20000;                  // Timer for frame sync
  cia1.controlA = $11;                  // Start timer A

  // Game state initialization
  activeBullets = 0;
  activeEnemies = 0;
  lives = 3;
  level = 1;

  spawnEnemyWave(1);
end function

// Enemy spawning with procedural generation
function spawnEnemyWave(waveLevel: byte): void
  let enemyCount: byte = 3 + waveLevel;  // More enemies per level

  for i = 0 to enemyCount - 1
    if activeEnemies < 10 then           // Max enemy limit
      let spawnX: byte = 32 + i * 32;    // Spread across screen
      let enemyType: byte = 1 + (i % 3); // Cycle through enemy types

      addEnemy(spawnX, 20, enemyType);
    end if
  next i
end function
```

## Integration Benefits Demonstrated

### 1. Seamless Component Interaction

**Lexer → Parser → Runtime Integration**:

```js
// This single line demonstrates integration of:
// - Lexer: Tokenizes @map, identifiers, operators, hex literals
// - Parser: Handles @map declaration, member access, expressions
// - @map System: Hardware register mapping
// - Expression Parser: Complex arithmetic and bitwise operations

@map vic at $D000 layout spriteEnable: at $D015: byte end @map

vic.spriteEnable |= (1 << spriteNumber) & spriteMask;
```

### 2. Complex Control Flow with Hardware

**State Machine + Hardware Integration**:

```js
// Game state machine with hardware feedback
match gameState
  case MENU_STATE:
    vic.borderColor = BLUE;

    if (cia1.joystick2 & FIRE_BUTTON) then
      gameState = PLAYING_STATE;
      vic.borderColor = BLACK;
    end if

  case PLAYING_STATE:
    while playerAlive && !gameComplete
      processGameFrame();

      if checkGameOver() then
        gameState = GAME_OVER_STATE;
        break;
      end if
    end while

  case GAME_OVER_STATE:
    vic.borderColor = RED;
    playGameOverSound();

    if (cia1.joystick2 & FIRE_BUTTON) then
      resetGame();
      gameState = MENU_STATE;
    end if
end match
```

### 3. Real-Time Systems Integration

**Frame-Perfect Game Loop**:

```js
function main(): void
  initializeHardware();

  while systemRunning
    // Frame synchronization with hardware
    waitForRasterLine(250);

    // Input processing (immediate response)
    handleInput();

    // Game logic (60 FPS update)
    if shouldUpdateLogic() then
      updateGameObjects();
      checkCollisions();
      updateGameState();
    end if

    // Rendering (every frame)
    renderToScreen();
    updateSprites();

    // Audio processing (continuous)
    updateSoundEffects();

    // Performance monitoring
    if frameCounter % 60 == 0 then
      calculateFPS();
    end if

    frameCounter += 1;
  end while
end function
```

## Advanced Integration Patterns

### Pattern 1: Hardware-Driven Control Flow

```js
// Raster interrupt-driven state changes
function rasterInterruptHandler(): void
  match vic.rasterLine
    case 50:   // Top of screen
      vic.backgroundColor = SKY_BLUE;
      currentZone = SKY_ZONE;

    case 100:  // Middle of screen
      vic.backgroundColor = GREEN;
      currentZone = GROUND_ZONE;

    case 200:  // Bottom of screen
      vic.backgroundColor = BROWN;
      currentZone = UNDERGROUND_ZONE;
  end match

  // Different game logic for each zone
  if currentZone == SKY_ZONE then
    updateFlyingEnemies();
  else if currentZone == GROUND_ZONE then
    updateGroundEnemies();
  else if currentZone == UNDERGROUND_ZONE then
    updateUndergroundEnemies();
  end if
end function
```

### Pattern 2: Data-Driven Game Systems

```js
// Configuration-driven behavior
@data const ENEMY_CONFIGS: byte[30] = [
  // Enemy type 1: Health, Speed, AI Pattern
  10, 2, 1,
  // Enemy type 2: Health, Speed, AI Pattern
  5, 4, 2,
  // Enemy type 3: Health, Speed, AI Pattern
  20, 1, 3
];

function spawnEnemy(enemyType: byte, x: byte, y: byte): void
  let configOffset: byte = enemyType * 3;
  let health: byte = ENEMY_CONFIGS[configOffset];
  let speed: byte = ENEMY_CONFIGS[configOffset + 1];
  let aiPattern: byte = ENEMY_CONFIGS[configOffset + 2];

  // Use configuration to drive behavior
  for i = 0 to MAX_ENEMIES - 1
    if !enemies[i].active then
      enemies[i].x = x;
      enemies[i].y = y;
      enemies[i].health = health;
      enemies[i].speed = speed;
      enemies[i].aiPattern = aiPattern;
      enemies[i].active = true;
      break;
    end if
  next i
end function
```

### Pattern 3: Resource Management Integration

```js
// Memory-efficient sprite management
@zp let spritePool: byte[64];           // Fast sprite data access
@ram let spriteFreeList: byte[8];       // Available sprite indices

function allocateSprite(): byte
  for i = 0 to 7
    if spriteFreeList[i] == 0 then      // Sprite available
      spriteFreeList[i] = 1;            // Mark as used
      vic.spriteEnable |= (1 << i);     // Enable in hardware
      return i;                         // Return sprite number
    end if
  next i

  return 255;                           // No sprites available
end function

function deallocateSprite(spriteNum: byte): void
  if spriteNum < 8 then
    spriteFreeList[spriteNum] = 0;      // Mark as free
    vic.spriteEnable &= ~(1 << spriteNum); // Disable in hardware
    vic.spriteCoords[spriteNum * 2] = 0;    // Reset position
    vic.spriteCoords[spriteNum * 2 + 1] = 0;
  end if
end function
```

## Error Recovery in Integration

The parser's error recovery works seamlessly across all integrated components:

```js
// Parser recovers from errors while maintaining context
function complexGameFunction(): void
  let x: byte = calculatePosition();

  invalid_syntax_here;                  // ERROR: Parser reports, continues

  // Parser successfully continues parsing the rest
  if x > screenWidth then
    x = 0;
  end if

  updateSpritePosition(x);              // This still parses correctly
end function

// Missing end statements - parser recovers
if playerHit then
  decrementLives();
  // Missing 'end if' - parser reports error, attempts recovery

while gameRunning                       // Parser continues here
  updateGame();
end while                              // This completes successfully
```

## What Integration CANNOT Do (Current Limitations)

**Cross-Module Integration (Future)**:

```js
// ❌ Not yet supported - cross-module integration
import { EnemyAI } from Game.AI;        // Module system parsing works
import { SoundEffects } from Audio.SFX; // But linking not implemented

// ❌ Type checking across modules
let enemy: EnemyAI = new EnemyAI();     // No semantic validation yet
```

**Advanced Optimization (Future)**:

```js
// ❌ No compile-time optimization
for i = 0 to 100
  constantValue = 42;                   // Not optimized out
next i

// ❌ No dead code elimination
if false then
  unreachableCode();                    // Not removed
end if
```

**Runtime Integration (Future)**:

```js
// ❌ No runtime type checking
let sprite: word = vic.spriteEnable;    // Type mismatch not caught at runtime
borderColor = 256;                      // Range error not caught at runtime
```

## Next Steps

This completes Step 7. The integration analysis demonstrates how all Blend65 compiler components work together seamlessly to create complete, working C64 games with modern language features, hardware access, and robust error recovery.

**Ready for**: Step 8 - Function System Analysis
