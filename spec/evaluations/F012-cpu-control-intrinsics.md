# F012 — CPU Control Intrinsics

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)

## Description

Blend65 provides a curated set of **13 built-in functions** for 6502 CPU operations that the
language cannot express through normal syntax. Each function compiles to its exact instruction
bytes with no call/helper overhead; BRK includes its mandatory padding byte. These are not “inline
assembly” — they are type-checked, parameterless calls with explicit machine effects.

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
| Hardware stack manipulation | SFA manages frames, but the real stack is still needed for explicit CPU-state work and profile-selected interrupt entry/exit duties |
| Carry/decimal/overflow flags | Language arithmetic handles flags implicitly, but developers sometimes need explicit hardware-state control; deterministic BCD arithmetic uses separate semantic intrinsics |
| NOP | "Waste exactly 2 cycles" has no language expression |
| BRK | A profile-bound synchronous software interrupt has no language expression |

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

These are reserved built-in function identifiers, like `peek` and `poke`. They are not lexical
keywords: `true` and `false` are literals in a different grammar category. Redeclaring any
`asm_*` name is E10212. Calls follow standard function-call syntax and require no import.

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

**Use case**: Exact low-level processor-state control. Normal source uses `bcd_add()` or
`bcd_sub()` for deterministic packed-decimal arithmetic; `asm_sed()` never changes the meaning of
ordinary `+` or `-`.

The compiler tracks D through control flow. E10255 rejects ordinary arithmetic, effective-address
formation, calls, returns/interrupt terminals, and mismatched-D joins reached before `asm_cld()`.
The compiler does not insert hidden CLD/SED instructions around normal source.

Compiler-generated interrupt entries establish binary mode before Blend65 handler code or ordinary
helper calls, preserve the interrupted status across the eventual return or chain, and report the
exact bytes, cycles, and stack cost. An explicit `asm_sed()` inside the handler remains a tracked
raw-state region with the same E10255 boundaries.

### Packed-BCD Arithmetic (2 functions)

| Function | Accepted signatures | Semantic result | Runtime support |
|----------|---------------------|-----------------|-----------------|
| `bcd_add(left, right)` | `(byte, byte): byte`; `(word, word): word` | Packed-decimal sum modulo 100 or 10,000 | Inline only; no linked helper |
| `bcd_sub(left, right)` | `(byte, byte): byte`; `(word, word): word` | Packed-decimal difference modulo 100 or 10,000 | Inline only; no linked helper |

Each operation owns carry: add starts with C=0 and subtract with C=1 (no borrow). A word propagates
carry/no-borrow from its low packed byte to its high byte and discards the final carry/borrow. It
leaves D=0 and gives no language contract for other final flags. E10254 rejects a statically known
operand containing an invalid decimal nibble. Valid constant calls fold; unknown invalid runtime
digits follow the selected CPU's exact bytewise decimal ADC/SBC result, so decimal algebra requires
a proof of valid digits.

The IL operation is explicit rather than an ambient mode on ordinary arithmetic. Lowering normally
uses inline SED, owned CLC/SEC, one or two ADC/SBC steps, and CLD. It may safely coalesce adjacent
operations only when IRQ/NMI paths restore interrupted D state. A target profile that cannot prove
that restoration does not support the operations. Lowering never links a runtime routine.

### Overflow Flag (1 function)

| Function | 6502 Opcode | Bytes | Cycles | Effect |
|----------|-------------|-------|--------|--------|
| `asm_clv()` | `CLV` ($B8) | 1 | 2 | Clear overflow flag |

**Use case**: Establishing a known-clear overflow flag before a low-level platform/ABI operation
whose explicit contract consumes V, or before a carefully controlled signed-arithmetic sequence.

Note: There is no `asm_sev()` because the 6502 has no "set overflow" instruction.

### Timing & Debug (2 functions)

| Function | 6502 Opcode | Bytes | Cycles | Effect |
|----------|-------------|-------|--------|--------|
| `asm_nop()` | `NOP` ($EA) | 1 | 2 | No operation — wastes exactly 2 CPU cycles |
| `asm_brk()` | `BRK` ($00) + `$EA` padding | 2 | 7 to handler entry | Profile-bound synchronous software interrupt |

The CPU opcode is one byte, but it reads and skips the following byte. The compiler therefore emits
an exact `$EA` padding byte after it.

**Use case for NOP**: Cycle-precise timing in raster interrupt handlers. Multiple `asm_nop()` calls create a "NOP sled" for timing alignment. Also used in stable raster techniques.

**Use case for BRK**: Invoke an explicitly configured software-interrupt handler. The hardware does
not promise an emulator monitor or a returning debug service. A reachable call therefore requires
the selected profile's exact handler/control-flow contract (E10259). The compiler does not install
that handler or add runtime code.

## Rules

| ID | Rule | Decision |
|----|------|----------|
| CC-1 | All `asm_*` functions are parameterless | No arguments. Return type is `void`. Standard function call syntax. BCD operations instead use their typed two-operand signatures. |
| CC-2 | CPU controls are valid anywhere a statement is valid | Can be used inside functions, inside `if`/`while`/`for`/`switch` bodies, inside interrupt handlers. BCD operations are ordinary expressions. |
| CC-3 | Register clobber semantics | After an ordinary `asm_*()` call, the compiler assumes **all CPU registers (A, X, Y) and flags may have been modified**. A returning `asm_brk()` instead applies the selected contract's exact preservation/clobber and machine-state effects. |
| CC-4 | Explicit stack state is kind-checked | Control-flow analysis tracks an ordered LIFO sequence of accumulator-save and status-save entries. `asm_pla()`/`asm_plp()` require the matching top kind; joins and backedges require identical sequences; every exit restores the empty relative sequence (E10248). The whole-program peak includes every live push. |
| CC-5 | Raw decimal mode is developer-controlled and compiler-tracked | After `asm_sed()`, every path must reach `asm_cld()` before ordinary arithmetic/address formation, a call, an exit, or a differently-stateful join; E10255 rejects a violation. BCD built-ins manage their own internal decimal state. |
| CC-6 | Cannot be used at module level | Like all statements, asm_*() calls must be inside a function body. E10010 applies. |
| CC-7 | Can be used inside interrupt functions | All 13 functions are valid inside `interrupt function` bodies. |
| CC-8 | Naming convention | All CPU control intrinsics use the `asm_` prefix to distinguish them from language intrinsics (peek, poke, etc.) and user-defined functions. |
| CC-9 | BRK contract and control flow | Reachable `asm_brk()` requires an exact selected-profile contract. It charges three CPU-pushed bytes plus declared handler peak, then either resumes after padding or has no normal successor. The compiler emits no handler/runtime. |

## Ambiguities Resolved

| # | ID | Ambiguity | Resolution |
|---|-----|-----------|------------|
| 1 | CC-A1 | Should the full 6502 instruction set be exposed? | **No.** Only operations the language cannot express. Branches → use `if`/`while`/`for`. Load/store → use variables/peek/poke. Arithmetic → use operators. The language covers 95%+ of instruction use cases. Permanent decision record: **REJ-002**. |
| 2 | CC-A2 | Should `asm { }` blocks be supported? | **No.** Requires an embedded assembler (lexer mode switch, assembly parser, symbol bridge, register negotiation). Enormous compiler complexity for minimal gain over the curated function approach. Permanent decision record: **REJ-002**. |
| 3 | CC-A3 | Should BIT instruction be included? | **No.** `BIT addr` tests bits without modifying A, but the existing volatile `peek(addr) & mask` operation expresses the same source-level test. The minor efficiency difference does not justify a parameterized `asm_*()` API with addressing-mode complexity. Reconsider only if measured code shows that a dedicated zero-cost platform operation is required. |
| 4 | CC-A4 | Register state after asm_*() calls | **Clobber-all.** The compiler treats every asm_*() call as potentially modifying A, X, Y, and all flags. This is pessimistic but safe — the compiler reloads values from memory as needed. In practice, only `asm_pla()` actually modifies A, and flag operations modify specific flags, but "clobber all" keeps the contract simple and future-proof. |
| 5 | CC-A5 | What if asm_sed() is called but asm_cld() is not? | **Path-sensitive compile-time error.** E10255 rejects the first ordinary arithmetic/address/call/exit boundary or mismatched-D join. A raw SED followed by raw barrier operations and a matching CLD remains legal. |
| 6 | CC-A6 | Can asm_*() calls be used in expressions? | **No.** All return `void`. They are statements, not expressions. `let x = asm_nop();` → standard type error (cannot assign void to byte). |
| 7 | CC-A7 | What about 65C02 extensions (WAI, STP)? | **Deferred.** The CX16 uses a 65C02 which has additional instructions like WAI (Wait for Interrupt) and STP (Stop Processor). These can be added as platform-specific intrinsics in a future version, following the same pattern. The core set covers only instructions present on all target CPUs (NMOS 6502 + variants). |
| 8 | CC-A8 | Should asm_*() functions be namespaced? | **No.** The `asm_` prefix is the namespace. `import` is not required: these are reserved built-in function identifiers, always available like `peek` and `poke`; they are not keywords or literals. |
| 9 | CC-A9 | Should `extern function` be supported for linking external assembly? | **Deferred to FUT-011.** For the 1% of code that truly needs hand-written assembly (cycle-counted demo effects, self-modifying code), external linking is the clean solution. Not needed for game development. |
| 10 | CC-A10 | Is `asm_brk()` inherently a debug-only warning? | **No.** Blend65 has no debug/release semantic mode, and BRK is an intentional hardware operation. W10121 is retired. E10259 rejects a reachable call unless the selected profile proves its vector, handler identity, return behavior, stack peak, and machine effects. |

## Code Generation

Each CPU-control function emits its exact opcode bytes:

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

Note: `asm_brk()` emits 2 bytes because the 6502 BRK instruction skips the byte after the opcode
(it pushes PC+2, not PC+1). The compiler pads with `$EA` (NOP). It emits no vector, handler, trap
routine, or support library.

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
| `asm_brk` | 2 | 0 | 0 | 7 to handler entry |

No runtime support routines and no memory allocation are introduced. For `asm_brk()`, the resource
report additionally charges the CPU's three pushed stack bytes plus the selected contract's
maximum handler stack use; handler cycles and effects belong to that contract rather than the
two-byte emission row.

## Examples

### Example 1: Critical Section (Interrupt-Safe Register Update)

```blend65
module Game;

function configureRasterLine(line: byte): void {
    asm_php();                          // Preserve caller's interrupt state
    asm_sei();                          // Keep related VIC writes together
    poke(0xD012, line);                 // Set raster line
    poke(0xD01A, peek(0xD01A) | 0x01); // Enable raster interrupt
    asm_plp();                          // Restore prior status
}
```

Install the handler separately with the compiler-recognized C64 `setIRQ(&handler)` API. That API
performs its atomic vector update and selects the KERNAL CINV entry variant. A raw
`pokew($0314, &handler)` is E10252 because it would install the raw `RTI` entry at a post-save
firmware hook.

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
    score = bcd_add(score, points); // $09 + $01 = $10, not binary $0A
}

function displayScore(): void {
    let tens: byte = (score >> 4) & 0x0F;
    let ones: byte = score & 0x0F;
    // Write digit characters to screen...
    poke(0x0400, tens + 48);   // '0' = 48 in PETSCII
    poke(0x0401, ones + 48);
}
```

**Why a semantic BCD intrinsic is needed**: it gives the compiler the exact width, carry ownership,
digit-validity facts, interrupt constraints, and result semantics needed to emit the same compact
decimal instructions safely. Raw `asm_sed()` remains available for deliberate hardware-state work
but cannot make an ordinary expression context-dependent.

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

The ordinary call-shape errors still use standard type checking. E10248 additionally rejects
control-flow paths whose explicit stack operations cannot preserve a valid function-entry stack
state. The diagnostic identifies the mismatched push span and expected pull kind where applicable,
so a later `RTS` or `RTI` cannot consume corrupted stack state.

- Passing arguments: Standard "expected 0 arguments, got N" error
- Using in expression context: Standard "cannot assign void to type" error  
- Using at module level: E10010 (executable statements not allowed at module level)
- Redeclaring an `asm_*` name: E10212 (reserved built-in)
- Pulling above function entry, pulling the wrong saved kind, joining unequal kind sequences, or
  leaving a nonempty exit sequence: E10248
- Writing a visible raw interrupt entry to a recognized incompatible firmware vector: E10252
- Statically known invalid packed-BCD digit: E10254
- Raw decimal state reaches an ordinary semantic boundary or mismatched join: E10255
- Reachable `asm_brk()` without an exact selected-profile handler/control-flow contract: E10259

## Warnings

W10120 is retired. Its former warning condition is now the compile-time error E10255 because raw
processor state may not silently change ordinary language semantics. W10121 is also retired:
Blend65 has no debug/release semantic mode, and explicit BRK use is governed by its required
profile contract and E10259 instead of an advisory warning.

## Language Guard Verdict

- **P1 Cross-platform compilable** ✅ — All 13 control instructions and decimal `ADC`/`SBC`
  exist on every current selected CPU. A platform may omit a usable BRK handler contract, in which
  case E10259 rejects only the reachable `asm_brk()` call.
- **P2 Platform-meaningful** ✅ — Every platform uses interrupts (SEI/CLI), game scores can use the
  explicit BCD operations, raster effects use NOP timing, and hardware register updates need atomic
  sections.
- **P3 No platform assumptions** ✅ — CPU instruction semantics depend on the selected CPU. BRK's
  active vector, handler, return behavior, stack use, and machine effects come only from the
  selected platform contract rather than a generic debugger assumption.
- **P4 Resource-scalable** ✅ — CPU controls have fixed opcode costs; BCD lowering reports its
  selected inline sequence. Every live explicit push adds one byte to the whole-program
  hardware-stack peak, while a balanced pull removes it. BRK charges three CPU bytes plus the
  exact contracted handler peak.
- **H1 6502 implementable** ✅ — Each CPU control is one instruction. BCD operations use a bounded
  inline decimal `ADC`/`SBC` sequence with no runtime helper.
- **H2 Cost transparency** ✅ — Control costs are exact; BCD costs include operand/result
  materialization and every selected instruction.
- **H3 SFA compatible** ✅ — No linked runtime storage is required. Any lowering temporary is an
  ordinary SFA-owned compiler temporary; BRK adds no SFA home or installed handler.
- **H4 Memory footprint documented** ✅ — A CPU-control call uses 1 byte ROM (2 emitted bytes for
  BRK). BCD sequences and any materialization are reported. Each simultaneously live `PHA`/`PHP`
  consumes one hardware-stack byte until its balancing pull; BRK reports its separate three-byte
  CPU frame and contracted handler peak.
- **H5 Fully deterministic** ✅ — Each instruction has a defined CPU effect. The compiler proves
  the exact explicit-stack kind sequence on every path: E10248 rejects underflow, a wrong-kind
  pull, unequal join/backedge sequences, or a nonempty exit. Valid BCD operands have exact language
  results; runtime-invalid digits are explicitly bound to the selected CPU under HLE-006.
- **L1 Unambiguous syntax** ✅ — `asm_sei()` — standard function call syntax. No parsing ambiguity.
- **L2 Consistent with existing** ✅ — Same syntax as `peek()`, `poke()`, `barrier()`. Same calling convention.
- **L3 Beginner-friendly** ✅ — Function names include the mnemonic. `asm_sei` = "assembly SEI" = "set interrupt disable." Any 6502 developer recognizes it instantly. Non-6502 developers see it's clearly a low-level operation.
- **L4 Minimal feature** ✅ — 13 parameterless void CPU controls plus 2 typed BCD operations. No
  addressing-mode or register-selection API is added.
- **L5 No redundancy** ✅ — CPU controls expose otherwise unavailable state. BCD operations are
  explicit because ordinary arithmetic deliberately remains binary.
- **L6 Error messages defined** ✅ — E10248 owns explicit-stack underflow, wrong-kind pulls,
  unequal join/backedge state, and nonempty exits; E10254 owns invalid constant BCD digits, E10255
  owns raw decimal-state violations, E10259 owns missing BRK contracts, E10212 owns reserved-name
  redeclaration, and standard call/type diagnostics cover other misuse.
- **L7 Compile-time failure preferred** ✅ — Wrong arguments, wrong context, reserved-name
  redeclaration, and unsafe explicit stack state are rejected at compile time. A byte-balanced
  accumulator/status mismatch is still unsafe because it exposes allocator-selected register or
  flag state.
- **L8 Feature interaction documented** ✅ — Ordinary binary arithmetic, explicit BCD, raw decimal
  state, interrupt entry, control flow, and clobber semantics are all distinguished.
- **L9 Documentable with examples** ✅ — Four examples covering all major use patterns: critical sections, NOP timing, BCD arithmetic, flag preservation.
- **C1 Lexer/parser implementable** ✅ — Built-in identifier recognition. Standard function call parsing. No new tokens or grammar rules.
- **C2 Semantic analysis defined** ✅ — CPU controls take 0 parameters and return void. BCD
  intrinsics require matching unsigned widths. The compiler uses a clobber-all register model,
  kind-aware explicit-stack state, path-sensitive D-state validation with E10255, and a
  contract-bound returning/non-returning BRK edge with E10259.
- **C3 Code generation strategy** ✅ — CPU controls use a 13-entry opcode table. Explicit BCD nodes
  lower to owned inline decimal sequences and D-clear exits.
- **C4 Unit testable** ✅ — Test each control opcode plus byte/word BCD values, carry/borrow,
  wrapping, invalid constants, selected-CPU invalid runtime digits, and unsafe raw-D paths.
- **C5 Runtime verifiable** ✅ — CPU-profile tests can check values, flags, interrupt state, stack
  pointer, and exact inline instruction effects.
- **F1 Extensible** ✅ — Future 65C02-specific functions (WAI, STP) follow the same pattern. Platform-specific intrinsics can be added without changing the core set.
- **F2 Platform-profile ready** ✅ — Platform-independent semantics select qualified CPU decimal
  behavior. BRK explicitly consumes the selected platform's handler contract; no vector or device
  assumption is embedded in the language operation.
- **F3 Optimizer-friendly** ✅ — CPU controls are ordered barriers. Explicit BCD nodes retain the
  facts needed for valid constant folding and proof-gated region coalescing.
- **F4 Stability classification** ✅ — **Stable**. These map 1:1 to CPU instructions that haven't changed since 1975.

**Hardware-limitation exception**: HLE-006 governs runtime-invalid packed-BCD digits. It adds no
mandatory checker or runtime support.

**Verdict**: ✅ **ACCEPTED** — 23/23 rules pass without conditions. This is the cleanest feature evaluation in the v3 specification.
