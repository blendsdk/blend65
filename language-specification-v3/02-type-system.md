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
function foo(n) { ... }           // ❌ E10150
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

**6502 cost:** Zero-extend (byte→word): ~4 cycles, 4 bytes. Sign-extend (sbyte→sword): ~8–12 cycles, 6–8 bytes. Documented per operation in → Ch 04.

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

let result = pos + vel;            // ❌ E10081: cannot mix byte and sbyte
let result: sbyte = sbyte(pos) + vel;  // ✅ explicit cast
let result: byte = pos + byte(vel);    // ✅ explicit cast
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
                             // ⚠️ W10160: byte arithmetic may overflow before widening
```

**The fix:** Cast operands before the operation:

```blend65
let result: word = word(a) + word(b);  // word + word = word → 300 ✅
```

**Warning triggers:** The compiler emits **W10160** when:
1. An arithmetic expression (`+`, `-`, `*`) has narrow operands (byte/sbyte).
2. The result is assigned to a wider type (word/sword).
3. Overflow is possible at the narrow width.

The warning does **not** trigger for bitwise operations, comparisons, or when the narrow expression is provably in range (constant folding).

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

| Cast | Behavior | 6502 Cost |
|------|----------|-----------|
| Same size, same signedness | No-op (identity) | 0 cycles |
| Same size, cross-signedness (byte↔sbyte, word↔sword) | Reinterpret bits | 0 cycles |
| Widen unsigned (byte→word) | Zero-extend high byte | ~4 cycles, 4 bytes |
| Widen signed (sbyte→sword) | Sign-extend high byte | ~8–12 cycles, 6–8 bytes |
| Narrow (word→byte, sword→sbyte) | Truncate to low byte | 0 cycles |
| Narrow cross-sign (word→sbyte, sword→byte) | Truncate + reinterpret | 0 cycles |

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

Constant expressions (used in `const` initializers, array sizes, `embed()` offsets, case values, enum member values) are evaluated at compile time with full-precision arithmetic:

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

The compiler emits **W10100** when signed overflow is detectable at compile time in constant expressions.

---

## 13. `sizeof` Return Type

### TS-21 — sizeof Returns byte or word

`sizeof(TypeName)` returns `byte` for types with size ≤ 255 bytes, `word` for larger types. In practice, all primitives and most structs fit in `byte`; large arrays may require `word`. Full `sizeof` specification: → Ch 04.

---

## 14. Error Codes

Errors defined in this chapter (canonical owner):

| Code | Message |
|------|---------|
| E10080 | Cannot implicitly convert `<from_type>` to `<to_type>` — use explicit cast: `<to_type>(<expr>)` |
| E10081 | Cannot mix signed type `<type_a>` with unsigned type `<type_b>` in expression — cast one operand |
| E10082 | Cannot implicitly narrow `<from_type>` to `<to_type>` — use explicit cast: `<to_type>(<expr>)` |
| E10083 | Cannot negate unsigned type `<type>` — use `sbyte`/`sword` for signed arithmetic |
| E10084 | Value `<value>` out of range for type `<type>` (range: `<min>` to `<max>`) |
| E10085 | Array index must be unsigned type (`byte` or `word`) — found `<type>` |
| E10086 | Cannot cast `<from_type>` to `<to_type>` — boolean is not convertible to/from integer types |
| E10150 | Type annotation required — use `let <name>: <type> = <expr>` |
| E10151 | Cannot use `boolean` in arithmetic/bitwise expression — boolean is a logical type, not numeric |
| E10152 | Cannot cast to or from `void` |
| E10153 | Cannot cast struct or array types — only integer types support casts |
| E10154 | Cannot apply `<op>` to `boolean` — ordered comparisons are not valid for boolean operands |
| E10235 | Cannot assign `<type>` to enum `<name>` — use an explicit cast `<name>(<expr>)` |
| E10236 | Cannot compare enum `<a>` with enum `<b>` — different enum types. Cast one to `byte` |

### Warning Codes

| Code | Message |
|------|---------|
| W10100 | Signed overflow in constant expression — result wraps to `<value>` |
| W10101 | Narrowing cast from `<from_type>` to `<to_type>` truncates value `<value>` to `<result>` |
| W10160 | `<narrow_type>` arithmetic may overflow before widening to `<wide_type>` — use `<wide_type>(a) <op> <wide_type>(b)` |
| W10161 | Constant expression overflow — `<expr>` wraps to `<value>` at `<type>` width before widening |
