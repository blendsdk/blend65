import { uniquePaths, sortBlockingReasons } from "./blocking-reasons.js";
import { citationTuple, fragmentCitationTuple } from "./citation-identity.js";
import { compareStringTuples } from "./authority-order.js";
import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import type {
  ConflictRecord,
  InventoryDiagnostic,
  InventoryV1,
  ReadinessBlockingReason,
  SemanticValidationContext,
  ValidationResult,
} from "./model.js";

function lexicalUnique(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

function conflictDiagnostic(index: number, message: string): InventoryDiagnostic {
  return createDiagnostic({
    phase: "conflict",
    code: "conflict.invalid",
    path: `$.conflicts[${index}]`,
    message,
  });
}

function validateRecord(
  conflict: ConflictRecord,
  index: number,
  ruleIds: ReadonlySet<string>,
  citationTuples: readonly (readonly string[])[],
): readonly InventoryDiagnostic[] {
  if (
    conflict.citations.length === 0 ||
    citationTuples.some(
      (tuple, position) =>
        position > 0 && compareStringTuples(citationTuples[position - 1], tuple) >= 0,
    ) ||
    !lexicalUnique(conflict.ruleIds) ||
    conflict.ruleIds.some((id) => !ruleIds.has(id))
  ) {
    return [
      conflictDiagnostic(
        index,
        `Conflict ${conflict.conflictId} has invalid references or ordering.`,
      ),
    ];
  }
  if (conflict.classification === "equivalent-restatement" && conflict.ruleIds.length !== 1) {
    return [
      conflictDiagnostic(
        index,
        `Equivalent restatement ${conflict.conflictId} must name one rule.`,
      ),
    ];
  }
  if (
    (conflict.classification === "duplicate-ownership" ||
      conflict.classification === "overlapping-obligation") &&
    conflict.ruleIds.length === 0
  ) {
    return [conflictDiagnostic(index, `Conflict ${conflict.conflictId} must name affected rules.`)];
  }
  if (conflict.classification === "contradiction" && conflict.ruleIds.length !== 0) {
    return [
      conflictDiagnostic(
        index,
        `Contradiction ${conflict.conflictId} cannot name a passable rule.`,
      ),
    ];
  }
  return [];
}

/**
 * Produces an unambiguous map key for a normalized citation tuple.
 *
 * JSON string encoding preserves every tuple boundary, unlike joining with a delimiter that may
 * also occur in source text. Both source citations and resolved fragments use this same key.
 */
function citationIdentityKey(tuple: readonly string[]): string {
  return JSON.stringify(tuple);
}

/**
 * Validates reviewed conflict aggregates without attempting prose inference.
 *
 * @example
 * ```ts
 * const result = validateConflicts(inventory, context);
 * ```
 */
export function validateConflicts(
  inventory: InventoryV1,
  context: SemanticValidationContext,
): ValidationResult {
  const diagnostics: InventoryDiagnostic[] = [];
  const reasons: ReadinessBlockingReason[] = [];
  const ruleIds = new Set(inventory.rules.map(({ ruleId }) => ruleId));
  const ruleSourceKeyById = new Map(
    inventory.rules.map((rule) => [rule.ruleId, citationIdentityKey(citationTuple(rule.source))]),
  );
  const conflictById = new Map<
    string,
    { readonly record: ConflictRecord; readonly citationKeys: ReadonlySet<string> }
  >();
  const contradictionCitationKeys = new Set<string>();
  const fragmentById = new Map<string, (typeof context.fragments)[number]>();
  const fragmentMatchCounts = new Map<string, number>();
  for (const fragment of context.fragments) {
    if (!fragmentById.has(fragment.fragment.fragmentId)) {
      fragmentById.set(fragment.fragment.fragmentId, fragment);
    }
    const key = citationIdentityKey(fragmentCitationTuple(fragment));
    fragmentMatchCounts.set(key, (fragmentMatchCounts.get(key) ?? 0) + 1);
  }

  inventory.conflicts.forEach((conflict, index) => {
    const citationTuples = conflict.citations.map(citationTuple);
    const citationKeys = citationTuples.map(citationIdentityKey);
    if (conflictById.has(conflict.conflictId)) {
      diagnostics.push(
        conflictDiagnostic(index, `Conflict ID ${conflict.conflictId} is duplicated.`),
      );
    }
    conflictById.set(conflict.conflictId, {
      record: conflict,
      citationKeys: new Set(citationKeys),
    });
    diagnostics.push(...validateRecord(conflict, index, ruleIds, citationTuples));
    conflict.citations.forEach((citation, citationIndex) => {
      if (fragmentMatchCounts.get(citationKeys[citationIndex]) !== 1) {
        diagnostics.push(
          conflictDiagnostic(
            index,
            `Conflict citation ${citation.path} must resolve to exactly one source fragment.`,
          ),
        );
      }
    });
    if (conflict.classification === "contradiction") {
      conflict.citations.forEach((citation, citationIndex) => {
        const key = citationKeys[citationIndex];
        if (contradictionCitationKeys.has(key)) {
          diagnostics.push(
            conflictDiagnostic(index, `Contradiction citation ${citation.path} is shared.`),
          );
        }
        contradictionCitationKeys.add(key);
      });
      reasons.push({
        kind: "unresolved-source-conflict",
        identity: conflict.conflictId,
        sourcePaths: uniquePaths(conflict.citations.map(({ path }) => path)),
      });
    }
  });

  inventory.clauseLedger.forEach((entry, index) => {
    const fragment = fragmentById.get(entry.fragmentId);
    const fragmentKey =
      fragment === undefined ? undefined : citationIdentityKey(fragmentCitationTuple(fragment));
    if (entry.disposition === "canonical-restatement") {
      const conflict = conflictById.get(entry.conflictId);
      const ownerSourceKey = ruleSourceKeyById.get(entry.canonicalRuleId);
      if (
        fragment === undefined ||
        conflict === undefined ||
        fragmentKey === undefined ||
        !conflict.citationKeys.has(fragmentKey) ||
        ownerSourceKey === undefined ||
        !conflict.citationKeys.has(ownerSourceKey)
      ) {
        diagnostics.push(
          createDiagnostic({
            phase: "conflict",
            code: "conflict.restatement",
            path: `$.clauseLedger[${index}]`,
            message: `Restatement fragment ${entry.fragmentId} is not bound to its conflict citations and owner.`,
          }),
        );
      }
    }
    if (entry.disposition === "blocked-errata") {
      const conflict = conflictById.get(entry.conflictId);
      if (
        conflict?.record.classification !== "contradiction" ||
        fragment === undefined ||
        fragmentKey === undefined ||
        !conflict.citationKeys.has(fragmentKey)
      ) {
        diagnostics.push(
          createDiagnostic({
            phase: "conflict",
            code: "conflict.blocked",
            path: `$.clauseLedger[${index}]`,
            message: `Blocked fragment ${entry.fragmentId} does not reference a contradiction.`,
          }),
        );
      } else {
        reasons.push({
          kind: "blocked-errata",
          identity: entry.fragmentId,
          sourcePaths: uniquePaths(conflict.record.citations.map(({ path }) => path)),
        });
      }
    }
  });

  const ordered = sortDiagnostics(diagnostics);
  return {
    ok: ordered.length === 0,
    diagnostics: ordered,
    ...(ordered.length === 0 ? { inventory } : {}),
    blockingReasons: ordered.length === 0 ? sortBlockingReasons(reasons) : [],
  };
}
