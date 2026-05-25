# F005 — Memory placement

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)  
> **Replaces v2**: `@zp`, `@ram`, `@data` storage class prefixes

## Description

Blend65 v3 provides three memory placement strategies for variables and constants. The `@` symbol from v2 is **completely removed** from the language, resolving the critical v2 ambiguity where `@` was overloaded with three conflicting meanings (storage class, address-of, type alias).

## Placement Model

| Declaration Style | Placement | Mutability | Compiler Behavior |
|-------------------|-----------|------------|-------------------|
| `zeropage { x: byte; }` | Zero page ($00–$FF) | Always mutable | Compiler allocates from platform profile's ZP range |
| `let x: byte = 0;` | General RAM | Mutable | Default placement — compiler allocates in RAM |
| `const TABLE: byte[] = [1,2,3];` | Data/ROM section | Immutable | Compiler places in data section; platform profile maps to ROM or RAM |

There is no `@ram` or `@data` keyword. RAM is the default for `let`. The compiler automatically places `const` data in the data/ROM section.

## `zeropage` Block Syntax

```blend65
module Game.Main;

zeropage {
    playerX: byte = 10;
    playerY: byte = 10;
    frameCount: byte = 0;
    tempPtr: word;
}
```

**EBNF:**
```ebnf
zeropage_block = "zeropage" , "{" , zeropage_decl_list , "}" ;
zeropage_decl_list = { zeropage_decl } ;
zeropage_decl = [ "export" ] , identifier , ":" , type , [ "=" , const_expr ] , ";" ;
```

## `zeropage` Block Rules

| Rule | Decision |
|------|----------|
| Where is it allowed? | Module level only |
| How many per module? | **At most one** — duplicates produce E10030 |
| Can multiple modules have `zeropage` blocks? | **Yes** — compiler merges all ZP allocations across modules |
| Are variables inside always mutable? | **Yes** — ZP is for performance-critical runtime data, not constants |
| What's the default initial value? | **Indeterminate** if no explicit initializer — no startup code generated. Only variables with explicit initializers produce init code. |
| Can arrays/structs be in ZP? | **Yes** — but compiler warns when ZP usage exceeds platform threshold |
| Does declaration order guarantee memory order? | **No** — compiler is free to reorder for optimal packing |
| How to export ZP variables? | Per-variable `export` keyword inside the block |
| What if total ZP exceeds platform budget? | **E10032**: compile error with usage summary |

## `zeropage` Block Examples

**Basic zero-page usage:**
```blend65
module Game.Main;

zeropage {
    export playerX: byte = 10;     // Accessible from other modules
    export playerY: byte = 10;     // Accessible from other modules
    tempCalc: word;                 // Private, no init — indeterminate value until written
    frameCount: byte = 0;          // Private, explicit init
}
```

**Exporting and importing ZP variables:**
```blend65
// file: game.blend
module Game;

zeropage {
    export score: word = 0;
    export lives: byte = 3;
}
```

```blend65
// file: hud.blend
module HUD;

import { score, lives } from Game;

function drawHUD(): void {
    // score and lives are in zero page — fast access
}
```

**Array in zero page (with compiler awareness):**
```blend65
module Sprites;

zeropage {
    spriteX: byte[8];     // 8 bytes in ZP — fast sprite position updates
    spriteY: byte[8];     // 8 more bytes
    // Compiler reports: "zeropage block uses 16/142 available bytes (platform: c64)"
}
```

## `const` Placement

Constants are automatically placed in the data/ROM section by the compiler:

```blend65
module Data;

// Compiler places these in the data section
// On cartridge platforms (7800), this is ROM
// On disk platforms (C64), this is a data segment loaded into RAM
const SINE_TABLE: byte[256] = [/* precomputed values */];
const SPRITE_DATA: byte[63] = [0xFF, 0x3C, /* ... */];
const GREETING: byte[14] = [/* "HELLO, WORLD!" */];
```

The platform profile defines where the "data section" physically maps:

| Platform | `const` data goes to | Notes |
|----------|---------------------|-------|
| C64 | RAM (data segment) | Loaded from disk into RAM |
| CX16 | Banked RAM or ROM | Depends on build config |
| Atari 800XL | RAM (data segment) | Loaded from disk/cartridge |
| Atari 7800 | Cartridge ROM | Physical read-only |

## v2 Migration Guide

| v2 Syntax | v3 Syntax |
|-----------|-----------|
| `@zp let playerX: byte = 10;` | `zeropage { playerX: byte = 10; }` |
| `@ram let buffer: byte[256];` | `let buffer: byte[256];` |
| `@data const table: byte[256] = [...];` | `const table: byte[256] = [...];` |
| `@address` (type) | `word` |
| `@variable` (address-of) | `&variable` (see F006) |

## Ambiguities Resolved

| # | ID | Ambiguity | Resolution |
|---|-----|-----------|------------|
| 1 | ZP-1 | Multiple `zeropage` blocks in one module | **E10030**: compile error — one per module |
| 2 | ZP-2 | Does declaration order guarantee memory order? | No — compiler decides allocation order |
| 3 | ZP-3 | Arrays/structs in zeropage? | Allowed; compiler warns at high usage (W10030) |
| 4 | ZP-4 | Uninitialized ZP variable default value | **Indeterminate** — no init code generated. Only explicit initializers produce startup code. Developer must write before read. (Saves ROM, aligns with A4: explicit over implicit.) |
| 5 | ZP-5 | How to export from zeropage block? | Per-variable `export` inside the block |
| 6 | CONST-1 | Where does `const` data physically go? | Platform profile defines data section mapping |

## Errors

| Code | Condition | Message |
|------|-----------|---------|
| E10030 | Duplicate `zeropage` block in module | `Only one 'zeropage' block is allowed per module — combine all zero-page declarations into a single block` |
| E10031 | `const` inside `zeropage` block | `Constants are not allowed in 'zeropage' — zero page is for mutable runtime data. Use module-level 'const' instead` |
| E10032 | ZP budget exceeded | `Zero-page budget exceeded — used <N> bytes, platform '<platform>' allows <M> bytes (range <start>–<end>)` |
| E10033 | `let`/`const` keyword inside `zeropage` block | `Unexpected '<keyword>' in zeropage block — declarations use 'name: type' syntax without let/const` |

## Warnings

| Code | Condition | Message |
|------|-----------|---------|
| W10030 | ZP usage above 75% of platform budget | `Zero-page usage is <N>/<M> bytes (<percent>%) for platform '<platform>' — consider moving less critical variables to RAM` |

## Language Guard Verdict

- **P1 Cross-platform** ✅ — Zero page exists on all 6502 variants. Available range defined by platform profile.
- **P2 Platform-meaningful** ✅ — ZP is the primary optimization tool on 6502 — every platform benefits.
- **P3 No platform assumptions** ✅ — No hex addresses in core syntax. Platform profile defines ZP range.
- **P4 Resource-scalable** ✅ — Compiler warns (W10030) and errors (E10032) based on platform limits.
- **H1 6502 implementable** ✅ — ZP variables compile to zero-page addressing modes (2-byte instructions instead of 3-byte).
- **H2 Cost transparency** ✅ — ZP access saves 1 byte and 1 cycle per access vs. absolute addressing. Compiler reports ZP budget usage.
- **H3 SFA compatible** ✅ — ZP variables are statically allocated, just in a specific memory region.
- **H4 Memory footprint** ✅ — ZP bytes consumed reported in build summary. `const` size reported in data section summary.
- **H5 Deterministic** ✅ — Variables with initializers are set by startup code (defined). Variables without initializers have indeterminate but valid values (not undefined behavior — reading any ZP byte is safe on 6502, just returns some byte 0-255). No hidden init code (A4: explicit over implicit).
- **L1 Unambiguous** ✅ — `zeropage` is a keyword, not an operator. No `@` overloading.
- **L2 Consistent** ✅ — Block syntax (`{ ... }`) is consistent with function bodies. Declaration syntax matches module-level declarations.
- **L3 Beginner-friendly** ✅ — `zeropage { ... }` is self-explanatory. A C/TS developer can guess its purpose.
- **L4 Minimal** ✅ — One keyword, one block, simple declarations. No `@ram`/`@data` needed.
- **L5 No redundancy** ✅ — Replaces three v2 keywords (`@zp`, `@ram`, `@data`) with one keyword + defaults.
- **C1 Lexer/parser** ✅ — `KW_ZEROPAGE`, `LBRACE`, declarations, `RBRACE`. Standard block parsing.
- **F2 Platform-profile ready** ✅ — ZP range and data section mapping come from platform profile.

