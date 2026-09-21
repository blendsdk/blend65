import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { analyzeProject, analyzeProjectWithAssets } from "./service.js";

const PROFILE_ID = "c64-pal-prg-kernal-6581";
const temporaryRoots: string[] = [];

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Build one immutable project snapshot with an optional resident-asset directory. */
function snapshot(root: string, text: string, withAssets = false): ProjectSnapshot {
  const manifestText = "{}";
  const source: SourceRecord = Object.freeze({
    sourceId: "src/game.blend",
    text,
    sha256: sha256(text),
    byteLength: Buffer.byteLength(text),
    resolvedPath: join(root, "src/game.blend"),
  });
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1,
      name: "address-of-spec",
      sourceRoot: "src",
      entry: "Game",
      target: PROFILE_ID,
      assetPaths: Object.freeze(withAssets ? ["assets"] : []),
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
    sources: Object.freeze([source]),
    inputSha256: sha256(text),
    projectRoot: root,
    sourceRoot: join(root, "src"),
    assetPaths: Object.freeze(withAssets ? [join(root, "assets")] : []),
    outDir: join(root, "out"),
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: PROFILE_ID,
    effectiveEntry: "Game",
  });
}

/** Create the smallest real resident asset used by the platform address operation. */
async function residentSpriteProject(text: string): Promise<ProjectSnapshot> {
  const root = await mkdtemp(join(tmpdir(), "blend65-address-of-spec-"));
  temporaryRoots.push(root);
  await mkdir(join(root, "src"));
  await mkdir(join(root, "assets"));
  await writeFile(
    join(root, "assets/sprites.bin"),
    Uint8Array.from({ length: 512 }, (_, index) => index & 0xff),
  );
  return snapshot(root, text, true);
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("address-of expressions", () => {
  // Resident embedded data keeps one identity from source analysis into its direct symbolic address.
  it("should lower a resident embedded base address directly into the platform call", async () => {
    const project = await residentSpriteProject(
      [
        "module Game;",
        'const SPRITES: byte[512] = embed("sprites.bin");',
        "function main(): void {",
        "  let block: byte = c64.vic.vicSpriteBlock(&SPRITES);",
        "}",
      ].join("\n"),
    );

    const analysis = await analyzeProjectWithAssets(project);

    expect(analysis.kind).toBe("complete");
    expect(analysis.diagnostics).toEqual([]);
    if (analysis.kind !== "complete") throw new Error(`Expected complete, got ${analysis.kind}`);
    expect(analysis.program.assets).toHaveLength(1);
    const asset = analysis.program.assets[0];
    expect(asset).toBeDefined();
    if (asset === undefined) throw new Error("Missing resident asset");
    const embedded = analysis.program.declarations.find(
      ({ initializer }) => initializer?.embedded !== undefined,
    )?.initializer?.embedded;
    expect(embedded?.assetId).toBe(asset.id);

    const lowered = buildSemanticProgram(analysis);
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") throw new Error(`Expected complete, got ${lowered.kind}`);
    expect(lowered.program.assets.map(({ id }) => id)).toEqual([asset.id]);
    const main = lowered.program.functions.find(
      ({ id }) =>
        id.sourceId === lowered.program.main.sourceId &&
        id.span.start === lowered.program.main.span.start &&
        id.span.end === lowered.program.main.span.end,
    );
    expect(main).toBeDefined();
    if (main === undefined) throw new Error("Missing lowered main");
    const operations = main.blocks.flatMap(({ operations: blockOperations }) => blockOperations);
    const address = operations.find((operation) => operation.kind === "embedded-address");
    expect(address).toMatchObject({
      kind: "embedded-address",
      asset: asset.id,
      type: { kind: "scalar", name: "word" },
    });
    if (address?.kind !== "embedded-address") throw new Error("Missing embedded address");
    expect(operations).toContainEqual(
      expect.objectContaining({
        kind: "platform",
        capability: "c64.vic.vicSpriteBlock",
        arguments: [address.result],
      }),
    );
    expect(operations.filter((operation) => operation.kind === "call")).toEqual([]);
  });

  // Values without storage are rejected by their exact source-language reason.
  it.each([
    {
      name: "an inlined scalar constant",
      text: "module Game; const LIMIT: byte = 3; function main(): void { let address: word = &LIMIT; }",
      code: "E10040",
    },
    {
      name: "a literal",
      text: "module Game; function main(): void { let address: word = &42; }",
      code: "E10043",
    },
  ])("should reject the address of $name with $code", ({ text, code }) => {
    const result = analyzeProject(snapshot("/checkout", text));

    expect(result.kind).toBe("error");
    expect(result).not.toHaveProperty("program");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([code]);
  });
});
