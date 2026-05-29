# Chapter 09 — Enums

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F022

---

## 1. Overview

An enum defines a **named set of byte-sized constants** under a single named type. Enums make code self-documenting: instead of passing a bare `byte` whose meaning a reader must guess, you pass a `Direction` or a `GameState` whose valid values are listed in one place.

Under SFA, an enum has **zero runtime cost** — each member is a compile-time `byte` constant, and an enum-typed variable occupies exactly one byte of storage. The enum type exists only in the compiler's type checker; the generated machine code is identical to hand-written byte code.

```blend65
enum Direction {
    UP,      // 0
    DOWN,    // 1
    LEFT,    // 2
    RIGHT    // 3
}

let facing: Direction = Direction.UP;
```

Key design principles:
- **Byte-backed only** — every enum is represented as a `byte` (values 0–255)
- **Nominal type** — `Direction` is a distinct type, not an alias for `byte`
- **Asymmetric conversion** — enum → byte is implicit (safe widening); byte → enum requires explicit `EnumName(expr)` cast (unsafe narrowing)
- **Zero overhead** — members are compile-time constants; no runtime tables, no storage beyond the one byte
- **Scoped access** — members are always `EnumName.MEMBER`; names do not leak into the enclosing scope

---

## 2. Enum Declaration

### 2.1 Syntax

```ebnf
enum_decl    = [ "export" ] , "enum" , identifier
             , "{" , enum_member , { "," , enum_member } , [ "," ] , "}" ;

enum_member  = identifier , [ "=" , const_expression ] ;
```

- `const_expression` must evaluate to a compile-time `byte` value (0–255).
- A trailing comma after the last member is permitted.
- At least one member is required (EN-7).

```blend65
enum Direction {
    UP,
    DOWN,
    LEFT,
    RIGHT
}

enum Color {
    BLACK = 0,
    WHITE = 1,
    RED   = 2,
    CYAN,           // 3 (auto)
    PURPLE,         // 4
    GREEN = 5,
    BLUE,           // 6
    YELLOW          // 7
}
```

### 2.2 Member Access

```ebnf
enum_access = identifier , "." , identifier ;
```

Members are always referenced as `EnumName.MEMBER`:

```blend65
Direction.UP
GameState.PLAYING
Color.RED
```

Member access reuses the existing `.` (DOT) token (→ Ch 01). It is resolved at compile time to the member's byte value.

### 2.3 Using Enums as Types

The enum name is used directly as a type annotation anywhere a type is expected:

```blend65
let facing: Direction = Direction.UP;          // variable
function move(d: Direction): void { }          // parameter
function whichWay(): Direction { }             // return type
struct Player { dir: Direction; }              // struct field (→ Ch 07)
let path: Direction[8];                        // array element type (→ Ch 08)
```

### 2.4 Export Visibility

`export enum` makes the type and **all** its members available to other modules (→ Ch 10). Members cannot be exported individually. A non-exported enum is private to its module.

```blend65
export enum GameState { MENU, PLAYING, PAUSED, GAME_OVER }
```

---

## 3. Enum Rules

### EN-1 — Byte-Backed Representation

Every enum is represented as a single `byte`. All member values must lie in the range **0–255**. The enum type's size is always `sizeof(EnumName) == 1`.

### EN-2 — Auto-Numbering

A member without an explicit value takes the value of **the previous member + 1**. The first member, if it has no explicit value, is **0**.

```blend65
enum E { A, B, C }          // A=0, B=1, C=2
enum F { A = 10, B, C }     // A=10, B=11, C=12
```

### EN-3 — Explicit Values

A member may be assigned an explicit compile-time `byte` constant with `= const_expression`. Subsequent auto-numbered members continue from that value + 1.

```blend65
enum Color {
    BLACK = 0,
    WHITE = 1,
    RED   = 2,
    CYAN,           // 3 (auto, continues from RED + 1)
    PURPLE,         // 4
    GREEN = 5,
    BLUE,           // 6
    YELLOW          // 7
}
```

### EN-4 — Member Names Must Be Unique

Two members of the same enum may not share a name. Duplicate member name → E10232.

### EN-5 — Duplicate Values Allowed

Two members **may** share the same value (intentional aliases). This is legal and produces no error or warning.

```blend65
enum Status {
    OK    = 0,
    READY = 0,      // alias for OK — legal
    BUSY  = 1
}
```

### EN-6 — Value Range 0–255

An explicit member value outside 0–255 → E10233. Auto-numbering that would advance past 255 → E10233.

```blend65
enum Bad { X = 300 }        // ❌ E10233
enum Wrap { A = 255, B }    // ❌ E10233 — B would be 256
```

### EN-7 — Non-Empty Requirement

An enum must declare at least one member. Empty enum → E10234.

```blend65
enum Empty { }              // ❌ E10234
```

### EN-8 — Nominal Typing

An enum is a **distinct type**. An enum-typed value and a `byte` (or another enum) are not interchangeable except through the conversion rules in EN-9 and EN-10. Assigning a bare `byte` to an enum-typed target without a cast → E10235.

```blend65
let d: Direction = Direction.UP;    // ✅
let d: Direction = 0;               // ❌ E10235 — byte is not a Direction
let d: Direction = someByte;        // ❌ E10235
let d: Direction = GameState.MENU;  // ❌ E10235 — different enum type
```

### EN-9 — Implicit Enum → Byte (Widening)

An enum value is implicitly usable wherever a `byte` is expected: assignment to a `byte` target, `byte` function arguments, `poke`, arithmetic, and comparison against `byte`. No cast is required.

```blend65
let dir: Direction = Direction.UP;
let n: byte = dir;                  // ✅ implicit enum → byte
poke($D000, dir);                   // ✅ poke expects byte; enum widens
let sum: byte = dir + 1;            // ✅ arithmetic on the byte representation
```

Enum → `byte` is the only implicit conversion. An enum does **not** implicitly convert to `word`/`sword`; widen the resulting `byte` per the type rules (→ Ch 02) if a wider type is needed: `word(dir)`.

### EN-10 — Explicit Byte → Enum (Narrowing)

A `byte` value becomes an enum value only through an explicit `EnumName(expr)` cast. The cast is **compile-time-only** (zero runtime cost) — it reinterprets the byte as the enum type. The resulting value is taken **as-is**; it is **not** range-checked against the declared members.

```blend65
let dir: Direction = Direction(peek($D000));   // ✅ explicit narrowing
let dir: Direction = Direction(rawByte);       // ✅
let dir: Direction = Direction(99);            // ✅ defined: holds 99, even
                                                //    though no member equals 99
```

**Defined behavior (Axiom A3):** `EnumName(b)` always produces an enum value equal to `b`. If `b` matches no declared member, the value is still well-defined — it simply has no member name. There is no runtime trap. The programmer asserts validity by writing the cast.

### EN-11 — Comparison

Enum values may be compared with `==` and `!=` against the same enum type or against a `byte` (the enum widens per EN-9). Ordered comparisons (`<`, `>`, `<=`, `>=`) operate on the underlying byte value and are permitted.

```blend65
if (dir == Direction.UP) { }       // ✅ same enum type
if (dir != Direction.DOWN) { }     // ✅
if (dir == 0) { }                   // ✅ enum widens to byte
if (priority > Level.LOW) { }       // ✅ ordered, on byte value
```

Comparing two **different** enum types directly → E10236. Cast one to `byte` first if a cross-type comparison is genuinely intended.

### EN-12 — Scoped Member Access

Members are accessed exclusively as `EnumName.MEMBER`. Bare `UP` (without the enum qualifier) does not resolve to `Direction.UP`. This keeps the module namespace clean and avoids collisions between enums that share member names.

### EN-13 — Module Visibility

An enum may be declared `export` (→ Ch 10). Exporting an enum exports the type and **all** its members together; members cannot be exported individually.

---

## 4. Conversion Summary

The asymmetric conversion model integrated into the type system (→ Ch 02):

| Direction | Conversion | Syntax | Cost |
|-----------|-----------|--------|------|
| Enum → `byte` | Implicit widening (EN-9) | `let b: byte = dir;` | 0 cycles |
| `byte` → Enum | Explicit cast (EN-10) | `let d: Direction = Direction(b);` | 0 cycles |
| Enum → `word` | Via byte: `word(dir)` | Two-step widening | 0 cycles (compile-time) |
| Enum A → Enum B | Not allowed directly | Cast to `byte` first | E10235 |

---

## 5. Code Generation

Enums generate **no code and no data** on their own. They exist purely in the type checker. Every use lowers to the equivalent `byte` operation:

| Source | Lowered Form | 6502 Pattern |
|--------|--------------|--------------|
| `Direction.UP` | byte constant `0` | immediate `#$00` |
| `let d: Direction = Direction.UP;` | `let d: byte = 0;` | `LDA #$00 / STA d` |
| `d == Direction.LEFT` | `d == 2` | `LDA d / CMP #$02 / BEQ ...` |
| `poke($D000, d)` | `poke($D000, d)` (d is byte) | `LDA d / STA $D000` |
| `Direction(peek($D000))` | `peek($D000)` (reinterpreted) | `LDA $D000 / STA d` — no extra code |
| `switch (d) { case Direction.UP: ... }` | switch on byte value `0` | compare chain / jump table (→ Ch 05) |

**Casts are free**: both `byte(enumValue)` and `EnumName(byteValue)` emit zero instructions — they only change the compile-time type.

---

## 6. Cost Summary

| Resource | Cost |
|----------|------|
| RAM | 1 byte per enum-typed variable (same as `byte`). Declarations: 0 bytes. |
| ROM / binary | 0 bytes for the declaration. Uses are identical to `byte` code. |
| Zero page | Only if placed in zeropage (1 byte, same as `byte`). |
| CPU cycles | Identical to `byte` operations. Casts: 0 cycles. |

---

## 7. Error Codes

All error codes defined in this chapter. The canonical registry is in → Ch 14.

| Code | Condition | Message |
|------|-----------|---------|
| E10230 | Non-constant member value | `Enum member value must be a compile-time byte constant — found '<expr>'` |
| E10231 | Unknown enum reference | `Enum member '<member>' references an unknown enum '<name>' — did you mean '<suggestion>'?` |
| E10232 | Duplicate member name | `Duplicate enum member name '<member>' in enum '<name>'` |
| E10233 | Value out of range | `Enum member value '<value>' out of range — enum members must be 0–255 (enums are byte-backed)` |
| E10234 | Empty enum | `Empty enum '<name>' — an enum must declare at least one member` |
| E10235 | Type mismatch (byte→enum) | `Cannot assign '<type>' to enum '<name>' — use an explicit cast '<name>(<expr>)' to convert a byte to this enum` |
| E10236 | Cross-enum comparison | `Cannot compare enum '<a>' with enum '<b>' — different enum types. Cast one to byte to compare underlying values` |

---

## 8. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Type system** (→ Ch 02) | Enums are a derived type with nominal typing. Enum→byte is an implicit widening; byte→enum is an explicit cast. Cast syntax (`EnumName(expr)`) follows the same mechanism as `byte(expr)`/`word(expr)`. |
| **Variables** (→ Ch 03) | Enum-typed `let`/`const` variables occupy 1 byte. A `const` enum value is an inlined byte constant. |
| **Operators** (→ Ch 04) | Arithmetic/bitwise operators force enum→byte (EN-9); the result is `byte`, not the enum type. `==`/`!=` work within same enum type or against byte. Ordered comparisons operate on byte value. |
| **Statements** (→ Ch 05) | Enums are a valid switch expression type. `case EnumName.MEMBER:` is the idiomatic form. No mandatory exhaustiveness in v3. |
| **Functions** (→ Ch 06) | Enum types valid as parameter and return types. Passing a bare byte to an enum parameter → E10235; returning an enum where byte expected widens implicitly. |
| **Structs** (→ Ch 07) | Enum fields in structs: `dir: Direction;` occupies 1 byte. Struct literals use member access: `{ dir: Direction.UP }`. |
| **Arrays** (→ Ch 08) | Enum arrays: `Direction[8]` — each element 1 byte. Array initializers use member access. |
| **Modules** (→ Ch 10) | `export enum` exports type + all members. Non-exported enums are module-private. |
| **Memory intrinsics** (→ Ch 04, §9) | `peek()` returns `byte`; storing into enum requires `EnumName(peek(...))`. `poke()` accepts enum (implicit widening). `sizeof(EnumName) == 1`. |

---

## 9. Examples

### 9.1 Basic Enum (Common Case)

```blend65
module Game;

enum Direction {
    UP,      // 0
    DOWN,    // 1
    LEFT,    // 2
    RIGHT    // 3
}

function step(d: Direction): void {
    switch (d) {
        case Direction.UP:    moveUp();
        case Direction.DOWN:  moveDown();
        case Direction.LEFT:  moveLeft();
        case Direction.RIGHT: moveRight();
    }
}

function main(): void {
    step(Direction.UP);
}
```

### 9.2 Game State Machine

```blend65
module StateMachine;

export enum GameState {
    MENU      = 0,
    PLAYING   = 1,
    PAUSED    = 2,
    GAME_OVER = 3
}

let state: GameState = GameState.MENU;

function update(): void {
    switch (state) {
        case GameState.MENU:
            if (startPressed()) {
                state = GameState.PLAYING;
            }
        case GameState.PLAYING:
            tickGame();
            if (playerDied()) {
                state = GameState.GAME_OVER;
            }
        case GameState.PAUSED:
            if (resumePressed()) {
                state = GameState.PLAYING;
            }
        case GameState.GAME_OVER:
            showScore();
    }
}
```

### 9.3 Hardware Boundary — Reading and Writing Bytes

```blend65
module Sprites;

enum SpriteColor {
    BLACK  = 0,
    WHITE  = 1,
    RED    = 2,
    CYAN   = 3,
    PURPLE = 4
}

const COLOR_REGISTER: word = $D027;

function readColor(): SpriteColor {
    // peek() returns byte → explicit narrowing into enum
    return SpriteColor(peek(COLOR_REGISTER));
}

function writeColor(c: SpriteColor): void {
    // poke() expects byte → enum widens implicitly
    poke(COLOR_REGISTER, c);
}

function main(): void {
    writeColor(SpriteColor.PURPLE);
    let current: SpriteColor = readColor();
}
```

### 9.4 Edge Cases — Aliases, Mixed Numbering

```blend65
module EdgeCases;

// Duplicate VALUES are allowed (intentional aliases) — EN-5
enum Status {
    OK    = 0,
    READY = 0,      // alias for OK — legal
    BUSY  = 1
}

function demo(): void {
    // Cast of a byte that matches no member is DEFINED (EN-10)
    let mystery: Direction = Direction(99);   // holds 99, no member name
    let n: byte = mystery;                     // implicit enum → byte → 99
}
```
