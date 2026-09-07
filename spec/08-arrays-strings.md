# Chapter 08 — Arrays & Strings

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F014

---

## 1. Overview

Every stored array object is a fixed-size, contiguous sequence whose storage and extent are known at
compile time; there is no dynamic allocation or resizing. An any-size array parameter is not a new
stored array object: its SFA home receives the fixed caller object's runtime base address and element
count (→ Ch 06, Ch 11).

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
array_type        = array_element_type , "[" , [ const_expression ] , "]" ;
array_element_type = integer_type | "boolean" | qualified_name ;

array_literal     = "[" , [ array_init_content ] , "]" ;
array_init_content = expression , { "," , expression }
                   | expression , { "," , expression } , ";" , expression
                   | ";" , expression ;
```

`qualified_name` resolves semantically to an enum or struct type. String literals and named
encoding calls are ordinary expressions in this fragment; the initializer rules below restrict
how their byte sequences may be combined. Array indexing is the `"[" , expression , "]"`
alternative of the master grammar's `postfix_op`; it is not a second expression production.

### 2.2 Element Types

Arrays can hold any non-`void` primitive type, enum type, or struct type:

| Element Type | Size per Element | Notes |
|-------------|-----------------|-------|
| `byte` | 1 byte | Lookup tables, screen data, entity properties |
| `sbyte` | 1 byte | Signed deltas, sine tables (-128..127) |
| `word` | 2 bytes | Address tables, jump tables, score arrays |
| `sword` | 2 bytes | Signed offsets, large delta tables |
| `boolean` | 1 byte | Flag arrays (alive/dead, visible/hidden) |
| Enum type | 1 byte | Nominal state, kind, and mode tables (→ Ch 09) |
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

The extent expression is evaluated at full precision before any narrowing. Its result must be an
integer in `0..65535`; E10264 rejects a non-integer, negative, or larger value. The compiler then computes
`extent * sizeof(elementType)` at full precision. E10265 rejects an array type whose total byte
size exceeds 65535, even when its element count fits. These are compile-time representation limits,
not runtime checks.

An omitted extent is permitted only for an unsized function parameter or where the declaration's
initializer supplies a compile-time-known element count. A module/local storage declaration without
such an initializer, and every struct field, must write an explicit extent. E10253 rejects storage
whose extent cannot be inferred; `byte[0]` and an empty extent-inferencing initializer remain the
explicit zero-length forms.

### AR-2 — Zero-Length Arrays

```blend65
let empty: byte[0];          // ✅ zero storage bytes
const noBytes: byte[] = ""; // ✅ inferred extent 0
```

A zero-length array is valid, has `length(array) == 0`, and occupies no data bytes.
Its linker label is a position marker and may share an address with the next object; taking
`&array` is valid but does not make any byte at that address part of the array. Every
compile-time-known index is E10240. In default unchecked mode a runtime index retains the ordinary
unsafe effective-address semantics; with `--bounds-check`, every access takes the failure path.

### AR-3 — Storage Size Does Not Select the Source Index Type

Every integer type may index every array. The index is an **element ordinal**, not a byte offset and
not a code-generation tier selector. Total byte size affects placement, resource accounting, and
which machine sequence is cheapest; it never makes otherwise ordinary source illegal.

```blend65
let small: byte[100];
small[byteIndex] = 42;     // ✅
small[wordIndex] = 42;     // ✅

let large: byte[1000];
large[byteIndex] = 42;     // ✅ ordinals 0..255 from this value
large[wordIndex] = 42;     // ✅ ordinals 0..65535 from this value
```

The compiler selects the cheapest correct sequence for each access from the proven ordinal range,
element size, base placement, and available registers. A large array accessed through a proven
byte-range ordinal may still use an indexed fast path. A small array accessed through a `word`
remains legal; proof may narrow its machine computation only when the effective address and every
observable source value stay identical.

### AR-4 — Index-Ordinal Expression Context

The expression directly inside `array[...]` is evaluated in a local 16-bit-capable ordinal context.
Before an unbarriered integer-producing operator evaluates, `byte` widens to `word` and `sbyte`
widens to `sword`. This applies to unary `~` and `-`, and to `+`, `-`, `*`, `/`, `%`, `<<`, `>>`,
`&`, `|`, and `^`. Unary minus on an unsigned value remains illegal. Comparisons and logical
operators still produce `boolean`, which is not a valid index. This preserves the mathematical
ordinal that a modern developer writes without requiring an intermediate `word` variable:

```blend65
let data: byte[500];
let shifted: byte[600];
let i: byte = 255;
data[i + 10];          // ✅ ordinal 265, not wrapped ordinal 9
shifted[i << 1];        // ✅ ordinal 510, not wrapped ordinal 254
data[510];              // ❌ E10240: ordinal 510 is outside data[0..499]
data[byte(i + 10)];    // ✅ explicit narrow barrier: ordinal 9
```

Parentheses and the selected arms of a conditional expression retain this context. An explicit
8-bit cast, assignment or compound assignment to 8-bit storage, or arithmetic already completed
inside a called function is a deliberate narrow barrier; the resulting value is widened only after
that ordinary narrow operation. Mixed signedness still requires the ordinary explicit cast.

All four integer types are valid final indices. A compile-time-known negative or out-of-extent
ordinal is E10240. With `--bounds-check`, a runtime signed index is checked for both `index >= 0`
and `index < length(array)` before address formation. In default unchecked mode, signed values are
sign-extended and the effective address is formed in the 16-bit address domain. Sixteen-bit
overflow retains ordinary deterministic wrap.

The compiler need not materialize a word temporary. Range proof may keep the operation byte-only,
and a carry may flow directly into address formation or a surviving inline bounds check.

### AR-5 — No Whole-Array Assignment

```blend65
let a: byte[10];
let b: byte[10];
a = b;             // ❌ E10119: cannot assign whole array
```

**Rationale**: Hidden loop violates Axiom A4 (explicit over implicit) and Language Guard H2 (cost transparency). Use a `for` loop:

```blend65
for (let i: word = 0; i < length(a); i += 1) {
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

**Runtime, default mode**: No bounds check, trap, or modulo-by-array-length code is emitted. The
effective address is `(base + index * element_size) modulo 65536`. Multi-byte elements continue
across `$FFFF` to `$0000`; the selected platform's active bank and MMIO mapping determine the bytes
read or written. The optimizer must not assume that a runtime index is in bounds.

**Runtime, `--bounds-check`**: The compiler emits an inline check before address formation or any
memory/MMIO access. The base and index operands are evaluated once. Failure branches to the
platform's source-labelled, non-returning safety stop. A sound in-bounds proof removes the check.
This option is off by default and links no runtime library.

The default rule is a documented hardware-limitation exception. It preserves zero default check
cost while making the exact 16-bit address-space behavior explicit.

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

The compiler encodes the string using the platform profile's `default_encoding` and
`default_character_map` settings. Source characters are Unicode scalar values, but generated data
is only the selected target bytes; Unicode is never a required target representation or runtime
facility.

### STR-2 — Platform Default Encoding

The platform profile defines the default encoding (→ Ch 15):

| Platform | Default Encoding | Default Map | Available Named Encodings |
|----------|------------------|-------------|---------------------------|
| C64 | `screen_codes` | `upper_graphics` | `petscii`, `screen_codes` |
| C64 Ultimate | `screen_codes` | `upper_graphics` | `petscii`, `screen_codes` |
| CX16 | `raw` | `raw` | None; specialized maps await the X16 expert extension |
| Atari 800XL | `raw` | `raw` | None; specialized maps await the Atari expert extension |
| Atari 7800 | `raw` | `raw` | None |

The C64 defaults match direct screen-memory game code. The other targets use the exact
`ascii-raw-v1` identity map as a conservative byte baseline until their platform-specific maps are
qualified; this does not claim that ASCII bytes are native display codes on those machines.

### STR-3 — Encoding Intrinsics

To use a non-default encoding, use one of the target-registered named encoding intrinsics:

```blend65
const TITLE: byte[] = "GAME OVER";                      // platform default
const KERNAL_MSG: byte[] = petscii("HELLO");             // PETSCII for KERNAL I/O
const SCREEN_MSG: byte[] = screen_codes("SCORE:");       // screen codes for direct write
const MIXED_CASE: byte[] = screen_codes("Hello", "lower_upper");
```

There is no generic `encode()` intrinsic. Named intrinsics make the selected byte contract visible in
source and are polymorphic:

| Input | Output | Example |
|-------|--------|---------|
| String literal `"..."` | `byte[]` (array of encoded bytes) | `petscii("HI")` → `byte[2]` |
| Character literal `'.'` | `byte` (single encoded byte) | `petscii('.')` → `byte` |
| Literal plus map-key string literal | Same as the first argument | `screen_codes("Hello", "lower_upper")` → `byte[5]` |

The optional second argument chooses an immutable map for this literal only. It must be a string
literal naming a map registered under the chosen encoding. It never changes the hardware's active
character set and emits no runtime code. E10251 rejects a non-literal map argument; E10125 rejects
an unknown encoding or map key.

Using an encoding not available for the target platform is E10125:

```blend65
// Compiling for Atari 800XL:
const MSG: byte[] = petscii("HI");  // ❌ E10125: 'petscii' is unavailable for 'a800xl'
```

Encoding intrinsic availability (→ Ch 15 platform profile):

| Intrinsic | C64 / C64U | CX16 | Atari 800XL | Atari 7800 |
|-----------|------------|------|-------------|------------|
| `petscii()` | ✅ | ❌ | ❌ | ❌ |
| `screen_codes()` | ✅ | ❌ | ❌ | ❌ |
| `atascii()` | ❌ | ❌ | Reserved, inactive | ❌ |
| `internal_codes()` | ❌ | ❌ | Reserved, inactive | ❌ |

There is no `raw()` intrinsic. An unwrapped literal uses the target's default encoding and map.

### STR-4 — Raw Bytes, No Automatic Termination

String literals produce an encoded byte array with no null terminator and no length prefix:

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
| `\\` | Encoding of `\` | Backslash character |
| `\"` | Encoding of `"` | Double-quote character |
| `\'` | Encoding of `'` | Single-quote character |
| `\n` | Selected encoding's newline mapping | Symbolic newline |
| `\r` | Selected encoding's carriage-return mapping | Symbolic carriage return |
| `\t` | Selected encoding's horizontal-tab mapping | Symbolic horizontal tab |
| `\0` | `$00` | Exact null byte, independent of encoding |
| `\xNN` | `$NN` | Exact byte, independent of encoding |

The escape set is closed. The lexer accepts exactly these spellings (→ Ch 01) and preserves every
ordinary literal character as its exact Unicode scalar value. Semantic encoding resolves each
ordinary scalar and symbolic escape through the selected encoding table. It performs no Unicode
normalization, composition, transliteration, replacement-character substitution, or lossy
fallback. Some device-oriented encodings deliberately lack mappings for particular source
characters or for newline, return, and tab. Any missing mapping is **E10249** with guidance to
select an available named encoding or use `\xNN`; it never silently substitutes an ASCII,
PETSCII, ATASCII, or screen-code byte. `\0` and `\xNN` bypass the table and remain exact.

### STR-6 — Mutable String Arrays

A mutable array can be initialized with a string literal:

```blend65
let label: byte[] = "SCORE:";  // mutable, size 6
label[0] = 'H';                // ✅ now "HCORE:"
```

---

## 6. Character Literals

### CL-1 — Character Literals Are Byte Values

A character literal is a `byte` constant encoded using the platform's default encoding and
character map. It must contain exactly one Unicode scalar value or one escape sequence, and the
selected mapping must produce exactly one byte. A missing or non-single-byte mapping is E10249. The
compiler performs no Unicode normalization or replacement; `\0` and `\xNN` remain exact bytes.

```blend65
let ch: byte = 'A';           // platform encoding of 'A'
const SPACE: byte = ' ';      // platform encoding of space
```

```ebnf
char_literal = "'" , ( char_char | escape_seq ) , "'" ;
char_char    = ? any single Unicode scalar value except U+0027, U+005C, U+000D, or U+000A ? ;
escape_seq   = ? U+005C REVERSE SOLIDUS ?
             , ( "n" | "r" | "t" | "0" | ? U+005C REVERSE SOLIDUS ? | '"' | "'"
                         | "x" , hex_digit , hex_digit ) ;
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
    for (let i: byte = 0; i < 40; i += 1) {
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
function sum(data: const byte[]): word {
    let total: word = 0;
    for (let i: word = 0; i < length(data); i += 1) {
        total += word(data[i]);
    }
    return total;
}
```

`byte[]` in a parameter position accepts a fixed byte array of any extent. It is not a dynamic array,
slice, span, view, storable value, or return type. The caller supplies the fixed array's base address
and full 16-bit element count through compiler-managed parameter homes. The callee can index the
original storage and read its full count with `length(data)`.

```blend65
let a: byte[] = [1, 2, 3];
let b: byte[10] = [; 0];
let s1: word = sum(a);    // ✅ compiler passes a and its full length
let s2: word = sum(b);    // ✅ compiler passes b and its full length
```

An unsized parameter may be forwarded to another compatible unsized parameter without copying
elements. It cannot be assigned, stored in an aggregate or module variable, returned, or passed to
an exact `T[N]` parameter because it is not a first-class array value and its extent is not part of
its static type. Mutable-to-const forwarding is allowed; const-to-mutable forwarding is rejected.

---

## 9. `length()` Intrinsic

`length(arrayExpression)` returns the element count of an array-typed expression (→ Ch 04, §9).

| Context | Return | Type | Cost |
|---------|--------|------|------|
| Fixed-size array (`byte[40]`) | 40 | Compile-time constant | 0 cycles |
| Size-inferred array (`byte[] = [1,2,3]`) | 3 | Compile-time constant | 0 cycles |
| Sized parameter (`byte[40]`) | 40 | Compile-time constant | 0 cycles |
| Unsized parameter (`byte[]`) | Caller array's full element count | Runtime `word` | Load compiler-managed count |

**Return type**: always `word`. Fixed-array calls fold to an exact compile-time value, including
zero; unsized-parameter calls read the caller-supplied 16-bit element count. The stable type avoids
changing expression semantics when an array crosses 255 elements. Proof may still use an 8-bit
machine value when the result's range and every use permit it.

`length()` is valid in constant expressions when its argument has a fixed extent:

```blend65
const TABLE: byte[] = [1, 2, 3, 4, 5];
const TABLE_SIZE: word = length(TABLE);    // ✅ = 5, compile-time constant
let copy: byte[length(TABLE)];             // ✅ valid array size
```

`length(data)` for an unsized parameter is a runtime word and therefore is not a constant
expression.

---

## 10. Code Generation

### 10.1 Proven Byte-Offset Direct Access

```blend65
let arr: byte[100];
let val: byte = arr[i];    // read
arr[i] = 42;               // write
```

```asm
; Read
LDX i
LDA arr,X          ; Absolute,X — 4 cycles, or 5 on a page-crossing read; 3 bytes ROM
STA val

; Write
LDX i
LDA #42
STA arr,X          ; Absolute,X store — 5 cycles, 3 bytes ROM
```

### 10.2 Proven Byte-Offset Word-Element Access

```blend65
let addrs: word[64];
let addressLow: byte;
let addressHigh: byte;
// Access addrs[i]
```

```asm
LDA i
ASL A              ; A = i × 2
TAX
LDA addrs,X       ; low byte — 4 cycles, or 5 on page crossing
STA addressLow
LDA addrs+1,X     ; high byte — 4 cycles, or 5 on page crossing
STA addressHigh
; Total shown: 21–26 cycles and 14–17 bytes, depending on ZP/absolute homes and page crossings
```

### 10.3 General 16-Bit Address Formation

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
LDA (ptr),Y        ; indirect indexed with Y=0 — exactly 5 cycles
STA val
; Total shown: 28–31 cycles and 19–22 ROM bytes, depending on ZP/absolute homes,
; plus the compiler-owned 2-byte ZP pointer
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
BPL .fill           ; 403 cycles including setup when the backedge stays on-page; 10 bytes ROM
                    ; 442 cycles if the taken backedge crosses a page (39 extra cycles)
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
; Caller: sum(a) where a has three elements
LDA #<a
STA sum_data_addr        ; address low
LDA #>a
STA sum_data_addr+1      ; address high
LDA #3
STA sum_data_length      ; full element count low
LDA #0
STA sum_data_length+1    ; full element count high
JSR sum
```

An exact `T[N]` parameter has only the two-byte address home. An any-size `T[]` parameter has a
two-byte address home and a two-byte full-element-count home. These are ordinary SFA parameter
storage, not a new source value or runtime object. Placement in zero page is an allocator choice,
not an ABI promise.

---

## 11. Cost Summary

| Operation | Best proven shape | General shape | Notes |
|-----------|-------------------|---------------|-------|
| Byte-element read/write | Direct absolute indexed | 16-bit address formation + indirect access | Selected per access, not array declaration |
| Multi-byte element read/write | Scaled direct offset when range permits | 16-bit scaled address formation | Every accessed byte preserves wrap/MMIO semantics |
| Fill (`N` bytes) | Counted direct loop | Paged/16-bit loop | Initialization strategy is costed separately |
| `length(fixed)` | Compile-time constant | — | Stable semantic type is `word`; machine width may narrow under proof |
| `length(anySizeParam)` | Load carried count | — | Two-byte parameter home; no helper or runtime |
| Exact array parameter | Store two-byte address | — | Exact extent is part of the parameter type |
| Any-size array parameter | Store address + word count | — | Four SFA bytes per concurrent parameter instance |

---

## 12. Diagnostic Conditions

This chapter owns array and string trigger predicates. Chapter 14 alone owns public severities,
message templates, spans, suppression, and history.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10110 | An array extent is not a compile-time constant expression. | The array declaration is rejected. |
| E10112 | An initializer supplies more elements than the declared extent. | The initializer is rejected. |
| E10113 | A const array initializer leaves elements unspecified. | The declaration is rejected because const storage must be fully defined. |
| E10114 | Fill syntax is used where no explicit array extent is available. | The initializer is rejected. |
| E10115 | A fill operand is not one element of the array's element type. | The initializer is rejected. |
| E10116 | One array initializer mixes string literals with individual values. | The initializer is rejected. |
| E10119 | Assignment targets a whole array. | The assignment is rejected. |
| E10120 | A function declares an array return type. | The function is rejected. |
| E10121 | A comparison operator is applied to arrays. | The comparison is rejected. |
| E10122 | A const array argument is passed to a mutable array parameter. | The call is rejected; no mutable alias is created. |
| E10123 | Source mutates an array or struct through a const aggregate parameter. | The write is rejected. |
| E10124 | An encoded string has more bytes than its destination array extent. | The initializer is rejected. |
| E10125 | The selected platform does not define the requested character encoding or immutable map key. | The encoding operation is rejected. |
| E10240 | A compile-time-known index is outside its array extent. | The access is rejected before address generation. |
| E10249 | An ordinary Unicode scalar value or symbolic escape has no valid byte mapping in the selected encoding, or a character literal would map to other than one byte. | The literal is rejected; select a named encoding or use an exact `\xNN` byte. |
| E10251 | The optional character-map argument is not a string literal. | The encoding operation is rejected; select a registered map with a literal key. |
| E10253 | An array storage declaration has neither an explicit extent nor an initializer with a compile-time-known element count. | The declaration is rejected because its storage size and layout cannot be allocated statically. |
| E10263 | An array index has a non-integer type. | The access is rejected; no implicit truthiness, pointer, enum, or aggregate conversion is inserted. |
| E10264 | A compile-time array extent does not produce an integer in `0..65535`. | The array type is rejected before allocation or lowering. |
| E10265 | An array type's complete byte size exceeds 65535. | The array type is rejected before allocation or lowering. |

### Warning Conditions

| Code | Trigger | Consequence |
|------|---------|-------------|
| W10140 | A mutable array initializer defines fewer elements than its extent. | Remaining elements retain indeterminate stored bits. |
| W10141 | A mutable array with a nonzero extent is declared without an initializer. | Every element initially contains indeterminate stored bits. A zero-length array has no element and does not warn. |
| W10143 | A mutable array reaches or crosses the selected profile's array-size warning threshold. | Compilation continues with the measured RAM cost. Const arrays do not consume this mutable-RAM budget and do not trigger W10143. |

---

## 13. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Type system** (→ Ch 02) | Arrays are a derived type. Element types must be valid types. `byte[]` is not a standalone value type outside its extent-inference declaration role and any-size parameter role. |
| **Variables** (→ Ch 03) | Array instances declared with `let`/`const`. `zeropage` placement supported (small arrays). |
| **Operators** (→ Ch 04) | No operators apply to arrays directly. `sizeof` is compile-time; `length` folds for fixed extents and loads the count of an any-size parameter. Element access uses `[]` indexing. |
| **Functions** (→ Ch 06) | Passed by reference (FN-3). Exact parameters carry an address; any-size parameters also carry the full word element count. Arrays cannot be returned (FN-4, E10120). `const` prevents mutation. |
| **Structs** (→ Ch 07) | Arrays as struct fields (inline, contiguous). Struct arrays use index × `sizeof(Type)` addressing. Const parameters apply to both. |
| **Enums** (→ Ch 09) | Enum arrays are supported (`Direction[8]`). As with every array, all four integer types are valid indices; enum values are not implicitly converted into indices. |
| **For loops** (→ Ch 05) | `for (let i: word = 0; i < length(arr); i += 1)` visits every valid index once; proven induction narrowing may still use an 8-bit machine counter. |
| **Modules** (→ Ch 10) | Arrays can be exported. `const` arrays are valid module-level exports. |
| **Memory model** (→ Ch 11) | `let` arrays → RAM segment. `const` arrays → ROM/data segment. `zeropage` arrays → ZP range. |
| **Address-of** (→ Ch 04) | `&arr` returns base address as `word`. `&arr[i]` (element address) deferred to future version. |
| **Platform profile** (→ Ch 15) | Encoding tables, immutable character maps, defaults, and available encoding intrinsics — all defined in platform profile. |

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

function drawLabel(addr: word, label: const byte[]): void {
    for (let i: word = 0; i < length(label); i += 1) {
        poke(addr + i, label[i]);
    }
}

function drawUI(): void {
    drawLabel($0400, SCORE_LABEL);
    drawLabel($0428, LIVES_LABEL);
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
    for (let i: byte = 0; i < MAX_INPUT; i += 1) {
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
    for (let i: word = 0; i < length(RAMP); i += 1) {
        let colorIndex: byte = byte((i + rampOffset) & 7);
        poke($D800 + word(i), RAMP[colorIndex]);
    }
    rampOffset += 1;
}
```
