# F020 — Memory Intrinsics

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F012 (CPU control intrinsics), F016 (type system)  
> **Interacts with**: F005 (memory placement), F006 (address-of), F011 (structs / sizeof), F014 (arrays / length), F019 (variables)

---

## Description

Memory intrinsics are built-in functions for direct memory access, byte extraction, and compile-time size queries. Unlike F012's CPU control intrinsics (which emit single-opcode CPU state operations), memory intrinsics take parameters and return values — they are the bridge between Blend65's type-safe variable system and the raw memory-mapped I/O hardware of 6502 platforms.

Blend65 v3 provides **9 memory intrinsics** in three categories:

| Category | Functions | Purpose |
|----------|-----------|---------|
| Memory access | `peek`, `poke`, `peekw`, `pokew` | Read/write hardware registers and arbitrary memory |
| Byte extraction | `lo`, `hi` | Extract low/high byte from 16-bit values |
| Compile-time queries | `sizeof`, `offsetof`, `length` | Type sizes, field offsets, array element counts |

**Key design principles:**
- All peek/poke calls are **side-effectful** — the optimizer must never eliminate or reorder them
- Compile-time intrinsics (sizeof, offsetof, length) have **zero runtime cost** — resolved during compilation
- No `volatile_read`/`volatile_write` — peek/poke ARE the volatile operations
- No `barrier()` — peek/poke ordering is guaranteed by the side-effectful contract
- All intrinsics use standard function-call syntax — no new grammar rules

---

## Part 1: Memory Access Intrinsics

### MI-1: Side-Effectful Guarantee

**All peek/poke/peekw/pokew calls are side-effectful operations.** The compiler MUST emit the corresponding LDA/STA instruction(s) for every call, in the exact order they appear in source code. The optimizer MUST NOT:

- Eliminate a peek/poke call (even if the same address was just read/written)
- Reorder peek/poke calls relative to each other
- Reorder peek/poke calls relative to other side-effectful operations (asm_*() calls, function calls)
- Merge two peek/poke calls into one

**Rationale:** On 6502 platforms, any address could be a hardware I/O register with side effects. Reading CIA $DC0D clears interrupt flags. Writing VIC-II $D011 at the wrong moment tears the display. The compiler cannot determine which addresses are RAM vs I/O — this is platform-specific and may change at runtime (bank switching). Therefore, all direct memory access via peek/poke is treated as having potential side effects.

**Optimizer contract:** The compiler SHOULD tag peek/poke/peekw/pokew AST nodes as side-effectful. The optimizer MUST preserve the order and execution of all side-effectful operations. This is the same contract used by F012's asm_*() intrinsics (CC-3: clobber-all semantics). Regular variable access (`let x: byte = score;`) is NOT side-effectful and CAN be optimized.

| Access Type | Side-Effectful | Optimizer Can Optimize |
|-------------|---------------|----------------------|
| `peek(addr)` / `poke(addr, val)` | ✅ Yes | ❌ Never |
| `peekw(addr)` / `pokew(addr, val)` | ✅ Yes | ❌ Never |
| `asm_*()` intrinsics (F012) | ✅ Yes | ❌ Never |
| Function calls (JSR) | ✅ Yes | ❌ Never |
| Variable read/write (`score += 1`) | ❌ No | ✅ Yes |
| Arithmetic (`a + b`) | ❌ No | ✅ Yes |

### peek — Read Byte from Memory

```blend65
peek(address: word): byte
```

Reads a single byte from the specified memory address.

```blend65
let borderColor: byte = peek($D020);     // Read VIC-II border color register
let keyState: byte = peek($DC01);        // Read CIA keyboard column
let zpValue: byte = peek($FB);           // Read zero page location
```

**Codegen (constant address):**
```asm
    LDA $D020           ; 3 bytes, 4 cycles (absolute addressing)
    STA _borderColor
```

**Codegen (zero-page constant, $00-$FF):**
```asm
    LDA $FB             ; 2 bytes, 3 cycles (zero-page addressing)
    STA _zpValue
```

**Codegen (variable address):**
```asm
    ; addr is a word variable — requires ZP pointer
    LDA _addr
    STA $FB             ; ZP pointer low
    LDA _addr+1
    STA $FC             ; ZP pointer high
    LDY #$00
    LDA ($FB),Y         ; 5 cycles (indirect indexed)
    STA _result
    ; Total: ~18 cycles, ~12 bytes
```

### poke — Write Byte to Memory

```blend65
poke(address: word, value: byte): void
```

Writes a single byte to the specified memory address.

```blend65
poke($D020, 14);                          // Set border to light blue
poke($0400, 65);                          // Write 'A' to screen RAM
poke(screenAddr, charCode);               // Variable address + variable value
```

**Codegen (constant address, constant value):**
```asm
    LDA #14
    STA $D020           ; 5 bytes, 8 cycles
```

**Codegen (constant address, variable value):**
```asm
    LDA _charCode
    STA $D020           ; 6 bytes, 8 cycles
```

**Codegen (variable address):**
```asm
    ; Set up ZP pointer for addr
    LDA _addr
    STA $FB
    LDA _addr+1
    STA $FC
    LDA _value
    LDY #$00
    STA ($FB),Y         ; 6 cycles (indirect indexed)
    ; Total: ~20 cycles, ~14 bytes
```

### peekw — Read Word from Memory

```blend65
peekw(address: word): word
```

Reads a 16-bit word (little-endian) from two consecutive memory addresses. The low byte is at `address`, the high byte at `address + 1`.

```blend65
let timer: word = peekw($DC04);           // Read CIA timer (low at $DC04, high at $DC05)
let irqVector: word = peekw($0314);       // Read IRQ vector
```

**Codegen (constant address):**
```asm
    LDA $DC04           ; low byte → A
    LDX $DC05           ; high byte → X
    ; Return in A(lo)/X(hi) — standard word return convention
```

### pokew — Write Word to Memory

```blend65
pokew(address: word, value: word): void
```

Writes a 16-bit word (little-endian) to two consecutive memory addresses.

```blend65
pokew($0314, &myIRQHandler);              // Set IRQ vector
pokew($FB, screenAddress);                // Set up ZP pointer pair
```

**Codegen (constant address):**
```asm
    LDA _value          ; low byte
    STA $0314
    LDA _value+1        ; high byte
    STA $0315           ; 10 bytes, ~16 cycles
```

**Codegen (constant address, constant value):**
```asm
    LDA #<value
    STA $0314
    LDA #>value
    STA $0315           ; 8 bytes, 16 cycles
```

---

## Part 2: Byte Extraction Intrinsics

### lo — Extract Low Byte

```blend65
lo(value: word): byte
lo(value: sword): byte
```

Extracts the low byte (bits 0-7) of a 16-bit value.

```blend65
let addr: word = $1234;
let low: byte = lo(addr);                 // $34

// Setting up a ZP pointer pair
poke($FB, lo(screenAddress));
poke($FC, hi(screenAddress));
```

**Compile-time evaluation:** When the argument is a compile-time constant, `lo()` is evaluated at compile time with zero runtime cost:

```blend65
const BASE: word = $0400;
const BASE_LO: byte = lo(BASE);           // $00 — resolved at compile time
```

**Runtime codegen:** When the argument is a variable, `lo()` extracts the low byte:

```asm
    ; lo(addr) where addr is a word variable at $0820
    LDA $0820           ; low byte of word is at the base address
    ; Cost: 3-4 cycles, 2-3 bytes
```

### hi — Extract High Byte

```blend65
hi(value: word): byte
hi(value: sword): byte
```

Extracts the high byte (bits 8-15) of a 16-bit value.

```blend65
let addr: word = $1234;
let high: byte = hi(addr);                // $12

// Common pattern: set up ZP indirect pointer
poke($FB, lo(&spriteData));
poke($FC, hi(&spriteData));
```

**Compile-time evaluation:** Same as `lo()` — zero cost for constants.

**Runtime codegen:**
```asm
    ; hi(addr) where addr is a word variable at $0820
    LDA $0821           ; high byte of word is at base + 1
    ; Cost: 3-4 cycles, 2-3 bytes
```

### MI-2: lo/hi Accept Both Signed and Unsigned

`lo()` and `hi()` accept both `word` and `sword`. The bit extraction is identical regardless of signedness — the function operates on the raw bytes. The return type is always `byte`.

```blend65
let pos: sword = -300;                     // $FED4 in two's complement
let low: byte = lo(pos);                   // $D4
let high: byte = hi(pos);                  // $FE
```

---

## Part 3: Compile-Time Query Intrinsics

### sizeof — Type Size

```blend65
sizeof(TypeName): byte
```

Returns the byte size of a type as a compile-time constant. Takes a **type name** as argument, not a variable.

```blend65
const ENEMY_SIZE: byte = sizeof(Enemy);    // 5 (5 byte fields)
const PLAYER_SIZE: byte = sizeof(Player);  // 9
const BYTE_SIZE: byte = sizeof(byte);      // 1
const WORD_SIZE: byte = sizeof(word);      // 2
const BOOL_SIZE: byte = sizeof(boolean);   // 1
```

**Already referenced in F011 SR-7.** This formalizes the rules:

| Type | `sizeof` |
|------|----------|
| `byte`, `sbyte` | 1 |
| `word`, `sword` | 2 |
| `boolean` | 1 |
| Struct type | Sum of all field sizes (no padding, F011 SR-5) |
| Array type (e.g., `byte[256]`) | Element size × element count |

**MI-3: sizeof takes a type name, not a variable.**

```blend65
let boss: Enemy;
const S1: byte = sizeof(Enemy);           // ✅ type name
const S2: byte = sizeof(boss);            // ❌ E10200: sizeof requires a type name
```

**Rationale:** Clean, unambiguous — no need for the compiler to disambiguate between type names and variable names. If you want the size of a variable's type, use the type name directly.

**Return type:** `byte` for all types with size ≤ 255. In practice, all primitive types and most structs fit in a byte. For arrays larger than 255 bytes, the return type is `word`:

```blend65
const SMALL: byte = sizeof(byte[100]);     // 100 — fits in byte
const LARGE: word = sizeof(byte[1000]);    // 1000 — requires word
```

The compiler determines the return type automatically based on the computed size.

### offsetof — Struct Field Offset

```blend65
offsetof(StructType, fieldName): byte
```

Returns the byte offset of a field within a struct as a compile-time constant.

```blend65
struct Enemy {
    x: byte;          // offset 0
    y: byte;          // offset 1
    hp: byte;         // offset 2
    enemyType: byte;  // offset 3
    frame: byte;      // offset 4
}

const HP_OFFSET: byte = offsetof(Enemy, hp);       // 2
const FRAME_OFFSET: byte = offsetof(Enemy, frame); // 4
```

**Use case:** Manual pointer arithmetic when `&struct.field` is not available (deferred to FUT-001):

```blend65
// Compute address of boss.hp manually
let hpAddr: word = &boss + word(offsetof(Enemy, hp));
poke(hpAddr, 100);    // Set boss.hp to 100 via peek/poke
```

**MI-4: offsetof requires a struct type and a valid field name.**

```blend65
const OFF: byte = offsetof(Enemy, hp);     // ✅
const BAD1: byte = offsetof(byte, x);      // ❌ E10201: offsetof requires a struct type
const BAD2: byte = offsetof(Enemy, mana);  // ❌ E10202: field 'mana' not found in struct 'Enemy'
```

**Nested struct offsets:** For nested structs, offsetof returns the offset from the outermost struct:

```blend65
struct Position { x: word; y: word; }
struct Player {
    pos: Position;     // offset 0, 4 bytes
    hp: byte;          // offset 4
}

const POS_OFF: byte = offsetof(Player, pos);  // 0
const HP_OFF: byte = offsetof(Player, hp);    // 4
```

To get the offset of a nested field (e.g., `player.pos.x`), add offsets:

```blend65
const POS_X_OFF: byte = offsetof(Player, pos) + offsetof(Position, x);  // 0 + 0 = 0
const POS_Y_OFF: byte = offsetof(Player, pos) + offsetof(Position, y);  // 0 + 2 = 2
```

### length — Array Element Count

```blend65
length(arrayName): word
```

Returns the number of elements in an array as a compile-time constant. Takes an **array variable or constant name** as argument.

```blend65
const SPEEDS: byte[8] = [1, 1, 2, 2, 3, 3, 4, 4];
let buffer: byte[256];

const SPEED_COUNT: word = length(SPEEDS);   // 8
const BUF_SIZE: word = length(buffer);      // 256
```

**MI-5: length takes an array name, not a type.**

```blend65
const N: word = length(SPEEDS);            // ✅ array name
const BAD: word = length(42);              // ❌ E10203: length requires an array
```

**Why `word` return type:** Arrays can have more than 255 elements (e.g., `byte[1000]`), so `word` is necessary.

**Relationship to sizeof:** `length()` returns the **element count**, not the byte size. For byte arrays these are the same, but for word or struct arrays they differ:

```blend65
let positions: word[100];
const ELEM_COUNT: word = length(positions);   // 100 elements
const BYTE_SIZE: word = sizeof(word[100]);    // 200 bytes (100 × 2)
```

**Inside functions with array parameters:**

```blend65
function sum(const data: byte[32]): word {
    let total: word = 0;
    for (let i: byte = 0 to byte(length(data)) - 1) {
        total += word(data[i]);
    }
    return total;
}
// length(data) = 32, known at compile time from parameter type
```

---

## Part 4: v2 Intrinsics Not in v3

| v2 Intrinsic | v3 Status | Reason |
|-------------|-----------|--------|
| `volatile_read(addr)` | ❌ Removed | Redundant — peek() is always side-effectful (MI-1) |
| `volatile_write(addr, val)` | ❌ Removed | Redundant — poke() is always side-effectful (MI-1) |
| `barrier()` | ❌ Deferred to FUT | peek/poke ordering is guaranteed by MI-1. Barrier for variable reordering can be reconsidered when the optimizer needs it |

---

## Syntax

All memory intrinsics use standard function-call syntax. No new grammar rules are needed.

```ebnf
(* Memory access — runtime intrinsics *)
peek_call   = "peek"   , "(" , expression , ")" ;
poke_call   = "poke"   , "(" , expression , "," , expression , ")" ;
peekw_call  = "peekw"  , "(" , expression , ")" ;
pokew_call  = "pokew"  , "(" , expression , "," , expression , ")" ;

(* Byte extraction — runtime or compile-time *)
lo_call     = "lo"     , "(" , expression , ")" ;
hi_call     = "hi"     , "(" , expression , ")" ;

(* Compile-time queries *)
sizeof_call   = "sizeof"   , "(" , type_name , ")" ;
offsetof_call = "offsetof" , "(" , type_name , "," , identifier , ")" ;
length_call   = "length"   , "(" , identifier , ")" ;
```

These are recognized by the compiler as built-in identifiers (same as `true`, `false`, and the `asm_*()` functions from F012). No `import` is required — they are always available.

---

## Cost Summary

### Memory Access (Runtime)

| Function | Constant Address | Variable Address | Notes |
|----------|-----------------|-----------------|-------|
| `peek(addr)` | 3-4 cycles, 2-3 bytes | ~18 cycles, ~12 bytes | ZP const → 3 cycles; abs const → 4 cycles |
| `poke(addr, val)` | 6-8 cycles, 4-5 bytes | ~20 cycles, ~14 bytes | Includes LDA for value |
| `peekw(addr)` | 8 cycles, 6 bytes | ~24 cycles, ~16 bytes | Two reads |
| `pokew(addr, val)` | 16 cycles, 8-10 bytes | ~28 cycles, ~18 bytes | Two writes |

### Byte Extraction

| Function | Constant Arg | Variable Arg |
|----------|-------------|-------------|
| `lo(val)` | 0 cycles (compile-time) | 3-4 cycles (load low byte) |
| `hi(val)` | 0 cycles (compile-time) | 3-4 cycles (load high byte) |

### Compile-Time Queries

| Function | Runtime Cost |
|----------|-------------|
| `sizeof(Type)` | 0 cycles — compile-time constant |
| `offsetof(Struct, field)` | 0 cycles — compile-time constant |
| `length(array)` | 0 cycles — compile-time constant |

---

## Resolved Ambiguities

### MI-A1: Should peek/poke have volatile and non-volatile variants?

**No.** All peek/poke are always side-effectful (MI-1). v2's `volatile_read()`/`volatile_write()` are removed. On 6502, any address could be an I/O register — the compiler cannot distinguish RAM from I/O. The safe, simple approach: peek/poke always emit their instructions, in order.

### MI-A2: Should barrier() be included?

**Deferred to FUT.** With peek/poke ordering guaranteed by MI-1, barrier() is only useful for preventing reordering of regular variable operations. This isn't needed until the optimizer does cross-statement analysis. When that happens, barrier() can be added following the same pattern as F012's intrinsics.

### MI-A3: Can peek/poke accept variable addresses?

**Yes.** Both constant and variable addresses are supported. The codegen differs significantly:
- Constant: direct absolute or zero-page addressing (fast, small)
- Variable: indirect indexed via ZP pointer (slower, larger)

The cost difference is documented (H2). The compiler MAY emit a performance advisory when variable-address peek/poke is used in a tight loop.

### MI-A4: Does sizeof accept variables?

**No.** `sizeof(TypeName)` only — takes a type name. `sizeof(myVar)` is E10200. Rationale: clean syntax, no type-vs-variable disambiguation, consistent with the pattern `sizeof(byte)`, `sizeof(Enemy)`.

### MI-A5: Does sizeof return byte or word?

**Both.** The compiler determines the return type based on the computed size: `byte` if size ≤ 255, `word` if size > 255. In practice, most types fit in `byte`.

### MI-A6: Does length return element count or byte size?

**Element count.** `length(word_array)` returns the number of elements, not the byte size. Use `sizeof(type)` for byte sizes. This matches v2 behavior and developer expectations from JavaScript/TypeScript's `.length`.

### MI-A7: Can offsetof access nested field paths?

**No — single level only.** `offsetof(Player, pos)` returns the offset of the `pos` field. For nested fields like `player.pos.x`, add offsets manually: `offsetof(Player, pos) + offsetof(Position, x)`.

### MI-A8: Are intrinsic names reserved keywords or built-in identifiers?

**Built-in identifiers** — same category as `true`, `false`, and `asm_*()` from F012. The developer cannot declare a variable or function named `peek`, `poke`, `sizeof`, etc. — it would shadow the built-in (E10101 or specific error). They are always available without `import`.

### MI-A9: What happens with peek/poke at address 0?

**Defined behavior.** `peek(0)` reads zero-page location $00, which is valid on all 6502 platforms. On C64, $00 is the 6510 data direction register. `poke(0, value)` writes to it. No special case — the address `0` is not treated as null.

---

## Error Codes

| Code | Condition | Message |
|------|-----------|---------|
| E10200 | `sizeof` with non-type argument | `'sizeof' requires a type name — found '<expr>'. Use 'sizeof(<TypeName>)' with a type like 'byte', 'word', or a struct name` |
| E10201 | `offsetof` with non-struct type | `'offsetof' requires a struct type — found '<type>'. Only struct types have field offsets` |
| E10202 | `offsetof` with invalid field | `Field '<field>' not found in struct '<type>' — available fields: <list>` |
| E10203 | `length` with non-array argument | `'length' requires an array — found '<type>'. Use 'sizeof(<TypeName>)' for type sizes` |

**Existing errors that apply:**

| Code | Source | Applies When |
|------|--------|-------------|
| E10171 | F018 | Wrong argument count for peek/poke/etc. |
| E10172 | F018 | Argument type mismatch (e.g., `peek(true)`) |

---

## Feature Interactions

### With F005 (Memory Placement)

peek/poke can access any memory address, including zeropage locations. The compiler optimizes peek/poke with constant addresses in the $00-$FF range to use zero-page addressing (2-byte instruction instead of 3-byte).

### With F006 (Address-of)

`&variable` returns a `word` address that can be passed to peek/poke:

```blend65
let addr: word = &player;
let firstByte: byte = peek(addr);         // Read first byte of player struct
```

Common pattern for interrupt vector installation:
```blend65
pokew($0314, &myHandler);
```

### With F011 (Structs)

`sizeof(StructType)` returns the struct's byte size. `offsetof(StructType, field)` returns field offsets. These enable manual struct manipulation via peek/poke when needed.

### With F012 (CPU Control Intrinsics)

peek/poke and asm_*() share the same side-effectful guarantee. They can be freely interleaved — the optimizer preserves the ordering of all side-effectful operations:

```blend65
asm_sei();                                 // Disable interrupts
pokew($0314, &myHandler);                  // Set IRQ vector (two poke operations)
asm_cli();                                 // Re-enable interrupts
// Guaranteed order: SEI → STA low → STA high → CLI
```

### With F014 (Arrays)

`length(arrayName)` returns the element count. Array const data is accessed by name (not peek), but raw arrays in hardware buffers might be accessed via peek/poke.

### With F016 (Type System)

peek returns `byte`, peekw returns `word`, lo/hi return `byte`. All follow standard type rules. sizeof/offsetof/length return compile-time constants usable in const expressions (F019 VAR-8).

### With F017 (Operators)

peek/poke results can be used in expressions:
```blend65
let masked: byte = peek($D012) & $7F;     // Read and mask
poke($D020, peek($D020) | $01);           // Read-modify-write
```

### With F019 (Variables)

peek/poke are for **hardware access**. Regular variables are for **data storage**. The optimizer treats them differently:
- Variable access: optimizable (dead store elimination, common subexpression elimination)
- peek/poke: never optimized (side-effectful guarantee MI-1)

---

## Examples

### Example 1: Hardware Register Access (C64)

```blend65
module Display;

import { score, lives } from Game;

const BORDER_COLOR: word = $D020;
const BG_COLOR: word = $D021;
const RASTER_LINE: word = $D012;

function waitForRasterLine(line: byte): void {
    while (peek(RASTER_LINE) != line) {
        // busy-wait — peek is side-effectful, never optimized away
    }
}

function setColors(border: byte, background: byte): void {
    asm_sei();
    poke(BORDER_COLOR, border);
    poke(BG_COLOR, background);
    asm_cli();
}

function main(): void {
    setColors(14, 6);
    while (true) {
        waitForRasterLine(250);
        // ... game logic ...
    }
}
```

### Example 2: Interrupt Vector Setup

```blend65
module IRQ;

const IRQ_VECTOR: word = $0314;
const RASTER_ENABLE: word = $D01A;
const RASTER_LINE_REG: word = $D012;
const VIC_CTRL: word = $D011;

interrupt function rasterHandler(): void {
    poke($D020, 2);
    // ... raster effect ...
    poke($D020, 0);
    poke($D019, $FF);            // Acknowledge VIC interrupt
}

function installRasterIRQ(line: byte): void {
    asm_sei();
    pokew(IRQ_VECTOR, &rasterHandler);
    poke(RASTER_LINE_REG, line);
    poke(VIC_CTRL, peek(VIC_CTRL) & $7F);   // Clear bit 7 (raster line high bit)
    poke(RASTER_ENABLE, peek(RASTER_ENABLE) | $01);  // Enable raster interrupt
    asm_cli();
}
```

### Example 3: Manual Struct Manipulation via Offsets

```blend65
module Entities;

struct Enemy {
    x: byte;
    y: byte;
    hp: byte;
    speed: byte;
}

let enemies: Enemy[8];

// Fast "set HP of enemy N" using peek/poke + offsetof
function setEnemyHP(index: byte, hp: byte): void {
    let addr: word = &enemies + word(index) * word(sizeof(Enemy)) + word(offsetof(Enemy, hp));
    poke(addr, hp);
}

// Read enemy position using lo/hi for ZP pointer setup
function setupEnemyPointer(index: byte): void {
    let addr: word = &enemies + word(index) * word(sizeof(Enemy));
    poke($FB, lo(addr));
    poke($FC, hi(addr));
    // Now ($FB),Y can access enemy fields via Y register offsets
}
```

### Example 4: CIA Timer Read with peekw

```blend65
module Timing;

const CIA1_TIMER_A: word = $DC04;

function readTimer(): word {
    // Read 16-bit timer value (little-endian: low at $DC04, high at $DC05)
    return peekw(CIA1_TIMER_A);
}

function timeDifference(start: word, end: word): word {
    // CIA timer counts DOWN, so start > end
    return start - end;
}

function profileFunction(): word {
    let start: word = readTimer();
    // ... code to measure ...
    let end: word = readTimer();
    return timeDifference(start, end);
}
```

---

## Language Guard Evaluation

### Platform Universality (P)

| Rule | Status | Notes |
|------|--------|-------|
| P1 Cross-platform compilable | ✅ | peek/poke compile to LDA/STA on all 6502 platforms. sizeof/offsetof/length are compile-time |
| P2 Platform-meaningful | ✅ | Every 6502 platform has memory-mapped I/O accessed via peek/poke. sizeof/offsetof essential for struct manipulation |
| P3 No platform assumptions | ✅ | No addresses, chip names, or platform references in intrinsic definitions. Hardware addresses are in user code, not the intrinsics themselves |
| P4 Resource-scalable | ✅ | Cost varies by addressing mode (constant vs variable address) — documented in cost summary |

### Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅ | peek = LDA, poke = STA, lo/hi = byte select. All native 6502 operations |
| H2 Cost transparency | ✅ | Full cost table for constant vs variable addresses. Compile-time intrinsics = 0 cycles |
| H3 SFA compatible | ✅ | No memory allocation. peek/poke access existing addresses. sizeof/offsetof/length are compile-time |
| H4 Memory footprint documented | ✅ | Per-call costs documented: peek = 2-12 bytes ROM, 0 RAM. Compile-time intrinsics = 0 bytes |
| H5 Fully deterministic | ✅ | peek returns whatever byte is at the address. poke writes the value. No undefined behavior. Address 0 is valid |

### Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅ | Standard function-call syntax. No parsing ambiguity. sizeof takes type name, offsetof takes struct + field, length takes array name |
| L2 Consistent with existing | ✅ | Same calling convention as asm_*() intrinsics (F012). Built-in identifiers like true/false |
| L3 Beginner-friendly | ✅ | peek/poke are instantly recognizable from BASIC. sizeof/length are familiar from C/JavaScript |
| L4 Minimal feature | ✅ | 9 functions covering all memory access and type query needs. No redundant variants (volatile removed) |
| L5 No redundancy | ✅ | Each function has a unique purpose. No overlap with language operators or other features |
| L6 Error messages defined | ✅ | 4 new error codes (E10200-E10203) plus existing type checking errors |
| L7 Compile-time failure preferred | ✅ | sizeof/offsetof/length are entirely compile-time. Type mismatches in peek/poke caught at compile time |
| L8 Feature interaction documented | ✅ | Interactions with 9 features explicitly documented |
| L9 Documentable with examples | ✅ | 4 examples: hardware registers, interrupt setup, struct offsets, CIA timer |

### Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅ | Built-in identifier recognition. Standard function-call parsing. sizeof/offsetof take special argument types (type name, field name) |
| C2 Semantic analysis defined | ✅ | Type checking for all parameters. Side-effectful tagging for peek/poke. Compile-time evaluation for sizeof/offsetof/length |
| C3 Code generation strategy | ✅ | peek/poke: LDA/STA with addressing mode selection based on constant vs variable address. lo/hi: byte select. Compile-time: literal substitution |
| C4 Unit testable | ✅ | Each intrinsic independently testable. sizeof values deterministic from type definitions. peek/poke codegen testable per addressing mode |
| C5 Runtime verifiable | ✅ | peek/poke: write a value, read it back, verify. sizeof: check struct sizes match expected. Emulator-verifiable on all platforms |

### Future-Proofing (F)

| Rule | Status | Notes |
|------|--------|-------|
| F1 Extensible | ✅ | Can add barrier(), volatile hints, 16-bit peek/poke variants later without breaking existing code |
| F2 Platform-profile ready | ✅ | No platform-specific behavior in intrinsic definitions. Addresses are user-supplied |
| F3 Optimizer-friendly | ✅ | Side-effectful contract (MI-1) gives the optimizer clear rules from day one. Compile-time intrinsics are constant-folded |
| F4 Stability classification | ✅ | **Stable** — peek/poke/sizeof/length are fundamental and universal across all 6502 programming |

**Verdict: ✅ ACCEPTED — all 23 rules pass**
