import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "@blend65/compiler";
import type { BuildOptions, BuildResult, BuildSuccess } from "@blend65/compiler";

/** Bump when the cache layout or the helper's invalidation inputs change. */
const CACHE_VERSION = "v2";
const repository = fileURLToPath(new URL("..", import.meta.url));
const cacheRoot = join(
  process.env.BLEND65_TEST_BUILD_CACHE ?? tmpdir(),
  `blend65-test-build-cache-${CACHE_VERSION}`,
);

/** Hash one file tree without following symlinks or depending on directory order. */
async function treeIdentity(root: string): Promise<string> {
  const hash = createHash("sha256");
  const walk = async (directory: string): Promise<void> => {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const key = relative(root, path).split(sep).join("/");
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        const metadata = await stat(path);
        hash.update(`${key}\0${metadata.size}\0`);
        hash.update(await readFile(path));
        hash.update("\0");
      }
    }
  };
  await walk(root);
  return hash.digest("hex");
}

/** Hash the complete build input tree, ignoring compiler-owned output. */
async function projectIdentity(project: string): Promise<string> {
  const hash = createHash("sha256");
  const walk = async (directory: string): Promise<void> => {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      if (entry.name === "out" && directory === project) continue;
      const path = join(directory, entry.name);
      const key = relative(project, path).split(sep).join("/");
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        hash.update(`${key}\0`);
        hash.update(await readFile(path));
        hash.update("\0");
      }
    }
  };
  await walk(project);
  return hash.digest("hex");
}

let toolIdentity: string | undefined;

/** Identify the compiler output and assembler once per test process. */
async function buildIdentity(): Promise<string> {
  toolIdentity ??= await (async () => {
    const compiler = createHash("sha256");
    compiler.update(await treeIdentity(join(repository, "packages/compiler/dist")));
    compiler.update(await treeIdentity(join(repository, "packages/compiler/stdlib")));
    const acme = spawnSync("acme", ["--version"], { encoding: "utf8" });
    compiler.update(acme.status === 0 ? acme.stdout : "acme-unavailable");
    return compiler.digest("hex");
  })();
  return toolIdentity;
}

/** Copy one completed generation into a new project without rebuilding it. */
async function copyGeneration(entry: string, project: string): Promise<BuildSuccess> {
  const projectRoot = dirname(project);
  const result = JSON.parse(await readFile(join(entry, "result.json"), "utf8")) as {
    readonly diagnostics: BuildSuccess["diagnostics"];
    readonly primaryArtifact: string;
    readonly buildJsonSha256: string;
    readonly generationId: string;
  };
  const generationId = result.generationId;
  const directory = join(projectRoot, "out", generationId);
  await mkdir(join(projectRoot, "out"), { recursive: true });
  await rm(directory, { recursive: true, force: true });
  await cp(join(entry, "generation"), directory, { recursive: true });
  await writeFile(
    join(projectRoot, "out", "current.json"),
    JSON.stringify({ buildJsonSha256: result.buildJsonSha256, generationId, schemaVersion: 1 }),
  );
  return Object.freeze({
    kind: "success",
    generation: Object.freeze({
      generationId,
      directory,
      buildJsonSha256: result.buildJsonSha256,
      primaryArtifact: result.primaryArtifact,
    }),
    diagnostics: result.diagnostics,
    measurements: Object.freeze({ durationMilliseconds: "Unknown", peakRssBytes: "Unknown" }),
  });
}

/** Store one successful generation and its public result metadata. */
async function storeGeneration(
  entry: string,
  generation: BuildSuccess["generation"],
  result: BuildSuccess,
): Promise<void> {
  await mkdir(cacheRoot, { recursive: true });
  const temporary = join(cacheRoot, `.tmp-${process.pid}-${Date.now()}-${Math.random()}`);
  try {
    await mkdir(temporary, { recursive: true });
    await cp(generation.directory, join(temporary, "generation"), { recursive: true });
    await writeFile(
      join(temporary, "result.json"),
      JSON.stringify({
        diagnostics: result.diagnostics,
        primaryArtifact: generation.primaryArtifact,
        buildJsonSha256: generation.buildJsonSha256,
        generationId: generation.generationId,
      }),
    );
    await rename(temporary, entry);
  } catch {
    await rm(temporary, { recursive: true, force: true });
  }
}

/**
 * Build a test project through the public service, reusing an identical
 * successful build from a content-addressed cache. Cache entries are keyed by
 * the complete project tree, compiler output and assembler identity, so a
 * compiler change invalidates them. Only successful builds are cached.
 */
export async function cachedBuildProject(options: BuildOptions): Promise<BuildResult> {
  if (options.project === undefined) return buildProject(options);
  const project = options.project;
  const key = createHash("sha256")
    .update(CACHE_VERSION)
    .update("\0")
    .update(await buildIdentity())
    .update("\0")
    .update(await projectIdentity(dirname(project)))
    .update("\0")
    .update(options.optimization ?? "default")
    .update("\0")
    .update(options.target ?? "")
    .update("\0")
    .update(options.entry ?? "")
    .update("\0")
    .update(options.boundsCheck === undefined ? "" : String(options.boundsCheck))
    .update(options.divisionZeroCheck === undefined ? "" : String(options.divisionZeroCheck))
    .digest("hex");
  const entry = join(cacheRoot, key);
  try {
    return await copyGeneration(entry, project);
  } catch {
    // A missing or malformed entry is a cache miss, never a test failure.
  }
  const built = await buildProject(options);
  if (built.kind === "success") await storeGeneration(entry, built.generation, built);
  return built;
}
