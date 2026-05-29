# F019 — Variables & Constants

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F003 (module contents), F005 (memory placement), F016 (type system)  
> **Interacts with**: F004 (entry point), F008 (for loop), F009 (switch), F011 (structs), F013 (control flow / scoping), F014 (arrays), F017 (operators), F018 (functions)

---

## Description

Variables and constants are the primary way to store data in Blend65. This feature is the **single source of truth** for declaration syntax, initialization rules, mutability semantics, and the startup sequence. While individual aspects were introduced in earlier features (F003's module-level rules, F005's memory placement, F013's block scoping, F016's mandatory type annotations), this document consolidates everything into one canonical reference.

Blend65 provides two declaration keywords:

- **`let`** — declares a mutable variable. Can be reassigned after initialization.
- **`const`** — declares a compile-time constant. Must have a compile-time constant initializer. Scalar constants are inlined by the compiler (zero RAM cost). Array and struct constants are placed in the data/ROM section.

```blend65
// Mutable variables — stored in RAM
let playerX: byte = 160;
let score: word = 0;
let temp: byte;                      // no initializer — indeterminate until assigned

// Compile-time constants — inlined or placed in data section
const MAX_ENEMIES: byte = 8;
const SCREEN_WIDTH: byte = 40;
const SINE_TABLE: byte[256] = [/* precomputed values */];
```

**Key design principles:**
- Every declaration requires an explicit type annotation (F016 TS-1) — no type inference
- `const` always means compile-time constant — never a runtime-immutable variable
- Uninitialized `let` variables have indeterminate values — no hidden init code
- One declaration per statement — no multi-variable declarations
- The startup sequence is linear: CPU init → variable init → fall through to main() — no JSR/JMP overhead

---

## Syntax

### Variable Declaration (`let`)

```ebnf
let_decl = "let" , identifier , ":" , type_expr , [ "=" , expression ] , ";" ;
```

### Constant Declaration (`const`)

```ebnf
const_decl = "const" , identifier , ":" , type_expr , "=" , const_expr , ";" ;
```

### With Export (module-level only)

```ebnf
export_let_decl   = "export" , let_decl ;
export_const_decl = "export" , const_decl ;
```

### Type Expressions

```ebnf
type_expr = "byte" | "sbyte" | "word" | "sword" | "boolean"
          | identifier                           (* struct or enum type *)
          | type_expr , "[" , const_expr , "]"    (* array type *)
          | type_expr , "[" , "]"                 (* array with inferred size — requires initializer *) ;
```

### Constant Expressions

```ebnf
const_expr = literal
           | const_identifier
           | const_expr , binary_op , const_expr
           | unary_op , const_expr
           | "(" , const_expr , ")"
           | "sizeof" , "(" , type_or_name , ")"
           | "embed" , "(" , string_literal , ")" , [ "." , selector ] ;
```

A `const_expr` is evaluated entirely at compile time. It may reference other `const` values, use arithmetic/bitwise/comparison operators with constant operands, and invoke compile-time intrinsics like `sizeof()` and `embed()`.

---

## Rules

### VAR-1 — `let` Declaration

`let` declares a mutable variable. The variable can be reassigned any number of times after declaration.

```blend65
let health: byte = 100;
health = 80;                // ✅ reassignment allowed
health = health - 10;       // ✅ compound read + write

let position: word;         // ✅ no initializer — indeterminate until assigned
position = 1000;            // ✅ first assignment
```

**Where `let` is valid:**

| Context | Valid | Notes |
|---------|-------|-------|
| Module level | ✅ | Stored in general RAM. Initializer must be compile-time constant (E10011) |
| Function body | ✅ | Stored in function's SFA frame. Initializer can be any expression |
| Block body (if/while/for) | ✅ | Scoped to the block (F013 CF-3). Shares SFA frame memory with non-overlapping blocks |
| For-loop init | ✅ | `for (let i: byte = 0 to 10)` — loop variable is read-only (F008) |
| `zeropage { }` block | ❌ | Zeropage uses `name: type` syntax without keywords (F005) |
| Module level without a function | ❌ | Bare statements are E10010 (F003) |

### VAR-2 — `const` Declaration

`const` declares a compile-time constant. The initializer is **required** and must be a compile-time constant expression.

```blend65
const MAX_SPEED: byte = 5;
const SCREEN_BASE: word = $0400;
const TILE_SIZE: byte = 8;
const MAP_BYTES: word = 40 * 25;       // ✅ constant folding: 1000
```

**Scalar `const` behavior:** The compiler inlines the constant's value at every use site. No RAM is allocated. No storage exists at runtime. This is equivalent to an `EQU` directive in assembly.

```blend65
const MAX: byte = 8;
let count: byte = MAX;        // compiles to: LDA #8 / STA count
if (count < MAX) { ... }      // compiles to: LDA count / CMP #8
```

**Array/struct `const` behavior:** The data is placed in the data/ROM section at assemble time. No runtime initialization code is generated. This is equivalent to `.byte` directives in assembly.

```blend65
const TABLE: byte[4] = [10, 20, 30, 40];
// Placed in data section — no init code, just:
// _TABLE: .byte 10, 20, 30, 40
```

**Where `const` is valid:**

| Context | Valid | Notes |
|---------|-------|-------|
| Module level | ✅ | Scalar: inlined. Array/struct: data section |
| Function body | ✅ | Same behavior — inlined or data section. Useful for local readability |
| Block body (if/while/for) | ✅ | Scoped to the block. Same compile-time-constant rule applies |
| `zeropage { }` block | ❌ | E10031 — zeropage is for mutable runtime data (F005) |

**Function-local `const` with runtime expressions is NOT allowed:**

```blend65
function foo(base: word): void {
    const OFFSET: word = base + 10;    // ❌ E10191: not a compile-time constant
    const SCALE: byte = 4;             // ✅ compile-time constant
}
```

If you want a locally-scoped value computed from runtime data, use `let`:

```blend65
function foo(base: word): void {
    let offset: word = base + 10;      // ✅ runtime-computed local variable
}
```

### VAR-3 — Initialization Rules

| Declaration | Init Code Generated? | Runtime Value | Assembly Equivalent |
|-------------|---------------------|---------------|---------------------|
| `let x: byte = 10;` | ✅ Yes (LDA #10, STA x) | 10 | `LDA #10 / STA x` at entry |
| `let x: byte;` | ❌ No | Indeterminate (whatever is in RAM) | `x: .res 1` (reserve only) |
| `const X: byte = 5;` | ❌ No (inlined) | N/A — no storage | `X = 5` (equate) |
| `const T: byte[] = [1,2];` | ❌ No (data section) | N/A — placed at assemble time | `T: .byte 1, 2` |

**Module-level initializer constraint:** When a module-level `let` has an initializer, it must be a compile-time constant expression (E10011 from F003). Function calls, variable references, and runtime computation are not allowed:

```blend65
// Module level
const MAX: byte = 8;
let score: word = 0;                  // ✅ literal constant
let offset: byte = MAX * 2;           // ✅ constant expression (MAX is const)
let computed: byte = getDefault();     // ❌ E10011: not a compile-time constant
let derived: byte = score + 1;        // ❌ E10011: references runtime variable
```

**Function-level initializers** may use any valid expression:

```blend65
function update(): void {
    let newX: byte = playerX + speed;     // ✅ runtime expression — fine in function
    let lookup: byte = TABLE[index];      // ✅ runtime array access — fine in function
}
```

### VAR-4 — Indeterminate Variables and Use-Before-Init

Variables declared without an initializer have **indeterminate** values — they contain whatever byte(s) happen to be at that memory location. On 6502, reading any memory address is safe (returns some byte 0-255), so this is not undefined behavior (H5). However, the result is unpredictable.

The compiler performs **definite-assignment analysis** during semantic analysis and warns when a variable is read before being assigned:

```blend65
let temp: byte;                        // state: INDETERMINATE
let result: byte = temp + 1;           // ⚠️ W10190: 'temp' used before initialization

let count: byte;                       // state: INDETERMINATE
count = 0;                             // state: → INITIALIZED
count += 1;                            // ✅ no warning — count was assigned
```

**Branch analysis (conservative):**

```blend65
let x: byte;                           // INDETERMINATE
if (condition) {
    x = 10;                            // INITIALIZED on this path
}
let y: byte = x;                       // ⚠️ W10190: not all paths initialize 'x'

let z: byte;                           // INDETERMINATE
if (condition) {
    z = 10;
} else {
    z = 20;
}
let w: byte = z;                       // ✅ no warning — all paths assign 'z'
```

**Module-level variables:** Indeterminate module-level variables do NOT trigger W10190, because they may be initialized by `main()` before being read by other functions. The call graph analysis needed to track this across functions is deferred.

### VAR-5 — Assignment Rules

Assignment follows the type compatibility rules from F016 TS-8:

```blend65
let b: byte = 200;
let w: word = b;                       // ✅ implicit widening (zero-extend)
let b2: byte = w;                      // ❌ E10082: implicit narrowing — use byte(w)
let b3: byte = byte(w);               // ✅ explicit narrowing cast

let sb: sbyte = -5;
let b4: byte = sb;                     // ❌ E10080: cross-signedness — use byte(sb)
```

**Cannot assign to `const`:**

```blend65
const MAX: byte = 8;
MAX = 10;                              // ❌ E10192: cannot assign to const 'MAX'
```

**Cannot assign whole arrays or structs:**

```blend65
let a: byte[4] = [1, 2, 3, 4];
let b: byte[4] = [5, 6, 7, 8];
a = b;                                 // ❌ E10119: cannot assign whole array (F014)
```

**Cannot assign to for-loop variables:**

```blend65
for (let i: byte = 0 to 10) {
    i = 5;                             // ❌ E10060: cannot assign to for-loop variable (F008)
}
```

### VAR-6 — One Declaration Per Statement

Each `let` or `const` statement declares exactly one variable. Multiple declarations in a single statement are not supported.

```blend65
// ✅ Correct — one per statement
let x: byte = 10;
let y: byte = 20;
let z: byte = 30;

// ❌ Not supported — no multi-declaration syntax
// let x: byte = 10, y: byte = 20;    // parse error
```

**Rationale:** Simpler parsing, clearer code, no edge cases with mixed types. Each declaration gets its own line and its own type annotation. Consistent with TypeScript best practice.

### VAR-7 — `const` Struct Instances

Struct instances can be declared `const`. All fields are immutable. The struct is placed in the data/ROM section.

```blend65
struct Point {
    x: byte;
    y: byte;
}

const ORIGIN: Point = { x: 0, y: 0 };
const SPAWN: Point = { x: 160, y: 100 };

function reset(player: Point): void {
    player.x = ORIGIN.x;              // ✅ reads const struct field
    player.y = ORIGIN.y;
    ORIGIN.x = 5;                      // ❌ E10192: cannot assign to const 'ORIGIN'
}
```

This is consistent with const arrays (F014) — `const` makes all elements/fields immutable.

### VAR-8 — `const` Expression Evaluation

Constant expressions are evaluated at compile time using full-precision arithmetic (F016 TS-13). The result must fit in the declared type's range:

```blend65
const SIZE: word = 40 * 25;           // ✅ → 1000
const MASK: byte = $FF & $0F;         // ✅ → $0F
const HALF: byte = 256 / 2;           // ✅ → 128
const BIG: byte = 200 + 100;          // ❌ E10084: 300 out of range for byte

const A: byte = 10;
const B: byte = A * 2;                // ✅ → 20 (references other const)
const C: byte = A + B;                // ✅ → 30
```

**What qualifies as a compile-time constant expression:**

| Expression | Constant? | Notes |
|-----------|-----------|-------|
| Numeric literal (`42`, `$FF`, `%1010`) | ✅ | Always |
| Boolean literal (`true`, `false`) | ✅ | Always |
| String/char literal (`'A'`, `"hello"`) | ✅ | For array initializers |
| Reference to another `const` | ✅ | Transitively resolved |
| Arithmetic on constants (`A + B`, `3 * 4`) | ✅ | Evaluated at compile time |
| Bitwise on constants (`$FF & $0F`) | ✅ | Evaluated at compile time |
| Comparison on constants (`A > B`) | ✅ | Produces `boolean` constant |
| `sizeof(type)` | ✅ | Compile-time intrinsic |
| `embed("file.bin")` | ✅ | Compile-time file inclusion (F015) |
| Reference to a `let` variable | ❌ | Runtime value |
| Function call | ❌ | Runtime computation |
| Array element access with variable index | ❌ | Runtime computation |

### VAR-9 — Export Rules

Module-level `let` and `const` declarations can be exported for use by other modules:

```blend65
// module: Game
export let score: word = 0;
export let lives: byte = 3;
export const MAX_LIVES: byte = 5;
```

```blend65
// module: HUD
import { score, lives, MAX_LIVES } from Game;

function drawLives(): void {
    // Can read AND write imported let variables
    if (lives > MAX_LIVES) {
        lives = MAX_LIVES;
    }
}
```

**Rules:**
- `export let` allows other modules to read and write the variable
- `export const` allows other modules to read the constant (compiler inlines the value at the import site)
- Function-local declarations cannot be exported (they are scoped to the function)
- `zeropage` exports are per-variable with `export` inside the block (F005)

### VAR-10 — `let` and `const` for Arrays

Array mutability is controlled by `let` vs `const` (consolidating F014 rules):

| | Element Mutation | Array Reassignment |
|----------|------------------|-------------------|
| `let` | ✅ Allowed | ❌ Never (E10119) |
| `const` | ❌ Not Allowed (E10192) | ❌ Never (E10119) |

```blend65
let mutable: byte[4] = [1, 2, 3, 4];
mutable[0] = 10;                      // ✅ element mutation allowed

const immutable: byte[4] = [1, 2, 3, 4];
immutable[0] = 10;                     // ❌ E10192: cannot modify const array

// Array size inference from initializer (F014, F016)
const COLORS: byte[] = [2, 5, 6];     // ✅ size inferred as 3
let buffer: byte[];                    // ❌ E10110: size required without initializer
```

---

## Startup Sequence

The compiler generates a linear startup sequence that matches how a 6502 assembly programmer structures their entry point. There are no hidden functions, no JSR to main, and no JMP gymnastics.

### The Sequence

```
[Platform-specific loader stub]        ← BASIC SYS / RUNAD / RESET vector
                                         (defined by platform profile)
_blend65_entry:
    SEI                                ← Standard CPU init
    CLD
    LDX #$FF
    TXS
    
    ; Variable initialization — LDA/STA for each initialized variable
    ; (in declaration order within each module)
    LDA #<_playerX_init_lo
    STA _playerX
    LDA #$00
    STA _score
    STA _score+1
    LDA #10
    STA _zp_frameCount
    
    ; Fall through directly into main() body — NO JSR, NO JMP
_main:
    ; ... main() body code starts here ...
```

### Startup Rules

| Rule | Description |
|------|-------------|
| **Linear flow** | CPU init → variable init → main() body. No JSR, no JMP. main() is inlined at the entry point |
| **No hidden functions** | There is no `__init()` or `__startup()`. The init sequence is visible in the build summary |
| **Declaration order** | Init code is emitted in declaration order within each module |
| **Module order** | Modules are initialized in dependency order (imports before importers), then alphabetically for independent modules |
| **`const` = no init code** | Scalar constants are inlined (EQU). Array/struct constants are placed in the data section at assemble time (.byte directives). Zero runtime cost |
| **No initializer = no code** | `let temp: byte;` generates zero init code — just reserves RAM (`.res 1`) |
| **Platform stub** | The loader stub (BASIC SYS, RUNAD, RESET vector) is defined by the platform profile, not the language |
| **CPU init** | SEI, CLD, LDX #$FF, TXS — standard 6502 startup. Platform profile can customize (7800 needs TIA init, etc.) |
| **main() is uncallable** | main() is the entry point, not a callable function. Other functions cannot call main() (E10023 in F004) |

### Assembly Equivalence

| Blend65 | Assembly Equivalent | Runtime Cost |
|---------|-------------------|-------------|
| `const MAX: byte = 8;` | `MAX = 8` (equate) | 0 bytes, 0 cycles |
| `const TABLE: byte[] = [1,2,3];` | `TABLE: .byte 1, 2, 3` (data section) | 0 cycles (placed at assemble time) |
| `let score: word = 0;` | `score: .res 2` + `LDA #0 / STA score / STA score+1` at entry | 6 bytes init, 10 cycles |
| `let temp: byte;` | `temp: .res 1` (reserve only) | 0 bytes init, 0 cycles |
| `zeropage { x: byte = 10; }` | `.segment "ZEROPAGE" / x: .res 1` + `LDA #10 / STA x` at entry | 4 bytes init, 6 cycles |

### Build Summary

The compiler reports the exact cost of the startup sequence:

```
=== Build Summary (platform: c64) ===
Startup sequence: 22 bytes ROM, 38 cycles
  CPU setup:     6 bytes (SEI, CLD, LDX #$FF, TXS)
  playerX:       4 bytes (LDA #$A0, STA $0820)
  score:         6 bytes (LDA #$00, STA $0822, STA $0823)
  frameCount:    4 bytes (LDA #$0A, STA $02)           [zeropage]
  temp:          0 bytes (no initializer)
Entry: falls through to main() — no JSR overhead
Data section: 259 bytes (SINE_TABLE: 256, SPRITE_DATA: 3)
```

---

## Code Generation

### Module-Level `let` with Initializer

**Source:**
```blend65
let playerX: byte = 160;
let score: word = 0;
```

**Generated (in startup sequence):**
```asm
    LDA #160
    STA _playerX        ; 4 bytes, 6 cycles
    LDA #$00
    STA _score          ; \
    STA _score+1        ; / 6 bytes, 10 cycles (word init, both bytes zero)
```

### Module-Level `let` without Initializer

**Source:**
```blend65
let temp: byte;
let buffer: byte[256];
```

**Generated:**
```asm
; No init code generated — just memory reservation
; In BSS/RAM segment:
_temp:   .res 1          ; 1 byte reserved
_buffer: .res 256        ; 256 bytes reserved
```

### Module-Level `const` (Scalar)

**Source:**
```blend65
const MAX_ENEMIES: byte = 8;
const SCREEN_WIDTH: byte = 40;
```

**Generated:**
```asm
; No storage allocated — values inlined at use sites
; When code references MAX_ENEMIES:
    LDA #8              ; inlined literal
; When code references SCREEN_WIDTH:
    LDA #40             ; inlined literal
```

### Module-Level `const` (Array)

**Source:**
```blend65
const SINE_TABLE: byte[4] = [0, 90, 127, 90];
```

**Generated:**
```asm
; In data section (ROM on cartridge platforms, loaded data on disk platforms):
_SINE_TABLE:
    .byte 0, 90, 127, 90    ; placed at assemble time — no runtime init
```

### Function-Local Variables

**Source:**
```blend65
function update(): void {
    let newX: byte = playerX + speed;
    let temp: byte;
    const THRESHOLD: byte = 200;
    
    if (newX > THRESHOLD) {
        newX = THRESHOLD;
    }
    playerX = newX;
}
```

**Generated:**
```asm
_update:
    ; Local 'newX' — runtime init in function body
    LDA _playerX
    CLC
    ADC _speed
    STA update_newX         ; store in SFA frame
    
    ; Local 'temp' — no init (indeterminate)
    ; THRESHOLD — inlined as #200
    
    ; if (newX > 200)
    LDA update_newX
    CMP #201                ; > 200 means >= 201
    BCC .skip
    LDA #200                ; THRESHOLD inlined
    STA update_newX
.skip:
    LDA update_newX
    STA _playerX
    RTS
```

### Const Struct

**Source:**
```blend65
struct Point { x: byte; y: byte; }

const ORIGIN: Point = { x: 0, y: 0 };
```

**Generated:**
```asm
; In data section:
_ORIGIN:
    .byte 0             ; x field
    .byte 0             ; y field
; No runtime init — placed at assemble time
```

---

## Resolved Ambiguities

### VAR-A1: Is function-local `const` allowed?

**Yes.** Function-local `const` follows the same rules as module-level `const`: initializer required, must be a compile-time constant expression. The constant is inlined — scoping to the function only affects visibility, not codegen. Useful for readability when a magic number is only relevant to one function.

### VAR-A2: Can you declare multiple variables in one `let` statement?

**No.** One declaration per statement. `let a: byte = 1, b: byte = 2;` is a parse error. Rationale: simpler parsing, clearer code, each variable gets its own type annotation on its own line.

### VAR-A3: Can `let` variables be declared without an initializer?

**Yes**, at both module level and function level. The variable has an indeterminate value until assigned. The compiler warns (W10190) when a function-local variable is read before being assigned on all code paths. Module-level indeterminate variables do not trigger this warning (they may be initialized by `main()` before use).

### VAR-A4: Does `const` allow runtime expressions in function bodies?

**No.** `const` always means compile-time constant, everywhere. `const x: byte = paramA + 1;` is E10191 because `paramA` is not a compile-time value. Use `let` for runtime-computed locals.

### VAR-A5: How does the startup sequence work?

Linear flow: platform loader stub → CPU init (SEI/CLD/TXS) → variable initialization (LDA/STA for each initialized variable) → fall through into main() body. No JSR to main(), no JMP. main() is inlined at the end of the startup sequence. This matches exactly how a 6502 assembly programmer structures their entry point.

### VAR-A6: Can `const` declare struct instances?

**Yes.** `const ORIGIN: Point = { x: 0, y: 0 };` places the struct in the data section. All fields are immutable. Consistent with const arrays.

### VAR-A7: Can other functions call `main()`?

**No.** E10023: `Cannot call main() — it is the program entry point, not a callable function.` main() is written with normal function syntax but the compiler prevents it from being called. At the entry point, main()'s body is inlined — there is no JSR to return from.

### VAR-A8: Does the compiler detect use-before-initialization?

**Yes.** The compiler performs definite-assignment analysis during semantic analysis. A variable declared without an initializer is tracked as INDETERMINATE. Any read while INDETERMINATE triggers W10190. Assignment transitions the variable to INITIALIZED. Branch analysis is conservative: if any code path leaves the variable INDETERMINATE, the warning fires.

### VAR-A9: What is the initialization order for multi-module programs?

Init code is emitted in declaration order within each module. Module initialization order follows dependency order (modules that are imported are initialized before the importing module), with alphabetical ordering for independent modules. Since all initializers must be compile-time constants (E10011), the order cannot affect correctness — no initializer can depend on another variable's runtime value.

---

## Error Codes

### New Error Codes

| Code | Condition | Message |
|------|-----------|---------|
| E10190 | `const` without initializer | `'const' declaration requires an initializer — constants must be initialized at declaration` |
| E10191 | `const` with non-constant initializer | `'const' initializer must be a compile-time constant expression — found '<expr>'` |
| E10192 | Assignment to `const` | `Cannot assign to 'const' variable '<name>'` |

### New Warning Codes

| Code | Condition | Message |
|------|-----------|---------|
| W10190 | Read before init | `Variable '<name>' may be used before initialization — value is indeterminate` |

### New Error Code in F004

| Code | Condition | Message |
|------|-----------|---------|
| E10023 | Calling main() | `Cannot call 'main()' — it is the program entry point, not a callable function` |

### Existing Error Codes That Apply

| Code | Source | Rule Enforced |
|------|--------|--------------|
| E10011 | F003 | Module-level initializer must be compile-time constant |
| E10031 | F005 | Constants not allowed in zeropage block |
| E10033 | F005 | `let`/`const` keyword inside zeropage block |
| E10060 | F008 | Cannot assign to for-loop variable |
| E10101 | F013 | Variable shadows outer scope |
| E10119 | F014 | Cannot assign whole array |
| E10150 | F016 | Type annotation required |
| E10084 | F010 | Value out of range for type |

---

## Feature Interactions

### With F003 (Module Contents)

Module-level `let` and `const` follow F003's rules: only declarations at module level, no executable statements, initializers must be compile-time constants (E10011). F019 formalizes the syntax and semantics; F003 defines what is allowed at module level.

### With F004 (Entry Point)

main() is the entry point. The startup sequence falls through into main()'s body — no JSR. Other functions cannot call main() (E10023). F004 defines the entry point rules; F019 defines the startup sequence that leads into main().

### With F005 (Memory Placement)

- `let` variables are placed in general RAM (default)
- `const` arrays/structs are placed in the data/ROM section (automatic)
- `zeropage { }` block provides zero-page placement (uses `name: type` syntax, not `let`/`const`)
- No `@ram` or `@data` keywords — placement is determined by `let` vs `const`

### With F008 (For Loop)

`for (let i: byte = 0 to 10)` declares a loop variable with `let` syntax. The loop variable is implicitly read-only (E10060). The loop variable is scoped to the for-loop body.

### With F009 (Switch Statement)

Case values must be compile-time constants (E10071). `const` values can be used as case values:

```blend65
const STATE_MENU: byte = 0;
const STATE_PLAY: byte = 1;

switch (gameState) {
    case STATE_MENU: showMenu();
    case STATE_PLAY: playGame();
}
```

### With F010 (Signed Types)

Signed and unsigned `let`/`const` variables follow the same declaration syntax. Type mixing rules (E10081) apply to all expressions involving variables. Literal adaptation (F010 ST-4) applies to initializers.

### With F011 (Structs)

Struct instances can be `let` (mutable fields) or `const` (immutable fields, data section). Struct variables follow the same scoping and initialization rules as scalar variables.

### With F013 (Control Flow / Scoping)

Block scoping (CF-3) applies to `let` and `const` declarations inside blocks. No shadowing (CF-4 / E10101). Name reuse in sequential non-overlapping scopes (CF-5). Definite-assignment analysis uses the control flow graph from F013.

### With F014 (Arrays)

Array `let`/`const` controls element mutability (VAR-10). Const params (CP-1..5) apply to array parameters passed to functions. Array size inference is allowed with initializer.

### With F016 (Type System)

All declarations require explicit type annotations (TS-1 / E10150). Assignment follows type compatibility rules (TS-8). Literal type rules (TS-2) apply to initializers. Const expression evaluation follows TS-13.

### With F017 (Operators)

Compound assignment operators (`+=`, `-=`, etc.) can be used on `let` variables but not on `const` (E10192). The compound assignment is expanded as `x = x OP expr` and follows the same type rules (F016 TS-12).

### With F018 (Functions)

Function-local variables are stored in the function's SFA frame. Block-scoped variables with non-overlapping lifetimes share frame memory. Parameters behave like `let` variables (mutable by default) unless marked `const` (F014 CP-1).

---

## Examples

### Example 1: Game Variables — Module Level

```blend65
module Game;

// Constants — inlined, zero RAM cost
const MAX_ENEMIES: byte = 8;
const PLAYER_SPEED: byte = 2;
const GRAVITY: sbyte = 1;
const SCREEN_W: byte = 40;
const SCREEN_H: byte = 25;

// Zero-page variables — fast access (F005)
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

function main(): void {
    // ... game code ...
}
```

**Build summary for this module:**
```
Startup: 18 bytes, 30 cycles
  playerX:     4 bytes (LDA #$A0, STA $02)     [zeropage]
  playerY:     4 bytes (LDA #$64, STA $03)     [zeropage]
  frameCount:  4 bytes (LDA #$00, STA $04)     [zeropage]
  score:       6 bytes (LDA #$00, STA, STA)    [RAM]
  lives:       4 bytes (LDA #$03, STA)         [RAM]
  gameRunning: 4 bytes (LDA #$01, STA)         [RAM]
  enemyCount:  4 bytes (LDA #$00, STA)         [RAM]
  tempCalc:    0 bytes (no initializer)
  inputBuffer: 0 bytes (no initializer)
Data section: 8 bytes (ENEMY_SPEEDS)
Constants: 5 inlined (MAX_ENEMIES, PLAYER_SPEED, GRAVITY, SCREEN_W, SCREEN_H)
```

### Example 2: Function-Local Variables

```blend65
module Physics;

const MAX_FALL: sbyte = 8;

function applyGravity(): void {
    // Function-local const — compile-time, inlined
    const ACCEL: sbyte = 1;
    
    // Function-local let — stored in SFA frame
    let newVelY: sbyte = velY + ACCEL;
    
    if (newVelY > MAX_FALL) {
        newVelY = MAX_FALL;
    }
    
    velY = newVelY;
    
    // Temporary for position update (word arithmetic)
    let newY: sword = sword(playerY) + sword(newVelY);
    if (newY >= 0) {
        playerY = word(newY);
    }
}

// SFA frame for applyGravity:
//   newVelY: 1 byte (sbyte)
//   newY:    2 bytes (sword)
//   Total: 3 bytes
// ACCEL: inlined — 0 bytes in frame
```

### Example 3: Definite-Assignment Analysis

```blend65
module Search;

function findItem(target: byte): byte {
    let foundIndex: byte;              // INDETERMINATE — will be assigned in loop
    let found: boolean = false;

    for (let i: byte = 0 to 63) {
        if (inventory[i] == target) {
            foundIndex = i;            // INITIALIZED on this path
            found = true;
            break;
        }
    }

    if (found) {
        return foundIndex;             // ⚠️ W10190: 'foundIndex' may not be initialized
                                       // (compiler doesn't know break was taken)
    }
    return 255;                        // sentinel for "not found"
}

// Fix: initialize foundIndex to avoid the warning
function findItemFixed(target: byte): byte {
    let foundIndex: byte = 255;        // INITIALIZED — default "not found"

    for (let i: byte = 0 to 63) {
        if (inventory[i] == target) {
            foundIndex = i;
            break;
        }
    }
    return foundIndex;                 // ✅ no warning — always initialized
}
```

### Example 4: Const vs Let — The Full Picture

```blend65
module Demo;

// === MODULE LEVEL ===

// Scalar const — inlined everywhere (like EQU in assembly)
const VERSION: byte = 3;              // zero RAM, zero ROM storage

// Array const — placed in data section (like .byte in assembly)
const LOOKUP: byte[4] = [0, 64, 128, 192];  // 4 bytes in data section

// Struct const — placed in data section
struct Config {
    width: byte;
    height: byte;
    color: byte;
}
const DEFAULT_CONFIG: Config = { width: 40, height: 25, color: 14 };

// Let with init — generates LDA/STA at startup
let currentLevel: byte = 1;           // 4 bytes init code

// Let without init — just reserves RAM
let scratchpad: byte[32];             // 0 bytes init code, 32 bytes RAM

function main(): void {
    // === FUNCTION LEVEL ===
    
    // Local const — inlined (same as module-level const)
    const BORDER: byte = 1;
    
    // Local let with init — runtime expression OK here
    let startAddr: word = word(currentLevel) * 256;
    
    // Local let without init — tracked for use-before-init
    let result: byte;
    
    // Using all of these:
    if (currentLevel <= VERSION) {
        result = LOOKUP[currentLevel];  // ✅ const array access + initialized var
    } else {
        result = 0;
    }
    // result is INITIALIZED on all paths — no warning
}
```

---

## Language Guard Evaluation

### Platform Universality (P)

| Rule | Status | Notes |
|------|--------|-------|
| P1 Cross-platform compilable | ✅ | `let` and `const` compile to standard memory operations on all 6502 platforms |
| P2 Platform-meaningful | ✅ | Variable declarations are essential on every platform |
| P3 No platform assumptions | ✅ | No addresses, chip names, or platform references. Memory placement is via platform profile (F005) |
| P4 Resource-scalable | ✅ | Build summary reports exact RAM/ROM cost. Compiler warns on resource limits |

### Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅ | `let` = LDA/STA init + reserved RAM. `const` scalar = inlined literal. `const` array = .byte data. All standard 6502 |
| H2 Cost transparency | ✅ | Every declaration's cost is documented: init code bytes/cycles, RAM cost, ROM cost. Build summary shows totals |
| H3 SFA compatible | ✅ | Module-level variables at fixed addresses. Function-local variables in SFA frames. Compile-time allocation |
| H4 Memory footprint documented | ✅ | Scalar const: 0 RAM/0 ROM. Let with init: N bytes RAM + init code ROM. Let without init: N bytes RAM + 0 ROM. Const array: 0 RAM + N bytes ROM |
| H5 Fully deterministic | ✅ | Indeterminate variables are safe to read (some byte 0-255). Wrapping overflow is defined. No undefined behavior. W10190 warns on likely bugs |

### Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅ | `let name: type [= expr];` and `const name: type = expr;` — clear, parseable, no ambiguity |
| L2 Consistent with existing | ✅ | Same `name: type` annotation style as F016. Same `const` keyword as F014 params. Same block scoping as F013 |
| L3 Beginner-friendly | ✅ | `let`/`const` is familiar from JavaScript/TypeScript. Type annotations match TypeScript style |
| L4 Minimal feature | ✅ | Two keywords (`let`, `const`), simple rules. No `var`, no `static`, no `readonly`, no `final` |
| L5 No redundancy | ✅ | `let` and `const` serve distinct purposes with no overlap. No other declaration mechanism |
| L6 Error messages defined | ✅ | 3 new errors (E10190-E10192), 1 new warning (W10190), 1 new error in F004 (E10023), plus 8 existing applicable errors |
| L7 Compile-time failure preferred | ✅ | All errors are compile-time. W10190 (use-before-init) catches the most common runtime bug at compile time |
| L8 Feature interaction documented | ✅ | Interactions with all 12 related features explicitly documented |
| L9 Documentable with examples | ✅ | 4 examples: game variables, function locals, definite-assignment, const vs let |

### Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅ | `KW_LET`, `KW_CONST` tokens. Standard recursive descent parsing. One declaration per statement — simple grammar |
| C2 Semantic analysis defined | ✅ | Type checking (F016), const-expression evaluation, definite-assignment analysis, scope tracking (F013), shadowing check (E10101) |
| C3 Code generation strategy | ✅ | Module-level: init sequence (LDA/STA) + BSS reservation. Function-level: SFA frame allocation. Const: inline or data section |
| C4 Unit testable | ✅ | Lexer: keyword tokens. Parser: let_decl/const_decl AST nodes. Semantic: const-eval, definite-assignment. Codegen: init sequence, frame layout |
| C5 Runtime verifiable | ✅ | Compile programs, run in emulator, verify: initialized variables have correct values, const arrays in correct ROM locations, SFA frame allocation |

### Future-Proofing (F)

| Rule | Status | Notes |
|------|--------|-------|
| F1 Extensible | ✅ | Can add `readonly` (runtime-immutable) later without breaking `const` (compile-time). Can add `static` for persistent locals. Neither requires changes to existing syntax |
| F2 Platform-profile ready | ✅ | RAM regions, data section mapping, and zeropage ranges all come from platform profile. No hardcoded addresses |
| F3 Optimizer-friendly | ✅ | `const` = always inlineable. Dead variable elimination possible for unused `let`. Definite-assignment analysis enables live-range optimizations |
| F4 Stability classification | ✅ | **Stable** — `let`/`const` with explicit types is a fundamental language construct that will not change |

**Verdict: ✅ ACCEPTED — all 23 rules pass**
