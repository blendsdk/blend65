import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectWithControls } from "./snapshot.js";
import {
  failure,
  freshTree,
  manifest,
  project,
  put,
  removeTree,
  success,
} from "../../test/project-fixtures.js";

describe("bounded project input", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
  });
  afterEach(async () => {
    await removeTree(root);
  });
  const limitNames = [
    "manifestBytes",
    "sourceBytes",
    "totalBytes",
    "sourceFiles",
    "visitedEntries",
    "depth",
  ] as const;

  // Each cap admits the exact maximum and rejects the next attempted unit.
  it.each(limitNames)("should admit the exact %s maximum", async (name) => {
    await project(root);
    await put(root, "src/main.blend", "abc");
    if (name === "depth") {
      await rm(join(root, "src/main.blend"));
      await put(root, "src/nested/main.blend", "abc");
    }
    const bytes = Buffer.byteLength(manifest());
    const maximum =
      name === "manifestBytes"
        ? bytes
        : name === "sourceBytes"
          ? 3
          : name === "totalBytes"
            ? bytes + 3
            : 1;
    success(await loadProjectWithControls({ cwd: root }, { limits: { [name]: maximum } }));
  });
  // Limit diagnostics use the configured property name and exact observed count.
  it.each(limitNames)("should reject one unit beyond the %s maximum", async (name) => {
    await project(root);
    await put(root, "src/main.blend", "abc");
    if (name === "depth") {
      await rm(join(root, "src/main.blend"));
      await put(root, "src/nested/main.blend", "abc");
    }
    const bytes = Buffer.byteLength(manifest());
    const observed =
      name === "manifestBytes"
        ? bytes
        : name === "sourceBytes"
          ? 3
          : name === "totalBytes"
            ? bytes + 3
            : 1;
    const maximum = observed - 1;
    const diagnostics = failure(
      await loadProjectWithControls({ cwd: root }, { limits: { [name]: maximum } }),
      "PROJECT_HOST_LIMIT",
      [root],
    );
    expect(diagnostics.find((d) => d.code === "PROJECT_HOST_LIMIT")?.message).toBe(
      `Project host limit '${name}' exceeded: maximum ${maximum}, observed ${observed}`,
    );
  });
  // Bounded reads still enforce a size cap when an opened input grows afterwards.
  it("should reject source growth beyond the bounded read maximum", async () => {
    await project(root);
    await put(root, "src/main.blend", "abc");
    let mutated = false;
    const result = await loadProjectWithControls(
      { cwd: root },
      {
        limits: { sourceBytes: 3 },
        onCheckpoint: async (point) => {
          if (!mutated && point.phase === "after-open" && point.sourceId === "src/main.blend") {
            mutated = true;
            await writeFile(join(root, "src/main.blend"), "abcd");
          }
        },
      },
    );
    expect(mutated).toBe(true);
    const diagnostics = failure(result, "PROJECT_HOST_LIMIT", [root]);
    expect(diagnostics.find((d) => d.code === "PROJECT_HOST_LIMIT")?.message).toBe(
      "Project host limit 'sourceBytes' exceeded: maximum 3, observed 4",
    );
  });
  // Non-source entries count against traversal work, even though they are not bytes.
  it("should count ignored directory entries toward the traversal limit", async () => {
    await project(root);
    await put(root, "src/ignored.txt", "ignored");
    const diagnostics = failure(
      await loadProjectWithControls({ cwd: root }, { limits: { visitedEntries: 1 } }),
      "PROJECT_HOST_LIMIT",
      [root],
    );
    expect(diagnostics.find((d) => d.code === "PROJECT_HOST_LIMIT")?.message).toBe(
      "Project host limit 'visitedEntries' exceeded: maximum 1, observed 2",
    );
  });
});
