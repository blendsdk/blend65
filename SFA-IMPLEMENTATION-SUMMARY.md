# Static Frame Allocation (SFA) - Implementation Summary

> **Purpose**: High-level overview of SFA implementation for Blend65
> **Created**: 2025-01-02
> **Status**: ✅ Approved
> **Background**: Based on research of CC65, KickC, Oscar64, and Prog8 compilers

---

## Table of Contents

1. [What is SFA and Why Do We Need It?](#1-what-is-sfa-and-why-do-we-need-it)
2. [Language Syntax (No Changes)](#2-language-syntax-no-changes)
3. [Memory Layout Overview](#3-memory-layout-overview)
4. [Allocation Rules by Variable Type](#4-allocation-rules-by-variable-type)
5. [Zero Page Strategy (Simplified)](#5-zero-page-strategy-simplified)
6. [Frame Coalescing (Memory Optimization)](#6-frame-coalescing-memory-optimization)
7. [Recursion Handling](#7-recursion-handling)
8. [Interrupt Safety](#8-interrupt-safety)
9. [Generated Code Examples](#9-generated-code-examples)
10. [Implementation Phases](#10-implementation-phases)
11. [Final Decisions](#11-final-decisions)

---

## 1. What is SFA and Why Do We Need It?

### The Problem

The 6502 has a tiny hardware stack (256 bytes at $0100-$01FF). Traditional stack-based allocation (like C compilers use) is:
- **Slow**: Every function call requires stack manipulation (50-80 cycles overhead)
- **Risky**: Stack overflow crashes the program silently
- **Complex**: Runtime stack pointer management

### The Solution: Static Frame Allocation

Instead of allocating function locals/parameters at runtime, we allocate them **at compile time** to fixed memory addresses.

**Before (Stack-Based)**:
```asm
; Every function call has overhead
my_func:
    jsr decsp4      ; Allocate 4 bytes on stack (overhead!)
    ; ... function body ...
    jsr incsp4      ; Deallocate (more overhead!)
    rts
```

**After (Static Frame Allocation)**:
```asm
; Zero overhead function
my_func:
    ; Just execute - no prologue
    lda my_func.local1
    sta my_func.result
    rts             ; Just return - no epilogue
```

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Zero Call Overhead** | No stack manipulation = ~50-80 cycles saved per call |
| **Predictable Memory** | Every variable has a known address at compile time |
| **No Stack Overflow** | Memory is pre-allocated; errors caught at compile time |
| **Better Debugging** | Variables are at fixed addresses - easy to inspect |
| **Smaller Code** | No stack manipulation instructions |

### The Trade-off

**No recursion by default.** A function cannot call itself because its locals would overwrite themselves. This is fine for 99% of 6502 code.

---

## 2. Language Syntax (No Changes)

SFA is an **internal compiler optimization**. The language syntax remains exactly as documented:

### Storage Classes (Existing)

```js
// Zero Page - fast, limited (256 bytes total)
@zp let counter: byte = 0;

// General RAM - default, larger
@ram let buffer: byte[256];
let buffer2: byte[256];  // Same as @ram

// Data Section - for constants
@data const lookupTable: byte[256] = [/* ... */];
```

### Variable Declarations (Existing)

```js
// Module-level (global)
let score: word = 0;
const MAX_ENEMIES: byte = 10;

// Function-level (local)
function update(): void {
    let temp: byte = 0;      // Local to this function
    let result: word = 0;
}
```

### Function Parameters (Existing)

```js
function draw(x: byte, y: byte, color: byte): void {
    // Parameters are accessed like locals
    poke($D020, color);
}
```

**Key Point**: The developer doesn't see SFA. They write normal Blend code, and the compiler handles memory allocation internally.

---

## 3. Memory Layout Overview

The compiler organizes memory into distinct regions:

```
C64 Memory Map with SFA
========================

$0000-$0001   CPU Indirect (reserved)
$0002-$008F   ZERO PAGE (142 bytes available)
              ├── @zp module globals
              ├── @zp function locals (high priority)
              └── Compiler scratch ($FB-$FE)

$0090-$00FF   KERNAL/BASIC ZP (reserved)

$0100-$01FF   Hardware Stack (return addresses only!)

$0200-$03FF   STATIC FRAME REGION (512 bytes)
              ├── Function frames (grouped by coalesce)
              ├── Function parameters
              └── Function locals

$0400-$07FF   Screen RAM (VIC-II)

$0800+        PROGRAM CODE & DATA
              ├── @ram module globals
              ├── @data constants
              └── Large arrays
```

### Memory Region Limits (C64 Default)

| Region | Start | End | Size | Purpose |
|--------|-------|-----|------|---------|
| Zero Page | $02 | $8F | 142 bytes | Fast variables |
| Frame Region | $0200 | $03FF | 512 bytes | Function locals |
| General RAM | $0800+ | varies | ~38KB | Module globals, arrays |

---

## 4. Allocation Rules by Variable Type

### 4.1 Module-Level Variables (Globals)

Variables declared at module scope:

```js
module Game.Main;

@zp let playerX: byte = 10;      // → Zero Page
@ram let buffer: byte[256];       // → General RAM
let score: word = 0;              // → General RAM (default)
@data const sinTable: byte[256] = [/* */];  // → Data section
```

**Allocation Rule**:
- `@zp` → Zero Page (compile error if ZP full)
- `@ram` or no directive → General RAM ($0800+)
- `@data` → Data section (ROM-able)

### 4.2 Function-Level Variables (Locals)

Variables declared inside functions:

```js
function gameLoop(): void {
    let temp: byte = 0;           // → Frame region
    @zp let fastCounter: byte;    // → Zero Page
    @ram let localBuffer: byte[100]; // → General RAM
}
```

**Allocation Rule**:
- `@zp` → Zero Page (compile error if ZP full)
- `@ram` → General RAM
- No directive → **Frame Region** (coalesced with other functions)

### 4.3 Function Parameters

```js
function draw(x: byte, y: byte, color: byte): void {
    // x, y, color are allocated in the frame region
}
```

**Allocation Rule**:
- First 1-2 parameters: CPU registers (A, Y) when possible
- Remaining parameters: Function's frame in Frame Region

### 4.4 Summary Table

| Variable Type | `@zp` | `@ram` | No Directive |
|---------------|-------|--------|--------------|
| Module global | Zero Page | General RAM | General RAM |
| Function local | Zero Page | General RAM | **Frame Region** |
| Function param | Zero Page | General RAM | Frame Region (or register) |
| Constant | ❌ Error | ❌ Error | Data section |

---

## 5. Zero Page Strategy (Simplified)

### The Simplified Rules

| Directive | Behavior | What Developer Knows |
|-----------|----------|---------------------|
| `@zp` | **MUST** be in Zero Page | ✅ Guaranteed ZP, or compile error |
| `@ram` | **MUST NOT** be in Zero Page | ✅ Guaranteed RAM |
| (none) | Compiler decides | ✅ Deterministic (based on rules below) |

### Automatic ZP Allocation (No Directive)

When a variable has no `@zp` or `@ram` directive, the compiler decides using a **deterministic scoring formula**:

```
score = accessCount × typeWeight × loopBonus
```

**Type Weights**:
| Type | Weight | Rationale |
|------|--------|-----------|
| pointer | High | Enables indirect Y addressing (required) |
| byte | Medium | Most benefit from ZP (1/3 cycle savings) |
| word | Low | Less relative benefit |
| array | 0 | Too large for ZP |

**Loop Bonus**: Variables accessed inside loops get higher priority.

**Process**:
1. Score all variables without explicit directive
2. Sort by score (highest first)
3. Fill ZP until full
4. Remaining go to RAM/Frame Region

### Error Handling

If `@zp` is requested but ZP is full:

```
error: Cannot allocate 'counter' to zero page (full)
  @zp let counter: byte;
      ^^^
  Zero page usage: 142/142 bytes
  Suggestion: Remove @zp from a less critical variable
```

---

## 6. Frame Coalescing (Memory Optimization)

### What is Frame Coalescing?

Functions that **never call each other** can share the same memory for their locals. This can save 30-60% of frame region memory.

### Example

```js
function handleInput(): void {
    let keyCode: byte;      // Uses $0200
    let direction: byte;    // Uses $0201
}

function renderSprites(): void {
    let index: byte;        // Can REUSE $0200!
    let color: byte;        // Can REUSE $0201!
}
```

If `handleInput` never calls `renderSprites` (and vice versa), they're never active at the same time, so they can share memory.

### How It Works

1. **Build Call Graph**: Analyze which functions call which
2. **Find Non-Overlapping Functions**: Functions that can't be active simultaneously
3. **Group into Coalesce Sets**: Functions that can share memory
4. **Allocate Once per Group**: Single memory allocation for the entire group

### Call Graph Example

```
main() ──→ update() ──→ movePlayer()
       ──→ draw()   ──→ drawSprites()
                    ──→ drawUI()
```

**Can Coalesce**: `movePlayer` + `drawSprites` + `drawUI` (never active together)
**Cannot Coalesce**: `update` + `draw` (main calls both)

### Memory Savings

| Without Coalescing | With Coalescing |
|-------------------|-----------------|
| movePlayer: 4 bytes @ $0200 | |
| drawSprites: 6 bytes @ $0204 | coalesced: 8 bytes @ $0200 |
| drawUI: 8 bytes @ $020A | (max of all three) |
| **Total: 18 bytes** | **Total: 8 bytes** |

Savings: ~55%

---

## 7. Recursion Handling

### The Problem

Static allocation and recursion don't mix:

```js
function factorial(n: byte): word {
    if n <= 1 { return 1; }
    return n * factorial(n - 1);  // Problem!
}
```

If `factorial.n` is at address $0200, the recursive call overwrites it.

### Solution: Strict Compile Error

**Decision: ✅ Strict** - Recursion is always a compile error. No `recursive fn` keyword.

If the compiler detects recursion, it produces an error:

```
error: Recursive call detected in 'factorial'
  return n * factorial(n - 1);
               ^^^^^^^^^
  Static frame allocation requires non-recursive functions.
  
  To fix: Rewrite using iteration (recommended for 6502)
```

**Rationale:**
- 99% of 6502 game code doesn't use recursion
- Keeps the compiler simpler
- Forces developers to write more efficient iterative code
- No runtime overhead or software stack complexity

---

## 8. Interrupt Safety

### The Problem

Interrupt handlers (IRQ, NMI) can fire at any time, interrupting normal code:

```js
function update(): void {
    let temp: byte;  // Using memory at some point
    // ... INTERRUPT FIRES HERE! ...
    temp = 10;       // If ISR used same memory, it's corrupted
}

callback irq(): void {
    let counter: byte;  // If this shares memory with update(), BAD!
}
```

### Solution: Thread Context Separation Using `callback`

**Decision: ✅ Use existing `callback` keyword** - No new `interrupt fn` syntax needed.

Functions marked with `callback` are treated as potential interrupt handlers. The compiler tracks two "threads":
1. **Main Thread**: `main()` and everything it calls
2. **ISR Thread**: `callback` functions and what they call

**Rule**: Functions reachable from different threads **cannot coalesce**.

```
Main Thread:                ISR Thread (callbacks):
main()                      callback irq()
  └→ update()                 └→ update_timer()
  └→ draw()                   └→ play_sound()
```

`update` and `update_timer` CANNOT share memory (different threads).
`update` and `draw` CAN share memory (same thread, if non-overlapping).

### Special Case: Shared Functions

If a function is called from BOTH threads:

```js
function utility(): void {
    let temp: byte;  // Problem: called from main AND callback!
}
```

The compiler will:
1. Warn the developer
2. NOT coalesce this function with anything
3. Give it its own dedicated memory

---

## 9. Generated Code Examples

### Simple Function

```js
function add(a: byte, b: byte): byte {
    let result: byte;
    result = a + b;
    return result;
}
```

**Generated Assembly** (Static Frame):
```asm
; No prologue needed!
add:
    lda add.a           ; Load parameter from static address
    clc
    adc add.b           ; Add second parameter
    sta add.result      ; Store to static address
    rts                 ; Return immediately

; Static memory (in Frame Region)
add.a:      .byte 0     ; Parameter 1
add.b:      .byte 0     ; Parameter 2  
add.result: .byte 0     ; Local variable
```

### Zero Page Variable

```js
@zp let playerX: byte = 10;

function movePlayer(): void {
    playerX += 1;
}
```

**Generated Assembly**:
```asm
; Zero page allocation
playerX = $02           ; Fast ZP address

movePlayer:
    inc playerX         ; 5 cycles (ZP mode)
    rts

; Compare to RAM version:
; inc $0800            ; 6 cycles (absolute mode)
```

### Function Call

```js
function main(): void {
    draw(10, 20, 1);
}

function draw(x: byte, y: byte, color: byte): void {
    // ...
}
```

**Generated Assembly**:
```asm
main:
    lda #10
    sta draw.x          ; Store parameter
    lda #20
    sta draw.y
    lda #1
    sta draw.color
    jsr draw            ; Call function
    rts

draw:
    ; Parameters already in static memory
    lda draw.color
    sta $D020
    rts

; Static frame
draw.x:     .byte 0
draw.y:     .byte 0
draw.color: .byte 0
```

---

## 10. Implementation Phases

### Phase 1: Core Type Definitions

Create the TypeScript types for frames:
- `Frame`, `FrameSlot`, `FrameMap`
- `SlotKind` (Parameter, Local, Return)
- `ZpDirective` (Zp, Ram, None)
- Platform configurations

**Complexity**: Low
**Dependencies**: None

### Phase 2: Call Graph Builder

Analyze the AST to build a call graph:
- Which functions call which
- Detect recursion (error or mark)
- Identify interrupt handlers
- Track thread contexts (main vs ISR)

**Complexity**: Medium
**Dependencies**: Semantic Analyzer (symbol table)

### Phase 3: Frame Calculator

Calculate frame sizes for each function:
- Sum up local variable sizes
- Sum up parameter sizes
- Consider alignment if needed

**Complexity**: Low
**Dependencies**: Phase 2

### Phase 4: Frame Coalescer

Group functions for memory sharing:
- Build non-overlap relationships
- Create coalesce groups
- Calculate group sizes (max of members)
- Respect thread boundaries

**Complexity**: Medium-High
**Dependencies**: Phase 2, Phase 3

### Phase 5: Address Assignment

Assign actual memory addresses:
- Assign frame region addresses to coalesce groups
- Assign ZP addresses (based on scoring)
- Assign RAM addresses to module globals

**Complexity**: Medium
**Dependencies**: Phase 4

### Phase 6: IL Generator Integration

Modify IL generator to use frame addresses:
- Resolve variable references to absolute addresses
- Generate IL with addresses (not names)

**Complexity**: Medium
**Dependencies**: Phase 5

### Phase 7: Code Generator Integration

Modify code generator:
- Use ZP addressing modes for ZP variables
- Use absolute addressing for RAM variables
- Emit frame labels in BSS section

**Complexity**: Medium
**Dependencies**: Phase 6

### Phase 8: Testing & Validation

Comprehensive testing:
- Unit tests for each component
- Integration tests for full pipeline
- Performance benchmarks
- Memory usage validation

**Complexity**: High (thoroughness)
**Dependencies**: All phases

---

## 11. Final Decisions

All implementation decisions have been made and approved.

| # | Decision | Choice | Impact |
|---|----------|--------|--------|
| 1 | **Recursion Handling** | ✅ **Strict** | Recursion = compile error. No `recursive fn` keyword. |
| 2 | **ZP Scoring** | ✅ **Smart** | Compiler auto-promotes hot variables to ZP based on scoring. |
| 3 | **Frame Region Size** | ✅ **Configurable** | Developer can customize region in platform config. |
| 4 | **Coalescing** | ✅ **Aggressive** | Maximize memory savings with deeper call graph analysis. |
| 5 | **ISR Handling** | ✅ **Use `callback`** | Existing `callback` keyword marks interrupt handlers. |

---

## Summary

**SFA is an internal compiler optimization that**:
- Eliminates function call overhead (50-80 cycles per call)
- Provides predictable memory layout
- Enables memory sharing through aggressive coalescing
- Keeps the language syntax unchanged

**All decisions are finalized**:
1. ✅ Recursion: Strict compile error
2. ✅ ZP: Smart automatic allocation
3. ✅ Frame region: Configurable
4. ✅ Coalescing: Aggressive
5. ✅ ISR: Use existing `callback` keyword

**Implementation Estimate**:
- 8 phases
- Medium complexity
- Builds on existing semantic analyzer infrastructure

---

## Next Steps

1. ✅ ~~Review this document~~
2. ✅ ~~Make decisions on the open questions~~
3. ✅ ~~Approve implementation approach~~
4. **Begin Phase 1 implementation**

---

*This document summarizes the SFA research from CC65, KickC, Oscar64, and Prog8. Full research available in `plans/sfa_research/`.*