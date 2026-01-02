# Game Analysis Report: Psychedelia/Colourspace

## Executive Summary

- **Repository:** https://github.com/mwenge/psychedelia.git
- **Analysis Date:** 2026-01-02
- **Target Platform:** C64/VIC-20/Atari 800 (Multi-platform 6502)
- **Project Size:** 6,983 lines of assembly code across 6 files
- **Portability Status:** NOT_CURRENTLY_PORTABLE
- **Primary Blockers:** Hardware interrupt system, advanced graphics control, real-time pattern generation
- **Recommended Blend65 Version:** v0.6+ (beyond current roadmap)
- **Implementation Effort:** EXTREME

## Project Overview

**Psychedelia** is Jeff Minter's pioneering "light synthesizer" from 1984-1987, designed to create real-time visual patterns synchronized to music. This is not a traditional game but rather an interactive audio-visual synthesizer that generates complex geometric patterns based on user input through joystick controls.

### Multi-Platform Architecture

- **C64 Version**: 3,598 lines (primary implementation)
- **VIC-20 Port**: Hardware-adapted version
- **Atari 800 Port**: Platform-specific implementation (Colourspace)
- **C16 Version**: Reduced feature set for limited hardware

## Technical Analysis

### Assembly Language Assessment

**Target Platform:** Commodore 64 (6502-based)
**Assembly Style:** 64tass/DASM compatible
**Code Size:** 6,983 lines across 6 files
**Memory Layout:** Complex zero page usage, extensive memory-mapped I/O

### Hardware Usage Patterns

**Critical Hardware Dependencies:**

1. **VIC-II Graphics System**
   - Direct color RAM manipulation (`$D800-$DFFF`)
   - Character mode graphics with custom character sets
   - Sprite control and collision detection (limited use)
   - Border and background color control
   - Memory banking and VIC configuration

2. **CIA Joystick Interface**
   - Real-time joystick input polling (`$DC00`)
   - Directional movement and fire button detection
   - Continuous input stream processing for pattern generation

3. **Interrupt System**
   - Custom IRQ handlers for 60Hz pattern updates
   - NMI handling for system stability
   - Precise timing control for visual synchronization
   - Multi-phase interrupt processing

4. **Memory Management**
   - Extensive zero page optimization
   - Color RAM as primary graphics buffer
   - Custom memory layout for pattern data
   - Dynamic storage allocation for recording/playback

### Core Program Architecture

**Real-Time Graphics Engine:**

```assembly
MainPaintLoop:
    INC currentIndexToPixelBuffers
    ; Process pixel buffers filled by interrupt handler
    ; Paint geometric patterns to color RAM
    ; Handle symmetry transformations
    ; Apply smoothing delays and visual effects
```

**Pattern Generation System:**

- **8 Built-in Patterns**: Star, Twist, Llamita, Deltoid, etc.
- **8 Custom Patterns**: User-definable geometric shapes
- **Pattern Data Structure**: Relative coordinate arrays with $55 terminators
- **Multi-level Rendering**: Each pattern has up to 7 color levels

**Interrupt-Driven Input Processing:**

```assembly
MainInterruptHandler:
    ; Runs at 60Hz
    ; Updates pixel buffers with new joystick data
    ; Processes sequencer data
    ; Handles cursor movement and pattern placement
```

**Advanced Features:**

- **Symmetry Modes**: None, X-axis, Y-axis, X-Y, and quadrant symmetry
- **Line Mode**: Vertical line drawing with configurable width
- **Sequencer System**: Programmable pattern sequences
- **Burst Generators**: Instant pattern explosions via function keys
- **Recording/Playback**: Capture and replay joystick movements
- **Preset System**: Save/load complete configurations
- **Demo Mode**: Automated pattern generation

### Memory Layout and Data Structures

**Zero Page Variables (Critical):**

- `$02-$26`: Core graphics state (pixel positions, colors, pointers)
- Intensive use of indirect addressing for performance
- Complex pointer management for pattern data access

**Pattern Data Organization:**

```assembly
starOneXPosArray:  ; Relative X coordinates
    .BYTE $00,$01,$01,$01,$00,$FF,$FF,$FF,$55  ; Level 0
    .BYTE $00,$02,$00,$FE,$55                  ; Level 1
    ; ... continues for 7 levels

starOneYPosArray:  ; Corresponding Y coordinates
    .BYTE $FF,$FF,$00,$01,$01,$01,$00,$FF,$55
    ; ... pattern continues
```

**Color RAM Direct Manipulation:**

- Direct access to `$D800-$DFFF` for immediate visual updates
- Line-based pointer tables for efficient screen access
- Real-time color cycling and pattern painting

## Blend65 Compatibility Assessment

### Current v0.1 Capability Mapping

**COMPLETELY UNSUPPORTED in v0.1:**

❌ **Interrupt System**

- No support for custom IRQ/NMI handlers
- Required: `interrupt function rasterIrq(): void`
- Critical for 60Hz pattern generation

❌ **Direct Hardware Access**

- No memory-mapped I/O access (`$D800`, `$DC00`, `$D020`)
- Required: Direct register access or hardware abstraction APIs

❌ **Real-Time Graphics**

- No color RAM manipulation
- No character mode graphics control
- No dynamic screen updates

❌ **Advanced Pointer Operations**

- Limited support for complex indirect addressing
- No zero page optimization directives

❌ **Hardware-Specific Optimizations**

- No 6502-specific timing control
- No cycle-accurate operations

### Missing Language Features

**Version 0.5+ Requirements (Hardware-Intensive):**

1. **Interrupt System**

```js
interrupt function mainUpdate(): void
    // 60Hz pattern generation
    updatePixelBuffers()
    processJoystickInput()
end function

interrupt function nmiHandler(): void
    // System stability
    preserveSystemState()
end function
```

2. **Memory-Mapped I/O**

```js
// Direct hardware access
var colorRam: ptr byte = $D800
var joystick: ptr byte = $DC00
var borderColor: ptr byte = $D020

function paintPixel(x: byte, y: byte, color: byte): void
    var offset: word = y * 40 + x
    colorRam[offset] = color
end function
```

3. **Hardware Collision Detection**

```js
import readJoystick from c64.cia
import setBorderColor from c64.vic
import setColorRam from c64.vic

function processInput(): byte
    return readJoystick(PORT_2)
end function
```

**Version 0.6+ Requirements (Beyond Current Roadmap):**

4. **Real-Time Graphics APIs**

```js
import clearColorRam from c64.vic
import setCharacterSet from c64.vic
import configureMemoryLayout from c64.vic

function initializeGraphics(): void
    clearColorRam()
    setCharacterSet(CUSTOM_CHARSET_ADDRESS)
    setBorderColor(BLACK)
    setBackgroundColor(BLACK)
end function
```

5. **Precise Timing Control**

```js
import setTimer from c64.cia
import readTimer from c64.cia

function waitForNextFrame(): void
    // Synchronize to 60Hz refresh
    setTimer(CIA1, TIMER_A, 16666) // microseconds
    while readTimer(CIA1, TIMER_A) > 0 do
        // wait
    end while
end function
```

6. **Advanced Memory Management**

```js
zp var pixelX: byte at $02
zp var pixelY: byte at $03
zp var colorIndex: byte at $04
// Zero page allocation for performance-critical variables
```

### Hardware API Requirements

**Missing C64 Hardware APIs:**

| Module         | Function             | Priority | Implementation Effort | Notes                    |
| -------------- | -------------------- | -------- | --------------------- | ------------------------ |
| c64.vic        | setColorRam()        | CRITICAL | HIGH                  | Direct color RAM access  |
| c64.vic        | setBorderColor()     | HIGH     | LOW                   | Simple register write    |
| c64.vic        | setBackgroundColor() | HIGH     | LOW                   | Simple register write    |
| c64.vic        | setCharacterSet()    | HIGH     | MEDIUM                | VIC-II memory control    |
| c64.cia        | readJoystick()       | CRITICAL | MEDIUM                | CIA port reading         |
| c64.interrupts | setIRQHandler()      | CRITICAL | HIGH                  | Custom interrupt vectors |
| c64.interrupts | setNMIHandler()      | HIGH     | HIGH                  | NMI vector control       |
| c64.memory     | setZeroPageVar()     | HIGH     | MEDIUM                | Zero page optimization   |
| c64.system     | disableKernal()      | MEDIUM   | HIGH                  | System control           |

## Portability Assessment

### NOT_CURRENTLY_PORTABLE

**Critical Blockers:**

1. **No Interrupt System** - The entire program is built around custom IRQ handlers running at 60Hz. Without interrupt support, the core functionality cannot be implemented.

2. **No Hardware APIs** - Direct access to VIC-II, CIA, and memory-mapped registers is essential for all graphics operations and input handling.

3. **No Real-Time Capabilities** - The program requires precise timing control and immediate hardware response that current Blend65 cannot provide.

4. **Complex Assembly Optimizations** - Heavy use of zero page variables, cycle-counting, and 6502-specific optimizations that would require significant language extensions.

### Required Blend65 Evolution

**Version 0.5 Minimal Requirements:**

- Basic interrupt system
- Memory-mapped I/O access
- Hardware abstraction APIs
- Real-time input handling

**Version 0.6+ Full Compatibility:**

- Advanced graphics control
- Precise timing systems
- Zero page optimization
- Hardware collision detection
- Complete C64 hardware API coverage

### Implementation Strategy

**Phase 1: Hardware Abstraction Layer**

```js
// Create high-level graphics API
module Graphics
    function paintPixel(x: byte, y: byte, color: byte): void
    function clearScreen(): void
    function setBorder(color: byte): void
end module

module Input
    function readJoystick(): byte
    function isPressed(direction: byte): bool
end module
```

**Phase 2: Pattern Generation**

```js
// Implement pattern system
type Pattern
    xCoords: byte[64]
    yCoords: byte[64]
    levels: byte
end type

function renderPattern(pattern: Pattern, x: byte, y: byte, symmetry: byte): void
    // Implementation using hardware APIs
end function
```

**Phase 3: Real-Time Engine**

```js
// Main loop with interrupt support
interrupt function frameUpdate(): void
    processInput()
    updatePatterns()
    renderFrame()
end function

function main(): void
    setupInterrupts()
    initializeGraphics()
    while true do
        // Main program logic
        handleUserInput()
        updateSequencer()
    end while
end function
```

## Evolution Roadmap Impact

### Feature Priority Updates

Based on this analysis, the following features should be elevated in priority:

**CRITICAL (Required for Hardware-Intensive Programs):**

- Interrupt system implementation
- Memory-mapped I/O support
- Hardware abstraction layer
- Real-time input handling

**HIGH (Enables Advanced Graphics Programs):**

- Direct hardware register access
- Precise timing control
- Zero page variable support
- Advanced graphics APIs

### Implementation Effort Analysis

**Language Core Extensions: EXTREME**

- Interrupt system: 6-8 weeks of development
- Hardware APIs: 8-10 weeks per platform
- Memory-mapped I/O: 4-6 weeks
- Timing control: 4-6 weeks

**Total Estimated Effort:** 6+ months of dedicated development

### Missing Features Matrix Updates

**New Hardware-Intensive Category:**
Programs like Psychedelia represent a new category of applications that Blend65 must eventually support - real-time, hardware-intensive interactive systems. This requires fundamental language extensions beyond typical game requirements.

## Code Examples

### Original Assembly Pattern

```assembly
PaintPixelForCurrentSymmetry:
    LDA pixelXPosition
    PHA
    LDA pixelYPosition
    PHA
    JSR PaintPixel

    LDA currentSymmetrySettingForStep
    BNE HasSymmetry

    ; Clean up and return
    PLA
    STA pixelYPosition
    PLA
    STA pixelXPosition
    RTS
```

### Required Blend65 Implementation

```js
function paintPixelWithSymmetry(x: byte, y: byte, color: byte, symmetry: byte): void
    // Paint original pixel
    Graphics.paintPixel(x, y, color)

    if symmetry = NO_SYMMETRY then
        return
    end if

    // Apply symmetry transformations
    if symmetry = Y_AXIS_SYMMETRY or symmetry = QUAD_SYMMETRY then
        Graphics.paintPixel(39 - x, y, color)
    end if

    if symmetry = X_AXIS_SYMMETRY or symmetry = QUAD_SYMMETRY then
        Graphics.paintPixel(x, 24 - y, color)
    end if

    if symmetry = QUAD_SYMMETRY then
        Graphics.paintPixel(39 - x, 24 - y, color)
    end if
end function
```

## Recommendations

### For Blend65 Evolution

1. **Prioritize Hardware Abstraction** - Develop a comprehensive hardware API layer that can support real-time graphics applications.

2. **Implement Interrupt System** - Critical for any hardware-intensive application requiring precise timing.

3. **Create Graphics Subsystem** - Develop high-level graphics APIs that abstract platform-specific hardware details.

4. **Zero Page Support** - Add language constructs for performance-critical variable placement.

5. **Real-Time Capabilities** - Ensure the language can handle time-sensitive operations and hardware synchronization.

### Alternative Approach

Given the extreme complexity of full hardware emulation, consider a **hybrid approach**:

1. **High-Level Recreation** - Implement Psychedelia's core concepts using Blend65's available features
2. **Software Graphics** - Use character/sprite graphics instead of direct color RAM manipulation
3. **Polling Input** - Replace interrupt-driven input with polling-based systems
4. **Simplified Patterns** - Recreate pattern generation using available data structures

This would provide similar functionality while remaining within Blend65's capabilities, though with reduced performance and authenticity.

## Conclusion

Psychedelia represents the pinnacle of hardware-intensive 6502 programming, requiring virtually every advanced feature that Blend65 would need to support for complete retro computing compatibility. While currently not portable, it serves as an excellent benchmark for language evolution priorities and demonstrates the sophistication possible on 8-bit hardware.

Supporting programs of this complexity would position Blend65 as a truly comprehensive retro development platform capable of handling the most demanding applications from the 8-bit era.
