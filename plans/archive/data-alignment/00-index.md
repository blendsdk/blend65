# Data Alignment Feature Implementation Plan

> **Feature**: `@data(align: N)` core + semantic sugar (`@sprite`, `@charset`, etc.)
> **Status**: Planning Complete
> **Created**: 2025-02-15

## Overview

Add memory alignment support for `@data` and `@ram` storage classes, enabling the VIC-II
(and other hardware) to read data directly from the binary without runtime copying.

**Two-layer architecture:**
- **Layer 1 (Core):** `@data(align: N)` / `@ram(align: N)` — raw alignment with any power-of-2 value
- **Layer 2 (Sugar):** `@sprite`, `@charset`, `@screen`, `@bitmap`, `@page` — semantic names that desugar to Layer 1

Both layers produce the same AST and emit `!align` ACME directives in the assembly output.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current @data implementation |
| 03 | [Lexer & Parser](03-lexer-parser.md) | Parsing `@data(align: N)` and sugar keywords |
| 04 | [AST & Semantic](04-ast-semantic.md) | AST changes and semantic validation |
| 05 | [Frame & Emitter](05-frame-emitter.md) | Global allocator + ACME `!align` emission |
| 06 | [Language Spec](06-language-spec.md) | Language specification updates |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 08 | [Examples](08-examples.md) | Blend example programs |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Alignment syntax | `@data(align: N)` for core, `@sprite` etc. for sugar |
| Desugaring location | Parser level — sugar becomes align value immediately |
| ACME directive | `!align (N-1), 0` before data label |
| Validation | N must be power-of-2, range 2–16384 |
| Apply to @ram too? | Yes — `@ram(align: N)` for DMA buffers |

## Related Files

- `packages/compiler/src/lexer/` — New tokens for sugar keywords
- `packages/compiler/src/parser/` — Parse alignment parameter
- `packages/compiler/src/ast/` — Add alignment field to declarations
- `packages/compiler/src/semantic/` — Validate alignment values
- `packages/compiler/src/frame/` — Pass alignment through to emitter
- `packages/compiler/src/codegen/` — Emit `!align` directive
- `docs/language-specification-v2/03-variables.md` — Update spec
