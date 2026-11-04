import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { ExecutionDomain } from "../semantic/interrupt-domains.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import type { SemanticFunction } from "../semantic/operations.js";
import type { StorageRange } from "../storage/storage-types.js";
import type { MachineProgram } from "./machine-types.js";
import type { OptimizationFacts } from "./optimization-facts.js";
import { applyFoundationCleanup, cleanupObligations } from "./optimization-cleanup.js";

/** One exact before/after component retained by a cost obligation. */
export interface CostComponent {
  readonly component: "B" | "R" | "T";
  readonly value: string;
}

/** Closed obligations attached to one applied rule. */
export type RuleObligation =
  | { readonly kind: "source-equivalence"; readonly sites: readonly SourceSpan[] }
  | { readonly kind: "value-definition"; readonly value: string; readonly definition: unknown }
  | { readonly kind: "alias-disjoint"; readonly left: StorageRange; readonly right: StorageRange }
  | {
      readonly kind: "effect-order";
      readonly before: readonly SourceSpan[];
      readonly after: readonly SourceSpan[];
    }
  | { readonly kind: "borrow-complete"; readonly requestId: string; readonly call: SourceSpan }
  | { readonly kind: "loop-shape"; readonly loop: FixedLoopFacts }
  | { readonly kind: "byte-window"; readonly producer: SourceSpan; readonly use: SourceSpan }
  | {
      readonly kind: "interrupt-domain";
      readonly function: BindingId;
      readonly domain: ExecutionDomain;
    }
  | { readonly kind: "final-layout"; readonly sites: readonly SourceSpan[] }
  | { readonly kind: "cost"; readonly before: CostComponent; readonly after: CostComponent };

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

/** The only rule identities admitted by the foundation pipeline. */
export const FOUNDATION_RULE_IDS: readonly string[] = Object.freeze([
  "cleanup.argument-delivery",
  "cleanup.copy-parameter-local",
  "cleanup.entry-reload",
  "cleanup.fold-register-reload",
  "cleanup.copy-forward",
  "cleanup.dead-store",
  "cleanup.dead-instruction",
  "cleanup.empty-block",
]);

/** List machine source owners when the lowered program carries no sealed source facts. */
function machineSourceKeys(program: MachineProgram): readonly string[] {
  return program.functions
    .flatMap((fn) =>
      fn.sourceFunction === undefined ? [] : [bindingIdentityKey(fn.sourceFunction)],
    )
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** List every closed source function identity in one fact bundle. */
function factSourceKeys(program: OptimizationFacts["program"]): ReadonlySet<string> {
  return new Set(program.semantic.functions.map((fn) => bindingIdentityKey(fn.id)));
}

/** Execute the explicit foundation rules; Phase 1 intentionally has no matching rule. */
export function applyOptimizationRules(
  facts: OptimizationFacts,
  program: MachineProgram,
): RulePipelineResult {
  const sealed = program.storageSelection?.sourceFacts;
  if (sealed !== undefined && sealed.program !== facts.program)
    return Object.freeze({
      kind: "failure",
      reason: "Optimization facts belong to a different checked source",
      source: null,
    });
  // A canonical reference lowers only reachable functions, so every machine source
  // owner must belong to the facts program; the reverse is not required.
  if (sealed === undefined) {
    const covered = factSourceKeys(facts.program);
    if (!machineSourceKeys(program).every((key) => covered.has(key)))
      return Object.freeze({
        kind: "failure",
        reason: "Optimization facts do not cover the lowered machine source",
        source: null,
      });
  }
  const profileId = program.storageProfileId ?? program.storageProfile?.profileId;
  if (profileId !== undefined && profileId !== facts.profile.id)
    return Object.freeze({
      kind: "failure",
      reason: "Optimization facts belong to a different target profile",
      source: null,
    });
  const cleanup = applyFoundationCleanup(facts, program);
  if (cleanup.applied.length === 0)
    return Object.freeze({
      kind: "complete",
      producer: "lowering",
      program,
      applied: Object.freeze([]),
      obligations: Object.freeze([]),
    });
  return Object.freeze({
    kind: "complete",
    producer: "lowering",
    program: Object.freeze({ ...program, functions: cleanup.functions }),
    applied: cleanup.applied,
    obligations: cleanupObligations(cleanup.applied),
  });
}

/** Validate only the rule identities/sites present in a completed result. */
export function validateRuleObligations(result: RulePipelineResult): RuleValidation {
  if (result.kind === "failure")
    return Object.freeze({
      kind: "error",
      reason: result.reason,
      source: result.source,
    });
  const ids = result.applied.map(({ ruleId }) => ruleId);
  if (new Set(ids).size !== ids.length)
    return Object.freeze({
      kind: "error",
      reason: "A rule identity was applied more than once",
      source: null,
    });
  for (const rule of result.applied) {
    if (!FOUNDATION_RULE_IDS.includes(rule.ruleId))
      return Object.freeze({
        kind: "error",
        reason: `Unknown foundation rule identity: ${rule.ruleId}`,
        source: null,
      });
    if (rule.functions.length === 0 || rule.changed.length === 0)
      return Object.freeze({
        kind: "error",
        reason: `Rule ${rule.ruleId} has no declared changes`,
        source: null,
      });
  }
  return Object.freeze({ kind: "complete", applied: Object.freeze(ids) });
}
