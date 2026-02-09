# Current State: Fix 22 Skipped Tests

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing 22 Skipped Tests by File

### File 1: `codegen/e2e/intrinsics.test.ts` (4 it.todo)

| Test | Gap Label |
|------|-----------|
| should compile peek() reading from hardware register | IL generator gap: address operand |
| should compile poke() writing to hardware register | IL generator gap: address operand |
| should compile peekw() reading word from memory | IL generator gap: address operand |
| should compile pokew() writing word to memory | IL generator gap: address operand |

**Status**: Pipeline WORKS ✅ — IL generator `tryResolveConstantAddress` now provides address operands

### File 2: `codegen/e2e/emit.test.ts` (2 it.todo)

| Test | Gap Label |
|------|-----------|
| should emit STA for poke intrinsic | IL generator gap: address operand |
| should emit LDA for peek intrinsic | IL generator gap: address operand |

**Status**: Pipeline WORKS ✅

### File 3: `e2e/pipeline/intrinsics.test.ts` (9 it.todo)

| Test | Gap Label |
|------|-----------|
| should compile peek with hex address literal | codegen gap: address operand |
| should compile peek with decimal address | codegen gap: address operand |
| should compile peek used in assignment inside function | codegen gap: address operand |
| should compile poke with variable value | codegen gap: address operand |
| should compile multiple poke calls | codegen gap: address operand |
| should compile peekw with hex address | codegen gap: address operand |
| should compile peekw with zero-page address | codegen gap: address operand |
| should compile pokew with address and value | codegen gap: address operand |
| should compile volatile_read with address | codegen gap: address operand |

**Status**: Pipeline WORKS ✅

### File 4: `codegen/e2e/simple-programs.test.ts` (2 it.todo)

| Test | Gap Label |
|------|-----------|
| should compile shift left operation | IL generator gap: SHL_BYTE not emitted |
| should compile shift right operation | IL generator gap: SHR_BYTE not emitted |

**Status**: Pipeline WORKS ✅ — complex operand fallback path handles shifts

### File 5: `e2e/pipeline/simple-programs.test.ts` (1 it.todo)

| Test | Gap Label |
|------|-----------|
| should compile mixed arithmetic with precedence | codegen gap: 3-variable slot operand |

**Status**: Pipeline WORKS ✅

### File 6: `semantic/edge-cases/control-flow/break-continue.test.ts` (2 it.skip)

| Test | Gap Label |
|------|-----------|
| should error on break at module level | GAP: parser silently drops it |
| should error on continue at module level | GAP: parser silently drops it |

**Status**: REAL GAP ❌ — parser silently drops break/continue at module level

### File 7: `e2e/pipeline/multi-module.test.ts` (2 it.todo)

| Test | Gap Label |
|------|-----------|
| should compile functions across multiple files | gap: frame allocator cross-file |
| should generate combined assembly from functions in separate files | gap: cross-file frame allocation |

**Status**: REAL GAP ❌ — FramePhase only processes primary module

## Root Cause: Frame Allocator Single-Module Limitation

`FramePhase.execute()` in `pipeline/frame-phase.ts`:
1. Finds primary module (with `export function main()`)
2. Calls `allocator.allocate(moduleResult.ast, ...)` with ONLY that module's AST
3. Functions in other files get no frames → IL generator throws "No frame for function"

**Fix**: Iterate all modules in `FramePhase.execute()`, collect functions from every module.

## Root Cause: Parser Module-Level Break/Continue

The parser's module-level parsing doesn't recognize `break`/`continue` as valid tokens.
Instead of creating an error node or reporting a diagnostic, it silently skips them
via error recovery.

**Fix**: Parser must recognize break/continue at module scope and emit a diagnostic.
