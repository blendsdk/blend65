# Stack Depth & Budget Diagnostics: RD-05 SFA Frame Planner

> **Document**: 03-04-stack-and-budgets.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-05 R37–R46, R60–R62, §4.9, §4.13; spec Ch 11 §5/§8, Ch 06 §7.8, Ch 14

## Overview

Two passes plus the error-tolerance policy:
1. **`stack-analysis.ts`** — worst-case hardware stack depth from the call graph (main path +
   interrupt overhead + IRQ path).
2. **`budgets.ts`** — checks ZP/RAM/stack against the profile, emitting the five Ch 14 codes
   through the shared `DiagnosticBag`, **pre-ACME**.
3. **Error tolerance** — suppress budget diagnostics when upstream errors exist (cascade).

## Architecture

### New Types (core `sfa/allocation-plan.ts`)

```typescript
export interface StackAnalysis {
  readonly maxMainDepth: number;       // longest call chain from main (levels)
  readonly maxMainStackBytes: number;  // maxMainDepth × 2
  readonly maxIrqDepth: number;        // deepest chain within any interrupt handler
  readonly maxIrqStackBytes: number;   // maxIrqDepth × 2
  readonly irqOverhead: number;        // 6 if any interrupt handler exists, else 0
  readonly totalWorstCase: number;     // main + irqOverhead + irq
  readonly platformBudget: number;     // profile.stackBudget
  readonly exceedsWarningThreshold: boolean;
}
```

### New Functions (frontend `sfa/`)

```typescript
// stack-analysis.ts
export function analyzeStack(
  fns: readonly FunctionInfo[], profile: PlatformProfile,
): StackAnalysis;

// budgets.ts
export interface BudgetInputs {
  readonly zpUsed: number; readonly zpBudget: number;
  readonly ramUsed: number; readonly ramBudget: number;   // moduleVarsSize + frameRegionSize
  readonly zpOverflowed: boolean;                          // from ZP allocator (E10032 already emitted?)
  readonly stack: StackAnalysis;
  readonly upstreamErrors: boolean;                        // suppress when true (R62)
}
export function checkBudgets(inputs: BudgetInputs, profile: PlatformProfile, bag: DiagnosticBag): void;
```

## Implementation Details

### Stack-depth analysis (R37/R38, §4.9)

Each JSR consumes 2 bytes (return address). The call graph is a DAG; the longest path is found by
DFS with memoization (`longestFrom(node)` = 1 + max over callees, memoized; reachable set only).

```
1. maxMainDepth = longestPathFrom(main)            // in call levels; main itself = depth 1
   maxMainStackBytes = maxMainDepth × 2
2. interrupts = fns.filter(isInterrupt)
   maxIrqDepth = max over i in interrupts of longestPathFrom(i)   // 0 if none
   maxIrqStackBytes = maxIrqDepth × 2
3. irqOverhead = interrupts.length > 0 ? 6 : 0      // 3 CPU push + 3 register save (Ch 06 §7.8)
4. totalWorstCase = maxMainStackBytes + irqOverhead + maxIrqStackBytes
5. exceedsWarningThreshold = totalWorstCase >= platformBudget × profile.stackWarnThreshold
```

- **No `main`:** if no entry point is present (passthrough / partial input), `maxMainDepth = 0`;
  analysis still returns a valid record (error tolerance, R60).
- **Depth convention:** "levels × 2 bytes" follows §4.9; the precise off-by-one (does `main`'s own
  entry count?) is fixed by tests to match the §4.9 examples (`maxMainStackBytes = maxMainDepth×2`).

### Budget checking (R41–R46, §4.13) — pre-ACME

```
if inputs.upstreamErrors: return        // R62 cascade suppression — no budget diagnostics

// RAM (R42 / FR-29)
if inputs.ramUsed > inputs.ramBudget:   bag.addError(RamBudgetExceeded /*E10033*/, …)
else if ramUsed >= ramBudget × profile.ramWarnThreshold: bag.addWarning(RamNearingLimit /*W10033*/, …)

// ZP (R41/R43 / FR-28/FR-30)
// E10032 is emitted by the ZP allocator at the point of overflow (03-03). Here we only add the
// large-ZP warning when not overflowed:
if !inputs.zpOverflowed && zpUsed >= zpBudget × profile.zpWarnThreshold:
    bag.addWarning(LargeZpAllocation /*W10030*/, …)

// Stack (R40/R45 / FR-27/FR-30)
if inputs.stack.exceedsWarningThreshold: bag.addWarning(StackDepthNearLimit /*W10180*/, …)
```

> **Division of responsibility for E10032:** to emit it exactly once with a precise span, the
> **ZP allocator** (03-03) emits E10032 at the overflow point and reports `overflowed`. `checkBudgets`
> never re-emits E10032; it owns E10033 + the three warnings. Recorded to avoid double-emission.

### Diagnostic messages (§4.13 templates)

| Code   | Sev | Condition            | Message template                                                                 |
| ------ | --- | -------------------- | -------------------------------------------------------------------------------- |
| E10032 | E   | ZP budget exceeded   | `Zero-page budget exceeded — <used> bytes used, platform '<name>' allows <budget> bytes` |
| E10033 | E   | RAM budget exceeded  | `RAM usage (<used> bytes) exceeds platform '<name>' available RAM (<budget> bytes)`       |
| W10030 | W   | Large ZP allocation  | `Zeropage allocation uses <used> of <budget> bytes`                              |
| W10033 | W   | RAM nearing limit    | `RAM usage is <percent>% of platform '<name>' budget`                            |
| W10180 | W   | Stack depth near limit | `Maximum stack depth is <bytes> bytes (<levels> call levels) on platform '<name>' — budget is <budget> bytes` |

All flow through the passed `DiagnosticBag` (R46). The central severity-policy layer (AR-75, RD-11)
can later promote warnings via `--warn-as-error`; the planner itself only `addError`/`addWarning`.

### Error tolerance (R60–R62)

- **R60:** `analyzeStack`/`checkBudgets` never throw; they operate on whatever inputs they receive.
- **R61:** functions with error/unresolved data already produced empty frames (03-01) and are
  skipped naturally; dangling callee names are ignored in DFS.
- **R62:** when `upstreamErrors` is true, `checkBudgets` emits **nothing** (numbers unreliable). For
  RD-05 under the passthrough, `planAllocation` derives `upstreamErrors` from its `bag`/input flag;
  fixtures drive both branches.

## Code Examples

### Stack analysis with an interrupt

```
main → update → handleInput          (main path depth 3)
irq (interrupt) → playSound          (irq path depth 2)

maxMainStackBytes = 3 × 2 = 6
irqOverhead = 6
maxIrqStackBytes = 2 × 2 = 4
totalWorstCase = 6 + 6 + 4 = 16 bytes  (budget 230 → no W10180)
```

## Error Handling

| Error Case                  | Handling Strategy                                       | AR Ref |
| --------------------------- | ------------------------------------------------------- | ------ |
| No `main` in input          | `maxMainDepth = 0`; valid record                        | R60    |
| Upstream errors present     | All budget diagnostics suppressed                       | R62    |
| RAM over budget             | E10033 (pre-ACME); build stops before `.asm`            | R42    |
| ZP over budget              | E10032 emitted by ZP allocator (03-03), not re-emitted  | R41    |

> **Traceability:** maps to RD-05 §4.9/§4.13 and Ch 11 §5/§8, Ch 06 §7.8, Ch 14.

## Testing Requirements

- Unit: longest-path depth for chain/tree; interrupt overhead (+6) added once; total worst case.
- Unit: W10180 fires at/above `stackWarnThreshold`, silent below.
- Unit: E10033 over RAM budget; W10033 in warning band; W10030 for large ZP (not overflowed).
- Unit: `upstreamErrors=true` → zero diagnostics (cascade suppression, R62).
- Unit: E10032 emitted exactly once by the allocator, never duplicated by `checkBudgets`.
- See `07-testing-strategy.md` ST-S1..ST-S6, ST-B1..ST-B6.
