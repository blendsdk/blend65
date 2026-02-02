# God-Level SFA: Frame Coalescing Theory

> **Document**: god-level-sfa/04a-coalescing-theory.md
> **Purpose**: Theory and concepts behind frame memory reuse
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

**Frame coalescing** is the most important memory optimization in static frame allocation. It allows functions that never have overlapping execution to share the same memory addresses, typically saving 30-60% of frame region usage.

This document covers the **theory** behind why coalescing works and when it's safe.

---

## 1. The Core Insight

### 1.1 Static Allocation Without Coalescing

Consider this program:

```
fn main() {
    let x: byte = 10;      // main.x
    calculate(x);
    draw();
}

fn calculate(n: byte) {    // calculate.n
    let result: word = 0;  // calculate.result
    // ...
}

fn draw() {
    let sprite_x: byte;    // draw.sprite_x
    let sprite_y: byte;    // draw.sprite_y
    // ...
}
```

**Without coalescing:**
```
Frame Region Layout:
$0200: main.x        (1 byte)
$0201: calculate.n   (1 byte)
$0202: calculate.result (2 bytes)
$0204: draw.sprite_x (1 byte)
$0205: draw.sprite_y (1 byte)
────────────────────────────
Total: 6 bytes used
```

### 1.2 The Key Observation

Look at the call graph:

```
main() ─┬─ calculate()
        │
        └─ draw()
```

**Critical insight:** `calculate()` and `draw()` are never active at the same time!

- When `calculate()` runs, `draw()` hasn't been called yet
- When `draw()` runs, `calculate()` has already returned
- Their local variables will NEVER be accessed simultaneously

### 1.3 With Coalescing

Since `calculate` and `draw` don't overlap, they can share memory:

```
Frame Region Layout:
$0200: main.x              (1 byte)
$0201: [SHARED]
       - calculate.n       (offset 0)
       - draw.sprite_x     (offset 0)
$0202: [SHARED]
       - calculate.result  (2 bytes, offset 1)
       - draw.sprite_y     (offset 1)
────────────────────────────
Total: 4 bytes used (33% savings!)
```

---

## 2. Formal Definition of Overlap

### 2.1 When Can Two Functions Overlap?

Two functions `A` and `B` have **overlapping execution** if and only if:

1. **A calls B** (directly or transitively): When B runs, A is still "on the stack"
2. **B calls A** (directly or transitively): When A runs, B is still "on the stack"
3. **A and B are in different thread contexts** (main vs ISR): ISR can interrupt anytime

### 2.2 Recursive Callers Set

For each function `F`, we define its **recursive callers set** as:

```
recursiveCallers(F) = { G | G can be active when F executes }
                    = { G | G calls F, directly or transitively }
                    ∪ { G | some H in recursiveCallers(F) calls G }
```

In simpler terms: "all functions that could still be on the call stack when F runs"

### 2.3 Overlap Rule

```
canOverlap(A, B) = A ∈ recursiveCallers(B)
                 OR B ∈ recursiveCallers(A)
                 OR threadContext(A) ≠ threadContext(B)
```

**If canOverlap is TRUE → Cannot coalesce**
**If canOverlap is FALSE → CAN coalesce**

---

## 3. Thread Context and Interrupt Safety

### 3.1 The ISR Problem

```
fn main() {
    game_loop();
}

fn game_loop() {
    let score: word = 0;
    while true {
        update_game();
        draw_game();
    }
}

interrupt fn irq_handler() {
    update_timer();
    play_sound();
}
```

**Question:** Can `game_loop` and `irq_handler` share memory?

**Answer:** ABSOLUTELY NOT!

The IRQ can fire at ANY point during `game_loop`, including while `score` is being modified. If they share the same address, the ISR would corrupt `score`.

### 3.2 Thread Context Definition

```typescript
enum ThreadContext {
  /** Only reachable from main program flow */
  MainOnly = 'main',
  
  /** Only reachable from interrupt handlers */
  IsrOnly = 'isr',
  
  /** Reachable from both (shared utility functions) */
  Both = 'both',
}
```

### 3.3 Propagation Rules

```
1. main() → MainOnly
2. interrupt handlers → IsrOnly
3. Function called only from MainOnly → MainOnly
4. Function called only from IsrOnly → IsrOnly
5. Function called from both contexts → Both
```

### 3.4 Thread Context Coalescing Rules

| Context A | Context B | Can Coalesce? |
|-----------|-----------|---------------|
| MainOnly | MainOnly | ✅ Yes (if no call overlap) |
| IsrOnly | IsrOnly | ✅ Yes (if no call overlap) |
| MainOnly | IsrOnly | ❌ No (different threads) |
| Both | Any | ❌ No (could be active in either) |

---

## 4. Why Coalescing is Safe

### 4.1 Proof Sketch

**Claim:** If functions A and B can be coalesced, their variables will never be accessed simultaneously.

**Proof:**
1. A and B have no call relationship (neither calls the other)
2. A and B are in the same thread context
3. Therefore, when A executes, B cannot be on the call stack
4. When B executes, A cannot be on the call stack
5. Variables are only accessed when their function is active
6. Therefore, A's variables and B's variables are never accessed at the same time
7. They can safely share the same memory addresses ∎

### 4.2 The Recursive Function Exception

**Why can't recursive functions coalesce?**

```
fn factorial(n: byte): word {
    if n <= 1 { return 1; }
    return n * factorial(n - 1);  // Recursive call!
}
```

When `factorial(3)` calls `factorial(2)`:
- `factorial(3).n` must still exist (value = 3)
- `factorial(2).n` must also exist (value = 2)
- They CANNOT share the same address!

**Rule:** Recursive functions must use stack-based frames, not static coalesced frames.

---

## 5. Coalesce Groups

### 5.1 Definition

A **coalesce group** is a set of functions that:
1. Are all in the same thread context
2. Have no pairwise call relationships
3. Are not recursive
4. Can all share the same frame memory region

### 5.2 Group Properties

```typescript
interface CoalesceGroup {
  /** Unique group identifier */
  groupId: number;
  
  /** Functions in this group */
  members: Set<string>;
  
  /** Maximum frame size among members */
  maxFrameSize: number;
  
  /** Thread context (all members share this) */
  threadContext: ThreadContext;
  
  /** Assigned base address */
  baseAddress: number;
}
```

### 5.3 Memory Layout Within a Group

All functions in a group share the same base address. The group's memory allocation equals the **maximum frame size** among all members:

```
Group Members:
  - funcA: 8 bytes
  - funcB: 12 bytes
  - funcC: 4 bytes

Group allocation: max(8, 12, 4) = 12 bytes

At runtime:
  When funcA runs: uses bytes 0-7
  When funcB runs: uses bytes 0-11
  When funcC runs: uses bytes 0-3
```

---

## 6. Memory Savings Analysis

### 6.1 Theoretical Maximum Savings

**Best case:** All functions are at the same call depth (siblings)

```
main() ─┬─ func1() (10 bytes)
        ├─ func2() (10 bytes)
        ├─ func3() (10 bytes)
        └─ func4() (10 bytes)

Without coalescing: 40 bytes
With coalescing: 10 bytes (all share!)
Savings: 75%
```

### 6.2 Typical Savings

**Real programs:** Mixed call depths, some functions call others

```
main() ─┬─ update() ─── helper()
        │
        └─ draw() ─┬─ draw_sprite()
                   └─ draw_bg()

Coalesce groups:
  Group 1: main (can't coalesce - calls others)
  Group 2: update + draw (siblings)
  Group 3: helper + draw_sprite + draw_bg (leaf functions)

Typical savings: 30-60%
```

### 6.3 Factors Affecting Savings

| Factor | Impact on Savings |
|--------|-------------------|
| **Call depth** | Shallow → more siblings → more savings |
| **Call patterns** | Many independent functions → more savings |
| **Frame sizes** | Varied sizes → max dominates → less savings |
| **ISR usage** | ISR functions can't coalesce with main → less savings |
| **Recursion** | Recursive functions can't coalesce → less savings |

---

## 7. When Coalescing Fails

### 7.1 Common Cases

1. **Linear call chains:** Each function calls the next
   ```
   main() → A() → B() → C() → D()
   ```
   No siblings, minimal coalescing possible.

2. **Heavy recursion:** Many recursive functions
   ```
   fn process(tree) { process(tree.left); process(tree.right); }
   ```
   Recursive functions cannot coalesce.

3. **ISR-heavy programs:** Many ISR-called functions
   ```
   interrupt fn irq() { helper1(); helper2(); helper3(); }
   ```
   ISR functions isolated from main program functions.

### 7.2 Mitigation Strategies

1. **Prefer iteration over recursion** (static allocation works)
2. **Minimize ISR code** (call few functions from ISR)
3. **Flatten call structures** (direct calls rather than chains)

---

## 8. Summary

### Key Concepts

| Concept | Definition |
|---------|------------|
| **Frame coalescing** | Multiple functions sharing the same memory |
| **Overlap** | Two functions can be active simultaneously |
| **Recursive callers** | Set of functions on call stack when F runs |
| **Thread context** | Main vs ISR execution context |
| **Coalesce group** | Functions that can safely share memory |

### Safety Rules

1. **Call overlap** → Cannot coalesce
2. **Different thread contexts** → Cannot coalesce
3. **Recursive functions** → Cannot coalesce
4. **Same context, no overlap** → CAN coalesce

### Expected Savings

| Program Type | Expected Savings |
|--------------|------------------|
| Game loop (shallow) | 50-70% |
| Utility library | 30-50% |
| Deep call chains | 10-30% |
| Heavy recursion | 0-10% |

---

**Previous Document:** [03-zeropage-strategy.md](03-zeropage-strategy.md)  
**Next Document:** [04b-coalescing-algorithm.md](04b-coalescing-algorithm.md)