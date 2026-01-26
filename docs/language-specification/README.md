# Blend65 Language Specification

> **Status**: C-Style Syntax Specification  
> **Last Updated**: January 25, 2026

Welcome to the Blend65 language specification. This documentation describes the complete syntax, semantics, and features of the Blend65 programming language—a modern language designed to compile to 6502-family systems (C64, VIC-20, Commander X16, and more).

## What is Blend65?

Blend65 provides structured programming, modularity, and a practical type system while still enabling fine-grained memory placement and low-level control for 6502 systems. The language uses **C-style syntax** with curly braces for block delimiters, making it familiar to developers from C, JavaScript, and TypeScript backgrounds.

## Syntax Highlights

```js
module Game.Main;

import { clearScreen } from c64.graphics;

@map vicBorderColor at $D020: byte;
@zp let score: word = 0;

enum GameState {
  MENU,
  PLAYING,
  GAME_OVER
}

export function main(): void {
  clearScreen();
  while (true) {
    if (score > 100) {
      showBonus();
    }
  }
}
```

## Document Index

### Core Language (Read in order)

| Document | Description |
|----------|-------------|
| [00-overview.md](00-overview.md) | Language introduction, design goals, and specification status |
| [01-lexical-structure.md](01-lexical-structure.md) | Character sets, tokens, identifiers, keywords, literals, comments |
| [02-grammar.md](02-grammar.md) | EBNF grammar overview and common building blocks |
| [03-program-structure.md](03-program-structure.md) | Program structure and top-level ordering rules |
| [04-module-system.md](04-module-system.md) | Module declarations, qualified names, import/export system |
| [05-type-system.md](05-type-system.md) | Primitive types, type aliases, enums |
| [06-expressions-statements.md](06-expressions-statements.md) | Expressions, operators, statements, control flow |

### Language Features

| Document | Description |
|----------|-------------|
| [10-variables.md](10-variables.md) | Variable declarations, storage classes, mutability |
| [11-functions.md](11-functions.md) | Function declarations, parameters, return statements, callbacks |
| [12-memory-mapped.md](12-memory-mapped.md) | Memory-mapped variables (`@map`) - all 4 forms |
| [13-6502-features.md](13-6502-features.md) | 6502-specific features, compiler intrinsics, and guidelines |

### Reference

| Document | Description |
|----------|-------------|
| [20-error-handling.md](20-error-handling.md) | Lexer-level errors and diagnostics |
| [21-examples.md](21-examples.md) | Complete working code examples |
| [30-compiler-design.md](30-compiler-design.md) | Compiler design decisions and rationale |

## Quick Start

**New to Blend65?** Start with:
1. [Overview](00-overview.md) - Understand the language philosophy
2. [Lexical Structure](01-lexical-structure.md) - Learn basic syntax
3. [Program Structure](03-program-structure.md) - Understand how programs are organized
4. [Examples](21-examples.md) - See complete working code

**Looking for specific features?**
- Variables and memory placement → [Variables](10-variables.md)
- Hardware register access → [Memory-Mapped](12-memory-mapped.md)
- Functions and callbacks → [Functions](11-functions.md)
- Control flow (if/while/for/switch) → [Expressions & Statements](06-expressions-statements.md)

## Key Syntax Features

| Feature | Syntax |
|---------|--------|
| Module declaration | `module Game.Main;` |
| Import | `import { foo, bar } from module.name;` |
| Function | `function name(): void { }` |
| If statement | `if (condition) { } else { }` |
| While loop | `while (condition) { }` |
| Do-while loop | `do { } while (condition);` |
| For loop | `for (i = 0 to 10) { }` |
| For loop with step | `for (i = 0 to 100 step 2) { }` |
| For loop downto | `for (i = 10 downto 0) { }` |
| Switch statement | `switch (value) { case X: ... }` |
| Ternary | `condition ? a : b` |
| Enum | `enum Name { A, B, C }` |

## Specification Status

This specification is derived from the current lexer and parser implementation:
- **Lexer**: `packages/compiler/src/lexer/`
- **Parser**: `packages/compiler/src/parser/`
- **Tests**: `packages/compiler/src/__tests__/`

If a construct is not tokenizable/parseable by the frontend, it is not specified here.

## Contributing

When adding new language features:
1. Update the relevant specification document(s)
2. Add cross-references where needed
3. Include complete examples
4. Update this README if adding new documents

## Conventions

Throughout this specification:
- **EBNF grammar** is used to express syntax rules
- **Code examples** show typical usage patterns
- **✅/❌ markers** indicate correct vs. incorrect syntax
- **Cross-references** link to related sections in other documents