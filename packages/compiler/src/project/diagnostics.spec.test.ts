import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Diagnostic } from "../../test/project-fixtures.js";
import {
  denyRead,
  failure,
  freshTree,
  load,
  manifest,
  project,
  put,
  removeTree,
  treeBytes,
} from "../../test/project-fixtures.js";

describe("typed project diagnostics", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
  });
  afterEach(async () => {
    await removeTree(root);
  });

  // Fatal decoding rejects malformed raw bytes rather than replacing their values.
  it.each([
    ["invalid leading byte", [0xff]],
    ["overlong scalar", [0xc0, 0xaf]],
    ["truncated scalar", [0xe2, 0x82]],
    ["surrogate scalar", [0xed, 0xa0, 0x80]],
    ["out-of-range scalar", [0xf4, 0x90, 0x80, 0x80]],
  ])("should reject %s in the raw manifest", async (_name, values) => {
    await project(root);
    await put(root, "blend65.json", Uint8Array.from(values as number[]));
    const before = await treeBytes(root);
    const diagnostics = failure(await load({ cwd: root }), "PROJECT_INVALID_UTF8", [root]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toBe("Input 'blend65.json' is not valid UTF-8");
    expect(await treeBytes(root)).toEqual(before);
  });
  // A valid manifest cannot make malformed source bytes into a partial snapshot.
  it.each([
    ["invalid leading byte", [0xff]],
    ["overlong scalar", [0xc0, 0xaf]],
    ["truncated scalar", [0xe2, 0x82]],
    ["surrogate scalar", [0xed, 0xa0, 0x80]],
    ["out-of-range scalar", [0xf4, 0x90, 0x80, 0x80]],
  ])("should reject %s in a raw source", async (_name, values) => {
    await project(root);
    await put(root, "src/main.blend", Uint8Array.from(values as number[]));
    const before = await treeBytes(root);
    const diagnostics = failure(await load({ cwd: root }), "PROJECT_INVALID_UTF8", [root]);
    expect(diagnostics.find((d) => d.code === "PROJECT_INVALID_UTF8")?.message).toBe(
      "Input 'src/main.blend' is not valid UTF-8",
    );
    expect(await treeBytes(root)).toEqual(before);
  });
  // Independent invalid fields retain all root causes in deterministic raw-byte order.
  it("should preserve independent manifest failures with stable diagnostic ordering across roots", async () => {
    const fields = {
      schemaVersion: 2,
      name: "NUL",
      sourceRoot: 7,
      entry: "src/main.blend",
      target: "c64u",
      unknown: 0,
    };
    const collected: Diagnostic[][] = [];
    for (const name of ["left", "right"]) {
      const copy = join(root, name);
      await project(copy, fields);
      const before = await treeBytes(copy);
      const result = await load({ cwd: copy });
      const diagnostics = failure(result, "PROJECT_MANIFEST_FIELD", [root]);
      collected.push([...diagnostics]);
      expect(await treeBytes(copy)).toEqual(before);
    }
    expect(collected[0]).toEqual(collected[1]);
    const diagnostics = collected[0] ?? [];
    expect(diagnostics.map((d) => d.pointer).sort()).toEqual(
      ["/entry", "/name", "/schemaVersion", "/sourceRoot", "/target", "/unknown"].sort(),
    );
    /** Compare diagnostics by exact source bytes, raw offset, severity, code, then message. */
    const compare = (a: Diagnostic, b: Diagnostic): number =>
      Buffer.compare(
        Buffer.from(a.primarySpan?.sourceId ?? ""),
        Buffer.from(b.primarySpan?.sourceId ?? ""),
      ) ||
      (a.primarySpan?.start ?? 0) - (b.primarySpan?.start ?? 0) ||
      (a.severity === "error" ? 0 : 1) - (b.severity === "error" ? 0 : 1) ||
      Buffer.compare(Buffer.from(a.code), Buffer.from(b.code)) ||
      Buffer.compare(Buffer.from(a.message), Buffer.from(b.message));
    expect(diagnostics).toEqual([...diagnostics].sort(compare));
    expect(diagnostics.some((d) => d.code === "PROJECT_PATH_INVALID")).toBe(false);
  });
  // An unusable root suppresses dependent schema, paths, and source-inventory checks.
  it.each(["{", "[]", "null"])(
    "should suppress dependent diagnostics for root '%s'",
    async (text) => {
      await put(root, "blend65.json", text);
      const result = await load({ cwd: root });
      const diagnostics = failure(
        result,
        text === "{" ? "PROJECT_MANIFEST_SYNTAX" : "PROJECT_MANIFEST_FIELD",
        [root],
      );
      expect(diagnostics).toHaveLength(1);
      expect(
        diagnostics.some((d) =>
          ["PROJECT_EMPTY_SOURCES", "PROJECT_PATH_INVALID", "PROJECT_READ_FAILED"].includes(d.code),
        ),
      ).toBe(false);
    },
  );
  // Invalid invocations cannot repair invalid manifest selections.
  it.each(["target", "entry"] as const)(
    "should not repair an invalid manifest %s with an override",
    async (key) => {
      await project(root, { [key]: key === "target" ? "c64u" : "src/main.blend" });
      const before = await treeBytes(root);
      failure(
        await load({
          cwd: root,
          [key]: key === "target" ? "c64-pal-prg-kernal-6581" : "Foundation",
        }),
        key === "target" ? "E10279" : "PROJECT_MANIFEST_FIELD",
        [root],
      );
      expect(await treeBytes(root)).toEqual(before);
    },
  );
  // Invalid overrides are independently validated, not silently ignored.
  it.each(["target", "entry"] as const)("should reject an invalid invocation %s", async (key) => {
    await project(root);
    failure(
      await load({ cwd: root, [key]: key === "target" ? "c64u" : "src/main.blend" }),
      key === "target" ? "E10279" : "PROJECT_MANIFEST_FIELD",
      [root],
    );
  });
  // Qualified-profile failures use the language-owned message with the exact ordered table.
  it("should instantiate the exact qualified-profile diagnostic for an invalid override", async () => {
    await project(root);
    const diagnostics = failure(await load({ cwd: root, target: "c64u" }), "E10279", [root]);
    const profiles = [
      "c64-pal-prg-kernal-6581",
      "c64-pal-prg-kernal-8580",
      "c64-pal-prg-takeover-6581",
      "c64-pal-prg-takeover-8580",
      "c64-ntsc-prg-kernal-6581",
      "c64-ntsc-prg-kernal-8580",
      "c64-ntsc-prg-takeover-6581",
      "c64-ntsc-prg-takeover-8580",
      "c64-pal-d64-kernal-6581",
    ];
    expect(diagnostics.find((d) => d.code === "E10279")?.message).toBe(
      `Target profile 'c64u' is not a complete qualified profile ID — choose one of: ${profiles.join(", ")}`,
    );
  });
  // Loading does not write artifacts or staging data on any typed failure branch.
  it.each(["syntax", "path", "encoding", "read"])(
    "should preserve the entire tree and prior output on %s failure",
    async (kind) => {
      await project(root, kind === "path" ? { sourceRoot: "../escape" } : {});
      await put(root, "out/current.json", "previous");
      await put(root, "out/generation/game.asm", "prior output");
      if (kind === "syntax") await put(root, "blend65.json", "{");
      if (kind === "encoding") await put(root, "src/main.blend", Uint8Array.of(0xff));
      const before = await treeBytes(root);
      let restore: (() => Promise<void>) | undefined;
      if (kind === "read") {
        restore = await denyRead(join(root, "src/main.blend"));
        await expect(readFile(join(root, "src/main.blend"))).rejects.toMatchObject({
          code: "EACCES",
        });
      }
      try {
        failure(
          await load({ cwd: root }),
          kind === "syntax"
            ? "PROJECT_MANIFEST_SYNTAX"
            : kind === "path"
              ? "PROJECT_PATH_INVALID"
              : kind === "encoding"
                ? "PROJECT_INVALID_UTF8"
                : "PROJECT_READ_FAILED",
          [root],
        );
      } finally {
        await restore?.();
      }
      expect(await treeBytes(root)).toEqual(before);
    },
  );
  // Inserted names cannot inject terminal controls into error messages.
  it("should escape terminal controls in inserted manifest keys", async () => {
    await project(root);
    await put(root, "blend65.json", manifest({ ["hostile\u001b[31m\nkey"]: 1 }));
    const diagnostics = failure(await load({ cwd: root }), "PROJECT_MANIFEST_FIELD", [root]);
    expect(diagnostics.some((d) => /\u001b|\n/.test(d.message))).toBe(false);
  });
  // Assets are directory-only inputs here; their contents are not decoded or hashed.
  it("should validate asset directories without reading their raw content", async () => {
    await project(root, { assetPaths: ["assets"] });
    await mkdir(join(root, "assets"));
    await put(root, "assets/malformed.blend", Uint8Array.of(0xff));
    const result = await load({ cwd: root });
    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error("asset content entered source loading");
    expect(result.snapshot.sources.map((s) => s.sourceId)).toEqual(["src/main.blend"]);
  });
});
