import { describe, expect, it, vi } from "vitest";

import {
  createAcceptedReviewBytes,
  createCurrentOraclePublicationSpecFixture,
} from "./test-fixtures/oracle-publication-spec-fixture.js";
import { PUBLISHED_ORACLE_REQUEST_INTENT } from "./test-fixtures/published-evidence-spec-fixture.js";
import type {
  OraclePublicationSpecFixture,
  PublicationReviewRequest,
  SpecDigest,
} from "./test-fixtures/oracle-publication-spec-fixture.js";

type CompatibleResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly path: string;
        readonly message: string;
      }[];
    };

interface PreparedPreview {
  readonly publicationDigest: SpecDigest;
  readonly stagedSnapshot: object;
}

interface PublicationApi {
  readonly prepareIncrementalBindingPublicationReview: (input: {
    readonly repositoryRoot: string;
    readonly baseSnapshot: object;
    readonly targetHandlerIds: readonly string[];
  }) => Promise<
    CompatibleResult<{
      readonly request: PublicationReviewRequest;
      readonly requestBytes: Uint8Array;
    }>
  >;
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
  readonly getPublishedBindingRows: (snapshot: object) =>
    | readonly {
        readonly handlerId: string;
        readonly implementationRevision: SpecDigest;
      }[]
    | undefined;
}

type ContextResult =
  | { readonly ok: true; readonly value: object; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly path: string;
        readonly message: string;
      }[];
    };

type RequestResult =
  | {
      readonly ok: true;
      readonly value: Readonly<Record<string, unknown>>;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly path: string;
        readonly message: string;
      }[];
    };

interface PublishedApi {
  readonly createPublishedOracleContext: (snapshot: object) => ContextResult;
  readonly createPublishedOracleRequest: (context: object, intent: unknown) => RequestResult;
  readonly evaluatePublishedOracle: (
    context: object,
    request: unknown,
  ) => Readonly<Record<string, unknown>>;
}

const RD03_HANDLER_IDS = [
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
] as const;
const RELEASED_GENERATOR_REVISION =
  "sha256:b71530380c60b5b2bb7dbe778a4c5a17045fa05840bf569ed7ac652f6019dfdb";

function requireSuccess<T>(result: CompatibleResult<T> | ContextResult | RequestResult): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.diagnostics));
  }
  return result.value as T;
}

function requireRecord(value: unknown, description: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function expectNoRequest(result: unknown): void {
  expect(result).toMatchObject({ ok: false });
  expect(result).not.toHaveProperty("value");
  expect(result).not.toHaveProperty("request");
}

function expectNoEvidence(result: unknown): void {
  expect(result).toMatchObject({ ok: false });
  for (const property of [
    "result",
    "evaluationIdentity",
    "sourceProvenance",
    "contentIdentities",
  ]) {
    expect(result).not.toHaveProperty(property);
  }
}

async function publicationApi(): Promise<PublicationApi> {
  return vi.importActual<PublicationApi>("./binding-publication.js");
}

async function resolverApi(): Promise<ResolverApi> {
  return vi.importActual<ResolverApi>("./publication-resolver.js");
}

async function publishedApi(): Promise<PublishedApi> {
  return vi.importActual<PublishedApi>("./published-oracle-context.js");
}

async function stagedSnapshot(
  fixture: OraclePublicationSpecFixture,
  publication: PublicationApi,
  resolver: ResolverApi,
): Promise<{ readonly baseSnapshot: object; readonly stagedSnapshot: object }> {
  const baseSnapshot = requireSuccess<object>(
    await resolver.resolvePublishedSnapshotByDigest({
      repositoryRoot: fixture.repositoryRoot,
      publicationDigest: fixture.publicationDigest,
    }),
  );
  const review = requireSuccess<{
    readonly request: PublicationReviewRequest;
    readonly requestBytes: Uint8Array;
  }>(
    await publication.prepareIncrementalBindingPublicationReview({
      repositoryRoot: fixture.repositoryRoot,
      baseSnapshot,
      targetHandlerIds: RD03_HANDLER_IDS,
    }),
  );
  const preview = requireSuccess<PreparedPreview>(
    await publication.prepareIncrementalBindingPublication({
      repositoryRoot: fixture.repositoryRoot,
      baseSnapshot,
      targetHandlerIds: RD03_HANDLER_IDS,
      semanticReviewBytes: createAcceptedReviewBytes(review.request),
    }),
  );
  return { baseSnapshot, stagedSnapshot: preview.stagedSnapshot };
}

describe("snapshot-bound published oracle evidence", () => {
  it("evaluates through one accepted nine-binding snapshot and emits revision-complete evidence", async () => {
    const publication = await publicationApi();
    const resolver = await resolverApi();
    const published = await publishedApi();
    const fixture = await createCurrentOraclePublicationSpecFixture();
    try {
      const { baseSnapshot, stagedSnapshot: snapshot } = await stagedSnapshot(
        fixture,
        publication,
        resolver,
      );
      const baseRows = resolver.getPublishedBindingRows(baseSnapshot);
      const rows = resolver.getPublishedBindingRows(snapshot);
      expect(baseRows).toHaveLength(4);
      expect(rows).toHaveLength(9);
      expect(new Set(rows?.map(({ handlerId }) => handlerId))).toHaveLength(9);
      for (const row of rows ?? []) {
        expect(row.implementationRevision).toMatch(/^sha256:[0-9a-f]{64}$/u);
      }

      expect(Object.keys(PUBLISHED_ORACLE_REQUEST_INTENT).sort()).toEqual([
        "budget",
        "configuration",
        "handlerId",
        "memory",
        "observable",
        "ordinal",
        "ruleId",
        "schemaVersion",
        "seed",
      ]);
      for (const forbidden of [
        "participantRevision",
        "participantRevisions",
        "implementationRevision",
        "generator",
        "boundaryTransform",
        "rendererRevision",
        "registry",
        "callable",
        "registration",
        "capability",
        "resolver",
        "case",
        "sourceCase",
        "provenance",
        "sourceProvenance",
        "inventory",
        "ruleModel",
      ]) {
        expect(PUBLISHED_ORACLE_REQUEST_INTENT).not.toHaveProperty(forbidden);
      }
      const generatorRow = rows?.find(({ handlerId }) => handlerId === "generator.frontend-cases");
      const boundaryRow = rows?.find(
        ({ handlerId }) => handlerId === "transform.boundary-variants",
      );
      const baseGeneratorRow = baseRows?.find(
        ({ handlerId }) => handlerId === "generator.frontend-cases",
      );
      const baseBoundaryRow = baseRows?.find(
        ({ handlerId }) => handlerId === "transform.boundary-variants",
      );
      expect(baseGeneratorRow).toBeDefined();
      expect(baseBoundaryRow).toBeDefined();
      expect(generatorRow?.implementationRevision).toBe(baseGeneratorRow?.implementationRevision);
      expect(boundaryRow?.implementationRevision).toBe(baseBoundaryRow?.implementationRevision);

      const context = requireSuccess<object>(published.createPublishedOracleContext(snapshot));
      const created = published.createPublishedOracleRequest(
        context,
        PUBLISHED_ORACLE_REQUEST_INTENT,
      );
      const request = requireSuccess<Readonly<Record<string, unknown>>>(created);
      expect(structuredClone(request)).toEqual(request);
      expect(created).not.toHaveProperty("evaluationIdentity");
      expect(created).not.toHaveProperty("contentIdentities");

      const provenance = requireRecord(request.sourceProvenance, "source provenance");
      const campaign = requireRecord(provenance.campaign, "source campaign");
      const generator = requireRecord(campaign.generator, "source generator");
      const boundary = requireRecord(campaign.boundaryTransform, "source boundary transform");
      expect(generator.implementationRevision).toBe(generatorRow?.implementationRevision);
      expect(boundary.implementationRevision).toBe(boundaryRow?.implementationRevision);
      expect(campaign.rendererRevision).toMatch(/^sha256:[0-9a-f]{64}$/u);

      const first = published.evaluatePublishedOracle(context, request);
      const second = published.evaluatePublishedOracle(context, request);
      expect(first).toMatchObject({
        ok: true,
        result: expect.objectContaining({ ok: true, outcome: "modeled" }),
        evaluationIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        sourceProvenance: request.sourceProvenance,
        contentIdentities: expect.any(Object),
        diagnostics: [],
      });
      expect(second).toEqual(first);
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects forged authority and caller-selected manifest, revisions, review, content, or provenance without stale evidence", async () => {
    const publication = await publicationApi();
    const resolver = await resolverApi();
    const published = await publishedApi();

    expect(published.createPublishedOracleContext({})).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "oracle.authority.missing",
          path: "/snapshot",
        }),
      ],
    });
    const forgedContext = published.evaluatePublishedOracle({}, { schemaVersion: 1 });
    expect(forgedContext).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "oracle.authority.missing",
          path: "/context",
        }),
      ],
    });
    expectNoEvidence(forgedContext);
    const forgedRequest = published.createPublishedOracleRequest(
      {},
      PUBLISHED_ORACLE_REQUEST_INTENT,
    );
    expect(forgedRequest).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "oracle.authority.missing",
          path: "/context",
        }),
      ],
    });
    expectNoRequest(forgedRequest);

    const fixture = await createCurrentOraclePublicationSpecFixture();
    try {
      const { stagedSnapshot: snapshot } = await stagedSnapshot(fixture, publication, resolver);
      const context = requireSuccess<object>(published.createPublishedOracleContext(snapshot));
      const getter = vi.fn(() => {
        throw new Error("must not execute");
      });
      const hostileIntent = Object.defineProperty({}, "handlerId", {
        enumerable: true,
        get: getter,
      });
      for (const intent of [
        hostileIntent,
        { ...PUBLISHED_ORACLE_REQUEST_INTENT, participantRevisions: {} },
        { ...PUBLISHED_ORACLE_REQUEST_INTENT, implementationRevision: RELEASED_GENERATOR_REVISION },
        { ...PUBLISHED_ORACLE_REQUEST_INTENT, registry: {} },
        { ...PUBLISHED_ORACLE_REQUEST_INTENT, sourceProvenance: {} },
        { ...PUBLISHED_ORACLE_REQUEST_INTENT, case: {} },
      ]) {
        const result = published.createPublishedOracleRequest(context, intent);
        expectNoRequest(result);
        expect(result).toMatchObject({
          diagnostics: [expect.objectContaining({ code: "oracle.input.invalid" })],
        });
      }
      expect(getter).not.toHaveBeenCalled();

      const request = requireSuccess<Readonly<Record<string, unknown>>>(
        published.createPublishedOracleRequest(context, PUBLISHED_ORACLE_REQUEST_INTENT),
      );

      for (const authorityMutation of [
        { manifest: { schemaVersion: 1 } },
        { participantRevisions: {} },
        { semanticReview: { schemaVersion: 1 } },
      ]) {
        const result = published.evaluatePublishedOracle(context, {
          ...request,
          ...authorityMutation,
        });
        expectNoEvidence(result);
        expect(result).toMatchObject({
          diagnostics: [
            expect.objectContaining({
              code: "oracle.input.invalid",
            }),
          ],
        });
      }

      const provenance = requireRecord(request.sourceProvenance, "source provenance");
      const campaign = requireRecord(provenance.campaign, "source campaign");
      const generator = requireRecord(campaign.generator, "source generator");
      const boundary = requireRecord(campaign.boundaryTransform, "source boundary transform");
      const mismatchedRevision = `sha256:${"0".repeat(64)}`;
      for (const sourceProvenance of [
        {
          ...provenance,
          campaign: {
            ...campaign,
            generator: {
              ...generator,
              implementationRevision: mismatchedRevision,
            },
          },
        },
        {
          ...provenance,
          campaign: {
            ...campaign,
            boundaryTransform: {
              ...boundary,
              implementationRevision: mismatchedRevision,
            },
          },
        },
        {
          ...provenance,
          campaign: {
            ...campaign,
            rendererRevision: mismatchedRevision,
          },
        },
      ]) {
        const result = published.evaluatePublishedOracle(context, {
          ...request,
          sourceProvenance,
        });
        expectNoEvidence(result);
      }

      const sourceCase = requireRecord(request.case, "source case");
      if (
        !Array.isArray(sourceCase.parameterBindings) ||
        sourceCase.parameterBindings.length === 0
      ) {
        throw new TypeError("expected a source parameter binding");
      }
      const [firstBinding, ...remainingBindings] = sourceCase.parameterBindings;
      const changedContent = published.evaluatePublishedOracle(context, {
        ...request,
        case: {
          ...sourceCase,
          parameterBindings: [
            {
              ...requireRecord(firstBinding, "source parameter binding"),
              value: 6n,
            },
            ...remainingBindings,
          ],
        },
      });
      expectNoEvidence(changedContent);

      const changedCase = published.evaluatePublishedOracle(context, {
        ...request,
        case: {
          ...sourceCase,
          primaryRuleId: "rule.ch02.2-primitive-types.byte.range.0-255",
        },
      });
      expectNoEvidence(changedCase);

      const changedProvenance = published.evaluatePublishedOracle(context, {
        ...request,
        sourceProvenance: {
          ...provenance,
          campaignDigest: `sha256:${"0".repeat(64)}`,
        },
      });
      expectNoEvidence(changedProvenance);
    } finally {
      await fixture.cleanup();
    }
  });
});
