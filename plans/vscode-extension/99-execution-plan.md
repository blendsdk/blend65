# Execution Plan: Blend65 VS Code Extension

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-09
> **Progress**: 0/55 tasks (0%)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time | Priority |
|-------|-------|----------|-----------|----------|
| 1 | Project Setup & Scaffolding | 2-3 | 2-3 hrs | 🔴 Critical |
| 2 | Syntax Highlighting & Language Config | 2-3 | 2-3 hrs | 🔴 Critical |
| 3 | Language Server - Diagnostics | 2-3 | 2-3 hrs | 🔴 Critical |
| 4 | IntelliSense (Completion, Hover, Signature) | 3-4 | 4-5 hrs | 🔴 Critical |
| 5 | Navigation (Definition, Symbols, Folding) | 2-3 | 2-3 hrs | 🟡 High |
| 6 | Build Task Provider | 1 | 1 hr | 🟡 High |
| 7 | Find References & Rename | 2-3 | 2-3 hrs | 🟢 Medium |
| 8 | Code Formatting & Quick Fixes | 2-3 | 2-3 hrs | 🟢 Medium |
| 9 | Marketplace Publishing | 1-2 | 1-2 hrs | 🟡 High |

**Total: ~18-25 sessions, ~18-25 hours**

---

## Phase 1: Project Setup & Scaffolding

### Session 1.1: Create Package Structure

**Reference**: [03-project-setup.md](03-project-setup.md)
**Objective**: Create the `packages/vscode-blend65` package with proper monorepo integration

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Create `packages/vscode-blend65/package.json` with extension manifest, contributes, dependencies | `package.json` |
| 1.1.2 | Create `packages/vscode-blend65/tsconfig.json` for both client and server | `tsconfig.json` |
| 1.1.3 | Create esbuild config for bundling client + server separately | `esbuild.config.mjs` |
| 1.1.4 | Create `.vscodeignore` to exclude dev files from VSIX | `.vscodeignore` |
| 1.1.5 | Add package to monorepo `package.json` workspaces and `turbo.json` | root files |
| 1.1.6 | Create `language-configuration.json` (brackets, comments, auto-close) | `language-configuration.json` |

**Deliverables**:
- [ ] Package builds without errors
- [ ] VS Code recognizes `.blend` files
- [ ] Language configuration works (brackets, comments)

**Verify**: `cd packages/vscode-blend65 && yarn build`

---

### Session 1.2: Extension Activation & LSP Client Shell

**Objective**: Create minimal extension that activates and starts an empty LSP server

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.2.1 | Create `src/extension.ts` — extension activation, LSP client startup | `src/extension.ts` |
| 1.2.2 | Create `src/client.ts` — LSP client configuration (stdio transport) | `src/client.ts` |
| 1.2.3 | Create `src/server/server.ts` — minimal LSP server (initialize + shutdown) | `src/server/server.ts` |
| 1.2.4 | Create `src/server/document-manager.ts` — text document sync handler | `src/server/document-manager.ts` |
| 1.2.5 | Verify extension activates on `.blend` file open | manual test |

**Deliverables**:
- [ ] Extension activates when opening `.blend` files
- [ ] LSP server starts via stdio
- [ ] Document sync works (open/change/close events received)

**Verify**: Launch extension in Extension Development Host

---

## Phase 2: Syntax Highlighting & Language Config

### Session 2.1: TextMate Grammar

**Reference**: [04-syntax-highlighting.md](04-syntax-highlighting.md)
**Objective**: Create comprehensive TextMate grammar with JS/TS color mapping

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Create `syntaxes/blend.tmLanguage.json` — comments (line + block) | `syntaxes/blend.tmLanguage.json` |
| 2.1.2 | Add string literals (single + double quote, escape sequences) | `syntaxes/blend.tmLanguage.json` |
| 2.1.3 | Add number literals (decimal, $hex, 0xhex, 0bbinary, %binary) | `syntaxes/blend.tmLanguage.json` |
| 2.1.4 | Add keywords (module, import, export, function, return, control flow) | `syntaxes/blend.tmLanguage.json` |
| 2.1.5 | Add type keywords (byte, word, void, boolean, string, callback, @address) | `syntaxes/blend.tmLanguage.json` |
| 2.1.6 | Add storage classes (@zp, @ram, @data) and modifiers (let, const, export) | `syntaxes/blend.tmLanguage.json` |
| 2.1.7 | Add operators (arithmetic, comparison, logical, bitwise, assignment) | `syntaxes/blend.tmLanguage.json` |
| 2.1.8 | Add function declarations, calls, enum declarations | `syntaxes/blend.tmLanguage.json` |
| 2.1.9 | Add special: boolean literals (true/false), intrinsic function names | `syntaxes/blend.tmLanguage.json` |

**Deliverables**:
- [ ] All Blend65 syntax is highlighted
- [ ] Colors match JS/TS conventions in popular themes
- [ ] Comments, strings, numbers, keywords all distinct

**Verify**: Open example `.blend` files and visually verify

---

### Session 2.2: Snippets

**Objective**: Create code snippets for common patterns

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.2.1 | Create `snippets/blend.json` with module, function, for loop, while, if/else | `snippets/blend.json` |
| 2.2.2 | Add C64-specific snippets (poke, peek, interrupt handler, game loop) | `snippets/blend.json` |
| 2.2.3 | Add enum, switch/case, type alias snippets | `snippets/blend.json` |

**Deliverables**:
- [ ] 15+ snippets covering common patterns
- [ ] Snippets have proper tab stops and placeholders

---

## Phase 3: Language Server - Diagnostics

### Session 3.1: Compiler Integration

**Reference**: [05-language-server.md](05-language-server.md)
**Objective**: Integrate compiler pipeline into LSP server for diagnostic reporting

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Create `src/server/diagnostics.ts` — run Lexer+Parser+SemanticAnalyzer on document | `src/server/diagnostics.ts` |
| 3.1.2 | Map compiler `Diagnostic` → LSP `Diagnostic` (severity, range, message, code) | `src/server/diagnostics.ts` |
| 3.1.3 | Trigger analysis on `onDidChangeContent` and `onDidSave` | `src/server/server.ts` |
| 3.1.4 | Handle lexer errors (unexpected characters, unterminated strings) | `src/server/diagnostics.ts` |
| 3.1.5 | Handle parser errors (syntax errors with recovery) | `src/server/diagnostics.ts` |
| 3.1.6 | Handle semantic errors (type mismatches, undefined variables, etc.) | `src/server/diagnostics.ts` |
| 3.1.7 | Cache analysis results (AST, symbol table) for reuse by other providers | `src/server/document-manager.ts` |

**Deliverables**:
- [ ] Red squiggles appear for syntax errors
- [ ] Type errors show as diagnostics
- [ ] Warnings (unused variables, etc.) show as yellow squiggles
- [ ] Diagnostics clear when errors are fixed

**Verify**: Open a `.blend` file with intentional errors

---

## Phase 4: IntelliSense (CRITICAL)

### Session 4.1: Intrinsics & ASM Function Data

**Reference**: [06-intellisense.md](06-intellisense.md)
**Objective**: Build the intrinsics and ASM function data modules

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Create `src/server/data/intrinsics.ts` — 10 intrinsics with signatures, docs, cycle counts | `src/server/data/intrinsics.ts` |
| 4.1.2 | Create `src/server/data/asm-functions.ts` — 151 asm functions with opcode docs, addressing modes | `src/server/data/asm-functions.ts` |
| 4.1.3 | Create `src/server/data/hardware.ts` — C64 hardware constants with register descriptions | `src/server/data/hardware.ts` |

**Deliverables**:
- [ ] All 10 intrinsics with full documentation
- [ ] All 151 asm_* functions with 6502 opcode details
- [ ] Hardware constants with register descriptions

---

### Session 4.2: Autocomplete Provider

**Objective**: Implement comprehensive autocomplete

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.2.1 | Create `src/server/completion.ts` — basic completion handler | `src/server/completion.ts` |
| 4.2.2 | Add keyword completions (all Blend65 keywords) | `src/server/completion.ts` |
| 4.2.3 | Add type completions (byte, word, void, boolean, string, callback) | `src/server/completion.ts` |
| 4.2.4 | Add intrinsic function completions with documentation | `src/server/completion.ts` |
| 4.2.5 | Add asm_* function completions with opcode docs | `src/server/completion.ts` |
| 4.2.6 | Add symbol completions from cached symbol table (variables, functions, enums) | `src/server/completion.ts` |
| 4.2.7 | Add enum member completions (after `.` on enum name) | `src/server/completion.ts` |
| 4.2.8 | Add storage class completions (@zp, @ram, @data) | `src/server/completion.ts` |

**Deliverables**:
- [ ] Keywords autocomplete
- [ ] Intrinsics autocomplete with docs
- [ ] asm_* autocomplete with 6502 info
- [ ] User symbols autocomplete
- [ ] Enum member autocomplete after dot

---

### Session 4.3: Hover & Signature Help

**Objective**: Implement hover info and signature help

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.3.1 | Create `src/server/hover.ts` — hover info provider | `src/server/hover.ts` |
| 4.3.2 | Show type info for variables on hover | `src/server/hover.ts` |
| 4.3.3 | Show function signatures on hover | `src/server/hover.ts` |
| 4.3.4 | Show intrinsic documentation with cycle counts on hover | `src/server/hover.ts` |
| 4.3.5 | Show asm_* function 6502 opcode details on hover | `src/server/hover.ts` |
| 4.3.6 | Show hardware constant descriptions on hover | `src/server/hover.ts` |
| 4.3.7 | Create `src/server/signature-help.ts` — parameter hints | `src/server/signature-help.ts` |
| 4.3.8 | Show parameter hints for function calls | `src/server/signature-help.ts` |
| 4.3.9 | Show parameter hints for intrinsic calls | `src/server/signature-help.ts` |

**Deliverables**:
- [ ] Hover shows type + docs for any symbol
- [ ] Intrinsics show rich documentation on hover
- [ ] asm_* shows opcode info on hover
- [ ] Signature help shows parameter hints while typing

---

## Phase 5: Navigation

### Session 5.1: Go-to-Definition & Document Symbols

**Reference**: [07-navigation.md](07-navigation.md)
**Objective**: Implement go-to-definition and outline view

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.1.1 | Create `src/server/definition.ts` — go-to-definition provider | `src/server/definition.ts` |
| 5.1.2 | Handle go-to-definition for local variables | `src/server/definition.ts` |
| 5.1.3 | Handle go-to-definition for functions | `src/server/definition.ts` |
| 5.1.4 | Handle go-to-definition for imported symbols (cross-module) | `src/server/definition.ts` |
| 5.1.5 | Create `src/server/symbols.ts` — document symbol provider | `src/server/symbols.ts` |
| 5.1.6 | Populate outline with functions, variables, enums, types, imports | `src/server/symbols.ts` |

**Deliverables**:
- [ ] Ctrl+click navigates to variable/function definition
- [ ] Outline view shows all declarations with icons

---

### Session 5.2: Semantic Tokens & Folding

**Objective**: Add semantic highlighting and code folding

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.2.1 | Create `src/server/semantic-tokens.ts` — semantic token provider | `src/server/semantic-tokens.ts` |
| 5.2.2 | Map token types: function, variable, parameter, type, enum, enumMember, property | `src/server/semantic-tokens.ts` |
| 5.2.3 | Map token modifiers: declaration, readonly, static, deprecated | `src/server/semantic-tokens.ts` |
| 5.2.4 | Create `src/server/folding.ts` — folding range provider | `src/server/folding.ts` |
| 5.2.5 | Add folding for: functions, if/else, while, for, switch, block comments, imports | `src/server/folding.ts` |

**Deliverables**:
- [ ] Semantic highlighting differentiates variables, functions, parameters, types
- [ ] Code folding works for all block structures

---

## Phase 6: Build Task Provider

### Session 6.1: Build Integration

**Reference**: [08-build-integration.md](08-build-integration.md)
**Objective**: Add build task for compiling Blend65 from VS Code

**Tasks**:

| # | Task | File |
|---|------|------|
| 6.1.1 | Add task provider in `src/extension.ts` — detect blend65 projects | `src/extension.ts` |
| 6.1.2 | Create build task that runs `blend65 compile` CLI | `src/extension.ts` |
| 6.1.3 | Parse compiler output for problem matcher integration | `package.json` |

**Deliverables**:
- [ ] `Tasks: Run Build Task` shows Blend65 compile option
- [ ] Build errors appear in Problems panel

---

## Phase 7: Find References & Rename

### Session 7.1: Find References

**Reference**: [07-navigation.md](07-navigation.md)
**Objective**: Implement find all references

**Tasks**:

| # | Task | File |
|---|------|------|
| 7.1.1 | Create `src/server/references.ts` — find references provider | `src/server/references.ts` |
| 7.1.2 | Walk AST to find all identifier expressions matching target symbol | `src/server/references.ts` |
| 7.1.3 | Handle declaration references, usage references, and import references | `src/server/references.ts` |

**Deliverables**:
- [ ] Right-click → "Find All References" lists all usages

---

### Session 7.2: Rename Symbol

**Objective**: Implement rename symbol

**Tasks**:

| # | Task | File |
|---|------|------|
| 7.2.1 | Create `src/server/rename.ts` — rename provider | `src/server/rename.ts` |
| 7.2.2 | Validate rename (can't rename keywords, intrinsics, imports) | `src/server/rename.ts` |
| 7.2.3 | Generate text edits for all references + declaration | `src/server/rename.ts` |

**Deliverables**:
- [ ] F2 renames symbol across the document

---

## Phase 8: Code Formatting & Quick Fixes

### Session 8.1: Document Formatting

**Reference**: [09-formatting-quickfixes.md](09-formatting-quickfixes.md)
**Objective**: Implement code formatter (pretty printer)

**Tasks**:

| # | Task | File |
|---|------|------|
| 8.1.1 | Create `src/server/formatting.ts` — document format provider | `src/server/formatting.ts` |
| 8.1.2 | Implement AST-based pretty printer (indentation, spacing, line breaks) | `src/server/formatting.ts` |
| 8.1.3 | Handle formatting preferences (indent size, brace style) | `src/server/formatting.ts` |

**Deliverables**:
- [ ] Shift+Alt+F formats the document

---

### Session 8.2: Quick Fixes (Code Actions)

**Objective**: Implement common quick fixes

**Tasks**:

| # | Task | File |
|---|------|------|
| 8.2.1 | Create `src/server/code-actions.ts` — code action provider | `src/server/code-actions.ts` |
| 8.2.2 | Quick fix: add missing semicolons | `src/server/code-actions.ts` |
| 8.2.3 | Quick fix: add type annotations | `src/server/code-actions.ts` |
| 8.2.4 | Quick fix: suggest imports for unresolved symbols | `src/server/code-actions.ts` |

**Deliverables**:
- [ ] Yellow lightbulb appears for fixable issues
- [ ] Quick fixes apply correctly

---

## Phase 9: Marketplace Publishing

### Session 9.1: Package & Publish

**Reference**: [10-marketplace.md](10-marketplace.md)
**Objective**: Prepare and publish to VS Code Marketplace

**Tasks**:

| # | Task | File |
|---|------|------|
| 9.1.1 | Write marketplace README.md with features, screenshots, examples | `README.md` |
| 9.1.2 | Create CHANGELOG.md | `CHANGELOG.md` |
| 9.1.3 | Verify icon and gallery banner are present (see TODO.md) | `icon.png` |
| 9.1.4 | Build VSIX package with `vsce package` | terminal |
| 9.1.5 | Test VSIX installation locally | terminal |
| 9.1.6 | Publish to marketplace with `vsce publish` | terminal |

**Deliverables**:
- [ ] VSIX package builds cleanly
- [ ] Extension installable from marketplace
- [ ] README renders correctly on marketplace page

---

## Task Checklist (All Phases)

### Phase 1: Project Setup & Scaffolding
- [ ] 1.1.1 Create package.json with extension manifest
- [ ] 1.1.2 Create tsconfig.json
- [ ] 1.1.3 Create esbuild config
- [ ] 1.1.4 Create .vscodeignore
- [ ] 1.1.5 Add to monorepo workspaces + turbo.json
- [ ] 1.1.6 Create language-configuration.json
- [ ] 1.2.1 Create extension.ts (activation)
- [ ] 1.2.2 Create client.ts (LSP client)
- [ ] 1.2.3 Create server.ts (minimal LSP server)
- [ ] 1.2.4 Create document-manager.ts
- [ ] 1.2.5 Verify extension activates

### Phase 2: Syntax Highlighting
- [ ] 2.1.1 TextMate grammar: comments
- [ ] 2.1.2 TextMate grammar: strings
- [ ] 2.1.3 TextMate grammar: numbers
- [ ] 2.1.4 TextMate grammar: keywords
- [ ] 2.1.5 TextMate grammar: type keywords
- [ ] 2.1.6 TextMate grammar: storage classes + modifiers
- [ ] 2.1.7 TextMate grammar: operators
- [ ] 2.1.8 TextMate grammar: function/enum declarations
- [ ] 2.1.9 TextMate grammar: booleans, intrinsic names
- [ ] 2.2.1 Snippets: module, function, loops, if/else
- [ ] 2.2.2 Snippets: C64-specific (poke, peek, game loop)
- [ ] 2.2.3 Snippets: enum, switch, type alias

### Phase 3: Language Server - Diagnostics
- [ ] 3.1.1 Create diagnostics.ts (compiler integration)
- [ ] 3.1.2 Map compiler diagnostics → LSP diagnostics
- [ ] 3.1.3 Trigger on document change/save
- [ ] 3.1.4 Handle lexer errors
- [ ] 3.1.5 Handle parser errors
- [ ] 3.1.6 Handle semantic errors
- [ ] 3.1.7 Cache analysis results

### Phase 4: IntelliSense (CRITICAL)
- [ ] 4.1.1 Build intrinsics data module (10 intrinsics)
- [ ] 4.1.2 Build asm functions data module (151 functions)
- [ ] 4.1.3 Build hardware constants data module
- [ ] 4.2.1 Create completion.ts
- [ ] 4.2.2 Keyword completions
- [ ] 4.2.3 Type completions
- [ ] 4.2.4 Intrinsic function completions
- [ ] 4.2.5 asm_* function completions
- [ ] 4.2.6 Symbol completions from symbol table
- [ ] 4.2.7 Enum member completions
- [ ] 4.2.8 Storage class completions
- [ ] 4.3.1 Create hover.ts
- [ ] 4.3.2 Variable type hover
- [ ] 4.3.3 Function signature hover
- [ ] 4.3.4 Intrinsic documentation hover
- [ ] 4.3.5 asm_* opcode details hover
- [ ] 4.3.6 Hardware constant description hover
- [ ] 4.3.7 Create signature-help.ts
- [ ] 4.3.8 Function parameter hints
- [ ] 4.3.9 Intrinsic parameter hints

### Phase 5: Navigation
- [ ] 5.1.1 Create definition.ts
- [ ] 5.1.2 Go-to-def for local variables
- [ ] 5.1.3 Go-to-def for functions
- [ ] 5.1.4 Go-to-def for imports (cross-module)
- [ ] 5.1.5 Create symbols.ts
- [ ] 5.1.6 Populate outline view
- [ ] 5.2.1 Create semantic-tokens.ts
- [ ] 5.2.2 Map token types
- [ ] 5.2.3 Map token modifiers
- [ ] 5.2.4 Create folding.ts
- [ ] 5.2.5 Folding ranges for all blocks

### Phase 6: Build Task Provider
- [ ] 6.1.1 Task provider in extension.ts
- [ ] 6.1.2 Build task runs blend65 CLI
- [ ] 6.1.3 Problem matcher for compiler output

### Phase 7: Find References & Rename
- [ ] 7.1.1 Create references.ts
- [ ] 7.1.2 AST walk for identifier matching
- [ ] 7.1.3 Handle declaration + usage + import references
- [ ] 7.2.1 Create rename.ts
- [ ] 7.2.2 Rename validation
- [ ] 7.2.3 Generate text edits

### Phase 8: Code Formatting & Quick Fixes
- [ ] 8.1.1 Create formatting.ts
- [ ] 8.1.2 AST-based pretty printer
- [ ] 8.1.3 Formatting preferences
- [ ] 8.2.1 Create code-actions.ts
- [ ] 8.2.2 Quick fix: missing semicolons
- [ ] 8.2.3 Quick fix: add type annotations
- [ ] 8.2.4 Quick fix: suggest imports

### Phase 9: Marketplace Publishing
- [ ] 9.1.1 Write marketplace README
- [ ] 9.1.2 Create CHANGELOG
- [ ] 9.1.3 Verify icon + banner
- [ ] 9.1.4 Build VSIX
- [ ] 9.1.5 Test VSIX locally
- [ ] 9.1.6 Publish to marketplace

---

## Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Syntax) ←── standalone, no LSP needed
    ↓
Phase 3 (Diagnostics) ←── needs LSP from Phase 1
    ↓
Phase 4 (IntelliSense) ←── needs diagnostics/cache from Phase 3
    ↓
Phase 5 (Navigation) ←── needs symbol table from Phase 3
    ↓                ↘
Phase 6 (Build)       Phase 7 (Refs/Rename) ←── needs AST walk
    ↓                     ↓
Phase 8 (Format/Fix) ←── needs AST, symbol table
    ↓
Phase 9 (Publish) ←── needs all core phases complete
```

## Session Protocol

### Starting a Session
```bash
# 1. Reference this plan
# "Implement Phase X, Session X.X per plans/vscode-extension/99-execution-plan.md"
```

### Ending a Session
```bash
# 1. Verify build passes
# 2. Update this checklist
# 3. Call attempt_completion
# 4. User runs /compact
```

## Success Criteria

**Extension is complete when**:
1. ✅ All Phase 1-5 tasks completed (MVP)
2. ✅ All tests passing
3. ✅ Extension installs and activates correctly
4. ✅ IntelliSense works for intrinsics + asm functions
5. ✅ Diagnostics show compiler errors/warnings
6. ✅ Published to VS Code Marketplace (Phase 9)
