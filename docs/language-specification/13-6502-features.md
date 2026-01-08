# 6502-Specific Features

> **Status**: Lexer-Derived Specification  
> **Last Updated**: January 8, 2026  
> **Related Documents**: [Variables](10-variables.md), [Memory-Mapped](12-memory-mapped.md), [Functions](11-functions.md)

## Overview

Blend65 is designed specifically for 6502-family systems and includes several features that map directly to 6502 hardware capabilities. This document describes these 6502-specific features and provides guidelines for their use.

## Memory Placement via Storage Classes

The storage class system is a first-class 6502 feature that provides explicit control over where variables are allocated in memory.

### Storage Classes

#### @zp - Zero Page

Allocates variables in **zero page** ($0000-$00FF):

```js
@zp let fastCounter: byte = 0;
@ram let screenBuffer: byte[1000];
@data const fontData: byte[2048] = [0, 1, 2];
```

**Properties:**
- **Address range**: $0000-$00FF (256 bytes total)
- **Speed**: Fastest access (special 6502 addressing modes)
- **Code size**: Smaller code (2 bytes vs 3 bytes per access)
- **Limitations**: Very limited space, shared with system/runtime

**Benefits:**
- Faster execution (2-3 cycles vs 4-5 cycles)
- Smaller code footprint
- Required for indirect addressing (pointers)

See [Variables](10-variables.md#zp---zero-page) for detailed information.

#### @ram - General RAM

Allocates variables in **general-purpose RAM** (default):

```js
@ram let buffer: byte[1000];
let score: word = 0;  // Equivalent to @ram
```

**Properties:**
- **Address range**: System-dependent (typically $0200-$CFFF on C64)
- **Speed**: Standard access speed
- **Size**: Large (20KB+ available on most systems)
- **Default**: Used when no storage class specified

See [Variables](10-variables.md#ram---general-ram) for detailed information.

#### @data - Initialized Data Section

Allocates variables in **ROM-able initialized data section**:

```js
@data const lookupTable: byte[256] = [...];
@data const fontData: byte[2048] = [...];
```

**Properties:**
- **Location**: Typically in ROM or initialized data area
- **Access**: Read-only
- **Purpose**: Constant lookup tables, pre-initialized data

See [Variables](10-variables.md#data---initialized-data-section) for detailed information.

## Storage Class Selection Guidelines

Choose the appropriate storage class based on your variable's characteristics:

### Use @zp (Zero Page) When:

✅ **Variable is accessed frequently** in performance-critical code  
✅ **Variable is byte or word** (8 or 16 bits)  
✅ **You need fast zero-page addressing modes** (saves cycles and bytes)  
⚠️ **Warning**: Zero page is limited to 256 bytes total and shared with system/runtime

**Examples:**
```js
// Performance-critical loop counter in zero page
@zp let frameCount: byte = 0;

// Frequently accessed game state
@zp let playerX: byte;
@zp let playerY: byte;

// Pointer for indirect addressing
@zp let dataPointer: word;
```

**Cycle Savings:**
```js
// Zero page access: 3 cycles
LDA $FB       ; Zero page addressing

// Absolute addressing: 4 cycles
LDA $C000     ; Absolute addressing
```

### Use @ram (or Omit) When:

✅ **General-purpose variables**  
✅ **Large arrays or buffers**  
✅ **No special performance requirements**  
✅ **This is the default** and most common choice  
✅ **Suitable for 99% of variables**

**Examples:**
```js
// Large buffer uses default @ram (no annotation needed)
let screenBuffer: byte[1000];

// General-purpose variables
let enemyHealth: byte[10];
let tempData: byte;
```

### Use @data When:

✅ **Constant data** that must be pre-initialized at compile time  
✅ **ROM-able constant tables** (lookup tables, tile data, etc.)  
✅ **Data that should not consume RAM**  
✅ **Usually combined with `const` declarations**

**Examples:**
```js
// Constant lookup table in data section
@data const sinTable: byte[256] = [...];

// Graphics data
@data const spriteData: byte[64] = [...];

// Text constants
@data const gameTitle: string = "SNAKE GAME";
```

## Callback Functions

The `callback` keyword is used for **function pointers**, primarily for interrupt handlers.

### Interrupt Handlers

6502 systems have several interrupt vectors:

- **IRQ** - Hardware interrupt request
- **NMI** - Non-maskable interrupt
- **RESET** - System reset vector

```js
callback function rasterIRQ(): void
  // Interrupt handler code
  vicBorderColor = frameCount;
end function

callback function vblankIRQ(): void
  // Vertical blank interrupt
  frameCount += 1;
end function
```

### Function Pointers

The `callback` type can be used for function pointers:

```js
let handler: callback = myFunction;
```

See [Functions](11-functions.md#callback-functions) for detailed information.

## Memory-Mapped Hardware Access

The `@map` feature provides type-safe, zero-overhead access to hardware registers.

### Hardware Register Access

Traditional BASIC approach:
```basic
POKE 53280, 5     REM Set border color
```

Blend65 approach:
```js
@map vicBorderColor at $D020: byte;
vicBorderColor = 5;  // Compiles to: STA $D020
```

See [Memory-Mapped](12-memory-mapped.md) for complete documentation.

## 6502 Addressing Modes

Blend65's features map directly to 6502 addressing modes:

### Zero Page Addressing

```js
@zp let counter: byte;
counter = 10;

// Generates:
// LDA #$0A
// STA $FB    ; Zero page addressing (2 bytes, 3 cycles)
```

### Absolute Addressing

```js
let value: byte;
value = 10;

// Generates:
// LDA #$0A
// STA $C000  ; Absolute addressing (3 bytes, 4 cycles)
```

### Indexed Addressing

```js
let buffer: byte[256];
buffer[i] = 10;

// Generates:
// LDX ZP_I
// LDA #$0A
// STA $C000,X  ; Absolute indexed addressing
```

### Indirect Addressing (Future)

Zero page pointers enable indirect addressing:

```js
@zp let pointer: word = $C000;
// Future syntax for dereferencing pointers
```

## Performance Considerations

### Zero Page Benefits

**Code Size:**
```
Zero Page:    LDA $FB      ; 2 bytes
Absolute:     LDA $C000    ; 3 bytes
```

**Execution Speed:**
```
Zero Page:    3 cycles
Absolute:     4 cycles
```

**For 60 FPS game loop accessing 10 zero-page variables:**
- Zero page: 30 cycles saved per frame
- Absolute: 40 cycles per frame
- **Savings**: 10 cycles per frame = 600 cycles per second

### Loop Optimization

```js
// ✅ GOOD: Counter in zero page
@zp let i: byte;
for i = 0 to 255
  buffer[i] = 0;
next i

// ⚠️ SLOWER: Counter in RAM
let i: byte;
for i = 0 to 255
  buffer[i] = 0;
next i
```

## System-Specific Considerations

### Commodore 64

**Zero Page Usage:**
- $00-$8F: Used by BASIC/KERNAL
- $90-$FF: Available for user programs (112 bytes)

**Memory Map:**
- $0000-$00FF: Zero page
- $0200-$0FFF: Available RAM
- $1000-$CFFF: Program area
- $D000-$DFFF: I/O area (VIC-II, SID, CIA)
- $E000-$FFFF: KERNAL ROM

**Common Hardware Registers:**
```js
@map vicBorderColor at $D020: byte;
@map vicBackgroundColor at $D021: byte;
@map sidVoice1FreqLo at $D400: byte;
@map cia1DataPortA at $DC00: byte;
```

### VIC-20

**Zero Page Usage:**
- $00-$8F: Used by BASIC/KERNAL
- $90-$FF: Available for user programs

**Memory Map:**
- $0000-$00FF: Zero page
- $1000-$1FFF: Program area (3KB unexpanded)
- $9000-$9FFF: I/O area
- $C000-$FFFF: ROM

### Commander X16

**Zero Page Usage:**
- $00-$7F: System
- $80-$FF: User space (128 bytes)

**Extended features:**
- Banked RAM
- VERA video chip
- Multiple banks for zero page

## Best Practices

### 1. Reserve Zero Page for Hot Variables

```js
// ✅ GOOD: Frequently accessed in game loop
@zp let frameCount: byte;
@zp let playerX: byte;
@zp let playerY: byte;

// ❌ BAD: Rarely accessed
@zp let configValue: byte = 5;  // Wastes precious zero page
```

### 2. Use Memory-Mapped for Hardware

```js
// ✅ GOOD: Type-safe hardware access
@map vicBorderColor at $D020: byte;
vicBorderColor = 0;

// ❌ AVOID: Manual PEEK/POKE (if supported)
// poke($D020, 0);  // Less safe, less clear
```

### 3. Profile Before Optimizing

```js
// Start with default @ram
let counter: byte;

// Profile and identify hot variables
// Then move to @zp if needed
@zp let counter: byte;
```

### 4. Document Zero Page Usage

```js
// Zero page allocation map:
// $FB-$FC: Data pointer (word)
// $FD: Loop counter (byte)
// $FE-$FF: Temporary storage (word)

@zp let dataPointer: word;   // $FB-$FC
@zp let loopCounter: byte;   // $FD
@zp let tempValue: word;     // $FE-$FF
```

## Common Patterns

### Game Loop Optimization

```js
module Game.Main

// Zero page variables for game loop
@zp let frameCount: byte = 0;
@zp let playerX: byte = 10;
@zp let playerY: byte = 10;
@zp let inputState: byte = 0;

// General RAM for less critical data
let enemies: byte[10];
let bullets: byte[20];

function gameLoop(): void
  while true
    // Zero page access is fast
    frameCount += 1;
    playerX += inputState;
    
    // RAM access is standard speed
    updateEnemies();
    updateBullets();
  end while
end function
```

### Hardware Register Access

```js
module C64.Graphics

// Memory-mapped hardware registers
@map vic at $D000 layout
  borderColor: at $D020: byte,
  backgroundColor: at $D021: byte,
  spriteEnable: at $D015: byte
end @map

export function initGraphics(): void
  vic.borderColor = 0;
  vic.backgroundColor = 0;
  vic.spriteEnable = 0xFF;
end function
```

## Limitations and Trade-offs

### Zero Page Limitations

- **Limited space**: Only 256 bytes total
- **System usage**: BASIC/KERNAL uses $00-$8F on C64
- **Available**: ~112 bytes on C64, varies by system
- **Shared**: With runtime and libraries

### Storage Class Trade-offs

| Feature | @zp | @ram | @data |
|---------|-----|------|-------|
| Speed | Fastest | Standard | Standard (read-only) |
| Size | 256 bytes | Large | Large |
| Code size | Smallest | Standard | Standard |
| Use case | Hot variables | General purpose | Constants |

## Implementation Notes

6502-specific features are implemented in:
- `packages/compiler/src/lexer/` - Storage class tokens
- `packages/compiler/src/parser/` - Storage class parsing
- `packages/compiler/src/codegen/` - 6502 code generation

See [Variables](10-variables.md), [Memory-Mapped](12-memory-mapped.md), and [Functions](11-functions.md) for detailed feature documentation.
