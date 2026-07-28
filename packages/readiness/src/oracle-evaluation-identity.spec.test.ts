import { beforeAll, describe, expect, it } from "vitest";

import {
  deriveOracleSourceContentIdentity,
  deriveOracleTransformedContentIdentity,
} from "./oracle-content-identity.js";
import { createOracleEvaluationCollisionRegistry } from "./oracle-evaluation-collision.js";
import {
  deriveOracleEvaluationIdentity,
  deriveOracleInitialMemoryIdentity,
  validateOracleReplayProvenance,
} from "./oracle-evaluation-identity.js";
import {
  createOracleReplayIdentityFixture,
  evaluationIdentityMutations,
  oracleIdentityVectors,
} from "./test-fixtures/oracle-evaluation-identity-canonical-vectors.js";

type IdentityResult = ReturnType<typeof deriveOracleEvaluationIdentity>;
type ReplayFixture = Awaited<ReturnType<typeof createOracleReplayIdentityFixture>>;

let replay: ReplayFixture;

function requireIdentity(result: IdentityResult) {
  expect(result).toMatchObject({ ok: true, diagnostics: [] });
  if (!result.ok) throw new TypeError("expected canonical identity");
  return result;
}

beforeAll(async () => {
  replay = await createOracleReplayIdentityFixture();
});

describe("oracle evaluation provenance and canonical identity", () => {
  it("rejects changed source content under an otherwise complete replay identity", () => {
    const valid = validateOracleReplayProvenance({
      envelopeBytes: replay.envelopeBytes,
      registry: replay.registry,
      expectedProvenance: replay.sourceProvenance,
      expectedSourceContent: replay.sourceContent,
    });
    expect(valid).toEqual({
      ok: true,
      value: replay.sourceProvenance,
      diagnostics: [],
    });

    const mismatch = validateOracleReplayProvenance({
      envelopeBytes: replay.envelopeBytes,
      registry: replay.registry,
      expectedProvenance: replay.sourceProvenance,
      expectedSourceContent: replay.changedSource,
    });
    expect(mismatch).toMatchObject({ ok: false });
    expect(mismatch).not.toHaveProperty("value");
  });

  it("matches role-separated source and transformed content vectors without inventing replay identity", () => {
    const source = requireIdentity(
      deriveOracleSourceContentIdentity(oracleIdentityVectors.source.input),
    );
    const transformed = requireIdentity(
      deriveOracleTransformedContentIdentity(oracleIdentityVectors.transformed.input),
    );

    expect(source).toEqual({
      ok: true,
      identity: oracleIdentityVectors.source.identity,
      preimage: oracleIdentityVectors.source.preimage,
      diagnostics: [],
    });
    expect(transformed).toEqual({
      ok: true,
      identity: oracleIdentityVectors.transformed.identity,
      preimage: oracleIdentityVectors.transformed.preimage,
      diagnostics: [],
    });

    const sameSourceRole = requireIdentity(
      deriveOracleSourceContentIdentity(oracleIdentityVectors.source.input),
    );
    const sameTransformedRole = requireIdentity(
      deriveOracleTransformedContentIdentity(oracleIdentityVectors.source.input),
    );
    expect(sameTransformedRole.identity).not.toBe(sameSourceRole.identity);
    expect(sameTransformedRole).not.toHaveProperty("caseIdentity");
    expect(sameTransformedRole).not.toHaveProperty("sourceProvenance");
  });

  it("matches the published initial-memory and complete evaluation identity vectors exactly", () => {
    const memory = requireIdentity(
      deriveOracleInitialMemoryIdentity(oracleIdentityVectors.memory.input),
    );
    const evaluation = requireIdentity(
      deriveOracleEvaluationIdentity(oracleIdentityVectors.evaluation.input),
    );

    expect(memory).toEqual({
      ok: true,
      identity: oracleIdentityVectors.memory.identity,
      preimage: oracleIdentityVectors.memory.preimage,
      diagnostics: [],
    });
    expect(evaluation).toEqual({
      ok: true,
      identity: oracleIdentityVectors.evaluation.identity,
      preimage: oracleIdentityVectors.evaluation.preimage,
      diagnostics: [],
    });
  });

  it.each(evaluationIdentityMutations)(
    "changes evaluation identity when $name changes",
    ({ mutate }) => {
      const baseline = requireIdentity(
        deriveOracleEvaluationIdentity(oracleIdentityVectors.evaluation.input),
      );
      const changed = requireIdentity(
        deriveOracleEvaluationIdentity(mutate(oracleIdentityVectors.evaluation.input)),
      );

      expect(changed.identity).not.toBe(baseline.identity);
      expect(changed.preimage).not.toEqual(baseline.preimage);
    },
  );

  it("keeps replay case identity unchanged while an oracle policy revision changes evaluation identity", () => {
    const original = oracleIdentityVectors.evaluation.input;
    const revised = { ...original, policyRevision: "oracle-policy-v2" as const };
    const baseline = requireIdentity(deriveOracleEvaluationIdentity(original));
    const changed = requireIdentity(deriveOracleEvaluationIdentity(revised));

    expect(revised.sourceProvenance.caseIdentity).toEqual(original.sourceProvenance.caseIdentity);
    expect(revised.sourceProvenance.campaignDigest).toBe(original.sourceProvenance.campaignDigest);
    expect(changed.identity).not.toBe(baseline.identity);
  });

  it("rejects an injected equal digest for unequal canonical preimages", () => {
    const registry = createOracleEvaluationCollisionRegistry(() => new Uint8Array(32).fill(0x5a));
    const first = deriveOracleSourceContentIdentity(new TextEncoder().encode("first"), registry);
    const collision = deriveOracleSourceContentIdentity(
      new TextEncoder().encode("second"),
      registry,
    );
    const noLongerAuthoritative = deriveOracleSourceContentIdentity(
      new TextEncoder().encode("first"),
      registry,
    );

    expect(first).toMatchObject({ ok: true });
    expect(collision).toMatchObject({ ok: false });
    expect(noLongerAuthoritative).toMatchObject({ ok: false });
    registry.dispose();
  });
});
