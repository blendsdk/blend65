# F006 — Address-of operator (`&`)

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)  
> **Replaces v2**: `@variable` (address-of operator), `@address` (built-in address type)

## Description

The `&` operator returns the compile-time memory address of a variable or function as a `word` value. This replaces v2's `@variable` syntax, which conflicted with storage class prefixes (`@zp`) and the type alias (`@address`).

The v2 `@address` built-in type is removed. Addresses are simply `word` values. (Type aliases such as `type Address = word;` were evaluated and **rejected** — see `future-considerations.md` → REJ-001 — so use the `word` type directly and choose a self-documenting variable name.)

## Syntax

```blend65
&identifier
```

**EBNF:**
```ebnf
address_of_expr = "&" , identifier ;
```

## Rules

| Rule | Decision |
|------|----------|
| Return type | `word` (16-bit unsigned — same as a memory address on 6502) |
| On module-level variables | ✅ Valid — returns RAM address |
| On local variables | ✅ Valid — SFA gives locals static addresses |
| On `zeropage` variables | ✅ Valid — returns ZP address (0x00–0xFF, fits in `word`) |
| On functions | ✅ Valid — returns the code address of the function |
| On `interrupt` functions | ✅ Valid — returns the code address (see F007) |
| On array/struct `const` | ✅ Valid — stored in data section, has an address |
| On scalar `const` | ❌ **E10040** — scalar constants are inlined, no address exists |
| On function parameters | ❌ **E10041** — deferred to future version (see FUT-002) |
| On struct fields (`&s.x`) | ❌ **E10042** — deferred to future version (see FUT-001) |
| On array elements (`&a[i]`) | ❌ **E10042** — deferred to future version (see FUT-001) |
| On literals (`&42`) | ❌ **E10043** — literals have no address |
| On expressions (`&(x+y)`) | ❌ **E10043** — expressions have no address |

## Examples

**Variables and arrays:**
```blend65
module Game;

let buffer: byte[256];
let score: word = 0;

zeropage {
    playerX: byte = 10;
}

function main(): void {
    let bufferAddr: word = &buffer;       // Address of array in RAM
    let scoreAddr: word = &score;         // Address of word variable
    let zpAddr: word = &playerX;          // Address in zero page
}
```

**Functions (for interrupt installation and jump tables):**
```blend65
module Game;

interrupt function onRasterIRQ(): void {
    // ... interrupt handler code ...
}

function gameLoop(): void {
    // ... game logic ...
}

function main(): void {
    let irqAddr: word = &onRasterIRQ;    // Code address of interrupt handler
    let loopAddr: word = &gameLoop;       // Code address of regular function
    
    // Install interrupt handler (platform-specific)
    pokew(0x0314, &onRasterIRQ);
}
```

**Constants — scalar vs. stored:**
```blend65
module Data;

const MAX_SPEED: byte = 5;                     // Scalar → inlined
const SINE_TABLE: byte[256] = [/* ... */];      // Array → stored in data section

function main(): void {
    // let a: word = &MAX_SPEED;               // ❌ E10040: inlined constant has no address
    let b: word = &SINE_TABLE;                  // ✅ Valid: array constant has an address
}
```

## Ambiguities Resolved

| # | ID | Ambiguity | Resolution |
|---|-----|-----------|------------|
| 1 | AO-1 | `&` on scalar constants | **E10040** — inlined, no address |
| 2 | AO-2 | `&` on array/struct constants | Valid — stored in data section |
| 3 | AO-3 | `&` on function parameters | **E10041** — deferred (FUT-002) |
| 4 | AO-4 | `&` on struct fields / array elements | **E10042** — deferred (FUT-001) |

## Errors

| Code | Condition | Message |
|------|-----------|---------|
| E10040 | `&` on inlined scalar constant | `Cannot take address of constant '<name>' — scalar constants are inlined and have no memory address. Use an array or variable instead` |
| E10041 | `&` on function parameter | `Cannot take address of parameter '<name>' — copy it to a local variable first` |
| E10042 | `&` on struct field or array element | `Cannot take address of '<expr>' — address-of is only supported on named variables and functions. Compute the address manually: '&<base> + <offset>'` |
| E10043 | `&` on literal or expression | `Cannot take address of '<expr>' — address-of requires a named variable or function` |

## Language Guard Verdict

- **P1 Cross-platform** ✅ — Memory addresses are universal on 6502. All platforms use 16-bit addresses.
- **P3 No platform assumptions** ✅ — `&` returns a `word` with no platform-specific semantics.
- **H1 6502 implementable** ✅ — Address is a compile-time constant. `&x` compiles to loading the low/high bytes of x's address.
- **H2 Cost transparency** ✅ — `&x` costs 0 runtime cycles (address is immediate data). Loading it into a variable costs 4 cycles (2× LDA #imm + STA).
- **H3 SFA compatible** ✅ — All addresses are compile-time known in SFA.
- **H5 Deterministic** ✅ — Every valid use produces a well-defined address. Every invalid use produces a compile error.
- **L1 Unambiguous** ✅ — `&` has exactly one meaning. No overloading with other uses.
- **L2 Consistent** ✅ — `&` for address-of is the same convention as C and Rust.
- **L3 Beginner-friendly** ✅ — Any C developer recognizes `&variable`.
- **L4 Minimal** ✅ — One operator, one meaning, restricted to names only (no complex expressions).
- **L5 No redundancy** ✅ — Replaces both `@variable` and `@address` type from v2.
- **C1 Lexer/parser** ✅ — `AMPERSAND`, `IDENTIFIER`. Standard unary prefix operator.

