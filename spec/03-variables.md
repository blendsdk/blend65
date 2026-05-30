# Chapter 03 — Variables & Constants

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F019, F005

---

## 1. Overview

Variables and constants are the primary way to store data in Blend65. This chapter is the **single source of truth** for declaration syntax, initialization rules, mutability semantics, memory placement, and the startup sequence.

Blend65 provides two declaration keywords:

- **`let`** — declares a mutable variable. Can be reassigned after initialization.
- **`const`** — declares a compile-time constant. Must have a compile-time constant initializer. Scalar constants are inlined by the compiler (zero RAM cost); aggregate constants (arrays, structs) are placed in the data/ROM section.

A third construct, the **`zeropage` block**, provides fast-access storage in the 6502's zero-page region.

---

## 2. Declaration Syntax

### 2.1 `let` — Mutable Variables

```ebnf
let_decl = "let" , identifier , ":" , type_expr , [ "=" , expression ] , ";" ;
```

```blend65
let score: word = 0;
let playerX: byte;              // uninitialized — indeterminate value
let active: boolean = true;
let velocity: sbyte = -2;
```

### 2.2 `const` — Compile-Time Constants

```ebnf
const_decl = "const" , identifier , ":" , type_expr , "=" , const_expression , ";" ;
```

```blend65
const MAX_ENEMIES: byte = 8;
const GRAVITY: sbyte = 1;
const SCREEN_ADDR: word = $0400;
const SINE_TABLE: byte[256] = [0, 3, 6, 9, /* ... */];
const DEFAULT_ENEMY: Enemy = { x: 0, y: 0, hp: 100, enemyType: 0, frame: 0 };
```

### 2.3 `zeropage` Block — Fast-Access Variables

```ebnf
zeropage_block = "zeropage" , "{" , zeropage_var , { zeropage_var } , "}" ;
zeropage_var   = identifier , ":" , type_expr , [ "=" , expression ] , ";" ;
```

```blend65
zeropage {
    playerX: byte = 160;
    playerY: byte = 100;
    frameCount: byte = 0;
    tempPtr: word;
}
```

Zeropage variables are always mutable. The compiler allocates them from the platform profile's available zero-page range (→ Ch 15). There is no `let` or `const` keyword inside the block — placement itself implies mutability and ZP location.

---

## 3. Variable Rules

### VAR-1 — Mandatory Type Annotation

Every declaration must have an explicit type annotation. There is no type inference (Axiom A4 — explicit over implicit, → Ch 02, TS-1).

```blend65
let score: word = 0;     // ✅
let score = 0;           // ❌ E10150: type annotation required
```

### VAR-2 — `let` Initialization Is Optional

A `let` variable may be declared without an initializer. Its value is **indeterminate** until assigned. Using an indeterminate variable triggers warning W10190.

```blend65
let temp: byte;           // ⚠️ W10190 if read before assignment
temp = calculate();       // now initialized
let value: byte = temp;   // ✅ safe after assignment
```

### VAR-3 — `const` Initialization Is Mandatory

A `const` must have an initializer, and the initializer must be a **compile-time constant expression** (→ Ch 04, §10).

```blend65
const MAX: byte = 8;               // ✅ literal
const DOUBLE: byte = MAX * 2;      // ✅ const expression
const SIZE: byte = length(TABLE);  // ✅ length() of const array is compile-time
const BAD: byte;                   // ❌ E10192: const must be initialized
const BAD2: byte = someFunction(); // ❌ E10193: initializer is not compile-time constant
```

### VAR-4 — `const` Cannot Be Reassigned

```blend65
const MAX: byte = 8;
MAX = 10;             // ❌ E10191: cannot assign to const
MAX += 1;             // ❌ E10191: cannot assign to const
```

### VAR-5 — Scope Rules

| Context | Scope |
|---------|-------|
| Module-level `let`/`const` | Visible throughout the module (after declaration point irrelevant — see VAR-6) |
| Module-level `zeropage` block | Same as module-level `let` — visible throughout module |
| Function-local `let`/`const` | Block-scoped (→ Ch 05, §2.3) |
| For-loop counter | Scoped to the loop body (→ Ch 05, §5.2) |

### VAR-6 — Declaration Order Independent

Module-level declarations can reference each other regardless of source order. The compiler resolves all module-level declarations in a first pass. Function-local declarations follow lexical order within the function body.

```blend65
let x: byte = MAX;        // ✅ MAX is resolved in first pass
const MAX: byte = 10;
```

### VAR-7 — No Shadowing

A variable name in a nested scope must not duplicate a name in an enclosing scope (→ Ch 05, §2.4). This includes:
- Function locals vs. module-level variables
- Block-scoped locals vs. function parameters
- Loop counter vs. enclosing scope variables

```blend65
let score: word = 0;

function update(): void {
    let score: word = 100;  // ❌ E10101: 'score' shadows module-level declaration
}
```

### VAR-8 — No Duplicate Declarations in Same Scope

Two declarations with the same name in the same scope → E10003.

```blend65
let x: byte = 1;
let x: byte = 2;    // ❌ E10003: duplicate declaration
```

### VAR-9 — Naming Rules

Identifiers follow the rules in → Ch 01, §3. Keywords cannot be used as identifiers. Identifiers are case-sensitive.

---

## 4. Memory Placement

### 4.1 Placement Model

| Declaration | Placement | Mutability | Details |
|-------------|-----------|------------|---------|
| `zeropage { x: byte; }` | Zero page ($00–$FF) | Always mutable | Fast access; compiler allocates from platform's ZP range |
| `let x: byte = 0;` | General RAM | Mutable | Default placement; compiler allocates in RAM segment |
| `const X: byte = 0;` | Inlined / Data section | Immutable | Scalar: inlined at use site (0 RAM). Aggregate: data/ROM section |

### 4.2 Scalar Constant Inlining

Scalar `const` values (`byte`, `sbyte`, `word`, `sword`, `boolean`) are **inlined** by the compiler — the constant name is replaced by its value at every use site. No RAM or ROM is allocated for the constant itself.

```blend65
const MAX: byte = 8;
let i: byte = MAX;    // compiles as: LDA #8 / STA i
```

### 4.3 Aggregate Constant Placement

Aggregate `const` values (arrays, structs) are placed in the **data section**. The platform profile maps the data section to ROM (for cartridge-based platforms like Atari 7800) or a designated RAM area (for disk-based platforms like C64).

```blend65
const TABLE: byte[4] = [10, 20, 30, 40];    // 4 bytes in data section
const DEFAULT: Enemy = { x: 0, y: 0, hp: 100, enemyType: 0, frame: 0 }; // 5 bytes in data section
```

### 4.4 Zeropage Budget

The platform profile defines how many zero-page bytes are available (→ Ch 15). The compiler tracks total ZP usage across all modules. Exceeding the budget → E10032.

| Platform | Typical ZP Budget | Notes |
|----------|-------------------|-------|
| C64 | ~20–30 bytes | KERNAL uses most of $00–$FF |
| CX16 | ~32 bytes | Similar KERNAL usage |
| Atari 800XL | ~20 bytes | OS uses most of page zero |
| Atari 7800 | ~16 bytes | TIA/MARIA reserves + small RAM |

The compiler also uses ZP bytes internally for expression evaluation temps and struct/array pointer temps (→ Ch 06, §7.6; → Ch 07, §5.8). These are in addition to user-declared ZP variables.

---

## 5. Startup Sequence

### 5.1 Initialization Order

Module-level variables with initializers are set up by a compiler-generated **startup routine** that runs before `main()`:

1. **Zeropage variables** with initializers — `LDA #value / STA zpAddr`
2. **RAM variables** with initializers — `LDA #value / STA ramAddr`
3. **`main()` call** — `JSR _main`

Uninitialized variables (`let x: byte;`) generate **no startup code** — their memory contains whatever was there before.

### 5.2 Startup Cost

| Item | ROM Cost | Cycle Cost |
|------|----------|------------|
| Byte initializer | 4 bytes (LDA imm + STA abs) | 6 cycles |
| Word initializer | 8 bytes (2 × LDA + STA) | 12 cycles |
| Struct initializer (N bytes) | 4N bytes | 6N cycles |
| Fill array (N bytes) | ~7 bytes (loop) | ~5N cycles |
| Explicit array (N values) | 4N bytes | 6N cycles |
| Uninitialized variable | 0 bytes | 0 cycles |

The compiler reports total startup cost in the build summary.

### 5.3 Const Arrays: No Startup Cost

Const arrays and structs are placed directly in the data/ROM section — they require **no startup initialization code**. Their values are baked into the binary.

---

## 6. Code Generation

### 6.1 Module-Level Byte Variable

```blend65
let score: byte = 0;
```

```asm
; In startup routine:
    LDA #$00
    STA _score          ; 4 bytes ROM, 6 cycles

; Usage: score = score + 10
    LDA _score
    CLC
    ADC #10
    STA _score
```

### 6.2 Module-Level Word Variable

```blend65
let totalScore: word = 1000;
```

```asm
; In startup routine:
    LDA #<1000          ; $E8
    STA _totalScore
    LDA #>1000          ; $03
    STA _totalScore+1   ; 8 bytes ROM, 12 cycles
```

### 6.3 Zeropage Variable

```blend65
zeropage {
    frameCount: byte = 0;
}
```

```asm
; In startup routine:
    LDA #$00
    STA $02             ; ZP address allocated by compiler

; Usage (faster than RAM):
    INC $02             ; 5 cycles (vs 6 for absolute INC)
    LDA $02             ; 3 cycles (vs 4 for absolute LDA)
```

### 6.4 Scalar Const (Inlined)

```blend65
const MAX_SPEED: byte = 4;
if (speed > MAX_SPEED) { speed = MAX_SPEED; }
```

```asm
    LDA _speed
    CMP #4              ; MAX_SPEED inlined as immediate
    BCC .skip
    BEQ .skip
    LDA #4              ; MAX_SPEED inlined again
    STA _speed
.skip:
```

### 6.5 Const Array (Data Section)

```blend65
const COLORS: byte[4] = [0, 6, 14, 1];
let c: byte = COLORS[i];
```

```asm
; COLORS in data section:
_COLORS: .byte $00, $06, $0E, $01

; Access:
    LDX _i
    LDA _COLORS,X      ; absolute indexed — 4 cycles
    STA _c
```

---

## 7. Error Codes

All error codes defined in this chapter. The canonical registry is in → Ch 14.

| Code | Condition | Message |
|------|-----------|---------|
| E10003 | Duplicate declaration in same scope | `Duplicate declaration — '<name>' is already declared in this scope` |
| E10032 | ZP budget exceeded | `Zero-page budget exceeded — <used> bytes used, platform '<platform>' allows <budget> bytes` |
| E10101 | Name shadows enclosing scope | `'<name>' shadows a declaration in an enclosing scope — use a different name` |
| E10150 | Missing type annotation | `Type annotation required — write '<name>: <type>'` |
| E10190 | Use before initialization | — see W10190 (warning) |
| E10191 | Assignment to const | `Cannot assign to const '<name>' — constants cannot be reassigned` |
| E10192 | Const without initializer | `Const '<name>' must have an initializer — constants require a compile-time value` |
| E10193 | Non-constant const initializer | `Initializer for const '<name>' is not a compile-time constant expression` |

## Warning Codes

| Code | Condition | Message |
|------|-----------|---------|
| W10190 | Possible use before initialization | `Variable '<name>' may be used before being initialized — assign a value before reading` |
| W10191 | Unused variable | `Variable '<name>' is declared but never used — consider removing it` |
| W10030 | Large ZP allocation | `Zeropage allocation for '<name>' uses <N> bytes — consider total ZP budget` |

---

## 8. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Type system** (→ Ch 02) | All declarations require explicit type annotations (TS-1). Assignment follows type compatibility. Literal type rules (TS-2) apply to initializers. |
| **Operators** (→ Ch 04) | Compound assignment (`+=`, `-=`, etc.) on `let` variables. Not allowed on `const` (E10191). |
| **Control flow** (→ Ch 05) | Block scoping for function-local declarations. No shadowing (E10101). For-loop counters scoped to loop body. |
| **Functions** (→ Ch 06) | Function-local variables stored in SFA frame. Block-scoped locals with non-overlapping lifetimes share frame memory. Parameters are like `let` (mutable) unless marked `const`. |
| **Structs** (→ Ch 07) | Struct instances can be `let` or `const`. Const structs placed in data section. |
| **Arrays** (→ Ch 08) | Array `let`/`const` controls element mutability. Const arrays must be fully initialized (E10113). |
| **Enums** (→ Ch 09) | Enum-typed `let`/`const` occupy 1 byte. Const enum values are inlined. |
| **Modules** (→ Ch 10) | Module-level `let`/`const`/`zeropage` declarations. `export` makes them visible to other modules. |
| **Memory model** (→ Ch 11) | `let` → RAM segment. `const` scalar → inlined. `const` aggregate → data/ROM. `zeropage` → ZP range. SFA frame allocation for function locals. |

---

## 9. Examples

### 9.1 Game Variables — Module Level

```blend65
module Game;

// Constants — inlined, zero RAM cost
const MAX_ENEMIES: byte = 8;
const PLAYER_SPEED: byte = 2;
const GRAVITY: sbyte = 1;
const SCREEN_W: byte = 40;
const SCREEN_H: byte = 25;

// Zero-page variables — fast access
zeropage {
    playerX: byte = 160;
    playerY: byte = 100;
    frameCount: byte = 0;
}

// RAM variables — general storage
let score: word = 0;
let lives: byte = 3;
let gameRunning: boolean = true;
let enemyCount: byte = 0;

// Uninitialized — developer writes before reading
let tempCalc: word;
let inputBuffer: byte[8];

// Const array — placed in data section
const ENEMY_SPEEDS: byte[8] = [1, 1, 2, 2, 3, 3, 4, 4];
```

### 9.2 Function-Local Variables

```blend65
module Physics;

const MAX_FALL: sbyte = 8;

function applyGravity(): void {
    const ACCEL: sbyte = 1;              // inlined, 0 bytes in frame
    let newVelY: sbyte = velY + ACCEL;   // 1 byte in SFA frame

    if (newVelY > MAX_FALL) {
        newVelY = MAX_FALL;
    }
    velY = newVelY;

    let newY: sword = sword(playerY) + sword(newVelY);  // 2 bytes in frame
    if (newY >= 0) {
        playerY = word(newY);
    }
}

// SFA frame for applyGravity:
//   newVelY: 1 byte (sbyte)
//   newY:    2 bytes (sword)
//   Total: 3 bytes
//   ACCEL: inlined — 0 bytes
```

### 9.3 Zeropage for Performance-Critical Data

```blend65
module Renderer;

zeropage {
    screenPtr: word;         // 2 bytes — pointer for indirect addressing
    colorPtr: word;          // 2 bytes — color RAM pointer
    drawX: byte = 0;        // 1 byte — current draw position
    drawY: byte = 0;        // 1 byte — current draw position
}
// Total: 6 ZP bytes

function setScreenPos(x: byte, y: byte): void {
    drawX = x;
    drawY = y;
    screenPtr = $0400 + word(y) * 40 + word(x);
    colorPtr = $D800 + word(y) * 40 + word(x);
}
```
