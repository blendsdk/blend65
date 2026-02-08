# Phase 10: Integration, Pipeline & v1 Removal

> **Feature**: Final compiler pipeline integration, asm_* function implementation, CLI migration, and v1 removal
> **Status**: Planning Complete
> **Created**: 2026-08-02
> **Parent Plan**: [Compiler v2 Execution Plan](../99-execution-plan.md)

## Overview

Phase 10 is the **final phase** of the Blend65 compiler-v2 project. It wires together all previously implemented components (Lexer, Parser, Semantic, Frame Allocator, IL Generator, Code Generator, ASM Optimizer) into a unified compilation pipeline, migrates supporting infrastructure from v1, implements all 151 `asm_*()` functions per the v2 language specification, updates the CLI to use v2, and removes v1.

**What this phase delivers:**
- Complete `Compiler` class orchestrating the full pipeline
- Config, Target, and Library loader infrastructure migrated from v1
- Rewritten `system.blend` aligned with v2 specification (10 intrinsics, no sizeof/CPU/stack stubs)
- New `asm.blend` library declaring all 56 6502 opcodes with addressing mode variants (151 function stubs)
- Full IL and codegen support for all `asm_*()` functions
- End-to-end tests proving the complete pipeline works
- CLI updated to import from `@blend65/compiler-v2`
- v1 package removed, v2 renamed to `@blend65/compiler`

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Infrastructure](01-infrastructure.md) | Config types, Target system, Library loader migration |
| 02 | [Library Sync](02-library-sync.md) | system.blend rewrite + hardware.blend audit |
| 03 | [ASM Declarations](03-asm-blend-declarations.md) | New asm.blend with all 151 asm_* stubs |
| 04 | [ASM IL Wiring](04-asm-il-wiring.md) | Wire asm_* functions into IL generator |
| 05 | [ASM CodeGen](05-asm-codegen.md) | Wire asm_* functions into code generator |
| 06 | [Pipeline & Compiler](06-pipeline-compiler.md) | Compiler class, pipeline phases, public API |
| 07 | [E2E Tests](07-e2e-tests.md) | End-to-end pipeline tests |
| 08 | [CLI Update](08-cli-update.md) | Update CLI to use compiler-v2 |
| 09 | [v1 Removal](09-v1-removal.md) | Remove v1, rename v2, fix all references |
| 10 | [Verification](10-verification.md) | Final verification & cleanup |
| 99 | [Execution Plan](99-execution-plan.md) | Master task checklist with all sessions |

## Quick Reference

### Key Decisions

| Decision | Outcome |
|----------|---------|
| asm_* scope | Full implementation: all 56 opcodes, all addressing modes (151 functions) |
| system.blend | Rewrite: remove sizeof, remove CPU/stack ops (they moved to asm_*) |
| Library strategy | Copy v1 structure, create new `common/asm.blend` for asm_* stubs |
| Pipeline approach | Adapt v1 `Compiler` class pattern, use v2 phase implementations |
| v1 removal | Complete removal after CLI migration, rename v2 → compiler |

### V2 Intrinsics (10 core, per spec)

| Intrinsic | Category | Status in v2 |
|-----------|----------|--------------|
| peek | Memory | ✅ IL + Codegen done |
| poke | Memory | ✅ IL + Codegen done |
| peekw | Memory | ✅ IL + Codegen done |
| pokew | Memory | ✅ IL + Codegen done |
| hi | Byte extract | ✅ IL + Codegen done |
| lo | Byte extract | ✅ IL + Codegen done |
| length | Compile-time | ⚠️ IL done, needs library stub |
| barrier | Optimizer | ⚠️ IL done, needs library stub |
| volatile_read | Optimizer | ✅ IL + Codegen done |
| volatile_write | Optimizer | ✅ IL + Codegen done |

### V1 Functions Removed in v2

| v1 Function | v2 Replacement |
|-------------|----------------|
| sizeof() | REMOVED (not in v2 spec) |
| sei() | asm_sei() |
| cli() | asm_cli() |
| nop() | asm_nop() |
| brk() | asm_brk() |
| pha() | asm_pha() |
| pla() | asm_pla() |
| php() | asm_php() |
| plp() | asm_plp() |

## Related Files

### V1 Files to Migrate
- `packages/compiler/src/config/types.ts` → Config type definitions
- `packages/compiler/src/target/` → Target system (architecture, config, registry)
- `packages/compiler/src/library/loader.ts` → Library loader
- `packages/compiler/src/compiler.ts` → Compiler class (adapt for v2)
- `packages/compiler/src/pipeline/types.ts` → Pipeline type definitions
- `packages/compiler/library/common/system.blend` → Rewrite for v2
- `packages/compiler/library/c64/common/hardware.blend` → Audit and copy
- `packages/compiler/src/utils/source-registry.ts` → SourceRegistry (used by CLI formatter)

### V2 Files to Create
- `packages/compiler-v2/src/config/types.ts` → Config types
- `packages/compiler-v2/src/target/` → Target system
- `packages/compiler-v2/src/library/loader.ts` → Library loader
- `packages/compiler-v2/src/compiler.ts` → Compiler class
- `packages/compiler-v2/src/pipeline/` → Pipeline phases and types
- `packages/compiler-v2/library/common/system.blend` → v2 intrinsic stubs
- `packages/compiler-v2/library/common/asm.blend` → asm_* function stubs
- `packages/compiler-v2/library/c64/common/hardware.blend` → C64 hardware constants
- `packages/compiler-v2/library/x16/common/` → X16 target directory (empty, matching v1 structure)
- `packages/compiler-v2/src/utils/source-registry.ts` → SourceRegistry (copy from v1)

### Specification References
- `docs/language-specification-v2/08-intrinsics.md` → 10 core intrinsics
- `docs/language-specification-v2/09-asm-functions.md` → All 56 6502 opcodes with addressing modes
