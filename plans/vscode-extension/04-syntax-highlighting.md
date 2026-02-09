# Syntax Highlighting: TextMate Grammar & Snippets

> **Document**: 04-syntax-highlighting.md
> **Parent**: [Index](00-index.md)
> **Status**: Complete

## Overview

Syntax highlighting uses a TextMate grammar (`blend.tmLanguage.json`) for initial token coloring, supplemented by semantic token highlighting from the LSP server for richer, context-aware coloring. Colors map to standard JS/TS semantic scopes so they look familiar in all themes.

## TextMate Grammar Design

### Scope Name

Root scope: `source.blend`

### Scope Mapping Strategy (JS/TS Colors)

The key design decision is to reuse standard TextMate scope names that JS/TS grammars use. This ensures Blend65 code looks natural in any VS Code theme.

| Blend65 Element | TextMate Scope | JS/TS Equivalent |
|-----------------|---------------|------------------|
| `module`, `import`, `export`, `from` | `keyword.control.import.blend` | Same as JS import/export |
| `function`, `return` | `keyword.control.blend` | Same as JS function/return |
| `if`, `else`, `while`, `for`, `switch`, etc. | `keyword.control.flow.blend` | Same as JS control flow |
| `break`, `continue` | `keyword.control.loop.blend` | Same as JS |
| `let` | `storage.type.blend` | Same as JS `let` |
| `const` | `storage.type.blend` | Same as JS `const` |
| `type`, `enum` | `storage.type.blend` | Same as TS `type`, `enum` |
| `byte`, `word`, `void`, `boolean`, `string` | `support.type.primitive.blend` | Same as TS primitives |
| `callback` | `storage.modifier.blend` | Similar to TS `async` |
| `@address` | `support.type.primitive.blend` | Type keyword |
| `@zp`, `@ram`, `@data` | `storage.modifier.blend` | Similar to TS decorators |
| `true`, `false` | `constant.language.boolean.blend` | Same as JS booleans |
| Decimal numbers | `constant.numeric.decimal.blend` | Same as JS |
| `$FFFF` hex | `constant.numeric.hex.blend` | Same as JS `0xFFFF` |
| `0xFF` hex | `constant.numeric.hex.blend` | Same as JS |
| `0b1010` binary | `constant.numeric.binary.blend` | Same as JS |
| `"string"` / `'string'` | `string.quoted.double.blend` / `string.quoted.single.blend` | Same as JS |
| `\\n`, `\\t`, etc. | `constant.character.escape.blend` | Same as JS |
| `//` comment | `comment.line.double-slash.blend` | Same as JS |
| `/* */` comment | `comment.block.blend` | Same as JS |
| `+`, `-`, `*`, `/`, `%` | `keyword.operator.arithmetic.blend` | Same as JS |
| `==`, `!=`, `<`, `>`, etc. | `keyword.operator.comparison.blend` | Same as JS |
| `&&`, `\|\|`, `!` | `keyword.operator.logical.blend` | Same as JS |
| `&`, `\|`, `^`, `~`, `<<`, `>>` | `keyword.operator.bitwise.blend` | Same as JS |
| `=`, `+=`, `-=`, etc. | `keyword.operator.assignment.blend` | Same as JS |
| `?` `:` (ternary) | `keyword.operator.ternary.blend` | Same as JS |
| `@` (address-of) | `keyword.operator.address.blend` | Unique to Blend65 |
| Function declarations | `entity.name.function.blend` | Same as JS |
| Function calls | `entity.name.function.blend` | Same as JS |
| Enum declarations | `entity.name.type.enum.blend` | Same as TS |
| Type aliases | `entity.name.type.alias.blend` | Same as TS |
| Intrinsic functions | `support.function.builtin.blend` | Similar to JS built-ins |
| `asm_*` functions | `support.function.asm.blend` | Similar to built-in functions |
| Parameters | `variable.parameter.blend` | Same as JS |
| Module name | `entity.name.namespace.blend` | Same as TS namespace |
| `.` member access | `punctuation.accessor.blend` | Same as JS |

## Grammar Pattern Structure

### Pattern Order (Priority)

TextMate grammars match patterns in order. The `blend.tmLanguage.json` `patterns` array should be ordered:

1. **Comments** — highest priority (prevent matching inside comments)
2. **Strings** — prevent matching inside strings
3. **Storage classes** — `@zp`, `@ram`, `@data` (before `@` operator)
4. **Type keywords** — `byte`, `word`, `void`, `boolean`, `string`, `callback`, `@address`
5. **Module keywords** — `module`, `import`, `export`, `from`
6. **Control flow keywords** — `if`, `else`, `while`, `for`, `to`, `downto`, `step`, `do`, `switch`, `case`, `default`, `break`, `continue`
7. **Declaration keywords** — `function`, `return`, `let`, `const`, `type`, `enum`
8. **Boolean literals** — `true`, `false`
9. **Number literals** — `$hex`, `0xhex`, `0bbinary`, decimal
10. **Intrinsic function names** — `peek`, `poke`, `peekw`, `pokew`, `hi`, `lo`, `length`, `barrier`, `volatile_read`, `volatile_write`
11. **ASM function prefix** — `asm_[a-z_]+` (matches all asm_* calls)
12. **Function declarations** — `function` followed by identifier
13. **Enum/type declarations** — `enum` / `type` followed by identifier
14. **Operators** — arithmetic, comparison, logical, bitwise, assignment, ternary
15. **Punctuation** — brackets, parens, braces, comma, semicolon, dot

### Key Pattern Examples

**Comments:**
```json
{
  "name": "comment.line.double-slash.blend",
  "match": "//.*$"
},
{
  "name": "comment.block.blend",
  "begin": "/\\*",
  "end": "\\*/",
  "name": "comment.block.blend"
}
```

**Strings with escape sequences:**
```json
{
  "name": "string.quoted.double.blend",
  "begin": "\"",
  "end": "\"",
  "patterns": [{
    "name": "constant.character.escape.blend",
    "match": "\\\\[ntr\\\\\"']"
  }]
}
```

**Number literals (all formats):**
```json
{
  "name": "constant.numeric.hex.blend",
  "match": "\\$[0-9A-Fa-f]+"
},
{
  "name": "constant.numeric.hex.blend",
  "match": "\\b0x[0-9A-Fa-f]+\\b"
},
{
  "name": "constant.numeric.binary.blend",
  "match": "\\b0b[01]+\\b"
},
{
  "name": "constant.numeric.decimal.blend",
  "match": "\\b[0-9]+\\b"
}
```

**Storage classes (must match before `@` operator):**
```json
{
  "name": "storage.modifier.blend",
  "match": "@(zp|ram|data)\\b"
},
{
  "name": "support.type.primitive.blend",
  "match": "@address\\b"
}
```

**Intrinsic functions:**
```json
{
  "name": "support.function.builtin.blend",
  "match": "\\b(peek|poke|peekw|pokew|hi|lo|length|barrier|volatile_read|volatile_write)\\b"
}
```

**ASM functions:**
```json
{
  "name": "support.function.asm.blend",
  "match": "\\basm_[a-z_]+\\b"
}
```

**Function declaration (captures name):**
```json
{
  "match": "\\b(function)\\s+([a-zA-Z_][a-zA-Z0-9_]*)",
  "captures": {
    "1": { "name": "keyword.control.blend" },
    "2": { "name": "entity.name.function.blend" }
  }
}
```

**Enum declaration (captures name):**
```json
{
  "match": "\\b(enum)\\s+([a-zA-Z_][a-zA-Z0-9_]*)",
  "captures": {
    "1": { "name": "storage.type.blend" },
    "2": { "name": "entity.name.type.enum.blend" }
  }
}
```

**Module declaration (captures dotted name):**
```json
{
  "match": "\\b(module)\\s+([a-zA-Z_][a-zA-Z0-9_.]*)",
  "captures": {
    "1": { "name": "keyword.control.import.blend" },
    "2": { "name": "entity.name.namespace.blend" }
  }
}
```

## Snippets (`snippets/blend.json`)

### Module & Import Snippets

| Prefix | Name | Body |
|--------|------|------|
| `mod` | Module Declaration | `module ${1:Module.Name};\n\n$0` |
| `imp` | Import | `import { ${2:symbol} } from ${1:module.name};\n$0` |
| `exp` | Export Function | `export function ${1:name}(${2}): ${3:void} {\n\t$0\n}` |

### Function Snippets

| Prefix | Name | Body |
|--------|------|------|
| `fn` | Function | `function ${1:name}(${2}): ${3:void} {\n\t$0\n}` |
| `efn` | Export Function | `export function ${1:name}(${2}): ${3:void} {\n\t$0\n}` |
| `cb` | Callback Function | `callback function ${1:name}(): void {\n\t$0\n}` |
| `main` | Main Entry Point | `export function main(): void {\n\t$0\n}` |

### Control Flow Snippets

| Prefix | Name | Body |
|--------|------|------|
| `if` | If Statement | `if (${1:condition}) {\n\t$0\n}` |
| `ife` | If-Else | `if (${1:condition}) {\n\t$2\n} else {\n\t$0\n}` |
| `for` | For Loop (C-style) | `for (let ${1:i}: byte = ${2:0}; ${1:i} < ${3:10}; ${1:i} += 1) {\n\t$0\n}` |
| `fort` | For Loop (to) | `for (${1:i} = ${2:0} to ${3:10}) {\n\t$0\n}` |
| `ford` | For Loop (downto) | `for (${1:i} = ${2:10} downto ${3:0}) {\n\t$0\n}` |
| `while` | While Loop | `while (${1:condition}) {\n\t$0\n}` |
| `do` | Do-While | `do {\n\t$0\n} while (${1:condition});` |
| `switch` | Switch | `switch (${1:value}) {\n\tcase ${2:value1}:\n\t\t$0\n\tdefault:\n}` |

### Type & Enum Snippets

| Prefix | Name | Body |
|--------|------|------|
| `enum` | Enum Declaration | `enum ${1:Name} {\n\t${2:MEMBER1} = ${3:0},\n\t$0\n}` |
| `type` | Type Alias | `type ${1:Name} = ${2:byte};` |

### C64-Specific Snippets

| Prefix | Name | Body |
|--------|------|------|
| `poke` | Poke | `poke(${1:\\$D020}, ${2:value});` |
| `peek` | Peek | `let ${1:value}: byte = peek(${2:\\$D020});` |
| `sei` | Disable Interrupts | `asm_sei();\n$0\nasm_cli();` |
| `zp` | Zero Page Variable | `@zp let ${1:name}: ${2:byte} = ${3:0};` |
| `ram` | RAM Variable | `@ram let ${1:name}: ${2:byte}[${3:256}];` |
| `data` | Data Constant | `@data const ${1:name}: ${2:byte}[] = [$0];` |
| `gameloop` | Game Loop | `export function main(): void {\n\tinit();\n\twhile (true) {\n\t\tupdate();\n\t\trender();\n\t}\n}` |
| `irq` | IRQ Handler | `callback function ${1:rasterIRQ}(): void {\n\t$0\n}` |

### Variable Snippets

| Prefix | Name | Body |
|--------|------|------|
| `let` | Let Variable | `let ${1:name}: ${2:byte} = ${3:0};` |
| `const` | Const | `const ${1:NAME}: ${2:byte} = ${3:0};` |
| `arr` | Array | `let ${1:name}: ${2:byte}[${3:256}];` |

**Total: 25+ snippets** covering all common patterns.

## Semantic Token Highlighting (Phase 5)

Beyond TextMate's regex-based coloring, the LSP server provides semantic tokens for context-aware highlighting:

### Semantic Token Types

| Token Type | Use Case | Example |
|------------|----------|---------|
| `function` | Function names (declaration + call) | `clearScreen`, `add` |
| `variable` | Variable references | `playerX`, `score` |
| `parameter` | Function parameters | `x`, `y` in `function move(x: byte, y: byte)` |
| `type` | Type names | `SpriteId`, `Address` (type aliases) |
| `enum` | Enum names | `Direction`, `GameState` |
| `enumMember` | Enum members | `Direction.UP`, `GameState.MENU` |
| `property` | Enum member after dot | `.UP`, `.MENU` |
| `namespace` | Module names | `Game.Snake`, `c64.graphics` |
| `keyword` | Language keywords | `module`, `import`, etc. |
| `number` | Numeric literals | `255`, `$D020`, `0b1010` |
| `string` | String literals | `"Hello"` |
| `comment` | Comments | `// comment` |

### Semantic Token Modifiers

| Modifier | Meaning |
|----------|---------|
| `declaration` | Symbol is being declared (not referenced) |
| `readonly` | `const` variables |
| `static` | Module-level (global) variables |
| `defaultLibrary` | Intrinsic functions |

**Semantic tokens supplement TextMate** — they provide differentiation that regex can't (e.g., distinguishing a function call from a variable reference on the same identifier name).
