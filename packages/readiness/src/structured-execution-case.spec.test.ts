import { describe, expect, it, vi } from "vitest";

import { COMBINED_STRUCTURED_CASE_ID } from "./test-fixtures/structured-phase1-authority-spec-fixture.js";

type UnknownCallable = (...args: unknown[]) => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, description: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function isCallable(value: unknown): value is UnknownCallable {
  return typeof value === "function";
}

function requireCallable(module: Record<string, unknown>, name: string): UnknownCallable {
  const value = module[name];
  if (!isCallable(value)) {
    throw new TypeError(`missing ${name}`);
  }
  return value;
}

function requireArray(value: unknown, description: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function requireOperationValue(result: unknown): Record<string, unknown> {
  const record = requireRecord(result, "successful operation result");
  expect(record).toMatchObject({ ok: true });
  return requireRecord(record.value, "operation value");
}

function requireAuthority(result: unknown): Record<string, unknown> {
  const record = requireRecord(result, "successful authority result");
  expect(record).toMatchObject({ ok: true, diagnostics: [] });
  return requireRecord(record.authority, "structured case authority");
}

async function structuredCaseApi(): Promise<Record<string, unknown>> {
  return vi.importActual<Record<string, unknown>>("./structured-case-families.js");
}

async function executionCaseApi(): Promise<Record<string, unknown>> {
  return vi.importActual<Record<string, unknown>>("./execution-case.js");
}

describe("authenticated structured execution case", () => {
  it("resolves the combined program and its independent expectation from one authority", async () => {
    const api = await structuredCaseApi();
    const resolveAuthority = requireCallable(api, "resolveStructuredCaseAuthorityV1");

    const authority = requireAuthority(resolveAuthority(COMBINED_STRUCTURED_CASE_ID));
    const oracleInput = requireRecord(authority.oracleInput, "structured oracle input");
    const memory = requireRecord(oracleInput.memory, "initial oracle memory");

    expect(authority).toMatchObject({
      caseId: COMBINED_STRUCTURED_CASE_ID,
      caseDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    });
    expect(oracleInput).toMatchObject({
      schemaVersion: 2,
      handlerId: "oracle.structured-program",
      entryFunction: "main",
      parameterBindings: [],
      expectationAuthority: "independent-structured-oracle-v2",
    });
    expect(requireArray(memory.cells, "initial oracle cells")).toEqual([]);
  });

  it("derives the direct memory observation without accepting caller-supplied evidence", async () => {
    const api = await executionCaseApi();
    const createExecutionCase = requireCallable(api, "createExecutionCaseV1");
    const getProjection = requireCallable(api, "getStructuredExecutionCaseProjectionV1");
    const getOracleContext = requireCallable(api, "getStructuredExecutionOracleContextV1");
    const request = {
      schemaVersion: 1,
      kind: "structured-generated",
      caseId: COMBINED_STRUCTURED_CASE_ID,
    };

    expect(Object.keys(request).sort()).toEqual(["caseId", "kind", "schemaVersion"]);
    const executionCase = requireOperationValue(createExecutionCase(request));
    const projection = requireOperationValue(getProjection(executionCase));
    const oracleContext = requireOperationValue(getOracleContext(executionCase));
    const envelope = requireRecord(projection.envelope, "execution envelope");

    expect(projection).toMatchObject({
      kind: "structured-generated",
      caseId: COMBINED_STRUCTURED_CASE_ID,
      caseDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      sourceCaseDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      oracleEvaluationIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      expectedObservation: {
        kind: "direct-mmio",
        address: 49_152,
        byteLength: 1,
        value: 12,
      },
      observation: {
        kind: "direct-mmio",
        address: 49_152,
        byteLength: 1,
      },
    });
    expect(envelope.observation).toMatchObject({
      kind: "direct-mmio",
      address: 49_152,
      byteLength: 1,
    });
    expect(projection.sourceCaseDigest).toBe(projection.caseDigest);
    expect(projection.oracleEvaluationIdentity).not.toBe(projection.caseDigest);
    expect(oracleContext).not.toBe(projection);
  });

  it("returns fresh authority and projection values without changing their identities", async () => {
    const [caseApi, executionApi] = await Promise.all([structuredCaseApi(), executionCaseApi()]);
    const resolveAuthority = requireCallable(caseApi, "resolveStructuredCaseAuthorityV1");
    const createExecutionCase = requireCallable(executionApi, "createExecutionCaseV1");
    const getProjection = requireCallable(executionApi, "getStructuredExecutionCaseProjectionV1");

    const firstAuthority = requireAuthority(resolveAuthority(COMBINED_STRUCTURED_CASE_ID));
    const secondAuthority = requireAuthority(resolveAuthority(COMBINED_STRUCTURED_CASE_ID));
    expect(secondAuthority).toEqual(firstAuthority);
    expect(secondAuthority).not.toBe(firstAuthority);

    const firstCase = requireOperationValue(
      createExecutionCase({
        schemaVersion: 1,
        kind: "structured-generated",
        caseId: COMBINED_STRUCTURED_CASE_ID,
      }),
    );
    const secondCase = requireOperationValue(
      createExecutionCase({
        schemaVersion: 1,
        kind: "structured-generated",
        caseId: COMBINED_STRUCTURED_CASE_ID,
      }),
    );
    const firstProjection = requireOperationValue(getProjection(firstCase));
    const secondProjection = requireOperationValue(getProjection(secondCase));
    expect(secondProjection).toEqual(firstProjection);
    expect(secondProjection).not.toBe(firstProjection);
  });
});
