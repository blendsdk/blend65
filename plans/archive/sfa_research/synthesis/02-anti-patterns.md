# SFA Anti-Patterns

> **Document**: synthesis/02-anti-patterns.md
> **Purpose**: Common mistakes and anti-patterns to avoid in SFA implementation
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

This document catalogs anti-patterns discovered in the analyzed compilers. These are implementation approaches that should be **avoided** in Blend65's SFA design.

---

## 1. Allocation Anti-Patterns

### 1.1 Runtime Stack as Default

**Source:** CC65

**Anti-Pattern:**
```asm
; Every function call has this overhead
jsr decsp4     ; Allocate on entry
; ... function body ...
jsr incsp4     ; Deallocate on exit
```

**Problem:**
- 50-80 cycles overhead per function call
- Indirect addressing for all locals (slow)
- Software stack pointer maintenance

**Correct Approach:**
- Static allocation by default
- No runtime allocation/deallocation
- Direct addressing for locals

---

### 1.2 Ignoring Call Graph Disjointness

**Sources:** CC65, Oscar64, Prog8

**Anti-Pattern:**
```
// Each function gets unique storage, even if they never overlap
function_a.locals → $1000-$100F
function_b.locals → $1010-$101F
function_c.locals → $1020-$102F
// Even though a never calls b, and b never calls c
```

**Problem:**
- 30-60% more memory usage than necessary
- ZP exhaustion sooner
- RAM wasted

**Correct Approach (KickC):**
```
// Functions that can't be active together share memory
function_a.locals → $1000-$100F
function_b.locals → $1000-$100F  // SHARED with a (never both active)
function_c.locals → $1010-$101F  // Only overlaps with a's callers
```

---

### 1.3 Alphabetical Variable Sorting

**Source:** Prog8

**Anti-Pattern:**
```kotlin
// From Prog8 source
val sortedList = varsDontCareWithoutAlignment.sortedByDescending { it.scopedNameString }
// TODO some form of intelligent priorization?
```

**Problem:**
- Variable `aardvark` gets ZP before `zzz_loop_counter`
- No correlation between name and importance
- Heavily used variables may not get ZP

**Correct Approach:**
```
// Sort by importance score
score = useCount × typeWeight
// typeWeight: pointer=0x800, byte=0x100, word=0x80
sortedVars = variables.sortBy(score, descending=true)
```

---

### 1.4 All-or-Nothing ZP Allocation

**Sources:** CC65, Prog8

**Anti-Pattern:**
```c
// User requests ZP but can't get it
@zp let critical_ptr: *byte;  // SILENT failure to RAM
// No error, no warning
```

**Problem:**
- User expects ZP, code runs slower
- Silent performance degradation
- Hard to debug performance issues

**Correct Approach:**
```
// Required ZP → error if not possible
@zp required critical_ptr: *byte;
// error: Cannot allocate 'critical_ptr' to ZP (0/255 bytes free)

// Preferred ZP → warning if not possible
@zp let optional_var: byte;
// warning: ZP full, 'optional_var' allocated to RAM
```

---

### 1.5 Fixed ZP Reserved Regions

**Source:** Oscar64 (partially)

**Anti-Pattern:**
```cpp
// Hardcoded ZP layout, can't adapt
BC_REG_WORK_Y     = 0x02;
BC_REG_WORK       = 0x03;
BC_REG_FPARAMS    = 0x03;
// No user control
```

**Problem:**
- Can't use ZP needed by user's assembly
- Conflicts with external libraries
- Inflexible for different programs

**Correct Approach:**
- Platform-specific defaults
- User-configurable reservations
- Document what's reserved and why

---

## 2. Recursion Handling Anti-Patterns

### 2.1 Silent Recursion Support

**Source:** CC65

**Anti-Pattern:**
```c
// Recursion "just works" - no indication of cost
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);  // Hidden stack overhead
}
```

**Problem:**
- Users don't realize performance cost
- Forces software stack for all code
- Can't optimize non-recursive functions

**Correct Approach:**
```
// Recursion must be explicit
fn factorial(n: byte): word {
    return n * factorial(n - 1);  // ERROR: Use 'recursive fn'
}

recursive fn factorial(n: byte): word {
    return n * factorial(n - 1);  // OK: User aware of cost
}
```

---

### 2.2 Poor Recursion Error Messages

**Source:** KickC

**Anti-Pattern:**
```
ERROR! Recursion not allowed! Occurs in myfunction
// No call chain, no suggestion, no help
```

**Problem:**
- User doesn't know WHY recursion was detected
- Hard to find mutual recursion
- No guidance on how to fix

**Correct Approach:**
```
ERROR: Recursion detected in function 'process_tree'

Call chain forming cycle:
  process_tree
    → process_node
    → handle_children
    → process_tree  ← recursive call here

Suggestion: Convert to iterative approach using explicit stack:
  let stack: Node[MAX_DEPTH];
  // Use stack[index] instead of recursion

If recursion is truly needed, mark function as recursive:
  recursive fn process_tree(...) { ... }
```

---

### 2.3 Conservative Recursive Marking

**Source:** Oscar64

**Anti-Pattern:**
```cpp
// If ANY function in cycle is recursive, ALL get marked
if (MarkCycle(root, proc))
    proc->mFlags |= DTF_FUNC_RECURSIVE;  // Entire chain marked
```

**Problem:**
- Rare recursive paths force stackcall everywhere
- Code that almost never recurses pays full cost

**Better Approach:**
- Detect and error on recursion by default
- Let user explicitly mark with `recursive`
- Only marked functions pay the cost

---

## 3. Parameter Passing Anti-Patterns

### 3.1 Stack-Only Parameters

**Source:** CC65 (default)

**Anti-Pattern:**
```asm
; Every parameter pushed to stack
lda param1
jsr pusha
lda param2
jsr pusha
jsr function
jsr incsp2  ; Cleanup
```

**Problem:**
- ~10-15 cycles per parameter
- Requires stack cleanup
- Slow for common cases

**Correct Approach:**
```asm
; Use registers for small params
lda param1    ; First byte → A
ldy param2    ; Second byte → Y
jsr function
; No cleanup needed
```

---

### 3.2 Ignoring Register Conventions

**Source:** N/A (general anti-pattern)

**Anti-Pattern:**
```asm
; Ignoring that A often already holds the value
lda some_value
sta temp
; ... computation ...
lda temp      ; Reload what was in A
jsr function
```

**Problem:**
- Unnecessary store/load cycles
- Wastes registers

**Correct Approach:**
- Track register contents
- Avoid redundant loads
- Use register for first param when possible

---

## 4. Code Generation Anti-Patterns

### 4.1 Indirect Addressing When Direct Works

**Source:** CC65 (for stack locals)

**Anti-Pattern:**
```asm
; Stack local access
ldy #offset
lda (sp),y    ; 5-6 cycles + Y setup
```

**Problem:**
- Indirect addressing is slower
- Requires Y register for offset
- Page crossing penalties

**Correct Approach (Static Allocation):**
```asm
; Static local access  
lda label     ; 4 cycles, no register needed
; or ZP
lda $xx       ; 3 cycles
```

---

### 4.2 Page Boundary Checks

**Source:** CC65

**Anti-Pattern:**
```asm
; Every push must check page crossing
.proc pusha
    ldy c_sp
    beq @L1       ; Check if crossing page
    dec c_sp
    sta (c_sp),y
    rts
@L1:
    dec c_sp+1    ; Handle page crossing
    dec c_sp
    sta (c_sp),y
    rts
.endproc
```

**Problem:**
- Extra branch on every operation
- Larger code size
- Slower execution

**Correct Approach:**
- Static allocation doesn't cross pages
- Fixed addresses, no boundary checks

---

### 4.3 No Liveness Analysis

**Sources:** CC65, Prog8

**Anti-Pattern:**
```c
void func() {
    int a = work1();  // a allocated at offset 0
    // a is dead after this line
    int b = work2();  // b allocated at offset 2 (should be 0!)
    int c = work3();  // c allocated at offset 4 (should be 2!)
}
```

**Problem:**
- Variables never share space
- Larger frames than necessary
- More memory used

**Correct Approach:**
- Analyze variable lifetimes
- Coalesce non-overlapping lifetimes
- Reuse frame slots

---

## 5. Interrupt Safety Anti-Patterns

### 5.1 Ignoring ISR Context

**Sources:** CC65, Prog8

**Anti-Pattern:**
```c
// Main code
void update_score(int points) {
    score += points;  // Uses static variable
}

// IRQ handler - uses SAME static variable!
void irq_handler() {
    update_score(1);  // Can corrupt main's in-progress call
}
```

**Problem:**
- ISR can interrupt main at any point
- Static variables get corrupted
- Extremely hard to debug

**Correct Approach (KickC):**
- Thread-aware coalescing
- Never coalesce across ISR boundaries
- Functions called from ISR get separate storage

---

### 5.2 No Interrupt Propagation

**Source:** CC65 (partially)

**Anti-Pattern:**
```c
// Only direct ISR handlers are known
__interrupt void nmi() {
    helper();  // helper not marked as ISR-reachable
}

void helper() {
    // Compiler doesn't know this can be called from ISR
    // May optimize incorrectly
}
```

**Problem:**
- Helpers of ISRs may be incorrectly optimized
- Coalescing may corrupt ISR-reachable functions

**Correct Approach (Oscar64):**
```cpp
// Propagate ISR-reachability through call graph
void GlobalAnalyzer::CheckInterrupt() {
    do {
        changed = false;
        for (function : functions) {
            if (function.isInterruptReachable) {
                for (callee : function.calls) {
                    if (!callee.isInterruptReachable) {
                        callee.markInterruptReachable();
                        changed = true;
                    }
                }
            }
        }
    } while (changed);
}
```

---

## 6. Architecture Anti-Patterns

### 6.1 SSA Overcomplexity

**Source:** KickC (partially)

**Anti-Pattern:**
- Full SSA form with phi nodes
- Every assignment creates new variable version
- Complex infrastructure for version tracking

**Problem:**
- Higher implementation complexity
- More memory usage during compilation
- Harder to debug compiler

**Better for Blend:**
- Simpler frame-based model
- Liveness analysis without full SSA
- Keep complexity appropriate to 6502

---

### 6.2 Monolithic Allocation

**Source:** N/A (general)

**Anti-Pattern:**
```
// Single pass does everything
allocateAll() {
    buildCallGraph();
    detectRecursion();
    allocateZP();
    coalesceFrames();
    generateCode();
}
```

**Problem:**
- Hard to debug
- No intermediate validation
- Difficult to extend

**Correct Approach:**
```
// Clear pass separation
Pass1: BuildCallGraph
Pass2: DetectRecursion  // Validate: no unmarked recursion
Pass3: ComputeLiveness  // Validate: consistent live ranges
Pass4: AllocateFrames   // Validate: no conflicts
Pass5: GenerateCode
```

---

## 7. Summary: Anti-Pattern Checklist

### Allocation
- [ ] ❌ Don't use runtime stack as default
- [ ] ❌ Don't ignore call graph disjointness
- [ ] ❌ Don't sort variables alphabetically
- [ ] ❌ Don't silently fail ZP allocation
- [ ] ❌ Don't hardcode ZP regions

### Recursion
- [ ] ❌ Don't silently support recursion
- [ ] ❌ Don't give cryptic recursion errors
- [ ] ❌ Don't conservatively mark entire chains

### Parameters
- [ ] ❌ Don't push everything to stack
- [ ] ❌ Don't ignore register conventions

### Code Generation
- [ ] ❌ Don't use indirect when direct works
- [ ] ❌ Don't add page boundary checks for static
- [ ] ❌ Don't skip liveness analysis

### Interrupt Safety
- [ ] ❌ Don't ignore ISR context
- [ ] ❌ Don't forget ISR propagation

### Architecture
- [ ] ❌ Don't overcomplicate with full SSA
- [ ] ❌ Don't use monolithic allocation

---

## Conclusion

By avoiding these anti-patterns, Blend65's SFA will be:
- ✅ Faster (no runtime stack overhead)
- ✅ More memory-efficient (coalescing, liveness)
- ✅ Safer (interrupt awareness)
- ✅ User-friendly (clear errors, explicit control)
- ✅ Maintainable (clean pass architecture)

---

**Next Document:** [03-edge-cases.md](03-edge-cases.md)