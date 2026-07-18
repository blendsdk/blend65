# Resource Report: per-function estimates + startupCycles

> **Document**: 03-05-resource-report.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 F7/F8 (AC-7, AC-8) · req-AR #7, #14 · preflight PF-002 · plan-AR #6

## Overview

Per-function straight-line cycle estimates (min–max, labeled) + byte sizes in both report
renderers, and a populated `startupCycles`. Producers compute their own costs via core
`timing/` (plan-AR #6), keeping the report's one-owner-per-field-group design.

## Architecture

### Current
`InstrProgram.streams` holds one `InstrStream` per function (02 §What Exists); the compiler
threads owner-grouped inputs at `build.ts:86`; the terminal renderer already prints the startup
line (zeros); core cannot import codegen (R15).

### Proposed

1. **Core (`report/resource-report.ts`)** — new optional field group:

```ts
/** Straight-line cost summary for one emitted function. */
export interface FunctionCostEstimate {
  readonly name: string;
  readonly bytes: number;
  readonly minCycles: number;  // each instruction once; branches not taken, no page cross
  readonly maxCycles: number;  // branches taken (+page cross), page-cross penalties applied
}
export interface ResourceReport {
  // …existing…
  /** Per-function straight-line estimates; absent → section not rendered. */
  readonly functionCosts?: readonly FunctionCostEstimate[];
  /** Set when the CPU variant has no timing data (e.g. wdc65c02): renderers omit cycle columns with this label. */
  readonly cycleEstimatesUnavailable?: string;
}
```

2. **Codegen** — `summarizeFunctionCosts(program: InstrProgram): FunctionCostEstimate[]`
   (codegen ← core is a legal edge): walks each stream's instruction entries, sums
   `getTiming` records into min–max per req-AR #7 (loops NOT multiplied; documented as
   straight-line). For a non-NMOS variant it returns byte sizes with an
   `cycleEstimatesUnavailable` marker instead of cycle numbers (PF-002 — the emitted op set is
   NMOS-legal today, but the contract keys off the build's declared variant, not luck).
3. **Platforms** — the C64 plugin computes its startup shim's cost via `getTiming`
   (straight-line; the shim is linear + `JSR`s). Wiring pinned per preflight PF-012: the
   `PlatformPlugin` contract (`core/src/platform/platform-plugin.ts:101`) gains an **optional**
   member `startupCost?(variant, hasInitCode): { bytes: number; cycles: number }` — same
   signature family as the existing `emitStartupShim(variant, hasInitCode)` (:133), so the
   plugin costs exactly the entries it emits for the build's actual configuration (bytes from
   `InstrTiming.bytes`, labels contribute 0). Nothing produces the figures today and
   `build.ts:86` never threads them — both ends are new wiring onto the existing
   `BuildResourceReportInputs.startupSize/startupCycles` fields (req-AR #14).
4. **Compiler (`api/build.ts`)** — threads `functionCosts`/`cycleEstimatesUnavailable` from
   codegen into `buildResourceReport` alongside the existing groups, and calls
   `plugin.startupCost?.(...)` with the same variant/`hasInitCode` arguments it used for the
   preamble, threading the result into `startupSize`/`startupCycles` (PF-012).
5. **Renderers** — terminal: new per-function section (name, bytes, `min–max cycles`, section
   header labels the numbers as straight-line estimates); for non-NMOS builds the cycle column
   is replaced by the explicit "no timing data for this CPU variant" label, byte sizes remain
   (RD F7). JSON: mirrors the same fields. The terminal-render golden
   (`render-report-terminal.golden.spec.test.ts`) is regenerated in the same change (RD F7).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Non-NMOS CPU variant | Cycle columns omitted with explicit label; bytes remain — never a throw, never silent zeros | PF-002 |
| Function with no stream (skipped during lowering) | Absent from `functionCosts` (matches emitter behavior) | plan-AR #6 |

## Testing Requirements
- Spec: ST-27…ST-31 (07 §Resource Report).
- Impl: summarizer internals (directive/label entries skipped; min–max accumulation), renderer
  layout edges (long function names, zero functions).
