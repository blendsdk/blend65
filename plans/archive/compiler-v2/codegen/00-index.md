# Code Generator Implementation Plan

> **Feature**: Code Generator (IL → 6502 Assembly)
> **Status**: Planning Complete
> **Created**: 2026-04-02
> **Parent**: [Compiler v2 Index](../00-index.md)

## Overview

The Code Generator transforms the Intermediate Language (IL) produced by the IL Generator into 6502 assembly code. This is the final compilation stage before optimization and emission.

**Key Characteristics:**
- **Direct Mapping**: Each IL opcode maps to 1-3 6502 instructions
- **No Register Allocation**: Variables have static addresses (SFA)
- **Accumulator-Centric**: Matches the IL design and 6502 architecture
- **Simple & Correct**: Prioritize correctness over clever optimizations

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | What the codegen must do |
| 02 | [Architecture](02-architecture.md) | Design decisions, ASM-IL output |
| 03 | [IL Opcode Mapping](03-il-opcode-mapping.md) | Every IL opcode → 6502 pattern |
| 04 | [Intrinsics CodeGen](04-intrinsics-codegen.md) | peek/poke/hi/lo code generation |
| 05 | [Runtime Routines](05-runtime-routines.md) | __mul8, __div8, __mod8 implementations |
| 06 | [Entry & Exit](06-entry-exit.md) | BASIC stub, main entry, RTS exit |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test categories and coverage goals |
| 08 | [ASM-IL Emitter](08-emitter.md) | Converting ASM-IL to ACME assembler text |
| 99 | [Execution Plan](99-execution-plan.md) | Granular session/task breakdown |

## Quick Reference

### Pipeline Position

```
Source → Lexer → Parser → Semantic → Frame → IL Generator → [CODE GENERATOR] → ASM-IL → Optimizer → Emitter
```

### Input/Output

| Item | Format |
|------|--------|
| **Input** | `ILProgram` (functions + instructions + frames) |
| **Output** | `AsmILProgram` (6502 assembly instructions) |

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Output Format | ASM-IL intermediate | Enables optimization passes before final emit |
| Addressing | ZP/ABS based on slot | Frame allocator determines optimal addressing |
| Accumulator Tracking | Yes | Eliminates redundant loads |
| Branch Handling | Direct BEQ/BNE/etc | Simple, optimizer can fix long branches |

## Related Files

**Source Files:**
- `packages/compiler-v2/src/codegen/generator.ts` (main)
- `packages/compiler-v2/src/codegen/types.ts`
- `packages/compiler-v2/src/codegen/intrinsics.ts`
- `packages/compiler-v2/src/codegen/runtime.ts`
- `packages/compiler-v2/src/codegen/index.ts`

**Test Files:**
- `packages/compiler-v2/src/__tests__/codegen/` (all test categories)

## Success Criteria

1. ✅ All ~50 IL opcodes generate correct 6502 code
2. ✅ Intrinsics generate optimal code
3. ✅ Runtime routines work correctly
4. ✅ Entry/exit follows standard C64 pattern
5. ✅ 875+ tests pass
6. ✅ End-to-end pipeline works
7. ✅ Ready for ASM-IL optimizer phase