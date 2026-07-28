import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  ORACLE_V1_LIMITS,
  createOracleSuite,
  evaluateFrontendResultOracle,
  parseBindingRejectionManifest,
  parseDiagnosticOracleManifest,
  resolveOracleRoute,
} from "./index.js";
import {
  ORACLE_HANDLERS,
  ORACLE_RULES,
  createOracleContractsSpecFixture,
} from "./test-fixtures/oracle-contracts-spec-fixture.js";
import { snapshotOracleInput } from "./oracle-input.js";

type Fixture = Awaited<ReturnType<typeof createOracleContractsSpecFixture>>;
type CaseFixture = Fixture["sourceInvalid"];
type Suite = Extract<ReturnType<typeof createOracleSuite>, { readonly ok: true }>["suite"];

const encoder = new TextEncoder();

let fixture: Fixture;
let suite: Suite;

function suiteInput() {
  return {
    modeledSuite: fixture.modeledSuite,
    replayRegistry: fixture.sourceInvalid.registry,
    inventory: fixture.inventory,
    diagnosticManifestBytes: fixture.diagnosticManifestBytes,
    bindingRejectionBytes: fixture.bindingRejectionBytes,
  };
}

function requireSuite(result: ReturnType<typeof createOracleSuite>): Suite {
  if (!result.ok) throw new TypeError("expected oracle suite fixture");
  return result.suite;
}

function request(caseFixture: CaseFixture, handlerId: string = ORACLE_HANDLERS.frontend) {
  return {
    schemaVersion: 1,
    handlerId,
    ruleId: caseFixture.generatedCase.modeledCase.primaryRuleId,
    sourceProvenance: caseFixture.sourceProvenance,
    case: caseFixture.generatedCase.modeledCase,
    entryFunction: caseFixture.entryFunction,
    memory: { schemaVersion: 1, cells: [] },
    budget: {
      inputNodes: 512n,
      expressionDepth: 16n,
      evaluationSteps: 1_024n,
      frames: 16n,
      memoryCells: 256n,
      effects: 256n,
      transformedNodes: 512n,
    },
    observable: { kind: "diagnostic" },
  };
}

function expectFailure(result: unknown, code: string, path?: string): void {
  expect(result).toMatchObject({
    ok: false,
    diagnostics: [
      expect.objectContaining({
        code,
        ...(path === undefined ? {} : { path }),
      }),
    ],
  });
}

beforeAll(async () => {
  fixture = await createOracleContractsSpecFixture();
  suite = requireSuite(createOracleSuite(suiteInput()));
});

describe("oracle authority parser internals", () => {
  it("should reject duplicate JSON properties before authority materialization", () => {
    const text = new TextDecoder().decode(fixture.diagnosticManifestBytes);
    const duplicated = text.replace('{"schemaVersion":1,', '{"schemaVersion":1,"schemaVersion":1,');

    expectFailure(
      parseDiagnosticOracleManifest(encoder.encode(duplicated)),
      "oracle.input.invalid",
      "/schemaVersion",
    );
  });

  it("should reject non-canonical record order in each public parser", () => {
    const diagnosticRecords = [...fixture.diagnosticManifest.records];
    const bindingRecords = [...fixture.bindingManifest.records];
    [diagnosticRecords[0], diagnosticRecords[1]] = [diagnosticRecords[1], diagnosticRecords[0]];
    [bindingRecords[0], bindingRecords[1]] = [bindingRecords[1], bindingRecords[0]];

    expectFailure(
      parseDiagnosticOracleManifest(
        encoder.encode(
          JSON.stringify({ ...fixture.diagnosticManifest, records: diagnosticRecords }),
        ),
      ),
      "oracle.input.invalid",
      "/records/1",
    );
    expectFailure(
      parseBindingRejectionManifest(
        encoder.encode(JSON.stringify({ ...fixture.bindingManifest, records: bindingRecords })),
      ),
      "oracle.input.invalid",
      "/records/1",
    );
  });

  it("should reject unknown record fields and binding spellings", () => {
    const diagnosticRecords = fixture.diagnosticManifest.records.map((record, index) =>
      index === 0 ? { ...record, extra: true } : record,
    );
    const bindingRecords = fixture.bindingManifest.records.map((record, index) =>
      index === 0 ? { ...record, spelling: "local" } : record,
    );

    expectFailure(
      parseDiagnosticOracleManifest(
        encoder.encode(
          JSON.stringify({ ...fixture.diagnosticManifest, records: diagnosticRecords }),
        ),
      ),
      "oracle.input.invalid",
      "/records/0",
    );
    expectFailure(
      parseBindingRejectionManifest(
        encoder.encode(JSON.stringify({ ...fixture.bindingManifest, records: bindingRecords })),
      ),
      "oracle.input.invalid",
      "/records/0/spelling",
    );
  });

  it("should reject unsupported contexts and mixed generic/qualified diagnostic pairs", () => {
    const first = fixture.diagnosticManifest.records[0];
    if (first === undefined) throw new TypeError("expected diagnostic authority");
    const { diagnosticContext: _context, ...generic } = first;
    const unsupported = [
      { ...first, diagnosticContext: "condition" },
      ...fixture.diagnosticManifest.records.slice(1),
    ];
    const mixed = [generic, ...fixture.diagnosticManifest.records];

    expectFailure(
      parseDiagnosticOracleManifest(
        encoder.encode(JSON.stringify({ ...fixture.diagnosticManifest, records: unsupported })),
      ),
      "oracle.input.invalid",
      "/records/0/diagnosticContext",
    );
    expectFailure(
      parseDiagnosticOracleManifest(
        encoder.encode(JSON.stringify({ ...fixture.diagnosticManifest, records: mixed })),
      ),
      "oracle.input.invalid",
      "/records/1/diagnosticContext",
    );
  });

  it("should classify an oversized authority before decoding", () => {
    expectFailure(
      parseDiagnosticOracleManifest(new Uint8Array(ORACLE_V1_LIMITS.authorityBytes + 1)),
      "oracle.input.limit",
      "",
    );
  });
});

describe("oracle hostile-input hardening", () => {
  it("should accept the exact aggregate key/value byte boundary and expose its charge", () => {
    const key = "value";
    const snapshot = snapshotOracleInput({
      [key]: "x".repeat(ORACLE_V1_LIMITS.inputBytes - key.length),
    });

    expect(snapshot).toMatchObject({
      ok: true,
      bytes: ORACLE_V1_LIMITS.inputBytes,
    });
  });

  it("should reject one aggregate UTF-8 byte beyond the hard limit", () => {
    const key = "value";
    expectFailure(
      snapshotOracleInput({
        [key]: "x".repeat(ORACLE_V1_LIMITS.inputBytes - key.length + 1),
      }),
      "oracle.input.limit",
      "/value",
    );
  });

  it("should charge exact-boundary canonical BigInts including a negative sign", () => {
    const magnitude = 10n ** BigInt(ORACLE_V1_LIMITS.bigintDecimalDigits - 1);
    const positive = snapshotOracleInput(magnitude);
    const negative = snapshotOracleInput(-magnitude);

    expect(positive).toMatchObject({
      ok: true,
      bytes: ORACLE_V1_LIMITS.bigintDecimalDigits,
    });
    expect(negative).toMatchObject({
      ok: true,
      bytes: ORACLE_V1_LIMITS.bigintDecimalDigits + 1,
    });
  });

  it("should reject a one-digit-over provenance BigInt before conversion or serialization", () => {
    const baseline = request(fixture.sourceInvalid);
    const oversized = 10n ** BigInt(ORACLE_V1_LIMITS.bigintDecimalDigits);
    const bigintToString = vi.spyOn(BigInt.prototype, "toString");
    const jsonStringify = vi.spyOn(JSON, "stringify");
    let result: ReturnType<typeof evaluateFrontendResultOracle>;
    let bigintConversions: number;
    let serializations: number;
    try {
      result = evaluateFrontendResultOracle(suite, {
        ...baseline,
        sourceProvenance: {
          hostileMagnitude: oversized,
          ...baseline.sourceProvenance,
        },
      });
      bigintConversions = bigintToString.mock.calls.length;
      serializations = jsonStringify.mock.calls.length;
    } finally {
      bigintToString.mockRestore();
      jsonStringify.mockRestore();
    }

    expectFailure(result, "oracle.input.limit", "/sourceProvenance/hostileMagnitude");
    expect(bigintConversions).toBe(0);
    expect(serializations).toBe(0);
  });
});

describe("oracle route and request internals", () => {
  it("should return stable unmodeled reasons for absent rule and observable routes", () => {
    expect(
      resolveOracleRoute(suite, {
        handlerId: ORACLE_HANDLERS.frontend,
        ruleId: "rule.reviewed.but-absent",
        observable: { kind: "diagnostic" },
        projectionKind: "invalid-source-transform",
      }),
    ).toMatchObject({ ok: true, outcome: "oracle-unmodeled", reason: "rule-unavailable" });
    expect(
      resolveOracleRoute(suite, {
        handlerId: ORACLE_HANDLERS.frontend,
        ruleId: ORACLE_RULES.byte,
        observable: { kind: "diagnostic" },
        projectionKind: "valid",
      }),
    ).toMatchObject({
      ok: true,
      outcome: "oracle-unmodeled",
      reason: "unsupported-observable",
    });
  });

  it("should reject a forged suite capability before reading the query", () => {
    expectFailure(
      Reflect.apply(resolveOracleRoute, undefined, [
        Object.freeze({}),
        {
          handlerId: ORACLE_HANDLERS.frontend,
          ruleId: ORACLE_RULES.byte,
          observable: { kind: "diagnostic" },
          projectionKind: "invalid-source-transform",
        },
      ]),
      "oracle.authority.not-accepted",
      "/suite",
    );
  });

  it("should reject a structural replay-registry forgery without invoking it", () => {
    let calls = 0;
    const authentic = fixture.sourceInvalid.registry;
    const result = createOracleSuite({
      ...suiteInput(),
      replayRegistry: {
        resolve: (...args: Parameters<typeof authentic.resolve>) => {
          calls += 1;
          return authentic.resolve(...args);
        },
      },
    });

    expectFailure(result, "oracle.input.invalid", "/replayRegistry");
    expect(calls).toBe(0);
    expect(createOracleSuite(suiteInput()).ok).toBe(true);
  });

  it("should reject façade substitution without falling back", () => {
    expectFailure(
      evaluateFrontendResultOracle(suite, request(fixture.sourceInvalid, ORACLE_HANDLERS.runtime)),
      "oracle.route.invalid",
      "/handlerId",
    );
  });

  it("should reject replay identity and regenerated case substitutions", () => {
    const baseline = request(fixture.sourceInvalid);
    expectFailure(
      evaluateFrontendResultOracle(suite, {
        ...baseline,
        sourceProvenance: {
          ...baseline.sourceProvenance,
          campaignDigest: `sha256:${"f".repeat(64)}`,
        },
      }),
      "oracle.input.invalid",
      "/sourceProvenance/campaignDigest",
    );
    expectFailure(
      evaluateFrontendResultOracle(suite, {
        ...baseline,
        case: { ...baseline.case, primaryRuleId: ORACLE_RULES.word },
      }),
      "oracle.input.invalid",
      "/case",
    );
  });

  it("should reject non-canonical memory and exhausted structural budgets", () => {
    const baseline = request(fixture.sourceInvalid);
    expectFailure(
      evaluateFrontendResultOracle(suite, {
        ...baseline,
        memory: {
          schemaVersion: 1,
          cells: [
            { address: 2n, value: 0n },
            { address: 1n, value: 0n },
          ],
        },
      }),
      "oracle.input.invalid",
      "/memory/cells/1/address",
    );
    expectFailure(
      evaluateFrontendResultOracle(suite, {
        ...baseline,
        budget: { ...baseline.budget, inputNodes: 1n },
      }),
      "oracle.budget",
      "",
    );
  });
});
