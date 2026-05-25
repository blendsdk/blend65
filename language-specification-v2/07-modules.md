# Module System

> **Status**: Draft  
> **Related Documents**: [Functions](06-functions.md), [Variables](03-variables.md)

## Overview

Blend65 uses a module system to organize code into logical units and manage dependencies. Each source file represents a module with its own namespace.

## Module Declaration

Every Blend65 source file must begin with a module declaration.

### Syntax

```ebnf
module_decl = "module" , name , ";" ;
name = identifier , { "." , identifier } ;
```

### Examples

**Simple module:**
```js
module Main;
```

**Hierarchical module:**
```js
module Game.Snake;
module c64.graphics.screen;
module Utils.Math;
```

### Module Names

Module names are **dot-separated** identifiers forming a hierarchical namespace:

- `Game` - Top-level module
- `Game.Snake` - Sub-module
- `c64.graphics.screen` - Deeply nested module

**Rules:**
- Module names are case-sensitive
- Each component must be a valid identifier
- No limit on nesting depth
- Must end with a semicolon

## Import System

The `import` statement brings names from other modules into the current scope.

### Syntax

```ebnf
import_decl = "import" , "{" , import_list , "}" , "from" , name , ";" ;
import_list = identifier , { "," , identifier } ;
```

### Importing Single Items

```js
import { clearScreen } from c64.graphics;
import { setSpritePosition } from c64.sprites;
```

### Importing Multiple Items

```js
import { clearScreen, setPixel, drawLine } from c64.graphics.screen;
import { initSID, playNote, stopSound } from c64.audio;
```

### Import Behavior

Imports are:
- **Name-level imports** - You import specific identifiers, not entire modules
- **Compile-time** - Resolution happens during compilation
- **Explicit** - You must explicitly import each name you use

**Example:**

```js
module Game.Main;

// Import only what you need
import { clearScreen, setPixel } from c64.graphics;
import { setSpritePosition } from c64.sprites;

export function main(): void {
  clearScreen();
  setPixel(10, 10);
  setSpritePosition(0, 100, 50);
}
```

### Import Errors

**Importing non-existent names:**
```js
import { nonExistent } from c64.graphics;  // Error: 'nonExistent' not found
```

**Duplicate imports:**
```js
import { clearScreen } from c64.graphics;
import { clearScreen } from c64.other;  // Error: Name conflict
```

## Export System

The `export` keyword makes declarations visible to other modules.

### Syntax

```ebnf
export_decl = "export" , ( function_decl | variable_decl | type_decl | enum_decl ) ;
```

### Exporting Functions

```js
// Export function declaration
export function clearScreen(): void {
  // ...
}

// Export callback function
export callback function rasterIRQ(): void {
  // ...
}
```

### Exporting Variables

```js
// Export constant
export const MAX_SPRITES: byte = 8;

// Export variable with storage class
export @zp let frameCounter: byte = 0;
```

### Exporting Types

```js
// Export type alias
export type SpriteId = byte;

// Export enum
export enum GameState {
  MENU,
  PLAYING,
  PAUSED
}
```

### Entry Point: main Function

The **entry point** of a Blend65 program is the `main` function. It must be exported:

```js
export function main(): void {
  // Entry point - program starts here
}
```

If `main` is declared without `export`, the parser automatically marks it as exported.

**Only one exported `main` function** is allowed per module.

### Re-exports (Not Supported)

Re-exporting previously imported names is **not currently supported**:

```js
import { foo } from some.lib;
export foo;  // ❌ Error: ReExportNotSupported
```

**Workaround:**
```js
import { foo } from some.lib;

export function myFoo(): void {
  foo();  // Wrap the imported function
}
```

## Module Resolution

Blend65 uses a **file-based module system**:

- Each `.blend` source file represents one module
- Module names typically correspond to file paths
- The compiler resolves imports by searching configured module paths

**Example file structure:**
```
src/
  main.blend          → module Main;
  game/
    snake.blend       → module game.snake;
  c64/
    graphics.blend    → module c64.graphics;
    sprites.blend     → module c64.sprites;
```

**Imports:**
```js
// In main.blend
module Main;

import { update } from game.snake;
import { clearScreen } from c64.graphics;
```

## Visibility Rules

### Public (Exported) Members

Members marked with `export` are visible to other modules:

```js
module Utils.Math;

export function abs(x: byte): byte {
  if (x > 127) {
    return 256 - x;
  }
  return x;
}

export const PI: byte = 3;  // Approximation for 8-bit
```

### Private (Non-Exported) Members

Members without `export` are private to the module:

```js
module Utils.Math;

// Private helper function
function internalHelper(x: byte): byte {
  // Only accessible within Utils.Math
}

// Public function
export function publicAPI(x: byte): byte {
  return internalHelper(x);
}
```

## Complete Example

**File: c64/graphics.blend**
```js
module c64.graphics;

// Hardware addresses as constants
const SCREEN_BASE: word = $0400;
const COLOR_BASE: word = $D800;
const SCREEN_WIDTH: byte = 40;

// Exported functions
export function clearScreen(): void {
  for (let i: word = 0; i < 1000; i += 1) {
    poke(SCREEN_BASE + i, 32);   // Space character
    poke(COLOR_BASE + i, 14);    // Light blue
  }
}

export function setPixel(x: byte, y: byte): void {
  let offset: word = y * SCREEN_WIDTH + x;
  poke(SCREEN_BASE + offset, 160);  // Filled block character
}
```

**File: game.blend**
```js
module Game.Main;

// Import from c64.graphics
import { clearScreen, setPixel } from c64.graphics;

// Game variables
@zp let playerX: byte = 10;
@zp let playerY: byte = 10;

function init(): void {
  clearScreen();
  setPixel(playerX, playerY);
}

export function main(): void {
  init();
  
  while (true) {
    // Game loop...
  }
}
```

## Module System Best Practices

### 1. Use Hierarchical Module Names

Organize related modules under common prefixes:

```js
module c64.graphics.screen;
module c64.graphics.sprites;
module c64.audio.sid;
module game.snake.logic;
module game.snake.rendering;
```

### 2. Import Only What You Need

Don't import unnecessary names:

```js
// ✅ GOOD: Import only what you use
import { clearScreen } from c64.graphics;

// ❌ AVOID: Importing unused names
import { clearScreen, setPixel, drawLine, fillRect } from c64.graphics;
// (when you only use clearScreen)
```

### 3. Export Deliberately

Only export the public API:

```js
module Utils.Math;

// Private helpers (not exported)
function square(x: byte): byte {
  return x * x;
}

// Public API (exported)
export function distance(x1: byte, y1: byte, x2: byte, y2: byte): byte {
  // Implementation uses private helpers
}
```

### 4. One Entry Point Per Program

Have exactly one `main` function across all modules:

```js
// In your main game file
export function main(): void {
  // Entry point
}
```

### 5. Group Related Imports

```js
// ✅ GOOD: Grouped by module
import { clearScreen, setPixel } from c64.graphics;
import { setSpritePosition, setSpriteColor } from c64.sprites;
import { playNote, stopSound } from c64.audio;

// ❌ AVOID: Scattered imports
import { clearScreen } from c64.graphics;
import { setSpritePosition } from c64.sprites;
import { setPixel } from c64.graphics;
```

## Module System Limitations

Current limitations:
- **No circular imports** - Modules cannot import from each other cyclically
- **No wildcard imports** - Cannot import all names from a module (`import * from ...`)
- **No re-exports** - Cannot re-export imported names
- **No dynamic imports** - All imports are resolved at compile time