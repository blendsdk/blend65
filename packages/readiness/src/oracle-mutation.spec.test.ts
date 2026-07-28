import { describe, expect, it } from "vitest";

import {
  runWithOracleMutationVariant,
  selectedOracleMutationVariant,
} from "./oracle-conformance-v1.js";
import {
  oracleMutationPathRegistry,
  parseOracleMutationCatalog,
  validateOracleMutationCatalog,
} from "./oracle-mutation-model.js";
import { runOracleMutationCatalog } from "./oracle-mutation-runner.js";
import { runOracleMutationWorkerProbe } from "./oracle-mutation-worker.js";
import {
  oracleMutationCatalog,
  oracleMutationFamilyCounts,
  oracleMutationSelections,
  oracleMutationVectorIds,
} from "./test-fixtures/oracle-mutation-canonical-vectors.js";

type ParsedCatalog = ReturnType<typeof parseOracleMutationCatalog>;
type Catalog = typeof oracleMutationCatalog;
type Mutant = Catalog["mutants"][number];

function requireCatalog(result: ParsedCatalog): Catalog {
  expect(result).toMatchObject({ ok: true, diagnostics: [] });
  if (!result.ok) throw new TypeError("expected parsed mutation catalog");
  return result.value as Catalog;
}

function expectCatalogRejected(
  catalog: Catalog,
  registry: ReturnType<typeof oracleMutationPathRegistry>,
) {
  const result = validateOracleMutationCatalog(catalog, registry);
  expect(result).toMatchObject({ ok: false });
  expect(result).not.toHaveProperty("value");
}

describe("closed oracle mutation catalog", () => {
  it("joins exactly to every required operation, path, variant, family, and immutable vector", () => {
    const parsed = requireCatalog(
      parseOracleMutationCatalog(structuredClone(oracleMutationCatalog)),
    );
    const registry = oracleMutationPathRegistry();
    const validated = validateOracleMutationCatalog(parsed, registry);

    expect(Object.isFrozen(registry)).toBe(true);
    expect(parsed.mutants).toEqual(oracleMutationCatalog.mutants);
    expect(parsed.mutants.map(({ mutantId }: Mutant) => mutantId)).toEqual(
      [...parsed.mutants].map(({ mutantId }: Mutant) => mutantId).sort(),
    );
    expect(new Set(oracleMutationVectorIds).size).toBe(84);
    expect(
      Object.fromEntries(
        Object.keys(oracleMutationFamilyCounts).map((family) => [
          family,
          parsed.mutants.filter((mutant: Mutant) => mutant.family === family).length,
        ]),
      ),
    ).toEqual(oracleMutationFamilyCounts);
    expect(validated).toMatchObject({ ok: true, diagnostics: [] });
  });

  it("rejects missing, extra, duplicate, and unreachable required triples", () => {
    const parsed = requireCatalog(
      parseOracleMutationCatalog(structuredClone(oracleMutationCatalog)),
    );
    const registry = oracleMutationPathRegistry();
    const first = parsed.mutants[0]!;
    const missing = { ...parsed, mutants: parsed.mutants.slice(1) };
    const extra = {
      ...parsed,
      mutants: [
        ...parsed.mutants,
        {
          mutantId: "mutant.zzz.extra",
          family: "evaluator-operation" as const,
          operationId: "evaluator.binary",
          pathId: "evaluator.binary.integer.extra",
          variantId: "integer-xor-one-v1",
        },
      ],
    };
    const duplicate = {
      ...parsed,
      mutants: [first, first, ...parsed.mutants.slice(1)],
    };
    const unreachable = {
      ...parsed,
      mutants: [
        { ...first, pathId: "binding-rejection.mapping.unreachable" },
        ...parsed.mutants.slice(1),
      ],
    };

    expectCatalogRejected(missing, registry);
    expectCatalogRejected(extra, registry);
    expectCatalogRejected(duplicate, registry);
    expectCatalogRejected(unreachable, registry);
  });
});

describe("oracle mutation execution", () => {
  it("kills all 84 required production-path mutants with no survivors", async () => {
    const parsed = requireCatalog(
      parseOracleMutationCatalog(structuredClone(oracleMutationCatalog)),
    );
    const validated = validateOracleMutationCatalog(parsed, oracleMutationPathRegistry());
    expect(validated).toMatchObject({ ok: true });
    if (!validated.ok) throw new TypeError("expected validated mutation catalog");

    const result = await runOracleMutationCatalog({
      catalog: validated.value,
      vectorIds: oracleMutationVectorIds,
      deadlineMilliseconds: 5_000,
    });

    expect(result).toMatchObject({
      ok: true,
      required: 84n,
      killed: 84n,
      survivors: [],
    });
    if (result.ok) {
      expect(result.catalogDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("isolates a baseline and two different mutation contexts across awaited barriers", async () => {
    const [first, second] = oracleMutationSelections;
    if (first === undefined || second === undefined) {
      throw new TypeError("expected two canonical mutation selections");
    }
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const observe = async (selection: typeof first | undefined) => {
      const operation = async () => {
        const before =
          selection === undefined
            ? selectedOracleMutationVariant(first.operationId, first.pathId)
            : selectedOracleMutationVariant(selection.operationId, selection.pathId);
        await barrier;
        const after =
          selection === undefined
            ? selectedOracleMutationVariant(first.operationId, first.pathId)
            : selectedOracleMutationVariant(selection.operationId, selection.pathId);
        const unrelated = selectedOracleMutationVariant("unrelated", "unrelated");
        return { before, after, unrelated };
      };
      return selection === undefined
        ? operation()
        : runWithOracleMutationVariant(selection, operation);
    };

    const baseline = observe(undefined);
    const selectedFirst = observe(first);
    const selectedSecond = observe(second);
    await Promise.resolve();
    release();

    await expect(Promise.all([baseline, selectedFirst, selectedSecond])).resolves.toEqual([
      { before: undefined, after: undefined, unrelated: undefined },
      { before: first.variantId, after: first.variantId, unrelated: undefined },
      { before: second.variantId, after: second.variantId, unrelated: undefined },
    ]);
    expect(selectedOracleMutationVariant(first.operationId, first.pathId)).toBeUndefined();

    await expect(
      runWithOracleMutationVariant(first, () =>
        runWithOracleMutationVariant(second, async () => undefined),
      ),
    ).rejects.toThrow();
  });

  it.each([
    ["timeout", "worker-timeout"],
    ["crash", "worker-crash"],
    ["budget", "worker-budget"],
    ["invalid-protocol", "worker-protocol"],
  ] as const)(
    "reports worker %s as a harness failure without kill credit",
    async (mode, failure) => {
      const result = await runOracleMutationWorkerProbe(mode, 50);

      expect(result).toMatchObject({
        ok: false,
        failure,
        mutantId: expect.any(String),
        vectorId: expect.any(String),
        diagnostic: expect.objectContaining({
          code: expect.any(String),
          path: expect.any(String),
          message: expect.any(String),
        }),
      });
      expect(result).not.toHaveProperty("killed");
      expect(result).not.toHaveProperty("survivors");
      if (!result.ok) {
        expect(result.diagnostic.message.length).toBeLessThanOrEqual(512);
        expect(result.diagnostic.message).not.toMatch(/\bstack\b|fixture content|filesystem/i);
      }
    },
  );
});
