import type { FirstVerticalPublicationCandidateV2 } from "./first-vertical-publication.js";
import { validateFirstVerticalPublicationCandidateV2 } from "./first-vertical-publication.js";
import { isSha256Digest } from "./canonical-identity.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { digestPublicationBytes, renderPublicationJson } from "./publication-model.js";

/** One fixed fixture identity permitted in a structured source case. */
export interface EmbeddedCaseFixtureReferenceV2 {
  readonly fixtureId: string;
  readonly digest: Sha256Digest;
  readonly relativePath: string;
}

/** Canonical authenticated fixture-reference document. */
export interface EmbeddedCaseFixtureDocumentV2 {
  readonly schemaVersion: 2;
  readonly kind: "embedded-case-fixtures-v2";
  readonly fixtures: readonly EmbeddedCaseFixtureReferenceV2[];
}

declare const embeddedCaseFixtureSetBrand: unique symbol;

/** Opaque authority proving that every fixture reference is registry-owned. */
export interface EmbeddedCaseFixtureSetV2 {
  readonly [embeddedCaseFixtureSetBrand]: true;
}

/** Stable validation failure for an embedded fixture document. */
export interface EmbeddedCaseFixtureDiagnosticV2 {
  readonly code:
    | "rule-model.unauthenticated-fixture"
    | "rule-model.invalid-fixture-path"
    | "rule-model.invalid-fixture-digest"
    | "rule-model.invalid-fixture-population";
  readonly path: string;
  readonly message: string;
}

/** Result of authenticating a complete embedded fixture document. */
export type EmbeddedCaseFixtureValidationResultV2 =
  | {
      readonly ok: true;
      readonly fixtureSet: EmbeddedCaseFixtureSetV2;
      readonly document: EmbeddedCaseFixtureDocumentV2;
      readonly fixtureSetDigest: Sha256Digest;
      readonly canonicalBytes: Uint8Array;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly EmbeddedCaseFixtureDiagnosticV2[] };

interface FixtureSetState {
  readonly document: EmbeddedCaseFixtureDocumentV2;
  readonly digest: Sha256Digest;
  readonly bytes: Uint8Array;
}

const FIXTURE_SETS = new WeakMap<object, FixtureSetState>();
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(
  code: EmbeddedCaseFixtureDiagnosticV2["code"],
  path: string,
  message: string,
): EmbeddedCaseFixtureValidationResultV2 {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

function safeFixturePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("fixtures/") &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function closeEmptyFixtureSet(): EmbeddedCaseFixtureValidationResultV2 {
  const document: EmbeddedCaseFixtureDocumentV2 = Object.freeze({
    schemaVersion: 2,
    kind: "embedded-case-fixtures-v2",
    fixtures: Object.freeze([]),
  });
  const bytes = renderPublicationJson(document);
  const digest = digestPublicationBytes(bytes);
  const fixtureSet = Object.freeze({}) as EmbeddedCaseFixtureSetV2;
  FIXTURE_SETS.set(fixtureSet, Object.freeze({ document, digest, bytes }));
  return Object.freeze({
    ok: true,
    fixtureSet,
    document,
    fixtureSetDigest: digest,
    canonicalBytes: bytes.slice(),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Creates the authenticated fixture set required by the first structured vertical.
 *
 * The first vertical currently embeds no external files, so its complete allowlisted set is empty.
 *
 * @param candidate Genuine first-vertical case authority.
 * @returns An opaque empty fixture set or a stable authentication diagnostic.
 */
export function createFirstVerticalEmbeddedFixtureSetV2(
  candidate: FirstVerticalPublicationCandidateV2,
): EmbeddedCaseFixtureValidationResultV2 {
  if (!validateFirstVerticalPublicationCandidateV2(candidate).ok) {
    return failure(
      "rule-model.unauthenticated-fixture",
      "/candidate",
      "Fixture authority requires the exact authenticated first vertical.",
    );
  }
  return closeEmptyFixtureSet();
}

/**
 * Validates a fixture document against the closed package-owned fixture registry.
 *
 * @param input Untrusted document value.
 * @returns Authenticated fixture capability or the first path-specific rejection.
 */
export function validateEmbeddedCaseFixtureDocumentV2(
  input: unknown,
): EmbeddedCaseFixtureValidationResultV2 {
  if (
    !isRecord(input) ||
    Object.keys(input).length !== 3 ||
    input.schemaVersion !== 2 ||
    input.kind !== "embedded-case-fixtures-v2" ||
    !Array.isArray(input.fixtures)
  ) {
    return failure(
      "rule-model.invalid-fixture-population",
      "/fixtures",
      "Fixture document must use the exact version-two shape.",
    );
  }
  const seen = new Set<string>();
  for (let index = 0; index < input.fixtures.length; index += 1) {
    const row = input.fixtures[index];
    const base = `/fixtures/${index}`;
    if (!isRecord(row) || typeof row.fixtureId !== "string") {
      return failure(
        "rule-model.invalid-fixture-population",
        `${base}/fixtureId`,
        "Fixture ID must be a canonical registry identity.",
      );
    }
    if (!safeFixturePath(row.relativePath)) {
      return failure(
        "rule-model.invalid-fixture-path",
        `${base}/relativePath`,
        "Fixture path must be a contained canonical path beneath fixtures/.",
      );
    }
    if (!isSha256Digest(row.digest)) {
      return failure(
        "rule-model.invalid-fixture-digest",
        `${base}/digest`,
        "Fixture digest must be canonical SHA-256.",
      );
    }
    if (seen.has(row.fixtureId)) {
      return failure(
        "rule-model.invalid-fixture-population",
        `${base}/fixtureId`,
        "Fixture IDs must be unique.",
      );
    }
    seen.add(row.fixtureId);
  }
  if (input.fixtures.length > 0) {
    return failure(
      "rule-model.invalid-fixture-population",
      "/fixtures/0/fixtureId",
      "Fixture ID is not owned by the current structured registry.",
    );
  }
  return closeEmptyFixtureSet();
}

/** Returns retained fixture state only for a genuine authenticated capability. */
export function getEmbeddedCaseFixtureSetStateV2(
  fixtureSet: EmbeddedCaseFixtureSetV2,
): FixtureSetState | undefined {
  return typeof fixtureSet === "object" && fixtureSet !== null
    ? FIXTURE_SETS.get(fixtureSet)
    : undefined;
}
