# Blend65 Language Specification v2 — Expert Compiler Engineering Review

> **Date**: May 24, 2026  
> **Reviewed by**: AI Compiler Engineering Analysis  
> **Scope**: All 11 specification documents in `language-specification-v2/`

---

## 🔴 CRITICAL ISSUES (Specification Is Broken/Contradictory)

### 1. For-Loop Has Two Incompatible Syntaxes

The EBNF grammar in `05-statements.md` defines **only** the BASIC-style `to`/`downto`/`step` form:
```ebnf
for_stmt = "for" , "(" , [ "let" ] , identifier , "=" , expression
         , ( "to" | "downto" ) , expression
         , [ "step" , expression ] , ")" , ...
```

But **every other file** uses the C-style form:
```js
for (let i: byte = 0; i < 10; i += 1) { ... }
```

These are two completely different parsing strategies. The EBNF doesn't describe the C-style form at all — no condition expression, no update expression. **You must pick one or formally define both.** Recommendation: keep the C-style form as primary (it's what you actually use everywhere) and add the `to`/`downto` form as syntactic sugar that desugars to it.

### 2. Switch Statement Fall-Through Semantics Are Undefined

Most examples show cases **without** `break`:
```js
case Direction.UP:
    playerY -= 1;
    checkBounds();
case Direction.DOWN:    // Does this fall through from UP?
    playerY += 1;
```

But one example explicitly uses `break` for "fall-through control." The spec **never states** whether fall-through happens by default (C behavior) or whether each case is implicitly terminated (Rust/Swift behavior). This is a critical code-generation decision. Given the target audience (game developers, beginner-friendly), recommendation is **no fall-through by default** — each case breaks automatically.

### 3. The `@` Symbol Has Three Conflicting Uses

The `@` character is overloaded with three distinct meanings:
- **Storage classes**: `@zp`, `@ram`, `@data` (lexer tokens)
- **Address-of operator**: `@buffer`, `@spriteData` (unary prefix operator)
- **Built-in type alias**: `@address` (type keyword)

The lexer spec in `01-lexical-structure.md` states: *"Invalid storage class — Any `@` sequence not equal to `@zp`, `@ram`, or `@data`"* is a **lexer error**. But then `@buffer` and `@address` are supposed to work. These rules directly contradict each other.

**Recommendation**: Use `&` for address-of (like C/Rust) and drop the `@address` type alias (just use `word`). Reserve `@` exclusively for storage class annotations.

### 4. Scope Rules Are Contradictory

`03-variables.md` explicitly states:
> "Variables are **function-scoped**, not block-scoped" — and shows `x` declared inside an `if` block being accessible outside it.

But for-loop examples declare `let i: byte` in the for-header. Under function-scoping, `i` leaks into the enclosing function. This:
- Makes two for-loops with `let i` in the same function a redeclaration error
- Contradicts developer expectations from C/TypeScript

**Recommendation**: Use **block scoping** like C/Rust/TypeScript. SFA handles this fine — the frame allocator just assigns the same memory for variables with non-overlapping lifetimes.

### 5. Type Inference Is Dangerously Underspecified

The spec says `let x = 10` infers "byte or word (context-dependent)" but never defines the context rules:
- Is `10` a `byte`? Is `256` a `word`? What about `255 + 1`?
- What type is `let x = a + b` when `a: byte` and `b: word`?
- What about `let x = peek($D020) + 1`?

This WILL cause bugs in the compiler. **Recommendation**: For v3, either (a) require explicit type annotations everywhere (simplest, safest), or (b) define precise promotion rules: literal fits in byte → byte; otherwise word; mixed operations promote to word.

---

## 🟠 SIGNIFICANT DESIGN PROBLEMS

### 6. No Signed Types — Fatal for Game Development

The spec has only unsigned `byte` (0-255) and `word` (0-65535). The examples reveal the problem:
```js
let abs: byte = (value >= 0) ? value : 0 - value;  // ALWAYS true for unsigned!
let dx: byte = (direction == LEFT) ? 255 : 0;       // 255 means -1? Confusing!
```

Game programming fundamentally needs signed values for velocities, deltas, scroll offsets, accelerations. Without signed types, every game dev will be manually wrapping/unwrapping unsigned math, which is error-prone and defeats the "developer-friendly" goal.

**Recommendation**: Add `sbyte` (-128 to 127) and `sword` (-32768 to 32767). The 6502 handles signed math fine via the N (negative) flag and V (overflow) flag.

### 7. Multiplication/Division Implementation Not Addressed

The spec lists `*`, `/`, `%` as operators but the **6502 has no multiply or divide instructions**. These require software subroutines that are:
- Expensive: 50-200+ cycles vs 2-4 for add/subtract
- Code-size heavy: each routine takes 30-100 bytes

The spec ignores this entirely. For a "zero overhead" language, this is a major gap.

**Recommendation**: Document the cost explicitly. Consider:
- Compile-time constant folding for `x * 4` → shift operations
- Strength reduction for power-of-2 multiplies/divides
- Warning when runtime multiply/divide is generated
- Platform-provided optimized routines

### 8. String Type Is Severely Underspecified

Strings are described as "null-terminated byte sequences" but:
- How are string variables stored? As a pointer (word) to data? As inline bytes?
- How do you compare strings? There's no `==` for strings defined.
- How do you index into a string? `msg[0]`?
- What character encoding? PETSCII for C64, ATASCII for Atari, ASCII for CX16?
- Can functions accept/return strings? What's the ABI?

**Recommendation**: For v3, strings should be a `const` pointer to data placed in `@data`. Character encoding should be a platform profile setting. Add `strlen()` intrinsic and string indexing.

### 9. Memory Model Is Hardcoded to C64

Throughout the spec, C64 addresses are used as canonical examples and the compiler architecture embeds C64-specific layouts:
- SFA frames at `$0200-$03FF` (C64 BASIC input buffer)
- ZP ranges `$02-$8F` (C64 KERNAL workspace boundaries)
- Screen RAM at `$0400`

For Commander X16 (65C02 with 512KB+ RAM), Atari 2600 (128 bytes RAM!), or Atari 800XL (different memory map), none of this applies.

**Recommendation**: This is the **#1 architectural concern**. The spec needs a **Platform Profile** concept:
```
platform "c64" {
  cpu: 6502
  ram: $0800-$9FFF
  zp_user: $02-$8F
  frame_region: $0200-$03FF
  screen: $0400-$07FF
  io: $D000-$DFFF
  entry_point: $0810
  output_format: "prg"
}
```

### 10. Callback Mechanism Is Incomplete

The `callback` type/keyword is described but crucial questions are unanswered:
- How do you actually **install** a callback as an interrupt handler? `pokew($FFFE, @myIRQ)`?
- Callbacks generate `RTI` (return from interrupt) vs `RTS` (return from subroutine) — the spec doesn't mention this.
- Can you call a callback variable? `handler();`?
- What about saving/restoring registers on interrupt entry?

**Recommendation**: Interrupt handling needs a dedicated spec section. A `callback` function should automatically generate register save/restore + `RTI`. Installation should be via an intrinsic: `set_irq_handler(myIRQ)`.

### 11. No Struct/Record Type

For game entities, you currently need parallel arrays:
```js
let enemyX: byte[10];
let enemyY: byte[10];
let enemyHealth: byte[10];
let enemyType: byte[10];
```

This is what 6502 assembly programmers do, and it IS efficient (cache-friendly structure-of-arrays). But it's error-prone and not "developer-friendly."

**Recommendation**: Add a simple `struct` type that the compiler lowers to parallel arrays or contiguous memory:
```js
struct Enemy {
  x: byte,
  y: byte,
  health: byte,
  kind: byte
}
let enemies: Enemy[10];
```

### 12. No Inline Assembly Blocks

The `asm_*()` functions are one-instruction-at-a-time with **no label support**. This means:
- Branch instructions (`asm_beq_rel(offset)`) require manual offset calculation — practically impossible without knowing the assembled code size
- You can't write meaningful assembly sequences (tight loops, lookup table jumps)
- Compare with cc65's `__asm__` or KickC's inline assembly blocks with labels

**Recommendation**: Add `asm { }` blocks with label support:
```js
asm {
  ldx #$00
loop:
  sta $0400,x
  inx
  bne loop
}
```

---

## 🟡 MODERATE ISSUES (Ambiguities & Missing Pieces)

| # | Issue | Location | Recommendation |
|---|-------|----------|----------------|
| 13 | No explicit cast syntax | 02-types.md | Add `byte(expr)` / `word(expr)` casts from day 1 |
| 14 | Short-circuit `&&`/`||` not specified | 04-expressions.md | Define as short-circuit (standard behavior) |
| 15 | Overflow/wrapping behavior undefined | 02-types.md | Define as wrapping (natural 6502 behavior) |
| 16 | Module-to-file mapping is vague ("typically") | 07-modules.md | Make it mandatory: `module a.b.c` → `a/b/c.blend` |
| 17 | Enum limited to byte | 02-types.md | Allow `enum Foo: word { ... }` |
| 18 | Multi-dimensional arrays are impractical | 02-types.md | Limit to 1D; 2D via helper functions or stride calculation |
| 19 | `to` keyword is inclusive, `<` is exclusive | 05-statements.md | Confusing that `for(i=0 to 10)` and `for(i=0; i<10; i+=1)` differ |
| 20 | No `sizeof()` intrinsic | 08-intrinsics.md | Add `sizeof(type)` returning byte count |
| 21 | Uninitialized variables are "undefined" | 03-variables.md | Zero-initialize by default (safety) or require initializer |
| 22 | No bit-field type | 02-types.md | Consider for hardware register manipulation |

---

## 🟢 WHAT'S GOOD (Keep These)

1. **SFA architecture** — Correct choice for 6502. Well-justified comparison with SSA.
2. **Storage classes** (`@zp`, `@ram`, `@data`) — Excellent 6502-specific feature.
3. **Volatile intrinsics** (`volatile_read`, `volatile_write`, `barrier`) — Shows real hardware awareness.
4. **No recursion constraint** — Correct and well-explained.
5. **Comprehensive ASM function coverage** — All 56 opcodes with all addressing modes.
6. **C/TypeScript style syntax** — Approachable for the target audience.
7. **Module system** — Clean import/export design.
8. **Array size inference** — Nice ergonomic feature.
9. **Compiler pipeline design** — Reasonable and extensible with the two optimizer slots.
10. **The overall vision** — A procedural, game-focused, 6502-native language fills a real niche.

---

## 📋 RECOMMENDED V3 SPECIFICATION STRUCTURE

Based on this analysis, here's how the specification should be restructured for v3:

```
blend65-spec-v3/
├── 00-overview.md              # Vision, goals, philosophy
├── 01-lexical-structure.md     # Tokens, keywords (fix @ ambiguity)
├── 02-types.md                 # byte, sbyte, word, sword, boolean, void, string
├── 03-type-system.md           # NEW: Inference rules, promotion, casts, sizeof
├── 04-variables.md             # Storage classes, mutability, block scoping
├── 05-expressions.md           # Operators, precedence, short-circuit
├── 06-statements.md            # Control flow (fix for-loop, switch semantics)
├── 07-functions.md             # Functions, SFA, no recursion
├── 08-structs.md               # NEW: Struct types, memory layout
├── 09-modules.md               # Import/export (firm file mapping)
├── 10-intrinsics.md            # Built-in functions + sizeof + casts
├── 11-inline-assembly.md       # NEW: asm blocks with labels + asm_* functions
├── 12-platform-profiles.md     # NEW: Platform abstraction layer
├── 13-compiler-architecture.md # Pipeline, SFA, IL, codegen
├── 14-error-catalog.md         # NEW: All error codes with examples
└── appendix/
    ├── A-c64-profile.md        # C64-specific: memory map, PETSCII, SID, VIC-II
    ├── B-cx16-profile.md       # Commander X16 profile (future)
    ├── C-atari-profile.md      # Atari 8-bit profile (future)
    └── D-grammar.md            # NEW: Complete EBNF grammar in one place
```

### Key v3 Design Principles

1. **Core language is platform-agnostic**: Types, syntax, control flow, functions, modules — no C64-specific assumptions in core spec
2. **Platform profiles provide the specifics**: Memory maps, character encoding, startup code, output format, available hardware intrinsics
3. **Explicit over implicit everywhere**: Required type annotations, defined overflow behavior, defined promotion rules
4. **Two for-loop forms, formally specified**: C-style as primary, `to`/`downto` as sugar
5. **Signed types from day 1**: `sbyte`, `sword` alongside `byte`, `word`
6. **Structs for data grouping**: Lower to efficient memory layouts
7. **Inline assembly with labels**: Practical for performance-critical code
8. **Complete EBNF grammar in one document**: Single source of truth for parsing

---

## 🚀 RECOMMENDED NEXT STEPS

1. **Fix the critical contradictions first** (for-loop, switch, @, scope, inference) — these block any implementation
2. **Design the Platform Profile system** — this is the core architectural differentiator
3. **Add signed types and casts** — essential for game development
4. **Write the complete EBNF grammar** as a single document — this becomes the parser's contract
5. **Start implementation with C64 as first platform profile** — but with the platform abstraction in place from day 1
6. **Build incrementally**: Lexer → Parser → Semantic Analysis → Unoptimized Codegen → then add optimizer passes

---

## Possible Follow-Up Work

- Deep-dive into any specific issue from this review
- Draft a v3 specification with fixes applied
- Design the Platform Profile system in detail
- Write the complete EBNF grammar for the corrected language
