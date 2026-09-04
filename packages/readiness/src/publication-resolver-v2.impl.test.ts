import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderPublicationJson } from "./publication-model.js";
import {
  getPublishedMetadata,
  getPublishedSnapshotAuthority,
  resolvePublishedSnapshot,
} from "./publication-resolver.js";
import {
  CURRENT_PARENT_DIGEST,
  createIsolatedRepository,
  removeIsolatedRepository,
} from "./test-fixtures/execution-publication-spec-fixture.js";

describe("selected version-two parent resolution", () => {
  it("dispatches the exact pointer kind and returns only defensive snapshot authority", async () => {
    const repositoryRoot = await createIsolatedRepository();
    try {
      const selected = await resolvePublishedSnapshot({ repositoryRoot });
      expect(selected.ok).toBe(true);
      if (!selected.ok) throw new TypeError("selected version-two parent was unavailable");
      expect(getPublishedMetadata(selected.value)?.publicationDigest).toBe(CURRENT_PARENT_DIGEST);

      const first = getPublishedSnapshotAuthority(selected.value);
      const member = first?.memberBytes.get("rule-models-v2.json");
      expect(member).toBeDefined();
      if (first === undefined || member === undefined) {
        throw new TypeError("selected authority was unavailable");
      }
      member.fill(0);
      const mutableMemberBytes: unknown = first.memberBytes;
      if (!(mutableMemberBytes instanceof Map)) {
        throw new TypeError("defensive authority map was unavailable");
      }
      mutableMemberBytes.delete("rule-models-v2.json");
      const second = getPublishedSnapshotAuthority(selected.value);
      expect(second?.memberBytes.get("rule-models-v2.json")).not.toEqual(member);
      expect(second?.memberBytes.has("rule-models-v2.json")).toBe(true);

      await writeFile(
        join(repositoryRoot, "readiness/publications/current-publication.json"),
        renderPublicationJson({
          schemaVersion: 2,
          kind: "publication-pointer-v1",
          publicationDigest: CURRENT_PARENT_DIGEST,
        }),
      );
      expect(await resolvePublishedSnapshot({ repositoryRoot })).toMatchObject({ ok: false });
    } finally {
      await removeIsolatedRepository(repositoryRoot);
    }
  });
});
