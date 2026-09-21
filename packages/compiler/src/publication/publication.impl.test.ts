import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
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
import {
  parseCurrentRecord,
  readCurrentGeneration,
  readCurrentGenerationForMutation,
} from "./current-record.js";
import { publishGeneration } from "./publication.js";
import type { PreparedGeneration, PublishedFileExpectation } from "./publication.js";

const GENERATION = "11111111-1111-4111-8111-111111111111";
const ZERO_HASH = "0".repeat(64);

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function encoded(result: ReturnType<typeof encodeAssetsEvidence>): Uint8Array {
  if (result.kind !== "complete") throw new Error("Expected valid evidence fixture");
  return result.bytes;
}

function identity(name: string) {
  return Object.freeze({ name, version: "1.0.0", sha256: ZERO_HASH });
}

async function projectSnapshot(root: string): Promise<ProjectSnapshot> {
  const projectRoot = join(root, "project");
  const sourceRoot = join(projectRoot, "src");
  const outDir = join(projectRoot, "out");
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(outDir);
  await writeFile(join(projectRoot, "blend65.json"), "{}\n");
  await writeFile(join(sourceRoot, "main.blend"), "fn main() {}\n");
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
      text: "{}\n",
      sha256: sha256("{}\n"),
      byteLength: 3,
      resolvedPath: join(projectRoot, "blend65.json"),
    }),
    sources: Object.freeze([
      Object.freeze({
        sourceId: "src/main.blend",
        text: "fn main() {}\n",
        sha256: sha256("fn main() {}\n"),
        byteLength: 13,
        resolvedPath: join(sourceRoot, "main.blend"),
      }),
    ]),
    inputSha256: ZERO_HASH,
    projectRoot,
    sourceRoot,
    assetPaths: Object.freeze([]),
    outDir,
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: "c64-pal-prg-kernal-6581",
    effectiveEntry: "main",
  });
}

async function prepared(snapshot: ProjectSnapshot): Promise<PreparedGeneration> {
  const stagingDirectory = join(snapshot.outDir, `.staging-${GENERATION}`);
  await mkdir(stagingDirectory);
  const files = new Map<string, Uint8Array>([
    ["game.prg", Uint8Array.from([0x01, 0x08, 0x60])],
    [".asm", Buffer.from("!cpu 6502\n* = $0801\n!byte $60\n")],
    [".labels", Buffer.from("b65_main = $0801\n")],
    [
      ".assets.json",
      encoded(encodeAssetsEvidence({ kind: "blend65.assets", schemaVersion: 1, assets: [] })),
    ],
    [
      ".memory.json",
      encoded(
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
    ],
    [
      ".costs.json",
      encoded(
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
    ],
    [
      ".debug.json",
      encoded(
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
            sha256: sha256(Uint8Array.from([0x01, 0x08, 0x60])),
          },
          tools: [],
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
    ],
  ]);
  const kinds = new Map([
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
      kind: kinds.get(path)!,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    }))
    .sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  const build = encodeBuildEvidence({
    kind: "blend65.build",
    schemaVersion: 1,
    generationId: GENERATION,
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
    portableTools: [],
    hostProvenance: {
      platform: "linux",
      architecture: "x64",
      nodeVersion: "22.0.0",
      tools: [],
      durationMilliseconds: "Unknown",
      peakRssBytes: "Unknown",
    },
    package: { kind: "prg", artifactPath: "game.prg", loadAddress: 0x0801, endAddress: 0x0802 },
    artifacts,
  });
  if (build.kind !== "complete") throw new Error("Expected valid build fixture");
  files.set(".build.json", build.bytes);
  for (const [path, bytes] of files) await writeFile(join(stagingDirectory, path), bytes);
  const expectations: PublishedFileExpectation[] = [...files.entries()]
    .map(([path, bytes]) => ({ path, bytes: bytes.byteLength, sha256: sha256(bytes) }))
    .sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  return Object.freeze({
    snapshot,
    generationId: GENERATION,
    stagingDirectory,
    files: Object.freeze(expectations),
    primaryArtifact: "game.prg",
    buildJsonSha256: sha256(build.bytes),
  });
}

describe("publication filesystem hardening", () => {
  let root: string;
  let snapshot: ProjectSnapshot;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "blend65-publication-impl-"));
    snapshot = await projectSnapshot(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("should reject noncanonical current-record bytes", () => {
    expect(
      parseCurrentRecord(
        Buffer.from(
          `{"schemaVersion":1,"generationId":"${GENERATION}","buildJsonSha256":"${ZERO_HASH}"}\n`,
        ),
      ),
    ).toBeNull();
  });

  it("should fail closed instead of replacing a malformed existing current record", async () => {
    const input = await prepared(snapshot);
    await writeFile(join(snapshot.outDir, "current.json"), "{}\n");
    const result = await publishGeneration(input);

    expect(result).toEqual(expect.objectContaining({ kind: "error", reason: "current" }));
    await expect(readFile(join(snapshot.outDir, "current.json"), "utf8")).resolves.toBe("{}\n");
  });

  it("should stop when the output-root identity changes before generation rename", async () => {
    const input = await prepared(snapshot);
    const moved = join(snapshot.projectRoot, "moved-out");
    const result = await publishGeneration(input, {
      async onCheckpoint(checkpoint) {
        if (checkpoint.phase !== "before-generation-rename") return;
        await rename(snapshot.outDir, moved);
        await mkdir(snapshot.outDir);
      },
    });

    expect(result).toEqual(expect.objectContaining({ kind: "error", reason: "ownership" }));
    await expect(readFile(join(snapshot.outDir, "current.json"))).rejects.toThrow();
    await expect(
      readFile(join(moved, `.staging-${GENERATION}`, ".build.json")),
    ).resolves.toBeDefined();
  });

  it("should stop when a validated staging file is replaced before generation rename", async () => {
    const input = await prepared(snapshot);
    const debugPath = join(input.stagingDirectory, ".debug.json");
    const result = await publishGeneration(input, {
      async onCheckpoint(checkpoint) {
        if (checkpoint.phase !== "before-generation-rename") return;
        const bytes = await readFile(debugPath);
        await rename(debugPath, `${debugPath}.replaced`);
        await writeFile(debugPath, bytes);
      },
    });

    expect(result).toEqual(expect.objectContaining({ kind: "error", reason: "ownership" }));
    await expect(readFile(join(snapshot.outDir, "current.json"))).rejects.toThrow();
    await expect(readFile(`${debugPath}.replaced`)).resolves.toBeDefined();
  });

  it("should preserve a replaced current candidate instead of renaming or deleting it", async () => {
    const input = await prepared(snapshot);
    let replacementPath: string | null = null;
    const result = await publishGeneration(input, {
      async onCheckpoint(checkpoint) {
        if (checkpoint.phase !== "before-current-replace") return;
        const candidate = (await readdir(snapshot.outDir)).find(
          (name) => name.startsWith(".current-") && name.endsWith(".tmp"),
        );
        if (candidate === undefined) throw new Error("Expected current candidate");
        const candidatePath = join(snapshot.outDir, candidate);
        replacementPath = `${candidatePath}.replaced`;
        const bytes = await readFile(candidatePath);
        await rename(candidatePath, replacementPath);
        await writeFile(candidatePath, bytes);
      },
    });

    expect(result).toEqual(
      expect.objectContaining({ kind: "error", reason: "committed-recovery" }),
    );
    expect(replacementPath).not.toBeNull();
    await expect(readFile(replacementPath!)).resolves.toBeDefined();
    await expect(readFile(join(snapshot.outDir, "current.json"))).rejects.toThrow();
    await expect(readFile(join(snapshot.outDir, GENERATION, ".build.json"))).resolves.toBeDefined();
  });

  it("should retain an old current generation for replacement after project inputs change", async () => {
    await expect(publishGeneration(await prepared(snapshot))).resolves.toEqual(
      expect.objectContaining({ kind: "complete" }),
    );
    const changed: ProjectSnapshot = Object.freeze({
      ...snapshot,
      sources: Object.freeze([
        Object.freeze({
          ...snapshot.sources[0]!,
          text: "fn main() { return; }\n",
          sha256: sha256("fn main() { return; }\n"),
          byteLength: Buffer.byteLength("fn main() { return; }\n"),
        }),
      ]),
    });

    await expect(readCurrentGeneration(changed)).resolves.toEqual(
      expect.objectContaining({ kind: "error", reason: "current" }),
    );
    await expect(readCurrentGenerationForMutation(changed)).resolves.toEqual(
      expect.objectContaining({ kind: "complete" }),
    );
  });
});
