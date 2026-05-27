# F016 — Type System Rules

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F010 (signed types)  
> **Interacts with**: F003 (module contents), F008 (for loop), F011 (structs), F013 (control flow), F014 (arrays), F017 (operators)

---

## Description

This feature formalizes the complete type system rules for Blend65 v3 — the rules that govern how types interact across all declarations, expressions, and assignments. While individual type-related decisions were made in earlier features (F010's signed/unsigned mixing rules, F013's boolean-only conditions, F014's array type rules), this document is the **single source of truth** for how the type system works as a unified whole.

Blend65 v3 is **fully explicitly typed** — every declaration requires a type annotation. There is no type inference. This is a deliberate design choice for a 6502 language where the difference between `byte` and `word` directly determines memory usage, register allocation, and cycle counts. The developer states their intent; the compiler enforces it.

---

## Part 1: The Type Table

Blend65 v3 has exactly six types:

| Type | Size | Signed | Range | 6502 Mapping |
|------|------|--------|-------|-------------|
| `byte` | 8-bit | No | 0 to 255 | A/X/Y register, ZP byte, RAM byte |
| `sbyte` | 8-bit | Yes | -128 to 127 | A/X/Y register, ZP byte, RAM byte |
| `word` | 16-bit | No | 0 to 65535 | ZP pair, RAM pair, little-endian |
| `sword` | 16-bit | Yes | -32768 to 32767 | ZP pair, RAM pair, little-endian |
| `boolean` | 8-bit | No | `true` / `false` | Byte: 0 = false, non-zero = true |
| `void` | 0 | — | — | No storage (function return type only) |

**Type families:**

| Family | Types | Shared Properties |
|--------|-------|-------------------|
| Unsigned integer | `byte`, `word` | Unsigned arithmetic, carry-flag comparisons |
| Signed integer | `sbyte`, `sword` | Two's complement, N⊕V comparisons |
| Integer (all) | `byte`, `sbyte`, `word`, `sword` | Arithmetic, bitwise, comparison operators |
| 8-bit | `byte`, `sbyte` | Single register, direct addressing |
| 16-bit | `word`, `sword` | Register pair, multi-byte operations |
| Logical | `boolean` | Logical operators only, used in conditions |
| No-value | `void` | Function return type only |

**Derived types** (not first-class types — composite constructs built from the above):

| Derived Type | Example | Defined In |
|-------------|---------|------------|
| Array | `byte[256]`, `sword[10]` | F014 |
| Struct | `struct Player { x: byte, y: byte }` | F011 |
| Enum | `enum Direction { UP, DOWN, LEFT, RIGHT }` | v2 §2 (byte-backed) |
| Type alias | `type SpriteId = byte;` | v2 §2 |

---

## Part 2: Type Annotations Are Always Required

### TS-1: Mandatory Type Annotations

Every variable, constant, parameter, and return type declaration **must** include an explicit type annotation. There is no type inference.

```blend65
// ✅ Correct — type annotations on everything
let health: byte = 100;
let worldX: word = 1000;
let velocity: sbyte = -3;
const MAX_ENEMIES: byte = 8;
const SCREEN_WIDTH: word = 320;

function damage(amount: byte): byte {
    let newHealth: byte = health - amount;
    return newHealth;
}

// ❌ E10150: type annotation required
let x = 10;
const MAX = 255;
function foo(n) { }
```

**Why no inference:** On 6502, the type IS the design decision. `byte` vs `word` is the difference between 1-byte and 2-byte operations, between 4-cycle and 12-cycle arithmetic. The developer must actively choose, and the annotation documents that choice for every reader of the code.

**Exceptions — array size inference is allowed** (F014):
```blend65
const DATA: byte[] = [1, 2, 3, 4];           // ✅ Size inferred as 4 — element TYPE is explicit
const SPRITES: byte[] = embed("p.spd").sprites; // ✅ Size inferred from file — element TYPE is explicit
```

Array size inference is NOT type inference — the *type* (`byte`) is always stated. Only the *count* is inferred from the initializer.

### TS-2: Literal Type Rules

Numeric literals have types determined by their value (established in F010 ST-4):

| Literal Value | Default Type | Rule |
|--------------|-------------|------|
| 0 to 255 | `byte` | Fits in unsigned 8-bit |
| 256 to 65535 | `word` | Fits in unsigned 16-bit |
| -1 to -128 | `sbyte` | Negative, fits in signed 8-bit |
| -129 to -32768 | `sword` | Negative, fits in signed 16-bit |
| `true`, `false` | `boolean` | Boolean literals |

**Context adaptation:** When a literal is used in a context with a declared type, the compiler checks that the literal's value fits in the target type's range:

```blend65
let a: sbyte = 42;      // ✅ 42 fits in -128..127 (sbyte range)
let b: sbyte = 200;     // ❌ E10084: 200 out of range for sbyte
let c: word = 10;       // ✅ 10 fits in 0..65535 (word range)
let d: byte = -1;       // ❌ E10084: -1 out of range for byte
let e: byte = 256;      // ❌ E10084: 256 out of range for byte
```

Hex and binary literals follow the same rules based on their numeric value:
```blend65
let x: byte = $FF;       // ✅ $FF = 255, fits in byte
let y: byte = $100;      // ❌ E10084: $100 = 256, out of range for byte
let z: byte = %11111111; // ✅ %11111111 = 255, fits in byte
```

---

## Part 3: Expression Type Rules

### TS-3: Same-Type Operations

When both operands of a binary operator have the **same type**, the result has that same type:

| Expression | Result Type |
|-----------|-------------|
| `byte OP byte` | `byte` |
| `word OP word` | `word` |
| `sbyte OP sbyte` | `sbyte` |
| `sword OP sword` | `sword` |

```blend65
let a: byte = 100;
let b: byte = 50;
let c: byte = a + b;       // ✅ byte + byte = byte (150)
let d: byte = a + b + 10;  // ✅ byte + byte = byte, then byte + byte(10) = byte
```

This applies to all arithmetic (`+`, `-`, `*`, `/`, `%`) and bitwise (`&`, `|`, `^`, `<<`, `>>`) operators.

### TS-4: Mixed-Width Auto-Promotion (Same Signedness)

When operands have **different widths but the same signedness**, the narrower operand is implicitly widened to match the wider operand:

| Expression | Promotion | Result Type |
|-----------|-----------|-------------|
| `byte OP word` | `byte` → `word` (zero-extend) | `word` |
| `word OP byte` | `byte` → `word` (zero-extend) | `word` |
| `sbyte OP sword` | `sbyte` → `sword` (sign-extend) | `sword` |
| `sword OP sbyte` | `sbyte` → `sword` (sign-extend) | `sword` |

```blend65
let offset: byte = 42;
let base: word = 1000;
let result: word = base + offset;    // ✅ byte auto-promotes to word: 1000 + 42 = 1042

let delta: sbyte = -5;
let position: sword = 300;
let newPos: sword = position + delta; // ✅ sbyte auto-promotes to sword: 300 + (-5) = 295
```

**Why auto-promotion is safe:** Widening never loses data. `byte` 200 → `word` 200. `sbyte` -5 → `sword` -5. The mathematical value is preserved. This is fundamentally different from signed/unsigned mixing, where the same bits have different mathematical meanings.

**6502 cost:** Auto-promotion inserts a zero-extend (byte→word: 2 instructions, ~4 cycles) or sign-extend (sbyte→sword: ~4-6 instructions, ~8-12 cycles) before the operation. This cost is documented in F017.

### TS-5: Mixed-Signedness Is an Error

Mixing signed and unsigned types in the same expression is a compile-time error (established in F010 ST-1):

| Expression | Result |
|-----------|--------|
| `byte OP sbyte` | ❌ E10081 |
| `byte OP sword` | ❌ E10081 |
| `word OP sbyte` | ❌ E10081 |
| `word OP sword` | ❌ E10081 |

```blend65
let pos: byte = 100;
let vel: sbyte = -3;

let result: byte = pos + vel;          // ❌ E10081: cannot mix byte and sbyte
let result: sbyte = sbyte(pos) + vel;  // ✅ explicit cast — sbyte + sbyte = sbyte
let result: byte = pos + byte(vel);    // ✅ explicit cast — byte + byte = byte
```

### TS-6: Boolean Is Not Numeric

`boolean` cannot be used in arithmetic or bitwise expressions. It is a purely logical type.

```blend65
let flag: boolean = true;
let count: byte = 5;

let x: byte = count + flag;     // ❌ E10151: cannot use boolean in arithmetic expression
let y: byte = byte(flag);       // ❌ E10086: cannot cast boolean to byte
let z: boolean = boolean(count); // ❌ E10086: cannot cast byte to boolean
```

**Valid boolean operations** (F013, F017):
- Logical: `&&`, `||`, `!`
- Comparison result: `a == b`, `a < b`, etc. (produces boolean)
- Condition use: `if (boolExpr)`, `while (boolExpr)`

### TS-7: Comparison Operators Produce Boolean

All comparison operators produce `boolean`, regardless of operand types:

```blend65
let a: byte = 100;
let b: byte = 50;
let result: boolean = a > b;     // ✅ boolean

let x: sword = -300;
let y: sword = 100;
let cmp: boolean = x < y;       // ✅ boolean (signed comparison)
```

Comparisons follow the same mixing rules as arithmetic — same-signedness auto-promotes, mixed-signedness is an error:

```blend65
let a: byte = 100;
let b: word = 1000;
let ok: boolean = a < b;        // ✅ byte auto-promotes to word, then word < word

let c: byte = 100;
let d: sbyte = -5;
let bad: boolean = c > d;       // ❌ E10081: cannot mix byte and sbyte in comparison
```

---

## Part 4: Assignment Compatibility

### TS-8: Assignment Type Matching

The right-hand side of an assignment must be compatible with the declared type:

| Assignment | Rule | Result |
|-----------|------|--------|
| Same type | `byte = byte` | ✅ Always OK |
| Implicit widening (same signedness) | `word = byte` | ✅ Auto-widens (F010 ST-2) |
| Implicit narrowing | `byte = word` | ❌ E10082 — use explicit cast |
| Cross-signedness | `sbyte = byte` | ❌ E10080 — use explicit cast |
| Boolean ↔ integer | `byte = boolean` | ❌ E10086 — not convertible |

```blend65
let b: byte = 200;
let w: word = b;           // ✅ implicit widening (zero-extend)
let b2: byte = w;          // ❌ E10082: use byte(w)
let b3: byte = byte(w);   // ✅ explicit narrowing (truncate to low byte)

let sb: sbyte = -5;
let sw: sword = sb;        // ✅ implicit widening (sign-extend)
let sb2: sbyte = sw;       // ❌ E10082: use sbyte(sw)

let b4: byte = sb;         // ❌ E10080: cross-signedness, use byte(sb)
```

### TS-9: Intermediate Overflow — Expression Type from Operands

The type of an expression is determined by its operands, **not** by the destination variable. When a narrow expression is assigned to a wider variable, the expression evaluates at the narrow width first, then widens.

```blend65
let a: byte = 200;
let b: byte = 100;
let result: word = a + b;    // byte + byte = byte → 44 (wraps) → word(44) = 44
                              // ⚠️ W10160: byte + byte may overflow before widening

let c: word = word(a) + word(b);  // word + word = word → 300 (correct)
```

**The rule:** If you want wider arithmetic, cast the operands BEFORE the operation. The compiler warns when a narrow expression is assigned to a wider variable and overflow is possible (W10160/W10161).

**When the warning triggers:** The compiler emits W10160/W10161 when:
1. An arithmetic expression (`+`, `-`, `*`) has narrow operands (byte or sbyte)
2. The result is assigned to a wider type (word or sword)
3. The operation COULD overflow at the narrow width

The warning does NOT trigger for:
- Bitwise operations (no overflow concept)
- Comparisons (result is boolean, not numeric)
- When the narrow expression is provably within range (constant folding)

---

## Part 5: The Complete Type Mixing Matrix

### Arithmetic and Bitwise Operators

| Left \ Right | `byte` | `sbyte` | `word` | `sword` | `boolean` |
|-------------|--------|---------|--------|---------|-----------|
| **`byte`** | `byte` | ❌ E10081 | `word` ↑ | ❌ E10081 | ❌ E10151 |
| **`sbyte`** | ❌ E10081 | `sbyte` | ❌ E10081 | `sword` ↑ | ❌ E10151 |
| **`word`** | `word` ↑ | ❌ E10081 | `word` | ❌ E10081 | ❌ E10151 |
| **`sword`** | ❌ E10081 | `sword` ↑ | ❌ E10081 | `sword` | ❌ E10151 |
| **`boolean`** | ❌ E10151 | ❌ E10151 | ❌ E10151 | ❌ E10151 | ❌ E10151 |

*↑ = narrower operand auto-promotes to match wider operand*

### Comparison Operators (Result is always `boolean`)

| Left \ Right | `byte` | `sbyte` | `word` | `sword` | `boolean` |
|-------------|--------|---------|--------|---------|-----------|
| **`byte`** | ✅ unsigned | ❌ E10081 | ✅ promote | ❌ E10081 | ❌ E10151 |
| **`sbyte`** | ❌ E10081 | ✅ signed | ❌ E10081 | ✅ promote | ❌ E10151 |
| **`word`** | ✅ promote | ❌ E10081 | ✅ unsigned | ❌ E10081 | ❌ E10151 |
| **`sword`** | ❌ E10081 | ✅ promote | ❌ E10081 | ✅ signed | ❌ E10151 |
| **`boolean`** | ❌ E10151 | ❌ E10151 | ❌ E10151 | ❌ E10151 | `==`/`!=` only |

**Note:** `boolean` supports only `==` and `!=` comparisons with other `boolean` values. Ordered comparisons (`<`, `>`, `<=`, `>=`) on `boolean` are an error.

### Assignment Compatibility

| Target \ Source | `byte` | `sbyte` | `word` | `sword` | `boolean` |
|----------------|--------|---------|--------|---------|-----------|
| **`byte`** | ✅ | ❌ E10080 | ❌ E10082 | ❌ E10080 | ❌ E10086 |
| **`sbyte`** | ❌ E10080 | ✅ | ❌ E10080 | ❌ E10082 | ❌ E10086 |
| **`word`** | ✅ widen | ❌ E10080 | ✅ | ❌ E10080 | ❌ E10086 |
| **`sword`** | ❌ E10080 | ✅ widen | ❌ E10080 | ✅ | ❌ E10086 |
| **`boolean`** | ❌ E10086 | ❌ E10086 | ❌ E10086 | ❌ E10086 | ✅ |

---

## Part 6: Explicit Casts

### TS-10: Cast Syntax (from F010 ST-8)

All explicit type conversions use function-call syntax: `typename(expression)`.

```blend65
byte(expr)     // Cast to byte
sbyte(expr)    // Cast to sbyte
word(expr)     // Cast to word
sword(expr)    // Cast to sword
```

**Cast is NOT a function call** — it's a compile-time type conversion that uses function-call syntax for readability. No JSR is generated for same-size casts.

### Cast Behavior

| Cast | Behavior | 6502 Cost |
|------|----------|-----------|
| Same size, same signedness | No-op (identity) | 0 cycles, 0 bytes |
| Same size, cross-signedness | Reinterpret bits | 0 cycles, 0 bytes |
| Widen unsigned (byte→word) | Zero-extend high byte | ~4 cycles, 4 bytes |
| Widen signed (sbyte→sword) | Sign-extend high byte | ~8-12 cycles, 6-8 bytes |
| Narrow (word→byte, sword→sbyte) | Truncate to low byte | 0 cycles (just use low byte) |
| Narrow cross-sign (word→sbyte) | Truncate + reinterpret | 0 cycles |

### TS-11: Cast Restrictions

| Cast | Result |
|------|--------|
| `boolean` → any integer | ❌ E10086 |
| Any integer → `boolean` | ❌ E10086 |
| `void` → anything | ❌ E10152 |
| Anything → `void` | ❌ E10152 |
| Struct → any type | ❌ E10153 |
| Array → any type | ❌ E10153 |

Casts only work between the four integer types (`byte`, `sbyte`, `word`, `sword`).

---

## Part 7: Compound Assignment Type Rules

### TS-12: Compound Assignment

Compound assignment operators (`+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `|=`, `^=`, `<<=`, `>>=`) follow the same type rules as their expanded form:

`x OP= expr` is equivalent to `x = x OP expr`

The right-hand side expression must be compatible with the variable's type after the operation:

```blend65
let score: word = 1000;
let bonus: byte = 50;
score += bonus;              // ✅ word += byte → word + word(auto-promote) = word → assign to word

let vel: sbyte = 5;
vel += 1;                    // ✅ sbyte += sbyte(literal 1) = sbyte

let count: byte = 200;
count += 100;                // ✅ byte += byte(literal 100) = byte → 44 (wraps, no warning — same type)

let pos: byte = 100;
let delta: sbyte = -3;
pos += delta;                // ❌ E10081: cannot mix byte and sbyte
```

---

## Part 8: Constant Expression Evaluation

### TS-13: Compile-Time Constant Expressions

Constant expressions (used in `const` initializers, array sizes, `embed()` offsets, case values) are evaluated at compile time using full-precision arithmetic:

```blend65
const SIZE: word = 40 * 25;           // ✅ Evaluated at compile time: 1000
const HALF: byte = 256 / 2;           // ✅ Evaluated at compile time: 128
const MASK: byte = $FF & $0F;         // ✅ Evaluated at compile time: $0F
const BIG: word = 200 + 100;          // ✅ Evaluated at compile time: 300 (fits in word)
```

**Range validation:** After evaluation, the result must fit in the declared type's range:

```blend65
const TOO_BIG: byte = 200 + 100;     // ❌ E10084: 300 out of range for byte (0..255)
const OK: word = 200 + 100;          // ✅ 300 fits in word
const OVERFLOW: sbyte = 100 + 50;    // ❌ E10084: 150 out of range for sbyte (-128..127)
```

**Constant folding** is mandatory in the compiler — it's a language requirement, not an optimization. Array sizes, `const` values, `case` values, and `embed()` parameters must all be compile-time evaluable.

---

## Part 9: Resolved Ambiguities

### TS-A1: Can `let` declarations omit the type annotation?

**No.** Type annotations are always required on `let` declarations. `let x = 10;` is a compile error (E10150). Rationale: on 6502, the developer must actively decide between `byte` and `word` — this decision directly affects memory usage and performance.

### TS-A2: Can `const` declarations omit the type annotation?

**No.** Type annotations are always required on `const` declarations. `const MAX = 255;` is a compile error (E10150). Rationale: consistency with `let`, and even constants need explicit type information for range validation and expression type propagation.

### TS-A3: Does `byte + byte` produce `word` when assigned to a `word` variable?

**No.** `byte + byte` produces `byte`. If assigned to `word`, the `byte` result is implicitly widened (zero-extended). If the addition overflows at byte width, the wrapped result is widened. The compiler warns (W10160).

### TS-A4: Can a literal in a binary expression adapt to the other operand's type?

**Yes.** Literals in a typed context adapt (F010 ST-4). `let x: sbyte = 5; let y: sbyte = x + 1;` — the literal `1` adapts to `sbyte` because the other operand is `sbyte`. This is NOT type inference — it's literal adaptation, and the declared variable type (`sbyte`) is always explicit.

### TS-A5: What about chained expressions like `a + b + c`?

Left-to-right evaluation with type propagation: `(a + b) + c`. The intermediate result of `a + b` has a type (determined by TS-3/TS-4), and that type is used for the next operation with `c`.

```blend65
let a: byte = 100;
let b: byte = 50;
let c: word = 1000;
let result: word = a + b + c;  // (byte + byte) = byte(150), then byte + word = word (auto-promote) = 1150

let d: word = a + c + b;       // (byte + word) = word(1100), then word + byte = word (auto-promote) = 1150
```

**Note:** `a + b + c` and `a + c + b` may produce different results due to intermediate overflow when `a + b` overflows at byte width!

### TS-A6: How do type aliases interact with type rules?

Type aliases are transparent — they are replaced with their underlying type during semantic analysis:

```blend65
type SpriteId = byte;
type Velocity = sbyte;

let id: SpriteId = 5;
let vel: Velocity = -3;
let result = id + vel;          // ❌ E10081: byte + sbyte (aliases resolved first)
```

### TS-A7: Can you cast between enum and integer types?

Enums are `byte`-backed. Implicit conversion enum→byte is allowed; byte→enum is not (prevents invalid enum values). This will be fully specified when the enum feature is formalized.

### TS-A8: What type does `sizeof()` return?

`sizeof()` returns `byte` for types with size ≤ 255 bytes, `word` for larger types. In practice, all primitive types and most structs fit in `byte`. Large arrays may require `word`.

---

## Part 10: Error Codes

| Code | Message | Trigger |
|------|---------|---------|
| E10150 | Type annotation required — use `let <name>: <type> = <expr>` | Declaration without type annotation |
| E10151 | Cannot use `boolean` in arithmetic/bitwise expression — boolean is a logical type, not numeric | Boolean operand in `+`, `-`, `*`, etc. |
| E10152 | Cannot cast to or from `void` | `void(expr)` or cast to void |
| E10153 | Cannot cast struct or array types — only integer types (`byte`, `sbyte`, `word`, `sword`) support casts | `byte(myStruct)` or `byte(myArray)` |

**Existing error codes that enforce type system rules:**

| Code | Source | Rule Enforced |
|------|--------|--------------|
| E10080 | F010 | Cross-signedness implicit conversion |
| E10081 | F010 | Mixed signed/unsigned in expression |
| E10082 | F010 | Implicit narrowing |
| E10083 | F010 | Negate unsigned type |
| E10084 | F010 | Value out of range for type |
| E10085 | F010 | Signed array index |
| E10086 | F010 | Boolean ↔ integer cast |
| E10100 | F013 | Non-boolean condition |

### Warning Codes

| Code | Message | Trigger |
|------|---------|---------|
| W10160 | `<narrow_type>` arithmetic may overflow before widening to `<wide_type>` — use `<wide_type>(a) <op> <wide_type>(b)` for wider arithmetic | byte/sbyte expression assigned to word/sword |
| W10161 | Constant expression overflow — `<expr>` wraps to `<value>` at `<type>` width before widening | Same as W10160 but detected at compile time with known values |

---

## Part 11: Feature Interactions

| Feature | Interaction |
|---------|-------------|
| F003 Module contents | Module-level `let` and `const` follow TS-1 (mandatory annotations), TS-8 (assignment rules) |
| F005 Memory placement | Zeropage declarations use `name: type` syntax — type is always explicit |
| F008 For loop | Loop variable type is explicit: `for i: byte = 0 to 10`. Loop bounds must match variable type or be promotable (TS-4) |
| F009 Switch | Switch expression and case values follow type mixing rules. Case values must match expression type (E10072) |
| F010 Signed types | TS-3 through TS-5 formalize and generalize F010's ST-1 (no mixing) and ST-2 (implicit widening) |
| F011 Structs | Struct field access produces the field's declared type. Struct types are not castable (TS-11) |
| F013 Control flow | Conditions must be boolean (CF-2 / E10100). TS-6 reinforces this |
| F014 Arrays | Array element access produces the element type. Array index must be unsigned (E10085). Array size inference is allowed (not type inference) |
| F015 Data inclusion | `embed()` selectors have declared return types. Type validation per E10144 |
| F017 Operators | All operator result types follow TS-3 through TS-7. Operator-specific rules in F017 |

---

## Part 12: Examples

### Example 1: Explicit Typing in Game Physics

```blend65
module physics;

zeropage {
    playerX: word;
    playerY: word;
    velX: sbyte;
    velY: sbyte;
}

const GRAVITY: sbyte = 1;
const MAX_FALL_SPEED: sbyte = 8;
const GROUND_Y: word = 180;

function applyPhysics(): void {
    // Signed addition — sbyte + sbyte = sbyte
    if (velY < MAX_FALL_SPEED) {
        velY = velY + GRAVITY;
    }

    // Mixed-width: word + sbyte requires explicit handling
    // sbyte velocity added to word position
    let newY: sword = sword(playerY) + sword(velX);
    if (newY >= 0 && newY < 200) {
        playerY = word(newY);
    }

    // Auto-promote example: byte offset + word base
    let screenX: byte = byte(playerX / 8);     // word / byte(8) = word, then narrow to byte
}
```

### Example 2: The Overflow Trap — and How to Avoid It

```blend65
module demo;

function overflowDemo(): void {
    let a: byte = 200;
    let b: byte = 100;

    // ⚠️ W10160: byte + byte may overflow before widening to word
    let wrong: word = a + b;         // 200 + 100 = 44 (wraps at byte), then word(44) = 44

    // ✅ Correct: widen BEFORE arithmetic
    let right: word = word(a) + word(b);  // word(200) + word(100) = 300

    // ✅ Also correct: auto-promotion with one word operand
    let alsoRight: word = word(a) + b;    // word(200) + word(b via auto-promote) = 300
}
```

### Example 3: The Type Matrix in Action

```blend65
module types;

function mixing(): void {
    let ub: byte = 200;
    let uw: word = 1000;
    let sb: sbyte = -5;
    let sw: sword = -300;
    let flag: boolean = true;

    // Same type — always OK
    let r1: byte = ub + 50;          // ✅ byte + byte = byte
    let r2: word = uw + 100;         // ✅ word + word = word
    let r3: sbyte = sb + 1;          // ✅ sbyte + sbyte = sbyte
    let r4: sword = sw + 100;        // ✅ sword + sword = sword

    // Auto-promote (same signedness, different width) — OK
    let r5: word = uw + ub;          // ✅ word + byte → word + word = word
    let r6: sword = sw + sb;         // ✅ sword + sbyte → sword + sword = sword

    // Mixed signedness — ERROR
    // let r7 = ub + sb;             // ❌ E10081: byte + sbyte
    // let r8 = uw + sw;             // ❌ E10081: word + sword
    // let r9 = ub + sw;             // ❌ E10081: byte + sword

    // Boolean — not numeric
    // let r10 = ub + flag;          // ❌ E10151: boolean in arithmetic
    // let r11: byte = byte(flag);   // ❌ E10086: cannot cast boolean

    // Fix mixed signedness with explicit cast
    let r12: sbyte = sbyte(ub) + sb;  // ✅ sbyte + sbyte = sbyte
    let r13: byte = ub + byte(sb);    // ✅ byte + byte = byte
}
```

### Edge Case: Chained Expression Order Matters

```blend65
module edge;

function chainOrder(): void {
    let a: byte = 200;
    let b: byte = 100;
    let c: word = 1000;

    // Left-to-right: (200 + 100) wraps to 44 at byte, then 44 + 1000 = 1044
    let r1: word = a + b + c;    // 1044 (⚠️ W10160 on a + b)

    // Left-to-right: (200 + 1000) = 1200 at word (auto-promote), then 1200 + 100 = 1300
    let r2: word = a + c + b;    // 1300 (no warning — a promotes to word immediately)

    // If you want guaranteed correctness: cast first
    let r3: word = word(a) + word(b) + c;  // 200 + 100 + 1000 = 1300 (all at word width)
}
```

---

## Part 13: Language Guard Evaluation

| Rule | Status | Notes |
|------|--------|-------|
| **P1** Cross-platform compilable | ✅ | Type system is identical on all platforms — types map to the same 6502 storage everywhere |
| **P2** Platform-meaningful | ✅ | Explicit typing is essential on all platforms — especially the most constrained (7800: 4KB RAM) |
| **P3** No platform assumptions | ✅ | No platform-specific types or rules. All six types are universal |
| **P4** Resource-scalable | ✅ | Choosing `byte` vs `word` is the primary way developers manage RAM on constrained platforms |
| **H1** 6502 implementable | ✅ | All types map directly to 6502 storage. Auto-promotion uses standard zero-extend/sign-extend sequences |
| **H2** Cost transparency | ✅ | Auto-promotion cost is documented (4-12 cycles). Overflow warning helps developers understand expression evaluation |
| **H3** SFA compatible | ✅ | Type annotations enable precise SFA frame sizing — each variable's size is known at compile time |
| **H4** Memory footprint documented | ✅ | Type sizes are fixed: byte/sbyte=1, word/sword=2, boolean=1. Frame sizes are fully predictable |
| **H5** Fully deterministic | ✅ | Every type combination produces either a defined result or a compile error. No undefined behavior. Overflow wraps deterministically |
| **L1** Unambiguous syntax | ✅ | `name: type` is unambiguous. `typename(expr)` cast is unambiguous. No inference = no ambiguity |
| **L2** Consistent with existing | ✅ | Follows F010's signed type rules. Extends them to a complete system with consistent matrices |
| **L3** Beginner-friendly | ✅ | C/TypeScript developers understand explicit typing. The mixing matrix is intuitive: same sign = OK, different sign = error |
| **L4** Minimal feature | ✅ | Six types, one auto-promotion rule, one mixing prohibition. No promotion hierarchy, no implicit conversions between signedness |
| **L5** No redundancy | ✅ | Consolidates scattered type rules from F010, F013, F014 into one canonical document |
| **L6** Error messages defined | ✅ | 4 new error codes (E10150-E10153), 2 new warnings (W10160-W10161), plus all existing type errors from F010/F013 |
| **L7** Compile-time failure preferred | ✅ | All type errors are compile-time. The only runtime behavior is wrapping overflow (deterministic, per H5) |
| **L8** Feature interactions documented | ✅ | Part 11: interactions with all relevant features |
| **L9** Documentable with examples | ✅ | Part 12: four examples covering physics, overflow, mixing matrix, chain order |
| **C1** Lexer/parser implementable | ✅ | No new syntax — uses existing `name: type` and `typename(expr)` patterns |
| **C2** Semantic analysis defined | ✅ | Complete type checking rules for all binary operations, assignments, and casts. Matrices cover every combination |
| **C3** Code generation strategy | ✅ | Auto-promotion = zero-extend or sign-extend (documented in F010). All other operations use existing codegen |
| **C4** Unit testable | ✅ | Every cell in the type matrices is independently testable. Each error code has a triggering pattern |
| **C5** Runtime verifiable | ✅ | Expression results are deterministic. Emulator can verify: `200 + 100` as bytes = 44, as words = 300 |
| **F1** Extensible | ✅ | Additional types (int24, int32) could be added without changing existing rules. Auto-promotion extends naturally |
| **F2** Platform-profile ready | ✅ | No platform-specific type behavior |
| **F3** Optimizer-friendly | ✅ | Explicit types enable type-aware optimizations. No inference means no type deduction overhead |
| **F4** Stability classification | ✅ | **Stable** — six types and their interaction rules are fundamental and will not change |

**Verdict: ✅ ACCEPTED — all 23 rules pass**
