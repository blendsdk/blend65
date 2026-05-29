# Chapter 08 — Arrays & Strings

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F014

---

## 1. Overview

Arrays are fixed-size, contiguous sequences of elements in memory. Under SFA (→ Ch 11), every array has a compile-time-known base address and size — no dynamic allocation, no resizing.

This chapter also defines:
- **String literals** as syntactic sugar for `const byte[]` with platform-specific encoding
- **Character literals** (`'A'`) as single-byte values
- **Encoding intrinsics** for explicit character encoding control
- **Const parameters** for safe by-reference passing of const data (applies to both arrays and structs)

```blend65
// Lookup table (const, in ROM/data section)
const SINE_TABLE: byte[256] = [0, 3, 6, 9, 12, 15, /* ... */];

// Mutable data arrays
let enemyX: byte[8];
let enemyY: byte[8];

// String literal → const byte array in platform encoding
const TITLE: byte[] = "GAME OVER";

// Character literal → single byte value
let cursor: byte = '_';
```

---

## 2. Array Declaration

### 2.1 Syntax

```ebnf
array_type     = type_name , "[" , [ const_expr ] , "]" ;

array_init     = string_literal
               | encoded_string
               | "[" , [ init_content ] , "]" ;

init_content   = value_list , [ ";" , fill_expr ]
               | string_in_bracket , ";" , fill_expr
               | ";" , fill_expr ;

value_list     = expression , { "," , expression } ;
fill_expr      = expression ;

array_access   = expression , "[" , expression , "]" ;
```

### 2.2 Element Types

Arrays can hold any primitive type or struct type:

| Element Type | Size per Element | Notes |
|-------------|-----------------|-------|
| `byte` | 1 byte | Lookup tables, screen data, entity properties |
| `sbyte` | 1 byte | Signed deltas, sine tables (-128..127) |
| `word` | 2 bytes | Address tables, jump tables, score arrays |
| `sword` | 2 bytes | Signed offsets, large delta tables |
| `boolean` | 1 byte | Flag arrays (alive/dead, visible/hidden) |
| Struct type | `sizeof(Type)` | Game entities, direction tables (→ Ch 07) |

---

## 3. Array Rules

### AR-1 — Size Must Be Compile-Time Constant

Array size must be a compile-time constant — a numeric literal or a `const` value:

```blend65
const MAX_ENEMIES: byte = 8;
let enemies: byte[MAX_ENEMIES];         // ✅ const value
let buffer: byte[40];                    // ✅ literal
let data: byte[someVariable];           // ❌ E10110: size must be compile-time constant
```

### AR-2 — Size Must Be At Least 1

```blend65
let empty: byte[0];   // ❌ E10111: array size must be at least 1
```

### AR-3 — Two-Tier Codegen Model

Arrays are compiled using one of two strategies based on **total byte size** (element count × element size):

| Tier | Total Bytes | Index Type | Addressing Mode | Cycle Cost |
|------|------------|------------|-----------------|------------|
| **Tier 1** | ≤ 256 | `byte` | Absolute,X / Absolute,Y | 4 cycles |
| **Tier 2** | > 256 | `word` | (ZP),Y indirect | 5–6 cycles + 2 ZP bytes |

The compiler automatically selects the tier. The developer must use the correct index type:

```blend65
let small: byte[100];     // 100 bytes → Tier 1
small[byteIndex] = 42;    // ✅ byte index
small[wordIndex] = 42;    // ❌ E10117: requires byte index

let large: byte[1000];    // 1000 bytes → Tier 2
large[wordIndex] = 42;    // ✅ word index
large[byteIndex] = 42;    // ❌ E10118: requires word index
```

**Boundary**: `word[128]` = 256 bytes → Tier 1. `word[129]` = 258 bytes → Tier 2.

### AR-4 — Index Must Be Unsigned

Array indices must be `byte` or `word` (unsigned). Signed types are rejected:

```blend65
let i: sbyte = 5;
arr[i];            // ❌ E10085: array index must be unsigned (byte or word)
arr[byte(i)];      // ✅ explicit cast
```

(Error E10085 is the canonical mixed-signedness rule from → Ch 02.)

### AR-5 — No Whole-Array Assignment

```blend65
let a: byte[10];
let b: byte[10];
a = b;             // ❌ E10119: cannot assign whole array
```

**Rationale**: Hidden loop violates Axiom A4 (explicit over implicit) and Language Guard H2 (cost transparency). Use a `for` loop:

```blend65
for (let i: byte = 0 to length(a)) {
    a[i] = b[i];
}
```

### AR-6 — No Array Comparison

```blend65
if (a == b) { }  // ❌ E10121: cannot compare arrays
```

### AR-7 — No Array Returns

Functions cannot return array types (→ Ch 06, FN-4). Use an output parameter:

```blend65
function getTable(): byte[4] { }  // ❌ E10120

function fillTable(out: byte[4]): void {   // ✅
    out[0] = 10;
    out[1] = 20;
    out[2] = 30;
    out[3] = 40;
}
```

### AR-8 — Bounds Checking

**Compile-time**: When the index is a compile-time constant, the compiler checks it against array size. Out-of-bounds constant index is a compile error.

**Runtime**: No bounds checking by default — too expensive for 6502. The compiler flag `--bounds-check` enables runtime checks for debugging (inserts compare-and-trap code before each access). This is a debug tool, not for production.

**Without `--bounds-check`**: Out-of-bounds runtime access wraps modulo the addressing space. The behavior is defined (not undefined per Axiom A3) but undesirable — the developer is responsible for correct indices.

---

## 4. Array Initialization

### 4.1 The `[values; fill]` Model

The semicolon `;` inside brackets means **"fill the remaining elements with this value"**:

```blend65
type[SIZE] = [explicit_values; fill_value]
//            ^^^^^^^^^^^^^^^^  ^^^^^^^^^^
//            placed first       fills remaining elements up to SIZE
```

The fill value is always a **single compile-time constant element** — not a string, not an array. The array must have an **explicit size** when using fill.

### 4.2 Value Arrays

```blend65
let a: byte[] = [1, 2, 3];              // ✅ size inferred = 3
let b: byte[5] = [1, 2, 3, 4, 5];       // ✅ exact match
let c: byte[5] = [1, 2, 3; 0];          // ✅ [1, 2, 3, 0, 0] — fill rest with 0
let d: byte[5] = [; 0];                 // ✅ [0, 0, 0, 0, 0] — pure fill
let e: byte[5] = [; $FF];               // ✅ [$FF, $FF, $FF, $FF, $FF]
let f: byte[5] = [1, 2, 3];             // ⚠️ W10140: partial init (bytes 3–4 indeterminate)
let g: byte[2] = [1, 2, 3];             // ❌ E10112: 3 values exceed size 2
let h: byte[] = [1, 2, 3; 0];           // ❌ E10114: fill requires explicit size
```

### 4.3 String Initialization

```blend65
let m: byte[] = "HELLO";                 // ✅ size inferred = 5
let n: byte[10] = "HELLO";              // ⚠️ W10140: partial init (bytes 5–9 indeterminate)
let o: byte[10] = ["HELLO"; 0];         // ✅ [H,E,L,L,O, 0,0,0,0,0] — fill rest
let p: byte[10] = ["HELLO"; ' '];       // ✅ [H,E,L,L,O, sp,sp,sp,sp,sp] — space-padded
let q: byte[3] = "HELLO";              // ❌ E10124: string (5 bytes) exceeds array size (3)
let r: byte[] = ["HELLO"; 0];           // ❌ E10114: fill requires explicit size
```

### 4.4 Character Literals in Values

```blend65
let i: byte[] = ['H', 'I'];             // ✅ size = 2, platform encoding
let j: byte[5] = ['H', 'I'; ' '];       // ✅ [H, I, space, space, space]
let k: byte[40] = [; 'A'];              // ✅ all 40 bytes = encoding of 'A'
let l: byte[40] = [; petscii('.')];      // ✅ all 40 bytes = PETSCII '.'
```

### 4.5 Encoded Strings

```blend65
let s: byte[] = petscii("HELLO");                        // ✅ PETSCII, size = 5
let t: byte[10] = [petscii("LOADING"); petscii('.')];    // ✅ 7 PETSCII + 3 dots
let u: byte[10] = [screen_codes("SCORE"); screen_codes(' ')]; // ✅ 5 screen + 5 spaces
```

### 4.6 Invalid Combinations

```blend65
let w: byte[] = ["HELLO", "WORLD"];      // ❌ E10116: cannot mix/concatenate strings
let x: byte[] = [1, "HI", 3];           // ❌ E10116: cannot mix strings and values
let y: byte[5] = [1, 2; "HI"];          // ❌ E10115: fill must be single element
```

### 4.7 Const Arrays

Const arrays must be fully initialized:

```blend65
const a: byte[] = [1, 2, 3];            // ✅ fully initialized
const b: byte[] = "HELLO";              // ✅ fully initialized
const c: byte[5] = [1, 2, 3; 0];        // ✅ fill completes it
const d: byte[5] = [1, 2, 3];           // ❌ E10113: const must be fully initialized
```

### 4.8 Uninitialized Warning

```blend65
let buf: byte[40];          // ⚠️ W10141: uninitialized array
let buf: byte[40] = [; 0];  // ✅ no warning — explicitly filled
```

---

## 5. String Literals

String literals are syntactic sugar for `const byte[]` arrays. There is no `string` type in Blend65.

### STR-1 — String Literals Produce Byte Arrays

```blend65
const MSG: byte[] = "HELLO";
// Equivalent to: const MSG: byte[] = [72, 69, 76, 76, 79];
// (byte values depend on platform encoding)
```

The compiler encodes the string using the platform profile's `defaultStringEncoding` setting.

### STR-2 — Platform Default Encoding

The platform profile defines the default encoding (→ Ch 15):

| Platform | Default Encoding | Available Encodings |
|----------|-----------------|---------------------|
| C64 | `screen_codes` | `petscii`, `screen_codes` |
| C64 Ultimate | `screen_codes` | `petscii`, `screen_codes` |
| CX16 | `screen_codes` | `petscii`, `screen_codes` |
| Atari 800XL | `internal_codes` | `atascii`, `internal_codes` |
| Atari 7800 | `raw` | `raw` (ASCII values pass through) |

**Rationale**: Games overwhelmingly write directly to screen memory, not through OS I/O routines. Screen codes / internal codes are the natural default for game development.

### STR-3 — Encoding Intrinsics

To use a non-default encoding, use the encoding intrinsic:

```blend65
const TITLE: byte[] = "GAME OVER";                      // platform default
const KERNAL_MSG: byte[] = petscii("HELLO");             // PETSCII for KERNAL I/O
const SCREEN_MSG: byte[] = screen_codes("SCORE:");       // screen codes for direct write
const ATARI_MSG: byte[] = atascii("READY");              // ATASCII for Atari I/O
```

Encoding intrinsics are polymorphic:

| Input | Output | Example |
|-------|--------|---------|
| String literal `"..."` | `byte[]` (array of encoded bytes) | `petscii("HI")` → `byte[2]` |
| Character literal `'.'` | `byte` (single encoded byte) | `petscii('.')` → `byte` |

Using an encoding not available for the target platform is E10125:

```blend65
// Compiling for Atari 800XL:
const MSG: byte[] = petscii("HI");  // ❌ E10125: unknown encoding 'petscii' for platform 'a800xl'
```

Encoding intrinsic availability (→ Ch 15 platform profile):

| Intrinsic | C64 | CX16 | Atari 800XL | Atari 7800 |
|-----------|-----|------|-------------|------------|
| `petscii()` | ✅ | ✅ | ❌ | ❌ |
| `screen_codes()` | ✅ | ✅ | ❌ | ❌ |
| `atascii()` | ❌ | ❌ | ✅ | ❌ |
| `internal_codes()` | ❌ | ❌ | ✅ | ❌ |

### STR-4 — Raw Bytes, No Automatic Termination

String literals produce raw bytes — no null terminator, no length prefix:

```blend65
const MSG: byte[] = "HELLO";
// Result: [H, E, L, L, O] — 5 bytes, no terminator

// Add null terminator explicitly if needed:
const MSG_Z: byte[] = "HELLO\0";
// Result: [H, E, L, L, O, 0] — 6 bytes

// length(MSG) = 5, length(MSG_Z) = 6
```

### STR-5 — Escape Sequences

| Escape | Value | Description |
|--------|-------|-------------|
| `\\` | `$5C` | Literal backslash |
| `\"` | Encoding of `"` | Double quote |
| `\0` | `$00` | Null byte |
| `\xNN` | `$NN` | Arbitrary hex byte value |

No `\n`, `\t`, `\r` — these are meaningless on screen-mapped 6502 displays.

### STR-6 — Mutable String Arrays

A mutable array can be initialized with a string literal:

```blend65
let label: byte[] = "SCORE:";  // mutable, size 6
label[0] = 'H';                // ✅ now "HCORE:"
```

---

## 6. Character Literals

### CL-1 — Character Literals Are Byte Values

A character literal is a `byte` constant encoded using the platform's default encoding:

```blend65
let ch: byte = 'A';           // platform encoding of 'A'
const SPACE: byte = ' ';      // platform encoding of space
```

```ebnf
char_literal = "'" , ( char_char | escape_seq ) , "'" ;
char_char    = ? any printable character except ' and \ ? ;
escape_seq   = "\\" | "\'" | "\0" | "\x" , hex_digit , hex_digit ;
```

### CL-2 — Encoding Intrinsics on Characters

```blend65
let ch: byte = petscii('A');          // PETSCII value of 'A'
let sc: byte = screen_codes('A');     // screen code value of 'A' (= 1 on C64)
```

### CL-3 — Characters in Array Initializers

Character literals can be used anywhere a byte expression is expected:

```blend65
let greeting: byte[] = ['H', 'E', 'L', 'L', 'O'];  // same as "HELLO"
let padded: byte[40] = ["SCORE:"; ' '];              // fill rest with spaces
```

---

## 7. Const Parameters

Const parameters solve a critical safety problem: arrays and structs are passed by reference (→ Ch 06, FN-3), but `const` arrays/structs live in ROM. Writing to ROM is catastrophic on 6502 — either silently ignored or corrupts hardware state.

### CP-1 — Const Qualifier on Parameters

The `const` keyword before the type in a parameter declaration makes it read-only:

```blend65
function display(msg: const byte[], enemy: const Enemy): void {
    // Can read msg[i] and enemy.hp — cannot modify them
}
```

### CP-2 — Passing Rules

| Argument | To mutable param `(p: T)` | To const param `(p: const T)` |
|----------|---------------------------|-------------------------------|
| `let` variable (mutable) | ✅ OK | ✅ OK (safe direction) |
| `const` variable | ❌ E10122 | ✅ OK |

```blend65
const TABLE: byte[] = [1, 2, 3];
let buffer: byte[10];

readOnly(TABLE);      // ✅ const → const param
readOnly(buffer);     // ✅ mutable → const param (safe)
readWrite(buffer);    // ✅ mutable → mutable param
readWrite(TABLE);     // ❌ E10122: cannot pass const to mutable parameter
```

### CP-3 — Applies to Structs Too

The `const` parameter qualifier works identically for struct parameters (→ Ch 07, SR-3):

```blend65
const DEFAULT_ENEMY: Enemy = { x: 0, y: 0, hp: 100, enemyType: 0, frame: 0 };

function display(e: const Enemy): void {
    let hp: byte = e.hp;         // ✅ read OK
    e.hp = 0;                    // ❌ E10123: cannot modify const parameter
}
display(DEFAULT_ENEMY);           // ✅ const → const param, no copy needed
```

### CP-4 — Zero Runtime Cost

The `const` modifier is a compile-time-only check. The generated code is identical for `const` and mutable parameters — the compiler simply refuses to emit store instructions targeting const parameters.

### CP-5 — Const Propagation Through Field/Element Access

```blend65
function inspect(e: const Enemy): void {
    e.hp = 50;                   // ❌ E10123: e is const
    e.pos.x = 100;              // ❌ E10123: e is const (nested field)
}

function readTable(t: const byte[256]): void {
    t[0] = 42;                  // ❌ E10123: t is const
    let v: byte = t[0];         // ✅ read OK
}
```

---

## 8. Array Parameters

### 8.1 Sized Parameters

```blend65
function clear(buf: byte[40]): void {
    for (let i: byte = 0 to 40) {
        buf[i] = 0;
    }
}
```

The parameter specifies an exact size. The compiler enforces that the argument matches:

```blend65
let screen: byte[40];
let small: byte[10];
clear(screen);     // ✅ byte[40] → byte[40]
clear(small);      // ❌ array size mismatch — expected 40, found 10
```

`length(buf)` inside the function returns the compile-time constant 40.

### 8.2 Unsized Parameters

```blend65
function sum(data: const byte[], len: byte): byte {
    let total: byte = 0;
    for (let i: byte = 0 to len) {
        total += data[i];
    }
    return total;
}
```

`byte[]` without a size accepts any byte array. The compiler passes the array address. The developer passes the length manually (or uses `length()` at the call site):

```blend65
let a: byte[] = [1, 2, 3];
let b: byte[10] = [; 0];
let s1: byte = sum(a, length(a));    // ✅ length(a) = 3
let s2: byte = sum(b, length(b));    // ✅ length(b) = 10
```

---

## 9. `length()` Intrinsic

`length(array)` returns the element count of an array (→ Ch 04, §9).

| Context | Return | Type | Cost |
|---------|--------|------|------|
| Fixed-size array (`byte[40]`) | 40 | Compile-time constant | 0 cycles |
| Size-inferred array (`byte[] = [1,2,3]`) | 3 | Compile-time constant | 0 cycles |
| Sized parameter (`byte[40]`) | 40 | Compile-time constant | 0 cycles |
| Unsized parameter (`byte[]`) | Not available | — | Use explicit length param |

**Return type**: `byte` for arrays ≤256 elements; `word` for arrays >256 elements.

`length()` is valid in constant expressions:

```blend65
const TABLE: byte[] = [1, 2, 3, 4, 5];
const TABLE_SIZE: byte = length(TABLE);    // ✅ = 5, compile-time constant
let copy: byte[length(TABLE)];             // ✅ valid array size
```

---

## 10. Code Generation

### 10.1 Tier 1: Byte Array Access (≤256 bytes)

```blend65
let arr: byte[100];
let val: byte = arr[i];    // read
arr[i] = 42;               // write
```

```asm
; Read
LDX i
LDA arr,X          ; Absolute,X — 4 cycles, 3 bytes ROM
STA val

; Write
LDX i
LDA #42
STA arr,X          ; 4 cycles, 3 bytes ROM
```

### 10.2 Tier 1: Word Array Access

```blend65
let addrs: word[64];    // 128 bytes → Tier 1
// Access addrs[i]
```

```asm
LDA i
ASL A              ; A = i × 2
TAX
LDA addrs,X       ; low byte — 4 cycles
STA lo
LDA addrs+1,X     ; high byte — 4 cycles
STA hi
; Total: ~12 cycles
```

### 10.3 Tier 2: Large Array Access (>256 bytes)

```blend65
let screen: byte[1000];
let val: byte = screen[pos];  // pos is word
```

```asm
; Set up ZP pointer: base + index
LDA #<screen
CLC
ADC pos_lo         ; add index low byte
STA ptr
LDA #>screen
ADC pos_hi         ; add index high byte (with carry)
STA ptr+1
LDY #0
LDA (ptr),Y        ; indirect indexed — 5–6 cycles
STA val
; Total: ~20 cycles + 2 ZP bytes
```

### 10.4 Fill Initialization

```blend65
let buf: byte[40] = [; 0];
```

```asm
LDA #$00
LDX #39
.fill:
STA buf,X
DEX
BPL .fill           ; ~200 cycles for 40 bytes, 7 bytes ROM
```

### 10.5 Partial Initialization with Fill

```blend65
let msg: byte[10] = ["HI"; ' '];
```

```asm
; Copy "HI" (2 bytes from data section)
LDA init_data+0    ; 'H'
STA msg+0
LDA init_data+1    ; 'I'
STA msg+1
; Fill remaining 8 bytes with space
LDA #$20           ; space character
LDX #7
.fill:
STA msg+2,X
DEX
BPL .fill
```

### 10.6 Const Array Optimization

```blend65
const TABLE: byte[] = [10, 20, 30, 40, 50];
let x: byte = TABLE[2];
```

The compiler may constant-fold this to:

```asm
LDA #30             ; compile-time lookup: TABLE[2] = 30
STA x
```

### 10.7 Array Parameter Passing

```asm
; Caller: sum(a, length(a))
LDA #<a
STA param_ptr        ; ZP pointer low
LDA #>a
STA param_ptr+1      ; ZP pointer high
LDA #3               ; length
STA param_len
JSR sum
```

Cost: 2 ZP bytes for pointer + parameter bytes.

---

## 11. Cost Summary

| Operation | Tier 1 (≤256B) | Tier 2 (>256B) | Notes |
|-----------|---------------|----------------|-------|
| Element read | 4 cycles | ~20 cycles | +2 ZP bytes for Tier 2 |
| Element write | 4 cycles | ~20 cycles | +2 ZP bytes for Tier 2 |
| Word element read | ~12 cycles | ~24 cycles | Index multiply by 2 (shift) |
| Fill (N bytes) | ~5N cycles | ~5N cycles | Init loop |
| `length()` | 0 cycles | 0 cycles | Compile-time constant |
| Array param passing | ~10 cycles | ~10 cycles | Set up ZP pointer |

---

## 12. Error Codes

All error codes defined in this chapter. The canonical registry is in → Ch 14.

| Code | Condition | Message |
|------|-----------|---------|
| E10110 | Non-constant array size | `Array size must be a compile-time constant expression — found '<expr>'` |
| E10111 | Zero-size array | `Array size must be at least 1 — found '<size>'` |
| E10112 | Too many initializer values | `Array initializer has <N> elements but array size is <M>` |
| E10113 | Partial const array | `Const array must be fully initialized — <N> elements provided for size <M>. Use fill syntax: [values; fill]` |
| E10114 | Fill without explicit size | `Fill syntax '[...; fill]' requires explicit array size — use 'type[N] = [values; fill]'` |
| E10115 | Non-element fill value | `Fill value must be a single element — found string or array` |
| E10116 | Mixed string/value init | `Cannot mix string literals with value elements in array initializer` |
| E10117 | Wrong index type (Tier 1) | `Array '<name>' (≤256 bytes) requires byte index — found '<type>'` |
| E10118 | Wrong index type (Tier 2) | `Array '<name>' (>256 bytes) requires word index — found '<type>'` |
| E10119 | Whole-array assignment | `Cannot assign whole array — copy elements individually using a loop` |
| E10120 | Array return type | `Cannot return array type from function — use an array parameter instead` |
| E10121 | Array comparison | `Cannot compare arrays with '<op>' — compare individual elements` |
| E10122 | Const to mutable param | `Cannot pass const '<name>' to mutable parameter '<param>' — add 'const' to parameter or copy to mutable variable` |
| E10123 | Modify const parameter | `Cannot modify const parameter '<name>' — parameter is declared 'const'` |
| E10124 | String exceeds array size | `String literal (<N> bytes) exceeds array size (<M>)` |
| E10125 | Unknown encoding | `Unknown encoding '<name>' for platform '<platform>' — available: <list>` |

## Warning Codes

| Code | Condition | Message |
|------|-----------|---------|
| W10140 | Partial initialization | `Partially initialized array '<name>' — <N> of <M> elements initialized, remaining are indeterminate` |
| W10141 | Uninitialized array | `Uninitialized array '<name>' — all <N> elements are indeterminate` |
| W10142 | Tier 2 overhead | `Array '<name>' (<N> bytes) uses indirect addressing — access is slower than direct indexed arrays (≤256 bytes)` |
| W10143 | Large array on platform | `Large array '<name>' (<N> bytes) on platform '<platform>' — consider total RAM budget` |

---

## 13. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Type system** (→ Ch 02) | Arrays are a derived type. Element types must be valid types. `byte[]` is not a standalone type outside parameter/declaration context. |
| **Variables** (→ Ch 03) | Array instances declared with `let`/`const`. `zeropage` placement supported (small arrays). |
| **Operators** (→ Ch 04) | No operators apply to arrays directly. `sizeof` and `length` are compile-time intrinsics. Element access uses `[]` indexing. |
| **Functions** (→ Ch 06) | Always passed by reference (FN-3). Cannot be returned (FN-4, E10120). `const` modifier prevents mutation. Sized and unsized parameters supported. |
| **Structs** (→ Ch 07) | Arrays as struct fields (inline, contiguous). Struct arrays use index × `sizeof(Type)` addressing. Const parameters apply to both. |
| **Enums** (→ Ch 09) | Enum arrays supported (`Direction[8]`). Index must still be unsigned integer. |
| **For loops** (→ Ch 05) | `for (i = 0 to length(arr))` is the natural iteration pattern. |
| **Modules** (→ Ch 10) | Arrays can be exported. `const` arrays are valid module-level exports. |
| **Memory model** (→ Ch 11) | `let` arrays → RAM segment. `const` arrays → ROM/data segment. `zeropage` arrays → ZP range. |
| **Address-of** (→ Ch 04) | `&arr` returns base address as `word`. `&arr[i]` (element address) deferred to future version. |
| **Platform profile** (→ Ch 15) | Encoding tables, default encoding, available encoding intrinsics — all defined in platform profile. |

---

## 14. Examples

### 14.1 Lookup Table (Sine Wave)

```blend65
module Tables;

export const SINE_TABLE: byte[256] = [
    128, 131, 134, 137, 140, 143, 146, 149,
    152, 155, 158, 162, 165, 168, 171, 174,
    // ... (256 values representing sin(x) scaled to 0–255)
    125, 128
];

export function getSine(angle: byte): byte {
    return SINE_TABLE[angle];
}
```

### 14.2 Entity Management (Struct-of-Arrays)

```blend65
module Entities;

const MAX_ENTITIES: byte = 16;

let entityX: byte[MAX_ENTITIES];
let entityY: byte[MAX_ENTITIES];
let entityHP: byte[MAX_ENTITIES];
let entityActive: boolean[MAX_ENTITIES];
let entityCount: byte = 0;

function spawnEntity(x: byte, y: byte, hp: byte): void {
    if (entityCount < MAX_ENTITIES) {
        entityX[entityCount] = x;
        entityY[entityCount] = y;
        entityHP[entityCount] = hp;
        entityActive[entityCount] = true;
        entityCount += 1;
    }
}
```

### 14.3 Screen Output with Strings

```blend65
module UI;

const SCORE_LABEL: byte[] = screen_codes("SCORE:");
const LIVES_LABEL: byte[] = screen_codes("LIVES:");

function drawLabel(addr: word, label: const byte[], len: byte): void {
    for (let i: byte = 0 to len) {
        poke(addr + word(i), label[i]);
    }
}

function drawUI(): void {
    drawLabel($0400, SCORE_LABEL, length(SCORE_LABEL));
    drawLabel($0428, LIVES_LABEL, length(LIVES_LABEL));
}
```

### 14.4 Buffered Input

```blend65
module Input;

const MAX_INPUT: byte = 20;
let inputBuffer: byte[MAX_INPUT] = [; ' '];
let inputPos: byte = 0;

function addChar(ch: byte): void {
    if (inputPos < MAX_INPUT) {
        inputBuffer[inputPos] = ch;
        inputPos += 1;
    }
}

function clearInput(): void {
    for (let i: byte = 0 to MAX_INPUT) {
        inputBuffer[i] = ' ';
    }
    inputPos = 0;
}
```

### 14.5 Color Ramp Animation

```blend65
module Effects;

const RAMP: byte[] = [0, 11, 12, 15, 1, 15, 12, 11];
let rampOffset: byte = 0;

function cycleColors(): void {
    for (let i: byte = 0 to length(RAMP)) {
        let colorIndex: byte = (i + rampOffset) & 7;
        poke($D800 + word(i), RAMP[colorIndex]);
    }
    rampOffset += 1;
}
```
