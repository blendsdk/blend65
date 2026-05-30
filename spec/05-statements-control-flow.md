# Chapter 05 — Statements & Control Flow

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F013, F008, F009

---

## 1. Overview

This chapter defines the statement types and control flow constructs of Blend65 v3: blocks, `if`/`else`, `while`, `do-while`, `for` loops, `switch` statements, and the `break`/`continue`/`fallthrough` keywords. It also defines the canonical block definition and the boolean-condition rule that all control flow constructs share.

---

## 2. Blocks

### 2.1 Block Definition

A **block** is zero or more statements enclosed in curly braces. Blocks create a new scope — variables declared inside a block are not visible outside it.

```ebnf
block = "{" , { statement } , "}" ;
```

```blend65
{
    let temp: byte = 42;
    poke($D020, temp);
}
// temp is not visible here
```

### 2.2 Mandatory Braces (CF-1)

All control flow bodies **must** use curly braces. Braceless single-statement forms are not permitted.

```blend65
if (x > 0) { doSomething(); }     // ✅ braces required
if (x > 0) doSomething();         // ❌ syntax error — braces required
```

**Rationale:** On the 6502 with no debugger, stack trace, or memory protection, a misplaced statement causes silent corruption. Mandatory braces eliminate dangling-statement bugs entirely and resolve the dangling-else ambiguity without any special parser rule.

### 2.3 Block Scoping

Variables declared inside a block (including loop bodies, if-branches, and function bodies) are scoped to that block:

```blend65
let x: byte = 10;
if (x > 5) {
    let y: byte = 20;     // y is scoped to this block
    x = y;                 // ✅ x is visible from outer scope
}
// y is not visible here
```

### 2.4 No Shadowing (CF-4 / E10101)

A variable declaration in an inner scope may **not** shadow a variable from an enclosing scope. Shadowing produces **E10101**.

```blend65
let x: byte = 10;
if (true) {
    let x: byte = 20;     // ❌ E10101: 'x' shadows declaration in enclosing scope
}
```

This applies across all nesting levels: function parameters, outer blocks, for-loop variables, and module-level variables.

---

## 3. Boolean Condition Rule (CF-2 / E10100)

All conditions in `if`, `while`, `do-while`, and the conditional operator (`? :`) must be of type `boolean`. Non-boolean types are **not** implicitly truthy — the developer must write an explicit comparison.

```blend65
let x: byte = 5;
if (x) { ... }              // ❌ E10100: condition must be boolean, found byte
if (x != 0) { ... }         // ✅ explicit comparison produces boolean
if (x > 0 && x < 10) { ... } // ✅ logical expression produces boolean
```

**Rationale:** On the 6502, a "truthy" value could mean many things (non-zero, positive, carry set). Requiring explicit boolean conditions eliminates an entire class of subtle bugs and makes the developer's intent clear.

---

## 4. If / Else

### 4.1 Syntax

```ebnf
if_stmt = "if" , "(" , expression , ")" , block
        , [ "else" , ( if_stmt | block ) ] ;
```

```blend65
if (score > 1000) {
    lives = lives + 1;
}

if (health == 0) {
    gameOver();
} else {
    continueGame();
}

if (dir == Direction.UP) {
    moveUp();
} else if (dir == Direction.DOWN) {
    moveDown();
} else {
    idle();
}
```

### 4.2 Rules

- Condition must be `boolean` (CF-2 / **E10100**).
- Both the `if` body and the `else` body must be blocks (CF-1).
- `else if` is not a special construct — it is `else` followed by another `if_stmt`.
- **All code paths must return** in non-void functions: if a function returns a value, all branches of an `if`/`else` chain must contain a `return` statement. Missing return paths produce **E10102**.

### 4.3 Dangling Else Resolution

There is no dangling-else ambiguity because both `if` and `else` require braces (CF-1). The `else` always binds to the immediately preceding `if`.

### 4.4 6502 Code Generation

```blend65
if (x > 10) { doA(); } else { doB(); }
```

```asm
    LDA x
    CMP #$0B        ; compare with 10+1
    BCC .else        ; if x <= 10, branch to else
    JSR doA
    JMP .end
.else:
    JSR doB
.end:
```

Typical cost: ~6–10 cycles for the branch, plus the cost of evaluating the condition and executing the selected body.

---

## 5. While Loop

### 5.1 Syntax

```ebnf
while_stmt = "while" , "(" , expression , ")" , block ;
```

```blend65
while (enemies > 0) {
    processEnemy();
    enemies = enemies - 1;
}
```

### 5.2 Rules

- Condition must be `boolean` (CF-2 / **E10100**).
- Body must be a block (CF-1).
- Condition is evaluated **before** each iteration. If false initially, the body never executes.
- `break` exits the loop immediately. `continue` jumps to the next condition evaluation.

### 5.3 Compile-Time Warnings

- **W10130**: Condition is always false — body will never execute.
- **W10131**: Unreachable code after `break`/`continue`/`return` in the loop body.

---

## 6. Do-While Loop

### 6.1 Syntax

```ebnf
do_while_stmt = "do" , block , "while" , "(" , expression , ")" , ";" ;
```

```blend65
do {
    readInput();
} while (inputReady != true);
```

### 6.2 Rules

- Condition must be `boolean` (CF-2 / **E10100**).
- Body must be a block (CF-1).
- Body executes **at least once** — condition is evaluated after each iteration.
- `break` and `continue` work as in `while` loops.
- Note the **terminating semicolon** after the closing parenthesis.

---

## 7. For Loop

### 7.1 Syntax

Blend65 v3 uses only the `until`/`to`/`downto` range form. The C-style `for (init; cond; update)` is not supported.

```ebnf
for_stmt = "for" , "(" , "let" , identifier , ":" , type , "=" , expression
         , ( "until" | "to" | "downto" ) , expression
         , [ "step" , const_expression ]
         , ")" , block ;
```

### 7.2 Direction and Bounds

Blend65 follows the Kotlin model: each range keyword means exactly what it reads in English. `until` excludes its end bound; `to` and `downto` include it.

| Keyword | Direction | End Bound | Meaning |
|---------|-----------|-----------|---------|
| `until` | Ascending | **Exclusive** | Loop visits start..(end−1) — end is *not* reached |
| `to` | Ascending | **Inclusive** | Loop visits start..end — end *is* reached |
| `downto` | Descending | **Inclusive** | Loop visits start..end — end *is* reached |

```blend65
for (let i: byte = 0 until 10) { ... }       // visits 0,1,2,...,9 (10 iterations)
for (let i: byte = 1 to 8) { ... }           // visits 1,2,3,...,8 (8 iterations)
for (let i: byte = 9 downto 0) { ... }       // visits 9,8,7,...,0 (10 iterations)
for (let i: byte = 0 until 100 step 2) { ... } // visits 0,2,4,...,98 (50 iterations)
for (let i: byte = 0 to 255) { ... }         // full byte range: 0..255 (256 iterations)
```

**Choosing the right keyword:**
- Use `until` for array iteration — `for (let i: byte = 0 until length(arr))` visits exactly the valid indices `[0, N)`.
- Use `to` when the end value itself must be visited — e.g. `1 to 8`, or the full type range `0 to 255`.
- There is no exclusive-descending keyword in v3; for descending exclusion, adjust the bound (e.g. `9 downto 0` visits 0; to stop at 1, write `9 downto 1`). See `future-considerations.md` (FUT-019).

**Empty ranges** (e.g., `10 until 5`, `5 to 4`, or `5 downto 10`) execute **zero iterations**.

#### 7.2.1 End-Bound Range Rule (CF-FOR-1 / E10064)

The end bound determines how far the counter must reach. Because an **inclusive** `to` loop over the full type range must compare past the largest representable value, the valid range of the end bound depends on the keyword:

| Keyword | Valid end-bound range (for a counter of type T) |
|---------|--------------------------------------------------|
| `until` | `type_min(T)` … `type_max(T)` (exclusive bound; the counter never holds it) |
| `to` | `type_min(T)` … `type_max(T)` (inclusive bound; the counter does hold it) |
| `downto` | `type_min(T)` … `type_max(T)` (inclusive bound) |

A **constant** end bound outside `[type_min(T), type_max(T)]` produces **E10064**. This makes the impossible v2-era case `0 to 256` on a `byte` a compile-time error rather than a silent infinite loop — the full byte range is written `0 to 255`.

```blend65
for (let i: byte = 0 to 255) { ... }   // ✅ 256 iterations — uses INX/BNE-wrap codegen
for (let i: byte = 0 to 256) { ... }   // ❌ E10064: end bound 256 out of range for 'byte' (0–255)
for (let i: byte = 0 until 256) { ... } // ❌ E10064: end bound 256 out of range for 'byte' (0–255)
```

### 7.3 Step

- `step` is optional; defaults to **1**.
- Must be a **compile-time constant**, positive integer.
- Step value of zero produces **E10061** (would create an infinite loop).

### 7.4 Loop Variable Rules

- The loop variable is **declared** by the for-loop (`let i: type = ...`) — it is not a pre-existing variable.
- The loop variable is **read-only** inside the body. Assignment to it produces **E10060**.
- The loop variable's type must be an integer type (`byte`, `sbyte`, `word`, `sword`). The bounds and step must match the variable's signedness (→ Ch 02, TS-5).
- The loop variable is scoped to the for-loop (body + bounds). It is not visible after the loop.
- Nesting restriction: a nested for-loop may not reuse the same variable name (**E10062**).

### 7.5 Break and Continue

- `break` exits the innermost enclosing loop immediately.
- `continue` jumps to the next iteration (increment/decrement + condition check).
- Using `break` or `continue` outside a loop body produces **E10063**.

### 7.6 Warnings

- **W10060**: Loop counter uses `word` but range fits in `byte` — use `byte` for faster execution.

### 7.7 6502 Code Generation

The compiler selects one of two patterns depending on the keyword and whether the end bound equals the counter type's maximum.

**Pattern A — compare-and-branch (`until`, and `to`/`downto` whose bound is *not* the type maximum):**

```blend65
for (let i: byte = 0 until 10) {
    poke($0400 + i, 1);
}
```

```asm
    LDX #$00            ; i = 0
.loop:
    CPX #$0A            ; compare with 10 (exclusive bound)
    BCS .end            ; if i >= 10, exit
    LDA #$01
    STA $0400,X         ; poke($0400 + i, 1)
    INX                 ; i++
    JMP .loop
.end:
; ~8 cycles/iteration overhead + body
```

For an inclusive `to` bound below the type maximum, the compiler compares against `bound + 1` (e.g. `1 to 8` compares against `9`), which is representable and uses the same `CPX`/`BCS` pattern.

**Pattern B — wrap termination (`to` whose bound *is* the type maximum, e.g. `0 to 255`):**

Comparing against `256` is impossible in 8 bits, so the compiler relies on the natural `INX` wrap from `255`→`0`, terminating when the counter wraps back to the start value:

```blend65
for (let i: byte = 0 to 255) {
    poke($0400 + i, 1);
}
```

```asm
    LDX #$00            ; i = 0
.loop:
    LDA #$01
    STA $0400,X         ; poke($0400 + i, 1)
    INX                 ; i++ — wraps 255 -> 0 after the final iteration
    BNE .loop           ; continue until the counter wraps back to 0
.end:
; exactly 256 iterations; ~5 cycles/iteration overhead + body
```

For `byte` loops with small ranges, the compiler uses X or Y register as the loop counter when possible (~6–7 cycles/iteration). For `word` loops, the counter is a ZP pair (~15–20 cycles/iteration).

---

## 8. Switch Statement

### 8.1 Syntax

```ebnf
switch_stmt     = "switch" , "(" , expression , ")" , "{"
                , { case_clause }
                , [ default_clause ]
                , "}" ;

case_clause     = "case" , case_value_list , ":" , case_body ;
case_value_list = const_expression , { "," , const_expression } ;
default_clause  = "default" , ":" , case_body ;
case_body       = { statement } , [ "fallthrough" , ";" ] ;
```

### 8.2 Auto-Break Semantics (SW-1)

Each case body ends **automatically** — there is no implicit fall-through. This is the Swift/Rust model, not the C model.

```blend65
switch (state) {
    case 0: doA();         // only doA() executes
    case 1: doB();         // only doB() executes
    case 2: doC();         // only doC() executes
}
```

### 8.3 Explicit Fallthrough

The `fallthrough` keyword explicitly opts into sequential execution into the next case:

```blend65
switch (level) {
    case 3:
        enableBoss();
        fallthrough;       // continues to case 2
    case 2:
        enableEnemies();
        fallthrough;       // continues to case 1
    case 1:
        enablePlayer();
}
```

**Fallthrough rules:**
- `fallthrough` must be the **last statement** in a case body (**E10074**).
- `fallthrough` in the last case/default has no effect (**E10073** warning).
- `fallthrough` cannot appear inside nested blocks (if/while/for) within the case (**E10074**).

### 8.4 Multi-Value Cases (SW-2)

Multiple values can share a case body using comma-separated values:

```blend65
switch (ch) {
    case 'A', 'E', 'I', 'O', 'U':
        isVowel = true;
    case 'B', 'C', 'D':
        isConsonant = true;
    default:
        isOther = true;
}
```

### 8.5 Valid Switch Expression Types

The switch expression must be `byte`, `sbyte`, `word`, `sword`, or an enum type. Other types produce **E10075**. `boolean` is not valid — use `if`/`else` instead.

### 8.6 Case Value Rules

- Case values must be **compile-time constants** (**E10071**).
- Case value type must match the switch expression type (**E10072**). Auto-promotion applies (→ Ch 02, TS-4).
- Duplicate case values produce **E10070**.
- Enum members are valid case values: `case Direction.UP:`

### 8.7 Default Clause

- At most one `default` clause is allowed (**E10076**).
- The `default` clause matches when no `case` value matches.
- `default` is optional — if absent, no action is taken when no case matches.

### 8.8 Warnings

- **W10070**: Switch expression is `word` but all case values fit in `byte` — consider `byte` for efficiency.

### 8.9 6502 Code Generation

The compiler generates a compare-and-branch chain for small switch statements and may use a jump table for larger ones:

```asm
; Compare-and-branch (small switch):
    LDA state
    CMP #$00
    BEQ .case0
    CMP #$01
    BEQ .case1
    JMP .default
.case0:
    JSR doA
    JMP .end
.case1:
    JSR doB
    JMP .end
.default:
    JSR doDefault
.end:
; ~4 bytes per case (CMP + BEQ), plus body
```

---

## 9. Break, Continue, Return

### 9.1 Break

`break` exits the innermost enclosing loop (`for`, `while`, `do-while`) immediately. Using `break` outside a loop produces **E10063**.

```blend65
for (let i: byte = 0 until 100) {
    if (arr[i] == target) {
        found = true;
        break;             // exit the for loop
    }
}
```

`break` does **not** apply to `switch` statements (switch uses auto-break semantics).

### 9.2 Continue

`continue` jumps to the next iteration of the innermost enclosing loop. For `for` loops, this means incrementing/decrementing the counter and re-evaluating the condition. Using `continue` outside a loop produces **E10063**.

### 9.3 Return

`return` exits the current function. In non-void functions, `return` must include an expression of the correct type (→ Ch 06). Code after `return` in the same block is unreachable (**W10131**).

---

## 10. Statement Grammar (EBNF Fragment)

```ebnf
statement        = var_decl
                 | const_decl
                 | assignment_stmt
                 | expression_stmt
                 | if_stmt
                 | while_stmt
                 | do_while_stmt
                 | for_stmt
                 | switch_stmt
                 | return_stmt
                 | break_stmt
                 | continue_stmt
                 | block ;

var_decl         = "let" , identifier , ":" , type , [ "=" , expression ] , ";" ;
const_decl       = "const" , identifier , ":" , type , "=" , expression , ";" ;
assignment_stmt  = lvalue , assignment_op , expression , ";" ;
expression_stmt  = expression , ";" ;
return_stmt      = "return" , [ expression ] , ";" ;
break_stmt       = "break" , ";" ;
continue_stmt    = "continue" , ";" ;
```

---

## 11. Error Codes

Errors canonically owned by this chapter:

| Code | Message |
|------|---------|
| E10060 | Cannot assign to for-loop variable `<name>` — loop variables are read-only |
| E10061 | Step value must not be zero — this would create an infinite loop |
| E10062 | Variable `<name>` already declared in enclosing for-loop — use a different name |
| E10063 | `<keyword>` can only be used inside a loop body |
| E10064 | For-loop end bound `<value>` is out of range for counter type `<type>` (`<min>`–`<max>`) |
| E10070 | Duplicate case value `<value>` — already used at line `<N>` |
| E10071 | Case value must be a compile-time constant |
| E10072 | Case value type `<case_type>` does not match switch expression type `<switch_type>` |
| E10073 | `fallthrough` has no effect — this is the last case in the switch |
| E10074 | `fallthrough` must be the last statement in a case body |
| E10075 | Cannot switch on type `<type>` — must be `byte`, `sbyte`, `word`, `sword`, or enum |
| E10076 | Only one `default` clause is allowed per switch statement |
| E10100 | Condition must be type `boolean` — found `<type>`. Use an explicit comparison |
| E10101 | Variable `<name>` shadows declaration in enclosing scope (line `<N>`) |
| E10102 | Not all code paths return a value in function `<name>` |

### Warning Codes

| Code | Message |
|------|---------|
| W10060 | Loop counter uses `word` but range fits in `byte` — use `byte` for faster execution |
| W10070 | Switch expression is `word` but all case values fit in `byte` |
| W10130 | Condition is always false — code block will never execute |
| W10131 | Unreachable code — statements after `<keyword>` will never execute |
