import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import { INVENTORY_V1_LIMITS } from "./limits.js";
import type { InventoryDiagnostic, InventoryV1 } from "./model.js";
import { parseInventoryJson } from "./json-input.js";
import { validateInventorySchema } from "./schema-validator.js";

export interface InventoryMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(input: unknown): MigrationResult;
}

export interface MigrationInvalidation {
  readonly kind: "rule" | "handler" | "capability" | "campaign" | "regression";
  readonly identity: string;
  readonly reasonCode: string;
}

export interface MigrationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly InventoryDiagnostic[];
  readonly output?: unknown;
  readonly invalidations: readonly MigrationInvalidation[];
}

export interface EvolutionGateExpectation {
  readonly owner: string;
  readonly semanticRevision: string;
  readonly acceptanceGate: string;
}

export interface VersionDispatchResult<T = unknown> {
  readonly ok: boolean;
  readonly diagnostics: readonly InventoryDiagnostic[];
  readonly inventory?: T;
  readonly invalidations: readonly MigrationInvalidation[];
}

function failure(code: string, message: string): VersionDispatchResult {
  return {
    ok: false,
    diagnostics: [createDiagnostic({ phase: "evolution", code, path: "$.schemaVersion", message })],
    invalidations: [],
  };
}

function versionOf(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null || !("schemaVersion" in value)) return undefined;
  const version = value.schemaVersion;
  return Number.isInteger(version) ? Number(version) : undefined;
}

/** Reads the only production inventory version without installing speculative migrations. */
export function readInventoryVersioned(bytes: Uint8Array): VersionDispatchResult<InventoryV1> {
  const parsed = parseInventoryJson(bytes, INVENTORY_V1_LIMITS);
  if (!parsed.ok) {
    return { ok: false, diagnostics: parsed.diagnostics, invalidations: [] };
  }
  if (versionOf(parsed.inventory) !== 1) {
    const result = failure("version.unsupported", "The inventory schema version is not supported.");
    return { ok: false, diagnostics: result.diagnostics, invalidations: [] };
  }
  const schema = validateInventorySchema(parsed.inventory);
  return schema.ok && schema.inventory !== undefined
    ? { ok: true, diagnostics: [], inventory: schema.inventory, invalidations: [] }
    : { ok: false, diagnostics: schema.diagnostics, invalidations: [] };
}

const KIND_ORDER = ["rule", "handler", "capability", "campaign", "regression"] as const;

function canonicalInvalidations(
  values: readonly MigrationInvalidation[],
): readonly MigrationInvalidation[] | undefined {
  const reasons = new Map<string, string>();
  for (const value of values) {
    const key = `${value.kind}\u0000${value.identity}`;
    const previous = reasons.get(key);
    if (previous !== undefined && previous !== value.reasonCode) return undefined;
    reasons.set(key, value.reasonCode);
  }
  return [...new Map(values.map((value) => [JSON.stringify(value), value])).values()].sort(
    (left, right) =>
      KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
      left.identity.localeCompare(right.identity) ||
      left.reasonCode.localeCompare(right.reasonCode),
  );
}

function currentGate(value: unknown, expected: EvolutionGateExpectation): boolean {
  if (typeof value !== "object" || value === null || !("evolutionGate" in value)) return false;
  const gate = value.evolutionGate;
  if (typeof gate !== "object" || gate === null) return false;
  const record = gate as Readonly<Record<string, unknown>>;
  return (
    record.owner === expected.owner &&
    record.semanticRevision === expected.semanticRevision &&
    record.acceptanceGate === expected.acceptanceGate &&
    typeof record.validatedAt === "string" &&
    !Number.isNaN(Date.parse(record.validatedAt))
  );
}

/** Creates an isolated dispatcher used to prove future migration contracts. */
export function createInventoryVersionDispatcherForTest(
  migrations: readonly InventoryMigration[],
  expectedGate: EvolutionGateExpectation,
  targetVersion: number,
): (bytes: Uint8Array) => VersionDispatchResult {
  const edges = new Map<number, InventoryMigration>();
  let registryValid = targetVersion >= 1;
  for (const migration of migrations) {
    if (
      edges.has(migration.fromVersion) ||
      migration.toVersion !== migration.fromVersion + 1 ||
      migration.fromVersion < 1 ||
      migration.toVersion > targetVersion
    ) {
      registryValid = false;
    }
    edges.set(migration.fromVersion, migration);
  }
  for (let version = 1; version < targetVersion; version += 1) {
    if (!edges.has(version)) registryValid = false;
  }

  return (bytes) => {
    if (!registryValid)
      return failure("migration.invalid-registry", "Migration registry is ambiguous.");
    const parsed = parseInventoryJson(bytes, INVENTORY_V1_LIMITS);
    if (!parsed.ok) return { ok: false, diagnostics: parsed.diagnostics, invalidations: [] };
    const initialVersion = versionOf(parsed.inventory);
    if (initialVersion === undefined || initialVersion > targetVersion) {
      return failure("version.unsupported", "The inventory schema version is not supported.");
    }
    if (initialVersion < targetVersion && !currentGate(parsed.inventory, expectedGate)) {
      return failure("evolution-gate.stale", "A current evolution gate is required.");
    }
    let output = parsed.inventory;
    const invalidations: MigrationInvalidation[] = [];
    for (let version = initialVersion; version < targetVersion; version += 1) {
      const migration = edges.get(version);
      if (migration === undefined) return failure("migration.gap", "Migration chain has a gap.");
      const result = migration.migrate(output);
      if (
        !result.ok ||
        result.output === undefined ||
        versionOf(result.output) !== migration.toVersion
      ) {
        return {
          ok: false,
          diagnostics:
            result.diagnostics.length > 0
              ? sortDiagnostics(result.diagnostics)
              : failure("migration.step-version", "Migration returned the wrong version.")
                  .diagnostics,
          invalidations: [],
        };
      }
      output = result.output;
      invalidations.push(...result.invalidations);
    }
    const ordered = canonicalInvalidations(invalidations);
    if (ordered === undefined) {
      return failure("migration.conflicting-invalidation", "Invalidation reasons conflict.");
    }
    return { ok: true, diagnostics: [], inventory: output, invalidations: ordered };
  };
}
