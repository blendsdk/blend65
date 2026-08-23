import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  input: undefined as unknown,
  campaign: undefined as unknown,
  initialProjection: { ok: true, value: 0xf1 } as unknown,
  actualProjection: { ok: true, value: 0xf0 } as unknown,
  request: undefined as unknown,
  evaluated: undefined as unknown,
  sourceIdentity: { ok: true, identity: "source-id" } as unknown,
}));

vi.mock("./execution-case.js", () => ({
  getExecutionCaseEvaluationInputV1: () => mocked.input,
}));

vi.mock("./campaign-state.js", () => ({
  getPreparedCampaignState: () => mocked.campaign,
}));

vi.mock("./execution-vic-projection.js", () => ({
  projectC64InitialStateV1: () => mocked.initialProjection,
  projectC64ActualWriteV1: () => mocked.actualProjection,
}));

vi.mock("./oracle-content-identity.js", () => ({
  deriveOracleSourceContentIdentity: () => mocked.sourceIdentity,
}));

vi.mock("./published-oracle-context.js", () => ({
  createPublishedOracleRequest: () => mocked.request,
  evaluatePublishedOracle: () => mocked.evaluated,
}));

import {
  createPublishedRuntimeEvaluationAuthorityV1,
  evaluatePublishedRuntimeObservationV1,
  getPublishedRuntimeEvaluationProjectionV1,
} from "./published-runtime-evaluation.js";

const EXECUTION_CASE = Object.freeze({});
const CONTEXT = Object.freeze({ selectedReleaseDigest: `sha256:${"a".repeat(64)}` });

function environment() {
  return {
    inventorySchemaVersion: 1,
    inventoryVersion: "inventory-v1",
    inventoryDigest: `sha256:${"1".repeat(64)}`,
    specRevision: "spec-v3.0",
    ruleModelVersion: "rules-v1",
    ruleModelDigest: `sha256:${"2".repeat(64)}`,
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: `sha256:${"3".repeat(64)}`,
    configurationDigest: `sha256:${"4".repeat(64)}`,
    generator: { handlerId: "generator", contractVersion: "1.0.0" },
    boundaryTransform: { handlerId: "boundary", contractVersion: "1.0.0" },
  };
}

function integerObservation(type = "byte", value = 1n) {
  return {
    kind: "value-state",
    returnValue: { kind: "integer", type, value },
    effects: [],
    finalMemory: [],
  };
}

function resetState(): void {
  const modeledCase = { primaryRuleId: "rule.memory", projection: { kind: "valid" } };
  const configuration = { caseCount: 1 };
  const campaignIdentity = environment();
  mocked.input = {
    sourceCaseDigest: `sha256:${"5".repeat(64)}`,
    campaign: Object.freeze({}),
    ordinal: 0,
    generatedCase: { modeledCase, sourceBytes: Uint8Array.of(1) },
    entryFunction: "entry",
    fixture: {
      revision: "c64-vic-color-readback-v1",
      cells: [{ address: 0xd020, logicalValue: 0x21 }],
    },
    observation: { kind: "scalar-bytes", byteLength: 1 },
  };
  mocked.campaign = { campaign: campaignIdentity, configuration };
  mocked.initialProjection = { ok: true, value: 0xf1 };
  mocked.actualProjection = { ok: true, value: 0xf0 };
  mocked.request = {
    ok: true,
    value: {
      sourceProvenance: { campaign: { ...campaignIdentity }, configuration },
      case: modeledCase,
    },
  };
  mocked.evaluated = {
    ok: true,
    result: { ok: true, outcome: "modeled", observation: integerObservation() },
    contentIdentities: { source: "source-id" },
    evaluationIdentity: `sha256:${"6".repeat(64)}`,
  };
  mocked.sourceIdentity = { ok: true, identity: "source-id" };
}

function createAuthority() {
  return createPublishedRuntimeEvaluationAuthorityV1(CONTEXT as never, EXECUTION_CASE as never);
}

beforeEach(resetState);

describe("published runtime evaluation fail-closed branches", () => {
  it("rejects missing case and campaign authority", () => {
    mocked.input = undefined;
    expect(createAuthority()).toMatchObject({ ok: false });
    resetState();
    mocked.campaign = undefined;
    expect(createAuthority()).toMatchObject({ ok: false });
  });

  it("rejects an invalid generated projection and unprojectable fixture", () => {
    const input = mocked.input as { generatedCase: { modeledCase: { projection: unknown } } };
    input.generatedCase.modeledCase.projection = { kind: "invalid" };
    expect(createAuthority()).toMatchObject({ ok: false });
    resetState();
    mocked.initialProjection = { ok: false };
    expect(createAuthority()).toMatchObject({ ok: false });
  });

  it("propagates selected-request rejection", () => {
    mocked.request = { ok: false, diagnostics: [] };
    expect(createAuthority()).toMatchObject({ ok: false });
  });

  it.each(["environment", "replay", "modeled-case"])(
    "rejects a selected %s mismatch",
    (mismatch) => {
      const request = mocked.request as {
        value: {
          sourceProvenance: { campaign: Record<string, unknown>; configuration: unknown };
          case: Record<string, unknown>;
        };
      };
      if (mismatch === "environment") {
        request.value.sourceProvenance.campaign.inventoryVersion = "different";
      } else if (mismatch === "replay") {
        request.value.sourceProvenance.configuration = { caseCount: 2 };
      } else {
        request.value.case = { ...request.value.case, primaryRuleId: "different" };
      }
      expect(createAuthority()).toMatchObject({ ok: false });
    },
  );

  it.each([
    ["evaluation failure", { ok: false }],
    ["modeled failure", { ok: true, result: { ok: false } }],
    ["wrong outcome", { ok: true, result: { ok: true, outcome: "rejected" } }],
    [
      "wrong observation",
      { ok: true, result: { ok: true, outcome: "modeled", observation: { kind: "diagnostics" } } },
    ],
  ])("rejects %s", (_name, evaluated) => {
    mocked.evaluated = evaluated;
    expect(createAuthority()).toMatchObject({ ok: false });
  });

  it("rejects missing and mismatched source identity", () => {
    mocked.sourceIdentity = { ok: false };
    expect(createAuthority()).toMatchObject({ ok: false });
    resetState();
    mocked.sourceIdentity = { ok: true, identity: "different" };
    expect(createAuthority()).toMatchObject({ ok: false });
  });

  it.each([
    ["null return", { ...integerObservation(), returnValue: null }, 1],
    [
      "wide boolean",
      {
        ...integerObservation(),
        returnValue: { kind: "boolean", type: "bool", value: true },
      },
      2,
    ],
    ["integer width mismatch", integerObservation("word", 1n), 1],
  ])("rejects scalar %s", (_name, observation, byteLength) => {
    (mocked.input as { observation: unknown }).observation = {
      kind: "scalar-bytes",
      byteLength,
    };
    (mocked.evaluated as { result: { observation: unknown } }).result.observation = observation;
    expect(createAuthority()).toMatchObject({ ok: false });
  });

  it.each([
    ["boolean", { kind: "boolean", type: "bool", value: true }, 1, Uint8Array.of(1)],
    ["signed byte", { kind: "integer", type: "sbyte", value: -1n }, 1, Uint8Array.of(0xff)],
    ["signed word", { kind: "integer", type: "sword", value: -2n }, 2, Uint8Array.of(0xfe, 0xff)],
  ])("decodes a %s answer", (_name, returnValue, byteLength, expectedBytes) => {
    (mocked.input as { observation: unknown }).observation = {
      kind: "scalar-bytes",
      byteLength,
    };
    (mocked.evaluated as { result: { observation: unknown } }).result.observation = {
      ...integerObservation(),
      returnValue,
    };
    const created = createAuthority();
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const projection = getPublishedRuntimeEvaluationProjectionV1(created.value);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(
      evaluatePublishedRuntimeObservationV1(created.value, {
        revision: "runtime-actual-observation-v1",
        sourceCaseDigest: projection.value.sourceCaseDigest,
        kind: "scalar-bytes",
        bytes: expectedBytes,
      }),
    ).toMatchObject({ ok: true, value: { outcome: "match" } });
  });

  it.each([
    [
      "non-void return",
      () => {
        (mocked.evaluated as { result: { observation: unknown } }).result.observation =
          integerObservation();
      },
    ],
    [
      "missing address",
      () => {
        delete (mocked.input as { observation: { address?: number } }).observation.address;
      },
    ],
    [
      "wrong projection",
      () => {
        (
          mocked.input as { observation: { projectionRevision: string } }
        ).observation.projectionRevision = "unknown";
      },
    ],
    [
      "missing effect",
      () => {
        (mocked.evaluated as { result: { observation: unknown } }).result.observation =
          directObservation({ effects: [] });
      },
    ],
    [
      "missing final memory",
      () => {
        (mocked.evaluated as { result: { observation: unknown } }).result.observation =
          directObservation({ finalMemory: [] });
      },
    ],
    [
      "changed final memory",
      () => {
        (mocked.evaluated as { result: { observation: unknown } }).result.observation =
          directObservation({ finalMemory: [{ address: 0xd020n, value: 0x21n }] });
      },
    ],
  ])("rejects direct observation with %s", (_name, mutate) => {
    (mocked.input as { observation: unknown }).observation = {
      kind: "direct-mmio",
      byteLength: 1,
      address: 0xd020,
      projectionRevision: "c64-vic-color-observation-v1",
    };
    (mocked.evaluated as { result: { observation: unknown } }).result.observation =
      directObservation();
    mutate();
    expect(createAuthority()).toMatchObject({ ok: false });
  });

  it("rejects a direct byte whose hardware projection fails", () => {
    (mocked.input as { observation: unknown }).observation = {
      kind: "direct-mmio",
      byteLength: 1,
      address: 0xd020,
      projectionRevision: "c64-vic-color-observation-v1",
    };
    (mocked.evaluated as { result: { observation: unknown } }).result.observation =
      directObservation();
    mocked.actualProjection = { ok: false };
    expect(createAuthority()).toMatchObject({ ok: false });
  });
});

function directObservation(
  overrides: Partial<{
    readonly effects: readonly unknown[];
    readonly finalMemory: readonly unknown[];
  }> = {},
) {
  return {
    kind: "value-state",
    returnValue: null,
    effects: overrides.effects ?? [
      { kind: "write", address: 0xd020n, width: 1, value: 0x20n, ordinal: 0n },
    ],
    finalMemory: overrides.finalMemory ?? [{ address: 0xd020n, value: 0x20n }],
  };
}
