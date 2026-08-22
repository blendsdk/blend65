import { beforeAll, describe, expect, it } from "vitest";

import { compile, type CompilerDiagnosticEvidenceV1 } from "@blend65/compiler";
import type { CompilerHost } from "@blend65/core";
import {
  createExecutionCaseV1,
  generateCampaignCase,
  getExecutionCaseProjectionV1,
  type ExecutionCaseLayoutProofInputV1,
  type ExecutionCaseV1,
  type ExecutionLayoutProofInputV1,
  type ExecutionPrebuildIdentityInputV1,
  type PreparedCampaign,
  type ScalarType,
} from "@blend65/readiness";
import {
  classifyExecutionDiagnosticEvidenceV1,
  classifyInvalidCaseEmissionV1,
  deriveExecutionFixtureDigestV1,
  deriveFinalExecutionIdentityV1,
  derivePrebuildExecutionIdentityV1,
  renderExecutionEnvelopeV1,
  resolveExecutionCaseObservationLayoutV1,
  resolveExecutionObservationLayoutV1,
  validateExecutionFixtureReadbackV1,
  validateRenderedExecutionSourceV1,
} from "./index.js";
import { createGenuineExecutionCampaigns } from "./test-fixtures/genuine-execution-campaign.js";

const digest = (character: string): string => `sha256:${character.repeat(64)}`;

let frontendCampaign: PreparedCampaign;
let runtimeCampaign: PreparedCampaign;
let scalarCases: ReadonlyMap<ScalarType, ExecutionCaseV1>;
let directCase: ExecutionCaseV1;

beforeAll(async () => {
  const campaigns = await createGenuineExecutionCampaigns();
  frontendCampaign = campaigns.frontend;
  runtimeCampaign = campaigns.runtime;
  scalarCases = findScalarCases();
  directCase = findDirectCase();
});

function findScalarCases(): ReadonlyMap<ScalarType, ExecutionCaseV1> {
  const cases = new Map<ScalarType, ExecutionCaseV1>();
  for (let ordinal = 0; ordinal < frontendCampaign.summary.totalCaseCount; ordinal += 1) {
    const generated = generateCampaignCase(frontendCampaign, ordinal);
    if (!generated.ok || generated.value.modeledCase.projection.kind !== "valid") continue;
    const returnType = generated.value.modeledCase.projection.module.functions[0]?.returnType;
    if (returnType === undefined || returnType === "void" || cases.has(returnType)) continue;
    const created = createExecutionCaseV1(frontendCampaign, ordinal, {
      kind: "scalar-bytes",
      byteLength: returnType === "word" || returnType === "sword" ? 2 : 1,
    });
    if (created.ok) cases.set(returnType, created.value);
  }
  if (cases.size !== 5) throw new TypeError("Expected all five scalar execution cases.");
  return cases;
}

function findDirectCase(): ExecutionCaseV1 {
  for (let ordinal = 0; ordinal < runtimeCampaign.summary.totalCaseCount; ordinal += 1) {
    const generated = generateCampaignCase(runtimeCampaign, ordinal);
    if (!generated.ok || generated.value.planItem.request.choice.kind !== "memory") continue;
    const choice = generated.value.planItem.request.choice;
    if (!choice.ruleId.includes(".poke-")) continue;
    const created = createExecutionCaseV1(runtimeCampaign, ordinal, {
      kind: "direct-mmio",
      byteLength: 1,
      address: choice.addressForm === "computed" ? 0xd021 : 0xd020,
      projectionRevision: "c64-vic-color-observation-v1",
    });
    if (created.ok) return created.value;
  }
  throw new TypeError("Expected one genuine direct-memory execution case.");
}

function layout(): ExecutionLayoutProofInputV1 {
  return {
    labels: new Map([
      ["result-low", 0x2000],
      ["result-high", 0x2001],
      ["completion", 0x2002],
      ["unrelated", 0x4000],
    ]),
    codeRanges: [{ start: 0x0801, length: 0x100 }],
    dataRanges: [{ start: 0x1000, length: 0x100 }],
    semanticRanges: [{ start: 0x3000, length: 0x100 }],
    stackRanges: [{ start: 0x0100, length: 0x100 }],
    observationSymbols: ["result-low", "result-high"],
    completionSymbol: "completion",
  };
}

function liveLayout(
  executionCase: ExecutionCaseV1,
  instructionOffset = 0,
): ExecutionCaseLayoutProofInputV1 {
  const projection = getExecutionCaseProjectionV1(executionCase);
  if (!projection.ok) throw new TypeError("Expected a genuine execution projection.");
  const scalar = projection.value.observation.kind === "scalar-bytes";
  const observationSymbols = scalar
    ? Array.from(
        { length: projection.value.observation.byteLength },
        (_unused, index) => `result-${index}`,
      )
    : [];
  const labels = new Map<string, number>([["completion", 0x2002]]);
  observationSymbols.forEach((symbol, index) => labels.set(symbol, 0x2000 + index));
  const postEntryStores = projection.value.envelope.postEntryStores.map((store, index) =>
    store.kind === "completion"
      ? {
          instructionAddress: 0x0810 + instructionOffset + index * 2,
          targetAddress: 0x2002,
          kind: "completion" as const,
          value: store.value,
        }
      : {
          instructionAddress: 0x0810 + instructionOffset + index * 2,
          targetAddress: 0x2000 + store.byteIndex,
          kind: "observation-byte" as const,
          byteIndex: store.byteIndex,
        },
  );
  return {
    labels,
    codeRanges: [{ start: 0x0801, length: 0x100 }],
    dataRanges: [{ start: 0x1000, length: 0x100 }],
    semanticRanges: [{ start: 0x3000, length: 0x100 }],
    stackRanges: [{ start: 0x0100, length: 0x100 }],
    observationSymbols,
    completionSymbol: "completion",
    postEntryStores,
  };
}

function sourceHost(source: string): CompilerHost {
  return {
    listSourceFiles: () => ["main.blend"],
    readFile: (path) => (path === "main.blend" ? source : undefined),
    resolvePath: (path) => path,
  };
}

function identityInput(): ExecutionPrebuildIdentityInputV1 {
  return {
    sourceCaseDigest: digest("1"),
    renderedSourceDigest: digest("2"),
    argumentsDigest: digest("3"),
    envelopeRevision: "execution-envelope-ir-v1",
    selectorRevision: "execution-selector-v1",
    fixtureRevision: "c64-vic-color-readback-v1",
    fixtureDigest: digest("4"),
    observationProjectionRevision: "c64-vic-color-observation-v1",
    target: "c64",
    policyDigest: digest("5"),
    handlers: [
      {
        capabilityId: "vice",
        contractVersion: "1.0.0",
        implementationRevision: digest("6"),
      },
      {
        capabilityId: "frontend",
        contractVersion: "1.0.0",
        implementationRevision: digest("7"),
      },
    ],
    observation: {
      kind: "direct-mmio",
      byteLength: 1,
      address: 0xd020,
      projectionRevision: "c64-vic-color-observation-v1",
    },
  };
}

describe("execution identity implementation", () => {
  it("canonicalizes handler order and binds every final layout field", () => {
    const input = identityInput();
    const forward = derivePrebuildExecutionIdentityV1(input);
    const reversed = derivePrebuildExecutionIdentityV1({
      ...input,
      handlers: [...input.handlers].reverse(),
    });
    expect(reversed).toBe(forward);

    const accepted = resolveExecutionObservationLayoutV1(layout());
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(deriveFinalExecutionIdentityV1(forward, accepted.value)).not.toBe(
      deriveFinalExecutionIdentityV1(digest("8"), accepted.value),
    );

    const aliased = layout();
    const aliasResult = resolveExecutionObservationLayoutV1({
      ...aliased,
      labels: new Map([...aliased.labels, ["alias-low", 0x2000]]),
      observationSymbols: ["alias-low", "result-high"],
    });
    expect(aliasResult.ok).toBe(true);
    if (!aliasResult.ok) return;
    expect(aliasResult.value.resultAddresses).toEqual(accepted.value.resultAddresses);
    expect(aliasResult.value.resultSymbols).not.toEqual(accepted.value.resultSymbols);
    expect(aliasResult.value.proofDigest).not.toBe(accepted.value.proofDigest);
    expect(deriveFinalExecutionIdentityV1(forward, aliasResult.value)).not.toBe(
      deriveFinalExecutionIdentityV1(forward, accepted.value),
    );
  });

  it("distinguishes absent and present observation projections", () => {
    const present = identityInput();
    const absent: ExecutionPrebuildIdentityInputV1 = {
      sourceCaseDigest: present.sourceCaseDigest,
      renderedSourceDigest: present.renderedSourceDigest,
      argumentsDigest: present.argumentsDigest,
      envelopeRevision: present.envelopeRevision,
      selectorRevision: present.selectorRevision,
      fixtureRevision: present.fixtureRevision,
      fixtureDigest: present.fixtureDigest,
      target: present.target,
      policyDigest: present.policyDigest,
      handlers: present.handlers,
      observation: { kind: "scalar-bytes", byteLength: 1 },
    };
    expect(derivePrebuildExecutionIdentityV1(absent)).not.toBe(
      derivePrebuildExecutionIdentityV1(present),
    );
  });
});

describe("observation layout implementation", () => {
  it("rejects invalid range geometry and invalid label addresses", () => {
    const base = layout();
    const mutants: readonly ExecutionLayoutProofInputV1[] = [
      { ...base, codeRanges: [{ start: -1, length: 1 }] },
      { ...base, dataRanges: [{ start: 0, length: 0 }] },
      { ...base, semanticRanges: [{ start: 0xffff, length: 2 }] },
      {
        ...base,
        labels: new Map([
          ["result-low", -1],
          ["result-high", 0x2001],
          ["completion", 0x2002],
        ]),
      },
      {
        ...base,
        labels: new Map([
          ["result-low", 0x2000],
          ["result-high", 0x2001],
          ["completion", 0x1_0000],
        ]),
      },
    ];
    for (const mutant of mutants) {
      expect(resolveExecutionObservationLayoutV1(mutant).ok).toBe(false);
    }
  });

  it("rejects duplicate, missing and colliding symbols", () => {
    const base = layout();
    const mutants: readonly ExecutionLayoutProofInputV1[] = [
      { ...base, observationSymbols: [] },
      { ...base, observationSymbols: ["result-low", "result-low"] },
      { ...base, observationSymbols: ["completion"] },
      { ...base, observationSymbols: ["missing"] },
      {
        ...base,
        labels: new Map([
          ["result-low", 0x2000],
          ["result-high", 0x2001],
        ]),
      },
      {
        ...base,
        labels: new Map([
          ["result-low", 0x2000],
          ["result-high", 0x2001],
          ["completion", 0x2001],
        ]),
      },
      {
        ...base,
        labels: new Map([
          ["result-low", 0x0801],
          ["result-high", 0x2001],
          ["completion", 0x2002],
        ]),
      },
    ];
    for (const mutant of mutants) {
      expect(resolveExecutionObservationLayoutV1(mutant).ok).toBe(false);
    }
  });

  it("rejects forged map input without invoking it", () => {
    const forged = { ...layout(), labels: {} };
    const result = Reflect.apply(resolveExecutionObservationLayoutV1, undefined, [forged]);
    expect(result.ok).toBe(false);
  });

  it("binds genuine scalar and direct cases to exact emitted store reports", () => {
    const wordCase = scalarCases.get("word");
    if (wordCase === undefined) throw new TypeError("Expected word execution case.");
    const scalar = resolveExecutionCaseObservationLayoutV1(wordCase, liveLayout(wordCase));
    expect(scalar.ok).toBe(true);
    if (!scalar.ok) return;
    expect(scalar.value.resultSymbols).toEqual(["result-0", "result-1"]);
    expect(scalar.value.postEntryStores.map((store) => store.kind)).toEqual([
      "observation-byte",
      "observation-byte",
      "completion",
    ]);
    expect(Object.isFrozen(scalar.value.postEntryStores)).toBe(true);

    const direct = resolveExecutionCaseObservationLayoutV1(directCase, liveLayout(directCase));
    expect(direct.ok).toBe(true);
    if (!direct.ok) return;
    expect(direct.value.resultSymbols).toEqual([]);
    expect(direct.value.resultAddresses).toEqual([]);
    expect(direct.value.postEntryStores).toHaveLength(1);

    const moved = resolveExecutionCaseObservationLayoutV1(wordCase, liveLayout(wordCase, 1));
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.value.proofDigest).not.toBe(scalar.value.proofDigest);
    expect(deriveFinalExecutionIdentityV1(digest("a"), moved.value)).not.toBe(
      deriveFinalExecutionIdentityV1(digest("a"), scalar.value),
    );
  });

  it("rejects wrong authority, width, order, target and instruction placement", () => {
    const wordCase = scalarCases.get("word");
    if (wordCase === undefined) throw new TypeError("Expected word execution case.");
    const base = liveLayout(wordCase);
    const first = base.postEntryStores[0];
    const second = base.postEntryStores[1];
    const completion = base.postEntryStores[2];
    if (first === undefined || second === undefined || completion === undefined) {
      throw new TypeError("Expected two result stores and completion.");
    }
    const mutants: readonly unknown[] = [
      { ...base, observationSymbols: ["result-0"] },
      { ...base, postEntryStores: [second, first, completion] },
      { ...base, postEntryStores: [{ ...first, targetAddress: 0x2001 }, second, completion] },
      { ...base, postEntryStores: [first, second, { ...completion, value: 0xa4 }] },
      {
        ...base,
        postEntryStores: [
          first,
          { ...second, instructionAddress: first.instructionAddress },
          completion,
        ],
      },
      { ...base, postEntryStores: [{ ...first, instructionAddress: 0x2000 }, second, completion] },
      { ...base, postEntryStores: [first, completion] },
      {
        ...base,
        postEntryStores: [
          first,
          second,
          {
            instructionAddress: completion.instructionAddress,
            targetAddress: completion.targetAddress,
            kind: "observation-byte",
            byteIndex: 0,
          },
        ],
      },
    ];
    for (const mutant of mutants) {
      expect(resolveExecutionCaseObservationLayoutV1(wordCase, mutant).ok).toBe(false);
    }
    expect(resolveExecutionCaseObservationLayoutV1(directCase, liveLayout(wordCase)).ok).toBe(
      false,
    );
    expect(Reflect.apply(resolveExecutionCaseObservationLayoutV1, undefined, [{}, base]).ok).toBe(
      false,
    );
  });

  it("fails closed for hostile top-level, map and bounded collection inputs", () => {
    class DerivedMap extends Map<string, number> {}
    const base = layout();
    const sparseRanges: unknown[] = [];
    sparseRanges.length = 1;
    const oversizedRanges = Array.from({ length: 4_097 }, () => ({ start: 1, length: 1 }));
    const oversizedLabels = new Map<string, number>();
    for (let index = 0; index < 4_097; index += 1) {
      oversizedLabels.set(`label-${index}`, index);
    }
    const accessor = {
      get labels(): ReadonlyMap<string, number> {
        throw new TypeError("must not execute");
      },
      codeRanges: base.codeRanges,
      dataRanges: base.dataRanges,
      semanticRanges: base.semanticRanges,
      stackRanges: base.stackRanges,
      observationSymbols: base.observationSymbols,
      completionSymbol: base.completionSymbol,
    };
    const revoked = Proxy.revocable(base, {});
    revoked.revoke();
    for (const hostile of [
      null,
      revoked.proxy,
      accessor,
      { ...base, labels: new DerivedMap(base.labels) },
      { ...base, labels: new Proxy(new Map(base.labels), {}) },
      { ...base, labels: oversizedLabels },
      { ...base, codeRanges: sparseRanges },
      { ...base, codeRanges: oversizedRanges },
    ]) {
      expect(Reflect.apply(resolveExecutionObservationLayoutV1, undefined, [hostile]).ok).toBe(
        false,
      );
    }
  });
});

describe("evidence classifier implementation", () => {
  const observed: CompilerDiagnosticEvidenceV1 = {
    revision: "compiler-diagnostic-evidence-v1",
    entries: [
      {
        acceptedEntryId: digest("9"),
        code: "E10001",
        phase: "parser",
        finalSeverity: "error",
      },
    ],
  };

  it("fails closed for missing codes and malformed evidence revisions", () => {
    expect(
      classifyExecutionDiagnosticEvidenceV1(
        { code: "E10002", phase: "parser", severity: "error" },
        observed,
      ),
    ).toBe("diagnostic-mismatch");
    const malformed = { ...observed, revision: "future" };
    expect(
      Reflect.apply(classifyExecutionDiagnosticEvidenceV1, undefined, [
        { code: "E10001", phase: "parser", severity: "error" },
        malformed,
      ]),
    ).toBe("diagnostic-mismatch");
  });

  it("rejects inherited, partial, accessor and non-boolean emission records", () => {
    const inherited = Object.create({ il: false, assembly: false, binary: false });
    const accessor = {
      get il(): boolean {
        return false;
      },
      assembly: false,
      binary: false,
    };
    for (const value of [
      null,
      [],
      { il: false, assembly: false },
      { il: 0, assembly: false, binary: false },
      inherited,
      accessor,
    ]) {
      expect(classifyInvalidCaseEmissionV1(value)).toBe("unexpected-emission");
    }
  });

  it("accepts exact evidence and fails closed when passive emission evidence throws", () => {
    expect(
      classifyExecutionDiagnosticEvidenceV1(
        { code: "E10001", phase: "parser", severity: "error" },
        observed,
      ),
    ).toBe("pass");
    expect(classifyInvalidCaseEmissionV1({ il: false, assembly: false, binary: false })).toBe(
      "pass",
    );
    expect(classifyInvalidCaseEmissionV1({ il: true, assembly: false, binary: false })).toBe(
      "unexpected-emission",
    );
    const throwing = new Proxy(
      {},
      {
        getPrototypeOf(): never {
          throw new TypeError("hostile evidence");
        },
      },
    );
    expect(classifyInvalidCaseEmissionV1(throwing)).toBe("unexpected-emission");
  });

  it("rejects hostile, sparse, oversized and non-canonical diagnostic evidence", () => {
    const entry = observed.entries[0];
    if (entry === undefined) throw new TypeError("Expected diagnostic evidence entry.");
    const sparse: unknown[] = [];
    sparse.length = 1;
    const oversized = Array.from({ length: 4_097 }, () => entry);
    const accessorEntry = {
      acceptedEntryId: entry.acceptedEntryId,
      get code(): string {
        throw new TypeError("must not execute");
      },
      phase: entry.phase,
      finalSeverity: entry.finalSeverity,
    };
    const accessorEvidence = {
      revision: "compiler-diagnostic-evidence-v1",
      get entries(): readonly unknown[] {
        throw new TypeError("must not execute");
      },
    };
    const revoked = Proxy.revocable(observed, {});
    revoked.revoke();
    const mutants: readonly unknown[] = [
      revoked.proxy,
      accessorEvidence,
      { ...observed, extra: true },
      { ...observed, entries: sparse },
      { ...observed, entries: oversized },
      { ...observed, entries: [accessorEntry] },
      { ...observed, entries: [{ ...entry, acceptedEntryId: digest("A") }] },
      { ...observed, entries: [{ ...entry, code: "error" }] },
      { ...observed, entries: [{ ...entry, phase: "config" }] },
      { ...observed, entries: [{ ...entry, finalSeverity: "info" }] },
      { ...observed, entries: [entry, entry] },
    ];
    for (const mutant of mutants) {
      expect(
        Reflect.apply(classifyExecutionDiagnosticEvidenceV1, undefined, [
          { code: "E10001", phase: "parser", severity: "error" },
          mutant,
        ]),
      ).toBe("diagnostic-mismatch");
    }

    const expectedAccessor = {
      get code(): string {
        throw new TypeError("must not execute");
      },
      phase: "parser",
      severity: "error",
    };
    expect(
      Reflect.apply(classifyExecutionDiagnosticEvidenceV1, undefined, [expectedAccessor, observed]),
    ).toBe("diagnostic-mismatch");
  });
});

describe("envelope validation implementation", () => {
  it("renders compiler-valid envelopes for every scalar type", () => {
    for (const type of ["boolean", "byte", "sbyte", "word", "sword"] as const) {
      const executionCase = scalarCases.get(type);
      if (executionCase === undefined) throw new TypeError(`Expected ${type} execution case.`);
      const rendered = renderExecutionEnvelopeV1(executionCase);
      expect(rendered.ok).toBe(true);
      if (!rendered.ok) continue;
      const compiled = compile(
        { platform: "c64", cwd: "/project", sourceFiles: ["main.blend"] },
        sourceHost(rendered.value),
      );
      expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual(
        [],
      );
      if (type === "boolean") {
        expect(rendered.value).toContain("__execution_result_low: boolean = false");
        expect(rendered.value).toContain("__execution_result_low = __execution_actual");
      }
    }
  });

  it("rejects forged authority and non-byte rendered source", () => {
    expect(Reflect.apply(renderExecutionEnvelopeV1, undefined, [{}]).ok).toBe(false);
    expect(Reflect.apply(validateRenderedExecutionSourceV1, undefined, [{}, "source"]).ok).toBe(
      false,
    );
    expect(
      Reflect.apply(validateRenderedExecutionSourceV1, undefined, [{}, new Uint8Array()]).ok,
    ).toBe(false);
  });

  it("rejects malformed fixtures and forged readback authority", () => {
    expect(
      Reflect.apply(deriveExecutionFixtureDigestV1, undefined, [{ revision: "future", cells: [] }])
        .ok,
    ).toBe(false);
    const revokedFixture = Proxy.revocable(
      { revision: "c64-vic-color-readback-v1", cells: [] },
      {},
    );
    revokedFixture.revoke();
    const revokedCells = Proxy.revocable([], {});
    revokedCells.revoke();
    expect(
      Reflect.apply(deriveExecutionFixtureDigestV1, undefined, [revokedFixture.proxy]).ok,
    ).toBe(false);
    expect(
      Reflect.apply(deriveExecutionFixtureDigestV1, undefined, [
        { revision: "c64-vic-color-readback-v1", cells: revokedCells.proxy },
      ]).ok,
    ).toBe(false);
    expect(
      Reflect.apply(validateExecutionFixtureReadbackV1, undefined, [
        {},
        { revision: "execution-fixture-readback-v1", cells: [], completionValueBeforeEntry: 0 },
      ]),
    ).toBe("invalid-evidence-input");

    const throwingReadback = new Proxy(
      {},
      {
        ownKeys(): never {
          throw new TypeError("hostile readback");
        },
      },
    );
    const accessorCells: unknown[] = [];
    Object.defineProperty(accessorCells, "0", {
      enumerable: true,
      configurable: true,
      get: () => ({}),
    });
    for (const readback of [
      null,
      [],
      Object.assign(Object.create(null), {
        revision: "execution-fixture-readback-v1",
        cells: [],
        completionValueBeforeEntry: 0,
      }),
      throwingReadback,
      {
        revision: "execution-fixture-readback-v1",
        cells: [],
        wrongCompletionKey: 0,
      },
      {
        get revision(): string {
          return "execution-fixture-readback-v1";
        },
        cells: [],
        completionValueBeforeEntry: 0,
      },
      {
        revision: "execution-fixture-readback-v1",
        cells: [{}, {}, {}, {}],
        completionValueBeforeEntry: 0,
      },
      {
        revision: "execution-fixture-readback-v1",
        cells: accessorCells,
        completionValueBeforeEntry: 0,
      },
    ]) {
      expect(Reflect.apply(validateExecutionFixtureReadbackV1, undefined, [{}, readback])).toBe(
        "invalid-evidence-input",
      );
    }
  });
});
