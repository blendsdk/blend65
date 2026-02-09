# Blend65 VS Code Extension - Implementation Plan

> **Feature**: Full-featured VS Code extension with syntax highlighting, Language Server Protocol (LSP), IntelliSense, and marketplace publishing
> **Status**: Planning Complete
> **Created**: 2025-02-09
> **Extension Name**: "Blend65 Programming Language"
> **Package Name**: `vscode-blend65`

## Overview

This plan covers the creation of a comprehensive VS Code extension for the Blend65 programming language. The extension provides syntax highlighting with JS/TS-familiar color schemes, a full Language Server Protocol implementation powered by the existing `@blend65/compiler`, rich IntelliSense for all 10 intrinsics + 151 ASM functions, navigation features, build integration, and marketplace publishing.

The extension leverages the existing compiler infrastructure:
- **Lexer** — tokenization with source positions (supports comment tokens)
- **Parser** — full AST with source locations and visitor pattern
- **Semantic Analyzer** — 8-pass analysis producing diagnostics, symbol tables, type info
- **Library files** — intrinsic signatures, ASM function signatures, C64 hardware constants

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of compiler infrastructure |
| 03 | [Project Setup](03-project-setup.md) | Monorepo integration, packaging, bundling |
| 04 | [Syntax Highlighting](04-syntax-highlighting.md) | TextMate grammar, language config, snippets |
| 05 | [Language Server](05-language-server.md) | LSP server, diagnostics, document management |
| 06 | [IntelliSense](06-intellisense.md) | Completion, hover, signature help (CRITICAL) |
| 07 | [Navigation](07-navigation.md) | Go-to-definition, symbols, references, rename |
| 08 | [Build Integration](08-build-integration.md) | Task provider, build commands |
| 09 | [Formatting & Quick Fixes](09-formatting-quickfixes.md) | Code formatter, code actions |
| 10 | [Marketplace](10-marketplace.md) | Publishing, packaging, README |
| 11 | [Testing Strategy](11-testing-strategy.md) | Tests for grammar, LSP, IntelliSense |
| 12 | [Future Features](12-future-features.md) | Debugger/VICE, advanced features |
| -- | [TODO](TODO.md) | Pending items (publisher ID, icon, etc.) |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, task checklist |

## Quick Reference

### Extension Architecture

```
packages/vscode-blend65/
├── package.json                    # Extension manifest + contributes
├── tsconfig.json                   # TypeScript config
├── esbuild.config.mjs             # Bundler config
├── .vscodeignore                  # Files to exclude from VSIX
├── README.md                      # Marketplace README
├── CHANGELOG.md                   # Version history
├── LICENSE.md                     # License
├── icon.png                       # Extension icon (128x128+)
├── src/
│   ├── extension.ts               # Client-side activation
│   ├── client.ts                  # LSP client setup
│   └── server/
│       ├── server.ts              # LSP server entry point
│       ├── document-manager.ts    # Document lifecycle management
│       ├── diagnostics.ts         # Compiler diagnostics → LSP diagnostics
│       ├── completion.ts          # Autocomplete provider
│       ├── hover.ts               # Hover info provider
│       ├── definition.ts          # Go-to-definition provider
│       ├── symbols.ts             # Document/workspace symbols
│       ├── signature-help.ts      # Function parameter hints
│       ├── references.ts          # Find all references
│       ├── rename.ts              # Rename symbol
│       ├── formatting.ts          # Document formatting
│       ├── code-actions.ts        # Quick fixes
│       ├── semantic-tokens.ts     # Semantic highlighting
│       ├── folding.ts             # Code folding ranges
│       └── data/
│           ├── intrinsics.ts      # Pre-built intrinsic definitions
│           ├── asm-functions.ts   # Pre-built ASM function data
│           └── hardware.ts        # C64 hardware constant docs
├── syntaxes/
│   └── blend.tmLanguage.json      # TextMate grammar
├── language-configuration.json     # Brackets, comments, etc.
└── snippets/
    └── blend.json                 # Code snippets
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Location | `packages/vscode-blend65` (monorepo) |
| LSP transport | stdio (standard, cross-platform) |
| LSP framework | `vscode-languageserver` + `vscode-languageclient` |
| Bundler | esbuild (fast, modern) |
| Syntax colors | Borrow JS/TS semantic mapping |
| Compiler usage | Import `@blend65/compiler` as library in LSP server |
| IntelliSense priority | CRITICAL - Phase 3 right after LSP skeleton |

### Implementation Phases

| Phase | Title | Sessions | Priority |
|-------|-------|----------|----------|
| 1 | Project Setup & Scaffolding | 2-3 | 🔴 Critical |
| 2 | Syntax Highlighting & Language Config | 2-3 | 🔴 Critical |
| 3 | Language Server - Diagnostics | 2-3 | 🔴 Critical |
| 4 | IntelliSense (Completion, Hover, Signature) | 3-4 | 🔴 Critical |
| 5 | Navigation (Definition, Symbols) | 2-3 | 🟡 High |
| 6 | Build Task Provider | 1 | 🟡 High |
| 7 | Find References & Rename | 2-3 | 🟢 Medium |
| 8 | Code Formatting & Quick Fixes | 2-3 | 🟢 Medium |
| 9 | Marketplace Publishing | 1-2 | 🟡 High |

**Total: ~18-25 sessions**

## Related Files

- `packages/compiler/` — Compiler source (lexer, parser, semantic, etc.)
- `packages/compiler/library/` — Intrinsic and hardware library files
- `docs/language-specification-v2/` — Language specification
- `examples/` — Example Blend65 programs
