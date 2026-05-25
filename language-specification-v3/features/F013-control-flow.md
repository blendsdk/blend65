# F013 — Control Flow: If/Else, While, Do-While, Block Scoping

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)  
> **Replaces v2**: Formalizes if/else (v2 §5 "If Statement"), while (v2 §5 "While Loop"), do-while (v2 §5 "Do-While Loop"), and adds formal block scoping rules absent from v2.

## Description

This feature formalizes the core control flow statements and block scoping rules for Blend65 v3:

1. **If/else** — conditional branching
2. **While** — condition-tested loop (0 or more iterations)
3. **Do-while** — body-first loop (1 or more iterations)
4. **Block scoping** — variable lifetime rules for all block constructs, including bare blocks

These are foundational constructs that every program uses. The design enforces **mandatory braces** (preventing the entire class of dangling-statement bugs), **strict boolean conditions** (A4: explicit over implicit), and **formal scoping rules** that integrate with SFA frame allocation for memory reuse.

---

## Syntax

### If/Else

```ebnf
if_stmt = "if" , "(" , expression , ")" , block
        , [ "else" , ( if_stmt | block ) ] ;

block = "{" , { statement } , "}" ;
```

```blend65
// Basic if
if (health <= 0) {
    gameOver();
}

// If-else
if (health <= 0) {
    gameOver();
} else {
    continueGame();
}

// If-else if-else chain
if (score > 1000) {
    showGold();
} else if (score > 500) {
    showSilver();
} else if (score > 100) {
    showBronze();
} else {
    showNothing();
}
```

### While

```ebnf
while_stmt = "while" , "(" , expression , ")" , block ;
```

```blend65
// Standard while
while (health > 0) {
    update();
    render();
}

// Infinite game loop
while (true) {
    readInput();
    updateGame();
    renderFrame();
    waitVBlank();
}
```

### Do-While

```ebnf
do_while_stmt = "do" , block , "while" , "(" , expression , ")" , ";" ;
```

**Note:** The do-while statement requires a semicolon after the closing parenthesis. This is the only block-containing statement that requires a trailing semicolon.

```blend65
// Execute at least once
do {
    key = readKeyboard();
} while (key == 0);

// Menu loop — always shows at least once
do {
    showMenu();
    choice = getChoice();
} while (choice != EXIT);
```

### Bare Blocks

```ebnf
bare_block = block ;
```

Standalone blocks with no control flow keyword. Used for explicit scoping to enable SFA frame slot reuse:

```blend65
function complexInit(): void {
    // Block 1: initialize sprites
    {
        let temp: word = SPRITE_BASE;
        for (let i: byte = 0 to 8) {
            poke(temp, 0);
            temp = temp + 64;
        }
    }
    // Block 2: initialize sound — 'temp' reuses the same frame slot
    {
        let temp: word = SID_BASE;
        for (let reg: byte = 0 to 25) {
            poke(temp, 0);
            temp = temp + 1;
        }
    }
}
```

---

## Rules

### CF-1: Mandatory Braces

All control flow bodies **must** use curly braces. There is no braceless form.

```blend65
// ✅ Correct
if (x > 0) {
    doSomething();
}

// ❌ Parse error — braces required
if (x > 0)
    doSomething();

// ❌ Parse error — braces required
while (running)
    update();
```

**Rationale:** On 6502, there is no debugger, no stack trace, and no memory protection. A misplaced statement due to a missing brace causes silent memory corruption or hard crashes with zero diagnostics. Mandatory braces eliminate the entire class of "dangling statement" bugs (including the infamous Apple `goto fail` vulnerability).

### CF-2: Conditions Must Be Boolean

The condition expression in `if`, `while`, and `do-while` **must** be of type `boolean`. Numeric types (`byte`, `sbyte`, `word`, `sword`) are not implicitly truthy.

```blend65
let count: byte = 5;
let running: boolean = true;

// ✅ Correct — boolean conditions
if (running) { }
if (count > 0) { }
if (count != 0) { }
while (running) { }
while (count < 100) { }
do { } while (count != 0);

// ❌ E10100 — numeric type used as condition
if (count) { }           // Use: if (count != 0) { }
while (count) { }        // Use: while (count != 0) { }
do { } while (count);    // Use: do { } while (count != 0);
```

**Valid boolean expressions include:**
- Boolean variables: `running`, `found`
- Boolean literals: `true`, `false`
- Comparison operators: `x > 0`, `a == b`, `count != 0`, `health <= 0`
- Logical operators: `a && b`, `a || b`, `!flag`
- Boolean-returning function calls: `isAlive()`

**Rationale:** Consistent with A4 (explicit over implicit) and F010 (no implicit type conversions). Requiring explicit comparison catches real bugs: `if (index)` when `if (index < max)` was intended. The 6502 codegen is identical — `count != 0` compiles to the same `LDA count; BEQ` as a truthy check would.

### CF-3: Block Scoping

Variables declared inside a block `{ }` are **scoped to that block**. They are created at the declaration point and cease to exist at the closing `}`.

Block scoping applies to all block constructs:
- If body and else body
- While body
- Do-while body
- For-loop body (already defined in F008)
- Bare blocks

```blend65
function example(): void {
    let x: byte = 10;
    
    if (x > 5) {
        let y: byte = 20;     // y scoped to if-body
        process(x, y);
    }
    // y is OUT OF SCOPE here — cannot be accessed
    
    {
        let z: byte = 30;     // z scoped to bare block
    }
    // z is OUT OF SCOPE here
}
```

**SFA Integration:** Block-scoped variables are part of the enclosing function's static frame. Variables in non-overlapping blocks can **share** the same frame bytes, reducing memory usage:

```blend65
function update(): void {
    if (phase == 1) {
        let buffer: byte[40];    // 40 bytes in frame
        fillBuffer(buffer);
    }
    if (phase == 2) {
        let scratch: byte[40];   // shares same 40 bytes (non-overlapping lifetime)
        compute(scratch);
    }
    // Function frame = 40 bytes total, NOT 80
}
```

### CF-4: No Variable Shadowing

An inner scope **cannot** declare a variable with the same name as a variable in any enclosing scope. This prevents accidental name collision bugs that are nearly impossible to debug on 6502.

```blend65
function example(): void {
    let x: byte = 10;
    
    if (condition) {
        let x: byte = 20;    // ❌ E10101: shadows 'x' from enclosing scope
    }
    
    while (running) {
        let x: byte = 30;    // ❌ E10101: shadows 'x' from enclosing scope
        {
            let x: byte = 40;    // ❌ E10101: shadows 'x' from two levels up
        }
    }
}
```

This rule generalizes F008's FOR-13 (no shadowing of for-loop variables in nested loops). The for-loop specific error E10062 is a specialization of the general shadowing rule E10101.

**Scope nesting hierarchy (innermost to outermost):**
1. Bare block scope
2. If/else body scope, while body scope, do-while body scope, for-loop body scope
3. Function parameter scope
4. Function body scope (outermost local scope)
5. Module scope (module-level variables)

Shadowing is prohibited across **all** scope boundaries. A local variable cannot shadow a module-level variable, and a block-scoped variable cannot shadow a function-level variable.

### CF-5: Variable Name Reuse in Sequential Scopes

Variables in **non-overlapping** scopes (sequential blocks at the same nesting level) **can** reuse the same name. This is not shadowing because the earlier variable is already out of scope.

```blend65
function example(): void {
    // Block 1
    {
        let temp: byte = 0;
        process(temp);
    }
    // temp is out of scope
    
    // Block 2 — reuses 'temp', shares frame slot
    {
        let temp: byte = 0;   // ✅ OK — previous temp is out of scope
        compute(temp);
    }
    
    // Sequential for-loops (already established in F008)
    for (let i: byte = 0 to 8) { updateSprite(i); }
    for (let i: byte = 0 to 10) { updateEnemy(i); }    // ✅ OK — reuse
    
    // If/else branches — non-overlapping
    if (x > 0) {
        let result: byte = computeA();
    } else {
        let result: byte = computeB();    // ✅ OK — if and else bodies don't overlap
    }
}
```

### CF-6: Break and Continue

`break` and `continue` work in `while` and `do-while` loops, following the same rules established for `for` loops in F008:

| Keyword | While | Do-While |
|---------|-------|----------|
| `break` | Exits loop immediately | Exits loop immediately (skips condition check) |
| `continue` | Jumps to condition check (next iteration) | Jumps to condition check at bottom |

```blend65
// break in while
while (running) {
    let key: byte = readInput();
    if (key == KEY_QUIT) {
        break;    // exits while loop
    }
    processKey(key);
}

// continue in while — skips to condition re-evaluation
while (hasMore()) {
    let item: byte = getNext();
    if (item == SKIP_VALUE) {
        continue;    // jumps to hasMore() check
    }
    process(item);
}

// break in do-while — exits before condition
do {
    let result: byte = tryOperation();
    if (result == SUCCESS) {
        break;    // exits do-while, condition NOT evaluated
    }
    retryCount = retryCount + 1;
} while (retryCount < MAX_RETRIES);

// continue in do-while — jumps to condition
do {
    let ch: byte = readChar();
    if (ch == SPACE) {
        continue;    // jumps to condition check (ch != NEWLINE)
    }
    processChar(ch);
} while (ch != NEWLINE);
```

Error E10063 (from F008) applies uniformly: `break`/`continue` can only be used inside a loop body (`for`, `while`, or `do-while`).

**Interaction with switch (F009):** Switch is transparent to `break`/`continue`. Inside a switch that is inside a loop, `break` exits the **loop**, not the switch:

```blend65
while (running) {
    switch (state) {
        case STATE_IDLE:
            if (inputReady()) {
                state = STATE_ACTIVE;
            }
        case STATE_DONE:
            break;    // exits the WHILE loop, not the switch
    }
}
```

### CF-7: Do-While Semicolon

The do-while statement requires a trailing semicolon after `while (condition)`:

```blend65
do {
    update();
} while (running);    // ← semicolon required
```

This is the **only** block-containing statement that requires a trailing semicolon, consistent with C, Java, and TypeScript.

**Statement termination summary (updated from v2):**

| Statement | Semicolon | Reason |
|-----------|-----------|--------|
| `if (cond) { }` | No | Self-terminating with `}` |
| `while (cond) { }` | No | Self-terminating with `}` |
| `do { } while (cond);` | **Yes** | Ends with `)`, not `}` |
| `for (... to ...) { }` | No | Self-terminating with `}` |
| `switch (expr) { }` | No | Self-terminating with `}` |
| `{ }` (bare block) | No | Self-terminating with `}` |

---

## Generated Code Patterns (6502)

### If (no else)

```blend65
if (x > 10) {
    doSomething();
}
```

```asm
    LDA _x
    CMP #11          ; x > 10 means x >= 11
    BCC .endif       ; branch if x < 11 (condition false)
    JSR _doSomething
.endif:
```
*Cost: 4–5 bytes condition check + 2 bytes branch = 6–7 bytes overhead*

### If-Else

```blend65
if (health == 0) {
    gameOver();
} else {
    continueGame();
}
```

```asm
    LDA _health
    BNE .else        ; health != 0 → else branch
    JSR _gameOver
    JMP .endif
.else:
    JSR _continueGame
.endif:
```
*Cost: condition bytes + 2 bytes BNE + 3 bytes JMP = 7–8 bytes overhead*

### If-Else If-Else Chain

```blend65
if (state == 0) {
    showMenu();
} else if (state == 1) {
    playGame();
} else {
    showPause();
}
```

```asm
    LDA _state
    CMP #0
    BNE .elseif1
    JSR _showMenu
    JMP .endif
.elseif1:
    CMP #1           ; A still holds _state (optimization)
    BNE .else
    JSR _playGame
    JMP .endif
.else:
    JSR _showPause
.endif:
```
*Note: The compiler can retain the tested value in the accumulator across comparisons when the body does not modify it. For long chains on a single variable, `switch` (F009) is more efficient (jump table).*

### While

```blend65
while (count < 100) {
    process();
    count = count + 1;
}
```

**Pattern: condition at bottom (preferred — one branch per iteration):**

```asm
    JMP .check
.loop:
    JSR _process
    INC _count
.check:
    LDA _count
    CMP #100
    BCC .loop        ; branch if count < 100 (backward — common case)
```
*Cost: 3 bytes initial JMP + condition bytes + 2 bytes BCC per iteration*

### While (true) — Infinite Loop

```blend65
while (true) {
    gameLoop();
}
```

```asm
.loop:
    JSR _gameLoop
    JMP .loop        ; unconditional — no condition check
```
*Cost: 3 bytes JMP per iteration (7 cycles). The compiler recognizes `while (true)` and omits condition evaluation entirely.*

### Do-While

```blend65
do {
    key = readKeyboard();
} while (key == 0);
```

```asm
.loop:
    JSR _readKeyboard
    STA _key
    LDA _key
    BEQ .loop        ; loop while key == 0 (backward branch)
```
*Cost: condition bytes + 2 bytes branch per iteration. No initial JMP needed — the most efficient loop form on 6502.*

### Break and Continue in While

```blend65
while (running) {
    let k: byte = readKey();
    if (k == 0) {
        continue;
    }
    if (k == KEY_QUIT) {
        break;
    }
    processKey(k);
}
```

```asm
    JMP .check
.loop:
    JSR _readKey
    STA _k
    BNE .not_zero
    JMP .check        ; continue → jump to condition
.not_zero:
    CMP #KEY_QUIT
    BNE .no_quit
    JMP .done         ; break → exit loop
.no_quit:
    LDA _k
    JSR _processKey
.check:
    LDA _running
    BNE .loop
.done:
```

### Continue in Do-While

```blend65
do {
    let ch: byte = readChar();
    if (ch == SPACE) {
        continue;     // jumps to condition, not to loop top
    }
    processChar(ch);
} while (ch != NEWLINE);
```

```asm
.loop:
    JSR _readChar
    STA _ch
    CMP #SPACE
    BNE .not_space
    JMP .cond         ; continue → jump to condition at bottom
.not_space:
    LDA _ch
    JSR _processChar
.cond:
    LDA _ch
    CMP #NEWLINE
    BNE .loop         ; loop while ch != NEWLINE
```

---

## Ambiguities Resolved

| # | ID | Ambiguity | Resolution |
|---|------|-----------|------------|
| 1 | CF-A1 | Should conditions accept numeric types (truthy) or require boolean? | **Boolean only** (E10100). Consistent with A4 (explicit over implicit) and F010 (no implicit conversions). `x != 0` compiles to identical 6502 code as a truthy check would. |
| 2 | CF-A2 | Should braceless if/while be allowed? | **No — mandatory braces**. Eliminates dangling-statement bugs. On 6502, these bugs cause silent corruption with zero diagnostics. Consistent with A1 (C-like syntax with curly braces). |
| 3 | CF-A3 | Include do-while in v3 or defer? | **Include**. Do-while is the most natural loop form on 6502 (body + backward branch, no initial JMP). Deferring it would force `while (true) { ...; if (!cond) { break; } }` workarounds. |
| 4 | CF-A4 | Allow standalone bare blocks? | **Yes**. Bare blocks enable explicit SFA frame slot reuse for non-overlapping variable lifetimes. Zero runtime cost. Follows naturally from block scoping rules. |
| 5 | CF-A5 | Allow variable shadowing in nested blocks? | **No** (E10101). Prevents accidental name collisions that are nearly impossible to debug on 6502. Generalizes F008's FOR-13 rule to all scope boundaries. |
| 6 | CF-A6 | Allow name reuse in sequential non-overlapping blocks? | **Yes**. Sequential blocks at the same level can reuse names — the earlier variable is out of scope. Enables SFA frame slot sharing. Already established for sequential for-loops in F008. |
| 7 | CF-A7 | How is `else if` parsed? | **Composed**: `else` followed by `if_stmt`. No special grammar production. Naturally supports arbitrary chain depth. The `else if` form is NOT syntactic sugar — it's just the `else` clause containing an `if` statement. |
| 8 | CF-A8 | What does `continue` do in do-while? | **Jumps to the condition check** at the bottom of the loop. Standard C/Java/TypeScript behavior. Body is skipped from the `continue` point, but the condition is always re-evaluated before deciding to iterate. |
| 9 | CF-A9 | How do break/continue interact with switch-inside-loop? | **Switch is transparent** to break/continue (established in F009). `break` inside a switch-inside-a-loop exits the **loop**. `continue` inside a switch-inside-a-loop continues the **loop**. |
| 10 | CF-A10 | Are parentheses required around conditions? | **Yes**. Consistent with A1 (C-like syntax) and familiar to C/TypeScript/JavaScript developers (L3). Syntax: `if (expr)`, not `if expr`. |
| 11 | CF-A11 | Are empty block bodies allowed? | **Yes**, no error or warning. Empty bodies are useful during development (stubs) and in some patterns (busy-wait: `while (!ready) { }`). A future linter could optionally flag them. |
| 12 | CF-A12 | Should `while (true)` produce a warning? | **No**. Infinite loops are intentional and fundamental in game programming (main game loop). The compiler recognizes `while (true)` and optimizes away the condition check entirely (emits `JMP` instead of condition + branch). |
| 13 | CF-A13 | Does block scoping interact with SFA? | **Yes — beneficially**. Variables in non-overlapping blocks share frame bytes. The compiler's SFA analysis uses block scope boundaries to determine variable lifetimes and maximize frame slot reuse. This is a key advantage of formal block scoping. |
| 14 | CF-A14 | Can `if`/`while`/`do-while` appear inside all contexts? | **Yes**, wherever a statement is valid: function bodies, loop bodies, other if/else bodies, switch case bodies. **Not** at module level (E10010). Nesting depth is unlimited by the language, though deeply nested code may exhaust stack during compilation — the compiler should handle this gracefully. |
| 15 | CF-A15 | How does the no-shadowing rule interact with module-level variables? | **Module-level variables are in scope inside all functions in that module.** A function-local variable cannot shadow a module-level variable. An if-body variable cannot shadow either. This is stricter than C (which allows local-over-global shadowing) but prevents a class of bugs. |

---

## Examples

### Pattern: Game State Machine

```blend65
module Game;

let state: byte = STATE_MENU;
let running: boolean = true;

function main(): void {
    while (running) {
        if (state == STATE_MENU) {
            drawMenu();
            let choice: byte = getMenuChoice();
            if (choice == CHOICE_PLAY) {
                state = STATE_PLAYING;
            } else if (choice == CHOICE_QUIT) {
                running = false;
            }
        } else if (state == STATE_PLAYING) {
            updateGame();
            renderGame();
            if (isGameOver()) {
                state = STATE_GAMEOVER;
            }
        } else if (state == STATE_GAMEOVER) {
            drawGameOver();
            do {
                let key: byte = readKey();
            } while (key == 0);
            state = STATE_MENU;
        }
        waitVBlank();
    }
}
```

### Pattern: Input Polling with Do-While

```blend65
module Input;

function waitForKey(): byte {
    let key: byte = 0;
    do {
        key = readKeyboard();
    } while (key == 0);
    return key;
}

function confirmChoice(): boolean {
    let confirmed: boolean = false;
    do {
        let key: byte = waitForKey();
        if (key == KEY_Y) {
            confirmed = true;
        }
    } while (key != KEY_Y && key != KEY_N);
    return confirmed;
}
```

### Pattern: SFA Frame Reuse with Bare Blocks

```blend65
module Graphics;

function initLevel(): void {
    // Phase 1: Decompress map data (needs 256-byte buffer)
    {
        let decompBuffer: byte[256];
        decompressMap(decompBuffer);
        copyToScreen(decompBuffer);
    }
    // Phase 2: Set up color data (reuses same 256 bytes in frame)
    {
        let colorBuffer: byte[256];
        loadColors(colorBuffer);
        copyToColorRAM(colorBuffer);
    }
    // Function frame = 256 bytes, not 512
}
```

### Pattern: Search with Early Exit

```blend65
module Search;

function findEnemy(targetX: byte, targetY: byte): byte {
    let foundIndex: byte = 255;    // 255 = not found
    
    for (let i: byte = 0 to numEnemies) {
        if (enemyX[i] == targetX) {
            if (enemyY[i] == targetY) {
                foundIndex = i;
                break;
            }
        }
    }
    return foundIndex;
}
```

### Edge Case: Nested Control Flow

```blend65
module Demo;

function processGrid(): void {
    for (let y: byte = 0 to 25) {
        for (let x: byte = 0 to 40) {
            let cell: byte = getCell(x, y);
            
            if (cell == EMPTY) {
                continue;    // skip to next x iteration
            }
            
            if (cell == WALL) {
                drawWall(x, y);
            } else if (cell == ENEMY) {
                if (isEnemyAlive(x, y)) {
                    drawEnemy(x, y);
                } else {
                    drawExplosion(x, y);
                }
            } else {
                drawFloor(x, y);
            }
        }
    }
}
```

---

## Errors

| Code | Condition | Message |
|------|-----------|---------|
| E10100 | Numeric type used in condition | `Condition must be type 'boolean' — found '<type>'. Use an explicit comparison (e.g., '<expr> != 0')` |
| E10101 | Variable shadows outer scope | `Variable '<name>' shadows declaration in enclosing scope (line <N>) — use a different name` |

**Existing errors that apply to this feature:**

| Code | Source | Applicability |
|------|--------|---------------|
| E10010 | F003 | If/while/do-while at module level → error (executable code must be inside functions) |
| E10063 | F008 | `break`/`continue` outside any loop body (for, while, or do-while) |

---

## Feature Interaction Summary (L8)

| Feature | Interaction |
|---------|-------------|
| F003 (Module contents) | If/while/do-while cannot appear at module level (E10010). Control flow must be inside functions. Bare blocks at module level are also prohibited. |
| F005 (Memory placement) | Block-scoped variables live in the function's SFA frame, not in zero-page or global RAM. `zeropage` declarations are module-level only. |
| F006 (Address-of) | `&` on block-scoped variables follows F006 rules. The address is a compile-time constant (SFA frame location). Valid only while the variable is in scope. |
| F007 (Interrupt functions) | If/while/do-while can appear in interrupt handlers. Each interrupt function has its own SFA frame, so block scoping works identically. |
| F008 (For loop) | For-loops create their own block scope (FOR-5). `break`/`continue` work identically in for, while, and do-while (E10063 applies to all three). For-loop shadowing rule (E10062) is a specialization of the general shadowing rule (E10101). |
| F009 (Switch) | Switch is transparent to `break`/`continue` (F009). An `if` inside a switch case body is valid. A switch inside a loop is valid — `break` in the switch case exits the **loop**. If-else chains on a single variable may be better expressed as `switch`. |
| F010 (Signed types) | Comparison operators in conditions produce `boolean` regardless of operand signedness. `if (signedVal < 0)` generates correct signed comparison code (N flag check vs. carry flag check). |
| F011 (Structs) | Struct field access in conditions: `if (player.health > 0)` is valid. The field is loaded, compared, and the result is `boolean`. Struct variables follow the same block scoping rules. |
| F012 (CPU intrinsics) | Intrinsics can be called inside any control flow body. `if (critical) { asm_sei(); ... asm_cli(); }` for conditional interrupt masking is valid. |

---

## Language Guard Verdict

- **P1 Cross-platform compilable** ✅ — If/else, while, do-while compile to standard branch/jump instructions available on all 6502 variants across all target platforms.
- **P2 Platform-meaningful** ✅ — Conditional logic and loops are fundamental to every program on every platform. Game loops, state machines, input polling, collision detection — all require these constructs.
- **P3 No platform assumptions** ✅ — No hardware addresses, chip names, or platform-specific details anywhere in this feature. All examples use abstract names.
- **P4 Resource-scalable** ✅ — Control flow overhead is minimal and predictable (2–3 bytes per branch, 3 bytes per JMP). Block scoping with SFA integration helps conserve RAM on constrained platforms through frame slot reuse.
- **H1 6502 implementable** ✅ — Maps directly to BEQ/BNE/BCC/BCS/JMP instructions. All 6502 variants support these. Do-while maps to the most natural 6502 loop pattern (backward branch).
- **H2 Cost transparency** ✅ — Every construct has documented codegen patterns with byte counts and cycle costs. If: 6–8 bytes overhead. While: 3 bytes initial JMP + 2 bytes branch per iteration. Do-while: 2 bytes branch per iteration. Break/continue: 2–3 bytes each.
- **H3 SFA compatible** ✅ — Block-scoped variables are part of the function's static frame. Non-overlapping block scopes share frame memory. No dynamic allocation. No stack growth from nesting (nesting only affects codegen structure, not runtime stack).
- **H4 Memory footprint documented** ✅ — RAM: block-scoped variables share frame slots (non-overlapping lifetimes save RAM). ROM: 2–8 bytes overhead per control flow construct. ZP: none required by control flow itself (condition temporaries may use ZP if allocated).
- **H5 Fully deterministic** ✅ — Every construct has defined behavior for all inputs. `while (false)`: zero iterations. `while (true)`: infinite loop (intentional). Empty bodies: valid. Boolean-only conditions prevent "is 0 false?" ambiguity.
- **L1 Unambiguous syntax** ✅ — EBNF grammar is LL(k) parseable. Mandatory braces eliminate dangling-else ambiguity entirely. `else if` composes naturally. Do-while semicolon is explicit.
- **L2 Consistent with existing** ✅ — Block syntax `{ }` matches for-loop and switch. Condition parentheses match C conventions. `break`/`continue` follow F008 rules. Boolean-only conditions follow F010's "no implicit conversions" principle.
- **L3 Beginner-friendly** ✅ — Any C/TypeScript/JavaScript developer can read and understand if/else, while, and do-while immediately. Only difference from C: no braceless forms and no truthy conditions. Both are easily learned.
- **L4 Minimal feature** ✅ — Three constructs (if/else, while, do-while) cover all branching and looping needs. No `loop` keyword (use `while (true)`), no `unless` (use `if (!cond)`), no ternary operator (deferred). Bare blocks add no syntax — just `{ }`.
- **L5 No redundancy** ✅ — Each construct serves a distinct purpose: if/else = branching, while = 0+ iteration loop, do-while = 1+ iteration loop. For-loop (F008) = counted iteration. Switch (F009) = multi-value branching. No overlap.
- **L6 Error messages defined** ✅ — E10100 (condition type), E10101 (shadowing). Plus existing E10010 (module-level), E10063 (break/continue outside loop). Each has specific message, trigger condition, and fix guidance.
- **L7 Compile-time failure preferred** ✅ — E10100 and E10101 are both compile-time errors. All condition type checking happens during semantic analysis. No runtime failures from control flow mechanics.
- **L8 Feature interaction documented** ✅ — Interactions with all 12 existing features explicitly documented above.
- **L9 Documentable with examples** ✅ — Prose description, basic usage, 5 pattern examples (game state machine, input polling, SFA reuse, search with early exit, nested control flow), edge cases all provided.
- **C1 Lexer/parser implementable** ✅ — `KW_IF`, `KW_ELSE`, `KW_WHILE`, `KW_DO` are straightforward keywords. Grammar is LL(k) with no ambiguity. Mandatory braces make parsing trivial — no lookahead needed for dangling else.
- **C2 Semantic analysis defined** ✅ — Condition must be boolean (type check). Block scoping creates/destroys scope entries. Shadowing check against all enclosing scopes. Break/continue validity check against loop nesting stack.
- **C3 Code generation strategy** ✅ — Documented 6502 patterns for: if (no else), if-else, if-else if-else chain, while, while(true), do-while, break, continue in while, continue in do-while. All use standard branch/jump instructions.
- **C4 Unit testable** ✅ — Lexer: keyword tokens. Parser: if-stmt, while-stmt, do-while-stmt AST nodes. Semantic: boolean condition check, shadowing check. Codegen: branch patterns for each construct. All boundary conditions enumerable.
- **C5 Runtime verifiable** ✅ — Compile control flow programs, run in emulator, verify execution paths via memory writes at known addresses. Test: if-branch taken/not-taken, while iteration counts, do-while minimum-once semantics, break/continue targets.
- **F1 Extensible** ✅ — Future additions possible without breaking changes: ternary operator (`cond ? a : b`), `loop` keyword, pattern matching, guard clauses. None require syntax changes to existing if/while/do-while.
- **F2 Platform-profile ready** ✅ — No platform-specific behavior. All codegen uses standard 6502 instructions. No platform profile interaction needed.
- **F3 Optimizer-friendly** ✅ — Standard control flow graph construction. Enables: dead code elimination (`if (false)`), loop-invariant code motion, branch simplification, `while (true)` recognition, unreachable code detection after unconditional `break`/`return`.
- **F4 Stability classification** ✅ — Classified as **Stable**. If/else, while, and do-while are universally understood constructs with decades of precedent. No changes anticipated.
