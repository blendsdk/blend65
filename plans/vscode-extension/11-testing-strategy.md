# Testing Strategy

> **Document**: 11-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Status**: Complete

## Overview

The extension testing strategy covers three layers: unit tests for server logic, integration tests for the LSP protocol, and manual E2E tests for the full VS Code experience.

## Test Categories

### Unit Tests (Vitest)

Test server-side logic in isolation, without VS Code or LSP:

| Test Area | Description | Files |
|-----------|-------------|-------|
| Diagnostic mapping | Compiler diags → LSP diags | `__tests__/diagnostics.test.ts` |
| Completion generation | Symbol table → CompletionItems | `__tests__/completion.test.ts` |
| Hover content | Symbol/intrinsic → MarkupContent | `__tests__/hover.test.ts` |
| Document symbols | AST → DocumentSymbol[] | `__tests__/symbols.test.ts` |
| Signature help | Call expression → SignatureInformation | `__tests__/signature-help.test.ts` |
| Definition lookup | Position → Location | `__tests__/definition.test.ts` |
| Intrinsic data | All 10 intrinsics have complete data | `__tests__/data/intrinsics.test.ts` |
| ASM function data | All 151 asm_* have complete data | `__tests__/data/asm-functions.test.ts` |
| Position mapping | Compiler 1-indexed → LSP 0-indexed | `__tests__/utils.test.ts` |
| Document manager | Cache lifecycle, invalidation | `__tests__/document-manager.test.ts` |

**Test approach:** Create Blend65 source strings, run them through the compiler pipeline, then verify the server logic produces correct LSP responses.

### Integration Tests (LSP Protocol)

Test the full LSP request/response cycle using `vscode-languageserver-protocol`:

| Test | Description |
|------|-------------|
| Initialize handshake | Server returns correct capabilities |
| Document open → diagnostics | Opening a file triggers diagnostics |
| Document change → updated diagnostics | Editing triggers re-analysis |
| Completion request | Returns correct items for context |
| Hover request | Returns markdown content |
| Definition request | Returns correct location |
| Format request | Returns correctly formatted text |

**Test approach:** Spawn the server process, send LSP JSON-RPC messages, verify responses match expected structure.

### Manual E2E Tests

Test the full VS Code experience (not automated — manual checklist):

| Test | Steps | Expected |
|------|-------|----------|
| Activation | Open `.blend` file | Extension activates, syntax coloring appears |
| Syntax highlighting | Open `examples/snake-game/hardware.blend` | All tokens correctly colored |
| Autocomplete | Type `pe` inside function body | `peek`, `poke`, `peekw`, `pokew` appear |
| Intrinsic hover | Hover over `poke` call | See signature, description, cycle cost |
| ASM function hover | Hover over `asm_sei()` | See 6502 mnemonic, flags, cycles |
| Diagnostics | Write `let x: byte = "hello";` | Red squiggle, type mismatch error |
| Go-to-definition | Ctrl+click on function call | Jumps to function declaration |
| Outline view | Open file with functions, enums | Outline sidebar shows symbol tree |
| Snippets | Type `main` + Tab | Inserts `export function main(): void { }` |
| Signature help | Type `poke(` | Parameter hint popup appears |
| Number hover | Hover over `$D020` | Shows decimal: 53280, binary |

## TextMate Grammar Tests

Test the grammar with VS Code's built-in grammar test framework:

```
tests/syntaxes/
├── blend.test.blend             # Test source file
└── blend.test.blend.snap        # Expected scope snapshot
```

Verify scopes for:
- All keyword categories (module, control flow, declaration, etc.)
- All number formats (`$hex`, `0xhex`, `0bbinary`, decimal)
- String literals with escape sequences
- Storage classes (`@zp`, `@ram`, `@data`)
- Intrinsic function names
- ASM function pattern (`asm_*`)
- Comments (line and block)
- Operators (all categories)

## Test Data

### Fixture Files

Create test `.blend` files covering all language constructs:

```
tests/fixtures/
├── minimal.blend         # Simplest valid program (module + main)
├── all-keywords.blend    # Uses every keyword
├── all-types.blend       # Uses every type (byte, word, void, etc.)
├── all-operators.blend   # Uses every operator
├── functions.blend       # Functions, params, return types
├── control-flow.blend    # if, while, for, switch, do-while
├── enums.blend           # Enum declarations and member access
├── imports.blend         # Module system (import/export)
├── intrinsics.blend      # All 10 intrinsics
├── asm-functions.blend   # Common asm_* functions
├── error-cases.blend     # Known error patterns for diagnostic testing
└── snake-game.blend      # Real-world example (copy of examples/)
```

## Coverage Goals

| Category | Target | Metric |
|----------|--------|--------|
| Data modules (intrinsics, asm) | 100% | Every entry has all required fields |
| Diagnostic mapping | 95%+ | All severity levels, position offsets |
| Completion | 90%+ | Keywords, types, symbols, intrinsics |
| Hover | 90%+ | Variables, functions, intrinsics, asm_* |
| TextMate grammar | 100% scopes | Every scope name verified |

## Test Commands

```bash
# Run all extension tests
cd packages/vscode-blend65
yarn test

# Run specific test file
yarn test -- --grep "completion"

# Run with coverage
yarn test -- --coverage
```

## Verification Checklist (Per Phase)

After implementing each phase, verify:

- [ ] All new unit tests pass
- [ ] No regressions in existing tests
- [ ] Manual E2E test for the feature works
- [ ] TextMate grammar tests pass (if syntax changes)
- [ ] Extension builds without errors (`yarn build`)
- [ ] Extension installs from VSIX cleanly
