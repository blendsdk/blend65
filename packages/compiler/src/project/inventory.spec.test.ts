import { rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  failure,
  freshTree,
  hash,
  load,
  project,
  put,
  removeTree,
  success,
} from "../../test/project-fixtures.js";

describe("exact source inventory", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
  });
  afterEach(async () => {
    await removeTree(root);
  });

  // Only the exact lowercase suffix is input, sorted by UTF-8 bytes with no folding.
  it.each(["forward", "reverse"])(
    "should preserve exact names in stable order after %s creation",
    async (order) => {
      await project(root);
      await rm(join(root, "src/main.blend"));
      const names = [
        "z.blend",
        "A.blend",
        "space name.blend",
        "é.blend",
        "é.blend",
        "sub/Ω.blend",
        "ignored.BLEND",
        "ignored.txt",
      ];
      for (const name of order === "reverse" ? names.toReversed() : names)
        await put(root, `src/${name}`, "same");
      const expected = names
        .filter((name) => name.endsWith(".blend"))
        .map((name) => `src/${name}`)
        .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
      expect(success(await load({ cwd: root })).sources.map((source) => source.sourceId)).toEqual(
        expected,
      );
    },
  );
  // Filename validity belongs to the actual host, not the output basename validator.
  it.runIf(process.platform !== "win32")(
    "should admit native POSIX source names that are unsafe output basenames",
    async () => {
      await project(root);
      await put(root, "src/NUL.blend", "one");
      await put(root, "src/a:b.blend", "two");
      expect(success(await load({ cwd: root })).sources.map((source) => source.sourceId)).toEqual([
        "src/NUL.blend",
        "src/a:b.blend",
        "src/main.blend",
      ]);
    },
  );
  // An empty suffix inventory fails without publishing a partial or empty snapshot.
  it("should report an empty source inventory", async () => {
    await project(root);
    await rm(join(root, "src/main.blend"));
    await put(root, "src/ignored.BLEND", "ignored");
    const diagnostics = failure(await load({ cwd: root }), "PROJECT_EMPTY_SOURCES", [root]);
    expect(diagnostics.find((d) => d.code === "PROJECT_EMPTY_SOURCES")?.message).toBe(
      "No .blend source files under 'src'",
    );
  });
  // Raw bytes and module meaning are independent of the exposed filename.
  it("should bind a rename to source identity without inventing module headers", async () => {
    await project(root);
    const before = success(await load({ cwd: root }));
    await rename(join(root, "src/main.blend"), join(root, "src/renamed.blend"));
    const after = success(await load({ cwd: root }));
    expect(after.sources[0]?.text).toBe("not a module header\n");
    expect(after.sources[0]?.sha256).toBe(before.sources[0]?.sha256);
    expect(after.sources[0]?.sourceId).toBe("src/renamed.blend");
    expect(after.inputSha256).not.toBe(before.inputSha256);
    expect(after.sources[0]).not.toHaveProperty("moduleName");
  });
  // Equal bytes are legal in independent files and are not identity aliases.
  it("should keep separate identities for distinct files with identical bytes", async () => {
    await project(root);
    await put(root, "src/other.blend", "not a module header\n");
    const sources = success(await load({ cwd: root })).sources;
    expect(sources.map((source) => source.sourceId)).toEqual(["src/main.blend", "src/other.blend"]);
    expect(sources.map((source) => source.sha256)).toEqual([
      hash("not a module header\n"),
      hash("not a module header\n"),
    ]);
  });
});
