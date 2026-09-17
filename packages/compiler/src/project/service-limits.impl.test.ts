import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectWithControls } from "./snapshot.js";
import { DEFAULT_LIMITS } from "./reads.js";
import { freshTree, project, put, removeTree, success } from "../../test/project-fixtures.js";

describe("private project controls and path records", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
  });
  afterEach(async () => {
    await removeTree(root);
  });

  it.each([-1, 0.5, DEFAULT_LIMITS.sourceBytes + 1, NaN, Infinity])(
    "should reject invalid private source-byte limit %s before filesystem work",
    async (sourceBytes) => {
      await expect(
        loadProjectWithControls({ cwd: root }, { limits: { sourceBytes } }),
      ).rejects.toBeInstanceOf(RangeError);
    },
  );
  it("should reject zero attempts instead of silently disabling loading", async () => {
    await expect(
      loadProjectWithControls({ cwd: root }, { limits: { attempts: 0 } }),
    ).rejects.toBeInstanceOf(RangeError);
    expect(Object.isFrozen(DEFAULT_LIMITS)).toBe(true);
  });
  it("should deeply freeze the new field span on a native path failure", async () => {
    await project(root, { sourceRoot: "../outside" });
    const result = await loadProjectWithControls({ cwd: root });
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("invalid path accepted");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    const diagnostic = result.diagnostics[0]!;
    expect(Object.isFrozen(diagnostic)).toBe(true);
    expect(Object.isFrozen(diagnostic.primarySpan)).toBe(true);
    expect(diagnostic.pointer).toBe("/sourceRoot");
    expect(diagnostic.primarySpan?.sourceId).toBe("blend65.json");
  });
  it("should reject an existing dangling output symlink rather than treat it as missing", async () => {
    await project(root);
    await symlink(join(root, "missing-target"), join(root, "out"), "dir");
    const result = await loadProjectWithControls({ cwd: root });
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("unresolved output accepted");
    expect(result.diagnostics[0]?.code).toBe("PROJECT_PATH_INVALID");
  });
  it("should preserve a source-root alias spelling separately from canonical paths", async () => {
    await project(root, { sourceRoot: "alias" });
    await put(root, "data/main.blend", "raw");
    await symlink(join(root, "data"), join(root, "alias"), "dir");
    const snapshot = success(await loadProjectWithControls({ cwd: root }));
    expect(snapshot.sourceRoot).toBe(join(root, "data"));
    expect(snapshot.sources[0]?.sourceId).toBe("alias/main.blend");
    expect(snapshot.sources[0]?.resolvedPath).toBe(join(root, "data/main.blend"));
  });
  it("should not exclude a sibling that merely shares the output prefix", async () => {
    await project(root, { sourceRoot: "." });
    await mkdir(join(root, "out-other"));
    await put(root, "out-other/input.blend", "raw");
    await put(root, "out/ignored.blend", "prior");
    const snapshot = success(await loadProjectWithControls({ cwd: root }));
    expect(snapshot.sources.map((input) => input.sourceId)).toEqual([
      "out-other/input.blend",
      "src/main.blend",
    ]);
  });
});
