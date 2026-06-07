# Design: Register Binding (temps → A/X/Y + ZP scratch)

> **Document**: 03-02-register-binding.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-07 R40–R45 · spec Ch 04 (register usage)
> **Decisions**: D2 (plan from `ilProgram`), D6 (`instr/` layout), D7 (diagnostics), D9 (`TempLocation` union)


## Overview

`instr/register-binding.ts` maps the IL's **unlimited virtual temps** onto the 6502's three
8-bit registers (A, X, Y) plus **ZP scratch bytes** drawn from the carried `AllocationPlan`.
RD-07 §4.4 specifies a **linear-scan strategy with register tracking**: simple, correct, and
sufficient for the small straight-line functions the live lowering emits; the peephole
optimizer (RD-08) cleans up any residual redundant loads a smarter allocator would avoid.

The binder is the single owner of "where does temp `tN` live right now?" The translator
(03-01) asks the binder for an operand's location and tells the binder when a temp is
produced or consumed; the binder emits any spill/reload instructions needed.

## Physical resources (R41/R42)

| Resource | Role in the slice |
| -------- | ----------------- |
| **A** | primary accumulator — every ALU op (`ADC`/`SBC`/`AND`/`CMP`/…) reads/writes A; the hot operand and most temps live here |
| **X** | 16-bit high byte of a value/return (`LDX`/`STX`); secondary storage |
| **Y** | indexed/indirect offset — **unused in the live set** (no indexed/indirect ops lowered); reserved for RD-07c |
| **ZP scratch** | spill area — the `category: "temp"` runs (`__zp_tmp_N`) from `AllocationPlan.zpAllocations` (R43) |

## Binder state (R44)

```typescript
// D9 — a temp's live location: a register (implied by opcode, not an InstrOperand)
// or a zero-page spill slot. Registers can never be InstrOperands on the 6502.
type TempLocation =
  | { readonly kind: "reg"; readonly reg: "A" | "X" | "Y" }
  | { readonly kind: "zp"; readonly slot: string };

interface RegisterState {
  a: TempId | null;   // which temp currently lives in A (or null = unknown/free)
  x: TempId | null;
  y: TempId | null;
}
// plus: a map TempId → TempLocation for spilled temps
```

- **`bindResult(temp)`** — record that an emitted instruction has just produced `temp` in A
  (the default ALU destination). Updates `state.a = temp.id`.
- **`locationOf(temp): TempLocation`** — return where `temp` currently is: a `reg` location
  (`A`/`X`/`Y`) or a `zp` spill slot (D9). The translator uses this for register-state
  reasoning; when it needs the temp **as a memory source** it calls `operandFor` (below).
- **`operandFor(temp): InstrOperand`** — convert a temp's location to an addressable operand:
  a `zp` location → `zpSlot(slot)`; a `reg` location → an `E90001` ICE (a register is not
  memory-addressable — a codegen bug, H5) (D9).
- **`ensureInA(temp)`** — if `temp` is not already in A, emit `LDA <loc>` to bring it in

  (suppressed when `state.a === temp.id`, R44). Used before an ALU op whose left operand must
  be in A.
- **`spill(reg)`** — when A (or X) is needed but holds a still-live temp, emit
  `STA __zp_tmp_k` and record the temp's new ZP location; pick the **least-recently-used**
  live temp (R43).
- **`reset()`** — clear all register knowledge (R45). Called at every block boundary and
  after any future `intrinsic`/`call` clobber (RD-07c). For the single-block live functions
  this is the per-function entry reset.

## Redundant-load suppression (R44; the example in 03-01)

The state tracker is what turns the naïve
```
LDA a ; STA t0   /   LDA b ; STA t1   /   LDA t0 ; CLC ; ADC t1 ; STA t2
```
into the tight
```
LDA a ; CLC ; ADC b ; STA r
```
because after `LDA a` the binder knows A holds `t0`, so the `add`'s `ensureInA(t0)` is a
no-op, and the right operand `t1` (a `load b`) is folded directly into `ADC b` (the binder
recognizes a not-yet-materialized `load`-temp whose source location can be used inline). The
binder keeps this fold **conservative**: it only inlines a load-source when that temp has a
single use and no intervening write — otherwise it materializes normally. (A formal
single-use check rides on RD-06's `tempCount`/use information; if that information is not yet
exposed, the slice materializes conservatively and lets RD-08 peephole the redundancy — never
incorrect, only occasionally one `LDA`/`STA` longer.)

## ZP scratch allocation (R43)

The binder draws spill slots from `AllocationPlan.zpAllocations.filter(z => z.category === "temp")`
in allocation order. Each spill consumes one `__zp_tmp_N` (size 1 for a byte, a 2-byte pair
for a word). If the plan provides **insufficient** temp scratch for a function's peak spill
pressure, that is a resource condition the SFA planner (RD-05) is responsible for sizing
(`mainTempBytes`/`irqTempBytes` budgets); the binder asserts it never exceeds the provided
runs and raises an `E90001` ICE if it would (a codegen/planner contract violation, D7) rather
than silently corrupting memory (H5 — no undefined behavior).

> **Slice reality:** the live straight-line functions rarely spill — A (+X for word high
> bytes) covers the common `load`/op/`store` chains — so the spill path is exercised mainly
> by impl tests with synthesized high-pressure IL fixtures. It is built and tested now so the
> binder is complete for the in-scope op set, not deferred.

## Interaction with the translator (clean seam)

```typescript
export interface RegisterBinder {
  ensureInA(temp: ILOperand, emit: (e: StreamEntry) => void): void;
  locationOf(temp: ILOperand): TempLocation;   // reg or zp (D9)
  operandFor(temp: ILOperand): InstrOperand;   // zp → zpSlot; reg → E90001 ICE (D9)
  bindResultToA(temp: ILOperand): void;
  bindResultToX(temp: ILOperand): void;
  reset(): void;
}
```


The translator owns the `StreamEntry[]`; the binder emits through the passed `emit` callback
so spill/reload instructions land in the correct position. This keeps the binder free of any
stream-assembly concern and independently unit-testable (feed a scripted sequence of
`ensureInA`/`bindResult` calls, assert the emitted `StreamEntry`s + final `RegisterState`).

## Determinism (R17/AC-06)

LRU spill selection uses a deterministic tie-break (lowest `TempId`), register preference is
fixed (A, then X, then a ZP spill), and no map iteration order is observed. Same IL + same
plan → same emitted instructions, every run.

## What is deferred to RD-07c

- **Y-register use** (indexed/indirect ops) and **pointer ZP runs** (`category: "pointer"`).
- **Clobber handling** after `call`/`intrinsic` (R45 CC-3) — needs those ops lowered.
- **Cross-block liveness** — multi-block CFGs (`br`/`brcond`); the slice resets per (single)
  block, which is correct but conservative for the eventual multi-block case.
