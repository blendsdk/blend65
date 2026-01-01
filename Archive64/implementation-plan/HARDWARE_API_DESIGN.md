# Blend64 Hardware API Design

**Status:** Approved Design Decision **Date:** January 1, 2026 **Impact:** Phase 5 (Magic Phase), Phase 6 (Code
Generation), C64 Module System

---

## Design Decision

**Chosen Approach:** Function-Based Hardware API (Option 2)

**Rationale:** After evaluating multiple approaches for C64 hardware access, the function-based API provides the optimal
balance of programmer ergonomics and code generation efficiency.

---

## API Design

### **Function-Based Hardware Access**

Instead of raw register manipulation:

```
// OLD: Assembly-like approach (rejected)
io var VIC_SPRITE0_X: byte @ $D000
io var VIC_SPRITE_X_MSB: byte @ $D010

VIC_SPRITE0_X = spriteX and $FF
if spriteX > 255 then
  VIC_SPRITE_X_MSB = VIC_SPRITE_X_MSB or $01
else
  VIC_SPRITE_X_MSB = VIC_SPRITE_X_MSB and $FE
end if
```

Use clean function calls:

```
// NEW: Function-based approach (approved)
import setSpritePosition, setSpriteColor, enableSprite from c64:sprites
import readJoystick from c64:input

setSpritePosition(0, spriteX, spriteY)  // Handles all register complexity
setSpriteColor(0, WHITE)
enableSprite(0)
joyState = readJoystick(1)
```

---

## Implementation Strategy

### **1. Module Organization**

**C64 Hardware Modules:**

```
// c64:sprites - Sprite manipulation
import setSpritePosition, setSpriteColor from c64:sprites
import enableSprite, disableSprite from c64:sprites
import setSpriteMulticolor, setSpriteData from c64:sprites

// c64:input - Input handling
import readJoystick, readKeyboard from c64:input

// c64:vic - Video Interface Chip
import setBackgroundColor, setBorderColor from c64:vic
import setGraphicsMode, setScrollPosition from c64:vic

// c64:sound - SID sound chip
import playNote, setVolume, stopSound from c64:sound

// c64:memory - Memory operations
import memcopy, memset, peek, poke from c64:memory
```

### **2. Function Signatures**

**Sprites:**

```
function setSpritePosition(sprite: byte, x: word, y: byte): void
function setSpriteColor(sprite: byte, color: byte): void
function enableSprite(sprite: byte): void
function disableSprite(sprite: byte): void
function setSpriteData(sprite: byte, dataBlock: byte): void
```

**Input:**

```
function readJoystick(port: byte): byte  // Returns bitfield
function joystickUp(port: byte): boolean
function joystickDown(port: byte): boolean
function joystickLeft(port: byte): boolean
function joystickRight(port: byte): boolean
function joystickFire(port: byte): boolean
```

**Graphics:**

```
function setBackgroundColor(color: byte): void
function setBorderColor(color: byte): void
function clearScreen(character: byte): void
```

### **3. Code Generation Strategy**

**Inlining for Zero Overhead:**

```
// Source code:
setSpritePosition(0, 160, 100)

// Compiles to optimal 6502:
LDA #160          ; X coordinate low byte
STA $D000         ; VIC_SPRITE0_X
LDA #0            ; X coordinate high byte (160 < 256)
; (MSB bit manipulation omitted - not needed)
LDA #100          ; Y coordinate
STA $D001         ; VIC_SPRITE0_Y
```

**Static Analysis for Optimization:**

-   Compile-time constant folding
-   Dead branch elimination
-   Register allocation optimization
-   Function call elimination through inlining

---

## Advantages

### **1. Developer Experience**

-   **Natural syntax** - reads like modern programming language
-   **Type safety** - function signatures prevent register misuse
-   **Self-documenting** - function names explain what happens
-   **IDE friendly** - autocomplete and parameter hints work

### **2. Compiler Benefits**

-   **Simple code generation** - direct mapping to register sequences
-   **Easy optimization** - inlining and constant folding
-   **Clear module boundaries** - hardware functions are well-defined
-   **Testable** - hardware functions can be mocked for testing

### **3. Maintenance Benefits**

-   **Hardware abstraction** - register details hidden from game code
-   **Consistent interface** - all hardware follows same patterns
-   **Future-proof** - can add new hardware functions without syntax changes
-   **Documentation** - function signatures serve as hardware reference

---

## Example Transformations

### **Sprite Handling**

**Before (assembly-like):**

```
io var VIC_SPRITE_ENABLE: byte @ $D015
io var VIC_SPRITE0_COLOR: byte @ $D027

VIC_SPRITE_ENABLE = VIC_SPRITE_ENABLE or 1
VIC_SPRITE0_COLOR = 7
```

**After (function-based):**

```
enableSprite(0)
setSpriteColor(0, YELLOW)
```

### **Input Handling**

**Before:**

```
io var CIA1_PORT_A: byte @ $DC00
joyRaw = not CIA1_PORT_A and $1F
if joyRaw and $01 then // Check up bit
```

**After:**

```
if joystickUp(1) then
  // Much clearer intent
```

### **Complex Operations**

**Before:**

```
// Setting sprite position with MSB handling
io var VIC_SPRITE0_X: byte @ $D000
io var VIC_SPRITE_X_MSB: byte @ $D010

VIC_SPRITE0_Y = spriteY
VIC_SPRITE0_X = spriteX and $FF
if spriteX > 255 then
  VIC_SPRITE_X_MSB = VIC_SPRITE_X_MSB or $01
else
  VIC_SPRITE_X_MSB = VIC_SPRITE_X_MSB and $FE
end if
```

**After:**

```
setSpritePosition(0, spriteX, spriteY)  // One call handles everything
```

---

## Implementation Requirements

### **Phase 5 (Magic Phase) Changes**

-   **Function database** - catalog of all C64 hardware functions
-   **Inlining analysis** - determine which calls to inline vs. keep as functions
-   **Constant propagation** - optimize calls with compile-time constants
-   **Dead code elimination** - remove unused hardware functions

### **Phase 6 (Code Generation) Changes**

-   **Hardware function templates** - code generation patterns for each function
-   **Register allocation** - efficient use of A/X/Y for parameters
-   **Optimization passes** - minimize register saves/restores
-   **Module linking** - resolve C64 module imports

### **C64 Module Implementation**

-   **Function definitions** - implement each hardware function
-   **Parameter validation** - compile-time bounds checking
-   **Documentation** - usage examples and hardware reference
-   **Testing** - unit tests for each function

---

## Migration Strategy

### **Phase 1: Basic Functions (v0.1)**

Implement core functions needed for basic games:

-   `setSpritePosition`, `setSpriteColor`, `enableSprite`
-   `readJoystick`, `joystickUp`, `joystickDown`, etc.
-   `setBackgroundColor`, `setBorderColor`
-   `memcopy`, `memset`

### **Phase 2: Advanced Functions (v0.2+)**

Add more sophisticated hardware control:

-   Raster interrupts, smooth scrolling
-   Advanced sprite features (multicolor, collision)
-   Sound synthesis, envelope control
-   Advanced memory management

### **Phase 3: Complete Hardware Coverage (v1.0)**

Full C64 hardware abstraction:

-   Complete VIC-II register set
-   Full SID functionality
-   CIA timers and I/O
-   Cartridge and memory banking

---

## Quality Assurance

### **Performance Verification**

-   Benchmark against hand-written assembly
-   Cycle count analysis for critical functions
-   Code size comparison with direct register access

### **Usability Testing**

-   Developer feedback on API ergonomics
-   Documentation clarity and completeness
-   Learning curve for new C64 programmers

### **Correctness Validation**

-   Hardware behavior verification on real C64
-   Edge case testing (sprite boundaries, timing)
-   Integration testing with actual games

---

## Conclusion

The function-based hardware API strikes the perfect balance for Blend64:

-   **Maintains performance** through aggressive inlining
-   **Improves readability** with natural function syntax
-   **Simplifies implementation** with clear code generation patterns
-   **Future-proofs the language** with extensible module system

This design ensures Blend64 code is both **pleasant to write** and **optimal to execute** on C64 hardware.

```

```
