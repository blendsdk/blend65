import { describe, expect, it, vi, beforeAll } from "vitest";

import * as readiness from "./index.js";
import {
  createOracleSuite,
  evaluateCompilerResultOracle,
  evaluateEmittedProgramOracle,
  evaluateFrontendResultOracle,
  evaluateRuntimeStateOracle,
  parseBindingRejectionManifest,
  parseDiagnosticOracleManifest,
  resolveOracleRoute,
} from "./index.js";
import type { DiagnosticContextV1, DiagnosticOracleRecordV1 } from "./index.js";
import {
  BINDING_ROWS,
  ORACLE_HANDLERS,
  ORACLE_RULES,
  createOracleContractsSpecFixture,
} from "./test-fixtures/oracle-contracts-spec-fixture.js";

type OracleContractsSpecFixture = Awaited<ReturnType<typeof createOracleContractsSpecFixture>>;
type OracleCaseFixture = OracleContractsSpecFixture["sourceInvalid"];

type Observable = { readonly kind: "diagnostic" } | { readonly kind: "value-state" };

interface RouteQuery {
  readonly handlerId: string;
  readonly ruleId: string;
  readonly observable: Observable;
  readonly projectionKind: "valid" | "invalid-source-transform" | "invalid-parameter-binding";
}

type OracleSuite = Extract<ReturnType<typeof createOracleSuite>, { readonly ok: true }>["suite"];
type OracleResult = ReturnType<typeof evaluateFrontendResultOracle>;

let fixture: OracleContractsSpecFixture;
let frontendSuite: OracleSuite;
let runtimeSuite: OracleSuite;

function suiteInput(registry: OracleCaseFixture["registry"]) {
  return {
    modeledSuite: fixture.modeledSuite,
    replayRegistry: registry,
    inventory: fixture.inventory,
    diagnosticManifestBytes: fixture.diagnosticManifestBytes,
    bindingRejectionBytes: fixture.bindingRejectionBytes,
  };
}

function requireSuite(result: ReturnType<typeof createOracleSuite>): OracleSuite {
  if (!result.ok) throw new TypeError(JSON.stringify(result.diagnostics));
  expect(result.ok).toBe(true);
  return result.suite;
}

function routeQuery(
  handlerId: string,
  ruleId: string,
  observable: Observable,
  projectionKind: RouteQuery["projectionKind"],
): RouteQuery {
  return { handlerId, ruleId, observable, projectionKind };
}

function oracleRequest(caseFixture: OracleCaseFixture, handlerId: string, observable: Observable) {
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
    observable,
  };
}

function expectFailure(result: unknown, code: string, path?: string): void {
  expect(result).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({ code, ...(path === undefined ? {} : { path }) }),
    ]),
  });
}

function expectRoute(
  suite: OracleSuite,
  query: RouteQuery,
  expected: Readonly<Record<string, unknown>>,
): void {
  expect(resolveOracleRoute(suite, query)).toEqual({ ok: true, ...expected, diagnostics: [] });
}

function expectRawResult(result: OracleResult): void {
  for (const property of [
    "evaluationIdentity",
    "sourceProvenance",
    "contentIdentities",
    "selectedReleaseDigest",
  ]) {
    expect(result).not.toHaveProperty(property);
  }
}

beforeAll(async () => {
  fixture = await createOracleContractsSpecFixture();
  frontendSuite = requireSuite(createOracleSuite(suiteInput(fixture.sourceInvalid.registry)));
  runtimeSuite = requireSuite(createOracleSuite(suiteInput(fixture.runtimeValid.registry)));
});

describe("independent oracle authority", () => {
  it("parses immutable diagnostic and binding manifests with exact record counts", () => {
    const diagnostic = parseDiagnosticOracleManifest(fixture.diagnosticManifestBytes);
    const binding = parseBindingRejectionManifest(fixture.bindingRejectionBytes);

    expect(diagnostic).toEqual({
      ok: true,
      manifest: fixture.diagnosticManifest,
      digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      diagnostics: [],
    });
    expect(binding).toEqual({
      ok: true,
      manifest: fixture.bindingManifest,
      digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      diagnostics: [],
    });
    if (!diagnostic.ok || !binding.ok) throw new TypeError("expected parsed oracle authority");
    const contexts = [
      "initializer",
      "assignment",
      "return-expression",
      "intrinsic-argument",
    ] satisfies readonly DiagnosticContextV1[];
    const initializerRecord = {
      ruleId: ORACLE_RULES.boolean,
      neighborId: "neighbor.scalar.boolean.wrong-type",
      diagnosticContext: "initializer",
      diagnosticCode: "E10152",
      phase: "semantic",
      severity: "error",
      observableFields: ["code", "phase", "severity"],
    } satisfies DiagnosticOracleRecordV1;

    expect(contexts).toHaveLength(4);
    expect(diagnostic.manifest.records).toHaveLength(20);
    expect(diagnostic.manifest.records[0]).toEqual(initializerRecord);
    expect(binding.manifest.records).toHaveLength(9);
    expect(Object.isFrozen(diagnostic.manifest.records)).toBe(true);
    expect(Object.isFrozen(binding.manifest.records)).toBe(true);
    expect(binding.manifest.records).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "diagnostic" })]),
    );
  });

  it("joins both immutable authority digests into the suite", () => {
    const result = createOracleSuite(suiteInput(fixture.sourceInvalid.registry));

    expect(result).toMatchObject({
      ok: true,
      authorityDigests: {
        diagnosticManifest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        bindingRejections: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      },
      diagnostics: [],
    });
  });

  it("rejects every authority mutation without partial suite state", () => {
    for (const variant of fixture.authorityVariants) {
      const result = createOracleSuite({
        ...suiteInput(fixture.sourceInvalid.registry),
        diagnosticManifestBytes: variant.diagnosticManifestBytes,
        bindingRejectionBytes: variant.bindingRejectionBytes,
      });

      expectFailure(result, variant.code, variant.path);
      expect(result).not.toHaveProperty("suite");
      expect(result).not.toHaveProperty("authorityDigests");
    }
  });
});

describe("closed oracle routing and evaluation", () => {
  it("routes real scalar source and parameter-binding rejections to exact authorities", () => {
    for (const [caseFixture, authority] of [
      [fixture.sourceInvalid, "diagnostic-manifest"],
      [fixture.bindingInvalid, "binding-rejections"],
    ] as const) {
      const generated = caseFixture.generatedCase;
      expectRoute(
        frontendSuite,
        routeQuery(
          ORACLE_HANDLERS.frontend,
          generated.modeledCase.primaryRuleId,
          { kind: "diagnostic" },
          caseFixture.projectionKind,
        ),
        {
          outcome: "routed",
          ruleId: generated.modeledCase.primaryRuleId,
          handlerId: ORACLE_HANDLERS.frontend,
          observable: "diagnostic",
          authority,
        },
      );
    }
  });

  it("routes real memory value state only to runtime", () => {
    const generated = fixture.runtimeValid.generatedCase;
    expectRoute(
      runtimeSuite,
      routeQuery(
        ORACLE_HANDLERS.runtime,
        generated.modeledCase.primaryRuleId,
        { kind: "value-state" },
        "valid",
      ),
      {
        outcome: "routed",
        ruleId: generated.modeledCase.primaryRuleId,
        handlerId: ORACLE_HANDLERS.runtime,
        observable: "value-state",
        authority: "none",
      },
    );
  });

  it.each([ORACLE_HANDLERS.compiler, ORACLE_HANDLERS.emitted])(
    "closes absent route %s without fallback",
    (handlerId) => {
      const generated = fixture.sourceInvalid.generatedCase;
      expectRoute(
        frontendSuite,
        routeQuery(
          handlerId,
          generated.modeledCase.primaryRuleId,
          { kind: "diagnostic" },
          fixture.sourceInvalid.projectionKind,
        ),
        { outcome: "oracle-unmodeled", reason: "route-unavailable" },
      );
    },
  );

  it("reports evaluator-unavailable only after a valid value-state route", () => {
    const result = evaluateRuntimeStateOracle(
      runtimeSuite,
      oracleRequest(fixture.runtimeValid, ORACLE_HANDLERS.runtime, { kind: "value-state" }),
    );
    expect(result).toEqual({
      ok: true,
      outcome: "oracle-unmodeled",
      reason: "evaluator-unavailable",
      diagnostics: [],
    });
    expectRawResult(result);
  });

  it("returns exact diagnostic and binding observations from real generated cases", () => {
    const sourceCase = fixture.sourceInvalid.generatedCase.modeledCase;
    const bindingCase = fixture.bindingInvalid.generatedCase.modeledCase;
    if (sourceCase.validity.kind !== "invalid" || bindingCase.validity.kind !== "invalid") {
      throw new TypeError("expected invalid generated cases");
    }
    const bindingNeighborId = bindingCase.validity.neighborId;
    const bindingRecord = BINDING_ROWS.find(
      ({ ruleId, neighborId }) =>
        ruleId === bindingCase.primaryRuleId && neighborId === bindingNeighborId,
    );
    if (bindingRecord === undefined) throw new TypeError("expected binding authority record");

    const diagnostic = evaluateFrontendResultOracle(
      frontendSuite,
      oracleRequest(fixture.sourceInvalid, ORACLE_HANDLERS.frontend, { kind: "diagnostic" }),
    );
    const binding = evaluateFrontendResultOracle(
      frontendSuite,
      oracleRequest(fixture.bindingInvalid, ORACLE_HANDLERS.frontend, { kind: "diagnostic" }),
    );
    expect(diagnostic).toEqual({
      ok: true,
      outcome: "modeled",
      observation: {
        kind: "diagnostic",
        ruleId: ORACLE_RULES.byte,
        neighborId: "neighbor.scalar.byte.above-max",
        code: "E10084",
        phase: "semantic",
        severity: "error",
      },
      diagnostics: [],
    });
    expect(binding).toEqual({
      ok: true,
      outcome: "modeled",
      observation: { kind: "binding-rejection", ...bindingRecord },
      diagnostics: [],
    });
    expectRawResult(diagnostic);
    expectRawResult(binding);
  });

  it("selects boolean diagnostics by generated context without exposing context", () => {
    const initializer = evaluateFrontendResultOracle(
      frontendSuite,
      oracleRequest(fixture.booleanInitializer, ORACLE_HANDLERS.frontend, {
        kind: "diagnostic",
      }),
    );
    const returnExpression = evaluateFrontendResultOracle(
      frontendSuite,
      oracleRequest(fixture.booleanReturnExpression, ORACLE_HANDLERS.frontend, {
        kind: "diagnostic",
      }),
    );
    const observation = (code: "E10152" | "E10172") => ({
      kind: "diagnostic",
      ruleId: ORACLE_RULES.boolean,
      neighborId: "neighbor.scalar.boolean.wrong-type",
      code,
      phase: "semantic",
      severity: "error",
    });

    expect(initializer).toEqual({
      ok: true,
      outcome: "modeled",
      observation: observation("E10152"),
      diagnostics: [],
    });
    expect(returnExpression).toEqual({
      ok: true,
      outcome: "modeled",
      observation: observation("E10172"),
      diagnostics: [],
    });
    expect(initializer).not.toHaveProperty("observation.diagnosticContext");
    expect(returnExpression).not.toHaveProperty("observation.diagnosticContext");
  });

  it("keeps compiler and emitted raw evaluators closed", () => {
    const request = oracleRequest(fixture.sourceInvalid, ORACLE_HANDLERS.compiler, {
      kind: "diagnostic",
    });
    const compiler = evaluateCompilerResultOracle(frontendSuite, request);
    const emitted = evaluateEmittedProgramOracle(frontendSuite, {
      ...request,
      handlerId: ORACLE_HANDLERS.emitted,
    });
    expect(compiler).toMatchObject({ ok: true, outcome: "oracle-unmodeled" });
    expect(emitted).toMatchObject({ ok: true, outcome: "oracle-unmodeled" });
    expectRawResult(compiler);
    expectRawResult(emitted);
  });
});

describe("bounded public surface", () => {
  it("rejects unknown fields and IDs without fallback", () => {
    expectFailure(
      createOracleSuite({ ...suiteInput(fixture.sourceInvalid.registry), extra: true }),
      "oracle.input.invalid",
    );
    expectFailure(
      resolveOracleRoute(frontendSuite, {
        ...routeQuery(
          ORACLE_HANDLERS.frontend,
          ORACLE_RULES.byte,
          { kind: "diagnostic" },
          "invalid-source-transform",
        ),
        extra: true,
      }),
      "oracle.input.invalid",
    );
    expectFailure(
      resolveOracleRoute(
        frontendSuite,
        routeQuery(
          "oracle.unknown",
          ORACLE_RULES.byte,
          { kind: "diagnostic" },
          "invalid-source-transform",
        ),
      ),
      "oracle.input.invalid",
    );
  });

  it("rejects accessors, cycles, exotic objects, and oversized input before evaluation", () => {
    const getter = vi.fn(() => {
      throw new Error("must not execute");
    });
    const accessor = Object.defineProperty({}, "handlerId", { enumerable: true, get: getter });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const input of [accessor, cyclic, new Date(0), { ruleId: "x".repeat(1_000_000) }]) {
      expectFailure(resolveOracleRoute(frontendSuite, input), "oracle.input.invalid");
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects malformed bytes, requests, and inconsistent suite authority", () => {
    expectFailure(
      parseDiagnosticOracleManifest(new TextEncoder().encode("{")),
      "oracle.input.invalid",
    );
    expectFailure(parseBindingRejectionManifest(new Uint8Array([0xff])), "oracle.input.invalid");
    expectFailure(
      evaluateFrontendResultOracle(frontendSuite, { schemaVersion: 2 }),
      "oracle.input.invalid",
    );
    expect(
      Reflect.apply(resolveOracleRoute, undefined, [
        Object.freeze({}),
        routeQuery(
          ORACLE_HANDLERS.frontend,
          ORACLE_RULES.byte,
          { kind: "diagnostic" },
          "invalid-source-transform",
        ),
      ]),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: expect.stringMatching(/^oracle\.authority\./u) }),
      ],
    });
  });

  it("exports no publication evaluator or oracle context constructor", () => {
    expect(readiness).not.toHaveProperty("evaluatePublishedOracle");
    expect(
      Object.keys(readiness).filter(
        (name) =>
          /oracle.*context|context.*oracle/iu.test(name) &&
          /create|factory|constructor/iu.test(name),
      ),
    ).toEqual([]);
  });
});
