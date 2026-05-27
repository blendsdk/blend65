# Blend65 v3 — Future Considerations

> **Created**: May 25, 2026  
> **Purpose**: Living document tracking features explicitly deferred from v3 for potential inclusion in future versions.  
> **Rule**: Items are added here when a design decision consciously defers functionality. Each item records what was deferred, why, and under what conditions it should be reconsidered.

---

## How to Use This Document

- When a feature evaluation defers functionality (e.g., "not in v3 — keep it minimal"), add an entry here.
- Each entry has a **source** (the feature evaluation that created it), a **description**, and **reconsideration criteria**.
- Items are NOT promises — they are candidates for future evaluation against the Language Guard.

---

## Deferred Items

### FUT-001: Address-of on struct fields and array elements

> **Source**: F006 (Address-of Operator), Ambiguity AO-4  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: Allow `&myStruct.field` and `&buffer[5]` to return the memory address of a struct field or array element.

**Why deferred**: Keeps the `&` operator minimal in v3 (Language Guard L4). Computing field/element addresses can be done manually with `&variable + offset`, which works in all cases.

**Reconsideration criteria**:
- Real-world Blend65 code frequently needs field/element addresses
- A clean syntax exists that doesn't introduce pointer arithmetic ambiguities
- The codegen cost is predictable and documented

---

### FUT-002: Address-of on function parameters

> **Source**: F006 (Address-of Operator), Ambiguity AO-3  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow `&param` inside a function to get the address of a parameter.

**Why deferred**: In SFA, parameters have static addresses, so this is technically safe. However, it's confusing — the parameter's address is a compiler implementation detail, and exposing it encourages fragile code patterns. Simpler to copy the parameter to a local variable and take `&local`.

**Reconsideration criteria**:
- Compelling use case where copying to a local is insufficient
- Clear semantics that don't confuse beginners

---

### FUT-003: Typed function pointers (interrupt vs. regular)

> **Source**: F007 (Interrupt Functions), Ambiguity INT-2  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: Distinguish between `&regularFunction` and `&interruptFunction` at the type level, so that platform library functions like `setIRQ()` can only accept interrupt function addresses.

**Why deferred**: Requires a function pointer type system (e.g., `type IRQHandler = interrupt () => void;`). This is significant complexity for v3. In v3, `&anyFunction` returns `word` — the developer is responsible for only installing `interrupt` functions as handlers.

**Reconsideration criteria**:
- Users frequently make the mistake of installing non-interrupt functions as handlers
- A minimal type system for function pointers can be designed without excessive complexity
- The feature passes the full Language Guard evaluation

---

### FUT-004: Compile-time call-graph analysis for interrupt reentrancy

> **Source**: F007 (Interrupt Functions), Ambiguity INT-1  
> **Deferred from**: v3  
> **Priority**: High

**What**: The compiler analyzes the call graph and emits a warning/error when a function is reachable from both the main code path AND an interrupt handler. This would detect SFA reentrancy hazards at compile time.

**Why deferred**: Requires the compiler to build and analyze a complete call graph, distinguishing "main path" from "interrupt path." This is a significant compiler feature. In v3, the hazard is documented — the developer must avoid calling shared functions from interrupt handlers.

**Reconsideration criteria**:
- The SFA call graph is already computed for frame allocation (may be low incremental cost)
- Users report reentrancy bugs that are hard to diagnose
- The analysis can be implemented without false positives

---

### FUT-005: Platform library type-safety for interrupt installation

> **Source**: F007 (Interrupt Functions), Ambiguity INT-2  
> **Deferred from**: v3 (depends on FUT-003)  
> **Priority**: Medium

**What**: Platform library functions like `setIRQ(&handler)` enforce at the type level that only `interrupt` functions can be passed. Currently, any `word` is accepted.

**Why deferred**: Depends on typed function pointers (FUT-003). Without a function pointer type, the platform library can only accept `word`, and the type system cannot distinguish interrupt from regular function addresses.

**Reconsideration criteria**:
- FUT-003 (typed function pointers) is implemented
- Platform library design is mature enough to define type-safe APIs

---

### FUT-006: Labeled `break` for nested loops

> **Source**: F008 (For Loop), Ambiguity FOR-16  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow `break label;` to exit multiple nested loops at once, where a label is attached to an outer loop:

```blend65
outer: for (let y: byte = 0 to 25) {
    for (let x: byte = 0 to 40) {
        if (condition) {
            break outer;    // exits both loops
        }
    }
}
```

**Why deferred**: In v3, multi-level exit is handled with a flag variable (`let found = false; ... if (found) { break; }`). This is explicit, works everywhere, and doesn't require new syntax. Labeled `break` is a convenience feature — it saves a few lines but adds grammar complexity (label declarations, label scoping rules).

**Reconsideration criteria**:
- Real-world Blend65 code frequently uses deeply nested loops with multi-level exit
- A clean label syntax is designed that doesn't conflict with other language features
- The codegen cost is minimal (labeled break compiles to a single JMP, same as regular break)

---

### FUT-007: Range cases in switch statements

> **Source**: F009 (Switch Statement), Ambiguity SW-10  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow range expressions in switch case values:

```blend65
switch (score) {
    case 0..9:
        showRankF();
    case 10..49:
        showRankC();
    case 50..89:
        showRankB();
    case 90..100:
        showRankA();
}
```

**Why deferred**: Adds grammar complexity (`..` range operator in case context), requires the compiler to expand ranges into value sets or generate range-check code (CMP + BCS/BCC patterns). The same functionality can be achieved with `if/else if` chains or multiple comma-separated values. Keeping switch minimal in v3 (Language Guard L4).

**Reconsideration criteria**:
- Real-world Blend65 code frequently switches on value ranges (score tiers, ASCII character classes, etc.)
- A clean `..` range syntax is designed that doesn't conflict with other language features
- The codegen can efficiently generate range checks (CMP low / BCC skip / CMP high+1 / BCS skip — 8 bytes per range)
- Interaction with `fallthrough` is clearly defined

---

### ~~FUT-008: Const struct parameters~~ — ✅ RESOLVED

> **Source**: F011 (Structs), Rule SR-3  
> **Resolved in**: F014 (Arrays, Strings, and Const Parameters), Part 5  
> **Resolution date**: May 26, 2026

**What was deferred**: `const` qualifier on struct/array parameters for read-only by-reference access.

**How it was resolved**: The `const` parameter modifier was implemented as part of F014 (rules CP-1 through CP-5). It applies to both arrays and structs. F011's SR-3 has been retroactively updated to support `const` parameters instead of requiring mutable copies. Error codes E10122 (const-to-mutable) and E10123 (modify const param) are defined in F014.

---

### FUT-009: Address-of on struct fields

> **Source**: F011 (Structs), Ambiguity SR-A5  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: Allow `&player.hp` to return the address of a specific struct field. For module-level structs, the address is compile-time constant. For by-reference parameters, requires runtime address calculation.

**Why deferred**: Overlaps with FUT-001. For by-reference struct parameters, computing `&(param.field)` requires runtime pointer arithmetic. In v3, developers can use `&struct + offset` with `sizeof` for manual calculation.

**Reconsideration criteria**:
- FUT-001 is implemented (address-of on sub-expressions)
- Common enough pattern in real-world code to justify compiler support
- Runtime address calculation cost is documented and acceptable

---

### FUT-010: Struct return values

> **Source**: F011 (Structs), Rule SR-2  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow functions to return struct types: `function createEnemy(): Enemy`. The compiler would copy the struct from the function's frame to the caller's destination.

**Why deferred**: Requires hidden byte copying from callee frame to caller, which has non-transparent cost (violates H2 and A4). The by-reference parameter pattern achieves the same result explicitly.

**Reconsideration criteria**:
- A syntax is designed that makes the copy cost explicit (e.g., `let e: Enemy = createEnemy();` clearly assigns)
- The compiler can optimize out the copy in common cases (return value optimization / RVO)
- Community feedback indicates the by-reference parameter pattern is too verbose

---

### FUT-011: External assembly linking (`extern function`)

> **Source**: F012 (CPU Control Intrinsics), Ambiguity CC-A9  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow declaring functions implemented in external assembly files, enabling Blend65 programs to call hand-written assembly routines:

```blend65
extern function fastClear(addr: word, count: byte): void;
extern function rasterEffect(): void;
```

The assembly is written in a real assembler (KickAssembler, ca65, DASM) and linked with the Blend65 compiler output.

**Why deferred**: Requires a linker, a defined binary/object format, a calling convention specification, and external tool dependency. The curated `asm_*()` intrinsics + language features + memory intrinsics cover all game development needs without external assembly. The only use cases that genuinely require hand-written assembly are demo-scene effects (FLD, VSP, AGSP, FLI) — cycle-counted techniques not used in commercial games.

**Reconsideration criteria**:
- Real-world Blend65 users need cycle-counted assembly sequences (demo scene, advanced raster effects)
- A simple object format and calling convention can be defined
- A linker can be implemented without excessive complexity
- The feature passes the full Language Guard evaluation

---

### FUT-012: Array copy intrinsic

> **Source**: F014 (Arrays), Gap 7  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: A built-in `copy(dst, src, count)` intrinsic for bulk memory copying between arrays:

```blend65
copy(screenBuffer, backBuffer, 1000);  // Copy 1000 bytes
```

**Why deferred**: Developers can use an explicit for loop to copy array elements. The loop approach is transparent (H2) and works for all cases. A `copy()` intrinsic would be an optimization — the compiler could use an optimized unrolled loop or page-aligned strategy. Not essential for v3's minimum viable language.

**Reconsideration criteria**:
- Real-world Blend65 code frequently copies arrays (sprite data, screen buffers, level maps)
- The compiler can recognize the copy-loop pattern and optimize it automatically
- A clean intrinsic design exists that handles overlapping source/destination correctly

---

### FUT-013: Compile-time table generation

> **Source**: F014 (Arrays), Gap 8  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow compile-time expressions to generate const array contents:

```blend65
// Future syntax (TBD):
const SINE: byte[256] = comptime { [byte(128 + 127 * sin(i * 2 * PI / 256)) for i in 0..256] };
```

**Why deferred**: Requires a compile-time expression evaluator with math functions (sin, cos, etc.). In v3, lookup tables are hand-written or generated by an external tool and pasted into source. This is adequate for the initial release.

**Reconsideration criteria**:
- Community demand for programmatically generated lookup tables
- A clean compile-time expression syntax is designed
- The evaluator can be implemented without adding significant compiler complexity
- The feature passes the full Language Guard evaluation

---

### FUT-014: Manual alignment attribute

> **Source**: F015 (Data Inclusion), Deferred Items  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: A language-level attribute to specify memory alignment for any `const` data declaration, not just embedded assets:

```blend65
// Future syntax (TBD):
@align(256)
const SINE_TABLE: byte[256] = [0, 3, 6, 9, ...];

@align(64)
const SPRITE_DATA: byte[192] = [0x00, 0x7E, 0x00, ...];
```

**Why deferred**: In v3, alignment is handled automatically by format handlers for embedded assets (F015). For hand-written data, the linker/platform profile can handle placement. Adding a general alignment attribute requires designing an attribute syntax system (which v3 doesn't have) and defining how it interacts with all declaration types. The `@` symbol was explicitly removed from v3 to resolve the v2 overloading problem, so a new attribute syntax would need careful design.

**Reconsideration criteria**:
- Real-world Blend65 code frequently needs aligned hand-written tables (page-aligned lookup tables for performance)
- An attribute syntax is designed that doesn't reintroduce the v2 `@` ambiguity
- The feature passes the full Language Guard evaluation
- Interaction with `zeropage`, `let`, and `const` is fully specified

---

### FUT-015: Common image format conversion

> **Source**: F015 (Data Inclusion), Deferred Items  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Automatic conversion of modern image formats (PNG, BMP) to platform-native graphics data via format handlers:

```blend65
// Future: compiler converts PNG to C64 multicolor bitmap
const BITMAP: byte[8000] = embed("picture.png").bitmap;
const SCREEN: byte[1000] = embed("picture.png").screen;
```

**Why deferred**: Image conversion is complex (color quantization, dithering, palette mapping) and error-prone. Retro developers already use specialized tools (SpritePad, CharPad, Koala Painter, etc.) that produce optimized output. Adding image conversion to the compiler would duplicate functionality that dedicated tools do better. The format handler system (F015) already supports these native formats directly.

**Reconsideration criteria**:
- Community demand for a streamlined "modern art → retro platform" pipeline
- Well-defined, deterministic conversion algorithms exist for each platform's graphics modes
- The conversion quality is acceptable (no surprising artifacts)
- The feature can be implemented as a format handler plugin without changing the core compiler

---

### FUT-016: Stack-free calling convention (`--no-stack-calls`)

> **Source**: F018 (Functions), Ambiguity FN-A7, FN-A8  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: An alternative calling convention that eliminates all hardware stack usage for function calls by replacing JSR/RTS with JMP-threaded calls using static return address variables.

**How it works**: Since SFA guarantees no recursion, each function can only be "active" once at a time. The compiler allocates a 2-byte static "return address" variable per function. The caller stores the return point address into this variable and uses `JMP` instead of `JSR`. The callee uses `JMP (return_addr)` or a self-modifying `JMP $0000` to return:

```asm
; Standard JSR/RTS (current v3):
  JSR _foo          ; 6 cycles, 2 bytes on hardware stack
  ; ...
_foo:
  ; ... body ...
  RTS               ; 6 cycles, pops 2 bytes from stack

; Stack-free JMP-threaded (FUT-016):
  LDA #<(.ret)      ; 2 cycles
  STA foo_ret_lo    ; 4 cycles
  LDA #>(.ret)      ; 2 cycles
  STA foo_ret_hi    ; 4 cycles
  JMP _foo          ; 3 cycles — total: 15 cycles, 0 stack bytes
.ret:
_foo:
  ; ... body ...
  JMP (foo_ret)     ; 5 cycles — total: 20 cycles, 0 stack bytes
```

**Tradeoffs**:

| Aspect | JSR/RTS (v3 default) | JMP-threaded (FUT-016) |
|--------|---------------------|------------------------|
| Stack usage per call | 2 bytes | 0 bytes |
| Static RAM per function | 0 bytes | 2 bytes |
| Call overhead | 12 cycles | ~20 cycles |
| Code size per call site | 3 bytes | ~11 bytes |
| JMP indirect bug (NMOS 6502) | N/A | Must avoid page boundary |

**Hybrid strategy**: The compiler could choose per-function:
- Single-caller functions → JMP threading with hardcoded return (zero overhead)
- Tail calls → `JMP` instead of `JSR` (zero additional stack)
- Multi-caller functions → JSR/RTS (simplest, fastest)

**Why deferred**: JSR/RTS is faster, smaller, and the standard approach. Typical game code uses 10-30 bytes of the 256-byte hardware stack — well within budget. The stack-free approach is only valuable for extreme cases (very deep call chains, interrupt-heavy code on Atari 7800 with 4KB RAM).

**Reconsideration criteria**:
- Real-world Blend65 programs encounter stack overflow issues
- Profiling shows that stack-free calling improves performance for specific game patterns
- The JMP indirect page-boundary bug can be reliably worked around in codegen
- A clean `--no-stack-calls` compiler flag can be implemented without changing language semantics

---

## Summary Table

| ID | Description | Priority | Depends On |
|----|-------------|----------|------------|
| FUT-001 | `&` on struct fields / array elements | Medium | — |
| FUT-002 | `&` on function parameters | Low | — |
| FUT-003 | Typed function pointers | Medium | — |
| FUT-004 | Call-graph reentrancy analysis | High | — |
| FUT-005 | Type-safe interrupt installation | Medium | FUT-003 |
| FUT-006 | Labeled `break` for nested loops | Low | — |
| FUT-007 | Range cases in switch statements | Low | — |
| ~~FUT-008~~ | ~~Const struct parameters~~ — ✅ RESOLVED (F014) | — | — |
| FUT-009 | Address-of on struct fields | Medium | FUT-001, F011 |
| FUT-010 | Struct return values | Low | F011 |
| FUT-011 | External assembly linking (`extern function`) | Low | F012 |
| FUT-012 | Array copy intrinsic (`copy()`) | Medium | F014 |
| FUT-013 | Compile-time table generation | Low | F014 |
| FUT-014 | Manual alignment attribute | Medium | F015 |
| FUT-015 | Common image format conversion | Low | F015 |
| FUT-016 | Stack-free calling convention (`--no-stack-calls`) | Medium | F018 |
