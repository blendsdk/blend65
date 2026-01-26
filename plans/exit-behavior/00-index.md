# Exit Behavior Implementation Plan

> **Feature**: Program exit behavior configuration (`exitBehavior`)
> **Status**: Planning Complete
> **Created**: 2026-01-26

## Overview

This feature adds a configurable exit behavior option to the Blend65 compiler, allowing users to control what happens when the main function returns.

Currently, the compiler generates an infinite loop after `main()` returns. This is safe but prevents returning to BASIC. The new option will support three behaviors:
- `loop` - Infinite loop (current behavior, safe default)
- `basic` - Return to BASIC READY prompt (useful for tools/utilities)
- `reset` - Soft system reset (clean restart)

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [Config Types](03-config-types.md) | Type definitions for exitBehavior |
| 04 | [CLI Integration](04-cli-integration.md) | CLI option implementation |
| 05 | [Code Generator](05-code-generator.md) | Exit code generation |
| 06 | [Testing Strategy](06-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Usage Examples

**CLI:**
```bash
blend65 build main.blend --exit-behavior=basic
blend65 build main.blend --exit-behavior=loop
blend65 build main.blend --exit-behavior=reset
```

**blend65.json:**
```json
{
  "compilerOptions": {
    "target": "c64",
    "exitBehavior": "basic"
  }
}
```

**Generated Assembly:**
```asm
; exitBehavior: 'loop' (current default)
.end_0001:
  JMP .end_0001               ; Infinite loop

; exitBehavior: 'basic'
  JMP $A474                   ; Return to BASIC warm start

; exitBehavior: 'reset'
  JMP $FCE2                   ; Soft reset
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Default value | `loop` (backward compatible, safest) |
| CLI flag name | `--exit-behavior` (explicit, matches config) |
| Valid values | `loop`, `basic`, `reset` |

## Related Files

**Configuration:**
- `packages/compiler/src/config/types.ts` - Add `ExitBehavior` type
- `packages/cli/src/commands/build.ts` - Add CLI option

**Code Generation:**
- `packages/compiler/src/codegen/code-generator.ts` - Exit behavior implementation
- `packages/compiler/src/codegen/types.ts` - Add `exitBehavior` to `CodegenOptions`

**Tests:**
- `packages/compiler/src/__tests__/codegen/code-generator.test.ts` - Unit tests
- `packages/cli/src/__tests__/cli.test.ts` - CLI option tests