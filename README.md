# Blend65

> ⚠️ **WORK IN PROGRESS — EARLY DEVELOPMENT** ⚠️
>
> **Blend65 is in a very early design and prototyping stage.** The language specification, compiler architecture, target
> system, and hardware APIs are **not finalized** and **will change**. Nothing in this repository should be considered
> stable, complete, or production-ready.

---

## What Is Blend65?

**Blend65** is an **ahead-of-time compiled language** designed specifically for **high-performance 6502 family game development**. The language is architecturally designed to support multiple 6502-based targets, with **Commodore 64** as the current primary focus.

Blend65 exists for developers who want:

-   **High-performance C64 game development** with modern language features
-   **Direct hardware control** over VIC-II, SID, and sprites
-   **Predictable memory usage** and deterministic performance
-   **Maximum possible FPS** on real hardware
-   **Zero implicit runtime** or standard library
-   **Full control over memory layout** without writing assembly

> **Blend65 is what experienced retro developers wish assembly looked like.**

---

## Core Design Goals

-   **6502 family architecture** with multi-platform design
-   **C64-focused development** with direct hardware control
-   **Modern language features** for retro development
-   **Ahead-of-time compilation** to native machine code
-   **No implicit runtime** or hidden overhead
-   **Reachability-based dead-code elimination**
-   **Static memory only** - no heap allocation
-   **Deterministic output** and performance-first lowering

---

## Language Design

### **Core 6502 Language**

```
// Modern syntax for 6502 development
var lives: byte = 3
var score: word = 0
zp var frameCounter: byte = 0

function addPoints(points: word): void
    score = score + points
end function

while lives > 0
    // Game loop logic
    frameCounter = frameCounter + 1
end while
```

### **C64 Hardware Control**

```
// Direct access to C64 hardware
import setSpritePosition, enableSprite from c64:sprites
import setBackgroundColor, setBorderColor from c64:vic
import playNote, setVolume from c64:sid

// Set up sprite
enableSprite(0, true)
setSpritePosition(0, 160, 100)
setBackgroundColor(0)  // Black
setBorderColor(0)      // Black

// Play sound
setVolume(15)
playNote(0, 440)  // Channel 0, 440Hz
```

### **Compilation**

```bash
blend65 game.blend  # → game.prg for Commodore 64
```

---

## What Blend65 Is NOT

-   Not a VM or bytecode language
-   Not an interpreter
-   Not a C replacement
-   Not a BASIC replacement
-   Not a scripting language
-   Not focused on modern platforms

---

## 6502 Family Roadmap

**Blend65** is architecturally designed to support the entire 6502 family of processors. Here's our roadmap ordered by development feasibility:

### **Current Target**
-   **Commodore 64** - Primary focus with VIC-II, SID, and sprite support

### **High Priority (Excellent tooling & docs)**
-   **VIC-20** - Simpler C64 cousin, character-based graphics
-   **Commander X16** - Modern 6502 with VERA graphics/sound
-   **Apple II series** - Classic 6502 platform, well-documented
-   **Commodore 128** - Enhanced C64 successor

### **Medium Priority (Good tooling & docs)**
-   **NES/Famicom** - Popular gaming platform with complex PPU
-   **Atari 8-bit computers** - 400/800/XL/XE series
-   **Plus/4** - TED chip, unique Commodore platform
-   **CBM/PET series** - Business computers

### **Long-term Goals (Challenging but possible)**
-   **Atari 2600** - Extremely constrained but iconic
-   **BBC Micro** - Popular UK computer
-   **Atari 5200/7800** - Advanced Atari systems

### **C64 Hardware Support (Current Implementation)**
-   **VIC-II Graphics** - Complete sprite, character, and bitmap support
-   **SID Sound** - Full 3-voice synthesizer control
-   **Memory Management** - Zero page, BASIC RAM, and custom memory layouts
-   **I/O Control** - Joysticks, keyboard, and hardware registers

---

## Compiler Architecture

Source → **Lexing** → **Parsing** → **AST Generation** → **Type Checking** → **C64 Hardware API Resolution** → **Memory Layout** → **6502 Optimization** → **C64 Code Generation** → **PRG Binary**

### Key Phases

-   **Lexing**: ✅ Convert Blend65 source to tokens with 6502-specific features
-   **Parsing**: Convert tokens to Abstract Syntax Tree
-   **Type Checking**: Validate types and memory constraints
-   **Hardware API Resolution**: Resolve C64 hardware function calls
-   **Memory Layout**: Apply C64 memory map and zero page allocation
-   **6502 Optimization**: Optimize for 6502 instruction set
-   **Code Generation**: Emit optimized 6502 machine code for C64

---

## Example: C64 Game

```
module Game.Main

// Game variables in different memory regions
var playerX: word = 160
var playerY: byte = 100
zp var joystick: byte = 0
var gameRunning: boolean = true

// C64 hardware imports
import joystickRead from c64:input
import setSpritePosition, enableSprite, setSpriteColor from c64:sprites
import setBackgroundColor from c64:vic
import playNote from c64:sid

export function main(): void
    // Initialize game
    setBackgroundColor(0)  // Black background
    enableSprite(0, true)
    setSpriteColor(0, 1)   // White sprite

    while gameRunning
        handleInput()
        render()
    end while
end function

function handleInput(): void
    joystick = joystickRead(1)  // Read joystick port 2

    if (joystick & 4) == 0 then  // Left
        playerX = playerX - 2
    end if
    if (joystick & 8) == 0 then  // Right
        playerX = playerX + 2
    end if
    if (joystick & 16) == 0 then // Fire
        playNote(0, 440)  // Beep sound
    end if
end function

function render(): void
    setSpritePosition(0, playerX, playerY)
end function
```

**Compile and Run:**

```bash
blend65 game.blend  # → game.prg for C64
x64 game.prg        # Run in VICE emulator
```

---

## Project Status

**Current Phase:** Architecture Design **Next Milestone:** Working C64 compiler

### What's Implemented

-   [x] Language specification design
-   [x] C64 target architecture design
-   [x] 6502 family design principles
-   [x] **Blend65 Lexer** - Complete lexical analyzer with 6502-specific features
-   [x] **Token System** - Comprehensive token types including storage classes
-   [x] **Number Parsing** - Multiple formats: decimal, hex ($XX, 0x), binary (0b)
-   [x] **Package Structure** - Monorepo with TypeScript and testing framework

### What's In Progress

-   [ ] Parser implementation for AST generation
-   [ ] Core 6502 language semantic analysis
-   [ ] C64 hardware API implementation
-   [ ] C64 compiler backend implementation
-   [ ] Memory management and optimization

### What's Planned

-   [ ] Advanced 6502 optimization passes
-   [ ] IDE integration and debugging support
-   [ ] Enhanced C64 hardware features

---

## Getting Started

### Development Setup

```bash
# Install dependencies
yarn install

# Build the lexer package
cd packages/lexer
yarn build

# Run tests
yarn test
```

### Using the Lexer

```javascript
import { Blend65Lexer } from '@blend65/lexer';

const source = `
zp var frameCounter: byte = 0
function updatePlayer(): void
    frameCounter = frameCounter + 1
end function
`;

const lexer = new Blend65Lexer(source);
const tokens = lexer.tokenize();
console.log(tokens);
```

### Full Compilation (Future)

1. **Set up your C64 development environment**
2. **Write Blend65 code** with C64 hardware imports
3. **Compile**: `blend65 game.blend`
4. **Run on C64 hardware or emulator** (VICE recommended)

---

## Documentation

-   [Language Specification](docs/research/blend65-spec.md) - Complete language reference
-   [6502 Core Features](docs/research/6502-core-features.md) - 6502 architecture details
-   [Implementation Plan](docs/implementation-plan/MASTER_PLAN.md) - Development roadmap
-   [Target System Design](docs/research/target-system-design.md) - Architecture design

---

## License

MIT License - see [LICENSE](LICENSE) for details
