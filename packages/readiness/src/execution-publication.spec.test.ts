import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  CAPABILITY_IDS,
  CURRENT_PARENT_DIGEST,
  HISTORICAL_PARENT_DIGEST,
  canonicalJsonBytes,
  createIsolatedRepository,
  digestBytes,
  executionReleaseRoot,
  expectedPublication,
  makeBindings,
  makePublicationInput,
  makeReview,
  pathExists,
  readExecutionPointer,
  readParentProjectionFacts,
  removeIsolatedRepository,
  snapshotParentPublications,
  snapshotTree,
  type ExecutionPublicationInputFixtureV1,
} from "./test-fixtures/execution-publication-spec-fixture.js";

type Issue = { code: string; path: string; message: string };
type OperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: readonly [Issue, ...Issue[]] };

interface Candidate {
  readonly digest: string;
  readonly parentDigest: string;
  readonly bindingDigest: string;
  readonly semanticReviewDigest: string;
}

interface Inspection {
  readonly selectedDigest?: string;
  readonly releases: readonly string[];
  readonly diagnostics: readonly Issue[];
}

interface CompositeProjection {
  readonly parentDigest: string;
  readonly executionDigest: string;
  readonly capabilities: readonly (
    | { capabilityId: string; state: "bound" }
    | {
        capabilityId: string;
        state: "unbound";
        blocker: "unbound-evidence-capability";
      }
  )[];
  readonly rules: readonly unknown[];
}

interface PublicReadinessApi {
  prepareExecutionPublicationCandidateV1(
    input: ExecutionPublicationInputFixtureV1,
  ): Promise<OperationResult<Candidate>>;
  resolvePublishedExecutionRelease(
    repositoryRoot: string,
    digest?: string,
  ): Promise<OperationResult<unknown>>;
  resolvePublishedSnapshotByDigest(input: {
    repositoryRoot: string;
    publicationDigest: string;
  }): Promise<OperationResult<unknown>>;
  resolveCompositeReadinessSnapshot(parent: unknown, execution: unknown): OperationResult<unknown>;
  getCompositeReadinessProjectionV1(composite: unknown): OperationResult<CompositeProjection>;
  inspectExecutionPublicationV1(repositoryRoot: string): Promise<OperationResult<Inspection>>;
  readonly selectExecutionPublicationByDigestV1?: unknown;
  readonly editExecutionPublicationPointerV1?: unknown;
}

interface ConformanceHooks {
  atFaultPoint(point: FaultPoint, context: unknown): void;
  atReconciliationObservation(observation: unknown): void;
}

type FaultPoint =
  | "after-member-sync"
  | "after-staging-sync"
  | "before-review-validation"
  | "after-review-validation"
  | "before-release-rename"
  | "after-release-rename"
  | "after-releases-sync"
  | "before-pointer-write"
  | "after-pointer-file-sync"
  | "before-pointer-rename"
  | "after-pointer-rename"
  | "after-pointer-directory-sync"
  | "during-reconciliation";

interface ConformanceApi {
  runWithExecutionPublicationConformanceV1<T>(
    hooks: ConformanceHooks,
    operation: () => T | Promise<T>,
  ): Promise<T>;
  validateExecutionPublicationModuleBoundaryV1(
    files: readonly { readonly path: string; readonly source: string }[],
  ): OperationResult<true>;
}

interface TransactionApi {
  commitExecutionPublicationSelectionV1(
    repositoryRoot: string,
    digest: string,
    revalidateImmediatelyBeforeCommit: () => OperationResult<true>,
  ): Promise<OperationResult<unknown>>;
}

const temporaryRepositories = new Set<string>();

async function repository(): Promise<string> {
  const root = await createIsolatedRepository();
  temporaryRepositories.add(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    [...temporaryRepositories].map(async (root) => {
      await removeIsolatedRepository(root);
      temporaryRepositories.delete(root);
    }),
  );
});

function expectOk<T>(result: OperationResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`expected success, received ${result.issues[0].code}`);
  }
  return result.value;
}

function expectIssue<T>(result: OperationResult<T>, code: string, path: string): readonly Issue[] {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected a rejected operation");
  }
  expect(result.issues[0]).toMatchObject({ code, path });
  expect(result.issues[0].message.trim().length).toBeGreaterThan(0);
  return result.issues;
}

async function publicApi(): Promise<PublicReadinessApi> {
  const api = (await import("@blend65/readiness")) as PublicReadinessApi;
  expect(typeof api.prepareExecutionPublicationCandidateV1).toBe("function");
  expect(typeof api.resolvePublishedExecutionRelease).toBe("function");
  expect(typeof api.resolvePublishedSnapshotByDigest).toBe("function");
  expect(typeof api.resolveCompositeReadinessSnapshot).toBe("function");
  expect(typeof api.getCompositeReadinessProjectionV1).toBe("function");
  expect(typeof api.inspectExecutionPublicationV1).toBe("function");
  return api;
}

async function conformanceApi(): Promise<ConformanceApi> {
  return (await import("./execution-publication-conformance-v1.js")) as ConformanceApi;
}

async function transactionApi(): Promise<TransactionApi> {
  return (await import("./execution-publication-transaction.js")) as TransactionApi;
}

async function prepareAccepted(
  api: PublicReadinessApi,
  root: string,
  parentDigest = CURRENT_PARENT_DIGEST,
  variant = "accepted",
): Promise<{ input: ExecutionPublicationInputFixtureV1; candidate: Candidate }> {
  const input = makePublicationInput(root, parentDigest, variant);
  const candidate = expectOk(await api.prepareExecutionPublicationCandidateV1(input));
  return { input, candidate };
}

async function resolvedComposite(
  api: PublicReadinessApi,
  root: string,
  parentDigest: string,
  executionDigest: string,
): Promise<{ composite: unknown; projection: CompositeProjection }> {
  const parent = expectOk(
    await api.resolvePublishedSnapshotByDigest({
      repositoryRoot: root,
      publicationDigest: parentDigest,
    }),
  );
  const execution = expectOk(await api.resolvePublishedExecutionRelease(root, executionDigest));
  const composite = expectOk(api.resolveCompositeReadinessSnapshot(parent, execution));
  return {
    composite,
    projection: expectOk(api.getCompositeReadinessProjectionV1(composite)),
  };
}

describe("execution publication identity and projection", () => {
  it("publishes six ordered bindings as immutable final bytes and resolves the opaque release", async () => {
    const api = await publicApi();
    const root = await repository();
    const input = makePublicationInput(root);
    const expected = expectedPublication(input);

    const candidate = expectOk(await api.prepareExecutionPublicationCandidateV1(input));
    expect(candidate).toEqual({
      digest: expected.digest,
      parentDigest: expected.parentDigest,
      bindingDigest: expected.bindingDigest,
      semanticReviewDigest: expected.semanticReviewDigest,
    });

    const releaseBytes = await snapshotTree(executionReleaseRoot(root, expected.digest));
    expect(releaseBytes).toEqual({
      "execution-bindings-v1.json": input.bindingBytes,
      "execution-manifest-v1.json": expected.manifestBytes,
      ...expected.memberBytes,
    });
    expectOk(await api.resolvePublishedExecutionRelease(root, expected.digest));
  });

  it("rejects structural, copied, and proxied release and composite impostors before projection", async () => {
    const api = await publicApi();
    const root = await repository();
    const { candidate } = await prepareAccepted(api, root);
    const parent = expectOk(
      await api.resolvePublishedSnapshotByDigest({
        repositoryRoot: root,
        publicationDigest: CURRENT_PARENT_DIGEST,
      }),
    );
    const release = expectOk(await api.resolvePublishedExecutionRelease(root, candidate.digest));
    const composite = expectOk(api.resolveCompositeReadinessSnapshot(parent, release));

    for (const impostor of [{}, { ...(release as object) }, new Proxy(release as object, {})]) {
      expectIssue(
        api.resolveCompositeReadinessSnapshot(parent, impostor),
        "execution.identity",
        "",
      );
    }
    for (const impostor of [{}, { ...(composite as object) }, new Proxy(composite as object, {})]) {
      expectIssue(api.getCompositeReadinessProjectionV1(impostor), "execution.identity", "");
    }
  });

  it("replaces exactly six parent blockers while retaining parent rules and identity", async () => {
    const api = await publicApi();
    const root = await repository();
    const parentBefore = await snapshotParentPublications(root);
    const parentFacts = await readParentProjectionFacts(root);
    expect(parentFacts.rules).toHaveLength(9);
    expect(parentFacts.capabilities).toEqual(
      CAPABILITY_IDS.map((capabilityId) => ({
        capabilityId,
        state: "unbound",
        blocker: "unbound-evidence-capability",
      })),
    );

    const { candidate } = await prepareAccepted(api, root);
    const { projection } = await resolvedComposite(
      api,
      root,
      CURRENT_PARENT_DIGEST,
      candidate.digest,
    );
    expect(projection).toEqual({
      parentDigest: CURRENT_PARENT_DIGEST,
      executionDigest: candidate.digest,
      capabilities: CAPABILITY_IDS.map((capabilityId) => ({
        capabilityId,
        state: "bound",
      })),
      rules: parentFacts.rules,
    });
    expect(await snapshotParentPublications(root)).toEqual(parentBefore);
  });
});

describe("strict execution authority validation", () => {
  const invalidRows: readonly {
    name: string;
    mutate(
      root: string,
      input: ExecutionPublicationInputFixtureV1,
    ): ExecutionPublicationInputFixtureV1;
    code: string;
    path: string;
  }[] = [
    {
      name: "missing binding row",
      mutate: (root) => {
        const bindings = makeBindings();
        bindings.bindings.pop();
        const bindingBytes = canonicalJsonBytes(bindings);
        return {
          repositoryRoot: root,
          parentDigest: CURRENT_PARENT_DIGEST,
          bindingBytes,
          semanticReviewBytes: canonicalJsonBytes(makeReview(CURRENT_PARENT_DIGEST, bindingBytes)),
        };
      },
      code: "execution.invalid-schema",
      path: "/bindings",
    },
    {
      name: "duplicate binding row",
      mutate: (root) => {
        const bindings = makeBindings();
        bindings.bindings[1] = { ...bindings.bindings[0] };
        const bindingBytes = canonicalJsonBytes(bindings);
        return {
          repositoryRoot: root,
          parentDigest: CURRENT_PARENT_DIGEST,
          bindingBytes,
          semanticReviewBytes: canonicalJsonBytes(makeReview(CURRENT_PARENT_DIGEST, bindingBytes)),
        };
      },
      code: "execution.invalid-schema",
      path: "/bindings/1",
    },
    {
      name: "stale reviewed binding digest",
      mutate: (_root, input) => {
        const review = makeReview(CURRENT_PARENT_DIGEST, input.bindingBytes);
        review.bindingDigest = digestBytes(canonicalJsonBytes({ stale: true }));
        return { ...input, semanticReviewBytes: canonicalJsonBytes(review) };
      },
      code: "execution.stale-authority",
      path: "/bindingDigest",
    },
    {
      name: "undeclared capability row",
      mutate: (root) => {
        const bindings = makeBindings();
        bindings.bindings[0] = {
          ...bindings.bindings[0],
          capabilityId: "link",
        };
        const bindingBytes = canonicalJsonBytes(bindings);
        return {
          repositoryRoot: root,
          parentDigest: CURRENT_PARENT_DIGEST,
          bindingBytes,
          semanticReviewBytes: canonicalJsonBytes(makeReview(CURRENT_PARENT_DIGEST, bindingBytes)),
        };
      },
      code: "execution.stale-authority",
      path: "/bindings/0/capabilityId",
    },
    {
      name: "incompatible contract version",
      mutate: (root) => {
        const bindings = makeBindings();
        bindings.bindings[0] = {
          ...bindings.bindings[0],
          contractVersion: "2.0.0",
        };
        const bindingBytes = canonicalJsonBytes(bindings);
        return {
          repositoryRoot: root,
          parentDigest: CURRENT_PARENT_DIGEST,
          bindingBytes,
          semanticReviewBytes: canonicalJsonBytes(makeReview(CURRENT_PARENT_DIGEST, bindingBytes)),
        };
      },
      code: "execution.stale-authority",
      path: "/bindings/0/contractVersion",
    },
  ];

  it.each(invalidRows)("rejects $name at its first authoritative path", async (testCase) => {
    const api = await publicApi();
    const root = await repository();
    const input = testCase.mutate(root, makePublicationInput(root));
    expectIssue(
      await api.prepareExecutionPublicationCandidateV1(input),
      testCase.code,
      testCase.path,
    );
  });

  it.each([
    {
      name: "review naming a different parent",
      parentDigest: CURRENT_PARENT_DIGEST,
      reviewParent: HISTORICAL_PARENT_DIGEST,
    },
    {
      name: "unavailable parent digest",
      parentDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      reviewParent: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    },
  ])("rejects $name without changing parent bytes", async (testCase) => {
    const api = await publicApi();
    const root = await repository();
    const before = await snapshotParentPublications(root);
    const bindingBytes = canonicalJsonBytes(makeBindings());
    const input = {
      repositoryRoot: root,
      parentDigest: testCase.parentDigest,
      bindingBytes,
      semanticReviewBytes: canonicalJsonBytes(makeReview(testCase.reviewParent, bindingBytes)),
    };
    expectIssue(
      await api.prepareExecutionPublicationCandidateV1(input),
      "execution.stale-authority",
      "/parentDigest",
    );
    expect(await snapshotParentPublications(root)).toEqual(before);
  });
});

describe("transaction durability and passive history", () => {
  it("fails safely at every staged write, review, rename, pointer, and sync boundary", async () => {
    const api = await publicApi();
    const conformance = await conformanceApi();
    const transaction = await transactionApi();
    const root = await repository();
    const { candidate: prior } = await prepareAccepted(api, root, CURRENT_PARENT_DIGEST, "prior");
    expectOk(
      await transaction.commitExecutionPublicationSelectionV1(root, prior.digest, () => ({
        ok: true,
        value: true,
      })),
    );

    const releaseFaultPoints = [
      "after-member-sync",
      "after-staging-sync",
      "before-review-validation",
      "after-review-validation",
      "before-release-rename",
      "after-release-rename",
      "after-releases-sync",
    ] as const;
    const pointerFaultPoints = [
      "before-pointer-write",
      "after-pointer-file-sync",
      "before-pointer-rename",
      "after-pointer-rename",
      "after-pointer-directory-sync",
    ] as const;

    for (const [index, faultPoint] of releaseFaultPoints.entries()) {
      const input = makePublicationInput(root, CURRENT_PARENT_DIGEST, `fault-${index}`);
      const attempted = expectedPublication(input);
      const result = await conformance.runWithExecutionPublicationConformanceV1(
        {
          atFaultPoint(point) {
            if (point === faultPoint) {
              throw new Error(`injected ${faultPoint}`);
            }
          },
          atReconciliationObservation() {},
        },
        () => api.prepareExecutionPublicationCandidateV1(input),
      );
      if (faultPoint === "after-release-rename" || faultPoint === "after-releases-sync") {
        if (result.ok) {
          expect(result.value).toEqual({
            digest: attempted.digest,
            parentDigest: attempted.parentDigest,
            bindingDigest: attempted.bindingDigest,
            semanticReviewDigest: attempted.semanticReviewDigest,
          });
        } else {
          expectIssue(result, "execution.io", "");
        }
      } else {
        expectIssue(result, "execution.io", "");
      }

      expect(await readExecutionPointer(root)).toEqual({
        schemaVersion: 1,
        kind: "execution-publication-pointer-v1",
        publicationDigest: prior.digest,
      });
      if (await pathExists(executionReleaseRoot(root, attempted.digest))) {
        expect(await snapshotTree(executionReleaseRoot(root, attempted.digest))).toEqual({
          "execution-bindings-v1.json": input.bindingBytes,
          "execution-manifest-v1.json": attempted.manifestBytes,
          ...attempted.memberBytes,
        });
      }
    }

    for (const [index, faultPoint] of pointerFaultPoints.entries()) {
      expectOk(
        await transaction.commitExecutionPublicationSelectionV1(root, prior.digest, () => ({
          ok: true,
          value: true,
        })),
      );
      const input = makePublicationInput(root, CURRENT_PARENT_DIGEST, `pointer-fault-${index}`);
      const attemptedCandidate = expectOk(await api.prepareExecutionPublicationCandidateV1(input));
      const attempted = expectedPublication(input);
      expect(attemptedCandidate.digest).toBe(attempted.digest);
      const result = await conformance.runWithExecutionPublicationConformanceV1(
        {
          atFaultPoint(point) {
            if (point === faultPoint) {
              throw new Error(`injected ${faultPoint}`);
            }
          },
          atReconciliationObservation() {},
        },
        () =>
          transaction.commitExecutionPublicationSelectionV1(root, attempted.digest, () => ({
            ok: true,
            value: true,
          })),
      );

      const inspection = expectOk(await api.inspectExecutionPublicationV1(root));
      expect([...inspection.releases]).toEqual([...inspection.releases].sort());
      expect(await snapshotTree(executionReleaseRoot(root, attempted.digest))).toEqual({
        "execution-bindings-v1.json": input.bindingBytes,
        "execution-manifest-v1.json": attempted.manifestBytes,
        ...attempted.memberBytes,
      });

      if (
        faultPoint === "before-pointer-write" ||
        faultPoint === "after-pointer-file-sync" ||
        faultPoint === "before-pointer-rename"
      ) {
        expectIssue(result, "execution.io", "");
        expect(inspection.selectedDigest).toBe(prior.digest);
      } else {
        if (result.ok) {
          expect(inspection.selectedDigest).toBe(attempted.digest);
        } else {
          expectIssue(result, "execution.io", "");
          expect(inspection.selectedDigest).toBe(prior.digest);
        }
      }
    }
  });

  it("fails closed when reconciliation cannot classify the durable state", async () => {
    const api = await publicApi();
    const conformance = await conformanceApi();
    const transaction = await transactionApi();
    const root = await repository();
    const { candidate: prior } = await prepareAccepted(api, root, CURRENT_PARENT_DIGEST, "stable");
    expectOk(
      await transaction.commitExecutionPublicationSelectionV1(root, prior.digest, () => ({
        ok: true,
        value: true,
      })),
    );
    const priorBytes = await snapshotTree(executionReleaseRoot(root, prior.digest));
    const input = makePublicationInput(root, CURRENT_PARENT_DIGEST, "ambiguous");
    const attempted = expectOk(await api.prepareExecutionPublicationCandidateV1(input));
    const attemptedExpected = expectedPublication(input);
    let reconciliationObserved = false;

    const result = await conformance.runWithExecutionPublicationConformanceV1(
      {
        atFaultPoint(point) {
          if (point === "after-pointer-rename" || point === "during-reconciliation") {
            throw new Error(`injected ${point}`);
          }
        },
        atReconciliationObservation() {
          reconciliationObserved = true;
        },
      },
      () =>
        transaction.commitExecutionPublicationSelectionV1(root, attempted.digest, () => ({
          ok: true,
          value: true,
        })),
    );
    expectIssue(result, "execution.reconciliation", "");
    expect(reconciliationObserved).toBe(true);
    const inspection = expectOk(await api.inspectExecutionPublicationV1(root));
    expect([prior.digest, attempted.digest]).toContain(inspection.selectedDigest);
    expect(await readExecutionPointer(root)).toEqual({
      schemaVersion: 1,
      kind: "execution-publication-pointer-v1",
      publicationDigest: inspection.selectedDigest,
    });
    expect(await snapshotTree(executionReleaseRoot(root, prior.digest))).toEqual(priorBytes);
    expect(await snapshotTree(executionReleaseRoot(root, attempted.digest))).toEqual({
      "execution-bindings-v1.json": input.bindingBytes,
      "execution-manifest-v1.json": attemptedExpected.manifestBytes,
      ...attemptedExpected.memberBytes,
    });
  });

  it("resolves both historical parent shapes and their child without rewriting either release", async () => {
    const api = await publicApi();
    const root = await repository();
    const parentBefore = await snapshotParentPublications(root);

    for (const [index, parentDigest] of [
      HISTORICAL_PARENT_DIGEST,
      CURRENT_PARENT_DIGEST,
    ].entries()) {
      expectOk(
        await api.resolvePublishedSnapshotByDigest({
          repositoryRoot: root,
          publicationDigest: parentDigest,
        }),
      );
      const { candidate } = await prepareAccepted(api, root, parentDigest, `historical-${index}`);
      const childBefore = await snapshotTree(executionReleaseRoot(root, candidate.digest));
      await resolvedComposite(api, root, parentDigest, candidate.digest);
      expect(await snapshotTree(executionReleaseRoot(root, candidate.digest))).toEqual(childBefore);
    }
    expect(await snapshotParentPublications(root)).toEqual(parentBefore);
  });

  it("revalidates old to new to old and invokes freshness immediately before pointer rename", async () => {
    const api = await publicApi();
    const conformance = await conformanceApi();
    const transaction = await transactionApi();
    const root = await repository();
    const first = await prepareAccepted(api, root, CURRENT_PARENT_DIGEST, "first");
    const second = await prepareAccepted(api, root, CURRENT_PARENT_DIGEST, "second");
    const firstBytes = await snapshotTree(executionReleaseRoot(root, first.candidate.digest));
    const firstProjection = (
      await resolvedComposite(api, root, CURRENT_PARENT_DIGEST, first.candidate.digest)
    ).projection;

    for (const digest of [
      first.candidate.digest,
      second.candidate.digest,
      first.candidate.digest,
    ]) {
      let freshnessChecked = false;
      await conformance.runWithExecutionPublicationConformanceV1(
        {
          atFaultPoint(point) {
            if (point === "before-pointer-rename") {
              expect(freshnessChecked).toBe(true);
            }
          },
          atReconciliationObservation() {},
        },
        async () => {
          expectOk(
            await transaction.commitExecutionPublicationSelectionV1(root, digest, () => {
              freshnessChecked = true;
              return { ok: true, value: true };
            }),
          );
        },
      );
      expect(freshnessChecked).toBe(true);
      expect(expectOk(await api.inspectExecutionPublicationV1(root)).selectedDigest).toBe(digest);
    }

    expect(await snapshotTree(executionReleaseRoot(root, first.candidate.digest))).toEqual(
      firstBytes,
    );
    expect(
      (await resolvedComposite(api, root, CURRENT_PARENT_DIGEST, first.candidate.digest))
        .projection,
    ).toEqual(firstProjection);

    const pointerBefore = await readExecutionPointer(root);
    expectIssue(
      await transaction.commitExecutionPublicationSelectionV1(
        root,
        second.candidate.digest,
        () => ({
          ok: false,
          issues: [
            {
              code: "execution.stale-authority",
              path: "/parentDigest",
              message: "parent changed before pointer commit",
            },
          ],
        }),
      ),
      "execution.stale-authority",
      "/parentDigest",
    );
    expect(await readExecutionPointer(root)).toEqual(pointerBefore);
  });
});

describe("publication ownership boundaries", () => {
  async function productionSources(root: string, current = root): Promise<string[]> {
    const entries = await readdir(current, { withFileTypes: true });
    const paths: string[] = [];
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "test-fixtures") {
          paths.push(...(await productionSources(root, path)));
        }
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        paths.push(relative(root, path));
      }
    }
    return paths.sort();
  }

  it("validates the complete tree and confines every execution authority literal to an owner", async () => {
    const conformance = await conformanceApi();
    const sourceRoot = resolve(import.meta.dirname);
    const expectedOwners = [
      "execution-publication-conformance-v1.ts",
      "execution-publication-model.ts",
      "execution-publication-pointer.ts",
      "execution-publication-resolver.ts",
      "execution-publication-transaction.ts",
    ].sort();
    const paths = await productionSources(sourceRoot);
    expect(paths.length).toBeLessThanOrEqual(512);
    expect(expectedOwners.every((owner) => paths.includes(owner))).toBe(true);
    const files = await Promise.all(
      paths.map(async (path) => ({
        path,
        source: await readFile(join(sourceRoot, path), "utf8"),
      })),
    );
    expectOk(conformance.validateExecutionPublicationModuleBoundaryV1(files));

    const authoritySources = [
      'const value = "readiness/execution-publications";',
      'const value = "current-execution-publication.json";',
      'const value = "execution-manifest-v1.json";',
      'const value = "execution-bindings-v1.json";',
      'const value = "execution-parent-v1.json";',
      'const value = "execution-semantic-review-v1.json";',
      'const value = "execution-publication-v1";',
      "const EXECUTION_PUBLICATIONS_ROOT = 1;",
      "const CURRENT_EXECUTION_PUBLICATION_FILENAME = 1;",
      "const EXECUTION_MANIFEST_V1_FILENAME = 1;",
      "const EXECUTION_BINDINGS_V1_FILENAME = 1;",
      "const EXECUTION_PARENT_V1_FILENAME = 1;",
      "const EXECUTION_SEMANTIC_REVIEW_V1_FILENAME = 1;",
      "const EXECUTION_PUBLICATION_V1_KIND = 1;",
    ] as const;
    const allAuthoritySources = authoritySources.join("\n");

    for (const owner of expectedOwners) {
      expectOk(
        conformance.validateExecutionPublicationModuleBoundaryV1([
          { path: owner, source: allAuthoritySources },
        ]),
      );
    }
    for (const source of authoritySources) {
      const result = conformance.validateExecutionPublicationModuleBoundaryV1([
        { path: "unrelated-module.ts", source },
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0].code.trim().length).toBeGreaterThan(0);
        expect(result.issues[0].path.trim().length).toBeGreaterThan(0);
        expect(result.issues[0].message.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the historical owner set intact and prevents execution owners from claiming it", async () => {
    const sourceRoot = resolve(import.meta.dirname);
    const executionOwners = new Set([
      "execution-publication-conformance-v1.ts",
      "execution-publication-model.ts",
      "execution-publication-pointer.ts",
      "execution-publication-resolver.ts",
      "execution-publication-transaction.ts",
    ]);
    const expectedOwners = [
      "binding-publication.ts",
      "compatible-publication-model.ts",
      "publication-conformance-v1.ts",
      "publication-filesystem.ts",
      "publication-model.ts",
      "publication-pointer.ts",
      "publication-resolver.ts",
      "publication-review.ts",
    ].sort();
    const historicalPattern =
      /(['"])(?:readiness\/publications|current-publication\.json|compiler-readiness-v1\.json|bindings-v1\.json|rule-models-v1(?:-review)?\.json|semantic-review-v1\.json|manifest\.json|publication-v1)\1/;
    const sources = await productionSources(sourceRoot);
    const sourceNames = new Set(sources.map((path) => basename(path)));
    expect(expectedOwners.every((owner) => sourceNames.has(owner))).toBe(true);

    const crossingOwners: string[] = [];
    for (const path of sources) {
      if (!executionOwners.has(basename(path))) {
        continue;
      }
      const source = await readFile(join(sourceRoot, path), "utf8");
      if (historicalPattern.test(source)) {
        crossingOwners.push(basename(path));
      }
    }
    expect(crossingOwners).toEqual([]);
  });

  it("keeps selection and raw pointer editing out of the readiness public entry", async () => {
    const api = (await import("@blend65/readiness")) as PublicReadinessApi;
    expect(api.selectExecutionPublicationByDigestV1).toBeUndefined();
    expect(api.editExecutionPublicationPointerV1).toBeUndefined();
  });
});
