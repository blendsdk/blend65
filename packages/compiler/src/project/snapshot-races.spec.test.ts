import { rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectWithControls } from "./snapshot.js";
import type { Checkpoint } from "../../test/project-fixtures.js";
import {
  freshTree,
  hash,
  inputHash,
  manifest,
  project,
  put,
  removeTree,
  success,
} from "../../test/project-fixtures.js";

describe("whole-attempt snapshot coherence", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
  });
  afterEach(async () => {
    await removeTree(root);
  });

  // Source changes at every read/revalidation boundary discard the complete attempt.
  it.each([
    "after-inventory",
    "before-open",
    "after-open",
    "after-read",
    "before-revalidation",
    "after-revalidation-read",
  ] as const)("should retry a source content change at %s", async (phase: Checkpoint["phase"]) => {
    await project(root);
    let mutated = false;
    const attempts: number[] = [];
    const snapshot = success(
      await loadProjectWithControls(
        { cwd: root },
        {
          onCheckpoint: async (point) => {
            if (point.phase === "after-manifest") attempts.push(point.attempt);
            const aggregate = phase === "after-inventory" || phase === "before-revalidation";
            if (
              !mutated &&
              point.phase === phase &&
              (aggregate || point.sourceId === "src/main.blend")
            ) {
              mutated = true;
              await put(root, "src/main.blend", "new source bytes\n");
            }
          },
        },
      ),
    );
    expect(mutated).toBe(true);
    expect(attempts).toEqual([1, 2]);
    expect(snapshot.sources[0]?.text).toBe("new source bytes\n");
    expect(snapshot.sources[0]?.sha256).toBe(hash("new source bytes\n"));
    expect(snapshot.inputSha256).toBe(inputHash(snapshot));
  });
  // Changes to manifest and source must never be patched into a mixed old/new result.
  it.each([
    "after-manifest",
    "after-paths",
    "after-inventory",
    "before-revalidation",
    "after-revalidation-read",
  ] as const)(
    "should restart from the manifest after a whole-project change at %s",
    async (phase: Checkpoint["phase"]) => {
      await project(root);
      let mutated = false;
      const attempts: number[] = [];
      const snapshot = success(
        await loadProjectWithControls(
          { cwd: root },
          {
            onCheckpoint: async (point) => {
              if (point.phase === "after-manifest") attempts.push(point.attempt);
              if (
                !mutated &&
                point.phase === phase &&
                (phase !== "after-revalidation-read" || point.sourceId === "blend65.json")
              ) {
                mutated = true;
                await put(root, "blend65.json", manifest({ name: "New Name", entry: "New.Entry" }));
                await put(root, "src/main.blend", "entirely new source\n");
              }
            },
          },
        ),
      );
      expect(mutated).toBe(true);
      expect(attempts).toEqual([1, 2]);
      expect(snapshot.manifest.name).toBe("New Name");
      expect(snapshot.effectiveEntry).toBe("New.Entry");
      expect(snapshot.manifestSource.text).toBe(manifest({ name: "New Name", entry: "New.Entry" }));
      expect(snapshot.sources[0]?.text).toBe("entirely new source\n");
      expect(snapshot.inputSha256).toBe(inputHash(snapshot));
    },
  );
  // Replacing a regular-file identity, even inside the root, requires a full retry.
  it("should retry a contained source identity replacement before opening", async () => {
    await project(root);
    let mutated = false;
    const attempts: number[] = [];
    const snapshot = success(
      await loadProjectWithControls(
        { cwd: root },
        {
          onCheckpoint: async (point) => {
            if (point.phase === "after-manifest") attempts.push(point.attempt);
            if (!mutated && point.phase === "before-open" && point.sourceId === "src/main.blend") {
              mutated = true;
              await rename(join(root, "src/main.blend"), join(root, "original"));
              await put(root, "src/main.blend", "replacement");
            }
          },
        },
      ),
    );
    expect(attempts).toEqual([1, 2]);
    expect(snapshot.sources[0]?.text).toBe("replacement");
    expect(snapshot.sources[0]?.sha256).toBe(hash("replacement"));
  });
  // Repeated inventory detects additions that were absent from the first collection.
  it("should include an added source only after a complete stable retry", async () => {
    await project(root);
    let mutated = false;
    const attempts: number[] = [];
    const snapshot = success(
      await loadProjectWithControls(
        { cwd: root },
        {
          onCheckpoint: async (point) => {
            if (point.phase === "after-manifest") attempts.push(point.attempt);
            if (!mutated && point.phase === "after-inventory") {
              mutated = true;
              await put(root, "src/added.blend", "added");
            }
          },
        },
      ),
    );
    expect(attempts).toEqual([1, 2]);
    expect(snapshot.sources.map((source) => source.sourceId)).toEqual([
      "src/added.blend",
      "src/main.blend",
    ]);
    expect(snapshot.sources[0]?.sha256).toBe(hash("added"));
  });
  // A removed source is not silently patched out of an already read attempt.
  it.each(["after-read", "after-revalidation-inventory"] as const)(
    "should retry a source removal at %s",
    async (phase) => {
      await project(root);
      await put(root, "src/victim.blend", "victim");
      let mutated = false;
      const attempts: number[] = [];
      const snapshot = success(
        await loadProjectWithControls(
          { cwd: root },
          {
            onCheckpoint: async (point) => {
              if (point.phase === "after-manifest") attempts.push(point.attempt);
              if (
                !mutated &&
                point.phase === phase &&
                (phase === "after-revalidation-inventory" || point.sourceId === "src/victim.blend")
              ) {
                mutated = true;
                await rm(join(root, "src/victim.blend"));
              }
            },
          },
        ),
      );
      expect(mutated).toBe(true);
      expect(attempts).toEqual([1, 2]);
      expect(snapshot.sources.map((source) => source.sourceId)).toEqual(["src/main.blend"]);
    },
  );
  // The supplied hooks are awaited and identify every initial and revalidation read.
  it("should expose each exact checkpoint with one-based attempts and trustworthy input IDs", async () => {
    await project(root);
    const points: Checkpoint[] = [];
    success(
      await loadProjectWithControls(
        { cwd: root },
        {
          onCheckpoint: async (point) => {
            await Promise.resolve();
            points.push(point);
          },
        },
      ),
    );
    expect(points.every((point) => point.attempt === 1)).toBe(true);
    for (const phase of [
      "after-manifest",
      "after-paths",
      "after-inventory",
      "before-revalidation",
      "after-revalidation-inventory",
    ] as const)
      expect(points.filter((point) => point.phase === phase)).toEqual([
        { phase, attempt: 1, sourceId: null },
      ]);
    for (const phase of ["before-open", "after-open", "after-read"] as const)
      for (const sourceId of ["blend65.json", "src/main.blend"])
        expect(
          points.filter((point) => point.phase === phase && point.sourceId === sourceId),
        ).toHaveLength(2);
    expect(
      points
        .filter((point) => point.phase === "after-revalidation-read")
        .map((point) => point.sourceId)
        .sort(),
    ).toEqual(["blend65.json", "src/main.blend"]);
  });
});
