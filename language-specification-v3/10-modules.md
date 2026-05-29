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
module_decl = "module" , identifier , ";" ;
```

Every source file must begin with a `module` declaration (after any leading comments):

```blend65
module Game;
```

### 2.2 Rules

| Rule | Decision |
|------|----------|
| Must every file have a module declaration? | **Yes** — E10001 if missing |
| Must it be the first statement? | **Yes** — E10002 if preceded by anything other than comments |
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
export function clamp(v: byte, lo: byte, hi: byte): byte { }
export struct Vector2 { x: word; y: word; }
export enum Direction { UP, DOWN, LEFT, RIGHT }

// Not exported — module-private
let tempResult: word;
function helperCalc(): byte { }
```

### 4.2 Import

The `import` statement brings exported declarations into scope:

```ebnf
import_stmt = "import" , "{" , import_list , "}" , "from" , identifier , ";" ;
import_list = import_item , { "," , import_item } ;
import_item = identifier , [ "as" , identifier ] ;
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
   a. Initialize zeropage variables (→ Ch 03, §5)
   b. Initialize RAM variables (→ Ch 03, §5)
   c. Fall through to main() body (no JSR — saves 2 stack bytes)
4. main() executes
5. main() returns → platform-defined behavior (typically returns to OS/monitor)
```

Note: The startup routine falls through directly into `main()`'s body — there is no `JSR main` / `RTS`. This saves 2 bytes of stack and avoids the 12-cycle JSR/RTS overhead.

---

## 6. Multi-File Compilation

### 6.1 Rules

- The compiler accepts one or more `.blend65` source files
- All files are compiled together into a single output binary
- File names and directory structure have **no semantic meaning**
- Cross-file references are resolved via the module/import system
- Two files with the same module name contribute to the same module

### 6.2 Compilation Model

```
game.blend65 ──┐
math.blend65 ──┤──→ Compiler ──→ Single binary (e.g., game.prg)
gfx.blend65  ──┘
```

The compiler processes all files in a multi-pass model:
1. **Pass 1**: Parse all files; collect module-level declarations (types, function signatures, variable types)
2. **Pass 2**: Resolve imports; type-check all function bodies
3. **Pass 3**: Build call graph; detect recursion; allocate SFA frames
4. **Pass 4**: Generate code; emit binary

---

## 7. Error Codes

| Code | Condition | Message |
|------|-----------|---------|
| E10001 | Missing module declaration | `Source file must begin with a module declaration — add 'module <Name>;'` |
| E10002 | Module declaration not first | `Module declaration must be the first statement in the file` |
| E10003 | Duplicate declaration | `Duplicate declaration — '<name>' is already declared in this scope` |
| E10010 | Executable statement at module level | `Executable statements are not allowed at module level — place code inside a function` |
| E10012 | Import of non-exported item | `'<name>' is not exported from module '<module>'` |
| E10020 | No main function | `No 'main' function found — every program needs 'function main(): void'` |
| E10021 | Multiple main functions | `Multiple 'main' functions found — in modules '<A>' and '<B>'. Only one is allowed.` |
| E10023 | Calling main directly | `Cannot call 'main()' directly — it is the program entry point, not a callable function` |

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
// file: main.blend65
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
// file: engine.blend65
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
// file: graphics.blend65
module Graphics;

export function clearScreen(): void { /* ... */ }
export function drawSprites(): void { /* ... */ }
```

### 9.2 Shared Types Across Modules

```blend65
// file: types.blend65
module Types;

export struct Position { x: word; y: word; }
export struct Velocity { dx: sbyte; dy: sbyte; }
export enum Direction { UP, DOWN, LEFT, RIGHT }
```

```blend65
// file: player.blend65
module Player;
import { Position, Velocity, Direction } from Types;

let playerPos: Position = { x: 160, y: 100 };
let playerVel: Velocity = { dx: 0, dy: 0 };
let facing: Direction = Direction.DOWN;

export function movePlayer(dir: Direction): void {
    // ...
}
```
