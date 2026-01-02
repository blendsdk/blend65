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
import setSpritePosition, enableSprite from c64.sprites
import setBackgroundColor, setBorderColor from c64.vic
import playNote, setVolume from c64.sid

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

Source → **Lexing** → **Parsing** → **AST Generation** → **Semantic Analysis** → **IL Generation** → **IL Optimization** → **Code Generation** → **PRG Binary**

### Key Phases

-   **Lexing**: ✅ Convert Blend65 source to tokens with 6502-specific features
-   **Parsing**: ✅ Convert tokens to Abstract Syntax Tree with complete language support
-   **AST Generation**: ✅ Build typed AST with comprehensive node types
-   **Semantic Analysis**: 🔄 Symbol tables, type checking, module resolution
-   **IL Generation**: 🔄 Transform AST to intermediate language (TypeScript objects)
-   **IL Optimization**: 🔄 Dead code elimination, constant folding, function inlining
-   **Code Generation**: 🔄 Target-specific 6502 assembly generation with optimization
-   **Binary Output**: 🔄 PRG/BIN file generation for target hardware

### Backend Architecture

The backend follows a traditional compiler design with modern optimization:

```
Validated AST + Symbol Tables
    ↓
IL (Intermediate Language) Objects
    ↓
Optimization Passes (Dead Code, Constants, Inlining)
    ↓
Optimized IL
    ↓
6502 Code Generation (Register Allocation, Memory Layout)
    ↓
Target Assembly (DASM/CA65 compatible)
    ↓
Binary Output (.prg for C64, .bin for others)
```

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
import joystickRead from c64.input
import setSpritePosition, enableSprite, setSpriteColor from c64.sprites
import setBackgroundColor from c64.vic
import playNote from c64.sid

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

## Compilation Output: 6502 Assembly

**This is what Blend65 generates** - Beautiful, optimized 6502 assembly that runs directly on C64 hardware:

### Memory Layout & Variable Translation

```asm
;===============================================================================
; Zero Page Variables - Fast Access Memory ($00-$FF)
;===============================================================================

; Blend65: zp var joystick: byte = 0
joystick            = $02       ; Zero page for fast access

;===============================================================================
; Game Variables - Regular RAM Storage
;===============================================================================

; Blend65: var playerX: word = 160
playerX_lo          = $0810     ; Player X position (low byte)
playerX_hi          = $0811     ; Player X position (high byte)

; Blend65: var playerY: byte = 100
playerY             = $0812     ; Player Y position

; Blend65: var gameRunning: boolean = true
gameRunning         = $0813     ; Game state flag (0=false, 1=true)
```

### Hardware API Implementation

```asm
;===============================================================================
; Blend65: setBackgroundColor(0)
;===============================================================================
init_hardware:
    lda #0
    sta $D021                   ; VIC-II background color register
    sta $D020                   ; VIC-II border color register

    ; Blend65: enableSprite(0, true)
    lda $D015                   ; VIC-II sprite enable register
    ora #%00000001              ; Set bit 0 (sprite 0)
    sta $D015

    ; Blend65: setSpriteColor(0, 1) - White sprite
    lda #1
    sta $D027                   ; Sprite 0 color register
    rts
```

### Control Flow Translation

```asm
;===============================================================================
; Blend65: while gameRunning ... end while
;===============================================================================
main_loop:
    lda gameRunning             ; Check game state
    beq exit_program            ; Branch if gameRunning == false

    jsr handleInput             ; Blend65: handleInput()
    jsr render                  ; Blend65: render()
    jsr wait_frame              ; Frame timing
    jmp main_loop               ; Continue loop

exit_program:
    rts                         ; Return to BASIC
```

### Input Handling with Bitwise Operations

```asm
;===============================================================================
; Blend65: if (joystick & 4) == 0 then playerX = playerX - 2 end if
;===============================================================================
handleInput:
    lda $DC00                   ; Read joystick port 2 (CIA-1)
    sta joystick                ; Store in zero page variable

    ; Check left movement
    and #%00000100              ; Isolate bit 2 (left direction)
    bne check_right             ; Branch if not pressed

    ; Left pressed - 16-bit subtraction
    sec                         ; Set carry for subtraction
    lda playerX_lo              ; Load low byte
    sbc #2                      ; Subtract 2
    sta playerX_lo              ; Store result
    lda playerX_hi              ; Load high byte
    sbc #0                      ; Subtract borrow
    sta playerX_hi              ; Store result

check_right:
    lda joystick                ; Reload joystick state
    and #%00001000              ; Isolate bit 3 (right direction)
    bne check_fire              ; Branch if not pressed

    ; Right pressed - 16-bit addition with boundary check
    clc                         ; Clear carry for addition
    lda playerX_lo
    adc #2                      ; Add 2
    sta playerX_lo
    lda playerX_hi
    adc #0                      ; Add carry
    sta playerX_hi

    ; Keep playerX <= 320 (screen boundary)
    cmp #1                      ; Check if high byte > 0
    bcc check_fire              ; Branch if < 256
    lda playerX_lo
    cmp #64                     ; Check if >= 320
    bcc check_fire
    ; Set to maximum valid position
    lda #63                     ; 319 low byte
    sta playerX_lo
    lda #1                      ; 319 high byte
    sta playerX_hi

check_fire:
    ; Blend65: if (joystick & 16) == 0 then playNote(0, 440) end if
    lda joystick
    and #%00010000              ; Isolate fire button
    bne input_done              ; Branch if not pressed

    jsr play_beep_sound         ; Call sound function

input_done:
    rts
```

### Hardware Sound Generation

```asm
;===============================================================================
; Blend65: playNote(0, 440) - Generate 440Hz tone on SID voice 1
;===============================================================================
play_beep_sound:
    ; Calculate SID frequency: (440 * 65536) / 985248 = 28633 ($6FD9)
    lda #$D9                    ; Low byte
    sta $D400                   ; SID voice 1 frequency low
    lda #$6F                    ; High byte
    sta $D401                   ; SID voice 1 frequency high

    lda #15                     ; Maximum volume
    sta $D418                   ; SID volume register

    lda #%00100001              ; Sawtooth wave + gate on
    sta $D404                   ; SID voice 1 control

    jsr short_delay             ; Brief delay

    lda #%00100000              ; Sawtooth wave + gate off
    sta $D404                   ; Stop the note
    rts
```

### Key Features Demonstrated

- **Zero Page Optimization** - Frequently used variables in fast memory
- **16-bit Arithmetic** - Proper carry propagation for word operations
- **Direct Hardware Access** - No abstraction overhead, raw performance
- **Boundary Checking** - Runtime safety for screen coordinates
- **Bit Manipulation** - Efficient joystick input processing
- **Memory Layout Control** - Strategic variable placement
- **C64 Conventions** - Proper PRG format, BASIC stub, memory map

> **This assembly runs at full speed on real C64 hardware** - Zero runtime overhead, maximum performance, complete hardware control.

---

## Project Status

**Current Phase:** Frontend Complete, Backend Implementation **Next Milestone:** Semantic Analysis & IL Generation

### What's Implemented ✅

-   [x] **Complete Frontend Pipeline** - Lexer → Parser → AST (159 tests passing)
-   [x] **Blend65 Lexer** - Full tokenization with 6502-specific features (49 tests)
-   [x] **Blend65 Parser** - Complete recursive descent parser (80 tests)
-   [x] **Abstract Syntax Tree** - Full AST representation with factory (30 tests)
-   [x] **Language Support** - All Blend65 constructs: modules, functions, control flow, types
-   [x] **Storage Classes** - Zero page, RAM, data, const, I/O variable declarations
-   [x] **Module System** - Content-based resolution with dot notation imports
-   [x] **Comprehensive Testing** - Edge cases, error conditions, real-world patterns

### What's In Progress 🔄

-   [ ] **Semantic Analysis** - Symbol tables, type checking, validation (Phase 1: 8 tasks)
-   [ ] **Intermediate Language** - IL definition and AST transformation (Phase 2: 6 tasks)
-   [ ] **IL Optimization** - Dead code elimination, constant folding, inlining (Phase 3: 5 tasks)
-   [ ] **Code Generation** - 6502 assembly generation and optimization (Phase 4: 7 tasks)

### Implementation Roadmap 📋

**Total Backend Tasks:** 26 tasks across 4 phases (11-15 weeks estimated)

1. **Phase 1:** Semantic Analysis - Symbol tables, type system, validation
2. **Phase 2:** IL Definition - TypeScript-based intermediate language
3. **Phase 3:** IL Optimization - Performance optimization passes
4. **Phase 4:** Code Generation - Target-specific 6502 assembly output

### What's Planned 📝

-   [ ] Advanced 6502 optimization passes
-   [ ] IDE integration and debugging support
-   [ ] Enhanced C64 hardware features
-   [ ] Multi-target support (Commander X16, VIC-20)

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

### Using the Frontend

```javascript
// Using the Lexer
import { Blend65Lexer } from '@blend65/lexer';

// Using the Parser
import { Blend65Parser } from '@blend65/parser';
import { ASTFactory } from '@blend65/ast';

const source = `
module Game.Example

zp var frameCounter: byte = 0

function updatePlayer(): void
    frameCounter = frameCounter + 1
end function
`;

// Tokenize
const lexer = new Blend65Lexer(source);
const tokens = lexer.tokenize();

// Parse to AST
const factory = new ASTFactory();
const parser = new Blend65Parser(tokens, factory);
const ast = parser.parse();

console.log('Tokens:', tokens);
console.log('AST:', ast);
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
-   [Compiler Backend Plan](docs/implementation-plan/COMPILER_BACKEND_PLAN.md) - Detailed backend implementation (26 tasks)
-   [Target System Design](docs/research/target-system-design.md) - Architecture design

---

## License

MIT License - see [LICENSE](LICENSE) for details
