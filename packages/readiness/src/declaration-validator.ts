import { sortBlockingReasons, uniquePaths } from "./blocking-reasons.js";
import { compareOrdinal, equalStringTuples } from "./authority-order.js";
import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import type {
  HandlerKind,
  InventoryDiagnostic,
  InventoryRule,
  InventoryV1,
  ReadinessBlockingReason,
  ValidationResult,
} from "./model.js";

const CAPABILITY_IDS = ["frontend", "compiler-api", "cli", "emit", "acme", "vice"] as const;

function diagnostic(path: string, message: string): InventoryDiagnostic {
  return createDiagnostic({
    phase: "declaration",
    code: "declaration.invalid",
    path,
    message,
  });
}

function lexicalUnique(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

function validateReferences(
  rule: InventoryRule,
  index: number,
  declarations: ReadonlyMap<string, { readonly kind: HandlerKind; readonly binding: string }>,
  reasons: ReadinessBlockingReason[],
): readonly InventoryDiagnostic[] {
  const diagnostics: InventoryDiagnostic[] = [];
  const lists: readonly [HandlerKind, readonly string[]][] = [
    ["generator", rule.generatorIds],
    ["oracle", rule.oracleIds],
    ["transform", rule.transformIds],
  ];
  for (const [kind, ids] of lists) {
    if (!lexicalUnique(ids)) {
      diagnostics.push(
        diagnostic(
          `$.rules[${index}].${kind}Ids`,
          `Rule ${rule.ruleId} has unordered ${kind} IDs.`,
        ),
      );
    }
    for (const id of ids) {
      const declaration = declarations.get(id);
      if (declaration?.kind !== kind) {
        diagnostics.push(
          diagnostic(
            `$.rules[${index}]`,
            `Rule ${rule.ruleId} references missing or wrong-kind ${kind} ${id}.`,
          ),
        );
      } else if (declaration.binding === "unbound") {
        reasons.push({ kind: "unbound-handler", identity: id, sourcePaths: [rule.source.path] });
      }
    }
  }
  const hasHandlers = lists.some(([, ids]) => ids.length > 0);
  if (hasHandlers === (rule.handlerAbsenceReason !== undefined)) {
    diagnostics.push(
      diagnostic(
        `$.rules[${index}]`,
        `Rule ${rule.ruleId} has inconsistent handler absence metadata.`,
      ),
    );
  }
  return diagnostics;
}

/**
 * Validates executable declarations and observable evidence capabilities.
 *
 * Unbound declarations are valid metadata and are returned as readiness
 * blockers rather than semantic errors.
 */
export function validateDeclarations(inventory: InventoryV1): ValidationResult {
  const diagnostics: InventoryDiagnostic[] = [];
  const reasons: ReadinessBlockingReason[] = [];
  const handlers = new Map<string, (typeof inventory.handlerDeclarations)[number]>();
  inventory.handlerDeclarations.forEach((declaration, index) => {
    if (handlers.has(declaration.id)) {
      diagnostics.push(
        diagnostic(
          `$.handlerDeclarations[${index}]`,
          `Handler ID ${declaration.id} is duplicated.`,
        ),
      );
    }
    handlers.set(declaration.id, declaration);
  });

  const capabilities = new Map<string, (typeof inventory.evidenceCapabilityDeclarations)[number]>();
  inventory.evidenceCapabilityDeclarations.forEach((declaration, index) => {
    if (capabilities.has(declaration.id)) {
      diagnostics.push(
        diagnostic(
          `$.evidenceCapabilityDeclarations[${index}]`,
          `Capability ID ${declaration.id} is duplicated.`,
        ),
      );
    }
    capabilities.set(declaration.id, declaration);
  });
  if (
    !equalStringTuples(
      [...inventory.evidenceCapabilityDeclarations.map(({ id }) => id)].sort(compareOrdinal),
      [...CAPABILITY_IDS].sort(compareOrdinal),
    )
  ) {
    diagnostics.push(
      diagnostic(
        "$.evidenceCapabilityDeclarations",
        "The six authoritative capability declarations are required in policy order.",
      ),
    );
  }

  inventory.rules.forEach((rule, index) => {
    diagnostics.push(...validateReferences(rule, index, handlers, reasons));
    if (!lexicalUnique(rule.evidenceObligations)) {
      diagnostics.push(
        diagnostic(
          `$.rules[${index}].evidenceObligations`,
          `Rule ${rule.ruleId} has unordered evidence obligations.`,
        ),
      );
    }
    for (const id of rule.evidenceObligations) {
      const declaration = capabilities.get(id);
      if (declaration === undefined) {
        diagnostics.push(
          diagnostic(
            `$.rules[${index}]`,
            `Rule ${rule.ruleId} references unknown capability ${id}.`,
          ),
        );
      } else if (declaration.binding === "unbound") {
        reasons.push({
          kind: "unbound-evidence-capability",
          identity: id,
          sourcePaths: [rule.source.path],
        });
      }
    }
  });

  const mergedReasons = new Map<
    ReadinessBlockingReason["kind"],
    Map<string, ReadinessBlockingReason>
  >();
  for (const reason of reasons) {
    const byIdentity = mergedReasons.get(reason.kind) ?? new Map<string, ReadinessBlockingReason>();
    const previous = byIdentity.get(reason.identity);
    byIdentity.set(reason.identity, {
      ...reason,
      sourcePaths: uniquePaths([...(previous?.sourcePaths ?? []), ...reason.sourcePaths]),
    });
    mergedReasons.set(reason.kind, byIdentity);
  }
  const ordered = sortDiagnostics(diagnostics);
  return {
    ok: ordered.length === 0,
    diagnostics: ordered,
    ...(ordered.length === 0 ? { inventory } : {}),
    blockingReasons:
      ordered.length === 0
        ? sortBlockingReasons([...mergedReasons.values()].flatMap((values) => [...values.values()]))
        : [],
  };
}
