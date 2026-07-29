import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  prepareIncrementalBindingPublication,
  prepareIncrementalBindingPublicationReview,
  publishIncrementalBindingPublication,
} from "./binding-publication.js";
import type { PreparedIncrementalBindingPublication } from "./compatible-publication-model.js";
import {
  createPublishedOracleContext,
  createPublishedOracleRequest,
  evaluatePublishedOracle,
} from "./published-oracle-context.js";
import { runWithPublicationConformance } from "./publication-conformance-v1.js";
import { getPublishedMetadata, resolvePublishedSnapshotByDigest } from "./publication-resolver.js";
import {
  createAcceptedReviewBytes,
  createOraclePublicationSpecFixture,
} from "./test-fixtures/oracle-publication-spec-fixture.js";
import { PUBLISHED_ORACLE_REQUEST_INTENT } from "./test-fixtures/published-evidence-spec-fixture.js";

const TARGET_HANDLER_IDS = Object.freeze([
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
]);
const SECOND_RULE_ID = "rule.ch02.2-primitive-types.boolean.range.true";
const RUNTIME_RULE_ID = "rule.ch12.3-1-memory-access.peek-addr.signature.word";

function requireSuccess<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] },
): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError("expected compatible publication success");
  return result.value;
}

describe("incremental binding publication capabilities", () => {
  it("returns defensive review bytes and commits only one genuine staged capability", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const baseSnapshot = requireSuccess(
        await resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: fixture.publicationDigest,
        }),
      );
      const firstReview = requireSuccess(
        await prepareIncrementalBindingPublicationReview({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
        }),
      );
      firstReview.requestBytes[0] = 0;
      const secondReview = requireSuccess(
        await prepareIncrementalBindingPublicationReview({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
        }),
      );
      expect(secondReview.requestBytes[0]).not.toBe(0);

      const preview = requireSuccess(
        await prepareIncrementalBindingPublication({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
          semanticReviewBytes: createAcceptedReviewBytes(secondReview.request),
        }),
      );
      expect(
        await publishIncrementalBindingPublication({} as PreparedIncrementalBindingPublication),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "publication.capability.invalid" }],
      });

      const concurrent = await Promise.all([
        publishIncrementalBindingPublication(preview.prepared),
        publishIncrementalBindingPublication(preview.prepared),
      ]);
      expect(concurrent.filter(({ ok }) => ok)).toHaveLength(1);
      expect(concurrent.filter(({ ok }) => !ok)).toEqual([
        expect.objectContaining({
          diagnostics: [expect.objectContaining({ code: "publication.capability.invalid" })],
        }),
      ]);
      const successful = concurrent.find(
        (result): result is Extract<(typeof concurrent)[number], { readonly ok: true }> =>
          result.ok,
      );
      if (successful === undefined) throw new TypeError("expected one successful publication");
      const selected = requireSuccess(successful);
      expect(selected.publicationDigest).toBe(preview.publicationDigest);
      expect(getPublishedMetadata(selected.snapshot)?.publicationDigest).toBe(
        preview.publicationDigest,
      );
      expect(await publishIncrementalBindingPublication(preview.prepared)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "publication.capability.invalid" }],
      });

      const context = requireSuccess(createPublishedOracleContext(selected.snapshot));
      for (const handlerId of ["oracle.compiler-result", "oracle.emitted-program"] as const) {
        const attempts = Array.from({ length: 16 }, (_, ordinal) =>
          createPublishedOracleRequest(context, {
            ...PUBLISHED_ORACLE_REQUEST_INTENT,
            handlerId,
            ordinal,
            configuration: {
              ...PUBLISHED_ORACLE_REQUEST_INTENT.configuration,
              enabledRuleIds: [SECOND_RULE_ID, PUBLISHED_ORACLE_REQUEST_INTENT.ruleId],
            },
          }),
        );
        const successes = attempts.filter(
          (attempt): attempt is Extract<typeof attempt, { readonly ok: true }> => attempt.ok,
        );
        expect(successes.length).toBeGreaterThan(0);
        expect(successes.length).toBeLessThan(attempts.length);
        for (const attempt of successes) {
          expect(attempt.value.case.primaryRuleId).toBe(PUBLISHED_ORACLE_REQUEST_INTENT.ruleId);
          const evaluated = evaluatePublishedOracle(context, attempt.value);
          if (!evaluated.ok) {
            throw new TypeError(JSON.stringify(evaluated.diagnostics));
          }
          expect(evaluated).toMatchObject({
            ok: true,
            result: {
              ok: true,
              outcome: "oracle-unmodeled",
              reason: "route-unavailable",
            },
          });
        }
        for (const attempt of attempts.filter(({ ok }) => !ok)) {
          expect(attempt).toMatchObject({
            diagnostics: [{ code: "oracle.contract.invalid", path: "/intent/ordinal" }],
          });
        }

        const runtimeAttempts = Array.from({ length: 16 }, (_, ordinal) =>
          createPublishedOracleRequest(context, {
            ...PUBLISHED_ORACLE_REQUEST_INTENT,
            handlerId,
            ruleId: RUNTIME_RULE_ID,
            ordinal,
            configuration: {
              ...PUBLISHED_ORACLE_REQUEST_INTENT.configuration,
              enabledRuleIds: [RUNTIME_RULE_ID],
              spellings: ["literal"],
            },
          }),
        );
        const runtimeSuccesses = runtimeAttempts.filter(
          (attempt): attempt is Extract<typeof attempt, { readonly ok: true }> => attempt.ok,
        );
        expect(runtimeSuccesses.length).toBeGreaterThan(0);
        for (const attempt of runtimeSuccesses) {
          expect(attempt.value).toMatchObject({
            ruleId: RUNTIME_RULE_ID,
            sourceProvenance: {
              campaign: { generator: { handlerId: "generator.runtime-cases" } },
            },
            case: { primaryRuleId: RUNTIME_RULE_ID },
          });
          expect(evaluatePublishedOracle(context, attempt.value)).toMatchObject({
            ok: true,
            result: {
              ok: true,
              outcome: "oracle-unmodeled",
              reason: "route-unavailable",
            },
          });
        }
      }
    } finally {
      await fixture.cleanup();
    }
  });

  it("serializes competing capabilities derived from the same selected base", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const baseSnapshot = requireSuccess(
        await resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: fixture.publicationDigest,
        }),
      );
      const review = requireSuccess(
        await prepareIncrementalBindingPublicationReview({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
        }),
      );
      const semanticReviewBytes = createAcceptedReviewBytes(review.request);
      const [first, second] = await Promise.all([
        prepareIncrementalBindingPublication({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
          semanticReviewBytes,
        }),
        prepareIncrementalBindingPublication({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
          semanticReviewBytes,
        }),
      ]);
      const firstPreview = requireSuccess(first);
      const secondPreview = requireSuccess(second);
      const competing = await Promise.all([
        publishIncrementalBindingPublication(firstPreview.prepared),
        publishIncrementalBindingPublication(secondPreview.prepared),
      ]);
      expect(competing.filter(({ ok }) => ok)).toHaveLength(1);
      expect(competing.filter(({ ok }) => !ok)).toEqual([
        expect.objectContaining({
          kind: "contended",
          diagnostics: [expect.objectContaining({ code: "publication.lock.contended" })],
        }),
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("binds accepted incremental review to current publication implementation content", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const baseSnapshot = requireSuccess(
        await resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: fixture.publicationDigest,
        }),
      );
      const review = requireSuccess(
        await prepareIncrementalBindingPublicationReview({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
        }),
      );
      const sourcePath = join(
        fixture.repositoryRoot,
        "packages/readiness/src/compatible-publication-model.ts",
      );
      await writeFile(sourcePath, new Uint8Array([...(await readFile(sourcePath)), 0x0a]));
      expect(
        await prepareIncrementalBindingPublication({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
          semanticReviewBytes: createAcceptedReviewBytes(review.request),
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "publication.review.stale" }],
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it.each([
    "packages/readiness/package.json",
    "packages/readiness/src/index.ts",
    "packages/readiness/src/published-oracle.ts",
  ])("binds compatible publication review to %s", async (authorityPath) => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const baseSnapshot = requireSuccess(
        await resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: fixture.publicationDigest,
        }),
      );
      const review = requireSuccess(
        await prepareIncrementalBindingPublicationReview({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
        }),
      );
      const sourcePath = join(fixture.repositoryRoot, authorityPath);
      await writeFile(sourcePath, new Uint8Array([...(await readFile(sourcePath)), 0x0a]));

      expect(
        await prepareIncrementalBindingPublication({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
          semanticReviewBytes: createAcceptedReviewBytes(review.request),
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "publication.review.stale" }],
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("classifies named release inputs and keeps legacy resolution independent of oracle authority", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      expect(
        await resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: "invalid" as never,
        }),
      ).toMatchObject({
        ok: false,
        kind: "invalid",
        diagnostics: [{ path: "/publicationDigest" }],
      });
      expect(
        await resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: `sha256:${"f".repeat(64)}`,
        }),
      ).toMatchObject({
        ok: false,
        kind: "not-found",
        diagnostics: [{ code: "publication.release.not-found", path: "/publicationDigest" }],
      });
      await Promise.all([
        rm(join(fixture.repositoryRoot, "readiness/oracles/diagnostic-oracle-v1.json")),
        rm(join(fixture.repositoryRoot, "readiness/oracles/binding-rejections-v1.json")),
        rm(join(fixture.repositoryRoot, "packages/readiness/src/case-generator.ts")),
      ]);
      expect(
        await resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: fixture.publicationDigest,
        }),
      ).toMatchObject({ ok: true });
    } finally {
      await fixture.cleanup();
    }
  });

  it("retains exact authority bytes across a same-size post-read mutation", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const baseSnapshot = requireSuccess(
        await resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: fixture.publicationDigest,
        }),
      );
      const review = requireSuccess(
        await prepareIncrementalBindingPublicationReview({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
        }),
      );
      const preview = requireSuccess(
        await prepareIncrementalBindingPublication({
          repositoryRoot: fixture.repositoryRoot,
          baseSnapshot,
          targetHandlerIds: TARGET_HANDLER_IDS,
          semanticReviewBytes: createAcceptedReviewBytes(review.request),
        }),
      );
      const diagnosticPath = join(
        fixture.repositoryRoot,
        "readiness/oracles/diagnostic-oracle-v1.json",
      );
      let changed = false;
      const authorityReads = new Map<string, number>();
      const resolved = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point, { path }) {
            if (point !== "after-file-read") return;
            if (
              path.startsWith(join(fixture.repositoryRoot, "packages/readiness/src/")) ||
              path.startsWith(join(fixture.repositoryRoot, "readiness/oracles/")) ||
              path === join(fixture.repositoryRoot, "readiness/rule-models/rule-model-seed-v1.json")
            ) {
              authorityReads.set(path, (authorityReads.get(path) ?? 0) + 1);
            }
            if (changed || path !== diagnosticPath) return;
            changed = true;
            const bytes = await readFile(path);
            bytes[0] = bytes[0] === 0x7b ? 0x5b : 0x7b;
            await writeFile(path, bytes);
          },
        },
        () =>
          resolvePublishedSnapshotByDigest({
            repositoryRoot: fixture.repositoryRoot,
            publicationDigest: preview.publicationDigest,
          }),
      );
      expect(changed).toBe(true);
      expect(authorityReads.size).toBeGreaterThan(0);
      expect(Math.max(...authorityReads.values())).toBe(1);
      const snapshot = requireSuccess(resolved);
      expect(createPublishedOracleContext(snapshot)).toMatchObject({ ok: true });
    } finally {
      await fixture.cleanup();
    }
  });
});
