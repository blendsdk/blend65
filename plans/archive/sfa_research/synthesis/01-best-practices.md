# SFA Best Practices

> **Document**: synthesis/01-best-practices.md
> **Purpose**: Consolidated best practices extracted from CC65, KickC, Oscar64, and Prog8
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

This document consolidates the best practices from all four analyzed compilers into actionable guidelines for Blend65's SFA implementation.

---

## 1. Frame Allocation Best Practices

### 1.1 Static by Default

**Sources:** Prog8 (primary), KickC (PHI_CALL)

**Practice:**
- Make static frame allocation the **default** mode
- Every local variable gets a fixed BSS address
- Zero runtime allocation/deallocation

**Implementation:**
```
// Blend65 default behavior
fn game_loop() {
    let counter: byte = 0;  // → BSS label: game_loop.counter
    let score: word = 0;    // → BSS label: game_loop.score
}
```

**Rationale:**
- Eliminates 50-80 cycles per function call
- Predictable memory layout for debugging
- No stack overflow risk
- Matches 6502 game development patterns

---

### 1.2 Zero Prologue/Epilogue

**Sources:** Prog8, KickC

**Practice:**
- Functions should have **no** entry/exit stack manipulation
- Hardware stack only holds JSR return addresses
- No software stack pointer maintenance

**Generated Code:**
```asm
; Ideal function structure
my_function:
    ; No prologue - just start executing
    lda my_function.param1
    adc my_function.param2
    sta my_function.result
    rts
    ; No epilogue - just RTS
```

**Anti-Pattern (CC65 style):**
```asm
; DON'T generate this by default
my_function:
    jsr decsp4    ; Stack allocation - AVOID
    ; ...
    jsr incsp4    ; Stack deallocation - AVOID
    rts
```

---

### 1.3 Call-Graph-Based Frame Reuse

**Source:** KickC (critical innovation)

**Practice:**
- Functions that never call each other can share memory
- Build call graph at compile time
- Coalesce frames of non-overlapping functions

**Algorithm:**
```
1. Build call graph: mCalled/mCallers relationships
2. For each function F:
   a. Compute recursive caller set (all functions that could be active when F runs)
   b. For each other function G:
      - If F and G have no caller overlap → CAN share memory
3. Group functions into equivalence classes
4. Each class gets single allocation
```

**Memory Savings:** 30-60% typical (based on KickC data)

---

### 1.4 Opt-In Recursion

**Sources:** KickC (`__stackcall`), Oscar64 (auto-detect)

**Practice:**
- Static allocation by default (recursion forbidden)
- Explicit `recursive` keyword enables stack frames
- Recursive functions use software stack automatically

**Blend65 Syntax:**
```
// Default: static allocation, no recursion
fn calculate(x: byte, y: byte): byte {
    return x + y;
}

// Explicit: stack allocation, recursion allowed
recursive fn factorial(n: byte): word {
    if n <= 1 { return 1; }
    return n * factorial(n - 1);
}
```

**Error Handling:**
```
// Compile error if recursion detected without keyword
fn a() { b(); }
fn b() { a(); }  // ERROR: Recursive call detected. Use 'recursive fn' if intended.
```

---

## 2. Zero Page Best Practices

### 2.1 Weight-Based Priority

**Source:** Oscar64 (primary)

**Practice:**
- Allocate ZP based on variable importance
- Score = useCount × typeWeight
- Higher scores get ZP first

**Weight Table:**
| Type | Weight | Rationale |
|------|--------|-----------|
| Pointer | 0x800 | Enables indirect Y addressing |
| Byte | 0x100 | Most benefit from ZP (1/3 cycle savings) |
| Word | 0x080 | Less benefit (saves less % per access) |
| Array | 0x000 | Too large for ZP |
| Struct | 0x000 | Usually too large |

**Algorithm:**
```
1. Count usage of each variable in program
2. Score = useCount × typeWeight
3. Sort by score (highest first)
4. Allocate to ZP until full
5. Remainder goes to RAM
```

---

### 2.2 User Control (Simplified ZP Directives)

**Source:** Prog8 (primary), simplified for Blend65

**Practice:**
- Let users override automatic ZP decisions
- Clear, explicit, **predictable** directives
- No ambiguous "prefer" semantics

**Blend65 Directives:**
| Directive | Behavior | Predictable? |
|-----------|----------|--------------|
| `@zp` | **MUST** be in Zero Page - compile error if ZP full | ✅ Yes |
| `@ram` | **MUST** be in RAM - never uses ZP | ✅ Yes |
| (none) | Compiler decides based on weight formula | ✅ Yes (deterministic) |

```
@zp let counter: byte;           // Guaranteed ZP, error if impossible
@ram let buffer: byte[256];      // Guaranteed RAM, never in ZP
let normal_var: byte;            // Compiler decides (deterministic)
```

**Error Messages:**
```
error: Cannot allocate 'counter' to zero page (full)
  @zp let counter: byte;
      ^^^
  Zero page usage: 142/142 bytes
  Suggestion: Remove @zp from a less critical variable:
    - sprite_x (used 15 times)
    - sprite_y (used 12 times)
```

**Why No "Prefer" Option:**
- Creates unpredictable behavior - developer won't know if variable landed in ZP or RAM
- If you need ZP, use `@zp` and get a clear error if impossible
- If you don't care, let the compiler decide (it's deterministic)

---

### 2.3 Reserved ZP Handling

**Sources:** KickC, Oscar64

**Practice:**
- Respect system-reserved ZP locations
- Platform-specific defaults
- User can reserve additional ranges

**Platform Defaults:**
| Platform | Reserved | Reason |
|----------|----------|--------|
| C64 | $00-$01 | CPU indirect addressing |
| C64 | $02-$8F | BASIC/Kernal |
| NES | $00-$07 | PPU/Controller |
| X16 | $00-$21 | VERA/Banking |

**User Reservation:**
```
// Platform config
@zp_reserved 0x02..0x21;  // Reserve for my assembly routines
```

---

### 2.4 ZP Overflow Handling

**Sources:** KickC, Prog8

**Practice:**
- Graceful degradation when ZP is full
- Clear warnings with suggestions
- Never silently fail

**Behavior:**
```
warning: Zero page exhausted, 'counter' allocated to RAM
  @zp let counter: byte;
  note: ZP usage: 255/255 bytes
  suggestion: Try reducing ZP usage or use coalescing (-Ocoalesce)
```

---

## 3. Parameter Passing Best Practices

### 3.1 Register First

**Sources:** Prog8, Oscar64

**Practice:**
- Pass small parameters in CPU registers
- Fastest possible parameter passing
- Compatible with ROM routines

**Convention:**
| Parameters | Location |
|------------|----------|
| 1 byte | A register |
| 1 word | A/Y registers (A=low, Y=high) |
| 2 bytes | A and Y separately |
| 3+ bytes or word+byte | Static variables |

**Generated Code:**
```asm
; my_func(x: byte) - single byte param
; Call site:
    lda #10
    jsr my_func

; my_func(pos: word) - single word param
; Call site:
    lda #<$0400     ; Low byte
    ldy #>$0400     ; High byte
    jsr my_func
```

---

### 3.2 Static Fallback

**Sources:** Prog8 (primary)

**Practice:**
- Parameters that don't fit in registers → static variables
- Named as `function.param_name`
- Simple, predictable pattern

**Generated Code:**
```asm
; draw_rect(x: byte, y: byte, w: byte, h: byte)
; 4 params - use A for first, static for rest
; Call site:
    lda #10
    sta draw_rect.x
    lda #20
    sta draw_rect.y
    lda #100
    sta draw_rect.w
    lda #50
    sta draw_rect.h
    jsr draw_rect
```

---

### 3.3 Return Value Convention

**Sources:** All compilers agree

**Practice:**
- Byte returns in A
- Word returns in A/Y (A=low)
- Larger returns via designated location

**Convention:**
| Size | Location |
|------|----------|
| byte | A |
| word | A/Y (A=low, Y=high) |
| 3 bytes | A/X/Y |
| Larger | ZP return area or static |

---

## 4. Code Generation Best Practices

### 4.1 Compile-Time Tracking

**Source:** CC65 (primary)

**Practice:**
- Track frame offsets at compile time
- Zero runtime cost
- Enables validation

**Implementation:**
```typescript
class FrameAllocator {
    private offset: number = 0;
    
    allocateLocal(size: number): number {
        const location = this.offset;
        this.offset += size;
        return location;
    }
    
    validateConsistency(): void {
        // Check offset matches expected frame size
    }
}
```

---

### 4.2 Consistency Checking

**Source:** CC65 (primary)

**Practice:**
- Validate stack/frame balance at compile time
- Catch codegen bugs immediately
- Use assertions liberally

**Example:**
```typescript
function generateExpression(expr: Expression): void {
    const startOffset = this.frameOffset;
    
    // Generate expression code...
    
    assert(this.frameOffset === startOffset, 
        `Frame imbalance: was ${startOffset}, now ${this.frameOffset}`);
}
```

---

### 4.3 Deferred Allocation

**Source:** CC65

**Practice:**
- Don't allocate immediately when variable declared
- Batch allocations at function entry
- Single allocation is faster

**Pattern:**
```typescript
// Phase 1: Collect
for (const local of function.locals) {
    frameSize += local.type.size;
}

// Phase 2: Emit single allocation (if needed)
if (frameSize > 0) {
    emit(`; Frame: ${frameSize} bytes`);
    // For static: emit BSS labels
    // For stack: emit single allocation
}
```

---

## 5. Interrupt Safety Best Practices

### 5.1 Propagation Marking

**Source:** Oscar64 (primary)

**Practice:**
- Mark functions called from interrupts
- Propagate through call graph
- Use for allocation decisions

**Algorithm:**
```
1. Mark all interrupt handlers (NMI, IRQ)
2. Do while changed:
   For each function F marked as "interrupt-reachable":
     For each function G called by F:
       If G not marked: mark G, set changed=true
```

---

### 5.2 Thread-Aware Coalescing

**Source:** KickC (critical)

**Practice:**
- Variables in different "threads" (main + ISR) CANNOT coalesce
- Interrupt handlers are separate thread heads
- Prevents corruption

**Rule:**
```
If function A is reachable from main thread only
And function B is reachable from ISR thread only
Then A.locals and B.locals CANNOT share memory
(Even if they never "call" each other - ISR can interrupt anytime!)
```

---

### 5.3 Recursive Functions in ISR

**Sources:** KickC, Oscar64

**Practice:**
- Functions called from ISR should prefer static allocation
- If recursive, must be marked carefully
- ISR-called recursive functions have special requirements

**Rule:**
```
// This is dangerous!
interrupt fn nmi_handler() {
    update_score();  // If update_score is recursive, it can corrupt itself
}

// Compiler warning:
warning: 'update_score' is recursive and called from interrupt context
  This may cause stack corruption if ISR fires during recursive call
  Consider using static allocation or careful stack management
```

---

## 6. Optimization Best Practices

### 6.1 Multiple Optimization Levels

**Sources:** CC65, KickC, Oscar64

**Practice:**
- Provide different optimization levels
- Let user choose speed vs. compile time vs. size

**Blend65 Levels:**
| Level | Description |
|-------|-------------|
| `-O0` | No optimization (debug) |
| `-O1` | Basic coalescing (default) |
| `-O2` | Aggressive coalescing |
| `-Os` | Optimize for size |
| `-Ocoalesce` | Exhaustive ZP coalescing |

---

### 6.2 Pass Architecture

**Source:** KickC (primary)

**Practice:**
- Separate analysis from allocation
- Clear pass structure
- Easy debugging

**Blend65 Pass Structure:**
```
Pass 1: Parse → AST
Pass 2: Type Check → Typed AST
Pass 3: Build Call Graph
Pass 4: Detect Recursion
Pass 5: Compute Liveness
Pass 6: Frame Allocation
Pass 7: Code Generation
Pass 8: Peephole Optimization
```

---

## 7. Summary: Blend65 Implementation Priorities

### Must Have (P0)
| Practice | Source |
|----------|--------|
| Static allocation by default | Prog8 |
| Zero prologue/epilogue | Prog8/KickC |
| Recursion detection + error | KickC/Oscar64 |
| Register-first parameters | Prog8/Oscar64 |
| Weight-based ZP allocation | Oscar64 |

### Should Have (P1)
| Practice | Source |
|----------|--------|
| Call-graph frame coalescing | KickC |
| ZP Wish system (@zp, @ram) | Prog8 |
| Interrupt safety marking | Oscar64 |
| Thread-aware coalescing | KickC |
| Compile-time validation | CC65 |

### Nice to Have (P2)
| Practice | Source |
|----------|--------|
| Opt-in recursion (`recursive fn`) | KickC |
| Multiple optimization levels | All |
| ZP overflow warnings | KickC |
| Clear pass architecture | KickC |
| Deferred allocation | CC65 |

---

## Conclusion

**The ideal Blend65 SFA combines:**

1. **Prog8's simplicity:** Static-only default, zero overhead
2. **KickC's intelligence:** Coalescing, liveness analysis
3. **Oscar64's automation:** Weight-based ZP, auto-detect
4. **CC65's robustness:** Validation, consistency checks

**Following these best practices will produce an SFA system that is:**
- ✅ Fast (zero call overhead)
- ✅ Memory-efficient (coalescing)
- ✅ User-friendly (clear directives)
- ✅ Safe (recursion detection, interrupt awareness)
- ✅ Debuggable (predictable addresses)

---

**Next Document:** [02-anti-patterns.md](02-anti-patterns.md)