import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  prepareBindingPublicationReview,
  publishBindingTransaction,
} from "../binding-publication.js";
import type { PublicationResult } from "../publication-model.js";
import {
  restoreCurrentUnboundPublicationAuthority,
  restoreUnboundPublicationAuthority,
} from "./unbound-publication-authority.js";
import {
  createCurrentReadinessAuthorityRepository,
  createHistoricalReadinessAuthorityRepository,
} from "./historical-readiness-authority.js";

export type SpecDigest = `sha256:${string}`;

interface PublicationPointer {
  readonly schemaVersion: 1;
  readonly publicationDigest: SpecDigest;
}

interface SemanticReviewRecord {
  readonly unitId: string;
  readonly reviewer: string;
  readonly specRevision: string;
  readonly semanticDigest: SpecDigest;
  readonly dependencyDigests: Readonly<Record<string, SpecDigest>>;
  readonly outcome: "accepted" | "blocked";
  readonly resolvedDisagreementIds: readonly string[];
}

interface SemanticReviewDocument {
  readonly schemaVersion: 1;
  readonly reviews: readonly SemanticReviewRecord[];
}

export interface PublicationReviewUnit {
  readonly unitId: string;
  readonly semanticDigest: SpecDigest;
  readonly dependencyDigests: Readonly<Record<string, SpecDigest>>;
}

export interface PublicationReviewRequest {
  readonly schemaVersion: 1;
  readonly semanticDigest: SpecDigest;
  readonly specRevision: string;
  readonly dependencyDigests: Readonly<Record<string, SpecDigest>>;
  readonly promotedHandlerIds: readonly string[];
  readonly reviewUnits: readonly PublicationReviewUnit[];
}

interface BindingRow {
  readonly handlerId: string;
  readonly implementationRevision: SpecDigest;
  readonly [key: string]: unknown;
}

interface BindingDocument {
  readonly schemaVersion: 1;
  readonly bindings: readonly BindingRow[];
}

interface PublicationManifestMember {
  readonly path: string;
  readonly [key: string]: unknown;
}

interface PublicationManifest {
  readonly members: readonly PublicationManifestMember[];
  readonly [key: string]: unknown;
}

export interface OraclePublicationSpecFixture {
  readonly repositoryRoot: string;
  readonly publicationDigest: SpecDigest;
  readonly pointerBytes: Uint8Array;
  readonly legacySemanticReviewBytes: Uint8Array;
  cleanup(): Promise<void>;
}

export interface LegacyPublicationSpecFixture {
  readonly repositoryRoot: string;
  cleanup(): Promise<void>;
}

export interface ReviewFailureVariant {
  readonly name: "missing" | "extra" | "stale" | "rejected";
  readonly bytes: Uint8Array;
  readonly code:
    | "publication.review.invalid"
    | "publication.review.stale"
    | "publication.review.not-accepted";
}

const SOURCE_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const RD02_BASE_PUBLICATION_DIGEST =
  "sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function parseObject(bytes: Uint8Array, description: string): Record<string, unknown> {
  const value: unknown = JSON.parse(decoder.decode(bytes));
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`expected ${description} to be an object`);
  }
  return value as Record<string, unknown>;
}

function parsePointer(bytes: Uint8Array): PublicationPointer {
  const value = parseObject(bytes, "publication pointer");
  if (
    value.schemaVersion !== 1 ||
    typeof value.publicationDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value.publicationDigest)
  ) {
    throw new TypeError("expected a canonical selected publication pointer");
  }
  return value as unknown as PublicationPointer;
}

function parseReviews(bytes: Uint8Array): SemanticReviewDocument {
  const value = parseObject(bytes, "semantic review");
  if (value.schemaVersion !== 1 || !Array.isArray(value.reviews) || value.reviews.length === 0) {
    throw new TypeError("expected non-empty semantic review evidence");
  }
  return value as unknown as SemanticReviewDocument;
}

function encodeJson(value: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(value)}\n`);
}

function requirePublicationSuccess<T>(result: PublicationResult<T>, operation: string): T {
  if (!result.ok) {
    throw new TypeError(
      `${operation} failed: ${result.diagnostics
        .map(({ code, path }) => `${code}@${path}`)
        .join(",")}`,
    );
  }
  return result.value;
}

async function copyRepositoryAuthority(prefix: string): Promise<string> {
  return createHistoricalReadinessAuthorityRepository(prefix);
}

export async function createOraclePublicationSpecFixture(): Promise<OraclePublicationSpecFixture> {
  const repositoryRoot = await createCurrentReadinessAuthorityRepository(
    "blend65-oracle-publication-spec-",
  );
  const pointerPath = join(repositoryRoot, "readiness/publications/current-publication.json");
  const pointerBytes = encodeJson({
    schemaVersion: 1,
    publicationDigest: RD02_BASE_PUBLICATION_DIGEST,
  });
  await writeFile(pointerPath, pointerBytes);
  const retainedPointerBytes = await readFile(pointerPath);
  const { publicationDigest } = parsePointer(retainedPointerBytes);
  const legacySemanticReviewBytes = await readFile(
    join(
      repositoryRoot,
      "readiness/publications/releases",
      publicationDigest,
      "semantic-review-v1.json",
    ),
  );

  return {
    repositoryRoot,
    publicationDigest,
    pointerBytes: retainedPointerBytes,
    legacySemanticReviewBytes,
    cleanup: () => rm(repositoryRoot, { recursive: true }),
  };
}

/**
 * Publishes an isolated reviewed version-one base from exact current callable authority.
 *
 * The repository's historical releases remain untouched. The returned release exists only in the
 * temporary fixture and can therefore serve tests that need genuine executable base authority.
 *
 * @returns A current four-handler publication and cleanup capability.
 *
 * @example
 * ```ts
 * const fixture = await createCurrentOraclePublicationSpecFixture();
 * try {
 *   // Resolve fixture.publicationDigest through the executable resolver.
 * } finally {
 *   await fixture.cleanup();
 * }
 * ```
 */
export async function createCurrentOraclePublicationSpecFixture(): Promise<OraclePublicationSpecFixture> {
  const repositoryRoot = await createCurrentReadinessAuthorityRepository(
    "blend65-current-oracle-publication-spec-",
  );
  try {
    await restoreCurrentUnboundPublicationAuthority(SOURCE_REPOSITORY_ROOT, repositoryRoot);
    const prepared = requirePublicationSuccess(
      await prepareBindingPublicationReview({ repositoryRoot }),
      "Current publication review preparation",
    );
    const semanticReviewBytes = createAcceptedReviewBytes(
      prepared.request,
      "current-v1-fixture-reviewer",
    );
    const published = requirePublicationSuccess(
      await publishBindingTransaction({ repositoryRoot, semanticReviewBytes }),
      "Current binding publication",
    );
    const pointerBytes = await readFile(
      join(repositoryRoot, "readiness/publications/current-publication.json"),
    );
    const pointer = parsePointer(pointerBytes);
    if (pointer.publicationDigest !== published.publicationDigest) {
      throw new TypeError("Current fixture pointer does not name its published release.");
    }
    const legacySemanticReviewBytes = await readFile(
      join(
        repositoryRoot,
        "readiness/publications/releases",
        published.publicationDigest,
        "semantic-review-v1.json",
      ),
    );
    return {
      repositoryRoot,
      publicationDigest: published.publicationDigest,
      pointerBytes,
      legacySemanticReviewBytes,
      cleanup: () => rm(repositoryRoot, { recursive: true }),
    };
  } catch (error) {
    await rm(repositoryRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function createLegacyPublicationSpecFixture(): Promise<LegacyPublicationSpecFixture> {
  const repositoryRoot = await copyRepositoryAuthority("blend65-oracle-legacy-spec-");
  await restoreUnboundPublicationAuthority(SOURCE_REPOSITORY_ROOT, repositoryRoot);
  return {
    repositoryRoot,
    cleanup: () => rm(repositoryRoot, { recursive: true }),
  };
}

export function createReviewFailureVariants(bytes: Uint8Array): readonly ReviewFailureVariant[] {
  const document = parseReviews(bytes);
  const [first, ...remaining] = document.reviews;
  if (first === undefined) {
    throw new TypeError("expected review evidence");
  }

  return [
    {
      name: "missing",
      bytes: encodeJson({ ...document, reviews: remaining }),
      code: "publication.review.invalid",
    },
    {
      name: "extra",
      bytes: encodeJson({
        ...document,
        reviews: [
          ...document.reviews,
          {
            ...first,
            unitId: `${first.unitId}.unexpected`,
          },
        ],
      }),
      code: "publication.review.invalid",
    },
    {
      name: "stale",
      bytes: encodeJson({
        ...document,
        reviews: [
          {
            ...first,
            semanticDigest: `sha256:${"0".repeat(64)}`,
          },
          ...remaining,
        ],
      }),
      code: "publication.review.stale",
    },
    {
      name: "rejected",
      bytes: encodeJson({
        ...document,
        reviews: [{ ...first, outcome: "blocked" }, ...remaining],
      }),
      code: "publication.review.not-accepted",
    },
  ];
}

export function createAcceptedReviewBytes(
  request: PublicationReviewRequest,
  reviewer = "phase5-spec-reviewer",
): Uint8Array {
  return encodeJson({
    schemaVersion: 1,
    reviews: request.reviewUnits.map((unit) => ({
      unitId: unit.unitId,
      reviewer,
      specRevision: request.specRevision,
      semanticDigest: unit.semanticDigest,
      dependencyDigests: unit.dependencyDigests,
      outcome: "accepted",
      resolvedDisagreementIds: [],
    })),
  });
}

export async function changeCarriedBinding(
  repositoryRoot: string,
  handlerId: string,
): Promise<void> {
  const pointer = parsePointer(
    await readFile(join(repositoryRoot, "readiness/publications/current-publication.json")),
  );
  const path = join(
    repositoryRoot,
    "readiness/publications/releases",
    pointer.publicationDigest,
    "bindings-v1.json",
  );
  const bytes = await readFile(path);
  const value = parseObject(bytes, "binding registry");
  if (value.schemaVersion !== 1 || !Array.isArray(value.bindings)) {
    throw new TypeError("expected a version-one binding registry");
  }
  const document = value as unknown as BindingDocument;
  let changed = false;
  const bindings = document.bindings.map((binding) => {
    if (binding.handlerId !== handlerId) {
      return binding;
    }
    changed = true;
    return {
      ...binding,
      implementationRevision: `sha256:${"f".repeat(64)}` as SpecDigest,
    };
  });
  if (!changed) {
    throw new TypeError(`expected carried binding ${handlerId}`);
  }
  await writeFile(path, encodeJson({ ...document, bindings }));
}

export async function removeSelectedRelease(fixture: OraclePublicationSpecFixture): Promise<void> {
  await rm(
    join(fixture.repositoryRoot, "readiness/publications/releases", fixture.publicationDigest),
    { recursive: true },
  );
}

export async function addEighthManifestMember(
  fixture: OraclePublicationSpecFixture,
): Promise<void> {
  const path = join(
    fixture.repositoryRoot,
    "readiness/publications/releases",
    fixture.publicationDigest,
    "manifest.json",
  );
  const value = parseObject(await readFile(path), "publication manifest");
  if (!Array.isArray(value.members) || value.members.length !== 7) {
    throw new TypeError("expected the fixed seven-member publication manifest");
  }
  const document = value as unknown as PublicationManifest;
  const first = document.members[0];
  if (first === undefined) {
    throw new TypeError("expected a publication member");
  }
  await writeFile(
    path,
    encodeJson({
      ...document,
      members: [
        ...document.members,
        {
          ...first,
          path: "unexpected-eighth-member.json",
        },
      ],
    }),
  );
}
