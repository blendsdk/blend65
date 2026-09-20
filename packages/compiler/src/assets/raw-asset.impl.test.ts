import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeProjectWithAssets } from "../frontend/service.js";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { resolveRawAsset } from "./raw-asset.js";

const temporaryRoots: string[] = [];

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function source(root: string, text: string): SourceRecord {
  return Object.freeze({
    sourceId: "src/game.blend",
    text,
    sha256: sha256(text),
    byteLength: Buffer.byteLength(text),
    resolvedPath: join(root, "src/game.blend"),
  });
}

function snapshot(root: string, text: string): ProjectSnapshot {
  const manifestText = "{}";
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1,
      name: "asset-implementation",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: Object.freeze(["assets"]),
      outDir: "out",
      optimization: "none",
      boundsCheck: false,
      divisionZeroCheck: false,
    }),
    manifestSource: Object.freeze({
      sourceId: "blend65.json",
      text: manifestText,
      sha256: sha256(manifestText),
      byteLength: Buffer.byteLength(manifestText),
      resolvedPath: join(root, "blend65.json"),
    }),
    sources: Object.freeze([source(root, text)]),
    inputSha256: sha256(text),
    projectRoot: root,
    sourceRoot: join(root, "src"),
    assetPaths: Object.freeze([join(root, "assets")]),
    outDir: join(root, "out"),
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: "c64-pal-prg-kernal-6581",
    effectiveEntry: "Game",
  });
}

async function fixture(text = "module Game; function main(): void {}"): Promise<ProjectSnapshot> {
  const root = await mkdtemp(join(tmpdir(), "blend65-raw-asset-impl-"));
  temporaryRoots.push(root);
  await mkdir(join(root, "src"));
  await mkdir(join(root, "assets"));
  await writeFile(
    join(root, "assets/sprites.bin"),
    Uint8Array.from({ length: 512 }, (_, index) => index & 0xff),
  );
  return snapshot(root, text);
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("raw asset implementation boundaries", () => {
  it("keeps concurrent resolution on one deterministic semantic identity", async () => {
    const project = await fixture();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => resolveRawAsset(project, "sprites.bin")),
    );

    expect(results.every(({ kind }) => kind === "complete")).toBe(true);
    const complete = results.filter((result) => result.kind === "complete");
    expect(new Set(complete.map(({ asset }) => asset.id)).size).toBe(1);
    expect(new Set(complete.map(({ asset }) => asset.sha256)).size).toBe(1);
  });

  it("admits only one literal when hard-link aliases race", async () => {
    const project = await fixture();
    await link(
      join(project.assetPaths[0]!, "sprites.bin"),
      join(project.assetPaths[0]!, "alias.bin"),
    );

    const results = await Promise.all([
      resolveRawAsset(project, "sprites.bin"),
      resolveRawAsset(project, "alias.bin"),
    ]);

    expect(results.map(({ kind }) => kind).sort()).toEqual(["complete", "error"]);
    const failure = results.find(({ kind }) => kind === "error");
    expect(failure?.kind).toBe("error");
    if (failure?.kind !== "error") throw new Error("Expected one alias rejection");
    expect(failure.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_SOURCE_ALIAS"]);
  });

  it("rejects an intermediate symlink whose canonical file escapes the asset root", async () => {
    const project = await fixture();
    const outside = await mkdtemp(join(tmpdir(), "blend65-raw-asset-outside-"));
    temporaryRoots.push(outside);
    await writeFile(join(outside, "escaped.bin"), new Uint8Array(512));
    await symlink(outside, join(project.assetPaths[0]!, "linked"), "dir");

    const result = await resolveRawAsset(project, "linked/escaped.bin");

    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("Expected containment failure");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_PATH_INVALID"]);
  });

  it("escapes control characters before displaying an asset path", async () => {
    const project = await fixture();

    const result = await resolveRawAsset(project, "line\nbreak.bin");

    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("Expected missing asset failure");
    expect(result.diagnostics[0]?.message).toContain("lineU+000Abreak.bin");
    expect(result.diagnostics[0]?.message).not.toContain("\n");
  });

  it("bridges a validated embed into typed source without target-machine facts", async () => {
    const project = await fixture(
      'module Game; const SPRITES: byte[512] = embed("sprites.bin"); function main(): void {}',
    );

    const result = await analyzeProjectWithAssets(project);

    if (result.kind !== "complete") throw new Error(JSON.stringify(result));
    expect(result.kind).toBe("complete");
    expect(result.program.assets).toHaveLength(1);
    expect(result.program.assets[0]?.sourcePath).toBe("assets/sprites.bin");
    const embedded = result.program.declarations.find(
      ({ initializer }) => initializer?.embedded !== undefined,
    )?.initializer?.embedded;
    expect(embedded?.assetId).toBe(result.program.assets[0]?.id);
    expect(embedded?.type).toMatchObject({ kind: "array", length: 512, size: 512 });
  });

  it("bounds hostile expression depth before completing async asset analysis", async () => {
    const nested = Array.from({ length: 5_000 }, () => "1").join("+");
    const project = await fixture(
      `module Game; const SPRITES: byte[512] = embed("sprites.bin"); function main(): void { let value: word = ${nested}; }`,
    );

    const result = await analyzeProjectWithAssets(project);

    expect(result.kind).toBe("incomplete");
    if (result.kind !== "incomplete") throw new Error(`Expected incomplete, got ${result.kind}`);
    expect(result.obligations.map(({ kind }) => kind)).toContain("analysis-limit");
  });
});
