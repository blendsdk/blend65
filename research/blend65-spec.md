# Blend65 Language Specification (v0.1)

**Status:** Draft (Multi-target 6502 family language) **Target:** 6502 family processors with modular machine support
**Core guarantees:** static memory, deterministic codegen, no implicit runtime, reachability-based dead-code elimination

---

## 0. Non-negotiable Guarantees

Blend65 is a **multi-target assembler-plus** language for serious 6502 family game development.

### 0.1 Multi-target compilation model

-   Source compiles **ahead-of-time** to target-specific native binaries.
-   **Target selection** via `--target=MACHINE` compiler flag.
-   **Universal 6502 core** language works on all targets.
-   **Target-specific hardware APIs** via modular import system.
-   The compiler performs **reachability-based dead-code elimination**.
-   There is **no implicitly linked runtime** and **no default standard library**.

### 0.2 Target architecture

```
blend65 --target=c64 game.blend     → game.prg (Commodore 64)
blend65 --target=x16 game.blend     → game.prg (Commander X16)
blend65 --target=vic20 game.blend   → game.prg (VIC-20)
blend65 --target=atari2600 game.blend → game.bin (Atari 2600)
```

### 0.3 Memory & storage model

-   **All variables have static storage** (global lifetime).
-   **No stack-allocated locals** exist in v0.1.
-   **Target-specific memory layouts** based on machine capabilities.
-   Storage classes exist (explicit or inferred):
    -   `zp` (zero page) - varies by target
    -   `ram` (RAM, uninitialized)
    -   `data` (RAM/ROM initialized bytes/words)
    -   `const` (read-only data / ROM-intent)
    -   `io` (memory-mapped I/O) - target-specific addresses
-   The compiler **may auto-promote** eligible variables to `zp` unless pinned elsewhere.

### 0.4 Hardware abstraction

-   **Function-based hardware APIs** instead of raw register access.
-   **Target-specific modules** (e.g., `c64:sprites`, `x16:vera`, `vic20:screen`).
-   **Compile-time import resolution** based on selected target.
-   **Zero-overhead inlining** for hardware function calls.

### 0.5 Forbidden in v0.1

-   Heap allocation (no dynamic arrays, maps, strings, objects)
-   Floating-point types
-   Local variables
-   Nested functions / closures / lambdas
-   Recursion (direct or indirect)
-   Exceptions / `Result` types
-   Returning structs/records/arrays

---

## 1. Lexical Structure

### 1.1 Source encoding

-   UTF-8 source files.

### 1.2 Comments

-   `//` line comment
-   `/* ... */` block comment

### 1.3 Identifiers

-   `[A-Za-z_][A-Za-z0-9_]*`
-   Case-sensitive
-   Keywords are reserved.

---

## 2. Program Structure

A program is a set of modules. Each file declares exactly one module.

```
module Game.Main

import joystickLeft, joystickRight from target:input
import setSpritePosition, enableSprite from target:sprites
import playNote from target:sound

export function main(): void
    // Universal 6502 code with target-specific hardware
end function
```

### 2.1 Module declaration

```ebnf
module         ::= "module" qualified_name newline
qualified_name ::= ident { "." ident }*
```

### 2.2 Target-aware imports

Imports resolve based on the selected compilation target:

```
// These imports resolve differently per target:
import setSpritePosition from target:sprites
import setBackgroundColor from target:video
import readJoystick from target:input

// Explicit target modules also supported:
import setSpritePosition from c64:sprites
import setSprite from x16:vera
```

```ebnf
import_decl ::= "import" import_list "from" module_path newline
import_list ::= ident { "," ident }*
module_path ::= target_module | explicit_module | string_literal

target_module   ::= "target:" ident
explicit_module ::= machine_id ":" ident
machine_id      ::= "c64" | "x16" | "vic20" | "atari2600" | ...
```

**Resolution rules:**

-   `target:*` modules resolve to machine-specific implementations
-   Machine-specific imports (e.g., `c64:sprites`) work only on that target
-   Compilation fails if imported functions don't exist on selected target

### 2.3 Exports

Only exported symbols may be imported by other modules.

```
export const SCREEN_W: byte = 40
export function main(): void
    // ...
end function
```

---

## 3. Types

Blend65 types are **target-defined** and have fixed sizes. All 6502 targets share the same basic type system.

### 3.1 Primitive types

|      Type |   Size | Notes             |
| --------: | -----: | ----------------- |
|    `byte` |  8-bit | unsigned 0..255   |
|    `word` | 16-bit | unsigned 0..65535 |
| `boolean` |  8-bit | 0 or 1            |
|    `void` |      — | no value          |

Optional (target-dependent):

-   `sbyte` (8-bit signed)
-   `sword` (16-bit signed)

### 3.2 Arrays (fixed-size only)

Arrays are fixed-capacity, compile-time sized, contiguous memory.

```
var spriteX: byte[8]
var screenLine: byte[40]
var tiles: byte[256]
```

Size must be a compile-time constant. Target-specific memory constraints apply.

### 3.3 Records (structs)

Records compile to a **flat layout** in target memory.

```
type Player extends HasPos, HasVel
    hp: byte
    flags: byte
end type

type HasPos
    x: word
    y: word
end type
```

Layout is deterministic and target-defined.

---

## 4. Target System

### 4.1 Target selection

```bash
blend65 --target=MACHINE source.blend
```

Valid targets depend on installed target definitions.

### 4.2 Target-specific imports

**Universal pattern:**

```
import functionName from target:module
```

**Target-specific pattern:**

```
import functionName from machine:module
```

**Examples:**

```
// Works on targets that have sprites
import setSpritePosition from target:sprites

// C64-specific (fails on other targets)
import setSpritePosition from c64:sprites

// Commander X16-specific
import setSprite from x16:vera
```

### 4.3 Target capabilities

Different targets provide different hardware modules:

**Commodore 64:**

-   `c64:sprites` - 8 hardware sprites via VIC-II
-   `c64:sid` - Sound synthesis via SID chip
-   `c64:vic` - Screen colors, graphics modes
-   `c64:input` - Joystick/keyboard via CIA

**Commander X16:**

-   `x16:vera` - Modern graphics via VERA chip
-   `x16:ym2151` - FM synthesis via YM2151
-   `x16:input` - Modern input handling

**VIC-20:**

-   `vic20:screen` - Character-based display
-   `vic20:vic` - Simple colors/modes (no sprites)
-   `vic20:input` - Basic input

**Atari 2600:**

-   `atari2600:tia` - Minimal graphics (2 sprites, playfield)
-   `atari2600:riot` - Sound and input
-   Extreme memory constraints (128 bytes RAM)

---

## 5. Hardware API Design

### 5.1 Function-based hardware access

Instead of raw register manipulation:

```
// OLD (not supported):
io var VIC_SPRITE0_X: byte @ $D000
VIC_SPRITE0_X = playerX

// NEW (function-based):
import setSpritePosition from target:sprites
setSpritePosition(0, playerX, playerY)
```

### 5.2 Zero-overhead inlining

Hardware functions compile to optimal register sequences:

```
// Source:
setSpritePosition(0, 160, 100)

// C64 target compiles to:
LDA #160       ; X coordinate
STA $D000      ; VIC_SPRITE0_X
LDA #100       ; Y coordinate
STA $D001      ; VIC_SPRITE0_Y
```

### 5.3 Target-specific optimizations

Each target can provide specialized optimizations for hardware access patterns.

---

## 6. Storage Classes and Placement

Every variable is static. Storage is expressed via **storage prefix** and optional placement.

### 6.1 Declarations

```
zp   var frame: byte
ram  var bulletsX: byte[8]
data var palette: byte[16] = [ 0x00, 0x06, 0x0E, 0x0B ]
const var msg: string(16) = "SCORE:"
io   var CUSTOM_REG: byte @ $D800  // Target-specific address
```

**Target-specific considerations:**

-   **Zero page size** varies by target (C64: ~$02-$FF, Atari 2600: $80-$FF)
-   **Memory layout** differs significantly between machines
-   **I/O addresses** are completely target-dependent

---

## 7. Expressions and Operators

Universal 6502 expression system works on all targets.

### 7.1 Numeric operators

Arithmetic: `+ - * / %` Comparisons: `== != < <= > >=` Boolean: `and or not` Bitwise: `& | ^ ~ << >>` Assignment:
`= += -= *= /= %= &= |= ^= <<= >>=`

### 7.2 Operator precedence

Standard precedence hierarchy applies universally.

---

## 8. Statements and Control Flow

Universal control flow constructs work on all 6502 targets.

### 8.1 If/While/For

```
if condition then
    // ...
end if

while condition
    // ...
end while

for i = 0 to 255
    // ...
next
```

### 8.2 Match statement

```
match joystickState
    case 1:  // Up
        playerY = playerY - 1
    case 2:  // Down
        playerY = playerY + 1
    case _:
        // No movement
end match
```

---

## 9. Functions

### 9.1 Declaration

```
function add(a: byte, b: byte): byte
    return a + b
end function
```

Universal function model works across all targets.

### 9.2 Target-specific calling conventions

Each target may use different register assignments and stack usage for function calls, but this is transparent to the
programmer.

---

## 10. Target-Specific Modules

### 10.1 Module resolution

When compiling with `--target=MACHINE`:

1. `target:module` imports resolve to `MACHINE:module`
2. Direct `MACHINE:module` imports work only on that target
3. Compilation fails for unavailable target modules

### 10.2 Standard target modules

**Graphics:**

-   `target:sprites` → `c64:sprites`, `x16:vera`, etc.
-   `target:screen` → `c64:vic`, `vic20:screen`, etc.

**Input:**

-   `target:input` → `c64:input`, `x16:input`, etc.

**Sound:**

-   `target:sound` → `c64:sid`, `x16:ym2151`, etc.

**Memory:**

-   `target:memory` → Universal `peek`/`poke` functions

### 10.3 Function signatures

Hardware functions have consistent signatures across targets when possible:

```
// Sprite functions (where supported):
function setSpritePosition(sprite: byte, x: word, y: byte): void
function setSpriteColor(sprite: byte, color: byte): void
function enableSprite(sprite: byte): void

// Input functions:
function joystickLeft(port: byte): boolean
function joystickRight(port: byte): boolean
function joystickFire(port: byte): boolean
```

---

## 11. Target Definition System

### 11.1 Target specification

Each target provides:

-   **Memory layout** (zero page, program area, I/O ranges)
-   **Hardware modules** (available functions and their implementations)
-   **Code generation rules** (calling conventions, optimizations)
-   **Output format** (PRG, BIN, etc.)

### 11.2 Adding new targets

New targets are added by creating target definition files:

```
targets/MACHINE/
├── memory-layout.toml
├── modules/
│   ├── sprites.blend65
│   ├── input.blend65
│   └── sound.blend65
└── codegen-rules.toml
```

---

## 12. Entry Points and Output

### 12.1 Entry point

A program must export exactly one entry:

```
export function main(): void
```

### 12.2 Target-specific output

The compiler outputs target-appropriate binaries:

-   **C64/VIC-20/Plus4**: `.prg` format
-   **Commander X16**: `.prg` format
-   **Atari 2600**: `.bin` format
-   **Apple II**: Target-specific format

---

## 13. Example: Multi-Target Program

```
module Game.Snake

// Universal 6502 variables
var snakeX: byte[64]
var snakeY: byte[64]
var snakeLength: byte = 4
var direction: byte = 0

// Target-specific imports (resolved at compile time)
import joystickUp, joystickDown, joystickLeft, joystickRight from target:input
import setPixel, clearScreen from target:graphics
import playTone from target:sound

export function main(): void
    initGame()
    while true
        handleInput()
        moveSnake()
        renderSnake()
    end while
end function

function handleInput(): void
    if joystickUp() then direction = 0 end if
    if joystickDown() then direction = 1 end if
    if joystickLeft() then direction = 2 end if
    if joystickRight() then direction = 3 end if
end function

function moveSnake(): void
    // Universal 6502 logic
    match direction
        case 0: snakeY[0] = snakeY[0] - 1  // Up
        case 1: snakeY[0] = snakeY[0] + 1  // Down
        case 2: snakeX[0] = snakeX[0] - 1  // Left
        case 3: snakeX[0] = snakeX[0] + 1  // Right
    end match
end function

function renderSnake(): void
    clearScreen()
    for i = 0 to snakeLength - 1
        setPixel(snakeX[i], snakeY[i])
    next
end function
```

**Compilation:**

```bash
# Commodore 64 version
blend65 --target=c64 snake.blend
# → Resolves target:input to c64:input, target:graphics to c64:vic

# Commander X16 version
blend65 --target=x16 snake.blend
# → Resolves target:input to x16:input, target:graphics to x16:vera

# VIC-20 version
blend65 --target=vic20 snake.blend
# → Resolves target:input to vic20:input, target:graphics to vic20:screen
```

---

## End

This specification defines a **universal 6502 core language** with **modular target-specific hardware APIs**, enabling
the same source code to compile to multiple 6502-based machines while maintaining optimal performance on each target.

```

```
