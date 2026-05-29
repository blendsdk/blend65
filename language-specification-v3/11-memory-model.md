# Chapter 11 — Memory Model & Static Frame Allocation

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F005, F018, F019 (consolidated)

---

## 1. Overview

Blend65 uses **Static Frame Allocation (SFA)** — all memory allocation decisions are made at compile time. There is no heap, no dynamic allocation, no garbage collector. Every variable, parameter, and local has a fixed memory address determined before the program runs.

This chapter is the canonical reference for:
- The memory map model (code, data, RAM, zero page, hardware stack)
- SFA frame allocation for functions
- Frame coloring (memory sharing for non-overlapping lifetimes)
- Zero-page budget and allocation
- Hardware stack usage
- Build summary reporting

---

## 2. Memory Map

### 2.1 Segments

The compiler organizes the output binary into segments. The platform profile (→ Ch 15) defines the address ranges for each segment.

| Segment | Contents | Placement |
|---------|----------|-----------|
| **Code** | Machine code for all functions, startup routine | Platform-defined code area |
| **Data** | Const arrays, const structs, `embed()` assets | Platform-defined data area (ROM on cartridge, RAM on disk) |
| **RAM** | Module-level `let` variables, SFA frames | Platform-defined RAM area |
| **Zero Page** | `zeropage` variables, compiler temps, struct/array pointers | $00–$FF (platform profile defines available range) |
| **Hardware Stack** | Return addresses (JSR/RTS), interrupt context | $0100–$01FF (fixed by 6502 architecture) |

### 2.2 Example Memory Map (C64)

```
$0000–$00FF  Zero Page
  $00–$01    6510 I/O direction registers (hardware)
  $02–$2F    Available for Blend65 ZP variables + compiler temps
  $30–$FF    KERNAL/BASIC usage (reserved)

$0100–$01FF  Hardware Stack (256 bytes)

$0800–$9FFF  RAM — Code + Data + Variables
  $0801–...  Code segment (startup + functions)
  ...–$9FFF  Data segment (const arrays/structs) + RAM variables + SFA frames

$A000–$BFFF  BASIC ROM (can be banked out for more RAM)
$C000–$CFFF  Free RAM (if BASIC ROM banked out)
$D000–$DFFF  I/O registers (VIC-II, SID, CIA)
$E000–$FFFF  KERNAL ROM
```

The exact layout varies per platform and is configured in the platform profile.

---

## 3. Static Frame Allocation (SFA)

### 3.1 Core Principle

Every function gets a **static memory frame** — a fixed-size block of RAM at a compile-time-known address. The frame holds the function's parameters and local variables.

```
Function: calculate(a: byte, b: byte): word
  Frame at $2000 (example):
    $2000: parameter 'a'    (1 byte)
    $2001: parameter 'b'    (1 byte)
    $2002: local 'result'   (2 bytes)
    $2004: local 'temp'     (1 byte)
  Total frame size: 5 bytes
```

### 3.2 Why SFA?

| Traditional (stack-based) | SFA (static) |
|--------------------------|--------------|
| Parameters pushed to stack | Parameters stored at fixed addresses |
| Stack pointer manipulation per call | No stack pointer manipulation |
| Variable-size stack frame | Fixed-size frame, known at compile time |
| Supports recursion | No recursion (→ Ch 06, FN-6) |
| 256-byte stack limit is a problem | Stack only holds return addresses |
| Frame access via stack pointer + offset | Frame access via absolute addressing |

On the 6502, stack-based calling is expensive: the hardware stack is only 256 bytes, there is no frame pointer register, and accessing stack data requires pulling/pushing (destroying the data order). SFA eliminates all of this.

### 3.3 Frame Size per Type

| Item | Frame Bytes |
|------|-------------|
| `byte` / `sbyte` / `boolean` parameter or local | 1 |
| `word` / `sword` parameter or local | 2 |
| Enum parameter or local | 1 |
| Struct parameter (by-reference) | 2 (base address pointer) |
| Array parameter (by-reference) | 2 (base address pointer) |
| Struct local (by-value) | `sizeof(Type)` |
| Array local (by-value) | element size × count |

### 3.4 Frame Coloring

Functions with **non-overlapping lifetimes** can share frame memory. The compiler computes this from the static call graph.

```
Call graph:
  main → init, update, render
  update → handleInput, moveEnemies
  render → drawBackground, drawSprites

Frame allocation:
  init, update, render    — all called from main, never simultaneously
  handleInput, moveEnemies — both called from update, never simultaneously
  drawBackground, drawSprites — both called from render, never simultaneously

Sharing:
  init and render can share frame memory (non-overlapping)
  handleInput and drawSprites can share frame memory (non-overlapping)
```

**Result**: The total frame region is typically 30–60% smaller than the sum of all individual frames.

### 3.5 Frame Region Size

The compiler computes the worst-case simultaneous frame usage from the call graph. This is reported in the build summary:

```
Frame allocation:
  Total frame region: 47 bytes at $2000–$202E
  Peak simultaneous usage: main(3) + update(5) + handleInput(2) = 10 bytes
  Sharing saved: 37 bytes via frame coloring
```

---

## 4. Zero-Page Allocation

### 4.1 ZP Budget

The platform profile defines the available zero-page range. The compiler allocates from this range for:

1. **User-declared `zeropage` variables** — explicit developer request
2. **Compiler temps** — scratch bytes for expression evaluation
3. **Struct/array pointers** — 2-byte pointers for indirect addressing (`(ptr),Y`)
4. **Interrupt handler temps** — separate from main code temps (→ Ch 06, §7.6)

### 4.2 ZP Allocation Priority

1. User-declared `zeropage` variables (highest priority)
2. Struct/array pointers (2 bytes per active by-ref parameter level)
3. Expression evaluation temps
4. Interrupt handler temps (separate pool)

### 4.3 ZP Sharing

Like SFA frames, ZP pointer bytes are shared between functions with non-overlapping lifetimes:

| Call Pattern | ZP Pointer Bytes |
|-------------|-----------------|
| Sequential: `f(s); g(s);` | 2 bytes (shared) |
| Nested: `f(s)` calls `g(s2)` | 4 bytes |
| Deep: `f → g → h`, all with struct params | 6 bytes |

### 4.4 Budget Exceeded

If total ZP allocation exceeds the platform budget → E10032.

---

## 5. Hardware Stack Usage

### 5.1 Stack Purpose

In Blend65, the hardware stack ($0100–$01FF, 256 bytes) is used **only** for:
- **Return addresses** — 2 bytes per active `JSR` (function call)
- **Interrupt context** — 3 bytes CPU push (P, PCL, PCH) + 3 bytes register save (A, X, Y)

Parameters, locals, and return values **never** touch the hardware stack.

### 5.2 Stack Budget

The compiler computes worst-case stack usage from the call graph:

```
Stack budget (C64 example):
  256 bytes total
  - 20 bytes KERNAL reserve
  - 6 bytes per interrupt entry (3 CPU + 3 registers)
  = 230 bytes available for call chain
  = 115 call levels maximum (2 bytes each)
```

### 5.3 Stack Depth Warning

If the maximum call depth approaches the platform-defined stack budget, the compiler emits W10180 (→ Ch 06).

---

## 6. Build Summary

The compiler produces a **build summary** reporting all memory usage. This is critical for developers targeting constrained platforms.

```
=== Blend65 Build Summary ===
Platform: c64
Target: game.prg

Code segment:    1,247 bytes ($0801–$0CE0)
Data segment:      312 bytes ($0CE1–$0E18)  [const arrays, strings, embed data]
RAM variables:      89 bytes ($0E19–$0E71)
SFA frames:         47 bytes ($0E72–$0EA0)  [peak: 10 bytes simultaneous]

Zero page:
  User variables:   6 bytes
  Compiler temps:   4 bytes
  Struct pointers:  4 bytes
  IRQ temps:        2 bytes
  Total:           16 / 30 bytes (53%)

Hardware stack:
  Max call depth:   4 levels (8 bytes)
  IRQ overhead:     6 bytes
  Total peak:      14 / 230 bytes (6%)

Startup routine:   42 bytes, 68 cycles

Total binary:    1,695 bytes
```

---

## 7. Memory Placement Summary

Cross-reference of where each language construct lives in memory:

| Construct | Segment | Size | Notes |
|-----------|---------|------|-------|
| Module-level `let` scalar | RAM | 1–2 bytes | Initialized in startup |
| Module-level `let` array | RAM | N × element size | Initialized if has initializer |
| Module-level `let` struct | RAM | `sizeof(Type)` | Initialized if has initializer |
| Module-level `const` scalar | Inlined | 0 bytes | Replaced by literal at use site |
| Module-level `const` array | Data | N × element size | Baked into binary |
| Module-level `const` struct | Data | `sizeof(Type)` | Baked into binary |
| `zeropage` variable | Zero page | 1–2 bytes | Fast access |
| Function parameter (scalar) | SFA frame | 1–2 bytes | Caller writes before JSR |
| Function parameter (struct/array) | SFA frame | 2 bytes | Base address pointer |
| Function local (scalar) | SFA frame | 1–2 bytes | — |
| Function local (struct) | SFA frame | `sizeof(Type)` | — |
| Function local (array) | SFA frame | N × element size | — |
| Return value | CPU registers | 0 bytes RAM | A or A/X |
| Return address | Hardware stack | 2 bytes | Per active call |
| `embed()` data | Data | File size | Baked into binary |

---

## 8. Error Codes

| Code | Condition | Message |
|------|-----------|---------|
| E10032 | ZP budget exceeded | `Zero-page budget exceeded — <used> bytes used, platform '<platform>' allows <budget> bytes` |
| E10033 | RAM budget exceeded | `RAM usage (<used> bytes) exceeds platform '<platform>' available RAM (<budget> bytes)` |
| E10034 | Binary too large | `Output binary (<size> bytes) exceeds platform '<platform>' maximum binary size (<limit> bytes)` |

## Warning Codes

| Code | Condition | Message |
|------|-----------|---------|
| W10180 | Stack depth near limit | `Maximum stack depth is <N> bytes on platform '<platform>' — stack budget is <budget> bytes` |
| W10030 | Large ZP allocation | `Zeropage allocation uses <N> of <budget> bytes — consider total ZP budget` |
| W10033 | RAM nearing limit | `RAM usage is <percent>% of platform '<platform>' budget` |
