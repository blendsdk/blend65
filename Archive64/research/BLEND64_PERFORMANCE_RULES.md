# Blend64 Performance Rules (Maximum FPS Profile)

Version: v0.1 Status: Mandatory for game builds unless explicitly overridden

---

## Purpose

This document defines **non-negotiable performance-oriented rules** for Blend64 when targeting **maximum frame rate on
Commodore 64 hardware**.

These rules refine and constrain compiler behavior to ensure that Blend64 code compiles to **cycle-efficient 6502
machine code** comparable to hand-optimized assembly.

Size efficiency is secondary to speed unless explicitly stated otherwise.

---

## Core Performance Principle

> **Blend64 MUST prefer fewer CPU cycles over smaller PRG size whenever a trade-off exists, unless explicitly opted
> out.**

This applies to:

-   lowering
-   inlining
-   helper selection
-   control-flow generation
-   memory placement

---

## 1. Zero-Page Is a First-Class Performance Resource

### Rules

-   The compiler MUST maintain a dedicated **Zero-Page Performance Budget** reserved exclusively for:

    -   hot variables
    -   frequently accessed pointers
    -   parameter passing
    -   scratch temporaries

-   The compiler MUST auto-promote variables to zero-page when:

    -   they are accessed inside loops, OR
    -   they participate in pointer arithmetic, OR
    -   they are used in rendering, input, or IRQ paths

-   Zero-page exhaustion is a **compile-time decision**, not dynamic. When exhausted, the compiler must:
    1. keep existing ZP allocations stable
    2. spill colder variables to absolute memory

### Developer Controls

-   `zp var name: type` pins a variable to zero-page
-   Pinned variables may not be spilled
-   The compiler MUST emit a ZP allocation map

---

## 2. Inlining Is the Default for Hot Code

### Rules

-   The compiler MUST inline functions when ALL are true:

    -   the function is a leaf
    -   the function body is small
    -   the function is called from inside a loop or IRQ

-   Function calls inside the main game loop are assumed **hot** by default

-   Inlining MUST be favored even if it increases code size

### Explicit Controls

-   `@inline` — force inlining
-   `@noinline` — forbid inlining
-   `@hot` — bias all heuristics toward speed

Inlining decisions are resolved during the magic phase.

---

## 3. Control Flow Lowering Must Favor Fast Paths

### `match` / `switch`

-   Dense cases MUST lower to jump tables
-   Sparse cases MUST lower to ordered compare chains
-   Case ordering MUST preserve source order (developer controls branch prediction)

### Boolean Expressions

-   Booleans used only for branching MUST NOT materialize into memory
-   Short-circuit logic MUST compile to conditional branches directly

---

## 4. Arithmetic Lowering Rules (Speed-First)

### Constant Arithmetic

The compiler MUST:

-   fold constants aggressively
-   replace:
    -   multiply/divide by powers of two → shifts
    -   constant address math → precomputed offsets

### Expensive Operations

-   Generic helpers (mul/div/mod) are allowed
-   BUT:
    -   if operands are compile-time constants
    -   OR fixed-point patterns are detected
    -   THEN the compiler MUST emit a specialized fast sequence

---

## 5. Static Temporaries and Re-Entrancy Safety

Because Blend64 forbids locals:

-   All temporaries are static
-   This is a performance advantage and MUST be preserved

### Rules

-   The compiler MUST classify temporaries into:

    -   mainline context
    -   IRQ context

-   An IRQ-marked function MAY NOT access mainline temporaries
-   Violations are compile-time errors

This guarantees:

-   zero stack traffic
-   no defensive save/restore
-   deterministic execution cost

---

## 6. Calling Convention Is Optimized for 6502

### Rules

-   Byte parameters SHOULD be passed in A
-   Word parameters SHOULD be passed in A/X or A/Y
-   Return values follow the same rule

-   Scratch registers and ZP locations MAY be clobbered if whole-program analysis proves it safe

Saving/restoring registers is avoided whenever provably unnecessary.

---

## 7. Array and Bounds Semantics (Release Mode)

-   Bounds checks are FORBIDDEN in performance builds
-   Out-of-bounds behavior is undefined in release builds
-   Debug builds may enable checks via compiler flags

---

## 8. Hotness Model (Implicit)

Without profiling, the compiler MUST assume:

Hot code includes:

-   code inside the main loop
-   code inside IRQ handlers
-   code inside rendering or input modules
-   code called from any of the above

Cold code includes:

-   initialization
-   menu logic
-   debug output

This model guides:

-   inlining
-   ZP promotion
-   helper selection

---

## 9. Emitted Artifacts (Required)

For performance builds, the compiler MUST emit:

-   `.map` — memory layout + zero-page usage
-   `.lst` — annotated assembly listing
-   helper usage report

This enables manual inspection and tuning without writing assembly.

---

## Final Guarantee

A conforming Blend64 compiler following these rules MUST be capable of producing:

-   tight inner loops
-   predictable cycle counts
-   zero unnecessary memory traffic
-   performance comparable to expert-written 6502 assembly

Anything slower is considered a compiler bug, not a language limitation.

---

End of document.
