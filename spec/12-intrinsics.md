# Chapter 12 — CPU Control & Memory Intrinsics

> **Version**: 4.0
> **Status**: draft  
> **Stability**: stable  
> **Source**: F012, F020

---

## 1. Overview

Blend65 provides three categories of built-in functions (intrinsics) that bridge the gap between the type-safe language and the raw 6502 hardware:

- **CPU control intrinsics** (5 functions) — each compiles to its exact 6502 instruction with no
  linked helper. They expose only interrupt-mask control, status save/restore, and exact NOP timing.
- **Packed-BCD arithmetic intrinsics** (2 functions) — deterministic unsigned decimal addition and subtraction, lowered inline without a linked runtime.
- **Memory intrinsics** (9 functions) — direct memory access, byte extraction, and compile-time size queries. These bridge the type system and memory-mapped I/O.

There are no inline assembly blocks, external assembly functions, parameterized opcode calls, or
source-visible compiler registers. The backend still uses every legal instruction for the selected
CPU; the five-name limit applies only to source code.

---

## 2. CPU Control Intrinsics

### 2.1 Syntax

All CPU control intrinsics are parameterless void functions:

```ebnf
cpu_intrinsic_call = cpu_intrinsic_name , "(" , ")" ;
cpu_intrinsic_name = "asm_sei" | "asm_cli" | "asm_php" | "asm_plp"
                   | "asm_nop" ;
```

### 2.2 Complete Reference

#### Interrupt Control

| Function | Opcode | Bytes | Cycles | Exact effect |
|----------|--------|-------|--------|--------------|
| `asm_sei()` | `SEI` (`$78`) | 1 | 2 | Sets I. Maskable IRQ recognition is disabled; NMI is unaffected. A, X, Y, S, N, V, D, Z, C, and memory are preserved. |
| `asm_cli()` | `CLI` (`$58`) | 1 | 2 | Clears I. Maskable IRQ recognition is enabled according to the selected CPU's instruction-boundary rules; NMI is unaffected. A, X, Y, S, N, V, D, Z, C, and memory are preserved. |
| `asm_php()` | `PHP` (`$08`) | 1 | 3 | Writes represented P with B and bit 5 set to the page-one hardware stack, then decrements S. Registers and live flags are preserved. |
| `asm_plp()` | `PLP` (`$28`) | 1 | 4 | Increments S, reads one status-save byte, and restores N, V, D, I, Z, and C. B is not a persistent processor flag. A, X, Y, and other memory are preserved. |
| `asm_nop()` | `NOP` (`$EA`) | 1 | 2 | Advances PC and consumes exactly two CPU cycles without changing registers, flags, stack, or data memory. |

`asm_php()` adds one explicit status-save entry to the current function's relative hardware-stack
state; `asm_plp()` removes the top status-save entry. E10248 rejects a pull below the function-entry
state, unequal status-save depths at a reachable join or loop backedge, or a nonempty status-save
state at any exit. Caller entries, return addresses, interrupt frames, and compiler-generated ABI
saves are separate and cannot be consumed by source. Every live status save contributes one byte to
the whole-program stack peak. The analysis adds no instructions or SFA storage.

Every CPU-control call is an ordered machine effect. The compiler emits the named instruction
exactly once and never removes, combines, duplicates, or reorders it. It may preserve facts about
registers and flags that the exact instruction does not modify. `asm_nop()` is also a timing effect,
so surrounding work cannot move across it.

### 2.3 CPU Control Rules

| Rule | Decision |
|------|----------|
| CC-1: Parameters | None. Return type is `void`. |
| CC-2: Valid locations | Anywhere a statement is valid (function bodies, control flow blocks, interrupt handlers) |
| CC-3: Machine effects | The compiler applies the exact effects in §2.2; it does not invent a clobber-all boundary or expose hidden register communication. |
| CC-4: No expressions | `asm_*()` is a statement, not an expression. Cannot appear inside an expression. |
| CC-5: Optimization | Compiler must **never** reorder, remove, or combine `asm_*()` calls. They are opaque barriers. |
| CC-6: Closed surface | Every other `asm_*` spelling is an ordinary unresolved name. Inline assembly, external assembly functions, and parameterized opcode calls are not language forms. |

### 2.4 Example: Critical Section

```blend65
function storeSharedWord(addr: word, value: word): void {
    asm_php();                    // preserve the caller's interrupt state
    asm_sei();                    // prevent IRQ between the two byte stores
    pokew(addr, value);
    asm_plp();                    // restore the prior processor status
}
```

Do not use a raw `pokew` helper to install a compiler-declared interrupt function into a known
firmware vector. For example, `$0314/$0315` is the C64 KERNAL CINV hook after KERNAL has saved
A/X/Y; `pokew($0314, &handler)` is E10252 on that profile. Use the compiler-recognized platform
installer so it selects the matching entry/exit ABI (→ Ch 06, §7.7).

### 2.5 Packed-BCD Arithmetic

```blend65
bcd_add(left: byte, right: byte): byte
bcd_add(left: word, right: word): word
bcd_sub(left: byte, right: byte): byte
bcd_sub(left: word, right: word): word
```

The operands must have the same unsigned width. Signed operands and mixed-width calls use the
ordinary E10172 argument-type diagnostic. A byte holds two packed decimal digits (`$00`–`$99`); a
word holds four digits as two packed bytes (`$0000`–`$9999`). Addition begins with carry clear and
subtraction begins with carry set (no incoming borrow). Word operations process the low byte first
and propagate carry/no-borrow into the high byte. The final carry/borrow is discarded, so results
wrap modulo 100 or 10,000. The operations leave D clear; final processor flags are not a
language-visible result.

If any statically known operand contains a nibble `$A`–`$F`, E10254 rejects it. Two valid constant
operands fold at compile time. For an invalid runtime digit, the result is the selected CPU's exact
bytewise decimal ADC/SBC result for the defined carry sequence; the optimizer must not apply
decimal algebra unless digit validity is proven.

The semantic IL carries a distinct BCD-add/subtract operation, width, validity facts, and complete
flag effects. Normal lowering emits an inline `SED`, owned `CLC` or `SEC`, one or two decimal
`ADC`/`SBC` steps, and `CLD`. It adds no helper or linked runtime. Adjacent BCD operations may share
a decimal region only when doing so preserves the same owned carry at each operation, contains no
call or ordinary arithmetic/address formation, and remains safe across every possible IRQ/NMI
path. Every conforming target profile must guarantee that an asynchronous path restores the
interrupted D state before execution resumes; a profile that cannot do so does not support these
operations. Lowering never links a routine.

### 2.6 Example: BCD Score Display

```blend65
function addBCDScore(points: byte): void {
    let bcdScore: byte = peek($0400);
    let newScore: byte = bcd_add(bcdScore, points);
    poke($0400, newScore);
}
```

---

## 3. Memory Intrinsics

### 3.1 Memory Access

The table reports only the selected absolute memory-access instruction core. It excludes argument
materialization, result storage, and any runtime-address pointer setup. The examples immediately
below show complete constant-address sequences where those surrounding instructions are present.

| Function | Signature | Effect | Cycles | ROM |
|----------|-----------|--------|--------|-----|
| `peek(addr)` | `(word): byte` | Read byte from address | 4 | 3 bytes |
| `poke(addr, val)` | `(word, byte): void` | Write byte to address | 4 | 3 bytes |
| `peekw(addr)` | `(word): word` | Read 16-bit word (little-endian) | 8 | 6 bytes |
| `pokew(addr, val)` | `(word, word): void` | Write 16-bit word (little-endian) | 8 | 6 bytes |

```blend65
let bgColor: byte = peek($D021);         // read VIC-II background color
poke($D021, 0);                           // set background to black
let vector: word = peekw($0314);          // read IRQ vector (2 bytes)
pokew($C000, $1234);                      // ordinary little-endian RAM write
```

**Code generation:**

```asm
; peek($D021)
LDA $D021           ; 4 cycles, 3 bytes

; poke($D021, 0)
LDA #$00
STA $D021           ; complete sequence: 6 cycles, 5 bytes

; peekw($0314)
LDA $0314           ; low byte
LDX $0315           ; high byte — 8 cycles, 6 bytes

; pokew($C000, $1234)
LDA #$34
STA $C000
LDA #$12
STA $C001           ; 12 cycles, 10 bytes including immediate loads
```

**Address selection:** When the address is a compile-time constant, the compiler uses zero-page or
absolute addressing directly as appropriate. A runtime address uses indirect addressing through one
compiler-owned two-byte zero-page pair. That pair is invocation-private scratch: SFA accounts for
its lifetime, may overlay it only with non-interfering storage, and separates it across overlapping
mainline/IRQ/NMI domains. It is not a hidden runtime or an uncharged fixed reservation.

All four memory-access intrinsics are volatile. Arguments evaluate exactly once from left to right;
the access then occurs exactly once in source order relative to every other volatile access, call,
and CPU-control effect. Runtime addresses are ordinary legal `word` expressions. The compiler may
optimize address calculation and storage allocation when those observable rules remain unchanged.

### 3.2 Byte Extraction

| Function | Signature | Effect | Cost |
|----------|-----------|--------|------|
| `lo(value)` | `(word): byte` | Extract low byte of 16-bit value | 0 cycles (compile-time if const) |
| `hi(value)` | `(word): byte` | Extract high byte of 16-bit value | 0 cycles (compile-time if const) |

```blend65
let addr: word = $D020;
let lowByte: byte = lo(addr);    // $20
let highByte: byte = hi(addr);   // $D0
```

When applied to compile-time constants, `lo()` and `hi()` are resolved at compile time (zero runtime cost).

### 3.3 Size and Element-Count Queries

| Function | Signature | Effect | Cost |
|----------|-----------|--------|------|
| `sizeof(Type)` | `(type): word` | Byte size of a type | 0 (compile-time) |
| `offsetof(Type, field)` | `(type, field): word` | Byte offset of struct field | 0 (compile-time) |
| `length(arrayExpr)` | `(array expression): word` | Full element count; compile-time for fixed arrays, caller-supplied for any-size parameters | 0 for fixed arrays; one word load for any-size parameters |

```blend65
const ENEMY_SIZE: word = sizeof(Enemy);           // 5
const HP_OFFSET: word = offsetof(Enemy, hp);      // 2
const TABLE_LEN: word = length(SINE_TABLE);       // 256 requires word
```

`sizeof()` and `offsetof()` are pure compile-time operations. `length()` is also compile-time for a
fixed array, but an any-size parameter reads its caller-supplied word count at runtime and is not a
constant expression in that context. The valid fixed-object domain is `0..65535` bytes and the
valid array-count domain is `0..65535` elements. `sizeof(T[])` is rejected because an unsized array
has no standalone fixed extent.

**`length()` details** → Ch 08, §9.

---

## 4. Diagnostic Conditions

This chapter owns intrinsic-specific predicates. General call arity and argument typing use the
function diagnostics; Chapter 14 owns every public template.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10171 | An intrinsic receives the wrong number of arguments. | The call is rejected. |
| E10172 | An intrinsic argument has an incompatible type. | The call is rejected. |
| E10248 | Control-flow analysis finds `asm_plp()` below function entry, unequal status-save depths at a reachable join/backedge, or a nonempty status-save state on exit. | The containing function is rejected because its entry stack state is not preserved. |
| E10252 | A visible raw interrupt-entry address is written directly to a recognized firmware vector that requires another entry ABI. | The write is rejected; use the profile installer that selects the correct entry variant. |
| E10254 | A statically known packed-BCD operand contains a nibble from `$A` through `$F`. | The BCD operation is rejected; use a valid packed-decimal value. |

---

## 5. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Expressions** (→ Ch 04) | Memory and BCD intrinsics appear in expression position. CPU-control intrinsics are statements only. Ordinary arithmetic remains binary regardless of D/C. `sizeof` and `offsetof` are compile-time; `length` folds only for fixed arrays and otherwise reads an any-size parameter's carried word count. |
| **Functions** (→ Ch 06) | The five `asm_*()` calls are valid inside function bodies. The compiler preserves their exact machine effects and ordering. |
| **Interrupts** (→ Ch 06, §7) | Recognized platform installers own atomic vector updates and entry-variant selection. `asm_php()`/`asm_plp()` may save and restore status inside a handler, but they do not replace or consume the selected ABI's stack entries. |
| **Type system** (→ Ch 02) | `peek()` returns `byte`. `peekw()` returns `word`. `poke()` accepts any byte-compatible type (including enums via implicit widening). BCD operations require matching unsigned byte/word operands and return that same width. |
| **Enums** (→ Ch 09) | Enum values widen to `byte` for `poke()`. `peek()` returns `byte` — use `EnumName(peek(...))` to narrow back. |
| **Platform profile** (→ Ch 15) | Encoding intrinsics (`petscii()`, `screen_codes()`, etc.) are platform-specific. CPU-control and memory syntax is shared; instruction legality and interrupt timing still follow the selected CPU/profile. |
