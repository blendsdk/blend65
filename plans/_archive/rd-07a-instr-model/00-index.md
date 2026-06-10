# RD-07a Instr Model, CPU Table & Canonical Serializer — Implementation Plan

> **Feature**: Implement the **stable, target-specific 6502 instruction model** — the
> typed `Instr`/`Label`/`Directive` stream (`StreamEntry`), the symbolic `InstrOperand`
> union, the `Opcode`/`AddressingMode` enums, the **full NMOS-6502 CPU validation table**
> + validator (65C02 extensions gated by `cpuVariant`), and the **canonical ACME-syntax
> serializer** (`printInstr`) that both `--emit-asm` and the RD-09 ACME emitter consume.
> This is the **self-contained, zero-dependency, zero-throwaway** third of RD-07, built
> **completely**; the consumer-coupled remainder (IL→`Instr` translation, register
> binding, platform hooks, `generateInstr`) is **RD-07b**. All artifacts live in
> `@blend65/codegen/src/instr/` (a sibling to `il/`). Implements RD-07 R1–R16 / R52–R54
> and frozen spec Ch 04 §3–§9 (mnemonics/modes referenced by codegen) + Ch 11 §6 (byte
> sizing for the resource report).
> **Status**: ✅ Implemented (all 16 tasks; full verify + R15 boundary green; spec/ clean)

> **Created**: 2026-06-06
> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01..RD-06/RD-11a)
> **Source**: [RD-07](../../requirements/RD-07-codegen-instr.md) · spec Ch 04/05/06/11 · master register AR-50/AR-53–AR-61/AR-63/AR-70/AR-80

## Overview

RD-07 specifies the entire 6502 code generator, but it declares `Depends On: RD-06, RD-10`
and **RD-10 does not exist yet** (no `PlatformProfile`; `@blend65/platforms` is an empty
stub), while **RD-06's lowering is a walking-skeleton slice** (only the gate/slice-2 IL
surface is emitted live). RD-07 therefore sits between two not-yet-complete stages — the
classic AR-38 situation the project already resolved twice by splitting a large RD into a
**stable core** + a **consumer-coupled follow-on** (RD-04→RD-04b, RD-11→RD-11a).

This plan is **RD-07a**: the stable core. Its three deliverables are *self-contained pure
data + a pure deterministic function* with **no** dependency on RD-10 or the lowering
slice, so they can be built 100% complete and **never reworked** (decision **D1**):

1. **The `Instr` model** (R1–R13) — one `Instr` = exactly one real 6502 opcode with its
   typed `AddressingMode` and symbolic `InstrOperand`; `Label` and `Directive` are
   first-class inline `StreamEntry` values; the per-function `InstrStream` container.
2. **CPU validation** (R14–R16) — the full NMOS-6502 opcode→legal-modes table (56
   mnemonics), with the 65C02 extension set **gated** behind `cpuVariant`, plus a
   `validateStream` checker that raises an `E90001` ICE for any illegal opcode+mode (D6).
3. **The canonical ACME serializer** (R52–R54) — a deterministic `printInstr(stream)`
   rendering ACME syntax, the single source RD-09 reuses (no second serializer — AR-60).

Crucially, **07a takes only a `cpuVariant: "nmos6502" | "wdc65c02"` primitive** — it does
**not** fabricate a `PlatformProfile` (decision **D2**). When RD-10 lands, it exposes
`profile.cpuVariant` and the RD-07b caller reads it; 07a's signatures are unchanged. This
eliminates the single biggest rework risk in RD-07 (a placeholder profile type RD-10 would
replace) at its root — satisfying the user's explicit *no-refactor* requirement.

Following the AR-20 frontend/backend boundary, all RD-07a artifacts live in
`@blend65/codegen` — the language-server must never import codegen (R15/AR-20). The frozen
`spec/` is never touched; the existing core `Diagnostic`/`DiagnosticBag`/`SourceSpan`/
`IceCode` records and the RD-06 IL model are **consumed, never modified**.

> **D1/D2 (load-bearing):** the Instr model, CPU table, and serializer are **real and
> complete**. What is deferred to **RD-07b** is only the *consumer-coupled* logic:
> IL→`Instr` translation (R17–R39), register binding (R40–R45), the platform-hook seam
> (R46–R49), `InstrProgram` assembly (R55–R58), and the `generateInstr` entry point. 07a
> validates and serializes hand-built `Instr` fixtures today; 07b produces those `Instr`
> streams from real IL tomorrow.

## Document Index

| #     | Document                                                              | Description                                                                 |
| ----- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AR    | [Ambiguity Register](00-ambiguity-register.md)                       | Plan-level Zero-Ambiguity Gate decisions (D1–D9)                            |
| 00    | [Index](00-index.md)                                                 | This document — overview and navigation                                      |
| 01    | [Requirements](01-requirements.md)                                   | In-scope (model + CPU table + serializer) vs deferred (07b); R/AC mapping    |
| 02    | [Current State](02-current-state.md)                                 | As-built codegen/core the model builds on; the absent RD-10/lowering gaps    |
| 03-01 | [Instr Model](03-01-instr-model.md)                                  | `Opcode`, `AddressingMode`, `InstrOperand`, `StreamEntry`/`InstrStream`, `CpuVariant` |
| 03-02 | [CPU Validation Table](03-02-cpu-table-and-validation.md)           | NMOS-6502 opcode→mode table, gated 65C02 set, `validateStream` ICE checker   |
| 03-03 | [Canonical ACME Serializer](03-03-serializer.md)                     | `printInstr` deterministic ACME-syntax rendering; the RD-09-reused surface   |
| 07    | [Testing Strategy](07-testing-strategy.md)                           | Spec/impl test cases (ST-*) incl. golden ACME-text snapshots                 |
| 99    | [Execution Plan](99-execution-plan.md)                               | Phases, sessions, and master task checklist                                 |

## Quick Reference

### Key Decisions

| Decision                                  | Outcome                                                                              | Ref   |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | ----- |
| Build strategy                            | **Split RD-07 → 07a (this, stable core, built fully) + 07b (consumer-coupled follow-on)** | D1    |
| Profile dependency (RD-10 absent)         | **`cpuVariant` primitive input** — no fabricated `PlatformProfile`; RD-10 fills the caller additively | D2    |
| CPU validation table                      | **Full NMOS-6502 table now**; 65C02 extensions present but **gated** by `cpuVariant` | D3    |
| Canonical serializer                      | **Built in 07a** (`printInstr`); RD-09 reuses it — no second serializer (AR-60)      | D4    |
| Module layout                             | **`instr/`** directory, sibling to `il/` in `@blend65/codegen`                       | D5    |
| Diagnostic codes                          | **Reuse** `IceCode.Unexpected` (E90001) for validation failures; no new codes        | D6    |
| Commit mode                               | `--no-commit`                                                                        | D7    |
| 65C02 `(zp)` mode                         | **Add `ZeroPageIndirect` (14th mode) now**; gated to 65C02 (`ADC/AND/CMP/EOR/LDA/ORA/SBC/STA`) | D8    |
| `StreamEntry` instr field names           | **`opcode`/`mode`** (per §4.3; resolves the R2-vs-§4.3 conflict)                     | D9    |

### Public API surface added by this plan

```typescript
// @blend65/codegen — Instr model (new instr/ module)
export type CpuVariant = "nmos6502" | "wdc65c02";

export const OPCODES = [/* ADC, AND, ... 56 NMOS + 8 65C02 */] as const;
export type Opcode = (typeof OPCODES)[number];

export const ADDRESSING_MODES = [/* Implied, Accumulator, Immediate, ZeroPage, ... 14 modes incl. ZeroPageIndirect (65C02) */] as const;
export type AddressingMode = (typeof ADDRESSING_MODES)[number];

export type InstrOperand =
  | { readonly kind: "none" }
  | { readonly kind: "immediate"; readonly value: number }
  | { readonly kind: "symbolRef"; readonly name: string; readonly offset?: number; readonly byteSelect: "low" | "high" | "none" }
  | { readonly kind: "labelRef"; readonly label: string }
  | { readonly kind: "zpSlot"; readonly name: string };
export function none(): InstrOperand;
export function imm8(value: number): InstrOperand;        // operand constructors
export function symbolRef(name: string, opts?: { offset?: number; byteSelect?: "low" | "high" | "none" }): InstrOperand;
export function labelRef(label: string): InstrOperand;
export function zpSlot(name: string): InstrOperand;
// operand guards: isImmediateOperand (named to avoid colliding with il/'s isImmediate at
// the @blend65/codegen barrel — AR D10), isSymbolRef, isLabelRef, isZpSlot

export type AcmeDirective =
  | { readonly kind: "origin"; readonly address: number }
  | { readonly kind: "symbolDef"; readonly name: string; readonly value: number }
  | { readonly kind: "byte"; readonly values: readonly number[] }
  | { readonly kind: "word"; readonly values: readonly number[] }
  | { readonly kind: "text"; readonly text: string; readonly encoding?: string }
  | { readonly kind: "fill"; readonly count: number; readonly value: number }
  | { readonly kind: "outputFile"; readonly name: string; readonly format: string };

export type StreamEntry =
  | { readonly type: "instr"; readonly opcode: Opcode; readonly mode: AddressingMode; readonly operand: InstrOperand; readonly sourceSpan?: SourceSpan }
  | { readonly type: "label"; readonly name: string }
  | { readonly type: "directive"; readonly directive: AcmeDirective };
export function instr(opcode: Opcode, mode: AddressingMode, operand: InstrOperand, sourceSpan?: SourceSpan): StreamEntry;
export function label(name: string): StreamEntry;
export function directive(d: AcmeDirective): StreamEntry;

export interface InstrStream {
  readonly symbol: string;
  readonly segment: "code" | "data" | "zp";
  readonly entries: readonly StreamEntry[];
}

// @blend65/codegen — CPU validation (new instr/ module)
export function validateStream(stream: InstrStream, cpuVariant: CpuVariant, bag: DiagnosticBag): void;
export function isLegalMode(opcode: Opcode, mode: AddressingMode, cpuVariant: CpuVariant): boolean;

// @blend65/codegen — canonical serializer (new instr/ module)
export function printInstr(stream: InstrStream): string;       // deterministic ACME text; --emit-asm + golden + RD-09 surface
export function instrByteSize(entry: StreamEntry): number;     // Ch 11 §6 ROM byte sizing (R58 support)
```

### What is explicitly NOT implemented (the RD-07b surface)

1. **IL→`Instr` translation** (R17–R39) — every IL op's 6502 instruction sequence
   (`add`→`CLC`/`ADC`, `mul`→strategy selection, calls, intrinsics, for-loop patterns).
2. **Register binding** (R40–R45) — virtual-temp → A/X/Y + ZP-scratch allocation, register
   state tracking, clobber handling.
3. **Platform codegen hooks** (R46–R49) — startup-stub/binary-format/origin/encoding seam
   (filled by RD-10 plugins).
4. **`InstrProgram` assembly + `generateInstr`** (R55–R58) — the top-level program
   container and the `(ilProgram, profile, bag) → InstrProgram` entry point.
5. **Source-span *propagation*** (R50–R51) — 07a's `StreamEntry` *carries* the optional
   `sourceSpan` field (model surface), but threading spans from IL through translation is
   07b's job.

## Related Files

Created/modified by this plan (all in `@blend65/codegen`; nothing in `spec/`):

- **New (`instr/`):** `packages/codegen/src/instr/opcode.ts`,
  `instr/addressing-mode.ts`, `instr/operand.ts`, `instr/stream.ts`
  (`StreamEntry`/`InstrStream`/`AcmeDirective` + constructors), `instr/cpu-table.ts`
  (NMOS-6502 table + gated 65C02 set + `CpuVariant`), `instr/validate.ts`
  (`validateStream`/`isLegalMode`), `instr/print-instr.ts` (`printInstr`/`instrByteSize`),
  `instr/test-fixtures.ts`, `instr/index.ts`, plus matching `*.spec.test.ts` /
  `*.impl.test.ts` and `__snapshots__/` golden files.
- **Modified (codegen):** `packages/codegen/src/index.ts` — export the new `instr/` barrel.
- **Annotated (requirements, not frozen):** `requirements/RD-07-codegen-instr.md` (status
  banner noting the 07a/07b split — D1).
