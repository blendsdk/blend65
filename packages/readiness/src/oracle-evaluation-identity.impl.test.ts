import { describe, expect, it } from "vitest";

import {
  deriveOracleSourceContentIdentity,
  deriveOracleTransformedContentIdentity,
} from "./oracle-content-identity.js";
import {
  deriveOracleEvaluationIdentity,
  deriveOracleInitialMemoryIdentity,
  validateOracleReplayProvenance,
  type OracleEvaluationIdentityInputV1,
} from "./oracle-evaluation-identity.js";
import {
  createOracleEvaluationCollisionRegistry,
  deriveOracleEvaluationDigest,
} from "./oracle-evaluation-collision.js";
import {
  createOracleReplayIdentityFixture,
  oracleIdentityVectors,
} from "./test-fixtures/oracle-evaluation-identity-canonical-vectors.js";

function evaluationInput(): OracleEvaluationIdentityInputV1 {
  return structuredClone(
    oracleIdentityVectors.evaluation.input,
  ) as unknown as OracleEvaluationIdentityInputV1;
}

describe("oracle identity internals", () => {
  it("keeps source and transformed roles distinct and isolates returned preimages", () => {
    const bytes = Uint8Array.of(1, 2, 3);
    const source = deriveOracleSourceContentIdentity(bytes);
    const transformed = deriveOracleTransformedContentIdentity(bytes);

    expect(source).toMatchObject({ ok: true });
    expect(transformed).toMatchObject({ ok: true });
    if (!source.ok || !transformed.ok) throw new TypeError("expected identities");
    expect(source.identity).not.toBe(transformed.identity);
    source.preimage[0] = 255;
    expect(deriveOracleSourceContentIdentity(bytes)).toMatchObject({
      ok: true,
      identity: source.identity,
    });
  });

  it("rejects invalid digest primitives and disposed registries without throwing", () => {
    const wrongLength = createOracleEvaluationCollisionRegistry(() => Uint8Array.of(1));
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1), wrongLength)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });

    const disposed = createOracleEvaluationCollisionRegistry();
    disposed.dispose();
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1), disposed)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/registry" }],
    });
  });

  it("enforces every collision registry spelling, entry, and byte boundary", () => {
    const digest = `sha256:${"a".repeat(64)}` as const;
    const registry = createOracleEvaluationCollisionRegistry();

    expect(registry.register("not-a-digest" as never, Uint8Array.of(1))).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/identity" }],
    });
    expect(registry.register(digest, new Uint8Array(new SharedArrayBuffer(1)))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/preimage" }],
    });
    expect(registry.register(digest, new Uint8Array(16_777_217))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.limit", path: "/preimage" }],
    });
    expect(
      registry.register(
        digest,
        new Proxy(Uint8Array.of(1), {
          getPrototypeOf() {
            throw new Error("hostile preimage");
          },
        }),
      ),
    ).toMatchObject({ ok: false });

    const entries = createOracleEvaluationCollisionRegistry();
    for (let index = 0; index < 4_096; index += 1) {
      const identity = `sha256:${index.toString(16).padStart(64, "0")}` as const;
      expect(entries.register(identity, new Uint8Array())).toMatchObject({ ok: true });
    }
    expect(entries.register(`sha256:${"f".repeat(64)}`, new Uint8Array())).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.limit", path: "/registry" }],
    });
  });

  it("closes collision-registry reuse, collision, and retained-byte boundaries", () => {
    const fixedDigest = () => new Uint8Array(32);
    const registry = createOracleEvaluationCollisionRegistry(fixedDigest);
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1), registry)).toMatchObject({ ok: true });
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1), registry)).toMatchObject({ ok: true });
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1, 2), registry)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.identity.collision" }],
    });
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1), registry)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.identity.collision" }],
    });

    const retained = createOracleEvaluationCollisionRegistry();
    const first = `sha256:${"1".repeat(64)}` as const;
    const second = `sha256:${"2".repeat(64)}` as const;
    const third = `sha256:${"3".repeat(64)}` as const;
    expect(retained.register(first, new Uint8Array(8_388_608))).toMatchObject({ ok: true });
    expect(retained.register(second, new Uint8Array(8_388_608))).toMatchObject({ ok: true });
    expect(retained.register(third, Uint8Array.of(1))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.limit" }],
    });
    retained.dispose();
    expect(retained.register(first, Uint8Array.of(1))).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/registry" }],
    });

    const taintedRetained = createOracleEvaluationCollisionRegistry();
    const large = new Uint8Array(8_388_608);
    expect(taintedRetained.register(first, large)).toMatchObject({ ok: true });
    expect(taintedRetained.register(first, Uint8Array.of(1))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.identity.collision" }],
    });
    expect(taintedRetained.register(second, large)).toMatchObject({ ok: true });
    expect(taintedRetained.register(third, Uint8Array.of(1))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.limit" }],
    });

    const sameLengthCollision = createOracleEvaluationCollisionRegistry(() => new Uint8Array(32));
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1, 2), sameLengthCollision)).toMatchObject({
      ok: true,
    });
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1, 3), sameLengthCollision)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.identity.collision" }],
    });
  });

  it("rejects forged collision registries and hostile digest inputs", () => {
    const forged = {
      register: () => ({ ok: true as const, value: true as const, diagnostics: [] as const }),
      dispose: () => undefined,
    };
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1), forged)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/registry" }],
    });
    const throwing = createOracleEvaluationCollisionRegistry(() => {
      throw new Error("hostile digest");
    });
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1), throwing)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/identity" }],
    });
    expect(
      deriveOracleEvaluationDigest(
        new Proxy(Uint8Array.of(1), {
          getPrototypeOf() {
            throw new Error("hostile bytes");
          },
        }),
      ),
    ).toMatchObject({ ok: false });

    const callerBytes = Uint8Array.of(7, 8, 9);
    const mutatingDigest = createOracleEvaluationCollisionRegistry((isolated) => {
      isolated.fill(0);
      return new Uint8Array(32);
    });
    expect(deriveOracleEvaluationDigest(callerBytes, mutatingDigest)).toMatchObject({ ok: true });
    expect(callerBytes).toEqual(Uint8Array.of(7, 8, 9));

    const sharedDigest = createOracleEvaluationCollisionRegistry(
      () => new Uint8Array(new SharedArrayBuffer(32)),
    );
    expect(deriveOracleEvaluationDigest(Uint8Array.of(1), sharedDigest)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/identity" }],
    });
    expect(deriveOracleEvaluationDigest(new Uint8Array(new SharedArrayBuffer(1)))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/preimage" }],
    });
    expect(deriveOracleEvaluationDigest(new Uint8Array(16_777_217))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.limit", path: "/preimage" }],
    });
    expect(deriveOracleSourceContentIdentity(new Uint8Array(16_777_001))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.limit", path: "/content" }],
    });
  });

  it("rejects malformed memory and evaluation identity dimensions independently", () => {
    expect(
      deriveOracleInitialMemoryIdentity({
        schemaVersion: 1,
        cells: [
          { address: 1n, value: 1n },
          { address: 0n, value: 1n },
        ],
      }),
    ).toMatchObject({ ok: false });
    expect(
      deriveOracleInitialMemoryIdentity(
        new Proxy(
          { schemaVersion: 1, cells: [] },
          {
            get() {
              throw new Error("hostile memory");
            },
          },
        ),
      ),
    ).toMatchObject({ ok: false });

    const valid = evaluationInput();
    const { relationId: _relationId, ...withoutRelation } = valid;
    const { transformedContentIdentity: _transformedIdentity, ...withoutTransformed } = valid;
    const invalid: readonly OracleEvaluationIdentityInputV1[] = [
      { ...valid, schemaVersion: 2 } as unknown as OracleEvaluationIdentityInputV1,
      withoutRelation,
      withoutTransformed,
      { ...valid, sourceContentIdentity: "sha256:invalid" },
      { ...valid, transformedContentIdentity: "sha256:invalid" },
      {
        ...valid,
        relationId: "relation.not-registered",
      } as unknown as OracleEvaluationIdentityInputV1,
      { ...valid, entryFunction: "not valid" },
      { ...valid, policyRevision: "oracle-policy-v0" },
      { ...valid, observableProjectionId: "not valid" },
      { ...valid, budget: { ...valid.budget, effects: -1n } },
      { ...valid, participants: [] },
      {
        ...valid,
        participants: [...valid.participants, valid.participants[0]!],
      },
      {
        ...valid,
        participants: valid.participants.map((participant, index) =>
          index === 0 ? { ...participant, contractVersion: "latest" } : participant,
        ),
      },
      {
        ...valid,
        participants: valid.participants.filter(
          ({ handlerId }) => handlerId !== "transform.semantic-relations",
        ),
      },
    ];
    for (const candidate of invalid) {
      expect(deriveOracleEvaluationIdentity(candidate)).toMatchObject({ ok: false });
    }
    let proxyGetterInvoked = false;
    expect(
      deriveOracleEvaluationIdentity(
        new Proxy(valid, {
          get() {
            proxyGetterInvoked = true;
            throw new Error("hostile identity");
          },
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(proxyGetterInvoked).toBe(false);

    let accessorInvoked = false;
    const participant = Object.defineProperty(
      {
        contractVersion: valid.participants[0]!.contractVersion,
        implementationRevision: valid.participants[0]!.implementationRevision,
      },
      "handlerId",
      {
        enumerable: true,
        get() {
          accessorInvoked = true;
          return valid.participants[0]!.handlerId;
        },
      },
    );
    expect(
      deriveOracleEvaluationIdentity({
        ...valid,
        participants: [participant as unknown as (typeof valid.participants)[number]],
      }),
    ).toMatchObject({ ok: false });
    expect(accessorInvoked).toBe(false);
  });

  it("accepts the untransformed shape and rejects closed-record and participant edges", () => {
    const transformed = evaluationInput();
    const {
      relationId: _relationId,
      transformedContentIdentity: _transformedContentIdentity,
      ...untransformed
    } = transformed;
    expect(deriveOracleEvaluationIdentity(untransformed)).toMatchObject({ ok: true });
    for (const handlerId of ["oracle.compiler-result", "oracle.emitted-program"] as const) {
      expect(
        deriveOracleEvaluationIdentity({
          ...untransformed,
          sourceProvenance: {
            ...untransformed.sourceProvenance,
            campaign: {
              ...untransformed.sourceProvenance.campaign,
              generator: {
                ...untransformed.sourceProvenance.campaign.generator,
                handlerId: "generator.runtime-cases",
              },
            },
          },
          participants: untransformed.participants.map((participant) =>
            participant.handlerId === "oracle.frontend-result"
              ? { ...participant, handlerId }
              : participant,
          ),
        }),
      ).toMatchObject({ ok: true });
    }
    expect(
      deriveOracleEvaluationIdentity({
        ...untransformed,
        participants: [
          ...untransformed.participants,
          {
            handlerId: "oracle.frontend-result.extra",
            contractVersion: "1.0.0",
            implementationRevision: `sha256:${"3".repeat(64)}`,
          },
        ],
      }),
    ).toMatchObject({ ok: true });

    const invalid: readonly unknown[] = [
      null,
      [],
      { ...untransformed, extra: true },
      { ...untransformed, participants: [null] },
      {
        ...untransformed,
        participants: Array.from({ length: 6 }, (_, index) => ({
          handlerId: `oracle.participant-${index}`,
          contractVersion: "1.0.0",
          implementationRevision: `sha256:${"4".repeat(64)}`,
        })),
      },
      {
        ...untransformed,
        participants: [
          {
            handlerId: 1,
            contractVersion: "1.0.0",
            implementationRevision: `sha256:${"5".repeat(64)}`,
          },
        ],
      },
      {
        ...untransformed,
        participants: [
          {
            handlerId: "oracle.frontend-result",
            contractVersion: "1.0.0",
            implementationRevision: "sha256:invalid",
          },
        ],
      },
      {
        ...untransformed,
        participants: [
          ...untransformed.participants,
          {
            handlerId: "oracle.runtime-state",
            contractVersion: "1.0.0",
            implementationRevision: `sha256:${"6".repeat(64)}`,
          },
        ],
      },
    ];
    for (const candidate of invalid) {
      expect(
        deriveOracleEvaluationIdentity(candidate as OracleEvaluationIdentityInputV1),
      ).toMatchObject({ ok: false });
    }
  });

  it("closes replay decoding, provenance, and source-length failures", async () => {
    const replay = await createOracleReplayIdentityFixture();
    expect(
      validateOracleReplayProvenance({
        envelopeBytes: Uint8Array.of(0xff),
        registry: replay.registry,
        expectedProvenance: replay.sourceProvenance,
        expectedSourceContent: replay.sourceContent,
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateOracleReplayProvenance({
        envelopeBytes: replay.envelopeBytes,
        registry: replay.registry,
        expectedProvenance: {
          ...replay.sourceProvenance,
          campaignDigest: `sha256:${"0".repeat(64)}`,
        },
        expectedSourceContent: replay.sourceContent,
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateOracleReplayProvenance({
        envelopeBytes: replay.envelopeBytes,
        registry: replay.registry,
        expectedProvenance: replay.sourceProvenance,
        expectedSourceContent: Uint8Array.of(1),
      }),
    ).toMatchObject({ ok: false });
    const sharedEnvelope = new Uint8Array(new SharedArrayBuffer(replay.envelopeBytes.byteLength));
    sharedEnvelope.set(replay.envelopeBytes);
    expect(
      validateOracleReplayProvenance({
        envelopeBytes: sharedEnvelope,
        registry: replay.registry,
        expectedProvenance: replay.sourceProvenance,
        expectedSourceContent: replay.sourceContent,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/envelopeBytes" }],
    });
    expect(
      validateOracleReplayProvenance({
        envelopeBytes: replay.envelopeBytes,
        registry: replay.registry,
        expectedProvenance: replay.sourceProvenance,
        expectedSourceContent: new Uint8Array(
          replay.sourceProvenance.configuration.budget.maxSourceBytes + 1,
        ),
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/expectedSourceContent" }],
    });

    const changedSource = replay.sourceContent.slice();
    changedSource[0] = (changedSource[0] ?? 0) ^ 1;
    expect(
      validateOracleReplayProvenance({
        envelopeBytes: replay.envelopeBytes,
        registry: replay.registry,
        expectedProvenance: replay.sourceProvenance,
        expectedSourceContent: changedSource,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/sourceContent" }],
    });

    const request = {
      envelopeBytes: replay.envelopeBytes,
      registry: replay.registry,
      expectedProvenance: replay.sourceProvenance,
      expectedSourceContent: replay.sourceContent,
    };
    const nonEnumerable = { ...request };
    Object.defineProperty(nonEnumerable, "registry", {
      value: replay.registry,
      enumerable: false,
    });
    const malformed: readonly unknown[] = [
      null,
      [],
      { ...request, extra: true },
      Object.setPrototypeOf({ ...request }, Date.prototype),
      nonEnumerable,
      new Proxy(request, {
        ownKeys() {
          throw new Error("hostile replay request");
        },
      }),
    ];
    for (const candidate of malformed) {
      expect(validateOracleReplayProvenance(candidate as typeof request)).toMatchObject({
        ok: false,
      });
    }
    expect(
      validateOracleReplayProvenance({
        ...request,
        registry: {} as typeof replay.registry,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/sourceProvenance" }],
    });
    expect(
      validateOracleReplayProvenance({
        ...request,
        expectedProvenance: {
          ...replay.sourceProvenance,
          configuration: {
            ...replay.sourceProvenance.configuration,
            caseCount: -1,
          },
        },
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects non-byte-array content through the closed result branch", () => {
    expect(
      deriveOracleSourceContentIdentity(
        new Proxy(Uint8Array.of(1), {
          getPrototypeOf() {
            throw new Error("hostile");
          },
        }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
    expect(
      deriveOracleSourceContentIdentity(new Uint8Array(new SharedArrayBuffer(1))),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
  });

  it("orders identity participants without consulting the host locale", () => {
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = () => {
      throw new Error("locale ordering must not be consulted");
    };
    try {
      expect(deriveOracleEvaluationIdentity(evaluationInput())).toMatchObject({ ok: true });
    } finally {
      String.prototype.localeCompare = original;
    }
  });
});
