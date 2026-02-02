# Oscar64 SFA Weaknesses

> **Document**: 06-weaknesses.md
> **Purpose**: SFA Research - Oscar64 Weaknesses Analysis
> **Created**: 2025-01-31
> **Status**: Complete

## Executive Summary

While Oscar64 is a capable compiler, its SFA approach has limitations compared to more advanced techniques like KickC's frame coalescing. Understanding these weaknesses helps inform our God-Level SFA design.

## Key Weaknesses

### 1. No Frame Coalescing

**The Problem:**
Oscar64 allocates unique static storage for each non-recursive function's locals:

```
Function A: locals at $0100-$010F
Function B: locals at $0110-$011F
Function C: locals at $0120-$012F
```

**Why It Matters:**
- Functions that never call each other could share memory
- KickC's coalescing reuses space based on call graph disjointness
- Oscar64 uses more total memory than necessary

**Comparison:**
```
Oscar64 (no coalescing):
  Total: 48 bytes for 3 functions

KickC (with coalescing):
  A never calls B → share memory
  Total: 32 bytes for same 3 functions (16 bytes saved)
```

### 2. Conservative Recursion Handling

**The Problem:**
Any function in a recursive call chain uses stackcall:

```cpp
// If A→B→C→A (cycle), ALL get marked recursive
if (MarkCycle(root, proc))
    proc->mFlags |= DTF_FUNC_RECURSIVE;
```

**Why It Matters:**
- Even rarely-taken recursive paths force stackcall
- Some functions in cycle might only be recursive in edge cases
- No partial stackcall optimization

**Example:**
```c
void rarely_recursive(int n) {
    if (n > 1000)  // Rarely true
        rarely_recursive(n-1);
    // This function ALWAYS uses stackcall
}
```

### 3. Limited ZP Fastcall Region

**The Problem:**
Fastcall parameters limited to small ZP region:

```cpp
BC_REG_FPARAMS = 0x03
BC_REG_FPARAMS_END = 0x0F  // Only 12 bytes!
```

**Why It Matters:**
- Functions with many parameters may overflow
- Overflow forces partial stackcall behavior
- Extended ZP mode helps but still limited

### 4. No Liveness-Based Frame Sizing

**The Problem:**
Frame allocated for all locals, even if not all live simultaneously:

```c
void example() {
    int a = work1();  // a dead after this
    int b = work2();  // b could reuse a's space
    // Oscar64 allocates space for both a AND b
}
```

**Why It Matters:**
- KickC's SSA analysis enables variable lifetime overlap
- Oscar64 conservatively allocates for worst case
- Larger frames than necessary

### 5. No Variable Splitting

**The Problem:**
Variables allocated as whole units:

```c
int pair[2];  // Always 4 contiguous bytes
// Even if only pair[0] used hot, pair[1] used cold
```

**Why It Matters:**
- Can't put hot parts in ZP, cold parts in RAM
- All-or-nothing ZP allocation
- Missed optimization opportunities

### 6. Limited Cross-Procedure Analysis

**The Problem:**
Global analysis focused on recursion/interrupts, not variable flow:

```c
void caller() {
    int x = 5;
    callee(x);  // Could x be kept in register across call?
}
```

**Why It Matters:**
- No interprocedural register allocation
- Call boundaries force spilling
- Missed opportunities for register reuse

### 7. Frame Pointer Overhead for Large Functions

**The Problem:**
Functions >= 256 bytes frame require FP:

```asm
; Frame setup overhead
SEC
LDA SP
SBC #size
STA SP
...
CLC
LDA SP
ADC #(frameSpace+2)
STA FP
...
```

**Why It Matters:**
- ~20+ instruction overhead for entry/exit
- Can't avoid for legitimately large functions
- Trade-off between access speed and setup cost

### 8. Limited Temp Reuse Across Blocks

**The Problem:**
ZP temps allocated per-procedure, not per-basic-block:

```cpp
int mTempSize;  // Total temp space for whole procedure
// Not: "block A needs 4 bytes, block B needs 4 bytes, reuse"
```

**Why It Matters:**
- Non-overlapping basic blocks could share temps
- More ZP usage than necessary
- Opportunity for finer-grained allocation

### 9. All-or-Nothing Local-to-Temp

**The Problem:**
Local promoted to temp entirely or not at all:

```cpp
if (simpleLocals[vi] && !complexLocals[vi])
    // Promote whole variable
```

**Why It Matters:**
- Can't promote part of an array
- Can't promote specific access patterns
- Limited partial optimization

### 10. No Hardware Stack Utilization

**The Problem:**
Hardware stack only used for returns, not locals:

```
Hardware stack ($0100-$01FF): Return addresses only
Software stack: All parameters and locals
```

**Why It Matters:**
- 256-byte hardware stack underutilized
- Some locals could use PHA/PLA efficiently
- Opportunity for hybrid approach missed

### 11. Fixed ZP Layout

**The Problem:**
ZP register layout fixed at compile time:

```cpp
BC_REG_TMP = 0x1D;
BC_REG_TMP_SAVED = 0x3D;
// Can't dynamically adjust based on program needs
```

**Why It Matters:**
- Programs with different characteristics can't optimize ZP differently
- No profile-guided ZP allocation
- Fixed trade-offs

### 12. Interrupt Limitations

**The Problem:**
Strict requirements for interrupt handlers:

```cpp
if (!mNoFrame || commonFrameSize > 0)
    Error("Function too complex for interrupt");
```

**Why It Matters:**
- Can't use complex interrupt handlers
- Limits what can be done in interrupts
- Must call out to non-interrupt functions

## Impact Summary

| Weakness | Memory Impact | Speed Impact | Severity |
|----------|---------------|--------------|----------|
| No coalescing | High | Low | ⚠️ High |
| Conservative recursion | Medium | Medium | ⚠️ Medium |
| Limited fastcall | Low | Medium | 🔵 Low |
| No liveness sizing | Medium | Low | ⚠️ Medium |
| No variable splitting | Low | Low | 🔵 Low |
| Limited cross-proc | Low | Medium | 🔵 Low |
| FP overhead | Low | High (for large) | ⚠️ Medium |
| Limited temp reuse | Low | Low | 🔵 Low |
| All-or-nothing promotion | Low | Low | 🔵 Low |
| No HW stack use | Medium | Medium | ⚠️ Medium |
| Fixed ZP layout | Low | Low | 🔵 Low |
| Interrupt limits | N/A | N/A | ⚠️ Medium |

## Lessons for Blend SFA

1. **Implement frame coalescing** - KickC's biggest advantage
2. **Consider partial recursion analysis** - Not all calls in cycle are equally recursive
3. **Use liveness for sizing** - Only allocate what's actually live
4. **Consider hardware stack** - Hybrid approach may help
5. **Profile-guided ZP** - Let hot paths inform allocation
6. **Finer-grained temp allocation** - Per-block or per-region

## Summary

Oscar64's main weakness is the **lack of frame coalescing**, which results in higher memory usage than necessary. Combined with conservative recursion handling and fixed ZP layouts, there's room for improvement in memory efficiency while maintaining Oscar64's strengths in optimization and correctness.