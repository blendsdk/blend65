import { cp, link, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  prepareIncrementalBindingPublication,
  prepareIncrementalBindingPublicationReview,
  publishIncrementalBindingPublication,
} from "./binding-publication.js";
import { runWithPublicationConformance } from "./publication-conformance-v1.js";
import {
  isVerifiedSelectedPointerReplacement,
  pinPublicationDirectory,
  readSelectedPublicationPointer,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import {
  getPublishedMetadata,
  resolvePublishedSnapshot,
  resolvePublishedSnapshotByDigest,
} from "./publication-resolver.js";
import {
  createAcceptedReviewBytes,
  createCurrentOraclePublicationSpecFixture,
  type OraclePublicationSpecFixture,
} from "./test-fixtures/oracle-publication-spec-fixture.js";

const TARGET_HANDLER_IDS = Object.freeze([
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
]);

type ResolutionObservation = {
  readonly operation: "selected-resolution";
  readonly attempt: 1 | 2;
  readonly event: "start" | "success" | "failure" | "retry";
  readonly reason?: "verified-pointer-replacement";
};

async function pinSelectedDirectories(
  repositoryRoot: string,
): Promise<readonly PublicationDirectoryIdentity[]> {
  const identities: PublicationDirectoryIdentity[] = [];
  for (const path of [
    repositoryRoot,
    join(repositoryRoot, "readiness"),
    join(repositoryRoot, "readiness/publications"),
  ]) {
    const pinned = await pinPublicationDirectory(path);
    expect(pinned.ok).toBe(true);
    if (!pinned.ok) throw new TypeError("expected one retained selected-publication directory");
    identities.push(pinned.value);
  }
  return Object.freeze(identities);
}

async function preparePromotion(fixture: OraclePublicationSpecFixture) {
  const base = await resolvePublishedSnapshotByDigest({
    repositoryRoot: fixture.repositoryRoot,
    publicationDigest: fixture.publicationDigest,
  });
  expect(base.ok).toBe(true);
  if (!base.ok) throw new TypeError("expected the immutable base publication");
  const review = await prepareIncrementalBindingPublicationReview({
    repositoryRoot: fixture.repositoryRoot,
    baseSnapshot: base.value,
    targetHandlerIds: TARGET_HANDLER_IDS,
  });
  expect(review.ok).toBe(true);
  if (!review.ok) throw new TypeError("expected the incremental review request");
  const prepared = await prepareIncrementalBindingPublication({
    repositoryRoot: fixture.repositoryRoot,
    baseSnapshot: base.value,
    targetHandlerIds: TARGET_HANDLER_IDS,
    semanticReviewBytes: createAcceptedReviewBytes(review.value.request),
  });
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) throw new TypeError("expected one staged incremental capability");
  return prepared.value;
}

describe("final publication internals", () => {
  it("rejects non-canonical selected-pointer paths before filesystem access", async () => {
    const result = await readSelectedPublicationPointer(
      "readiness/publications/current-publication.json",
      256,
      [],
    );

    expect(result).toMatchObject({
      ok: false,
      kind: "invalid",
      diagnostics: [{ code: "publication.path.invalid" }],
    });
    expect(isVerifiedSelectedPointerReplacement(result)).toBe(false);
  });

  it("closes a throwing incremental-target collection without invoking accessors again", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const base = await resolvePublishedSnapshotByDigest({
      repositoryRoot: fixture.repositoryRoot,
      publicationDigest: fixture.publicationDigest,
    });
    expect(base.ok).toBe(true);
    if (!base.ok) throw new TypeError("expected the immutable base publication");
    let reads = 0;
    const targets = new Proxy(TARGET_HANDLER_IDS, {
      get(target, property, receiver): unknown {
        if (property === "length" && reads++ === 0) {
          throw new Error("injected target access failure");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    try {
      const result = await prepareIncrementalBindingPublicationReview({
        repositoryRoot: fixture.repositoryRoot,
        baseSnapshot: base.value,
        targetHandlerIds: targets,
      });

      expect(result).toMatchObject({
        ok: false,
        kind: "invalid",
        diagnostics: [{ code: "publication.targets.invalid" }],
      });
      expect(reads).toBe(1);
    } finally {
      await fixture.cleanup();
    }
  });

  it("brands a legitimate detached atomic replacement as object-bound authority", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const pointerPath = resolve(
      fixture.repositoryRoot,
      "readiness/publications/current-publication.json",
    );
    const replacementPath = `${pointerPath}.replacement`;
    try {
      await writeFile(replacementPath, fixture.pointerBytes, { flag: "wx" });
      const directories = await pinSelectedDirectories(fixture.repositoryRoot);
      const result = await runWithPublicationConformance(
        {
          async atFilesystemPoint(point, context): Promise<void> {
            if (point === "after-file-read" && context.path === pointerPath) {
              await rename(replacementPath, pointerPath);
            }
          },
        },
        () => readSelectedPublicationPointer(pointerPath, 256, directories),
      );

      expect(result.ok).toBe(false);
      expect(isVerifiedSelectedPointerReplacement(result)).toBe(true);
      expect(isVerifiedSelectedPointerReplacement(structuredClone(result))).toBe(false);
      expect(isVerifiedSelectedPointerReplacement({ ...result })).toBe(false);
    } finally {
      await fixture.cleanup();
    }
  });

  it("orders one pointer retry without exposing authority in observations", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const pointerPath = resolve(
      fixture.repositoryRoot,
      "readiness/publications/current-publication.json",
    );
    const replacementPath = `${pointerPath}.replacement`;
    const observations: ResolutionObservation[] = [];
    let replaced = false;
    try {
      await writeFile(replacementPath, fixture.pointerBytes, { flag: "wx" });
      const result = await runWithPublicationConformance(
        {
          atResolutionObservation(observation): void {
            expect(Object.isFrozen(observation)).toBe(true);
            observations.push(observation);
          },
          async atFilesystemPoint(point, context): Promise<void> {
            if (!replaced && point === "after-file-read" && context.path === pointerPath) {
              replaced = true;
              await rename(replacementPath, pointerPath);
            }
          },
        },
        () => resolvePublishedSnapshot({ repositoryRoot: fixture.repositoryRoot }),
      );

      expect(result.ok).toBe(true);
      expect(observations).toEqual([
        { operation: "selected-resolution", attempt: 1, event: "start" },
        { operation: "selected-resolution", attempt: 1, event: "failure" },
        {
          operation: "selected-resolution",
          attempt: 1,
          event: "retry",
          reason: "verified-pointer-replacement",
        },
        { operation: "selected-resolution", attempt: 2, event: "start" },
        { operation: "selected-resolution", attempt: 2, event: "success" },
      ]);
      expect(JSON.stringify(observations)).not.toContain(fixture.repositoryRoot);
      expect(JSON.stringify(observations)).not.toContain(fixture.publicationDigest);
    } finally {
      await fixture.cleanup();
    }
  });

  it.each(["start", "success"] as const)(
    "closes a throwing %s resolution observer as bounded I/O",
    async (event) => {
      const fixture = await createCurrentOraclePublicationSpecFixture();
      const observations: ResolutionObservation[] = [];
      try {
        const result = await runWithPublicationConformance(
          {
            atResolutionObservation(observation): void {
              observations.push(observation);
              if (observation.event === event) {
                throw new Error(`injected ${event} observation failure`);
              }
            },
          },
          () => resolvePublishedSnapshot({ repositoryRoot: fixture.repositoryRoot }),
        );

        expect(result).toMatchObject({
          ok: false,
          kind: "io",
          diagnostics: [{ code: "publication.io" }],
        });
        expect(observations.at(-1)?.event).toBe(event);
      } finally {
        await fixture.cleanup();
      }
    },
  );

  it("closes a throwing failure observer without leaking the original path failure", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const pointerPath = resolve(
      fixture.repositoryRoot,
      "readiness/publications/current-publication.json",
    );
    try {
      await writeFile(pointerPath, new Uint8Array([0x7b]), { flag: "w" });
      const result = await runWithPublicationConformance(
        {
          atResolutionObservation(observation): void {
            if (observation.event === "failure") {
              throw new Error("injected failure observation failure");
            }
          },
        },
        () => resolvePublishedSnapshot({ repositoryRoot: fixture.repositoryRoot }),
      );

      expect(result).toMatchObject({
        ok: false,
        kind: "io",
        diagnostics: [{ code: "publication.io" }],
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("closes a throwing retry observer after verified pointer replacement", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const pointerPath = resolve(
      fixture.repositoryRoot,
      "readiness/publications/current-publication.json",
    );
    const replacementPath = `${pointerPath}.replacement`;
    let replaced = false;
    try {
      await writeFile(replacementPath, fixture.pointerBytes, { flag: "wx" });
      const result = await runWithPublicationConformance(
        {
          atResolutionObservation(observation): void {
            if (observation.event === "retry") {
              throw new Error("injected retry observation failure");
            }
          },
          async atFilesystemPoint(point, context): Promise<void> {
            if (!replaced && point === "after-file-read" && context.path === pointerPath) {
              replaced = true;
              await rename(replacementPath, pointerPath);
            }
          },
        },
        () => resolvePublishedSnapshot({ repositoryRoot: fixture.repositoryRoot }),
      );

      expect(replaced).toBe(true);
      expect(result).toMatchObject({
        ok: false,
        kind: "io",
        diagnostics: [{ code: "publication.io" }],
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("does not retry when the retained publications directory is replaced", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const publicationsPath = resolve(fixture.repositoryRoot, "readiness/publications");
    const pointerPath = join(publicationsPath, "current-publication.json");
    const replacementPath = `${publicationsPath}.replacement`;
    const displacedPath = `${publicationsPath}.displaced`;
    const observations: ResolutionObservation[] = [];
    let replaced = false;
    try {
      await cp(publicationsPath, replacementPath, { recursive: true });
      const result = await runWithPublicationConformance(
        {
          atResolutionObservation(observation): void {
            observations.push(observation);
          },
          async atFilesystemPoint(point, context): Promise<void> {
            if (!replaced && point === "after-file-read" && context.path === pointerPath) {
              replaced = true;
              await rename(publicationsPath, displacedPath);
              await rename(replacementPath, publicationsPath);
              await rm(displacedPath, { recursive: true });
            }
          },
        },
        () => resolvePublishedSnapshot({ repositoryRoot: fixture.repositoryRoot }),
      );

      expect(result).toMatchObject({
        ok: false,
        kind: "invalid",
        diagnostics: [{ code: "publication.path.invalid" }],
      });
      expect(isVerifiedSelectedPointerReplacement(result)).toBe(false);
      expect(observations).toEqual([
        { operation: "selected-resolution", attempt: 1, event: "start" },
        { operation: "selected-resolution", attempt: 1, event: "failure" },
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("does not retry a publications-directory swap between replacement validation passes", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const publicationsPath = resolve(fixture.repositoryRoot, "readiness/publications");
    const pointerPath = join(publicationsPath, "current-publication.json");
    const pointerReplacementPath = `${pointerPath}.replacement`;
    const directoryReplacementPath = `${publicationsPath}.replacement`;
    const displacedPath = `${publicationsPath}.displaced`;
    const observations: ResolutionObservation[] = [];
    let pointerReplaced = false;
    let directoryReplaced = false;
    try {
      await cp(publicationsPath, directoryReplacementPath, { recursive: true });
      await writeFile(pointerReplacementPath, fixture.pointerBytes, { flag: "wx" });
      const result = await runWithPublicationConformance(
        {
          atResolutionObservation(observation): void {
            observations.push(observation);
          },
          async atFilesystemPoint(point, context): Promise<void> {
            if (!pointerReplaced && point === "after-file-read" && context.path === pointerPath) {
              pointerReplaced = true;
              await rename(pointerReplacementPath, pointerPath);
            }
            if (
              !directoryReplaced &&
              point === "before-selected-pointer-replacement-lstat" &&
              context.path === pointerPath
            ) {
              directoryReplaced = true;
              await rename(publicationsPath, displacedPath);
              await rename(directoryReplacementPath, publicationsPath);
              await rm(displacedPath, { recursive: true });
            }
          },
        },
        () => resolvePublishedSnapshot({ repositoryRoot: fixture.repositoryRoot }),
      );

      expect(pointerReplaced).toBe(true);
      expect(directoryReplaced).toBe(true);
      expect(result).toMatchObject({
        ok: false,
        kind: "invalid",
        diagnostics: [{ code: "publication.path.invalid", path: publicationsPath }],
      });
      expect(isVerifiedSelectedPointerReplacement(result)).toBe(false);
      expect(observations).toEqual([
        { operation: "selected-resolution", attempt: 1, event: "start" },
        { operation: "selected-resolution", attempt: 1, event: "failure" },
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("resolves a throwing replacement-inspection hook as ordinary I/O without retry", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const pointerPath = resolve(
      fixture.repositoryRoot,
      "readiness/publications/current-publication.json",
    );
    const replacementPath = `${pointerPath}.replacement`;
    const observations: ResolutionObservation[] = [];
    let pointerReplaced = false;
    let inspectionReached = false;
    try {
      await writeFile(replacementPath, fixture.pointerBytes, { flag: "wx" });
      const operation = runWithPublicationConformance(
        {
          atResolutionObservation(observation): void {
            observations.push(observation);
          },
          async atFilesystemPoint(point, context): Promise<void> {
            if (!pointerReplaced && point === "after-file-read" && context.path === pointerPath) {
              pointerReplaced = true;
              await rename(replacementPath, pointerPath);
            }
            if (
              point === "before-selected-pointer-replacement-lstat" &&
              context.path === pointerPath
            ) {
              inspectionReached = true;
              throw new Error("injected replacement inspection failure");
            }
          },
        },
        () => resolvePublishedSnapshot({ repositoryRoot: fixture.repositoryRoot }),
      );

      await expect(operation).resolves.toMatchObject({
        ok: false,
        kind: "io",
        diagnostics: [{ code: "publication.io", path: pointerPath }],
      });
      const result = await operation;
      expect(pointerReplaced).toBe(true);
      expect(inspectionReached).toBe(true);
      expect(isVerifiedSelectedPointerReplacement(result)).toBe(false);
      expect(observations).toEqual([
        { operation: "selected-resolution", attempt: 1, event: "start" },
        { operation: "selected-resolution", attempt: 1, event: "failure" },
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("does not retry when the opened pointer gains a terminal hard link", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const pointerPath = resolve(
      fixture.repositoryRoot,
      "readiness/publications/current-publication.json",
    );
    const hardLinkPath = `${pointerPath}.hard-link`;
    const replacementPath = `${pointerPath}.replacement`;
    const observations: ResolutionObservation[] = [];
    let linked = false;
    try {
      await writeFile(replacementPath, fixture.pointerBytes, { flag: "wx" });
      const result = await runWithPublicationConformance(
        {
          atResolutionObservation(observation): void {
            observations.push(observation);
          },
          async atFilesystemPoint(point, context): Promise<void> {
            if (!linked && point === "after-file-read" && context.path === pointerPath) {
              linked = true;
              await link(pointerPath, hardLinkPath);
              await rename(replacementPath, pointerPath);
            }
          },
        },
        () => resolvePublishedSnapshot({ repositoryRoot: fixture.repositoryRoot }),
      );

      expect(result).toMatchObject({
        ok: false,
        kind: "invalid",
        diagnostics: [{ code: "publication.path.invalid" }],
      });
      expect(isVerifiedSelectedPointerReplacement(result)).toBe(false);
      expect(observations).toEqual([
        { operation: "selected-resolution", attempt: 1, event: "start" },
        { operation: "selected-resolution", attempt: 1, event: "failure" },
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("does not retry a detached pointer replaced by a different-sized file", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const pointerPath = resolve(
      fixture.repositoryRoot,
      "readiness/publications/current-publication.json",
    );
    const replacementPath = `${pointerPath}.replacement`;
    const observations: ResolutionObservation[] = [];
    try {
      await writeFile(replacementPath, new Uint8Array([0x7b]), { flag: "wx" });
      const result = await runWithPublicationConformance(
        {
          atResolutionObservation(observation): void {
            observations.push(observation);
          },
          async atFilesystemPoint(point, context): Promise<void> {
            if (point === "after-file-read" && context.path === pointerPath) {
              await rename(replacementPath, pointerPath);
            }
          },
        },
        () => resolvePublishedSnapshot({ repositoryRoot: fixture.repositoryRoot }),
      );

      expect(result).toMatchObject({
        ok: false,
        kind: "invalid",
        diagnostics: [{ code: "publication.path.invalid" }],
      });
      expect(isVerifiedSelectedPointerReplacement(result)).toBe(false);
      expect(observations).toEqual([
        { operation: "selected-resolution", attempt: 1, event: "start" },
        { operation: "selected-resolution", attempt: 1, event: "failure" },
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("does not retry an identity replacement on a non-pointer publication member", async () => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const manifestPath = join(
      fixture.repositoryRoot,
      "readiness/publications/releases",
      fixture.publicationDigest,
      "manifest.json",
    );
    const replacementPath = `${manifestPath}.replacement`;
    const observations: ResolutionObservation[] = [];
    let replaced = false;
    try {
      await writeFile(replacementPath, await readFile(manifestPath), { flag: "wx" });
      const result = await runWithPublicationConformance(
        {
          atResolutionObservation(observation): void {
            observations.push(observation);
          },
          async atFilesystemPoint(point, context): Promise<void> {
            if (!replaced && point === "after-file-read" && context.path === manifestPath) {
              replaced = true;
              await rename(replacementPath, manifestPath);
            }
          },
        },
        () => resolvePublishedSnapshot({ repositoryRoot: fixture.repositoryRoot }),
      );

      expect(result).toMatchObject({
        ok: false,
        kind: "invalid",
        diagnostics: [{ code: "publication.path.invalid" }],
      });
      expect(observations).toEqual([
        { operation: "selected-resolution", attempt: 1, event: "start" },
        { operation: "selected-resolution", attempt: 1, event: "failure" },
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it.each([
    ["old", "after-pointer-temporary-sync"],
    ["new", "after-pointer-rename"],
    ["indeterminate", "after-pointer-rename"],
  ] as const)("reconciles the %s selected-state branch", async (branch, faultPoint) => {
    const fixture = await createCurrentOraclePublicationSpecFixture();
    const pointerPath = resolve(
      fixture.repositoryRoot,
      "readiness/publications/current-publication.json",
    );
    try {
      const promotion = await preparePromotion(fixture);
      let pointerWasReplaced = false;
      const result = await runWithPublicationConformance(
        {
          atFaultPoint(point): void {
            if (point !== faultPoint) return;
            if (point === "after-pointer-rename") pointerWasReplaced = true;
            throw new Error(`injected ${branch} reconciliation branch`);
          },
          atFilesystemPoint(point, context): void {
            if (
              branch === "indeterminate" &&
              pointerWasReplaced &&
              point === "before-file-read" &&
              context.path === pointerPath
            ) {
              throw new Error("injected reconciliation read failure");
            }
          },
        },
        () => publishIncrementalBindingPublication(promotion.prepared),
      );

      if (branch === "new") {
        expect(result.ok).toBe(true);
        if (!result.ok) throw new TypeError("expected committed reconciliation");
        expect(getPublishedMetadata(result.value.snapshot)?.publicationDigest).toBe(
          promotion.publicationDigest,
        );
      } else if (branch === "old") {
        expect(result).toMatchObject({ ok: false, kind: "io" });
        const selected = await resolvePublishedSnapshot({
          repositoryRoot: fixture.repositoryRoot,
        });
        expect(selected.ok).toBe(true);
        if (selected.ok) {
          expect(getPublishedMetadata(selected.value)?.publicationDigest).toBe(
            fixture.publicationDigest,
          );
        }
      } else {
        expect(result).toEqual({
          ok: false,
          kind: "commit-indeterminate",
          expectedOldPublicationDigest: fixture.publicationDigest,
          expectedNewPublicationDigest: promotion.publicationDigest,
          diagnostics: [
            {
              code: "publication.commit.indeterminate",
              path: "readiness/publications/current-publication.json",
              message: expect.any(String),
            },
          ],
        });
        expect(JSON.stringify(result)).not.toContain(fixture.repositoryRoot);
      }
    } finally {
      await fixture.cleanup();
    }
  });

  it.each(["forced", "interrupted"] as const)(
    "rejects %s staged invariant validation before pointer commit",
    async (failure) => {
      const fixture = await createCurrentOraclePublicationSpecFixture();
      try {
        const promotion = await preparePromotion(fixture);
        const result = await runWithPublicationConformance(
          {
            forceStagedValidationFailure: failure === "forced",
            atFaultPoint(point): void {
              if (failure === "interrupted" && point === "after-staged-validation") {
                throw new Error("injected staged validation interruption");
              }
            },
          },
          () => publishIncrementalBindingPublication(promotion.prepared),
        );

        expect(result).toMatchObject(
          failure === "forced"
            ? {
                ok: false,
                kind: "acceptance-failed",
                diagnostics: [{ code: "publication.acceptance.failed" }],
              }
            : {
                ok: false,
                kind: "io",
                diagnostics: [{ code: "publication.io" }],
              },
        );
        const selected = await resolvePublishedSnapshot({
          repositoryRoot: fixture.repositoryRoot,
        });
        expect(selected.ok).toBe(true);
        if (selected.ok) {
          expect(getPublishedMetadata(selected.value)?.publicationDigest).toBe(
            fixture.publicationDigest,
          );
        }
      } finally {
        await fixture.cleanup();
      }
    },
  );
});
