# SFA Compiler Comparison Matrix

> **Document**: synthesis/00-comparison-matrix.md
> **Purpose**: Feature-by-feature comparison across CC65, KickC, Oscar64, and Prog8
> **Created**: 2025-02-01
> **Status**: Complete

## Executive Summary

This document synthesizes findings from four 6502 compilers to inform Blend65's Stack Frame Allocation (SFA) design.

**Key Finding:** Each compiler makes different trade-offs:

| Compiler    | Philosophy                    | Key Innovation                                |
| ----------- | ----------------------------- | --------------------------------------------- |
| **CC65**    | C compatibility first         | Optional `--static-locals`, proven fastcall   |
| **KickC**   | SSA + aggressive optimization | Frame coalescing via liveness analysis        |
| **Oscar64** | Dual calling conventions      | Weight-based ZP, automatic fastcall detection |
| **Prog8**   | Simplicity over features      | Zero stack frames, 100% static                |

---

## 1. Stack/Frame Model Comparison

### 1.1 Stack Architecture

| Feature                | CC65                | KickC               | Oscar64                | Prog8             |
| ---------------------- | ------------------- | ------------------- | ---------------------- | ----------------- |
| **Stack Type**         | Software + Hardware | Software + Hardware | Software + Hardware    | **Hardware ONLY** |
| **Software Stack**     | c_sp in ZP          | Similar ZP pointer  | BC_REG_STACK in ZP     | **NONE**          |
| **Default Allocation** | Stack (dynamic)     | Static (PHI_CALL)   | Fastcall (auto-detect) | **Static**        |
| **Frame Pointer**      | c_sp + Y offset     | Not applicable      | BC_REG_LOCALS          | **NONE**          |

### 1.2 Frame Size Limits

| Feature            | CC65                  | KickC             | Oscar64                   | Prog8                 |
| ------------------ | --------------------- | ----------------- | ------------------------- | --------------------- |
| **Max Frame Size** | 255 bytes (Y-indexed) | No limit (static) | 4096 bytes (configurable) | **No limit (static)** |
| **Frame Overflow** | Silently wraps        | Compiler error    | Linker error              | **Compiler error**    |
| **Frame Reuse**    | None                  | Via coalescing    | None                      | **N/A**               |

### 1.3 Recursion Support

| Feature                | CC65                 | KickC                    | Oscar64              | Prog8           |
| ---------------------- | -------------------- | ------------------------ | -------------------- | --------------- |
| **Recursion Allowed**  |  Yes                 | � Opt-in (`__stackcall`) |  Auto-detected       | L **Never**     |
| **Detection Method**   | N/A (always allowed) | Call graph DFS           | Call graph DFS       | N/A (forbidden) |
| **Recursive Handling** | Stack frames         | Stack frames             | Stackcall convention | Compile error   |
| **Mutual Recursion**   |  Supported           | � Detected, stackcall    |  Detected, stackcall | L Error         |

### 1.4 Frame Management

| Operation          | CC65         | KickC         | Oscar64           | Prog8        |
| ------------------ | ------------ | ------------- | ----------------- | ------------ |
| **Prologue**       | `jsr decspN` | None (static) | None or `tsx/stx` | **None**     |
| **Epilogue**       | `jsr incspN` | None (static) | None or restore   | **None**     |
| **Entry Overhead** | 20-30 cycles | 0 cycles      | 0-20 cycles       | **0 cycles** |
| **Exit Overhead**  | 20-30 cycles | 0 cycles      | 0-20 cycles       | **0 cycles** |

---

## 2. Zero Page Allocation Comparison

### 2.1 ZP Strategy

| Feature               | CC65                | KickC                 | Oscar64                  | Prog8                  |
| --------------------- | ------------------- | --------------------- | ------------------------ | ---------------------- |
| **Allocation Type**   | Manual (`register`) | Automatic + coalesce  | Automatic (weight-based) | Automatic (wish-based) |
| **Allocation Timing** | Compile-time        | Pass 4 (post-SSA)     | GlobalAnalyzer phase     | Code generation        |
| **Priority Basis**    | User declaration    | Liveness + coalescing | **useCount � weight**    | ZP wish enum           |
| **Usage Analysis**    | L None              |  Liveness-based       |  Weight-based            | L **Alphabetical!**    |

### 2.2 ZP Size Allocation

| Type         | CC65      | KickC                  | Oscar64                   | Prog8           |
| ------------ | --------- | ---------------------- | ------------------------- | --------------- |
| **Pointers** | 2 bytes   | 2 bytes, high priority | 2 bytes, **0x800 weight** | 2 bytes         |
| **Bytes**    | 1 byte    | 1 byte                 | 1 byte, **0x100 weight**  | 1 byte          |
| **Words**    | 2 bytes   | 2 bytes                | 2 bytes, **0x80 weight**  | 2 bytes         |
| **Floats**   | Not in ZP | Rarely in ZP           | Not in ZP                 | **Never in ZP** |

### 2.3 ZP User Control

| Feature         | CC65               | KickC            | Oscar64           | Prog8              |
| --------------- | ------------------ | ---------------- | ----------------- | ------------------ |
| **Force ZP**    | `register` keyword | `__zp` attribute | Auto + hints      | `REQUIRE_ZEROPAGE` |
| **Prefer ZP**   | N/A                | N/A              | N/A               | `PREFER_ZEROPAGE`  |
| **Forbid ZP**   | N/A                | N/A              | N/A               | `NOT_IN_ZEROPAGE`  |
| **Reserved ZP** | Fixed platform     | Configurable     | Platform-specific | Platform-specific  |

### 2.4 ZP Coalescing

| Feature              | CC65   | KickC                  | Oscar64 | Prog8 |
| -------------------- | ------ | ---------------------- | ------- | ----- |
| **Coalescing**       | L None |  **Aggressive**        | L None  | L N/A |
| **Algorithm**        | N/A    | Live range equivalence | N/A     | N/A   |
| **Call-Graph Aware** | N/A    |  Yes                   | N/A     | N/A   |
| **Exhaustive Mode**  | N/A    | `-Ocoalesce` option    | N/A     | N/A   |

---

## 3. Parameter Passing Comparison

### 3.1 Calling Conventions

| Convention     | CC65           | KickC             | Oscar64         | Prog8         |
| -------------- | -------------- | ----------------- | --------------- | ------------- |
| **Default**    | Stack          | PHI_CALL (static) | Fastcall (auto) | **Static**    |
| **Fast Path**  | `__fastcall__` | PHI_CALL          | Fastcall        | Register opt  |
| **Stack Path** | Standard       | `__stackcall`     | Stackcall       | **None**      |
| **Variadic**   | Stack only     | Not supported     | Stackcall       | Not supported |

### 3.2 Parameter Location

| Location       | CC65           | KickC                | Oscar64            | Prog8            |
| -------------- | -------------- | -------------------- | ------------------ | ---------------- |
| **First byte** | A (fastcall)   | ZP static            | BC_REG_FPARAMS+0   | **A register**   |
| **First word** | A/X (fastcall) | ZP static            | BC_REG_FPARAMS+0,1 | **AY registers** |
| **Subsequent** | Stack          | ZP static            | ZP or stack        | **Static vars**  |
| **Overflow**   | Stack          | Stack (if stackcall) | Stack              | **Static vars**  |

### 3.3 Register Usage

| Register      | CC65                | KickC          | Oscar64        | Prog8             |
| ------------- | ------------------- | -------------- | -------------- | ----------------- |
| **A**         | Last param / return | Variable       | Param / temp   | Param / return    |
| **X**         | Last param / return | Variable       | Param / temp   | Stack ops         |
| **Y**         | Stack offset        | Variable       | Param / temp   | Param / temp      |
| **Stack (S)** | Hardware stack      | Hardware stack | Hardware stack | **Hardware ONLY** |

### 3.4 Return Values

| Size       | CC65     | KickC     | Oscar64  | Prog8        |
| ---------- | -------- | --------- | -------- | ------------ |
| **Byte**   | A        | A         | A        | **A**        |
| **Word**   | A/X      | A/X or ZP | A/X      | **AY**       |
| **Long**   | A/X + ZP | ZP static | Stack/ZP | **AXY**      |
| **Struct** | ZP/Stack | ZP static | Stack    | **ZP/Stack** |

---

## 4. Memory Management Comparison

### 4.1 Memory Sections

| Section  | CC65         | KickC    | Oscar64  | Prog8            |
| -------- | ------------ | -------- | -------- | ---------------- |
| **Code** | CODE segment | code     | code     | prog8_code       |
| **Data** | DATA/RODATA  | data     | data     | prog8_data       |
| **BSS**  | BSS segment  | bss      | bss      | BSS, BSS_NOCLEAR |
| **ZP**   | ZEROPAGE seg | zeropage | zeropage | zeropage         |

### 4.2 Memory Reuse

| Feature              | CC65    | KickC               | Oscar64 | Prog8         |
| -------------------- | ------- | ------------------- | ------- | ------------- |
| **Static Reuse**     | L None  |  **Via coalescing** | L None  | L None        |
| **Call-Graph Reuse** | L       |  **Yes!**           | L       | L             |
| **Temp Sharing**     | Limited |  Via equivalence    | Limited |  Scratch regs |
| **Struct Reuse**     | L       | Limited             | L       | L             |

### 4.3 Float Handling

| Feature           | CC65          | KickC   | Oscar64       | Prog8                    |
| ----------------- | ------------- | ------- | ------------- | ------------------------ |
| **Float Support** | Library-based | Limited | Library-based | **Built-in (BASIC ROM)** |
| **Float Storage** | RAM           | RAM     | RAM           | **RAM + constant pool**  |
| **Float in ZP**   | L             | L       | L             | L                        |

---

## 5. Interrupt Safety Comparison

### 5.1 Interrupt Handling

| Feature         | CC65      | KickC                   | Oscar64              | Prog8            |
| --------------- | --------- | ----------------------- | -------------------- | ---------------- |
| **ISR Support** | Manual    | Thread-aware coalescing | `DTF_INTERRUPT` flag | Manual           |
| **Reentrant**   | � Careful | � STACK_CALL only       | � Stackcall only     | L **Never safe** |
| **Propagation** | Manual    |  Automatic              |  `CheckInterrupt()`  | Manual           |

### 5.2 Thread Safety

| Feature                 | CC65   | KickC              | Oscar64      | Prog8      |
| ----------------------- | ------ | ------------------ | ------------ | ---------- |
| **Thread Model**        | Single | Multi-thread aware | Single + ISR | **Single** |
| **Coalesce Safety**     | N/A    |  Thread-checked    | N/A          | N/A        |
| **ISR Variable Safety** | Manual |  Automatic         |  Flag-based  | Manual     |

---

## 6. Optimization Capabilities

### 6.1 Analysis Passes

| Analysis           | CC65  | KickC          | Oscar64 | Prog8 |
| ------------------ | ----- | -------------- | ------- | ----- |
| **Call Graph**     | L     |  Comprehensive |  Basic  | L     |
| **Liveness**       | L     |  Full          | Limited | L     |
| **Use-Def Chains** | L     |  SSA-based     | Limited | L     |
| **Dead Code**      | Basic |  SSA-based     | Basic   | Basic |

### 6.2 Optimization Levels

| Feature              | CC65               | KickC         | Oscar64       | Prog8      |
| -------------------- | ------------------ | ------------- | ------------- | ---------- |
| **Configurable**     | `-O`, `-Os`, `-Oi` | `-O*` options | `-O*` options | Limited    |
| **Inlining**         | Manual             |  Automatic    |  Automatic    |  Automatic |
| **Constant Folding** |                    |               |               |            |
| **Peephole**         |                    |               |               |            |

---

## 7. Summary: Best Practices by Feature

### 7.1 Stack Model

- **Best:** Prog8's zero-stack approach for simplicity
- **Best for Recursion:** Oscar64's auto-detect fastcall/stackcall
- **Most Flexible:** KickC's opt-in `__stackcall`

### 7.2 Zero Page

- **Best Algorithm:** Oscar64's weight-based priority (pointers > small ints > large)
- **Best Reuse:** KickC's liveness-based coalescing
- **Best UX:** Prog8's ZP Wish system (REQUIRE/PREFER/FORBID)

### 7.3 Parameters

- **Best Register Use:** Prog8's 1-byte�A, 1-word�AY convention
- **Best Fallback:** Oscar64's automatic fastcall/stackcall detection
- **Best Compatibility:** CC65's standards-based calling convention

### 7.4 Memory Management

- **Best Reuse:** KickC's call-graph-based coalescing
- **Best Simplicity:** Prog8's static-everything model
- **Best Compatibility:** CC65's section-based layout

### 7.5 Interrupt Safety

- **Best:** KickC's thread-aware coalescing
- **Good:** Oscar64's propagation-based marking
- **Simplest:** Prog8 (just don't call from ISRs)

---

## 8. Recommendation Matrix for Blend65

| Feature                        | Recommended Source    | Implementation Priority |
| ------------------------------ | --------------------- | ----------------------- |
| **Default Static Allocation**  | Prog8                 | HIGH                    |
| **Opt-in Recursion**           | KickC (`__stackcall`) | MEDIUM                  |
| **Weight-based ZP Priority**   | Oscar64               | HIGH                    |
| **ZP Wish System**             | Prog8                 | HIGH                    |
| **Frame Coalescing**           | KickC                 | MEDIUM                  |
| **Register Params (1-2 args)** | Prog8/Oscar64         | HIGH                    |
| **Recursion Detection**        | KickC/Oscar64 (DFS)   | HIGH                    |
| **Interrupt Propagation**      | Oscar64               | MEDIUM                  |
| **Call Graph Analysis**        | KickC                 | HIGH                    |

---

## 9. Detailed Feature Decision Matrix

### For Blend65 God-Level SFA:

| Decision                              | Adopt From | Rationale                             |
| ------------------------------------- | ---------- | ------------------------------------- |
| **No stack frames by default**        | Prog8      | Fastest, simplest, fits game dev      |
| **`recursive fn` keyword**            | KickC      | Clear opt-in for rare recursion needs |
| **ZP weight = useCount � typeWeight** | Oscar64    | Proven effective priority             |
| **REQUIRE/PREFER_ZP directives**      | Prog8      | Best developer experience             |
| **Call-graph coalescing**             | KickC      | Maximum memory reuse                  |
| **Interrupt safety propagation**      | Oscar64    | Simple and effective                  |
| **A/AY register params**              | Prog8      | Fast for common cases                 |
| **Static fallback for overflow**      | Prog8      | Predictable behavior                  |

---

## Summary

**The ideal Blend65 SFA combines:**

1. **Prog8's Simplicity:** Static-only default, zero call overhead
2. **KickC's Intelligence:** Liveness analysis, call-graph coalescing
3. **Oscar64's Automation:** Weight-based ZP, auto-detect recursive
4. **Best UX:** Prog8's wish system + clear `recursive` keyword

**This synthesis forms the foundation for Phase 6: God-Level SFA Design.**

---

**Next Document:** [01-best-practices.md](01-best-practices.md)
