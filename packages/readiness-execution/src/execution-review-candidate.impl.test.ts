import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import {
  resolveCompositeReadinessSnapshot,
  resolvePublishedSnapshotByDigest,
  type ExecutionPolicyV1,
} from "@blend65/readiness";
import { createPublishedOracleContext } from "@blend65/readiness/published-oracle";
import { describe, expect, it } from "vitest";

import { executeReadinessCampaign } from "./execution-orchestration.js";
import {
  getExecutionCatalogFixtureDescriptorV1,
  runWithExecutionCatalogConformanceV1,
} from "./execution-publication-catalog-conformance-v1.js";
import {
  resolveExecutionReviewContextV1,
  selectExecutionPublicationByDigestV1,
} from "./execution-publication-catalog.js";
import { createExecutionPublicationCatalogFixtureV1 } from "./test-fixtures/execution-publication-catalog-spec-fixture.js";
import { createGenuineExecutionCampaigns } from "./test-fixtures/genuine-execution-campaign.js";

const POLICY: ExecutionPolicyV1 = Object.freeze({
  revision: "execution-policy-v1",
  budget: Object.freeze({
    operationMs: 1_000,
    launchAttemptMs: 1_000,
    routeMs: 10_000,
    cleanupGraceMs: 3_000,
    outputBytes: 64,
    evidenceBytes: 16_777_216,
    instructions: 100,
    cycles: 1_000,
    launchAttempts: 2,
  }),
});

function candidateDigest(
  parentDigest: string,
  bindingBytes: Uint8Array,
  runnerRevision: string,
): string {
  const encoder = new TextEncoder();
  const bindingDigest = `sha256:${createHash("sha256").update(bindingBytes).digest("hex")}`;
  return `sha256:${createHash("sha256")
    .update(encoder.encode("blend65-execution-review-candidate-v1\0"))
    .update(encoder.encode(parentDigest))
    .update(new Uint8Array([0]))
    .update(encoder.encode(bindingDigest))
    .update(new Uint8Array([0]))
    .update(encoder.encode(runnerRevision))
    .digest("hex")}`;
}

describe("prepublication execution review authority", () => {
  it("executes exact current bindings without selecting or minting a published child", async () => {
    const fixture = await createExecutionPublicationCatalogFixtureV1();
    const pointerPath = join(
      fixture.repositoryRoot,
      "readiness",
      "execution-publications",
      "current-execution-publication.json",
    );
    try {
      const parent = await resolvePublishedSnapshotByDigest({
        repositoryRoot: fixture.repositoryRoot,
        publicationDigest: fixture.parentDigest,
      });
      if (!parent.ok) throw new TypeError(JSON.stringify(parent.diagnostics));
      const oracle = createPublishedOracleContext(parent.value);
      if (!oracle.ok) throw new TypeError(JSON.stringify(oracle.diagnostics));
      await rm(pointerPath, { force: true });

      const catalog = getExecutionCatalogFixtureDescriptorV1();
      const handlerPaths = new Set(catalog.rows.flatMap((row) => row.dependencyPaths));
      const runnerOnlyPath = catalog.runnerDependencyPaths.find((path) => !handlerPaths.has(path));
      expect(runnerOnlyPath).toBeDefined();
      if (runnerOnlyPath === undefined) throw new TypeError("Expected a runner-only dependency.");
      const mutatedRunner = await runWithExecutionCatalogConformanceV1(
        {
          mutateDependency: {
            capabilityId: "runner",
            path: runnerOnlyPath,
            offset: 0,
            xorByte: 1,
          },
        },
        () => resolveExecutionReviewContextV1(parent.value),
      );
      expect(mutatedRunner.ok).toBe(false);

      const candidate = resolveExecutionReviewContextV1(parent.value);
      if (!candidate.ok) throw new TypeError(JSON.stringify(candidate.issues));
      expect(resolveCompositeReadinessSnapshot(parent.value, candidate.value as never).ok).toBe(
        false,
      );
      expect(
        (
          await selectExecutionPublicationByDigestV1(
            fixture.repositoryRoot,
            candidateDigest(
              fixture.parentDigest,
              fixture.bindingBytes,
              getExecutionCatalogFixtureDescriptorV1().runnerRevision,
            ),
          )
        ).ok,
      ).toBe(false);

      const campaigns = await createGenuineExecutionCampaigns(parent.value);
      const executed = await executeReadinessCampaign({
        parent: parent.value,
        execution: candidate.value,
        oracle: oracle.value,
        campaign: campaigns.orchestration,
        target: "c64",
        policy: POLICY,
        capabilities: { acme: { available: false }, vice: { available: false } },
      });
      if (!executed.ok) throw new TypeError(JSON.stringify(executed.issues));

      expect(executed.value.executionDigest).toBe(
        candidateDigest(
          fixture.parentDigest,
          fixture.bindingBytes,
          getExecutionCatalogFixtureDescriptorV1().runnerRevision,
        ),
      );
      expect(executed.value.executionDigest).not.toBe(fixture.childDigest);
      await expect(readFile(pointerPath)).rejects.toMatchObject({ code: "ENOENT" });

      const dependencyCount = new Set(
        getExecutionCatalogFixtureDescriptorV1().rows.flatMap((row) => row.dependencyPaths),
      ).size;
      let dependencyReads = 0;
      const changedDuringExecution = await runWithExecutionCatalogConformanceV1(
        {
          atDependencyRead: () => {
            dependencyReads += 1;
            if (dependencyReads > dependencyCount) {
              throw new TypeError("dependency changed after route execution");
            }
          },
        },
        () =>
          executeReadinessCampaign({
            parent: parent.value,
            execution: candidate.value,
            oracle: oracle.value,
            campaign: campaigns.orchestration,
            target: "c64",
            policy: POLICY,
            capabilities: { acme: { available: false }, vice: { available: false } },
          }),
      );
      expect(changedDuringExecution.ok).toBe(false);
      expect(dependencyReads).toBeGreaterThan(dependencyCount);
    } finally {
      await fixture.cleanup();
    }
  }, 360_000);

  it("rejects forged review contexts", () => {
    expect(resolveExecutionReviewContextV1(Object.freeze({}) as never).ok).toBe(false);
  });
});
