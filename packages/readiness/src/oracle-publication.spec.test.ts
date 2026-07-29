import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  addEighthManifestMember,
  changeCarriedBinding,
  createAcceptedReviewBytes,
  createOraclePublicationSpecFixture,
  createReviewFailureVariants,
  removeSelectedRelease,
} from "./test-fixtures/oracle-publication-spec-fixture.js";
import type {
  OraclePublicationSpecFixture,
  PublicationReviewRequest,
  SpecDigest,
} from "./test-fixtures/oracle-publication-spec-fixture.js";

interface BindingRow {
  readonly handlerId: string;
  readonly kind: "generator" | "oracle" | "transform";
  readonly contractVersion: string;
  readonly implementationRevision: SpecDigest;
}

type CompatibleResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly kind: string;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly path: string;
        readonly message: string;
      }[];
    };

interface PreparedPreview {
  readonly prepared: object;
  readonly basePublicationDigest: SpecDigest;
  readonly publicationDigest: SpecDigest;
  readonly acceptedReviewDigest: SpecDigest;
  readonly promotedHandlerIds: readonly string[];
  readonly stagedSnapshot: object;
}

interface PreparedReview {
  readonly request: PublicationReviewRequest;
  readonly requestBytes: Uint8Array;
}

interface PublicationApi {
  readonly prepareIncrementalBindingPublicationReview: (input: {
    readonly repositoryRoot: string;
    readonly baseSnapshot: object;
    readonly targetHandlerIds: readonly string[];
  }) => Promise<CompatibleResult<PreparedReview>>;
  readonly prepareIncrementalBindingPublication: (input: {
    readonly repositoryRoot: string;
    readonly baseSnapshot: object;
    readonly targetHandlerIds: readonly string[];
    readonly semanticReviewBytes: Uint8Array;
  }) => Promise<CompatibleResult<PreparedPreview>>;
}

interface ResolverApi {
  readonly resolvePublishedSnapshotByDigest: (input: {
    readonly repositoryRoot: string;
    readonly publicationDigest: SpecDigest;
  }) => Promise<CompatibleResult<object>>;
  readonly getPublishedBindingRows: (snapshot: object) => readonly BindingRow[] | undefined;
}

const LEGACY_HANDLER_IDS = [
  "generator.compiler-cases",
  "generator.frontend-cases",
  "generator.runtime-cases",
  "transform.boundary-variants",
] as const;
const RD03_HANDLER_IDS = [
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
] as const;
const ALL_HANDLER_IDS = [...LEGACY_HANDLER_IDS, ...RD03_HANDLER_IDS].sort();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function requireSuccess<T>(result: CompatibleResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.diagnostics));
  }
  return result.value;
}

function expectDiagnostic(result: unknown, code: string, path: string): void {
  expect(result).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      {
        code,
        path,
        message: expect.any(String),
      },
    ]),
  });
  expect(result).not.toHaveProperty("value");
}

function expectDeeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (
    typeof value !== "object" ||
    value === null ||
    value instanceof Uint8Array ||
    seen.has(value)
  ) {
    return;
  }
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    expectDeeplyFrozen(Reflect.get(value, key), seen);
  }
}

async function publicationApi(): Promise<PublicationApi> {
  return vi.importActual<PublicationApi>("./binding-publication.js");
}

async function resolverApi(): Promise<ResolverApi> {
  return vi.importActual<ResolverApi>("./publication-resolver.js");
}

async function resolveBase(
  api: ResolverApi,
  fixture: OraclePublicationSpecFixture,
): Promise<object> {
  return requireSuccess(
    await api.resolvePublishedSnapshotByDigest({
      repositoryRoot: fixture.repositoryRoot,
      publicationDigest: fixture.publicationDigest,
    }),
  );
}

async function prepareAcceptedReview(
  publication: PublicationApi,
  fixture: OraclePublicationSpecFixture,
  baseSnapshot: object,
): Promise<{ readonly request: PublicationReviewRequest; readonly bytes: Uint8Array }> {
  const input = {
    repositoryRoot: fixture.repositoryRoot,
    baseSnapshot,
    targetHandlerIds: RD03_HANDLER_IDS,
  } as const;
  const prepared = requireSuccess(
    await publication.prepareIncrementalBindingPublicationReview(input),
  );
  expect(Object.keys(prepared).sort()).toEqual(["request", "requestBytes"]);
  expect(prepared).not.toHaveProperty("prepared");
  expect(prepared).not.toHaveProperty("acceptedReviewDigest");
  expect(prepared).not.toHaveProperty("publicationDigest");
  expect(prepared).not.toHaveProperty("stagedSnapshot");
  expect(prepared.request).toMatchObject({
    schemaVersion: 1,
    semanticDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    specRevision: expect.any(String),
    promotedHandlerIds: RD03_HANDLER_IDS,
  });
  expect(Object.keys(prepared.request).sort()).toEqual([
    "dependencyDigests",
    "promotedHandlerIds",
    "reviewUnits",
    "schemaVersion",
    "semanticDigest",
    "specRevision",
  ]);
  expect(prepared.request.reviewUnits.length).toBeGreaterThan(0);
  const unitIds = prepared.request.reviewUnits.map(({ unitId }) => unitId);
  expect(unitIds).toEqual([...unitIds].sort());
  expect(new Set(unitIds)).toHaveLength(unitIds.length);
  for (const unit of prepared.request.reviewUnits) {
    expect(unit.semanticDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    for (const digest of Object.values(unit.dependencyDigests)) {
      expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    }
  }
  expectDeeplyFrozen(prepared.request);

  const canonicalBytes = encoder.encode(`${JSON.stringify(prepared.request)}\n`);
  expect(prepared.requestBytes).toEqual(canonicalBytes);
  expect(JSON.parse(decoder.decode(prepared.requestBytes))).toEqual(prepared.request);

  prepared.requestBytes.fill(0);
  const repeated = requireSuccess(
    await publication.prepareIncrementalBindingPublicationReview(input),
  );
  expect(repeated.request).toEqual(prepared.request);
  expect(repeated.requestBytes).toEqual(canonicalBytes);

  return {
    request: repeated.request,
    bytes: createAcceptedReviewBytes(repeated.request),
  };
}

describe("incremental oracle publication staging", () => {
  it("carries four rows byte-identically and promotes exactly five into one nine-row snapshot", async () => {
    const publication = await publicationApi();
    expect(publication.prepareIncrementalBindingPublicationReview).toBeTypeOf("function");
    const resolver = await resolverApi();
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const baseSnapshot = await resolveBase(resolver, fixture);
      const baseRows = resolver.getPublishedBindingRows(baseSnapshot);
      expect(baseRows?.map(({ handlerId }) => handlerId)).toEqual(LEGACY_HANDLER_IDS);
      const review = await prepareAcceptedReview(publication, fixture, baseSnapshot);

      const preview = requireSuccess(
        await publication.prepareIncrementalBindingPublication({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: RD03_HANDLER_IDS,
          semanticReviewBytes: review.bytes,
        }),
      );
      const stagedRows = resolver.getPublishedBindingRows(preview.stagedSnapshot);
      expect(preview.basePublicationDigest).toBe(fixture.publicationDigest);
      expect(preview.publicationDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(preview.acceptedReviewDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(preview.promotedHandlerIds).toEqual(RD03_HANDLER_IDS);
      expect(stagedRows?.map(({ handlerId }) => handlerId)).toEqual(ALL_HANDLER_IDS);
      expect(stagedRows).toHaveLength(9);
      expect(new Set(stagedRows?.map(({ handlerId }) => handlerId))).toHaveLength(9);
      expect(
        stagedRows?.filter(({ handlerId }) =>
          (LEGACY_HANDLER_IDS as readonly string[]).includes(handlerId),
        ),
      ).toEqual(baseRows);
      expect(
        await readFile(
          join(fixture.repositoryRoot, "readiness/publications/current-publication.json"),
        ),
      ).toEqual(fixture.pointerBytes);
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects changed or absent bases, the wrong target set, and an eighth release member", async () => {
    const publication = await publicationApi();
    const resolver = await resolverApi();

    const forgedFixture = await createOraclePublicationSpecFixture();
    try {
      expectDiagnostic(
        await publication.prepareIncrementalBindingPublication({
          repositoryRoot: forgedFixture.repositoryRoot,
          baseSnapshot: {},
          targetHandlerIds: RD03_HANDLER_IDS,
          semanticReviewBytes: new Uint8Array(),
        }),
        "publication.base.invalid",
        "/baseSnapshot",
      );
    } finally {
      await forgedFixture.cleanup();
    }

    const absentFixture = await createOraclePublicationSpecFixture();
    try {
      const baseSnapshot = await resolveBase(resolver, absentFixture);
      await removeSelectedRelease(absentFixture);
      expectDiagnostic(
        await publication.prepareIncrementalBindingPublication({
          repositoryRoot: absentFixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: RD03_HANDLER_IDS,
          semanticReviewBytes: new Uint8Array(),
        }),
        "publication.base.invalid",
        "/baseSnapshot",
      );
    } finally {
      await absentFixture.cleanup();
    }

    const targetFixture = await createOraclePublicationSpecFixture();
    try {
      const baseSnapshot = await resolveBase(resolver, targetFixture);
      expectDiagnostic(
        await publication.prepareIncrementalBindingPublication({
          repositoryRoot: targetFixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: RD03_HANDLER_IDS.slice(0, -1),
          semanticReviewBytes: new Uint8Array(),
        }),
        "publication.targets.invalid",
        "/targetHandlerIds",
      );
    } finally {
      await targetFixture.cleanup();
    }

    const carriedFixture = await createOraclePublicationSpecFixture();
    try {
      const baseSnapshot = await resolveBase(resolver, carriedFixture);
      const review = await prepareAcceptedReview(publication, carriedFixture, baseSnapshot);
      await changeCarriedBinding(carriedFixture.repositoryRoot, LEGACY_HANDLER_IDS[0]);
      const result = await publication.prepareIncrementalBindingPublication({
        repositoryRoot: carriedFixture.repositoryRoot,
        baseSnapshot,
        targetHandlerIds: RD03_HANDLER_IDS,
        semanticReviewBytes: review.bytes,
      });
      expect(result).toMatchObject({ ok: false });
      expect(result).not.toHaveProperty("value");
      expect(
        await readFile(
          join(carriedFixture.repositoryRoot, "readiness/publications/current-publication.json"),
        ),
      ).toEqual(carriedFixture.pointerBytes);
    } finally {
      await carriedFixture.cleanup();
    }

    const memberFixture = await createOraclePublicationSpecFixture();
    try {
      await addEighthManifestMember(memberFixture);
      const result = await resolver.resolvePublishedSnapshotByDigest({
        repositoryRoot: memberFixture.repositoryRoot,
        publicationDigest: memberFixture.publicationDigest,
      });
      expect(result).toMatchObject({ ok: false });
      expect(result).not.toHaveProperty("value");
    } finally {
      await memberFixture.cleanup();
    }
  });

  it("reconstructs review authority and rejects missing, extra, stale, or rejected evidence without a snapshot", async () => {
    const publication = await publicationApi();
    const resolver = await resolverApi();
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const baseSnapshot = await resolveBase(resolver, fixture);
      const review = await prepareAcceptedReview(publication, fixture, baseSnapshot);

      expectDiagnostic(
        await publication.prepareIncrementalBindingPublication({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: RD03_HANDLER_IDS,
          semanticReviewBytes: fixture.legacySemanticReviewBytes,
        }),
        "publication.review.stale",
        "semantic-review-v1.json",
      );

      for (const variant of createReviewFailureVariants(review.bytes)) {
        expectDiagnostic(
          await publication.prepareIncrementalBindingPublication({
            repositoryRoot: fixture.repositoryRoot,
            baseSnapshot,
            targetHandlerIds: RD03_HANDLER_IDS,
            semanticReviewBytes: variant.bytes,
          }),
          variant.code,
          "semantic-review-v1.json",
        );
      }

      const preview = requireSuccess(
        await publication.prepareIncrementalBindingPublication({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: RD03_HANDLER_IDS,
          semanticReviewBytes: review.bytes,
        }),
      );
      const resolved = requireSuccess(
        await resolver.resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: preview.publicationDigest,
        }),
      );
      expect(resolver.getPublishedBindingRows(resolved)).toHaveLength(9);
    } finally {
      await fixture.cleanup();
    }
  });
});
