interface BoundaryFixtureModule {
  readonly path: string;
  readonly source: Uint8Array;
}

interface BoundaryFixture {
  readonly name: string;
  readonly entryPaths: readonly string[];
  readonly modules: readonly BoundaryFixtureModule[];
  readonly expectedCode: string | null;
}

const SOURCE_ENCODER = new TextEncoder();

const moduleSource = (path: string, source: string): BoundaryFixtureModule => ({
  path,
  source: SOURCE_ENCODER.encode(source),
});

/**
 * Returns independent in-memory module graphs for the package-boundary specification.
 *
 * The positive graph proves entry discovery and contained traversal. Each negative
 * graph isolates one forbidden import form so its diagnostic cannot be masked by
 * another violation.
 */
export const createOracleBoundarySpecFixtures = (): readonly BoundaryFixture[] => [
  {
    name: "contained imports",
    entryPaths: [
      "packages/readiness/src/oracle-entry.ts",
      "packages/readiness/src/semantic-relations.ts",
    ],
    modules: [
      moduleSource(
        "packages/readiness/src/oracle-entry.ts",
        'import { value } from "./support.js";\nexport const result = value;\n',
      ),
      moduleSource(
        "packages/readiness/src/semantic-relations.ts",
        'import { basename } from "node:path";\nexport const relation = basename("fixture");\n',
      ),
      moduleSource("packages/readiness/src/support.ts", "export const value = 1;\n"),
      moduleSource("packages/readiness/src/ignored.spec.test.ts", 'import "@blend65/core";\n'),
      moduleSource(
        "packages/readiness/src/test-fixtures/ignored.ts",
        'import "@blend65/frontend";\n',
      ),
    ],
    expectedCode: null,
  },
  {
    name: "forbidden package import",
    entryPaths: ["packages/readiness/src/oracle-entry.ts"],
    modules: [
      moduleSource(
        "packages/readiness/src/oracle-entry.ts",
        'import "@blend65/core";\nexport const value = 1;\n',
      ),
    ],
    expectedCode: "readiness.boundary.import.package",
  },
  {
    name: "relative package escape",
    entryPaths: ["packages/readiness/src/oracle-entry.ts"],
    modules: [
      moduleSource(
        "packages/readiness/src/oracle-entry.ts",
        'export { compile } from "../../compiler/src/index.js";\n',
      ),
    ],
    expectedCode: "readiness.boundary.import.escape",
  },
  {
    name: "non-literal dynamic import",
    entryPaths: ["packages/readiness/src/oracle-entry.ts"],
    modules: [
      moduleSource(
        "packages/readiness/src/oracle-entry.ts",
        'const target = "./support.js";\nexport const load = () => import(target);\n',
      ),
    ],
    expectedCode: "readiness.boundary.import.dynamic",
  },
];
