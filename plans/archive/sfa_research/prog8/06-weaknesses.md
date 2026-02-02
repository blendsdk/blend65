# Prog8 SFA Weaknesses

> **Document**: prog8/06-weaknesses.md
> **Parent**: [Phase 4 Execution Plan](../99d-phase4-prog8.md)
> **Status**: Complete

## Overview

Prog8's static-only allocation model has fundamental limitations that may be unacceptable for some use cases. Understanding these weaknesses helps inform Blend65's hybrid approach.

---

## Weakness 1: No Recursion

**Fundamental limitation - static variables cannot support recursion.**

```prog8
sub factorial(ubyte n) -> uword {
    if n <= 1 return 1
    return n * factorial(n-1)  ; FAILS - overwrites n!
}
```

**What happens:**
```
factorial(5)
  n = 5
  calls factorial(4)
    n = 4  ← OVERWRITES n, was 5!
    calls factorial(3)
      n = 3  ← OVERWRITES n, was 4!
      ...
```

**Impact:**
- Can't implement tree traversal
- Can't implement quicksort/mergesort
- Can't implement many standard algorithms
- Must manually convert to iterative

---

## Weakness 2: No Re-entrancy

**Same function can't be called from interrupt.**

```prog8
sub update_score(uword points) {
    score = score + points
}

; In main code
update_score(100)

; If IRQ fires here and calls:
; update_score(10)  ; CORRUPTS main call's state!
```

**Impact:**
- Interrupt handlers must be carefully designed
- Can't share utility functions between main and IRQ
- Increases code duplication

---

## Weakness 3: No Usage-Based ZP Prioritization

**From Prog8 source code:**
```kotlin
// TODO some form of intelligent priorization? 
// most often used variables first? loopcounter vars first? ...?
val sortedList = varsDontCareWithoutAlignment.sortedByDescending { it.scopedNameString }
```

**Current behavior:** Variables sorted **alphabetically**, not by usage frequency.

**Impact:**
- Rarely-used `aardvark` variable gets ZP before heavily-used `zzz_counter`
- Suboptimal code generation
- Programmers must manually annotate with `@zp`

---

## Weakness 4: No Weight-Based Allocation

**Unlike Oscar64, Prog8 doesn't prioritize pointers.**

| Variable Type | Oscar64 Weight | Prog8 Treatment |
|--------------|----------------|-----------------|
| Pointer | 2× weight | Same as other |
| Word | 1× weight | Same as other |
| Byte | 1× weight | Same as other |

**Impact:**
- Pointers (which benefit most from ZP) may not get ZP placement
- Indexed addressing patterns less efficient

---

## Weakness 5: No Liveness Analysis

**Variables are allocated for entire program lifetime.**

```prog8
sub phase1() {
    ubyte temp1, temp2, temp3  ; Live only in phase1
}

sub phase2() {
    ubyte other1, other2       ; Live only in phase2
}
```

**With liveness analysis:** `temp*` and `other*` could share the same memory.

**Without liveness analysis:** All 5 variables get separate storage.

**Impact:**
- More memory used than necessary
- ZP fills up faster
- Larger programs hit memory limits

---

## Weakness 6: No Frame Coalescing

**Unlike KickC, non-overlapping call trees can't share memory.**

```
main
  ├── game_loop
  │     ├── update_player
  │     └── update_enemies
  └── menu_loop
        ├── draw_menu
        └── handle_input
```

**With coalescing:**
- `game_loop` subtree shares frame with `menu_loop` subtree
- They never run simultaneously

**Without coalescing:**
- All functions get separate static variables
- Memory waste

**Impact:**
- Larger programs
- More memory pressure
- ZP exhaustion

---

## Weakness 7: Increased Code Size at Call Sites

**Each call must store all parameters.**

```asm
; Call with 4 parameters (Prog8)
lda  arg1
sta  func.a
lda  arg2
sta  func.b
lda  arg3
sta  func.c
lda  arg4
sta  func.d
jsr  func
; Total: 24 bytes for setup

; Call with stack (CC65)
lda  arg1
pha
lda  arg2
pha
lda  arg3
pha
lda  arg4
pha
jsr  func
; Total: 8 bytes for setup (cleanup in callee)
```

**Impact:**
- Code size increases for multi-parameter functions
- Especially problematic when same function called many times

---

## Weakness 8: No Dynamic Memory

**No malloc/free equivalent.**

```prog8
; Can't do this:
ptr = allocate(100)  ; Get memory at runtime
; use ptr...
free(ptr)            ; Return memory
```

**Impact:**
- Fixed-size data structures only
- Can't implement growing lists/queues
- Must pre-allocate maximum needed

---

## Weakness 9: Limited Floats in ZP

**Float variables never allocated to ZP.**

```kotlin
if(variable.dt.isIntegerOrBool || variable.dt.isPointer) {
    // Try ZP allocation
} else {
    numberOfNonIntegerVariables++  // Floats skip ZP entirely
}
```

**Impact:**
- Float-heavy programs have slower access
- No option to force float to ZP even when beneficial

---

## Weakness 10: Per-Function Memory Overhead

**Each function needs dedicated parameter/local storage.**

```prog8
; 100 functions each with:
; - 2 byte params
; - 4 byte locals
; Total: 100 × 6 = 600 bytes of static storage

; With stack-based:
; Deepest call path determines memory, not total functions
```

**Impact:**
- Large programs with many small functions waste memory
- Library functions especially affected

---

## Weakness 11: Dirty Variable Initialization

**Prog8 actually puts `@dirty` vars in BSS anyway:**

```kotlin
// Dirty vars actually are ALSO put into BSS so they're cleared to 0 
// at program startup, but NOT at each entry of the subroutine.
if(dirty.isNotEmpty()) {
    generate("BSS", dirty)  // Same as clean!
}
```

**Impact:**
- The `@dirty` hint doesn't actually save initialization time
- Just documentation, no optimization

---

## Weakness 12: Platform-Specific ZP Limits

**ZP availability varies by platform.**

| Platform | ZP Available | Notes |
|----------|-------------|-------|
| C64 | ~50 bytes | BASIC/KERNAL use rest |
| C128 | ~40 bytes | More system usage |
| CX16 | ~80 bytes | More available |
| Atari | ~20 bytes | Very limited |

**Impact:**
- Programs that work on CX16 may fail on Atari
- Need platform-specific tuning
- Cross-platform portability issues

---

## Summary: What Blend65 Should Avoid/Fix

| Weakness | Blend65 Solution |
|----------|------------------|
| No recursion | Opt-in stack frames (`recursive fn`) |
| No re-entrancy | ISR-safe attribute, separate stacks |
| No usage prioritization | Add weight-based allocation |
| No liveness analysis | Implement for static mode |
| No frame coalescing | Borrow from KickC |
| Code size at calls | Keep register optimization |
| No dynamic memory | Out of scope (static is fine) |
| No floats in ZP | Allow with explicit annotation |
| Per-function overhead | Coalescing solves this |
| Platform ZP limits | Document, provide tools |

---

## The Key Insight

**Prog8's limitations are acceptable for its target use case (games), but Blend65 serving a broader audience should:**

1. **Default to static** (Prog8's model) for speed
2. **Allow opt-in stack frames** for algorithms needing recursion
3. **Add intelligence** (usage analysis, coalescing) to the static allocator
4. **Maintain simplicity** in the common case

**The goal is "best of both worlds" - Prog8's speed when possible, flexibility when needed.**