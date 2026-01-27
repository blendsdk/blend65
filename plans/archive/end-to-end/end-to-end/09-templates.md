# Project Templates

> **Status**: Planning  
> **Priority**: LOW  
> **Dependencies**: Phase 4 (CLI)

---

## Codebase Analysis (Validated)

**Template Storage Status: DOES NOT EXIST**

No template files exist yet. The `packages/cli/templates/` directory will be created.

**Existing Example Code (Reference):**

The `examples/` directory contains Blend65 code that can inform template content:

```
examples/
├── lib/
│   └── system.blend        # System library
└── snake-game/
    ├── game-state.blend     # Game state example
    ├── hardware.blend       # Hardware access example
    ├── README.md
    └── lib/
        ├── c64-kernal.blend # KERNAL routines
        ├── math.blend       # Math utilities
        └── random.blend     # RNG utilities
```

**Template Implementation:**
- Templates will be bundled with CLI package
- Stored in `packages/cli/templates/`
- Copied to user's project directory on `blend65 init`

**Template Content Guidelines:**
- Reference `examples/` for realistic Blend65 code patterns
- Use C64 hardware definitions from `examples/snake-game/hardware.blend`
- Keep templates minimal but functional

---

## Overview

Project templates for `blend65 init --template=<name>`.

---

## Available Templates

| Template | Description | Files |
|----------|-------------|-------|
| `basic` | Minimal hello world | 2 files |
| `game` | Game framework with input/graphics | 5 files |
| `demo` | Demo effect starter | 4 files |

---

## Template: basic

```
my-project/
├── blend65.json
├── src/
│   └── main.blend
└── .gitignore
```

**src/main.blend:**
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

---

## Template: game

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
├── assets/
│   └── .gitkeep
└── .gitignore
```

**src/main.blend:**
```js
module Main

import { gameLoop } from game
import { initGraphics } from graphics

function main(): void {
  initGraphics();
  gameLoop();
}
```

---

## Template: demo

```
my-demo/
├── blend65.json
├── src/
│   ├── main.blend
│   ├── effects.blend
│   ├── music.blend
│   └── lib/
│       └── raster.blend
├── assets/
│   └── .gitkeep
└── .gitignore
```

---

## Template Storage

Templates stored in CLI package:

```
packages/cli/
└── templates/
    ├── basic/
    │   ├── blend65.json
    │   └── src/
    │       └── main.blend
    ├── game/
    │   └── ...
    └── demo/
        └── ...
```

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 9.1 | Basic template | [ ] |
| 9.2 | Game template | [ ] |
| 9.3 | Demo template | [ ] |
| 9.4 | Template system | [ ] |

---

**This document defines project templates for Blend65.**