# Prog8 SFA Strengths

> **Document**: prog8/05-strengths.md
> **Parent**: [Phase 4 Execution Plan](../99d-phase4-prog8.md)
> **Status**: Complete

## Overview

Despite its simplicity (or because of it), Prog8's static allocation approach has significant advantages for 6502 game development. These strengths should be considered for Blend65's design.

---

## Strength 1: Zero Call Overhead

**No stack manipulation at all.**

```asm
; Prog8 function call
lda  #5
sta  func.param    ; Direct store to static var
jsr  func          ; Just JSR, nothing else
```

**Compare to stack-based:**
```asm
; Stack-based call (CC65 style)
lda  #5
pha               ; Push to stack
jsr  func
pla               ; Pop/cleanup (or callee does it)
```

**Impact:**
- Saves 2-4 cycles per parameter
- No stack pointer manipulation
- No frame setup/teardown in functions

---

## Strength 2: Predictable Memory Addresses

**Every variable has a known, fixed address.**

```asm
; Debugger can directly inspect
player_x = $1000    ; Always here
player_y = $1001    ; Always here
score    = $1002    ; Always here
```

**Benefits:**
- Hardware breakpoints on specific addresses
- Memory watches in emulators
- No address calculation at runtime
- Direct memory inspection during debugging

---

## Strength 3: Optimal ZP Access

**Variables in ZP use direct addressing (2 bytes).**

```asm
; ZP variable (2-byte instruction)
lda  $02          ; ZP addressing mode

; Non-ZP variable (3-byte instruction)  
lda  $1000        ; Absolute addressing mode
```

**With static allocation:**
- Compiler knows which variables are in ZP
- Can always use optimal addressing mode
- No runtime ZP management overhead

---

## Strength 4: Simple Register Convention

**Clear, simple parameter passing rules.**

| Params | Convention |
|--------|------------|
| 1 byte | A register |
| 1 word | AY registers |
| 2 bytes | A and Y |
| Others | Static variables |

**Benefits:**
- Easy to understand and debug
- Compatible with assembly routines
- No hidden costs or surprises

---

## Strength 5: ZP Wish System (User Control)

**Programmers explicitly control ZP allocation.**

```prog8
@zp ubyte important_var    ; REQUIRE - error if no room
@zp ubyte another_var      ; PREFER - try ZP, fallback OK
@nozp ubyte big_buffer[256] ; NOT_IN_ZP - never ZP
ubyte normal_var           ; DONTCARE - compiler decides
```

**Benefits:**
- Expert users can optimize critical variables
- Beginners can ignore (defaults work)
- Clear compile-time feedback
- No surprises about where variables live

---

## Strength 6: Float Constant Pooling

**Identical float values share storage.**

```kotlin
internal val globalFloatConsts = mutableMapOf<Double, String>()

internal fun getFloatAsmConst(number: Double): String {
    val asmName = globalFloatConsts[number]
    if(asmName != null) return asmName
    
    val newName = "prog8_float_const_${globalFloatConsts.size}"
    globalFloatConsts[number] = newName
    return newName
}
```

**Benefits:**
- Multiple uses of `3.14159` share one 5-byte constant
- Automatic deduplication
- Smaller program size

---

## Strength 7: BSS Section Management

**Intelligent separation of BSS regions.**

| Section | Purpose |
|---------|---------|
| `BSS` | Cleared to 0 at startup |
| `BSS_NOCLEAR` | Not cleared (temp vars) |
| `BSS_SLABS` | Large memory blocks |

**Benefits:**
- Faster startup (don't clear what doesn't need it)
- Clear separation of concerns
- Memory slab support for large buffers

---

## Strength 8: No Stack Overflow Risk

**Stack usage is bounded.**

With static allocation:
- Hardware stack only holds return addresses
- No parameters on stack
- No locals on stack
- Maximum depth is call depth × 2 bytes

**Typical game with 10-deep calls:** 20 bytes of hardware stack.

**Compare to CC65:** Same game might use 100+ bytes of software stack.

---

## Strength 9: Easy Assembly Interop

**Trivial to call assembly routines.**

```prog8
asmsub kernal_chrout(ubyte char @A) {
    %asm {{
        jsr  $FFD2
    }}
}

; Call site
kernal_chrout('X')  ; Just loads A and JSR
```

**Benefits:**
- Register conventions match ROM routines
- No wrapper code needed
- Direct access to Carry flag, etc.

---

## Strength 10: Struct Support

**Native assembler struct definitions.**

```asm
; Generated 64tass struct
PlayerState    .struct
p8v_x  .byte  \f0
p8v_y  .byte  \f1
p8v_hp .byte  \f2
    .endstruct

player .dstruct PlayerState, 100, 50, 3
```

**Benefits:**
- Field access via assembler symbols
- Type-safe struct layout
- Automatic alignment handling

---

## Strength 11: Platform Flexibility

**Golden RAM and High Bank support.**

```kotlin
// Commander X16 high RAM
if(options.varsHighBank != null) {
    relocatedBssStart = compTarget.BSSHIGHRAM_START
    relocatedBssEnd = compTarget.BSSHIGHRAM_END
}
```

**Benefits:**
- Variables can live in bank-switched RAM
- Main RAM stays free for code
- Platform-specific optimizations

---

## Strength 12: Code Simplicity

**The entire VariableAllocator is ~100 lines.**

```kotlin
internal class VariableAllocator(...) {
    private fun allocateZeropageVariables() {
        // ~80 lines of straightforward logic
    }
    
    internal fun isZpVar(scopedName: String): Boolean {
        // 5 lines
    }
    
    internal fun getFloatAsmConst(number: Double): String {
        // 10 lines
    }
}
```

**Benefits:**
- Easy to understand
- Easy to maintain
- Fewer bugs
- Fast compilation

---

## Summary: What Blend65 Should Adopt

| Strength | Adopt for Blend65? |
|----------|-------------------|
| Zero call overhead | ✅ Default for non-recursive |
| Predictable addresses | ✅ For static allocation mode |
| ZP wish system | ✅ User control is valuable |
| Simple register convention | ✅ A/Y/AY is efficient |
| Float constant pooling | ✅ Memory savings |
| BSS sections | ✅ Good organization |
| No stack overflow | ✅ When static mode used |
| Assembly interop | ✅ Essential for 6502 |
| Struct support | ✅ Modern language feature |
| Platform flexibility | ✅ Multi-target support |
| Code simplicity | ✅ Maintainability |

---

## The Key Insight

**Prog8 proves that for 6502 game development:**

> Static allocation with no recursion is not a limitation - it's an **optimization strategy** that trades a rarely-needed feature (recursion) for significant performance and simplicity gains.

Blend65 should offer this as the **default mode**, with opt-in stack allocation for the rare cases where recursion is truly needed.