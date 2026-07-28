import { describe, expect, it } from "vitest";

import {
  oracleMutationIdForPath,
  oracleMutationPathRegistry,
  oracleMutationVectorIdForPath,
  parseOracleMutationCatalog,
  validateOracleMutationCatalog,
} from "./oracle-mutation-model.js";
import { runOracleMutationCatalog } from "./oracle-mutation-runner.js";

describe("oracle mutation model internals", () => {
  it("deeply closes parsed rows and rejects non-canonical object shapes", () => {
    const registry = oracleMutationPathRegistry();
    const mutants = registry.paths.map((path) => ({
      mutantId: oracleMutationIdForPath(path),
      ...path,
    }));
    const parsed = parseOracleMutationCatalog({
      schemaVersion: 1,
      catalogVersion: "1.0.0",
      policyRevision: "oracle-mutation-policy-v1",
      mutants,
    });

    expect(parsed).toMatchObject({ ok: true });
    if (!parsed.ok) throw new TypeError("expected parsed catalog");
    expect(Object.isFrozen(parsed.value)).toBe(true);
    expect(Object.isFrozen(parsed.value.mutants[0])).toBe(true);
    expect(
      parseOracleMutationCatalog({
        ...parsed.value,
        unexpected: true,
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseOracleMutationCatalog({
        ...parsed.value,
        mutants: [{ ...parsed.value.mutants[0], family: "unknown" }],
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseOracleMutationCatalog(
        new Proxy(
          {},
          {
            ownKeys() {
              throw new Error("hostile catalog");
            },
          },
        ),
      ),
    ).toMatchObject({ ok: false });
    const accessorCatalog = Object.defineProperties(
      {},
      {
        schemaVersion: {
          enumerable: true,
          get() {
            throw new Error("hostile schema");
          },
        },
        catalogVersion: { enumerable: true, value: "1.0.0" },
        policyRevision: { enumerable: true, value: "oracle-mutation-policy-v1" },
        mutants: { enumerable: true, value: [] },
      },
    );
    expect(parseOracleMutationCatalog(accessorCatalog)).toMatchObject({ ok: false });

    let rowAccessorInvoked = false;
    const hostileRow = Object.defineProperty(
      {
        family: "evaluator-operation",
        operationId: "evaluator.binary",
        pathId: "evaluator.binary.integer.add",
        variantId: "integer-xor-one-v1",
      },
      "mutantId",
      {
        enumerable: true,
        get() {
          rowAccessorInvoked = true;
          return "mutant.evaluator.binary.integer.add";
        },
      },
    );
    expect(
      parseOracleMutationCatalog({
        schemaVersion: 1,
        catalogVersion: "1.0.0",
        policyRevision: "oracle-mutation-policy-v1",
        mutants: [hostileRow],
      }),
    ).toMatchObject({ ok: false });
    expect(rowAccessorInvoked).toBe(false);

    let oversizedAccessorInvoked = false;
    const oversized = Array.from({ length: 257 }, () => ({}));
    Object.defineProperty(oversized, "0", {
      enumerable: true,
      get() {
        oversizedAccessorInvoked = true;
        throw new Error("row must not be inspected after the length limit");
      },
    });
    expect(
      parseOracleMutationCatalog({
        schemaVersion: 1,
        catalogVersion: "1.0.0",
        policyRevision: "oracle-mutation-policy-v1",
        mutants: oversized,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/mutants" }],
    });
    expect(oversizedAccessorInvoked).toBe(false);

    const first = mutants[0]!;
    const sparseRows = [first];
    delete sparseRows[0];
    const nonEnumerableRows = [first];
    Object.defineProperty(nonEnumerableRows, "0", {
      value: first,
      enumerable: false,
    });
    const hostileRows = new Proxy([first], {
      ownKeys() {
        throw new Error("hostile rows");
      },
    });
    const malformedCatalogs: readonly unknown[] = [
      null,
      [],
      Object.create(null),
      {
        schemaVersion: 2,
        catalogVersion: "1.0.0",
        policyRevision: "oracle-mutation-policy-v1",
        mutants: [],
      },
      {
        schemaVersion: 1,
        catalogVersion: "2.0.0",
        policyRevision: "oracle-mutation-policy-v1",
        mutants: [],
      },
      {
        schemaVersion: 1,
        catalogVersion: "1.0.0",
        policyRevision: "oracle-mutation-policy-v2",
        mutants: [],
      },
      {
        schemaVersion: 1,
        catalogVersion: "1.0.0",
        policyRevision: "oracle-mutation-policy-v1",
        mutants: {},
      },
      {
        schemaVersion: 1,
        catalogVersion: "1.0.0",
        policyRevision: "oracle-mutation-policy-v1",
        mutants: sparseRows,
      },
      {
        schemaVersion: 1,
        catalogVersion: "1.0.0",
        policyRevision: "oracle-mutation-policy-v1",
        mutants: nonEnumerableRows,
      },
      {
        schemaVersion: 1,
        catalogVersion: "1.0.0",
        policyRevision: "oracle-mutation-policy-v1",
        mutants: hostileRows,
      },
      ...(
        [
          { ...first, mutantId: 1 },
          { ...first, mutantId: "x".repeat(513) },
          { ...first, mutantId: "invalid id" },
          { ...first, family: 1 },
          { ...first, operationId: 1 },
          { ...first, pathId: 1 },
          { ...first, variantId: 1 },
        ] as const
      ).map((row) => ({
        schemaVersion: 1,
        catalogVersion: "1.0.0",
        policyRevision: "oracle-mutation-policy-v1",
        mutants: [row],
      })),
    ];
    for (const candidate of malformedCatalogs) {
      expect(parseOracleMutationCatalog(candidate)).toMatchObject({ ok: false });
    }
  });

  it("orders registry paths without consulting the host locale", () => {
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = () => {
      throw new Error("locale ordering must not be consulted");
    };
    try {
      expect(oracleMutationPathRegistry().paths).toHaveLength(84);
    } finally {
      String.prototype.localeCompare = original;
    }
  });

  it("requires a factory-owned path registry and complete exact vector set", async () => {
    const registry = oracleMutationPathRegistry();
    const mutants = registry.paths.map((path) => ({
      mutantId: oracleMutationIdForPath(path),
      ...path,
    }));
    const parsed = parseOracleMutationCatalog({
      schemaVersion: 1,
      catalogVersion: "1.0.0",
      policyRevision: "oracle-mutation-policy-v1",
      mutants,
    });
    if (!parsed.ok) throw new TypeError("expected parsed catalog");
    expect(
      validateOracleMutationCatalog(parsed.value, {
        schemaVersion: 1,
        paths: registry.paths,
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateOracleMutationCatalog(
        { ...parsed.value, schemaVersion: 2 } as unknown as typeof parsed.value,
        registry,
      ),
    ).toMatchObject({ ok: false });
    const throwingCatalog = Object.defineProperty({}, "schemaVersion", {
      get() {
        throw new Error("hostile validated catalog");
      },
    });
    expect(
      validateOracleMutationCatalog(throwingCatalog as typeof parsed.value, registry),
    ).toMatchObject({ ok: false });
    const sparse = {
      ...parsed.value,
      mutants: [...parsed.value.mutants],
    };
    delete sparse.mutants[0];
    expect(validateOracleMutationCatalog(sparse, registry)).toMatchObject({ ok: false });
    const validated = validateOracleMutationCatalog(parsed.value, registry);
    if (!validated.ok) throw new TypeError("expected validated catalog");

    await expect(
      runOracleMutationCatalog({
        catalog: validated.value,
        vectorIds: [],
        deadlineMilliseconds: 5_000,
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure: "harness-failure",
    });
    await expect(
      runOracleMutationCatalog({
        catalog: parsed.value as typeof validated.value,
        vectorIds: [],
        deadlineMilliseconds: 5_000,
      }),
    ).resolves.toMatchObject({ ok: false, failure: "harness-failure" });
    await expect(
      runOracleMutationCatalog({
        catalog: validated.value,
        vectorIds: registry.paths.map(oracleMutationVectorIdForPath),
        deadlineMilliseconds: 0,
      }),
    ).resolves.toMatchObject({ ok: false, failure: "harness-failure" });
    await expect(
      runOracleMutationCatalog({
        catalog: validated.value,
        vectorIds: registry.paths.map(oracleMutationVectorIdForPath),
        deadlineMilliseconds: 60_001,
      }),
    ).resolves.toMatchObject({ ok: false, failure: "harness-failure" });
    const vectorIds = registry.paths.map(oracleMutationVectorIdForPath);
    await expect(
      runOracleMutationCatalog({
        catalog: validated.value,
        vectorIds: [vectorIds[0]!, ...vectorIds.slice(0, -1)],
        deadlineMilliseconds: 5_000,
      }),
    ).resolves.toMatchObject({ ok: false, failure: "harness-failure" });
    await expect(
      runOracleMutationCatalog({
        catalog: validated.value,
        vectorIds: new Proxy(vectorIds, {
          get(target, property, receiver) {
            if (property === "length") throw new Error("hostile vector set");
            return Reflect.get(target, property, receiver) as unknown;
          },
        }),
        deadlineMilliseconds: 5_000,
      }),
    ).resolves.toMatchObject({ ok: false, failure: "harness-failure" });
  });
});
