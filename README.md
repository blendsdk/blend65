# Blend65

> **⚠️ DEVELOPMENT STATUS: COMPILER NOT FUNCTIONAL**
>
> This compiler is currently under active development and does not produce working code.
> The project is in the implementation phase - while the frontend (lexer, parser, AST) is complete,
> the backend code generation is not yet implemented. No executable programs can be compiled at this time.
>
> Follow development progress in the [Project Status](docs/PROJECT_STATUS.md) documentation.

## Overview

Blend65 is a modern programming language compiler targeting 6502-based systems including the Commodore 64, VIC-20, and Commander X16. The language aims to provide modern programming constructs while generating efficient assembly code for vintage hardware.

## Language Features

The language syntax combines familiar programming concepts with direct hardware access:

```js
module C64Game.Snake

import setSpritePosition, enableSprite from c64.sprites
import joystickLeft, joystickRight from c64.input
import playNote from c64.sid

zp var snakeX: byte = 160      // Zero-page variable allocation
var score: word = 0            // 16-bit integer
var gameState: GameState = PLAYING

enum GameState
    MENU, PLAYING, GAME_OVER
end enum

function updateSnake(): void
    if joystickLeft() then
        snakeX = snakeX - 2
    end if

    setSpritePosition(0, snakeX, 100)

    if snakeX == appleX then
        score = score + 10
        playNote(0, 440)
    end if
end function
```

### Storage Classes

Variables can be declared with specific memory allocation strategies:

- `zp var` - Zero page allocation for fastest access
- `ram var` - Standard RAM allocation
- `data var` - Initialized data section
- `const var` - Compile-time constants
- `io var` - Memory-mapped I/O registers

### Hardware Integration

The language provides direct access to platform-specific hardware through module imports:

```js
import setRasterInterrupt from c64.interrupts
import setSpriteCollision from c64.vic
import setVoiceWaveform from c64.sid

callback function rasterIRQ(): void
    setBackgroundColor(BLUE)
end function

setRasterInterrupt(100, rasterIRQ)
```

### Callback Functions

Type-safe function pointers enable interrupt-driven programming and behavioral dispatch:

```js
callback interruptHandler: function(): void
callback behaviorFunction: function(entity: Entity): void

var rasterCallbacks: interruptHandler[8]
var enemyBehaviors: behaviorFunction[16]
```

## Target Platforms

- **Commodore 64** - Full VIC-II, SID, and CIA support
- **VIC-20** - VIA and basic graphics support
- **Commander X16** - VERA graphics and enhanced features
- **Generic 6502** - Basic instruction set compatibility

## Implementation Status

**Completed Components:**
- Lexical analysis (tokenization)
- Syntax parsing (AST generation)
- Semantic analysis (type checking, symbol resolution)
- Intermediate language representation
- Optimization framework and pattern analysis

**In Development:**
- 6502 code generation
- Platform-specific hardware APIs
- Assembly output and linking

**Planned:**
- Emulator integration testing
- Performance optimization passes
- Debugging information generation

## Project Structure

```
├── docs/                          # Documentation
├── examples/                      # Sample programs
├── packages/
│   ├── lexer/                     # Tokenization
│   ├── parser/                    # Syntax analysis
│   ├── ast/                       # Abstract syntax tree
│   ├── semantic/                  # Type checking and analysis
│   ├── il/                        # Intermediate language
│   └── core/                      # Shared utilities
```

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
```

## Documentation

- [Language Specification](docs/BLEND65_LANGUAGE_SPECIFICATION.md) - Complete syntax and semantics reference
- [Project Status](docs/PROJECT_STATUS.md) - Current development state and progress
- [Implementation Plans](docs/implementation-plan/) - Detailed development roadmaps

## Contributing

This project is in active development. See the implementation plans in the `docs/implementation-plan/` directory for current priorities and technical specifications.

## License

MIT License - see [LICENSE](LICENSE) for details.
