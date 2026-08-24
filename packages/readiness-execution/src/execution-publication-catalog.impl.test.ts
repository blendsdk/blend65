import {
  appendFileSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { prepareExecutionPublicationCandidateV1 } from "@blend65/readiness";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertGeneratedExecutionBindingsFreshV1,
  getPublishedExecutionHandlersV1,
  parseExecutionSelectionPointerForConformanceV1,
  resolveLiveExecutionContextV1,
  selectExecutionPublicationByDigestV1,
} from "./execution-publication-catalog.js";
import {
  computeExecutionCatalogStateV1,
  executionCatalogSelectionFaultPointV1,
  executionCatalogSelectionReconciliationObservationV1,
  getExecutionCatalogFixtureDescriptorV1,
  runExecutionCatalogDependencyFaultBoundaryV1,
  runWithExecutionCatalogConformanceV1,
  shouldFailExecutionCatalogDirectorySyncV1,
  validateExecutionCatalogDependencyPathForConformanceV1,
  validateExecutionCatalogModuleBoundaryV1,
} from "./execution-publication-catalog-conformance-v1.js";
import {
  createExecutionPublicationCatalogFixtureV1,
  encodeCanonicalJsonV1,
  readCurrentPublicationPointerBytesV1,
  type ExecutionPublicationCatalogFixtureV1,
} from "./test-fixtures/execution-publication-catalog-spec-fixture.js";

const fixtures: ExecutionPublicationCatalogFixtureV1[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

async function createFixture(): Promise<ExecutionPublicationCatalogFixtureV1> {
  const fixture = await createExecutionPublicationCatalogFixtureV1();
  fixtures.push(fixture);
  return fixture;
}

describe("execution publication catalog implementation", () => {
  it("should reject forged live capabilities and noncanonical selection pointers", async () => {
    expect(resolveLiveExecutionContextV1(Object.freeze({}) as never)).toMatchObject({
      ok: false,
      issues: [{ code: "execution.stale-authority" }],
    });
    expect(() => getPublishedExecutionHandlersV1(Object.freeze({}) as never)).toThrow(TypeError);
    expect(() => getPublishedExecutionHandlersV1(null as never)).toThrow(TypeError);
    expect(() => getPublishedExecutionHandlersV1(1 as never)).toThrow(TypeError);

    const descriptor = getExecutionCatalogFixtureDescriptorV1();
    const row = descriptor.rows[0]!;
    const path = row.dependencyPaths[0]!;
    const stale = await runWithExecutionCatalogConformanceV1(
      {
        mutateDependency: {
          capabilityId: row.capabilityId,
          path,
          offset: 0,
          xorByte: 1,
        },
      },
      () => resolveLiveExecutionContextV1(Object.freeze({}) as never),
    );
    expect(stale).toMatchObject({ ok: false });

    const digest = `sha256:${"1".repeat(64)}`;
    const canonical = new TextEncoder().encode(
      `${JSON.stringify({
        schemaVersion: 1,
        kind: "execution-publication-pointer-v1",
        publicationDigest: digest,
      })}\n`,
    );
    expect(parseExecutionSelectionPointerForConformanceV1(canonical)).toBe(digest);
    for (const source of [
      "{not-json\n",
      "null\n",
      "[]\n",
      "{}\n",
      `${JSON.stringify({ schemaVersion: 2, kind: "execution-publication-pointer-v1", publicationDigest: digest })}\n`,
      `${JSON.stringify({ schemaVersion: 1, kind: "wrong", publicationDigest: digest })}\n`,
      `${JSON.stringify({ schemaVersion: 1, kind: "execution-publication-pointer-v1", publicationDigest: 1 })}\n`,
      `${JSON.stringify({ schemaVersion: 1, kind: "execution-publication-pointer-v1", publicationDigest: "bad" })}\n`,
      `${JSON.stringify({ schemaVersion: 1, kind: "execution-publication-pointer-v1", publicationDigest: digest, extra: true })}\n`,
      `${new TextDecoder().decode(canonical).trim()} \n`,
    ]) {
      expect(parseExecutionSelectionPointerForConformanceV1(new TextEncoder().encode(source))).toBe(
        undefined,
      );
    }

    await expect(
      selectExecutionPublicationByDigestV1("/definitely/missing/repository", "not-a-digest"),
    ).resolves.toMatchObject({ ok: false });
  });

  it("should reconstruct every generated revision from the current dependency bytes", () => {
    const current = computeExecutionCatalogStateV1();
    expect(current.ok).toBe(true);
    expect(assertGeneratedExecutionBindingsFreshV1()).toEqual({ ok: true, value: true });
    if (!current.ok) throw new TypeError(current.issues[0].message);
    expect(current.value.rows).toHaveLength(6);
    expect(current.value.rows.map((row) => row.capabilityId)).toEqual([
      "acme",
      "cli",
      "compiler-api",
      "emit",
      "frontend",
      "vice",
    ]);
    expect(current.value.rows[0]!.dependencyPaths).not.toContain(
      "packages/readiness/dist/index.js",
    );
    expect(
      current.value.rows[0]!.dependencyPaths.some((path) =>
        path.startsWith("node_modules/typescript/"),
      ),
    ).toBe(false);
  });

  it("should reject an out-of-range scoped dependency mutation", async () => {
    const descriptor = getExecutionCatalogFixtureDescriptorV1();
    const row = descriptor.rows[0]!;
    const path = row.dependencyPaths[0]!;
    const result = await runWithExecutionCatalogConformanceV1(
      {
        mutateDependency: {
          capabilityId: row.capabilityId,
          path,
          offset: Number.MAX_SAFE_INTEGER,
          xorByte: 1,
        },
      },
      () => computeExecutionCatalogStateV1(),
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "execution.stale-authority", path: `/dependencies/${path}` }],
    });
  });

  it("should keep mutation scope isolated across concurrent catalog checks", async () => {
    const descriptor = getExecutionCatalogFixtureDescriptorV1();
    const row = descriptor.rows[0]!;
    const path = row.dependencyPaths[0]!;
    const [mutated, ordinary] = await Promise.all([
      runWithExecutionCatalogConformanceV1(
        {
          mutateDependency: {
            capabilityId: row.capabilityId,
            path,
            offset: 0,
            xorByte: 1,
          },
        },
        async () => {
          await Promise.resolve();
          return assertGeneratedExecutionBindingsFreshV1();
        },
      ),
      Promise.resolve().then(() => assertGeneratedExecutionBindingsFreshV1()),
    ]);
    expect(mutated).toMatchObject({ ok: false });
    expect(ordinary).toEqual({ ok: true, value: true });
  });

  it("should fail closed for malformed mutation and dependency fault controls", async () => {
    const descriptor = getExecutionCatalogFixtureDescriptorV1();
    const row = descriptor.rows[0]!;
    const path = row.dependencyPaths[0]!;
    for (const mutation of [
      { capabilityId: "unknown", path, offset: 0, xorByte: 1 },
      { capabilityId: row.capabilityId, path, offset: -1, xorByte: 1 },
      { capabilityId: row.capabilityId, path, offset: 0, xorByte: 0 },
      { capabilityId: row.capabilityId, path, offset: 0, xorByte: 256 },
    ]) {
      const result = await runWithExecutionCatalogConformanceV1(
        { mutateDependency: mutation },
        () => computeExecutionCatalogStateV1(),
      );
      expect(result).toMatchObject({ ok: false });
    }

    const faulted = await runWithExecutionCatalogConformanceV1(
      {
        atDependencyRead() {
          throw new TypeError("injected dependency fault");
        },
      },
      () => runExecutionCatalogDependencyFaultBoundaryV1(),
    );
    expect(faulted).toMatchObject({
      ok: false,
      issues: [{ code: "execution.stale-authority", path: "/dependencies" }],
    });
    const reconstructed = await runWithExecutionCatalogConformanceV1(
      {
        atDependencyRead() {
          throw new TypeError("injected dependency fault");
        },
      },
      () => computeExecutionCatalogStateV1(),
    );
    expect(reconstructed).toMatchObject({ ok: false });

    await runWithExecutionCatalogConformanceV1(
      {
        mutateDependency: {
          capabilityId: row.capabilityId,
          path,
          offset: 0,
          xorByte: 1,
        },
      },
      () => expect(() => getExecutionCatalogFixtureDescriptorV1()).toThrow(),
    );
  });

  it("should isolate live selection fault, reconciliation, and durability controls", async () => {
    const points: string[] = [];
    const observations: string[] = [];
    await runWithExecutionCatalogConformanceV1(
      {
        failDirectorySyncAttempts: 1,
        atSelectionFaultPoint(point) {
          points.push(point);
        },
        atSelectionReconciliationObservation(observation) {
          observations.push(observation.state);
        },
      },
      async () => {
        expect(shouldFailExecutionCatalogDirectorySyncV1(1)).toBe(true);
        expect(shouldFailExecutionCatalogDirectorySyncV1(2)).toBe(false);
        await executionCatalogSelectionFaultPointV1("before-pointer-write", { exact: true });
        await executionCatalogSelectionReconciliationObservationV1({
          operation: "execution-publication-selection",
          expectedDigest: `sha256:${"0".repeat(64)}`,
          state: "ambiguous",
        });
      },
    );
    expect(points).toEqual(["before-pointer-write"]);
    expect(observations).toEqual(["ambiguous"]);

    const shared = globalThis as typeof globalThis & {
      readonly __blend65ExecutionPublicationConformanceV1?: {
        run<T>(store: object, operation: () => T): T;
      };
    };
    const readinessPoints: string[] = [];
    const readinessObservations: string[] = [];
    const readinessScope = shared.__blend65ExecutionPublicationConformanceV1;
    if (readinessScope === undefined) throw new TypeError("readiness conformance scope is absent");
    await readinessScope.run(
      {
        atFaultPoint(point: string) {
          readinessPoints.push(point);
        },
        atReconciliationObservation(observation: { readonly state: string }) {
          readinessObservations.push(observation.state);
        },
      },
      async () => {
        await executionCatalogSelectionFaultPointV1("before-pointer-rename");
        await executionCatalogSelectionReconciliationObservationV1({
          operation: "execution-publication-selection",
          expectedDigest: `sha256:${"1".repeat(64)}`,
          selectedDigest: `sha256:${"2".repeat(64)}`,
          state: "prior-selection",
        });
      },
    );
    expect(readinessPoints).toEqual(["before-pointer-rename"]);
    expect(readinessObservations).toEqual(["prior-selection"]);

    for (const count of [-1, 0, 1.5, 3, Number.NaN]) {
      await runWithExecutionCatalogConformanceV1({ failDirectorySyncAttempts: count }, () =>
        expect(shouldFailExecutionCatalogDirectorySyncV1(1)).toBe(false),
      );
    }
  });

  it("should reject unavailable and substituted emitted dependency paths", () => {
    const distRoot = resolve(import.meta.dirname, "../dist");
    const relativePrefix = "packages/readiness-execution/dist/catalog-conformance-temporary";
    const ordinaryPath = join(distRoot, "catalog-conformance-temporary.js");
    const linkPath = join(distRoot, "catalog-conformance-temporary-link.js");
    const hardLinkPath = join(distRoot, "catalog-conformance-temporary-hard.js");
    const directoryPath = join(distRoot, "catalog-conformance-temporary-directory.js");
    try {
      writeFileSync(ordinaryPath, "export const temporary = true;\n", {
        mode: 0o600,
        flag: "wx",
      });
      expect(
        validateExecutionCatalogDependencyPathForConformanceV1(`${relativePrefix}.js`),
      ).toEqual({ ok: true, value: true });
      symlinkSync(ordinaryPath, linkPath);
      expect(
        validateExecutionCatalogDependencyPathForConformanceV1(`${relativePrefix}-link.js`),
      ).toMatchObject({ ok: false });
      linkSync(ordinaryPath, hardLinkPath);
      expect(
        validateExecutionCatalogDependencyPathForConformanceV1(`${relativePrefix}-hard.js`),
      ).toMatchObject({ ok: false });
      mkdirSync(directoryPath);
      expect(
        validateExecutionCatalogDependencyPathForConformanceV1(`${relativePrefix}-directory.js`),
      ).toMatchObject({ ok: false });
      expect(
        validateExecutionCatalogDependencyPathForConformanceV1(`${relativePrefix}-missing.js`),
      ).toMatchObject({ ok: false });
      expect(validateExecutionCatalogDependencyPathForConformanceV1("../escaped.js")).toMatchObject(
        { ok: false },
      );
    } finally {
      for (const path of [linkPath, hardLinkPath, ordinaryPath, directoryPath]) {
        rmSync(path, { recursive: true, force: true });
      }
    }
  });

  it("should scan each unique generated dependency exactly once per freshness decision", async () => {
    const descriptor = getExecutionCatalogFixtureDescriptorV1();
    const counts = new Map<string, number>();
    const result = await runWithExecutionCatalogConformanceV1(
      {
        atDependencyRead(path) {
          counts.set(path, (counts.get(path) ?? 0) + 1);
        },
      },
      () => computeExecutionCatalogStateV1(),
    );
    expect(result.ok).toBe(true);
    const expectedPaths = new Set([
      ...descriptor.rows.flatMap((row) => row.dependencyPaths),
      ...descriptor.runnerDependencyPaths,
    ]);
    expect([...counts]).toHaveLength(expectedPaths.size);
    expect([...counts.values()].every((count) => count === 1)).toBe(true);
  });

  it("should join review revision to the parent and prove directory durability", async () => {
    const fixture = await createFixture();
    const staleReview = JSON.parse(new TextDecoder().decode(fixture.semanticReviewBytes));
    staleReview.specRevision = `sha256:${"0".repeat(64)}`;
    expect(
      await prepareExecutionPublicationCandidateV1({
        repositoryRoot: fixture.repositoryRoot,
        parentDigest: fixture.parentDigest,
        bindingBytes: fixture.bindingBytes,
        semanticReviewBytes: encodeCanonicalJsonV1(staleReview),
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "execution.stale-authority", path: "/specRevision" }],
    });

    const faultPoints: string[] = [];
    const retried = await runWithExecutionCatalogConformanceV1(
      {
        failDirectorySyncAttempts: 1,
        atSelectionFaultPoint(point) {
          faultPoints.push(point);
        },
      },
      () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
    );
    expect(retried.ok).toBe(true);
    if (!retried.ok) throw new TypeError(retried.issues[0].message);
    expect(retried.value).not.toBe(fixture.release);
    expect(faultPoints).toEqual([
      "before-pointer-write",
      "after-pointer-file-sync",
      "before-pointer-rename",
      "after-pointer-rename",
      "after-pointer-directory-sync",
    ]);

    for (const point of [
      "before-pointer-write",
      "after-pointer-file-sync",
      "before-pointer-rename",
      "after-pointer-rename",
      "after-pointer-directory-sync",
    ] as const) {
      const faulted = await runWithExecutionCatalogConformanceV1(
        {
          atSelectionFaultPoint(current) {
            if (current === point) throw new TypeError(`injected ${point}`);
          },
        },
        () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
      );
      expect(faulted).toMatchObject({
        ok: false,
        issues: [
          {
            code:
              point === "after-pointer-rename" || point === "after-pointer-directory-sync"
                ? "execution.reconciliation"
                : "execution.io",
          },
        ],
      });
    }
    const dependencyFault = await runWithExecutionCatalogConformanceV1(
      {
        atDependencyRead() {
          throw new TypeError("injected dependency boundary failure");
        },
      },
      () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
    );
    expect(dependencyFault).toMatchObject({ ok: false });

    const next = await fixture.createChild({ reviewer: "durability retry implementation test" });
    const indeterminate = await runWithExecutionCatalogConformanceV1(
      {
        failDirectorySyncAttempts: 2,
        atSelectionFaultPoint(point) {
          if (point === "during-reconciliation") {
            throw new TypeError("injected reconciliation fault");
          }
        },
      },
      () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, next.childDigest),
    );
    expect(indeterminate).toMatchObject({
      ok: false,
      issues: [{ code: "execution.reconciliation" }],
    });
    expect(
      new TextDecoder().decode(await readCurrentPublicationPointerBytesV1(fixture.repositoryRoot)),
    ).toContain(next.childDigest);
  });

  it("should reject parent-pointer and parent-source changes in the final synchronous guard", async () => {
    {
      const fixture = await createFixture();
      const parentPointer = join(
        fixture.repositoryRoot,
        "readiness/publications/current-publication.json",
      );
      const original = readFileSync(parentPointer);
      for (const bytes of [
        encodeCanonicalJsonV1({
          schemaVersion: 1,
          publicationDigest: `sha256:${"f".repeat(64)}`,
        }),
        new TextEncoder().encode("{not-json\n"),
        new TextEncoder().encode(
          `${JSON.stringify({ schemaVersion: 1, publicationDigest: fixture.parentDigest })} \n`,
        ),
      ]) {
        let changed = false;
        const result = await runWithExecutionCatalogConformanceV1(
          {
            atDependencyRead() {
              if (changed) return;
              changed = true;
              writeFileSync(parentPointer, bytes);
            },
          },
          () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
        );
        expect(result).toMatchObject({
          ok: false,
          issues: [{ code: "execution.stale-authority", path: "/parentDigest" }],
        });
        writeFileSync(parentPointer, original);
      }
    }

    {
      const fixture = await createFixture();
      const parentSource = join(
        fixture.repositoryRoot,
        "packages/readiness/src/publication-resolver.ts",
      );
      const original = readFileSync(parentSource);
      let changed = false;
      const result = await runWithExecutionCatalogConformanceV1(
        {
          atDependencyRead() {
            if (changed) return;
            changed = true;
            appendFileSync(parentSource, "\n");
          },
        },
        () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
      );
      expect(result).toMatchObject({
        ok: false,
        issues: [
          {
            code: "execution.stale-authority",
            path: "/packages/readiness/src/publication-resolver.ts",
          },
        ],
      });
      writeFileSync(parentSource, original);

      const retainedPath = `${parentSource}.retained`;
      changed = false;
      const missing = await runWithExecutionCatalogConformanceV1(
        {
          atDependencyRead() {
            if (changed) return;
            changed = true;
            renameSync(parentSource, retainedPath);
          },
        },
        () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
      );
      expect(missing).toMatchObject({ ok: false });
      renameSync(retainedPath, parentSource);
    }
  });

  it("should reject child-member and child-directory replacement in the final guard", async () => {
    {
      const fixture = await createFixture();
      const memberPath = join(
        fixture.repositoryRoot,
        "readiness/execution-publications/releases",
        fixture.childDigest,
        "execution-bindings-v1.json",
      );
      const original = readFileSync(memberPath);
      let changed = false;
      const result = await runWithExecutionCatalogConformanceV1(
        {
          atDependencyRead() {
            if (changed) return;
            changed = true;
            const mutated = Buffer.from(original);
            mutated[0] = mutated[0]! ^ 1;
            writeFileSync(memberPath, mutated);
          },
        },
        () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
      );
      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: "execution.stale-authority" }],
      });
      writeFileSync(memberPath, original);

      const releaseRoot = join(
        fixture.repositoryRoot,
        "readiness/execution-publications/releases",
        fixture.childDigest,
      );
      const extraPath = join(releaseRoot, "unexpected.json");
      changed = false;
      const extra = await runWithExecutionCatalogConformanceV1(
        {
          atDependencyRead() {
            if (changed) return;
            changed = true;
            writeFileSync(extraPath, "{}\n");
          },
        },
        () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
      );
      expect(extra).toMatchObject({
        ok: false,
        issues: [{ code: "execution.identity", path: "/digest" }],
      });
      rmSync(extraPath);

      const retainedRoot = `${releaseRoot}.retained`;
      changed = false;
      const missing = await runWithExecutionCatalogConformanceV1(
        {
          atDependencyRead() {
            if (changed) return;
            changed = true;
            renameSync(releaseRoot, retainedRoot);
          },
        },
        () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
      );
      expect(missing).toMatchObject({
        ok: false,
        issues: [{ code: "execution.io", path: "/digest" }],
      });
      renameSync(retainedRoot, releaseRoot);
    }

    {
      const fixture = await createFixture();
      const releaseRoot = join(
        fixture.repositoryRoot,
        "readiness/execution-publications/releases",
        fixture.childDigest,
      );
      let changed = false;
      const result = await runWithExecutionCatalogConformanceV1(
        {
          atDependencyRead() {
            if (changed) return;
            changed = true;
            renameSync(releaseRoot, `${releaseRoot}.retained`);
            mkdirSync(releaseRoot, { mode: 0o700 });
          },
        },
        () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
      );
      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: "execution.identity", path: "/digest" }],
      });
    }
  });

  it("should retain the exact temporary file identity through the immediate rename", async () => {
    const fixture = await createFixture();
    const publicationRoot = join(fixture.repositoryRoot, "readiness/execution-publications");
    let replaced = false;
    const result = await runWithExecutionCatalogConformanceV1(
      {
        atSelectionFaultPoint(point) {
          if (point !== "before-pointer-rename" || replaced) return;
          replaced = true;
          const temporaryName = readdirSync(publicationRoot).find(
            (name) => name.startsWith(`.execution-${"pointer."}`) && name.endsWith(".tmp"),
          );
          if (temporaryName === undefined) throw new TypeError("selection temporary is missing");
          const temporaryPath = join(publicationRoot, temporaryName);
          const bytes = readFileSync(temporaryPath);
          renameSync(temporaryPath, `${temporaryPath}.retained`);
          writeFileSync(temporaryPath, bytes, { mode: 0o600, flag: "wx" });
        },
      },
      () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
    );
    expect(replaced).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity" }],
    });

    replaced = false;
    const changedBytes = await runWithExecutionCatalogConformanceV1(
      {
        atSelectionFaultPoint(point) {
          if (point !== "before-pointer-rename" || replaced) return;
          replaced = true;
          const temporaryName = readdirSync(publicationRoot).find(
            (name) => name.startsWith(`.execution-${"pointer."}`) && name.endsWith(".tmp"),
          );
          if (temporaryName === undefined) throw new TypeError("selection temporary is missing");
          const temporaryPath = join(publicationRoot, temporaryName);
          const bytes = readFileSync(temporaryPath);
          bytes[0] = bytes[0]! ^ 1;
          writeFileSync(temporaryPath, bytes);
        },
      },
      () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
    );
    expect(changedBytes).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity" }],
    });

    const pointerPath = join(publicationRoot, "current-execution-publication.json");
    replaced = false;
    const blockedRename = await runWithExecutionCatalogConformanceV1(
      {
        atSelectionFaultPoint(point) {
          if (point !== "before-pointer-rename" || replaced) return;
          replaced = true;
          mkdirSync(pointerPath);
        },
      },
      () => selectExecutionPublicationByDigestV1(fixture.repositoryRoot, fixture.childDigest),
    );
    expect(blockedRename).toMatchObject({
      ok: false,
      issues: [{ code: "execution.io" }],
    });
    rmSync(pointerPath, { recursive: true });
  });

  it("should reject duplicate source paths and oversized boundary scans", () => {
    expect(
      validateExecutionCatalogModuleBoundaryV1([
        { path: "ordinary.ts", source: "export const first = true;" },
        { path: "ordinary.ts", source: "export const second = true;" },
      ]),
    ).toMatchObject({ ok: false, issues: [{ path: "/files/1" }] });

    expect(
      validateExecutionCatalogModuleBoundaryV1(
        Array.from({ length: 513 }, (_, index) => ({
          path: `ordinary-${index}.ts`,
          source: "",
        })),
      ),
    ).toMatchObject({ ok: false, issues: [{ path: "/files" }] });

    for (const path of ["../ordinary.ts", "nested/../ordinary.ts", "/ordinary.ts"]) {
      expect(validateExecutionCatalogModuleBoundaryV1([{ path, source: "" }])).toMatchObject({
        ok: false,
        issues: [{ path: "/files/0" }],
      });
    }

    expect(
      validateExecutionCatalogModuleBoundaryV1([
        {
          path: "execution-publication-catalog.ts",
          source:
            'export const owner = "execution-handler-catalog-v1 execution-publication-pointer-v1";',
        },
      ]),
    ).toEqual({ ok: true, value: true });
    for (const [path, source] of [
      [
        "nested/execution-publication-catalog.ts",
        'export const x = "execution-handler-catalog-v1";',
      ],
      [
        "execution-handler-catalog.generated.ts",
        'export const x = "execution-publication-pointer-v1";',
      ],
      ["ordinary.ts", 'export const x = "execution-bindings-generated-v1";'],
    ] as const) {
      expect(validateExecutionCatalogModuleBoundaryV1([{ path, source }])).toMatchObject({
        ok: false,
        issues: [{ code: "execution.stale-authority", path }],
      });
    }
    expect(
      validateExecutionCatalogModuleBoundaryV1([
        { path: "ordinary.ts", source: "publication-pointer-v1-with-legitimate-suffix" },
      ]),
    ).toMatchObject({ ok: false });
    expect(
      validateExecutionCatalogModuleBoundaryV1([
        { path: 1, source: "" } as unknown as { path: string; source: string },
      ]),
    ).toMatchObject({ ok: false });
    expect(validateExecutionCatalogDependencyPathForConformanceV1("ordinary.ts")).toMatchObject({
      ok: false,
    });
  });
});
