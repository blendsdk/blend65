import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  freshTree,
  hash,
  inputHash,
  load,
  manifest,
  project,
  put,
  removeTree,
  success,
  treeBytes,
} from "../../test/project-fixtures.js";

describe("immutable project snapshot identity", () => {
  let root: string;
  beforeEach(async () => {
    root = await freshTree();
  });
  afterEach(async () => {
    await removeTree(root);
  });

  // Checkout roots, caller directories, and enumeration order are host-only facts.
  it("should produce identical input identities across byte-identical checkouts", async () => {
    const left = join(root, "left");
    const right = join(root, "right");
    for (const copy of [left, right]) {
      await project(copy);
      await rm(join(copy, "src/main.blend"));
      await mkdir(join(copy, "caller/nested"), { recursive: true });
    }
    for (const name of ["é.blend", "A.blend", "nested/Ω.blend"])
      await put(left, `src/${name}`, `raw ${name}`);
    for (const name of ["nested/Ω.blend", "A.blend", "é.blend"])
      await put(right, `src/${name}`, `raw ${name}`);
    const a = success(await load({ cwd: left }));
    const b = success(await load({ cwd: join(right, "caller/nested") }));
    expect(a.projectRoot).not.toBe(b.projectRoot);
    expect(a.sourceRoot).not.toBe(b.sourceRoot);
    /** Extract only input-derived fields so checkout-specific host paths cannot affect equality. */
    const stable = (snapshot: typeof a) => ({
      manifest: snapshot.manifest,
      manifestSource: [
        snapshot.manifestSource.sourceId,
        snapshot.manifestSource.text,
        snapshot.manifestSource.sha256,
        snapshot.manifestSource.byteLength,
      ],
      sources: snapshot.sources.map((source) => [
        source.sourceId,
        source.text,
        source.sha256,
        source.byteLength,
      ]),
      inputSha256: snapshot.inputSha256,
    });
    expect(stable(a)).toEqual(stable(b));
    expect(a.inputSha256).toBe(inputHash(a));
    expect(b.inputSha256).toBe(inputHash(b));
  });
  // Raw UTF-8, including BOM and line endings, is preserved and hashed exactly.
  it("should preserve raw BOM bytes and reproduce the fixed versioned hash tuple", async () => {
    const rawManifest = Buffer.from(`\uFEFF${manifest({ name: "Game Ω 1.2" })}\r\n`);
    const rawSource = Buffer.from("\uFEFFé😀\r\nraw\rfinal\n");
    await put(root, "blend65.json", rawManifest);
    await put(root, "src/main.blend", rawSource);
    const snapshot = success(await load({ cwd: root }));
    expect(snapshot.manifestSource).toEqual({
      sourceId: "blend65.json",
      text: rawManifest.toString("utf8"),
      sha256: hash(rawManifest),
      byteLength: rawManifest.length,
      resolvedPath: join(root, "blend65.json"),
    });
    expect(snapshot.sources).toEqual([
      {
        sourceId: "src/main.blend",
        text: rawSource.toString("utf8"),
        sha256: hash(rawSource),
        byteLength: rawSource.length,
        resolvedPath: join(root, "src/main.blend"),
      },
    ]);
    const tuple = [
      "blend65-project-input-v1",
      ["blend65.json", hash(rawManifest)],
      [["src/main.blend", hash(rawSource)]],
      null,
      null,
    ];
    expect(snapshot.inputSha256).toBe(hash(Buffer.from(JSON.stringify(tuple), "utf8")));
    expect(snapshot.inputSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Buffer.from(snapshot.sources[0]?.text ?? "", "utf8")).toEqual(rawSource);
    expect(snapshot.manifest.name).toBe("Game Ω 1.2");
  });
  // Every nested public record and array is frozen, with no mutable byte view.
  it("should reject mutation of every nested snapshot record and array", async () => {
    await project(root, { assetPaths: ["assets"] });
    await mkdir(join(root, "assets"));
    const snapshot = success(await load({ cwd: root }));
    const before = JSON.stringify(snapshot);
    /** Recursively assert frozen public objects and reject mutable byte representations. */
    function inspect(value: unknown): void {
      if (value === null || typeof value !== "object") return;
      expect(Buffer.isBuffer(value)).toBe(false);
      expect(ArrayBuffer.isView(value)).toBe(false);
      expect(Object.isFrozen(value)).toBe(true);
      for (const nested of Object.values(value)) inspect(nested);
    }
    inspect(snapshot);
    expect(() => Object.assign(snapshot, { inputSha256: "changed" })).toThrow(TypeError);
    expect(() => Object.assign(snapshot.manifest, { name: "changed" })).toThrow(TypeError);
    expect(() => Object.assign(snapshot.manifestSource, { text: "changed" })).toThrow(TypeError);
    expect(() => Object.assign(snapshot.sources[0] ?? {}, { text: "changed" })).toThrow(TypeError);
    expect(() => Array.prototype.push.call(snapshot.sources, snapshot.sources[0])).toThrow(
      TypeError,
    );
    expect(() => Array.prototype.push.call(snapshot.assetPaths, "changed")).toThrow(TypeError);
    expect(() => Array.prototype.push.call(snapshot.manifest.assetPaths, "changed")).toThrow(
      TypeError,
    );
    expect(() => Object.assign(snapshot.overrides, { target: "changed" })).toThrow(TypeError);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  // Previous output bytes are neither source records nor identity inputs.
  it("should leave previous output untouched and exclude it from input identity", async () => {
    await project(root, { sourceRoot: "." });
    await put(root, "out/current.json", "previous generation");
    await put(root, "out/generation/prior.blend", "prior");
    const before = await treeBytes(root);
    const a = success(await load({ cwd: root }));
    expect(await treeBytes(root)).toEqual(before);
    await put(root, "out/generation/prior.blend", "different output");
    await put(root, "out/another/output.asm", "bytes");
    const b = success(await load({ cwd: root }));
    expect(b.inputSha256).toBe(a.inputSha256);
    expect(b.sources).toEqual(a.sources);
    expect(await readFile(join(root, "out/current.json"), "utf8")).toBe("previous generation");
  });
  // Invocation selections stay separate from raw manifest configuration and bytes.
  it("should record target and entry overrides without mutating the manifest", async () => {
    await project(root);
    const before = await treeBytes(root);
    const plain = success(await load({ cwd: root }));
    const target = "c64-pal-prg-kernal-8580";
    const entry = "Game.Render";
    const overridden = success(await load({ cwd: root, target, entry }));
    expect(overridden.manifest).toEqual(plain.manifest);
    expect(overridden.manifestSource).toEqual(plain.manifestSource);
    expect(overridden.overrides).toEqual({ target, entry });
    expect(overridden.effectiveTarget).toBe(target);
    expect(overridden.effectiveEntry).toBe(entry);
    expect(plain.overrides).toEqual({ target: null, entry: null });
    expect(plain.effectiveTarget).toBe(plain.manifest.target);
    expect(plain.effectiveEntry).toBe(plain.manifest.entry);
    expect(overridden.inputSha256).toBe(inputHash(overridden));
    expect(overridden.inputSha256).not.toBe(plain.inputSha256);
    expect(await treeBytes(root)).toEqual(before);
  });
  // Even an equal effective selection remains a distinct recorded invocation.
  it.each(["target", "entry"] as const)(
    "should bind an explicit unchanged %s override into input identity",
    async (key) => {
      await project(root);
      const plain = success(await load({ cwd: root }));
      const selected = success(await load({ cwd: root, [key]: plain.manifest[key] }));
      expect(selected.inputSha256).toBe(inputHash(selected));
      expect(selected.inputSha256).not.toBe(plain.inputSha256);
    },
  );
});
