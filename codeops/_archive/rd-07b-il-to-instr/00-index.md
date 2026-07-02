# RD-07b IL→Instr Translation, Register Binding & `generateInstr` — Implementation Plan

> **Feature**: Implement the **consumer-coupled** half of the 6502 code generator that
> RD-07a's stable core was built to serve: the **IL→`Instr` translator** (every IL op the
> live RD-06 lowering emits → real 6502 instruction sequences), **register binding** (IL
> virtual temps → A/X/Y + ZP scratch from the carried `AllocationPlan`), the **`InstrProgram`
> container**, and the top-level **`generateInstr(ilProgram, cpuVariant, bag)`** entry point.
> Scoped as a **slice matching RD-06's live lowering** (D1): ops the live lowering does not
> yet emit, and the RD-10 platform-hook seam (R46–R49), are deferred to **RD-07c**. All
> artifacts extend `@blend65/codegen/src/instr/` (consuming RD-07a's model + `il/` read-only).
> Implements RD-07 R17–R45 (live subset), R50–R51, R55–R61 (slice), and frozen spec Ch 04
> §3 (arithmetic/mul/div cost), Ch 06 §6–§7 (return convention) for the translated ops.
> **Status**: 🟡 Planned (authoring complete; awaiting execution)

> **Created**: 2026-06-06
> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01..RD-07a)
> **Source**: [RD-07](../../requirements/RD-07-codegen-instr.md) · [RD-07a plan](../rd-07a-instr-model/00-index.md) · spec Ch 04/06 · master register AR-46–AR-50/AR-72

## Overview

RD-07a shipped the **stable, zero-throwaway core** of RD-07 (the `Instr`/`Label`/`Directive`
model, the NMOS-6502 CPU validation table + validator, and the canonical ACME serializer),
taking a `cpuVariant` primitive. RD-07b is the **consumer-coupled remainder** — the logic
that *produces* `Instr` streams from real IL and assembles them into a program.

Per RD-07's own banner, that remainder lands *"once RD-10 (`PlatformProfile`) and RD-06's
full lowering land."* Neither is ready: **RD-10 does not exist** (`@blend65/platforms` is an
empty stub; the only `PlatformProfile` is the interim core stub marked `DEFERRED(RD-10)`), and
**RD-06's lowering is a gate/slice-2 walking skeleton**. This is precisely the AR-38
"feature between two unfinished stages" situation the project already resolved for
RD-04→RD-04b, RD-11→RD-11a, and RD-07→RD-07a/07b. The user selected the **slice** path (D1):

This plan builds the consumer-coupled logic **for the live lowering set only**, end-to-end
verifiable from real `.blend` source (RD-02 → RD-03 → RD-04 → RD-05 → RD-06 → **RD-07b** →
`printInstr`):

1. **IL→`Instr` translation** (R17–R28, R32; D3/D4/D5) — for the ops `lowerToIL` emits today:
   `load`/`store`/`const`, the arithmetic (`add`/`sub`/`mul`/`div`/`mod`), bitwise/shift
   (`and`/`or`/`xor`/`shl`/`shr`), and comparison (`eq`/`ne`/`lt`/`le`/`gt`/`ge`) binary
   families, and the `ret` terminator — at **both** widths (8/16-bit), with mul/div/mod
   call-site codegen (fold / shift / `JSR __rt_*` + cost warning). Every other IL op hits an
   `E90001` ICE default arm and is deferred to RD-07c.
2. **Register binding** (R40–R45) — a linear-scan binder mapping IL virtual temps to A/X/Y +
   ZP scratch (`category: "temp"` runs from the carried `AllocationPlan`), with per-block
   register-state tracking that suppresses redundant loads and resets at block boundaries.
3. **`InstrProgram` + `generateInstr`** (R55–R61, slice) — the program container (empty
   `preamble`, deferred to RD-07c) and the `(ilProgram, cpuVariant, bag) → InstrProgram`
   entry point that drives translation per function, runs RD-07a `validateStream` over each
   emitted stream (R61), skips IL-less functions (R59), and propagates source spans (R50/R51).

Taking only a `cpuVariant` primitive (D2) — the `AllocationPlan` is already carried inside
`ILProgram.allocationPlan` — means **no fabricated `PlatformProfile`** is created and nothing
built here is reworked when RD-10 lands (the caller passes `profile.cpuVariant` additively).

Following the AR-20 frontend/backend boundary, all RD-07b artifacts live in
`@blend65/codegen`; the language-server must never import codegen (R15/AR-20). The frozen
`spec/` is never touched; the RD-07a `instr/` model, the RD-06 `il/` model, and the core
`Diagnostic`/`DiagnosticBag`/`SourceSpan`/`IceCode`/`AllocationPlan` records are **consumed,
never modified**.

> **D1/D2 (load-bearing):** RD-07b is a **slice**, not the whole RD-07 remainder. What is
> deferred to **RD-07c** is: the IL ops no live lowering emits (`neg`/`not`, indexed/indirect
> memory, `copy`, `call`, `intrinsic`, the `br`/`brcond`/`unreachable` terminators), the
> platform codegen-hook seam (R46–R49, blocked on RD-10), and the `InstrProgram` platform
> preamble. RD-07b's `generateInstr` takes `cpuVariant`, not a `PlatformProfile` — when RD-10
> lands, only the *caller* changes.

## Document Index

| #     | Document                                                              | Description                                                                 |
| ----- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AR    | [Ambiguity Register](00-ambiguity-register.md)                       | Plan-level Zero-Ambiguity Gate decisions (D1–D8)                            |
| 00    | [Index](00-index.md)                                                 | This document — overview and navigation                                      |
| 01    | [Requirements](01-requirements.md)                                   | In-scope (live-lowering translation + binding + `generateInstr`) vs deferred (RD-07c); R/AC mapping |
| 02    | [Current State](02-current-state.md)                                 | As-built RD-07a model + RD-06 live IL + RD-05 plan the translator builds on; the absent RD-10 gap |
| 03-01 | [IL→Instr Translation](03-01-il-to-instr-translation.md)            | Per-op translation rules (load/store/const, arithmetic/bitwise/comparison, ret), both widths, mul/div/mod call-site |
| 03-02 | [Register Binding](03-02-register-binding.md)                        | Linear-scan temp→A/X/Y+ZP binder, register-state tracking, block-boundary reset, spills |
| 03-03 | [`InstrProgram` & `generateInstr`](03-03-instr-program-and-generate.md) | Program container, the entry point, per-stream validation, span propagation, resource bytes |
| 07    | [Testing Strategy](07-testing-strategy.md)                           | Spec/impl test cases (ST-*) incl. golden ACME-text snapshots from real IL    |
| 99    | [Execution Plan](99-execution-plan.md)                               | Phases, sessions, and master task checklist                                 |

## Quick Reference

### Key Decisions

| Decision                                  | Outcome                                                                              | Ref   |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | ----- |
| Build strategy                            | **Slice matching RD-06's live lowering**; defer not-yet-lowered ops + RD-10 hooks to RD-07c | D1    |
| Entry-point signature (RD-10 absent)      | **`generateInstr(ilProgram, cpuVariant, bag)`** — `cpuVariant` primitive; `AllocationPlan` read from `ilProgram` | D2    |
| Translation set                           | **Live set only** (`load`/`store`/`const`, binary arith/bitwise/cmp, `ret`); **ICE-default** the rest | D3    |
| mul / div / mod                           | **Call-site codegen now** (fold / shift / `JSR __rt_*` + W10170/71/72); routine bodies are RD-17 | D4    |
| Operand width                             | **Both 8- and 16-bit** for in-scope ops, driven by the operand `ILType`              | D5    |
| Module layout                             | **Extend `instr/`** (`translate.ts`/`register-binding.ts`/`instr-program.ts`); consume `il/` read-only | D6    |
| Diagnostics                               | **Reuse `IceCode.Unexpected` (E90001)** for deferred-op + post-translation validation; existing W-codes | D7    |
| Commit mode                               | `--no-commit`                                                                        | D8    |

### Public API surface added by this plan

```typescript
// @blend65/codegen — InstrProgram container + entry point (instr/ module)
export interface InstrProgram {
  readonly preamble: readonly StreamEntry[];   // empty in 07b; platform plugin preamble is RD-07c
  readonly streams: readonly InstrStream[];     // per-function code streams (live set)
  readonly allocationPlan: AllocationPlan;      // carried through from the IL program (RD-05)
}

/**
 * Translate the (optimized) IL program into a validated InstrProgram.
 * Takes a cpuVariant primitive (D2) — not a PlatformProfile (RD-10).
 * The AllocationPlan is read from ilProgram.allocationPlan.
 */
export function generateInstr(
  ilProgram: ILProgram,
  cpuVariant: CpuVariant,
  bag: DiagnosticBag,
): InstrProgram;

// @blend65/codegen — IL→Instr translation (instr/translate.ts)
//   internal: translateFunction(fn, ctx) → InstrStream; per-op emitters.
// @blend65/codegen — register binding (instr/register-binding.ts)
//   internal: a linear-scan binder consuming AllocationPlan "temp" ZP runs.
```

### What is explicitly NOT implemented (the RD-07c surface)

1. **IL ops no live lowering emits** — `neg`/`not`, `load_indexed`/`store_indexed`,
   `load_indirect`/`store_indirect`, `copy`, `call`, `intrinsic`, `source_span` as a
   standalone op, and the `br`/`brcond`/`unreachable` terminators (multi-block CFGs). Each
   hits an `E90001` ICE default arm until its lowering lands.
2. **Platform codegen hooks** (R46–R49) — startup-stub / binary-format / origin / encoding
   seam (filled by RD-10 plugins); `InstrProgram.preamble` stays empty in 07b.
3. **Calling-convention codegen** (R31, Ch 06 §5.4) — depends on the `call` op (not lowered).
4. **Interrupt prologue/epilogue** (R33) and **for-loop patterns** (R36/R37) — depend on
   their not-yet-lowered IL shapes.
5. **`initCode` / `constData` translation** — empty in the live IL (RD-06 v1); RD-07c.

## Related Files

Created/modified by this plan (all in `@blend65/codegen`; nothing in `spec/`):

- **New (`instr/`):** `packages/codegen/src/instr/translate.ts` (IL→`Instr` per-op),
  `instr/register-binding.ts` (temp→A/X/Y+ZP binder + register-state tracking),
  `instr/instr-program.ts` (`InstrProgram` + `generateInstr`), plus matching
  `*.spec.test.ts` / `*.impl.test.ts` and golden snapshots from real IL.
- **Modified (codegen):** `packages/codegen/src/instr/index.ts` — export `InstrProgram`,
  `generateInstr`; `packages/codegen/src/index.ts` already re-exports the `instr/` barrel.
- **Annotated (requirements, not frozen):** `requirements/RD-07-codegen-instr.md` (status
  banner update: 07b slice done; RD-07c carries the deferred remainder).
