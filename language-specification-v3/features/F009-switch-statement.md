# F009 — Switch statement

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)  
> **Replaces v2**: Undefined fall-through behavior, empty case fall-through pattern

## Description

The `switch` statement dispatches execution to one of several case blocks based on the value of an expression. Unlike C, Blend65 uses **auto-break** semantics — each case body ends automatically without requiring `break`. For the rare cases where fall-through is intentional, the `fallthrough` keyword explicitly continues execution into the next case.

This design eliminates C's #1 switch bug (forgotten `break`) while preserving full control for developers who need sequential case execution. On the 6502, each case compiles to an independent code block with a `JMP` to the switch end — auto-break is the CPU's natural pattern, not an added restriction.

## Syntax

```blend65
switch (expression) {
    case VALUE1:
        // statements
    case VALUE2, VALUE3:
        // multi-value case
    default:
        // fallback
}
```

**EBNF:**
```ebnf
switch_stmt = "switch" , "(" , expression , ")" , "{"
            , { case_clause }
            , [ default_clause ]
            , "}" ;

case_clause = "case" , case_value_list , ":" , case_body ;
case_value_list = const_expression , { "," , const_expression } ;
default_clause = "default" , ":" , case_body ;
case_body = { statement } , [ "fallthrough" , ";" ] ;
```

## Auto-Break Semantics (No Fall-Through by Default)

Each case body is independent. After executing the matched case's code, execution jumps to the end of the switch — **not** into the next case. No `break` statement is needed.

```blend65
switch (direction) {
    case DIR_UP:
        playerY = playerY - 1;
        // ← implicit break: execution jumps to after the switch
    case DIR_DOWN:
        playerY = playerY + 1;
        // ← implicit break
    case DIR_LEFT:
        playerX = playerX - 1;
    case DIR_RIGHT:
        playerX = playerX + 1;
}
// execution continues here
```

This is the **6502's natural pattern**. Each case compiles to a code block ending with `JMP .switch_end`. Fall-through would require *removing* that `JMP` — it would be the unnatural behavior.

## Multi-Value Cases

Multiple values that share the same body are listed with commas:

```blend65
switch (key) {
    case KEY_W, KEY_UP:
        moveUp();
    case KEY_S, KEY_DOWN:
        moveDown();
    case KEY_SPACE, KEY_RETURN:
        fireWeapon();
    default:
        // unknown key — do nothing
}
```

This replaces C's empty fall-through pattern (`case A: case B: code; break;`) with a cleaner, explicit syntax.

## `fallthrough` Keyword

For the rare cases (~3% of real-world switch usage) where sequential execution into the next case is intentional, the `fallthrough` keyword explicitly opts in:

```blend65
switch (cmd) {
    case CMD_FULL_RESET:
        eraseAllData();
        fallthrough;            // continue to CMD_PARTIAL_RESET
    case CMD_PARTIAL_RESET:
        resetScore();
        resetLives();
        fallthrough;            // continue to CMD_INIT
    case CMD_INIT:
        loadLevel(1);
        setPlayerStart();
}
// CMD_FULL_RESET   → eraseAllData + resetScore + resetLives + loadLevel + setPlayerStart
// CMD_PARTIAL_RESET → resetScore + resetLives + loadLevel + setPlayerStart
// CMD_INIT          → loadLevel + setPlayerStart
```

**`fallthrough` rules:**

| Rule | Decision |
|------|----------|
| Position | Must be the **last statement** at the top level of the case body |
| Inside `if`/`while`/`for` | **Not allowed** — E10074 |
| Statements after `fallthrough` | **Not allowed** — E10074 |
| In the last case or `default` | **E10073** — nothing to fall through to |
| Destination | Always the **next** case in source order — cannot skip cases |
| Into `default` | **Allowed** — default is treated as the next case for fallthrough purposes |
| Runtime cost | **Zero** — compiler omits the `JMP .switch_end` |

## `break` and `continue` in Switch

Since cases auto-break, `break` has no purpose for the switch itself. Therefore, `break` and `continue` inside a switch case **pass through to the enclosing loop**. The switch is transparent to loop control.

```blend65
while (running) {
    let input: byte = readInput();
    
    switch (input) {
        case KEY_QUIT:
            running = false;
            break;              // exits the WHILE loop, not the switch!
        case KEY_PAUSE:
            togglePause();
            continue;           // skips to next while iteration (skips updateFrame)
        case KEY_FIRE:
            fireWeapon();
    }
    
    updateFrame();
}
```

If `break` or `continue` appears in a switch that is **not** inside a loop, it produces **E10063** (same error as break/continue outside a loop).

**⚠️ v2 migration note**: In C-style switch, `break` exits the switch. In Blend65 v3, `break` exits the enclosing loop. This is a semantic change that must be reviewed during migration.

## Switch Expression Types

| Type | Allowed | Notes |
|------|---------|-------|
| `byte` | ✅ | Most common — 8-bit comparison, compact codegen |
| `word` | ✅ | 16-bit comparison — more expensive (see codegen) |
| Enum | ✅ | Compared by underlying type (byte or word) |
| `boolean` | ❌ | Use `if/else` — E10075 |
| Arrays, structs | ❌ | Not comparable — E10075 |
| `void` | ❌ | No value — E10075 |

## Case Value Rules

| Rule | Decision |
|------|----------|
| Must be compile-time constants | **Yes** — enables jump table optimization and duplicate detection |
| Must match switch expression type | **Yes** — E10072 on mismatch |
| Duplicate values | **E10070** — even across multi-value lists |
| Constant expressions | Allowed (`MAX + 1`, `3 * 4`) if compile-time evaluable |

## Default Clause

| Rule | Decision |
|------|----------|
| Required? | **No** — optional |
| Position | Must be **last** (after all cases) |
| Multiple defaults | **E10076** — compile error |
| If no case matches and no default | Execution continues after the switch (no error, no warning) |

## Case Body Scoping

Each case body introduces a **new scope**. Variables declared in one case are not accessible from other cases:

```blend65
switch (cmd) {
    case CMD_ATTACK:
        let damage: byte = calculateDamage();   // scoped to this case
        applyDamage(damage);
    case CMD_HEAL:
        let amount: byte = getHealAmount();     // different scope — no conflict
        applyHeal(amount);
}
// damage and amount are both out of scope here
```

Under SFA, case-scoped variables can share frame slots when their lifetimes don't overlap (only one case executes per switch evaluation).

## Generated Code Patterns (6502)

**Compare-and-branch chain (typical, 2–6 cases):**

```asm
; switch (direction) — byte expression, 4 cases, no default
    LDA _direction
    CMP #0              ; DIR_UP
    BEQ .case_up
    CMP #1              ; DIR_DOWN
    BEQ .case_down
    CMP #2              ; DIR_LEFT
    BEQ .case_left
    CMP #3              ; DIR_RIGHT
    BEQ .case_right
    JMP .switch_end     ; no default — skip to end

.case_up:
    LDA _playerY
    SEC
    SBC #1
    STA _playerY
    JMP .switch_end     ; ← auto-break

.case_down:
    LDA _playerY
    CLC
    ADC #1
    STA _playerY
    JMP .switch_end     ; ← auto-break

.case_left:
    LDA _playerX
    SEC
    SBC #1
    STA _playerX
    JMP .switch_end     ; ← auto-break

.case_right:
    LDA _playerX
    CLC
    ADC #1
    STA _playerX
    ; last case — no JMP needed

.switch_end:
```

*Dispatch overhead: 4 bytes per case (CMP + BEQ). Body overhead: 3 bytes per case (JMP .switch_end), except last case.*

**With `fallthrough` (omitted JMP — zero cost):**

```asm
; case CMD_FULL_RESET with fallthrough
.case_full_reset:
    JSR _eraseAllData
    ; NO JMP .switch_end — fallthrough removes it

; case CMD_PARTIAL_RESET with fallthrough
.case_partial_reset:
    JSR _resetScore
    JSR _resetLives
    ; NO JMP — fallthrough

; case CMD_INIT (normal auto-break)
.case_init:
    JSR _loadLevel
    JSR _setPlayerStart
    JMP .switch_end     ; normal auto-break

.switch_end:
```

`fallthrough` literally means "don't emit the `JMP .switch_end`" — zero runtime cost.

**Jump table (compiler optimization, 7+ dense cases):**

```asm
; switch (opcode) — values 0–7, dense range
    LDA _opcode
    CMP #8              ; range check
    BCS .switch_end     ; out of range → skip (no default)
    ASL                 ; × 2 (word-sized addresses)
    TAX
    LDA .jmp_table+1,X  ; high byte of (target - 1)
    PHA
    LDA .jmp_table,X    ; low byte of (target - 1)
    PHA
    RTS                 ; "jump" via RTS trick

.jmp_table:
    .word .case_0 - 1   ; addresses are -1 because RTS adds 1
    .word .case_1 - 1
    .word .case_2 - 1
    ; ... etc
```

*Dispatch: ~12 bytes + 2 bytes per entry. O(1) lookup, ~20 cycles. The compiler selects this strategy automatically when case values are dense and numerous.*

**Word-sized switch expression:**

```asm
; switch (score) — word expression
    LDA _score_hi
    CMP #>1000          ; high byte of 1000 ($03)
    BNE .not_case_1000
    LDA _score_lo
    CMP #<1000          ; low byte of 1000 ($E8)
    BNE .not_case_1000
    JMP .case_1000      ; match
.not_case_1000:
    ; ... next case ...
```

*8 bytes per case comparison for word vs 4 bytes for byte.*

## Codegen Strategy Selection

The compiler automatically selects the optimal codegen strategy:

| Condition | Strategy | Cost |
|-----------|----------|------|
| 2–6 cases (any values) | Compare-and-branch chain | O(n) comparisons, 4 bytes/case dispatch |
| 7+ cases, dense values (0..N) | Jump table | O(1) dispatch, ~12 bytes + 2 bytes/entry |
| 7+ cases, sparse values | Compare-and-branch chain | O(n) comparisons |
| `word` expression | Compare-and-branch chain | 8 bytes/case dispatch |

The developer does not control this selection — the compiler optimizes automatically.

## Ambiguities Resolved

| # | ID | Ambiguity | Resolution |
|---|------|-----------|------------|
| 1 | SW-1 | Fall-through behavior | **Auto-break by default**. Each case body ends implicitly — no `break` needed. `fallthrough` keyword for explicit fall-through (Swift model). Aligns with A4 (explicit over implicit) and H5 (no undefined behavior). |
| 2 | SW-2 | Multi-value case syntax | **`case A, B, C:`** comma-separated values. Replaces C's empty-case fall-through pattern. Cleaner and unambiguous. |
| 3 | SW-3 | Case value constraints | **Compile-time constants only**. Enables jump table optimization and duplicate detection. E10071 for non-constant values. |
| 4 | SW-4 | Case value type matching | Must match switch expression type. `byte` switch requires `byte` cases. E10072 on mismatch. |
| 5 | SW-5 | Duplicate case values | **E10070** compile error. Detectable because all values are compile-time constants. Checked across multi-value lists. |
| 6 | SW-6 | Default clause | **Optional**. If no case matches and no default, execution continues after the switch. Must be the last clause. |
| 7 | SW-7 | `break`/`continue` inside switch | **Pass through to enclosing loop**. Switch is transparent to loop control. E10063 if no enclosing loop. |
| 8 | SW-8 | `fallthrough` in last case/default | **E10073** — nothing to fall through to. Always detectable at compile time. |
| 9 | SW-9 | `fallthrough` position | Must be **last statement at top level** of case body. Cannot be inside `if`/`while`/`for`. Cannot have statements after it. E10074. |
| 10 | SW-10 | Switch expression types | **`byte`, `word`, enum**. Boolean excluded (use `if/else`). Arrays, structs, void excluded. E10075. |
| 11 | SW-11 | Empty case body | **Allowed** — acts as a no-op for that case value. Compiler generates the comparison and an empty block (`JMP .switch_end`). |
| 12 | SW-12 | Nested switches | **Allowed**. Each switch is independent. Inner switch is just code inside the outer case body. |
| 13 | SW-13 | Switch inside loops | `break`/`continue` target the loop, not the switch (see SW-7). The switch is transparent. |
| 14 | SW-14 | `fallthrough` into `default` | **Allowed**. `default` is treated as the next case for fallthrough purposes. |
| 15 | SW-15 | Case body scoping | Each case body introduces a **new scope**. Variables declared in one case are not visible in others. Under SFA, non-overlapping case scopes share frame memory. |
| 16 | SW-16 | `fallthrough` with next case's variables | **Allowed**. Execution enters the next case from the top of its body — variable initializations execute normally. |
| 17 | SW-17 | Codegen strategy | **Compiler chooses** between compare-and-branch chain and jump table based on case count and value density. Not developer-controllable. |
| 18 | SW-18 | Multiple `default` clauses | **E10076** — only one default allowed per switch. |

## v2 Migration Guide

| v2 Syntax | v3 Syntax | Notes |
|-----------|-----------|-------|
| `case A:` (no break, ambiguous) | `case A:` (auto-break, defined) | Same syntax, different semantics |
| `case A: ... break;` (end case) | `case A: ...` (break not needed) | Remove `break` statements |
| `case A:` `case B:` (empty fall-through) | `case A, B:` (multi-value) | Use comma syntax |
| *(no equivalent)* | `fallthrough;` | New keyword for explicit fall-through |
| `break;` (exits switch) | `break;` (**exits enclosing loop**) | ⚠️ **Semantic change** — review all switch-inside-loop code |

## Examples

**Basic game state machine:**
```blend65
module Game;

const STATE_MENU: byte = 0;
const STATE_PLAYING: byte = 1;
const STATE_PAUSED: byte = 2;
const STATE_GAMEOVER: byte = 3;

let gameState: byte = STATE_MENU;

function update(): void {
    switch (gameState) {
        case STATE_MENU:
            showMenu();
            handleMenuInput();
        case STATE_PLAYING:
            updatePlayer();
            updateEnemies();
            checkCollisions();
        case STATE_PAUSED:
            showPauseOverlay();
        case STATE_GAMEOVER:
            showGameOver();
        default:
            gameState = STATE_MENU;
    }
}
```

**Multi-value input handling:**
```blend65
module Input;

const KEY_W: byte = $57;
const KEY_S: byte = $53;
const KEY_UP: byte = $91;
const KEY_DOWN: byte = $11;
const KEY_SPACE: byte = $20;
const KEY_RETURN: byte = $0D;

function handleInput(key: byte): void {
    switch (key) {
        case KEY_W, KEY_UP:
            moveUp();
        case KEY_S, KEY_DOWN:
            moveDown();
        case KEY_SPACE, KEY_RETURN:
            fireWeapon();
    }
    // No default — unknown keys are ignored
}
```

**Pattern: Game loop with switch inside while (`break` targets loop):**
```blend65
module Game;

function gameLoop(): void {
    let running: boolean = true;

    while (running) {
        let input: byte = readInput();
        
        switch (input) {
            case KEY_QUIT:
                running = false;
                break;              // exits the WHILE loop
            case KEY_PAUSE:
                togglePause();
            case KEY_FIRE:
                if (gameState == STATE_PLAYING) {
                    fireWeapon();
                }
        }
        
        updateFrame();
        waitVBlank();
    }
}
```

**Pattern: Sequential initialization with `fallthrough`:**
```blend65
module Game;

const CMD_FULL_RESET: byte = 0;
const CMD_PARTIAL_RESET: byte = 1;
const CMD_INIT: byte = 2;

function handleCommand(cmd: byte): void {
    switch (cmd) {
        case CMD_FULL_RESET:
            eraseAllData();
            fallthrough;
        case CMD_PARTIAL_RESET:
            resetScore();
            resetLives();
            fallthrough;
        case CMD_INIT:
            loadLevel(1);
            setPlayerStart();
    }
}
```

**Edge case: Variables in case bodies (scoped):**
```blend65
module Game;

function processCommand(cmd: byte): void {
    switch (cmd) {
        case CMD_ATTACK:
            let damage: byte = calculateDamage();
            applyDamage(damage);
        case CMD_HEAL:
            let amount: byte = getHealAmount();
            applyHeal(amount);
        case CMD_DEFEND:
            setDefenseMode();
    }
    // damage and amount are both out of scope here
}
```

**Edge case: Direction with default fallback:**
```blend65
module Sprites;

zeropage {
    playerX: byte = 128;
    playerY: byte = 100;
}

function movePlayer(direction: byte, speed: byte): void {
    switch (direction) {
        case DIR_UP:
            playerY = playerY - speed;
        case DIR_DOWN:
            playerY = playerY + speed;
        case DIR_LEFT:
            playerX = playerX - speed;
        case DIR_RIGHT:
            playerX = playerX + speed;
        default:
            // invalid direction — do nothing
    }
}
```

## Errors

| Code | Condition | Message |
|------|-----------|---------|
| E10070 | Duplicate case value | `Duplicate case value '<value>' — already used at line <N>` |
| E10071 | Non-constant case value | `Case value must be a compile-time constant — '<expr>' cannot be evaluated at compile time` |
| E10072 | Case type mismatch | `Case value type '<case_type>' does not match switch expression type '<switch_type>'` |
| E10073 | `fallthrough` in last case/default | `'fallthrough' has no effect — this is the last case in the switch` |
| E10074 | `fallthrough` not last statement | `'fallthrough' must be the last statement in a case body — it cannot be inside an if/while/for block, and no statements may follow it` |
| E10075 | Invalid switch expression type | `Cannot switch on type '<type>' — switch expression must be 'byte', 'word', or an enum type` |
| E10076 | Multiple default clauses | `Only one 'default' clause is allowed per switch statement` |

## Warnings

| Code | Condition | Message |
|------|-----------|---------|
| W10070 | `word` switch where all cases fit in `byte` | `Switch expression is 'word' but all case values fit in 'byte' — consider using a 'byte' variable for more efficient comparison (4 bytes/case vs 8 bytes/case)` |

## Feature Interaction Summary (L8)

| Feature | Interaction |
|---------|-------------|
| F003 (Module contents) | Switch cannot appear at module level (E10010 — executable code must be inside functions) |
| F005 (Memory placement) | Case values can reference `const` declarations. Case-scoped variables allocated in function's SFA frame |
| F006 (Address-of) | `&` on case-scoped variables follows F006 rules for local variables |
| F007 (Interrupt functions) | Switch can appear in interrupt handlers. No special restrictions |
| F008 (For loop) | Switch inside for-loop: `break` exits the for-loop, `continue` advances the for-loop. Switch is transparent to loop control |

## Language Guard Verdict

- **P1 Cross-platform** ✅ — Compare-and-branch and jump tables are universal 6502 patterns. Work on all platforms.
- **P2 Platform-meaningful** ✅ — State machines and input dispatch are fundamental to every game/app on every platform.
- **P3 No platform assumptions** ✅ — No hardware addresses or platform names in the switch spec.
- **P4 Resource-scalable** ✅ — W10070 warns about unnecessary `word` comparisons. Codegen scales from compare-chain to jump table.
- **H1 6502 implementable** ✅ — Maps directly to CMP/BEQ chains or jump tables. Both are standard 6502 patterns.
- **H2 Cost transparency** ✅ — Compare-chain: 4 bytes + 4–5 cycles per case comparison (byte), 8 bytes for word. Jump table: ~12 bytes dispatch + 2 bytes per entry, O(1) ~20 cycles. `fallthrough`: zero cost (omits JMP). All documented.
- **H3 SFA compatible** ✅ — Case-scoped variables are in the function's static frame. Non-overlapping case scopes share frame memory.
- **H4 Memory footprint** ✅ — Compare-chain: 4 bytes dispatch + 3 bytes (JMP) per case body. Jump table: 12 bytes dispatch + 2 bytes per entry. Quantifiable per switch instance.
- **H5 Deterministic** ✅ — Every case value match is defined. No-match with no default = skip (defined). `fallthrough` is explicit. Auto-break is defined. No undefined behavior.
- **L1 Unambiguous** ✅ — `switch`, `case`, `default`, `fallthrough` are all keywords. Multi-value comma syntax is unambiguous in EBNF. No parsing conflicts.
- **L2 Consistent** ✅ — Block syntax (`{ }`) matches `if`/`while`/`for`. `case value:` with colon follows C/Java/TS convention. `fallthrough` follows Swift precedent.
- **L3 Beginner-friendly** ✅ — Familiar C-like syntax. Auto-break is safer for beginners — eliminates the #1 C switch bug. `fallthrough` is explicit and self-documenting. Multi-value `case A, B:` reads naturally.
- **L4 Minimal** ✅ — One new keyword (`fallthrough`). Everything else is standard switch/case/default. No pattern matching, no ranges, no type guards.
- **L5 No redundancy** ✅ — `switch` is not a duplicate of `if/else if` — it communicates "value dispatch" intent and enables compiler optimizations (jump tables, duplicate detection).
- **L6 Error messages** ✅ — E10070–E10076 cover all misuse. W10070 for optimization hints. Every error has a clear message and fix.
- **L7 Compile-time failure** ✅ — All switch errors caught at compile time. Constant case values enable duplicate detection. No runtime failures from switch mechanics.
- **L8 Feature interaction** ✅ — Interactions with F003, F005, F006, F007, F008 documented above.
- **L9 Documentable** ✅ — Prose + basic examples + pattern examples (state machine, input handling, fallthrough, game loop) + edge cases all provided.
- **C1 Lexer/parser** ✅ — `KW_SWITCH`, `KW_CASE`, `KW_DEFAULT`, `KW_FALLTHROUGH`. Comma-separated case values parsed as list. Standard recursive descent.
- **C2 Semantic analysis** ✅ — Check: constant case values, type matching, duplicate detection, fallthrough position, switch expression type, scope management.
- **C3 Code generation** ✅ — Documented: compare-and-branch chain, jump table optimization, fallthrough (omitted JMP), word-sized comparison. Compiler selects optimal strategy.
- **C4 Unit testable** ✅ — Lexer: `KW_SWITCH`, `KW_CASE`, `KW_DEFAULT`, `KW_FALLTHROUGH` tokens. Parser: switch-stmt AST with case clauses. Semantic: duplicate values, type mismatch, fallthrough rules. Codegen: compare-chain vs jump table output.
- **C5 Runtime verifiable** ✅ — Compile switch programs, run in emulator, verify correct case dispatched for each input value including edge cases (no match, fallthrough, multi-value).
- **F1 Extensible** ✅ — Future: range cases `case 0..9:` (FUT-007), exhaustiveness checking for enums, pattern matching.
- **F2 Platform-profile ready** ✅ — No platform-specific behavior. All codegen uses standard 6502 instructions.
- **F3 Optimizer-friendly** ✅ — Compile-time known case values enable jump table selection. Constant propagation can simplify switch expressions. Dead case elimination possible.
- **F4 Stability** ✅ — Classified as **Stable**.

