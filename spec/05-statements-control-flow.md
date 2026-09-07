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

This applies across all nesting levels: function parameters, outer blocks, for-header declarations,
and module-level variables.

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

For the displayed form, the false path's condition load, comparison, and taken branch cost 8–10
cycles; the true path's condition load, comparison, untaken branch, and join `JMP` cost 10–11
cycles. Those ranges allow zero-page or absolute `x` and a same-page or page-crossing taken branch.
They exclude both selected bodies.

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

Blend65 uses one C/JavaScript-style three-clause form. Each clause is optional.

```ebnf
for_stmt        = "for" , "(" , [ for_initializer ] , ";"
                , [ expression ] , ";" , [ for_update ] , ")" , block ;
for_initializer = for_local_decl | expression_list ;
for_local_decl  = "let" , identifier , ":" , value_type , [ "=" , expression ]
                | "const" , identifier , ":" , value_type , "=" , const_expression ;
for_update      = expression_list ;
expression_list = expression , { "," , expression } ;
```

```blend65
for (let i: byte = 0; i < 10; i += 1) { ... }
for (i = start, left = count; left != 0; i += stride, left -= 1) { ... }
for (;;) { updateFrame(); }
```

### 7.2 Evaluation Order

For `for (I; C; U) B`:

1. Enter the for-statement scope and evaluate initializer `I` once.
2. Evaluate condition `C` before every possible iteration. An omitted condition is `true`.
3. If the condition is false, leave the loop. Otherwise execute body `B`.
4. After normal body completion or `continue`, evaluate update `U` and return to step 2.
5. `break` and `return` leave without evaluating the update again.

Expression lists in the initializer and update evaluate left to right. Every clause uses the
ordinary expression rules, including calls, MMIO effects, conversions, and fixed-width wrap. A
present condition must have type `boolean` (**E10100**). The compiler may optimize an evaluation
only when its normal value-and-effect proof permits it.

### 7.3 Scope and Mutability

- An initializer declaration is one ordinary local `let` or `const`; the header delimiter replaces
  its trailing semicolon.
- Its binding is visible in the condition, update, and body, but not after the loop.
- The body is a nested block. Ordinary no-shadowing rule E10101 applies; there is no special loop
  shadowing rule.
- A `let` binding remains mutable in the body. A `const` uses ordinary E10190–E10192 rules.
- An expression initializer introduces no binding and may update existing variables.
- Header locals and expression temporaries use ordinary CFG liveness and SFA allocation. No hidden
  iterator, dynamic frame, or runtime support is created.

### 7.4 Fixed-Width Boundary Behavior

A `for` statement is not a mathematical range. Its condition and update observe ordinary typed
values. If a `byte` update wraps from 255 to 0, the next condition sees 0.

```blend65
for (let i: byte = 0; i < 10; i += 1) { ... } // 0 through 9
for (let i: word = 0; i < 256; i += 1) { ... } // 0 through 255
for (let i: byte = 0; i < 256; i += 1) { ... } // ❌ E10262: byte cannot reach 256
```

The full-domain form uses `word` because its semantic counter must reach the terminal value 256.
When `i` does not escape and no source effect observes the wider terminal state, the optimizer may
still use an 8-bit machine counter and the expert `INX`/`BNE` wrap-exit idiom. Source width does not
force machine width when a narrowing proof exists.

Wrapping remains legal and useful. Byte-bounded loops, ring cursors, timers, decrement-to-zero
loops, deliberate `for (;;)`, and loops whose source explicitly observes wrap are not rejected.
E10262 applies only when bounded canonical-induction analysis proves that a finite-looking loop's
counter must repeat before its invariant comparison can become false, the body does not modify that
counter or bound, and the loop has no other explicit exit. The diagnostic identifies the counter's
representable range and unreachable bound and recommends a suitable wider type. This is a focused
reachability proof, not a general termination solver, and it never silently changes the declared
counter type.

### 7.5 Break and Continue

- `break` exits the innermost enclosing loop immediately.
- `continue` evaluates the update clause and then re-evaluates the condition.
- Using `break` or `continue` outside a loop body produces **E10063**.

### 7.6 6502 Code Generation

Correctness lowers the statement to initializer, condition, body, update, and end blocks.
`continue` targets update; `break` targets end. This generic CFG works for every legal loop.

A bounded canonical-induction recognizer may then prove a known initialization, invariant bound,
known stride, safe alias/effect behavior, and equivalent exits. It may select a register counter,
fold a comparison, narrow a semantic word induction value, or choose a wrap-exit pattern. A loop
that does not match remains correct generic CFG code; the compiler does not add a generalized loop
framework or require hardware-shaped source.

**Small ascending byte loop:**

```blend65
for (let i: byte = 0; i < 10; i += 1) {
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
    INX                 ; i += 1
    BCC .loop           ; unconditional: body and INX preserve C=0 from CPX
.end:
; Same-page loop control excluding LDX/body: 95 cycles for 10 body executions
; Add 10 cycles if the taken BCC backedge crosses a page and 1 if the taken exit BCS does
```

**Proven full 256-element loop:**

```blend65
for (let i: word = 0; i < length(page); i += 1) {
    poke($0400 + i, 1);
}
```

```asm
    LDX #$00            ; i = 0
.loop:
    LDA #$01
    STA $0400,X         ; poke($0400 + i, 1)
    INX                 ; machine induction wraps after source value 255
    BNE .loop           ; zero-result/wrap proves the source's next condition is false
.end:
; exactly 256 iterations
; induction control excluding LDX/body: 1,279 cycles with a same-page BNE backedge
; add 255 cycles when all 255 taken BNE backedges cross a page
```

This narrowing is legal only when every observable source value and effect remains identical. If
the address of `i` escapes, the condition or update has other effects, or the body needs the full
word value in a way that cannot be reconstructed, the compiler retains a suitable word
representation. The selected form's bytes, cycles, clobbers, memory traffic, RAM/ZP, and spills are
reported and compared with expert assembly.

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
- `fallthrough` in the last case/default is rejected (**E10073** error).
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
for (let i: byte = 0; i < 100; i += 1) {
    if (arr[i] == target) {
        found = true;
        break;             // exit the for loop
    }
}
```

`break` does **not** apply to `switch` statements (switch uses auto-break semantics).

### 9.2 Continue

`continue` jumps to the next iteration of the innermost enclosing loop. For `for` loops, this means
evaluating the update clause and then re-evaluating the condition. Using `continue` outside a loop
produces **E10063**.

### 9.3 Return

`return` exits the current function. In non-void functions, `return` must include an expression of the correct type (→ Ch 06). Code after `return` in the same block is unreachable (**W10131**).

---

## 10. Statement Grammar (EBNF Fragment)

```ebnf
statement        = var_decl
                 | const_decl
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

var_decl         = "let" , identifier , ":" , value_type , [ "=" , expression ] , ";" ;
const_decl       = "const" , identifier , ":" , value_type , "=" , const_expression , ";" ;
expression_stmt  = expression , ";" ;
return_stmt      = "return" , [ expression ] , ";" ;
break_stmt       = "break" , ";" ;
continue_stmt    = "continue" , ";" ;
```

An assignment used as a statement is an `expression_stmt`; assignment itself remains the
right-associative, value-producing expression defined by Ch 04, OP-A1. Any expression may appear as
an expression statement. The language defines no diagnostic merely because a pure value is
discarded, and it must not reject the syntax merely because the expression is not a function call.

---

## 11. Diagnostic Conditions

This chapter owns statement and control-flow trigger predicates. Chapter 14 alone owns public
severities, message templates, spans, suppression, and history.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10063 | `break` or `continue` appears outside a loop body. | The statement is rejected. |
| E10070 | Two clauses in one `switch` have the same case value. | The duplicate case is rejected. |
| E10071 | A case value is not a compile-time constant. | The case is rejected. |
| E10072 | A case value is incompatible with the switch expression type. | The case is rejected. |
| E10073 | `fallthrough` appears in the final case of a switch. | The statement is rejected because there is no following case. |
| E10074 | `fallthrough` is not the final top-level statement of its case body. | The statement is rejected. |
| E10075 | A switch expression is neither an integer nor an enum. | The switch is rejected. |
| E10076 | A switch contains more than one `default` clause. | Every additional default clause is rejected. |
| E10100 | An `if`, `while`, `do while`, or `for` condition does not have type `boolean`. | The condition is rejected; no truthiness conversion is inserted. |
| E10101 | A local declaration shadows an enclosing declaration. | The inner declaration is rejected. |
| E10239 | An identifier does not resolve in its lexical/module scope. | The reference is rejected. |
| E10262 | Canonical induction proves that a finite-looking loop counter repeats before its condition can become false. | The loop is rejected; use a type that can represent the terminal state or make deliberate wrap/infinite control explicit. |

### Warning Conditions

| Code | Trigger | Consequence |
|------|---------|-------------|
| W10070 | A `word` switch expression has only byte-range case values. | Compilation continues; comparisons may be wider than necessary. |
| W10130 | A condition is provably always false. | Compilation continues; the guarded block is unreachable. |
| W10131 | A statement is unreachable after unconditional control transfer. | Compilation continues; the unreachable statement has no runtime effect. |
