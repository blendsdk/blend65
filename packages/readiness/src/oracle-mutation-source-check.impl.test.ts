import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  checkOracleMutationCatalogSource,
  checkOracleMutationDispatchSources,
  READINESS_PATHS,
} from "./cli.js";
import type { OracleMutationCatalogV1 } from "./oracle-mutation-model.js";

const REPOSITORY_ROOT = join(import.meta.dirname, "../../..");
const PRODUCTION_SOURCE_PATHS = [
  "packages/readiness/src/oracle-authority-policy.ts",
  "packages/readiness/src/oracle-evaluator.ts",
  "packages/readiness/src/oracle-memory.ts",
  "packages/readiness/src/oracle-operations.ts",
  "packages/readiness/src/oracle-values.ts",
  "packages/readiness/src/semantic-relation-conformance.ts",
  "packages/readiness/src/semantic-relation-compare.ts",
] as const;
const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-oracle-mutations-"));
  temporaryRoots.push(root);
  return root;
}

async function canonicalCatalog(): Promise<OracleMutationCatalogV1> {
  return JSON.parse(
    await readFile(join(REPOSITORY_ROOT, READINESS_PATHS.oracleMutations), "utf8"),
  ) as OracleMutationCatalogV1;
}

async function writeCatalog(root: string, catalog: unknown): Promise<void> {
  const path = join(root, READINESS_PATHS.oracleMutations);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(catalog));
}

async function writeProductionSources(root: string): Promise<void> {
  await Promise.all(
    PRODUCTION_SOURCE_PATHS.map(async (path) => {
      const destination = join(root, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, await readFile(join(REPOSITORY_ROOT, path)));
    }),
  );
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("oracle mutation source check", () => {
  it("accepts the checked-in exact production join", async () => {
    const root = await temporaryRoot();
    await writeProductionSources(root);
    await writeCatalog(root, await canonicalCatalog());

    await expect(checkOracleMutationCatalogSource(root)).resolves.toEqual({
      ok: true,
      diagnostics: [],
    });
  });

  it.each(["missing", "extra", "duplicate", "unreachable"] as const)(
    "rejects a %s production-path row",
    async (mode) => {
      const root = await temporaryRoot();
      await writeProductionSources(root);
      const catalog = structuredClone(await canonicalCatalog());
      const first = catalog.mutants[0];
      if (first === undefined) throw new TypeError("expected mutation row");
      let mutants = [...catalog.mutants];
      if (mode === "missing") {
        mutants = mutants.slice(1);
      } else if (mode === "extra") {
        mutants = [
          ...mutants,
          {
            mutantId: "mutant.zzz.extra",
            family: "evaluator-operation",
            operationId: "evaluator.binary",
            pathId: "evaluator.binary.zzz.extra",
            variantId: "integer-xor-one-v1",
          },
        ];
      } else if (mode === "duplicate") {
        mutants = [first, first, ...mutants.slice(1)];
      } else {
        mutants = [
          {
            ...first,
            pathId: "binding-rejection.mapping.unreachable",
          },
          ...mutants.slice(1),
        ];
      }
      await writeCatalog(root, { ...catalog, mutants });

      await expect(checkOracleMutationCatalogSource(root)).resolves.toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.mutation.catalog", path: READINESS_PATHS.oracleMutations }],
      });
    },
  );

  it("rejects a final-path symlink without following it", async () => {
    const root = await temporaryRoot();
    await writeProductionSources(root);
    const target = join(root, "catalog-target.json");
    const path = join(root, READINESS_PATHS.oracleMutations);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(target, JSON.stringify(await canonicalCatalog()));
    await symlink(target, path);

    await expect(checkOracleMutationCatalogSource(root)).resolves.toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.mutation.catalog", path: READINESS_PATHS.oracleMutations }],
    });
  });

  it("rejects a catalog larger than the fixed source byte budget", async () => {
    const root = await temporaryRoot();
    await writeProductionSources(root);
    const path = join(root, READINESS_PATHS.oracleMutations);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, " ".repeat(1_048_577));

    await expect(checkOracleMutationCatalogSource(root)).resolves.toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.mutation.catalog", path: READINESS_PATHS.oracleMutations }],
    });
  });

  it.each(["unregistered", "duplicate", "missing", "malformed", "missing-metadata"] as const)(
    "rejects an %s production dispatch marker",
    async (mode) => {
      const root = await temporaryRoot();
      await writeProductionSources(root);
      await writeCatalog(root, await canonicalCatalog());
      const path =
        mode === "missing-metadata" ? PRODUCTION_SOURCE_PATHS[4] : PRODUCTION_SOURCE_PATHS[3];
      const sourcePath = join(root, path);
      const source = await readFile(sourcePath, "utf8");
      const marker =
        'oracleMutationDispatchMarker("evaluator.binary", "evaluator.binary.unregistered", "integer-xor-one-v1")';
      const changed =
        mode === "unregistered"
          ? `${source}\n${marker};\n`
          : mode === "duplicate"
            ? `${source}\noracleMutationDispatchMarker("evaluator.binary", "evaluator.binary.integer.add", "integer-xor-one-v1");\n`
            : mode === "missing"
              ? source.replace(
                  "oracleMutationDispatchMarker(",
                  "removedOracleMutationDispatchMarker(",
                )
              : mode === "malformed"
                ? `${source}\noracleMutationDispatchMarker("malformed");\n`
                : source.replace(
                    "selectedOracleMutationVariant(NORMALIZATION_MUTATIONS[type])",
                    'selectedOracleMutationVariant("evaluator.normalize", `evaluator.normalize.${type}`)',
                  );
      await writeFile(sourcePath, changed);

      await expect(checkOracleMutationDispatchSources(root)).resolves.toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.mutation.dispatch" }],
      });
    },
  );
});
