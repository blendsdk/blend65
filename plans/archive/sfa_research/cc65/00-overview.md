# CC65 Analysis Overview

> **Document**: 00-overview.md
> **Compiler**: CC65 (C Compiler for 6502)
> **Analysis Date**: 2025-01-31
> **Status**: ✅ Complete

## Executive Summary

CC65 is the **industry-standard C compiler** for 6502 platforms with decades of development and battle-tested code. Our analysis reveals that CC65 already implements **Static Frame Allocation (SFA)** as an option (`--static-locals`), proving the concept is sound. Blend's opportunity is to make SFA the **default behavior** and enhance it with **call graph analysis** for memory reuse.

## Document Index

| Document | Purpose | Key Findings |
|----------|---------|--------------|
| [01-stack-model.md](01-stack-model.md) | Software stack architecture | Dual-stack design, ZP c_sp pointer, compile-time tracking |
| [02-locals-handling.md](02-locals-handling.md) | Local variable allocation | `--static-locals` option = SFA! Three storage classes |
| [03-parameter-passing.md](03-parameter-passing.md) | Calling conventions | Fastcall, ZP register promotion, return values |
| [04-code-generation.md](04-code-generation.md) | Assembly patterns | Cycle costs, specialized routines, size trade-offs |
| [05-strengths.md](05-strengths.md) | What CC65 does well | 10 patterns Blend should adopt |
| [06-weaknesses.md](06-weaknesses.md) | What CC65 does poorly | 10 issues Blend eliminates |

## Key Discovery: `--static-locals`

**The most important finding:**

```c
// From locals.c
if (IS_Get (&StaticLocals) != 0) {
    // Convert ALL auto variables to static!
    Decl->StorageClass = SC_STATIC;
    DataLabel = GetLocalDataLabel();
    AllocStorage(DataLabel, g_usebss, Size);
}
```

CC65 **already implements Static Frame Allocation** as an optional feature. This validates Blend's approach completely. The difference:

| Aspect | CC65 | Blend |
|--------|------|-------|
| Static locals | Option (`--static-locals`) | **Default** |
| Recursion | Supported | **Rejected** |
| Memory reuse | None | **Call graph analysis** |
| ZP allocation | Manual (`register`) | **Automatic + @zp** |

## Architecture Summary

### CC65's Dual-Stack Model

```
6502 Hardware Stack ($0100-$01FF)
├── JSR/RTS return addresses
├── PHP/PHA temporary saves
└── Limited to 256 bytes

CC65 Software Stack (Configurable RAM)
├── c_sp pointer in zero page
├── C local variables
├── Function parameters
└── Expression temporaries
```

### Three Storage Classes

| Class | Location | Access Pattern | Speed |
|-------|----------|----------------|-------|
| `register` | Zero page (regbank) | `lda $xx` | Fastest (3 cycles) |
| `static` | BSS/DATA segment | `lda label` | Fast (4 cycles) |
| `auto` | Software stack | `lda (c_sp),y` | Slowest (7-8 cycles) |

### Calling Convention

| Convention | Parameters | Use Case |
|------------|------------|----------|
| Standard | All on stack | General purpose, variadic |
| Fastcall | Last param in A/X | Performance-critical |

## Cycle Cost Analysis

### Variable Access

| Operation | Stack | Static | ZP | Savings (Stack→Static) |
|-----------|-------|--------|-----|------------------------|
| Read byte | 7-8 | 4 | 3 | 50% |
| Read word | 15-20 | 8 | 6 | 60% |
| Write byte | 8-10 | 4 | 3 | 50% |
| Write word | 20-25 | 8 | 6 | 65% |

### Function Call Overhead

| Component | CC65 Stack | CC65 Static | Blend SFA |
|-----------|-----------|-------------|-----------|
| Entry allocation | 20-30 cycles | 0 | 0 |
| Exit deallocation | 20-30 cycles | 0 | 0 |
| SP maintenance | 10-20 cycles | 0 | 0 |
| **Total overhead** | **50-80 cycles** | **~0 cycles** | **~0 cycles** |

## Strengths to Adopt

| # | Strength | Priority | Notes |
|---|----------|----------|-------|
| 1 | Compile-time stack tracking | HIGH | Zero-cost position tracking |
| 2 | StaticLocals pattern | HIGH | Core of Blend's SFA |
| 3 | Consistency checking | HIGH | Catches bugs early |
| 4 | Minimal prologue | MEDIUM | Blend's is even simpler |
| 5 | Deferred allocation | MEDIUM | Useful for frame sizing |
| 6 | Fastcall convention | HIGH | Register passing wins |
| 7 | Frame pre-allocation | MEDIUM | For static params |
| 8 | ZP register bank | HIGH | Critical for @zp |
| 9 | Specialized routines | LOW | Less relevant with SFA |
| 10 | Size factor tuning | MEDIUM | Good UX feature |

## Weaknesses to Avoid

| # | Weakness | CC65 Impact | Blend Solution |
|---|----------|-------------|----------------|
| 1 | Runtime stack | ~80 cycles/call | Eliminated |
| 2 | Indirect addressing | +3 cycles/access | Direct addressing |
| 3 | 255-byte limit | Frame cap | No limit |
| 4 | No memory reuse | Wasted RAM | Call graph reuse |
| 5 | SP maintenance | 10-20 instructions | None |
| 6 | ZP limitations | 6 bytes max | Flexible allocation |
| 7 | Recursion support | Required complexity | Rejected |
| 8 | No liveness opt | Wasted RAM | Coalescing |
| 9 | Page boundary | Branches everywhere | Eliminated |
| 10 | Variadic | Extra entry call | Not supported |

## Blend Design Implications

### What Blend Should Implement

1. **SFA as Default**
   - All locals → static BSS labels
   - No software stack pointer
   - No runtime allocation/deallocation

2. **Call Graph Analysis**
   - Build call graph at compile time
   - Identify non-overlapping function sets
   - Share memory for functions that can't be active together

3. **Zero Page Strategy**
   - Automatic hot variable promotion
   - Call graph aware ZP sharing
   - `@zp` directive for manual override

4. **Recursion Rejection**
   - Detect recursion at compile time
   - Error with clear message
   - Suggest iteration alternatives

5. **Fastcall by Default**
   - First parameter(s) in registers when possible
   - A/X for return values (like CC65)

### Performance Target

Based on CC65 analysis, Blend should achieve:

| Metric | CC65 Stack | Blend SFA | Improvement |
|--------|-----------|-----------|-------------|
| Function call overhead | 50-80 cycles | ~0 cycles | **100%** |
| Variable access | 7-8 cycles | 3-4 cycles | **~50%** |
| Memory usage | Fixed per function | Shared via call graph | **Variable** |
| Code size | Includes stack ops | No stack ops | **10-20% smaller** |

## Summary

CC65 is an **excellent reference implementation** that:
1. ✅ Proves SFA is viable (`--static-locals`)
2. ✅ Shows best practices for compile-time tracking
3. ✅ Demonstrates ZP importance
4. ✅ Validates fastcall approach

Blend's opportunity:
1. 🚀 Make static allocation the **default**
2. 🚀 Add **call graph analysis** for memory reuse
3. 🚀 **Reject recursion** to enable full optimization
4. 🚀 Implement **automatic ZP promotion**

## Files Analyzed

```
cc65/src/cc65/
├── stackptr.c/h      - Compile-time stack pointer tracking
├── codegen.c/h       - Code generation patterns
├── locals.c/h        - Local variable allocation (StaticLocals!)
├── function.c/h      - Function prologue/epilogue
├── funcdesc.h        - Function descriptor structure
├── symentry.h        - Symbol storage union

cc65/libsrc/runtime/
├── pusha.s           - Push byte routine
├── pushax.s          - Push word routine
├── decsp1-8.s        - Stack allocation routines
├── incsp1-8.s        - Stack deallocation routines
├── ldaxsp.s          - Load from stack routine
```

---

## Next Steps

1. **Phase 2: KickC Analysis** - Study SSA form and recursion detection
2. **Phase 3: Oscar64 Analysis** - Study C++ templates and optimizations
3. **Phase 4: Prog8 Analysis** - Study default static allocation
4. **Phase 5: Synthesis** - Combine best practices from all compilers
5. **Phase 6: God-Level SFA Design** - Create optimal design for Blend
6. **Phase 7: Blend Integration** - Update Frame Allocator plan

---

**Analysis Status: ✅ COMPLETE**

**Key Takeaway:** CC65's `--static-locals` proves SFA is viable. Blend makes it default and adds call graph analysis for the ultimate 6502 compiler optimization.