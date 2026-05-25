# Intrinsics

> **Status**: Draft  
> **Related**: [ASM Functions](09-asm-functions.md)

## Overview

Intrinsics are built-in functions that the compiler handles specially. They either:
- Generate optimized inline code (no function call overhead)
- Evaluate at compile-time (no runtime cost)

Blend65 provides **10 core intrinsic functions** for memory access, byte extraction, compile-time operations, and optimizer control.

CPU control operations (sei, cli, nop, brk) and stack operations (pha, pla, php, plp) are available as `asm_*()` functions - see [ASM Functions](09-asm-functions.md).

## Memory Access Intrinsics

### peek

Read a byte from memory.

```js
function peek(address: word): byte;
```

**Usage:**
```js
let borderColor = peek($D020);
let value = peek(myAddress);
```

**Code Generation:** Single `LDA` instruction.

---

### poke

Write a byte to memory.

```js
function poke(address: word, value: byte): void;
```

**Usage:**
```js
poke($D020, 14);          // Set border to light blue
poke(SCREEN_BASE, 65);    // Write 'A' to screen
```

**Code Generation:** Single `STA` instruction.

---

### peekw

Read a 16-bit word from memory (little-endian).

```js
function peekw(address: word): word;
```

**Usage:**
```js
let timer = peekw($DC04);     // Read CIA timer
let pointer = peekw($FB);     // Read ZP pointer
```

**Code Generation:** Two `LDA` instructions for low and high bytes.

---

### pokew

Write a 16-bit word to memory (little-endian).

```js
function pokew(address: word, value: word): void;
```

**Usage:**
```js
pokew($FB, screenAddress);    // Set up ZP pointer
pokew($DC04, $4000);          // Set CIA timer
```

**Code Generation:** Two `STA` instructions for low and high bytes.

## Byte Extraction Intrinsics

### lo

Extract the low byte (bits 0-7) of a word.

```js
function lo(value: word): byte;
```

**Usage:**
```js
let addr: word = $1234;
let low = lo(addr);      // $34

poke($FB, lo(screenAddress));
```

**Compile-time:** For constant values, evaluated at compile time (zero runtime cost).

---

### hi

Extract the high byte (bits 8-15) of a word.

```js
function hi(value: word): byte;
```

**Usage:**
```js
let addr: word = $1234;
let high = hi(addr);     // $12

poke($FC, hi(screenAddress));
```

**Compile-time:** For constant values, evaluated at compile time (zero runtime cost).

## Compile-Time Intrinsics

### length

Get the number of elements in an array or characters in a string.

```js
function length(array: byte[]): word;
function length(array: word[]): word;
function length(str: string): word;
```

**Usage:**
```js
let scores: byte[] = [10, 20, 30, 40, 50];
let count = length(scores);    // 5 (compile-time constant)

let message: string = "Hello";
let len = length(message);     // 5 (compile-time constant)
```

**Important:** Since all arrays have fixed sizes known at compile time, `length()` is ALWAYS evaluated at compile time. No runtime code is generated.

## Optimizer Control Intrinsics

### barrier

Insert an optimization barrier. Prevents the optimizer from reordering code across this point.

```js
function barrier(): void;
```

**Usage:**
```js
poke($D020, 14);
barrier();           // Ensure this write happens before next
poke($D021, 6);
```

**Code Generation:** No code generated - directive to optimizer only.

---

### volatile_read

Read from memory in a way that cannot be optimized away.

```js
function volatile_read(address: word): byte;
```

**Usage:**
```js
// Reading clears interrupt flags - MUST actually read
let status = volatile_read($DC0D);

// Polling hardware register
while ((volatile_read($D012) & $80) == 0) {
  // Wait for raster
}
```

**Code Generation:** Forced `LDA` instruction, never optimized away.

---

### volatile_write

Write to memory in a way that cannot be optimized away.

```js
function volatile_write(address: word, value: byte): void;
```

**Usage:**
```js
// Acknowledge interrupt - MUST actually write
volatile_write($DC0D, $7F);
```

**Code Generation:** Forced `STA` instruction, never optimized away.

## CPU and Stack Operations

The following CPU control and stack operations are NOT intrinsics - they are available as `asm_*()` functions:

| Operation | ASM Function |
|-----------|--------------|
| Disable interrupts | `asm_sei()` |
| Enable interrupts | `asm_cli()` |
| No operation | `asm_nop()` |
| Break | `asm_brk()` |
| Push accumulator | `asm_pha()` |
| Pull accumulator | `asm_pla()` |
| Push processor status | `asm_php()` |
| Pull processor status | `asm_plp()` |

See [ASM Functions](09-asm-functions.md) for the complete list of all 56 6502 instructions.

## Summary

| Intrinsic | Purpose | Runtime Cost |
|-----------|---------|--------------|
| `peek` | Read byte | 4 cycles |
| `poke` | Write byte | 4 cycles |
| `peekw` | Read word | 8 cycles |
| `pokew` | Write word | 8 cycles |
| `hi` | High byte | 0 (compile-time) or 3 cycles |
| `lo` | Low byte | 0 (compile-time) |
| `length` | Array length | 0 (compile-time) |
| `barrier` | Opt barrier | 0 cycles |
| `volatile_read` | Forced read | 4 cycles |
| `volatile_write` | Forced write | 4 cycles |