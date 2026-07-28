import { beforeAll, describe, expect, it } from "vitest";

import { runWithSemanticRelationFault } from "./semantic-relation-conformance.js";
import { evaluateSemanticRelation } from "./semantic-relations.js";
import type {
  GenExpression,
  GenModule,
  GeneratedModeledCase,
  OracleObservationV1,
  ScalarType,
  SemanticRelationId,
} from "./index.js";
import { createSemanticRelationsSpecFixture } from "./test-fixtures/semantic-relations-spec-fixture.js";

type Fixture = Awaited<ReturnType<typeof createSemanticRelationsSpecFixture>>;
type CaseFixture = Fixture["valid"];
type RelationResult = ReturnType<typeof evaluateSemanticRelation>;

let fixture: Fixture;

function request(
  source: CaseFixture,
  relationId: SemanticRelationId,
  selectionPath: string,
  variantId: string,
) {
  return {
    schemaVersion: 1,
    handlerId: "transform.semantic-relations",
    relationId,
    sourceProvenance: source.sourceProvenance,
    sourceCase: source.sourceCase,
    entryFunction: source.entryFunction,
    selectionPath,
    variantId,
    memory: source.memory,
    budget: fixture.budget,
  };
}

function requireModeled(result: RelationResult) {
  expect(result).toMatchObject({ ok: true, outcome: "modeled", diagnostics: [] });
  if (!result.ok || result.outcome !== "modeled") {
    throw new TypeError("expected modeled semantic relation");
  }
  expect(result.observation).toEqual(result.transformedObservation);
  expect(result.sourceObservation).toEqual(result.transformedObservation);
  expect(Object.isFrozen(result.sourceCase)).toBe(true);
  expect(Object.isFrozen(result.transformedCase)).toBe(true);
  expect(result.sourceCase).not.toBe(result.transformedCase);
  return result;
}

function moduleOf(sourceCase: GeneratedModeledCase): GenModule {
  const projection = sourceCase.projection;
  return projection.kind === "valid" ? projection.module : projection.baseline;
}

function namesIn(value: unknown, name: string): number {
  if (Array.isArray(value)) return value.reduce((count, item) => count + namesIn(item, name), 0);
  if (value === null || typeof value !== "object") return 0;
  return Object.entries(value).reduce(
    (count, [key, item]) => count + (key === "name" && item === name ? 1 : 0) + namesIn(item, name),
    0,
  );
}

function expectEquivalentObservations(
  source: OracleObservationV1,
  transformed: OracleObservationV1,
): void {
  expect(transformed).toEqual(source);
}

beforeAll(async () => {
  fixture = await createSemanticRelationsSpecFixture();
});

describe("semantic relation rewrites", () => {
  it.each([
    ["constant", "/constants/0", "first"],
    ["function", "/functions/0", "main"],
    ["parameter", "/functions/0/parameters/0", "input"],
    ["local", "/functions/0/body/0", "lift_me"],
  ] as const)("renames a capture-free %s and its complete binding set", (kind, path, oldName) => {
    const source = fixture.valid;
    const original = structuredClone(source.sourceCase);
    const result = requireModeled(
      evaluateSemanticRelation(
        source.suite,
        request(source, "relation.identifier-renaming", path, "fresh-sibling-v1"),
      ),
    );
    const transformed = moduleOf(result.transformedCase);
    const oldCount = namesIn(moduleOf(result.sourceCase), oldName);
    const renamedName =
      kind === "constant"
        ? transformed.constants[0]?.name
        : kind === "function"
          ? transformed.functions[0]?.name
          : kind === "parameter"
            ? transformed.functions[0]?.parameters[0]?.name
            : transformed.functions[0]?.body[0]?.kind === "local"
              ? transformed.functions[0].body[0].name
              : undefined;

    expect(namesIn(transformed, oldName)).toBe(0);
    expect(oldCount).toBeGreaterThan(0);
    expect(renamedName).toBeDefined();
    expect(namesIn(transformed, renamedName ?? "")).toBe(oldCount);
    expect(result.sourceCase).toEqual(original);
    expect(result.transformedCase).not.toEqual(result.sourceCase);
  });

  it("chooses a non-reserved, non-colliding fresh identifier and rejects a non-preserving rename", () => {
    const source = fixture.valid;
    const result = requireModeled(
      evaluateSemanticRelation(
        source.suite,
        request(
          source,
          "relation.identifier-renaming",
          "/functions/0/parameters/0",
          "fresh-sibling-v1",
        ),
      ),
    );
    const parameter = moduleOf(result.transformedCase).functions[0]?.parameters[0];
    expect(parameter?.name).not.toBe("input");
    expect(["first", "second", "dependency", "dependent", "if", "return"]).not.toContain(
      parameter?.name,
    );

    expect(() =>
      runWithSemanticRelationFault(
        {
          schemaVersion: 1,
          pathId: "relation.identifier-renaming.rewrite",
          faultId: "relation.fault.non-preserving-rewrite",
        },
        () =>
          requireModeled(
            evaluateSemanticRelation(
              source.suite,
              request(
                source,
                "relation.identifier-renaming",
                "/functions/0/parameters/0",
                "fresh-sibling-v1",
              ),
            ),
          ),
      ),
    ).toThrow();
  });

  it("introduces one typed immutable local immediately before the selected literal statement", () => {
    const source = fixture.valid;
    const before = moduleOf(source.sourceCase).functions[0]?.body ?? [];
    const selected = before[1];
    const result = requireModeled(
      evaluateSemanticRelation(
        source.suite,
        request(
          source,
          "relation.literal-to-local",
          "/functions/0/body/1/initializer",
          "introduce-local-v1",
        ),
      ),
    );
    const after = moduleOf(result.transformedCase).functions[0]?.body ?? [];
    const introduced = after[1];
    const moved = after[2];
    const introducedName = introduced?.kind === "local" ? introduced.name : undefined;

    expect(introduced).toMatchObject({
      kind: "local",
      type: "byte",
      initializer: { kind: "literal", type: "byte", value: 42n },
    });
    expect(moved).toMatchObject({
      kind: "local",
      name: "literal_holder",
      type: "byte",
      initializer: { kind: "name", type: "byte", name: introducedName },
    });
    expect(after.slice(0, 1)).toEqual(before.slice(0, 1));
    expect(after.slice(3)).toEqual(before.slice(2));
    expect(selected).toEqual(before[1]);
  });

  it("lifts a pure immutable local into an appended parameter and exact external binding", () => {
    const source = fixture.valid;
    const result = requireModeled(
      evaluateSemanticRelation(
        source.suite,
        request(
          source,
          "relation.local-to-parameter",
          "/functions/0/body/0",
          "lift-entry-local-v1",
        ),
      ),
    );
    const transformed = moduleOf(result.transformedCase);
    const appended = transformed.functions[0]?.parameters[1];

    expect(transformed.functions[0]?.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "local", name: "lift_me" })]),
    );
    expect(appended).toMatchObject({ type: "word" });
    expect(result.transformedCase.parameterBindings).toEqual([
      ...source.sourceCase.parameterBindings,
      {
        kind: "parameter-value",
        parameterPath: "/functions/0/parameters/1",
        value: 8n,
      },
    ]);
    expect(namesIn(transformed, "lift_me")).toBe(0);
    expect(namesIn(transformed, appended?.name ?? "")).toBeGreaterThanOrEqual(2);
  });

  it.each([
    ["memory-reading initializer", "/functions/0/body/2"],
    ["reassigned local", "/functions/0/body/3"],
  ])("leaves a %s inapplicable without removing its effects", (_label, path) => {
    const source = fixture.valid;
    const original = structuredClone(source.sourceCase);
    const result = evaluateSemanticRelation(
      source.suite,
      request(source, "relation.local-to-parameter", path, "lift-entry-local-v1"),
    );

    expect(result).toEqual({
      ok: true,
      outcome: "relation-inapplicable",
      relationId: "relation.local-to-parameter",
      diagnostics: [],
    });
    expect(source.sourceCase).toEqual(original);
    expect(result).not.toHaveProperty("transformedCase");
  });
});

describe("algebraic and declaration-order relations", () => {
  const extrema = [
    ["byte", 5, 0n],
    ["byte", 6, 255n],
    ["sbyte", 7, -128n],
    ["sbyte", 8, 127n],
    ["word", 9, 0n],
    ["word", 10, 65_535n],
    ["sword", 11, -32_768n],
    ["sword", 12, 32_767n],
  ] as const;
  const variants = [
    ["add-zero-right", "+", 0n],
    ["subtract-zero-right", "-", 0n],
    ["multiply-one-right", "*", 1n],
    ["divide-one-right", "/", 1n],
    ["or-zero-right", "|", 0n],
    ["xor-zero-right", "^", 0n],
    ["and-all-ones-right", "&", undefined],
    ["shift-left-zero", "<<", 0n],
    ["shift-right-zero", ">>", 0n],
  ] as const;

  it.each(
    extrema.flatMap(([type, bodyIndex, value]) =>
      variants.map(([variant, operator, rightValue]) => ({
        type,
        bodyIndex,
        value,
        variant,
        operator,
        rightValue,
      })),
    ),
  )("applies $variant once at $type extremum $value", (vector) => {
    const source = fixture.valid;
    const sourceExpression = (
      moduleOf(source.sourceCase).functions[0]?.body[vector.bodyIndex] as {
        readonly initializer: GenExpression;
      }
    ).initializer;
    const result = requireModeled(
      evaluateSemanticRelation(
        source.suite,
        request(
          source,
          "relation.algebraic-identity",
          `/functions/0/body/${vector.bodyIndex}/initializer`,
          vector.variant,
        ),
      ),
    );
    const transformedExpression = (
      moduleOf(result.transformedCase).functions[0]?.body[vector.bodyIndex] as {
        readonly initializer: GenExpression;
      }
    ).initializer;
    const binary = transformedExpression as {
      readonly kind: string;
      readonly operator: string;
      readonly left: GenExpression;
      readonly right: { readonly kind: string; readonly type: ScalarType; readonly value: bigint };
    };
    const allOnes =
      vector.type === "byte"
        ? 255n
        : vector.type === "sbyte"
          ? -1n
          : vector.type === "word"
            ? 65_535n
            : -1n;

    expect(binary).toMatchObject({
      kind: "binary",
      type: vector.type,
      operator: vector.operator,
      right: {
        kind: "literal",
        type: vector.variant.startsWith("shift-") ? "byte" : vector.type,
        value: vector.rightValue ?? allOnes,
      },
    });
    expect(binary.left).toEqual(sourceExpression);
    expect([binary.left]).toEqual([sourceExpression]);
    expectEquivalentObservations(result.sourceObservation, result.transformedObservation);
  });

  it("swaps exactly two adjacent independent constants and rejects a hidden dependency", () => {
    const source = fixture.valid;
    const independent = requireModeled(
      evaluateSemanticRelation(
        source.suite,
        request(
          source,
          "relation.independent-declaration-reordering",
          "/constants/0",
          "swap-independent-constants-v1",
        ),
      ),
    );
    const before = moduleOf(independent.sourceCase).constants;
    const after = moduleOf(independent.transformedCase).constants;
    expect(after).toEqual([before[1], before[0], ...before.slice(2)]);

    expect(
      evaluateSemanticRelation(
        source.suite,
        request(
          source,
          "relation.independent-declaration-reordering",
          "/constants/2",
          "swap-independent-constants-v1",
        ),
      ),
    ).toEqual({
      ok: true,
      outcome: "relation-inapplicable",
      relationId: "relation.independent-declaration-reordering",
      diagnostics: [],
    });
  });
});

describe("invalid projections, closure, and relation fault detection", () => {
  it("compares only exact diagnostic and binding projections for permitted invalid renames", () => {
    for (const source of fixture.invalid) {
      const module = moduleOf(source.sourceCase);
      const path =
        source.sourceCase.projection.kind === "invalid" &&
        source.sourceCase.projection.transform.kind === "parameter-binding-replace"
          ? "/functions/0/parameters/0"
          : "/functions/0";
      const result = requireModeled(
        evaluateSemanticRelation(
          source.suite,
          request(source as CaseFixture, "relation.identifier-renaming", path, "fresh-sibling-v1"),
        ),
      );

      expect(result.sourceObservation).toEqual(result.transformedObservation);
      expect(result.observation).toEqual(result.transformedObservation);
      expect(Object.keys(result.observation).sort()).toEqual(
        result.observation.kind === "diagnostic"
          ? ["code", "kind", "neighborId", "phase", "ruleId", "severity"]
          : ["kind", "neighborId", "rejectionCode", "ruleId", "spelling"],
      );
      expect(module).toEqual(moduleOf(result.sourceCase));
    }
  });

  it("rejects a structurally valid rewrite that violates semantic closure before observation", () => {
    const source = fixture.valid;
    const result = runWithSemanticRelationFault(
      {
        schemaVersion: 1,
        pathId: "relation.independent-declaration-reordering.rewrite",
        faultId: "relation.fault.semantic-closure-invalid-rewrite",
      },
      () =>
        evaluateSemanticRelation(
          source.suite,
          request(
            source,
            "relation.independent-declaration-reordering",
            "/constants/0",
            "swap-independent-constants-v1",
          ),
        ),
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.relation.invalid", path: "/transformedCase" }],
    });
    expect(result).not.toHaveProperty("transformedObservation");
    expect(result).not.toHaveProperty("observation");
  });

  it.each([
    {
      label: "false precondition",
      pathId: "relation.algebraic-identity.precondition" as const,
      faultId: "relation.fault.force-precondition-false" as const,
    },
    {
      label: "non-preserving rewrite",
      pathId: "relation.algebraic-identity.rewrite" as const,
      faultId: "relation.fault.non-preserving-rewrite" as const,
    },
    {
      label: "omitted typed return",
      pathId: "relation.algebraic-identity.comparator" as const,
      faultId: "relation.fault.omit-required-observable" as const,
    },
  ])("kills the production-path $label fault", ({ pathId, faultId }) => {
    const source = fixture.valid;
    expect(() =>
      runWithSemanticRelationFault({ schemaVersion: 1, pathId, faultId }, () =>
        requireModeled(
          evaluateSemanticRelation(
            source.suite,
            request(
              source,
              "relation.algebraic-identity",
              "/functions/0/body/10/initializer",
              "add-zero-right",
            ),
          ),
        ),
      ),
    ).toThrow();
  });

  it("keeps relation faults scoped to the matching callback and path", () => {
    const source = fixture.valid;
    const unaffected = runWithSemanticRelationFault(
      {
        schemaVersion: 1,
        pathId: "relation.literal-to-local.precondition",
        faultId: "relation.fault.force-precondition-false",
      },
      () =>
        requireModeled(
          evaluateSemanticRelation(
            source.suite,
            request(
              source,
              "relation.algebraic-identity",
              "/functions/0/body/10/initializer",
              "add-zero-right",
            ),
          ),
        ),
    );
    expect(unaffected.outcome).toBe("modeled");
    expect(
      evaluateSemanticRelation(
        source.suite,
        request(
          source,
          "relation.literal-to-local",
          "/functions/0/body/1/initializer",
          "introduce-local-v1",
        ),
      ),
    ).toMatchObject({ ok: true, outcome: "modeled" });
  });
});
