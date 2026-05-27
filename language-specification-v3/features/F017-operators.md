# F017 — Arithmetic, Bitwise, Logical, and Comparison Operators

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F010 (signed types), F016 (type system rules)  
> **Interacts with**: F008 (for loop), F009 (switch), F013 (control flow), F014 (arrays)

---

## Description

This feature formalizes the complete operator set for Blend65 v3 — arithmetic, bitwise, comparison, logical, unary, and compound assignment operators. It specifies operator precedence, short-circuit evaluation, and the three-tier codegen strategy for multiply/divide/modulo operators on the 6502 (which lacks hardware multiply and divide instructions).

Blend65 v3 includes operators that map naturally to 6502 instructions and excludes operators that are meaningless or prohibitively expensive on the target platforms. Every operator has documented 6502 codegen patterns and cycle costs, satisfying H2 (cost transparency).

---

## Part 1: Operator Table

### Arithmetic Operators

| Operator | Name | Operand Types | Result Type | 6502 Native? |
|----------|------|--------------|-------------|-------------|
| `+` | Addition | integer | Same as operands (TS-3/TS-4) | ✅ `CLC; ADC` |
| `-` | Subtraction | integer | Same as operands | ✅ `SEC; SBC` |
| `*` | Multiplication | integer | Same as operands | ❌ Software |
| `/` | Division | integer | Same as operands | ❌ Software |
| `%` | Modulo | integer | Same as operands | ❌ Software |

### Unary Operators

| Operator | Name | Operand Types | Result Type | 6502 Cost |
|----------|------|--------------|-------------|-----------|
| `-expr` | Negation | `sbyte`, `sword` only | Same as operand | ~10 cycles (EOR + ADC) |
| `~expr` | Bitwise NOT | integer | Same as operand | 2 cycles (`EOR #$FF`) |
| `!expr` | Logical NOT | `boolean` | `boolean` | 2 cycles (`EOR #$01`) |

**Unary negation on unsigned types is a compile error** (F010 ST-3, E10083).

### Bitwise Operators

| Operator | Name | Operand Types | Result Type | 6502 Native? |
|----------|------|--------------|-------------|-------------|
| `&` | Bitwise AND | integer | Same as operands | ✅ `AND` |
| `\|` | Bitwise OR | integer | Same as operands | ✅ `ORA` |
| `^` | Bitwise XOR | integer | Same as operands | ✅ `EOR` |
| `<<` | Left shift | integer | Same as operands | ✅ `ASL` |
| `>>` | Right shift | integer | Same as operands | ✅ `LSR`/`ROR` (type-aware) |

**Right shift is type-aware** (F010 ST-5):
- Unsigned (`byte`, `word`): logical shift — zero-fill from left (`LSR`)
- Signed (`sbyte`, `sword`): arithmetic shift — sign-extend from left (`CMP #$80; ROR`)

### Comparison Operators

| Operator | Name | Operand Types | Result Type | 6502 Pattern |
|----------|------|--------------|-------------|-------------|
| `==` | Equal | integer, boolean | `boolean` | `CMP; BEQ` |
| `!=` | Not equal | integer, boolean | `boolean` | `CMP; BNE` |
| `<` | Less than | integer | `boolean` | Unsigned: `CMP; BCC` / Signed: N⊕V |
| `>` | Greater than | integer | `boolean` | Unsigned: `CMP; BCS+BNE` / Signed: N⊕V |
| `<=` | Less or equal | integer | `boolean` | `!(a > b)` |
| `>=` | Greater or equal | integer | `boolean` | Unsigned: `CMP; BCS` / Signed: N⊕V |

**Boolean comparisons**: Only `==` and `!=` are valid for `boolean` operands. Ordered comparisons (`<`, `>`, `<=`, `>=`) on `boolean` produce E10154.

### Logical Operators

| Operator | Name | Operand Types | Result Type | Evaluation |
|----------|------|--------------|-------------|-----------|
| `&&` | Logical AND | `boolean` | `boolean` | Short-circuit |
| `\|\|` | Logical OR | `boolean` | `boolean` | Short-circuit |

### Compound Assignment Operators

| Operator | Equivalent | Notes |
|----------|-----------|-------|
| `+=` | `x = x + expr` | |
| `-=` | `x = x - expr` | |
| `*=` | `x = x * expr` | Same warnings as `*` |
| `/=` | `x = x / expr` | Same warnings as `/` |
| `%=` | `x = x % expr` | Same warnings as `%` |
| `&=` | `x = x & expr` | |
| `\|=` | `x = x \| expr` | |
| `^=` | `x = x ^ expr` | |
| `<<=` | `x = x << expr` | |
| `>>=` | `x = x >> expr` | |

Compound assignment follows the same type rules as the expanded form (F016 TS-12).

---

## Part 2: Excluded Operators

The following operators are **not** included in Blend65 v3:

| Operator | Why Excluded |
|----------|-------------|
| `++` / `--` | Pre/post increment ambiguity (`++i` vs `i++`). Use `+= 1` / `-= 1` — the compiler optimizes to `INC`/`DEC` |
| `**` | Exponentiation is absurdly expensive on 6502. Write `x * x` for squaring |
| `>>>` | JavaScript-specific unsigned right shift. `>>` already does the right thing based on type (F010 ST-5) |
| `?.` | Optional chaining — no null/undefined concept in Blend65 |
| `??` | Nullish coalescing — no null concept |
| `typeof` | All types are known at compile time. No runtime type system |
| `instanceof` | No classes, no inheritance, no polymorphism |
| `,` | Comma operator — confusing, rarely useful, creates parsing ambiguity |
| `? :` | Ternary conditional — deferred to FUT-003. Use `if/else` instead |

**Rationale for excluding `++`/`--`:**

The pre/post increment distinction is a notorious source of bugs in C:
```c
int i = 5;
int x = i++ + ++i;  // Undefined behavior in C!
```

In Blend65, `x += 1` is clear, unambiguous, and compiles to the same `INC x` instruction. The one extra character (`+= 1` vs `++`) is a trivial cost for eliminating an entire class of bugs.

---

## Part 3: Operator Precedence

Operators are evaluated according to this precedence table (highest to lowest):

| Precedence | Operators | Associativity | Category |
|-----------|-----------|---------------|----------|
| 1 (highest) | `-expr`, `~expr`, `!expr` | Right-to-left | Unary |
| 2 | `*`, `/`, `%` | Left-to-right | Multiplicative |
| 3 | `+`, `-` | Left-to-right | Additive |
| 4 | `<<`, `>>` | Left-to-right | Shift |
| 5 | `<`, `>`, `<=`, `>=` | Left-to-right | Relational |
| 6 | `==`, `!=` | Left-to-right | Equality |
| 7 | `&` | Left-to-right | Bitwise AND |
| 8 | `^` | Left-to-right | Bitwise XOR |
| 9 | `\|` | Left-to-right | Bitwise OR |
| 10 | `&&` | Left-to-right | Logical AND |
| 11 (lowest) | `\|\|` | Left-to-right | Logical OR |

**Assignment operators** (`=`, `+=`, `-=`, etc.) are statements, not expressions. They do not participate in the precedence table.

**Parentheses** `( )` override precedence as expected:

```blend65
let a: byte = 2 + 3 * 4;      // 14 (multiply first)
let b: byte = (2 + 3) * 4;    // 20 (addition first)

let c: boolean = x > 0 && y < 100;  // (x > 0) && (y < 100) — comparison before logical
```

This precedence order matches C, Java, and TypeScript — familiar to the target audience (L3).

---

## Part 4: Short-Circuit Evaluation

### OP-1: `&&` Is Short-Circuit

The `&&` operator evaluates left-to-right. If the left operand is `false`, the right operand is **not evaluated**:

```blend65
if (index < length(buffer) && buffer[index] > threshold) {
    // Safe: if index is out of bounds, buffer[index] is never accessed
    process(buffer[index]);
}
```

**6502 codegen:**
```asm
    ; index < length(buffer)
    LDA _index
    CMP #BUFFER_LEN
    BCS .false          ; index >= length → skip right operand entirely
    ; buffer[index] > threshold
    LDX _index
    LDA _buffer,X
    CMP #THRESHOLD+1
    BCC .false          ; buffer[index] <= threshold
    ; both true — execute body
    ...
    JMP .end
.false:
.end:
```

### OP-2: `||` Is Short-Circuit

The `||` operator evaluates left-to-right. If the left operand is `true`, the right operand is **not evaluated**:

```blend65
if (cached || loadFromDisk()) {
    // loadFromDisk() is only called if !cached
    useData();
}
```

**6502 codegen:**
```asm
    LDA _cached
    BNE .true           ; cached is true → skip right operand
    JSR _loadFromDisk
    BEQ .false          ; loadFromDisk() returned false
.true:
    ; at least one true — execute body
    JSR _useData
.false:
```

### OP-3: Side Effects in Short-Circuit

Functions called in the right operand of `&&`/`||` may not execute due to short-circuiting. This is intentional and well-defined:

```blend65
// tryInit() is ONLY called if connected == true
if (connected && tryInit()) {
    runProtocol();
}

// backup() is ONLY called if primary() fails
if (primary() || backup()) {
    proceed();
}
```

**The developer can rely on this behavior** — short-circuit evaluation is guaranteed, not an optimization the compiler may or may not apply.

---

## Part 5: Multiplication, Division, and Modulo

### The 6502 Problem

The 6502 CPU has **no multiply or divide instructions**. These operations require software subroutines that are significantly more expensive than native arithmetic. Blend65 includes `*`, `/`, and `%` as operators but uses a three-tier codegen strategy to minimize cost.

### Tier 1: Compile-Time Constant Folding (Zero Cost)

When **both** operands are compile-time constants, the result is computed during compilation:

```blend65
const SCREEN_SIZE: word = 40 * 25;     // Folded to 1000 — zero runtime cost
const HALF: byte = 256 / 2;            // Folded to 128 — zero runtime cost
const REMAINDER: byte = 255 % 10;      // Folded to 5 — zero runtime cost
const TILE_SIZE: byte = 8 * 8;         // Folded to 64 — zero runtime cost
```

**This is mandatory** — constant folding is a language requirement (F016 TS-13), not an optimization.

### Tier 2: Strength Reduction for Known Constants (Cheap)

When **one** operand is a compile-time constant, the compiler generates efficient inline code:

#### Power-of-2 Multiply → Shift

```blend65
let doubled: byte = x * 2;     // → ASL
let quad: byte = x * 4;        // → ASL; ASL
let octal: word = word(x) * 8; // → ASL; ROL (3 times for 16-bit)
```

**Codegen for `x * 2` (byte):**
```asm
    LDA _x
    ASL A           ; 2 cycles, 1 byte
    STA _doubled
```

**Codegen for `x * 8` (word):**
```asm
    LDA _x
    STA _result
    LDA #0
    STA _result+1
    ASL _result     ; ×2
    ROL _result+1
    ASL _result     ; ×4
    ROL _result+1
    ASL _result     ; ×8
    ROL _result+1
    ; ~18 cycles, 12 bytes
```

#### Power-of-2 Divide → Shift

```blend65
let halved: byte = x / 2;      // → LSR (unsigned) or CMP+ROR (signed)
let eighth: byte = x / 8;      // → LSR; LSR; LSR
```

**Codegen for `x / 2` (byte, unsigned):**
```asm
    LDA _x
    LSR A           ; 2 cycles, 1 byte
    STA _halved
```

#### Power-of-2 Modulo → AND Mask

```blend65
let rem: byte = x % 4;         // → AND #$03
let rem8: byte = x % 8;        // → AND #$07
let rem16: byte = x % 16;      // → AND #$0F
let rem256: byte = x % 256;    // → no-op (byte is already mod 256)
```

**Codegen for `x % 8`:**
```asm
    LDA _x
    AND #$07        ; 2 cycles, 2 bytes
    STA _rem
```

#### Known-Constant Multiply → Shift-and-Add Decomposition

For non-power-of-2 constants, the compiler decomposes the multiply into shifts and adds:

```blend65
let tripled: byte = x * 3;     // → x + (x << 1)
let times5: byte = x * 5;      // → x + (x << 2)
let times10: word = word(x) * 10; // → (x << 3) + (x << 1)
let times40: word = word(x) * 40; // → (x << 5) + (x << 3)
```

**Codegen for `x * 3` (byte):**
```asm
    LDA _x
    ASL A           ; x << 1
    CLC
    ADC _x          ; + x = x * 3
    STA _tripled
    ; ~8 cycles, 5 bytes
```

**Codegen for `x * 10` (word, from byte):**
```asm
    LDA _x
    STA _tmp
    LDA #0
    STA _tmp+1
    ; x << 1
    ASL _tmp
    ROL _tmp+1
    ; save x*2
    LDA _tmp
    STA _result
    LDA _tmp+1
    STA _result+1
    ; x << 3 (continue shifting: x*2 → x*4 → x*8)
    ASL _tmp
    ROL _tmp+1
    ASL _tmp
    ROL _tmp+1
    ; x*8 + x*2 = x*10
    CLC
    LDA _result
    ADC _tmp
    STA _result
    LDA _result+1
    ADC _tmp+1
    STA _result+1
    ; ~40 cycles, ~24 bytes
```

#### Known-Constant Division → Multiply-by-Reciprocal or Shift Sequences

Non-power-of-2 division by constants uses platform runtime subroutines:

```blend65
let third: byte = x / 3;       // → software divide subroutine
let avg: byte = total / 10;    // → software divide subroutine
```

### Tier 3: Runtime Software Subroutines (Expensive + Warning)

When **both** operands are runtime variables, the compiler generates a call to a software subroutine and emits a warning:

```blend65
let area: word = width * height;
// ⚠️ W10170: Runtime multiply generates subroutine call (~80-120 cycles for 8-bit, ~150-200 for 16-bit)

let avg: byte = total / count;
// ⚠️ W10171: Runtime divide generates subroutine call (~150-200 cycles for 8-bit, ~250-350 for 16-bit)

let rem: byte = value % divisor;
// ⚠️ W10171: Runtime divide generates subroutine call (modulo uses division)
```

**Codegen for `width * height` (both byte, result word):**
```asm
    LDA _width
    STA __mul8_a
    LDA _height
    STA __mul8_b
    JSR __mul8          ; 8-bit multiply subroutine
    ; result in __mul8_result (word)
    LDA __mul8_result
    STA _area
    LDA __mul8_result+1
    STA _area+1
```

**Runtime subroutine costs:**

| Subroutine | Algorithm | Cycles (typical) | ROM Size |
|-----------|-----------|-------------------|----------|
| `__mul8` | 8-bit shift-and-add | ~80-120 | ~30-40 bytes |
| `__mul16` | 16-bit shift-and-add | ~150-200 | ~50-70 bytes |
| `__div8` | 8-bit restoring division | ~150-200 | ~40-50 bytes |
| `__div16` | 16-bit restoring division | ~250-350 | ~60-80 bytes |

**Important:** Each subroutine is included in the binary **only if used**. If a program never uses runtime multiply, `__mul8` is not linked.

### OP-4: Division by Zero

Division by zero is defined behavior (H5 requirement):

- **Compile-time constant zero divisor:** Error E10160
- **Runtime zero divisor:** Result is defined as the **maximum value** for the type. `byte / 0 = 255`, `word / 0 = 65535`. Modulo by zero returns `0`. The compiler emits W10173 if it can prove the divisor might be zero.

```blend65
const BAD: byte = 10 / 0;         // ❌ E10160: division by zero in constant expression

let x: byte = 10;
let y: byte = 0;
let result: byte = x / y;         // Runtime: result = 255 (defined, not undefined)
// ⚠️ W10173: possible division by zero — divisor 'y' may be 0 at runtime
```

**Rationale:** On 6502, there is no exception mechanism. The software divide routine must return *something*. Returning max-value is detectable (unlikely to be a valid result) and deterministic. The warning encourages defensive coding.

### OP-5: Non-Power-of-2 Constant Multiply Warning

When a non-power-of-2 constant is used in multiplication, the compiler emits an informational warning about the shift-and-add decomposition cost:

```blend65
let stride: word = word(index) * 40;
// ⚠️ W10172: multiply by 40 generates shift-and-add sequence (~30-40 cycles) — consider power-of-2 stride for faster access
```

This warning is **informational only** — it's useful for developers optimizing hot loops. It does NOT trigger for power-of-2 constants (which use cheap shifts) or compile-time-constant expressions (which are folded).

---

## Part 6: Shift Operators

### OP-6: Shift Amount Rules

The right operand of `<<` and `>>` specifies the number of bit positions to shift. It must be an unsigned type (`byte` or `word`):

```blend65
let result: byte = x << 3;       // ✅ Shift left by 3 positions
let result2: byte = x >> n;      // ✅ n is byte — OK

let s: sbyte = 2;
let bad: byte = x << s;          // ❌ E10161: shift amount must be unsigned type
```

**Shift amount range:**
- For `byte`/`sbyte` operands: shift by 0-7 (shifts ≥ 8 produce zero for unsigned, 0 or -1 for signed)
- For `word`/`sword` operands: shift by 0-15 (shifts ≥ 16 produce zero for unsigned, 0 or -1 for signed)

Shifts by a compile-time constant ≥ type width produce a warning:

```blend65
let x: byte = 100;
let y: byte = x << 8;            // ⚠️ W10174: shift amount 8 >= type width (8 bits) — result is always 0
```

### OP-7: Left Shift Codegen

Left shift is identical for signed and unsigned types:

```blend65
let result: byte = x << 1;
```

```asm
    LDA _x
    ASL A           ; 2 cycles per bit position
    STA _result
```

For multi-bit shifts by a constant, the compiler unrolls:
```blend65
let result: byte = x << 3;
```

```asm
    LDA _x
    ASL A           ; ×2
    ASL A           ; ×4
    ASL A           ; ×8
    STA _result     ; 6 cycles, 3 bytes for shift operations
```

### OP-8: Right Shift Codegen (Type-Aware)

Right shift behavior depends on the operand type (F010 ST-5):

**Unsigned (logical shift — zero-fill):**
```blend65
let result: byte = ubyte_val >> 1;
```
```asm
    LDA _ubyte_val
    LSR A           ; 0 shifted in from left
    STA _result
```

**Signed (arithmetic shift — sign-extend):**
```blend65
let result: sbyte = sbyte_val >> 1;
```
```asm
    LDA _sbyte_val
    CMP #$80        ; carry = sign bit
    ROR A           ; sign bit shifted in from left
    STA _result     ; 4 cycles for signed vs 2 for unsigned
```

---

## Part 7: Addition and Subtraction Codegen

### 8-Bit Addition

```blend65
let c: byte = a + b;
```

```asm
    LDA _a
    CLC
    ADC _b
    STA _c
    ; 4 instructions, ~8 cycles
```

### 16-Bit Addition

```blend65
let c: word = a + b;    // a, b are word
```

```asm
    CLC
    LDA _a
    ADC _b
    STA _c
    LDA _a+1
    ADC _b+1
    STA _c+1
    ; 7 instructions, ~16 cycles
```

### Auto-Promotion Addition (byte + word)

```blend65
let result: word = base + offset;    // base: word, offset: byte
```

```asm
    ; Zero-extend offset to word
    CLC
    LDA _base
    ADC _offset
    STA _result
    LDA _base+1
    ADC #$00          ; add 0 + carry from low byte
    STA _result+1
    ; 7 instructions, ~16 cycles (same as word+word when offset is known byte)
```

### 8-Bit Subtraction

```blend65
let c: byte = a - b;
```

```asm
    LDA _a
    SEC
    SBC _b
    STA _c
    ; 4 instructions, ~8 cycles
```

### Increment/Decrement Optimization

The compiler recognizes `x += 1` and `x -= 1` and generates optimal `INC`/`DEC` instructions:

```blend65
count += 1;     // → INC _count  (5 cycles for ZP, 6 cycles for absolute)
count -= 1;     // → DEC _count  (5 cycles for ZP, 6 cycles for absolute)
```

This is why `++`/`--` operators are unnecessary — the compiler produces identical machine code for `+= 1`.

---

## Part 8: Bitwise Operator Codegen

All bitwise operators map directly to single 6502 instructions:

### AND, OR, XOR

```blend65
let masked: byte = value & $0F;
let combined: byte = flags | NEW_FLAG;
let toggled: byte = state ^ TOGGLE_MASK;
```

```asm
    LDA _value
    AND #$0F        ; 2 cycles
    STA _masked

    LDA _flags
    ORA #NEW_FLAG   ; 2 cycles
    STA _combined

    LDA _state
    EOR #TOGGLE_MASK ; 2 cycles
    STA _toggled
```

### Bitwise NOT

```blend65
let inverted: byte = ~value;
```

```asm
    LDA _value
    EOR #$FF        ; 2 cycles — invert all bits
    STA _inverted
```

### 16-Bit Bitwise Operations

16-bit bitwise operations operate on both bytes:

```blend65
let result: word = a & b;   // a, b are word
```

```asm
    LDA _a
    AND _b
    STA _result
    LDA _a+1
    AND _b+1
    STA _result+1
    ; 6 instructions, ~12 cycles
```

---

## Part 9: Comparison Operator Codegen

### Unsigned Byte Comparison

```blend65
if (a < b) { ... }   // a, b are byte
```

```asm
    LDA _a
    CMP _b
    BCC .true        ; carry clear = a < b
```

### Signed Byte Comparison

```blend65
if (a < b) { ... }   // a, b are sbyte
```

```asm
    LDA _a
    SEC
    SBC _b
    BVC .no_overflow
    EOR #$80         ; fix sign if overflow
.no_overflow:
    BMI .true        ; negative = a < b
    ; ~8-10 cycles, ~6-8 bytes (vs 4-6 for unsigned)
```

### Equality (Same for Signed and Unsigned)

```blend65
if (x == 0) { ... }
```

```asm
    LDA _x
    BEQ .true        ; 4 cycles, 3 bytes
```

### 16-Bit Comparison

```blend65
if (a < b) { ... }   // a, b are word
```

```asm
    ; Compare high bytes first
    LDA _a+1
    CMP _b+1
    BCC .true        ; high byte less → definitely less
    BNE .false       ; high byte greater → definitely not less
    ; High bytes equal — compare low bytes
    LDA _a
    CMP _b
    BCC .true        ; low byte less
.false:
    JMP .end
.true:
    ...
.end:
```

---

## Part 10: Logical Operator Codegen

### Logical AND (Short-Circuit)

```blend65
if (a > 0 && b < 100) { ... }
```

```asm
    LDA _a
    BEQ .false       ; a == 0 → false, skip right operand
    LDA _b
    CMP #100
    BCS .false       ; b >= 100 → false
    ; both true — execute body
    ...
.false:
```

### Logical OR (Short-Circuit)

```blend65
if (found || search()) { ... }
```

```asm
    LDA _found
    BNE .true        ; found is true → skip right operand
    JSR _search
    BEQ .false       ; search() returned false
.true:
    ; at least one true — execute body
    ...
.false:
```

### Logical NOT

```blend65
let notReady: boolean = !ready;
```

```asm
    LDA _ready
    EOR #$01         ; flip: 0→1, 1→0
    STA _notReady
    ; 3 instructions, ~6 cycles
```

---

## Part 11: Cost Summary

### 8-Bit Operations (byte/sbyte)

| Operation | Cycles | Bytes | Notes |
|-----------|--------|-------|-------|
| `+ - & \| ^ ~` | 6-8 | 4-5 | Native 6502 |
| `<< >> (unsigned)` | 2/bit | 1/bit | `ASL`/`LSR` per bit |
| `>> (signed)` | 4/bit | 2/bit | `CMP #$80; ROR` per bit |
| `== !=` | 4-6 | 3-4 | `CMP; BEQ/BNE` |
| `< > (unsigned)` | 4-6 | 3-4 | `CMP; BCC/BCS` |
| `< > (signed)` | 8-10 | 6-8 | N⊕V flag check |
| `! (logical)` | 6 | 3 | `EOR #$01` |
| `&& \|\|` | 6-10 | 4-8 | Short-circuit branches |
| `-expr (negation)` | 10 | 5 | `EOR #$FF; CLC; ADC #1` |
| `* power-of-2` | 2/bit | 1/bit | `ASL` per bit |
| `* constant` | 8-40 | 5-24 | Shift-and-add decomposition |
| `* runtime` | 80-120 | JSR | Software subroutine |
| `/ power-of-2` | 2/bit | 1/bit | `LSR` per bit |
| `/ runtime` | 150-200 | JSR | Software subroutine |
| `% power-of-2` | 4 | 2 | `AND #mask` |
| `% runtime` | 150-200 | JSR | Software subroutine (uses division) |
| `+= 1` / `-= 1` | 5-6 | 2-3 | Optimized to `INC`/`DEC` |

### 16-Bit Operations (word/sword)

| Operation | Cycles | Bytes | Notes |
|-----------|--------|-------|-------|
| `+ -` | 14-18 | 7-9 | Multi-byte `ADC`/`SBC` |
| `& \| ^` | 12 | 6 | Both bytes |
| `<< >> (unsigned)` | 4/bit | 2/bit | `ASL+ROL` / `LSR+ROR` per bit |
| `==` | 8-10 | 5-6 | Compare both bytes |
| `< > (unsigned)` | 10-14 | 7-10 | High byte first, then low |
| `< > (signed)` | 14-18 | 10-14 | N⊕V on high byte, unsigned on low |
| `* power-of-2` | 4/bit | 2/bit | `ASL+ROL` per bit |
| `* constant` | 30-60 | 20-40 | Shift-and-add at 16-bit width |
| `* runtime` | 150-200 | JSR | 16-bit multiply subroutine |
| `/ runtime` | 250-350 | JSR | 16-bit divide subroutine |

---

## Part 12: Resolved Ambiguities

### OP-A1: Are `&&` and `||` short-circuit?

**Yes.** Guaranteed short-circuit evaluation, left-to-right. This is not an optimization — it's a language guarantee. Functions in the right operand may not execute. Standard C/TypeScript behavior (L3).

### OP-A2: Should `++` / `--` be included?

**No.** Use `+= 1` / `-= 1`. The compiler generates identical `INC`/`DEC` instructions. Eliminating pre/post increment distinction removes the entire class of `i++ + ++i` bugs. The one extra character is a trivial cost.

### OP-A3: What is the result type of shift operators?

Same as the left operand. The shift amount (right operand) must be unsigned but does not affect the result type:

```blend65
let x: byte = 100;
let n: byte = 3;
let result: byte = x << n;    // byte << byte = byte
```

### OP-A4: What happens when shift amount is a runtime variable?

The compiler generates a loop:

```blend65
let result: byte = x << n;    // n is not a constant
```

```asm
    LDA _x
    LDY _n
    BEQ .done
.loop:
    ASL A
    DEY
    BNE .loop
.done:
    STA _result
    ; ~4 + 4*n cycles
```

This is significantly more expensive than constant shifts. No warning is emitted (the developer chose a variable shift deliberately).

### OP-A5: Division result type — integer or fractional?

**Integer only.** Division truncates toward zero (standard integer division):

```blend65
let x: byte = 7 / 2;          // 3 (not 3.5)
let y: byte = 10 / 3;         // 3 (not 3.333...)
let z: sbyte = -7 / 2;        // -3 (truncates toward zero, not -4)
```

There are no floating-point types in Blend65.

### OP-A6: Can operators be applied to struct or array types?

**No.** All operators work only on primitive types (`byte`, `sbyte`, `word`, `sword`, `boolean`). Structs and arrays cannot be compared, added, or used with any operator. Use field access and element indexing to work with individual values.

### OP-A7: What is the type of a literal used as a shift amount?

The literal adapts to `byte` (shift amounts are always unsigned). `x << 3` — the `3` is `byte`.

### OP-A8: Interaction between compound assignment and auto-promotion?

Compound assignment evaluates the expression, then assigns back:

```blend65
let w: word = 1000;
let b: byte = 50;
w += b;    // w = w + b → word + byte(auto-promote) = word → assign to word ✅
b += w;    // b = b + w → byte + word(auto-promote) = word → assign to byte ❌ E10082 (narrowing)
```

### OP-A9: Can comparison operators be chained?

**No.** `a < b < c` is not supported. Use `a < b && b < c`:

```blend65
// ❌ Parse error — comparison chaining not supported
if (0 < x < 100) { }

// ✅ Correct
if (x > 0 && x < 100) { }
```

This is consistent with C and TypeScript (where chaining compiles but produces wrong results). Blend65 rejects it outright.

---

## Part 13: Error Codes

| Code | Message | Trigger |
|------|---------|---------|
| E10154 | Cannot apply `<op>` to `boolean` — ordered comparisons (`<`, `>`, `<=`, `>=`) are not valid for boolean operands | `true > false` |
| E10160 | Division by zero in constant expression | `10 / 0` in const context |
| E10161 | Shift amount must be unsigned type (`byte` or `word`) — found `<type>` | `x << sbyte_val` |

**Existing error codes that apply:**

| Code | Source | Applicability |
|------|--------|--------------|
| E10081 | F010 | Mixed signedness in binary operator |
| E10083 | F010 | Unary negation on unsigned type |
| E10151 | F016 | Boolean in arithmetic expression |

### Warning Codes

| Code | Message | Trigger |
|------|---------|---------|
| W10170 | Runtime multiply generates subroutine call (~`<N>` cycles for `<width>`-bit) | Both operands are runtime variables |
| W10171 | Runtime divide/modulo generates subroutine call (~`<N>` cycles for `<width>`-bit) | Both operands are runtime variables (or non-power-of-2 constant divisor) |
| W10172 | Multiply by `<N>` generates shift-and-add sequence (~`<M>` cycles) — consider power-of-2 stride for faster access | Non-power-of-2 constant multiplier |
| W10173 | Possible division by zero — divisor `<name>` may be 0 at runtime | Divisor not provably non-zero |
| W10174 | Shift amount `<N>` >= type width (`<W>` bits) — result is always 0 | Constant shift >= bit width |

---

## Part 14: Feature Interactions

| Feature | Interaction |
|---------|-------------|
| F008 For loop | Loop variable update (`i += step`) uses compound assignment. `step` must be compatible with loop variable type |
| F009 Switch | Switch comparisons use `==` internally. Case values follow comparison type rules |
| F010 Signed types | Signed comparison codegen (N⊕V). Arithmetic shift for signed `>>`. No negation of unsigned |
| F011 Structs | No operators on struct types. Access fields first, then use operators on field values |
| F013 Control flow | Conditions use comparison and logical operators. Result must be `boolean` (F013 CF-2) |
| F014 Arrays | Array indexing uses `+` internally (base + offset). No operators on whole arrays |
| F016 Type system | All operator type rules defined in F016. F017 specifies codegen and precedence |

---

## Part 15: Examples

### Example 1: Bit Manipulation

```blend65
module bits;

const FLAG_VISIBLE: byte = %00000001;
const FLAG_ACTIVE: byte  = %00000010;
const FLAG_SOLID: byte   = %00000100;

function setFlag(flags: byte, flag: byte): byte {
    return flags | flag;
}

function clearFlag(flags: byte, flag: byte): byte {
    return flags & ~flag;
}

function toggleFlag(flags: byte, flag: byte): byte {
    return flags ^ flag;
}

function hasFlag(flags: byte, flag: byte): boolean {
    return (flags & flag) != 0;
}
```

### Example 2: Multiply Strategies

```blend65
module tiles;

const TILE_WIDTH: byte = 8;
const TILES_PER_ROW: byte = 40;

// Tier 1: compile-time fold
const SCREEN_TILES: word = 40 * 25;   // 1000 — zero cost

// Tier 2: power-of-2 shift
function tilePixelOffset(tileIndex: byte): word {
    return word(tileIndex) * 8;        // → 3 ASL+ROL shifts
}

// Tier 2: constant shift-and-add
function rowByteOffset(row: byte): word {
    return word(row) * 40;             // → shifts + adds (~30 cycles)
    // ⚠️ W10172 — developer can accept or optimize
}

// Tier 3: runtime — unavoidable in some cases
function genericOffset(x: byte, stride: byte): word {
    return word(x) * word(stride);     // → JSR __mul8 (~80-120 cycles)
    // ⚠️ W10170
}
```

### Example 3: Safe Bounds Checking with Short-Circuit

```blend65
module safe;

let buffer: byte[256];
let bufferLen: byte = 0;

function getAt(index: byte): byte {
    // Short-circuit: if index >= bufferLen, the array access never happens
    if (index < bufferLen && buffer[index] != 0) {
        return buffer[index];
    }
    return 0;
}
```

### Example 4: Complete Physics Update

```blend65
module physics;

zeropage {
    posX: word;
    posY: word;
    velX: sbyte;
    velY: sbyte;
}

const GRAVITY: sbyte = 1;
const MAX_SPEED: sbyte = 8;
const FRICTION: byte = 1;

function updatePhysics(): void {
    // Apply gravity (signed arithmetic)
    if (velY < MAX_SPEED) {
        velY += GRAVITY;
    }

    // Apply friction to X velocity (signed)
    if (velX > 0) {
        velX -= sbyte(FRICTION);    // Cast unsigned FRICTION to signed
    } else if (velX < 0) {
        velX += sbyte(FRICTION);
    }

    // Apply velocity to position (mixed width — explicit promotion)
    let newX: sword = sword(posX) + sword(velX);
    let newY: sword = sword(posY) + sword(velY);

    // Clamp to screen bounds
    if (newX >= 0 && newX < 320) {
        posX = word(newX);
    } else {
        velX = 0 - velX;           // Bounce (negation via subtraction from 0 — sbyte context)
    }

    if (newY >= 0 && newY < 200) {
        posY = word(newY);
    } else {
        velY = 0 - velY;
    }
}
```

---

## Part 16: Language Guard Evaluation

| Rule | Status | Notes |
|------|--------|-------|
| **P1** Cross-platform compilable | ✅ | All operators compile to standard 6502 instructions available on every target platform |
| **P2** Platform-meaningful | ✅ | Arithmetic, bitwise, and logical operators are fundamental to every program |
| **P3** No platform assumptions | ✅ | No platform-specific operators. Runtime subroutines are linked per-platform but the operators are universal |
| **P4** Resource-scalable | ✅ | Warnings for expensive operations (W10170-W10172). Developers can choose cheaper alternatives on constrained platforms |
| **H1** 6502 implementable | ✅ | Native operators map to single instructions. Multiply/divide implemented via documented software subroutines |
| **H2** Cost transparency | ✅ | Complete cost table (Part 11) with cycle counts for every operator × width combination. Warnings for expensive codegen |
| **H3** SFA compatible | ✅ | All operations are expression-level — no dynamic allocation. Runtime subroutines use fixed memory locations |
| **H4** Memory footprint documented | ✅ | Part 11 documents byte costs. Runtime subroutines: 30-80 bytes ROM each, only linked if used |
| **H5** Fully deterministic | ✅ | Division by zero returns max-value (defined, not undefined). Overflow wraps. All operations have defined results |
| **L1** Unambiguous syntax | ✅ | Standard operator syntax. Precedence table resolves all parsing ambiguity. No `++`/`--` eliminates expression-vs-statement ambiguity |
| **L2** Consistent with existing | ✅ | Same operators as C/TypeScript (minus excluded set). Precedence matches C |
| **L3** Beginner-friendly | ✅ | Every C/TS developer knows these operators. Short-circuit is expected. Warnings explain costs |
| **L4** Minimal feature | ✅ | Only operators that map naturally to 6502. No unnecessary operators (ternary deferred, no comma, no `++`) |
| **L5** No redundancy | ✅ | Each operator serves a distinct purpose. No overlapping functionality |
| **L6** Error messages defined | ✅ | 3 new error codes (E10154, E10160, E10161), 5 new warnings (W10170-W10174) |
| **L7** Compile-time failure preferred | ✅ | Type errors at compile time. Division by zero in constants at compile time. Only runtime div-by-zero has defined runtime behavior |
| **L8** Feature interactions documented | ✅ | Part 14: interactions with F008-F016 |
| **L9** Documentable with examples | ✅ | Part 15: four examples covering bits, multiply strategies, bounds checking, physics |
| **C1** Lexer/parser implementable | ✅ | All operators use standard tokens. Pratt parser handles precedence. No ambiguity |
| **C2** Semantic analysis defined | ✅ | Type checking via F016 matrices. Shift amount validation. Constant folding for constant expressions |
| **C3** Code generation strategy | ✅ | Complete codegen patterns for every operator at every width (Parts 5-10) |
| **C4** Unit testable | ✅ | Each operator × type combination is a test case. Each codegen tier is independently testable |
| **C5** Runtime verifiable | ✅ | All operations produce deterministic results verifiable in emulator |
| **F1** Extensible | ✅ | Ternary can be added later (FUT-003). New operators don't require changing existing ones |
| **F2** Platform-profile ready | ✅ | Runtime subroutines can be platform-optimized (e.g., CX16's faster CPU might have different cycle counts in documentation) |
| **F3** Optimizer-friendly | ✅ | Constant folding, strength reduction, and peephole optimization all applicable. `+= 1` → `INC` is a standard optimization |
| **F4** Stability classification | ✅ | **Stable** — standard operators with decades of precedent |

**Verdict: ✅ ACCEPTED — all 23 rules pass**
