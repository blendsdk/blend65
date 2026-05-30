# F024 — Conditional (Ternary) Operator (`cond ? a : b`)

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F013 (control flow / boolean conditions), F016 (type system, auto-promotion), F017 (operators, precedence)  
> **Interacts with**: F010 (signed types), F014 (arrays), F020 (memory intrinsics), F022 (enums)

---

## Description

The conditional operator (also called the ternary operator) is an **expression** that selects between two values based on a boolean condition. It has the form `condition ? whenTrue : whenFalse`. If `condition` evaluates to `true`, the expression yields `whenTrue`; otherwise it yields `whenFalse`. Only the selected arm is evaluated — the other arm has no runtime effect.

It is the expression-context counterpart of the `if`/`else` statement: where `if`/`else` *executes* one of two statement blocks, the conditional operator *produces* one of two values. This makes value-selection assignments concise and readable, and lets a selected value be passed directly as a function argument or intrinsic operand without a temporary variable and a multi-line `if`/`else`.

---

## Syntax

```blend65
// Basic value selection
let color: byte = isAlert ? RED : GREEN;

// Clamp without a temporary
let clamped: byte = (x > maxX) ? maxX : x;

// Directly as an argument / intrinsic operand
poke(BORDER_REGISTER, dead ? 2 : 0);

// Nested (right-associative) — reads as a chain
let rank: byte = (score >= 90) ? GRADE_A
              : (score >= 50) ? GRADE_B
              : (score >= 10) ? GRADE_C
              : GRADE_F;
```

**Grammar (added to F017 expression grammar):**

```ebnf
conditional-expression
    = logical-or-expression [ "?" expression ":" conditional-expression ] ;
```

The conditional operator sits **below `||`** (the lowest binary operator) and **above assignment**. Because assignment is a *statement* in Blend65 (F017 Part 3), there is no assignment-vs-ternary precedence tangle. The operator is **right-associative**, so `a ? b : c ? d : e` parses as `a ? b : (c ? d : e)` — the conventional, useful chaining form.

---

## Alternatives Considered

| Alternative | Why Rejected |
|------------|--------------|
| `if`/`else` statement only (original v3 stance, ex-FUT-019) | Works everywhere but forces a pre-declared variable and 3+ lines for every value selection. Verbose for the common "pick one of two values" case. The ternary is purely additive and reuses existing codegen (short-circuit branch-to-load), so the cost of adding it is low. |
| `cond then a else b` keyword form | Introduces new keywords and diverges from the C/TypeScript audience's expectations (L3). The `?:` form is universally recognized. |
| Restrict arms to pure (side-effect-free) value expressions in v3 | Marginally simpler to verify, but inconsistent with `&&`/`||`, which already guarantee "only the taken path is evaluated" for side-effecting operands. Allowing side-effecting arms is more useful and uses the identical codegen guarantee. |
| `??` / `?.` (nullish / optional chaining) | No null/undefined concept in Blend65 — already excluded in F017. Unrelated to value selection. |

---

## Part 1: Semantics

### CO-1: Condition Must Be `boolean`

The condition (left of `?`) must have type `boolean`, exactly as in `if`/`while` conditions (F013 CF-2). A non-boolean condition is a compile-time error (E10100, shared with F013).

```blend65
let c: byte = ready ? 1 : 0;        // ✅ ready is boolean
let d: byte = count ? 1 : 0;        // ❌ E10100 — count is byte, not boolean. Use: count != 0 ? 1 : 0
```

### CO-2: Only the Selected Arm Is Evaluated

Exactly one arm is evaluated at runtime — the one selected by the condition. The other arm produces **no** side effects. This is the same guarantee as short-circuit `&&`/`||` (F017 OP-3), and developers may rely on it:

```blend65
// readSlow() is called ONLY when cached is false
let v: byte = cached ? cacheValue : readSlow();

// poke happens ONLY in the taken arm
let r: byte = dead ? poke_and_return_zero() : score;
```

This is a language guarantee, not an optimization.

### CO-3: Type Unification of the Two Arms

The result type of the conditional expression is the **unified type** of its two arms, computed with the existing F016 auto-promotion rules (TS-3/TS-4):

- If both arms have the same type `T`, the result type is `T`.
- If the arms are integer types of different widths (e.g., `byte` and `word`), the result is the **wider** type, with the narrower arm zero/sign-extended per F016.
- If the arms are integer types of different signedness, this is a mixed-signedness error (E10081, shared with F010) — the developer must cast one arm.
- If the arms are otherwise incompatible (e.g., `byte` and `boolean`, two different enum types, `byte` and a struct), it is an error (E10162).

```blend65
let a: word = big ? wideValue : byteValue;   // ✅ byte arm promoted to word
let b: byte = flag ? 1 : 2;                  // ✅ both byte literals
let c = flag ? sx : ux;                       // ❌ E10081 — sbyte vs byte arms
let d = flag ? 1 : RED;                       // ❌ E10162 — byte vs enum Color
```

The result of the conditional expression is then subject to the **same assignment/narrowing rules** as any other expression (F010 E10082 narrowing applies when assigning a wider unified result to a narrower variable).

### CO-4: Operand Categories

The arms may be any value expression of a permitted type: literals, variables, constants, function calls, array element reads, struct field reads, intrinsic calls (`peek`, `lo`, `hi`, etc.), and nested conditional expressions. The arms may **not** be whole structs or whole arrays (consistent with F017 OP-A6 — no operators on aggregate types); use field/element access to select scalar values.

```blend65
let hp: byte = boss ? enemies[0].hp : enemies[1].hp;   // ✅ field reads
let e: Enemy = pickEnemy ? a : b;                      // ❌ E10162 — whole struct arms not allowed
```

### CO-5: Enums

Both arms may be the **same** enum type; the result is that enum type. Two **different** enum types are an error (E10162), consistent with F022's nominal-typing stance (E10236).

```blend65
let s: State = alert ? State.RED : State.GREEN;   // ✅ same enum
```

---

## Part 2: 6502 Code Generation

The conditional operator compiles to the **same branch-to-load pattern** as the equivalent `if`/`else` that assigns to a temporary — there is no new codegen concept beyond what F017's short-circuit operators already require. The condition is evaluated, a branch selects an arm, the selected arm's value is materialized into the result location, and control rejoins.

### Byte arms

```blend65
let color: byte = isAlert ? RED : GREEN;
```

```asm
    LDA _isAlert
    BEQ .else           ; condition false → take else arm
    LDA #RED            ; true arm
    JMP .end
.else:
    LDA #GREEN          ; false arm
.end:
    STA _color
    ; ~10-12 cycles, comparable to the if/else it replaces
```

### Word arms

```blend65
let addr: word = useHigh ? highAddr : lowAddr;
```

```asm
    LDA _useHigh
    BEQ .else
    LDA _highAddr       ; true arm (low byte)
    STA _addr
    LDA _highAddr+1     ; true arm (high byte)
    STA _addr+1
    JMP .end
.else:
    LDA _lowAddr
    STA _addr
    LDA _lowAddr+1
    STA _addr+1
.end:
```

### Side-effecting arm (only taken path runs)

```blend65
let v: byte = cached ? cacheValue : readSlow();
```

```asm
    LDA _cached
    BEQ .else
    LDA _cacheValue     ; true arm — readSlow() NOT called
    JMP .end
.else:
    JSR _readSlow       ; false arm — only reached when cached is false
.end:
    STA _v
```

### Nested (right-associative) chains

A nested conditional compiles to a cascade of branches, equivalent to an `if`/`else if`/`else` chain — each test branches forward to the next, the matching arm loads and jumps to the common end label. Cost scales linearly with the number of arms, exactly like the `if`/`else if` chain it replaces (H2).

---

## Part 3: Feature Evaluation (Language Guard)

### Platform Universality (P)

| Rule | Status | Notes |
|------|--------|-------|
| P1 Cross-platform compilable | ✅ | Pure branch + load; no platform-specific hardware. Compiles identically on all targets. |
| P2 Platform-meaningful | ✅ | Value selection (clamping, flag→value, color/state choice) is ubiquitous on every target. |
| P3 No platform assumptions | ✅ | Core definition references no address, register, chip, or encoding. |
| P4 Resource-scalable | ✅ | Generates the same code as the equivalent `if`/`else`; no resource amplification. Identical on 4KB 7800 and 512KB CX16. |

### Hardware / 6502 Feasibility (H)

| Rule | Status | Notes |
|------|--------|-------|
| H1 6502 implementable | ✅ | Compare + branch + load + JMP — all native 6502 instructions. |
| H2 Cost transparency | ✅ | Documented codegen (Part 2). Cost equals the `if`/`else` it replaces; nested chains scale linearly. |
| H3 SFA compatible | ✅ | No allocation, no recursion. Arms reuse the enclosing function's frame. |
| H4 Memory footprint documented | ✅ | RAM: 0 (result goes to existing destination). ROM: branch+load sequence per arm. ZP: none required. |
| H5 Fully deterministic | ✅ | Exactly one arm evaluated; unification fully defined; incompatible arms are compile errors. No undefined behavior. |

### Language Design Quality (L)

| Rule | Status | Notes |
|------|--------|-------|
| L1 Unambiguous syntax | ✅ | `?` is otherwise unused; `:` after the true-arm is required and never collides with type annotations (those never appear mid-expression) or `case:` labels. LL(k)-parseable. |
| L2 Consistent with existing | ✅ | Reuses F013 boolean-condition rule, F016 unification, F017 precedence. Lowest expression precedence, right-associative — conventional. |
| L3 Beginner-friendly | ✅ | Identical to C/TypeScript/Java `?:`. The target audience reads it instantly. |
| L4 Minimal feature | ✅ | The single, standard form. No elvis operator, no nullish variants, no statement-form. |
| L5 No redundancy | ✅ | Overlaps with `if`/`else` only in outcome; `if`/`else` is a *statement*, this is an *expression*. The expression context (function args, intrinsic operands) is not otherwise expressible without a temporary variable. |
| L6 Error messages defined | ✅ | E10100 (non-boolean condition), E10081 (mixed signedness arms), E10162 (incompatible arm types), E10082 (narrowing result on assignment). See Part 4. |
| L7 Compile-time failure preferred | ✅ | All misuse (bad condition type, incompatible arms, narrowing) caught at compile time. |
| L8 Feature interaction documented | ✅ | See Part 5. |
| L9 Documentable with examples | ✅ | Prose + basic + pattern + edge-case examples (Part 6). |

### Compiler Implementability (C)

| Rule | Status | Notes |
|------|--------|-------|
| C1 Lexer/parser implementable | ✅ | `?` and `:` are single-char tokens (already lexed for other uses; `:` exists for type annotations). Recursive-descent: after parsing a logical-or expression, if `?` follows, parse `expression`, require `:`, parse a conditional-expression (right recursion). No symbol-table lookup needed. |
| C2 Semantic analysis defined | ✅ | Condition must type-check as `boolean`; arm types unified via F016 rules; result type defined; narrowing checked at assignment site. |
| C3 Code generation strategy | ✅ | Branch-to-load cascade (Part 2). Same lowering as `if`/`else` assigning a temp. |
| C4 Unit testable | ✅ | Lexer: `?`→QUESTION, `:`→COLON. Parser: conditional-expression node with cond/then/else children; nesting right-associative. Semantic: E10100/E10081/E10162/E10082 paths. Codegen: branch+load patterns for byte/word/enum arms. |
| C5 Runtime verifiable | ✅ | Emulator test: assign via ternary, verify the destination holds the selected value and the untaken arm's side effect did **not** occur, across all platforms. |

### Future-Proofing (F)

| Rule | Status | Notes |
|------|--------|-------|
| F1 Extensible | ✅ | Purely additive: no existing valid program used `?`. Adding it breaks nothing; future refinements (e.g., expanding permitted arm types) remain backward compatible. |
| F2 Platform-profile ready | ✅ | No platform-varying behavior; nothing to push into profiles. |
| F3 Optimizer-friendly | ✅ | Lowers to standard branch/load IL — amenable to constant folding (fold when condition is a compile-time constant: emit only the taken arm), branch simplification, and common-subexpression elimination. |
| F4 Stability classification | ✅ | **Stable** — standard, well-understood operator with fully defined semantics. |

---

## Part 4: Error Codes

| Code | Message | Trigger |
|------|---------|---------|
| E10162 | Conditional operator arms have incompatible types `<type_a>` and `<type_b>` — both arms must yield the same type (or compatible integer types) | `flag ? 1 : RED`, `flag ? aByte : aStruct`, two different enum types |

**Existing error codes that apply:**

| Code | Source | Applicability |
|------|--------|--------------|
| E10100 | F013 | Condition (left of `?`) is not type `boolean` |
| E10081 | F010 | Arms mix signed and unsigned integer types |
| E10082 | F010 | Unified result is wider than the variable it is assigned to (narrowing) |
| E10151 | F016 | A `boolean`-typed arm used where an integer is required by the other arm / context |

There are no new warning codes. The cost warnings of any operators *inside* the arms (e.g., a runtime multiply in an arm — W10170) still apply to that sub-expression as normal.

---

## Part 5: Feature Interactions

| Feature | Interaction |
|---------|-------------|
| F013 Control flow | Condition uses the same boolean rule (CF-2, E10100). The ternary is the expression analogue of `if`/`else`; either may be chosen. A ternary may appear in an `if`/`while` condition: `if (a ? b : c) { ... }`. |
| F016 Type system | Arm unification uses auto-promotion (TS-3/TS-4). Result subject to narrowing rules on assignment (E10082). |
| F017 Operators | Lowest-precedence expression operator, below `||`, right-associative. Operators may appear in the condition and in either arm with normal precedence; parenthesize for clarity. |
| F010 Signed types | Mixed-signedness arms → E10081. Signed/unsigned arms must be cast to a common type. |
| F014 Arrays | Arms may be array *element* reads; whole arrays are not valid arms (E10162). A ternary may compute an index: `buf[hi ? 1 : 0]`. |
| F020 Memory intrinsics | Arms may be `peek`/`lo`/`hi`/`sizeof`/etc. A ternary may be an argument to `poke`: `poke(reg, on ? 1 : 0)`. Intrinsic side effects in an untaken arm do not occur (CO-2). |
| F022 Enums | Same enum on both arms → that enum type. Different enums → E10162 (consistent with E10236). |
| F018 Functions | Arms may be function calls; an untaken arm's call is not executed (CO-2). A ternary may be a call argument or a `return` expression. |
| F011 Structs | Whole-struct arms are not allowed (E10162); select scalar fields instead. |

---

## Part 6: Examples

### Basic usage

```blend65
module ui;

const RED: byte = 2;
const GREEN: byte = 5;

function borderColor(isAlert: boolean): byte {
    return isAlert ? RED : GREEN;
}
```

### Pattern: clamping and flag-to-value in a game loop

```blend65
module game;

const MAX_X: byte = 39;

function clampX(x: byte): byte {
    return (x > MAX_X) ? MAX_X : x;
}

function updateBorder(playerDead: boolean): void {
    // Selected value passed straight to the intrinsic — no temporary needed
    poke(BORDER_REGISTER, playerDead ? 2 : 0);
}
```

### Pattern: nested chain (grade tiers)

```blend65
module score;

const GRADE_A: byte = 'A';
const GRADE_B: byte = 'B';
const GRADE_C: byte = 'C';
const GRADE_F: byte = 'F';

function gradeFor(score: byte): byte {
    return (score >= 90) ? GRADE_A
         : (score >= 50) ? GRADE_B
         : (score >= 10) ? GRADE_C
         : GRADE_F;       // right-associative: reads top-to-bottom
}
```

### Edge case: type unification and narrowing

```blend65
module edge;

function widen(useWide: boolean, w: word, b: byte): word {
    return useWide ? w : b;     // ✅ byte arm promoted to word; result is word
}

// ❌ E10082 — unified result is word, cannot implicitly assign to byte:
//    let bad: byte = useWide ? w : b;

// ❌ E10081 — arms mix signed and unsigned:
//    let m = flag ? signedVal : unsignedVal;

// ❌ E10100 — condition is not boolean:
//    let n: byte = count ? 1 : 0;        // use: count != 0 ? 1 : 0
```

---

## Verdict

**✅ ACCEPTED** (Stable)

The conditional operator passes all 23 Language Guard rules. It is purely additive (no existing program uses `?`), reuses existing infrastructure (F013 boolean conditions, F016 unification, F017 short-circuit branch-to-load codegen), and introduces exactly one new error code (E10162). It compiles to the same cost as the equivalent `if`/`else` and provides concise value selection in expression contexts — particularly as function arguments and intrinsic operands — that `if`/`else` cannot express without a temporary variable.
