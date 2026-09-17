import { rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectWithControls } from "./snapshot.js";
import type { Checkpoint } from "../../test/project-fixtures.js";
import { failure, freshTree, project, put, removeTree } from "../../test/project-fixtures.js";

describe("guarded native input identity", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
  });
  afterEach(async () => {
    await removeTree(root);
  });

  // A path swap must not introduce outside bytes at any guarded input boundary.
  it.each(["before-open", "after-open", "after-read", "after-revalidation-read"] as const)(
    "should reject an outside source replacement at %s",
    async (phase: Checkpoint["phase"]) => {
      const game = join(root, "game");
      await project(game);
      await put(root, "outside.blend", "PRIVATE OUTSIDE SOURCE");
      let mutated = false;
      const result = await loadProjectWithControls(
        { cwd: game },
        {
          limits: { attempts: 1 },
          onCheckpoint: async (point) => {
            if (!mutated && point.phase === phase && point.sourceId === "src/main.blend") {
              mutated = true;
              await rename(join(game, "src/main.blend"), join(game, "saved"));
              await symlink(join(root, "outside.blend"), join(game, "src/main.blend"), "file");
            }
          },
        },
      );
      expect(mutated).toBe(true);
      expect(result.kind).toBe("failure");
      expect(result).not.toHaveProperty("snapshot");
      if (result.kind !== "failure") throw new Error("unsafe snapshot accepted");
      // The causal guard may prove an escape or first detect an identity change.
      expect(["PROJECT_PATH_INVALID", "PROJECT_CHANGED"]).toContain(result.diagnostics[0]?.code);
      failure(result, result.diagnostics[0]?.code ?? "", [root]);
      expect(JSON.stringify(result)).not.toContain("PRIVATE OUTSIDE SOURCE");
    },
  );
  // Directory containment is rechecked after the initial path resolution.
  it("should reject an outside source-root swap after path validation", async () => {
    const game = join(root, "game");
    await project(game);
    await put(root, "outside/main.blend", "PRIVATE OUTSIDE SOURCE");
    let mutated = false;
    const result = await loadProjectWithControls(
      { cwd: game },
      {
        limits: { attempts: 1 },
        onCheckpoint: async (point) => {
          if (!mutated && point.phase === "after-paths") {
            mutated = true;
            await rename(join(game, "src"), join(game, "saved"));
            await symlink(join(root, "outside"), join(game, "src"), "dir");
          }
        },
      },
    );
    expect(mutated).toBe(true);
    failure(result, "PROJECT_PATH_INVALID", [root]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE OUTSIDE SOURCE");
  });
  // A resolved source disappearing before its open is instability, not a skip.
  it("should discard a whole attempt when an inventoried source disappears", async () => {
    await project(root);
    let mutated = false;
    const result = await loadProjectWithControls(
      { cwd: root },
      {
        limits: { attempts: 1 },
        onCheckpoint: async (point) => {
          if (!mutated && point.phase === "before-open" && point.sourceId === "src/main.blend") {
            mutated = true;
            await rm(join(root, "src/main.blend"));
          }
        },
      },
    );
    expect(mutated).toBe(true);
    const diagnostics = failure(result, "PROJECT_CHANGED", [root]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toBe(
      "Project inputs changed during loading; all 1 attempts failed",
    );
  });
});
