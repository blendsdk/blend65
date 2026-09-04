import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runWithPublicationConformance } from "./publication-conformance-v1.js";
import { resolvePublishedRuleFamilyRecordByDigestV2 } from "./rule-family-publication-record.js";
import { createOraclePublicationSpecFixture } from "./test-fixtures/oracle-publication-spec-fixture.js";

describe("passive parent filesystem closure", () => {
  it("rejects a release directory replaced after a bounded member read", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    const releaseRoot = join(
      fixture.repositoryRoot,
      "readiness/publications/releases",
      fixture.publicationDigest,
    );
    let replaced = false;
    try {
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point, { path }) {
            if (replaced || point !== "after-file-read" || !path.endsWith("/manifest.json")) {
              return;
            }
            replaced = true;
            await rename(releaseRoot, `${releaseRoot}.replaced`);
            await mkdir(releaseRoot);
          },
        },
        () =>
          resolvePublishedRuleFamilyRecordByDigestV2({
            repositoryRoot: fixture.repositoryRoot,
            publicationDigest: fixture.publicationDigest,
          }),
      );
      expect(replaced).toBe(true);
      expect(result.ok).toBe(false);
    } finally {
      await fixture.cleanup();
    }
  });
});
