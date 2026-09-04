import { describe, expect, it } from "vitest";

import { validatePublishedBindings } from "./binding-validator.js";
import {
  resolveCompositeReadinessSnapshot,
  resolvePublishedExecutionRelease,
} from "./execution-publication-resolver.js";
import { prepareExecutionPublicationCandidateV1 } from "./execution-publication-transaction.js";
import { getOptimizerConsumerProjectionV2 } from "./optimizer-consumer-contract.js";
import { parsePublicationJson, renderPublicationJson } from "./publication-model.js";
import {
  createResolvedPublishedSnapshot,
  getPublishedSnapshotAuthority,
  resolvePublishedSnapshot,
} from "./publication-resolver.js";
import {
  createIsolatedRepository,
  makePublicationInput,
  removeIsolatedRepository,
} from "./test-fixtures/execution-publication-spec-fixture.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError("expected a record");
  return value;
}

describe("optimizer consumer authenticated joins", () => {
  it("rejects a closed-shape exemplar substitution inside an otherwise genuine pair", async () => {
    const repositoryRoot = await createIsolatedRepository();
    try {
      const parent = await resolvePublishedSnapshot({ repositoryRoot });
      if (!parent.ok) throw new TypeError("selected parent was unavailable");
      const authority = getPublishedSnapshotAuthority(parent.value);
      const exemplarBytes = authority?.memberBytes.get("structured-execution-exemplar-v2.json");
      const inventoryBytes = authority?.memberBytes.get("compiler-readiness-v1.json");
      if (authority === undefined || exemplarBytes === undefined || inventoryBytes === undefined) {
        throw new TypeError("selected parent authority was unavailable");
      }
      const parsed = parsePublicationJson(exemplarBytes);
      if (!parsed.ok) throw new TypeError("published exemplar was unavailable");
      const hostileExemplar = record(structuredClone(parsed.value));
      record(hostileExemplar.source).extra = true;
      const hostileMembers = new Map(authority.memberBytes);
      hostileMembers.set(
        "structured-execution-exemplar-v2.json",
        renderPublicationJson(hostileExemplar),
      );
      const bindings = validatePublishedBindings(
        authority.inventory.handlerDeclarations,
        authority.candidates.map(({ binding }) => binding),
      );
      if (!bindings.ok) throw new TypeError("parent bindings were unavailable");
      const hostileParent = createResolvedPublishedSnapshot({
        ...authority,
        inventoryGenerationDigest: authority.publicationDigest,
        bindings: bindings.bindings,
        memberBytes: hostileMembers,
      });

      const childCandidate = await prepareExecutionPublicationCandidateV1(
        makePublicationInput(repositoryRoot, authority.publicationDigest, "hostile-exemplar"),
      );
      if (!childCandidate.ok) throw new TypeError("execution child was unavailable");
      const child = await resolvePublishedExecutionRelease(
        repositoryRoot,
        childCandidate.value.digest,
      );
      if (!child.ok) throw new TypeError("execution child could not be resolved");
      const composite = resolveCompositeReadinessSnapshot(hostileParent, child.value);
      if (!composite.ok) throw new TypeError("parent-child pair was unavailable");
      expect(getOptimizerConsumerProjectionV2(composite.value)).toMatchObject({
        ok: false,
        issues: [{ code: "execution.identity" }],
      });
    } finally {
      await removeIsolatedRepository(repositoryRoot);
    }
  });
});
