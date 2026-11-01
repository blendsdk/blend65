# Facts and Pipeline: Full RD-08 Optimizer

> **Document**: 03-01-facts-and-pipeline.md
> **Parent**: [Index](00-index.md)

## Overview

The optimizer reuses the existing semantic and machine program rather than
introducing a new IR. One immutable facts bundle is derived per checked
candidate; an explicit ordered rule runner executes inside the lowering producer
before storage projection. Every rule returns a complete result or rejects only
that rule’s sites.

## Architecture

### Current Architecture

`lowerMachineProgramBody` selects functions, lowers them, discovers storage and
calls `projectMachineStorage`; `closeStorage`, `bindMachineProgram`, shared
layout and final observers follow. The producer seals the exact machine program
and the shared owner rechecks its content.

### Proposed Changes

```text
WholeProgram + checked source + candidate facts
  -> derive OptimizationFacts (once)
  -> lower functions into MachineProgram
  -> ordered machine rule runner (inside producer)
  -> projectMachineStorage / closeStorage / bind
  -> draft + final shared layout, branch repair
  -> final observers + B/R/T selection
```

The runner is internal. It is not a plugin registry, a new IR or a second
scheduler. It never runs after `createLoweringProducer` seals the program and it
never rewrites ACME text.

## Implementation Details

### New Types/Interfaces

```ts
/** Immutable facts shared by all rules for one checked candidate. */
export interface OptimizationFacts {
  readonly program: WholeProgram;
  readonly profile: TargetProfile;
  readonly functions: ReadonlyMap<SemanticFunction, OptimizationFunctionFacts>;
  readonly mode: "size" | "balanced" | "speed";
}

/** Input to the one shared fact derivation. */
export interface OptimizationFactInput {
  readonly checked: CheckedSourceInput;
  readonly mode: "size" | "balanced" | "speed";
}

/** One exact changed source/machine position retained by a rule result. */
export interface RuleSite {
  readonly block: string;
  readonly index: number;
}

/** One applied rule and all sites it changed. */
export interface AppliedRule {
  readonly ruleId: string;
  readonly functions: readonly SemanticFunction[];
  readonly changed: readonly RuleSite[];
  readonly obligations: readonly RuleObligation[];
}

/** Completed in-producer rule pass, or a terminal invariant failure before sealing. */
export type RulePipelineResult =
  | {
      readonly kind: "complete";
      readonly producer: "lowering";
      readonly program: MachineProgram;
      readonly applied: readonly AppliedRule[];
      readonly obligations: readonly RuleObligation[];
    }
  | { readonly kind: "failure"; readonly reason: string; readonly source: SourceSpan | null };

/** Independent validation of the rule result's sites and obligations. */
export type RuleValidation =
  | { readonly kind: "complete"; readonly applied: readonly string[] }
  | { readonly kind: "error"; readonly reason: string; readonly source: SourceSpan | null };

/** Per-function facts assembled from existing pure queries only. */
export interface OptimizationFunctionFacts {
  readonly function: SemanticFunction;
  readonly reachableBlocks: readonly SemanticBlock[];
  readonly lifetimes: ReadonlyMap<string, ValueLifetime>;
  readonly places: ReadonlyMap<string, readonly SemanticPlace[]>;
  readonly loops: readonly FixedLoopFacts[];
  readonly objects: ClosedObjectFacts;
  readonly domains: readonly ExecutionDomain[];
  readonly effects: EffectSummary;
}

/** One deterministic rule result, never a whole-program family verdict. */
export type RuleResult =
  | {
      readonly kind: "applied";
      readonly ruleId: string;
      readonly functions: ReadonlyMap<SemanticFunction, MachineFunction>;
      readonly obligations: readonly RuleObligation[];
      readonly sourceSites: readonly SourceSpan[];
    }
  | { readonly kind: "not-applicable"; readonly ruleId: string }
  | { readonly kind: "rejected"; readonly ruleId: string; readonly reason: string; readonly source: SourceSpan | null };
```

`RuleObligation` is a closed union owned by `03-02`; it never carries an
unchecked Boolean or a bare `pendingObservers` flag.

### New Functions/Methods

```ts
/** Derive the common immutable facts once for one checked candidate. */
export function deriveOptimizationFacts(input: OptimizationFactInput): OptimizationFacts;

/** Execute the explicit ordered rules for one mode. */
export function applyOptimizationRules(
  facts: OptimizationFacts,
  program: MachineProgram,
): RulePipelineResult;

/** Validate that a rule changed only its declared sites and retained its obligations. */
export function validateRuleObligations(result: RulePipelineResult): RuleValidation;
```

`optimization-facts.ts` owns derivation only. `optimization-rules.ts` owns the
ordered runner and rule catalogue. `optimization-cost.ts` owns B/R/T accounting;
it does not choose candidates.

### Integration Points

| Owner | Integration |
|---|---|
| `machine/lower.ts` | Derive facts when the effective mode is optimized; run the explicit rule list after function lowering and before `projectMachineStorage` |
| `machine/lower-function.ts` | Expose the actual function result to rules; no optional rewrite in `none` |
| `storage/selection.ts` | Keep `projectMachineStorage` as the only omission channel; rules update requests only through the existing inventory |
| `services/size-selection.ts` | Pass the facts/mode into lowering; keep the 36-candidate regression frontier |
| `services/size-observers.ts` | Consume rule obligations; preserve canonical fallback for untouched sites |
| `services/shared-storage.ts` | Re-close after any code-size change; no stale draft/final shape |
| `services/evidence.ts` | Consume B/R/T and optimization records without changing none output |
| `layout/c64-layout.ts` | Re-run branch/layout accounting after rule changes |

## Rule Order

The first version is an explicit list, not a registry:

1. dead/copy cleanup after lowering;
2. register and flag forwarding;
3. byte availability, complement and terminal-byte rules;
4. store/capture and word/call forwarding;
5. aggregate copy/return and address-form rules;
6. loop and ordinal rules;
7. layout-dependent branch/page decisions only through the existing layout owner.

Rules that change reachability, inventory or SFA demand force a later closure
iteration; no rule may silently keep a stale request or stale proof.

The foundation rule IDs are exactly:

- `cleanup.copy-forward`
- `cleanup.dead-instruction`
- `cleanup.empty-block`

No other rule is active in Phase 1. A later rule family adds its IDs before its
implementation task is started.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Facts belong to a different source/profile | Terminal internal failure; no candidate publication | AR-009 |
| Rule overlaps undeclared sites | Reject the rule result; retain canonical fallback | AR-007 |
| Rule leaves stale storage request/binder site | Terminal incomplete certificate; no publication | AR-008 |
| Rule changes code after producer sealing | Invariant failure; never run post-lowering | AR-008 |
| Layout/SFA shape changes after draft | Re-close through shared storage; reject tuple if nonconvergent | AR-008 |
| Unknown fact blocks a rule | Leave the site unchanged; never guess | AR-007, AR-010 |

## Testing Requirements

- Unit tests for facts identity, stale-source rejection and deterministic order.
- Rule tests for declared-site containment, obligation closure and canonical fallback.
- Integration tests for lowering/projection/closure/layout after a rule.
- None artifact identity and 27/27 frontier regression tests.
