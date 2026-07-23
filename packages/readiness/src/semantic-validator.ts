import { sortBlockingReasons } from "./blocking-reasons.js";
import { compareOrdinal } from "./authority-order.js";
import { createDiagnostic } from "./diagnostics.js";
import { validateConflicts } from "./conflict-validator.js";
import { validateDeclarations } from "./declaration-validator.js";
import { validateLedger } from "./ledger-validator.js";
import { validateRuleGraph } from "./rule-graph.js";
import type { InventoryV1, SemanticValidationContext, ValidationResult } from "./model.js";

function duplicateRuleResult(inventory: InventoryV1): ValidationResult | undefined {
  const paths = new Map<string, string[]>();
  inventory.rules.forEach((rule, index) => {
    const values = paths.get(rule.ruleId) ?? [];
    values.push(`$.rules[${index}].ruleId`);
    paths.set(rule.ruleId, values);
  });
  const duplicate = [...paths]
    .filter(([, values]) => values.length > 1)
    .sort(([a], [b]) => compareOrdinal(a, b))[0];
  if (duplicate === undefined) return undefined;
  const [ruleId, relatedPaths] = duplicate;
  return {
    ok: false,
    diagnostics: [
      createDiagnostic({
        phase: "ledger",
        code: "ledger.duplicate-rule",
        path: "$.rules",
        relatedPaths,
        message: `Rule ID ${ruleId} is duplicated.`,
      }),
    ],
    blockingReasons: [],
  };
}

function duplicateFragmentResult(context: SemanticValidationContext): ValidationResult | undefined {
  const seen = new Map<string, Set<string>>();
  for (const fragment of context.fragments) {
    const ids = seen.get(fragment.sourcePath) ?? new Set<string>();
    if (ids.has(fragment.fragment.fragmentId)) {
      return {
        ok: false,
        diagnostics: [
          createDiagnostic({
            phase: "ledger",
            code: "ledger.duplicate-fragment",
            path: "$.fragments",
            message: `Resolved fragment ${fragment.fragment.fragmentId} is duplicated for ${fragment.sourcePath}.`,
          }),
        ],
        blockingReasons: [],
      };
    }
    ids.add(fragment.fragment.fragmentId);
    seen.set(fragment.sourcePath, ids);
  }
  return undefined;
}

/**
 * Runs semantic passes in prerequisite order and stops at the first failure.
 *
 * @example
 * ```ts
 * const result = validateInventorySemantics(inventory, context);
 * ```
 */
export function validateInventorySemantics(
  inventory: InventoryV1,
  context: SemanticValidationContext,
): ValidationResult {
  const duplicate = duplicateRuleResult(inventory) ?? duplicateFragmentResult(context);
  if (duplicate !== undefined) return duplicate;

  const ledger = validateLedger(inventory, context);
  if (!ledger.ok) return ledger;
  const conflicts = validateConflicts(inventory, context);
  if (!conflicts.ok) return conflicts;
  const declarations = validateDeclarations(inventory);
  if (!declarations.ok) return declarations;
  const graph = validateRuleGraph(inventory);
  if (!graph.ok) {
    return { ok: false, diagnostics: graph.diagnostics, blockingReasons: [] };
  }
  return {
    ok: true,
    diagnostics: [],
    inventory,
    topologicalRuleIds: graph.topologicalRuleIds!,
    blockingReasons: sortBlockingReasons([
      ...conflicts.blockingReasons,
      ...declarations.blockingReasons,
    ]),
  };
}
