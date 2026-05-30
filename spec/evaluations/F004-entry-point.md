# F004 — Program entry point

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)

## Description

The entry point of a Blend65 program is a function named `main`. There must be exactly one `main` function across all modules in the program. The `main` function takes no parameters and returns `void`.

## Rules

| Rule | Decision |
|------|----------|
| Entry point function name | `main` — always |
| Signature | `function main(): void` — no parameters, void return |
| Can `main` be in any module? | **Yes** — the compiler searches all modules |
| Must `main` be exported? | **No** — `main` is implicitly the entry point regardless of `export` |
| How many `main` functions? | **Exactly one** across the entire program |
| Can other functions call `main()`? | **No** — `main` is the entry point, not a callable function (E10023) |
| How is `main()` entered? | The startup sequence falls through directly into `main()`'s body — no JSR, no JMP (see F019) |
| Library builds | When compiling with `--library`, no `main` is required |

## Errors

| Code | Condition | Message |
|------|-----------|---------|
| E10020 | No `main` function found | `No entry point found — define a 'function main(): void' in any module` |
| E10021 | Multiple `main` functions | `Multiple entry points found — 'main' is defined in module '<A>' and module '<B>'. Only one is allowed` |
| E10022 | Wrong `main` signature | `Entry point 'main' must have signature 'function main(): void' — found '<actual signature>'` |
| E10023 | Another function calls `main()` | `Cannot call 'main()' — it is the program entry point, not a callable function` |

## Examples

**Standard entry point:**
```blend65
module Game.Main;

import { clearScreen } from Graphics;
import { initGame, gameLoop } from Game.Logic;

function main(): void {
  clearScreen();
  initGame();
  gameLoop();
}
```

Note: `main` does not need `export` — it is automatically recognized as the entry point. However, writing `export function main(): void` is also valid (the `export` is simply redundant for `main`).

**Library build (no main needed):**
```bash
blend65c --library --platform c64 utils.blend math.blend
```

## Design Rationale

- **Option A chosen** (single `main()` in any module) over Option B (compiler flag designates entry module) and Option C (`main module` keyword)
- Familiar to C, Rust, Go, Java developers (L3: Beginner-friendly)
- No extra keywords or compiler flags needed (L4: Minimal)
- Clear error messages when `main` is missing or duplicated (L6: Error messages defined)
- Supports library builds via `--library` flag (F1: Extensible)

## Language Guard Verdict

- **P1–P4** ✅ — Entry point is platform-independent; the compiler generates platform-specific startup code
- **H1** ✅ — Startup sequence falls through directly into `main`'s body — zero call overhead
- **H3** ✅ — `main` has a static frame like any other function (parameters/locals at fixed addresses)
- **L1** ✅ — No syntax ambiguity — `main` is just a function name with special linker meaning
- **L3** ✅ — Every C/TypeScript developer understands `main()`
- **C3** ✅ — Codegen: startup sequence (CPU init → variable init) falls through into `main`'s body (F019)

