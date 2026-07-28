import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkReadinessOracleBoundary,
  scanReadinessOracleBoundary,
} from "./readiness-boundary-scanner.js";
import { createOracleBoundarySpecFixtures } from "./test-fixtures/oracle-boundary-spec-fixtures.js";

const writeFixtureRepository = async (
  repositoryRoot: string,
  modules: readonly {
    readonly path: string;
    readonly source: Uint8Array;
  }[],
): Promise<void> => {
  for (const module of modules) {
    const destination = join(repositoryRoot, module.path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, module.source);
  }
};

describe("readiness oracle package boundary specification", () => {
  for (const fixture of createOracleBoundarySpecFixtures()) {
    it(`should make the in-memory scanner and repository source check agree for ${fixture.name}`, async () => {
      const coreResult = scanReadinessOracleBoundary({
        schemaVersion: 1,
        packageRoot: "packages/readiness",
        entryPaths: fixture.entryPaths,
        modules: fixture.modules,
      });
      const repositoryRoot = await mkdtemp(join(tmpdir(), "blend65-readiness-boundary-"));

      try {
        await writeFixtureRepository(repositoryRoot, fixture.modules);
        const adapterResult = await checkReadinessOracleBoundary(repositoryRoot);

        expect(adapterResult).toEqual(coreResult);

        if (fixture.expectedCode === null) {
          expect(coreResult).toEqual({
            ok: true,
            modulePaths: [
              "packages/readiness/src/oracle-entry.ts",
              "packages/readiness/src/semantic-relations.ts",
              "packages/readiness/src/support.ts",
            ],
            diagnostics: [],
          });
        } else {
          expect(coreResult).toMatchObject({
            ok: false,
            diagnostics: [{ code: fixture.expectedCode }],
          });
        }
      } finally {
        await rm(repositoryRoot, { recursive: true, force: true });
      }
    });
  }
});
