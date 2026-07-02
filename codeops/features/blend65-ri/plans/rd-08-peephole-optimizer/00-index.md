# RD-08 Peephole Optimizer (passthrough v1) — Implementation Plan

> **Feature**: The peephole optimizer stage — v1 thin passthrough between codegen (RD-07) and
>   the ACME emitter (RD-09).
> **Implements**: RD-08
> **Status**: Planning Complete
> **Created**: 2026-06-10
> **CodeOps Version**: see repo `package.json`

## Overview

RD-08 adds the **peephole optimizer** stage to the Blend65 back end. It sits between codegen
(`generateInstr`/`assembleProgram`, RD-07b/07c) and the ACME emitter (RD-09): it consumes an
`InstrProgram` and produces an `InstrProgram` for the emitter. In v1 it is a deliberate
**thin passthrough** — it validates the program's structure and returns it unchanged. This
completes the `Instr` pipeline so RD-09 (whose declared dependencies are RD-07, **RD-08**,
RD-10) is unblocked, while real optimization remains a Phase-B concern.

The implementation mirrors the already-shipped IL optimizer seam (`optimizeIL(program, [],
bag)` — an identity passthrough with an empty pass list). The public entry point is
`optimizeInstr(program, cpuVariant, bag, options?)`, threading the **bare `CpuVariant`
primitive** exactly like `generateInstr`/`validateStream` (no `PlatformProfile`). The
sliding-window scanner, rule plumbing, iteration limit, and ICE are **not** built in v1 — they
land with the first real rule (rules milestone), keeping v1 free of unreachable code.

All decisions trace to the RD-08 preflight resolutions (`requirements/00-preflight-report.md`,
PF-001..PF-009) and the frozen ARs cited inline in `requirements/RD-08-peephole-optimizer.md`.

## Document Index

| #   | Document | Description |
| --- | -------- | ----------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Gate decisions (audit trail, carried from preflight) |
| 00  | [Index](00-index.md) | This document — overview and navigation |
| 01  | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02  | [Current State](02-current-state.md) | Analysis of the shipped back end |
| 03  | [Peephole Passthrough](03-01-peephole-passthrough.md) | Technical spec: types, `optimizeInstr`, structural validation |
| 07  | [Testing Strategy](07-testing-strategy.md) | Spec test cases (ST-*) mapped to ACs |
| 99  | [Execution Plan](99-execution-plan.md) | Phases, sessions, task checklist |

## Quick Reference

### Usage Example (the v1 public surface)

```typescript
import { generateInstr, optimizeInstr } from "@blend65/codegen";
import type { CpuVariant, DiagnosticBag } from "@blend65/core";

declare const ilProgram: import("@blend65/codegen").ILProgram;
declare const cpu: CpuVariant;       // e.g. "nmos6502" (c64) or "wdc65c02" (cx16)
declare const bag: DiagnosticBag;

const program = generateInstr(ilProgram, cpu, bag);
// v1: optimized === structurally identical to `program` (byte-identical serialization)
const optimized = optimizeInstr(program, cpu, bag);
// `optimized` then flows to the RD-09 ACME emitter
```

### Key Decisions

| Decision | Outcome | Source |
| -------- | ------- | ------ |
| v1 scope | THIN PASSTHROUGH — validate structure, return unchanged | Preflight keystone |
| Signature | `optimizeInstr(program, cpuVariant, bag, options?)` — bare `CpuVariant` | PF-001/PF-003 |
| `CpuVariant` | Import canonical `"nmos6502" \| "wdc65c02"` from `@blend65/core` | PF-002 |
| Preamble/plan | `preamble` + `allocationPlan` pass through verbatim | PF-004 |
| Scanner/limit/ICE | Deferred to rules milestone (no dead code in v1) | PF-005/PF-009 |
| Structural check | Enumerated predicates; opcode legality stays with `validateStream` | PF-006 |
| Stats channel | v1 returns only `InstrProgram`; stats = Phase-B seam | PF-007 |

## Related Files

**New (created by this plan):**
- `packages/codegen/src/instr/peephole.ts` — `PeepholeRule`, `PeepholeOptions`, `optimizeInstr`, `validateProgramStructure`, internal `V1_RULES`.
- `packages/codegen/src/instr/peephole.spec.test.ts` — specification tests (ST-*).
- `packages/codegen/src/instr/peephole.impl.test.ts` — implementation/edge-case tests.

**Modified:**
- `packages/codegen/src/instr/index.ts` — re-export the peephole surface.
- `plans/ROADMAP.md` — Plan dir cell + (on completion) status/Current Position.
