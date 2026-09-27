import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeProjectOverlay, loadProject } from "@blend65/compiler/frontend";
import type { SourceSpan } from "@blend65/compiler/frontend";

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
