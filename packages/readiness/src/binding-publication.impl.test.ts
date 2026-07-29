import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  getPublishedMetadata,
  PUBLICATION_V1_LIMITS,
  prepareBindingPublicationReview,
  publishBindingTransaction,
  resolvePublishedSnapshot,
} from "./index.js";
import { runWithPublicationConformance } from "./publication-conformance-v1.js";
import type {
  PreparedBindingPublicationReview,
  PublicationResult,
  PublishedBindingTransaction,
} from "./publication-model.js";
import { restoreUnboundPublicationAuthority } from "./test-fixtures/unbound-publication-authority.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const encoder = new TextEncoder();
const temporaryRoots: string[] = [];

function requireSuccess<T>(result: PublicationResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(
      `expected publication success: ${result.diagnostics
        .map(({ code, path }) => `${code}@${path}`)
        .join(",")}`,
    );
  }
  return result.value;
}

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-publication-impl-"));
  temporaryRoots.push(root);
  await cp(join(REPOSITORY_ROOT, "readiness"), join(root, "readiness"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "spec"), join(root, "spec"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "packages/readiness/src"), join(root, "packages/readiness/src"), {
    recursive: true,
  });
  await restoreUnboundPublicationAuthority(REPOSITORY_ROOT, root);
  return root;
}

function acceptedReviewBytes(prepared: PreparedBindingPublicationReview): Uint8Array {
  return encoder.encode(
    `${JSON.stringify({
      schemaVersion: 1,
      reviews: prepared.request.reviewUnits.map((unit) => ({
        unitId: unit.unitId,
        reviewer: "phase7-implementation-reviewer",
        specRevision: prepared.request.specRevision,
        semanticDigest: unit.semanticDigest,
        dependencyDigests: unit.dependencyDigests,
        outcome: "accepted",
        resolvedDisagreementIds: [],
      })),
    })}\n`,
  );
}

async function prepare(root: string): Promise<PreparedBindingPublicationReview> {
  return requireSuccess(
    await prepareBindingPublicationReview({
      repositoryRoot: root,
    }),
  );
}

async function publish(root: string): Promise<PublishedBindingTransaction> {
  const prepared = await prepare(root);
  return requireSuccess(
    await publishBindingTransaction({
      repositoryRoot: root,
      semanticReviewBytes: acceptedReviewBytes(prepared),
    }),
  );
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("binding publication implementation invariants", () => {
  it("rejects invalid transaction roots and malformed review envelopes before staging", async () => {
    expect(
      await publishBindingTransaction({
        repositoryRoot: ".",
        semanticReviewBytes: encoder.encode("{}\n"),
      }),
    ).toMatchObject({ ok: false, kind: "invalid" });

    const root = await fixtureRoot();
    for (const semanticReviewBytes of [
      new Uint8Array(PUBLICATION_V1_LIMITS.maxSemanticReviewBytes + 1),
      encoder.encode("{}"),
      encoder.encode('{"schemaVersion":1}\n'),
    ]) {
      expect(
        await publishBindingTransaction({
          repositoryRoot: root,
          semanticReviewBytes,
        }),
      ).toMatchObject({ ok: false, kind: "invalid" });
    }
  });

  it("preserves the legacy first-diagnostic classification and source path", async () => {
    const root = await fixtureRoot();
    const prepared = await prepare(root);
    const records = prepared.request.reviewUnits.slice(1).map((unit, index) => ({
      unitId: unit.unitId,
      reviewer: "phase7-implementation-reviewer",
      specRevision: prepared.request.specRevision,
      semanticDigest: unit.semanticDigest,
      dependencyDigests: unit.dependencyDigests,
      outcome: index === 0 ? ("blocked" as const) : ("accepted" as const),
      resolvedDisagreementIds: [],
    }));

    expect(
      await publishBindingTransaction({
        repositoryRoot: root,
        semanticReviewBytes: encoder.encode(
          `${JSON.stringify({ schemaVersion: 1, reviews: records })}\n`,
        ),
      }),
    ).toMatchObject({
      ok: false,
      kind: "invalid",
      diagnostics: [{ code: "publication.review.invalid", path: "$.reviews" }],
    });
  });

  it("returns a typed failure when generation-lock acquisition rejects a linked lock path", async () => {
    const root = await fixtureRoot();
    const lockPath = join(root, "readiness/generated/.generation-lock");
    await rm(lockPath, { recursive: true });
    await symlink(root, lockPath);
    const prepared = await prepare(root);

    await expect(
      publishBindingTransaction({
        repositoryRoot: root,
        semanticReviewBytes: acceptedReviewBytes(prepared),
      }),
    ).resolves.toMatchObject({
      ok: false,
      kind: "io",
      diagnostics: [{ code: "publication.io" }],
    });
  });

  it("serializes concurrent publishers through the generation lock", async () => {
    const root = await fixtureRoot();
    const prepared = await prepare(root);
    const semanticReviewBytes = acceptedReviewBytes(prepared);
    let releaseFirstPublisher: (() => void) | undefined;
    let firstPublisherEntered: (() => void) | undefined;
    const entered = new Promise<void>((resolveEntered) => {
      firstPublisherEntered = resolveEntered;
    });
    const release = new Promise<void>((resolveRelease) => {
      releaseFirstPublisher = resolveRelease;
    });

    const first = runWithPublicationConformance(
      {
        atFaultPoint: async (point) => {
          if (point !== "before-staged-validation") return;
          firstPublisherEntered?.();
          await release;
        },
      },
      () =>
        publishBindingTransaction({
          repositoryRoot: root,
          semanticReviewBytes,
        }),
    );
    await entered;
    const contended = await publishBindingTransaction({
      repositoryRoot: root,
      semanticReviewBytes,
    });
    expect(contended).toMatchObject({
      ok: false,
      kind: "contended",
      diagnostics: [{ code: "publication.lock.contended" }],
    });

    releaseFirstPublisher?.();
    const selected = requireSuccess(await first);
    expect(getPublishedMetadata(selected.snapshot)?.publicationDigest).toBe(
      selected.publicationDigest,
    );
  });

  it("rejects member symlinks before bytes and digest-corrupted members after bytes", async () => {
    const root = await fixtureRoot();
    const published = await publish(root);
    const memberPath = join(
      root,
      "readiness/publications/releases",
      published.publicationDigest,
      "bindings-v1.json",
    );
    const original = await readFile(memberPath);
    const outsidePath = join(root, "outside-bindings.json");
    await writeFile(outsidePath, original);
    await rm(memberPath);
    await symlink(outsidePath, memberPath);

    expect(await resolvePublishedSnapshot({ repositoryRoot: root })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "publication.path.invalid" }],
    });

    await rm(memberPath);
    await writeFile(memberPath, Buffer.concat([original, Buffer.from(" ")]));
    expect(await resolvePublishedSnapshot({ repositoryRoot: root })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "publication.digest.mismatch" }],
    });
  });

  it("keeps pre-commit fault injection unselected and post-rename injection resolvable", async () => {
    const beforeRoot = await fixtureRoot();
    const beforePrepared = await prepare(beforeRoot);
    const before = await runWithPublicationConformance(
      {
        atFaultPoint: (point) => {
          if (point === "after-staged-validation") throw new Error("simulated process stop");
        },
      },
      () =>
        publishBindingTransaction({
          repositoryRoot: beforeRoot,
          semanticReviewBytes: acceptedReviewBytes(beforePrepared),
        }),
    );
    expect(before).toMatchObject({ ok: false, kind: "io" });
    expect(await resolvePublishedSnapshot({ repositoryRoot: beforeRoot })).toMatchObject({
      ok: false,
    });

    const afterRoot = await fixtureRoot();
    const afterPrepared = await prepare(afterRoot);
    const after = await runWithPublicationConformance(
      {
        atFaultPoint: (point) => {
          if (point === "after-pointer-rename") throw new Error("simulated process stop");
        },
      },
      () =>
        publishBindingTransaction({
          repositoryRoot: afterRoot,
          semanticReviewBytes: acceptedReviewBytes(afterPrepared),
        }),
    );
    expect(after).toMatchObject({ ok: false, kind: "io" });
    const recovered = requireSuccess(
      await resolvePublishedSnapshot({
        repositoryRoot: afterRoot,
      }),
    );
    expect(getPublishedMetadata(recovered)?.publicationDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });
});
