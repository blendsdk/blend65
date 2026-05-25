# F010 — Signed Integer Types (`sbyte`, `sword`)

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F003 (module contents), F005 (memory placement)  
> **Interacts with**: F008 (for loop), F009 (switch), F006 (address-of)

---

## Description

Blend65 v3 adds two signed integer types to complement the existing unsigned `byte` and `word`:

| Type | Size | Range | Storage |
|------|------|-------|---------|
| `sbyte` | 8-bit | -128 to 127 | Two's complement |
| `sword` | 16-bit | -32768 to 32767 | Two's complement, little-endian |

Signed types solve a fundamental need in game development: representing values that can be negative — velocities, deltas, offsets, accelerations, gravity, screen-relative positions.

**Key design principle**: Signed and unsigned types use the same hardware (the 6502 doesn't distinguish them). The difference is purely in how the compiler interprets comparison flags and shift operations. Arithmetic (`+`, `-`, `&`, `|`, `^`, `<<`) generates identical machine code for both.

---

## Syntax

### Declaration

```blend65
// Signed variables
let velocity: sbyte = -3;
let deltaX: sword = -200;

// Constants
const GRAVITY: sbyte = 2;
const MAX_SPEED: sbyte = 6;
const JUMP_FORCE: sbyte = -8;

// Zero-page placement
zeropage {
    playerVelX: sbyte;
    playerVelY: sbyte;
    scrollOffset: sword;
}

// Arrays
let deltas: sbyte[8] = [-1, -1, 0, 1, 1, 1, 0, -1];
let waypoints: sword[4] = [-1000, -500, 500, 1000];
```

### Type Casting

Explicit cast between signed and unsigned uses function-call syntax:

```blend65
// Same-size casts (zero runtime cost — same bits, different interpretation)
let speed: byte = 253;
let velocity: sbyte = sbyte(speed);    // Reinterpret: 253 → -3

let offset: sbyte = -10;
let raw: byte = byte(offset);          // Reinterpret: -10 → 246

// Width-changing casts
let narrow: sbyte = -5;
let wide: sword = sword(narrow);       // Sign-extend: -5 stays -5

let small: byte = 200;
let big: word = word(small);           // Zero-extend: 200 stays 200

// Truncating casts (wide → narrow)
let w: sword = -300;
let b: sbyte = sbyte(w);              // Truncate to low byte (wrapping)
```

---

## The Complete Type Table

| Type | Size | Signed | Range | 6502 Mapping |
|------|------|--------|-------|-------------|
| `byte` | 8-bit | No | 0 to 255 | A/X/Y register, ZP byte |
| `sbyte` | 8-bit | Yes | -128 to 127 | A/X/Y register, ZP byte |
| `word` | 16-bit | No | 0 to 65535 | ZP pair, little-endian |
| `sword` | 16-bit | Yes | -32768 to 32767 | ZP pair, little-endian |
| `boolean` | 8-bit | No | true/false | Byte (0/non-zero) |
| `void` | 0 | — | — | No storage |

---

## Rules

### ST-1: No Implicit Mixing

Signed and unsigned types cannot be mixed in the same expression without an explicit cast. This is the **one rule** developers must remember.

```blend65
let pos: byte = 100;
let vel: sbyte = -3;

// ❌ Compile error — cannot mix byte and sbyte
let result = pos + vel;

// ✅ Explicit: cast to signed world, do the math
let result: sbyte = sbyte(pos) + vel;

// ✅ Or cast to unsigned world
let result: byte = pos + byte(vel);
```

**Rationale**: The 6502 uses the same ADD instruction for signed and unsigned, but the *meaning* of the result differs. By requiring an explicit cast, the developer declares which interpretation they intend. This eliminates an entire class of bugs that C is infamous for.

### ST-2: Same-Signedness Widening Is Implicit

Widening within the same signedness family is allowed without a cast:

```blend65
let b: byte = 200;
let w: word = b;          // ✅ Implicit: byte → word (zero-extend)

let sb: sbyte = -5;
let sw: sword = sb;       // ✅ Implicit: sbyte → sword (sign-extend)
```

Narrowing always requires an explicit cast:

```blend65
let w: word = 1000;
let b: byte = w;          // ❌ Compile error — may lose data
let b: byte = byte(w);    // ✅ Explicit truncation (takes low byte)

let sw: sword = -300;
let sb: sbyte = sw;       // ❌ Compile error — may lose data
let sb: sbyte = sbyte(sw); // ✅ Explicit truncation
```

### ST-3: Unary Minus on Signed Types Only

The unary negation operator (`-expr`) is only valid on signed types (`sbyte`, `sword`). Applying it to unsigned types is a compile-time error.

```blend65
let vel: sbyte = 5;
let neg: sbyte = -vel;     // ✅ Negation of signed value

let pos: byte = 5;
let neg2: byte = -pos;     // ❌ E10083: Cannot negate unsigned type 'byte'
```

**Rationale**: Negating an unsigned value is almost always a bug. If you want the two's complement bit pattern, cast first: `let neg: sbyte = -sbyte(pos);`

Negative *literals* work naturally:

```blend65
let x: sbyte = -42;       // ✅ Negative literal
let y: sword = -1000;     // ✅ Negative literal
const G: sbyte = -1;      // ✅ Negative constant
```

### ST-4: Literal Type Rules

Numeric literals are typed by context:

| Literal | Type | Rule |
|---------|------|------|
| `42` | `byte` | Fits in 0..255 → byte |
| `300` | `word` | Fits in 256..65535 → word |
| `-1` | `sbyte` | Negative, fits in -128..-1 → sbyte |
| `-200` | `sword` | Negative, doesn't fit sbyte → sword |
| `42` assigned to `sbyte` | `sbyte` | Positive value fits in signed range → OK |
| `200` assigned to `sbyte` | ERROR | 200 > 127, doesn't fit sbyte → E10084 |

When a literal is used in a context with a declared type, the compiler checks that the value fits:

```blend65
let a: sbyte = 42;        // ✅ 42 fits in -128..127
let b: sbyte = 127;       // ✅ Maximum sbyte value
let c: sbyte = 128;       // ❌ E10084: Value 128 out of range for sbyte (-128..127)
let d: sbyte = -128;      // ✅ Minimum sbyte value
let e: sbyte = -129;      // ❌ E10084: Value -129 out of range for sbyte (-128..127)
```

### ST-5: Right Shift Is Type-Aware

The `>>` operator automatically does the right thing based on the operand type:

```blend65
let u: byte = 0b10000000;     // 128
let s: sbyte = sbyte(u);       // -128 (same bits)

let ur: byte = u >> 1;         // 0b01000000 = 64  (logical shift, zero-fill)
let sr: sbyte = s >> 1;        // 0b11000000 = -64 (arithmetic shift, sign-extend)
```

The developer doesn't need to remember this — the type determines the behavior automatically. Left shift (`<<`) is identical for both.

### ST-6: Overflow Wraps

Signed overflow wraps, just like unsigned overflow. This is the natural two's complement behavior of the 6502.

```blend65
let x: sbyte = 127;
x = x + 1;                // Wraps to -128 (deterministic)

let y: sbyte = -128;
y = y - 1;                // Wraps to 127 (deterministic)
```

The compiler emits a warning when overflow is detectable at compile time:

```blend65
const TOO_BIG: sbyte = 127 + 1;  // ⚠️ W10100: Signed overflow in constant expression
```

### ST-7: Comparison Semantics Follow the Type

Comparison operators (`<`, `<=`, `>`, `>=`) use the appropriate comparison for the operand type:

```blend65
let a: byte = 200;
let b: byte = 100;
a > b;                     // true (unsigned: 200 > 100)

let sa: sbyte = sbyte(a);  // -56
let sb: sbyte = sbyte(b);  // 100
sa > sb;                   // false (signed: -56 < 100)
```

Same bits, different comparison result — because the type tells the compiler which flags to check. The developer doesn't need to think about CPU flags; they just use the right type.

### ST-8: Cast Syntax Is `typename(expr)`

All casts use the function-call syntax: `typename(expression)`.

```blend65
sbyte(expr)    // Cast to sbyte
sword(expr)    // Cast to sword
byte(expr)     // Cast to byte
word(expr)     // Cast to word
```

This is:
- **Familiar**: Looks like a constructor/function call
- **Unambiguous**: No new operators or keywords needed
- **Consistent**: Works the same for all type conversions

Cast is NOT a function call — it's a compile-time type conversion operator that uses function-call syntax for readability. No function call overhead.

---

## 6502 Code Generation

### Arithmetic (Identical for Signed and Unsigned)

```blend65
let a: sbyte = 10;
let b: sbyte = -3;
let c: sbyte = a + b;
```

```asm
; sbyte addition — IDENTICAL to byte addition
    LDA a
    CLC
    ADC b
    STA c
; 4 instructions, ~10 cycles. Same as unsigned.
```

### Signed Comparison (The One Difference)

```blend65
if (velocity < 0) { ... }
```

```asm
; Unsigned comparison (byte < value): uses Carry flag
    LDA var
    CMP #value
    BCC .less_than

; Signed comparison (sbyte < value): uses N⊕V
    LDA velocity
    CMP #$00
    BMI .less_than       ; Branch if negative (N=1 and no overflow)
                          ; For general signed compare: check N XOR V
```

For general signed less-than (`a < b`):
```asm
    LDA a
    SEC
    SBC b
    BVC .no_overflow
    EOR #$80             ; Flip sign bit if overflow occurred
.no_overflow:
    BMI .a_less_than_b   ; If result negative, a < b
```

**Cost**: Signed comparison is ~2-4 extra cycles and ~3-5 extra bytes compared to unsigned. This only matters in tight inner loops — the compiler can document this.

### Unary Negation

```blend65
let neg: sbyte = -velocity;
```

```asm
; Two's complement negation: invert all bits, add 1
    LDA velocity
    EOR #$FF
    CLC
    ADC #$01
    STA neg
; 5 instructions, ~10 cycles
```

### Right Shift (Type-Aware)

```blend65
let result: sbyte = value >> 1;   // Arithmetic right shift
```

```asm
; Arithmetic right shift (sign-extending)
    LDA value
    CMP #$80         ; Set carry to sign bit
    ROR A             ; Rotate right through carry (sign-extends)
    STA result
; 4 instructions, ~8 cycles (vs 2 instructions/4 cycles for logical shift)
```

### Same-Size Cast (Zero Cost)

```blend65
let b: byte = 253;
let s: sbyte = sbyte(b);    // Reinterpret
```

```asm
; Generated code: NOTHING.
; The compiler just changes the type label internally.
; 'b' and 's' share the same memory, same bits.
; Zero instructions. Zero cycles. Zero bytes.
```

### Widening Casts

```blend65
let narrow: sbyte = -5;
let wide: sword = sword(narrow);   // Sign-extend
```

```asm
; Sign-extend sbyte → sword
    LDA narrow
    STA wide           ; Low byte
    ORA #$7F           ; Preserve sign bit in bit 7
    BMI .neg
    LDA #$00           ; Positive: high byte = $00
    JMP .done
.neg:
    LDA #$FF           ; Negative: high byte = $FF
.done:
    STA wide+1         ; High byte
; ~8-12 cycles depending on branch
```

```blend65
let narrow: byte = 200;
let wide: word = word(narrow);     // Zero-extend
```

```asm
; Zero-extend byte → word
    LDA narrow
    STA wide           ; Low byte
    LDA #$00
    STA wide+1         ; High byte
; 4 instructions, ~8 cycles
```

### 16-bit Signed Comparison

```blend65
let a: sword = -300;
let b: sword = 100;
if (a < b) { ... }
```

```asm
; Signed 16-bit comparison: compare high bytes first
    LDA a+1
    CMP b+1
    BNE .high_differ
    ; High bytes equal — compare low bytes (unsigned)
    LDA a
    CMP b
    BCC .a_less         ; Low byte unsigned compare
    BEQ .a_equal
    JMP .a_not_less
.high_differ:
    ; Signed compare on high bytes
    SEC
    SBC b+1
    BVC .no_ov
    EOR #$80
.no_ov:
    BMI .a_less
.a_not_less:
    ; a >= b
    JMP .end
.a_less:
    ; a < b — execute if-body
    ...
.a_equal:
.end:
```

---

## Cost Summary

| Operation | byte | sbyte | Extra cost |
|-----------|------|-------|-----------|
| Addition (`+`) | ~10 cycles | ~10 cycles | **0** |
| Subtraction (`-`) | ~10 cycles | ~10 cycles | **0** |
| Bitwise ops | ~6 cycles | ~6 cycles | **0** |
| Left shift (`<<`) | ~4 cycles | ~4 cycles | **0** |
| Equality (`==`, `!=`) | ~6 cycles | ~6 cycles | **0** |
| Less/greater (`<`, `>`) | ~6 cycles | ~8-10 cycles | **+2-4 cycles** |
| Right shift (`>>`) | ~4 cycles | ~8 cycles | **+4 cycles** |
| Negation (`-x`) | N/A | ~10 cycles | N/A |
| Same-size cast | — | — | **0** |
| Sign-extend (8→16) | — | ~8-12 cycles | **+4 cycles** vs zero-extend |
| RAM per variable | 1 byte | 1 byte | **0** |
| ROM per operation | same | +3-5 bytes for compare/shift | **+3-5 bytes** where different |
| Zero page | same | same | **0** |

**Bottom line**: Signed types are almost free. The only measurable cost is in comparisons and right shifts, which typically add 2-5 extra cycles and 3-5 extra bytes of ROM.

---

## Resolved Ambiguities

### ST-A1: Can signed and unsigned be in the same array?

**No.** Array element type is fixed. `sbyte[10]` holds only `sbyte` values, `byte[10]` holds only `byte` values.

### ST-A2: Can sbyte/sword be used as array indices?

**No.** Array indices must be unsigned (`byte` or `word`). Negative indices have no meaning.

```blend65
let arr: byte[10];
let i: sbyte = 5;
arr[i];             // ❌ E10085: Array index must be unsigned type (byte or word)
arr[byte(i)];       // ✅ Explicit cast
```

### ST-A3: What type does mixed-literal arithmetic produce?

Literals in a signed context produce signed results:

```blend65
let x: sbyte = -3 + 1;    // ✅ Both literals signed context → sbyte, value = -2
let y: sbyte = 100 + 1;   // ✅ Fits in sbyte range → sbyte, value = 101
let z: sbyte = 100 + 50;  // ❌ E10084: Value 150 out of range for sbyte (-128..127)
```

Literal arithmetic is evaluated at compile time. The result is checked against the target type's range.

### ST-A4: Can enums be signed?

**No.** Enums are `byte`-backed (0-255). If you need signed enum-like values, use named constants:

```blend65
const DIR_UP: sbyte = -1;
const DIR_NONE: sbyte = 0;
const DIR_DOWN: sbyte = 1;
```

**Rationale**: Enums represent named sets of discrete values, not arithmetic quantities. Keeping them unsigned keeps the enum feature simple.

### ST-A5: How does switch work with signed types?

`sbyte` and `sword` are valid switch expression types. Case values can be negative:

```blend65
switch (direction) {
    case -1: moveLeft();
    case 0:  idle();
    case 1:  moveRight();
}
```

Codegen uses the same compare-and-branch pattern as unsigned, but with signed comparison instructions.

### ST-A6: How do signed types interact with for-loops?

Signed loop variables enable countdown past zero:

```blend65
// Count down from 5 to -5 (inclusive)
for i: sbyte = 5 downto -5 {
    process(i);   // 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5
}

// Signed step
for i: sbyte = -10 to 10 step 3 {
    plot(i);      // -10, -7, -4, -1, 2, 5, 8
}
```

The loop bound and step must match the loop variable's signedness.

### ST-A7: What about `boolean` ↔ signed conversions?

**Not allowed.** `boolean` is not convertible to/from signed types. This is consistent with v3's approach: boolean is a logical type, not a numeric type.

```blend65
let b: boolean = true;
let s: sbyte = sbyte(b);   // ❌ E10086: Cannot cast boolean to sbyte
```

### ST-A8: Can `&` (address-of) be used on signed variables?

**Yes.** `&signedVar` returns `word` (an address is always unsigned). Works identically to unsigned variables.

```blend65
let vel: sbyte = -3;
let addr: word = &vel;     // ✅ Address is always word (unsigned)
```

### ST-A9: Can signed types be used in `zeropage {}` blocks?

**Yes.** Both `sbyte` and `sword` are valid in zeropage blocks. They consume the same space as their unsigned equivalents.

```blend65
zeropage {
    velX: sbyte;       // 1 byte of ZP
    velY: sbyte;       // 1 byte of ZP
    scrollPos: sword;  // 2 bytes of ZP
}
```

### ST-A10: Bitwise operations on signed types?

**Allowed.** Bitwise AND, OR, XOR, NOT, and left shift work on signed types. The operations are bit-level and produce the same type as the operands.

Literals adapt to the operand's type per ST-4 (literal type rules). A literal value that fits in the target type is automatically interpreted as that type:

```blend65
let a: sbyte = -1;         // 0xFF
let b: sbyte = a & 0x0F;   // ✅ Literal 15 fits in sbyte range, adapts to sbyte
let c: sbyte = a & sbyte(0x0F);  // ✅ Also valid: explicit cast
```

This is not "mixing" — it's literal adaptation, consistent with ST-4. Named variables of a different signedness still require explicit casts per ST-1.

### ST-A11: What happens with compound assignment on signed types?

Compound assignments (`+=`, `-=`, etc.) follow the same rules as their expanded form:

```blend65
let vel: sbyte = 5;
vel += 1;                  // ✅ Equivalent to vel = vel + 1; literal 1 adapts to sbyte
vel += byte(3);            // ❌ Mixed: sbyte += byte — cast required
```

### ST-A12: Can functions accept/return signed types?

**Yes.** Signed types work as parameters and return types like any other type:

```blend65
function clamp(value: sbyte, min: sbyte, max: sbyte): sbyte {
    if (value < min) { return min; }
    if (value > max) { return max; }
    return value;
}

function negate(v: sbyte): sbyte {
    return -v;
}
```

### ST-A13: Implicit widening across signedness?

**No.** Only same-signedness widening is implicit:

```blend65
let b: byte = 200;
let sw: sword = b;             // ❌ E10080: Cannot implicitly convert byte to sword (different signedness)
let sw: sword = sword(b);     // ✅ Explicit cast: zero-extend to 16-bit, label as signed (value = 200)
```

`typename(expr)` always works between integer types. The compiler:
1. Widens or truncates the bit pattern as needed
2. For widening unsigned source: zero-extend
3. For widening signed source: sign-extend
4. For truncating: take the low byte(s)
5. Labels the result as the target type

---

## Error Codes

| Code | Message |
|------|---------|
| E10080 | Cannot implicitly convert `<from_type>` to `<to_type>` — use explicit cast: `<to_type>(<expr>)` |
| E10081 | Cannot mix signed type `<type_a>` with unsigned type `<type_b>` in expression — cast one operand |
| E10082 | Cannot implicitly narrow `<from_type>` to `<to_type>` — use explicit cast: `<to_type>(<expr>)` |
| E10083 | Cannot negate unsigned type `<type>` — use `sbyte`/`sword` for signed arithmetic |
| E10084 | Value `<value>` out of range for type `<type>` (range: `<min>` to `<max>`) |
| E10085 | Array index must be unsigned type (`byte` or `word`) — found `<type>` |
| E10086 | Cannot cast `<from_type>` to `<to_type>` — boolean is not convertible to/from integer types |

### Warning Codes

| Code | Message |
|------|---------|
| W10100 | Signed overflow in constant expression — result wraps to `<value>` |
| W10101 | Narrowing cast from `<from_type>` to `<to_type>` truncates value `<value>` to `<result>` |

---

## Feature Interactions

| Feature | Interaction |
|---------|------------|
| F003 Module contents | `sbyte`/`sword` valid in all declaration contexts (module-level, function-level) |
| F005 Memory placement | Valid in `zeropage {}` blocks, `let`, `const`. Same size as unsigned counterparts |
| F006 Address-of | `&signedVar` returns `word`. No difference from unsigned |
| F007 Interrupt functions | Signed types valid inside interrupt functions. No special behavior |
| F008 For loop | Signed loop variables supported. Loop bounds/step must match signedness |
| F009 Switch | `sbyte`/`sword` valid as switch expression type. Case values can be negative |
| Enums | Enums remain unsigned (`byte`-backed). No signed enums |
| Arrays | Signed element types valid. Array index must be unsigned |
| Type aliases | `type Velocity = sbyte;` — valid, works like all type aliases |

---

## Examples

### Example 1: Basic Signed Arithmetic

```blend65
module physics;

zeropage {
    velX: sbyte;
    velY: sbyte;
}

let posX: word = 160;
let posY: word = 100;

function applyGravity(): void {
    if (velY < 127) {
        velY = velY + 1;
    }
}

function applyVelocity(): void {
    let newX: sword = sword(posX) + sword(velX);
    let newY: sword = sword(posY) + sword(velY);

    if (newX >= 0 && newX < 320) {
        posX = word(newX);
    }
    if (newY >= 0 && newY < 200) {
        posY = word(newY);
    }
}
```

### Example 2: Direction Table

```blend65
module movement;

// Direction deltas as signed values
const DX: sbyte[8] = [ 0,  1,  1,  1,  0, -1, -1, -1];
const DY: sbyte[8] = [-1, -1,  0,  1,  1,  1,  0, -1];

function moveInDirection(dir: byte): void {
    let dx: sbyte = DX[dir];
    let dy: sbyte = DY[dir];

    let newX: sword = sword(posX) + sword(dx);
    let newY: sword = sword(posY) + sword(dy);

    posX = word(newX);
    posY = word(newY);
}
```

### Example 3: Clamping

```blend65
module util;

export function clampSbyte(value: sbyte, min: sbyte, max: sbyte): sbyte {
    if (value < min) { return min; }
    if (value > max) { return max; }
    return value;
}

export function absSbyte(value: sbyte): sbyte {
    if (value < 0) {
        return -value;
    }
    return value;
}
```

### Example 4: Signed For-Loop

```blend65
module demo;

// Draw a symmetric pattern: -10 to +10
function drawPattern(): void {
    for i: sbyte = -10 to 11 {    // exclusive upper bound: stops at 10
        let screenX: byte = byte(sbyte(80) + i);
        plot(screenX, 100);
    }
}

// Countdown past zero
function countdown(): void {
    for i: sbyte = 5 downto -5 {  // inclusive lower bound: includes -5
        display(i);
    }
}
```

---

## v2 Migration

v2 had no signed types. Common v2 patterns and their v3 equivalents:

| v2 Pattern | v3 Equivalent |
|-----------|---------------|
| `let vel: byte = 253;` (meaning -3) | `let vel: sbyte = -3;` |
| `0 - speed` (manual negation) | `-speed` (unary minus on signed) |
| `(x >= 0)` (always true for unsigned!) | `(x >= 0)` (meaningful for signed!) |
| `let dx: byte = (dir == LEFT) ? 255 : 1;` | `let dx: sbyte = (dir == LEFT) ? -1 : 1;` |

---

## Language Guard Verdict

### Platform Universality (P)

| Rule | Status | Notes |
|------|--------|-------|
| P1 Cross-platform compilable | ✅ | Two's complement is universal across all target 6502 variants |
| P2 Platform-meaningful | ✅ | Game physics, signed math needed on every platform |
| P3 No platform assumptions | ✅ | No hardware references in core definition |
| P4 Resource-scalable | ✅ | Same storage size as unsigned; no additional RAM cost |

### Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅ | 6502 natively supports two's complement via N and V flags |
| H2 Cost transparency | ✅ | Cost table documents exact cycle/byte differences |
| H3 SFA compatible | ✅ | Same allocation model as unsigned types |
| H4 Memory footprint documented | ✅ | sbyte=1 byte, sword=2 bytes, same as unsigned |
| H5 Fully deterministic | ✅ | Overflow wraps deterministically; all operations defined |

### Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅ | `sbyte`/`sword` are new keywords; cast syntax `typename(expr)` is unambiguous |
| L2 Consistent with existing | ✅ | Naming follows byte→sbyte, word→sword pattern |
| L3 Beginner-friendly | ✅ | C/TS devs understand signed integers |
| L4 Minimal feature | ✅ | Two types + one mixing rule. No promotion hierarchy |
| L5 No redundancy | ✅ | Signed types serve a purpose unsigned cannot (negative values) |
| L6 Error messages defined | ✅ | 7 error codes + 2 warning codes cover all misuse |
| L7 Compile-time failure preferred | ✅ | Type mixing caught at compile time; range violations caught at compile time |
| L8 Feature interaction documented | ✅ | All feature interactions explicitly defined |
| L9 Documentable with examples | ✅ | 4 examples covering physics, tables, clamping, loops |

### Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅ | Two new keywords, one new expression form (cast) |
| C2 Semantic analysis defined | ✅ | Type checking rules fully specified (ST-1 through ST-8) |
| C3 Code generation strategy | ✅ | All codegen patterns documented with 6502 assembly |
| C4 Unit testable | ✅ | Each rule is independently testable; each codegen pattern verifiable |
| C5 Runtime verifiable | ✅ | Arithmetic results deterministic; emulator-testable on all platforms |

### Future-Proofing (F)

| Rule | Status | Notes |
|------|--------|-------|
| F1 Extensible | ✅ | Could add `int24`/`int32` later without breaking existing code |
| F2 Platform-profile ready | ✅ | No platform-specific behavior in signed types |
| F3 Optimizer-friendly | ✅ | Standard optimization passes apply; cast elimination possible |
| F4 Stability classification | ✅ | Classified as **stable** |

### Escape Hatches Applied

None. All 23 rules pass.

### Verdict

**✅ ACCEPTED** — Signed types are a natural extension of the existing type system. They use the 6502's native two's complement support, add minimal cognitive overhead (one rule: don't mix without casting), and solve real game development problems that are currently handled with error-prone manual bit tricks.
