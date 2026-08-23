import { mkdtemp, mkdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  executionPublicationFaultPointV1,
  executionPublicationReconciliationObservationV1,
  runWithExecutionPublicationConformanceV1,
  validateExecutionPublicationModuleBoundaryV1,
} from "./execution-publication-conformance-v1.js";
import {
  CURRENT_EXECUTION_PUBLICATION_FILENAME,
  EXECUTION_PUBLICATIONS_ROOT,
  renderExecutionPublicationJson,
} from "./execution-publication-model.js";
import { inspectExecutionPublicationV1 } from "./execution-publication-transaction.js";

const temporaryRoots: string[] = [];

async function publicationRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-execution-publication-"));
  temporaryRoots.push(root);
  await mkdir(join(root, EXECUTION_PUBLICATIONS_ROOT, "releases"), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("execution publication conformance", () => {
  it("should isolate concurrent fault scopes without leaking hook authority", async () => {
    const observed: string[] = [];
    const [scoped, ordinary] = await Promise.all([
      runWithExecutionPublicationConformanceV1(
        {
          atFaultPoint(point) {
            observed.push(point);
          },
        },
        async () => {
          await Promise.resolve();
          await executionPublicationFaultPointV1("before-pointer-write");
          return "scoped";
        },
      ),
      Promise.resolve().then(async () => {
        await executionPublicationFaultPointV1("before-pointer-write");
        return "ordinary";
      }),
    ]);

    expect({ scoped, ordinary, observed }).toEqual({
      scoped: "scoped",
      ordinary: "ordinary",
      observed: ["before-pointer-write"],
    });
  });

  it("should reject duplicate sources and authority literals outside an owner", () => {
    expect(validateExecutionPublicationModuleBoundaryV1(null as never)).toMatchObject({
      ok: false,
      issues: [{ path: "/files" }],
    });
    expect(
      validateExecutionPublicationModuleBoundaryV1(
        Array.from({ length: 513 }, (_, index) => ({ path: `${index}.ts`, source: "" })),
      ),
    ).toMatchObject({ ok: false, issues: [{ path: "/files" }] });
    expect(validateExecutionPublicationModuleBoundaryV1([])).toEqual({ ok: true, value: true });
    expect(validateExecutionPublicationModuleBoundaryV1([1 as never])).toMatchObject({
      ok: false,
      issues: [{ path: "/files/0" }],
    });
    expect(
      validateExecutionPublicationModuleBoundaryV1([
        { path: "ordinary.ts", source: "export const first = true;" },
        { path: "ordinary.ts", source: "export const second = true;" },
      ]),
    ).toMatchObject({ ok: false, issues: [{ path: "/files/1" }] });
    expect(
      validateExecutionPublicationModuleBoundaryV1([
        {
          path: "ordinary.ts",
          source: 'export const location = "readiness/execution-publications";',
        },
      ]),
    ).toMatchObject({ ok: false, issues: [{ code: "execution.identity", path: "ordinary.ts" }] });

    for (const path of ["../ordinary.ts", "nested/../ordinary.ts", "/ordinary.ts"]) {
      expect(validateExecutionPublicationModuleBoundaryV1([{ path, source: "" }])).toMatchObject({
        ok: false,
        issues: [{ code: "execution.invalid-schema", path: "/files/0" }],
      });
    }

    expect(
      validateExecutionPublicationModuleBoundaryV1([
        { path: "execution-publication-resolver.ts", source: 'const legacy = "manifest.json";' },
      ]),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity", path: "execution-publication-resolver.ts" }],
    });
    expect(
      validateExecutionPublicationModuleBoundaryV1([
        {
          path: "execution-publication-resolver.ts",
          source: 'const releaseRoot = "readiness/execution-publications";',
        },
      ]),
    ).toEqual({ ok: true, value: true });
  });

  it("should isolate reconciliation observations", async () => {
    const observations: string[] = [];
    await executionPublicationReconciliationObservationV1({
      operation: "execution-publication-selection",
      expectedDigest: `sha256:${"0".repeat(64)}`,
      state: "ambiguous",
    });
    await runWithExecutionPublicationConformanceV1(
      {
        atReconciliationObservation(observation) {
          observations.push(observation.state);
        },
      },
      () =>
        executionPublicationReconciliationObservationV1({
          operation: "execution-publication-selection",
          expectedDigest: `sha256:${"1".repeat(64)}`,
          state: "committed",
        }),
    );
    expect(observations).toEqual(["committed"]);
  });

  it("should report noncanonical and linked pointers without selecting either", async () => {
    const root = await publicationRepository();
    const pointerPath = join(
      root,
      EXECUTION_PUBLICATIONS_ROOT,
      CURRENT_EXECUTION_PUBLICATION_FILENAME,
    );
    await writeFile(
      pointerPath,
      renderExecutionPublicationJson({
        schemaVersion: 1,
        kind: "execution-publication-pointer-v1",
        publicationDigest: `sha256:${"a".repeat(64)}`,
        extra: true,
      }),
    );

    const malformed = await inspectExecutionPublicationV1(root);
    expect(malformed).toMatchObject({
      ok: true,
      value: {
        releases: [],
        diagnostics: [{ code: "execution.invalid-schema" }],
      },
    });

    await unlink(pointerPath);
    await symlink("missing-pointer", pointerPath);
    const linked = await inspectExecutionPublicationV1(root);
    expect(linked).toMatchObject({
      ok: true,
      value: {
        releases: [],
        diagnostics: [{ code: "execution.identity" }],
      },
    });
  });

  it("should diagnose cleanup residue and every malformed release entry kind", async () => {
    const root = await publicationRepository();
    const publicationRoot = join(root, EXECUTION_PUBLICATIONS_ROOT);
    const releasesRoot = join(publicationRoot, "releases");
    const digest = `sha256:${"b".repeat(64)}`;
    await mkdir(join(publicationRoot, ".execution-staging.aaaaaaaa-aaaa"));
    await writeFile(join(publicationRoot, ".execution-pointer.aaaaaaaa-aaaa.tmp"), "residue");
    await writeFile(join(releasesRoot, "not-a-digest"), "malformed");
    await symlink(root, join(releasesRoot, digest));

    const inspected = await inspectExecutionPublicationV1(root);
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) throw new TypeError(inspected.issues[0].message);
    expect(inspected.value.releases).toEqual([]);
    expect(inspected.value.selectedDigest).toBeUndefined();
    expect(inspected.value.diagnostics.map(({ path }) => path).sort()).toEqual([
      "/.execution-pointer.aaaaaaaa-aaaa.tmp",
      "/.execution-staging.aaaaaaaa-aaaa",
      "/releases/not-a-digest",
      `/releases/${digest}`,
    ]);
  });
});
