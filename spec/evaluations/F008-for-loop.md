# F008 — For loop

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)  
> **Replaces v2**: Both the C-style `for (init; cond; update)` and the `to`/`downto` forms. v3 uses **only** the `to`/`downto` form.

## Description

The `for` loop is Blend65's **counted iteration** construct. It iterates a variable over a numeric range with a compile-time constant step. The C-style `for (init; cond; update)` syntax from v2 is **removed** — all non-counted loops use `while` or `do-while`.

This design gives the compiler full knowledge of the iteration range, enabling optimal 6502 codegen (register-based counters, branch instructions) and preventing the performance pitfalls that plagued v2 (function calls in conditions, implicit multiplication in nested loops).

## Syntax

```blend65
for (let i: byte = 0 to 10) { }            // ascending, exclusive end
for (let i: byte = 9 downto 0) { }         // descending, inclusive end
for (let i: byte = 0 to 100 step 2) { }    // ascending with step
for (let i: byte = 99 downto 0 step 3) { } // descending with step
```

**EBNF:**
```ebnf
for_stmt = "for" , "(" , "let" , identifier , ":" , type , "=" , expression
         , ( "to" | "downto" ) , expression
         , [ "step" , const_expression ]
         , ")" , block ;
```

## Boundary Model (Kotlin-style)

Blend65 uses an **asymmetric boundary model**, following the same precedent as Kotlin:

| Keyword | Direction | End bound | Mnemonic |
|---------|-----------|-----------|----------|
| `to` | Ascending | **Exclusive** — end value is NOT visited | "up to X" = stops before X |
| `downto` | Descending | **Inclusive** — end value IS visited | "down to X" = reaches X |

**The one rule to remember:**
> **`to X` = goes up, doesn't reach X. `downto X` = goes down, reaches X.**

This matches natural English: "I counted to 10" (stopped before 10). "I counted down to 0" (reached 0).

**Examples:**

| Expression | Values visited | Iterations |
|------------|---------------|------------|
| `0 to 10` | 0, 1, 2, ..., 9 | 10 |
| `9 downto 0` | 9, 8, 7, ..., 0 | 10 |
| `0 to 256` | 0, 1, 2, ..., 255 | 256 (full byte range) |
| `255 downto 0` | 255, 254, ..., 0 | 256 (full byte range) |
| `0 to 100 step 2` | 0, 2, 4, ..., 98 | 50 |
| `99 downto 0 step 3` | 99, 96, ..., 3, 0 | 34 |
| `10 to 5` | *(none)* | 0 (empty range) |
| `5 downto 10` | *(none)* | 0 (empty range) |

**Why asymmetric?**
- `to` (exclusive) is optimal for array indexing: `for (i = 0 to length)` works correctly without off-by-one.
- `downto` (inclusive) is optimal for countdowns: `for (i = 7 downto 0)` naturally includes 0.
- With exclusive `downto`, you'd need `downto -1` to include 0 — impossible with unsigned `byte`.
- Kotlin uses exactly this model (`until` = exclusive ascending, `downTo` = inclusive descending).

## Evaluation Rules

| Aspect | Rule |
|--------|------|
| Start expression | Evaluated **once** at loop entry |
| End expression | Evaluated **once** at loop entry |
| Step expression | Must be a **compile-time constant** (evaluated at compile time) |
| Function calls in start/end | **Allowed** — safe because evaluated once, not every iteration |
| End value type | May exceed loop variable range (e.g., `256` for `byte` — used as compile-time bound only) |

The "evaluated once" semantics prevent the v2 problem where `for (i = 0; i < foo(); i++)` called `foo()` every iteration:

```blend65
// ✅ Safe — getCount() called exactly once
for (let i: byte = 0 to getCount()) {
    process(i);
}

// Equivalent to:
// let _end = getCount();
// for (let i: byte = 0 to _end) { process(i); }
```

## Loop Variable Rules

| Rule | Decision |
|------|----------|
| Declaration | Always `let name: type` — no reuse of existing variables |
| Type annotation | **Mandatory** — `byte` vs `word` generates different code |
| Scope | **Block-scoped** to the for statement — not accessible after `}` |
| Mutability | **Read-only** inside the body — cannot be assigned |
| Address-of (`&`) | Valid — follows F006 rules for local variables |
| After loop ends | Out of scope — capture value before `break` if needed |

**Block scoping** means two loops in the same function can use the same variable name:

```blend65
function update(): void {
    for (let i: byte = 0 to 8) { updateSprite(i); }    // first i
    for (let i: byte = 0 to 10) { updateEnemy(i); }    // second i — no conflict
    // Under SFA, both i's can share the same frame slot (non-overlapping lifetimes)
}
```

**Read-only** prevents a class of subtle bugs:

```blend65
for (let i: byte = 0 to 10) {
    i = 5;    // ❌ E10060: Cannot assign to for-loop variable
}
```

## `break` and `continue`

Both are supported. **Neither involves hidden cost** — they compile to the same branch instructions used in `if` statements.

| Keyword | Behavior | 6502 Code | Cost |
|---------|----------|-----------|------|
| `break` | Exits the innermost loop | BEQ/BNE (or JMP if >127 bytes) | 2-3 bytes, 2-3 cycles |
| `continue` | Skips to compiler-controlled increment | BEQ/BNE (or JMP if >127 bytes) | 2-3 bytes, 2-3 cycles |

```blend65
// break — search for value
let foundIndex: byte = 255;
for (let i: byte = 0 to 100) {
    if (data[i] == target) {
        foundIndex = i;    // capture before breaking (i is out of scope after loop)
        break;
    }
}

// continue — skip specific values
for (let i: byte = 0 to 10) {
    if (i == 5) {
        continue;          // skip to next iteration (i incremented by compiler)
    }
    process(i);            // called for 0,1,2,3,4,6,7,8,9
}
```

`break` only exits the **innermost** loop. For multi-level break, use a flag variable:

```blend65
let found: boolean = false;
for (let y: byte = 0 to 25) {
    for (let x: byte = 0 to 40) {
        if (screen[y * 40 + x] == target) {
            found = true;
            break;         // exits inner loop only
        }
    }
    if (found) { break; }  // exits outer loop
}
```

Labeled `break` (e.g., `break outer;`) is deferred to a future version (see FUT-006).

## Step Rules

| Rule | Decision |
|------|----------|
| Default step | **1** when `step` keyword is omitted |
| Step must be | **Compile-time constant**, positive integer |
| Step of zero | **E10061**: compile error |
| Step direction | Implicit — `to` always increments, `downto` always decrements |

**Why compile-time constant?** This enables optimal codegen:
- Step 1 → `INX`/`DEX` (1 byte, 2 cycles)
- Step 2 → `INX`+`INX` (2 bytes, 4 cycles)
- Step N > 2 → `CLC`/`ADC #N` (3 bytes, 4-5 cycles) or multiple INC

If you need a variable step, use `while`:
```blend65
let i: byte = start;
while (i < end) {
    process(i);
    i = i + stride;    // variable step
}
```

## Generated Code Patterns (6502)

These patterns show the typical assembly output. The compiler may use different strategies depending on the range and step for optimal performance.

**Ascending byte, step 1 (`0 to 10`):**
```asm
    LDX #0              ; i = 0               (2 bytes, 2 cycles)
.loop:
    ; ... body ...
    INX                  ; i += 1              (1 byte, 2 cycles)
    CPX #10              ; compare with end    (2 bytes, 2 cycles)
    BNE .loop            ; loop if i != 10     (2 bytes, 2-3 cycles)
```
*Overhead: 5 bytes setup + 5 bytes/iteration, 6-7 cycles/iteration*

**Full byte range ascending (`0 to 256`):**
```asm
    LDX #0              ; i = 0
.loop:
    ; ... body ...
    INX                  ; i += 1 (wraps 255→0)
    BNE .loop            ; loop while i != 0   (optimal — no CPX needed!)
```
*Overhead: 2 bytes setup + 3 bytes/iteration, 4-5 cycles/iteration*

**Descending byte, inclusive zero (`9 downto 0`):**
```asm
    LDX #10             ; start+1 (for pre-decrement trick)
.loop:
    DEX                  ; i -= 1 (first iteration: i = 9)
    ; ... body ...
    BNE .loop            ; loop while i != 0 (after body with i=0: DEX set Z=1)
```
*Overhead: 2 bytes setup + 3 bytes/iteration, 4-5 cycles/iteration*

Note: For start values > 254 (full byte range `255 downto 0`), the compiler uses an alternate pattern with explicit end-of-range detection.

**Word counter (`0 to 1000`):**
```asm
    LDA #0               ; i_lo = 0
    STA _i_lo
    LDA #0               ; i_hi = 0
    STA _i_hi
.loop:
    ; ... body (uses _i_lo/_i_hi) ...
    INC _i_lo            ; 16-bit increment
    BNE .no_carry
    INC _i_hi
.no_carry:
    LDA _i_hi            ; 16-bit compare with 1000 ($03E8)
    CMP #$03
    BCC .loop            ; hi < end_hi → continue
    BNE .done            ; hi > end_hi → stop
    LDA _i_lo
    CMP #$E8
    BCC .loop            ; lo < end_lo → continue
.done:
```
*Overhead: ~15-20 cycles/iteration — significantly more expensive than byte counter*

## Ambiguities Resolved

| # | ID | Ambiguity | Resolution |
|---|------|-----------|------------|
| 1 | FOR-1 | Which syntax form? | **`to`/`downto` only** — C-style `for (init; cond; update)` removed. Use `while` for non-counted loops. |
| 2 | FOR-2 | Boundary semantics | **`to` = exclusive end, `downto` = inclusive end** (Kotlin model). Matches natural English and common use cases. |
| 3 | FOR-3 | End value evaluation | **Once at loop entry** (Pascal semantics). Prevents re-evaluation cost and accidental infinite loops. |
| 4 | FOR-4 | Function calls in for-header | **Allowed** — safe because evaluated once, not every iteration. This eliminates the v2 `foo()` in condition problem. |
| 5 | FOR-5 | Loop variable scope | **Block-scoped** to the for statement. Not accessible after `}`. Two loops in the same function can reuse the same name. Under SFA, non-overlapping lifetimes can share frame memory. |
| 6 | FOR-6 | Loop variable mutability | **Read-only** inside the body. Prevents bugs, enables register allocation. **E10060** on assignment attempt. |
| 7 | FOR-7 | Step constraints | **Compile-time constant**, positive integer, default 1. Enables optimal codegen. Variable step → use `while`. |
| 8 | FOR-8 | Step of zero | **E10061** compile error — always detectable since step is a compile-time constant. |
| 9 | FOR-9 | `downto 0` with unsigned byte | **Inclusive** — 0 IS visited. Compiler generates correct codegen (pre-decrement + BNE, or explicit end check). No wrapping issue. |
| 10 | FOR-10 | `to 256` with byte counter | **Allowed** — `256` is a compile-time bound, not stored in the loop variable. Compiler generates optimal `INX` + `BNE` pattern (256 iterations, wrap-based termination). |
| 11 | FOR-11 | Empty range (`to` with start ≥ end, `downto` with start < end) | **Zero iterations** — body never executes. No error or warning. Compiler generates skip-check for variable bounds; constant empty ranges are eliminated at compile time. |
| 12 | FOR-12 | `continue` semantics | **Skips to compiler-controlled increment**, then condition check. Unambiguous because the update is implicit (no explicit update expression to question). |
| 13 | FOR-13 | Nested loop variable shadowing | **E10062** — prohibited. Inner loop cannot reuse the name of an outer loop's variable. Prevents confusion. |
| 14 | FOR-14 | `word` loop counter cost | **W10060** warning when the loop range fits in `byte` but the developer declared `word`. Word counters cost ~15-20 cycles/iteration vs 6-7 for byte. |
| 15 | FOR-15 | Loop variable value after loop/break | **Out of scope** — block scoping means the variable doesn't exist after the loop. Capture the value before `break` if needed. |
| 16 | FOR-16 | `break` from nested loops | **Innermost only** — standard behavior. Use flag variable for multi-level exit. Labeled `break` deferred (FUT-006). |
| 17 | FOR-17 | Type inference for loop variable | **Not allowed** — type annotation is mandatory. `byte` vs `word` generates fundamentally different code on 6502. Aligns with A4 (explicit over implicit). |

## v2 Migration Guide

| v2 Syntax | v3 Syntax |
|-----------|-----------|
| `for (let i: byte = 0; i < 10; i += 1) { }` | `for (let i: byte = 0 to 10) { }` |
| `for (let i: byte = 0; i < n; i += 1) { }` | `for (let i: byte = 0 to n) { }` |
| `for (i = 0 to 10) { }` (v2 inclusive) | `for (let i: byte = 0 to 11) { }` (v3 exclusive) |
| `for (count = 10 downto 0) { }` (v2 inclusive) | `for (let count: byte = 10 downto 0) { }` (v3 inclusive — same!) |
| `for (let i: byte = 0; i < foo(); i += 1) { }` | `for (let i: byte = 0 to foo()) { }` (safe — called once) |
| `for (i = 0 to 100 step 2) { }` | `for (let i: byte = 0 to 101 step 2) { }` (v3 exclusive: adjust end) |

## Examples

**Basic ascending and descending:**
```blend65
module Game;

function main(): void {
    // Clear 8 sprites (indices 0–7)
    for (let i: byte = 0 to 8) {
        clearSprite(i);
    }

    // Fade out brightness (255 down to 0)
    for (let brightness: byte = 255 downto 0) {
        setBrightness(brightness);
        delay(2);
    }
}
```

**Pattern: Game entity update loop with variable bound:**
```blend65
module Game;

let numEnemies: byte = 0;

function updateEnemies(): void {
    // numEnemies evaluated ONCE at loop entry
    for (let i: byte = 0 to numEnemies) {
        moveEnemy(i);
        checkCollision(i);
    }
}
```

**Pattern: Efficient screen operations (avoiding multiplication):**
```blend65
module Graphics;

zeropage {
    screenPtr: word;
}

const SCREEN_BASE: word = $0400;

// ✅ GOOD: Pointer-based — no multiplication
function clearScreen(ch: byte): void {
    screenPtr = SCREEN_BASE;
    for (let i: word = 0 to 1000) {
        poke(screenPtr, ch);
        screenPtr = screenPtr + 1;
    }
}

// ❌ AVOID: Nested loops with multiplication (slow on 6502!)
// for (let y: byte = 0 to 25) {
//     for (let x: byte = 0 to 40) {
//         poke(SCREEN_BASE + y * 40 + x, 32);  // y*40 = ~100 cycles per call!
//     }
// }
```

**Edge cases:**
```blend65
module Examples;

function edgeCases(): void {
    // Full byte range — all 256 values
    for (let i: byte = 0 to 256) {
        process(i);        // i = 0, 1, 2, ..., 255
    }

    // Full byte range descending — all 256 values
    for (let i: byte = 255 downto 0) {
        process(i);        // i = 255, 254, ..., 0
    }

    // Empty range — body never executes
    for (let i: byte = 10 to 5) {
        neverCalled();     // zero iterations
    }

    // Step with descending
    for (let i: byte = 20 downto 0 step 5) {
        process(i);        // i = 20, 15, 10, 5, 0
    }

    // Capturing loop variable before break
    let found: byte = 255;
    for (let i: byte = 0 to 100) {
        if (data[i] == target) {
            found = i;
            break;
        }
    }
    // i is out of scope here — use 'found' instead
}
```

## Errors

| Code | Condition | Message |
|------|-----------|---------|
| E10060 | Assign to for-loop variable | `Cannot assign to for-loop variable '<name>' — loop variables are read-only` |
| E10061 | Step value is zero | `Step value must not be zero — this would create an infinite loop` |
| E10062 | Shadowed variable in nested loop | `Variable '<name>' already declared in enclosing for-loop — use a different name` |
| E10063 | `break`/`continue` outside loop | `'<keyword>' can only be used inside a loop body` |

## Warnings

| Code | Condition | Message |
|------|-----------|---------|
| W10060 | `word` counter where `byte` suffices | `Loop counter '<name>' uses 'word' but range 0..<N> fits in 'byte' — use 'byte' for faster loop execution (6-7 cycles/iteration vs 15-20)` |

## Feature Interaction Summary (L8)

| Feature | Interaction |
|---------|-------------|
| F003 (Module contents) | For loops cannot appear at module level (E10010 — executable code must be inside functions) |
| F005 (Memory placement) | Loop variable is in the function's SFA frame. Compiler may keep byte counters in X/Y registers for performance |
| F006 (Address-of) | `&loopVar` is valid — follows F006 rules for local variables |
| F007 (Interrupt functions) | For loops can appear in interrupt handlers. Separate ZP temps ensure no corruption |

## Language Guard Verdict

- **P1 Cross-platform** ✅ — Loop constructs are universal. `to`/`downto` compile to standard 6502 instructions on all platforms.
- **P2 Platform-meaningful** ✅ — Counted loops are fundamental to every game/demo/application on every platform.
- **P3 No platform assumptions** ✅ — No hardware addresses or platform names in the loop spec.
- **P4 Resource-scalable** ✅ — W10060 warns when `word` counter is used unnecessarily. Byte counters are optimal on all platforms.
- **H1 6502 implementable** ✅ — Maps directly to `INX`/`DEX` + `CPX`/`BNE` patterns. Documented codegen for all cases.
- **H2 Cost transparency** ✅ — Byte loop: 5-7 cycles/iteration. Word loop: 15-20 cycles/iteration. `break`/`continue`: 2-3 bytes, 2-3 cycles each. All costs documented.
- **H3 SFA compatible** ✅ — Loop variables are part of the function's static frame. Block scoping allows frame slot reuse for non-overlapping lifetimes.
- **H4 Memory footprint** ✅ — Byte loop: 7-10 bytes ROM. Word loop: 15-25 bytes ROM. Step and range affect the exact count.
- **H5 Deterministic** ✅ — Every combination of start, end, step, and type produces defined behavior. Empty ranges = zero iterations. Wrapping is handled by codegen. Step of zero is a compile error.
- **L1 Unambiguous** ✅ — One parsing strategy. `to`/`downto` are keywords. No C-style `for` to conflict with.
- **L2 Consistent** ✅ — Block syntax matches `if`/`while`. `let name: type` matches all variable declarations. Boundary model follows Kotlin precedent.
- **L3 Beginner-friendly** ✅ — `for (let i: byte = 0 to 10)` reads naturally. Any developer can guess what it does. One-sentence boundary rule.
- **L4 Minimal** ✅ — Two keywords (`to`, `downto`), optional `step`, one variable declaration. No C-style `for` complexity.
- **L5 No redundancy** ✅ — Replaces v2's two incompatible loop syntaxes with one clean form. Non-counted loops use `while`.
- **L6 Error messages** ✅ — E10060 (assign to read-only), E10061 (zero step), E10062 (shadowing), E10063 (break/continue outside loop).
- **L7 Compile-time failure** ✅ — Zero step, type mismatches, shadowing all caught at compile time. No runtime failures from loop mechanics.
- **L8 Feature interaction** ✅ — Interactions with F003, F005, F006, F007 explicitly documented above.
- **L9 Documentable** ✅ — Prose + basic examples + pattern examples + edge cases all provided.
- **C1 Lexer/parser** ✅ — `KW_FOR`, `LPAREN`, `KW_LET`, `IDENT`, `COLON`, `TYPE`, `ASSIGN`, `EXPR`, `KW_TO`|`KW_DOWNTO`, `EXPR`, [`KW_STEP`, `CONST_EXPR`], `RPAREN`, `BLOCK`. Standard recursive descent.
- **C2 Semantic analysis** ✅ — Check: start fits in type, end is valid bound, step > 0, variable read-only, no shadowing, break/continue inside loop.
- **C3 Code generation** ✅ — Documented 6502 patterns for byte ascending, full range, descending inclusive, word counter. Compiler selects optimal pattern per range.
- **C4 Unit testable** ✅ — Lexer: `KW_FOR`, `KW_TO`, `KW_DOWNTO`, `KW_STEP` tokens. Parser: for-stmt AST node. Semantic: read-only check, shadowing check. Codegen: register-based byte loops vs memory-based word loops.
- **C5 Runtime verifiable** ✅ — Compile loop programs, run in emulator, verify counter values at each iteration via memory inspection.
- **F1 Extensible** ✅ — Future: labeled `break` (FUT-006), `for-in` over arrays, parallel iterators.
- **F2 Platform-profile ready** ✅ — No platform-specific behavior. All codegen uses standard 6502 instructions.
- **F3 Optimizer-friendly** ✅ — Compile-time known bounds enable loop unrolling, strength reduction, dead loop elimination.
- **F4 Stability** ✅ — Classified as **Stable**.

