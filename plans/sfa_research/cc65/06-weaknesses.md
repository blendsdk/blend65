# CC65 Weaknesses Analysis

> **Document**: 06-weaknesses.md
> **Compiler**: CC65 (C Compiler for 6502)
> **Date**: 2025-01-31

## Executive Summary

CC65 has fundamental limitations due to its commitment to **full C compatibility** and **runtime stack semantics**. Blend, by rejecting recursion and mandating static allocation, can avoid most of these weaknesses entirely.

## Major Weaknesses

### 1. Runtime Stack Overhead

**The Problem:**
Every function call involves runtime stack manipulation:

```asm
; Function entry - allocate locals
jsr     decsp4          ; ~20 cycles

; Variable access - indirect addressing
ldy     #2
lda     (c_sp),y        ; 5-6 cycles

; Function exit - deallocate
jsr     incsp6          ; ~20 cycles
```

**Cycle Cost Analysis:**

| Operation | Cycles | Per-call impact |
|-----------|--------|-----------------|
| JSR (call) | 6 | Baseline |
| decspN | 17-22 | +20 |
| incspN | 17-22 | +20 |
| Each var access | 7-8 | +8 per access |

**A typical function with 3 locals and 5 accesses:**
- Stack setup: 20 cycles
- Stack teardown: 20 cycles
- 5 variable accesses: 40 cycles
- **Total overhead: ~80 cycles per call**

**Blend's Solution:**
- No stack allocation/deallocation
- Direct addressing instead of indirect
- **Total overhead: 0 cycles**

### 2. Indirect Addressing Performance

**The Problem:**
```asm
; CC65 local variable access
ldy     #offset
lda     (c_sp),y    ; 5-6 cycles (indirect indexed)

; vs. static variable access
lda     label       ; 3-4 cycles (absolute)
```

**Cycle Cost Comparison:**

| Access Type | Cycles | Notes |
|------------|--------|-------|
| ZP Direct | 3 | `lda $xx` |
| Absolute | 4 | `lda $xxxx` |
| Indirect Indexed | 5-6 | `lda ($xx),y` |

**The Y Register Tax:**
- Every local access needs Y register for offset
- Requires `ldy #offset` (2 cycles) before access
- Y register cannot be used for other purposes during access

**Blend's Solution:**
- All locals in static memory
- Direct absolute addressing everywhere
- Y register free for other uses

### 3. 255-Byte Stack Frame Limit

**The Problem:**
```c
void CheckLocalOffs (int Offs) {
    if (Offs < 0 || Offs > 255) {
        Internal ("Local offset out of range: %d", Offs);
    }
}
```

The `(zp),y` addressing mode only supports Y = 0-255, limiting stack frames to 256 bytes.

**Workarounds (All Costly):**
1. Split into multiple frames
2. Use heap allocation
3. Compiler magic to adjust c_sp mid-function

**Blend's Solution:**
- No stack frame limits
- Static BSS can be any size
- Variables at any address

### 4. No Memory Reuse Across Non-Overlapping Calls

**The Problem:**
```c
void funcA() {
    char buffer1[100];  // Uses 100 bytes
}

void funcB() {
    char buffer2[100];  // Uses ANOTHER 100 bytes
}

void main() {
    funcA();  // buffer1 active
    funcB();  // buffer2 active, buffer1 NOT reused
}
```

With `--static-locals`, CC65 gives each function its own static space. If funcA and funcB are never active simultaneously, this wastes memory.

**Blend's Solution:**
- Call graph analysis
- Identify non-overlapping function sets
- Reuse same memory for functions that can't be active together

### 5. Software Stack Pointer Maintenance

**The Problem:**
`c_sp` must be maintained at runtime, adding overhead:

```asm
; Every allocation
lda     c_sp
sec
sbc     #size
sta     c_sp
bcc     @overflow
@no_overflow:
; ... and similar for c_sp+1 if crossing page

; Every deallocation
lda     c_sp
clc
adc     #size
sta     c_sp
; ... etc
```

This is 10-20 instructions just for pointer maintenance per function.

**Blend's Solution:**
- No software stack pointer
- No maintenance code
- Variables at fixed addresses

### 6. Register Variable Limitations

**The Problem:**
```c
int F_AllocRegVar (Function* F, const Type* Type) {
    // Only at function top level!
    if (GetLexicalLevel () == LEX_LEVEL_FUNCTION) {
        // Only if space available in regbank (typically 6 bytes)
        if (F->RegOffs >= Size) {
            // ...
        }
    }
    return -1;  // No space or wrong scope
}
```

**Limitations:**
1. Only ~6 bytes of ZP regbank
2. Only at function top level (not in blocks)
3. Manual `register` keyword required
4. No automatic promotion of hot variables
5. Must save/restore on every call

**Blend's Solution:**
- More aggressive ZP allocation
- Automatic hot variable detection
- Call graph aware ZP sharing
- `@zp` override for manual control

### 7. Recursion Support Wastes Complexity

**The Problem:**
CC65 must support recursion because C requires it. This means:
- Runtime stack is mandatory
- Every variable must have dynamic lifetime
- Cannot make optimization assumptions
- `--static-locals` can't be default

**Blend's Solution:**
- **Reject recursion at compile time**
- Enables SFA as default
- Simpler, faster generated code
- User must use explicit iteration

### 8. No Liveness-Based Optimization

**The Problem:**
CC65 does not reclaim variable space when variables go out of scope within a function:

```c
void example() {
    int a;              // Offset 0
    {
        int b;          // Offset 2
    }
    // b is dead, but its space is NOT reclaimed
    {
        int c;          // Offset 4 (should be 2!)
    }
}
```

**Blend's Solution:**
- Liveness analysis
- Variable coalescing for non-overlapping lifetimes
- Reuse memory within function

### 9. Page Boundary Checks

**The Problem:**
Every push operation must check for page boundary crossing:

```asm
.proc   pusha
        ldy     c_sp
        beq     @L1         ; Check if crossing page!
        dec     c_sp
        ; ...
@L1:    dec     c_sp+1      ; Extra code for page crossing
        dec     c_sp
        ; ...
.endproc
```

This adds branches and extra code to every push.

**Blend's Solution:**
- No pushes, no page boundary concerns
- Variables at fixed addresses

### 10. Variadic Function Overhead

**The Problem:**
Variadic functions require special handling:

```c
void g_enter (unsigned flags, unsigned argsize) {
    if ((flags & CF_FIXARGC) != 0) {
        funcargs = argsize;
    } else {
        funcargs = -1;
        AddCodeLine ("jsr enter");  // Extra call!
    }
}
```

**Blend's Solution:**
- No variadic functions (use arrays/structs instead)
- Simpler calling convention

## Cycle Cost Summary: CC65 vs Blend

| Operation | CC65 (cycles) | Blend SFA (cycles) | Savings |
|-----------|---------------|-------------------|---------|
| Function entry | 20-40 | 0 | 100% |
| Function exit | 20-40 | 0 | 100% |
| Read byte | 7-8 | 3-4 | ~50% |
| Read word | 15-20 | 6-8 | ~60% |
| Write byte | 8-10 | 4 | ~50% |
| Write word | 20-25 | 8 | ~65% |
| **Typical call** | **100-150** | **12-20** | **85-90%** |

## Memory Usage: CC65 vs Blend

| Scenario | CC65 Static | Blend SFA |
|----------|-------------|-----------|
| Function A (50 bytes) | 50 bytes | 50 bytes |
| Function B (50 bytes) | 50 bytes | **Shared if non-overlapping** |
| A calls B | 100 bytes | 100 bytes |
| Main calls A then B | 100 bytes | **50 bytes** |

## Summary: What Blend Improves

| Weakness | CC65 Impact | Blend Solution |
|----------|-------------|----------------|
| Runtime stack | ~80 cycles/call | Eliminated |
| Indirect addressing | +3 cycles/access | Direct addressing |
| 255-byte limit | Frame size cap | No limit |
| No memory reuse | Wasted RAM | Call graph reuse |
| SP maintenance | 10-20 instructions | None |
| ZP limitations | 6 bytes max | Flexible allocation |
| Recursion support | Required complexity | Rejected |
| No liveness opt | Wasted RAM | Coalescing |
| Page boundary | Branches everywhere | Eliminated |
| Variadic | Extra entry call | Not supported |

## Key Takeaways

1. **Runtime stack is the root cause** of most weaknesses
2. **Rejecting recursion** enables massive simplifications
3. **Static allocation** is strictly superior when allowed
4. **Call graph analysis** enables memory reuse CC65 can't do
5. **Blend should be 85-90% faster** for function-heavy code

---

**Next**: [00-overview.md](00-overview.md) - Complete CC65 analysis overview