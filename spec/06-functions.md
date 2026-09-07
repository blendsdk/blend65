# Chapter 06 — Functions

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F018, F007

---

## 1. Overview

Functions are reusable blocks of code that perform a specific task. Under Static Frame Allocation
(→ Ch 11), each function receives compile-time-known invocation-private storage for every required
execution-domain specialization. Parameters and locals have fixed addresses rather than stack-based
locations.

Key design principles:
- **Static Frame Allocation** — parameters, returns, locals, temporaries, spills, staging, and helper
  scratch have compile-time-known homes
- **No recursion** — the compiler detects and rejects call cycles; no dynamic activation stack exists
- **No stack for data** — parameters, locals, and return values never touch the hardware stack
- **Hardware stack is accounted completely** — `JSR` return addresses, interrupt entries/register
  saves, and explicit stack intrinsics all contribute to the proven peak
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
parameter      = identifier , ":" , [ "const" ] , value_type ;

return_type    = "void" | value_type ;
```

The shared master `value_type` production includes primitive
types, struct and enum type names, and array types. Every such return annotation parses uniformly.
Semantic analysis accepts scalar and enum returns, rejects struct returns with E10093, and rejects
array returns with E10120.

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
    for (let i: word = 0; i <= 999; i += 1) {
        buffer[i] = 0;  // modifies the ORIGINAL array
    }
}
```

This is compiler-managed — there is no `ref` keyword. The compiler always uses by-reference for structs and arrays, by-value for scalars. The developer does not choose.

The `const` modifier prevents modification of by-reference parameters (→ Ch 08, const parameter
rules). It is valid only on array and struct parameters, because scalar and enum parameters are
already copied by value. Applying it to a scalar or enum parameter is E10246 rather than a silently
ignored qualifier:

```blend65
function countNonZero(data: const byte[256]): byte {
    let count: byte = 0;
    for (let i: word = 0; i < 256; i += 1) {
        if (data[i] != 0) {
            count += 1;
        }
    }
    return count;
}

function redundant(value: const byte): byte { // ❌ E10246
    return value;
}
```

**Codegen**: For an exact `T[N]` parameter, the caller stores the base address (2 bytes) into the
callee's frame. For an any-size `T[]` parameter, the caller stores the base address plus the fixed
argument array's full 16-bit element count (4 bytes total). The callee may read that count through
`length(parameter)`. This is parameter ABI state only: `T[]` is not a dynamic array, slice, span,
view, storable value, or return type. It may be forwarded only to another compatible any-size
parameter.

### FN-4 — Return Value Types

Functions can return scalar and enum values only. Struct and array return values are not allowed.

| Return Type | Allowed | Register | Notes |
|-------------|---------|----------|-------|
| `void` | ✅ | — | No return value |
| `byte` | ✅ | A | 8-bit unsigned |
| `sbyte` | ✅ | A | 8-bit signed (same register, different semantics) |
| `word` | ✅ | A(lo) / X(hi) | 16-bit unsigned |
| `sword` | ✅ | A(lo) / X(hi) | 16-bit signed (same registers, different semantics) |
| `boolean` | ✅ | A | 0 = false, 1 = true |
| enum type | ✅ | A | Byte-backed value with nominal enum type |
| struct type | ❌ | — | E10093 — use out-parameter instead (→ Ch 07) |
| array type | ❌ | — | E10120 — use out-parameter instead (→ Ch 08) |

### FN-5 — Return Statement Rules

| Situation | Rule | Error |
|-----------|------|-------|
| Non-void function, `return expr;` | Expression must be assignment-compatible with the declared return type under Ch 02, §5.3 and the enum conversion rules | E10080, E10082, E10086, or E10235 according to the rejected conversion |
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

**Why**: SFA allocates a finite set of statically selected invocation homes. Recursion has no
static activation bound and would require a dynamic frame mechanism that Blend65 deliberately does
not add. This is not silent corruption: the compiler rejects every direct or indirect recursive
cycle at compile time.

**Alternative**: Use iteration. Every recursive algorithm has an iterative equivalent, and iterative solutions are generally faster on the 6502 (no call overhead).

**Diagnostics**: When the compiler detects a cycle, E10181 identifies the full ordered cycle path
through primary and related spans. [Chapter 14](14-diagnostics.md) owns the exact public template,
notes, and help.

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
// Pass it to an API that accepts an ordinary code address.
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

### 4.3 Non-Retaining Address Parameters

When an argument depends on `&local`, the compiler proves a non-retaining contract for that exact
parameter position. The proof is transitive over every reachable path: the callee may dereference,
mutate, copy locally, or forward the value only to another proven non-retaining position, but may
not return it, persist it beyond the referent's lifetime, publish it to an interrupt or hardware
consumer, or pass it to unknown/external code. Whole-program analysis infers the contract for user
functions; a platform or library operation must declare it. A synchronous call is not sufficient
by itself because synchronous code can still save an address for later.

E10260 rejects the first retaining or unproven use and reports both the local origin and the escape
path. This analysis adds no runtime code or calling-convention field. It extends the addressed
local's SFA liveness across the complete legal call chain.

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

Each function has one logical frame layout that assigns fixed offsets to its parameters, locals,
temporaries, spills, and helper scratch. SFA allocates one or more contiguous static instances of
that layout at compile time. One instance is sufficient when no two invocations can overlap;
overlapping mainline, IRQ, NMI, callback, or other proven execution domains receive disjoint
instances. Every instance uses the same offsets, while code is shared or specialized as required by
the fixed addresses (§7.5).

```
Function: calculate(a: byte, b: byte): word
  Frame at $0800 (example address):
    $0800: parameter 'a'    (1 byte)
    $0801: parameter 'b'    (1 byte)
    $0802: local 'result'   (2 bytes, word)
    $0804: local 'temp'     (1 byte)
  Total frame size: 5 bytes
```

The compiler allocates frame instances using the static call and execution-domain graphs:

- Functions or instances with **non-overlapping lifetimes** can share frame memory (frame coloring).
- Functions on the **same call path** must have separate live storage.
- Simultaneously live invocations of one function must use disjoint instances.
- The number, placement, and total size of all instances are compile-time constants.

### 5.3 Frame Memory Cost

| Item | RAM Cost |
|------|----------|
| `byte` / `sbyte` / `boolean` parameter | 1 byte |
| `word` / `sword` parameter | 2 bytes |
| Struct or exact `T[N]` array parameter (by-reference) | 2 bytes (base address) |
| Any-size `T[]` array parameter (by-reference) | 4 bytes (base address + word element count) |
| Local `byte` / `sbyte` / `boolean` variable | 1 byte |
| Local `word` / `sword` variable | 2 bytes |

The table gives the cost of one logical item in one frame instance. The total static RAM cost is the
sum of the allocated instance ranges after frame coloring. Instances with proven non-overlapping
lifetimes may share memory, so the total region is usually smaller than the sum of every logical
frame times every reachable domain. No unproved overlap is removed merely to save RAM.

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
| `asm_pha()` / `asm_php()` | 1 byte until its matching pull |
| `asm_pla()` / `asm_plp()` | Releases 1 byte previously pushed in the same function activation |

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

The compiler proves the peak over every feasible mainline/IRQ/NMI/callback overlap, not each root in
isolation. It sums active `JSR` return addresses, every simultaneous interrupt CPU entry and
selected entry-variant stack effect,
and the path-sensitive peak of explicit stack intrinsics, then compares that program peak with raw
capacity minus the selected profile's reserved bytes.
Interrupt-mask effects such as `asm_cli()` participate in the preemption graph. A cycle that permits
unbounded interrupt re-entry is E10245; a finite peak that exceeds the derived usable capacity
(`stack_capacity - stack_reserve`) is the ordinary resource error E10238. W10180 reports a finite
peak that reaches the profile's `warn_stack_peak` value, or 80% of derived usable capacity rounded
down when that optional field is absent.

Within each function, explicit-stack analysis begins with an empty relative kind sequence.
`asm_pha()`/`asm_php()` add accumulator-save/status-save entries, and `asm_pla()`/`asm_plp()` must
consume the matching top entry. Reachable joins and loop backedges require identical sequences, and
every return/interrupt exit must restore the empty relative sequence. E10248 rejects underflow,
kind mismatch, unequal join state, or a nonempty exit. A caller may hold explicit entries across a
call, but the callee receives its own empty relative sequence and cannot consume caller-owned,
return-address, interrupt-entry, or compiler-generated ABI bytes.

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
    ; Caller-side sequence shown: 24 cycles (callee body/RTS are separate)
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
| Store byte argument to absolute home | 4 register-ready; 6 immediate; 8 absolute-memory source | Argument evaluation/materialization plus one STA; a ZP home saves 1 cycle |
| Store word argument to absolute homes | 8 register-ready A/X; 12 two immediate bytes; 16 two absolute-memory bytes | Two stores plus any source loads; ZP homes save 1 cycle per store |
| Store struct/array address to absolute homes | 12 for a link-time address | Two immediate loads and two stores; a ZP home saves 2 cycles total |
| JSR | 6 | Push return address, jump |
| RTS | 6 | Pull return address, jump back |
| Store byte return | 4 | STA from A to an absolute destination; ZP costs 3 |
| Store word return | 8 | STA from A + STX from X to absolute destinations; ZP costs 6 total |

**Typical function call cost:**
- Void, no params: **12 cycles** (JSR + RTS)
- 2 byte params, byte return: **30 cycles** for the shown immediate + absolute-memory arguments,
  absolute parameter homes/destination, JSR, RTS, and result store (6 + 8 + 6 + 6 + 4), excluding
  the callee's arithmetic/body instructions
- Struct param, void: **24 cycles** for a link-time address into absolute parameter homes plus JSR
  and RTS (12 + 6 + 6), excluding the callee body

These are addressing-mode examples, not universal ABI constants. Final SFA placement and argument
sources determine the exact cost, which the build report must derive from emitted instructions.

---

## 7. Interrupt Functions

### 7.1 Purpose

The `interrupt` keyword marks one source-level function as a callback-only interrupt handler. The
selected platform entry path determines its machine entry/exit variant. A raw CPU-vector variant
saves registers and ends in `RTI`; a firmware-mediated variant must instead honor the firmware's
already-established stack frame and terminal contract. This distinction is part of the ABI, not an
optional optimization. Interrupt functions remain a core language feature because IRQ and NMI are
6502-family capabilities shared by the target platforms.

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
| Can it call other functions? | **Yes** — ordinary helpers retain their `JSR`/`RTS` ABI; SFA accounts for the interrupt execution domain (§7.5) |
| Can it be exported? | **Yes** — `export interrupt function ...` |
| How many per module? | No limit |

### 7.4 Generated Entry Variants

For a raw CPU interrupt vector, the compiler generates the standard 6502 save/restore variant:

```asm
; interrupt function onRasterIRQ(): void
onRasterIRQ:
    PHA             ; Save accumulator          (3 cycles)
    TXA             ;                            (2 cycles)
    PHA             ; Save X register            (3 cycles)
    TYA             ;                            (2 cycles)
    PHA             ; Save Y register            (3 cycles)
    CLD             ; Blend65 handler body begins in binary mode (2 cycles)
    
    ; ... compiled function body ...
    
    PLA             ; Restore Y register         (4 cycles)
    TAY             ;                            (2 cycles)
    PLA             ; Restore X register         (4 cycles)
    TAX             ;                            (2 cycles)
    PLA             ; Restore accumulator        (4 cycles)
    RTI             ; Return from interrupt       (6 cycles)
```

**Generated overhead**: 37 cycles + function body. 12 bytes of ROM for the
prologue/epilogue.

The NMOS 6502/6510 does not clear decimal mode on interrupt entry. Every compiler-generated
interrupt entry therefore establishes `D=0` before the first Blend65 statement or ordinary helper
call. This gives handler arithmetic the normal binary-language baseline. `RTI` restores the
hardware-stacked interrupted status, including its original decimal flag, so a raw or exclusive
variant needs no separate status save. An explicit `asm_sed()` inside the handler remains legal and
is governed by the ordinary decimal-mode diagnostics. The compiler may remove an entry
normalization only when a sound proof preserves both the body-entry and outgoing status contracts.

A compiler-recognized platform sink may select another entry variant for the same source handler.
For example, the C64 KERNAL CINV path has already pushed A, X, and Y before dispatching through
`$0314/$0315`. Its generated handler variant must not push those registers again and must end in
the profile-declared KERNAL chain or restore tail rather than execute `RTI` directly. A chained
variant preserves entry flags with `PHP`, clears decimal mode for the Blend65 body, and restores
those flags with `PLP` before the indirect jump so the prior handler observes its original entry
status. The two-byte indirect-vector link must not begin at `$xxFF` on NMOS targets. Only variants
that remain reachable are emitted. If one handler reaches more than one entry path, its body may be
specialized more than once; every generated byte, static link word, cycle path, stack byte, and SFA
home is charged and reported. The compiler must not add a generic dispatcher or runtime selector.

The handler body explicitly acknowledges the interrupt source it owns. The compiler never guesses
whether VIC, CIA, or another device caused the interrupt and never inserts a device acknowledge.

### 7.5 Execution-Domain SFA (INT-4)

The compiler models source handler identity, materialized entry ABI, and execution domain as
separate facts. An `interrupt function` is callback-only: source code cannot call it as an ordinary
function. Its raw variant ends in `RTI`; a platform-selected firmware variant ends through that
profile's declared tail. Ordinary helpers called by either variant retain `JSR`/`RTS` and may also
be used from mainline code.

If mainline, IRQ, NMI, re-enabled/nested interrupt roots, or escaped compiler-visible callbacks can
overlap while reaching the same storage-bearing function/helper path, each overlapping invocation
gets distinct static homes for parameters, returns, locals, staging values, temporaries, spills,
zero-page pairs, and helper scratch. Code may be shared when those homes can be bound safely;
specialized code variants are emitted only when fixed addresses or specialized callees require
them. Storage-free reentrant code may be shared unchanged.

The analysis closes after instruction selection and helper discovery. If the compiler cannot bound
the entry/nesting set or allocate non-overlapping invocation-private storage, compilation fails. It
must never accept silent frame or scratch corruption and must never introduce a dynamic stack or
runtime selector to hide an incomplete proof.

Globals, assets, and MMIO are deliberate shared program state and are not cloned. A byte access is
indivisible with respect to CPU interrupt entry, but cross-domain read-modify-write may lose an
update and multi-byte access may tear. Statically visible hazards receive diagnostics; the compiler
does not silently mask interrupts or duplicate shared state.

### 7.6 Complete Invocation-Private Closure

Execution-domain separation applies to all compiler-owned RAM and zero-page storage, including
late-introduced multiply/divide and indirect-address helpers. It is not limited to an early pool of
expression temporaries. All such storage is charged in the resource report.

### 7.7 Installation

Getting the address of an interrupt handler uses `&` (→ Ch 04, §8). A compiler-recognized
platform sink accepts only an `interrupt function`, preserves its identity, and selects the entry
variant required by that sink:

```blend65
import { setIRQ, setIRQExclusive } from c64.system;

// Default: install through KERNAL CINV and chain the saved previous handler.
setIRQ(&onRasterIRQ);

// Advanced: install through CINV, skip the previous handler, and use the
// profile-declared KERNAL restore/RTI tail.
setIRQExclusive(&onRasterIRQ);

// Advanced raw entry. This symbol exists only when the selected profile proves
// that its hardware vector is writable and active.
import { setRawIRQ } from c64.system;
setRawIRQ(&onRasterIRQ);

// E10252 on the default C64 profile: $0314 is a post-save KERNAL CINV hook,
// but &onRasterIRQ denotes the raw-entry address outside a recognized sink.
pokew($0314, &onRasterIRQ);
```

The C64 platform details and costs are defined by its profile (→ Ch 15 and Appendix A). A direct
write to an exactly recognized firmware vector is not an escape hatch: when the compiler can see
that a raw-entry address is being written to a sink with a different ABI, E10252 rejects it. An
address or vector that has become opaque remains an explicit unsafe hardware boundary; the
compiler keeps the function reachable but cannot certify the external entry/exit convention.

### 7.8 Stack Cost

| Item | Stack Bytes |
|------|-------------|
| CPU interrupt push (P, PCL, PCH) | 3 |
| Register save (A, X, Y) | 3, owned by the raw variant or by declared firmware |
| Chain-status preservation | 1 while a `PHP`/`PLP` chained variant executes; 0 for raw/exclusive variants |
| Each function call within handler | 2 (return address) |
| Explicit stack intrinsics reached in that entry | Path-sensitive peak delta |
| **Total per interrupt entry** | **Selected variant's declared body-entry stack bytes + active nested-call returns + explicit-stack peak** |

When entries can overlap, their live totals accumulate. The platform profile supplies raw stack
capacity/reserve plus interrupt-source masking and nesting constraints; it never pre-subtracts one
assumed entry.

---

## 8. Address-of for Functions

The `&` operator applied to a function name yields an address-compatible `word` (→ Ch 04, §8).
While the value remains compiler-visible, the compiler also retains the source function identity
and source handler kind for platform-sink checking, entry-variant selection, and execution-domain
analysis. Outside a compiler-recognized sink, `&interruptFunction` denotes its raw-entry address.
The selected platform profile identifies every recognized function-address sink, accepted source
kind, materialized entry variant, and execution domain.

```blend65
let handler: word = &onRasterIRQ;    // interrupt function address
let util: word = &clearScreen;       // regular function address
```

Address-taking makes the function live. Provenance follows direct scalar declaration, assignment,
copy, identity cast, and conditional selection while every possible source function remains known
and the storage has not escaped through an address, aggregate, array, raw memory operation, or
unknown external boundary. A recognized sink accepts the value only when every possible source has
its required source kind; an incompatible known source is E10244 and erased/unknown provenance is
E10247. A recognized sink consumes the retained identity and may therefore install a specialized
entry address rather than the raw numeric payload. Arithmetic, bitwise transformation,
non-identity casts, address escape, and unknown raw memory operations erase provenance. A direct
write whose destination is an exactly recognized incompatible vector is E10252; a genuinely opaque
raw boundary keeps an address-taken function reachable but cannot validate the external caller or
return convention. No hidden runtime check is added.

---

## 9. Cross-Module Functions

Functions can be shared between modules using `export` and `import` (→ Ch 10):

```blend65
// file: graphics.blend
module Graphics;
export function clearScreen(): void { }

// file: main.blend
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

## 10. Diagnostic Conditions

This chapter owns function, interrupt-entry, and execution-domain predicates. Chapter 14 owns their
public presentation.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10170 | A function declaration omits its return type. | The declaration is rejected. |
| E10171 | A call supplies the wrong number of arguments. | No call is emitted. |
| E10172 | An argument is incompatible with its parameter type. | No call is emitted. |
| E10173 | A void function returns a value. | The return statement is rejected. |
| E10174 | A non-void function uses bare `return;`. | The return statement is rejected. |
| E10175 | Call syntax targets a non-function value. | The expression is rejected. |
| E10176 | A function declaration occurs inside another function. | The nested declaration is rejected. |
| E10102 | A value-returning function has a reachable path that exits without a value. | The function is rejected. |
| E10180 | The call graph contains a direct self-edge. | Recursion is rejected. |
| E10181 | The call graph contains an indirect cycle. | Recursion is rejected with the ordered cycle. |
| E10050 | An interrupt function differs from `(): void`. | The entry declaration is rejected. |
| E10051 | Source code directly calls an interrupt-entry function. | The call is rejected; ordinary helpers remain callable. |
| E10244 | A known ordinary `RTS` function reaches a compiler-recognized interrupt-handler sink. | The ABI mismatch is rejected. |
| E10245 | A mainline/IRQ/NMI/callback path may re-enter without a static bound while consuming invocation-private storage or hardware stack. | Finite SFA homes or stack peak cannot be proven, so compilation fails. |
| E10246 | A `const` parameter resolves to a scalar or enum type rather than an array or struct. | The redundant/ineligible qualifier is rejected. |
| E10247 | A compiler-recognized function-address sink receives a value whose function/ABI provenance is erased or unknown. | The sink call is rejected; use a provenance-preserving value or an explicit raw hardware boundary. |
| E10248 | Explicit stack intrinsics underflow function entry, pull the wrong saved kind, join unequal kind sequences, or leave a nonempty relative sequence on exit. | The function is rejected because deterministic `RTS`/`RTI` state cannot be preserved. |
| E10252 | A compiler-visible raw interrupt-entry address is written directly to a recognized firmware vector that requires another entry ABI. | The write is rejected; use the profile API that selects the correct entry variant. |
| E10260 | An argument derived from a local address reaches a retaining or unproven parameter position, or such a value is returned. | The escaping use is rejected; use a proven non-retaining call, module-level storage, or caller-owned data. |

### Warning Conditions

| Code | Trigger | Consequence |
|------|---------|-------------|
| W10180 | Proven hardware-stack peak crosses the platform warning threshold. | Compilation continues with the measured peak. |
| W10181 | A private function is neither reachable nor exported. | No semantic change; the function may be unnecessary. |
| W10211 | A statically visible cross-domain read-modify-write can lose an update to shared state. | Compilation continues; shared state is not duplicated or protected. |
| W10212 | A statically visible multi-byte shared access can tear across execution domains. | Compilation continues; interrupt masking is not inserted. |

---

## 11. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Entry point** (→ Ch 10) | `main()` follows all Ch 06 rules. Signature must be `function main(): void`. Entry-point rules are additional constraints on top of function rules. |
| **Address-of** (→ Ch 04, §8) | `&functionName` returns `word`. Compiler marks functions as address-taken for SFA liveness. A local-origin address remains a borrow bounded by that local's dynamic lifetime; E10260 rejects a return, longer-lived store, or retaining/unknown call. |
| **Type system** (→ Ch 02) | Return type annotation required (TS-1). Argument types must match parameter types. Auto-promotion applies (TS-4). Mixed signedness is E10081 (→ Ch 02). |
| **Control flow** (→ Ch 05) | `return` is a control flow statement. Block scoping rules apply inside function bodies. E10101 (shadowing) applies to parameters vs. module-level names. E10102 (not all paths return) is enforced for non-void functions. |
| **Structs** (→ Ch 07) | Always passed by reference (FN-3). Cannot be returned (E10093). `const` modifier prevents modification. |
| **Arrays** (→ Ch 08) | Always passed by reference (FN-3). Cannot be returned (E10120). `const` modifier prevents modification. |
| **Enums** (→ Ch 09) | Enum values are `byte`-backed. Passed by value like any `byte`. Implicit enum→byte conversion applies in argument position. |
| **For loops** (→ Ch 05) | For-header locals and clause temporaries inside functions use ordinary function-frame liveness. |
| **Switch** (→ Ch 05) | Switch statements inside function bodies work normally. |
| **Operators** (→ Ch 04) | Function calls can appear as operands in expressions. Parameter evaluation is left-to-right (FN-10). |
| **Memory intrinsics** (→ Ch 04, §9) | `sizeof` and `offsetof` are compile-time. `length` is compile-time for a fixed array and reads the caller-supplied word count for an any-size parameter. All may be used in function bodies and arguments. |
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

export function clampByte(value: byte, lowBound: byte, highBound: byte): byte {
    if (value < lowBound) { return lowBound; }
    if (value > highBound) { return highBound; }
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

import { setIRQ } from c64.system;

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
    setIRQ(&onRasterIRQ);
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
