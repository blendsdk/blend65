import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  failure,
  denyRead,
  freshTree,
  load,
  manifest,
  project,
  put,
  removeTree,
  success,
} from "../../test/project-fixtures.js";

describe("project discovery", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
  });
  afterEach(async () => {
    await removeTree(root);
  });

  // The nearest manifest owns the root, regardless of the caller's directory.
  it.each(["", "nested/deeper"])("should discover the project from '%s'", async (directory) => {
    await project(root);
    await mkdir(join(root, directory), { recursive: true });
    const snapshot = success(await load({ cwd: join(root, directory) }));
    expect(snapshot.projectRoot).toBe(root);
    expect(snapshot.manifestSource.sourceId).toBe("blend65.json");
  });
  // Explicit relative and absolute selectors are authoritative root selections.
  it.each(["relative", "absolute"])("should select an explicit %s manifest", async (mode) => {
    await project(join(root, "selected"), {}, "custom.json");
    await mkdir(join(root, "caller"));
    const path =
      mode === "absolute" ? join(root, "selected/custom.json") : "../selected/custom.json";
    const snapshot = success(await load({ cwd: join(root, "caller"), project: path }));
    expect(snapshot.projectRoot).toBe(join(root, "selected"));
    expect(snapshot.manifestSource.sourceId).toBe("custom.json");
  });
  // A nearer valid project wins over an otherwise usable ancestor.
  it("should select the nearest nested project", async () => {
    await project(root);
    await project(join(root, "child"), { name: "Child" });
    expect(success(await load({ cwd: join(root, "child/src") })).manifest.name).toBe("Child");
  });
  // Invalid explicit and nearer manifests must never silently fall back.
  it.each(["nearer", "explicit"])(
    "should not fall back from an invalid %s manifest",
    async (mode) => {
      await project(root);
      await put(root, "child/blend65.json", "{");
      failure(
        await load({
          cwd: join(root, "child"),
          ...(mode === "explicit" ? { project: "blend65.json" } : {}),
        }),
        "PROJECT_MANIFEST_SYNTAX",
        [root],
      );
    },
  );
  // A missing explicit selector cannot be repaired by a discovered ancestor.
  it("should fail a missing explicit manifest without discovery fallback", async () => {
    await project(root);
    failure(await load({ cwd: root, project: "missing.json" }), "PROJECT_READ_FAILED", [root]);
  });
  // Unrelated callers have a stable typed discovery failure.
  it("should report when no project exists above the caller", async () => {
    const diagnostics = failure(await load({ cwd: root }), "PROJECT_NOT_FOUND", [root]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toBe("No blend65.json project found");
  });
  // Native denial must stop at the nearer manifest rather than reading a parent.
  it("should not fall back from a genuinely unreadable nearer manifest", async () => {
    await project(root);
    await put(root, "child/blend65.json", manifest());
    const path = join(root, "child/blend65.json");
    const restore = await denyRead(path);
    try {
      await expect(readFile(path)).rejects.toMatchObject({ code: "EACCES" });
      failure(await load({ cwd: join(root, "child") }), "PROJECT_READ_FAILED", [root]);
    } finally {
      await restore();
    }
  });
});
