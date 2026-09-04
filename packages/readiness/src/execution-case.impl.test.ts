import { beforeAll, describe, expect, it } from "vitest";

import {
  createExecutionCaseV1,
  generateCampaignCase,
  getExecutionCaseProjectionV1,
  getStructuredExecutionOracleContextV1,
  parseExecutionEnvelopeIrV1,
  parseExecutionInitialStateFixtureV1,
  projectC64ActualWriteV1,
  projectC64InitialStateV1,
  type ExecutionCaseV1,
  type GeneratedCase,
  type PreparedCampaign,
} from "./index.js";
import { isExecutionCaseOraclePairV1 } from "./execution-runtime.js";
import { createPublishedOracleRequest, type PublishedOracleContext } from "./published-oracle.js";
import { createOracleContractsSpecFixture } from "./test-fixtures/oracle-contracts-spec-fixture.js";

let campaign: PreparedCampaign;
let runtimeCampaign: PreparedCampaign;
let executionCase: ExecutionCaseV1;
let generatedCase: GeneratedCase;

beforeAll(async () => {
  const fixture = await createOracleContractsSpecFixture();
  campaign = fixture.frontendCampaign;
  runtimeCampaign = fixture.runtimeCampaign;
  const found = findParameterizedExecutionCase();
  executionCase = found.executionCase;
  generatedCase = found.generatedCase;
});

function findParameterizedExecutionCase(): {
  readonly executionCase: ExecutionCaseV1;
  readonly generatedCase: GeneratedCase;
} {
  for (let ordinal = 0; ordinal < campaign.summary.totalCaseCount; ordinal += 1) {
    const generated = generateCampaignCase(campaign, ordinal);
    if (!generated.ok) continue;
    for (const byteLength of [1, 2] as const) {
      const created = createExecutionCaseV1(campaign, ordinal, {
        kind: "scalar-bytes",
        byteLength,
      });
      if (!created.ok) continue;
      const projection = getExecutionCaseProjectionV1(created.value);
      if (projection.ok && projection.value.envelope.arguments.length > 0) {
        return { executionCase: created.value, generatedCase: generated.value };
      }
    }
  }
  throw new TypeError("Expected one parameterized valid scalar execution case.");
}

describe("execution-case authority isolation", () => {
  it("returns a fresh mutable source copy without changing registered state", () => {
    const first = getExecutionCaseProjectionV1(executionCase);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const originalFirstByte = first.value.sourceBytes[0];
    first.value.sourceBytes[0] = (originalFirstByte ?? 0) ^ 0xff;

    const second = getExecutionCaseProjectionV1(executionCase);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.sourceBytes[0]).toBe(originalFirstByte);
    expect(second.value.sourceBytes).not.toBe(first.value.sourceBytes);
    expect(Object.isFrozen(second.value)).toBe(true);
    expect(Object.isFrozen(second.value.envelope)).toBe(true);
  });

  it("rejects a proxy around a genuine handle", () => {
    expect(getExecutionCaseProjectionV1(new Proxy(executionCase, {})).ok).toBe(false);
  });

  it("preserves the generated source-case identity while deriving an envelope", () => {
    const projection = getExecutionCaseProjectionV1(executionCase);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.sourceCaseDigest).toBe(generatedCase.identity.digest);
    expect(projection.value.sourceBytes).toEqual(generatedCase.sourceBytes);
  });

  it("uses a distinguishable initial VIC nibble for modeled writes", () => {
    for (let ordinal = 0; ordinal < runtimeCampaign.summary.totalCaseCount; ordinal += 1) {
      const generated = generateCampaignCase(runtimeCampaign, ordinal);
      if (!generated.ok || generated.value.planItem.request.choice.kind !== "memory") continue;
      const choice = generated.value.planItem.request.choice;
      const isWord = choice.ruleId.includes(".pokew-");
      if (!isWord && !choice.ruleId.includes(".poke-")) continue;
      const address = choice.addressForm === "computed" ? 0xd021 : 0xd020;
      const created = createExecutionCaseV1(runtimeCampaign, ordinal, {
        kind: "direct-mmio",
        byteLength: isWord ? 2 : 1,
        address,
        projectionRevision: "c64-vic-color-observation-v1",
      });
      if (!created.ok) continue;
      const projection = getExecutionCaseProjectionV1(created.value);
      expect(projection.ok).toBe(true);
      if (!projection.ok) return;
      expect(projection.value.fixture.cells.every((cell) => cell.logicalValue === 0x21)).toBe(true);
      expect(
        projection.value.fixture.cells.map((cell) =>
          projectC64InitialStateV1(cell.address, cell.logicalValue),
        ),
      ).toEqual(projection.value.fixture.cells.map(() => ({ ok: true, value: 0xf1 })));
      return;
    }
    throw new TypeError("Expected one valid modeled memory write case.");
  });
});

describe("structured execution oracle isolation", () => {
  function createStructuredPair(): {
    readonly executionCase: ExecutionCaseV1;
    readonly oracle: PublishedOracleContext;
  } {
    const created = createExecutionCaseV1({
      schemaVersion: 1,
      kind: "structured-generated",
      caseId: "case.structured.vertical-combined-v1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new TypeError("Expected a structured execution case.");
    const resolvedOracle = getStructuredExecutionOracleContextV1(created.value);
    expect(resolvedOracle.ok).toBe(true);
    if (!resolvedOracle.ok) throw new TypeError("Expected a structured oracle token.");
    return { executionCase: created.value, oracle: resolvedOracle.value };
  }

  it("accepts only the exact oracle token minted for a structured execution case", () => {
    const first = createStructuredPair();
    const second = createStructuredPair();
    const copied = { ...first.oracle } as PublishedOracleContext;
    const forged = {
      selectedReleaseDigest: first.oracle.selectedReleaseDigest,
    } as PublishedOracleContext;

    expect(isExecutionCaseOraclePairV1(first.executionCase, first.oracle)).toBe(true);
    expect(isExecutionCaseOraclePairV1(first.executionCase, copied)).toBe(false);
    expect(isExecutionCaseOraclePairV1(first.executionCase, forged)).toBe(false);
    expect(isExecutionCaseOraclePairV1(first.executionCase, second.oracle)).toBe(false);
  });

  it("does not grant published-request authority to a structured execution token", () => {
    const pair = createStructuredPair();
    expect(createPublishedOracleRequest(pair.oracle, {})).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.authority.missing", path: "/context" }],
    });
  });
});

describe("execution envelope validation internals", () => {
  const validEnvelope = {
    revision: "execution-envelope-ir-v1",
    sourceCaseDigest: `sha256:${"a".repeat(64)}`,
    arguments: [{ name: "value", type: "word", value: 0x2000 }],
    entryFunction: "evaluate",
    observation: { kind: "scalar-bytes", byteLength: 2 },
    completionInitialValue: 0,
    completionSuccessValue: 165,
    postEntryStores: [
      { kind: "observation-byte", byteIndex: 0 },
      { kind: "observation-byte", byteIndex: 1 },
      { kind: "completion", value: 165 },
    ],
  };

  it("rejects duplicate, out-of-range and discriminator-invalid arguments", () => {
    const mutants = [
      { ...validEnvelope, arguments: [validEnvelope.arguments[0], validEnvelope.arguments[0]] },
      { ...validEnvelope, arguments: [{ name: "value", type: "byte", value: 256 }] },
      { ...validEnvelope, arguments: [{ name: "value", type: "boolean", value: 1 }] },
      { ...validEnvelope, arguments: [{ name: "bad name", type: "word", value: 1 }] },
    ];
    for (const mutant of mutants) {
      expect(parseExecutionEnvelopeIrV1(mutant).ok).toBe(false);
    }
  });

  it("rejects malformed store sequences and direct observation ranges", () => {
    const mutants = [
      { ...validEnvelope, postEntryStores: [] },
      {
        ...validEnvelope,
        postEntryStores: [
          { kind: "observation-byte", byteIndex: 1 },
          { kind: "observation-byte", byteIndex: 0 },
          { kind: "completion", value: 165 },
        ],
      },
      {
        ...validEnvelope,
        observation: {
          kind: "direct-mmio",
          byteLength: 2,
          address: 0xd022,
          projectionRevision: "c64-vic-color-observation-v1",
        },
      },
    ];
    for (const mutant of mutants) {
      expect(parseExecutionEnvelopeIrV1(mutant).ok).toBe(false);
    }
  });

  it("rejects unsorted, duplicate and out-of-range fixture cells", () => {
    const fixtures = [
      {
        revision: "c64-vic-color-readback-v1",
        cells: [
          { address: 0xd021, logicalValue: 0 },
          { address: 0xd020, logicalValue: 0 },
        ],
      },
      {
        revision: "c64-vic-color-readback-v1",
        cells: [
          { address: 0xd020, logicalValue: 0 },
          { address: 0xd020, logicalValue: 1 },
        ],
      },
      {
        revision: "c64-vic-color-readback-v1",
        cells: [{ address: 0xd023, logicalValue: 0 }],
      },
      {
        revision: "c64-vic-color-readback-v1",
        cells: [{ address: 0xd020, logicalValue: 256 }],
      },
    ];
    for (const fixture of fixtures) {
      expect(parseExecutionInitialStateFixtureV1(fixture).ok).toBe(false);
    }
  });

  it("fails closed for unsupported VIC addresses and logical values", () => {
    for (const result of [
      projectC64InitialStateV1(0xd01f, 0),
      projectC64InitialStateV1(0xd020, -1),
      projectC64ActualWriteV1(0xd022, 256),
    ]) {
      expect(result.ok).toBe(false);
    }
  });
});
