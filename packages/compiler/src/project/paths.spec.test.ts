import { link, mkdir, readFile, readdir, symlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  failure,
  denyRead,
  freshTree,
  load,
  project,
  put,
  removeTree,
  success,
  treeBytes,
} from "../../test/project-fixtures.js";

describe("project path containment", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
  });
  afterEach(async () => {
    await removeTree(root);
  });

  // Every content path is manifest-relative and may not select an absolute input.
  it.each(["sourceRoot", "assetPaths", "outDir"])(
    "should reject absolute %s content paths",
    async (key) => {
      await project(root, {
        [key]: key === "assetPaths" ? [join(root, "src")] : join(root, "src"),
      });
      failure(await load({ cwd: root }), "PROJECT_PATH_INVALID", [root]);
    },
  );
  // Lexical containment uses components, not a string prefix shared by a sibling.
  it.each(["sourceRoot", "assetPaths", "outDir"])(
    "should reject an escaping %s path",
    async (key) => {
      await project(join(root, "game"), {
        [key]: key === "assetPaths" ? ["../game-sibling"] : "../game-sibling",
      });
      await put(root, "game-sibling/outside.blend", "outside");
      failure(await load({ cwd: join(root, "game") }), "PROJECT_PATH_INVALID", [root]);
    },
  );
  // Internal parent components are not a reason to reject contained ordinary paths.
  it("should admit contained parent components in content paths", async () => {
    await project(root, {
      sourceRoot: "folder/../src",
      assetPaths: ["folder/../assets"],
      outDir: "folder/../missing/out",
    });
    await mkdir(join(root, "folder"));
    await mkdir(join(root, "assets"));
    const before = await treeBytes(root);
    const snapshot = success(await load({ cwd: root }));
    expect(snapshot.sources.map((source) => source.sourceId)).toEqual(["src/main.blend"]);
    expect(snapshot.assetPaths).toEqual([join(root, "assets")]);
    expect(await treeBytes(root)).toEqual(before);
  });
  // Canonical containment must reject a symlink to a root-prefix sibling.
  it.each(["sourceRoot", "assetPaths", "outDir"])(
    "should reject a canonical %s escape",
    async (key) => {
      const game = join(root, "game");
      await project(game, { [key]: key === "assetPaths" ? ["escape"] : "escape" });
      await put(root, "game-other/outside.blend", "outside");
      await symlink(join(root, "game-other"), join(game, "escape"), "dir");
      failure(await load({ cwd: game }), "PROJECT_PATH_INVALID", [root]);
    },
  );
  // Missing output components validate without publication, staging, or mkdir.
  it("should validate a missing output directory without creating it", async () => {
    await project(root, { outDir: "missing/nested/out" });
    const before = await treeBytes(root);
    expect(success(await load({ cwd: root })).outDir).toBe(join(root, "missing/nested/out"));
    expect(await treeBytes(root)).toEqual(before);
  });
  // A file cannot be traversed as an output parent or used as an output directory.
  it.each(["occupied", "occupied/nested"])(
    "should reject file-occupied output '%s'",
    async (outDir) => {
      await project(root, { outDir });
      await put(root, "occupied", "keep");
      failure(await load({ cwd: root }), "PROJECT_PATH_INVALID", [root]);
      expect(await readFile(join(root, "occupied"), "utf8")).toBe("keep");
    },
  );
  // Source and asset inputs cannot explicitly point into compiler-owned output.
  it.each(["sourceRoot", "assetPaths"])(
    "should reject an explicit logical output %s",
    async (key) => {
      await project(root, { [key]: key === "assetPaths" ? ["out/assets"] : "out/sources" });
      await put(root, "out/sources/a.blend", "prior");
      await mkdir(join(root, "out/assets"));
      failure(await load({ cwd: root }), "PROJECT_PATH_INVALID", [root]);
    },
  );
  // Canonical aliases of output are also invalid explicit input roots.
  it.each(["sourceRoot", "assetPaths"])(
    "should reject an explicit canonical output %s",
    async (key) => {
      await project(root, { [key]: key === "assetPaths" ? ["alias"] : "alias" });
      await put(root, "out/prior.blend", "prior");
      await symlink(join(root, "out"), join(root, "alias"), "dir");
      failure(await load({ cwd: root }), "PROJECT_PATH_INVALID", [root]);
    },
  );
  // Source root '.' excludes both output spelling and canonical aliases before walking.
  it("should exclude unreadable output and its canonical alias before traversal", async () => {
    await project(root, { sourceRoot: "." });
    await put(root, "out/generation/prior.blend", "prior");
    await symlink(join(root, "out"), join(root, "prior-alias"), "dir");
    const output = join(root, "out");
    const restore = await denyRead(output);
    try {
      await expect(readdir(output)).rejects.toMatchObject({ code: "EACCES" });
      expect(success(await load({ cwd: root })).sources.map((source) => source.sourceId)).toEqual([
        "src/main.blend",
      ]);
    } finally {
      await restore();
    }
  });
  // Source and asset roots must actually be existing directories.
  it.each(["sourceRoot", "assetPaths"])("should reject a file-valued %s", async (key) => {
    await project(root, { [key]: key === "assetPaths" ? ["file"] : "file" });
    await put(root, "file", "bytes");
    failure(await load({ cwd: root }), "PROJECT_PATH_INVALID", [root]);
  });
  // A single contained regular source symlink retains its logical exposed name.
  it("should follow a single contained source symlink", async () => {
    await project(root);
    await put(root, "data/payload", "raw source");
    await symlink(join(root, "data/payload"), join(root, "src/linked.blend"), "file");
    const record = success(await load({ cwd: root })).sources.find(
      (source) => source.sourceId === "src/linked.blend",
    );
    expect(record?.text).toBe("raw source");
    expect(record?.resolvedPath).toBe(join(root, "data/payload"));
  });
  // An outside source identity invalidates the complete snapshot.
  it("should reject an outside source symlink", async () => {
    await project(join(root, "game"));
    await put(root, "outside.blend", "outside");
    await symlink(join(root, "outside.blend"), join(root, "game/src/escape.blend"), "file");
    failure(await load({ cwd: join(root, "game") }), "PROJECT_PATH_INVALID", [root]);
  });
  // Cycles are diagnosed rather than skipped or allowed to recurse forever.
  it("should reject a canonical directory cycle", async () => {
    await project(root);
    await symlink(join(root, "src"), join(root, "src/loop"), "dir");
    const diagnostics = failure(await load({ cwd: root }), "PROJECT_PATH_CYCLE", [root]);
    expect(diagnostics.find((d) => d.code === "PROJECT_PATH_CYCLE")?.message).toContain("src/loop");
  });
  // Distinct logical source names cannot alias one regular-file identity.
  it.each(["symlink", "hardlink"])("should reject a duplicate %s source identity", async (kind) => {
    await project(root);
    if (kind === "symlink")
      await symlink(join(root, "src/main.blend"), join(root, "src/alias.blend"), "file");
    else await link(join(root, "src/main.blend"), join(root, "src/alias.blend"));
    const diagnostics = failure(await load({ cwd: root }), "PROJECT_SOURCE_ALIAS", [root]);
    expect(
      diagnostics.find((d) => d.code === "PROJECT_SOURCE_ALIAS")?.related.length,
    ).toBeGreaterThan(0);
  });
  // Permission cases prove native denial before asking the loading service to report it.
  it.each(["source", "directory", "asset"])(
    "should return typed failure for a genuinely unreadable %s",
    async (kind) => {
      await project(root, { assetPaths: ["assets"] });
      await put(root, "assets/opaque", "asset");
      const path = join(
        root,
        kind === "source" ? "src/main.blend" : kind === "directory" ? "src" : "assets",
      );
      const restore = await denyRead(path);
      try {
        if (kind === "source")
          await expect(readFile(path)).rejects.toMatchObject({ code: "EACCES" });
        else await expect(readdir(path)).rejects.toMatchObject({ code: "EACCES" });
        const result = await load({ cwd: root });
        failure(result, "PROJECT_READ_FAILED", [root]);
      } finally {
        await restore();
      }
    },
  );
  // Native special inputs are not regular source files and must fail before opening.
  it.runIf(process.platform === "linux")(
    "should reject a native FIFO source rather than blocking on it",
    async () => {
      await project(root);
      await promisify(execFile)("mkfifo", [join(root, "src/pipe.blend")]);
      failure(await load({ cwd: root }), "PROJECT_PATH_INVALID", [root]);
    },
  );
});
