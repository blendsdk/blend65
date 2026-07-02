# RD-09: ACME Emitter & Assembler Integration — Implementation Plan

> **Feature**: Serialize the `InstrProgram` to ACME `.asm` text and drive ACME to a platform binary
> **Implements**: RD-09
> **Status**: Planning Complete
> **Created**: 2026-06-10

## Overview

RD-09 is the **final compiler stage**: it turns the structured `InstrProgram` (produced by
RD-07 codegen and passed through the RD-08 peephole stage) into a runnable platform binary.
It has two halves:

1. **Emitter** — a single canonical serializer, `serializeToAcme(program)`, that renders the
   whole `InstrProgram` (symbol definitions, preamble, code streams, const-data streams) to
   one deterministic `.asm` file. The same function powers `--emit-asm` and the build feed to
   ACME, so the developer-inspectable output and the assembler input can never drift
   (AR-60/AR-63).

2. **Assembler integration** — discover the external ACME executable (explicit → PATH → hard
   error), invoke it as a child process, capture the binary + VICE label file, parse the label
   file into a symbol→address map, and run the post-ACME binary-size budget check. An ACME
   failure is by definition an internal compiler error (AR-68), because every `Instr` is
   CPU-validated and every address is compiler-assigned before this stage.

Much of the per-entry rendering already exists: `printInstr` (RD-07a, `print-instr.ts`) is the
canonical per-stream serializer, and `assembleProgram` (RD-07c) already fills the platform
preamble. RD-09 adds the **whole-program orchestration** (`serializeToAcme`) and the **process
layer** in `@blend65/compiler`.

## Document Index

| #   | Document                                                   | Description                                  |
| --- | ---------------------------------------------------------- | -------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)             | Zero-Ambiguity Gate decisions (AR-94 runtime) |
| 00  | [Index](00-index.md)                                       | This document — overview and navigation       |
| 01  | [Requirements](01-requirements.md)                         | Feature requirements and scope                |
| 02  | [Current State](02-current-state.md)                       | Analysis of existing code RD-09 builds on     |
| 03-01 | [Whole-Program Serializer](03-01-serializer.md)          | `serializeToAcme` spec (`@blend65/codegen`)    |
| 03-02 | [ACME Process Layer](03-02-acme-process-layer.md)       | discovery, invocation, label parsing, budget   |
| 07  | [Testing Strategy](07-testing-strategy.md)                 | Specification test cases (ST-*) + verification |
| 99  | [Execution Plan](99-execution-plan.md)                     | Phases, sessions, and task checklist           |

## Quick Reference

### Usage (internal API, not user-facing)

```typescript
// @blend65/codegen — pure, deterministic, golden-testable
const asm: string = serializeToAcme(program); // InstrProgram → ACME .asm text

// @blend65/compiler — process layer
const result: BuildResult = await emitBinary(program, { acmePath, outDir, emitAsmOnly });
```

### Key Decisions

| Decision | Outcome | AR Ref |
| -------- | ------- | ------ |
| Symbol-def source | Verbatim from `allocationPlan.symbolDefinitions` under one header (1A) | AR-94 |
| Segment mapping | `code → data`, skip `zp`, no `bss` until mutable-data lowering (2A) | AR-94 |
| Per-entry rendering | Reuse existing `printInstr` (no re-implementation) | AR-60 / D4 |
| Assembler | ACME exclusively, no pluggable backend | AR-61 |
| ACME discovery | explicit `--acme-path`/`acmePath` → PATH → hard error | AR-62 |
| ACME failure | Internal compiler error (`E9xxxx` ICE), retain `.asm` | AR-68 |

## Related Files

**Created:**
- `packages/codegen/src/instr/serialize-acme.ts` — `serializeToAcme`
- `packages/codegen/src/instr/serialize-acme.spec.test.ts` / `.impl.test.ts`
- `packages/compiler/src/acme/discover-acme.ts`, `invoke-acme.ts`, `label-file.ts`, `emit-binary.ts`
- co-located `*.spec.test.ts` / `*.impl.test.ts` for each

**Reused (not modified):**
- `packages/codegen/src/instr/print-instr.ts` — `printInstr`, `instrByteSize`
- `packages/codegen/src/instr/instr-program.ts` — `InstrProgram`, `programByteSize`
