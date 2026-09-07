# F003 — Module contents & visibility

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)

## Description

A module can contain **declarations only** — no loose runnable code. All executable code must live inside functions. Declarations marked with `export` are visible to other modules; everything else is private.

## What a module can contain

| Declaration | Example | Exportable |
|-------------|---------|------------|
| Functions | `function update(): void { ... }` | ✅ Yes |
| Constants | `const MAX_SPEED: byte = 5;` | ✅ Yes |
| Variables | `let score: word = 0;` | ✅ Yes |
| Enums | `enum GameState { MENU, PLAYING }` | ✅ Yes |
| Structs | `struct Player { x: byte; y: byte; }` | ✅ Yes |
| Zeropage block | `zeropage { x: byte; }` | ✅ Yes (per-variable) |
| Import statements | `import { foo } from Bar;` | N/A |

## What a module CANNOT contain

| Prohibited | Example | Error |
|------------|---------|-------|
| Loose statements | `clearScreen();` at module level | **E10010**: `Executable statements are not allowed at module level — place code inside a function` |
| Loose expressions | `1 + 2;` at module level | **E10010** (same) |
| Init blocks | `init { ... }` | **E10010** (same — unrecognized at module level) |

## Visibility model

**Two visibility levels — no more:**

| Modifier | Visibility | Access |
|----------|-----------|--------|
| `export` | **Public** | Accessible from other modules via `import` |
| *(none)* | **Private** | Only accessible within the declaring module |

There are **no** `public`, `private`, or `protected` keywords. The `export` keyword is the only visibility modifier.

## Initialization rules (universal — applies to ALL variables)

**The universal rule**: The compiler generates initialization code **only** for variables with explicit initializers. Variables without initializers have **indeterminate values** — the developer must write before read. This applies equally to module-level variables, `zeropage` variables, and local variables.

| Declaration | Init code generated? | Initial value |
|-------------|---------------------|---------------|
| `let x: byte = 10;` | ✅ Yes | 10 |
| `let x: byte = 0;` | ✅ Yes | 0 |
| `let x: byte;` | ❌ No | Indeterminate (whatever is at that memory address) |
| `const X: byte = 5;` | N/A (inlined) | 5 (compile-time constant) |
| `zeropage { x: byte = 10; }` | ✅ Yes | 10 |
| `zeropage { x: byte; }` | ❌ No | Indeterminate |

**Rationale**: Initialization is explicit in the declaration. The compiler emits no code for an
omitted initializer and reports the complete startup cost. Module-level `let` accepts the same
otherwise legal non-`void` expressions as local `let`, including ordinary calls and assignments.
Each initializer runs once before `main`; Chapter 10 owns dependency and observable-effect order.
`const` remains compile-time-only.

```blend65
module Game.Main;

// ✅ Valid — constants and runtime expressions
const MAX_ENEMIES: byte = 8;
let score: word = 0;
let highScore: word = 1000;
let offset: byte = 10 + 5;          // constant expression → 15

// ✅ Valid — no initializer (indeterminate value, developer writes before reading)
let tempBuffer: byte[64];
let scratch: word;

let computed: byte = add(1, 2);      // evaluated once during startup
let dynamic: byte = MAX_ENEMIES * 2; // ✅ if MAX_ENEMIES is const → constant folding OK
```

## Examples

**Exported and private declarations:**
```blend65
module Utils.Math;

// Private — only accessible within Utils.Math
function square(x: byte): word {
    return word(x) * word(x);
}

// Public — accessible via import
export function distance(x1: byte, y1: byte, x2: byte, y2: byte): byte {
  // uses private square() internally
  return 0; // simplified
}

export const PI_APPROX: byte = 3;
```

**Importing from another module:**
```blend65
module Game.Main;

import { distance, PI_APPROX } from Utils.Math;

export function main(): void {
  let d: byte = distance(0, 0, 10, 10);
}
```

## Language Guard Verdict

- **L1 Unambiguous** ✅ — Clear distinction: `export` = public, no `export` = private
- **L3 Beginner-friendly** ✅ — Same model as TypeScript/ES modules
- **L4 Minimal** ✅ — Only two visibility levels, one keyword
- **L5 No redundancy** ✅ — No overlapping visibility mechanisms
- **H2 Cost transparency** ✅ — Every explicit runtime initializer and its transitive calls are
  listed with startup ROM/storage/cycle cost; an omitted initializer emits no code.
- **H5 Deterministic** ✅ — Initializer reads, calls, and effects participate in the Chapter 10
  dependency/effect schedule, with a stable fully qualified-name tie-break.
