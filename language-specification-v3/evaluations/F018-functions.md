# F018 — Functions

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F002 (modules), F003 (module contents), F010 (signed types), F016 (type system)  
> **Interacts with**: F004 (entry point), F006 (address-of), F007 (interrupt functions), F008 (for loop), F011 (structs), F013 (control flow), F014 (arrays, const params), F017 (operators)

---

## Description

Functions are reusable blocks of code that perform a specific task. Under SFA, each function gets a **static memory frame** allocated at compile time — parameters and local variables have fixed addresses, not stack-based locations. This eliminates the expensive stack manipulation that traditional C compilers require on the 6502.

```blend65
function moveEnemy(enemy: Enemy, dx: sbyte, dy: sbyte): void {
    enemy.x = byte(sbyte(enemy.x) + dx);
    enemy.y = byte(sbyte(enemy.y) + dy);
}

function clamp(value: word, min: word, max: word): word {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}
```

**Key design principles:**
- Static Frame Allocation — every parameter and local variable has a compile-time-known address
- No recursion — each function has exactly one frame instance; the compiler detects and rejects all recursion
- No stack for data — parameters, locals, and return values never touch the hardware stack
- JSR/RTS for return addresses — the only hardware stack usage (2 bytes per active call level)
- Register-based return values — `byte`/`sbyte`/`boolean` in A, `word`/`sword` in A(lo)/X(hi)
- Declaration order independent — functions can call other functions regardless of source order

---

## Syntax

### Function Declaration

```ebnf
function_decl = [ "export" ] , "function" , identifier
              , "(" , [ parameter_list ] , ")"
              , ":" , return_type
              , function_body ;

parameter_list = parameter , { "," , parameter } ;
parameter      = [ "const" ] , identifier , ":" , type_expr ;

return_type    = "void" | "byte" | "sbyte" | "word" | "sword" | "boolean" ;
function_body  = "{" , { statement } , "}" ;

type_expr      = "byte" | "sbyte" | "word" | "sword" | "boolean"
               | identifier                           (* struct type *)
               | type_expr , "[" , const_expr , "]"    (* array type *) ;
```

### Function Call

```ebnf
function_call  = identifier , "(" , [ argument_list ] , ")" ;
argument_list  = expression , { "," , expression } ;
```

### Return Statement

```ebnf
return_stmt    = "return" , [ expression ] , ";" ;
```

---

## Rules

### FN-1 — Return Type Always Required

Every function must have an explicit return type annotation. There is no default.

```blend65
// ✅ Correct
function clearScreen(): void { ... }
function getScore(): word { ... }

// ❌ Error E10170
function clearScreen() { ... }    // missing return type
```

**Rationale**: Consistent with F016 (all type annotations required) and Axiom A4 (explicit over implicit). On 6502, knowing the return type determines register usage — this is a fundamental code generation decision.

### FN-2 — Scalar Parameters Passed by Value

Parameters of scalar types (`byte`, `sbyte`, `word`, `sword`, `boolean`) are passed **by value**. The callee receives a copy — modifying a parameter inside the function does not affect the caller's variable.

```blend65
function addScore(points: word): void {
    points += bonus;    // modifies LOCAL copy only
    score += points;
}

let p: word = 100;
addScore(p);            // p is still 100 after the call
```

**Codegen**: The caller stores the argument value into the callee's static frame before the JSR.

### FN-3 — Struct and Array Parameters Passed by Reference

Parameters of struct types and array types are passed **by reference** — the compiler passes the base address of the data. The callee accesses the original data, not a copy.

```blend65
function resetEnemy(enemy: Enemy): void {
    enemy.x = 0;       // modifies the ORIGINAL struct
    enemy.y = 0;
}

function clearBuffer(buffer: byte[1000]): void {
    for (let i: word = 0 to 999) {
        buffer[i] = 0;  // modifies the ORIGINAL array
    }
}
```

This is compiler-managed — there is no `ref` keyword. The developer does not choose; the compiler always uses by-reference for structs and arrays, by-value for scalars.

The `const` modifier (F014 CP-1..5) prevents modification of by-reference parameters:

```blend65
function countNonZero(const data: byte[256]): byte {
    let count: byte = 0;
    for (let i: byte = 0 to 255) {
        if (data[i] != 0) {
            count += 1;
        }
    }
    return count;
}
```

**Codegen**: The caller stores the base address (2 bytes) into the callee's frame. The callee uses indirect indexed addressing to access the data.

### FN-4 — Return Value Types

Functions can return scalar types only. Struct and array return values are not allowed.

| Return type | Allowed | Register | Notes |
|-------------|---------|----------|-------|
| `void` | ✅ | — | No return value |
| `byte` | ✅ | A | 8-bit unsigned |
| `sbyte` | ✅ | A | 8-bit signed (same register, different semantics) |
| `word` | ✅ | A(lo) / X(hi) | 16-bit unsigned |
| `sword` | ✅ | A(lo) / X(hi) | 16-bit signed (same registers, different semantics) |
| `boolean` | ✅ | A | 0 = false, 1 = true |
| struct type | ❌ E10093 | — | Use out-parameter instead (F011) |
| array type | ❌ E10120 | — | Use out-parameter instead (F014) |

### FN-5 — Return Statement Rules

| Situation | Rule | Error |
|-----------|------|-------|
| Non-void function, `return expr;` | Expression type must match return type | E10172 if mismatch |
| Non-void function, `return;` (no value) | Not allowed | E10174 |
| Non-void function, missing return on some path | Not allowed | E10102 (F013) |
| Void function, `return;` | Allowed (early exit) | — |
| Void function, `return expr;` | Not allowed | E10173 |

```blend65
function getHealth(enemy: Enemy): byte {
    if (enemy.hp == 0) {
        return 0;       // ✅ early return
    }
    return enemy.hp;    // ✅ all paths return
}

function explode(enemy: Enemy): void {
    if (enemy.hp > 0) {
        return;         // ✅ early exit from void function
    }
    // ... explosion logic ...
}
```

### FN-6 — No Recursion

Recursion is forbidden — both **direct** and **indirect**. The compiler builds a call graph and detects all cycles.

**Direct recursion:**
```blend65
function factorial(n: byte): word {
    if (n <= 1) { return 1; }
    return word(n) * factorial(n - 1);  // ❌ E10180: direct recursion
}
```

**Indirect recursion:**
```blend65
function ping(): void {
    pong();                              // ❌ E10181: indirect recursion
}
function pong(): void {
    ping();                              // cycle: ping → pong → ping
}
```

**Why**: SFA allocates one static frame per function. Recursive calls would overwrite the active frame, corrupting parameters and locals. This is not undefined behavior (H5) — the compiler catches it.

**Alternative**: Use iteration. Every recursive algorithm has an iterative equivalent, and iterative solutions are generally faster on 6502 (no call overhead).

### FN-7 — Declaration Order Independent

Functions can call other functions regardless of their declaration order within a module, or across modules (via `import`). The compiler resolves all declarations in a first pass before checking function bodies.

```blend65
// ✅ This works — init() calls setupScreen() which is defined later
function init(): void {
    setupScreen();
    setupSprites();
}

function setupSprites(): void { ... }
function setupScreen(): void { ... }
```

**Cross-module calls:**
```blend65
// file: graphics.blend65
module Graphics;
export function clearScreen(): void { ... }

// file: main.blend65
module Main;
import { clearScreen } from Graphics;

function main(): void {
    clearScreen();    // ✅ calls exported function from another module
}
```

### FN-8 — No Function Overloading

Each function name must be unique within its module. Two functions in the same module cannot share a name, regardless of parameter differences.

```blend65
function draw(x: byte, y: byte): void { ... }
function draw(sprite: Enemy): void { ... }   // ❌ E10003: duplicate declaration
```

**Rationale**: Overloading adds significant compiler complexity (overload resolution) and confuses beginners when the type system is small (6 types). Use distinct names instead: `drawPixel()`, `drawEnemy()`.

### FN-9 — No Nested Function Definitions

Functions can only be defined at module level (F003). Defining a function inside another function is not allowed.

```blend65
function outer(): void {
    function inner(): void { ... }   // ❌ E10176: cannot define function inside function
}
```

### FN-10 — Parameter Evaluation Order

When calling a function with multiple arguments, expressions are evaluated **left to right**. This is guaranteed behavior (H5 — fully deterministic).

```blend65
function foo(a: byte, b: byte, c: byte): void { ... }

let i: byte = 0;
foo(nextValue(), nextValue(), nextValue());
// First call to nextValue() becomes 'a'
// Second call becomes 'b'
// Third call becomes 'c'
```

### FN-11 — No Language Limit on Parameters

There is no hard limit on the number of parameters a function can have. The practical limit is determined by the platform's memory budget — each parameter consumes frame memory, and SFA must fit all frames within available RAM.

If the total frame allocation exceeds platform memory, the compiler reports an existing resource error (platform-specific). In practice, functions rarely need more than 6-8 parameters.

### FN-12 — Functions Are Not Values

Functions cannot be assigned to variables, passed as parameters, or stored in data structures. The only way to reference a function is `&functionName` (F006), which returns a `word` containing the code address.

```blend65
let fn: word = &clearScreen;     // ✅ address as word (F006)
// There is no way to "call" fn — it's just a number
// Install it as an interrupt vector, pass to platform API, etc.
```

Typed function pointers and indirect calls are deferred to FUT-003.

---

## SFA Calling Convention

### Overview

Blend65 uses a **Static Frame Allocation** calling convention that eliminates all stack-based parameter passing:

```
┌──────────────────────────────────────────────────────────┐
│                    SFA Calling Convention                  │
├──────────────┬───────────────────────────────────────────┤
│ Parameters   │ Static frame (fixed addresses in RAM)     │
│ Locals       │ Static frame (fixed addresses in RAM)     │
│ Return value │ Registers (A for 8-bit, A/X for 16-bit)  │
│ Return addr  │ Hardware stack via JSR/RTS (2 bytes)      │
└──────────────┴───────────────────────────────────────────┘
```

### Frame Layout

Each function gets a contiguous block of RAM allocated at compile time:

```
Function: calculate(a: byte, b: byte): word
  Frame at $0800 (example address):
    $0800: parameter 'a'    (1 byte)
    $0801: parameter 'b'    (1 byte)
    $0802: local 'result'   (2 bytes, word)
    $0804: local 'temp'     (1 byte)
  Total frame size: 5 bytes
```

The compiler allocates frames using the static call graph:
- Functions with **non-overlapping lifetimes** can share frame memory (frame coloring)
- Functions on the **same call path** must have separate frames
- The total frame region is a compile-time constant

### Struct/Array Parameter Passing

Structs and arrays are passed by address. The caller stores the base address (2 bytes) into the callee's frame:

```
Function: updateEnemy(enemy: Enemy, dx: sbyte)
  Frame at $0810:
    $0810: parameter 'enemy' (2 bytes — address of struct)
    $0812: parameter 'dx'    (1 byte — value copy)
  Total frame size: 3 bytes
```

### Call Sequence

```
Caller                           Callee
──────                           ──────
1. Evaluate arguments (left→right)
2. Store values to callee's frame
3. JSR callee_address  ────────► 4. Execute body
                                 5. Store result in A (or A/X)
                                 6. RTS
7. Use result from A (or A/X) ◄─┘
```

---

## Code Generation

### Basic Function Call (scalar parameters, byte return)

**Source:**
```blend65
function add(a: byte, b: byte): byte {
    return a + b;
}

let result: byte = add(10, score);
```

**Generated 6502 (caller):**
```asm
    ; Evaluate arguments left to right, store to callee frame
    LDA #10             ; 2 cycles — argument 1 (constant)
    STA add_param_a     ; 4 cycles — store to callee's frame
    LDA _score          ; 4 cycles — argument 2 (variable)
    STA add_param_b     ; 4 cycles — store to callee's frame
    JSR _add            ; 6 cycles — call (pushes return address)
    STA _result         ; 4 cycles — store return value from A
    ; Total call overhead: 24 cycles
```

**Generated 6502 (callee):**
```asm
_add:
    LDA add_param_a     ; 4 cycles — load parameter a
    CLC                 ; 2 cycles
    ADC add_param_b     ; 4 cycles — add parameter b
    RTS                 ; 6 cycles — return (result in A)
    ; Total body: 16 cycles
```

### Word Return Value

**Source:**
```blend65
function getAddress(index: byte): word {
    return word(index) * 40;
}
```

**Generated 6502 (caller):**
```asm
    LDA _index
    STA getAddress_param_index
    JSR _getAddress
    ; Return value: A = low byte, X = high byte
    STA _addr           ; store low byte
    STX _addr+1         ; store high byte
```

### Struct Parameter (by reference)

**Source:**
```blend65
function resetEnemy(enemy: Enemy): void {
    enemy.x = 0;
    enemy.y = 0;
}

resetEnemy(boss);
```

**Generated 6502 (caller):**
```asm
    ; Pass address of 'boss' struct
    LDA #<_boss         ; 2 cycles — low byte of address
    STA resetEnemy_param_enemy      ; 4 cycles
    LDA #>_boss         ; 2 cycles — high byte of address
    STA resetEnemy_param_enemy+1    ; 4 cycles
    JSR _resetEnemy     ; 6 cycles
    ; Total: 18 cycles
```

**Generated 6502 (callee):**
```asm
_resetEnemy:
    ; Load struct base address into ZP pointer
    LDA resetEnemy_param_enemy
    STA zp_ptr
    LDA resetEnemy_param_enemy+1
    STA zp_ptr+1
    ; enemy.x = 0 (offset 0)
    LDA #$00
    LDY #$00
    STA (zp_ptr),Y      ; indirect indexed store
    ; enemy.y = 0 (offset 1)
    LDY #$01
    STA (zp_ptr),Y
    RTS
```

### Void Function with Early Return

**Source:**
```blend65
function maybeExplode(enemy: Enemy): void {
    if (enemy.hp > 0) {
        return;          // early exit
    }
    // ... explosion effect ...
}
```

**Generated 6502:**
```asm
_maybeExplode:
    ; Load enemy.hp (offset for hp field)
    LDA maybeExplode_param_enemy
    STA zp_ptr
    LDA maybeExplode_param_enemy+1
    STA zp_ptr+1
    LDY #$02            ; hp field offset
    LDA (zp_ptr),Y
    CMP #$01
    BCS .early_return    ; if hp > 0, exit
    ; ... explosion code ...
.early_return:
    RTS
```

### Recursion Detection (compile-time)

The compiler builds a call graph during semantic analysis:

```
Call graph:
  main → init, gameLoop
  init → setupScreen, setupSprites
  gameLoop → updateEnemies, render
  updateEnemies → moveEnemy, checkCollision
  render → drawSprite
```

The compiler performs cycle detection (DFS with back-edge detection) on this graph. If any cycle is found, it reports the full cycle path:

```
error[E10181]: Indirect recursion detected — cycle: ping → pong → ping
  --> src/game.blend65:12:5
   |
12 |     pong();
   |     ^^^^^^
   |
  --> src/game.blend65:16:5
   |
16 |     ping();
   |     ^^^^^^
   = note: Blend65 uses static frame allocation which does not support recursion
   = help: Break the cycle by restructuring into a loop or state machine
```

---

## Cost Summary

### Call Overhead (cycles)

| Operation | Cycles | Notes |
|-----------|--------|-------|
| Store byte argument | 6 | LDA + STA (immediate or absolute) |
| Store word argument | 12 | LDA + STA × 2 bytes |
| Store struct/array address | 12 | LDA + STA × 2 bytes (address) |
| JSR | 6 | Push return address, jump |
| RTS | 6 | Pull return address, jump back |
| Read byte return | 4 | STA from A register |
| Read word return | 8 | STA from A + STX from X |

**Typical function call cost:**
- Void, no params: **12 cycles** (JSR + RTS)
- 2 byte params, byte return: **30 cycles** (2×6 store + 6 JSR + 6 RTS + 4 read + 2 body overhead)
- Struct param, void: **24 cycles** (12 addr store + 6 JSR + 6 RTS)

### Frame Memory Cost

| Item | RAM cost |
|------|----------|
| Byte parameter | 1 byte per function |
| Word parameter | 2 bytes per function |
| Struct/array parameter | 2 bytes per function (address) |
| Boolean parameter | 1 byte per function |
| Local byte variable | 1 byte per function |
| Local word variable | 2 bytes per function |

Frame memory is shared between functions with non-overlapping lifetimes (frame coloring), so the total frame region is typically much smaller than the sum of all individual frames.

### Stack Usage

| Item | Hardware stack cost |
|------|---------------------|
| Each active call level | 2 bytes (return address) |
| Interrupt entry (CPU push) | 3 bytes (P, PCL, PCH) |
| Interrupt register save | 3 bytes (A, X, Y via PHA/TXA PHA/TYA PHA) |

**Example budget (C64):**

```
256 bytes total hardware stack
 - 24 bytes  main call chain (12 levels × 2 bytes)
 -  6 bytes  interrupt overhead (3 CPU + 3 register save)
 -  8 bytes  interrupt handler calls (4 levels × 2 bytes)
 - 20 bytes  KERNAL reserve
────────────
198 bytes free (77%)
```

---

## Resolved Ambiguities

### FN-A1: Can a `void` function use `return;`?

**Yes.** `return;` (without a value) is allowed in void functions for early exit. This is a common pattern for guard clauses.

### FN-A2: What happens if a non-void function has no `return` on some paths?

**Compile error E10102** (defined in F013). The compiler performs exhaustive path analysis.

### FN-A3: Can parameters shadow module-level variables?

**No.** E10101 (defined in F013) prohibits all shadowing. A parameter name that matches a module-level variable is an error — parameters live in the function's scope, which is nested inside the module scope, and Blend65 forbids a nested-scope name from shadowing an enclosing-scope name:

```blend65
let score: word = 0;

function addToScore(score: word): void {    // ❌ E10101: 'score' shadows module-level
    // Which 'score' does this refer to?
}
```

Use a different name: `addToScore(points: word)`.

### FN-A4: Can you take the address of a function?

**Yes** — `&functionName` returns a `word` containing the function's code address (F006). This works for both regular and exported functions. For interrupt functions, `&handler` returns the address for installation in interrupt vectors (F007).

### FN-A5: What about the `callback` keyword from v2?

**Dropped.** In v2, `callback` marked functions whose addresses might be taken (for SFA liveness). In v3, the compiler detects this automatically when it encounters `&functionName`. No separate keyword needed.

### FN-A6: Can exported functions from different modules have the same name?

**Yes.** Functions are namespaced by their module. `Graphics.clear()` and `Audio.clear()` are distinct. The caller disambiguates via `import`:

```blend65
import { clear as clearScreen } from Graphics;
import { clear as clearAudio } from Audio;
```

Or by importing without alias and relying on the import name:

```blend65
import { clear } from Graphics;   // 'clear' refers to Graphics.clear
```

If both are imported without alias, E10003 applies (duplicate declaration in scope).

### FN-A7: Are tail calls optimized?

**Not in v3.** The compiler always generates JSR/RTS. Tail call optimization (converting the last call in a function from JSR to JMP, saving 2 bytes of stack) is a future optimization opportunity. It does not change language semantics. See also FUT-016 (stack-free calling convention).

### FN-A8: What is the maximum call depth?

There is no language-imposed limit. The practical limit is `256 / 2 = 128` call levels (the entire hardware stack for return addresses), minus stack budget for interrupts and KERNAL. The compiler computes the worst-case call depth from the static call graph and emits **W10180** when it exceeds the platform-defined threshold.

### FN-A9: Can a function call itself through `&` and platform APIs?

In theory, a function's address could be installed as an interrupt vector or passed to a platform routine that calls it. The compiler's recursion detection covers direct and indirect calls in the source code. Calls through raw addresses (poke + JMP) are outside the compiler's analysis — the developer is responsible. This is documented as a known limitation.

---

## Error Codes

| Code | Condition | Message |
|------|-----------|---------|
| E10170 | Function declared without return type | `Return type required — use 'function <name>(): void' for functions that return nothing` |
| E10171 | Wrong number of arguments | `Wrong argument count — '<name>()' expects <N> parameters, got <M>` |
| E10172 | Argument type mismatch | `Argument type mismatch — parameter '<param>' of '<name>()' expects '<expected>', found '<actual>'` |
| E10173 | Return value in void function | `Cannot return a value from void function '<name>' — remove the expression or change the return type` |
| E10174 | Missing return expression | `Missing return value — function '<name>' returns '<type>' but 'return' has no expression` |
| E10175 | Cannot call non-function | `'<name>' is not a function — cannot call '<type>' value as a function` |
| E10176 | Nested function definition | `Cannot define function inside function '<outer>' — move '<inner>' to module level` |
| E10180 | Direct recursion | `Direct recursion — function '<name>' calls itself. Blend65 uses static frame allocation which does not support recursion. Use iteration instead` |
| E10181 | Indirect recursion | `Indirect recursion detected — cycle: <fn1> → <fn2> → ... → <fn1>. Blend65 uses static frame allocation which does not support recursion` |

## Warning Codes

| Code | Condition | Message |
|------|-----------|---------|
| W10180 | Stack depth approaches limit | `Maximum stack depth is <N> bytes (<levels> call levels) on platform '<platform>' — stack budget is <budget> bytes. Main path: <main_depth> levels, IRQ: <irq_depth> levels` |
| W10181 | Unused function | `Function '<name>' is never called and not exported — consider removing or adding 'export'` |

---

## Feature Interactions

### With F004 (Entry Point)

`main()` follows all F018 rules. It must have the signature `function main(): void`. F004's rules (exactly one `main`, no export required) are additional constraints on top of F018.

### With F006 (Address-of)

`&functionName` returns a `word` with the function's code address. This works for any function (regular, exported, interrupt). The compiler marks the function as "address-taken" for SFA liveness analysis — even if the function is not directly called in source code, it must be included in the binary.

### With F007 (Interrupt Functions)

Interrupt functions follow a different calling convention:
- Prologue: push A, X, Y onto hardware stack (register save)
- Epilogue: pull Y, X, A from hardware stack + RTI (instead of RTS)
- Cannot be called via `JSR` from source code (E10051)
- All other F018 rules apply (no recursion, static frame, etc.)

### With F008 (For Loop)

For loops inside functions use the function's static frame for the loop counter variable. Loop variables follow normal scoping rules (F013).

### With F009 (Switch Statement)

Switch statements inside functions work normally. The switch expression and case bodies are part of the function's body.

### With F010 (Signed Types)

Signed parameters (`sbyte`, `sword`) use the same frame storage as unsigned. The difference is in codegen (signed comparisons, arithmetic shift vs logical shift). Return values use the same registers — the type determines interpretation, not storage.

### With F011 (Structs)

Structs are always passed by reference (FN-3). The `const` modifier prevents modification (F014 CP-1..5). Structs cannot be returned (E10093 from F011).

### With F013 (Control Flow)

- `return` is a control flow statement that exits the function
- Block scoping rules (F013) apply inside function bodies
- E10101 (shadowing) applies to parameters vs. module-level names
- E10102 (not all paths return) is enforced for non-void functions

### With F014 (Arrays / Const Parameters)

Arrays are always passed by reference (FN-3). The `const` modifier prevents modification (F014 CP-1..5). Arrays cannot be returned (E10120 from F014). Const parameter rules CP-1 through CP-5 apply to both struct and array parameters within function signatures.

### With F016 (Type System)

- Return type annotation is required (consistent with F016's "all annotations required")
- Argument types must match parameter types according to F016's type compatibility rules
- Auto-promotion applies: `byte` argument for `word` parameter auto-promotes (same signedness)
- Mixed signedness is an error (E10081 from F010)

### With F017 (Operators)

Operators inside function bodies follow all F017 rules. Function calls can appear as operands in expressions: `let x: word = getScore() + bonus;`. Parameter evaluation order (FN-10, left to right) interacts with side effects from function calls in expressions.

---

## Examples

### Example 1: Game Loop Structure

```blend65
module Game;

import { readJoystick, JoyState } from Input;
import { clearScreen, drawSprite } from Graphics;
import { playSound } from Audio;

let playerX: byte = 160;
let playerY: byte = 100;
let gameRunning: boolean = true;

function main(): void {
    init();
    while (gameRunning) {
        update();
        render();
    }
}

function init(): void {
    clearScreen();
    playerX = 160;
    playerY = 100;
}

function update(): void {
    let joy: byte = readJoystick();
    handleInput(joy);
    updateEnemies();
    checkCollisions();
}

function handleInput(joy: byte): void {
    if (joy & 1 != 0) { playerY -= 1; }   // up
    if (joy & 2 != 0) { playerY += 1; }   // down
    if (joy & 4 != 0) { playerX -= 1; }   // left
    if (joy & 8 != 0) { playerX += 1; }   // right
    if (joy & 16 != 0) { fireBullet(); }   // button
}

function render(): void {
    clearScreen();
    drawSprite(playerX, playerY, 0);
    drawEnemies();
    drawBullets();
}

// Call graph (compiler computes):
// main → init, update, render (depth: 1)
// update → handleInput, updateEnemies, checkCollisions (depth: 2)
// handleInput → fireBullet (depth: 3)
// render → clearScreen, drawSprite, drawEnemies, drawBullets (depth: 2)
// Max depth: 3 levels = 6 bytes of stack
```

### Example 2: Utility Functions with Return Values

```blend65
module Math;

export function min(a: byte, b: byte): byte {
    if (a < b) {
        return a;
    }
    return b;
}

export function max(a: byte, b: byte): byte {
    if (a > b) {
        return a;
    }
    return b;
}

export function clampByte(value: byte, lo: byte, hi: byte): byte {
    if (value < lo) {
        return lo;
    }
    if (value > hi) {
        return hi;
    }
    return value;
}

export function abs(value: sbyte): byte {
    if (value < 0) {
        return byte(-value);
    }
    return byte(value);
}

// Frame allocation:
// min:       2 bytes (a, b)
// max:       2 bytes (a, b)
// clampByte: 3 bytes (value, lo, hi)
// abs:       1 byte (value)
// Total: 8 bytes — but min/max/clampByte/abs have non-overlapping lifetimes,
//        so the compiler may share frame memory (frame coloring)
```

### Example 3: Struct Parameter Passing

```blend65
module Entities;

struct Enemy {
    x: byte;
    y: byte;
    hp: byte;
    speed: byte;
    frame: byte;
}

let enemies: Enemy[8];

function updateEnemy(enemy: Enemy): void {
    // By reference — modifies the original
    enemy.x += enemy.speed;
    if (enemy.frame < 3) {
        enemy.frame += 1;
    } else {
        enemy.frame = 0;
    }
}

function isAlive(const enemy: Enemy): boolean {
    // Const — cannot modify, compiler enforces
    return enemy.hp > 0;
}

function damageEnemy(enemy: Enemy, amount: byte): void {
    if (enemy.hp > amount) {
        enemy.hp -= amount;
    } else {
        enemy.hp = 0;
    }
}

function updateAllEnemies(): void {
    for (let i: byte = 0 to 7) {
        if (isAlive(enemies[i])) {
            updateEnemy(enemies[i]);
        }
    }
}
```

### Example 4: SFA Frame Layout Visualization

```blend65
// This example shows how the compiler allocates static frames

function processInput(joy: byte): byte {
    let dx: sbyte = 0;
    let dy: sbyte = 0;
    if (joy & 1 != 0) { dy = -1; }
    if (joy & 2 != 0) { dy = 1; }
    if (joy & 4 != 0) { dx = -1; }
    if (joy & 8 != 0) { dx = 1; }
    applyMovement(dx, dy);
    return joy & 16;    // return fire button state
}

function applyMovement(dx: sbyte, dy: sbyte): void {
    playerX = byte(sbyte(playerX) + dx);
    playerY = byte(sbyte(playerY) + dy);
}

// Compiler frame allocation:
//
// processInput frame (4 bytes):
//   $0800: joy     (byte, parameter)
//   $0801: dx      (sbyte, local)
//   $0802: dy      (sbyte, local)
//
// applyMovement frame (2 bytes):
//   $0803: dx      (sbyte, parameter)
//   $0804: dy      (sbyte, parameter)
//
// Call graph: processInput → applyMovement
// These are on the same call path, so frames cannot overlap.
// Total frame memory: 5 bytes
//
// Stack at deepest point (inside applyMovement):
//   [return to caller of processInput]  2 bytes
//   [return to processInput]            2 bytes
//   Total: 4 bytes of hardware stack
//
// Compare to cc65 (traditional C compiler):
//   Software stack for params: ~8-12 bytes
//   Hardware stack for returns: 4 bytes
//   Total: ~12-16 bytes + software stack overhead (~40 cycles/call)
```

---

## Language Guard Evaluation

### Platform Universality (P)

| Rule | Status | Notes |
|------|--------|-------|
| P1 Cross-platform compilable | ✅ | JSR/RTS and static frames work on all 6502 variants |
| P2 Platform-meaningful | ✅ | Functions are essential for any structured program |
| P3 No platform assumptions | ✅ | No hardware addresses, chip names, or platform references in core rules |
| P4 Resource-scalable | ✅ | Frame sizes adapt to available RAM; W10180 warns when stack budget is tight |

### Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅ | JSR/RTS are native instructions; static frames use standard addressing |
| H2 Cost transparency | ✅ | Call overhead documented per-operation; frame sizes reported in build summary |
| H3 SFA compatible | ✅ | Functions ARE the core SFA unit — one frame per function, static allocation |
| H4 Memory footprint documented | ✅ | Frame cost = sum of param + local sizes; stack cost = 2 bytes per call level |
| H5 Fully deterministic | ✅ | No undefined behavior — recursion caught at compile time, eval order guaranteed |

### Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅ | `function name(params): type { body }` — single parse, no ambiguity |
| L2 Consistent with existing | ✅ | Same `name: type` annotation style, braces for blocks, semicolons |
| L3 Beginner-friendly | ✅ | Syntax is familiar to C/TypeScript/JavaScript developers |
| L4 Minimal feature | ✅ | No overloading, no nested functions, no closures — minimal set |
| L5 No redundancy | ✅ | Only way to define reusable code blocks; `interrupt` is a modifier, not a separate feature |
| L6 Error messages defined | ✅ | 11 error codes + 2 warnings covering all misuse patterns |
| L7 Compile-time failure preferred | ✅ | All errors caught at compile time (recursion, types, arguments) |
| L8 Feature interaction documented | ✅ | Interactions with all 12 related features explicitly defined |
| L9 Documentable with examples | ✅ | 4 examples: game loop, utilities, struct params, frame visualization |

### Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅ | `function` keyword, standard parameter list, braces — no context-sensitivity |
| C2 Semantic analysis defined | ✅ | Type checking for params/returns, recursion detection, scope rules — all specified |
| C3 Code generation strategy | ✅ | STA to frame + JSR/RTS pattern documented with full 6502 examples |
| C4 Unit testable | ✅ | Lexer: `function` → KW_FUNCTION; Parser: function_decl AST node; Semantic: type/recursion checks; Codegen: frame layout + JSR/RTS |
| C5 Runtime verifiable | ✅ | Compile test programs, run in emulator, verify return values in A/X registers and frame memory |

### Future-Proofing (F)

| Rule | Status | Notes |
|------|--------|-------|
| F1 Extensible | ✅ | Can add overloading, closures, tail calls later without breaking existing code |
| F2 Platform-profile ready | ✅ | Stack budget, frame region address, ZP allocation — all via platform profile |
| F3 Optimizer-friendly | ✅ | Static call graph enables: inlining, tail call opt, JMP threading, dead function elimination |
| F4 Stability classification | ✅ | Stable — function syntax and semantics will not change |
