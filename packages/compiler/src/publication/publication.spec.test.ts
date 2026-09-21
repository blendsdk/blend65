import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  encodeAssetsEvidence,
  encodeBuildEvidence,
  encodeCostsEvidence,
  encodeDebugEvidence,
  encodeMemoryEvidence,
} from "../artifacts/evidence.js";
import type { ProjectSnapshot } from "../project/types.js";
import { cleanupGenerations } from "./cleanup.js";
import { readCurrentGeneration } from "./current-record.js";
import { pinGeneration, releaseGenerationPin } from "./pins.js";
import { publishGeneration } from "./publication.js";
import type {
  GenerationPin,
  PreparedGeneration,
  PublicationControls,
  PublishedFileExpectation,
} from "./publication.js";

const HASH_ZERO = "0".repeat(64);
const HASH_ONE = "1".repeat(64);
const GENERATION_A = "11111111-1111-4111-8111-111111111111";
const GENERATION_B = "22222222-2222-4222-8222-222222222222";
const GENERATION_C = "33333333-3333-4333-8333-333333333333";

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function completeBytes(result: ReturnType<typeof encodeAssetsEvidence>): Uint8Array {
  if (result.kind !== "complete") throw new Error("Expected valid evidence fixture");
  return result.bytes;
}

function identity(name: string) {
  return Object.freeze({ name, version: "1.0.0", sha256: HASH_ZERO });
}

async function snapshot(root: string): Promise<ProjectSnapshot> {
  const projectRoot = join(root, "project");
  const sourceRoot = join(projectRoot, "src");
  const outDir = join(projectRoot, "out");
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(outDir);
  const manifestText = "{}\n";
  const sourceText = "fn main() {}\n";
  await writeFile(join(projectRoot, "blend65.json"), manifestText, "utf8");
  await writeFile(join(sourceRoot, "main.blend"), sourceText, "utf8");
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1 as const,
      name: "game",
      sourceRoot: "src",
      entry: "main",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: Object.freeze([]),
      outDir: "out",
      optimization: "none" as const,
      boundsCheck: false,
      divisionZeroCheck: false,
    }),
    manifestSource: Object.freeze({
      sourceId: "blend65.json",
      text: manifestText,
      sha256: sha256(manifestText),
      byteLength: Buffer.byteLength(manifestText),
      resolvedPath: join(projectRoot, "blend65.json"),
    }),
    sources: Object.freeze([
      Object.freeze({
        sourceId: "src/main.blend",
        text: sourceText,
        sha256: sha256(sourceText),
        byteLength: Buffer.byteLength(sourceText),
        resolvedPath: join(sourceRoot, "main.blend"),
      }),
    ]),
    inputSha256: HASH_ONE,
    projectRoot,
    sourceRoot,
    assetPaths: Object.freeze([]),
    outDir,
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: "c64-pal-prg-kernal-6581",
    effectiveEntry: "main",
  });
}

function fixedEvidenceFiles(): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  files.set("game.prg", Uint8Array.from([0x01, 0x08, 0x60]));
  files.set(".asm", Buffer.from("!cpu 6502\n* = $0801\n!byte $60\n", "utf8"));
  files.set(".labels", Buffer.from("b65_main = $0801\n", "utf8"));
  files.set(
    ".assets.json",
    completeBytes(encodeAssetsEvidence({ kind: "blend65.assets", schemaVersion: 1, assets: [] })),
  );
  files.set(
    ".memory.json",
    completeBytes(
      encodeMemoryEvidence({
        kind: "blend65.memory",
        schemaVersion: 1,
        profileId: "c64-pal-prg-kernal-6581",
        sfaClosureSha256: sha256("[]"),
        acmeReconciled: true,
        runtimeMemorySafety: "proved",
        residencies: [],
        unboundedEffects: [],
        intervals: [],
        views: [],
        stackDomains: [],
      }),
    ),
  );
  files.set(
    ".costs.json",
    completeBytes(
      encodeCostsEvidence({
        kind: "blend65.costs",
        schemaVersion: 1,
        mode: "none",
        totals: {
          programBytes: 1,
          pathCycles: [],
          resources: [
            { kind: "standard", id: "zeroPage", value: 0 },
            { kind: "standard", id: "residentRam", value: 0 },
            { kind: "standard", id: "hardwareStack", value: 0 },
            { kind: "standard", id: "scratch", value: 0 },
          ],
        },
        entries: [
          {
            kind: "bytes",
            id: "program",
            owner: { kind: "compiler", id: "m1" },
            component: "code",
            accounting: "program",
            bytes: 1,
            sourceSites: [],
            dependencyIds: [],
          },
        ],
        decisions: [],
      }),
    ),
  );
  files.set(
    ".debug.json",
    completeBytes(
      encodeDebugEvidence({
        kind: "blend65.debug",
        schemaVersion: 1,
        compiler: identity("blend65"),
        specification: identity("blend65-language"),
        expertSkill: identity("blend65-domain-expert"),
        profileId: "c64-pal-prg-kernal-6581",
        cpuId: "nmos-6510",
        optimization: "none",
        safety: { boundsCheck: false, divisionZeroCheck: false },
        primaryArtifact: {
          path: "game.prg",
          kind: "primary",
          sha256: sha256(files.get("game.prg")!),
        },
        tools: [
          {
            name: "acme",
            version: "0.97",
            semanticOptions: ["--cpu=6502", "--strict-segments", "--format=cbm"],
          },
        ],
        sources: [
          {
            path: "src/main.blend",
            byteLength: 13,
            sha256: sha256("fn main() {}\n"),
          },
        ],
        assets: [],
        addressSpaces: [],
        functions: [],
        contexts: [],
        symbols: [],
        locations: [],
        ranges: [],
        optimizations: [],
        loadUnits: [],
      }),
    ),
  );
  return files;
}

async function prepared(
  project: ProjectSnapshot,
  generationId: string,
  pinForRun = false,
  signal?: AbortSignal,
): Promise<PreparedGeneration> {
  const stagingDirectory = join(project.outDir, `.staging-${generationId}`);
  await mkdir(stagingDirectory);
  const files = fixedEvidenceFiles();
  const artifactKinds = new Map([
    ["game.prg", "primary"],
    [".asm", "assembly"],
    [".labels", "labels"],
    [".assets.json", "assets"],
    [".memory.json", "memory"],
    [".costs.json", "costs"],
    [".debug.json", "debug"],
  ] as const);
  const artifacts = [...files.entries()]
    .map(([path, bytes]) => ({
      path,
      kind: artifactKinds.get(path)!,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    }))
    .sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  const build = encodeBuildEvidence({
    kind: "blend65.build",
    schemaVersion: 1,
    generationId,
    semanticInputs: {
      projectName: "game",
      sourceRoot: "src",
      entryModule: "main",
      assetSearchPaths: [],
      manifest: { path: "blend65.json", bytes: 3, sha256: sha256("{}\n") },
      sources: [{ path: "src/main.blend", bytes: 13, sha256: sha256("fn main() {}\n") }],
      assets: [],
      compiler: identity("blend65"),
      specification: identity("blend65-language"),
      expertSkill: identity("blend65-domain-expert"),
      target: {
        profileId: "c64-pal-prg-kernal-6581",
        cpuId: "nmos-6510",
        emitterId: "acme-0.97",
        packagerId: "cbm-prg",
      },
      options: { optimization: "none", boundsCheck: false, divisionZeroCheck: false },
      overrides: [],
    },
    portableTools: [
      {
        name: "acme",
        version: "0.97",
        semanticOptions: ["--cpu=6502", "--strict-segments", "--format=cbm"],
      },
    ],
    hostProvenance: {
      platform: "linux",
      architecture: "x64",
      nodeVersion: "22.0.0",
      tools: [{ name: "acme", canonicalPath: "/usr/bin/acme", sha256: HASH_ONE }],
      durationMilliseconds: "Unknown",
      peakRssBytes: "Unknown",
    },
    package: { kind: "prg", artifactPath: "game.prg", loadAddress: 0x0801, endAddress: 0x0802 },
    artifacts,
  });
  if (build.kind !== "complete") throw new Error("Expected valid build evidence fixture");
  files.set(".build.json", build.bytes);
  for (const [path, bytes] of files) await writeFile(join(stagingDirectory, path), bytes);
  const expectations: PublishedFileExpectation[] = [...files.entries()]
    .map(([path, bytes]) => ({ path, bytes: bytes.byteLength, sha256: sha256(bytes) }))
    .sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  return Object.freeze({
    snapshot: project,
    generationId,
    stagingDirectory,
    files: Object.freeze(expectations),
    primaryArtifact: "game.prg",
    buildJsonSha256: sha256(build.bytes),
    pinForRun,
    signal,
  });
}

async function current(project: ProjectSnapshot) {
  return JSON.parse(await readFile(join(project.outDir, "current.json"), "utf8")) as {
    schemaVersion: number;
    generationId: string;
    buildJsonSha256: string;
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function expectCompletePublication(
  input: PreparedGeneration,
  controls?: PublicationControls,
) {
  const result = await publishGeneration(input, controls);
  expect(result.kind).toBe("complete");
  if (result.kind !== "complete") throw new Error("Expected successful publication");
  return result;
}

describe("immutable generation publication", () => {
  let root: string;
  let project: ProjectSnapshot;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "blend65-publication-spec-"));
    project = await snapshot(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  // A committed generation contains exactly eight reconciled files and one matching current record.
  it("should publish exactly eight immutable files with valid current and cross-hashes", async () => {
    const input = await prepared(project, GENERATION_A);
    const result = await expectCompletePublication(input);
    const directory = join(project.outDir, GENERATION_A);
    expect(result.generation).toEqual({
      generationId: GENERATION_A,
      directory,
      buildJsonSha256: input.buildJsonSha256,
      primaryArtifact: "game.prg",
    });
    expect((await readdir(directory)).sort()).toEqual(
      [
        ".asm",
        ".assets.json",
        ".build.json",
        ".costs.json",
        ".debug.json",
        ".labels",
        ".memory.json",
        "game.prg",
      ].sort(),
    );
    expect(await current(project)).toEqual({
      schemaVersion: 1,
      generationId: GENERATION_A,
      buildJsonSha256: input.buildJsonSha256,
    });
    for (const expected of input.files) {
      const bytes = await readFile(join(directory, expected.path));
      expect(bytes.byteLength, expected.path).toBe(expected.bytes);
      expect(sha256(bytes), expected.path).toBe(expected.sha256);
    }
    const build = JSON.parse(await readFile(join(directory, ".build.json"), "utf8"));
    expect(build.artifacts).toHaveLength(7);
    expect(build.artifacts.some(({ path }: { path: string }) => path === ".build.json")).toBe(
      false,
    );
    expect(await readCurrentGeneration(project)).toEqual(
      expect.objectContaining({ kind: "complete", generation: result.generation }),
    );
  });

  // Cancellation before the commit point preserves current and removes only the owned staging tree.
  it("should roll back only owned staging when precommit publication is cancelled", async () => {
    const prior = await prepared(project, GENERATION_A);
    await expectCompletePublication(prior);
    const controller = new AbortController();
    const next = await prepared(project, GENERATION_B, false, controller.signal);
    const unrelated = join(project.outDir, "unrelated");
    await mkdir(unrelated);
    await writeFile(join(unrelated, "keep.txt"), "keep", "utf8");
    const result = await publishGeneration(next, {
      onCheckpoint(checkpoint) {
        if (checkpoint.phase === "before-generation-rename") controller.abort();
      },
    });

    expect(result).toEqual(expect.objectContaining({ kind: "error", reason: "cancelled" }));
    expect((await current(project)).generationId).toBe(GENERATION_A);
    expect(await exists(next.stagingDirectory)).toBe(false);
    expect(await readFile(join(unrelated, "keep.txt"), "utf8")).toBe("keep");
  });

  // Cancellation after generation commit leaves that orphan intact but never advances current.
  it("should preserve prior current when cancellation arrives after generation rename", async () => {
    await expectCompletePublication(await prepared(project, GENERATION_A));
    const controller = new AbortController();
    const next = await prepared(project, GENERATION_B, false, controller.signal);
    const result = await publishGeneration(next, {
      onCheckpoint(checkpoint) {
        if (checkpoint.phase === "after-generation-rename") controller.abort();
      },
    });

    expect(result).toEqual(expect.objectContaining({ kind: "error", reason: "cancelled" }));
    expect((await current(project)).generationId).toBe(GENERATION_A);
    expect(await exists(join(project.outDir, GENERATION_B))).toBe(true);
    expect(await exists(next.stagingDirectory)).toBe(false);
  });

  // The directory lock serializes competing commits without mixing either generation's siblings.
  it("should serialize competing publications and retain a coherent predecessor", async () => {
    const first = await prepared(project, GENERATION_A);
    const second = await prepared(project, GENERATION_B);
    const [left, right] = await Promise.all([publishGeneration(first), publishGeneration(second)]);
    expect(left.kind).toBe("complete");
    expect(right.kind).toBe("complete");
    const currentRecord = await current(project);
    const predecessor = currentRecord.generationId === GENERATION_A ? GENERATION_B : GENERATION_A;
    for (const generationId of [currentRecord.generationId, predecessor]) {
      const names = (await readdir(join(project.outDir, generationId))).sort();
      expect(names).toHaveLength(8);
      expect(names).toContain(".build.json");
      expect(names).toContain("game.prg");
      const build = JSON.parse(
        await readFile(join(project.outDir, generationId, ".build.json"), "utf8"),
      );
      expect(build.generationId).toBe(generationId);
    }
  });

  // Pins have independent ownership; cleanup retains an old generation until its last pin is released.
  it("should retain a pinned generation until both independent pins are released", async () => {
    await expectCompletePublication(await prepared(project, GENERATION_A));
    const firstPin = await pinGeneration({ snapshot: project });
    const secondPin = await pinGeneration({ snapshot: project });
    expect(firstPin.kind).toBe("complete");
    expect(secondPin.kind).toBe("complete");
    if (firstPin.kind !== "complete" || secondPin.kind !== "complete") {
      throw new Error("Expected two current-generation pins");
    }
    expect(firstPin.pin.pinId).not.toBe(secondPin.pin.pinId);
    await expectCompletePublication(await prepared(project, GENERATION_B));
    await expectCompletePublication(await prepared(project, GENERATION_C));
    const oldDirectory = join(project.outDir, GENERATION_A);
    expect(await exists(oldDirectory)).toBe(true);

    expect(await releaseGenerationPin(firstPin.pin)).toEqual({ kind: "complete" });
    expect(await cleanupGenerations(project)).toEqual({ kind: "complete" });
    expect(await exists(oldDirectory)).toBe(true);
    expect(await releaseGenerationPin(secondPin.pin)).toEqual({ kind: "complete" });
    expect(await cleanupGenerations(project)).toEqual({ kind: "complete" });
    expect(await exists(oldDirectory)).toBe(false);
    expect(await exists(join(project.outDir, GENERATION_B))).toBe(true);
    expect(await exists(join(project.outDir, GENERATION_C))).toBe(true);
  });

  it("should recheck pin protection after the cleanup checkpoint", async () => {
    await expectCompletePublication(await prepared(project, GENERATION_A));
    await expectCompletePublication(await prepared(project, GENERATION_B));
    const pinId = "44444444-4444-4444-8444-444444444444";
    const result = await publishGeneration(await prepared(project, GENERATION_C), {
      async onCheckpoint(checkpoint) {
        if (
          checkpoint.phase !== "before-generation-remove" ||
          checkpoint.generationId !== GENERATION_A
        ) {
          return;
        }
        const pinDirectory = join(project.outDir, ".pins", GENERATION_A);
        await mkdir(pinDirectory, { recursive: true });
        await writeFile(join(pinDirectory, `${pinId}.pin`), new Uint8Array());
      },
    });

    expect(result).toEqual(expect.objectContaining({ kind: "error", reason: "pin" }));
    expect((await current(project)).generationId).toBe(GENERATION_C);
    expect(await exists(join(project.outDir, GENERATION_A))).toBe(true);
  });

  it("should not unlink a pin which is replaced at its release checkpoint", async () => {
    await expectCompletePublication(await prepared(project, GENERATION_A));
    const acquired = await pinGeneration({ snapshot: project });
    if (acquired.kind !== "complete") throw new Error("Expected current-generation pin");
    const pinPath = join(project.outDir, ".pins", GENERATION_A, `${acquired.pin.pinId}.pin`);
    const originalPath = `${pinPath}.original`;
    let swapped = false;
    const result = await releaseGenerationPin(acquired.pin, {
      async onCheckpoint(checkpoint) {
        if (checkpoint.phase !== "before-pin-remove") return;
        swapped = true;
        if (checkpoint.path === null) throw new Error("Expected pin checkpoint path");
        await rename(checkpoint.path, originalPath);
        await writeFile(pinPath, new Uint8Array());
      },
    });

    expect(result).toEqual(expect.objectContaining({ kind: "error", reason: "pin" }));
    expect(swapped).toBe(true);
    expect(await exists(pinPath)).toBe(true);
  });

  // Crash debris and malformed or aliased ownership records require manual recovery.
  it("should fail closed without reclaiming unknown lock or pin state", async () => {
    await expectCompletePublication(await prepared(project, GENERATION_A));
    const lock = join(project.outDir, ".publish.lock");
    await mkdir(lock);
    await writeFile(join(lock, "unknown"), "owner", "utf8");
    const locked = await cleanupGenerations(project);
    expect(locked.kind).toBe("error");
    if (locked.kind !== "error") throw new Error("Expected crash-left lock failure");
    expect(["ownership", "lock-timeout"]).toContain(locked.reason);
    expect(locked.diagnostic).toMatch(/manual|recover/i);
    expect(await exists(lock)).toBe(true);
    await rm(lock, { recursive: true });

    const pinDirectory = join(project.outDir, ".pins", GENERATION_A);
    await mkdir(pinDirectory, { recursive: true });
    for (const [name, create] of [
      ["malformed.pin", () => writeFile(join(pinDirectory, "malformed.pin"), "{", "utf8")],
      ["directory.pin", () => mkdir(join(pinDirectory, "directory.pin"))],
      ["symlink.pin", () => symlink(join(root, "outside"), join(pinDirectory, "symlink.pin"))],
    ] as const) {
      await create();
      const result = await cleanupGenerations(project);
      expect(result, name).toEqual(expect.objectContaining({ kind: "error", reason: "pin" }));
      if (result.kind !== "error") throw new Error("Expected invalid pin failure");
      expect(result.diagnostic, name).toMatch(/manual|recover/i);
      expect(await exists(join(pinDirectory, name))).toBe(true);
      await rm(join(pinDirectory, name), { recursive: true });
    }
  }, 15_000);

  // Post-publication cancellation cannot undo the commit; the caller releases its pin after owned work.
  it("should retain a committed run generation until simulated owned work stops and releases its pin", async () => {
    const controller = new AbortController();
    const published = await expectCompletePublication(
      await prepared(project, GENERATION_A, true, controller.signal),
    );
    expect(published.pin).not.toBeNull();
    if (published.pin === null) throw new Error("Expected an independently owned run pin");
    const pin: GenerationPin = published.pin;
    const pinPath = join(project.outDir, ".pins", GENERATION_A, `${pin.pinId}.pin`);
    const work = new Promise<void>((resolve) => setTimeout(resolve, 10));
    controller.abort();
    expect(await exists(join(project.outDir, GENERATION_A))).toBe(true);
    expect((await current(project)).generationId).toBe(GENERATION_A);
    expect(await exists(pinPath)).toBe(true);
    await work;
    expect(await exists(pinPath)).toBe(true);
    await pin.release();
    expect(await exists(pinPath)).toBe(false);
    expect(await exists(join(project.outDir, GENERATION_A))).toBe(true);
  });
});
