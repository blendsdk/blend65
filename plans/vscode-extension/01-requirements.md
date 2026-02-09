# Requirements: Blend65 VS Code Extension

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

A full-featured VS Code extension for the Blend65 programming language that provides a first-class development experience for Commodore 64 / 6502 developers. The extension must feel familiar to TypeScript/JavaScript developers while providing deep 6502-specific IntelliSense.

## Functional Requirements

### Must Have (MVP - Phases 1-5)

- [x] **REQ-01**: TextMate syntax grammar for all Blend65 v2 syntax
- [ ] **REQ-02**: JS/TS-familiar color scheme mapping (keywords, types, operators, etc.)
- [ ] **REQ-03**: Language configuration (brackets, comments, auto-close, auto-indent)
- [ ] **REQ-04**: Code snippets for common patterns (module, function, for loop, etc.)
- [ ] **REQ-05**: LSP server using `@blend65/compiler` as analysis engine
- [ ] **REQ-06**: Real-time error diagnostics pushed on file save/change
- [ ] **REQ-07**: Warning diagnostics (unused variables, unreachable code, etc.)
- [ ] **REQ-08**: Autocomplete for keywords and primitive types
- [ ] **REQ-09**: Autocomplete for user-defined symbols (variables, functions, enums)
- [ ] **REQ-10**: Autocomplete for all 10 intrinsics with documentation
- [ ] **REQ-11**: Autocomplete for all 151 asm_* functions with 6502 opcode docs
- [ ] **REQ-12**: Autocomplete for C64 hardware constants
- [ ] **REQ-13**: Autocomplete for enum members (e.g., `Direction.` triggers member list)
- [ ] **REQ-14**: Hover info showing type information for any symbol
- [ ] **REQ-15**: Hover info showing JSDoc documentation for intrinsics/asm functions
- [ ] **REQ-16**: Hover info showing 6502 cycle counts for asm_* functions
- [ ] **REQ-17**: Signature help (parameter hints) for function calls
- [ ] **REQ-18**: Signature help for intrinsic function calls
- [ ] **REQ-19**: Go-to-definition for variables, functions, and imports
- [ ] **REQ-20**: Document symbols (outline view) showing all declarations
- [ ] **REQ-21**: Code folding for functions, if/else, loops, switch, block comments
- [ ] **REQ-22**: Semantic token highlighting (beyond TextMate)

### Should Have (Phases 6-8)

- [ ] **REQ-23**: Build task provider (compile Blend65 from VS Code)
- [ ] **REQ-24**: Find all references for symbols
- [ ] **REQ-25**: Rename symbol across module
- [ ] **REQ-26**: Document formatting (pretty printer)
- [ ] **REQ-27**: Quick fix: add missing semicolons
- [ ] **REQ-28**: Quick fix: add type annotations
- [ ] **REQ-29**: Quick fix: import suggestions for unresolved symbols
- [ ] **REQ-30**: Multi-module workspace support (cross-file analysis)

### Won't Have (Out of Scope - See Future Features)

- Debugger integration (VICE/other emulators) — separate project
- Inline assembly syntax in other languages — not applicable
- Profiler integration — future
- Memory map visualizer — future

## Technical Requirements

### Performance

- Diagnostics must update within **500ms** of file save
- Autocomplete must respond within **200ms**
- Hover info must respond within **100ms**
- Extension activation must complete within **2 seconds**
- Memory usage should stay under **100MB** for typical projects

### Compatibility

- VS Code version: **1.85+** (recent stable)
- OS: Windows, macOS, Linux
- Node.js: **18+** (for LSP server)
- Works with Blend65 compiler v2 (SFA architecture)

### Marketplace

- Extension name: "Blend65 Programming Language"
- Package name: `vscode-blend65`
- Categories: `Programming Languages`, `Linters`, `Snippets`
- File extension: `.blend`
- Icon: 128x128px PNG (pending — see TODO.md)

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| LSP vs inline | LSP server, inline provider | LSP server | Standard approach, supports all features, cross-editor potential |
| Bundler | esbuild, webpack, rollup | esbuild | Fastest, simplest config, used by modern extensions |
| Color scheme | Custom, JS/TS mapping | JS/TS mapping | Familiar to target audience, works with all themes |
| Monorepo vs separate | Monorepo package, separate repo | Monorepo | Shares compiler dependency, single build system |
| Intrinsics data | Parse .blend files, hardcoded | Hardcoded + extracted | Faster startup, verified data, JSDoc comments |

## Acceptance Criteria

1. [ ] Extension installs from VSIX and activates on `.blend` files
2. [ ] All Blend65 v2 syntax is correctly highlighted
3. [ ] Errors from compiler appear as VS Code diagnostics (red squiggles)
4. [ ] Typing `peek(` shows signature help with parameter info
5. [ ] Typing `asm_` shows all 151 asm function completions
6. [ ] Hovering over `poke` shows type signature and documentation
7. [ ] Ctrl+click on a function name navigates to its definition
8. [ ] Outline view shows all module-level declarations
9. [ ] Extension is publishable to VS Code Marketplace
10. [ ] All tests pass
