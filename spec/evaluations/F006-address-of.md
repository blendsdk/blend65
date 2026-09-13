# F006 — Address-of operator (`&`)

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)  
> **Replaces v2**: `@variable` (address-of operator), `@address` (built-in address type)

## Description

The `&` operator returns the storage address of an addressable place, or the code address of a
function, as a `word` value. A direct object's address is normally fixed at link time; a parameter,
field, or indexed element address may be computed at runtime. This replaces v2's `@variable`
syntax, which conflicted with storage class prefixes (`@zp`) and the type alias (`@address`).

The v2 `@address` built-in type is removed. Addresses are simply `word` values. (Type aliases such as `type Address = word;` were evaluated and **rejected** — see `future-considerations.md` → REJ-001 — so use the `word` type directly and choose a self-documenting variable name.)

## Syntax

```blend65
&expression
```

**EBNF:**
```ebnf
address_of_expr = "&" , unary_expr ;
```

## Rules

| Rule | Decision |
|------|----------|
| Return type | `word` (16-bit unsigned — same as a memory address on 6502) |
| On module-level variables | ✅ Valid — returns RAM address |
| On local variables | ✅ Valid as a non-escaping borrow — SFA gives locals static addresses, but E10260 rejects any possible use beyond the local's dynamic source lifetime |
| On `zeropage` variables | ✅ Valid — returns ZP address (0x00–0xFF, fits in `word`) |
| On functions | ✅ Valid — returns the code address of the function |
| On `interrupt` functions | ✅ Valid — returns the code address (see F007) |
| On array/struct `const` | ✅ Valid — stored in data section, has an address |
| On scalar `const` | ❌ **E10040** — scalar constants are inlined, no address exists |
| On scalar parameters | ✅ Valid — local-origin borrow bounded by the active invocation |
| On aggregate parameters | ✅ Valid — inherits the caller object's lifetime and mutability |
| On struct fields (`&s.x`) | ✅ Valid — includes the field offset |
| On array elements (`&a[i]`) | ✅ Valid — uses ordinary index and bounds semantics |
| On literals (`&42`) | ❌ **E10043** — literals have no address |
| On temporaries/value expressions (`&(x+y)`) | ❌ **E10043** — no storage place exists |

While a function address remains compiler-visible, it retains source function identity and source
handler kind in addition to its `word` representation. A recognized interrupt-handler sink rejects
an ordinary `RTS` function, selects the exact raw or firmware-mediated entry variant, and
contributes that execution root to SFA. The sink may therefore install a specialized address rather
than the raw numeric payload. Opaque integer/address escape erases proof; a visible write to an
exactly known incompatible firmware vector is E10252 rather than an escape hatch.

For any storage place, the base, field path, and index expressions are evaluated exactly once.
The ordinary `word` result retains hidden lifetime and mutable/read-only provenance from its base.
A local variable or scalar parameter is bounded by its dynamic source lifetime, including its
lexical block and one loop iteration. An aggregate parameter inherits the caller object's origin.
Copies, casts, conditionals, `lo`/`hi`, arithmetic, and bitwise derivations keep the dependency so
it cannot be laundered into an escaping integer fragment. A compiler-visible write through a
read-only-derived address is E10123.

Array element address-taking uses the ordinary per-dimension ordinal and bounds rules. It grants no
special one-past element: a known `&items[length(items)]` is E10240. Code that needs an end address
forms it explicitly with `word` arithmetic from a valid place address. The numeric result may wrap
modulo 65536 under the normal `word` rules; it is not a pointer and cannot be dereferenced by `&`.

A parameter position is non-retaining only when every reachable path may use or mutate through the
address and forward it solely to other proven non-retaining positions, without returning,
persisting, publishing to an interrupt/hardware consumer, or passing it to unknown code. The
compiler infers this transitively for user functions; platform/library contracts declare it.
Legal borrow use extends the local's SFA liveness but adds no runtime mechanism. After the lifetime
ends, the same physical home may be reused by a sequential call or loop iteration; no earlier
address remains observable and no cross-invocation address identity is promised.

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

**Parameters, fields, elements, and single evaluation:**

```blend65
function inspect(entity: const Enemy, items: byte[16], index: byte): void {
    let entityAddr: word = &entity;             // caller-owned base
    let hpAddr: word = &entity.stats.hp;         // nested read-only field
    let itemAddr: word = &items[index];          // index evaluated once
    let endAddr: word = &items[0] + length(items); // explicit one-past numeric address

    // poke(hpAddr, 0);                          // ❌ E10123: read-only provenance
    // let invalid: word = &items[length(items)]; // ❌ E10240: no implicit one-past element
}
```

**Functions (for interrupt installation and jump tables):**
```blend65
module Game;

import { setIRQ } from c64.system;

interrupt function onRasterIRQ(): void {
    // ... interrupt handler code ...
}

function gameLoop(): void {
    // ... game logic ...
}

function main(): void {
    let irqAddr: word = &onRasterIRQ;    // Code address of interrupt handler
    let loopAddr: word = &gameLoop;       // Code address of regular function
    
    // Install through the platform-specific, compiler-recognized sink.
    setIRQ(&onRasterIRQ);
}
```

**Local lifetime and prohibited escapes:**

```blend65
function invalidReturn(): word {
    let value: byte = 1;
    return &value;                // ❌ E10260
}

function invalidUses(): void {
    let value: byte = 1;
    persistentAddress = &value;   // ❌ E10260: persistent storage
    poke($d020, lo(&value));       // ❌ E10260: MMIO/raw publication
    retainForLater(&value);       // ❌ E10260: retaining or unknown call
    installAsync(&value);         // ❌ E10260: asynchronous consumer
}
```

The same error covers opaque transformations or stores for which lifetime containment cannot be
proved. Contained local storage and transitively proven non-retaining calls remain valid.

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
| 3 | AO-3 | `&` on function parameters | Valid, with the parameter origin's lifetime and mutability |
| 4 | AO-4 | `&` on struct fields / array elements | Valid for every real nested storage place; components evaluate once |
| 5 | AO-5 | May `&local` outlive the local? | **No** — it is a compiler-tracked non-escaping borrow; E10260 rejects the first use that may cross its dynamic source lifetime |

## Errors

| Code | Rationale condition | Public presentation |
|------|-----------|---------|
| E10040 | `&` on inlined scalar constant | [Chapter 14](../14-diagnostics.md) |
| E10043 | `&` on a literal, temporary, or other non-place expression | [Chapter 14](../14-diagnostics.md) |
| E10123 | Known write through an address derived from read-only storage | [Chapter 14](../14-diagnostics.md) |
| E10240 | Known out-of-bounds element address, including implicit one-past | [Chapter 14](../14-diagnostics.md) |
| E10252 | Raw interrupt entry written to an incompatible recognized firmware vector | [Chapter 14](../14-diagnostics.md) |
| E10260 | Local-origin address or derived fragment may escape its dynamic source lifetime | [Chapter 14](../14-diagnostics.md) |

## Language Guard Verdict

- **P1 Cross-platform** ✅ — Memory addresses are universal on 6502. All platforms use 16-bit addresses.
- **P3 No platform assumptions** ✅ — `&` returns a `word` with no platform-specific semantics.
- **H1 6502 implementable** ✅ — Fixed addresses load as constants; parameter/field/element places
  use the same 16-bit address calculation already needed for access.
- **H2 Cost transparency** ✅ — `&x` itself costs no memory access; any dynamic base, field, or index
  calculation and result materialization are reported from the selected instructions.
  Materializing both bytes into absolute storage costs 10 bytes/12 cycles (two immediate loads and
  two absolute stores); a zero-page destination costs 8 bytes/10 cycles.
- **H3 SFA compatible** ✅ — Storage homes and address formulas are closed before emission. Local
  borrows extend liveness only to their last legal use; unsafe persistence is rejected rather than
  silently pinning an automatic local.
- **H5 Deterministic** ✅ — Every valid use produces a well-defined address. Every invalid use produces a compile error.
- **L1 Unambiguous** ✅ — `&` has exactly one meaning. No overloading with other uses.
- **L2 Consistent** ✅ — `&` for address-of is the same convention as C and Rust.
- **L3 Beginner-friendly** ✅ — Any C developer recognizes `&variable`.
- **L6 Errors actionable** ✅ — E10260 identifies the escape path and recommends module-level or
  caller-owned storage. This avoids C-style dangling-address undefined behavior without a heap.
- **L4 Minimal** ✅ — One operator and one result type, accepted exactly on real storage places and
  functions; no pointer/reference/view type is added.
- **L5 No redundancy** ✅ — Replaces both `@variable` and `@address` type from v2.
- **C1 Lexer/parser** ✅ — `AMPERSAND`, `IDENTIFIER`. Standard unary prefix operator.
