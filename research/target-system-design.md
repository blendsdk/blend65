# Blend65 Target System Design

**Status:** Approved Architecture **Date:** January 1, 2026 **Impact:** Multi-target compilation, hardware API
resolution, code generation

---

## Overview

The Blend65 target system enables the same source code to compile to multiple 6502-based machines while providing
machine-specific hardware APIs and optimizations.

---

## Target Architecture

### **1. Target Selection**

Targets are selected via compiler flag:

```bash
blend65 --target=MACHINE source.blend
```

**Supported targets:**

-   `c64` - Commodore 64
-   `x16` - Commander X16
-   `vic20` - VIC-20
-   `atari2600` - Atari 2600
-   `plus4` - Commodore Plus/4

### **2. Target Resolution Process**

```
Source Code
    ↓
Parse Universal AST
    ↓
Target Selection (--target=MACHINE)
    ↓
Import Resolution (target:* → MACHINE:*)
    ↓
Hardware API Validation
    ↓
Target-Specific Memory Layout
    ↓
Target-Specific Code Generation
    ↓
Native Binary Output
```

### **3. Import Resolution**

**Generic imports** resolve to target-specific implementations:

```
// Source code (target-agnostic):
import setSpritePosition from target:sprites
import readJoystick from target:input

// C64 compilation resolves to:
import setSpritePosition from c64:sprites
import readJoystick from c64:input

// Commander X16 compilation resolves to:
import setSpritePosition from x16:vera
import readJoystick from x16:input
```

**Direct imports** work only on specified targets:

```
// This only works when compiling with --target=c64
import setSpritePosition from c64:sprites
```

---

## Target Definition Structure

### **File Organization**

Each target provides a complete definition:

```
targets/MACHINE/
├── target.toml          # Target metadata and capabilities
├── memory-layout.toml   # Memory map and constraints
├── codegen-rules.toml   # Code generation preferences
├── modules/             # Hardware API implementations
│   ├── sprites.blend65  # Sprite functions (if supported)
│   ├── input.blend65    # Input handling
│   ├── sound.blend65    # Audio functions
│   ├── video.blend65    # Display functions
│   └── memory.blend65   # Memory operations
└── README.md           # Target documentation
```

### **Target Metadata (target.toml)**

```toml
[target]
name = "Commodore 64"
id = "c64"
cpu = "6510"
status = "stable"

[capabilities]
sprites = true
sid_sound = true
max_sprites = 8
screen_width = 320
screen_height = 200

[modules]
sprites = "c64:sprites"
input = "c64:input"
sound = "c64:sid"
video = "c64:vic"
memory = "c64:memory"

[output]
format = "prg"
extension = ".prg"
load_address = 0x0801
```

### **Memory Layout (memory-layout.toml)**

```toml
[zero_page]
start = 0x02
end = 0xFF
reserved = [0x90, 0x91, 0x92]  # KERNAL usage

[program]
start = 0x0801  # After BASIC header
end = 0x9FFF    # Before BASIC ROM

[screen]
default = 0x0400
size = 0x0400

[sprites]
default = 0x2000
size = 0x0040

[io]
start = 0xD000
end = 0xDFFF
```

### **Code Generation Rules (codegen-rules.toml)**

```toml
[calling_convention]
# Register usage for function parameters
param1 = "A"
param2 = "X"
param3 = "Y"
return = "A"

[optimization]
inline_threshold = 16  # Inline functions under 16 bytes
zero_page_auto = true  # Auto-promote to ZP when beneficial
dead_code_elimination = true

[hardware_inlining]
# Hardware functions to always inline
always_inline = [
    "setSpritePosition",
    "readJoystick",
    "setBackgroundColor"
]
```

---

## Hardware API Implementation

### **Module Structure**

Hardware modules are written in a Blend65 subset optimized for inlining:

**Example: c64/modules/sprites.blend65**

```
// C64 Sprite Hardware API
// Compiles to inline assembly sequences

// VIC-II Register definitions
const VIC_SPRITE_ENABLE: word = $D015
const VIC_SPRITE0_X: word = $D000
const VIC_SPRITE0_Y: word = $D001
const VIC_SPRITE_X_MSB: word = $D010

export function setSpritePosition(sprite: byte, x: word, y: byte): void
    // Inline assembly template
    @inline {
        LDA #y
        STA VIC_SPRITE0_Y + sprite
        LDA x
        STA VIC_SPRITE0_X + sprite
        LDA x + 1
        BEQ .no_msb
        LDA VIC_SPRITE_X_MSB
        ORA #(1 << sprite)
        STA VIC_SPRITE_X_MSB
        JMP .done
    .no_msb:
        LDA VIC_SPRITE_X_MSB
        AND #(255 - (1 << sprite))
        STA VIC_SPRITE_X_MSB
    .done:
    }
end function

export function enableSprite(sprite: byte): void
    @inline {
        LDA VIC_SPRITE_ENABLE
        ORA #(1 << sprite)
        STA VIC_SPRITE_ENABLE
    }
end function
```

**Example: x16/modules/vera.blend65**

```
// Commander X16 VERA Hardware API

const VERA_DC_VIDEO: word = $9F29
const VERA_SPRITE_CTRL: word = $9F20

export function setSpritePosition(sprite: byte, x: word, y: byte): void
    // X16-specific implementation using VERA
    @inline {
        // Set VERA address for sprite data
        LDA #(sprite * 8)
        STA VERA_SPRITE_CTRL
        LDA x
        STA VERA_SPRITE_CTRL + 1
        LDA y
        STA VERA_SPRITE_CTRL + 2
    }
end function
```

### **Function Signature Consistency**

Common functions have consistent signatures across targets:

```
// These signatures work on ALL targets that support sprites
function setSpritePosition(sprite: byte, x: word, y: byte): void
function setSpriteColor(sprite: byte, color: byte): void
function enableSprite(sprite: byte): void

// These work on ALL targets
function joystickUp(port: byte): boolean
function joystickDown(port: byte): boolean
function joystickLeft(port: byte): boolean
function joystickRight(port: byte): boolean
```

**Target-specific extensions:**

```
// C64-specific (SID chip)
function setSIDFrequency(channel: byte, frequency: word): void

// Commander X16-specific (VERA)
function setVeraPalette(index: byte, color: word): void

// Atari 2600-specific (extreme constraints)
function setPlayfieldByte(index: byte, pattern: byte): void
```

---

## Compilation Process

### **Phase 1: Universal Parsing**

1. Parse source code into universal AST
2. Validate universal language constructs
3. Identify import statements

### **Phase 2: Target Resolution**

1. Load target definition from `targets/MACHINE/`
2. Resolve `target:*` imports to `MACHINE:*` equivalents
3. Validate that all imported functions exist on target
4. Apply target-specific memory layout

### **Phase 3: Hardware API Integration**

1. Load hardware module implementations
2. Inline hardware function calls where beneficial
3. Generate target-specific assembly sequences
4. Apply target-specific optimizations

### **Phase 4: Code Generation**

1. Apply target memory layout
2. Generate 6502 assembly for target machine
3. Create target-specific binary format
4. Output memory map and debug symbols

---

## Target Comparison

### **Memory Constraints**

| Target     | Zero Page | Program Area | Screen RAM  | Special Notes |
| ---------- | --------- | ------------ | ----------- | ------------- |
| C64        | $02-$FF   | $0801-$9FFF  | $0400-$07FF | VIC-II, SID   |
| X16        | $00-$FF   | $0800-$9EFF  | VRAM        | VERA, 2MB RAM |
| VIC-20     | $02-$FF   | $1001-$1DFF  | $1E00-$1FFF | Limited RAM   |
| Atari 2600 | $80-$FF   | $F000-$FFFF  | None        | 128 bytes RAM |

### **Hardware Capabilities**

| Feature    | C64     | X16     | VIC-20  | Atari 2600 |
| ---------- | ------- | ------- | ------- | ---------- |
| Sprites    | 8       | 128     | 0       | 2          |
| Colors     | 16      | 256     | 8       | 128        |
| Sound      | SID     | YM      | Beep    | TIA        |
| Resolution | 320x200 | 640x480 | 176x184 | 160x192    |

### **API Availability**

```
// Available on C64, X16
import setSpritePosition from target:sprites  ✓ ✓ ✗ ✗

// Available on all targets
import readJoystick from target:input         ✓ ✓ ✓ ✓

// Limited by hardware
import playNote from target:sound            ✓ ✓ ✗ ✗
```

---

## Adding New Targets

### **Step 1: Create Target Directory**

```bash
mkdir targets/my_machine
```

### **Step 2: Define Target Capabilities**

Create `targets/my_machine/target.toml` with machine specifications.

### **Step 3: Define Memory Layout**

Create `targets/my_machine/memory-layout.toml` with memory map.

### **Step 4: Implement Hardware APIs**

Create hardware modules in `targets/my_machine/modules/`.

### **Step 5: Test and Validate**

Test compilation with sample programs to ensure correctness.

### **Step 6: Register Target**

Add target to compiler's target registry.

---

## Benefits

### **For Developers**

-   **Write once, compile anywhere** - same source works on multiple machines
-   **Hardware abstraction** - no need to learn register details
-   **Type safety** - function signatures prevent hardware misuse
-   **Performance** - zero-overhead inlined hardware access

### **For Compiler**

-   **Modular architecture** - easy to add new targets
-   **Clear separation** - universal language vs hardware-specific
-   **Optimization opportunities** - target-specific code generation
-   **Maintainable** - hardware APIs isolated in modules

### **For Ecosystem**

-   **Consistent APIs** - same patterns across all machines
-   **Community contributions** - easy to add new targets
-   **Documentation** - hardware APIs are self-documenting
-   **Future-proof** - new 6502 machines can be added easily

---

## Conclusion

The Blend65 target system provides a clean, modular architecture for multi-target 6502 development. By separating
universal language features from hardware-specific APIs, developers can write portable code while still achieving
optimal performance on each target machine.

This design ensures Blend65 can grow to support the entire 6502 ecosystem while maintaining code quality and developer
productivity.

```

```
