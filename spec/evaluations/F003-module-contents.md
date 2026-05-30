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
| Runtime initializers | `let x: byte = add(1, 2);` | **E10011**: `Module-level initializer must be a compile-time constant expression` |
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

**Rationale**: No hidden startup code. Saves ROM space (critical on constrained platforms). Aligns with A4 (explicit over implicit). Matches how C and assembly work.

**Module-level initializer constraints**:
- When an initializer IS provided, it must be a **compile-time constant expression**
- Compile-time constants include: literals (`42`, `true`, `$FF`), constant expressions (`10 + 5`), `const` references
- Function calls, variable references, and any runtime computation are **not allowed** as initializers
- Complex initialization must be done explicitly inside `main()` or a function called from `main()`

```blend65
module Game.Main;

// ✅ Valid — compile-time constants
const MAX_ENEMIES: byte = 8;
let score: word = 0;
let highScore: word = 1000;
let offset: byte = 10 + 5;          // constant expression → 15

// ✅ Valid — no initializer (indeterminate value, developer writes before reading)
let tempBuffer: byte[64];
let scratch: word;

// ❌ Invalid — runtime expressions
let computed: byte = add(1, 2);      // E10011
let dynamic: byte = MAX_ENEMIES * 2; // ✅ if MAX_ENEMIES is const → constant folding OK
```

## Examples

**Exported and private declarations:**
```blend65
module Utils.Math;

// Private — only accessible within Utils.Math
function square(x: byte): word {
  return x * x;
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
- **H2 Cost transparency** ✅ — No hidden init code, no implicit execution
- **H5 Deterministic** ✅ — No init ordering issues, no hidden side effects

