# Complete Examples

> **Status**: C-Style Syntax Specification  
> **Last Updated**: January 25, 2026  
> **Related Documents**: [Module System](04-module-system.md), [Functions](11-functions.md), [Variables](10-variables.md)

## Overview

This document provides complete, working examples of Blend65 programs demonstrating various language features and common patterns.

## Minimal Program

The simplest valid Blend65 program:

```js
module Main;

export function main(): void {
}
```

## Hello World (Conceptual)

```js
module Hello.World;

// Hardware registers (C64)
@map screenRAM from $0400 to $07E7: byte;
@map colorRAM from $D800 to $DBE7: byte;

// Message data
@data const message: string = "HELLO, WORLD!";

function clearScreen(): void {
  for (i = 0 to 999) {
    screenRAM[i] = 32;   // Space character
    colorRAM[i] = 14;    // Light blue
  }
}

export function main(): void {
  clearScreen();
  // Display message (implementation details)
}
```

## Module with Import and Export

```js
module Game.Main;

import { setSpritePosition } from target.sprites;
import { clearScreen } from c64.graphics;

export function main(): void {
  clearScreen();
  setSpritePosition(0, 100, 50);
}
```

## Storage Classes and Declarations

```js
module Game.Memory;

// Zero-page variables (fast access)
@zp let counter: byte;
@zp let playerX: byte = 10;
@zp let playerY: byte = 10;

// General RAM (default)
@ram let buffer: byte[256];
let screenBuffer: byte[1000];  // Defaults to @ram

// Initialized data
@data const initialized: word = 1000;
@data const lookupTable: byte[256] = [...];

export function update(): void {
  counter += 1;
  buffer[counter] = playerX;
}
```

## Loop Examples

### For Loop with Break/Continue

```js
module Loops.Example;

let data: byte[10];

function processData(): void {
  for (i = 0 to 10) {
    // Skip even indices
    if (i % 2 == 0) {
      continue;
    }
    
    // Stop at 5
    if (i == 5) {
      break;
    }
    
    data[i] = i * 2;
  }
}
```

### Nested Loops

```js
module Screen.Clear;

@map screenRAM from $0400 to $07E7: byte;

function clearScreen(): void {
  for (y = 0 to 24) {
    for (x = 0 to 39) {
      let offset: word = y * 40 + x;
      screenRAM[offset] = 32;  // Space character
    }
  }
}
```

## Switch Statement with Default

```js
module State.Machine;

enum GameState {
  MENU = 0,
  PLAYING = 1,
  PAUSED = 2,
  GAME_OVER = 3
}

@zp let currentState: byte = GameState.MENU;

function handleInput(): void {
  switch (currentState) {
    case GameState.MENU:
      showMenu();
    case GameState.PLAYING:
      updateGame();
    case GameState.PAUSED:
      showPauseMenu();
    default:
      // Unexpected state - reset
      currentState = GameState.MENU;
  }
}
```

## Enum and State Machine

```js
module Game.State;

enum GameState {
  MENU,
  PLAYING,
  PAUSED,
  GAME_OVER
}

enum Direction {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3
}

@zp let currentState: byte = GameState.MENU;
@zp let playerDirection: byte = Direction.UP;

function gameLoop(): void {
  while (true) {
    switch (currentState) {
      case GameState.MENU:
        if (handleMenuInput()) {
          currentState = GameState.PLAYING;
        }
      case GameState.PLAYING:
        updatePlayer();
        updateEnemies();
        checkCollisions();
      case GameState.PAUSED:
        if (resumePressed()) {
          currentState = GameState.PLAYING;
        }
      default:
        currentState = GameState.MENU;
    }
  }
}

function updatePlayer(): void {
  switch (playerDirection) {
    case Direction.UP:
      movePlayerUp();
    case Direction.DOWN:
      movePlayerDown();
    case Direction.LEFT:
      movePlayerLeft();
    case Direction.RIGHT:
      movePlayerRight();
  }
}
```

## Multi-Line Expressions

```js
module Expression.Example;

@zp let x: byte = 10;
@zp let y: byte = 20;
@zp let row: byte = 5;
@zp let column: byte = 10;

function calculateScreenAddress(): word {
  // Expression spans multiple lines
  let screenAddr: word = 
    $0400 + 
    (row * 40) + 
    column;
  
  return screenAddr;
}

function calculateColor(): byte {
  let red: byte = 2;
  let green: byte = 5;
  
  // Complex expression on multiple lines
  let colorValue: byte =
    (red << 4) | 
    (green & 0x0F);
  
  return colorValue;
}
```

## Complete Game Example

```js
module Game.Snake;

// === Hardware Registers ===
@map vicBorderColor at $D020: byte;
@map vicBackgroundColor at $D021: byte;
@map screenRAM from $0400 to $07E7: byte;
@map colorRAM from $D800 to $DBE7: byte;

// === Game State ===
enum GameState {
  INIT = 0,
  PLAYING = 1,
  GAME_OVER = 2
}

enum Direction {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3
}

// === Zero-Page Variables (Fast Access) ===
@zp let gameState: byte = GameState.INIT;
@zp let snakeX: byte = 10;
@zp let snakeY: byte = 10;
@zp let snakeDirection: byte = Direction.RIGHT;
@zp let foodX: byte = 15;
@zp let foodY: byte = 15;
@zp let score: word = 0;
@zp let frameCounter: byte = 0;

// === RAM Variables ===
let snakeBodyX: byte[100];
let snakeBodyY: byte[100];
let snakeLength: byte = 1;

// === Constants ===
const MAX_SNAKE_LENGTH: byte = 100;
const SCREEN_WIDTH: byte = 40;
const SCREEN_HEIGHT: byte = 25;

// === Functions ===

function init(): void {
  vicBorderColor = 0;
  vicBackgroundColor = 0;
  
  snakeX = 10;
  snakeY = 10;
  snakeDirection = Direction.RIGHT;
  snakeLength = 1;
  score = 0;
  
  clearScreen();
  spawnFood();
  gameState = GameState.PLAYING;
}

function clearScreen(): void {
  for (i = 0 to 999) {
    screenRAM[i] = 32;   // Space
    colorRAM[i] = 0;     // Black
  }
}

function spawnFood(): void {
  // Simple food placement (not random)
  foodX = 15;
  foodY = 15;
  drawFood();
}

function drawFood(): void {
  let offset: word = foodY * SCREEN_WIDTH + foodX;
  screenRAM[offset] = 81;  // Food character
  colorRAM[offset] = 2;    // Red
}

function updateSnake(): void {
  // Move snake head
  switch (snakeDirection) {
    case Direction.UP:
      snakeY -= 1;
    case Direction.DOWN:
      snakeY += 1;
    case Direction.LEFT:
      snakeX -= 1;
    case Direction.RIGHT:
      snakeX += 1;
  }
  
  // Check boundaries
  if (snakeX >= SCREEN_WIDTH) {
    gameState = GameState.GAME_OVER;
    return;
  }
  
  if (snakeY >= SCREEN_HEIGHT) {
    gameState = GameState.GAME_OVER;
    return;
  }
  
  // Check food collision
  if (snakeX == foodX) {
    if (snakeY == foodY) {
      score += 10;
      snakeLength += 1;
      spawnFood();
    }
  }
  
  // Draw snake
  drawSnake();
}

function drawSnake(): void {
  let offset: word = snakeY * SCREEN_WIDTH + snakeX;
  screenRAM[offset] = 83;  // Snake character
  colorRAM[offset] = 5;    // Green
}

function gameLoop(): void {
  while (gameState == GameState.PLAYING) {
    frameCounter += 1;
    
    // Update every 10 frames
    if (frameCounter >= 10) {
      frameCounter = 0;
      updateSnake();
    }
  }
}

export function main(): void {
  init();
  gameLoop();
}
```

## Utility Functions Module

```js
module Utils.Math;

// Absolute value for byte
export function abs(x: byte): byte {
  if (x > 127) {
    return 256 - x;
  }
  return x;
}

// Minimum of two bytes
export function min(a: byte, b: byte): byte {
  if (a < b) {
    return a;
  }
  return b;
}

// Maximum of two bytes
export function max(a: byte, b: byte): byte {
  if (a > b) {
    return a;
  }
  return b;
}

// Clamp value between min and max
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

## Hardware Access Module

```js
module C64.Hardware;

// === VIC-II Registers ===
@map vic at $D000 layout {
  sprites: from $D000 to $D00F: byte,
  spriteXMSB: at $D010: byte,
  control1: at $D011: byte,
  raster: at $D012: byte,
  spriteEnable: at $D015: byte,
  control2: at $D016: byte,
  interruptStatus: at $D019: byte,
  interruptEnable: at $D01A: byte,
  borderColor: at $D020: byte,
  backgroundColor0: at $D021: byte,
  backgroundColor1: at $D022: byte,
  backgroundColor2: at $D023: byte,
  backgroundColor3: at $D024: byte
}

// === SID Voice 1 ===
@map sidVoice1 at $D400 type {
  frequencyLo: byte,
  frequencyHi: byte,
  pulseLo: byte,
  pulseHi: byte,
  waveform: byte,
  attackDecay: byte,
  sustainRelease: byte
}

// === Screen and Color RAM ===
@map screenRAM from $0400 to $07E7: byte;
@map colorRAM from $D800 to $DBE7: byte;

// === Initialization ===
export function initGraphics(): void {
  vic.borderColor = 0;
  vic.backgroundColor0 = 0;
  vic.spriteEnable = 0;
}

export function initSound(): void {
  sidVoice1.waveform = 0;
  sidVoice1.attackDecay = 0;
  sidVoice1.sustainRelease = 0;
}

// === Sprite Functions ===
export function setSpritePosition(id: byte, x: byte, y: byte): void {
  let baseIndex: byte = id * 2;
  vic.sprites[baseIndex] = x;
  vic.sprites[baseIndex + 1] = y;
}

export function enableSprite(id: byte): void {
  let mask: byte = 1 << id;
  vic.spriteEnable = vic.spriteEnable | mask;
}
```

## Callback Functions Example

```js
module Interrupts.Example;

@zp let frameCount: byte = 0;
@map vicBorderColor at $D020: byte;

callback function vblankIRQ(): void {
  // Vertical blank interrupt
  frameCount += 1;
  
  if (frameCount >= 60) {
    frameCount = 0;
  }
}

callback function rasterIRQ(): void {
  // Raster interrupt at specific scanline
  vicBorderColor = frameCount;
}

export function setupInterrupts(): void {
  // Setup interrupt vectors (implementation details)
}
```

## Ternary and Do-While Examples

```js
module Advanced.Examples;

@zp let counter: byte = 0;
@zp let value: byte = 0;

// Ternary conditional expression
function getStatus(): byte {
  return counter > 10 ? 1 : 0;
}

function getMax(a: byte, b: byte): byte {
  return a > b ? a : b;
}

// Do-while loop (executes at least once)
function countUpToTen(): void {
  counter = 0;
  do {
    counter += 1;
    processValue(counter);
  } while (counter < 10);
}

// For loop with step
function fillEverySecond(): void {
  for (i = 0 to 100 step 2) {
    buffer[i] = 0xFF;
  }
}

// For loop counting down
function countdown(): void {
  for (i = 10 downto 0) {
    displayNumber(i);
    waitOneSecond();
  }
}

// Nested ternary (use sparingly)
function getColorForValue(val: byte): byte {
  return val == 0 ? 0 :
         val < 10 ? 5 :
         val < 50 ? 7 : 1;
}
```

## See Also

- [Variables](10-variables.md) - Variable declarations and storage classes
- [Functions](11-functions.md) - Function declarations and usage
- [Module System](04-module-system.md) - Modules, imports, and exports
- [Control Flow](06-expressions-statements.md) - if, while, for, switch statements
- [Memory-Mapped](12-memory-mapped.md) - Hardware register access