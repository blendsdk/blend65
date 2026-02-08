# KickC Strengths: Patterns Blend Should Adopt

> **Document**: 05-strengths.md
> **Parent**: [KickC Overview](00-overview.md)
> **Created**: 2025-01-31
> **Status**: Complete

## Overview

This document identifies the key strengths of KickC's static frame allocation system that Blend should adopt or learn from.

---

## 1. Static Allocation by Default (PHI_CALL)

**What KickC Does:**
- Default calling convention is PHI_CALL (no runtime stack)
- Variables are statically allocated at compile time
- Zero function entry/exit overhead

**Why It's Good:**
- Eliminates 20-80 cycles per function call
- No stack overflow risk
- Predictable memory layout
- Faster code by default

**Blend Should:**
- Make static allocation the default (already planned ✅)
- Follow this proven approach

---

## 2. Call-Graph-Based Memory Coalescing

**What KickC Does:**
```java
// If functions never call each other, their locals can share memory
for(ScopeRef ecScope : getEquivalenceClassScopes(thisEC)) {
    allCallingScopes.addAll(callGraph.getRecursiveCallerProcs(ecScope));
}
if(!isProcedureOverlap(otherEC, allCallingScopes)) {
    // CAN COALESCE!
}
```

**Why It's Good:**
- Massive RAM savings (50%+ typical)
- Variables in unrelated functions share memory
- No runtime cost
- Works automatically

**Blend MUST:**
- Implement call-graph-based frame reuse
- This is the key to RAM efficiency on 6502

---

## 3. Clean Recursion Detection

**What KickC Does:**
```java
Collection<ScopeRef> recursiveCalls = callGraph.getRecursiveCalls(procedure.getRef());
if(recursiveCalls.contains(procedure.getRef())) {
    throw new CompileError("ERROR! Recursion not allowed!");
}
```

**Why It's Good:**
- Simple DFS-based algorithm
- Catches direct and indirect recursion
- Clear error message
- Runs after inlining (catches all cases)

**Blend Should:**
- Use same DFS closure algorithm
- Provide clear error messages showing call chain
- Check after inlining

---

## 4. Thread-Safe Coalescing (Interrupt Awareness)

**What KickC Does:**
```java
private static boolean canCoalesceThreads(ec1, ec2, threadHeads, program) {
    // Variables from different threads CANNOT coalesce
    Collection<ScopeRef> threads1 = getEquivalenceClassThreads(ec1, ...);
    Collection<ScopeRef> threads2 = getEquivalenceClassThreads(ec2, ...);
    return threads1.equals(threads2);
}
```

**Why It's Good:**
- Prevents interrupt corruption
- Automatic safety without user annotation
- Thread heads = main + interrupt handlers
- Critical for C64 IRQ/NMI handlers

**Blend MUST:**
- Implement interrupt-aware coalescing
- Don't coalesce across interrupt boundaries
- Essential for game loops with IRQ music/raster

---

## 5. Optional Recursion Support (STACK_CALL)

**What KickC Does:**
```c
// User can opt-in to recursion when needed
__stackcall int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);  // Allowed!
}
```

**Why It's Good:**
- Static allocation by default (fast)
- Recursion available when truly needed
- User makes explicit choice about overhead
- Flexibility without compromising defaults

**Blend Should Consider:**
- Future `@stackcall` attribute for opt-in recursion
- Clear documentation of performance trade-offs

---

## 6. Weight-Based ZP Priority

**What KickC Does:**
```java
// Sort by usage frequency - most used first
Collections.sort(equivalenceClasses, (o1, o2) -> 
    Double.compare(registerWeights.getTotalWeight(o2), 
                   registerWeights.getTotalWeight(o1)));
```

**Why It's Good:**
- Frequently used variables get ZP (3-4 cycles)
- Less used variables go to RAM (4-6 cycles)
- Automatic optimization
- Loop variables naturally prioritized

**Blend Should:**
- Implement usage-based weighting
- Weight factors: loop depth, access count, pointer status

---

## 7. Reserved ZP Handling

**What KickC Does:**
```java
// Collect all reserved ZP from multiple sources
this.reservedZp.addAll(program.getReservedZps());           // Global
this.reservedZp.addAll(procedure.getReservedZps());         // Per-function
this.reservedZp.addAll(hardcodedVariableAddresses);         // User annotations
```

**Why It's Good:**
- Respects system ZP ($00-$01)
- Respects user reservations
- Respects hardcoded addresses
- No ZP conflicts

**Blend Should:**
- Implement similar multi-source reservation
- Platform-specific defaults (C64, X16, NES)

---

## 8. Graceful ZP Overflow to RAM

**What KickC Does:**
```java
if(zp + sizeBytes > 0x100) {
    // Move to main memory instead
    register = new Registers.RegisterMainMem(...);
    getLog().append("Zero-page exhausted. Moving to main memory " + variable);
}
```

**Why It's Good:**
- Programs don't fail when ZP exhausted
- Automatic degradation to RAM
- User notified with warning
- Can enable coalescing to recover

**Blend Should:**
- Implement ZP overflow to RAM
- Provide warnings with suggestions (`try -Ocoalesce`)
- Show ZP usage statistics

---

## 9. Multiple Coalescing Strategies

**What KickC Does:**
1. **Assignment coalescing** - Variables assigned from each other
2. **Call-graph coalescing** - Non-overlapping call paths
3. **Exhaustive coalescing** - Try all combinations (slow but thorough)

**Why It's Good:**
- Fast by default (strategies 1-2)
- More aggressive when needed (-Ocoalesce)
- User controls compile time vs optimization trade-off

**Blend Should:**
- Implement multiple coalescing levels
- Fast default, aggressive optional
- Let user choose based on program size

---

## 10. Clear Pass Architecture

**What KickC Does:**
```
Pass0 → Parsing
Pass1 → SSA generation, recursion check
Pass2 → Optimizations
Pass3 → Analysis (live ranges)
Pass4 → Allocation, coalescing
Pass5 → ASM optimization
```

**Why It's Good:**
- Clear separation of concerns
- Each pass has specific responsibility
- Easy to understand and maintain
- Debugging is straightforward

**Blend Should:**
- Follow similar clear pass organization
- Separate analysis from allocation
- Clear debugging points

---

## Summary: Adoption Priority

| Strength | Priority | Effort | Impact |
|----------|----------|--------|--------|
| Static allocation default | ✅ Already planned | - | High |
| Call-graph coalescing | 🔴 Critical | High | Very High |
| Recursion detection | 🔴 Critical | Medium | High |
| Interrupt awareness | 🔴 Critical | Medium | High |
| Weight-based ZP | 🟡 Important | Medium | Medium |
| Reserved ZP handling | 🟡 Important | Low | Medium |
| ZP overflow to RAM | 🟢 Nice | Low | Low |
| Multiple coalesce levels | 🟢 Nice | Medium | Low |
| Optional recursion | ⚪ Future | Medium | Low |
| Pass architecture | 🟢 Nice | Low | Medium |

**Must Have:** Static allocation, call-graph coalescing, recursion detection, interrupt awareness
**Should Have:** Weight-based ZP, reserved handling, overflow
**Could Have:** Multiple coalesce levels, clear pass architecture
**Future:** Optional recursion support