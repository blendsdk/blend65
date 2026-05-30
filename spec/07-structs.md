# Chapter 07 — Structs

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F011

---

## 1. Overview

Structs group related data fields into a single named type. Under SFA (→ Ch 11), a struct is simply **contiguous bytes at a compile-time-known address** — no heap allocation, no runtime overhead beyond the actual field access.

```blend65
struct Enemy {
    x: byte;
    y: byte;
    hp: byte;
    enemyType: byte;
    frame: byte;
}
// Total size: 5 bytes, contiguous in memory
```

Key design principles:
- **No methods, no inheritance, no polymorphism** — this is data grouping, not OOP
- **Field order in memory matches declaration order** — no padding, no reordering
- **Structs are always passed to functions by reference** — compiler-managed, no `ref` keyword (→ Ch 06, FN-3)
- **No heap** — every struct instance has a fixed address determined at compile time
- **`sizeof(StructType)` provides compile-time size** (→ Ch 04, §9)

---

## 2. Struct Definition

### 2.1 Syntax

```ebnf
struct_decl  = [ "export" ] , "struct" , identifier
             , "{" , struct_field , { struct_field } , "}" ;

struct_field = identifier , ":" , type_expr , ";" ;
```

### 2.2 Field Types

Struct fields can be:

| Field Type | Example | Size |
|-----------|---------|------|
| `byte`, `sbyte` | `hp: byte;` | 1 byte |
| `word`, `sword` | `score: word;` | 2 bytes, little-endian |
| `boolean` | `active: boolean;` | 1 byte |
| Fixed-size array | `name: byte[3];` | Element size × count |
| Another struct | `pos: Position;` | Size of nested struct |

Fields **cannot** be:
- `void`
- Unsized arrays (`byte[]` without a size)
- The struct's own type (no self-reference — SR-7)
- A struct that directly or indirectly contains this struct (no circularity — SR-8)

### 2.3 Export Visibility

`export struct` makes the type available to other modules (→ Ch 10). Without `export`, the type is module-private:

```blend65
export struct Position { x: word; y: word; }   // visible to importers
struct InternalState { counter: byte; }         // module-private
```

---

## 3. Struct Rules

### SR-1 — Minimum One Field

A struct must have at least one field. Empty structs are a compile error.

```blend65
struct Empty { }  // ❌ E10090: struct must have at least one field
```

### SR-2 — Field Order Is Memory Order

Fields are laid out in memory in declaration order with **no padding**. The 6502 has no alignment requirements.

```blend65
struct Player {
    pos: Position;    // offset 0, 4 bytes (word x + word y)
    vel: Velocity;    // offset 4, 2 bytes (sbyte dx + sbyte dy)
    hp: byte;         // offset 6, 1 byte
    lives: byte;      // offset 7, 1 byte
    frame: byte;      // offset 8, 1 byte
}
// Total: 9 bytes, contiguous, no gaps
```

### SR-3 — Passed by Reference

When a struct is passed as a function parameter, the compiler automatically passes its memory address (→ Ch 06, FN-3). The function accesses fields through indirect addressing. There is no `ref` keyword — the compiler knows the type is a struct.

```blend65
function damage(e: Enemy, amount: byte): void {
    e.hp = e.hp - amount;   // modifies the ORIGINAL struct
}

let boss: Enemy = { x: 100, y: 50, hp: 200, enemyType: 0, frame: 0 };
damage(boss, 30);
// boss.hp is now 170 — modified in place
```

The `const` modifier prevents modification of by-reference struct parameters (→ Ch 08, const parameter rules):

```blend65
function display(const e: Enemy): void {
    let hp: byte = e.hp;     // ✅ read OK
    e.hp = 0;                // ❌ E10123: cannot modify const parameter
}
```

### SR-4 — Cannot Be Returned from Functions

Functions cannot have a struct as their return type (→ Ch 06, FN-4). Use a struct parameter instead:

```blend65
// ❌ E10093
function createEnemy(x: byte, y: byte): Enemy { }

// ✅ Use a parameter — the caller provides the destination
function initEnemy(e: Enemy, x: byte, y: byte): void {
    e.x = x;
    e.y = y;
    e.hp = 100;
    e.enemyType = 0;
    e.frame = 0;
}

let boss: Enemy;
initEnemy(boss, 100, 50);
```

**Rationale**: Returning a struct would require copying all bytes from the function's frame to the caller. By-reference parameter avoids this copy entirely.

### SR-5 — No Struct Equality

Structs cannot be compared with `==` or `!=`. Compare fields individually:

```blend65
// ❌ E10095
if (a == b) { }

// ✅ Compare fields explicitly
if (a.x == b.x && a.y == b.y && a.hp == b.hp) { }
```

**Rationale**: Byte-by-byte comparison is expensive and the cost is hidden. Explicit field comparison is transparent (Language Guard H2).

### SR-6 — No Self-Referencing Structs

A struct cannot contain a field of its own type. Linked lists are not possible under SFA.

```blend65
struct Node {
    value: byte;
    next: Node;    // ❌ E10091: struct cannot contain itself
}
```

### SR-7 — No Circular Dependencies

Struct A cannot contain struct B if B directly or indirectly contains struct A:

```blend65
struct A { b: B; }    // ❌ E10092: circular struct dependency
struct B { a: A; }
```

### SR-8 — Composition (Nested Structs)

Structs can contain fields of other struct types. Fields are inlined — no pointers, no indirection:

```blend65
struct Position { x: word; y: word; }
struct Velocity { dx: sbyte; dy: sbyte; }
struct Player {
    pos: Position;    // 4 bytes inlined
    vel: Velocity;    // 2 bytes inlined
    hp: byte;
}
// Player is 7 bytes contiguous
```

---

## 4. Struct Instances

### 4.1 Declaration Contexts

| Location | Example | SFA Behavior |
|----------|---------|-------------|
| Module-level `let` | `let player: Player;` | Permanent address in RAM. Always alive. |
| Module-level `const` | `const DEFAULT: Enemy = { ... };` | Permanent address in ROM/data. Read-only. |
| Function-local `let` | `let temp: Enemy;` | Address in function's static frame. Reusable when function isn't active. |
| `zeropage` block | `zeropage { pos: Position; }` | Address in zero-page range. Fast access. |
| Array element | `let enemies: Enemy[8];` | Base + (index × struct size). Fixed base, variable offset. |

### 4.2 Struct Literals (Initialization)

Struct literal syntax uses curly braces with **all** fields in declaration order:

```blend65
let player: Player = {
    pos: { x: 160, y: 100 },
    vel: { dx: 0, dy: 0 },
    hp: 100,
    lives: 3,
    frame: 0
};

const DEFAULT_ENEMY: Enemy = { x: 0, y: 0, hp: 100, enemyType: 0, frame: 0 };
```

**Rules:**
- **All fields must be listed** — no partial initialization (Axiom A4: explicit over implicit). Missing field → E10096.
- **Fields must be in declaration order** — wrong order → E10097.
- Uninitialized struct (`let e: Enemy;` without initializer): indeterminate value (same as any `let` without initializer).
- Field assignment after declaration is always allowed: `enemy.x = 50;`.

### 4.3 Field Access

Dot notation, chainable for nested structs:

```blend65
player.hp = 100;
player.pos.x = 160;
enemies[3].hp = enemies[3].hp - damage;
```

### 4.4 Struct Assignment (Copy)

Assigning one struct to another copies all bytes:

```blend65
let backup: Enemy = boss;   // copies all 5 bytes
boss = backup;               // restores from backup
```

**Cost**: ~4N cycles for an N-byte struct (N × LDA + STA).

### 4.5 Passing Nested Struct Fields

A nested struct field can be passed to a function expecting that struct type. The compiler calculates the address:

```blend65
function updatePosition(pos: Position): void {
    pos.x = pos.x + 1;
}
updatePosition(player.pos);  // ✅ compiler calculates &player + offset_of(pos)
```

### 4.6 Address-of for Structs

`&structVar` returns the base address as a `word` (→ Ch 04, §8):

```blend65
let addr: word = &player;   // ✅ base address of the struct
```

Taking the address of individual struct **fields** (`&player.hp`) is deferred to a future version.

### 4.7 Aliasing

If the same struct is passed as two separate parameters, modifications through one affect the other. This is documented behavior, not prevented:

```blend65
function swap(a: Enemy, b: Enemy): void { }
swap(boss, boss);  // ⚠️ both a and b point to same memory — aliasing
```

The compiler may emit **W10112** for obvious cases (same variable passed twice) but cannot catch all aliasing.

---

## 5. Code Generation

### 5.1 Direct Field Access (Module-Level Struct)

```blend65
let player: Player;    // compiler assigns to e.g. $0400
player.hp = 100;
```

```asm
; player.hp at offset 6 from base $0400
    LDA #100
    STA $0406           ; direct absolute addressing — 4 cycles
```

### 5.2 By-Reference Field Access (Function Parameter)

```blend65
function damage(e: Enemy, amount: byte): void {
    e.hp = e.hp - amount;
}
```

```asm
; e is passed via ZP pointer at $FB/$FC
damage:
    LDY #2              ; offset of hp field
    LDA ($FB),Y         ; load e.hp — 5 cycles
    SEC
    SBC amount          ; subtract damage
    STA ($FB),Y         ; store e.hp — 6 cycles
    RTS
```

### 5.3 Call Site — Passing Struct by Reference

```blend65
damage(boss, 30);
```

```asm
; Set up ZP pointer to boss (at $0400)
    LDA #<$0400         ; low byte
    STA $FB             ; ZP pointer low
    LDA #>$0400         ; high byte
    STA $FC             ; ZP pointer high
    LDA #30             ; amount parameter
    STA param_amount
    JSR damage
; Total call overhead: ~16 cycles, 10 bytes
```

### 5.4 Array of Structs — Constant Index

```blend65
enemies[3].hp = 50;    // enemies at $0500, Enemy is 5 bytes
```

```asm
; Address = $0500 + (3 × 5) + 2 = $0500 + 17 = $0511
    LDA #50
    STA $0511           ; compile-time calculated — 4 cycles
```

### 5.5 Array of Structs — Variable Index

```blend65
enemies[i].hp = 50;    // requires runtime multiply
```

```asm
; Address = base + (i × 5) + 2
; Multiply i by 5: i×5 = i×4 + i = (i<<2) + i
    LDA i
    ASL                 ; ×2
    ASL                 ; ×4
    CLC
    ADC i               ; ×4 + i = ×5
    CLC
    ADC #2              ; + offset of hp
    TAY
    LDA #50
    STA enemies,Y       ; absolute indexed — works if total < 256 bytes
; ~16 cycles for address calc + 5 cycles for store = ~21 cycles
```

For arrays larger than 256 bytes or struct sizes that aren't efficiently computable, the compiler uses a 16-bit address calculation with ZP pointer.

### 5.6 Nested Struct Access

```blend65
player.pos.x = 160;   // pos at offset 0, x at offset 0 within Position
```

```asm
; Offsets: pos=0, x within pos=0 → total offset = 0
    LDA #<160
    STA player+0        ; low byte of word
    LDA #>160
    STA player+1        ; high byte of word
; Offsets computed at compile time — same cost as flat struct
```

### 5.7 Struct Initialization

```blend65
let e: Enemy = { x: 100, y: 50, hp: 200, enemyType: 1, frame: 0 };
```

```asm
    LDA #100
    STA e+0             ; x
    LDA #50
    STA e+1             ; y
    LDA #200
    STA e+2             ; hp
    LDA #1
    STA e+3             ; enemyType
    LDA #0
    STA e+4             ; frame
; 10 instructions, ~20 cycles for a 5-byte struct
```

### 5.8 ZP Pointer Cost

Each function that receives a struct parameter needs **2 bytes of zero page** for the indirect addressing pointer. Under SFA, functions with non-overlapping lifetimes share ZP pointer bytes:

| Call Pattern | ZP Pointer Bytes |
|-------------|-----------------|
| Sequential calls: `f(s); g(s);` | 2 bytes (shared) |
| Nested calls: `f(s)` calls `g(s2)` | 4 bytes (2 per level) |
| Deep chain: `f → g → h`, all with struct params | 6 bytes |

The compiler tracks total ZP usage. E10032 fires if it exceeds the platform budget.

---

## 6. Cost Summary

| Operation | Cost | Notes |
|-----------|------|-------|
| Field access (direct) | 4 cycles | Absolute addressing, compile-time address |
| Field access (by-ref) | 5–6 cycles | Indirect indexed `(ptr),Y` |
| Call overhead (pass struct) | ~16 cycles | Set up ZP pointer + JSR |
| Array[const].field | 4 cycles | Compile-time address calculation |
| Array[var].field | ~21 cycles | Runtime index multiply + access |
| Struct init (N bytes) | ~4N cycles | N × (LDA + STA) |
| Struct copy (N bytes) | ~4N cycles | N × (LDA + STA) |
| `sizeof(Type)` | 0 cycles | Compile-time constant |
| ZP per active struct param | 2 bytes | Shared across non-overlapping functions |

---

## 7. Error Codes

All error codes defined in this chapter. The canonical registry is in → Ch 14.

| Code | Condition | Message |
|------|-----------|---------|
| E10090 | Empty struct | `Struct '<name>' must have at least one field` |
| E10091 | Self-referencing struct | `Struct '<name>' cannot contain a field of its own type — self-referencing structs are not allowed` |
| E10092 | Circular dependency | `Circular struct dependency: '<A>' contains '<B>' which contains '<A>'` |
| E10093 | Struct return type | `Cannot return struct type '<name>' from function — pass a struct parameter instead` |
| E10094 | Const struct to mutable param | `Cannot pass const struct '<name>' to mutable parameter — add 'const' to parameter or copy to a mutable variable` |
| E10095 | Struct comparison | `Cannot compare structs with '<op>' — compare individual fields instead` |
| E10096 | Missing field in literal | `Struct literal must initialize all fields — missing field '<field>'` |
| E10097 | Wrong field order in literal | `Struct literal fields must be in declaration order — expected '<expected>', found '<found>'` |

## Warning Codes

| Code | Condition | Message |
|------|-----------|---------|
| W10110 | Large struct in zeropage | `Struct '<name>' in zeropage uses <N> bytes — consider moving large structs to RAM` |
| W10111 | Expensive struct indexing | `Array of structs indexed by variable: struct size <N> is not a power of 2 — indexing requires multiply (~<cycles> cycles per access)` |
| W10112 | Possible aliasing | `Possible aliasing: parameter '<a>' and '<b>' may refer to the same struct` |

---

## 8. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Type system** (→ Ch 02) | Structs are a derived type. Field types follow all type rules. No implicit conversions between struct types. |
| **Variables** (→ Ch 03) | Struct instances declared with `let`/`const`. `zeropage` placement supported. |
| **Operators** (→ Ch 04) | No operators apply to structs directly (no `==`, no arithmetic). `sizeof` and `offsetof` are compile-time intrinsics. |
| **Functions** (→ Ch 06) | Always passed by reference (FN-3). Cannot be returned (FN-4, E10093). `const` modifier prevents mutation. |
| **Arrays** (→ Ch 08) | Fixed-size arrays as struct fields are supported. Arrays of structs use index × size addressing. |
| **Enums** (→ Ch 09) | Enum fields are valid in structs. Enum values are valid in struct literals. |
| **Modules** (→ Ch 10) | `export struct` makes the type importable. Without `export`, module-private. Type aliases are not available (REJ-001); use `import { X as Y }` to rename. |
| **Memory model** (→ Ch 11) | All struct instances have compile-time-known addresses under SFA. ZP pointer bytes shared via frame coloring. |
| **Switch** (→ Ch 05) | Structs are not valid as switch expression types (E10075). |
| **For loops** (→ Ch 05) | Structs as loop-local variables reuse the same frame slot per iteration. |
| **Address-of** (→ Ch 04) | `&structVar` returns base address as `word`. Address of individual fields deferred to future version. |
| **Interrupts** (→ Ch 06, §7) | Struct access inside interrupt handlers works. By-ref params use ZP pointers — ensure no conflict with main code's pointers (separate ZP temp space, → Ch 06, §7.6). |

---

## 9. Examples

### 9.1 Game Entity System

```blend65
module Entities;

struct Enemy {
    x: byte;
    y: byte;
    hp: byte;
    enemyType: byte;
    frame: byte;
}

let enemies: Enemy[8];
let enemyCount: byte = 0;

function spawnEnemy(e: Enemy, x: byte, y: byte, t: byte): void {
    e.x = x;
    e.y = y;
    e.hp = 100;
    e.enemyType = t;
    e.frame = 0;
}

function damageEnemy(e: Enemy, amount: byte): void {
    if (amount >= e.hp) {
        e.hp = 0;
    } else {
        e.hp = e.hp - amount;
    }
}

function updateAllEnemies(): void {
    for (let i: byte = 0 to enemyCount) {
        if (enemies[i].hp > 0) {
            enemies[i].frame += 1;
        }
    }
}
```

### 9.2 Nested Structs (Physics)

```blend65
module Physics;

struct Position {
    x: word;
    y: word;
}

struct Velocity {
    dx: sbyte;
    dy: sbyte;
}

struct Player {
    pos: Position;
    vel: Velocity;
    hp: byte;
    lives: byte;
}

let player: Player = {
    pos: { x: 160, y: 100 },
    vel: { dx: 0, dy: 0 },
    hp: 100,
    lives: 3
};

function applyVelocity(p: Player): void {
    let newX: sword = sword(p.pos.x) + sword(p.vel.dx);
    let newY: sword = sword(p.pos.y) + sword(p.vel.dy);
    if (newX >= 0 && newX < 320) {
        p.pos.x = word(newX);
    }
    if (newY >= 0 && newY < 200) {
        p.pos.y = word(newY);
    }
}
```

### 9.3 Direction Lookup Table

```blend65
module Movement;

struct Delta {
    dx: sbyte;
    dy: sbyte;
}

const DIRECTION_DELTAS: Delta[8] = [
    { dx:  0, dy: -1 },   // N
    { dx:  1, dy: -1 },   // NE
    { dx:  1, dy:  0 },   // E
    { dx:  1, dy:  1 },   // SE
    { dx:  0, dy:  1 },   // S
    { dx: -1, dy:  1 },   // SW
    { dx: -1, dy:  0 },   // W
    { dx: -1, dy: -1 }    // NW
];

function moveInDirection(e: Enemy, dir: byte): void {
    let delta: Delta = DIRECTION_DELTAS[dir];
    e.x = byte(sbyte(e.x) + delta.dx);
    e.y = byte(sbyte(e.y) + delta.dy);
}
```

### 9.4 High Score Table

```blend65
module Scores;

struct HighScoreEntry {
    name: byte[3];
    score: word;
}

let highScores: HighScoreEntry[5];

function insertScore(name0: byte, name1: byte, name2: byte, newScore: word): void {
    for (let i: byte = 0 to 5) {
        if (newScore > highScores[i].score) {
            // Shift entries down
            for (let j: byte = 4 downto i) {
                highScores[j] = highScores[j - 1];
            }
            // Insert new entry
            highScores[i].name[0] = name0;
            highScores[i].name[1] = name1;
            highScores[i].name[2] = name2;
            highScores[i].score = newScore;
            break;
        }
    }
}
```
