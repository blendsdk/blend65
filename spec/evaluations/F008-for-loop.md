# F008 — For loop

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)  
> **Compatibility note**: Replaces the provisional `until`/`to`/`downto`/`step` range form with
> one C/JavaScript-style three-clause loop.

## Description

The Blend65 `for` statement uses the familiar `for (initializer; condition; update) { ... }`
shape. It is a general loop, not a special range construct. The initializer runs once, the
condition runs before every possible iteration, and the update runs after a normally completed
body and after `continue`.

This source form does not require a runtime, a software stack, or special SFA behavior. Correct
lowering is an ordinary control-flow graph. A small canonical-induction recognizer may then recover
counted-loop facts and select the same register, wrap-exit, or strength-reduced machine sequence an
expert 6502 programmer would use. Correctness never depends on recognizing that pattern.

## Syntax

```ebnf
for_stmt        = "for" , "(" , [ for_initializer ] , ";"
                , [ expression ] , ";" , [ for_update ] , ")" , block ;

for_initializer = for_local_decl | expression_list ;
for_local_decl  = "let" , identifier , ":" , value_type , [ "=" , expression ]
                | "const" , identifier , ":" , value_type , "=" , const_expression ;
for_update      = expression_list ;
expression_list = expression , { "," , expression } ;
```

The declaration form follows the normal local `let`/`const` rules but omits the declaration's own
semicolon because the header delimiter supplies it. An expression list evaluates its expressions
once each, from left to right. Blend65 still has no general comma operator and no `++` or `--`
operator; compound assignment such as `i += 1` is the normal update spelling.

```blend65
for (let i: byte = 0; i < 10; i += 1) {
    process(i);
}

for (i = start, remaining = count; remaining != 0; i += stride, remaining -= 1) {
    process(data[i]);
}

for (;;) {
    updateFrame();
}
```

The former range words `until`, `to`, `downto`, and `step` have no special meaning. They are
ordinary identifiers outside any separately defined feature.

## Exact Evaluation and Control Flow

For `for (I; C; U) B`, execution is exactly:

1. Enter a new for-statement scope.
2. Evaluate `I` once, left to right when it is an expression list. A declaration creates its
   binding in this scope.
3. Evaluate `C`. If it is omitted, use the Boolean value `true` without emitting a load or helper.
4. If `C` is false, leave the loop and its scope.
5. Execute body block `B`.
6. On normal body completion or `continue`, evaluate `U` once, left to right, then return to step 3.
7. On `break`, leave the loop immediately without evaluating `U` again. `return` also skips `U`.

The condition must have type `boolean`; there is no integer truthiness. Each clause uses ordinary
expression evaluation, conversion, side-effect, MMIO, call, and fixed-width wrap rules. The
compiler may not hoist, merge, delete, or reorder a clause evaluation unless the normal optimizer
proof shows that all values and observable effects are unchanged.

```blend65
for (let i: byte = start(); i < limit(); i += step()) {
    process(i);
}
```

Here `start()` runs once. `limit()` runs before every possible iteration, including the first.
`step()` runs only after a completed body or `continue`. This is intentional mainstream behavior;
developers who want a once-evaluated bound store it explicitly:

```blend65
let end: byte = limit();
for (let i: byte = 0; i < end; i += 1) {
    process(i);
}
```

## Scope, Mutability, and SFA

- A declaration in the initializer is visible in the condition, update, and body, but not after the
  loop.
- The body is a nested block scope. Blend65's ordinary no-shadowing rule applies; there is no
  for-specific shadowing rule.
- A `let` binding is mutable. Assigning it in the body is legal and has ordinary program meaning.
- A `const` binding follows the normal constant-initializer and assignment rules.
- An expression initializer introduces no binding and may reuse existing variables.
- Header bindings, expression temporaries, and spills are ordinary function storage. SFA uses their
  real CFG liveness and interference; the loop introduces no dynamic frame, hidden iterator, or
  runtime state.

Because the counter is an ordinary variable, changing it in the body can change termination. This
is expected in C/JavaScript-style loops and must not receive a special compiler restriction.

## Fixed-Width Boundaries

A `for` loop does not create mathematical-range semantics. Its initializer, condition, and update
are ordinary Blend65 expressions. Integer updates wrap at the declared width, and the next
condition observes that wrapped value.

```blend65
// Exactly ten iterations.
for (let i: byte = 0; i < 10; i += 1) { ... }

// Exactly 256 iterations. The semantic counter must represent the terminal value 256.
for (let i: word = 0; i < 256; i += 1) { ... }

// ❌ E10262: the byte counter repeats before it can reach 256.
for (let i: byte = 0; i < 256; i += 1) { ... }
```

The third header looks finite to a modern developer, but its invariant condition can never become
false. Bounded canonical-induction analysis therefore rejects it with E10262 rather than silently
letting it repeat. The compiler must not secretly widen the declared counter because that would
change observable behavior when the counter is assigned, addressed, passed, or read.

This does not outlaw modular byte behavior. Byte-bounded loops, ring cursors, timers,
decrement-to-zero loops, deliberate `for (;;)`, and loops that explicitly observe wrap remain
legal. E10262 requires proof that the canonical counter repeats before its invariant comparison can
be false, that the body does not modify the counter or bound, and that no other explicit exit is
present. It is not a general termination analysis.

A descending loop that must include zero likewise needs a semantic type that can represent its
post-zero value:

```blend65
for (let i: sword = 9; i >= 0; i -= 1) {
    process(word(i));
}
```

The optimizer may still use an 8-bit induction state when it proves the wider semantic values are
not otherwise observable.

## `break` and `continue`

`break` and `continue` target the innermost enclosing loop.

```blend65
for (let i: byte = 0; i < 100; i += 1) {
    if (data[i] == target) {
        foundIndex = i;
        break;              // update is skipped
    }
    if (data[i] == EMPTY) {
        continue;           // update runs, then condition runs
    }
    process(i);
}
```

Using either keyword outside a loop is E10063. Labeled exits remain deferred (FUT-006).

## Correct Lowering

The target-neutral lowering is the following CFG:

```text
for.scope.entry:
    initializer
    jump for.condition

for.condition:
    if omitted-condition-or-condition then for.body else for.end

for.body:
    body
    jump for.update

for.update:
    update
    jump for.condition

for.end:
    leave for scope
```

`continue` branches to `for.update`; `break` branches to `for.end`. A `return` branches to the
function exit. This lowering is sufficient for every legal `for` statement and does not depend on
the Pratt parser: the statement parser owns the three delimiters and invokes the ordinary
expression parser for each clause.

## Canonical Induction Recognition

After semantic lowering, a bounded recognizer may classify a loop as canonical induction when it
can prove all relevant facts, including:

- one induction variable has a known initialization;
- the loop condition compares that value against an invariant bound;
- the update adds or subtracts a known stride;
- body writes, aliases, calls, MMIO, callbacks, and escaped addresses cannot change the induction
  state or bound unexpectedly;
- removing, widening, narrowing, or combining an update cannot change an observable value or
  effect; and
- every exit and `continue` edge retains the source control-flow behavior.

This is analysis over the existing CFG and value/effect facts, not a second loop language or a
general loop framework. A loop that does not match remains correct generic CFG code.

### Full 256-element array loop

```blend65
for (let i: word = 0; i < length(page); i += 1) {
    page[i] = 0;
}
```

When `length(page) == 256`, `i` does not escape, and the body needs only its low byte, the backend
may prove the source equivalent to this expert pattern:

```asm
    LDX #$00
.loop:
    LDA #$00
    STA page,X
    INX
    BNE .loop
```

The machine loop never materializes semantic `i == 256`; the `INX` zero-result/wrap event proves the
same body-execution sequence and final control edge. If the source observes `i` or the condition in
a way that invalidates that proof, the optimizer must retain a representation that preserves the
ordinary word semantics.

### Small ascending byte loop

```blend65
for (let i: byte = 0; i < 10; i += 1) {
    poke($0400 + i, 1);
}
```

One valid selected pattern is:

```asm
    LDX #$00
.condition:
    CPX #$0A
    BCS .end
    LDA #$01
    STA $0400,X
    INX
    BCC .condition       ; unconditional: body and INX preserve C=0 from CPX
.end:
```

The exact branch layout may differ when measured as faster or smaller, but behavior, effects,
clobbers, bytes, cycles, and storage must be compared against an expert hand-written alternative.

## Cost Model

The language construct itself allocates no runtime object and links no helper. Cost is the sum of
the selected code for each clause, branch/layout overhead, body, and any normal SFA homes or spills.

| Form | Required accounting |
|---|---|
| Generic loop | initializer once; condition per test; update per normal/continue edge; branch and body costs |
| Register induction | register lifetime/clobbers, compare/update/branch bytes and taken/not-taken cycles |
| Static/ZP induction | load/store or memory increment cost plus occupied RAM/ZP bytes |
| Narrowed semantic counter | proof boundary and any value materialization required by observable uses |
| Unrolled loop | replicated body/code bytes, changed branch/layout range, cycle benefit, and instruction-cache assumptions omitted because 6502 has none |

No warning tells the developer to replace a semantic `word` counter with `byte` merely for compiler
convenience. Choosing an 8-bit machine induction representation is an optimizer responsibility.

## Diagnostics

The loop reuses ordinary diagnostics:

| Code | Condition |
|---|---|
| E10063 | `break` or `continue` appears outside a loop body |
| E10100 | A present `for` condition is not `boolean` |
| E10101 | A declaration in the for scope or body shadows an enclosing declaration |
| E10262 | Canonical induction proves that a finite-looking counter repeats before its invariant condition can become false |
| E10190/E10191/E10192 | Ordinary `const` initialization or assignment rules are violated |
| W10190 | A function-local `let` may be read before assignment, including through a header path |
| W10130 | A present condition is provably always false |
| W10131 | A statement is unreachable after unconditional control transfer |

Former range-only diagnostics E10060, E10061, E10062, E10064, and W10060 are retired.
Their conditions either no longer exist or are owned by the ordinary declaration, type, scope, and
expression rules.

## Interaction Matrix

| Feature | Interaction |
|---|---|
| Types and casts | Every clause uses ordinary expression typing and explicit conversion rules. |
| Variables/constants | The initializer may declare one normal local binding; its scope is the whole for statement. |
| Arrays | `let i: word = 0; i < length(a)` is correct for every representable array length; narrowing is an optimizer proof. |
| Structs/enums | Header/body expressions may use them wherever the ordinary operators permit. |
| Functions | Calls retain normal left-to-right evaluation, effects, clobbers, and SFA homes. |
| Memory intrinsics/MMIO | Volatile reads/writes keep exact access count and order in every clause. |
| Interrupt domains | Shared values may change asynchronously under their normal concurrency contract; the loop adds no snapshot semantics. |
| `while`/`do-while` | All are general loops. `for` is the concise form when initialization/update belong in the header. |
| `switch` | A switch is transparent to loop `break`/`continue` ownership under the existing auto-break rule. |
| SFA | Header bindings and temporaries use normal lexical/CFG liveness; no dynamic allocation occurs. |
| Optimizer | Canonical induction may be recognized only with alias/effect/range proof; generic loops stay generic. |

## Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Keep only `until`/`to`/`downto`/`step` | It gives one statement special range types, read-only counters, once-evaluated bounds, extra diagnostics, and full-domain edge rules. Those restrictions are not forced by 6502 hardware and surprise C/JavaScript developers. |
| Support both range and three-clause forms | It duplicates loop semantics, parser/AST paths, diagnostics, optimization tests, and documentation without adding expressiveness. Canonical induction analysis recovers the optimization benefit from one familiar form. |
| Lower every loop as opaque generic control flow forever | Correct but fails the output-quality directive. Common induction patterns must be recognized and compared with expert machine code. |
| Add a generalized loop-optimization framework now | No current requirement needs that machinery. A bounded induction recognizer over the normal CFG is sufficient and keeps later extension possible. |

## Decision Summary

| # | Question | Decision |
|---:|---|---|
| 1 | Syntax | One `for (initializer; condition; update) { block }` form. |
| 2 | Optional clauses | All three clauses may be omitted; an omitted condition is `true`. |
| 3 | Initializer | One normal local `let`/`const` declaration or a left-to-right expression list. |
| 4 | Condition | Evaluated before every iteration and must be `boolean`. |
| 5 | Update | Left-to-right expression list after normal completion or `continue`; skipped by `break`/`return`. |
| 6 | Scope | A distinct for scope contains the initializer binding; the body is its nested block. |
| 7 | Mutability | Ordinary declaration rules; no read-only loop counter. |
| 8 | Fixed-width behavior | Ordinary wrapping expressions; no hidden widening. E10262 rejects only a proved finite-looking unreachable termination. |
| 9 | Full byte domain | Use a semantic type that represents the terminal value; proven lowering may use `INX/BNE` or `DEX/BNE`. |
| 10 | Parsing | Statement parser owns delimiters and calls the ordinary expression parser. No Pratt-parser extension is required. |
| 11 | SFA | Ordinary local/temporary liveness; no hidden iterator, dynamic frame, or runtime. |
| 12 | Optimization | Bounded canonical-induction recognition over normal CFG; unmatched loops remain correct. |
| 13 | Exits | `continue` goes to update; `break` and `return` skip update. |
| 14 | Legacy range form | Removed, not retained as a second syntax. Its four words return to ordinary identifiers. |

## Language Guard Evaluation

### Platform Universality

- **P1 Cross-platform compilable** ✅ — ordinary control flow compiles on every target CPU.
- **P2 Platform-meaningful** ✅ — initialization/condition/update loops are common in games and tools.
- **P3 No platform assumptions** ✅ — the semantic contract names no platform address or device.
- **P4 Resource-scalable** ✅ — no mandatory storage or helper; selected costs are reported.

### Hardware / 6502 Feasibility

- **H1 6502 implementable** ✅ — branches, comparisons, and updates are sufficient.
- **H2 Cost transparency** ✅ — clause frequency and selected loop overhead are explicit.
- **H3 SFA compatible** ✅ — all bindings and temporaries have static CFG lifetimes.
- **H4 Memory footprint documented** ✅ — zero inherent RAM/ZP/runtime cost; normal homes are charged.
- **H5 Fully deterministic** ✅ — order, exits, omission, side effects, and fixed-width wrap are exact.

### Language Design Quality

- **L1 Unambiguous** ✅ — two semicolon delimiters split three standard recursive-descent clauses.
- **L2 Consistent** ✅ — uses normal declarations, expressions, blocks, conditions, and scope.
- **L3 Beginner-friendly** ✅ — familiar to C, JavaScript, and TypeScript developers.
- **L4 Minimal** ✅ — one syntax and one generic CFG; no parallel range construct.
- **L5 No redundancy** ✅ — `for` is the concise header form; it does not duplicate a range type/API.
- **L6 Error messages** ✅ — malformed syntax uses parser diagnostics; semantic misuse uses ordinary codes.
- **L7 Compile-time failure preferred** ✅ — type, scope, constant, and proved unreachable-counter errors are rejected before lowering.
- **L8 Interactions documented** ✅ — see the interaction matrix above.
- **L9 Documentable with examples** ✅ — basic, effectful, deliberate-infinite, rejected-boundary, and optimized cases are shown.

### Compiler Implementability

- **C1 Lexer/parser implementable** ✅ — only `for`, punctuation, declarations, and expressions are used.
- **C2 Semantic analysis defined** ✅ — evaluation, type, scope, mutation, exit, and SFA rules are complete.
- **C3 Code generation strategy exists** ✅ — generic CFG first; proven induction specialization second.
- **C4 Unit testable** ✅ — clause AST, order, scope, exits, wrap, and canonical recognition are enumerable.
- **C5 Runtime verifiable** ✅ — memory traces can distinguish zero/one/many, `continue`, `break`, wrap, and effects.

### Future-Proofing

- **F1 Extensible** ✅ — new analysis can recognize more CFG patterns without changing source semantics.
- **F2 Platform-profile ready** ✅ — only cost selection varies by CPU/profile.
- **F3 Optimizer-friendly** ✅ — explicit condition/update blocks expose induction and effects.
- **F4 Stability classification** ✅ — stable.

## Verdict

**✅ ACCEPTED.** The standard form provides modern source behavior with a smaller semantic and
implementation surface than the former range-only design. Generic CFG lowering establishes
correctness; proof-based induction recognition supplies expert 6502 output without a runtime or a
second loop subsystem.
