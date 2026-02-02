# CC65 Stack Model Analysis

> **Document**: 01-stack-model.md
> **Compiler**: CC65 (C Compiler for 6502)
> **Source Files Analyzed**: `stackptr.c/h`, `codegen.c/h`, `expr.c`
> **Date**: 2025-01-31

## Executive Summary

CC65 uses a **software stack** separate from the 6502 hardware stack. The software stack pointer (`c_sp`) is stored in **zero page** for fast indirect indexed access. The compiler tracks stack position at **compile time** via a simple integer variable, enabling efficient stack frame calculations without runtime overhead.

## Architecture Overview

### Dual-Stack Design

| Stack | Location | Purpose | Pointer |
|-------|----------|---------|---------|
| **Hardware Stack** | $0100-$01FF | JSR/RTS return addresses, PHP/PHA | S register (8-bit) |
| **Software Stack** | Configurable RAM | C local variables, parameters, expressions | `c_sp` (16-bit in ZP) |

### Why a Software Stack?

The 6502 hardware stack has severe limitations for C compilation:
1. **Only 256 bytes** at fixed address $0100-$01FF
2. **No indexed access** - only push/pull via S register
3. **No base pointer** - cannot address locals by offset

CC65's software stack solves these:
- **Unlimited size** (constrained only by available RAM)
- **Indirect indexed access** via `(c_sp),y` addressing mode
- **16-bit pointer** allows addressing entire 64KB

## Zero Page Usage

CC65 imports these zero page locations:

```asm
.importzp c_sp, sreg, regsave, regbank
```

| Location | Size | Purpose |
|----------|------|---------|
| `c_sp` | 2 bytes | Software stack pointer |
| `sreg` | 2 bytes | Secondary register (32-bit ops) |
| `regsave` | 2 bytes | Temporary register save area |
| `regbank` | variable | Register variables storage |

## Compile-Time Stack Tracking

### The StackPtr Variable

```c
// stackptr.h
extern int StackPtr;  // Compiler-relative stack pointer

// stackptr.c
int StackPtr = 0;     // Initialized to 0 at function entry

void SP_Push(const Type* T) {
    StackPtr -= SizeOf(T);  // Decrement (stack grows down)
}

void SP_Pop(const Type* T) {
    StackPtr += SizeOf(T);  // Increment (release space)
}
```

**Key Insight**: `StackPtr` is **compile-time only** - it doesn't generate code, just tracks where the compiler believes the stack is relative to function entry.

### Consistency Checking

CC65 validates stack consistency after expression evaluation:

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

This catches bugs where expression parsing corrupts stack tracking.

## Code Generation Patterns

### Stack Allocation (g_space)

**Purpose**: Reserve space on the software stack for locals

```c
void g_space(int Space) {
    if (Space < 0) {
        g_drop(-Space);
    } else if (Space > 255) {
        // Inline 16-bit subtraction
        AddCodeLine("pha");
        AddCodeLine("lda c_sp");
        AddCodeLine("sec");
        AddCodeLine("sbc #$%02X", (unsigned char)Space);
        AddCodeLine("sta c_sp");
        AddCodeLine("lda c_sp+1");
        AddCodeLine("sbc #$%02X", (unsigned char)(Space >> 8));
        AddCodeLine("sta c_sp+1");
        AddCodeLine("pla");
    } else if (Space > 8) {
        AddCodeLine("ldy #$%02X", Space);
        AddCodeLine("jsr subysp");
    } else if (Space != 0) {
        AddCodeLine("jsr decsp%u", Space);  // decsp1, decsp2, etc.
    }
}
```

**Generated Assembly Examples**:

| Allocation Size | Generated Code |
|----------------|----------------|
| 1-8 bytes | `jsr decsp1` ... `jsr decsp8` |
| 9-255 bytes | `ldy #$XX; jsr subysp` |
| 256+ bytes | Inline 16-bit subtract |

### Stack Deallocation (g_drop)

```c
void g_drop(unsigned Space) {
    if (Space > 255) {
        // Inline 16-bit addition
        AddCodeLine("pha");
        AddCodeLine("lda #$%02X", (unsigned char)Space);
        AddCodeLine("clc");
        AddCodeLine("adc c_sp");
        AddCodeLine("sta c_sp");
        AddCodeLine("lda #$%02X", (unsigned char)(Space >> 8));
        AddCodeLine("adc c_sp+1");
        AddCodeLine("sta c_sp+1");
        AddCodeLine("pla");
    } else if (Space > 8) {
        AddCodeLine("ldy #$%02X", Space);
        AddCodeLine("jsr addysp");
    } else if (Space != 0) {
        AddCodeLine("jsr incsp%u", Space);  // incsp1, incsp2, etc.
    }
}
```

### Push Operations (g_push)

```c
void g_push(unsigned flags, unsigned long val) {
    if (flags & CF_CONST && (flags & CF_TYPEMASK) != CF_LONG) {
        if ((flags & CF_TYPEMASK) == CF_CHAR && (flags & CF_FORCECHAR)) {
            AddCodeLine("lda #$%02X", (unsigned char)val);
            AddCodeLine("jsr pusha");          // Push A (1 byte)
        } else {
            g_getimmed(flags, val, 0);
            AddCodeLine("jsr pushax");         // Push AX (2 bytes)
        }
    } else {
        switch (flags & CF_TYPEMASK) {
            case CF_CHAR:
                AddCodeLine("jsr pusha");      // 1 byte
                break;
            case CF_INT:
                AddCodeLine("jsr pushax");     // 2 bytes
                break;
            case CF_LONG:
                AddCodeLine("jsr pusheax");    // 4 bytes
                break;
        }
    }
}
```

### Local Variable Access

**Reading a local variable (g_getlocal)**:

```asm
; For offset in Y register range (0-255)
ldy #<offset>
lda (c_sp),y       ; Load low byte

; For 16-bit value
ldy #<offset>
lda (c_sp),y       ; Low byte
iny
ora (c_sp),y       ; High byte (or use ldx)

; For larger offsets or complex access
jsr ldaxysp        ; Loads A/X from (c_sp)+Y
```

**Writing a local variable (g_putlocal)**:

```asm
; For offset in Y register range
ldy #<offset>
sta (c_sp),y       ; Store low byte

; For 16-bit value
ldy #<offset>
sta (c_sp),y       ; Low byte
iny
txa
sta (c_sp),y       ; High byte
```

## Function Prologue/Epilogue

### Function Entry (g_enter)

```c
void g_enter(unsigned flags, unsigned argsize) {
    if ((flags & CF_FIXARGC) != 0) {
        // Fixed argument count - just remember size
        funcargs = argsize;
    } else {
        // Variadic function - runtime setup
        funcargs = -1;
        AddCodeLine("jsr enter");
    }
}
```

**Note**: CC65's prologue is minimal! No frame pointer setup - locals are accessed relative to `c_sp`.

### Function Exit (g_leave)

```c
void g_leave(int DoCleanup) {
    if (DoCleanup) {
        unsigned ToDrop = (unsigned)-StackPtr;
        // Drop locals and return
        // Optimized based on funcargs value
    }
}
```

## Parameter Frame Pre-allocation

For multi-parameter calls, CC65 can pre-allocate the entire frame:

```c
// From expr.c FunctionArgList()
if (FrameParams > 1) {
    FrameOffs = StackPtr;
    g_space(FrameSize);        // Allocate frame
    StackPtr -= FrameSize;     // Track at compile time
}

// Later, store arguments directly:
g_putlocal(Flags, FrameOffs, Expr.IVal);
```

This avoids multiple push operations for each parameter.

## Stack Frame Layout

```
Higher addresses
+------------------+
| Previous frame   |
+------------------+
| Return address   | <- In hardware stack, not software stack!
+------------------+
| Parameter N      | <- c_sp + (N-1) * size
| ...              |
| Parameter 1      | <- c_sp + 0 (after prologue)
+------------------+
| Local var 1      | <- c_sp - size_of_local1
| Local var 2      | <- c_sp - size_of_locals_1_and_2
| ...              |
+------------------+
| Expression temps | <- Grow downward during evaluation
+------------------+
                     <- c_sp points here during execution
Lower addresses
```

## Key Differences from Modern Architectures

| Aspect | Modern (x86/ARM) | CC65/6502 |
|--------|------------------|-----------|
| Frame Pointer | Yes (BP/FP register) | No - uses SP-relative |
| Stack Location | Hardware defined | Configurable RAM |
| Stack Direction | Grows down | Grows down |
| Local Access | [bp-offset] | (c_sp),y |
| Max Offset | Large (32-bit) | 255 bytes (Y register) |

## Implications for Blend Compiler

### Learnings to Apply

1. **Zero page stack pointer** - Essential for efficient indirect indexed access
2. **Compile-time tracking** - `StackPtr` integer is elegant and efficient
3. **Consistency checking** - Validate stack balance after expressions
4. **Runtime library functions** - `pusha`, `pushax`, `decsp1-8`, etc.
5. **Pre-allocated frames** - Optimize multi-parameter calls

### Considerations for Blend

1. **Static allocation option** - Blend could eliminate runtime stack entirely for non-recursive code
2. **Zero page priority** - Must balance c_sp needs vs. user `@zp` variables
3. **Optimization opportunities** - Blend's static analysis could inline/eliminate many stack ops

## Summary

CC65's software stack is a well-engineered solution for C compilation on 6502. Key insights:

| Feature | Description |
|---------|-------------|
| **Dual stacks** | Hardware for returns, software for C data |
| **ZP pointer** | `c_sp` in zero page enables `(c_sp),y` access |
| **Compile-time** | `StackPtr` tracks position without runtime cost |
| **Runtime library** | Optimized routines for common sizes |
| **No frame pointer** | Everything SP-relative (simpler, faster) |

This model works well for runtime stack semantics but has overhead Blend could potentially eliminate through static frame allocation.

---

**Next**: [02-locals-handling.md](02-locals-handling.md) - How CC65 allocates and accesses local variables