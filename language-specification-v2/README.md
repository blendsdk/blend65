# Blend65 Language Specification

> **Status**: Draft  
> **Date**: January 29, 2026  
> **Architecture**: Static Frame Allocation (SFA)

## Overview

Blend65 is a TypeScript-like language designed for Commodore 64 development. It compiles to efficient 6502 machine code using **Static Frame Allocation (SFA)**.

## Design Philosophy

- **"TypeScript for C64"** - Modern syntax, rich libraries, just works
- **Simplicity over complexity** - Fewer features, done right
- **6502-native design** - Works WITH the hardware, not against it
- **Beginner-friendly** - Clear errors, good documentation

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Overview](00-overview.md) | Language overview and goals |
| 01 | [Lexical Structure](01-lexical-structure.md) | Tokens, keywords, literals |
| 02 | [Types](02-types.md) | Type system |
| 03 | [Variables](03-variables.md) | Variable declarations, storage classes |
| 04 | [Expressions](04-expressions.md) | Operators, precedence |
| 05 | [Statements](05-statements.md) | Control flow |
| 06 | [Functions](06-functions.md) | Function declarations, callbacks |
| 07 | [Modules](07-modules.md) | Import/export system |
| 08 | [Intrinsics](08-intrinsics.md) | Built-in functions |
| 09 | [ASM Functions](09-asm-functions.md) | 6502 instruction functions |
| 10 | [Compiler](10-compiler.md) | SFA architecture, pipeline |

## Quick Reference

### Types

```js
byte        // 8-bit unsigned (0-255)
word        // 16-bit unsigned (0-65535)
boolean     // true/false (stored as byte)
byte[]      // Fixed-size byte array
word[]      // Fixed-size word array
string      // Null-terminated byte array
@address    // Pointer (semantic alias for word)
callback    // Function pointer (word)
```

### Storage Classes

```js
@zp let fastVar: byte = 0;       // Zero Page (fastest)
@ram let buffer: byte[256];      // General RAM (default)
@data const table: byte[10] = [...]; // Read-only data section
let x: byte = 0;                 // Default: @ram
```

### Intrinsics

```js
// Memory access
peek(address: word): byte
poke(address: word, value: byte): void
peekw(address: word): word
pokew(address: word, value: word): void

// Byte extraction
hi(value: word): byte
lo(value: word): byte

// Compile-time
length(array: byte[]): word

// Optimizer control
barrier(): void
volatile_read(address: word): byte
volatile_write(address: word, value: byte): void
```

### ASM Functions (all 56 6502 instructions)

```js
// Examples
asm_sei();              // SEI - disable interrupts
asm_cli();              // CLI - enable interrupts
asm_lda_imm(value);     // LDA #value
asm_sta_abs(address);   // STA address
asm_jsr(address);       // JSR address
asm_rts();              // RTS
asm_pha();              // PHA
asm_pla();              // PLA
// ... etc (see 09-asm-functions.md for complete list)
```

### Example Program

```js
module Game.Main;

// Constants
const BORDER_COLOR: word = $D020;
const SCREEN_BASE: word = $0400;

// Zero-page variables (fast access)
@zp let playerX: byte = 20;
@zp let playerY: byte = 12;

// RAM variables
let score: word = 0;

// Exported main entry point
export function main(): void {
  init();
  
  while (true) {
    updateGame();
    waitVBlank();
  }
}

function init(): void {
  poke(BORDER_COLOR, 14);  // Light blue border
  clearScreen();
}

function clearScreen(): void {
  for (let i: word = 0; i < 1000; i += 1) {
    poke(SCREEN_BASE + i, 32);  // Space character
  }
}

function updateGame(): void {
  // Game logic here
  score += 1;
}

function waitVBlank(): void {
  // Wait for raster line 255
  while (peek($D012) != 255) {
    // Spin
  }
}
```

## Memory Model (C64)

```
$0000-$00FF  Zero Page (256 bytes)
  $00-$01    CPU vectors
  $02-$8F    User @zp variables
  $90-$FA    KERNAL workspace
  $FB-$FE    Compiler pointers
  
$0200-$03FF  Input buffer / SFA frames
$0400-$07FF  Screen RAM
$0800-$9FFF  BASIC area (available if BASIC off)
$C000-$CFFF  Free RAM
$D000-$DFFF  I/O area
$E000-$FFFF  KERNAL ROM
```

## Compiler Pipeline

```
Source → Lexer → Parser → Semantic → Frame Alloc → IL Gen → [IL Opt] → CodeGen → [ASM Opt] → Emit
                                                              ↑                     ↑
                                                         Empty slot           Peephole opt
                                                         (future O2)          (active O1)
```

## Restrictions

1. **No recursion** - Direct or indirect recursion is a compile error
2. **No dynamic allocation** - All memory is static
3. **Fixed array sizes** - Array sizes known at compile time
4. **No nested functions** - Functions at module level only
5. **No function overloading** - One function per name
6. **Pass by value only** - No references or pointers to locals