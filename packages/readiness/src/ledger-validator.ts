import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import { IDENTITY_GENESIS, parseIdentityLedger } from "./identity-ledger.js";
import type {
  ClauseLedgerEntry,
  InventoryDiagnostic,
  InventoryRule,
  InventoryV1,
  RuleIdentityEvent,
  SemanticValidationContext,
  ValidationResult,
} from "./model.js";

function diagnostic(message: string, path: string, relatedPaths: readonly string[] = []) {
  return createDiagnostic({
    phase: "ledger",
    code: "ledger.invalid",
    path,
    relatedPaths,
    message,
  });
}

function lexicalUnique(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

function validateDisposition(
  entry: ClauseLedgerEntry,
  index: number,
  ruleIds: ReadonlySet<string>,
  conflicts: ReadonlyMap<string, InventoryV1["conflicts"][number]>,
  ownedRules: Set<string>,
  fragment: SemanticValidationContext["fragments"][number] | undefined,
  rules: readonly InventoryRule[],
): readonly InventoryDiagnostic[] {
  const path = `$.clauseLedger[${index}]`;
  if (entry.disposition === "mapped") {
    if (entry.ruleIds.length === 0 || !lexicalUnique(entry.ruleIds)) {
      return [
        diagnostic(`Mapped fragment ${entry.fragmentId} has unordered or empty rules.`, path),
      ];
    }
    const ownership = validateOwnedRules(
      entry.ruleIds,
      entry.fragmentId,
      path,
      ruleIds,
      ownedRules,
    );
    return ownership.length === 0
      ? validateSourcedRuleUnion(entry.ruleIds, entry.fragmentId, path, fragment, rules)
      : ownership;
  }
  if (entry.disposition === "decomposed") {
    if (
      entry.childOutcomes.length < 2 ||
      !lexicalUnique(entry.childOutcomes.map(({ outcomeId }) => outcomeId))
    ) {
      return [diagnostic(`Decomposed fragment ${entry.fragmentId} has invalid outcomes.`, path)];
    }
    const outcomeRules = entry.childOutcomes.flatMap(({ ruleIds: ids }) => [...ids]);
    if (
      entry.childOutcomes.some(({ ruleIds: ids }) => ids.length === 0 || !lexicalUnique(ids)) ||
      new Set(outcomeRules).size !== outcomeRules.length
    ) {
      return [
        diagnostic(
          `Decomposed fragment ${entry.fragmentId} assigns a rule to overlapping outcomes: ${outcomeRules.join(", ")}.`,
          path,
        ),
      ];
    }
    const ownership = validateOwnedRules(outcomeRules, entry.fragmentId, path, ruleIds, ownedRules);
    return ownership.length === 0
      ? validateSourcedRuleUnion(outcomeRules, entry.fragmentId, path, fragment, rules)
      : ownership;
  }
  if (entry.disposition === "canonical-restatement") {
    const conflict = conflicts.get(entry.conflictId);
    if (
      !ruleIds.has(entry.canonicalRuleId) ||
      conflict?.classification !== "equivalent-restatement" ||
      conflict.ruleIds.length !== 1 ||
      conflict.ruleIds[0] !== entry.canonicalRuleId
    ) {
      return [
        diagnostic(`Restatement fragment ${entry.fragmentId} has an unknown reference.`, path),
      ];
    }
  } else if (
    entry.disposition === "blocked-errata" &&
    conflicts.get(entry.conflictId)?.classification !== "contradiction"
  ) {
    return [diagnostic(`Blocked fragment ${entry.fragmentId} has an unknown conflict.`, path)];
  }
  return [];
}

function validateSourcedRuleUnion(
  assignedIds: readonly string[],
  fragmentId: string,
  path: string,
  fragment: SemanticValidationContext["fragments"][number] | undefined,
  rules: readonly InventoryRule[],
): readonly InventoryDiagnostic[] {
  if (fragment === undefined) {
    return [diagnostic(`Fragment ${fragmentId} has no resolved source citation.`, path)];
  }
  const expected = rules
    .filter((rule) => citationMatchesFragment(rule.source, fragment))
    .map(({ ruleId }) => ruleId)
    .sort(compareOrdinal);
  const assigned = [...assignedIds].sort(compareOrdinal);
  return equalStringTuples(expected, assigned)
    ? []
    : [diagnostic(`Fragment ${fragmentId} does not own its exact sourced-rule union.`, path)];
}

function validateOwnedRules(
  ids: readonly string[],
  fragmentId: string,
  path: string,
  ruleIds: ReadonlySet<string>,
  ownedRules: Set<string>,
): readonly InventoryDiagnostic[] {
  for (const id of ids) {
    if (!ruleIds.has(id))
      return [diagnostic(`Fragment ${fragmentId} references unknown rule ${id}.`, path)];
    if (ownedRules.has(id))
      return [diagnostic(`Rule ${id} is owned by more than one fragment.`, path)];
    ownedRules.add(id);
  }
  return [];
}

function lineageIds(rule: InventoryRule): readonly string[] {
  return rule.lineage?.supersedes ?? rule.lineage?.splitFrom ?? rule.lineage?.mergedFrom ?? [];
}

function validateLineage(
  rules: readonly InventoryRule[],
  eventByRule: ReadonlyMap<string, readonly RuleIdentityEvent[]>,
): readonly InventoryDiagnostic[] {
  for (const [index, rule] of rules.entries()) {
    const lineageKinds = [
      rule.lineage?.supersedes,
      rule.lineage?.splitFrom,
      rule.lineage?.mergedFrom,
    ].filter((value) => value !== undefined);
    if (lineageKinds.length > 1 || lineageIds(rule).some((id) => id === rule.ruleId)) {
      return [diagnostic(`Rule ${rule.ruleId} has invalid lineage.`, `$.rules[${index}].lineage`)];
    }
    const allocation = eventByRule
      .get(rule.ruleId)
      ?.find(({ operation }) => operation === "allocate");
    if (allocation === undefined) {
      return [
        diagnostic(
          `Rule ${rule.ruleId} does not match its allocation lineage.`,
          `$.rules[${index}]`,
        ),
      ];
    }
    const predecessors = allocation.predecessorRuleIds;
    const successors = new Set<string>();
    for (const predecessor of predecessors) {
      const retirement = eventByRule
        .get(predecessor)
        ?.find(({ operation }) => operation === "retire");
      for (const successor of retirement?.successorRuleIds ?? []) successors.add(successor);
    }
    const expectedKind =
      predecessors.length === 0
        ? undefined
        : predecessors.length === 1 && successors.size === 1
          ? "supersedes"
          : predecessors.length === 1
            ? "splitFrom"
            : successors.size === 1
              ? "mergedFrom"
              : undefined;
    const actual =
      expectedKind === undefined
        ? []
        : [...(rule.lineage?.[expectedKind] ?? [])].sort(compareOrdinal);
    if (
      expectedKind === undefined
        ? lineageKinds.length !== 0
        : !equalStringTuples(actual, [...predecessors].sort(compareOrdinal))
    ) {
      return [
        diagnostic(
          `Rule ${rule.ruleId} does not match its allocation lineage shape.`,
          `$.rules[${index}]`,
        ),
      ];
    }
    for (const predecessor of lineageIds(rule)) {
      const retirement = eventByRule
        .get(predecessor)
        ?.find(({ operation }) => operation === "retire");
      if (retirement === undefined || !retirement.successorRuleIds.includes(rule.ruleId)) {
        return [
          diagnostic(
            `Rule ${rule.ruleId} has non-reciprocal predecessor ${predecessor}.`,
            `$.rules[${index}]`,
          ),
        ];
      }
    }
  }
  return [];
}

/**
 * Validates exhaustive fragment ownership and permanent semantic identity.
 *
 * @example
 * ```ts
 * const result = validateLedger(inventory, context);
 * ```
 */
export function validateLedger(
  inventory: InventoryV1,
  context: SemanticValidationContext,
): ValidationResult {
  const diagnostics: InventoryDiagnostic[] = [];
  const fragmentCounts = new Map<string, number>();
  const fragmentsById = new Map<string, SemanticValidationContext["fragments"][number]>();
  for (const fragment of context.fragments) {
    const id = fragment.fragment.fragmentId;
    fragmentCounts.set(id, (fragmentCounts.get(id) ?? 0) + 1);
    fragmentsById.set(id, fragment);
  }
  const ledgerEntryCounts = new Map<string, number>();
  for (const [index, entry] of inventory.clauseLedger.entries()) {
    fragmentCounts.set(entry.fragmentId, (fragmentCounts.get(entry.fragmentId) ?? 0) - 1);
    const count = (ledgerEntryCounts.get(entry.fragmentId) ?? 0) + 1;
    ledgerEntryCounts.set(entry.fragmentId, count);
    if (count > 1) {
      diagnostics.push(
        diagnostic(
          `Fragment ${entry.fragmentId} has duplicate dispositions.`,
          `$.clauseLedger[${index}]`,
        ),
      );
    }
  }
  for (const [fragmentId, count] of fragmentCounts) {
    if (count !== 0) {
      diagnostics.push(
        diagnostic(
          `Fragment ${fragmentId} does not have exactly one disposition.`,
          "$.clauseLedger",
        ),
      );
    }
  }

  const ruleIds = new Set(inventory.rules.map(({ ruleId }) => ruleId));
  const conflicts = new Map(inventory.conflicts.map((conflict) => [conflict.conflictId, conflict]));
  const ownedRules = new Set<string>();
  inventory.clauseLedger.forEach((entry, index) => {
    diagnostics.push(
      ...validateDisposition(
        entry,
        index,
        ruleIds,
        conflicts,
        ownedRules,
        fragmentsById.get(entry.fragmentId),
        inventory.rules,
      ),
    );
  });
  inventory.rules.forEach((rule, index) => {
    if (!ownedRules.has(rule.ruleId)) {
      diagnostics.push(
        diagnostic(
          `Current rule ${rule.ruleId} has no mapped or decomposed owner.`,
          `$.rules[${index}]`,
        ),
      );
    }
    if (
      rule.applicability !== "mandatory-c64" &&
      rule.applicability !== "blocked-errata" &&
      rule.applicabilityReason === undefined
    ) {
      diagnostics.push(
        diagnostic(`Rule ${rule.ruleId} needs an applicability reason.`, `$.rules[${index}]`),
      );
    }
  });

  const parsed = parseIdentityLedger(context.identityLedgerBytes, context.limits);
  diagnostics.push(...parsed.diagnostics);
  const expectedHead = parsed.events.at(-1)?.eventHash ?? IDENTITY_GENESIS;
  if (expectedHead !== inventory.identityLedgerHead) {
    diagnostics.push(
      diagnostic("The inventory identity head does not match the ledger.", "$.identityLedgerHead"),
    );
  }
  const eventByRule = new Map<string, typeof parsed.events>();
  for (const event of parsed.events) {
    eventByRule.set(event.ruleId, [...(eventByRule.get(event.ruleId) ?? []), event]);
  }
  for (const [index, rule] of inventory.rules.entries()) {
    const events = eventByRule.get(rule.ruleId) ?? [];
    if (
      !events.some(({ operation }) => operation === "allocate") ||
      events.some(({ operation }) => operation === "retire")
    ) {
      diagnostics.push(
        diagnostic(
          `Current rule ${rule.ruleId} is not an active allocated identity.`,
          `$.rules[${index}]`,
        ),
      );
    }
  }
  if (parsed.diagnostics.length === 0)
    diagnostics.push(...validateLineage(inventory.rules, eventByRule));

  const ordered = sortDiagnostics(diagnostics);
  return {
    ok: ordered.length === 0,
    diagnostics: ordered,
    ...(ordered.length === 0 ? { inventory } : {}),
    blockingReasons: [],
  };
}
import { compareOrdinal, equalStringTuples } from "./authority-order.js";
import { citationMatchesFragment } from "./citation-identity.js";
