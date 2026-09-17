import { readlink, readdir } from "node:fs/promises";
import { sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectWithControls } from "./snapshot.js";
import { freshTree, project, put, removeTree } from "../../test/project-fixtures.js";

/** Inspect only descriptors owned by the real fixture, tolerating concurrently closed descriptors. */
async function fixtureHandles(root: string): Promise<readonly string[]> {
  const paths: string[] = [];
  for (const name of await readdir("/proc/self/fd")) {
    try {
      const target = await readlink("/proc/self/fd/" + name);
      if (target === root || target.startsWith(root + sep)) paths.push(target);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  return paths;
}

describe.runIf(process.platform === "linux")("native descriptor cleanup", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
    await project(root);
  });
  afterEach(async () => {
    await removeTree(root);
  });

  it.each(["after-open", "after-read", "after-revalidation-read"] as const)(
    "should close the real source descriptor when a callback fails at %s",
    async (phase) => {
      const sentinel = Object.assign(new Error("fixture callback failed"), { code: "EACCES" });
      await expect(
        loadProjectWithControls(
          { cwd: root },
          {
            onCheckpoint: async (point) => {
              if (point.phase === phase && point.sourceId === "src/main.blend") {
                expect((await fixtureHandles(root)).length).toBeGreaterThan(0);
                throw sentinel;
              }
            },
          },
        ),
      ).rejects.toBe(sentinel);
      expect(await fixtureHandles(root)).toEqual([]);
    },
  );
  it("should close the directory iterator on a visited-entry limit failure", async () => {
    const result = await loadProjectWithControls({ cwd: root }, { limits: { visitedEntries: 0 } });
    expect(result.kind).toBe("failure");
    expect(await fixtureHandles(root)).toEqual([]);
  });
  it("should close an input handle when fatal decoding fails", async () => {
    await put(root, "src/main.blend", Uint8Array.of(0xff));
    const result = await loadProjectWithControls({ cwd: root });
    expect(result.kind).toBe("failure");
    expect(await fixtureHandles(root)).toEqual([]);
  });
});
