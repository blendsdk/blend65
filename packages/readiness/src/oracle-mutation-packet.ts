import { constants as FILE_OPEN_FLAGS } from "node:fs";
import { open } from "node:fs/promises";

import type { Sha256Digest } from "./model-registry-model.js";
import type { OracleMutantV1, OracleMutationFamilyV1 } from "./oracle-mutation-model.js";
import type { OracleProgramInputV1 } from "./oracle-evaluator.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
} from "./oracle-input.js";
import type {
  OracleDiagnostic,
  OracleObservationV1,
  OracleResultV1,
  OracleUnmodeledReason,
  SemanticRelationId,
} from "./oracle-model.js";
import type { SemanticRelationRequestV1 } from "./semantic-relation-model.js";
import { parseStrictJson } from "./strict-json.js";

/** Data-only descriptor for reconstructing the exact semantic-relation suite. */
export interface OracleMutationSuiteDescriptorV1 {
  /** Descriptor schema version. */
  readonly schemaVersion: 1;
  /** Package-owned hydration recipe. */
  readonly suiteId: "oracle-suite.phase4-mutation-v1";
  /** Exact inventory artifact digest. */
  readonly inventoryDigest: Sha256Digest;
  /** Exact seed-contract artifact digest. */
  readonly seedContractDigest: Sha256Digest;
  /** Exact rule-model artifact digest. */
  readonly ruleModelDigest: Sha256Digest;
  /** Exact rule-model review artifact digest. */
  readonly ruleModelReviewDigest: Sha256Digest;
  /** Exact diagnostic authority digest. */
  readonly diagnosticManifestDigest: Sha256Digest;
  /** Exact binding-rejection authority digest. */
  readonly bindingRejectionDigest: Sha256Digest;
  /** Exact replay participant revisions. */
  readonly replayRevisions: {
    readonly inventory: Sha256Digest;
    readonly ruleModel: Sha256Digest;
    readonly generator: Sha256Digest;
    readonly boundaryTransform: Sha256Digest;
    readonly renderer: Sha256Digest;
    readonly configuration: Sha256Digest;
  };
}

/** Closed data-only fixture executed for one canonical mutation vector. */
export type OracleMutationFixtureV1 =
  | {
      readonly kind: "program-evaluation";
      readonly input: OracleProgramInputV1;
    }
  | {
      readonly kind: "diagnostic-mapping";
      readonly ruleId: string;
      readonly neighborId: string;
      readonly diagnosticContext?: string;
    }
  | {
      readonly kind: "binding-rejection-mapping";
      readonly ruleId: string;
      readonly neighborId: string;
      readonly parameterPath: string;
    }
  | {
      readonly kind: "semantic-relation";
      readonly suite: OracleMutationSuiteDescriptorV1;
      readonly request: SemanticRelationRequestV1;
    };

/** Canonical observation accepted by independent mutation assertions. */
export type OracleMutationObservationV1 =
  | OracleResultV1
  | { readonly kind: "diagnostic-mapping"; readonly diagnosticCode: string }
  | { readonly kind: "binding-rejection-mapping"; readonly rejectionCode: string }
  | {
      readonly kind: "semantic-relation-modeled";
      readonly relationId: SemanticRelationId;
      readonly sourceObservation: OracleObservationV1;
      readonly transformedObservation: OracleObservationV1;
    }
  | {
      readonly kind: "semantic-relation-inapplicable";
      readonly relationId: SemanticRelationId;
    }
  | {
      readonly kind: "semantic-relation-unmodeled";
      readonly reason: OracleUnmodeledReason;
    }
  | {
      readonly kind: "semantic-relation-failure";
      readonly diagnostics: readonly OracleDiagnostic[];
    };

/** One literal exact-observation assertion. */
export interface OracleMutationAssertionV1 {
  /** Closed assertion discriminator. */
  readonly kind: "exact-observation";
  /** Independently authored literal baseline observation. */
  readonly expected: OracleMutationObservationV1;
}

/** One exact vector fixture and its independent assertion. */
export interface OracleMutationAssertionRowV1 {
  /** Canonical stable vector ID. */
  readonly vectorId: string;
  /** Mutation family executed by the fixture. */
  readonly family: OracleMutantV1["family"];
  /** Complete data-only production fixture. */
  readonly fixture: OracleMutationFixtureV1;
  /** Literal expected observation. */
  readonly assertion: OracleMutationAssertionV1;
}

/** Closed result of loading the package-owned assertion packet. */
export type OracleMutationPacketResultV1 =
  | {
      readonly ok: true;
      readonly rows: readonly OracleMutationAssertionRowV1[];
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly OracleDiagnostic[];
    };

const ASSERTION_PACKET_URL = new URL(
  "../../../readiness/oracles/oracle-mutation-assertions-v1.json",
  import.meta.url,
);
const MAX_PACKET_BYTES = 1_048_576;
const PACKET_KEYS = ["schemaVersion", "packetVersion", "rows"] as const;
const ROW_KEYS = ["vectorId", "family", "fixture", "assertion"] as const;
const ASSERTION_KEYS = ["kind", "expected"] as const;
const BIGINT_KEYS: ReadonlySet<string> = new Set([
  "inputNodes",
  "expressionDepth",
  "evaluationSteps",
  "frames",
  "memoryCells",
  "effects",
  "transformedNodes",
  "value",
  "address",
  "ordinal",
  "maxLoopWork",
  "modules",
  "declarations",
  "ir-nodes",
  "statements",
  "expression-depth",
  "loop-work",
]);
const FAMILIES: ReadonlySet<string> = new Set([
  "evaluator-operation",
  "diagnostic-mapping",
  "transform-precondition",
  "transform-rewrite",
  "relation-comparator",
]);
const VECTOR_PATTERN = /^vector\.[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+\.v1$/u;
const CANONICAL_INTEGER = /^-?(?:0|[1-9][0-9]*)$/u;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
let packetPromise: Promise<OracleMutationPacketResultV1> | undefined;

async function readPacketBytes(): Promise<Uint8Array> {
  const handle = await open(
    ASSERTION_PACKET_URL,
    FILE_OPEN_FLAGS.O_RDONLY | FILE_OPEN_FLAGS.O_NOFOLLOW,
  );
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size < 0 || metadata.size > MAX_PACKET_BYTES) {
      throw new TypeError("mutation assertion packet is not a bounded regular file");
    }
    const bytes = Buffer.allocUnsafe(MAX_PACKET_BYTES + 1);
    let offset = 0;
    while (offset <= MAX_PACKET_BYTES) {
      const read = await handle.read(bytes, offset, MAX_PACKET_BYTES + 1 - offset, offset);
      if (read.bytesRead === 0) return bytes.subarray(0, offset);
      offset += read.bytesRead;
    }
    throw new TypeError("mutation assertion packet exceeds its byte limit");
  } finally {
    await handle.close();
  }
}

function hydrateDecimals(value: unknown, key = ""): unknown {
  if (typeof value === "string" && BIGINT_KEYS.has(key) && CANONICAL_INTEGER.test(value)) {
    return BigInt(value);
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((member) => hydrateDecimals(member)));
  }
  if (!isOracleRecord(value)) return value;
  const hydrated = Object.fromEntries(
    Object.entries(value).map(([memberKey, member]) => [
      memberKey,
      hydrateDecimals(member, memberKey),
    ]),
  );
  if (
    hydrated.kind === "literal" &&
    hydrated.type === "boolean" &&
    typeof hydrated.value === "boolean"
  ) {
    hydrated.value = hydrated.value ? 1n : 0n;
  }
  return Object.freeze(hydrated);
}

function parseRow(value: unknown): OracleMutationAssertionRowV1 | undefined {
  if (!isOracleRecord(value) || !hasExactOracleKeys(value, ROW_KEYS)) return undefined;
  if (
    typeof value.vectorId !== "string" ||
    !VECTOR_PATTERN.test(value.vectorId) ||
    typeof value.family !== "string" ||
    !FAMILIES.has(value.family) ||
    !isOracleRecord(value.fixture) ||
    !isOracleRecord(value.assertion) ||
    !hasExactOracleKeys(value.assertion, ASSERTION_KEYS) ||
    value.assertion.kind !== "exact-observation"
  ) {
    return undefined;
  }
  const fixture = value.fixture as OracleMutationFixtureV1;
  const assertion = Object.freeze({
    kind: "exact-observation" as const,
    expected: value.assertion.expected as OracleMutationObservationV1,
  });
  return Object.freeze({
    vectorId: value.vectorId,
    family: value.family as OracleMutationFamilyV1,
    fixture,
    assertion,
  });
}

async function loadPacket(): Promise<OracleMutationPacketResultV1> {
  try {
    const bytes = await readPacketBytes();
    const parsed = parseStrictJson(bytes);
    if (!parsed.ok) {
      return oracleFailure(
        "oracle.input.invalid",
        `/mutationAssertions${parsed.problem.path}`,
        parsed.problem.message,
      );
    }
    const hydrated = hydrateDecimals(parsed.value);
    const snapshot = snapshotOracleInput(hydrated, "/mutationAssertions");
    if (!snapshot.ok) return snapshot;
    if (
      !isOracleRecord(snapshot.value) ||
      !hasExactOracleKeys(snapshot.value, PACKET_KEYS) ||
      snapshot.value.schemaVersion !== 1 ||
      snapshot.value.packetVersion !== "1.0.0" ||
      !Array.isArray(snapshot.value.rows) ||
      snapshot.value.rows.length !== 84
    ) {
      return oracleFailure(
        "oracle.input.invalid",
        "/mutationAssertions",
        "Mutation assertion packet must use the exact closed shape.",
      );
    }
    const rows: OracleMutationAssertionRowV1[] = [];
    const vectorIds = new Set<string>();
    for (let index = 0; index < snapshot.value.rows.length; index += 1) {
      const row = parseRow(snapshot.value.rows[index]);
      if (row === undefined || vectorIds.has(row.vectorId)) {
        return oracleFailure(
          "oracle.input.invalid",
          `/mutationAssertions/rows/${index}`,
          "Mutation assertion row is invalid or duplicated.",
        );
      }
      vectorIds.add(row.vectorId);
      rows.push(row);
    }
    return Object.freeze({
      ok: true,
      rows: Object.freeze(rows),
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return oracleFailure(
      "oracle.input.invalid",
      "/mutationAssertions",
      "Mutation assertion packet could not be loaded safely.",
    );
  }
}

/**
 * Loads and deeply closes the fixed data-only mutation assertion packet.
 *
 * @returns Exact 84-row packet or one bounded failure.
 *
 * @example
 * ```ts
 * const packet = await loadOracleMutationAssertionPacket();
 * ```
 */
export function loadOracleMutationAssertionPacket(): Promise<OracleMutationPacketResultV1> {
  packetPromise ??= loadPacket();
  return packetPromise;
}

/**
 * Normalizes decimal-string assertion data into the closed observation representation.
 *
 * @param value Hostile assertion or observation data.
 * @returns Deeply immutable normalized data, or a closed validation failure.
 *
 * @example
 * ```ts
 * const normalized = normalizeOracleMutationAssertionData(assertion);
 * ```
 */
export function normalizeOracleMutationAssertionData(
  value: unknown,
):
  | { readonly ok: true; readonly value: unknown; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] } {
  const snapshot = snapshotOracleInput(value, "/mutationAssertion");
  if (!snapshot.ok) return snapshot;
  try {
    return Object.freeze({
      ok: true,
      value: hydrateDecimals(snapshot.value),
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return oracleFailure(
      "oracle.input.invalid",
      "/mutationAssertion",
      "Mutation assertion data could not be normalized safely.",
    );
  }
}
