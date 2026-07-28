import { beforeAll, describe, expect, it } from "vitest";

import {
  evaluateCompilerResultOracle,
  evaluateEmittedProgramOracle,
  evaluateFrontendResultOracle,
  evaluateRuntimeStateOracle,
  evaluateSourceOracleCase,
} from "./oracle-handlers.js";
import { parseDiagnosticOracleCandidate } from "./oracle-diagnostic-input.js";
import { createOracleSuite } from "./oracle-suite.js";
import {
  ORACLE_HANDLERS,
  ORACLE_RULES,
  createOracleContractsSpecFixture,
} from "./test-fixtures/oracle-contracts-spec-fixture.js";

type Fixture = Awaited<ReturnType<typeof createOracleContractsSpecFixture>>;
type Suite = Extract<ReturnType<typeof createOracleSuite>, { readonly ok: true }>["suite"];
type CaseFixture = Fixture["sourceInvalid"];

const encoder = new TextEncoder();
const BUDGET = Object.freeze({
  inputNodes: 512n,
  expressionDepth: 16n,
  evaluationSteps: 1_024n,
  frames: 16n,
  memoryCells: 256n,
  effects: 256n,
  transformedNodes: 512n,
});

let fixture: Fixture;
let frontendSuite: Suite;
let runtimeSuite: Suite;

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function suiteInput(registry: CaseFixture["registry"]) {
  return {
    modeledSuite: fixture.modeledSuite,
    replayRegistry: registry,
    inventory: fixture.inventory,
    diagnosticManifestBytes: fixture.diagnosticManifestBytes,
    bindingRejectionBytes: fixture.bindingRejectionBytes,
  };
}

function requireSuite(result: ReturnType<typeof createOracleSuite>): Suite {
  if (!result.ok) throw new TypeError(JSON.stringify(result.diagnostics));
  return result.suite;
}

function oracleRequest(
  caseFixture: CaseFixture,
  handlerId: string,
  observable: "diagnostic" | "value-state",
) {
  return {
    schemaVersion: 1,
    handlerId,
    ruleId: caseFixture.generatedCase.modeledCase.primaryRuleId,
    sourceProvenance: caseFixture.sourceProvenance,
    case: caseFixture.generatedCase.modeledCase,
    entryFunction: caseFixture.entryFunction,
    memory: { schemaVersion: 1, cells: [] },
    budget: BUDGET,
    observable: { kind: observable },
  };
}

function expectInputFailure(result: unknown, path?: string): void {
  expect(result).toMatchObject({
    ok: false,
    diagnostics: [
      {
        code: expect.stringMatching(/^oracle\.(?:input|budget|route|authority)(?:\.|$)/u),
        ...(path === undefined ? {} : { path }),
      },
    ],
  });
}

beforeAll(async () => {
  fixture = await createOracleContractsSpecFixture();
  frontendSuite = requireSuite(createOracleSuite(suiteInput(fixture.sourceInvalid.registry)));
  runtimeSuite = requireSuite(createOracleSuite(suiteInput(fixture.runtimeValid.registry)));
});

describe("oracle raw integration implementation", () => {
  it("routes every raw façade and both reviewed invalid authority families", () => {
    const sourceRequest = oracleRequest(
      fixture.sourceInvalid,
      ORACLE_HANDLERS.frontend,
      "diagnostic",
    );
    const bindingRequest = oracleRequest(
      fixture.bindingInvalid,
      ORACLE_HANDLERS.frontend,
      "diagnostic",
    );
    const runtimeRequest = oracleRequest(
      fixture.runtimeValid,
      ORACLE_HANDLERS.runtime,
      "value-state",
    );

    expect(evaluateSourceOracleCase(frontendSuite, sourceRequest)).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { kind: "diagnostic" },
    });
    expect(evaluateSourceOracleCase(frontendSuite, bindingRequest)).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { kind: "binding-rejection" },
    });
    expect(evaluateSourceOracleCase(runtimeSuite, runtimeRequest)).toMatchObject({
      ok: true,
    });
    expect(
      evaluateSourceOracleCase(frontendSuite, {
        ...sourceRequest,
        handlerId: ORACLE_HANDLERS.compiler,
      }),
    ).toMatchObject({ ok: true, outcome: "oracle-unmodeled" });
    expect(
      evaluateSourceOracleCase(frontendSuite, {
        ...sourceRequest,
        handlerId: ORACLE_HANDLERS.emitted,
      }),
    ).toMatchObject({ ok: true, outcome: "oracle-unmodeled" });
    expect(
      evaluateSourceOracleCase(frontendSuite, {
        ...sourceRequest,
        handlerId: "oracle.unknown",
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/handlerId" }],
    });

    expect(evaluateFrontendResultOracle(frontendSuite, sourceRequest)).toMatchObject({
      ok: true,
      outcome: "modeled",
    });
    expect(
      evaluateCompilerResultOracle(frontendSuite, {
        ...sourceRequest,
        handlerId: ORACLE_HANDLERS.compiler,
      }),
    ).toMatchObject({ ok: true, outcome: "oracle-unmodeled" });
    expect(
      evaluateEmittedProgramOracle(frontendSuite, {
        ...sourceRequest,
        handlerId: ORACLE_HANDLERS.emitted,
      }),
    ).toMatchObject({ ok: true, outcome: "oracle-unmodeled" });
    expect(evaluateRuntimeStateOracle(runtimeSuite, runtimeRequest)).toEqual({
      ok: true,
      outcome: "oracle-unmodeled",
      reason: "evaluator-unavailable",
      diagnostics: [],
    });
  });

  it("closes raw request shape, discriminator, budget, memory, and replay failures", () => {
    const request = oracleRequest(fixture.sourceInvalid, ORACLE_HANDLERS.frontend, "diagnostic");
    const requestFailures = [
      null,
      { ...request, schemaVersion: 2 },
      { ...request, handlerId: "oracle.unknown" },
      { ...request, ruleId: "" },
      { ...request, entryFunction: "-" },
      { ...request, observable: { kind: "unknown" } },
      { ...request, budget: null },
      { ...request, budget: { ...BUDGET, effects: 0n } },
      { ...request, budget: { ...BUDGET, inputNodes: 1n } },
      { ...request, memory: null },
      {
        ...request,
        memory: {
          schemaVersion: 1,
          cells: [
            { address: 0n, value: 0n },
            { address: 1n, value: 0n },
          ],
        },
        budget: { ...BUDGET, memoryCells: 1n },
      },
      { ...request, memory: { schemaVersion: 1, cells: [null] } },
      {
        ...request,
        memory: { schemaVersion: 1, cells: [{ address: -1n, value: 0n }] },
      },
      {
        ...request,
        memory: { schemaVersion: 1, cells: [{ address: 0n, value: 256n }] },
      },
      {
        ...request,
        memory: {
          schemaVersion: 1,
          cells: [
            { address: 1n, value: 0n },
            { address: 1n, value: 0n },
          ],
        },
      },
      { ...request, sourceProvenance: {} },
      { ...request, ruleId: ORACLE_RULES.word },
      { ...request, entryFunction: "missing" },
      { ...request, case: { ...request.case, spelling: "changed" } },
    ];

    for (const invalid of requestFailures) {
      expectInputFailure(evaluateFrontendResultOracle(frontendSuite, invalid));
    }
    expectInputFailure(
      evaluateFrontendResultOracle(frontendSuite, {
        ...request,
        handlerId: ORACLE_HANDLERS.compiler,
      }),
      "/handlerId",
    );
    expectInputFailure(
      Reflect.apply(evaluateFrontendResultOracle, undefined, [Object.freeze({}), request]),
      "/suite",
    );

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expectInputFailure(evaluateSourceOracleCase(frontendSuite, cyclic));
    expectInputFailure(evaluateSourceOracleCase(frontendSuite, { ...request, extra: true }));
  });

  it("rejects hostile suite shapes and malformed authority candidates", () => {
    const valid = suiteInput(fixture.sourceInvalid.registry);
    const nonEnumerable = { ...valid };
    Object.defineProperty(nonEnumerable, "inventory", {
      value: valid.inventory,
      enumerable: false,
    });
    const throwing = new Proxy(
      {},
      {
        ownKeys() {
          throw new TypeError("uninspectable");
        },
      },
    );
    for (const input of [
      null,
      { ...valid, extra: true },
      nonEnumerable,
      throwing,
      { ...valid, inventory: null },
      { ...valid, replayRegistry: {} },
      { ...valid, modeledSuite: {} },
      { ...valid, diagnosticManifestBytes: new Uint8Array([0xff]) },
      { ...valid, bindingRejectionBytes: new Uint8Array([0xff]) },
    ]) {
      expect(createOracleSuite(input).ok).toBe(false);
    }

    for (const variant of fixture.authorityVariants) {
      expect(
        createOracleSuite({
          ...valid,
          diagnosticManifestBytes: variant.diagnosticManifestBytes,
          bindingRejectionBytes: variant.bindingRejectionBytes,
        }),
        variant.name,
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: variant.code, path: variant.path }],
      });
    }
  });

  it("closes each binding authority structural boundary", () => {
    const valid = suiteInput(fixture.sourceInvalid.registry);
    const manifest = fixture.bindingManifest;
    const first = manifest.records[0];
    if (first === undefined) throw new TypeError("expected binding authority record");
    const variants = [
      {},
      { ...manifest, schemaVersion: 2 },
      { ...manifest, manifestVersion: "2.0.0" },
      { ...manifest, policyRevision: "unknown" },
      { ...manifest, records: null },
      { ...manifest, records: Array.from({ length: 65 }, () => first) },
      { ...manifest, records: [null] },
      { ...manifest, records: [{ ...first, ruleId: "" }] },
      { ...manifest, records: [{ ...first, neighborId: "" }] },
      { ...manifest, records: [{ ...first, spelling: 1 }] },
      { ...manifest, records: [{ ...first, rejectionCode: "unknown" }] },
    ];

    for (const candidate of variants) {
      expect(
        createOracleSuite({
          ...valid,
          bindingRejectionBytes: jsonBytes(candidate),
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: expect.stringMatching(/^oracle\.input\./u) }],
      });
    }
  });

  it("closes each diagnostic authority structural boundary", () => {
    const manifest = fixture.diagnosticManifest;
    const first = manifest.records[0];
    if (first === undefined) throw new TypeError("expected diagnostic authority record");
    const variants = [
      {},
      { ...manifest, schemaVersion: 2 },
      { ...manifest, manifestVersion: "2.0.0" },
      { ...manifest, specRevision: "invalid" },
      { ...manifest, policyRevision: "unknown" },
      { ...manifest, records: null },
      { ...manifest, records: Array.from({ length: 65 }, () => first) },
      { ...manifest, records: [null] },
      { ...manifest, records: [{ ...first, extra: true }] },
      { ...manifest, records: [{ ...first, ruleId: "" }] },
      { ...manifest, records: [{ ...first, neighborId: "" }] },
      {
        ...manifest,
        records: [{ ...first, diagnosticContext: 1 }],
      },
      { ...manifest, records: [{ ...first, diagnosticCode: "invalid" }] },
      { ...manifest, records: [{ ...first, phase: "unknown" }] },
      { ...manifest, records: [{ ...first, severity: "warning" }] },
      { ...manifest, records: [{ ...first, observableFields: null }] },
      { ...manifest, records: [{ ...first, observableFields: ["code"] }] },
      {
        ...manifest,
        records: [{ ...first, observableFields: ["phase", "code", "severity"] }],
      },
    ];

    for (const candidate of variants) {
      expect(parseDiagnosticOracleCandidate(jsonBytes(candidate), "/diagnostic")).toMatchObject({
        ok: false,
        diagnostics: [{ code: expect.stringMatching(/^oracle\.input\./u) }],
      });
    }
  });
});
