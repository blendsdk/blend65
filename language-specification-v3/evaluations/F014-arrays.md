# F014 — Arrays, Strings, and Const Parameters

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F003 (module contents), F005 (memory placement), F010 (signed types), F011 (structs)  
> **Interacts with**: F006 (address-of), F008 (for loop), F013 (control flow)  
> **Retroactively updates**: F011 (const parameters replace SR-3)

---

## Description

Arrays are fixed-size, contiguous sequences of elements in memory. Under SFA, every array has a compile-time-known base address and size — no dynamic allocation, no resizing.

This feature also introduces:
- **String literals** as syntactic sugar for `const byte[]` with platform-specific encoding
- **Character literals** (`'A'`) as single-byte values
- **Encoding intrinsics** for explicit character encoding control
- **Const parameters** for safe by-reference passing of const data (applies to both arrays and structs)

```blend65
// Lookup table (const, in ROM/data section)
const SINE_TABLE: byte[256] = [0, 3, 6, 9, 12, 15, ...];

// Entity properties (struct-of-arrays pattern — the 6502 way)
let enemyX: byte[8];
let enemyY: byte[8];
let enemyHP: byte[8];

// String literal → const byte array in platform encoding
const TITLE: byte[] = "GAME OVER";

// Character literal → single byte value
let cursor: byte = '_';
```

---

## Part 1: Arrays

### Syntax

```blend65
// Declaration
let name: type[SIZE];                        // uninitialized mutable
let name: type[SIZE] = [v1, v2, ...];        // explicit values
let name: type[] = [v1, v2, v3];             // size inferred
let name: type[SIZE] = [v1, v2; fill];       // partial values + fill
let name: type[SIZE] = [; fill];             // pure fill
const name: type[SIZE] = [v1, v2, ...];      // const (ROM/data)
const name: type[] = [v1, v2, v3];           // const, size inferred

// Access
arr[index]                                    // read element
arr[index] = value;                          // write element
```

**EBNF:**
```ebnf
array_type     = type_name , "[" , [ const_expr ] , "]" ;
array_init     = string_literal
               | encoded_string
               | "[" , [ init_content ] , "]" ;
init_content   = value_list , [ ";" , fill_expr ]
               | string_in_bracket , ";" , fill_expr
               | ";" , fill_expr ;
value_list     = expression , { "," , expression } ;
string_in_bracket = string_literal | encoded_string ;
fill_expr      = expression ;
array_access   = identifier , "[" , expression , "]" ;
```

### Element Types

| Type | Size per Element | Max Elements (Tier 1) | Use Case |
|------|-----------------|----------------------|----------|
| `byte` | 1 byte | 256 | Entity properties, lookup tables, screen data |
| `word` | 2 bytes | 128 | Address tables, jump tables, score arrays |
| `sbyte` | 1 byte | 256 | Signed deltas, sine tables (-128..127) |
| `sword` | 2 bytes | 128 | Signed offsets, large delta tables |
| `boolean` | 1 byte | 256 | Flag arrays (alive/dead, visible/hidden) |

Arrays of structs are **deferred** — see Future Considerations. The struct-of-arrays (SoA) pattern is the idiomatic 6502 approach and should be preferred.

### Rules

#### AR-1: Size Must Be Compile-Time Constant

Array size must be a compile-time constant — a numeric literal or a `const` value:

```blend65
const MAX_ENEMIES: byte = 8;
let enemies: byte[MAX_ENEMIES];         // ✅ const value
let buffer: byte[40];                    // ✅ literal
let data: byte[someVariable];           // ❌ E10110: size must be compile-time constant
```

#### AR-2: Size Must Be At Least 1

```blend65
let empty: byte[0];   // ❌ E10111: array size must be at least 1
```

#### AR-3: Two-Tier Codegen Model

Arrays are compiled using one of two strategies based on **total byte size** (element count × element size):

| Tier | Total Bytes | Index Type | Addressing Mode | Cost |
|------|------------|------------|-----------------|------|
| **Tier 1** | ≤ 256 | `byte` | Absolute,X / Absolute,Y | 4 cycles |
| **Tier 2** | > 256 | `word` | (ZP),Y indirect | 5-6 cycles + 2 ZP bytes |

The compiler automatically selects the tier. The developer must use the correct index type:

```blend65
let small: byte[100];     // 100 bytes → Tier 1
small[byteIndex] = 42;    // ✅ byte index
small[wordIndex] = 42;    // ❌ E10117: requires byte index

let large: byte[1000];    // 1000 bytes → Tier 2
large[wordIndex] = 42;    // ✅ word index
large[byteIndex] = 42;    // ❌ E10118: requires word index
```

Word arrays at the tier boundary: `word[128]` = 256 bytes → Tier 1. `word[129]` = 258 bytes → Tier 2.

#### AR-4: Index Must Be Unsigned

Array indices must be `byte` or `word` (unsigned). Signed types (`sbyte`, `sword`) are rejected:

```blend65
let i: sbyte = 5;
arr[i];            // ❌ E10085: array index must be unsigned (byte or word)
arr[byte(i)];      // ✅ explicit cast
```

(Error E10085 defined in F010.)

#### AR-5: No Whole-Array Assignment

```blend65
let a: byte[10];
let b: byte[10];
a = b;             // ❌ E10119: cannot assign whole array — copy elements individually
```

**Rationale**: Hidden loop violates A4 (explicit over implicit) and H2 (cost transparency). Use a for loop:

```blend65
for (i: byte = 0 to length(a)) {
    a[i] = b[i];
}
```

#### AR-6: No Array Comparison

```blend65
if (a == b) { ... }  // ❌ E10121: cannot compare arrays — compare elements individually
```

#### AR-7: No Array Returns

```blend65
function getTable(): byte[4] { ... }  // ❌ E10120: cannot return array type — use parameter
```

Use an output parameter:

```blend65
function fillTable(out: byte[4]): void {
    out[0] = 10;
    out[1] = 20;
    out[2] = 30;
    out[3] = 40;
}
```

#### AR-8: Bounds Checking

**Compile-time**: When the index is a compile-time constant, the compiler checks it against array size. Out-of-bounds constant index is a compile error.

**Runtime**: No bounds checking by default (too expensive for 6502). The compiler flag `--bounds-check` enables runtime checks for debugging — inserts compare-and-trap code before each access. This is a debug tool, not for production.

**Without `--bounds-check`**: Out-of-bounds runtime access wraps modulo the addressing space. Behavior is defined (not undefined) but undesirable — the developer is responsible for correct indices.

---

## Part 2: Array Initialization

### The `[values; fill]` Model

The semicolon `;` inside brackets means **"fill the remaining elements with this value"**:

```blend65
byte[SIZE] = [explicit_values; fill_value]
//            ^^^^^^^^^^^^^^^^  ^^^^^^^^^^
//            placed first       fills remaining elements up to SIZE
```

**The fill value is always a single compile-time constant element** — not a string, not an array.

**The array must have an explicit size** when using fill — the compiler needs to know how many elements to fill.

### Complete Initialization Reference

#### Group A: Value Arrays

```blend65
let a: byte[] = [1, 2, 3];              // ✅ Size inferred = 3
let b: byte[5] = [1, 2, 3, 4, 5];       // ✅ Exact match
let c: byte[5] = [1, 2, 3; 0];          // ✅ [1, 2, 3, 0, 0] — fill rest with 0
let d: byte[5] = [; 0];                 // ✅ [0, 0, 0, 0, 0] — pure fill
let e: byte[5] = [; $FF];               // ✅ [$FF, $FF, $FF, $FF, $FF]
let f: byte[5] = [1, 2, 3];             // ⚠️ W10140: partial init (bytes 3-4 indeterminate)
let g: byte[2] = [1, 2, 3];             // ❌ E10112: 3 values exceed size 2
let h: byte[] = [1, 2, 3; 0];           // ❌ E10114: fill requires explicit size
```

#### Group B: Character Literals in Values

```blend65
let i: byte[] = ['H', 'I'];             // ✅ Size = 2, platform encoding
let j: byte[5] = ['H', 'I'; ' '];       // ✅ [H, I, space, space, space]
let k: byte[40] = [; 'A'];              // ✅ All 40 bytes = encoding of 'A'
let l: byte[40] = [; petscii('.')];      // ✅ All 40 bytes = PETSCII '.'
```

#### Group C: String Initialization

```blend65
let m: byte[] = "HELLO";                 // ✅ Size inferred = 5
let n: byte[10] = "HELLO";              // ⚠️ W10140: partial init (bytes 5-9 indeterminate)
let o: byte[10] = ["HELLO"; 0];         // ✅ [H,E,L,L,O, 0,0,0,0,0] — fill rest
let p: byte[10] = ["HELLO"; ' '];       // ✅ [H,E,L,L,O, sp,sp,sp,sp,sp] — space-padded
let q: byte[3] = "HELLO";              // ❌ E10124: string (5 bytes) exceeds array size (3)
let r: byte[] = ["HELLO"; 0];           // ❌ E10114: fill requires explicit size
```

#### Group D: Encoded Strings

```blend65
let s: byte[] = petscii("HELLO");                        // ✅ PETSCII encoded, size = 5
let t: byte[10] = [petscii("LOADING"); petscii('.')];    // ✅ 7 PETSCII + 3 PETSCII dots
let u: byte[10] = [screen_codes("SCORE"); screen_codes(' ')]; // ✅ 5 screen + 5 spaces
let v: byte[] = [petscii("HI"); 0];                      // ❌ E10114: fill requires explicit size
```

#### Group E: Invalid Combinations

```blend65
let w: byte[] = ["HELLO", "WORLD"];          // ❌ E10116: cannot mix/concatenate strings
let x: byte[] = [1, "HI", 3];               // ❌ E10116: cannot mix strings and values
let y: byte[5] = [1, 2; "HI"];              // ❌ E10115: fill must be single element
let z: byte[5] = [; petscii("X")];          // ❌ E10115: fill must be single element (use 'X')
```

#### Group F: Const-Specific Rules

```blend65
const a: byte[] = [1, 2, 3];                // ✅ Fully initialized
const b: byte[] = "HELLO";                  // ✅ Fully initialized
const c: byte[5] = [1, 2, 3; 0];            // ✅ Fill completes it
const d: byte[5] = [1, 2, 3];               // ❌ E10113: const must be fully initialized
```

### Uninitialized Warning (W10141)

```blend65
let buf: byte[40];          // ⚠️ W10141: uninitialized array — all elements indeterminate
let buf: byte[40] = [; 0];  // ✅ No warning — explicitly filled
```

---

## Part 3: String Literals

String literals are syntactic sugar for `const byte[]` arrays. There is no `string` type.

### Rules

#### STR-1: String Literals Produce Byte Arrays

```blend65
const MSG: byte[] = "HELLO";
// Equivalent to: const MSG: byte[] = [72, 69, 76, 76, 79];
// (byte values depend on platform encoding)
```

The compiler encodes the string using the platform profile's `defaultStringEncoding` setting.

#### STR-2: Platform Default Encoding

The platform profile defines the default encoding:

| Platform | Default Encoding | Available Encodings |
|----------|-----------------|-------------------|
| C64 | `screen_codes` | `petscii`, `screen_codes` |
| C64 Ultimate | `screen_codes` | `petscii`, `screen_codes` |
| CX16 | `screen_codes` | `petscii`, `screen_codes` |
| Atari 800XL | `internal_codes` | `atascii`, `internal_codes` |
| Atari 7800 | `raw` | `raw` (no encoding — ASCII values pass through) |

The default can be overridden in the platform profile configuration.

#### STR-3: Encoding Intrinsics (Cast-Style)

To use a non-default encoding, use the encoding intrinsic:

```blend65
// Platform default encoding:
const TITLE: byte[] = "GAME OVER";

// Explicit encoding:
const KERNAL_MSG: byte[] = petscii("HELLO");         // PETSCII for KERNAL I/O
const SCREEN_MSG: byte[] = screen_codes("SCORE:");   // Screen codes for direct screen write
const ATARI_MSG: byte[] = atascii("READY");          // ATASCII for Atari I/O
```

Encoding intrinsics are polymorphic:

| Input | Output | Example |
|-------|--------|---------|
| String literal `"..."` | `byte[]` (array of encoded bytes) | `petscii("HI")` → `byte[2]` |
| Character literal `'.'` | `byte` (single encoded byte) | `petscii('.')` → `byte` |

Using an encoding not available for the target platform is a compile error:

```blend65
// Compiling for Atari 800XL:
const MSG: byte[] = petscii("HI");  // ❌ E10125: unknown encoding 'petscii' for platform 'a800xl'
```

#### STR-4: Raw Bytes, No Automatic Termination

String literals produce raw bytes — no null terminator, no length prefix:

```blend65
const MSG: byte[] = "HELLO";
// Result: [H, E, L, L, O] — 5 bytes, no terminator

// Add null terminator explicitly if needed:
const MSG_Z: byte[] = "HELLO\0";
// Result: [H, E, L, L, O, 0] — 6 bytes

// length() returns the element count:
// length(MSG) = 5
// length(MSG_Z) = 6
```

#### STR-5: Escape Sequences

| Escape | Value | Description |
|--------|-------|-------------|
| `\\` | `$5C` | Literal backslash |
| `\"` | Encoding of `"` | Double quote |
| `\0` | `$00` | Null byte |
| `\xNN` | `$NN` | Arbitrary hex byte value |

No `\n`, `\t`, `\r` — these are meaningless on screen-mapped 6502 displays.

#### STR-6: Double Quotes for Strings

Strings use double quotes `"..."`. Single quotes are reserved for character literals `'A'`.

---

## Part 4: Character Literals

Character literals are single-byte values written in single quotes.

### Syntax

```blend65
'A'        // byte value of 'A' in platform default encoding
'.'        // byte value of '.'
'\0'       // null byte (0)
'\\'       // backslash
'\''       // single quote
'\x41'     // explicit hex value 0x41
```

**EBNF:**
```ebnf
char_literal = "'" , ( char_char | escape_seq ) , "'" ;
char_char    = ? any printable character except ' and \ ? ;
escape_seq   = "\\" | "\'" | "\0" | "\x" , hex_digit , hex_digit ;
```

### Rules

#### CL-1: Character Literals Are Byte Values

A character literal is a `byte` constant. It is encoded using the platform's default encoding:

```blend65
let ch: byte = 'A';           // Same as: let ch: byte = 65; (on ASCII-based platforms)
const SPACE: byte = ' ';      // Platform encoding of space character
```

#### CL-2: Encoding Intrinsics on Characters

```blend65
let ch: byte = petscii('A');          // PETSCII value of 'A'
let sc: byte = screen_codes('A');     // Screen code value of 'A' (= 1 on C64)
```

#### CL-3: Character Literals in Array Initializers

Character literals can be used anywhere a byte expression is expected:

```blend65
let greeting: byte[] = ['H', 'E', 'L', 'L', 'O'];  // Same as "HELLO"
let padded: byte[40] = ["SCORE:"; ' '];              // Fill rest with spaces
```

---

## Part 5: Const Parameters

Const parameters solve a critical safety problem: arrays and structs are passed by reference, but `const` arrays/structs live in ROM. Writing to ROM is catastrophic on 6502 — either silently ignored or corrupts hardware state.

### Syntax

```blend65
function readOnly(data: const byte[]): void {
    let x: byte = data[0];     // ✅ Read OK
    data[0] = 42;              // ❌ E10123: cannot modify const parameter
}

function readWrite(data: byte[]): void {
    data[0] = 42;              // ✅ Write OK
}
```

### Rules

#### CP-1: Const Qualifier on Parameters

The `const` keyword before the type in a parameter declaration makes it read-only:

```blend65
function display(msg: const byte[], enemy: const Enemy): void {
    // Can read msg[i] and enemy.hp — cannot modify them
}
```

#### CP-2: Passing Rules

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
readWrite(TABLE);     // ❌ E10122: cannot pass const 'TABLE' to mutable parameter 'data'
```

#### CP-3: Applies to Structs Too

This rule retroactively updates F011 (Structs). The previous SR-3 ("const structs cannot be passed as parameters") is replaced:

```blend65
// OLD (F011 v1): const structs required copying first
const DEFAULT: Enemy = { x: 0, y: 0, hp: 100, enemyType: 0, frame: 0 };
let temp: Enemy = DEFAULT;
display(temp);                    // Had to copy first

// NEW (F014): use const parameter
function display(e: const Enemy): void {
    let hp: byte = e.hp;         // ✅ Read OK
    e.hp = 0;                    // ❌ E10123: cannot modify const parameter
}
display(DEFAULT);                 // ✅ const → const param, no copy needed
```

#### CP-4: Zero Runtime Cost

The `const` modifier is a compile-time-only check. The generated code is identical for `const` and mutable parameters — the compiler simply refuses to emit store instructions targeting const parameters.

#### CP-5: Const Propagation Through Field/Element Access

```blend65
function inspect(e: const Enemy): void {
    e.hp = 50;                   // ❌ E10123: e is const
    e.pos.x = 100;              // ❌ E10123: e is const (nested field)
}

function readTable(t: const byte[256]): void {
    t[0] = 42;                  // ❌ E10123: t is const
    let v: byte = t[0];         // ✅ Read OK
}
```

---

## Part 6: Function Parameters

### Sized Parameters

```blend65
function clear(buf: byte[40]): void {
    for (i: byte = 0 to 40) {
        buf[i] = 0;
    }
}
```

The parameter specifies an exact size. The compiler enforces that the argument matches:

```blend65
let screen: byte[40];
let small: byte[10];
clear(screen);     // ✅ byte[40] → byte[40]
clear(small);      // ❌ E-size: array size mismatch — expected 40, found 10
```

`length(buf)` inside the function returns the compile-time constant 40.

### Unsized Parameters

```blend65
function sum(data: const byte[], len: byte): byte {
    let total: byte = 0;
    for (i: byte = 0 to len) {
        total = total + data[i];
    }
    return total;
}
```

`byte[]` without a size accepts any byte array. The compiler passes the array address. The developer passes the length manually (or uses `length()` at the call site).

```blend65
let a: byte[] = [1, 2, 3];
let b: byte[10] = [; 0];
let s1: byte = sum(a, length(a));    // ✅ length(a) = 3
let s2: byte = sum(b, length(b));    // ✅ length(b) = 10
```

### Parameter Codegen

Arrays are passed by reference (compiler passes the address):

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

Cost: 2 ZP bytes for pointer + 1 byte for length parameter.

---

## Part 7: `length()` Intrinsic

`length(array)` returns the element count of an array.

| Context | Return | Type | Cost |
|---------|--------|------|------|
| Fixed-size array (`byte[40]`) | 40 | Compile-time constant | 0 cycles |
| Size-inferred array (`byte[] = [1,2,3]`) | 3 | Compile-time constant | 0 cycles |
| Sized parameter (`byte[40]`) | 40 | Compile-time constant | 0 cycles |
| Unsized parameter (`byte[]`) | Caller-passed value | Runtime `byte` or `word` | 1 LDA |

```blend65
const TABLE: byte[] = [10, 20, 30, 40, 50];

for (i: byte = 0 to length(TABLE)) {   // length = 5, compile-time
    poke($0400 + word(i), TABLE[i]);
}
```

---

## 6502 Code Generation

### Tier 1: Byte Array Read (≤256 bytes)

```blend65
let arr: byte[100];
let val: byte = arr[i];
```

```asm
LDX i
LDA arr,X          ; Absolute,X — 4 cycles, 3 bytes ROM
STA val
```

### Tier 1: Byte Array Write

```blend65
arr[i] = 42;
```

```asm
LDX i
LDA #42
STA arr,X          ; 4 cycles, 3 bytes ROM
```

### Tier 1: Word Array Read

```blend65
let addrs: word[64];
let lo: byte;
let hi: byte;
// Access addrs[i]: need offset = i * 2
```

```asm
LDA i
ASL A              ; A = i * 2
TAX
LDA addrs,X       ; Low byte — 4 cycles
STA lo
LDA addrs+1,X     ; High byte — 4 cycles
STA hi
; Total: ~12 cycles
```

### Tier 2: Large Array Read (>256 bytes)

```blend65
let screen: byte[1000];
let val: byte = screen[pos];  // pos is word
```

```asm
; Set up ZP pointer: base + index
LDA #<screen
CLC
ADC pos_lo         ; Add index low byte
STA ptr
LDA #>screen
ADC pos_hi         ; Add index high byte (with carry)
STA ptr+1
LDY #0
LDA (ptr),Y        ; Indirect indexed — 5-6 cycles
STA val
; Total: ~20 cycles + 2 ZP bytes
```

### Fill Initialization

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

### Partial Initialization with Fill

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

### Const Array Access (Optimization)

```blend65
const TABLE: byte[] = [10, 20, 30, 40, 50];
let x: byte = TABLE[2];
```

The compiler MAY constant-fold this to:

```asm
LDA #30             ; Compile-time lookup: TABLE[2] = 30
STA x
```

---

## Cost Summary

| Operation | Tier 1 (≤256B) | Tier 2 (>256B) | Notes |
|-----------|---------------|----------------|-------|
| Element read | 4 cycles | 20 cycles | +2 ZP bytes for Tier 2 |
| Element write | 4 cycles | 20 cycles | +2 ZP bytes for Tier 2 |
| Word element read | 12 cycles | 24 cycles | Index multiply by 2 (shift) |
| Fill (N bytes) | ~5N cycles | ~5N cycles | Init loop |
| length() | 0 cycles | 0 cycles | Compile-time constant |
| Array param passing | ~10 cycles | ~10 cycles | Set up ZP pointer |

---

## Resolved Ambiguities

### AR-A1: Can you put arrays inside structs?

**Yes.** Array fields are inline, contiguous:

```blend65
struct HighScoreEntry {
    name: byte[3];     // 3 bytes inline
    score: word;       // 2 bytes
}
// sizeof(HighScoreEntry) = 5
```

Access: `entry.name[1]` computes `&entry + offset_of_name + 1`.

### AR-A2: Arrays of structs?

**Deferred.** The struct-of-arrays pattern is idiomatic on 6502:

```blend65
// ❌ Deferred: let enemies: Enemy[8];    // requires multiply by sizeof(Enemy)
// ✅ Preferred: struct-of-arrays
let enemyX: byte[8];
let enemyY: byte[8];
let enemyHP: byte[8];
```

(Note: F011 showed examples with arrays of structs. Those examples illustrate potential future syntax but are not part of the v3 core language.)

### AR-A3: Multidimensional arrays?

**Deferred.** Use flat arrays with manual index computation:

```blend65
let grid: byte[200];  // 8×25 grid
// Access grid[row][col]:
grid[row * 8 + col] = value;  // developer computes index manually
```

### AR-A4: Can strings be mutable?

**Yes.** A mutable array can be initialized with a string literal:

```blend65
let label: byte[] = "SCORE:";  // mutable, size 6
label[0] = 'H';                // ✅ now "HCORE:"
```

### AR-A5: What about arrays in zeropage?

**Allowed but small.** Zero-page is precious — arrays in ZP should be small scratch buffers:

```blend65
zeropage {
    fastBuf: byte[4];     // 4 bytes of fast ZP storage
}
```

The existing W10030 (ZP budget warning) applies. Large ZP arrays will trigger the warning.

### AR-A6: Can `length()` be used in constant expressions?

**Yes.** For fixed-size arrays, `length()` is a compile-time constant:

```blend65
const TABLE: byte[] = [1, 2, 3, 4, 5];
const TABLE_SIZE: byte = length(TABLE);    // ✅ = 5, compile-time constant
let copy: byte[length(TABLE)];             // ✅ valid array size
```

### AR-A7: What is the type of `length()`?

For arrays ≤256 elements: `byte`. For arrays >256 elements: `word`. The compiler selects based on the array's declared size.

### AR-A8: Can you take `&` of an array?

**Yes.** `&arr` returns the base address as `word` (defined in F006):

```blend65
let buf: byte[40];
let addr: word = &buf;     // ✅ base address of array
```

`&arr[i]` (address of element) remains deferred (F006, E10042).

### AR-A9: Default encoding choice rationale

Games overwhelmingly write directly to screen memory, not through OS I/O routines. Therefore:
- C64/CX16: Default is `screen_codes` (not PETSCII)
- Atari 800XL: Default is `internal_codes` (not ATASCII)
- Atari 7800: Default is `raw` (no standard encoding)

Developers using KERNAL/OS output routines use the encoding intrinsic explicitly: `petscii("HELLO")`.

### AR-A10: Encoding intrinsic availability

Encoding intrinsics are platform-specific. The platform profile defines which are available:

| Intrinsic | C64 | CX16 | Atari 800XL | Atari 7800 |
|-----------|-----|------|-------------|------------|
| `petscii()` | ✅ | ✅ | ❌ | ❌ |
| `screen_codes()` | ✅ | ✅ | ❌ | ❌ |
| `atascii()` | ❌ | ❌ | ✅ | ❌ |
| `internal_codes()` | ❌ | ❌ | ✅ | ❌ |

Using an unavailable intrinsic → E10125.

---

## Error Codes

| Code | Message |
|------|---------|
| E10110 | Array size must be a compile-time constant expression — found `<expr>` |
| E10111 | Array size must be at least 1 — found `<size>` |
| E10112 | Array initializer has `<N>` elements but array size is `<M>` |
| E10113 | Const array must be fully initialized — `<N>` elements provided for size `<M>`. Use fill syntax: `[values; fill]` |
| E10114 | Fill syntax `[...; fill]` requires explicit array size — use `type[N] = [values; fill]` |
| E10115 | Fill value must be a single element — found string or array |
| E10116 | Cannot mix string literals with value elements in array initializer |
| E10117 | Array `<name>` (≤256 bytes) requires `byte` index — found `<type>` |
| E10118 | Array `<name>` (>256 bytes) requires `word` index — found `<type>` |
| E10119 | Cannot assign whole array — copy elements individually using a loop |
| E10120 | Cannot return array type from function — use an array parameter instead |
| E10121 | Cannot compare arrays with `<op>` — compare individual elements |
| E10122 | Cannot pass const `<name>` to mutable parameter `<param>` — add `const` to parameter or copy to mutable variable |
| E10123 | Cannot modify const parameter `<name>` — parameter is declared `const` |
| E10124 | String literal (`<N>` bytes) exceeds array size (`<M>`) |
| E10125 | Unknown encoding `<name>` for platform `<platform>` — available: `<list>` |

### Warning Codes

| Code | Message |
|------|---------|
| W10140 | Partially initialized array `<name>` — `<N>` of `<M>` elements initialized, remaining are indeterminate |
| W10141 | Uninitialized array `<name>` — all `<N>` elements are indeterminate |
| W10142 | Array `<name>` (`<N>` bytes) uses indirect addressing — access is slower than direct indexed arrays (≤256 bytes) |
| W10143 | Large array `<name>` (`<N>` bytes) on platform `<platform>` — consider total RAM budget |

---

## Feature Interactions

| Feature | Interaction |
|---------|------------|
| F003 Module contents | Arrays/consts at module level. length() as constant expression |
| F005 Memory placement | `let` → RAM, `const` → data/ROM, `zeropage { arr: byte[4]; }` → ZP |
| F006 Address-of | `&arr` → word (base address). `&arr[i]` deferred (E10042) |
| F008 For loop | `for (i = 0 to length(arr))` — natural array iteration pattern |
| F010 Signed types | Signed types valid as elements. Signed indices rejected (E10085) |
| F011 Structs | Arrays as struct fields. Const params apply to both. No struct arrays in v3 |
| F013 Control flow | Arrays in conditions via element access: `if (arr[i] == target)` |
| Platform profiles | Encoding tables, default encoding, available encoding intrinsics |

---

## Examples

### Example 1: Lookup Table (Sine Wave)

```blend65
module tables;

export const SINE_TABLE: byte[256] = [
    128, 131, 134, 137, 140, 143, 146, 149,
    152, 155, 158, 162, 165, 168, 171, 174,
    // ... (256 values representing sin(x) scaled to 0-255)
    125, 128
];

export function getSine(angle: byte): byte {
    return SINE_TABLE[angle];
}
```

### Example 2: Entity Management (Struct-of-Arrays)

```blend65
module entities;

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
        entityCount = entityCount + 1;
    }
}

function updateAll(): void {
    for (i: byte = 0 to entityCount) {
        if (entityActive[i]) {
            entityY[i] = entityY[i] + 1;
            if (entityY[i] == 0) {
                entityActive[i] = false;
            }
        }
    }
}
```

### Example 3: Screen Output with Strings

```blend65
module ui;

const SCORE_LABEL: byte[] = screen_codes("SCORE:");
const LIVES_LABEL: byte[] = screen_codes("LIVES:");

function drawLabel(screen_addr: word, label: const byte[], len: byte): void {
    for (i: byte = 0 to len) {
        poke(screen_addr + word(i), label[i]);
    }
}

function drawUI(): void {
    drawLabel($0400, SCORE_LABEL, length(SCORE_LABEL));
    drawLabel($0428, LIVES_LABEL, length(LIVES_LABEL));
}
```

### Example 4: Buffered Input

```blend65
module input;

const MAX_INPUT: byte = 20;
let inputBuffer: byte[MAX_INPUT] = [; ' '];   // space-filled
let inputPos: byte = 0;

function addChar(ch: byte): void {
    if (inputPos < MAX_INPUT) {
        inputBuffer[inputPos] = ch;
        inputPos = inputPos + 1;
    }
}

function clearInput(): void {
    for (i: byte = 0 to MAX_INPUT) {
        inputBuffer[i] = ' ';
    }
    inputPos = 0;
}
```

### Example 5: Color Ramp Animation

```blend65
module effects;

const RAMP: byte[] = [0, 11, 12, 15, 1, 15, 12, 11];
let rampOffset: byte = 0;

function cycleColors(): void {
    for (i: byte = 0 to length(RAMP)) {
        let colorIndex: byte = (i + rampOffset) & 7;  // Wrap at 8
        poke($D800 + word(i), RAMP[colorIndex]);
    }
    rampOffset = rampOffset + 1;
}
```

---

## Language Guard Verdict

### Platform Universality (P)

| Rule | Status | Notes |
|------|--------|-------|
| P1 Cross-platform compilable | ✅ | Fixed-size arrays are universal. Two-tier codegen works on all 6502 platforms |
| P2 Platform-meaningful | ✅ | Lookup tables, entity arrays, screen buffers — core game dev patterns on every platform |
| P3 No platform assumptions | ✅ | Core array semantics are platform-neutral. Encoding is via platform profiles |
| P4 Resource-scalable | ✅ | W10142 warns about large arrays. W10143 warns about RAM budget. Tier 2 codegen scales naturally |

### Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅ | Absolute,X for Tier 1; (ZP),Y for Tier 2 — native 6502 addressing modes |
| H2 Cost transparency | ✅ | Full cost table. Tier boundary clearly documented. Compiler warns about tier transitions |
| H3 SFA compatible | ✅ | All arrays fixed-size, compile-time-known addresses. No dynamic allocation |
| H4 Memory footprint documented | ✅ | Element size × count = total bytes. ZP cost for Tier 2 documented |
| H5 Fully deterministic | ✅ | Out-of-bounds with --bounds-check: defined trap. Without: wrapping (defined). Const params prevent ROM writes |

### Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅ | `type[size]`, `arr[index]`, `[values; fill]` — all unambiguous in EBNF |
| L2 Consistent with existing | ✅ | Same `name: type` pattern. Const/let distinction. Cast-style encoding intrinsics match F010 |
| L3 Beginner-friendly | ✅ | Arrays, strings, character literals — familiar from C/TS/Java |
| L4 Minimal feature | ✅ | No struct arrays, no multidimensional, no dynamic sizing. Minimum viable arrays |
| L5 No redundancy | ✅ | No overlap with existing features. String literals are sugar, not a separate type |
| L6 Error messages defined | ✅ | 16 error codes + 4 warning codes |
| L7 Compile-time failure preferred | ✅ | Size checks, type checks, const safety — all at compile time |
| L8 Feature interaction documented | ✅ | All interactions listed |
| L9 Documentable with examples | ✅ | 5 examples: sine table, entity management, screen output, input buffer, color animation |

### Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅ | `[`, `]` brackets, `;` for fill separator, `'c'` for char literals — standard tokenization |
| C2 Semantic analysis defined | ✅ | Size validation, tier selection, index type checking, const propagation — all specified |
| C3 Code generation strategy | ✅ | Both tiers fully documented with assembly patterns |
| C4 Unit testable | ✅ | Each init form, each tier, each error — independently testable |
| C5 Runtime verifiable | ✅ | Array contents deterministic; emulator-testable on all platforms |

### Future-Proofing (F)

| Rule | Status | Notes |
|------|--------|-------|
| F1 Extensible | ✅ | Struct arrays, multidimensional, compile-time generation — all addable without breaking changes |
| F2 Platform-profile ready | ✅ | Encoding tables, available intrinsics, RAM budgets — all via profiles |
| F3 Optimizer-friendly | ✅ | Const-fold for constant indices. Strength reduction for word index multiply |
| F4 Stability classification | ✅ | Classified as **stable** |

### Escape Hatches Applied

None. All 23 rules pass.

### Verdict

**✅ ACCEPTED** — Arrays provide the minimal, 6502-native data structure with two-tier codegen matching the hardware's indexed addressing capabilities. String literals integrate as byte arrays with platform-specific encoding. Const parameters close a critical safety gap for by-reference passing. The `[values; fill]` initialization model is clean and explicit.
