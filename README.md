# Blend65

> ⚠️ **WORK IN PROGRESS — EARLY DEVELOPMENT** ⚠️
>
> **Blend65 is in a very early design and prototyping stage.** The language specification, compiler architecture, target
> system, and hardware APIs are **not finalized** and **will change**. Nothing in this repository should be considered
> stable, complete, or production-ready.

---

## What Is Blend65?

**Blend65** is a **multi-target, ahead-of-time compiled language** designed specifically for **high-performance 6502
family game development**.

It compiles the same source code to different 6502-based machines:

-   **Commodore family**: C64, VIC-20, C128, Plus/4, CBM/PET
-   **Atari family**: 2600, 5200, 7800
-   **Modern 6502**: Commander X16, MEGA 65
-   **Future targets**: Apple II, NES, and other 6502 systems

Blend65 exists for developers who want:

-   **Universal 6502 code** that works across machines
-   **Target-specific hardware APIs** for optimal performance
-   **Predictable memory usage** and deterministic performance
-   **Maximum possible FPS** on real hardware
-   **Zero implicit runtime** or standard library
-   **Full control over memory layout** without writing assembly

> **Blend65 is what experienced retro developers wish assembly looked like.**

---

## Core Design Goals

-   **Multi-target compilation** to different 6502 machines
-   **Target-specific hardware APIs** (sprites, sound, video)
-   **Universal 6502 core** (variables, functions, control flow)
-   **Ahead-of-time compilation** to native machine code
-   **No implicit runtime** or hidden overhead
-   **Reachability-based dead-code elimination**
-   **Static memory only** - no heap allocation
-   **Deterministic output** and performance-first lowering

---

## Target Architecture

### **Universal Core Language**

```
// This code works on ANY 6502 target
var lives: byte = 3
var score: word = 0

function addPoints(points: word): void
    score = score + points
end function

while lives > 0
    // Game loop logic
end while
```

### **Target-Specific Hardware**

```
// Commodore 64
import setSpritePosition, enableSprite from c64:sprites
import setBackgroundColor from c64:vic
import playNote from c64:sid

// Commander X16
import setSprite, setPalette from x16:vera
import playNote from x16:ym2151

// VIC-20 (no sprites)
import setBackgroundColor from vic20:vic
import setCharacterAt from vic20:screen
```

### **Compile for Any Target**

```bash
blend65 --target=c64 game.blend     # → game.prg (Commodore 64)
blend65 --target=x16 game.blend     # → game.prg (Commander X16)
blend65 --target=vic20 game.blend   # → game.prg (VIC-20)
blend65 --target=atari2600 game.blend # → game.bin (Atari 2600)
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

## Supported Targets

### **Tier 1 (Fully Supported)**

-   **Commodore 64** - Complete VIC-II, SID, sprite support
-   **Commander X16** - Modern 6502 with VERA graphics/sound

### **Tier 2 (Planned)**

-   **VIC-20** - Simple VIC chip, character-based graphics
-   **Atari 2600** - TIA graphics, extreme memory constraints
-   **Plus/4** - TED chip, enhanced C64-style machine

### **Future Targets**

-   Atari 5200, 7800
-   MEGA 65
-   CBM/PET series
-   Apple II series

---

## Compiler Architecture

Source → **Universal AST** → **Type Checking** → **Target Selection** → **Hardware API Resolution** → **Lowering &
Validation Phase** → **Target-Specific IL** → **6502 Optimization** → **Target Codegen** → **Native Binary**
(PRG/BIN/etc.)

### Key Phases

-   **Target Resolution**: Select hardware APIs based on `--target` flag
-   **Hardware Validation**: Ensure imported functions exist on target
-   **Memory Layout**: Apply target-specific memory maps
-   **Code Generation**: Emit optimized 6502 for specific machine

---

## Example: Cross-Target Game

```
module Game.Main

// Universal 6502 code
var playerX: word = 160
var playerY: byte = 100
var gameRunning: boolean = true

// Target-specific imports resolve at compile time
import joystickLeft, joystickRight from target:input
import setPlayerSprite from target:graphics
import playSound from target:audio

export function main(): void
    while gameRunning
        handleInput()
        updatePlayer()
        render()
    end while
end function

function handleInput(): void
    if joystickLeft() then
        playerX = playerX - 2
    end if
    if joystickRight() then
        playerX = playerX + 2
    end if
end function

function render(): void
    setPlayerSprite(playerX, playerY)
end function
```

**Compile for C64:**

```bash
blend65 --target=c64 game.blend
# Resolves: c64:input, c64:sprites, c64:sid
# Output: game.prg for C64
```

**Compile for Commander X16:**

```bash
blend65 --target=x16 game.blend
# Resolves: x16:input, x16:vera, x16:ym2151
# Output: game.prg for X16
```

---

## Project Status

**Current Phase:** Architecture Design **Next Milestone:** C64 + Commander X16 working compilers

### What's Implemented

-   [x] Language specification design
-   [x] Multi-target architecture design
-   [x] Target system specification

### What's In Progress

-   [ ] Core 6502 language implementation
-   [ ] Target definition system
-   [ ] C64 target implementation
-   [ ] Commander X16 target implementation

### What's Planned

-   [ ] Additional target support (VIC-20, Atari 2600, Plus/4)
-   [ ] Advanced optimization passes
-   [ ] IDE integration and debugging support

---

## Getting Started

1. **Choose your target machine** (C64 or Commander X16 recommended)
2. **Write universal 6502 code** with target-specific hardware imports
3. **Compile with target flag**: `blend65 --target=c64 game.blend`
4. **Run on real hardware or emulator**

---

## Documentation

-   [Language Specification](research/blend65-spec.md) - Complete language reference
-   [Target System Design](research/target-system-design.md) - How multi-target works
-   [Implementation Plan](implementation-plan/MASTER_PLAN.md) - Development roadmap
-   [Adding New Targets](targets/template/README.md) - Target development guide

---

## License

TBD

```

```
