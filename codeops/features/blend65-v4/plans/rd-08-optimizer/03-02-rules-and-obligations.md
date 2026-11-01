# Rules and Obligations: Full RD-08 Optimizer

> **Document**: 03-02-rules-and-obligations.md
> **Parent**: [Index](00-index.md)

## Overview

A rule may change only the sites it names and must return proof obligations for
every changed value, effect, alias, placement, ABI, interrupt and cost fact. If
any obligation is unavailable, the rule leaves the site unchanged. Untouched
code is not re-proved by the rule; the existing canonical proof and fallback
remain binding.

## Architecture

### Current Architecture

The current candidate path has whole-program family gates. One unsupported
borrow, raw operation, interrupt route or scalar/aggregate shape can reject the
whole candidate even when the optimized site is unrelated. This is safe but
prevents composition.

### Proposed Changes

Each rule returns a closed `RuleObligation` list. The final observer dispatches
those obligations to existing concern owners (alias, raw, borrow, loop, byte,
SFA, layout, interrupt, cost). A rule cannot assert “safe”; it must prove its
own changed facts and preserve the canonical fallback for every unmatched use.

## Implementation Details

### New Types/Interfaces

```ts
/** One exact before/after component retained by a cost obligation. */
export interface CostComponent {
  readonly component: "B" | "R" | "T";
  readonly value: string;
}

/** Closed obligations attached to one applied rule. */
export type RuleObligation =
  | { readonly kind: "source-equivalence"; readonly sites: readonly SourceSpan[] }
  | { readonly kind: "value-definition"; readonly value: string; readonly definition: SemanticPosition }
  | { readonly kind: "alias-disjoint"; readonly left: StorageRange; readonly right: StorageRange }
  | { readonly kind: "effect-order"; readonly before: readonly SourceSpan[]; readonly after: readonly SourceSpan[] }
  | { readonly kind: "borrow-complete"; readonly requestId: string; readonly call: SourceSpan }
  | { readonly kind: "loop-shape"; readonly loop: FixedLoopFacts }
  | { readonly kind: "byte-window"; readonly producer: SourceSpan; readonly use: SourceSpan }
  | { readonly kind: "interrupt-domain"; readonly function: BindingId; readonly domain: ExecutionDomain }
  | { readonly kind: "final-layout"; readonly sites: readonly SourceSpan[] }
  | { readonly kind: "cost"; readonly before: CostComponent; readonly after: CostComponent };
```

The obligation union is intentionally closed. A rule that needs a new proof
category stops and returns a finding; it does not add an untyped escape hatch.

### Rule Catalogue

| Rule family | First use | Required obligations |
|---|---|---|
| Dead/copy cleanup | Foundation | source equivalence, value definition, SFA request update |
| Register/flag forwarding | Saved | value definition, flag dominance, ABI/call boundaries |
| Byte availability/complement | Saved | byte window, producer dominance, volatile/alias exclusion |
| Store/capture/word forwarding | Saved | alias disjointness, effect order, memory occupancy |
| Aggregate copy/return | Saved | source equivalence, alias/lifetime, caller-owned destination |
| Loop/ordinal/address | Saved | loop shape, ordinal bounds, wrap/page proof |
| Async/raw/MMIO (acquisition) | Acquisition | interrupt domain, raw footprint, MMIO order/count, both layouts |
| Global aggregate return | Acquisition | caller-owned destination, alias/escape, SFA/ABI closure |
| Composed LowByte/loop/interrupt | Acquisition | all component obligations plus shared resource/order closure |

A rule family is admitted only when its behavior oracle and assembly/cost oracle
are both defined. The two oracles are independent: matching source output does
not prove the intended machine form. Every family traces to AR-007/AR-014; the
saved/acquisition ordering traces to AR-005/AR-015.

## Rule Execution Contract

1. Match only actual source/machine identities in `OptimizationFacts`.
2. Record every changed instruction/block and every source site.
3. Return `applied` only when all obligations are complete; otherwise
   `not-applicable` or `rejected` for that rule.
4. Preserve `pendingObservers` and canonical fallback for untouched operations.
5. Update storage requests and binder instruction sites before projection.
6. Re-run closure/layout after any size change; never preserve stale homes.
7. Never select based on a local byte saving alone; the candidate must pass the
   complete B/R/T comparison.

## Error Handling

| Error Case | Handling | AR Ref |
|---|---|---|
| Rule matched an unsupported source shape | Leave unchanged; canonical fallback | AR-007 |
| Rule obligation is incomplete | Reject that rule result only | AR-007 |
| Rule changed an undeclared site | Terminal internal failure; stop candidate | AR-007 |
| Rule introduces a new proof category | Stop and return a finding; no untyped extension | AR-007 |
| Rule creates stale SFA/layout facts | Re-close; reject tuple if unstable | AR-008 |
| Async/raw/MMIO obligation unknown | Leave unchanged; never guess | AR-007, AR-010 |

## Testing Requirements

- Each rule has a positive assembly/behavior case and at least one discriminating negative.
- Obligation completeness and source-site containment are tested independently.
- A rule rejection must leave canonical output byte-identical.
- The 27/27 frontier and `none` identity suites remain regression gates.
