import { buildProject } from "@blend65/compiler";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";
import { libraryStartup, withLibraryVice } from "../rd05/source-library-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";
const SOURCE = `module Game;
function sample(): byte { return 7; }
function main(): void { poke($C100, sample()); }
`;
const BIN = fileURLToPath(new URL("../../packages/cli/dist/bin.js", import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Execute the real built binary directly so option values never pass through a shell. */
function invoke(argv: readonly string[], cwd: string) {
  return new Promise<{ status: number; stdout: string; stderr: string }>((resolve, reject) => {
    execFile(
      process.execPath,
      [BIN, ...argv],
      { cwd, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error && (typeof error.code !== "number" || error.signal)) {
          reject(error);
          return;
        }
        resolve({ status: error ? Number(error.code) : 0, stdout, stderr });
      },
    );
  });
}

/** Snapshot every regular file, including hidden evidence; links cannot stand in for artifacts. */
async function files(directory: string, prefix = ""): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      for (const [child, bytes] of await files(join(directory, entry.name), path))
        result.set(child, bytes);
    } else {
      expect(entry.isFile(), path).toBe(true);
      result.set(path, await readFile(join(directory, entry.name)));
    }
  }
  return new Map([...result].sort(([left], [right]) => left.localeCompare(right, "en")));
}

/** Mode evidence must agree, and selected candidates must resolve to actual feasible records. */
function expectMode(
  build: Record<string, unknown>,
  costs: Record<string, unknown>,
  debug: Record<string, unknown>,
  mode: "none" | "size",
) {
  expect(profileRecord(profileRecord(build.semanticInputs).options).optimization).toBe(mode);
  expect(Object.keys(costs).sort()).toEqual([
    "decisions",
    "entries",
    "kind",
    "mode",
    "schemaVersion",
    "totals",
  ]);
  expect(costs).toMatchObject({ kind: "blend65.costs", schemaVersion: 1, mode });
  expect(debug).toMatchObject({ kind: "blend65.debug", schemaVersion: 1, optimization: mode });
  expect(Array.isArray(debug.optimizations)).toBe(true);
  const decisions = profileRecords(costs.decisions);
  if (mode === "none") {
    expect(decisions).toEqual([]);
    expect(debug.optimizations).toEqual([]);
  }
  const ids = decisions.map((decision) => decision.id);
  expect(ids.every((id) => typeof id === "string")).toBe(true);
  expect(ids).toEqual([...new Set(ids)].sort());
  for (const decision of decisions) {
    expect(decision.mode).toBe("size");
    const candidates = profileRecords(decision.candidates);
    const candidateIds = candidates.map((candidate) => candidate.id);
    expect(candidateIds.every((id) => typeof id === "string")).toBe(true);
    expect(candidateIds).toEqual([...new Set(candidateIds)].sort());
    expect(candidateIds).toContain(decision.baselineCandidateId);
    const selected = candidates.filter(
      (candidate) => candidate.id === decision.selectedCandidateId,
    );
    expect(selected).toHaveLength(1);
    expect(profileRecord(selected[0]!.feasibility).kind).toBe("feasible");
    for (const candidate of candidates) {
      const feasibility = profileRecord(candidate.feasibility);
      expect(["feasible", "rejected"]).toContain(feasibility.kind);
      if (feasibility.kind === "feasible") profileRecord(feasibility.vector);
      else {
        expect(feasibility).not.toHaveProperty("vector");
        expect(profileRecords(feasibility.reasons).length).toBeGreaterThan(0);
      }
    }
  }
}

/** Resolve publication once, then reconcile the complete inventory against exact owned bytes. */
async function publication(root: string, mode: "none" | "size") {
  const current = profileRecord(JSON.parse(await readFile(join(root, "out/current.json"), "utf8")));
  expect(Object.keys(current).sort()).toEqual(["buildJsonSha256", "generationId", "schemaVersion"]);
  expect(current.schemaVersion).toBe(1);
  if (typeof current.generationId !== "string") throw new TypeError("Missing generation identity");
  expect(current.generationId).toMatch(UUID);
  const directory = join(root, "out", current.generationId);
  const generations = (await readdir(join(root, "out"), { withFileTypes: true })).filter((entry) =>
    entry.isDirectory(),
  );
  expect(generations.map((entry) => entry.name)).toEqual([current.generationId]);
  const inventory = await files(directory);
  const buildBytes = inventory.get(".build.json");
  if (buildBytes === undefined) throw new Error("Missing published build evidence");
  expect(current.buildJsonSha256).toBe(sha256(buildBytes));
  const build = profileRecord(JSON.parse(buildBytes.toString("utf8")));
  expect(Object.keys(build).sort()).toEqual([
    "artifacts",
    "generationId",
    "hostProvenance",
    "kind",
    "package",
    "portableTools",
    "schemaVersion",
    "semanticInputs",
  ]);
  expect(build).toMatchObject({
    kind: "blend65.build",
    schemaVersion: 1,
    generationId: current.generationId,
  });
  profileRecord(build.hostProvenance);
  const packaging = profileRecord(build.package);
  expect(Object.keys(packaging).sort()).toEqual([
    "artifactPath",
    "endAddress",
    "kind",
    "loadAddress",
  ]);
  expect(packaging.kind).toBe("prg");
  if (typeof packaging.artifactPath !== "string")
    throw new TypeError("Missing primary artifact path");
  const primary = inventory.get(packaging.artifactPath);
  if (primary === undefined) throw new Error("Missing primary artifact bytes");
  expect(packaging.loadAddress).toBe(primary.readUInt16LE(0));
  expect(packaging.endAddress).toBe(primary.readUInt16LE(0) + primary.length - 2);
  expect(packaging.endAddress).toBeLessThanOrEqual(0x10000);
  inventory.delete(".build.json");
  const digests = profileRecords(build.artifacts);
  expect(digests.map((digest) => digest.path)).toEqual([...inventory.keys()].sort());
  const kinds = new Map([
    [packaging.artifactPath, "primary"],
    [".asm", "assembly"],
    [".labels", "labels"],
    [".assets.json", "assets"],
    [".memory.json", "memory"],
    [".costs.json", "costs"],
    [".debug.json", "debug"],
  ]);
  for (const path of kinds.keys()) expect(inventory.has(path), path).toBe(true);
  for (const digest of digests) {
    expect(Object.keys(digest).sort()).toEqual(["bytes", "kind", "path", "sha256"]);
    if (typeof digest.path !== "string") throw new TypeError("Missing artifact path");
    const bytes = inventory.get(digest.path);
    if (bytes === undefined) throw new Error("Digest names an unpublished artifact");
    expect(kinds.has(digest.path), digest.path).toBe(true);
    expect(digest).toEqual({
      path: digest.path,
      kind: kinds.get(digest.path),
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  const json = (path: string) => {
    const bytes = inventory.get(path);
    if (bytes === undefined) throw new Error(`Missing evidence: ${path}`);
    return profileRecord(JSON.parse(bytes.toString("utf8")));
  };
  const costs = json(".costs.json");
  expectMode(build, costs, json(".debug.json"), mode);
  expect(profileRecord(costs.totals).programBytes).toBe(primary.length - 2);
  const charges = profileRecords(costs.entries).filter(
    (entry) => entry.kind === "bytes" && entry.accounting === "program",
  );
  expect(charges.length).toBeGreaterThan(0);
  const charged = charges.reduce((sum, entry) => {
    if (typeof entry.bytes !== "number" || !Number.isInteger(entry.bytes) || entry.bytes < 0)
      throw new TypeError("Program charges must be nonnegative integral bytes");
    return sum + entry.bytes;
  }, 0);
  expect(charged).toBe(primary.length - 2);
  return {
    directory,
    generationId: current.generationId,
    primaryArtifact: packaging.artifactPath,
    build,
    inventory,
  };
}

describe.sequential("public input size mode", () => {
  // Both explicit modes must produce the specified value, independently of each other.
  it.each(["none", "size"] as const)(
    "should write seven when an ordinary byte helper is built with %s",
    async (mode) => {
      await withProfileProject(SOURCE, PROFILE, async (project, root) => {
        const built = await buildProject({ project, optimization: mode });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected an ordinary helper build");
        const published = await publication(root, mode);
        expect(built.generation.directory).toBe(published.directory);
        expect(built.generation.primaryArtifact).toBe(published.primaryArtifact);
        const artifacts = await readProfileArtifacts(built);
        await withLibraryVice(built, artifacts, PROFILE, async (monitor, stopAt) => {
          await monitor.writeMemory(0xc100, new Uint8Array([0xa5]));
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0xc100, 0xc100))]).toEqual([7]);
        });
      });
    },
    120_000,
  );

  // The built command must publish the requested mode through the public generation record.
  it("should publish size evidence when the built CLI receives an explicit size option", async () => {
    await withProfileProject(SOURCE, PROFILE, async (project, root) => {
      const result = await invoke(["build", "--project", project, "--optimization", "size"], root);
      expect(result.status, result.stderr).toBe(0);
      await publication(root, "size");
    });
  }, 120_000);

  // Existing helper callers retain the conservative mode without an override.
  it("should retain none evidence when an existing build helper is called without a mode", async () => {
    const artifacts = await buildProfileSource(SOURCE, PROFILE);
    expectMode(artifacts.build, artifacts.costs, artifacts.debug, "none");
  }, 120_000);

  // Runtime validation must occur at the real public boundary before output can change.
  it.each(["turbo", "size; touch mode-sentinel"])(
    "should reject %s when supplied to the public build API",
    async (mode) => {
      await withProfileProject(SOURCE, PROFILE, async (project, root) => {
        await writeFile(join(root, "mode-sentinel"), "unchanged");
        const before = await files(root);
        const result: unknown = await Reflect.apply(buildProject, undefined, [
          { project, optimization: mode },
        ]);
        const failure = profileRecord(result);
        expect(failure.kind).toBe("failure");
        expect(profileRecords(failure.diagnostics).length).toBeGreaterThan(0);
        expect(failure).not.toHaveProperty("generation");
        expect(await files(root)).toEqual(before);
      });
    },
    120_000,
  );

  // Invalid build options and build-only check flags are usage errors with no publication.
  it.each([
    ["build", "turbo"],
    ["build", "size; touch mode-sentinel"],
    ["check", "size"],
  ])(
    "should reject %s with optimization %s when invoked through the built CLI",
    async (command, mode) => {
      await withProfileProject(SOURCE, PROFILE, async (project, root) => {
        await writeFile(join(root, "mode-sentinel"), "unchanged");
        const before = await files(root);
        const result = await invoke([command, "--project", project, "--optimization", mode], root);
        expect(result.status).toBe(2);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("CLI_INVALID_ARGUMENT");
        expect(await files(root)).toEqual(before);
      });
    },
    120_000,
  );

  // Publication identities differ while every portable record and artifact byte remains stable.
  it("should reproduce portable evidence when two clean projects are built with size", async () => {
    const cleanBuild = () =>
      withProfileProject(SOURCE, PROFILE, async (project, root) => {
        const built = await buildProject({ project, optimization: "size" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected a clean size build");
        return publication(root, "size");
      });
    const first = await cleanBuild();
    const second = await cleanBuild();
    expect(first.generationId).not.toBe(second.generationId);
    expect(first.build.semanticInputs).toEqual(second.build.semanticInputs);
    expect(first.build.portableTools).toEqual(second.build.portableTools);
    expect(first.build.artifacts).toEqual(second.build.artifacts);
    expect(first.inventory).toEqual(second.inventory);
  }, 120_000);
});
