# Phase 3: Project Templates

> **Document**: 06-templates.md
> **Parent**: [Index](00-index.md)
> **Phase**: 3 (with CLI Commands)
> **Sessions**: Included in Phase 3
> **Dependencies**: init Command (Task 3.1)

---

## Overview

Project templates for `blend65 init --template=<name>`.

---

## Available Templates

| Template | Description | Files |
|----------|-------------|-------|
| `basic` | Minimal hello world | 3 files |
| `game` | Game framework with input/graphics | 6 files |
| `demo` | Demo effect starter | 5 files |

---

## Template: basic

Minimal project structure for getting started.

```
my-project/
├── blend65.json
├── src/
│   └── main.blend
└── .gitignore
```

### blend65.json

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "target": "c64",
  "entry": "src/main.blend",
  "outDir": "build",
  "optimization": "O0",
  "debug": "vice"
}
```

### src/main.blend

```js
module Main

@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;

function main(): void {
  borderColor = 0;      // Black border
  backgroundColor = 0;  // Black background
  
  // Your code here!
}
```

### .gitignore

```
build/
*.prg
*.asm
*.labels
node_modules/
```

---

## Template: game

Game framework with input handling and graphics.

```
my-game/
├── blend65.json
├── src/
│   ├── main.blend        # Entry point
│   ├── game.blend        # Game loop
│   ├── input.blend       # Input handling
│   ├── graphics.blend    # Screen/sprite handling
│   └── lib/
│       └── hardware.blend  # Hardware definitions
└── .gitignore
```

### src/main.blend

```js
module Main

import { initGraphics } from graphics
import { gameLoop } from game

function main(): void {
  initGraphics();
  gameLoop();
}
```

### src/game.blend

```js
module Game

import { readInput } from input
import { render } from graphics

export function gameLoop(): void {
  // Main game loop
  while (true) {
    readInput();
    update();
    render();
  }
}

function update(): void {
  // Update game state
}
```

### src/input.blend

```js
module Input

@map keyboard at $DC00: byte;
@map keyboardRow at $DC01: byte;

export function readInput(): void {
  // Read keyboard state
}
```

### src/graphics.blend

```js
module Graphics

@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;
@map screenMemory at $0400: byte[1000];

export function initGraphics(): void {
  borderColor = 0;
  backgroundColor = 0;
  clearScreen();
}

export function clearScreen(): void {
  // Clear screen memory
}

export function render(): void {
  // Render game state to screen
}
```

### src/lib/hardware.blend

```js
module Hardware

// VIC-II Registers
@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;
@map spriteEnable at $D015: byte;
@map spriteXMsb at $D010: byte;

// SID Registers
@map sidVolume at $D418: byte;

// CIA Registers
@map cia1DataA at $DC00: byte;
@map cia1DataB at $DC01: byte;
```

---

## Template: demo

Demo effect starter with raster interrupts.

```
my-demo/
├── blend65.json
├── src/
│   ├── main.blend
│   ├── effects.blend
│   ├── music.blend
│   └── lib/
│       └── raster.blend
└── .gitignore
```

### src/main.blend

```js
module Main

import { initRaster } from lib/raster
import { initMusic } from music
import { runEffect } from effects

function main(): void {
  initRaster();
  initMusic();
  runEffect();
}
```

### src/effects.blend

```js
module Effects

@map borderColor at $D020: byte;

export function runEffect(): void {
  // Main effect loop
  while (true) {
    // Update effect
  }
}
```

### src/music.blend

```js
module Music

export function initMusic(): void {
  // Initialize SID music player
}

export function playMusic(): void {
  // Called from IRQ
}
```

### src/lib/raster.blend

```js
module Raster

@map irqVector at $0314: word;
@map rasterLine at $D012: byte;
@map irqControl at $D01A: byte;

export function initRaster(): void {
  // Set up raster interrupt
}
```

---

## Template Storage

Templates are bundled with the CLI package:

```
packages/cli/
└── templates/
    ├── basic/
    │   ├── blend65.json
    │   ├── .gitignore
    │   └── src/
    │       └── main.blend
    ├── game/
    │   ├── blend65.json
    │   ├── .gitignore
    │   └── src/
    │       ├── main.blend
    │       ├── game.blend
    │       ├── input.blend
    │       ├── graphics.blend
    │       └── lib/
    │           └── hardware.blend
    └── demo/
        ├── blend65.json
        ├── .gitignore
        └── src/
            ├── main.blend
            ├── effects.blend
            ├── music.blend
            └── lib/
                └── raster.blend
```

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 3.1.a | Basic template files | [ ] |
| 3.1.b | Game template files | [ ] |
| 3.1.c | Demo template files | [ ] |
| 3.1.d | Template copy utility | [ ] |

---

**This document defines project templates for Blend65.**