# Blend65 Compiler Output Example

This directory contains an example of what the **Blend65 compiler would generate** when compiling the game example from the main README. This assembly code demonstrates the target output format and showcases how high-level Blend65 constructs translate to optimized 6502 assembly for the Commodore 64.

## Purpose

This example serves multiple purposes:

1. **Showcase Compilation Target** - Shows developers what Blend65 aims to produce
2. **Educational Reference** - Demonstrates proper C64 assembly conventions
3. **Performance Baseline** - Illustrates the optimization level Blend65 targets
4. **Development Guide** - Provides a reference for compiler backend development

## Source vs. Assembly Mapping

### Original Blend65 Source

```js
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

### Generated Assembly Features

The `game.asm` file demonstrates how this Blend65 code translates to:

## Memory Management Translation

### Storage Classes

- `zp var joystick: byte` → Zero page allocation at `$02`
- `var playerX: word` → Regular RAM allocation at `$0810-$0811`
- `var playerY: byte` → Regular RAM allocation at `$0812`
- `var gameRunning: boolean` → Regular RAM allocation at `$0813`

### Memory Layout Strategy

```asm
;===============================================================================
; Zero Page Variables - Fast Access Memory ($00-$FF)
;===============================================================================
joystick            = $02       ; Zero page for fast access
temp_lo             = $03       ; Low byte for 16-bit operations
temp_hi             = $04       ; High byte for 16-bit operations

;===============================================================================
; Game Variables - Regular RAM Storage
;===============================================================================
playerX_lo          = $0810     ; Player X position (low byte)
playerX_hi          = $0811     ; Player X position (high byte)
playerY             = $0812     ; Player Y position
gameRunning         = $0813     ; Game state flag (0=false, 1=true)
```

## Hardware API Translation

### C64 Hardware Imports

Blend65 hardware imports like:

```js
import setSpritePosition, enableSprite, setSpriteColor from c64:sprites
import setBackgroundColor from c64:vic
import playNote from c64:sid
```

Become direct hardware register access:

```asm
; VIC-II Graphics Chip ($D000-$D3FF)
VIC_SPRITE_ENABLE   = $D015     ; Sprite enable register
VIC_BACKGROUND_COLOR = $D021    ; Background color

; SID Sound Chip ($D400-$D7FF)
SID_FREQ_LO_1       = $D400     ; Voice 1 frequency low byte
SID_CONTROL_1       = $D404     ; Voice 1 control register
```

### Hardware Function Implementation

```asm
; setBackgroundColor(0) - Set black background
lda #0
sta VIC_BACKGROUND_COLOR

; enableSprite(0, true) - Enable sprite 0
lda VIC_SPRITE_ENABLE
ora #%00000001              ; Set bit 0 (sprite 0)
sta VIC_SPRITE_ENABLE
```

## Control Flow Translation

### While Loops

Blend65 `while` loops:

```js
while gameRunning
    handleInput()
    render()
end while
```

Become efficient assembly loops:

```asm
main_loop:
    lda gameRunning
    beq exit_program            ; Branch if gameRunning == false
    jsr handleInput
    jsr render
    jsr wait_frame
    jmp main_loop
```

### Conditional Statements

Blend65 conditionals:

```js
if (joystick & 4) == 0 then
    playerX = playerX - 2
end if
```

Become optimized 6502 bit operations:

```asm
lda joystick
and #%00000100              ; Isolate bit 2 (left)
bne check_right             ; Branch if bit is set (not pressed)
; Left pressed - playerX = playerX - 2
sec                         ; Set carry for subtraction
lda playerX_lo
sbc #2
sta playerX_lo
lda playerX_hi
sbc #0
sta playerX_hi
```

## Optimization Features Demonstrated

### 1. **Zero Page Usage**

- Frequently accessed variables placed in zero page for faster access
- Temporary variables allocated efficiently

### 2. **16-bit Arithmetic**

- Proper handling of word-sized variables across low/high bytes
- Efficient carry propagation for multi-byte operations

### 3. **Hardware Register Access**

- Direct memory-mapped I/O without abstraction overhead
- Bit manipulation for hardware control

### 4. **Memory Boundary Checking**

- Runtime bounds checking for screen coordinates
- Overflow protection for player movement

### 5. **Performance Optimizations**

- Minimal function call overhead
- Efficient use of processor flags
- Optimized addressing modes

## Assembling and Running

### Prerequisites

- [DASM Assembler](https://dasm-assembler.github.io/)
- [VICE Emulator](https://vice-emu.sourceforge.io/) (recommended)

### Assembly Commands

```bash
# Assemble the program
dasm game.asm -f3 -ogame.prg

# Run in VICE emulator
x64 game.prg
```

### Expected Behavior

- Black screen with white sprite
- Sprite moves left/right with joystick
- Fire button plays a beep sound
- Proper boundary checking at screen edges

## Educational Value

This assembly output demonstrates:

### **For Blend65 Developers**

- Target code generation patterns
- Memory layout strategies
- Hardware abstraction implementation
- Optimization opportunities

### **For Retro Developers**

- Modern language benefits vs. assembly control
- Performance characteristics of high-level constructs
- C64 programming best practices
- Assembly code organization

### **For Compiler Engineers**

- 6502 code generation techniques
- Memory management strategies
- Hardware abstraction layers
- Optimization passes

## Technical Notes

### **Memory Map**

- `$0801`: Program start (standard C64 convention)
- `$02-$04`: Zero page variables
- `$0810+`: Game variables in RAM
- `$D000+`: Hardware registers

### **Hardware Details**

- Joystick reading from CIA-1
- VIC-II sprite control
- SID sound generation
- Proper C64 memory layout

### **Assembly Conventions**

- DASM assembler syntax
- Standard C64 labels and equates
- Comprehensive commenting
- Modular subroutine organization

## Relationship to Blend65 Compiler

This assembly code represents the **target output** that the Blend65 compiler aims to generate. Key aspects:

- **No Runtime Overhead**: Direct hardware access without abstraction layers
- **Predictable Performance**: Every Blend65 construct maps to known assembly patterns
- **Maximum Efficiency**: Optimized for 6502 instruction set and C64 hardware
- **Readable Output**: Well-commented for debugging and understanding

## Future Enhancements

As the Blend65 compiler develops, this example may demonstrate:

- Advanced optimization passes
- More sophisticated memory layout
- Enhanced hardware abstractions
- Performance profiling integration

---

_This assembly code is for demonstration and educational purposes. It showcases the compilation target of Blend65 but is not generated by an actual compiler - it's hand-written to illustrate the intended output quality and structure._
