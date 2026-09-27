import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeProjectOverlay, loadProject } from "@blend65/compiler/frontend";
import type { SourceSpan } from "@blend65/compiler/frontend";
import { buildProject } from "@blend65/compiler";
import type { BuildSuccess } from "@blend65/compiler";

/** Analyze a real temporary project with an explicit selected target and optional profile module. */
export async function analyzeProfileSource(source: string, target: string, profileModule?: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-profile-source-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    if (profileModule !== undefined)
      await writeFile(join(root, "src/profile.blend"), profileModule);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "profile-source",
        sourceRoot: "src",
        entry: "Game",
        target,
        assetPaths: [],
        outDir: "out",
        optimization: "none",
      }),
    );
    const loaded = await loadProject({ cwd: root });
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    return await analyzeProjectOverlay(loaded.snapshot, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Locate an exact source proof using UTF-8 byte offsets and a zero-based occurrence. */
export function profileSpan(
  source: string,
  proof: string,
  occurrence = 0,
  sourceId = "src/game.blend",
): SourceSpan {
  let index = -1;
  for (let n = 0; n <= occurrence; n += 1) index = source.indexOf(proof, index + 1);
  if (index < 0) throw new Error(`Missing source proof: ${proof}`);
  const start = Buffer.byteLength(source.slice(0, index));
  return { sourceId, start, end: start + Buffer.byteLength(proof) };
}

/** Keep a real build project alive for inspection, then remove its owned temporary tree. */
export async function withProfileProject<T>(
  source: string,
  target: string,
  inspect: (project: string, root: string) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "blend65-profile-build-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    const project = join(root, "blend65.json");
    await writeFile(
      project,
      JSON.stringify({
        schemaVersion: 1,
        name: "profile-build",
        sourceRoot: "src",
        entry: "Game",
        target,
        assetPaths: [],
        outDir: "out",
        optimization: "none",
      }),
    );
    return await inspect(project, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Narrow untrusted JSON before reading a public evidence record. */
export function profileRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Expected a profile evidence record");
  return value as Record<string, unknown>;
}

/** Require an actual array of records instead of accepting missing evidence. */
export function profileRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new TypeError("Expected profile evidence records");
  return value.map(profileRecord);
}

/** Read artifacts only from the exact successful generation returned by the public build. */
export async function readProfileArtifacts(built: BuildSuccess) {
  const directory = built.generation.directory;
  const json = async (name: string) =>
    profileRecord(JSON.parse(await readFile(join(directory, name), "utf8")));
  return {
    assembly: await readFile(join(directory, ".asm"), "utf8"),
    labels: await readFile(join(directory, ".labels"), "utf8"),
    prg: await readFile(join(directory, built.generation.primaryArtifact)),
    build: await json(".build.json"),
    memory: await json(".memory.json"),
    costs: await json(".costs.json"),
    debug: await json(".debug.json"),
  };
}

/** Build with real ACME and retain detached artifact bytes after temporary cleanup. */
export async function buildProfileSource(source: string, target: string) {
  return withProfileProject(source, target, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    return readProfileArtifacts(built);
  });
}
