# Blend65 C-Style Syntax Refactor Plan

> **Status**: Planning Complete
> **Created**: January 25, 2026
> **Scope**: VB/Pascal-style → C/TypeScript-style syntax

## Overview

This plan covers the comprehensive refactor of Blend65's syntax from VB/Pascal-style (`end if`, `end function`, `then`, `next`) to C/TypeScript-style (curly braces `{ }`).

## Plan Documents

| Document | Description | Status |
|----------|-------------|--------|
| [00-overview.md](00-overview.md) | Overview, architecture, scope, design decisions | ✅ |
| [01-lexer-parser.md](01-lexer-parser.md) | Phase 1-2: Lexer & Parser detailed tasks | ✅ |
| [02-ast-semantic.md](02-ast-semantic.md) | Phase 3-4: AST & Semantic Analyzer tasks | ✅ |
| [03-codegen-docs.md](03-codegen-docs.md) | Phase 5-6: CodeGen & Documentation tasks | ✅ |

## Implementation Phases

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PHASE 1: LEXER                               │
│  Add new tokens, remove obsolete keywords                           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PHASE 2: PARSER                              │
│  Rewrite statement parsing for curly-brace syntax                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PHASE 3: AST                                 │
│  Update AST nodes for new for-loop features                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PHASE 4: SEMANTIC ANALYZER                      │
│  Loop overflow detection, 16-bit counter inference                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PHASE 5: CODE GENERATION                        │
│  Update codegen for new for-loop structures                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PHASE 6: SPEC & EXAMPLES                        │
│  Update language specification, examples, tests                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Reference: Syntax Changes

| Element | Current (VB-style) | New (C-style) |
|---------|-------------------|---------------|
| Module | `module A.B` | `module A.B;` |
| Import | `import A from B` | `import { A } from B;` |
| Function | `function f() ... end function` | `function f() { ... }` |
| If | `if x then ... end if` | `if (x) { ... }` |
| Else if | `elseif x then` | `else if (x) {` |
| While | `while x ... end while` | `while (x) { ... }` |
| For | `for i = 0 to 10 ... next i` | `for (i = 0 to 10) { ... }` |
| For (new) | — | `for (i = 0 to 10 step 2) { ... }` |
| For (new) | — | `for (i = 10 downto 0) { ... }` |
| Do-While | — (NEW) | `do { ... } while (cond);` |
| Match | `match x ... end match` | `switch (x) { ... }` |
| Enum | `enum E ... end enum` | `enum E { ... }` |
| @map type | `@map x type ... end @map` | `@map x type { ... }` |
| @map layout | `@map x layout ... end @map` | `@map x layout { ... }` |
| Ternary | — (NEW) | `cond ? a : b` |

## Implementation Order

1. Start with [01-lexer-parser.md](01-lexer-parser.md) - Phase 1 & 2
2. Then proceed to [02-ast-semantic.md](02-ast-semantic.md) - Phase 3 & 4
3. Finally complete [03-codegen-docs.md](03-codegen-docs.md) - Phase 5 & 6

## Cross-References

- Language Specification: `docs/language-specification/`
- Parser Implementation: `packages/compiler/src/parser/`
- Lexer Implementation: `packages/compiler/src/lexer/`
- Tests: `packages/compiler/src/__tests__/`