# Design: `InstrProgram` & `generateInstr`

> **Document**: 03-03-instr-program-and-generate.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-07 R55–R61 (slice), R50–R51 · spec Ch 11 §6 (resource bytes)
> **Decisions**: D2 (`cpuVariant` + plan-from-IL), D6 (`instr/` layout), D7 (diagnostics)

## Overview

`instr/instr-program.ts` is the **top of the back end**: the `InstrProgram` container and the
`generateInstr` entry point that drives per-function translation, validates each emitted
stream, and assembles the program. It is the single public function RD-08 (peephole) and
RD-09 (emitter) consume.

## `InstrProgram` container (R55–R57)

```typescript
export interface InstrProgram {
  /** Platform plugin preamble (origin/!to/symbol defs) — EMPTY in 07b; filled by RD-07c (R46–R49). */
  readonly preamble: readonly StreamEntry[];
  /** One InstrStream per translated function (live set), in deterministic order. */
  readonly streams: readonly InstrStream[];
  /** Carried through from the IL program (RD-05) for the emitter's symbol defs (R57). */
  readonly allocationPlan: AllocationPlan;
}
```

This is the RD-07 §4.3 `InstrProgram` shape, with `preamble` present but **empty** in the
slice (D1/D2): the platform plugin that fills origin / `!to` / symbol-definition directives is
RD-07c + RD-10. `streams` and `allocationPlan` are fully live now.

> **Difference from RD-07 §4.3:** the spec sketch nests per-function streams plus init/const
> streams. The slice emits only the **function code streams** the live lowering produces
> (`ilProgram.initCode`/`constData` are empty in RD-06 v1 — 02-current-state); init/const
> stream assembly lights up in RD-07c when those IL sections become non-empty.

## `generateInstr` entry point (R55, R59, R61; D2)

```typescript
/**
 * Translate the (optimized) IL program into a validated InstrProgram.
 *
 * @param ilProgram   The IL program (RD-06) — carries its own AllocationPlan.
 * @param cpuVariant  CPU target primitive (D2) — picks the RD-07a validation table.
 *                    RD-10's PlatformProfile will supply this via profile.cpuVariant.
 * @param bag         Diagnostic sink: cost warnings (R60) + ICEs (R61).
 * @returns           The InstrProgram (frozen).
 */
export function generateInstr(
  ilProgram: ILProgram,
  cpuVariant: CpuVariant,
  bag: DiagnosticBag,
): InstrProgram;
```

**Algorithm:**
1. `const plan = ilProgram.allocationPlan;` (D2 — no separate plan arg).
2. For each `fn` in `ilProgram.functions`:
   - if the function has no blocks/instructions (skipped during lowering, R59) → **emit no
     stream** (continue);
   - `const stream = translateFunction(fn, plan, cpuVariant, bag);` (03-01, using a fresh
     `RegisterBinder` per function — 03-02);
   - `validateStream(stream, cpuVariant, bag);` (R61/FR-22 — every emitted opcode+mode must be
     legal for the target; an illegal pair is an `E90001` codegen bug);
   - push `stream` into `streams`.
3. Return `Object.freeze({ preamble: [], streams: Object.freeze(streams), allocationPlan: plan })`.

**Ordering (determinism, R17/AC-06):** `streams` follow `ilProgram.functions` order (already
deterministic from RD-06). No sorting, no map iteration.

**Error tolerance (R59):** a function whose IL was skipped (carried an `ErrorType`, RD-06 R68)
simply is not present in `ilProgram.functions` (lowering already dropped it), so step 2 never
sees it — but the explicit empty-blocks guard also covers a present-but-empty function. Either
way no `InstrStream` is produced, and translation of the *other* functions proceeds.

## Resource bytes (R58; Ch 11 §6)

`generateInstr` can report a ROM byte estimate by summing RD-07a's `instrByteSize` over every
entry of every stream (plus the preamble, empty here). The slice exposes a small helper:

```typescript
export function programByteSize(program: InstrProgram): number;  // Σ instrByteSize over all entries
```

This feeds the RD-11 `ResourceReport` pre-ACME (the *summing into a `ResourceReport`* record is
RD-11's; 07b provides the program-level sum, building on RD-07a's per-entry `instrByteSize`).

## Diagnostics summary (D7)

| Condition | Diagnostic | Where |
| --------- | ---------- | ----- |
| Unsupported (deferred) IL op | `E90001` ICE — `"IL→Instr: unsupported op '<op>' (deferred to RD-07c)"` | translator default arm (03-01) |
| Translated illegal opcode+mode | `E90001` ICE (via `validateStream`) | `generateInstr` per-stream validation |
| Spill exceeds plan's temp ZP runs | `E90001` ICE — planner/codegen contract violation | binder (03-02) |
| Runtime multiply (`JSR __rt_mul*`) | `W10170` | translator `mul` arm |
| Runtime divide (`JSR __rt_div*`) | `W10171` | translator `div`/`mod` arm |
| Shift-and-add multiply | `W10172` | translator `mul` power-of-2 arm |

All ICEs use the existing `IceCode.Unexpected` (E90001); all warnings use the existing
user-band W-codes. No new diagnostic codes (D7).

## Public surface added (barrel)

`instr/index.ts` adds:
```typescript
export type { InstrProgram };
export { generateInstr, programByteSize };
```
`packages/codegen/src/index.ts` already re-exports the `instr/` barrel (RD-07a 4.1.2), so
these become part of the `@blend65/codegen` public API automatically. The internal
`translate.ts` / `register-binding.ts` helpers are **not** barrel-exported (consumed only by
`generateInstr`), mirroring RD-07a's non-exported `test-fixtures.ts` discipline.

## End-to-end pipeline (the slice's runtime-verifiable anchor)

```
.blend source
  → RD-02 lex → RD-03 parse → RD-04 semantics → RD-05 planAllocation
  → RD-06 lowerToIL (fixture-built real IL; 02-current-state caveat)
  → RD-07b generateInstr(ilProgram, "nmos6502", bag)
  → RD-07a printInstr(stream)  →  asserted ACME text (golden)
```
This chain is what the FR-25 golden tests exercise: feed a real RD-06 lowering fixture through
`generateInstr`, then `printInstr` each stream, and assert the exact ACME text — proving the
slice not only compiles but produces correct, deterministic 6502 for the live op set.
