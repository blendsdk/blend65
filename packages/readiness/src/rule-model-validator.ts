import {
  RULE_MODEL_V1_LIMITS,
  type ConstructionPrecondition,
  type InvalidContract,
  type ModelBindingDiagnostic,
  type ModelBindingDiagnosticCode,
  type ModelCitation,
  type ModeledRuleRecord,
  type NonModeledRuleRecord,
  type RuleModelEntryInput,
  type RuleModelReason,
  type RuleModelRegistry,
  type RuleModelRegistryInput,
  type RuleModelRegistryResult,
  type RuleModelScalarType,
  type SpellingKind,
  type TypedDomain,
} from "./model-registry-model.js";
import { inspectPlainDataTree } from "./programmatic-input.js";
import {
  isExecutableOperationRegistry,
  isRuleModelId,
  type ExecutableOperationRegistry,
  type RuleModelOperationKind,
} from "./rule-model-registry.js";

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SOURCE_PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/u;
const REASONS: ReadonlySet<string> = new Set([
  "outside-initial-slice",
  "requires-semantic-oracle",
  "not-source-generatable",
]);
const PRECONDITION_KINDS: ReadonlySet<string> = new Set([
  "type-in",
  "value-range",
  "arity",
  "spelling-in",
]);
const SCALAR_TYPES: ReadonlySet<string> = new Set([
  "byte",
  "sbyte",
  "word",
  "sword",
  "boolean",
  "void",
]);
const SPELLINGS: ReadonlySet<string> = new Set([
  "literal",
  "named-constant",
  "local-variable",
  "parameter",
]);
const OPERATION_FIELD_KINDS = [
  ["constructorIds", "constructor"],
  ["predicateIds", "predicate"],
  ["neighborIds", "neighbor"],
  ["boundaryFamilyIds", "boundary-family"],
] as const satisfies readonly (readonly [string, RuleModelOperationKind])[];

interface OperationAllowlist {
  readonly has: (kind: RuleModelOperationKind, operationId: string) => boolean;
}

function diagnostic(
  code: ModelBindingDiagnosticCode,
  path: string,
  message: string,
): ModelBindingDiagnostic {
  return { code, path, message };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isReason(value: unknown): value is RuleModelReason {
  return typeof value === "string" && REASONS.has(value);
}

function isPreconditionKind(value: unknown): value is ConstructionPrecondition["kind"] {
  return typeof value === "string" && PRECONDITION_KINDS.has(value);
}

function isScalarType(value: unknown): value is RuleModelScalarType {
  return typeof value === "string" && SCALAR_TYPES.has(value);
}

function isSpelling(value: unknown): value is SpellingKind {
  return typeof value === "string" && SPELLINGS.has(value);
}

function isCitation(value: unknown): value is ModelCitation {
  if (!isRecord(value) || !hasOnlyKeys(value, ["sourcePath", "contentHash"])) return false;
  return (
    typeof value.sourcePath === "string" &&
    SOURCE_PATH_PATTERN.test(value.sourcePath) &&
    typeof value.contentHash === "string" &&
    SHA256_PATTERN.test(value.contentHash)
  );
}

function isPrecondition(value: unknown): value is ConstructionPrecondition {
  if (!isRecord(value) || !hasOnlyKeys(value, ["kind", "subject", "values"])) return false;
  return (
    isPreconditionKind(value.kind) &&
    isRuleModelId(value.subject) &&
    isStringArray(value.values) &&
    value.values.length > 0
  );
}

function isTypedDomain(value: unknown): value is TypedDomain {
  if (!isRecord(value) || !hasOnlyKeys(value, ["subject", "type", "values"])) return false;
  return (
    isRuleModelId(value.subject) &&
    isScalarType(value.type) &&
    isStringArray(value.values) &&
    value.values.length > 0
  );
}

function isInvalidContract(value: unknown): value is InvalidContract {
  if (!isRecord(value) || !hasOnlyKeys(value, ["contractId", "diagnosticFamily", "neighborIds"])) {
    return false;
  }
  return (
    isRuleModelId(value.contractId) &&
    isRuleModelId(value.diagnosticFamily) &&
    isStringArray(value.neighborIds) &&
    value.neighborIds.length > 0 &&
    value.neighborIds.every(isRuleModelId)
  );
}

function isModeledRule(value: unknown): value is ModeledRuleRecord {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "ruleId",
      "state",
      "citations",
      "constructionPreconditions",
      "typedDomains",
      "invalidContracts",
      "constructorIds",
      "predicateIds",
      "neighborIds",
      "boundaryFamilyIds",
      "spellings",
    ])
  ) {
    return false;
  }
  return (
    value.state === "modeled" &&
    isRuleModelId(value.ruleId) &&
    Array.isArray(value.citations) &&
    value.citations.length > 0 &&
    value.citations.every(isCitation) &&
    Array.isArray(value.constructionPreconditions) &&
    value.constructionPreconditions.length > 0 &&
    value.constructionPreconditions.every(isPrecondition) &&
    Array.isArray(value.typedDomains) &&
    value.typedDomains.length > 0 &&
    value.typedDomains.every(isTypedDomain) &&
    Array.isArray(value.invalidContracts) &&
    value.invalidContracts.length > 0 &&
    value.invalidContracts.every(isInvalidContract) &&
    isStringArray(value.constructorIds) &&
    value.constructorIds.length > 0 &&
    value.constructorIds.every(isRuleModelId) &&
    isStringArray(value.predicateIds) &&
    value.predicateIds.length > 0 &&
    value.predicateIds.every(isRuleModelId) &&
    isStringArray(value.neighborIds) &&
    value.neighborIds.length > 0 &&
    value.neighborIds.every(isRuleModelId) &&
    isStringArray(value.boundaryFamilyIds) &&
    value.boundaryFamilyIds.length > 0 &&
    value.boundaryFamilyIds.every(isRuleModelId) &&
    Array.isArray(value.spellings) &&
    value.spellings.length > 0 &&
    value.spellings.every(isSpelling)
  );
}

function isNonModeledRule(value: unknown): value is NonModeledRuleRecord {
  if (!isRecord(value) || !hasOnlyKeys(value, ["ruleId", "state", "reason"])) return false;
  return (
    isRuleModelId(value.ruleId) &&
    (value.state === "unmodeled" || value.state === "not-generatable") &&
    isReason(value.reason)
  );
}

function modeledFactDiagnostics(
  entry: Readonly<Record<string, unknown>>,
  index: number,
): readonly ModelBindingDiagnostic[] {
  const base = `/rules/${index}`;
  const diagnostics: ModelBindingDiagnostic[] = [];
  const requireNonEmptyArray = (field: string): readonly unknown[] | undefined => {
    const value = Reflect.get(entry, field);
    if (!Array.isArray(value) || value.length === 0) {
      diagnostics.push(
        diagnostic(
          "model.modeled.incomplete",
          `${base}/${field}`,
          `Modeled rule requires a non-empty ${field} array.`,
        ),
      );
      return undefined;
    }
    return value;
  };

  const citations = requireNonEmptyArray("citations");
  citations?.forEach((citation, citationIndex) => {
    if (!isCitation(citation)) {
      const record = isRecord(citation) ? citation : undefined;
      const field =
        typeof record?.contentHash !== "string" || !SHA256_PATTERN.test(record.contentHash)
          ? "contentHash"
          : "sourcePath";
      diagnostics.push(
        diagnostic(
          "model.modeled.incomplete",
          `${base}/citations/${citationIndex}/${field}`,
          "Citation must contain a safe source path and canonical content hash.",
        ),
      );
    }
  });

  const preconditions = requireNonEmptyArray("constructionPreconditions");
  preconditions?.forEach((precondition, preconditionIndex) => {
    if (!isPrecondition(precondition)) {
      const record = isRecord(precondition) ? precondition : undefined;
      const field =
        !isStringArray(record?.values) || record.values.length === 0
          ? "values"
          : !isPreconditionKind(record.kind)
            ? "kind"
            : "subject";
      diagnostics.push(
        diagnostic(
          "model.modeled.incomplete",
          `${base}/constructionPreconditions/${preconditionIndex}/${field}`,
          "Construction precondition is incomplete.",
        ),
      );
    }
  });

  const typedDomains = requireNonEmptyArray("typedDomains");
  typedDomains?.forEach((domain, domainIndex) => {
    if (!isTypedDomain(domain)) {
      const record = isRecord(domain) ? domain : undefined;
      const field =
        !isStringArray(record?.values) || record.values.length === 0
          ? "values"
          : !isScalarType(record.type)
            ? "type"
            : "subject";
      diagnostics.push(
        diagnostic(
          "model.modeled.incomplete",
          `${base}/typedDomains/${domainIndex}/${field}`,
          "Typed domain is incomplete.",
        ),
      );
    }
  });

  const invalidContracts = requireNonEmptyArray("invalidContracts");
  invalidContracts?.forEach((contract, contractIndex) => {
    if (!isInvalidContract(contract)) {
      const record = isRecord(contract) ? contract : undefined;
      const field = !isRuleModelId(record?.diagnosticFamily)
        ? "diagnosticFamily"
        : !isStringArray(record.neighborIds) || record.neighborIds.length === 0
          ? "neighborIds"
          : "contractId";
      diagnostics.push(
        diagnostic(
          "model.modeled.incomplete",
          `${base}/invalidContracts/${contractIndex}/${field}`,
          "Invalid contract is incomplete.",
        ),
      );
    }
  });

  for (const field of [
    "constructorIds",
    "predicateIds",
    "neighborIds",
    "boundaryFamilyIds",
    "spellings",
  ]) {
    requireNonEmptyArray(field);
  }

  for (const field of [
    "constructorIds",
    "predicateIds",
    "neighborIds",
    "boundaryFamilyIds",
    "spellings",
  ]) {
    const values = Reflect.get(entry, field);
    if (!isStringArray(values) || values.length === 0) continue;
    const unique = new Set(values);
    const sorted = [...values].sort();
    if (
      unique.size !== values.length ||
      values.some((value, valueIndex) => value !== sorted[valueIndex])
    ) {
      diagnostics.push(
        diagnostic(
          "model.modeled.incomplete",
          `${base}/${field}`,
          `${field} must be duplicate-free and lexically ordered.`,
        ),
      );
    }
  }

  const spellings = Reflect.get(entry, "spellings");
  if (isStringArray(spellings)) {
    spellings.forEach((spelling, spellingIndex) => {
      if (!isSpelling(spelling)) {
        diagnostics.push(
          diagnostic(
            "model.modeled.incomplete",
            `${base}/spellings/${spellingIndex}`,
            `Spelling '${spelling}' is not supported.`,
          ),
        );
      }
    });
  }

  const declaredNeighborIds = Reflect.get(entry, "neighborIds");
  if (isStringArray(declaredNeighborIds) && invalidContracts !== undefined) {
    const declared = new Set(declaredNeighborIds);
    invalidContracts.forEach((contract, contractIndex) => {
      if (!isRecord(contract) || !isStringArray(contract.neighborIds)) return;
      contract.neighborIds.forEach((neighborId, neighborIndex) => {
        if (!declared.has(neighborId)) {
          diagnostics.push(
            diagnostic(
              "model.modeled.incomplete",
              `${base}/invalidContracts/${contractIndex}/neighborIds/${neighborIndex}`,
              `Invalid-contract neighbor '${neighborId}' is absent from the rule neighbor list.`,
            ),
          );
        }
      });
    });
  }

  return diagnostics;
}

function operationDiagnostics(
  entry: Readonly<Record<string, unknown>>,
  index: number,
  executableOperations: OperationAllowlist,
): readonly ModelBindingDiagnostic[] {
  const diagnostics: ModelBindingDiagnostic[] = [];
  for (const [field, kind] of OPERATION_FIELD_KINDS) {
    const ids = Reflect.get(entry, field);
    if (!isStringArray(ids)) continue;
    ids.forEach((operationId, operationIndex) => {
      if (!executableOperations.has(kind, operationId)) {
        diagnostics.push(
          diagnostic(
            "model.operation.unknown",
            `/rules/${index}/${field}/${operationIndex}`,
            `Executable ${kind} operation '${operationId}' is not registered for this field.`,
          ),
        );
      }
    });
  }
  return diagnostics;
}

function operationKindFromId(operationId: string): RuleModelOperationKind | undefined {
  if (operationId.startsWith("constructor.")) return "constructor";
  if (operationId.startsWith("predicate.")) return "predicate";
  if (operationId.startsWith("neighbor.")) return "neighbor";
  if (operationId.startsWith("boundary.")) return "boundary-family";
  return undefined;
}

function createOperationAllowlist(input: unknown): {
  readonly allowlist?: OperationAllowlist;
  readonly diagnostics: readonly ModelBindingDiagnostic[];
} {
  if (isExecutableOperationRegistry(input)) {
    return { allowlist: input, diagnostics: [] };
  }
  const structuralFailure = inspectPlainDataTree(input, "/executableOperationIds", () => false);
  if (structuralFailure !== undefined) {
    return {
      diagnostics: [
        diagnostic("model.schema.invalid", structuralFailure.path, structuralFailure.message),
      ],
    };
  }
  if (!Array.isArray(input)) {
    return {
      diagnostics: [
        diagnostic(
          "model.schema.invalid",
          "/executableOperationIds",
          "Executable operations must be an ID array or validated registry.",
        ),
      ],
    };
  }

  const diagnostics: ModelBindingDiagnostic[] = [];
  const idsByKind = new Map<RuleModelOperationKind, Set<string>>();
  const seen = new Set<string>();
  input.forEach((value, index) => {
    if (!isRuleModelId(value) || seen.has(value)) {
      diagnostics.push(
        diagnostic(
          "model.schema.invalid",
          `/executableOperationIds/${index}`,
          "Executable operation IDs must be canonical and unique.",
        ),
      );
      return;
    }
    seen.add(value);
    const kind = operationKindFromId(value);
    if (kind === undefined) {
      diagnostics.push(
        diagnostic(
          "model.schema.invalid",
          `/executableOperationIds/${index}`,
          `Executable operation '${value}' does not identify a closed operation kind.`,
        ),
      );
      return;
    }
    const ids = idsByKind.get(kind) ?? new Set<string>();
    ids.add(value);
    idsByKind.set(kind, ids);
  });
  if (diagnostics.length > 0) return { diagnostics };
  return {
    allowlist: {
      has: (kind, operationId): boolean => idsByKind.get(kind)?.has(operationId) === true,
    },
    diagnostics: [],
  };
}

function cloneModeledRule(entry: ModeledRuleRecord): ModeledRuleRecord {
  return Object.freeze({
    ruleId: entry.ruleId,
    state: "modeled",
    citations: Object.freeze(
      entry.citations.map((citation) =>
        Object.freeze({
          sourcePath: citation.sourcePath,
          contentHash: citation.contentHash,
        }),
      ),
    ),
    constructionPreconditions: Object.freeze(
      entry.constructionPreconditions.map((precondition) =>
        Object.freeze({
          kind: precondition.kind,
          subject: precondition.subject,
          values: Object.freeze([...precondition.values]),
        }),
      ),
    ),
    typedDomains: Object.freeze(
      entry.typedDomains.map((domain) =>
        Object.freeze({
          subject: domain.subject,
          type: domain.type,
          values: Object.freeze([...domain.values]),
        }),
      ),
    ),
    invalidContracts: Object.freeze(
      entry.invalidContracts.map((contract) =>
        Object.freeze({
          contractId: contract.contractId,
          diagnosticFamily: contract.diagnosticFamily,
          neighborIds: Object.freeze([...contract.neighborIds]),
        }),
      ),
    ),
    constructorIds: Object.freeze([...entry.constructorIds]),
    predicateIds: Object.freeze([...entry.predicateIds]),
    neighborIds: Object.freeze([...entry.neighborIds]),
    boundaryFamilyIds: Object.freeze([...entry.boundaryFamilyIds]),
    spellings: Object.freeze([...entry.spellings]),
  });
}

function cloneNonModeledRule(entry: NonModeledRuleRecord): NonModeledRuleRecord {
  return Object.freeze({
    ruleId: entry.ruleId,
    state: entry.state,
    reason: entry.reason,
  });
}

function envelopeDiagnostics(input: unknown): readonly ModelBindingDiagnostic[] {
  if (
    !isRecord(input) ||
    !hasOnlyKeys(input, ["schemaVersion", "registryVersion", "rules"]) ||
    input.schemaVersion !== 1 ||
    !isRuleModelId(input.registryVersion) ||
    !Array.isArray(input.rules) ||
    input.rules.length > RULE_MODEL_V1_LIMITS.maxRules
  ) {
    return [
      diagnostic(
        "model.schema.invalid",
        "",
        "Rule-model input must use the closed version-one registry envelope.",
      ),
    ];
  }
  return [];
}

function validateRuleModelRegistryUnchecked(
  input: unknown,
  inventoryRuleIds: readonly string[],
  executableOperations: OperationAllowlist,
): RuleModelRegistryResult {
  const diagnostics: ModelBindingDiagnostic[] = [...envelopeDiagnostics(input)];
  if (diagnostics.length > 0 || !isRecord(input) || !Array.isArray(input.rules)) {
    return { ok: false, diagnostics };
  }
  const registryVersion = input.registryVersion;
  if (typeof registryVersion !== "string") {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "model.schema.invalid",
          "/registryVersion",
          "Registry version must be a string.",
        ),
      ],
    };
  }

  const inventoryIds = new Set<string>();
  inventoryRuleIds.forEach((ruleId, index) => {
    if (!isRuleModelId(ruleId) || inventoryIds.has(ruleId)) {
      diagnostics.push(
        diagnostic(
          "model.schema.invalid",
          `/inventoryRuleIds/${index}`,
          "Authoritative inventory rule IDs must be canonical and unique.",
        ),
      );
    }
    inventoryIds.add(ruleId);
  });

  const seenRuleIds = new Set<string>();
  const validatedRules: RuleModelEntryInput[] = [];
  const counts = { modeled: 0, unmodeled: 0, "not-generatable": 0 };
  let previousRuleId: string | undefined;

  input.rules.forEach((entry, index) => {
    if (!isRecord(entry) || !isRuleModelId(entry.ruleId)) {
      diagnostics.push(
        diagnostic("model.schema.invalid", `/rules/${index}/ruleId`, "Rule ID is not canonical."),
      );
      return;
    }

    if (previousRuleId !== undefined && entry.ruleId <= previousRuleId) {
      diagnostics.push(
        diagnostic(
          "model.schema.invalid",
          `/rules/${index}/ruleId`,
          "Rule-model entries must be in strict lexical rule-ID order.",
        ),
      );
    }
    previousRuleId = entry.ruleId;

    if (seenRuleIds.has(entry.ruleId)) {
      diagnostics.push(
        diagnostic(
          "model.rule.duplicate",
          `/rules/${index}/ruleId`,
          `Rule '${entry.ruleId}' occurs more than once.`,
        ),
      );
    } else {
      seenRuleIds.add(entry.ruleId);
    }

    if (!inventoryIds.has(entry.ruleId)) {
      diagnostics.push(
        diagnostic(
          "model.rule.unknown",
          `/rules/${index}/ruleId`,
          `Rule '${entry.ruleId}' is absent from the authoritative inventory.`,
        ),
      );
    }

    if (entry.state === "modeled") {
      const factDiagnostics = modeledFactDiagnostics(entry, index);
      diagnostics.push(...factDiagnostics);
      diagnostics.push(...operationDiagnostics(entry, index, executableOperations));
      if (isModeledRule(entry)) {
        validatedRules.push(cloneModeledRule(entry));
        counts.modeled += 1;
      } else if (factDiagnostics.length === 0) {
        diagnostics.push(
          diagnostic(
            "model.schema.invalid",
            `/rules/${index}`,
            "Modeled rule does not match the closed record shape.",
          ),
        );
      }
      return;
    }

    if (isNonModeledRule(entry)) {
      validatedRules.push(cloneNonModeledRule(entry));
      counts[entry.state] += 1;
      return;
    }

    diagnostics.push(
      diagnostic(
        "model.schema.invalid",
        `/rules/${index}/state`,
        "Rule entry does not match a closed coverage state.",
      ),
    );
  });

  for (const ruleId of inventoryRuleIds) {
    if (!seenRuleIds.has(ruleId)) {
      diagnostics.push(
        diagnostic(
          "model.rule.missing",
          "/rules",
          `Authoritative rule '${ruleId}' has no registry entry.`,
        ),
      );
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  const rules = Object.freeze([...validatedRules]);
  const byRuleId = new Map(rules.map((entry) => [entry.ruleId, entry]));
  const registry: RuleModelRegistry = Object.freeze({
    schemaVersion: 1,
    registryVersion,
    rules,
    get: (ruleId: string): RuleModelEntryInput | undefined => byRuleId.get(ruleId),
    has: (ruleId: string): boolean => byRuleId.has(ruleId),
  });
  return { ok: true, registry, counts: Object.freeze(counts), diagnostics: [] };
}

/**
 * Joins parsed rule-model facts exhaustively with inventory and kind-indexed operations.
 *
 * @param input Parsed closed rule-model input.
 * @param inventoryRuleIds Complete authoritative inventory rule IDs.
 * @param executableOperations Executable-operation IDs or a validated operation registry.
 * @returns A validated immutable registry and counts, or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const result = validateRuleModelRegistry(input, inventoryRuleIds, operationIds);
 * ```
 */
export function validateRuleModelRegistry(
  input: RuleModelRegistryInput,
  inventoryRuleIds: readonly string[],
  executableOperations: readonly string[] | ExecutableOperationRegistry,
): RuleModelRegistryResult;
export function validateRuleModelRegistry(
  input: unknown,
  inventoryRuleIds: readonly string[],
  executableOperations: unknown,
): RuleModelRegistryResult;
export function validateRuleModelRegistry(
  input: unknown,
  inventoryRuleIds: readonly string[],
  executableOperations: unknown,
): RuleModelRegistryResult {
  try {
    const inputFailure = inspectPlainDataTree(input, "", () => false);
    if (inputFailure !== undefined) {
      return {
        ok: false,
        diagnostics: [diagnostic("model.schema.invalid", inputFailure.path, inputFailure.message)],
      };
    }
    const inventoryFailure = inspectPlainDataTree(
      inventoryRuleIds,
      "/inventoryRuleIds",
      () => false,
    );
    if (inventoryFailure !== undefined) {
      return {
        ok: false,
        diagnostics: [
          diagnostic("model.schema.invalid", inventoryFailure.path, inventoryFailure.message),
        ],
      };
    }
    const operationResult = createOperationAllowlist(executableOperations);
    if (operationResult.allowlist === undefined) {
      return { ok: false, diagnostics: operationResult.diagnostics };
    }
    return validateRuleModelRegistryUnchecked(input, inventoryRuleIds, operationResult.allowlist);
  } catch {
    return {
      ok: false,
      diagnostics: [
        diagnostic("model.schema.invalid", "", "Rule-model input could not be inspected safely."),
      ],
    };
  }
}
