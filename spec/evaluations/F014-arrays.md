# F014 — Arrays, Strings, and Const Parameters

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F003 (module contents), F005 (memory placement), F010 (signed types), F011 (structs)  
> **Interacts with**: F006 (address-of), F008 (for loop), F013 (control flow)  
> **Retroactively updates**: F011 (const parameters replace SR-3)

---

## Description

Every stored array object is a fixed-size, contiguous sequence whose storage and extent are known at
compile time; there is no dynamic allocation or resizing. An any-size array parameter is not a new
stored array object: its SFA home receives the fixed caller object's runtime base address and element
count.

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
array_type        = array_element_type , "[" , [ const_expression ] , "]" ;
array_element_type = integer_type | "boolean" | qualified_name ;
array_literal     = "[" , [ array_init_content ] , "]" ;
array_init_content = expression , { "," , expression }
                   | expression , { "," , expression } , ";" , expression
                   | ";" , expression ;
```

Array indexing uses the master grammar's `"[" , expression , "]"` `postfix_op` alternative; this
fragment does not define a competing expression production.

### Element Types

| Type | Size per Element | Elements in a 256-byte direct-offset window | Use Case |
|------|-----------------|---------------------------------------------|----------|
| `byte` | 1 byte | 256 | Entity properties, lookup tables, screen data |
| `word` | 2 bytes | 128 | Address tables, jump tables, score arrays |
| `sbyte` | 1 byte | 256 | Signed deltas, sine tables (-128..127) |
| `sword` | 2 bytes | 128 | Signed offsets, large delta tables |
| `boolean` | 1 byte | 256 | Flag arrays (alive/dead, visible/hidden) |
| Enum type | 1 byte | 256 | Nominal state, kind, and mode tables |

Arrays accept non-`void` primitive, enum, and struct element types. Arrays of structs are part of
v3 (F011 and Chapter 07). A struct-of-arrays (SoA) layout is often
faster when a hot loop touches only a few fields, but that is a cost-guided layout choice rather
than a language restriction. The compiler must preserve either source layout and report the
addressing cost.

### Rules

#### AR-1: Size Must Be Compile-Time Constant

Array size must be a compile-time constant — a numeric literal or a `const` value:

```blend65
const MAX_ENEMIES: byte = 8;
let enemies: byte[MAX_ENEMIES];         // ✅ const value
let buffer: byte[40];                    // ✅ literal
let data: byte[someVariable];           // ❌ E10110: size must be compile-time constant
```

The extent expression is evaluated at full precision and must produce an integer in `0..65535`;
otherwise E10264 rejects the type. The compiler then computes the complete array byte size at full
precision. E10265 rejects a type larger than 65535 bytes, including a `word` or struct array whose
element count itself fits. These are compile-time representation limits and add no runtime checks.

An omitted extent is legal for an unsized function parameter and for a declaration whose
initializer supplies a compile-time-known element count. A module/local storage declaration without
such an initializer, and every struct field, requires an explicit extent; otherwise E10253 rejects
the declaration. Explicit `[0]` and empty extent-inferencing initializers remain valid.

#### AR-2: Zero-Length Arrays

```blend65
let empty: byte[0];          // ✅ zero storage bytes
const noBytes: byte[] = ""; // ✅ inferred extent 0
```

A zero-length array has length zero and emits no data bytes. Its label remains a valid
position marker, but no byte at that address belongs to the array. A known index is E10240; a
runtime access follows the selected unchecked or `--bounds-check` policy.

#### AR-3: Storage Size Does Not Select Source Index Type

All four integer types may index every array. The index is an element ordinal; total byte size
affects placement, resource accounting, and profitable lowering but never source legality.

```blend65
let small: byte[100];
small[byteIndex] = 42;     // ✅
small[wordIndex] = 42;     // ✅

let large: byte[1000];
large[byteIndex] = 42;     // ✅ ordinals representable by this byte value
large[wordIndex] = 42;     // ✅ full word ordinal
```

The compiler chooses direct indexed or general 16-bit address formation per access from range,
element-size, placement, and register facts. It may narrow only under proof that every source value
and effective address remains identical.

#### AR-4: Index-Ordinal Expression Context

Direct integer-producing operations inside `array[...]` are evaluated in a local 16-bit-capable
ordinal context. Before unary `~` or `-`, or binary `+`, `-`, `*`, `/`, `%`, `<<`, `>>`, `&`, `|`,
or `^` evaluates without a narrow barrier, `byte` becomes `word` and `sbyte` becomes `sword`.
Unsigned unary minus remains illegal; comparisons and logical operators produce `boolean` and are
therefore invalid indices:

```blend65
let data: byte[500];
let shifted: byte[600];
let i: byte = 255;
data[i + 10];          // ✅ ordinal 265
shifted[i << 1];        // ✅ ordinal 510
data[510];              // ❌ E10240: ordinal 510 is outside data[0..499]
data[byte(i + 10)];    // ✅ explicit narrow barrier, ordinal 9
```

Parentheses and selected conditional arms propagate the context. Explicit 8-bit casts, typed
8-bit assignment/compound assignment, and arithmetic completed inside a called function are
deliberate narrow barriers. Mixed signedness keeps its ordinary explicit-cast rule. A known
negative or out-of-extent ordinal is E10240. Checked runtime access tests signed lower and upper
bounds; unchecked signed access sign-extends into the 16-bit address calculation. Proof may keep
the emitted work byte-only or consume carry directly without creating a source-visible word.

#### AR-5: No Whole-Array Assignment

```blend65
let a: byte[10];
let b: byte[10];
a = b;             // ❌ E10119: cannot assign whole array — copy elements individually
```

**Rationale**: Hidden loop violates A4 (explicit over implicit) and H2 (cost transparency). Use a for loop:

```blend65
for (let i: word = 0; i < length(a); i += 1) {
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

**Compile-time**: When the compiler can prove an index is outside the array extent, compilation
fails. The canonical diagnostic is defined in Chapter 14.

**Runtime, default**: No implicit check, trap, clamp, or reduction modulo the array length is
emitted. The effective address is `(base + index * elementSize) modulo 65536`. A multi-byte element
continues byte by byte across `$FFFF` to `$0000`; active platform banking, ROM, RAM, and MMIO effects
remain observable. The optimizer may use a sound range proof but may never assume an unproved index
is in range.

**Runtime, `--bounds-check`**: This independent, default-off development option emits an inline
check before effective-address formation or any memory/MMIO effect. The index and address operands
are evaluated once. A failure enters the platform's source-labelled, non-returning safety stop; it
does not call a linked runtime, trap handler, or user callback. A sound proof removes the check.
The build report lists instrumented and elided sites, ROM cost, and successful-path cycles.

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

The warning requires a nonzero extent. `let empty: byte[0];` owns no element whose bits could be
indeterminate and therefore does not emit W10141.

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

The compiler encodes the string using the platform profile's `default_encoding` and
`default_character_map` settings.

#### STR-2: Platform Default Encoding

The platform profile defines the default encoding:

| Platform | Default Encoding | Default Map | Available Named Encodings |
|----------|------------------|-------------|---------------------------|
| C64 | `screen_codes` | `upper_graphics` | `petscii`, `screen_codes` |
| C64 Ultimate | `screen_codes` | `upper_graphics` | `petscii`, `screen_codes` |
| CX16 | `raw` | `raw` | None; specialized maps await the X16 expert extension |
| Atari 800XL | `raw` | `raw` | None; specialized maps await the Atari expert extension |
| Atari 7800 | `raw` | `raw` | None |

The default can be overridden in the platform profile configuration.

#### STR-3: Encoding Intrinsics (Cast-Style)

To use a non-default encoding, use a target-registered named encoding intrinsic:

```blend65
// Platform default encoding:
const TITLE: byte[] = "GAME OVER";

// Explicit encoding:
const KERNAL_MSG: byte[] = petscii("HELLO");         // PETSCII for KERNAL I/O
const SCREEN_MSG: byte[] = screen_codes("SCORE:");   // Screen codes for direct screen write
const MIXED_CASE: byte[] = screen_codes("Hello", "lower_upper");
```

There is no generic `encode()` intrinsic. Named intrinsics make the chosen byte contract visible in
source and are polymorphic:

| Input | Output | Example |
|-------|--------|---------|
| String literal `"..."` | `byte[]` (array of encoded bytes) | `petscii("HI")` → `byte[2]` |
| Character literal `'.'` | `byte` (single encoded byte) | `petscii('.')` → `byte` |
| Literal plus map-key string literal | Same as the first argument | `screen_codes("Hello", "lower_upper")` → `byte[5]` |

The optional map argument is compile-time-only and must be a string literal. It selects one
immutable map for that literal; it does not change the machine's active character set. E10251
rejects a non-literal map argument, and E10125 rejects an unavailable encoding or map key.

Using an encoding not available for the target platform is a compile error:

```blend65
// Compiling for Atari 800XL:
const MSG: byte[] = petscii("HI");  // ❌ E10125: 'petscii' is unavailable for 'a800xl'
```

#### STR-4: Raw Bytes, No Automatic Termination

String literals produce an encoded byte array with no null terminator and no length prefix:

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
| `\\` | Encoding of `\` | Backslash character |
| `\"` | Encoding of `"` | Double-quote character |
| `\'` | Encoding of `'` | Single-quote character |
| `\n` | Selected encoding mapping | Symbolic newline |
| `\r` | Selected encoding mapping | Symbolic carriage return |
| `\t` | Selected encoding mapping | Symbolic horizontal tab |
| `\0` | `$00` | Exact null byte, independent of encoding |
| `\xNN` | `$NN` | Exact byte, independent of encoding |

The set is closed. Lexing accepts every spelling above and preserves ordinary literal characters
as exact Unicode scalar values. Semantic encoding maps every ordinary scalar and symbolic escape
through the selected table, with no normalization, transliteration, replacement, or lossy
fallback. E10249 rejects a missing mapping; it also rejects a character literal whose mapping is
not exactly one byte. The developer can select an available named encoding or write the exact
required byte with `\xNN`; `\0` and `\xNN` always bypass encoding.

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
char_char    = ? any single Unicode scalar value except U+0027, U+005C, U+000D, or U+000A ? ;
escape_seq   = ? U+005C REVERSE SOLIDUS ?
             , ( "n" | "r" | "t" | "0" | ? U+005C REVERSE SOLIDUS ? | '"' | "'"
                         | "x" , hex_digit , hex_digit ) ;
```

### Rules

#### CL-1: Character Literals Are Byte Values

A character literal is a `byte` constant. It contains one Unicode scalar value or one escape and
is encoded using the platform's default encoding and character map. The mapping must produce
exactly one byte or E10249; there is no Unicode normalization or replacement.

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
clear(small);      // ❌ E10172: array size mismatch — expected 40, found 10
```

`length(buf)` inside the function returns the compile-time constant 40.

### Unsized Parameters

```blend65
function sum(data: const byte[]): word {
    let total: word = 0;
    for (let i: word = 0; i < length(data); i += 1) {
        total += word(data[i]);
    }
    return total;
}
```

`byte[]` in parameter position accepts a fixed byte array of any extent. The caller passes the base
address and full word element count through compiler-managed homes. This is an existing array
parameter form, not a dynamic array, slice, span, view, storable value, or return type.

```blend65
let a: byte[] = [1, 2, 3];
let b: byte[10] = [; 0];
let s1: word = sum(a);
let s2: word = sum(b);
```

An any-size parameter may be forwarded only to another compatible any-size parameter. It cannot be
assigned, stored, returned, converted to an exact `T[N]`, or used to manufacture a subarray.

### Parameter Codegen

Exact arrays are passed by reference using a two-byte address home. Any-size parameters also carry
the full two-byte element count:

```asm
; Caller: sum(a), where a has three elements
LDA #<a
STA sum_data_addr
LDA #>a
STA sum_data_addr+1
LDA #3
STA sum_data_length
LDA #0
STA sum_data_length+1
JSR sum
```

Cost: two SFA bytes for an exact array parameter; four for an any-size parameter. ZP placement is
an allocation decision, not a source or ABI promise. No helper, element copy, or runtime is added.

---

## Part 7: `length()` Intrinsic

`length(array)` returns the element count of an array.

| Context | Return | Type | Cost |
|---------|--------|------|------|
| Fixed-size array (`byte[40]`) | 40 | Compile-time constant | 0 cycles |
| Size-inferred array (`byte[] = [1,2,3]`) | 3 | Compile-time constant | 0 cycles |
| Sized parameter (`byte[40]`) | 40 | Compile-time constant | 0 cycles |
| Unsized parameter (`byte[]`) | Caller array's full element count | Runtime `word` | Load compiler-managed count |

```blend65
const TABLE: byte[] = [10, 20, 30, 40, 50];

for (let i: word = 0; i < length(TABLE); i += 1) { // length = 5, compile-time
    poke($0400 + word(i), TABLE[i]);
}
```

---

## 6502 Code Generation

### Proven Byte-Offset Direct Read

```blend65
let arr: byte[100];
let val: byte = arr[i];
```

```asm
LDX i
LDA arr,X          ; Absolute,X — 4 cycles, or 5 on a page-crossing read; 3 bytes ROM
STA val
```

### Proven Byte-Offset Direct Write

```blend65
arr[i] = 42;
```

```asm
LDX i
LDA #42
STA arr,X          ; Absolute,X store — 5 cycles, 3 bytes ROM
```

### Proven Byte-Offset Word-Element Read

```blend65
let addrs: word[64];
let addressLow: byte;
let addressHigh: byte;
// Access addrs[i]: need offset = i * 2
```

```asm
LDA i
ASL A              ; A = i * 2
TAX
LDA addrs,X       ; Low byte — 4 cycles, or 5 on page crossing
STA addressLow
LDA addrs+1,X     ; High byte — 4 cycles, or 5 on page crossing
STA addressHigh
; Total shown: 21–26 cycles and 14–17 bytes, depending on ZP/absolute homes and page crossings
```

### General 16-Bit Address Formation

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
LDA (ptr),Y        ; Indirect indexed with Y=0 — exactly 5 cycles
STA val
; Total shown: 28–31 cycles and 19–22 ROM bytes, depending on ZP/absolute homes,
; plus the compiler-owned 2-byte ZP pointer
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
BPL .fill           ; 403 cycles including setup when the backedge stays on-page; 10 bytes ROM
                    ; 442 cycles if the taken backedge crosses a page (39 extra cycles)
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

| Operation | Best proven shape | General shape | Notes |
|-----------|-------------------|---------------|-------|
| Byte-element read/write | Direct absolute indexed | 16-bit address formation + indirect access | Selected per access, not declaration size |
| Multi-byte element read/write | Scaled direct offset | 16-bit scaled address formation | Every accessed byte preserves wrap/MMIO semantics |
| Fill (`N` bytes) | Counted direct loop | Paged/16-bit loop | Selected from extent and placement |
| `length(fixed)` | Compile-time constant | — | Semantic type is always `word`; proof may narrow machine state |
| `length(anySizeParam)` | Load carried word count | — | No helper or runtime |
| Exact/any-size parameter | Store 2-byte address / address + 2-byte count | — | Ordinary SFA homes |

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

**Yes.** Arrays of structs are valid v3 source. A struct-of-arrays pattern can be faster when a hot
loop touches only a subset of fields, but that is a measured layout choice rather than a language
restriction:

```blend65
// Valid array-of-structs layout
let enemies: Enemy[8];

// Optional struct-of-arrays layout when measurements justify it
let enemyX: byte[8];
let enemyY: byte[8];
let enemyHP: byte[8];
```

The compiler must support both forms and report their actual addressing and storage costs. It must
not reject the array-of-structs form merely because multiplication or address formation needs
lowering.

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
const TABLE_SIZE: word = length(TABLE);    // ✅ = 5, compile-time constant
let copy: byte[length(TABLE)];             // ✅ valid array size
```

### AR-A7: What is the type of `length()`?

Always `word`. Fixed extents fold at compile time; an any-size parameter reads the full word count
provided by the caller. A 256-element array therefore returns 256 without a type boundary. Machine
representation may narrow only when proof preserves every use.

### AR-A8: Can you take `&` of an array?

**Yes.** `&arr` returns the base address as `word` (defined in F006):

```blend65
let buf: byte[40];
let addr: word = &buf;     // ✅ base address of array
```

`&arr[i]` (address of element) remains deferred (F006, E10042).

### AR-A9: Default encoding choice rationale

Games overwhelmingly write directly to screen memory, not through OS I/O routines. Therefore the
C64/C64U default is `screen_codes` with the power-on `upper_graphics` ROM map. CX16 and Atari
targets keep the exact `ascii-raw-v1` byte baseline until separate expert extensions qualify their
machine-specific text maps; this baseline is not a claim about display hardware.

Developers using C64 KERNAL output routines select PETSCII explicitly: `petscii("HELLO")`.

### AR-A10: Encoding intrinsic availability

Encoding intrinsics are platform-specific. The platform profile defines which are available:

| Intrinsic | C64 / C64U | CX16 | Atari 800XL | Atari 7800 |
|-----------|------------|------|-------------|------------|
| `petscii()` | ✅ | ❌ | ❌ | ❌ |
| `screen_codes()` | ✅ | ❌ | ❌ | ❌ |
| `atascii()` | ❌ | ❌ | Reserved, inactive | ❌ |
| `internal_codes()` | ❌ | ❌ | Reserved, inactive | ❌ |

Using an unavailable intrinsic → E10125.

---

## Error Codes

| Code | Public presentation |
|------|---------|
| E10110 | [Chapter 14](../14-diagnostics.md) |
| E10112 | [Chapter 14](../14-diagnostics.md) |
| E10113 | [Chapter 14](../14-diagnostics.md) |
| E10114 | [Chapter 14](../14-diagnostics.md) |
| E10115 | [Chapter 14](../14-diagnostics.md) |
| E10116 | [Chapter 14](../14-diagnostics.md) |
| E10119 | [Chapter 14](../14-diagnostics.md) |
| E10120 | [Chapter 14](../14-diagnostics.md) |
| E10121 | [Chapter 14](../14-diagnostics.md) |
| E10122 | [Chapter 14](../14-diagnostics.md) |
| E10123 | [Chapter 14](../14-diagnostics.md) |
| E10124 | [Chapter 14](../14-diagnostics.md) |
| E10125 | [Chapter 14](../14-diagnostics.md) |
| E10249 | [Chapter 14](../14-diagnostics.md) |
| E10251 | [Chapter 14](../14-diagnostics.md) |
| E10253 | [Chapter 14](../14-diagnostics.md) |
| E10263 | [Chapter 14](../14-diagnostics.md) |
| E10264 | [Chapter 14](../14-diagnostics.md) — extent is not an integer in `0..65535` |
| E10265 | [Chapter 14](../14-diagnostics.md) — total array byte size exceeds 65535 |

### Warning Codes

| Code | Public presentation |
|------|---------|
| W10140 | [Chapter 14](../14-diagnostics.md) |
| W10141 | [Chapter 14](../14-diagnostics.md) — nonzero mutable array without an initializer |
| W10143 | [Chapter 14](../14-diagnostics.md) — mutable-array RAM allocation reaches the profile threshold |

---

## Feature Interactions

| Feature | Interaction |
|---------|------------|
| F003 Module contents | Arrays/consts at module level. length() as constant expression |
| F005 Memory placement | `let` → RAM, `const` → data/ROM, `zeropage { arr: byte[4]; }` → ZP |
| F006 Address-of | `&arr` → word (base address). `&arr[i]` deferred (E10042) |
| F008 For loop | `for (let i: word = 0; i < length(arr); i += 1)` visits every valid index once; the optimizer may narrow the machine induction state when proven safe |
| F010 Signed types | Signed types are valid as elements and indices; known negative indices are E10240, checked runtime indices test the lower bound, and unchecked indices sign-extend into the 16-bit address domain |
| F011 Structs | Arrays as struct fields and arrays of structs are both valid. Const params apply to both; layout choice remains explicit and costed |
| F013 Control flow | Arrays in conditions via element access: `if (arr[i] == target)` |
| Platform profiles | Encoding tables, immutable map identities, defaults, and available encoding intrinsics |

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
    for (let i: byte = 0; i < entityCount; i += 1) {
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

function drawLabel(screen_addr: word, label: const byte[]): void {
    for (let i: word = 0; i < length(label); i += 1) {
        poke(screen_addr + i, label[i]);
    }
}

function drawUI(): void {
    drawLabel($0400, SCORE_LABEL);
    drawLabel($0428, LIVES_LABEL);
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
    for (let i: byte = 0; i < MAX_INPUT; i += 1) {
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
    for (let i: word = 0; i < length(RAMP); i += 1) {
        let colorIndex: byte = byte((i + rampOffset) & 7);  // Explicit proven-safe narrowing
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
| P1 Cross-platform compilable | ✅ | Fixed-size arrays and ordinary integer ordinals are universal; each backend selects legal addressing per access |
| P2 Platform-meaningful | ✅ | Lookup tables, entity arrays, screen buffers — core game dev patterns on every platform |
| P3 No platform assumptions | ✅ | Core array semantics are platform-neutral. Encoding is via platform profiles |
| P4 Resource-scalable | ✅ | W10143 warns about mutable-array RAM pressure; the build report exposes each selected access cost |

### Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅ | Direct indexed and 16-bit pointer-based forms cover the complete fixed-array model |
| H2 Cost transparency | ✅ | The build report records the actual sequence, scratch, bytes, and cycles selected per access |
| H3 SFA compatible | ✅ | All arrays fixed-size, compile-time-known addresses. No dynamic allocation |
| H4 Memory footprint documented | ✅ | Element size × count is fixed; any scratch or ZP pointer belongs to final SFA/resource closure |
| H5 Bounded behavior | ✅ | Default effective addresses wrap modulo 65536 with real banking/MMIO effects; optional checks fail before access in a defined non-returning safety stop |

### Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅ | `type[size]`, `arr[index]`, `[values; fill]` — all unambiguous in EBNF |
| L2 Consistent with existing | ✅ | Same `name: type` pattern. Const/let distinction. Cast-style encoding intrinsics match F010 |
| L3 Beginner-friendly | ✅ | Arrays, strings, character literals — familiar from C/TS/Java |
| L4 Minimal feature | ✅ | Fixed-size one-dimensional arrays include aggregate element types; multidimensional and dynamic sizing remain outside v3. |
| L5 No redundancy | ✅ | No overlap with existing features. String literals are sugar, not a separate type |
| L6 Error messages defined | ✅ | Active array diagnostics are linked to the canonical Chapter-14 registry |
| L7 Compile-time failure preferred | ✅ | Size checks, type checks, const safety — all at compile time |
| L8 Feature interaction documented | ✅ | All interactions listed |
| L9 Documentable with examples | ✅ | 5 examples: sine table, entity management, screen output, input buffer, color animation |

### Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅ | `[`, `]` brackets, `;` for fill separator, `'c'` for char literals — standard tokenization |
| C2 Semantic analysis defined | ✅ | Size validation, index-ordinal context, extent propagation, any-size parameter length, and const propagation are specified |
| C3 Code generation strategy | ✅ | Direct indexed and general 16-bit patterns are selected by proof per access |
| C4 Unit testable | ✅ | Each initializer, width boundary, parameter form, addressing proof, and diagnostic is independently testable |
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

**✅ ACCEPTED** — Arrays remain fixed, contiguous, and statically allocated. Ordinary source
indices are independent of backend addressing choices, any-size parameters carry only the full
array address/count required by their existing role, and no dynamic array, slice, span, or view
concept is added. String literals remain fixed byte arrays with platform-selected encoding; const
parameters and explicit initialization preserve safety and cost transparency.
