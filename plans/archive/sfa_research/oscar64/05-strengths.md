# Oscar64 SFA Strengths

> **Document**: 05-strengths.md
> **Purpose**: SFA Research - Oscar64 Strengths Analysis
> **Created**: 2025-01-31
> **Status**: Complete

## Executive Summary

Oscar64's SFA approach combines mature C compiler techniques with 6502-specific optimizations. Its dual calling convention system, weight-based ZP allocation, and sophisticated code optimization make it one of the most capable 6502 C compilers available.

## Key Strengths

### 1. Dual Calling Convention (Fastcall/Stackcall)

**What It Does:**
- Non-recursive functions use fastcall (ZP parameters)
- Recursive/complex functions use stackcall (software stack)

**Why It's Strong:**
```cpp
// Automatic selection based on analysis
if (!recursive && !variadic && params_fit_in_zp)
    mFlags |= DTF_FASTCALL;  // Zero overhead params
else
    mFlags |= DTF_STACKCALL; // Safe for recursion
```

**Benefits:**
- ✅ Zero parameter passing overhead for most functions
- ✅ Full recursion support when needed
- ✅ No programmer intervention required
- ✅ Best of both worlds automatically

### 2. Sophisticated Recursion Detection

**What It Does:**
DFS-based cycle detection marks all functions in recursive call chains:

```cpp
bool GlobalAnalyzer::MarkCycle(Declaration* root, Declaration* proc) {
    if (root == proc) return true;  // Cycle detected!
    
    proc->mFlags |= DTF_FUNC_ANALYZING;
    for (Declaration* called : proc->mCalled) {
        if (MarkCycle(root, called))
            return true;
    }
    proc->mFlags &= ~DTF_FUNC_ANALYZING;
    return false;
}
```

**Why It's Strong:**
- Handles indirect recursion (A→B→C→A)
- Handles mutual recursion
- Propagates through entire call graph
- Conservative but correct

### 3. Weight-Based Zero Page Allocation

**What It Does:**
Prioritizes ZP allocation based on variable importance:

```cpp
static int VarUseCountScale(Declaration* type) {
    if (type->mType == DT_TYPE_POINTER)
        return 0x800;  // Pointers: highest priority
    else if (type->IsIntegerType())
        return 0x100 / type->mSize;  // Smaller ints: higher priority
    return 0;
}

// Score = useCount * weight
// Sort by score, allocate best candidates to ZP
```

**Why It's Strong:**
- ✅ Pointers get ZP (enables indirect Y addressing)
- ✅ Heavily-used variables prioritized
- ✅ Size-aware (byte vars > word vars)
- ✅ Automatic, no programmer hints needed

### 4. Dual Frame Modes

**What It Does:**
Small functions use stack-relative, large ones use frame pointer:

```cpp
if (frameSize < 256)
    mNoFrame = true;   // Fast: SP-relative access
else
    mNoFrame = false;  // Safe: FP-relative access
```

**Why It's Strong:**
- Small functions: No frame setup overhead
- Large functions: Safe access to all locals
- Debug mode: Always uses FP for debugging

### 5. Local-to-Temp Promotion

**What It Does:**
Simple, non-aliased locals can be promoted to ZP temps:

```cpp
if (simpleLocals[vi] && !complexLocals[vi]) {
    mLocalVars[vi]->mTemp = true;
    mLocalVars[vi]->mTempIndex = AddTemporary(type);
    // Now accessed as ZP, not stack
}
```

**Why It's Strong:**
- Eliminates memory operations for simple vars
- Enables register allocation
- Automatic based on alias analysis

### 6. Explicit Aliasing Tracking

**What It Does:**
Tracks which variables have their address taken:

```cpp
if (ins->mCode == IC_LEA && ins->mSrc[1].mMemory == IM_LOCAL) {
    aliasedLocals += ins->mSrc[1].mVarIndex;
}
```

**Why It's Strong:**
- Non-aliased vars can be optimized aggressively
- Store forwarding works through calls
- Dead store elimination is safe
- Enables local-to-temp promotion

### 7. Comprehensive IC Optimization

**What It Does:**
Extensive intermediate code optimization before codegen:

- Constant propagation
- Dead code elimination
- Copy propagation
- Value range analysis
- Load/store forwarding

**Why It's Strong:**
- IC optimization reduces frame requirements
- Unused locals eliminated early
- Constants folded before allocation

### 8. Native Code Peephole Optimization

**What It Does:**
Multi-level peephole passes optimize generated code:

```cpp
PeepHoleOptimizerIterate1()  // Simple patterns
PeepHoleOptimizerIterate2()  // Two-instruction
PeepHoleOptimizerIterate3()  // Three-instruction
// ... up to IterateN
```

**Why It's Strong:**
- Frame access patterns optimized
- Redundant loads eliminated
- ADC/SBC sequences simplified

### 9. Value Forwarding

**What It Does:**
Tracks register contents across instructions:

```cpp
struct NativeRegisterData {
    int mValue;           // Known value
    NativeRegisterDataMode mMode;  // How loaded
    uint8 mMinVal, mMaxVal;  // Value range
};
```

**Why It's Strong:**
- Eliminates redundant reloads
- Tracks frame loads
- Cross-block optimization

### 10. Interrupt Safety Analysis

**What It Does:**
Propagates interrupt-called status through call graph:

```cpp
void GlobalAnalyzer::CheckInterrupt() {
    for (Declaration* f : mFunctions) {
        if (f->mFlags & DTF_FUNC_INTRCALLED) {
            for (Declaration* called : f->mCalled) {
                called->mFlags |= DTF_FUNC_INTRCALLED;
            }
        }
    }
}
```

**Why It's Strong:**
- Functions called from interrupts marked
- Enables interrupt-safe analysis
- Prevents incorrect optimizations

### 11. Debug Information Support

**What It Does:**
Emits frame-relative variable locations:

```cpp
// JSON debug info
{"name": "varname", "start": offset, "end": offset+size, "base": BC_REG_LOCALS}
```

**Why It's Strong:**
- Variables locatable in debugger
- Frame pointer tracked for unwinding
- Source-level debugging possible

### 12. Target-Aware Configuration

**What It Does:**
Different ZP layouts for different targets:

| Target | Stack Size | ZP Range |
|--------|------------|----------|
| C64 | 4096 | $F7-$FF |
| VIC20 | 512 | $F7-$FF |
| NES | 256 | $80-$FF |

**Why It's Strong:**
- Optimized for each platform
- Respects platform ZP constraints
- Configurable via options

## Comparison to Other Compilers

| Feature | Oscar64 | CC65 | KickC |
|---------|---------|------|-------|
| Auto Fastcall | ✅ Yes | ❌ Manual | ✅ Yes |
| Recursion | ✅ Safe | ✅ Always | ❌ Error |
| Weight-Based ZP | ✅ Yes | ❌ Manual | ✅ Yes |
| Frame Coalescing | ❌ No | ❌ No | ✅ Yes |
| Local-to-Temp | ✅ Yes | ❌ No | ✅ Yes |
| Debug Info | ✅ Yes | ✅ Yes | ❌ Limited |

## Summary

Oscar64's strengths lie in its:

1. **Automatic optimization** - No programmer hints needed
2. **Dual conventions** - Best of fastcall and stackcall
3. **Sound analysis** - Safe recursion, correct aliasing
4. **Comprehensive optimization** - IC and native levels
5. **Platform awareness** - Target-specific tuning
6. **Debug support** - Production-ready tooling

These make Oscar64 suitable for serious 6502 development where correctness and performance both matter.