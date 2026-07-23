import { uniquePaths, sortBlockingReasons } from "./blocking-reasons.js";
import { compareCitations, citationMatchesFragment, citationTuple } from "./citation-identity.js";
import { equalStringTuples } from "./authority-order.js";
import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import type {
  ConflictRecord,
  InventoryDiagnostic,
  InventoryV1,
  ReadinessBlockingReason,
  SemanticValidationContext,
  SourceCitation,
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
): readonly InventoryDiagnostic[] {
  if (
    conflict.citations.length === 0 ||
    conflict.citations.some(
      (citation, position) =>
        position > 0 && compareCitations(conflict.citations[position - 1], citation) >= 0,
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
  const conflictById = new Map<string, ConflictRecord>();
  const contradictionCitations: SourceCitation[] = [];

  inventory.conflicts.forEach((conflict, index) => {
    if (conflictById.has(conflict.conflictId)) {
      diagnostics.push(
        conflictDiagnostic(index, `Conflict ID ${conflict.conflictId} is duplicated.`),
      );
    }
    conflictById.set(conflict.conflictId, conflict);
    diagnostics.push(...validateRecord(conflict, index, ruleIds));
    for (const citation of conflict.citations) {
      const matches = context.fragments.filter((fragment) =>
        citationMatchesFragment(citation, fragment),
      );
      if (matches.length !== 1) {
        diagnostics.push(
          conflictDiagnostic(
            index,
            `Conflict citation ${citation.path} must resolve to exactly one source fragment.`,
          ),
        );
      }
    }
    if (conflict.classification === "contradiction") {
      for (const citation of conflict.citations) {
        if (
          contradictionCitations.some((existing) =>
            equalStringTuples(citationTuple(existing), citationTuple(citation)),
          )
        ) {
          diagnostics.push(
            conflictDiagnostic(index, `Contradiction citation ${citation.path} is shared.`),
          );
        }
        contradictionCitations.push(citation);
      }
      reasons.push({
        kind: "unresolved-source-conflict",
        identity: conflict.conflictId,
        sourcePaths: uniquePaths(conflict.citations.map(({ path }) => path)),
      });
    }
  });

  inventory.clauseLedger.forEach((entry, index) => {
    const fragment = context.fragments.find(
      ({ fragment }) => fragment.fragmentId === entry.fragmentId,
    );
    if (entry.disposition === "canonical-restatement") {
      const conflict = conflictById.get(entry.conflictId);
      const owner = inventory.rules.find(({ ruleId }) => ruleId === entry.canonicalRuleId);
      if (
        fragment === undefined ||
        conflict === undefined ||
        !conflict.citations.some((citation) => citationMatchesFragment(citation, fragment)) ||
        owner === undefined ||
        !conflict.citations.some((citation) =>
          equalStringTuples(citationTuple(citation), citationTuple(owner.source)),
        )
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
        conflict?.classification !== "contradiction" ||
        fragment === undefined ||
        !conflict.citations.some((citation) => citationMatchesFragment(citation, fragment))
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
          sourcePaths: uniquePaths(conflict.citations.map(({ path }) => path)),
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
