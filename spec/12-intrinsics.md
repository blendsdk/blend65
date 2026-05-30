# Chapter 12 — CPU Control & Memory Intrinsics

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F012, F020

---

## 1. Overview

Blend65 provides two categories of built-in functions (intrinsics) that bridge the gap between the type-safe language and the raw 6502 hardware:

- **CPU control intrinsics** (13 functions) — each compiles to exactly one 6502 opcode with zero overhead. These handle operations the language cannot express: interrupt control, hardware stack manipulation, CPU flag management, timing, and debug.
- **Memory intrinsics** (9 functions) — direct memory access, byte extraction, and compile-time size queries. These bridge the type system and memory-mapped I/O.

There are no `asm { }` blocks in Blend65 v3. The curated intrinsic set covers all game development needs without the compiler complexity of embedded assembly (→ F012 design rationale).

---

## 2. CPU Control Intrinsics

### 2.1 Syntax

All CPU control intrinsics are parameterless void functions:

```ebnf
cpu_intrinsic_call = cpu_intrinsic_name , "(" , ")" , ";" ;
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

#### Carry Flag

| Function | Opcode | Bytes | Cycles | Effect |
|----------|--------|-------|--------|--------|
| `asm_clc()` | `CLC` | 1 | 2 | Clear carry flag |
| `asm_sec()` | `SEC` | 1 | 2 | Set carry flag |

#### Decimal Mode

| Function | Opcode | Bytes | Cycles | Effect |
|----------|--------|-------|--------|--------|
| `asm_cld()` | `CLD` | 1 | 2 | Clear decimal mode (binary arithmetic) |
| `asm_sed()` | `SED` | 1 | 2 | Set decimal mode (BCD arithmetic) |

> ⚠️ While decimal mode is active, compiler-generated `+` and `-` produce BCD results. Call `asm_cld()` before resuming normal arithmetic. See W10120.

#### Overflow Flag

| Function | Opcode | Bytes | Cycles | Effect |
|----------|--------|-------|--------|--------|
| `asm_clv()` | `CLV` | 1 | 2 | Clear overflow flag |

No `asm_sev()` — the 6502 has no "set overflow" instruction.

#### Timing & Debug

| Function | Opcode | Bytes | Cycles | Effect |
|----------|--------|-------|--------|--------|
| `asm_nop()` | `NOP` | 1 | 2 | No operation — waste exactly 2 cycles |
| `asm_brk()` | `BRK` | 1+1 | 7 | Software interrupt (debug breakpoint) |

### 2.3 CPU Control Rules

| Rule | Decision |
|------|----------|
| CC-1: Parameters | None. Return type is `void`. |
| CC-2: Valid locations | Anywhere a statement is valid (function bodies, control flow blocks, interrupt handlers) |
| CC-3: Register clobber | After any `asm_*()` call, compiler assumes **all registers (A, X, Y) and flags may be modified**. Compiler reloads values from memory as needed. |
| CC-4: No expressions | `asm_*()` is a statement, not an expression. Cannot appear inside an expression. |
| CC-5: Optimization | Compiler must **never** reorder, remove, or combine `asm_*()` calls. They are opaque barriers. |

### 2.4 Example: Critical Section

```blend65
function setIRQVector(handler: word): void {
    asm_sei();                    // disable interrupts
    pokew(0x0314, handler);       // write 2-byte vector atomically
    asm_cli();                    // re-enable interrupts
}
```

### 2.5 Example: BCD Score Display

```blend65
function addBCDScore(points: byte): void {
    asm_sed();                    // enable decimal mode
    let bcdScore: byte = peek($0400);
    asm_clc();                    // clear carry for addition
    // The compiler's ADD code will now produce BCD result
    let newScore: byte = bcdScore + points;
    poke($0400, newScore);
    asm_cld();                    // back to binary mode
}
```

---

## 3. Memory Intrinsics

### 3.1 Memory Access

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
pokew($0314, &onRasterIRQ);              // install interrupt handler
```

**Code generation:**

```asm
; peek($D021)
LDA $D021           ; 4 cycles, 3 bytes

; poke($D021, 0)
LDA #$00
STA $D021           ; 4 cycles, 3 bytes (+ 2 for LDA #imm)

; peekw($0314)
LDA $0314           ; low byte
LDX $0315           ; high byte — 8 cycles, 6 bytes

; pokew($0314, value)
LDA value_lo
STA $0314
LDA value_hi
STA $0315           ; 8 cycles, 6 bytes (+ setup)
```

**Constant address optimization:** When the address is a compile-time constant, the compiler uses absolute addressing directly. When the address is a runtime expression, it uses zero-page indirect addressing (2 ZP bytes).

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

### 3.3 Compile-Time Queries

| Function | Signature | Effect | Cost |
|----------|-----------|--------|------|
| `sizeof(Type)` | `(type): byte` | Byte size of a type | 0 (compile-time) |
| `offsetof(Type, field)` | `(type, field): byte` | Byte offset of struct field | 0 (compile-time) |
| `length(array)` | `(array): byte\|word` | Element count of array | 0 (compile-time for fixed arrays) |

```blend65
const ENEMY_SIZE: byte = sizeof(Enemy);           // 5
const HP_OFFSET: byte = offsetof(Enemy, hp);      // 2
const TABLE_LEN: byte = length(SINE_TABLE);       // 256
```

These are pure compile-time operations — the compiler substitutes the literal value. They are valid in constant expressions and can be used as array sizes, const initializers, etc.

**`length()` details** → Ch 08, §9.

---

## 4. Error Codes

| Code | Condition | Message |
|------|-----------|---------|
| E10040 | Arguments to parameterless intrinsic | `'<name>()' takes no arguments — found <N>` |
| E10041 | Wrong argument count (memory intrinsic) | `'<name>()' expects <N> arguments — found <M>` |
| E10042 | Address-of element (deferred) | `Address-of array element '&<name>[<index>]' is not supported in v3` |

## Warning Codes

| Code | Condition | Message |
|------|-----------|---------|
| W10120 | Decimal mode without CLD | `asm_sed() called without matching asm_cld() in function '<name>' — compiler arithmetic may produce unexpected BCD results` |
| W10121 | BRK in release mode | `asm_brk() is a debug breakpoint — remove before release build` |

---

## 5. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Expressions** (→ Ch 04) | Memory intrinsics appear in expression position (`peek()` returns a value). CPU intrinsics are statements only. `sizeof`/`offsetof`/`length` are compile-time intrinsics in expressions. |
| **Functions** (→ Ch 06) | `asm_*()` calls are valid inside function bodies. The compiler's register allocation treats them as opaque barriers (CC-3). |
| **Interrupts** (→ Ch 06, §7) | `asm_sei()`/`asm_cli()` are essential for installing interrupt vectors safely. `asm_pha()`/`asm_pla()` can supplement the compiler's automatic register save. |
| **Type system** (→ Ch 02) | `peek()` returns `byte`. `peekw()` returns `word`. `poke()` accepts any byte-compatible type (including enums via implicit widening). |
| **Enums** (→ Ch 09) | Enum values widen to `byte` for `poke()`. `peek()` returns `byte` — use `EnumName(peek(...))` to narrow back. |
| **Platform profile** (→ Ch 15) | Encoding intrinsics (`petscii()`, `screen_codes()`, etc.) are platform-specific and defined in the platform profile. CPU control and memory intrinsics are universal. |
