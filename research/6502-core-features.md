# Blend65 6502 Core Features

**Status:** Specification **Date:** January 1, 2026 **Scope:** Universal language features available on all 6502 targets

---

## Overview

This document defines the **universal 6502 core** of Blend65 - language features that work identically across all
6502-based targets regardless of surrounding hardware.

These features form the foundation for portable code that compiles to any supported 6502 machine.

---

## Core Language Features

### **1. Data Types**

**Primitive Types (Universal):**

```
var counter: byte = 0        // 8-bit unsigned (0-255)
var address: word = $C000    // 16-bit unsigned (0-65535)
var flag: boolean = true     // 8-bit boolean (0 or 1)
```

**Fixed Arrays (Universal):**

```
var buffer: byte[256]        // 256-byte array
var coordinates: word[10]    // 10-word array
var flags: boolean[8]        // 8-boolean array
```

**Array access:**

```
buffer[0] = 255
coordinates[index] = $1000
if flags[2] then
    // ...
end if
```

**Records/Structs (Universal):**

```
type Point
    x: word
    y: word
end type

type GameObject
    position: Point
    health: byte
    active: boolean
end type

var player: GameObject
player.position.x = 160
player.health = 100
```

---

### **2. Variables and Storage**

**Storage Classes (Universal concept, target-specific addresses):**

```
zp   var fastVar: byte           // Zero page (fastest access)
ram  var buffer: byte[256]       // Regular RAM
data var palette: byte[16] = [...]  // Initialized data
const var MESSAGE: string(10) = "HELLO"  // Read-only
```

**Storage characteristics:**

-   **All variables are static** (global lifetime)
-   **No local variables** in functions
-   **No heap allocation** - fixed memory layout
-   **Target-specific placement** based on memory maps

**Memory addressing:**

```
// Zero page addresses vary by target:
// C64: $02-$FF available
// Atari 2600: $80-$FF available
// X16: $00-$FF available

zp var zpByte: byte    // Compiler chooses optimal ZP address per target
```

---

### **3. Arithmetic and Logic**

**Arithmetic Operators (8-bit and 16-bit):**

```
var a: byte = 10
var b: byte = 20
var result: byte = a + b * 2     // Standard precedence

var addr1: word = $C000
var addr2: word = addr1 + 256    // 16-bit arithmetic
```

**Bitwise Operations (Essential for 6502):**

```
var flags: byte = %11010000      // Binary literal
flags = flags & %00001111        // Mask lower nibble
flags = flags | %10000000        // Set bit 7
flags = flags ^ %01010101        // XOR pattern
flags = flags << 1               // Shift left
flags = flags >> 2               // Shift right
flags = ~flags                   // Complement
```

**Boolean Logic:**

```
var condition1: boolean = true
var condition2: boolean = false
if condition1 and not condition2 then
    // ...
end if
```

---

### **4. Control Flow**

**Conditional Execution:**

```
if playerHealth > 0 then
    // Player alive
else
    // Game over
end if

// Single-line form
if bullets > 0 then fireBullet() end if
```

**Loops:**

```
// Definite loop with counter
for i = 0 to 255
    buffer[i] = 0
next

// Loop with step
for i = 255 to 0 step -1
    // Countdown
next

// Indefinite loop
while gameRunning
    // Main game loop
end while

// Infinite loop (common pattern)
while true
    // Never-ending loop
end while
```

**Pattern Matching:**

```
match joystickDirection
    case 0:    // Up
        playerY = playerY - 1
    case 1:    // Down
        playerY = playerY + 1
    case 2:    // Left
        playerX = playerX - 1
    case 3:    // Right
        playerX = playerX + 1
    case _:    // No movement
        // Do nothing
end match
```

**Loop Control:**

```
for i = 0 to 100
    if i == 50 then
        continue    // Skip to next iteration
    end if
    if i == 75 then
        break       // Exit loop
    end if
    // Process i
next
```

---

### **5. Functions**

**Function Declaration:**

```
function add8(a: byte, b: byte): byte
    return a + b
end function

function add16(a: word, b: word): word
    return a + b
end function

function setMemory(address: word, value: byte): void
    // No return value
    peek(address, value)
end function
```

**Function Calls:**

```
var sum: byte = add8(10, 20)
var newAddress: word = add16(baseAddress, offset)
setMemory($D020, 0)              // Set border color (C64)
```

**Parameter Passing:**

-   Parameters passed via **6502 registers** (A, X, Y) and **zero page**
-   **Target-specific calling conventions** but transparent to programmer
-   **No local variables** - use module-level storage

**Restrictions (All Targets):**

-   No recursion (direct or indirect)
-   No nested functions
-   No returning structs or arrays
-   No function pointers

---

### **6. Memory Operations**

**Direct Memory Access (Universal):**

```
// These functions exist on all targets but with different implementations
import peek, poke from target:memory

var screenByte: byte = peek($0400)    // Read from memory
poke($D020, 7)                       // Write to memory
```

**Address Calculation:**

```
import addr from core:memory

var screenAddr: word = addr(screenBuffer)     // Get address of variable
var spriteAddr: word = addr(spriteData[0])    // Address of array element
```

**Memory Operations:**

```
import memcopy, memset from target:memory

memcopy(source, dest, 256)           // Copy 256 bytes
memset(buffer, 0, 1024)             // Fill with zeros
```

---

### **7. String Handling**

**Fixed-Length Strings:**

```
var playerName: string(8) = "PLAYER1"    // 8-character buffer
var message: string(40) = ""             // Empty 40-char buffer

// String operations
playerName = "NEWNAME"                   // Assignment
if playerName == "PLAYER1" then          // Comparison
    // ...
end if
```

**Template Strings (Limited):**

```
var score: word = 1500
var lives: byte = 3

// Simple formatting only
var statusLine: string(20) = `S:${score} L:${lives}`
var hexDisplay: string(10) = `ADDR:${hex(address)}`
```

---

### **8. Expressions and Operators**

**Operator Precedence (Standard):**

1. Parentheses: `()`
2. Unary: `+ - ~ not`
3. Multiplicative: `* / %`
4. Additive: `+ -`
5. Shifts: `<< >>`
6. Bitwise AND: `&`
7. Bitwise XOR: `^`
8. Bitwise OR: `|`
9. Comparisons: `< <= > >=`
10. Equality: `== !=`
11. Logical AND: `and`
12. Logical OR: `or`
13. Assignment: `= += -= *=` etc.

**Numeric Literals:**

```
var decimal: byte = 42               // Decimal
var hex: word = $C000               // Hexadecimal
var binary: byte = %11010000        // Binary
var char: byte = 'A'                // Character (ASCII)
```

---

### **9. Constants and Literals**

**Compile-Time Constants:**

```
const SCREEN_WIDTH: word = 320
const SCREEN_HEIGHT: word = 200
const MAX_SPRITES: byte = 8

// Use in expressions
var centerX: word = SCREEN_WIDTH / 2
var spriteCount: byte = 0

for i = 0 to MAX_SPRITES - 1
    // Process sprites
next
```

**Array Literals:**

```
data var colors: byte[4] = [0, 1, 2, 3]
data var notes: word[8] = [$C000, $C100, $C200, $C300, $C400, $C500, $C600, $C700]
```

---

### **10. Module System**

**Module Declaration:**

```
module Game.Player

// Module-level variables (static storage)
var playerX: word = 160
var playerY: byte = 100
var playerHealth: byte = 100
```

**Exports and Imports:**

```
// In player.blend
export function getPlayerX(): word
    return playerX
end function

export function movePlayer(dx: sword, dy: sbyte): void
    playerX = playerX + dx
    playerY = playerY + dy
end function

// In main.blend
import getPlayerX, movePlayer from game:player

var x: word = getPlayerX()
movePlayer(-1, 0)    // Move left
```

**Import Resolution:**

-   **Universal modules** work on all targets
-   **Target-specific modules** resolved at compile time
-   **Compile-time dead code elimination**

---

### **11. Performance Characteristics**

**6502-Optimized Patterns:**

**Zero Page Usage:**

```
// These automatically use efficient zero page addressing
zp var zpCounter: byte
zp var zpPointer: word

// Compiler generates optimal 6502 instructions:
// LDA zpCounter     (2 cycles vs 4 for absolute)
// STA zpPointer     (3 cycles vs 4 for absolute)
```

**8-bit vs 16-bit Operations:**

```
// 8-bit operations are fastest
var a: byte = 10
var b: byte = 20
var result: byte = a + b     // Single ADC instruction

// 16-bit operations require helper routines
var addr1: word = $1000
var addr2: word = $2000
var sum: word = addr1 + addr2    // Multi-instruction sequence
```

**Loop Optimization:**

```
// Counted loops optimize to efficient 6502 patterns
for i = 0 to 255          // Uses 8-bit counter
    buffer[i] = 0         // Compiler optimizes indexing
next

// Compiler may generate:
// LDX #0
// loop: STA buffer,X
//       INX
//       BNE loop
```

---

### **12. Target-Agnostic Patterns**

**Generic Hardware Access:**

```
// These imports resolve differently per target but same API
import readJoystick from target:input
import setPixel from target:graphics
import playTone from target:sound

// Universal code that works on all targets
if readJoystick(1) then
    setPixel(100, 100, 1)
    playTone(440)
end if
```

**Memory-Safe Patterns:**

```
// Fixed-size arrays prevent buffer overflows
var safeBuffer: byte[256]

// Compile-time bounds checking available
for i = 0 to 255
    safeBuffer[i] = i    // Safe - compiler knows bounds
next
```

**Deterministic Performance:**

```
// All operations have known cycle counts
var cycles: word = 0

cycles += 2    // LDA immediate (2 cycles)
cycles += 3    // STA zero page (3 cycles)
cycles += 4    // STA absolute (4 cycles)

// No hidden allocations or garbage collection
```

---

## Compilation Model

### **Universal AST Generation**

1. All core features parse to same AST regardless of target
2. Target selection affects only import resolution
3. Hardware APIs resolved in separate phase

### **Static Analysis**

1. **Dead code elimination** - unused functions/variables removed
2. **Constant folding** - compile-time arithmetic
3. **Zero page promotion** - automatic optimization
4. **Call graph analysis** - prevent recursion

### **Code Generation**

1. **Target-specific optimizations** applied
2. **Hardware function inlining**
3. **6502 register allocation**
4. **Memory layout optimization**

---

## Constraints and Guarantees

### **Memory Guarantees**

-   **Static allocation only** - no dynamic memory
-   **Predictable layout** - variables placed deterministically
-   **No stack locals** - all storage is global
-   **Target-specific limits** respected automatically

### **Performance Guarantees**

-   **Deterministic timing** - no hidden costs
-   **Optimal 6502 code** - hand-optimized patterns
-   **Zero overhead abstractions** - functions inline aggressively
-   **Predictable size** - code size known at compile time

### **Portability Guarantees**

-   **Universal core** works on all 6502 targets
-   **Target validation** - compilation fails for unavailable features
-   **Consistent semantics** - same behavior across machines
-   **Source compatibility** - same code compiles to multiple targets

---

This universal 6502 core provides a solid foundation for cross-platform retro game development while maintaining the
performance and determinism required for real-time 6502 programming.

```

```
