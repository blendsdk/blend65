# Chapter 12 — CPU Control & Memory Intrinsics

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F012, F020

---

## 1. Overview

Blend65 provides three categories of built-in functions (intrinsics) that bridge the gap between the type-safe language and the raw 6502 hardware:

- **CPU control intrinsics** (13 functions) — each compiles to its exact 6502 instruction bytes
  with no linked helper. These handle operations the language cannot express: interrupt control,
  hardware stack manipulation, CPU flag management, timing, and software interrupts.
- **Packed-BCD arithmetic intrinsics** (2 functions) — deterministic unsigned decimal addition and subtraction, lowered inline without a linked runtime.
- **Memory intrinsics** (9 functions) — direct memory access, byte extraction, and compile-time size queries. These bridge the type system and memory-mapped I/O.

There are no `asm { }` blocks in Blend65 v3. The curated intrinsic set covers all game development needs without the compiler complexity of embedded assembly (→ F012 design rationale).

---

## 2. CPU Control Intrinsics

### 2.1 Syntax

All CPU control intrinsics are parameterless void functions:

```ebnf
cpu_intrinsic_call = cpu_intrinsic_name , "(" , ")" ;
cpu_intrinsic_name = "asm_sei" | "asm_cli" | "asm_pha" | "asm_pla"
                   | "asm_php" | "asm_plp" | "asm_clc" | "asm_sec"
                   | "asm_cld" | "asm_sed" | "asm_clv" | "asm_nop"
                   | "asm_brk" ;
```

### 2.2 Complete Reference

#### Interrupt Control

| Function | Opcode | Bytes | Cycles | Effect |
|----------|--------|-------|--------|--------|
| `asm_sei()` | `SEI` | 1 | 2 | Set interrupt disable — maskable IRQs ignored |
| `asm_cli()` | `CLI` | 1 | 2 | Clear interrupt disable — maskable IRQs enabled |

#### Stack Manipulation

| Function | Opcode | Bytes | Cycles | Effect |
|----------|--------|-------|--------|--------|
| `asm_pha()` | `PHA` | 1 | 3 | Push accumulator onto hardware stack |
| `asm_pla()` | `PLA` | 1 | 4 | Pull accumulator from hardware stack |
| `asm_php()` | `PHP` | 1 | 3 | Push processor status onto hardware stack |
| `asm_plp()` | `PLP` | 1 | 4 | Pull processor status from hardware stack |

The compiler tracks a LIFO sequence of explicit stack-entry kinds through control flow:
`asm_pha()` pushes an accumulator-save entry, while `asm_php()` pushes a status-save entry.
`asm_pla()` may consume only the top accumulator-save entry, and `asm_plp()` may consume only the
top status-save entry. Every reachable join and loop backedge must have the same kind sequence, and
every ordinary or interrupt exit must restore the empty sequence relative to that activation's
entry (E10248). Thus nested `PHA; PHP; PLP; PLA` is legal, while `PHA; PLP` is rejected even though
its byte depth balances.

Each callee and interrupt handler starts with its own empty relative explicit-stack sequence.
Caller-held entries, call return addresses, automatic interrupt bytes, and compiler-generated ABI
saves remain separately owned and cannot be consumed by source intrinsics. The whole-program stack
peak includes all of them. This analysis adds no runtime code or SFA storage. The operations remain
ordered machine effects and may not be removed, reordered, or paired across incompatible control
flow.

#### Carry Flag

| Function | Opcode | Bytes | Cycles | Effect |
|----------|--------|-------|--------|--------|
| `asm_clc()` | `CLC` | 1 | 2 | Clear carry flag |
| `asm_sec()` | `SEC` | 1 | 2 | Set carry flag |

#### Decimal Mode

| Function | Opcode | Bytes | Cycles | Effect |
|----------|--------|-------|--------|--------|
| `asm_cld()` | `CLD` | 1 | 2 | Clear decimal mode (binary arithmetic) |
| `asm_sed()` | `SED` | 1 | 2 | Set the processor's decimal flag for raw `ADC`/`SBC` use |

Ordinary Blend65 arithmetic never changes meaning with the processor's decimal or carry flags.
`+`, `-`, `+=`, and `-=` always have the binary fixed-width semantics from Chapters 02 and 04.
`asm_sed()` is a literal expert hardware-state escape; it does not turn those operators into BCD.
The compiler tracks D through control flow. E10255 rejects a path that reaches ordinary
arithmetic, effective-address formation, a call, a return/interrupt terminal, or a join with a
different D state before `asm_cld()`. It never inserts a hidden CLD/SED pair to repair source.

Compiler-generated interrupt entries are a deliberate ABI boundary: they establish binary mode
before the first Blend65 handler statement or ordinary helper call, preserve the interrupted
status, and charge the exact entry cost. An explicit `asm_sed()` inside a handler starts a new raw
decimal-state region and retains the same E10255 boundaries.

#### Overflow Flag

| Function | Opcode | Bytes | Cycles | Effect |
|----------|--------|-------|--------|--------|
| `asm_clv()` | `CLV` | 1 | 2 | Clear overflow flag |

No `asm_sev()` — the 6502 has no "set overflow" instruction.

#### Timing & Debug

| Function | Opcode | Bytes | Cycles | Effect |
|----------|--------|-------|--------|--------|
| `asm_nop()` | `NOP` | 1 | 2 | No operation — waste exactly 2 cycles |
| `asm_brk()` | `BRK` + `$EA` padding | 2 | 7 to handler entry | Profile-bound synchronous software interrupt |

`asm_brk()` exposes the CPU operation; it does not define a debugger, monitor, trap service, or
runtime. The compiler emits only `$00 $EA`. The padding byte is mandatory because an NMOS
6502-family `BRK` pushes the address after that byte.

A reachable call is legal only when the selected platform profile supplies an exact `brk_contract`
(→ Ch 15). The contract identifies the active vector and handler, declares whether the handler
returns with `RTI` to the instruction after the padding byte or never returns, and records every
register, flag, memory, banking, and MMIO requirement/effect. E10259 rejects the call when that
proof is absent.

Whole-program stack analysis always charges the CPU's three pushed bytes (return PC high, return PC
low, and status) plus the contract's maximum additional handler stack use. A returning contract
adds a successor after the padding byte and applies its declared preserved/clobbered state there. A
non-returning contract has no normal successor. The compiler never installs a handler or vector,
injects a catch path, or links support code for `asm_brk()`.

### 2.3 CPU Control Rules

| Rule | Decision |
|------|----------|
| CC-1: Parameters | None. Return type is `void`. |
| CC-2: Valid locations | Anywhere a statement is valid (function bodies, control flow blocks, interrupt handlers) |
| CC-3: Register clobber | After an ordinary `asm_*()` call, compiler assumes **all registers (A, X, Y) and flags may be modified**. A returning `asm_brk()` applies the exact preservation, clobber, and machine effects from its required profile contract. |
| CC-4: No expressions | `asm_*()` is a statement, not an expression. Cannot appear inside an expression. |
| CC-5: Optimization | Compiler must **never** reorder, remove, or combine `asm_*()` calls. They are opaque barriers. |
| CC-6: BRK contract | A reachable `asm_brk()` requires the selected profile's exact BRK control-flow, stack, and machine-effect contract; otherwise E10259. |

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
| E10171 | A CPU-control intrinsic receives any argument, or another intrinsic receives the wrong number. | The call is rejected. |
| E10172 | An intrinsic argument has an incompatible type. | The call is rejected. |
| E10248 | Control-flow analysis finds an explicit pull below function entry, a pull of the wrong saved kind, unequal kind sequences at a reachable join/backedge, or a nonempty sequence on exit. | The containing function is rejected because its entry stack state is not preserved. |
| E10252 | A visible raw interrupt-entry address is written directly to a recognized firmware vector that requires another entry ABI. | The write is rejected; use the profile installer that selects the correct entry variant. |
| E10254 | A statically known packed-BCD operand contains a nibble from `$A` through `$F`. | The BCD operation is rejected; use a valid packed-decimal value. |
| E10255 | An `asm_sed()` path reaches an ordinary arithmetic/address/call/exit boundary or a control-flow join with a different decimal state before `asm_cld()`. | The containing function is rejected; raw decimal state may not change ordinary language semantics. |
| E10259 | A reachable `asm_brk()` has no exact BRK contract in the selected platform profile. | Compilation is rejected because BRK control flow, stack use, and machine effects cannot be proved. |

W10121 is retired. Blend65 defines no debug/release build distinction, and an explicit low-level
operation is not itself suspicious. The required profile contract and E10259 provide the safety
boundary.

---

## 5. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Expressions** (→ Ch 04) | Memory and BCD intrinsics appear in expression position. CPU-control intrinsics are statements only. Ordinary arithmetic remains binary regardless of D/C. `sizeof` and `offsetof` are compile-time; `length` folds only for fixed arrays and otherwise reads an any-size parameter's carried word count. |
| **Functions** (→ Ch 06) | `asm_*()` calls are valid inside function bodies. The compiler's register allocation treats them as opaque barriers (CC-3). |
| **Interrupts** (→ Ch 06, §7) | Recognized platform installers own atomic vector updates and entry-variant selection. Explicit stack intrinsics remain available inside handlers, but they do not replace or duplicate the selected ABI's register-save contract. |
| **Type system** (→ Ch 02) | `peek()` returns `byte`. `peekw()` returns `word`. `poke()` accepts any byte-compatible type (including enums via implicit widening). BCD operations require matching unsigned byte/word operands and return that same width. |
| **Enums** (→ Ch 09) | Enum values widen to `byte` for `poke()`. `peek()` returns `byte` — use `EnumName(peek(...))` to narrow back. |
| **Platform profile** (→ Ch 15) | Encoding intrinsics (`petscii()`, `screen_codes()`, etc.) are platform-specific. CPU control and memory syntax is shared, but reachable `asm_brk()` additionally requires an exact target `brk_contract`. |
