import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

import * as readinessPublicApi from "@blend65/readiness";
import {
  getCompositeReadinessProjectionV1,
  resolveCompositeReadinessSnapshot,
  resolvePublishedExecutionRelease,
  resolvePublishedSnapshotByDigest,
} from "@blend65/readiness";
import type { PublishedExecutionRelease } from "@blend65/readiness";
import {
  assertGeneratedExecutionBindingsFreshV1,
  getPublishedExecutionHandlersV1,
  resolveLiveExecutionContextV1,
  selectExecutionPublicationByDigestV1,
} from "@blend65/readiness-execution";
import * as executionPublicApi from "@blend65/readiness-execution";
import { afterEach, describe, expect, it } from "vitest";

import {
  getExecutionCatalogFixtureDescriptorV1,
  runWithExecutionCatalogConformanceV1,
  validateExecutionCatalogModuleBoundaryV1,
} from "./execution-publication-catalog-conformance-v1.js";
import * as catalogConformanceApi from "./execution-publication-catalog-conformance-v1.js";
import {
  createExecutionPublicationCatalogFixtureV1,
  encodeCanonicalJsonV1,
  readCurrentPublicationPointerBytesV1,
  resolveCatalogSpecRepositoryRootV1,
  snapshotPublicationArtifactsV1,
  type ExecutionPublicationCatalogFixtureV1,
} from "./test-fixtures/execution-publication-catalog-spec-fixture.js";

const EXPECTED_BINDING_IDS = ["acme", "cli", "compiler-api", "emit", "frontend", "vice"] as const;
const EXPECTED_HANDLER_IDS = ["frontend", "compiler-api", "cli", "emit", "acme", "vice"] as const;
const LIVE_OWNER_MODULES = [
  "execution-publication-catalog.ts",
  "execution-handler-catalog.generated.ts",
  "execution-publication-catalog-conformance-v1.ts",
] as const;
const LIVE_CATALOG_LITERALS = [
  "execution-handler-catalog-v1",
  "execution-bindings-generated-v1",
  "execution-handler-catalog.generated",
] as const;
const HISTORICAL_PASSIVE_LITERALS = ["readiness/publications", "current-publication.json"] as const;

interface BindingRowV1 {
  capabilityId: string;
  contractVersion: string;
  implementationRevision: string;
}

interface BindingDocumentV1 {
  schemaVersion: 1;
  kind: "execution-bindings-v1";
  bindings: BindingRowV1[];
}

interface CatalogDescriptorRowV1 extends BindingRowV1 {
  readonly entryPath: string;
  readonly dependencyPaths: readonly string[];
  readonly dependencyDigests: Readonly<Record<string, string>>;
}

interface OperationIssueV1 {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

type OperationResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly OperationIssueV1[] };

type CompatiblePublicationResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostics: readonly unknown[] };

const fixtures: ExecutionPublicationCatalogFixtureV1[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

async function createFixture(
  bindingBytes?: Uint8Array,
): Promise<ExecutionPublicationCatalogFixtureV1> {
  const fixture = bindingBytes
    ? await createExecutionPublicationCatalogFixtureV1({ bindingBytes })
    : await createExecutionPublicationCatalogFixtureV1();
  fixtures.push(fixture);
  return fixture;
}

function requireOk<T>(result: OperationResultV1<T>, operation: string): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(
      `${operation}: ${result.issues
        .map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.value;
}

function requireCompatiblePublicationOk<T>(
  result: CompatiblePublicationResultV1<T>,
  operation: string,
): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`${operation}: ${result.diagnostics.length} diagnostics`);
  }
  return result.value;
}

async function resolveRelease(
  repositoryRoot: string,
  digest: string,
): Promise<PublishedExecutionRelease> {
  return requireOk(
    await resolvePublishedExecutionRelease(repositoryRoot, digest),
    "resolve execution publication",
  );
}

async function selectRelease(repositoryRoot: string, digest: string): Promise<void> {
  requireOk(
    await selectExecutionPublicationByDigestV1(repositoryRoot, digest),
    "select execution publication",
  );
}

function parseBindings(bytes: Uint8Array): BindingDocumentV1 {
  return JSON.parse(new TextDecoder().decode(bytes)) as BindingDocumentV1;
}

function mutateBindingBytes(mutation: (document: BindingDocumentV1) => void): Uint8Array {
  const descriptor = getExecutionCatalogFixtureDescriptorV1();
  const document = parseBindings(descriptor.bindingBytes);
  mutation(document);
  return encodeCanonicalJsonV1(document);
}

function expectIssueCode(result: unknown, code: string): void {
  expect(result).toMatchObject({ ok: false });
  if (
    typeof result !== "object" ||
    result === null ||
    !("ok" in result) ||
    result.ok !== false ||
    !("issues" in result) ||
    !Array.isArray(result.issues)
  ) {
    throw new TypeError("Expected a failed execution operation result");
  }
  expect(result.issues.length).toBeGreaterThan(0);
  expect(result.issues.map((issue) => issue.code)).toContain(code);
  for (const issue of result.issues) {
    expect(issue).toEqual({
      code: expect.any(String),
      path: expect.any(String),
      message: expect.any(String),
    });
  }
}

async function listProductionTypeScriptFiles(
  root: string,
): Promise<readonly { path: string; source: string }[]> {
  async function visit(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          return entry.name === "test-fixtures" ? [] : visit(path);
        }
        return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
      }),
    );
    return nested.flat();
  }

  const files = await visit(root);
  return Promise.all(
    files.sort().map(async (path) => ({
      path: relative(root, path),
      source: await readFile(path, "utf8"),
    })),
  );
}

describe("execution publication catalog module ownership", () => {
  it("accepts the complete production source tree with live literals confined to catalog owners", async () => {
    const root = join(
      resolveCatalogSpecRepositoryRootV1(),
      "packages",
      "readiness-execution",
      "src",
    );
    const files = await listProductionTypeScriptFiles(root);

    expect(validateExecutionCatalogModuleBoundaryV1(files)).toEqual({
      ok: true,
      value: true,
    });
  });

  it.each(LIVE_OWNER_MODULES)("permits the live catalog literal family in owner %s", (path) => {
    const source = LIVE_CATALOG_LITERALS.map(
      (literal, index) => `const catalogLiteral${index} = ${JSON.stringify(literal)};`,
    ).join("\n");

    expect(validateExecutionCatalogModuleBoundaryV1([{ path, source }])).toEqual({
      ok: true,
      value: true,
    });
  });

  it.each(LIVE_CATALOG_LITERALS)(
    "rejects live catalog literal %s outside the exact owner modules",
    (literal) => {
      const result = validateExecutionCatalogModuleBoundaryV1([
        {
          path: "unrelated-execution-module.ts",
          source: `export const unrelated = ${JSON.stringify(literal)};`,
        },
      ]);

      expect(result.ok).toBe(false);
    },
  );

  it("keeps historical passive publication paths out of execution production modules", async () => {
    const root = join(
      resolveCatalogSpecRepositoryRootV1(),
      "packages",
      "readiness-execution",
      "src",
    );
    const files = await listProductionTypeScriptFiles(root);

    for (const file of files) {
      for (const literal of HISTORICAL_PASSIVE_LITERALS) {
        expect(file.source, `${file.path} contains ${literal}`).not.toContain(literal);
      }
    }
  });
});

describe("generated execution publication catalog identity", () => {
  it("publishes the exact canonical six-participant identity in lexical tuple order", () => {
    const descriptor = getExecutionCatalogFixtureDescriptorV1();
    const document = parseBindings(descriptor.bindingBytes);
    const rows = descriptor.rows.map(
      ({ capabilityId, contractVersion, implementationRevision }: CatalogDescriptorRowV1) => ({
        capabilityId,
        contractVersion,
        implementationRevision,
      }),
    );

    expect(document).toEqual({
      schemaVersion: 1,
      kind: "execution-bindings-v1",
      bindings: rows,
    });
    expect(descriptor.bindingBytes).toEqual(encodeCanonicalJsonV1(document));
    expect(rows.map((row: BindingRowV1) => row.capabilityId)).toEqual(EXPECTED_BINDING_IDS);
    expect(rows.every((row: BindingRowV1) => row.contractVersion === "1.0.0")).toBe(true);
    expect(rows).toEqual(
      [...rows].sort((left: BindingRowV1, right: BindingRowV1) =>
        [left.capabilityId, left.contractVersion, left.implementationRevision]
          .join("\u0000")
          .localeCompare(
            [right.capabilityId, right.contractVersion, right.implementationRevision].join(
              "\u0000",
            ),
          ),
      ),
    );
  });

  it("describes a complete deterministic generated dependency closure for every participant", () => {
    const descriptor = getExecutionCatalogFixtureDescriptorV1();

    expect(descriptor.rows).toHaveLength(6);
    for (const row of descriptor.rows) {
      expect(row.entryPath.length).toBeGreaterThan(0);
      expect(row.dependencyPaths.length).toBeGreaterThan(0);
      expect(row.dependencyPaths).toContain(row.entryPath);
      expect(row.dependencyPaths).toEqual([...new Set(row.dependencyPaths)].sort());
      expect(Object.keys(row.dependencyDigests).sort()).toEqual([...row.dependencyPaths].sort());
      for (const digest of Object.values(row.dependencyDigests)) {
        expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      }
    }
  });

  it("returns defensive frozen metadata without sharing mutable binding bytes", () => {
    const first = getExecutionCatalogFixtureDescriptorV1();
    const originalBytes = new Uint8Array(first.bindingBytes);

    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.rows)).toBe(true);
    for (const row of first.rows) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(Object.isFrozen(row.dependencyPaths)).toBe(true);
      expect(Object.isFrozen(row.dependencyDigests)).toBe(true);
    }

    first.bindingBytes[0] = first.bindingBytes[0]! ^ 1;
    const second = getExecutionCatalogFixtureDescriptorV1();
    expect(second.bindingBytes).toEqual(originalBytes);
    expect(second.bindingBytes).not.toBe(first.bindingBytes);
  });

  it("resolves an exact fresh release and exposes only the fixed handler table", async () => {
    const fixture = await createFixture();
    const resolved = resolveLiveExecutionContextV1(fixture.release);

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      throw new TypeError("Expected an exact release to resolve");
    }
    const handlers = getPublishedExecutionHandlersV1(resolved.value);
    expect(Object.keys(handlers)).toEqual(EXPECTED_HANDLER_IDS);
    for (const routeId of EXPECTED_HANDLER_IDS) {
      expect(handlers[routeId]).toBeDefined();
    }
    expect(assertGeneratedExecutionBindingsFreshV1()).toEqual({
      ok: true,
      value: true,
    });
  });

  it("rejects an exact-six implementation revision mutation without current-handler fallback", async () => {
    const substitutedRevision =
      "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    const currentRevision = parseBindings(getExecutionCatalogFixtureDescriptorV1().bindingBytes)
      .bindings[0]!.implementationRevision;
    expect(substitutedRevision).not.toBe(currentRevision);
    const fixture = await createFixture(
      mutateBindingBytes((document) => {
        document.bindings[0]!.implementationRevision = substitutedRevision;
      }),
    );

    expectIssueCode(resolveLiveExecutionContextV1(fixture.release), "execution.stale-authority");
  });

  it("rejects a one-byte generated dependency mutation in both freshness gates", async () => {
    const fixture = await createFixture();
    const descriptor = getExecutionCatalogFixtureDescriptorV1();
    const participant = descriptor.rows[0]!;
    const path = participant.dependencyPaths[0]!;

    await runWithExecutionCatalogConformanceV1(
      {
        mutateDependency: {
          capabilityId: participant.capabilityId,
          path,
          offset: 0,
          xorByte: 1,
        },
      },
      async () => {
        expectIssueCode(
          resolveLiveExecutionContextV1(fixture.release),
          "execution.stale-authority",
        );
        expectIssueCode(assertGeneratedExecutionBindingsFreshV1(), "execution.stale-authority");
      },
    );
  });

  it("rejects plain, copied, and proxied values as live authority", async () => {
    const fixture = await createFixture();
    const resolved = resolveLiveExecutionContextV1(fixture.release);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      throw new TypeError("Expected an exact release to resolve");
    }

    const plain = {};
    const copied = { ...resolved.value };
    const proxied = new Proxy(resolved.value, {});
    for (const value of [plain, copied, proxied]) {
      expect(() => getPublishedExecutionHandlersV1(value as never)).toThrow(TypeError);
    }
  });

  it("does not expose arbitrary handler registration or authority minting", () => {
    const publicNames = Object.keys(executionPublicApi);
    expect(publicNames.filter((name) => /register.*execution.*handler/iu.test(name))).toEqual([]);

    const conformanceNames = Object.keys(catalogConformanceApi);
    expect(
      conformanceNames.filter((name) => /(handler|register|authority|context)/iu.test(name)),
    ).toEqual([]);
  });
});

describe("live-owned execution publication selection", () => {
  it("selects and pins the exact passive release only after proving the generated closure", async () => {
    const fixture = await createFixture();
    await selectRelease(fixture.repositoryRoot, fixture.childDigest);
    const selectedRelease = await resolveRelease(fixture.repositoryRoot, fixture.childDigest);
    expect(selectedRelease).toEqual(fixture.release);
    const live = resolveLiveExecutionContextV1(selectedRelease);
    expect(live.ok).toBe(true);
    if (!live.ok) {
      throw new TypeError("Expected the selected release to resolve as live authority");
    }
    expect(Object.keys(getPublishedExecutionHandlersV1(live.value))).toEqual(EXPECTED_HANDLER_IDS);
    expect(
      new TextDecoder().decode(await readCurrentPublicationPointerBytesV1(fixture.repositoryRoot)),
    ).toContain(fixture.childDigest);
  });

  it("revalidates immediately before pointer replacement and preserves the prior pointer when stale", async () => {
    const fixture = await createFixture();
    await selectRelease(fixture.repositoryRoot, fixture.childDigest);
    const nextChild = await fixture.createChild({
      reviewer: "execution publication catalog pre-commit fixture",
    });
    const pointerBefore = await readCurrentPublicationPointerBytesV1(fixture.repositoryRoot);
    const descriptor = getExecutionCatalogFixtureDescriptorV1();
    const participant = descriptor.rows[0]!;

    await runWithExecutionCatalogConformanceV1(
      {
        mutateDependency: {
          capabilityId: participant.capabilityId,
          path: participant.dependencyPaths[0]!,
          offset: 0,
          xorByte: 1,
        },
      },
      async () => {
        const result = await selectExecutionPublicationByDigestV1(
          fixture.repositoryRoot,
          nextChild.childDigest,
        );
        expectIssueCode(result, "execution.stale-authority");
      },
    );

    expect(await readCurrentPublicationPointerBytesV1(fixture.repositoryRoot)).toEqual(
      pointerBefore,
    );
  });

  it("reproduces child release artifacts and blocker projection across old-new-old selection", async () => {
    const fixture = await createFixture();
    const nextChild = await fixture.createChild({
      reviewer: "execution publication catalog alternate child fixture",
    });
    expect(nextChild.childDigest).not.toBe(fixture.childDigest);
    const parent = requireCompatiblePublicationOk(
      await resolvePublishedSnapshotByDigest({
        repositoryRoot: fixture.repositoryRoot,
        publicationDigest: fixture.parentDigest,
      }),
      "resolve parent publication",
    );
    await selectRelease(fixture.repositoryRoot, fixture.childDigest);
    const childBefore = await resolveRelease(fixture.repositoryRoot, fixture.childDigest);
    const compositeBefore = requireOk(
      resolveCompositeReadinessSnapshot(parent, childBefore),
      "resolve composite readiness snapshot before reselection",
    );
    const projectionBefore = requireOk(
      getCompositeReadinessProjectionV1(compositeBefore),
      "project composite readiness before reselection",
    );
    const childArtifactsBefore = await snapshotPublicationArtifactsV1(
      fixture.repositoryRoot,
      fixture.childDigest,
    );

    await selectRelease(fixture.repositoryRoot, nextChild.childDigest);
    await selectRelease(fixture.repositoryRoot, fixture.childDigest);

    const childAfter = await resolveRelease(fixture.repositoryRoot, fixture.childDigest);
    const compositeAfter = requireOk(
      resolveCompositeReadinessSnapshot(parent, childAfter),
      "resolve composite readiness snapshot after reselection",
    );
    const projectionAfter = requireOk(
      getCompositeReadinessProjectionV1(compositeAfter),
      "project composite readiness after reselection",
    );
    const childArtifactsAfter = await snapshotPublicationArtifactsV1(
      fixture.repositoryRoot,
      fixture.childDigest,
    );
    const expectedCapabilities = EXPECTED_HANDLER_IDS.map((capabilityId) => ({
      capabilityId,
      state: "bound" as const,
    }));

    expect(projectionBefore).toEqual({
      parentDigest: fixture.parentDigest,
      executionDigest: fixture.childDigest,
      capabilities: expectedCapabilities,
      rules: expect.any(Array),
    });
    expect(childAfter).toEqual(childBefore);
    expect(projectionAfter).toEqual(projectionBefore);
    expect(childArtifactsAfter).toEqual(childArtifactsBefore);
  });

  it("keeps passive readiness free of a public selector or freshness token", () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        readinessPublicApi,
        "selectExecutionPublicationByDigestV1",
      ),
    ).toBe(false);
    expect(
      Object.keys(readinessPublicApi).filter((name) =>
        /freshness.*token|token.*freshness/iu.test(name),
      ),
    ).toEqual([]);
  });
});
