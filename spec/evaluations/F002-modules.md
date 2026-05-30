# F002 — Module declarations

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)

## Description

Every Blend65 source file must begin with a `module` declaration that names the module the file belongs to. Modules provide namespacing and organize code into logical units.

## Syntax

```blend65
module <name>;
```

Where `<name>` is a dot-separated identifier: `Game`, `Game.Snake`, `Utils.Math`

## Rules

| Rule | Decision |
|------|----------|
| Every file must have a `module` declaration | Yes — mandatory, must be first declaration |
| A file can have multiple `module` declarations | **No** — exactly one per file |
| Multiple files can declare the same module | **Yes** — the compiler merges their contents |
| Module name must match file path | **No** — file names are irrelevant to module names |
| Module names are case-sensitive | Yes |
| Dot-separated hierarchical names | Yes — no limit on nesting depth |

## Ambiguities Resolved

| # | Ambiguity | Resolution |
|---|-----------|------------|
| 1 | Missing `module` declaration | **E10001**: `Module declaration required — every source file must begin with 'module <name>;'` |
| 2 | Multiple `module` declarations in one file | **E10002**: `Only one module declaration allowed per source file` |
| 3 | Same module across multiple files | Compiler merges contents. Duplicate symbol names within the merged module produce **E10003**: `Duplicate declaration '<name>' in module '<module>' (also declared in <file>)` |
| 4 | Module name vs file path | No relationship enforced. File organization is a developer convention, not a compiler rule |

## Examples

**Basic module declaration:**
```blend65
module Game.Main;

// ... module contents
```

**Module split across two files:**

```blend65
// file: player.blend
module Game.Logic;

export function movePlayer(dx: byte, dy: byte): void {
  // ...
}
```

```blend65
// file: enemies.blend
module Game.Logic;

export function moveEnemies(): void {
  // ...
}
```

Both files contribute to the `Game.Logic` module. The compiler merges their exports.

## Language Guard Verdict

- **L1 Unambiguous syntax** ✅ — Simple `module <name>;` — no parsing ambiguity
- **L2 Consistent** ✅ — Follows semicolon-terminated declaration pattern
- **L3 Beginner-friendly** ✅ — Familiar to TypeScript/C# developers
- **L4 Minimal** ✅ — One keyword, one name, one semicolon
- **C1 Lexer/parser** ✅ — `KW_MODULE`, `IDENTIFIER` (with dots), `SEMICOLON`

