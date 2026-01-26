# Blend65

> **⚠️ DEVELOPMENT STATUS: 60-70% COMPLETE**
>
> The compiler frontend is fully functional with production-quality lexer, parser, and semantic analyzer.
> The backend (IL generation and 6502 code generation) is in development. While the compiler can parse
> and validate Blend65 programs, it cannot yet generate executable code for the Commodore 64.
>
> **Current milestone**: 2,428 tests passing | Next phase: IL Generator

## Overview

Blend65 is a modern programming language compiler targeting 6502-based systems including the Commodore 64, VIC-20, and Commander X16. The language provides modern programming constructs while generating efficient assembly code for vintage hardware.

## Language Features

The language uses C-style syntax with direct hardware access capabilities:

```js
module C64Game.Snake;

import { setSpritePosition, enableSprite } from c64.sprites;
import { joystickLeft, joystickRight } from c64.input;
import { playNote } from c64.sid;

@zp var snakeX: byte = 160;     // Zero-page variable allocation
var score: word = 0;            // 16-bit integer
var gameState: GameState = PLAYING;

enum GameState {
    MENU,
    PLAYING,
    GAME_OVER
}

function updateSnake(): void {
    if (joystickLeft()) {
        snakeX = snakeX - 2;
    }

    setSpritePosition(0, snakeX, 100);

    if (snakeX == appleX) {
        score = score + 10;
        playNote(0, 440);
    }
}
```

### Storage Classes

Variables can be declared with specific memory allocation strategies:

- `@zp var` - Zero page allocation for fastest access
- `@ram var` - Standard RAM allocation
- `@data var` - Initialized data section
- `var` - Same as `@ram var`

### Memory-Mapped Hardware

The `@map` system provides type-safe access to hardware registers (unique to Blend65):

```js
// Simple register mapping
@map borderColor at $D020: byte;

// Structured layout mapping
@map vic at $D000 layout {
    spriteX: at $00: byte[8],
    borderColor: at $20: byte,
    backgroundColor: at $21: byte
}

// Type-based mapping
@map sid at $D400 type SIDRegisters;

// Usage - clean, self-documenting hardware access
vic.borderColor = LIGHT_BLUE;
sid.voice1.frequency = 440;
```

### Callback Functions

Type-safe function pointers enable interrupt-driven programming and behavioral dispatch:

```js
callback interruptHandler: function(): void;
callback behaviorFunction: function(entity: Entity): void;

var rasterCallbacks: interruptHandler[8];
var enemyBehaviors: behaviorFunction[16];
```

### Control Flow

Blend65 supports familiar C-style control flow constructs:

```js
// If-else statements
if (score > highScore) {
    highScore = score;
} else {
    displayMessage("Try again!");
}

// While loops
while (gameRunning) {
    updateGame();
    renderFrame();
}

// For loops with range syntax
for (i = 0 to 7) {
    sprites[i].update();
}

// For loops with step and downto
for (i = 0 to 100 step 2) {
    evenNumbers[i / 2] = i;
}

for (i = 10 downto 0) {
    countdown[10 - i] = i;
}

// Do-while loops
do {
    waitForVBlank();
} while (!frameReady);

// Switch statements
switch (direction) {
    case UP: moveUp();
    case DOWN: moveDown();
    case LEFT: moveLeft();
    case RIGHT: moveRight();
}

// Ternary expressions
let color: byte = isHit ? RED : GREEN;
```

## Target Platforms

- **Commodore 64** - Full VIC-II, SID, and CIA support
- **VIC-20** - VIA and basic graphics support
- **Commander X16** - VERA graphics and enhanced features
- **Generic 6502** - Basic instruction set compatibility

## Implementation Status

**Compiler Pipeline:**

```
Source → Lexer ✅ → Parser ✅ → AST ✅ → Semantic ✅ → IL 🔜 → CodeGen 🔜 → Assembly 🔜
```

### Completed (60-70%)

| Component | Tests | Status |
|-----------|-------|--------|
| **Lexer** | 150+ | ✅ Production-ready |
| **Parser** | 400+ | ✅ Production-ready |
| **AST System** | 100+ | ✅ Production-ready |
| **Semantic Analyzer** | 1,365+ | ✅ Production-ready |
| **Advanced Analysis (Phase 8)** | 500+ | ✅ Complete |
| **Hardware Analyzers (C64/C128/X16)** | 200+ | ✅ Complete |
| **Integration Tests** | 313+ | ✅ Passing |

**Semantic Analysis Highlights:**

- Complete type checking with multi-module support
- Control flow analysis with CFG construction
- Definite assignment and variable usage tracking
- Dead code and unused function detection
- Data flow analysis (reaching definitions, liveness, constant propagation)
- Escape analysis and purity analysis for optimization hints
- C64-specific hardware analysis (VIC-II timing, SID conflict detection)

### In Development

- **IL Generator** - Intermediate language for optimization and portability
- **Code Generator** - 6502 instruction selection and register allocation
- **Assembler Integration** - PRG file generation

### Planned

- Standard library (VIC-II, SID, CIA wrappers)
- Additional examples and documentation
- Performance optimization passes

## Development

This project uses TypeScript and is organized as a monorepo with Yarn workspaces.

```bash
# Install dependencies
yarn install

# Build all packages
yarn build

# Run tests
yarn test

# Clean build artifacts
yarn clean

# Build, clean, and test (full validation)
yarn clean && yarn build && yarn test
```

**Requirements:**

- Node.js >= 22.0.0
- Yarn 1.x (< 2.0.0)

## Project Structure

```
blend65/
├── packages/
│   └── compiler/          # Main compiler package
│       └── src/
│           ├── lexer/     # Tokenization
│           ├── parser/    # Syntax parsing
│           ├── ast/       # AST nodes and utilities
│           ├── semantic/  # Type checking and analysis
│           └── target/    # Code generation (WIP)
├── docs/
│   └── language-specification/  # Complete language spec
├── examples/              # Example Blend65 programs
└── plans/                 # Development roadmap
```

## Documentation

- [Language Specification](docs/language-specification/README.md) - Complete syntax and semantics reference
- [Compiler Master Plan](plans/COMPILER-MASTER-PLAN.md) - Implementation roadmap and status

## License

> **📜 Elastic License 2.0 (ELv2)**
>
> This software is licensed under the Elastic License 2.0. You are free to use it to create
> games and software, but you cannot sell the compiler itself or offer it as a service.
> See [LICENSE](LICENSE) for full details.

| Use Case | Allowed |
|----------|---------|
| Create open-source games/software | ✅ Yes |
| Create commercial games/software | ✅ Yes |
| Modify Blend65 for your own use | ✅ Yes |
| Contribute improvements back | ✅ Yes |
| Sell Blend65 as a product | ❌ No |
| Include Blend65 in a commercial tool | ❌ No |
| Offer Blend65 as a hosted service | ❌ No |
| Fork to create competing compiler | ❌ No |

## Contributing

The project is under active development. See the [master plan](plans/COMPILER-MASTER-PLAN.md) for current priorities and the implementation roadmap.