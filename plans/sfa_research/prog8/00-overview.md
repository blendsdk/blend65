# Prog8 SFA Analysis: Overview

> **Document**: prog8/00-overview.md
> **Parent**: [Phase 4 Execution Plan](../99d-phase4-prog8.md)
> **Status**: Complete
> **Key Finding**: Prog8 uses **STATIC-ONLY allocation** - NO stack frames!

## Executive Summary

**Prog8 takes a radically different approach from all other compilers analyzed:**

| Feature | CC65/KickC/Oscar64 | Prog8 |
|---------|-------------------|-------|
| Frame allocation | Software stack | **NONE** |
| Parameters | Stack or ZP fastcall | **Static variables** |
| Locals | Stack frame | **Static variables** |
| Recursion | Supported | **NOT SUPPORTED** |
| Complexity | High | **Minimal** |

**Prog8 trades recursion capability for extreme simplicity and speed.**

---

## Architecture Overview

### 1. Compiler Pipeline

```
Prog8 Source → AST → Intermediate (Kotlin) → AsmGen6502 → 64tass Assembly
```

### 2. Key Code Generation Files

| File | Purpose |
|------|---------|
| `AsmGen.kt` | Main assembly generator, orchestrates all |
| `VariableAllocator.kt` | ZP and static variable allocation |
| `FunctionCallAsmGen.kt` | Function call code generation |
| `ProgramAndVarsGen.kt` | Program structure and variable layout |
| `AssignmentAsmGen.kt` | Assignment statement generation |

### 3. Variable Storage Model

```
┌─────────────────────────────────────────────────────────┐
│                    ZERO PAGE ($00-$FF)                  │
├─────────────────────────────────────────────────────────┤
│  P8ZP_SCRATCH_B1    - Temp byte                        │
│  P8ZP_SCRATCH_REG   - Temp register save               │
│  P8ZP_SCRATCH_W1/W2 - Temp words                       │
│  P8ZP_SCRATCH_PTR   - Temp pointer                     │
│  [User ZP Variables] - Based on ZP wish                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              STATIC RAM (Main Memory)                   │
├─────────────────────────────────────────────────────────┤
│  Block-level variables (initialized at startup)         │
│  Subroutine parameters (static per-sub)                 │
│  Subroutine locals (static per-sub)                     │
│  Arrays and strings                                     │
│  Float constants (pooled globally)                      │
└─────────────────────────────────────────────────────────┘
```

---

## The "No Stack" Philosophy

### Why No Stack Frames?

Prog8 was designed for **game development on retro platforms** where:
1. **Recursion is rarely needed** - Game loops are iterative
2. **Speed is critical** - Stack manipulation is slow on 6502
3. **Simplicity aids debugging** - Variables have fixed addresses
4. **Memory is predictable** - No stack growth concerns

### Trade-offs

| Advantage | Disadvantage |
|-----------|--------------|
| Zero call overhead | No recursion |
| Predictable memory | Re-entrancy impossible |
| Fast parameter access | Larger code for some patterns |
| Simple debugging | Can't implement recursive algorithms |

---

## VariableAllocator Analysis

### ZP Wish System

Variables declare their ZP preference:

```kotlin
enum class ZeropageWish {
    REQUIRE_ZEROPAGE,  // Must be in ZP, error if not
    PREFER_ZEROPAGE,   // Try ZP first, fallback to RAM
    NOT_IN_ZEROPAGE,   // Never use ZP
    DONTCARE           // Allocate wherever convenient
}
```

### Allocation Priority

```
1. REQUIRE_ZEROPAGE variables → Error if ZP full
2. PREFER_ZEROPAGE variables → Silent fallback to RAM
3. DONTCARE integer/bool/pointer → Fill remaining ZP
4. Everything else → Static RAM
```

### Current Limitation (from source code)

```kotlin
// TODO some form of intelligent priorization? 
// most often used variables first? loopcounter vars first? ...?
```

**Prog8 currently lacks usage-based prioritization** - variables are sorted alphabetically!

---

## Function Call Model

### Parameter Passing

**Two mechanisms:**

#### 1. CPU Register Optimization (1-2 simple args)

```kotlin
// 1 byte param → A register
// 1 word param → AY registers  
// 2 byte params → A and Y registers
```

#### 2. Static Variable Assignment (all other cases)

```kotlin
// Parameters become static variables:
val varName = sub.scopedName + "." + parameter.name
assignExpressionToVariable(value, varName, parameter.type)
```

### Code Generation Example

**Prog8 source:**
```
sub add(ubyte a, ubyte b) -> ubyte {
    return a + b
}
```

**Generated assembly:**
```asm
add .proc
    ; Parameters in static locations:
    ;   add.a = ubyte
    ;   add.b = ubyte
    
    lda  add.a
    clc
    adc  add.b
    rts
    
    .section BSS
add.a   .byte ?
add.b   .byte ?
    .send BSS
.pend
```

### Call Site

```asm
; add(5, 3)
lda  #5
sta  add.a    ; Store to static parameter variable
lda  #3
sta  add.b    ; Store to static parameter variable  
jsr  add      ; No stack manipulation needed!
; Result in A
```

---

## Memory Layout (ProgramAndVarsGen)

### Program Structure

```asm
; Header and entry point
prog8_program_start
    cld
    tsx
    stx  prog8_lib.orig_stackpointer  ; Save for sys.exit()
    jsr  p8_sys_startup.init_system
    jsr  p8_sys_startup.init_system_phase2
    jsr  p8b_main.p8s_start
    jmp  p8_sys_startup.cleanup_at_exit

; Block definitions
p8b_main .proc
    ; Block-level variables
    ; Subroutines
.pend

; BSS sections (cleared at startup)
.section BSS
    ; Uninitialized variables
.send BSS

; Initialized data
; Arrays, strings, floats
```

### Variable Sections

| Section | Purpose |
|---------|---------|
| `BSS` | Uninitialized variables (cleared to 0) |
| `BSS_NOCLEAR` | Subroutine temporaries (initialized before use) |
| `BSS_SLABS` | Memory slabs |
| `STRUCTINSTANCES` | Struct instances |

---

## Key Insights for Blend65

### What Prog8 Gets Right

1. **Simplicity** - No complex frame management
2. **Speed** - Zero overhead for function calls
3. **Predictability** - Memory layout is deterministic
4. **ZP Wish System** - User control over allocation

### What Prog8 Sacrifices

1. **Recursion** - Impossible with static allocation
2. **Re-entrancy** - Interrupts can't safely call same function
3. **Flexibility** - Some algorithms require recursion
4. **Dynamic Allocation** - Fixed at compile time

### Hybrid Approach for Blend65?

Consider offering **both models**:

```
// Default: Static allocation (Prog8 style)
sub simple_function(a: byte, b: byte): byte { ... }

// Opt-in: Stack allocation (for recursion)
recursive sub factorial(n: byte): word { ... }
```

---

## Comparison with Other Compilers

| Aspect | CC65 | KickC | Oscar64 | Prog8 |
|--------|------|-------|---------|-------|
| Default Model | Stack | Static+ZP | Fastcall/Stackcall | Static |
| Recursion | Yes | Limited | Yes (detected) | No |
| ZP Usage | Limited | Aggressive | Weight-based | Wish-based |
| Frame Coalescing | No | Yes | No | N/A |
| Complexity | High | High | High | **Low** |

---

## Related Documents

- [Variable Allocator](01-variable-allocator.md) - ZP allocation details
- [Function Calls](02-function-calls.md) - Parameter passing details
- [Memory Layout](03-memory-layout.md) - Program structure
- [Strengths](05-strengths.md) - What Prog8 does well
- [Weaknesses](06-weaknesses.md) - Limitations and gaps

---

## Source Files Analyzed

```
/sfa_learning/prog8/codeGenCpu6502/src/prog8/codegen/cpu6502/
├── AsmGen.kt                 (1800+ lines)
├── VariableAllocator.kt      (~100 lines)
├── FunctionCallAsmGen.kt     (~300 lines)
├── ProgramAndVarsGen.kt      (~700 lines)
└── assignment/               (Assignment handling)
```