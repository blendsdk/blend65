# F011 — Structs

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F003 (module contents), F005 (memory placement), F010 (signed types)  
> **Interacts with**: F006 (address-of), F008 (for loop), F009 (switch)

---

## Description

Structs group related data fields into a single named type. Under SFA, a struct is simply **contiguous bytes at a compile-time-known address** — no heap allocation, no runtime overhead beyond the actual field access.

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

**Key design principles:**
- No methods, no inheritance, no polymorphism — this is data grouping, not OOP
- Field order in memory matches declaration order — no padding, no reordering
- Structs are always passed to functions by reference (compiler-managed, no `ref` keyword)
- No heap — every struct instance has a fixed address determined at compile time
- `sizeof(StructType)` provides compile-time size information

---

## Syntax

### Type Definition

```blend65
struct Name {
    field1: type;
    field2: type;
    ...
}
```

**EBNF:**
```ebnf
struct_decl = [ "export" ] , "struct" , identifier , "{" , struct_field , { struct_field } , "}" ;
struct_field = identifier , ":" , type_expr , ";" ;
```

### Field Types

Struct fields can be:

| Field Type | Example | Notes |
|-----------|---------|-------|
| `byte`, `sbyte` | `hp: byte;` | 1 byte |
| `word`, `sword` | `score: word;` | 2 bytes, little-endian |
| `boolean` | `active: boolean;` | 1 byte |
| Fixed-size array | `name: byte[3];` | Inline, contiguous |
| Another struct | `pos: Position;` | Nested composition |

Fields CANNOT be:
- `void`
- Dynamic arrays (no `byte[]` without size)
- The struct's own type (no self-reference — no linked lists under SFA)

### Instances

```blend65
// Module-level
let player: Player;
let enemies: Enemy[8];

// Function-local
function update(): void {
    let temp: Enemy;
    temp.x = 10;
}

// Zero page
zeropage {
    playerPos: Position;    // Fast access, uses ZP bytes
}

// Constants
const DEFAULT_ENEMY: Enemy = { x: 0, y: 0, hp: 100, enemyType: 0, frame: 0 };
```

### Initialization

Struct literal syntax uses curly braces with all fields in declaration order:

```blend65
let player: Player = {
    pos: { x: 160, y: 100 },
    vel: { dx: 0, dy: 0 },
    hp: 100,
    lives: 3,
    frame: 0
};
```

**Rules:**
- All fields must be listed — no partial initialization (A4: explicit over implicit)
- Fields must be in declaration order
- Uninitialized struct: indeterminate value (same as any `let` without initializer)
- Field assignment after declaration is always allowed: `enemy.x = 50;`

### Field Access

Dot notation, chainable for nested structs:

```blend65
player.hp = 100;
player.pos.x = 160;
enemies[3].hp = enemies[3].hp - damage;
```

### Struct Assignment (Copy)

Assigning one struct to another copies all bytes:

```blend65
let backup: Enemy = boss;   // Copies all 5 bytes
boss = backup;               // Restores from backup
```

Cost: 2 cycles per byte (LDA + STA). A 5-byte struct = ~10 cycles to copy.

---

## Rules

### SR-1: Structs Are Passed by Reference

When a struct is passed as a function parameter, the compiler automatically passes its memory address. The function accesses fields through indirect addressing. **No `ref` keyword needed — the compiler knows the type is a struct.**

```blend65
function damage(e: Enemy, amount: byte): void {
    e.hp = e.hp - amount;   // Modifies the ORIGINAL struct
}

let boss: Enemy = { x: 100, y: 50, hp: 200, enemyType: 0, frame: 0 };
damage(boss, 30);
// boss.hp is now 170 — modified in place
```

**What the developer must know:**
- Primitives (`byte`, `word`, etc.) are passed **by value** — changes inside the function don't affect the caller
- Structs are passed **by reference** — changes inside the function DO affect the caller's data
- This is the 6502's natural pattern: set up a pointer, access fields via `(ptr),Y`

### SR-2: Structs Cannot Be Returned from Functions

Functions cannot have a struct as their return type. Use a struct parameter instead:

```blend65
// ❌ Not allowed
function createEnemy(x: byte, y: byte): Enemy { ... }

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

### SR-3: Const Structs Cannot Be Passed as Parameters

Since all struct parameters are by-reference and functions can modify them, passing a `const` struct would risk writing to ROM.

```blend65
const DEFAULT_ENEMY: Enemy = { x: 0, y: 0, hp: 100, enemyType: 0, frame: 0 };

damage(DEFAULT_ENEMY, 5);  // ❌ E10094: Cannot pass const struct as parameter

// ✅ Copy to mutable variable first
let temp: Enemy = DEFAULT_ENEMY;
damage(temp, 5);
```

### SR-4: No Struct Equality

Structs cannot be compared with `==` or `!=`. Compare fields individually:

```blend65
// ❌ Not allowed
if (a == b) { ... }

// ✅ Compare fields explicitly
if (a.x == b.x && a.y == b.y && a.hp == b.hp) { ... }
```

**Rationale**: Byte-by-byte comparison is expensive and the cost is hidden. Explicit field comparison is transparent (H2).

### SR-5: Field Order Is Memory Order

Fields are laid out in memory in declaration order with no padding:

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

The 6502 has no alignment requirements, so no padding is needed.

### SR-6: Array Indices Must Be Unsigned

When indexing an array of structs, the index must be `byte` or `word` (unsigned):

```blend65
let enemies: Enemy[8];
let i: byte = 3;
enemies[i].hp = 50;      // ✅ byte index
enemies[sbyte(3)].hp = 50; // ❌ E10085: signed index not allowed
```

### SR-7: sizeof Operator

`sizeof(Type)` returns the byte size of any type as a compile-time constant:

```blend65
const ENEMY_SIZE: byte = sizeof(Enemy);     // 5
const PLAYER_SIZE: byte = sizeof(Player);   // 9
const BYTE_SIZE: byte = sizeof(byte);       // 1
const WORD_SIZE: byte = sizeof(word);       // 2
```

This is a compile-time operator — the compiler substitutes the literal value. Zero runtime cost.

### SR-8: Minimum One Field

A struct must have at least one field. Empty structs are a compile error:

```blend65
struct Empty { }  // ❌ E10090: Struct must have at least one field
```

---

## SFA Analysis

### How Structs Map to SFA

Under SFA, every struct instance has a **fixed memory address** determined at compile time:

| Location | SFA Behavior |
|----------|-------------|
| Module-level `let` | Permanent address in RAM segment. Always alive. |
| Module-level `const` | Permanent address in ROM/data segment. Read-only. |
| Function-local `let` | Address in function's static frame. Reusable when function isn't active. |
| `zeropage` block | Address in zero-page range. Fast access. |
| Array element | Address = array base + (index × struct size). Fixed base, variable offset. |
| Loop-local | Same frame slot reused every iteration. ONE instance, overwritten each time. |

### ZP Pointer Cost for By-Reference

Each function that receives a struct parameter needs **2 bytes of zero page** for the indirect addressing pointer:

```asm
; ptr and ptr+1 are in zero page
LDY #OFFSET_HP
LDA (ptr),Y         ; Access field via indirect indexed addressing
```

Under SFA, functions with non-overlapping lifetimes share ZP pointer bytes:

| Call pattern | ZP pointer bytes needed |
|-------------|------------------------|
| Sequential calls: `f(s); g(s);` | 2 bytes (shared) |
| Nested calls: `f(s)` calls `g(s2)` | 4 bytes (2 per level) |
| Deep chain: `f → g → h`, all with struct params | 6 bytes |

The compiler tracks this. E10032 fires if total ZP usage exceeds platform budget.

### Struct in Loops — Zero Overhead

```blend65
for i: byte = 0 to 8 {
    let temp: Enemy = { x: i, y: 0, hp: 10, enemyType: 0, frame: 0 };
    damage(temp, 5);
}
```

Under SFA: `temp` occupies ONE fixed address in the function's frame. Each iteration overwrites the same bytes. No accumulation, no growth, no heap.

---

## 6502 Code Generation

### Direct Field Access (Module-Level Struct)

```blend65
let player: Player;    // Compiler assigns to e.g. $0400
player.hp = 100;
```

```asm
; player.hp = offset 6 from base $0400
    LDA #100
    STA $0406           ; Direct absolute addressing — 4 cycles
```

### By-Reference Field Access (Function Parameter)

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

### Call Site — Passing Struct by Reference

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

### Array of Structs — Constant Index

```blend65
enemies[3].hp = 50;    // enemies at $0500, Enemy is 5 bytes
```

```asm
; Address = $0500 + (3 * 5) + 2 = $0500 + 17 = $0511
    LDA #50
    STA $0511           ; Compile-time calculated — 4 cycles!
```

### Array of Structs — Variable Index

```blend65
enemies[i].hp = 50;    // Requires runtime multiply
```

```asm
; Address = base + (i * 5) + 2
; Multiply i by 5: i*5 = i*4 + i = (i<<2) + i
    LDA i
    ASL                 ; ×2
    ASL                 ; ×4
    CLC
    ADC i               ; ×4 + i = ×5
    CLC
    ADC #2              ; + offset of hp
    TAY
    LDA #50
    STA enemies,Y       ; Absolute indexed — works if total < 256 bytes
; ~16 cycles for address calc + 5 cycles for store = ~21 cycles
```

For arrays larger than 256 bytes or struct sizes that aren't efficiently computable, the compiler uses a 16-bit address calculation with ZP pointer.

### Nested Struct Access

```blend65
player.pos.x = 160;   // pos at offset 0, x at offset 0 within Position
```

```asm
; Offsets: pos=0, x within pos=0 → total offset = 0
    LDA #<160
    STA player+0        ; low byte of word
    LDA #>160
    STA player+1        ; high byte of word
; Same as any word access — offsets computed at compile time
```

### Struct Initialization

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

### Struct Copy (Assignment)

```blend65
let backup: Enemy = boss;
```

```asm
    LDA boss+0
    STA backup+0
    LDA boss+1
    STA backup+1
    LDA boss+2
    STA backup+2
    LDA boss+3
    STA backup+3
    LDA boss+4
    STA backup+4
; 10 instructions, ~20 cycles for a 5-byte struct
```

---

## Cost Summary

| Operation | Cost | Notes |
|-----------|------|-------|
| Field access (direct) | 4 cycles | Absolute addressing, compile-time address |
| Field access (by-ref) | 5-6 cycles | Indirect indexed `(ptr),Y` |
| Call overhead (pass struct) | ~16 cycles | Set up ZP pointer + JSR |
| Array[const].field | 4 cycles | Compile-time address calculation |
| Array[var].field | ~21 cycles | Runtime index multiply + access |
| Struct init (N bytes) | ~4N cycles | N × (LDA + STA) |
| Struct copy (N bytes) | ~4N cycles | N × (LDA + STA) |
| sizeof(Type) | 0 cycles | Compile-time constant |
| ZP per active struct param | 2 bytes | Shared across non-overlapping functions |

---

## Resolved Ambiguities

### SR-A1: Can structs contain other structs?

**Yes.** Composition (not inheritance):

```blend65
struct Position { x: word; y: word; }
struct Velocity { dx: sbyte; dy: sbyte; }
struct Player {
    pos: Position;
    vel: Velocity;
    hp: byte;
}
```

Fields are inlined — `Player` is 7 bytes contiguous. No pointers, no indirection.

### SR-A2: Can you pass a nested struct field to a function?

**Yes.** The compiler calculates the address at compile time (for direct structs) or with a small runtime addition (for by-ref structs):

```blend65
function updatePosition(pos: Position): void {
    pos.x = pos.x + 1;
}
updatePosition(player.pos);  // ✅ Compiler calculates &player + offset_of_pos
```

### SR-A3: Can structs be used in switch?

**No.** Structs are not scalar types. E10075 applies.

### SR-A4: Can structs be used in for-loop bounds?

**No.** Loop variables must be integer types. Structs are not iterable.

### SR-A5: What about `&` on struct variables?

**Allowed.** `&myStruct` returns the base address as `word`:

```blend65
let addr: word = &player;   // ✅ Base address of the struct
```

`&` on individual struct **fields** is deferred to FUT (requires offset calculation at call sites for by-ref parameters).

### SR-A6: Aliasing (same struct passed as two parameters)

**Documented behavior, not prevented.** If both parameters point to the same struct, modifications through one affect the other:

```blend65
function swap(a: Enemy, b: Enemy): void { ... }
swap(boss, boss);  // ⚠️ Both a and b point to same memory — aliasing
```

The compiler MAY warn for obvious cases (same variable passed twice) but cannot catch all aliasing.

### SR-A7: Self-referencing structs?

**Not allowed.** A struct cannot contain a field of its own type (no linked lists under SFA):

```blend65
struct Node {
    value: byte;
    next: Node;    // ❌ E10091: Struct cannot contain itself
}
```

### SR-A8: Circular struct references?

**Not allowed.** Struct A cannot contain struct B if B contains struct A:

```blend65
struct A { b: B; }    // ❌ E10092: Circular struct dependency
struct B { a: A; }
```

### SR-A9: Struct type aliases?

**Allowed.** `type Sprite = Enemy;` works like any type alias — fully interchangeable.

### SR-A10: Export visibility?

`export struct` makes the type available to other modules. Without `export`, the type is module-private:

```blend65
export struct Position { x: word; y: word; }   // Visible to importers
struct InternalState { ... }                     // Module-private
```

---

## Error Codes

| Code | Message |
|------|---------|
| E10090 | Struct `<name>` must have at least one field |
| E10091 | Struct `<name>` cannot contain a field of its own type — self-referencing structs are not allowed |
| E10092 | Circular struct dependency: `<struct_a>` contains `<struct_b>` which contains `<struct_a>` |
| E10093 | Cannot return struct type `<name>` from function — pass a struct parameter instead |
| E10094 | Cannot pass `const` struct `<name>` as function parameter — copy to a mutable variable first |
| E10095 | Cannot compare structs with `<op>` — compare individual fields instead |
| E10096 | Struct literal must initialize all fields — missing field `<field>` |
| E10097 | Struct literal fields must be in declaration order — expected `<expected>`, found `<found>` |

### Warning Codes

| Code | Message |
|------|---------|
| W10110 | Struct `<name>` in zeropage uses `<N>` bytes — consider moving large structs to RAM |
| W10111 | Array of structs indexed by variable: struct size `<N>` is not a power of 2 — indexing requires multiply (~`<cycles>` cycles per access) |
| W10112 | Possible aliasing: parameter `<a>` and `<b>` may refer to the same struct |

---

## Feature Interactions

| Feature | Interaction |
|---------|------------|
| F003 Module contents | Struct types defined at module level. Instances in all contexts (module, function, zeropage) |
| F005 Memory placement | Struct instances valid in `zeropage {}`, `let`, `const`. Size tracked in ZP budget |
| F006 Address-of | `&structVar` returns `word` base address. Field addresses deferred to FUT |
| F007 Interrupt functions | Struct access inside interrupts works. By-ref params use ZP pointers (ensure no conflict with main code's pointers) |
| F008 For loop | Structs as loop-local variables: reuse same frame slot per iteration |
| F009 Switch | Structs not valid as switch expression type (E10075) |
| F010 Signed types | Signed fields (`sbyte`, `sword`) fully supported in structs |
| Enums | Enum fields valid in structs. Enum values valid in struct literals |
| Arrays | Arrays of structs supported. Fixed-size arrays as struct fields supported |
| Type aliases | `type` aliases for struct types work normally |

---

## Examples

### Example 1: Game Entity

```blend65
module game;

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

function updateEnemies(): void {
    for i: byte = 0 to enemyCount {
        if (enemies[i].hp > 0) {
            enemies[i].frame = enemies[i].frame + 1;
        }
    }
}
```

### Example 2: Nested Structs (Physics)

```blend65
module physics;

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

zeropage {
    playerVel: Velocity;   // 2 bytes — fast access for physics
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

### Example 3: Direction Lookup Table with Structs

```blend65
module movement;

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
    let delta: Delta = DIRECTION_DELTAS[dir];   // Copy from const (2 bytes)
    e.x = byte(sbyte(e.x) + delta.dx);
    e.y = byte(sbyte(e.y) + delta.dy);
}
```

### Example 4: High Score Table

```blend65
module scores;

struct HighScoreEntry {
    name: byte[3];
    score: word;
}

let highScores: HighScoreEntry[5];

function insertScore(name0: byte, name1: byte, name2: byte, score: word): void {
    // Find insertion point
    for i: byte = 0 to 5 {
        if (score > highScores[i].score) {
            // Shift entries down
            for j: byte = 4 downto i {
                highScores[j] = highScores[byte(j - 1)];
            }
            // Insert new entry
            highScores[i].name[0] = name0;
            highScores[i].name[1] = name1;
            highScores[i].name[2] = name2;
            highScores[i].score = score;
            break;
        }
    }
}
```

---

## Language Guard Verdict

### Platform Universality (P)

| Rule | Status | Notes |
|------|--------|-------|
| P1 Cross-platform compilable | ✅ | Contiguous bytes — universal across all 6502 platforms |
| P2 Platform-meaningful | ✅ | Game entities, sprites, UI elements needed everywhere |
| P3 No platform assumptions | ✅ | No hardware references in struct definition |
| P4 Resource-scalable | ✅ | W10110 warns about large ZP structs; W10111 warns about expensive indexing |

### Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅ | Field access = offset addressing; by-ref = `(ptr),Y` — native 6502 patterns |
| H2 Cost transparency | ✅ | Full cost table documented; sizeof operator for developer awareness |
| H3 SFA compatible | ✅ | Proven: all allocations static, no heap, frame reuse for locals |
| H4 Memory footprint documented | ✅ | sizeof(Type) available; ZP pointer cost documented |
| H5 Fully deterministic | ✅ | All operations produce defined results; aliasing documented |

### Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅ | `struct`, dot access, literal syntax — all standard, no parsing ambiguities |
| L2 Consistent with existing | ✅ | Same `name: type` pattern as variables and parameters |
| L3 Beginner-friendly | ✅ | Familiar from C/TS/Java |
| L4 Minimal feature | ✅ | No methods, no inheritance, no generics — pure data grouping |
| L5 No redundancy | ✅ | Replaces error-prone parallel arrays pattern |
| L6 Error messages defined | ✅ | 8 error codes + 3 warning codes |
| L7 Compile-time failure preferred | ✅ | Type mismatches, missing fields, const passing — all caught at compile time |
| L8 Feature interaction documented | ✅ | All feature interactions listed |
| L9 Documentable with examples | ✅ | 4 examples: entities, physics, lookup tables, high scores |

### Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅ | `KW_STRUCT`, dot-access is standard member expression, literal syntax is brace-delimited |
| C2 Semantic analysis defined | ✅ | Field lookup, offset calculation, by-ref detection, const restriction — all specified |
| C3 Code generation strategy | ✅ | Direct access, indirect `(ptr),Y`, array indexing patterns all documented |
| C4 Unit testable | ✅ | Each rule and codegen pattern independently testable |
| C5 Runtime verifiable | ✅ | Field values deterministic; emulator-testable on all platforms |

### Future-Proofing (F)

| Rule | Status | Notes |
|------|--------|-------|
| F1 Extensible | ✅ | Future: const params, &field access, methods (if ever desired) |
| F2 Platform-profile ready | ✅ | No platform-specific behavior |
| F3 Optimizer-friendly | ✅ | Constant index elimination, strength reduction for struct size multiply |
| F4 Stability classification | ✅ | Classified as **stable** |

### Escape Hatches Applied

None. All 23 rules pass.

### Verdict

**✅ ACCEPTED** — Structs are pure data grouping with zero heap requirement, native 6502 codegen via `(ptr),Y` indirect addressing, and full SFA compatibility. The by-reference passing model is the assembly-natural approach and avoids expensive byte copying.
