import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { buildProject, type BuildSuccess } from "@blend65/compiler";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const expectedFiles = [
  ".asm",
  ".assets.json",
  ".build.json",
  ".costs.json",
  ".debug.json",
  ".labels",
  ".memory.json",
  "m1.prg",
] as const;
const spriteSha256 = "c590c49d0e0aae8a20b39e2f6246c530bb7f52fe8b4c21131ec09a442509f68a";
let temporaryProject: string | undefined;
let buildPromise: Promise<BuildSuccess> | undefined;

/** Hash complete bytes without text decoding or newline normalization. */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Narrow an untrusted JSON value to one ordinary record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reject malformed JSON evidence before a test reads its required fields. */
function record(value: unknown, label: string): Record<string, unknown> {
  expect(value, label).toBeTypeOf("object");
  expect(value, label).not.toBeNull();
  expect(Array.isArray(value), label).toBe(false);
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

/** Read one published JSON sidecar as untrusted structured evidence. */
async function sidecar(generation: BuildSuccess, name: string): Promise<Record<string, unknown>> {
  const text = await readFile(join(generation.generation.directory, name), "utf8");
  const value: unknown = JSON.parse(text);
  return record(value, name);
}

/** Copy the checked-in M1 inputs to an isolated output-owning project. */
async function projectCopy(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-m1-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "assets"), { recursive: true });
  await copyFile(join(repository, "examples/m1/blend65.json"), join(root, "blend65.json"));
  await copyFile(join(repository, "examples/m1/src/game.blend"), join(root, "src/game.blend"));
  await copyFile(
    join(repository, "examples/m1/assets/sprites.bin"),
    join(root, "assets/sprites.bin"),
  );
  return root;
}

/** Build the exact checked-in inputs once through the public compiler service. */
async function m1Build(): Promise<BuildSuccess> {
  if (buildPromise !== undefined) return buildPromise;
  buildPromise = (async () => {
    temporaryProject = await projectCopy();
    const result = await buildProject({ project: join(temporaryProject, "blend65.json") });
    expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
      "success",
    );
    if (result.kind !== "success") throw new Error("The public M1 build did not succeed");
    return result;
  })();
  return buildPromise;
}

afterAll(async () => {
  if (temporaryProject !== undefined) {
    await rm(temporaryProject, { recursive: true, force: true });
  }
});

describe("public M1 generation", () => {
  // One real ACME build publishes the exact coherent set and loads raw sprites at their final address.
  it("should publish one exact ACME-verified eight-file M1 generation", async () => {
    const built = await m1Build();
    expect((await readdir(built.generation.directory)).sort()).toEqual([...expectedFiles]);
    expect(built.generation.primaryArtifact).toBe("m1.prg");

    const prg = await readFile(join(built.generation.directory, "m1.prg"));
    expect([...prg.subarray(0, 2)]).toEqual([0x01, 0x08]);
    expect([...prg.subarray(2, 14)]).toEqual([
      0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00,
    ]);

    const sprites = await readFile(join(repository, "examples/m1/assets/sprites.bin"));
    expect(sprites).toHaveLength(512);
    expect(sha256(sprites)).toBe(spriteSha256);
    const first = prg.indexOf(sprites);
    expect(first).toBeGreaterThanOrEqual(2);
    expect(prg.indexOf(sprites, first + 1)).toBe(-1);
    const spriteAddress = 0x0801 + first - 2;
    expect(spriteAddress % 64).toBe(0);
    expect(spriteAddress).toBeLessThan(0x4000);
    expect(spriteAddress < 0x1000 || spriteAddress >= 0x2000).toBe(true);

    const assets = await sidecar(built, ".assets.json");
    expect(assets).toMatchObject({ kind: "blend65.assets", schemaVersion: 1 });
    const assetRecords = assets.assets;
    expect(Array.isArray(assetRecords)).toBe(true);
    expect(assetRecords).toHaveLength(1);
    const asset = record(assetRecords?.[0], "raw sprite asset");
    expect(asset).toMatchObject({
      handler: "raw",
      handlerVersion: "1",
      selector: "raw",
      logicalType: "const byte[]",
      shape: [512],
      outputSha256: spriteSha256,
      payloadBytes: 512,
      emittedBytes: 512,
      placement: { kind: "single" },
    });
    const placement = record(asset.placement, "raw sprite placement");
    const placedRange = record(placement.range, "raw sprite range");
    expect(placedRange).toMatchObject({
      start: spriteAddress,
      end: spriteAddress + 512,
      alignmentBytes: 64,
      paddingBeforeBytes: 0,
    });
    expect(placedRange.visibility).toEqual(expect.arrayContaining([expect.stringMatching(/vic/i)]));

    const build = await sidecar(built, ".build.json");
    expect(build).toMatchObject({
      kind: "blend65.build",
      schemaVersion: 1,
      generationId: built.generation.generationId,
      package: { kind: "prg", artifactPath: "m1.prg", loadAddress: 0x0801 },
    });
    expect(sha256(await readFile(join(built.generation.directory, ".build.json")))).toBe(
      built.generation.buildJsonSha256,
    );
    const artifacts = build.artifacts;
    expect(Array.isArray(artifacts)).toBe(true);
    expect(artifacts).toHaveLength(7);
    for (const item of artifacts ?? []) {
      const digest = record(item, "artifact digest");
      const path = digest.path;
      expect(typeof path).toBe("string");
      if (typeof path !== "string") throw new TypeError("Artifact path must be text");
      const bytes = await readFile(join(built.generation.directory, path));
      expect(digest).toMatchObject({ bytes: bytes.length, sha256: sha256(bytes) });
    }
  }, 60_000);

  // The generated ledger must cover the same dimensions and meet the frozen complete expert floor.
  it("should meet or beat the independent expert M1 resource baseline", async () => {
    const built = await m1Build();
    const costs = await sidecar(built, ".costs.json");
    expect(costs).toMatchObject({ kind: "blend65.costs", schemaVersion: 1, mode: "none" });
    expect(costs.decisions).toEqual([]);
    const totals = record(costs.totals, "generated cost totals");
    const resources = totals.resources;
    expect(Array.isArray(resources)).toBe(true);
    expect(resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "standard", id: "zeroPage" }),
        expect.objectContaining({ kind: "standard", id: "residentRam" }),
        expect.objectContaining({ kind: "standard", id: "hardwareStack" }),
        expect.objectContaining({ kind: "standard", id: "scratch" }),
      ]),
    );
    const pathCycles = totals.pathCycles;
    expect(Array.isArray(pathCycles)).toBe(true);
    if (!Array.isArray(pathCycles)) throw new TypeError("Generated path cycles must be an array");
    expect(pathCycles.length).toBeGreaterThan(0);

    const expertText = await readFile(
      join(repository, "examples/m1/qualification/expert-ledger.json"),
      "utf8",
    );
    expect(sha256(Buffer.from(expertText, "utf8"))).toBe(
      "95352a5c4e5cc1db209a330f514eec71931f16737f427cff35f17e753f9747ff",
    );
    expect(
      sha256(await readFile(join(repository, "examples/m1/qualification/expert-m1.asm"))),
    ).toBe("4580188de595b1968c4e034244b1141a86ca68b1f9817e883338c17de5806317");
    const expert = record(JSON.parse(expertText), "expert ledger");
    expect(expert).toMatchObject({
      schemaVersion: 1,
      baselineStatus: expect.stringMatching(/^assembled-/),
      expertArtifact: {
        source: { sha256: "4580188de595b1968c4e034244b1141a86ca68b1f9817e883338c17de5806317" },
      },
      inputs: { spriteFixture: { sha256: spriteSha256, emittedCopies: 1 } },
    });
    const expertCosts = record(expert.expertCosts, "expert costs");
    const expertBytes = record(expertCosts.bytes, "expert byte costs");
    expect(totals.programBytes).toBeTypeOf("number");
    expect(expertBytes.prgBody).toBeTypeOf("number");
    if (typeof totals.programBytes !== "number" || typeof expertBytes.prgBody !== "number") {
      throw new TypeError("Program byte totals must be numbers");
    }
    expect(totals.programBytes).toBeLessThanOrEqual(expertBytes.prgBody);

    const comparison = record(expert.comparison, "expert comparison");
    expect(comparison.requiredDimensions).toEqual([
      "behavior and return",
      "code, data, asset, and padding bytes",
      "zero-page, static RAM, and hardware-stack use",
      "RAM and MMIO traffic count and order",
      "named path and complete fixed-trace cycles",
    ]);
    expect(comparison.generated).toBeNull();
    expect(comparison.result).toBe("not-compared");
  }, 60_000);

  // Host observations are recorded without thresholds and the milestone creates no C64U product.
  it("should keep host measurements non-gating and C64U support absent", async () => {
    const built = await m1Build();
    for (const value of Object.values(built.measurements)) {
      expect(value === "Unknown" || (typeof value === "number" && value >= 0)).toBe(true);
    }
    const packages = await readdir(join(repository, "packages"));
    expect(packages.some((name) => /c64u|ultimate/i.test(name))).toBe(false);
    const build = await sidecar(built, ".build.json");
    const semanticInputs = record(build.semanticInputs, "semantic inputs");
    const target = record(semanticInputs.target, "target selection");
    expect(target.profileId).toBe("c64-pal-prg-kernal-6581");
    expect(JSON.stringify(build)).not.toMatch(/c64u|ultimate/i);
  }, 60_000);
});
