# Chapter 02 — Type System

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F016, F010, F022 (enum↔byte rules)

---

## 1. Overview

Blend65 v3 is **fully explicitly typed** — every variable, constant, parameter, and return type requires an explicit type annotation. There is no type inference. This is a deliberate design choice: on the 6502, the difference between `byte` and `word` directly determines memory usage, register allocation, and cycle counts. The developer states their intent; the compiler enforces it.

This chapter defines the complete type system: the six primitive types, derived types (arrays, structs, enums), the rules for how types interact in expressions and assignments, explicit cast semantics, and the enum conversion model.

---

## 2. Primitive Types

Blend65 has exactly **six primitive types**:

| Type | Size | Signed | Range | 6502 Mapping |
|------|------|--------|-------|-------------|
| `byte` | 8-bit | No | 0 to 255 | A/X/Y register, ZP byte, RAM byte |
| `sbyte` | 8-bit | Yes | -128 to 127 | A/X/Y register, ZP byte, RAM byte |
| `word` | 16-bit | No | 0 to 65535 | ZP pair, RAM pair, little-endian |
| `sword` | 16-bit | Yes | -32768 to 32767 | ZP pair, RAM pair, little-endian |
| `boolean` | 8-bit | No | `true` / `false` | Byte: 0 = false, non-zero = true |
| `void` | 0 | — | — | No storage (function return type only) |

### 2.1 Type Families

| Family | Types | Shared Properties |
|--------|-------|-------------------|
| Unsigned integer | `byte`, `word` | Unsigned arithmetic, carry-flag comparisons |
| Signed integer | `sbyte`, `sword` | Two's complement, N⊕V comparisons |
| Integer (all) | `byte`, `sbyte`, `word`, `sword` | Arithmetic, bitwise, comparison operators |
| 8-bit | `byte`, `sbyte` | Single register, direct addressing |
| 16-bit | `word`, `sword` | Register pair, multi-byte operations |
| Logical | `boolean` | Logical operators only; used in conditions |
| No-value | `void` | Function return type only; no storage |

### 2.2 Derived Types

Derived types are composite constructs built from primitive types. They are not first-class types in the same way as primitives.

| Derived Type | Example | Defined In |
|-------------|---------|------------|
| Array | `byte[256]`, `sword[10]` | → Ch 08 |
| Struct | `struct Player { x: byte; y: byte; }` | → Ch 07 |
| Enum | `enum Direction { UP, DOWN, LEFT, RIGHT }` | → Ch 09 |

---

## 3. Type Annotations

### TS-1 — Mandatory Type Annotations

Every declaration **must** include an explicit type annotation. There is no type inference.

```blend65
let health: byte = 100;          // ✅
const MAX: byte = 255;           // ✅
function damage(amount: byte): byte { ... }  // ✅

let x = 10;                      // ❌ E10150: type annotation required
const MAX = 255;                  // ❌ E10150
function foo(n): void { ... }     // ❌ E10150: parameter type required
```

**Exception — array size inference** (→ Ch 08): The *element count* of an array may be inferred from its initializer. The element *type* is always explicit.

```blend65
const DATA: byte[] = [1, 2, 3, 4];  // ✅ Size inferred as 4; type (byte) is explicit
```

### TS-2 — Literal Type Rules

Numeric literals have default types determined by their value:

| Literal Value | Default Type | Rule |
|--------------|-------------|------|
| 0 to 255 | `byte` | Fits in unsigned 8-bit |
| 256 to 65535 | `word` | Fits in unsigned 16-bit |
| -1 to -128 | `sbyte` | Negative, fits in signed 8-bit |
| -129 to -32768 | `sword` | Negative, fits in signed 16-bit |
| `true`, `false` | `boolean` | Boolean literals |

When a literal appears in a context with a declared type, the compiler checks that the literal's value fits the target type's range:

```blend65
let a: sbyte = 42;       // ✅ 42 fits in -128..127
let b: sbyte = 200;      // ❌ E10084: 200 out of range for sbyte
let c: word = 10;        // ✅ 10 fits in 0..65535
let d: byte = -1;        // ❌ E10084: -1 out of range for byte
let e: byte = 256;       // ❌ E10084: 256 out of range for byte
```

**Literal adaptation in expressions:** A literal used alongside a typed operand adapts to that operand's type if the value fits:

```blend65
let x: sbyte = 5;
let y: sbyte = x + 1;    // ✅ literal 1 adapts to sbyte (fits in range)
```

This is not type inference — the variable type is always explicit. It is literal adaptation within an already-typed context.

---

## 4. Expression Type Rules

### TS-3 — Same-Type Operations

When both operands of a binary operator have the **same type**, the result has that type:

| Expression | Result Type |
|-----------|-------------|
| `byte OP byte` | `byte` |
| `word OP word` | `word` |
| `sbyte OP sbyte` | `sbyte` |
| `sword OP sword` | `sword` |

This applies to all arithmetic (`+`, `-`, `*`, `/`, `%`) and bitwise (`&`, `|`, `^`, `<<`, `>>`) operators.

Ordinary `+`, `-`, `+=`, and `-=` always use binary integer semantics. Processor decimal and carry
flags never change their source-level meaning. Packed-decimal arithmetic uses the explicit
`bcd_add()` and `bcd_sub()` operations from Chapter 12.

### TS-4 — Mixed-Width Auto-Promotion (Same Signedness)

When operands have **different widths but the same signedness**, the narrower operand is implicitly widened to match the wider:

| Expression | Promotion | Result Type |
|-----------|-----------|-------------|
| `byte` OP `word` | `byte` → `word` (zero-extend) | `word` |
| `word` OP `byte` | `byte` → `word` (zero-extend) | `word` |
| `sbyte` OP `sword` | `sbyte` → `sword` (sign-extend) | `sword` |
| `sword` OP `sbyte` | `sbyte` → `sword` (sign-extend) | `sword` |

```blend65
let offset: byte = 42;
let base: word = 1000;
let result: word = base + offset;  // ✅ byte auto-promotes to word: 1042
```

**Why auto-promotion is safe:** Widening never loses data. `byte` 200 → `word` 200. `sbyte` -5 → `sword` -5. The mathematical value is preserved.

**6502 cost:** Widening has no fixed surcharge independent of its consumer. For the standalone
stored conversions displayed in F010, zero extension uses 11–14 cycles and 8–11 ROM bytes, while
sign extension uses 16–21 cycles and 17–20 ROM bytes for zero-page or absolute source/result homes.
A selected operation may absorb some or all of that work and must report the instructions it
actually emits.

### TS-5 — Mixed-Signedness Is an Error

Mixing signed and unsigned types in the same expression is a **compile-time error**:

| Expression | Result |
|-----------|--------|
| `byte` OP `sbyte` | ❌ E10081 |
| `byte` OP `sword` | ❌ E10081 |
| `word` OP `sbyte` | ❌ E10081 |
| `word` OP `sword` | ❌ E10081 |

```blend65
let pos: byte = 100;
let vel: sbyte = -3;

let invalidResult: sbyte = pos + vel;       // ❌ E10081: cannot mix byte and sbyte
let signedResult: sbyte = sbyte(pos) + vel; // ✅ explicit cast
let unsignedResult: byte = pos + byte(vel); // ✅ explicit cast
```

**Rationale:** The 6502 uses the same ADD instruction for signed and unsigned, but the *meaning* differs. Requiring an explicit cast forces the developer to declare which interpretation they intend.

### TS-6 — Boolean Is Not Numeric

`boolean` cannot participate in arithmetic or bitwise expressions. It is a purely logical type.

```blend65
let flag: boolean = true;
let count: byte = 5;

let x: byte = count + flag;       // ❌ E10151
let y: byte = byte(flag);         // ❌ E10086: cannot cast boolean to byte
let z: boolean = boolean(count);   // ❌ E10086: cannot cast byte to boolean
```

**Valid boolean operations:** `&&`, `||`, `!`, and equality comparison (`==`, `!=`) between booleans. Comparison operators produce boolean results (TS-7).

### TS-7 — Comparison Operators Produce Boolean

All comparison operators (`==`, `!=`, `<`, `<=`, `>`, `>=`) produce `boolean`, regardless of operand types. Comparisons follow the same type-mixing rules as arithmetic:

```blend65
let a: byte = 100;
let b: word = 1000;
let ok: boolean = a < b;          // ✅ byte auto-promotes to word

let c: byte = 100;
let d: sbyte = -5;
let bad: boolean = c > d;         // ❌ E10081: cannot mix byte and sbyte
```

**Boolean comparison restrictions:** `boolean` supports only `==` and `!=`. Ordered comparisons (`<`, `>`, `<=`, `>=`) on `boolean` are an error (**E10154**).

### TS-8 — Unary Minus on Signed Types Only

The unary negation operator (`-expr`) is valid only on signed types (`sbyte`, `sword`):

```blend65
let vel: sbyte = 5;
let neg: sbyte = -vel;             // ✅
let pos: byte = 5;
let neg2: byte = -pos;            // ❌ E10083: cannot negate unsigned type
```

Negative *literals* work naturally: `let x: sbyte = -42;`

---

## 5. The Complete Type Mixing Matrix

### 5.1 Arithmetic and Bitwise Operators

| Left \ Right | `byte` | `sbyte` | `word` | `sword` | `boolean` |
|-------------|--------|---------|--------|---------|-----------|
| **`byte`** | `byte` | ❌ E10081 | `word` ↑ | ❌ E10081 | ❌ E10151 |
| **`sbyte`** | ❌ E10081 | `sbyte` | ❌ E10081 | `sword` ↑ | ❌ E10151 |
| **`word`** | `word` ↑ | ❌ E10081 | `word` | ❌ E10081 | ❌ E10151 |
| **`sword`** | ❌ E10081 | `sword` ↑ | ❌ E10081 | `sword` | ❌ E10151 |
| **`boolean`** | ❌ E10151 | ❌ E10151 | ❌ E10151 | ❌ E10151 | ❌ E10151 |

*↑ = narrower operand auto-promotes to match wider operand*

### 5.2 Comparison Operators (Result Is Always `boolean`)

| Left \ Right | `byte` | `sbyte` | `word` | `sword` | `boolean` |
|-------------|--------|---------|--------|---------|-----------|
| **`byte`** | ✅ unsigned | ❌ E10081 | ✅ promote | ❌ E10081 | ❌ E10151 |
| **`sbyte`** | ❌ E10081 | ✅ signed | ❌ E10081 | ✅ promote | ❌ E10151 |
| **`word`** | ✅ promote | ❌ E10081 | ✅ unsigned | ❌ E10081 | ❌ E10151 |
| **`sword`** | ❌ E10081 | ✅ promote | ❌ E10081 | ✅ signed | ❌ E10151 |
| **`boolean`** | ❌ E10151 | ❌ E10151 | ❌ E10151 | ❌ E10151 | `==`/`!=` only |

### 5.3 Assignment Compatibility

| Target \ Source | `byte` | `sbyte` | `word` | `sword` | `boolean` |
|----------------|--------|---------|--------|---------|-----------|
| **`byte`** | ✅ | ❌ E10080 | ❌ E10082 | ❌ E10080 | ❌ E10086 |
| **`sbyte`** | ❌ E10080 | ✅ | ❌ E10080 | ❌ E10082 | ❌ E10086 |
| **`word`** | ✅ widen | ❌ E10080 | ✅ | ❌ E10080 | ❌ E10086 |
| **`sword`** | ❌ E10080 | ✅ widen | ❌ E10080 | ✅ | ❌ E10086 |
| **`boolean`** | ❌ E10086 | ❌ E10086 | ❌ E10086 | ❌ E10086 | ✅ |

**Rules:**
- **Same type** → always OK.
- **Same-signedness widening** (byte→word, sbyte→sword) → implicit, safe.
- **Narrowing** (word→byte, sword→sbyte) → **E10082**, requires explicit cast.
- **Cross-signedness** (byte→sbyte, word→sword, etc.) → **E10080**, requires explicit cast.
- **Boolean ↔ integer** → **E10086**, not convertible.

---

## 6. Intermediate Overflow

### TS-9 — Expression Type from Operands, Not Destination

The type of an expression is determined by its operands, **not** the destination variable. A narrow expression assigned to a wider variable evaluates at the narrow width first, then widens.

```blend65
let a: byte = 200;
let b: byte = 100;
let result: word = a + b;  // byte + byte = byte → 44 (wraps) → word(44) = 44
                             // ⚠️ W10161: exact reaching values prove the wrap
```

**The fix:** Cast operands before the operation:

```blend65
let result: word = word(a) + word(b);  // word + word = word → 300 ✅
```

**Warning triggers:** The compiler emits **W10160** when:
1. An arithmetic expression (`+`, `-`, `*`) has narrow operands (byte/sbyte).
2. The result is widened by assignment, argument binding, return binding, or another explicit
   semantic context such as a direct subscript after a narrow barrier.
3. Overflow is possible at the narrow width.

W10161 replaces W10160 when pre-optimization semantic analysis proves the exact reaching operand
values and exact intermediate wrap. That proof may use literals, `const` values, or one unmodified
reaching value of a mutable local; it must not rely on an optimizer choice or ignore aliases,
calls, interrupts, or volatile effects. The warning does **not** trigger for bitwise operations,
comparisons, or when the narrow expression is provably in range.

Array subscripting is the one explicit operator context that promotes direct 8-bit ordinal
arithmetic before it evaluates (Chapter 08, AR-4). It is not destination-driven conversion: the
`[]` operator defines the semantic domain of its own index operand so that `array[i + 10]` does not
silently wrap at 255 merely because `i` is stored as a byte. An explicit 8-bit cast or other narrow
barrier restores ordinary narrow arithmetic. The contextual promotion itself emits neither W10160
nor W10161; warnings still apply to an explicit narrow expression completed before subscripting.

### TS-10 — Chained Expression Order

Left-to-right evaluation with type propagation: `a + b + c` evaluates as `(a + b) + c`. The intermediate type of `a + b` is used for the next operation.

```blend65
let a: byte = 200;
let b: byte = 100;
let c: word = 1000;

let r1: word = a + b + c;   // (200+100)=44 at byte, then 44+1000=1044 at word
let r2: word = a + c + b;   // (200+1000)=1200 at word (promoted), then 1200+100=1300
```

**Note:** `a + b + c` and `a + c + b` may produce different results due to intermediate overflow.

---

## 7. Explicit Casts

### TS-11 — Cast Syntax

All explicit type conversions use function-call syntax:

```blend65
byte(expr)      // Cast to byte
sbyte(expr)     // Cast to sbyte
word(expr)      // Cast to word
sword(expr)     // Cast to sword
```

A cast is **not** a function call — it is a compile-time type conversion that uses function-call syntax for readability. No JSR is generated for same-size casts.

### TS-12 — Cast Behavior

The cost column below is explicit about its boundary. “No added instruction” means that the
conversion changes only interpretation or selects an already available byte; it excludes unrelated
loads/stores. Widening rows give the complete standalone stored forms displayed in F010.

| Cast | Behavior | Selected 6502 cost |
|------|----------|--------------------|
| Same size, same signedness | No-op (identity) | No added instruction |
| Same size, cross-signedness (byte↔sbyte, word↔sword) | Reinterpret bits | No added instruction |
| Widen unsigned (byte→word) | Zero-extend high byte | 11–14 cycles, 8–11 bytes for the complete stored form |
| Widen signed (sbyte→sword) | Sign-extend high byte | 16–21 cycles, 17–20 bytes for the complete stored form |
| Narrow (word→byte, sword→sbyte) | Select low byte | No added instruction when the low byte is already available |
| Narrow cross-sign (word→sbyte, sword→byte) | Select low byte and reinterpret | No added instruction when the low byte is already available |

These costs do not merge distinct variables or remove an ordinary assignment. In
`let s: sbyte = sbyte(b)`, `b` and `s` remain independent objects whenever
both are live or either can be observed through an alias. The compiler may coalesce their homes
only when ordinary liveness, alias, volatility, and interference proofs show that doing so preserves
all reads and writes. Otherwise the assignment performs the required register or memory move even
though no additional bit-conversion instruction is needed.

### TS-13 — Cast Restrictions

| Cast | Result |
|------|--------|
| `boolean` → any integer | ❌ E10086 |
| Any integer → `boolean` | ❌ E10086 |
| `void` → anything | ❌ E10152 |
| Anything → `void` | ❌ E10152 |
| Struct → any type | ❌ E10153 |
| Array → any type | ❌ E10153 |

Casts work only between the four integer types (`byte`, `sbyte`, `word`, `sword`) and for enum conversions (§8).

---

## 8. Enum Type Conversions

Enums are byte-backed nominal types (→ Ch 09 for full enum specification). This section defines the canonical conversion rules that the type system enforces.

### TS-14 — Implicit Enum → Byte (Widening)

An enum value is implicitly usable wherever a `byte` is expected: assignment, function arguments, `poke`, arithmetic, and comparison.

```blend65
let dir: Direction = Direction.UP;
let n: byte = dir;                // ✅ implicit enum → byte
poke($D000, dir);                // ✅ poke expects byte
let sum: byte = dir + 1;         // ✅ arithmetic on byte representation
```

Enum → `byte` is the **only** implicit conversion from an enum. An enum does not implicitly convert to `word` or `sword`; widen the resulting byte explicitly if needed: `word(dir)`.

### TS-15 — Explicit Byte → Enum (Narrowing)

A `byte` becomes an enum value only through an explicit `EnumName(expr)` cast:

```blend65
let dir: Direction = Direction(peek($D000));  // ✅ explicit cast
let dir: Direction = Direction(rawByte);      // ✅
let dir: Direction = 0;                        // ❌ E10235
```

The cast is **compile-time only** (zero runtime cost). The byte value is taken as-is — it is **not** range-checked against declared members. If the byte matches no member, the value is still well-defined (axiom A3); it simply has no member name.

### TS-16 — Cross-Enum Comparison

Comparing two different enum types directly is an error (**E10236**). Cast one to `byte` first:

```blend65
if (dir == GameState.MENU) { ... }  // ❌ E10236: different enum types
if (byte(dir) == byte(state)) { ... }  // ✅ explicit byte comparison
```

---

## 9. Compound Assignment Type Rules

### TS-17 — Compound Assignment

Compound assignment operators (`+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `|=`, `^=`, `<<=`, `>>=`) are equivalent to their expanded form:

`x OP= expr` is equivalent to `x = x OP expr`

The right-hand side must be type-compatible after the operation:

```blend65
let score: word = 1000;
let bonus: byte = 50;
score += bonus;              // ✅ word += byte → auto-promote → word

let vel: sbyte = 5;
vel += 1;                    // ✅ sbyte += sbyte(literal 1) = sbyte

let pos: byte = 100;
let delta: sbyte = -3;
pos += delta;                // ❌ E10081: cannot mix byte and sbyte
```

---

## 10. Constant Expression Evaluation

### TS-18 — Compile-Time Constants

Constant expressions (used in `const` initializers, array sizes, case values, and enum member values) are evaluated at compile time with full-precision arithmetic:

```blend65
const SIZE: word = 40 * 25;       // ✅ 1000
const HALF: byte = 256 / 2;       // ✅ 128
const MASK: byte = $FF & $0F;     // ✅ $0F
```

After evaluation, the result must fit the declared type's range:

```blend65
const TOO_BIG: byte = 200 + 100;  // ❌ E10084: 300 out of range for byte
const OK: word = 200 + 100;       // ✅ 300 fits in word
```

Constant folding is a **language requirement**, not an optimization.

---

## 11. Right Shift Semantics

### TS-19 — Type-Aware Right Shift

The `>>` operator is type-aware:

- **Unsigned** (`byte`, `word`): Logical right shift — zero-fills from the left.
- **Signed** (`sbyte`, `sword`): Arithmetic right shift — sign-extends from the left.

```blend65
let u: byte = 0b10000000;      // 128
let s: sbyte = sbyte(u);        // -128

let ur: byte = u >> 1;          // 0b01000000 = 64  (logical)
let sr: sbyte = s >> 1;         // 0b11000000 = -64 (arithmetic)
```

Left shift (`<<`) is identical for both signed and unsigned types.

When a right-shift count is at least the operand width, the result is saturated rather than obtained
by masking the count: unsigned operands and non-negative signed operands yield `0`; negative signed
operands yield `-1`. This keeps arithmetic right shift sign-extending for every count.

---

## 12. Overflow Behavior

### TS-20 — Deterministic Wrapping

Integer overflow wraps deterministically — this is the natural two's complement behavior of the 6502. There is no undefined behavior on overflow.

```blend65
let x: byte = 255;
x = x + 1;          // 0 (wraps)

let y: sbyte = 127;
y = y + 1;           // -128 (wraps)
```

In an ordinary runtime-expression context, the compiler emits W10100 when a same-width signed wrap
is detectable at compile time. A true constant context uses full precision and E10084 instead.

---

## 13. Compile-Time Size Queries and Representable Objects

### TS-21 — `sizeof` Returns `word`

`sizeof(TypeName)` always returns `word`. Type-size arithmetic therefore does not change source
meaning when a fixed object crosses 255 bytes. The result is still a compile-time constant, and
machine lowering may use one byte when proof shows that every consumer observes the same value.
Full `sizeof` specification: → Ch 04.

### TS-22 — `offsetof` Returns `word`

`offsetof(StructType, fieldName)` always returns `word`. A field may begin after byte 255 in a
valid struct, so field-offset arithmetic must not silently narrow merely because many structs are
small. The result is a compile-time constant, and proof may select byte-only machine work when that
preserves every use.

### TS-23 — Fixed Object Size Domain

Every array extent is evaluated as a full-precision constant and must be in `0..65535`. Every
fixed array or struct type must occupy `0..65535` bytes after its complete nested size is computed
at full precision. These limits keep array counts, object sizes, field offsets, and 16-bit address
formation total without adding a wider runtime integer or hidden runtime support. They do not cap a
struct at 255 bytes.

An unsized array type such as `byte[]` has no standalone fixed size. It is legal only in the
initializer-inference and any-size-parameter roles defined by Chapters 06 and 08; applying
`sizeof` to it is rejected.

---

## 14. Diagnostic Conditions

This chapter owns the type-system predicates and consequences below. Chapter 14 alone owns public
severities, message templates, spans, suppression, and history.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10080 | An implicit conversion crosses signed and unsigned integer families. | The conversion is rejected; an explicit cast is required. |
| E10081 | One integer operation mixes signed and unsigned operands without an explicit cast. | The expression is rejected. |
| E10082 | An implicit conversion narrows an integer value. | The conversion is rejected; an explicit cast is required. |
| E10083 | Unary minus is applied to an unsigned integer. | The expression is rejected. |
| E10084 | A full-precision constant-context result does not fit the required declared type. | The constant declaration/use is rejected; no narrow-width wrap is performed. |
| E10086 | A cast converts between boolean and integer. | The cast is rejected. |
| E10150 | A declaration omits a required type annotation. | The declaration is rejected. |
| E10151 | Boolean participates in arithmetic or bitwise operations. | The expression is rejected. |
| E10152 | A cast has `void` as source or destination. | The cast is rejected. |
| E10153 | A cast targets or consumes a struct or array type. | The cast is rejected. |
| E10154 | An ordered comparison has a boolean operand. | The comparison is rejected. |
| E10241 | A type-name position contains an unresolved identifier. | The declaration or expression is rejected. |
| E10235 | A byte value reaches an enum destination without an explicit enum cast. | The conversion is rejected. |
| E10236 | A comparison combines two different nominal enum types. | The comparison is rejected. |

### Warning Conditions

These warnings apply only to ordinary runtime-expression semantics, even when all operands happen
to be compile-time known. They never change TS-18 constant contexts, which use full precision and
E10084 rather than intermediate wrapping.

| Code | Trigger | Consequence |
|------|---------|-------------|
| W10100 | A compile-time-known ordinary runtime signed expression overflows its signed operand width and remains at that width. | The exact two's-complement wrapped result is used. |
| W10101 | An explicit narrowing cast has a compile-time-known value that loses bits. | The exact truncated result is used. |
| W10160 | An ordinary runtime narrow arithmetic expression is widened by its context and may overflow before widening, but the exact operands are not compile-time known. | The operand-width runtime result is widened. |
| W10161 | An ordinary runtime narrow arithmetic expression is widened by its context and compile-time-known operands prove that it wraps before widening. | The exact operand-width wrapped result is widened; W10160 is not also emitted for the same expression. |
