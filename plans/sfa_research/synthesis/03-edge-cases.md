# SFA Edge Cases Catalog

> **Document**: synthesis/03-edge-cases.md
> **Purpose**: Catalog of edge cases and corner scenarios for SFA implementation
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

This document catalogs edge cases that Blend65's SFA must handle correctly. Each edge case includes the scenario, potential problems, and recommended handling.

---

## 1. Frame Size Edge Cases

### 1.1 Empty Functions

**Scenario:** Function with no locals or parameters.

```
fn empty_stub() {
    // Does nothing
}
```

**Potential Problems:**
- Frame size = 0 may cause division by zero
- Memory allocator may allocate nothing but expect something

**Recommended Handling:**
- Allow 0-byte frames
- Don't allocate BSS label if not needed
- Generate simple `rts` with no prologue

---

### 1.2 Very Large Frames (>256 bytes)

**Scenario:** Function with many locals exceeding 256 bytes.

```
fn big_function() {
    let buffer1: byte[128];
    let buffer2: byte[128];
    let buffer3: byte[128];  // Total: 384 bytes
}
```

**Potential Problems:**
- Y register can only index 0-255
- Single addressing mode can't reach all locals

**Recommended Handling (Static Allocation):**
- No problem! Each variable gets unique label
- Direct addressing works at any offset
- No Y-indexing needed

**If Stack Allocation (recursive fn):**
- Split frame into multiple 256-byte segments
- Use frame pointer adjustments
- Document the limitation clearly

---

### 1.3 Maximum Practical Frame Size

**Scenario:** Extremely large frames approaching RAM limits.

```
fn huge_function() {
    let mega_buffer: byte[32768];  // Half of 64K!
}
```

**Potential Problems:**
- May exceed available RAM
- Linker cannot place

**Recommended Handling:**
- Static allocation: linker reports if out of memory
- Warning if single function uses >10% of RAM
- Suggest heap/slab allocation for large buffers

---

## 2. Nesting Edge Cases

### 2.1 Deep Call Chains (5+ levels)

**Scenario:** Main → A → B → C → D → E (5+ levels deep).

```
fn main() { a(); }
fn a() { b(); }
fn b() { c(); }
fn c() { d(); }
fn d() { e(); }
fn e() { /* leaf */ }
```

**Potential Problems:**
- Hardware stack overflow (256 bytes max)
- Each JSR uses 2 bytes

**Analysis:**
- 5 nested calls = 10 bytes hardware stack
- 50 nested calls = 100 bytes hardware stack
- 128 nested calls = hardware stack full!

**Recommended Handling:**
- Warn if call depth > 64 (128 bytes HW stack)
- Error if call depth > 120 (approaching limit)
- Static allocation doesn't add to HW stack usage

---

### 2.2 Indirect Recursion Detection

**Scenario:** A → B → C → A (indirect recursion).

```
fn a() { b(); }
fn b() { c(); }
fn c() { a(); }  // Indirect recursion back to a
```

**Potential Problems:**
- Simple analysis might miss indirect cycles
- All three functions form a recursive chain

**Recommended Handling:**
- Build complete call graph
- DFS cycle detection (like Oscar64/KickC)
- Report full call chain in error message:
  ```
  ERROR: Recursive call chain detected:
    a → b → c → a
  All functions in this chain must use 'recursive fn'
  ```

---

### 2.3 Diamond Call Patterns

**Scenario:** A calls B and C, both B and C call D.

```
fn a() { b(); c(); }
fn b() { d(); }
fn c() { d(); }
fn d() { /* leaf */ }
```

**Potential Problems:**
- D's frame is active during both B and C
- Must not coalesce D with B or C's callers

**Recommended Handling:**
- D cannot share with A (A is active when D runs)
- D cannot share with B (B is active when D runs)
- D cannot share with C (C is active when D runs)
- D CAN share with other functions not in this call tree

---

## 3. Parameter Edge Cases

### 3.1 Many Parameters (8+)

**Scenario:** Function with 8 or more parameters.

```
fn draw_sprite(
    x: byte, y: byte, 
    w: byte, h: byte,
    color: byte, priority: byte,
    flags: byte, frame: byte
): void { ... }
```

**Potential Problems:**
- Only 3 registers (A, X, Y)
- Can't pass all in registers

**Recommended Handling:**
- First 1-2 params in registers (A, Y)
- Rest in static variables
- Generate efficient store sequence at call site

---

### 3.2 Large Parameter (Struct by Value)

**Scenario:** Passing struct by value.

```
struct GameState {
    x: byte,
    y: byte,
    health: byte,
    score: word,
    flags: byte
}

fn save_state(state: GameState): void { ... }
```

**Potential Problems:**
- 7 bytes of parameter data
- Copy cost at call site

**Recommended Handling:**
- Static variable for struct parameter
- Copy struct at call site
- Consider: pass by reference more efficient?

---

### 3.3 Array Parameters

**Scenario:** Passing array by reference.

```
fn sum_array(arr: *byte, len: byte): word { ... }
```

**Potential Problems:**
- Array pointer is 2 bytes
- Array data is elsewhere

**Recommended Handling:**
- Pointer in ZP (for indirect indexing)
- Length as separate param (A or static)
- Document that arrays are always by reference

---

## 4. Zero Page Edge Cases

### 4.1 ZP Exhaustion

**Scenario:** Program needs more ZP than available.

```
// 100 variables marked @zp required
@zp required var1: byte;
@zp required var2: byte;
// ... 98 more ...
```

**Potential Problems:**
- Platform only has ~50 ZP bytes available
- Can't satisfy all requirements

**Recommended Handling:**
```
ERROR: Zero page exhausted

Required ZP allocations: 100 bytes
Available ZP: 50 bytes

Variables that could not be allocated:
  - var51 through var100

Suggestion: Change some @zp required to @zp (preferred)
            or remove @zp annotation entirely.
```

---

### 4.2 ZP Contention Between Functions

**Scenario:** Multiple functions all want same ZP variables.

```
fn func_a() {
    @zp let ptr: *byte;  // Wants ZP
}

fn func_b() {
    @zp let ptr: *byte;  // Also wants ZP
}
```

**Potential Problems:**
- If both active, need separate ZP
- If never both active, can share

**Recommended Handling (with Coalescing):**
- Check call graph
- If func_a and func_b never overlap → share ZP location
- If they can overlap → allocate separately

---

### 4.3 Reserved ZP Conflicts

**Scenario:** User requests ZP address that's system-reserved.

```
@zp at $00 let my_indirect: *byte;  // $00-$01 is CPU indirect!
```

**Potential Problems:**
- $00-$01 used by 6502 for indirect JMP
- System may use other ZP locations

**Recommended Handling:**
```
ERROR: Cannot allocate 'my_indirect' at $00
  Address $00-$01 is reserved by system (CPU indirect addressing)

Reserved ranges for C64:
  $00-$01: CPU indirect addressing
  $02-$8F: BASIC/KERNAL workspace
  $90-$FA: Available for user
  $FB-$FF: KERNAL I/O
```

---

## 5. Interrupt Edge Cases

### 5.1 Nested Interrupts

**Scenario:** NMI can interrupt IRQ handler.

```
interrupt fn irq_handler() {
    update_raster();  // NMI can fire here!
}

interrupt fn nmi_handler() {
    update_music();
}
```

**Potential Problems:**
- If NMI uses same function as IRQ, corruption
- Nested interrupt handling is complex

**Recommended Handling:**
- Treat NMI and IRQ as separate "threads"
- Functions callable from both need special handling
- Either: duplicate for each interrupt context
- Or: mark as requiring safe (stack-based) allocation

---

### 5.2 Shared Functions Between Main and ISR

**Scenario:** Same function called from main and interrupt.

```
fn update_score(points: byte) {
    score += points;
}

fn main() {
    update_score(100);  // Main context
}

interrupt fn irq() {
    update_score(1);  // Interrupt context
}
```

**Potential Problems:**
- IRQ can fire while main is in update_score
- Static params get corrupted

**Recommended Handling:**
```
WARNING: Function 'update_score' is called from both main and interrupt contexts

This is unsafe with static allocation because:
  - IRQ may fire while main is executing update_score
  - Static parameter 'points' will be overwritten

Solutions:
  1. Mark as 'recursive fn' to use stack (slower but safe)
  2. Create separate versions for main and interrupt
  3. Disable interrupts during update_score call in main
```

---

### 5.3 Interrupt During Frame Coalescing

**Scenario:** Coalesced functions include one called from ISR.

```
// func_a and func_b coalesced (share memory)
// But func_a is called from interrupt!

fn func_a() { /* called from ISR */ }
fn func_b() { /* called from main */ }
```

**Potential Problems:**
- If interrupt fires while func_b is active
- And ISR calls func_a
- Shared memory is corrupted

**Recommended Handling:**
- NEVER coalesce functions in different threads
- Thread = main OR interrupt1 OR interrupt2
- Document this limitation clearly

---

## 6. Module Edge Cases

### 6.1 Cross-Module Calls

**Scenario:** Function in module A calls function in module B.

```
// module_a.blend
import { helper } from "module_b";
fn main() { helper(); }

// module_b.blend
export fn helper() { ... }
```

**Potential Problems:**
- Call graph spans multiple files
- Coalescing must consider all modules

**Recommended Handling:**
- Build global call graph after all modules parsed
- Coalescing works program-wide
- Export/import doesn't affect allocation (just visibility)

---

### 6.2 External Library Functions

**Scenario:** Calling ROM routines or external libraries.

```
fn print_char(c: byte) {
    asm { jsr $FFD2 }  // CHROUT ROM routine
}
```

**Potential Problems:**
- ROM routine's register usage unknown
- May clobber ZP locations

**Recommended Handling:**
- Assume external calls clobber A, X, Y
- Document expected ZP preservation
- Provide asm block annotations:
  ```
  asm {
      clobbers: A, X
      preserves: Y, $FB-$FE
  } {
      jsr $FFD2
  }
  ```

---

### 6.3 Circular Module Dependencies

**Scenario:** Module A imports B, module B imports A.

```
// module_a.blend
import { b_func } from "module_b";
export fn a_func() { b_func(); }

// module_b.blend
import { a_func } from "module_a";
export fn b_func() { a_func(); }  // Circular!
```

**Potential Problems:**
- This is also indirect recursion!
- Must be detected even across module boundaries

**Recommended Handling:**
- Detect cycles in import graph
- Analyze cross-module call chains
- Same recursion rules apply (error unless marked recursive)

---

## 7. Optimization Edge Cases

### 7.1 Conflicting Optimization Goals

**Scenario:** ZP optimal for speed, RAM optimal for size.

```
// Hot loop - wants ZP
for i in 0..1000 {
    @zp counter += 1;  // ZP is faster
}

// Cold code - could use RAM
@zp let rarely_used: word;  // Wasting ZP
```

**Recommended Handling:**
- Weight system prioritizes hot variables
- `-Os` (optimize size) prefers RAM over ZP
- `-O2` (optimize speed) prefers ZP over RAM

---

### 7.2 Inlining Effects on Frame Size

**Scenario:** Inlined function's locals become part of caller's frame.

```
inline fn small_helper(): byte {
    let temp: byte = 0;  // Inlined into caller!
    return temp;
}

fn caller() {
    let result = small_helper();  // temp is now in caller's frame
}
```

**Potential Problems:**
- Frame size calculation must happen after inlining
- Inlined function's variables need unique names

**Recommended Handling:**
- Run inlining pass before frame allocation
- Rename inlined locals: `caller.inlined_small_helper.temp`
- Apply coalescing to inlined variables too

---

### 7.3 Volatile Variables

**Scenario:** Hardware-mapped variable must not be optimized.

```
@map screen_color at $D020: byte;  // Hardware register

fn blink() {
    screen_color = 0;
    screen_color = 1;  // Both writes MUST happen!
}
```

**Potential Problems:**
- Optimizer might eliminate "redundant" write
- Variable must not be cached in register

**Recommended Handling:**
- @map variables are implicitly volatile
- Never coalesce volatile with non-volatile
- Don't cache volatile values in registers

---

## 8. Summary: Edge Case Handling Matrix

| Category | Edge Case | Severity | Handling |
|----------|-----------|----------|----------|
| Frame Size | Empty function | Low | Allow 0-byte frames |
| Frame Size | >256 bytes | Low | Static: OK, Stack: split |
| Frame Size | RAM limit | Medium | Linker error, warn early |
| Nesting | Deep calls (5+) | Medium | Warn at 64+, error at 120+ |
| Nesting | Indirect recursion | High | DFS detection, full chain error |
| Nesting | Diamond pattern | Medium | Correct coalescing analysis |
| Parameters | Many (8+) | Low | Static variables for overflow |
| Parameters | Large struct | Low | Static, suggest reference |
| Parameters | Array | Low | Always by reference |
| ZP | Exhaustion | High | Clear error, suggestions |
| ZP | Contention | Medium | Coalescing if possible |
| ZP | Reserved conflict | High | Platform-aware error |
| Interrupt | Nested | High | Separate thread analysis |
| Interrupt | Shared function | High | Warning, require annotation |
| Interrupt | Coalesce conflict | Critical | Never coalesce across threads |
| Module | Cross-module | Medium | Global call graph |
| Module | External | Medium | Clobber annotations |
| Module | Circular | High | Recursion detection |
| Optimization | Goal conflict | Low | Flags control preference |
| Optimization | Inlining | Medium | Analyze after inlining |
| Optimization | Volatile | High | Never optimize memory access |

---

## Conclusion

Blend65's SFA must handle these edge cases correctly to be robust. The key principles are:

1. **Fail early with clear messages** - Don't let problems cascade
2. **Consider the call graph globally** - Coalescing requires whole-program view
3. **Respect interrupt boundaries** - Thread-aware allocation is critical
4. **Document limitations** - Users need to understand constraints

These edge cases inform the design of Phase 6: God-Level SFA.