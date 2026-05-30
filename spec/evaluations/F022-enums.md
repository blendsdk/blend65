# F022 — Enums

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F003 (module contents & visibility), F016 (type system rules), F021 (lexical structure)  
> **Interacts with**: F009 (switch statement), F011 (structs), F014 (arrays), F017 (operators), F018 (functions), F019 (variables), F020 (memory intrinsics)

---

## Description

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

**Key design principles:**
- **Byte-backed only** — every enum is represented as a `byte` (values 0–255). No word-backed enums in v3.
- **Nominal type** — `Direction` is a distinct type, not an alias for `byte`. A function declared `move(d: Direction)` will not accept a bare `byte`.
- **Asymmetric conversion (enum *is-a* byte)** — an enum value converts *to* `byte` implicitly (widening to its representation is always safe), but a `byte` converts *to* an enum only through an explicit `EnumName(expr)` cast (narrowing an arbitrary byte into a named set is the programmer's assertion).
- **Zero overhead** — members are compile-time constants; no runtime tables, no storage beyond the one byte the value occupies.
- **Scoped access** — members are always referenced as `EnumName.MEMBER`; member names do not leak into the enclosing scope.

---

## Syntax

### Declaration

```blend65
enum Name {
    MEMBER_A,
    MEMBER_B = 5,
    MEMBER_C
}
```

**EBNF:**
```ebnf
enum_decl    = [ "export" ] , "enum" , identifier , "{" , enum_member , { "," , enum_member } , [ "," ] , "}" ;
enum_member  = identifier , [ "=" , const_expression ] ;
```

- `const_expression` must evaluate to a compile-time `byte` value (0–255).
- A trailing comma after the last member is permitted.
- At least one member is required (empty enums are an error — see EN-7).

### Member access

```blend65
Direction.UP
GameState.PLAYING
```

**EBNF:**
```ebnf
enum_access = identifier , "." , identifier ;
```

Member access reuses the existing `.` (DOT) token (F021). It is resolved at compile time to the member's byte value.

### Using an enum type

The enum name is used directly as a type annotation anywhere a type is expected:

```blend65
let facing: Direction = Direction.UP;          // variable
function move(d: Direction): void { ... }       // parameter
function whichWay(): Direction { ... }           // return type
struct Player { dir: Direction; }                // struct field
let path: Direction[8];                          // array element type
```

---

## Rules

### EN-1 — Byte-backed representation
Every enum is represented as a single `byte`. All member values must lie in the range **0–255**. The enum type's size is always `sizeof(EnumName) == 1`.

### EN-2 — Auto-numbering
A member without an explicit value takes the value of **the previous member + 1**. The first member, if it has no explicit value, is **0**.

```blend65
enum E { A, B, C }          // A=0, B=1, C=2
enum F { A = 10, B, C }     // A=10, B=11, C=12
```

### EN-3 — Explicit values
A member may be assigned an explicit compile-time `byte` constant with `= const_expression`. Subsequent auto-numbered members continue from that value + 1.

```blend65
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

### EN-4 — Member names must be unique
Two members of the same enum may not share a name. Duplicate member names are a compile error (E10232).

### EN-5 — Duplicate values are allowed
Two members **may** share the same value (intentional aliases). This is legal and produces no error or warning.

```blend65
enum Status {
    OK    = 0,
    READY = 0,      // alias for OK — legal
    BUSY  = 1
}
```

### EN-6 — Value range 0–255
An explicit member value outside 0–255 is a compile error (E10233). Auto-numbering that would advance past 255 is also an error (E10233).

```blend65
enum Bad { X = 300 }        // E10233
enum Wrap { A = 255, B }    // E10233 — B would be 256
```

### EN-7 — Non-empty requirement
An enum must declare at least one member. An empty enum is a compile error (E10234).

```blend65
enum Empty { }              // E10234
```

### EN-8 — Nominal typing
An enum is a **distinct type**. An enum-typed value and a `byte` (or another enum) are not interchangeable except through the conversion rules in EN-9 and EN-10. Assigning a bare `byte` (or a different enum type) to an enum-typed target without a cast is a compile error (E10235).

```blend65
let d: Direction = Direction.UP;    // ✅
let d: Direction = 0;               // ❌ E10235 — byte literal is not a Direction
let d: Direction = someByte;        // ❌ E10235
let d: Direction = GameState.MENU;  // ❌ E10235 — different enum type
```

### EN-9 — Implicit enum → byte (widening)
An enum value is implicitly usable wherever a `byte` is expected: assignment to a `byte` target, `byte` function arguments, `poke`, arithmetic, and comparison against `byte`. No cast is required.

```blend65
let dir: Direction = Direction.UP;
let n: byte = dir;                  // ✅ implicit enum → byte
poke($D000, dir);                   // ✅ poke expects byte; enum widens
let sum: byte = dir + 1;            // ✅ arithmetic on the byte representation
```

> Enum → `byte` is the only implicit conversion. An enum does **not** implicitly convert to `word`/`sword`; widen the resulting `byte` per F016 if a wider type is needed (e.g., `word(dir)`).

### EN-10 — Explicit byte → enum (narrowing)
A `byte` value becomes an enum value only through an explicit `EnumName(expr)` cast. The cast is **compile-time-only** (zero runtime cost) — it reinterprets the byte as the enum type. The resulting value is taken **as-is**; it is **not** range-checked against the declared members.

```blend65
let dir: Direction = Direction(peek($D000));   // ✅ explicit narrowing
let dir: Direction = Direction(rawByte);       // ✅
let dir: Direction = Direction(99);            // ✅ defined: dir holds 99, even
                                                //    though no member equals 99
```

> **Defined behavior (H5):** `EnumName(b)` always produces an enum value equal to `b`. If `b` matches no declared member, the value is still well-defined (it equals `b`); it simply has no member name. There is no runtime trap. The programmer asserts validity by writing the cast.

### EN-11 — Comparison
Enum values may be compared with `==` and `!=` against the same enum type or against a `byte` (the enum widens per EN-9). Ordered comparisons (`<`, `>`, `<=`, `>=`) operate on the underlying byte value and are permitted.

```blend65
if (dir == Direction.UP) { ... }       // ✅ same enum type
if (dir != Direction.DOWN) { ... }     // ✅
if (dir == 0) { ... }                   // ✅ enum widens to byte
if (priority > Level.LOW) { ... }       // ✅ ordered, on byte value
```

Comparing two **different** enum types directly is a compile error (E10236); cast one to `byte` first if a cross-type comparison is genuinely intended.

### EN-12 — Scoped member access
Members are accessed exclusively as `EnumName.MEMBER`. Bare `UP` (without the enum qualifier) does not resolve to `Direction.UP`. This keeps the module namespace clean and avoids collisions between enums that share member names.

### EN-13 — Module visibility
An enum may be declared `export` (F003). Exporting an enum exports the type and **all** its members together; members cannot be exported individually. A non-exported enum is private to its module.

```blend65
export enum GameState { MENU, PLAYING, PAUSED, GAME_OVER }
```

---

## Code Generation

Enums generate **no code and no data** on their own. They exist purely in the type checker. Every use lowers to the equivalent `byte` operation:

| Source | Lowered form | 6502 pattern |
|--------|--------------|--------------|
| `Direction.UP` | byte constant `0` | immediate `#$00` |
| `let d: Direction = Direction.UP;` | `let d: byte = 0;` | `LDA #$00 / STA d` |
| `d == Direction.LEFT` | `d == 2` | `LDA d / CMP #$02 / BEQ ...` |
| `poke($D000, d)` | `poke($D000, d)` (d is a byte) | `LDA d / STA $D000` |
| `Direction(peek($D000))` | `peek($D000)` (reinterpreted) | `LDA $D000 / STA d` — no extra code |
| `switch (d) { case Direction.UP: ... }` | `switch` on byte value `0` | standard F009 compare chain / jump table |

**Casts are free:** both `byte(enumValue)` and `EnumName(byteValue)` emit zero instructions — they only change the compile-time type. The byte already lives in the right place.

---

## Cost

| Resource | Cost |
|----------|------|
| RAM | 1 byte per enum-typed variable (same as `byte`). Enum declarations themselves consume 0 bytes. |
| ROM / binary | 0 bytes for the declaration. Uses are identical in size to the equivalent `byte` code. |
| Zero page | Only if an enum-typed variable is placed in zero page (1 byte, same as `byte`). |
| CPU cycles | Identical to `byte` operations. Casts add 0 cycles. |

Enums are a **pure compile-time abstraction** — they cost exactly what the underlying byte costs and nothing more (H2, H4).

---

## Ambiguities Resolved

### EN-A1 — `EnumName(expr)` cast vs function call
`Direction(x)` uses the same `identifier ( expr )` syntax as a function call. **Resolution:** the parser produces a generic call-expression node; the semantic analyzer resolves the identifier. If it names an enum type, the node is a byte→enum cast (EN-10); if it names a function, it is a call (F018); otherwise E10175 (not a function) or E10235. This mirrors how `byte(x)`/`word(x)` type casts already resolve in F016 — enum casts are the same mechanism extended to enum type names.

### EN-A2 — `EnumName.MEMBER` vs struct field / module access
The `.` token is used for struct field access (F011) and could appear after any identifier. **Resolution:** resolution is by the left operand's meaning. If the left identifier names an enum **type**, the `.` is enum member access (compile-time constant). If it names a struct **variable**, it is field access. An enum type name can never be a value, so there is no overlap.

### EN-A3 — Implicit enum → byte vs nominal strictness
EN-8 forbids implicit byte→enum, but EN-9 allows implicit enum→byte. This is intentional asymmetry, not a contradiction: widening an enum to its own representation is always safe and lossless, whereas narrowing an arbitrary byte into a named set is the unsafe direction that must be marked. (Models classic C enum behavior; see Language Guard L3.)

### EN-A4 — Auto-numbering after an explicit value
After `A = 10`, the next auto member is `11`, not `1`. Auto-numbering always continues from the **most recent member's value + 1**, whether that value was explicit or auto (EN-2, EN-3).

### EN-A5 — Trailing comma
`enum E { A, B, }` is legal (trailing comma permitted by the grammar). `enum E { , A }` (leading comma) and `enum E { A,, B }` (empty member) are syntax errors.

---

## Error Codes

| Code | Message |
|------|---------|
| E10230 | Enum member value must be a compile-time `byte` constant — found `<expr>` |
| E10231 | Enum member `<member>` references an unknown enum `<name>` — did you mean `<suggestion>`? |
| E10232 | Duplicate enum member name `<member>` in enum `<name>` |
| E10233 | Enum member value `<value>` out of range — enum members must be 0–255 (enums are byte-backed) |
| E10234 | Empty enum `<name>` — an enum must declare at least one member |
| E10235 | Cannot assign `<type>` to enum `<name>` — use an explicit cast `<name>(<expr>)` to convert a byte to this enum |
| E10236 | Cannot compare enum `<a>` with enum `<b>` — different enum types. Cast one to `byte` to compare underlying values |

---

## Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **F003 Module contents & visibility** | Enums are module-level declarations; may be `export`ed. Exporting an enum exports the type and all members (EN-13). |
| **F009 Switch statement** | Enums are a valid switch expression type (F009 SW-10). `case Direction.UP:` is the idiomatic form. Case values may be enum members or byte literals (which widen). No mandatory exhaustiveness in v3 — exhaustiveness checking is a future addition (see future-considerations.md). |
| **F011 Structs** | An enum may be a struct field type (`dir: Direction;`). The field occupies 1 byte. Struct literals use member access: `{ dir: Direction.UP }`. |
| **F014 Arrays** | Enums may be array element types (`let path: Direction[8];`). Each element is 1 byte. Array initializers use member access. |
| **F016 Type system** | Enum→byte is an implicit widening conversion (EN-9), added to F016's conversion model. Byte→enum is an explicit cast using the same cast syntax as `byte()`/`word()`. Enums are nominal — unlike the transparent type aliases that were evaluated and rejected (REJ-001). |
| **F017 Operators** | Arithmetic/bitwise operators force enum→byte (EN-9); the result is `byte`, not the enum type. `==`/`!=` work within an enum type or against byte; ordered comparisons operate on the byte value (EN-11). |
| **F018 Functions** | Enum types are valid parameter and return types. Passing a bare byte to an enum parameter requires `EnumName(...)` (E10235); returning an enum where a byte is expected widens implicitly. |
| **F019 Variables & constants** | Enum-typed `let`/`const` variables occupy 1 byte. A `const` enum value is an inlined byte constant. |
| **F020 Memory intrinsics** | `peek()` returns `byte`; storing into an enum requires `EnumName(peek(...))` (EN-10). `poke()` accepts an enum directly (enum→byte, EN-9). `sizeof(EnumName) == 1`. |
| **F021 Lexical structure** | `enum` is keyword `KW_ENUM`. Member access uses the `.` (DOT) token. No new tokens introduced. |

---

## Examples

### Example 1: Basic enum (the common case)

```blend65
module game;

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

### Example 2: Game state machine (pattern)

```blend65
module statemachine;

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

### Example 3: Hardware boundary — reading and writing bytes

```blend65
module sprites;

enum SpriteColor {
    BLACK  = 0,
    WHITE  = 1,
    RED    = 2,
    CYAN   = 3,
    PURPLE = 4
}

const COLOR_REGISTER: word = $D027;

function readColor(): SpriteColor {
    // peek() returns byte → explicit narrowing into the enum
    return SpriteColor(peek(COLOR_REGISTER));
}

function writeColor(c: SpriteColor): void {
    // poke() expects byte → enum widens implicitly, no cast needed
    poke(COLOR_REGISTER, c);
}

function main(): void {
    writeColor(SpriteColor.PURPLE);          // implicit enum → byte
    let current: SpriteColor = readColor();   // explicit byte → enum
}
```

### Example 4: Edge cases — aliases, mixed numbering, out-of-range cast

```blend65
module edge;

// Mixed explicit and auto-numbered members
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

// Duplicate VALUES are allowed (intentional aliases) — EN-5
enum Status {
    OK    = 0,
    READY = 0,      // alias for OK — legal, no warning
    BUSY  = 1
}

function demo(): void {
    // Cast of a byte that matches no member is DEFINED (EN-10):
    // the value is held as-is; it simply has no member name.
    let mystery: Color = Color(99);          // defined: holds 99
    let n: byte = mystery;                    // implicit enum → byte → 99

    // The following would be compile errors:
    // let c: Color = 2;          // E10235 — needs Color(2)
    // enum Empty { }             // E10234 — empty enum
    // enum Bad { X = 300 }       // E10233 — out of byte range
}
```

---

## Language Guard Verdict

### Platform Universality (P)

| Rule | Status | Notes |
|------|--------|-------|
| P1 Cross-platform compilable | ✅ | Enums lower to byte constants — universal across all 6502 platforms |
| P2 Platform-meaningful | ✅ | State machines, directions, colors, tile/sprite IDs needed on every platform |
| P3 No platform assumptions | ✅ | Enum definition references no hardware; addresses in examples are illustrative only |
| P4 Resource-scalable | ✅ | 1 byte per value everywhere; no scaling concern even on the 7800's 4KB |

### Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅ | Members are immediate byte constants; no absent hardware required |
| H2 Cost transparency | ✅ | Identical cost to `byte`; casts are zero-instruction; cost table documented |
| H3 SFA compatible | ✅ | Compile-time constants; enum-typed variables are static 1-byte allocations |
| H4 Memory footprint documented | ✅ | 1 byte/value, 0 bytes/declaration; `sizeof(EnumName) == 1` |
| H5 Fully deterministic | ✅ | `EnumName(b)` defined for all bytes (value = b); no traps, no UB (EN-10) |

### Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅ | `enum` decl, `Name.MEMBER` access, `Name(expr)` cast — all resolve without ambiguity (EN-A1, EN-A2) |
| L2 Consistent with existing | ✅ | `name: type` annotations; cast syntax matches `byte()`/`word()`; `.` access matches structs |
| L3 Beginner-friendly | ✅ | Asymmetric conversion mirrors classic C enums; readable by C/TS developers |
| L4 Minimal feature | ✅ | Byte-backed only; no associated data, no methods, no word enums |
| L5 No redundancy | ✅ | Replaces ad-hoc `const` byte groups with a named, type-checked set |
| L6 Error messages defined | ✅ | 7 error codes covering value range, duplicates, empties, conversions, cross-type compare |
| L7 Compile-time failure preferred | ✅ | All misuse (E10230–E10236) caught at compile time |
| L8 Feature interaction documented | ✅ | Interactions with F003, F009, F011, F014, F016–F021 specified |
| L9 Documentable with examples | ✅ | 4 examples: basic, state machine, hardware boundary, edge cases |

### Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅ | `KW_ENUM` + brace block; member access and cast use existing tokens — no context sensitivity in the lexer |
| C2 Semantic analysis defined | ✅ | Auto-numbering, range check, uniqueness, nominal typing, asymmetric conversion all specified |
| C3 Code generation strategy | ✅ | Lowers to byte ops; casts emit nothing — fully documented |
| C4 Unit testable | ✅ | Each rule (EN-1…EN-13) and each error code independently testable |
| C5 Runtime verifiable | ✅ | Lowered byte values deterministic; emulator-testable on all platforms |

### Future-Proofing (F)

| Rule | Status | Notes |
|------|--------|-------|
| F1 Extensible | ✅ | Word-backed enums, exhaustiveness checking, and range cases can be added without breaking existing code |
| F2 Platform-profile ready | ✅ | No platform-specific behavior |
| F3 Optimizer-friendly | ✅ | Members fold to constants; comparisons and switches optimize as byte code |
| F4 Stability classification | ✅ | Classified as **stable** |

### Escape Hatches Applied

None. All 23 rules pass.

### Verdict

**✅ ACCEPTED** — Enums are a zero-cost, byte-backed nominal type. The asymmetric conversion model (implicit enum→byte, explicit byte→enum) matches classic C ergonomics while adding one safety guardrail at the only genuinely unsafe boundary — turning an unchecked byte into a named value. This keeps peek/poke-heavy 6502 code readable without sacrificing type-checked function signatures and struct fields.
