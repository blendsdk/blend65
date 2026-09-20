import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { resolveRawAsset } from "./raw-asset.js";

const temporaryRoots: string[] = [];

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function source(root: string, text: string): SourceRecord {
  return {
    sourceId: "src/game.blend",
    text,
    sha256: sha256(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: join(root, "src/game.blend"),
  };
}

/** Build a loaded-project-shaped snapshot with canonical asset roots in manifest order. */
function snapshot(root: string, assetRoots: readonly string[]): ProjectSnapshot {
  const manifestText = "{}";
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1,
      name: "raw-asset-spec",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: Object.freeze(assetRoots.map((path) => relative(root, path))),
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    }),
    manifestSource: Object.freeze({
      sourceId: "blend65.json",
      text: manifestText,
      sha256: sha256(manifestText),
      byteLength: Buffer.byteLength(manifestText, "utf8"),
      resolvedPath: join(root, "blend65.json"),
    }),
    sources: Object.freeze([source(root, "module Game; function main(): void {}")]),
    inputSha256: sha256(root),
    projectRoot: root,
    sourceRoot: join(root, "src"),
    assetPaths: Object.freeze([...assetRoots]),
    outDir: join(root, "out"),
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: "c64-pal-prg-kernal-6581",
    effectiveEntry: "Game",
  });
}

async function freshRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-raw-asset-spec-"));
  temporaryRoots.push(root);
  await mkdir(join(root, "src"));
  return root;
}

async function put(path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

function spriteBytes(seed: number): Uint8Array {
  return Uint8Array.from({ length: 512 }, (_, index) => (index + seed) & 0xff);
}

/** Assert that asset failure is terminal and carries one exact proving code. */
async function expectError(
  project: ProjectSnapshot,
  literalPath: string,
  code: string,
): Promise<void> {
  const result = await resolveRawAsset(project, literalPath);
  expect(result.kind).toBe("error");
  expect(result).not.toHaveProperty("asset");
  expect(result).not.toHaveProperty("value");
  if (result.kind !== "error") throw new Error(`Expected ${code}, got ${result.kind}`);
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([code]);
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("raw embedded assets", () => {
  // Asset roots are ordered, and a successful lookup exposes only immutable semantic bytes.
  it("selects the first canonical root and returns a stable typed value", async () => {
    const root = await freshRoot();
    const firstRoot = join(root, "first");
    const secondRoot = join(root, "second");
    const firstBytes = spriteBytes(3);
    await put(join(firstRoot, "sprites.bin"), firstBytes);
    await put(join(secondRoot, "sprites.bin"), spriteBytes(19));
    const project = snapshot(root, [firstRoot, secondRoot]);

    const first = await resolveRawAsset(project, "sprites.bin");
    const repeated = await resolveRawAsset(project, "sprites.bin");

    expect(first.kind).toBe("complete");
    expect(repeated.kind).toBe("complete");
    if (first.kind !== "complete" || repeated.kind !== "complete")
      throw new Error("Expected a complete raw asset");
    expect(first.asset).toMatchObject({
      sourcePath: "first/sprites.bin",
      sha256: sha256(firstBytes),
    });
    expect(first.asset.id.length).toBeGreaterThan(0);
    expect(first.value).toMatchObject({
      kind: "embedded",
      assetId: first.asset.id,
      constant: true,
      type: {
        kind: "array",
        element: { kind: "scalar", name: "byte" },
        length: 512,
        size: 512,
      },
    });
    expect(first.asset.bytes).toBe(first.value.bytes);
    expect(first.asset.bytes).toEqual([...firstBytes]);
    expect(Object.isFrozen(first.asset)).toBe(true);
    expect(Object.isFrozen(first.asset.bytes)).toBe(true);
    expect(Buffer.isBuffer(first.asset.bytes)).toBe(false);
    expect(ArrayBuffer.isView(first.asset.bytes)).toBe(false);
    expect(repeated).toEqual(first);
  });

  // Missing and invalid extents are distinguished and never expose a partial value.
  it("rejects missing empty short and long files with one proving diagnostic", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    await put(join(assets, "empty.bin"), new Uint8Array());
    await put(join(assets, "short.bin"), new Uint8Array(511));
    await put(join(assets, "long.bin"), new Uint8Array(513));
    const project = snapshot(root, [assets]);

    await expectError(project, "missing.bin", "E10130");
    await expectError(project, "empty.bin", "E10131");
    await expectError(project, "short.bin", "E10140");
    await expectError(project, "long.bin", "E10140");
  });

  // A snapshot cannot silently resolve the same literal to bytes changed after its first proof.
  it("rejects a changed file instead of publishing a second identity", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    const path = join(assets, "sprites.bin");
    await put(path, spriteBytes(1));
    const project = snapshot(root, [assets]);
    const first = await resolveRawAsset(project, "sprites.bin");
    expect(first.kind).toBe("complete");

    await writeFile(path, spriteBytes(2));
    await expectError(project, "sprites.bin", "PROJECT_CHANGED");
  });

  // Literal paths cannot escape or obscure the selected project asset roots.
  it.each([
    ["empty", ""],
    ["current directory", "."],
    ["parent directory", ".."],
    ["traversal", "../sprites.bin"],
    ["nested traversal", "nested/../../sprites.bin"],
    ["absolute", "/sprites.bin"],
    ["drive-absolute", "C:\\sprites.bin"],
    ["nul", "sprites\0.bin"],
    ["malformed Unicode", "sprites\ud800.bin"],
  ])("rejects an %s literal path before lookup", async (_name, literalPath) => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    await put(join(assets, "sprites.bin"), spriteBytes(0));
    await expectError(snapshot(root, [assets]), literalPath, "PROJECT_PATH_INVALID");
  });

  // A final symlink is rejected even when its target is a readable regular file.
  it("rejects final symlinks without admitting an outside target", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    const outside = join(root, "outside/sprites.bin");
    await put(outside, spriteBytes(0));
    await mkdir(assets);
    await symlink(outside, join(assets, "sprites.bin"), "file");

    await expectError(snapshot(root, [assets]), "sprites.bin", "PROJECT_PATH_INVALID");
  });

  // Distinct literal names cannot introduce a second name for one admitted file identity.
  it("rejects a hard-link alias after the original identity is admitted", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    await put(join(assets, "sprites.bin"), spriteBytes(0));
    await link(join(assets, "sprites.bin"), join(assets, "alias.bin"));
    const project = snapshot(root, [assets]);
    expect((await resolveRawAsset(project, "sprites.bin")).kind).toBe("complete");

    await expectError(project, "alias.bin", "PROJECT_SOURCE_ALIAS");
  });

  // Directories and other non-regular nodes are not byte assets.
  it("rejects a non-regular asset before reading content", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    await mkdir(join(assets, "sprites.bin"), { recursive: true });

    await expectError(snapshot(root, [assets]), "sprites.bin", "PROJECT_PATH_INVALID");
  });
});
