# KickC Compiler Analysis: Overview

> **Document**: 00-overview.md
> **Parent**: [Phase 2 Execution Plan](../99b-phase2-kickc.md)
> **Created**: 2025-01-31
> **Status**: In Progress

## Executive Summary

KickC is a modern C compiler for 6502 that uses SSA (Single Static Assignment) form with sophisticated memory coalescing. Unlike CC65's optional `--static-locals`, KickC's static allocation is the **default behavior** via its PHI_CALL calling convention. It also provides a STACK_CALL convention for explicit recursion support.

**Key Insight**: KickC proves that static allocation with call-graph-based memory reuse is practical and effective for 6502 programming.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Overview](00-overview.md) | This document - architecture summary |
| 01 | [Recursion Detection](01-recursion-detection.md) | How KickC detects and prevents recursion |
| 02 | [Call Stack Variables](02-call-stack-vars.md) | STACK_CALL convention handling |
| 03 | [Memory Coalescing](03-memory-coalesce.md) | Live range and call-graph coalescing |
| 04 | [Zero Page Allocation](04-zeropage-allocation.md) | ZP allocation strategy |
| 05 | [Strengths](05-strengths.md) | Patterns Blend should adopt |
| 06 | [Weaknesses](06-weaknesses.md) | Issues Blend can improve |

---

## Compiler Architecture

### Pass Structure

KickC uses a numbered pass system with clear responsibilities:

| Pass | Name | Purpose |
|------|------|---------|
| **Pass0** | Generate Statement Sequence | Parsing, AST to statement sequence |
| **Pass1** | Generate SSA | Type inference, recursion check, SSA form |
| **Pass2** | SSA Optimization | Constant folding, dead code, inlining |
| **Pass3** | Analysis | Phi lifting, live ranges, memory prep |
| **Pass4** | Register Allocation | Coalescing, ZP allocation, code gen |
| **Pass5** | ASM Optimization | Peephole optimization, long branch fix |
| **PassN** | Utility Passes | Calculations (call graph, live ranges) |

### Key SFA-Related Passes

```
Pass1AssertNoRecursion     - Recursion detection (critical!)
Pass1CallStack             - Stack-based calling conversion
Pass1GenerateSingleStaticAssignmentForm - SSA generation
Pass4LiveRangeEquivalenceClassesFinalize - Live range grouping
Pass4MemoryCoalesceAssignment - Assignment-based coalescing
Pass4MemoryCoalesceCallGraph - Call-graph-based coalescing
Pass4MemoryCoalesceExhaustive - Exhaustive ZP coalescing
Pass4AssertZeropageAllocation - ZP overflow detection
PassNCalcCallGraph         - Call graph construction
PassNCalcLiveRangeVariables - Live range calculation
```

---

## Calling Conventions

### PHI_CALL (Default)

The default calling convention for static allocation:

- **No recursion allowed** - Detected and rejected at compile time
- **Variables stored statically** - Each variable gets fixed memory location
- **Memory coalescing** - Variables with non-overlapping live ranges share memory
- **Zero overhead** - No function entry/exit stack manipulation

### STACK_CALL (Optional)

Enabled via `__stackcall` attribute for functions needing recursion:

```c
__stackcall int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
```

- **Recursion allowed** - Uses traditional stack for locals
- **Parameters via stack** - `stackpush(type)=value`
- **Return via stack** - `stackidx(RETURN)=value`
- **Higher overhead** - Stack operations on every call

---

## Memory Coalescing System

### Live Range Equivalence Classes

KickC groups variables into equivalence classes based on:

1. **Phi relationships** - Variables in PHI nodes naturally equivalent
2. **Live range overlap** - Non-overlapping ranges can share memory
3. **Type compatibility** - Same size and type required

### Coalescing Constraints

Before coalescing two equivalence classes, KickC checks:

| Constraint | Description |
|------------|-------------|
| **NotEqual** | Can't coalesce same class with itself |
| **Compatible** | Same type, size, both in memory |
| **Segments** | Must be in same data segment |
| **Volatile** | Volatile vars only coalesce with themselves |
| **Threads** | Must be in same thread (interrupt safety!) |
| **Clobber** | Must not cause ASM generation issues |

### Call-Graph-Based Coalescing

**The key algorithm for memory reuse:**

```
For each equivalence class (thisEC):
  1. Find all recursive callers (procedures active when thisEC is live)
  2. For each already-handled equivalence class (otherEC):
     a. Check if any procedure overlap exists
     b. If NO overlap → CAN COALESCE (never live simultaneously!)
     c. If overlap → Skip (would cause conflict)
  3. Mark thisEC as handled
```

**Example:**
```
If function A never calls B (directly or indirectly)
And B never calls A
Then A's locals and B's locals CAN share the same memory!
```

---

## Zero Page Strategy

### Allocation Flow

1. **Initial allocation** - Variables assigned to ZP by register allocator
2. **Register uplift** - Try to move variables to A/X/Y registers
3. **Coalescing** - Reduce ZP usage via equivalence class merging
4. **Validation** - Assert all ZP allocations fit in $00-$FF

### ZP Overflow Handling

If ZP is exhausted:
- `Pass4AssertZeropageAllocation` throws error
- Suggests using `-Ocoalesce` flag for more aggressive coalescing
- Exhaustive coalescing (`Pass4MemoryCoalesceExhaustive`) enabled

### Reserved ZP

KickC respects reserved ZP locations:
```java
if(program.getReservedZps().contains(zp))
   return false;  // Cannot coalesce with reserved ZP
```

---

## Compiler Options

### Coalescing Options

| Option | Default | Effect |
|--------|---------|--------|
| `-Ocoalesce` | Off | Enable exhaustive ZP coalescing (slow) |
| `-Onocoalesce` | Off | Disable all coalescing (fast compilation) |
| `-Ouplift` | On | Enable register uplift optimization |

### Performance Trade-offs

```java
private boolean enableZeroPageCoalesce = false;  // Expensive but effective
private boolean disableCoalesce = false;          // Fast but less optimal
private boolean disableUplift = false;            // Very suboptimal code
```

---

## Key Data Structures

### CallGraph

```java
public class CallGraph {
    private List<CallBlock> callBlocks;
    
    // Find all procedures called from a scope (recursive closure)
    public Collection<ScopeRef> getRecursiveCalls(ScopeRef scopeRef);
    
    // Find all procedures calling a scope (recursive closure)
    public Collection<ScopeRef> getRecursiveCallerProcs(ScopeRef scopeRef);
    
    // Check if a call is part of recursion
    public boolean isRecursive(CallBlock.Call call);
}
```

### LiveRangeEquivalenceClass

```java
public class LiveRangeEquivalenceClass {
    private List<VariableRef> variables;
    private Registers.Register register;
    private LiveRange liveRange;
    
    // Check for volatile variables
    public boolean hasVolatile(Program program);
    
    // Get combined live range
    public LiveRange getLiveRange();
}
```

---

## Summary: What Makes KickC Relevant

| Feature | KickC Approach | Blend Implication |
|---------|----------------|-------------------|
| **Default allocation** | Static (PHI_CALL) | Confirm static-first is correct |
| **Recursion support** | Optional (STACK_CALL) | Consider future opt-in recursion |
| **Coalescing** | Call-graph-based | Must implement for RAM savings |
| **Thread safety** | Built-in interrupt handling | Important for C64 IRQ handlers |
| **ZP management** | Coalescing + reserved | Need similar reservation system |

---

## Files Analyzed

### Compiler Core
- `Compiler.java` - Pass orchestration (694 lines)

### Pass 1 (SSA Generation)
- `Pass1AssertNoRecursion.java` - Recursion detection
- `Pass1CallStack.java` - Stack calling convention
- `Pass1GenerateSingleStaticAssignmentForm.java` - SSA generation

### Pass 4 (Memory Allocation)
- `Pass4MemoryCoalesce.java` - Base coalescing logic
- `Pass4MemoryCoalesceCallGraph.java` - Call-graph coalescing
- `Pass4MemoryCoalesceAssignment.java` - Assignment coalescing
- `Pass4LiveRangeEquivalenceClassesFinalize.java` - Equivalence classes
- `Pass4AssertZeropageAllocation.java` - ZP validation

### Model
- `CallGraph.java` - Call graph with recursion detection

---

## Next Steps

1. **Session 2.2**: Deep dive into recursion detection algorithm
2. **Session 2.3**: Detailed memory coalescing analysis
3. **Session 2.4**: Zero page allocation strategy
4. Complete strengths and weaknesses documentation