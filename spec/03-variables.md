# Chapter 03 — Variables & Constants

> **Version**: 4.0
> **Status**: draft  
> **Stability**: stable  
> **Source**: F019, F005

---

## 1. Overview

Variables and constants are the primary way to store data in Blend65. This chapter governs
declaration syntax, initializer value and omission semantics, mutability, and declaration-level
placement. Chapter 10 governs cross-module startup dependency/effect scheduling. The selected
platform appendix governs bootstrap and return epilogue behavior.

Blend65 provides three declaration forms:

- **`let`** — declares a mutable variable. Can be reassigned after initialization.
- **`const`** — declares a compile-time constant. It must have a compile-time constant initializer.
  Scalars are normally inlined (zero storage cost); aggregates and explicitly placed scalars live
  in the data/ROM section.
- **`loadable const`** — declares compile-time-known packaged data that has no resident address and
  can reach mutable storage only through a selected-profile load operation.

The **`zeropage` block** provides fast-access storage in the 6502's zero-page region.

---

## 2. Declaration Syntax

### 2.1 `let` — Mutable Variables

```ebnf
let_decl = [ "export" ] , [ place_clause ] , "let" , identifier , ":" , value_type
           , [ "=" , expression ] , ";" ;
```

```blend65
let score: word = 0;
let playerX: byte;              // uninitialized — indeterminate value
let active: boolean = true;
let velocity: sbyte = -2;
```

### 2.2 `const` — Compile-Time Constants

```ebnf
const_decl = [ "export" ] , [ place_clause ] , "const" , identifier , ":" , value_type
             , "=" , const_expression , ";" ;
```

`export` is available only on module-level declarations. The statement grammar uses the same
declaration forms without that prefix for function-local storage.

```blend65
const MAX_ENEMIES: byte = 8;
const GRAVITY: sbyte = 1;
const SCREEN_ADDR: word = $0400;
const SINE_TABLE: byte[256] = [0, 3, 6, 9, /* ... */];
const DEFAULT_ENEMY: Enemy = { x: 0, y: 0, hp: 100, enemyType: 0, frame: 0 };
```

### 2.3 `loadable const` — Packaged Constants

```ebnf
loadable_const_decl = [ "export" ] , "loadable" , "const" , identifier
                    , ":" , value_type , "=" , const_expression , ";" ;
```

A loadable constant has an exact compile-time scalar, fixed-array, or fixed-struct type and an exact
initializer value. It denotes a packaged load unit, not resident CPU-readable storage. It may be
declared wherever an ordinary `const` is legal; local scope changes only its qualified declaration
identity and does not allocate a function home. `export` remains module-level only.

```blend65
loadable const LEVEL_2: LevelData = buildLevel(
    embed("level2.ctm", "map"),
    embed("level2.ctm", "charset"),
    embed("level2.ctm", "colors")
);
const LEVEL_2_BYTES: word = sizeof(LevelData); // compile-time query is legal
```

The compiler retains the declaration's type, size, extent, and provenance. Source may apply
supported compile-time queries and may pass the declaration as the first argument of a compatible
selected-profile load operation. It may not otherwise read, index, address, mutate, cast, compare,
store, return, iterate, or pass the value. The load operation writes an exactly typed mutable
destination; it never turns the loadable declaration itself into resident storage.

### 2.4 `zeropage` Block — Fast-Access Variables

```ebnf
zeropage_block = "zeropage" , "{" , zeropage_var , { zeropage_var } , "}" ;
zeropage_var   = [ "export" ] , [ place_clause ] , identifier , ":" , value_type
               , [ "=" , expression ] , ";" ;
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

A `let` variable may be declared without an initializer. Its value is **indeterminate** until
assigned. Reading a function-local mutable variable before its first assignment triggers W10190.
Module-level storage is exempt because the compiler cannot generally prove whether platform startup,
external code, or hardware-visible activity established the stored bits before the read.

```blend65
let temp: byte;           // ⚠️ W10190 if a function-local read occurs before assignment
temp = calculate();       // now initialized
let value: byte = temp;   // ✅ safe after assignment
```

### VAR-3 — `const` Initialization Is Mandatory

A `const` must have an initializer, and the initializer must be a **compile-time constant expression** (→ Ch 04, §10).

```blend65
const MAX: byte = 8;               // ✅ literal
const DOUBLE: byte = MAX * 2;      // ✅ const expression
const SIZE: word = length(TABLE);  // ✅ length() of fixed const array is compile-time
const BAD: byte;                   // ❌ E10190: const must be initialized
const BAD2: byte = someFunction(); // ❌ E10191: initializer is not compile-time constant
```

### VAR-4 — `const` Cannot Be Reassigned

```blend65
const MAX: byte = 8;
MAX = 10;             // ❌ E10192: cannot assign to const
MAX += 1;             // ❌ E10192: cannot assign to const
```

### VAR-5 — Scope Rules

| Context | Scope |
|---------|-------|
| Module-level `let`/`const` | Visible throughout the module (after declaration point irrelevant — see VAR-6) |
| Module-level `zeropage` block | Same as module-level `let` — visible throughout module |
| Function-local `let`/`const` | Block-scoped (→ Ch 05, §2.3) |
| For-header local declaration | Scoped to the complete for statement: condition, update, and body (→ Ch 05, §7.3) |

A function's parameters and its outermost body declarations share one duplicate-name domain. A
nested block or loop body is a child scope.

### VAR-6 — Declaration Order Independent

Module-level declarations can reference each other regardless of source order. The compiler resolves all module-level declarations in a first pass. Function-local declarations follow lexical order within the function body.

```blend65
let x: byte = MAX;        // ✅ MAX is resolved in first pass
const MAX: byte = 10;
```

### VAR-7 — Lexical Shadowing

An ordinary declaration in a child scope may reuse a name from an enclosing module, function,
loop, or block scope (→ Ch 05, §2.4). Lookup selects the nearest visible declaration. The new
declaration becomes visible only after its initializer completes, so its initializer may read the
previously visible outer declaration. Leaving the child scope restores the outer declaration.

```blend65
let score: word = 0;

function update(): void {
    let score: word = score + 100;  // right side reads the module declaration
    poke($0400, byte(score));       // reads the local declaration
}
```

Shadowing changes only name resolution. Every declaration receives a stable identity used by
definite-assignment analysis, SFA liveness and homes, optimization, language tooling, and debug
evidence. Two live declarations with the same spelling have the same target cost as an otherwise
identical program that renames one of them. Keywords, reserved intrinsic names, and the special
`main` contract remain unavailable under their dedicated rules.

### VAR-8 — No Duplicate Declarations in Same Scope

Two declarations with the same name in the same scope produce E10003. Function parameters and the
function's outermost body share one scope for this rule.

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
| `loadable const X: T = value;` | Package only | Immutable | No resident address or SFA home; loaded explicitly into compatible mutable storage |

### 4.2 Scalar Constant Inlining

An unplaced scalar `const` (`byte`, `sbyte`, `word`, `sword`, `boolean`, or enum) is **inlined**: the
constant name is replaced by its value at every use site and the declaration allocates no storage.
Applying `place(...)` deliberately materializes read-only storage and makes the declaration
addressable.

```blend65
const MAX: byte = 8;
let i: byte = MAX;    // compiles as: LDA #8 / STA i
```

### 4.3 Aggregate Constant Placement

Aggregate `const` values (arrays, structs) are placed in the **data section**. The selected C64
profile maps that section into its declared artifact and memory layout.

```blend65
const TABLE: byte[4] = [10, 20, 30, 40];    // 4 bytes in data section
const DEFAULT: Enemy = { x: 0, y: 0, hp: 100, enemyType: 0, frame: 0 }; // 5 bytes in data section
```

### 4.4 Closed `place(...)` Modifier

Automatic placement is the default. Expert code may add one closed modifier immediately before a
module-level stored-data or emitted-function declaration; `export` comes first when present.

```ebnf
place_clause = "place" , "(" , place_arg , { "," , place_arg } , ")" ;
place_arg    = "at" , ":" , const_expression
             | "align" , ":" , const_expression
             | "noCross" , ":" , const_expression
             | "region" , ":" , qualified_name ;
```

```blend65
place(at: $2000) let bitmap: byte[8000];
place(align: 256, noCross: 4096) const TABLE: byte[256] = makeTable();
export place(region: c64.vic.bank1, align: 2048) const CHARSET: byte[2048] =
    embed("level.ctm", "charset");
place(at: $9000) function decodeRow(source: const byte[]): void { /* ... */ }
```

The key set is exactly `at`, `align`, `noCross`, and `region`; a key may occur at most once. `at`,
`align`, and `noCross` take compile-time integers. The latter two must be positive powers of two.
`region` takes a typed region symbol exported by the selected profile, not a string. One clause may
combine compatible constraints:

- `at` fixes the first byte's address;
- `align` requires that address to be a multiple of its value;
- `noCross` requires the complete object to fit within one naturally aligned window of its value;
- `region` requires the complete object to fit the named profile region.

The modifier may appear on a module-level `let`, an ordinary `const`, an ordinary function, or an
interrupt function. It may also refine an item inside `zeropage`; in that form it appears after an
optional `export` and before the item name. A placed scalar `const` is materialized and addressable
instead of inlined. It is illegal on locals, parameters, fields, types, `comptime function`,
`loadable const`, or compiler-owned SFA homes because none is a source-placeable emitted object.

Explicit constraints only strengthen automatic profile, asset, visibility, banking, alignment,
ownership, and reserved-range facts. Requirements attached to canonical aliases are combined. A
conflict or unavailable region is an error; the compiler does not copy the object, waive a profile
rule, or create hidden storage.

### 4.5 Zeropage Budget

The platform profile defines how many zero-page bytes are available (→ Ch 15). The compiler tracks total ZP usage across all modules. Exceeding the budget → E10032.

| Qualified family | Default-profile ZP budget | Profile range |
|------------------|---------------------------|---------------|
| C64 | 142 bytes | `$02`–`$8F` |

These are the exact current default profiles, not general hardware maxima. A custom profile may
choose a different proven-safe range and budget.

The compiler also uses ZP bytes internally for expression evaluation temps and struct/array pointer temps (→ Ch 06, §7.6; → Ch 07, §5.8). These are in addition to user-declared ZP variables.

### 4.6 Load Publication and Definite Initialization

A selected-profile load operation such as
`c64.loader.load(unit, destination): boolean` evaluates both arguments exactly once. The first
argument must name a compatible `loadable const`. The second may be any lifetime-valid, addressable,
mutable place of exactly the same fixed logical type: a module variable, local, mutable parameter,
field, nested field, fixed-array element, or composition of those forms. Constants, temporaries,
MMIO, expired locals, unsized arrays, and destinations with an unproved complete interval are not
valid destinations.

The compiler captures the evaluated destination's physical half-open byte range and provenance.
This capture is a compile-time flow fact, not a runtime descriptor:

- entering the call makes only the captured range indeterminate because a transfer may be partial;
- the `true` result edge initializes exactly that range with the unit's logical value;
- the `false` edge leaves exactly that range indeterminate;
- ranges proved not to alias the capture keep their incoming state; and
- a later read must be definitely initialized on every reaching path. A read that relies on this
  load's value must also be proved to refer to the same captured range on every reaching path.

The correlation follows the returned boolean through a stored result, branches, joins, and loops.
Each call has a fresh identity. A later overlapping call invalidates its captured overlap before it
can publish a replacement. Ordinary complete assignment may establish a separate initialization
fact. Analysis is sparse and range-based; it does not create a runtime flag, token, bitmap,
validity byte, handle, or read check.

```blend65
let currentLevel: LevelData;

function enterLevel(): boolean {
    if (!c64.loader.load(LEVEL_2, currentLevel)) {
        return false;                 // currentLevel is indeterminate here
    }
    drawLevel(currentLevel);          // ✅ success dominates this exact range
    return true;
}
```

Dynamic destinations retain the once-evaluated choice:

```blend65
let slots: LevelData[2];
let slot: byte = chooseSlot();
let loaded: boolean = c64.loader.load(LEVEL_2, slots[slot]);

if (loaded) {
    drawLevel(slots[slot]);            // ✅ if slot is unchanged and therefore must-aliases
    slot = slot ^ 1;
    drawLevel(slots[slot]);            // ❌ E10276: may name a different range
}
```

Failure invalidates only the selected candidate:

```blend65
let readySlots: LevelData[2] = [EMPTY_LEVEL, EMPTY_LEVEL];
let selected: byte = chooseFirst ? 0 : 1;

if (!c64.loader.load(LEVEL_2, readySlots[selected])) {
    drawLevel(readySlots[selected]);    // ❌ E10276: selected range may be partial
    if (selected == 0) {
        drawLevel(readySlots[1]);       // ✅ proved unselected; incoming value preserved
    } else {
        drawLevel(readySlots[0]);       // ✅ proved unselected; incoming value preserved
    }
}
```

The following cases define joins, loops, replacement, and partial overlap without introducing a
separate load-state language:

| Case | Result |
|------|--------|
| Both arms successfully load the same proved range | The joined range is initialized; the loaded unit is known only if both arms publish the same unit. |
| One reaching arm fails or skips the load | The joined captured range is not definitely initialized unless its incoming state was preserved by a must-not-alias choice. |
| A loop may execute zero times | The loop alone does not initialize its destination. A fixed covering loop proves only the complete byte ranges covered on every path. |
| A second load targets the same range | The second call gets a fresh identity; success publishes the second unit and failure leaves that range indeterminate. |
| A later load targets one field | That field may be published. Reading an enclosing object still requires all remaining bytes to be initialized. |
| A destination may alias a captured range | It receives no whole-value credit unless must-alias is proved; a partial overlap retains only byte facts true for every candidate. |
| A candidate is proved unselected | Its prior initialization state is unchanged on both result edges. |

---

## 5. Startup Sequence

### 5.1 Initialization Order

Module-level `let` variables with initializers are evaluated once by compiler-generated startup code
before `main()`. An initializer may use any otherwise legal non-`void` expression, including
statically resolved ordinary function calls and assignment expressions. `const` initializers remain
compile-time expressions and generate no startup evaluation. Chapter 10, §5.4 owns dependency,
effect-order, cycle, and cross-module scheduling rules.

1. Evaluate module and zeropage `let` initializers in the Chapter 10 schedule.
2. Convert each result to the declared type and perform its implicit final store.
3. Fall through to `main()`.

Uninitialized variables (`let x: byte;`) generate **no startup code** — their memory contains whatever was there before.

### 5.2 Startup Cost

| Item | ROM Cost | Cycle Cost |
|------|----------|------------|
| Constant byte initializer | 5 bytes to absolute storage; 4 bytes to zero page | 6 cycles absolute; 5 cycles zero page |
| Constant word initializer | 10 bytes/12 cycles for two distinct bytes to absolute storage; 8 bytes/10 cycles when one loaded byte is reused for both stores | Zero-page stores save 1 byte and 1 cycle per stored byte |
| Runtime expression/call | Generated expression and call sequence | Exact, bounded range/formula, or `runtime-dependent` |
| Struct initializer (N bytes) | Sum of selected field-expression and store sequences | Exact emitted total; repeated values may share loads |
| Fill array (N bytes) | Selected loop or unrolled sequence | Exact emitted total, including index/setup/branch cost |
| Explicit array (N values) | Sum of selected element-expression and store sequences | Exact emitted total; repeated values may share loads |
| Uninitialized variable | 0 bytes | 0 cycles |

The compiler reports startup ROM, SFA/RAM/ZP, callees/helpers, and cycle cost in the build summary.

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
    STA _score          ; LDA+STA abs: 5 bytes ROM, 6 cycles

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
    STA _totalScore+1   ; two LDA+STA abs pairs: 10 bytes ROM, 12 cycles
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

## 7. Diagnostic Conditions

This chapter owns the trigger predicates below. Chapter 14 alone owns public severities, message
templates, spans, suppression, and history.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10003 | A declaration duplicates a name in the same scope. | The second declaration is rejected. |
| E10030 | A module contains a second `zeropage` block. | The second block is rejected; declarations must be combined into the first block. |
| E10031 | A `const` declaration appears inside `zeropage`. | The declaration is rejected; constants remain module-level compile-time declarations. |
| E10032 | Requested zero-page storage exceeds the selected profile's allocatable range. | Placement fails. |
| E10033 | A declaration inside `zeropage` begins with `let`, `const`, or another unexpected keyword instead of the block's `[export] name: type [= expression];` form. | The declaration is rejected. |
| E10150 | A declaration omits its required type annotation. | The declaration is rejected. |
| E10190 | A `const` declaration has no initializer. | The declaration is rejected. |
| E10191 | A `const` initializer is not a compile-time constant expression. | The declaration is rejected. |
| E10192 | An assignment target is a `const` declaration. | No store is generated. |
| E10272 | A `place(...)` modifier has an illegal owner, key, duplicate key, value, or selected-profile region. | The declaration is rejected before layout. |
| E10273 | The combined explicit, profile, asset, visibility, banking, ownership, alignment, or reserved-range constraints cannot be satisfied. | Placement fails without copying or weakening a requirement. |
| E10274 | Source uses a `loadable const` as an ordinary resident value. | The use is rejected; the declaration retains no resident address. |
| E10275 | A load operation's unit, selected profile, or destination does not prove the required exact type, complete mutable interval, lifetime, alignment, visibility, and nonoverlap. | The load call is rejected. |
| E10276 | A read cannot prove complete initialization on every reaching path or cannot must-alias the successful captured range whose value it claims. | The read is rejected; no runtime check is inserted. |

For E10276, the read is the primary span. Related spans identify the governing load and the exact
mutation, join, failure edge, or alias fact that breaks the must-alias success proof.

### Warning Conditions

| Code | Trigger | Consequence |
|------|---------|-------------|
| W10190 | A control-flow path may read a function-local mutable variable before its first assignment. Module-level storage is exempt from this warning. | The read receives the variable's indeterminate stored bits. |
| W10191 | A variable is declared but never used. | No semantic change; the declaration may be unnecessary. |
| W10030 | Allocated zero-page usage reaches the selected profile's `warn_zp_percent`, or 75% of `max_zp` when omitted. | Compilation continues with the measured allocation. |

---

## 8. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Type system** (→ Ch 02) | All declarations require explicit type annotations (TS-1). Assignment follows type compatibility. Literal type rules (TS-2) apply to initializers. |
| **Operators** (→ Ch 04) | Compound assignment (`+=`, `-=`, etc.) on `let` variables. Not allowed on `const` (E10192). |
| **Control flow** (→ Ch 05) | Block scoping permits ordinary nested shadowing. Same-scope duplicates remain E10003. A for-header declaration is scoped to the complete for statement and its body is a child scope. |
| **Functions** (→ Ch 06) | Function-local variables are stored in the SFA frame. Parameters and outermost-body declarations share one duplicate-name domain; nested declarations have distinct stable identities. Block-scoped locals with non-overlapping lifetimes may share frame memory. Parameters are like `let` (mutable) unless marked `const`. |
| **Structs** (→ Ch 07) | Struct instances can be `let` or `const`. Const structs placed in data section. |
| **Arrays** (→ Ch 08) | Array `let`/`const` controls element mutability. Const arrays must be fully initialized (E10113). |
| **Enums** (→ Ch 09) | Enum-typed `let`/`const` occupy 1 byte. Const enum values are inlined. |
| **Modules** (→ Ch 10) | Module-level `let`/`const`/`loadable const`/`zeropage` declarations. `export` makes them visible to other modules. |
| **Memory model** (→ Ch 11) | `let` → RAM segment. Unplaced scalar `const` → inlined. Aggregate and placed scalar `const` → data/ROM. `loadable const` → package only. `zeropage` → ZP range. SFA frame allocation for function locals. |
| **Data inclusion** (→ Ch 13) | `embed()` may initialize resident `const` data or a `loadable const`; only the resident form receives a target address during the initial image layout. |
| **Platform profiles** (→ Ch 15) | Profiles export typed placement regions and may expose a load operation. Core syntax supplies no generic loader or transport. |

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
