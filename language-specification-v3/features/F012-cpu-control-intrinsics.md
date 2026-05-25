# F012 — CPU Control Intrinsics

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)

## Description

Blend65 provides a curated set of **13 built-in functions** for 6502 CPU operations that the language cannot express through normal syntax. Each function compiles to exactly one 6502 instruction with zero overhead. These are not "inline assembly" — they are type-checked, parameterless function calls that happen to emit a single opcode.

## Design Rationale

### Why not `asm { }` blocks?

An `asm { }` block requires:
- A **lexer mode switch** (assembly uses different tokenization: `#` for immediates, `:` for labels, `;` for comments)
- A **separate parser** (an assembler embedded inside the compiler)
- A **symbol table bridge** (assembly referencing Blend65 variables)
- **Register ownership negotiation** (clobber lists, save/restore contracts)
- **Label scoping rules** (can assembly labels be referenced from Blend65 code?)

This is enormous complexity for the compiler, and the design interactions are treacherous. The v2 analysis identified this as impractical.

### Why not the full 6502 instruction set as `asm_*()` functions?

The v2 spec exposed all 56 opcodes across all addressing modes (~150 functions). This was rejected for v3 because:

1. **Branches are unusable** — `asm_beq_rel(offset)` requires the developer to calculate byte offsets manually, which is impossible without knowing assembled code sizes. But Blend65 already has `if`, `while`, `for`, `switch` for control flow.

2. **Register interference** — `asm_lda_imm(42)` loads A, but the compiler's codegen for the NEXT Blend65 statement may clobber A immediately. There's no register ownership contract between asm_*() calls and compiled code.

3. **Language already covers it** — Load/store → variables + peek/poke. Arithmetic → `+`, `-`, `&`, `|`, `^`, `<<`, `>>`. Comparisons → `==`, `!=`, `<`, `>`. Branches → `if`/`while`/`for`/`switch`. Increment/decrement → `+= 1`, `-= 1`. The language handles 95%+ of what these instructions do.

4. **150 functions for incomplete coverage** — Large API surface, large test surface, yet the result still can't write a tight assembly loop.

### What's left?

Only operations the language **cannot express at all**:

| Category | Why no language equivalent |
|----------|---------------------------|
| Interrupt enable/disable | Pure CPU state — no data operation can do this |
| Hardware stack manipulation | SFA manages frames, but sometimes the real stack is needed (register save/restore, interrupt prologue helper) |
| Carry/decimal/overflow flags | Language arithmetic handles flags implicitly, but developers sometimes need explicit flag control (multi-precision arithmetic, BCD) |
| NOP | "Waste exactly 2 cycles" has no language expression |
| BRK | Software interrupt / debug breakpoint has no language expression |

### Game-level validation

We validated this curated set against three demanding C64 game architectures:

| Game Type | Techniques Used | Covered By |
|-----------|----------------|------------|
| **The Last Ninja** (isometric) | Sprite multiplexing, raster splits, SID music | `interrupt function` + `peek`/`poke` + `asm_sei`/`asm_cli` |
| **Commando** (vertical scroller) | Smooth scrolling, sprite multiplexing, many entities | `poke` for registers, loops for shifts, structs for entities |
| **Giana Sisters** (side-scroller) | Horizontal scroll, physics, platform collision | `poke` for scroll register, `sbyte`/`sword` for physics |

No game technique required cycle-counted inline assembly. The "1% that needs cycle counting" refers to demo-scene effects (FLD, VSP, AGSP, FLI) — not game techniques.

## Syntax

All CPU control intrinsics are parameterless void functions:

```blend65
asm_<mnemonic>();
```

**EBNF:**
```ebnf
cpu_intrinsic_call = cpu_intrinsic_name , "(" , ")" ;
cpu_intrinsic_name = "asm_sei" | "asm_cli" | "asm_pha" | "asm_pla" 
                   | "asm_php" | "asm_plp" | "asm_clc" | "asm_sec" 
                   | "asm_cld" | "asm_sed" | "asm_clv" | "asm_nop" 
                   | "asm_brk" ;
```

These are recognized by the compiler as built-in identifiers (like `peek`, `poke`, `true`, `false`). They follow standard function call syntax — no new grammar rules.

## Complete Function Reference

### Interrupt Control (2 functions)

| Function | 6502 Opcode | Bytes | Cycles | Effect |
|----------|-------------|-------|--------|--------|
| `asm_sei()` | `SEI` ($78) | 1 | 2 | Set interrupt disable flag — maskable interrupts (IRQ) are ignored |
| `asm_cli()` | `CLI` ($58) | 1 | 2 | Clear interrupt disable flag — maskable interrupts are enabled |

**Use case**: Protecting critical sections where interrupt firing would corrupt state (e.g., modifying interrupt vectors, updating multi-byte hardware registers atomically).

### Stack Manipulation (4 functions)

| Function | 6502 Opcode | Bytes | Cycles | Effect |
|----------|-------------|-------|--------|--------|
| `asm_pha()` | `PHA` ($48) | 1 | 3 | Push accumulator onto hardware stack |
| `asm_pla()` | `PLA` ($68) | 1 | 4 | Pull accumulator from hardware stack |
| `asm_php()` | `PHP` ($08) | 1 | 3 | Push processor status register onto hardware stack |
| `asm_plp()` | `PLP` ($28) | 1 | 4 | Pull processor status register from hardware stack |

**Use case**: Saving/restoring CPU state around code that modifies flags, or temporarily preserving the accumulator value when the compiler doesn't need to know about it.

### Carry Flag (2 functions)

| Function | 6502 Opcode | Bytes | Cycles | Effect |
|----------|-------------|-------|--------|--------|
| `asm_clc()` | `CLC` ($18) | 1 | 2 | Clear carry flag |
| `asm_sec()` | `SEC` ($38) | 1 | 2 | Set carry flag |

**Use case**: Multi-precision arithmetic beyond what the compiler generates. For example, chaining 24-bit or 32-bit additions using explicit carry propagation through peek/poke sequences.

### Decimal Mode (2 functions)

| Function | 6502 Opcode | Bytes | Cycles | Effect |
|----------|-------------|-------|--------|--------|
| `asm_cld()` | `CLD` ($D8) | 1 | 2 | Clear decimal mode — arithmetic operates in binary (normal) |
| `asm_sed()` | `SED` ($F8) | 1 | 2 | Set decimal mode — `ADC`/`SBC` operate in BCD |

**Use case**: BCD (Binary-Coded Decimal) arithmetic for score display, timer display, or other human-readable decimal values without needing binary-to-decimal conversion routines.

> ⚠️ **Important**: While decimal mode is active, the compiler's generated code for `+` and `-` operators will produce BCD results instead of binary results. Call `asm_cld()` before resuming normal Blend65 arithmetic. See warning W10120.

### Overflow Flag (1 function)

| Function | 6502 Opcode | Bytes | Cycles | Effect |
|----------|-------------|-------|--------|--------|
| `asm_clv()` | `CLV` ($B8) | 1 | 2 | Clear overflow flag |

**Use case**: Clearing the overflow flag before a `BIT` instruction sequence (via volatile_read and flag testing), or before signed arithmetic where overflow detection matters.

Note: There is no `asm_sev()` because the 6502 has no "set overflow" instruction.

### Timing & Debug (2 functions)

| Function | 6502 Opcode | Bytes | Cycles | Effect |
|----------|-------------|-------|--------|--------|
| `asm_nop()` | `NOP` ($EA) | 1 | 2 | No operation — wastes exactly 2 CPU cycles |
| `asm_brk()` | `BRK` ($00) | 1* | 7 | Software interrupt — pushes PC+2 and status, jumps to IRQ/BRK vector |

*BRK is technically 1 byte but the CPU reads (and skips) the byte after it. The compiler pads with a NOP byte after BRK.

**Use case for NOP**: Cycle-precise timing in raster interrupt handlers. Multiple `asm_nop()` calls create a "NOP sled" for timing alignment. Also used in stable raster techniques.

**Use case for BRK**: Debug breakpoints. When running in an emulator with a monitor, BRK triggers the monitor. In production builds, BRK should not be reachable (the compiler may warn about it in release mode).

## Rules

| ID | Rule | Decision |
|----|------|----------|
| CC-1 | All functions are parameterless | No arguments. Return type is `void`. Standard function call syntax. |
| CC-2 | Valid anywhere a statement is valid | Can be used inside functions, inside `if`/`while`/`for`/`switch` bodies, inside interrupt handlers. |
| CC-3 | Register clobber semantics | After any `asm_*()` call, the compiler assumes **all CPU registers (A, X, Y) and flags may have been modified**. The compiler will reload any values it needs from memory. |
| CC-4 | Push/pull pairing is developer responsibility | The compiler does not track stack balance across `asm_pha()`/`asm_pla()` pairs. Mismatched pushes/pulls cause stack corruption — this is documented behavior, not undefined behavior. |
| CC-5 | Decimal mode is developer responsibility | After `asm_sed()`, the developer must call `asm_cld()` before any Blend65 arithmetic. The compiler emits W10120 to remind developers. |
| CC-6 | Cannot be used at module level | Like all statements, asm_*() calls must be inside a function body. E10010 applies. |
| CC-7 | Can be used inside interrupt functions | All 13 functions are valid inside `interrupt function` bodies. |
| CC-8 | Naming convention | All CPU control intrinsics use the `asm_` prefix to distinguish them from language intrinsics (peek, poke, etc.) and user-defined functions. |

## Ambiguities Resolved

| # | ID | Ambiguity | Resolution |
|---|-----|-----------|------------|
| 1 | CC-A1 | Should the full 6502 instruction set be exposed? | **No.** Only operations the language cannot express. Branches → use `if`/`while`/`for`. Load/store → use variables/peek/poke. Arithmetic → use operators. The language covers 95%+ of instruction use cases. |
| 2 | CC-A2 | Should `asm { }` blocks be supported? | **No.** Requires an embedded assembler (lexer mode switch, assembly parser, symbol bridge, register negotiation). Enormous compiler complexity for minimal gain over the curated function approach. |
| 3 | CC-A3 | Should BIT instruction be included? | **No.** `BIT addr` tests bits without modifying A, but `volatile_read(addr) & mask` achieves the same logical result in 2 instructions instead of 1. The minor efficiency difference doesn't justify adding a parameterized asm_*() function with addressing mode complexity. Deferred to future if real-world code shows a need. |
| 4 | CC-A4 | Register state after asm_*() calls | **Clobber-all.** The compiler treats every asm_*() call as potentially modifying A, X, Y, and all flags. This is pessimistic but safe — the compiler reloads values from memory as needed. In practice, only `asm_pla()` actually modifies A, and flag operations modify specific flags, but "clobber all" keeps the contract simple and future-proof. |
| 5 | CC-A5 | What if asm_sed() is called but asm_cld() is not? | **Documented hazard with compile-time warning.** The compiler emits W10120 at every `asm_sed()` call site. If the developer forgets `asm_cld()`, subsequent Blend65 arithmetic produces BCD results — this is defined behavior (the 6502 does what it does), but likely not what the developer intended. Full control-flow analysis to detect missing `asm_cld()` is deferred as too complex. |
| 6 | CC-A6 | Can asm_*() calls be used in expressions? | **No.** All return `void`. They are statements, not expressions. `let x = asm_nop();` → standard type error (cannot assign void to byte). |
| 7 | CC-A7 | What about 65C02 extensions (WAI, STP)? | **Deferred.** The CX16 uses a 65C02 which has additional instructions like WAI (Wait for Interrupt) and STP (Stop Processor). These can be added as platform-specific intrinsics in a future version, following the same pattern. The core set covers only instructions present on all target CPUs (NMOS 6502 + variants). |
| 8 | CC-A8 | Should asm_*() functions be namespaced? | **No.** The `asm_` prefix IS the namespace. `import` is not required — these are built-in, always available, like `true`, `false`, `peek`, `poke`. |
| 9 | CC-A9 | Should `extern function` be supported for linking external assembly? | **Deferred to FUT-011.** For the 1% of code that truly needs hand-written assembly (cycle-counted demo effects, self-modifying code), external linking is the clean solution. Not needed for game development. |

## Code Generation

Each function emits exactly one byte (the opcode):

```
asm_sei()  →  $78        ; SEI
asm_cli()  →  $58        ; CLI
asm_pha()  →  $48        ; PHA
asm_pla()  →  $68        ; PLA
asm_php()  →  $08        ; PHP
asm_plp()  →  $28        ; PLP
asm_clc()  →  $18        ; CLC
asm_sec()  →  $38        ; SEC
asm_cld()  →  $D8        ; CLD
asm_sed()  →  $F8        ; SED
asm_clv()  →  $B8        ; CLV
asm_nop()  →  $EA        ; NOP
asm_brk()  →  $00 $EA    ; BRK + padding byte
```

Note: `asm_brk()` emits 2 bytes because the 6502 BRK instruction skips the byte after the opcode (it pushes PC+2, not PC+1). The compiler pads with $EA (NOP) to prevent the skipped byte from being misinterpreted.

## Cost Summary

| Function | ROM (bytes) | RAM (bytes) | ZP (bytes) | Cycles |
|----------|-------------|-------------|------------|--------|
| `asm_sei` | 1 | 0 | 0 | 2 |
| `asm_cli` | 1 | 0 | 0 | 2 |
| `asm_pha` | 1 | 0 | 0 | 3 |
| `asm_pla` | 1 | 0 | 0 | 4 |
| `asm_php` | 1 | 0 | 0 | 3 |
| `asm_plp` | 1 | 0 | 0 | 4 |
| `asm_clc` | 1 | 0 | 0 | 2 |
| `asm_sec` | 1 | 0 | 0 | 2 |
| `asm_cld` | 1 | 0 | 0 | 2 |
| `asm_sed` | 1 | 0 | 0 | 2 |
| `asm_clv` | 1 | 0 | 0 | 2 |
| `asm_nop` | 1 | 0 | 0 | 2 |
| `asm_brk` | 2 | 0 | 0 | 7 |

No runtime support routines. No memory allocation. The most cost-efficient feature in the entire language.

## Examples

### Example 1: Critical Section (Interrupt-Safe Register Update)

```blend65
module Game;

function setRasterInterrupt(line: byte, handler: word): void {
    asm_sei();                          // Disable interrupts
    poke(0xD012, line);                 // Set raster line
    pokew(0x0314, handler);             // Set IRQ vector
    poke(0xD01A, peek(0xD01A) | 0x01); // Enable raster interrupt
    asm_cli();                          // Re-enable interrupts
}
```

**Why asm_*() is needed**: Without `asm_sei()`, an interrupt could fire between writing the low and high byte of the vector, causing a jump to a half-updated address — a guaranteed crash.

### Example 2: NOP Sled for Raster Timing

```blend65
module Display;

interrupt function stableRaster(): void {
    // After double-IRQ stabilization, we're at a known cycle position.
    // Align to exact cycle boundary with NOPs:
    asm_nop();
    asm_nop();
    asm_nop();
    
    // Now we're cycle-aligned — set border colors for raster bars
    poke(0xD020, 2);    // Red
    asm_nop();
    asm_nop();
    asm_nop();
    asm_nop();
    asm_nop();
    poke(0xD020, 0);    // Black
}
```

**Why asm_*() is needed**: Each `asm_nop()` wastes exactly 2 cycles. By counting NOPs, the developer controls precisely when the next `poke` executes relative to the raster beam position. No other language feature can express "waste N cycles."

### Example 3: BCD Score Display

```blend65
module Score;

let score: byte = 0;  // BCD-encoded: $00 to $99

function addScore(points: byte): void {
    asm_sed();          // Enter decimal mode
    asm_clc();          // Clear carry for addition
    score = score + points;  // BCD addition! $09 + $01 = $10, not $0A
    asm_cld();          // Back to binary mode — CRITICAL!
}

function displayScore(): void {
    let tens: byte = (score >> 4) & 0x0F;
    let ones: byte = score & 0x0F;
    // Write digit characters to screen...
    poke(0x0400, tens + 48);   // '0' = 48 in PETSCII
    poke(0x0401, ones + 48);
}
```

**Why asm_*() is needed**: `asm_sed()` puts the CPU in BCD mode where `ADC`/`SBC` automatically produce decimal results. This eliminates binary-to-decimal conversion routines. `asm_cld()` returns to normal mode. The compiler cannot generate these mode switches from arithmetic expressions.

### Example 4: Preserving Processor State

```blend65
module Util;

function withSavedFlags(callback: word): void {
    asm_php();          // Save current processor flags (including interrupt state)
    asm_sei();          // Disable interrupts for critical work
    
    // ... critical section ...
    poke(0xD011, peek(0xD011) & 0x7F);  // Modify VIC control register
    
    asm_plp();          // Restore original processor flags
    // If interrupts were enabled before, they're enabled again.
    // If they were already disabled, they stay disabled.
    // No need to track the previous state manually.
}
```

**Why asm_*() is needed**: `asm_php()`/`asm_plp()` saves and restores the entire processor status including the interrupt flag. This is the correct pattern for "disable interrupts, do work, restore previous interrupt state" — rather than unconditionally calling `asm_cli()` which would enable interrupts even if they were already disabled by the caller.

## Errors

This feature introduces **no new error codes**. All asm_*() functions are parameterless and return void — misuse is caught by standard type checking:

- Passing arguments: Standard "expected 0 arguments, got N" error
- Using in expression context: Standard "cannot assign void to type" error  
- Using at module level: E10010 (executable statements not allowed at module level)

## Warnings

| Code | Condition | Message |
|------|-----------|---------|
| W10120 | `asm_sed()` is called | `asm_sed() enables BCD decimal mode — Blend65 arithmetic operators (+, -) will produce BCD results. Call asm_cld() before resuming normal arithmetic` |

## Language Guard Verdict

- **P1 Cross-platform compilable** ✅ — All 13 instructions exist on NMOS 6502, 6502C, and 65C02. Present on every target platform.
- **P2 Platform-meaningful** ✅ — Every platform uses interrupts (SEI/CLI), game scores use BCD (SED/CLD), raster effects use NOP timing, hardware register updates need atomic sections.
- **P3 No platform assumptions** ✅ — These are CPU instructions, not platform hardware. No addresses, chip names, or platform names in the definitions.
- **P4 Resource-scalable** ✅ — 1 byte per call on all platforms. No resource scaling concerns.
- **H1 6502 implementable** ✅ — Each function IS a 6502 instruction. Trivially implementable.
- **H2 Cost transparency** ✅ — Perfect cost transparency. 1 function = 1 instruction = documented cycle count. The most predictable feature in the language.
- **H3 SFA compatible** ✅ — No memory allocation. CPU state operations only.
- **H4 Memory footprint documented** ✅ — 1 byte ROM per call (2 for BRK). 0 RAM. 0 ZP. Documented in cost table above.
- **H5 Fully deterministic** ✅ — Each instruction has a defined effect per the MOS 6502 datasheet. Stack underflow from mismatched PHA/PLA is documented behavior (pulls whatever byte is on the stack).
- **L1 Unambiguous syntax** ✅ — `asm_sei()` — standard function call syntax. No parsing ambiguity.
- **L2 Consistent with existing** ✅ — Same syntax as `peek()`, `poke()`, `barrier()`. Same calling convention.
- **L3 Beginner-friendly** ✅ — Function names include the mnemonic. `asm_sei` = "assembly SEI" = "set interrupt disable." Any 6502 developer recognizes it instantly. Non-6502 developers see it's clearly a low-level operation.
- **L4 Minimal feature** ✅ — 13 functions, all parameterless, all void. No addressing modes, no register selection, no operands. The absolute minimum to cover operations the language can't express.
- **L5 No redundancy** ✅ — Each function does something no other language feature can do. No overlap with operators, control flow, or memory intrinsics.
- **L6 Error messages defined** ✅ — No feature-specific errors needed. Standard type checking covers all misuse. One warning (W10120) for BCD mode.
- **L7 Compile-time failure preferred** ✅ — All errors caught at compile time (wrong arguments, wrong context). The only runtime concern (mismatched push/pull) is documented.
- **L8 Feature interaction documented** ✅ — Interactions with arithmetic (BCD mode), with interrupt functions (valid inside handlers), with control flow (valid in all blocks), and register clobber semantics all documented.
- **L9 Documentable with examples** ✅ — Four examples covering all major use patterns: critical sections, NOP timing, BCD arithmetic, flag preservation.
- **C1 Lexer/parser implementable** ✅ — Built-in identifier recognition. Standard function call parsing. No new tokens or grammar rules.
- **C2 Semantic analysis defined** ✅ — Type check: 0 parameters, void return. Clobber-all register model. W10120 on asm_sed().
- **C3 Code generation strategy** ✅ — `emit(opcode)`. The simplest codegen in the entire compiler. Opcode table has 13 entries.
- **C4 Unit testable** ✅ — 13 test cases, each verifying one byte of output. Edge case: asm_brk() emits 2 bytes.
- **C5 Runtime verifiable** ✅ — Run in emulator, check CPU flags / interrupt state / stack pointer after each call.
- **F1 Extensible** ✅ — Future 65C02-specific functions (WAI, STP) follow the same pattern. Platform-specific intrinsics can be added without changing the core set.
- **F2 Platform-profile ready** ✅ — No platform variation. These are CPU-universal.
- **F3 Optimizer-friendly** ✅ — Treated as optimization barriers (clobber-all). The optimizer knows not to reorder across these calls or eliminate them.
- **F4 Stability classification** ✅ — **Stable**. These map 1:1 to CPU instructions that haven't changed since 1975.

**Escape Hatches Applied**: None.

**Verdict**: ✅ **ACCEPTED** — 23/23 rules pass without conditions. This is the cleanest feature evaluation in the v3 specification.
