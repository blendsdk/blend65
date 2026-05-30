# Chapter 06 — Functions

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F018, F007

---

## 1. Overview

Functions are reusable blocks of code that perform a specific task. Under Static Frame Allocation (→ Ch 11), each function gets a **static memory frame** allocated at compile time — parameters and local variables have fixed addresses, not stack-based locations. This eliminates the expensive stack manipulation that traditional C compilers require on the 6502.

Key design principles:
- **Static Frame Allocation** — every parameter and local variable has a compile-time-known address
- **No recursion** — each function has exactly one frame instance; the compiler detects and rejects all cycles
- **No stack for data** — parameters, locals, and return values never touch the hardware stack
- **JSR/RTS for return addresses** — the only hardware stack usage (2 bytes per active call level)
- **Register-based return values** — `byte`/`sbyte`/`boolean` in A, `word`/`sword` in A(lo)/X(hi)
- **Declaration order independent** — functions can call other functions regardless of source order

---

## 2. Function Declaration

### 2.1 Syntax

```ebnf
function_decl  = [ "export" ] , "function" , identifier
               , "(" , [ parameter_list ] , ")"
               , ":" , return_type
               , block ;

parameter_list = parameter , { "," , parameter } ;
parameter      = [ "const" ] , identifier , ":" , type_expr ;

return_type    = "void" | "byte" | "sbyte" | "word" | "sword" | "boolean" ;
```

The `type_expr` production is shared with variable declarations (→ Ch 03) and includes primitive types, struct type names (→ Ch 07), and array types (→ Ch 08):

```ebnf
type_expr      = "byte" | "sbyte" | "word" | "sword" | "boolean"
               | identifier                              (* struct type *)
               | type_expr , "[" , const_expr , "]" ;    (* array type *)
```

### 2.2 Examples

```blend65
function clearScreen(): void {
    // ...
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

function moveEnemy(enemy: Enemy, dx: sbyte, dy: sbyte): void {
    enemy.x = byte(sbyte(enemy.x) + dx);
    enemy.y = byte(sbyte(enemy.y) + dy);
}
```

---

## 3. Function Rules

### FN-1 — Return Type Always Required

Every function must have an explicit return type annotation. There is no default return type. This is consistent with the mandatory type annotation rule (→ Ch 02, TS-1) and Axiom A4 (explicit over implicit). On the 6502, the return type directly determines register usage — this is a fundamental code generation decision.

```blend65
function clearScreen(): void { }       // ✅
function getScore(): word { }          // ✅
function clearScreen() { }             // ❌ E10170: return type required
```

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

**Codegen**: The caller stores the argument value into the callee's static frame before the `JSR`.

### FN-3 — Struct and Array Parameters Passed by Reference

Parameters of struct types (→ Ch 07) and array types (→ Ch 08) are passed **by reference** — the compiler passes the base address of the data. The callee accesses the original data, not a copy.

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

This is compiler-managed — there is no `ref` keyword. The compiler always uses by-reference for structs and arrays, by-value for scalars. The developer does not choose.

The `const` modifier prevents modification of by-reference parameters (→ Ch 08, const parameter rules):

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

| Return Type | Allowed | Register | Notes |
|-------------|---------|----------|-------|
| `void` | ✅ | — | No return value |
| `byte` | ✅ | A | 8-bit unsigned |
| `sbyte` | ✅ | A | 8-bit signed (same register, different semantics) |
| `word` | ✅ | A(lo) / X(hi) | 16-bit unsigned |
| `sword` | ✅ | A(lo) / X(hi) | 16-bit signed (same registers, different semantics) |
| `boolean` | ✅ | A | 0 = false, 1 = true |
| struct type | ❌ | — | E10093 — use out-parameter instead (→ Ch 07) |
| array type | ❌ | — | E10120 — use out-parameter instead (→ Ch 08) |

### FN-5 — Return Statement Rules

| Situation | Rule | Error |
|-----------|------|-------|
| Non-void function, `return expr;` | Expression type must match return type | E10172 if mismatch |
| Non-void function, `return;` (no value) | Not allowed | E10174 |
| Non-void function, missing return on some path | Not allowed | E10102 (→ Ch 05) |
| Void function, `return;` | Allowed (early exit) | — |
| Void function, `return expr;` | Not allowed | E10173 |

```ebnf
return_stmt = "return" , [ expression ] , ";" ;
```

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

Recursion is forbidden — both **direct** and **indirect**. The compiler builds a static call graph and detects all cycles using back-edge detection (DFS).

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

**Why**: SFA allocates one static frame per function. Recursive calls would overwrite the active frame, corrupting parameters and locals. This is not undefined behavior (Axiom A3) — the compiler catches it at compile time.

**Alternative**: Use iteration. Every recursive algorithm has an iterative equivalent, and iterative solutions are generally faster on the 6502 (no call overhead).

**Diagnostics**: When the compiler detects a cycle, it reports the full cycle path:

```
error[E10181]: indirect recursion detected — cycle: ping → pong → ping
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
   = help: break the cycle by restructuring into a loop or state machine
```

### FN-7 — Declaration Order Independent

Functions can call other functions regardless of their declaration order within a module, or across modules via `import` (→ Ch 10). The compiler resolves all declarations in a first pass before checking function bodies.

```blend65
// ✅ This works — init() calls setupScreen() which is defined later
function init(): void {
    setupScreen();
    setupSprites();
}

function setupSprites(): void { }
function setupScreen(): void { }
```

### FN-8 — No Function Overloading

Each function name must be unique within its module. Two functions in the same module cannot share a name, regardless of parameter differences.

```blend65
function draw(x: byte, y: byte): void { }
function draw(sprite: Enemy): void { }   // ❌ E10003: duplicate declaration
```

**Rationale**: Overloading adds significant compiler complexity (overload resolution) and is confusing when the type system is small (six primitive types). Use distinct names: `drawPixel()`, `drawEnemy()`.

### FN-9 — No Nested Function Definitions

Functions can only be defined at module level (→ Ch 10). Defining a function inside another function is not allowed.

```blend65
function outer(): void {
    function inner(): void { }   // ❌ E10176: cannot define function inside function
}
```

### FN-10 — Parameter Evaluation Order

When calling a function with multiple arguments, argument expressions are evaluated **left to right**. This is guaranteed behavior (Axiom A3 — fully deterministic, → Ch 00).

```blend65
function foo(a: byte, b: byte, c: byte): void { }

foo(nextValue(), nextValue(), nextValue());
// First call to nextValue() becomes 'a'
// Second call becomes 'b'
// Third call becomes 'c'
```

### FN-11 — No Language Limit on Parameter Count

There is no hard limit on the number of parameters a function can have. The practical limit is determined by the platform's memory budget — each parameter consumes frame memory, and SFA must fit all frames within available RAM. If total frame allocation exceeds platform memory, the compiler reports a resource error. In practice, functions rarely need more than 6–8 parameters.

### FN-12 — Functions Are Not Values

Functions cannot be assigned to variables, passed as parameters, or stored in data structures. The only way to reference a function is `&functionName` (→ Ch 04, §8), which returns a `word` containing the function's code address.

```blend65
let fn: word = &clearScreen;     // ✅ address as word
// There is no way to "call" fn — it's just a number
// Install it as an interrupt vector, pass to platform API, etc.
```

Typed function pointers and indirect calls are deferred to a future version (FUT-003).

### FN-13 — No Shadowing

A parameter name must not duplicate any module-level variable or constant name. Blend65 forbids a nested-scope name from shadowing an enclosing-scope name (→ Ch 05, §2.4). This rule applies to parameters within the function's scope, which is nested inside the module scope.

```blend65
let score: word = 0;

function addToScore(score: word): void {    // ❌ E10101: 'score' shadows module-level
    // Which 'score' would this refer to?
}

function addToScore(points: word): void {   // ✅ unique name
    score += points;
}
```

---

## 4. Function Call

### 4.1 Syntax

```ebnf
function_call = identifier , "(" , [ argument_list ] , ")" ;
argument_list = expression , { "," , expression } ;
```

### 4.2 Rules

- The identifier must resolve to a function (E10175 if it is not a function).
- The number of arguments must match the number of parameters (E10171).
- Each argument type must be compatible with the corresponding parameter type according to the type rules (→ Ch 02). Argument type mismatch is E10172.
- Auto-promotion applies: a `byte` argument for a `word` parameter is promoted (same signedness family). Mixed signedness is an error (E10081, → Ch 02).

---

## 5. SFA Calling Convention

### 5.1 Overview

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

### 5.2 Frame Layout

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

### 5.3 Frame Memory Cost

| Item | RAM Cost |
|------|----------|
| `byte` / `sbyte` / `boolean` parameter | 1 byte |
| `word` / `sword` parameter | 2 bytes |
| Struct / array parameter (by-reference) | 2 bytes (base address) |
| Local `byte` / `sbyte` / `boolean` variable | 1 byte |
| Local `word` / `sword` variable | 2 bytes |

Frame memory is shared between functions with non-overlapping lifetimes (frame coloring), so the total frame region is typically much smaller than the sum of all individual frames.

### 5.4 Call Sequence

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

### 5.5 Stack Usage

| Item | Hardware Stack Cost |
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

The compiler computes worst-case call depth from the static call graph and emits **W10180** when the call depth approaches the platform-defined stack budget.

---

## 6. Code Generation

### 6.1 Basic Function Call (scalar parameters, byte return)

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

### 6.2 Word Return Value

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

### 6.3 Struct Parameter (by reference)

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

### 6.4 Call Overhead Summary

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
- 2 byte params, byte return: **~30 cycles** (2×6 store + 6 JSR + 6 RTS + 4 read + body overhead)
- Struct param, void: **~24 cycles** (12 addr store + 6 JSR + 6 RTS)

---

## 7. Interrupt Functions

### 7.1 Purpose

The `interrupt` keyword marks a function as a hardware interrupt handler. The compiler generates the correct prologue (register save) and epilogue (register restore + `RTI`) instead of the normal `RTS` calling convention. Interrupt functions are a core language feature because the 6502 CPU's IRQ and NMI capabilities are shared by all target platforms.

### 7.2 Syntax

```ebnf
interrupt_function = [ "export" ] , "interrupt" , "function" , identifier
                   , "(" , ")" , ":" , "void" , block ;
```

The signature is always `(): void` — no parameters, no return value. This is enforced at compile time.

```blend65
interrupt function onRasterIRQ(): void {
    rasterLine += 1;
    // Acknowledge interrupt (platform-specific)
}
```

### 7.3 Rules

| Rule | Decision |
|------|----------|
| Signature | Must be `(): void` — no parameters, no return value (E10050 if wrong) |
| Can it be called as a normal function? | **No** — E10051 |
| Can you take its address? | **Yes** — `&onRasterIRQ` returns `word` (code address) |
| Can it access module variables? | **Yes** — including `zeropage` variables |
| Can it call other functions? | **Yes**, but with documented reentrancy hazard (§7.5) |
| Can it be exported? | **Yes** — `export interrupt function ...` |
| How many per module? | No limit |

### 7.4 Generated Code Pattern

The compiler generates the standard 6502 interrupt handler prologue/epilogue:

```asm
; interrupt function onRasterIRQ(): void
onRasterIRQ:
    PHA             ; Save accumulator          (3 cycles)
    TXA             ;                            (2 cycles)
    PHA             ; Save X register            (3 cycles)
    TYA             ;                            (2 cycles)
    PHA             ; Save Y register            (3 cycles)
    
    ; ... compiled function body ...
    
    PLA             ; Restore Y register         (4 cycles)
    TAY             ;                            (2 cycles)
    PLA             ; Restore X register         (4 cycles)
    TAX             ;                            (2 cycles)
    PLA             ; Restore accumulator        (4 cycles)
    RTI             ; Return from interrupt       (6 cycles)
```

**Overhead**: 35 cycles + function body. 11 bytes of ROM for the prologue/epilogue.

Note: The CPU automatically pushes the processor status register (P) onto the stack when an interrupt fires, and `RTI` automatically restores it. The compiler does not need to save/restore P separately.

### 7.5 SFA Reentrancy Hazard

In Static Frame Allocation, every function has exactly one static frame. If `main()` → `updateScore()` is executing, and an interrupt fires, and the interrupt handler also calls `updateScore()`, the static frame for `updateScore()` is corrupted.

> ⚠️ **Known limitation**: Interrupt handlers must not call functions that are also reachable from the main code path. Because Blend65 uses Static Frame Allocation, each function has exactly one frame — if an interrupt handler calls a function whose frame is currently in use by the interrupted code, the frame contents are corrupted.

This hazard is **documented but not compiler-enforced in v3**. A future compiler version may add call-graph analysis to detect main-path/interrupt-path overlap at compile time (FUT-004).

**Safe patterns:**
- Interrupt handlers that only access module-level variables (no function calls)
- Interrupt handlers that call functions dedicated exclusively to the interrupt path

### 7.6 Interrupt Handler ZP Temp Space

The compiler uses zero-page bytes as temporary workspace for expression evaluation. If an interrupt fires while the main code is using those temps, and the handler also uses ZP temps, the main code's temps would be corrupted.

**Rule**: The compiler must allocate **separate ZP temp space** for interrupt handlers and for the main code path. This is a compiler implementation requirement, transparent to the developer.

### 7.7 Installation

Getting the address of an interrupt handler uses the core `&` operator (→ Ch 04, §8). Installing it at the correct hardware vector is platform-specific and belongs in platform libraries (→ Ch 15):

```blend65
// Direct hardware access (works, but platform-specific)
pokew(0x0314, &onRasterIRQ);          // C64: KERNAL IRQ vector
pokew(0x0222, &onVBlank);             // Atari 800XL: VVBLKI vector

// Platform library (preferred)
import { setIRQ } from c64.system;
setIRQ(&onRasterIRQ);
```

### 7.8 Stack Cost

| Item | Stack Bytes |
|------|-------------|
| CPU interrupt push (P, PCL, PCH) | 3 |
| Register save (A, X, Y) | 3 |
| Each function call within handler | 2 (return address) |
| **Total per interrupt entry** | **6 + (2 × call levels within handler)** |

---

## 8. Address-of for Functions

The `&` operator applied to a function name yields a `word` containing the function's code address (→ Ch 04, §8). This works for both regular functions and interrupt functions.

```blend65
let handler: word = &onRasterIRQ;    // interrupt function address
let util: word = &clearScreen;       // regular function address
```

When the compiler encounters `&functionName`, it marks the function as **address-taken** for SFA liveness analysis — even if the function is not directly called in source code, it must be included in the binary and its frame must be allocated. This replaces the v2 `callback` keyword, which served the same purpose but required manual annotation (FN-A5).

**Known limitation (FN-A9)**: A function's address can be installed as an interrupt vector or passed to a platform routine that calls it at runtime. The compiler's recursion/reentrancy detection covers direct and indirect calls visible in the source code. Calls through raw addresses (`pokew` + hardware jump) are outside the compiler's static analysis — the developer is responsible for ensuring no reentrancy hazard in such cases. This is a documented limitation, not undefined behavior.

---

## 9. Cross-Module Functions

Functions can be shared between modules using `export` and `import` (→ Ch 10):

```blend65
// file: graphics.blend65
module Graphics;
export function clearScreen(): void { }

// file: main.blend65
module Main;
import { clearScreen } from Graphics;

function main(): void {
    clearScreen();    // ✅ calls exported function from another module
}
```

Functions are namespaced by their module. `Graphics.clear()` and `Audio.clear()` are distinct. If both are imported without alias into the same scope, E10003 (duplicate declaration) applies. Use `import { X as Y }` to disambiguate:

```blend65
import { clear as clearScreen } from Graphics;
import { clear as clearAudio } from Audio;
```

---

## 10. Error Codes

All error codes defined in this chapter. The canonical registry is in → Ch 14.

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
| E10050 | Wrong interrupt function signature | `Interrupt function '<name>' must have signature '(): void' — found '<actual>'` |
| E10051 | Calling interrupt function directly | `Cannot call interrupt function '<name>' directly — interrupt functions are invoked by hardware. Use '&<name>' to get its address for installation` |

## Warning Codes

| Code | Condition | Message |
|------|-----------|---------|
| W10180 | Stack depth approaches platform limit | `Maximum stack depth is <N> bytes (<levels> call levels) on platform '<platform>' — stack budget is <budget> bytes` |
| W10181 | Unused function | `Function '<name>' is never called and not exported — consider removing or adding 'export'` |

---

## 11. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Entry point** (→ Ch 10) | `main()` follows all Ch 06 rules. Signature must be `function main(): void`. Entry-point rules are additional constraints on top of function rules. |
| **Address-of** (→ Ch 04, §8) | `&functionName` returns `word`. Compiler marks function as address-taken for SFA liveness. Works for regular and interrupt functions. |
| **Type system** (→ Ch 02) | Return type annotation required (TS-1). Argument types must match parameter types. Auto-promotion applies (TS-4). Mixed signedness is E10081 (→ Ch 02). |
| **Control flow** (→ Ch 05) | `return` is a control flow statement. Block scoping rules apply inside function bodies. E10101 (shadowing) applies to parameters vs. module-level names. E10102 (not all paths return) is enforced for non-void functions. |
| **Structs** (→ Ch 07) | Always passed by reference (FN-3). Cannot be returned (E10093). `const` modifier prevents modification. |
| **Arrays** (→ Ch 08) | Always passed by reference (FN-3). Cannot be returned (E10120). `const` modifier prevents modification. |
| **Enums** (→ Ch 09) | Enum values are `byte`-backed. Passed by value like any `byte`. Implicit enum→byte conversion applies in argument position. |
| **For loops** (→ Ch 05) | Loop counter variables inside functions use the function's static frame. |
| **Switch** (→ Ch 05) | Switch statements inside function bodies work normally. |
| **Operators** (→ Ch 04) | Function calls can appear as operands in expressions. Parameter evaluation is left-to-right (FN-10). |
| **Memory intrinsics** (→ Ch 04, §9) | `sizeof`, `offsetof`, `length` are compile-time and can be used in function bodies and arguments. |
| **Modules** (→ Ch 10) | Functions are namespaced by module. `export` makes a function visible to other modules. |
| **Memory model** (→ Ch 11) | SFA frame allocation, zero-page budget, and frame coloring are defined in Ch 11. |

---

## 12. Examples

### 12.1 Game Loop Structure

```blend65
module Game;

import { readJoystick } from Input;
import { clearScreen, drawSprite } from Graphics;

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
    if (joy & 1 != 0) { playerY -= 1; }
    if (joy & 2 != 0) { playerY += 1; }
    if (joy & 4 != 0) { playerX -= 1; }
    if (joy & 8 != 0) { playerX += 1; }
}

function render(): void {
    clearScreen();
    drawSprite(playerX, playerY, 0);
}

// Call graph (compiler computes):
// main → init, update, render (depth: 1)
// update → handleInput, updateEnemies, checkCollisions (depth: 2)
// render → clearScreen, drawSprite (depth: 2)
// Max depth: 2 levels = 4 bytes of stack
```

### 12.2 Utility Functions with Return Values

```blend65
module Math;

export function min(a: byte, b: byte): byte {
    if (a < b) { return a; }
    return b;
}

export function max(a: byte, b: byte): byte {
    if (a > b) { return a; }
    return b;
}

export function clampByte(value: byte, lo: byte, hi: byte): byte {
    if (value < lo) { return lo; }
    if (value > hi) { return hi; }
    return value;
}

export function abs(value: sbyte): byte {
    if (value < 0) {
        return byte(-value);
    }
    return byte(value);
}
```

### 12.3 Interrupt Handler with Safe Pattern

```blend65
module Interrupts;

zeropage {
    rasterLine: byte = 0;
    frameReady: boolean = false;
}

// ✅ Safe: only accesses module-level variables, no function calls
interrupt function onRasterIRQ(): void {
    rasterLine += 1;
    if (rasterLine >= 200) {
        frameReady = true;
        rasterLine = 0;
    }
}

export function installIRQ(): void {
    pokew(0x0314, &onRasterIRQ);
}
```

### 12.4 SFA Frame Visualization

```blend65
function processInput(joy: byte): byte {
    let dx: sbyte = 0;
    let dy: sbyte = 0;
    if (joy & 1 != 0) { dy = -1; }
    if (joy & 2 != 0) { dy = 1; }
    if (joy & 4 != 0) { dx = -1; }
    if (joy & 8 != 0) { dx = 1; }
    applyMovement(dx, dy);
    return joy & 16;
}

function applyMovement(dx: sbyte, dy: sbyte): void {
    playerX = byte(sbyte(playerX) + dx);
    playerY = byte(sbyte(playerY) + dy);
}

// Compiler frame allocation:
//
// processInput frame (3 bytes):
//   $0800: joy     (byte, parameter)
//   $0801: dx      (sbyte, local)
//   $0802: dy      (sbyte, local)
//
// applyMovement frame (2 bytes):
//   $0803: dx      (sbyte, parameter)
//   $0804: dy      (sbyte, parameter)
//
// Call graph: processInput → applyMovement
// Same call path → frames cannot overlap.
// Total frame memory: 5 bytes
//
// Stack at deepest point (inside applyMovement):
//   [return to caller of processInput]  2 bytes
//   [return to processInput]            2 bytes
//   Total: 4 bytes of hardware stack
```
