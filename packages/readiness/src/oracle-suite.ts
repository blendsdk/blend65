import { validateInventorySchema } from "./schema-validator.js";
import type { InventoryV1 } from "./model.js";
import { getRuleGenerationDomain } from "./modeled-generator-suite.js";
import type { ModeledGeneratorSuite } from "./modeled-generator-model.js";
import { MODELED_GENERATOR_SUITE_CAPABILITY } from "./modeled-generator-model.js";
import { isFactoryRevisionRegistry, type RevisionRegistry } from "./revision-registry.js";
import {
  EXPECTED_DIAGNOSTIC_AUTHORITY,
  validateBindingAuthorityCandidate,
  validateDiagnosticAuthorityCandidate,
} from "./oracle-authority-policy.js";
import {
  acceptedBindingManifest,
  parseBindingRejectionCandidate,
} from "./oracle-binding-rejection.js";
import {
  acceptedDiagnosticManifest,
  parseDiagnosticOracleCandidate,
} from "./oracle-diagnostic-input.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
  type OracleFailure,
} from "./oracle-input.js";
import {
  ORACLE_SUITE_CAPABILITY,
  type BindingRejectionManifestV1,
  type BindingRejectionRecordV1,
  type DiagnosticContextV1,
  type DiagnosticOracleManifestV1,
  type DiagnosticOracleRecordV1,
  type OracleHandlerIdV1,
  type OracleSuite,
  type OracleSuiteResult,
} from "./oracle-model.js";

/** Module-private immutable data retained behind one valid suite capability. */
export interface OracleSuiteState {
  /** Reviewed modeled generator capability. */
  readonly modeledSuite: ModeledGeneratorSuite;
  /** Complete exact replay registry used for request regeneration. */
  readonly replayRegistry: RevisionRegistry;
  /** Snapshotted validated inventory authority. */
  readonly inventory: InventoryV1;
  /** Exact accepted compiler-diagnostic authority. */
  readonly diagnosticManifest: DiagnosticOracleManifestV1;
  /** Exact accepted external binding-rejection authority. */
  readonly bindingManifest: BindingRejectionManifestV1;
  /** Compiler-diagnostic records indexed by rule and neighbor. */
  readonly diagnosticsByKey: ReadonlyMap<string, DiagnosticOracleRecordV1>;
  /** Binding-rejection records indexed by rule and neighbor. */
  readonly bindingsByKey: ReadonlyMap<string, BindingRejectionRecordV1>;
  /** Exact oracle route for every modeled rule. */
  readonly routesByRuleId: ReadonlyMap<string, OracleHandlerIdV1>;
}

interface ClosedSuiteInput {
  readonly modeledSuite: unknown;
  readonly replayRegistry: unknown;
  readonly inventory: unknown;
  readonly diagnosticManifestBytes: unknown;
  readonly bindingRejectionBytes: unknown;
}

const SUITE_INPUT_KEYS = [
  "modeledSuite",
  "replayRegistry",
  "inventory",
  "diagnosticManifestBytes",
  "bindingRejectionBytes",
] as const;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const SUITE_STATES = new WeakMap<object, OracleSuiteState>();

function authorityKey(ruleId: string, neighborId: string): string {
  return `${ruleId}\u0000${neighborId}`;
}

function closeSuiteInput(value: unknown): ClosedSuiteInput | OracleFailure {
  try {
    if (
      !isOracleRecord(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      !hasExactOracleKeys(value, SUITE_INPUT_KEYS)
    ) {
      return oracleFailure(
        "oracle.input.invalid",
        "",
        "Oracle suite input must use the exact closed shape.",
      );
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of SUITE_INPUT_KEYS) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return oracleFailure(
          "oracle.input.invalid",
          `/${key}`,
          "Oracle suite fields must be enumerable own data.",
        );
      }
    }
    return Object.freeze({
      modeledSuite: descriptors.modeledSuite?.value,
      replayRegistry: descriptors.replayRegistry?.value,
      inventory: descriptors.inventory?.value,
      diagnosticManifestBytes: descriptors.diagnosticManifestBytes?.value,
      bindingRejectionBytes: descriptors.bindingRejectionBytes?.value,
    });
  } catch {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Oracle suite input could not be inspected safely.",
    );
  }
}

function isModeledSuite(value: unknown): value is ModeledGeneratorSuite {
  if (typeof value !== "object" || value === null) return false;
  try {
    if (!(MODELED_GENERATOR_SUITE_CAPABILITY in value)) return false;
    return value[MODELED_GENERATOR_SUITE_CAPABILITY] === true;
  } catch {
    return false;
  }
}

function routeForGenerator(
  handlerId: "generator.frontend-cases" | "generator.runtime-cases",
): OracleHandlerIdV1 {
  return handlerId === "generator.frontend-cases"
    ? "oracle.frontend-result"
    : "oracle.runtime-state";
}

function validateModeledJoin(
  suite: ModeledGeneratorSuite,
  inventory: InventoryV1,
): ReadonlyMap<string, OracleHandlerIdV1> | OracleFailure {
  const routes = new Map<string, OracleHandlerIdV1>();
  const ruleIds = [...new Set(EXPECTED_DIAGNOSTIC_AUTHORITY.map(({ ruleId }) => ruleId))].sort();
  for (const ruleId of ruleIds) {
    const domain = getRuleGenerationDomain(suite, ruleId);
    if (!domain.ok || domain.state !== "modeled") {
      return oracleFailure(
        "oracle.authority.missing",
        "/modeledSuite",
        "A required modeled rule is unavailable.",
      );
    }
    if (
      domain.handlerId !== "generator.frontend-cases" &&
      domain.handlerId !== "generator.runtime-cases"
    ) {
      return oracleFailure(
        "oracle.contract.invalid",
        "/modeledSuite",
        "A modeled rule uses an unsupported generator route.",
      );
    }
    const route = routeForGenerator(domain.handlerId);
    const inventoryRule = inventory.rules.find((candidate) => candidate.ruleId === ruleId);
    if (
      inventoryRule === undefined ||
      inventoryRule.oracleIds.length !== 1 ||
      inventoryRule.oracleIds[0] !== route
    ) {
      return oracleFailure(
        "oracle.authority.stale",
        "/inventory/rules",
        "Inventory and modeled rule routes do not agree.",
      );
    }
    routes.set(ruleId, route);
  }
  return routes;
}

function indexDiagnostics(
  records: readonly DiagnosticOracleRecordV1[],
): ReadonlyMap<string, DiagnosticOracleRecordV1> {
  return new Map(
    records.map((record) => [
      diagnosticAuthorityKey(record.ruleId, record.neighborId, record.diagnosticContext),
      record,
    ]),
  );
}

function indexBindings(
  records: readonly BindingRejectionRecordV1[],
): ReadonlyMap<string, BindingRejectionRecordV1> {
  return new Map(records.map((record) => [authorityKey(record.ruleId, record.neighborId), record]));
}

/**
 * Returns the private immutable state for a factory-created suite.
 *
 * @param suite Candidate suite capability.
 * @returns Private state only for exact runtime members.
 */
export function getOracleSuiteState(suite: unknown): OracleSuiteState | undefined {
  return typeof suite === "object" && suite !== null ? SUITE_STATES.get(suite) : undefined;
}

/**
 * Joins modeled facts, replay dependencies, inventory routes, and both reviewed authorities.
 *
 * @param input Hostile suite-construction input.
 * @returns Opaque source-authoring capability and both digests, or a closed failure.
 *
 * @example
 * ```ts
 * const result = createOracleSuite({
 *   modeledSuite,
 *   replayRegistry,
 *   inventory,
 *   diagnosticManifestBytes,
 *   bindingRejectionBytes,
 * });
 * ```
 */
export function createOracleSuite(input: unknown): OracleSuiteResult {
  const closed = closeSuiteInput(input);
  if ("diagnostics" in closed) return closed;

  const inventorySnapshot = snapshotOracleInput(closed.inventory, "/inventory");
  if (!inventorySnapshot.ok) return inventorySnapshot;
  const validatedInventory = validateInventorySchema(inventorySnapshot.value);
  if (!validatedInventory.ok || validatedInventory.inventory === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "/inventory",
      "Inventory authority does not satisfy the closed schema.",
    );
  }
  if (!isFactoryRevisionRegistry(closed.replayRegistry)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/replayRegistry",
      "Replay registry capability is invalid.",
    );
  }
  if (!isModeledSuite(closed.modeledSuite)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/modeledSuite",
      "Modeled suite capability is invalid.",
    );
  }

  const diagnostic = parseDiagnosticOracleCandidate(
    closed.diagnosticManifestBytes,
    "/diagnosticManifestBytes",
  );
  if (!diagnostic.ok) return diagnostic;
  const binding = parseBindingRejectionCandidate(
    closed.bindingRejectionBytes,
    "/bindingRejectionBytes",
  );
  if (!binding.ok) return binding;
  if (diagnostic.manifest.specRevision !== validatedInventory.inventory.specRevision) {
    return oracleFailure(
      "oracle.authority.stale",
      "/diagnosticManifestBytes/specRevision",
      "Diagnostic authority targets a different specification revision.",
    );
  }

  const diagnosticMismatch = validateDiagnosticAuthorityCandidate(diagnostic.manifest.records);
  if (diagnosticMismatch !== undefined) return diagnosticMismatch;
  const bindingMismatch = validateBindingAuthorityCandidate(binding.manifest.records);
  if (bindingMismatch !== undefined) return bindingMismatch;

  const routes = validateModeledJoin(closed.modeledSuite, validatedInventory.inventory);
  if ("diagnostics" in routes) return routes;
  const diagnosticManifest = acceptedDiagnosticManifest(diagnostic.manifest);
  const bindingManifest = acceptedBindingManifest(binding.manifest);
  const suite: OracleSuite = Object.freeze({ [ORACLE_SUITE_CAPABILITY]: true as const });
  SUITE_STATES.set(
    suite,
    Object.freeze({
      modeledSuite: closed.modeledSuite,
      replayRegistry: closed.replayRegistry,
      inventory: validatedInventory.inventory,
      diagnosticManifest,
      bindingManifest,
      diagnosticsByKey: indexDiagnostics(diagnosticManifest.records),
      bindingsByKey: indexBindings(bindingManifest.records),
      routesByRuleId: routes,
    }),
  );
  return Object.freeze({
    ok: true,
    suite,
    authorityDigests: Object.freeze({
      diagnosticManifest: diagnostic.digest,
      bindingRejections: binding.digest,
    }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Builds the collision-free authority map key used only inside the package.
 *
 * @param ruleId Reviewed rule identity.
 * @param neighborId Reviewed invalid-neighbor identity.
 * @returns Stable map key.
 */
export function oracleAuthorityKey(ruleId: string, neighborId: string): string {
  return authorityKey(ruleId, neighborId);
}

/**
 * Builds the diagnostic authority key including its optional source-context qualifier.
 *
 * @param ruleId Reviewed rule identity.
 * @param neighborId Reviewed invalid-neighbor identity.
 * @param context Derived source context, or undefined for a generic row.
 * @returns Stable three-part map key.
 *
 * @example
 * ```ts
 * diagnosticAuthorityKey(ruleId, neighborId, "initializer");
 * ```
 */
export function diagnosticAuthorityKey(
  ruleId: string,
  neighborId: string,
  context: DiagnosticContextV1 | undefined,
): string {
  return `${authorityKey(ruleId, neighborId)}\u0000${context ?? ""}`;
}
