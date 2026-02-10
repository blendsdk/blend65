# Global Variables & Storage Classes Implementation Plan

> **Feature**: Complete global variable support with `@zp`, `@ram`, `@data` storage classes
> **Status**: Planning Complete
> **Created**: 2026-02-09
> **Dependency**: After optimizer-v2 Phase 4 is complete

## Overview

This plan implements complete support for module-level global variables with storage class directives (`@zp`, `@ram`, `@data`). Currently, the compiler's parser correctly accepts these directives, but the downstream pipeline (frame allocation, IL generation, codegen) has incomplete support for module-level globals — they only handle function-local variables.

This plan closes the "Phase 7c" gap in the IL generator and adds:
- Global variable address allocation (ZP, RAM, data segment)
- Cross-module `@zp` export/import support
- `@data` data segment for static initialized data (sprites, sin tables, music)
- Optimizer protection for `@zp` globals (volatile, pinned)
- Complete IL and codegen for global variable access
- Extreme testing (~140+ tests)

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation gaps |
| 03 | [Global Allocator](03-global-allocator.md) | Global variable address allocation design |
| 04 | [Data Segment](04-data-segment.md) | `@data` data segment implementation |
| 05 | [IL Generator Globals](05-il-generator-globals.md) | IL generation for global variables ("Phase 7c") |
| 06 | [Codegen Globals](06-codegen-globals.md) | 6502 code generation for global access |
| 07 | [Optimizer Protection](07-optimizer-protection.md) | Optimizer protection for `@zp`/`@data` globals |
| 08 | [Testing Strategy](08-testing-strategy.md) | Extreme testing plan (~140+ tests) |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Storage Class Rules (Final)

| Storage Class | Module Level | Inside Functions | Purpose |
|:---:|:---:|:---:|---|
| `@zp` | ✅ Allowed | ❌ Blocked | Force zero page, volatile, optimizer-proof |
| `@ram` | ✅ Allowed | ❌ Blocked | Explicit RAM, prevent ZP auto-promotion |
| `@data` | ✅ Allowed | ❌ Blocked | Static data segment (sprites, tables, music) |
| *(none)* | ✅ Default=RAM | ✅ Auto-scored | Compiler decides (locals); RAM default (globals) |

### Key Decisions

| Decision | Outcome |
|----------|---------|
| `@zp`/`@ram`/`@data` inside functions? | NO — auto-scoring handles locals |
| `@zp` globals volatile? | YES — can be modified by interrupts |
| `@zp` globals optimizer-proof? | YES — never eliminated, never cached |
| `@data` requires `const`? | YES — static initialized data is immutable |
| `@data` requires initializer? | YES — uninitialized data segment makes no sense |
| Cross-module `@zp` exports? | YES — ZP address shared via GlobalSymbolTable |
| Language spec update? | YES — section 03-variables.md |

## Memory Layout (C64)

```
$0002-$008F   Zero Page (@zp globals + auto-scored locals)
$0200-$03FF   Frame Region (function locals/params)
$0801         BASIC SYS stub
$080D-$xxxx   Code Segment (functions)
$xxxx-$yyyy   Global RAM (@ram globals, default globals)
$yyyy-$zzzz   Data Segment (@data const blocks)
```

## Related Files

### Will Be Modified
- `packages/compiler/src/frame/allocator/frame-allocator.ts` — extend for globals
- `packages/compiler/src/frame/allocator/frame-calculator.ts` — global slot creation
- `packages/compiler/src/frame/enums.ts` — add Data directive
- `packages/compiler/src/semantic/visitors/symbol-table-builder.ts` — store all storage class metadata
- `packages/compiler/src/semantic/global-symbol-table.ts` — carry ZP addresses
- `packages/compiler/src/il/generator/generator.ts` — complete Phase 7c
- `packages/compiler/src/il/generator/expressions.ts` — global variable references
- `packages/compiler/src/codegen/generator/base.ts` — global addressing modes
- `packages/compiler/src/optimizer/passes/dead-global-elim.ts` — @zp protection
- `packages/compiler/src/pipeline/frame-phase.ts` — global allocation integration

### Will Be Created
- Global allocator class (new file in `frame/allocator/`)
- Data segment builder (new file in `codegen/`)
- ~140+ test files across multiple test directories
