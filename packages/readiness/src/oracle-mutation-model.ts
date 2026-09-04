import { ORACLE_AUTHORITY_MUTATION_PATHS } from "./oracle-authority-policy.js";
import { ORACLE_ORDER_MUTATION_PATHS } from "./oracle-evaluator.js";
import type { OracleValidationResultV1 } from "./oracle-evaluation-identity.js";
import { ORACLE_MEMORY_MUTATION_PATHS } from "./oracle-memory.js";
import { ORACLE_SCALAR_MUTATION_PATHS } from "./oracle-operations.js";
import { ORACLE_NORMALIZATION_MUTATION_PATHS } from "./oracle-values.js";
import { ORACLE_RELATION_MUTATION_PATHS } from "./semantic-relation-conformance.js";
import { STRUCTURED_ORACLE_MUTATION_PATHS } from "./structured-oracle-evaluator.js";
import type { OracleDiagnostic } from "./oracle-model.js";

/** Closed mutation families accepted by the version-one adequacy catalog. */
export type OracleMutationFamilyV1 =
  | "evaluator-operation"
  | "diagnostic-mapping"
  | "transform-precondition"
  | "transform-rewrite"
  | "relation-comparator";

/** One exact production operation, path, and variant mutation. */
export interface OracleMutantV1 {
  /** Stable globally unique mutation identity. */
  readonly mutantId: string;
  /** Semantic branch family. */
  readonly family: OracleMutationFamilyV1;
  /** Production operation identity. */
  readonly operationId: string;
  /** Exact reachable branch identity. */
  readonly pathId: string;
  /** Closed mutation variant for the path. */
  readonly variantId: string;
}

/** Canonical mutation catalog parsed from reviewed source authority. */
export interface OracleMutationCatalogV1 {
  /** Catalog schema version. */
  readonly schemaVersion: 1;
  /** Semantic catalog version. */
  readonly catalogVersion: "1.0.0";
  /** Mutation execution policy revision. */
  readonly policyRevision: "oracle-mutation-policy-v1";
  /** Lexically ordered exact mutation population. */
  readonly mutants: readonly OracleMutantV1[];
}

/** One reachable production mutation path and its exact closed variant. */
export interface OracleMutationPathV1 {
  /** Semantic branch family. */
  readonly family: OracleMutationFamilyV1;
  /** Production operation identity. */
  readonly operationId: string;
  /** Exact reachable branch identity. */
  readonly pathId: string;
  /** Closed mutation variant. */
  readonly variantId: string;
}

/** Immutable complete production path registry. */
export interface OracleMutationPathRegistryV1 {
  /** Registry schema version. */
  readonly schemaVersion: 1;
  /** Exact reachable production branches. */
  readonly paths: readonly OracleMutationPathV1[];
}

/** Immutable mutation registry including structured evaluator and relation paths. */
export interface OracleMutationPathRegistryV2 {
  readonly schemaVersion: 2;
  readonly paths: readonly OracleMutationPathV1[];
}

/** Catalog proven to exact-join a factory-created production path registry. */
export type ValidatedOracleMutationCatalogV1 = OracleMutationCatalogV1;

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const PARSED_CATALOGS = new WeakSet<object>();
const VALIDATED_CATALOGS = new WeakSet<object>();
const PATH_REGISTRIES = new WeakSet<object>();
const MUTANT_KEYS = ["mutantId", "family", "operationId", "pathId", "variantId"] as const;
const CATALOG_KEYS = ["schemaVersion", "catalogVersion", "policyRevision", "mutants"] as const;
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/u;
const MAX_MUTANTS = 256;
const MAX_ID_BYTES = 512;
const ENCODER = new TextEncoder();
const FAMILIES: ReadonlySet<string> = new Set([
  "evaluator-operation",
  "diagnostic-mapping",
  "transform-precondition",
  "transform-rewrite",
  "relation-comparator",
]);

function diagnostic(path: string, message: string): OracleDiagnostic {
  return Object.freeze({
    code: "oracle.input.invalid",
    path,
    message: message.slice(0, 512),
  });
}

function failure<T>(
  path: string,
  message: string,
): Extract<OracleValidationResultV1<T>, { readonly ok: false }> {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(path, message)]),
  });
}

function success<T>(value: T): OracleValidationResultV1<T> {
  return Object.freeze({ ok: true, value, diagnostics: EMPTY_DIAGNOSTICS });
}

function snapshotExactRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return undefined;
    const actual = Reflect.ownKeys(value);
    if (
      actual.length !== keys.length ||
      actual.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return undefined;
  }
}

type DenseArraySnapshot =
  | { readonly ok: true; readonly values: readonly unknown[] }
  | { readonly ok: false; readonly limit: boolean };

function snapshotDenseArray(value: unknown, maximumLength: number): DenseArraySnapshot {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return Object.freeze({ ok: false, limit: false });
    }
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      typeof lengthDescriptor.value !== "number" ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      return Object.freeze({ ok: false, limit: false });
    }
    const length = lengthDescriptor.value;
    if (length > maximumLength) return Object.freeze({ ok: false, limit: true });
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== length + 1 ||
      keys.some((key, index) => key !== (index === length ? "length" : String(index)))
    ) {
      return Object.freeze({ ok: false, limit: false });
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return Object.freeze({ ok: false, limit: false });
      }
      snapshot.push(descriptor.value);
    }
    return Object.freeze({ ok: true, values: Object.freeze(snapshot) });
  } catch {
    return Object.freeze({ ok: false, limit: false });
  }
}

function boundedId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ENCODER.encode(value).byteLength <= MAX_ID_BYTES &&
    ID_PATTERN.test(value)
  );
}

function isFamily(value: unknown): value is OracleMutationFamilyV1 {
  return typeof value === "string" && FAMILIES.has(value);
}

function parseMutant(value: unknown): OracleMutantV1 | undefined {
  const row = snapshotExactRecord(value, MUTANT_KEYS);
  if (row === undefined) return undefined;
  if (
    !boundedId(row.mutantId) ||
    !isFamily(row.family) ||
    !boundedId(row.operationId) ||
    !boundedId(row.pathId) ||
    !boundedId(row.variantId)
  ) {
    return undefined;
  }
  return Object.freeze({
    mutantId: row.mutantId,
    family: row.family,
    operationId: row.operationId,
    pathId: row.pathId,
    variantId: row.variantId,
  });
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function path(
  family: OracleMutationFamilyV1,
  value: { readonly operationId: string; readonly pathId: string; readonly variantId: string },
): OracleMutationPathV1 {
  return Object.freeze({ family, ...value });
}

function relationFamily(pathId: string): OracleMutationFamilyV1 {
  if (pathId.endsWith(".precondition")) return "transform-precondition";
  if (pathId.endsWith(".rewrite")) return "transform-rewrite";
  return "relation-comparator";
}

function tripleKey(value: {
  readonly operationId: string;
  readonly pathId: string;
  readonly variantId: string;
}): string {
  return `${value.operationId}\u0000${value.pathId}\u0000${value.variantId}`;
}

/**
 * Returns the stable mutant identity required for one production path.
 *
 * @param value Closed production path.
 * @returns Deterministic mutation identity.
 */
export function oracleMutationIdForPath(value: OracleMutationPathV1): string {
  if (value.family === "transform-precondition") return `mutant.${value.pathId}.force-true`;
  if (value.family === "transform-rewrite") {
    return `mutant.${value.pathId}.${value.variantId.slice("non-preserving.".length)}`;
  }
  if (value.family === "relation-comparator") {
    return `mutant.${value.pathId}.omit-required-observable`;
  }
  return `mutant.${value.pathId}`;
}

/**
 * Returns the private canonical vector identity required for one production path.
 *
 * @param value Closed production path.
 * @returns Stable data-only vector identity.
 */
export function oracleMutationVectorIdForPath(value: OracleMutationPathV1): string {
  if (value.family === "transform-precondition") return `vector.${value.pathId}.inapplicable.v1`;
  if (value.family === "transform-rewrite") {
    return `vector.${value.pathId}.${value.variantId.slice("non-preserving.".length)}.v1`;
  }
  return `vector.${value.pathId}.v1`;
}

/**
 * Parses and deeply closes one hostile mutation catalog candidate.
 *
 * @param input Unknown catalog-shaped value.
 * @returns Immutable catalog or one bounded validation failure.
 *
 * @example
 * ```ts
 * const parsed = parseOracleMutationCatalog(JSON.parse(text));
 * ```
 */
export function parseOracleMutationCatalog(
  input: unknown,
): OracleValidationResultV1<OracleMutationCatalogV1> {
  try {
    const catalog = snapshotExactRecord(input, CATALOG_KEYS);
    if (
      catalog === undefined ||
      catalog.schemaVersion !== 1 ||
      catalog.catalogVersion !== "1.0.0" ||
      catalog.policyRevision !== "oracle-mutation-policy-v1"
    ) {
      return failure("", "Mutation catalog must use the exact bounded version-one shape.");
    }
    const rows = snapshotDenseArray(catalog.mutants, MAX_MUTANTS);
    if (!rows.ok) {
      return failure(
        "/mutants",
        rows.limit
          ? "Mutation catalog exceeds its fixed row limit."
          : "Mutation rows must use a dense plain array.",
      );
    }
    const mutants: OracleMutantV1[] = [];
    let previousId: string | undefined;
    for (let index = 0; index < rows.values.length; index += 1) {
      const mutant = parseMutant(rows.values[index]);
      if (mutant === undefined) {
        return failure(`/mutants/${index}`, "Mutation row is not canonical.");
      }
      if (previousId !== undefined && previousId >= mutant.mutantId) {
        return failure(`/mutants/${index}/mutantId`, "Mutation IDs must be unique and lexical.");
      }
      previousId = mutant.mutantId;
      mutants.push(mutant);
    }
    const parsed = Object.freeze({
      schemaVersion: 1 as const,
      catalogVersion: "1.0.0" as const,
      policyRevision: "oracle-mutation-policy-v1" as const,
      mutants: Object.freeze(mutants),
    });
    PARSED_CATALOGS.add(parsed);
    return success(parsed);
  } catch {
    return failure("", "Mutation catalog could not be inspected safely.");
  }
}

/**
 * Builds the immutable exact registry from live production dispatch branches.
 *
 * @returns Factory-owned path registry containing every reachable mutation triple.
 *
 * @example
 * ```ts
 * const registry = oracleMutationPathRegistry();
 * ```
 */
export function oracleMutationPathRegistry(): OracleMutationPathRegistryV1 {
  const paths = [
    ...ORACLE_SCALAR_MUTATION_PATHS.map((value) => path("evaluator-operation", value)),
    ...ORACLE_NORMALIZATION_MUTATION_PATHS.map((value) => path("evaluator-operation", value)),
    ...ORACLE_MEMORY_MUTATION_PATHS.map((value) => path("evaluator-operation", value)),
    ...ORACLE_ORDER_MUTATION_PATHS.map((value) => path("evaluator-operation", value)),
    ...ORACLE_AUTHORITY_MUTATION_PATHS.map((value) => path("diagnostic-mapping", value)),
    ...ORACLE_RELATION_MUTATION_PATHS.filter(
      (value) => value.operationId !== "relation.loop-unrolling",
    ).map((value) => path(relationFamily(value.pathId), value)),
  ].sort((left, right) =>
    compareAscii(oracleMutationIdForPath(left), oracleMutationIdForPath(right)),
  );
  const registry = Object.freeze({
    schemaVersion: 1 as const,
    paths: Object.freeze(paths),
  });
  PATH_REGISTRIES.add(registry);
  return registry;
}

/**
 * Builds the additive registry containing every historical and structured mutation path.
 *
 * @returns Lexically ordered version-two mutation path registry.
 */
export function oracleMutationPathRegistryV2(): OracleMutationPathRegistryV2 {
  const paths = [
    ...oracleMutationPathRegistry().paths,
    ...STRUCTURED_ORACLE_MUTATION_PATHS.map((value) => path("evaluator-operation", value)),
    ...ORACLE_RELATION_MUTATION_PATHS.filter(
      (value) => value.operationId === "relation.loop-unrolling",
    ).map((value) => path(relationFamily(value.pathId), value)),
  ].sort((left, right) =>
    compareAscii(oracleMutationIdForPath(left), oracleMutationIdForPath(right)),
  );
  return Object.freeze({ schemaVersion: 2, paths: Object.freeze(paths) });
}

/**
 * Proves exact equality between one catalog and every live production mutation triple.
 *
 * Missing, extra, duplicate, unreachable, misclassified, or renamed rows fail closed.
 *
 * @param catalog Parsed catalog candidate.
 * @param registry Factory-created production path registry.
 * @returns Validated catalog capability or one deterministic failure.
 *
 * @example
 * ```ts
 * const validated = validateOracleMutationCatalog(catalog, oracleMutationPathRegistry());
 * ```
 */
export function validateOracleMutationCatalog(
  catalog: OracleMutationCatalogV1,
  registry: OracleMutationPathRegistryV1,
): OracleValidationResultV1<ValidatedOracleMutationCatalogV1> {
  try {
    if (typeof registry !== "object" || registry === null || !PATH_REGISTRIES.has(registry)) {
      return failure("/registry", "Mutation path registry is not factory-owned.");
    }
    if (typeof catalog !== "object" || catalog === null || !PARSED_CATALOGS.has(catalog)) {
      return failure("", "Mutation catalog is not a parsed version-one catalog.");
    }
    const required = new Map(registry.paths.map((entry) => [tripleKey(entry), entry]));
    const observed = new Set<string>();
    let previousId: string | undefined;
    for (let index = 0; index < catalog.mutants.length; index += 1) {
      const mutant = catalog.mutants[index];
      if (mutant === undefined) {
        return failure(`/mutants/${index}`, "Mutation row is missing.");
      }
      const key = tripleKey(mutant);
      const expected = required.get(key);
      if (
        observed.has(key) ||
        expected === undefined ||
        mutant.family !== expected.family ||
        mutant.mutantId !== oracleMutationIdForPath(expected) ||
        (previousId !== undefined && previousId >= mutant.mutantId)
      ) {
        return failure(`/mutants/${index}`, "Mutation row is duplicate, unknown, or unreachable.");
      }
      previousId = mutant.mutantId;
      observed.add(key);
    }
    if (observed.size !== required.size) {
      return failure("/mutants", "Mutation catalog is missing a required production path.");
    }
    VALIDATED_CATALOGS.add(catalog);
    return success(catalog);
  } catch {
    return failure("", "Mutation catalog validation failed closed.");
  }
}

/**
 * Reports whether a catalog was exact-joined by this module.
 *
 * @param catalog Candidate validated catalog.
 * @returns Whether it carries factory validation identity.
 */
export function isValidatedOracleMutationCatalog(
  catalog: unknown,
): catalog is ValidatedOracleMutationCatalogV1 {
  return typeof catalog === "object" && catalog !== null && VALIDATED_CATALOGS.has(catalog);
}

/**
 * Resolves a validated mutant to its live production path.
 *
 * @param mutant Validated catalog row.
 * @returns Exact path metadata including the private vector identity.
 */
export function resolveOracleMutationPath(mutant: OracleMutantV1): OracleMutationPathV1 {
  return Object.freeze({
    family: mutant.family,
    operationId: mutant.operationId,
    pathId: mutant.pathId,
    variantId: mutant.variantId,
  });
}
