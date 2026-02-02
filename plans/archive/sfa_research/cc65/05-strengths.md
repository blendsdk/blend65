# CC65 Strengths Analysis

> **Document**: 05-strengths.md
> **Compiler**: CC65 (C Compiler for 6502)
> **Date**: 2025-01-31

## Executive Summary

Despite being designed for full C compatibility with runtime stacks, CC65 demonstrates several **excellent engineering decisions** that Blend should adopt or learn from.

## Major Strengths

### 1. Compile-Time Stack Tracking

**What CC65 Does:**
```c
// stackptr.c
int StackPtr = 0;  // Compile-time only!

void SP_Push(const Type* T) {
    StackPtr -= SizeOf(T);
}

void SP_Pop(const Type* T) {
    StackPtr += SizeOf(T);
}
```

**Why It's Excellent:**
- **Zero runtime cost** for tracking stack position
- Simple integer arithmetic at compile time
- Enables calculation of local variable offsets
- Makes consistency checking trivial

**Blend Application:**
Even with SFA, this pattern is useful for:
- Tracking BSS label offsets during compilation
- Calculating total function frame sizes
- Validating scope nesting

### 2. StaticLocals Option

**What CC65 Does:**
```c
if (IS_Get (&StaticLocals) != 0) {
    // Convert auto → static automatically!
    Decl->StorageClass = SC_STATIC;
    DataLabel = GetLocalDataLabel();
    AllocStorage(DataLabel, g_usebss, Size);
}
```

**Why It's Excellent:**
- **Already implements SFA** as an option
- Proves the concept is sound
- Clean implementation pattern
- Minimal code changes between stack/static

**Blend Application:**
- Make this the **default** behavior, not an option
- Add call graph analysis for memory reuse

### 3. Specialized Size Routines

**What CC65 Does:**
```c
if (Space <= 8) {
    AddCodeLine("jsr decsp%u", Space);  // decsp1, decsp2, ... decsp8
} else if (Space <= 255) {
    AddCodeLine("ldy #$%02X", Space);
    AddCodeLine("jsr subysp");
} else {
    // Inline code for large allocations
}
```

**Why It's Excellent:**
- Optimizes common case (small locals)
- Reduces code size with library routines
- Inline for rare large cases
- Good trade-off between size and speed

**Blend Application:**
- Similar tiered approach for any runtime helpers
- Recognize common allocation sizes

### 4. Expression Stack Consistency Checking

**What CC65 Does:**
```c
void ExprWithCheck(void (*Func)(ExprDesc*), ExprDesc* Expr) {
    int OldSP = StackPtr;
    (*Func)(Expr);
    if (StackPtr != OldSP) {
        Internal("Code generation messed up: StackPtr is %d, should be %d",
                 StackPtr, OldSP);
    }
}
```

**Why It's Excellent:**
- **Catches compiler bugs immediately**
- Simple invariant checking
- Validates expression parsing produces balanced code
- Debug aid during development

**Blend Application:**
- Similar validation for IL generation
- Ensure all expressions leave stack in expected state

### 5. Minimal Function Prologue

**What CC65 Does:**
```c
void g_enter(unsigned flags, unsigned argsize) {
    if ((flags & CF_FIXARGC) != 0) {
        funcargs = argsize;  // Just remember, no code!
    } else {
        funcargs = -1;
        AddCodeLine("jsr enter");  // Only for variadic
    }
}
```

**Why It's Excellent:**
- **No frame pointer setup** (unlike x86)
- Zero overhead for fixed-arg functions
- All access is SP-relative
- Smaller, faster code

**Blend Application:**
- Blend can have even simpler prologue (just `rts` address on hardware stack)

### 6. Deferred Allocation Pattern

**What CC65 Does:**
```c
int F_ReserveLocalSpace(Function* F, unsigned Size) {
    F->Reserved += Size;  // Track, don't allocate
    return StackPtr - F->Reserved;
}

void F_AllocLocalSpace(Function* F) {
    if (F->Reserved > 0) {
        g_space(F->Reserved);  // Allocate all at once
        F->Reserved = 0;
    }
}
```

**Why It's Excellent:**
- **Batch allocation** reduces code size
- Single `g_space()` instead of multiple
- Optimization-friendly pattern
- Works well with initialization

**Blend Application:**
- Can compute total frame size before any allocation
- Single BSS reservation per function

### 7. Fastcall Convention

**What CC65 Does:**
```c
// Last parameter in A/X registers instead of stack
// __fastcall__ attribute on functions
```

**Why It's Excellent:**
- Saves ~50 cycles per call (no pushax needed)
- A/X registers already hold value after expression
- Simple to implement
- Significant performance boost

**Blend Application:**
- Make fastcall the default for small functions
- Pass first param(s) in registers when possible

### 8. Frame Pre-allocation

**What CC65 Does:**
```c
// For function calls with multiple parameters:
if (FrameParams > 1) {
    g_space(FrameSize);  // Allocate once
    // Then store each arg directly
    g_putlocal(...);
    g_putlocal(...);
}
```

**Why It's Excellent:**
- Single allocation vs N pushes
- More predictable code generation
- Enables optimizer to see full picture
- Better register usage

**Blend Application:**
- Pre-compute all parameter areas
- Direct store to static locations

### 9. Zero Page Register Bank

**What CC65 Does:**
```c
// regbank area in zero page for "register" variables
// Fast ZP access instead of stack indirect
```

**Why It's Excellent:**
- **2-3x faster** than stack access
- Direct addressing (`lda regbank+0`) vs indirect (`lda (c_sp),y`)
- Critical for performance-sensitive code
- User can mark hot variables

**Blend Application:**
- Automatic promotion to ZP based on usage analysis
- `@zp` directive for manual override
- Combine with call graph for ZP sharing

### 10. Code Size Factor Tuning

**What CC65 Does:**
```c
// User can control size/speed trade-off
if (IS_Get(&CodeSizeFactor) < 160) {
    AddCodeLine("jsr staxysp");  // Smaller
} else {
    // Inline: larger but faster
}
```

**Why It's Excellent:**
- User control over optimization priority
- Flexible for different constraints
- Not one-size-fits-all
- Good for memory-constrained systems

**Blend Application:**
- Similar optimization level flags
- Let users tune for their target

## Summary: What to Adopt

| Strength | Adoption Priority | Notes |
|----------|------------------|-------|
| Compile-time tracking | HIGH | Essential pattern |
| StaticLocals pattern | HIGH | Core of Blend's SFA |
| Consistency checking | HIGH | Debug aid |
| Minimal prologue | MEDIUM | Blend's is even simpler |
| Deferred allocation | MEDIUM | Useful for frame sizing |
| Fastcall convention | HIGH | Performance win |
| Frame pre-allocation | MEDIUM | For static params |
| ZP register bank | HIGH | Critical for `@zp` |
| Specialized routines | LOW | Less relevant with SFA |
| Size factor tuning | MEDIUM | Good UX feature |

## Key Takeaways

1. **CC65 already has SFA** - Just make it default
2. **Compile-time tracking is elegant** - Zero cost, catches bugs
3. **Minimal runtime is achievable** - Even in a C compiler
4. **ZP is critical** - Must have good ZP allocation strategy
5. **Fastcall matters** - Register passing is significant win

---

**Next**: [06-weaknesses.md](06-weaknesses.md) - What CC65 does poorly (and Blend can improve)