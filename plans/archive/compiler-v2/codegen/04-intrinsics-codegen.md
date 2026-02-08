# Intrinsics Code Generation

> **Document**: 04-intrinsics-codegen.md
> **Parent**: [Index](00-index.md)

## Overview

Intrinsics are built-in functions that generate optimized inline code. The Code Generator handles these specially, producing efficient 6502 patterns.

## Memory Access Intrinsics

### peek(address: word): byte

Read a byte from a memory address.

**Constant Address (Compile-Time Known):**
```asm
; peek($D020)
LDA $D020          ; Direct absolute addressing
```

**Variable Address (Runtime):**
```asm
; peek(addr) where addr is in A/X
STA $FB            ; Store low byte to ZP pointer
STX $FC            ; Store high byte
LDY #0
LDA ($FB),Y        ; Indirect indexed load
```

---

### poke(address: word, value: byte): void

Write a byte to a memory address.

**Constant Address:**
```asm
; poke($D020, 14)
LDA #14
STA $D020
```

**Variable Address:**
```asm
; poke(addr, value) - value in A, address set up
STA $FD            ; Save value temporarily
; (address setup: low→$FB, high→$FC)
LDY #0
LDA $FD
STA ($FB),Y        ; Indirect indexed store
```

---

### peekw(address: word): word

Read a 16-bit word (little-endian).

**Constant Address:**
```asm
; peekw($FB)
LDA $FB            ; Low byte → A
LDX $FC            ; High byte → X
```

**Variable Address:**
```asm
; peekw(addr) - indirect
STA $FB
STX $FC
LDY #0
LDA ($FB),Y        ; Low byte
PHA                ; Save it
INY
LDA ($FB),Y        ; High byte
TAX                ; High → X
PLA                ; Low → A
```

---

### pokew(address: word, value: word): void

Write a 16-bit word (little-endian).

**Constant Address:**
```asm
; pokew($FB, $1234)
LDA #$34
STA $FB
LDA #$12
STA $FC
```

**Variable Address:**
```asm
; Value in A/X, address in $FB/$FC
LDY #0
STA ($FB),Y        ; Store low byte
INY
TXA
STA ($FB),Y        ; Store high byte
```

---

## Byte Extraction Intrinsics

### lo(value: word): byte

Extract low byte of a word.

```asm
; lo($1234) - compile time
LDA #$34

; lo(wordVar) - A already has low byte after LOAD_WORD
; No code needed - A already has the low byte
```

---

### hi(value: word): byte

Extract high byte of a word.

```asm
; hi($1234) - compile time
LDA #$12

; hi(wordVar) - after LOAD_WORD, X has high byte
TXA                ; Move X (high) to A
```

---

## Optimizer Control Intrinsics

### barrier(): void

Optimization barrier - no code generated, just prevents instruction reordering.

```asm
; barrier()
; (No code - marker for optimizer)
```

---

### volatile_read(address: word): byte

Forced read that cannot be optimized away.

```asm
; volatile_read($DC0D)
LDA $DC0D          ; Always generated, never eliminated
```

---

### volatile_write(address: word, value: byte): void

Forced write that cannot be optimized away.

```asm
; volatile_write($DC0D, $7F)
LDA #$7F
STA $DC0D          ; Always generated, never eliminated
```

---

## Compile-Time Intrinsics

### length(array): word

Array length - evaluated at compile time.

```asm
; let arr: byte[] = [1,2,3,4,5]
; let len = length(arr)
LDA #5             ; Compile-time constant
LDX #0             ; High byte always 0 for small arrays
```

**Note:** No runtime code for length() - all arrays have fixed sizes known at compile time.

---

## Zero Page Pointer Usage

The code generator reserves $FB-$FE for indirect addressing:

| ZP Address | Purpose |
|------------|---------|
| $FB-$FC | Pointer for peek/poke with variable address |
| $FD | Temporary value storage |
| $FE | Reserved for future use |

These addresses are safe (not used by BASIC or KERNAL).