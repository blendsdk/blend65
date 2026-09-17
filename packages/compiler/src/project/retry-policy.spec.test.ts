import { mkdir, readlink, readdir } from "node:fs/promises";
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
  treeBytes,
} from "../../test/project-fixtures.js";

describe("bounded loading retry policy", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
  });
  afterEach(async () => {
    await removeTree(root);
  });

  // Repeated instability is bounded and exposes one root failure with no partial result.
  it.each([1, 3])(
    "should exhaust exactly %i complete attempts without beginning another",
    async (maximum) => {
      await project(root);
      await put(root, "out/current.json", "previous");
      const outputBefore = await treeBytes(join(root, "out"));
      const attempts: number[] = [];
      const result = await loadProjectWithControls(
        { cwd: root },
        {
          ...(maximum === 1 ? { limits: { attempts: 1 } } : {}),
          onCheckpoint: async (point) => {
            if (point.phase === "after-manifest") attempts.push(point.attempt);
            if (point.phase === "before-revalidation")
              await put(root, "src/main.blend", `changed attempt ${point.attempt}`);
          },
        },
      );
      expect(attempts).toEqual(Array.from({ length: maximum }, (_, index) => index + 1));
      const diagnostics = failure(result, "PROJECT_CHANGED", [root]);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.message).toBe(
        `Project inputs changed during loading; all ${maximum} attempts failed`,
      );
      expect(await treeBytes(join(root, "out"))).toEqual(outputBefore);
    },
  );
  // Invalid configuration and native safety failures are not retryable instability.
  it.each(["schema", "type", "escape", "limit"])(
    "should fail %s directly without retrying",
    async (kind) => {
      await project(
        root,
        kind === "schema"
          ? { schemaVersion: 2 }
          : kind === "type"
            ? { sourceRoot: 7 }
            : kind === "escape"
              ? { sourceRoot: "../outside" }
              : {},
      );
      const attempts: number[] = [];
      const result = await loadProjectWithControls(
        { cwd: root },
        {
          ...(kind === "limit" ? { limits: { sourceFiles: 0 } } : {}),
          onCheckpoint: (point) => {
            attempts.push(point.attempt);
          },
        },
      );
      failure(
        result,
        kind === "schema" || kind === "type"
          ? "PROJECT_MANIFEST_FIELD"
          : kind === "escape"
            ? "PROJECT_PATH_INVALID"
            : "PROJECT_HOST_LIMIT",
        [root],
      );
      expect(attempts.every((attempt) => attempt === 1)).toBe(true);
    },
  );
  // A changed manifest is reparsed on retry, so a newly invalid state cannot succeed.
  it("should return the new invalid manifest rather than an old usable snapshot", async () => {
    await project(root);
    let mutated = false;
    const attempts: number[] = [];
    const result = await loadProjectWithControls(
      { cwd: root },
      {
        onCheckpoint: async (point) => {
          if (point.phase === "after-manifest") attempts.push(point.attempt);
          if (!mutated && point.phase === "before-revalidation") {
            mutated = true;
            await put(root, "blend65.json", manifest({ schemaVersion: 2 }));
          }
        },
      },
    );
    failure(result, "PROJECT_MANIFEST_FIELD", [root]);
    expect(attempts.every((attempt) => attempt <= 2)).toBe(true);
  });
  // Test exceptions remain programmer failures and opened handles are closed afterwards.
  it.runIf(process.platform === "linux")(
    "should propagate a checkpoint exception and close the opened input handle",
    async () => {
      await project(root);
      const path = join(root, "src/main.blend");
      const sentinel = new Error("fixture checkpoint failed");
      let sawOpenedHandle = false;
      /** Read native descriptor targets, tolerating only descriptors closed during enumeration. */
      async function openPaths(): Promise<string[]> {
        const paths: string[] = [];
        for (const name of await readdir("/proc/self/fd")) {
          try {
            paths.push(await readlink(`/proc/self/fd/${name}`));
          } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
              throw error;
          }
        }
        return paths;
      }
      await expect(
        loadProjectWithControls(
          { cwd: root },
          {
            onCheckpoint: async (point) => {
              if (point.phase === "after-open" && point.sourceId === "src/main.blend") {
                sawOpenedHandle = (await openPaths()).includes(path);
                throw sentinel;
              }
            },
          },
        ),
      ).rejects.toBe(sentinel);
      expect(sawOpenedHandle).toBe(true);
      expect(await openPaths()).not.toContain(path);
    },
  );
  // Exhausted attempts cannot create a formerly absent output location.
  it("should never create missing output even when every attempt is unstable", async () => {
    await project(root, { outDir: "missing/output" });
    await mkdir(join(root, "caller"));
    let attempted = 0;
    const result = await loadProjectWithControls(
      { cwd: root },
      {
        onCheckpoint: async (point) => {
          if (point.phase === "before-revalidation") {
            attempted++;
            await put(root, "src/main.blend", `attempt ${attempted}`);
          }
        },
      },
    );
    failure(result, "PROJECT_CHANGED", [root]);
    expect(attempted).toBe(3);
    expect((await readdir(root)).sort()).toEqual(["blend65.json", "caller", "src"]);
  });
});
