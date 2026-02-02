# CC65 Code Generation Patterns for Frame Operations

> **Document**: 04-code-generation.md
> **Compiler**: CC65 (C Compiler for 6502)
> **Source Files Analyzed**: `codegen.c`, `libsrc/runtime/*.s`
> **Date**: 2025-01-31

## Executive Summary

CC65's code generation for stack frame operations is **highly optimized** with specialized routines for common sizes (1-8 bytes) and inline code for larger operations. This document details the exact assembly patterns generated and their cycle costs.

## Code Generation Function Overview

| Function | Purpose | Generated Code |
|----------|---------|----------------|
| `g_space(n)` | Allocate n bytes on stack | `decspN` / `subysp` / inline |
| `g_drop(n)` | Deallocate n bytes | `incspN` / `addysp` / inline |
| `g_enter()` | Function prologue | Minimal (just track argsize) |
| `g_leave()` | Function epilogue | `incspN` + `rts` |
| `g_push()` | Push value to stack | `pusha` / `pushax` / `pusheax` |
| `g_getlocal()` | Read local variable | `lda (c_sp),y` / `ldaxysp` |
| `g_putlocal()` | Write local variable | `sta (c_sp),y` / `staxysp` |
| `g_getstatic()` | Read static variable | `lda label` |
| `g_putstatic()` | Write static variable | `sta label` |

## Stack Allocation Patterns

### Small Allocations (1-8 bytes)

CC65 has dedicated runtime functions for common sizes:

```asm
; 1 byte:  jsr decsp1
; 2 bytes: jsr decsp2
; ...
; 8 bytes: jsr decsp8
```

**Example: `decsp3` Implementation**

```asm
.proc   decsp3
        lda     c_sp
        sec
        sbc     #3
        sta     c_sp
        bcc     @L1
        rts
@L1:    dec     c_sp+1
        rts
.endproc
```

**Cycle Cost**: ~17-22 cycles (including JSR/RTS overhead)

### Medium Allocations (9-255 bytes)

Uses Y register for size:

```asm
ldy     #$XX        ; Size in Y
jsr     subysp      ; Subtract Y from c_sp
```

**Cycle Cost**: ~25-30 cycles

### Large Allocations (256+ bytes)

Inline 16-bit subtraction:

```asm
pha                 ; Save A
lda     c_sp
sec
sbc     #<size>     ; Low byte
sta     c_sp
lda     c_sp+1
sbc     #>size>     ; High byte
sta     c_sp+1
pla                 ; Restore A
```

**Cycle Cost**: ~35 cycles

## Push Operations

### Push Byte (`pusha`)

```asm
.proc   pusha
        ldy     c_sp        ; (3)
        beq     @L1         ; (6) - branch if page boundary
        dec     c_sp        ; (11)
        ldy     #0          ; (13)
        sta     (c_sp),y    ; (19)
        rts                 ; (25)
@L1:    dec     c_sp+1      ; (11)
        dec     c_sp        ; (16)
        sta     (c_sp),y    ; (22)
        rts                 ; (28)
.endproc
```

**Cycle Cost**: 25-28 cycles (plus 6 for JSR)

### Push Word (`pushax`)

```asm
.proc   pushax
        pha                 ; (3) - save low byte
        lda     c_sp        ; (6)
        sec                 ; (8)
        sbc     #2          ; (10)
        sta     c_sp        ; (13)
        bcs     @L1         ; (17)
        dec     c_sp+1      ; (+5)
@L1:    ldy     #1          ; (19)
        txa                 ; (21)
        sta     (c_sp),y    ; (27) - store high byte
        pla                 ; (31)
        dey                 ; (33)
        sta     (c_sp),y    ; (38) - store low byte
        rts                 ; (44)
.endproc
```

**Cycle Cost**: 44-49 cycles (plus 6 for JSR)

## Local Variable Access

### Read Byte

```asm
; g_getlocal(CF_CHAR, offset)
ldy     #offset
lda     (c_sp),y
```

**Cycle Cost**: 2 + 5-6 = 7-8 cycles

### Read Word

```asm
; Option 1: Inline (for CF_TEST)
ldy     #offset+1
lda     (c_sp),y        ; High byte
dey
ora     (c_sp),y        ; Low byte (for test)

; Option 2: JSR call
ldy     #offset
jsr     ldaxysp
```

**ldaxysp Implementation**:
```asm
ldaxysp:
        lda     (c_sp),y    ; get high byte
        tax                 ; save to X
        dey                 ; point to lo byte
        lda     (c_sp),y    ; load low byte
        rts
```

**Cycle Cost**: ~15-20 cycles

### Write Byte

```asm
; g_putlocal(CF_CHAR, offset, val)
lda     #value          ; If constant
ldy     #offset
sta     (c_sp),y
```

**Cycle Cost**: 2 + 2 + 6 = 10 cycles (constant), 2 + 6 = 8 cycles (register)

### Write Word

```asm
; Option 1: Inline
ldy     #offset
sta     (c_sp),y        ; Store low byte
iny
txa
sta     (c_sp),y        ; Store high byte

; Option 2: JSR call
ldy     #offset
jsr     staxysp
```

**Cycle Cost**: ~20-25 cycles

## Static Variable Access (for comparison)

### Read Static Byte

```asm
; g_getstatic(CF_CHAR, label, offset)
lda     label
```

**Cycle Cost**: 3-4 cycles (absolute addressing)

### Read Static Word

```asm
; g_getstatic(CF_INT, label, offset)
lda     label
ldx     label+1
```

**Cycle Cost**: 6-8 cycles

### Write Static Byte

```asm
; g_putstatic(CF_CHAR, label, offset)
sta     label
```

**Cycle Cost**: 4 cycles

### Write Static Word

```asm
; g_putstatic(CF_INT, label, offset)
sta     label
stx     label+1
```

**Cycle Cost**: 8 cycles

## Cycle Cost Comparison: Stack vs Static

| Operation | Stack (cycles) | Static (cycles) | Savings |
|-----------|---------------|-----------------|---------|
| Read byte | 7-8 | 3-4 | 50% |
| Read word | 15-20 | 6-8 | 60% |
| Write byte | 8-10 | 4 | 50% |
| Write word | 20-25 | 8 | 65% |
| Allocate 2 bytes | ~50 (pushax) | 0 | 100% |
| Deallocate | ~20 (incsp) | 0 | 100% |

**Key Insight**: Static allocation saves 50-65% on variable access and 100% on allocation/deallocation.

## Function Prologue/Epilogue

### Standard Function

```asm
; Prologue - g_enter()
; For fixed args: Nothing generated! Just stores argsize
; For variadic: jsr enter

; Function body with stack ops...

; Epilogue - g_leave()
jsr     incspN          ; Drop locals + params
rts
```

### With Register Variables

```asm
; Prologue
jsr     decspN          ; Allocate space for regvar backup
ldy     #regsize-1
@save:  lda     regbank,y
        sta     (c_sp),y
        dey
        bpl     @save

; ... function body ...

; Epilogue
ldy     #regsize-1
@rest:  lda     (c_sp),y
        sta     regbank,y
        dey
        bpl     @rest
jsr     incspN
rts
```

## Frame Pre-allocation Pattern

For functions with multiple parameters, CC65 can pre-allocate the entire frame:

```c
// Compiler emits:
g_space(total_param_size);  // Single allocation

// Then stores each parameter:
g_putlocal(flags, offset1, val1);
g_putlocal(flags, offset2, val2);
// etc.
```

**Benefits**:
- Single `decspN` instead of multiple `pushax`
- More predictable stack layout
- Easier optimization

## Offset Limitation

The 6502 `(zp),y` addressing mode limits offsets to 0-255:

```c
void CheckLocalOffs (int Offs) {
    if (Offs < 0 || Offs > 255) {
        Internal ("Local offset out of range: %d", Offs);
    }
}
```

**Implication**: Stack frames > 256 bytes require more complex access patterns.

## Code Size vs Speed Trade-offs

CC65 uses `CodeSizeFactor` to choose between inline code and subroutine calls:

```c
if (IS_Get (&CodeSizeFactor) < 160) {
    AddCodeLine ("jsr staxysp");     // Smaller
} else {
    // Inline: larger but faster
    AddCodeLine ("sta (c_sp),y");
    AddCodeLine ("iny");
    AddCodeLine ("txa");
    AddCodeLine ("sta (c_sp),y");
}
```

## Implications for Blend SFA

### What to Adopt

1. **Compile-time tracking** - The `StackPtr` integer pattern is elegant
2. **Specialized routines** - Having `decsp1-8` etc. for common sizes
3. **Frame pre-allocation** - Single allocation is better than multiple pushes
4. **Offset checking** - Validate stack offsets at compile time

### What to Avoid/Improve

1. **Runtime stack overhead** - Blend eliminates this with SFA
2. **Indirect addressing** - Static addresses are faster than `(c_sp),y`
3. **JSR/RTS overhead** - Every stack op has 6-cycle call overhead
4. **Page boundary checks** - Every push checks for page crossing

### Blend's Advantage

With Static Frame Allocation:
- No `c_sp` manipulation
- No indirect addressing
- Direct `lda/sta label` instead of `lda/sta (c_sp),y`
- **50-65% faster variable access**
- **100% savings on frame setup/teardown**

## Summary

| Aspect | CC65 Approach | Blend Opportunity |
|--------|--------------|-------------------|
| Variable access | `(c_sp),y` indirect | Direct `label` |
| Allocation | Runtime `decspN` | Compile-time BSS |
| Deallocation | Runtime `incspN` | None needed |
| Prologue | Track argsize | None needed |
| Epilogue | `incspN; rts` | Just `rts` |
| Cycle overhead | ~50-100 per call | Near zero |

---

**Next**: [05-strengths.md](05-strengths.md) - What CC65 does well