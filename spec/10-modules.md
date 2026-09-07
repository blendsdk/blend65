# Chapter 10 — Modules & Program Structure

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F001, F002, F003, F004

---

## 1. Overview

Blend65 programs are organized into **modules**. A module is a named container for declarations — functions, variables, constants, structs, and enums. The module system provides namespacing, visibility control via `export`/`import`, and multi-file compilation.

Key design principles:
- **One module declaration per file** — the first statement in every source file
- **Declarations only** — no loose executable statements at module level
- **Explicit visibility** — only `export`-marked declarations are visible to other modules
- **Single entry point** — exactly one `main()` function across the entire program

---

## 2. Module Declaration

### 2.1 Syntax

```ebnf
module_decl    = "module" , qualified_name , ";" ;
qualified_name = identifier , { "." , identifier } ;
```

Every source file must begin with a `module` declaration (after any leading comments):

```blend65
module Game;
```

A module name may contain any number of dot-separated identifiers, for example `Game.Main` or
`Utils.Math.Fixed`. The complete spelling is the module's case-sensitive identity; dots create a
namespace path, not a filesystem relationship.

### 2.2 Rules

| Rule | Decision |
|------|----------|
| Must every file have a module declaration? | **Yes** — E10001 if missing |
| Must it be the first statement? | **Yes** — E10237 if preceded by anything other than comments |
| Can two files share the same module name? | **Yes** — they contribute to the same module. All declarations merge. |
| Is the module name tied to the filename? | **No** — filenames have no semantic meaning |
| Are module names case-sensitive? | **Yes** — `Game` and `game` are different modules |

---

## 3. Module Contents

A module can contain **declarations only**. All executable code must live inside functions.

### 3.1 Allowed Declarations

| Declaration | Example | Exportable |
|------------|---------|------------|
| Functions | `function update(): void { }` | ✅ |
| Constants | `const MAX: byte = 8;` | ✅ |
| Variables | `let score: word = 0;` | ✅ |
| Enums | `enum GameState { MENU, PLAYING }` | ✅ |
| Structs | `struct Player { x: byte; }` | ✅ |
| Zeropage block | `zeropage { x: byte; }` | ✅ (per variable) |
| Import statements | `import { foo } from Bar;` | N/A |

### 3.2 Prohibited at Module Level

| Prohibited | Example | Error |
|-----------|---------|-------|
| Loose statements | `clearScreen();` at module level | E10010 |
| Bare expressions | `score + 1;` at module level | E10010 |
| Control flow | `if (x) { }` at module level | E10010 |
| Assignments | `score = 0;` at module level | E10010 |

```blend65
module Game;
let score: word = 0;     // ✅ declaration with initializer
score = 100;             // ❌ E10010: executable statement at module level
clearScreen();           // ❌ E10010: must be inside a function
```

**Rationale**: Under SFA, the startup sequence is compiler-generated (→ Ch 03, §5). Loose statements would create an implicit "module body" with unclear execution order across modules.

---

## 4. Export & Import

### 4.1 Export

The `export` keyword makes a declaration visible to other modules:

```blend65
module Math;
export const PI_APPROX: byte = 3;
export function clamp(v: byte, lowBound: byte, highBound: byte): byte { }
export struct Vector2 { x: word; y: word; }
export enum Direction { UP, DOWN, LEFT, RIGHT }

// Not exported — module-private
let tempResult: word;
function helperCalc(): byte { }
```

### 4.2 Import

The `import` statement brings exported declarations into scope:

```ebnf
import_stmt = "import" , "{" , import_list , "}" , "from" , qualified_name , ";" ;
import_list = import_item , { "," , import_item } ;
import_item = identifier , [ "as" , identifier ] ;
qualified_name = identifier , { "." , identifier } ;
```

```blend65
module Game;
import { clamp, Vector2 } from Math;
import { clearScreen as cls } from Graphics;
import { Direction } from Math;

function update(): void {
    let speed: byte = clamp(rawSpeed, 0, MAX_SPEED);
    cls();
    let dir: Direction = Direction.UP;
}
```

### 4.3 Import Rules

| Rule | Decision |
|------|----------|
| Can you import non-exported items? | **No** — E10012 |
| Can you import the same name twice? | **No** — E10003 (duplicate declaration) |
| Can you rename on import? | **Yes** — `import { X as Y }` |
| Circular imports (A imports from B, B from A)? | **Allowed** — the compiler resolves declarations in a first pass |
| Can you `import *`? | **No** — all imports must be named (Axiom A4: explicit) |

### 4.4 Module-Qualified Access

Exported declarations can also be accessed with full qualification without import:

```blend65
let v: Math.Vector2;              // ✅ qualified access
let d: Math.Direction = Math.Direction.UP;
```

This is always available — no import statement needed. Import just creates a local alias.

---

## 5. Entry Point

### 5.1 The `main()` Function

Every Blend65 program has exactly one entry point: a function named `main`. The compiler searches all modules to find it.

```blend65
module Game;

function main(): void {
    init();
    while (gameRunning) {
        update();
        render();
    }
}
```

### 5.2 Entry Point Rules

| Rule | Decision |
|------|----------|
| Function name | `main` — always |
| Signature | `function main(): void` — no parameters, void return |
| Can `main` be in any module? | **Yes** |
| Must `main` be exported? | **No** — implicitly the entry point regardless of `export` |
| How many `main` functions? | **Exactly one** across all modules (E10020 if zero, E10021 if multiple) |
| Can other functions call `main()`? | **No** — E10023 |
| Library builds | `--library` flag: no `main` required |

### 5.3 Startup Flow

```
1. Hardware reset → CPU starts at reset vector
2. Platform bootstrap (KERNAL, etc.) → jumps to program start
3. Compiler-generated startup routine:
   a. Execute the unified dependency/effect schedule for every explicit module-level and
      `zeropage` `let` initializer (→ Ch 03, §5; §5.4 below)
   b. Fall through to main() body (no JSR — saves 2 stack bytes)
4. main() executes
5. main() returns → platform-defined behavior (typically returns to OS/monitor)
```

Note: The startup routine falls through directly into `main()`'s body — there is no `JSR main` / `RTS`. This saves 2 bytes of stack and avoids the 12-cycle JSR/RTS overhead.

### 5.4 Module Initialization Order

Module-level and `zeropage` variables with initializers are initialized by the compiler-generated
startup routine (§5.3, step 3) **before** `main()` runs. They participate in one schedule regardless
of storage class. Because Blend65 has no module body and initializers are evaluated at startup, the
order is defined deterministically:

| Rule | Decision |
|------|----------|
| Are initializers run before `main()`? | **Yes** — every explicit module-level `let` initializer runs once during startup before `main()`; `const` is evaluated at compile time. |
| What expressions are allowed? | Any otherwise legal non-`void` expression, including assignment expressions and statically resolved ordinary calls. Existing rules still reject recursion, direct interrupt calls, calls to `main`, and independently invalid operations. |
| What determines initialization order? | **Dependency and effect order.** Every direct or transitive may-read of another initialized module variable creates a predecessor edge. Compound assignment contributes both a read and a write. Call effects are summarized over the recursion-free call graph. An import alone creates no runtime edge; circular declaration imports therefore remain legal. |
| What about independent variables? | Among ready nodes, order by the initialized variable's fully qualified name (`Module.Path.variable`) using case-sensitive ASCII byte order. Names are unique after merged-module duplicate checks, so this is a total order independent of file paths and command-line input order. Observable side-effecting initializers receive ordering edges that preserve it. |
| Constant initializers (`const`) | Fully compile-time evaluated — they never participate in runtime ordering. |
| Circular initializer dependency | **Compile-time error E10194.** If the read/call/effect graph cannot be scheduled, the diagnostic shows the initializer, call, and read path that closes the cycle. |
| Opaque hardware effects | Raw memory/MMIO and other opaque effects are conservative ordering barriers. They do not acquire fabricated precise alias information. |
| SFA and cost | Startup and its callees are execution roots. Their parameters, locals, temporaries, spills, and helper scratch participate in final SFA closure. The build report exposes their ROM/storage cost and exact, bounded, or runtime-dependent cycles. |

```blend65
module Game;
let base: word = 100;
let derived: word = base + 50;   // ✅ 'base' initialized first (dependency order)
```

```blend65
module Bad;
let a: word = b + 1;             // ❌ E10194: circular initializer
let b: word = a + 1;             //    'a' depends on 'b' and 'b' depends on 'a'
```

**Rationale**: Dependency-ordered initialization makes startup deterministic (Axiom A3) without requiring the developer to manually order declarations. The fully qualified declaration name is the stable tie-break because filenames and input order have no language meaning. Circular imports remain legal; only an actual initializer dependency cycle has no valid evaluation order and is rejected at compile time rather than producing an unspecified value.

Writes alone do not mean that the written variable's own initializer must run first. Their observable
result follows the total schedule. A read of a `let` with no initializer has no predecessor node and
uses the ordinary indeterminate-value warning. Optimizers preserve the scheduled order of all
observable effects.

---

## 6. Multi-File Compilation

### 6.1 Rules

- The compiler accepts one or more `.blend` source files
- All files are compiled together into a single output binary
- File names and directory structure have **no semantic meaning**
- Cross-file references are resolved via the module/import system
- Two files with the same module name contribute to the same module

### 6.2 Compilation Model

```
game.blend ──┐
math.blend ──┤──→ Compiler ──→ Single binary (e.g., game.prg)
gfx.blend  ──┘
```

The compiler processes all files in a multi-pass model:
1. **Pass 1**: Parse all files; collect module-level declarations (types, function signatures, variable types)
2. **Pass 2**: Resolve imports; type-check all function bodies
3. **Pass 3**: Build call graph; detect recursion; allocate SFA frames
4. **Pass 4**: Generate code; emit binary

---

## 7. Diagnostic Conditions

This chapter owns these predicates; Chapter 14 owns the canonical presentation.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10001 | A source file has no module declaration. | The file is rejected. |
| E10002 | A source file contains more than one module declaration. | Every declaration after the first is rejected. |
| E10003 | Merged module scope contains duplicate declaration names. | The duplicate declaration is rejected. |
| E10010 | An executable statement occurs at module level. | It must move into a function. |
| E10012 | An import names a declaration that its module does not export. | The import is rejected. |
| E10020 | The linked program has no `main`. | No entry point can be emitted. |
| E10021 | The linked program has multiple `main` declarations. | Entry-point selection fails. |
| E10022 | `main` does not have the exact `function main(): void` signature. | The declaration cannot be the entry point. |
| E10023 | Source code calls `main` directly. | The call is rejected. |
| E10194 | Module initializer dependencies contain a direct or transitive cycle. | Startup ordering fails and the ordered cycle is reported. |
| E10237 | A module declaration is preceded by a non-comment source item. | The file is rejected even if no second module declaration exists. |

---

## 8. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Variables** (→ Ch 03) | Module-level `let`/`const`/`zeropage` — visible throughout module. `export` makes them importable. |
| **Functions** (→ Ch 06) | Functions are module-level declarations. `export function` makes them callable from other modules. Declaration order independent within a module. |
| **Structs** (→ Ch 07) | `export struct` makes the type importable. Non-exported structs are module-private. |
| **Enums** (→ Ch 09) | `export enum` exports type + all members together. |
| **Memory model** (→ Ch 11) | Startup sequence initializes all modules' variables before `main()`. SFA frames are allocated globally across all modules. |
| **Platform profile** (→ Ch 15) | The target platform is a compiler flag, not a module-level declaration. |

---

## 9. Examples

### 9.1 Multi-Module Game

```blend65
// file: main.blend
module Game;
import { init, update, render } from Engine;

let gameRunning: boolean = true;

function main(): void {
    init();
    while (gameRunning) {
        update();
        render();
    }
}
```

```blend65
// file: engine.blend
module Engine;
import { clearScreen, drawSprites } from Graphics;
import { readInput } from Input;

export function init(): void {
    clearScreen();
}

export function update(): void {
    readInput();
}

export function render(): void {
    drawSprites();
}
```

```blend65
// file: graphics.blend
module Graphics;

export function clearScreen(): void { /* ... */ }
export function drawSprites(): void { /* ... */ }
```

### 9.2 Shared Types Across Modules

```blend65
// file: types.blend
module Types;

export struct Position { x: word; y: word; }
export struct Velocity { dx: sbyte; dy: sbyte; }
export enum Direction { UP, DOWN, LEFT, RIGHT }
```

```blend65
// file: player.blend
module Player;
import { Position, Velocity, Direction } from Types;

let playerPos: Position = { x: 160, y: 100 };
let playerVel: Velocity = { dx: 0, dy: 0 };
let facing: Direction = Direction.DOWN;

export function movePlayer(dir: Direction): void {
    // ...
}
```
