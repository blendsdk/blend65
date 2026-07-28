import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkReadinessOracleBoundary,
  scanReadinessOracleBoundary,
} from "./readiness-boundary-scanner.js";

const ENCODER = new TextEncoder();

const moduleSource = (path: string, source: string | Uint8Array) => ({
  path,
  source: typeof source === "string" ? ENCODER.encode(source) : source,
});

const graph = (modules: readonly ReturnType<typeof moduleSource>[]) => ({
  schemaVersion: 1,
  packageRoot: "packages/readiness",
  entryPaths: ["packages/readiness/src/oracle-entry.ts"],
  modules,
});

describe("readiness boundary scanner implementation", () => {
  it("should traverse literal imports while ignoring comments and string contents", () => {
    const result = scanReadinessOracleBoundary(
      graph([
        moduleSource(
          "packages/readiness/src/oracle-entry.ts",
          [
            'const ignored = "import(\\"@blend65/core\\")";',
            '// import "@blend65/frontend";',
            'export const load = () => import("./support.js");',
          ].join("\n"),
        ),
        moduleSource("packages/readiness/src/support.ts", 'export { value } from "./value.js";'),
        moduleSource("packages/readiness/src/value.ts", "export const value = 1;"),
      ]),
    );
    expect(result).toEqual({
      ok: true,
      modulePaths: [
        "packages/readiness/src/oracle-entry.ts",
        "packages/readiness/src/support.ts",
        "packages/readiness/src/value.ts",
      ],
      diagnostics: [],
    });
  });

  it("should reject missing modules, invalid UTF-8, duplicate paths, and non-canonical paths", () => {
    expect(
      scanReadinessOracleBoundary(
        graph([moduleSource("packages/readiness/src/oracle-entry.ts", 'import "./missing.js";')]),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.module.missing" }],
    });
    expect(
      scanReadinessOracleBoundary(
        graph([
          moduleSource("packages/readiness/src/oracle-entry.ts", new Uint8Array([0xc3, 0x28])),
        ]),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
    const duplicate = moduleSource("packages/readiness/src/oracle-entry.ts", "export {};");
    expect(scanReadinessOracleBoundary(graph([duplicate, duplicate]))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
    expect(
      scanReadinessOracleBoundary({
        ...graph([]),
        entryPaths: ["packages/readiness/src/../oracle-entry.ts"],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
  });

  it("should reject accessors and per-module source overflow before parsing", () => {
    let invoked = false;
    const hostile = {
      schemaVersion: 1,
      packageRoot: "packages/readiness",
      entryPaths: [],
    };
    Object.defineProperty(hostile, "modules", {
      enumerable: true,
      get() {
        invoked = true;
        return [];
      },
    });
    expect(scanReadinessOracleBoundary(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
    expect(invoked).toBe(false);

    expect(
      scanReadinessOracleBoundary(
        graph([moduleSource("packages/readiness/src/oracle-entry.ts", new Uint8Array(1_048_577))]),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.limit" }],
    });

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(scanReadinessOracleBoundary(cyclic)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
    expect(scanReadinessOracleBoundary(() => undefined)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
    expect(scanReadinessOracleBoundary(Object.create({ schemaVersion: 1 }))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
    const symbolic = { ...graph([]), [Symbol("hidden")]: true };
    expect(scanReadinessOracleBoundary(symbolic)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });

    class DerivedBytes extends Uint8Array {}
    expect(
      scanReadinessOracleBoundary(
        graph([moduleSource("packages/readiness/src/oracle-entry.ts", new DerivedBytes([0x20]))]),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });

    const sparseEntries = new Array<string>(1);
    expect(
      scanReadinessOracleBoundary({
        ...graph([]),
        entryPaths: sparseEntries,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });

    const throwing = new Proxy(
      {},
      {
        ownKeys() {
          throw new TypeError("uninspectable");
        },
      },
    );
    expect(scanReadinessOracleBoundary(throwing)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
  });

  it("should reject bounded collection and module descriptor tricks without invoking them", () => {
    class DerivedArray extends Array<unknown> {}
    const malformedInputs = [
      { schemaVersion: 1, entryPaths: [], modules: [] },
      { schemaVersion: 1, packageRoot: "packages/readiness", modules: [] },
      { ...graph([]), entryPaths: {} },
      { ...graph([]), entryPaths: new DerivedArray() },
      { ...graph([]), modules: [Object.create({})] },
    ];
    for (const input of malformedInputs) {
      expect(scanReadinessOracleBoundary(input)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.input.invalid" }],
      });
    }

    const hiddenEntry = ["packages/readiness/src/oracle-entry.ts"];
    Object.defineProperty(hiddenEntry, "0", {
      value: hiddenEntry[0],
      enumerable: false,
      configurable: true,
      writable: true,
    });
    expect(scanReadinessOracleBoundary({ ...graph([]), entryPaths: hiddenEntry })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });

    for (const accessor of ["path", "source"]) {
      let invoked = false;
      const module = {
        path: "packages/readiness/src/oracle-entry.ts",
        source: ENCODER.encode("export {};"),
      };
      Object.defineProperty(module, accessor, {
        enumerable: true,
        get() {
          invoked = true;
          return accessor === "path"
            ? "packages/readiness/src/oracle-entry.ts"
            : ENCODER.encode("export {};");
        },
      });
      expect(scanReadinessOracleBoundary(graph([module]))).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.input.invalid" }],
      });
      expect(invoked).toBe(false);
    }

    const descriptorTrap = new Proxy(graph([]), {
      getOwnPropertyDescriptor() {
        throw new TypeError("uninspectable");
      },
    });
    expect(scanReadinessOracleBoundary(descriptorTrap)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
  });

  it("should enforce entry, module, path, and aggregate graph limits", () => {
    expect(
      scanReadinessOracleBoundary({
        ...graph([]),
        entryPaths: Array.from(
          { length: 65 },
          (_, index) => `packages/readiness/src/oracle-${index}.ts`,
        ),
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.limit", path: "/entryPaths" }],
    });
    expect(
      scanReadinessOracleBoundary({
        ...graph([]),
        modules: Array.from({ length: 4_097 }, (_, index) =>
          moduleSource(`packages/readiness/src/module-${index}.ts`, "export {};"),
        ),
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.limit", path: "/modules" }],
    });
    expect(
      scanReadinessOracleBoundary({
        ...graph([]),
        entryPaths: [`packages/readiness/src/${"x".repeat(1_100)}.ts`],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
    expect(
      scanReadinessOracleBoundary({
        ...graph([]),
        modules: Array.from({ length: 9 }, (_, index) =>
          moduleSource(`packages/readiness/src/module-${index}.ts`, new Uint8Array(1_000_000)),
        ),
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.limit" }],
    });
  });

  it("should reject malformed module records and missing entry modules", () => {
    expect(
      scanReadinessOracleBoundary({
        schemaVersion: 2,
        packageRoot: "packages/readiness",
        entryPaths: [],
        modules: [],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
    expect(
      scanReadinessOracleBoundary({
        ...graph([]),
        modules: [{ path: "packages/readiness/src/oracle-entry.ts", source: "not-bytes" }],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
    expect(scanReadinessOracleBoundary(graph([]))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.module.missing" }],
    });
    expect(
      scanReadinessOracleBoundary({
        ...graph([]),
        entryPaths: [
          "packages/readiness/src/oracle-entry.ts",
          "packages/readiness/src/oracle-entry.ts",
        ],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
  });

  it("should sort multiple import diagnostics by source module and offset", () => {
    const result = scanReadinessOracleBoundary(
      graph([
        moduleSource(
          "packages/readiness/src/oracle-entry.ts",
          [
            'import "@blend65/frontend";',
            'import "@blend65/core";',
            "const target = './support.js';",
            "import(target);",
          ].join("\n"),
        ),
      ]),
    );
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.dynamic" },
      ],
    });
  });

  it("should inspect every TypeScript dependency form and reject computed loads", () => {
    const result = scanReadinessOracleBoundary(
      graph([
        moduleSource(
          "packages/readiness/src/oracle-entry.ts",
          [
            'import core = require("@blend65/core");',
            'type Frontend = import("@blend65/frontend").Frontend;',
            'const codegen = require("@blend65/codegen");',
            'const compiler = module.require("@blend65/compiler");',
            'const wrapped = (require)("@blend65/core");',
            'const asserted = (require as typeof require)("@blend65/core");',
            'const typeAsserted = (<typeof require>require)("@blend65/core");',
            'const nonNull = require!("@blend65/core");',
            'const satisfied = (require satisfies typeof require)("@blend65/core");',
            'const wrappedMember = (module.require)("@blend65/frontend");',
            'const elementMember = module["require"]("@blend65/codegen");',
            'const unrelatedElement = module["other"]("@blend65/compiler");',
            'const target = "./support.js";',
            "require(target);",
            "module.require(target);",
            "module[target](target);",
          ].join("\n"),
        ),
      ]),
    );
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.package" },
        { code: "readiness.boundary.import.dynamic" },
        { code: "readiness.boundary.import.dynamic" },
        { code: "readiness.boundary.import.dynamic" },
      ],
    });
  });

  it("should close parser stack exhaustion as one bounded input diagnostic", () => {
    const nested = `${"(".repeat(1_000)}0${")".repeat(1_000)}`;
    expect(
      scanReadinessOracleBoundary(
        graph([
          moduleSource(
            "packages/readiness/src/oracle-entry.ts",
            `export const deeplyNested = ${nested};`,
          ),
        ]),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.invalid" }],
    });
  });

  it("should normalize supported relative module extensions without widening traversal", () => {
    expect(
      scanReadinessOracleBoundary(
        graph([
          moduleSource(
            "packages/readiness/src/oracle-entry.ts",
            [
              'import "./first.mjs";',
              'export * from "./second.cjs";',
              'import "./data.json";',
              'import "./plain";',
            ].join("\n"),
          ),
          moduleSource("packages/readiness/src/first.ts", "export {};"),
          moduleSource("packages/readiness/src/second.ts", "export {};"),
          moduleSource("packages/readiness/src/data.json", "{}"),
          moduleSource("packages/readiness/src/plain.ts", "export {};"),
        ]),
      ),
    ).toMatchObject({
      ok: true,
      modulePaths: [
        "packages/readiness/src/data.json",
        "packages/readiness/src/first.ts",
        "packages/readiness/src/oracle-entry.ts",
        "packages/readiness/src/plain.ts",
        "packages/readiness/src/second.ts",
      ],
    });
  });

  it("should reject a contained graph beyond the fixed traversal depth", () => {
    const modules = Array.from({ length: 1_026 }, (_, index) =>
      moduleSource(
        `packages/readiness/src/depth-${index}.ts`,
        index === 1_025 ? "export {};" : `import "./depth-${index + 1}.js";`,
      ),
    );
    expect(
      scanReadinessOracleBoundary({
        ...graph(modules),
        entryPaths: ["packages/readiness/src/depth-0.ts"],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "readiness.boundary.input.limit" }],
    });
  });

  it("should reject symbolic links in the fixed filesystem adapter", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-boundary-impl-"));
    const sourceRoot = join(root, "packages/readiness/src");
    const outside = join(root, "outside.ts");
    try {
      await mkdir(sourceRoot, { recursive: true });
      await writeFile(outside, "export const outside = true;\n");
      await symlink(outside, join(sourceRoot, "oracle-linked.ts"));
      expect(await checkReadinessOracleBoundary(root)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.input.invalid" }],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("should reject symbolic repository and source-directory roots", async () => {
    const parent = await mkdtemp(join(tmpdir(), "blend65-boundary-roots-"));
    const realRoot = join(parent, "real");
    const linkedRoot = join(parent, "linked");
    const realDirectory = join(parent, "outside-directory");
    try {
      await mkdir(join(realRoot, "packages/readiness"), { recursive: true });
      await mkdir(realDirectory, { recursive: true });
      await symlink(realRoot, linkedRoot);
      expect(await checkReadinessOracleBoundary(linkedRoot)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.input.invalid" }],
      });

      expect(await checkReadinessOracleBoundary(join(parent, "missing"))).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.input.invalid" }],
      });

      const ancestorLink = join(parent, "ancestor-link");
      await symlink(parent, ancestorLink);
      expect(await checkReadinessOracleBoundary(join(ancestorLink, "real"))).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.input.invalid" }],
      });

      await symlink(realDirectory, join(realRoot, "packages/readiness/src"));
      expect(await checkReadinessOracleBoundary(realRoot)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.input.invalid" }],
      });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("should reject a canonical source root reached through an ancestor link", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-boundary-ancestor-"));
    const outsidePackages = join(root, "outside-packages");
    try {
      await mkdir(join(outsidePackages, "readiness/src"), { recursive: true });
      await symlink(outsidePackages, join(root, "packages"));
      expect(await checkReadinessOracleBoundary(root)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.input.invalid" }],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("should make an empty isolated repository a deterministic empty graph", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-boundary-empty-"));
    try {
      const result = await checkReadinessOracleBoundary(root);
      expect(result).toEqual({ ok: true, modulePaths: [], diagnostics: [] });

      const file = join(root, "packages/readiness/src/oracle-entry.ts");
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, 'import "@blend65/core";\n');
      expect(await checkReadinessOracleBoundary(root)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.import.package" }],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("should reject an oversized production source through the fixed adapter", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-boundary-large-"));
    const file = join(root, "packages/readiness/src/oracle-large.ts");
    try {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, new Uint8Array(1_048_577));
      expect(await checkReadinessOracleBoundary(root)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.input.limit" }],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("should enforce aggregate bytes while reading regular production files", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-boundary-aggregate-"));
    const sourceRoot = join(root, "packages/readiness/src");
    try {
      await mkdir(sourceRoot, { recursive: true });
      await Promise.all(
        Array.from({ length: 9 }, (_, index) =>
          writeFile(join(sourceRoot, `oracle-${index}.ts`), new Uint8Array(1_000_000)),
        ),
      );
      expect(await checkReadinessOracleBoundary(root)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "readiness.boundary.input.limit" }],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
