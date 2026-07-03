# Resource Report: RD-11b

> **Document**: 03-04-resource-report.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-11 R39–R49 · §3.9–§3.11/§4.6–§4.7 (as amended by AR-103) · AC-15, AC-17 (post-ACME half), AC-18, AC-19 · AR-79..AR-85, AR-102, PF-002/PF-003/PF-012 · plan AR-Q3/Q4/Q5/Q6/Q11/Q15/Q16

## Overview

The second RD-11 subsystem: a typed `ResourceReport` aggregating build resource
data from its owners (SFA plan / ACME artifacts / platform profile / plugin —
R40/R41), a pure builder encoding that ownership in its signature (AR-Q3), the
post-ACME binary-budget check (E10034, AR-Q4), and two renderers — the Ch 11 §6
terminal build summary (normative layout, PF-003) and JSON (PF-012).

New module `packages/core/src/report/` with its own barrel, re-exported from the
core root (AR-Q2). No imports from `platform/` — budget values arrive as plain
numbers, keeping the module decoupled (02-current-state §Dependencies).

## Implementation Details

### New Types (`resource-report.ts`)

```typescript
/** Inclusive byte addresses (not half-open), matching the §4.7 display form ($0801–$0CE0). */
export interface SegmentRange {
  readonly start: number;
  readonly end: number;
}

/** Core-resident mirror of RD-08 §4.8 (core cannot import codegen — R15/PF-002). */
export interface PeepholeStats {
  readonly totalApplications: number;
  readonly ruleHits: ReadonlyMap<string, number>;
  readonly bytesSaved: number;
  readonly cyclesSaved: number;
}

/** RD-11 §4.6 as amended by AR-103 (platform/target/ranges/zpAllocations/stackAnalysis). */
export interface ResourceReport {
  // --- Build identity (AR-Q5: in the type, not renderer options — JSON parity) ---
  readonly platformName: string;
  readonly targetName: string;

  // --- SFA-owned (pre-ACME) — embedded verbatim, not copied (PF-002) ---
  readonly sfa: SfaResourceData;
  /** ZP breakdown (AR-Q6). Undefined → category lines render zeros. */
  readonly zpAllocations?: readonly ZpAllocation[];
  /** Stack breakdown (AR-Q15). Undefined → depth/overhead lines render zeros. */
  readonly stackAnalysis?: StackAnalysis;

  // --- ACME-owned (post-ACME; all undefined until RD-15+ wires them — AR-102) ---
  readonly codeSize?: number;
  readonly dataSize?: number;
  readonly binarySize?: number;
  readonly codeRange?: SegmentRange;
  readonly dataRange?: SegmentRange;
  readonly ramRange?: SegmentRange;
  readonly framesRange?: SegmentRange;

  // --- Profile-owned ---
  readonly binaryBudget: number;

  // --- Plugin-owned ---
  readonly startupSize?: number;
  readonly startupCycles?: number;

  // --- Peephole (RD-08 Phase B) ---
  readonly peepholeStats?: PeepholeStats;
}
```

### Builder + budget check (`build-resource-report.ts`)

```typescript
/** Inputs for buildResourceReport — ownership encoded per field group (R40/R41). */
export interface BuildResourceReportInputs {
  readonly platformName: string;
  readonly targetName: string;
  /** The frozen SFA plan; resourceData/zpAllocations/stackAnalysis embed verbatim. */
  readonly plan: AllocationPlan;
  /** profile.maxBinarySize. */
  readonly binaryBudget: number;
  readonly codeSize?: number;
  readonly dataSize?: number;
  readonly binarySize?: number;
  readonly codeRange?: SegmentRange;
  readonly dataRange?: SegmentRange;
  readonly ramRange?: SegmentRange;
  readonly framesRange?: SegmentRange;
  readonly startupSize?: number;
  readonly startupCycles?: number;
  readonly peepholeStats?: PeepholeStats;
}

export function buildResourceReport(inputs: BuildResourceReportInputs): ResourceReport;

export function checkBinaryBudget(report: ResourceReport, bag: DiagnosticBag): void;
```

- `buildResourceReport` is pure restructuring: `sfa = plan.resourceData`,
  `zpAllocations = plan.zpAllocations`, `stackAnalysis = plan.stackAnalysis`
  (all embedded by reference — one owner per number *structurally*, PF-002);
  the remaining inputs copy through. No I/O, no label parsing (AR-Q3 — no
  boundary labels exist; grounded against `serialize-acme.ts`).
- `checkBinaryBudget` (AR-Q4, R42/AC-17 post-ACME half): no-op when
  `report.binarySize === undefined`; when `binarySize > binaryBudget`, emits
  `DiagCode.BinaryTooLarge` (E10034) with a `null` span and the Ch 14 message:
  `Output binary (<size> bytes) exceeds platform '<platform>' maximum binary size (<limit> bytes)`
  using `report.platformName`. `<=` budget emits nothing.

### Terminal renderer (`render-report-terminal.ts`)

`renderReportTerminal(report): string` — uncolored (the §4.7 signature has no
color option; the build summary is a table, not a diagnostic), trailing newline.
Geometry is the §4.7 template **transcribed verbatim** (AR-Q11); numbers
right-align within the template's field widths, wider values extend rightward.
Every line always prints (AR-102) — value sources:

| Line | Value | Zero-staging |
| ---- | ----- | ------------ |
| `Platform:` / `Target:` | `platformName` / `targetName` | always real |
| `Code segment:` | `codeSize ?? 0` + `codeRange` | `0 bytes ($0000–$0000)` (AR-Q16) |
| `Data segment:` | `dataSize ?? 0` + `dataRange` + literal `[const arrays, strings, embed data]` | same |
| `RAM variables:` | `sfa.ramUsed − sfa.frameRegionBytes` (module vars; both SFA-owned, R41 holds) + `ramRange` | real today |
| `SFA frames:` | `sfa.frameRegionBytes` + `framesRange` + `[peak: {sfa.frameRegionPeak} bytes simultaneous]` | real today (peak = region size, AR-92) |
| ZP `User variables:` | Σ `zpAllocations` where `category === 'user'` | zeros if field absent |
| ZP `Compiler temps:` | Σ `temp` **+ Σ `arg-block`** (fold — no layout line, AR-Q6) | zeros if absent |
| ZP `Struct pointers:` / `IRQ temps:` | Σ `pointer` / Σ `irq-temp` | zeros if absent |
| ZP `Total:` | `sfa.zpUsed / sfa.zpBudget ({pct}%)` | real today |
| `Max call depth:` | `stackAnalysis.maxMainDepth` levels (`maxMainStackBytes` bytes) | zeros if absent (AR-Q15) |
| `IRQ overhead:` | `stackAnalysis.irqOverhead` bytes | zeros if absent |
| Stack `Total peak:` | `sfa.stackWorstCase / sfa.stackBudget ({pct}%)` | real today |
| `Startup routine:` | `startupSize ?? 0` bytes, `startupCycles ?? 0` cycles | zeros today |
| `Total binary:` | `binarySize ?? 0` bytes | zero until RD-15 wires it |

Formatting (AR-Q11): hand-rolled thousands grouping (`1247 → "1,247"`, no
`toLocaleString`); percentages `Math.round(used / budget × 100)`, `0%` when the
budget is 0; ranges as `($HHHH–$HHHH)` — 4-digit uppercase hex, U+2013 en dash,
`($0000–$0000)` placeholder when the range field is undefined (AR-Q16).
`peepholeStats` does **not** render — Ch 11 §6 has no optimization line (AR-Q11).

### JSON renderer (`render-report-json.ts`)

`renderReportJson(report): string` (AR-Q10, PF-012): one object mirroring
`ResourceReport`; `sfa`/`stackAnalysis` as plain objects; `zpAllocations` as a
plain array; `peepholeStats.ruleHits` converted to **name-sorted**
`[string, number][]` entries (Maps stringify to `{}` — PF-012); undefined
optionals omitted (native `JSON.stringify` behavior); 2-space indent + trailing
newline.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `binarySize` undefined at check time | `checkBinaryBudget` no-ops (pre-wiring builds) | AR-Q4 |
| `binarySize > binaryBudget` | E10034 via the bag, null span, Ch 14 message | R42/AC-17 |
| Zero budgets (zp/stack/binary = 0) | Percentages render `0%` — no division by zero | AR-Q11 |
| Absent optional data | Render zeros/placeholders, never omit lines | AR-102/AR-Q16 |
| `ruleHits` Map in JSON | Sorted entries array | PF-012 |

## Testing Requirements

- Spec tests ST-22..ST-27 (`resource-report.spec.test.ts`,
  `render-report-terminal.golden.spec.test.ts` — golden naming per the RD-09
  precedent, `render-report-json.spec.test.ts`).
- Impl tests: grouping edge cases (999/1000/1000000), pct rounding boundaries,
  fold correctness when only `arg-block` allocations exist, builder reference
  identity (`report.sfa === plan.resourceData`), width overflow (>8-digit byte
  counts extend rightward without truncation).
